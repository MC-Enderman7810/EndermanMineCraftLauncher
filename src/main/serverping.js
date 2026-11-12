'use strict';

const net = require('net');

function varInt(value) {
  let v = value >>> 0;
  const out = [];
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    out.push(b);
  } while (v !== 0);
  return Buffer.from(out);
}

function string(value) {
  const data = Buffer.from(String(value), 'utf8');
  return Buffer.concat([varInt(data.length), data]);
}

function packet(id, payload) {
  const body = Buffer.concat([varInt(id), payload || Buffer.alloc(0)]);
  return Buffer.concat([varInt(body.length), body]);
}

function readVarInt(buffer, offset) {
  let value = 0;
  let size = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buffer.length) return null;
    const byte = buffer[offset + i];
    value |= (byte & 0x7f) << (7 * i);
    size++;
    if ((byte & 0x80) === 0) return { value, size };
  }
  return { value, size };
}

function flattenDescription(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenDescription).filter(Boolean).join('');
  let text = value.text || '';
  if (Array.isArray(value.extra)) text += value.extra.map(flattenDescription).join('');
  return text;
}

function ping(host, port, timeoutMs = 5500) {
  return new Promise((resolve) => {
    const started = Date.now();
    let socket;
    let buffer = Buffer.alloc(0);
    let finished = false;

    function finish(result) {
      if (finished) return;
      finished = true;
      try { socket.destroy(); } catch (e) { /* ignore */ }
      resolve(Object.assign({ ok: false, latency: Date.now() - started, host, port }, result));
    }

    try {
      socket = net.connect({ host, port });
    } catch (e) {
      resolve({ ok: false, error: e.message, host, port, latency: 0 });
      return;
    }

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish({ error: '连接超时' }));
    socket.on('error', (e) => finish({ error: e.message || '连接失败' }));
    socket.on('close', () => { if (!finished) finish({ error: '服务器关闭了连接' }); });

    socket.on('connect', () => {
      const handshake = Buffer.concat([
        varInt(-1),
        string(host),
        (() => { const b = Buffer.alloc(2); b.writeUInt16BE(port, 0); return b; })(),
        varInt(1)
      ]);
      socket.write(packet(0, handshake));
      socket.write(packet(0, Buffer.alloc(0)));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length) {
        const length = readVarInt(buffer, 0);
        if (!length || buffer.length < length.size + length.value) return;
        const frame = buffer.subarray(length.size, length.size + length.value);
        buffer = buffer.subarray(length.size + length.value);
        const id = readVarInt(frame, 0);
        if (!id || id.value !== 0) continue;
        const textLength = readVarInt(frame, id.size);
        if (!textLength) continue;
        const raw = frame.subarray(id.size + textLength.size, id.size + textLength.size + textLength.value).toString('utf8');
        try {
          const data = JSON.parse(raw);
          const players = data.players || {};
          finish({
            ok: true,
            latency: Date.now() - started,
            version: data.version ? data.version.name : '',
            protocol: data.version ? data.version.protocol : null,
            online: Number(players.online) || 0,
            max: Number(players.max) || 0,
            motd: flattenDescription(data.description).trim(),
            favicon: typeof data.favicon === 'string' ? data.favicon : ''
          });
        } catch (e) {
          finish({ error: '服务器返回了无法解析的状态' });
        }
        return;
      }
    });
  });
}

module.exports = { ping };
