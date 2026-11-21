"""Subtle sound effects for a video, placed exactly where things happen on screen.

    python -I sfx.py <cue sheet json> <src/motiv/script.ts> <out.wav> [length in s = 65]

The cue sheet lists, per slot, what appears when ("at" = seconds after the slot starts):
  {"k": "click", "at": 0.28, "x": 192, "p": 0, "v": 1}       a quiet tick when an element appears
  {"k": "tok", "at": 0.3}                                     a duller tick (stacking, grey or heavy things)
  {"k": "impulse", "at": 1.42, "v": 1}                        a soft low thump when a key number lands
  {"k": "bloom", "at": 0.2, "d": 1.0, "x": 540}               an airy swell while something expands or lights up
  {"k": "slide", "at": 0.7, "d": 1.4, "x": 300, "x2": 850}    an airy pass while something moves across
  {"k": "click", "roll": {"n": 5, "at": 0.28, "step": 0.2, "x": 192, "dx": 174}}   several ticks in a row, rising
"x" is the horizontal position on the 1080 wide stage and sets the place between the speakers, "v" the level,
"p" the pitch step. A light whoosh is added at every scene change on its own; "whoosh" in the sheet sets the
level per slot ("per"), the kind ("kind": "drop" falls instead of rising) or leaves single ones out ("off").
Writes the stereo WAV and <out>.events.json with every sound and its time in the video.
"""
import json
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "music"))

import darkbeat as db  # noqa: E402  (filters, reverb, file writer)

SR = db.SR
rng = np.random.default_rng(7)

LEVEL = dict(click=0.11, tok=0.10, impulse=0.18, bloom=0.08, slide=0.08, whoosh=0.09, riser=0.10, boom=0.26)   # peak of one sound; the narrator peaks near 0.9
SEND = dict(click=0.05, tok=0.12, impulse=0.30, bloom=0.35, slide=0.25, whoosh=0.20, riser=0.25, boom=0.30)
REVERB = 0.5


def band(x, lo, hi):
    return db.fft_filter(x.astype(np.float32), lambda f: (1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 6)) * (1 / np.sqrt(1 + (f / hi) ** 6)))


def unit(x):
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12)


def pan_of(x):
    return float(np.clip((x - 540.0) / 540.0 * 0.6, -1, 1))


def pan_gains(p):
    return np.cos((p + 1) * np.pi / 4) * 1.4142, np.sin((p + 1) * np.pi / 4) * 1.4142


def click(step=0.0):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    f = 1900.0 * 2 ** (step * 1.2 / 12)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.007) + 0.35 * np.sin(2 * np.pi * f * 2.41 * t) * np.exp(-t / 0.003)
    tr = db.highpass(rng.standard_normal(n).astype(np.float32), 3000) * np.exp(-t / 0.0012) * 0.35
    y = db.lowpass((body + tr).astype(np.float32), 7500)
    return db.fade(y / np.max(np.abs(y)), 0.0003, 0.01)


def tok(step=0.0):
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = 430.0 * 2 ** (step * 0.6 / 12) + 90 * np.exp(-t / 0.012)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.024)
    tr = db.lowpass(rng.standard_normal(n).astype(np.float32), 1800) * np.exp(-t / 0.004) * 0.5
    y = body + tr
    return db.fade(y / np.max(np.abs(y)), 0.0005, 0.02)


def impulse():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 52 + 43 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = (np.sin(ph) + 0.35 * np.sin(2 * ph)) * np.exp(-t / 0.22)
    knock = np.sin(2 * np.pi * 310 * t) * np.exp(-t / 0.03) * 0.40   # the part small speakers can play
    air = unit(band(rng.standard_normal(n), 1500, 4000)) * np.exp(-t / 0.04) * 0.07
    y = (body + knock + air) * np.minimum(1, t / 0.006)
    return db.fade(y / np.max(np.abs(y)), 0.0, 0.1)


