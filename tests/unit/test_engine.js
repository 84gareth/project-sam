// The engine: every change is a decision, made the same way on every device.
import { test, assert } from "../framework.js";
import { newGame, DAYS } from "../../js/game.js";
import {
  arriveAtCastle, stillIn, isTraitor, winner, tableTalk, talkOptions, nightKind, murderIdeas, recruitIdeas, daggerIdeas,
} from "../../js/castle.js";
import { todaysMission } from "../../js/missions.js";
import { applyDecision, needed, daggerTonight } from "../../js/engine.js";

const HUMANS = ["dot", "puddle", "fizz"];
// A draw: the tied people speak, the others vote again, then chests.
function settle(g, r, all) {
  if (!r.tie) return r;
  applyDecision(g, "pleas", all(() => null));
  const again = applyDecision(g, "revote", all(() => r.tie[0]));
  return again.tie ? applyDecision(g, "chests", all(() => 0)) : again;
}
// Play a whole game with three real players, choosing simply and the same
// way each time; `viewer` is whose device it is.
function playAll(seed, viewer) {
  const g = arriveAtCastle(newGame(viewer, seed, HUMANS));
  const all = (fn) => Object.fromEntries(needed(g).map((id) => [id, fn(id)]));
  const log = [];
  while (!winner(g)) {
    if (g.day > DAYS) {
      const r = applyDecision(g, "final", all(() => ({ vote: "end", line: "End it!" })));
      log.push(["final", r.allEnd]);
      if (r.allEnd) break;
      log.push(["votes", settle(g, applyDecision(g, "votes", all((id) => stillIn(g).find((o) => o !== id))), all).banished]);
      continue;
    }
    if (g.day >= 2) {
      const m = todaysMission(g);
      log.push(["mission", applyDecision(g, "mission", all(() => ({ mission: m.id, score: 0.5, hits: [] }))).won]);
    }
    const talk = tableTalk(g);
    applyDecision(g, "says", all((id) => talkOptions({ ...g, playerId: id }, talk)[0]));
    const r = settle(g, applyDecision(g, "votes", all((id) => stillIn(g).find((o) => o !== id))), all);
    log.push(["votes", r.banished]);
    if (winner(g)) break;
    if (g.day > DAYS) continue;   // after day 12: the final, not a night
    const kind = nightKind(g);
    const n = applyDecision(g, "night", all((id) => (isTraitor(g, id)
      ? { choice: "recruit", pick: kind === "murder" ? murderIdeas(g)[0] : recruitIdeas(g)[0], dagger: daggerIdeas(g)[0] }
      : null)));
    log.push(["night", n.kind, n.victim ?? n.recruited ?? null]);
  }
  return { g, log };
}

test("two devices, same decisions: exactly the same game", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const a = playAll(seed, "dot"), b = playAll(seed, "puddle");
    assert.eq(a.log, b.log, `seed ${seed}`);
    assert.eq(a.g.history, b.g.history);
    assert.eq(a.g.players, b.g.players);
    assert.eq(winner(a.g), winner(b.g));
  }
});

test("only real players still in are asked", () => {
  const g = arriveAtCastle(newGame("dot", 4, HUMANS));
  assert.eq(needed(g), HUMANS);
  g.players.find((p) => p.id === "puddle").inGame = false;
  assert.eq(needed(g), ["dot", "fizz"]);
});

test("night picks: the real Traitors' most-picked choice wins", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const g = arriveAtCastle(newGame("dot", seed, HUMANS));
    const ts = HUMANS.filter((id) => isTraitor(g, id));
    if (ts.length < 2) continue;
    applyDecision(g, "votes", Object.fromEntries(HUMANS.map((id) => [id, stillIn(g).find((o) => !HUMANS.includes(o))])));
    if (nightKind(g) !== "recruit") continue;
    const [a, b] = recruitIdeas(g);
    const parts = Object.fromEntries(HUMANS.map((id) => [id, null]));
    parts[ts[0]] = { pick: b };
    parts[ts[1]] = { pick: b };
    const r = applyDecision(g, "night", parts);
    assert.eq(r.recruited, b, "both chose the same");
    return;
  }
  assert.ok(false, "no game with two real Traitors found");
});

test("the dagger comes out the night it gets down to 8", () => {
  const g = arriveAtCastle(newGame("dot", 2, HUMANS));
  for (const p of g.players.filter((x) => !HUMANS.includes(x.id) && !isTraitor(g, x.id)).slice(0, 13)) p.inGame = false;
  assert.eq(stillIn(g).length, 9);
  assert.ok(daggerTonight(g, true), "a murder tonight makes it 8");
  assert.notOk(daggerTonight(g, false));
});

