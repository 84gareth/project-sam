#!/usr/bin/env bash
# Start Turbo Town in a window, the way Sam plays it.
#
#   tools/playtest.sh                 the game (scenes/main.tscn)
#   tools/playtest.sh <scene>         jump straight to one scene, by name in
#                                     scenes/ (e.g. test_area) or a res:// path
#   tools/playtest.sh <scene> -- ...  anything after -- goes to Godot as-is
#                                     (e.g. -- --quit-after 300)
#
# Override the Godot binary with:  GODOT="/path/to/Godot" tools/playtest.sh
set -euo pipefail
cd "$(dirname "$0")/.."

GODOT="${GODOT:-}"
if [ -z "$GODOT" ]; then
  if command -v godot >/dev/null 2>&1; then
    GODOT="godot"
  else
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
  echo "  GODOT=\"/path/to/Godot.app/Contents/MacOS/Godot\" tools/playtest.sh"
  exit 1
fi

SCENE=""
EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --) shift; EXTRA=("$@"); break ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    res://*) SCENE="$1" ;;
    *)
      SCENE="res://scenes/$1.tscn"
      if [ ! -f "scenes/$1.tscn" ]; then
        echo "No scene called '$1'. Scenes you can pick:"
        ls scenes | sed -n 's/\.tscn$//p' | sed 's/^/  /'
        exit 2
      fi
      ;;
  esac
  shift
done

# A fresh checkout has no import cache; build it once so the game can load.
if [ ! -d .godot ]; then
  echo "First run: building the import cache..."
  "$GODOT" --headless --import >/dev/null 2>&1 || true
fi

VERSION="$(sed -n 's/^config\/version="\(.*\)"/\1/p' project.godot)"
echo "Starting Turbo Town v$VERSION ${SCENE:-(main scene)}"
ARGS=(--path .)
[ -n "$SCENE" ] && ARGS+=("$SCENE")
exec "$GODOT" "${ARGS[@]}" ${EXTRA[@]+"${EXTRA[@]}"}
