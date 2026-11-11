/* ===== CraveMood app ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* canonical public link — used whenever the current address is not the real hosted URL
   (e.g. inside the Android app the page runs on https://localhost) */
const PUBLIC_URL = 'https://cravemood.apps.workbuddy.host/?sharecode=NG6DCXKIRE';
function appLink() {
  const here = location.href.split('#')[0];
  if (/^https?:\/\//i.test(here) && /sharecode=/.test(here)) return here;
  return PUBLIC_URL;
}

/* capek & kecewa are no longer offered — their dishes now answer to sedih */
try {
  MENU.forEach(m => {
    if (m.moods && (m.moods.indexOf('capek') > -1 || m.moods.indexOf('kecewa') > -1)) {
      m.moods = Array.from(new Set(m.moods.concat('sedih')));
    }
  });
} catch (e) {}

const App = {
  user: null, lang: 'id', mood: 'senang', cat: 'Semua', street: 'pendidikan',
  cart: {}, messages: [], spinning: false, lastSpin: null, costum: '', moodPicked: false,
  settings: { sound: true, speak: true, vol: 1, voiceLang: 'id', theme: 'light' },
};

const t = k => {
  const d = I18N[App.lang] || I18N.id;
  return d[k] !== undefined ? d[k] : (I18N.en[k] !== undefined ? I18N.en[k] : k);
};
/* mood / category labels in the active language */
function mL(m) { const x = MOODI18N[m.k]; return (x && x[App.lang] && x[App.lang][0]) || m.label; }
function mS(m) { const x = MOODI18N[m.k]; return (x && x[App.lang] && x[App.lang][1]) || m.sub; }
function mD(m) { const x = MOODI18N[m.k]; return (x && x[App.lang] && x[App.lang][2]) || m.dish; }
function cL(c) { const x = CATI18N[c]; return (x && x[App.lang]) || c; }
/* full sentence Cimo says for a mood, with the top pick baked in */
function mSay(m, dish) {
  const bank = MOODSAY[m.k] || MOODSAY.bingung;
  const tpl = bank[App.lang] || bank.id;
  const nm = (App.user && App.user.name) || (App.lang === 'en' ? 'you' : App.lang === 'zh' ? '你' : App.lang === 'hi' ? 'तुम' : 'kamu');
  return tpl.replace(/\{name\}/g, nm).replace(/\{dish\}/g, dish || mD(m));
}

/* ---------- distance ---------- */
function distKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.max(0.6, 2 * R * Math.asin(Math.sqrt(h)) * 1.25);
}
function streetOf(i) { return STREETS[i] || STREETS[0]; }
function curStreet() { return STREETS.find(s => s.id === App.street) || STREETS[0]; }
function distOf(item) { return +(distKm(curStreet(), streetOf(item.st)) + jitter(item.id)).toFixed(1); }
function minsOf(item) { return Math.max(8, Math.round(distOf(item) * 3.6)); }
function jitter(id) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return (h % 16) / 10; }

/* ---------- persistence ---------- */
function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(App.cart)); } catch (e) {} }
function loadCart() { try { App.cart = JSON.parse(localStorage.getItem(CART_KEY) || '{}') || {}; } catch (e) { App.cart = {}; } }
function saveSettings() { DB.setSetting('settings', App.settings); }
function savePrefs() { DB.setSetting('prefs', { lang: App.lang, mood: App.mood, street: App.street, costum: App.costum, pet: App.pet }); }
function loadPrefs() {
  const p = DB.getSetting('prefs', {});
  if (p.lang && I18N[p.lang]) App.lang = p.lang;
  if (p.mood) App.mood = normMood(p.mood);
  if (p.street) App.street = p.street;
  if (p.costum) App.costum = p.costum;
  App.pet = p.pet || null;
  const s = DB.getSetting('settings', null);
  if (s) App.settings = Object.assign(App.settings, s);
  Voice.setAll({ volume: App.settings.vol, enabled: App.settings.speak });
  SFX.enabled = App.settings.sound;
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const e = $('#toast');
  e.textContent = msg; e.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => e.classList.remove('on'), 2400);
}

/* ---------- theme ---------- */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', App.settings.theme || 'light');
}

/* ---------- mood-tinted page background ----------
   the whole page shifts to the colour of the emotion the user tapped
   (marah = warm orange, bingung = mint, sedih = soft blue, ...) */
