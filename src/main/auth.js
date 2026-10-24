'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { DEFAULT_MS_CLIENT_ID } = require('./store');

const LIVE_AUTHORIZE = 'https://login.live.com/oauth20_authorize.srf';
const LIVE_TOKEN = 'https://login.live.com/oauth20_token.srf';
const LIVE_REDIRECT = 'https://login.live.com/oauth20_desktop.srf';
const LIVE_SCOPE = 'XboxLive.signin offline_access';
// 官方启动器使用的 Minecraft 联名标识；缺少它时登录页可能返回“登录失败”
const LIVE_COBRAND_ID = '8058f65d-ce06-4c30-9559-473c9275a65d';
// Azure / Entra 应用（Personal Microsoft accounts only）使用的 v2.0 通道
const ENTRA_AUTHORIZE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
const ENTRA_TOKEN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const ENTRA_REDIRECT = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
const XBL_AUTH = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_AUTH = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_LOGIN = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE = 'https://api.minecraftservices.com/minecraft/profile';

function randomId(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

function formatUuid(hex) {
  const h = String(hex || '').replace(/-/g, '').toLowerCase();
  if (h.length !== 32) return h;
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
    h.slice(16, 20) + '-' + h.slice(20);
}

function offlineUuid(name) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return formatUuid(hash.toString('hex'));
}

function createOffline(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('请输入玩家名');
  if (trimmed.length > 16) throw new Error('玩家名不能超过 16 个字符');
  return {
    id: randomId('offline'),
    kind: 0,
    name: trimmed,
    uuid: offlineUuid(trimmed),
    accessToken: '',
    refreshToken: '',
    server: '',
    expiresAt: 0,
    skinModel: 'steve',
    avatarSeed: trimmed
  };
}

function authorityOf(value) {
  return value === 'entra' ? 'entra' : 'live';
}

function authorizeUrl(clientId, authority = 'entra') {
  const id = clientId || DEFAULT_MS_CLIENT_ID;
  const auth = authorityOf(authority);
  const params = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    scope: LIVE_SCOPE,
    redirect_uri: auth === 'entra' ? ENTRA_REDIRECT : LIVE_REDIRECT,
    prompt: 'select_account'
  });
  if (auth === 'entra') {
    // Entra v2.0 必须显式使用 query 模式，且不能带 Live 的 cobrandid
    params.set('response_mode', 'query');
    return ENTRA_AUTHORIZE + '?' + params.toString();
  }
  params.set('cobrandid', LIVE_COBRAND_ID);
  return LIVE_AUTHORIZE + '?' + params.toString();
}

function extractCode(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('code') || '';
  } catch {
    const m = String(url || '').match(/[?&]code=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
}

async function postForm(url, values) {
  const body = new URLSearchParams(values).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.26.00'
    },
    body
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) {
    const code = json && json.error ? '[' + json.error + '] ' : '';
    const err = json && (json.error_description || json.error) ? (json.error_description || json.error) : text.slice(0, 300);
    throw new Error('微软登录失败：' + code + err);
  }
  return json;
}

async function postJson(url, value, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.26.00'
    }, headers),
    body: JSON.stringify(value)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) {
    const err = json && (json.errorMessage || json.error) ? (json.errorMessage || json.error) : text.slice(0, 200);
    const wrapped = new Error(err);
    wrapped.body = text;
    throw wrapped;
  }
  return json;
}

async function xstsError(error) {
  const body = error.body || '';
  if (body.includes('2148916233')) return '该微软账户尚未创建 Xbox 档案，请先在 xbox.com 登录一次';
  if (body.includes('2148916235')) return 'Xbox Live 在你所在的国家或地区不可用';
  if (body.includes('2148916236') || body.includes('2148916237')) return '该账户需要完成 Xbox 成人验证';
  if (body.includes('2148916238')) return '该账户是未成年人账户，需要家庭组成人授权';
  return 'Xbox 授权失败：' + error.message;
}

