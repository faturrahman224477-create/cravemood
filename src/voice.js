/* ===== Cimo voice engine =====
   Cimo speaks with ONE voice, and every word must be understandable.

   Order of preference:
     1. a real recording for this exact line  (audio/cimo/manifest.json)
     2. the most natural system voice available, at a calm human pace

   The recorded sample (audio/cimo/cimo-voice.mp3) is kept as Cimo's voice
   identity and can be mapped to lines through the manifest; a 3 second clip
   cannot pronounce new sentences on its own. */

const CIMO_CLIP = 'audio/cimo/cimo-voice.mp3';

/* the host gate also guards sub-resources, so carry the share code along */
function assetUrl(path) {
  try {
    const sc = new URLSearchParams(location.search).get('sharecode');
    if (!sc) return path;
    return path + (path.indexOf('?') > -1 ? '&' : '?') + 'sharecode=' + encodeURIComponent(sc);
  } catch (e) { return path; }
}

/* calm base pace: noticeably slower than the browser default so nothing
   gets swallowed, then nudged per mood */
const BASE_RATE = 0.90;
const MOODTONE = {
  senang: { r: 1.06, p: 1.10, gap: 150 },
  sedih:  { r: 0.94, p: 0.94, gap: 260 },
  marah:  { r: 1.00, p: 0.92, gap: 180 },
  bingung: { r: 0.97, p: 1.04, gap: 210 },
  capek:  { r: 0.92, p: 0.92, gap: 280 },
  kecewa: { r: 0.94, p: 0.90, gap: 270 },
  def:    { r: 1.00, p: 1.00, gap: 190 },
};

