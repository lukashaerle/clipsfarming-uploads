"""Turn one narration take into the finished sound of a Lebensrechnung video, and work out its timing.

    python -I build_audio.py <spec.json> <take.mp3> <out_dir> [--words words.json] [--public public/lr]

1. Find every scene's sentences in the take: word times from --words (ElevenLabs Scribe, in the cloud) or from
   a local Whisper run, matched to the script.
2. Cut the scenes only where the take is truly silent (the cutting of scripts/motiv/vo_mix.py) and lay them one
   after another with a natural pause; the scenes of the video follow the voice, not a fixed grid.
3. Music: the ambient bed stretched to the length. Sound effects: chosen from the graphic of every scene.
4. Mix (voice about 14 dB over the music), write <public>/<id>.mp3 and the timeline the video reads.
Also writes the files scripts/voicetest/listen.py needs: <out>/mix.json, <out>/voice.wav, <out>/align.json.
"""
import difflib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
for sub in ("motiv", "voicetest", "music"):
    sys.path.insert(0, os.path.join(HERE, "..", sub))

import numpy as np  # noqa: E402

import darkbeat  # noqa: E402
import tighten  # noqa: E402
import vo_mix as vm  # noqa: E402
import voice_profile as vp  # noqa: E402
import vtlib  # noqa: E402

SR = vm.SR
LEAD_IN = 0.55       # first word after the video starts
GAP_MAX = 0.60       # longest pause between two scenes
GAP_MIN = 0.35       # shortest pause between two scenes
SCENE_EARLY = 0.25   # a scene's picture starts this long before its first word
TAIL = 1.7           # picture after the last word
MUSIC_BED, MUSIC_DUCK, MUSIC_OPEN = 0.52, 0.42, 0.80

# How a style changes the sound. 'action' (spec["style"]): the voice a little faster (pitch kept), short pauses,
# every cut on the eighth-note grid of the beat (120 BPM), a driving beat instead of the ambient bed, louder effects.
STYLES = {
    None: dict(lead_in=LEAD_IN, gap_min=GAP_MIN, gap_max=GAP_MAX, early=SCENE_EARLY, tail=TAIL, tempo=1.0, grid=0.0, music="ambient"),
    "action": dict(lead_in=0.15, gap_min=0.10, gap_max=0.22, early=0.06, tail=1.1, tempo=1.10, grid=0.25, music="beat"),
}


def norm(w):
    w = w.lower().replace("%", "prozent")
    w = re.sub(r"\d+", lambda m: vp.zahl(int(m.group(0))), w)
    return re.sub(r"[^a-zäöüß]", "", w)


def whisper_words(path):
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=False)
    segs, _ = model.transcribe(path, language="de", beam_size=5, word_timestamps=True)
    return [{"w": w.word.strip(), "s": float(w.start), "e": float(w.end)} for s in segs for w in (s.words or [])]


