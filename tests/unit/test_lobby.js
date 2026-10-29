// Multiplayer lobby rules (Phase 8).
import { test, assert } from "../framework.js";
import { makeRandom } from "../../js/game.js";
import {
  SYMBOLS, CODE_LENGTH, newCode, codeName, parseCode, newRoom, join, pick, takenBy, canStart, seatOrder, MAX_PLAYERS,
} from "../../js/lobby.js";

test("codes: four of the eight symbols, and back again", () => {
  const r = makeRandom(1);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const c = newCode(r);
    assert.eq(c.length, CODE_LENGTH);
    for (const s of c) assert.ok(SYMBOLS.includes(s));
    assert.eq(parseCode(codeName(c)), c);
    seen.add(codeName(c));
  }
  assert.gt(seen.size, 150, "lots of different codes");
  assert.eq(SYMBOLS.length, 8);
  assert.eq(parseCode("moon-key"), null);
  assert.eq(parseCode("moon-key-car-sun"), null);
});

test("join, pick a character nobody else has, then start", () => {
  let room = newRoom(["moon", "key", "key", "sun"], "h", 1);
  room = join(room, "p2", 2).room;
  assert.eq(seatOrder(room), ["h", "p2"], "host first");
  assert.notOk(canStart(room), "nobody has picked");
  room = pick(room, "h", "pepper").room;
  assert.eq(pick(room, "p2", "pepper").error, "taken");
  room = pick(room, "p2", "puddle").room;
  assert.eq(takenBy(room, "puddle"), "p2");
  assert.ok(canStart(room));
  room = pick(room, "p2", "fizz").room;   // change your mind
  assert.eq(takenBy(room, "puddle"), null);
  assert.eq(join({ ...room, started: true }, "p3").error, "started");
  assert.eq(join(room, "p2").room, room, "joining twice is fine");
});

test("up to all 22 players", () => {
  let room = newRoom(["star", "star", "star", "star"], "h", 0);
  for (let i = 1; i < MAX_PLAYERS; i++) room = join(room, `p${i}`, i).room;
  assert.eq(Object.keys(room.seats).length, 22);
  assert.eq(join(room, "late").error, "full");
});
