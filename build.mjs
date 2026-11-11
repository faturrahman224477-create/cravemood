// build.mjs — bundle src/* into two deployable files:
//   index.html  → public app (users)
//   dev.html    → developer console (data, users, AI config)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const r = p => readFileSync(join(root, p), 'utf8');
const css = r('src/style.css');

// NOTE: function replacers — a plain string would treat `$$`, `$&`, `$'` as escapes
const BUILD = String(Date.now());
function bundle(template, files, out) {
  const tpl = r(template);
  const js = files.map(r).join('\n\n');
  let html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
  html = html.replace('<head>', `<head>\n<meta name="build" content="${BUILD}">`);
  writeFileSync(join(root, out), html, 'utf8');
  console.log(out.padEnd(12) + (html.length / 1024).toFixed(1) + ' KB');
}

/* lets an already-open app notice a new deploy and refresh itself */
writeFileSync(join(root, 'build.json'), JSON.stringify({ v: BUILD }), 'utf8');

bundle('src/template.html', [
  'src/mascot.js',
  'src/data.js',
  'src/db.js',
  'src/voice.js',
  'src/chat.js',
  'src/app.js',
], 'index.html');

/* the developer console is local-only: it must never end up on the public site */
if (process.env.DEV === '1') {
  bundle('src/dev-template.html', [
    'src/mascot.js',
    'src/data.js',
    'src/db.js',
    'src/dev.js',
  ], 'dev.html');
} else {
  console.log('dev.html    skipped (set DEV=1 to build it locally)');
}
