'use strict';

const path = require('path');
const { ensureDir, downloadFile, safeName, formatBytes } = require('./util');

const BASE = 'https://api.modrinth.com/v2';

const PROJECT_TYPES = {
  mod: 'mod',
  shader: 'shader',
  resourcepack: 'resourcepack',
  datapack: 'datapack',
  modpack: 'modpack'
};

const KIND_DIRS = {
  mod: 'mods',
  shader: 'shaderpacks',
  resourcepack: 'resourcepacks',
  datapack: 'datapacks'
};

function headers() {
  return {
    'Accept': 'application/json',
    'User-Agent': 'EMCL/1.26.25.09 (Windows; Minecraft Java launcher)'
  };
}

function projectType(kind) {
  return PROJECT_TYPES[kind] || 'mod';
}

async function api(pathname) {
  const res = await fetch(BASE + pathname, { headers: headers() });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) {
    if (res.status === 429) throw new Error('Modrinth 请求过于频繁，请稍后再试');
    throw new Error('Modrinth 请求失败：HTTP ' + res.status + (json && json.description ? '（' + json.description + '）' : ''));
  }
  return json;
}

function searchFacets(kind, gameVersion, loader) {
  // Modrinth 的 project_type 搜索只接受 mod/modpack/resourcepack/shader，
  // 数据包必须走 all_project_types:datapack。
  const facets = kind === 'datapack'
    ? [['all_project_types:datapack']]
    : [['project_type:' + projectType(kind)]];
  if (gameVersion && kind !== 'shader' && kind !== 'resourcepack') {
    facets.push(['versions:' + gameVersion]);
  }
  if (loader && kind === 'mod') facets.push(['categories:' + loader]);
  return facets;
}

async function search(kind, query, gameVersion, loader) {
  const params = new URLSearchParams();
  params.set('limit', '24');
  params.set('index', 'relevance');
  if (query) params.set('query', query);
  params.set('facets', JSON.stringify(searchFacets(kind, gameVersion, loader)));
  const json = await api('/search?' + params.toString());
  return Array.isArray(json.hits) ? json.hits : [];
}

async function getProject(projectIdOrSlug) {
  const project = await api('/project/' + encodeURIComponent(projectIdOrSlug));
  // 搜索结果是 project_id，项目详情接口返回 id；统一成 install() 能用的结构
  if (project && !project.project_id && project.id) project.project_id = project.id;
  return project;
}

async function versions(projectId, gameVersion, loader) {
  const params = new URLSearchParams();
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]));
  if (loader) params.set('loaders', JSON.stringify([loader]));
  const suffix = params.toString() ? '?' + params.toString() : '';
  const list = await api('/project/' + encodeURIComponent(projectId) + '/version' + suffix);
  return Array.isArray(list) ? list : [];
}

function pickFile(version) {
  if (!version || !Array.isArray(version.files) || !version.files.length) return null;
  return version.files.find((f) => f.primary) || version.files[0];
}

function trusted(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'cdn.modrinth.com' || host === 'cdn-raw.modrinth.com';
  } catch {
    return false;
  }
}

function targetDir(kind, instanceDir, world) {
  if (kind === 'datapack') {
    if (!world) throw new Error('请先选择一个存档，数据包需要安装到存档内');
    return path.join(instanceDir, 'saves', safeName(world, 'world'), 'datapacks');
  }
  const sub = KIND_DIRS[kind];
  if (!sub) throw new Error('未知内容类型');
  return path.join(instanceDir, sub);
}

async function install(kind, project, options = {}) {
  const gameVersion = options.gameVersion || '';
  const loader = options.loader || '';
  const projectId = project.project_id || project.id;
  let list = await versions(projectId, gameVersion, kind === 'mod' ? loader : '');
  if (!list.length && options.strict) {
    throw new Error(project.title + ' 没有适配 ' + gameVersion +
      (loader ? ' / ' + loader : '') + ' 的版本');
  }
  if (!list.length) list = await versions(projectId, '', '');
  if (!list.length) throw new Error('该项目没有可下载的文件');
  const version = list[0];
  const file = pickFile(version);
  if (!file) throw new Error('该项目没有可下载的文件');
  if (!trusted(file.url)) throw new Error('下载地址不在 Modrinth CDN，已拒绝');
  const dir = targetDir(kind, options.instanceDir, options.world);
  await ensureDir(dir);
  const target = path.join(dir, safeName(file.filename, project.slug + '.bin'));
  await downloadFile(file.url, target, {
    timeout: 300000,
    onProgress: options.onProgress || (() => {})
  });
  return {
    path: target,
    filename: path.basename(target),
    size: file.size || 0,
    versionName: version.name || version.version_number,
    gameVersions: version.game_versions || [],
    loaders: version.loaders || []
  };
}

async function latestModpackFile(project, gameVersion) {
  let list = await versions(project.project_id, gameVersion, '');
  if (!list.length) list = await versions(project.project_id, '', '');
  if (!list.length) throw new Error('整合包没有可下载的文件');
  const version = list[0];
  const file = pickFile(version);
  if (!file) throw new Error('整合包没有可下载的文件');
  if (!trusted(file.url)) throw new Error('下载地址不在 Modrinth CDN，已拒绝');
  return { version, file };
}

module.exports = {
  search,
  getProject,
  versions,
  pickFile,
  install,
  latestModpackFile,
  targetDir,
  formatBytes,
  PROJECT_TYPES
};
