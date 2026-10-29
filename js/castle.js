// A day at the castle: who suspects whom, what people say when you chat,
// and the Round Table vote. Pure: no page, no timers. Every "random" choice
// comes from the game's seed, so the same game always plays the same way
// (docs/castle-spec.md).

import { CHARACTERS } from "./characters.js";
import { makeRandom, FAITHFUL, TRAITOR, DAYS } from "./game.js";
import { inCharacter, pickOne } from "./dialogue.js";

export const QUESTIONS = [
  { id: "list", text: "Show me your list" },
  { id: "suspect", text: "Who do you suspect?" },
  { id: "traitor", text: "Are you a Traitor?" },
  { id: "vote", text: "Who will you vote for?" },
  { id: "me", text: "What do you think of me?" },
  { id: "gossip", text: "Any gossip?" },
];
export const LIST_LENGTH = 5;

const nameOf = (id) => CHARACTERS.find((c) => c.id === id).name;

// A random number generator for one decision, from the game seed plus words
// that name the decision, so answers don't change if you ask twice.
function rng(game, ...parts) {
  let h = game.seed >>> 0;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return makeRandom(h);
}

const player = (game, id) => game.players.find((p) => p.id === id);
export const isTraitor = (game, id) => player(game, id).side === TRAITOR;
// The real players (Phase 8: several; single player: just one). Rules that
// change the game use this list; `game.playerId` is only "who's looking"
// on this device, so every device works the game out the same way.
export const humansOf = (game) => game.humans ?? [game.playerId];
export const isHuman = (game, id) => humansOf(game).includes(id);
const humanTraitorIn = (game) => humansOf(game).some((id) => isTraitor(game, id) && player(game, id).inGame);
// Who won a shield at today's mission (worn until the next day).
export const hasShield = (game, id) => (game.shields ?? []).includes(id);

// ─── The dagger (Sam, 2026-10-25) ───────────────────────────────────────────
// The night it gets down to 8 players, the Traitors give someone the dagger
// (anyone, even one of themselves). The holder carries it all the next day,
// and their vote counts twice at that day's Round Table. Once a game.
export const DAGGER_AT = 8;
export const isDaggerNight = (game) => !game.dagger && game.day <= DAYS && stillIn(game).length <= DAGGER_AT;
export const daggerHolder = (game) => (game.dagger && game.dagger.day === game.day ? game.dagger.holder : null);
export const hasDagger = (game, id) => daggerHolder(game) === id;
// Who the Traitors would give it to, best first: a Traitor nobody suspects
// much (an extra vote for their side), then everyone else.
export function daggerIdeas(game) {
  const honest = brains(game).filter((id) => !isTraitor(game, id));
  const suspicion = (x) => honest.reduce((sum, h) => sum + (h === x ? 0 : game.scores[h][x]), 0);
  const left = stillIn(game);
  const traitors = left.filter((id) => isTraitor(game, id)).sort((a, b) => suspicion(a) - suspicion(b) || (a < b ? -1 : 1));
  return [...traitors, ...left.filter((id) => !isTraitor(game, id))];
}
// Give it out tonight: Sam's pick if he's a Traitor still in, else theirs.
// It's for the coming day (game.day is already the next day at night).
export function giveDagger(game, pick = null) {
  const samPicks = humanTraitorIn(game);
  const holder = samPicks && pick ? pick : daggerIdeas(game)[0];
  game.dagger = { holder, day: game.day };
  return holder;
}
export const stillIn = (game) => game.players.filter((p) => p.inGame).map((p) => p.id);
// Computer players still in. With `everyone`, Sam counts too (the balance
// tests let the computer play his part).
const brains = (game) => Object.keys(game.scores).filter((id) => player(game, id).inGame);

// Every computer player gets a suspect score for everyone else (higher =
// more suspected). Faithfuls start with an honest hunch. Traitors fake it:
// fellow Traitors get low scores, so their lists point at Faithfuls.
export function arriveAtCastle(game, { everyone = false } = {}) {
  game.day = 1;
  game.history = [];
  game.scores = {};
  for (const me of game.players) {
    if (isHuman(game, me.id) && !everyone) continue;
    const r = rng(game, "hunch", me.id);
    const scores = {};
    for (const other of game.players) {
      if (other.id === me.id) continue;
      if (me.side === FAITHFUL) scores[other.id] = r() * 0.5;
      else scores[other.id] = other.side === TRAITOR ? 0.05 + r() * 0.3 : 0.2 + r() * 0.6;
    }
    game.scores[me.id] = scores;
  }
  return game;
}

// Who `id` suspects, most first (people still in the game only).
export function suspectList(game, id) {
  const s = game.scores[id];
  return stillIn(game).filter((o) => o !== id).sort((a, b) => s[b] - s[a] || (a < b ? -1 : 1));
}

// Today's Faithful the Traitors are ganging up on: the one the Faithfuls
// already suspect most, so the Traitors blend in.
export function traitorTarget(game) {
  const faithfuls = stillIn(game).filter((id) => !isTraitor(game, id));
  const honest = brains(game).filter((id) => !isTraitor(game, id));
  let best = faithfuls[0], bestScore = -Infinity;
  for (const f of faithfuls) {
    const total = honest.reduce((sum, h) => sum + (h === f ? 0 : game.scores[h][f]), 0);
    if (total > bestScore) { best = f; bestScore = total; }
  }
  return best;
}

