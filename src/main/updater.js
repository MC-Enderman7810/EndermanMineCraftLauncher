'use strict';

const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { fetchJson } = require('./util');
const { isDev } = require('./channel');

const REPO = 'https://github.com/MC-Enderman7810/EndermanMineCraftLauncher';
const UPDATE_URL = 'https://raw.githubusercontent.com/MC-Enderman7810/EndermanMineCraftLauncher/main/update.json';
const ANNOUNCEMENT_URL = 'https://raw.githubusercontent.com/MC-Enderman7810/EndermanMineCraftLauncher/main/announcements.json';
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
 * 优先用 GitHub Contents API 读取，避免 raw.githubusercontent.com 的 CDN 缓存
 * 让刚发布的 update.json / announcements.json 延迟生效；API 失败再回退 raw。
 */
async function readRepoJson(fileName, rawUrl) {
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
  } catch { /* fall through to raw */ }
  return fetchJson(rawUrl + '?t=' + Date.now(), {
    timeout: 15000,
    headers: { 'Cache-Control': 'no-cache' }
  });
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

module.exports = {
  REPO,
  UPDATE_URL,
  ANNOUNCEMENT_URL,
  compareVersions,
  checkUpdates,
  getAnnouncements,
  openUpdate,
  currentVersion
};