def align(spec, words):
    """Every scene gets start, end and its words in the take."""
    heard = [norm(w["w"]) for w in words]
    toks, owner, raw = [], [], []
    for i, sc in enumerate(spec["scenes"]):
        for tok in sc["vo"].split():
            n = norm(tok)
            if n:
                toks.append(n)
                owner.append(i)
                raw.append(tok)
    sm = difflib.SequenceMatcher(None, toks, heard, autojunk=False)
    pos = [None] * len(toks)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                pos[i1 + k] = j1 + k
        elif tag == "replace":
            for k in range(i2 - i1):
                pos[i1 + k] = min(j2 - 1, j1 + int(k * (j2 - j1) / max(1, i2 - i1)))
    last = 0
    for k in range(len(pos)):
        if pos[k] is None:
            pos[k] = last
        last = pos[k]
    out = []
    for i, sc in enumerate(spec["scenes"]):
        ks = [k for k in range(len(owner)) if owner[k] == i]
        idx = [pos[k] for k in ks]
        a, b = min(idx), max(idx)
        out.append({"id": "s%02d" % (i + 1), "vo": sc["vo"], "start": words[a]["s"], "end": words[b]["e"],
                    "heard": " ".join(w["w"] for w in words[a:b + 1]), "words": words[a:b + 1],
                    "tok": [{"t": raw[k], "s": words[pos[k]]["s"], "e": words[pos[k]]["e"]} for k in ks]})
    # quality: compare the letters, not the word boundaries (Whisper writes "37-fachen" as two words, "1 %" as "1 Prozent" ...)
    a, b = "".join(toks), "".join(heard)
    return out, difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def cues_for(spec):
    """Sound effects that fit each graphic (times in seconds after the scene starts)."""
    cues = {}
    for i, sc in enumerate(spec["scenes"]):
        g, ev = sc["graphic"], []
        k = g["kind"]
        if k == "statement":
            ev.append({"k": "impulse", "at": 0.25, "v": 1.1 if i in (0, len(spec["scenes"]) - 1) else 0.8})
        elif k == "counter":
            ev += [{"k": "bloom", "at": 0.25, "d": 1.2, "v": 0.7}, {"k": "impulse", "at": 1.65}]
            ev += [{"k": "click", "at": 1.3 + j * 0.45 + 0.2, "x": 540, "p": j} for j in range(len(g.get("chips", [])))]
        elif k == "bars":
            ev += [{"k": "click", "at": 0.3 + j * 0.35 + 0.2, "x": 300, "p": j} for j in range(len(g["bars"]))]
        elif k == "grid":
            ev += [{"k": "click", "v": 0.6, "roll": {"n": min(8, max(3, g["hi"])), "at": 0.55, "step": 0.18, "x": 300, "dx": 60}}]
        elif k == "ring":
            ev += [{"k": "bloom", "at": 0.35, "d": 1.5, "v": 0.7}, {"k": "impulse", "at": 2.0, "v": 0.8}]
        elif k == "clock":
            ev += [{"k": "tok", "at": 0.3 + j * 0.6, "x": 540, "p": j} for j in range(len(g["times"]))]
        elif k == "blocks":
            ev += [{"k": "click", "v": 0.7, "roll": {"n": min(g["n"], 8), "at": 0.3, "step": 0.15, "x": 200, "dx": 90}}]
        elif k == "timeline":
            ev += [{"k": "click", "at": 0.55 + j * 0.3, "x": 540, "p": j} for j in range(len(g["marks"]))]
        elif k == "compare":
            ev += [{"k": "tok", "at": 0.35, "x": 315}, {"k": "impulse", "at": 1.05, "v": 0.8}]
        elif k == "chips":
            ev += [{"k": "click", "at": 0.5 + j * 0.45, "x": 540, "p": j} for j in range(len(g["items"]))]
        elif k == "curve":
            ev += [{"k": "slide", "at": 0.3, "d": 2.2, "x": 150, "x2": 950, "v": 0.8}, {"k": "impulse", "at": 2.5, "v": 0.8}]
        cues["s%02d" % (i + 1)] = ev
    out = {"whoosh": {"default": 1.0}, "slots": cues}
    if spec.get("style") == "action":
        # the graphics build 1.5 times as fast there (src/lr/Video.tsx), so do their sounds, and all a bit louder
        for ev in cues.values():
            for e in ev:
                if "at" in e:
                    e["at"] = round(max(0.03, (e["at"] - 0.22) / 1.5), 3)
                if "d" in e:
                    e["d"] = round(e["d"] / 1.5, 3)
                if "roll" in e:
                    e["roll"]["at"] = round(max(0.03, (e["roll"]["at"] - 0.22) / 1.5), 3)
                    e["roll"]["step"] = round(e["roll"]["step"] / 1.5, 3)
                e["v"] = round(e.get("v", 1.0) * 1.3, 2)
        out["whoosh"]["default"] = 1.6
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = dict(zip([a for a in sys.argv[1:] if a.startswith("--")], [None] * 9))
    argv = sys.argv[1:]
    for k in ("--words", "--public"):
        if k in argv:
            opt[k] = argv[argv.index(k) + 1]
            args.remove(opt[k])
    spec_path, take_path, out_dir = args[:3]
    public = opt.get("--public") or os.path.join(ROOT, "public", "lr")
    spec = json.load(open(spec_path, encoding="utf-8"))
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(public, exist_ok=True)

    sty = STYLES.get(spec.get("style"), STYLES[None])
    words = json.load(open(opt["--words"], encoding="utf-8"))["words"] if opt.get("--words") else whisper_words(take_path)
    take = vtlib.load_audio(take_path, SR)
    narration = os.path.abspath(take_path)
    if sty["tempo"] != 1.0:
        take = np.asarray(tighten.run_filters(take, [("atempo", "%.4f" % sty["tempo"])]), np.float32)
        for w in words:
            w["s"], w["e"] = w["s"] / sty["tempo"], w["e"] / sty["tempo"]
        narration = os.path.abspath(os.path.join(out_dir, "take_tempo.wav"))
        vtlib.save_wav(narration, take, SR)
    slots, ratio = align(spec, words)
    json.dump({"slots": slots}, open(os.path.join(out_dir, "align.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("aligned %d scenes, match %.2f" % (len(slots), ratio))
    if ratio < 0.85:
        raise SystemExit("the take does not match the script well enough (%.2f); listen to it" % ratio)

    cuts = vm.cut_sentences(take, slots)
    pieces, t, sentences = [], sty["lead_in"], []
    for i, (s, c) in enumerate(zip(slots, cuts)):
        piece = take[int(c["a"] * SR):int(c["b"] * SR)].copy()
        lead, dur = c["on"] - c["a"], c["off"] - c["on"]
        fi, fo = int((0.02 if c["glued_in"] else 0.005) * SR), int((0.02 if c["glued_out"] else 0.008) * SR)
        piece[:fi] *= np.linspace(0, 1, fi)
        piece[-fo:] *= np.linspace(1, 0, fo)
        pieces.append((t - lead, piece))
        sentences.append({"id": s["id"], "text": s["vo"], "start": round(t, 3), "end": round(t + dur, 3),
                          "piece_start": round(max(0, t - lead), 4), "piece_end": round(max(0, t - lead) + len(piece) / SR, 4),
                          "take_a": round(c["a"], 3), "take_b": round(c["b"], 3), "take_on": round(c["on"], 3), "take_off": round(c["off"], 3),
                          "pause_cut": 0.0, "tempo": 1.0, "early": 0.0, "late": 0.0, "glued": bool(c["glued_in"] or c["glued_out"])})
        natural = c["gap_after"] if i + 1 < len(slots) else 0
        nxt = t + dur + min(sty["gap_max"], max(sty["gap_min"], natural))
        if sty["grid"]:
            # the cut of the next scene (a moment before its first word) lands on the beat grid
            g = sty["grid"]
            nxt = float(np.ceil((t + dur + sty["gap_min"] - sty["early"]) / g - 1e-6) * g + sty["early"])
        t = nxt
    length = round(sentences[-1]["end"] + sty["tail"], 2)
    n = int(length * SR)
    scenes = []
    for i, s in enumerate(sentences):
        start = 0.0 if i == 0 else round(s["start"] - sty["early"], 3)
        ps, a = s["piece_start"], cuts[i]["a"]
        scenes.append({"start": start, "vs": s["start"], "ve": s["end"],
                       "tok": [{"t": k["t"], "s": round(ps + k["s"] - a, 3), "e": round(ps + k["e"] - a, 3)} for k in slots[i]["tok"]]})
    for i, sc in enumerate(scenes):
        sc["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else length
        sentences[i]["t0"], sentences[i]["t1"] = sc["start"], sc["end"]
    audio_rel = "lr/%s.mp3" % spec["id"]
    timeline = {"length": length, "scenes": scenes, "audio": audio_rel}
    json.dump(timeline, open(os.path.join(out_dir, "timeline.json"), "w"), indent=1)

    # voice
    track = np.zeros(n, np.float32)
    for st, piece in pieces:
        i0 = max(0, int(st * SR))
        piece = piece[: max(0, n - i0)]
        track[i0:i0 + len(piece)] += piece
    comp = tighten.run_filters(track, [("highpass", "f=70"), ("acompressor", vm.VOICE_COMP)])
    track = np.pad(comp, (0, max(0, n - len(comp))))[:n].astype(np.float32)
    track = vtlib.soft_limit(track * ((10 ** (-15 / 20.0)) / max(vtlib.speech_rms(track, SR), 1e-6)), knee=0.75, ceil=0.97)
    vtlib.save_wav(os.path.join(out_dir, "voice.wav"), track, SR)

    # music and sound effects
    py = sys.executable
    bed_g, duck_g, open_g = MUSIC_BED, MUSIC_DUCK, MUSIC_OPEN
    if sty["music"] == "beat":
        subprocess.run([py, "-I", os.path.join(HERE, "..", "music", "powerbeat.py"), os.path.join(out_dir, "beat")], check=True, capture_output=True)
        bl, br = vm.load_stereo(os.path.join(out_dir, "beat.wav"))
        skip = int(4.0 * SR)                      # start in the groove; the bars stay on the grid of the cuts
        bl, br = bl[skip:skip + n], br[skip:skip + n]
        vtlib.save_wav(os.path.join(out_dir, "music_l.wav"), bl, SR)
        ref = float(np.sqrt(np.mean(bl ** 2))) + 1e-9
        duck_g = (10 ** (-28.5 / 20.0)) / ref     # about 13 dB under the voice while she speaks
        bed_g, open_g = duck_g * 1.45, duck_g * 2.1
    else:
        subprocess.run([py, "-I", os.path.join(HERE, "..", "music", "ambient.py"), os.path.join(out_dir, "music"), str(length + 0.5), "generic"], check=True, capture_output=True)
    json.dump(cues_for(spec), open(os.path.join(out_dir, "cues.json"), "w"), indent=1)
    subprocess.run([py, "-I", os.path.join(HERE, "..", "motiv", "sfx.py"), os.path.join(out_dir, "cues.json"), os.path.join(out_dir, "timeline.json"),
                    os.path.join(out_dir, "sfx.wav"), str(length)], check=True, capture_output=True)
    ml, mr = (bl, br) if sty["music"] == "beat" else vm.load_stereo(os.path.join(out_dir, "music.wav"))
    ml, mr = np.pad(ml, (0, max(0, n - len(ml))))[:n], np.pad(mr, (0, max(0, n - len(mr))))[:n]
    fl, fr = vm.load_stereo(os.path.join(out_dir, "sfx.wav"))
    fl, fr = np.pad(fl, (0, max(0, n - len(fl))))[:n], np.pad(fr, (0, max(0, n - len(fr))))[:n]
    win = int(0.03 * SR)
    k = n // win
    rms = np.sqrt(np.mean(track[: k * win].reshape(k, win) ** 2, axis=1))
    act = np.pad(np.repeat((rms > 0.012).astype(np.float32), win), (0, n - k * win))
    env = vm.smooth_env(act, 0.12, 0.6)
    tt = np.arange(n) / SR
    fw, lw = sentences[0]["start"], sentences[-1]["end"]
    bed = np.interp(tt, [0, max(0.01, fw - 0.05), fw + 0.4, lw + 0.3, lw + 1.4], [open_g, open_g, bed_g, bed_g, open_g])
    gain = (bed - (bed_g - duck_g) * env).astype(np.float32)
    left, right = ml * gain + track + fl, mr * gain + track + fr
    fade = np.interp(tt, [length - 1.0, length - 0.1], [1.0, 0.0]).astype(np.float32)   # the end fade lives in the mix
    left, right = left * fade, right * fade
    peak = max(float(np.max(np.abs(left))), float(np.max(np.abs(right))))
    if peak > 0.95:
        left, right = left * (0.95 / peak), right * (0.95 / peak)
    out_mp3 = os.path.join(public, "%s.mp3" % spec["id"])
    darkbeat.save_mp3(out_mp3, left, right)
    json.dump({"length": length, "style": spec.get("style"), "narration": narration, "voice": os.path.abspath(os.path.join(out_dir, "voice.wav")), "sentences": sentences},
              open(os.path.join(out_dir, "mix.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    db = lambda v: float(20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9))
    sp = act > 0.5
    print("length %.2f s | voice %.1f dBFS | music under the voice %.1f dBFS | difference %.1f dB | written %s" % (
        length, db(track[sp]), db((ml * gain)[sp]), db(track[sp]) - db((ml * gain)[sp]), out_mp3))
    for s in sentences:
        print("  %s %5.2f-%5.2f  %s" % (s["id"], s["start"], s["end"], s["text"][:60]))


if __name__ == "__main__":
    main()
