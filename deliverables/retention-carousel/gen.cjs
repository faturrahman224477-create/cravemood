/* Generate a richer 3-slide retention carousel for CraveMood. */
const fs = require('fs');
const path = require('path');
const dir = __dirname;

/* load the app's real mascot + food art generators */
eval(fs.readFileSync(path.join(dir, '..', '..', 'src', 'mascot.js'), 'utf8') +
     '\nglobal.__cmArt = art;');
const foodArt = global.__cmArt;

const SLIDES = [
  {
    badge: 'PESAN Khusus BUAT KAMU',
    kicker: 'S O A L  B A L I K  L A G I',
    title: 'Laper lagi?<br><em>Cimo masih</em><br>di sini.',
    para: 'Bingung mau makan apa lagi? Jangan nunda-nunda. Buka CraveMood lagi — Cimo siap bantu pilih dalam hitungan detik.',
    points: [
      ['Satu tap langsung masuk, tanpa daftar ulang', 'tap', '#ffe3ee'],
      ['Rekomendasi mengikuti mood-mu sekarang', 'mood', '#fff1cc'],
      ['Recap & pesanan tersimpan rapi', 'save', '#dff3e8'],
    ],
    cta: 'Buka CraveMood lagi',
    ctaSub: 'GRATIS · TANPA DAFTAR ULANG · SELALU SIAP',
    note: 'yuk, dipakai lagi, ya!',
    mood: 'def',
    active: 0,
  },
  {
    badge: 'CIMO PAHAM KAMU',
    kicker: 'S O A L  M O O D',
    title: 'Mood berubah?<br><em>Cimo ikut</em><br>berubah.',
    para: 'Senang, sedih, marah, atau bingung? Cerita ke Cimo lewat CraveMood, langsung muncul makanan yang pas buat hari ini.',
    points: [
      ['Pilih ekspresi, nggak perlu mikir panjang', 'mood', '#ffe3ee'],
      ['Cimo paham mood-mu hari ini', 'heart', '#fff1cc'],
      ['Putar acak kalau tetap bingung', 'wheel', '#dff3e8'],
    ],
    cta: 'Ceritakan mood-mu di CraveMood',
    ctaSub: '5 EKSPRESI · REKOMENDASI LANGSUNG',
    note: 'seru, kan? coba lagi, yuk!',
    mood: 'senang',
    active: 1,
  },
  {
    layout: 'qr',
    badge: 'JANGAN TINGGALKAN CIMO',
    kicker: 'S O A L  Y U K',
    title: 'Scan. Baca.<br><em>Balik lagi</em>, yuk!',
    caption: 'Lagi laper tapi bingung mau makan apa?',
    domain: 'lifelonglearner.web.id  ·  cerita lengkapnya',
    cta: 'Buka CraveMood sekarang',
    ctaSub: 'SCAN QR KECIL → LANGSUNG KE APLIKASI',
    note: 'kami nggak kejar-kejar kok.',
    active: 2,
  },
];

