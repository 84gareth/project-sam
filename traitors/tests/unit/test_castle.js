// The castle rules: suspect lists, what people say, the Round Table, and
// whether the Traitors are hard enough to catch (balance, measured).
import { test, assert } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL, DAYS } from "../../js/game.js";
import {
  arriveAtCastle, suspectList, votePlan, answer, promisedVote, computerVote,
  traitorTarget, roundTable, winner, stillIn, isTraitor, QUESTIONS, LIST_LENGTH,
  night, murderIdeas, breakfastGroups, finalRound, finalVote, prizeShare, allTraitors,
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
      assert.ok(/\b(No|Never|not|silly)\b|Faithful/.test(answer(g, id, "traitor").text), id);
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

test("the game lasts 12 days: no early Traitor win; after day 12 any Traitor left wins", () => {
  const g = castle(2);
  const keep = [...traitorsOf(g), ...stillIn(g).filter((id) => !isTraitor(g, id)).slice(0, 3)];
  for (const p of g.players) p.inGame = keep.includes(p.id);
  g.day = 12;
  assert.eq(winner(g), null, "as many Traitors as Faithfuls, but it's only day 12");
  g.day = 13;
  assert.eq(winner(g), null, "day 12 is over: the final, until everyone votes to end it");
  g.ended = true;
  assert.eq(winner(g), TRAITOR, "the final is over and Traitors are still in");
  for (const t of traitorsOf(g)) g.players.find((p) => p.id === t).inGame = false;
  assert.eq(winner(g), FAITHFUL, "none left: the Faithfuls win");
});

// Play a whole game with the computer playing Sam too. Returns the game.
function wholeGame(seed) {
  const g = arriveAtCastle(newGame("dot", seed), { everyone: true });
  while (!winner(g)) {
    // The final: vote to end, or banish again (no nights).
    if (g.day > DAYS) {
      if (finalRound(g).allEnd) break;
      roundTable(g, null);
      continue;
    }
    roundTable(g, null);
    if (winner(g)) break;
    if (isDaggerNight(g)) giveDagger(g);
    const kind = nightKind(g);
    if (kind === "recruit" || (kind === "choose" && computerChoice(g) === "recruit")) recruit(g);
    else if (kind === "choose") night(g);
    else if (kind === "murder") night(g);
    else quietNight(g);
  }
  return g;
}

test("nights: murder most nights; no-murder nights are announced that morning and always come true", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const g = arriveAtCastle(newGame("dot", seed), { everyone: true });
    let quiet = 0;
    while (!winner(g) && g.day <= DAYS) {
      const announced = noMurderToday(g);   // at breakfast
      roundTable(g, null);
      if (winner(g)) break;
      if (isDaggerNight(g)) giveDagger(g);
      const kind = nightKind(g);
      if (g.history.length === 1) assert.eq(kind, "recruit", "night 1 recruits");
      else if (kind === "choose") assert.eq(canMurderTonight(g), !announced, "a choose night can murder unless announced quiet");
      else assert.eq(kind === "quiet", announced, `seed ${seed} night ${g.history.length}: as announced`);
      if (kind === "quiet") quiet++;
      if (kind === "recruit" || (kind === "choose" && computerChoice(g) === "recruit")) recruit(g);
      else if (kind === "choose" || kind === "murder") night(g);
      else quietNight(g);
    }
    assert.ok(quiet <= 8, `${quiet} quiet nights: murders most nights`);
    if (!winner(g)) assert.ok(stillIn(g).length >= FINAL_SIZE - 1, `seed ${seed}: ${stillIn(g).length} left for the final`);
  }
});

test("with only 2 Traitors left they may recruit, any night", () => {
  let seen = 0;
  for (let seed = 1; seed <= 200 && seen < 5; seed++) {
    const g = castle(seed);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    recruit(g);
    g.day = 8;
    const traitors = traitorsOf(g).filter((id) => stillIn(g).includes(id) && id !== "dot");
    for (const t of traitors.slice(2)) g.players.find((p) => p.id === t).inGame = false;
    if (stillIn(g).filter((id) => isTraitor(g, id)).length !== 2) continue;
    g.history.push({}, {}, {}, {}, {}, {});   // night 7 (history entries 2-7)
    assert.eq(nightKind(g), "choose", "two left, late in the game: still a choice");
    seen++;
  }
  assert.gt(seen, 0);
});


