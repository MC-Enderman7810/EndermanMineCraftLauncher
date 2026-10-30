'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { app, safeStorage, dialog } = require('electron');
const AdmZip = require('adm-zip');
const minecraft = require('./minecraft');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

async function downloadVanillaServer(version, dir) {
  const target = path.join(dir, 'server.jar');
  if (fs.existsSync(target) && fs.statSync(target).size > 1024 * 1024) return target;
  const mirrors = [
    'https://bmclapi2.bangbang93.com/version/' + encodeURIComponent(version) + '/server'
  ];
  try {
    const manifest = await minecraft.fetchManifest('mojang');
    const item = manifest.versions.find((v) => v.id === version);
    if (item && item.url) {
      const json = await (await fetch(item.url)).json();
      const url = json.downloads && json.downloads.server && json.downloads.server.url;
      if (url) mirrors.push(url);
    }
  } catch { /* BMCLAPI fallback only */ }
  let lastError = null;
  for (const url of mirrors) {
    try {
      await downloadToFile(url, target);
      if (fs.existsSync(target) && fs.statSync(target).size > 1024 * 1024) return target;
    } catch (e) { lastError = e; }
  }
  throw new Error('无法下载 ' + version + ' 的原版服务端 jar，Forge/NeoForge 安装器需要它：' +
    (lastError ? lastError.message : '未知错误'));
}

async function runInstaller(java, jar, cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(java || 'java', ['-jar', jar, '--installServer'].concat(args || []), {
      cwd, windowsHide: true
    });
    let out = '';
    const append = (d) => { out = (out + String(d)).slice(-12000); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('安装器超时（10 分钟）\n' + out.slice(-3000)));
    }, 10 * 60 * 1000);
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('无法启动 Java 安装器：' + e.message)); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error('安装器失败，退出码 ' + code + '\n' + out.slice(-3000)));
    });
  });
}

