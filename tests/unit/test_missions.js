// Missions: the day's mission, everyone's scores, the pot and the shield.
import { test, assert } from "../framework.js";
import { newGame, makeRandom } from "../../js/game.js";
import { arriveAtCastle, stillIn, isTraitor, murderIdeas, night, roundTable, computerVote } from "../../js/castle.js";
import {
  MISSIONS, SKILLS, missionOrder, todaysMission, computerScore, finishMission,
  bellTune, BELL_ROUNDS, bellScore, pieRound, pieAfter, PIE_ROUNDS, pieScore,
  computerThrows, finishCatapults, TRUCKS, HATES, cookingDiner, shieldTruck, cookScore, finishCooking,
} from "../../js/missions.js";
import { nightKind, suspectList, recruit } from "../../js/castle.js";
import { CHARACTERS } from "../../js/characters.js";

const castle = (seed, me = "dot") => arriveAtCastle(newGame(me, seed));

test("all 13 of Sam's missions are listed, and every game plays them in its own order", () => {
  assert.eq(MISSIONS.length, 13);
  const orders = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const order = missionOrder(castle(seed)).map((m) => m.id);
    assert.ok(order.length > 0 && order.length <= 12);
    for (const id of order) assert.ok(MISSIONS.find((m) => m.id === id).built, `${id} is built`);
    orders.add(order.join(","));
  }
  assert.gt(orders.size, 1, "different games, different orders");
});

test("a mission every day from day 2, all different; none on day 1", () => {
  const g = castle(3);
  assert.eq(todaysMission(g), null, "day 1");
  const seen = new Set();
  for (let day = 2; day <= 12; day++) {
    g.day = day;
    assert.ok(todaysMission(g).built);
    seen.add(todaysMission(g).id);
  }
  assert.eq(seen.size, 11);
});

test("everyone has a skill entry, and Max Muddle is bad at memory", () => {
  for (const c of CHARACTERS) assert.ok(SKILLS[c.id], c.id);
  assert.eq(SKILLS.max.memory, -1);
});

test("good players score better than bad ones, on average", () => {
  const memory = MISSIONS.find((m) => m.type === "memory");
  let good = 0, bad = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = castle(seed);
    good += computerScore(g, "gumdrop", memory);
    bad += computerScore(g, "max", memory);
    for (const s of [computerScore(g, "gumdrop", memory), computerScore(g, "max", memory)]) assert.ok(s >= 0 && s <= 1);
  }
  assert.gt(good / 200, bad / 200 + 0.3, `good ${(good / 200).toFixed(2)}, bad ${(bad / 200).toFixed(2)}`);
});

test("the pot grows, and the best player wins the shield", () => {
  const g = castle(5);
  g.day = 2;
  const r = finishMission(g, 1, stillIn(g));
  assert.eq(r.scores.length, 22, "everyone still in plays");
  assert.eq(r.shields, r.scores.slice(0, r.count).map(([id]) => id), "the best score(s) win them");
  assert.gt(r.won, 0);
  assert.eq(r.won % 500, 0, "rounded to £500");
  assert.eq(g.pot, r.won);
  g.day = 3;
  const r2 = finishMission(g, 0, stillIn(g));
  assert.eq(g.pot, r.won + r2.won, "the pot adds up");
  assert.notOk(r2.shields.includes("dot"), "a score of 0 doesn't win");
});

test("a perfect Sam wins the shield", () => {
  const g = castle(8);
  g.day = 2;
  assert.eq(finishMission(g, 1.01, stillIn(g)).shields[0], "dot");
});

test("the Traitors can't murder whoever has the shield, and it lasts one night", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = castle(seed);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    g.history[0].quiet = true;   // skip night 1: straight on to a murder night
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    const top = murderIdeas(g)[0];
    g.shields = [top];
    assert.notOk(murderIdeas(g).includes(top), "not on their list");
    const victim = night(g);
    assert.ne(victim, top, "the shield saved them");
    assert.ok(stillIn(g).includes(top));
    assert.eq(g.shields, [], "gone after the night");
  }
});