async function completeChain(token, clientId, authority = 'live') {
  const xbl = await postJson(XBL_AUTH, {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      // Microsoft 的 Xbox Live RPS 票证必须带 d= 前缀，缺少时这里会返回 400
      RpsTicket: 'd=' + token.access_token
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  });
  const uhs = xbl.DisplayClaims && xbl.DisplayClaims.xui && xbl.DisplayClaims.xui[0]
    ? xbl.DisplayClaims.xui[0].uhs : '';
  if (!uhs) throw new Error('Xbox 未返回用户标识');
  let xsts;
  try {
    xsts = await postJson(XSTS_AUTH, {
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xbl.Token]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    });
  } catch (e) {
    throw new Error(await xstsError(e));
  }
  const mc = await postJson(MC_LOGIN, {
    identityToken: 'XBL3.0 x=' + uhs + ';' + xsts.Token
  });
  const res = await fetch(MC_PROFILE, {
    headers: {
      'Authorization': 'Bearer ' + mc.access_token,
      'Accept': 'application/json',
      'User-Agent': 'EMCL/1.26.26.00'
    }
  });
  if (res.status === 404) throw new Error('该微软账户没有 Minecraft: Java 版，或尚未创建玩家档案');
  if (res.status === 403) {
    throw new Error('Azure 应用没有 Minecraft API 权限。请到 https://aka.ms/mce-reviewappid 申请后重试');
  }
  if (!res.ok) throw new Error('读取 Minecraft 档案失败：HTTP ' + res.status);
  const profile = await res.json();
  const skin = profile.skins && profile.skins[0];
  return {
    id: randomId('ms'),
    kind: 1,
    name: profile.name,
    uuid: formatUuid(profile.id),
    accessToken: mc.access_token,
    refreshToken: token.refresh_token,
    server: '',
    expiresAt: Date.now() + (Math.max(60, mc.expires_in || 86400) - 60) * 1000,
    skinModel: skin && skin.variant === 'slim' ? 'slim' : 'steve',
    avatarSeed: profile.name,
    authority: authorityOf(authority)
  };
}

function openLoginWindow(parent, clientId, authority = 'live') {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      parent: parent || undefined,
      modal: true,
      show: false,
      title: '微软账户登录',
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:emcl-msauth',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    let settled = false;
    const finish = (code, errorText) => {
      if (settled) return;
      settled = true;
      try { win.close(); } catch { /* ignore */ }
      if (code) resolve(code);
      else reject(new Error(errorText || '登录窗口已关闭'));
    };
    const check = (url) => {
      if (!url) return;
      const isCallback = url.includes('oauth20_desktop.srf') || url.includes('oauth2/nativeclient');
      if (isCallback && url.includes('error=')) {
        try {
          const parsed = new URL(url);
          finish('', parsed.searchParams.get('error_description') || parsed.searchParams.get('error') || '授权被取消');
        } catch {
          finish('', '微软授权失败');
        }
        return;
      }
      if (isCallback || url.includes('code=')) {
        const code = extractCode(url);
        if (code) finish(code);
      }
    };
    win.webContents.on('will-redirect', (event, url) => check(url));
    win.webContents.on('will-navigate', (event, url) => check(url));
    win.webContents.on('did-navigate', (event, url) => check(url));
    win.webContents.on('did-fail-load', (event, code, desc) => {
      if (code !== -3) reject(new Error('登录页加载失败：' + desc));
    });
    win.on('closed', () => {
      if (!settled) {
        settled = true;
        reject(new Error('登录窗口已关闭'));
      }
    });
    win.once('ready-to-show', () => win.show());
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
    win.webContents.setUserAgent(ua);
    win.loadURL(authorizeUrl(clientId, authority)).catch((e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    });
  });
}

function logAuth(store, message) {
  try {
    if (!store || !store.logsDir) return;
    fs.mkdirSync(store.logsDir, { recursive: true });
    fs.appendFileSync(path.join(store.logsDir, 'auth.log'),
      '[' + new Date().toISOString() + '] ' + message + '\n', 'utf8');
  } catch { /* ignore */ }
}

