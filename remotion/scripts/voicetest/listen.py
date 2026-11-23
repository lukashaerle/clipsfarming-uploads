"""Listen to a finished narration the way a careful editor would, and say what is wrong with it.

    python -I listen.py <timeline json written by vo_mix.py> <src/motiv/script.ts> <folder for the pictures> [align.json]

vo_mix.py must have been run with voice=<wav>, so the voice alone exists. The checks:
  cuts     Is there sound right outside any cut in the recording? Then a word, a tail or a breath was cut through.
  edges    Does every sentence start and end in silence in the finished track?
  words    Does speech recognition hear every word of the script, inside the right sentence, and how sure is it?
  level    Is any sentence clearly louder or quieter than the others?
  flow     The pauses between the sentences, and which sentence was moved, sped up or shortened.
It also draws every sentence ending and beginning as a spectrogram (time left to right, pitch bottom to top,
bright = loud) with the cut marked, so the cuts can be looked at: <folder>/enden.png and <folder>/anfaenge.png.
With an align.json it also reports how the old rule (cut by the word times alone) would have done.
Exit code 1 if something needs attention.
"""
import difflib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "motiv"))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import vo_mix as vm  # noqa: E402
import voice_profile as vp  # noqa: E402
import vtlib  # noqa: E402

SR = vm.SR
HOP = vm.HOP


def norm_tokens(text):
    out = []
    for w in text.lower().replace("wachenstunden", "wachen stunden").split():
        w = re.sub(r"\d+", lambda m: vp.zahl(int(m.group(0))), w)
        w = re.sub(r"[^a-zäöüß]", "", w)
        if w:
            out.append({"eins": "eine", "ein": "eine"}.get(w, w))
    return out


def level_at(rel, t0, t1):
    k0, k1 = max(0, int(t0 / HOP)), max(1, int(t1 / HOP))
    seg = rel[k0:k1]
    return float(seg.max()) if len(seg) else -99.0


