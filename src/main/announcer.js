'use strict';

const API = 'https://api.emcl.life';

async function apiRequest(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const error = data && data.error ? data.error : '请求失败（HTTP ' + response.status + '）';
    const err = new Error(error);
    err.status = response.status;
    throw err;
  }
  return data || {};
}

function normalize(item) {
  return {
    id: String(item.id || ''),
    title: String(item.title || ''),
    body: String(item.body || ''),
    date: String(item.date || ''),
    tag: String(item.tag || '公告'),
    type: String(item.tag || '公告'),
    audience: String(item.audience || 'both'),
    targets: String(item.targets || ''),
    url: String(item.url || ''),
    pinned: item.pinned === true || item.pinned === 1,
    createdAt: Number(item.created_at) || 0
  };
}

module.exports = function createAnnouncer(store) {
  function token() {
    return String(store.getConfig().announcerToken || '').trim();
  }

  function authHeaders() {
    const value = token();
    return value ? { Authorization: 'Bearer ' + value } : {};
  }

  async function status() {
    if (!token()) return { configured: false, login: '', repo: 'emcl-api', error: '' };
    try {
      await apiRequest('/api/session', { headers: authHeaders() });
      return { configured: true, login: 'admin', repo: 'emcl-api', error: '' };
    } catch (e) {
      return { configured: false, login: '', repo: 'emcl-api', error: e.message || '登录已过期' };
    }
  }

  async function setToken(password) {
    const value = String(password || '').trim();
    if (!value) throw new Error('请输入公告发布密码');
    const data = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: value })
    });
    if (!data.token) throw new Error('登录失败：服务端没有返回令牌');
    const config = store.getConfig();
    config.announcerToken = data.token;
    await store.saveConfig(config);
    return { ok: true, configured: true, login: 'admin', repo: 'emcl-api', error: '' };
  }

  async function clearToken() {
    const config = store.getConfig();
    config.announcerToken = '';
    await store.saveConfig(config);
    return { ok: true };
  }

  async function list() {
    const data = await apiRequest('/api/announcements');
    return { ok: true, items: (data.announcements || []).map(normalize) };
  }

  async function publish(input) {
    if (!token()) throw new Error('请先配置公告发布密码');
    const title = String(input && input.title || '').trim();
    const body = String(input && input.body || '').trim();
    if (!title || !body) throw new Error('标题和正文不能为空');
    const types = Array.isArray(input.types) && input.types.length
      ? input.types.map((x) => String(x).trim()).filter(Boolean)
      : [String(input.tag || input.type || '公告').trim()];
    const tag = types.slice(0, 3).join(',');
    const data = await apiRequest('/api/announcements', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title,
        body,
        tag,
        date: input.date || new Date().toISOString().slice(0, 10),
        url: input.url || '',
        audience: Array.isArray(input.audience) ? input.audience : [String(input.audience || 'release')],
        targets: Array.isArray(input.targets) ? input.targets : String(input.targets || '').split(','),
        pinned: input.pinned === true
      })
    });
    const current = await list();
    return { ok: true, id: data.id, items: current.items };
  }

  async function remove(id) {
    if (!token()) throw new Error('请先配置公告发布密码');
    await apiRequest('/api/announcements/' + encodeURIComponent(String(id)), {
      method: 'DELETE',
      headers: authHeaders()
    });
    const current = await list();
    return { ok: true, items: current.items };
  }

  return { status, setToken, clearToken, list, publish, remove };
};
