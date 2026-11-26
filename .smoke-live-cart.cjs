const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const URL = 'https://faturrahman224477-create.github.io/cravemood/?cb=' + Date.now();
const OUT = 'C:/Users/fhatu/.android/Dokumen/Dev 3 Cravemood/shots/';

(async () => {
  const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 430, height: 932 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('#obStart');
  await p.click('#obStart'); await p.click('#obHowNext');
  await p.fill('#obName', 'Fatur'); await p.click('#obNext');
  await p.waitForSelector('#obSkip'); await p.click('#obSkip');
  await p.waitForSelector('#obMeetStart'); await p.click('#obMeetStart');
  await p.waitForTimeout(400);
  await p.locator('#moods .mpill').first().click();
  await p.waitForTimeout(250);
  await p.locator('.fadd').first().click();
  const cartbar = await p.locator('#cartbar').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right) };
  });
  await p.locator('#tabbar button[data-go="cart"]').click();
  await p.waitForTimeout(350);
  const rows = await p.locator('.cartrow').count();
  const title = (await p.textContent('.pagetitle h1')).trim();
  const total = (await p.textContent('.totline').catch(() => '')).trim().replace(/\s+/g, ' ');
  await p.screenshot({ path: OUT + 'live-cart.png' });
  console.log(JSON.stringify({ cartbar, rows, title, total, errs }, null, 2));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
