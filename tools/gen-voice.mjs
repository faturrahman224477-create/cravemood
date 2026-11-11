#!/usr/bin/env node
/* Generate Cimo's voice pack with ElevenLabs.
 *
 *   ELEVEN_KEY=sk_...            (wajib, harus punya izin text_to_speech + voices_read)
 *   ELEVEN_VOICE=<voice_id>      (opsional; kalau kosong dicari otomatis yang namanya "Kuon")
 *   ELEVEN_MODEL=eleven_multilingual_v2
 *
 *   node tools/gen-voice.mjs --dry     # lihat rencana + jumlah karakter tanpa memanggil API
 *   node tools/gen-voice.mjs           # benar-benar membuat audio/cimo/*.mp3 + lines.json
 *
 * Hasilnya dipakai otomatis oleh aplikasi; kalau lines.json tidak ada, Cimo
 * kembali memakai suara sistem (tidak pernah error).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'audio', 'cimo');
const KEY = process.env.ELEVEN_KEY || '';
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const DRY = process.argv.includes('--dry');

/* ---------- 1. what Cimo says ---------- */
const MOOD_LINES = {
  senang: { pre: 'Wah, kamu lagi senang ya! Coba yang manis dan segar,', post: 'bisa jadi pilihan.' },
  sedih: { pre: 'Kamu lagi sedih ya? Peluk dulu. Coba yang hangat dan berkuah,', post: 'misalnya.' },
  marah: { pre: 'Kamu lagi kesal ya? Tarik napas dulu. Coba yang pedas biar lega,', post: 'salah satunya.' },
  bingung: { pre: 'Bingung mau makan apa? Aku pilihin yang aman, mulai dari', post: '.' },
};

const FIXED = {
  greet: 'Hai, aku Cimo. Lagi mood apa hari ini?',
  preview: 'Hai, aku Cimo. Kalau kamu lagi capek, cerita aja. Aku dengerin sampai selesai.',
  added: 'Sudah masuk keranjang.',
  saved: 'Tersimpan.',
};