test("balance over 12 days: both sides win sometimes; most games go the distance", () => {
  const N = 300;
  let faithfulWins = 0, fullLength = 0, rec = 0, caught = 0, finals = 0;
  const tl = [];
  const left = [];
  for (let seed = 1; seed <= N; seed++) {
    const g = wholeGame(seed);
    if (winner(g) === FAITHFUL) faithfulWins++;
    if (g.day > 12) fullLength++;
    left.push(stillIn(g).length);
    tl.push(stillIn(g).filter((id) => isTraitor(g, id)).length);
    rec += g.history.filter((h) => h.recruited).length;
    caught += g.history.filter((h) => h.side === TRAITOR).length;
    finals += Math.max(0, g.history.length - 12);
  }
  left.sort((a, b) => a - b);
  const tag = `final banishings ${(finals / N).toFixed(2)}, Faithfuls win ${(faithfulWins / N * 100).toFixed(0)}%, ${(fullLength / N * 100).toFixed(0)}% reach day 12, median ${left[N >> 1]} people left, Traitors left ${(tl.reduce((a, b) => a + b, 0) / N).toFixed(2)}, recruits ${(rec / N).toFixed(2)}, caught ${(caught / N).toFixed(2)} (averages)`;
  // Murder most nights, recruit whenever 2 are left, recruits grow
  // suspicious (RECRUIT_TELL 0.25): Faithfuls win ~57%, every game reaches
  // day 12 (measured 2026-10-25; 0.15 gave ~15%).
  assert.gt(faithfulWins / N, 0.4, tag);
  assert.lt(faithfulWins / N, 0.75, tag);
  assert.gt(fullLength / N, 0.4, tag);
  assert.ok(left[0] >= 2, "always at least two at the end: " + tag);
  assert.gt(finals / N, 0.2, "the final sometimes banishes again: " + tag);
  assert.lt(finals / N, 3, "but not on and on: " + tag);
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

// ─── Round Table talk ───────────────────────────────────────────────────────
import { tableTalk, talkOptions, playerSays, TALK_SWAY, QUIET_RISK } from "../../js/castle.js";

test("Round Table talk: two accusations, and the accused stick up for themselves", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = castle(seed);
    const talk = tableTalk(g);
    const accusations = talk.filter((t) => t.names.length === 1);
    assert.eq(accusations.length, 2, `seed ${seed}`);
    assert.eq(new Set(accusations.map((a) => a.names[0])).size, accusations.length, "different people accused");
    for (const t of talk) assert.ok(stillIn(g).includes(t.speaker) && t.speaker !== "dot", "only computer players speak");
    assert.eq(tableTalk(g), talk, "the same talk if you look again");
  }
});

test("Sam's options: four, always an accusation, staying quiet last; lots of variety", () => {
  const kinds = new Set(), texts = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const g = castle(seed);
    const talk = tableTalk(g);
    const opts = talkOptions(g, talk);
    assert.eq(opts.length, 4, `seed ${seed}`);
    assert.ok(opts.some((o) => o.kind === "accuse"));
    assert.eq(opts[3].kind, "quiet");
    if (talk.some((t) => t.names[0] === "dot")) assert.ok(opts.some((o) => o.kind === "defend" && o.target === "dot"), "accused: Sam can stick up for himself");
    for (const o of opts) { kinds.add(o.kind); texts.add(o.text); }
  }
  assert.eq([...kinds].sort(), ["accuse", "calm", "defend", "question", "quiet"]);
  assert.gt(texts.size, 60, `${texts.size} different things to say`);
});

test("staying quiet is risky: honest players suspect Sam more, and someone says so", () => {
  const g = castle(6);
  const honest = computers(g).filter((id) => !isTraitor(g, id));
  const before = honest.map((h) => g.scores[h].dot);
  const reply = playerSays(g, { kind: "quiet", target: null });
  honest.forEach((h, i) => assert.near(g.scores[h].dot, before[i] + QUIET_RISK, 1e-9, h));
  assert.ok(reply.text.includes("Detective Dot"), reply.text);
  assert.eq(reply.names, ["dot"]);
});