// What `id` says when asked `question` today. Asking again gives the same
// answer. Returns { text, names } (names: the people mentioned, in order).
// `viewer`: who's asking (this device's player); null for the version
// everyone sees (the Round Table talk), so all devices agree.
export function answer(game, id, question, viewer = game.playerId) {
  const r = rng(game, "answer", game.day, id, question);
  const list = suspectList(game, id);
  const sneaky = isTraitor(game, id);
  const say = (text, names = []) => ({ text, names });
  // Sam is a Traitor talking to another Traitor: no fibs between them, just
  // sneaky whispers (Gareth, 2026-10-24).
  if (sneaky && viewer && isTraitor(game, viewer) && id !== viewer) {
    const target = traitorTarget(game);
    const vote = computerVote(game, id);
    switch (question) {
      case "list":
        return say("Shh! Here's who we should get the others to blame:", list.filter((o) => !isTraitor(game, o)).slice(0, LIST_LENGTH));
      case "suspect":
        return say(`Between you and me? Let's point everyone at ${nameOf(target)}.`, [target]);
      case "traitor":
        return say("Shh! Not so loud! You know we're on the same side...");
      case "vote":
        return say(vote === target
          ? `${nameOf(vote)}. All us Traitors stick together!`
          : `I'll vote ${nameOf(vote)}, so nobody sees us voting the same. Sneaky!`, [vote]);
    }
  }
  // Everything below is said in the character's own way (dialogue.js).
  const said = (text, names = []) => say(inCharacter(id, text, r), names);
  switch (question) {
    case "list": {
      const names = list.slice(0, LIST_LENGTH);
      return said(pickOne([
        "Here's my list of who might be a Traitor:",
        "I've been keeping a list. Here it is:",
        "My top suspects, in order:",
        "Don't tell anyone, but here's my list:",
        "These are the ones I'm watching:",
      ], r), names);
    }
    case "suspect": {
      // A Traitor sometimes names someone who isn't top of their own list:
      // a little fib you can catch by asking for their list too.
      const pick = sneaky && r() < 0.4 ? list[1 + Math.floor(r() * (LIST_LENGTH - 1))] : list[0];
      const n = nameOf(pick);
      return said(pickOne([
        `I think it's ${n}.`,
        `${n}. Definitely ${n}.`,
        `Have you noticed ${n}? Very suspicious.`,
        `My money's on ${n}.`,
        `${n} keeps going quiet when the Traitors come up.`,
        `I don't trust ${n} one bit.`,
        `If I had to pick... ${n}.`,
      ], r), [pick]);
    }
    case "traitor": {
      // Everyone says no. Traitors are much quicker to blame someone else.
      if (r() < (sneaky ? 0.7 : 0.25)) {
        const blamed = sneaky ? traitorTarget(game) : list[0];
        const n = nameOf(blamed);
        return said(pickOne([
          `No! But keep an eye on ${n}...`,
          `Me? Never! You should be asking ${n} that.`,
          `How dare you! No! Go and ask ${n}.`,
          `No! I'm Faithful. ${n}, on the other hand...`,
        ], r), [blamed]);
      }
      return said(pickOne([
        "No way! I'm a Faithful.",
        "Me? No! I'm Faithful, I promise.",
        "Absolutely not! Faithful through and through.",
        "A Traitor? Me? Don't be silly!",
        "Cross my heart, I'm a Faithful.",
        "No! Why does everyone keep asking me that?",
      ], r));
    }
    case "vote": {
      const plan = sneaky ? traitorPlan(game, id) : votePlan(game, id);
      const [a, b] = plan.names.map(nameOf);
      const lines = {
        honest: [`I'll vote for ${a}. I really think it's them.`, `${a}. I'm sure of it!`,
          `${a}'s name is going on my chalkboard.`, `It has to be ${a}.`],
        crowd: [`Lots of people are going for ${a}, so I will too.`, `Probably ${a}. Everyone's saying it.`,
          `${a}, I think. No point voting on my own.`, `I'll go with the crowd: ${a}.`],
        safe: [`${a}. I don't want people looking at ME!`, `I'll go with ${a}. Better them than me...`,
          `${a}. Please don't vote for me!`],
        unsure: [`I can't decide! ${a}... or maybe ${b}.`, `Hmm. ${a} or ${b}? I'll decide at the table.`,
          `It's between ${a} and ${b}. Ask me later!`],
      }[plan.reason];
      return said(pickOne(lines, r), plan.names);
    }
    case "me": {
      // What they think of Sam: where Sam is on their list.
      const at = list.indexOf(game.playerId);
      if (at >= 0 && at < 3) {
        return said(pickOne([
          "Honestly? I'm watching you.",
          "Hmm. You've been acting a bit sneaky, you know.",
          "You're on my list. Near the top, actually.",
          "I'm not sure I trust you. Sorry!",
        ], r), [game.playerId]);
      }
      if (at >= 0 && at < list.length / 2) {
        return said(pickOne([
          "I haven't made my mind up about you yet.",
          "You seem all right. Probably.",
          "Not sure. Prove you're a Faithful!",
        ], r));
      }
      return said(pickOne([
        "I trust you! You're one of the good ones.",
        "You? Faithful, for sure.",
        "I'd never vote for you.",
        "You're one of the few people here I trust.",
      ], r));
    }
    case "gossip": {
      // Day 1: idle chit-chat. After that, who voted for someone who turned
      // out to be Faithful: a real clue.
      const last = game.history[game.history.length - 1];
      const wrong = last && last.side === FAITHFUL
        ? last.votes.filter(([v, t]) => t === last.banished && v !== id && v !== game.playerId && stillIn(game).includes(v))
        : [];
      if (wrong.length > 0) {
        const [v] = wrong[Math.floor(r() * wrong.length)];
        const n = nameOf(v);
        const gone = nameOf(last.banished);
        return said(pickOne([
          `Did you see ${n} voted for ${gone}? And ${gone} was a Faithful!`,
          `${n} voted out ${gone} yesterday. Makes you think...`,
          `Psst. ${n} wanted ${gone} gone. Why, I wonder?`,
        ], r), [v]);
      }
      const others = stillIn(game).filter((o) => o !== id && o !== game.playerId);
      const x = others[Math.floor(r() * others.length)];
      const y = others.filter((o) => o !== x)[Math.floor(r() * (others.length - 1))];
      return said(pickOne([
        `I saw ${nameOf(x)} and ${nameOf(y)} whispering in the library.`,
        `${nameOf(x)} ate three of Chef Pepper's pies. Brave!`,
        `${nameOf(x)} keeps wandering off on their own...`,
        `Someone left muddy footprints in the great hall. I think it was ${nameOf(x)}.`,
        `${nameOf(x)} and ${nameOf(y)} have been best friends all day. Hmm.`,
      ], r), [x]);
    }
  }
  throw new Error(`no question "${question}"`);
}

