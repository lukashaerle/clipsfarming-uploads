"""Livelier version of the original underscore ("Spannung 02"), built entirely in code.

    python -I peppybeat.py <out_basename>

Own composition: D minor, 96 BPM (one bar = 2.5 s), 26 bars (65 s).
More drive than darkbeat.py: the beat starts after one bar, clap on 2 and 4, off-beat hats and hat rolls,
a bouncing octave bass, a sparkling sixteenth-note arpeggio with echo and the brighter chord run Dm - B flat - F - C.
Arc: intro (1 bar) - groove (8) - breakdown (3) - build (3) - stop (1) - finale (9) - outro (1).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import darkbeat as db  # noqa: E402

SR = db.SR
db.BPM = 96.0
db.BEAT = 60.0 / db.BPM
db.EIGHTH = db.BEAT / 2
db.SIXTEENTH = db.BEAT / 4
db.BAR = 4 * db.BEAT
db.NBARS = 26
db.TAIL = 2.2
db.N = int((db.NBARS * db.BAR + db.TAIL) * SR)
db.SECTIONS = [("intro", 0, 1), ("groove", 1, 9), ("break", 9, 12), ("build", 12, 15), ("stop", 15, 16), ("finale", 16, 25), ("outro", 25, 26)]

bt = db.bt
lerp = db.lerp
rng = np.random.default_rng(23)

CH = dict(db.CHORDS)
CH["F"] = dict(sub=87.31, pad=[174.61, 220.00, 261.63, 349.23], motif=[440.00, 392.00, 349.23])
CH["C"] = dict(sub=65.41, pad=[130.81, 196.00, 261.63, 329.63], motif=[392.00, 329.63, 261.63])
ARP = {
    "Dm": [440.00, 587.33, 698.46, 880.00], "Bb": [466.16, 587.33, 698.46, 932.33], "F": [440.00, 523.25, 698.46, 880.00],
    "C": [392.00, 523.25, 659.25, 783.99], "Gm": [392.00, 466.16, 587.33, 783.99], "A": [440.00, 554.37, 659.25, 880.00],
    "Asus": [440.00, 587.33, 659.25, 880.00],
}
PROG = (["Dm"] + ["Dm", "Bb", "F", "C"] * 2 + ["Gm", "Bb", "A"] + ["Dm", "Bb", "C"] + ["Asus"]
        + ["Dm", "Bb", "F", "C"] * 2 + ["Dm"] + ["Dm"])

G = dict(kick=0.80, sub=0.46, heart=0.34, clap=0.33, snare=0.24, hat=0.075, ohat=0.060, tick=0.12, pad=0.19, pulse=0.27,
         arp=0.17, strings=0.155, piano=0.39, impact=0.65, riser=0.26, swell=0.16, drone=0.08, reverb=0.55)

ARP_STEPS = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1]
ARP_ACCENT = {0, 3, 6, 8, 11, 14}


def clap(vel=1.0):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    noise = db.highpass(db.lowpass(rng.standard_normal(n).astype(np.float32), 6200), 1100)
    env = np.zeros(n)
    for k in (0.0, 0.011, 0.022):
        m = t >= k
        env[m] += 0.75 * np.exp(-(t[m] - k) / 0.006)
    m = t >= 0.033
    env[m] += np.exp(-(t[m] - 0.033) / 0.105)
    return db.fade(noise * env * vel, 0.0003, 0.02).astype(np.float32)


def open_hat(vel=1.0):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return db.fade(db.highpass(rng.standard_normal(n).astype(np.float32), 6000) * np.exp(-t / 0.085) * vel, 0.0005, 0.03)


def pad_cutoff(tt):
    pts = [(0, 500), (bt(1) - 0.05, 1400), (bt(1), 1500), (bt(9), 1900), (bt(9) + 0.4, 650), (bt(12), 1000), (bt(15), 2600),
           (bt(15) + 0.2, 700), (bt(16) - 0.05, 2800), (bt(16), 3600), (bt(25), 3300), (bt(26), 900), (bt(26) + db.TAIL, 300)]
    xs, ys = zip(*pts)
    return np.interp(tt, xs, ys)


def build():
    Bus = db.Bus
    drums, bass, music, keys, fx, send = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    kick_times = []

    def add_kick(t, vel=1.0):
        drums.add(db.kick(vel, 175.0, 48.0, 0.17), t, G["kick"])
        kick_times.append((t, vel))

    def add_808(t, freq, dur, vel=1.0):
        add_kick(t, vel)
        bass.add(db.sub(freq, max(0.12, min(dur, 0.6)), vel * 0.95), t, G["sub"])

    def add_clap(t, vel=1.0):
        c = clap(vel)
        drums.add(c, t, G["clap"])
        send.add(c, t, G["clap"] * 0.3)
        drums.add(db.snare(vel * 0.6), t, G["snare"])

    def snare_at(t, vel, wet=0.25):
        s = db.snare(vel)
        drums.add(s, t, G["snare"] * 1.4)
        send.add(s, t, G["snare"] * 1.4 * wet)

    def hats_closed(t0, lvl=1.0, ghosts=False):
        for e in range(8):
            v = (0.6 if e % 2 == 0 else 0.95) * lvl * rng.uniform(0.92, 1.08)
            drums.add(db.hat(v), t0 + e * db.EIGHTH, G["hat"], pan=-0.25 if e % 2 else 0.25)
            if ghosts:
                drums.add(db.hat(0.38 * lvl * rng.uniform(0.85, 1.1), 0.016), t0 + (e + 0.5) * db.EIGHTH, G["hat"], pan=0.3 if e % 2 else -0.3)

    def hat_roll(t_end, beats=1.0):
        hits = int(round(beats * 8))
        for k in range(hits):
            v = lerp(0.4, 1.05, k / max(1, hits - 1))
            drums.add(db.hat(v, 0.014), t_end - (hits - k) * db.SIXTEENTH / 2, G["hat"], pan=lerp(-0.4, 0.4, k / max(1, hits - 1)))

    def arp_bar(t0, name, fc, lvl, sixteenths=True, octave_accents=False):
        tones = ARP[name]
        steps = ARP_STEPS if sixteenths else [0, 2, 1, 3, 0, 2, 1, 3]
        unit = db.SIXTEENTH if sixteenths else db.EIGHTH
        for i, st in enumerate(steps):
            accent = (i in ARP_ACCENT) if sixteenths else (i % 2 == 0)
            v = lvl * (1.0 if accent else 0.62) * rng.uniform(0.93, 1.07)
            f = tones[st] * (2.0 if (octave_accents and accent and st < 2) else 1.0)
            x = db.sawtone(f, 0.26, fc, attack=0.002, tau=0.085, release=0.04)
            pan = 0.45 if i % 2 else -0.45
            tn = t0 + i * unit
            music.add(x, tn, G["arp"] * v, pan=pan)
            send.add(x, tn, G["arp"] * v * 0.35, pan=pan)
            for rep, g in ((1, 0.40), (2, 0.16)):  # echo, three sixteenths apart
                music.add(x, tn + rep * 3 * db.SIXTEENTH, G["arp"] * v * g, pan=-pan if rep == 1 else pan)

    def pulse_bar(t0, root, fc, lvl):
        mult = [1, 1, 2, 1, 1, 2, 1, 2]
        acc = [1.0, 0.6, 0.9, 0.6, 0.8, 0.9, 0.6, 0.85]
        for e in range(8):
            x = db.sawtone(root * 2 * mult[e], db.EIGHTH * 0.8, fc, tau=0.11)
            music.add(x, t0 + e * db.EIGHTH, G["pulse"] * lvl * acc[e] * (0.8 if mult[e] == 2 else 1.0))

    def piano_bar(t0, name, sec, vel=1.0, octaves=(1.0,), bright=0.95, long=False):
        m = CH[name]["motif"]
        notes = [(0, m[0], 0.95), (3, m[1], 0.8), (6, m[2], 0.9), (7, ARP[name][0], 0.5)]
        for e, f, v in notes:
            for o in octaves:
                x = db.pluck(f * o, 3.0 if long else 2.2, vel * v * (0.75 if o != 1.0 else 1.0), bright)
                pan = float(np.clip(np.log2(f * o / 293.66) * 0.35, -0.6, 0.6))
                keys.add(x, t0 + e * db.EIGHTH, G["piano"], pan=pan)
                send.add(x, t0 + e * db.EIGHTH, G["piano"] * (0.75 if long else 0.45), pan=pan)

    def impact_at(t, vel, wet=0.4):
        x = db.impact(vel)
        fx.add(x, t, G["impact"])
        send.add(x, t, G["impact"] * wet)

    for bar in range(db.NBARS):
        sec = db.section_of(bar)
        name = PROG[bar]
        ch = CH[name]
        a, b = next((a, b) for n, a, b in db.SECTIONS if n == sec)
        i_in = bar - a
        prog_in = i_in / max(1, b - a)
        t0 = bt(bar)

        # pad
        if sec != "outro":
            pl, pr = db.pad_chord(ch["pad"], t0, db.BAR + 0.42, pad_cutoff)
            lvl = {"intro": 0.85, "groove": 1.0, "break": 0.95, "build": 1.0, "stop": 1.1, "finale": 1.15}[sec]
            music.add_st(pl, pr, t0, G["pad"] * lvl)
            send.add_st(pl, pr, t0, G["pad"] * lvl * 0.35)
        else:
            pl, pr = db.pad_chord(ch["pad"], t0, db.BAR + db.TAIL - 0.2, pad_cutoff)
            env = np.exp(-np.arange(len(pl)) / SR / 1.3)
            music.add_st(pl * env, pr * env, t0, G["pad"] * 1.1)
            send.add_st(pl * env, pr * env, t0, G["pad"] * 0.5)

        if sec == "intro":
            impact_at(0.0, 1.0)
            bass.add(db.sub(ch["sub"], db.BAR, 0.75), 0.0, G["sub"])
            for f, v in ((146.83, 0.9), (220.0, 0.7), (293.66, 0.8)):
                x = db.pluck(f, 2.6, v, 0.9)
                keys.add(x, 0.0, G["piano"])
                send.add(x, 0.0, G["piano"] * 0.5)
            for e in range(8):
                tk = db.tick(e % 2 == 0, lerp(0.6, 1.0, e / 7))
                drums.add(tk, bt(0, e), G["tick"], pan=-0.3 if e % 2 == 0 else 0.3)
                send.add(tk, bt(0, e), G["tick"] * 0.25)
            for e, v in ((7.0, 0.6), (7.5, 0.85)):
                snare_at(bt(0, e), v)

        if sec == "groove":
            pos = [0, 3, 5] if i_in % 2 == 0 else [0, 2.5, 5, 7]
            for k, e in enumerate(pos):
                nxt = pos[k + 1] if k + 1 < len(pos) else 8
                freq = ch["sub"] * (1.5 if e == 7 else 1.0)
                add_808(bt(bar, e), freq, (nxt - e) * db.EIGHTH * 0.98, 1.0 if e == 0 else 0.85)
            add_clap(bt(bar, 2), 0.95)
            add_clap(bt(bar, 6), 1.0)
            hats_closed(t0, 1.0, ghosts=i_in >= 4)
            if i_in in (3, 7):
                hat_roll(bt(bar + 1), 1.0)
            pulse_bar(t0, ch["sub"], lerp(900, 1300, prog_in), 0.9)
            if i_in >= 4:
                arp_bar(t0, name, 2400, 0.7)
            piano_bar(t0, name, sec, bright=0.95)
            if i_in == 0:
                impact_at(t0, 0.75, 0.3)
            if i_in == 4:
                impact_at(t0, 0.45, 0.3)

        if sec == "break":
            for e, v in ((0, 1.0), (1.15, 0.7)):  # heartbeat
                drums.add(db.lowpass(db.kick(v, 110, 44, 0.16), 220), bt(bar, e), G["heart"])
            for e in range(8):
                tk = db.tick(e % 2 == 0, 0.85)
                drums.add(tk, bt(bar, e), G["tick"], pan=-0.35 if e % 2 == 0 else 0.35)
                send.add(tk, bt(bar, e), G["tick"] * 0.35)
            arp_bar(t0, name, 1100, 0.55, sixteenths=False)
            piano_bar(t0, name, sec, octaves=(1.0, 0.5), bright=0.86, long=True)
            if i_in == 2:
                for s in range(8, 16):
                    snare_at(t0 + s * db.SIXTEENTH, lerp(0.2, 0.8, (s - 8) / 7))

        if sec == "build":
            vel = lerp(0.75, 1.0, prog_in)
            if i_in == 0:
                pos = [0, 2, 4, 6]
            elif i_in == 1:
                pos = list(range(8))
            else:
                pos = [0, 1, 2, 3] + [4 + 0.5 * k for k in range(8)]
            for e in pos:
                add_kick(bt(bar, e), vel * (1.0 if float(e).is_integer() else 0.8))
            bass.add(db.sub(ch["sub"], db.BAR * 0.9, 0.85), t0, G["sub"])
            if i_in < 2:
                add_clap(bt(bar, 2), 0.9)
                add_clap(bt(bar, 6), 0.95)
            else:
                for s in range(16):
                    snare_at(t0 + s * db.SIXTEENTH, lerp(0.25, 0.9, s / 15))
                for k in range(8):  # thirty-second notes in the last beat
                    snare_at(bt(bar, 6) + (k + 0.5) * db.SIXTEENTH / 2 * 2 * 0.5, lerp(0.5, 0.95, k / 7), wet=0.15)
            hats_closed(t0, lerp(0.8, 1.1, prog_in), ghosts=True)
            pulse_bar(t0, ch["sub"], lerp(950, 2200, prog_in + 1 / 3), lerp(0.9, 1.1, prog_in))
            arp_bar(t0, name, lerp(1600, 4600, prog_in + 1 / 3), lerp(0.7, 1.0, prog_in))
            piano_bar(t0, name, sec, octaves=(1.0, 2.0) if i_in >= 1 else (1.0,), bright=0.96)

        if sec == "stop":
            impact_at(t0, 1.0, 0.5)
            for s in range(8, 15):
                snare_at(t0 + s * db.SIXTEENTH, lerp(0.2, 0.9, (s - 8) / 6), wet=0.3)

        if sec == "finale":
            fill = i_in == 3
            for e in (0, 2, 4, 6):
                if fill and e == 6:
                    continue
                if e in (0, 4):
                    add_808(bt(bar, e), ch["sub"], 0.55, 1.0 if e == 0 else 0.9)
                else:
                    add_kick(bt(bar, e), 0.9)
            if i_in % 2 == 1 and not fill:
                add_808(bt(bar, 7), ch["sub"] * 1.5, db.EIGHTH * 0.95, 0.7)
            if i_in % 2 == 0:
                add_kick(bt(bar, 3.5), 0.55)
            add_clap(bt(bar, 2), 1.0)
            if not fill:
                add_clap(bt(bar, 6), 1.0)
            else:
                for e, v in ((6, 0.7), (6.5, 0.6), (7, 0.8), (7.5, 0.95)):
                    snare_at(bt(bar, e), v)
            hats_closed(t0, 1.05, ghosts=True)
            for e in (1, 3, 5, 7):
                drums.add(open_hat(0.9), bt(bar, e), G["ohat"], pan=0.15)
            if i_in in (3, 7):
                hat_roll(bt(bar + 1), 1.0)
            pulse_bar(t0, ch["sub"], 1800, 1.1)
            arp_bar(t0, name, 5000, 1.0, octave_accents=i_in >= 4)
            v = ch["pad"]
            fig = [v[0], v[2], v[1], v[2], v[3], v[2], v[1], v[2]]
            for e in range(8):
                x = db.sawtone(fig[e] * 2, db.EIGHTH * 0.62, 2600, attack=0.018, release=0.07)
                music.add(x, bt(bar, e), G["strings"] * (1.0 if e % 2 == 0 else 0.8), pan=-0.25 if e % 2 else 0.25)
                send.add(x, bt(bar, e), G["strings"] * 0.3)
            piano_bar(t0, name, sec, octaves=(1.0, 2.0), bright=1.0)
            if i_in == 0:
                impact_at(t0, 1.0, 0.5)
            if i_in == 4:
                impact_at(t0, 0.6, 0.4)
            if i_in == 8:
                for e, vv in ((6.5, 0.6), (7, 0.75), (7.5, 0.9)):
                    snare_at(bt(bar, e), vv)

        if sec == "outro":
            impact_at(t0, 1.0, 0.6)
            add_kick(t0, 1.0)
            bass.add(db.sub(ch["sub"], db.BAR + db.TAIL - 0.3, 1.0), t0, G["sub"])
            for f, v in ((146.83, 0.8), (293.66, 1.0), (440.0, 0.8), (587.33, 0.7)):
                x = db.pluck(f, 3.0, v, 0.95)
                keys.add(x, t0, G["piano"])
                send.add(x, t0, G["piano"] * 0.6)
            c = clap(0.9)
            drums.add(c, t0, G["clap"])
            send.add(c, t0, G["clap"] * 0.5)
            for q in range(3):
                tk = db.tick(q % 2 == 0, 0.9 - 0.2 * q)
                drums.add(tk, bt(bar, q * 2), G["tick"])
                send.add(tk, bt(bar, q * 2), G["tick"] * 0.4)

    # drone: intro, breakdown and stop
    N = db.N
    t = np.arange(N) / SR
    dr = (np.sin(2 * np.pi * 73.42 * t) + 0.8 * np.sin(2 * np.pi * 73.42 * 1.004 * t) + 0.6 * np.sin(2 * np.pi * 110.0 * t)
          + 0.25 * np.sin(2 * np.pi * 146.83 * t)) * 0.3
    env = np.interp(t, [0, 0.4, bt(1) - 0.2, bt(1) + 0.3, bt(9) - 0.2, bt(9) + 0.6, bt(12) - 0.3, bt(12) + 0.3, bt(15) - 0.1, bt(15) + 0.4, bt(16) - 0.3, bt(16)],
                    [0, 1, 1, 0.15, 0.15, 1, 1, 0.25, 0.25, 0.9, 0.9, 0.0])
    fx.add(np.tanh(dr * env * 1.5).astype(np.float32), 0.0, G["drone"])

    # risers and swells
    for start_bar, bars, peak in ((0.25, 0.75, 0.6), (11, 1, 0.7), (13, 2, 0.95), (15, 0.86, 1.0), (19.5, 0.5, 0.5)):
        x = db.riser(bars * db.BAR, peak)
        fx.add(x, bt(start_bar), G["riser"])
        send.add(x, bt(start_bar), G["riser"] * 0.3)
    for target_bar in (1, 5, 12, 16, 20):
        sw = db.swell(1.2)
        gap = 0.0 if target_bar != 16 else 0.3 * db.EIGHTH
        fx.add(sw, bt(target_bar) - 1.2 - gap, G["swell"] * (0.7 if target_bar in (5, 20) else 1.0))
        send.add(sw, bt(target_bar) - 1.2 - gap, G["swell"] * 0.4)

    # side-chain: the kick pushes the music down, which makes it bounce
    sc = np.ones(N, np.float32)
    rel = int(0.4 * SR)
    tt = np.arange(rel) / SR
    for tk, vel in kick_times:
        i = int(tk * SR)
        duck = 1 - 0.6 * min(1.0, vel) * np.exp(-tt / 0.13) * np.minimum(1, tt / 0.004)
        seg = sc[i:i + rel]
        sc[i:i + rel] = np.minimum(seg, duck[: len(seg)])
    music.l *= sc
    music.r *= sc
    keys.l *= 0.65 + 0.35 * sc
    keys.r *= 0.65 + 0.35 * sc

    buses = dict(drums=drums, bass=bass, music=music, keys=keys, fx=fx)
    # short silence right before the finale
    gate = np.ones(N, np.float32)
    g0, g1 = int((bt(16) - 0.42 * db.EIGHTH) * SR), int(bt(16) * SR)
    ramp = int(0.012 * SR)
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
    for bus in list(buses.values()) + [send]:
        bus.l *= gate
        bus.r *= gate

    wet_l = db.convolve(send.l, db.make_ir(5, 2.6))
    wet_r = db.convolve(send.r, db.make_ir(6, 2.6))
    left = sum(bus.l for bus in buses.values()) + wet_l * G["reverb"]
    right = sum(bus.r for bus in buses.values()) + wet_r * G["reverb"]
    return left, right, buses, (wet_l, wet_r)


def main():
    base = sys.argv[1]
    os.makedirs(os.path.dirname(base), exist_ok=True)
    left, right, buses, wet = build()
    print("stem RMS per section (dBFS, left channel):")
    print("  section        " + " ".join(f"{k:>7}" for k in list(buses) + ["reverb"]))
    for name, a, b in db.SECTIONS:
        i0, i1 = int(bt(a) * SR), int(bt(b) * SR)
        row = [db.db(bus.l[i0:i1]) for bus in buses.values()] + [db.db(wet[0][i0:i1] * G["reverb"])]
        print(f"  {name:8} {bt(a):5.1f}s " + " ".join(f"{v:7.1f}" for v in row))
    left, right = db.master(left, right)
    print("master: peak", round(float(max(np.max(np.abs(left)), np.max(np.abs(right)))), 2), "| RMS", db.db(left), "dBFS | length", round(len(left) / SR, 2), "s")
    for name, a, b in db.SECTIONS:
        i0, i1 = int(bt(a) * SR), int(bt(b) * SR)
        print(f"  {name:8} {bt(a):5.1f}-{bt(b):5.1f}s  RMS {db.db(left[i0:i1])} dBFS")
    db.save_wav(base + ".wav", left, right)
    db.save_mp3(base + ".mp3", left, right)
    print("written", base + ".mp3")


if __name__ == "__main__":
    main()