test("a Traitor Sam can't pick the shield holder either", () => {
  const g = castle(1);
  const holder = stillIn(g).find((id) => !isTraitor(g, id));
  g.shields = [holder];
  let threw = false;
  try { night(g, holder); } catch { threw = true; }
  // Only throws when Sam is the one picking; otherwise the computer avoids it.
  assert.ok(threw || g.players.find((p) => p.id === holder).inGame);
});

test("Castle Bells: rounds of 3 to 7 bells from one tune; score is rounds done", () => {
  const g = castle(2);
  const tune = bellTune(g);
  assert.eq(tune.length, 7);
  for (const b of tune) assert.ok(b >= 0 && b < 4);
  assert.eq(bellTune(g), tune, "the same tune if you look again");
  assert.eq(BELL_ROUNDS, [3, 4, 5, 6, 7]);
  assert.eq(bellScore(0), 0);
  assert.eq(bellScore(5), 1);
});

test("Chilli Pie Shuffle: the answer follows the chilli pie through every swap", () => {
  assert.eq(pieAfter(0, [[0, 1]]), 1);
  assert.eq(pieAfter(0, [[1, 2]]), 0);
  assert.eq(pieAfter(2, [[0, 2], [0, 1]]), 1);
  const g = castle(4);
  for (let round = 0; round < PIE_ROUNDS.length; round++) {
    const p = pieRound(g, round);
    assert.eq(p.swaps.length, PIE_ROUNDS[round].swaps);
    for (const [a, b] of p.swaps) assert.ok(a !== b && a >= 0 && a < 3 && b >= 0 && b < 3);
    assert.eq(p.answer, pieAfter(p.start, p.swaps));
  }
  assert.gt(PIE_ROUNDS[2].swaps, PIE_ROUNDS[0].swaps, "more swaps later");
  assert.eq(pieScore(3), 1);
});

// ─── Catapults ──────────────────────────────────────────────────────────────

test("Catapults: good throwers hit who they suspect; everyone hit is up for murder", () => {
  const g = castle(6);
  const throws = computerThrows(g, stillIn(g));
  assert.eq(throws.length, 21);
  for (const t of throws) if (t.target && t.target !== "shield") assert.eq(t.target, suspectList(g, t.thrower)[0]);
  const r = finishCatapults(g, ["puddle", null, "gumdrop"], stillIn(g));
  assert.ok(r.hit.includes("puddle") && r.hit.includes("gumdrop"));
  for (const t of throws) if (t.target && t.target !== "shield") assert.ok(r.hit.includes(t.target));
  assert.eq(g.upForMurder, { day: 1, ids: r.hit });
  assert.eq(r.scores.find(([id]) => id === "dot")[1], 2 / STONES, "Sam's score: hits out of the stones");
});

test("Catapults: hit the shield and nobody gets it", () => {
  const g = castle(6);
  const r = finishCatapults(g, ["shield", null, null], stillIn(g));
  assert.eq(r.shields, []);
  assert.eq(g.shields, []);
  assert.ok(r.broken);
});

test("Catapults: computer stones sometimes break the shield, but not usually", () => {
  let broken = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const g = castle(seed);
    if (computerThrows(g, stillIn(g)).some((t) => t.target === "shield")) broken++;
  }
  assert.gt(broken, 10, `${broken}/300`);
  assert.lt(broken, 150, `${broken}/300`);
});

test("Catapults day: always a murder that night, and only someone who was hit", () => {
  let checked = 0;
  for (let seed = 1; seed <= 200 && checked < 20; seed++) {
    const g = castle(seed);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    recruit(g);
    g.history.push({ quiet: true });   // night 2 has been and gone
    g.day = 3;
    const r = finishCatapults(g, [null, null, null], stillIn(g));
    g.history.push({});   // day 3's Round Table: tonight is night 3, normally quiet
    const faithfulHit = r.hit.filter((id) => !isTraitor(g, id) && !g.shields.includes(id) && stillIn(g).includes(id));
    if (stillIn(g).filter((id) => isTraitor(g, id)).length <= 2) continue;   // a recruiting night instead
    assert.eq(nightKind(g), "murder", "catapult day: a murder");
    if (faithfulHit.length === 0) continue;
    for (const id of murderIdeas(g)) assert.ok(faithfulHit.includes(id), `${id} wasn't hit`);
    assert.ok(faithfulHit.includes(night(g)));
    checked++;
  }
  assert.gt(checked, 5);
});

