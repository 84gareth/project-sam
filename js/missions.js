// Missions: one a day, before the castle (docs/missions.md). Pure: no page,
// no timers. Sam plays; everyone else scores from their skill plus luck.
// The team's scores fill the prize pot, and the best player wins the shield,
// so the Traitors can't murder them that night.

import { makeRandom } from "./game.js";

// All 13 of Sam's missions. `built` ones can be played so far.
export const MISSIONS = [
  { id: "bells", name: "Castle Bells", type: "memory", built: true,
    how: "Listen to the bells. Then ring them back in the same order!" },
  { id: "pies", name: "Chilli Pie Shuffle", type: "memory", built: true,
    how: "Watch Chef Pepper's chilli pie. Then find it after the shuffle!" },
  { id: "where", name: "Who Was Where?", type: "memory", built: false },
  { id: "jumble", name: "Letter Jumble", type: "puzzle", built: false },
  { id: "code", name: "Secret Code", type: "puzzle", built: false },
  { id: "maze", name: "Garden Maze", type: "puzzle", built: false },
  { id: "keys", name: "Lost Keys", type: "hunting", built: false },
  { id: "footprints", name: "Muddy Footprints", type: "hunting", built: false },
  { id: "portraits", name: "Portrait Gallery", type: "hunting", built: false },
  { id: "treasure", name: "Treasure Hunt", type: "hunting", built: false },
  { id: "cooking", name: "Cooking Challenge", type: "puzzle", built: false },
  { id: "catapults", name: "Catapults", type: "hunting", built: false },
  { id: "lights", name: "Lights Out", type: "puzzle", built: false },
];
export const DAYS = 12;

// Who is good (+1) or bad (-1) at each type, from their personality.
// Anyone not listed is normal (0).
export const SKILLS = {
  puddle: { hunting: 1, memory: -1 },
  gumdrop: { memory: 1, hunting: -1 },
  fizz: { puzzle: 1 },
  ruby: { memory: 1 },
  pepper: { hunting: 1 },
  waffle: { puzzle: -1 },
  plaster: { puzzle: 1 },
  lola: { memory: 1, puzzle: -1 },
  fern: { hunting: 1 },
  dot: { puzzle: 1, hunting: 1 },
  benny: { memory: -1 },
  mystic: { memory: 1 },
  tom: { hunting: 1 },
  zara: { hunting: 1, puzzle: -1 },
  grumble: { hunting: -1 },
  penny: { hunting: 1 },
  kick: { puzzle: -1 },
  stan: { memory: 1 },
  ivy: { puzzle: 1 },
  max: { memory: -1, hunting: -1 },
  olive: { puzzle: 1 },
  barry: { memory: -1 },
};

const POT_PER_MISSION = 10000;

function rng(game, ...parts) {
  let h = game.seed >>> 0;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return makeRandom(h);
}

// The missions this game plays, in order (a seeded shuffle of the built
// ones; with 13 built, 12 of them).
export function missionOrder(game) {
  const pool = MISSIONS.filter((m) => m.built);
  const r = rng(game, "missions");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DAYS);
}

export function todaysMission(game) {
  const order = missionOrder(game);
  return order[(game.day - 1) % order.length];
}

// A computer player's score today, 0 to 1: skill plus luck.
export function computerScore(game, id, mission) {
  const skill = SKILLS[id]?.[mission.type] ?? 0;
  const luck = rng(game, "score", game.day, id)();
  return Math.min(1, Math.max(0, 0.5 + skill * 0.25 + (luck - 0.5) * 0.5));
}

// Finish today's mission with Sam's score (0 to 1). Everyone still in gets
// a score; the pot grows; the best player wins the shield.
// Returns { mission, scores: [[id, score]] best first, won, shield }.
export function finishMission(game, samScore, stillIn) {
  const mission = todaysMission(game);
  const scores = stillIn.map((id) => [id, id === game.playerId ? samScore : computerScore(game, id, mission)]);
  scores.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const average = scores.reduce((sum, [, s]) => sum + s, 0) / scores.length;
  const won = Math.round((average * POT_PER_MISSION) / 500) * 500;
  game.pot = (game.pot ?? 0) + won;
  game.shield = scores[0][0];
  return { mission, scores, won, shield: game.shield };
}

// ─── Castle Bells ───────────────────────────────────────────────────────────
// Four bells. Rounds of 3, 4, 5, 6 and 7 rings, each the start of one long
// tune. One mistake ends it.
export const BELLS = 4;
export const BELL_ROUNDS = [3, 4, 5, 6, 7];
export function bellTune(game) {
  const r = rng(game, "bells", game.day);
  return Array.from({ length: BELL_ROUNDS[BELL_ROUNDS.length - 1] }, () => Math.floor(r() * BELLS));
}
export const bellScore = (roundsDone) => roundsDone / BELL_ROUNDS.length;

// ─── Chilli Pie Shuffle ─────────────────────────────────────────────────────
// Three pies; the chilli pie starts in a random place. Each round has more
// swaps, and they go faster. Where it ends up is the answer.
export const PIE_ROUNDS = [{ swaps: 3, speed: 600 }, { swaps: 5, speed: 450 }, { swaps: 8, speed: 320 }];
export function pieRound(game, round) {
  const r = rng(game, "pies", game.day, round);
  const start = Math.floor(r() * 3);
  const swaps = [];
  for (let i = 0; i < PIE_ROUNDS[round].swaps; i++) {
    const a = Math.floor(r() * 3);
    const b = (a + 1 + Math.floor(r() * 2)) % 3;
    swaps.push([a, b]);
  }
  return { start, swaps, speed: PIE_ROUNDS[round].speed, answer: pieAfter(start, swaps) };
}
// Where the chilli pie is after the swaps (swapping the places a and b).
export function pieAfter(start, swaps) {
  let at = start;
  for (const [a, b] of swaps) {
    if (at === a) at = b;
    else if (at === b) at = a;
  }
  return at;
}
export const pieScore = (right) => right / PIE_ROUNDS.length;