test("calming everyone down makes Sam look a little better", () => {
  const g = castle(6);
  const h = computers(g).find((id) => !isTraitor(g, id));
  const before = g.scores[h].dot;
  playerSays(g, { kind: "calm", target: null });
  assert.lt(g.scores[h].dot, before + 1e-9);
});

test("accusing someone makes honest players more suspicious of them", () => {
  const g = castle(6);
  const target = tableTalk(g).find((t) => t.names.length)?.names[0];
  const honest = computers(g).filter((id) => !isTraitor(g, id) && id !== target);
  const before = honest.map((h) => g.scores[h][target]);
  playerSays(g, { kind: "accuse", target });
  honest.forEach((h, i) => assert.near(g.scores[h][target], before[i] + TALK_SWAY, 1e-9, h));
});

// ─── Recruiting on the first night ──────────────────────────────────────────
import { isRecruitNight, recruit, recruitIdeas, nightKind, quietNight, computerChoice, noMurderToday, canMurderTonight, FINAL_SIZE } from "../../js/castle.js";

test("the first night recruits a fourth Traitor instead of a murder", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = castle(seed);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    if (winner(g)) continue;
    assert.ok(isRecruitNight(g), "night 1 is the recruiting night");
    const before = stillIn(g).length;
    const traitorsBefore = stillIn(g).filter((id) => isTraitor(g, id)).length;
    const who = recruit(g);
    assert.ok(isTraitor(g, who), "they've joined");
    assert.eq(stillIn(g).filter((id) => isTraitor(g, id)).length, traitorsBefore + 1, "one more Traitor");
    assert.eq(stillIn(g).length, before, "nobody murdered");
    assert.notOk(isRecruitNight(g), "only once");
    if (who !== "dot") {
      const top = suspectList(g, who).slice(0, LIST_LENGTH);
      assert.notOk(top.some((o) => isTraitor(g, o)), "the new Traitor's list points at Faithfuls now");
    }
  }
});

test("if the Traitors recruit Sam, he becomes a Traitor", () => {
  for (let seed = 1; seed <= 3000; seed++) {
    const g = castle(seed);
    if (g.playerSide !== FAITHFUL) continue;
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    if (winner(g) || !stillIn(g).includes("dot")) continue;
    if (recruitIdeas(g)[0] !== "dot") continue;
    recruit(g);
    assert.eq(g.playerSide, TRAITOR);
    return;
  }
  assert.ok(false, "never found a game where Sam was recruited");
});

test("a Traitor Sam picks who joins", () => {
  for (let seed = 1; seed <= 3000; seed++) {
    const g = castle(seed);
    if (g.playerSide !== TRAITOR) continue;
    roundTable(g, recruitIdeas(g)[0]);
    if (winner(g) || !stillIn(g).includes("dot")) continue;
    const pick = recruitIdeas(g)[2];
    assert.eq(recruit(g, pick), pick);
    return;
  }
  assert.ok(false, "no game found");
});

// ─── Joining someone else's chat ────────────────────────────────────────────
import { joinChat } from "../../js/castle.js";

test("two Traitors chatting send a Faithful Sam away", () => {
  let n = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = castle(seed);
    if (g.playerSide !== FAITHFUL) continue;
    const [a, b] = traitorsOf(g);
    const j = joinChat(g, a, b);
    assert.notOk(j.welcome, `seed ${seed}: ${j.text}`);
    n++;
  }
  assert.gt(n, 10);
});

test("two Traitors let a Traitor Sam in on the plan", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const g = castle(seed);
    if (g.playerSide !== TRAITOR) continue;
    const [a, b] = traitorsOf(g).filter((t) => t !== "dot");
    const j = joinChat(g, a, b);
    assert.ok(j.welcome);
    assert.ok(j.text.startsWith("Psst!"));
    return;
  }
  assert.ok(false, "no game found");
});

