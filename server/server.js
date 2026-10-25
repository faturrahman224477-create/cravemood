/**
 * CraveMood API — zero-dependency Node server.
 * Provides a real, central database for registrations, moods, orders and spins,
 * and serves the single-file frontend.
 *
 *   node server/server.js            → http://localhost:8787
 *   ADMIN_KEY=cimo2026 node server.js
 *
 * Storage: server/data/db.json (JSON document store, atomic writes).
 * For production, swap `store` with Postgres — see db/schema.sql (identical columns).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json');
const PORT = process.env.PORT || 8787;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cimo2026';

/* ---------- store ---------- */
function blank() {
  return { v: 1, users: [], moods: [], orders: [], chats: [], spins: [], created: new Date().toISOString() };
}
let db;
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { db = blank(); save(); }
  for (const k of ['users', 'moods', 'orders', 'chats', 'spins']) if (!Array.isArray(db[k])) db[k] = [];
  return db;
}
let saving = false;
function save() {
  if (saving) return;
  saving = true;
  setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) {
      console.warn('db save failed:', e.message);
    }
    saving = false;
  }, 40);
}

const uid = p => p + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const aiCfg = () => (db.settings && db.settings.ai) || {};
const pub = u => ({
  id: u.id, name: u.name, contact: u.contact, lang: u.lang, guest: !!u.guest,
  created: u.created, last_seen: u.last_seen,
  moods: u.moods || 0, orders: u.orders || 0, chats: u.chats || 0, spins: u.spins || 0,
});

/* ---------- http helpers ---------- */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

