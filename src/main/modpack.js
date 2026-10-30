'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const AdmZip = require('adm-zip');
const {
  ensureDir, exists, readJson, writeJson, downloadFile, fetchJson, sha1File,
  extractZipSafe, copyTree, removeTree, safeJoin, safeName
} = require('./util');
const {
  fetchManifest, installVersion, scanInstalled, instanceDir, mirrorUrl
} = require('./minecraft');
const { installLoader } = require('./loader');
const { installLibrariesForVersion } = require('./minecraft');

function report(progress, percent, message) {
  if (progress) progress(percent, message || '');
}

async function dedupeFabricMods(modsDir) {
  if (!await exists(modsDir)) return 0;
  const files = (await fsp.readdir(modsDir)).filter((f) => f.toLowerCase().endsWith('.jar'));
  const byId = new Map();
  let moved = 0;
  const disabledDir = path.join(path.dirname(modsDir), 'mods-disabled');
  for (const file of files) {
    try {
      const zip = new AdmZip(path.join(modsDir, file));
      const raw = zip.readAsText('fabric.mod.json');
      const meta = JSON.parse(raw.replace(/^\uFEFF/, ''));
      const id = meta.id;
      if (!id) continue;
      const version = String(meta.version || '0');
      const old = byId.get(id);
      if (!old) { byId.set(id, { file, version }); continue; }
      const keepNew = version.localeCompare(old.version, undefined, { numeric: true }) >= 0;
      const loser = keepNew ? old : { file, version };
      const keeper = keepNew ? { file, version } : old;
      await ensureDir(disabledDir);
      await fsp.rename(path.join(modsDir, loser.file), path.join(disabledDir, loser.file));
      byId.set(id, keeper);
      moved++;
    } catch { /* not a Fabric mod */ }
  }
  return moved;
}

async function ensureBaseVersion(store, mcVersion, progress) {
  const config = store.getConfig();
  const jsonPath = path.join(config.gameDir, 'versions', mcVersion, mcVersion + '.json');
  if (await exists(jsonPath)) return;
  report(progress, 3, '安装基础版本 ' + mcVersion);
  const manifest = await fetchManifest(config.downloadSource);
  const entry = manifest.versions.find((v) => v.id === mcVersion);
  if (!entry) throw new Error('版本清单中找不到 Minecraft ' + mcVersion);
  await installVersion(mcVersion, entry.url, config.gameDir, config.downloadSource, (p, total, msg) => {
    report(progress, 3 + (p / Math.max(1, total)) * 17, msg || ('安装 ' + mcVersion));
  });
}

async function installLoaderDependency(store, index, mcVersion, progress) {
  const deps = index.dependencies || {};
  if (deps['fabric-loader']) {
    report(progress, 22, '安装 Fabric ' + deps['fabric-loader']);
    return installLoader(store, 'fabric', mcVersion, store.getConfig().gameDir,
      (p, msg) => report(progress, 22 + p * 0.12, msg), { loaderVersion: deps['fabric-loader'] });
  }
  if (deps['quilt-loader']) {
    report(progress, 22, '安装 Quilt ' + deps['quilt-loader']);
    return installLoader(store, 'quilt', mcVersion, store.getConfig().gameDir,
      (p, msg) => report(progress, 22 + p * 0.12, msg), { loaderVersion: deps['quilt-loader'] });
  }
  if (deps.neoforge) {
    report(progress, 22, '安装 NeoForge ' + deps.neoforge);
    return installLoader(store, 'neoforge', mcVersion, store.getConfig().gameDir,
      (p, msg) => report(progress, 22 + p * 0.12, msg), { loaderVersion: deps.neoforge });
  }
  if (deps.forge) {
    report(progress, 22, '安装 Forge ' + deps.forge);
    return installLoader(store, 'forge', mcVersion, store.getConfig().gameDir,
      (p, msg) => report(progress, 22 + p * 0.12, msg), { loaderVersion: deps.forge });
  }
  return { versionId: mcVersion, loader: '原版', message: '原版' };
}

