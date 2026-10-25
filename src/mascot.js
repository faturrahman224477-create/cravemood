/* ===== Cimo mascot (SVG) — ported 1:1 from the design mockup ===== */
const MOODC = {
  def:    ['#ffa9c9', '#f27aa8'],
  senang: ['#eef26b', '#c9d445'],
  sedih:  ['#8fd3ff', '#5eb0ee'],
  marah:  ['#ffac78', '#f2864c'],
  capek:  ['#f3f6fc', '#cfd5e6'],
  kecewa: ['#ecd7ab', '#cdb27e'],
  bingung:['#9fead0', '#68cdaa'],
};
const MOODLBL = {def:'Cimo', senang:'Senang', sedih:'Sedih', marah:'Marah', capek:'Capek', kecewa:'Kecewa', bingung:'Bingung'};
let _cu = 0;

function cimo(mood, size, peek, costume) {
  mood = MOODC[mood] ? mood : 'def';
  size = size || 120;
  const [a, b] = MOODC[mood], g = 'c' + (_cu++), k = '#2f2a6b';
  const eye = (x, ry, py) => {
    ry = ry === undefined ? 14 : ry; py = py || 0;
    return `<ellipse cx="${x}" cy="${88 + py}" rx="12" ry="${ry}" fill="${k}"/><circle cx="${x + 4}" cy="${82 + py}" r="4.6" fill="#fff"/><circle cx="${x - 3}" cy="${95 + py}" r="2.2" fill="#fff"/>`;
  };
  const st = (d, w) => `<path d="${d}" fill="none" stroke="${k}" stroke-width="${w || 4}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let e = eye(76) + eye(124), x = '', mo = st('M90 110Q100 119 110 110');
  const TY = {def:0, senang:0, sedih:4, marah:2, capek:0, kecewa:6, bingung:0};
  x += `<g transform="translate(0 ${TY[mood]})">` + st('M60 74l-6-4M64 69l-3-6M140 74l6-4M136 69l3-6', 3) + '</g>';

  if (mood === 'senang') {
    mo = '<path d="M84 106Q100 134 116 106Z" fill="#7a2a55"/><ellipse cx="100" cy="122" rx="8" ry="4.5" fill="#ff8fa8"/>';
    x += '<path d="M24 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM168 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffc800"/>';
  }
  if (mood === 'sedih') {
    e = eye(76, 15, 4) + eye(124, 15, 4);
    x += '<path d="M64 108q-6 10 0 13q6-3 0-13z" fill="#fff" opacity=".9"/>';
    mo = st('M88 122Q100 110 112 122');
  }
  if (mood === 'marah') {
    e = eye(76, 11, 2) + eye(124, 11, 2);
    x += '<path d="M150 34l12 12M162 34l-12 12" stroke="#ff4d4d" stroke-width="4.5" stroke-linecap="round"/>';
    mo = st('M88 121Q100 112 112 121');
  }
  if (mood === 'capek') {
    e += `<rect x="62" y="68" width="28" height="20" fill="${a}"/><rect x="110" y="68" width="28" height="20" fill="${a}"/>` + st('M62 88h28M110 88h28');
    mo = st('M91 119h18');
    x += '<path d="M72 12v16M86 6v22M100 4v24M114 6v22M128 12v16" stroke="#8a8fa8" stroke-width="2.5" stroke-linecap="round"/>';
  }
  if (mood === 'kecewa') {
    e = eye(76, 12, 6) + eye(124, 12, 6);
    x += '<path d="M154 50q-6 10 0 13q6-3 0-13z" fill="#bfe6ff" stroke="#6db6f3" stroke-width="2"/>';
    mo = st('M89 121Q100 113 111 121');
  }
  if (mood === 'bingung') {
    e = eye(76, 14) + eye(124, 10, -2);
    x += '<g fill="none" stroke="#2fae8a" stroke-width="3" stroke-linecap="round"><path d="M36 38a8 8 0 1 1 8 8a4 4 0 1 1-4-4"/><path d="M160 36a8 8 0 1 1 8 8a4 4 0 1 1-4-4"/></g><text x="92" y="28" font-size="28" font-weight="700" fill="#2fae8a" font-family="Fredoka,sans-serif">?</text>';
    mo = st('M86 117q7-8 14 0t14 0');
  }
  const core = `<ellipse cx="100" cy="96" rx="70" ry="62" fill="${b}"/><g clip-path="url(#${g})"><ellipse cx="93" cy="89" rx="68" ry="60" fill="${a}"/></g><ellipse cx="62" cy="56" rx="15" ry="8" transform="rotate(-28 62 56)" fill="#fff" opacity=".55"/><circle cx="82" cy="45" r="3.4" fill="#fff" opacity=".55"/><ellipse cx="52" cy="108" rx="11" ry="7" fill="#ff6f9c" opacity=".42"/><ellipse cx="148" cy="108" rx="11" ry="7" fill="#ff6f9c" opacity=".42"/><g fill="#fff" opacity=".6"><circle cx="146" cy="130" r="2"/><circle cx="156" cy="124" r="1.6"/><circle cx="52" cy="132" r="1.8"/><circle cx="62" cy="138" r="1.5"/></g>${e}${x}${mo}`;
  const defs = `<defs><clipPath id="${g}"><ellipse cx="100" cy="96" rx="70" ry="62"/></clipPath><clipPath id="${g}c"><rect x="-10" y="0" width="220" height="138"/></clipPath></defs>`;

  let body;
  if (peek) {
    const hd = cx => `<circle cx="${cx}" cy="139" r="15" fill="${a}" stroke="${b}" stroke-width="1.6"/><circle cx="${cx - 5}" cy="133" r="3.2" fill="#fff" opacity=".5"/>`;
    body = `<svg viewBox="0 18 200 142" width="${size}" style="overflow:visible" role="img" aria-label="Cimo mengintip ${mood}">${defs}<g clip-path="url(#${g}c)">${core}</g>${hd(38)}${hd(162)}</svg>`;
  } else {
    body = `<svg viewBox="0 0 200 185" width="${size}" role="img" aria-label="Cimo ${mood}">${defs}<ellipse cx="100" cy="173" rx="56" ry="7" fill="#3a2142" opacity=".1"/><ellipse cx="78" cy="159" rx="17" ry="9" fill="${b}"/><ellipse cx="122" cy="159" rx="17" ry="9" fill="${b}"/><ellipse cx="32" cy="106" rx="12" ry="14" transform="rotate(-20 32 106)" fill="${a}"/><ellipse cx="168" cy="100" rx="12" ry="14" transform="rotate(20 168 100)" fill="${a}"/>${core}</svg>`;
  }
  if (!costume) return body;
  // costume overlay
  const dk = MOODC[mood][1], g2 = 'k' + (_cu++);
  let o = '';
  if (costume === 'crown') o += `<path d="M68 46L72 20L88 34L100 12L112 34L128 20L132 46Z" fill="#ffd25e" stroke="#e0a82e" stroke-width="3" stroke-linejoin="round"/><circle cx="72" cy="20" r="4" fill="#ff8fb8"/><circle cx="100" cy="12" r="4.5" fill="#8fd3ff"/><circle cx="128" cy="20" r="4" fill="#ff8fb8"/>`;
  if (costume === 'koki') o += `<g stroke="${dk}" stroke-width="2.5"><circle cx="72" cy="26" r="16" fill="#fff"/><circle cx="100" cy="16" r="20" fill="#fff"/><circle cx="128" cy="26" r="16" fill="#fff"/></g><rect x="64" y="30" width="72" height="19" rx="5" fill="#fff" stroke="${dk}" stroke-width="2.5"/><path d="M78 126H122L100 150Z" fill="#ff8fb8"/>`;
  if (costume === 'batik') o += `<g clip-path="url(#${g2})"><path d="M24 132Q100 152 176 132V176H24Z" fill="#7a4a2a"/><path d="M24 132Q100 152 176 132" fill="none" stroke="#e0b25a" stroke-width="3.5"/></g>`;
  return `<div style="position:relative;display:inline-block;line-height:0">${body}<svg viewBox="0 0 200 185" width="${size}" style="position:absolute;left:0;top:0"><defs><clipPath id="${g2}"><ellipse cx="100" cy="96" rx="70" ry="62"/></clipPath></defs>${o}</svg></div>`;
}

/* standalone SVG for canvas export */
function cimoSVG(mood, size) {
  const s = cimo(mood, size || 300).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return s;
}

/* ===== food illustrations (from mockup) ===== */
const FOODART = {
  soup: '<ellipse cx="40" cy="26" rx="30" ry="8" fill="#a65a2e"/><path d="M8 26Q10 54 40 54Q70 54 72 26Z" fill="#fff8ef" stroke="#e6d6c8" stroke-width="2"/><ellipse cx="40" cy="25" rx="28" ry="6.5" fill="#c77a3e"/><circle cx="30" cy="24" r="2.4" fill="#5fb36a"/><circle cx="44" cy="26" r="2" fill="#e9b24c"/><circle cx="52" cy="23" r="2.6" fill="#5fb36a"/><circle cx="38" cy="27" r="1.8" fill="#e9b24c"/><path d="M28 15q-4 4 0 8M40 11q-4 4 0 8M52 15q-4 4 0 8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  drink: '<path d="M22 10H58L54 54Q40 58 26 54Z" fill="#fff" stroke="#e6d6c8" stroke-width="2"/><path d="M23.5 18H56.5L55.3 30H24.7Z" fill="#7fd58f"/><path d="M24.7 30H55.3L54.4 42H25.6Z" fill="#fff4f8"/><path d="M25.6 42H54.4L53.6 53Q40 57 26.4 53Z" fill="#ff8fb8"/><circle cx="34" cy="24" r="3.5" fill="#f4e04e"/><circle cx="46" cy="26" r="3.5" fill="#f4e04e"/><path d="M48 14L58 2" stroke="#ff5f98" stroke-width="3" stroke-linecap="round"/>',
  plate: '<ellipse cx="40" cy="38" rx="34" ry="16" fill="#fff" stroke="#e6d6c8" stroke-width="2"/><ellipse cx="40" cy="36" rx="25" ry="10" fill="#f1f1ec"/><ellipse cx="34" cy="34" rx="14" ry="6" fill="#e0a23c" transform="rotate(-14 34 34)"/><ellipse cx="48" cy="38" rx="12" ry="5" fill="#cf8b2c" transform="rotate(10 48 38)"/><path d="M26 32l8 3M32 30l8 3M44 36l7 3" stroke="#8a4b1e" stroke-width="1.6" stroke-linecap="round"/><path d="M52 30q6-4 10 2q-4 6-10 2z" fill="#e8505b"/>',
  snack: '<ellipse cx="40" cy="46" rx="30" ry="7" fill="#fff" stroke="#e6d6c8" stroke-width="2"/><path d="M12 42Q16 14 40 14Q64 14 68 42Z" fill="#e5a547"/><path d="M12 42Q16 20 40 20" fill="none" stroke="#f6c96b" stroke-width="3"/><path d="M16 42l3-5M26 42l3-9M36 42l2-10M46 42l-1-10M56 42l-3-9M64 42l-3-5" stroke="#b9772a" stroke-width="2" stroke-linecap="round"/><circle cx="62" cy="48" r="4" fill="#e8505b"/>',
  sweet: '<circle cx="40" cy="34" r="20" fill="#ffb6d0"/><circle cx="40" cy="34" r="13" fill="#fff0f6"/><path d="M40 20c-4-6-12-2-9 4l9 9 9-9c3-6-5-10-9-4z" fill="#ff5f98"/><circle cx="24" cy="52" r="3" fill="#ffc800"/><circle cx="56" cy="54" r="2.4" fill="#ff8fb8"/>',
  rice: '<path d="M12 40Q14 16 40 16Q66 16 68 40Z" fill="#fff8ef" stroke="#e6d6c8" stroke-width="2"/><path d="M12 40H68Q66 54 40 54Q14 54 12 40Z" fill="#f2e3c9" stroke="#e6d6c8" stroke-width="2"/><circle cx="32" cy="30" r="3" fill="#e8a33c"/><circle cx="46" cy="26" r="2.6" fill="#5fb36a"/><circle cx="42" cy="36" r="2.4" fill="#e8505b"/>',
};
const art = (kind, h) => `<svg viewBox="0 0 80 62" height="${h}" style="display:block;overflow:visible">${FOODART[kind] || FOODART.plate}</svg>`;

/* ===== icons ===== */
const ICON = {
  home:'<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  wheel:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  chat:'<path d="M21 12a8 8 0 0 1-8 8H8l-4 3V12a8 8 0 0 1 8-8h1a8 8 0 0 1 8 8z"/><circle cx="9" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="13" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r=".9" fill="currentColor" stroke="none"/>',
  bag:'<path d="M6 8h12l-1 12H7z"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0"/>',
  recap:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>',
  pin:'<path d="M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  send:'<path d="M4 12l16-8-6 8 6 8z"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  spark:'<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
  volume:'<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4"/>',
  down:'<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
  check:'<path d="M5 13l4 4L19 7"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
  heart:'<path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6c0 5-7 9.4-7 9.4z"/>',
  db:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  reset:'<path d="M4 4v6h6"/><path d="M20 12a8 8 0 1 1-2.3-5.7L20 10"/>',
};
const icon = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24">${ICON[n] || ''}</svg>`;

/* social icons */
const SOC = {
  ig: ['linear-gradient(135deg,#f9a03f,#e1306c,#7f4fd6)', '<rect x="4" y="4" width="16" height="16" rx="4.6" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="17" cy="7" r="1.2" fill="#fff"/>'],
  wa: ['linear-gradient(135deg,#5ce27a,#128c4b)', '<path d="M12 4a8 8 0 0 0-6.9 12l-1 3.9 4-1A8 8 0 1 0 12 4z" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M9.2 8.6c.3 0 .5.1.7.5l.6 1.3c.1.3 0 .5-.2.7l-.4.4c.5 1 1.3 1.7 2.2 2.1l.4-.5c.2-.2.4-.3.7-.2l1.3.6c.3.1.4.4.4.7 0 .8-.7 1.5-1.5 1.5-2.4 0-5.3-2.8-5.3-5.2 0-.8.6-1.4 1.4-1.4z" fill="#fff"/>'],
  tg: ['linear-gradient(135deg,#5ec6f5,#1c7fd6)', '<path d="M20 5L3.5 11.4l4.6 1.5L20 5zM8.1 12.9l.4 4.6 2.2-2.6M20 5l-3.4 12.6-4.3-3.2" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>'],
  x: ['#111', '<path d="M5 5l6.4 8.2L5.4 19h2.3l4.8-4.7 3.6 4.7H19l-6.7-8.6L18.6 5h-2.3l-4.4 4.3L8.3 5z" fill="#fff"/>'],
  fb: ['linear-gradient(135deg,#5b9bf8,#1b4ea8)', '<path d="M14.5 8.5h2V5.6h-2.4c-2 0-3.3 1.3-3.3 3.4v1.7H8.4v3h2.4V20h3.2v-6.3h2.3l.4-3h-2.7V9.4c0-.6.2-.9.9-.9z" fill="#fff"/>'],
};
