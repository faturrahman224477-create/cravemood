#!/usr/bin/env node
/* Regenerate Cimo's voice pack with ElevenLabs Kuon.
 *
 *   ELEVEN_KEY=sk_... ELEVEN_VOICE=<voice id> node tools/gen-voice-kuon.mjs
 *
 * Reads audio/cimo/render-list.txt (filename TAB text) and overwrites the
 * matching mp3 files. The API key is only read from the environment; it is
 * never written to the repository.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'audio', 'cimo');
const LIST = path.join(OUT, 'render-list.txt');
const KEY = process.env.ELEVEN_KEY || '';
const VOICE = process.env.ELEVEN_VOICE || '';
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const STABILITY = 0.5;
const SIMILARITY = 0.75;
const LIMIT = 5;

if (!KEY || !VOICE) {
  console.error('ELEVEN_KEY dan ELEVEN_VOICE wajib diisi lewat environment.');
  process.exit(1);
}

const jobs = fs.readFileSync(LIST, 'utf8').split(/\r?\n/)
  .filter(l => l.trim() && !l.trim().startsWith('#'))
  .map(l => {
    const i = l.indexOf('\t');
    return { file: l.slice(0, i).trim(), text: l.slice(i + 1).trim() };
  })
  .filter(j => j.file && j.text);

console.log(`render: ${jobs.length} clips — voice ${VOICE}, model ${MODEL}`);

let cursor = 0, done = 0, failed = [];
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
          method: 'POST',
          headers: {
            'xi-api-key': KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: job.text,
            model_id: MODEL,
            voice_settings: {
              stability: STABILITY,
              similarity_boost: SIMILARITY,
              use_speaker_boost: true,
            },
          }),
        });
        if (!res.ok) {
          const msg = (await res.text()).slice(0, 180);
          if (res.status === 402 || res.status === 401 || res.status === 403) {
            throw new Error(`${res.status}: ${msg}`);
          }
          throw new Error(`${res.status}: ${msg}`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1500) throw new Error('audio terlalu kecil');
        fs.writeFileSync(path.join(OUT, job.file), buf);
        ok = true;
      } catch (e) {
        if (attempt === 2) failed.push(`${job.file}: ${e.message}`);
        else await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
    if (ok) {
      done++;
      process.stdout.write(`\r  ${done}/${jobs.length} ${job.file.padEnd(24)}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(LIMIT, jobs.length) }, () => worker()));
console.log('');

if (failed.length) {
  console.error(`GAGAL ${failed.length} clip:`);
  failed.slice(0, 20).forEach(f => console.error(' ', f));
  process.exit(2);
}

const linesPath = path.join(OUT, 'lines.json');
const lines = JSON.parse(fs.readFileSync(linesPath, 'utf8'));
lines.voice = VOICE;
lines.voiceName = 'Kuon — Cheerful, Clear and Steady';
lines.model = MODEL;
lines.settings = { stability: STABILITY, similarity_boost: SIMILARITY, use_speaker_boost: true };
fs.writeFileSync(linesPath, JSON.stringify(lines, null, 2) + '\n');
console.log(`selesai: ${done}/${jobs.length} clip voice Kuon → audio/cimo/`);
