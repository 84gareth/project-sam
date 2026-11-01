// The paper puppet castle's movement rules.
import { test, assert } from "../framework.js";
import { newGame, makeRandom } from "../../js/game.js";
import {
  ROOMS, FLOOR, createWorld, step, tapTo, walkUpTo, nextTo, neighbour, peopleIn,
} from "../../js/puppets.js";

const setup = (seed = 1) => {
  const game = newGame("pepper", seed);
  const random = makeRandom(seed);
  return { game, random, world: createWorld(game, random), stillIn: game.players.map((p) => p.id) };
};
const run = ({ world, stillIn, random }, seconds) => {
  for (let t = 0; t < seconds; t += 0.05) step(world, stillIn, 0.05, random);
};
const onFloor = (p) => p.x >= FLOOR.left - 0.07 && p.x <= FLOOR.right + 0.07 && p.y >= FLOOR.top - 1e-9 && p.y <= FLOOR.bottom + 1e-9;

test("everyone but Sam is spread round the four rooms; Sam starts in the great hall", () => {
  const { world, game } = setup();
  assert.eq(Object.keys(world.people).length, 21);
  assert.notOk(world.people.pepper, "Sam isn't one of the others");
  for (const r of ROOMS) assert.gt(peopleIn(world, r.id, game.players.map((p) => p.id)).length, 3, r.id);
  assert.eq(world.me.room, "hall");
});

test("the rooms are joined in a row by doors", () => {
  assert.eq(neighbour("kitchen", "left"), null);
  assert.eq(neighbour("kitchen", "right"), "hall");
  assert.eq(neighbour("hall", "right"), "library");
  assert.eq(neighbour("garden", "right"), null);
});

test("over two minutes, people wander between rooms, chat, and stay on the floor", () => {
  const s = setup(3);
  const start = Object.fromEntries(Object.entries(s.world.people).map(([id, p]) => [id, p.room]));
  let chats = 0;
  for (let t = 0; t < 120; t += 0.05) {
    step(s.world, s.stillIn, 0.05, s.random);
    for (const p of Object.values(s.world.people)) {
      assert.ok(onFloor(p), `on the floor: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`);
      if (p.mode === "chat") chats++;
    }
  }
  const moved = Object.entries(s.world.people).filter(([id, p]) => p.room !== start[id]).length;
  assert.gt(moved, 8, `${moved} people changed room`);
  assert.gt(chats, 0, "some people stopped to chat");
});

test("Sam walks where he taps, and never off the floor", () => {
  const s = setup();
  tapTo(s.world, 0.3, 0.2);   // tapped the wall: walks to the floor below it
  run(s, 5);
  assert.near(s.world.me.x, 0.3, 1e-9);
  assert.near(s.world.me.y, FLOOR.top, 1e-9);
});

test("Sam goes through a door into the next room", () => {
  const s = setup();
  tapTo(s.world, 0.99, 0.85);
  run(s, 6);
  assert.eq(s.world.me.room, "library");
  tapTo(s.world, 0.01, 0.85);
  run(s, 6);
  tapTo(s.world, 0.01, 0.85);
  run(s, 6);
  assert.eq(s.world.me.room, "kitchen");
  tapTo(s.world, 0.01, 0.85);   // no door left of the kitchen
  run(s, 6);
  assert.eq(s.world.me.room, "kitchen");
});

test("walking up to someone ends next to them", () => {
  const s = setup();
  const id = peopleIn(s.world, "hall", s.stillIn)[0];
  s.world.people[id].mode = "chat";
  s.world.people[id].timer = 99;   // stand still
  walkUpTo(s.world, id);
  run(s, 6);
  assert.ok(nextTo(s.world, id));
});

test("people who've left the game don't move", () => {
  const s = setup();
  const id = Object.keys(s.world.people)[0];
  const before = { ...s.world.people[id] };
  s.stillIn = s.stillIn.filter((x) => x !== id);
  run(s, 20);
  assert.eq(s.world.people[id].x, before.x);
});
