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
