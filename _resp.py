import asyncio, av, numpy as np, edge_tts, difflib, re
from faster_whisper import WhisperModel
SR = 16000

def decode(p):
    c = av.open(p); st = c.streams.audio[0]
    rs = av.audio.resampler.AudioResampler(format='s16', layout='mono', rate=SR)
    o = []
    for f in c.decode(st):
        for rf in rs.resample(f): o.append(rf.to_ndarray().reshape(-1))
    return np.concatenate(o).astype(np.float32)/32768.0

PROMPT = ("Menu Makassar: Coto Makassar, Sup Konro, Sop Saudara, Pallubasa, Bakso Urat, "
          "Ayam Palekko, Konro Bakar, Jalangkote, Barongko, Pisang Epe, Es Pallu Butung.")

TESTS = [
 ("konro", "Sup Konro", ["Sup Konro", "Soop Konroh", "Sup Konroh", "Soop Konro"]),
 ("pallubasa", "Pallubasa", ["Pallubasa", "Palubasa", "Palloobahsah", "Pahlubahsah"]),
 ("jalang", "Jalangkote", ["Jalangkote", "Jahlahngkoteh", "Jalangkoteh", "Jahlangkoteh"]),
 ("coto", "Coto Makassar", ["Coto Makassar", "Chotoh Mahkassar", "Choto Makassar", "Chotoh Makassar"]),
]

def norm(s):
    return re.sub(r"[^a-z ]", "", s.lower()).strip()

async def say(text, path):
    c = edge_tts.Communicate(text, "en-US-EmmaMultilingualNeural", rate="+12%", pitch="+60Hz")
    await c.save(path)

async def main():
    m = WhisperModel("base", device="cpu", compute_type="int8")
    for key, dish, variants in TESTS:
        print(f"## {dish}")
        for i, v in enumerate(variants):
            p = f"_resp/{key}_{i}.mp3"
            await say(v, p)
            segs, _ = m.transcribe(decode(p), language="id", beam_size=5,
                                   initial_prompt=PROMPT, condition_on_previous_text=False)
            txt = " ".join(s.text.strip() for s in segs)
            score = difflib.SequenceMatcher(None, norm(txt), norm(dish)).ratio()
            print(f"   {v:<22} -> {txt:<28} {score:.2f}", flush=True)

asyncio.run(main())
