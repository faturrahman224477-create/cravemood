# CraveMood 🍡

**Makan sesuai moodmu.** Cimo — maskot bulat pink — bantu kamu memilih makanan khas Makassar
berdasarkan perasaan hari ini. Satu file `index.html` yang benar-benar berfungsi: spinner acak,
live chat curhat, suara 5 pilihan, keranjang, dan bagikan ke sosial media.

Desain diambil 1:1 dari dokumen mockup (`CraveMood – Mockup Desain (Done).html`): palet, maskot Cimo
(SVG), tipografi Fredoka + Nunito, pola titik, dan seluruh komponen kartu.

**Live:** https://cravemood.apps.workbuddy.host/?sharecode=NG6DCXKIRE
**Repo:** https://github.com/faturrahman224477-create/cravemood

---

## 1. Fitur yang diminta → sudah jalan

| # | Permintaan | Implementasi |
|---|---|---|
| 1 | Beranda, Spinner, Chat di dashboard berbeda | Router hash 6 halaman terpisah (`#/beranda`, `#/spinner`, `#/chat`, `#/pesanan`, `#/recap`, `#/profil`). Hanya satu view di DOM → tidak memanjang ke bawah. |
| 2 | Suara Cimo lebih natural, 5 opsi, intonasi, bahasa Mandarin/Inggris/Hindi | 5 profil suara (Lembut, Ceria, Tenang, Energik, Hangat), slider kecepatan + intonasi + volume, pemilihan bahasa suara ID/EN/中文/हिन्दी. Ucapan dipecah per frasa dengan jeda & variasi pitch supaya tidak kaku. |
| 3 | Bunyi klik saat menambah makanan | `SFX` Web Audio API — bunyi *pop* sintetis (tanpa file audio), plus tick saat roda berputar dan chime saat berhasil. Bisa dimatikan di Profil. |
| 4 | Chat relevan & nyambung, seperti sahabat | Engine NLU lokal: normalisasi slang → analisis sentimen → deteksi emosi → 8 topik → skoring 40+ intent → memori percakapan (topik, tren mood, pertanyaan tertunda). Bisa di-upgrade ke LLM asli dengan API key. |
| 5 | Bagikan ke Instagram & sosial media benar-benar berfungsi | Kartu dibuat di `<canvas>` (1080×1350 PNG), lalu Web Share API (files) → panel bagikan HP berisi Instagram, atau unduh + salin caption. WhatsApp/Telegram/X/Facebook memakai intent URL asli. |
| 6 | Lokasi 7 jalan | Jalan Raya Pendidikan, Mapala, Yusuf Daeng Ngawing, Hertasning, Tidung Mariolo, Monumen Emmy Saelan, Tidung Raya — dengan koordinat asli Makassar untuk hitung jarak. |
| F1 | Cimo Spinner Acak | Roda 8 segmen `conic-gradient`, animasi 4,6 s, hasil + riwayat putaran + langsung tambah ke keranjang. |
| F2 | Cimo interaktif bisa dipindah | Maskot melayang yang bisa di-drag ke mana saja (pointer events, posisi tersimpan), klik = buka chat, dobel klik = reset posisi. |
| F3 | Bahasa Indonesia, Inggris, Mandarin, Hindi | 4 bahasa untuk seluruh UI + balasan chat + suara. |
| F4 | Cimo Live Chat ala Siri | Chat layar penuh, indikator mengetik, quick reply, mikrofon (Web Speech API), tombol speaker, balasan dibacakan. |

---

## 2. Struktur

```
index.html            ← hasil build, satu file, siap deploy (semua CSS+JS inline)
src/
  template.html       shell HTML
  style.css           design system dari mockup
  mascot.js           Cimo SVG (7 mood + kostum) & ilustrasi makanan
  data.js             7 jalan, 30 menu, 6 mood, kamus i18n 4 bahasa
  db.js               lapisan database (remote API / localStorage)
  voice.js            5 profil suara + Web Audio SFX
  chat.js             mesin percakapan (NLU, sentimen, memori, LLM opsional)
  app.js              router, view, keranjang, spinner, share, admin
build.mjs             gabungkan src/* → index.html
server/server.js      API + database (Node, tanpa dependensi)
db/schema.sql         skema PostgreSQL/Supabase
db/seed.json          contoh isi database (3 pendaftar)
```

Build ulang setelah mengubah `src/`:

```bash
node build.mjs
```

---

## 3. Menjalankan

**Cara tercepat** — buka `index.html` di browser. Semua fitur jalan, data tersimpan di
localStorage perangkat (mode statis, cocok untuk GitHub Pages).

**Mode database penuh** (data pendaftar terpusat):

```bash
node server/server.js
# → http://localhost:8787
```

Server menyajikan `index.html` sekaligus API. Frontend otomatis mendeteksi `/api/health`;
kalau ada, semua tulisan masuk ke `server/data/db.json`. Kalau tidak, jatuh ke localStorage.

