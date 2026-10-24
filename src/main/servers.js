'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { app, safeStorage, dialog } = require('electron');
const AdmZip = require('adm-zip');

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
      return Array.isArray(list) ? list : [];
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

  async addLocal(dir, name, jar, memory) {
    if (!dir) throw new Error('没有选择服务端目录');
    const list = await this.load();
    let files = [];
    try { files = await fsp.readdir(dir); } catch { throw new Error('目录不可读取'); }
    const found = jar || files.find((f) => JAR_RE.test(f)) || '';
    if (!found) throw new Error('目录里没有找到服务端 jar');
    const profile = {
      id: makeId(),
      type: 'local',
      name: name || path.basename(dir),
      dir,
      jar: found,
      memory: Number(memory) || DEFAULTS.memory,
      minMemory: DEFAULTS.minMemory,
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
      createdAt: Date.now()
    };
    const list = await this.load();
    list.unshift(profile);
    await this.save(list);
    return { ok: true, profile, servers: await this.list() };
  }

  async remove(id) {
    const runtime = this.runtimes.get(id);
    if (runtime) await this.stop(id);
    const list = (await this.load()).filter((s) => s.id !== id);
    await this.save(list);
    return { ok: true, servers: await this.list() };
  }

  async start(id) {
    const profile = (await this.load()).find((s) => s.id === id);
    if (!profile) throw new Error('服务器不存在');
    if (this.runtimes.has(id)) return { ok: true, running: true };
    if (profile.type === 'remote') {
      await this.rcon(profile, 'list');
      return { ok: true, running: true, remote: true };
    }
    const java = profile.javaPath || 'java';
    const args = ['-Xms' + Math.max(256, profile.minMemory || 1024) + 'M',
      '-Xmx' + Math.max(512, profile.memory || 4096) + 'M', '-jar', profile.jar, 'nogui'];
    const child = spawn(java, args, { cwd: profile.dir, windowsHide: true });
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
      return { ok: true, reply };
    }
    const child = this.runtimes.get(id);
    if (!child) throw new Error('服务器未启动');
    child.stdin.write(command + '\n');
    return { ok: true };
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
