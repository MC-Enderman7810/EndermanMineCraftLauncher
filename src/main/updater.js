'use strict';

const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { fetchJson, downloadFile } = require('./util');
const { isDev } = require('./channel');

const REPO = 'https://github.com/MC-Enderman7810/EndermanMineCraftLauncher';
const UPDATE_URL = 'https://www.emcl.life/update.json';
const ANNOUNCEMENT_URL = 'https://www.emcl.life/announcements.json';
const CONTENT_API = 'https://api.github.com/repos/MC-Enderman7810/EndermanMineCraftLauncher/contents/';
const CACHE_MS = 15 * 60 * 1000;

let updateCache = { at: 0, value: null };
let announcementCache = { at: 0, value: null };

function currentVersion() {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}

function versionParts(value) {
  return String(value || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
}

/** 支持 1.26.25.14 这种四段版本号；返回 >0 表示 a 比 b 新 */
function compareVersions(a, b) {
  const pa = versionParts(a);
  const pb = versionParts(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function officialUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase();
    if ((host === 'www.emcl.life' || host === 'emcl.life') && url.protocol === 'https:') {
      return url.toString();
    }
    if (host === 'github.com' && url.pathname.toLowerCase().startsWith('/mc-enderman7810/')) {
      return url.toString();
    }
    if (host === 'raw.githubusercontent.com' &&
      url.pathname.toLowerCase().startsWith('/mc-enderman7810/endermanminecraftlauncher/')) {
      return url.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function normalizeNotes(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20);
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map((x) => x.replace(/^[-*]\s*/, '').trim()).filter(Boolean).slice(0, 20);
  }
  return [];
}

/**
 * 优先读取 emcl.life 上的更新清单，避免 GitHub raw / API 的缓存和网络差异。
 * 域名失败时再回退 GitHub Contents API。
 */
async function readRepoJson(fileName, rawUrl) {
  try {
    return await fetchJson(rawUrl + '?t=' + Date.now(), {
      timeout: 15000,
      headers: { 'Cache-Control': 'no-cache' }
    });
  } catch { /* fall through to GitHub */ }
  try {
    const data = await fetchJson(CONTENT_API + fileName + '?ref=main', {
      timeout: 15000,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Cache-Control': 'no-cache'
      }
    });
    if (data && typeof data.content === 'string') {
      const text = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
      return JSON.parse(text);
    }
  } catch { /* ignore */ }
  throw new Error('无法读取更新清单');
}

async function checkUpdates(force = false) {
  const now = Date.now();
  if (isDev) {
    return {
      ok: true,
      current: currentVersion(),
      latest: currentVersion(),
      hasUpdate: false,
      releaseDate: '',
      notes: [],
      url: REPO,
      downloadUrl: REPO,
      checkedAt: now,
      error: ''
    };
  }
  if (process.windowsStore === true) {
    return {
      ok: true,
      current: currentVersion(),
      latest: currentVersion(),
      hasUpdate: false,
      releaseDate: '',
      notes: ['Microsoft Store 版本请通过 Store 更新'],
      url: REPO,
      downloadUrl: REPO,
      checkedAt: now,
      error: '',
      store: true
    };
  }
  if (!force && updateCache.value && now - updateCache.at < CACHE_MS) {
    return updateCache.value;
  }
  try {
    const data = await readRepoJson('update.json', UPDATE_URL);
    const latest = String(data.version || '').trim();
    if (!latest) throw new Error('update.json 缺少 version');
    const result = {
      ok: true,
      current: currentVersion(),
      latest,
      hasUpdate: compareVersions(latest, currentVersion()) > 0,
      releaseDate: String(data.releaseDate || ''),
      notes: normalizeNotes(data.notes),
      url: officialUrl(data.url) || REPO,
      downloadUrl: officialUrl(data.downloadUrl) || officialUrl(data.url) || REPO,
      sha256: String(data.sha256 || '').toLowerCase(),
      asarUrl: officialUrl(data.asarUrl) || '',
      asarSha256: String(data.asarSha256 || '').toLowerCase(),
      store: !!process.windowsStore,
      platform: process.platform,
      checkedAt: now,
      error: ''
    };
    updateCache = { at: now, value: result };
    return result;
  } catch (error) {
    const fallback = updateCache.value
      ? Object.assign({}, updateCache.value, { error: error.message, checkedAt: now })
      : {
        ok: false,
        current: currentVersion(),
        latest: '',
        hasUpdate: false,
        releaseDate: '',
        notes: [],
        url: REPO,
        downloadUrl: REPO,
        checkedAt: now,
        error: error.message || '检查更新失败'
      };
    return fallback;
  }
}

function normalizeAnnouncements(data) {
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.announcements) ? data.announcements : []);
  const now = Date.now();
  return list
    .filter((item) => item && item.id && item.title && item.enabled !== false)
    .filter((item) => {
      if (!item.expiresAt) return true;
      const t = Date.parse(item.expiresAt);
      return !Number.isFinite(t) || t > now;
    })
    .map((item) => {
      const title = String(item.title);
      const tag = String(item.tag || '公告');
      const looksLikeUpdate = item.kind === 'update' || tag === '更新' ||
        /^EMCL\s+\d/i.test(title) || /-emcl-/i.test(String(item.id));
      return {
        id: String(item.id),
        title,
        body: String(item.body || ''),
        date: String(item.date || ''),
        tag,
        kind: item.kind === 'announcement' ? 'announcement' : (looksLikeUpdate ? 'update' : 'announcement'),
        pinned: item.pinned === true,
        url: officialUrl(item.url) || ''
      };
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    })
    .slice(0, 12);
}

