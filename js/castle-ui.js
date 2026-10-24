// The castle screens: chatting, the Round Table with chalkboards, and the
// drum-roll reveal. Rules come from castle.js; this file draws and listens.
import { TRAITOR, FAITHFUL } from "./game.js";
import {
  arriveAtCastle, answer, roundTable, winner, stillIn, isTraitor, QUESTIONS,
  night, murderIdeas, breakfastGroups,
} from "./castle.js";
import { $, show, badge, card, character, wait } from "./ui.js";
import { say, voicesOn, setVoices } from "./voice.js";
import { drumRoll, play } from "./sound.js";

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
    play("chalk");
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
  await drumRoll();
  const word = result.side === TRAITOR ? "TRAITOR!" : "FAITHFUL!";
  $("reveal").textContent = `I am a... ${word}`;
  $("reveal").className = "reveal " + result.side;
  // Sam: a Faithful gets crying and booing; a Traitor gets cheering.
  if (result.side === TRAITOR) {
    play("cheering");
  } else {
    play("boo");
    play("crying");
  }
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

// ─── The night ──────────────────────────────────────────────────────────────

let victimPick = null;

async function goNight() {
  const me = game.playerId;
  if (game.playerSide === TRAITOR) return traitorsMeeting();
  // A Faithful waits in their room... is there a letter?
  $("night-title").textContent = "Night falls...";
  $("night-text").textContent = "The Traitors are meeting in secret.";
  $("letter").hidden = true;
  $("to-breakfast").hidden = true;
  $("night-over").hidden = true;
  show("screen-night");
  play("night");
  const victim = night(game);
  await wait(1800);
  if (victim === me) {
    $("night-text").textContent = "There's a letter under your door...";
    await wait(1200);
    $("letter").hidden = false;
    play("letter");
    $("night-over").hidden = false;
  } else {
    $("night-text").textContent = "Phew! No letter for you tonight.";
    $("to-breakfast").hidden = false;
  }
}

// Sam is a Traitor: the other Traitors give ideas, Sam picks.
function traitorsMeeting() {
  play("night");
  victimPick = null;
  $("murder").disabled = true;
  const ideas = murderIdeas(game);
  const fellows = stillIn(game).filter((id) => id !== game.playerId && isTraitor(game, id));
  const box = $("traitor-ideas");
  box.replaceChildren();
  fellows.forEach((f, i) => {
    const idea = character(ideas[Math.min(i, ideas.length - 1)]).name;
    const p = document.createElement("p");
    p.className = "idea";
    p.textContent = `${character(f).name}: "Let's pick ${idea}. They're getting close to us!"`;
    box.append(p);
  });
  if (fellows.length === 0) {
    const p = document.createElement("p");
    p.className = "idea";
    p.textContent = "You're the last Traitor. It's all up to you!";
    box.append(p);
  }
  const cards = $("victim-cards");
  cards.replaceChildren();
  for (const id of ideas) {
    const el = card(character(id), null);
    el.addEventListener("click", () => {
      victimPick = id;
      for (const other of cards.children) other.classList.toggle("picked", other === el);
      $("murder").disabled = false;
    });
    cards.append(el);
  }
  show("screen-traitors");
}

// Breakfast: little groups walk in. The murdered one never comes.
async function breakfast(victim) {
  const arrivals = $("arrivals");
  arrivals.replaceChildren();
  $("start-day").hidden = true;
  $("breakfast-over").hidden = true;
  $("gone-box").hidden = true;
  $("crossout").hidden = true;
  arrivals.hidden = false;
  show("screen-breakfast");
  for (const group of breakfastGroups(game)) {
    await wait(900);
    const row = document.createElement("div");
    row.className = "arrival";
    for (const id of group) {
      const who = document.createElement("div");
      who.className = "arrival-person";
      who.append(badge(character(id)));
      const name = document.createElement("span");
      name.textContent = id === game.playerId ? "You" : character(id).name;
      who.append(name);
      row.append(who);
    }
    arrivals.append(row);
  }
  await wait(1200);
  // The missing one, big, then a red X is drawn across them (Gareth: "an
  // animated panel before showing the full roster").
  const name = character(victim).name;
  $("arrivals").hidden = true;
  $("crossout-picture").replaceChildren(badge(character(victim), true));
  $("crossout").classList.remove("crossed");
  $("missing").textContent = `${name} never came to breakfast...`;
  $("crossout").hidden = false;
  await wait(1400);
  $("crossout").classList.add("crossed");
  play("chalk");
  $("missing").textContent = `${name} never came to breakfast. ${name} was murdered by the Traitors!`;
  await wait(2200);
  // Then everyone, in the usual order: the ones who've gone are greyed out
  // with a red X (Sam, 2026-10-24).
  $("crossout").hidden = true;
  const gone = $("gone");
  gone.replaceChildren();
  for (const p of game.players) {
    const who = document.createElement("div");
    who.className = "arrival-person" + (p.inGame ? "" : " gone-person");
    who.dataset.id = p.id;
    who.append(badge(character(p.id)));
    const label = document.createElement("span");
    label.textContent = p.id === game.playerId ? "You" : character(p.id).name;
    who.append(label);
    gone.append(who);
  }
  $("gone-box").hidden = false;
  const won = winner(game);
  if (won) {
    const traitors = game.players.filter((p) => p.side === TRAITOR).map((p) => character(p.id).name);
    $("breakfast-over-text").textContent =
      `${won === FAITHFUL ? "The Faithfuls win!" : "The Traitors win!"} The Traitors were ${traitors.join(", ")}.`;
    $("breakfast-over").hidden = false;
  } else {
    $("start-day").hidden = false;
  }
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
$("next-day").addEventListener("click", goNight);
$("murder").addEventListener("click", () => {
  if (victimPick) breakfast(night(game, victimPick));
});
$("to-breakfast").addEventListener("click", () => breakfast(game.history[game.history.length - 1].murdered));
$("start-day").addEventListener("click", startDay);
for (const id of ["play-again", "night-play-again", "breakfast-play-again"]) {
  $(id).addEventListener("click", () => location.reload());
}
