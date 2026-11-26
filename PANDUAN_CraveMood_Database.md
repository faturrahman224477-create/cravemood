# Sheet "DATABASE PENGGUNA CRAVEMOOD" — STATUS: SUDAH TERHUBUNG

Sheet: https://docs.google.com/spreadsheets/d/1_np192gRgODOvtFTkgYZiZS6t8pe1H_ms7DyZRjBcwY/edit

Website: https://faturrahman224477-create.github.io/cravemood/

## Yang sudah jalan (terverifikasi 26 Nov 2026)

Webhook Apps Script sudah dipasang di `src/app.js`:

```
SHEET_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyc.../exec'
```

Sudah diuji end-to-end (bukan simulasi):
- pendaftaran dari browser sungguhan → baris masuk ke `Data_Pengunjung`
- `waktu_akses` diisi **server** dalam WITA (contoh: `11:53 WITA`), bukan dari jam HP pengunjung
- nomor WA `08…` dinormalisasi otomatis jadi `628…`
- daftar ulang dengan WA yang sama → ditolak ("sudah terdaftar")

## Kapan baris ditulis

| Aksi di website | Nilai kolom `status_langganan` | Catatan |
|---|---|---|
| Daftar akun baru | `Aktif` | + anti-duplikat WA |
| Masuk (login) | `Nonaktif` | sesi baru |
| Lanjut sebagai tamu | `Nonaktif` | nama `Tamu` |

## Sisa 1 langkah opsional (±10 detik): tab Dashboard

Tab `Data_Pengunjung` dibuat otomatis oleh webhook. Tab `Dashboard_Ringkasan`
(8 metrik) hanya dibuat oleh fungsi `setupSpreadsheet`.

Kalau tab `Dashboard_Ringkasan` **belum ada** di sheet kamu:

1. Buka sheet → **Extensions → Apps Script**
2. Di dropdown fungsi, pilih **`setupSpreadsheet`** → klik **Run**
   (sudah pernah authorize, jadi langsung jalan tanpa dialog izin)
3. Selesai. Tab `Dashboard_Ringkasan` muncul dengan 8 metrik live.

Fungsi ini idempoten — header `Data_Pengunjung` ditulis ulang dengan isi yang sama,
data pengunjung tidak tersentuh.

## Catatan penting

- Sheet kamu punya tab kosong pertama (mis. `Sheet1`). Data masuk ke tab
  **`Data_Pengunjung`**, bukan tab pertama itu. Hapus tab kosongnya kalau mengganggu.
- Baris 2–4 berisi data uji saya (`Tes Webhook Cimo`, `Tes Browser Cimo`, `Tes Live Cimo`).
  Silakan hapus ketiganya — itu bukti bahwa penulisan benar-benar berhasil.
- Onboarding CraveMood mengumpulkan **nama + nomor WA + password**, bukan email.
  Karena itu `email_gmail` boleh kosong; kalau diisi tetap wajib `@gmail.com`.

## Kenapa pakai JSONP, bukan fetch biasa

Apps Script tidak mengirim header CORS, sehingga `fetch()` tidak bisa membaca balasannya.
Website memakai `<script>` (JSONP) ke `doGet` yang sudah mendukung `callback`.
Keuntungannya: penulisan tetap terjadi **dan** browser bisa memastikan balasan
`{"status":"success"}` — jadi kegagalan tidak lewat diam-diam (ada 2× retry otomatis).
