"""Original dark, tense underscore for the motivation videos, built entirely in code.

    python -I darkbeat.py <out_basename>

Own composition: D minor, 85 BPM, 23 bars (about 65 s).
Arc: intro (2 bars) - groove (6) - breakdown (4) - build (4) - stop (1) - finale (5) - outro (1).
Writes <out_basename>.mp3 (192 kbit/s stereo) and <out_basename>.wav, and prints levels per section.
"""
import os
import sys
import wave
from fractions import Fraction

import av
import numpy as np

SR = 48000
BPM = 85.0
BEAT = 60.0 / BPM
EIGHTH = BEAT / 2
SIXTEENTH = BEAT / 4
BAR = 4 * BEAT
NBARS = 23
TAIL = 2.2
N = int((NBARS * BAR + TAIL) * SR)
rng = np.random.default_rng(11)

SECTIONS = [("intro", 0, 2), ("groove", 2, 8), ("break", 8, 12), ("build", 12, 16), ("stop", 16, 17), ("finale", 17, 22), ("outro", 22, 23)]
CHORDS = {
    "Dm": dict(sub=73.42, pad=[146.83, 220.00, 293.66, 349.23], motif=[349.23, 329.63, 293.66]),
    "Bb": dict(sub=58.27, pad=[116.54, 174.61, 293.66, 349.23], motif=[349.23, 293.66, 233.08]),
    "Gm": dict(sub=49.00, pad=[98.00, 196.00, 233.08, 293.66], motif=[392.00, 293.66, 233.08]),
    "A": dict(sub=55.00, pad=[110.00, 164.81, 220.00, 277.18], motif=[329.63, 277.18, 220.00]),
    "Asus": dict(sub=55.00, pad=[110.00, 164.81, 220.00, 293.66], motif=[329.63, 293.66, 220.00]),
}
PROG = (["Dm", "Dm"] + ["Dm", "Bb", "Gm", "A", "Dm", "Bb"] + ["Gm", "A", "Dm", "Bb"] + ["Gm", "A", "Dm", "Bb"]
        + ["Asus"] + ["Dm", "Bb", "Gm", "A", "Dm"] + ["Dm"])

# mix levels
G = dict(kick=0.80, sub=0.44, heart=0.34, snare=0.42, hat=0.055, tick=0.17, pad=0.20, pulse=0.22, strings=0.13,
         piano=0.38, impact=0.70, riser=0.26, swell=0.16, drone=0.10, reverb=0.60)


def section_of(bar):
    for name, a, b in SECTIONS:
        if a <= bar < b:
            return name
    return "outro"


def bt(bar, eighth=0.0):
    return bar * BAR + eighth * EIGHTH


class Bus:
    def __init__(self):
        self.l = np.zeros(N, np.float32)
        self.r = np.zeros(N, np.float32)

    def add(self, sig, t0, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if i >= N or i < 0:
            return
        sig = sig[: N - i]
        gl = gain * np.cos((pan + 1) * np.pi / 4) * 1.4142
        gr = gain * np.sin((pan + 1) * np.pi / 4) * 1.4142
        self.l[i:i + len(sig)] += sig * gl
        self.r[i:i + len(sig)] += sig * gr

    def add_st(self, left, right, t0, gain=1.0):
        i = int(round(t0 * SR))
        if i >= N or i < 0:
            return
        left, right = left[: N - i], right[: N - i]
        self.l[i:i + len(left)] += left * gain
        self.r[i:i + len(right)] += right * gain


def fft_filter(x, gain_fn):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * gain_fn(f), len(x)).astype(np.float32)


def lowpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def fade(x, a=0.004, r=0.02):
    na, nr = int(a * SR), int(r * SR)
    y = x.copy()
    if na > 0:
        y[:na] *= np.linspace(0, 1, na)
    if nr > 0:
        y[-nr:] *= np.linspace(1, 0, nr)
    return y


# ---------- instruments ----------
def kick(vel=1.0, f_hi=165.0, f_lo=47.0, decay=0.21):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / decay)
    click = highpass(rng.standard_normal(n).astype(np.float32), 2500) * np.exp(-t / 0.003) * 0.22
    return fade((np.tanh(2.4 * body) * 0.9 + click) * vel, 0.0005, 0.01).astype(np.float32)


