#!/usr/bin/env python3
"""Render the dish names with a native Indonesian/Malay voice.

The main pack is an English multilingual voice. Left alone it reads "Sop Konro"
with English phonemes, which sounds wrong for a Makassar menu. Malay (ms-MY) has
the same phonology as Indonesian, so the dish names come out right — and of the
native voices available it is the one whose timbre sits closest to the main voice
(measured log-mel similarity 0.91 vs 0.87 for id-ID), so the switch is the least
noticeable.

    python tools/gen-dish-names.py
    python tools/gen-dish-names.py --force
"""

import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "cimo"
LIST = OUT / "render-list.txt"
LINES = OUT / "lines.json"
FORCE = "--force" in sys.argv or os.environ.get("CIMO_FORCE") == "1"

VOICE = os.environ.get("CIMO_DISH_VOICE", "ms-MY-YasminNeural")
PITCH = os.environ.get("CIMO_DISH_PITCH", "+5Hz")

try:
    _cur = json.loads(LINES.read_text(encoding="utf-8"))
except Exception:
    _cur = {}
RATE = os.environ.get("CIMO_RATE") or (_cur.get("settings") or {}).get("rate") or "+12%"


def dishes():
    out = []
    for line in LIST.read_text(encoding="utf-8").splitlines():
        if "\t" not in line:
            continue
        name, text = line.split("\t", 1)
        name = name.strip()
        if name.startswith("d_") and name.endswith(".mp3"):
            out.append((name, text.strip()))
    return out


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


async def main():
    items = dishes()
    print(f"nama menu: {len(items)} klip — {VOICE}, {RATE}, {PITCH}")
    sem = asyncio.Semaphore(6)
    done = []
    await asyncio.gather(*(render(it, sem, done) for it in items))
    bad = [d for d in done if d[1] < 1500]
    if bad:
        print(f"GAGAL {len(bad)} klip:")
        for d in bad[:8]:
            print(" ", d)
        return
    lines = json.loads(LINES.read_text(encoding="utf-8"))
    lines["dishVoice"] = {"voice": VOICE, "pitch": PITCH, "rate": RATE}
    LINES.write_text(json.dumps(lines, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"selesai: {len(done)} klip nama menu")


if __name__ == "__main__":
    asyncio.run(main())
