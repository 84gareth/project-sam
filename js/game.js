// The game's rules. Pure: no page, no timers, so tests can run whole games.

import { CHARACTERS } from "./characters.js";

export const TRAITOR_COUNT = 3;
export const FAITHFUL = "faithful";
export const TRAITOR = "traitor";

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

// A new game: you play `playerId` on `side`. Everyone else is computer
// controlled. Exactly TRAITOR_COUNT Traitors, counting you if you chose
// Traitor.
export function newGame(playerId, side, seed = Date.now()) {
  if (!CHARACTERS.some((c) => c.id === playerId)) throw new Error(`no character "${playerId}"`);
  if (side !== FAITHFUL && side !== TRAITOR) throw new Error(`no side "${side}"`);
  const random = makeRandom(seed);
  const others = CHARACTERS.map((c) => c.id).filter((id) => id !== playerId);
  // Shuffle the others (Fisher-Yates) and take the first few as Traitors.
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const traitors = side === TRAITOR
    ? [playerId, ...others.slice(0, TRAITOR_COUNT - 1)]
    : others.slice(0, TRAITOR_COUNT);
  return {
    seed,
    playerId,
    playerSide: side,
    players: CHARACTERS.map((c) => ({
      id: c.id,
      side: traitors.includes(c.id) ? TRAITOR : FAITHFUL,
      inGame: true,
    })),
  };
}
