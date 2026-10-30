'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { app } = require('electron');
const { readJson, writeJson, ensureDir, exists } = require('./util');
const { isDev } = require('./channel');

const DEFAULT_MS_CLIENT_ID = 'c540f4df-4a1d-4d3b-b587-6c626b8ba692';
const PUBLIC_MS_CLIENT_ID = '00000000402b5328';
const APPROVED_MS_CLIENT_ID = '46c5d0e7-080d-4d20-ab2c-2b515e8edc72';

class Store {
  constructor() {
    this.root = app.getPath('userData');
    this.configFile = path.join(this.root, 'config.json');
    this.accountsFile = path.join(this.root, 'accounts.json');
    this.localAnnouncementsFile = path.join(this.root, 'local-announcements.json');
    this.logsDir = path.join(this.root, 'logs');
    this.cacheDir = path.join(this.root, 'cache');
    this.config = null;
    this.accounts = [];
  }

  async init() {
    // 早期测试版的配置目录迁移（lapis-launcher -> emcl-launcher）
    try {
      const legacy = path.join(app.getPath('appData'), 'lapis-launcher');
      const hasNew = fs.existsSync(path.join(this.root, 'config.json'));
      if (!hasNew && fs.existsSync(legacy)) {
        await fsp.cp(legacy, this.root, { recursive: true, force: false }).catch(() => {});
      }
    } catch { /* ignore */ }
    await ensureDir(this.root);
    await ensureDir(this.logsDir);
    await ensureDir(this.cacheDir);
    const defaults = this.defaultConfig();
    const loaded = await readJson(this.configFile, {});
    this.config = this.mergeConfig(defaults, loaded || {});
    // 首次启动时优先复用官方 / PCL2 常用的 %APPDATA%\.minecraft，避免用户还要手动导入
    if (!loaded || !loaded.gameDir) {
      const official = path.join(app.getPath('appData'), '.minecraft');
      if (await exists(path.join(official, 'versions'))) {
        this.config.gameDir = official;
      }
    }
    if (!await exists(this.config.gameDir)) {
      await ensureDir(this.config.gameDir);
    }
    this.accounts = await readJson(this.accountsFile, []);
    if (!Array.isArray(this.accounts)) this.accounts = [];
    await this.saveConfig();
    return this.config;
  }

  defaultConfig() {
    return {
      gameDir: path.join(this.root, '.minecraft'),
      javaPath: '',
      maxMemory: 4096,
      minMemory: 1024,
      jvmArgs: '',
      gc: 'G1GC',
      downloadSource: 'bmclapi',
      isolation: false,
      accent: '#2F7FD1',
      colorMode: 'light',
      msClientId: APPROVED_MS_CLIENT_ID,
      msAuthority: 'entra',
      authMigratedToApproved: true,
      localAdmin: isDev,
      developerEdition: isDev,
      announcerToken: '',
      seenAnnouncements: [],
      showSnapshots: true,
      showOldVersions: false,
      closeAfterLaunch: false,
      lastVersionId: '',
      lastAccountId: '',
      versionNames: {},
      firstRun: true
    };
  }

  mergeConfig(defaults, loaded) {
    const out = Object.assign({}, defaults);
    for (const key of Object.keys(defaults)) {
      if (loaded[key] !== undefined && loaded[key] !== null) out[key] = loaded[key];
    }
    out.maxMemory = Math.max(512, Number(out.maxMemory) || 4096);
    out.minMemory = Math.max(256, Number(out.minMemory) || 1024);
    if (out.minMemory > out.maxMemory) out.minMemory = Math.min(1024, out.maxMemory);
    if (!out.gameDir || typeof out.gameDir !== 'string') out.gameDir = defaults.gameDir;
    if (!out.accent || !/^#[0-9a-fA-F]{6}$/.test(out.accent)) out.accent = defaults.accent;
    out.localAdmin = isDev;
    out.developerEdition = isDev;
    // 把旧版公共 Live 配置迁移到已获 Mojang allowlist 的自有 appID。
    if (out.msClientId === PUBLIC_MS_CLIENT_ID && out.msAuthority !== 'entra') {
      out.msClientId = APPROVED_MS_CLIENT_ID;
      out.msAuthority = 'entra';
    }
    out.authMigratedToApproved = true;
    out.msAuthority = out.msAuthority === 'entra' ? 'entra' : 'live';
    if (!out.msClientId) out.msClientId = APPROVED_MS_CLIENT_ID;
    if (!Array.isArray(out.seenAnnouncements)) out.seenAnnouncements = [];
    return out;
  }

  getConfig() {
    return this.config;
  }

  async saveConfig() {
    await writeJson(this.configFile, this.config);
    return this.config;
  }

  async patchConfig(patch) {
    this.config = this.mergeConfig(this.config, Object.assign({}, this.config, patch || {}));
    await this.saveConfig();
    return this.config;
  }

  getAccounts() {
    return this.accounts.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      uuid: a.uuid,
      server: a.server || '',
      skinModel: a.skinModel || 'steve',
      avatarSeed: a.avatarSeed || a.name,
      expiresAt: a.expiresAt || 0
    }));
  }

  getAccountFull(id) {
    return this.accounts.find((a) => a.id === id) || null;
  }

  async saveAccounts() {
    await writeJson(this.accountsFile, this.accounts);
  }

  async addAccount(account) {
    const index = this.accounts.findIndex((a) => a.id === account.id);
    if (index >= 0) this.accounts[index] = account;
    else this.accounts.push(account);
    await this.saveAccounts();
    this.config.lastAccountId = account.id;
    await this.saveConfig();
    return this.getAccounts();
  }

  async removeAccount(id) {
    this.accounts = this.accounts.filter((a) => a.id !== id);
    if (this.config.lastAccountId === id) {
      this.config.lastAccountId = this.accounts[0] ? this.accounts[0].id : '';
      await this.saveConfig();
    }
    await this.saveAccounts();
    return this.getAccounts();
  }

  async selectAccount(id) {
    this.config.lastAccountId = id;
    await this.saveConfig();
  }

  async updateAccount(account) {
    const index = this.accounts.findIndex((a) => a.id === account.id);
    if (index >= 0) this.accounts[index] = account;
    else this.accounts.push(account);
    await this.saveAccounts();
    return account;
  }

  activeAccount() {
    return this.getAccountFull(this.config.lastAccountId) || this.accounts[0] || null;
  }

  async loadLocalAnnouncements() {
    const list = await readJson(this.localAnnouncementsFile, []);
    return Array.isArray(list) ? list : [];
  }

  async saveLocalAnnouncements(list) {
    const safe = Array.isArray(list) ? list.slice(0, 100) : [];
    await writeJson(this.localAnnouncementsFile, safe);
    return safe;
  }

  defaultLogFile() {
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + '_' + String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
    return path.join(this.logsDir, 'launch-' + stamp + '.log');
  }

  readLatestLog() {
    try {
      const files = fs.readdirSync(this.logsDir)
        .filter((n) => n.endsWith('.log'))
        .sort()
        .reverse();
      if (!files.length) return '';
      return fs.readFileSync(path.join(this.logsDir, files[0]), 'utf8');
    } catch {
      return '';
    }
  }
}

module.exports = { Store, DEFAULT_MS_CLIENT_ID };
