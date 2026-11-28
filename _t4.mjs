import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/fhatu/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core');
const b = await chromium.launch({ args: ['--no-proxy-server','--proxy-bypass-list=*','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 420, height: 900 } });
const reqs = []; const errs = [];
p.on('request', r => { const u = r.url(); if (u.includes('/audio/cimo/')) reqs.push(u.split('/audio/cimo/')[1]); });
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8136/index.html', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1000);
for (const [mood, dish] of [['senang','konro'], ['sedih','pallubasa'], ['marah','jalang'], ['bingung','coto']]) {
  await p.evaluate(([m, d]) => Voice.speakMood(m, d, 'x'), [mood, dish]);
  await p.waitForTimeout(600);
}
console.log('clips:', reqs.filter(x => x.startsWith('md_') || x.startsWith('m_') || x.startsWith('d_')));
console.log('errors:', errs.length ? errs : 'none');
await b.close();
