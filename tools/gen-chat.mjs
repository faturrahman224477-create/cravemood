#!/usr/bin/env node
/* Generate Cimo's canned chat replies with ElevenLabs so the whole app
 * speaks with ONE voice (no more robot TTS mixed in).
 *
 *   ELEVEN_KEY=sk_...  node tools/gen-chat.mjs
 *   ELEVEN_KEY=sk_...  node tools/gen-chat.mjs --dry
 *
 * Writes audio/cimo/c_<hash>.mp3 and merges entries into
 * audio/cimo/manifest.json  (normalised text -> file).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'audio', 'cimo');
const KEY = process.env.ELEVEN_KEY || '';
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const VOICE = process.env.ELEVEN_VOICE || 'cgSgspJ2msm6clMCkdW9'; // Jessica — Playful, Bright, Warm
const DRY = process.argv.includes('--dry');

/* same normalisation the app uses in voice.js */
const packKey = t => String(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/* ---------- pull the Indonesian bank out of chat.js ---------- */
const src = fs.readFileSync(path.join(ROOT, 'src', 'chat.js'), 'utf8');
const idStart = src.indexOf('  id: {');
const enStart = src.indexOf('  en: {');
if (idStart < 0 || enStart < 0) throw new Error('BANK.id tidak ditemukan di chat.js');
const block = src.slice(idStart, enStart);

const raw = [];
const re = /'((?:[^'\\]|\\.)*)'/g;
let m;
while ((m = re.exec(block))) {
  let s = m[1].replace(/\\'/g, "'").replace(/\s+/g, ' ').trim();
  if (s.length < 6 || s.length > 150) continue;
  if (!/[a-zA-Z]/.test(s)) continue;
  /* the spoken variant never uses the real name — strip it cleanly so the
     sentence still reads naturally (mirrors stripName() in src/voice.js) */
  if (/^\s*\{name\}/.test(s)) {
    s = s.replace(/^\s*\{name\}\s*[!,.?]?\s*/, '');
  } else {
    s = s.replace(/\{name\}\s*!/g, '!')
         .replace(/,\s*\{name\}/g, '')
         .replace(/\{name\},\s*/g, '')
         .replace(/\{name\}/g, 'kamu');
  }
  s = s.replace(/\s+([!?.,])/g, '$1').replace(/\s+/g, ' ').trim();
  if (!s) continue;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (/[{}]/.test(s)) continue;              // other placeholders (dish names) are dynamic
  if (/^[a-z_]+$/.test(s)) continue;         // keys, not sentences
  raw.push(s);
}

const seen = new Set();
const lines = [];
for (const s of raw) {
  const k = packKey(s);
  if (!k || seen.has(k)) continue;
  seen.add(k);
  lines.push({ key: k, text: s });
}

const chars = lines.reduce((a, l) => a + l.text.length, 0);
console.log(`chat pack: ${lines.length} lines, ${chars} characters`);

if (DRY) {
  lines.slice(0, 8).forEach(l => console.log('  •', l.text));
  process.exit(0);
}
if (!KEY) { console.error('ELEVEN_KEY belum diisi'); process.exit(1); }

/* ---------- synth ---------- */
async function tts(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
    }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 160)}`);
  return Buffer.from(await r.arrayBuffer());
}

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) || {}; } catch (e) { manifest = {}; }

let done = 0;
for (const l of lines) {
  const file = `c_${crypto.createHash('sha1').update(l.key).digest('hex').slice(0, 12)}.mp3`;
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) { manifest[l.key] = file; done++; continue; }
  try {
    const buf = await tts(l.text);
    fs.writeFileSync(dest, buf);
    manifest[l.key] = file;
    done++;
    process.stdout.write(`\r  ${done}/${lines.length} ${file}`);
  } catch (e) {
    console.error(`\n  gagal "${l.text.slice(0, 40)}": ${e.message}`);
    if (/401|403|402|missing_permissions/.test(e.message)) process.exit(2);
  }
  await new Promise(r => setTimeout(r, 120));
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nselesai: ${done}/${lines.length} klip chat → audio/cimo/manifest.json`);
