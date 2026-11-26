# Hubungkan Sheet "DATABASE PENGGUNA CRAVEMOOD" ke website CraveMood

Sheet kamu (sudah saya cek, masih kosong):
https://docs.google.com/spreadsheets/d/1_np192gRgODOvtFTkgYZiZS6t8pe1H_ms7DyZRjBcwY/edit

## Kenapa butuh 4 langkah manual
Konektor Google Drive di sesi ini **hanya bisa membaca** (read + search), tidak bisa
menulis sel atau men-deploy Apps Script ke akun Google kamu. Jadi konfigurasi Sheet dan
URL Web App harus dibuat dari akunmu sendiri. Semua kode sudah saya siapkan, dan jembatan
di website sudah terpasang (commit `6531cbd`) — tinggal isi URL-nya.

## 4 langkah (±3 menit)

1. Buka Sheet di atas → menu **Extensions → Apps Script**.
2. Hapus semua isi `Code.gs`, lalu tempel **seluruh isi** file `AppsScript_CraveMood.gs`
   (ada di folder proyek ini). Klik **Save**.
3. Masih di editor Apps Script:
   - Pilih fungsi **`setupSpreadsheet`** di dropdown → klik **Run** → **Authorize**.
     Ini otomatis membuat:
     - tab **`Data_Pengunjung`** dengan 29 kolom header
     - tab **`Dashboard_Ringkasan`** dengan 8 metrik (COUNTUNIQUE, COUNTIF, SUM)
   - Klik **Deploy → New deployment → Web app**:
     - Execute as: **Me**
     - Who has access: **Anyone**
   - Klik **Deploy** → **salin URL yang berakhiran `/exec`**.
4. Kirim URL `/exec` itu ke saya. Saya pasang ke `SHEET_WEBHOOK_URL` di `src/app.js`,
   rebuild, dan push. Selesai.

## Setelah URL terpasang, ini yang otomatis terjadi
- Setiap **daftar** berhasil → baris baru di `Data_Pengunjung`.
- Setiap **masuk** berhasil → baris baru.
- Setiap **guest** masuk → baris baru bertanda `kunjungan`.
- Kolom `tanggal` (YYYY-MM-DD) dan `waktu_akses` (HH:MM WITA) diisi **server**, bukan browser.
- Nomor WA dinormalisasi ke `628…`; email opsional tapi kalau diisi wajib `@gmail.com`.
- Pendaftaran baru dengan WA/email yang sudah ada akan ditolak (anti akun ganda).
- `Dashboard_Ringkasan` menghitung ulang otomatis.

## Catatan teknis
- Onboarding CraveMood mengumpulkan **nama + nomor WA + password**, bukan email.
  Karena itu validasi email di Apps Script dibuat kondisional (kosong = boleh).
- Apps Script tidak mengirim header CORS, jadi website memakai `fetch(..., mode:'no-cors')`
  untuk mengirim data. Pengiriman tetap sampai; response tidak dibaca di browser.
- Data contoh fiktif di file `.xlsx` hanya untuk pratinjau struktur; Sheet asli kamu mulai kosong.
