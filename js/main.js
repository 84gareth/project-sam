// The page: shows one screen at a time and handles taps. The rules live in
// game.js; this file only draws and listens.
import { GAME_NAME, VERSION } from "./version.js";
import { CHARACTERS, initials } from "./characters.js";
import { newGame, TRAITOR } from "./game.js";

const $ = (id) => document.getElementById(id);

let pickedId = null;
// The game in progress, once a character is chosen. Exposed for the live tests.
window.game = null;

function show(screenId) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== screenId;
}

// Sam's drawing of the character if there is one, else a coloured circle
// with their initials.
function badge(character, big = false) {
  if (character.picture) {
    const img = document.createElement("img");
    img.className = "portrait" + (big ? " big-portrait" : "");
    img.src = character.picture;
    img.alt = character.name;
    return img;
  }
  const b = document.createElement("div");
  b.className = "badge" + (big ? " big-badge" : "");
  b.style.background = character.colour;
  b.textContent = initials(character.name);
  return b;
}

function buildCards() {
  const cards = $("cards");
  for (const c of CHARACTERS) {
    const card = document.createElement("button");
    card.className = "card";
    card.dataset.id = c.id;
    card.append(badge(c));
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = c.name;
    const about = document.createElement("span");
    about.className = "card-about";
    about.textContent = c.about;
    card.append(name, about);
    card.addEventListener("click", () => {
      pickedId = c.id;
      for (const other of cards.children) other.classList.toggle("picked", other === card);
      $("choose").disabled = false;
    });
    cards.append(card);
  }
}

// Deal the game, then tell you who you are and your secret side.
function startGame() {
  // ?seed=123 in the address fixes the deal (the live tests use it).
  const seed = Number(new URLSearchParams(location.search).get("seed")) || Date.now();
  window.game = newGame(pickedId, seed);
  const side = window.game.playerSide;
  const c = CHARACTERS.find((x) => x.id === pickedId);
  $("ready-badge").replaceWith(Object.assign(badge(c, true), { id: "ready-badge" }));
  $("ready-who").textContent = `You are ${c.name}.`;
  $("ready-side").textContent = side === TRAITOR ? "You are a Traitor. Shh!" : "You are a Faithful.";
  $("ready-side").className = "ready-side " + side;
  show("screen-ready");
}

document.title = GAME_NAME;
$("title").textContent = GAME_NAME;
$("version").textContent = "v" + VERSION;
buildCards();
$("start").addEventListener("click", () => show("screen-pick"));
$("choose").addEventListener("click", () => pickedId && startGame());
