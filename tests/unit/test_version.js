// The version in js/version.js is the single source of truth, bumped on
// every gameplay change. Keep it plain MAJOR.MINOR.PATCH.
import { test, assert } from "../framework.js";
import { VERSION, GAME_NAME } from "../../js/version.js";

test("version is major.minor.patch", () => {
  assert.ok(/^\d+\.\d+\.\d+$/.test(VERSION), `version is "${VERSION}"`);
});

test("the game has a name", () => {
  assert.gt(GAME_NAME.length, 0);
});

// Every file the page loads carries the version, so devices fetch the new
// copy after an update. Forgot `python3 tools/stamp.py`? This fails.
test("index.html is stamped with the current version", async () => {
  const html = await (await fetch("../index.html", { cache: "no-store" })).text();
  const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const files = ["main", "version", "characters", "game", "castle", "castle-ui", "puppets", "ui", "voice", "sound", "dialogue", "missions", "mission-ui", "mission-more", "fit", "save", "lobby", "net", "multiplayer-ui", "firebase-net", "engine", "net-engine"];
  for (const f of files) assert.eq(map[`./js/${f}.js`], `./js/${f}.js?v=${VERSION}`, f);
  assert.ok(html.includes(`css/style.css?v=${VERSION}`), "the stylesheet too");
  assert.ok(html.includes(`js/main.js?v=${VERSION}"`), "and the first script");
});
