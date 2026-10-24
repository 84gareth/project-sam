#!/usr/bin/env python3
"""Stamp the game's version onto every file index.html loads, so browsers and
the iPad always fetch the newest copy after an update (Gareth, 2026-10-24:
Barry's picture didn't show because an old js/characters.js was kept).

Writes an import map (every js/*.js -> js/name.js?v=VERSION) and a
versioned stylesheet link into index.html, between the STAMP markers.
Run after bumping VERSION in js/version.js; a unit test fails if you forget.
    python3 tools/stamp.py
"""
import pathlib, re, json

root = pathlib.Path(__file__).resolve().parent.parent
version = re.search(r'VERSION = "([^"]+)"', (root / "js/version.js").read_text()).group(1)
modules = sorted(p.name for p in (root / "js").glob("*.js"))
imports = {f"./js/{m}": f"./js/{m}?v={version}" for m in modules}
block = (
    "<!-- STAMP (tools/stamp.py writes this; don't edit by hand) -->\n"
    f'  <script type="importmap">{json.dumps({"imports": imports}, indent=2)}</script>\n'
    f'  <link rel="stylesheet" href="css/style.css?v={version}">\n'
    "  <!-- /STAMP -->"
)
html = (root / "index.html").read_text()
html = re.sub(r"<!-- STAMP.*?<!-- /STAMP -->", lambda m: block, html, flags=re.S)
html = re.sub(r'<script type="module" src="js/main\.js[^"]*"></script>',
              f'<script type="module" src="js/main.js?v={version}"></script>', html)
(root / "index.html").write_text(html)
print(f"stamped v{version} on {len(modules)} modules")
