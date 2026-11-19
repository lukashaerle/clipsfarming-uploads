"""Quiet, dark underscore for the explainer videos: sustained chords, a soft slow pulse, no melody.

    python -I ambient.py <out_basename> [length in s = 65.5] [generic]

"generic" stretches the arc to the given length and leaves out the stop line, for videos built from a spec.

Own composition in D minor, built entirely in code. It is meant to sit far under a narrator.
The arc follows the slot template of the videos:
  0-20 s   the problem: dark drone, soft pulse once a second
  20-24 s  the turn: the pulse and the bass leave, the chord opens
  24-32 s  build: the filter opens slowly, a faint swell of air
  32-34 s  the stop line: everything cuts, only the reverb rings out
  34-50 s  the plan: the pulse is back, warmer chords
  50-62 s  the payoff: one more voice in the chord, a little brighter
  62 s     the closing line: one open chord that fades
Writes <out_basename>.mp3 and <out_basename>.wav and prints levels per part.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import darkbeat as db  # noqa: E402  (filters, reverb and the file writers)

SR = db.SR
rng = np.random.default_rng(20261118)

# name: (bass note, chord notes) in Hz
VOICE = {
    "Dm": (73.42, [146.83, 220.00, 293.66, 349.23]),
    "Bb": (58.27, [116.54, 174.61, 233.08, 293.66]),
    "Gm": (49.00, [98.00, 196.00, 233.08, 293.66]),
    "Asus": (55.00, [110.00, 164.81, 220.00, 293.66]),
    "Bb9": (58.27, [174.61, 233.08, 261.63, 349.23]),
    "F": (87.31, [130.81, 174.61, 220.00, 349.23]),
    "C": (65.41, [130.81, 196.00, 261.63, 329.63]),
    "Dm8": (73.42, [146.83, 220.00, 293.66, 349.23, 440.00]),
    "D5": (73.42, [146.83, 220.00, 293.66, 440.00]),
}
STOP = (32.0, 34.0)
# (start, end, chord, bass on?)
PLAN = [(0, 8, "Dm", True), (8, 12, "Bb", True), (12, 16, "Gm", True), (16, 20, "Asus", True), (20, 24, "Bb9", False),
        (24, 28, "F", True), (28, 32, "C", True),
        (34, 38, "Dm", True), (38, 42, "Bb", True), (42, 46, "F", True), (46, 50, "C", True),
        (50, 54, "Dm8", True), (54, 58, "Bb", True), (58, 62, "C", True), (62, 66, "D5", True)]
CUTOFF = [(0, 260), (2.5, 620), (8, 760), (12, 700), (16, 820), (19.5, 560), (20.5, 1150), (24, 1050), (28, 1400), (31.6, 2300),
          (32.0, 400), (34.0, 700), (34.8, 1250), (42, 1350), (46, 1500), (49.6, 2100), (50.2, 2000), (58, 2100), (62, 1700), (66, 500)]
F = 1.0   # time stretch of the arc (1.0 = the pilot)
G = dict(pad=1.0, bass=0.30, pulse=0.55, air=0.016, swell=0.05, reverb=0.42)


def auto(points, t):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def pad(freqs, t0, t1, attack, release):
    """Detuned, low-passed chord with slow edges. Long attacks start before t0, so the chord is there on the bar line."""
    a0 = t0 - attack / 2 if attack > 0.6 else t0
    b1 = t1 + release / 2 if release > 0.6 else t1 + release
    a0 = max(0.0, a0)
    n = int((b1 - a0) * SR)
    t = a0 + np.arange(n) / SR
    inv4 = auto(CUTOFF, t) ** -4.0
    left, right = np.zeros(n), np.zeros(n)
    for f0 in freqs:
        for cents, tgt in ((-7.0, left), (7.0, right)):
            f = f0 * 2 ** (cents / 1200)
            ph0 = rng.uniform(0, 6.28)
            k = 1
            while k * f < 5200 and k <= 22:
                g = (1.0 / k) / np.sqrt(1 + (k * f) ** 4 * inv4)
                tgt += g * np.sin(2 * np.pi * k * f * (t - a0) + ph0 * k)
                k += 1
    env = np.ones(n)
    na, nr = int(attack * SR), int(release * SR)
    env[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    env[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    mov_l = 1 + 0.10 * np.sin(2 * np.pi * 0.17 * t)
    mov_r = 1 + 0.10 * np.sin(2 * np.pi * 0.17 * t + 2.1)
    return a0, left * env * mov_l / len(freqs), right * env * mov_r / len(freqs)


def bass(freq, t0, t1):
    n = int((t1 - t0 + 1.0) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t + 0.4) + 0.12 * np.sin(2 * np.pi * 3 * freq * t + 1.1)
    env = np.ones(n)
    na = int(1.0 * SR)
    env[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    env[-na:] *= np.cos(np.linspace(0, np.pi / 2, na)) ** 2
    return s * env


def thud(vel):
    """Soft, low heartbeat: no click, with a little body higher up so small speakers still hint at it."""
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 44 + 20 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.exp(-t / 0.24)
    knock = np.sin(2 * np.pi * 150 * t) * np.exp(-t / 0.035) * 0.22
    return db.fade((body + knock) * np.minimum(1, t / 0.008) * vel, 0.0, 0.05)


def band(x, lo, hi):
    return db.fft_filter(x, lambda f: (1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 6)) * (1 / np.sqrt(1 + (f / hi) ** 6)))


def scaled_arc(length):
    """The arc of the pilot, stretched to `length` seconds, without the stop line (generic videos)."""
    global PLAN, CUTOFF, STOP, F
    f = length / 65.5
    F = f
    plan = [(0, 8, "Dm", True), (8, 12, "Bb", True), (12, 16, "Gm", True), (16, 20, "Asus", True), (20, 24, "Bb9", False),
            (24, 28, "F", True), (28, 33, "C", True), (33, 38, "Dm", True), (38, 42, "Bb", True), (42, 46, "F", True), (46, 50, "C", True),
            (50, 54, "Dm8", True), (54, 58, "Bb", True), (58, 62, "C", True), (62, 66, "D5", True)]
    PLAN = [(round(a * f, 3), round(b * f, 3), c, h) for a, b, c, h in plan]
    PLAN[-1] = (PLAN[-1][0], length + 1.0, PLAN[-1][2], PLAN[-1][3])
    cut = [(0, 260), (2.5, 620), (8, 760), (12, 700), (16, 820), (19.5, 560), (20.5, 1150), (24, 1050), (28, 1400), (33, 1300),
           (42, 1350), (46, 1500), (49.6, 2100), (50.2, 2000), (58, 2100), (62, 1700), (66, 500)]
    CUTOFF = [(a * f, v) for a, v in cut]
    STOP = (-10.0, -9.0)


def build(length):
    n = int(length * SR)
    tt = np.arange(n) / SR
    dry_l, dry_r = np.zeros(n), np.zeros(n)
    send_l, send_r = np.zeros(n), np.zeros(n)

    def put(sig_l, sig_r, t0, gain, send=0.0):
        i = int(round(t0 * SR))
        if i >= n:
            return
        m = min(len(sig_l), n - i)
        dry_l[i:i + m] += sig_l[:m] * gain
        dry_r[i:i + m] += sig_r[:m] * gain
        send_l[i:i + m] += sig_l[:m] * gain * send
        send_r[i:i + m] += sig_r[:m] * gain * send

    # ---- chords and bass
    level = [(a * F if a > 2 else a, v) for a, v in [(0, 0.0), (1.8, 0.8), (20, 0.85), (24, 0.8), (31.8, 1.0), (34.0, 0.9), (50, 1.0), (62, 1.0), (66, 0.7)]]
    for t0, t1, name, has_bass in PLAN:
        root, notes = VOICE[name]
        attack = 0.5 if t0 in (0, STOP[1]) else 1.6          # after silence the chord comes in on the bar line
        release = 0.35 if t1 == STOP[0] else (3.0 if t1 >= 66 else 1.6)   # hard stop before the stop line
        a0, pl, pr = pad(notes, t0, t1, attack, release)
        g = auto(level, a0 + np.arange(len(pl)) / SR) * G["pad"]
        put(pl * g, pr * g, a0, 1.0, send=1.0)
        if has_bass:
            b = bass(root, t0, t1) * G["bass"]
            if t1 == STOP[0]:
                k = int((t1 - t0) * SR)
                b = db.fade(b[:k], 0.0, 0.25)
            put(b, b, max(0.0, t0 - 0.5) if t0 not in (0, STOP[1]) else t0, 1.0)

    # ---- pulse: once a second, the bar lines a little stronger; silent in the turn and on the stop line
    for sec in range(0, int(length - 2.5)):
        if 20 * F <= sec < 24 * F or STOP[0] <= sec < STOP[1]:
            continue
        vel = 1.0 if sec % 2 == 0 else 0.5
        if sec < 4:
            vel *= 0.45 + 0.14 * sec          # fades in over the hook
        if 24 * F <= sec < 32 * F:
            vel *= 0.8 if sec % 2 == 0 else 0.0   # only the bar lines while it builds
        if sec >= 50 * F:
            vel *= 1.12
        if vel > 0:
            h = thud(vel) * G["pulse"]
            put(h, h, float(sec), 1.0, send=0.18)

    # ---- air: a breath of high noise, different left and right
    air_level = auto([(a * F if a > 2 else a, v) for a, v in [(0, 0.0), (2, 0.7), (20, 0.8), (24, 1.0), (31.9, 1.6), (32.0, 0.25), (34.0, 0.25), (34.6, 0.9), (50, 1.2), (62, 1.0), (66, 0.3)]], tt)
    for ch, ph in ((0, 0.0), (1, 1.7)):
        a = band(rng.standard_normal(n).astype(np.float32), 3500, 8000) * (0.65 + 0.35 * np.sin(2 * np.pi * 0.11 * tt + ph)) * air_level * G["air"]
        if ch == 0:
            dry_l += a
        else:
            dry_r += a

    # ---- a faint swell of air into the stop line, then nothing
    k = int(4.0 * SR)
    x = np.arange(k) / k
    sw = band(rng.standard_normal(k).astype(np.float32), 500, 5000) * x ** 2.4
    sw = db.fade(sw, 0.05, 0.025) * G["swell"]
    if STOP[0] > 4:
        put(sw, sw, STOP[0] - 4.0, 1.0, send=0.6)
    # ---- reverse breaths into the plan and the payoff
    for t_hit in ((STOP[1] if STOP[0] > 0 else 33 * F), 50.0 * F):
        s = db.swell(1.3) * 0.055
        put(s, s, t_hit - 1.3, 1.0, send=0.5)

    wet_l = db.convolve(send_l.astype(np.float32), db.make_ir(11, 3.6))
    wet_r = db.convolve(send_r.astype(np.float32), db.make_ir(12, 3.6))
    left = db.highpass((dry_l + wet_l * G["reverb"]).astype(np.float32), 30)
    right = db.highpass((dry_r + wet_r * G["reverb"]).astype(np.float32), 30)
    return left, right


def main():
    base = sys.argv[1]
    length = float(sys.argv[2]) if len(sys.argv) > 2 else 65.5
    if len(sys.argv) > 3 and sys.argv[3] == "generic":
        scaled_arc(length)
    left, right = build(length)
    # level: the plan section sets the reference, peaks stay well below full scale
    i0, i1 = int(34 * SR), int(50 * SR)
    g = (10 ** (-21 / 20.0)) / np.sqrt(np.mean(left[i0:i1] ** 2) + 1e-12)
    left, right = left * g, right * g
    peak = max(float(np.max(np.abs(left))), float(np.max(np.abs(right))))
    if peak > 0.85:
        left, right = left * (0.85 / peak), right * (0.85 / peak)
    fi = int(0.01 * SR)
    left[:fi] *= np.linspace(0, 1, fi)
    right[:fi] *= np.linspace(0, 1, fi)
    os.makedirs(os.path.dirname(os.path.abspath(base)), exist_ok=True)
    db.save_wav(base + ".wav", left.astype(np.float32), right.astype(np.float32))
    db.save_mp3(base + ".mp3", left.astype(np.float32), right.astype(np.float32))
    print("length %.1f s | peak %.2f | RMS %.1f dBFS | left/right correlation %.2f" % (len(left) / SR, max(np.max(np.abs(left)), np.max(np.abs(right))), db.db(left), float(np.corrcoef(left, right)[0, 1])))
    for name, a, b in (("problem", 0, 20), ("turn", 20, 24), ("build", 24, 32), ("stop", 32, 34), ("plan", 34, 50), ("payoff", 50, 62), ("close", 62, 65)):
        a, b = a * F, min(b * F, len(left) / SR)
        seg = left[int(a * SR):int(b * SR)]
        if len(seg) < SR // 2:
            continue
        spec = np.abs(np.fft.rfft(seg)) ** 2
        f = np.fft.rfftfreq(len(seg), 1 / SR)
        tot = spec[(f > 30)].sum() + 1e-12
        share = lambda lo, hi: 10 * np.log10(spec[(f >= lo) & (f < hi)].sum() / tot + 1e-12)
        print("  %-8s %4.0f-%2.0f s  RMS %6.1f dBFS | 30-120 Hz %5.1f dB, 120-250 %5.1f, 250-2000 %5.1f, above 2000 %5.1f" % (name, a, b, db.db(seg), share(30, 120), share(120, 250), share(250, 2000), share(2000, 20000)))
    print("written", base + ".mp3")


if __name__ == "__main__":
    main()
