// The page: the station, picking who you are, and your secret. Then the
// castle (castle-ui.js). The rules live in game.js and castle.js; page
// files only draw and listen.
import { GAME_NAME, VERSION } from "./version.js";
import { CHARACTERS } from "./characters.js";
import { newGame, TRAITOR } from "./game.js";
import { $, show, badge, card, character } from "./ui.js";
import { goToCastle } from "./castle-ui.js";
import { unlockSounds, play } from "./sound.js";
import { narrate } from "./voice.js";

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
  const side = window.game.playerSide;
  const c = character(pickedId);
  $("ready-badge").replaceWith(Object.assign(badge(c, true), { id: "ready-badge" }));
  $("ready-who").textContent = `You are ${c.name}.`;
  $("ready-side").textContent = side === TRAITOR ? "You are a Traitor. Shh!" : "You are a Faithful.";
  $("ready-side").className = "ready-side " + side;
  show("screen-ready");
  narrate(`${$("ready-who").textContent} ${$("ready-side").textContent}`);
}

document.title = GAME_NAME;
$("title").textContent = GAME_NAME;
$("version").textContent = "v" + VERSION;
buildCards();
$("start").addEventListener("click", () => show("screen-pick"));
$("choose").addEventListener("click", () => pickedId && startGame());
$("to-castle").addEventListener("click", () => {
  play("train");   // Sam: a train whistle for All aboard!
  goToCastle(window.game);
});
// The first tap switches sound on (iPad rule); every button tap clicks.
document.addEventListener("pointerdown", unlockSounds, { capture: true });
document.addEventListener("click", (e) => {
  if (e.target.closest("button")) play("click");
}, { capture: true });
