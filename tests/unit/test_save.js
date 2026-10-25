// Saving: the game remembers the day you got to.
import { test, assert } from "../framework.js";
import { newGame } from "../../js/game.js";
import { arriveAtCastle, roundTable, stillIn, recruit } from "../../js/castle.js";
import { packGame, unpackGame, saveGame, loadGame, clearSave } from "../../js/save.js";

// A pretend browser storage.
const fakeStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test("a game a few days in comes back exactly the same", () => {
  const g = arriveAtCastle(newGame("dot", 7));
  roundTable(g, stillIn(g).find((id) => id !== "dot"));
  recruit(g);
  g.pot = 4500;
  g.shields = ["puddle"];
  const back = unpackGame(packGame(g));
  assert.eq(back, JSON.parse(JSON.stringify(g)));
  // And it still plays on.
  roundTable(back, stillIn(back).find((id) => id !== "dot"));
  assert.eq(back.history.length, 2);
});

test("save, load and clear", () => {
  const store = fakeStore();
  assert.eq(loadGame(store), null, "nothing saved yet");
  const g = arriveAtCastle(newGame("pepper", 3));
  saveGame(g, store);
  assert.eq(loadGame(store).playerId, "pepper");
  clearSave(store);
  assert.eq(loadGame(store), null);
});

test("a broken or old save is ignored", () => {
  assert.eq(unpackGame("not json"), null);
  assert.eq(unpackGame(JSON.stringify({ v: 999, game: {} })), null);
  assert.eq(unpackGame(JSON.stringify({ v: 1, game: { players: [] } })), null);
  assert.eq(unpackGame(null), null);
  const broken = { getItem: () => { throw new Error("no storage"); }, setItem: () => { throw new Error("full"); }, removeItem: () => {} };
  assert.eq(loadGame(broken), null, "storage that throws");
  saveGame(arriveAtCastle(newGame("dot", 1)), broken);   // doesn't crash
});

test("an old save with one shield still loads", () => {
  const g = arriveAtCastle(newGame("dot", 2));
  const old = JSON.parse(packGame(g));
  old.game.shield = "fizz";
  delete old.game.shields;
  const back = unpackGame(JSON.stringify(old));
  assert.eq(back.shields, ["fizz"]);
  assert.eq(back.shield, undefined);
});
