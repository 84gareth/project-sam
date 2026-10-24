// The castle rules: suspect lists, what people say, the Round Table, and
// whether the Traitors are hard enough to catch (balance, measured).
import { test, assert } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL } from "../../js/game.js";
import {
  arriveAtCastle, suspectList, votePlan, answer, promisedVote, computerVote,
  traitorTarget, roundTable, winner, stillIn, isTraitor, QUESTIONS, LIST_LENGTH,
  night, murderIdeas, breakfastGroups,
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
    for (const id of computers(g)) {
      if (g.playerSide === TRAITOR && isTraitor(g, id)) continue;   // whispers instead
      assert.ok(/^(No|Me\? No)/.test(answer(g, id, "traitor").text), id);
    }
  }
});

test("Faithfuls never fib: they vote how they said", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = castle(seed);
    for (const id of computers(g).filter((id) => !isTraitor(g, id))) {
      assert.eq(computerVote(g, id), promisedVote(g, id), `${id} seed ${seed}`);
      assert.eq(answer(g, id, "suspect").names[0], suspectList(g, id)[0], "suspect = top of their list");
    }
  }
});

test("Faithfuls vote tactically sometimes: with the crowd, or to keep themselves safe", () => {
  const reasons = {};
  let notTop = 0, total = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const g = castle(seed);
    for (const id of computers(g).filter((id) => !isTraitor(g, id))) {
      const plan = votePlan(g, id);
      reasons[plan.reason] = (reasons[plan.reason] || 0) + 1;
      total++;
      if (plan.vote !== suspectList(g, id)[0]) notTop++;
    }
  }
  for (const r of ["honest", "crowd", "safe", "unsure"]) assert.gt(reasons[r] || 0, 0, `some ${r} votes: ${JSON.stringify(reasons)}`);
  assert.gt(notTop / total, 0.05, `${notTop}/${total} vote for someone not top of their list`);
  assert.lt(notTop / total, 0.5, `${notTop}/${total}`);
});

test("'Who will you vote for?' has lots of different answers", () => {
  const shapes = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const g = castle(seed);
    for (const id of computers(g)) {
      // The answer's shape, with names blanked out.
      shapes.add(answer(g, id, "vote").text.replace(/[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*/g, "X"));
    }
  }
  assert.gt(shapes.size, 5, `${shapes.size} different answers`);
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

// ─── The night ──────────────────────────────────────────────────────────────

test("the Traitors murder a Faithful, never a Traitor", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = castle(seed);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    if (winner(g)) continue;
    const victim = night(g);
    assert.notOk(isTraitor(g, victim), `seed ${seed}`);
    assert.notOk(stillIn(g).includes(victim), "they've gone");
    assert.eq(g.history[0].murdered, victim, "remembered");
  }
});

test("a Traitor Sam picks who is murdered", () => {
  for (let seed = 1; seed <= 3000; seed++) {
    const g = castle(seed);
    if (g.playerSide !== TRAITOR) continue;
    roundTable(g, murderIdeas(g)[0]);
    if (winner(g) || !stillIn(g).includes("dot")) continue;
    const pick = murderIdeas(g)[3];
    assert.eq(night(g, pick), pick);
    return;
  }
  assert.ok(false, "no game found where Sam is a Traitor still in");
});

test("murder ideas are only Faithfuls still in the game", () => {
  const g = castle(11);
  for (const id of murderIdeas(g)) {
    assert.notOk(isTraitor(g, id));
    assert.ok(stillIn(g).includes(id));
  }
});

test("breakfast: everyone still in arrives once, in groups of 2 or 3", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = castle(seed);
    const n = 22 - (seed % 15);
    for (const p of g.players.slice(n)) p.inGame = false;
    const groups = breakfastGroups(g);
    assert.eq(groups.flat().sort(), stillIn(g).sort(), `seed ${seed}`);
    for (const grp of groups) assert.ok(grp.length >= 2 && grp.length <= 3, `group of ${grp.length}`);
  }
});

test("the Traitors win when they're as many as the Faithfuls", () => {
  const g = castle(2);
  const keep = [...traitorsOf(g), ...stillIn(g).filter((id) => !isTraitor(g, id)).slice(0, 3)];
  for (const p of g.players) p.inGame = keep.includes(p.id);
  assert.eq(winner(g), TRAITOR);
});

test("balance with nights: Faithfuls win most games, but not all; a game lasts days", () => {
  const N = 300;
  let faithfulWins = 0;
  const days = [];
  for (let seed = 1; seed <= N; seed++) {
    const g = arriveAtCastle(newGame("dot", seed), { everyone: true });
    let d = 0;
    while (!winner(g) && d < 30) {
      roundTable(g, null);
      d++;
      if (!winner(g)) night(g);
    }
    if (winner(g) === FAITHFUL) faithfulWins++;
    days.push(d);
  }
  days.sort((a, b) => a - b);
  const tag = `Faithfuls win ${(faithfulWins / N * 100).toFixed(0)}%, median ${days[N >> 1]} days, longest ${days[N - 1]}`;
  assert.gt(faithfulWins / N, 0.55, tag);
  assert.lt(faithfulWins / N, 0.85, tag);
  assert.gt(days[N >> 1], 5, tag);
  assert.lt(days[N >> 1], 13, tag);
});

test("Traitors whisper the truth to a Traitor Sam, and fib to a Faithful Sam", () => {
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 10; seed++) {
    const g = castle(seed);
    const fellows = traitorsOf(g).filter((t) => t !== g.playerId);
    for (const t of fellows) {
      const a = answer(g, t, "traitor").text;
      if (g.playerSide === TRAITOR) {
        assert.ok(a.startsWith("Shh!"), `whisper to a fellow Traitor: ${a}`);
        assert.eq(answer(g, t, "vote").names[0], computerVote(g, t), "they tell Sam their real vote");
        for (const n of answer(g, t, "list").names) assert.notOk(isTraitor(g, n), "the list is only Faithfuls to blame");
        checked++;
      } else {
        assert.notOk(a.startsWith("Shh!"), "a Faithful Sam gets no whispers");
      }
    }
  }
  assert.gt(checked, 0, "found games with Sam as a Traitor");
});
