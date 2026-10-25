/* ===== CraveMood · Developer Console ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dt = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const dOnly = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); };

const DC = { key: '', data: null, tab: 'overview', q: '', ai: { enabled: false, model: '' } };

const NAV = [
  ['overview', 'Ringkasan', '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'],
  ['users', 'Pengguna', '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>'],
  ['moods', 'Mood', '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'],
  ['orders', 'Pesanan', '<path d="M6 8h12l-1 12H7z"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0"/>'],
  ['chats', 'Chat', '<path d="M21 12a8 8 0 0 1-8 8H8l-4 3V12a8 8 0 0 1 8-8h1a8 8 0 0 1 8 8z"/>'],
  ['spins', 'Spinner', '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>'],
  ['ai', 'Otak Cimo', '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>'],
  ['umkm', 'UMKM', '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>'],
  ['export', 'Database', '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'],
];

/* ---------- boot ---------- */
(async function boot() {
  await DB.init();
  renderSide();
  renderHead();
  const saved = sessionStorage.getItem('cm_dev_key');
  if (saved && await tryLogin(saved, true)) return;
  renderGate();
})();

function renderSide() {
  $('#devside').innerHTML = `
    <div class="brand">
      <div class="lg"><span>Crave</span><mark>Mood</mark></div>
      <div class="tagline">Developer</div>
    </div>
    ${NAV.map(([k, n, ic]) => `<button class="dnav" data-tab="${k}">
      <svg viewBox="0 0 24 24">${ic}</svg><span>${n}</span><b class="n" id="nav-${k}"></b></button>`).join('')}
    <div class="dsidefoot">
      <a href="index.html" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9"><path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
        Buka aplikasi publik</a>
      <button id="devLogout">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9"><path d="M15 17l5-5-5-5M20 12H9M12 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6"/></svg>
        Keluar</button>
    </div>`;
  $$('#devside [data-tab]').forEach(b => b.onclick = () => { DC.tab = b.dataset.tab; DC.q = ''; render(); });
  $('#devLogout').onclick = () => { sessionStorage.removeItem('cm_dev_key'); location.reload(); };
}

function renderHead() {
  $('#devheadright').innerHTML = `
    <span class="pill ${DB.isRemote ? '' : 'off'}"><i></i>${DB.isRemote ? 'Server DB' : 'Local DB'}</span>
    <button class="btn sm ghost" id="devRefresh">Muat ulang</button>`;
  const r = $('#devRefresh');
  if (r) r.onclick = () => { load().then(() => toast('Data dimuat ulang')).catch(e => toast('Gagal: ' + e.message)); };
}

