'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { ensureDir, downloadFile, fetchJson } = require('./util');
const { resolveJava } = require('./java');
const { scanInstalled } = require('./minecraft');

const BMCL = 'https://bmclapi2.bangbang93.com/optifine/';
const BRIDGE_URL = 'https://github.com/zabi94/OptifineInstallerBridge/releases/download/v0.1/OptifineBridgeInstaller.jar';
const BRIDGE_PROXY = 'https://gh-proxy.com/' + BRIDGE_URL;

async function versions(mcVersion) {
  const list = await fetchJson(BMCL + encodeURIComponent(mcVersion), { timeout: 30000 });
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && !String(x.filename || '').startsWith('preview_'))
    .map((x) => ({
      filename: x.filename,
      type: x.type,
      patch: x.patch,
      forge: x.forge || '',
      label: 'OptiFine ' + x.mcversion + ' ' + x.type + ' ' + x.patch
    }));
}

function runJava(java, args, cwd, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(java, args, { cwd, windowsHide: true });
    let out = '';
    const handle = (d) => {
      const text = String(d);
      out += text;
      if (onOutput) onOutput(text);
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    child.on('error', (e) => reject(new Error('启动 Java 失败：' + e.message)));
    child.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error('OptiFine 安装器退出码 ' + code + '\n' + out.slice(-4000)));
    });
  });
}

async function install(store, mcVersion, patch, progress = () => {}) {
  const config = store.getConfig();
  const gameDir = config.gameDir;
  const before = await scanInstalled(gameDir);
  const beforeIds = new Set(before.map((v) => v.id));
  const work = path.join(store.cacheDir, 'optifine-' + mcVersion + '-' + patch);
  const ofb = path.join(work, 'ofb');
  await ensureDir(ofb);

  const bridge = path.join(store.cacheDir, 'OptifineBridgeInstaller.jar');
  if (!fs.existsSync(bridge)) {
    progress(5, '下载 OptiFine 安装桥');
    try {
      await downloadFile(BRIDGE_URL, bridge, { timeout: 300000, retries: 3 });
    } catch {
      await downloadFile(BRIDGE_PROXY, bridge, { timeout: 300000, retries: 3 });
    }
  }

  progress(25, '下载 OptiFine ' + patch);
  const jar = path.join(ofb, 'OptiFine_' + mcVersion + '_' + patch + '.jar');
  await downloadFile(BMCL + encodeURIComponent(mcVersion) + '/HD_U/' + encodeURIComponent(patch), jar, {
    timeout: 600000,
    retries: 3
  });

  const java = await resolveJava(store, mcVersion);
  if (!java.path) throw new Error('没有可用的 Java，无法运行 OptiFine 安装器');
  progress(55, '运行 OptiFine 安装器');
  await runJava(java.path, ['-jar', bridge, gameDir, '-log=console'], work,
    (text) => {
      const line = text.trim().split(/\r?\n/).filter(Boolean).pop();
      if (line) progress(60, line.slice(0, 120));
    });

  progress(95, '检查 OptiFine 版本');
  const after = await scanInstalled(gameDir);
  const created = after.filter((v) => !beforeIds.has(v.id) &&
    (String(v.id).toLowerCase().includes('optifine') || String(v.loader || '').toLowerCase().includes('optifine')));
  progress(100, 'OptiFine 安装完成');
  return {
    ok: true,
    versionId: created[0] ? created[0].id : '',
    created: created.map((v) => v.id),
    installed: after
  };
}

module.exports = { versions, install };
