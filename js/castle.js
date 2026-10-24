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
    if (me.id === game.playerId && !everyone) continue;
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
export function answer(game, id, question) {
  const r = rng(game, "answer", game.day, id, question);
  const list = suspectList(game, id);
  const sneaky = isTraitor(game, id);
  const say = (text, names = []) => ({ text, names });
  // Sam is a Traitor talking to another Traitor: no fibs between them, just
  // sneaky whispers (Gareth, 2026-10-24).
  if (sneaky && game.playerSide === TRAITOR && id !== game.playerId) {
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
// by the computer). Everyone votes in seat order; the most votes leaves;
// a tie is settled by a seeded coin. Then everyone learns from the votes.
export function roundTable(game, playerVote) {
  const voters = stillIn(game);
  const votes = voters.map((v) => [v, game.scores[v] ? computerVote(game, v) : playerVote]);
  const counts = {};
  for (const [, t] of votes) counts[t] = (counts[t] || 0) + 1;
  const top = Math.max(...Object.values(counts));
  const tied = Object.keys(counts).filter((id) => counts[id] === top).sort();
  const banished = tied[Math.floor(rng(game, "tie", game.day)() * tied.length)];
  const side = player(game, banished).side;
  player(game, banished).inGame = false;
  const result = { day: game.day, votes, counts, banished, side };
  game.history.push(result);
  learn(game, result);
  game.day += 1;
  return result;
}

// After the reveal, honest players change their minds:
// - voted for someone who turned out Faithful: more suspicious;
// - voted for a Traitor who was caught: less suspicious;
// - voted for ME: a bit more suspicious (people suspect their accusers).
// Traitors keep their fake lists, with a little shuffle so they look alive.
export const LEARN_WRONG_VOTE = 0.12;
export const LEARN_NOISE = 0.15;
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
    for (const o of Object.keys(s)) s[o] = Math.min(2, Math.max(0, s[o] + (r() - 0.5) * LEARN_NOISE));
  }
}

// Who has won, if anyone. The game always lasts 12 days (Sam): it ends
// early only if every Traitor is caught. After day 12's Round Table, any
// Traitor still in wins; if none, the Faithfuls do. Null while it goes on.
export function winner(game) {
  const left = stillIn(game);
  const traitors = left.filter((id) => isTraitor(game, id)).length;
  if (traitors === 0) return FAITHFUL;
  if (traitors === left.length) return TRAITOR;   // no Faithfuls left (a safety net)
  if (game.day > DAYS) return TRAITOR;
  return null;
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
  const ok = (id) => !isTraitor(game, id) && id !== game.shield;
  const pool = stillIn(game).filter((id) => ok(id) && (!up || up.includes(id)));
  return (pool.length ? pool : stillIn(game).filter(ok))
    .sort((a, b) => threat(game, b) - threat(game, a) || (a < b ? -1 : 1));
}

// The night: the Traitors murder a Faithful. If Sam is a Traitor still in
// the game, he picks (`playerPick`); otherwise the computer Traitors pick
// the most dangerous Faithful. Returns the murdered player's id.
export function night(game, playerPick = null) {
  const samPicks = game.playerSide === TRAITOR && player(game, game.playerId).inGame;
  const victim = samPicks && playerPick ? playerPick : murderIdeas(game)[0];
  if (isTraitor(game, victim)) throw new Error("Traitors can't murder a Traitor");
  if (victim === game.shield) throw new Error("they have the shield");
  game.shield = null;   // a shield lasts one night
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
  return answer(game, id, "vote").names[0];
}

// Today's talk before the vote: two or three people accuse someone (often
// with a reason, sometimes a real clue from yesterday's votes), the accused
// answer back, and others chime in. Everyone talks in their own way.
// Returns [{ speaker, text, names }]; an accusation names exactly one person.
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
  const wanted = 2 + (r() < 0.5 ? 1 : 0);
  for (const s of speakers) {
    if (accused.length === wanted) break;
    const target = accuses(game, s);
    if (target === undefined || accused.includes(target) || accused.includes(s) || used.has(s)) continue;
    accused.push(target);
    used.add(s);
    const reason = why(target);
    talk.push({ speaker: s, text: inCharacter(s, `${pickOne(accuse, r)(nameOf(target))} ${reason}`.trim(), r), names: [target] });
    if (target !== game.playerId) {
      used.add(target);
      talk.push({ speaker: target, text: inCharacter(target, pickOne(defend, r), r), names: [] });
    }
    // Sometimes someone else joins in.
    if (r() < 0.5) {
      const other = speakers.find((o) => !used.has(o) && o !== target);
      if (other) {
        used.add(other);
        talk.push({ speaker: other, text: inCharacter(other, pickOne(chime, r)(nameOf(target)), r), names: [] });
      }
    }
  }
  return talk;
}

