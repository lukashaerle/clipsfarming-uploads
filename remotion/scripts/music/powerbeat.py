"""Most energetic version of the original underscore ("Spannung 03"), built entirely in code.

    python -I powerbeat.py <out_basename>

Own composition: D minor, 120 BPM (one bar = 2 s, one beat = 0.5 s), 32 bars (64 s).
Compared with peppybeat.py: kick on every beat, bass on the off-beats, chord stabs, a lead melody,
sixteenth hats with open hats, a drum fill every four bars and a second drop in the finale.
Arc: intro (2 bars) - groove (8) - breakdown (2) - build (4) - stop (1) - finale (14) - outro (1).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import darkbeat as db  # noqa: E402
import peppybeat as pb  # noqa: E402  (sets its own tempo on import; overridden right below)

SR = db.SR
db.BPM = 120.0
db.BEAT = 60.0 / db.BPM
db.EIGHTH = db.BEAT / 2
db.SIXTEENTH = db.BEAT / 4
db.BAR = 4 * db.BEAT
db.NBARS = 32
db.TAIL = 2.2
db.N = int((db.NBARS * db.BAR + db.TAIL) * SR)
db.SECTIONS = [("intro", 0, 2), ("groove", 2, 10), ("break", 10, 12), ("build", 12, 16), ("stop", 16, 17), ("finale", 17, 31), ("outro", 31, 32)]

bt = db.bt
lerp = db.lerp
rng = np.random.default_rng(31)
CH, ARP = pb.CH, pb.ARP
PROG = (["Dm", "Dm"] + ["Dm", "Bb", "F", "C"] * 2 + ["Gm", "A"] + ["Dm", "Bb", "Gm", "A"] + ["Asus"]
        + ["Dm", "Bb", "F", "C"] * 3 + ["Gm", "A"] + ["Dm"])
assert len(PROG) == db.NBARS

# lead melody per chord: (sixteenth position, frequency, length in sixteenths)
LEAD = {
    "Dm": [(0, 880.00, 3), (3, 698.46, 3), (6, 587.33, 2), (8, 698.46, 2), (10, 880.00, 3), (13, 1046.50, 3)],
    "Bb": [(0, 932.33, 3), (3, 698.46, 3), (6, 587.33, 4), (10, 698.46, 2), (12, 587.33, 4)],
    "F": [(0, 880.00, 3), (3, 1046.50, 3), (6, 880.00, 2), (8, 698.46, 2), (10, 880.00, 3), (13, 1046.50, 3)],
    "C": [(0, 783.99, 3), (3, 659.25, 3), (6, 523.25, 4), (10, 659.25, 2), (12, 783.99, 4)],
    "Gm": [(0, 783.99, 3), (3, 932.33, 3), (6, 783.99, 2), (8, 587.33, 2), (10, 783.99, 3), (13, 932.33, 3)],
    "A": [(0, 880.00, 3), (3, 659.25, 3), (6, 554.37, 4), (10, 659.25, 2), (12, 880.00, 4)],
}
STAB_POS = [3, 6, 11, 14]

G = dict(kick=0.80, sub=0.40, heart=0.34, clap=0.33, snare=0.24, hat=0.070, ohat=0.065, tick=0.10, pad=0.18, bass=0.27,
         arp=0.13, stab=0.15, lead=0.30, strings=0.14, piano=0.33, impact=0.60, crash=0.10, riser=0.26, swell=0.16,
         drone=0.07, reverb=0.50)


def lead_tone(freq, dur, bright=1.0):
    a = db.pluck(freq, max(0.6, dur + 0.5), 1.0, bright)
    b = db.sawtone(freq, dur, 3200 * bright, attack=0.004, tau=dur * 0.7, release=0.05)
    out = np.zeros(max(len(a), len(b)), np.float32)
    out[: len(a)] += a * 0.8
    out[: len(b)] += b * 0.35
    return out


def stab(freqs, fc=3600):
    out = np.zeros(int(0.3 * SR), np.float32)
    for f in freqs:
        x = db.sawtone(f, 0.3, fc, attack=0.002, tau=0.075, release=0.04)
        out[: len(x)] += x
    return out / len(freqs)


def crash(vel=1.0):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    return db.fade(db.highpass(rng.standard_normal(n).astype(np.float32), 4200) * np.exp(-t / 0.45) * vel, 0.001, 0.2)


def pad_cutoff(tt):
    pts = [(0, 600), (bt(2) - 0.05, 1800), (bt(2), 2000), (bt(10), 2400), (bt(10) + 0.3, 700), (bt(12), 900), (bt(16), 3000),
           (bt(16) + 0.2, 700), (bt(17) - 0.05, 3000), (bt(17), 3800), (bt(31), 3600), (bt(32), 900), (bt(32) + db.TAIL, 300)]
    xs, ys = zip(*pts)
    return np.interp(tt, xs, ys)


def build():
    Bus = db.Bus
    drums, bass, music, keys, fx, send = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    kick_times = []
    S16 = db.SIXTEENTH

    def add_kick(t, vel=1.0):
        drums.add(db.kick(vel, 180.0, 49.0, 0.15), t, G["kick"])
        kick_times.append((t, vel))

    def add_clap(t, vel=1.0, wet=0.3):
        c = pb.clap(vel)
        drums.add(c, t, G["clap"])
        send.add(c, t, G["clap"] * wet)
        drums.add(db.snare(vel * 0.6), t, G["snare"])

    def snare_at(t, vel, wet=0.25):
        s = db.snare(vel)
        drums.add(s, t, G["snare"] * 1.4)
        send.add(s, t, G["snare"] * 1.4 * wet)

    def hats16(t0, lvl=1.0, first=0, last=16):
        acc = [0.5, 0.35, 0.9, 0.35]
        for s in range(first, last):
            v = acc[s % 4] * lvl * rng.uniform(0.9, 1.1)
            drums.add(db.hat(v, 0.018), t0 + s * S16, G["hat"], pan=-0.25 if s % 2 else 0.25)

    def open_hats(t0, positions=(1, 3, 5, 7), vel=0.9):
        for e in positions:
            drums.add(pb.open_hat(vel), t0 + e * db.EIGHTH, G["ohat"], pan=0.15)

    def hat_roll(t_end, beats=1.0):
        hits = int(round(beats * 8))
        for k in range(hits):
            v = lerp(0.4, 1.05, k / max(1, hits - 1))
            drums.add(db.hat(v, 0.012), t_end - (hits - k) * S16 / 2, G["hat"], pan=lerp(-0.4, 0.4, k / max(1, hits - 1)))

    def fill(t0, start16=12, lo=0.5, hi=0.95):
        steps = list(range(start16, 16))
        for k, s in enumerate(steps):
            snare_at(t0 + s * S16, lerp(lo, hi, k / max(1, len(steps) - 1)))

    def offbass(t0, root, fc, lvl, positions=(1, 3, 5, 7)):
        for e in positions:
            f = root * 2 * (2 if e == 7 else 1)
            x = db.sawtone(f, db.EIGHTH * 0.85, fc, tau=0.12)
            music.add(x, t0 + e * db.EIGHTH, G["bass"] * lvl * (0.85 if e == 7 else 1.0))
        if 7 in positions:
            x = db.sawtone(root * 2, S16 * 0.8, fc, tau=0.07)
            music.add(x, t0 + 7.5 * db.EIGHTH, G["bass"] * lvl * 0.6)

    def stabs(t0, name, lvl=1.0, fc=3600, positions=STAB_POS):
        x = stab(ARP[name][:3], fc)
        for k, s in enumerate(positions):
            pan = -0.3 if k % 2 else 0.3
            music.add(x, t0 + s * S16, G["stab"] * lvl, pan=pan)
            send.add(x, t0 + s * S16, G["stab"] * lvl * 0.35, pan=pan)

    def arp_bar(t0, name, fc, lvl, sixteenths=True, octave_accents=False):
        tones = ARP[name]
        steps = pb.ARP_STEPS if sixteenths else [0, 2, 1, 3, 0, 2, 1, 3]
        unit = S16 if sixteenths else db.EIGHTH
        for i, st in enumerate(steps):
            accent = (i in pb.ARP_ACCENT) if sixteenths else (i % 2 == 0)
            v = lvl * (1.0 if accent else 0.6) * rng.uniform(0.93, 1.07)
            f = tones[st] * (2.0 if (octave_accents and accent and st < 2) else 1.0)
            x = db.sawtone(f, 0.2, fc, attack=0.002, tau=0.07, release=0.03)
            pan = 0.45 if i % 2 else -0.45
            music.add(x, t0 + i * unit, G["arp"] * v, pan=pan)
            send.add(x, t0 + i * unit, G["arp"] * v * 0.3, pan=pan)
            music.add(x, t0 + i * unit + 3 * S16, G["arp"] * v * 0.35, pan=-pan)

    def lead_bar(t0, name, lvl=1.0, octave=1.0, bright=1.0, double=False):
        for s, f, ln in LEAD[name]:
            for o, g in (((octave, 1.0), (octave * 0.5, 0.55)) if double else ((octave, 1.0),)):
                x = lead_tone(f * o, ln * S16 * 0.92, bright)
                tn = t0 + s * S16
                keys.add(x, tn, G["lead"] * lvl * g, pan=0.1)
                send.add(x, tn, G["lead"] * lvl * g * 0.45)
                keys.add(x, tn + 3 * S16, G["lead"] * lvl * g * 0.30, pan=-0.45)  # echo
                keys.add(x, tn + 6 * S16, G["lead"] * lvl * g * 0.12, pan=0.45)

    def piano_bar(t0, name, vel=1.0, octaves=(1.0,), bright=0.95, long=False):
        m = CH[name]["motif"]
        for e, f, v in ((0, m[0], 0.95), (3, m[1], 0.8), (6, m[2], 0.9), (7, ARP[name][0], 0.5)):
            for o in octaves:
                x = db.pluck(f * o, 3.0 if long else 2.0, vel * v * (0.75 if o != 1.0 else 1.0), bright)
                pan = float(np.clip(np.log2(f * o / 293.66) * 0.35, -0.6, 0.6))
                keys.add(x, t0 + e * db.EIGHTH, G["piano"], pan=pan)
                send.add(x, t0 + e * db.EIGHTH, G["piano"] * (0.75 if long else 0.4), pan=pan)

    def impact_at(t, vel, wet=0.4, with_crash=0.0):
        x = db.impact(vel)
        fx.add(x, t, G["impact"])
        send.add(x, t, G["impact"] * wet)
        if with_crash > 0:
            c = crash(with_crash)
            fx.add(c, t, G["crash"], pan=-0.2)
            send.add(c, t, G["crash"] * 0.4)

    for bar in range(db.NBARS):
        sec = db.section_of(bar)
        name = PROG[bar]
        ch = CH[name]
        a, b = next((a, b) for n, a, b in db.SECTIONS if n == sec)
        i_in = bar - a
        prog_in = i_in / max(1, b - a)
        t0 = bt(bar)

        if sec != "outro":
            pl, pr = db.pad_chord(ch["pad"], t0, db.BAR + 0.35, pad_cutoff)
            lvl = {"intro": 0.85, "groove": 1.0, "break": 0.95, "build": 1.0, "stop": 1.1, "finale": 1.15}[sec]
            music.add_st(pl, pr, t0, G["pad"] * lvl)
            send.add_st(pl, pr, t0, G["pad"] * lvl * 0.35)
        else:
            pl, pr = db.pad_chord(ch["pad"], t0, db.BAR + db.TAIL - 0.2, pad_cutoff)
            env = np.exp(-np.arange(len(pl)) / SR / 1.3)
            music.add_st(pl * env, pr * env, t0, G["pad"] * 1.1)
            send.add_st(pl * env, pr * env, t0, G["pad"] * 0.5)

        if sec == "intro":
            if bar == 0:
                impact_at(0.0, 1.0)
                bass.add(db.sub(ch["sub"], 2 * db.BAR, 0.7), 0.0, G["sub"])
                for f, v in ((146.83, 0.9), (220.0, 0.7), (293.66, 0.8)):
                    x = db.pluck(f, 2.6, v, 0.9)
                    keys.add(x, 0.0, G["piano"])
                    send.add(x, 0.0, G["piano"] * 0.5)
            for e in (0, 2, 4, 6):  # muffled kick that opens up
                x = db.lowpass(db.kick(0.95, 150, 46, 0.18), lerp(170, 520, (bar * 8 + e) / 16))
                drums.add(x, bt(bar, e), G["kick"] * 0.85)
                kick_times.append((bt(bar, e), 0.5))
            for e in range(8):
                tk = db.tick(e % 2 == 0, lerp(0.6, 1.0, (bar * 8 + e) / 15))
                drums.add(tk, bt(bar, e), G["tick"], pan=-0.3 if e % 2 == 0 else 0.3)
                send.add(tk, bt(bar, e), G["tick"] * 0.25)
            arp_bar(t0, name, lerp(700, 1500, bar / 2) if bar == 0 else lerp(1500, 2400, 0.5), 0.6 + 0.2 * bar)
            if bar == 1:
                hats16(t0, 0.7)
                fill(t0, 12, 0.5, 0.9)
                add_clap(bt(bar, 2), 0.6)

        if sec == "groove":
            is_fill = i_in in (3, 7)
            for e in (0, 2, 4, 6):
                if is_fill and e == 6:
                    continue
                add_kick(bt(bar, e), 1.0 if e == 0 else 0.92)
            bass.add(db.sub(ch["sub"], 0.32, 0.9), t0, G["sub"])
            add_clap(bt(bar, 2), 0.95)
            if not is_fill:
                add_clap(bt(bar, 6), 1.0)
            hats16(t0, 1.0)
            open_hats(t0, (1, 3, 5) if is_fill else (1, 3, 5, 7))
            if is_fill:
                fill(t0, 12)
                hat_roll(bt(bar + 1), 1.0)
            offbass(t0, ch["sub"], lerp(1100, 1500, prog_in), 1.0)
            stabs(t0, name, 0.9)
            arp_bar(t0, name, 2600, 0.6)
            piano_bar(t0, name)
            if i_in >= 4:
                lead_bar(t0, name, 0.55, octave=0.5, bright=0.88)
            if i_in == 0:
                impact_at(t0, 0.8, 0.3, with_crash=1.0)
            if i_in == 4:
                impact_at(t0, 0.45, 0.3, with_crash=0.7)

        if sec == "break":
            for e, v in ((0, 1.0), (1.2, 0.7), (4, 0.9), (5.2, 0.6)):
                drums.add(db.lowpass(db.kick(v, 110, 44, 0.16), 220), bt(bar, e), G["heart"])
            for e in range(8):
                tk = db.tick(e % 2 == 0, 0.85)
                drums.add(tk, bt(bar, e), G["tick"], pan=-0.35 if e % 2 == 0 else 0.35)
                send.add(tk, bt(bar, e), G["tick"] * 0.35)
            add_clap(bt(bar, 2), 0.5, wet=0.6)
            add_clap(bt(bar, 6), 0.55, wet=0.6)
            arp_bar(t0, name, 1200, 0.55, sixteenths=False)
            piano_bar(t0, name, octaves=(1.0, 0.5), bright=0.86, long=True)
            lead_bar(t0, name, 0.4, octave=0.5, bright=0.8)

        if sec == "build":
            vel = lerp(0.78, 1.0, prog_in)
            if i_in in (0, 1):
                pos = [0, 2, 4, 6]
            elif i_in == 2:
                pos = list(range(8))
            else:
                pos = [0, 1, 2, 3] + [4 + 0.5 * k for k in range(8)]
            for e in pos:
                add_kick(bt(bar, e), vel * (1.0 if float(e).is_integer() else 0.8))
            bass.add(db.sub(ch["sub"], db.BAR * 0.9, 0.85), t0, G["sub"])
            if i_in == 0:
                add_clap(bt(bar, 2), 0.9)
                add_clap(bt(bar, 6), 0.95)
            elif i_in == 1:
                for e in (0, 2, 4, 6):
                    snare_at(bt(bar, e), 0.6)
            elif i_in == 2:
                for e in range(8):
                    snare_at(bt(bar, e), lerp(0.5, 0.8, e / 7))
            else:
                for s in range(16):
                    snare_at(t0 + s * S16, lerp(0.45, 0.95, s / 15))
                for k in range(8):
                    snare_at(bt(bar, 6) + (k + 0.5) * S16 / 2, lerp(0.5, 0.95, k / 7), wet=0.15)
            hats16(t0, lerp(0.8, 1.15, prog_in))
            offbass(t0, ch["sub"], lerp(1000, 2600, prog_in + 0.25), lerp(0.9, 1.1, prog_in))
            arp_bar(t0, name, lerp(1500, 5000, prog_in + 0.25), lerp(0.65, 0.95, prog_in))
            if i_in >= 1:
                stabs(t0, name, lerp(0.7, 1.0, prog_in))
            piano_bar(t0, name, octaves=(1.0, 2.0) if i_in >= 2 else (1.0,), bright=0.96)

        if sec == "stop":
            impact_at(t0, 1.0, 0.5, with_crash=0.8)
            for s in (10, 11, 12, 13, 14):
                snare_at(t0 + s * S16, lerp(0.3, 0.9, (s - 10) / 4), wet=0.3)

        if sec == "finale":
            is_fill = i_in in (3, 11)
            half_drop = i_in == 7
            last = i_in == 13
            for e in (0, 2, 4, 6):
                if (is_fill and e == 6) or (half_drop and e >= 4):
                    continue
                add_kick(bt(bar, e), 1.0 if e == 0 else 0.93)
            if i_in % 2 == 0 and not half_drop:
                add_kick(bt(bar, 7.5), 0.55)
            bass.add(db.sub(ch["sub"], 0.32, 0.95), t0, G["sub"])
            add_clap(bt(bar, 2), 1.0)
            if not (is_fill or half_drop):
                add_clap(bt(bar, 6), 1.0)
            hats16(t0, 1.1, 0, 8 if half_drop else 16)
            open_hats(t0, (1, 3) if half_drop else ((1, 3, 5) if is_fill else (1, 3, 5, 7)))
            if is_fill:
                fill(t0, 12)
                hat_roll(bt(bar + 1), 1.0)
            if half_drop:
                for s in range(8, 16):
                    snare_at(t0 + s * S16, lerp(0.35, 0.95, (s - 8) / 7))
                hat_roll(bt(bar + 1), 1.0)
            if last:
                for s in range(8, 16):
                    snare_at(t0 + s * S16, lerp(0.4, 0.95, (s - 8) / 7))
            offbass(t0, ch["sub"], 1900, 1.1, (1, 3) if half_drop else (1, 3, 5, 7))
            stabs(t0, name, 1.0, positions=[3, 6] if half_drop else STAB_POS)
            arp_bar(t0, name, 5000, 0.75, octave_accents=i_in >= 8)
            v = ch["pad"]
            fig = [v[0], v[2], v[1], v[2], v[3], v[2], v[1], v[2]]
            for e in range(8):
                x = db.sawtone(fig[e] * 2, db.EIGHTH * 0.62, 2600, attack=0.016, release=0.06)
                music.add(x, bt(bar, e), G["strings"] * (1.0 if e % 2 == 0 else 0.8), pan=-0.25 if e % 2 else 0.25)
                send.add(x, bt(bar, e), G["strings"] * 0.3)
            piano_bar(t0, name, octaves=(1.0, 2.0), bright=1.0)
            lead_bar(t0, name, 1.0, octave=1.0, bright=1.0, double=i_in >= 8)
            if i_in == 0:
                impact_at(t0, 1.0, 0.5, with_crash=1.0)
            if i_in in (4, 12):
                impact_at(t0, 0.5, 0.35, with_crash=0.7)
            if i_in == 8:
                impact_at(t0, 0.9, 0.45, with_crash=1.0)

        if sec == "outro":
            impact_at(t0, 1.0, 0.6, with_crash=1.0)
            add_kick(t0, 1.0)
            bass.add(db.sub(ch["sub"], db.BAR + db.TAIL - 0.3, 1.0), t0, G["sub"])
            for f, v in ((146.83, 0.8), (293.66, 1.0), (440.0, 0.8), (587.33, 0.7), (880.0, 0.55)):
                x = db.pluck(f, 3.0, v, 0.97)
                keys.add(x, t0, G["piano"])
                send.add(x, t0, G["piano"] * 0.6)
            x = stab(ARP[name][:3])
            music.add(x, t0, G["stab"] * 1.2)
            send.add(x, t0, G["stab"] * 0.7)
            c = pb.clap(0.9)
            drums.add(c, t0, G["clap"])
            send.add(c, t0, G["clap"] * 0.5)
            for q in range(3):
                tk = db.tick(q % 2 == 0, 0.9 - 0.2 * q)
                drums.add(tk, bt(bar, q * 2), G["tick"])
                send.add(tk, bt(bar, q * 2), G["tick"] * 0.4)

    N = db.N
    t = np.arange(N) / SR
    dr = (np.sin(2 * np.pi * 73.42 * t) + 0.8 * np.sin(2 * np.pi * 73.42 * 1.004 * t) + 0.6 * np.sin(2 * np.pi * 110.0 * t)
          + 0.25 * np.sin(2 * np.pi * 146.83 * t)) * 0.3
    env = np.interp(t, [0, 0.4, bt(2) - 0.2, bt(2) + 0.2, bt(10) - 0.2, bt(10) + 0.5, bt(12) - 0.2, bt(12) + 0.3, bt(16) - 0.1, bt(16) + 0.3, bt(17) - 0.3, bt(17)],
                    [0, 0.7, 0.7, 0.1, 0.1, 1, 1, 0.25, 0.25, 0.9, 0.9, 0.0])
    fx.add(np.tanh(dr * env * 1.5).astype(np.float32), 0.0, G["drone"])

    for start_bar, bars, peak in ((1, 1, 0.7), (11, 1, 0.6), (14, 2, 0.95), (16, 0.84, 1.0), (24, 1, 0.8), (30.5, 0.5, 0.5)):
        x = db.riser(bars * db.BAR, peak)
        fx.add(x, bt(start_bar), G["riser"])
        send.add(x, bt(start_bar), G["riser"] * 0.3)
    for target_bar in (2, 6, 12, 17, 21, 25, 29, 31):
        sw = db.swell(1.1)
        gap = 0.0 if target_bar != 17 else 0.3 * db.EIGHTH
        fx.add(sw, bt(target_bar) - 1.1 - gap, G["swell"] * (1.0 if target_bar in (2, 17, 25) else 0.7))
        send.add(sw, bt(target_bar) - 1.1 - gap, G["swell"] * 0.4)

    # side-chain pumping
    sc = np.ones(N, np.float32)
    rel = int(0.36 * SR)
    tt = np.arange(rel) / SR
    for tk, vel in kick_times:
        i = int(tk * SR)
        duck = 1 - 0.65 * min(1.0, vel) * np.exp(-tt / 0.11) * np.minimum(1, tt / 0.004)
        seg = sc[i:i + rel]
        sc[i:i + rel] = np.minimum(seg, duck[: len(seg)])
    music.l *= sc
    music.r *= sc
    keys.l *= 0.7 + 0.3 * sc
    keys.r *= 0.7 + 0.3 * sc

    buses = dict(drums=drums, bass=bass, music=music, keys=keys, fx=fx)
    gate = np.ones(N, np.float32)
    g0, g1 = int((bt(17) - 0.5 * db.EIGHTH) * SR), int(bt(17) * SR)
    ramp = int(0.012 * SR)
    gate[g0:g1] = 0.0
    gate[g0 - ramp:g0] = np.linspace(1, 0, ramp)
    for bus in list(buses.values()) + [send]:
        bus.l *= gate
        bus.r *= gate

    wet_l = db.convolve(send.l, db.make_ir(7, 2.3))
    wet_r = db.convolve(send.r, db.make_ir(8, 2.3))
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
    db.save_wav(base + ".wav", left, right)
    db.save_mp3(base + ".mp3", left, right)
    print("written", base + ".mp3")


if __name__ == "__main__":
    main()
