// The castle screens: chatting, the Round Table with chalkboards, and the
// drum-roll reveal. Rules come from castle.js; this file draws and listens.
import { TRAITOR, FAITHFUL } from "./game.js";
import {
  arriveAtCastle, answer, roundTable, winner, stillIn, isTraitor, QUESTIONS,
} from "./castle.js";
import { $, show, badge, card, character, wait } from "./ui.js";
import { say, voicesOn, setVoices } from "./voice.js";
import { drumRoll } from "./sound.js";

let game = null;
let tableVote = null;

export function goToCastle(g) {
  game = arriveAtCastle(g);
  window.game = game;
  showVoicesButton();
  startDay();
}

// ─── Chatting ───────────────────────────────────────────────────────────────

function startDay() {
  $("castle-day").textContent = `Day ${game.day} at the castle`;
  const me = game.playerId;
  if (game.playerSide === TRAITOR) {
    const fellows = stillIn(game).filter((id) => id !== me && isTraitor(game, id));
    $("fellows").textContent = fellows.length
      ? `Shh! The other Traitors are ${fellows.map((id) => character(id).name).join(" and ")}.`
      : "Shh! You're the last Traitor left.";
    $("fellows").hidden = false;
  } else {
    $("fellows").hidden = true;
  }
  const cards = $("castle-cards");
  cards.replaceChildren();
  for (const id of stillIn(game).filter((id) => id !== me)) {
    const el = card(character(id), "Tap to chat");
    el.addEventListener("click", () => openChat(id));
    cards.append(el);
  }
  show("screen-castle");
}

function openChat(id) {
  const c = character(id);
  $("chat-picture").replaceChildren(badge(c, true));
  $("chat-name").textContent = c.name;
  $("bubble").hidden = true;
  const qs = $("questions");
  qs.replaceChildren();
  for (const q of QUESTIONS) {
    const b = document.createElement("button");
    b.className = "question";
    b.dataset.q = q.id;
    b.textContent = q.text;
    b.addEventListener("click", () => ask(id, q.id));
    qs.append(b);
  }
  show("screen-chat");
}

function ask(id, question) {
  const a = answer(game, id, question);
  $("bubble-text").textContent = a.text;
  const list = $("bubble-list");
  list.replaceChildren();
  if (question === "list") {
    a.names.forEach((n, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${character(n).name}`;
      list.append(li);
    });
  }
  list.hidden = question !== "list";
  $("bubble").hidden = false;
  const spoken = question === "list"
    ? a.text + " " + a.names.map((n) => character(n).name).join(", ")
    : a.text;
  say(spoken, id);
}

function showVoicesButton() {
  $("voices").textContent = voicesOn() ? "Voices: On" : "Voices: Off";
}

// ─── The Round Table ────────────────────────────────────────────────────────

function goToTable() {
  tableVote = null;
  $("cast-vote").disabled = true;
  const cards = $("table-cards");
  cards.replaceChildren();
  for (const id of stillIn(game).filter((id) => id !== game.playerId)) {
    const el = card(character(id), null);
    el.addEventListener("click", () => {
      tableVote = id;
      for (const other of cards.children) other.classList.toggle("picked", other === el);
      $("cast-vote").disabled = false;
    });
    cards.append(el);
  }
  show("screen-table");
}

// Everyone holds up a chalkboard with a name on it, one at a time (Sam:
// "they all need to have a chalk board for who theyre going to write down").
async function castVote() {
  if (!tableVote) return;
  const result = roundTable(game, tableVote);
  const boards = $("boards");
  boards.replaceChildren();
  $("most-votes").hidden = true;
  $("to-reveal").hidden = true;
  show("screen-votes");
  for (const [voter, target] of result.votes) {
    const b = document.createElement("div");
    b.className = "chalkboard";
    const who = document.createElement("span");
    who.className = "board-voter";
    who.textContent = voter === game.playerId ? "You" : character(voter).name;
    const chalk = document.createElement("span");
    chalk.className = "chalk";
    chalk.textContent = character(target).name;
    b.append(who, chalk);
    boards.append(b);
    await wait(350);
  }
  const out = character(result.banished);
  $("most-votes").textContent = `${out.name} has the most votes: ${result.counts[result.banished]}.`;
  $("most-votes").hidden = false;
  $("to-reveal").hidden = false;
  $("to-reveal").onclick = () => reveal(result);
}

// ─── Banished: drum roll, then "I am a... FAITHFUL!" ─────────────────────────

async function reveal(result) {
  const out = character(result.banished);
  $("banished-picture").replaceChildren(badge(out, true));
  $("banished-name").textContent = out.name;
  $("reveal").textContent = "";
  $("reveal").className = "reveal";
  $("after-reveal").hidden = true;
  $("game-over").hidden = true;
  show("screen-banished");
  $("reveal").textContent = "I am a...";
  await Promise.all([drumRoll(), wait(2200)]);
  const word = result.side === TRAITOR ? "TRAITOR!" : "FAITHFUL!";
  $("reveal").textContent = `I am a... ${word}`;
  $("reveal").className = "reveal " + result.side;
  say(`I am a ${result.side === TRAITOR ? "Traitor" : "Faithful"}!`, result.banished);

  const won = winner(game);
  if (result.banished === game.playerId) {
    gameOver("You've been banished!");
  } else if (won) {
    const traitors = game.players.filter((p) => p.side === TRAITOR).map((p) => character(p.id).name);
    gameOver(`${won === FAITHFUL ? "The Faithfuls win!" : "The Traitors win!"} The Traitors were ${traitors.join(", ")}.`);
  } else {
    $("after-reveal").hidden = false;
  }
}

function gameOver(text) {
  $("game-over-text").textContent = text;
  $("game-over").hidden = false;
}

// ─── Buttons ────────────────────────────────────────────────────────────────

$("voices").addEventListener("click", () => {
  setVoices(!voicesOn());
  showVoicesButton();
});
$("chat-back").addEventListener("click", () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  show("screen-castle");
});
$("to-table").addEventListener("click", goToTable);
$("cast-vote").addEventListener("click", castVote);
$("next-day").addEventListener("click", startDay);
$("play-again").addEventListener("click", () => location.reload());
