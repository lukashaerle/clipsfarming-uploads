"""Listen to a video's sound track as far as measuring allows.

    python -I audio_probe.py <video_or_audio_file> <out_dir>

Prints stream info, a Whisper transcript with word times, a loudness curve, the speaking voice's pitch,
a tempo estimate, a key estimate and the strongest sound events. Writes spectrogram PNGs and
<out_dir>/probe.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import av  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import vtlib  # noqa: E402

SR = 22050
NFFT = 2048
HOP = 512


def stft_mag(x):
    win = np.hanning(NFFT).astype(np.float32)
    n = 1 + (len(x) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    return np.abs(np.fft.rfft(x[idx] * win, axis=1)).astype(np.float32)  # (frames, bins)


def spectrogram_png(mag, t0, t1, path):
    fps = SR / HOP
    a, b = int(t0 * fps), min(mag.shape[0], int(t1 * fps))
    seg = mag[a:b]
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    rows = 420
    edges = np.geomspace(45, 9000, rows + 1)
    img = np.zeros((rows, seg.shape[0]), dtype=np.float32)
    for r in range(rows):
        sel = (freqs >= edges[r]) & (freqs < edges[r + 1])
        if not sel.any():
            sel = np.zeros_like(freqs, dtype=bool)
            sel[np.argmin(np.abs(freqs - edges[r]))] = True
        img[rows - 1 - r] = seg[:, sel].max(axis=1)
    db = 20 * np.log10(img + 1e-6)
    db = np.clip((db - db.max() + 75) / 75, 0, 1)
    scale = 2
    rgb = np.stack([db ** 0.8 * 255, db ** 1.6 * 230, db ** 3 * 255], axis=2).astype(np.uint8)
    im = Image.fromarray(rgb).resize((seg.shape[0] * scale // 1, rows), Image.BILINEAR)
    canvas = Image.new("RGB", (im.width + 46, rows + 22), (12, 12, 16))
    canvas.paste(im, (46, 0))
    d = ImageDraw.Draw(canvas)
    for f in (50, 100, 200, 400, 800, 1600, 3200, 6400):
        y = rows - 1 - int(np.searchsorted(edges, f))
        d.line([(40, y), (46, y)], fill=(200, 200, 200))
        d.text((2, y - 6), str(f), fill=(200, 200, 200))
    sec = int(np.ceil(t0))
    while sec <= t1:
        xpix = 46 + int((sec - t0) * fps * scale)
        d.line([(xpix, rows), (xpix, rows + 5)], fill=(200, 200, 200))
        if sec % 2 == 0:
            d.text((xpix - 6, rows + 7), str(sec), fill=(200, 200, 200))
        sec += 1
    canvas.save(path)


def key_estimate(mag):
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    sel = (freqs > 60) & (freqs < 2000)
    pc = (np.round(12 * np.log2(freqs[sel] / 440.0)).astype(int) + 9) % 12  # 0 = C
    chroma = np.zeros(12)
    energy = (mag[:, sel] ** 2).mean(axis=0)
    for k in range(12):
        chroma[k] = energy[pc == k].sum()
    chroma /= chroma.sum() + 1e-12
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"]
    best = []
    for k in range(12):
        best.append((float(np.corrcoef(np.roll(major, k), chroma)[0, 1]), names[k] + "-Dur"))
        best.append((float(np.corrcoef(np.roll(minor, k), chroma)[0, 1]), names[k] + "-Moll"))
    best.sort(reverse=True)
    return [(n, round(c, 2)) for c, n in best[:3]], {names[k]: round(float(chroma[k]), 3) for k in range(12)}


def main():
    src, out = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    cont = av.open(src)
    info = {"duration": float(cont.duration or 0) / 1e6, "streams": []}
    for s in cont.streams:
        row = {"type": s.type, "codec": s.codec_context.name}
        if s.type == "audio":
            row.update(rate=s.codec_context.sample_rate, channels=s.codec_context.channels, bit_rate=s.bit_rate)
        if s.type == "video":
            row.update(width=s.codec_context.width, height=s.codec_context.height, fps=float(s.average_rate or 0))
        info["streams"].append(row)
    cont.close()
    print("INFO", json.dumps(info))

    x = vtlib.load_audio(src, SR)
    dur = len(x) / SR
    vtlib.save_wav(os.path.join(out, "audio_22k.wav"), x / max(1e-6, float(np.max(np.abs(x)))) * 0.95, SR)

    # loudness curve, 0.5 s steps
    step = SR // 2
    n = len(x) // step
    rms = np.sqrt(np.mean(x[: n * step].reshape(n, step) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    print("LOUDNESS_dB_per_0.5s", " ".join(str(int(round(v))) for v in db))

    mag = stft_mag(x)
    fps = SR / HOP
    for i, (a, b) in enumerate([(0, 22), (22, 44), (44, dur)]):
        spectrogram_png(mag, a, b, os.path.join(out, f"spec_{i + 1}.png"))

    # onsets: positive spectral flux
    logm = np.log1p(30 * mag)
    flux = np.maximum(0, np.diff(logm, axis=0)).sum(axis=1)
    flux = flux - np.convolve(flux, np.ones(int(fps)) / int(fps), mode="same")
    flux = np.maximum(0, flux)
    # tempo from autocorrelation of the onset envelope
    f = flux - flux.mean()
    ac = np.correlate(f, f, "full")[len(f) - 1:]
    cands = []
    for bpm in range(50, 201):
        lag = 60.0 / bpm * fps
        lo = int(np.floor(lag))
        w = lag - lo
        val = ac[lo] * (1 - w) + ac[lo + 1] * w
        cands.append((float(val / (ac[0] + 1e-9)), bpm))
    cands.sort(reverse=True)
    print("TEMPO_candidates_bpm(strength)", [(b, round(v, 3)) for v, b in cands[:8]])
    # strongest events
    thr = np.percentile(flux, 98.5)
    peaks = [i for i in range(1, len(flux) - 1) if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]]
    ev = []
    for i in peaks:
        t = round(i / fps, 2)
        if not ev or t - ev[-1][0] > 0.25:
            ev.append((t, round(float(flux[i] / flux.max()), 2)))
    print("EVENTS(time,strength)", ev)

    key, chroma = key_estimate(mag)
    print("KEY_guess", key)
    print("CHROMA", chroma)

    # band energies over time (bass / mid / high) per second
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    bands = {"bass<150": freqs < 150, "mid150-2k": (freqs >= 150) & (freqs < 2000), "high>2k": freqs >= 2000}
    sec_frames = int(fps)
    for name, sel in bands.items():
        e = (mag[:, sel] ** 2).sum(axis=1)
        k = len(e) // sec_frames
        per = 10 * np.log10(e[: k * sec_frames].reshape(k, sec_frames).mean(axis=1) + 1e-9)
        print("BAND", name, " ".join(str(int(round(v))) for v in per))

    # speech
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
    segs, winfo = model.transcribe(src, language="de", beam_size=5, word_timestamps=True, vad_filter=False)
    words = []
    print("WHISPER language", winfo.language, "duration", round(winfo.duration, 1))
    for s in segs:
        print("SEG", round(s.start, 2), round(s.end, 2), "nospeech", round(s.no_speech_prob, 2), "logprob", round(s.avg_logprob, 2), "|", s.text.strip())
        for w in s.words or []:
            words.append({"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2), "p": round(w.probability, 2)})
    if words:
        print("WORDS", " ".join(f"{w['w']}@{w['s']}" for w in words))
        total = sum(w["e"] - w["s"] for w in words)
        print("SPEECH words", len(words), "first", words[0]["s"], "last", words[-1]["e"], "spoken_sec", round(total, 1),
              "words_per_min", round(len(words) / (words[-1]["e"] - words[0]["s"]) * 60))
        # pitch of the voice: only inside words
        f0s = []
        for w in words:
            a, b = int(w["s"] * SR), int(w["e"] * SR)
            if b - a > int(0.12 * SR):
                f0, _ = vtlib.f0_stats(x[a:b], SR)
                if f0 > 0:
                    f0s.append(f0)
        if f0s:
            print("VOICE_f0 median", round(float(np.median(f0s))), "p10", round(float(np.percentile(f0s, 10))), "p90", round(float(np.percentile(f0s, 90))), "n", len(f0s))
        gaps = [(round(words[i]["e"], 2), round(words[i + 1]["s"] - words[i]["e"], 2)) for i in range(len(words) - 1) if words[i + 1]["s"] - words[i]["e"] > 0.6]
        print("PAUSES(after,length)", gaps)
    with open(os.path.join(out, "probe.json"), "w", encoding="utf-8") as fh:
        json.dump({"info": info, "words": words, "events": ev, "key": key}, fh, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
