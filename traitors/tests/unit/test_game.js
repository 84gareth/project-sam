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

test("every game has exactly 3 Traitors", () => {
  for (let seed = 1; seed <= 200; seed++) {
    assert.eq(traitors(newGame("pepper", seed)).length, TRAITOR_COUNT, `seed ${seed}`);
  }
});

test("the game tells you your side, and it matches the deal", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = newGame("pepper", seed);
    const expected = traitors(g).includes("pepper") ? TRAITOR : FAITHFUL;
    assert.eq(g.playerSide, expected, `seed ${seed}`);
  }
});

test("you're a Traitor about 3 games in 22 (fair chance)", () => {
  let mine = 0;
  for (let seed = 1; seed <= 2200; seed++) {
    if (newGame("pepper", seed).playerSide === TRAITOR) mine++;
  }
  // 300 expected; allow for luck.
  assert.gt(mine, 230, `${mine} of 2200`);
  assert.lt(mine, 370, `${mine} of 2200`);
});

test("everyone starts in the game, you included", () => {
  const g = newGame("stan", 3);
  assert.eq(g.players.length, 22);
  assert.ok(g.players.every((p) => p.inGame));
  assert.eq(g.playerId, "stan");
});

test("the same seed gives the same Traitors; different seeds mix them up", () => {
  assert.eq(traitors(newGame("dot", 42)), traitors(newGame("dot", 42)));
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) seen.add(traitors(newGame("dot", seed)).join());
  assert.gt(seen.size, 20, "30 games, mostly different Traitors");
});

test("every character gets to be a Traitor sometimes", () => {
  const count = {};
  for (let seed = 1; seed <= 400; seed++) {
    for (const id of traitors(newGame("dot", seed))) count[id] = (count[id] || 0) + 1;
  }
  for (const c of CHARACTERS) {
    assert.gt(count[c.id] || 0, 20, `${c.name} was a Traitor ${count[c.id] || 0} times in 400`);
  }
});

test("the random numbers are between 0 and 1", () => {
  const r = makeRandom(7);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1, `got ${x}`);
  }
});

test("every drawing listed for a character really exists", async () => {
  const withPictures = CHARACTERS.filter((c) => c.picture);
  assert.gt(withPictures.length, 0, "at least Captain Puddle");
  for (const c of withPictures) {
    const res = await fetch("../" + c.picture);
    assert.ok(res.ok, `${c.name}: ${c.picture} (${res.status})`);
  }
});

test("Sam has drawn all 22 characters", () => {
  assert.eq(CHARACTERS.filter((c) => c.picture).length, 22);
});
