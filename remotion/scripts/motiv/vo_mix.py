"""Put every narrated sentence on its slot and mix music and sound effects underneath.

    python -I vo_mix.py <narration audio> <align.json from vo_align.py> <music file> <out_mix.mp3> [video length in s]
                        [sfx=<stereo wav from sfx.py>] [bed=0.28] [duck=0.16] [open=0.55] [voice=<wav, the voice alone>]

bed, duck and open are the music levels between sentences, under the voice, and before the first / after the
last word. They depend on how loud the music file is, so read the printed difference to the voice.

How the sentences are cut out of the recording
  The word times of the speech recognition are only a rough guide: they end up to 0.3 s before the voice does.
  So this script listens to the recording itself. It finds every stretch of true silence and cuts only there,
  which means each sentence keeps everything from its first sound to the end of its last sound.
How the sentences are placed
  Each sentence wants to start 0.1 s after its bar line. Where neighbours are too long for that, the whole
  group is spread so that a natural pause stays between all of them and each is as close to its bar line as
  possible: some start a little early (while the picture already dissolves), some a little late.
  Pauses inside a sentence are shortened first if it does not fit its slot, cutting only inside silence.
  Only if nothing else works a sentence is sped up without changing the pitch (the script says so; listen to it).
Writes the mix (stereo MP3), <out_mix>.json with every sentence and where it was cut, and on request the voice alone.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "voicetest"))
sys.path.insert(0, os.path.join(HERE, "..", "music"))

import av  # noqa: E402
import numpy as np  # noqa: E402

import darkbeat  # noqa: E402  (only for its stereo MP3 writer)
import tighten  # noqa: E402  (ffmpeg filters: tempo without pitch change, compressor)
import vtlib  # noqa: E402

SR = 48000
HOP = 0.005            # the level of the voice is measured every 5 ms over 20 ms
FIRST_WORD = 0.10      # seconds after the bar line at which a sentence starts
SLOT_TAIL = 0.10       # a sentence should end this long before its slot ends
MUSIC_BED = 0.28       # music level under the narrated part
MUSIC_DUCK = 0.16      # music level while someone speaks
MUSIC_OPEN = 0.55      # music level before the first and after the last word
SIL_DB = -60.0         # below this (relative to loud speech) the recording is silent
SPEECH_DB = -30.0      # above this someone is clearly speaking
AUDIBLE_DB = -42.0     # the end of a sentence for timing; its quieter tail is kept but not counted
PAUSE_MIN = 0.12       # a silence inside a sentence counts as a pause from this length (shorter ones are p, t, k)
PAUSE_SIL = 0.26       # silence left in a pause when it has to be shortened
EARLY_MAX = 0.45       # a sentence may start this long before its bar line (the dissolve starts 0.32 s before it)
LATE_MAX = 0.40        # ... and end this long after its slot
GAP = 0.28             # pause that stays between two sentences, as in natural speech
GAP_MIN = 0.22         # ... and the shortest it may get before a sentence is sped up instead
EDGE = 0.03            # silence kept before the first and after the last sound of a sentence
SOFT_TEMPO = 1.04      # a speed-up nobody notices
MAX_TEMPO = 1.12       # the most a sentence may be sped up
VOICE_COMP = "threshold=-19dB:ratio=2:attack=15:release=180:makeup=1.5dB:knee=5"   # gentle levelling of the voice


def envelope(x):
    """Level of the voice in dB relative to loud speech. Frame k covers the time k*HOP to k*HOP + 0.02 s."""
    hop, win = int(HOP * SR), int(0.02 * SR)
    n = (len(x) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    db = 20 * np.log10(np.sqrt(np.mean(x[idx] ** 2, axis=1)) + 1e-9)
    return db - float(np.percentile(db, 90))


def silent_runs(rel, min_len=0.03):
    """Stretches of true silence as (start, end) in seconds."""
    sil = rel < SIL_DB
    runs, i, n = [], 0, len(rel)
    while i < n:
        if sil[i]:
            j = i
            while j < n and sil[j]:
                j += 1
            t0, t1 = i * HOP, (j - 1) * HOP + 0.02
            if t1 - t0 >= min_len:
                runs.append((t0, t1))
            i = j
        else:
            i += 1
    return runs


def boundary(si, sj, runs, rel):
    """The silence between two sentences: (start, end, found). The word times only say where to look."""
    w0 = si["words"][-1]["s"] + 0.03 if si.get("words") else si["end"] - 0.25
    w1 = max(sj["words"][0]["e"] if sj.get("words") else sj["start"] + 0.3, sj["start"] + 0.15)
    cands = [r for r in runs if r[1] > w0 and r[0] < w1 and r[1] - r[0] >= 0.10]
    if cands:
        # the silence nearest to where the recognition puts the border; a pause inside a sentence
        # ("Keine Zeit? ... Doch.") can be longer than the pause after it, so length alone would mislead
        e = si["words"][-1]["e"] if si.get("words") else si["end"]
        st = sj["words"][0]["s"] if sj.get("words") else sj["start"]
        tb = (e + st) / 2
        dist = lambda r: 0.0 if r[0] <= tb <= r[1] else min(abs(tb - r[0]), abs(tb - r[1]))
        r = min(cands, key=lambda r: (round(dist(r), 2), -(r[1] - r[0])))
        return r[0], r[1], True
    # no silence there: the two sentences run into each other; cut at the quietest moment
    k0, k1 = int(max(0.0, si["end"] - 0.15) / HOP), int((sj["start"] + 0.15) / HOP)
    k = k0 + int(np.argmin(rel[k0:k1]))
    return k * HOP + 0.01, k * HOP + 0.01, False


def shorten_pauses(piece, pauses, t_a):
    """Cut the middle out of long silences inside a sentence. pauses: (start, end) in the recording."""
    out, pos, cut = [], 0, 0.0
    fade = int(0.004 * SR)
    piece = piece.copy()
    for r0, r1 in pauses:
        if r1 - r0 <= PAUSE_SIL + 0.04:
            continue
        c0 = int((r0 + PAUSE_SIL / 2 - t_a) * SR)
        c1 = int((r1 - PAUSE_SIL / 2 - t_a) * SR)
        piece[c0 - fade:c0] *= np.linspace(1, 0, fade)
        piece[c1:c1 + fade] *= np.linspace(0, 1, fade)
        out.append(piece[pos:c0])
        pos = c1
        cut += (c1 - c0) / SR
    out.append(piece[pos:])
    return np.concatenate(out), cut


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
    st = np.concatenate(ch, axis=1)
    return st[0].astype(np.float32), st[1].astype(np.float32)


def smooth_env(x, attack, release):
    """one-pole follower with separate attack and release times (seconds)"""
    a = np.exp(-1.0 / (attack * SR))
    r = np.exp(-1.0 / (release * SR))
    out = np.empty_like(x)
    y = 0.0
    for i, v in enumerate(x):
        y = (a if v > y else r) * y + (1 - (a if v > y else r)) * v
        out[i] = y
    return out


def cut_sentences(narr, slots):
    """Where every sentence really starts and ends in the recording."""
    rel = envelope(narr)
    runs = silent_runs(rel)
    total = len(narr) / SR
    snd = np.where(rel > SIL_DB)[0]
    first_sound, last_sound = snd[0] * HOP, snd[-1] * HOP + 0.02
    bnd = [boundary(slots[i], slots[i + 1], runs, rel) for i in range(len(slots) - 1)]
    res = []
    for i, s in enumerate(slots):
        glued_in = i > 0 and not bnd[i - 1][2]
        glued_out = i + 1 < len(slots) and not bnd[i][2]
        a = max(0.0, first_sound - EDGE) if i == 0 else (bnd[i - 1][1] if glued_in else bnd[i - 1][1] - EDGE)
        b = min(total, last_sound + 0.3) if i + 1 == len(slots) else (bnd[i][0] if glued_out else bnd[i][0] + EDGE)   # the last sentence keeps its whole decay
        k0, k1 = int(a / HOP), min(len(rel), int(b / HOP))
        seg = rel[k0:k1]
        loud = np.where(seg > SPEECH_DB)[0]
        on_k = next((k for k in loud if np.mean(seg[k:k + 6] > SPEECH_DB) >= 0.6), loud[0] if len(loud) else 0)
        aud = np.where(seg > AUDIBLE_DB)[0]
        off_k = aud[-1] if len(aud) else len(seg) - 1
        on, off = (k0 + on_k) * HOP + 0.01, (k0 + off_k) * HOP + 0.01
        # a breath or click that stands alone before the sentence is left out
        lead_sil = [r for r in runs if r[0] > a + 0.02 and r[1] < on and r[1] - r[0] >= 0.04]
        if lead_sil:
            a = lead_sil[-1][1] - EDGE
        pauses = [r for r in runs if r[0] > on and r[1] < off and r[1] - r[0] >= PAUSE_MIN]
        res.append(dict(a=a, b=b, on=on, off=off, pauses=pauses, glued_in=glued_in, glued_out=glued_out,
                        gap_after=(bnd[i][1] - bnd[i][0]) if i + 1 < len(slots) else 0.0))
    return res


def schedule(slots, durs, leads, length, gap=None):
    """Start time of every sentence: as close as possible to 0.1 s after its bar line (least squares),
    with a pause of `gap` between neighbours. Returns the starts and the sentences that still do not fit."""
    gap = GAP if gap is None else gap
    n = len(slots)
    off = [0.0]
    for i in range(1, n):
        off.append(off[-1] + durs[i - 1] + gap)
    z = [slots[i]["t0"] + FIRST_WORD - off[i] for i in range(n)]
    blocks = []                                    # pool adjacent violators
    for v in z:
        blocks.append([v, 1])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            v2, c2 = blocks.pop()
            blocks[-1][0] += v2
            blocks[-1][1] += c2
    y = [v / c for v, c in blocks for _ in range(c)]
    lb = [max(slots[i]["t0"] - EARLY_MAX, leads[i] + 0.005 if i == 0 else -1e9) - off[i] for i in range(n)]
    ub = [min(slots[i]["t1"] + LATE_MAX, length - 1.0) - durs[i] - off[i] for i in range(n)]
    for i in range(n):
        y[i] = max(y[i], lb[i], y[i - 1] if i else -1e9)
    for i in range(n - 1, -1, -1):
        y[i] = min(y[i], ub[i], y[i + 1] if i + 1 < n else 1e9)
    bad = [i for i in range(n) if y[i] < lb[i] - 1e-6]
    return [y[i] + off[i] for i in range(n)], bad


def main():
    args = [x for x in sys.argv[1:] if "=" not in x]
    opt = dict(x.split("=", 1) for x in sys.argv[1:] if "=" in x)
    narr_path, align_path, music_path, out_path = args[:4]
    length = float(args[4]) if len(args) > 4 else 65.0
    m_bed, m_duck, m_open = float(opt.get("bed", MUSIC_BED)), float(opt.get("duck", MUSIC_DUCK)), float(opt.get("open", MUSIC_OPEN))
    n = int(length * SR)
    narr = vtlib.load_audio(narr_path, SR)
    with open(align_path, encoding="utf-8") as fh:
        slots = json.load(fh)["slots"]
    cuts = cut_sentences(narr, slots)

    # the pieces and their lengths; pauses inside a sentence are shortened only if it does not fit its slot
    parts = []
    for s, c in zip(slots, cuts):
        piece = narr[int(c["a"] * SR):int(c["b"] * SR)].copy()
        lead, dur, cut = c["on"] - c["a"], c["off"] - c["on"], 0.0
        if dur > s["t1"] - s["t0"] - FIRST_WORD - SLOT_TAIL and c["pauses"]:
            piece, cut = shorten_pauses(piece, c["pauses"], c["a"])
            dur -= cut
        parts.append(dict(piece=piece, lead=lead, dur=dur, natural=dur, cut=cut, tempo=1.0))
    gap = GAP
    starts, bad = schedule(slots, [p["dur"] for p in parts], [p["lead"] for p in parts], length, gap)
    while bad and gap > GAP_MIN + 1e-9:     # crowded: first let the pauses in the crowded spot get a little shorter
        gap = max(GAP_MIN, gap - 0.02)
        starts, bad = schedule(slots, [p["dur"] for p in parts], [p["lead"] for p in parts], length, gap)
    tries = 0
    while bad and tries < 6:        # nothing else works: speed up the crowded sentences a little and try again
        i = bad[0]
        j = i
        while j + 1 < len(parts) and starts[j + 1] - (starts[j] + parts[j]["dur"]) <= gap + 1e-3:
            j += 1
        for q in range(i, j + 1):
            parts[q]["tempo"] = min(MAX_TEMPO, parts[q]["tempo"] + 0.02)
            parts[q]["dur"] = parts[q]["natural"] / parts[q]["tempo"]
        starts, bad = schedule(slots, [p["dur"] for p in parts], [p["lead"] for p in parts], length, gap)
        tries += 1
    if gap < GAP:
        print("crowded: the pause between neighbouring sentences is %.2f s instead of %.2f s where they are tight" % (gap, GAP))

    track = np.zeros(n, np.float32)
    timeline = []
    for i, (s, c, p) in enumerate(zip(slots, cuts, parts)):
        piece, lead, dur, tempo = p["piece"], p["lead"], p["dur"], p["tempo"]
        if tempo > 1:
            piece = tighten.run_filters(piece, [("atempo", "%.4f" % tempo)])
            lead = lead / tempo
        soft = c["glued_in"] or c["glued_out"]
        fi, fo = int((0.02 if c["glued_in"] else 0.005) * SR), int((0.02 if c["glued_out"] else 0.008) * SR)
        piece[:fi] *= np.linspace(0, 1, fi)
        piece[-fo:] *= np.linspace(1, 0, fo)
        t_word = starts[i]
        i0 = max(0, int((t_word - lead) * SR))
        piece = piece[: max(0, n - i0)]
        track[i0:i0 + len(piece)] += piece
        end = t_word + dur
        early, late = max(0.0, s["t0"] - t_word), max(0.0, end - s["t1"])
        timeline.append({"id": s["id"], "text": s["vo"], "start": round(t_word, 3), "end": round(end, 3), "t0": s["t0"], "t1": s["t1"],
                         "piece_start": round(i0 / SR, 4), "piece_end": round((i0 + len(piece)) / SR, 4),
                         "take_a": round(c["a"], 3), "take_b": round(c["b"], 3), "take_on": round(c["on"], 3), "take_off": round(c["off"], 3),
                         "pause_cut": round(p["cut"], 2), "tempo": round(tempo, 3), "early": round(early, 2), "late": round(late, 2),
                         "after_bar": round(t_word - s["t0"], 2), "gap_after_in_take": round(c["gap_after"], 2), "glued": bool(soft)})
        notes = ["%+.2f s to the bar" % (t_word - s["t0"])]
        if p["cut"]:
            notes.append("pauses -%.2f s" % p["cut"])
        if late > 0.005:
            notes.append("ends %.2f s after the slot" % late)
        if tempo > 1:
            notes.append("TEMPO x%.3f" % tempo)
        if c["glued_out"]:
            notes.append("NO PAUSE to the next sentence in the recording")
        if i in bad:
            notes.append("DOES NOT FIT")
        print("%s  spoken %5.2f-%5.2f  slot %4.1f-%4.1f  length %.2f s  %s" % (s["id"], t_word, end, s["t0"], s["t1"], dur, "  ".join(notes)))

    # voice: cut the rumble, even out the level gently, then set the loudness
    comp = tighten.run_filters(track, [("highpass", "f=70"), ("acompressor", VOICE_COMP)])
    track = np.pad(comp, (0, max(0, n - len(comp))))[:n].astype(np.float32)
    g = (10 ** (-15 / 20.0)) / max(vtlib.speech_rms(track, SR), 1e-6)
    track = vtlib.soft_limit(track * g, knee=0.75, ceil=0.97)
    if "voice" in opt:
        os.makedirs(os.path.dirname(os.path.abspath(opt["voice"])), exist_ok=True)
        vtlib.save_wav(opt["voice"], track, SR)

    # music level: calm bed, slight dip under speech, a bit more room before the first and after the last word
    ml, mr = load_stereo(music_path)
    ml = np.pad(ml, (0, max(0, n - len(ml))))[:n]
    mr = np.pad(mr, (0, max(0, n - len(mr))))[:n]
    win = int(0.03 * SR)
    k = n // win
    rms = np.sqrt(np.mean(track[: k * win].reshape(k, win) ** 2, axis=1))
    act = np.repeat((rms > 0.012).astype(np.float32), win)
    act = np.pad(act, (0, n - len(act)))
    env = smooth_env(act, 0.12, 0.6)
    t = np.arange(n) / SR
    first_word, last_word = timeline[0]["start"], timeline[-1]["end"]
    bed = np.interp(t, [0, max(0.01, first_word - 0.05), first_word + 0.4, last_word + 0.3, last_word + 1.4], [m_open, m_open, m_bed, m_bed, m_open])
    gain = (bed - (m_bed - m_duck) * env).astype(np.float32)
    left = ml * gain + track
    right = mr * gain + track
    if "sfx" in opt:   # sound effects come in at the level they were made at
        fl, fr = load_stereo(opt["sfx"])
        fl = np.pad(fl, (0, max(0, n - len(fl))))[:n]
        fr = np.pad(fr, (0, max(0, n - len(fr))))[:n]
        left, right = left + fl, right + fr
    peak = max(float(np.max(np.abs(left))), float(np.max(np.abs(right))))
    if peak > 0.95:
        left, right = left * (0.95 / peak), right * (0.95 / peak)
    if length < 30:  # a short sample: let it end softly
        fo = int(0.6 * SR)
        ramp = np.linspace(1, 0, fo) ** 2
        left[-fo:] *= ramp
        right[-fo:] *= ramp
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    darkbeat.save_mp3(out_path, left, right)
    with open(os.path.splitext(out_path)[0] + ".json", "w", encoding="utf-8") as fh:
        json.dump({"length": length, "narration": os.path.abspath(narr_path), "voice": os.path.abspath(opt["voice"]) if "voice" in opt else None,
                   "sentences": timeline}, fh, indent=1, ensure_ascii=False)
    db = lambda v: round(float(20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9)), 1)
    sp = act > 0.5
    print("voice while speaking: %s dBFS | music under the voice: %s dBFS | difference: %.1f dB" % (db(track[sp]), db((ml * gain)[sp]), db(track[sp]) - db((ml * gain)[sp])))
    print("mix peak %.2f | written %s" % (min(peak, 0.95), out_path))


if __name__ == "__main__":
    main()
