'use strict';

const fs = require('fs');
const path = require('path');
const { fetchJson } = require('./util');
const auth = require('./auth');

const MC_PROFILE = 'https://api.minecraftservices.com/minecraft/profile';
const DEFAULT_SKIN = path.join(__dirname, '../../assets/default-skin.png');
const cache = new Map();

function b64(data) {
  return Buffer.from(data).toString('base64');
}

function defaultSkin() {
  try {
    const data = fs.readFileSync(DEFAULT_SKIN);
    return 'data:image/png;base64,' + b64(data);
  } catch {
    return '';
  }
}

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EMCL/1.26.25.14', 'Accept': 'image/png,image/*' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('皮肤图片下载失败：HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 2 * 1024 * 1024) throw new Error('皮肤图片过大');
  const type = res.headers.get('content-type') || 'image/png';
  const mime = type.startsWith('image/') ? type.split(';')[0] : 'image/png';
  return 'data:' + mime + ';base64,' + b64(buf);
}

function textureUrl(value) {
  return String(value || '').replace(/^http:\/\/textures\.minecraft\.net/, 'https://textures.minecraft.net');
}

function skinFromTextures(properties) {
  if (!Array.isArray(properties)) return null;
  for (const p of properties) {
    if (p.name !== 'textures' || !p.value) continue;
    try {
      const json = JSON.parse(Buffer.from(p.value, 'base64').toString('utf8'));
      const skin = json.textures && json.textures.SKIN;
      const cape = json.textures && json.textures.CAPE;
      if (skin && skin.url) {
        return {
          url: textureUrl(skin.url),
          model: skin.metadata && skin.metadata.model === 'slim' ? 'slim' : 'steve',
          capeUrl: cape && cape.url ? textureUrl(cape.url) : ''
        };
      }
    } catch { /* ignore */ }
  }
  return null;
}

async function microsoftSkin(store, account, force) {
  let res = await fetch(MC_PROFILE, {
    headers: {
      'Authorization': 'Bearer ' + account.accessToken,
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.25.14'
    }
  });
  if (res.status === 401) {
    const fresh = await auth.refreshAccount(store, account);
    await store.updateAccount(fresh);
    account = fresh;
    res = await fetch(MC_PROFILE, {
      headers: {
        'Authorization': 'Bearer ' + account.accessToken,
        'Accept': 'application/json',
        'User-Agent': 'EMCL/1.26.25.14'
      }
    });
  }
  if (!res.ok) throw new Error('读取 Minecraft 档案失败：HTTP ' + res.status);
  const profile = await res.json();
  const skin = profile.skins && profile.skins[0];
  const capes = (profile.capes || []).map((c) => ({
    id: String(c.id || ''),
    alias: String(c.alias || '披风'),
    state: String(c.state || ''),
    url: textureUrl(c.url),
    active: String(c.state || '').toUpperCase() === 'ACTIVE'
  }));
  if (!skin || !skin.url) return { url: '', model: account.skinModel || 'steve', capes };
  return {
    url: textureUrl(skin.url),
    model: skin.variant === 'slim' ? 'slim' : 'steve',
    capes
  };
}

async function thirdPartySkin(account) {
  const uuid = String(account.uuid || '').replace(/-/g, '');
  const root = String(account.server || '').replace(/\/+$/, '');
  if (!root || !uuid) return { url: '', model: 'steve' };
  const json = await fetchJson(root + '/sessionserver/session/minecraft/profile/' + uuid, {
    timeout: 15000,
    headers: { 'User-Agent': 'EMCL/1.26.25.14' }
  });
  const skin = skinFromTextures(json.properties);
  return skin || { url: '', model: 'steve' };
}

async function getSkin(store, force = false) {
  const account = store.activeAccount();
  if (!account) {
    return { ok: true, source: 'none', name: '未登录', uuid: '', model: 'steve',
      skinUrl: '', dataUrl: defaultSkin(), isDefault: true };
  }
  const key = account.id + ':' + (account.accessToken || '') + ':' + (account.server || '');
  if (!force && cache.has(key)) return cache.get(key);

  let info = { url: '', model: account.skinModel || 'steve' };
  let source = account.kind === 1 ? 'microsoft' : (account.kind === 2 ? 'thirdparty' : 'offline');
  try {
    if (account.kind === 1 && account.accessToken) {
      info = await microsoftSkin(store, account, force);
    } else if (account.kind === 2) {
      info = await thirdPartySkin(account);
    }
  } catch (e) {
    source = 'error';
  }

  let dataUrl = '';
  if (info.url) {
    try {
      dataUrl = await fetchImage(info.url);
    } catch {
      dataUrl = '';
    }
  }
  const capes = Array.isArray(info.capes) ? info.capes : [];
  if (!capes.length && info.capeUrl) {
    capes.push({ id: 'thirdparty', alias: '第三方披风', state: 'ACTIVE', url: info.capeUrl, active: true });
  }
  const activeCape = capes.find((c) => c.active);
  let capeDataUrl = '';
  if (activeCape && activeCape.url) {
    try { capeDataUrl = await fetchImage(activeCape.url); } catch { capeDataUrl = ''; }
  }
  const result = {
    ok: true,
    source,
    name: account.name,
    uuid: account.uuid,
    model: info.model || 'steve',
    skinUrl: info.url || '',
    dataUrl: dataUrl || defaultSkin(),
    isDefault: !dataUrl,
    capes,
    capeDataUrl,
    activeCapeId: activeCape ? activeCape.id : ''
  };
  cache.set(key, result);
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return result;
}

async function changeCape(store, capeId, hide = false) {
  let account = store.activeAccount();
  if (!account) throw new Error('请先登录账户');
  if (account.kind !== 1 || !account.accessToken) throw new Error('只有微软账户支持切换官方披风');
  const request = async () => fetch(MC_PROFILE + '/capes/active', {
    method: hide ? 'DELETE' : 'PUT',
    headers: {
      'Authorization': 'Bearer ' + account.accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.25.14'
    },
    body: hide ? undefined : JSON.stringify({ capeId: String(capeId || '') })
  });
  let res = await request();
  if (res.status === 401) {
    account = await auth.refreshAccount(store, account);
    await store.updateAccount(account);
    res = await request();
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error('披风切换失败：HTTP ' + res.status + (detail ? '：' + detail : ''));
  }
  cache.clear();
  return getSkin(store, true);
}

module.exports = { getSkin, changeCape };
