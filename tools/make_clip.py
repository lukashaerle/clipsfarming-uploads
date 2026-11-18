#!/usr/bin/env python3
"""CLIPSFARMING – macht aus einem Quellvideo einen fertigen Hochformat-Clip.

Aufruf:
  python3 make_clip.py QUELLE.mp4 AUSGABE.mp4 [--start 0] [--end 30]
                       [--top "Text oben"] [--hook "HOOK TEXT"] [--layout blur|fill]

- Layout "blur": Video mittig, unscharfer Hintergrund (passt zu jedem Stream-Layout).
- Layout "fill": Bildmitte füllt das ganze Hochformat.
- Untertitel: Wort für Wort (faster-whisper "small"), aktives Wort gelb.
- Hook: großer Text in den ersten 2,7 s (optional, muss zum Inhalt passen).
- Kein Wasserzeichen, keine Musik, nur Originalton.
Benötigt: ffmpeg, faster-whisper, numpy, Schrift "Inter" (sonst Ersatzschrift).
"""
import argparse, subprocess, sys
import numpy as np

p = argparse.ArgumentParser()
p.add_argument("src"); p.add_argument("out")
p.add_argument("--start", type=float, default=0.0)
p.add_argument("--end", type=float, default=None)
p.add_argument("--top", default="")
p.add_argument("--hook", default="")
p.add_argument("--layout", default="blur", choices=["blur", "fill"])
p.add_argument("--lang", default=None)
a = p.parse_args()

dur_src = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src],
                               capture_output=True, text=True).stdout.strip())
end = min(a.end if a.end else dur_src, dur_src)
dur = end - a.start

# Transkript mit Wortzeiten (relativ zum Clip-Start)
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", str(a.start), "-to", str(end), "-i", a.src,
                      "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
words = []
try:
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(audio, word_timestamps=True, language=a.lang)
    for s in segs:
        for w in s.words:
            t = w.word.strip()
            if t:
                words.append((t, int(w.start * 1000), int(w.end * 1000)))
except Exception as e:
    print("Hinweis: keine Untertitel –", e, file=sys.stderr)

def ts(ms):
    ms = max(0, int(ms)); return f"{ms//3600000}:{ms//60000%60:02d}:{ms//1000%60:02d}.{ms%1000//10:02d}"

def esc(t):
    return t.replace("\\", "").replace("{", "(").replace("}", ")")

chunks, cur = [], []
for w in words:
    cur.append(w)
    if len(cur) == 3 or w[0][-1] in ".,?!":
        chunks.append(cur); cur = []
if cur: chunks.append(cur)

cap_y = 1330 if a.layout == "blur" else 1480
L = ["""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter ExtraBold,88,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1
Style: Hook,Inter ExtraBold,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,-2,0,1,8,4,5,60,60,0,1
Style: Top,Inter ExtraBold,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,3,14,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""]
if a.top:
    L.append(f"Dialogue: 0,{ts(0)},{ts(dur*1000)},Top,,0,0,0,,{{\\pos(540,250)}}{esc(a.top)}\n")
hook_ms = 2700 if a.hook else 0
if a.hook:
    L.append(f"Dialogue: 2,{ts(0)},{ts(hook_ms)},Hook,,0,0,0,,{{\\pos(540,820)\\fad(0,200)}}{esc(a.hook)}\n")
for k, ch in enumerate(chunks):
    nxt = chunks[k + 1][0][1] if k + 1 < len(chunks) else 10**9
    for i, w in enumerate(ch):
        s = w[1]
        e = ch[i + 1][1] if i + 1 < len(ch) else min(max(ch[-1][2], w[2] + 250), nxt)
        if e <= hook_ms: continue
        s = max(s, hook_ms)
        txt = " ".join(("{\\c&H00D7FF&}" + esc(x[0]).upper() + "{\\c&HFFFFFF&}") if j == i else esc(x[0]).upper()
                       for j, x in enumerate(ch))
        L.append(f"Dialogue: 1,{ts(s)},{ts(e)},Cap,,0,0,0,,{{\\pos(540,{cap_y})}}{txt}\n")
ass = a.out + ".ass"
open(ass, "w").write("".join(L))

if a.layout == "blur":
    fc = ("[0:v]split=2[x][y];"
          "[x]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:3,eq=brightness=-0.18[bg];"
          "[y]scale=1080:-2[fg];[bg][fg]overlay=0:(H-h)/2,fps=30,ass=" + ass + "[v]")
else:
    fc = "[0:v]scale=-2:1920,crop=1080:1920,fps=30,ass=" + ass + "[v]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a.start), "-to", str(end), "-i", a.src,
                "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", a.out],
               check=True)
print("fertig", a.out, f"{dur:.1f}s", len(words), "Woerter")
