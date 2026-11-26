"""Find broken single frames in a rendered video.

    python -I glitch.py <video> [--max N]

Since 2026-11-24 the cloud renderer sometimes hands out a frame that is not finished: completely black, or the picture
repeated in tiles. Such a frame lasts one to three frames and looks unlike both its neighbours, while the neighbours
look like each other. A real cut does not trigger it (the frame after a cut looks like the one after it), and neither
does motion (the neighbours then differ from each other as well).

Every frame is shrunk to 54 x 96 grey. A frame counts as broken when
  - it is almost black (mean below 3 of 255; our videos never are), or
  - it differs from both neighbours two and three frames away by more than 12, and those neighbours are at least
    three times closer to each other (two- and three-frame spans catch glitches lasting up to two frames).
Prints the number and the times; exit 1 when more than --max (default 0) frames are broken.
"""
import glob
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

W, H = 54, 96


def ffmpeg():
    """remotion's ffmpeg (works in the cloud and on the Mac), else one on PATH"""
    return ["npx", "remotion", "ffmpeg"] if shutil.which("npx") else ["ffmpeg"]


def frames(path):
    tmp = tempfile.mkdtemp(prefix="glitch")
    try:
        subprocess.run(ffmpeg() + ["-v", "error", "-y", "-i", path, "-vf", f"scale={W}:{H}", os.path.join(tmp, "%05d.png")], check=True)
        out = [np.asarray(Image.open(f).convert("L"), dtype=np.float32) for f in sorted(glob.glob(os.path.join(tmp, "*.png")))]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out


def broken(fr):
    bad = set()
    d = lambda a, b: float(np.abs(fr[a] - fr[b]).mean())
    n = len(fr)
    for i in range(n):
        if fr[i].mean() < 3:
            bad.add(i)
    for span in (1, 2):
        # glitch of `span` frames starting at i: compare with i-1 and i+span
        for i in range(1, n - span):
            a, b = i - 1, i + span
            around = d(a, b)
            inner = min(d(a, j) for j in range(i, i + span)), min(d(b, j) for j in range(i, i + span))
            if min(inner) > 12 and min(inner) > 3 * around:
                bad.update(range(i, i + span))
    return sorted(bad)


def main():
    args = sys.argv[1:]
    mx = 0
    if "--max" in args:
        k = args.index("--max")
        mx = int(args[k + 1])
        del args[k:k + 2]
    path = args[0]
    fr = frames(path)
    bad = broken(fr)
    fps = 60
    times = ", ".join(f"{b / fps:.2f}" for b in bad[:12]) + (" ..." if len(bad) > 12 else "")
    if len(bad) > mx:
        print(f"GLITCH {os.path.basename(path)}: {len(bad)} of {len(fr)} frames broken (s: {times})")
        sys.exit(1)
    print(f"GLITCH {os.path.basename(path)}: none of {len(fr)} frames broken")


if __name__ == "__main__":
    main()
