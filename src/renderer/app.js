'use strict';

const api = window.emcl;

const state = {
  config: null,
  accounts: [],
  activeAccountId: '',
  installed: [],
  java: null,
  tasks: [],
  page: 'home',
  renderedPage: '',
  manifest: null,
  manifestLoading: false,
  versionTab: 'installed',
  versionFilter: 'release',
  versionQuery: '',
  resourceKind: 'mod',
  resourceQuery: '',
  resourceHits: [],
  resourceSearching: false,
  resourceError: '',
  resourceFallback: false,
  resourceVersionId: '',
  resourceWorld: '',
  servers: [],
  serverId: '',
  serverLogs: [],
  recommendHits: [],
  recommendLoading: false,
  recommendError: '',
  recommendKey: '',
  recommendLimit: 30,
  worlds: [],
  contentData: null,
  contentLoading: false,
  contentError: '',
  installing: '',
  gameRunning: false,
  launching: false,
  logLines: [],
  latestLog: '',
  launchLogFile: '',
  msBusy: false,
  firstRun: true,
  javaList: [],
  modpackResult: null,
  skinData: null,
  skinLoading: false,
  skinError: '',
  appVersion: '',
  update: null,
  updateChecking: false,
  announcements: [],
  announcementError: '',
  noticeUrl: '',
  notifiedUpdate: '',
  notifiedAnnouncements: '',
  noticeOpenId: '',
  noticeOpenedAt: 0,
  noticeRetry: null,
  noticeSchedule: null
};

const PAGE_META = {
  home: { title: '主页', subtitle: '启动、概览与快捷操作' },
  versions: { title: '版本管理', subtitle: '下载、安装加载器、导入游戏' },
  resources: { title: '资源下载', subtitle: '模组 · 光影 · 资源包 · 数据包 · 整合包' },
  modpacks: { title: '整合包', subtitle: '导入 PCL2 / Modrinth / CurseForge 整合包' },
  accounts: { title: '账户', subtitle: '离线 · 微软 · 第三方验证' },
  servers: { title: '服务器', subtitle: '本地 Java 服务端与远程 RCON 管理' },
  skin: { title: '皮肤', subtitle: '当前账户的皮肤预览与纹理' },
  settings: { title: '设置', subtitle: '目录、Java、内存与主题' },
  logs: { title: '日志', subtitle: '启动输出与错误现场' }
};

const NAVS = [
  { id: 'home', label: '主页', icon: 'home' },
  { id: 'versions', label: '版本', icon: 'layers' },
  { id: 'resources', label: '下载', icon: 'download' },
  { id: 'modpacks', label: '整合包', icon: 'box' },
  { id: 'servers', label: '服务器', icon: 'server' },
  { id: 'accounts', label: '账户', icon: 'user' },
  { id: 'skin', label: '皮肤', icon: 'skin' },
  { id: 'settings', label: '设置', icon: 'settings' },
  { id: 'logs', label: '日志', icon: 'terminal' }
];

const ICONS = {
  home: '<path d="M3 10.7 12 3l9 7.7"/><path d="M5 9.7V21h14V9.7"/><path d="M9.5 21v-6h5v6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  download: '<path d="M12 3v11"/><path d="m7.5 9.5 4.5 4.5 4.5-4.5"/><path d="M4 17.5V21h16v-3.5"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  skin: '<path d="M8 4.5 12 7l4-2.5 5 3-2 5-3-1v8H8v-8l-3 1-2-5 5-3Z"/>',
  settings: '<path d="M4 7h16"/><circle cx="9" cy="7" r="2.2"/><path d="M4 17h16"/><circle cx="15" cy="17" r="2.2"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.2"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3.5 3L7 15"/><path d="M13 15h4"/>',
  play: '<path d="M8 5v14l11-7Z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3Z"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 9a7 7 0 0 1 11-2l2.5 2.5"/><path d="M17.5 15a7 7 0 0 1-11 2L4 14.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  power: '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
  microsoft: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M4 21h12"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  external: '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>'
};

function icon(name, size = 18) {
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
    '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[name] || ICONS.info) + '</svg>';
}

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function $(id) {
  return document.getElementById(id);
}

