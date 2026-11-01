// The final after day 12 (Sam: "like the TV show") and the ending.
import { test, assert } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL, DAYS } from "../../js/game.js";
import {
  arriveAtCastle, roundTable, recruit, winner, stillIn, isTraitor, finalVote, finalRound, prizeShare,
  allTraitors, inFinal, suspectList,
} from "../../js/castle.js";
import { CHARACTERS } from "../../js/characters.js";

const castle = (seed, me = "dot") => arriveAtCastle(newGame(me, seed));
// A game at the final: day 12 done, a few people left.
function atFinal(seed, keepTraitors = 1) {
  const g = castle(seed);
  const traitors = g.players.filter((p) => p.side === TRAITOR).map((p) => p.id).filter((id) => id !== "dot");
  const faithful = g.players.filter((p) => p.side !== TRAITOR && p.id !== "dot").map((p) => p.id);
  const keep = ["dot", ...traitors.slice(0, keepTraitors), ...faithful.slice(0, 4)];
  for (const p of g.players) p.inGame = keep.includes(p.id);
  g.day = DAYS + 1;
  return g;
}

test("Traitors always vote to end the final", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = atFinal(seed);
    for (const id of stillIn(g).filter((x) => x !== "dot" && isTraitor(g, x))) assert.eq(finalVote(g, id), "end");
  }
});

test("a Faithful wants to banish again only if someone stands out", () => {
  const g = atFinal(4);
  const f = stillIn(g).find((id) => id !== "dot" && !isTraitor(g, id));
  for (const o of stillIn(g)) if (o !== f) g.scores[f][o] = 0.3;
  assert.eq(finalVote(g, f), "end", "nobody stands out");
  g.scores[f][stillIn(g).find((o) => o !== f)] = 1.2;
  assert.eq(finalVote(g, f), "banish", "one person stands out");
});

test("the final ends only when everyone says end; then the Traitors left win", () => {
  const g = atFinal(5);
  for (const id of stillIn(g)) if (g.scores[id] && !isTraitor(g, id)) for (const o of stillIn(g)) if (o !== id) g.scores[id][o] = 0.3;
  assert.ok(inFinal(g));
  assert.eq(winner(g), null);
  let r = finalRound(g, "banish");
  assert.notOk(r.allEnd, "Sam said banish");
  assert.eq(winner(g), null);
  r = finalRound(g, "end");
  assert.ok(r.allEnd);
  assert.eq(r.votes.length, stillIn(g).length);
  assert.notOk(inFinal(g));
  assert.eq(winner(g), TRAITOR);
});

test("with two left the final ends by itself", () => {
  const g = atFinal(6, 1);
  const keep = ["dot", stillIn(g).find((id) => id !== "dot")];
  for (const p of g.players) p.inGame = keep.includes(p.id);
  assert.ok(finalRound(g, "banish").allEnd);
});

test("the pot is shared by the winners still in", () => {
  const g = atFinal(7, 2);
  g.pot = 30000;
  g.ended = true;
  const share = prizeShare(g);
  assert.eq(share.side, TRAITOR);
  assert.eq(share.winners.sort(), stillIn(g).filter((id) => isTraitor(g, id)).sort());
  assert.eq(share.each, Math.floor(30000 / share.winners.length / 10) * 10);
  // All Traitors caught: the Faithfuls share it.
  for (const p of g.players) if (p.side === TRAITOR) p.inGame = false;
  const f = prizeShare(g);
  assert.eq(f.side, FAITHFUL);
  assert.eq(f.winners.length, stillIn(g).length);
});

test("every Traitor of the game is listed, recruits and the banished marked", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = castle(seed);
    const out = roundTable(g, stillIn(g).find((id) => id !== "dot"));
    const who = recruit(g);
    const list = allTraitors(g);
    assert.eq(list.length, 4, "three dealt, one recruited");
    assert.ok(list.find((t) => t.id === who).recruited);
    if (out.side === TRAITOR) assert.ok(list.find((t) => t.id === out.banished).banished);
    return;
  }
});

// ─── The fire pit: what everyone says ───────────────────────────────────────
import { finalLine, finalChoices } from "../../js/castle.js";

test("everyone says why they chose; a banish names who they suspect", () => {
  const g = atFinal(8, 2);
  const r = finalRound(g, "banish", "My own words!");
  assert.eq(r.votes.find(([id]) => id === "dot")[2], "My own words!", "Sam says what he picked");
  for (const [id, v, line] of r.votes) assert.gt(line.length, 10, `${id} says something`);
  const f = stillIn(g).find((id) => id !== "dot" && !isTraitor(g, id));
  const top = suspectList(g, f)[0];
  let named = 0;
  for (let day = 13; day < 30; day++) {
    g.day = day;
    if (finalLine(g, f, "banish").includes(CHARACTERS.find((c) => c.id === top).name)) named++;
  }
  assert.gt(named, 3, "banish lines often name their top suspect");
});

test("Sam gets two end lines and two banish lines, all different", () => {
  const c = finalChoices(atFinal(3));
  assert.eq(c.map((o) => o.vote), ["end", "end", "banish", "banish"]);
  assert.eq(new Set(c.map((o) => o.text)).size, 4);
});
