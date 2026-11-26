# Kenapa Google Login belum bisa — dan cara menyalakannya

## Jawaban singkat

Bukan bug. **Google mewajibkan setiap situs mendaftarkan dirinya dulu** ke Google
Cloud Console untuk mendapat *OAuth Client ID*. Tanpa ID itu, tombol Google tidak
punya identitas yang diakui Google, jadi tidak mungkin berhasil — bukan karena kodenya
salah.

ID itu hanya bisa dibuat dari **akun Google kamu sendiri**. Saya tidak bisa membuatkannya
karena butuh login ke akunmu dan verifikasi kepemilikan domain.

Selama ID belum ada, tombol Google **saya sembunyikan** supaya pengunjung tidak menekan
tombol yang pasti gagal. Begitu ID diisi, tombolnya muncul otomatis — kodenya sudah siap.

## Yang sudah siap di kode

| Bagian | Status |
|---|---|
| Tombol Google di layar Masuk & Daftar | ✅ ada, muncul hanya jika ID terisi |
| Ambil nama + email dari Google | ✅ `google.accounts.oauth2` |
| Daftar otomatis kalau email belum terdaftar | ✅ `finishGoogle()` |
| Masuk otomatis kalau email sudah terdaftar | ✅ `DB.loginGoogle()` |
| Catat ke spreadsheet | ✅ action `daftar` / `masuk` |

Yang kurang cuma satu baris:

```js
// src/app.js
const GOOGLE_CLIENT_ID = '';   // ← isi di sini
```

## Cara membuat Client ID (±5 menit, gratis)

1. Buka **https://console.cloud.google.com** → login dengan akun Google kamu.
2. Klik pemilih project di atas → **New project** → nama `CraveMood` → **Create**.
3. Menu kiri → **APIs & Services → OAuth consent screen**
   - User type: **External** → **Create**
   - App name: `CraveMood`, User support email: email kamu, Developer contact: email kamu
   - **Save and continue** sampai selesai (Scopes boleh dikosongkan)
4. Menu kiri → **Credentials** → **+ Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `CraveMood Web`
   - **Authorized JavaScript origins** → **+ Add URI** →
     ```
     https://faturrahman224477-create.github.io
     ```
     (tanpa garis miring di akhir, tanpa `/cravemood`)
   - **Create**
5. Muncul kotak berisi **Client ID** seperti
   `1234567890-abc123def.apps.googleusercontent.com`. Salin.
6. Kirim Client ID itu ke saya — saya pasang, build, dan push. Atau pasang sendiri di
   `src/app.js`, lalu jalankan `node build.mjs`.

## Catatan penting

- **Selama status app masih "Testing"**, hanya email yang kamu daftarkan sebagai
  *Test user* yang bisa masuk (maksimal 100). Untuk membuka ke semua orang:
  OAuth consent screen → **Publish app**.
- Karena situs ada di domain `github.io` (bukan domain milikmu), Google tetap
  mengizinkannya sebagai *JavaScript origin* — tidak perlu punya domain sendiri.
- Kalau nanti pindah domain, **Authorized JavaScript origins** harus ditambah domain
  barunya, kalau tidak Google akan menolak dengan error `origin_mismatch`.
- Client ID **bukan rahasia** — aman ditaruh di kode front-end. Yang rahasia adalah
  *Client Secret*, dan itu tidak dipakai di alur ini.

## Setelah aktif, alurnya

1. Pengunjung tekan **"atau daftar dengan Google"**
2. Pilih akun Google → izin sekali
3. Website ambil `name` + `email` dari Google
4. Kalau email belum ada → akun dibuat otomatis, tercatat di sheet (`daftar`)
5. Kalau sudah ada → langsung masuk, tercatat di sheet (`masuk`)
6. Langsung masuk ke aplikasi, tanpa isi formulir

Catatan data: kolom `email_gmail` di spreadsheet hanya diisi kalau emailnya `@gmail.com`,
karena skrip penjaga di Apps Script menolak domain lain. Akun Google non-Gmail tetap
bisa daftar dan masuk — hanya kolom emailnya yang dikosongkan.