| Endpoint | Fungsi |
|---|---|
| `GET  /api/health` | status + jumlah pendaftar |
| `POST /api/register` | daftar (nama, kontak, password, bahasa) |
| `POST /api/login` | masuk |
| `GET  /api/users` | daftar pendaftar (butuh `X-Admin-Key`) |
| `POST /api/mood` · `/api/order` · `/api/chat` · `/api/spin` | aktivitas |
| `GET  /api/export` | dump database (butuh admin key) |

Ganti kunci admin: `ADMIN_KEY=rahasia node server/server.js`.

---

## 4. Database & siapa saja yang mendaftar

**Panel admin ada di dalam web**: Profil → *Panel database* → kata sandi **`cimo2026`**.
Isinya tabel pendaftar (nama, kontak, bahasa, tanggal daftar, jumlah mood/order/chat/spin)
plus tombol ekspor **CSV** dan **JSON**.

Dua mode:

1. **Statis (GitHub Pages)** — tabel disimpan di localStorage browser. Panel admin menampilkan
   pendaftar **di perangkat itu**. Ini batasan platform statis, bukan bug.
2. **Server** — jalankan `server/server.js`, semua pendaftar dari semua perangkat masuk ke satu
   database (`server/data/db.json`) dan panel admin menampilkan semuanya.

Skema relasional lengkap ada di `db/schema.sql` (users, moods, orders, chats, spins, view
`v_registrants`) untuk dipakai di Supabase/Postgres. Contoh data: `db/seed.json`.

Password disimpan sebagai hash: scrypt di server, SHA-256 + salt di browser.

---

## 5. Deploy

**Live sekarang:** https://cravemood.apps.workbuddy.host/?sharecode=NG6DCXKIRE
(dijalankan sebagai layanan HTTP Node, jadi `/api/*` aktif dan database-nya terpusat.)

**GitHub Pages.** Repo `faturrahman224477-create/cravemood` sudah ada, tetapi integrasi GitHub
di sesi ini hanya punya izin baca — jadi commit terakhir belum terdorong. Semua file sudah
di-commit di folder ini; tinggal satu perintah (kredensial GitHub kamu akan dipakai otomatis):

```bash
git push origin main
```

Setelah itu workflow `.github/workflows/pages.yml` membangun `index.html` dari `src/` dan
menerbitkannya. URL: `https://faturrahman224477-create.github.io/cravemood/`.
Manual: **Settings → Pages → Source: GitHub Actions**.

Untuk GitHub Pages (statis, tanpa server) aplikasi otomatis jatuh ke mode database lokal —
semua fitur tetap jalan, hanya daftar pendaftar tersimpan per perangkat. Ingin database
terpusat di GitHub Pages? Deploy `server/server.js` ke Railway/Render/Fly, lalu di `index.html`
set `window.CRAVEMOOD_API = 'https://api-kamu.example.com'` sebelum script utama.

---

## 6. Catatan teknis

**Suara.** Memakai `SpeechSynthesis`. Kualitas tergantung suara sistem — Chrome/Edge di Windows
punya "Microsoft ... Natural/Neural", Android punya Google TTS. Untuk Hindi/中文 tanpa voice
terpasang, browser akan memilih voice terdekat. Slider intonasi menaikkan pitch di akhir kalimat
tanya dan menurunkannya di awal, supaya terdengar seperti orang berbicara, bukan membaca.

**Chat.** Tanpa API key, mesin lokal menangani ~40 intent (capek, sedih, marah, cemas, sepi,
patah hati, kerja, kuliah, uang, keluarga, teman, kesehatan, insecure, makan, dll) dengan memori
topik dan pertanyaan lanjutan. Untuk jawaban yang benar-benar bebas, isi API key OpenAI-compatible:

```js
// console browser
DB.setSetting('ai', { key:'sk-...', base:'https://api.openai.com/v1', model:'gpt-4o-mini' });
```

Setelah itu setiap balasan dibuat oleh model dengan persona Cimo; kalau request gagal, otomatis
kembali ke mesin lokal.

**Bagikan ke Instagram.** Instagram tidak menerima upload langsung dari web. Tombol Instagram
memanggil Web Share API dengan file PNG — di HP, panel bagikan menampilkan Instagram dan kamu
tinggal pilih Story/Feed. Di desktop (tanpa dukungan file share) gambar diunduh dan caption
disalin, lalu tinggal unggah manual. Ini perilaku paling maksimal yang diizinkan platform.

**Privasi.** Tidak ada data yang dikirim ke mana pun kecuali kamu mengisi API key chat.
Semua tersimpan lokal atau di server milikmu.

---

## 7. Kredit

Desain & maskot: dokumen *CraveMood – Mockup Desain*. Font: Fredoka & Nunito (Google Fonts).
Data harga & jarak adalah perkiraan untuk demo, bukan harga resmi merchant.
