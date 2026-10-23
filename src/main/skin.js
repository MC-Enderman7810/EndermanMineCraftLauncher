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
    headers: { 'User-Agent': 'EMCL/1.26.25.09', 'Accept': 'image/png,image/*' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('皮肤图片下载失败：HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 2 * 1024 * 1024) throw new Error('皮肤图片过大');
  const type = res.headers.get('content-type') || 'image/png';
  return 'data:' + type.split(';')[0] + ';base64,' + b64(buf);
}

function skinFromTextures(properties) {
  if (!Array.isArray(properties)) return null;
  for (const p of properties) {
    if (p.name !== 'textures' || !p.value) continue;
    try {
      const json = JSON.parse(Buffer.from(p.value, 'base64').toString('utf8'));
      const skin = json.textures && json.textures.SKIN;
      if (skin && skin.url) {
        return {
          url: String(skin.url).replace(/^http:\/\/textures\.minecraft\.net/, 'https://textures.minecraft.net'),
          model: skin.metadata && skin.metadata.model === 'slim' ? 'slim' : 'steve'
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
      'User-Agent': 'EMCL/1.26.25.09'
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
        'User-Agent': 'EMCL/1.26.25.09'
      }
    });
  }
  if (!res.ok) throw new Error('读取 Minecraft 档案失败：HTTP ' + res.status);
  const profile = await res.json();
  const skin = profile.skins && profile.skins[0];
  if (!skin || !skin.url) return { url: '', model: account.skinModel || 'steve' };
  return {
    url: String(skin.url).replace(/^http:\/\/textures\.minecraft\.net/, 'https://textures.minecraft.net'),
    model: skin.variant === 'slim' ? 'slim' : 'steve'
  };
}

async function thirdPartySkin(account) {
  const uuid = String(account.uuid || '').replace(/-/g, '');
  const root = String(account.server || '').replace(/\/+$/, '');
  if (!root || !uuid) return { url: '', model: 'steve' };
  const json = await fetchJson(root + '/sessionserver/session/minecraft/profile/' + uuid, {
    timeout: 15000,
    headers: { 'User-Agent': 'EMCL/1.26.25.09' }
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
  const result = {
    ok: true,
    source,
    name: account.name,
    uuid: account.uuid,
    model: info.model || 'steve',
    skinUrl: info.url || '',
    dataUrl: dataUrl || defaultSkin(),
    isDefault: !dataUrl
  };
  cache.set(key, result);
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return result;
}

module.exports = { getSkin };
