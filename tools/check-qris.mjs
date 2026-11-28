/* End-to-end check of the QRIS pay step: buttons, download, tab switch,
   and a screenshot of the rendered QR for offline decoding.
   node tools/check-qris.mjs [url] [outDir] */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PW_PATH, 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(p)); break; } catch (e) {}
}
const URL = process.argv[2] || 'http://127.0.0.1:8141/';
const OUT = process.argv[3] || '.';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 }, deviceScaleFactor: 2,
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

await page.evaluate(() => {
  enterApp();
  document.querySelector('#onboard')?.classList.add('hide');
  openVipModal();
  vipPkg = '3m';
  vipStep = 'pay';
  renderVipModal();
});
await page.waitForTimeout(600);

const out = {};
out.hasQris = await page.evaluate(() => !!document.querySelector('.qris-card img[src*="qris-cimo"]'));
out.amount = await page.evaluate(() => document.querySelector('.qris-amount .qaval')?.textContent.trim());

/* copy NMID */
await page.click('#copyNmid');
await page.waitForTimeout(250);
out.nmidClip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'n/a'));
out.toast1 = await page.evaluate(() => document.querySelector('#toast')?.textContent.trim());

/* copy amount */
await page.click('#copyAmt');
await page.waitForTimeout(250);
out.amtClip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'n/a'));

/* save QR */
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 6000 }).catch(() => null),
  page.click('#saveQr'),
]);
out.download = dl ? dl.suggestedFilename() : 'none';

/* rendered QR for decoding */
const qr = await page.$('.qris-frame img');
if (qr) await qr.screenshot({ path: OUT + '/qr-rendered.png' });

/* switch to WhatsApp */
await page.evaluate(() => document.querySelector('.paybtn[data-pay="wa"]').click());
await page.waitForTimeout(300);
out.waPanel = await page.evaluate(() => !!document.querySelector('#payDetail a[href*="wa.me"]'));
out.confirmLabel = await page.evaluate(() => document.querySelector('#vipConfirmPay')?.textContent.trim());

/* back to QRIS */
await page.evaluate(() => document.querySelector('.paybtn[data-pay="qris"]').click());
await page.waitForTimeout(250);
out.backToQris = await page.evaluate(() => !!document.querySelector('.qris-card'));

console.log(JSON.stringify(out, null, 2));
console.log('page errors:', errs.length ? errs : 'none');
await browser.close();