// What Sam can say: agree with an accusation, stick up for someone, or stay
// quiet. If Sam was accused, he can defend himself.
export function talkOptions(game, talk) {
  const accused = talk.filter((t) => t.names.length > 0).map((t) => t.names[0]);
  const options = [];
  const r = rng(game, "options", game.day);
  for (const a of accused.slice(0, 2)) {
    if (a === game.playerId) {
      options.push({ kind: "defend", target: a, text: pickOne(["I'm a Faithful! It's not me!", "Me? I've been trying to catch the Traitors all day!", "Check my votes! I'm Faithful!"], r) });
    } else {
      const n = nameOf(a);
      options.push({ kind: "accuse", target: a, text: pickOne([`I agree. It's ${n}!`, `I've had my eye on ${n} too.`, `${n} is a Traitor. I'm sure of it!`, `Yes! ${n} has been so sneaky.`], r) });
    }
  }
  const other = accused.find((a) => a !== game.playerId);
  if (other) {
    const n = nameOf(other);
    options.push({ kind: "defend", target: other, text: pickOne([`Leave ${n} alone. I trust them.`, `I don't think it's ${n}.`, `${n} has been helpful all day. It's not them.`], r) });
  }
  options.push({ kind: "quiet", target: null, text: pickOne(["Stay quiet and watch...", "Say nothing. Just listen.", "Keep my thoughts to myself."], r) });
  return options.slice(0, 4);
}

// Sam speaks. Honest players listen a little: an accusation makes them
// more suspicious of that person, sticking up for someone less. The one Sam
// accused starts to suspect Sam back.
export const TALK_SWAY = 0.12;
export function playerSays(game, option) {
  if (option.kind === "quiet") return;
  for (const b of brains(game)) {
    if (isTraitor(game, b) || b === option.target) continue;
    const s = game.scores[b];
    if (option.target === game.playerId) continue;
    s[option.target] = Math.max(0, s[option.target] + (option.kind === "accuse" ? TALK_SWAY : -TALK_SWAY));
  }
  if (option.kind === "accuse" && game.scores[option.target]) {
    game.scores[option.target][game.playerId] += 0.15;
  }
}

// ─── Recruiting (Sam, 2026-10-24) ───────────────────────────────────────────
// On the first night the Traitors don't murder anyone: they recruit a
// fourth Traitor. If Sam is a Traitor he picks (the others suggest); if
// not, the computer Traitors pick, and they might pick Sam, who then just
// becomes a Traitor (Sam: "Yes, no choice"). Whoever is picked says yes.

// What happens tonight (after the day just finished):
// - "recruit": night 1, and any night up to night 5 when only 2 Traitors
//   are left (Sam; Gareth chose night 5, so they can still all be caught:
//   up to night 8, Faithfuls won only ~15% of games);
// - "murder": every other night (nights 2, 4, 6...), so 12 days fit;
// - "quiet": the Traitors only plot;
// - "done": tonight has already happened.
export const RECRUIT_UNTIL = 5;
export function nightKind(game) {
  const last = game.history[game.history.length - 1];
  if (last.recruited || last.murdered || last.quiet) return "done";
  const n = game.history.length;
  const traitors = stillIn(game).filter((id) => isTraitor(game, id)).length;
  if (n === 1 || (traitors <= 2 && n <= RECRUIT_UNTIL)) return "recruit";
  if (game.upForMurder && game.upForMurder.day === n) return "murder";   // Catapults day (Sam)
  return n % 2 === 0 ? "murder" : "quiet";
}
export const isRecruitNight = (game) => nightKind(game) === "recruit";

// A quiet night: nobody is murdered, and the shield wears off.
export function quietNight(game) {
  game.shield = null;
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
  const samPicks = game.playerSide === TRAITOR && player(game, game.playerId).inGame;
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
  game.shield = null;
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
