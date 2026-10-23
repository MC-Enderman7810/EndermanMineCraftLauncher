'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { execFile } = require('child_process');
const {
  ensureDir, exists, downloadFile, extractZipSafe, removeTree, readJson, writeJson, fetchText
} = require('./util');

const JAVA_CACHE = new Map();

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 20000, ...options }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function inspectJava(javaPath) {
  if (JAVA_CACHE.has(javaPath)) return JAVA_CACHE.get(javaPath);
  const result = await execFileAsync(javaPath, ['-XshowSettings:properties', '-version']);
  const text = result.stdout + '\n' + result.stderr;
  const versionMatch = text.match(/java\.version\s*=\s*([^\s]+)/) || text.match(/version\s+"([^"]+)"/);
  const archMatch = text.match(/os\.arch\s*=\s*([^\s]+)/);
  if (!versionMatch) {
    const info = { path: javaPath, version: '', major: 0, arch: '', ok: false };
    JAVA_CACHE.set(javaPath, info);
    return info;
  }
  const version = versionMatch[1];
  const major = parseMajor(version);
  const info = {
    path: javaPath,
    version,
    major,
    arch: archMatch ? archMatch[1] : '',
    ok: true
  };
  JAVA_CACHE.set(javaPath, info);
  return info;
}

function parseMajor(version) {
  const v = String(version || '').replace(/^1\./, '');
  const n = parseInt(v.split(/[._-]/)[0], 10);
  return Number.isFinite(n) ? n : 0;
}

function candidateDirs() {
  const out = [];
  const push = (p) => {
    if (p && !out.includes(p)) out.push(p);
  };
  push(process.env.JAVA_HOME);
  push(process.env.JRE_HOME);
  push(process.env.JDK_HOME);
  const bases = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\AdoptOpenJDK',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files (x86)\\Java',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
    path.join(process.env.APPDATA || '', '.minecraft', 'runtime')
  ];
  for (const base of bases) {
    try {
      if (!fs.existsSync(base)) continue;
      for (const name of fs.readdirSync(base)) {
        push(path.join(base, name));
      }
    } catch { /* ignore */ }
  }
  return out;
}

async function findJavaCandidates(extra = []) {
  const candidates = [];
  const add = (p) => {
    if (!p) return;
    const resolved = path.resolve(p);
    if (!candidates.includes(resolved)) candidates.push(resolved);
  };
  for (const p of extra) add(p);
  if (process.env.JAVA_HOME) add(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
  // PATH
  const where = await execFileAsync('where.exe', ['java']);
  if (where.stdout) {
    for (const line of where.stdout.split(/\r?\n/)) {
      if (line.trim().toLowerCase().endsWith('java.exe')) add(line.trim());
    }
  }
  for (const dir of candidateDirs()) {
    add(path.join(dir, 'bin', 'java.exe'));
    // Microsoft Store runtime nests a jre directory
    try {
      for (const sub of fs.readdirSync(dir)) {
        add(path.join(dir, sub, 'bin', 'java.exe'));
        add(path.join(dir, sub, 'jre', 'bin', 'java.exe'));
      }
    } catch { /* ignore */ }
  }
  const valid = [];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const info = await inspectJava(candidate);
      if (info.ok && info.major > 0) valid.push(info);
    } catch { /* ignore */ }
  }
  const seen = new Set();
  return valid.filter((j) => {
    const key = j.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.major - a.major);
}

