// A day at the castle: who suspects whom, what people say when you chat,
// and the Round Table vote. Pure: no page, no timers. Every "random" choice
// comes from the game's seed, so the same game always plays the same way
// (docs/castle-spec.md).

import { CHARACTERS } from "./characters.js";
import { makeRandom, FAITHFUL, TRAITOR } from "./game.js";

export const QUESTIONS = [
  { id: "list", text: "Show me your list" },
  { id: "suspect", text: "Who do you suspect?" },
  { id: "traitor", text: "Are you a Traitor?" },
  { id: "vote", text: "Who will you vote for?" },
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
  switch (question) {
    case "list": {
      const names = list.slice(0, LIST_LENGTH);
      return say("Here's my list of who might be a Traitor:", names);
    }
    case "suspect": {
      // A Traitor sometimes names someone who isn't top of their own list:
      // a little fib you can catch by asking for their list too.
      const pick = sneaky && r() < 0.4 ? list[1 + Math.floor(r() * (LIST_LENGTH - 1))] : list[0];
      return say(`I think it's ${nameOf(pick)}.`, [pick]);
    }
    case "traitor": {
      // Everyone says no. Traitors are much quicker to blame someone else.
      if (r() < (sneaky ? 0.7 : 0.25)) {
        const blamed = sneaky ? traitorTarget(game) : list[0];
        return say(`No! But keep an eye on ${nameOf(blamed)}...`, [blamed]);
      }
      return say(r() < 0.5 ? "No way! I'm a Faithful." : "Me? No! I'm Faithful, I promise.");
    }
    case "vote": {
      const pick = promisedVote(game, id);
      return say(`I'll vote for ${nameOf(pick)}.`, [pick]);
    }
  }
  throw new Error(`no question "${question}"`);
}

// Who `id` says they'll vote for. Traitors fib about half the time: they
// promise one name and then vote with the other Traitors.
export function promisedVote(game, id) {
  if (!isTraitor(game, id)) return suspectList(game, id)[0];
  const r = rng(game, "promise", game.day, id);
  const target = traitorTarget(game);
  if (r() < 0.5) return target;
  const others = suspectList(game, id).filter((o) => o !== target && !isTraitor(game, o));
  return others[Math.floor(r() * Math.min(LIST_LENGTH, others.length))] ?? target;
}

// How a computer player really votes. Traitors usually gang up on today's
// target, but not always: a Traitor who always votes with the others is
// too easy to spot.
export const TRAITOR_TEAM_VOTE = 0.6;
export function computerVote(game, id) {
  if (!isTraitor(game, id)) return suspectList(game, id)[0];
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

// Who has won, if anyone: every Traitor caught, or Traitors as many as
// Faithfuls. Null while the game goes on.
export function winner(game) {
  const left = stillIn(game);
  const traitors = left.filter((id) => isTraitor(game, id)).length;
  if (traitors === 0) return FAITHFUL;
  if (traitors >= left.length - traitors) return TRAITOR;
  return null;
}
