#!/usr/bin/env python3
"""Build the CraveMood visitor + subscription workbook."""
from datetime import date
try:
    import openpyxl
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl>=3.1.0"])
    import openpyxl

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule

OUT = r"C:\Users\fhatu\.android\Dokumen\Dev 3 Cravemood\Database Pengunjung & Langganan CraveMood.xlsx"


def xl_color(css_hex: str) -> str:
    value = css_hex.removeprefix("#").upper()
    if len(value) != 6:
        raise ValueError(f"Expected #RRGGBB, got: {css_hex}")
    return "FF" + value


XL_HEADER = xl_color("#4472C4")
XL_HEADER_FONT = xl_color("#FFFFFF")
XL_TITLE = xl_color("#2F5597")
XL_LIGHT = xl_color("#D9E2F3")
XL_CALC = xl_color("#F2F2F2")
XL_BORDER = xl_color("#BFBFBF")
XL_GREEN_BG = xl_color("#C6EFCE")
XL_GREEN_FG = xl_color("#006100")
XL_RED_BG = xl_color("#FFC7CE")
XL_RED_FG = xl_color("#9C0006")
XL_YELLOW_BG = xl_color("#FFEB9C")
XL_YELLOW_FG = xl_color("#9C6500")

thin = Side(style="thin", color=XL_BORDER)
border = Border(left=thin, right=thin, top=thin, bottom=thin)

HEADERS = [
    "session_id", "user_id", "nama_lengkap", "nomor_wa", "email_gmail", "tanggal",
    "waktu_akses", "sumber_trafik", "perangkat", "bahasa_pilihan", "mode_interaksi",
    "kategori_mood", "filter_preferensi", "jumlah_interaksi", "durasi_sesi_detik",
    "menu_direkomendasikan", "merchant_tujuan", "klik_order", "platform_tujuan",
    "status_langganan", "paket_langganan", "tgl_mulai_langganan", "tgl_berakhir_langganan",
    "metode_pembayaran", "status_perpanjangan", "pendapatan_langganan_rp",
    "estimasi_komisi_afiliasi_rp", "biaya_api_sesi_rp", "titik_putus_terakhir",
]

# Realistic sample rows for CraveMood Makassar (phone/email are fictional examples).
ROWS = [
    ["SES-20261125-0001", "USR-0001", "Andi Pratama", "6281212345678", "andi.pratama@gmail.com",
     date(2026, 11, 25), "09:14 WITA", "Instagram", "Mobile", "id", "chat", "senang", "pedas",
     14, 326, "Coto Makassar", "Coto Makassar HN", "Ya", "ShopeeFood", "Aktif", "Premium",
     date(2026, 11, 1), date(2026, 12, 1), "GoPay", "Otomatis", 59000, 2950, 480, "checkout_pembayaran"],
    ["SES-20261125-0002", "USR-0002", "Nurul Aini", "6281312345678", "nurul.aini@gmail.com",
     date(2026, 11, 25), "11:42 WITA", "TikTok", "Mobile", "id", "chat", "bingung", "murah",
     9, 214, "Pisang Epe", "Pisang Kembung HN", "Tidak", "-", "Nonaktif", "Free",
     None, None, "-", "-", 0, 0, 320, "pilih_mood"],
    ["SES-20261126-0003", "USR-0003", "Rizky Mahendra", "6281812345678", "rizky.mahendra@gmail.com",
     date(2026, 11, 26), "13:05 WITA", "Google", "Desktop", "en", "rekomendasi", "lapar", "manis",
     21, 512, "Konro Bakar", "Konro Bakar Lao Para", "Ya", "GrabFood", "Aktif", "Premium",
     date(2026, 11, 20), date(2026, 12, 20), "OVO", "Manual", 59000, 2950, 520, "-"],
    ["SES-20261126-0004", "USR-0004", "Siti Fatimah", "6282212345678", "siti.fatimah@gmail.com",
     date(2026, 11, 26), "16:38 WITA", "WhatsApp", "Mobile", "id", "chat", "sedih", "hangat",
     7, 168, "Kopi Pallubasa", "Kedai Kopi Pallubasa", "Tidak", "-", "Aktif", "Free",
     None, None, "-", "-", 0, 0, 260, "chat_balasan"],
    ["SES-20261126-0005", "USR-0005", "Dewi Anggraini", "6281912345678", "dewi.anggraini@gmail.com",
     date(2026, 11, 26), "20:11 WITA", "Direct", "Mobile", "id", "rekomendasi", "senang", "segar",
     18, 441, "Es Pijo", "Es Pijo Khas Makassar", "Ya", "ShopeeFood", "Aktif", "Premium",
     date(2026, 11, 22), date(2026, 12, 22), "DANA", "Otomatis", 99000, 4950, 610, "-"],
]

wb = Workbook()
wb.properties.title = "Database Pengunjung & Langganan CraveMood"

# ---------------- Tab 1: Data_Pengunjung ----------------
ws = wb.active
ws.title = "Data_Pengunjung"

for c, name in enumerate(HEADERS, start=1):
    cell = ws.cell(row=1, column=c, value=name)
    cell.font = Font(bold=True, color=XL_HEADER_FONT, size=10)
    cell.fill = PatternFill("solid", fgColor=XL_HEADER)
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = border
ws.row_dimensions[1].height = 30

for r, values in enumerate(ROWS, start=2):
    for c, val in enumerate(values, start=1):
        cell = ws.cell(row=r, column=c, value=val)
        cell.border = border
        cell.font = Font(size=10)
        if c in (4, 5, 7, 16, 17, 19, 29):
            cell.alignment = Alignment(horizontal="left")
        else:
            cell.alignment = Alignment(horizontal="center")
        if c in (6, 22, 23):
            cell.number_format = "yyyy-mm-dd"
        if c in (26, 27, 28):
            cell.number_format = '"Rp" #,##0'