const ICO = {
  tap: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  mood: '<circle cx="9" cy="10" r="1.4"/><circle cx="15" cy="10" r="1.4"/><path d="M8 15q4 3 8 0"/>',
  save: '<path d="M6 4h11l3 3v13H6z"/><path d="M9 4v6h7V4M9 20v-6h7v6"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6c0 5-7 9.4-7 9.4z"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  scan: '<path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4"/><path d="M4 12h16"/>',
};
const ic = n => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICO[n] || ICO.heart}</svg>`;
const svgFor = m => cimoSVG(m, 320).replace(/<svg /, '<svg class="cimo" ');

const DECO = `<svg class="deco" viewBox="0 0 1536 1920" preserveAspectRatio="none" aria-hidden="true">
  <circle cx="1440" cy="170" r="210" fill="#ffd9e6" opacity=".45"/>
  <circle cx="1500" cy="90" r="105" fill="#ffe9b8" opacity=".55"/>
  <circle cx="118" cy="1800" r="170" fill="#dff3e8" opacity=".5"/>
  <circle cx="40" cy="1880" r="85" fill="#ffe3ee" opacity=".55"/>
  <path d="M1310 1490q90-60 170 10" stroke="#e9b8ca" stroke-width="3" stroke-dasharray="9 14" fill="none" opacity=".7"/>
  <path d="M120 700q-60 70 0 150" stroke="#e9b8ca" stroke-width="3" stroke-dasharray="9 14" fill="none" opacity=".6"/>
  <g fill="#f2a8c4" opacity=".8">
    <path d="M1410 480q4 22 26 26-22 4-26 26-4-22-26-26 22-4 26-26z"/>
    <path d="M150 330q3 16 19 19-16 3-19 19-3-16-19-19 16-3 19-19z"/>
  </g>
  <g fill="#f4c95d" opacity=".85">
    <path d="M1290 1120q4 20 24 24-20 4-24 24-4-20-24-24 20-4 24-24z"/>
    <path d="M80 1180q3 15 18 18-15 3-18 18-3-15-18-18 15-3 18-18z"/>
  </g>
  <g fill="#8fd3b4" opacity=".8">
    <path d="M1460 900q3 15 18 18-15 3-18 18-3-15-18-18 15-3 18-18z"/>
    <path d="M250 1620q3 15 18 18-15 3-18 18-3-15-18-18 15-3 18-18z"/>
  </g>
  <g fill="#e8b8cc" opacity=".5">
    <circle cx="1360" cy="760" r="6"/><circle cx="1392" cy="790" r="4"/><circle cx="1328" cy="800" r="3"/>
    <circle cx="170" cy="960" r="6"/><circle cx="205" cy="990" r="4"/><circle cx="140" cy="1000" r="3"/>
  </g>
  <path d="M1390 1720c-18-22-52-8-40 18 8 16 40 32 40 32s32-16 40-32c12-26-22-40-40-18z" fill="#ffc0d6" opacity=".6"/>
  <path d="M120 1500c-14-17-40-6-31 14 6 12 31 25 31 25s25-13 31-25c9-20-17-31-31-14z" fill="#ffe0a8" opacity=".65"/>
