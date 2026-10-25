/* ===== CraveMood app ===== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const App = {
  user: null, lang: 'id', mood: 'senang', cat: 'Semua', street: 'pendidikan',
  cart: {}, messages: [], spinning: false, lastSpin: null, costum: '',
  settings: { sound: true, speak: true, voice: 'lembut', rate: 1, pitch: 1, vol: 1, voiceLang: 'id', theme: 'light' },
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
  if (p.mood) App.mood = p.mood;
  if (p.street) App.street = p.street;
  if (p.costum) App.costum = p.costum;
  App.pet = p.pet || null;
  const s = DB.getSetting('settings', null);
  if (s) App.settings = Object.assign(App.settings, s);
  Voice.setAll({ profile: App.settings.voice, rate: App.settings.rate, pitch: App.settings.pitch, volume: App.settings.vol, lang: App.settings.voiceLang, enabled: true });
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
  const mb = $('#topbadge'); if (mb) { mb.textContent = c; mb.style.display = c ? 'grid' : 'none'; }
}

/* ---------- nav ---------- */
const NAV = [
  ['home', 'home', 'nav_home'],
  ['spin', 'wheel', 'nav_spin'],
  ['chat', 'chat', 'nav_chat'],
  ['cart', 'bag', 'nav_cart'],
  ['recap', 'recap', 'nav_recap'],
  ['vip', 'heart', 'nav_vip'],
  ['profile', 'user', 'nav_profile'],
];

