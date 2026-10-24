#!/usr/bin/env bash
# Run BOTH test lanes headless. Usage: ./run_tests.sh [--only=<name>]
#   1. unit lane  (tests/unit)  pure logic, run with --script
#   2. live lane  (tests/live)  real nodes in a real scene tree, run as a
#      scene because --script registers no autoloads. See
#      tests/framework/live_case.gd.
# Green means BOTH lanes passed.
# Override the Godot binary with:  GODOT="/path/to/Godot" ./run_tests.sh
set -euo pipefail
cd "$(dirname "$0")"

GODOT="${GODOT:-}"
if [ -z "$GODOT" ]; then
  if command -v godot >/dev/null 2>&1; then
    GODOT="godot"
  else
    # Common macOS locations (Applications, Downloads, Desktop).
    for p in \
      /Applications/Godot*.app/Contents/MacOS/Godot \
      "$HOME"/Applications/Godot*.app/Contents/MacOS/Godot \
      "$HOME"/Downloads/Godot*.app/Contents/MacOS/Godot \
      "$HOME"/Desktop/Godot*.app/Contents/MacOS/Godot ; do
      if [ -x "$p" ]; then GODOT="$p"; break; fi
    done
  fi
fi

if [ -z "$GODOT" ]; then
  echo "Could not find Godot. Run again like:"
  echo "  GODOT=\"/path/to/Godot.app/Contents/MacOS/Godot\" ./run_tests.sh"
  exit 1
fi

# Optional focus filter:  ./run_tests.sh --only=player
# Runs only test files whose NAME contains that substring, in both lanes.
# Use it while iterating; run the FULL suite before committing.
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    *) echo "unknown option: $arg"; exit 2 ;;
  esac
done

echo "Using Godot: $GODOT"
[ -n "$ONLY" ] && echo "Focus: $ONLY  (full suite is the commit gate)"
export TEST_ONLY="$ONLY"

# A fresh checkout has no .godot/ import cache, and scripts can't resolve
# their resources without it. Build it once, quietly.
if [ ! -d .godot ]; then
  echo "First run: building the import cache..."
  "$GODOT" --headless --import >/dev/null 2>&1 || true
fi

# Each lane must PROVE it ran to completion, not merely exit 0. A test file
# that fails to compile can take a whole runner down before it prints
# anything, and Godot still exits 0. So the gate is the summary line: if a
# lane did not print it, the lane did not finish.
unit_status=0
unit_out="$(mktemp)"
"$GODOT" --headless --script res://tests/run_tests.gd 2>&1 | tee "$unit_out" || unit_status=$?
if ! grep -q "^Total: " "$unit_out"; then
  echo ""
  echo "UNIT LANE DID NOT FINISH — no 'Total:' summary line."
  echo "Almost always a test file that fails to COMPILE; look for 'Parse Error' above."
  unit_status=1
fi
rm -f "$unit_out"

echo ""
live_status=0
live_out="$(mktemp)"
"$GODOT" --headless res://tests/live_runner.tscn 2>&1 | tee "$live_out" || live_status=$?
if ! grep -q "^Live: " "$live_out"; then
  echo ""
  echo "LIVE LANE DID NOT FINISH — no 'Live:' summary line."
  live_status=1
fi
rm -f "$live_out"

echo ""
if [ "$unit_status" -eq 0 ] && [ "$live_status" -eq 0 ]; then
  echo "Both lanes green."
  exit 0
fi
[ "$unit_status" -ne 0 ] && echo "UNIT LANE FAILED (exit $unit_status)"
[ "$live_status" -ne 0 ] && echo "LIVE LANE FAILED (exit $live_status)"
exit 1
