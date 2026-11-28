import av, numpy as np
from faster_whisper import WhisperModel
SR = 16000
def decode(p):
    c = av.open(p); st = c.streams.audio[0]
    rs = av.audio.resampler.AudioResampler(format='s16', layout='mono', rate=SR)
    o = []
    for f in c.decode(st):
        for rf in rs.resample(f): o.append(rf.to_ndarray().reshape(-1))
    return np.concatenate(o).astype(np.float32)/32768.0

src = open('_dtw.py').read()
ns = {}
exec(src[src.index('def trim'):src.index('async def say')], {'np': np, 'SR': SR}, ns)
trim, mfcc, dtw = ns['trim'], ns['mfcc'], ns['dtw']

m = WhisperModel("base", device="cpu", compute_type="int8")
for key, dish, mood in [("konro","Sup Konro","senang"), ("coto","Coto Makassar","senang"),
                        ("pallubasa","Pallubasa","senang"), ("jalang","Jalangkote","sedih")]:
    a = decode(f"audio/cimo/md_{mood}_{key}.mp3")
    segs, _ = m.transcribe(a, language="id", beam_size=5, word_timestamps=True, vad_filter=False)
    words = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    print(key, "|", " ".join(w[0] for w in words), flush=True)
    target = [w for w in words if w[0].lower().strip(".,!?") in ("sup","sop","konro","coto","choto","pallubasa","jalangkote")]
    if not target:
        print("  (kata menu tidak ketemu)", flush=True); continue
    s0 = min(w[1] for w in target); s1 = max(w[2] for w in target)
    span = a[int(max(0,s0-0.05)*SR): int(min(len(a)/SR, s1+0.05)*SR)]
    R = mfcc(trim(decode(f"_dishtest/{key}_gadis.mp3")))
    P = mfcc(trim(decode(f"_dishtest/{key}_plain.mp3")))
    C = mfcc(trim(span))
    d_ref = dtw(R, P); d_combo = dtw(R, C)
    print(f"  span {s1-s0:.2f}s | jarak ke pengucapan asli: klip-lama {d_ref:.3f} vs gabungan {d_combo:.3f} -> {'LEBIH BAIK' if d_combo < d_ref else 'lebih buruk'} ({100*(1-d_combo/d_ref):+.0f}%)", flush=True)