function renderNav() {
  const sb = $('#navlist');
  sb.innerHTML = NAV.map(([v, ic, k]) =>
    `<button class="navbtn" data-go="${v}">${icon(ic)}<span>${t(k)}</span>${v === 'cart' ? `<span class="bdg" id="navbadge" style="display:none">0</span>` : ''}</button>`
  ).join('');
  const tb = $('#tabbar');
  const mobile = ['home', 'spin', 'chat', 'recap', 'vip', 'profile'];
  tb.innerHTML = mobile.map(v => {
    const n = NAV.find(x => x[0] === v);
    return `<button data-go="${v}">${icon(n[1])}<span>${t(n[2])}</span></button>`;
  }).join('');
  const s = $('#sidefoot');
  if (s) s.innerHTML = `
    <div class="minicard">
      <div style="width:38px;height:38px;flex:none">${cimo(App.mood, 36, false, App.costum)}</div>
      <div style="min-width:0"><b>${esc(App.user ? App.user.name : t('guest'))}</b><small>${esc(curStreet().name.replace('Jalan ', 'Jl. '))}</small></div>
    </div>
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
  return `
  <div class="hero">
    <div>
      <span class="say" id="say">${esc(greeting())}${App.user ? ', ' + esc(name) : ''}! 👋</span>
      <h1>${t('home_q')}</h1>
      <p>${t('home_sub')}</p>
      <div class="row" style="margin-top:14px">
        <button class="btn sm plum" data-go="spin">${icon('wheel')} ${t('home_spin')}</button>
        <button class="btn sm ghost" data-go="chat">${icon('chat')} ${t('nav_chat')}</button>
      </div>
    </div>
    <div class="cimobox">
      <div class="halo"></div>
      <div id="heroCimo" class="float">${cimo(App.mood, 190, false, App.costum)}</div>
    </div>
  </div>

  <div class="sectitle"><h2><span class="n">1</span> ${t('home_q')}</h2>
    <button class="link" data-go="chat">${t('nav_chat')} ${icon('arrow')}</button></div>
  <div class="moods" id="moods">
    ${MOODS.map(m => `<button class="mood ${m.k === App.mood ? 'on' : ''}" data-mood="${m.k}" style="--c:${m.c}">
      <div class="face">${cimo(m.face, 48)}</div><b>${mL(m)}</b></button>`).join('')}
  </div>

  <div class="locbar">
    ${icon('pin')}
    <select id="streetSel" aria-label="location">
      ${STREETS.map(s => `<option value="${s.id}" ${s.id === App.street ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>
    <span class="dist">${esc(curStreet().area)}</span>
  </div>

  <div class="sectitle"><h2><span class="n">2</span> ${t('home_rec')}</h2>
    <span class="tag mint" id="moodTag">${mS(moodObj)}</span></div>
  <div class="chips" id="cats">
    ${CATS.map(c => `<button class="chip ${c === App.cat ? 'on' : ''}" data-cat="${c}">${c === 'Terdekat' ? icon('pin') : ''}${cL(c)}</button>`).join('')}
  </div>
  <div class="recs" id="recs"></div>`;
}

function recList() {
  let list = MENU.filter(m => m.moods.indexOf(App.mood) > -1);
  if (App.cat === 'Terdekat') list.sort((a, b) => distOf(a) - distOf(b));
  else if (App.cat === 'Viral') list = list.filter(m => m.viral);
  else if (App.cat !== 'Semua') list = list.filter(m => m.cat === App.cat);
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
    return `<div class="rec">
      <div class="pic" style="background:linear-gradient(135deg,${MOODC[m.moods[0]][0]}55,${MOODC[m.moods[0]][1]}33)">
        ${i === 0 ? `<span class="badge tag pink">${t('best_match')}</span>` : ''}
        ${m.viral ? (i === 0 ? '' : `<span class="badge tag gold">✦ ${t('viral')}</span>`) : ''}
        ${art(m.art, 104)}
        <div class="cimomini">${cimo(m.moods[0], 30)}</div>
      </div>
      <div class="body">
        <h4>${esc(m.name)}</h4>
        <div class="stall">${icon('pin')} ${esc(m.stall)} · ${esc(streetOf(m.st).name.replace('Jalan ', 'Jl. '))}</div>
        <div class="meta"><span>${d} km</span><span>· ±${minsOf(m)} mnt</span><span>· <b>★ ${m.r}</b></span></div>
        <div class="price"><b>${rp(m.lo)} – ${String(m.hi).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</b>
          ${q ? `<span class="step" data-step="${m.id}"><button data-dec="${m.id}">−</button><i>${q}</i><button data-inc="${m.id}">+</button></span>`
              : `<button class="addbtn" data-add="${m.id}">+ ${t('home_add')}</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
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
            return `<div class="seg"><span style="left:${px.toFixed(2)}%;top:${py.toFixed(2)}%">${esc(m.name)}</span></div>`;
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
  let tk = 0;
  const iv = setInterval(() => { if (tk++ < 22) SFX.play('tick'); else clearInterval(iv); }, 190);
  wheel.style.transition = 'transform 4.6s cubic-bezier(.12,.72,.06,1)';
  wheel.style.transform = `rotate(${target}deg)`;
  setTimeout(() => {
    clearInterval(iv);
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
  App.mood = res.mood;
  renderChips(res.chips);
  if (App.user) DB.logChat(App.user.id, 'cimo', res.text).catch(() => {});

  if (App.settings.speak && Voice.supported) {
    Voice.speak(res.text.replace(/\*[^*]+\*/g, ''), { lang: App.settings.voiceLang || App.lang });
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
    <div class="plats">
      ${[['GoFood', '#ee2737', 'gofood', 'Go'], ['GrabFood', '#00a651', 'grabfood', 'G'], ['ShopeeFood', '#f05a28', 'shopeefood', 'S']].map(([n, col, k, letter]) =>
        `<button class="plat" data-plat="${k}" style="--pc:${col}"><i style="background:${col}"><svg viewBox="0 0 24 24"><text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="Fredoka,sans-serif">${letter}</text></svg></i>${n}<u>${t('cart_go')} ↗</u></button>`).join('')}
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
  return `<div class="pagetitle"><div><h1>${t('prof_t')}</h1><p>${t('tagline')}</p></div></div>

  <div class="card" style="text-align:center">
    <div class="avatar-lg">${cimo(App.mood, 82, false, App.costum)}</div>
    <h3 style="font-size:1.15rem">${esc(App.user ? App.user.name : t('guest'))}</h3>
    <small class="muted" style="font-weight:700">${App.user && !App.user.guest ? esc(App.user.contact) : t('guest')}</small>
    <div class="row" style="justify-content:center;margin-top:12px">
      <span class="tag pink">${App.user && App.user.guest ? t('guest') : 'Member'}</span>
      ${isV ? `<span class="tag gold">✦ ${t('vip_badge')}</span>` : ''}
      ${App.user && App.user.umkm ? `<span class="tag mint">UMKM</span>` : ''}
      <span class="tag">${MOODLBL[App.mood] || ''}</span>
    </div>
    ${!isV ? `
    <div class="card" style="margin:14px 0 0;background:linear-gradient(135deg,#e9b6d4,#cdbbf0);text-align:left;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <div style="flex:1"><b style="font:.9rem Fredoka">Paket Gratis</b><div style="font:600 .72rem Nunito;opacity:.85">Buka kostum dan warna Cimo</div></div>
      <button class="btn sm" data-go="vip">${t('vip_start')}</button>
    </div>` : ''}
  </div>

  <div class="card" style="margin-top:12px">
    <div class="between"><b style="font-size:.95rem">${IL().title}</b>${PLAT.standalone ? `<span class="tag mint">✓ ${IL().off}</span>` : ''}</div>
    <p class="hint" style="margin:5px 0 0">${IL().sub}</p>
    <div class="dlcard">
      <button class="dlbtn android" data-install="android">
        <i><svg viewBox="0 0 24 24">${PLAT_ICON.android}</svg></i>
        <div><b>Android</b><small>${installEvt ? IL().on : 'Chrome · PWA'}</small></div>
        ${PLAT.android && PLAT.standalone ? `<span class="ok">✓</span>` : ''}
      </button>
      <button class="dlbtn ios" data-install="ios">
        <i><svg viewBox="0 0 24 24">${PLAT_ICON.ios}</svg></i>
        <div><b>iPhone / iPad</b><small>Safari · PWA</small></div>
        ${PLAT.ios && PLAT.standalone ? `<span class="ok">✓</span>` : ''}
      </button>
    </div>
    <button class="btn ghost sm block" id="dlOffline2" style="margin-top:8px">${icon('down')} ${IL().offline}</button>
  </div>

  <div class="card" style="margin-top:12px">
    <b style="font-size:.95rem">${t('prof_lang')}</b>
    <div class="langs" style="margin-top:10px">
      ${LANGS.map(l => `<button class="langopt ${l.k === App.lang ? 'on' : ''}" data-lang="${l.k}"><i>${l.short}</i>${l.label}</button>`).join('')}
    </div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="between"><b style="font-size:.95rem">${t('prof_voice')}</b><span class="tag">${t('voice_5')}</span></div>
    <div class="voicecard" id="voiceCards">
      ${VOICES.map(v => `<button class="vopt ${v.id === s.voice ? 'on' : ''}" data-voice="${v.id}">
        <b>${v.icon} ${v.name}</b><small>${v.desc}</small>
        <span class="wave">${[8, 12, 6, 14, 9, 5].map(h => `<i style="height:${h}px"></i>`).join('')}</span></button>`).join('')}
    </div>
    <div class="setrow" style="margin-top:10px"><div class="lbl"><b>${t('voice_lang')}</b><small>${LANGS.find(l => l.k === s.voiceLang)?.label || ''}</small></div>
      <select id="voiceLang">${LANGS.map(l => `<option value="${l.k}" ${l.k === s.voiceLang ? 'selected' : ''}>${l.label}</option>`).join('')}</select></div>
    <div class="setrow"><div class="lbl"><b>${t('voice_rate')}</b><small id="rateV">${s.rate.toFixed(2)}×</small></div>
      <input type="range" id="rate" min="0.6" max="1.6" step="0.02" value="${s.rate}"></div>
    <div class="setrow"><div class="lbl"><b>${t('voice_pitch')}</b><small id="pitchV">${s.pitch.toFixed(2)}</small></div>
      <input type="range" id="pitch" min="0.6" max="1.6" step="0.02" value="${s.pitch}"></div>
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
    <div class="setrow"><div class="lbl"><b>${t('prof_design')}</b><small>${App.costum ? COSTUMES.find(c=>c.id===App.costum)?.name : 'Standard'} ${!isVip() && App.costum && COSTUMES.find(c=>c.id===App.costum)?.vip ? '🔒' : ''}</small></div>
      <select id="costumSel">
        ${COSTUMES.map(c => {
          const locked = c.vip && !isVip();
          return `<option value="${c.id}" ${App.costum === c.id ? 'selected' : ''} ${locked ? 'disabled' : ''}>${c.name}${locked ? ' (VIP)' : ''}</option>`;
        }).join('')}
      </select></div>
  </div>

  <div class="card" style="margin-top:12px">
    <b style="font-size:.95rem">${t('prof_data')}</b>
    <div class="row" style="margin-top:10px">
      <button class="btn sm ghost" id="expJson">${icon('down')} ${t('prof_export')}</button>
      <button class="btn sm ghost" id="logoutBtn">${icon('back')} ${t('prof_logout')}</button>
    </div>
    <p class="hint" style="margin-top:10px">Data akunmu tersimpan ${DB.isRemote ? 'di server CraveMood' : 'di perangkat ini'}. Kamu bisa mengunduhnya kapan saja.</p>
  </div>`;
}

/* ---------- VIP ---------- */
function isVip() { return App.user && (App.user.vip || DB.isVip(App.user.id)); }

function viewVip() {
  const features = (VIP_FEATURES_I18N[App.lang] || VIP_FEATURES_I18N.id);
  const isV = isVip();
  return `
  <div class="pagetitle"><div><h1>${t('vip_t')}</h1><p>${t('vip_sub')}</p></div>
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

  <div class="umkmcard">
    <div style="position:relative">
      <div>${cimo('senang', 80, false, 'koki')}</div>
      <div>
        <span class="tag mint">${t('umkm_sub')}</span>
        <h3>${t('umkm_sub')}</h3>
        <p>${t('umkm_desc')}</p>
      </div>
    </div>
    <button class="btn ghost block" data-go="umkm">${t('umkm_t')} →</button>
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
  const W = 1000, H = 1250;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const moodObj = MOODS.find(m => m.k === App.mood) || MOODS[0];
  const c0 = MOODC[moodObj.face] || MOODC.def;

  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#fff7fa'); g.addColorStop(0.38, c0[0] + 'ee'); g.addColorStop(1, c0[1] + 'ff');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  x.fillStyle = 'rgba(255,255,255,.45)';
  for (let i = 20; i < W; i += 44) for (let j = 20; j < H; j += 44) { x.beginPath(); x.arc(i, j, 3.4, 0, 7); x.fill(); }

  // white card
  x.fillStyle = 'rgba(255,255,255,.58)';
  roundRect(x, 52, 52, W - 104, H - 104, 52); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 4; x.stroke();

  // soft mood glow behind the mascot
  const gl = x.createRadialGradient(W / 2, 400, 40, W / 2, 400, 320);
  gl.addColorStop(0, c0[0] + 'cc'); gl.addColorStop(1, c0[0] + '00');
  x.fillStyle = gl; x.beginPath(); x.arc(W / 2, 400, 320, 0, 7); x.fill();

  // header brand
  x.fillStyle = '#3a2142';
  x.font = '700 46px Fredoka, Nunito, sans-serif';
  x.fillText('Crave', 110, 168);
  const cw = x.measureText('Crave').width;
  x.fillStyle = '#ff9ec5'; roundRect(x, 110 + cw + 8, 126, 128, 56, 16); x.fill();
  x.fillStyle = '#3a2142'; x.fillText('Mood', 110 + cw + 24, 168);

  // cimo
  try {
    const img = await loadImg(svgDataUrl(moodObj.face, 380, App.costum));
    x.drawImage(img, W / 2 - 190, 210, 380, 352);
  } catch (e) {}

  x.textAlign = 'center';
  x.fillStyle = '#3a2142';
  x.font = '700 62px Fredoka, Nunito, sans-serif';
  const title = (App.user ? App.user.name + ' · ' : '') + mL(moodObj);
  x.fillText(title.length > 22 ? title.slice(0, 21) + '…' : title, W / 2, 640);
  x.font = '700 30px Nunito, sans-serif'; x.fillStyle = '#7d6683';
  x.fillText(mD(moodObj), W / 2, 686);

  // items
  const items = Object.keys(App.cart).map(id => MENU.find(m => m.id === id)).filter(Boolean).slice(0, 3);
  const list = items.length ? items.map(m => m.name) : MENU.filter(m => m.moods.indexOf(App.mood) > -1).slice(0, 3).map(m => m.name);
  x.font = '700 34px Nunito, sans-serif';
  list.forEach((n, i) => {
    const y = 790 + i * 96;
    x.fillStyle = 'rgba(255,255,255,.85)';
    roundRect(x, 130, y - 52, W - 260, 78, 39); x.fill();
    x.fillStyle = c0[1];
    x.beginPath(); x.arc(178, y - 13, 13, 0, 7); x.fill();
    x.fillStyle = '#3a2142'; x.textAlign = 'left';
    x.fillText(n.length > 26 ? n.slice(0, 25) + '…' : n, 212, y - 2);
    x.textAlign = 'center';
  });

  // footer
  x.fillStyle = '#3a2142'; x.font = '700 26px Nunito, sans-serif';
  x.fillText('Makan sesuai moodmu · cravemood.id', W / 2, H - 130);
  x.fillStyle = 'rgba(58,33,66,.55)'; x.font = '700 22px Nunito, sans-serif';
  x.fillText(new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, H - 92);

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

function openVipModal() {
  const modal = $('#vipModal');
  modal.classList.add('on');
  const features = (VIP_FEATURES_I18N[App.lang] || VIP_FEATURES_I18N.id);
  $('#vipBody').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="width:100px;height:100px;margin:0 auto">${cimo(App.mood, 96, false, 'crown')}</div>
      <h3 style="margin-top:8px">${t('vip_t')}</h3>
      <p class="hint">${t('vip_sub')}</p>
      <span class="tag gold" style="margin-top:6px">${t('vip_price')}</span>
    </div>
    <div class="vipfeatures" style="margin-bottom:16px">
      ${features.map(f => `<div><span class="xck">✓</span>${f}</div>`).join('')}
    </div>
    <button class="btn block" id="confirmVip">${t('vip_start')}</button>
    <p class="hint" style="text-align:center;margin-top:10px">Fitur ini dalam tahap pengembangan. Nantikan!</p>
  `;
  $('#confirmVip').onclick = () => {
    if (!App.user) { toast('Masuk dulu ya!'); return; }
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 1);
    DB.setVip(App.user.id, true, expiry.toISOString()).then(() => {
      App.user.vip = true; App.user.vip_expiry = expiry.toISOString();
      toast('Selamat! Kamu sekarang VIP ✦'); SFX.play('success');
      modal.classList.remove('on'); render();
    }).catch(() => toast('Gagal mengaktifkan VIP'));
  };
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
  $('#shareBody').innerHTML = `
    <img class="preview" src="${url}" alt="CraveMood card">
    <p class="hint" style="text-align:center;margin:12px 0 4px">${t('share_t')}</p>
    <div class="sharegrid">
      <button class="soc" data-soc="ig"><i style="background:${SOC.ig[0]}"><svg viewBox="0 0 24 24">${SOC.ig[1]}</svg></i>Instagram</button>
      <button class="soc" data-soc="wa"><i style="background:${SOC.wa[0]}"><svg viewBox="0 0 24 24">${SOC.wa[1]}</svg></i>WhatsApp</button>
      <button class="soc" data-soc="tg"><i style="background:${SOC.tg[0]}"><svg viewBox="0 0 24 24">${SOC.tg[1]}</svg></i>Telegram</button>
      <button class="soc" data-soc="x"><i style="background:${SOC.x[0]}"><svg viewBox="0 0 24 24">${SOC.x[1]}</svg></i>X</button>
      <button class="soc" data-soc="fb"><i style="background:${SOC.fb[0]}"><svg viewBox="0 0 24 24">${SOC.fb[1]}</svg></i>Facebook</button>
    </div>
    <div class="shareacts">
      <button class="btn sm" id="nativeShare">${icon('share')} ${t('share_native')}</button>
      <button class="btn sm ghost" id="dlCard">${icon('down')} ${t('share_dl')}</button>
      <button class="btn sm ghost" id="copyCap">${t('share_copy')}</button>
    </div>
    <p class="hint" style="margin-top:10px">Instagram tidak menerima unggahan langsung dari web. Tombol Instagram akan membuka panel bagikan HP (pilih Instagram), atau menyimpan gambar + menyalin caption supaya kamu bisa posting manual.</p>`;

  const shareUrl = location.href.split('#')[0];
  $('#nativeShare').onclick = async () => {
    const file = new File([blob], 'cravemood.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: caption, title: 'CraveMood' }); SFX.play('success'); }
      catch (e) { downloadBlob(blob); }
    } else { downloadBlob(blob); copyText(caption); toast(t('copied')); }
  };
  $('#dlCard').onclick = () => downloadBlob(blob);
  $('#copyCap').onclick = () => { copyText(caption); toast(t('copied')); SFX.play('pop'); };

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
let obStep = 1, obLang = 'id', obMode = 'register';
function showOnboard() {
  const o = $('#onboard');
  o.classList.remove('hide');
  o.innerHTML = `<div class="box">
    <div class="cimo" id="obCimo">${cimo('def', 170, true)}</div>
    <div class="sheetbox" id="obBox"></div>
  </div>`;
  obRender();
}
function obRender() {
  const box = $('#obBox');
  if (obStep === 1) {
    box.innerHTML = `
      <h2 style="font-size:1.35rem">${t('on_title')}</h2>
      <p class="sub" style="color:var(--mu);font-size:.82rem;margin:4px 0 14px">${t('on_sub')}</p>
      <div class="field"><label>${t('on_name')}</label><input id="obName" maxlength="20" placeholder="${t('on_name_ph')}" value="${esc(App.tmpName || '')}"></div>
      <div class="field"><label>${t('on_lang')}</label>
        <div class="langs">${LANGS.map(l => `<button class="langopt ${l.k === obLang ? 'on' : ''}" data-obl="${l.k}"><i>${l.short}</i>${l.label}</button>`).join('')}</div>
      </div>
      <div class="err" id="obErr"></div>
      <button class="btn block" id="obNext">${t('on_go')} →</button>
      <button class="btn block ghost sm" id="obGuest" style="margin-top:8px">${t('on_guest')}</button>`;
    $$('#obBox [data-obl]').forEach(b => b.onclick = () => {
      obLang = b.dataset.obl; App.lang = obLang;
      Voice.set('lang', obLang); App.settings.voiceLang = obLang;
      obRender();
    });
    $('#obNext').onclick = () => {
      const v = $('#obName').value.trim();
      if (!v) { $('#obErr').textContent = t('on_need_name'); SFX.play('error'); return; }
      App.tmpName = v; obStep = 2; obRender();
    };
    $('#obGuest').onclick = () => doRegister(true);
  } else {
    box.innerHTML = `
      <h2 style="font-size:1.3rem">${obMode === 'login' ? t('login_t') : t('on_acc')}</h2>
      <p class="sub" style="color:var(--mu);font-size:.8rem;margin:4px 0 14px">${obMode === 'login' ? t('on_have') : t('on_acc_sub')}</p>
      <div class="field"><label>${t('on_email')}</label><input id="obContact" type="text" placeholder="nama@email.com / 08xx"></div>
      <div class="field"><label>${t('on_pass')}</label><input id="obPass" type="password" placeholder="••••••••"></div>
      <div class="err" id="obErr"></div>
      <button class="btn block" id="obSubmit">${obMode === 'login' ? t('on_login') : t('on_reg')}</button>
      <button class="btn block ghost sm" id="obSkip" style="margin-top:8px">${obMode === 'login' ? t('on_guest') : t('on_skip')}</button>
      <p class="hint" style="text-align:center;margin-top:10px">
        <a href="#" id="obToggle" style="color:var(--pk2);font-weight:800">${obMode === 'login' ? t('on_acc') : t('on_have')}</a>
      </p>`;
    $('#obToggle').onclick = e => { e.preventDefault(); obMode = obMode === 'login' ? 'register' : 'login'; obRender(); };
    $('#obSkip').onclick = () => doRegister(true);
    $('#obSubmit').onclick = async () => {
      const c = $('#obContact').value.trim(), p = $('#obPass').value;
      if (!c || !p) { $('#obErr').textContent = t('on_need_cred'); SFX.play('error'); return; }
      $('#obSubmit').disabled = true;
      let r;
      if (obMode === 'login') {
        r = await DB.login({ contact: c, password: p });
        if (!r.ok) { $('#obErr').textContent = t('login_bad'); SFX.play('error'); $('#obSubmit').disabled = false; return; }
        SFX.play('success'); toast(t('login_ok'));
      } else {
        r = await DB.register({ name: App.tmpName, contact: c, password: p, lang: obLang });
        if (!r.ok) { $('#obErr').textContent = r.error === 'exists' ? 'Kontak sudah terdaftar. Coba masuk.' : 'Gagal mendaftar'; SFX.play('error'); $('#obSubmit').disabled = false; return; }
        SFX.play('success'); toast(t('reg_ok'));
      }
      App.user = r.user; DB.setSetting('session', r.user.id);
      finishOnboard();
    };
  }
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
  petSay._t = setTimeout(() => b.classList.remove('on'), 3200);
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
let installTab = PLAT.ios ? 'ios' : PLAT.android ? 'android' : 'desktop';
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

function openInstall(tab) {
  if (tab) installTab = tab;
  $('#installModal').classList.add('on');
  renderInstall();
}

function renderInstall() {
  const L = IL();
  const steps = installTab === 'ios' ? L.stepsI : installTab === 'android' ? L.stepsA : L.stepsD;
  const canPrompt = installTab === 'android' && !!installEvt;
  const ico = installTab === 'ios' ? PLAT_ICON.ios : installTab === 'android' ? PLAT_ICON.android : PLAT_ICON.desktop;
  const iconBg = installTab === 'ios' ? 'var(--ink)' : installTab === 'android' ? '#3ddc84' : 'var(--pk)';
  const iconCol = installTab === 'ios' ? 'var(--bg)' : installTab === 'android' ? '#0b3d24' : '#3a2142';
  $('#installBody').innerHTML = `
    <div class="itabs">
      <button data-itab="android" class="${installTab === 'android' ? 'on' : ''}">${L.tabA}</button>
      <button data-itab="ios" class="${installTab === 'ios' ? 'on' : ''}">${L.tabI}</button>
      <button data-itab="desktop" class="${installTab === 'desktop' ? 'on' : ''}">${L.tabD}</button>
    </div>
    <div class="installhero">
      <img src="icon-192.png" alt="CraveMood" style="width:56px;height:56px;border-radius:16px;flex:none;box-shadow:0 4px 14px rgba(122,42,85,.25)">
      <div style="flex:1;min-width:0">
        <b>${L.title}</b>
        <small>${PLAT.standalone ? L.off : L.on}</small>
      </div>
      ${PLAT.standalone ? `<span class="tag mint">✓</span>` : ''}
    </div>
    ${canPrompt && !PLAT.standalone ? `<button class="btn block" id="pwaGo">${icon('down')} ${L.install}</button>` : ''}
    <ol class="isteps" style="margin-top:${canPrompt && !PLAT.standalone ? 14 : 0}px">
      ${steps.map(s => `<li class="istep"><em></em><span>${s}</span></li>`).join('')}
    </ol>
    <div class="iacts">
      <button class="btn sm ghost" id="dlOffline">${icon('down')} ${L.offline}</button>
      <button class="btn sm ghost" id="copyLink">${icon('share')} ${L.copy}</button>
    </div>
    <div class="inote">${L.note}<br><b>${L.apk}</b> ${L.apk_note}</div>`;

  $$('#installBody [data-itab]').forEach(b => b.onclick = () => { installTab = b.dataset.itab; renderInstall(); SFX.play('tap'); });
  const go = $('#pwaGo');
  if (go) go.onclick = doPwaInstall;
  $('#dlOffline').onclick = downloadOffline;
  $('#copyLink').onclick = () => { copyText(location.href); toast(L.copied); SFX.play('pop'); };
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

async function downloadOffline() {
  const L = IL();
  SFX.play('pop');
  try {
    let html = '';
    try {
      const r = await fetch('index.html', { cache: 'no-store' });
      if (r.ok) html = await r.text();
    } catch (e) { /* file:// */ }
    if (!html) html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cravemood-offline.html';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(L.saved);
  } catch (e) { toast(L.fail); SFX.play('error'); }
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
  currentView = v;
  location.hash = '#/' + v;
  render();
}
function render() {
  const v = currentView;
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
      App.mood = mood.dataset.mood;
      ChatEngine.setMood(App.mood);
      SFX.play('pop');
      savePrefs();
      const hc = $('#heroCimo');
      if (hc) { hc.innerHTML = cimo(App.mood, 190, false, App.costum); hc.classList.add('hop'); setTimeout(() => hc.classList.remove('hop'), 650); }
      $$('#moods .mood').forEach(b => b.classList.toggle('on', b.dataset.mood === App.mood));
      renderRecs();
      updatePetFace();
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
        petSay(line.length > 62 ? line.slice(0, 60) + '…' : line);
        if (App.settings.speak) Voice.speak(line, { lang: App.settings.voiceLang || App.lang, mood: mo.k });
      }
      return;
    }
    const cat = e.target.closest('[data-cat]');
    if (cat) { App.cat = cat.dataset.cat; SFX.play('tap'); $$('#cats .chip').forEach(b => b.classList.toggle('on', b.dataset.cat === App.cat)); renderRecs(); return; }
    const plat = e.target.closest('[data-plat]');
    if (plat) { openPlatform(plat.dataset.plat); return; }
    const lang = e.target.closest('[data-lang]');
    if (lang) { setLang(lang.dataset.lang); return; }
    const vo = e.target.closest('[data-voice]');
    if (vo) {
      App.settings.voice = vo.dataset.voice; saveSettings();
      $$('#voiceCards .vopt').forEach(b => b.classList.toggle('on', b.dataset.voice === App.settings.voice));
      Voice.set('profile', App.settings.voice);
      Voice.preview(App.settings.voice, App.settings.voiceLang);
      return;
    }
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
    if (id === 'speakSw') { App.settings.speak = e.target.checked; saveSettings(); if (e.target.checked) Voice.preview(App.settings.voice, App.settings.voiceLang); }
    if (id === 'darkSw') { App.settings.theme = e.target.checked ? 'dark' : 'light'; saveSettings(); applyTheme(); }
    if (id === 'voiceLang') { App.settings.voiceLang = e.target.value; Voice.set('lang', e.target.value); saveSettings(); Voice.preview(App.settings.voice, e.target.value); }
    if (id === 'costumSel') {
      const c = COSTUMES.find(x => x.id === e.target.value);
      if (c && c.vip && !isVip()) { toast(t('vip_only')); SFX.play('error'); render(); return; }
      App.costum = e.target.value; savePrefs(); render(); toast(t('prof_saved'));
    }
  });

  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'rate') { App.settings.rate = +e.target.value; $('#rateV').textContent = (+e.target.value).toFixed(2) + '×'; Voice.set('rate', App.settings.rate); saveSettings(); }
    if (id === 'pitch') { App.settings.pitch = +e.target.value; $('#pitchV').textContent = (+e.target.value).toFixed(2); Voice.set('pitch', App.settings.pitch); saveSettings(); }
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
    if (hit('#spinBtn')) { doSpin(); return; }
    if (hit('#spinAgain')) { doSpin(); return; }
    if (hit('#openShare') || hit('#recapShare')) { openShare(); return; }
    if (hit('#testVoice')) { Voice.preview(App.settings.voice, App.settings.voiceLang); return; }
    if (hit('#startVip')) { openVipModal(); return; }
    if (hit('#expJson')) { DB.exportJSON(); return; }
    if (hit('#dlOffline2')) { downloadOffline(); return; }
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
      if (App.settings.speak) Voice.preview(App.settings.voice, App.settings.voiceLang);
      return;
    }
    if (hit('#sendBtn')) { const v = $('#chatInput').value.trim(); if (v) sendChat(v); return; }
    if (hit('#micBtn')) { startMic(); return; }
    if (e.target.closest('#shareModal .closebtn') || e.target.id === 'shareModal') { $('#shareModal').classList.remove('on'); return; }
    if (e.target.closest('#installModal .closebtn') || e.target.id === 'installModal') { $('#installModal').classList.remove('on'); return; }
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

function boot2() {
  $('#app').classList.remove('hide');
  renderNav();
  mountPet();
  registerSW();
  const hash = (location.hash || '#/home').replace('#/', '');
  currentView = RENDER[hash] ? hash : 'home';
  render();
  updateCartBar();
  if (App.user) DB.touch(App.user.id).catch(() => {});
  // seed a mood for today so the recap is alive
  if (App.user) DB.addMood(App.user.id, App.mood).catch(() => {});
  setTimeout(() => petSay('Hai! Geser aku ke mana aja ya 👋'), 2600);
  if (PLAT.mobile && !PLAT.standalone) setTimeout(maybeShowBanner, 5200);
}

document.addEventListener('DOMContentLoaded', () => {
  bindGlobal();
  boot();
});
