'use strict';

const { fetchJson } = require('./util');

async function fabric(mc) {
  const list = await fetchJson('https://meta.fabricmc.net/v2/versions/loader/' + encodeURIComponent(mc));
  const versions = (Array.isArray(list) ? list : [])
    .map((x) => ({ version: x.loader && x.loader.version, stable: !!(x.loader && x.loader.stable) }))
    .filter((x) => x.version);
  return { versions: versions.slice(0, 30), recommended: (versions.find((x) => x.stable) || versions[0] || {}).version || '' };
}

async function quilt(mc) {
  const list = await fetchJson('https://meta.quiltmc.org/v3/versions/loader/' + encodeURIComponent(mc));
  const versions = (Array.isArray(list) ? list : [])
    .map((x) => ({ version: x.loader && x.loader.version, stable: !!(x.loader && x.loader.stable) }))
    .filter((x) => x.version);
  return { versions: versions.slice(0, 30), recommended: (versions.find((x) => x.stable) || versions[0] || {}).version || '' };
}

async function forge(mc) {
  const data = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
  const promos = data.promotions || {};
  const out = [];
  if (promos[mc + '-recommended']) out.push({ version: promos[mc + '-recommended'], stable: true });
  if (promos[mc + '-latest'] && !out.some((x) => x.version === promos[mc + '-latest'])) {
    out.push({ version: promos[mc + '-latest'], stable: false });
  }
  return { versions: out, recommended: (out.find((x) => x.stable) || out[0] || {}).version || '' };
}

async function neoforge(mc) {
  const parts = String(mc).split('.');
  const prefix = parts.length >= 2 ? parts[1] + '.' + parts[2] : '';
  const res = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml', {
    headers: { 'User-Agent': 'EMCL/1.26.25.14' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const xml = await res.text();
  const all = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1])
    .filter((v) => !prefix || v.startsWith(prefix + '.'))
    .reverse();
  const versions = all.slice(0, 30).map((v) => ({ version: v, stable: !/beta|alpha/i.test(v) }));
  return { versions, recommended: (versions.find((x) => x.stable) || versions[0] || {}).version || '' };
}

async function list(type, mc) {
  const t = String(type || '').toLowerCase();
  if (!mc) throw new Error('缺少 Minecraft 版本');
  if (t === 'fabric') return fabric(mc);
  if (t === 'quilt') return quilt(mc);
  if (t === 'forge') return forge(mc);
  if (t === 'neoforge') return neoforge(mc);
  throw new Error('不支持查询该加载器版本');
}

module.exports = { list };