test("Faithfuls mostly welcome Sam, but not always (being sent away isn't proof)", () => {
  let welcome = 0, away = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = castle(seed);
    const [a, b] = computers(g).filter((id) => !isTraitor(g, id));
    joinChat(g, a, b).welcome ? welcome++ : away++;
  }
  assert.gt(welcome, away, `${welcome} welcomes, ${away} sent away`);
  assert.gt(away, 0, "sometimes Faithfuls want privacy too");
});

// Gareth, 2026-10-24: "much more variety ... the characters should somewhat
// reflect their personalities in what they say".
test("answers vary a lot, and people talk in their own way", async () => {
  const { PERSONALITY } = await import("../../js/dialogue.js");
  for (const q of ["suspect", "traitor", "vote", "me", "gossip"]) {
    const lines = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const g = castle(seed);
      for (const id of computers(g).filter((id) => !isTraitor(g, id))) lines.add(answer(g, id, q).text);
    }
    assert.gt(lines.size, 60, `${q}: ${lines.size} different lines`);
  }
  // Each character's own words turn up in what they say.
  const g = castle(2);
  for (const id of computers(g).filter((id) => !isTraitor(g, id))) {
    const own = [...PERSONALITY[id].openers, ...PERSONALITY[id].extras];
    let hits = 0;
    for (let day = 1; day <= 12; day++) {
      g.day = day;
      for (const q of ["suspect", "traitor", "vote", "me", "gossip"]) if (own.some((w) => answer(g, id, q).text.includes(w))) hits++;
    }
    assert.gt(hits, 10, `${id} sounds like themselves`);
  }
});

test("everyone has their own way of talking", async () => {
  const { PERSONALITY } = await import("../../js/dialogue.js");
  const { CHARACTERS } = await import("../../js/characters.js");
  for (const c of CHARACTERS) {
    assert.gt(PERSONALITY[c.id]?.openers.length ?? 0, 1, c.id);
    assert.gt(PERSONALITY[c.id].extras.length, 1, c.id);
  }
});

test("'What do you think of me?' matches where Sam is on their list", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = castle(seed);
    for (const id of computers(g).filter((id) => !isTraitor(g, id))) {
      const at = suspectList(g, id).indexOf(g.playerId);
      const text = answer(g, id, "me").text;
      if (at >= 0 && at < 3) assert.ok(/watching you|sneaky|on my list|not sure I trust/i.test(text), `${id}: ${text}`);
    }
  }
});

test("gossip gives a real clue: who voted out a Faithful yesterday", () => {
  let clues = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = castle(seed);
    roundTable(g, computers(g)[0]);
    const last = g.history[g.history.length - 1];
    if (last.side !== FAITHFUL) continue;
    const voters = last.votes.filter(([, t]) => t === last.banished).map(([v]) => v);
    for (const id of computers(g).filter((id) => !isTraitor(g, id))) {
      const said = answer(g, id, "gossip");
      if (voters.some((v) => v !== id && v !== g.playerId && stillIn(g).includes(v))) {
        assert.ok(voters.includes(said.names[0]), `${id} names a voter: ${said.text}`);
        clues++;
      }
    }
  }
  assert.gt(clues, 20);
});

// ─── Who's who (the pause page) ─────────────────────────────────────────────
import { whosWho } from "../../js/castle.js";

test("who's who: the banished show their side, the murdered were Faithful, the rest are secret", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = castle(seed);
    if (g.playerSide !== FAITHFUL) continue;
    const out = roundTable(g, stillIn(g).find((id) => id !== "dot")).banished;
    if (!stillIn(g).includes("dot")) continue;
    recruit(g);
    roundTable(g, stillIn(g).find((id) => id !== "dot"));
    if (!stillIn(g).includes("dot") || winner(g)) continue;
    const victim = night(g);
    const w = Object.fromEntries(whosWho(g).map((p) => [p.id, p]));
    assert.eq(w[out].gone, "banished");
    assert.eq(w[out].side, g.players.find((p) => p.id === out).side, "the banished: revealed");
    if (victim !== "dot") {
      assert.eq(w[victim].gone, "murdered");
      assert.eq(w[victim].side, FAITHFUL);
    }
    assert.ok(w.dot.you);
    for (const p of Object.values(w)) if (!p.gone && !p.you) assert.eq(p.side, null, `${p.id} is secret`);
  }
});