function javaMajorForMc(mcVersion) {
  const v = String(mcVersion || '');
  const parts = v.split('.').map((x) => parseInt(x, 10) || 0);
  // 2026 起 Mojang 改用 26.x 年份版本号，客户端要求 Java 25
  if (parts[0] !== 1) {
    return parts[0] >= 26 ? 25 : 21;
  }
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

async function ensureJava(store, major, onProgress = () => {}) {
  const runtimeRoot = path.join(store.root, 'runtime');
  const targetDir = path.join(runtimeRoot, 'jre-' + major);
  const targetJava = path.join(targetDir, 'bin', 'java.exe');
  if (await exists(targetJava)) {
    const info = await inspectJava(targetJava);
    if (info.ok) return info;
  }
  const zipPath = path.join(store.cacheDir, 'jre-' + major + '.zip');
  const primary = 'https://api.adoptium.net/v3/binary/latest/' + major +
    '/ga/windows/x64/jre/hotspot/normal/eclipse';
  onProgress({ percent: 0, message: '下载 Java ' + major + ' 运行时…' });
  const progress = (received, total) => {
    onProgress({
      percent: total ? Math.min(95, Math.round(received / total * 90)) : 0,
      message: '下载 Java ' + major + ' 运行时… ' + Math.round(received / 1048576) + ' MB'
    });
  };
  try {
    await downloadFile(primary, zipPath, { onProgress: progress, timeout: 600000 });
  } catch (primaryError) {
    // 国内直连 Adoptium 常被重置，回退到清华镜像的同版本 JRE 目录
    onProgress({ percent: 1, message: 'Adoptium 直连失败，尝试清华镜像…' });
    const mirrorDir = 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium/' + major + '/jre/x64/windows/';
    let html = '';
    try {
      html = await fetchText(mirrorDir, { timeout: 30000 });
    } catch {
      throw new Error('Java 下载失败：' + (primaryError.message || primaryError));
    }
    const matches = [...html.matchAll(/href="([^"]+\.zip)"/g)].map((m) => m[1]);
    const file = matches.find((n) => /jre.*windows.*hotspot/i.test(n)) || matches[0];
    if (!file) throw new Error('镜像中没有找到 Java ' + major + ' 的 JRE 压缩包');
    await downloadFile(mirrorDir + encodeURIComponent(file), zipPath, {
      onProgress: progress,
      timeout: 600000
    });
  }
  onProgress({ percent: 92, message: '解压 Java 运行时…' });
  await removeTree(targetDir);
  await ensureDir(targetDir);
  await extractZipSafe(zipPath, targetDir);
  await fsp.unlink(zipPath).catch(() => {});
  if (!await exists(targetJava)) {
    // Adoptium 的 JRE zip 通常只有一个顶层目录，把它的内容上移一层
    const names = await fsp.readdir(targetDir).catch(() => []);
    for (const name of names) {
      const inner = path.join(targetDir, name);
      const candidate = path.join(inner, 'bin', 'java.exe');
      if (await exists(candidate)) {
        const children = await fsp.readdir(inner);
        for (const child of children) {
          await fsp.rename(path.join(inner, child), path.join(targetDir, child)).catch(() => {});
        }
        await removeTree(inner);
        break;
      }
    }
  }
  if (!await exists(targetJava)) throw new Error('Java 运行时解压后找不到 bin/java.exe');
  const info = await inspectJava(targetJava);
  if (!info.ok) throw new Error('下载的 Java 运行时无法运行');
  onProgress({ percent: 100, message: 'Java ' + info.version + ' 已就绪' });
  await writeJson(path.join(runtimeRoot, 'last.json'), info);
  return info;
}

async function resolveJava(store, mcVersion) {
  const required = javaMajorForMc(mcVersion);
  const configured = store.getConfig().javaPath;
  if (configured) {
    const info = await inspectJava(configured).catch(() => null);
    if (info && info.ok) {
      return { ...info, required, source: 'manual', tooOld: info.major < required };
    }
  }
  const candidates = await findJavaCandidates();
  if (candidates.length) {
    const exact = candidates.find((j) => j.major === required);
    if (exact) return { ...exact, required, source: 'detected' };
    const newer = candidates.filter((j) => j.major >= required).sort((a, b) => a.major - b.major)[0];
    if (newer) return { ...newer, required, source: 'detected' };
    return { ...candidates[0], required, source: 'detected', tooOld: true };
  }
  return { path: '', version: '', major: 0, required, source: 'missing' };
}

module.exports = {
  parseMajor,
  inspectJava,
  findJavaCandidates,
  javaMajorForMc,
  ensureJava,
  resolveJava
};