def riser(dur):
    """Tension before a reveal: noise that gets brighter and a tone that climbs two octaves, growing until it stops dead."""
    n = int(dur * SR)
    x = np.arange(n) / n
    nz = rng.standard_normal(n)
    lo, mid, hi = unit(band(nz, 300, 900)), unit(band(nz, 900, 2800)), unit(band(nz, 2800, 8000)) * 0.8
    y = lo * np.clip(1 - 2 * x, 0, 1) + mid * (1 - np.abs(2 * x - 1)) + hi * np.clip(2 * x - 1, 0, 1)
    tone = np.sin(2 * np.pi * np.cumsum(180.0 * 2 ** (2.0 * x)) / SR) * 0.3
    y = (y + tone) * x ** 2.2
    k = int(0.004 * SR)
    y[-k:] *= np.linspace(1, 0, k)
    return y / np.max(np.abs(y))


def boom():
    """The reveal itself: a low drop with a knock small speakers can play and a short crack on top."""
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(38 + 70 * np.exp(-t / 0.06)) / SR
    body = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * np.exp(-t / 0.35)
    knock = np.sin(2 * np.pi * 240 * t) * np.exp(-t / 0.05) * 0.5
    crack = unit(band(rng.standard_normal(n), 1200, 6000)) * np.exp(-t / 0.03) * 0.12
    y = (body + knock + crack) * np.minimum(1, t / 0.004)
    return db.fade(y / np.max(np.abs(y)), 0.0, 0.2)


def sweep_noise(dur, up=True):
    """Noise whose colour moves from dark to bright (or back), with a soft rise and fall."""
    n = int(dur * SR)
    x = np.arange(n) / n
    nz = rng.standard_normal(n)
    lo, mid, hi = unit(band(nz, 250, 700)), unit(band(nz, 700, 2000)), unit(band(nz, 2000, 6000)) * 0.7
    s = x if up else 1 - x
    y = lo * np.clip(1 - 2 * s, 0, 1) + mid * (1 - np.abs(2 * s - 1)) + hi * np.clip(2 * s - 1, 0, 1)
    env = np.where(x < 0.55, np.sin(x / 0.55 * np.pi / 2) ** 2, np.cos((x - 0.55) / 0.45 * np.pi / 2) ** 2)
    y = y * env
    return y / np.max(np.abs(y))


def soft_noise(dur, lo, hi):
    n = int(dur * SR)
    x = np.arange(n) / n
    y = unit(band(rng.standard_normal(n), lo, hi)) * np.sin(np.pi * x) ** 2
    return y / np.max(np.abs(y))


def slots_of(script_ts):
    if script_ts.endswith(".json"):   # a timeline written by scripts/lr/build_audio.py
        tl = json.load(open(script_ts, encoding="utf-8"))
        return [("s%02d" % (i + 1), sc["start"], sc["end"]) for i, sc in enumerate(tl["scenes"])]
    src = open(script_ts, encoding="utf-8").read()
    return [(m.group(1), float(m.group(2)), float(m.group(3))) for m in re.finditer(r"\{id: '(s\d+)', t0: ([\d.]+), t1: ([\d.]+),", src)]


