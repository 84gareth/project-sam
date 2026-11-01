// The game's rules. Pure: no page, no timers, so tests can run whole games.

import { CHARACTERS } from "./characters.js";

export const TRAITOR_COUNT = 3;
export const FAITHFUL = "faithful";
export const TRAITOR = "traitor";
// Every game lasts 12 days, like the TV show (Sam and Gareth, 2026-10-24).
export const DAYS = 12;

// A small seeded random number generator (mulberry32): the same seed always
// gives the same game, so tests are repeatable. Returns floats in [0, 1).
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A new game: you play `playerId`; everyone else is computer controlled.
// The game deals exactly TRAITOR_COUNT Traitors fairly among all 22, so you
// are a Traitor about 3 games in 22 (Sam: "fair chance", 2026-10-24). You
// find out after picking your character; you don't choose.
// `humans`: every real player (Phase 8 multiplayer); single player is just
// `playerId`. `playerId` is who's playing on this device.
export function newGame(playerId, seed = Date.now(), humans = null) {
  if (!CHARACTERS.some((c) => c.id === playerId)) throw new Error(`no character "${playerId}"`);
  const random = makeRandom(seed);
  const everyone = CHARACTERS.map((c) => c.id);
  // Shuffle everyone (Fisher-Yates) and take the first few as Traitors.
  for (let i = everyone.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [everyone[i], everyone[j]] = [everyone[j], everyone[i]];
  }
  const traitors = everyone.slice(0, TRAITOR_COUNT);
  return {
    seed,
    playerId,
    playerSide: traitors.includes(playerId) ? TRAITOR : FAITHFUL,
    ...(humans ? { humans } : {}),
    players: CHARACTERS.map((c) => ({
      id: c.id,
      side: traitors.includes(c.id) ? TRAITOR : FAITHFUL,
      inGame: true,
    })),
  };
}
