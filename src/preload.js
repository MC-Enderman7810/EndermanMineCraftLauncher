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
  installVersionWithLoader: (versionId, url, loader, shader, shaderType, loaderVersion, shaderVersion) =>
    ipcRenderer.invoke('versions:installWithLoader', versionId, url, loader, shader, shaderType, loaderVersion, shaderVersion),
  repairVersion: (versionId) => ipcRenderer.invoke('versions:repair', versionId),
  installLoader: (type, mcVersion) => ipcRenderer.invoke('loader:install', type, mcVersion),

  launch: (versionId, accountId) => ipcRenderer.invoke('launch:start', versionId, accountId),
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
  setCape: (capeId) => ipcRenderer.invoke('skin:setCape', capeId),
  disableCape: () => ipcRenderer.invoke('skin:disableCape'),
  recommendMods: (gameVersion, loader) => ipcRenderer.invoke('recommend:list', gameVersion, loader),

  searchContent: (kind, query, gameVersion, loader, source) =>
    ipcRenderer.invoke('content:search', kind, query, gameVersion, loader, source),
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
  listLocalAnnouncements: () => ipcRenderer.invoke('announcements:local:list'),
  saveLocalAnnouncement: (item) => ipcRenderer.invoke('announcements:local:save', item),
  deleteLocalAnnouncement: (id) => ipcRenderer.invoke('announcements:local:delete', id),

  serverList: () => ipcRenderer.invoke('servers:list'),
  serverPick: () => ipcRenderer.invoke('servers:pick'),
  serverChooseDir: () => ipcRenderer.invoke('servers:chooseDir'),
  serverCreateLocal: (data) => ipcRenderer.invoke('servers:createLocal', data),
  serverAddLocal: (dir, name, jar, memory, javaPath) => ipcRenderer.invoke('servers:addLocal', dir, name, jar, memory, javaPath),
  serverAddRemote: (data) => ipcRenderer.invoke('servers:addRemote', data),
  serverRecommend: (type) => ipcRenderer.invoke('servers:recommend', type),
  serverRecommendTypes: () => ipcRenderer.invoke('servers:recommendTypes'),
  serverStatus: (id) => ipcRenderer.invoke('servers:status', id),
  serverLogs: (id, lines) => ipcRenderer.invoke('servers:logs', id, lines),
  serverUpdateRemote: (id, data) => ipcRenderer.invoke('servers:updateRemote', id, data),
  serverTestSsh: (id) => ipcRenderer.invoke('servers:testSsh', id),
  serverDetect: (id) => ipcRenderer.invoke('servers:detect', id),
  serverStopExisting: (id) => ipcRenderer.invoke('servers:stopExisting', id),
  serverStart: (id) => ipcRenderer.invoke('servers:start', id),
  serverStop: (id) => ipcRenderer.invoke('servers:stop', id),
  serverCommand: (id, command) => ipcRenderer.invoke('servers:command', id, command),
  serverSaveConsole: (id) => ipcRenderer.invoke('servers:saveConsole', id),
  serverBackup: (id) => ipcRenderer.invoke('servers:backup', id),
  serverBackups: (id) => ipcRenderer.invoke('servers:backups', id),
  serverRestore: (id, name) => ipcRenderer.invoke('servers:restore', id, name),
  serverProperties: (id) => ipcRenderer.invoke('servers:properties', id),
  serverSaveProperties: (id, text) => ipcRenderer.invoke('servers:saveProperties', id, text),
  serverPlayers: (id) => ipcRenderer.invoke('servers:players', id),
  serverSsh: (id, command) => ipcRenderer.invoke('servers:ssh', id, command),
  serverPlayerAction: (id, action, name) => ipcRenderer.invoke('servers:playerAction', id, action, name),
  serverAnalyze: (id) => ipcRenderer.invoke('servers:analyze', id),
  serverSetJava: (id, javaPath) => ipcRenderer.invoke('servers:setJava', id, javaPath),
  loaderVersions: (type, mcVersion) => ipcRenderer.invoke('loader:versions', type, mcVersion),
  shaderVersions: (type, mcVersion, loader) => ipcRenderer.invoke('shader:versions', type, mcVersion, loader),
  optifineVersions: (mcVersion) => ipcRenderer.invoke('optifine:versions', mcVersion),
  optifineInstall: (mcVersion, url, patch) => ipcRenderer.invoke('optifine:install', mcVersion, url, patch),
  checkMods: (versionId) => ipcRenderer.invoke('mods:check', versionId),
  disableMods: (versionId, names) => ipcRenderer.invoke('mods:disable', versionId, names),
  serverRemove: (id) => ipcRenderer.invoke('servers:remove', id),
  onServerLog: (callback) => on('server:log', callback),
  onServerState: (callback) => on('server:state', callback),

  onTask: (callback) => on('task:update', callback),
  onLaunchProgress: (callback) => on('launch:progress', callback),
  onLaunchLog: (callback) => on('launch:log', callback),
  onLaunchExit: (callback) => on('launch:exit', callback),
  onVersionsChanged: (callback) => on('versions:changed', callback),
  onWindowMaximized: (callback) => on('window:maximized', callback),
  onUpdateStatus: (callback) => on('update:status', callback),
  onAnnouncements: (callback) => on('announcements:changed', callback)
});
