// Small page helpers shared by every screen.
import { CHARACTERS, initials } from "./characters.js";

export const $ = (id) => document.getElementById(id);

// ?fast=1 in the address skips every pause (the live tests use it).
export const FAST = new URLSearchParams(location.search).has("fast");
export const wait = (ms) => new Promise((r) => setTimeout(r, FAST ? 0 : ms));

export const character = (id) => CHARACTERS.find((c) => c.id === id);

// Who Sam is playing, so their picture is marked everywhere (Gareth: "a
// clear way of marking which character you are ... it's easy to lose
// track!").
let meId = null;
export const setMe = (id) => { meId = id; };
export const isMe = (id) => id === meId;
// A Traitor Sam sees his fellow Traitors marked in red everywhere (Gareth).
// The castle sets who they are (it changes when someone is recruited).
let teamCheck = () => false;
export const setTeam = (fn) => { teamCheck = fn; };
export const isFellow = (id) => teamCheck(id);

// Multiplayer: the real players, marked in blue everywhere, and their real
// names, shown above their character's name (Gareth, 2026-10-29).
let realPlayers = new Set();
let realNames = {};
export function setPlayers(humans = [], names = {}) {
  realPlayers = new Set(humans.length > 1 ? humans : []);
  realNames = names ?? {};
}
export const isRealPlayer = (id) => realPlayers.has(id);
export const realName = (id) => (realPlayers.has(id) ? realNames[id] || null : null);
// Put a name into `el`: the real name (small, on top) if there is one, then
// `text` (the character's name, or whatever the screen calls them).
export function nameInto(el, id, text) {
  el.replaceChildren();
  const real = realName(id);
  if (real) {
    const top = document.createElement("span");
    top.className = "real-name";
    top.textContent = real;
    el.append(top, document.createElement("br"));
  }
  el.append(text);
  return el;
}

// Screens with no pause button: before the game, and during missions.
const NO_PAUSE = ["screen-station", "screen-mode", "screen-multi", "screen-mp-join", "screen-lobby", "screen-pick", "screen-ready", "screen-train", "screen-mission", "screen-debug"];

export function show(screenId) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== screenId;
  const pause = document.getElementById("pause");
  if (pause) pause.hidden = NO_PAUSE.includes(screenId);
}

// Sam's drawing of the character if there is one, else a coloured circle
// with their initials.
export function badge(c, big = false) {
  if (c.picture) {
    const img = document.createElement("img");
    img.className = "portrait" + (big ? " big-portrait" : "") + (isMe(c.id) ? " me-badge" : "") + (isFellow(c.id) ? " fellow-badge" : "")
      + (isRealPlayer(c.id) && !isMe(c.id) ? " player-badge" : "");
    img.src = c.picture;
    img.alt = c.name;
    return img;
  }
  const b = document.createElement("div");
  b.className = "badge" + (big ? " big-badge" : "") + (isMe(c.id) ? " me-badge" : "") + (isFellow(c.id) ? " fellow-badge" : "")
    + (isRealPlayer(c.id) && !isMe(c.id) ? " player-badge" : "");
  b.style.background = c.colour;
  b.textContent = initials(c.name);
  return b;
}

// A tappable card: picture, name, and an optional line underneath.
export function card(c, line = c.about) {
  const el = document.createElement("button");
  el.className = "card" + (isMe(c.id) ? " me-card" : "");
  el.dataset.id = c.id;
  if (isMe(c.id)) el.append(Object.assign(document.createElement("span"), { className: "you-ribbon", textContent: "YOU" }));
  if (isFellow(c.id)) {
    el.classList.add("fellow-card");
    el.append(Object.assign(document.createElement("span"), { className: "you-ribbon traitor-ribbon", textContent: "TRAITOR" }));
  }
  if (isRealPlayer(c.id) && !isMe(c.id)) {
    el.classList.add("player-card");
    el.append(Object.assign(document.createElement("span"), { className: "player-ribbon", textContent: "PLAYER" }));
  }
  el.append(badge(c));
  const name = document.createElement("span");
  name.className = "card-name";
  nameInto(name, c.id, c.name);
  el.append(name);
  if (line) {
    const about = document.createElement("span");
    about.className = "card-about";
    about.textContent = line;
    el.append(about);
  }
  return el;
}