// Who most people have at the top of their list today: the one heading
// for the most votes.
export function frontRunners(game) {
  const tops = {};
  for (const b of brains(game)) {
    const t = suspectList(game, b)[0];
    tops[t] = (tops[t] || 0) + 1;
  }
  return Object.keys(tops).sort((a, b) => tops[b] - tops[a] || (a < b ? -1 : 1));
}

// A Faithful's plan for the Round Table (Gareth, 2026-10-24: "more intrigue,
// tactical play, picking someone they think might get more votes to save
// them"). Faithfuls never fib: they vote the way they say. Reasons:
// - honest: the top of their own list;
// - crowd:  the front-runner, if it is in their own top 3 (no wasted vote);
// - safe:   people suspect THEM, so they pile on the front-runner to stay safe;
// - unsure: torn between their top two; they pick the first at the table.
// Returns { vote, reason, names } (names: who they'll mention when asked).
export const VOTE_REASONS = { honest: 0.5, crowd: 0.25, safe: 0.1, unsure: 0.15 };
export function votePlan(game, id) {
  const list = suspectList(game, id);
  const r = rng(game, "plan", game.day, id);
  const roll = r();
  const runners = frontRunners(game).filter((x) => x !== id);
  const runner = runners[0] ?? list[0];
  const suspectsMe = frontRunners(game).slice(0, 3).includes(id);
  let reason = "honest";
  if (roll < VOTE_REASONS.unsure) reason = "unsure";
  else if (roll < VOTE_REASONS.unsure + VOTE_REASONS.crowd && list.slice(0, 3).includes(runner)) reason = "crowd";
  else if (roll < VOTE_REASONS.unsure + VOTE_REASONS.crowd + VOTE_REASONS.safe && suspectsMe) reason = "safe";
  const vote = reason === "crowd" || reason === "safe" ? runner : list[0];
  const names = reason === "unsure" ? [list[0], list[1]] : [vote];
  return { vote, reason, names };
}

// Who `id` says they'll vote for (the first name they mention). Faithfuls
// mean it. Traitors fib about half the time: they promise one name and then
// vote with the other Traitors.
export function promisedVote(game, id) {
  if (!isTraitor(game, id)) return votePlan(game, id).vote;
  return traitorPlan(game, id).names[0];
}

// A Traitor's plan: what they'll say (with a reason, like a Faithful) and
// how they'll really vote.
function traitorPlan(game, id) {
  const r = rng(game, "promise", game.day, id);
  const target = traitorTarget(game);
  let said = target;
  if (r() >= 0.5) {
    const others = suspectList(game, id).filter((o) => o !== target && !isTraitor(game, o));
    said = others[Math.floor(r() * Math.min(LIST_LENGTH, others.length))] ?? target;
  }
  const reasons = ["honest", "crowd", "unsure"];
  const reason = reasons[Math.floor(r() * reasons.length)];
  const other = suspectList(game, id).find((o) => o !== said && !isTraitor(game, o)) ?? said;
  return { vote: computerVote(game, id), reason, names: reason === "unsure" ? [said, other] : [said] };
}

// How a computer player really votes. Traitors usually gang up on today's
// target, but not always: a Traitor who always votes with the others is
// too easy to spot.
export const TRAITOR_TEAM_VOTE = 0.6;
export function computerVote(game, id) {
  if (!isTraitor(game, id)) return votePlan(game, id).vote;
  const r = rng(game, "vote", game.day, id);
  return r() < TRAITOR_TEAM_VOTE ? traitorTarget(game) : suspectList(game, id)[0];
}

// The Round Table. `playerVote`: who Sam tapped (ignored if Sam is played
// by the computer). Everyone votes in seat order; the most votes leaves.
// A draw (Gareth, 2026-10-29): the tied people each say something, then
// everyone else votes again between just them; still a draw, and each
// tied person picks a chest: one is empty, and whoever gets it leaves (the
// rest hold shields). Then everyone learns from the votes.
// `playerVote`: the one real player's vote, or { player: vote } for several.
//
// The screens take it a step at a time (firstVote, tiePleas, revote,
// chests); roundTable does the lot at once, with the real players' default
// choices after the first vote (for the rules' own tests and balance runs).
export function roundTable(game, playerVote) {
  let r = firstVote(game, playerVote);
  if (r.tie) r = revote(game, null);
  if (r.tie) r = chests(game, {});
  return r;
}
const humanPart = (part, v) => (part && typeof part === "object" ? part[v] : part);
// Most votes: the ids with the top count, in order.
const topOf = (counts) => {
  const top = Math.max(...Object.values(counts));
  return Object.keys(counts).filter((id) => counts[id] === top).sort();
};
export function firstVote(game, playerVote) {
  const voters = stillIn(game);
  const votes = voters.map((v) => [v, game.scores[v] ? computerVote(game, v)
    : humanPart(playerVote, v) ?? voters.find((o) => o !== v)]);
  // The dagger: its holder's vote counts twice today (Sam).
  const counts = {};
  for (const [v, t] of votes) counts[t] = (counts[t] || 0) + (hasDagger(game, v) ? 2 : 1);
  const tied = topOf(counts);
  if (tied.length > 1) {
    game.tie = { day: game.day, votes, counts, tied };
    return { day: game.day, votes, counts, tie: tied, dagger: daggerHolder(game) };
  }
  return banish(game, tied[0], votes, counts);
}
// Out they go: the end of the Round Table, however it was settled.
// History keeps the first vote (who accused whom); the screens get the
// votes that settled it (`shown`), for the chalkboards.
function banish(game, banished, votes, counts, extra = {}, shown = null) {
  const side = player(game, banished).side;
  player(game, banished).inGame = false;
  const result = { day: game.day, votes, counts, banished, side, dagger: daggerHolder(game), ...extra };
  delete game.tie;
  game.history.push(result);
  learn(game, result);
  game.day += 1;
  return shown ? { ...result, ...shown } : result;
}

