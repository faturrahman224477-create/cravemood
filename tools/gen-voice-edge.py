#!/usr/bin/env python3
"""Regenerate Cimo's whole voice pack with a soft, cheerful neural voice.

Uses Microsoft Edge neural TTS (id-ID-GadisNeural) — no API key needed.
The original ElevenLabs files are kept in audio/cimo/elevenlabs-backup/ so
the change is reversible.

    python tools/gen-voice-edge.py
    python tools/gen-voice-edge.py --dry
"""

import asyncio
import json
import os
import re
import shutil
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "cimo"
BACKUP = OUT / "elevenlabs-backup"
TMP = OUT / "_edge_tmp_natural2"   # unique per setting pair — never reuse stale clips
DRY = "--dry" in sys.argv

# Overridable so a voice can be auditioned without editing this file:
#   CIMO_VOICE=ms-MY-YasminNeural CIMO_RATE=+12% CIMO_PITCH=+36Hz python tools/gen-voice-edge.py
VOICE = os.environ.get("CIMO_VOICE", "id-ID-GadisNeural")  # warm Indonesian female, closest to the Kuon reference
RATE = os.environ.get("CIMO_RATE", "+2%")                  # natural tempo between a drag and the old robot rush
PITCH = os.environ.get("CIMO_PITCH", "+0Hz")               # keep the natural register (no chipmunk lift)
TMP = OUT / ("_edge_tmp_" + re.sub(r"[^A-Za-z0-9]", "_", VOICE + RATE + PITCH))

MOOD_LINES = {
    "senang": {"pre": "Wah, kamu lagi senang ya! Coba yang manis dan segar,", "post": "bisa jadi pilihan."},
    "sedih": {"pre": "Kamu lagi sedih ya? Peluk dulu. Coba yang hangat dan berkuah,", "post": "misalnya."},
    "marah": {"pre": "Kamu lagi kesal ya? Tarik napas dulu. Coba yang pedas biar lega,", "post": "salah satunya."},
    "bingung": {"pre": "Bingung mau makan apa? Aku pilihin yang aman, mulai dari", "post": "."},
}
FIXED = {
    "greet": "Hai, aku Cimo. Lagi mood apa hari ini?",
    "preview": "Hai, aku Cimo. Kalau kamu lagi capek, cerita aja. Aku dengerin sampai selesai.",
    "added": "Sudah masuk keranjang.",
    "saved": "Tersimpan.",
}


def pack_key(text):
    """Same normalisation as packKey() in src/voice.js."""
    out = []
    for ch in str(text).lower():
        cat = unicodedata.category(ch)
        out.append(ch if (cat[0] in ("L", "N") or ch.isspace()) else " ")
    return " ".join("".join(out).split())


def chat_lines():
    """Recover the ORIGINAL chat sentences (with punctuation) from chat.js."""
    src = (ROOT / "src" / "chat.js").read_text(encoding="utf-8")
    a, b = src.find("  id: {"), src.find("  en: {")
    block = src[a:b] if a > -1 and b > a else src
    result = {}
    for raw in re.findall(r"'((?:[^'\\]|\\.)*)'", block):
        s = raw.replace("\\'", "'").replace("\\n", " ")
        s = " ".join(s.split())
        if len(s) < 6 or len(s) > 150 or not re.search(r"[a-zA-Z]", s):
            continue
        if re.match(r"^\s*\{name\}", s):
            s = re.sub(r"^\s*\{name\}\s*[!,.?]?\s*", "", s)
        else:
            s = re.sub(r"\{name\}\s*!", "!", s)
            s = re.sub(r",\s*\{name\}", "", s)
            s = re.sub(r"\{name\},\s*", "", s)
            s = re.sub(r"\{name\}", "kamu", s)
        s = re.sub(r"\s+([!?.,])", r"\1", s)
        s = " ".join(s.split()).strip()
        if not s or "{" in s or "}" in s:
            continue
        s = s[0].upper() + s[1:]
        result[pack_key(s)] = s
    return result