/* dish names straight out of the MENU block in src/data.js */
const data = fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8');
const menuStart = data.indexOf('const MENU = [');
const menuEnd = data.indexOf('\n];', menuStart);
const menuSrc = menuStart > -1 ? data.slice(menuStart, menuEnd > -1 ? menuEnd : data.length) : '';
const DISHES = [];
const re = /\{id:'([^']+)',\s*name:'([^']+)'/g;
let m;
while ((m = re.exec(menuSrc))) {
  if (DISHES.length >= 60) break;
  DISHES.push({ id: m[1], name: m[2] });
}

/* ---------- 2. build the job list ---------- */
const jobs = [];
const add = (id, text) => {
  const t = String(text || '').trim();
  if (t) jobs.push({ id, text: t });
};
for (const [k, v] of Object.entries(MOOD_LINES)) {
  add(`m_${k}_pre`, v.pre);
  if (v.post && v.post !== '.') add(`m_${k}_post`, v.post);
}
for (const [k, v] of Object.entries(FIXED)) add(`f_${k}`, v);
for (const d of DISHES) add(`d_${d.id}`, d.name);

const chars = jobs.reduce((a, j) => a + j.text.length, 0);
console.log(`voice pack: ${jobs.length} clips, ${chars} characters`);

if (DRY) {
  for (const j of jobs.slice(0, 12)) console.log(`  ${j.id.padEnd(18)} ${j.text}`);
  if (jobs.length > 12) console.log(`  … and ${jobs.length - 12} more`);
  process.exit(0);
}

if (!KEY) {
  console.error('\nELEVEN_KEY belum diisi.');
  console.error('Buat key di elevenlabs.io → Settings → API Keys, centang izin "Text to Speech" dan "Voices".');
  process.exit(1);
}

/* ---------- 3. talk to ElevenLabs ---------- */
const H = { 'xi-api-key': KEY, 'Content-Type': 'application/json' };
const API = 'https://api.elevenlabs.io/v1';

async function findVoice() {
  if (process.env.ELEVEN_VOICE) return process.env.ELEVEN_VOICE;
  const r = await fetch(`${API}/voices`, { headers: H });
  if (!r.ok) throw new Error(`voices ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  const list = j.voices || [];
  const hit = list.find(v => /kuon/i.test(v.name || '')) || list[0];
  if (!hit) throw new Error('tidak ada voice di akun ini');
  console.log(`voice: ${hit.name} (${hit.voice_id})`);
  return hit.voice_id;
}
/* Kuon is a Voice-Library voice: free plans can read it but not synthesise
   with it (HTTP 402). Alice is a premade voice with a near-identical median
   pitch (250 Hz vs Kuon's 242 Hz), so it is the automatic fallback. */
const FALLBACK_VOICE = 'cgSgspJ2msm6clMCkdW9'; // Jessica — Playful, Bright, Warm (276 Hz)
let usingFallback = false;

async function tts(voiceId, text) {
  const vid = usingFallback ? FALLBACK_VOICE : voiceId;
  const body = JSON.stringify({
    text,
    model_id: MODEL,
    voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
  });
  let r = await fetch(`${API}/text-to-speech/${vid}`, {
    method: 'POST',
    headers: { ...H, Accept: 'audio/mpeg' },
    body,
  });
  if (r.status === 402 && !usingFallback) {
    console.log(`\n  voice ${vid} butuh paket berbayar, pindah ke Jessica (premade)`);
    usingFallback = true;
    r = await fetch(`${API}/text-to-speech/${FALLBACK_VOICE}`, {
      method: 'POST',
      headers: { ...H, Accept: 'audio/mpeg' },
      body,
    });
  }
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

const voiceId = await findVoice();
fs.mkdirSync(OUT, { recursive: true });

let done = 0;
for (const j of jobs) {
  const file = `${j.id}.mp3`;
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) { done++; continue; }
  try {
    const buf = await tts(voiceId, j.text);
    fs.writeFileSync(dest, buf);
    done++;
    process.stdout.write(`\r  ${done}/${jobs.length} ${j.id.padEnd(18)}`);
  } catch (e) {
    console.error(`\n  gagal ${j.id}: ${e.message}`);
    if (/401|403|missing_permissions/.test(e.message)) {
      console.error('\n  Key tidak punya izin text_to_speech. Perbaiki dulu di elevenlabs.io → Settings → API Keys.');
      process.exit(2);
    }
  }
  await new Promise(r => setTimeout(r, 120));
}

/* ---------- 4. lines.json ---------- */
const usedVoice = usingFallback ? FALLBACK_VOICE : voiceId;
const lines = { lang: 'id', voice: usedVoice, voiceName: usingFallback ? 'Jessica' : 'Kuon', model: MODEL, moods: {}, dishes: {}, fixed: {} };
for (const k of Object.keys(MOOD_LINES)) {
  lines.moods[k] = {};
  if (fs.existsSync(path.join(OUT, `m_${k}_pre.mp3`))) lines.moods[k].pre = `m_${k}_pre.mp3`;
  if (fs.existsSync(path.join(OUT, `m_${k}_post.mp3`))) lines.moods[k].post = `m_${k}_post.mp3`;
}
for (const d of DISHES) {
  if (fs.existsSync(path.join(OUT, `d_${d.id}.mp3`))) lines.dishes[d.id] = `d_${d.id}.mp3`;
}
for (const k of Object.keys(FIXED)) {
  if (fs.existsSync(path.join(OUT, `f_${k}.mp3`))) lines.fixed[k] = `f_${k}.mp3`;
}
fs.writeFileSync(path.join(OUT, 'lines.json'), JSON.stringify(lines, null, 2));
console.log(`\nselesai: ${done}/${jobs.length} klip → audio/cimo/lines.json`);
