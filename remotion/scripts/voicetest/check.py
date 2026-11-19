"""Check spoken lines with Whisper: is every line understandable and does it match its text?

    python -I check.py jobs.json <audio_dir> [ext]

jobs.json: [{"id", "text"}]; reads <audio_dir>/<id>.<ext> (default wav).
Prints one row per line and writes <audio_dir>/_check.json.
"""
import difflib
import json
import os
import re
import sys

from faster_whisper import WhisperModel


def norm(s):
    return re.sub(r"[^a-zäöüß0-9 ]", "", s.lower()).split()


def main():
    jobs_path, audio_dir = sys.argv[1:3]
    ext = sys.argv[3] if len(sys.argv) > 3 else "wav"
    with open(jobs_path, encoding="utf-8") as fh:
        jobs = json.load(fh)
    model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
    rows = []
    for j in jobs:
        path = os.path.join(audio_dir, j["id"] + "." + ext)
        segs, _info = model.transcribe(path, language="de", beam_size=5)
        segs = list(segs)
        heard = " ".join(s.text.strip() for s in segs)
        logprob = sum(s.avg_logprob for s in segs) / max(1, len(segs))
        ratio = difflib.SequenceMatcher(None, norm(j["text"]), norm(heard)).ratio()
        row = {"id": j["id"], "match": round(ratio, 2), "logprob": round(logprob, 2), "heard": heard}
        rows.append(row)
        print(row, flush=True)
    with open(os.path.join(audio_dir, "_check.json"), "w", encoding="utf-8") as fh:
        json.dump(rows, fh, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
