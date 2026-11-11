const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const FILE = 'file:///C:/Users/fhatu/.android/Dokumen/Dev%203%20Cravemood/index.html';
const OUT = 'C:/Users/fhatu/.android/Dokumen/Dev 3 Cravemood/shots/';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  await p.goto(FILE, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.click('#obStart'); await p.waitForTimeout(400);
  await p.click('#obHowNext'); await p.waitForTimeout(400);
  await p.fill('#obName', 'Aisyah');
  await p.click('#obNext'); await p.waitForTimeout(400);
  await p.click('#obSkip'); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 'v10-d1-home.png' });

  await p.click('.sidebar [data-go="chat"]'); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + 'v10-d2-chat.png' });

  await p.click('.sidebar [data-go="recap"]'); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + 'v10-d3-recap.png' });

  await p.click('.sidebar [data-go="profile"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'v10-d4-profile.png', fullPage: true });

  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
