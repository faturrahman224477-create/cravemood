const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const OUT = 'C:/Users/fhatu/.android/Dokumen/Dev 3 Cravemood/social/decision/out/';
const IDS = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'];
(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  for (const id of IDS) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
    await p.goto('http://127.0.0.1:4205/social/decision/design.html', { waitUntil: 'load', timeout: 60000 });
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(x => {
      document.querySelectorAll('.art').forEach(a => { if (a.id !== x) a.remove(); });
      document.body.style.padding = '0';
      document.body.style.gap = '0';
      document.body.style.background = '#fff';
    }, id);
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + id + '.png', timeout: 60000, animations: 'disabled' });
    console.log('shot', id);
    await p.close();
  }
  await b.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
