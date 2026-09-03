#!/bin/bash
# chaos-load.sh — drives the chaos fixture of THIS app (tactica-nestjs).
#
#   GET  /chaos/ok                     control path, sustained load via `ab`
#   POST /chaos/crash                  real uncaughtException (setImmediate)
#   POST /chaos/reject                 real unhandledRejection (dangling)
#   POST /chaos/delayed {outcome}      100ms-after-construction callback:
#                                      ok | throw | reject (disconnected data)
#   POST /chaos/pure-error             wrapped error, NO mnemonica instance
#
# Usage:  bash scripts/chaos-load.sh [rounds]     (default 10 rounds)
#         BASE=http://127.0.0.1:3000 bash scripts/chaos-load.sh
#
# Watch the evidence in Mnemographica Live Trace (green ok / red errored)
# and Jaeger http://localhost:16686 (service: tactica-nestjs).

set -u

BASE="${BASE:-http://127.0.0.1:3000}"
ROUNDS="${1:-10}"

if ! curl -sf "$BASE/chaos/ok" >/dev/null; then
	echo "app not answering at $BASE — start it first:" >&2
	echo "  npm run build && STRATEGY_CLIENT=1 npm run start:prod" >&2
	exit 1
fi

echo "== sustained control load: ab -n 3000 -c 10 $BASE/chaos/ok (background)"
ab -n 3000 -c 10 "$BASE/chaos/ok" > /tmp/chaos-ab.txt 2>&1 &
AB=$!

echo "== $ROUNDS chaos rounds while ab runs"
for i in $(seq 1 "$ROUNDS"); do
	curl -sf -X POST "$BASE/chaos/crash"      >/dev/null && echo "  [$i] crash        → uncaughtException scheduled"
	curl -sf -X POST "$BASE/chaos/reject"     >/dev/null && echo "  [$i] reject       → unhandledRejection scheduled"
	curl -sf -X POST -H 'content-type: application/json' -d '{"outcome":"throw"}'  "$BASE/chaos/delayed" >/dev/null && echo "  [$i] delayed/throw  → uncaughtException in 100ms"
	curl -sf -X POST -H 'content-type: application/json' -d '{"outcome":"reject"}' "$BASE/chaos/delayed" >/dev/null && echo "  [$i] delayed/reject → unhandledRejection in 100ms"
	curl -sf -X POST -H 'content-type: application/json' -d '{"outcome":"ok"}'     "$BASE/chaos/delayed" >/dev/null && echo "  [$i] delayed/ok     → response in 100ms"
	curl -sf -X POST "$BASE/chaos/pure-error" >/dev/null && echo "  [$i] pure-error   → uncaughtException, NO instance"
	sleep 0.3
done

wait "$AB"
echo ""
echo "== ab summary"
grep -E 'Requests per second|Failed requests|Complete requests' /tmp/chaos-ab.txt
echo ""
echo "Expected evidence:"
echo "  Live Trace: $ROUNDS red rows (crash, delayed/throw, pure-error),"
echo "              $ROUNDS gray/red rejection rows, green ok rows"
echo "  App stdout: one structured JSON line per uncaughtException /"
echo "              unhandledRejection with the dive branch + extracted fields"
echo "  Jaeger:     service tactica-nestjs, errored spans on crash/reject traces"