const Voice = (() => {
  const synth = window.speechSynthesis || null;
  const LOCALE = { id: 'id-ID', en: 'en-US', zh: 'zh-CN', hi: 'hi-IN' };
  let voices = [], enabled = true, volume = 1, speaking = false, token = 0, currentAudio = null;
  const S = { lang: 'id', name: '' };

  /* ---- reference voice profile -------------------------------------
     the owner's recording is analysed once (median pitch + syllable rate)
     so the spoken voice sits in the same register and tempo as the clip */
  const REF = { pitch: 1, rate: 1, f0: 0, syl: 0, ready: false };
  let refLoading = null;
  /* the analysis is cheap but not instant — remember it after the first run */
  const REF_KEY = 'cm_voice_ref_v1';
  try {
    const c = JSON.parse(localStorage.getItem(REF_KEY) || 'null');
    if (c && c.f0) { REF.pitch = c.pitch; REF.rate = c.rate; REF.f0 = c.f0; REF.syl = c.syl; REF.ready = true; }
  } catch (e) {}

  function analyse(buffer) {
    try {
      const sr = buffer.sampleRate;
      const raw = buffer.getChannelData(0);
      const step = Math.max(1, Math.floor(sr / 8000));
      const n = Math.floor(raw.length / step);
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = raw[i * step];
      const asr = sr / step;
      const frame = Math.floor(asr * 0.04);
      const hop = Math.floor(asr * 0.02);
      const minLag = Math.floor(asr / 400), maxLag = Math.floor(asr / 70);
      const f0s = [];
      let peaks = 0, prevLoud = false;
      for (let s = 0; s + frame < n; s += hop) {
        let e = 0;
        for (let i = 0; i < frame; i++) { const v = x[s + i]; e += v * v; }
        const rms = Math.sqrt(e / frame);
        if (rms > 0.02) {
          let best = 0, bestLag = 0;
          for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            for (let i = 0; i < frame - lag; i++) sum += x[s + i] * x[s + i + lag];
            if (sum > best) { best = sum; bestLag = lag; }
          }
          if (bestLag) { const hz = asr / bestLag; if (hz > 70 && hz < 400) f0s.push(hz); }
        }
        const loud = rms > 0.05;
        if (loud && !prevLoud) peaks++;
        prevLoud = loud;
      }
      f0s.sort((a, b) => a - b);
      const f0 = f0s.length ? f0s[Math.floor(f0s.length / 2)] : 0;
      const dur = buffer.duration || 1;
      return { f0, syl: peaks / dur };
    } catch (e) { return { f0: 0, syl: 0 }; }
  }

  function loadRef() {
    if (refLoading) return refLoading;
    refLoading = (async () => {
      try {
        const res = await fetch(assetUrl(CIMO_CLIP), { cache: 'force-cache' });
        if (!res.ok) return;
        const ab = await res.arrayBuffer();
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        const c = new C();
        const buf = await c.decodeAudioData(ab);
        const r = analyse(buf);
        if (r.f0) REF.pitch = Math.max(0.95, Math.min(1.28, r.f0 / 205));
        if (r.syl) REF.rate = Math.max(0.92, Math.min(1.08, r.syl / 4.2));
        REF.f0 = Math.round(r.f0); REF.syl = +r.syl.toFixed(2); REF.ready = true;
        try { localStorage.setItem(REF_KEY, JSON.stringify({ pitch: REF.pitch, rate: REF.rate, f0: REF.f0, syl: REF.syl })); } catch (e) {}
        try { c.close(); } catch (e) {}
      } catch (e) {}
    })();
    return refLoading;
  }
  loadRef();

  function loadVoices() {
    if (!synth) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
  }
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    synth.onvoiceschanged = loadVoices;
    setTimeout(loadVoices, 400);
    setTimeout(loadVoices, 1500);
  }

  const HUMAN = /natural|neural|online|premium|enhanced|siri|expressive/i;
  const NICE = /gadis|andika|ardi|damayanti|siti|swara|dewi|indah|xiaoxiao|aria|jenny|kalpana|heera|zira|samantha/i;

  function score(v, lang) {
    const want = (LOCALE[lang] || 'id-ID').toLowerCase();
    const pre = want.split('-')[0];
    const n = (v.name || '').toLowerCase();
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    let s = 0;
    if (l === want) s += 60; else if (l.startsWith(pre)) s += 35; else return -1;
    if (HUMAN.test(n)) s += 40;
    if (NICE.test(n)) s += 18;
    if (/google/.test(n)) s += 12;
    if (/microsoft/.test(n)) s += 6;
    if (/female|wanita|perempuan/.test(n)) s += 6;
    if (v.localService) s += 3;
    return s;
  }

  function pickVoice(lang) {
    let best = null, bs = -1;
    for (const v of voices) {
      const s = score(v, lang || S.lang);
      if (s > bs) { bs = s; best = v; }
    }
    return best;
  }

  /* optional exact recordings: { "normalised text": "file.mp3" } */
  let pack = null;
  /* the ElevenLabs voice pack (generated by tools/gen-voice.mjs) */
  let lines = null;
  function packKey(t) {
    return String(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  /* the recordings never contain the user's name — look the line up without it
     (mirrors the same cleanup in tools/gen-chat.mjs) */
  function stripName(t) {
    if (!S.name) return t;
    const n = String(S.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let s = String(t);
    if (new RegExp('^\\s*' + n, 'i').test(s)) {
      s = s.replace(new RegExp('^\\s*' + n + '\\s*[!,.?]?\\s*', 'i'), '');
    } else {
      s = s.replace(new RegExp(n + '\\s*!', 'gi'), '!')
           .replace(new RegExp(',\\s*' + n, 'gi'), '')
           .replace(new RegExp(n + ',\\s*', 'gi'), '')
           .replace(new RegExp(n, 'gi'), 'kamu');
    }
    return s.replace(/\s+([!?.,])/g, '$1').replace(/\s+/g, ' ').trim();
  }
  function lookup(text) {
    if (!pack) return null;
    return pack[packKey(text)] || (S.name ? pack[packKey(stripName(text))] : null) || null;
  }
  let packDone = null;
  function loadPack() {
    if (packDone) return packDone;
    if (!(typeof fetch === 'function' && /^https?:$/.test(location.protocol))) { packDone = Promise.resolve(); return packDone; }
    packDone = fetch(assetUrl('audio/cimo/manifest.json'), { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && typeof j === 'object') pack = j; })
      .catch(() => {});
    return packDone;
  }
  loadPack();
  if (typeof fetch === 'function' && /^https?:$/.test(location.protocol)) {
    fetch(assetUrl('audio/cimo/lines.json'), { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.moods) lines = j; })
      .catch(() => {});
  }

  /* a touch brighter/faster than the raw render = cuter, more cheerful */
  const CIMO_RATE = 1;

  function playFile(path, rate) {
    return new Promise(resolve => {
      let done = false;
      const fin = v => { if (!done) { done = true; resolve(v); } };
      try {
        const a = new Audio(assetUrl(path));
        currentAudio = a;
        a.volume = Math.max(0, Math.min(1, volume));
        const rt = rate || 1;
        if (rt !== 1) {
          a.playbackRate = rt;
          try { a.preservesPitch = false; } catch (e) {}
          try { a.webkitPreservesPitch = false; } catch (e) {}
        }
        a.onended = () => { if (currentAudio === a) currentAudio = null; fin(true); };
        a.onerror = () => fin(false);
        /* never let a stuck player block the next segment */
        a.onloadedmetadata = () => {
          const d = isFinite(a.duration) ? a.duration : 3;
          setTimeout(() => fin(true), (d / rt) * 1000 + 700);
        };
        a.play().then(() => { speaking = true; }).catch(() => fin(false));
        setTimeout(() => fin(true), 20000);
      } catch (e) { fin(false); }
    });
  }
  function playClip(file) { return playFile('audio/cimo/' + file, CIMO_RATE); }

  /* split into short, speakable phrases — short phrases are easier to follow */
  function chunks(text) {
    return String(text)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?。！？…])\s+|(?<=[,;，、])\s+/)
      .map(s => s.trim())
      .filter(Boolean)
      .reduce((acc, s) => {
        const last = acc[acc.length - 1];
        if (last && last.length + s.length < 72) acc[acc.length - 1] = last + ' ' + s;
        else acc.push(s);
        return acc;
      }, []);
  }

  function stop() {
    token++;
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
    if (synth) { try { synth.cancel(); } catch (e) {} }
    speaking = false;
  }

  async function speak(text, opts) {
    opts = opts || {};
    if (!enabled) return Promise.resolve();
    text = String(text || '').trim();
    if (!text) return Promise.resolve();

    if (!pack) await loadPack();
    const clip = lookup(text);
    if (clip) return playClip(clip);

    if (!synth) return Promise.resolve();

    stop();
    const my = token;
    const list = chunks(text);
    if (!list.length) return Promise.resolve();

    const v = pickVoice(opts.lang || S.lang);
    const tone = MOODTONE[opts.mood] || MOODTONE.def;
    const baseRate = BASE_RATE * tone.r * REF.rate * (opts.rate || 1);
    const basePitch = tone.p * REF.pitch * (opts.pitch || 1);
    speaking = true;

    return new Promise(resolve => {
      let i = 0;
      const done = () => { if (my === token) speaking = false; resolve(); };
      const next = () => {
        if (my !== token) return done();
        if (i >= list.length) return done();
        const seg = list[i++];
        const u = new SpeechSynthesisUtterance(seg);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = LOCALE[opts.lang || S.lang] || 'id-ID';

        const isQ = /[?？]$/.test(seg);
        const isComma = /[,;，、]$/.test(seg);
        /* tiny variation keeps it from sounding flat, without speeding it up */
        u.rate = Math.max(0.55, Math.min(1.15, baseRate + (Math.random() * 0.04 - 0.02)));
        u.pitch = Math.max(0, Math.min(2, basePitch + (isQ ? 0.06 : 0) + (Math.random() * 0.04 - 0.02)));
        u.volume = Math.max(0, Math.min(1, volume));

        const pause = i >= list.length ? 0 : (isComma ? Math.round(tone.gap * 0.6) : tone.gap);
        u.onend = () => setTimeout(next, pause);
        u.onerror = () => done();
        try { synth.speak(u); } catch (e) { done(); }
      };
      next();
      /* safety net: some engines never fire onend */
      const guard = setInterval(() => {
        if (my !== token) { clearInterval(guard); return; }
        if (!synth.speaking && !synth.pending) { clearInterval(guard); done(); }
      }, 900);
    });
  }

  return {
    get supported() { return !!synth; },
    get hasPack() { return !!(lines && lines.moods); },
    /* the mood greeting, spoken with the real recorded voice when the pack exists */
    async speakMood(mood, dishId, fallbackText) {
      if (!enabled) return;
      if (lines && lines.moods && lines.moods[mood]) {
        const mm = lines.moods[mood];
        const segs = [];
        if (mm.pre) segs.push(mm.pre);
        if (dishId && lines.dishes && lines.dishes[dishId]) segs.push(lines.dishes[dishId]);
        if (mm.post) segs.push(mm.post);
        if (segs.length) {
          stop();
          const my = token;
          speaking = true;
          for (const s of segs) {
            if (my !== token || !enabled) break;
            await playClip(s);
          }
          if (my === token) speaking = false;
          return;
        }
      }
      return speak(fallbackText || '', { mood });
    },
    /* a canned line (greet / preview / added / saved) with the recorded voice */
    async speakFixed(key, fallbackText, opts) {
      if (!enabled) return;
      const f = lines && lines.fixed && lines.fixed[key];
      if (f) {
        stop();
        const my = token;
        speaking = true;
        await playClip(f);
        if (my === token) speaking = false;
        return;
      }
      return speak(fallbackText || '', opts);
    },
    get ready() { return !!synth && voices.length > 0; },
    get speaking() { return speaking; },
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; if (!v) stop(); },
    get volume() { return volume; },
    set volume(v) { volume = Math.max(0, Math.min(1, v)); },
    get settings() { return { enabled, volume, lang: S.lang, name: S.name, ref: REF }; },
    set(k, v) { if (k === 'volume') volume = v; else if (k === 'enabled') enabled = !!v; else if (k === 'lang') S.lang = v; else if (k === 'name') S.name = v || ''; },
    setAll(o) { if (!o) return; if ('volume' in o) volume = o.volume; if ('enabled' in o) enabled = o.enabled; if ('lang' in o && o.lang) S.lang = o.lang; if ('name' in o) S.name = o.name || ''; },
    stop, speak,
    _lookup(t) { return lookup(t); },
    playOriginal() { return playFile(CIMO_CLIP); },
    preview() {
      return this.speakFixed('preview', 'Hai, aku Cimo. Kalau kamu lagi capek, cerita aja. Aku dengerin sampai selesai.', { mood: 'def' });
    },
  };
})();

/* ===== synthesized UI sounds (no assets needed) ===== */
const SFX = (() => {
  let ctx = null, on = true, tickToken = 0;
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
    /* ticks that slow down with the wheel — feels like it is really spinning */
    spinTicks(dur) {
      if (!on) return;
      const token = ++tickToken;
      const total = dur || 3800;
      const t0 = performance.now();
      const step = () => {
        if (token !== tickToken) return;
        const p = Math.min(1, (performance.now() - t0) / total);
        if (p >= 1) return;
        tone(1500 - p * 780, 0.028, 'square', Math.max(0.018, 0.055 - p * 0.03));
        setTimeout(step, 42 + 300 * Math.pow(p, 2.4));
      };
      step();
    },
    stopTicks() { tickToken++; },
  };
})();