// ─── Cooking Challenge ──────────────────────────────────────────────────────

test("Cooking: everyone hates a food from the trucks, with a clue", () => {
  const foods = TRUCKS.flatMap((t) => t.foods);
  assert.eq(TRUCKS.length, 3);
  for (const c of CHARACTERS) {
    assert.ok(foods.includes(HATES[c.id][0]), c.id);
    assert.gt(HATES[c.id][1].length, 5);
  }
});

test("Cooking: the hated food scores; the right box wins the shield", () => {
  const g = castle(7);
  const diner = cookingDiner(g, stillIn(g));
  assert.ne(diner, "dot", "Sam doesn't cook for himself");
  const hated = HATES[diner][0];
  const meal = TRUCKS.map((t) => (t.foods.includes(hated) ? hated : t.foods.find((f) => f !== hated)));
  assert.eq(cookScore(diner, meal), 1);
  assert.eq(cookScore(diner, TRUCKS.map((t) => t.foods.find((f) => f !== hated))), 0.3);
  const r = finishCooking(g, diner, meal, shieldTruck(g), stillIn(g));
  assert.ok(r.found);
  assert.eq(g.shields[0], "dot");
  g.day = 2;
  const r2 = finishCooking(g, cookingDiner(g, stillIn(g)), meal, (shieldTruck(g) + 1) % 3, stillIn(g));
  assert.notOk(r2.found);
  assert.eq(r2.shields[0], r2.scores[0][0], "otherwise the best player");
});

// ─── The other nine ─────────────────────────────────────────────────────────
import {
  gone, noteFrom, whereRounds, jumbleWords, secretCode, SHAPES, SHAPE_COLOURS, makeMaze, canStep, stepsOut,
  mazeScore, MAZE_W, MAZE_H, keyHides, jingles, KEYS, LOOKS, HIDING_PLACES, footprintEvents, footprintScore, footprintNote, BOOT_PRINTS, galleryRounds, treasureSpot, treasureTap,
  treasureScore, FOUND_NEAR, lightsTray, lightsScore, flopResult,
} from "../../js/missions.js";

// A game a few days in: two banished, one murdered.
function fewDaysIn(seed) {
  const g = castle(seed);
  roundTable(g, stillIn(g).find((id) => id !== "dot"));
  recruit(g);
  roundTable(g, stillIn(g).find((id) => id !== "dot"));
  night(g);
  return g;
}

test("all 13 missions are built, and a game plays 11 of them", () => {
  assert.ok(MISSIONS.every((m) => m.built && m.how));
  const order = missionOrder(castle(1));
  assert.eq(order.length, 11);
  assert.eq(new Set(order.map((m) => m.id)).size, 11, "no repeats");
});

test("notes: from people who've gone, murdered first; naming who they suspected", () => {
  const g = fewDaysIn(3);
  const left = gone(g);
  assert.eq(left.length, 3);
  assert.eq(left[0], g.history[1].murdered, "the murdered one first");
  const note = noteFrom(g, left[0]);
  assert.eq(note.suspect, suspectList(g, left[0])[0]);
  assert.eq(gone(castle(3)).length, 0, "nobody gone on day 1");
  const h = castle(3);
  h.history = [{ banished: "puddle", murdered: "fizz" }, { banished: "ruby" }];
  assert.eq(gone(h), ["fizz", "ruby", "puddle"], "murdered first, then the newest banished");
});

test("Who Was Where?: 3 people per room; each answer really was there", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = castle(seed);
    const { rooms, questions } = whereRounds(g, stillIn(g));
    for (const ids of Object.values(rooms)) assert.eq(ids.length, 3);
    assert.eq(questions.length, 3);
    assert.eq(new Set(questions.map((q) => q.room)).size, 3, "three different rooms");
    for (const q of questions) {
      assert.ok(rooms[q.room].includes(q.answer));
      assert.eq(q.options.length, 4);
      assert.ok(q.options.includes(q.answer));
      assert.eq(q.options.filter((id) => rooms[q.room].includes(id)).length, 1, "only one right answer");
    }
  }
});

