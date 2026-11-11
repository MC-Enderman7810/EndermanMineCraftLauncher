export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = new Set([
      env.ALLOWED_ORIGIN || 'https://www.emcl.life',
      'https://emcl.life',
      'http://localhost:8788',
      'http://127.0.0.1:8788'
    ]);
    const cors = allowed.has(origin) ? origin : (env.ALLOWED_ORIGIN || 'https://www.emcl.life');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(cors) });
    }

    try {
      if (url.pathname === '/com1' || url.pathname === '/com1/') {
        return Response.redirect('https://www.emcl.life/remote.html', 302);
      }

      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'emcl-api', time: Date.now() }, cors);
      }

      if (url.pathname === '/api/login' && request.method === 'POST') {
        return await login(request, env, cors);
      }

      if (url.pathname === '/api/announcements' && request.method === 'GET') {
        const rows = await env.DB.prepare(
          'SELECT id,title,body,date,tag,url,created_at FROM announcements ORDER BY date DESC, created_at DESC LIMIT 100'
        ).all();
        return json({ ok: true, announcements: rows.results || [] }, cors);
      }

      if (url.pathname === '/api/feedback' && request.method === 'POST') {
        return await createFeedback(request, env, cors);
      }

      if (url.pathname === '/api/feedback' && request.method === 'GET') {
        if (!(await isAdmin(request, env))) return json({ ok: false, error: '未登录' }, cors, 401);
        const rows = await env.DB.prepare(
          'SELECT id,name,email,type,message,app,version,status,created_at FROM feedback ORDER BY created_at DESC LIMIT 200'
        ).all();
        return json({ ok: true, feedback: rows.results || [] }, cors);
      }

      const feedbackMatch = url.pathname.match(/^\/api\/feedback\/([^/]+)$/);
      if (feedbackMatch && request.method === 'PATCH') {
        if (!(await isAdmin(request, env))) return json({ ok: false, error: '未登录' }, cors, 401);
        const body = await readJson(request);
        const status = ['new', 'read', 'closed'].includes(body.status) ? body.status : 'read';
        await env.DB.prepare('UPDATE feedback SET status = ? WHERE id = ?').bind(status, feedbackMatch[1]).run();
        return json({ ok: true }, cors);
      }

      if (url.pathname === '/api/announcements' && request.method === 'POST') {
        if (!(await isAdmin(request, env))) return json({ ok: false, error: '未登录' }, cors, 401);
        const body = await readJson(request);
        const title = String(body.title || '').trim().slice(0, 160);
        const text = String(body.body || '').trim().slice(0, 8000);
        if (!title || !text) return json({ ok: false, error: '标题和正文不能为空' }, cors, 400);
        const id = crypto.randomUUID();
        const date = String(body.date || new Date().toISOString().slice(0, 10)).slice(0, 20);
        const tag = String(body.tag || '公告').slice(0, 20);
        const link = String(body.url || '').slice(0, 500);
        await env.DB.prepare(
          'INSERT INTO announcements (id,title,body,date,tag,url,created_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(id, title, text, date, tag, link, Date.now()).run();
        return json({ ok: true, id }, cors);
      }

      if (feedbackMatch && request.method === 'DELETE') {
        if (!(await isAdmin(request, env))) return json({ ok: false, error: '未登录' }, cors, 401);
        await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(feedbackMatch[1]).run();
        return json({ ok: true }, cors);
      }

      return json({ ok: false, error: 'Not found' }, cors, 404);
    } catch (error) {
      return json({ ok: false, error: error.message || 'Internal error' }, cors, 500);
    }
  }
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function login(request, env, cors) {
  const body = await readJson(request);
  const password = String(body.password || '');
  if (!password) return json({ ok: false, error: '请输入密码' }, cors, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'login:' + ip;
  const current = await env.KV.get(key);
  const count = current ? Number(current) : 0;
  if (count >= 8) return json({ ok: false, error: '尝试次数过多，请 15 分钟后再试' }, cors, 429);

  const stored = env.COM1_PASSWORD_HASH || '';
  if (!(await verifyPassword(password, stored))) {
    await env.KV.put(key, String(count + 1), { expirationTtl: 900 });
    return json({ ok: false, error: '密码错误' }, cors, 401);
  }

  await env.KV.delete(key);
  const token = randomToken(32);
  await env.KV.put('session:' + token, JSON.stringify({ role: 'admin', at: Date.now() }), { expirationTtl: 1800 });
  return json({ ok: true, token, expiresIn: 1800 }, cors);
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, alg, iterText, saltText, hashText] = stored.split('$');
  const iterations = Number(iterText) || 120000;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const hashName = alg.toLowerCase() === 'sha256' ? 'SHA-256' : alg.toUpperCase();
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltText), iterations, hash: hashName },
    key,
    256
  );
  return timingSafeEqual(bytesToHex(new Uint8Array(bits)), hashText);
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomToken(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

async function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;
  const value = await env.KV.get('session:' + token);
  return !!value;
}

async function createFeedback(request, env, cors) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().slice(0, 200);
  const message = String(body.message || '').trim().slice(0, 5000);
  const type = String(body.type || '其他').slice(0, 40);
  const name = String(body.name || '').slice(0, 80);
  const app = String(body.app || 'EMCL').slice(0, 40);
  const version = String(body.version || '').slice(0, 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: '请填写有效邮箱' }, cors, 400);
  if (!message) return json({ ok: false, error: '请填写反馈内容' }, cors, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO feedback (id,name,email,type,message,app,version,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, name, email, type, message, app, version, 'new', Date.now()).run();
  return json({ ok: true, id }, cors);
}
