import asyncio, numpy as np, av, edge_tts, sys

SR = 16000

def decode(p):
    c = av.open(p); st = c.streams.audio[0]
    rs = av.audio.resampler.AudioResampler(format='s16', layout='mono', rate=SR)
    o = []
    for f in c.decode(st):
        for rf in rs.resample(f): o.append(rf.to_ndarray().reshape(-1))
    return np.concatenate(o).astype(np.float32) / 32768.0

def trim(a, thr=0.012):
    w = int(.02*SR); idx = [i for i in range(0, len(a)-w, w) if float(np.sqrt((a[i:i+w]**2).mean())) > thr]
    if not idx: return a
    return a[max(0, idx[0]-int(.02*SR)): min(len(a), idx[-1]+w+int(.02*SR))]

def mfcc(a, n=13, nfft=512, nfilt=26):
    a = np.append(a[0], a[1:] - 0.97*a[:-1])
    win = int(.025*SR); hop = int(.010*SR)
    def h2m(f): return 2595*np.log10(1+f/700)
    def m2h(m): return 700*(10**(m/2595)-1)
    pts = np.linspace(h2m(100), h2m(7000), nfilt+2)
    bins = np.floor((nfft+1)*m2h(pts)/SR).astype(int)
    fb = np.zeros((nfilt, nfft//2+1))
    for i in range(1, nfilt+1):
        l, r, c = bins[i-1], bins[i], bins[i+1]
        for k in range(l, r):
            if r > l: fb[i-1, k] = (k-l)/(r-l)
        for k in range(r, c):
            if c > r: fb[i-1, k] = (c-k)/(c-r)
    frames = []
    for i in range(0, len(a)-win, hop):
        fr = a[i:i+win]*np.hamming(win)
        s = np.abs(np.fft.rfft(fr, nfft))
        frames.append(np.log(fb @ s + 1e-8))
    L = np.array(frames)
    k = np.arange(nfilt)
    dct = np.cos(np.pi/nfilt*(k+0.5)[None, :]*np.arange(1, n+1)[:, None])
    C = L @ dct.T
    return C - C.mean(axis=0, keepdims=True)

def dtw(A, B):
    n, m = len(A), len(B)
    D = np.full((n+1, m+1), np.inf); D[0, 0] = 0
    for i in range(1, n+1):
        for j in range(1, m+1):
            d = np.linalg.norm(A[i-1]-B[j-1])
            D[i, j] = d + min(D[i-1, j], D[i, j-1], D[i-1, j-1])
    return D[n, m] / (n+m)

async def say(voice, text, path, rate, pitch):
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await c.save(path)

async def main():
    tests = [
        ("coto", "Coto Makassar", "Chotoh Mahkassar"),
        ("konro", "Sup Konro", "Soop Konroh"),
        ("pallubasa", "Pallubasa", "Palloobahsah"),
        ("barongko", "Barongko", "Bahrongkoh"),
        ("pisangepe", "Pisang Epe", "Peesahng Ehpeh"),
        ("jalang", "Jalangkote", "Jahlahngkohteh"),
    ]
    for key, plain, resp in tests:
        ref = f"_dishtest/{key}_gadis.mp3"
        await say("id-ID-GadisNeural", plain, ref, "+0%", "+0Hz")
        p1 = f"_dishtest/{key}_plain.mp3"
        p2 = f"_dishtest/{key}_resp.mp3"
        await say("en-US-EmmaMultilingualNeural", plain, p1, "+12%", "+60Hz")
        await say("en-US-EmmaMultilingualNeural", resp, p2, "+12%", "+60Hz")
        R = mfcc(trim(decode(ref)))
        d1 = dtw(R, mfcc(trim(decode(p1))))
        d2 = dtw(R, mfcc(trim(decode(p2))))
        win = "RESPELL" if d2 < d1 else "PLAIN"
        print(f"{key:10s} plain {d1:6.3f}  respell {d2:6.3f}  -> {win} ({100*(1-d2/d1):+.0f}%)", flush=True)

asyncio.run(main())
