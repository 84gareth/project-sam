#!/usr/bin/env bash
# Run every test in a hidden (headless) Chrome.
#   ./run_tests.sh [--only=<name>] [--game=traitors|home]
# Each game has its own tests, plus the home page that picks between them:
#   traitors/tests   The Traitors              (unit and live lanes)
#   tests            the home page
# Pages are served over http (like GitHub Pages), because browsers block
# JavaScript modules opened straight from a file.
# Green means every page printed its "Total:" line with 0 failed.
# Override Chrome with:  CHROME="/path/to/chrome" ./run_tests.sh
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then
  echo "Could not find Chrome. Run again like:"
  echo "  CHROME=\"/path/to/chrome\" ./run_tests.sh"
  exit 1
fi

# Optional filters: --only runs only test files whose name contains it;
# --game runs one game's tests. Use them while iterating; run the FULL
# suite before the final push.
ONLY=""
GAMES="traitors home"
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --game=*) GAMES="${arg#--game=}" ;;
    *) echo "unknown option: $arg"; exit 2 ;;
  esac
done
[ -n "$ONLY" ] && echo "Focus: $ONLY  (full suite is the commit gate)"

# A private web server on a free port, stopped when this script ends.
PORT="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
# Its queue holds 128 waiting requests, not the usual 5: a page loads ~15
# files at once, and a turned-away module stopped the page starting now and
# then (2026-10-24).
python3 -c '
import http.server, sys
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
Server(("127.0.0.1", int(sys.argv[1])), Quiet).serve_forever()
' "$PORT" >/dev/null 2>&1 &
SERVER=$!
PROFILES=()
OUTFILE="$(mktemp)"
trap 'kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null || true; for p in ${PROFILES[@]+"${PROFILES[@]}"}; do rm -r "$p"; done; rm -f "$OUTFILE"' EXIT
python3 - "$PORT" <<'EOF'
import socket, sys, time
for _ in range(100):
    try:
        socket.create_connection(("127.0.0.1", int(sys.argv[1])), 0.1).close()
        break
    except OSError:
        time.sleep(0.05)
EOF

TOTAL=0; FAILED=0; BROKEN=""
for game in $GAMES; do
  case "$game" in
    traitors) PAGE="traitors/tests/index.html" ;;
    home) PAGE="tests/index.html" ;;
    *) echo "unknown game: $game (try traitors or home)"; exit 2 ;;
  esac
  [ -f "$PAGE" ] || continue
  echo "── $game ──"
  # A throwaway Chrome profile per page, so this never touches the Chrome
  # you use, and one game's saved games can't leak into the other's tests.
  PROFILE="$(mktemp -d)"
  PROFILES+=("$PROFILE")
  # --virtual-time-budget lets the async tests finish before the page is
  # read (120 s of test-clock time). A 120 s stopwatch (macOS has no
  # `timeout` command, so Python keeps it): a test stuck in an endless loop
  # fails the run instead of freezing it.
  python3 - "$CHROME" "$PROFILE" "http://127.0.0.1:$PORT/$PAGE?only=$ONLY" <<'EOF' | tee "$OUTFILE"
import html, re, subprocess, sys
chrome, profile, url = sys.argv[1:4]
try:
    page = subprocess.run(
        [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
         "--no-default-browser-check", "--user-data-dir=" + profile,
         "--virtual-time-budget=120000", "--dump-dom", url],
        capture_output=True, text=True, timeout=120).stdout
except subprocess.TimeoutExpired:
    print("TIMED OUT after 120 s: a test is probably stuck in an endless loop.")
    sys.exit(0)
m = re.search(r"<pre id=\"out\">(.*?)</pre>", page, re.S)
print(html.unescape(m.group(1)) if m else "NO RESULTS: the test page did not render.")
EOF
  RESULT="$(grep '^Total: ' "$OUTFILE" || true)"
  if [ -z "$RESULT" ]; then
    BROKEN="$BROKEN $game"
    continue
  fi
  TOTAL=$((TOTAL + $(echo "$RESULT" | sed -n 's/^Total: \([0-9]*\).*/\1/p')))
  FAILED=$((FAILED + $(echo "$RESULT" | sed -n 's/.*Failed: \([0-9]*\)$/\1/p')))
  echo ""
done

echo "All games: $TOTAL tests, $FAILED failed"
if [ -n "$BROKEN" ]; then
  echo "TESTS DID NOT FINISH for:$BROKEN (no 'Total:' line). Look for a FAIL or an error above."
  exit 1
fi
if [ "$FAILED" -eq 0 ]; then
  echo "All green."
  exit 0
fi
echo "FAILED."
exit 1
