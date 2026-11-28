/* Screenshot the VIP pay step (QRIS) for a visual check.
   node tools/shot-pay.mjs [url] [outPrefix] */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PW_PATH, 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(p)); break; } catch (e) {}
}
const URL = process.argv[2] || 'http://127.0.0.1:8141/';
const OUT = process.argv[3] || '/tmp/pay';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 980 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

/* jump straight to the pay step */
await page.evaluate(() => {
  if (typeof enterApp === 'function') enterApp();
  const ob = document.querySelector('#onboard'); if (ob) ob.classList.add('hide');
  openVipModal();
  vipPkg = '3m';
  vipStep = 'pay';
  renderVipModal();
});
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '-light.png' });
const card = await page.$('.qris-card');
if (card) await card.screenshot({ path: OUT + '-card.png' });
await page.evaluate(() => { const m = document.querySelector('#vipBody'); if (m) m.scrollTop = m.scrollHeight; });
await page.waitForTimeout(350);
await page.screenshot({ path: OUT + '-bottom.png' });
await page.evaluate(() => { const m = document.querySelector('#vipBody'); if (m) m.scrollTop = 0; });

/* dark theme */
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '-dark.png' });

/* whatsapp tab */
await page.evaluate(() => { document.documentElement.dataset.theme = ''; });
await page.evaluate(() => document.querySelector('#vipBody .paybtn[data-pay="wa"]').click());
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + '-wa.png' });

console.log('errors:', errs.length ? errs : 'none');
await browser.close();