test("who's who: a Traitor Sam sees his fellow Traitors; the shield is shown", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const g = castle(seed);
    if (g.playerSide !== TRAITOR) continue;
    g.shields = [stillIn(g).find((id) => !isTraitor(g, id))];
    const w = whosWho(g);
    for (const p of w) if (isTraitor(g, p.id)) assert.eq(p.side, TRAITOR);
    assert.eq(w.filter((p) => p.shield).map((p) => p.id), g.shields);
    return;
  }
  assert.ok(false, "no game found");
});

// ─── The dagger (Sam) ───────────────────────────────────────────────────────
import { isDaggerNight, giveDagger, daggerHolder, hasDagger, daggerIdeas, DAGGER_AT } from "../../js/castle.js";

test("the dagger: given once, the night it gets down to 8; held the next day only", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = wholeGame(seed);
    if (!g.dagger) continue;
    const day = g.dagger.day;
    const h = g.history[day - 2];   // the day before: when it reached 8
    assert.ok(g.history[day - 1] === undefined || g.history[day - 1].dagger === g.dagger.holder, "the holder's day");
    assert.ok(h, `seed ${seed}`);
  }
  const g = castle(4);
  for (const p of g.players.slice(DAGGER_AT + 1)) p.inGame = false;
  assert.notOk(isDaggerNight(g), "9 left: not yet");
  g.players[DAGGER_AT].inGame = false;
  assert.ok(isDaggerNight(g), "8 left: tonight");
  const holder = giveDagger(g);
  assert.ok(hasDagger(g, holder));
  assert.notOk(isDaggerNight(g), "only once");
  g.day += 1;
  assert.eq(daggerHolder(g), null, "gone the day after");
});

test("the dagger doubles its holder's vote at the Round Table", () => {
  const g = castle(5);
  const voters = stillIn(g);
  const holder = voters.find((id) => id !== "dot");
  g.dagger = { holder, day: g.day };
  const r = roundTable(g, voters.find((id) => id !== "dot" && id !== holder));
  const theirVote = r.votes.find(([v]) => v === holder)[1];
  const plain = r.votes.filter(([, t]) => t === theirVote).length;
  assert.eq(r.counts[theirVote], plain + 1, "two for the holder's choice");
  assert.eq(r.dagger, holder);
});

test("the Traitors give it to one of their own unless a Traitor Sam picks", () => {
  const g = castle(7);
  assert.ok(isTraitor(g, daggerIdeas(g)[0]));
  for (let seed = 1; seed <= 300; seed++) {
    const t = castle(seed);
    if (t.playerSide !== TRAITOR) continue;
    const pick = stillIn(t).find((id) => !isTraitor(t, id));
    assert.eq(giveDagger(t, pick), pick, "anyone, even a Faithful");
    return;
  }
});

// ─── Several real players (Phase 8) ─────────────────────────────────────────
import { humansOf, isHuman } from "../../js/castle.js";

test("several real players: none get computer lists; each votes and speaks for themselves", () => {
  const g = arriveAtCastle(newGame("dot", 3, ["dot", "puddle", "fizz"]));
  assert.eq(humansOf(g), ["dot", "puddle", "fizz"]);
  for (const h of ["dot", "puddle", "fizz"]) assert.notOk(g.scores[h], `${h} has no computer list`);
  assert.ok(isHuman(g, "fizz"));
  const r = roundTable(g, { dot: "ruby", puddle: "ruby", fizz: "pepper" });
  assert.eq(r.votes.find(([v]) => v === "puddle")[1], "ruby");
  assert.eq(r.votes.find(([v]) => v === "fizz")[1], "pepper");
  const before = g.scores.gumdrop?.ruby;
  playerSays(g, { kind: "quiet", target: null }, "fizz");
  if (before !== undefined) assert.ok(g.scores.gumdrop.fizz !== undefined);
});