def sub(freq, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.9 * np.exp(-t / 0.02))
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.008) * np.exp(-t / (dur * 0.55))
    s = np.sin(ph) + 0.25 * np.sin(2 * ph)
    return fade(np.tanh(2.6 * s * env) * 0.8 * vel, 0.001, 0.04).astype(np.float32)


def pluck(freq, dur=2.8, vel=1.0, bright=1.0):
    """Soft piano-like tone: decaying harmonics, the higher ones die faster, plus a short hammer noise."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    norm = 0.0
    for k in range(1, 16):
        fk = k * freq * np.sqrt(1 + 0.00035 * k * k)
        if fk > 9000:
            break
        amp = k ** -1.25 * bright ** (k - 1)
        tau = 1.7 / (1 + 0.33 * (k - 1))
        out += amp * np.sin(2 * np.pi * fk * t + 0.5 * k) * np.exp(-t / tau)
        norm += amp
    hammer = rng.standard_normal(n) * np.exp(-t / 0.006) * 0.05
    out = out / norm + hammer
    return fade(out * np.minimum(1, t / 0.004) * vel, 0.0, 0.08).astype(np.float32)


def sawtone(freq, dur, fc, attack=0.004, tau=None, release=0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    k = 1
    while k * freq < min(9000.0, fc * 5) and k <= 48:
        g = (1.0 / k) / np.sqrt(1 + ((k * freq) / fc) ** 4)
        out += g * np.sin(2 * np.pi * k * freq * t + 0.7 * k)
        k += 1
    env = np.minimum(1, t / attack)
    if tau:
        env = env * np.exp(-t / tau)
    return fade(out * env, 0.0, release).astype(np.float32)


def tick(high=True, vel=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    f = 2350.0 if high else 1760.0
    body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.011) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.005)
    click = rng.standard_normal(n) * np.exp(-t / 0.0012) * 0.5
    return fade((body + click) * vel, 0.0, 0.01).astype(np.float32)


def hat(vel=1.0, decay=0.022):
    n = int(0.1 * SR)
    t = np.arange(n) / SR
    return fade(highpass(rng.standard_normal(n).astype(np.float32), 7000) * np.exp(-t / decay) * vel, 0.0, 0.01)


def snare(vel=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = highpass(lowpass(rng.standard_normal(n).astype(np.float32), 5200), 900) * np.exp(-t / 0.085)
    body = np.sin(2 * np.pi * (185 + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.05)
    return fade((noise * 0.9 + body * 0.6) * vel, 0.0005, 0.02).astype(np.float32)


def impact(vel=1.0):
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    f = 38 + 80 * np.exp(-t / 0.05)
    boom = np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.75))
    crack = lowpass(rng.standard_normal(n).astype(np.float32), 1400) * np.exp(-t / 0.3) * 0.5
    return fade((boom * 0.85 + crack) * vel, 0.0005, 0.2).astype(np.float32)


def riser(dur, peak=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = t / dur
    noise = rng.standard_normal(n).astype(np.float32)
    low = lowpass(noise, 900)
    high = highpass(lowpass(noise, 9000), 2500)
    amp = x ** 2.2
    wob = 1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(4 + 14 * x ** 2) / SR)) * x
    tone_f = 180 * (7.0 ** x)
    tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * 0.35
    out = (low * (1 - x) * 1.6 + high * x * 1.1 + tone) * amp * wob
    return fade(out * peak, 0.05, 0.004).astype(np.float32)


def swell(dur=1.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = highpass(rng.standard_normal(n).astype(np.float32), 3000) * np.exp(-t / (dur / 4.2))
    return fade(s[::-1].copy(), 0.02, 0.003).astype(np.float32)


def pad_chord(freqs, t0, dur, fc_fn):
    """Detuned, low-passed chord; the filter cutoff follows fc_fn(time)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    inv4 = (1.0 / fc_fn(t0 + t)) ** 4
    left, right = np.zeros(n), np.zeros(n)
    for f0 in freqs:
        for cents, tgt in ((-6.0, left), (6.0, right)):
            f = f0 * 2 ** (cents / 1200)
            ph0 = rng.uniform(0, 6.28)
            k = 1
            while k * f < 4300 and k <= 26:
                g = (1.0 / k) / np.sqrt(1 + (k * f) ** 4 * inv4)
                tgt += g * np.sin(2 * np.pi * k * f * t + ph0 * k)
                k += 1
    a, r = int(0.38 * SR), int(0.5 * SR)
    env = np.ones(n)
    env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    env[-r:] = np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    mov_l = 1 + 0.08 * np.sin(2 * np.pi * 0.23 * (t0 + t))
    mov_r = 1 + 0.08 * np.sin(2 * np.pi * 0.23 * (t0 + t) + 1.9)
    return (left * env * mov_l / len(freqs)).astype(np.float32), (right * env * mov_r / len(freqs)).astype(np.float32)


