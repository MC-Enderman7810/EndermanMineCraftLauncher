'use strict';

const modrinth = require('./modrinth');

const RECOMMENDED = [
  { slug: 'sodium', category: '优化', note: '大幅提升帧数，Fabric / NeoForge 首选' },
  { slug: 'lithium', category: '优化', note: '优化服务端与单机逻辑，减少卡顿' },
  { slug: 'iris', category: '光影', note: 'Iris 光影加载器，配合光影包使用' },
  { slug: 'modmenu', category: '界面', note: '在游戏内查看和管理已安装模组' },
  { slug: 'jei', category: '实用', note: '物品配方查询，整合包必备' },
  { slug: 'rei', category: '实用', note: 'REI 配方与物品检索' },
  { slug: 'xaeros-minimap', category: '实用', note: '小地图与路径点' },
  { slug: 'mouse-tweaks', category: '实用', note: '鼠标滚轮整理物品栏' },
  { slug: 'appleskin', category: '实用', note: '显示饱和度与饥饿值细节' },
  { slug: 'farmers-delight', category: '内容', note: '农业与料理扩展' },
  { slug: 'create', category: '科技', note: '机械动力，大型科技整合包核心' }
];

const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function loadersFor(loader) {
  if (!loader) return [];
  if (loader === 'quilt') return ['quilt', 'fabric'];
  if (loader === 'neoforge') return ['neoforge', 'forge'];
  return [loader];
}

async function firstVersion(projectId, gameVersion, loader) {
  for (const candidate of loadersFor(loader)) {
    try {
      const list = await modrinth.versions(projectId, gameVersion, candidate);
      if (list.length) return { version: list[0], loader: candidate };
    } catch { /* try next */ }
  }
  return null;
}

async function getRecommendations(gameVersion, loader) {
  const key = String(gameVersion || '') + ':' + String(loader || '');
  const now = Date.now();
  if (cache.has(key) && now - cache.get(key).at < CACHE_MS) {
    return cache.get(key).value;
  }
  if (!gameVersion) return { ok: true, items: [], error: '' };

  const items = await Promise.all(RECOMMENDED.map(async (entry) => {
    try {
      const project = await modrinth.getProject(entry.slug);
      const projectId = project.project_id || project.id;
      const found = await firstVersion(projectId, gameVersion, loader);
      return {
        slug: project.slug || entry.slug,
        projectId,
        title: project.title || entry.slug,
        description: entry.note || project.description || '',
        icon: project.icon_url || '',
        downloads: project.downloads || 0,
        category: entry.category,
        available: !!found,
        loader: found ? found.loader : '',
        versionName: found ? (found.version.name || found.version.version_number) : ''
      };
    } catch {
      return {
        slug: entry.slug,
        projectId: '',
        title: entry.slug,
        description: entry.note,
        icon: '',
        downloads: 0,
        category: entry.category,
        available: false,
        versionName: ''
      };
    }
  }));
  const value = { ok: true, items, error: '' };
  cache.set(key, { at: now, value });
  return value;
}

module.exports = { getRecommendations };
