import av, numpy as np
from faster_whisper import WhisperModel
SR=16000
def dec(p):
    c=av.open(p); st=c.streams.audio[0]
    rs=av.audio.resampler.AudioResampler(format='s16',layout='mono',rate=SR)
    o=[]
    for f in c.decode(st):
        for rf in rs.resample(f): o.append(rf.to_ndarray().reshape(-1))
    return np.concatenate(o).astype(np.float32)/32768.0
m=WhisperModel("base", device="cpu", compute_type="int8")
for f in ["md_senang_pallubasa","md_senang_konro","md_sedih_jalang","md_senang_coto"]:
    segs,_=m.transcribe(dec(f"audio/cimo/{f}.mp3"), language="id", beam_size=5)
    print(f, "->", " ".join(s.text.strip() for s in segs), flush=True)
