'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const { Store } = require('./store');
const {
  fetchManifest, scanInstalled, installVersion, repairVersion, getWorlds, instanceDir
} = require('./minecraft');
const { installLoader } = require('./loader');
const { launchGame, buildLaunch } = require('./launch');
const auth = require('./auth');
const modrinth = require('./modrinth');
const content = require('./content');
const modpack = require('./modpack');
const { exists, ensureDir, formatBytes } = require('./util');
const java = require('./java');
const updater = require('./updater');
const skin = require('./skin');

app.setName('EMCL');
app.setPath('userData', path.join(app.getPath('appData'), 'emcl-launcher'));
const APP_NAME = 'EMCL · Enderman MineCraft Launcher';
let store = null;
let mainWindow = null;
let currentGame = null;
let manifestCache = null;
let manifestCacheAt = 0;
let updateTimer = null;
const tasks = new Map();

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function updateTask(id, title, percent, message, state = 'running') {
  const task = {
    id,
    title,
    percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
    message: message || '',
    state,
    updatedAt: Date.now()
  };
  tasks.set(id, task);
  send('task:update', task);
  return task;
}

function taskError(id, title, error) {
  updateTask(id, title, 0, error && error.message ? error.message : String(error), 'error');
  return { ok: false, error: error && error.message ? error.message : String(error) };
}