async function installMrpack(store, unpacked, index, progress) {
  const config = store.getConfig();
  if (!config.isolation) { await store.patchConfig({ isolation: true }); config.isolation = true; }
  const mcVersion = index.dependencies && index.dependencies.minecraft;
  if (!mcVersion) throw new Error('整合包没有声明 Minecraft 版本');
  await ensureBaseVersion(store, mcVersion, progress);
  const loader = await installLoaderDependency(store, index, mcVersion, progress);
  const targetVersion = loader.versionId || mcVersion;
  const instance = instanceDir(config, targetVersion);
  await ensureDir(instance);
  const files = Array.isArray(index.files) ? index.files : [];
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || !file.path) continue;
    if (file.env && file.env.client === 'unsupported') continue;
    let rel;
    try { rel = safeJoin(instance, file.path); } catch { failed++; continue; }
    report(progress, 36 + (files.length ? i / files.length * 44 : 0),
      '下载整合包文件 ' + (i + 1) + '/' + files.length);
    if (await exists(rel) && file.hashes && file.hashes.sha1) {
      try {
        if (await sha1File(rel) === file.hashes.sha1) continue;
      } catch { /* redownload */ }
    }
    if (!Array.isArray(file.downloads) || !file.downloads.length) {
      failed++;
      continue;
    }
    await ensureDir(path.dirname(rel));
    try {
      await downloadFile(file.downloads[0], rel, {
        expectedSha1: file.hashes ? file.hashes.sha1 : '',
        timeout: 300000
      });
    } catch {
      failed++;
    }
  }
  for (const folder of ['overrides', 'client-overrides']) {
    const src = path.join(unpacked, folder);
    if (await exists(src)) {
      report(progress, 84, '写入 ' + folder);
      await copyTree(src, instance);
    }
  }
  report(progress, 100, '整合包安装完成');
  return {
    name: index.name || '整合包',
    versionId: targetVersion,
    mcVersion,
    message: (index.name || '整合包') + ' 安装完成' + (failed ? '，' + failed + ' 个文件失败' : '')
  };
}

function detectGenericRoot(unpacked) {
  const mcDir = path.join(unpacked, '.minecraft');
  if (fs.existsSync(mcDir)) return mcDir;
  const markers = ['versions', 'mods', 'config', 'resourcepacks', 'saves', 'options.txt', 'shaderpacks'];
  for (const m of markers) {
    if (fs.existsSync(path.join(unpacked, m))) return unpacked;
  }
  const names = fs.readdirSync(unpacked).filter((n) => !n.startsWith('.'));
  if (names.length === 1) {
    const only = path.join(unpacked, names[0]);
    if (fs.statSync(only).isDirectory()) {
      const innerMc = path.join(only, '.minecraft');
      if (fs.existsSync(innerMc)) return innerMc;
      for (const m of markers) {
        if (fs.existsSync(path.join(only, m))) return only;
      }
    }
  }
  return '';
}

async function importMmcPack(store, unpacked, mmc, progress) {
  const config = store.getConfig();
  if (!config.isolation) { await store.patchConfig({ isolation: true }); config.isolation = true; }
  const components = Array.isArray(mmc.components) ? mmc.components : [];
  const minecraft = components.find((c) => c.uid === 'net.minecraft');
  if (!minecraft || !minecraft.version) return null;
  const mcVersion = minecraft.version;
  await ensureBaseVersion(store, mcVersion, progress);
  let loader = { versionId: mcVersion, loader: '原版' };
  const fabric = components.find((c) => c.uid === 'net.fabricmc.fabric-loader');
  const forge = components.find((c) => c.uid === 'net.minecraftforge');
  const neo = components.find((c) => c.uid === 'net.neoforged');
  if (fabric && fabric.version) {
    loader = await installLoader(store, 'fabric', mcVersion, config.gameDir,
      (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: fabric.version });
  } else if (forge && forge.version) {
    loader = await installLoader(store, 'forge', mcVersion, config.gameDir,
      (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: forge.version });
  } else if (neo && neo.version) {
    loader = await installLoader(store, 'neoforge', mcVersion, config.gameDir,
      (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: neo.version });
  }
  const instance = instanceDir(config, loader.versionId || mcVersion);
  await ensureDir(instance);
  const minecraftDir = path.join(unpacked, '.minecraft');
  if (await exists(minecraftDir)) {
    await copyTree(minecraftDir, instance, {
      filter: (full, name) => name !== 'PCL' && name !== 'logs' && name !== 'crash-reports'
    });
  }
  const deduped = await dedupeFabricMods(path.join(instance, 'mods'));
  const cfg = await fsp.readFile(path.join(unpacked, 'instance.cfg'), 'utf8').catch(() => '');
  const nameMatch = cfg.match(/^name=(.+)$/m);
  report(progress, 100, 'HMCL / MultiMC 整合包导入完成');
  return {
    name: nameMatch ? nameMatch[1].trim() : 'HMCL 整合包',
    versionId: loader.versionId || mcVersion,
    mcVersion,
    message: '已导入 HMCL / MultiMC 整合包：Minecraft ' + mcVersion +
      (loader.loader && loader.loader !== '原版' ? ' + ' + loader.loader : '') +
      '，模组和配置已复制到实例目录' +
      (deduped ? '；发现 ' + deduped + ' 个重复 Fabric 模组，旧版本已移到 mods-disabled' : '')
  };
}

