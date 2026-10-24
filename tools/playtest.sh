#!/usr/bin/env bash
# Play the game: serves this folder and opens it in the Mac's browser.
# The iPad can play the same copy over home Wi-Fi (the address is printed),
# or the published copy on GitHub Pages once changes are pushed.
#
#   tools/playtest.sh             the game
#   tools/playtest.sh tests       the test page, in a visible browser
#
# Stop it with Ctrl+C (or the terminal's stop button).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=8000
PAGE=""
case "${1:-}" in
  "") PAGE="" ;;
  tests) PAGE="tests/" ;;
  -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
  *) echo "Unknown page '$1'. Try: tools/playtest.sh  or  tools/playtest.sh tests"; exit 2 ;;
esac

VERSION="$(sed -n 's/^export const VERSION = "\(.*\)";/\1/p' js/version.js)"
WIFI_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo "Starting Project Sam v$VERSION"
echo "  On this Mac:       http://localhost:$PORT/$PAGE"
[ -n "$WIFI_IP" ] && echo "  On the iPad:       http://$WIFI_IP:$PORT/$PAGE   (same Wi-Fi)"
echo "  Published (iPad):  https://84gareth.github.io/project-sam/"

# Already serving from an earlier run? Just open the page.
if python3 -c "import socket,sys; socket.create_connection(('127.0.0.1', $PORT), 0.2)" 2>/dev/null; then
  open "http://localhost:$PORT/$PAGE"
  exit 0
fi

( sleep 0.7; open "http://localhost:$PORT/$PAGE" ) &
# Serve to the home network too, so the iPad can reach it. Ctrl+C stops it.
exec python3 -m http.server "$PORT" --bind 0.0.0.0