async function getAnnouncements(force = false) {
  const now = Date.now();
  if (isDev) {
    try {
      const file = path.join(app.getAppPath(), 'announcements-dev.json');
      const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
      const items = normalizeAnnouncements(data).filter((item) =>
        item.tag === '开发者版' || String(item.id).includes('dev'));
      return { ok: true, items, checkedAt: now, error: '' };
    } catch (e) {
      return { ok: true, items: [], checkedAt: now, error: '' };
    }
  }
  if (!force && announcementCache.value && now - announcementCache.at < CACHE_MS) {
    return announcementCache.value;
  }
  try {
    const data = await readRepoJson('announcements.json', ANNOUNCEMENT_URL);
    const result = { ok: true, items: normalizeAnnouncements(data), checkedAt: now, error: '' };
    announcementCache = { at: now, value: result };
    return result;
  } catch (error) {
    const fallback = announcementCache.value
      ? Object.assign({}, announcementCache.value, { error: error.message })
      : { ok: false, items: [], checkedAt: now, error: error.message || '读取公告失败' };
    return fallback;
  }
}

async function openUpdate(url) {
  const target = officialUrl(url);
  if (!target) throw new Error('更新地址不是 EMCL 官方 GitHub 地址，已拒绝');
  await shell.openExternal(target);
  return true;
}

function updateFileName(update) {
  let name = '';
  try { name = path.basename(new URL(update.downloadUrl).pathname); } catch { /* ignore */ }
  name = name.replace(/[^\w.\-]+/g, '-');
  if (!/\.exe$/i.test(name)) name = 'EMCL-Update-' + String(update.latest || 'latest').replace(/[^\w.\-]+/g, '-') + '.exe';
  return name;
}

async function downloadUpdate(update, onProgress) {
  if (!update || !update.hasUpdate) throw new Error('当前没有可下载的更新');
  if (update.store || process.windowsStore) throw new Error('Microsoft Store 版本请通过 Store 更新');
  const url = officialUrl(update.downloadUrl);
  if (!url) throw new Error('更新下载地址不是 EMCL 官方地址，已拒绝');
  const dir = path.join(app.getPath('temp'), 'emcl-updates');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, updateFileName(update));
  const part = dest + '.part';
  try { fs.rmSync(part, { force: true }); } catch { /* ignore */ }
  await downloadFile(url, part, {
    onProgress: (received, total) => {
      const percent = total ? Math.max(0, Math.min(100, (Number(received) || 0) / Number(total) * 100)) : 0;
      if (onProgress) onProgress({ percent, received, total });
    }
  });
  if (update.sha256) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(part)).digest('hex');
    if (hash !== String(update.sha256).toLowerCase()) {
      try { fs.rmSync(part, { force: true }); } catch { /* ignore */ }
      throw new Error('更新包校验失败，已删除下载文件');
    }
  }
  try { fs.rmSync(dest, { force: true }); } catch { /* ignore */ }
  fs.renameSync(part, dest);
  return { ok: true, path: dest, version: update.latest, size: fs.statSync(dest).size };
}

