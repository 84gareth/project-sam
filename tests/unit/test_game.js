// The 22 characters and the rules for starting a game.
import { test, assert } from "../framework.js";
import { CHARACTERS, initials } from "../../js/characters.js";
import { newGame, makeRandom, FAITHFUL, TRAITOR, TRAITOR_COUNT } from "../../js/game.js";

const traitors = (g) => g.players.filter((p) => p.side === TRAITOR).map((p) => p.id);

test("there are 22 characters, all different", () => {
  assert.eq(CHARACTERS.length, 22);
  assert.eq(new Set(CHARACTERS.map((c) => c.id)).size, 22, "ids");
  assert.eq(new Set(CHARACTERS.map((c) => c.name)).size, 22, "names");
  for (const c of CHARACTERS) assert.ok(c.about.length > 0, c.name + " has a line");
});

test("initials", () => {
  assert.eq(initials("Chef Pepper"), "CP");
  assert.eq(initials("Sir Reginald Waffle"), "SR");
  assert.eq(initials("Zara"), "Z");
});

test("a Faithful game has 3 Traitors, and you're not one", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = newGame("pepper", FAITHFUL, seed);
    assert.eq(traitors(g).length, TRAITOR_COUNT, `seed ${seed}`);
    assert.notOk(traitors(g).includes("pepper"), `seed ${seed}`);
  }
});

test("a Traitor game has 3 Traitors, and you're one", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = newGame("pepper", TRAITOR, seed);
    assert.eq(traitors(g).length, TRAITOR_COUNT, `seed ${seed}`);
    assert.ok(traitors(g).includes("pepper"), `seed ${seed}`);
  }
});

test("everyone starts in the game, you included", () => {
  const g = newGame("stan", FAITHFUL, 3);
  assert.eq(g.players.length, 22);
  assert.ok(g.players.every((p) => p.inGame));
  assert.eq(g.playerId, "stan");
  assert.eq(g.playerSide, FAITHFUL);
});

test("the same seed gives the same Traitors; different seeds mix them up", () => {
  assert.eq(traitors(newGame("dot", FAITHFUL, 42)), traitors(newGame("dot", FAITHFUL, 42)));
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) seen.add(traitors(newGame("dot", FAITHFUL, seed)).join());
  assert.gt(seen.size, 20, "30 games, mostly different Traitors");
});

test("every character gets to be a Traitor sometimes", () => {
  const count = {};
  for (let seed = 1; seed <= 400; seed++) {
    for (const id of traitors(newGame("dot", FAITHFUL, seed))) count[id] = (count[id] || 0) + 1;
  }
  for (const c of CHARACTERS) {
    if (c.id !== "dot") assert.gt(count[c.id] || 0, 20, `${c.name} was a Traitor ${count[c.id] || 0} times in 400`);
  }
});

test("the random numbers are between 0 and 1", () => {
  const r = makeRandom(7);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1, `got ${x}`);
  }
});
