const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');
const dir = __dirname;

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/fhatu/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1920 }, deviceScaleFactor: 1 });
  for (let s = 1; s <= 3; s++) {
    await page.goto('file:///' + path.join(dir, 'carousel.html').replace(/\\/g, '/') + '?s=' + s, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const out = path.join(dir, 'slide-' + s + '.png');
    await page.screenshot({ path: out });
    const h1 = await page.locator('h1').textContent();
    console.log('slide ' + s + ':', h1.replace(/<br>/g, ' / '), '->', path.basename(out));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
