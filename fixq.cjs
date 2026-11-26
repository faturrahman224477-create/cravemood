const fs = require('fs');
const f = 'social/postpurchase/feed2.html';
let s = fs.readFileSync(f, 'utf8');
const R = [];

// q2: judul jadi satu baris, subline turun, body turun
R.push(['left:80px;top:178px;width:560px;font-size:74px', 'left:80px;top:178px;width:650px;font-size:70px']);
R.push(['left:84px;top:296px;width:540px;font-family:/'Fredoka\';font-weight:600;font-size:42px', 'left:84px;top:288px;width:560px;font-family:/'Fredoka\';font-weight:600;font-size:42px']);
R.push(['left:84px;top:440px;width:530px;font-weight:600;font-size:27px', 'left:84px;top:452px;width:530px;font-weight:600;font-size:27px']);

// q2: phone lebih besar & turun
R.push(['left:664px;top:330px;transform:rotate(2deg)', 'left:648px;top:330px;transform:rotate(2deg)']);
R.push(['position:relative;width:356px;height:676px', 'position:relative;width:396px;height:730px']);

// q2: panah diperpanjang supaya menyentuh phone
R.push([
`<svg style="position:absolute;left:210px;top:872px" width="380" height="100" viewBox="0 0 380 100">
    <path d="M8 16C96 30 220 58 356 84" stroke="#C9406F" stroke-width="4" fill="none"
          stroke-linecap="round" stroke-dasharray="1 9"/>
    <path d="M356 84l-16-4M356 84l-9 13" stroke="#C9406F" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`,
`<svg style="position:absolute;left:240px;top:866px" width="420" height="104" viewBox="0 0 420 104">
    <path d="M8 14C112 32 264 62 396 92" stroke="#C9406F" stroke-width="4" fill="none"
          stroke-linecap="round" stroke-dasharray="1 9"/>
    <path d="M396 92l-17-3M396 92l-8 14" stroke="#C9406F" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`
]);

// q3: kalimat penutup di bawah
R.push([
`  <div class="hand" style="position:absolute;left:576px;top:800px;width:420px;font-size:45px;line-height:1.16;transform:rotate(-1.4deg)">
    kenapa kepala bisa<br>penuh cuma gara-gara<br>mau makan.
  </div>`,
`  <div class="hand" style="position:absolute;left:576px;top:800px;width:420px;font-size:45px;line-height:1.16;transform:rotate(-1.4deg)">
    kenapa kepala bisa<br>penuh cuma gara-gara<br>mau makan.
  </div>

  <div style="position:absolute;left:82px;top:1010px;width:900px;font-family:'Fredoka';font-weight:600;font-size:39px;color:#2C2C6C;line-height:1.3">
    Baca kalau sempat. Nggak buru-buru.
  </div>`
]);

let ok = 0;
for (const [a, b] of R) {
  if (s.includes(a)) { s = s.split(a).join(b); ok++; }
  else console.log('MISS:', a.slice(0, 60).replace(/\n/g, ' | '));
}
fs.writeFileSync(f, s);
console.log('applied', ok, '/', R.length);