async function importGeneric(store, unpacked, progress) {
  const config = store.getConfig();
  if (!config.isolation) { await store.patchConfig({ isolation: true }); config.isolation = true; }
  const mmc = await readJson(path.join(unpacked, 'mmc-pack.json'), null);
  if (mmc && Array.isArray(mmc.components)) {
    const imported = await importMmcPack(store, unpacked, mmc, progress);
    if (imported) return imported;
  }
  const manifestPath = path.join(unpacked, 'manifest.json');
  const manifest = await readJson(manifestPath, null);
  if (manifest && manifest.minecraft && manifest.minecraft.version) {
    const mcVersion = manifest.minecraft.version;
    await ensureBaseVersion(store, mcVersion, progress);
    let loader = { versionId: mcVersion, loader: '原版' };
    const loaders = Array.isArray(manifest.modLoaders) ? manifest.modLoaders : [];
    if (loaders.length) {
      const id = loaders[0].id || '';
      if (id.startsWith('fabric-')) {
        loader = await installLoader(store, 'fabric', mcVersion, config.gameDir,
          (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: id.replace('fabric-', '') });
      } else if (id.startsWith('forge-')) {
        loader = await installLoader(store, 'forge', mcVersion, config.gameDir,
          (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: id.replace('forge-', '') });
      } else if (id.startsWith('neoforge-')) {
        loader = await installLoader(store, 'neoforge', mcVersion, config.gameDir,
          (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: id.replace('neoforge-', '') });
      } else if (id.startsWith('quilt-')) {
        loader = await installLoader(store, 'quilt', mcVersion, config.gameDir,
          (p, msg) => report(progress, 22 + p * 0.1, msg), { loaderVersion: id.replace('quilt-', '') });
      }
    }
    const instance = instanceDir(config, loader.versionId || mcVersion);
    await ensureDir(instance);
    const overrides = path.join(unpacked, 'overrides');
    if (await exists(overrides)) await copyTree(overrides, instance);
    report(progress, 100, 'CurseForge 整合包配置已导入');
    return {
      name: manifest.name || 'CurseForge 整合包',
      versionId: loader.versionId || mcVersion,
      mcVersion,
      message: '基础版本与配置已导入；CurseForge 清单中的模组文件需要 CurseForge API 才能自动下载，' +
        '请把 overrides 内的模组补齐，或改用 Modrinth 整合包'
    };
  }

  const root = detectGenericRoot(unpacked);
  if (!root) {
    throw new Error('无法识别整合包结构：需要 .minecraft、versions、mods 或 manifest.json');
  }
  report(progress, 60, '复制整合包文件…');
  const target = config.gameDir;
  await copyTree(root, target, {
    filter: (full, name) => name !== 'PCL' && name !== 'logs' && name !== 'crash-reports'
  });
  const installed = await scanInstalled(config.gameDir);
  report(progress, 100, '整合包文件已导入');
  return {
    name: path.basename(root) === '.minecraft' ? '整合包' : path.basename(root),
    versionId: installed[0] ? installed[0].id : '',
    mcVersion: '',
    message: '整合包已解压到游戏目录' + (installed.length ? '，识别到 ' + installed.length + ' 个版本' : '')
  };
}

async function importArchive(filePath, store, progress) {
  const work = path.join(store.cacheDir, 'modpack-' + Date.now());
  const unpacked = path.join(work, 'unpacked');
  await ensureDir(unpacked);
  try {
    report(progress, 1, '解压整合包…');
    await extractZipSafe(filePath, unpacked);
    const indexPath = path.join(unpacked, 'modrinth.index.json');
    if (await exists(indexPath)) {
      const index = await readJson(indexPath, null);
      if (!index) throw new Error('modrinth.index.json 无法解析');
      return await installMrpack(store, unpacked, index, progress);
    }
    return await importGeneric(store, unpacked, progress);
  } finally {
    await removeTree(work);
  }
}

async function importFromUrl(url, filename, store, progress) {
  const target = path.join(store.cacheDir, safeName(filename, 'pack.mrpack'));
  report(progress, 0, '下载整合包…');
  await downloadFile(url, target, {
    timeout: 600000,
    onProgress: (received, total) => {
      if (total) report(progress, Math.min(5, received / total * 5), '下载整合包 ' + Math.round(received / 1048576) + ' MB');
    }
  });
  try {
    return await importArchive(target, store, progress);
  } finally {
    await fsp.unlink(target).catch(() => {});
  }
}

module.exports = {
  importArchive,
  importFromUrl,
  importGeneric,
  dedupeFabricMods,
  installMrpack,
  ensureBaseVersion
};
