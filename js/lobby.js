// Multiplayer lobby rules (docs/multiplayer-spec.md). Pure: no page, no
// network. The room code is four symbols from eight; seats are the real
// players waiting to start, each with the character they picked.

import { CHARACTERS } from "./characters.js";

// The eight symbols a code is made of (drawn in multiplayer-ui.js).
export const SYMBOLS = ["crown", "key", "star", "moon", "sun", "bell", "shield", "dagger"];
export const CODE_LENGTH = 4;
export const MAX_PLAYERS = CHARACTERS.length;   // up to all 22 (Sam)

// A new random code, e.g. ["moon", "key", "key", "sun"].
export function newCode(random = Math.random) {
  return Array.from({ length: CODE_LENGTH }, () => SYMBOLS[Math.floor(random() * SYMBOLS.length)]);
}
// The code as a short name for the room ("moon-key-key-sun"), and back.
export const codeName = (code) => code.join("-");
export function parseCode(name) {
  const code = String(name).split("-");
  return code.length === CODE_LENGTH && code.every((s) => SYMBOLS.includes(s)) ? code : null;
}

// A room: { code, host: uid, seats: { uid: { character, joined } }, started }.
export function newRoom(code, hostUid, now = 0) {
  return { code: codeName(code), host: hostUid, seats: { [hostUid]: { character: null, joined: now } }, started: false };
}
// Join, if there's room and it hasn't started. Returns the room, or a reason.
export function join(room, uid, now = 0) {
  if (room.started) return { error: "started" };
  if (room.seats[uid]) return { room };
  if (Object.keys(room.seats).length >= MAX_PLAYERS) return { error: "full" };
  return { room: { ...room, seats: { ...room.seats, [uid]: { character: null, joined: now } } } };
}
// Pick a character, unless someone else already has it.
export function pick(room, uid, character) {
  if (!room.seats[uid] || !CHARACTERS.some((c) => c.id === character)) return { error: "no" };
  const taken = Object.entries(room.seats).some(([u, s]) => u !== uid && s.character === character);
  if (taken) return { error: "taken" };
  return { room: { ...room, seats: { ...room.seats, [uid]: { ...room.seats[uid], character } } } };
}
// Your real name (Gareth, 2026-10-29): first names only, as it's shared
// with the other players. Tidied: letters, spaces and dashes, up to 12.
export const NAME_LENGTH = 12;
export const cleanName = (text) => String(text ?? "").replace(/[^\p{L}\p{M} '-]/gu, "")
  .replace(/\s+/g, " ").trim().slice(0, NAME_LENGTH).trim();
export function setName(room, uid, text) {
  if (!room.seats[uid]) return { error: "no" };
  return { room: { ...room, seats: { ...room.seats, [uid]: { ...room.seats[uid], name: cleanName(text) } } } };
}
export const takenBy = (room, character) =>
  Object.entries(room.seats).find(([, s]) => s.character === character)?.[0] ?? null;
// The host can start once everyone has picked.
export const canStart = (room) =>
  !room.started && Object.values(room.seats).every((s) => s.character);
// Players in the order they joined (the host first).
export const seatOrder = (room) =>
  Object.entries(room.seats).sort((a, b) => a[1].joined - b[1].joined || (a[0] < b[0] ? -1 : 1)).map(([uid]) => uid);
