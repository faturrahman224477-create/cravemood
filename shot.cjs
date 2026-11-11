const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const FILE = 'file:///C:/Users/fhatu/.android/Dokumen/Dev%203%20Cravemood/index.html';
const OUT = 'C:/Users/fhatu/.android/Dokumen/Dev 3 Cravemood/shots/';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0, 160)); });

  await p.goto(FILE, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: OUT + 'v10-1-splash.png' });

  await p.click('#obStart'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'v10-2-how.png' });

  await p.click('#obHowNext'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'v10-3-name.png' });

  await p.fill('#obName', 'Aisyah');
  await p.click('#obNext'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'v10-4-auth.png' });

  await p.click('#obSkip'); await p.waitForTimeout(1600);
  await p.screenshot({ path: OUT + 'v10-5-home.png' });

  await p.click('[data-mood="sedih"]'); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + 'v10-6-home-sedih.png' });

  await p.click('#shuffleBtn'); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 'v10-7-shuffle.png' });

  await p.click('#heroCimo'); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 'v10-8-profile.png' });

  await p.click('.vipplan .btn'); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 'v10-9-vip.png' });

  // share
  await p.evaluate(() => location.hash = '#/cart');
  await p.waitForTimeout(400);
  await p.evaluate(() => { App.cart = {}; saveCart(); });
  await p.evaluate(() => location.hash = '#/home');
  await p.waitForTimeout(500);
  await p.click('[data-add]'); await p.waitForTimeout(600);
  await p.click('#tabbar [data-go="cart"]'); await p.waitForTimeout(600);
  await p.click('#openShare');
  await p.waitForTimeout(3500);
  await p.screenshot({ path: OUT + 'v10-10-share.png' });

  const shareImg = await p.$('.sharepreview');
  console.log('share preview present:', !!shareImg);
  if (shareImg) {
    const src = await shareImg.getAttribute('src');
    console.log('share src len:', src ? src.length : 0);
    const buf = Buffer.from(src.split(',')[1], 'base64');
    require('fs').writeFileSync(OUT + 'v10-sharecard.jpg', buf);
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