function toast(m) {
  let el = $('#dtoast');
  if (!el) { el = document.createElement('div'); el.id = 'dtoast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = m; el.classList.add('on');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2200);
}

/* ---------- gate ---------- */
function renderGate() {
  $('#gate').innerHTML = `
    <div class="gate">
      <div class="cimo">${cimo('def', 100)}</div>
      <h2>Developer Console</h2>
      <p>Masukkan kunci admin untuk membuka database.</p>
      <input id="devKey" type="password" placeholder="••••••" autocomplete="current-password">
      <div class="err" id="devErr"></div>
      <button class="btn block" id="devGo" style="margin-top:8px">Buka console</button>
      <p class="mini" style="margin-top:12px">Default: <b>cimo2026</b> — ubah lewat env <code>ADMIN_KEY</code> di server.</p>
    </div>`;
  $('#devKey').onkeydown = e => { if (e.key === 'Enter') $('#devGo').click(); };
  $('#devGo').onclick = async () => {
    const k = $('#devKey').value.trim();
    if (!k) return;
    const ok = await tryLogin(k);
    if (!ok) { $('#devErr').textContent = 'Kunci salah atau server menolak.'; }
  };
  setTimeout(() => $('#devKey') && $('#devKey').focus(), 120);
}

async function tryLogin(k, silent) {
  if (DB.isRemote) {
    try {
      const r = await fetch('api/users', { headers: { 'X-Admin-Key': k }, cache: 'no-store' });
      if (!r.ok) return false;
    } catch (e) { return false; }
  } else if (k !== 'cimo2026' && k !== 'cravemood') return false;
  DC.key = k;
  sessionStorage.setItem('cm_dev_key', k);
  try { await load(); } catch (e) { if (!silent) toast('Gagal memuat: ' + e.message); return false; }
  return true;
}

async function load() {
  if (DB.isRemote) {
    const r = await fetch('api/export?key=' + encodeURIComponent(DC.key), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DC.data = await r.json();
    try {
      const s = await fetch('api/ai/status', { cache: 'no-store' });
      const j = await s.json(); DC.ai = { enabled: !!j.enabled, model: j.model || '' };
    } catch (e) { DC.ai = { enabled: false, model: '' }; }
  } else {
    DC.data = DB.dump();
    DC.ai = { enabled: false, model: '' };
  }
  ['users', 'moods', 'orders', 'chats', 'spins', 'umkms'].forEach(k => { if (!Array.isArray(DC.data[k])) DC.data[k] = []; });
  $('#gate').innerHTML = '';
  $('#console').classList.remove('hide');
  render();
}

/* ---------- helpers ---------- */
const uName = id => {
  const u = (DC.data.users || []).find(x => x.id === id);
  return u ? u.name : (id ? String(id).slice(0, 8) : '—');
};
const moodOf = k => (MOODS.find(m => m.k === k) || { label: k, c: '#ddd', face: 'def' });
const dishOf = id => (MENU.find(m => m.id === id) || { name: id });

function csv(rows, cols, name) {
  const esc2 = v => '"' + String(v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)).replace(/"/g, '""') + '"';
  const body = [cols.map(c => c.k).join(',')].concat(rows.map(r => cols.map(c => esc2(typeof c.v === 'function' ? c.v(r) : r[c.v || c.k])).join(','))).join('\r\n');
  const blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'cravemood-' + name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  toast('CSV ' + name + ' diunduh');
}
function jsonDump() {
  const blob = new Blob([JSON.stringify(DC.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'cravemood-database-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  toast('Database JSON diunduh');
}

/* ---------- render ---------- */
function render() {
  $$('#devside [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === DC.tab));
  const c = $('#console');
  const R = { overview: vOverview, users: vUsers, moods: vMoods, orders: vOrders, chats: vChats, spins: vSpins, ai: vAI, umkm: vUmkm, export: vExport };
  c.innerHTML = (R[DC.tab] || vOverview)();
  bind();
  // sidebar counters
  const n = k => $('#nav-' + k);
  if (n('users')) n('users').textContent = (DC.data.users || []).length;
  if (n('chats')) n('chats').textContent = (DC.data.chats || []).length;
  if (n('orders')) n('orders').textContent = (DC.data.orders || []).length;
  if (n('umkm')) n('umkm').textContent = (DC.data.umkms || []).length;
}

function vOverview() {
  const d = DC.data, U = d.users || [];
  const members = U.filter(u => !u.guest).length;
  const days = {};
  (d.moods || []).forEach(m => days[m.date] = (days[m.date] || 0) + 1);
  const moodCount = {};
  (d.moods || []).forEach(m => moodCount[m.mood] = (moodCount[m.mood] || 0) + 1);
  const mxMood = Math.max(1, ...Object.values(moodCount));

  // signups last 14 days
  const today = new Date(); const series = [];
  for (let i = 13; i >= 0; i--) {
    const dt2 = new Date(today); dt2.setDate(today.getDate() - i);
    const key = dt2.toISOString().slice(0, 10);
    series.push({ key, n: U.filter(u => (u.created || '').slice(0, 10) === key).length });
  }
  const mxS = Math.max(1, ...series.map(s => s.n));

  const spinCount = {};
  (d.spins || []).forEach(s => spinCount[s.item] = (spinCount[s.item] || 0) + 1);
  const topDish = Object.entries(spinCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
  <div class="kpis">
    <div class="kpi acc"><small>Pengguna</small><b>${nf(U.length)}</b></div>
    <div class="kpi"><small>Member</small><b>${nf(members)}</b></div>
    <div class="kpi"><small>Mood dicatat</small><b>${nf((d.moods || []).length)}</b></div>
    <div class="kpi"><small>Chat</small><b>${nf((d.chats || []).length)}</b></div>
    <div class="kpi"><small>Pesanan</small><b>${nf((d.orders || []).length)}</b></div>
    <div class="kpi"><small>Putaran</small><b>${nf((d.spins || []).length)}</b></div>
  </div>
  <div class="dgrid">
    <div class="dcard">
      <h3>Pendaftar 14 hari terakhir</h3>
      <div class="spark">${series.map(s => `<i style="height:${Math.max(4, (s.n / mxS) * 100)}%" title="${s.key}: ${s.n}"></i>`).join('')}</div>
      <div class="mini" style="display:flex;justify-content:space-between;margin-top:6px">
        <span>${series[0].key.slice(5)}</span><span>${series[series.length - 1].key.slice(5)}</span></div>
    </div>
    <div class="dcard">
      <h3>Distribusi mood</h3>
      ${MOODS.map(m => {
        const v = moodCount[m.k] || 0;
        return `<div class="dbar"><span class="lbl"><span style="width:18px;height:18px">${cimo(m.face, 16)}</span>${m.label}</span>
          <div class="tr"><i style="width:${(v / mxMood) * 100}%;background:${m.c}"></i></div><span class="v">${v}</span></div>`;
      }).join('')}
    </div>
    <div class="dcard">
      <h3>Menu paling sering diputar</h3>
      ${topDish.length ? topDish.map(([id, v]) => `<div class="dbar"><span class="lbl" style="width:120px">${esc(dishOf(id).name)}</span>
        <div class="tr"><i style="width:${(v / topDish[0][1]) * 100}%;background:var(--pk2)"></i></div><span class="v">${v}</span></div>`).join('')
        : '<p class="mini">Belum ada data putaran.</p>'}
    </div>
    <div class="dcard">
      <h3>Status sistem</h3>
      <div class="dbar"><span class="lbl" style="width:100px">Database</span><b style="font-size:.74rem">${DB.isRemote ? 'API server' : 'localStorage'}</b></div>
      <div class="dbar"><span class="lbl" style="width:100px">Otak Cimo</span><b style="font-size:.74rem">${DC.ai.enabled ? 'AI aktif (' + esc(DC.ai.model) + ')' : 'Mesin lokal'}</b></div>
      <div class="dbar"><span class="lbl" style="width:100px">Hari tercatat</span><b style="font-size:.74rem">${Object.keys(days).length}</b></div>
      <button class="btn sm block" data-go="export" style="margin-top:10px">Unduh database</button>
    </div>
  </div>`;
}

function searchBar(ph) {
  return `<div class="searchrow"><input id="dq" placeholder="${ph}" value="${esc(DC.q)}">
    <button class="btn sm ghost" id="dqClear">Reset</button></div>`;
}

function vUsers() {
  const q = DC.q.toLowerCase();
  const rows = (DC.data.users || []).filter(u => !q || JSON.stringify(u).toLowerCase().includes(q))
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  return `<div class="dcard">
    <h3>Pengguna terdaftar <span class="tag">${rows.length}</span></h3>
    ${searchBar('Cari nama, kontak, bahasa…')}
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm ghost" id="csvUsers">Unduh CSV</button>
      <span class="mini">Termasuk tamu (guest).</span>
    </div>
    <div class="dtable"><table><thead><tr>
      <th>Nama</th><th>Kontak</th><th>Bahasa</th><th>Status</th><th>Daftar</th><th>Terakhir</th><th>Mood</th><th>Chat</th><th>Order</th><th>Spin</th>
    </tr></thead><tbody>
      ${rows.length ? rows.map(u => `<tr>
        <td><b>${esc(u.name)}</b></td>
        <td>${esc(u.contact || '—')}</td>
        <td>${esc(u.lang || 'id')}</td>
        <td>${u.guest ? '<span class="tag">guest</span>' : '<span class="tag mint">member</span>'}</td>
        <td>${dOnly(u.created)}</td><td>${dt(u.last_seen)}</td>
        <td>${u.moods || 0}</td><td>${u.chats || 0}</td><td>${u.orders || 0}</td><td>${u.spins || 0}</td>
      </tr>`).join('') : '<tr><td colspan="10" style="text-align:center;padding:22px">Belum ada pengguna.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function vMoods() {
  const q = DC.q.toLowerCase();
  const rows = (DC.data.moods || []).filter(m => !q || (uName(m.user_id) + m.mood + m.date).toLowerCase().includes(q))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<div class="dcard">
    <h3>Catatan mood <span class="tag">${rows.length}</span></h3>
    ${searchBar('Cari nama, mood, tanggal…')}
    <div class="row" style="margin-bottom:10px"><button class="btn sm ghost" id="csvMoods">Unduh CSV</button></div>
    <div class="dtable"><table><thead><tr><th>Tanggal</th><th>Pengguna</th><th>Mood</th><th>Dicatat</th></tr></thead><tbody>
      ${rows.length ? rows.slice(0, 500).map(m => `<tr>
        <td>${esc(m.date)}</td><td>${esc(uName(m.user_id))}</td>
        <td><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:18px;height:18px">${cimo(moodOf(m.mood).face, 16)}</span>${esc(moodOf(m.mood).label)}</span></td>
        <td>${dt(m.at)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:22px">Belum ada catatan mood.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function vOrders() {
  const rows = (DC.data.orders || []).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return `<div class="dcard">
    <h3>Pesanan & klik platform <span class="tag">${rows.length}</span></h3>
    <div class="row" style="margin-bottom:10px"><button class="btn sm ghost" id="csvOrders">Unduh CSV</button></div>
    <div class="dtable"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Jenis</th><th>Platform</th><th>Item</th></tr></thead><tbody>
      ${rows.length ? rows.map(o => `<tr>
        <td>${dt(o.at)}</td><td>${esc(uName(o.user_id))}</td><td>${esc(o.kind || '—')}</td>
        <td>${esc(o.platform || '—')}</td>
        <td class="wrap">${esc(Array.isArray(o.items) ? o.items.map(i => dishOf(i).name).join(', ') : (o.item || '—'))}</td>
      </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:22px">Belum ada pesanan.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function vChats() {
  const q = DC.q.toLowerCase();
  const rows = (DC.data.chats || []).filter(c => !q || (uName(c.user_id) + c.text).toLowerCase().includes(q))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return `<div class="dcard">
    <h3>Transkrip chat <span class="tag">${rows.length}</span></h3>
    ${searchBar('Cari isi chat atau nama…')}
    <div class="row" style="margin-bottom:10px"><button class="btn sm ghost" id="csvChats">Unduh CSV</button></div>
    <div class="dtable"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Peran</th><th>Isi</th></tr></thead><tbody>
      ${rows.length ? rows.slice(0, 400).map(c => `<tr>
        <td>${dt(c.at)}</td><td>${esc(uName(c.user_id))}</td>
        <td>${c.role === 'user' ? '<span class="tag">user</span>' : c.role === 'system' ? '<span class="tag gold">system</span>' : '<span class="tag pink">cimo</span>'}</td>
        <td class="wrap">${esc(c.text)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:22px">Belum ada chat.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function vSpins() {
  const rows = (DC.data.spins || []).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return `<div class="dcard">
    <h3>Riwayat spinner <span class="tag">${rows.length}</span></h3>
    <div class="row" style="margin-bottom:10px"><button class="btn sm ghost" id="csvSpins">Unduh CSV</button></div>
    <div class="dtable"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Menu</th></tr></thead><tbody>
      ${rows.length ? rows.map(s => `<tr><td>${dt(s.at)}</td><td>${esc(uName(s.user_id))}</td><td>${esc(dishOf(s.item).name)}</td></tr>`).join('')
        : '<tr><td colspan="3" style="text-align:center;padding:22px">Belum ada putaran.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function vAI() {
  const local = !DB.isRemote;
  return `<div class="dcard">
    <h3>Otak Cimo (AI)</h3>
    <p class="mini" style="margin-bottom:12px">Kunci API disimpan di server, tidak pernah dikirim ke browser pengguna. Kalau kosong, chat memakai mesin lokal Cimo yang tetap jalan penuh.</p>
    ${local ? `<div class="inote" style="margin-bottom:12px"><b>Mode statis.</b> Tanpa server, kunci ini tidak bisa dipakai bersama. Jalankan <code>node server/server.js</code> untuk mengaktifkan AI untuk semua pengguna.</div>` : ''}
    <div class="airow">
      <div class="field"><label>API key</label><input id="aiKey" type="password" placeholder="sk-..." ${local ? 'disabled' : ''}></div>
      <div class="field"><label>Model</label><input id="aiModel" placeholder="gpt-4o-mini" value="${esc(DC.ai.model || 'gpt-4o-mini')}" ${local ? 'disabled' : ''}></div>
    </div>
    <div class="field"><label>Base URL</label><input id="aiBase" value="https://api.openai.com/v1" ${local ? 'disabled' : ''}></div>
    <div class="row">
      <button class="btn sm" id="aiSave" ${local ? 'disabled' : ''}>Simpan kunci</button>
      <button class="btn sm ghost" id="aiTest" ${local ? 'disabled' : ''}>Tes koneksi</button>
      <span class="mini" id="aiStat">${DC.ai.enabled ? 'Aktif · ' + esc(DC.ai.model) : 'Belum aktif'}</span>
    </div>
    <div class="inote" style="margin-top:14px">Format kompatibel OpenAI: OpenAI, Groq, Together, OpenRouter, atau endpoint lokal (Ollama/LM Studio) — cukup ganti Base URL dan model.</div>
  </div>`;
}

function vUmkm() {
  const rows = (DC.data.umkms || []).slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  return `<div class="dcard">
    <h3>UMKM terdaftar <span class="tag">${rows.length}</span></h3>
    <div class="dtable"><table><thead><tr><th>Nama Usaha</th><th>Pemilik</th><th>WA</th><th>Alamat</th><th>Status</th><th>Views</th><th>Clicks</th><th>Daftar</th></tr></thead><tbody>
      ${rows.length ? rows.map(u => `<tr>
        <td><b>${esc(u.name)}</b></td><td>${esc(u.owner || '—')}</td><td>${esc(u.wa || '—')}</td>
        <td>${esc(u.addr || '—')}</td>
        <td>${u.status === 'approved' ? '<span class="tag mint">approved</span>' : '<span class="tag gold">pending</span>'}</td>
        <td>${u.views || 0}</td><td>${u.clicks || 0}</td><td>${dOnly(u.created)}</td>
      </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;padding:22px">Belum ada UMKM terdaftar.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function vExport() {
  const d = DC.data;
  const rows = [
    ['users', 'Pengguna', (d.users || []).length],
    ['moods', 'Mood', (d.moods || []).length],
    ['orders', 'Pesanan', (d.orders || []).length],
    ['chats', 'Chat', (d.chats || []).length],
    ['spins', 'Putaran', (d.spins || []).length],
  ];
  return `<div class="dcard">
    <h3>Database</h3>
    <p class="mini" style="margin-bottom:12px">Sumber: <b>${DB.isRemote ? 'API server · server/data/db.json' : 'localStorage perangkat ini'}</b>.
    Skema relasional ada di <code>db/schema.sql</code>.</p>
    <div class="kpis" style="margin-bottom:14px">
      ${rows.map(([k, n, v]) => `<div class="kpi"><small>${n}</small><b>${nf(v)}</b></div>`).join('')}
    </div>
    <div class="row">
      <button class="btn sm" id="dlJson">Unduh semua (JSON)</button>
      ${rows.map(([k, n]) => `<button class="btn sm ghost" data-csv="${k}">CSV ${n}</button>`).join('')}
    </div>
    <div class="inote" style="margin-top:14px">
      <b>Tips:</b> file JSON ini bisa langsung diimpor ke Postgres/Supabase memakai <code>db/schema.sql</code>,
      atau disimpan sebagai cadangan. Data live juga tersimpan di <code>server/data/db.json</code>.
    </div>
  </div>`;
}

/* ---------- events ---------- */
function bind() {
  const q = $('#dq');
  if (q) {
    q.oninput = () => {
      DC.q = q.value;
      const pos = q.selectionStart;
      render();
      const nq = $('#dq'); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
    };
  }
  const qc = $('#dqClear');
  if (qc) qc.onclick = () => { DC.q = ''; render(); };

  const c1 = $('#csvUsers'); if (c1) c1.onclick = () => csv(DC.data.users || [], [
    { k: 'name' }, { k: 'contact' }, { k: 'lang' }, { k: 'guest' }, { k: 'created' }, { k: 'last_seen' },
    { k: 'moods' }, { k: 'orders' }, { k: 'chats' }, { k: 'spins' }, { k: 'id' },
  ], 'users');
  const c2 = $('#csvMoods'); if (c2) c2.onclick = () => csv(DC.data.moods || [], [
    { k: 'date' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'mood' }, { k: 'at' },
  ], 'moods');
  const c3 = $('#csvOrders'); if (c3) c3.onclick = () => csv(DC.data.orders || [], [
    { k: 'at' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'kind' }, { k: 'platform' },
    { k: 'items', v: r => Array.isArray(r.items) ? r.items.join(' | ') : (r.item || '') },
  ], 'orders');
  const c4 = $('#csvChats'); if (c4) c4.onclick = () => csv(DC.data.chats || [], [
    { k: 'at' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'role' }, { k: 'text' },
  ], 'chats');
  const c5 = $('#csvSpins'); if (c5) c5.onclick = () => csv(DC.data.spins || [], [
    { k: 'at' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'menu', v: r => dishOf(r.item).name },
  ], 'spins');

  $$('[data-go]').forEach(b => b.onclick = () => { DC.tab = b.dataset.go; render(); });
  const dj = $('#dlJson'); if (dj) dj.onclick = jsonDump;
  $$('[data-csv]').forEach(b => b.onclick = () => {
    const k = b.dataset.csv;
    if (k === 'users') csv(DC.data.users || [], [{ k: 'name' }, { k: 'contact' }, { k: 'lang' }, { k: 'guest' }, { k: 'created' }], 'users');
    if (k === 'moods') csv(DC.data.moods || [], [{ k: 'date' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'mood' }], 'moods');
    if (k === 'orders') csv(DC.data.orders || [], [{ k: 'at' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'platform' }], 'orders');
    if (k === 'chats') csv(DC.data.chats || [], [{ k: 'at' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'role' }, { k: 'text' }], 'chats');
    if (k === 'spins') csv(DC.data.spins || [], [{ k: 'at' }, { k: 'user', v: r => uName(r.user_id) }, { k: 'menu', v: r => dishOf(r.item).name }], 'spins');
  });

  const save = $('#aiSave');
  if (save) save.onclick = async () => {
    const key = $('#aiKey').value.trim(), model = $('#aiModel').value.trim() || 'gpt-4o-mini', base = $('#aiBase').value.trim() || 'https://api.openai.com/v1';
    try {
      const r = await fetch('api/ai/config?key=' + encodeURIComponent(DC.key), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, model, base }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      DC.ai = { enabled: !!j.enabled, model: j.model };
      $('#aiStat').textContent = j.enabled ? 'Aktif · ' + j.model : 'Belum aktif';
      toast(j.enabled ? 'Kunci disimpan di server' : 'Kunci dikosongkan');
    } catch (e) { toast('Gagal: ' + e.message); }
  };
  const test = $('#aiTest');
  if (test) test.onclick = async () => {
    test.disabled = true; test.textContent = 'Menguji…';
    try {
      const r = await fetch('api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Balas satu kata: halo' }] }),
      });
      const j = await r.json();
      toast(j.ok ? 'AI menjawab: ' + (j.text || '').slice(0, 40) : 'Gagal: ' + (j.error || r.status));
    } catch (e) { toast('Gagal: ' + e.message); }
    test.disabled = false; test.textContent = 'Tes koneksi';
  };
}
