"""Contact sheet of stills: python montage.py <folder> <out.png> [columns] [tile_width]"""
import glob, os, sys
from PIL import Image, ImageDraw

folder, out = sys.argv[1:3]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 300
files = sorted(glob.glob(os.path.join(folder, "t*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
th = int(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 22)), (20, 20, 24))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * tw, (i // cols) * (th + 22)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 22))
    d.text((x + 6, y + 5), os.path.basename(f)[1:-4] + " s", fill=(230, 230, 230))
sheet.save(out)
print(out, sheet.size)
