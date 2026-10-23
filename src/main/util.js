'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const AdmZip = require('adm-zip');

const USER_AGENT = 'EMCL/1.26.25.08 (Windows; Minecraft Java Edition launcher)';

function ensureDir(dir) {
  return fsp.mkdir(dir, { recursive: true });
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  const tmp = file + '.tmp-' + process.pid;
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

async function readText(file, fallback = '') {
  try {
    return await fsp.readFile(file, 'utf8');
  } catch {
    return fallback;
  }
}

function safeJoin(root, relative) {
  const cleaned = String(relative || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned) throw new Error('空路径');
  if (/^[a-zA-Z]:/.test(cleaned)) throw new Error('拒绝绝对路径：' + relative);
  const base = path.resolve(root);
  const dest = path.resolve(base, cleaned);
  if (dest !== base && !dest.startsWith(base + path.sep)) {
    throw new Error('拒绝越界路径：' + relative);
  }
  return dest;
}

function isInside(root, target) {
  const base = path.resolve(root).toLowerCase();
  const t = path.resolve(target).toLowerCase();
  return t === base || t.startsWith(base + path.sep);
}

function safeName(name, fallback = 'download.bin') {
  let n = String(name || '').replace(/\\/g, '/');
  n = n.substring(n.lastIndexOf('/') + 1);
  n = n.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.+$/, '');
  if (!n) n = fallback;
  return n.slice(0, 180);
}

function sha1Buffer(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

async function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const input = fs.createReadStream(file);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

async function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest();
}

function formatBytes(n) {
  n = Number(n) || 0;
  if (n >= 1024 * 1024 * 1024) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function parseArgsLine(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let m;
  while ((m = re.exec(String(line || ''))) !== null) {
    out.push(m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]));
  }
  return out;
}

function substitute(template, vars) {
  return String(template).replace(/\$\{([^}]+)\}/g, (all, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : all;
  });
}

async function downloadFile(url, dest, options = {}) {
  const {
    onProgress = () => {},
    expectedSha1 = '',
    timeout = 120000,
    headers = {}
  } = options;
  await ensureDir(path.dirname(dest));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: Object.assign({ 'User-Agent': USER_AGENT, 'Accept': '*/*' }, headers),
      redirect: 'follow',
      signal: controller.signal
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      throw new Error('HTTP ' + res.status + ' ' + res.statusText + (detail ? '：' + detail : ''));
    }
    const total = Number(res.headers.get('content-length') || 0);
    let received = 0;
    let lastTick = 0;
    const tmp = dest + '.part';
    const out = fs.createWriteStream(tmp);
    const body = Readable.fromWeb(res.body);
    body.on('data', (chunk) => {
      received += chunk.length;
      const now = Date.now();
      if (now - lastTick > 120) {
        lastTick = now;
        onProgress(received, total);
      }
    });
    await new Promise((resolve, reject) => {
      body.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      body.pipe(out);
    });
    await fsp.rename(tmp, dest);
    onProgress(received, total || received);
    if (expectedSha1) {
      const actual = await sha1File(dest);
      if (actual.toLowerCase() !== expectedSha1.toLowerCase()) {
        await fsp.unlink(dest).catch(() => {});
        throw new Error('SHA-1 校验失败');
      }
    }
    return received;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 30000);
  try {
    const res = await fetch(url, {
      headers: Object.assign({
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }, options.headers || {}),
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error('HTTP ' + res.status + '：' + text.slice(0, 180));
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('服务器返回的不是 JSON');
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 30000);
  try {
    const res = await fetch(url, {
      headers: Object.assign({ 'User-Agent': USER_AGENT }, options.headers || {}),
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + text.slice(0, 180));
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function extractZipSafe(zipFile, dest, options = {}) {
  const zip = new AdmZip(zipFile);
  const entries = zip.getEntries();
  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (options.skipMeta && /^META-INF\//i.test(entry.entryName)) continue;
    let target;
    try {
      target = safeJoin(dest, entry.entryName);
    } catch {
      continue;
    }
    await ensureDir(path.dirname(target));
    await fsp.writeFile(target, entry.getData());
    count++;
  }
  return count;
}

async function copyTree(src, dest, options = {}) {
  const { onProgress = () => {}, filter = null } = options;
  let copied = 0;
  const walk = async (from, to) => {
    const st = await fsp.lstat(from);
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      await ensureDir(to);
      const names = await fsp.readdir(from);
      for (const name of names) {
        if (filter && !filter(path.join(from, name), name)) continue;
        await walk(path.join(from, name), path.join(to, name));
      }
    } else if (st.isFile()) {
      await ensureDir(path.dirname(to));
      await fsp.copyFile(from, to);
      copied++;
      onProgress(copied);
    }
  };
  await walk(src, dest);
  return copied;
}

async function removeTree(target) {
  await fsp.rm(target, { recursive: true, force: true }).catch(() => {});
}

function versionAtLeast(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

module.exports = {
  USER_AGENT,
  ensureDir,
  exists,
  readJson,
  writeJson,
  readText,
  safeJoin,
  isInside,
  safeName,
  sha1Buffer,
  sha1File,
  md5,
  formatBytes,
  formatDate,
  parseArgsLine,
  substitute,
  downloadFile,
  fetchJson,
  fetchText,
  extractZipSafe,
  copyTree,
  removeTree,
  versionAtLeast
};
