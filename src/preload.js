'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const listener = (event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('emcl', {
  getState: () => ipcRenderer.invoke('app:state'),
  patchConfig: (patch) => ipcRenderer.invoke('config:patch', patch),
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  chooseGameDir: () => ipcRenderer.invoke('dialog:gameDir'),
  chooseJava: () => ipcRenderer.invoke('dialog:java'),
  chooseModpack: () => ipcRenderer.invoke('dialog:modpack'),
  openPath: (target) => ipcRenderer.invoke('shell:openPath', target),
  showItem: (target) => ipcRenderer.invoke('shell:showItem', target),

  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  listVersions: (force) => ipcRenderer.invoke('versions:list', force),
  listInstalled: () => ipcRenderer.invoke('versions:installed'),
  installVersion: (versionId, url) => ipcRenderer.invoke('versions:install', versionId, url),
  installVersionWithLoader: (versionId, url, loader, shader) =>
    ipcRenderer.invoke('versions:installWithLoader', versionId, url, loader, shader),
  repairVersion: (versionId) => ipcRenderer.invoke('versions:repair', versionId),
  installLoader: (type, mcVersion) => ipcRenderer.invoke('loader:install', type, mcVersion),

  launch: (versionId) => ipcRenderer.invoke('launch:start', versionId),
  killGame: () => ipcRenderer.invoke('launch:kill'),
  launchCommand: (versionId) => ipcRenderer.invoke('launch:command', versionId),

  detectJava: () => ipcRenderer.invoke('java:detect'),
  downloadJava: (major) => ipcRenderer.invoke('java:download', major),
  setJava: (javaPath) => ipcRenderer.invoke('java:set', javaPath),

  loginOffline: (name) => ipcRenderer.invoke('account:offline', name),
  loginMicrosoft: (clientId) => ipcRenderer.invoke('account:microsoft', clientId),
  loginThirdParty: (server, username, password) => ipcRenderer.invoke('account:third', server, username, password),
  refreshAccount: (id) => ipcRenderer.invoke('account:refresh', id),
  removeAccount: (id) => ipcRenderer.invoke('account:remove', id),
  selectAccount: (id) => ipcRenderer.invoke('account:select', id),
  getSkin: (force) => ipcRenderer.invoke('skin:get', force),

  searchContent: (kind, query, gameVersion, loader) =>
    ipcRenderer.invoke('content:search', kind, query, gameVersion, loader),
  installContent: (kind, project, options) => ipcRenderer.invoke('content:install', kind, project, options),
  listContent: (kind, versionId) => ipcRenderer.invoke('content:list', kind, versionId),
  listWorlds: (versionId) => ipcRenderer.invoke('content:worlds', versionId),
  toggleContent: (kind, filePath, enabled) => ipcRenderer.invoke('content:toggle', kind, filePath, enabled),
  removeContent: (kind, filePath) => ipcRenderer.invoke('content:remove', kind, filePath),

  importModpack: (filePath) => ipcRenderer.invoke('modpack:import', filePath),
  downloadModpack: (project, options) => ipcRenderer.invoke('modpack:download', project, options),
  importFolder: () => ipcRenderer.invoke('folder:import'),

  listTasks: () => ipcRenderer.invoke('tasks:list'),
  clearTasks: () => ipcRenderer.invoke('tasks:clear'),
  latestLog: () => ipcRenderer.invoke('logs:latest'),

  checkUpdates: (force) => ipcRenderer.invoke('updates:check', force),
  listAnnouncements: (force) => ipcRenderer.invoke('updates:announcements', force),
  openUpdate: (url) => ipcRenderer.invoke('updates:open', url),

  onTask: (callback) => on('task:update', callback),
  onLaunchLog: (callback) => on('launch:log', callback),
  onLaunchExit: (callback) => on('launch:exit', callback),
  onVersionsChanged: (callback) => on('versions:changed', callback),
  onWindowMaximized: (callback) => on('window:maximized', callback),
  onUpdateStatus: (callback) => on('update:status', callback),
  onAnnouncements: (callback) => on('announcements:changed', callback)
});
