import asyncio, numpy as np, av, edge_tts
exec(open('_dtw.py').read().split('async def say')[0].split('def decode')[0])  # imports only
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

def cut_last_phrase(a, min_gap=0.25):
    w = int(.01*SR)
    loud = [float(np.sqrt((a[i:i+w]**2).mean())) > 0.006 for i in range(0, len(a)-w, w)]
    # find last run of silence >= min_gap that is followed by speech and is not at the very end
    last = len(loud)-1
    while last > 0 and not loud[last]: last -= 1
    i = last
    while i > 0 and loud[i]: i -= 1     # walk back through the final phrase
    gap = 0
    j = i
    while j > 0 and not loud[j]: gap += 1; j -= 1
    if gap * 0.01 < min_gap: return None
    start = (i+1) * w
    return a[max(0, start-int(.02*SR)):]

async def say(voice, text, path, rate, pitch):
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await c.save(path)

async def main():
    tests = [("konro","Sup Konro"),("coto","Coto Makassar"),("pallubasa","Pallubasa"),("jalang","Jalangkote"),("barongko","Barongko")]
    for key, dish in tests:
        ref = f"_dishtest/{key}_gadis.mp3"
        if not __import__('os').path.exists(ref):
            await say("id-ID-GadisNeural", dish, ref, "+0%", "+0Hz")
        p1 = f"_dishtest/{key}_plain.mp3"
        if not __import__('os').path.exists(p1):
            await say("en-US-EmmaMultilingualNeural", dish, p1, "+12%", "+60Hz")
        car = f"_dishtest/{key}_carrier.mp3"
        await say("en-US-EmmaMultilingualNeural", f"Coba menu ini. {dish}.", car, "+12%", "+60Hz")
        cut = cut_last_phrase(decode(car))
        if cut is None:
            print(f"{key:10s} cut gagal"); continue
        R = mfcc(trim(decode(ref)))
        d1 = dtw(R, mfcc(trim(decode(p1))))
        d2 = dtw(R, mfcc(trim(cut)))
        print(f"{key:10s} plain {d1:6.3f} | carrier-cut {d2:6.3f} | {len(cut)/SR:.2f}s -> {'CARRIER' if d2<d1 else 'PLAIN'} ({100*(1-d2/d1):+.0f}%)", flush=True)

asyncio.run(main())
