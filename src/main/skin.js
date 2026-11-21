'use strict';

const fs = require('fs');
const path = require('path');
const { fetchJson } = require('./util');
const auth = require('./auth');

const MC_PROFILE = 'https://api.minecraftservices.com/minecraft/profile';
const DEFAULT_SKIN = path.join(__dirname, '../../assets/default-skin.png');
const cache = new Map();
const CACHE_TTL = 60000;

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

async function fetchImage(url, isSkin = false) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EMCL/1.26.25.14', 'Accept': 'image/png,image/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error('皮肤图片下载失败：HTTP ' + res.status);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('皮肤图片过大');
    chunks.push(chunk);
  }
  const buf = Buffer.concat(chunks);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('服务器返回的不是有效 PNG 皮肤图片');
  }
  if (isSkin && (buf.readUInt32BE(16) !== 64 || ![32, 64].includes(buf.readUInt32BE(20)))) {
    throw new Error('皮肤尺寸必须为 64×64 或 64×32');
  }
  return 'data:image/png;base64,' + b64(buf);
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

async function microsoftSkin(store, account) {
  const refresh = async () => {
    try {
      account = await auth.refreshAccount(store, account);
      await store.updateAccount(account);
    } catch {
      throw new Error('无法刷新正版账户凭据，请检查网络，或到「账户」重新登录微软账户后重试');
    }
  };
  if (!account.accessToken || (account.expiresAt && account.expiresAt < Date.now() + 60000)) await refresh();
  const request = () => fetch(MC_PROFILE, {
    headers: {
      'Authorization': 'Bearer ' + account.accessToken,
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.25.14'
    },
    signal: AbortSignal.timeout(15000)
  });
  let res = await request();
  if (res.status === 401) {
    await refresh();
    res = await request();
  }
  if (res.status === 401) throw new Error('正版账户登录已过期，请重新登录微软账户');
  if (res.status === 404) throw new Error('该微软账户没有 Java 版玩家档案，请确认已拥有游戏并创建玩家档案');
  if (res.status === 429) throw new Error('皮肤请求过于频繁，请稍后重试');
  if (!res.ok) throw new Error('读取 Minecraft 档案失败：HTTP ' + res.status);
  const profile = await res.json();
  if (!profile.id || !profile.name) throw new Error('Minecraft 档案数据不完整，请刷新账户后重试');
  const skins = Array.isArray(profile.skins) ? profile.skins : [];
  const skin = skins.find((item) => String(item.state || '').toUpperCase() === 'ACTIVE') ||
    skins.find((item) => !item.state);
  const capes = (profile.capes || []).map((c) => ({
    id: String(c.id || ''),
    alias: String(c.alias || '披风'),
    state: String(c.state || ''),
    url: textureUrl(c.url),
    active: String(c.state || '').toUpperCase() === 'ACTIVE'
  }));
  return {
    url: skin && skin.url ? textureUrl(skin.url) : '',
    model: skin && String(skin.variant).toLowerCase() === 'slim' ? 'slim' : 'steve',
    capes,
    name: profile.name,
    uuid: profile.id,
    account
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
  let account = store.activeAccount();
  if (!account) {
    return { ok: true, source: 'none', name: '未登录', uuid: '', model: 'steve',
      accountId: '', skinUrl: '', dataUrl: defaultSkin(), isDefault: true, capes: [], fetchedAt: Date.now() };
  }
  const cacheKey = (a) => [a.id, a.kind, a.accessToken || '', a.server || ''].join(':');
  const key = cacheKey(account);
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached;
  cache.delete(key);

  let info = { url: '', model: account.skinModel || 'steve' };
  const source = account.kind === 1 ? 'microsoft' : (account.kind === 2 ? 'thirdparty' : 'offline');
  try {
    if (account.kind === 1) {
      info = await microsoftSkin(store, account);
      account = info.account;
    } else if (account.kind === 2) info = await thirdPartySkin(account);
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('读取皮肤超时，请检查网络后刷新');
    if (error.message === 'fetch failed') throw new Error('无法连接皮肤服务，请检查网络后刷新');
    throw error;
  }

  let dataUrl = '';
  if (info.url) {
    try {
      dataUrl = await fetchImage(info.url, true);
    } catch {
      throw new Error('已获取账户皮肤信息，但皮肤图片下载失败，请检查网络后刷新');
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
    accountId: account.id,
    name: info.name || account.name,
    uuid: info.uuid || account.uuid,
    model: dataUrl ? (info.model || 'steve') : 'steve',
    skinUrl: info.url || '',
    dataUrl: dataUrl || defaultSkin(),
    isDefault: !dataUrl,
    capes,
    capeDataUrl,
    activeCapeId: activeCape ? activeCape.id : '',
    fetchedAt: Date.now()
  };
  cache.delete(key);
  cache.set(cacheKey(account), result);
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

async function uploadSkin(store, dataUrl, variant = 'steve') {
  let account = store.activeAccount();
  if (!account) throw new Error('请先登录账户');
  if (account.kind !== 1 || !account.accessToken) throw new Error('只有微软账户支持上传皮肤');
  const text = String(dataUrl || '');
  const match = /^data:image\/(?:png|jpeg);base64,(.+)$/i.exec(text);
  if (!match) throw new Error('皮肤数据格式不正确');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw new Error('皮肤图片大小不正确');
  const makeForm = () => {
    const form = new FormData();
    form.append('variant', variant === 'slim' ? 'slim' : 'classic');
    form.append('file', new Blob([buffer], { type: 'image/png' }), 'skin.png');
    return form;
  };
  const request = () => fetch(MC_PROFILE + '/skins', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + account.accessToken,
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.25.19'
    },
    body: makeForm()
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
    throw new Error('皮肤上传失败：HTTP ' + res.status + (detail ? '：' + detail : ''));
  }
  cache.clear();
  return getSkin(store, true);
}

module.exports = { getSkin, changeCape, uploadSkin };
