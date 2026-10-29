// The engine: every change is a decision, made the same way on every device.
import { test, assert } from "../framework.js";
import { newGame, DAYS } from "../../js/game.js";
import {
  arriveAtCastle, stillIn, isTraitor, winner, tableTalk, talkOptions, nightKind, murderIdeas, recruitIdeas, daggerIdeas,
} from "../../js/castle.js";
import { todaysMission } from "../../js/missions.js";
import { applyDecision, needed, daggerTonight } from "../../js/engine.js";

const HUMANS = ["dot", "puddle", "fizz"];
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
      log.push(["votes", applyDecision(g, "votes", all((id) => stillIn(g).find((o) => o !== id))).banished]);
      continue;
    }
    if (g.day >= 2) {
      const m = todaysMission(g);
      log.push(["mission", applyDecision(g, "mission", all(() => ({ mission: m.id, score: 0.5, hits: [] }))).won]);
    }
    const talk = tableTalk(g);
    applyDecision(g, "says", all((id) => talkOptions({ ...g, playerId: id }, talk)[0]));
    const r = applyDecision(g, "votes", all((id) => stillIn(g).find((o) => o !== id)));
    log.push(["votes", r.banished]);
    if (winner(g)) break;
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
