"""Shared helpers for the voice test: audio I/O, resampling, levels and a pitch estimate."""
import wave
from fractions import Fraction

import av
import numpy as np

SR = 48000


def resample_int16(x, src_rate, dst_rate=SR):
    """Resample int16 mono samples that are declared to be at src_rate to dst_rate (libswresample).

    Declaring a different rate than the real one is how the pitch shift works: the samples play
    faster or slower, and the synthesis length was scaled beforehand so the tempo stays the same.
    """
    x = np.ascontiguousarray(np.asarray(x, dtype=np.int16)).reshape(1, -1)
    frame = av.AudioFrame.from_ndarray(x, format="s16", layout="mono")
    frame.sample_rate = int(round(src_rate))
    rs = av.AudioResampler(format="s16", layout="mono", rate=dst_rate)
    out = [f.to_ndarray() for f in rs.resample(frame)]
    out += [f.to_ndarray() for f in rs.resample(None)]
    return np.concatenate(out, axis=1)[0]


def load_audio(path, dst_rate=SR):
    """Decode any audio file to mono float32 at dst_rate."""
    cont = av.open(str(path))
    rs = av.AudioResampler(format="flt", layout="mono", rate=dst_rate)
    chunks = []
    for frame in cont.decode(audio=0):
        for f in rs.resample(frame):
            chunks.append(f.to_ndarray()[0])
    for f in rs.resample(None):
        chunks.append(f.to_ndarray()[0])
    cont.close()
    return np.concatenate(chunks).astype(np.float32)


def save_wav(path, x, rate=SR):
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def save_mp3(path, x, rate=SR, bitrate=128000):
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).astype(np.int16).reshape(1, -1)
    out = av.open(str(path), mode="w")
    st = out.add_stream("libmp3lame", rate=rate)
    st.codec_context.layout = "mono"
    st.codec_context.format = "s16p"
    st.codec_context.bit_rate = bitrate
    n = pcm.shape[1]
    for i in range(0, n, 1152):
        f = av.AudioFrame.from_ndarray(np.ascontiguousarray(pcm[:, i:i + 1152]), format="s16p", layout="mono")
        f.sample_rate = rate
        f.time_base = Fraction(1, rate)
        f.pts = i
        for pkt in st.encode(f):
            out.mux(pkt)
    for pkt in st.encode(None):
        out.mux(pkt)
    out.close()


def trim(x, rate=SR, thresh_db=-45.0, pad=0.02):
    """Cut leading and trailing silence and keep a little padding."""
    win = int(0.01 * rate)
    n = len(x) // win
    if n == 0:
        return x
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    act = np.where(20 * np.log10(rms / np.max(rms) + 1e-12) > thresh_db)[0]
    if len(act) == 0:
        return x
    a = max(0, act[0] * win - int(pad * rate))
    b = min(len(x), (act[-1] + 1) * win + int(pad * rate))
    return x[a:b]


def speech_rms(x, rate=SR):
    """RMS over the active (non-silent) 20 ms windows."""
    win = int(0.02 * rate)
    n = len(x) // win
    if n == 0:
        return float(np.sqrt(np.mean(x ** 2) + 1e-12))
    r = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    act = r[r > 0.1 * np.max(r)]
    return float(np.sqrt(np.mean(act ** 2)))


def soft_limit(y, knee=0.7, ceil=0.95):
    a = np.abs(y)
    over = a > knee
    out = y.copy()
    out[over] = np.sign(y[over]) * (knee + (ceil - knee) * np.tanh((a[over] - knee) / (ceil - knee)))
    return out


def normalize(x, target_db=-20.0, rate=SR):
    """Bring the speech level to target_db (RMS over active windows), then limit the peaks softly."""
    g = (10 ** (target_db / 20.0)) / max(speech_rms(x, rate), 1e-6)
    return soft_limit(x * g)


def fade_edges(x, rate=SR, ms=8.0):
    n = min(int(rate * ms / 1000.0), len(x) // 2)
    if n <= 0:
        return x
    y = x.copy()
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    y[:n] *= ramp
    y[-n:] *= ramp[::-1]
    return y


def f0_stats(x, rate=SR):
    """Median pitch in Hz and its 10-90 % spread over voiced frames (autocorrelation on a 16 kHz copy)."""
    step = max(1, rate // 16000)
    if step > 1:
        y = np.convolve(x, np.ones(step) / step, mode="same")[::step]
        sr = rate // step
    else:
        y, sr = x, rate
    n = int(0.04 * sr)
    hop = int(0.01 * sr)
    lo = int(sr / 400)
    hi = int(sr / 65)
    win = np.hanning(n)
    peak = np.max(np.abs(y)) + 1e-9
    f0 = []
    for i in range(0, len(y) - n, hop):
        fr = y[i:i + n]
        if np.sqrt(np.mean(fr ** 2)) < 0.05 * peak:
            continue
        fr = (fr - np.mean(fr)) * win
        spec = np.fft.rfft(fr, 2 * n)
        ac = np.fft.irfft(spec * np.conj(spec))[:n]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        seg = ac[lo:hi]
        j = int(np.argmax(seg))
        if seg[j] > 0.5:
            f0.append(sr / (j + lo))
    if not f0:
        return 0.0, 0.0
    f0 = np.array(f0)
    return float(np.median(f0)), float(np.percentile(f0, 90) - np.percentile(f0, 10))