async function downloadToFile(url, target, headers) {
  const res = await fetch(url, {
    headers: Object.assign({ 'User-Agent': 'EMCL/1.26.25.14 (server setup)' }, headers || {}),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('下载失败 HTTP ' + res.status + '：' + url);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(target));
}

const JAR_RE = /^(server|paper|fabric-server-launch|forge|neoforge|minecraft_server).*\.jar$/i;
const DEFAULTS = { memory: 4096, minMemory: 1024, javaPath: '' };

function makeId() {
  return 'srv-' + Date.now() + '-' + Math.random().toString(16).slice(2, 7);
}

class ServerManager {
  constructor(emit) {
    this.emit = emit || (() => {});
    this.file = path.join(app.getPath('userData'), 'servers.json');
    this.runtimes = new Map();
    this.logs = new Map();
  }

  async load() {
    try {
      const list = JSON.parse(await fsp.readFile(this.file, 'utf8'));
      if (Array.isArray(list)) return list;
      if (list && typeof list === 'object' && list.id) return [list];
      return [];
    } catch {
      return [];
    }
  }

  async save(list) {
    await fsp.mkdir(path.dirname(this.file), { recursive: true });
    await fsp.writeFile(this.file, JSON.stringify(list, null, 2), 'utf8');
  }

  decrypt(value) {
    if (!value) return '';
    try {
      return value.startsWith('enc:') && safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
        : '';
    } catch { return ''; }
  }

  encrypt(value) {
    if (!value) return '';
    if (!safeStorage.isEncryptionAvailable()) return '';
    return 'enc:' + safeStorage.encryptString(value).toString('base64');
  }

  async list() {
    const list = await this.load();
    return list.map((s) => Object.assign({}, s, {
      running: !!this.runtimes.get(s.id),
      logs: (this.logs.get(s.id) || []).slice(-200)
    }));
  }

  async pickLocal() {
    const result = await dialog.showOpenDialog({
      title: '选择 Minecraft 服务端目录',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    let files = [];
    try { files = await fsp.readdir(dir); } catch { /* ignore */ }
    const jar = files.find((f) => JAR_RE.test(f)) || '';
    return { dir, jar };
  }

  async chooseDir() {
    const result = await dialog.showOpenDialog({
      title: '选择新服务器目录',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  }

  async createLocal(data) {
    const dir = String(data.dir || '').trim();
    const version = String(data.version || '').trim();
    const loader = String(data.loader || 'paper').toLowerCase();
    if (!dir) throw new Error('请选择服务器目录');
    if (!version) throw new Error('请选择 Minecraft 版本');
    if (!data.eula) throw new Error('需要先接受 Minecraft EULA');
    await fsp.mkdir(dir, { recursive: true });
    if (fs.existsSync(path.join(dir, 'server.jar'))) throw new Error('目录里已经有 server.jar，请换一个空目录');

    let jarName = 'server.jar';
    let startScript = '';
    if (loader === 'paper') {
      const res = await fetch('https://fill.papermc.io/v3/projects/paper/versions/' +
        encodeURIComponent(version) + '/builds/latest', {
        headers: { 'User-Agent': 'EMCL/1.26.25.14 (server setup)' }
      });
      if (!res.ok) throw new Error('Paper 没有找到 ' + version + ' 的服务端（HTTP ' + res.status + '）');
      const info = await res.json();
      const download = info.downloads && info.downloads['server:default'];
      if (!download || !download.url) throw new Error('Paper 下载信息不完整');
      jarName = download.name || ('paper-' + version + '.jar');
      await downloadToFile(download.url, path.join(dir, jarName));
    } else if (loader === 'fabric') {
      const meta = await fetch('https://meta.fabricmc.net/v2/versions/loader/' + encodeURIComponent(version));
      if (!meta.ok) throw new Error('Fabric 没有找到 ' + version + '（HTTP ' + meta.status + '）');
      const list = await meta.json();
      const first = Array.isArray(list) ? list[0] : null;
      if (!first || !first.loader) throw new Error('Fabric 加载器列表为空');
      const loaderVersion = first.loader.version;
      const url = 'https://meta.fabricmc.net/v2/versions/loader/' +
        encodeURIComponent(version) + '/' + encodeURIComponent(loaderVersion) + '/server/jar';
      jarName = 'fabric-server-launch.jar';
      await downloadToFile(url, path.join(dir, jarName));
    } else if (loader === 'vanilla') {
      const manifest = await minecraft.fetchManifest('mojang');
      const item = manifest.versions.find((v) => v.id === version);
      if (!item || !item.url) throw new Error('版本清单里没有 ' + version);
      const json = await (await fetch(item.url)).json();
      const serverUrl = json.downloads && json.downloads.server && json.downloads.server.url;
      if (!serverUrl) throw new Error('这个版本没有服务端下载');
      await downloadToFile(serverUrl, path.join(dir, 'server.jar'));
    } else if (loader === 'forge') {
      const promo = await (await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
        { headers: { 'User-Agent': 'EMCL/1.26.25.14 (server setup)' } })).json();
      const forgeVersion = (promo.promos && (promo.promos[version + '-recommended'] || promo.promos[version + '-latest'])) || '';
      if (!forgeVersion) throw new Error('Forge 没有找到 ' + version + ' 的推荐版本');
      const full = version + '-' + forgeVersion;
      await downloadVanillaServer(version, dir);
      const installer = 'forge-' + full + '-installer.jar';
      await downloadToFile('https://maven.minecraftforge.net/net/minecraftforge/forge/' + full + '/' + installer,
        path.join(dir, installer));
      await runInstaller(data.javaPath || 'java', installer, dir);
      startScript = fs.existsSync(path.join(dir, 'run.bat')) ? 'run.bat'
        : (fs.existsSync(path.join(dir, 'run.sh')) ? 'run.sh' : '');
      if (!startScript) throw new Error('Forge 安装完成，但没有找到 run.bat / run.sh');
      jarName = '';
    } else if (loader === 'neoforge') {
      const meta = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge',
        { headers: { 'User-Agent': 'EMCL/1.26.25.14 (server setup)' } });
      if (!meta.ok) throw new Error('NeoForge 版本服务不可达（HTTP ' + meta.status + '）');
      const json = await meta.json();
      const prefix = version.split('.').slice(1).join('.') + '.';
      const versions = (json.versions || []).filter((v) => v.startsWith(prefix)).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }));
      const neoVersion = versions[versions.length - 1];
      if (!neoVersion) throw new Error('NeoForge 没有找到 ' + version + ' 的版本');
      await downloadVanillaServer(version, dir);
      const installer = 'neoforge-' + neoVersion + '-installer.jar';
      await downloadToFile('https://maven.neoforged.net/releases/net/neoforged/neoforge/' +
        neoVersion + '/' + installer, path.join(dir, installer));
      await runInstaller(data.javaPath || 'java', installer, dir);
      startScript = fs.existsSync(path.join(dir, 'run.bat')) ? 'run.bat'
        : (fs.existsSync(path.join(dir, 'run.sh')) ? 'run.sh' : '');
      if (!startScript) throw new Error('NeoForge 安装完成，但没有找到 run.bat / run.sh');
      jarName = '';
    } else {
      throw new Error('未知的服务端类型：' + loader);
    }

    await fsp.writeFile(path.join(dir, 'eula.txt'), 'eula=true\n', 'utf8');
    const settings = data.settings || {};
    const props = {
      motd: settings.motd || 'EMCL Studio Server',
      'server-port': settings.port || 25565,
      gamemode: settings.gamemode || 'survival',
      difficulty: settings.difficulty || 'normal',
      'max-players': settings.maxPlayers || 20,
      'online-mode': settings.onlineMode === false ? 'false' : 'true',
      pvp: settings.pvp === false ? 'false' : 'true',
      'view-distance': settings.viewDistance || 10,
      'simulation-distance': settings.simulationDistance || 10,
      'level-seed': settings.seed || '',
      'enable-command-block': 'true'
    };
    await fsp.writeFile(path.join(dir, 'server.properties'),
      Object.entries(props).map(([k, v]) => k + '=' + v).join('\n') + '\n', 'utf8');
    return this.addLocal(dir, data.name || path.basename(dir), jarName,
      Number(data.memory) || 4096, data.javaPath || '', startScript);
  }

  async addLocal(dir, name, jar, memory, javaPath, startScript) {
    if (!dir) throw new Error('没有选择服务端目录');
    const list = await this.load();
    let files = [];
    try { files = await fsp.readdir(dir); } catch { throw new Error('目录不可读取'); }
    const found = (startScript && !jar) ? '' : (jar || files.find((f) => JAR_RE.test(f)) || '');
    if (!found && !startScript) throw new Error('目录里没有找到服务端 jar');
    const profile = {
      id: makeId(),
      type: 'local',
      name: name || path.basename(dir),
      dir,
      jar: found,
      startScript: startScript || '',
      memory: Number(memory) || DEFAULTS.memory,
      minMemory: DEFAULTS.minMemory,
      javaPath: String(javaPath || ''),
      createdAt: Date.now()
    };
    list.unshift(profile);
    await this.save(list);
    return { ok: true, profile, servers: await this.list() };
  }

  async addRemote(data) {
    const host = String(data.host || '').trim();
    if (!host) throw new Error('请填写服务器地址');
    const profile = {
      id: makeId(),
      type: 'remote',
      name: String(data.name || host).trim() || host,
      host,
      port: Number(data.port) || 25575,
      password: this.encrypt(String(data.password || '')),
      sshUser: String(data.sshUser || '').trim(),
      sshPort: Number(data.sshPort) || 22,
      sshKey: String(data.sshKey || '').trim(),
      sshLogPath: String(data.sshLogPath || 'logs/latest.log').trim(),
      createdAt: Date.now()
    };
    const list = await this.load();
    list.unshift(profile);
    await this.save(list);
    return { ok: true, profile, servers: await this.list() };
  }

  async setJava(id, javaPath) {
    const list = await this.load();
    const profile = list.find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    profile.javaPath = String(javaPath || '');
    await this.save(list);
    return { ok: true, servers: await this.list() };
  }

  async remove(id) {
    const runtime = this.runtimes.get(id);
    if (runtime) await this.stop(id);
    const list = (await this.load()).filter((s) => s.id !== id);
    await this.save(list);
    return { ok: true, servers: await this.list() };
  }

  async findJavaProcess(dir) {
    return new Promise((resolve) => {
      const script = 'Get-CimInstance Win32_Process -Filter "Name=\'java.exe\'" | Where-Object { $_.CommandLine -like ("*" + $env:EMCL_SERVER_DIR + "*") } | Select-Object -ExpandProperty ProcessId';
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        env: Object.assign({}, process.env, { EMCL_SERVER_DIR: dir })
      });
      let out = '';
      child.stdout.on('data', (d) => { out += String(d); });
      child.on('error', () => resolve(0));
      child.on('exit', () => resolve(parseInt(out.trim().split(/\r?\n/)[0], 10) || 0));
    });
  }

  async findPortPid(port) {
    return new Promise((resolve) => {
      const script = 'Get-NetTCPConnection -LocalPort $env:EMCL_PORT -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess';
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        env: Object.assign({}, process.env, { EMCL_PORT: String(port) })
      });
      let out = '';
      child.stdout.on('data', (d) => { out += String(d); });
      child.on('error', () => resolve(0));
      child.on('exit', () => resolve(parseInt(out.trim(), 10) || 0));
    });
  }

  async detectRunning(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile || profile.type !== 'local') return { ok: true, running: false, reasons: [] };
    const reasons = [];
    let pid = await this.findJavaProcess(profile.dir);
    let port = 0;
    try {
      const props = await fsp.readFile(path.join(profile.dir, 'server.properties'), 'utf8');
      const m = props.match(/^server-port=(\d+)/m);
      port = m ? Number(m[1]) : 25565;
    } catch { port = 25565; }
    let portOpen = false;
    if (!pid && port) {
      portOpen = await new Promise((resolve) => {
        const socket = require('net').connect(port, '127.0.0.1');
        const done = (v) => { try { socket.destroy(); } catch { /* ignore */ } resolve(v); };
        socket.setTimeout(500);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
      });
    }
    if (!pid && portOpen) pid = await this.findPortPid(port);
    if (pid) reasons.push('检测到服务端进程 PID ' + pid);
    if (portOpen) reasons.push('端口 ' + port + ' 已被占用');
    if (fs.existsSync(path.join(profile.dir, 'session.lock')) && (pid || portOpen)) {
      reasons.push('session.lock 被占用');
    }
    return { ok: true, running: !!pid || portOpen, reasons, pid, port };
  }

  async stopExisting(id) {
    const state = await this.detectRunning(id);
    if (!state.running) return { ok: true, running: false };
    if (!state.pid) throw new Error('检测到端口占用，但无法定位服务端进程，请手动结束后重试');
    await new Promise((resolve, reject) => {
      const child = spawn('taskkill.exe', ['/PID', String(state.pid), '/T', '/F'], { windowsHide: true });
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('结束旧服务端进程失败，退出码 ' + code)));
    });
    return { ok: true, stopped: true };
  }

  async start(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (this.runtimes.has(id)) return { ok: false, code: 'SERVER_RUNNING', running: true, reasons: ['EMCL 正在管理该服务器进程'] };
    if (profile.type === 'local') {
      const existing = await this.detectRunning(id);
      if (existing.running) return { ok: false, code: 'SERVER_RUNNING', running: true, reasons: existing.reasons, pid: existing.pid };
    }
    if (profile.type === 'remote') {
      await this.rcon(profile, 'list');
      return { ok: true, running: true, remote: true };
    }
    const java = profile.javaPath || 'java';
    const args = ['-Xms' + Math.max(256, profile.minMemory || 1024) + 'M',
      '-Xmx' + Math.max(512, profile.memory || 4096) + 'M', '-jar', profile.jar, 'nogui'];
    const env = Object.assign({}, process.env);
    if (profile.javaPath) {
      const bin = path.dirname(profile.javaPath);
      env.JAVA_HOME = path.dirname(bin);
      env.PATH = bin + path.delimiter + (env.PATH || '');
    }
    if (profile.startScript) {
      const userArgs = path.join(profile.dir, 'user_jvm_args.txt');
      if (fs.existsSync(userArgs)) {
        const text = fs.readFileSync(userArgs, 'utf8')
          .split(/\r?\n/).filter((l) => !/^\s*-Xm[sx]/i.test(l)).join('\n');
        fs.writeFileSync(userArgs, text.trimEnd() + '\n-Xmx' + Math.max(512, profile.memory || 4096) + 'M\n', 'utf8');
      }
    }
    const child = profile.startScript
      ? (process.platform === 'win32'
        ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
          ['/c', profile.startScript, 'nogui'], { cwd: profile.dir, windowsHide: true, env })
        : spawn('sh', [profile.startScript, 'nogui'], { cwd: profile.dir, windowsHide: true, env }))
      : spawn(java, args, { cwd: profile.dir, windowsHide: true, env });
    this.runtimes.set(id, child);
    const push = (stream) => (data) => {
      const lines = String(data || '').split(/\r?\n/).filter((x) => x !== '');
      const log = this.logs.get(id) || [];
      for (const line of lines) {
        log.push({ at: Date.now(), stream, line });
        this.emit('server:log', { id, line, stream });
      }
      this.logs.set(id, log.slice(-500));
    };
    child.stdout.on('data', push('out'));
    child.stderr.on('data', push('err'));
    child.on('exit', (code) => {
      this.runtimes.delete(id);
      this.emit('server:state', { id, running: false, code });
    });
    child.on('error', (e) => {
      this.runtimes.delete(id);
      const line = '启动失败：' + e.message;
      const log = this.logs.get(id) || [];
      log.push({ at: Date.now(), stream: 'err', line });
      this.logs.set(id, log.slice(-500));
      this.emit('server:log', { id, line, stream: 'err' });
      this.emit('server:state', { id, running: false, error: e.message });
    });
    this.emit('server:state', { id, running: true });
    return { ok: true, running: true };
  }

  async stop(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type === 'remote') {
      await this.rcon(profile, 'stop');
      return { ok: true };
    }
    const child = this.runtimes.get(id);
    if (!child) return { ok: true, running: false };
    try { child.stdin.write('stop\n'); } catch { /* ignore */ }
    setTimeout(() => {
      if (this.runtimes.get(id) === child) child.kill();
    }, 12000);
    return { ok: true, stopping: true };
  }

  async command(id, command) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type === 'remote') {
      const reply = await this.rcon(profile, command);
      const line = '> ' + command + '\n' + String(reply || '');
      const log = this.logs.get(id) || [];
      log.push({ at: Date.now(), stream: 'out', line });
      this.logs.set(id, log.slice(-500));
      this.emit('server:log', { id, line, stream: 'out' });
      return { ok: true, reply };
    }
    const child = this.runtimes.get(id);
    if (!child) throw new Error('服务器未启动');
    child.stdin.write(command + '\n');
    return { ok: true };
  }

  async saveConsole(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    const lines = (this.logs.get(id) || []).map((item) =>
      '[' + new Date(item.at).toLocaleString() + '] ' + item.line);
    if (!lines.length && profile.type === 'local') {
      try {
        const raw = await fsp.readFile(path.join(profile.dir, 'logs', 'latest.log'), 'utf8');
        lines.push(...raw.split(/\r?\n/).slice(-2000));
      } catch { /* no log yet */ }
    }
    const header = [
      'EMCL 服务器控制台信息',
      '服务器：' + profile.name,
      '类型：' + (profile.type === 'local' ? '本地服务端' : '远程 RCON'),
      '位置：' + (profile.type === 'local' ? profile.dir : profile.host + ':' + profile.port),
      '导出时间：' + new Date().toLocaleString(),
      '============================================================',
      ''
    ].join('\n');
    const text = header + (lines.join('\n') || '（当前没有控制台输出）') + '\n';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const result = await dialog.showSaveDialog({
      title: '保存服务器控制台信息',
      defaultPath: path.join(app.getPath('downloads'),
        'EMCL-' + String(profile.name).replace(/[\\/:*?"<>|]/g, '_') + '-console-' + stamp + '.txt'),
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fsp.writeFile(result.filePath, text, 'utf8');
    return { ok: true, path: result.filePath };
  }

  async backup(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'local') throw new Error('远程备份暂未实现');
    const dir = profile.dir;
    const backupDir = path.join(dir, 'backups');
    await fsp.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(backupDir, 'EMCL-' + stamp + '.zip');
    const zip = new AdmZip();
    for (const name of ['world', 'world_nether', 'world_the_end', 'server.properties', 'whitelist.json', 'ops.json']) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        const st = fs.statSync(p);
        if (st.isDirectory()) zip.addLocalFolder(p, name);
        else zip.addLocalFile(p);
      }
    }
    zip.writeZip(target);
    return { ok: true, path: target };
  }

  async remoteStatus(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'remote') {
      const local = await this.detectRunning(id);
      return { ok: true, mode: 'local', running: local.running, reasons: local.reasons, pid: local.pid };
    }
    const started = Date.now();
    try {
      const reply = await this.rcon(profile, 'list');
      return {
        ok: true, mode: 'remote', running: true, latency: Date.now() - started,
        players: String(reply || '').trim(), error: ''
      };
    } catch (e) {
      return {
        ok: true, mode: 'remote', running: false, latency: Date.now() - started,
        players: '', error: e.message || 'RCON 连接失败'
      };
    }
  }

  async remoteLogs(id, lines = 80) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    const count = Math.max(20, Math.min(400, Number(lines) || 80));
    if (profile.type === 'local') {
      const file = path.join(profile.dir, 'logs', 'latest.log');
      try {
        const text = await fsp.readFile(file, 'utf8');
        return { ok: true, text: text.split(/\r?\n/).slice(-count).join('\n'), file };
      } catch {
        return { ok: false, error: '还没有 latest.log', text: '' };
      }
    }
    if (!profile.sshUser) return { ok: false, error: '未配置 SSH，无法读取远程日志', text: '' };
    const logPath = profile.sshLogPath || 'logs/latest.log';
    const res = await this.sshCommand(id, 'tail -n ' + count + ' ' + JSON.stringify(logPath));
    return { ok: true, text: res.text, file: logPath };
  }

  async updateRemote(id, data) {
    const list = await this.load();
    const profile = list.find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'remote') throw new Error('只能编辑远程服务器');
    if (data.name) profile.name = String(data.name).trim();
    if (data.host) profile.host = String(data.host).trim();
    if (data.port) profile.port = Number(data.port);
    if (data.sshUser !== undefined) profile.sshUser = String(data.sshUser || '').trim();
    if (data.sshPort) profile.sshPort = Number(data.sshPort);
    if (data.sshKey !== undefined) profile.sshKey = String(data.sshKey || '').trim();
    if (data.sshLogPath !== undefined) profile.sshLogPath = String(data.sshLogPath || '').trim();
    if (data.password) profile.password = this.encrypt(String(data.password));
    await this.save(list);
    return { ok: true, servers: await this.list() };
  }

  async testSsh(id) {
    const res = await this.sshCommand(id, 'printf EMCL_SSH_OK');
    return { ok: String(res.text || '').includes('EMCL_SSH_OK'), text: res.text };
  }

  async sshCommand(id, command) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'remote' || !profile.sshUser) throw new Error('请先配置 SSH 用户');
    if (!command || !String(command).trim()) throw new Error('请输入 SSH 命令');
    return new Promise((resolve, reject) => {
      const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
      if (profile.sshKey) args.push('-i', profile.sshKey);
      if (profile.sshPort && profile.sshPort !== 22) args.push('-p', String(profile.sshPort));
      args.push(profile.sshUser + '@' + profile.host, String(command));
      const child = spawn('ssh', args, { windowsHide: true });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { err += d; });
      child.on('error', (e) => reject(new Error('SSH 启动失败：' + e.message)));
      child.on('exit', (code) => {
        if (code === 0) resolve({ ok: true, text: out || '(无输出)' });
        else reject(new Error((err || out || ('SSH 退出码 ' + code)).slice(-2000)));
      });
    });
  }

  async getProperties(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'local') throw new Error('远程服务器不支持 properties 编辑');
    const file = path.join(profile.dir, 'server.properties');
    try { return { ok: true, text: await fsp.readFile(file, 'utf8') }; }
    catch { return { ok: true, text: '' }; }
  }

  async saveProperties(id, text) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'local') throw new Error('远程服务器不支持 properties 编辑');
    const file = path.join(profile.dir, 'server.properties');
    await fsp.writeFile(file, String(text || ''), 'utf8');
    return { ok: true };
  }

  async getPlayers(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type === 'remote') {
      const reply = await this.rcon(profile, 'list');
      return { ok: true, remote: true, text: reply, whitelist: [], ops: [] };
    }
    const read = async (name) => {
      try {
        const raw = (await fsp.readFile(path.join(profile.dir, name), 'utf8')).replace(/^\uFEFF/, '');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data.map((x) => x.name).filter(Boolean) : [];
      } catch { return []; }
    };
    return { ok: true, whitelist: await read('whitelist.json'), ops: await read('ops.json') };
  }

  async playerAction(id, action, name) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    const player = String(name || '').trim();
    if (!player) throw new Error('请输入玩家名');
    const map = {
      whitelistAdd: 'whitelist add ' + player,
      whitelistRemove: 'whitelist remove ' + player,
      op: 'op ' + player,
      deop: 'deop ' + player
    };
    const command = map[action];
    if (!command) throw new Error('不支持的操作');
    return this.command(id, command);
  }

  async listBackups(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'local') throw new Error('远程备份暂未实现');
    const dir = path.join(profile.dir, 'backups');
    try {
      const files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.zip'));
      const items = [];
      for (const f of files) {
        const stat = await fsp.stat(path.join(dir, f));
        items.push({ name: f, size: stat.size, at: stat.mtimeMs });
      }
      return { ok: true, items: items.sort((a, b) => b.at - a.at) };
    } catch { return { ok: true, items: [] }; }
  }

  async restore(id, name) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'local') throw new Error('远程恢复暂未实现');
    const safe = path.basename(String(name || ''));
    if (!safe.endsWith('.zip')) throw new Error('备份文件无效');
    const zipPath = path.join(profile.dir, 'backups', safe);
    if (!fs.existsSync(zipPath)) throw new Error('备份不存在');
    if (this.runtimes.get(id)) throw new Error('请先停止服务器再恢复');
    new AdmZip(zipPath).extractAllTo(profile.dir, true);
    return { ok: true };
  }

  async analyze(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (profile.type !== 'local') throw new Error('远程日志分析暂未实现');
    const files = [];
    try {
      const reports = (await fsp.readdir(path.join(profile.dir, 'crash-reports'))).sort().reverse();
      if (reports[0]) files.push(path.join(profile.dir, 'crash-reports', reports[0]));
    } catch { /* ignore */ }
    files.push(path.join(profile.dir, 'logs', 'latest.log'));
    for (const file of files) {
      try {
        const raw = await fsp.readFile(file, 'utf8');
        const lines = raw.split(/\r?\n/);
        const hits = lines.filter((l) => /error|exception|caused by|failed|outofmemory|mod|mixinextras/i.test(l)).slice(-40);
        return { ok: true, file: path.basename(file), text: (raw.split(/\r?\n/).slice(-80).join('\n') + '\n\n--- 可疑行 ---\n' + hits.join('\n')).slice(-12000) };
      } catch { /* next */ }
    }
    return { ok: true, file: '', text: '没有找到 crash-reports 或 logs/latest.log。' };
  }

  rcon(profile, command) {
    return new Promise((resolve, reject) => {
      const password = this.decrypt(profile.password);
      const net = require('net');
      const socket = net.connect(profile.port || 25575, profile.host);
      let step = 'auth';
      let buffer = Buffer.alloc(0);
      const send = (id, type, body) => {
        const payload = Buffer.from(body, 'utf8');
        const packet = Buffer.alloc(14 + payload.length);
        packet.writeInt32LE(10 + payload.length, 0);
        packet.writeInt32LE(id, 4);
        packet.writeInt32LE(type, 8);
        payload.copy(packet, 12);
        packet[12 + payload.length] = 0;
        packet[13 + payload.length] = 0;
        socket.write(packet);
      };
      socket.setTimeout(8000);
      socket.on('connect', () => send(1, 3, password));
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 12) {
          const len = buffer.readInt32LE(0);
          if (buffer.length < len + 4) break;
          const id = buffer.readInt32LE(4);
          const type = buffer.readInt32LE(8);
          const text = buffer.slice(12, len + 2).toString('utf8');
          buffer = buffer.slice(len + 4);
          if (step === 'auth') {
            if (id === -1) { socket.destroy(); reject(new Error('RCON 密码错误')); return; }
            step = 'command';
            send(2, 2, command);
          } else {
            socket.end();
            resolve(text);
            return;
          }
        }
      });
      socket.on('timeout', () => { socket.destroy(); reject(new Error('RCON 连接超时')); });
      socket.on('error', (e) => reject(new Error('RCON: ' + e.message)));
    });
  }
}

module.exports = { ServerManager };
