#!/usr/bin/env bash
# Produce one Lebensrechnung video from its folder, after the narration exists.
#   bash scripts/lr/night.sh <video id> [out dir = out/lr]
# Steps also include a safe-zone check (scripts/lr/safezone.mjs); a violation stops the run before rendering.
# Needs videos/<id>/spec.json and videos/<id>/take.mp3; uses videos/<id>/words.json (ElevenLabs Scribe word times)
# when it is there, otherwise a local Whisper run. Steps: sound and timing -> listening check -> Full HD -> native 4K.
# 4K is rendered in chunks (a chunk survives a restart of the machine) into a near-lossless intermediate and encoded
# to H.264 once at the end, so there are no seams between the chunks.
# Writes <out>/<id>-1080p.mp4, <out>/<id>-4K.mp4 and <out>/<id>-report.txt; exit 1 if a step failed.
set -uo pipefail
cd "$(dirname "$0")/../.."
VID="$1"
OUT="${2:-out/lr}"
DIR="videos/$VID"
WORK="$DIR/build"
mkdir -p "$OUT" "$WORK/chunks"
LOG="$OUT/$VID-report.txt"
: > "$LOG"
say() { echo "$*" | tee -a "$LOG"; }
PY="${PYTHON:-python3}"
[ -x .venv/bin/python ] && PY=.venv/bin/python

BROWSER=()
[ -x /opt/pw-browsers/chromium ] && BROWSER=(--browser-executable=/opt/pw-browsers/chromium --chrome-mode=chrome-for-testing)
COMMON=(--log=error --timeout=180000 ${BROWSER[@]+"${BROWSER[@]}"})
CPUS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
CONC=$(( CPUS > 4 ? 4 : (CPUS < 2 ? 1 : CPUS / 2) ))

say "== $VID | start $(date -u +%FT%TZ) | $(uname -sm), $CPUS cpus"
[ -s "$DIR/spec.json" ] && [ -s "$DIR/take.mp3" ] || { say "FEHLT: $DIR/spec.json oder $DIR/take.mp3"; exit 1; }

# ---- 1. sound and timing
WORDS=()
[ -s "$DIR/words.json" ] && WORDS=(--words "$DIR/words.json")
t=$(date +%s)
"$PY" -I scripts/lr/build_audio.py "$DIR/spec.json" "$DIR/take.mp3" "$WORK" ${WORDS[@]+"${WORDS[@]}"} --public public/lr >"$WORK/audio.log" 2>&1
rc=$?
tail -4 "$WORK/audio.log" | tee -a "$LOG"
[ $rc -eq 0 ] || { say "TON: FEHLER exit $rc"; exit 1; }
say "ton: fertig in $(( $(date +%s) - t )) s"

# ---- 2. listening check (does not stop the run; the report goes to the morning approval)
"$PY" -I scripts/voicetest/listen.py "$WORK/mix.json" src/motiv/script.ts "$WORK/listen" "$WORK/align.json" >"$WORK/listen.log" 2>&1
lrc=$?
grep -E "^(CUTS|EDGES|WORDS|LEVEL|FLOW|PAUSES)" "$WORK/listen.log" | tee -a "$LOG"
if [ $lrc -eq 0 ]; then say "hoerpruefung: ok"; else say "hoerpruefung: bitte anhoeren"; grep -E "^ *- |^  s[0-9]" "$WORK/listen.log" | head -8 | tee -a "$LOG"; fi

"$PY" -I - "$DIR/spec.json" "$WORK/timeline.json" "$WORK/props.json" <<'EOF'
import json, sys
spec, tl, out = sys.argv[1:4]
json.dump({"spec": json.load(open(spec, encoding="utf-8")), "timeline": json.load(open(tl, encoding="utf-8"))}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
EOF
LEN=$("$PY" -I -c "import json,sys; print(json.load(open(sys.argv[1]))['length'])" "$WORK/timeline.json")
FRAMES=$("$PY" -I -c "import sys; print(round(float(sys.argv[1]) * 60))" "$LEN")
say "laenge: $LEN s ($FRAMES Bilder)"

# ---- 2b. safe zone: no text or graphic where the app's buttons and captions cover the video
node scripts/lr/safezone.mjs "$DIR/spec.json" "$WORK/timeline.json" "$WORK/zone" >"$WORK/zone.log" 2>&1
zrc=$?
grep -E "SAFE ZONE|^  - " "$WORK/zone.log" | tee -a "$LOG"
[ $zrc -eq 0 ] || { say "SICHERE ZONE: VERLETZT, nicht gerendert (Bild: $WORK/zone/zonen.png)"; exit 1; }

# ---- 3. Full HD
t=$(date +%s)
npx remotion render src/index.ts LR "$OUT/$VID-1080p.mp4" --props="$WORK/props.json" --crf=18 --concurrency=$CONC "${COMMON[@]}" >"$WORK/render1080.log" 2>&1
rc=$?
[ $rc -eq 0 ] || { tail -5 "$WORK/render1080.log" | tee -a "$LOG"; say "FULL HD: FEHLER exit $rc"; exit 1; }
say "full hd: fertig in $(( $(date +%s) - t )) s"

# ---- 4. native 4K: chunks as ProRes, one H.264 encode at the end
CHUNK=600
i=0
t=$(date +%s)
for ((s=0; s<FRAMES; s+=CHUNK)); do
  e=$(( s + CHUNK - 1 )); [ $e -ge $FRAMES ] && e=$(( FRAMES - 1 ))
  f=$(printf "%s/chunks/c%03d.mov" "$WORK" $i)
  if [ -s "$f.done" ]; then i=$((i+1)); continue; fi
  npx remotion render src/index.ts LR "$f" --props="$WORK/props.json" --frames=$s-$e --scale=2 --codec=prores --prores-profile=light --muted --concurrency=$CONC "${COMMON[@]}" >"$WORK/chunks/c$i.log" 2>&1
  rc=$?
  [ $rc -eq 0 ] || { tail -5 "$WORK/chunks/c$i.log" | tee -a "$LOG"; say "4K: abschnitt $i FEHLER exit $rc"; exit 1; }
  echo ok > "$f.done"
  i=$((i+1))
done
: > "$WORK/chunks/list.txt"
for f in "$WORK"/chunks/c*.mov; do echo "file '$(basename "$f")'" >> "$WORK/chunks/list.txt"; done
npx remotion ffmpeg -v error -y -f concat -safe 0 -i "$WORK/chunks/list.txt" -i "public/lr/$VID.mp3" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 60 -c:a aac -b:a 320k -shortest -movflags +faststart "$OUT/$VID-4K.mp4"
rc=$?
[ $rc -eq 0 ] || { say "4K: zusammenfuegen FEHLER exit $rc"; exit 1; }
rm -f "$WORK"/chunks/c*.mov
say "4k: fertig in $(( $(date +%s) - t )) s ($i abschnitte, einmal kodiert)"

for q in 1080p 4K; do
  npx remotion ffprobe -v error -show_entries stream=codec_name,width,height:format=duration,size -of compact "$OUT/$VID-$q.mp4" | tr '\n' ' ' | tee -a "$LOG"; echo | tee -a "$LOG"
done
say "== $VID | fertig $(date -u +%FT%TZ)"
