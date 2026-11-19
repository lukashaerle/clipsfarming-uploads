"""Measure what of the text and graphics lies where the app interface covers the video (stills from safezone.mjs).

Safe area in 1080x1920 (the user's template, 2026-11-19): x 44-1034 from y 118 down to 955, below that x 44-886
down to y 1540; the bar at the top (x 308-760, y 118-211) is covered too. Everything else is covered.
Writes <folder>/zonen.png (all stills with the covered areas tinted) and exits 1 if any still has content there.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

MARGIN = 6  # px of 1080, keep a little air to the edge of the safe area


def safe_mask(w, h):
    k = w / 1080
    m = np.zeros((h, w), bool)
    def box(x0, y0, x1, y1, v):
        m[int(y0 * k):int(y1 * k), int(x0 * k):int(x1 * k)] = v
    box(44 + MARGIN, 118 + MARGIN, 1034 - MARGIN, 955, True)
    box(44 + MARGIN, 955, 886 - MARGIN, 1540 - MARGIN, True)
    box(308 - MARGIN, 118, 760 + MARGIN, 211 + MARGIN, False)
    return m


def main():
    folder = sys.argv[1]
    files = sorted(glob.glob(os.path.join(folder, "s*.png")))
    bad, tiles = [], []
    for f in files:
        im = np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
        h, w, _ = im.shape
        bg = np.median(im[:8, :8].reshape(-1, 3), axis=0)
        ink = np.abs(im - bg).max(axis=2) > 60  # text, lines and shapes; soft glows stay below
        out = ink & ~safe_mask(w, h)
        n = int(out.sum())
        k = 1080 / w
        if n > 3:
            ys, xs = np.nonzero(out)
            bad.append("%s: %d px in the covered area, x %d-%d, y %d-%d" % (os.path.basename(f), n, xs.min() * k, xs.max() * k, ys.min() * k, ys.max() * k))
        t = im.copy()
        cover = ~safe_mask(w, h)
        t[cover] = (t[cover] * 0.55 + np.array([190, 75, 50]) * 0.45).astype(np.int16)
        t[out] = [255, 255, 0]
        tiles.append(Image.fromarray(t.astype(np.uint8)).resize((w // 2, h // 2)))
    if tiles:
        cols = 6
        tw, th = tiles[0].size
        sheet = Image.new("RGB", (cols * tw, ((len(tiles) + cols - 1) // cols) * th), "black")
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
        sheet.save(os.path.join(folder, "zonen.png"))
    print("SAFE ZONE  %d stills | %s" % (len(files), "all clear" if not bad else "%d with content in the covered area" % len(bad)))
    for b in bad:
        print("  - " + b)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
