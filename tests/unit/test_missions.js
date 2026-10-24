// Missions: the day's mission, everyone's scores, the pot and the shield.
import { test, assert } from "../framework.js";
import { newGame } from "../../js/game.js";
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

test("there's a mission every day", () => {
  const g = castle(3);
  for (let day = 1; day <= 12; day++) {
    g.day = day;
    assert.ok(todaysMission(g).built);
  }
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
  const r = finishMission(g, 1, stillIn(g));
  assert.eq(r.scores.length, 22, "everyone still in plays");
  assert.eq(r.shield, r.scores[0][0], "best score wins it");
  assert.gt(r.won, 0);
  assert.eq(r.won % 500, 0, "rounded to £500");
  assert.eq(g.pot, r.won);
  g.day = 2;
  const r2 = finishMission(g, 0, stillIn(g));
  assert.eq(g.pot, r.won + r2.won, "the pot adds up");
  assert.ne(r2.shield, "dot", "a score of 0 doesn't win");
});

test("a perfect Sam wins the shield", () => {
  const g = castle(8);
  assert.eq(finishMission(g, 1.01, stillIn(g)).shield, "dot");
});

test("the Traitors can't murder whoever has the shield, and it lasts one night", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = castle(seed);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    g.history[0].quiet = true;   // skip night 1: straight on to a murder night
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    const top = murderIdeas(g)[0];
    g.shield = top;
    assert.notOk(murderIdeas(g).includes(top), "not on their list");
    const victim = night(g);
    assert.ne(victim, top, "the shield saved them");
    assert.ok(stillIn(g).includes(top));
    assert.eq(g.shield, null, "gone after the night");
  }
});

test("a Traitor Sam can't pick the shield holder either", () => {
  const g = castle(1);
  g.shield = stillIn(g).find((id) => !isTraitor(g, id));
  let threw = false;
  try { night(g, g.shield); } catch { threw = true; }
  // Only throws when Sam is the one picking; otherwise the computer avoids it.
  assert.ok(threw || g.players.find((p) => p.id === g.shield).inGame);
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
  assert.eq(r.scores.find(([id]) => id === "dot")[1], 2 / 3, "Sam's score: hits out of 3");
});

test("Catapults: hit the shield and nobody gets it", () => {
  const g = castle(6);
  const r = finishCatapults(g, ["shield", null, null], stillIn(g));
  assert.eq(r.shield, null);
  assert.eq(g.shield, null);
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
    const faithfulHit = r.hit.filter((id) => !isTraitor(g, id) && id !== g.shield && stillIn(g).includes(id));
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
  assert.eq(g.shield, "dot");
  g.day = 2;
  const r2 = finishCooking(g, cookingDiner(g, stillIn(g)), meal, (shieldTruck(g) + 1) % 3, stillIn(g));
  assert.notOk(r2.found);
  assert.eq(r2.shield, r2.scores[0][0], "otherwise the best player");
});
