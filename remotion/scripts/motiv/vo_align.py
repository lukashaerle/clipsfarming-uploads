"""Find where every slot sentence sits in one narration recording.

    python -I vo_align.py <narration audio> <src/motiv/script.ts> <out.json> [number of slots in the recording]

Whisper gives word times; the words are matched to the script, so every slot gets a start and an end.
"""
import difflib
import json
import re
import sys

from faster_whisper import WhisperModel

audio, script_ts, out = sys.argv[1:4]
src = open(script_ts, encoding="utf-8").read()
slots = [{"id": m.group(1), "t0": float(m.group(2)), "t1": float(m.group(3)), "vo": m.group(4)}
         for m in re.finditer(r"\{id: '(s\d+)', t0: ([\d.]+), t1: ([\d.]+), head: '[^']*', vo: '([^']*)'", src)]
assert len(slots) >= 1, len(slots)
if len(sys.argv) > 4:  # only the first N slots are in this recording
    slots = slots[: int(sys.argv[4])]

NUM = {"76": "sechsundsiebzig", "365": "dreihundertfünfundsechzig", "5": "fünf", "10": "zehn", "9": "neun", "30": "dreißig", "15": "fünfzehn", "12": "zwölf", "2": "zwei", "1": "eine"}
def norm(w):
    w = re.sub(r"[^0-9a-zäöüß]", "", w.lower())
    return NUM.get(w, w)

model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
segs, info = model.transcribe(audio, language="de", beam_size=5, word_timestamps=True)
words = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in (s.words or [])]
heard = [norm(w["w"]) for w in words]

script_tokens, owner = [], []
for i, sl in enumerate(slots):
    for tok in sl["vo"].split():
        n = norm(tok)
        if n:
            script_tokens.append(n)
            owner.append(i)

# map every script token to a heard word
sm = difflib.SequenceMatcher(None, script_tokens, heard, autojunk=False)
pos = [None] * len(script_tokens)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        for k in range(i2 - i1):
            pos[i1 + k] = j1 + k
    elif tag == "replace":
        for k in range(i2 - i1):
            pos[i1 + k] = min(j2 - 1, j1 + int(k * (j2 - j1) / max(1, i2 - i1)))
# fill gaps from neighbours
last = 0
for k in range(len(pos)):
    if pos[k] is None:
        pos[k] = last
    last = pos[k]

print("heard %d words in %.1f s, match ratio %.2f" % (len(words), info.duration, sm.ratio()))
res = []
for i, sl in enumerate(slots):
    idx = [pos[k] for k in range(len(owner)) if owner[k] == i]
    a, b = words[min(idx)], words[max(idx)]
    res.append({**sl, "start": round(a["s"], 3), "end": round(b["e"], 3), "heard": " ".join(w["w"] for w in words[min(idx):max(idx) + 1]),
                "words": [{"w": w["w"], "s": round(w["s"], 3), "e": round(w["e"], 3)} for w in words[min(idx):max(idx) + 1]]})
for i, r in enumerate(res):
    gap = (res[i + 1]["start"] - r["end"]) if i + 1 < len(res) else 0
    print("%s  %5.2f-%5.2f  len %4.2f  slot %3.1f s  gap after %4.2f | %s" % (r["id"], r["start"], r["end"], r["end"] - r["start"], r["t1"] - r["t0"], gap, r["heard"]))
json.dump({"duration": info.duration, "slots": res}, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
