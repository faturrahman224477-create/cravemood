/**
 * CraveMood — Apps Script Web App (doPost)
 * =========================================
 * CARA PASANG:
 * 1. Buka spreadsheet → Extensions → Apps Script
 * 2. Hapus isi Code.gs, tempel seluruh kode ini, Simpan
 * 3. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Salin URL Web App → tempel ke konstanta WEBAPP_URL di file HTML form
 *
 * Webhook menerima (via POST JSON atau form-urlencoded):
 *   action      = "daftar" | "kunjungan"   (default: "kunjungan")
 *   nama_lengkap, nomor_wa, email_gmail
 *   session_id, user_id, sumber_trafik, perangkat, bahasa_pilihan,
 *   mode_interaksi, kategori_mood, filter_preferensi, jumlah_interaksi,
 *   durasi_sesi_detik, menu_direkomendasikan, merchant_tujuan, klik_order,
 *   platform_tujuan, status_langganan, paket_langganan, tgl_mulai_langganan,
 *   tgl_berakhir_langganan, metode_pembayaran, status_perpanjangan,
 *   pendapatan_langganan_rp, estimasi_komisi_afiliasi_rp,
 *   biaya_api_sesi_rp, titik_putus_terakhir
 *
 * Kolom tanggal & waktu_akses DIISI SERVER (WITA / GMT+8), tidak dipercaya dari client.
 */

const SHEET_NAME = 'Data_Pengunjung';
const TZ = 'Asia/Makassar'; // WITA = GMT+8

// 29 kolom sesuai urutan header di sheet
const HEADERS = [
  'session_id', 'user_id', 'nama_lengkap', 'nomor_wa', 'email_gmail', 'tanggal',
  'waktu_akses', 'sumber_trafik', 'perangkat', 'bahasa_pilihan', 'mode_interaksi',
  'kategori_mood', 'filter_preferensi', 'jumlah_interaksi', 'durasi_sesi_detik',
  'menu_direkomendasikan', 'merchant_tujuan', 'klik_order', 'platform_tujuan',
  'status_langganan', 'paket_langganan', 'tgl_mulai_langganan', 'tgl_berakhir_langganan',
  'metode_pembayaran', 'status_perpanjangan', 'pendapatan_langganan_rp',
  'estimasi_komisi_afiliasi_rp', 'biaya_api_sesi_rp', 'titik_putus_terakhir'
];

