#!/usr/bin/env python3
"""Inject cached formula results into the dashboard sheet so previews show values.
Google Sheets will still recalculate the live formulas on open/upload."""
import re, zipfile, shutil, os

PATH = r"C:\Users\fhatu\.android\Dokumen\Dev 3 Cravemood\Database Pengunjung & Langganan CraveMood.xlsx"

# Computed from the 5 sample rows in build.py
VALUES = {
    "B3": "5",          # COUNTA sessions
    "B4": "5",          # COUNTUNIQUE user_id
    "B5": "0.6",        # 3 of 5 klik_order = Ya
    "B6": "3",          # Aktif + Premium
    "B7": "218000",     # 59000 + 59000 + 99000
    "B8": "10850",      # 2950 + 2950 + 4950
    "B9": "2190",       # 480 + 320 + 520 + 260 + 610
    "B10": "227660",    # 218000 + 10850 - 2190
}

tmp = PATH + ".tmp"
with zipfile.ZipFile(PATH, "r") as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "xl/worksheets/sheet2.xml":
            s = data.decode("utf-8")
            for ref, val in VALUES.items():
                # replace empty <v /> inside the formula cell
                pat = re.compile(r'(<c r="' + ref + r'"[^>]*><f>[^<]*</f>)<v\s*/>')
                s, n = pat.subn(r'\1<v>' + val + '</v>', s)
                if n != 1:
                    raise SystemExit(f"failed to inject {ref}: matched {n}")
            data = s.encode("utf-8")
        zout.writestr(item, data)
os.replace(tmp, PATH)
print("cached values injected")
