# Database Pengunjung & Langganan CraveMood — Panduan Singkat

## Isi paket
- `Database Pengunjung & Langganan CraveMood.xlsx` — workbook 2 tab (Data_Pengunjung, Dashboard_Ringkasan)
- `AppsScript_CraveMood.gs` — kode Web App Apps Script (doPost + doGet JSONP)
- `Form_Pendaftaran_CraveMood.html` — form pendaftaran glassmorphism

## 3 langkah dapat link Google Sheets
1. Buka https://drive.google.com → **New → File upload** → pilih file `.xlsx` di atas.
2. Klik kanan file yang ter-upload → **Open with → Google Sheets**.
3. Di spreadsheet → **Share** → *Anyone with the link* → **Copy link**. Itu link final kamu.

## Pasang Apps Script
1. Di spreadsheet → **Extensions → Apps Script**.
2. Hapus isi `Code.gs`, tempel seluruh isi `AppsScript_CraveMood.gs`, **Save**.
3. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. **Authorize** (akun Google sendiri), lalu salin URL `.../exec`.

## Pasang URL ke form
1. Buka `Form_Pendaftaran_CraveMood.html`.
2. Ganti baris:
   ```js
   const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
   dengan URL Web App aslimu.
3. Simpan. Form bisa dibuka langsung di browser atau di-upload sebagai halaman.

## Catatan penting
- Kolom **tanggal** dan **waktu_akses** diisi server (WITA / GMT+8), bukan dari browser.
- Validasi server: email wajib `@gmail.com`; WA wajib `08…`/`628…`, 10–13 digit, otomatis dinormalisasi ke `628…`.
- Pendaftaran baru (`action: "daftar"`) menolak nomor WA / email yang sudah ada.
- Response JSON sukses/gagal dikembalikan server. Karena Apps Script tidak mengirim header CORS, form memakai pre-check JSONP lalu mengirim data final lewat `fetch(..., mode:'no-cors')`.
- Dashboard memakai `COUNTUNIQUE` (fungsi native Google Sheets) dan akan otomatis menghitung ulang saat file dibuka di Google Sheets.
- 5 baris contoh memakai data fiktif (bukan nomor/email asli).
