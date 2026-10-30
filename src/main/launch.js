'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');
const {
  ensureDir, exists, fetchJson, downloadFile, parseArgsLine, substitute, safeName
} = require('./util');
const { resolveVersion, instanceDir, ruleAllows } = require('./minecraft');
const { resolveJava, ensureJava, javaMajorForMc } = require('./java');

const AUTHlib_META = 'https://authlib-injector.yushi.moe/artifact/latest.json';

function quote(arg) {
  const s = String(arg);
  if (!s) return '""';
  return /[\s"]/g.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s;
}

function collectArgs(list, vars) {
  const out = [];
  for (const item of list || []) {
    if (typeof item === 'string') {
      out.push(substitute(item, vars));
      continue;
    }
    if (!item || !ruleAllows(item.rules)) continue;
    if (typeof item.value === 'string') out.push(substitute(item.value, vars));
    else if (Array.isArray(item.value)) {
      for (const v of item.value) out.push(substitute(v, vars));
    }
  }
  return out;
}

function classpathOf(version, gameDir) {
  const libs = [];
  const seen = new Set();
  for (const lib of version.libraries || []) {
    if (!ruleAllows(lib.rules)) continue;
    let rel = '';
    if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
      rel = lib.downloads.artifact.path;
    } else if (lib.name) {
      const parts = String(lib.name).split(':');
      if (parts.length >= 3) {
        rel = parts[0].replace(/\./g, '/') + '/' + parts[1] + '/' + parts[2] + '/' +
          parts[1] + '-' + parts[2] + (parts[3] ? '-' + parts[3] : '') + '.jar';
      }
    }
    if (!rel || seen.has(rel)) continue;
    const full = path.join(gameDir, 'libraries', rel);
    if (fs.existsSync(full)) {
      seen.add(rel);
      libs.push(full);
    }
  }
  if (version.clientJarPath && fs.existsSync(version.clientJarPath)) libs.push(version.clientJarPath);
  return libs;
}

async function ensureAuthlib(store, server) {
  const target = path.join(store.root, 'libraries', 'authlib-injector.jar');
  if (await exists(target)) return target;
  const meta = await fetchJson(AUTHlib_META, { timeout: 30000 });
  const url = meta.download_url || (meta.artifact && meta.artifact.url);
  if (!url) throw new Error('无法获取 authlib-injector 下载地址');
  await downloadFile(url, target, { timeout: 120000 });
  return target;
}

function gcArg(gc) {
  switch (gc) {
    case 'G1GC': return '-XX:+UseG1GC';
    case 'ZGC': return '-XX:+UseZGC';
    case 'SerialGC': return '-XX:+UseSerialGC';
    case 'ParallelGC': return '-XX:+UseParallelGC';
    default: return '';
  }
}

