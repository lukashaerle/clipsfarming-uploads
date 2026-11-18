#!/usr/bin/env bash
# One-off cloud test: does the motivation video render in the cloud exactly as on the Mac, and how long does it take?
# Run from anywhere:  bash remotion/scripts/cloud_test.sh
# Writes everything into remotion/cloudtest-out/: the Full HD video, six 4K stills, timings and stream info.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=cloudtest-out
rm -rf "$OUT" && mkdir -p "$OUT"
LOG="$OUT/report.txt"
say() { echo "$*" | tee -a "$LOG"; }

say "date: $(date -u +%FT%TZ)"
say "machine: $(uname -sm), cpus: $(nproc 2>/dev/null || sysctl -n hw.ncpu), memory: $(free -g 2>/dev/null | awk '/Mem:/{print $2" GB"}')"
say "node: $(node -v 2>/dev/null || echo missing)"

t=$(date +%s); npm ci --no-audit --no-fund >"$OUT/npm.log" 2>&1; say "npm ci: exit $? in $(( $(date +%s) - t )) s"
t=$(date +%s); npx remotion browser ensure >"$OUT/browser.log" 2>&1; say "browser ensure: exit $? in $(( $(date +%s) - t )) s"

t=$(date +%s)
npx remotion render src/index.ts Handy5hSW "$OUT/cloud-1080p.mp4" --crf=18 --log=error >"$OUT/render-1080p.log" 2>&1
rc=$?; d1=$(( $(date +%s) - t )); say "render Full HD: exit $rc in $d1 s"

if [ "$d1" -le 1500 ]; then
  t=$(date +%s)
  npx remotion render src/index.ts Handy5hSW "$OUT/cloud-4K.mp4" --scale=2 --crf=16 --log=error >"$OUT/render-4k.log" 2>&1
  say "render 4K: exit $? in $(( $(date +%s) - t )) s"
else
  say "render 4K: skipped, Full HD took longer than 25 minutes"
fi

for f in 60 900 1620 2190 3120 3810; do
  npx remotion still src/index.ts Handy5hSW "$OUT/f$f-4k.png" --frame=$f --scale=2 --log=error >>"$OUT/stills.log" 2>&1 || say "still $f failed"
done
say "stills: $(ls "$OUT"/*.png 2>/dev/null | wc -l) of 6"

PROBE=$(ls node_modules/@remotion/compositor-*/ffprobe 2>/dev/null | head -1)
if [ -n "$PROBE" ]; then
  export LD_LIBRARY_PATH="$(dirname "$PROBE"):${LD_LIBRARY_PATH:-}"
  for v in "$OUT"/cloud-*.mp4; do
    [ -f "$v" ] || continue
    say "--- $(basename "$v"): $(stat -c %s "$v" 2>/dev/null || stat -f %z "$v") bytes"
    "$PROBE" -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration -of compact "$v" | tee -a "$LOG"
  done
else
  say "ffprobe not found"
fi
say "done"
