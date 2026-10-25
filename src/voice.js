/* ===== Cimo voice engine + sound effects ===== */

const VOICES = [
  {id:'lembut',  name:'Cimo Lembut',  desc:'Halus, pelan, menenangkan', rate:0.92, pitch:1.12, icon:'🌸'},
  {id:'ceria',   name:'Cimo Ceria',   desc:'Cerah, ceria, bersemangat',  rate:1.06, pitch:1.34, icon:'✨'},
  {id:'tenang',  name:'Cimo Tenang',  desc:'Rendah, dewasa, sabar',      rate:0.84, pitch:0.96, icon:'🌙'},
  {id:'energik', name:'Cimo Energik', desc:'Cepat, lincah, playful',     rate:1.16, pitch:1.24, icon:'⚡'},
  {id:'hangat',  name:'Cimo Hangat',  desc:'Berat, hangat, seperti kakak',rate:0.95, pitch:0.82, icon:'🤎'},
];

/* prosody per mood — the voice has to sound like the face the user tapped */
const MOODVOICE = {
  senang: { r:1.07, p:1.17, gap:40 },
  sedih:  { r:0.85, p:0.91, gap:170 },
  marah:  { r:1.05, p:0.89, gap:70 },
  bingung:{ r:0.97, p:1.06, gap:110 },
  capek:  { r:0.79, p:0.89, gap:190 },
  kecewa: { r:0.83, p:0.85, gap:180 },
  def:    { r:1.00, p:1.00, gap:80 },
};

const Voice = (() => {
  const synth = window.speechSynthesis;
  const supported = !!synth;
  let voices = [], cur = null, speaking = false, queue = 0;
  const S = {
    profile: 'lembut', lang: 'id', rate: 1, pitch: 1, volume: 1, enabled: true,
  };

  function loadVoices() {
    if (!supported) return;
    voices = synth.getVoices() || [];
  }
  if (supported) {
    loadVoices();
    synth.addEventListener && synth.addEventListener('voiceschanged', loadVoices);
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = loadVoices;
  }

  const LOCALE = { id: 'id-ID', en: 'en-US', zh: 'zh-CN', hi: 'hi-IN' };

  function pickVoice(lang) {
    const want = (LOCALE[lang] || 'id-ID').toLowerCase();
    const pre = want.split('-')[0];
    const score = v => {
      let s = 0;
      const n = (v.name || '').toLowerCase(), l = (v.lang || '').toLowerCase().replace('_', '-');
      if (l === want) s += 60;
      else if (l.startsWith(pre)) s += 35;
      else return -1;
      if (/natural|neural|premium|enhanced/.test(n)) s += 25;
      if (/google/.test(n)) s += 14;
      if (/microsoft/.test(n)) s += 8;
      if (/female|wanita|perempuan|xiaoxiao|siti|swara|zira|aria|jenny|kalpana|heera/.test(n)) s += 10;
      if (v.localService) s += 4;
      return s;
    };
    let best = null, bs = -1;
    for (const v of voices) { const s = score(v); if (s > bs) { bs = s; best = v; } }
    return best;
  }

  function profile() { return VOICES.find(v => v.id === S.profile) || VOICES[0]; }

  /* split into human-sized chunks so the voice breathes */
  function chunks(text) {
    return String(text)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?。！？…])\s+|(?<=[,;，、])\s+/)
      .map(s => s.trim())
      .filter(Boolean)
      .reduce((acc, s) => {
        const last = acc[acc.length - 1];
        if (last && last.length + s.length < 90) acc[acc.length - 1] = last + ' ' + s;
        else acc.push(s);
        return acc;
      }, []);
  }

  function speak(text, opts) {
    if (!supported || !S.enabled) return Promise.resolve();
    opts = opts || {};
    try { synth.cancel(); } catch (e) {}
    const p = profile();
    const list = chunks(text);
    if (!list.length) return Promise.resolve();
    const v = pickVoice(opts.lang || S.lang);
    const token = ++queue;
    const mv = MOODVOICE[opts.mood] || MOODVOICE.def;
    speaking = true;

    return new Promise(resolve => {
      let i = 0;
      const next = () => {
        if (token !== queue || i >= list.length) { if (token === queue) speaking = false; return resolve(); }
        const seg = list[i++];
        const u = new SpeechSynthesisUtterance(seg);
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = LOCALE[opts.lang || S.lang] || 'id-ID'; }
        // natural prosody: gentle drift, lift at the end of questions, mood-coloured base
        const isQ = /[?？]$/.test(seg);
        const drift = (i === 1 ? -0.03 : 0) + (Math.random() * 0.04 - 0.02);
        u.rate = clamp((opts.rate || p.rate * S.rate) * mv.r + drift, 0.5, 1.8);
        u.pitch = clamp((opts.pitch || p.pitch * S.pitch) * mv.p + (isQ ? 0.07 : 0), 0, 2);
        u.volume = clamp(S.volume, 0, 1);
        u.onend = () => setTimeout(next, i === list.length ? 0 : mv.gap);
        u.onerror = () => { speaking = false; resolve(); };
        try { synth.speak(u); } catch (e) { resolve(); }
      };
      next();
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function stop() { try { synth.cancel(); } catch (e) {} speaking = false; queue++; }

  return {
    get supported() { return supported; },
    get voices() { return voices; },
    get speaking() { return speaking; },
    get settings() { return S; },
    get current() { return profile(); },
    set(k, v) { S[k] = v; },
    setAll(o) { Object.assign(S, o); },
    speak, stop,
    preview(id, lang) {
      const p = VOICES.find(v => v.id === id) || profile();
      const line = {
        id: 'Hai, aku Cimo. Kalau kamu lagi capek, cerita aja. Aku dengerin sampai selesai.',
        en: 'Hi, I am Cimo. If you are tired, just tell me. I will listen until the end.',
        zh: '嗨，我是 Cimo。如果你累了，就跟我说吧，我会听你说完。',
        hi: 'नमस्ते, मैं Cimo हूँ। अगर थक गए हो, तो बताइए। मैं पूरा सुनूँगा।',
      }[lang || S.lang] || '';
      return speak(line, { rate: p.rate * S.rate, pitch: p.pitch * S.pitch, lang: lang || S.lang });
    },
  };
})();

/* ===== synthesized UI sounds (no assets needed) ===== */
const SFX = (() => {
  let ctx = null, on = true;
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gain, slideTo) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.16, c.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  }
  const lib = {
    add() { tone(660, .09, 'triangle', .16, 1180); setTimeout(() => tone(1320, .07, 'sine', .09), 55); },
    remove() { tone(420, .1, 'triangle', .13, 260); },
    tap() { tone(880, .045, 'sine', .07); },
    pop() { tone(520, .07, 'sine', .12, 900); },
    success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .16, 'sine', .11), i * 80)); },
    tick() { tone(1400, .03, 'square', .05); },
    error() { tone(240, .18, 'sawtooth', .09, 160); },
    spin() { for (let i = 0; i < 8; i++) setTimeout(() => tone(900 - i * 60, .04, 'square', .04), i * 55); },
  };
  return {
    get enabled() { return on; },
    set enabled(v) { on = !!v; },
    init() { ac(); },
    play(name) { if (!on) return; try { (lib[name] || lib.tap)(); } catch (e) {} },
  };
})();
