#!/bin/bash
# ring-experiment.sh [strong|weak] — reproduces the dive ring memory
# experiments of 2026-09-02 (results + table live in
# dive/reports/lastcontext-ambiguity.md, "Experiment 1/2").
#
#   strong — unbounded ring, STRONG instance refs (experiment 1: the pin)
#   weak   — unbounded ring, WeakRef instance refs (experiment 2: release)
#
# The ring default is unbounded and refs are WEAK by default since dive's
# 2026-09-02 flips; DIVE_RING=1024 restores the old bound, DIVE_STRONG=1
# restores strong refs. Against a pre-weak-refs dive (backup branch) both
# modes run strong — that IS experiment 1.
#
# What it does: builds if needed, starts the app with MEM_WATCH=1 under
# node --expose-gc (per-second memory lines, forced GC every 10s), fires
# ab at /chaos/ok, watches the cooldown, prints baseline → peak → floor.
#
# Env overrides: REQUESTS (60000), CONCURRENCY (20), COOLDOWN_S (45),
# PORT (3000), LOG (/tmp/ring-experiment-<mode>.log)

set -u
cd "$(dirname "$0")/.." || exit 1

MODE="${1:-strong}"
REQUESTS="${REQUESTS:-60000}"
CONCURRENCY="${CONCURRENCY:-20}"
COOLDOWN_S="${COOLDOWN_S:-45}"
PORT="${PORT:-3000}"
LOG="${LOG:-/tmp/ring-experiment-$MODE.log}"

if [ "$MODE" != "strong" ] && [ "$MODE" != "weak" ]; then
	echo "usage: bash scripts/ring-experiment.sh [strong|weak]" >&2
	exit 1
fi

if [ ! -f dist/src/main.js ]; then
	echo "== building (dist missing)"
	npm run build || exit 1
fi

DIVE_REFS_ENV=""
[ "$MODE" = "weak" ] && DIVE_REFS_ENV="DIVE_WEAK=1"
[ "$MODE" = "strong" ] && DIVE_REFS_ENV="DIVE_STRONG=1"

echo "== starting app (mode=$MODE, ring=unbounded, log=$LOG)"
env $DIVE_REFS_ENV MEM_WATCH=1 PORT="$PORT" \
	node --expose-gc dist/src/main.js > "$LOG" 2>&1 &
APP=$!
trap 'kill "$APP" 2>/dev/null' INT TERM

for i in $(seq 1 30); do
	grep -q "NestJS server running" "$LOG" 2>/dev/null && break
	sleep 1
done
grep -q "NestJS server running" "$LOG" || { echo "app never booted — see $LOG" >&2; kill "$APP" 2>/dev/null; exit 1; }
grep -E "memwatch.*(ring|refs)" "$LOG"

echo "== load: ab -n $REQUESTS -c $CONCURRENCY http://127.0.0.1:$PORT/chaos/ok"
ab -n "$REQUESTS" -c "$CONCURRENCY" "http://127.0.0.1:$PORT/chaos/ok" 2>&1 \
	| grep -E "Requests per second|Failed requests|Time taken"

echo "== cooldown ${COOLDOWN_S}s (forced GC every 10s inside the app)"
sleep "$COOLDOWN_S"

kill "$APP" 2>/dev/null
trap - INT TERM

heaps=$(grep '\[memwatch\]' "$LOG" | sed -nE 's/.*heap=([0-9.]+)\/.*/\1/p')
baseline=$(echo "$heaps" | head -1)
peak=$(echo "$heaps" | sort -rn | head -1)
floor=$(echo "$heaps" | tail -1)
rsspeak=$(grep '\[memwatch\]' "$LOG" | sed -nE 's/.*rss=([0-9.]+)MB.*/\1/p' | sort -rn | head -1)
rssfloor=$(grep '\[memwatch\]' "$LOG" | tail -1 | sed -nE 's/.*rss=([0-9.]+)MB.*/\1/p')
collected=$(grep '\[memwatch\]' "$LOG" | tail -1 | sed -nE 's/.*collected=([0-9]+).*/\1/p')

echo ""
echo "== summary ($MODE, $REQUESTS requests)"
echo "   heap baseline : ${baseline}MB"
echo "   heap peak     : ${peak}MB"
echo "   heap floor    : ${floor}MB   (after cooldown + forced GCs)"
echo "   rss peak/floor: ${rsspeak}MB / ${rssfloor}MB"
[ -n "$collected" ] && echo "   instances collected by GC: $collected (of $REQUESTS)"
echo "   full log: $LOG"
echo ""
echo "strong reference point (exp 1): floor stayed 438.8MB — zero release"
echo "weak   reference point (exp 2): floor fell to 190MB, collected=60000/60000"