def make_ir(seed, rt=2.9):
    n = int(rt * SR)
    t = np.arange(n) / SR
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-t / (rt / 6.9))
    ir = fft_filter(ir, lambda f: (1 / np.sqrt(1 + (f / 5200) ** 4)) * (1 / np.sqrt(1 + (190 / np.maximum(f, 1e-3)) ** 4)))
    ir = np.concatenate([np.zeros(int(0.018 * SR)), ir])
    return (ir / np.sqrt(np.sum(ir ** 2))).astype(np.float32)


def convolve(x, ir):
    n = len(x) + len(ir) - 1
    nf = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(ir, nf), nf)[: len(x)].astype(np.float32)


def lerp(a, b, x):
    return a + (b - a) * x


# ---------- arrangement ----------
def pad_cutoff(tt):
    """Filter cutoff of the pad over the whole piece (Hz)."""
    pts = [(0, 380), (bt(2), 950), (bt(8), 1150), (bt(8.5), 520), (bt(12), 760), (bt(16), 2100), (bt(16.2), 650),
           (bt(17) - 0.05, 2600), (bt(17), 3300), (bt(22), 3000), (bt(23), 900), (bt(23) + TAIL, 300)]
    xs, ys = zip(*pts)
    return np.interp(tt, xs, ys)


