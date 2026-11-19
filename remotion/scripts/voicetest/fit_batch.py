"""Prepare voice samples for the listening page: steady flow, on the video slots, music underneath, measured.

    python -I fit_batch.py <spec.json>

spec.json: {"script": "src/motiv/script.ts", "slots": 4, "length": 12.5, "pause": 0.36, "artic": 5.3,
            "beds": {"": "public/music/a.mp3", "_dunkel": "public/music/b.mp3"}, "out": "out/stimmen/fein",
            "items": [{"key": "q1", "file": "voicetest/.../q1.mp3", "beds": ["", "_dunkel"]}]}
For every item: voice_profile (raw) -> tighten (pauses to `pause`, tempo so the articulation reaches `artic`,
at most 15 % faster) -> vo_align -> vo_mix per music bed -> voice_profile (fitted). Writes <out>/results.json.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PY = sys.executable
spec = json.load(open(sys.argv[1], encoding="utf-8"))


def run(*args):
    r = subprocess.run([PY, "-I", *args], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-800:], r.stderr[-1500:])
        raise SystemExit("failed: " + " ".join(args[:2]))
    return r.stdout


os.makedirs(os.path.join(ROOT, spec["out"]), exist_ok=True)
os.makedirs(os.path.join(ROOT, "voicetest/fit"), exist_ok=True)
res = {}
for it in spec["items"]:
    k, src = it["key"], it["file"]
    raw_json = "voicetest/profile/%s.json" % k
    if not os.path.exists(os.path.join(ROOT, raw_json)):
        run("scripts/voicetest/voice_profile.py", src, raw_json)
    raw = json.load(open(os.path.join(ROOT, raw_json), encoding="utf-8"))["profile"]
    factor = min(1.15, max(1.0, spec["artic"] / raw["artic_syll_per_s"]))
    fit = "voicetest/fit/%s.mp3" % k
    note = run("scripts/voicetest/tighten.py", src, fit, str(spec["pause"]), "0", "1.15", raw_json, "%.4f" % factor).strip().splitlines()[-1]
    align = "voicetest/stimmen/%s_fit_align.json" % k
    run("scripts/motiv/vo_align.py", fit, spec["script"], align, str(spec["slots"]))
    over = 0
    for suffix in it.get("beds", [""]):
        out = run("scripts/motiv/vo_mix.py", fit, align, spec["beds"][suffix], "%s/%s%s.mp3" % (spec["out"], k, suffix), str(spec["length"]))
        over = max(over, out.count("RUNS OVER"))
    fit_json = "voicetest/profile/%s_fit.json" % k
    run("scripts/voicetest/voice_profile.py", fit, fit_json)
    f = json.load(open(os.path.join(ROOT, fit_json), encoding="utf-8"))["profile"]
    res[k] = {"raw": raw, "fit": f, "tempo": round(factor, 3), "note": note, "runs_over": over}
    print("%-12s tempo x%.3f | %s" % (k, factor, note.split(": ", 1)[-1]))
    print("             raw: %3d wpm, %.2f syll/s spoken, pauses to %.2f s | fitted: %3d wpm, %.2f syll/s spoken, pauses to %.2f s, sentences over slot: %d" % (
        raw["wpm"], raw["artic_syll_per_s"], raw["pause_max_s"], f["wpm"], f["artic_syll_per_s"], f["pause_max_s"], over))
    print("             pitch %d Hz (%d-%d), range %.1f st, end fall %.1f st, size %.2f cm, brightness %.1f dB (fitted %.1f), level spread %.1f dB" % (
        raw["f0"], raw["f0_p10"], raw["f0_p90"], raw["range_st"], raw["sentence_end_fall_st"], raw.get("vtl_cm", 0), raw["bright_db"], f["bright_db"], f["level_spread_db"]))
json.dump(res, open(os.path.join(ROOT, spec["out"], "results.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
