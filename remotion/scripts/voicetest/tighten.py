"""Bring a narration to a steady flow: shorten long pauses, speed it up slightly if needed, even out the level.

    python -I tighten.py <in audio> <out.mp3> [longest pause in s = 0.30] [target length of the speech in s = 0 (off)] [most speed-up = 1.15] [json with word times] [fixed tempo factor]

With word times (the json voice_profile.py writes) the pauses are found between the words, which also works
when the voice breathes audibly in a pause. Without them, pauses are found by level alone.

Only our own generated narration goes through this. The pitch and the sound of the voice stay as they are:
pauses are cut, the tempo change keeps the pitch (ffmpeg atempo), and a gentle compressor evens out the level.
Prints what was done so it can be stated next to the sample.
"""
import os
import sys
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import av  # noqa: E402
import numpy as np  # noqa: E402

import vtlib  # noqa: E402

SR = 48000


def run_filters(x, chain, sr=SR):
    """Send mono float samples through a chain of ffmpeg audio filters: [(name, args), ...]."""
    g = av.filter.Graph()
    src = g.add_abuffer(sample_rate=sr, format="flt", layout="mono", time_base=Fraction(1, sr))
    last = src
    for name, args in list(chain) + [("aformat", "sample_fmts=flt:channel_layouts=mono")]:
        f = g.add(name, args)
        last.link_to(f)
        last = f
    sink = g.add("abuffersink")
    last.link_to(sink)
    g.configure()
    out = []

    def drain():
        while True:
            try:
                out.append(sink.pull().to_ndarray().reshape(-1))
            except (av.error.BlockingIOError, av.error.EOFError):
                return

    step = 4096
    for i in range(0, len(x), step):
        fr = av.AudioFrame.from_ndarray(np.ascontiguousarray(x[i:i + step], dtype=np.float32).reshape(1, -1), format="flt", layout="mono")
        fr.sample_rate = sr
        fr.time_base = Fraction(1, sr)
        fr.pts = i
        src.push(fr)
        drain()
    src.push(None)
    drain()
    return np.concatenate(out).astype(np.float32)


def speech_mask(x, sr=SR, win_s=0.01, floor_db=-38.0):
    """True for every 10 ms window that carries speech (level relative to the loud parts)."""
    win = int(win_s * sr)
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    ref = np.percentile(rms, 95)
    return 20 * np.log10(rms / ref + 1e-12) > floor_db, win


def shorten_pauses(x, longest, sr=SR):
    act, win = speech_mask(x, sr)
    idx = np.where(act)[0]
    if len(idx) == 0:
        return x, 0, 0.0
    a, b = idx[0], idx[-1] + 1
    keep, cut_total, cuts = [], 0.0, 0
    i = a
    fade = int(0.012 * sr)
    pieces = []
    while i < b:
        if act[i]:
            j = i
            while j < b and act[j]:
                j += 1
            pieces.append(("speech", i, j))
        else:
            j = i
            while j < b and not act[j]:
                j += 1
            pieces.append(("pause", i, j))
        i = j
    out = [x[max(0, a * win - int(0.03 * sr)): a * win]]
    for kind, i, j in pieces:
        seg = x[i * win: j * win]
        if kind == "pause" and (j - i) * win / sr > longest:
            want = int(longest * sr)
            h = want // 2
            head, tail = seg[:h].copy(), seg[len(seg) - (want - h):].copy()
            head[-fade:] *= np.linspace(1, 0, fade)
            tail[:fade] *= np.linspace(0, 1, fade)
            cut_total += (len(seg) - want) / sr
            cuts += 1
            seg = np.concatenate([head, tail])
        out.append(seg)
    out.append(x[b * win: min(len(x), b * win + int(0.08 * sr))])
    return np.concatenate(out), cuts, cut_total


def shorten_pauses_words(x, words, longest, sr=SR):
    """Between two words, find the quiet stretch and cut its middle so that `longest` seconds remain."""
    win = int(0.01 * sr)
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms / np.percentile(rms, 95) + 1e-12) < -22.0
    x = x.copy()
    fade = int(0.012 * sr)
    cuts = []
    for a, b in zip(words[:-1], words[1:]):
        if b["s"] - a["e"] < 0.25:
            continue
        i0, i1 = max(0, int((a["e"] - 0.10) / 0.01)), min(n, int((b["s"] + 0.10) / 0.01))
        best, run0 = (0, 0), None
        for i in range(i0, i1 + 1):
            q = i < i1 and quiet[i]
            if q and run0 is None:
                run0 = i
            if not q and run0 is not None:
                if i - run0 > best[1] - best[0]:
                    best = (run0, i)
                run0 = None
        length = (best[1] - best[0]) * 0.01
        if length <= longest + 0.02:
            continue
        drop = length - longest
        c0 = int((best[0] * 0.01 + longest / 2) * sr)
        c1 = c0 + int(drop * sr)
        x[c0 - fade:c0] *= np.linspace(1, 0, fade)
        x[c1:c1 + fade] *= np.linspace(0, 1, fade)
        cuts.append((c0, c1))
    out, pos = [], max(0, int((words[0]["s"] - 0.06) * sr))
    for c0, c1 in cuts:
        out.append(x[pos:c0])
        pos = c1
    out.append(x[pos:min(len(x), int((words[-1]["e"] + 0.18) * sr))])
    return np.concatenate(out), len(cuts), sum(c1 - c0 for c0, c1 in cuts) / sr


def main():
    src, dst = sys.argv[1:3]
    longest = float(sys.argv[3]) if len(sys.argv) > 3 else 0.30
    target = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    most = float(sys.argv[5]) if len(sys.argv) > 5 else 1.15
    x = vtlib.load_audio(src, SR)
    if len(sys.argv) > 6:
        import json
        words = json.load(open(sys.argv[6], encoding="utf-8"))["words"]
        y, cuts, cut_s = shorten_pauses_words(x, words, longest)
        span = (words[-1]["e"] - words[0]["s"]) - cut_s
    else:
        y, cuts, cut_s = shorten_pauses(x, longest)
        act, win = speech_mask(y)
        idx = np.where(act)[0]
        span = (idx[-1] + 1 - idx[0]) * win / SR
    factor = 1.0
    if len(sys.argv) > 7:
        factor = float(sys.argv[7])
    elif target > 0 and span > target:
        factor = min(most, span / target)
    if factor > 1.005:
        y = run_filters(y, [("atempo", "%.4f" % factor)])
    y = run_filters(y, [("highpass", "f=70"), ("acompressor", "threshold=-19dB:ratio=2:attack=15:release=180:makeup=1.5dB:knee=5")])
    y = vtlib.normalize(y, -18.0, SR)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    vtlib.save_mp3(dst, y, SR, 192000)
    print("%s: %d pauses shortened (-%.2f s), speech %.2f s -> %.2f s, tempo x%.3f" % (os.path.basename(src), cuts, cut_s, span, span / factor, factor))


if __name__ == "__main__":
    main()
