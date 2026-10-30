'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { ensureDir, downloadFile, fetchJson } = require('./util');
const { fetchManifest, MANIFEST_MOJANG } = require('./minecraft');

const LEGACY = {
  '2.0-blue': { name: 'Blue', file: 'Blue' },
  '2.0-red': { name: 'Red', file: 'Red' },
  '2.0-purple': { name: 'Purple', file: 'Purple' }
};
const RAW = 'https://raw.githubusercontent.com/MCLegoMan/MineOnline-JSON/master/versions/clients/';
const PROXY = 'https://gh-proxy.com/';

function jarUrl(file) {
  return PROXY + RAW + 'Release%202.0%20%5B' + file + '%5D/client.jar';
}

async function installLegacy(store, versionId, progress = () => {}) {
  const info = LEGACY[versionId];
  if (!info) throw new Error('未知的 2.0 版本：' + versionId);
  const config = store.getConfig();
  const dir = path.join(config.gameDir, 'versions', versionId);
  await ensureDir(dir);
  const jar = path.join(dir, versionId + '.jar');

  if (!fs.existsSync(jar)) {
    progress(5, '下载 Minecraft 2.0 ' + info.name + ' jar');
    try {
      await downloadFile(jarUrl(info.file), jar, { timeout: 300000 });
    } catch (e) {
      progress(8, '代理下载失败，尝试 GitHub 原始地址');
      await downloadFile(RAW + 'Release%202.0%20%5B' + info.file + '%5D/client.jar', jar, { timeout: 300000 });
    }
  }

  progress(65, '生成 2.0 版本 JSON');
  const manifest = await fetchManifest('mojang');
  const base = manifest.versions.find((v) => v.id === '1.7.10');
  if (!base || !base.url) throw new Error('版本清单里没有 1.7.10 基础 JSON');
  const json = await fetchJson(base.url);
  json.id = versionId;
  json.mainClass = 'net.minecraft.client.Minecraft';
  json.type = 'release';
  json.releaseTime = '2013-04-01T00:00:00+00:00';
  json.time = json.releaseTime;
  delete json.inheritsFrom;
  await fsp.writeFile(path.join(dir, versionId + '.json'), JSON.stringify(json, null, 2), 'utf8');

  const nativesJar = path.join(config.gameDir, 'libraries', 'org', 'lwjgl', 'lwjgl',
    'lwjgl-platform', '2.9.1', 'lwjgl-platform-2.9.1-natives-windows.jar');
  if (fs.existsSync(nativesJar)) {
    progress(85, '解压 LWJGL 原生库');
    new AdmZip(nativesJar).extractAllTo(path.join(dir, 'natives'), true);
  }
  progress(100, 'Minecraft 2.0 ' + info.name + ' 安装完成');
  return { ok: true, versionId, jar };
}

module.exports = { installLegacy, LEGACY };
