"""Check a punch-style script before it is produced.

    python3 -I scripts/lr/check_spec.py videos/<id>/spec.json [more specs ...]

Prints "SPEC ok" or every problem; exit 1 if a spec has problems. It checks what the safe-zone check cannot see:
the length of the narration, statements that do not carry the words of their sentence (then the type cannot follow
the voice), a missing loop line at the end, numbers the voice would read as ordinals, headlines this style does not show.
Specs of other styles pass without checks.
"""
import json
import re
import sys

MIN_CHARS, MAX_CHARS = 430, 520
MIN_SCENES, MAX_SCENES = 11, 14
# story style: a little longer, and scenes of one room flow into each other, so there may be more of them
STORY = dict(min_chars=480, max_chars=640, min_scenes=11, max_scenes=18)


def words_of(lines):
    return [w.replace("*", "") for line in lines for w in line.split()]


def check(path):
    spec = json.load(open(path, encoding="utf-8"))
    if spec.get("style") not in ("punch", "story"):
        return ["style is %r, not 'punch' or 'story' (every new script uses one of them)" % spec.get("style")] if "--strict" in sys.argv else []
    story = spec.get("style") == "story"
    sc = spec["scenes"]
    bad = []
    chars = sum(len(s["vo"]) for s in sc)
    lo, hi = (STORY["min_chars"], STORY["max_chars"]) if story else (MIN_CHARS, MAX_CHARS)
    if not lo <= chars <= hi:
        bad.append("narration has %d characters, must be %d-%d" % (chars, lo, hi))
    lo, hi = (STORY["min_scenes"], STORY["max_scenes"]) if story else (MIN_SCENES, MAX_SCENES)
    if not lo <= len(sc) <= hi:
        bad.append("%d scenes, must be %d-%d" % (len(sc), lo, hi))
    inverts, holds, rise_bars = 0, 0.0, None
    for i, s in enumerate(sc, 1):
        g, vo = s["graphic"], s["vo"]
        if s.get("head"):
            bad.append("scene %d: 'head' must be \"\" (the punch style shows no headlines)" % i)
        if len(vo) > 62:
            bad.append("scene %d: the sentence has %d characters, keep it under about 50" % (i, len(vo)))
        if re.search(r"\d\.(\s|$)", vo):
            bad.append("scene %d: a number directly before a full stop (%r) is read as an ordinal; add the unit" % (i, vo))
        holds += float(s.get("hold", 0) or 0)
        if g["kind"] == "statement":
            if words_of(g["lines"]) != vo.split():
                bad.append("scene %d: the statement lines must hold exactly the words of 'vo' (lines: %r | vo: %r)" % (i, " ".join(words_of(g["lines"])), vo))
            if not any("*" in line for line in g["lines"]):
                bad.append("scene %d: mark the key words of the statement with *...*" % i)
            for line in g["lines"]:
                n = len(line.replace("*", ""))
                if n > 20:
                    bad.append("scene %d: statement line %r has %d characters, at most 20 (it gets too small)" % (i, line, n))
            if len(g.get("chip", "")) > 28:
                bad.append("scene %d: the chip has %d characters, at most 28" % (i, len(g["chip"])))
            inverts += 1 if g.get("invert") else 0
        if g["kind"] == "room":
            if "time" in g and not re.fullmatch(r"\d{1,2}:\d{2}", g["time"]):
                bad.append("scene %d: room time must look like 08:10" % i)
            if len(g.get("chip", "")) > 36:
                bad.append("scene %d: the chip has %d characters, at most 36" % (i, len(g["chip"])))
            if len(s.get("calc", "")) > 34:
                bad.append("scene %d: the calc line has %d characters, at most 34" % (i, len(s["calc"])))
        if g["kind"] == "rise":
            if rise_bars is not None and g["bars"] != rise_bars:
                bad.append("scene %d: every 'rise' scene must carry the same 'bars'" % i)
            rise_bars = g["bars"]
            if not 1 <= g["show"] <= len(g["bars"]):
                bad.append("scene %d: 'show' must be between 1 and %d" % (i, len(g["bars"])))
            for b in g["bars"]:
                if len(b["label"]) > 11:
                    bad.append("scene %d: bar label %r has more than 11 characters" % (i, b["label"]))
    if sc[0]["graphic"]["kind"] not in (("statement", "room") if story else ("statement",)):
        bad.append("scene 1 must be a statement (the hook; its first frame is the cover)")
    last = sc[-1]
    if last["graphic"]["kind"] != "statement" or not last["vo"].rstrip().endswith(":") or len(last["vo"]) > 30:
        bad.append("the last scene must be a short statement that ends with ':' and leads into the first sentence (the loop), e.g. 'Und denk dran:'")
    if not any(s["graphic"].get("chip") for s in sc[-3:] if s["graphic"]["kind"] in ("statement", "room")):
        bad.append("the closing call to action (one of the last scenes) needs a statement with a 'chip' (a question for the comments)")
    if inverts > 1:
        bad.append("%d inverted statements, at most one per video" % inverts)
    if holds > 1.0:
        bad.append("'hold' adds up to %.2f s, at most 1.0 s per video" % holds)
    return bad


def main():
    rc = 0
    for path in [a for a in sys.argv[1:] if not a.startswith("--")]:
        bad = check(path)
        print("SPEC %s | %s" % (path, "ok" if not bad else "%d problem(s)" % len(bad)))
        for b in bad:
            print("  - " + b)
        rc = rc or (1 if bad else 0)
    sys.exit(rc)


if __name__ == "__main__":
    main()