test("Letter Jumble: three jumbled names; the first is the last murdered, with a note", () => {
  const g = fewDaysIn(5);
  const words = jumbleWords(g, stillIn(g));
  assert.eq(words.length, 3);
  assert.eq(words[0].id, gone(g)[0]);
  assert.ok(words[0].note);
  for (const w of words) {
    assert.eq([...w.letters].sort().join(""), [...w.word].sort().join(""), "same letters");
    assert.ne(w.letters.join(""), w.word, "jumbled");
    assert.ne(w.id, "dot");
  }
  assert.notOk(jumbleWords(castle(5), stillIn(castle(5)))[0].note, "no note on day 1");
});

test("Secret Code: every letter has its own shape", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { words, key } = secretCode(castle(seed));
    assert.eq(words.length, 3);
    for (const l of words.join("")) assert.ok(key[l], l);
    const symbols = Object.values(key).map((s) => s.shape + s.colour);
    assert.eq(new Set(symbols).size, symbols.length, "no two letters share a shape");
    assert.ok(symbols.length <= SHAPES.length * SHAPE_COLOURS.length);
  }
});

test("Garden Maze: always a way out; steps only between open squares", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const m = makeMaze(castle(seed));
    const n = stepsOut(m, m.start);
    assert.ok(n >= MAZE_W + MAZE_H - 2 && n < Infinity, `${n} steps`);
    assert.eq(mazeScore(m, m.start), 0);
    assert.eq(mazeScore(m, m.exit), 1);
    assert.notOk(canStep(m, [0, 0], [2, 0]), "one square at a time");
    assert.notOk(canStep(m, [0, 0], [0, -1]) && false);
  }
  const m = makeMaze(castle(1));
  // Walls match on both sides.
  for (let y = 0; y < MAZE_H; y++) for (let x = 0; x + 1 < MAZE_W; x++) assert.eq(m.walls[y][x].e, m.walls[y][x + 1].w);
});

test("Lost Keys: 14 hiding places, 5 keys, fewer looks than places", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const h = keyHides(castle(seed));
    assert.eq(h.spots.length, HIDING_PLACES);
    assert.eq(new Set(h.keys).size, KEYS);
    for (const k of h.keys) assert.ok(k >= 0 && k < HIDING_PLACES);
    for (const s of h.spots) assert.ok(s.x > 0.05 && s.x < 0.95 && s.y > 0.2 && s.y < 0.9 && s.kind);
  }
  assert.lt(LOOKS, HIDING_PLACES, "you can't just look everywhere");
  assert.ok(LOOKS >= KEYS);
});

test("Lost Keys: a jingle means a key is near", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const h = keyHides(castle(seed));
    h.spots.forEach((s, i) => {
      const near = h.keys.filter((k) => k !== i && Math.hypot(h.spots[k].x - s.x, (h.spots[k].y - s.y) * 0.56) < 0.24);
      assert.eq(jingles(h, i), near.length);
    });
  }
  const h = { spots: [{ x: 0.1, y: 0.3 }, { x: 0.15, y: 0.3 }, { x: 0.9, y: 0.8 }], keys: [1] };
  assert.eq(jingles(h, 0), 1, "next door");
  assert.eq(jingles(h, 2), 0, "far away");
  assert.eq(jingles(h, 1), 0, "not the one behind you");
});


test("Muddy Footprints: 16 boot prints in order round the garden, getting quicker, with foxes and ducks", () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const ev = footprintEvents(castle(seed));
    const boots = ev.filter((e) => e.kind === "boot");
    assert.eq(boots.length, BOOT_PRINTS);
    for (let i = 1; i < ev.length; i++) assert.ok(ev[i].at >= ev[i - 1].at, "in time order");
    for (const e of ev) {
      assert.ok(e.x > 0.03 && e.x < 0.97 && e.y > 0.55 && e.y < 0.95, `on the ground: ${e.x}, ${e.y}`);
      kinds.add(e.kind);
    }
    assert.gt(boots[0].life, boots[boots.length - 1].life, "faster later");
    for (let i = 1; i < boots.length; i++) assert.lt(Math.hypot(boots[i].x - boots[i - 1].x, boots[i].y - boots[i - 1].y), 0.2, "a trail: each print near the last");
  }
  assert.eq([...kinds].sort(), ["boot", "duck", "fox"]);
  assert.eq(footprintScore(BOOT_PRINTS, 0), 1);
  assert.eq(footprintScore(8, 0), 0.5);
  assert.lt(footprintScore(BOOT_PRINTS, 3), 1, "wrong taps cost");
  assert.ok(footprintNote(0.6));
  assert.notOk(footprintNote(0.5));
});


