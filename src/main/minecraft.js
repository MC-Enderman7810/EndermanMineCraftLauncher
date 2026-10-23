'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const {
  ensureDir, exists, readJson, writeJson, downloadFile, fetchJson,
  sha1File, extractZipSafe, formatDate, safeName
} = require('./util');

const MANIFEST_MOJANG = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const MANIFEST_BMCLAPI = 'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json';
const RES_MOJANG = 'https://resources.download.minecraft.net/';
const RES_BMCLAPI = 'https://bmclapi2.bangbang93.com/assets/';

function manifestUrl(source) {
  return source === 'mojang' ? MANIFEST_MOJANG : MANIFEST_BMCLAPI;
}

function mirrorUrl(url, source) {
  if (!url || source === 'mojang') return url;
  return String(url)
    .replace('https://piston-meta.mojang.com', 'https://bmclapi2.bangbang93.com')
    .replace('https://launchermeta.mojang.com', 'https://bmclapi2.bangbang93.com')
    .replace('https://launcher.mojang.com', 'https://bmclapi2.bangbang93.com')
    .replace('https://resources.download.minecraft.net', 'https://bmclapi2.bangbang93.com/assets')
    .replace('https://libraries.minecraft.net', 'https://bmclapi2.bangbang93.com/maven');
}

function assetRoot(source) {
  return source === 'mojang' ? RES_MOJANG : RES_BMCLAPI;
}

async function fetchManifest(source) {
  const data = await fetchJson(manifestUrl(source));
  if (!data || !Array.isArray(data.versions)) throw new Error('版本清单格式异常');
  return {
    latest: data.latest,
    versions: data.versions.map((v) => ({
      id: v.id,
      type: v.type,
      url: mirrorUrl(v.url, source),
      releaseTime: v.releaseTime,
      time: v.time
    }))
  };
}

function detectLoader(id, json) {
  const text = ((id || '') + ' ' + (json && json.mainClass ? json.mainClass : '') + ' ' +
    (json && Array.isArray(json.libraries) ? json.libraries.map((l) => l.name || '').join(' ') : ''))
    .toLowerCase();
  if (text.includes('neoforge')) return 'NeoForge';
  if (text.includes('forge')) return 'Forge';
  if (text.includes('fabric')) return 'Fabric';
  if (text.includes('quilt')) return 'Quilt';
  if (text.includes('optifine')) return 'OptiFine';
  return '原版';
}

