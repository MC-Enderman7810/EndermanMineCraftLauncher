'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');
const {
  ensureDir, exists, fetchJson, downloadFile, readJson, writeJson, removeTree, safeName
} = require('./util');
const { installLibrariesForVersion, scanInstalled } = require('./minecraft');
const { resolveJava, ensureJava, javaMajorForMc } = require('./java');

const FABRIC_META = 'https://meta.fabricmc.net/v2';
const QUILT_META = 'https://meta.quiltmc.org/v3';
const FORGE_PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge/';
const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';

async function pickStableLoader(list, key) {
  if (!Array.isArray(list) || !list.length) return null;
  const normalized = list.map((x) => x.loader || x);
  const stable = normalized.find((x) => x.stable === true);
  return stable || normalized[0];
}

async function installFabric(store, mcVersion, gameDir, progress, loaderVersion = '') {
  const config = store.getConfig();
  const source = config.downloadSource;
  progress(2, '获取 Fabric 加载器列表');
  let version = loaderVersion;
  if (!version) {
    const list = await fetchJson(FABRIC_META + '/versions/loader/' + encodeURIComponent(mcVersion));
    const pick = await pickStableLoader(list);
    if (!pick) throw new Error('该 Minecraft 版本没有可用的 Fabric 加载器');
    version = pick.version;
  }
  progress(10, '下载 Fabric ' + version + ' 配置');
  const profile = await fetchJson(FABRIC_META + '/versions/loader/' +
    encodeURIComponent(mcVersion) + '/' + encodeURIComponent(version) + '/profile/json');
  const id = profile.id;
  if (!id) throw new Error('Fabric 返回的配置缺少 id');
  const dir = path.join(gameDir, 'versions', id);
  await ensureDir(dir);
  await writeJson(path.join(dir, id + '.json'), profile);
  progress(25, '补齐 Fabric 依赖库');
  await installLibrariesForVersion(id, gameDir, source, (done, total, msg) => {
    progress(25 + (total ? done / total * 70 : 0), msg || '依赖库');
  });
  progress(100, 'Fabric 安装完成');
  return { versionId: id, loader: 'Fabric', loaderVersion: version, message: 'Fabric ' + version + ' 已安装' };
}

async function installQuilt(store, mcVersion, gameDir, progress, loaderVersion = '') {
  const config = store.getConfig();
  const source = config.downloadSource;
  progress(2, '获取 Quilt 加载器列表');
  let version = loaderVersion;
  if (!version) {
    const list = await fetchJson(QUILT_META + '/versions/loader/' + encodeURIComponent(mcVersion));
    const pick = await pickStableLoader(list);
    if (!pick) throw new Error('该 Minecraft 版本没有可用的 Quilt 加载器');
    version = pick.version;
  }
  progress(10, '下载 Quilt ' + version + ' 配置');
  const profile = await fetchJson(QUILT_META + '/versions/loader/' +
    encodeURIComponent(mcVersion) + '/' + encodeURIComponent(version) + '/profile/json');
  const id = profile.id;
  if (!id) throw new Error('Quilt 返回的配置缺少 id');
  const dir = path.join(gameDir, 'versions', id);
  await ensureDir(dir);
  await writeJson(path.join(dir, id + '.json'), profile);
  progress(25, '补齐 Quilt 依赖库');
  await installLibrariesForVersion(id, gameDir, source, (done, total, msg) => {
    progress(25 + (total ? done / total * 70 : 0), msg || '依赖库');
  });
  progress(100, 'Quilt 安装完成');
  return { versionId: id, loader: 'Quilt', loaderVersion: version, message: 'Quilt ' + version + ' 已安装' };
}

async function runJavaInstaller(store, mcVersion, installer, gameDir, args, onOutput) {
  let java = await resolveJava(store, mcVersion);
  if (!java.path) {
    const major = javaMajorForMc(mcVersion);
    java = await ensureJava(store, major, (p) => onOutput && onOutput(p.message));
  }
  if (!java.path) throw new Error('安装加载器需要 Java 运行时');
  await ensureDir(gameDir);
  const profiles = path.join(gameDir, 'launcher_profiles.json');
  if (!await exists(profiles)) {
    await writeJson(profiles, {
      profiles: {},
      selectedProfile: '',
      clientToken: '',
      authenticationDatabase: {},
      launcherVersion: { name: 'EMCL', format: 21 }
    });
  }
  return new Promise((resolve, reject) => {
    const child = spawn(java.path, ['-jar', installer, ...args], {
      cwd: gameDir,
      windowsHide: true
    });
    let output = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error('安装器超时（10 分钟）'));
    }, 600000);
    const push = (text) => {
      output += text;
      if (onOutput) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) onOutput(line.trim());
        }
      }
    };
    child.stdout.on('data', (d) => push(d.toString('utf8')));
    child.stderr.on('data', (d) => push(d.toString('utf8')));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error('安装器退出码 ' + code + '：' + output.split(/\r?\n/).filter(Boolean).slice(-4).join(' | ')));
    });
  });
}

