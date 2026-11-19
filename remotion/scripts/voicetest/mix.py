"""Mix a dialogue from single spoken lines.

    python -I mix.py dialog.json cast.json <out_basename>

cast.json: {"files": {"l1": "/abs/path.wav", ...}, "gaps": {"l9": 0.5}}
  gaps = pause before that line in seconds (default 0.26).
Writes <out_basename>.mp3 and <out_basename>.json (timeline with start and end of every line).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

import vtlib  # noqa: E402

LEAD_IN = 0.15
TAIL = 0.35
GAP = 0.26


def main():
    dialog_path, cast_path, out_base = sys.argv[1:4]
    with open(dialog_path, encoding="utf-8") as fh:
        dialog = json.load(fh)
    with open(cast_path, encoding="utf-8") as fh:
        cast = json.load(fh)
    sr = vtlib.SR
    parts = [np.zeros(int(LEAD_IN * sr), dtype=np.float32)]
    t = LEAD_IN
    timeline = []
    for i, line in enumerate(dialog["lines"]):
        x = vtlib.load_audio(cast["files"][line["id"]])
        x = vtlib.fade_edges(vtlib.normalize(vtlib.trim(x)))
        if i > 0:
            gap = float(cast.get("gaps", {}).get(line["id"], GAP))
            parts.append(np.zeros(int(gap * sr), dtype=np.float32))
            t += gap
        parts.append(x.astype(np.float32))
        dur = len(x) / sr
        timeline.append({"id": line["id"], "who": line["who"], "text": line["text"],
                         "start": round(t, 3), "end": round(t + dur, 3)})
        t += dur
    parts.append(np.zeros(int(TAIL * sr), dtype=np.float32))
    y = np.concatenate(parts)
    y = y * (0.89 / max(1e-6, float(np.max(np.abs(y)))))
    os.makedirs(os.path.dirname(out_base), exist_ok=True)
    vtlib.save_mp3(out_base + ".mp3", y, bitrate=128000)
    with open(out_base + ".json", "w", encoding="utf-8") as fh:
        json.dump({"duration": round(len(y) / sr, 3), "lines": timeline}, fh, indent=1, ensure_ascii=False)
    print(os.path.basename(out_base), "->", round(len(y) / sr, 2), "s")


if __name__ == "__main__":
    main()