async function scanInstalled(gameDir) {
  const out = [];
  const versionsDir = path.join(gameDir, 'versions');
  if (!await exists(versionsDir)) return out;
  let names = [];
  try { names = await fsp.readdir(versionsDir); } catch { return out; }
  for (const id of names) {
    const jsonPath = path.join(versionsDir, id, id + '.json');
    if (!await exists(jsonPath)) continue;
    const json = await readJson(jsonPath, null);
    if (!json) continue;
    let st = null;
    try { st = await fsp.stat(jsonPath); } catch { /* ignore */ }
    const clientJar = await findClientJar(gameDir, id);
    out.push({
      id,
      dir: path.join(versionsDir, id),
      jsonPath,
      loader: detectLoader(id, json),
      type: json.type || 'release',
      mcVersion: json.inheritsFrom || id,
      javaVersion: json.javaVersion ? json.javaVersion.majorVersion : 0,
      lastPlayed: st ? st.mtimeMs : 0,
      hasClientJar: !!clientJar,
      clientJar: clientJar || ''
    });
  }
  out.sort((a, b) => {
    if (b.lastPlayed !== a.lastPlayed) return b.lastPlayed - a.lastPlayed;
    return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
  return out;
}

async function findClientJar(gameDir, id) {
  const jar = path.join(gameDir, 'versions', id, id + '.jar');
  if (await exists(jar)) return jar;
  const jsonPath = path.join(gameDir, 'versions', id, id + '.json');
  const json = await readJson(jsonPath, null);
  if (json && json.inheritsFrom) return findClientJar(gameDir, json.inheritsFrom);
  return '';
}

async function loadVersionChain(gameDir, id) {
  const chain = [];
  const seen = new Set();
  let current = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const jsonPath = path.join(gameDir, 'versions', current, current + '.json');
    const json = await readJson(jsonPath, null);
    if (!json) throw new Error('找不到版本 JSON：' + current);
    chain.unshift({ id: current, json, jsonPath });
    current = json.inheritsFrom;
  }
  return chain;
}

function mergeLibraries(chain) {
  const map = new Map();
  const order = [];
  for (const item of chain) {
    const libs = Array.isArray(item.json.libraries) ? item.json.libraries : [];
    for (const lib of libs) {
      const parts = String(lib.name || '').split(':');
      // 普通 jar 与 natives classifier 必须同时保留，否则 LWJGL 主类会缺失；
      // 同一个 group:artifact 的普通库在不同继承层出现时，子版本覆盖父版本。
      const key = parts.length >= 2
        ? parts[0] + ':' + parts[1] + (parts[3] ? ':' + parts[3] : '')
        : (lib.name || JSON.stringify(lib));
      if (!map.has(key)) order.push(key);
      map.set(key, lib);
    }
  }
  return order.map((key) => map.get(key)).filter(Boolean);
}

function mergeArguments(chain, key) {
  const out = [];
  for (const item of chain) {
    const args = item.json.arguments && item.json.arguments[key];
    if (Array.isArray(args)) out.push(...args);
  }
  return out;
}

async function resolveVersion(gameDir, id) {
  const chain = await loadVersionChain(gameDir, id);
  const last = chain[chain.length - 1];
  const base = chain[0];
  const merged = Object.assign({}, base.json);
  merged.id = id;
  merged.libraries = mergeLibraries(chain);
  merged.arguments = {
    game: mergeArguments(chain, 'game'),
    jvm: mergeArguments(chain, 'jvm')
  };
  if (!merged.arguments.game.length && last.json.minecraftArguments) {
    merged.minecraftArguments = last.json.minecraftArguments;
  } else if (last.json.minecraftArguments) {
    merged.minecraftArguments = last.json.minecraftArguments;
  }
  merged.mainClass = last.json.mainClass || base.json.mainClass;
  merged.assetIndex = last.json.assetIndex || base.json.assetIndex ||
    (chain.map((x) => x.json.assetIndex).filter(Boolean).pop());
  merged.javaVersion = last.json.javaVersion || base.json.javaVersion;
  merged.type = last.json.type || base.json.type;
  merged.assets = last.json.assets || base.json.assets;
  merged.inheritsFrom = last.json.inheritsFrom || '';
  merged.clientJarPath = await findClientJar(gameDir, id);
  merged.chain = chain;
  return merged;
}

function osName() {
  return 'windows';
}

function archName() {
  return process.arch === 'ia32' ? 'x86' : 'x86_64';
}

function ruleMatches(rule) {
  if (!rule) return false;
  if (rule.os) {
    if (rule.os.name && rule.os.name !== osName()) return false;
    if (rule.os.arch && rule.os.arch !== archName()) return false;
    if (rule.os.version && !new RegExp(rule.os.version).test(process.getSystemVersion ? process.getSystemVersion() : '')) return false;
  }
  if (rule.features) {
    // demo / custom resolution / quick play 等特性默认全部关闭
    return false;
  }
  return true;
}

function ruleAllows(rules) {
  if (!Array.isArray(rules) || !rules.length) return true;
  let allowed = false;
  for (const rule of rules) {
    if (ruleMatches(rule)) allowed = rule.action === 'allow';
  }
  return allowed;
}

function mavenPath(name) {
  if (!name) return '';
  const parts = String(name).split(':');
  if (parts.length < 3) return '';
  const group = parts[0].replace(/\./g, '/');
  const artifact = parts[1];
  const version = parts[2];
  let file = artifact + '-' + version;
  if (parts[3]) file += '-' + parts[3];
  return group + '/' + artifact + '/' + version + '/' + file + '.jar';
}

function joinUrl(base, rel) {
  return String(base).replace(/\/+$/, '') + '/' + String(rel).replace(/^\/+/, '');
}

function collectLibraries(version) {
  const artifacts = [];
  const natives = [];
  for (const lib of version.libraries || []) {
    if (!ruleAllows(lib.rules)) continue;
    if (lib.downloads && lib.downloads.artifact) {
      const a = lib.downloads.artifact;
      if (a && a.path && a.url) {
        artifacts.push({
          path: a.path,
          url: a.url,
          sha1: a.sha1 || '',
          size: a.size || 0,
          name: lib.name
        });
      }
    } else {
      const rel = mavenPath(lib.name);
      if (rel) {
        const base = lib.url || 'https://libraries.minecraft.net/';
        artifacts.push({
          path: rel,
          url: joinUrl(base, rel),
          sha1: lib.sha1 || '',
          size: lib.size || 0,
          name: lib.name
        });
      }
    }
    if (lib.natives) {
      const classifiers = lib.downloads && lib.downloads.classifiers;
      if (!classifiers) continue;
      const candidates = [];
      const key = lib.natives[osName()];
      if (key) candidates.push(key);
      candidates.push('natives-windows-' + archName().replace('x86_64', '64'));
      candidates.push('natives-windows');
      for (const c of candidates) {
        const a = classifiers[c];
        if (a && a.path && a.url) {
          natives.push({
            path: a.path,
            url: a.url,
            sha1: a.sha1 || '',
            size: a.size || 0,
            name: lib.name
          });
          break;
        }
      }
    }
  }
  return { artifacts, natives };
}

async function ensureLibrary(artifact, gameDir, source, progress, label) {
  const dest = path.join(gameDir, 'libraries', artifact.path);
  if (await exists(dest)) {
    try {
      const st = await fsp.stat(dest);
      if (!artifact.size || st.size === artifact.size) return;
    } catch { /* fall through */ }
  }
  const url = mirrorUrl(artifact.url, source);
  await downloadFile(url, dest, {
    expectedSha1: artifact.sha1,
    timeout: 180000,
    onProgress: (received, total) => {
      if (progress && total) {
        progress.subBytes = (progress.subBytes || 0) + received;
      }
    }
  });
}

async function installLibraries(version, gameDir, source, progress, label) {
  const { artifacts, natives } = collectLibraries(version);
  const total = artifacts.length + natives.length;
  let done = 0;
  const tick = (msg) => {
    if (progress) progress(done, total, msg || label);
  };
  for (const art of artifacts) {
    tick('库 ' + (done + 1) + '/' + total);
    await ensureLibrary(art, gameDir, source, null, label);
    done++;
    if (done % 4 === 0 || done === total) tick();
  }
  const nativesDir = path.join(gameDir, 'versions', version.id, 'natives');
  if (natives.length) {
    await ensureDir(nativesDir);
    for (const art of natives) {
      tick('本机库 ' + (done + 1) + '/' + total);
      const dest = path.join(gameDir, 'libraries', art.path);
      await ensureLibrary(art, gameDir, source, null, label);
      try {
        await extractZipSafe(dest, nativesDir, { skipMeta: true });
      } catch (e) {
        // 某些 natives 不是 zip，忽略
      }
      done++;
      if (done % 4 === 0 || done === total) tick();
    }
  }
  return { total, nativesDir };
}

async function installAssets(version, gameDir, source, progress) {
  if (!version.assetIndex || !version.assetIndex.url) return { total: 0 };
  const indexId = version.assetIndex.id || version.assets || version.id;
  const indexDir = path.join(gameDir, 'assets', 'indexes');
  await ensureDir(indexDir);
  const indexPath = path.join(indexDir, indexId + '.json');
  const indexUrl = mirrorUrl(version.assetIndex.url, source);
  if (!await exists(indexPath)) {
    await downloadFile(indexUrl, indexPath, {
      expectedSha1: version.assetIndex.sha1 || '',
      timeout: 120000
    });
  }
  const index = await readJson(indexPath, null);
  if (!index || !index.objects) return { total: 0 };
  const keys = Object.keys(index.objects);
  const total = keys.length;
  let done = 0;
  const concurrency = 12;
  const root = path.join(gameDir, 'assets', 'objects');
  let cursor = 0;
  const worker = async () => {
    while (cursor < keys.length) {
      const key = keys[cursor++];
      const obj = index.objects[key];
      if (!obj || !obj.hash) continue;
      const prefix = obj.hash.substring(0, 2);
      const dest = path.join(root, prefix, obj.hash);
      let need = true;
      if (await exists(dest)) {
        try {
          const st = await fsp.stat(dest);
          need = obj.size ? st.size !== obj.size : false;
        } catch { need = true; }
      }
      if (need) {
        try {
          await downloadFile(assetRoot(source) + prefix + '/' + obj.hash, dest, {
            expectedSha1: obj.hash,
            timeout: 120000
          });
        } catch (e) {
          // 单个资源失败不阻塞全部；下次补全可重试
        }
      }
      done++;
      if (progress && (done % 20 === 0 || done === total)) {
        progress(done, total, '资源 ' + done + '/' + total);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
  return { total };
}

async function installVersion(versionId, jsonUrl, gameDir, source, progress) {
  const versionDir = path.join(gameDir, 'versions', versionId);
  await ensureDir(versionDir);
  const jsonPath = path.join(versionDir, versionId + '.json');
  progress(0, 100, '获取版本 JSON');
  // 总是重新拉取，保证清单里的地址是最新的
  const res = await fetch(mirrorUrl(jsonUrl, source), {
    headers: { 'User-Agent': 'EMCL/1.26.25.08' }
  });
  const text = await res.text();
  if (!res.ok) throw new Error('版本 JSON 下载失败：HTTP ' + res.status);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('版本 JSON 无法解析'); }
  await fsp.writeFile(jsonPath, JSON.stringify(json, null, 2), 'utf8');
  progress(3, 100, '版本 JSON 已保存');

  if (!json.downloads || !json.downloads.client) {
    throw new Error('该版本没有客户端 jar（可能是服务端包）');
  }
  const jarPath = path.join(versionDir, versionId + '.jar');
  const client = json.downloads.client;
  let needJar = true;
  if (await exists(jarPath)) {
    try {
      const st = await fsp.stat(jarPath);
      needJar = client.size ? st.size !== client.size : false;
    } catch { needJar = true; }
  }
  if (needJar) {
    progress(5, 100, '下载客户端 jar');
    await downloadFile(mirrorUrl(client.url, source), jarPath, {
      expectedSha1: client.sha1 || '',
      timeout: 300000,
      onProgress: (received, total) => {
        if (total) progress(5 + Math.min(35, received / total * 35), 100, '客户端 ' + Math.round(received / 1048576) + ' MB');
      }
    });
  }
  progress(42, 100, '解析依赖');
  const resolved = await resolveVersion(gameDir, versionId);
  await installLibraries(resolved, gameDir, source, (done, total, msg) => {
    progress(42 + (total ? done / total * 28 : 0), 100, msg || '依赖');
  });
  progress(72, 100, '补全资源文件');
  const assets = await installAssets(resolved, gameDir, source, (done, total, msg) => {
    progress(72 + (total ? done / total * 27 : 0), 100, msg || '资源');
  });
  progress(100, 100, '安装完成：' + (assets.total || 0) + ' 个资源对象');
  return { versionId, libraries: (resolved.libraries || []).length, assets: assets.total || 0 };
}

async function installLibrariesForVersion(versionId, gameDir, source, progress) {
  const resolved = await resolveVersion(gameDir, versionId);
  await installLibraries(resolved, gameDir, source, progress);
  return resolved;
}

/**
 * 补全一个已经在磁盘上的版本：客户端 jar、libraries、natives 与 assets。
 * 用于导入 PCL2 / 官方目录后，某些版本只留下了 JSON、没有 jar 的情况。
 */
async function repairVersion(versionId, gameDir, source, progress) {
  const chain = await loadVersionChain(gameDir, versionId);
  progress(0, 100, '检查版本文件');
  for (const item of chain) {
    const d = item.json.downloads && item.json.downloads.client;
    if (!d || !d.url) continue;
    const dir = path.join(gameDir, 'versions', item.id);
    const jarPath = path.join(dir, item.id + '.jar');
    if (await exists(jarPath)) {
      try {
        const st = await fsp.stat(jarPath);
        if (!d.size || st.size === d.size) continue;
      } catch { /* redownload */ }
    }
    await ensureDir(dir);
    progress(3, 100, '下载 ' + item.id + ' 客户端 jar');
    await downloadFile(mirrorUrl(d.url, source), jarPath, {
      expectedSha1: d.sha1 || '',
      timeout: 300000,
      onProgress: (received, total) => {
        if (total) progress(3 + Math.min(25, received / total * 25), 100,
          '客户端 ' + Math.round(received / 1048576) + ' MB');
      }
    });
  }
  const resolved = await resolveVersion(gameDir, versionId);
  progress(30, 100, '补全依赖库');
  await installLibraries(resolved, gameDir, source, (done, total, msg) => {
    progress(30 + (total ? done / total * 30 : 0), 100, msg || '依赖库');
  });
  progress(62, 100, '补全资源文件');
  await installAssets(resolved, gameDir, source, (done, total, msg) => {
    progress(62 + (total ? done / total * 37 : 0), 100, msg || '资源');
  });
  progress(100, 100, '版本文件补全完成');
  return { versionId };
}

async function getWorlds(gameDir, versionId, isolation) {
  const instance = isolation && versionId ? path.join(gameDir, 'versions', versionId) : gameDir;
  const dir = path.join(instance, 'saves');
  if (!await exists(dir)) return [];
  const names = await fsp.readdir(dir).catch(() => []);
  const out = [];
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const st = await fsp.stat(full);
      if (!st.isDirectory()) continue;
      if (!await exists(path.join(full, 'level.dat'))) continue;
      out.push({ name, path: full, modified: st.mtimeMs });
    } catch { /* ignore */ }
  }
  out.sort((a, b) => b.modified - a.modified);
  return out;
}

function instanceDir(config, versionId) {
  if (config.isolation && versionId) return path.join(config.gameDir, 'versions', versionId);
  return config.gameDir;
}

module.exports = {
  MANIFEST_MOJANG,
  MANIFEST_BMCLAPI,
  manifestUrl,
  mirrorUrl,
  assetRoot,
  fetchManifest,
  scanInstalled,
  resolveVersion,
  loadVersionChain,
  findClientJar,
  detectLoader,
  ruleAllows,
  collectLibraries,
  installLibraries,
  installLibrariesForVersion,
  installAssets,
  installVersion,
  repairVersion,
  getWorlds,
  instanceDir
};
