// The page: the station, picking who you are, and your secret. Then the
// castle (castle-ui.js). The rules live in game.js and castle.js; page
// files only draw and listen.
import "./fit.js";
import "./multiplayer-ui.js";
import { GAME_NAME, VERSION } from "./version.js";
import { CHARACTERS } from "./characters.js";
import { newGame, TRAITOR } from "./game.js";
import { $, show, badge, card, character, setMe } from "./ui.js";
import { goToCastle, rejoinCastle } from "./castle-ui.js";
import { unlockSounds, play } from "./sound.js";
import { narrate, setSecretsQuiet } from "./voice.js";
import { MISSIONS } from "./missions.js";
import { startMission } from "./mission-ui.js";
import { arriveAtCastle } from "./castle.js";
import { loadGame } from "./save.js";

let pickedId = null;
// The game in progress, once a character is chosen. Exposed for the live tests.
window.game = null;

function buildCards() {
  const cards = $("cards");
  for (const c of CHARACTERS) {
    const el = card(c);
    el.addEventListener("click", () => {
      pickedId = c.id;
      for (const other of cards.children) other.classList.toggle("picked", other === el);
      $("choose").disabled = false;
    });
    cards.append(el);
  }
}

// Deal the game, then tell you who you are and your secret side.
function startGame() {
  // ?seed=123 in the address fixes the deal (the live tests use it).
  const seed = Number(new URLSearchParams(location.search).get("seed")) || Date.now();
  window.game = newGame(pickedId, seed);
  setMe(pickedId);
  showReady();
}

// You are ... You are a Traitor/Faithful (secret!).
function showReady() {
  const side = window.game.playerSide;
  const c = character(pickedId);
  $("ready-badge").replaceWith(Object.assign(badge(c, true), { id: "ready-badge" }));
  $("ready-who").textContent = `You are ${c.name}.`;
  $("ready-side").textContent = side === TRAITOR ? "You are a Traitor. Shh!" : "You are a Faithful.";
  $("ready-side").className = "ready-side " + side;
  show("screen-ready");
  // Your side is a secret: in multiplayer it's only shown, never spoken.
  narrate($("ready-who").textContent);
  narrate($("ready-side").textContent, { queue: true, secret: true });
}

document.title = GAME_NAME;
$("title").textContent = GAME_NAME;
$("version").textContent = "v" + VERSION;
buildCards();
// Single player or multiplayer (Phase 8).
$("start").addEventListener("click", () => show("screen-mode"));
$("mode-single").addEventListener("click", () => show("screen-pick"));
$("mode-back").addEventListener("click", () => show("screen-station"));
// A saved game: carry on from the start of the day you got to.
const saved = new URLSearchParams(location.search).has("seed") ? null : loadGame();
if (saved) {
  $("carry-on").hidden = false;
  $("carry-on").textContent = `Carry on: day ${saved.day} as ${character(saved.playerId).name}`;
  $("carry-on").addEventListener("click", () => {
    window.game = saved;
    setMe(saved.playerId);
    goToCastle(saved, { resume: true });
  });
}
$("choose").addEventListener("click", () => pickedId && startGame());
// Multiplayer: the host started the game; this device's player finds out
// their secret side (Phase 8).
let engine = null;
document.addEventListener("multiplayer-start", (e) => {
  window.game = e.detail.game;
  engine = e.detail.engine;
  setSecretsQuiet(true);
  pickedId = window.game.playerId;
  setMe(pickedId);
  showReady();
});

// Multiplayer, rejoining after a reload: straight back into the game.
document.addEventListener("multiplayer-rejoin", (e) => {
  const { game, engine: eng, pos, results } = e.detail;
  window.game = game;
  engine = eng;
  pickedId = game.playerId;
  setMe(pickedId);
  setSecretsQuiet(true);
  rejoinCastle(game, eng, pos, results);
});

// All aboard! A short train ride with the steam train sound (Sam), THEN
// the castle (Gareth: the sound was playing after you'd arrived).
$("to-castle").addEventListener("click", async () => {
  show("screen-train");
  narrate("All aboard! The train is taking you to the castle.");
  await play("train");
  goToCastle(window.game, engine ? { engine } : {});
});
// The debug menu (Gareth: "a debug menu to play each mission on its own to
// test it"). Add ?debug to the address to see its button at the station.
function debugMenu() {
  const box = $("debug-missions");
  box.replaceChildren();
  for (const m of MISSIONS.filter((x) => x.built)) {
    const b = document.createElement("button");
    b.className = "question";
    b.dataset.mission = m.id;
    b.textContent = m.name;
    b.addEventListener("click", () => {
      const seed = Number(new URLSearchParams(location.search).get("seed")) || Date.now();
      window.game = arriveAtCastle(newGame("pepper", seed));
      startMission(window.game, debugMenu, m);
    });
    box.append(b);
  }
  show("screen-debug");
}
if (new URLSearchParams(location.search).has("debug")) $("debug").hidden = false;
$("debug").addEventListener("click", debugMenu);
$("debug-back").addEventListener("click", () => show("screen-station"));

// The first tap switches sound on (iPad rule); every button tap clicks.
document.addEventListener("pointerdown", unlockSounds, { capture: true });
document.addEventListener("click", (e) => {
  if (e.target.closest("button")) play("click");
}, { capture: true });