</svg>`;

const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1536px;height:1920px;overflow:hidden}
  body{background:#fbf5ef;font-family:Nunito,sans-serif;color:#2f2456;-webkit-font-smoothing:antialiased}
  .slide{position:relative;width:1536px;height:1920px;padding:126px 110px 0 112px;overflow:hidden}
  .deco{position:absolute;inset:0;width:1536px;height:1920px;z-index:0;pointer-events:none}
  .slide>*:not(.deco){z-index:2}
  .badge{display:inline-flex;align-items:center;gap:10px;background:#fff;border:2px solid #f4c9d9;color:#c1587f;
         font:800 20px Nunito,sans-serif;letter-spacing:2px;padding:9px 20px;border-radius:99px;
         box-shadow:0 6px 18px rgba(87,52,66,.08);transform:rotate(-1.5deg)}
  .badge:before{content:"";width:11px;height:11px;border-radius:99px;background:#e4477a;box-shadow:0 0 0 5px #ffe3ee}
  .kicker{font:800 25px Nunito,sans-serif;letter-spacing:10px;color:#c1788d;margin:26px 0 20px}
  h1{font:700 87px/1.06 Fredoka,sans-serif;letter-spacing:-1px;color:#2f2456;max-width:850px}
  h1 em{font-style:normal;color:#e4477a;position:relative;white-space:nowrap}
  h1 em:after{content:"";position:absolute;left:2px;right:2px;bottom:-6px;height:9px;border-radius:99px;
              background:#ffd9e6;z-index:-1;transform:rotate(-1deg)}
  .para{font:600 31px/1.5 Nunito,sans-serif;color:#6f6a78;max-width:790px;margin-top:30px}
  .points{margin-top:52px;display:flex;flex-direction:column;gap:18px}
  .point{display:flex;align-items:center;gap:18px;width:820px;min-height:98px;padding:16px 24px 16px 18px;
         border-radius:28px;border:2px solid rgba(255,255,255,.9);box-shadow:0 8px 22px rgba(87,52,66,.07)}
  .pnum{width:58px;height:58px;flex:0 0 58px;border-radius:50%;background:#e4477a;color:#fff;
        display:grid;place-items:center;font:700 25px Fredoka,sans-serif;box-shadow:0 5px 12px rgba(228,71,122,.28)}
  .pico{width:54px;height:54px;flex:0 0 54px;border-radius:18px;background:rgba(255,255,255,.75);
        display:grid;place-items:center;color:#2f2456}
  .ptxt{font:600 30px/1.25 Fredoka,sans-serif;color:#2f2456}
  .cta{margin-top:48px;display:inline-flex;align-items:center;gap:16px;background:linear-gradient(135deg,#ff6f9c,#e4477a);
       color:#fff;font:700 34px Fredoka,sans-serif;padding:20px 34px;border-radius:99px;
       box-shadow:0 14px 30px rgba(228,71,122,.32),inset 0 2px 0 rgba(255,255,255,.35)}
  .cta svg{width:30px;height:30px}
  .ctasub{font:800 17px Nunito,sans-serif;letter-spacing:2.5px;color:#a490a0;margin-top:14px}
  .art{position:absolute;right:86px;top:566px;width:430px;text-align:center}
  .art:before{content:"";position:absolute;left:50%;top:46%;width:112%;height:112%;transform:translate(-50%,-50%);
              border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.85),rgba(255,255,255,0) 68%);z-index:-1}
  .card{position:relative;width:400px;height:400px;margin:0 auto;background:#fff;border-radius:56px;
        display:grid;place-items:center;box-shadow:0 30px 70px rgba(87,52,66,.16),0 4px 12px rgba(87,52,66,.06)}
  .tape{position:absolute;top:-21px;left:103px;width:194px;height:46px;background:rgba(255,255,255,.8);
        border:1px solid rgba(255,255,255,.95);border-radius:2px;transform:rotate(-4deg);
        box-shadow:0 4px 10px rgba(87,52,66,.1)}
  .tape:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.65),rgba(255,255,255,.1))}
  .cimo{width:300px;height:auto;display:block}
  .stamp{position:absolute;right:-22px;top:36px;background:#fff4cf;color:#b8860b;border:3px solid #f4d06f;
         font:700 19px Fredoka,sans-serif;padding:9px 16px;border-radius:99px;transform:rotate(11deg);
         box-shadow:0 6px 14px rgba(87,52,66,.12)}
  .float{position:absolute;width:70px;height:70px;border-radius:50%;background:#fff;display:grid;place-items:center;
         box-shadow:0 8px 18px rgba(87,52,66,.14);border:2px solid #fff}
  .f1{left:-34px;top:96px;transform:rotate(-12deg)}
  .f2{right:-30px;bottom:88px;transform:rotate(10deg)}
  .brand{font:700 29px Fredoka,sans-serif;color:#2f2456;margin-top:22px}
  .brand:after{content:"  ·  teman makanmu";font:700 18px Nunito,sans-serif;color:#a490a0}
  .note{font:700 41px Caveat,cursive;color:#d8436f;margin-top:20px;transform:rotate(-3deg)}
  .footer{position:absolute;left:112px;right:110px;bottom:142px;border-top:2px dashed #e8cfd9;padding-top:18px;
          display:flex;justify-content:space-between;align-items:center;
          font:800 18px Nunito,sans-serif;letter-spacing:2px;color:#b39ba8}
  .footer b{color:#e4477a}
  .dots{position:absolute;left:0;right:0;bottom:70px;display:flex;justify-content:center;align-items:center;gap:14px}
  .dot{width:11px;height:11px;border-radius:99px;background:#ded3d7}
  .dot.on{width:42px;height:11px;background:#e4477a}
  /* QR final slide */
  .slide.qr{text-align:center}
  .slide.qr h1{margin:0 auto}
  .qrwrap{position:absolute;left:0;right:0;top:430px;display:flex;flex-direction:column;align-items:center}
  .qr.card{width:540px;height:540px;border-radius:48px}
  .qr.card .tape{left:173px}
  .qr.card img{width:436px;height:436px;display:block}
  .qrstamp{position:absolute;right:-30px;bottom:-18px;background:#ffe3ee;color:#c1587f;border:3px solid #f4c9d9;
           font:700 21px Fredoka,sans-serif;padding:11px 18px;border-radius:99px;transform:rotate(9deg);
           box-shadow:0 8px 16px rgba(87,52,66,.12)}
  .qrcap{font:700 36px/1.3 Fredoka,sans-serif;color:#2f2456;margin-top:38px}
  .qrdomain{font:700 23px Nunito,sans-serif;color:#9b8b98;margin-top:8px}
  .qrcta{margin-top:44px;background:#fff;border:3px solid #f4c9d9;border-radius:36px;padding:20px 30px 20px 24px;
         display:flex;align-items:center;gap:22px;box-shadow:0 14px 34px rgba(87,52,66,.12);text-align:left}
  .qrcta img{width:126px;height:126px;border-radius:18px;display:block;border:2px solid #f4e2ea}
  .qrcta .qtext b{display:block;font:700 33px Fredoka,sans-serif;color:#2f2456;margin-bottom:6px}
  .qrcta .qtext span{display:block;font:800 16px Nunito,sans-serif;letter-spacing:1.6px;color:#e4477a}
  .qrcta .qtext small{display:block;font:600 21px Nunito,sans-serif;color:#7d7180;margin-top:8px}
  .slide.qr .note{margin-top:34px;font-size:42px}
</style></head><body>
<script>
const S = ${JSON.stringify(SLIDES)};
const V = ${JSON.stringify(SLIDES.map(s => svgFor(s.mood)))};
const A = ${JSON.stringify([foodArt('soup', 46), foodArt('sweet', 46), foodArt('drink', 46)])};
const IC = ${JSON.stringify(Object.fromEntries(Object.entries(ICO).map(([k,v]) => [k, ic(k)])))};
const s = S[new URLSearchParams(location.search).get('s') - 1] || S[0];
const dots = '<div class="dots">' + S.map((_,i) => '<span class="dot' + (i===s.active?' on':'') + '"></span>').join('') + '</div>';
const footer = '<div class="footer"><span>CRAVEMOOD  ·  <b>BALIK LAGI, YUK!</b></span><span>GRATIS · RINGAN · SELALU SIAP</span></div>';
const head = '<div class="badge">' + s.badge + '</div><div class="kicker">' + s.kicker + '</div><h1>' + s.title + '</h1>';
const d = document.createElement('div');
d.className = 'slide' + (s.layout === 'qr' ? ' qr' : '');
if (s.layout === 'qr') {
  d.innerHTML = ${JSON.stringify(DECO)} + head +
    '<div class="qrwrap"><div class="card qr"><div class="tape"></div><img src="qr.png" alt="QR artikel CraveMood">' +
      '<div class="qrstamp">BACA DULU →</div></div>' +
      '<div class="qrcap">' + s.caption + '</div>' +
      '<div class="qrdomain">' + s.domain + '</div>' +
      '<div class="qrcta"><img src="cravemood-qr.png" alt="QR aplikasi CraveMood">' +
        '<div class="qtext"><b>' + s.cta + '</b><span>' + s.ctaSub + '</span>' +
        '<small>Scan QR kecil ini, langsung balik ke CraveMood.</small></div></div>' +
      '<div class="note">' + s.note + '</div></div>' + footer + dots;
} else {
  const i = S.indexOf(s);
  d.innerHTML = ${JSON.stringify(DECO)} + head +
    '<p class="para">' + s.para + '</p>' +
    '<div class="points">' + s.points.map((p,k) =>
       '<div class="point" style="background:' + p[2] + '"><span class="pnum">0' + (k+1) + '</span>' +
       '<span class="pico">' + IC[p[1]] + '</span><span class="ptxt">' + p[0] + '</span></div>').join('') + '</div>' +
    '<div class="cta">' + IC.arrow + s.cta + '</div>' +
    '<div class="ctasub">' + s.ctaSub + '</div>' +
    '<div class="art"><div class="card"><div class="tape"></div>' + V[i] +
      '<div class="stamp">SIAP 24/7</div>' +
      '<div class="float f1">' + A[0] + '</div><div class="float f2">' + A[2] + '</div></div>' +
      '<div class="brand">CraveMood</div><div class="note">' + s.note + '</div></div>' + footer + dots;
}
document.body.appendChild(d);
</script>
</body></html>`;

fs.writeFileSync(path.join(dir, 'carousel.html'), html, 'utf8');
console.log('carousel.html written:', html.length, 'chars');