function toast(message, type = '') {
  const root = $('toastRoot');
  const node = document.createElement('div');
  node.className = 'toast ' + type;
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function bytes(n) {
  n = Number(n) || 0;
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

function downloads(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function avatar(name, size = '') {
  const n = String(name || '?');
  const palette = ['#2F7FD1', '#1F9D62', '#D9891B', '#8A5CD1', '#D4517E', '#2E9E8F'];
  let sum = 0;
  for (let i = 0; i < n.length; i++) sum += n.charCodeAt(i);
  const color = palette[sum % palette.length];
  return '<div class="avatar ' + (size === 'lg' ? 'lg' : '') + '" style="background:' + color + '">' +
    esc(n.charAt(0).toUpperCase()) + '</div>';
}

function tag(text, tone = 'blue') {
  return '<span class="tag tag-' + tone + '">' + esc(text) + '</span>';
}

function currentVersionId() {
  if (!state.config) return '';
  const last = state.config.lastVersionId;
  if (last && state.installed.some((v) => v.id === last)) return last;
  if (state.installed.length) return state.installed[0].id;
  return last || '';
}

function currentVersion() {
  const id = currentVersionId();
  return state.installed.find((v) => v.id === id) || null;
}

function currentAccount() {
  return state.accounts.find((a) => a.id === state.activeAccountId) || state.accounts[0] || null;
}

function accountKind(kind) {
  return kind === 1 ? '微软账户' : (kind === 2 ? '第三方账户' : '离线账户');
}

function activeVersionOptions(selected) {
  if (!state.installed.length) return '<option value="">尚未安装版本</option>';
  return state.installed.map((v) =>
    '<option value="' + esc(v.id) + '"' + (v.id === selected ? ' selected' : '') + '>' +
    esc(v.id) + ' · ' + esc(v.loader) + '</option>').join('');
}

function loaderTag(loader) {
  if (!loader || loader === '原版') return tag('原版', 'gray');
  if (loader === 'Fabric') return tag('Fabric', 'green');
  if (loader === 'Quilt') return tag('Quilt', 'green');
  if (loader === 'Forge') return tag('Forge', 'orange');
  if (loader === 'NeoForge') return tag('NeoForge', 'orange');
  return tag(loader, 'blue');
}

function gameVersionOf(versionId) {
  const v = state.installed.find((x) => x.id === versionId);
  if (!v) return '';
  return v.mcVersion || v.id;
}

function loaderOf(versionId) {
  const v = state.installed.find((x) => x.id === versionId);
  if (!v) return '';
  return { Fabric: 'fabric', Quilt: 'quilt', Forge: 'forge', NeoForge: 'neoforge' }[v.loader] || '';
}

function timeText(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/* ---------------- Render ---------------- */

function render() {
  if (!state.config) return;
  applyAccent(state.config.accent);
  const oldScroll = $('content').scrollTop;
  renderNav();
  renderTopbar();
  const brand = document.querySelector('.titlebar-brand > span:not(.brand-gem):not(.titlebar-sub)');
  if (brand) brand.textContent = 'EMCL';
  const brandName = document.querySelector('.brand-name');
  if (brandName) brandName.textContent = 'EMCL';
  document.title = 'EMCL · Enderman MineCraft Launcher';
  const versionMini = $('versionMini');
  if (versionMini) versionMini.textContent = 'v' + (state.appVersion || '1.26.25.09');
  const meta = PAGE_META[state.page] || PAGE_META.home;
  $('pageTitle').textContent = meta.title;
  $('pageSubtitle').textContent = meta.subtitle;
  const html = ({
    home: pageHome,
    versions: pageVersions,
    resources: pageResources,
    modpacks: pageModpacks,
    accounts: pageAccounts,
    skin: pageSkin,
    servers: pageServers,
    settings: pageSettings,
    logs: pageLogs
  }[state.page] || pageHome)();
  $('content').innerHTML = html;
  if (state.renderedPage === state.page) $('content').scrollTop = oldScroll;
  else $('content').scrollTop = 0;
  state.renderedPage = state.page;
  renderTasks();
  $('accountMini').innerHTML = avatar(currentAccount() ? currentAccount().name : '?', '') +
    '<span class="mini-name">' + esc(currentAccount() ? currentAccount().name : '未登录') + '</span>';
}

function renderNav() {
  $('nav').innerHTML = NAVS.map((n) =>
    '<button class="nav-item ' + (state.page === n.id ? 'active' : '') + '" data-nav="' + n.id + '">' +
    icon(n.icon) + '<span>' + n.label + '</span></button>').join('');
}

function renderTopbar() {
  const account = currentAccount();
  const java = state.java;
  const javaOk = !!(java && java.ok && !java.tooOld);
  const updateChip = $('updateChip');
  if (updateChip) {
    const u = state.update;
    if (u && u.hasUpdate) {
      updateChip.style.display = '';
      updateChip.innerHTML = '<span class="dot"></span>新版本 ' + esc(u.latest);
    } else {
      updateChip.style.display = 'none';
    }
  }
  const noticeChip = $('noticeChip');
  if (noticeChip) {
    const unread = unseenAnnouncements();
    if (unread.length) {
      noticeChip.style.display = '';
      noticeChip.innerHTML = icon('info', 13) + '<span>' + unread.length + ' 条新公告</span>';
    } else {
      noticeChip.style.display = 'none';
    }
  }
  $('javaChip').className = 'chip ' + (javaOk ? 'ok' : 'warn');
  $('javaChip').innerHTML = '<span class="dot"></span>' +
    (java && java.ok
      ? 'Java ' + java.major + (java.tooOld ? '（需 ' + java.required + '）' : '')
      : '未检测到 Java');
  $('accountChip').innerHTML = avatar(account ? account.name : '?', '') +
    '<span>' + esc(account ? account.name : '未登录') + '</span>' +
    (account ? ' · ' + esc(accountKind(account.kind)) : '');
}

function renderTasks() {
  const dock = $('taskDock');
  const now = Date.now();
  const list = state.tasks
    .filter((t) => t.state === 'running' || t.state === 'error' || now - t.updatedAt < 120000)
    .slice(0, 4);
  if (!list.length) {
    dock.innerHTML = '';
    return;
  }
  dock.innerHTML = list.map((t) => {
    const cls = t.state === 'done' ? 'done' : (t.state === 'error' ? 'error' : '');
    return '<div class="task ' + cls + '">' +
      '<div class="task-head"><span class="task-title">' + esc(t.title) + '</span>' +
      '<span class="task-percent">' + (t.state === 'error' ? '失败' : (t.state === 'done' ? '完成' : t.percent + '%')) + '</span></div>' +
      '<div class="task-msg">' + esc(t.message) + '</div>' +
      '<div class="progress"><i style="width:' + (t.state === 'error' ? 100 : t.percent) + '%"></i></div>' +
      '</div>';
  }).join('');
}

function applyAccent(color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color || '')) color = '#2F7FD1';
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-dark', shade(color, -0.18));
  root.style.setProperty('--accent-2', shade(color, 0.22));
  root.style.setProperty('--accent-soft', mixWhite(color, 0.87));
  root.style.setProperty('--accent-softer', mixWhite(color, 0.95));
}

function shade(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
  return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function mixWhite(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v) => Math.round(v + (255 - v) * ratio);
  return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function emptyState(text, iconName = 'box') {
  return '<div class="empty"><div class="empty-icon">' + icon(iconName, 23) + '</div>' +
    esc(text).replace(/\n/g, '<br>') + '</div>';
}

/* ---------------- Update / announcements ---------------- */

function allAnnouncements() {
  return (state.announcements || []).slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
}

function visibleAnnouncements() {
  return allAnnouncements();
}

function unseenAnnouncements() {
  const seen = (state.config && Array.isArray(state.config.seenAnnouncements))
    ? state.config.seenAnnouncements : [];
  const set = new Set(seen.map(String));
  return visibleAnnouncements().filter((a) => !set.has(String(a.id)));
}

async function markAnnouncementsSeen(ids) {
  if (!state.config) return;
  const list = Array.isArray(ids) && ids.length
    ? ids
    : allAnnouncements().map((a) => a.id);
  if (!list.length) return;
  const seen = new Set((state.config.seenAnnouncements || []).map(String));
  for (const id of list) seen.add(String(id));
  const next = Array.from(seen).slice(-200);
  state.config.seenAnnouncements = next;
  try {
    const res = await api.patchConfig({ seenAnnouncements: next });
    if (res && res.config) state.config = res.config;
  } catch { /* ignore */ }
  render();
}

function homeUpdateCard() {
  const u = state.update;
  if (!u || !u.hasUpdate) return '';
  const notes = (u.notes || []).slice(0, 2).join(' · ');
  return '<div class="card update-card">' +
    '<div class="update-mark">' + icon('download', 21) + '</div>' +
    '<div><div class="update-title">发现新版本 EMCL ' + esc(u.latest) + '</div>' +
      '<div class="update-sub">当前 ' + esc(u.current) + (u.releaseDate ? ' · ' + esc(u.releaseDate) : '') +
      (notes ? ' · ' + esc(notes) : '') + '</div></div>' +
    '<div class="update-actions">' +
      '<button class="btn btn-ghost btn-sm" data-action="show-update">更新内容</button>' +
      '<button class="btn btn-primary btn-sm" data-action="open-update">前往下载</button>' +
    '</div></div>';
}

function homeAnnouncements() {
  const announcements = visibleAnnouncements();
  if (!announcements.length) return '';
  const unread = unseenAnnouncements();
  return '<div class="card" style="margin-top:12px">' +
    '<div class="card-head"><h3 class="card-title">' + icon('info', 17) + '公告</h3>' +
      '<div class="row">' + (unread.length ? '<span class="tag tag-blue">' + unread.length + ' 条未读</span>' : '') +
      (unread.length ? '<button class="btn btn-ghost btn-sm" data-action="mark-notices-read">全部已读</button>' : '') +
      '</div></div>' +
    '<div class="announce-list">' + announcements.map((a) => {
      const isUnread = unread.some((x) => String(x.id) === String(a.id));
      return '<div class="announce-item" data-action="open-announcement" data-id="' + esc(a.id) + '">' +
        '<span class="announce-dot ' + (isUnread ? 'unread' : '') + '"></span>' +
        '<div style="min-width:0"><div class="announce-head">' +
          (a.pinned ? tag('置顶', 'blue') : tag(a.tag || '公告', 'gray')) +
          '<span class="announce-title">' + esc(a.title) + '</span>' +
          '<span class="announce-date">' + esc(a.date) + '</span></div>' +
          '<div class="announce-body">' + esc(a.body.length > 150 ? a.body.slice(0, 150) + '…' : a.body) + '</div>' +
        '</div></div>';
    }).join('') + '</div></div>';
}

/* ---------------- Home ---------------- */

function pageHome() {
  const version = currentVersion();
  const account = currentAccount();
  const accountName = account ? account.name : '未登录';
  const activeId = currentVersionId();
  return '' +
    '<div class="hero">' +
      '<div class="hero-top">' +
        '<div><h2>Minecraft <em>Java Edition</em></h2>' +
        '<p class="hero-sub">EMCL · Enderman MineCraft Launcher · 与 PCL2 相同的目录规范与操作习惯</p></div>' +
        '<div class="hero-account" data-action="goto-accounts">' + avatar(accountName, '') +
          '<div><div class="ha-name">' + esc(accountName) + '</div>' +
          '<div class="ha-kind">' + esc(account ? accountKind(account.kind) : '点击登录') + '</div></div></div>' +
      '</div>' +
      '<div class="hero-controls">' +
        '<div class="hero-version"><div class="hero-label">游戏版本</div>' +
          '<select class="hero-select" id="homeVersion"' + (state.installed.length ? '' : ' disabled') + '>' +
          activeVersionOptions(activeId) + '</select>' +
          '<div class="hero-meta">' + (version ? loaderTag(version.loader) + '<span>' +
            esc(version.mcVersion || version.id) + '</span>' : '<span>还没有安装版本</span>') + '</div></div>' +
        (state.gameRunning
          ? '<button class="hero-play" data-action="stop">' + icon('stop') + '停止游戏</button>'
          : '<button class="hero-play" data-action="launch"' + (state.launching ? ' disabled' : '') + '>' +
            icon('play') + (state.launching ? '正在启动…' : '启动游戏') + '</button>') +
      '</div>' +
      '<div class="hero-foot"><span>● ' + (state.java && state.java.ok && !state.java.tooOld
        ? 'Java 就绪' : (state.java && state.java.ok ? 'Java 版本偏低，需要 ' + state.java.required : '请先配置 Java')) + '</span>' +
        '<span>' + (state.config.isolation ? '版本隔离已开启' : '共享游戏目录') + '</span>' +
        '<span>离线 / 微软 / 第三方登录</span></div>' +
    '</div>' +
    '<div class="stat-grid">' +
      statCard(String(state.installed.length), '已安装版本', state.installed.length ? '可切换' : '去下载') +
      statCard(state.java && state.java.ok ? 'Java ' + state.java.major : '缺失', 'Java 运行时',
        state.java && state.java.ok && !state.java.tooOld ? '已就绪' : '需要更新') +
      statCard(state.config.maxMemory + 'M', '内存上限', '可在设置调整') +
      statCard(String(state.accounts.length), '账户', account ? accountKind(account.kind) : '未登录') +
    '</div>' +
    homeUpdateCard() +
    '<div class="quick-grid">' +
      quick('版本管理', '下载游戏、安装加载器、导入文件夹', 'layers', 'versions') +
      quick('资源下载', '模组 · 光影 · 资源包 · 数据包', 'download', 'resources') +
      quick('整合包', '导入 PCL2 / Modrinth 整合包', 'box', 'modpacks') +
      quick('账户与设置', '登录方式、Java 与主题', 'user', 'accounts') +
    '</div>' +
    homeAnnouncements() +
    '<div class="card" style="margin-top:12px">' +
      '<div class="card-head"><h3 class="card-title">' + icon('spark', 18) + '使用提示</h3>' +
        '<span class="small muted">PCL2 兼容</span></div>' +
      notice('目录规范完全兼容', 'versions / libraries / assets / mods / saves 与 PCL2、官方启动器一致，可直接导入已有的 .minecraft 文件夹。') +
      notice('整合包导入', '支持 .mrpack、带 .minecraft 的通用 zip，以及带 overrides 的 CurseForge 整合包；基础版本与加载器会自动安装。') +
      notice('下载来源', '版本文件来自 Mojang / BMCLAPI；模组、光影、资源包、数据包与整合包来自 Modrinth 官方 API。') +
    '</div>';
}

function statCard(value, label, extra) {
  return '<div class="stat"><div class="stat-value">' + esc(value) + '</div>' +
    '<div class="stat-label">' + esc(label) + '</div>' +
    (extra ? '<div class="stat-extra">' + esc(extra) + '</div>' : '') + '</div>';
}

function quick(title, desc, iconName, page) {
  return '<div class="quick" data-action="goto" data-page="' + page + '">' +
    '<div class="quick-icon">' + icon(iconName, 20) + '</div>' +
    '<div><div class="quick-title">' + esc(title) + '</div><div class="quick-desc">' + esc(desc) + '</div></div>' +
    '<div class="quick-arrow">' + icon('chevron', 17) + '</div></div>';
}

function notice(title, body) {
  return '<div class="notice"><div class="notice-dot"></div><div><div class="notice-title">' + esc(title) + '</div>' +
    '<div class="notice-body">' + esc(body) + '</div></div></div>';
}

/* ---------------- Versions ---------------- */

function pageVersions() {
  return '<div class="toolbar">' +
    '<div class="tabs">' +
      '<button class="tab ' + (state.versionTab === 'installed' ? 'active' : '') + '" data-action="vtab" data-value="installed">已安装</button>' +
      '<button class="tab ' + (state.versionTab === 'online' ? 'active' : '') + '" data-action="vtab" data-value="online">在线版本</button>' +
    '</div>' +
    '<div class="spacer"></div>' +
    '<button class="btn btn-ghost" data-action="import-folder">' + icon('folder') + '导入游戏文件夹</button>' +
    '<button class="btn btn-ghost" data-action="import-modpack">' + icon('box') + '导入整合包</button>' +
    '<button class="btn btn-primary" data-action="refresh-manifest">' + icon('refresh') + '刷新版本清单</button>' +
    '</div>' +
    (state.versionTab === 'installed' ? versionsInstalled() : versionsOnline());
}

function versionsInstalled() {
  if (!state.installed.length) {
    return '<div class="card">' + emptyState('还没有安装任何版本。\n可以在「在线版本」下载，或导入已有的 .minecraft 文件夹。', 'layers') +
      '<div class="row" style="justify-content:center"><button class="btn btn-primary" data-action="vtab" data-value="online">' +
      icon('download') + '去下载版本</button></div></div>';
  }
  return '<div class="version-list">' + state.installed.map((v) => {
    const active = v.id === currentVersionId();
    return '<div class="version-item ' + (active ? 'version-current' : '') + '">' +
      '<div class="version-icon">' + esc(v.loader === '原版' ? 'MC' : v.loader.slice(0, 2).toUpperCase()) + '</div>' +
      '<div class="version-main"><div class="version-name">' + esc(v.id) + loaderTag(v.loader) +
        (active ? tag('当前', 'blue') : '') + (!v.hasClientJar ? tag('缺 jar', 'red') : '') + '</div>' +
        '<div class="version-path">' + esc(v.dir) + '</div></div>' +
      '<div class="version-actions">' +
        '<button class="btn btn-primary btn-sm" data-action="launch-version" data-id="' + esc(v.id) + '">' + icon('play', 14) + '启动</button>' +
        (active ? '' : '<button class="btn btn-soft btn-sm" data-action="select-version" data-id="' + esc(v.id) + '">设为当前</button>') +
        (!v.hasClientJar ? '<button class="btn btn-ghost btn-sm" data-action="repair-version" data-id="' + esc(v.id) + '">补全文件</button>' : '') +
        (v.loader === '原版' ? '<button class="btn btn-ghost btn-sm" data-action="loader-modal" data-id="' + esc(v.id) + '">装加载器</button>' : '') +
        '<button class="icon-btn" title="打开目录" data-action="open-version-dir" data-path="' + esc(v.dir) + '">' + icon('folder', 15) + '</button>' +
      '</div></div>';
  }).join('') + '</div>';
}

function versionsOnline() {
  if (!state.manifest) {
    return '<div class="card">' + emptyState('还没有拉取版本清单。\n点击右上角「刷新版本清单」从 Mojang / BMCLAPI 获取。', 'download') + '</div>';
  }
  let list = state.manifest.versions || [];
  if (state.versionFilter !== 'all') list = list.filter((v) => v.type === state.versionFilter);
  if (state.versionQuery) {
    const q = state.versionQuery.toLowerCase();
    list = list.filter((v) => v.id.toLowerCase().includes(q));
  }
  const shown = list.slice(0, 120);
  return '<div class="toolbar">' +
    '<div class="tabs">' +
      ['release', 'snapshot', 'all'].map((f) => '<button class="tab ' + (state.versionFilter === f ? 'active' : '') +
        '" data-action="version-filter" data-value="' + f + '">' + ({ release: '正式版', snapshot: '快照', all: '全部' }[f]) + '</button>').join('') +
    '</div>' +
    '<div class="search-box">' + icon('search') +
      '<input id="versionSearch" placeholder="筛选版本号，如 1.21 或 1.20.1" value="' + esc(state.versionQuery) + '" />' +
    '</div>' +
    '<span class="small muted">共 ' + list.length + ' 个，展示前 ' + shown.length + ' 个</span>' +
    '</div>' +
    '<div>' + shown.map((v) => '<div class="online-row">' +
      '<div class="online-id">' + esc(v.id) + ' ' + tag(v.type === 'release' ? '正式版' : (v.type === 'snapshot' ? '快照' : v.type), v.type === 'release' ? 'blue' : 'gray') + '</div>' +
      '<div class="online-date">' + esc(timeText(v.releaseTime)) + '</div><div class="spacer"></div>' +
      '<button class="btn btn-soft btn-sm" data-action="install-options" data-id="' + esc(v.id) + '" data-url="' + esc(v.url) + '">' +
        (state.installing === v.id ? '安装中…' : '下载安装') + '</button>' +
      '</div>').join('') + '</div>';
}

/* ---------------- Resources ---------------- */

const RESOURCE_TABS = [
  { id: 'recommend', label: '推荐' },
  { id: 'mod', label: '模组' },
  { id: 'shader', label: '光影' },
  { id: 'resourcepack', label: '资源包' },
  { id: 'datapack', label: '数据包' },
  { id: 'modpack', label: '整合包' }
];

function pageResources() {
  if (!state.resourceVersionId && state.installed.length) state.resourceVersionId = currentVersionId();
  const vid = state.resourceVersionId || currentVersionId();
  const gv = gameVersionOf(vid);
  const ld = loaderOf(vid);
  if (state.resourceKind === 'recommend') return pageRecommend(vid, gv, ld);
  const kindLabel = (RESOURCE_TABS.find((t) => t.id === state.resourceKind) || RESOURCE_TABS[0]).label;
  let html = '<div class="toolbar">' +
    '<div class="tabs">' + RESOURCE_TABS.map((t) =>
      '<button class="tab ' + (state.resourceKind === t.id ? 'active' : '') + '" data-action="rkind" data-kind="' + t.id + '">' + t.label + '</button>').join('') +
    '</div><div class="spacer"></div>' +
    '<div class="field" style="margin:0;min-width:180px"><select class="select" data-change="resource-version">' +
      activeVersionOptions(vid) + '</select></div>' +
    (state.resourceKind === 'datapack' ? '<div class="field" style="margin:0;min-width:150px"><select class="select" data-change="resource-world">' +
      (state.worlds.length ? state.worlds.map((w) => '<option value="' + esc(w.name) + '"' +
        (w.name === state.resourceWorld ? ' selected' : '') + '>' + esc(w.name) + '</option>').join('')
        : '<option value="">没有存档</option>') + '</select></div>' : '') +
    '<div class="chip">' + (gv ? esc(gv) : '未选版本') + (ld ? ' · ' + esc(ld) : '') + '</div>' +
    '</div>' +
    '<div class="card" style="padding:14px">' +
      '<div class="spread" style="margin-bottom:10px"><div><div class="card-title">从 Modrinth 获取' + kindLabel + '</div>' +
        '<div class="card-subtitle">' + (state.resourceKind === 'datapack'
          ? '数据包会安装到所选存档的 datapacks 目录'
          : (state.resourceKind === 'mod' ? '按当前游戏版本与加载器筛选' : '下载后会放入对应目录')) + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" data-action="refresh-content">' + icon('refresh', 14) + '刷新本地</button></div>' +
      '<div class="toolbar" style="margin-bottom:0">' +
        '<div class="search-box">' + icon('search') +
          '<input id="resourceSearch" placeholder="搜索' + kindLabel + '，例如 sodium / complementary" value="' + esc(state.resourceQuery) + '" />' +
        '</div>' +
        '<button class="btn btn-primary" data-action="search-resources"' + (state.resourceSearching ? ' disabled' : '') + '>' +
          (state.resourceSearching ? '搜索中…' : '搜索') + '</button>' +
      '</div>' +
      (state.resourceError ? '<div class="empty" style="padding:14px;color:var(--red)">' + esc(state.resourceError) + '</div>' : '') +
      (state.resourceFallback ? '<div class="empty" style="padding:8px 14px 2px;color:var(--orange)">当前版本/加载器没有严格匹配，已放宽过滤显示全量结果；安装前请确认文件支持你的版本。</div>' : '') +
    '</div>' +
    (state.resourceHits.length ? '<div class="resource-grid" style="margin-top:10px">' +
      state.resourceHits.map((hit) => resourceCard(hit)).join('') + '</div>' : '') +
    resourceInstalled(kindLabel);
  return html;
}

function resourceCard(hit) {
  const busy = state.installing === hit.project_id;
  return '<div class="resource-card">' +
    '<div class="resource-head"><div class="resource-icon">' +
      (hit.icon_url ? '<img src="' + esc(hit.icon_url) + '" alt="" onerror="this.style.display=\'none\'" />' : esc(String(hit.title || '?').charAt(0))) +
    '</div><div style="min-width:0"><div class="resource-title">' + esc(hit.title) + '</div>' +
      '<div class="resource-author">by ' + esc(hit.author) + '</div></div></div>' +
    '<div class="resource-desc">' + esc(hit.description) + '</div>' +
    '<div class="resource-foot"><span class="downloads">' + downloads(hit.downloads) + ' 次下载</span><div class="spacer"></div>' +
      '<button class="btn ' + (state.resourceKind === 'modpack' ? 'btn-primary' : 'btn-soft') + ' btn-sm" data-action="install-resource" data-project="' + esc(hit.project_id) + '">' +
        (busy ? '处理中…' : (state.resourceKind === 'modpack' ? '安装整合包' : '安装')) + '</button></div></div>';
}

function recommendToolbar(vid, gv, ld) {
  return '<div class="toolbar">' +
    '<div class="tabs">' + RESOURCE_TABS.map((t) =>
      '<button class="tab ' + (state.resourceKind === t.id ? 'active' : '') +
      '" data-action="rkind" data-kind="' + t.id + '">' + t.label + '</button>').join('') + '</div>' +
    '<div class="spacer"></div>' +
    '<div class="field" style="margin:0;min-width:180px"><select class="select" data-change="resource-version">' +
      activeVersionOptions(vid) + '</select></div>' +
    '<div class="chip">' + (gv ? esc(gv) : '未选版本') + (ld ? ' · ' + esc(ld) : '') + '</div>' +
    '</div>';
}

function pageRecommend(vid, gv, ld) {
  let html = recommendToolbar(vid, gv, ld);
  if (!vid) {
    return html + '<div class="card">' + emptyState('还没有选择游戏版本。\n先安装一个版本，推荐会根据版本和加载器自动匹配。', 'box') + '</div>';
  }
  if (!ld) {
    return html + '<div class="card"><div class="card-head"><h3 class="card-title">先安装模组加载器</h3></div>' +
      '<div class="card-subtitle">推荐模组需要 Fabric / Quilt / Forge / NeoForge。' +
      '当前版本是原版，安装加载器后这里会自动匹配推荐。</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn btn-primary" data-action="goto-versions">去安装加载器</button></div></div>';
  }
  const key = gv + ':' + ld;
  if (state.recommendKey !== key && !state.recommendLoading) {
    setTimeout(() => loadRecommendations(false), 0);
  }
  if (state.recommendLoading && !state.recommendHits.length) {
    html += '<div class="card">' + emptyState('正在根据 ' + gv + ' · ' + ld + ' 匹配推荐模组…', 'box') + '</div>';
  } else if (state.recommendError) {
    html += '<div class="card"><div class="empty" style="color:var(--red)">' + esc(state.recommendError) + '</div>' +
      '<div class="row" style="justify-content:center"><button class="btn btn-soft" data-action="refresh-recommend">重试</button></div></div>';
  } else if (!state.recommendHits.length) {
    html += '<div class="card">' + emptyState('当前版本没有可用的推荐。', 'box') + '</div>';
  } else {
    const shown = state.recommendHits.slice(0, state.recommendLimit || 30);
    html += '<div class="recommend-head"><div><div class="card-title">模组热门 Top 100</div>' +
      '<div class="card-subtitle">Modrinth 下载榜前 100 名，按 ' + esc(gv) + ' · ' + esc(ld) + ' 筛选，点击即可安装。</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="refresh-recommend">' + icon('refresh', 14) + '刷新推荐</button></div>' +
      '<div class="recommend-grid">' + shown.map((item) => {
        const busy = state.installing === item.projectId;
        const disabled = !item.available || busy;
        return '<article class="recommend-card">' +
          '<div class="recommend-icon">' + (item.icon ? '<img src="' + esc(item.icon) + '" alt="" loading="lazy" />' : icon('box', 24)) + '</div>' +
          '<div class="recommend-content"><div class="recommend-title-row"><div class="recommend-title">' + esc(item.title) + '</div>' +
          '<span class="tag tag-blue">' + esc(item.category) + '</span></div>' +
          '<div class="recommend-desc">' + esc(item.description) + '</div>' +
          '<div class="recommend-meta">' + (item.available ? '适配当前版本' : '当前加载器不兼容') +
          ' · ' + formatDownloads(item.downloads) + '</div></div>' +
          '<button class="btn ' + (disabled ? 'btn-ghost' : 'btn-primary') + ' btn-sm" data-action="install-recommend" data-slug="' +
          esc(item.slug) + '"' + (disabled ? ' disabled' : '') + '>' +
          (busy ? '安装中…' : (item.available ? '安装' : '不可用')) + '</button></article>';
      }).join('') + '</div>' +
      (shown.length < state.recommendHits.length
        ? '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn btn-soft" data-action="more-recommend">显示更多（' +
          shown.length + ' / ' + state.recommendHits.length + '）</button></div>'
        : '');
  }
  return html;
}

function formatDownloads(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M 下载';
  if (v >= 1000) return (v / 1000).toFixed(0) + 'K 下载';
  return v + ' 下载';
}

async function loadRecommendations(force = false) {
  const vid = state.resourceVersionId || currentVersionId();
  const gv = gameVersionOf(vid);
  const ld = loaderOf(vid);
  if (!gv || !ld) return;
  const key = gv + ':' + ld;
  if (!force && state.recommendKey === key && (state.recommendLoading || state.recommendHits.length)) return;
  state.recommendKey = key;
  state.recommendLimit = 30;
  state.recommendLoading = true;
  state.recommendError = '';
  if (state.page === 'resources' && state.resourceKind === 'recommend') render();
  try {
    const res = await api.recommendMods(gv, ld);
    if (!res.ok) throw new Error(res.error || '读取推荐失败');
    state.recommendHits = res.items || [];
  } catch (e) {
    state.recommendError = e.message || '读取推荐失败';
  } finally {
    state.recommendLoading = false;
    if (state.page === 'resources' && state.resourceKind === 'recommend') render();
  }
}

async function installRecommendation(slug) {
  const item = state.recommendHits.find((x) => x.slug === slug);
  if (!item || !item.projectId || !item.available) return;
  await installResource(item.projectId, { project_id: item.projectId, title: item.title, slug: item.slug }, 'mod');
}

function resourceInstalled(kindLabel) {
  if (state.contentLoading) {
    return '<div class="card" style="margin-top:10px"><div class="empty">正在读取本地' + kindLabel + '…</div></div>';
  }
  if (state.resourceKind === 'modpack') {
    return '<div class="card" style="margin-top:10px"><div class="card-head"><h3 class="card-title">已安装整合包版本</h3>' +
      '<button class="btn btn-ghost btn-sm" data-action="import-modpack">导入本地整合包</button></div>' +
      (state.installed.length ? state.installed.filter((v) => v.loader !== '原版').map((v) =>
        '<div class="content-row">' + icon('box', 18) + '<div><div class="content-name">' + esc(v.id) + '</div>' +
        '<div class="content-meta">' + esc(v.loader) + ' · ' + esc(v.mcVersion || '') + '</div></div><div class="spacer"></div>' +
        '<button class="btn btn-primary btn-sm" data-action="launch-version" data-id="' + esc(v.id) + '">启动</button></div>').join('')
        : emptyState('还没有加载器版本，下载整合包或安装加载器后会显示在这里', 'box')) + '</div>';
  }
  const data = state.contentData;
  if (!data || !Array.isArray(data.files) || !data.files.length) {
    return '<div class="card" style="margin-top:10px">' + emptyState('本地还没有' + kindLabel + '。\n可以在上面搜索并一键安装。', 'box') + '</div>';
  }
  let files = data.files;
  if (state.resourceKind === 'datapack') files = files.filter((f) => !state.resourceWorld || f.world === state.resourceWorld);
  if (!files.length) return '<div class="card" style="margin-top:10px">' + emptyState('当前存档还没有数据包', 'box') + '</div>';
  return '<div class="card" style="margin-top:10px"><div class="card-head"><h3 class="card-title">本地' + kindLabel + '</h3>' +
    '<span class="small muted">' + files.length + ' 个</span></div>' +
    files.map((f) => '<div class="content-row">' + icon('box', 18) +
      '<div style="min-width:0"><div class="content-name">' + esc(f.name) + '</div>' +
      '<div class="content-meta">' + esc(f.filename) + ' · ' + bytes(f.size) + (f.world ? ' · ' + esc(f.world) : '') + '</div></div>' +
      '<div class="spacer"></div>' + (f.isDir ? tag('目录', 'gray') : tag(f.enabled ? '启用' : '禁用', f.enabled ? 'green' : 'gray')) +
      (!f.isDir ? '<button class="btn btn-ghost btn-sm" data-action="toggle-content" data-kind="' + state.resourceKind +
        '" data-path="' + esc(f.path) + '" data-enabled="' + (f.enabled ? '1' : '0') + '">' + (f.enabled ? '禁用' : '启用') + '</button>' : '') +
      '<button class="btn btn-danger btn-sm" data-action="remove-content" data-kind="' + state.resourceKind +
        '" data-path="' + esc(f.path) + '" data-name="' + esc(f.name) + '">' + icon('trash', 13) + '</button>' +
      '</div>').join('') + '</div>';
}

/* ---------------- Modpacks ---------------- */

function pageModpacks() {
  const loaderVersions = state.installed.filter((v) => v.loader !== '原版');
  return '<div class="toolbar">' +
    '<div><div class="card-title">整合包中心</div><div class="card-subtitle">导入 PCL2 常见的 .minecraft 整合包、Modrinth .mrpack，或直接在线安装</div></div>' +
    '<div class="spacer"></div>' +
    '<button class="btn btn-ghost" data-action="goto-resources-modpack">' + icon('download') + '在线整合包</button>' +
    '<button class="btn btn-primary" data-action="import-modpack">' + icon('box') + '导入本地整合包</button>' +
    '</div>' +
    (state.modpackResult ? '<div class="card" style="border-color:#BFD9F3;background:linear-gradient(180deg,#fff,#F6FBFF)">' +
      '<div class="card-title">' + icon('check', 17) + '最近导入</div><div class="card-subtitle">' + esc(state.modpackResult) + '</div></div>' : '') +
    '<div class="card"><div class="card-head"><h3 class="card-title">已安装的整合包 / 加载器版本</h3>' +
      '<span class="small muted">' + loaderVersions.length + ' 个</span></div>' +
      (loaderVersions.length ? loaderVersions.map((v) => '<div class="content-row">' +
        '<div class="version-icon">' + esc(v.loader.slice(0, 2).toUpperCase()) + '</div>' +
        '<div style="min-width:0"><div class="content-name">' + esc(v.id) + '</div>' +
        '<div class="content-meta">' + esc(v.loader) + ' · ' + esc(v.mcVersion || '') + ' · ' + esc(v.dir) + '</div></div>' +
        '<div class="spacer"></div><button class="btn btn-primary btn-sm" data-action="launch-version" data-id="' +
        esc(v.id) + '">启动</button></div>').join('') : emptyState('还没有安装整合包。\n可以导入本地 zip / mrpack，或到「资源下载 → 整合包」在线安装。', 'box')) +
    '</div>' +
    '<div class="card" style="margin-top:12px"><div class="card-head"><h3 class="card-title">兼容格式</h3></div>' +
      notice('Modrinth .mrpack', '自动解析 modrinth.index.json，安装基础版本、Fabric / Quilt / Forge / NeoForge 与全部文件，并校验 SHA-1。') +
      notice('PCL2 / 官方 .minecraft 整合包', 'zip 根目录或单层目录中包含 .minecraft、versions、mods、config 时，会合并到游戏目录。') +
      notice('CurseForge manifest', '会安装声明的 Minecraft 与加载器，并导入 overrides；清单里的远程文件需要 CurseForge API，界面会明确提示。') +
    '</div>';
}

/* ---------------- Servers ---------------- */

function pageServers() {
  const selected = state.servers.find((s) => s.id === state.serverId) || state.servers[0];
  const list = state.servers.length
    ? state.servers.map((s) => '<div class="server-row ' + (selected && s.id === selected.id ? 'active' : '') + '">' +
      '<div class="server-icon">' + icon('server', 18) + '</div>' +
      '<div style="min-width:0"><div class="server-name">' + esc(s.name) + ' ' +
      tag(s.running ? '运行中' : '已停止', s.running ? 'green' : 'gray') + '</div>' +
      '<div class="server-meta">' + esc(s.type === 'local' ? (s.jar + ' · ' + s.dir) : (s.host + ':' + s.port)) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="select-server" data-id="' + esc(s.id) + '">控制台</button>' +
      (s.type === 'local' ? '<button class="btn btn-ghost btn-sm" data-action="backup-server" data-id="' + esc(s.id) + '">备份</button>' : '') +
      '<button class="btn ' + (s.running ? 'btn-danger' : 'btn-primary') + ' btn-sm" data-action="' +
      (s.running ? 'stop-server' : 'start-server') + '" data-id="' + esc(s.id) + '">' +
      (s.running ? '停止' : '启动') + '</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="remove-server" data-id="' + esc(s.id) + '">删除</button></div>').join('')
    : emptyState('还没有服务器。添加本地服务端目录，或连接远程 RCON。', 'server');
  return '<div class="toolbar"><div><div class="card-title">服务器管理</div>' +
    '<div class="card-subtitle">本地 Paper / Fabric / Forge / NeoForge 服务端与远程 RCON。</div></div><div class="spacer"></div>' +
    '<button class="btn btn-ghost" data-action="add-local-server">' + icon('folder') + '添加本地服务端</button>' +
    '<button class="btn btn-primary" data-action="add-remote-server">' + icon('server') + '添加远程 RCON</button></div>' +
    '<div class="card"><div class="server-list">' + list + '</div></div>' +
    (selected ? '<div class="card" style="margin-top:12px"><div class="card-head"><h3 class="card-title">' +
      esc(selected.name) + ' · 控制台</h3><span class="small muted">' + esc(selected.type === 'local' ? selected.jar : 'RCON') +
      '</span></div><pre class="server-console" id="serverConsole">' +
      esc(state.serverLogs.join('\n') || '等待服务器输出…') + '</pre>' +
      '<div class="server-command"><input class="input" id="serverCommand" placeholder="输入服务器命令，例如 list / say hello" />' +
      '<button class="btn btn-primary" data-action="send-server-command">发送</button></div></div>' : '');
}

async function loadServers() {
  try {
    const res = await api.serverList();
    state.servers = res.servers || [];
    if (!state.serverId && state.servers[0]) state.serverId = state.servers[0].id;
    const selected = state.servers.find((s) => s.id === state.serverId);
    state.serverLogs = selected && selected.logs ? selected.logs.map((l) => l.line) : state.serverLogs;
  } catch { /* ignore */ }
  if (state.page === 'servers') render();
}

async function addLocalServer() {
  const picked = await api.serverPick();
  if (!picked) return;
  const name = picked.dir.split(/[\\/]/).filter(Boolean).pop() || 'Minecraft Server';
  const res = await api.serverAddLocal(picked.dir, name, picked.jar, 4096);
  if (!res.ok) { toast(res.error || '添加失败', 'error'); return; }
  state.servers = res.servers;
  state.serverId = res.profile.id;
  state.serverLogs = [];
  toast('服务器已添加', 'success');
  render();
}

function openRemoteServerModal() {
  openModal({
    title: '添加远程 RCON 服务器',
    desc: '密码只保存在本机，使用 Windows DPAPI 加密。',
    body: '<div class="field"><label>名称</label><input class="input" id="srvName" placeholder="我的服务器" /></div>' +
      '<div class="grid-2"><div class="field"><label>地址</label><input class="input" id="srvHost" placeholder="127.0.0.1" /></div>' +
      '<div class="field"><label>RCON 端口</label><input class="input" id="srvPort" value="25575" /></div></div>' +
      '<div class="field"><label>RCON 密码</label><input class="input" id="srvPassword" type="password" /></div>',
    actions: [{ label: '取消', kind: 'ghost', action: 'close-modal' },
      { label: '添加', kind: 'primary', action: 'save-remote-server' }]
  });
}

async function saveRemoteServer() {
  const data = {
    name: $('srvName') ? $('srvName').value.trim() : '',
    host: $('srvHost') ? $('srvHost').value.trim() : '',
    port: $('srvPort') ? Number($('srvPort').value) : 25575,
    password: $('srvPassword') ? $('srvPassword').value : ''
  };
  const res = await api.serverAddRemote(data);
  if (!res.ok) { toast(res.error || '添加失败', 'error'); return; }
  state.servers = res.servers;
  state.serverId = res.profile.id;
  state.serverLogs = [];
  closeModal();
  toast('远程服务器已添加', 'success');
  render();
}

async function serverAction(action, id) {
  const res = await api[action](id);
  if (!res.ok) { toast(res.error || '操作失败', 'error'); return; }
  await loadServers();
}

async function sendServerCommand() {
  const input = $('serverCommand');
  if (!input || !state.serverId || !input.value.trim()) return;
  const command = input.value.trim();
  input.value = '';
  try {
    const res = await api.serverCommand(state.serverId, command);
    state.serverLogs.push('> ' + command);
    if (res.reply) state.serverLogs.push(res.reply);
    state.serverLogs = state.serverLogs.slice(-300);
    render();
  } catch (e) { toast(e.message || '发送失败', 'error'); }
}

/* ---------------- Skin ---------------- */

function skinSourceLabel(source) {
  if (source === 'microsoft') return '微软账户';
  if (source === 'thirdparty') return '第三方账户';
  if (source === 'offline') return '离线账户（默认皮肤）';
  if (source === 'none') return '未登录';
  if (source === 'error') return '读取失败（默认皮肤）';
  return source || '';
}

function pageSkin() {
  const account = currentAccount();
  if (!account) {
    return '<div class="card">' + emptyState('还没有登录账户。\n登录后可以在这里查看正版皮肤、第三方皮肤或默认皮肤。', 'skin') +
      '<div class="row" style="justify-content:center"><button class="btn btn-primary" data-action="goto-accounts">' +
      icon('user') + '去登录</button></div></div>';
  }
  if (state.skinLoading && !state.skinData) {
    return '<div class="card">' + emptyState('正在读取 ' + account.name + ' 的皮肤…', 'skin') + '</div>';
  }
  const sk = state.skinData || {};
  const dataUrl = sk.dataUrl || '';
  const model = sk.model === 'slim' ? 'slim' : 'steve';
  const style = dataUrl ? ' style="--skin:url(&quot;' + esc(dataUrl) + '&quot;)"' : '';
  return '<div class="grid-2 skin-layout">' +
    '<div class="skin-stage">' +
      (dataUrl ? '<div class="skin-shadow"></div><div class="skin-doll ' + model + '"' + style + '>' +
        '<div class="skin-part skin-arm skin-arm-r"></div>' +
        '<div class="skin-part skin-leg skin-leg-l"></div>' +
        '<div class="skin-part skin-leg skin-leg-r"></div>' +
        '<div class="skin-part skin-body"></div>' +
        '<div class="skin-part skin-arm skin-arm-l"></div>' +
        '<div class="skin-part skin-head"></div>' +
        '<div class="skin-part skin-hat"></div>' +
        '</div>' : emptyState('没有可显示的皮肤纹理', 'skin')) +
      '<div class="skin-stage-label">' + esc(sk.name || account.name) + (sk.isDefault ? ' · 默认皮肤' : '') + '</div>' +
    '</div>' +
    '<div class="card"><div class="card-head"><h3 class="card-title">皮肤信息</h3>' +
      '<button class="btn btn-soft btn-sm" data-action="refresh-skin"' + (state.skinLoading ? ' disabled' : '') + '>' +
      icon('refresh', 14) + (state.skinLoading ? '读取中…' : '刷新') + '</button></div>' +
      '<div class="kv"><span class="k">账户</span><span class="v">' + esc(account.name) + '</span></div>' +
      '<div class="kv"><span class="k">来源</span><span class="v">' + esc(skinSourceLabel(sk.source)) + '</span></div>' +
      '<div class="kv"><span class="k">模型</span><span class="v">' + (model === 'slim' ? 'Alex / Slim' : 'Steve / Classic') + '</span></div>' +
      '<div class="kv"><span class="k">UUID</span><span class="v mono">' + esc(account.uuid) + '</span></div>' +
      (sk.skinUrl ? '<div class="kv"><span class="k">纹理地址</span><span class="v mono" style="word-break:break-all">' +
        esc(sk.skinUrl) + '</span></div>' : '') +
      (state.skinError ? '<div class="card-subtitle" style="color:var(--red);margin-top:8px">' + esc(state.skinError) + '</div>' : '') +
      '<div class="row" style="margin-top:12px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-action="goto-accounts">切换账户</button>' +
        '<button class="btn btn-ghost" data-action="copy-skin-url">复制纹理地址</button>' +
      '</div>' +
      '<div class="skin-head-card"><div class="skin-headview"' + style + '></div>' +
        '<div><div class="skin-head-title">头像预览</div><div class="card-subtitle">从 64×64 皮肤纹理裁切</div></div></div>' +
    '</div>' +
    '<div class="card skin-texture-card"><div class="card-head"><h3 class="card-title">原始纹理</h3>' +
      '<span class="small muted">64 × 64</span></div>' +
      (dataUrl ? '<img class="skin-texture" src="' + esc(dataUrl) + '" alt="skin" />' : emptyState('无纹理', 'skin')) +
    '</div>' +
    '<div class="card"><div class="card-head"><h3 class="card-title">说明</h3></div>' +
      '<div class="card-subtitle">皮肤来自当前登录账户的 Minecraft Profile 或第三方 Yggdrasil 会话。' +
      '离线账户使用 EMCL 内置默认皮肤；换肤请到对应账户平台操作。</div></div>' +
    '</div>';
}

async function copySkinUrl() {
  const url = state.skinData && state.skinData.skinUrl;
  if (!url) {
    toast('当前皮肤没有可复制的纹理地址', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('皮肤纹理地址已复制', 'success');
  } catch {
    toast('复制失败', 'error');
  }
}

async function loadSkin(force = false) {
  if (!currentAccount()) {
    state.skinData = null;
    state.skinError = '';
    return;
  }
  state.skinLoading = true;
  state.skinError = '';
  if (state.page === 'skin') render();
  try {
    const res = await api.getSkin(force);
    if (!res || res.ok === false) throw new Error((res && res.error) || '读取皮肤失败');
    state.skinData = res;
  } catch (e) {
    state.skinError = e.message || '读取皮肤失败';
  } finally {
    state.skinLoading = false;
    if (state.page === 'skin') render();
  }
}

/* ---------------- Accounts ---------------- */

function pageAccounts() {
  return '<div class="account-grid" style="margin-bottom:14px">' +
      '<div class="login-card" data-action="account-mode" data-value="microsoft"><div class="login-icon ms">' + icon('microsoft', 20) + '</div>' +
        '<div class="login-title">微软账户</div><div class="login-desc">Xbox Live 完整认证链，登录后使用正版档案与皮肤。</div></div>' +
      '<div class="login-card" data-action="account-mode" data-value="third"><div class="login-icon third">' + icon('server', 20) + '</div>' +
        '<div class="login-title">第三方登录</div><div class="login-desc">authlib-injector / Yggdrasil，支持 LittleSkin 等皮肤站。</div></div>' +
      '<div class="login-card" data-action="account-mode" data-value="offline"><div class="login-icon offline">' + icon('user', 20) + '</div>' +
        '<div class="login-title">离线账户</div><div class="login-desc">本地生成与 Java 端一致的 UUID，适合单机与测试。</div></div>' +
    '</div>' +
    accountForm() +
    '<div class="card" style="margin-top:12px"><div class="card-head"><h3 class="card-title">已登录账户</h3>' +
      '<span class="small muted">' + state.accounts.length + ' 个</span></div>' +
      (state.accounts.length ? state.accounts.map((a) => '<div class="account-row">' + avatar(a.name, 'lg') +
        '<div><div class="account-name">' + esc(a.name) + (a.id === state.activeAccountId ? tag('当前', 'blue') : '') + '</div>' +
        '<div class="account-meta">' + esc(accountKind(a.kind)) + ' · ' + esc(String(a.uuid).slice(0, 13)) +
        (a.server ? ' · ' + esc(a.server) : '') + '</div></div><div class="spacer"></div>' +
        (a.id === state.activeAccountId ? '' : '<button class="btn btn-soft btn-sm" data-action="select-account" data-id="' + esc(a.id) + '">设为当前</button>') +
        (a.kind !== 0 ? '<button class="btn btn-ghost btn-sm" data-action="refresh-account" data-id="' + esc(a.id) + '">刷新凭据</button>' : '') +
        '<button class="btn btn-danger btn-sm" data-action="remove-account" data-id="' + esc(a.id) + '">移除</button>' +
        '</div>').join('') : emptyState('还没有账户，选择上面的登录方式添加。', 'user')) +
    '</div>' +
    '<div class="card" style="margin-top:12px"><div class="card-subtitle">' +
      '微软登录会打开独立窗口，由微软官方页面处理密码，启动器不会接触你的密码。' +
      (state.config.msClientId ? ' 当前 client id：' + esc(state.config.msClientId) + '（可在设置中修改）。' : '') +
      '</div></div>';
}

let accountMode = 'microsoft';
let accountError = '';

function accountForm() {
  if (accountMode === 'offline') {
    return '<div class="card"><div class="card-head"><h3 class="card-title">离线登录</h3>' +
      '<button class="btn btn-ghost btn-sm" data-action="account-mode" data-value="">收起</button></div>' +
      '<div class="field"><label>玩家名（1-16 个字符）</label><div class="input-row">' +
        '<input class="input" id="offlineName" placeholder="例如 Steve" maxlength="16" />' +
        '<button class="btn btn-primary" data-action="login-offline">添加账户</button></div></div>' +
      '<div class="card-subtitle">UUID 使用 MD5("OfflinePlayer:" + 玩家名) 并设置为 v3，与 Java 端离线模式完全一致。</div>' +
      (accountError ? '<div class="empty" style="padding:10px 0 0;color:var(--red)">' + esc(accountError) + '</div>' : '') + '</div>';
  }
  if (accountMode === 'third') {
    return '<div class="card"><div class="card-head"><h3 class="card-title">第三方登录</h3>' +
      '<button class="btn btn-ghost btn-sm" data-action="account-mode" data-value="">收起</button></div>' +
      '<div class="grid-2"><div class="field"><label>验证服务器</label><input class="input" id="thirdServer" value="https://littleskin.cn/api/yggdrasil" /></div>' +
      '<div class="field"><label>邮箱 / 用户名</label><input class="input" id="thirdUser" placeholder="皮肤站账号" /></div></div>' +
      '<div class="field"><label>密码</label><input class="input" id="thirdPass" type="password" placeholder="皮肤站密码" /></div>' +
      '<div class="row"><button class="btn btn-primary" data-action="login-third">登录</button><span class="small muted">遵循 authlib-injector / Yggdrasil 协议</span></div>' +
      (accountError ? '<div class="empty" style="padding:10px 0 0;color:var(--red)">' + esc(accountError) + '</div>' : '') + '</div>';
  }
  return '<div class="card"><div class="card-head"><h3 class="card-title">微软账户登录</h3>' +
    '<button class="btn btn-primary" data-action="login-ms"' + (state.msBusy ? ' disabled' : '') + '>' +
    icon('microsoft', 15) + (state.msBusy ? '等待网页登录…' : '打开微软登录窗口') + '</button></div>' +
    '<div class="card-subtitle">使用 OAuth2 授权码 → Xbox Live → XSTS → Minecraft Services → 玩家档案。' +
    '登录窗口是微软官方页面，支持双重验证。若没有 Minecraft: Java 版，会明确提示。</div>' +
    (accountError ? '<div class="empty" style="padding:10px 0 0;color:var(--red)">' + esc(accountError) + '</div>' : '') + '</div>';
}

/* ---------------- Settings ---------------- */

function updateSettingsCard() {
  const u = state.update;
  let status = '尚未检查';
  let tone = 'muted';
  if (state.updateChecking) {
    status = '正在检查…';
  } else if (u && u.hasUpdate) {
    status = '发现新版本 ' + u.latest;
    tone = 'blue';
  } else if (u && u.ok) {
    status = '已是最新';
  } else if (u && u.error) {
    status = '检查失败：' + u.error;
  }
  return '<div class="card"><div class="card-head"><h3 class="card-title">更新</h3>' +
    '<span class="small">' + tag(status, tone) + '</span></div>' +
    '<div class="kv"><span class="k">当前版本</span><span class="v">' + esc(state.appVersion || '1.26.25.09') + '</span></div>' +
    '<div class="kv"><span class="k">自动检查</span><span class="v">启动后自动检查，每 6 小时一次</span></div>' +
    (u && u.hasUpdate ? '<div class="update-card" style="margin-top:10px;padding:10px;border:1px solid #F0D3A4;border-radius:10px">' +
      '<div class="update-mark">' + icon('download', 20) + '</div><div><div class="update-title">EMCL ' + esc(u.latest) + '</div>' +
      '<div class="update-sub">' + esc((u.notes || []).slice(0, 2).join(' · ') || '有新版本可用') + '</div></div>' +
      '<div class="update-actions"><button class="btn btn-ghost btn-sm" data-action="show-update">详情</button>' +
      '<button class="btn btn-primary btn-sm" data-action="open-update">下载</button></div></div>' : '') +
    '<div class="row" style="margin-top:10px"><button class="btn btn-soft" data-action="check-update"' +
      (state.updateChecking ? ' disabled' : '') + '>' + icon('refresh', 14) +
      (state.updateChecking ? '检查中…' : '检查更新') + '</button>' +
      '<button class="btn btn-ghost" data-action="open-repo">GitHub 仓库</button></div>' +
    (u && u.error ? '<div class="card-subtitle" style="color:var(--red);margin-top:8px">' + esc(u.error) + '</div>' : '') +
    '</div>';
}

function pageSettings() {
  const c = state.config;
  const java = state.java;
  const accountCard = '<div class="card"><div class="card-head"><h3 class="card-title">账户高级</h3></div>' +
      '<div class="field"><label>登录通道</label>' +
        '<select class="select" data-change="msAuthority">' +
          '<option value="live"' + (c.msAuthority !== 'entra' ? ' selected' : '') + '>Minecraft Live（默认公共通道）</option>' +
          '<option value="entra"' + (c.msAuthority === 'entra' ? ' selected' : '') + '>Azure Entra（自有应用）</option>' +
        '</select>' +
        '<div class="card-subtitle">公共通道开箱可用；Azure 通道需要应用获得 Minecraft Services 白名单。</div></div>' +
      '<div class="field"><label>微软 OAuth client id</label>' +
        '<input class="input" id="msClientId" value="' + esc(c.msClientId) + '" data-change="msClientId" />' +
        '<div class="card-subtitle">Azure 应用重定向 URI：https://login.microsoftonline.com/common/oauth2/nativeclient</div></div></div>';
  return '<div class="settings-grid">' +
    '<div class="stack">' +
      '<div class="card"><div class="card-head"><h3 class="card-title">游戏目录</h3>' +
        '<button class="btn btn-ghost btn-sm" data-action="open-dir">打开目录</button></div>' +
        '<div class="card-subtitle mono" style="word-break:break-all">' + esc(c.gameDir) + '</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn btn-primary" data-action="choose-dir">' + icon('folder') + '选择 .minecraft 文件夹</button>' +
        '<button class="btn btn-ghost" data-action="import-folder">' + icon('box') + '导入 PCL2 游戏目录</button></div>' +
        '<div class="card-subtitle" style="margin-top:10px">目录结构与 PCL2 完全一致：versions / libraries / assets / mods / saves / resourcepacks。' +
        '切换目录后会自动扫描版本。</div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title">Java 运行时</h3>' +
        '<span class="small ' + (java && java.ok && !java.tooOld ? '' : 'muted') + '">' +
          (java && java.ok ? 'Java ' + java.major + ' · ' + esc(java.version) +
            (java.tooOld ? '（当前版本需要 ' + java.required + '）' : '') : '未检测到') + '</span></div>' +
        '<div class="card-subtitle mono" style="word-break:break-all">' + esc(java && java.path ? java.path : '尚未选择 Java') + '</div>' +
        '<div class="row" style="margin-top:12px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" data-action="choose-java">选择 java.exe</button>' +
          '<button class="btn btn-ghost" data-action="detect-java">自动检测</button>' +
          '<button class="btn btn-ghost" data-action="download-java" data-major="25">下载 Java 25</button>' +
          '<button class="btn btn-ghost" data-action="download-java" data-major="21">Java 21</button>' +
          '<button class="btn btn-ghost" data-action="download-java" data-major="17">Java 17</button>' +
          '<button class="btn btn-ghost" data-action="download-java" data-major="8">Java 8</button>' +
        '</div>' +
        '<div class="card-subtitle" style="margin-top:10px">26.x 需要 Java 25；1.20.5+ 需要 Java 21；1.18+ 推荐 Java 17；1.17 及更早用 Java 8/16。' +
        '没有 Java 时启动器可自动下载 Adoptium JRE。</div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title">内存与 JVM</h3>' +
        '<span class="small muted">' + esc(c.minMemory) + ' ~ ' + esc(c.maxMemory) + ' MB</span></div>' +
        '<div class="field"><label>最大内存</label><div class="memory-row">' +
          '<input type="range" min="1024" max="16384" step="256" value="' + esc(c.maxMemory) + '" data-range="maxMemory" />' +
          '<span class="memory-value" id="maxMemoryLabel">' + esc(c.maxMemory) + ' MB</span></div></div>' +
        '<div class="field"><label>最小内存</label><div class="memory-row">' +
          '<input type="range" min="256" max="8192" step="256" value="' + esc(c.minMemory) + '" data-range="minMemory" />' +
          '<span class="memory-value" id="minMemoryLabel">' + esc(c.minMemory) + ' MB</span></div></div>' +
        '<div class="field"><label>额外 JVM 参数</label><input class="input" id="jvmArgs" value="' + esc(c.jvmArgs) + '" data-change="jvmArgs" placeholder="-XX:+UseG1GC" /></div>' +
        '<div class="field"><label>垃圾回收器</label><select class="select" data-change="gc">' +
          ['G1GC', 'ZGC', 'SerialGC', 'ParallelGC', ''].map((g) => '<option value="' + g + '"' +
            (c.gc === g ? ' selected' : '') + '>' + (g || '跟随 JVM 默认') + '</option>').join('') + '</select></div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title">日志</h3></div>' +
        '<div class="card-subtitle">启动日志会保存到启动器数据目录的 logs 文件夹，可在「日志」页查看和复制。</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-action="goto-logs">查看日志</button>' +
        '<button class="btn btn-ghost" data-action="open-logs">打开日志目录</button></div></div>' +
    '</div>' +

    '<div class="stack">' +
      '<div class="card"><div class="card-head"><h3 class="card-title">下载与安装</h3></div>' +
        '<div class="setting-row"><div class="setting-info"><div class="setting-title">版本下载源</div>' +
          '<div class="setting-desc">国内网络推荐 BMCLAPI 镜像。</div></div>' +
          '<div class="setting-control"><select class="select" style="width:150px" data-change="downloadSource">' +
            '<option value="bmclapi"' + (c.downloadSource === 'bmclapi' ? ' selected' : '') + '>BMCLAPI 镜像</option>' +
            '<option value="mojang"' + (c.downloadSource === 'mojang' ? ' selected' : '') + '>Mojang 官方</option></select></div></div>' +
        '<div class="setting-row"><div class="setting-info"><div class="setting-title">版本隔离</div>' +
          '<div class="setting-desc">每个版本的 mods / saves / resourcepacks / config 独立，库与资源共享。与 PCL2 的版本隔离等价。</div></div>' +
          '<div class="setting-control"><label class="switch"><input type="checkbox" data-change="isolation"' +
            (c.isolation ? ' checked' : '') + '><span></span></label></div></div>' +
        '<div class="setting-row"><div class="setting-info"><div class="setting-title">启动后最小化启动器</div>' +
          '<div class="setting-desc">游戏启动后释放前台空间。</div></div>' +
          '<div class="setting-control"><label class="switch"><input type="checkbox" data-change="closeAfterLaunch"' +
            (c.closeAfterLaunch ? ' checked' : '') + '><span></span></label></div></div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title">主题</h3><span class="small muted">蓝色为主</span></div>' +
        '<div class="setting-row"><div class="setting-info"><div class="setting-title">强调色</div>' +
          '<div class="setting-desc">默认 PCL 蓝，修改后全局立即生效。</div></div>' +
          '<div class="swatches">' + ['#2F7FD1', '#1F9D62', '#8A5CD1', '#D9891B', '#D4517E'].map((color) =>
            '<button class="swatch ' + (c.accent.toLowerCase() === color.toLowerCase() ? 'active' : '') +
            '" style="background:' + color + '" data-action="set-theme" data-color="' + color + '" title="' + color + '"></button>').join('') +
          '</div></div></div>' +

      accountCard +

      updateSettingsCard() +

      '<div class="card"><div class="card-head"><h3 class="card-title">关于</h3></div>' +
        '<div class="kv"><span class="k">版本</span><span class="v">' + esc(state.appVersion || '1.26.25.09') + '</span></div>' +
        '<div class="kv"><span class="k">应用</span><span class="v">EMCL</span></div>' +
        '<div class="kv"><span class="k">全名</span><span class="v">Enderman MineCraft Launcher</span></div>' +
        '<div class="kv"><span class="k">Minecraft</span><span class="v">Java Edition</span></div>' +
        '<div class="kv"><span class="k">数据源</span><span class="v">Mojang · BMCLAPI · Modrinth</span></div>' +
        '<div class="card-subtitle" style="margin-top:10px">本应用与 Mojang Studios、Microsoft 无隶属关系。' +
        'Minecraft 是 Mojang Studios 的商标。请使用你拥有合法授权的游戏账户。</div></div>' +
    '</div></div>';
}

/* ---------------- Logs ---------------- */

function pageLogs() {
  const lines = state.logLines.length ? state.logLines : (state.latestLog ? state.latestLog.split(/\r?\n/).map((text) => ({ level: 'out', text })) : []);
  return '<div class="toolbar"><div><div class="card-title">启动日志</div>' +
    '<div class="card-subtitle">' + esc(state.launchLogFile || '尚未启动游戏') + '</div></div><div class="spacer"></div>' +
    '<button class="btn btn-ghost" data-action="copy-log">' + icon('copy') + '复制全部</button>' +
    '<button class="btn btn-ghost" data-action="open-logs">' + icon('folder') + '打开日志目录</button>' +
    '<button class="btn btn-soft" data-action="open-feedback">' + icon('info') + '提交错误</button>' +
    '<button class="btn btn-primary" data-action="refresh-log">' + icon('refresh') + '刷新</button></div>' +
    '<div class="log-box" id="logBox">' + (lines.length ? lines.map((l) =>
      '<span class="log-line ' + (l.level === 'err' || l.level === 'error' ? 'err' : 'out') + '">' +
      esc(l.text) + '</span>').join('') : '日志为空。启动一次游戏后，这里会显示 Java 输出。') + '</div>';
}

/* ---------------- Actions ---------------- */

async function handleAction(action, el) {
  const dataset = el.dataset || {};
  switch (action) {
    case 'goto': setPage(dataset.page); break;
    case 'goto-accounts': setPage('accounts'); break;
    case 'goto-logs': setPage('logs'); break;
    case 'goto-versions': setPage('versions'); break;
    case 'goto-modpacks': setPage('modpacks'); break;
    case 'goto-resources-modpack': state.resourceKind = 'modpack'; setPage('resources'); break;
    case 'launch': await doLaunch(); break;
    case 'stop': await doStop(); break;
    case 'vtab':
      state.versionTab = dataset.value;
      if (dataset.value === 'online' && !state.manifest && !state.manifestLoading) await loadManifest(false);
      render();
      break;
    case 'version-filter': state.versionFilter = dataset.value; render(); break;
    case 'refresh-manifest': await loadManifest(true); break;
    case 'install-options': openInstallOptions(dataset.id, dataset.url); break;
    case 'install-version': await installVersion(dataset.id, dataset.url); break;
    case 'install-version-loader': {
      const shaderToggle = $('installShaderToggle');
      const withShader = !!(shaderToggle && shaderToggle.checked);
      await installVersionWithLoader(dataset.id, dataset.url, dataset.loader, withShader);
      break;
    }
    case 'repair-version': await repairVersion(dataset.id); break;
    case 'launch-version': await doLaunch(dataset.id); break;
    case 'select-version': await selectVersion(dataset.id); break;
    case 'loader-modal': openLoaderModal(dataset.id); break;
    case 'install-loader': await installLoader(dataset.type, dataset.mc); break;
    case 'open-version-dir': await api.openPath(dataset.path); break;
    case 'import-folder': await importFolder(); break;
    case 'import-modpack': await importModpack(); break;
    case 'rkind':
      state.resourceKind = dataset.kind;
      state.resourceHits = [];
      state.resourceError = '';
      state.resourceFallback = false;
      state.resourceSearching = false;
      state.contentData = null;
      if (state.resourceKind === 'recommend') await loadRecommendations(true);
      else await loadContent();
      render();
      break;
    case 'search-resources': await doSearch(); break;
    case 'install-resource': await installResource(dataset.project); break;
    case 'install-recommend': await installRecommendation(dataset.slug); break;
    case 'more-recommend': state.recommendLimit += 30; render(); break;
    case 'refresh-recommend': await loadRecommendations(true); render(); break;
    case 'toggle-content': await toggleContent(dataset.kind, dataset.path, dataset.enabled === '1'); break;
    case 'remove-content': await removeContent(dataset.kind, dataset.path, dataset.name); break;
    case 'refresh-content': await loadContent(); render(); break;
    case 'account-mode': accountMode = dataset.value || 'microsoft'; accountError = ''; render(); break;
    case 'login-offline': await loginOffline(); break;
    case 'login-ms': await loginMicrosoft(); break;
    case 'login-third': await loginThird(); break;
    case 'select-account': await selectAccount(dataset.id); break;
    case 'remove-account': await removeAccount(dataset.id); break;
    case 'refresh-account': await refreshAccount(dataset.id); break;
    case 'refresh-skin': await loadSkin(true); break;
    case 'copy-skin-url': await copySkinUrl(); break;
    case 'open-feedback': openFeedbackModal(); break;
    case 'add-local-server': await addLocalServer(); break;
    case 'add-remote-server': openRemoteServerModal(); break;
    case 'save-remote-server': await saveRemoteServer(); break;
    case 'select-server':
      state.serverId = dataset.id;
      state.serverLogs = [];
      await loadServers();
      break;
    case 'start-server': await serverAction('serverStart', dataset.id); break;
    case 'stop-server': await serverAction('serverStop', dataset.id); break;
    case 'backup-server': {
      const r = await api.serverBackup(dataset.id);
      toast(r.ok ? '备份完成：' + r.path : (r.error || '备份失败'), r.ok ? 'success' : 'error');
      break;
    }
    case 'remove-server':
      if (!confirm('删除这个服务器配置？不会删除服务端文件。')) break;
      await api.serverRemove(dataset.id);
      state.serverId = '';
      await loadServers();
      break;
    case 'send-server-command': await sendServerCommand(); break;
    case 'copy-feedback': await copyFeedbackReport(); break;
    case 'submit-feedback': await submitFeedback(); break;
    case 'choose-dir': await chooseGameDir(); break;
    case 'open-dir': await api.openPath(state.config.gameDir); break;
    case 'choose-java': await chooseJava(); break;
    case 'detect-java': await detectJava(); break;
    case 'download-java': await downloadJava(Number(dataset.major)); break;
    case 'set-theme': await setTheme(dataset.color); break;
    case 'open-logs': await openLogs(); break;
    case 'copy-log': await copyLog(); break;
    case 'refresh-log': await loadLatestLog(); render(); break;
    case 'check-update': await checkForUpdates(true); break;
    case 'show-update': showUpdateModal(); break;
    case 'open-update': await openUpdate(); break;
    case 'open-repo': await openOfficialRepo(); break;
    case 'mark-notices-read': await markAnnouncementsSeen(); break;
    case 'open-announcement': await openAnnouncement(dataset.id); break;
    case 'notice-dismiss':
      if (Date.now() - state.noticeOpenedAt < 1200) break;
      await dismissNotice();
      break;
    case 'notice-view-all':
      if (Date.now() - state.noticeOpenedAt < 1200) break;
      await viewAllNotices();
      break;
    case 'open-notice-url': await openNoticeUrl(); break;
    case 'close-modal': closeModal(); break;
    case 'pick-java': await pickJava(dataset.path); break;
    default: break;
  }
}

function setPage(page) {
  if (!PAGE_META[page]) return;
  if (!state.noticeOpenId) closeModal();
  state.page = page;
  if (page === 'resources') {
    if (state.resourceKind === 'recommend') loadRecommendations(false).then(render).catch(() => {});
    else loadContent().then(render).catch(() => {});
  }
  if (page === 'servers') loadServers();
  if (page === 'skin') loadSkin(false).catch(() => {});
  if (page === 'logs') loadLatestLog().then(render).catch(() => {});
  if (page === 'versions' && !state.manifest && !state.manifestLoading) loadManifest(false).catch(() => {});
  render();
}

async function checkForUpdates(force = true, notify = true) {
  if (state.updateChecking) return;
  state.updateChecking = true;
  if (state.page === 'settings') render();
  try {
    const result = await api.checkUpdates(force);
    state.update = result;
    if (result.hasUpdate) {
      const fresh = state.notifiedUpdate !== result.latest;
      state.notifiedUpdate = result.latest;
      if (fresh && notify) toast('发现新版本 ' + result.latest, 'success');
      if (notify) showUpdateModal();
    } else if (result.ok && notify) {
      toast('当前已是最新版本 ' + (result.current || state.appVersion), 'success');
    } else if (!result.ok && notify) {
      toast(result.error || '检查更新失败', 'error');
    }
  } catch (e) {
    toast(e.message || '检查更新失败', 'error');
  } finally {
    state.updateChecking = false;
    render();
  }
}

async function loadAnnouncements(force = false) {
  try {
    const result = await api.listAnnouncements(force);
    state.announcements = result.items || [];
    state.announcementError = result.ok ? '' : (result.error || '');
    if (unseenAnnouncements().length) scheduleAnnouncementPopup();
    render();
  } catch (e) {
    state.announcementError = e.message || '读取公告失败';
  }
}

function showUpdateModal() {
  const u = state.update;
  if (!u || !u.hasUpdate) {
    toast('当前没有可用更新');
    return;
  }
  const notes = (u.notes || []).map((n) => '<li>' + esc(n) + '</li>').join('');
  openModal({
    title: 'EMCL ' + u.latest + ' 可用',
    desc: '当前版本 ' + (u.current || state.appVersion) +
      (u.releaseDate ? ' · 发布于 ' + u.releaseDate : ''),
    body: '<div class="card" style="background:#FBFDFF;box-shadow:none;padding:12px">' +
      (notes ? '<ul style="margin:0;padding-left:18px;font-size:11px;line-height:1.9;color:var(--text-2)">' +
        notes + '</ul>' : '<div class="card-subtitle">该版本包含问题修复与体验改进。</div>') +
      '</div>',
    actions: [
      { label: '稍后', kind: 'ghost', action: 'close-modal' },
      { label: '前往下载', kind: 'primary', action: 'open-update' }
    ]
  });
}

async function openUpdate() {
  const u = state.update;
  if (!u || !u.downloadUrl) {
    toast('没有可用的下载地址', 'error');
    return;
  }
  const res = await api.openUpdate(u.downloadUrl);
  if (!res.ok) {
    toast(res.error || '打开下载页失败', 'error');
    return;
  }
  closeModal();
}

async function openOfficialRepo() {
  const res = await api.openUpdate('https://github.com/MC-Enderman7810/EndermanMineCraftLauncher');
  if (!res.ok) toast(res.error || '打开仓库失败', 'error');
}

function clearNoticeRetry() {
  if (state.noticeRetry) {
    clearTimeout(state.noticeRetry);
    state.noticeRetry = null;
  }
  if (state.noticeSchedule) {
    clearTimeout(state.noticeSchedule);
    state.noticeSchedule = null;
  }
}

function scheduleAnnouncementPopup(delay = 900) {
  if (state.noticeOpenId) return;
  if (state.noticeSchedule) clearTimeout(state.noticeSchedule);
  state.noticeSchedule = setTimeout(() => {
    state.noticeSchedule = null;
    maybeShowAnnouncementPopup(unseenAnnouncements());
  }, delay);
}

function maybeShowAnnouncementPopup(items) {
  if (!items || !items.length) return;
  if (state.noticeOpenId) return;
  const root = $('modalRoot');
  if (root && root.classList.contains('open')) {
    if (!state.noticeRetry) {
      state.noticeRetry = setTimeout(() => {
        state.noticeRetry = null;
        maybeShowAnnouncementPopup(unseenAnnouncements());
      }, 1200);
    }
    return;
  }
  const item = items[0];
  state.noticeOpenId = String(item.id);
  state.noticeOpenedAt = Date.now();
  state.notifiedAnnouncements = items.map((a) => String(a.id)).join(',');
  // 每个公告只自动显示一次；显示即记为已读
  markAnnouncementsSeen([item.id]).catch(() => {});
  openModal({
    title: item.title,
    desc: '',
    className: 'notice-modal',
    body: '<div class="notice-top">' +
      '<div class="notice-icon">' + icon('info', 22) + '</div>' +
      '<div><div class="notice-label">EMCL 新公告</div>' +
      '<div class="notice-title">' + esc(item.title) + '</div>' +
      '<div class="notice-meta">' + esc(item.date || '') +
      (item.tag ? ' · ' + esc(item.tag) : '') + '</div></div></div>' +
      '<div class="notice-body">' + esc(item.body || '') + '</div>',
    actions: [
      { label: '查看全部公告', kind: 'ghost', action: 'notice-view-all' },
      { label: '知道了', kind: 'primary', action: 'notice-dismiss' }
    ]
  });
}

async function dismissNotice() {
  const id = state.noticeOpenId;
  state.noticeOpenId = '';
  clearNoticeRetry();
  if (id) await markAnnouncementsSeen([id]);
  closeModal();
}

async function viewAllNotices() {
  await dismissNotice();
  setPage('home');
}

async function openAnnouncement(id) {
  const item = allAnnouncements().find((a) => String(a.id) === String(id));
  if (!item) return;
  await markAnnouncementsSeen([id]);
  state.noticeUrl = item.url || '';
  openModal({
    title: item.title,
    desc: item.date + (item.tag ? ' · ' + item.tag : ''),
    body: '<div class="card-subtitle" style="white-space:pre-wrap;line-height:1.9;font-size:12px">' +
      esc(item.body) + '</div>',
    actions: [
      ...(item.url ? [{ label: '打开链接', kind: 'ghost', action: 'open-notice-url' }] : []),
      { label: '知道了', kind: 'primary', action: 'close-modal' }
    ]
  });
}

async function openNoticeUrl() {
  if (!state.noticeUrl) return;
  const res = await api.openUpdate(state.noticeUrl);
  if (!res.ok) toast(res.error || '打开链接失败', 'error');
  else closeModal();
}

async function loadManifest(force) {
  if (state.manifestLoading) return;
  state.manifestLoading = true;
  try {
    const manifest = await api.listVersions(force);
    state.manifest = manifest;
    toast('版本清单已更新：' + manifest.versions.length + ' 个版本', 'success');
  } catch (e) {
    toast(e.message || '拉取版本清单失败', 'error');
  } finally {
    state.manifestLoading = false;
    render();
  }
}

function openInstallOptions(id, url) {
  const choices = [
    { id: 'vanilla', name: '原版', desc: '只安装 Minecraft，不装加载器' },
    { id: 'fabric', name: 'Fabric', desc: '轻量、更新快，模组生态最大' },
    { id: 'quilt', name: 'Quilt', desc: 'Fabric 分支，兼容大部分 Fabric 模组' },
    { id: 'forge', name: 'Forge', desc: '老牌加载器，适合大型整合包' },
    { id: 'neoforge', name: 'NeoForge', desc: 'Forge 新分支，适合 1.20.2+' }
  ];
  openModal({
    title: '安装 Minecraft ' + id,
    desc: '可以顺便安装模组加载器。原版安装完成后会自动继续安装所选加载器，进度见右下角任务。',
    body: '<label class="shader-toggle">' +
      '<input type="checkbox" id="installShaderToggle" checked />' +
      '<span><strong>同时安装光影加载器</strong>' +
      '<small>Fabric / Quilt / NeoForge 使用 Iris，Forge 使用 Oculus</small></span></label>' +
      '<div class="loader-choices">' + choices.map((c) =>
      '<button class="loader-choice" data-action="install-version-loader" data-id="' + esc(id) +
      '" data-url="' + esc(url) + '" data-loader="' + c.id + '">' +
      '<strong>' + c.name + '</strong><span>' + c.desc + '</span></button>').join('') + '</div>' +
      '<div class="card-subtitle" style="margin-top:10px">Forge / NeoForge 会调用官方安装器，需要 Java；光影加载器会额外下载一个模组。</div>',
    actions: [{ label: '取消', kind: 'ghost', action: 'close-modal' }]
  });
}

async function installVersionWithLoader(id, url, loader, shader) {
  if (!id) return;
  closeModal();
  state.installing = id;
  render();
  try {
    const res = await api.installVersionWithLoader(id, url, loader, !!shader);
    if (!res.ok) throw new Error(res.error || '安装失败');
    state.installed = res.installed;
    if (res.versionId) state.config.lastVersionId = res.versionId;
    const loaderName = loader === 'vanilla' ? '' : (' + ' + loader);
    toast(id + loaderName + (res.shader ? ' + 光影加载器' : '') + ' 安装完成', 'success');
    if (res.shaderError) {
      toast('光影加载器未安装：' + res.shaderError, 'error');
    }
  } catch (e) {
    toast(e.message || '安装失败', 'error');
    showErrorModal('安装失败', e.message || '');
  } finally {
    state.installing = '';
    render();
  }
}

async function installVersion(id, url) {
  if (!id) return;
  state.installing = id;
  render();
  try {
    const res = await api.installVersion(id, url);
    if (!res.ok) throw new Error(res.error || '安装失败');
    state.installed = res.installed;
    state.config.lastVersionId = id;
    toast(id + ' 安装完成', 'success');
  } catch (e) {
    toast(e.message || '安装失败', 'error');
  } finally {
    state.installing = '';
    render();
  }
}

async function repairVersion(id) {
  if (!id) return;
  toast('开始补全 ' + id + ' 的文件，进度见右下角');
  const res = await api.repairVersion(id);
  if (!res.ok) {
    toast(res.error || '补全失败', 'error');
    showErrorModal('版本补全失败', res.error || '');
    return;
  }
  state.installed = res.installed;
  toast(id + ' 文件已补全', 'success');
  render();
}

async function doLaunch(versionId) {
  if (state.launching || state.gameRunning) return;
  const id = versionId || currentVersionId();
  if (!id) {
    toast('请先安装一个游戏版本', 'error');
    setPage('versions');
    return;
  }
  state.launching = true;
  state.logLines = [];
  render();
  try {
    const res = await api.launch(id);
    if (!res.ok) {
      toast(res.error || '启动失败', 'error');
      state.launching = false;
      render();
      showErrorModal('启动失败', res.error || '未知错误');
      return;
    }
    state.gameRunning = true;
    state.launchLogFile = res.logFile || '';
    state.config.lastVersionId = id;
    toast('游戏启动中，PID ' + res.pid, 'success');
  } catch (e) {
    toast(e.message || '启动失败', 'error');
    showErrorModal('启动失败', e.message || '未知错误');
  } finally {
    state.launching = false;
    render();
  }
}

async function doStop() {
  try {
    const res = await api.killGame();
    if (res.ok) toast('已请求结束游戏进程');
    else toast(res.error || '没有正在运行的游戏', 'error');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function selectVersion(id) {
  state.config.lastVersionId = id;
  await api.patchConfig({ lastVersionId: id });
  state.resourceVersionId = id;
  toast('已切换到 ' + id);
  render();
}

function openLoaderModal(mcVersion) {
  openModal({
    title: '安装模组加载器',
    desc: '为原版 ' + mcVersion + ' 安装加载器。Fabric / Quilt 直接写入版本；Forge / NeoForge 会调用官方安装器，可能需要几分钟。',
    body: '<div class="loader-choices">' +
      ['Fabric', 'Quilt', 'Forge', 'NeoForge'].map((name) =>
        '<button class="loader-choice" data-action="install-loader" data-type="' + name.toLowerCase() +
        '" data-mc="' + esc(mcVersion) + '"><strong>' + name + '</strong><span>' +
        (name === 'Fabric' ? '轻量、生态最大' : name === 'Quilt' ? 'Fabric 分支' : name === 'Forge' ? '老牌加载器' : 'Forge 新分支') +
        '</span></button>').join('') + '</div>',
    actions: [{ label: '取消', kind: 'ghost', action: 'close-modal' }]
  });
}

async function installLoader(type, mc) {
  closeModal();
  toast('开始安装 ' + type + '，进度见右下角任务', '');
  try {
    const res = await api.installLoader(type, mc);
    if (!res.ok) throw new Error(res.error || '安装失败');
    state.installed = res.installed;
    if (res.result.versionId) state.config.lastVersionId = res.result.versionId;
    toast(res.result.message || '加载器安装完成', 'success');
  } catch (e) {
    toast(e.message || '加载器安装失败', 'error');
    showErrorModal('加载器安装失败', e.message || '');
  } finally {
    render();
  }
}

async function importFolder() {
  const res = await api.importFolder();
  if (res.canceled) return;
  state.config.gameDir = res.gameDir;
  state.installed = res.installed;
  state.config.lastVersionId = res.installed[0] ? res.installed[0].id : '';
  toast('已导入游戏目录，识别到 ' + res.installed.length + ' 个版本', 'success');
  state.page = 'versions';
  render();
}

async function importModpack() {
  const pick = await api.chooseModpack();
  if (pick.canceled) return;
  toast('正在导入整合包，进度见右下角', '');
  const res = await api.importModpack(pick.filePath);
  if (!res.ok) {
    toast(res.error || '导入失败', 'error');
    showErrorModal('整合包导入失败', res.error || '');
    return;
  }
  state.installed = res.installed;
  if (res.result.versionId) state.config.lastVersionId = res.result.versionId;
  state.modpackResult = res.result.message;
  state.page = 'modpacks';
  toast(res.result.message, 'success');
  render();
}

async function loadContent() {
  if (state.resourceKind === 'recommend') return;
  const vid = state.resourceVersionId || currentVersionId();
  if (!vid) { state.contentData = null; return; }
  state.resourceVersionId = vid;
  state.contentLoading = true;
  state.contentError = '';
  try {
    if (state.resourceKind === 'modpack') {
      state.contentData = null;
      return;
    }
    const res = await api.listContent(state.resourceKind, vid);
    if (!res.ok) throw new Error(res.error || '读取失败');
    state.contentData = res.data;
    if (state.resourceKind === 'datapack') {
      state.worlds = res.data.worlds || [];
      if (!state.worlds.some((w) => w.name === state.resourceWorld)) {
        state.resourceWorld = state.worlds[0] ? state.worlds[0].name : '';
      }
    }
  } catch (e) {
    state.contentError = e.message;
  } finally {
    state.contentLoading = false;
  }
}

async function doSearch() {
  if (state.resourceSearching) return;
  const input = $('resourceSearch');
  if (input) state.resourceQuery = input.value.trim();
  state.resourceSearching = true;
  state.resourceError = '';
  state.resourceFallback = false;
  render();
  try {
    const vid = state.resourceVersionId || currentVersionId();
    const res = await api.searchContent(state.resourceKind, state.resourceQuery,
      gameVersionOf(vid), loaderOf(vid));
    if (!res.ok) throw new Error(res.error || '搜索失败');
    state.resourceHits = res.hits || [];
    state.resourceFallback = !!res.fallback;
    if (!state.resourceHits.length) state.resourceError = '没有匹配结果，换个关键词或检查版本过滤。';
  } catch (e) {
    state.resourceError = e.message;
  } finally {
    state.resourceSearching = false;
    render();
  }
}

async function installResource(projectId, projectOverride, kindOverride) {
  const project = projectOverride || state.resourceHits.find((h) => h.project_id === projectId);
  if (!project) return;
  const kind = kindOverride || state.resourceKind;
  const vid = state.resourceVersionId || currentVersionId();
  if (!vid) { toast('请先安装或选择一个版本', 'error'); return; }
  if (kind === 'datapack' && !state.resourceWorld) {
    toast('请先选择一个存档', 'error');
    return;
  }
  state.installing = projectId;
  render();
  try {
    let res;
    if (kind === 'modpack') {
      res = await api.downloadModpack(project, { gameVersion: gameVersionOf(vid) });
      if (res.ok) {
        state.installed = res.installed;
        state.modpackResult = res.result.message;
        if (res.result.versionId) state.config.lastVersionId = res.result.versionId;
      }
    } else {
      res = await api.installContent(kind, project, {
        versionId: vid,
        gameVersion: gameVersionOf(vid),
        loader: loaderOf(vid),
        world: state.resourceWorld
      });
    }
    if (!res.ok) throw new Error(res.error || '安装失败');
    toast((state.resourceKind === 'modpack' ? '整合包安装完成' : project.title + ' 已安装'), 'success');
    if (state.resourceKind === 'modpack') {
      state.page = 'modpacks';
    } else if (state.resourceKind === 'recommend') {
      await loadRecommendations(true);
    } else {
      await loadContent();
    }
  } catch (e) {
    toast(e.message || '安装失败', 'error');
    showErrorModal('安装失败', e.message || '');
  } finally {
    state.installing = '';
    render();
  }
}

async function toggleContent(kind, filePath, enabled) {
  const res = await api.toggleContent(kind, filePath, enabled);
  if (!res.ok) { toast(res.error || '操作失败', 'error'); return; }
  toast(res.enabled ? '已启用' : '已禁用');
  await loadContent();
  render();
}

async function removeContent(kind, filePath, name) {
  if (!confirm('确定删除「' + name + '」？文件会从磁盘删除，不可恢复。')) return;
  const res = await api.removeContent(kind, filePath);
  if (!res.ok) { toast(res.error || '删除失败', 'error'); return; }
  toast('已删除');
  await loadContent();
  render();
}

async function loginOffline() {
  const input = $('offlineName');
  const name = input ? input.value.trim() : '';
  try {
    const res = await api.loginOffline(name);
    if (!res.ok) throw new Error(res.error || '登录失败');
    state.accounts = res.accounts;
    state.activeAccountId = res.activeAccountId;
    accountError = '';
    toast('离线账户已添加', 'success');
    render();
  } catch (e) {
    accountError = e.message;
    render();
  }
}

async function loginMicrosoft() {
  if (state.msBusy) return;
  state.msBusy = true;
  accountError = '';
  render();
  try {
    const res = await api.loginMicrosoft(state.config.msClientId);
    if (!res.ok) throw new Error(res.error || '登录失败');
    state.accounts = res.accounts;
    state.activeAccountId = res.activeAccountId;
    toast('微软账户登录成功', 'success');
  } catch (e) {
    accountError = e.message;
    toast(e.message || '微软登录失败', 'error');
  } finally {
    state.msBusy = false;
    render();
  }
}

async function loginThird() {
  const server = $('thirdServer') ? $('thirdServer').value.trim() : '';
  const username = $('thirdUser') ? $('thirdUser').value.trim() : '';
  const password = $('thirdPass') ? $('thirdPass').value : '';
  try {
    const res = await api.loginThirdParty(server, username, password);
    if (!res.ok) throw new Error(res.error || '登录失败');
    state.accounts = res.accounts;
    state.activeAccountId = res.activeAccountId;
    accountError = '';
    toast('第三方账户已添加', 'success');
    render();
  } catch (e) {
    accountError = e.message;
    render();
  }
}

async function selectAccount(id) {
  const res = await api.selectAccount(id);
  if (res.ok) {
    state.activeAccountId = id;
    toast('已切换账户');
    render();
  }
}

async function removeAccount(id) {
  if (!confirm('确定移除这个账户？')) return;
  const res = await api.removeAccount(id);
  if (res.ok) {
    state.accounts = res.accounts;
    state.activeAccountId = res.activeAccountId;
    toast('账户已移除');
    render();
  }
}

async function refreshAccount(id) {
  const res = await api.refreshAccount(id);
  if (!res.ok) { toast(res.error || '刷新失败', 'error'); return; }
  state.accounts = res.accounts;
  toast('凭据已刷新', 'success');
  render();
}

async function chooseGameDir() {
  const res = await api.chooseGameDir();
  if (res.canceled) return;
  state.config.gameDir = res.gameDir;
  state.installed = res.installed;
  toast('游戏目录已切换', 'success');
  render();
}

async function chooseJava() {
  const res = await api.chooseJava();
  if (res.canceled) return;
  state.java = res.java;
  toast('Java 已更新', 'success');
  render();
}

async function detectJava() {
  const list = await api.detectJava();
  state.javaList = list;
  if (!list.length) { toast('没有自动检测到 Java，可手动选择或下载', 'error'); return; }
  openModal({
    title: '检测到 ' + list.length + ' 个 Java',
    desc: '选择用于启动游戏的 Java。版本不满足时会提示。',
    body: '<div class="loader-choices">' + list.map((j) =>
      '<button class="loader-choice" data-action="pick-java" data-path="' + esc(j.path) + '">' +
      '<strong>Java ' + j.major + '</strong><span>' + esc(j.version) + ' · ' + esc(j.path) + '</span></button>').join('') + '</div>',
    actions: [{ label: '取消', kind: 'ghost', action: 'close-modal' }]
  });
}

async function pickJava(path) {
  closeModal();
  try {
    const res = await api.setJava(path);
    if (!res.ok) throw new Error(res.error || '设置失败');
    state.java = res.java;
    toast('已选择 Java ' + res.java.major, 'success');
    render();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function downloadJava(major) {
  toast('开始下载 Java ' + major + '，进度见右下角');
  const res = await api.downloadJava(major);
  if (!res.ok) { toast(res.error || '下载失败', 'error'); return; }
  state.java = res.java;
  toast('Java ' + major + ' 已安装', 'success');
  render();
}

async function setTheme(color) {
  state.config.accent = color;
  applyAccent(color);
  await api.patchConfig({ accent: color });
  toast('主题色已更新');
  render();
}

async function openLogs() {
  if (state.launchLogFile) await api.showItem(state.launchLogFile);
  else await api.openPath(state.config.gameDir);
}

async function loadLatestLog() {
  try {
    state.latestLog = await api.latestLog();
  } catch {
    state.latestLog = '';
  }
  if (state.page === 'logs') render();
}

async function copyLog() {
  const text = state.logLines.length
    ? state.logLines.map((l) => '[' + l.level + '] ' + l.text).join('\n')
    : state.latestLog;
  if (!text) { toast('没有可复制的日志', 'error'); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast('日志已复制', 'success');
  } catch {
    toast('复制失败', 'error');
  }
}

/* ---------------- Modal / bindings ---------------- */

function openModal({ title, desc, body, actions, className }) {
  const root = $('modalRoot');
  root.classList.add('open');
  root.innerHTML = '<div class="modal' + (className ? ' ' + className : '') + '"><h3>' + esc(title) + '</h3>' +
    (desc ? '<div class="modal-desc">' + esc(desc) + '</div>' : '') +
    (body || '') +
    '<div class="modal-actions">' + (actions || []).map((a) =>
      '<button class="btn ' + (a.kind === 'primary' ? 'btn-primary' : 'btn-ghost') + '" data-action="' +
      esc(a.action) + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
}

function closeModal() {
  state.noticeOpenId = '';
  clearNoticeRetry();
  const root = $('modalRoot');
  root.classList.remove('open');
  root.innerHTML = '';
}

function redactSensitive(text) {
  return String(text || '')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '<redacted-jwt>')
    .replace(/(access[_-]?token|refresh[_-]?token|authorization|bearer|client[_-]?secret)\s*[:=]\s*[^\s,;]+/gi,
      '$1=<redacted>')
    .replace(/[A-Za-z0-9+/_-]{120,}={0,2}/g, '<redacted-long-token>');
}

function feedbackLogTail(limit = 3000) {
  const raw = state.latestLog || (state.logLines || []).map((l) => l.text).join('\n');
  if (!raw) return '（没有可用日志）';
  return redactSensitive(raw.split(/\r?\n/).slice(-80).join('\n')).slice(-limit);
}

function feedbackSystemInfo() {
  const account = currentAccount();
  const java = state.java;
  return [
    'EMCL ' + (state.appVersion || '1.26.25.09'),
    '通道: 发布版',
    '系统: ' + (navigator.userAgent || navigator.platform || ''),
    'Java: ' + (java && java.ok ? (java.version + ' / ' + java.path) : '未检测到'),
    '当前版本: ' + (currentVersionId() || '无'),
    '账户类型: ' + (account ? accountKind(account.kind) : '未登录'),
    '内存设置: ' + (state.config ? (state.config.minMemory + ' - ' + state.config.maxMemory + ' MB') : '')
  ].join('\n');
}

function buildFeedbackReport() {
  const type = $('feedbackType') ? $('feedbackType').value : '其他';
  const title = $('feedbackTitle') ? $('feedbackTitle').value.trim() : '';
  const detail = $('feedbackDetail') ? $('feedbackDetail').value.trim() : '';
  const includeLog = $('feedbackIncludeLog') ? $('feedbackIncludeLog').checked : true;
  const body = [
    '### 问题描述',
    detail || '（请补充复现步骤、期望结果和实际结果）',
    '',
    '### 环境信息',
    '```text',
    feedbackSystemInfo(),
    '```',
    includeLog ? '\n### 最近日志\n```text\n' + feedbackLogTail() + '\n```' : ''
  ].join('\n');
  return { type, title: title || (type + '反馈'), body };
}

function openFeedbackModal() {
  const previewLines = (state.latestLog || '').split(/\r?\n/).filter(Boolean).length;
  openModal({
    title: '提交错误 / 反馈',
    desc: '生成一份带环境信息和日志的报告。可以直接复制，或打开 GitHub 预填 Issue 后提交。',
    className: 'feedback-modal',
    body: '<div class="field"><label>问题类型</label><select class="select" id="feedbackType">' +
      '<option>启动失败</option><option>安装失败</option><option>模组 / 光影问题</option>' +
      '<option>界面问题</option><option>其他</option></select></div>' +
      '<div class="field"><label>标题</label><input class="input" id="feedbackTitle" maxlength="100" placeholder="例如：启动 Forge 1.20.1 时报错" /></div>' +
      '<div class="field"><label>复现步骤 / 问题描述</label><textarea class="input" id="feedbackDetail" rows="5" placeholder="1. 打开...&#10;2. 点击...&#10;3. 出现..."></textarea></div>' +
      '<label class="check-line"><input type="checkbox" id="feedbackIncludeLog" checked />附加最近启动日志（约 ' +
      (previewLines || 0) + ' 行，自动截断）</label>' +
      '<div class="card-subtitle" style="margin-top:8px">报告不包含账户 Token；只包含版本、Java、系统、当前游戏版本和日志尾部。</div>',
    actions: [
      { label: '取消', kind: 'ghost', action: 'close-modal' },
      { label: '复制报告', kind: 'ghost', action: 'copy-feedback' },
      { label: '打开 GitHub 提交', kind: 'primary', action: 'submit-feedback' }
    ]
  });
}

async function copyFeedbackReport() {
  const report = buildFeedbackReport();
  const text = '## ' + report.title + '\n\n' + report.body;
  try {
    await navigator.clipboard.writeText(text);
    toast('错误报告已复制，可粘贴到任意反馈渠道', 'success');
  } catch {
    toast('复制失败', 'error');
  }
}

async function submitFeedback() {
  const report = buildFeedbackReport();
  const body = report.body.slice(0, 6000);
  const title = '[Bug] ' + report.title.slice(0, 80);
  const url = 'https://github.com/MC-Enderman7810/EndermanMineCraftLauncher/issues/new' +
    '?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  const res = await api.openUpdate(url);
  if (!res || !res.ok) {
    toast((res && res.error) || '打开 GitHub 失败，请先复制报告', 'error');
    return;
  }
  toast('已打开 GitHub，请检查内容后点击提交', 'success');
}

function showErrorModal(title, message) {
  openModal({
    title,
    desc: message,
    body: '<div class="card" style="background:#FBFDFF;box-shadow:none;padding:12px">' +
      '<div class="card-subtitle">可以到「日志」页复制完整输出；如果缺少 Java，请先在设置中下载或选择 Java。</div></div>',
    actions: [
      { label: '查看日志', kind: 'ghost', action: 'goto-logs' },
      { label: '知道了', kind: 'primary', action: 'close-modal' }
    ]
  });
}

function bind() {
  $('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav]');
    if (btn) setPage(btn.dataset.nav);
  });
  $('accountMini').addEventListener('click', () => setPage('accounts'));
  $('accountChip').addEventListener('click', () => setPage('accounts'));
  $('feedbackChip').addEventListener('click', () => openFeedbackModal());
  $('updateChip').addEventListener('click', () => showUpdateModal());
  $('noticeChip').addEventListener('click', () => setPage('home'));

  $('winMin').addEventListener('click', () => api.windowMinimize());
  $('winMax').addEventListener('click', () => api.windowMaximize());
  $('winClose').addEventListener('click', () => api.windowClose());

  $('content').addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.tagName === 'BUTTON' && el.disabled) return;
    try { await handleAction(el.dataset.action, el); }
    catch (err) { toast(err.message || '操作失败', 'error'); }
  });

  $('content').addEventListener('change', async (e) => {
    if (e.target.id === 'homeVersion') {
      await selectVersion(e.target.value);
      return;
    }
    const el = e.target.closest('[data-change]');
    if (el) {
      const key = el.dataset.change;
      if (key === 'resource-version') {
        state.resourceVersionId = el.value;
        state.resourceHits = [];
        if (state.resourceKind === 'recommend') await loadRecommendations(true);
        else await loadContent();
        render();
      } else if (key === 'resource-world') {
        state.resourceWorld = el.value;
        render();
      } else if (key === 'maxMemory' || key === 'minMemory') {
        await patchSetting(key, Number(el.value));
      } else if (key === 'isolation' || key === 'closeAfterLaunch') {
        await patchSetting(key, el.checked);
      } else if (key === 'downloadSource' || key === 'gc' || key === 'jvmArgs' ||
        key === 'msClientId' || key === 'msAuthority') {
        await patchSetting(key, el.value);
      }
      return;
    }
    const range = e.target.closest('[data-range]');
    if (range) {
      const key = range.dataset.range;
      const label = $(key + 'Label');
      if (label) label.textContent = range.value + ' MB';
      await patchSetting(key, Number(range.value));
    }
  });

  $('content').addEventListener('input', (e) => {
    const range = e.target.closest('[data-range]');
    if (range) {
      const label = $(range.dataset.range + 'Label');
      if (label) label.textContent = range.value + ' MB';
    }
    if (e.target.id === 'versionSearch') {
      state.versionQuery = e.target.value;
    }
  });

  $('content').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'versionSearch') {
      state.versionQuery = e.target.value;
      render();
    }
    if (e.key === 'Enter' && e.target.id === 'resourceSearch') {
      doSearch();
    }
    if (e.key === 'Enter' && e.target.id === 'serverCommand') {
      sendServerCommand();
    }
  });

  $('modalRoot').addEventListener('click', async (e) => {
    if (e.target === $('modalRoot')) {
      if (state.noticeOpenId) return;
      closeModal();
      return;
    }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    try { await handleAction(el.dataset.action, el); }
    catch (err) { toast(err.message || '操作失败', 'error'); }
  });
}