test("several real players: the same game on every device, whoever is looking", () => {
  const a = arriveAtCastle(newGame("dot", 9, ["dot", "puddle"]));
  const b = arriveAtCastle({ ...newGame("puddle", 9, ["dot", "puddle"]) });
  assert.eq(tableTalk(a), tableTalk(b), "the talk doesn't depend on who's looking");
  roundTable(a, { dot: "ruby", puddle: "fizz" });
  roundTable(b, { dot: "ruby", puddle: "fizz" });
  assert.eq(a.history, b.history);
  assert.eq(a.scores, b.scores);
});

test("who's who: a player who's out sees everyone's side (Gareth, 2026-10-29)", () => {
  const g = castle(3);
  const left = stillIn(g).filter((id) => id !== "dot");
  assert.ok(whosWho(g).some((p) => !p.you && p.side === null), "in the game: secrets kept");
  g.players.find((p) => p.id === "dot").inGame = false;
  const w = Object.fromEntries(whosWho(g).map((p) => [p.id, p]));
  for (const id of left) assert.eq(w[id].side, g.players.find((p) => p.id === id).side, `${id} shown`);
});

// ─── A draw (Gareth, 2026-10-29) ────────────────────────────────────────────
import { firstVote, tiePleas, revote, chests, pleaOptions, PLEAS } from "../../js/castle.js";
import { CHARACTERS } from "../../js/characters.js";
const everyone = CHARACTERS.map((c) => c.id);
// Everyone a real player, so every vote is chosen by the test.
const allReal = (seed = 5) => arriveAtCastle(newGame("dot", seed, everyone));

test("a draw: nobody leaves yet; the tied people speak; then only the others vote", () => {
  const g = allReal();
  const [a, b] = ["fizz", "barry"];
  const voters = stillIn(g);
  const first = firstVote(g, Object.fromEntries(voters.map((v, i) => [v, v === a ? b : v === b ? a : i % 2 ? a : b])));
  assert.eq(first.tie, [a, b].sort(), "a draw");
  assert.eq(stillIn(g).length, voters.length, "nobody out yet");
  assert.eq(g.day, 1, "still today");
  const { pleas } = tiePleas(g, { [a]: "Not me!" });
  assert.eq(pleas.map((p) => p.speaker), [a, b].sort());
  assert.eq(pleas.find((p) => p.speaker === a).text, "Not me!", "a real player says their pick");
  assert.ok(PLEAS.includes(pleaOptions(g, b)[0]));
  // Everyone else picks barry; fizz and barry vote for each other (ignored).
  const r = revote(g, Object.fromEntries(voters.map((v) => [v, v === b ? a : b])));
  assert.ok(r.votes.every(([v]) => v !== a && v !== b), "the tied people don't vote");
  assert.eq(r.banished, b);
  assert.eq(r.counts[a], 0);
  assert.eq(g.day, 2, "the day moves on once someone leaves");
  assert.eq(g.tie, undefined);
});

test("still a draw: one chest each, one empty; exactly one person leaves", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = allReal(seed);
    const tied = ["fizz", "barry", "olive"];
    g.tie = { day: g.day, votes: [], counts: {}, tied };
    const before = stillIn(g).length;
    const r = chests(g, { fizz: 0, barry: 0, olive: 2 });
    assert.eq(stillIn(g).length, before - 1, "one out");
    assert.ok(tied.includes(r.banished));
    assert.eq(r.chests.find((c) => c.chest === r.empty).id, r.banished, "the empty chest's owner");
    assert.eq(new Set(r.chests.map((c) => c.chest)).size, 3, "a chest each");
    assert.eq(r.chests.find((c) => c.id === "fizz").chest, 0, "fizz picked first and got her chest");
    assert.ok(r.chests.find((c) => c.id === "barry").chest !== 0, "barry's pick was taken");
  }
});

test("the computers' Round Table always ends with exactly one person out", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = castle(seed);
    const before = stillIn(g).length;
    roundTable(g, null);
    assert.eq(stillIn(g).length, before - 1);
    assert.eq(g.tie, undefined);
  }
});