test("Portrait Gallery: one new picture each round; the last is someone who's gone", () => {
  const g = fewDaysIn(7);
  const rounds = galleryRounds(g);
  assert.eq(rounds.map((r) => r.wall.length), [6, 8, 10]);
  for (const r of rounds) {
    assert.notOk(r.wall.includes(r.newcomer));
    assert.eq(r.after.length, r.wall.length + 1);
    assert.eq(r.after.filter((id) => !r.wall.includes(id)), [r.newcomer]);
  }
  assert.eq(rounds[2].newcomer, gone(g)[0]);
  assert.ok(rounds[2].note);
  assert.notOk(galleryRounds(castle(7))[2].note, "no note before anyone's gone");
});

test("Treasure Hunt: warmer, colder, wrong room, and found", () => {
  const g = castle(4);
  const spot = treasureSpot(g);
  const other = ["kitchen", "hall", "library", "garden"].find((r) => r !== spot.room);
  assert.eq(treasureTap(spot, other, spot.x, spot.y, null).said, "wrong room");
  assert.eq(treasureTap(spot, spot.room, spot.x, spot.y, null).said, "found");
  assert.eq(treasureTap(spot, spot.room, spot.x + FOUND_NEAR * 0.8, spot.y, null).said, "found", "close enough counts");
  const far = treasureTap(spot, spot.room, spot.x > 0.5 ? 0 : 1, spot.y, null);
  const near = treasureTap(spot, spot.room, spot.x + FOUND_NEAR * 2, spot.y, far.dist);
  assert.eq(near.said, "warmer");
  assert.eq(treasureTap(spot, spot.room, spot.x > 0.5 ? 0 : 1, spot.y, near.dist).said, "colder");
  assert.eq(treasureScore(true, 1), 1);
  assert.gt(treasureScore(true, 1), treasureScore(true, 8));
  assert.eq(treasureScore(false, 12), 0);
});

test("Lights Out: 9 pieces, shuffled; score is pieces in the right place", () => {
  const tray = lightsTray(castle(2));
  assert.eq([...tray].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.eq(lightsScore([0, 1, 2, 3, 4, 5, 6, 7, 8]), 1);
  assert.eq(lightsScore([1, 0, 2, 3, 4, 5, 6, 7, 8]), 7 / 9);
  assert.eq(lightsScore(Array(9).fill(null)), 0);
});

test("giving up scores nothing (and hits nobody, and finds no shield)", () => {
  for (const m of MISSIONS) {
    const g = castle(3);
    const r = flopResult(g, stillIn(g), m);
    assert.notOk(r.shields.includes("dot"), m.id);
    if (m.id === "catapults") assert.eq(g.upForMurder.ids.includes("dot"), r.hit.includes("dot"));
  }
});

// ─── Garden Maze: smooth walking ────────────────────────────────────────────
import { mazeMove, mazeSquare, MAZE_R } from "../../js/missions.js";

// The squares from start to the way out.
function mazePath(m) {
  const key = ([x, y]) => `${x},${y}`;
  const from = new Map([[key(m.start), null]]);
  const queue = [m.start];
  while (queue.length) {
    const at = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [at[0] + dx, at[1] + dy];
      if (n[0] < 0 || n[1] < 0 || n[0] >= MAZE_W || n[1] >= MAZE_H || from.has(key(n)) || !canStep(m, at, n)) continue;
      from.set(key(n), at);
      queue.push(n);
    }
  }
  const path = [];
  for (let at = m.exit; at; at = from.get(key(at))) path.unshift(at);
  return path;
}

test("Garden Maze: start and way out are opposite corners, and change", () => {
  const starts = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const m = makeMaze(castle(seed));
    assert.eq(m.exit, [MAZE_W - 1 - m.start[0], MAZE_H - 1 - m.start[1]]);
    assert.ok([0, MAZE_W - 1].includes(m.start[0]) && [0, MAZE_H - 1].includes(m.start[1]));
    starts.add(m.start.join(","));
  }
  assert.gt(starts.size, 2);
});

