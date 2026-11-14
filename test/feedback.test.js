'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const Module = require('node:module');
const { javaMajorForMc } = require('../src/main/java');
const { downloadFile } = require('../src/main/util');

function loadWithElectronStub(modulePath, userData) {
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return { app: { getPath: () => userData }, safeStorage: {}, dialog: {} };
    return original.call(this, request, parent, isMain);
  };
  try { return require(modulePath); }
  finally { Module._load = original; }
}

test('modded 1.8.9 instance uses Java 8 while 26.3 uses Java 25', () => {
  assert.equal(javaMajorForMc('forge-1.8.9-LiquidBounce100'), 8);
  assert.equal(javaMajorForMc('1.20.5-Forge'), 21);
  assert.equal(javaMajorForMc('26.3'), 25);
});

test('stalled download resumes from the partial file and verifies SHA-1', async () => {
  const payload = Buffer.from('hello-world');
  const expectedSha1 = createHash('sha1').update(payload).digest('hex');
  const ranges = [];
  const server = http.createServer((req, res) => {
    ranges.push(req.headers.range || '');
    if (!req.headers.range) {
      res.writeHead(200, { 'Content-Length': payload.length });
      res.write(payload.subarray(0, 5));
      return;
    }
    assert.equal(req.headers.range, 'bytes=5-');
    res.writeHead(206, {
      'Content-Length': payload.length - 5,
      'Content-Range': 'bytes 5-10/11'
    });
    res.end(payload.subarray(5));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'emcl-download-test-'));
  try {
    const dest = path.join(dir, 'client.jar');
    let retries = 0;
    await downloadFile('http://127.0.0.1:' + server.address().port + '/client.jar', dest, {
      expectedSha1, idleTimeout: 150, timeout: 1000, retries: 1,
      onRetry: () => { retries++; }
    });
    assert.deepEqual(await fs.readFile(dest), payload);
    assert.deepEqual(ranges, ['', 'bytes=5-']);
    assert.equal(retries, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('launch logs are selected by exact instance name', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'emcl-logs-test-'));
  try {
    const { Store } = loadWithElectronStub('../src/main/store', dir);
    const store = new Store();
    await fs.mkdir(store.logsDir, { recursive: true });
    const forge = store.defaultLogFile('1.8.9-Forge');
    const vanilla = store.defaultLogFile('1.8.9');
    await fs.writeFile(forge, 'forge error');
    await fs.writeFile(vanilla, 'vanilla output');
    assert.equal(store.readLatestLog('1.8.9-Forge'), 'forge error');
    assert.equal(store.readLatestLog('1.8.9'), 'vanilla output');
    assert.equal(store.latestLogFile('1.8.9'), vanilla);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('managed local server reports running without a second process scan', async () => {
  const { ServerManager } = loadWithElectronStub('../src/main/servers', os.tmpdir());
  const manager = new ServerManager();
  manager.load = async () => [{ id: 'local-1', type: 'local', dir: 'unused' }];
  manager.findJavaProcess = async () => { throw new Error('should not scan'); };
  manager.runtimes.set('local-1', { pid: 321, exitCode: null });
  const status = await manager.remoteStatus('local-1');
  assert.equal(status.running, true);
  assert.equal(status.pid, 321);
});

test('log view filters errors and keeps instances separate; offline skin has clear status', async () => {
  const source = await fs.readFile(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const init = source.indexOf('(async function init() {');
  assert.ok(init > 0);
  const context = vm.createContext({ window: { emcl: {}, addEventListener() {} }, document: {}, console });
  vm.runInContext(source.slice(0, init) + '\nglobalThis.viewTest = { state, pageLogs, pageSkins };', context);
  const { state, pageLogs, pageSkins } = context.viewTest;
  state.installed = [{ id: '1.8.9' }, { id: '26.3' }];
  state.logVersionId = '1.8.9';
  state.launchVersionId = '1.8.9';
  state.logFilter = 'error';
  state.logLines = [{ level: 'out', text: 'normal output' },
    { level: 'err', text: 'normal stderr output' }, { level: 'err', text: 'Exception in thread' }];
  assert.match(pageLogs(), /Exception in thread/);
  assert.doesNotMatch(pageLogs(), /normal output/);
  assert.doesNotMatch(pageLogs(), /normal stderr output/);
  state.logVersionId = '26.3';
  state.latestLog = '26.3 separate output';
  assert.doesNotMatch(pageLogs(), /Exception in thread/);
  state.accounts = [{ id: 'offline-1', name: 'Steve', kind: 0 }];
  state.activeAccountId = 'offline-1';
  state.skinData = { ok: true, dataUrl: 'data:image/png;base64,AA==', isDefault: true, name: 'Steve' };
  const skins = pageSkins();
  assert.match(skins, /离线账户不支持在线皮肤/);
  assert.doesNotMatch(skins, /正在读取当前账户的皮肤/);
  assert.doesNotMatch(skins, /data-action="skin-apply"/);
  assert.doesNotMatch(skins, /data-action="skin-cape-off"/);
});
