// Small page helpers shared by every screen.
import { CHARACTERS, initials } from "./characters.js";

export const $ = (id) => document.getElementById(id);

// ?fast=1 in the address skips every pause (the live tests use it).
export const FAST = new URLSearchParams(location.search).has("fast");
export const wait = (ms) => new Promise((r) => setTimeout(r, FAST ? 0 : ms));

export const character = (id) => CHARACTERS.find((c) => c.id === id);

export function show(screenId) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== screenId;
}

// Sam's drawing of the character if there is one, else a coloured circle
// with their initials.
export function badge(c, big = false) {
  if (c.picture) {
    const img = document.createElement("img");
    img.className = "portrait" + (big ? " big-portrait" : "");
    img.src = c.picture;
    img.alt = c.name;
    return img;
  }
  const b = document.createElement("div");
  b.className = "badge" + (big ? " big-badge" : "");
  b.style.background = c.colour;
  b.textContent = initials(c.name);
  return b;
}

// A tappable card: picture, name, and an optional line underneath.
export function card(c, line = c.about) {
  const el = document.createElement("button");
  el.className = "card";
  el.dataset.id = c.id;
  el.append(badge(c));
  const name = document.createElement("span");
  name.className = "card-name";
  name.textContent = c.name;
  el.append(name);
  if (line) {
    const about = document.createElement("span");
    about.className = "card-about";
    about.textContent = line;
    el.append(about);
  }
  return el;
}