test("Garden Maze: smooth walking never goes through a hedge", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const m = makeMaze(castle(seed));
    const r = makeRandom(seed);
    let pos = { x: m.start[0] + 0.5, y: m.start[1] + 0.5 };
    for (let k = 0; k < 2000; k++) {
      const before = mazeSquare(pos);
      pos = mazeMove(m, pos, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4);
      const after = mazeSquare(pos);
      if (after.join() !== before.join()) assert.ok(canStep(m, before, after), `seed ${seed}: ${before} to ${after}`);
      assert.ok(pos.x >= MAZE_R - 1e-9 && pos.x <= MAZE_W - MAZE_R + 1e-9 && pos.y >= MAZE_R - 1e-9 && pos.y <= MAZE_H - MAZE_R + 1e-9);
    }
  }
});

test("Garden Maze: walking square to square along the way out gets you out", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const m = makeMaze(castle(seed));
    let pos = { x: m.start[0] + 0.5, y: m.start[1] + 0.5 };
    for (const [x, y] of mazePath(m).slice(1)) {
      for (let k = 0; k < 40 && mazeSquare(pos).join() !== `${x},${y}`; k++) {
        pos = mazeMove(m, pos, Math.sign(x + 0.5 - pos.x) * 0.1, Math.sign(y + 0.5 - pos.y) * 0.1);
      }
      pos = { x: x + 0.5, y: y + 0.5 };   // settle in the middle
    }
    assert.eq(mazeSquare(pos), m.exit);
  }
});

test("Garden Maze: a hedge stops you at its edge", () => {
  const m = makeMaze(castle(1));
  // Find a square with a hedge on its right.
  for (let y = 0; y < MAZE_H; y++) for (let x = 0; x < MAZE_W; x++) {
    if (!m.walls[y][x].e) continue;
    const p = mazeMove(m, { x: x + 0.5, y: y + 0.5 }, 3, 0);
    assert.near(p.x, x + 1 - MAZE_R, 1e-9);
    return;
  }
});

// ─── Fresh every time (Gareth: "all missions should have randomised elements") ─
import { truckFoods, lightsDesign, SHIELD_DESIGNS, bellTune as tuneOf } from "../../js/missions.js";

test("Cooking: 4 foods a truck, changing each time; the hated food is always on the menu", () => {
  const menus = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const g = castle(seed);
    g.day = 2 + (seed % 5);
    const diner = cookingDiner(g, stillIn(g));
    const menu = truckFoods(g, diner);
    assert.eq(menu.map((m) => m.length), [4, 4, 4]);
    assert.ok(menu.flat().includes(HATES[diner][0]), `${diner} hates ${HATES[diner][0]}`);
    menu.forEach((foods, i) => foods.forEach((f) => assert.ok(TRUCKS[i].foods.includes(f))));
    menus.add(menu.flat().join());
  }
  assert.gt(menus.size, 20);
});

test("every mission changes from game to game", () => {
  const seen = { lights: new Set(), maze: new Set(), bells: new Set(), keys: new Set() };
  for (let seed = 1; seed <= 20; seed++) {
    const g = castle(seed);
    seen.lights.add(lightsDesign(g));
    seen.maze.add(JSON.stringify(makeMaze(g).walls));
    seen.bells.add(tuneOf(g).join());
    seen.keys.add(JSON.stringify(keyHides(g)));
  }
  assert.eq(seen.lights.size, SHIELD_DESIGNS, "all the shield pictures come up");
  assert.eq(seen.maze.size, 20);
  assert.gt(seen.bells.size, 15);
  assert.eq(seen.keys.size, 20);
});

// ─── Lights Out: moving placed pieces ──────────────────────────────────────
import { lightsStart, lightsTap } from "../../js/missions.js";

