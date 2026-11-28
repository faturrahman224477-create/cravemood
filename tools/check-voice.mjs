/* Headless audio-collision check for the Cimo voice pack.
   Usage: node tools/check-voice.mjs [url]
   Instruments AudioBufferSourceNode + HTMLMediaElement.play, fires rapid
   speakMood() calls and reports the peak number of simultaneous clips. */
import { createRequire } from 'node:module';
/* playwright is not a dependency of this project — resolve it from wherever it
   lives (local node_modules or a global install) so the check stays runnable. */
const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PW_PATH, 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(p)); break; } catch (e) {}
}
if (!chromium) {
  console.error('playwright not found — set PW_PATH to its install dir');
  process.exit(2);
}

const URL = process.argv[2] || 'http://127.0.0.1:8140/';

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.addInitScript(() => {
  window.__probe = { live: 0, peak: 0, starts: 0, stops: 0, html: 0, urls: [] };
  const origCreate = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function () {
    const src = origCreate.call(this);
    const origStart = src.start.bind(src);
    const origStop = src.stop.bind(src);
    let counted = false;
    const release = () => {
      if (!counted) return;
      counted = false;
      window.__probe.live--;
      window.__probe.stops++;
    };
    src.start = (...a) => {
      window.__probe.starts++;
      counted = true;
      window.__probe.live++;
      window.__probe.peak = Math.max(window.__probe.peak, window.__probe.live);
      /* `ended` fires a task later than stop(), so release on stop too —
         otherwise a cancelled clip inflates the overlap count */
      src.addEventListener('ended', release);
      return origStart(...a);
    };
    src.stop = (...a) => { release(); return origStop(...a); };
    return src;
  };
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    window.__probe.html++;
    window.__probe.urls.push(this.currentSrc || this.src);
    return origPlay.apply(this, a);
  };
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* unlock audio + enable the pack */
await page.evaluate(async () => {
  const b = document.querySelector('#startBtn, .start-btn, [data-start]');
  if (b) b.click();
  Voice.enabled = true;
  await Voice.speakFixed('greet');
});
await page.waitForTimeout(4200);

await page.evaluate(() => { window.__probe.live = 0; window.__probe.peak = 0; window.__probe.starts = 0; window.__probe.html = 0; });

/* five rapid mood calls, 180 ms apart — the old "suara tabrakan" scenario */
const dishIds = ['konro', 'coto', 'pallubasa', 'jalang', 'palekko'];
await page.evaluate(async ids => {
  for (const d of ids) {
    Voice.speakMood('sedih', d, 'coba');
    await new Promise(r => setTimeout(r, 180));
  }
}, dishIds);
await page.waitForTimeout(9000);

const probe = await page.evaluate(() => window.__probe);
const pack = await page.evaluate(async () => {
  const r = await fetch('audio/cimo/lines.json', { cache: 'no-store' });
  const j = await r.json();
  return { voice: j.voice, settings: j.settings, dishVoice: j.dishVoice, moodDish: !!j.moodDish };
});

console.log('peak simultaneous clips :', probe.peak);
console.log('<audio> fallback plays  :', probe.html, probe.urls.slice(0, 3));
console.log('sources started/ended   :', probe.starts, '/', probe.stops);
console.log('pack                    :', JSON.stringify(pack));
console.log('page errors             :', errors.length ? errors : 'none');
await browser.close();
process.exit(probe.peak > 1 || probe.html > 0 || errors.length ? 1 : 0);