async function patchSetting(key, value) {
  try {
    const res = await api.patchConfig({ [key]: value });
    state.config = res.config;
    applyAccent(state.config.accent);
    if (key === 'gameDir') toast('游戏目录已更新');
  } catch (e) {
    toast(e.message || '保存失败', 'error');
  }
}

(async function init() {
  bind();
  try {
    const s = await api.getState();
    state.config = s.config;
    state.accounts = s.accounts;
    state.activeAccountId = s.activeAccountId;
    state.installed = s.installed;
    state.java = s.java;
    state.appVersion = s.appVersion || '';
    state.tasks = s.tasks || [];
    state.resourceVersionId = currentVersionId();
    state.firstRun = s.config.firstRun;
    state.page = 'home';
    render();
    loadLatestLog();
    loadAnnouncements(false);
    loadServers();
    checkForUpdates(false, false);
    if (!state.installed.length) {
      // 首次启动不自动拉清单，避免无网络时卡住
    }
  } catch (e) {
    document.getElementById('content').innerHTML = '<div class="card">' + emptyState('启动器初始化失败：' + e.message, 'info') + '</div>';
  }

  api.onServerLog(({ id, line }) => {
    if (id !== state.serverId) return;
    state.serverLogs.push(line);
    state.serverLogs = state.serverLogs.slice(-300);
    if (state.page === 'servers') render();
  });
  api.onServerState(() => loadServers());

  api.onTask((task) => {
    const index = state.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) state.tasks[index] = task;
    else state.tasks.unshift(task);
    renderTasks();
    if (task.state === 'done' && /install|loader|modpack|content/.test(task.id)) {
      setTimeout(async () => {
        try {
          state.installed = await api.listInstalled();
          render();
        } catch { /* ignore */ }
      }, 800);
    }
  });

  api.onLaunchLog((line) => {
    state.logLines.push(line);
    if (state.logLines.length > 600) state.logLines.shift();
    if (state.page === 'logs') {
      const box = $('logBox');
      if (box) {
        const span = document.createElement('span');
        span.className = 'log-line ' + (line.level === 'err' ? 'err' : 'out');
        span.textContent = line.text;
        box.appendChild(span);
        box.scrollTop = box.scrollHeight;
      }
    }
  });

  api.onLaunchExit((info) => {
    state.gameRunning = false;
    state.launching = false;
    if (info && info.code === 0) toast('游戏已退出', 'success');
    else toast('游戏进程结束，退出码 ' + (info ? info.code : '?'), '');
    render();
  });

  api.onVersionsChanged((installed) => {
    state.installed = installed;
    render();
  });

  api.onWindowMaximized(() => {});

  api.onUpdateStatus((update) => {
    if (!update) return;
    state.update = update;
    state.updateChecking = false;
    if (update.hasUpdate && state.notifiedUpdate !== update.latest) {
      state.notifiedUpdate = update.latest;
      toast('发现新版本 ' + update.latest, 'success');
    }
    render();
  });

  api.onAnnouncements((result) => {
    if (!result || !result.ok) return;
    state.announcements = result.items || [];
    if (unseenAnnouncements().length) scheduleAnnouncementPopup();
    render();
  });
})();
