'use strict';

const fs = require('fs');
const path = require('path');

const root = 'C:\\emcl-release';
const secretFile = path.join(root, '.announce-secret');
const updateFile = path.join(root, 'docs', 'update.json');

function password() {
  if (process.env.EMCL_ANNOUNCE_PASSWORD) return process.env.EMCL_ANNOUNCE_PASSWORD.trim();
  try { return fs.readFileSync(secretFile, 'utf8').trim(); } catch { return ''; }
}

async function main() {
  const version = String(process.argv[2] || '').trim();
  if (!version) throw new Error('missing version');
  const pass = password();
  if (!pass) throw new Error('公告密码未配置');

  const update = JSON.parse(fs.readFileSync(updateFile, 'utf8'));
  const notes = Array.isArray(update.notes) ? update.notes : [];
  const body = ['EMCL ' + version + ' 已发布。'].concat(notes.map((x) => '- ' + x)).join('\n');

  const loginRes = await fetch('https://api.emcl.life/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pass })
  });
  const login = await loginRes.json();
  if (!login.token) throw new Error(login.error || '公告登录失败');

  const res = await fetch('https://api.emcl.life/api/announcements', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + login.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'EMCL ' + version + ' 已发布',
      body,
      tag: '更新',
      date: new Date().toISOString().slice(0, 10),
      audience: ['release', 'sianh'],
      targets: []
    })
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || '公告发布失败');
  console.log('[announcement] published for ' + version + ': ' + data.id);
}

main().catch((error) => {
  console.error('[announcement] ' + (error && error.message ? error.message : error));
  process.exit(1);
});