function hex2rgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mixHex(base, color, t) {
  const A = hex2rgb(base), B = hex2rgb(color);
  const c = i => Math.round(A[i] * (1 - t) + B[i] * t);
  return '#' + [c(0), c(1), c(2)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function applyMoodBg() {
  const root = document.documentElement;
  const m = MOODS.find(x => x.k === App.mood);
  const picked = !!App.moodPicked;
  const c = (picked && m) ? m.c : '#ff9ec5';
  const A = mixHex('#ffffff', c, picked ? 0.40 : 0.26);
  const B = mixHex('#ffffff', c, picked ? 0.24 : 0.16);
  const C = mixHex('#fff2ea', c, picked ? 0.11 : 0.07);
  const D = mixHex('#fff6ef', c, picked ? 0.04 : 0.02);
  root.style.setProperty('--bgA', A);
  root.style.setProperty('--bgB', B);
  root.style.setProperty('--bgC', C);
  root.style.setProperty('--bgD', D);
  root.style.setProperty('--moodc', c);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', A);
}

/* ---------- cart ---------- */
function cartCount() { return Object.values(App.cart).reduce((a, b) => a + b, 0); }
function cartTotals() {
  let c = 0, lo = 0, hi = 0;
  for (const id in App.cart) {
    const it = MENU.find(m => m.id === id); if (!it) continue;
    const q = App.cart[id];
    c += q; lo += q * it.lo; hi += q * it.hi;
  }
  return { c, lo, hi };
}
function addToCart(id, silent) {
  App.cart[id] = (App.cart[id] || 0) + 1;
  saveCart(); SFX.play('add');
  const it = MENU.find(m => m.id === id);
  if (!silent) toast((it ? it.name : '') + ' ' + t('add_ok'));
  updateCartBar();
  if (currentView === 'home') renderRecs();
  else if (currentView === 'cart') renderCart();
  else if (currentView === 'spin') { const b = $('#spinResult'); if (b && App.lastSpin) renderSpinResult(App.lastSpin); }
}
function decCart(id) {
  if (!App.cart[id]) return;
  App.cart[id]--; SFX.play('remove');
  if (App.cart[id] <= 0) delete App.cart[id];
  saveCart(); updateCartBar();
  if (currentView === 'home') renderRecs();
  else if (currentView === 'cart') renderCart();
  else if (currentView === 'spin') { const b = $('#spinResult'); if (b && App.lastSpin) renderSpinResult(App.lastSpin); }
}
function updateCartBar() {
  const { c, lo, hi } = cartTotals();
  const bar = $('#cartbar');
  const hide = currentView === 'cart' || currentView === 'chat';
  bar.classList.toggle('on', c > 0 && !hide);
  $('#cbt').textContent = `🛒 ${c} ${t('item')} · ±${rp(lo)} – ${rp(hi)}`;
  const b = $('#navbadge'); if (b) { b.textContent = c; b.style.display = c ? 'grid' : 'none'; }
  const tb = $('#tabbadge'); if (tb) { tb.textContent = c; tb.style.display = c ? 'grid' : 'none'; }
  const mb = $('#topbadge'); if (mb) { mb.textContent = c; mb.style.display = c ? 'grid' : 'none'; }
}

/* ---------- nav ---------- */
/* VIP is intentionally NOT a tab — it lives inside Profil */
const NAV = [
  ['home', 'home', 'nav_home'],
  ['recap', 'recap', 'nav_recap'],
  ['cart', 'bag', 'nav_cart'],
  ['profile', 'user', 'nav_profile'],
];

function renderNav() {
  const sb = $('#navlist');
  sb.innerHTML = NAV.map(([v, ic, k]) =>
    `<button class="navbtn" data-go="${v}">${icon(ic)}<span>${t(k)}</span>${v === 'cart' ? `<span class="bdg" id="navbadge" style="display:none">0</span>` : ''}</button>`
  ).join('');
  const tb = $('#tabbar');
  tb.innerHTML = NAV.map(([v, ic, k]) =>
    `<button data-go="${v}">${icon(ic)}<span>${t(k)}</span>${v === 'cart' ? `<span class="bdg" id="tabbadge" style="display:none">0</span>` : ''}</button>`
  ).join('');
  const s = $('#sidefoot');
  if (s) s.innerHTML = `
    <div class="minicard">
      <div style="width:38px;height:38px;flex:none">${cimo(App.mood, 36, false, App.costum)}</div>
      <div style="min-width:0"><b>${esc(App.user ? App.user.name : t('guest'))}</b><small>${esc(curStreet().name.replace('Jalan ', 'Jl. '))}</small></div>
    </div>
    <button class="navbtn" data-go="chat" style="font-size:.82rem">${icon('chat')}<span>${t('nav_chat')}</span></button>
    <button class="navbtn" data-go="profile" style="font-size:.82rem">${icon('gear')}<span>${t('nav_profile')}</span></button>`;
  updateCartBar();
}

/* ---------- views ---------- */
let currentView = 'home';

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? t('greet_morning') : h < 15 ? t('greet_noon') : h < 19 ? t('greet_evening') : t('greet_night');
}

function viewHome() {
  const name = App.user ? App.user.name : t('guest');
  const moodObj = MOODS.find(m => m.k === App.mood) || MOODS[0];
  const picked = !!App.moodPicked;
  const ask = t('home_ask').replace('{name}', esc(name));
  return `
  <div class="hometop">
    <div>
      <span class="greet">${greeting()}${App.user && !App.user.guest ? ', ' + esc(name) : ''}</span>
      <div class="brandrow"><span>Crave</span><mark>Mood</mark></div>
    </div>
    <div style="display:flex;align-items:center;gap:7px">
      <button class="iconbtn" data-go="chat" aria-label="chat" title="${t('nav_chat')}">${icon('chat')}</button>
      <button class="avatarbtn" data-go="profile" aria-label="profile" id="heroCimo">${cimo(App.mood, 40)}</button>
    </div>
  </div>

  <div class="hero2">
    <div class="bigcimo ${picked ? 'picked' : ''}" id="sayCimo">${cimo(picked ? App.mood : 'def', 208)}</div>
    <div class="saybubble" id="say" role="status" aria-live="polite">${picked ? esc(mSay(moodObj, (recList()[0] || {}).name)) : esc(ask)}</div>
  </div>

  <div class="moodrow" id="moods">
    ${MOODS.map(m => `<button class="mpill ${m.k === App.mood && picked ? 'on' : ''}" data-mood="${m.k}" style="--c:${m.c}">
      <span class="mf">${cimo(m.face, 38)}</span><b>${mL(m)}</b></button>`).join('')}
  </div>

  ${picked ? `
  <div class="locbar">
    ${icon('pin')}
    <select id="streetSel" aria-label="location">
      ${STREETS.map(s => `<option value="${s.id}" ${s.id === App.street ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>
    <span class="dist">${esc(curStreet().area)}</span>
  </div>

  <div class="chips" id="cats">
    ${CATS.map(c => `<button class="chip ${c === App.cat ? 'on' : ''}" data-cat="${c}">${cL(c)}</button>`).join('')}
  </div>

  <div class="recs" id="recs"></div>

  <button class="shuffle" id="shuffleBtn">
    <span class="sico">${icon('wheel')}</span>
    <span style="flex:1;min-width:0"><b>${t('shuffle_t')}</b><small>${t('shuffle_s')}</small></span>
    <span class="go">›</span>
  </button>
  ` : `<p class="pickhint">${t('home_hint')}</p>`}`;
}

function recList() {
  let list = MENU.filter(m => m.moods.indexOf(App.mood) > -1);
  if (App.cat !== 'Semua') list = list.filter(m => m.cat === App.cat);
  if (!list.length) list = MENU.filter(m => m.moods.indexOf(App.mood) > -1).slice(0, 3);
  list.sort((a, b) => distOf(a) - distOf(b));
  return list.slice(0, App.cat === 'Semua' ? 3 : 6);
}

function renderRecs() {
  const box = $('#recs'); if (!box) return;
  const list = recList();
  if (!list.length) { box.innerHTML = `<div class="empty"><div class="big">${cimo('bingung', 90)}</div><p>${t('home_none')}</p></div>`; return; }
  box.innerHTML = list.map((m, i) => {
    const q = App.cart[m.id] || 0;
    const d = distOf(m).toFixed(1).replace('.', ',');
    const lbl = i === 0 ? t('pick_t')
      : m.viral ? '✦ ' + t('viral')
      : (CATS.indexOf(m.cat) > -1 ? cL(m.cat) : '');
    const c = MOODC[m.moods[0]] || MOODC.def;
    const media = m.photo
      ? `<img class="fphoto" src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy"
             onerror="this.style.display='none'">`
      : `<div class="fart">${art(m.art, 96)}</div>`;
    return `<article class="pickcard fcard">
      <div class="pickhead"><b>${lbl}</b><span class="mini">${cimo(m.moods[0], 30)}</span></div>
      <div class="fmedia" style="--c1:${c[0]}22;--c2:${c[1]}18" ${m.shopee ? `data-shop="${esc(m.shopee)}"` : ''}>
        ${media}
        <span class="frate">★ ${m.r}</span>
        <span class="fdist">${icon('pin')}${d} km</span>
        ${m.viral ? `<span class="fviral">🔥 ${t('viral')}</span>` : ''}
      </div>
      <div class="fbody">
        <b class="fname">${esc(m.name)}</b>
        <small class="fstall">${esc(m.stall)}</small>
        <div class="frow">
          <span class="fprice">${rp(m.lo)} – ${String(m.hi).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
          ${q ? `<span class="step"><button data-dec="${m.id}">−</button><i>${q}</i><button data-inc="${m.id}">+</button></span>`
              : `<button class="fadd" data-add="${m.id}">${icon('plus')} ${t('home_add')}</button>`}
        </div>
      </div>
    </article>`;
  }).join('');
}

/* "Putar acak" — a real spinning-wheel popup */
let popItems = [], popRot = 0, popSpinning = false;

function openSpinPop() {
  const m = $('#spinModal');
  if (!m) return;
  popRot = 0;
  m.classList.add('on');
  renderSpinPop();
}

function renderSpinPop() {
  popItems = wheelItems();
  if (!popItems.length) popItems = recList();
  const n = popItems.length, seg = 360 / n;
  const cols = ['#ffd9e6', '#ffe9c9', '#d9f0e3', '#dbe9fb', '#eee0fb', '#ffe3d4', '#f4f7c9', '#e2f4f8'];
  const grad = popItems.map((_, i) => `${cols[i % cols.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
  $('#spinPopBody').innerHTML = `
    <p class="hint" style="text-align:center;margin-bottom:12px">${t('spin_pop_sub')}</p>
    <div class="popwheelbox">
      <svg class="pointer" width="28" height="34" viewBox="0 0 34 40"><path d="M17 38L4 10a14 14 0 0 1 26 0z" fill="#ff5f98" stroke="#fff" stroke-width="3"/></svg>
      <div class="wheel popwheel" id="popWheel" style="background:conic-gradient(${grad})">
        ${popItems.map((m, i) => {
          const ang = i * seg + seg / 2, rad = (ang - 90) * Math.PI / 180, R = 30;
          const px = 50 + R * Math.cos(rad), py = 50 + R * Math.sin(rad);
          return `<div class="seg"><span style="left:${px.toFixed(2)}%;top:${py.toFixed(2)}%">${foodEmoji(m, i)}</span></div>`;
        }).join('')}
        <div class="hub">${cimo(App.mood, 42)}</div>
      </div>
    </div>
    <div id="popResult"></div>
    <button class="btn block" id="popSpinBtn" style="margin-top:14px">${icon('wheel')} ${t('spin_pop_btn')}</button>`;
  $('#popSpinBtn').onclick = spinPopGo;
}

function spinPopGo() {
  if (popSpinning) return;
  const wheel = $('#popWheel'); if (!wheel) return;
  const n = popItems.length, seg = 360 / n;
  const idx = Math.floor(Math.random() * n);
  const center = idx * seg + seg / 2;
  const jitter = (Math.random() - 0.5) * (seg * 0.5);
  const turns = 5 + Math.floor(Math.random() * 3);
  popRot += turns * 360 + (360 - center) + jitter;
  popSpinning = true;
  const btn = $('#popSpinBtn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const res = $('#popResult'); if (res) res.innerHTML = '';
  SFX.play('spin');
  SFX.spinTicks(3800);
  wheel.style.transition = 'transform 3.8s cubic-bezier(.12,.72,.06,1)';
  wheel.style.transform = `rotate(${popRot}deg)`;
  setTimeout(() => {
    popSpinning = false;
    const pick = popItems[idx];
    App.lastSpin = pick;
    SFX.play('success');
    const q = App.cart[pick.id] || 0;
    if (res) res.innerHTML = `<div class="shuffleres" style="margin:12px 0 0">
      <div class="pic">${art(pick.art, 44)}</div>
      <div style="flex:1;min-width:0">
        <b>${esc(pick.name)}</b>
        <small>${esc(pick.stall)} · ${distOf(pick).toFixed(1).replace('.', ',')} km</small>
      </div>
      ${q ? `<span class="step"><button data-dec="${pick.id}">−</button><i>${q}</i><button data-inc="${pick.id}">+</button></span>`
          : `<button class="btn sm" data-add="${pick.id}" style="padding:7px 13px">${icon('plus')} ${t('home_add')}</button>`}
    </div>`;
    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('wheel')} ${t('spin_pop_again')}`; }
    if (App.user) DB.logSpin(App.user.id, pick.id).catch(() => {});
  }, 3900);
}

/* ---------- spinner ---------- */
function wheelItems() {
  /* 6 slices instead of 8: each slice is wider, so the dish name can be big and readable */
  let l = MENU.filter(m => m.moods.indexOf(App.mood) > -1);
  if (l.length < 6) l = l.concat(MENU.filter(m => l.indexOf(m) === -1));
  return l.slice(0, 6);
}

function viewSpin() {
  const items = wheelItems();
  const n = items.length, seg = 360 / n;
  const cols = ['#ffd9e6', '#ffe9c9', '#d9f0e3', '#dbe9fb', '#eee0fb', '#ffe3d4', '#f4f7c9', '#e2f4f8'];
  const grad = items.map((_, i) => `${cols[i % cols.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
  return `
  <div class="pagetitle"><div><h1>${t('spin_t')}</h1><p>${t('spin_sub')}</p></div>
    <span class="tag mint">${mL(MOODS.find(m => m.k === App.mood) || MOODS[0])}</span></div>

  <div class="card" style="padding:22px 18px">
    <div class="spinwrap">
      <div class="wheelbox">
        <svg class="pointer" width="34" height="40" viewBox="0 0 34 40"><path d="M17 38L4 10a14 14 0 0 1 26 0z" fill="#ff5f98" stroke="#fff" stroke-width="3"/></svg>
        <div class="wheel" id="wheel" style="background:conic-gradient(${grad})">
          ${items.map((m, i) => {
            const ang = i * seg + seg / 2, rad = (ang - 90) * Math.PI / 180, R = 29;
            const px = 50 + R * Math.cos(rad), py = 50 + R * Math.sin(rad);
            return `<div class="seg"><span style="left:${px.toFixed(2)}%;top:${py.toFixed(2)}%">${foodEmoji(m, i)}</span></div>`;
          }).join('')}
          <div class="hub" style="left:calc(50% - 32px);top:calc(50% - 32px)">${cimo(App.mood, 52)}</div>
        </div>
      </div>
      <div class="spininfo">
        <h2 id="spinTitle">${t('spin_win')}</h2>
        <p>${t('spin_sub')}</p>
        <button class="btn block" id="spinBtn">${icon('wheel')} ${t('spin_go')}</button>
        <div id="spinResult"></div>
        <div id="spinHist"></div>
      </div>
    </div>
  </div>`;
}

function doSpin() {
  if (App.spinning) return;
  const wheel = $('#wheel'); if (!wheel) return;
  const items = wheelItems(), n = items.length, seg = 360 / n;
  const idx = Math.floor(Math.random() * n);
  const center = idx * seg + seg / 2;
  const jitter = (Math.random() - 0.5) * (seg * 0.55);
  const turns = 5 + Math.floor(Math.random() * 3);
  const prev = Number(wheel.dataset.rot || 0);
  const target = prev + turns * 360 + (360 - center) + jitter;
  wheel.dataset.rot = target;
  App.spinning = true;
  SFX.play('spin');
  SFX.spinTicks(4200);
  wheel.style.transition = 'transform 4.6s cubic-bezier(.12,.72,.06,1)';
  wheel.style.transform = `rotate(${target}deg)`;
  setTimeout(() => {
    App.spinning = false;
    App.lastSpin = items[idx];
    App.spinHist = (App.spinHist || []).concat(items[idx].name).slice(-8);
    SFX.play('success');
    renderSpinResult(items[idx]);
    if (App.user) DB.logSpin(App.user.id, items[idx].id).catch(() => {});
  }, 4700);
}

function renderSpinHist() {
  const hist = $('#spinHist'); if (!hist) return;
  const h = App.spinHist || [];
  hist.innerHTML = `<div class="history"><span class="muted" style="border:0;background:none">${t('spin_hist')}:</span>${h.length ? h.slice(-5).map(k => `<span>${esc(k)}</span>`).join('') : '<span>—</span>'}</div>`;
}

function renderSpinResult(m) {
  const box = $('#spinResult'); if (!box) return;
  const q = App.cart[m.id] || 0;
  box.innerHTML = `<div class="spinres">
    <div class="pic" style="background:linear-gradient(135deg,${MOODC[m.moods[0]][0]}66,${MOODC[m.moods[0]][1]}44)">${art(m.art, 58)}</div>
    <div style="flex:1;min-width:0">
      <b style="font:700 .95rem Fredoka;display:block">${esc(m.name)}</b>
      <small class="muted" style="font-size:.72rem;font-weight:700">${esc(m.stall)} · ${distOf(m).toFixed(1).replace('.', ',')} km</small>
      <div style="margin-top:6px;display:flex;gap:6px">
        ${q ? `<span class="step" style="align-self:center"><button data-dec="${m.id}">−</button><i>${q}</i><button data-inc="${m.id}">+</button></span>`
            : `<button class="addbtn" data-add="${m.id}" style="background:var(--pk2);color:#fff">+ ${t('home_add')}</button>`}
        <button class="addbtn" id="spinAgain" style="border-color:var(--ln);color:var(--ink)">${t('spin_again')}</button>
      </div>
    </div></div>`;
  renderSpinHist();
}

/* ---------- chat ---------- */
function viewChat() {
  return `
  <div class="chatwrap">
    <div class="chathead">
      <div class="av">${cimo(App.mood, 38)}<i class="dot"></i></div>
      <div style="flex:1;min-width:0">
        <b>${t('chat_t')}</b>
        <small id="chatStatus">${t('chat_on')}</small>
      </div>
      <button class="iconbtn" id="voiceToggle" title="${t('prof_voice')}">${icon('volume')}</button>
      <button class="iconbtn" id="chatReset" title="Reset">${icon('reset')}</button>
    </div>
    <div class="chatbody" id="chatBody"></div>
    <div class="quick" id="quick"></div>
    <div class="composer">
      <div class="inp"><textarea id="chatInput" rows="1" placeholder="${t('chat_ph')}"></textarea></div>
      <button class="mic" id="micBtn" title="Voice">${icon('mic')}</button>
      <button class="send" id="sendBtn" disabled>${icon('send')}</button>
    </div>
  </div>`;
}

function renderMessages() {
  const b = $('#chatBody'); if (!b) return;
  b.innerHTML = `<div class="day">${new Date().toLocaleDateString(App.lang === 'id' ? 'id-ID' : App.lang === 'zh' ? 'zh-CN' : App.lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` +
    App.messages.map(m => `<div class="msg ${m.role === 'me' ? 'me' : ''}">
      ${m.role === 'cimo' ? `<div class="av">${cimo(m.mood || App.mood, 26)}</div>` : ''}
      <div class="bub">${esc(m.text)}</div>
    </div>`).join('');
  b.scrollTop = b.scrollHeight;
}

function renderChips(list) {
  const q = $('#quick'); if (!q) return;
  const chips = list || ChatEngine.chips().map(x => x[0]);
  q.innerHTML = chips.map(c => `<button data-chip="${esc(c)}">${esc(c)}</button>`).join('');
}

function addMsg(role, text, mood) {
  App.messages.push({ role, text, mood: mood || App.mood });
  if (App.messages.length > 120) App.messages.shift();
  renderMessages();
}

async function sendChat(text) {
  text = String(text || '').trim();
  if (!text) return;
  const input = $('#chatInput');
  if (input) { input.value = ''; input.style.height = 'auto'; }
  $('#sendBtn').disabled = true;
  addMsg('me', text);
  SFX.play('tap');
  if (App.user) DB.logChat(App.user.id, 'user', text).catch(() => {});

  const b = $('#chatBody');
  const typing = document.createElement('div');
  typing.className = 'msg'; typing.id = 'typing';
  typing.innerHTML = `<div class="av">${cimo(App.mood, 26)}</div><div class="typing"><i></i><i></i><i></i></div>`;
  b.appendChild(typing); b.scrollTop = b.scrollHeight;

  const res = await ChatEngine.reply(text);
  await new Promise(r => setTimeout(r, 420 + Math.random() * 480));
  const tp = $('#typing'); if (tp) tp.remove();

  addMsg('cimo', res.text, res.mood);
  App.mood = normMood(res.mood);
  renderChips(res.chips);
  if (App.user) DB.logChat(App.user.id, 'cimo', res.text).catch(() => {});

  if (App.settings.speak && Voice.supported) {
    Voice.speak(String(res.speak || res.text).replace(/\*[^*]+\*/g, ''), { lang: App.settings.voiceLang || App.lang });
  }
  updatePetFace();
}

/* ---------- cart view ---------- */
function viewCart() {
  return `<div class="pagetitle"><div><h1>${t('cart_t')}</h1><p>${t('cart_note')}</p></div></div>
  <div class="card" id="cartCard"></div>`;
}

function renderCart() {
  const box = $('#cartCard'); if (!box) return;
  const ids = Object.keys(App.cart);
  if (!ids.length) {
    box.innerHTML = `<div class="empty"><div class="big">${cimo('kecewa', 110)}</div><p>${t('cart_empty')}</p>
      <button class="btn sm" data-go="home" style="margin-top:12px">${t('nav_home')}</button></div>`;
    return;
  }
  const { c, lo, hi } = cartTotals();
  box.innerHTML = ids.map(id => {
    const m = MENU.find(x => x.id === id); if (!m) return '';
    return `<div class="cartitem">
      <div class="pic" style="background:linear-gradient(135deg,${MOODC[m.moods[0]][0]}66,${MOODC[m.moods[0]][1]}44)">${art(m.art, 44)}</div>
      <div class="inf"><b>${esc(m.name)}</b><small>${esc(m.stall)}</small>
        <div class="pr">${rp(m.lo * App.cart[id])} – ${rp(m.hi * App.cart[id])}</div></div>
      <span class="step"><button data-dec="${id}">−</button><i>${App.cart[id]}</i><button data-inc="${id}">+</button></span>
    </div>`;
  }).join('') + `
    <div class="totline"><span>${t('cart_total')}</span><span style="color:var(--pk2)">${rp(lo)} – ${rp(hi)}</span></div>
    <p class="hint" style="margin-bottom:14px">${t('cart_note')}</p>
    <b style="font-size:.86rem">${t('cart_plat')}</b>
    <div class="platmain">
      <button class="plat big" data-plat="shopeefood" style="--pc:#f05a28">
        <i style="background:#f05a28"><svg viewBox="0 0 24 24"><text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="Fredoka,sans-serif">S</text></svg></i>
        <span><b>ShopeeFood</b><small>${t('cart_go')} ↗</small></span>
        <em class="arrow">›</em>
      </button>
    </div>
    <div class="platsub">
      ${[['GrabFood', '#00a651', 'grabfood', 'G'], ['GoFood', '#ee2737', 'gofood', 'Go']].map(([n, col, k, letter]) =>
        `<button class="plat sm" data-plat="${k}" style="--pc:${col}">
          <i style="background:${col}"><svg viewBox="0 0 24 24"><text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="Fredoka,sans-serif">${letter}</text></svg></i>
          <span>${n}</span></button>`).join('')}
    </div>
    <button class="btn block" id="openShare" style="margin-top:14px">${icon('share')} ${t('cart_share')}</button>`;
}

function openPlatform(k) {
  const first = Object.keys(App.cart)[0];
  const m = MENU.find(x => x.id === first);
  const q = encodeURIComponent(m ? m.name + ' Makassar' : 'makanan Makassar');
  const urls = {
    gofood: 'https://gofood.co.id/id/search?q=' + q,
    grabfood: 'https://food.grab.com/id/id/search?query=' + q,
    shopeefood: 'https://shopeefood.co.id/search?keyword=' + q,
  };
  SFX.play('pop');
  if (App.user) DB.addOrder(App.user.id, { kind: 'platform', platform: k, items: Object.keys(App.cart) }).catch(() => {});
  window.open(urls[k], '_blank', 'noopener');
}

/* ---------- recap ---------- */
function iso(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function moodMap() {
  const map = {}, now = new Date();
  if (App.user) DB.moodsOf(App.user.id).forEach(x => { map[x.d] = x.m; });
  // gentle demo data for earlier days so the calendar never looks empty
  const keys = MOODS.map(m => m.k);
  for (let d = 1; d < now.getDate(); d++) {
    const k = iso(now.getFullYear(), now.getMonth(), d);
    if (!map[k]) { const h = (d * 7 + 3) % 11; if (h < 7) map[k] = keys[(d * 5 + h) % keys.length]; }
  }
  if (!map[iso(now.getFullYear(), now.getMonth(), now.getDate())]) map[iso(now.getFullYear(), now.getMonth(), now.getDate())] = App.mood;
  return map;
}
function viewRecap() {
  return `<div class="pagetitle"><div><h1>${t('recap_t')}</h1><p>${t('recap_sub')}</p></div>
    <button class="btn sm ghost" id="recapShare">${icon('share')} ${t('cart_share')}</button></div>
  <div class="card"><div class="stats">
    <div><b id="s1">0</b><span>${t('recap_day')}</span></div>
    <div><b id="s2">0</b><span>${t('recap_streak')}</span></div>
    <div><div id="s3" style="width:44px;height:44px;margin:0 auto"></div><span>${t('recap_top')}</span></div>
  </div></div>
  <div class="card" style="margin-top:12px"><b id="calTitle" style="font-size:1rem"></b><div class="cal" id="cal"></div></div>
  <div class="card" style="margin-top:12px"><b style="font-size:.95rem">${t('recap_t')}</b><div class="bars" id="bars"></div></div>`;
}
function renderRecap() {
  const map = moodMap(), now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const dim = new Date(y, mo + 1, 0).getDate(), off = (new Date(y, mo, 1).getDay() + 6) % 7;
  const keys = Object.keys(map);
  $('#s1').textContent = keys.length;
  let streak = 0, cur = new Date();
  while (map[iso(cur.getFullYear(), cur.getMonth(), cur.getDate())]) { streak++; cur.setDate(cur.getDate() - 1); }
  $('#s2').textContent = streak;
  const cnt = {}; Object.values(map).forEach(k => cnt[k] = (cnt[k] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  $('#s3').innerHTML = top ? cimo(top[0], 40) : '';
  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  $('#calTitle').textContent = `${BLN[mo]} ${y}`;
  let h = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<div class="wd">${d}</div>`).join('') + '<div></div>'.repeat(off);
  for (let d = 1; d <= dim; d++) {
    const k = map[iso(y, mo, d)], today = d === now.getDate();
    h += `<div class="cd ${today ? 'today' : ''}" title="${k ? MOODLBL[k] : '—'}"><span>${d}</span>${k ? `<div class="mini">${cimo(k, 30)}</div>` : ''}</div>`;
  }
  $('#cal').innerHTML = h;
  const mx = Math.max(1, ...Object.values(cnt));
  $('#bars').innerHTML = MOODS.map(m => {
    const v = cnt[m.k] || 0;
    return `<div class="bar"><span style="width:96px;display:flex;align-items:center;gap:6px"><span style="width:22px;height:22px;flex:none">${cimo(m.face, 20)}</span>${mL(m)}</span>
      <div class="tr"><i style="width:${(v / mx) * 100}%;background:${m.c}"></i></div><b style="width:26px;text-align:right;font-size:.72rem">${v}</b></div>`;
  }).join('');
}

/* ---------- profile ---------- */
function viewProfile() {
  const s = App.settings;
  const isV = isVip();
  const map = moodMap();
  const moodDays = Object.keys(map).length;
  let streak = 0, cur = new Date();
  while (map[iso(cur.getFullYear(), cur.getMonth(), cur.getDate())]) { streak++; cur.setDate(cur.getDate() - 1); }
  const menuCount = Object.keys(App.cart).length;
  return `<div class="pagetitle"><div><h1>${t('prof_t')}</h1><p>${t('tagline')}</p></div></div>

  <div class="profhero">
    <div class="avatar-lg">${cimo(App.mood, 82, false, App.costum)}</div>
    <h3>${esc(App.user ? App.user.name : t('guest'))}</h3>
    <small class="muted">${App.user && !App.user.guest ? esc(App.user.contact) : t('guest')} · Pemburu Rasa · Level ${Math.max(1, Math.min(9, 1 + Math.floor(moodDays / 4)))}</small>
    <div class="row" style="justify-content:center;margin-top:10px">
      ${isV ? `<span class="tag gold">✦ ${t('vip_badge')}</span>` : `<span class="tag pink">Paket Gratis</span>`}
      ${App.user && App.user.umkm ? `<span class="tag mint">UMKM</span>` : ''}
      <span class="tag">${MOODLBL[App.mood] || ''}</span>
    </div>
  </div>

  <div class="vipplan ${isV ? 'on' : ''}">
    <div class="between">
      <div>
        <b>${isV ? t('vip_active') : 'Paket Gratis'}</b>
        <small>${isV ? t('vip_sub') : 'Buka kostum dan warna Cimo'}</small>
      </div>
      <button class="btn sm ${isV ? 'ghost' : 'plum'}" data-go="vip">${isV ? t('vip_t') : t('vip_start')}</button>
    </div>
  </div>

  <div class="profstats">
    <div><b>${moodDays}</b><span>Mood</span></div>
    <div><b>${menuCount}</b><span>Menu</span></div>
    <div><b>${streak}</b><span>Beruntun</span></div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="between"><b style="font-size:.95rem">${IL().title}</b>${PLAT.standalone ? `<span class="tag mint">✓ ${IL().off}</span>` : ''}</div>
    <p class="hint" style="margin:5px 0 0">${IL().sub}</p>
    <button class="btn block" data-install style="margin-top:10px">${icon('down')} ${IL().install}</button>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="between"><b style="font-size:.95rem">${t('prof_lang')}</b>
      <span class="langnow" style="margin:0">${esc((LANGS.find(l => l.k === App.lang) || LANGS[0]).label)}</span></div>
    <div class="langs" style="margin-top:8px">
      ${LANGS.map(l => `<button class="langopt ${l.k === App.lang ? 'on' : ''}" data-lang="${l.k}" title="${esc(l.label)}" aria-label="${esc(l.label)}"><i>${l.short}</i></button>`).join('')}
    </div>
  </div>

  <div class="card voiceone" style="margin-top:12px">
    <div class="vhead">
      <div class="vava">${cimo(App.mood, 46)}<i class="vwave"><b></b><b></b><b></b><b></b></i></div>
      <div style="flex:1;min-width:0">
        <b>${t('prof_voice')}</b>
        <small>${t('voice_one_sub')}</small>
      </div>
      <span class="tag mint">${t('voice_one_badge')}</span>
    </div>
    <div class="setrow"><div class="lbl"><b>${t('voice_vol')}</b><small id="volV">${Math.round(s.vol * 100)}%</small></div>
      <input type="range" id="vol" min="0" max="1" step="0.05" value="${s.vol}"></div>
    <button class="btn block sm" id="testVoice" style="margin-top:12px">${icon('volume')} ${t('voice_test')}</button>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="setrow"><div class="lbl"><b>${t('prof_sound')}</b><small>${t('prof_sound_sub')}</small></div>
      <label class="switch"><input type="checkbox" id="soundSw" ${s.sound ? 'checked' : ''}><span></span></label></div>
    <div class="setrow"><div class="lbl"><b>${t('chat_t')} auto voice</b><small>${t('prof_voice')}</small></div>
      <label class="switch"><input type="checkbox" id="speakSw" ${s.speak ? 'checked' : ''}><span></span></label></div>
    <div class="setrow"><div class="lbl"><b>Dark mode</b><small>${t('prof_t')}</small></div>
      <label class="switch"><input type="checkbox" id="darkSw" ${s.theme === 'dark' ? 'checked' : ''}><span></span></label></div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="between"><b style="font-size:.95rem">Akun</b>
      <span class="tag">${App.user && !App.user.guest ? esc(App.user.contact) : t('guest')}</span></div>
    <div class="row" style="margin-top:10px">
      <button class="btn sm ghost" id="logoutBtn">${icon('back')} ${t('prof_logout')}</button>
    </div>
  </div>`;
}

/* ---------- VIP ---------- */
function isVip() { return App.user && (App.user.vip || DB.isVip(App.user.id)); }

function viewVip() {
  const features = (VIP_FEATURES_I18N[App.lang] || VIP_FEATURES_I18N.id);
  const isV = isVip();
  return `
  <div class="pagetitle" style="align-items:center">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="iconbtn" data-go="profile" aria-label="back">${icon('back')}</button>
      <div><h1>${t('vip_t')}</h1><p>${t('vip_sub')}</p></div>
    </div>
    ${isV ? `<span class="tag gold">✦ ${t('vip_active')}</span>` : ''}</div>

  <div class="vipcard">
    <div class="viphead">
      <div>${cimo(App.mood, 90, false, isV ? App.costum : '')}</div>
      <div>
        <h2>${t('vip_t')}</h2>
        <p>${t('vip_sub')}</p>
        ${isV ? `<span class="tag gold">${t('vip_active')}</span>` : `<span class="tag pink">${t('vip_price')}</span>`}
      </div>
    </div>
    <div class="vipfeatures">
      ${features.map(f => `<div><span class="xck">✓</span>${f}</div>`).join('')}
    </div>
    ${isV ? '' : `<button class="btn block" id="startVip">${t('vip_start')}</button>`}
  </div>

  <div class="card coscard" style="margin-top:14px">
    <div class="between">
      <div><b style="font:700 .98rem Fredoka">${t('prof_design')}</b>
        <div class="hint" style="margin-top:2px">${isV ? 'Pilih gaya Cimo favoritmu.' : 'Khusus VIP. Buka semua kostum Cimo.'}</div></div>
      <span class="tag ${isV ? 'mint' : 'gold'}">${isV ? '✓' : 'VIP'}</span>
    </div>
    <div class="cosgrid">
      ${COSTUMES.map(c => {
        const locked = !isV;
        const on = App.costum === c.id;
        return `<button class="cosopt ${on ? 'on' : ''} ${locked ? 'lock' : ''}" data-costum="${c.id}">
          <span class="cosface">${cimo(App.mood, 56, false, c.id)}</span>
          <b>${c.name}</b>
          ${locked ? `<span class="coslock">🔒</span>` : (on ? `<span class="coson">✓</span>` : '')}
        </button>`;
      }).join('')}
    </div>
  </div>

  <div class="umkmcard">
    <div style="position:relative">
      <div>${cimo('senang', 80, false, 'koki')}</div>
      <div>
        <span class="tag mint">UMKM</span>
        <h3>${t('umkm_sub')}</h3>
        <p>${t('umkm_desc')}</p>
      </div>
    </div>
    <button class="btn block" data-go="umkm">${t('umkm_t')} →</button>
  </div>`;
}

/* ---------- UMKM ---------- */
function viewUmkm() {
  const umkm = App.user ? DB.getUmkm(App.user.id) : null;
  if (umkm && umkm.status === 'approved') {
    return `
    <div class="pagetitle"><div><h1>${t('umkm_dash')}</h1><p>${esc(umkm.name)}</p></div></div>
    <div class="card" style="text-align:center">
      <div style="width:80px;height:80px;margin:0 auto">${cimo('senang', 76, false, 'koki')}</div>
      <h3>${esc(umkm.name)}</h3>
      <span class="tag mint">${t('umkm_approved')}</span>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="stats">
        <div><b>${umkm.views || 0}</b><span>${t('umkm_views')}</span></div>
        <div><b>${umkm.clicks || 0}</b><span>${t('umkm_clicks')}</span></div>
        <div><b>${(umkm.rating || 0).toFixed(1)}</b><span>${t('umkm_rating')}</span></div>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <b>${t('umkm_menu')}</b>
      <div style="margin-top:10px">
        ${(umkm.menus || []).length ? (umkm.menus || []).map(m => `<div class="cartitem"><div class="inf"><b>${esc(m.name)}</b><small>${esc(m.cat || '')}</small></div></div>`).join('')
          : `<p class="hint">Belum ada menu terdaftar.</p>`}
      </div>
      <button class="btn sm ghost block" style="margin-top:10px">${t('umkm_add_menu')}</button>
    </div>`;
  }

  if (umkm && umkm.status === 'pending') {
    return `
    <div class="pagetitle"><div><h1>${t('umkm_t')}</h1><p>${esc(umkm.name)}</p></div></div>
    <div class="card" style="text-align:center">
      <div style="width:90px;height:90px;margin:0 auto">${cimo('bingung', 86)}</div>
      <h3>${t('umkm_pending')}</h3>
      <p class="hint">Pendaftaran sedang ditinjau oleh tim CraveMood.</p>
    </div>`;
  }

  return `
  <div class="pagetitle"><div><h1>${t('umkm_t')}</h1><p>${t('umkm_desc')}</p></div></div>
  <div class="card">
    <div style="text-align:center;margin-bottom:16px">
      <div style="width:100px;height:100px;margin:0 auto">${cimo('senang', 96, false, 'koki')}</div>
      <div class="bub" style="display:inline-block;margin-top:8px">Yuk gabung, jadi pilihan Cimo!</div>
    </div>
    <div class="field"><label>${t('umkm_name')}</label><input id="umkmName" placeholder="Contoh: Warung Daeng Sirua"></div>
    <div class="field"><label>${t('umkm_owner')}</label><input id="umkmOwner" placeholder="Nama pemilik usaha"></div>
    <div class="field"><label>${t('umkm_wa')}</label><input id="umkmWa" placeholder="08xx"></div>
    <div class="field"><label>${t('umkm_addr')}</label><input id="umkmAddr" placeholder="Alamat lengkap di Makassar"></div>
    <div class="field"><label>${t('umkm_type')}</label>
      <div class="chips" id="umkmCats">
        ${UMKM_CATS.map(c => `<button class="chip" data-umkm-cat="${c}">${c}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>${t('umkm_mood')}</label>
      <div class="chips" id="umkmMoods">
        ${MOODS.map(m => `<button class="chip" data-umkm-mood="${m.k}">${mL(m)}</button>`).join('')}
      </div>
    </div>
    <div class="err" id="umkmErr"></div>
    <button class="btn block" id="umkmSubmit">${t('umkm_send')}</button>
  </div>`;
}

async function submitUmkm() {
  const name = $('#umkmName').value.trim();
  const owner = $('#umkmOwner').value.trim();
  const wa = $('#umkmWa').value.trim();
  const addr = $('#umkmAddr').value.trim();
  const cats = $$('#umkmCats .chip.on').map(b => b.dataset.umkmCat);
  const moods = $$('#umkmMoods .chip.on').map(b => b.dataset.umkmMood);
  if (!name || !owner || !wa || !addr || !cats.length || !moods.length) {
    $('#umkmErr').textContent = 'Lengkapi semua field dan pilih minimal satu kategori.';
    SFX.play('error'); return;
  }
  $('#umkmSubmit').disabled = true;
  try {
    const r = await DB.registerUmkm(App.user.id, { name, owner, wa, addr, cats, moods });
    if (r.ok) {
      SFX.play('success'); toast('Pendaftaran dikirim!');
      App.user.umkm = r.umkm.id;
      go('umkm');
    } else { $('#umkmErr').textContent = r.error || 'Gagal'; }
  } catch (e) { $('#umkmErr').textContent = 'Gagal mengirim.'; }
  $('#umkmSubmit').disabled = false;
}

/* ---------- share ---------- */
function shareCaption(items) {
  const moodObj = MOODS.find(m => m.k === App.mood) || MOODS[0];
  const name = App.user ? App.user.name : '';
  const list = items.map(i => '• ' + i).join('\n');
  const L = {
    id: `${name ? name + ' lagi ' : 'Lagi '}${mL(moodObj).toLowerCase()} hari ini ${moodObj.k === 'senang' ? '✨' : moodObj.k === 'sedih' ? '🌧️' : moodObj.k === 'marah' ? '🔥' : '🍡'}\n\nCimo pilihin buatku:\n${list}\n\nLagi mood apa hari ini? Cobain CraveMood 🍡\n#CraveMood #Makassar #MakanSesuaiMood`,
    en: `${name ? name + ' is ' : 'Feeling '}${mL(moodObj).toLowerCase()} today.\n\nCimo picked for me:\n${list}\n\nWhat is your mood? Try CraveMood 🍡\n#CraveMood #Makassar #FoodForMood`,
    zh: `今天心情：${mL(moodObj)}\n\nCimo 帮我选了：\n${list}\n\n你今天心情怎么样？来试试 CraveMood 🍡\n#CraveMood #Makassar`,
    hi: `आज मूड: ${mL(moodObj)}\n\nCimo ने चुना:\n${list}\n\nआज आपका मूड कैसा है? CraveMood आज़माएं 🍡\n#CraveMood #Makassar`,
  };
  return L[App.lang] || L.id;
}

function svgDataUrl(mood, size, costume) {
  let s = cimo(mood, size, false, costume || '');
  const m = s.match(/<svg[^>]*>/);
  if (m && m[0].indexOf('xmlns') === -1) s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  s = s.replace(`width="${size}"`, `width="${size}" height="${Math.round(size * 185 / 200)}"`);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

async function buildShareCard() {
  const W = 1000, H = 1300;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const moodObj = MOODS.find(m => m.k === App.mood) || MOODS[0];
  const c0 = MOODC[moodObj.face] || MOODC.def;

  /* soft dotted backdrop */
  x.fillStyle = '#fdf4f8'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 16; i < W; i += 30) for (let j = 16; j < H; j += 30) { x.beginPath(); x.arc(i, j, 2.2, 0, 7); x.fill(); }

  /* mood-tinted card (mockup story card) */
  const CX = 64, CY = 56, CW = W - 128, CH = H - 112, R = 56;
  const g = x.createLinearGradient(0, CY, 0, CY + CH);
  g.addColorStop(0, c0[0]); g.addColorStop(0.58, c0[1]); g.addColorStop(1, '#ffd9e8');
  roundRect(x, CX, CY, CW, CH, R); x.fillStyle = g; x.fill();
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 5; x.stroke();

  /* brand + mood */
  x.textAlign = 'center';
  x.fillStyle = '#3a2142';
  x.font = '700 48px Fredoka, Nunito, sans-serif';
  x.fillText('CraveMood', W / 2, CY + 122);

  x.fillStyle = 'rgba(58,33,66,.55)';
  x.font = '700 30px Nunito, sans-serif';
  x.fillText(t('share_mood_today'), W / 2, CY + 184);

  x.fillStyle = '#3a2142';
  x.font = '700 80px Fredoka, Nunito, sans-serif';
  x.fillText(mL(moodObj), W / 2, CY + 278);

  /* mascot */
  try {
    const img = await loadImg(svgDataUrl(moodObj.face, 440, App.costum));
    x.drawImage(img, W / 2 - 220, CY + 282, 440, 407);
  } catch (e) {}

  /* recommendation card */
  const rx = 168, ry = CY + 700, rw = W - 336, rh = 214;
  x.fillStyle = 'rgba(255,255,255,.95)';
  roundRect(x, rx, ry, rw, rh, 34); x.fill();

  x.fillStyle = 'rgba(58,33,66,.5)';
  x.font = '700 28px Nunito, sans-serif';
  x.fillText(t('share_rec'), W / 2, ry + 58);

  const cartIds = Object.keys(App.cart);
  let pick = cartIds.length ? MENU.find(m => m.id === cartIds[0]) : null;
  if (!pick) pick = recList()[0] || MENU.find(m => m.moods.indexOf(App.mood) > -1) || MENU[0];

  x.fillStyle = '#3a2142';
  x.font = '700 48px Fredoka, Nunito, sans-serif';
  const pn = pick ? pick.name : 'Coto Makassar';
  x.fillText(pn.length > 20 ? pn.slice(0, 19) + '…' : pn, W / 2, ry + 120);

  x.fillStyle = 'rgba(58,33,66,.6)';
  x.font = '700 26px Nunito, sans-serif';
  const sub = pick ? `${pick.stall} · ${distOf(pick).toFixed(1).replace('.', ',')} km` : 'Coto Daeng Tata · 1,2 km';
  x.fillText(sub.length > 34 ? sub.slice(0, 33) + '…' : sub, W / 2, ry + 168);

  /* footer */
  x.fillStyle = 'rgba(58,33,66,.45)';
  x.font = '700 26px Nunito, sans-serif';
  x.fillText('cravemood.id', W / 2, CY + CH - 52);

  const dataUrl = cv.toDataURL('image/jpeg', 0.92);
  const blob = await canvasToBlob(cv);
  return { blob, dataUrl };
}

/* toBlob can silently never fire (or OOM on huge PNGs) — fall back to the data URL bytes */
function canvasToBlob(cv) {
  return new Promise(resolve => {
    let done = false;
    const finish = b => { if (!done) { done = true; resolve(b); } };
    try { cv.toBlob(b => finish(b), 'image/jpeg', 0.92); } catch (e) {}
    setTimeout(() => {
      if (done) return;
      try {
        const url = cv.toDataURL('image/jpeg', 0.92);
        const bin = atob(url.split(',')[1]);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        finish(new Blob([u8], { type: 'image/jpeg' }));
      } catch (e) { finish(null); }
    }, 2200);
  });
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    const to = setTimeout(() => rej(new Error('img timeout')), 1200);
    i.onload = () => { clearTimeout(to); res(i); };
    i.onerror = () => { clearTimeout(to); rej(new Error('img error')); };
    i.src = src;
  });
}

let vipPkg = null, vipStep = 'pkg';

function openVipModal() {
  const modal = $('#vipModal');
  modal.classList.add('on');
  vipStep = 'pkg'; vipPkg = null;
  renderVipModal();
}

function renderVipModal() {
  const features = (VIP_FEATURES_I18N[App.lang] || VIP_FEATURES_I18N.id);
  const L = I18N[App.lang] || I18N.id;
  const body = $('#vipBody');

  if (vipStep === 'pkg') {
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="width:80px;height:80px;margin:0 auto">${cimo(App.mood, 76, false, 'crown')}</div>
        <h3 style="margin-top:6px;font-size:1.1rem">${t('vip_t')}</h3>
        <p class="hint" style="font-size:.8rem">${t('vip_sub')}</p>
      </div>
      <div class="vipfeatures" style="margin-bottom:14px;font-size:.88rem">
        ${features.map(f => `<div><span class="xck">✓</span>${f}</div>`).join('')}
      </div>
      <div style="font:700 .8rem Fredoka;margin-bottom:8px">${t('pay_pkg')}</div>
      <div class="pkggrid">
        ${VIP_PACKAGES.map(p => {
          const lbl = (p.labelI18n && p.labelI18n[App.lang]) || p.label;
          const tag = p.popular ? `<span class="tag gold">${t('pay_popular')}</span>` : p.best ? `<span class="tag mint">${t('pay_best')}</span>` : '';
          return `<button class="pkgcard ${vipPkg === p.id ? 'on' : ''}" data-pkg="${p.id}">
            <div class="pkgtop"><b>${lbl}</b>${tag}</div>
            <div class="pkgprice">Rp ${String(p.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</div>
            <div class="pkghint">${p.months} ${t('pay_month')}</div>
          </button>`;
        }).join('')}
      </div>
      <button class="btn block" id="vipNextPkg" style="margin-top:14px" disabled>${t('pay_confirm')}</button>
    `;
    $$('#vipBody .pkgcard').forEach(b => b.onclick = () => {
      vipPkg = b.dataset.pkg;
      $$('#vipBody .pkgcard').forEach(x => x.classList.toggle('on', x.dataset.pkg === vipPkg));
      $('#vipNextPkg').disabled = false;
      SFX.play('tap');
    });
    $('#vipNextPkg').onclick = () => { if (vipPkg) { vipStep = 'pay'; renderVipModal(); } };
  }

  if (vipStep === 'pay') {
    const pkg = VIP_PACKAGES.find(p => p.id === vipPkg);
    const acc = PAYMENT_ACCOUNT;
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:12px">
        <div style="width:70px;height:70px;margin:0 auto">${cimo(App.mood, 66, false, 'crown')}</div>
        <h3 style="margin-top:6px;font-size:1.05rem">${t('pay_t')}</h3>
      </div>
      <div class="card" style="padding:14px;margin-bottom:12px;background:linear-gradient(135deg,#f4e4f7,#fbe8dc)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="muted" style="font-size:.8rem">${t('pay_pkg')}</span>
          <b style="font-size:.9rem">${esc((pkg.labelI18n && pkg.labelI18n[App.lang]) || pkg.label)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="muted" style="font-size:.8rem">${t('pay_total')}</span>
          <b style="font-size:1.1rem;color:var(--pk2)">Rp ${String(pkg.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</b>
        </div>
      </div>
      <div style="font:700 .8rem Fredoka;margin-bottom:8px">${t('pay_method')}</div>
      <div class="paymethods">
        <button class="paybtn on" data-pay="manual">
          <img src="${acc.logo}" alt="GoPay" style="width:36px;height:36px;border-radius:8px;flex:none">
          <div><b>${acc.label}</b><small>${acc.name}</small></div>
        </button>
        <button class="paybtn" data-pay="wa">
          <span class="payico">💬</span>
          <div><b>${t('pay_wa')}</b><small>Kirim bukti transfer</small></div>
        </button>
      </div>
      <div id="payDetail" style="margin-top:12px">
        <div class="card" style="padding:14px;background:var(--bg);border-style:dashed">
          <div style="text-align:center;margin-bottom:10px">
            <img src="${acc.logo}" alt="GoPay" style="width:64px;height:64px;margin:0 auto 8px;border-radius:14px">
            <div style="font:700 1.3rem Fredoka;color:#00AA13">${acc.bankFull}</div>
            <div style="font:700 1.4rem Fredoka;letter-spacing:2px;margin:6px 0;color:var(--pk2)">${acc.number}</div>
            <div style="font:700 .85rem Nunito">a.n. ${acc.name}</div>
          </div>
          <div class="hint" style="text-align:center;font-size:.75rem;margin-bottom:10px">Kirim nominal sesuai paket ke nomor GoPay di atas, lalu kirim bukti screenshot ke WhatsApp kami.</div>
          <button class="btn sm block" id="copyRek">📋 Salin nomor GoPay</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn ghost" style="flex:1" id="vipBack">‹ Kembali</button>
        <button class="btn" style="flex:2" id="vipConfirmPay">${t('pay_confirm')}</button>
      </div>
    `;
    $$('#vipBody .paybtn').forEach(b => b.onclick = () => {
      $$('#vipBody .paybtn').forEach(x => x.classList.toggle('on', x === b));
      const method = b.dataset.pay;
      const det = $('#payDetail');
      if (method === 'manual') {
        det.innerHTML = `<div class="card" style="padding:14px;background:var(--bg);border-style:dashed">
          <div style="text-align:center;margin-bottom:10px">
            <img src="${acc.logo}" alt="GoPay" style="width:64px;height:64px;margin:0 auto 8px;border-radius:14px">
            <div style="font:700 1.3rem Fredoka;color:#00AA13">${acc.bankFull}</div>
            <div style="font:700 1.4rem Fredoka;letter-spacing:2px;margin:6px 0;color:var(--pk2)">${acc.number}</div>
            <div style="font:700 .85rem Nunito">a.n. ${acc.name}</div>
          </div>
          <div class="hint" style="text-align:center;font-size:.75rem;margin-bottom:10px">Kirim nominal sesuai paket ke nomor GoPay di atas, lalu kirim bukti screenshot ke WhatsApp kami.</div>
          <button class="btn sm block" id="copyRek">📋 Salin nomor GoPay</button>
        </div>`;
        $('#copyRek').onclick = () => { copyText(acc.number); toast('Nomor GoPay disalin'); SFX.play('pop'); };
      } else {
        det.innerHTML = `<div class="card" style="padding:14px;background:var(--bg);border-style:dashed;text-align:center">
          <div style="font:700 .9rem Fredoka;margin-bottom:8px">Pesan via WhatsApp</div>
          <div class="hint" style="font-size:.75rem;margin-bottom:10px">Klik tombol di bawah untuk membuka WhatsApp dan kirim bukti transfer.</div>
          <a href="${acc.whatsapp}" target="_blank" rel="noopener" class="btn block" style="text-decoration:none">💬 Buka WhatsApp</a>
        </div>`;
      }
      SFX.play('tap');
    });
    $('#copyRek').onclick = () => { copyText(acc.number); toast('Nomor GoPay disalin'); SFX.play('pop'); };
    $('#vipBack').onclick = () => { vipStep = 'pkg'; renderVipModal(); };
    $('#vipConfirmPay').onclick = () => submitVipPayment(pkg);
  }

  if (vipStep === 'pending') {
    body.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="width:90px;height:90px;margin:0 auto">${cimo('bingung', 86)}</div>
        <h3 style="margin-top:10px">${t('pay_pending')}</h3>
        <p class="hint" style="margin:8px 0 16px">Transfer ke rekening BNI sedang diproses. VIP akan aktif setelah pembayaran dikonfirmasi.</p>
        <button class="btn" id="vipClosePending">Oke, mengerti</button>
      </div>
    `;
    $('#vipClosePending').onclick = () => { $('#vipModal').classList.remove('on'); render(); };
  }
}

async function submitVipPayment(pkg) {
  if (!App.user) { toast('Masuk dulu ya!'); return; }
  const btn = $('#vipConfirmPay');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses…'; }
  try {
    const orderId = 'VIP-' + App.user.id.slice(-6) + '-' + Date.now().toString(36).toUpperCase();
    const r = await DB.createTransaction(App.user.id, {
      type: 'vip', pkg: pkg.id, months: pkg.months, amount: pkg.price,
      order_id: orderId, gateway: 'manual',
    });
    if (r.ok) {
      SFX.play('success');
      vipStep = 'pending'; renderVipModal();
    } else { toast('Gagal membuat transaksi'); }
  } catch (e) { toast('Gagal memproses pembayaran'); }
  if (btn) { btn.disabled = false; btn.textContent = t('pay_confirm'); }
}

async function openShare() {
  let items = Object.keys(App.cart).map(id => (MENU.find(m => m.id === id) || {}).name).filter(Boolean);
  if (!items.length) items = MENU.filter(m => m.moods.indexOf(App.mood) > -1).slice(0, 3).map(m => m.name);
  const modal = $('#shareModal');
  modal.classList.add('on');
  $('#shareBody').innerHTML = `<div class="empty"><p>Menyiapkan kartu…</p></div>`;
  // fonts can hang when the network is slow — never block the card on them
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]).catch(() => {});
  let card;
  try {
    card = await Promise.race([
      buildShareCard(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
    ]);
  } catch (e) {
    console.error('share card failed:', e && e.message);
    $('#shareBody').innerHTML = `<div class="empty"><div class="big">${cimo('bingung', 90)}</div>
      <p>Kartu gagal dibuat. Coba lagi ya.</p>
      <button class="btn sm" id="retryShare" style="margin-top:10px">Coba lagi</button></div>`;
    const rb = $('#retryShare'); if (rb) rb.onclick = openShare;
    return;
  }
  const blob = card && card.blob;
  App.shareBlob = blob;
  if (!blob) {
    $('#shareBody').innerHTML = `<div class="empty"><p>Kartu kosong. Coba lagi ya.</p>
      <button class="btn sm" id="retryShare" style="margin-top:10px">Coba lagi</button></div>`;
    const rb = $('#retryShare'); if (rb) rb.onclick = openShare;
    return;
  }
  // data URL for the preview: blob URLs can fail to decode large images on low-memory devices
  const url = card.dataUrl;
  const caption = shareCaption(items);
  const nm = (App.user && App.user.name) || (App.lang === 'en' ? 'you' : App.lang === 'zh' ? '你' : App.lang === 'hi' ? 'तुम' : 'kamu');
  $('#shareBody').innerHTML = `
    <div class="sharehero"><h3>${esc(t('share_done').replace('{name}', nm))}</h3></div>
    <img class="sharepreview" src="${url}" alt="CraveMood card">
    <div class="sharebtns">
      <button class="sharebtn ig" data-soc="ig" aria-label="Instagram"><svg viewBox="0 0 24 24">${SOC.ig[1]}</svg></button>
      <button class="sharebtn wa" data-soc="wa" aria-label="WhatsApp"><svg viewBox="0 0 24 24">${SOC.wa[1]}</svg></button>
      <button class="sharebtn dl" id="dlCard" aria-label="Download"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg></button>
      <button class="sharebtn more" id="nativeShare" aria-label="More"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7" fill="#fff" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="#fff" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="#fff" stroke="none"/></svg></button>
    </div>
    <div class="sharelabels"><span>Instagram</span><span>WhatsApp</span><span>${t('share_dl')}</span><span>${t('share_more')}</span></div>
    <p class="sharetip">${t('share_hint')}</p>`;

  const shareUrl = appLink();
  $('#nativeShare').onclick = async () => {
    const file = new File([blob], 'cravemood.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: caption, title: 'CraveMood' }); SFX.play('success'); }
      catch (e) { downloadBlob(blob); }
    } else { downloadBlob(blob); copyText(caption); toast(t('copied')); }
  };
  $('#dlCard').onclick = () => { downloadBlob(blob); SFX.play('pop'); };

  $$('#shareBody [data-soc]').forEach(b => b.onclick = () => shareTo(b.dataset.soc, blob, caption, shareUrl));
}

async function shareTo(k, blob, caption, url) {
  SFX.play('tap');
  const text = encodeURIComponent(caption);
  const u = encodeURIComponent(url);
  if (k === 'ig') {
    const file = new File([blob], 'cravemood.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: caption, title: 'CraveMood' }); return; }
      catch (e) { /* user cancelled */ }
    }
    downloadBlob(blob); copyText(caption);
    toast('Gambar tersimpan & caption disalin. Buka Instagram → Story → unggah.');
    return;
  }
  const links = {
    wa: 'https://wa.me/?text=' + encodeURIComponent(caption + '\n' + url),
    tg: 'https://t.me/share/url?url=' + u + '&text=' + text,
    x: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + u,
    fb: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
  };
  window.open(links[k], '_blank', 'noopener,width=620,height=620');
}
function downloadBlob(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cravemood-' + App.mood + '-' + Date.now() + '.jpg';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function copyText(txt) {
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
  else fallbackCopy(txt);
}
function fallbackCopy(txt) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

/* ---------- admin ---------- */
/* ---------- onboarding ---------- */
let obStep = 0, obLang = 'id', obMode = 'login';
function showOnboard() {
  const o = $('#onboard');
  o.classList.remove('hide');
  obLang = App.lang || 'id';
  obStep = 0;
  obRender();
}

function obRender() {
  const o = $('#onboard');

  /* ---- 0. splash ---- */
  if (obStep === 0) {
    o.className = 'onboard splashwrap';
    o.innerHTML = `<div class="splash">
      <div class="doodle d1">${cimo('senang', 54)}</div>
      <div class="doodle d2">${cimo('bingung', 46)}</div>
      <div class="doodle d3">${cimo('kecewa', 44)}</div>
      <div class="doodle d4">${cimo('sedih', 52)}</div>
      <div class="hero-cimo">${cimo('def', 238)}</div>
      <div class="wordmark"><span>Crave</span><mark>Mood</mark></div>
      <div class="tagline">${t('splash_tag')}</div>
      <button class="startbtn" id="obStart">${t('on_go')} →</button>
      <div class="dots"><i class="on"></i><i></i><i></i><i></i></div>
    </div>`;
    $('#obStart').onclick = () => { SFX.init(); SFX.play('tap'); obStep = 1; obRender(); };
    return;
  }

  o.className = 'onboard';

  /* ---- 1. how it works ---- */
  if (obStep === 1) {
    o.innerHTML = `<div class="box">
      <div class="cimo">${cimo('def', 150, true)}</div>
      <div class="sheetbox">
        <div class="how">
          <div style="text-align:center"><span class="bubble-say">${t('how_sub')}</span></div>
          <h2>${t('how_t')}</h2>
          <div class="howsteps">
            <div class="howstep s1"><span class="num">1</span><span class="ico">${cimo('senang', 44)}</span>
              <div><b>${t('how_1t')}</b><small>${t('how_1s')}</small></div></div>
            <div class="howstep s2"><span class="num">2</span><span class="ico">${cimo('bingung', 44)}</span>
              <div><b>${t('how_2t')}</b><small>${t('how_2s')}</small></div></div>
            <div class="howstep s3"><span class="num">3</span><span class="ico">${cimo('senang', 44)}</span>
              <div><b>${t('how_3t')}</b><small>${t('how_3s')}</small></div></div>
          </div>
          <button class="btn block" id="obHowNext" style="margin-top:16px">${t('how_next')}</button>
        </div>
      </div>
    </div>`;
    $('#obHowNext').onclick = () => { SFX.play('tap'); obStep = 2; obRender(); };
    return;
  }

  /* ---- 2. kenalan (name) ---- */
  if (obStep === 2) {
    o.innerHTML = `<div class="box">
      <div class="cimo">${cimo('def', 168)}</div>
      <div class="sheetbox">
        <h2 style="font-size:1.3rem;line-height:1.25">${t('kenalan_t')}</h2>
        <div class="field" style="margin-top:14px"><label>${t('reg_name')}</label>
          <input id="obName" maxlength="20" placeholder="${t('on_name_ph')}" value="${esc(App.tmpName || '')}"></div>
        <div class="field"><label>${t('on_lang')}</label>
          <div class="langs">${LANGS.map(l => `<button class="langopt ${l.k === obLang ? 'on' : ''}" data-obl="${l.k}" title="${esc(l.label)}" aria-label="${esc(l.label)}"><i>${l.short}</i></button>`).join('')}</div>
          <div class="langnow">${esc((LANGS.find(l => l.k === obLang) || LANGS[0]).label)}</div>
        </div>
        <div class="err" id="obErr"></div>
        <button class="btn block" id="obNext">${t('kenalan_btn')}</button>
        <p class="obnote">${t('kenalan_note')}</p>
      </div>
    </div>`;
    $$('#onboard [data-obl]').forEach(b => b.onclick = () => {
      obLang = b.dataset.obl; App.lang = obLang;
      Voice.set('lang', obLang); App.settings.voiceLang = obLang;
      SFX.play('tap');
      obRender();
    });
    $('#obNext').onclick = () => {
      const v = $('#obName').value.trim();
      if (!v) { $('#obErr').textContent = t('on_need_name'); SFX.play('error'); return; }
      App.tmpName = v; SFX.play('tap'); obStep = 3; obMode = 'register'; obRender();
    };
    return;
  }

  /* ---- 3. masuk / daftar ---- */
  const isLogin = obMode === 'login';
  o.innerHTML = `<div class="box">
    <div class="cimo">${cimo('def', 138)}</div>
    <div class="sheetbox">
      <div class="obtabs">
        <button data-obmode="login" class="${isLogin ? 'on' : ''}">${t('tab_masuk')}</button>
        <button data-obmode="register" class="${!isLogin ? 'on' : ''}">${t('tab_daftar')}</button>
      </div>
      <div class="obwelcome">${isLogin ? t('login_welcome') : t('reg_t')}</div>

      ${isLogin ? `
        <button class="obbtn" id="obGoogle"><span class="gicon">G</span>${t('login_google')}</button>
        <div class="field"><label>${t('login_wa')}</label><input id="obContact" type="text" placeholder="+62 812 3456 7890"></div>
        <div class="field"><label>${t('on_pass')}</label><input id="obPass" type="password" placeholder="••••••••"></div>
        <div class="err" id="obErr"></div>
        <button class="obbtn primary" id="obSubmit">${t('tab_masuk')}</button>
        <div class="obor">${t('login_or')}</div>
        <button class="obbtn ghostline" id="obSkip">${t('login_guest')}</button>
        <p class="obnote">${t('login_terms')}</p>
      ` : `
        <div class="field"><label>${t('reg_name')}</label><input id="obName2" maxlength="20" value="${esc(App.tmpName || '')}" placeholder="${t('on_name_ph')}"></div>
        <div class="field"><label>${t('login_wa')}</label><input id="obContact" type="text" placeholder="+62 812 3456 7890"></div>
        <div class="field"><label>${t('on_pass')}</label><input id="obPass" type="password" placeholder="••••••••"></div>
        <label class="obterms"><input type="checkbox" id="obTerms"> <span>${t('reg_terms')}</span></label>
        <div class="err" id="obErr"></div>
        <button class="obbtn primary" id="obSubmit">${t('reg_btn')}</button>
        <div class="obor">${t('login_or')}</div>
        <button class="obbtn" id="obGoogle"><span class="gicon">G</span>${t('reg_google')}</button>
        <button class="obbtn ghostline" id="obSkip" style="margin-top:9px">${t('on_guest')}</button>
      `}
    </div>
  </div>`;

  $$('#onboard [data-obmode]').forEach(b => b.onclick = () => {
    obMode = b.dataset.obmode; SFX.play('tap'); obRender();
  });
  const g = $('#obGoogle');
  if (g) g.onclick = () => { toast('Google login segera hadir, pakai nomor WhatsApp dulu ya'); SFX.play('tap'); };
  $('#obSkip').onclick = () => doRegister(true);
  $('#obSubmit').onclick = async () => {
    const nameEl = $('#obName2');
    const nm = nameEl ? nameEl.value.trim() : (App.tmpName || '');
    const c = $('#obContact').value.trim(), p = $('#obPass').value;
    if (nameEl && !nm) { $('#obErr').textContent = t('on_need_name'); SFX.play('error'); return; }
    if (!c || !p) { $('#obErr').textContent = t('on_need_cred'); SFX.play('error'); return; }
    const terms = $('#obTerms');
    if (terms && !terms.checked) { $('#obErr').textContent = t('reg_terms'); SFX.play('error'); return; }
    $('#obSubmit').disabled = true;
    let r;
    if (isLogin) {
      r = await DB.login({ contact: c, password: p });
      if (!r.ok) { $('#obErr').textContent = t('login_bad'); SFX.play('error'); $('#obSubmit').disabled = false; return; }
      SFX.play('success'); toast(t('login_ok'));
    } else {
      App.tmpName = nm;
      r = await DB.register({ name: nm, contact: c, password: p, lang: obLang });
      if (!r.ok) { $('#obErr').textContent = r.error === 'exists' ? 'Kontak sudah terdaftar. Coba masuk.' : 'Gagal mendaftar'; SFX.play('error'); $('#obSubmit').disabled = false; return; }
      SFX.play('success'); toast(t('reg_ok'));
    }
    App.user = r.user; DB.setSetting('session', r.user.id);
    finishOnboard();
  };
}
async function doRegister(guest) {
  const r = await DB.register({ name: App.tmpName || t('guest'), contact: '', password: '', lang: obLang, guest: true });
  App.user = r.user; DB.setSetting('session', App.user.id);
  finishOnboard();
}
function finishOnboard() {
  $('#onboard').classList.add('hide');
  App.lang = App.user.lang || obLang;
  Voice.set('lang', App.settings.voiceLang || App.lang);
  ChatEngine.setLang(App.lang);
  ChatEngine.setName(App.user.name);
  savePrefs(); saveSettings();
  boot2();
  if (App.settings.speak) setTimeout(() => Voice.speak(I18N[App.lang].on_sub, { lang: App.lang }), 600);
}

/* ---------- pet ---------- */
function mountPet() {
  const p = $('#pet');
  p.innerHTML = cimo(App.mood, 66) + '<div class="bubble" id="petBubble"></div><div class="hintdot"></div>';
  if (App.pet) { p.style.left = App.pet.x + 'px'; p.style.top = App.pet.y + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; }
  let drag = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  p.addEventListener('pointerdown', e => {
    drag = true; moved = false;
    const r = p.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    p.setPointerCapture(e.pointerId); p.classList.add('drag');
  });
  p.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    const nx = Math.max(6, Math.min(window.innerWidth - 76, ox + dx));
    const ny = Math.max(6, Math.min(window.innerHeight - 76, oy + dy));
    p.style.left = nx + 'px'; p.style.top = ny + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto';
  });
  p.addEventListener('pointerup', e => {
    if (!drag) return;
    drag = false; p.classList.remove('drag');
    if (moved) {
      const r = p.getBoundingClientRect();
      App.pet = { x: Math.round(r.left), y: Math.round(r.top) };
      savePrefs();
    } else {
      go('chat'); SFX.play('pop');
    }
  });
  p.addEventListener('dblclick', () => {
    App.pet = null; p.style.left = ''; p.style.top = ''; p.style.right = ''; p.style.bottom = '';
    savePrefs(); toast('Posisi Cimo direset');
  });
  updatePetFace();
}
function updatePetFace() {
  const p = $('#pet');
  if (!p) return;
  p.innerHTML = cimo(App.mood, 66) + '<div class="bubble" id="petBubble"></div><div class="hintdot"></div>';
}
function petSay(txt) {
  const b = $('#petBubble'); if (!b) return;
  b.textContent = txt; b.classList.add('on');
  clearTimeout(petSay._t);
  petSay._t = setTimeout(() => b.classList.remove('on'), 2300);
}

/* ---------- install / download (PWA) ---------- */
const PLAT = (() => {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  return { ios, android, standalone, mobile: ios || android };
})();
const PLAT_ICON = {
  android: '<path d="M6 10.6h12v6.4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M6.7 9.9a5.3 5.3 0 0 1 10.6 0z"/><path d="M8.4 6.3L7.1 4.4l1.5-.9 1.3 2zM15.6 6.3l1.3-1.9-1.5-.9-1.3 2z"/><circle cx="9.8" cy="7.4" r=".8" fill="#fff"/><circle cx="14.2" cy="7.4" r=".8" fill="#fff"/>',
  ios: '<path d="M16.4 12.9c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.8-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.2 1 8.2.7 1 1.6 2.1 2.7 2 1.1 0 1.5-.7 2.8-.7s1.6.7 2.7.7c1.1 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.4-.9-2.4-3.1zM14.5 6.3c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z"/>',
  desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><rect x="4.8" y="6.2" width="14.4" height="8.6" rx="1" fill="#fff"/><rect x="8" y="18" width="8" height="1.8" rx=".9"/>',
};
let installEvt = null;
const IL = () => INSTALL_I18N[App.lang] || INSTALL_I18N.id;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvt = e;
  if (PLAT.mobile) setTimeout(maybeShowBanner, 1600);
});
window.addEventListener('appinstalled', () => {
  installEvt = null;
  SFX.play('success');
  toast('CraveMood terpasang! 🎉');
  if (App.user) DB.logChat(App.user.id, 'system', 'app_installed').catch(() => {});
  if (currentView === 'profile') render();
});

function maybeShowBanner() {
  if (PLAT.standalone) return;
  if (sessionStorage.getItem('cm_install_bar') === '1') return;
  const b = $('#installbanner');
  if (!b) return;
  const L = IL();
  b.innerHTML = `
    <img src="icon-192.png" alt="CraveMood" style="width:44px;height:44px;border-radius:12px;flex:none;box-shadow:0 3px 10px rgba(122,42,85,.2)">
    <div style="flex:1;min-width:0"><b>${L.banner}</b><small>${L.banner_sub}</small></div>
    <div class="act">
      <button class="go" id="barInstall">${L.install}</button>
      <button class="no" id="barLater">${L.later}</button>
    </div>`;
  b.classList.add('on');
  $('#barLater').onclick = () => { b.classList.remove('on'); sessionStorage.setItem('cm_install_bar', '1'); };
  $('#barInstall').onclick = () => { b.classList.remove('on'); sessionStorage.setItem('cm_install_bar', '1'); openInstall(); };
}

function openInstall() {
  $('#installModal').classList.add('on');
  renderInstall();
}

/* the canonical, always-complete app link (keeps ?sharecode=… so the host gate passes) */
function renderInstall() {
  const L = IL();
  const platform = PLAT.ios ? 'ios' : PLAT.android ? 'android' : 'desktop';
  const steps = platform === 'ios' ? L.stepsI : platform === 'android' ? L.stepsA : L.stepsD;
  const canPrompt = platform === 'android' && !!installEvt && !PLAT.standalone;
  const link = appLink();

  $('#installBody').innerHTML = `
    <div class="dlhero">
      <img src="icon-192.png" alt="CraveMood">
      <div class="dlinfo">
        <b>CraveMood</b>
        <small>${L.version} 2.0 · ${L.light}</small>
        <div class="dltags">
          <span class="tag mint">${L.free}</span>
          <span class="tag">${platform === 'ios' ? L.dl_ios : platform === 'android' ? L.dl_android : L.dl_desktop}</span>
        </div>
      </div>
      ${PLAT.standalone ? `<span class="tag gold">✓ ${L.installed}</span>` : ''}
    </div>

    ${PLAT.standalone
      ? `<div class="dlok">${cimo(App.mood, 54)}<span>${L.off}</span></div>`
      : canPrompt
        ? `<button class="btn block dlmain" id="pwaGo">${icon('down')} ${L.install}</button>`
        : platform !== 'desktop'
          ? `<button class="btn block dlmain" id="shareTop">${icon('share')} ${L.share}</button>`
          : ''}

    <div class="dlsteps">
      <b>${L.howto}</b>
      <ol class="isteps">
        ${steps.map(s => `<li class="istep"><em></em><span>${s}</span></li>`).join('')}
      </ol>
    </div>

    ${platform === 'desktop' ? `
    <div class="dlqr">
      <img id="qrImg" src="${assetUrl('qr-app.png')}" alt="QR code" width="128" height="128"
           onerror="this.parentNode.style.display='none'">
      <div><b>${L.qr_t}</b><small>${L.qr_s}</small></div>
    </div>` : ''}

    <div class="dllink">
      <div class="between"><b>${L.link_t}</b><span class="tag mint">?sharecode</span></div>
      <code id="fullLink">${esc(link)}</code>
      <p class="hint">${L.link_s}</p>
      <div class="iacts">
        <button class="btn sm" id="copyLink">${icon('share')} ${L.copy_full}</button>
        <button class="btn sm ghost" id="shareLink">${icon('arrow')} ${L.share}</button>
      </div>
    </div>`;

  const go = $('#pwaGo');
  if (go) go.onclick = doPwaInstall;
  const st = $('#shareTop');
  if (st) st.onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'CraveMood', text: 'Coba CraveMood, makanan sesuai moodmu', url: link });
      else { copyText(link); toast(L.copied); }
    } catch (e) { copyText(link); toast(L.copied); }
  };
  $('#copyLink').onclick = () => { copyText(link); toast(L.copied); SFX.play('pop'); };
  const sh = $('#shareLink');
  if (sh) sh.onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'CraveMood', text: 'Coba CraveMood, makanan sesuai moodmu', url: link });
      else { copyText(link); toast(L.copied); }
    } catch (e) { copyText(link); toast(L.copied); }
  };
}

async function doPwaInstall() {
  if (!installEvt) return;
  const L = IL();
  const btn = $('#pwaGo');
  if (btn) { btn.disabled = true; btn.textContent = L.installing; }
  try {
    installEvt.prompt();
    const res = await installEvt.userChoice;
    installEvt = null;
    if (res && res.outcome === 'accepted') { SFX.play('success'); toast('CraveMood terpasang! 🎉'); }
    else { SFX.play('tap'); toast(L.notnow); }
  } catch (e) { /* prompt already used */ }
  renderInstall();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- router ---------- */
const RENDER = { home: viewHome, spin: viewSpin, chat: viewChat, cart: viewCart, recap: viewRecap, vip: viewVip, umkm: viewUmkm, profile: viewProfile };

function go(v) {
  if (!RENDER[v]) v = 'home';
  Voice.stop();          /* leaving a screen silences Cimo */
  currentView = v;
  location.hash = '#/' + v;
  render();
}
function render() {
  const v = currentView;
  applyMoodBg();
  $('#view').innerHTML = RENDER[v]();
  $$('#navlist .navbtn, #tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (v === 'home') { renderRecs(); }
  if (v === 'spin') {
    if (App.lastSpin) renderSpinResult(App.lastSpin);
    else {
      $('#spinResult').innerHTML = `<p class="hint" style="margin-top:14px">Tekan <b>Putar roda</b> dan biar Cimo yang mutusin. Kamu tinggal bilang cocok atau nggak.</p>`;
      renderSpinHist();
    }
  }
  if (v === 'chat') {
    if (!App.messages.length) {
      ChatEngine.setName(App.user ? App.user.name : '');
      App.messages.push({ role: 'cimo', text: ChatEngine.greet(App.user ? App.user.name : ''), mood: App.mood });
    }
    renderMessages(); renderChips();
    const vt = $('#voiceToggle'); if (vt) vt.style.color = App.settings.speak ? 'var(--pk2)' : 'var(--mu)';
  }
  if (v === 'cart') { renderCart(); }
  if (v === 'recap') { renderRecap(); }
  if (v === 'vip') { /* vip rendered statically */ }
  if (v === 'umkm') { bindUmkm(); }
  const pet = $('#pet');
  if (pet) pet.classList.toggle('hide', v === 'chat');
  updateCartBar();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function bindUmkm() {
  const cats = $('#umkmCats'); if (cats) {
    cats.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      b.classList.toggle('on'); SFX.play('tap');
    });
  }
  const moods = $('#umkmMoods'); if (moods) {
    moods.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      b.classList.toggle('on'); SFX.play('tap');
    });
  }
  const sub = $('#umkmSubmit'); if (sub) sub.onclick = submitUmkm;
}

/* ---------- global events ---------- */
function bindGlobal() {
  document.addEventListener('click', e => {
    SFX.init();
    const g = e.target.closest('[data-go]');
    if (g) { SFX.play('tap'); go(g.dataset.go); return; }

    const ins = e.target.closest('[data-install]');
    if (ins) { SFX.play('tap'); openInstall(ins.dataset.install); return; }

    const add = e.target.closest('[data-add]');
    if (add) { addToCart(add.dataset.add); flyToCart(add); return; }
    const inc = e.target.closest('[data-inc]');
    if (inc) { addToCart(inc.dataset.inc, true); return; }
    const dec = e.target.closest('[data-dec]');
    if (dec) { decCart(dec.dataset.dec); return; }
    const mood = e.target.closest('[data-mood]');
    if (mood) {
      const firstPick = !App.moodPicked;
      App.mood = mood.dataset.mood;
      App.moodPicked = true;
      ChatEngine.setMood(App.mood);
      SFX.play('pop');
      savePrefs();
      if (firstPick) {
        /* reveal the whole recommendation block for the first time */
        render();
        updatePetFace();
      } else {
        applyMoodBg();
        const hc = $('#heroCimo');
        if (hc) { hc.innerHTML = cimo(App.mood, 40, false, App.costum); hc.classList.add('hop'); setTimeout(() => hc.classList.remove('hop'), 650); }
        const sc = $('#sayCimo');
        if (sc) { sc.innerHTML = cimo(App.mood, 208, false, App.costum); sc.classList.add('hop'); setTimeout(() => sc.classList.remove('hop'), 650); }
        $$('#moods .mpill').forEach(b => b.classList.toggle('on', b.dataset.mood === App.mood));
        renderRecs();
        updatePetFace();
      }
      if (App.user) DB.addMood(App.user.id, App.mood).catch(() => {});
      const mo = MOODS.find(m => m.k === App.mood);
      if (mo) {
        const top = recList()[0];
        const line = mSay(mo, top ? top.name : '');
        const sayEl = $('#say');
        if (sayEl) {
          sayEl.textContent = line;
          sayEl.style.animation = 'none'; void sayEl.offsetWidth; sayEl.style.animation = '';
        }
        const tagEl = $('#moodTag'); if (tagEl) tagEl.textContent = mS(mo);
        /* on Beranda the speech bubble already says it — don't cover the CTA with the pet bubble */
        if (currentView !== 'home') petSay(line.length > 62 ? line.slice(0, 60) + '…' : line);
        if (App.settings.speak) {
          if (sayEl) sayEl.classList.add('talking');
          const pr = Voice.speakMood(mo.k, top ? top.id : '', line);
          if (pr && pr.then) pr.then(() => { const e2 = $('#say'); if (e2) e2.classList.remove('talking'); });
        }
      }
      return;
    }
    const cat = e.target.closest('[data-cat]');
    if (cat) { App.cat = cat.dataset.cat; SFX.play('tap'); $$('#cats .chip').forEach(b => b.classList.toggle('on', b.dataset.cat === App.cat)); renderRecs(); return; }
    const plat = e.target.closest('[data-plat]');
    if (plat) { openPlatform(plat.dataset.plat); return; }
    const shop = e.target.closest('[data-shop]');
    if (shop) { try { window.open(shop.dataset.shop, '_blank', 'noopener'); } catch (err) {} return; }
    const cos = e.target.closest('[data-costum]');
    if (cos) {
      if (!isVip()) { toast(t('vip_only')); SFX.play('error'); return; }
      App.costum = cos.dataset.costum || '';
      savePrefs(); SFX.play('pop'); render(); toast(t('prof_saved'));
      return;
    }
    const lang = e.target.closest('[data-lang]');
    if (lang) { setLang(lang.dataset.lang); return; }
    const chip = e.target.closest('[data-chip]');
    if (chip) { sendChat(chip.dataset.chip); return; }
    const soc = e.target.closest('[data-soc]');
    if (soc) { return; }
  });

  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'streetSel') {
      App.street = e.target.value; savePrefs(); SFX.play('tap');
      renderRecs();
      const sf = $('#sidefoot'); if (sf) renderNav();
      toast('Lokasi: ' + curStreet().name);
    }
    if (id === 'soundSw') { App.settings.sound = e.target.checked; SFX.enabled = e.target.checked; saveSettings(); if (e.target.checked) SFX.play('add'); }
    if (id === 'speakSw') { App.settings.speak = e.target.checked; Voice.set('enabled', e.target.checked); saveSettings(); if (e.target.checked) Voice.preview(); }
    if (id === 'darkSw') { App.settings.theme = e.target.checked ? 'dark' : 'light'; saveSettings(); applyTheme(); }
  });

  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'vol') { App.settings.vol = +e.target.value; $('#volV').textContent = Math.round(e.target.value * 100) + '%'; Voice.set('volume', App.settings.vol); saveSettings(); }
    if (id === 'chatInput') {
      const el = e.target;
      el.style.height = 'auto'; el.style.height = Math.min(110, el.scrollHeight) + 'px';
      $('#sendBtn').disabled = !el.value.trim();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.id === 'chatInput' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const v = e.target.value.trim(); if (v) sendChat(v);
    }
    if (e.key === 'Escape') { $$('.modal.on').forEach(m => m.classList.remove('on')); }
  });

  // delegated handlers for dynamically rendered blocks (target may be a child svg/path)
  document.addEventListener('click', e => {
    const hit = sel => e.target.closest(sel);
    if (hit('#shuffleBtn')) { openSpinPop(); return; }
    if (hit('#spinBtn')) { doSpin(); return; }
    if (hit('#spinAgain')) { doSpin(); return; }
    if (hit('#openShare') || hit('#recapShare')) { openShare(); return; }
    if (hit('#testVoice')) { Voice.preview(); return; }
    if (hit('#startVip')) { openVipModal(); return; }
    if (hit('#logoutBtn')) { DB.setSetting('session', null); location.reload(); return; }
    if (hit('#chatReset')) {
      App.messages = []; ChatEngine.reset();
      const g = ChatEngine.greet(App.user ? App.user.name : '');
      App.messages.push({ role: 'cimo', text: g, mood: App.mood });
      renderMessages(); renderChips(); toast('Chat direset'); return;
    }
    if (hit('#voiceToggle')) {
      App.settings.speak = !App.settings.speak; saveSettings();
      toast(App.settings.speak ? 'Suara Cimo: ON' : 'Suara Cimo: OFF');
      hit('#voiceToggle').style.color = App.settings.speak ? 'var(--pk2)' : 'var(--mu)';
      if (App.settings.speak) Voice.preview();
      return;
    }
    if (hit('#sendBtn')) { const v = $('#chatInput').value.trim(); if (v) sendChat(v); return; }
    if (hit('#micBtn')) { startMic(); return; }
    if (e.target.closest('#shareModal .closebtn') || e.target.id === 'shareModal') { $('#shareModal').classList.remove('on'); return; }
    if (e.target.closest('#installModal .closebtn') || e.target.id === 'installModal') { $('#installModal').classList.remove('on'); return; }
    if (e.target.closest('#spinModal .closebtn') || e.target.id === 'spinModal') { $('#spinModal').classList.remove('on'); SFX.stopTicks(); return; }
  });

  window.addEventListener('hashchange', () => {
    const v = (location.hash || '#/home').replace('#/', '');
    if (RENDER[v] && v !== currentView) { currentView = v; render(); }
  });
  window.addEventListener('resize', () => {
    const p = $('#pet');
    if (p && p.style.left) {
      const r = p.getBoundingClientRect();
      const nx = Math.min(r.left, window.innerWidth - 76), ny = Math.min(r.top, window.innerHeight - 76);
      p.style.left = nx + 'px'; p.style.top = ny + 'px';
    }
  });
}

function flyToCart(btn) {
  const target = $('#cartbar');
  if (!target) return;
  const r = btn.getBoundingClientRect();
  const s = document.createElement('span');
  s.textContent = '🍡';
  s.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;font-size:22px;pointer-events:none;z-index:70;transition:all .7s cubic-bezier(.3,-0.2,.6,1)`;
  document.body.appendChild(s);
  const tr = target.getBoundingClientRect();
  requestAnimationFrame(() => {
    s.style.left = (tr.left + tr.width / 2) + 'px';
    s.style.top = (tr.top + 10) + 'px';
    s.style.transform = 'scale(.4) rotate(30deg)';
    s.style.opacity = '0';
  });
  setTimeout(() => s.remove(), 750);
}

/* ---------- mic ---------- */
let recog = null, micOn = false;
function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('#micBtn');
  if (!SR) { toast('Browser ini belum mendukung input suara. Coba Chrome.'); return; }
  if (micOn && recog) { recog.stop(); return; }
  recog = new SR();
  recog.lang = { id: 'id-ID', en: 'en-US', zh: 'zh-CN', hi: 'hi-IN' }[App.settings.voiceLang || App.lang] || 'id-ID';
  recog.interimResults = false; recog.maxAlternatives = 1;
  recog.onstart = () => { micOn = true; btn.classList.add('on'); $('#chatStatus').textContent = 'Mendengarkan…'; };
  recog.onend = () => { micOn = false; btn.classList.remove('on'); $('#chatStatus').textContent = t('chat_on'); };
  recog.onerror = () => { micOn = false; btn.classList.remove('on'); toast('Suara tidak tertangkap. Coba lagi.'); };
  recog.onresult = ev => {
    const txt = ev.results[0][0].transcript;
    if (txt) sendChat(txt);
  };
  try { recog.start(); } catch (e) { toast('Mikrofon tidak bisa dimulai.'); }
}

/* ---------- language ---------- */
function setLang(l) {
  if (!I18N[l]) return;
  App.lang = l; App.settings.voiceLang = l;
  Voice.set('lang', l); ChatEngine.setLang(l);
  savePrefs(); saveSettings();
  renderNav(); render();
  SFX.play('pop');
  toast(I18N[l].tagline);
}

/* ---------- boot ---------- */
async function boot() {
  await DB.init();
  loadPrefs(); loadCart(); applyTheme();
  SFX.enabled = App.settings.sound;

  const sid = DB.getSetting('session', null);
  if (sid) {
    try { App.user = await DB.me(sid); } catch (e) { App.user = null; }
  }
  if (App.user) {
    App.lang = App.user.lang || App.lang;
    ChatEngine.setLang(App.lang); ChatEngine.setName(App.user.name);
    Voice.set('lang', App.settings.voiceLang || App.lang);
    $('#onboard').classList.add('hide');
    boot2();
  } else {
    obLang = App.lang;
    showOnboard();
  }
}

/* ---------- a soft click on every tappable ---------- */
function initClickSound() {
  if (window.__clickInit) return;
  window.__clickInit = true;
  const SEL = 'button, [role="button"], .chip, .mpill, .langopt, .cosopt, .plat, .fadd, .iconbtn, .tabbar button, .step button, .card, .pickcard, select';
  /* any tap anywhere silences Cimo first; the tap handler below may start a new line */
  document.addEventListener('click', () => Voice.stop(), { capture: true, passive: true });
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest(SEL);
    if (!el || el.disabled) return;
    if (el.hasAttribute('data-add') || el.hasAttribute('data-dec') || el.hasAttribute('data-inc')) return;
    SFX.init();
    SFX.play('tap');
  }, { passive: true, capture: true });
}

/* ---------- Cimo looks at your finger / cursor ---------- */
function initEyeTracking() {
  if (window.__eyeInit) return;
  window.__eyeInit = true;
  let raf = 0, px = 0, py = 0, has = false;
  const SEL = '.bigcimo .ceye, .avatar-lg .ceye, .pet .ceye, .splash .hero-cimo .ceye, .cosopt .ceye';

  function apply() {
    raf = 0;
    if (!has) return;
    const eyes = document.querySelectorAll(SEL);
    for (const g of eyes) {
      const svg = g.ownerSVGElement;
      if (!svg) continue;
      const r = svg.getBoundingClientRect();
      if (r.width < 20) continue;
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.42;
      const dx = px - cx, dy = py - cy;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / Math.max(120, r.width * 0.9));
      const ox = (dx / d) * 5 * reach;
      const oy = (dy / d) * 4 * reach;
      g.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
    }
  }
  function onMove(e) {
    const t = e.touches && e.touches[0] ? e.touches[0] : e;
    if (t.clientX == null) return;
    px = t.clientX; py = t.clientY; has = true;
    if (!raf) raf = requestAnimationFrame(apply);
  }
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchstart', onMove, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('scroll', () => { if (has && !raf) raf = requestAnimationFrame(apply); }, { passive: true });
}

/* ---------- self-update: an already-open app refreshes after a new deploy ---------- */
function checkBuild() {
  try {
    const m = document.querySelector('meta[name="build"]');
    if (!m || !m.content) return;
    fetch('build.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j || !j.v || j.v === m.content) return;
        const u = new URL(location.href);
        if (u.searchParams.get('v') === j.v) return;   // already tried this build
        u.searchParams.set('v', j.v);
        location.replace(u.toString());
      })
      .catch(() => {});
  } catch (e) {}
}

function boot2() {
  checkBuild();
  $('#app').classList.remove('hide');
  renderNav();
  mountPet();
  registerSW();
  initEyeTracking();
  initClickSound();
  Voice.set('name', (App.user && App.user.name) || '');
  /* costumes are a VIP perk — plain users always see the plain Cimo */
  if (!isVip() && App.costum) { App.costum = ''; savePrefs(); }
  /* system voices arrive asynchronously, refresh the picker once they do */
  if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
    let refreshed = false;
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      if (refreshed) return;
      refreshed = true;
      if (currentView === 'profile') render();
    });
  }
  const hash = (location.hash || '#/home').replace('#/', '');
  currentView = RENDER[hash] ? hash : 'home';
  render();
  updateCartBar();
  if (App.user) DB.touch(App.user.id).catch(() => {});
  // seed a mood for today so the recap is alive
  if (App.user) DB.addMood(App.user.id, App.mood).catch(() => {});
  if (PLAT.mobile && !PLAT.standalone) setTimeout(maybeShowBanner, 5200);
}

document.addEventListener('DOMContentLoaded', () => {
  bindGlobal();
  boot();
});