async function latestForgeVersion(mcVersion, channel) {
  const promos = await fetchJson(FORGE_PROMOS);
  const map = promos.promos || {};
  const rec = map[mcVersion + '-recommended'];
  const latest = map[mcVersion + '-latest'];
  const version = channel === 'latest' ? (latest || rec) : (rec || latest);
  if (!version) throw new Error('该版本没有可用的 Forge（' + mcVersion + '）');
  return version;
}

async function installForge(store, mcVersion, gameDir, progress, options = {}) {
  const config = store.getConfig();
  const version = options.loaderVersion || await latestForgeVersion(mcVersion, options.channel || 'recommended');
  const installerName = 'forge-' + mcVersion + '-' + version + '-installer.jar';
  const installer = path.join(store.cacheDir, installerName);
  if (!await exists(installer)) {
    progress(5, '下载 Forge 安装器 ' + version);
    const urls = [
      FORGE_MAVEN + mcVersion + '-' + version + '/' + installerName,
      FORGE_MAVEN + mcVersion + '-' + version + '-' + mcVersion + '/' +
        'forge-' + mcVersion + '-' + version + '-' + mcVersion + '-installer.jar'
    ];
    let ok = false;
    for (const url of urls) {
      try {
        await downloadFile(url, installer, { timeout: 300000 });
        ok = true;
        break;
      } catch { /* try next */ }
    }
    if (!ok) throw new Error('Forge 安装器下载失败');
  }
  progress(20, '运行 Forge 安装器（需要几分钟）');
  await runJavaInstaller(store, mcVersion, installer, gameDir,
    ['--installClient'],
    (line) => progress(30, line));
  const installed = await scanInstalled(gameDir);
  const found = installed.find((v) => v.loader === 'Forge' &&
    (v.id.toLowerCase().includes(mcVersion.toLowerCase()) || v.mcVersion === mcVersion));
  progress(100, 'Forge 安装完成');
  return {
    versionId: found ? found.id : '',
    loader: 'Forge',
    loaderVersion: version,
    message: 'Forge ' + version + ' 安装完成' + (found ? '（' + found.id + '）' : '')
  };
}

async function neoForgeVersions(mcVersion) {
  const xml = await (await fetch(NEOFORGE_MAVEN, {
    headers: { 'User-Agent': 'EMCL/1.26.25.08' }
  })).text();
  const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  if (!/^1\./.test(mcVersion)) return [];
  const parts = mcVersion.split('.');
  const prefix = parts[1] + '.' + (parts[2] || 0) + '.';
  const matched = versions.filter((v) => v.startsWith(prefix));
  matched.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
    }
    return 0;
  });
  return matched;
}

async function installNeoForge(store, mcVersion, gameDir, progress, options = {}) {
  let version = options.loaderVersion;
  if (!version) {
    const list = await neoForgeVersions(mcVersion);
    if (!list.length) throw new Error('该版本没有可用的 NeoForge');
    version = list[0];
  }
  const installer = path.join(store.cacheDir, 'neoforge-' + version + '-installer.jar');
  if (!await exists(installer)) {
    progress(5, '下载 NeoForge 安装器 ' + version);
    await downloadFile('https://maven.neoforged.net/releases/net/neoforged/neoforge/' +
      version + '/neoforge-' + version + '-installer.jar', installer, { timeout: 300000 });
  }
  progress(20, '运行 NeoForge 安装器（需要几分钟）');
  await runJavaInstaller(store, mcVersion, installer, gameDir,
    ['--installClient'],
    (line) => progress(30, line));
  const installed = await scanInstalled(gameDir);
  const found = installed.find((v) => v.loader === 'NeoForge' &&
    (v.id.toLowerCase().includes(version.toLowerCase()) || v.mcVersion === mcVersion));
  progress(100, 'NeoForge 安装完成');
  return {
    versionId: found ? found.id : '',
    loader: 'NeoForge',
    loaderVersion: version,
    message: 'NeoForge ' + version + ' 安装完成' + (found ? '（' + found.id + '）' : '')
  };
}

async function installLoader(store, type, mcVersion, gameDir, progress = () => {}, options = {}) {
  const t = String(type || '').toLowerCase();
  if (t === 'fabric') return installFabric(store, mcVersion, gameDir, progress, options.loaderVersion);
  if (t === 'quilt') return installQuilt(store, mcVersion, gameDir, progress, options.loaderVersion);
  if (t === 'forge') return installForge(store, mcVersion, gameDir, progress, options);
  if (t === 'neoforge') return installNeoForge(store, mcVersion, gameDir, progress, options);
  throw new Error('不支持的加载器：' + type);
}

module.exports = {
  installFabric,
  installQuilt,
  installForge,
  installNeoForge,
  installLoader,
  neoForgeVersions
};