# Column widths (29 columns, keep readable but compact)
widths = [19, 12, 20, 17, 27, 13, 13, 14, 10, 12, 14, 14, 16, 13, 15, 22, 24, 11, 14,
          15, 15, 17, 19, 16, 17, 20, 23, 19, 22]
for i, w in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(HEADERS))}{len(ROWS) + 1}"

# Validation dropdowns on sample + a few reserved rows below
last_row = len(ROWS) + 1
reserve_end = 20
validations = {
    "H": '"Instagram,TikTok,Google,WhatsApp,Direct,Facebook,X"',
    "I": '"Mobile,Desktop,Tablet"',
    "J": '"id,en,zh,hi"',
    "K": '"chat,rekomendasi,spin,chat+rekomendasi"',
    "L": '"senang,sedih,marah,bingung,lapar,def"',
    "M": '"manis,pedas,murah,segar,hangat,白色"',
    "R": '"Ya,Tidak"',
    "S": '"ShopeeFood,GrabFood,GoFood,-"',
    "T": '"Aktif,Nonaktif"',
    "U": '"Premium,Free"',
    "X": '"GoPay,OVO,DANA,ShopeePay,-"',
    "Y": '"Otomatis,Manual,-"',
}
for col, formula in validations.items():
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.error = "Pilih salah satu nilai dari daftar."
    dv.errorTitle = "Nilai tidak valid"
    dv.prompt = "Pilih dari daftar"
    dv.promptTitle = col
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}{reserve_end}")

# Highlight subscription status
ws.conditional_formatting.add(
    f"T2:T{reserve_end}",
    CellIsRule(operator="equal", formula=['"Aktif"'], fill=PatternFill("solid", fgColor=XL_GREEN_BG),
               font=Font(color=XL_GREEN_FG)),
)
ws.conditional_formatting.add(
    f"T2:T{reserve_end}",
    CellIsRule(operator="equal", formula=['"Nonaktif"'], fill=PatternFill("solid", fgColor=XL_RED_BG),
               font=Font(color=XL_RED_FG)),
)

# ---------------- Tab 2: Dashboard_Ringkasan ----------------
dash = wb.create_sheet("Dashboard_Ringkasan")

dash.merge_cells("A1:B1")
t = dash["A1"]
t.value = "Dashboard Ringkasan — CraveMood"
t.font = Font(bold=True, size=14, color=XL_HEADER_FONT)
t.fill = PatternFill("solid", fgColor=XL_TITLE)
t.alignment = Alignment(horizontal="center", vertical="center")
dash.row_dimensions[1].height = 32

for col, name in zip("AB", ("Metrik", "Nilai")):
    cell = dash[f"{col}2"]
    cell.value = name
    cell.font = Font(bold=True, color=XL_HEADER_FONT)
    cell.fill = PatternFill("solid", fgColor=XL_HEADER)
    cell.alignment = Alignment(horizontal="center")
    cell.border = border

DATA = "'Data_Pengunjung'!"
metrics = [
    ("Total Sesi Kunjungan", f"=COUNTA({DATA}$A$2:$A$10000)", "0"),
    ("Total Pengguna Unik Terdaftar", f"=COUNTUNIQUE({DATA}$B$2:$B$10000)", "0"),
    ("Conversion Rate Klik Order (%)", f'=IF(COUNTA({DATA}$A$2:$A$10000)=0,"",COUNTIF({DATA}$R$2:$R$10000,"Ya")/COUNTA({DATA}$A$2:$A$10000))', "0.00%"),
    ("Jumlah Pelanggan Premium Aktif", f'=COUNTIFS({DATA}$T$2:$T$10000,"Aktif",{DATA}$U$2:$U$10000,"Premium")', "0"),
    ("Total Pendapatan Langganan (Rp)", f"=SUM({DATA}$Z$2:$Z$10000)", '"Rp" #,##0'),
    ("Total Estimasi Komisi Afiliasi (Rp)", f"=SUM({DATA}$AA$2:$AA$10000)", '"Rp" #,##0'),
    ("Total Biaya API Variabel (Rp)", f"=SUM({DATA}$AB$2:$AB$10000)", '"Rp" #,##0'),
    ("Laba Kotor Operasional (Rp)", f'=SUM({DATA}$Z$2:$Z$10000)+SUM({DATA}$AA$2:$AA$10000)-SUM({DATA}$AB$2:$AB$10000)', '"Rp" #,##0'),
]

for i, (label, formula, fmt) in enumerate(metrics, start=3):
    a = dash.cell(row=i, column=1, value=label)
    b = dash.cell(row=i, column=2, value=formula)
    a.font = Font(bold=True, size=10)
    a.fill = PatternFill("solid", fgColor=XL_LIGHT)
    b.fill = PatternFill("solid", fgColor=XL_CALC)
    b.font = Font(bold=True, size=11, color=XL_TITLE)
    a.border = b.border = border
    a.alignment = Alignment(horizontal="left", vertical="center")
    b.alignment = Alignment(horizontal="right", vertical="center")
    b.number_format = fmt
    dash.row_dimensions[i].height = 22

dash.column_dimensions["A"].width = 36
dash.column_dimensions["B"].width = 24
dash.freeze_panes = "A3"

dash["A12"] = "Catatan: semua angka dihitung otomatis dari tab Data_Pengunjung."
dash["A12"].font = Font(italic=True, size=9, color=XL_RED_FG)

wb.save(OUT)
print("saved:", OUT)
