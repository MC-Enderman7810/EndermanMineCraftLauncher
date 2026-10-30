'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const API = 'https://api.modrinth.com/v2';
const UA = 'EMCL/1.26.25.14 (mod dependency check)';

async function sha512(file) {
  const buf = await fsp.readFile(file);
  return crypto.createHash('sha512').update(buf).digest('hex');
}

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  return res.json();
}

async function download(url, target) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, Buffer.from(await res.arrayBuffer()));
}

async function sanitizeModNames(modsDir, say) {
  let renamed = 0;
  const names = await fsp.readdir(modsDir);
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.jar') || !/[^\x00-\x7F]/.test(name)) continue;
    const base = name.slice(0, -4)
      .replace(/^\s*(\[[^\]]*\]\s*)+/, '')
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '') || ('mod-' + Date.now());
    let target = base + '.jar';
    let n = 2;
    while (fs.existsSync(path.join(modsDir, target))) target = base + '-' + n++ + '.jar';
    try {
      await fsp.rename(path.join(modsDir, name), path.join(modsDir, target));
      renamed++;
    } catch { /* ignore */ }
  }
  if (renamed) say('已将 ' + renamed + ' 个非 ASCII 模组文件名改为安全名称');
  return renamed;
}

async function checkAndInstall({ modsDir, gameVersion, loader, log }) {
  const say = (text) => { try { if (log) log(text); } catch { /* ignore */ } };
  if (!modsDir || !fs.existsSync(modsDir)) return { checked: 0, installed: [] };
  await sanitizeModNames(modsDir, say);
  const files = (await fsp.readdir(modsDir)).filter((f) => f.toLowerCase().endsWith('.jar'));
  if (!files.length) return { checked: 0, installed: [] };
  say('检查模组依赖：发现 ' + files.length + ' 个模组文件');

  const entries = [];
  for (const file of files.slice(0, 80)) {
    try {
      const hash = await sha512(path.join(modsDir, file));
      const info = await json(API + '/version_file/' + hash + '?algorithm=sha512');
      if (info) entries.push({ file, info });
    } catch { /* skip unreadable/offline */ }
  }

  const installedProjects = new Set(entries.map((e) => e.info.project_id).filter(Boolean));
  const pending = [];
  for (const entry of entries) {
    for (const dep of entry.info.dependencies || []) {
      if (dep.dependency_type !== 'required' || !dep.project_id) continue;
      if (installedProjects.has(dep.project_id)) continue;
      if (pending.some((p) => p.project_id === dep.project_id)) continue;
      pending.push(dep);
    }
  }
  if (!pending.length) {
    say('模组依赖检查完成：没有缺失的必需依赖');
    return { checked: entries.length, installed: [] };
  }

  const installed = [];
  for (const dep of pending.slice(0, 15)) {
    try {
      const params = [];
      if (gameVersion) params.push('game_versions=' + encodeURIComponent(JSON.stringify([gameVersion])));
      if (loader) params.push('loaders=' + encodeURIComponent(JSON.stringify([loader])));
      const versions = await json(API + '/project/' + encodeURIComponent(dep.project_id) +
        '/version' + (params.length ? '?' + params.join('&') : ''));
      const version = Array.isArray(versions) ? versions[0] : null;
      const file = version && (version.files || []).find((f) => f.primary) ||
        (version && (version.files || [])[0]);
      if (!file || !file.url) continue;
      const target = path.join(modsDir, path.basename(file.filename || ('dependency-' + dep.project_id + '.jar')));
      if (fs.existsSync(target)) continue;
      await download(file.url, target);
      installed.push(file.filename || target);
      installedProjects.add(dep.project_id);
      say('已自动下载依赖：' + (file.filename || dep.project_id));
    } catch (e) {
      say('依赖下载失败（' + dep.project_id + '）：' + (e.message || e));
    }
  }
  say('模组依赖检查完成：新增 ' + installed.length + ' 个依赖');
  return { checked: entries.length, installed };
}

function modKind(file) {
  try {
    const zip = new AdmZip(file);
    const names = zip.getEntries().map((e) => e.entryName);
    if (names.includes('fabric.mod.json')) return 'fabric';
    if (names.includes('META-INF/neoforge.mods.toml')) return 'neoforge';
    if (names.includes('META-INF/mods.toml')) return 'forge';
  } catch { /* ignore */ }
  return '';
}

function modId(file) {
  try {
    const zip = new AdmZip(file);
    const fabric = zip.getEntry('fabric.mod.json');
    if (fabric) {
      const data = JSON.parse(fabric.getData().toString('utf8'));
      return data && data.id ? String(data.id) : '';
    }
    const forge = zip.getEntry('META-INF/mods.toml') || zip.getEntry('META-INF/neoforge.mods.toml');
    if (forge) {
      const text = forge.getData().toString('utf8');
      const m = text.match(/^\s*modId\s*=\s*["']([^"']+)["']/m);
      return m ? m[1] : '';
    }
  } catch { /* ignore */ }
  return '';
}

async function checkLoaderCompatibility(modsDir, loader) {
  const target = String(loader || '').toLowerCase();
  if (!modsDir || !fs.existsSync(modsDir) || !target || target === '原版' || target === 'vanilla') {
    return { ok: true, mismatched: [], conflicts: [], target };
  }
  const files = (await fsp.readdir(modsDir)).filter((f) => f.toLowerCase().endsWith('.jar'));
  const mismatched = [];
  const ids = new Map();
  for (const file of files) {
    const full = path.join(modsDir, file);
    const kind = modKind(full);
    const id = modId(full);
    if (id) {
      if (!ids.has(id)) ids.set(id, []);
      ids.get(id).push(file);
    }
    if (!kind) continue;
    const compatible = target === 'fabric' || target === 'quilt'
      ? kind === 'fabric'
      : target === 'forge' || target === 'neoforge'
        ? kind === 'forge' || kind === 'neoforge'
        : target === 'optifine'
          ? false
          : true;
    if (!compatible) mismatched.push(file);
  }
  const conflicts = [];
  for (const [id, list] of ids) if (list.length > 1) conflicts.push(id + ': ' + list.join(' / '));
  return { ok: true, mismatched, conflicts, target };
}

async function disableMods(modsDir, names) {
  const disabled = [];
  const dir = path.join(path.dirname(modsDir), 'mods-disabled');
  await fsp.mkdir(dir, { recursive: true });
  for (const name of names || []) {
    const safe = path.basename(String(name));
    if (!safe.toLowerCase().endsWith('.jar')) continue;
    const source = path.join(modsDir, safe);
    if (!fs.existsSync(source)) continue;
    let target = path.join(dir, safe);
    let n = 2;
    while (fs.existsSync(target)) target = path.join(dir, safe.replace(/\.jar$/i, '') + '-' + n++ + '.jar');
    await fsp.rename(source, target);
    disabled.push(path.basename(target));
  }
  return disabled;
}

module.exports = { checkAndInstall, checkLoaderCompatibility, disableMods };
