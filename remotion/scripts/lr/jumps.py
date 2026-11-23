"""Find jumps at the scene boundaries inside the room of a story-style video.

    .venv/bin/python -I scripts/lr/jumps.py <id> [video.mp4]

Consecutive `room` scenes must flow into each other: camera, light, phone and wall may only change gradually there.
The script takes every frame of the room window (small, grey), measures how much the picture changes from one frame
to the next and prints that for every scene boundary next to the frames around it. A boundary between two room
scenes that changes more than three times as much as its neighbours is a jump (exit 1). Cuts to and from statement
cards are meant to be hard and are only listed.
Needs the node of this project on PATH (npx remotion ffmpeg) and videos/<id>/build/timeline.json from build_audio.py.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
WIN = (50, 240, 978, 710)   # the room window of src/lr/sets.tsx: x, y, width, height
FPS = 60


def main():
    vid = sys.argv[1]
    video = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "out", "lr", "%s-1080p.mp4" % vid)
    tl = json.load(open(os.path.join(ROOT, "videos", vid, "build", "timeline.json"), encoding="utf-8"))
    spec = json.load(open(os.path.join(ROOT, "videos", vid, "spec.json"), encoding="utf-8"))
    tmp = tempfile.mkdtemp(prefix="lr-jumps-")
    try:
        subprocess.run(["npx", "remotion", "ffmpeg", "-v", "error", "-y", "-i", video, "-vf",
                        "crop=%d:%d:%d:%d,scale=326:-1,format=gray" % (WIN[2], WIN[3], WIN[0], WIN[1]),
                        os.path.join(tmp, "f%05d.png")], check=True, cwd=ROOT)
        files = sorted(glob.glob(os.path.join(tmp, "f*.png")))
        fr = np.stack([np.asarray(Image.open(f).convert("L"), dtype=np.float32) for f in files])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    d = np.abs(fr[1:] - fr[:-1]).mean(axis=(1, 2))   # d[i]: change from frame i to frame i + 1
    bad = 0
    for i, s in enumerate(tl["scenes"]):
        f = int(round(s["start"] * FPS))
        if f < 3 or f + 1 >= len(d):
            continue
        a, b = spec["scenes"][i - 1]["graphic"]["kind"], spec["scenes"][i]["graphic"]["kind"]
        near = [float(d[f - 3]), float(d[f - 2]), float(d[f]), float(d[f + 1])]
        here = float(d[f - 1])
        flowing = a == "room" and b == "room"
        jump = flowing and here > max(0.8, 3 * sorted(near)[2])
        bad += 1 if jump else 0
        print("scene %2d at %5.2f s  %-9s -> %-9s  change %6.2f | around it %s | %s"
              % (i + 1, s["start"], a, b, here, " ".join("%.2f" % x for x in near),
                 "JUMP" if jump else ("flows" if flowing else "hard cut")))
    print("JUMPS  %s | %d frames | %s" % (vid, len(fr), "none" if not bad else "%d boundary(ies) jump" % bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