// What the tied people say before the new vote. `said`: { realPlayer: text }.
export const PLEAS = [
  "Please! I'm a Faithful, I promise!",
  "Think about it. Would a Traitor work this hard?",
  "You're making a big mistake. It's not me!",
  "I've been on your side all along!",
  "Vote for me and the Traitors will be laughing!",
  "Look at who started this. That's your Traitor!",
];
export function pleaOptions(game, me) {
  const r = rng(game, "plea-options", game.day, me);
  const pool = [...PLEAS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
export function tiePleas(game, said = {}) {
  const tied = game.tie?.tied ?? [];
  return { pleas: tied.map((id) => {
    if (!game.scores[id]) return { speaker: id, text: said?.[id] ?? pleaOptions(game, id)[0] };
    const r = rng(game, "plea", game.day, id);
    return { speaker: id, text: inCharacter(id, pickOne(PLEAS, r), r) };
  }) };
}

// The new vote: everyone but the tied people, choosing between them.
export function revote(game, playerVote) {
  const { tied } = game.tie;
  const voters = stillIn(game).filter((v) => !tied.includes(v));
  const computerPick = (v) => {
    const s = game.scores[v];
    // A Traitor saves a fellow Traitor if they can; everyone else goes for
    // whoever they suspect most.
    const options = isTraitor(game, v) && tied.some((t) => !isTraitor(game, t)) ? tied.filter((t) => !isTraitor(game, t)) : tied;
    return [...options].sort((a, b) => s[b] - s[a] || (a < b ? -1 : 1))[0];
  };
  const votes = voters.map((v) => {
    const mine = humanPart(playerVote, v);
    return [v, game.scores[v] ? computerPick(v) : tied.includes(mine) ? mine : tied[0]];
  });
  const counts = Object.fromEntries(tied.map((t) => [t, 0]));
  for (const [v, t] of votes) counts[t] += hasDagger(game, v) ? 2 : 1;
  const still = voters.length ? topOf(counts) : tied;
  if (still.length > 1) {
    game.tie = { ...game.tie, revotes: votes, recounts: counts, tied: still };
    return { day: game.day, votes, counts, tie: still, revote: true, dagger: daggerHolder(game) };
  }
  return banish(game, still[0], game.tie.votes, game.tie.counts, { revotes: votes, recounts: counts }, { votes, counts });
}

// Still a draw: one chest each; one is empty. `picks`: { realPlayer: chest
// number }. The tied people pick in turn (the order they're listed); a real
// player whose chest was taken, and the computer, get a free one at
// random.
export function chests(game, picks = {}) {
  const { tied } = game.tie;
  const r = rng(game, "chests", game.day);
  const empty = Math.floor(r() * tied.length);
  const free = tied.map((_, i) => i);
  const chosen = tied.map((id) => {
    const want = picks?.[id];
    const i = !game.scores[id] && free.includes(want) ? want : free[Math.floor(r() * free.length)];
    free.splice(free.indexOf(i), 1);
    return { id, chest: i };
  });
  const out = chosen.find((c) => c.chest === empty).id;
  return banish(game, out, game.tie.votes, game.tie.counts,
    { revotes: game.tie.revotes, recounts: game.tie.recounts, chests: chosen, empty });
}

// After the reveal, honest players change their minds:
// - voted for someone who turned out Faithful: more suspicious;
// - voted for a Traitor who was caught: less suspicious;
// - voted for ME: a bit more suspicious (people suspect their accusers).
// Traitors keep their fake lists, with a little shuffle so they look alive.
export const LEARN_WRONG_VOTE = 0.12;
export const LEARN_NOISE = 0.15;
export const RECRUIT_TELL = 0.25;
function learn(game, { votes, banished, side }) {
  for (const me of brains(game)) {
    const r = rng(game, "learn", game.day, me);
    const s = game.scores[me];
    for (const [voter, target] of votes) {
      if (voter === me || s[voter] === undefined) continue;
      if (isTraitor(game, me)) continue;
      if (target === banished) s[voter] += side === TRAITOR ? -0.2 : LEARN_WRONG_VOTE;
      if (target === me) s[voter] += 0.08;
    }
    // New Traitors act a bit oddly: honest players grow more suspicious of
    // anyone recruited, day by day (Gareth: to balance late recruiting).
    if (!isTraitor(game, me)) {
      for (const h of game.history) if (h.recruited && h.recruited !== me && s[h.recruited] !== undefined) s[h.recruited] += RECRUIT_TELL;
    }
    for (const o of Object.keys(s)) s[o] = Math.min(2, Math.max(0, s[o] + (r() - 0.5) * LEARN_NOISE));
  }
}

// Who has won, if anyone. The game lasts 12 days (Sam): it ends early only
// if every Traitor is caught. After day 12 comes the final (Sam: "like the
// TV show"): it ends when everyone votes to end it; then any Traitor still
// in wins, and if none, the Faithfuls do. Null while it goes on.
export function winner(game) {
  const left = stillIn(game);
  const traitors = left.filter((id) => isTraitor(game, id)).length;
  if (traitors === 0) return FAITHFUL;
  if (traitors === left.length) return TRAITOR;   // no Faithfuls left (a safety net)
  if (game.day > DAYS && game.ended) return TRAITOR;
  return null;
}

// ─── The final ──────────────────────────────────────────────────────────────
// Everyone left votes "end" (finish the game now) or "banish" (one more
// Round Table). Traitors always want to end it. A Faithful wants another
// banishing if one person stands out on their list.
export const FINAL_MARGIN = 0.3;
export const inFinal = (game) => game.day > DAYS && !game.ended;
export function finalVote(game, id) {
  if (isTraitor(game, id)) return "end";
  const list = suspectList(game, id);
  if (list.length < 2) return "end";
  const s = game.scores[id];
  const rest = list.slice(1).reduce((sum, o) => sum + s[o], 0) / (list.length - 1);
  return s[list[0]] - rest >= FINAL_MARGIN ? "banish" : "end";
}
// What they say as they make their choice at the fire pit (Sam: "they also
// say a line about why they voted the way they did"), in their own way.
export function finalLine(game, id, vote) {
  const r = rng(game, "final-line", game.day, id);
  if (vote === "end") {
    return inCharacter(id, pickOne([
      "I trust everyone at this table. End the game!",
      "We've caught them all. I'm sure of it!",
      "I'm happy. Let's end it and share the money!",
      "No more banishing. I believe in all of you.",
      "End it! The Traitors are gone.",
    ], r), r);
  }
  const n = game.scores[id] ? nameOf(suspectList(game, id)[0]) : "someone";
  return inCharacter(id, pickOne([
    `I still don't trust ${n}. Banish again!`,
    `There's a Traitor at this table. I can feel it.`,
    `${n} has been far too quiet. One more vote!`,
    `Not yet! I think ${n} is a Traitor.`,
  ], r), r);
}
// Sam's choices at the fire pit: two ways to say end, two to say banish.
export function finalChoices(game) {
  const r = rng(game, "final-choices", game.day);
  const pick = (list) => { const i = Math.floor(r() * list.length); return list.splice(i, 1)[0]; };
  const ends = ["I trust everyone here. End the game!", "We got them all. Let's end it!", "I'm sure. End it and share the money!"];
  const banishes = ["There's still a Traitor here. Banish again!", "I don't trust someone at this table!", "Not yet! One more vote!"];
  return [
    { vote: "end", text: pick(ends) }, { vote: "end", text: pick(ends) },
    { vote: "banish", text: pick(banishes) }, { vote: "banish", text: pick(banishes) },
  ];
}

// One vote in the final. `samVote` is Sam's ("end" or "banish"); computer
// players decide for themselves. With only two left, it ends. Each vote is
// [who, "end" | "banish", what they say].
// `samVote`/`samLine`: the one real player's; or samVote = { player:
// { vote, line } } for several.
export function finalRound(game, samVote = null, samLine = null) {
  const many = samVote && typeof samVote === "object" ? samVote : null;
  const votes = stillIn(game).map((id) => {
    const h = many ? many[id] : null;
    const v = game.scores[id] ? finalVote(game, id) : h ? h.vote : many ? "end" : samVote ?? "end";   // not waited for: "end"
    const line = h?.line ?? (id === game.playerId && samLine ? samLine : null);
    return [id, v, line ?? finalLine(game, id, v)];
  });
  const allEnd = stillIn(game).length <= 2 || votes.every(([, v]) => v === "end");
  if (allEnd) game.ended = true;
  return { votes, allEnd };
}

// The pot, shared by the winners still in the game.
export function prizeShare(game) {
  const side = winner(game);
  const winners = stillIn(game).filter((id) => (side === TRAITOR) === isTraitor(game, id));
  const each = winners.length ? Math.floor((game.pot ?? 0) / winners.length / 10) * 10 : 0;
  return { side, winners, each };
}

// Every Traitor of the whole game, and how they got on: "recruited" if
// they were recruited, and whether they were banished.
export function allTraitors(game) {
  const recruited = new Set(game.history.map((h) => h.recruited).filter(Boolean));
  const banished = new Set(game.history.map((h) => h.banished).filter(Boolean));
  return game.players.filter((p) => p.side === TRAITOR)
    .map((p) => ({ id: p.id, recruited: recruited.has(p.id), banished: banished.has(p.id) }));
}

// ─── The night (docs/night-spec.md) ─────────────────────────────────────────

// How dangerous each Faithful is to the Traitors: how much they already
// suspect the Traitors. Sam (if he's a Faithful) has no list, so the
// Traitors guess at him.
function threat(game, id) {
  const traitors = stillIn(game).filter((t) => isTraitor(game, t));
  if (!game.scores[id]) return 0.3 + rng(game, "guess", game.day, id)() * 0.6;
  return traitors.reduce((sum, t) => sum + game.scores[id][t], 0);
}

// Who the Traitors would murder tonight, most wanted first. Not whoever
// won today's mission shield: everyone knows who has it.
// After Catapults, only someone who was hit can be murdered (Sam).
export function murderIdeas(game) {
  const up = game.upForMurder && game.upForMurder.day === game.history.length ? game.upForMurder.ids : null;
  const ok = (id) => !isTraitor(game, id) && !hasShield(game, id);
  const pool = stillIn(game).filter((id) => ok(id) && (!up || up.includes(id)));
  return (pool.length ? pool : stillIn(game).filter(ok))
    .sort((a, b) => threat(game, b) - threat(game, a) || (a < b ? -1 : 1));
}

// The night: the Traitors murder a Faithful. If Sam is a Traitor still in
// the game, he picks (`playerPick`); otherwise the computer Traitors pick
// the most dangerous Faithful. Returns the murdered player's id.
export function night(game, playerPick = null) {
  const samPicks = humanTraitorIn(game);
  const victim = samPicks && playerPick ? playerPick : murderIdeas(game)[0];
  if (isTraitor(game, victim)) throw new Error("Traitors can't murder a Traitor");
  if (hasShield(game, victim)) throw new Error("they have a shield");
  game.shields = [];   // a shield lasts one night
  player(game, victim).inGame = false;
  game.history[game.history.length - 1].murdered = victim;
  return victim;
}

// Breakfast: everyone still in arrives in little groups of 2 or 3, in a
// seeded order. The murdered one never comes.
export function breakfastGroups(game) {
  const people = stillIn(game);
  const r = rng(game, "breakfast", game.day);
  for (let i = people.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [people[i], people[j]] = [people[j], people[i]];
  }
  const groups = [];
  while (people.length > 0) {
    // Groups of 2 or 3, never leaving someone to walk in alone.
    const n = people.length;
    const size = n <= 3 ? n : n === 4 ? 2 : n === 5 ? (r() < 0.5 ? 2 : 3) : r() < 0.5 ? 2 : 3;
    groups.push(people.splice(0, size));
  }
  return groups;
}

// ─── Round Table talk (Gareth, 2026-10-24: "some conversation with options
// for us to join in during the round table before we all vote") ──────────

// Who someone is about to accuse at the Round Table: the name they'd give
// if you asked who they'll vote for.
function accuses(game, id) {
  return answer(game, id, "vote", null).names[0];
}

// Today's talk before the vote: two or three people accuse someone (often
// with a reason, sometimes a real clue from yesterday's votes), the accused
// answer back, and others chime in. Everyone talks in their own way.
// Returns [{ speaker, text, names }]; an accusation names exactly one person.
export const TALK_CHIME = 0.25;
export function tableTalk(game) {
  const r = rng(game, "talk", game.day);
  const speakers = brains(game);
  for (let i = speakers.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [speakers[i], speakers[j]] = [speakers[j], speakers[i]];
  }
  const last = game.history[game.history.length - 1];
  const why = (target) => {
    // A real reason if they voted out a Faithful yesterday.
    const voted = last && last.side === FAITHFUL && last.votes.some(([v, t]) => v === target && t === last.banished);
    if (voted && r() < 0.7) return `They voted out ${nameOf(last.banished)}, and ${nameOf(last.banished)} was a Faithful!`;
    return pickOne([
      "They went really quiet when the Traitors came up.",
      "I saw them sneaking about by the stairs last night.",
      "They keep changing who they suspect.",
      "They were whispering in the library.",
      "They looked very nervous at breakfast.",
      "They said a name, then voted for someone else!",
      "", "",
    ], r);
  };
  const accuse = [
    (n) => `I've been watching ${n}. I think they're a Traitor!`,
    (n) => `It's ${n}! I just know it.`,
    (n) => `${n} has been acting really sneaky...`,
    (n) => `I'm sorry, but I don't trust ${n}.`,
    (n) => `Can we talk about ${n}?`,
    (n) => `My vote's going to ${n}, and here's why.`,
  ];
  const defend = [
    "That's not fair! I'm a Faithful!",
    "Me? No way! You've got it all wrong!",
    "I'm Faithful, I promise! Look somewhere else!",
    "How can you say that? I've been helping everyone!",
    "You're only saying that because you're a Traitor!",
    "Rubbish! Total rubbish!",
  ];
  const chime = [
    (n) => `I agree. Something's odd about ${n}.`,
    (n) => `Hold on, I don't think it's ${n}.`,
    (n) => `${n}? Really? I'm not sure...`,
    (n) => `Yes! I've been thinking that about ${n} too!`,
  ];
  const talk = [];
  const accused = [];
  const used = new Set();
  // Two accusations, and only sometimes someone joins in (Gareth: the talk
  // went on a bit too long, 2026-10-29).
  const wanted = 2;
  for (const s of speakers) {
    if (accused.length === wanted) break;
    const target = accuses(game, s);
    if (target === undefined || accused.includes(target) || accused.includes(s) || used.has(s)) continue;
    accused.push(target);
    used.add(s);
    const reason = why(target);
    talk.push({ speaker: s, text: inCharacter(s, `${pickOne(accuse, r)(nameOf(target))} ${reason}`.trim(), r), names: [target] });
    if (!isHuman(game, target)) {   // a real player answers for themselves
      used.add(target);
      talk.push({ speaker: target, text: inCharacter(target, pickOne(defend, r), r), names: [] });
    }
    // Sometimes someone else joins in.
    if (r() < TALK_CHIME) {
      const other = speakers.find((o) => !used.has(o) && o !== target);
      if (other) {
        used.add(other);
        talk.push({ speaker: other, text: inCharacter(other, pickOne(chime, r)(nameOf(target)), r), names: [] });
      }
    }
  }
  return talk;
}

// What Sam can say at the Round Table: four choices, picked at random each
// day from lots of kinds (Gareth: "more random options"): agree with an
// accusation, stick up for someone, stick up for himself, point at someone
// nobody has mentioned, ask someone a hard question, calm everyone down, or
// stay quiet. Staying quiet is risky (Gareth): people get suspicious.
export function talkOptions(game, talk) {
  const me = game.playerId;
  const accused = talk.filter((t) => t.names.length > 0).map((t) => t.names[0]);
  const r = rng(game, "options", game.day);
  const others = stillIn(game).filter((id) => id !== me && !accused.includes(id));
  const someone = () => others.splice(Math.floor(r() * others.length), 1)[0];
  const pool = [];
  for (const a of accused.filter((a) => a !== me)) {
    const n = nameOf(a);
    pool.push({ kind: "accuse", target: a, text: pickOne([
      `I agree. It's ${n}!`, `I've had my eye on ${n} too.`, `${n} is a Traitor. I'm sure of it!`,
      `Yes! ${n} has been so sneaky.`, `${n}, you're not fooling me!`, `I saw ${n} whispering. Very suspicious!`,
    ], r) });
    pool.push({ kind: "defend", target: a, text: pickOne([
      `Leave ${n} alone. I trust them.`, `I don't think it's ${n}.`, `${n} has been helpful all day. It's not them.`,
      `${n}? No way. Look somewhere else.`, `I'd bet my socks ${n} is Faithful.`,
    ], r) });
  }
  if (others.length) {
    const n = nameOf(someone());
    const target = stillIn(game).find((id) => nameOf(id) === n);
    pool.push({ kind: "accuse", target, text: pickOne([
      `Nobody's talking about ${n}. Why so quiet, ${n}?`, `What about ${n}? I've got a funny feeling.`,
      `${n} keeps changing their story. I don't like it.`,
    ], r) });
  }
  if (others.length) {
    const target = someone();
    const n = nameOf(target);
    pool.push({ kind: "question", target, text: pickOne([
      `${n}, who did you vote for yesterday? And why?`, `${n}, where were you last night?`,
      `${n}, look me in the eye. Are you a Traitor?`,
    ], r) });
  }
  pool.push({ kind: "calm", target: null, text: pickOne([
    "Everyone calm down! Let's think about this.", "Can we all just take a deep breath?",
    "Let's look at the votes, not just shout names.",
  ], r) });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = [];
  if (accused.includes(me)) {
    options.push({ kind: "defend", target: me, text: pickOne([
      "I'm a Faithful! It's not me!", "Me? I've been trying to catch the Traitors all day!",
      "Check my votes! I'm Faithful!", "You've got the wrong person. I promise!",
    ], r) });
  }
  // At least one accusation, then whatever came up.
  const firstAccuse = pool.find((o) => o.kind === "accuse");
  if (firstAccuse) options.push(firstAccuse);
  for (const o of pool) if (options.length < 3 && !options.includes(o)) options.push(o);
  options.push({ kind: "quiet", target: null, text: pickOne([
    "Stay quiet and watch...", "Say nothing. Just listen.", "Keep my thoughts to myself.",
  ], r) });
  return options;
}

// What Sam says changes what the honest players think. Returns a reply
// someone makes straight away, or null.
export const TALK_SWAY = 0.12;
export const QUIET_RISK = 0.1;
export function playerSays(game, option, me = game.playerId) {
  const honest = brains(game).filter((b) => !isTraitor(game, b));
  const r = rng(game, "says", game.day, option.kind);
  const nudge = (who, by) => {
    for (const b of honest) if (b !== who) game.scores[b][who] = Math.max(0, game.scores[b][who] + by);
  };
  switch (option.kind) {
    case "accuse":
      nudge(option.target, TALK_SWAY);
      if (game.scores[option.target]) game.scores[option.target][me] += 0.15;
      return null;
    case "question":
      nudge(option.target, TALK_SWAY / 2);
      if (game.scores[option.target]) game.scores[option.target][me] += 0.08;
      return { speaker: option.target, names: [], text: inCharacter(option.target, pickOne([
        "Why are you asking ME? Ask someone else!", "That's none of your business!",
        "I... erm... I don't remember.", "I'm Faithful! How many times?",
      ], r), r) };
    case "defend":
      if (option.target === me) nudge(me, -TALK_SWAY / 2);
      else nudge(option.target, -TALK_SWAY);
      return null;
    case "calm":
      nudge(me, -0.04);
      return null;
    case "quiet": {
      // Silence is suspicious: someone says so.
      nudge(me, QUIET_RISK);
      const speaker = pickOne(brains(game), r);
      const n = nameOf(me);
      return { speaker, names: [me], text: inCharacter(speaker, pickOne([
        `You've gone very quiet, ${n}...`, `Nothing to say, ${n}? Interesting.`,
        `Why so quiet, ${n}? Traitors keep quiet, you know.`, `Hmm. ${n} isn't saying much today.`,
      ], r), r) };
    }
  }
  return null;
}

// ─── Recruiting (Sam, 2026-10-24) ───────────────────────────────────────────
// On the first night the Traitors don't murder anyone: they recruit a
// fourth Traitor. If Sam is a Traitor he picks (the others suggest); if
// not, the computer Traitors pick, and they might pick Sam, who then just
// becomes a Traitor (Sam: "Yes, no choice"). Whoever is picked says yes.

// What happens tonight (after the day just finished). Sam and Gareth,
// 2026-10-25: the Traitors murder most nights; a few nights have no
// murder, and that's announced at breakfast so everyone knows. Still 12
// days: a night goes quiet whenever another murder would leave too few
// people for the final (about FINAL_SIZE), plus a couple at random.
// Whenever only 2 Traitors (or fewer) are left, they may recruit instead,
// any night.
//   "recruit": night 1 (always recruits);
//   "choose": 2 or fewer Traitors: recruit, or murder (unless it's quiet);
//   "murder" / "quiet"; "done": tonight has already happened.
export const FINAL_SIZE = 5;
export const RANDOM_QUIET_NIGHTS = 2;
function randomQuiet(game) {
  const r = rng(game, "quiet-nights");
  const nights = [];
  while (nights.length < RANDOM_QUIET_NIGHTS) {
    const n = 2 + Math.floor(r() * (DAYS - 2));
    if (!nights.includes(n)) nights.push(n);
  }
  return nights;
}
// Is night `n` a no-murder night, with `left` people in after that day's
// banishing? (At breakfast, Sam's told with left = everyone - 1.)
export function quietTonight(game, n, left) {
  if (n < 2 || n >= DAYS) return false;
  if (game.upForMurder && game.upForMurder.day === n) return false;   // Catapults day (Sam)
  const tooFew = left - 1 - (DAYS - n) < FINAL_SIZE;
  return tooFew || randomQuiet(game).includes(n);
}
// For breakfast: will tonight (after today's banishing) be murder-free?
// `missionId`: today's mission; Catapults always brings a murder (Sam), so
// it's never a no-murder day (the morning used to say so, then the castle
// changed its mind after the mission: Sam's bug report, 2026-10-29).
export const noMurderToday = (game, missionId = null) =>
  missionId !== "catapults" && quietTonight(game, game.day, stillIn(game).length - 1);
export function nightKind(game) {
  const last = game.history[game.history.length - 1];
  if (last.recruited || last.murdered || last.quiet) return "done";
  const n = game.history.length;
  if (n === 1) return "recruit";
  const traitors = stillIn(game).filter((id) => isTraitor(game, id)).length;
  if (traitors <= 2) return "choose";
  return quietTonight(game, n, stillIn(game).length) ? "quiet" : "murder";
}
// On a "choose" night: can they murder (not on a quiet night)?
export const canMurderTonight = (game) => !quietTonight(game, game.history.length, stillIn(game).length);
// What the computer Traitors choose on a "choose" night: recruit if they're
// down to one, or if they can't murder anyway; with two, now and then.
export const RECRUIT_WITH_TWO = 0.35;
export function computerChoice(game) {
  const traitors = stillIn(game).filter((id) => isTraitor(game, id)).length;
  if (traitors <= 1 || !canMurderTonight(game)) return "recruit";
  return rng(game, "choose", game.day)() < RECRUIT_WITH_TWO ? "recruit" : "murder";
}
export const isRecruitNight = (game) => nightKind(game) === "recruit" || nightKind(game) === "choose";

// A quiet night: nobody is murdered, and the shield wears off.
export function quietNight(game) {
  game.shields = [];
  game.history[game.history.length - 1].quiet = true;
}

// Who the Traitors would like to recruit, best first: Faithfuls nobody
// suspects much, so the new Traitor blends in.
export function recruitIdeas(game) {
  const honest = brains(game).filter((id) => !isTraitor(game, id));
  const suspicion = (f) => honest.reduce((sum, h) => sum + (h === f ? 0 : game.scores[h][f]), 0);
  return stillIn(game)
    .filter((id) => !isTraitor(game, id))
    .sort((a, b) => suspicion(a) - suspicion(b) || (a < b ? -1 : 1));
}

// Recruit `pick` (Sam's choice when he's a Traitor) or the Traitors' first
// idea. The new Traitor's list turns fake, like the others'. Returns who.
export function recruit(game, pick = null) {
  const samPicks = humanTraitorIn(game);
  const who = samPicks && pick ? pick : recruitIdeas(game)[0];
  if (isTraitor(game, who)) throw new Error("already a Traitor");
  player(game, who).side = TRAITOR;
  if (who === game.playerId) game.playerSide = TRAITOR;
  const s = game.scores[who];
  if (s) {
    const r = rng(game, "recruit", who);
    for (const o of Object.keys(s)) {
      if (isTraitor(game, o)) s[o] = 0.05 + r() * 0.3;
      else s[o] = Math.max(s[o], 0.2 + r() * 0.6);
    }
  }
  game.recruited = who;
  game.shields = [];
  game.history[game.history.length - 1].recruited = who;
  return who;
}

// ─── Joining someone else's chat (Gareth, 2026-10-24: "you should be able
// to join in their conversations (but maybe they dont want you to!)") ─────

// Sam walks up to `a` and `b` chatting. Returns { speaker, text, names,
// welcome }. Two Traitors together get shifty and send Sam away (a clue!),
// unless Sam is a Traitor too, when they let him in on the plan. Anyone else
// usually shares what they were saying, but sometimes wants privacy too, so
// being sent away isn't proof.
export function joinChat(game, a, b) {
  const r = rng(game, "join", game.day, [a, b].sort().join("+"));
  const bothTraitors = isTraitor(game, a) && isTraitor(game, b);
  const say = (speaker, text, names = [], welcome = true) => ({ speaker, text, names, welcome });
  if (bothTraitors) {
    if (game.playerSide === TRAITOR) {
      const target = traitorTarget(game);
      return say(a, `Psst! Get in here. We're all blaming ${nameOf(target)} today.`, [target]);
    }
    return say(a, inCharacter(a, pickOne([
      "Oh! Erm... nothing! We weren't talking about anything!",
      "Go away! This is a private chat!",
      "Shh! Someone's coming!",
      "We were just... talking about the weather. Yes. The weather.",
      "Nothing to see here! Off you pop!",
    ], r), r), [], false);
  }
  if (r() < 0.25) {
    return say(a, inCharacter(a, pickOne([
      "Sorry, this is a private chat. Come back later!",
      "Not now, please. We're busy.",
      "Can you give us a minute?",
    ], r), r), [], false);
  }
  const speaker = r() < 0.5 ? a : b;
  const pick = suspectList(game, speaker)[0];
  if (pick === game.playerId) {
    return say(speaker, inCharacter(speaker, pickOne([
      "Oh! Erm... we were just talking about you, actually...",
      "Oh, hello. Funny, we were just saying your name.",
      "Ah. Awkward. We were talking about you.",
    ], r), r), [pick]);
  }
  const n = nameOf(pick);
  return say(speaker, inCharacter(speaker, pickOne([
    `Come and join us! We were saying ${n} is acting really sneaky.`,
    `Hello! We think it's ${n}. What do you think?`,
    `Pull up a chair! We've been watching ${n}.`,
    `Just in time! We were talking about ${n}.`,
  ], r), r), [pick]);
}

// ─── Who's who (Gareth: a pause button showing everyone, and whether the
// ones who've gone were Traitors or Faithfuls) ──────────────────────────────
// What Sam knows about everyone: who has gone and how, what side they were
// (banished people are revealed; the murdered were always Faithful), Sam's
// own side, his fellow Traitors if he is one, and who has the shield.
export function whosWho(game) {
  const how = {};
  for (const h of game.history) {
    if (h.banished) how[h.banished] = "banished";
    if (h.murdered) how[h.murdered] = "murdered";
  }
  const samTraitor = game.playerSide === TRAITOR;
  // Out of the game: you may see everyone's side now (Gareth).
  const out = !player(game, game.playerId).inGame;
  return game.players.map((p) => {
    const gone = how[p.id] ?? null;
    let side = null;
    if (gone || out) side = p.side;
    else if (p.id === game.playerId) side = game.playerSide;
    else if (samTraitor && p.side === TRAITOR) side = TRAITOR;
    return { id: p.id, gone, side, you: p.id === game.playerId, shield: hasShield(game, p.id), dagger: hasDagger(game, p.id) };
  });
}