/* ---------- routes ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = url.pathname;

  if (req.method === 'OPTIONS') return json(res, 204, {});

  /* ---- API ---- */
  if (p.startsWith('/api/')) {
    try {
      if (p === '/api/health') {
        return json(res, 200, { ok: true, mode: 'server', users: db.users.length, ai: !!aiCfg().key, at: new Date().toISOString() });
      }

      /* ---- AI: the key lives only here, never in the browser ---- */
      if (p === '/api/ai/status' && req.method === 'GET') {
        return json(res, 200, { ok: true, enabled: !!aiCfg().key, model: aiCfg().model || 'gpt-4o-mini' });
      }

      if (p === '/api/ai/config' && req.method === 'POST') {
        const key = req.headers['x-admin-key'] || url.searchParams.get('key');
        if (key !== ADMIN_KEY) return json(res, 401, { ok: false, error: 'admin key required' });
        const b = await readBody(req);
        db.settings = db.settings || {};
        db.settings.ai = {
          key: String(b.key || '').trim(),
          model: String(b.model || 'gpt-4o-mini').trim(),
          base: String(b.base || 'https://api.openai.com/v1').trim(),
        };
        save();
        return json(res, 200, { ok: true, enabled: !!db.settings.ai.key, model: db.settings.ai.model });
      }

      if (p === '/api/ai' && req.method === 'POST') {
        const cfg = aiCfg();
        if (!cfg.key) return json(res, 503, { ok: false, error: 'ai disabled' });
        const b = await readBody(req);
        const msgs = Array.isArray(b.messages) ? b.messages.slice(-16) : [];
        if (!msgs.length) return json(res, 400, { ok: false, error: 'messages required' });
        try {
          const r = await fetch(cfg.base.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
            body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: msgs, temperature: 0.85, max_tokens: 260 }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return json(res, 502, { ok: false, error: (j.error && j.error.message) || ('HTTP ' + r.status) });
          const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          return json(res, 200, { ok: true, text: (text || '').trim() });
        } catch (e) {
          return json(res, 502, { ok: false, error: String(e.message || e) });
        }
      }

      if (p === '/api/register' && req.method === 'POST') {
        const b = await readBody(req);
        const name = String(b.name || '').trim().slice(0, 40);
        const contact = String(b.contact || '').trim().toLowerCase();
        const lang = String(b.lang || 'id').slice(0, 4);
        if (!name) return json(res, 400, { ok: false, error: 'name required' });
        if (!b.guest && contact && db.users.some(u => u.contact === contact)) {
          return json(res, 409, { ok: false, error: 'exists' });
        }
        const salt = crypto.randomBytes(8).toString('hex');
        const u = {
          id: uid('u'), name, contact, lang, salt,
          pw: b.guest ? '' : hash(String(b.password || ''), salt),
          guest: !!b.guest,
          created: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          moods: 0, orders: 0, chats: 0, spins: 0,
        };
        db.users.push(u); save();
        return json(res, 201, { ok: true, user: pub(u) });
      }

      if (p === '/api/login' && req.method === 'POST') {
        const b = await readBody(req);
        const contact = String(b.contact || '').trim().toLowerCase();
        const u = db.users.find(x => x.contact === contact && !x.guest);
        if (!u || hash(String(b.password || ''), u.salt) !== u.pw) {
          return json(res, 401, { ok: false, error: 'bad' });
        }
        u.last_seen = new Date().toISOString(); save();
        return json(res, 200, { ok: true, user: pub(u) });
      }

      if (p === '/api/me' && req.method === 'GET') {
        const id = url.searchParams.get('id') || '';
        const u = db.users.find(x => x.id === id);
        if (!u) return json(res, 404, { ok: false, error: 'not found' });
        return json(res, 200, { ok: true, user: pub(u) });
      }

      if (p === '/api/users' && req.method === 'GET') {
        const key = req.headers['x-admin-key'] || url.searchParams.get('key');
        if (key !== ADMIN_KEY) return json(res, 401, { ok: false, error: 'admin key required' });
        return json(res, 200, { ok: true, users: db.users.map(pub) });
      }

      if (p === '/api/mood' && req.method === 'POST') {
        const b = await readBody(req);
        const date = String(b.date || new Date().toISOString().slice(0, 10));
        db.moods = db.moods.filter(m => !(m.user_id === b.userId && m.date === date));
        db.moods.push({ user_id: b.userId, mood: String(b.mood || ''), date, at: new Date().toISOString() });
        const u = db.users.find(x => x.id === b.userId); if (u) u.moods = (u.moods || 0) + 1;
        save();
        return json(res, 200, { ok: true });
      }

      if (p === '/api/order' && req.method === 'POST') {
        const b = await readBody(req);
        db.orders.push(Object.assign({ id: uid('o'), at: new Date().toISOString() }, b));
        const u = db.users.find(x => x.id === b.userId); if (u) u.orders = (u.orders || 0) + 1;
        save();
        return json(res, 200, { ok: true });
      }

      if (p === '/api/chat' && req.method === 'POST') {
        const b = await readBody(req);
        db.chats.push({ user_id: b.userId, role: b.role, text: String(b.text || '').slice(0, 500), at: new Date().toISOString() });
        if (db.chats.length > 5000) db.chats = db.chats.slice(-5000);
        const u = db.users.find(x => x.id === b.userId); if (u) u.chats = (u.chats || 0) + 1;
        save();
        return json(res, 200, { ok: true });
      }

      if (p === '/api/spin' && req.method === 'POST') {
        const b = await readBody(req);
        db.spins.push({ user_id: b.userId, item: b.item, at: new Date().toISOString() });
        const u = db.users.find(x => x.id === b.userId); if (u) u.spins = (u.spins || 0) + 1;
        save();
        return json(res, 200, { ok: true });
      }

      if (p === '/api/export' && req.method === 'GET') {
        const key = req.headers['x-admin-key'] || url.searchParams.get('key');
        if (key !== ADMIN_KEY) return json(res, 401, { ok: false, error: 'admin key required' });
        return json(res, 200, db);
      }

      return json(res, 404, { ok: false, error: 'no such endpoint' });
    } catch (e) {
      return json(res, 500, { ok: false, error: String(e.message || e) });
    }
  }

  /* ---- static ---- */
  let file = p === '/' ? '/index.html' : p;
  file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT)) return json(res, 403, { ok: false, error: 'forbidden' });
  fs.readFile(full, (err, buf) => {
    if (err) {
      // SPA fallback
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, b2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(b2);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

load();
server.listen(PORT, () => {
  console.log(`CraveMood API  →  http://localhost:${PORT}`);
  console.log(`database       →  ${DB_FILE}`);
  console.log(`registrants    →  ${db.users.length}`);
  console.log(`admin key      →  ${ADMIN_KEY}`);
});
