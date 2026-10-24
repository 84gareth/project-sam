// The castle rules: suspect lists, what people say, the Round Table, and
// whether the Traitors are hard enough to catch (balance, measured).
import { test, assert } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL } from "../../js/game.js";
import {
  arriveAtCastle, suspectList, answer, promisedVote, computerVote,
  traitorTarget, roundTable, winner, stillIn, isTraitor, QUESTIONS, LIST_LENGTH,
} from "../../js/castle.js";

const castle = (seed, me = "dot") => arriveAtCastle(newGame(me, seed));
const traitorsOf = (g) => g.players.filter((p) => p.side === TRAITOR).map((p) => p.id);
const computers = (g) => stillIn(g).filter((id) => id !== g.playerId);

test("everyone but Sam has a suspect list of everyone else", () => {
  const g = castle(1);
  for (const id of computers(g)) {
    const list = suspectList(g, id);
    assert.eq(list.length, 21, id);
    assert.notOk(list.includes(id), `${id} doesn't suspect themselves`);
  }
});

test("Traitors' lists point at Faithfuls, not at each other", () => {
  let fellowOnTop = 0, checks = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const g = castle(seed);
    for (const t of traitorsOf(g)) {
      if (t === g.playerId) continue;
      checks++;
      if (suspectList(g, t).slice(0, LIST_LENGTH).some((o) => isTraitor(g, o))) fellowOnTop++;
    }
  }
  assert.lt(fellowOnTop / checks, 0.1, `${fellowOnTop} of ${checks} Traitor lists show a fellow Traitor`);
});

test("asking the same thing twice gets the same answer", () => {
  const g = castle(5);
  for (const id of computers(g).slice(0, 6)) {
    for (const q of QUESTIONS) assert.eq(answer(g, id, q.id), answer(g, id, q.id), `${id} ${q.id}`);
  }
});

test("every question gets an answer that names real people", () => {
  const g = castle(9);
  const ids = new Set(g.players.map((p) => p.id));
  for (const id of computers(g)) {
    for (const q of QUESTIONS) {
      const a = answer(g, id, q.id);
      assert.gt(a.text.length, 0);
      for (const n of a.names) assert.ok(ids.has(n), `${id} ${q.id} named ${n}`);
    }
    assert.eq(answer(g, id, "list").names.length, LIST_LENGTH);
  }
});

test("everyone says they're not a Traitor", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = castle(seed);
    for (const id of computers(g)) assert.ok(/^(No|Me\? No)/.test(answer(g, id, "traitor").text), id);
  }
});

test("Faithfuls are honest: they vote how they said, for the top of their list", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = castle(seed);
    for (const id of computers(g).filter((id) => !isTraitor(g, id))) {
      const top = suspectList(g, id)[0];
      assert.eq(promisedVote(g, id), top);
      assert.eq(computerVote(g, id), top);
      assert.eq(answer(g, id, "suspect").names[0], top);
    }
  }
});

test("Traitors sometimes fib: say one name, vote for another", () => {
  let fibs = 0, total = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = castle(seed);
    for (const t of traitorsOf(g).filter((id) => id !== g.playerId)) {
      total++;
      if (promisedVote(g, t) !== computerVote(g, t)) fibs++;
    }
  }
  assert.gt(fibs / total, 0.2, `${fibs} fibs in ${total}`);
  assert.lt(fibs / total, 0.8, `${fibs} fibs in ${total}`);
});

test("Traitors blame others more than Faithfuls do", () => {
  let tBlame = 0, tN = 0, fBlame = 0, fN = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const g = castle(seed);
    for (const id of computers(g)) {
      const blamed = answer(g, id, "traitor").names.length > 0;
      if (isTraitor(g, id)) { tN++; if (blamed) tBlame++; } else { fN++; if (blamed) fBlame++; }
    }
  }
  assert.gt(tBlame / tN, fBlame / fN + 0.2, `Traitors ${tBlame}/${tN}, Faithfuls ${fBlame}/${fN}`);
});

test("the Traitors' target is always a Faithful still in the game", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = castle(seed);
    const t = traitorTarget(g);
    assert.notOk(isTraitor(g, t));
    assert.ok(stillIn(g).includes(t));
  }
});

test("the Round Table: everyone votes, the most votes leaves, a new day starts", () => {
  const g = castle(3);
  const r = roundTable(g, "pepper");
  assert.eq(r.votes.length, 22, "22 votes");
  assert.eq(r.votes.find(([v]) => v === "dot")[1], "pepper", "Sam's vote counted");
  const top = Math.max(...Object.values(r.counts));
  assert.eq(r.counts[r.banished], top, "the banished had the most votes");
  assert.notOk(stillIn(g).includes(r.banished), "and has left");
  assert.eq(r.side, isTraitor(g, r.banished) ? TRAITOR : FAITHFUL);
  assert.eq(g.day, 2);
  assert.eq(stillIn(g).length, 21);
});

test("nobody votes for someone who has left", () => {
  const g = castle(4);
  const first = roundTable(g, "pepper").banished;
  const second = roundTable(g, stillIn(g).find((id) => id !== "dot"));
  assert.notOk(second.votes.some(([, t]) => t === first));
});

test("the game is won when every Traitor is caught", () => {
  const g = castle(2);
  for (const t of traitorsOf(g)) g.players.find((p) => p.id === t).inGame = false;
  assert.eq(winner(g), FAITHFUL);
  assert.eq(winner(castle(2)), null);
});

// ─── Balance: hundreds of games with the computer playing Sam too ───────────

function simulate(n) {
  let day1T = 0, laterT = 0, laterN = 0;
  const daysToWin = [];
  for (let seed = 1; seed <= n; seed++) {
    const g = arriveAtCastle(newGame("dot", seed), { everyone: true });
    let d = 0;
    while (!winner(g) && d < 30) {
      const r = roundTable(g, null);
      d++;
      if (d === 1 && r.side === TRAITOR) day1T++;
      if (d >= 2 && d <= 6) { laterN++; if (r.side === TRAITOR) laterT++; }
    }
    daysToWin.push(d);
  }
  daysToWin.sort((a, b) => a - b);
  return { day1: day1T / n, later: laterT / laterN, median: daysToWin[n >> 1], max: daysToWin[n - 1] };
}

test("balance: day 1 is a guess; later days catch more Traitors; it takes a while", () => {
  const s = simulate(300);
  const tag = `day 1 ${(s.day1 * 100).toFixed(0)}%, days 2-6 ${(s.later * 100).toFixed(0)}%, median ${s.median} days, longest ${s.max}`;
  assert.lt(s.day1, 0.2, "day 1 hardly ever catches a Traitor: " + tag);
  assert.gt(s.later, 0.25, "clues help after day 1: " + tag);
  assert.lt(s.later, 0.55, "but the Traitors aren't easy: " + tag);
  assert.gt(s.median, 5, "catching all three takes a while: " + tag);
  assert.lt(s.median, 13, "but not forever: " + tag);
  assert.lt(s.max, 22, "every game ends: " + tag);
});
