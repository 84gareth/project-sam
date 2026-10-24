// Missions: the day's mission, everyone's scores, the pot and the shield.
import { test, assert } from "../framework.js";
import { newGame } from "../../js/game.js";
import { arriveAtCastle, stillIn, isTraitor, murderIdeas, night, roundTable, computerVote } from "../../js/castle.js";
import {
  MISSIONS, SKILLS, missionOrder, todaysMission, computerScore, finishMission,
  bellTune, BELL_ROUNDS, bellScore, pieRound, pieAfter, PIE_ROUNDS, pieScore,
} from "../../js/missions.js";
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
    g.recruited = "skip";   // straight to a murder night
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