async function downloadAsarUpdate(update, onProgress) {
  if (!update || !update.hasUpdate) throw new Error('当前没有可下载的更新');
  if (update.store || process.windowsStore) throw new Error('Microsoft Store 版本请通过 Store 更新');
  if (process.env.PORTABLE_EXECUTABLE_FILE) throw new Error('便携版不能使用增量更新');
  const url = officialUrl(update.asarUrl);
  if (!url) throw new Error('增量更新地址无效');
  const dir = path.join(app.getPath('temp'), 'emcl-updates');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'app-' + String(update.latest || 'new').replace(/[^\w.\-]+/g, '-') + '.asar');
  const part = dest + '.part';
  try { fs.rmSync(part, { force: true }); } catch { /* ignore */ }
  await downloadFile(url, part, {
    onProgress: (received, total) => {
      const percent = total ? Math.max(0, Math.min(100, Number(received) / Number(total) * 100)) : 0;
      if (onProgress) onProgress({ percent, received, total });
    }
  });
  if (update.asarSha256) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(part)).digest('hex');
    if (hash !== String(update.asarSha256).toLowerCase()) {
      try { fs.rmSync(part, { force: true }); } catch { /* ignore */ }
      throw new Error('增量更新校验失败');
    }
  }
  try { fs.rmSync(dest, { force: true }); } catch { /* ignore */ }
  fs.renameSync(part, dest);
  return { ok: true, path: dest, version: update.latest, size: fs.statSync(dest).size, mode: 'asar' };
}

async function installAsarUpdate(download) {
  if (process.windowsStore) throw new Error('Microsoft Store 版本不能自动安装');
  if (process.env.PORTABLE_EXECUTABLE_FILE) throw new Error('便携版不能使用增量更新');
  const file = download && download.path;
  if (!file || !fs.existsSync(file)) throw new Error('增量更新文件不存在');
  const target = path.join(process.resourcesPath, 'app.asar');
  if (!fs.existsSync(target)) throw new Error('找不到应用资源，改用完整安装包');
  try { fs.accessSync(target, fs.constants.W_OK); } catch { throw new Error('当前安装目录不可写，改用完整安装包'); }
  const helper = path.join(app.getPath('temp'), 'emcl-asar-update-' + Date.now() + '.ps1');
  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    'Wait-Process -Id ' + process.pid + ' -Timeout 30',
    'Start-Sleep -Milliseconds 700',
    'Copy-Item -LiteralPath ' + JSON.stringify(file) + ' -Destination ' + JSON.stringify(target) + ' -Force',
    'Start-Process -FilePath ' + JSON.stringify(process.execPath),
    'Remove-Item -LiteralPath ' + JSON.stringify(helper) + ' -Force'
  ].join('\r\n');
  fs.writeFileSync(helper, script, 'utf8');
  spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', helper], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();
  setTimeout(() => app.quit(), 500);
  return { ok: true, mode: 'asar' };
}

async function installUpdate(download) {
  if (process.windowsStore) throw new Error('Microsoft Store 版本不能自动安装，请通过 Store 更新');
  const file = download && download.path;
  if (!file || !fs.existsSync(file)) throw new Error('更新包不存在，请重新下载');
  const portable = process.env.PORTABLE_EXECUTABLE_FILE || '';
  if (portable) {
    const helper = path.join(app.getPath('temp'), 'emcl-update-' + Date.now() + '.ps1');
    const script = [
      '$ErrorActionPreference = "SilentlyContinue"',
      'Wait-Process -Id ' + process.pid + ' -Timeout 30',
      'Start-Sleep -Milliseconds 700',
      'Copy-Item -LiteralPath ' + JSON.stringify(file) + ' -Destination ' + JSON.stringify(portable) + ' -Force',
      'Start-Process -FilePath ' + JSON.stringify(portable),
      'Remove-Item -LiteralPath ' + JSON.stringify(helper) + ' -Force'
    ].join('\r\n');
    fs.writeFileSync(helper, script, 'utf8');
    spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', helper], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
    setTimeout(() => app.quit(), 500);
    return { ok: true, mode: 'portable' };
  }
  spawn(file, ['/S'], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  setTimeout(() => app.quit(), 1200);
  return { ok: true, mode: 'installer' };
}

module.exports = {
  REPO,
  UPDATE_URL,
  ANNOUNCEMENT_URL,
  compareVersions,
  checkUpdates,
  getAnnouncements,
  openUpdate,
  downloadUpdate,
  installUpdate,
  downloadAsarUpdate,
  installAsarUpdate,
  currentVersion
};