def build():
    drums, bass, music, keys, fx = Bus(), Bus(), Bus(), Bus(), Bus()
    send = Bus()
    kick_times = []

    def add_kick(t, vel=1.0):
        drums.add(kick(vel), t, G["kick"])
        kick_times.append((t, vel))

    for bar in range(NBARS):
        sec = section_of(bar)
        ch = CHORDS[PROG[bar]]
        prog_in = 0.0
        for name, a, b in SECTIONS:
            if name == sec:
                prog_in = (bar - a) / max(1, b - a)
        t0 = bt(bar)

        # pad
        if sec != "outro":
            pl, pr = pad_chord(ch["pad"], t0, BAR + 0.45, pad_cutoff)
            lvl = {"intro": 0.8, "groove": 1.0, "break": 0.9, "build": 1.0, "stop": 1.1, "finale": 1.15}[sec]
            music.add_st(pl, pr, t0, G["pad"] * lvl)
            send.add_st(pl, pr, t0, G["pad"] * lvl * 0.35)
        else:
            pl, pr = pad_chord(ch["pad"], t0, BAR + TAIL - 0.2, pad_cutoff)
            env = np.exp(-np.arange(len(pl)) / SR / 1.3)
            music.add_st(pl * env, pr * env, t0, G["pad"] * 1.1)
            send.add_st(pl * env, pr * env, t0, G["pad"] * 0.5)

        # low end and drums
        if sec == "intro":
            if bar == 0:
                x = impact(1.0)
                fx.add(x, 0.0, G["impact"])
                send.add(x, 0.0, G["impact"] * 0.35)
                bass.add(sub(ch["sub"], 2 * BAR, 0.75), 0.0, G["sub"])
            for q in range(4):
                v = 0.55 + 0.45 * ((bar * 4 + q) / 8)
                tk = tick(q % 2 == 0, v)
                drums.add(tk, bt(bar, q * 2), G["tick"], pan=-0.3 if q % 2 == 0 else 0.3)
                send.add(tk, bt(bar, q * 2), G["tick"] * 0.25)
        if sec == "groove":
            add_kick(t0, 1.0)
            add_kick(bt(bar, 4), 0.9)
            if bar % 2 == 1:
                add_kick(bt(bar, 7), 0.6)
            bass.add(sub(ch["sub"], BAR * 0.95, 0.9), t0, G["sub"])
            if bar == 2:
                x = impact(0.6)
                fx.add(x, t0, G["impact"])
                send.add(x, t0, G["impact"] * 0.3)
        if sec == "break":
            for e, v in ((0, 1.0), (1.15, 0.7)):  # heartbeat: lub-dub
                hb = lowpass(kick(v, 110, 44, 0.16), 220)
                drums.add(hb, bt(bar, e), G["heart"])
        if sec == "build":
            vel = lerp(0.72, 1.0, prog_in)
            pos = [0, 2, 4, 6] if bar < 15 else [0, 2, 4, 5, 6, 7]
            for e in pos:
                add_kick(bt(bar, e), vel)
            bass.add(sub(ch["sub"], BAR * 0.95, 0.85), t0, G["sub"])
            if bar == 15:
                for s in range(8, 16):  # snare roll in the second half
                    x = snare(lerp(0.25, 0.85, (s - 8) / 7))
                    drums.add(x, t0 + s * SIXTEENTH, G["snare"])
                    send.add(x, t0 + s * SIXTEENTH, G["snare"] * 0.25)
        if sec == "stop":
            x = impact(1.0)
            fx.add(x, t0, G["impact"])
            send.add(x, t0, G["impact"] * 0.5)
            for s in range(8, 15):
                x = snare(lerp(0.2, 0.9, (s - 8) / 6))
                drums.add(x, t0 + s * SIXTEENTH, G["snare"] * 0.9)
                send.add(x, t0 + s * SIXTEENTH, G["snare"] * 0.3)
        if sec == "finale":
            for e, v in ((0, 1.0), (3, 0.85), (6, 0.9)):
                add_kick(bt(bar, e), v)
            if bar % 2 == 0:
                add_kick(bt(bar, 7), 0.6)
            x = snare(1.0)
            drums.add(x, bt(bar, 4), G["snare"])
            send.add(x, bt(bar, 4), G["snare"] * 0.3)
            if bar == 21:
                for e, v in ((6.5, 0.6), (7, 0.75), (7.5, 0.9)):
                    x = snare(v)
                    drums.add(x, bt(bar, e), G["snare"])
            bass.add(sub(ch["sub"], 3 * EIGHTH * 0.98, 1.0), t0, G["sub"])
            bass.add(sub(ch["sub"], 3 * EIGHTH * 0.98, 0.8), bt(bar, 3), G["sub"])
            bass.add(sub(ch["sub"], 2 * EIGHTH * 0.98, 0.85), bt(bar, 6), G["sub"])
            if bar == 17:
                x = impact(1.0)
                fx.add(x, t0, G["impact"])
                send.add(x, t0, G["impact"] * 0.5)
        if sec == "outro":
            x = impact(1.0)
            fx.add(x, t0, G["impact"])
            send.add(x, t0, G["impact"] * 0.6)
            add_kick(t0, 1.0)
            bass.add(sub(ch["sub"], BAR + TAIL - 0.3, 1.0), t0, G["sub"])  # rings out into the final fade

        # ticking clock
        if sec in ("groove", "build", "finale"):
            for e in range(8):
                v = 1.0 if e % 2 == 0 else 0.7
                tk = tick(e % 2 == 0, v)
                drums.add(tk, bt(bar, e), G["tick"], pan=-0.35 if e % 2 == 0 else 0.35)
                send.add(tk, bt(bar, e), G["tick"] * 0.2)
        if sec == "break":
            steps = range(0, 8, 2) if bar < 11 else range(8)
            for e in steps:
                tk = tick((e // (2 if bar < 11 else 1)) % 2 == 0, 0.8)
                drums.add(tk, bt(bar, e), G["tick"], pan=-0.35 if e % 4 == 0 else 0.35)
                send.add(tk, bt(bar, e), G["tick"] * 0.35)
        if sec == "outro":
            for q in range(3):
                tk = tick(q % 2 == 0, 0.9 - 0.2 * q)
                drums.add(tk, bt(bar, q * 2), G["tick"])
                send.add(tk, bt(bar, q * 2), G["tick"] * 0.4)

        # sixteenth hats
        if (sec == "build" and bar >= 14) or sec == "finale":
            for s in range(16):
                v = (1.0 if s % 4 == 0 else 0.55 if s % 2 == 0 else 0.4)
                if sec == "build":
                    v *= lerp(0.4, 1.0, (bar - 14 + s / 16) / 2)
                drums.add(hat(v), t0 + s * SIXTEENTH, G["hat"], pan=0.2 if s % 2 else -0.2)

        # pulsing bass, eighth notes
        if sec in ("groove", "build", "finale"):
            fc = {"groove": lerp(520, 760, prog_in), "build": lerp(600, 1400, prog_in), "finale": 1600}[sec]
            lv = {"groove": 0.8, "build": lerp(0.85, 1.05, prog_in), "finale": 1.1}[sec]
            acc = [1.0, 0.6, 0.78, 0.6, 0.9, 0.6, 0.78, 0.66]
            for e in range(8):
                x = sawtone(ch["sub"] * 2, EIGHTH * 0.92, fc, tau=0.13)
                music.add(x, bt(bar, e), G["pulse"] * lv * acc[e])

        # string figure in the finale
        if sec == "finale":
            v = ch["pad"]
            fig = [v[0], v[2], v[1], v[2], v[3], v[2], v[1], v[2]]
            for e in range(8):
                x = sawtone(fig[e] * 2, EIGHTH * 0.62, 2600, attack=0.018, release=0.07)
                music.add(x, bt(bar, e), G["strings"] * (1.0 if e % 2 == 0 else 0.8), pan=-0.25 if e % 2 else 0.25)
                send.add(x, bt(bar, e), G["strings"] * 0.3)

        # piano motif: three notes on eighths 0, 3, 6
        if sec != "stop":
            m = ch["motif"]
            if sec == "intro":
                notes = [] if bar == 0 else [(0, m[0], 0.5), (3, m[1], 0.45), (6, m[2], 0.5)]
            elif sec == "outro":
                notes = [(0, 293.66, 1.0), (0, 440.0, 0.8), (0, 587.33, 0.7), (0, 146.83, 0.8)]
            else:
                notes = [(0, m[0], 0.95), (3, m[1], 0.8), (6, m[2], 0.9)]
                if sec != "groove" or bar >= 4:
                    notes.append((7, 440.0, 0.5))
            octaves = [1.0]
            if sec == "break":
                octaves = [1.0, 0.5]
            if (sec == "build" and bar >= 14) or sec == "finale":
                octaves = [1.0, 2.0]
            bright = {"intro": 0.82, "groove": 0.9, "break": 0.84, "build": 0.93, "finale": 1.0, "outro": 0.95}[sec]
            for e, f, vel in notes:
                for o in octaves:
                    x = pluck(f * o, 3.0 if sec in ("break", "outro") else 2.4, vel * (0.75 if o != 1.0 else 1.0), bright)
                    pan = float(np.clip((np.log2(f * o / 293.66)) * 0.35, -0.6, 0.6))
                    keys.add(x, bt(bar, e), G["piano"], pan=pan)
                    send.add(x, bt(bar, e), G["piano"] * (0.75 if sec == "break" else 0.5))

    # drone under intro, breakdown and stop
    t = np.arange(N) / SR
    dr = (np.sin(2 * np.pi * 73.42 * t) + 0.8 * np.sin(2 * np.pi * 73.42 * 1.004 * t) + 0.6 * np.sin(2 * np.pi * 110.0 * t)
          + 0.25 * np.sin(2 * np.pi * 146.83 * t)) * 0.3
    env = np.interp(t, [0, 0.6, bt(2) - 0.3, bt(2) + 0.4, bt(8) - 0.2, bt(8) + 0.8, bt(12) - 0.4, bt(12) + 0.3, bt(16) - 0.1, bt(16) + 0.4, bt(17) - 0.3, bt(17)],
                    [0, 1, 1, 0.25, 0.25, 1, 1, 0.3, 0.3, 0.9, 0.9, 0.0])
    fx.add(np.tanh(dr * env * 1.5).astype(np.float32), 0.0, G["drone"])

    # risers and swells into the section changes
    for start_bar, bars, peak in ((1.4, 0.6, 0.45), (11, 1, 0.7), (14, 2, 0.9), (16, 0.86, 1.0)):
        x = riser(bars * BAR, peak)
        fx.add(x, bt(start_bar), G["riser"])
        send.add(x, bt(start_bar), G["riser"] * 0.3)
    for target_bar in (2, 12, 17):
        sw = swell(1.3)
        gap = 0.0 if target_bar != 17 else 0.3 * EIGHTH
        fx.add(sw, bt(target_bar) - 1.3 - gap, G["swell"])
        send.add(sw, bt(target_bar) - 1.3 - gap, G["swell"] * 0.4)

    # side-chain: the kick pushes the music down
    sc = np.ones(N, np.float32)
    rel = int(0.42 * SR)
    tt = np.arange(rel) / SR
    for tk, vel in kick_times:
        i = int(tk * SR)
        duck = 1 - 0.55 * vel * np.exp(-tt / 0.14) * np.minimum(1, tt / 0.004)
        seg = sc[i:i + rel]
        sc[i:i + rel] = np.minimum(seg, duck[: len(seg)])

    buses = dict(drums=drums, bass=bass, music=music, keys=keys, fx=fx)
    for b in (music,):
        b.l *= sc
        b.r *= sc
    keys.l *= 0.65 + 0.35 * sc
    keys.r *= 0.65 + 0.35 * sc

    # short silence right before the finale
    gate = np.ones(N, np.float32)
    g0, g1 = int((bt(17) - 0.42 * EIGHTH) * SR), int(bt(17) * SR)
    ramp = int(0.012 * SR)
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
    for b in list(buses.values()) + [send]:
        b.l *= gate
        b.r *= gate

    # reverb
    wet_l = convolve(send.l, make_ir(3))
    wet_r = convolve(send.r, make_ir(4))

    left = sum(b.l for b in buses.values()) + wet_l * G["reverb"]
    right = sum(b.r for b in buses.values()) + wet_r * G["reverb"]
    return left, right, buses, (wet_l, wet_r)


def master(left, right):
    left, right = highpass(left, 30), highpass(right, 30)
    peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
    drive = 1.25 / peak * 0.9
    left, right = np.tanh(left * drive * 1.6) / np.tanh(1.6), np.tanh(right * drive * 1.6) / np.tanh(1.6)
    peak = max(np.max(np.abs(left)), np.max(np.abs(right)))
    left, right = left / peak * 0.89, right / peak * 0.89
    fi, fo = int(0.01 * SR), int(1.0 * SR)
    for ch in (left, right):
        ch[:fi] *= np.linspace(0, 1, fi)
        ch[-fo:] *= np.linspace(1, 0, fo) ** 2
    return left.astype(np.float32), right.astype(np.float32)


def save_wav(path, left, right):
    pcm = (np.clip(np.stack([left, right], axis=1), -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def save_mp3(path, left, right, bitrate=192000):
    pcm = (np.clip(np.stack([left, right]), -1, 1) * 32767).astype(np.int16)
    out = av.open(path, mode="w")
    st = out.add_stream("libmp3lame", rate=SR)
    st.codec_context.layout = "stereo"
    st.codec_context.format = "s16p"
    st.codec_context.bit_rate = bitrate
    for i in range(0, pcm.shape[1], 1152):
        f = av.AudioFrame.from_ndarray(np.ascontiguousarray(pcm[:, i:i + 1152]), format="s16p", layout="stereo")
        f.sample_rate = SR
        f.time_base = Fraction(1, SR)
        f.pts = i
        for pkt in st.encode(f):
            out.mux(pkt)
    for pkt in st.encode(None):
        out.mux(pkt)
    out.close()


def db(x):
    return round(float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)), 1)


def main():
    base = sys.argv[1]
    os.makedirs(os.path.dirname(base), exist_ok=True)
    left, right, buses, wet = build()
    print("stem RMS per section (dBFS, left channel):")
    print("  section      " + " ".join(f"{k:>7}" for k in list(buses) + ["reverb"]))
    for name, a, b in SECTIONS:
        i0, i1 = int(bt(a) * SR), int(bt(b) * SR)
        row = [db(bus.l[i0:i1]) for bus in buses.values()] + [db(wet[0][i0:i1] * G["reverb"])]
        print(f"  {name:8} {bt(a):5.1f}s " + " ".join(f"{v:7.1f}" for v in row))
    left, right = master(left, right)
    print("master: peak", round(float(max(np.max(np.abs(left)), np.max(np.abs(right)))), 2), "| RMS", db(left), "dBFS | length", round(len(left) / SR, 2), "s")
    for name, a, b in SECTIONS:
        i0, i1 = int(bt(a) * SR), int(bt(b) * SR)
        print(f"  {name:8} {bt(a):5.1f}-{bt(b):5.1f}s  RMS {db(left[i0:i1])} dBFS")
    save_wav(base + ".wav", left, right)
    save_mp3(base + ".mp3", left, right)
    print("written", base + ".mp3")


if __name__ == "__main__":
    main()
