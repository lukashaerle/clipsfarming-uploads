#!/usr/bin/env bash
# Put finished video files on the branch lr-videos instead of main, so main stays small and old videos can be dropped.
#   bash remotion/scripts/lr/push_videos.sh <file> [<file> ...]      (paths relative to the repo root, e.g. lebensrechnung/x-4K.mp4)
#   bash remotion/scripts/lr/push_videos.sh --prune <keep_days>       (rebuild lr-videos with only videos of plan dates >= today - keep_days)
# Prints the commit of lr-videos that contains the files (for raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>).
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
WT=$(mktemp -d)
cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"; }
trap cleanup EXIT
git config user.email >/dev/null 2>&1 || git config user.email "lebensrechnung@users.noreply.github.com"
git config user.name >/dev/null 2>&1 || git config user.name "Lebensrechnung"

if [ "${1:-}" = "--prune" ]; then
  KEEP=${2:-2}
  git fetch -q origin lr-videos 2>/dev/null || { echo "no lr-videos branch"; exit 0; }
  CUT=$(python3 -c "import datetime,sys;print((datetime.date.today()-datetime.timedelta(days=int(sys.argv[1]))).isoformat())" "$KEEP")
  KEEP_IDS=$(python3 - "$CUT" <<'PY'
import json, sys
cut = sys.argv[1]
plan = json.load(open("lebensrechnung/plan.json"))
ids = {v for d, slots in plan.items() if d[:1].isdigit() and d >= cut for v in slots.values()}
print(" ".join(sorted(ids)))
PY
)
  git worktree add -q --detach "$WT" origin/lr-videos
  ( cd "$WT"; git checkout -q --orphan lr-videos-new; git rm -rq --cached . >/dev/null 2>&1 || true
    mkdir -p lebensrechnung
    for f in lebensrechnung/*.mp4; do
      [ -e "$f" ] || continue
      id=$(basename "$f" | sed -E 's/-(1080p|4K)\.mp4$//')
      case " $KEEP_IDS " in *" $id "*) git add "$f";; *) rm -f "$f";; esac
    done
    git commit -q --allow-empty -m "lr-videos: nur Videos ab $CUT"
    git push -q -f origin HEAD:lr-videos
    echo "kept: $KEEP_IDS"; git rev-parse --short HEAD )
  exit 0
fi

[ $# -ge 1 ] || { echo "usage: $0 <file>..."; exit 2; }
if git fetch -q origin lr-videos 2>/dev/null; then
  git worktree add -q --detach "$WT" origin/lr-videos
  ( cd "$WT"; git checkout -q -B lr-videos )
else
  git worktree add -q --detach "$WT"
  ( cd "$WT"; git checkout -q --orphan lr-videos; git rm -rq --cached . >/dev/null; find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} + )
fi
for f in "$@"; do mkdir -p "$WT/$(dirname "$f")"; cp "$f" "$WT/$f"; done
( cd "$WT"; git add -- "$@"; git commit -q -m "Videos: $(for f in "$@"; do basename "$f"; done | tr '\n' ' ')"
  for i in 1 2 3; do git push -q origin HEAD:lr-videos && break; git pull -q --rebase origin lr-videos; done
  git rev-parse --short HEAD )