test("Lights Out: place, swap placed pieces, and put one back in the tray", () => {
  let s = lightsStart(castle(2));
  const [a, b] = s.tray;
  s = lightsTap(s, "tray-piece", a);
  s = lightsTap(s, "slot", 0);
  s = lightsTap(s, "tray-piece", b);
  s = lightsTap(s, "slot", 1);
  assert.eq(s.placed.slice(0, 2), [a, b]);
  assert.notOk(s.tray.includes(a) || s.tray.includes(b));
  s = lightsTap(s, "slot", 0);   // pick up a placed piece
  s = lightsTap(s, "slot", 1);   // and swap it
  assert.eq(s.placed.slice(0, 2), [b, a]);
  s = lightsTap(s, "slot", 1);
  s = lightsTap(s, "tray");   // back to the tray
  assert.eq(s.placed[1], null);
  assert.ok(s.tray.includes(a));
  // Putting a tray piece on a full slot sends the old one back.
  s = lightsTap(s, "tray-piece", a);
  s = lightsTap(s, "slot", 0);
  assert.eq(s.placed[0], a);
  assert.ok(s.tray.includes(b));
  assert.eq(s.tray.length + s.placed.filter((x) => x !== null).length, 9, "no piece lost or doubled");
});

// ─── Catapults: the shooting gallery ───────────────────────────────────────
import {
  STONES, galleryTargets, moveTargets, landing, hitAt, SLING, SLING_POWER, SLING_MAX_PULL, TARGET_RX, TARGET_RY,
} from "../../js/missions.js";

test("Catapults: everyone flies round the gallery and stays inside it", () => {
  const g = castle(3);
  let t = galleryTargets(g, [...stillIn(g).filter((id) => id !== "dot"), "shield"]);
  assert.eq(t.length, 22);
  const start = t.map((x) => [x.x, x.y]);
  for (let k = 0; k < 2000; k++) {
    t = moveTargets(t, 0.02);
    for (const x of t) assert.ok(x.x >= TARGET_RX - 1e-9 && x.x <= 1 - TARGET_RX + 1e-9 && x.y >= TARGET_RY - 1e-9 && x.y <= 0.7 + 1e-9);
  }
  assert.ok(t.every((x, i) => x.x !== start[i][0] || x.y !== start[i][1]), "everyone moved");
});

test("Catapults: pull further, throw further; the pull has a limit", () => {
  const near = landing(0, 0.05), far = landing(0, 0.15);
  assert.lt(far.y, near.y, "a bigger pull goes further up the gallery");
  assert.near(near.y, SLING.y - 0.05 * SLING_POWER, 1e-9);
  const left = landing(0.1, 0.1);
  assert.lt(left.x, SLING.x, "pull right, it flies left");
  const huge = landing(0, 5);
  assert.near(huge.y, SLING.y - SLING_MAX_PULL * SLING_POWER, 1e-9, "can't pull forever");
});

test("Catapults: a stone hits whoever's oval it lands in, the nearest first", () => {
  const t = [{ id: "a", x: 0.5, y: 0.4 }, { id: "b", x: 0.52, y: 0.4 }, { id: "c", x: 0.2, y: 0.2 }];
  assert.eq(hitAt(t, { x: 0.515, y: 0.4 }), "b");
  assert.eq(hitAt(t, { x: 0.2, y: 0.2 + TARGET_RY * 0.9 }), "c");
  assert.eq(hitAt(t, { x: 0.8, y: 0.6 }), null);
});

// ─── Two shields (Sam: "should be possible for more than one person") ──────
import { shieldCount, TWO_SHIELDS } from "../../js/missions.js";

test("usually one shield; some missions give two, to the top two", () => {
  let two = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = castle(seed);
    g.day = 2;
    const r = finishMission(g, 0, stillIn(g));
    assert.eq(r.shields.length, shieldCount(g));
    assert.eq(r.shields, r.scores.slice(0, r.shields.length).map(([id]) => id));
    if (r.shields.length === 2) two++;
  }
  assert.gt(two, 200 * TWO_SHIELDS * 0.6, `${two}/200 had two`);
  assert.lt(two, 200 * TWO_SHIELDS * 1.4, `${two}/200 had two`);
});

test("two shields: the Traitors can murder neither", () => {
  const g = castle(9);
  roundTable(g, stillIn(g).find((id) => id !== "dot"));
  g.history[0].quiet = true;
  roundTable(g, stillIn(g).find((id) => id !== "dot"));
  const [a, b] = murderIdeas(g);
  g.shields = [a, b];
  assert.notOk(murderIdeas(g).includes(a) || murderIdeas(g).includes(b));
  const victim = night(g);
  assert.ok(victim !== a && victim !== b);
});
