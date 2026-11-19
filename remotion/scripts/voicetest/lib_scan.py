"""Rank voice samples by how close the voice itself is to a reference profile.

    python -I lib_scan.py <spec.json> <folder with the downloaded previews> <reference profile json> <out.json>

spec.json: {"base": url prefix, "voices": [{"id", "name", "path"}], "extra": [{"id", "name", "file"}]}
Each preview is expected as <folder>/<id>.mp3. Only traits of the voice are compared, not the text or tempo:
pitch (median), size of the voice (vocal tract length from the formants), brightness and how far the melody swings.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import voice_profile as vp  # noqa: E402

spec_path, folder, ref_path, out_path = sys.argv[1:5]
spec = json.load(open(spec_path, encoding="utf-8"))
ref = json.load(open(ref_path, encoding="utf-8"))["profile"]


def distance(p):
    d_pitch = abs(12 * np.log2(p["f0"] / ref["f0"])) / 1.5      # 1.5 semitones count as one step
    d_size = abs(p.get("vtl_cm", 99) - ref["vtl_cm"]) / 0.4     # 0.4 cm
    d_bright = abs(p["bright_db"] - ref["bright_db"]) / 3.0     # 3 dB, half weight
    d_range = abs(p["range_st"] - ref["range_st"]) / 3.0        # 3 semitones, half weight
    return float(np.sqrt(d_pitch ** 2 + d_size ** 2 + (0.5 * d_bright) ** 2 + (0.5 * d_range) ** 2))


rows = []
items = [(v["id"], v["name"], os.path.join(folder, v["id"] + ".mp3")) for v in spec.get("voices", [])]
items += [(v["id"], v["name"], v["file"]) for v in spec.get("extra", [])]
for vid, name, path in items:
    if not os.path.exists(path) or os.path.getsize(path) < 20000:
        print("missing:", name)
        continue
    try:
        p = vp.profile(path, None)
    except Exception as e:  # a broken download must not stop the scan
        print("failed:", name, type(e).__name__, e)
        continue
    p["id"], p["name"], p["dist"] = vid, name, round(distance(p), 2)
    p["pitch_st"] = round(float(12 * np.log2(p["f0"] / ref["f0"])), 1)
    rows.append(p)

rows.sort(key=lambda r: r["dist"])
print("reference: pitch %d Hz (%d-%d), range %.1f st, size %.2f cm, brightness %.1f dB" % (ref["f0"], ref["f0_p10"], ref["f0_p90"], ref["range_st"], ref["vtl_cm"], ref["bright_db"]))
print("%-5s %-46s %5s %7s %9s %6s %6s %7s" % ("dist", "voice", "Hz", "st", "10-90 %", "range", "cm", "bright"))
for r in rows:
    print("%-5.2f %-46s %5d %+7.1f %4d-%-4d %6.1f %6.2f %7.1f" % (r["dist"], r["name"][:46], r["f0"], r["pitch_st"], r["f0_p10"], r["f0_p90"], r["range_st"], r.get("vtl_cm", 0), r["bright_db"]))
json.dump({"reference": ref, "rows": rows}, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
