// Saving (Gareth, 2026-10-25): the game remembers the day you got to, so a
// reload doesn't lose a 12-day game. Saved in this browser only, at the
// start of each day. Pure apart from the browser storage, which can be
// missing or full (private browsing), so every use is guarded.

export const SAVE_KEY = "project-sam-save";
export const SAVE_VERSION = 1;

// The game as text, and back. Anything odd comes back as null.
export function packGame(game) {
  return JSON.stringify({ v: SAVE_VERSION, game });
}
export function unpackGame(text) {
  try {
    const data = JSON.parse(text);
    const g = data && data.v === SAVE_VERSION ? data.game : null;
    if (!g || !Array.isArray(g.players) || !Array.isArray(g.history) || !g.scores || !g.playerId || !(g.day >= 1)) return null;
    return g;
  } catch {
    return null;
  }
}

export function saveGame(game, store = window.localStorage) {
  try { store.setItem(SAVE_KEY, packGame(game)); } catch { /* can't save here */ }
}
export function loadGame(store = window.localStorage) {
  try { return unpackGame(store.getItem(SAVE_KEY)); } catch { return null; }
}
export function clearSave(store = window.localStorage) {
  try { store.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}
