'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { app, shell } = require('electron');
const AdmZip = require('adm-zip');
const net = require('net');
const { ensureDir, downloadFile } = require('./util');

const WIN_URL = 'https://github.com/MCSManager/MCSManager/releases/latest/download/mcsmanager_windows_release.zip';
const PROXY = 'https://gh-proxy.com/';

function wslAvailable() {
  return new Promise((resolve) => {
    const child = spawn('wsl.exe', ['-l', '-q'], { windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.on('error', () => resolve({ wsl: false, distros: [] }));
    child.on('exit', (code) => {
      const distros = out.split(/\r?\n/).map((s) => s.replace(/\0/g, '').trim()).filter(Boolean);
      resolve({ wsl: code === 0 && distros.length > 0, distros });
    });
  });
}

async function installWindows(progress = () => {}) {
  const root = path.join(app.getPath('userData'), 'mcsm');
  const dir = path.join(root, 'windows');
  const startBat = path.join(dir, 'start.bat');
  if (fs.existsSync(startBat)) return { ok: true, path: dir, already: true };
  await ensureDir(dir);
  const zip = path.join(root, 'mcsmanager_windows_release.zip');
  progress(5, '下载 MCSManager Windows 包');
  try {
    await downloadFile(WIN_URL, zip, { timeout: 600000, retries: 3 });
  } catch (e) {
    progress(8, 'GitHub 下载失败，尝试镜像');
    await downloadFile(PROXY + WIN_URL, zip, { timeout: 600000, retries: 3 });
  }
  progress(75, '解压 MCSManager');
  new AdmZip(zip).extractAllTo(dir, true);
  await fsp.unlink(zip).catch(() => {});
  const found = fs.existsSync(startBat) ? startBat : '';
  progress(100, 'MCSManager 已安装');
  return { ok: true, path: dir, start: found };
}

function runWsl(distro, cmd) {
  return new Promise((resolve, reject) => {
    const child = spawn('wsl.exe', ['-d', distro, '-u', 'root', '--', 'bash', '-lc', cmd], {
      windowsHide: true
    });
    let out = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.stderr.on('data', (d) => { out += String(d); });
    child.on('error', (e) => reject(new Error('WSL 启动失败：' + e.message)));
    child.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error('WSL 安装失败，退出码 ' + code + '\n' + out.slice(-3000)));
    });
  });
}

async function installWsl(distro, progress = () => {}) {
  if (!distro) throw new Error('没有选择 WSL 发行版');
  progress(10, '连接 WSL：' + distro);
  const out = await runWsl(distro,
    'wget -qO- https://script.mcsmanager.com/setup_cn.sh | bash');
  progress(100, 'MCSManager Linux 面板已安装');
  return { ok: true, mode: 'wsl', distro, output: out.slice(-4000) };
}

function portOpen(port = 23333) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    const done = (v) => { try { socket.destroy(); } catch { /* ignore */ } resolve(v); };
    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function wslStatus(distro) {
  return new Promise((resolve) => {
    const child = spawn('wsl.exe', ['-d', distro, '-u', 'root', '--', 'bash', '-lc',
      'systemctl is-active mcsm-web; systemctl is-active mcsm-daemon'], { windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.on('error', () => resolve({ ok: false, error: 'WSL 不可用' }));
    child.on('exit', () => {
      const lines = out.trim().split(/\r?\n/);
      resolve({ ok: true, web: lines[0] || 'unknown', daemon: lines[1] || 'unknown',
        systemd: lines[0] === 'active', running: lines[0] === 'active' });
    });
  });
}

async function systemdAction(distro, action) {
  const out = await runWsl(distro, 'systemctl ' + action + ' mcsm-web mcsm-daemon');
  return out.slice(-2000);
}

async function status(distro) {
  const winPath = path.join(app.getPath('userData'), 'mcsm', 'windows');
  const webOpen = await portOpen(23333);
  if (distro) {
    const wsl = await wslStatus(distro);
    return { ok: true, mode: 'wsl', distro, ...wsl, running: webOpen || wsl.running,
      port: webOpen, path: '' };
  }
  return { ok: true, mode: 'windows', running: webOpen, port: webOpen,
    path: winPath, installed: fs.existsSync(path.join(winPath, 'start.bat')) };
}

async function start(distro) {
  if (distro) {
    const before = await wslStatus(distro);
    if (before.systemd) return { ok: true, already: true };
    await systemdAction(distro, 'start');
    return { ok: true, mode: 'wsl', distro };
  }
  const dir = path.join(app.getPath('userData'), 'mcsm', 'windows');
  if (!fs.existsSync(path.join(dir, 'start.bat'))) throw new Error('MCSManager 尚未安装');
  const child = spawn('cmd.exe', ['/c', 'start', '""', 'start.bat'], {
    cwd: dir, detached: true, stdio: 'ignore', windowsHide: true
  });
  child.unref();
  return { ok: true, mode: 'windows', path: dir };
}

async function stop(distro) {
  if (distro) {
    await systemdAction(distro, 'stop');
    return { ok: true, mode: 'wsl', distro };
  }
  const dir = path.join(app.getPath('userData'), 'mcsm', 'windows');
  const script = 'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | Where-Object { $_.CommandLine -like ("*" + $env:MCSM_DIR + "*") } | Select-Object -ExpandProperty ProcessId';
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, env: Object.assign({}, process.env, { MCSM_DIR: dir })
    });
    let out = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.on('error', reject);
    child.on('exit', async () => {
      const pids = out.trim().split(/\r?\n/).filter(Boolean);
      // 如果 node 进程命令行不含安装目录，退回到 23333 端口占用进程。
      if (!pids.length) {
        const portPid = await new Promise((resolve) => {
          const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            'Get-NetTCPConnection -LocalPort 23333 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess'], { windowsHide: true });
          let text = '';
          p.stdout.on('data', (d) => { text += String(d); });
          p.on('error', () => resolve(''));
          p.on('exit', () => resolve(text.trim()));
        });
        if (portPid) pids.push(portPid);
      }
      for (const pid of pids) {
        await new Promise((r) => {
          const k = spawn('taskkill.exe', ['/PID', pid, '/T', '/F'], { windowsHide: true });
          k.on('exit', r); k.on('error', r);
        });
      }
      resolve();
    });
  });
  return { ok: true, stopped: true };
}

async function openPanel() {
  await shell.openExternal('http://localhost:23333');
  return { ok: true };
}

async function detect() {
  const result = await wslAvailable();
  return { ok: true, wsl: result.wsl, distros: result.distros, platform: process.platform };
}

module.exports = { detect, installWindows, installWsl, status, start, stop, openPanel };
