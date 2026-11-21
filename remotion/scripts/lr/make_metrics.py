"""Write src/lr/metrics.ts: the advance widths of Barlow Condensed ExtraBold in em.

    python -I scripts/lr/make_metrics.py

The punch style fits its type to a width (block type, captions) by arithmetic on these numbers, so the layout is
the same on the Mac and in the cloud and does not depend on when the browser has loaded the font.
Run again only when the font file in public/fonts changes.
"""
import json
import os

from PIL import ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CHARS = " !\"#%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜabcdefghijklmnopqrstuvwxyzäöüß€×÷±–—…°"

font = ImageFont.truetype(os.path.join(ROOT, "public", "fonts", "BarlowCondensed-ExtraBold.ttf"), 2000)
adv = {c: round(font.getlength(c) / 2000, 4) for c in CHARS}
src = """// Advance widths of Barlow Condensed ExtraBold in em (written by scripts/lr/make_metrics.py from public/fonts).
// With them a text can be fitted to a width by pure arithmetic, the same on the Mac and in the cloud,
// without measuring in the browser (which depends on when the font has loaded).
const ADV: Record<string, number> = %s;
const FALLBACK = 0.47;

/** width of `text` in em, without kerning (set `fontKerning: 'none'` where the fit must be exact) */
export const textEm = (text: string): number => {
  let w = 0;
  for (const ch of text) w += ADV[ch] ?? FALLBACK;
  return w;
};
export const SPACE_EM = ADV[' '];
""" % json.dumps(adv, ensure_ascii=False)
out = os.path.join(ROOT, "src", "lr", "metrics.ts")
open(out, "w", encoding="utf-8").write(src)
print("written %s (%d characters)" % (out, len(adv)))
