/* ===== database layer =====
   Works in two modes:
   1. remote  — if a CraveMood API is reachable (server/server.js), all writes go there
   2. local   — otherwise a JSON store in localStorage (default on GitHub Pages)
   Schema is identical in both modes, see db/schema.sql
*/
const DB = (() => {
  const KEY = 'cravemood.db.v1';
  const SCHEMA = { v: 1, users: [], moods: [], orders: [], chats: [], spins: [], settings: {} };
  let state = null, remote = false, base = '', ready = false;

  const uid = () => 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? Object.assign(clone(SCHEMA), JSON.parse(raw)) : clone(SCHEMA);
    } catch (e) { state = clone(SCHEMA); }
    if (!Array.isArray(state.users)) state.users = [];
    return state;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('DB: quota', e); }
  }

  /* password hashing — SHA-256 when available, deterministic fallback otherwise */
  async function hash(pw, salt) {
    const txt = salt + '::' + pw + '::cravemood';
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* insecure context */ }
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < txt.length; i++) {
      h1 ^= txt.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ txt.charCodeAt(i), 2654435761) >>> 0;
    }
    return 'fnv' + h1.toString(16) + h2.toString(16);
  }

  async function probe() {
    base = (window.CRAVEMOOD_API || '').replace(/\/$/, '');
    if (!base && location.protocol === 'file:') return false;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 1200);
      const r = await fetch((base || '') + '/api/health', { signal: c.signal, cache: 'no-store' });
      clearTimeout(t);
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.ok);
    } catch (e) { return false; }
  }

  async function api(path, body, key) {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['X-Admin-Key'] = key;
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  /* ---- public API ---- */
  return {
    get isRemote() { return remote; },
    get ready() { return ready; },

    async init() {
      remote = await probe();
      ready = true;
      return remote;
    },

    /* account */
    async register({ name, contact, password, lang, guest }) {
      if (remote) {
        const j = await api('/api/register', { name, contact, password, lang, guest });
        return j;
      }
      const s = load();
      const c = String(contact || '').trim().toLowerCase();
      if (!guest && s.users.some(u => (u.contact || '').toLowerCase() === c)) {
        return { ok: false, error: 'exists' };
      }
      const salt = Math.random().toString(36).slice(2, 10);
      const u = {
        id: uid(), name: String(name || '').trim().slice(0, 40),
        contact: c, lang: lang || 'id', salt,
        pw: guest ? '' : await hash(password || '', salt),
        guest: !!guest,
        created: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        moods: 0, orders: 0, chats: 0, spins: 0,
      };
      s.users.push(u); persist();
      return { ok: true, user: pub(u) };
    },

    async login({ contact, password }) {
      if (remote) return api('/api/login', { contact, password });
      const s = load();
      const c = String(contact || '').trim().toLowerCase();
      const u = s.users.find(x => (x.contact || '').toLowerCase() === c && !x.guest);
      if (!u) return { ok: false, error: 'bad' };
      const h = await hash(password || '', u.salt);
      if (h !== u.pw) return { ok: false, error: 'bad' };
      u.last_seen = new Date().toISOString(); persist();
      return { ok: true, user: pub(u) };
    },

    async me(id) {
      if (!id) return null;
      if (remote) {
        try { const j = await api('/api/me?id=' + encodeURIComponent(id)); return j.ok ? j.user : null; }
        catch (e) { return null; }
      }
      const u = load().users.find(x => x.id === id);
      return u ? pub(u) : null;
    },

    async users(adminKey) {
      if (remote) { const j = await api('/api/users', null, adminKey); return j.users || []; }
      return load().users.map(pub);
    },

    async touch(id) {
      if (remote) return;
      const u = load().users.find(x => x.id === id);
      if (u) { u.last_seen = new Date().toISOString(); persist(); }
    },

    /* activity */
    async addMood(userId, mood, date) {
      const d = date || new Date().toISOString().slice(0, 10);
      if (remote) { try { await api('/api/mood', { userId, mood, date: d }); } catch (e) {} }
      const s = load();
      s.moods = s.moods.filter(m => !(m.user_id === userId && m.date === d));
      s.moods.push({ user_id: userId, mood, date: d, at: new Date().toISOString() });
      const u = s.users.find(x => x.id === userId); if (u) u.moods = (u.moods || 0) + 1;
      persist();
    },

    async addOrder(userId, payload) {
      if (remote) { try { await api('/api/order', Object.assign({ userId }, payload)); } catch (e) {} }
      const s = load();
      s.orders.push(Object.assign({ id: 'o_' + Date.now().toString(36), user_id: userId, at: new Date().toISOString() }, payload));
      const u = s.users.find(x => x.id === userId); if (u) u.orders = (u.orders || 0) + 1;
      persist();
    },

    async logChat(userId, role, text) {
      const s = load();
      s.chats.push({ user_id: userId, role, text: String(text).slice(0, 500), at: new Date().toISOString() });
      if (s.chats.length > 800) s.chats = s.chats.slice(-800);
      const u = s.users.find(x => x.id === userId); if (u) u.chats = (u.chats || 0) + 1;
      persist();
    },

    async logSpin(userId, item) {
      const s = load();
      s.spins.push({ user_id: userId, item, at: new Date().toISOString() });
      if (s.spins.length > 500) s.spins = s.spins.slice(-500);
      const u = s.users.find(x => x.id === userId); if (u) u.spins = (u.spins || 0) + 1;
      persist();
    },

    moodsOf(userId) {
      return load().moods.filter(m => m.user_id === userId).map(m => ({ d: m.date, m: m.mood }));
    },

    /* settings blob (per device) */
    getSetting(k, dflt) {
      const s = load();
      return (s.settings && s.settings[k] !== undefined) ? s.settings[k] : dflt;
    },
    setSetting(k, v) {
      const s = load();
      s.settings[k] = v; persist();
    },

    /* export */
    dump() { return clone(load()); },
    async exportJSON(adminKey) {
      let data = null;
      if (remote && adminKey) { try { data = await api('/api/export', null, adminKey); } catch (e) { data = null; } }
      if (!data) data = load();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      dl(blob, 'cravemood-database-' + new Date().toISOString().slice(0, 10) + '.json');
    },
    async exportCSV(adminKey) {
      const rows = await this.users(adminKey);
      const head = ['id', 'name', 'contact', 'lang', 'guest', 'created', 'last_seen', 'moods', 'orders', 'chats', 'spins'];
      const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = [head.join(',')].concat(rows.map(r => head.map(h => esc(r[h])).join(','))).join('\r\n');
      dl(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'cravemood-registrants.csv');
    },
  };

  function pub(u) {
    return {
      id: u.id, name: u.name, contact: u.contact, lang: u.lang, guest: !!u.guest,
      created: u.created, last_seen: u.last_seen,
      moods: u.moods || 0, orders: u.orders || 0, chats: u.chats || 0, spins: u.spins || 0,
    };
  }
  function dl(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
})();
