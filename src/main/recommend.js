'use strict';

const modrinth = require('./modrinth');

const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function categoryOf(hit) {
  const list = Array.isArray(hit.categories) ? hit.categories : [];
  const known = list.find((x) => ['optimization', 'adventure', 'decoration', 'technology', 'magic', 'utility', 'worldgen', 'library'].includes(x));
  return {
    optimization: '优化',
    adventure: '冒险',
    decoration: '装饰',
    technology: '科技',
    magic: '魔法',
    utility: '实用',
    worldgen: '世界生成',
    library: '前置'
  }[known] || '模组';
}

async function getRecommendations(gameVersion, loader) {
  const key = String(gameVersion || '') + ':' + String(loader || '');
  const now = Date.now();
  if (cache.has(key) && now - cache.get(key).at < CACHE_MS) {
    return cache.get(key).value;
  }
  if (!gameVersion || !loader) return { ok: true, items: [], error: '' };

  const hits = await modrinth.topMods(gameVersion, loader, 100);
  const items = hits.map((hit) => ({
    slug: hit.slug,
    projectId: hit.project_id,
    title: hit.title,
    description: hit.description || '',
    icon: hit.icon_url || '',
    downloads: hit.downloads || 0,
    category: categoryOf(hit),
    available: true,
    versionName: ''
  }));
  const value = { ok: true, items, error: '' };
  cache.set(key, { at: now, value });
  return value;
}

module.exports = { getRecommendations };