function taskDone(id, title, message) {
  updateTask(id, title, 100, message || '完成', 'done');
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.max(960, Math.min(1200, area.width - 60));
  const height = Math.max(640, Math.min(790, area.height - 60));
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(1000, width),
    minHeight: Math.min(640, height),
    center: true,
    frame: false,
    show: false,
    backgroundColor: '#EEF2F7',
    title: APP_NAME,
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('maximize', () => send('window:maximized', true));
  mainWindow.on('unmaximize', () => send('window:maximized', false));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function refreshInstalled() {
  const installed = await scanInstalled(store.getConfig().gameDir);
  return installed;
}

async function getManifest(force = false) {
  if (!force && manifestCache && Date.now() - manifestCacheAt < 5 * 60 * 1000) return manifestCache;
  const source = store.getConfig().downloadSource;
  try {
    manifestCache = await fetchManifest(source);
  } catch (error) {
    if (source === 'bmclapi') {
      manifestCache = await fetchManifest('mojang');
    } else {
      throw error;
    }
  }
  manifestCacheAt = Date.now();
  return manifestCache;
}

function pickJavaInfo(info) {
  if (!info) return null;
  return {
    path: info.path,
    version: info.version,
    major: info.major,
    arch: info.arch,
    ok: info.ok,
    required: info.required,
    source: info.source,
    tooOld: info.tooOld || false
  };
}

async function installShaderLoader(store, finalVersionId, mcVersion, loader, taskId, title) {
  // Forge 用 Oculus；Fabric / Quilt / NeoForge 用 Iris
  const projectId = loader === 'forge' ? 'oculus' : 'iris';
  const project = await modrinth.getProject(projectId);
  const config = store.getConfig();
  const instance = instanceDir(config, finalVersionId);
  updateTask(taskId, title, 92, '安装光影加载器 ' + (project.title || projectId));
  return modrinth.install('mod', project, {
    gameVersion: mcVersion,
    loader,
    instanceDir: instance,
    strict: true,
    onProgress: (received, total) => {
      const pct = total ? 92 + Math.min(6, received / total * 6) : 94;
      updateTask(taskId, title, pct, '下载 ' + (project.title || projectId));
    }
  });
}

function registerIpc() {
  ipcMain.handle('app:state', async () => {
    const installed = await refreshInstalled();
    const config = store.getConfig();
    const javaInfo = await java.resolveJava(store, config.lastVersionId || (installed[0] && installed[0].id) || '1.21.1');
    return {
      config,
      appVersion: app.getVersion(),
      accounts: store.getAccounts(),
      activeAccountId: config.lastAccountId,
      installed,
      java: pickJavaInfo(javaInfo),
      tasks: Array.from(tasks.values()).sort((a, b) => b.updatedAt - a.updatedAt)
    };
  });

  ipcMain.handle('config:patch', async (event, patch) => {
    const before = store.getConfig();
    const beforeDir = before.gameDir;
    const beforeSource = before.downloadSource;
    const config = await store.patchConfig(patch || {});
    if (config.gameDir !== beforeDir) {
      await ensureDir(config.gameDir);
      manifestCache = null;
    }
    if (config.downloadSource !== beforeSource) manifestCache = null;
    return { config };
  });

  ipcMain.handle('config:reset', async () => {
    const config = store.defaultConfig();
    store.config = config;
    await store.saveConfig();
    return { config };
  });

  ipcMain.handle('dialog:gameDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Minecraft 游戏文件夹（.minecraft）',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    let dir = result.filePaths[0];
    if (path.basename(dir).toLowerCase() !== '.minecraft' && await exists(path.join(dir, '.minecraft'))) {
      dir = path.join(dir, '.minecraft');
    }
    await store.patchConfig({ gameDir: dir });
    manifestCache = null;
    const installed = await refreshInstalled();
    return { canceled: false, gameDir: dir, installed };
  });

  ipcMain.handle('dialog:java', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 java.exe',
      properties: ['openFile'],
      filters: [{ name: 'Java', extensions: ['exe'] }]
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    const info = await java.inspectJava(result.filePaths[0]);
    if (!info.ok) throw new Error('该文件不是可用的 Java');
    await store.patchConfig({ javaPath: result.filePaths[0] });
    return { canceled: false, java: pickJavaInfo(info) };
  });

  ipcMain.handle('dialog:modpack', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择整合包',
      properties: ['openFile'],
      filters: [
        { name: '整合包', extensions: ['mrpack', 'zip'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    return { canceled: false, filePath: result.filePaths[0] };
  });

  ipcMain.handle('shell:openPath', async (event, target) => {
    if (!target || typeof target !== 'string') return '';
    return shell.openPath(target);
  });

  ipcMain.handle('shell:showItem', async (event, target) => {
    if (target && typeof target === 'string') shell.showItemInFolder(target);
  });

  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());

  ipcMain.handle('versions:list', async (event, force) => {
    const manifest = await getManifest(!!force);
    return manifest;
  });

  ipcMain.handle('versions:installed', async () => {
    return refreshInstalled();
  });

  ipcMain.handle('versions:install', async (event, versionId, url) => {
    const id = 'install:' + versionId;
    try {
      await updateTask(id, '安装 ' + versionId, 0, '准备中');
      const config = store.getConfig();
      const result = await installVersion(versionId, url, config.gameDir, config.downloadSource,
        (done, total, msg) => {
          updateTask(id, '安装 ' + versionId, total ? done / total * 100 : 0, msg);
        });
      taskDone(id, '安装 ' + versionId, '安装完成');
      await store.patchConfig({ lastVersionId: versionId });
      return { ok: true, result, installed: await refreshInstalled() };
    } catch (e) {
      return taskError(id, '安装 ' + versionId, e);
    }
  });

  ipcMain.handle('versions:installWithLoader', async (event, versionId, url, loader, shader) => {
    const rawLoader = String(loader || '').toLowerCase();
    const selected = (rawLoader === 'vanilla' || rawLoader === '原版' || rawLoader === 'none')
      ? '' : rawLoader;
    const withShader = shader === true;
    const taskId = 'install:' + versionId + (selected ? ':' + selected : '');
    try {
      await updateTask(taskId, '安装 ' + versionId, 0, selected ? '安装原版 + ' + selected : '安装原版');
      const config = store.getConfig();
      const result = await installVersion(versionId, url, config.gameDir, config.downloadSource,
        (done, total, msg) => {
          const pct = total ? done / total * (selected ? 68 : 100) : 0;
          updateTask(taskId, '安装 ' + versionId, pct, msg);
        });

      let finalVersionId = versionId;
      let loaderResult = null;
      let shaderResult = null;
      let shaderError = '';
      if (selected) {
        updateTask(taskId, '安装 ' + versionId, 70, '准备安装 ' + selected);
        const loaderEnd = withShader ? 90 : 100;
        loaderResult = await installLoader(store, selected, versionId, config.gameDir,
          (percent, msg) => {
            updateTask(taskId, '安装 ' + versionId,
              68 + Math.max(0, Math.min(100, percent)) * ((loaderEnd - 68) / 100),
              msg || ('安装 ' + selected));
          });
        if (loaderResult && loaderResult.versionId) finalVersionId = loaderResult.versionId;
      }

      if (withShader && selected) {
        try {
          shaderResult = await installShaderLoader(store, finalVersionId, versionId, selected,
            taskId, '安装 ' + versionId);
        } catch (e) {
          shaderError = e.message || '光影加载器安装失败';
          console.warn('[EMCL] shader loader failed:', shaderError);
        }
      } else if (withShader && !selected) {
        shaderError = '原版不能直接安装光影加载器，请先选择 Fabric / Quilt / Forge / NeoForge';
      }

      const shaderNote = shaderResult ? ' + 光影加载器' : (shaderError ? '（光影加载器未安装）' : '');
      taskDone(taskId, '安装 ' + versionId,
        '安装完成' + (loaderResult ? '：' + (loaderResult.message || selected) : '') + shaderNote +
        (shaderError ? '；' + shaderError : ''));
      await store.patchConfig({ lastVersionId: finalVersionId });
      return {
        ok: true,
        result,
        loader: loaderResult,
        shader: shaderResult,
        shaderError,
        versionId: finalVersionId,
        installed: await refreshInstalled()
      };
    } catch (e) {
      return taskError(taskId, '安装 ' + versionId, e);
    }
  });

  ipcMain.handle('versions:repair', async (event, versionId) => {
    const id = 'repair:' + versionId;
    try {
      await updateTask(id, '补全 ' + versionId, 0, '检查文件');
      const config = store.getConfig();
      await repairVersion(versionId, config.gameDir, config.downloadSource,
        (done, total, msg) => updateTask(id, '补全 ' + versionId, total ? done / total * 100 : 0, msg));
      taskDone(id, '补全 ' + versionId, '文件已补全');
      return { ok: true, installed: await refreshInstalled() };
    } catch (e) {
      return taskError(id, '补全 ' + versionId, e);
    }
  });

  ipcMain.handle('loader:install', async (event, type, mcVersion) => {
    const id = 'loader:' + type + ':' + mcVersion;
    try {
      await updateTask(id, '安装 ' + type, 0, '准备中');
      const config = store.getConfig();
      const result = await installLoader(store, type, mcVersion, config.gameDir,
        (percent, msg) => updateTask(id, '安装 ' + type, percent, msg));
      taskDone(id, '安装 ' + type, result.message);
      if (result.versionId) await store.patchConfig({ lastVersionId: result.versionId });
      return { ok: true, result, installed: await refreshInstalled() };
    } catch (e) {
      return taskError(id, '安装 ' + type, e);
    }
  });

  ipcMain.handle('launch:start', async (event, versionId) => {
    try {
      let account = store.activeAccount();
      if (!account) throw new Error('请先添加账户');
      if (account.kind === 1 && account.expiresAt && account.expiresAt < Date.now() + 60000) {
        account = await auth.refreshAccount(store, account);
        await store.updateAccount(account);
      }
      const result = await launchGame(store, versionId, account,
        (level, text) => send('launch:log', { level, text }),
        (code, signal) => {
          currentGame = null;
          send('launch:exit', { code, signal });
          if (code === 0) {
            refreshInstalled().then((installed) => send('versions:changed', installed)).catch(() => {});
          }
        });
      currentGame = result;
      await store.patchConfig({ lastVersionId: versionId });
      if (store.getConfig().closeAfterLaunch) {
        setTimeout(() => mainWindow && mainWindow.minimize(), 800);
      }
      return {
        ok: true,
        pid: result.pid,
        command: result.command,
        logFile: result.logFile
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('launch:kill', async () => {
    if (currentGame) {
      currentGame.stop();
      return { ok: true };
    }
    return { ok: false, error: '没有正在运行的游戏' };
  });

  ipcMain.handle('launch:command', async (event, versionId) => {
    try {
      const account = store.activeAccount();
      if (!account) throw new Error('请先添加账户');
      const built = await buildLaunch(store, versionId, account);
      return { ok: true, command: built.command, java: built.java.path, logFile: built.logFile };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('java:detect', async () => {
    const list = await java.findJavaCandidates();
    return list.map((j) => pickJavaInfo(j));
  });

  ipcMain.handle('java:download', async (event, major) => {
    const id = 'java:' + major;
    try {
      await updateTask(id, '安装 Java ' + major, 0, '准备中');
      const info = await java.ensureJava(store, Number(major), (p) => {
        updateTask(id, '安装 Java ' + major, p.percent || 0, p.message || '');
      });
      await store.patchConfig({ javaPath: info.path });
      taskDone(id, '安装 Java ' + major, 'Java ' + info.version + ' 已就绪');
      return { ok: true, java: pickJavaInfo(info) };
    } catch (e) {
      return taskError(id, '安装 Java ' + major, e);
    }
  });

  ipcMain.handle('java:set', async (event, javaPath) => {
    await store.patchConfig({ javaPath: javaPath || '' });
    const info = javaPath ? await java.inspectJava(javaPath) : null;
    if (info && !info.ok) throw new Error('该 Java 不可用');
    return { ok: true, java: pickJavaInfo(info) };
  });

  ipcMain.handle('account:offline', async (event, name) => {
    const account = auth.createOffline(name);
    await store.addAccount(account);
    return { ok: true, accounts: store.getAccounts(), activeAccountId: account.id };
  });

  ipcMain.handle('account:microsoft', async (event, clientId) => {
    try {
      const account = await auth.loginMicrosoft(store, mainWindow, clientId);
      await store.addAccount(account);
      return { ok: true, accounts: store.getAccounts(), activeAccountId: account.id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('account:third', async (event, server, username, password) => {
    try {
      const account = await auth.loginThirdParty(server, username, password);
      await store.addAccount(account);
      return { ok: true, accounts: store.getAccounts(), activeAccountId: account.id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('account:refresh', async (event, id) => {
    try {
      const account = store.getAccountFull(id);
      if (!account) throw new Error('账户不存在');
      const fresh = await auth.refreshAccount(store, account);
      await store.updateAccount(fresh);
      return { ok: true, accounts: store.getAccounts() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('account:remove', async (event, id) => {
    const accounts = await store.removeAccount(id);
    return { ok: true, accounts, activeAccountId: store.getConfig().lastAccountId };
  });

  ipcMain.handle('account:select', async (event, id) => {
    await store.selectAccount(id);
    return { ok: true, activeAccountId: id };
  });

  ipcMain.handle('skin:get', async (event, force) => {
    try {
      return await skin.getSkin(store, !!force);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('content:search', async (event, kind, query, gameVersion, loader) => {
    try {
      let hits = await modrinth.search(kind, query, gameVersion, loader);
      let fallback = false;
      if (!hits.length && (gameVersion || loader)) {
        hits = await modrinth.search(kind, query, '', '');
        fallback = true;
      }
      return { ok: true, hits, fallback };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('content:install', async (event, kind, project, options) => {
    const id = 'content:' + kind + ':' + project.project_id;
    try {
      await updateTask(id, '安装 ' + project.title, 0, '获取文件');
      const config = store.getConfig();
      const versionId = (options && options.versionId) || config.lastVersionId;
      const instance = instanceDir(config, versionId);
      const result = await modrinth.install(kind, project, {
        gameVersion: (options && options.gameVersion) || '',
        loader: (options && options.loader) || '',
        instanceDir: instance,
        world: options && options.world,
        onProgress: (received, total) => {
          updateTask(id, '安装 ' + project.title, total ? received / total * 100 : 0,
            '下载 ' + formatBytes(received));
        }
      });
      taskDone(id, '安装 ' + project.title, result.filename + ' 已安装');
      return { ok: true, result, files: await content.list(kind, config, versionId) };
    } catch (e) {
      return taskError(id, '安装 ' + project.title, e);
    }
  });

  ipcMain.handle('content:list', async (event, kind, versionId) => {
    try {
      return { ok: true, data: await content.list(kind, store.getConfig(), versionId) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('content:worlds', async (event, versionId) => {
    try {
      return { ok: true, worlds: await content.worlds(store.getConfig(), versionId) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('content:toggle', async (event, kind, filePath, enabled) => {
    try {
      const next = await content.toggle(kind, filePath, enabled);
      return { ok: true, enabled: next };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('content:remove', async (event, kind, filePath) => {
    try {
      const ok = await content.remove(filePath, store.getConfig().gameDir);
      return { ok };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('modpack:import', async (event, filePath) => {
    const id = 'modpack:' + Date.now();
    try {
      await updateTask(id, '导入整合包', 0, '准备中');
      const result = await modpack.importArchive(filePath, store, (p, msg) => {
        updateTask(id, '导入整合包', p, msg);
      });
      taskDone(id, '导入整合包', result.message);
      if (result.versionId) await store.patchConfig({ lastVersionId: result.versionId });
      return { ok: true, result, installed: await refreshInstalled() };
    } catch (e) {
      return taskError(id, '导入整合包', e);
    }
  });

  ipcMain.handle('modpack:download', async (event, project, options) => {
    const id = 'modpack:' + project.project_id;
    try {
      await updateTask(id, '安装整合包 ' + project.title, 0, '获取下载地址');
      const file = await modrinth.latestModpackFile(project, (options && options.gameVersion) || '');
      const result = await modpack.importFromUrl(file.file.url, file.file.filename, store, (p, msg) => {
        updateTask(id, '安装整合包 ' + project.title, p, msg);
      });
      taskDone(id, '安装整合包 ' + project.title, result.message);
      if (result.versionId) await store.patchConfig({ lastVersionId: result.versionId });
      return { ok: true, result, installed: await refreshInstalled() };
    } catch (e) {
      return taskError(id, '安装整合包 ' + project.title, e);
    }
  });

  ipcMain.handle('folder:import', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入 PCL2 / 官方启动器游戏文件夹',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    let dir = result.filePaths[0];
    if (path.basename(dir).toLowerCase() !== '.minecraft' && await exists(path.join(dir, '.minecraft'))) {
      dir = path.join(dir, '.minecraft');
    }
    await ensureDir(dir);
    await store.patchConfig({ gameDir: dir });
    manifestCache = null;
    return { canceled: false, gameDir: dir, installed: await refreshInstalled() };
  });

  ipcMain.handle('tasks:list', async () => Array.from(tasks.values()).sort((a, b) => b.updatedAt - a.updatedAt));
  ipcMain.handle('tasks:clear', async () => {
    for (const [id, task] of tasks.entries()) {
      if (task.state !== 'running') tasks.delete(id);
    }
    return Array.from(tasks.values());
  });

  ipcMain.handle('logs:latest', async () => store.readLatestLog());

  ipcMain.handle('updates:check', async (event, force) => {
    return updater.checkUpdates(!!force);
  });

  ipcMain.handle('updates:announcements', async (event, force) => {
    return updater.getAnnouncements(!!force);
  });

  ipcMain.handle('updates:open', async (event, url) => {
    try {
      await updater.openUpdate(url);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

async function autoCheck() {
  try {
    const [update, announcements] = await Promise.all([
      updater.checkUpdates(false),
      updater.getAnnouncements(false)
    ]);
    if (update && update.ok) send('update:status', update);
    if (announcements && announcements.ok) send('announcements:changed', announcements);
  } catch (error) {
    console.warn('[EMCL] auto update check failed:', error && error.message ? error.message : error);
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.emcl.launcher');
  store = new Store();
  await store.init();
  registerIpc();
  createWindow();
  setTimeout(autoCheck, 2500);
  updateTimer = setInterval(autoCheck, 6 * 60 * 60 * 1000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  dialog.showErrorBox('EMCL 启动失败', String(error && error.stack ? error.stack : error));
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  if (currentGame) {
    try { currentGame.stop(); } catch { /* ignore */ }
  }
});

process.on('uncaughtException', (error) => {
  console.error('[EMCL] uncaught', error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    send('launch:log', { level: 'err', text: '启动器内部错误：' + (error && error.stack ? error.stack : error) });
  }
});
