'use strict';

const BASE = 'https://minecraftservers.org';
const TYPES = [
  { id: 'survival', name: '生存' },
  { id: 'skyblock', name: '空岛' },
  { id: 'factions', name: '阵营' },
  { id: 'pvp', name: 'PvP' },
  { id: 'kitpvp', name: 'KitPvP' },
  { id: 'boxpvp', name: 'BoxPvP' },
  { id: 'creative', name: '创造' },
  { id: 'pixelmon', name: '宝可梦' },
  { id: 'roleplay', name: '角色扮演' },
  { id: 'towny', name: '城市模拟' },
  { id: 'modded', name: '模组' }
];

const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function decode(text) {
  return String(text || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function parse(html, type) {
  const out = [];
  const re = /<div data-id="(\d+)" class="server-listing[^"]*">([\s\S]*?)(?=<div data-id="\d+" class="server-listing|<\/section>)/g;
  let m;
  while ((m = re.exec(html)) && out.length < 30) {
    const id = m[1];
    const body = m[2];
    const name = body.match(/class="col-md-48 name">\s*<a[^>]*>([^<]+)/);
    const addr = body.match(/<div class="url">([^<]+)/);
    const players = body.match(/<div class="players">[\s\S]*?<div class="value">([^<]+)/);
    const online = /class="value online"/.test(body) || /<div class="value online">/i.test(body);
    if (!name || !addr) continue;
    const address = decode(addr[1]);
    if (!address || address.length > 120) continue;
    out.push({
      id,
      type,
      name: decode(name[1]),
      address,
      players: players ? decode(players[1]) : '',
      online,
      url: BASE + '/server/' + id
    });
  }
  return out;
}

async function fetchPage(type, page) {
  const res = await fetch(BASE + '/type/' + encodeURIComponent(type) + (page > 1 ? '/' + page : ''), {
    headers: { 'User-Agent': 'EMCL/1.26.25.14 (server recommendations)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

async function category(type) {
  const info = TYPES.find((t) => t.id === type) || TYPES[0];
  const hit = cache.get(info.id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const pages = await Promise.all([fetchPage(info.id, 1), fetchPage(info.id, 2).catch(() => '')]);
  const seen = new Set();
  const list = [];
  for (const html of pages) {
    for (const item of parse(html, info.id)) {
      if (seen.has(item.address.toLowerCase())) continue;
      seen.add(item.address.toLowerCase());
      list.push(item);
    }
  }
  const value = { ok: true, type: info.id, name: info.name, list: list.slice(0, 30), fetchedAt: Date.now() };
  cache.set(info.id, { at: Date.now(), value });
  return value;
}

async function recommend(type) {
  return category(type || 'survival');
}

module.exports = { TYPES, recommend };