def main():
    sheet_path, script_ts, out = sys.argv[1:4]
    length = float(sys.argv[4]) if len(sys.argv) > 4 else 65.0
    sheet = json.load(open(sheet_path, encoding="utf-8"))
    slots = slots_of(script_ts)
    n = int(length * SR)
    left, right = np.zeros(n), np.zeros(n)
    send_l, send_r = np.zeros(n), np.zeros(n)
    events = []

    def put(sig_l, sig_r, t0, kind, gain):
        i = int(round(t0 * SR))
        if i < 0:
            sig_l, sig_r, i = sig_l[-i:], sig_r[-i:], 0
        m = min(len(sig_l), n - i)
        if m <= 0:
            return
        left[i:i + m] += sig_l[:m] * gain
        right[i:i + m] += sig_r[:m] * gain
        send_l[i:i + m] += sig_l[:m] * gain * SEND[kind]
        send_r[i:i + m] += sig_r[:m] * gain * SEND[kind]

    def moving(sig, x_from, x_to):
        p = np.linspace(pan_of(x_from), pan_of(x_to), len(sig))
        return sig * np.cos((p + 1) * np.pi / 4) * 1.4142, sig * np.sin((p + 1) * np.pi / 4) * 1.4142

    # ---- a light whoosh at every scene change
    wh = sheet.get("whoosh", {})
    for idx, (sid, t0, _) in enumerate(slots):
        if idx == 0 or sid in wh.get("off", []):
            continue
        v = wh.get("per", {}).get(sid, wh.get("default", 1.0))
        kind = wh.get("kind", {}).get(sid, "rise")
        d = 0.62 if kind == "rise" else 0.5
        sig = sweep_noise(d, up=(kind == "rise"))
        a, b = (140, 940) if idx % 2 else (940, 140)
        sl, sr = moving(sig, a, b)
        start = t0 - (0.36 if kind == "rise" else 0.5)
        put(sl, sr, start, "whoosh", LEVEL["whoosh"] * v)
        events.append({"t": round(t0, 3), "k": "whoosh" if kind == "rise" else "drop", "slot": sid, "v": v})

    # ---- what the cue sheet lists
    for sid, t0, _ in slots:
        for ev in sheet.get("slots", {}).get(sid, []):
            items = []
            if "roll" in ev:
                r = ev["roll"]
                for i in range(r["n"]):
                    items.append(dict(ev, at=r["at"] + i * r["step"], x=r.get("x", 540) + i * r.get("dx", 0), p=ev.get("p", 0) + i))
            else:
                items.append(ev)
            for it in items:
                k, t, v, x = it["k"], t0 + it["at"], it.get("v", 1.0), it.get("x", 540)
                if k == "click":
                    gl, gr = pan_gains(pan_of(x))
                    s = click(it.get("p", 0))
                    put(s * gl, s * gr, t, k, LEVEL[k] * v)
                elif k == "tok":
                    gl, gr = pan_gains(pan_of(x))
                    s = tok(it.get("p", 0))
                    put(s * gl, s * gr, t, k, LEVEL[k] * v)
                elif k == "impulse":
                    s = impulse()
                    put(s, s, t - 0.004, k, LEVEL[k] * v)
                elif k == "bloom":
                    d = it.get("d", 1.0)
                    a, b = soft_noise(d, 900, 4000), soft_noise(d, 900, 4000)
                    gl, gr = pan_gains(pan_of(x) * 0.6)
                    put(a * gl, b * gr, t, k, LEVEL[k] * v)
                elif k == "slide":
                    d = it.get("d", 1.2)
                    sl, sr = moving(soft_noise(d, 500, 2500), x, it.get("x2", x))
                    put(sl, sr, t, k, LEVEL[k] * v)
                elif k == "riser":
                    d = it.get("d", 0.8)
                    sig = riser(d)
                    put(sig, sig, t, k, LEVEL[k] * v)   # `at` is where it starts; it ends d seconds later
                elif k == "boom":
                    sig = boom()
                    put(sig, sig, t - 0.004, k, LEVEL[k] * v)
                else:
                    raise SystemExit("unknown kind: %s" % k)
                events.append({"t": round(t, 3), "k": k, "slot": sid, "v": v})

    ir_l, ir_r = db.make_ir(21, 1.3), db.make_ir(22, 1.3)
    left = left + db.convolve(send_l.astype(np.float32), ir_l) * REVERB
    right = right + db.convolve(send_r.astype(np.float32), ir_r) * REVERB
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    db.save_wav(out, left.astype(np.float32), right.astype(np.float32))
    events.sort(key=lambda e: e["t"])
    json.dump({"length": length, "events": events}, open(os.path.splitext(out)[0] + ".events.json", "w", encoding="utf-8"), indent=1)
    kinds = {}
    for e in events:
        kinds[e["k"]] = kinds.get(e["k"], 0) + 1
    print("events:", ", ".join("%d %s" % (c, k) for k, c in sorted(kinds.items())))
    print("peak %.3f | RMS %.1f dBFS | written %s" % (max(np.max(np.abs(left)), np.max(np.abs(right))), db.db(left), out))


if __name__ == "__main__":
    main()
