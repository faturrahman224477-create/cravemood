// build.mjs — bundle src/* into a single deployable index.html
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const r = p => readFileSync(join(root, p), 'utf8');

const tpl = r('src/template.html');
const css = r('src/style.css');
const js = [
  'src/mascot.js',
  'src/data.js',
  'src/db.js',
  'src/voice.js',
  'src/chat.js',
  'src/app.js',
].map(r).join('\n\n');

// NOTE: use function replacers — a plain string would treat `$$`, `$&`, `$'` as escapes
const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
writeFileSync(join(root, 'index.html'), out, 'utf8');
console.log('index.html written:', (out.length / 1024).toFixed(1) + ' KB');
