#!/usr/bin/env bash
# Native 4K render in the cloud, in chunks that survive a restart of the machine.
#   bash remotion/scripts/cloud_4k.sh [composition = Handy5hSW] [chunk size in frames = 400]
# Each chunk is rendered silently into remotion/cloud4k-out/chunks/, a finished chunk is skipped when the script
# runs again, and at the end the chunks are joined and the sound track is added. Writes cloud4k-out/report.txt.
set -uo pipefail
cd "$(dirname "$0")/.."
COMP="${1:-Handy5hSW}"
CHUNK="${2:-400}"
OUT=cloud4k-out
mkdir -p "$OUT/chunks"
LOG="$OUT/report.txt"
say() { echo "$*" | tee -a "$LOG"; }

BROWSER=()
[ -x /opt/pw-browsers/chromium ] && BROWSER=(--browser-executable=/opt/pw-browsers/chromium --chrome-mode=chrome-for-testing)
OPTS=(--scale=2 --crf=16 --muted --log=error --timeout=180000 --concurrency=2 ${BROWSER[@]+"${BROWSER[@]}"})

[ -d node_modules ] || { t=$(date +%s); npm ci --no-audit --no-fund >"$OUT/npm.log" 2>&1; say "npm ci: exit $? in $(( $(date +%s) - t )) s"; }
say "start $(date -u +%FT%TZ) | machine: $(uname -sm), cpus: $(nproc), comp $COMP, chunk $CHUNK frames, options: ${OPTS[*]}"

TOTAL=$(npx remotion compositions src/index.ts --log=error ${BROWSER[@]+"${BROWSER[@]}"} 2>/dev/null | awk -v c="$COMP" '$1==c {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/ && $(i+1) ~ /^\(/) print $i}' | head -1)
[ -z "$TOTAL" ] && TOTAL=3900
say "frames: $TOTAL"

i=0
for ((s=0; s<TOTAL; s+=CHUNK)); do
  e=$(( s + CHUNK - 1 )); [ $e -ge $TOTAL ] && e=$(( TOTAL - 1 ))
  f=$(printf "%s/chunks/c%03d.mp4" "$OUT" $i)
  if [ -s "$f.done" ]; then say "chunk $i ($s-$e): already done"; i=$((i+1)); continue; fi
  t=$(date +%s)
  npx remotion render src/index.ts "$COMP" "$f" --frames=$s-$e "${OPTS[@]}" >"$OUT/chunks/c$i.log" 2>&1
  rc=$?; d=$(( $(date +%s) - t ))
  if [ $rc -eq 0 ]; then echo "$d" > "$f.done"; say "chunk $i ($s-$e): $d s"; else say "chunk $i ($s-$e): FAILED exit $rc after $d s"; tail -3 "$OUT/chunks/c$i.log" | tee -a "$LOG"; exit 1; fi
  i=$((i+1))
done

: > "$OUT/chunks/list.txt"
for f in "$OUT"/chunks/c*.mp4; do echo "file '$(basename "$f")'" >> "$OUT/chunks/list.txt"; done
npx remotion ffmpeg -v error -y -f concat -safe 0 -i "$OUT/chunks/list.txt" -i public/motiv/handy5h_mix.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart "$OUT/cloud-4K.mp4"
say "join: exit $?"
total=0; for d in "$OUT"/chunks/*.done; do total=$(( total + $(cat "$d") )); done
say "render time of all chunks: $total s"
npx remotion ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration,size -of compact "$OUT/cloud-4K.mp4" | tee -a "$LOG"
say "done $(date -u +%FT%TZ)"
