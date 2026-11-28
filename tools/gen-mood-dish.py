#!/usr/bin/env python3
"""Render one clip per (mood x dish) pair.

A dish name on its own is read with English pronunciation by the multilingual
voice ("Sop Konro" comes out as English). Inside a full Indonesian sentence the
same voice switches to Indonesian, so the whole mood line is rendered as a
single continuous clip: natural pronunciation, and no seams between clips.

    python tools/gen-mood-dish.py
    python tools/gen-mood-dish.py --dry
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "cimo"
LIST = OUT / "render-list.txt"
LINES = OUT / "lines.json"
DRY = "--dry" in sys.argv
FORCE = "--force" in sys.argv or os.environ.get("CIMO_FORCE") == "1"

try:
    _cur = json.loads(LINES.read_text(encoding="utf-8"))
except Exception:
    _cur = {}
_cfg = _cur.get("settings") or {}
VOICE = os.environ.get("CIMO_VOICE") or _cur.get("voice") or "en-US-EmmaMultilingualNeural"
RATE = os.environ.get("CIMO_RATE") or _cfg.get("rate") or "+12%"
PITCH = os.environ.get("CIMO_PITCH") or _cfg.get("pitch") or "+60Hz"

# same wording as tools/gen-voice-edge.py so the single clip says exactly what
# the three-clip version used to say
MOOD = {
    "senang": ("Wah, kamu lagi senang ya! Coba yang manis dan segar,", "bisa jadi pilihan."),
    "sedih": ("Kamu lagi sedih ya? Peluk dulu. Coba yang hangat dan berkuah,", "misalnya."),
    "marah": ("Kamu lagi kesal ya? Tarik napas dulu. Coba yang pedas biar lega,", "salah satunya."),
    "bingung": ("Bingung mau makan apa? Aku pilihin yang aman, mulai dari", ""),
}


def dishes():
    out = []
    for line in LIST.read_text(encoding="utf-8").splitlines():
        if not line.strip() or "\t" not in line:
            continue
        name, text = line.split("\t", 1)
        name = name.strip()
        if name.startswith("d_") and name.endswith(".mp3"):
            out.append((name[2:-4], text.strip().rstrip(".")))
    return out


def sentence(mood, dish):
    pre, post = MOOD[mood]
    s = pre + " " + dish + ("," if post else "") + (" " + post if post else ".")
    return re.sub(r"\s+", " ", s).strip()


async def render(item, sem, done):
    filename, text = item
    dest = OUT / filename
    if dest.exists() and dest.stat().st_size > 1500 and not FORCE:
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


def main():
    items, mapping = [], {}
    for mood in MOOD:
        mapping[mood] = {}
        for dish_id, dish in dishes():
            f = f"md_{mood}_{dish_id}.mp3"
            mapping[mood][dish_id] = f
            items.append((f, sentence(mood, dish)))

    print(f"mood x dish: {len(items)} klip — {VOICE}, {RATE}, {PITCH}")
    if DRY:
        for f, t in items[:6]:
            print(f"  {f:<28} {t}")
        print(f"  ... dan {len(items)-6} lagi")
        return

    done = asyncio.run(gather(items))
    bad = [d for d in done if d[1] < 1500]
    if bad:
        print(f"GAGAL {len(bad)} klip:")
        for d in bad[:10]:
            print(" ", d)
        return

    lines = json.loads(LINES.read_text(encoding="utf-8"))
    lines["moodDish"] = mapping
    LINES.write_text(json.dumps(lines, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"selesai: {len(done)} klip, peta moodDish ditulis ke lines.json")


async def gather(items):
    sem = asyncio.Semaphore(6)
    done = []
    await asyncio.gather(*(render(it, sem, done) for it in items))
    return done


if __name__ == "__main__":
    main()
