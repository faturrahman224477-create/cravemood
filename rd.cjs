const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const OUT = 'C:/Users/fhatu/.android/Dokumen/Dev 3 Cravemood/social/decision/out/';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1160, height: 1400 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().split('/').pop()); });
  await p.goto('http://127.0.0.1:4205/social/decision/design.html', { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  const imgs = await p.evaluate(() => [...document.images].map(i => i.src.split('/').pop() + ':' + (i.complete && i.naturalWidth > 0)));
  console.log('gambar:', imgs.join(', '));
  for (const id of ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']) {
    const el = await p.$('#' + id);
    await el.screenshot({ path: OUT + id + '.png' });
  }
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