/**
 * SETUP SEKALI JALAN:
 * Di Apps Script editor, pilih fungsi `setupSpreadsheet` lalu klik Run.
 * Ini membuat tab Data_Pengunjung (29 kolom) + Dashboard_Ringkasan (8 metrik).
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sh.setFrozenRows(1);

  let d = ss.getSheetByName('Dashboard_Ringkasan');
  if (!d) d = ss.insertSheet('Dashboard_Ringkasan');
  const D = "'" + SHEET_NAME + "'!";
  const metrics = [
    ['Total Sesi Kunjungan', '=COUNTA(' + D + '$A$2:$A$10000)'],
    ['Total Pengguna Unik Terdaftar', '=COUNTUNIQUE(' + D + '$B$2:$B$10000)'],
    ['Conversion Rate Klik Order (%)', '=IF(COUNTA(' + D + '$A$2:$A$10000)=0,"",COUNTIF(' + D + '$R$2:$R$10000,"Ya")/COUNTA(' + D + '$A$2:$A$10000))'],
    ['Jumlah Pelanggan Premium Aktif', '=COUNTIFS(' + D + '$T$2:$T$10000,"Aktif",' + D + '$U$2:$U$10000,"Premium")'],
    ['Total Pendapatan Langganan (Rp)', '=SUM(' + D + '$Z$2:$Z$10000)'],
    ['Total Estimasi Komisi Afiliasi (Rp)', '=SUM(' + D + '$AA$2:$AA$10000)'],
    ['Total Biaya API Variabel (Rp)', '=SUM(' + D + '$AB$2:$AB$10000)'],
    ['Laba Kotor Operasional (Rp)', '=SUM(' + D + '$Z$2:$Z$10000)+SUM(' + D + '$AA$2:$AA$10000)-SUM(' + D + '$AB$2:$AB$10000)']
  ];
  d.getRange(1, 1, 1, 2).setValues([['Metrik', 'Nilai']]);
  d.getRange(1, 1, 1, 2).setFontWeight('bold');
  d.getRange(2, 1, metrics.length, 2).setValues(metrics);
  for (let i = 0; i < metrics.length; i++) {
    d.getRange(2 + i, 2).setNumberFormat(i === 2 ? '0.00%' : '#,##0');
  }
  d.setColumnWidth(1, 260);
  d.setColumnWidth(2, 180);
  return 'Setup selesai: ' + HEADERS.length + ' kolom, ' + metrics.length + ' metrik.';
}

/** Entry point — terima POST dari form / fetch() */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const p = parsePayload_(e);
    return json_(handle_(p));
  } catch (err) {
    return json_({ status: 'error', message: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: GET dengan dukungan JSONP.
 * Dipakai form browser karena Apps Script tidak mengirim header CORS,
 * sehingga fetch() biasa tidak bisa membaca response JSON-nya.
 * Contoh: WEBAPP_URL?callback=cmCb&action=daftar&nama_lengkap=...&nomor_wa=...&email_gmail=...
 */
function doGet(e) {
  const q = (e && e.parameters) ? e.parameters : {};
  const p = {};
  Object.keys(q).forEach(k => { if (k !== 'callback') p[k] = String(q[k][0]); });
  const result = (p.action || '') ? handle_(p) : { status: 'ok', message: 'CraveMood webhook aktif. Kirim POST atau GET+callback.' };
  const cb = q.callback ? String(q.callback[0]) : '';
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(result);
}

function parsePayload_(e) {
  let raw = {};
  if (e && e.postData && e.postData.contents) {
    const body = String(e.postData.contents).trim();
    if (body.charAt(0) === '{') {
      raw = JSON.parse(body);
    } else if (e.parameters) {
      raw = e.parameters;
    }
  } else if (e && e.parameters) {
    raw = e.parameters;
  }
  // flatten arrays (application/x-www-form-urlencoded → params are arrays)
  const out = {};
  Object.keys(raw).forEach(k => {
    const v = raw[k];
    out[k] = Array.isArray(v) ? String(v[0]) : String(v == null ? '' : v);
  });
  return out;
}

function handle_(p) {
  const action = (p.action || 'kunjungan').toLowerCase();
  const isRegister = (action === 'daftar' || action === 'cek');

  // --- 1. Validasi nama (form dibatasi 3+ karakter, huruf/spasi) ---
  const nama = clean_(p.nama_lengkap);
  if (isRegister && !/^[A-Za-zÀ-ÿ' .]{3,80}$/.test(nama)) {
    return { status: 'error', message: 'Nama lengkap minimal 3 karakter dan hanya boleh huruf/spasi.' };
  }

  // --- 2. Validasi email Gmail (wajib gmail.com JIKA diisi) ---
  // Website CraveMood hanya mengumpulkan nomor WA, jadi email boleh kosong.
  // Kalau email dikirim, tetap divalidasi ketat @gmail.com.
  const email = clean_(p.email_gmail).toLowerCase();
  if (email && !/^[a-z0-9._%+-]+@gmail\.com$/.test(email)) {
    return { status: 'error', message: 'Email wajib berdomain @gmail.com.' };
  }

  // --- 3. Validasi + normalisasi nomor WA Indonesia ---
  const waRaw = clean_(p.nomor_wa);
  // tamu (guest) tidak punya nomor WA → izinkan kosong
  const wa = waRaw ? normalizeWa_(waRaw) : { ok: true, value: '' };
  if (!wa.ok) return { status: 'error', message: wa.message };

  // --- 4. Cek duplikat untuk pendaftaran baru ---
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    // sheet belum ada → buat otomatis + header 29 kolom
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  if (isRegister && wa.value && duplicateExists_(sh, wa.value, email)) {
    return { status: 'error', message: 'Nomor WhatsApp atau email sudah terdaftar. Gunakan akun lain.' };
  }

  // --- 5. Timestamp server (WITA) ---
  const now = new Date();
  const tanggal = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const waktu = Utilities.formatDate(now, TZ, 'HH:mm') + ' WITA';

  const id = (p.session_id && String(p.session_id).trim()) || ('SES-' + tanggal.replace(/-/g, '') + '-' + randId_());
  const uid = (p.user_id && String(p.user_id).trim()) || ('USR-' + randId_());

  const row = [
    id,
    uid,
    nama || (p.nama_lengkap ? String(p.nama_lengkap) : ''),
    wa.value,
    email,
    tanggal,
    waktu,
    clean_(p.sumber_trafik) || 'Direct',
    clean_(p.perangkat) || detectDevice_(),
    clean_(p.bahasa_pilihan) || 'id',
    clean_(p.mode_interaksi) || 'chat',
    clean_(p.kategori_mood) || 'def',
    clean_(p.filter_preferensi),
    num_(p.jumlah_interaksi),
    num_(p.durasi_sesi_detik),
    clean_(p.menu_direkomendasikan),
    clean_(p.merchant_tujuan),
    clean_(p.klik_order) || 'Tidak',
    clean_(p.platform_tujuan) || '-',
    clean_(p.status_langganan) || (action === 'daftar' ? 'Aktif' : 'Nonaktif'),
    clean_(p.paket_langganan) || 'Free',
    clean_(p.tgl_mulai_langganan),
    clean_(p.tgl_berakhir_langganan),
    clean_(p.metode_pembayaran) || '-',
    clean_(p.status_perpanjangan) || '-',
    num_(p.pendapatan_langganan_rp),
    num_(p.estimasi_komisi_afiliasi_rp),
    num_(p.biaya_api_sesi_rp),
    clean_(p.titik_putus_terakhir) || '-'
  ];

  if (action !== 'cek') sh.appendRow(row);

  return {
    status: 'success',
    message: action === 'cek' ? 'Data valid, siap disimpan.' : (action === 'daftar' ? 'Pendaftaran berhasil. Data tersimpan.' : 'Kunjungan tercatat.'),
    data: {
      session_id: id, user_id: uid, tanggal: tanggal, waktu_akses: waktu,
      nomor_wa: wa.value, email_gmail: email, row: sh.getLastRow()
    }
  };
}

/** Normalisasi WA: terima 08xx atau 628xx → kembalikan 628xx */
function normalizeWa_(raw) {
  const s = String(raw || '').trim();
  // boleh angka, spasi, strip, titik, kurung, + — tapi TIDAK boleh huruf/simbol lain
  if (/[A-Za-z]/.test(s)) return { ok: false, message: 'Nomor WhatsApp tidak boleh mengandung huruf.' };
  if (/[^0-9+\s().\-]/.test(s)) return { ok: false, message: 'Nomor WhatsApp mengandung simbol tidak valid.' };
  const d = s.replace(/\D/g, ''); // digits only
  // panjang 10–13 digit di input (sebelum normalisasi)
  if (d.length < 10 || d.length > 13) {
    return { ok: false, message: 'Panjang nomor WhatsApp tidak valid (10–13 digit angka).' };
  }
  let out;
  if (/^08/.test(d)) {
    out = '62' + d.slice(1);
  } else if (/^628/.test(d)) {
    out = d;
  } else {
    return { ok: false, message: 'Nomor WhatsApp harus diawali 08 atau 628.' };
  }
  if (!/^628\d{8,11}$/.test(out)) {
    return { ok: false, message: 'Nomor WhatsApp tidak valid setelah dinormalisasi.' };
  }
  return { ok: true, value: out };
}

/** Cek duplikat berdasarkan nomor WA atau email di kolom D / E */
function duplicateExists_(sh, wa, email) {
  const last = sh.getLastRow();
  if (last < 2) return false;
  const range = sh.getRange(2, 4, last - 1, 2).getValues(); // D:E
  for (let i = 0; i < range.length; i++) {
    const rowWa = String(range[i][0] || '').trim();
    const rowMail = String(range[i][1] || '').trim().toLowerCase();
    if (rowWa === wa || rowMail === email) return true;
  }
  return false;
}

function clean_(v) { return v == null ? '' : String(v).trim(); }
function num_(v) { const n = Number(v); return isFinite(n) && v !== '' ? n : 0; }
function randId_() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function detectDevice_() { return 'Mobile'; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
