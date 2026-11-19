"""Measure how a narrator's voice sounds, as far as numbers can tell.

    python -I voice_profile.py <audio> <out.json> [--words <json with "words": [{"w","s","e"}]>] [--t0 s] [--t1 s]

Without --words the script lets Whisper find the words. Everything is measured only while words are spoken,
so music under the voice disturbs as little as possible. Prints and stores:

  pitch     median, 10 % and 90 % values, range in semitones, how far the voice falls at sentence ends
  tempo     words a minute, syllables a second with and without pauses, share and length of pauses
  timbre    level per frequency band, brightness (2-8 kHz against 0.3-2 kHz)
  size      vocal tract length estimated from the formants: about 14-15 cm is typical for women,
            about 16-17.5 cm for men
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import vtlib  # noqa: E402

SR = 22050
N = 4096

ONES = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
        "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"]
TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"]


def zahl(n):
    """German number word, good enough for counting syllables."""
    if n < 20:
        return ONES[n]
    if n < 100:
        t, o = divmod(n, 10)
        return TENS[t] if o == 0 else ("ein" if o == 1 else ONES[o]) + "und" + TENS[t]
    if n < 1000:
        h, r = divmod(n, 100)
        return ("ein" if h == 1 else ONES[h]) + "hundert" + (zahl(r) if r else "")
    if n < 1000000:
        t, r = divmod(n, 1000)
        return ("ein" if t == 1 else zahl(t)) + "tausend" + (zahl(r) if r else "")
    return str(n)


def syllables(word):
    w = word.lower()
    w = re.sub(r"\d+", lambda m: zahl(int(m.group(0))), w)
    w = re.sub(r"[^a-zäöüß]", "", w)
    if not w:
        return 0
    # vowel groups; the common German double vowels count once
    return max(1, len(re.findall(r"(?:ei|ai|au|eu|äu|ie|aa|ee|oo|[aeiouyäöü])", w)))


def whisper_words(path, t0, t1):
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
    segs, _ = model.transcribe(path, language="de", beam_size=5, word_timestamps=True)
    words = [{"w": w.word.strip(), "s": float(w.start), "e": float(w.end)} for s in segs for w in (s.words or [])]
    return [w for w in words if w["s"] >= t0 - 0.05 and w["e"] <= t1 + 0.05]


_win = np.hanning(N)
_df = SR / N
_lo, _hi = int(600 / _df), int(3200 / _df)


def spacing(fr):
    """Pitch from the spacing of the harmonics between 600 and 3200 Hz (works with music underneath)."""
    spec = np.abs(np.fft.rfft(fr * _win))
    seg = np.log(spec[_lo:_hi] + 1e-6)
    r = seg - np.convolve(seg, np.ones(31) / 31, mode="same")
    r = r - r.mean()
    ac = np.correlate(r, r, "full")[len(r) - 1:]
    ac = ac / (ac[0] + 1e-9)
    a, b = int(70 / _df), int(360 / _df)
    m = ac[a:b]
    top = float(m.max())
    if top < 0.25:
        return 0.0
    for i in range(1, len(m) - 1):
        if m[i] >= 0.85 * top and m[i] >= m[i - 1] and m[i] >= m[i + 1]:
            return (i + a) * _df
    return (int(np.argmax(m)) + a) * _df


def lpc(frame, order):
    n = len(frame)
    r = np.array([np.dot(frame[: n - k], frame[k:]) for k in range(order + 1)])
    if r[0] <= 0:
        return None
    a = np.zeros(order + 1)
    a[0] = 1.0
    e = r[0]
    for i in range(1, order + 1):
        acc = r[i] + np.dot(a[1:i], r[i - 1:0:-1])
        k = -acc / e
        new = a.copy()
        new[1:i] = a[1:i] + k * a[i - 1:0:-1]
        new[i] = k
        a = new
        e *= 1 - k * k
        if e <= 0:
            return None
    return a


def formant_stats(path, words, t0):
    """Median F1-F4 and the vocal tract length they imply, over the louder half of the spoken frames (the vowels)."""
    sr = 11025
    x = vtlib.load_audio(path, sr)
    x = np.append(x[0], x[1:] - 0.97 * x[:-1])
    n, hop, order = int(0.025 * sr), int(0.010 * sr), 12
    win = np.hamming(n)
    frames = []
    for w in words:
        a, b = int(w["s"] * sr), int(w["e"] * sr)
        for i in range(a, b - n, hop):
            fr = x[i:i + n]
            frames.append((float(np.sqrt(np.mean(fr ** 2))), i))
    if not frames:
        return {}
    cut = np.median([f[0] for f in frames])
    rows = []
    for level, i in frames:
        if level < cut:
            continue
        a = lpc(x[i:i + n] * win, order)
        if a is None:
            continue
        rts = np.roots(a)
        rts = rts[np.imag(rts) > 0.01]
        f = np.arctan2(rts.imag, rts.real) * sr / (2 * np.pi)
        bw = -sr / np.pi * np.log(np.abs(rts) + 1e-12)
        fs = np.sort(f[(f > 150) & (f < sr / 2 - 150) & (bw < 500)])
        if len(fs) < 4:
            continue
        f1, f2, f3, f4 = fs[:4]
        if not (200 < f1 < 1100 and 700 < f2 < 3000 and 1700 < f3 < 4000 and 2800 < f4 < 5300):
            continue
        rows.append((f1, f2, f3, f4))
    if len(rows) < 20:
        return {"formant_frames": len(rows)}
    r = np.array(rows)
    m = np.array([0.5, 1.5, 2.5, 3.5])
    d = (r * m).sum(axis=1) / (m ** 2).sum()  # formant spacing per frame
    return {
        "formant_frames": len(rows),
        "f1": round(float(np.median(r[:, 0]))), "f2": round(float(np.median(r[:, 1]))),
        "f3": round(float(np.median(r[:, 2]))), "f4": round(float(np.median(r[:, 3]))),
        "vtl_cm": round(float(35000 / (2 * np.median(d))), 2),
    }


def profile(path, words=None, t0=0.0, t1=None):
    """words=None: no word times (a clean voice sample in any language); the whole file counts as speech
    and quiet frames are left out by level. Tempo and sentence values are then meaningless."""
    x = vtlib.load_audio(path, SR)
    if t1 is None:
        t1 = len(x) / SR
    gate = 0.02
    if words is None:
        words = [{"w": "", "s": t0, "e": t1}]
        fr_rms = np.sqrt(np.mean(x[: (len(x) // 1024) * 1024].reshape(-1, 1024) ** 2, axis=1))
        gate = 0.08 * float(np.percentile(fr_rms, 95))
    words = [w for w in words if w["s"] >= t0 - 0.05 and w["e"] <= t1 + 0.05 and w["e"] > w["s"]]
    out = {"file": os.path.basename(path), "words": len(words)}

    # ---- tempo and pauses (from the word times)
    span = words[-1]["e"] - words[0]["s"]
    syl = sum(syllables(w["w"]) for w in words)
    gaps = [words[i + 1]["s"] - words[i]["e"] for i in range(len(words) - 1)]
    pauses = [g for g in gaps if g >= 0.2]
    out.update({
        "span_s": round(span, 2),
        "wpm": round(len(words) / span * 60, 1),
        "syllables": syl,
        "syll_per_s": round(syl / span, 2),
        "artic_syll_per_s": round(syl / max(0.1, span - sum(pauses)), 2),
        "pause_share": round(sum(pauses) / span, 3),
        "pause_max_s": round(max(pauses), 2) if pauses else 0.0,
        "pause_mean_s": round(float(np.mean(pauses)), 2) if pauses else 0.0,
        "pauses": len(pauses),
    })

    # ---- pitch
    vals, per_word = [], []
    for w in words:
        a, b = int(w["s"] * SR), int(w["e"] * SR)
        ws = []
        for i in range(a, max(a + 1, b - N), N // 4):
            fr = x[i:i + N]
            if len(fr) < N or np.sqrt(np.mean(fr ** 2)) < gate:
                continue
            f0 = spacing(fr)
            if f0 > 0:
                vals.append(f0)
                ws.append(f0)
        per_word.append(float(np.median(ws)) if ws else 0.0)
    v = np.array(vals)
    med, p10, p90 = float(np.median(v)), float(np.percentile(v, 10)), float(np.percentile(v, 90))
    st = lambda a, b: 12 * np.log2(a / b)
    ends = [per_word[i] for i, w in enumerate(words) if re.search(r"[.!?]$", w["w"]) and per_word[i] > 0]
    pw = np.array([p for p in per_word if p > 0])
    out.update({
        "f0": round(med), "f0_p10": round(p10), "f0_p25": round(float(np.percentile(v, 25))),
        "f0_p75": round(float(np.percentile(v, 75))), "f0_p90": round(p90),
        "range_st": round(float(st(p90, p10)), 1),
        "up_st": round(float(st(p90, med)), 1), "down_st": round(float(st(med, p10)), 1),
        "word_sd_st": round(float(np.std(12 * np.log2(pw / med))), 2),
        "sentence_end_hz": round(float(np.median(ends))) if ends else 0,
        "sentence_end_fall_st": round(float(st(med, np.median(ends))), 1) if ends else 0.0,
        "sentences": len(ends),
    })

    # ---- timbre: average spectrum while words are spoken
    nf, hop = 2048, 512
    win = np.hanning(nf)
    acc, cnt, lev = np.zeros(nf // 2 + 1), 0, []
    for w in words:
        a, b = int(w["s"] * SR), int(w["e"] * SR)
        for i in range(a, b - nf, hop):
            fr = x[i:i + nf]
            if np.sqrt(np.mean(fr ** 2)) < gate * 0.5:
                continue
            acc += np.abs(np.fft.rfft(fr * win)) ** 2
            cnt += 1
        for i in range(a, b - 1102, 1102):  # 50 ms level steps
            lev.append(10 * np.log10(np.mean(x[i:i + 1102] ** 2) + 1e-12))
    ps = acc / max(1, cnt)
    fr_ = np.fft.rfftfreq(nf, 1 / SR)
    band = lambda a, b: float(ps[(fr_ >= a) & (fr_ < b)].sum())
    tot = band(300, 8000)
    db = lambda p: round(float(10 * np.log10(p / tot + 1e-12)), 1)
    sel = (fr_ >= 300) & (fr_ < 8000)
    out.update({
        "band_300_1000": db(band(300, 1000)), "band_1000_2000": db(band(1000, 2000)),
        "band_2000_4000": db(band(2000, 4000)), "band_4000_6000": db(band(4000, 6000)),
        "band_6000_8000": db(band(6000, 8000)),
        "bright_db": round(float(10 * np.log10(band(2000, 8000) / band(300, 2000))), 1),
        "presence_db": round(float(10 * np.log10(band(2000, 4000) / band(300, 2000))), 1),
        "centroid_hz": round(float((ps[sel] * fr_[sel]).sum() / ps[sel].sum())),
        "bass_db": round(float(10 * np.log10(band(60, 300) / tot)), 1),
        "level_spread_db": round(float(np.percentile(lev, 90) - np.percentile(lev, 10)), 1),
    })
    out.update(formant_stats(path, words, t0))
    return out


def main():
    args = sys.argv[1:]
    audio, out = args[0], args[1]
    opt = dict(zip(args[2::2], args[3::2]))
    t0 = float(opt.get("--t0", 0))
    t1 = float(opt["--t1"]) if "--t1" in opt else None
    if "--words" in opt:
        words = json.load(open(opt["--words"], encoding="utf-8"))["words"]
    else:
        words = whisper_words(audio, t0, t1 if t1 is not None else 1e9)
    p = profile(audio, words, t0, t1)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    json.dump({"profile": p, "words": words}, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps(p, ensure_ascii=False))


if __name__ == "__main__":
    main()
