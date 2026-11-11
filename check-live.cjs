const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const BASE = 'https://cravemood.apps.workbuddy.host';
const SC = '?sharecode=NG6DCXKIRE';
const OUT = 'C:/Users/fhatu/.android/Dokumen/Dev 3 Cravemood/shots/';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  await p.goto(BASE + '/' + SC, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + 'live-splash.png' });

  await p.click('#obStart'); await p.waitForTimeout(500);
  await p.click('#obHowNext'); await p.waitForTimeout(500);
  await p.fill('#obName', 'Aisyah');
  await p.click('#obNext'); await p.waitForTimeout(500);
  await p.click('#obSkip'); await p.waitForTimeout(2000);
  await p.screenshot({ path: OUT + 'live-home.png' });

  const brand = await p.$eval('.brandrow', e => e.textContent.trim()).catch(() => 'MISSING');
  const pills = await p.$$eval('.mpill', a => a.length);
  const shuffle = await p.$('#shuffleBtn');
  console.log('brand:', brand, '| mood pills:', pills, '| shuffle box:', !!shuffle);
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