def spec_tile(x, t_from, t_to, ref, marks, width=236, height=132, fmax=8000):
    a, b = max(0, int(t_from * SR)), min(len(x), int(t_to * SR))
    seg = x[a:b]
    nfft, hop = 1024, 120
    if len(seg) < nfft + hop:
        seg = np.pad(seg, (0, nfft + hop - len(seg)))
    frames = 1 + (len(seg) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(frames)[:, None]
    mag = np.abs(np.fft.rfft(seg[idx] * np.hanning(nfft), axis=1))[:, : int(fmax / (SR / nfft))]
    v = np.clip((20 * np.log10(mag + 1e-7) - ref + 85) / 85, 0, 1).T[::-1]          # rows: high pitch at the top
    rgb = np.stack([v ** 0.75 * 255, v ** 1.5 * 235, v ** 3.0 * 160], axis=2).astype(np.uint8)
    im = Image.fromarray(rgb).resize((width, height), Image.BILINEAR)
    d = ImageDraw.Draw(im)
    for t, colour in marks:
        if t_from <= t <= t_to:
            xpix = int((t - t_from) / (t_to - t_from) * (width - 1))
            d.line([(xpix, 0), (xpix, height)], fill=colour, width=2)
    return im


def sheet(tiles, labels, path, cols=5, title=""):
    w, h = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * (w + 6) + 6, rows * (h + 22) + 28), (14, 14, 18))
    d = ImageDraw.Draw(canvas)
    d.text((8, 6), title, fill=(230, 230, 230))
    for i, (im, lab) in enumerate(zip(tiles, labels)):
        x0, y0 = 6 + (i % cols) * (w + 6), 26 + (i // cols) * (h + 22)
        canvas.paste(im, (x0, y0 + 14))
        d.text((x0 + 2, y0), lab, fill=(200, 200, 200))
    canvas.save(path)


def main():
    tl_path, script_ts, out_dir = sys.argv[1:4]
    align_path = sys.argv[4] if len(sys.argv) > 4 else None
    tl = json.load(open(tl_path, encoding="utf-8"))
    sent = tl["sentences"]
    take = vtlib.load_audio(tl["narration"], SR)
    voice = vtlib.load_audio(tl["voice"], SR)
    rel_take, rel_voice = vm.envelope(take), vm.envelope(voice)
    problems = []

    # ---- cuts: sound right outside a cut in the recording means something was cut through
    worst = -99.0
    for s in sent:
        before, after = level_at(rel_take, s["take_a"] - 0.04, s["take_a"]), level_at(rel_take, s["take_b"], s["take_b"] + 0.04)
        worst = max(worst, before, after)
        if before > -55 and s["id"] != sent[0]["id"]:
            problems.append("%s: sound right before its cut-in (%.0f dB)%s" % (s["id"], before, ", glued to the previous sentence" if s.get("glued") else ""))
        if after > -55:
            problems.append("%s: sound right after its cut-out (%.0f dB)%s" % (s["id"], after, ", glued to the next sentence" if s.get("glued") else ""))
    print("CUTS   %d sentences | loudest sound right outside a cut: %.0f dB (silence is below -60)" % (len(sent), worst))

    # ---- edges of every sentence in the finished track
    edge = -99.0
    loud = float(np.percentile(20 * np.log10(np.abs(voice[np.abs(voice) > 1e-4]) + 1e-9), 90))
    rms_db = lambda seg: 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) - loud if len(seg) else -99.0
    for s in sent:
        i0, i1 = int(s["piece_start"] * SR), int(s["piece_end"] * SR)
        e0, e1 = rms_db(voice[i0:i0 + int(0.004 * SR)]), rms_db(voice[i1 - int(0.004 * SR):i1])
        edge = max(edge, e0, e1)
        if max(e0, e1) > -50:
            problems.append("%s: the finished track is not silent at its edge (%.0f / %.0f dB)" % (s["id"], e0, e1))
    print("EDGES  loudest level at a sentence edge in the finished track: %.0f dB" % edge)

    # ---- words: every sentence is cut out of the finished track and heard on its own,
    #      so a word that ended up in the wrong sentence or lost a syllable shows
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=os.environ.get("LISTEN_DOWNLOAD") != "1")
    except Exception as e:  # no recognition model on this machine (the cloud may not reach it)
        model = None
        print("WORDS  skipped, no recognition model here (%s)" % type(e).__name__)
    v16 = vtlib.load_audio(tl["voice"], 16000)
    total_script = total_heard = 0
    weak, words = [], []
    for s in (sent if model else []):
        seg = v16[max(0, int((s["piece_start"] - 0.05) * 16000)):int((s["piece_end"] + 0.05) * 16000)]
        segs, _ = model.transcribe(seg, language="de", beam_size=5, word_timestamps=True, condition_on_previous_text=False)
        mine = [{"w": w.word.strip(), "s": float(w.start) + s["piece_start"] - 0.05, "e": float(w.end) + s["piece_start"] - 0.05, "p": float(w.probability), "id": s["id"]} for sg in segs for w in (sg.words or [])]
        words += mine
        want, got = norm_tokens(s["text"]), norm_tokens(" ".join(w["w"] for w in mine))
        sm = difflib.SequenceMatcher(None, want, got, autojunk=False)
        hit = sum(b.size for b in sm.get_matching_blocks())
        total_script += len(want)
        total_heard += hit
        if hit < len(want) or len(got) > len(want):
            problems.append("%s: script %r | heard %r" % (s["id"], s["text"], " ".join(w["w"] for w in mine)))
        weak += [(w["p"], s["id"], w["w"], w["s"]) for w in mine if w["p"] < 0.5]
    weak.sort()
    if model: print("WORDS  %d of %d script words heard, each sentence listened to on its own | words the recognition was unsure about: %s" % (
        total_heard, total_script, ", ".join("%s %r (%.2f)" % (sid, w, p) for p, sid, w, _ in weak[:6]) or "none"))

    # ---- level of each sentence
    lv = []
    for s in sent:
        seg = voice[int(s["start"] * SR):int(s["end"] * SR)]
        lv.append(20 * np.log10(vtlib.speech_rms(seg, SR) + 1e-9))
    med = float(np.median(lv))
    for s, v in zip(sent, lv):
        if abs(v - med) > 3.0:
            problems.append("%s: %.1f dB %s than the other sentences" % (s["id"], abs(v - med), "louder" if v > med else "quieter"))
    print("LEVEL  sentences between %.1f and %.1f dBFS (middle %.1f)" % (min(lv), max(lv), med))

    # ---- flow
    gaps = [sent[i + 1]["start"] - sent[i]["end"] for i in range(len(sent) - 1)]
    moved = ["%s starts %.2f s early" % (s["id"], s["early"]) for s in sent if s["early"] > 0.005] + ["%s ends %.2f s late" % (s["id"], s["late"]) for s in sent if s["late"] > 0.005]
    fast = ["%s x%.3f" % (s["id"], s["tempo"]) for s in sent if s["tempo"] > 1.0]
    short = ["%s -%.2f s" % (s["id"], s["pause_cut"]) for s in sent if s["pause_cut"] > 0]
    for i, g in enumerate(gaps):
        if g < (0.08 if tl.get("style") in ("action", "punch", "story") else 0.2):   # the action style keeps its pauses short on purpose
            problems.append("%s -> %s: only %.2f s between the sentences" % (sent[i]["id"], sent[i + 1]["id"], g))
    for s in sent:
        if s["tempo"] > vm.SOFT_TEMPO:
            problems.append("%s: sped up by %.0f %%, listen to it" % (s["id"], (s["tempo"] - 1) * 100))
        if s.get("glued"):
            problems.append("%s: no pause to its neighbour in the recording, the cut is audible; record again" % s["id"])
    print("FLOW   pauses between sentences %.2f to %.2f s | moved: %s | sped up: %s | pauses shortened: %s" % (
        min(gaps), max(gaps), ", ".join(moved) or "none", ", ".join(fast) or "none", ", ".join(short) or "none"))

    # ---- pauses the script does not ask for (a hesitation in the middle of a phrase)
    al = json.load(open(align_path, encoding="utf-8"))["slots"] if align_path else None
    if al:
        runs = vm.silent_runs(rel_take)
        inside = []
        for s, a_s in zip(sent, al):
            ws = a_s.get("words", [])
            for r0, r1 in runs:
                if r1 - r0 < vm.PAUSE_MIN or r0 < s["take_on"] or r1 > s["take_off"]:
                    continue
                before = [w for w in ws if w["s"] < r0 + 0.05]
                last = before[-1]["w"] if before else ""
                inside.append((s["id"], last, r1 - r0))
                if last and not re.search(r"[.,;:!?…-]$", last):
                    problems.append("%s: a pause of %.2f s after %r, where the script has no comma or full stop" % (s["id"], r1 - r0, last))
        print("PAUSES inside sentences: %s" % (", ".join("%s after %r %.2f s" % x for x in inside) or "none"))

    # ---- the old rule, for comparison
    if align_path:
        bad_tail = bad_head = 0
        for i, s in enumerate(al):
            prev_e = al[i - 1]["end"] if i else 0.0
            next_s = al[i + 1]["start"] if i + 1 < len(al) else len(take) / SR
            a = max((prev_e + s["start"]) / 2, s["start"] - 0.06)
            b = min((s["end"] + next_s) / 2, s["end"] + 0.14)
            bad_head += level_at(rel_take, a - 0.03, a + 0.005) > -55
            bad_tail += level_at(rel_take, b, b + 0.05) > -55
        print("OLD    cutting by the word times alone: %d of %d sentence endings and %d beginnings cut through sound" % (bad_tail, len(al), bad_head))

    # ---- pictures
    os.makedirs(out_dir, exist_ok=True)
    nf = 1024
    ref = 20 * np.log10(np.abs(np.fft.rfft(take[: (len(take) // nf) * nf].reshape(-1, nf) * np.hanning(nf), axis=1)).max() + 1e-7)
    old = {}
    if align_path:
        for i, s in enumerate(al):
            prev_e = al[i - 1]["end"] if i else 0.0
            next_s = al[i + 1]["start"] if i + 1 < len(al) else len(take) / SR
            old[s["id"]] = (max((prev_e + s["start"]) / 2, s["start"] - 0.06), min((s["end"] + next_s) / 2, s["end"] + 0.14))
    ends = [spec_tile(take, s["take_b"] - 0.55, s["take_b"] + 0.25, ref, [(s["take_b"], (60, 255, 90))] + ([(old[s["id"]][1], (255, 70, 70))] if s["id"] in old else [])) for s in sent]
    starts = [spec_tile(take, s["take_a"] - 0.25, s["take_a"] + 0.55, ref, [(s["take_a"], (60, 255, 90))] + ([(old[s["id"]][0], (255, 70, 70))] if s["id"] in old else [])) for s in sent]
    sheet(ends, [s["id"] + " Ende" for s in sent], os.path.join(out_dir, "enden.png"), title="Satzenden in der Aufnahme, je 0,8 s. Gruen = Schnitt jetzt, rot = Schnitt nach alter Regel. Hell = Stimme.")
    sheet(starts, [s["id"] + " Anfang" for s in sent], os.path.join(out_dir, "anfaenge.png"), title="Satzanfaenge in der Aufnahme, je 0,8 s. Gruen = Schnitt jetzt, rot = Schnitt nach alter Regel.")
    json.dump({"problems": problems, "words": words}, open(os.path.join(out_dir, "listen_report.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    if problems:
        print("ATTENTION:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)
    print("Nothing found that needs attention.")


if __name__ == "__main__":
    main()
