"""Give a rendered video a new sound track without rendering the picture again.

    python -I remux_audio.py <video in> <audio mix> <video out> [fade start in s] [fade end in s]

The picture is copied bit for bit; only the audio is replaced (AAC, 48 kHz, stereo, 320 kbit/s).
The optional fade repeats the fade-out the composition applies at the end (Pilot.tsx: last second).
Use it when only the narration or the music changed. If the picture changed, render with Remotion.
"""
import os
import sys
from fractions import Fraction

import av
import numpy as np

SR = 48000


def load_stereo(path):
    cont = av.open(path)
    rs = av.AudioResampler(format="fltp", layout="stereo", rate=SR)
    ch = []
    for fr in cont.decode(audio=0):
        for f in rs.resample(fr):
            ch.append(f.to_ndarray())
    for f in rs.resample(None):
        ch.append(f.to_ndarray())
    cont.close()
    return np.concatenate(ch, axis=1).astype(np.float32)


def main():
    vin, ain, vout = sys.argv[1:4]
    fade0 = float(sys.argv[4]) if len(sys.argv) > 4 else None
    fade1 = float(sys.argv[5]) if len(sys.argv) > 5 else None

    src = av.open(vin)
    vs = src.streams.video[0]
    dur = float(vs.duration * vs.time_base) if vs.duration else float(src.duration) / 1e6
    n = int(round(dur * SR))
    st = load_stereo(ain)
    st = np.pad(st, ((0, 0), (0, max(0, n - st.shape[1]))))[:, :n]
    if fade0 is not None and fade1 is not None:
        t = np.arange(n) / SR
        st = st * np.interp(t, [fade0, fade1], [1.0, 0.0]).astype(np.float32)

    out = av.open(vout, "w", options={"movflags": "faststart"})
    ovs = out.add_stream_from_template(vs)
    oas = out.add_stream("aac", rate=SR)
    oas.codec_context.layout = "stereo"
    oas.codec_context.bit_rate = 320000

    packets = []
    for pkt in src.demux(vs):
        if pkt.dts is None:
            continue
        packets.append((float(pkt.dts * pkt.time_base), 0, pkt, ovs))
    step = 1024
    for i in range(0, n, step):
        fr = av.AudioFrame.from_ndarray(np.ascontiguousarray(st[:, i:i + step]), format="fltp", layout="stereo")
        fr.sample_rate = SR
        fr.time_base = Fraction(1, SR)
        fr.pts = i
        for p in oas.encode(fr):
            packets.append((float(p.dts * p.time_base), 1, p, oas))
    for p in oas.encode(None):
        packets.append((float(p.dts * p.time_base), 1, p, oas))
    packets.sort(key=lambda x: (x[0], x[1]))
    nv = na = 0
    for _, kind, p, stream in packets:
        p.stream = stream
        out.mux(p)
        if kind:
            na += 1
        else:
            nv += 1
    out.close()
    src.close()
    print("%s: %d video packets copied, %d audio packets, %.2f s, %.1f MB" % (os.path.basename(vout), nv, na, dur, os.path.getsize(vout) / 1e6))


if __name__ == "__main__":
    main()