async function loginMicrosoft(store, parent, clientId) {
  const config = store.getConfig();
  const id = clientId || config.msClientId || DEFAULT_MS_CLIENT_ID;
  const authority = authorityOf(config.msAuthority);
  const tokenUrl = authority === 'entra' ? ENTRA_TOKEN : LIVE_TOKEN;
  const redirectUri = authority === 'entra' ? ENTRA_REDIRECT : LIVE_REDIRECT;
  try {
    logAuth(store, '开始微软登录，authority=' + authority + '，client_id=' + id + '，redirect=' + redirectUri);
    const code = await openLoginWindow(parent, id, authority);
    logAuth(store, '已取得授权码，长度 ' + code.length + '，开始换取 token');
    const form = {
      client_id: id,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    };
    // Entra v2.0 的授权码换 token 必须带 scope；Live 通道不需要
    if (authority === 'entra') form.scope = LIVE_SCOPE;
    const token = await postForm(tokenUrl, form);
    if (!token || !token.access_token) throw new Error('微软未返回有效令牌');
    logAuth(store, 'token 成功，开始 Xbox Live / XSTS / Minecraft 认证');
    const account = await completeChain(token, id, authority);
    logAuth(store, '认证成功：' + account.name + ' / ' + account.uuid + '（令牌已保存到本机账户文件）');
    return account;
  } catch (error) {
    logAuth(store, '登录失败：' + (error && error.message ? error.message : String(error)));
    throw error;
  }
}

async function refreshMicrosoft(store, account) {
  const config = store.getConfig();
  const id = config.msClientId || DEFAULT_MS_CLIENT_ID;
  const authority = authorityOf(account.authority || config.msAuthority);
  const tokenUrl = authority === 'entra' ? ENTRA_TOKEN : LIVE_TOKEN;
  const redirectUri = authority === 'entra' ? ENTRA_REDIRECT : LIVE_REDIRECT;
  if (!account.refreshToken) throw new Error('登录凭据已失效，请重新登录微软账户');
  const form = {
    client_id: id,
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
    redirect_uri: redirectUri
  };
  if (authority === 'entra') form.scope = LIVE_SCOPE;
  const token = await postForm(tokenUrl, form);
  if (!token || !token.access_token) throw new Error('微软令牌续期失败');
  const fresh = await completeChain(token, id, authority);
  fresh.id = account.id;
  return fresh;
}

function normalizeServer(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('请填写验证服务器地址');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s.replace(/\/+$/, '');
}

async function loginThirdParty(server, username, password) {
  const root = normalizeServer(server);
  if (!username || !password) throw new Error('请填写邮箱与密码');
  const clientToken = crypto.randomBytes(16).toString('hex');
  const json = await postJson(root + '/authserver/authenticate', {
    username,
    password,
    clientToken,
    agent: { name: 'Minecraft', version: 1 }
  });
  if (!json.selectedProfile) throw new Error('该账户在此服务器没有角色，请先在皮肤站创建角色');
  return {
    id: randomId('ygg'),
    kind: 2,
    name: json.selectedProfile.name,
    uuid: formatUuid(json.selectedProfile.id),
    accessToken: json.accessToken,
    refreshToken: json.clientToken || clientToken,
    server: root,
    expiresAt: Date.now() + 24 * 3600 * 1000,
    skinModel: 'steve',
    avatarSeed: json.selectedProfile.name
  };
}

async function refreshThirdParty(account) {
  if (!account.server) throw new Error('第三方账户缺少服务器地址');
  const json = await postJson(account.server + '/authserver/refresh', {
    accessToken: account.accessToken,
    clientToken: account.refreshToken
  });
  const p = json.selectedProfile;
  return {
    ...account,
    name: p ? p.name : account.name,
    uuid: p ? formatUuid(p.id) : account.uuid,
    accessToken: json.accessToken,
    refreshToken: json.clientToken || account.refreshToken,
    expiresAt: Date.now() + 24 * 3600 * 1000
  };
}

async function refreshAccount(store, account) {
  if (account.kind === 1) return refreshMicrosoft(store, account);
  if (account.kind === 2) return refreshThirdParty(account);
  throw new Error('离线账户无需刷新凭据');
}

async function assertMicrosoftOwnership(accessToken) {
  const res = await fetch(MC_PROFILE, {
    headers: { 'Authorization': 'Bearer ' + accessToken, 'User-Agent': 'EMCL/1.26.26.00' }
  });
  return res.ok;
}

module.exports = {
  DEFAULT_MS_CLIENT_ID,
  offlineUuid,
  createOffline,
  authorizeUrl,
  loginMicrosoft,
  refreshMicrosoft,
  loginThirdParty,
  refreshThirdParty,
  refreshAccount,
  normalizeServer,
  assertMicrosoftOwnership
};