async function buildLaunch(store, versionId, account, options = {}) {
  const config = store.getConfig();
  const version = await resolveVersion(config.gameDir, versionId);
  if (!version.clientJarPath) {
    throw new Error('该版本缺少客户端 jar，请回到「版本」页点击「补全文件」');
  }
  const javaInfo = await resolveJava(store, versionId);
  if (!javaInfo.path) {
    throw new Error('未找到 Java 运行时。请到「设置」检测或下载 Java ' + javaMajorForMc(versionId));
  }
  if (javaInfo.tooOld) {
    throw new Error('当前 Java ' + javaInfo.major + ' 低于该版本要求的 ' + javaInfo.required + '，请更换 Java');
  }
  const reqMajor = version.javaVersion ? version.javaVersion.majorVersion : javaMajorForMc(versionId);
  if (javaInfo.major && reqMajor && javaInfo.major < reqMajor) {
    throw new Error('Java ' + javaInfo.major + ' 低于该版本要求的 Java ' + reqMajor);
  }

  const gameDir = instanceDir(config, versionId);
  await ensureDir(gameDir);
  const nativesDir = path.join(config.gameDir, 'versions', versionId, 'natives');
  await ensureDir(nativesDir);
  const assetsDir = path.join(config.gameDir, 'assets');
  const librariesDir = path.join(config.gameDir, 'libraries');
  const classpath = classpathOf(version, config.gameDir).join(';');

  const vars = {
    auth_player_name: account.name,
    version_name: versionId,
    game_directory: gameDir,
    assets_root: assetsDir,
    assets_index_name: version.assetIndex ? version.assetIndex.id : (version.assets || versionId),
    auth_uuid: String(account.uuid || '').replace(/-/g, ''),
    auth_access_token: account.accessToken || '0',
    auth_session: account.accessToken || '0',
    user_type: account.kind === 2 ? 'mojang' : (account.kind === 1 ? 'msa' : 'legacy'),
    version_type: version.type || 'release',
    natives_directory: nativesDir,
    classpath,
    launcher_name: 'EMCL',
    launcher_version: '1.26.25.14',
    user_properties: '{}',
    clientid: '',
    auth_xuid: ''
  };

  let jvm = collectArgs(version.arguments && version.arguments.jvm, vars);
  const userJvm = parseArgsLine(config.jvmArgs || '');
  if (!jvm.length) {
    jvm = [];
  }
  // 去掉模板里的内存参数，统一用启动器设置，避免多个 -Xmx 相互覆盖
  jvm = jvm.filter((a) => !/^-Xm[sx]/.test(a) && !/^-XX:\+Use(G1|Z|Serial|Parallel)GC/.test(a));
  jvm.unshift('-Xms' + config.minMemory + 'M', '-Xmx' + config.maxMemory + 'M');
  const gc = gcArg(config.gc);
  if (gc) jvm.push(gc);
  if (!jvm.some((a) => a.startsWith('-Djava.library.path='))) {
    jvm.push('-Djava.library.path=' + nativesDir);
  }
  if (!jvm.some((a) => a.startsWith('-Dminecraft.launcher.brand='))) {
    jvm.push('-Dminecraft.launcher.brand=EMCL');
  }
  if (!jvm.some((a) => a.startsWith('-Dminecraft.launcher.version='))) {
    jvm.push('-Dminecraft.launcher.version=1.26.25.14');
  }
  if (!jvm.some((a) => a.startsWith('-Dlog4j2.formatMsgNoLookups='))) {
    jvm.push('-Dlog4j2.formatMsgNoLookups=true');
  }
  jvm.push(...userJvm);
  if (!jvm.some((a) => a === '-cp' || a === '-classpath')) {
    jvm.push('-cp', classpath);
  }
  if (account.kind === 2 && account.server) {
    const agent = await ensureAuthlib(store, account.server);
    jvm.unshift('-javaagent:' + agent + '=' + account.server);
    jvm.push('-Dminecraft.api.auth.host=' + account.server);
    jvm.push('-Dminecraft.api.account.host=' + account.server);
    jvm.push('-Dminecraft.api.session.host=' + account.server);
    jvm.push('-Dminecraft.api.services.host=' + account.server);
  }

  let game = collectArgs(version.arguments && version.arguments.game, vars);
  if (!game.length && version.minecraftArguments) {
    game = parseArgsLine(version.minecraftArguments).map((a) => substitute(a, vars));
  }
  if (String(versionId).startsWith('2.0-')) {
    // 2.0 默认使用 854x480 的固定渲染区域，窗口被放大后会出现黑边。
    game.push('--width', '1600', '--height', '900');
  }
  const mainClass = version.mainClass || 'net.minecraft.client.main.Main';
  const args = [...jvm, mainClass, ...game];

  return {
    java: javaInfo,
    version,
    command: [javaInfo.path, ...args].map(quote).join(' '),
    args,
    cwd: gameDir,
    logFile: store.defaultLogFile(),
    requiredJava: reqMajor
  };
}

async function launchGame(store, versionId, account, onLog, onExit, options = {}) {
  if (!account) throw new Error('请先登录一个账户');
  if (!account.name) throw new Error('账户信息不完整');
  const built = await buildLaunch(store, versionId, account);
  await ensureDir(path.dirname(built.logFile));
  const out = fs.createWriteStream(built.logFile, { flags: 'a' });
  const write = (level, text) => {
    const clean = String(text).replace(/\r/g, '');
    out.write('[' + new Date().toLocaleTimeString() + '] [' + level + '] ' + clean + '\n');
    if (onLog) onLog(level, clean);
  };
  write('info', '启动命令：' + built.command);
  write('info', '游戏目录：' + built.cwd);
  write('info', 'Java：' + built.java.path + ' (' + built.java.version + ')');

  const child = spawn(built.java.path, built.args, {
    cwd: built.cwd,
    windowsHide: true,
    env: Object.assign({}, process.env, {
      JAVA_TOOL_OPTIONS: '',
      _JAVA_OPTIONS: ''
    })
  });
  child.stdout.on('data', (d) => write('out', d.toString('utf8')));
  child.stderr.on('data', (d) => write('err', d.toString('utf8')));
  child.on('error', (err) => {
    write('err', '进程启动失败：' + err.message);
    if (onExit) onExit(null, err.message);
  });
  child.on('exit', (code, signal) => {
    write('info', '游戏进程结束，退出码 ' + code + (signal ? '，信号 ' + signal : ''));
    out.end();
    if (onExit) onExit(code, signal);
  });
  return {
    pid: child.pid,
    command: built.command,
    logFile: built.logFile,
    versionId,
    child,
    stop: () => {
      try { child.kill(); } catch { /* ignore */ }
    }
  };
}

module.exports = {
  buildLaunch,
  launchGame,
  classpathOf,
  ensureAuthlib
};