def dish_names():
    src = (ROOT / "src" / "data.js").read_text(encoding="utf-8")
    a = src.find("const MENU = [")
    block = src[a:src.find("\n];", a)] if a > -1 else ""
    return re.findall(r"\{id:'([^']+)',\s*name:'([^']+)'", block)


def jobs():
    # the explicit list is the source of truth: one filename per line
    lst = OUT / "render-list.txt"
    if lst.exists():
        out = []
        for line in lst.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.lstrip().startswith("#") or "\t" not in line:
                continue
            name, text = line.split("\t", 1)
            out.append((name.strip(), text.strip()))
        if out:
            return out
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    lines = json.loads((OUT / "lines.json").read_text(encoding="utf-8"))
    chat = chat_lines()
    out = []

    # chat recordings: manifest key -> file; prefer the original punctuated text
    used = set()
    for key, filename in manifest.items():
        text = chat.get(key, key)
        text = text[0].upper() + text[1:] if text else text
        out.append((filename, text))
        used.add(filename)

    # mood / fixed / dish recordings from lines.json
    for mood, seg in lines.get("moods", {}).items():
        for part in ("pre", "post"):
            f = seg.get(part)
            if f and f in used:
                continue
            t = MOOD_LINES.get(mood, {}).get(part, "")
            if t and t != ".":
                out.append((f, t))
                used.add(f)
    for key, f in lines.get("fixed", {}).items():
        if f and f not in used:
            out.append((f, FIXED.get(key, "Hai, aku Cimo.")))
            used.add(f)
    for dish_id, name in dish_names():
        f = lines.get("dishes", {}).get(dish_id)
        if f and f not in used:
            out.append((f, name))
            used.add(f)

    # the reference sample that gives Cimo her voice identity
    if "cimo-voice.mp3" not in used:
        out.append(("cimo-voice.mp3", "Hai, aku Cimo. Temanmu yang suka nyari makanan sesuai mood kamu."))
    return out


async def render(item, sem, done):
    filename, text = item
    dest = TMP / filename
    if dest.exists() and dest.stat().st_size > 1500:
        done.append((filename, dest.stat().st_size, "cached"))
        return
    import edge_tts
    async with sem:
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
                await c.save(str(dest))
                if dest.stat().st_size > 1500:
                    break
            except Exception as exc:
                if attempt == 2:
                    done.append((filename, 0, str(exc)[:90]))
                    return
                await asyncio.sleep(1.5 * (attempt + 1))
    done.append((filename, dest.stat().st_size if dest.exists() else 0, "ok"))


async def main_async(items):
    TMP.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(5)
    done = []
    await asyncio.gather(*(render(it, sem, done) for it in items))
    return done


def main():
    items = jobs()
    print(f"voice pack: {len(items)} clips — {VOICE}, rate {RATE}, pitch {PITCH}")
    if DRY:
        for f, t in items[:10]:
            print(f"  {f:<24} {t[:70]}")
        print(f"  ... and {len(items)-10} more")
        return

    done = asyncio.run(main_async(items))
    bad = [d for d in done if d[1] < 1500]
    if bad:
        print(f"FAILED {len(bad)} clips, nothing replaced:")
        for d in bad[:12]:
            print(" ", d)
        return
    BACKUP.mkdir(parents=True, exist_ok=True)
    moved = 0
    for filename, _, _ in done:
        src = TMP / filename
        dst = OUT / filename
        if dst.exists() and not (BACKUP / filename).exists():
            shutil.copy2(dst, BACKUP / filename)
        shutil.copy2(src, dst)
        moved += 1
    # TMP is kept on disk (gitignored, and stripped from the Pages staging)
    # so a rerun can reuse already-rendered clips instead of hitting TTS again.

    lines_path = OUT / "lines.json"
    lines = json.loads(lines_path.read_text(encoding="utf-8"))
    lines["voiceName"] = "Cimo Gadis (natural & hangat)"
    lines["voice"] = VOICE
    lines["model"] = "edge-neural"
    lines["settings"] = {"rate": RATE, "pitch": PITCH}
    lines_path.write_text(json.dumps(lines, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"selesai: {moved}/{len(items)} klip diganti. Backup asli di {BACKUP}")


if __name__ == "__main__":
    main()