test("not waiting for someone: their part is left out, the rest goes on", () => {
  const g = arriveAtCastle(newGame("dot", 6, HUMANS));
  g.day = DAYS + 1;
  const r = applyDecision(g, "final", { dot: { vote: "end", line: "End!" } });   // puddle and fizz didn't answer
  for (const [id, v] of r.votes) assert.ok(v === "end" || v === "banish", `${id}: ${v}`);
  assert.eq(r.votes.find(([id]) => id === "puddle")[1], "end", "a missing vote counts as end");
  const g2 = arriveAtCastle(newGame("dot", 6, HUMANS));
  const v = applyDecision(g2, "votes", { dot: "ruby" });
  assert.ok(v.banished || v.tie, "the vote still happens");
});

// ─── Rejoining ──────────────────────────────────────────────────────────────
import { resumePoint } from "../../js/net-engine.js";

test("rejoining: back at the right part of the day", () => {
  const day1 = ["go", "says", "votes", "go", "night", "go"];
  assert.eq(resumePoint([], false), "castle", "the very start");
  assert.eq(resumePoint(["go"], false), "talk");
  assert.eq(resumePoint(["go", "says"], false), "table");
  assert.eq(resumePoint(["go", "says", "votes"], false), "voted", "the screens check for a draw");
  assert.eq(resumePoint(["go", "says", "votes", "pleas"], false), "pleaded");
  assert.eq(resumePoint(["go", "says", "votes", "pleas", "revote"], false), "revoted");
  assert.eq(resumePoint(["go", "says", "votes", "pleas", "revote", "chests"], false), "reveal");
  assert.eq(resumePoint(["go", "says", "votes", "pleas", "revote", "go"], false), "night", "settled by the new vote");
  assert.eq(resumePoint(["go", "says", "votes", "pleas", "revote", "chests", "go", "night"], false), "breakfast");
  assert.eq(resumePoint(["go", "says", "votes", "go"], false), "night");
  assert.eq(resumePoint(["go", "says", "votes", "go", "night"], false), "breakfast");
  assert.eq(resumePoint(day1, false), "dayStart", "day 2 begins with its mission");
  assert.eq(resumePoint([...day1, "mission"], false), "castle");
  // After day 12's vote: the final.
  const twelveDays = [...day1];
  for (let d = 2; d <= 12; d++) twelveDays.push("mission", "go", "says", "votes", "go", "night", "go");
  twelveDays.length -= 2;   // day 12 ends at its vote's "go on"
  assert.eq(resumePoint(twelveDays, false), "final");
  assert.eq(resumePoint([...twelveDays, "final"], false), "table", "a red flame: vote again");
  assert.eq(resumePoint([...twelveDays, "final"], true), "ending");
});

import { readyToDecide, waitingFor, waitingLine } from "../../js/net-engine.js";
test("a player who's out isn't waited for (Gareth, 2026-10-29)", () => {
  const g = arriveAtCastle(newGame("dot", 4, HUMANS));
  const room = {
    play: { uids: { dot: "u1", puddle: "u2", fizz: "u3" } },
    seats: { u1: { act: { k: 5, t: "go" } }, u3: { act: { k: 5, t: "go" } } },
  };
  assert.eq(readyToDecide(g, room, 5), null, "puddle still in: wait");
  assert.eq(waitingFor(g, room, 5), ["puddle"]);
  g.players.find((p) => p.id === "puddle").inGame = false;
  assert.eq(readyToDecide(g, room, 5), { t: "go", parts: { dot: null, fizz: null } }, "puddle out: go on");
  assert.eq(waitingFor(g, room, 5), []);
});

test("the waiting sign names nobody at night: it would give the Traitors away", () => {
  assert.eq(waitingLine(["Olive Oddsocks", "Madame Mystic"], "votes"), "Waiting for Olive Oddsocks, Madame Mystic...");
  assert.eq(waitingLine(["Olive Oddsocks", "Madame Mystic"], "night"), "Waiting for the night to end...");
});

import { likeFirebase } from "../../js/net.js";
import { pack, unpack } from "../../js/net-engine.js";
test("Firebase drops empty places, so parts travel as text (the stuck Catapults)", () => {
  assert.eq(likeFirebase([null, "shield", null]), { 1: "shield" }, "what Firebase does to a list with gaps");
  assert.eq(likeFirebase({ a: null, b: [1, null, 3] }), { b: [1, null, 3] });
  const g = arriveAtCastle(newGame("dot", 4, HUMANS));
  g.day = 5;
  const hits = { dot: [null, "shield", null], puddle: [null, null, null], fizz: ["barry", null, null] };
  const room = { play: { uids: { dot: "u1", puddle: "u2", fizz: "u3" } }, seats: {} };
  for (const [id, h] of Object.entries(hits)) {
    room.seats[room.play.uids[id]] = likeFirebase({ act: { k: 9, t: "mission", data: pack({ mission: "catapults", score: 0, hits: h }) } });
  }
  const d = readyToDecide(g, room, 9);
  assert.eq(d.parts.dot.hits, [null, "shield", null], "the misses come back");
  const logged = likeFirebase({ t: d.t, parts: pack(d.parts) });
  const r = applyDecision(g, logged.t, unpack(logged.parts));
  assert.ok(r.broken, "dot hit the shield");
  assert.ok(r.hit.includes("barry"));
});
