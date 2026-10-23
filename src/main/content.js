'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { exists, ensureDir, isInside, safeName } = require('./util');
const { instanceDir, getWorlds } = require('./minecraft');

const DIRS = {
  mod: { dir: 'mods', ext: '.jar' },
  shader: { dir: 'shaderpacks', ext: '.zip' },
  resourcepack: { dir: 'resourcepacks', ext: '.zip' }
};

function listDir(dir, ext) {
  return fsp.readdir(dir).catch(() => []).then(async (names) => {
    const out = [];
    for (const filename of names) {
      const full = path.join(dir, filename);
      let st = null;
      try { st = await fsp.stat(full); } catch { continue; }
      const lower = filename.toLowerCase();
      let enabled = true;
      let display = filename;
      if (lower.endsWith(ext + '.disabled')) {
        enabled = false;
        display = filename.slice(0, -(ext.length + 9));
      } else if (lower.endsWith(ext)) {
        display = filename.slice(0, -ext.length);
      } else if (st.isDirectory() && !lower.endsWith('.disabled')) {
        // 解包后的资源包目录
      } else {
        continue;
      }
      out.push({
        name: display,
        filename,
        path: full,
        size: st.size,
        isDir: st.isDirectory(),
        enabled,
        kind: ext === '.jar' ? 'mod' : 'pack'
      });
    }
    out.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return out;
  });
}

async function list(kind, config, versionId) {
  const instance = instanceDir(config, versionId);
  if (kind === 'datapack') {
    const worlds = await getWorlds(config.gameDir, versionId, config.isolation);
    const all = [];
    for (const world of worlds) {
      const dir = path.join(world.path, 'datapacks');
      const files = await listDir(dir, '.zip');
      for (const file of files) all.push({ ...file, world: world.name });
    }
    return { worlds, files: all };
  }
  const spec = DIRS[kind];
  if (!spec) throw new Error('未知内容类型');
  const dir = path.join(instance, spec.dir);
  return { dir, files: await listDir(dir, spec.ext) };
}

async function listForWorld(config, versionId, worldName) {
  const worlds = await getWorlds(config.gameDir, versionId, config.isolation);
  const world = worlds.find((w) => w.name === worldName);
  if (!world) return [];
  return listDir(path.join(world.path, 'datapacks'), '.zip');
}

async function toggle(kind, filePath, currentlyEnabled) {
  if (!fs.existsSync(filePath)) return false;
  const target = currentlyEnabled ? filePath + '.disabled' : filePath.replace(/\.disabled$/i, '');
  await fsp.rename(filePath, target);
  return !currentlyEnabled;
}

async function remove(filePath, gameDir) {
  if (!isInside(gameDir, filePath)) throw new Error('拒绝删除游戏目录之外的文件');
  if (!await exists(filePath)) return false;
  await fsp.rm(filePath, { recursive: true, force: true });
  return true;
}

async function prepareTarget(kind, config, versionId, filename, world) {
  const instance = instanceDir(config, versionId);
  let dir;
  if (kind === 'datapack') {
    if (!world) throw new Error('请先选择存档');
    dir = path.join(instance, 'saves', safeName(world), 'datapacks');
  } else {
    const spec = DIRS[kind];
    if (!spec) throw new Error('未知内容类型');
    dir = path.join(instance, spec.dir);
  }
  await ensureDir(dir);
  return path.join(dir, safeName(filename));
}

async function worlds(config, versionId) {
  return getWorlds(config.gameDir, versionId, config.isolation);
}

module.exports = {
  list,
  listForWorld,
  toggle,
  remove,
  prepareTarget,
  worlds,
  DIRS
};
