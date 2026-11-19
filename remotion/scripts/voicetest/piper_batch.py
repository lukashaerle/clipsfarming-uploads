"""Speak a list of lines with Piper voices.

    python -I piper_batch.py jobs.json <models_dir> <out_dir>

jobs.json: [{"id", "model", "text", "speaker"?, "pitch"?, "length"?, "noise"?, "noise_w"?}]
  pitch  1.0 = as recorded; 1.1 = 10 % higher (smaller, older, younger); 0.9 = deeper. Tempo stays the same.
  length 1.0 = normal tempo; 1.1 = 10 % slower.
Writes <out_dir>/<id>.wav (48 kHz mono) and <out_dir>/_report.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402
from piper import PiperVoice, SynthesisConfig  # noqa: E402

import vtlib  # noqa: E402


def main():
    jobs_path, models_dir, out_dir = sys.argv[1:4]
    with open(jobs_path, encoding="utf-8") as fh:
        jobs = json.load(fh)
    os.makedirs(out_dir, exist_ok=True)
    voices = {}
    report = []
    for j in jobs:
        m = j["model"]
        if m not in voices:
            voices[m] = PiperVoice.load(os.path.join(models_dir, m, m + ".onnx"))
        v = voices[m]
        pitch = float(j.get("pitch", 1.0))
        length = float(j.get("length", 1.0))
        cfg = SynthesisConfig(
            speaker_id=j.get("speaker"),
            length_scale=length * pitch,
            noise_scale=j.get("noise"),
            noise_w_scale=j.get("noise_w"),
            normalize_audio=True,
        )
        sr = v.config.sample_rate
        gap = np.zeros(int(0.16 * pitch * sr), dtype=np.int16)
        parts = []
        for chunk in v.synthesize(j["text"], cfg):
            if parts:
                parts.append(gap)
            parts.append(chunk.audio_int16_array)
        audio = np.concatenate(parts)
        y = vtlib.resample_int16(audio, sr * pitch, vtlib.SR).astype(np.float32) / 32768.0
        y = vtlib.trim(y)
        vtlib.save_wav(os.path.join(out_dir, j["id"] + ".wav"), y)
        f0, spread = vtlib.f0_stats(y)
        row = {"id": j["id"], "sec": round(len(y) / vtlib.SR, 2), "f0": round(f0), "f0_spread": round(spread)}
        report.append(row)
        print(row, flush=True)
    with open(os.path.join(out_dir, "_report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1)


if __name__ == "__main__":
    main()
