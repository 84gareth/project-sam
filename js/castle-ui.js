// The castle screens: chatting, the Round Table with chalkboards, and the
// drum-roll reveal. Rules come from castle.js; this file draws and listens.
import { TRAITOR, FAITHFUL } from "./game.js";
import {
  arriveAtCastle, answer, roundTable, winner, stillIn, isTraitor, QUESTIONS,
  night, murderIdeas, breakfastGroups, tableTalk, talkOptions, playerSays,
  isRecruitNight, recruit, recruitIdeas, joinChat,
} from "./castle.js";
import { $, show, badge, card, character, wait, FAST } from "./ui.js";
import {
  ROOMS, FLOOR, createWorld, step, tapTo, walkUpTo, nextTo, neighbour, peopleIn,
} from "./puppets.js";
import { say, narrate, voicesOn, setVoices } from "./voice.js";
import { drumRoll, play } from "./sound.js";

let game = null;
let tableVote = null;

let world = null;
let chatTarget = null;
let joinTarget = null;

export function goToCastle(g) {
  game = arriveAtCastle(g);
  window.game = game;
  world = createWorld(game, Math.random);
  window.world = world;
  showVoicesButton();
  startDay();
}

// ─── Chatting ───────────────────────────────────────────────────────────────

function startDay() {
  $("castle-day").textContent = `Day ${game.day} at the castle`;
  narrate(`Day ${game.day} at the castle.`);
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
  backToCastle();
}

// Sam's cut-out of a character (the puppet), or their badge if there's no
// drawing yet. Used when you talk to someone (Gareth: show the cut-out, not
// the portrait).
function cutout(id, extraClass = "") {
  const c = character(id);
  if (!c.picture) return badge(c, true);
  const img = document.createElement("img");
  img.className = "cutout " + extraClass;
  img.src = `assets/puppets/${id}.png`;
  img.alt = c.name;
  return img;
}

// ─── The paper puppet castle ────────────────────────────────────────────────

let shownRoom = null;
let looping = false;
let lastTime = 0;

function backToCastle() {
  chatTarget = null;
  show("screen-castle");
  render();
  if (!looping) {
    looping = true;
    lastTime = performance.now();
    requestAnimationFrame(tick);
  }
}

// A backup: if the browser stops sending animation frames (a hidden or
// headless page), keep the castle moving anyway.
setInterval(() => {
  if (looping && performance.now() - lastTime > 150) tick(performance.now(), true);
}, 100);

function tick(now, fromBackup = false) {
  if ($("screen-castle").hidden) { looping = false; return; }
  // In test mode (?fast=1) big steady steps, so tests don't depend on how
  // fast the test browser happens to run.
  const dt = FAST ? 0.5 : Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  step(world, stillIn(game), dt, Math.random);
  if (chatTarget && nextTo(world, chatTarget)) {
    const id = chatTarget;
    chatTarget = null;
    if (joinTarget) openJoin(...joinTarget);
    else openChat(id);
  }
  render();
  if (!fromBackup) requestAnimationFrame(tick);
}

// One puppet: Sam's cut-out drawing (or a paper badge until he draws them),
// with their name underneath.
function puppetEl(id) {
  const c = character(id);
  const el = document.createElement("div");
  el.className = "puppet" + (id === game.playerId ? " me" : "");
  el.dataset.id = id;
  const body = document.createElement("div");
  body.className = "puppet-body";
  if (c.picture) {
    const img = document.createElement("img");
    img.src = `assets/puppets/${id}.png`;
    img.alt = c.name;
    img.draggable = false;
    body.append(img);
  } else {
    const paper = badge(c);
    paper.classList.add("puppet-badge");
    body.append(paper);
  }
  const label = document.createElement("span");
  label.className = "puppet-name";
  label.textContent = id === game.playerId ? "You" : c.name;
  // A big speech bubble with bouncing dots when they're chatting.
  const dots = document.createElement("span");
  dots.className = "puppet-chat";
  for (let i = 0; i < 3; i++) dots.append(document.createElement("i"));
  el.append(dots, body, label);
  if (id !== game.playerId) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = world.people[id];
      // Chatting to someone else? Then Sam joins their chat.
      joinTarget = p.mode === "chat" && p.with && p.with !== game.playerId ? [id, p.with] : null;
      if (FAST) return joinTarget ? openJoin(...joinTarget) : openChat(id);
      chatTarget = id;
      walkUpTo(world, id);
    });
  }
  return el;
}

// Draw the room Sam is in, and everyone in it, where they are now.
function render() {
  const room = world.me.room;
  const left = neighbour(room, "left");
  const right = neighbour(room, "right");
  const here = stillIn(game);
  if (room !== shownRoom) {
    shownRoom = room;
    const r = ROOMS.find((x) => x.id === room);
    $("room-picture").src = r.picture;
    $("room-name").textContent = r.name;
    $("puppets").replaceChildren();
  }
  const count = (rm) => (rm ? peopleIn(world, rm, here).length : 0);
  const roomName = (rm) => ROOMS.find((x) => x.id === rm).name;
  $("door-left").hidden = !left;
  $("door-right").hidden = !right;
  if (left) $("door-left").textContent = `< ${roomName(left)} (${count(left)})`;
  if (right) $("door-right").textContent = `${roomName(right)} (${count(right)}) >`;

  const ids = [...peopleIn(world, room, here), game.playerId];
  const box = $("puppets");
  for (const el of [...box.children]) if (!ids.includes(el.dataset.id)) el.remove();
  for (const id of ids) {
    let el = box.querySelector(`[data-id="${id}"]`);
    if (!el) { el = puppetEl(id); box.append(el); }
    const p = id === game.playerId ? world.me : world.people[id];
    const depth = (p.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top);
    el.style.left = `${p.x * 100}%`;
    el.style.top = `${p.y * 100}%`;
    el.style.height = `${(0.34 + 0.12 * depth) * 100}%`;
    el.style.zIndex = String(Math.round(p.y * 1000));
    const moving = id === game.playerId ? p.walking : p.mode === "walk";
    el.classList.toggle("walking", moving);
    el.classList.toggle("flip", p.facing === "left");
    el.classList.toggle("chatting", p.mode === "chat" && id !== chatTarget);
  }
}

function openChat(id) {
  const c = character(id);
  // They stop to talk while you chat.
  const them = world && world.people[id];
  if (them) { them.mode = "chat"; them.timer = 3; them.with = game.playerId; }
  $("chat-picture").replaceChildren(cutout(id));
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

// Sam joins two people chatting. Two Traitors send him away; anyone else
// usually lets him in (castle.js joinChat).
function openJoin(a, b) {
  joinTarget = null;
  const j = joinChat(game, a, b);
  for (const id of [a, b]) {
    const p = world.people[id];
    if (p) { p.mode = "chat"; p.timer = 3; }
  }
  $("join-pictures").replaceChildren(cutout(a, "join-cutout"), cutout(b, "join-cutout"));
  $("join-names").textContent = `${character(a).name} and ${character(b).name}`;
  $("join-who").textContent = character(j.speaker).name + ":";
  $("join-text").textContent = j.text;
  $("join-chat").hidden = !j.welcome;
  $("join-chat").textContent = `Chat to ${character(j.speaker).name}`;
  $("join-chat").onclick = () => openChat(j.speaker);
  if (!j.welcome) {
    // Not wanted: they finish up and walk off.
    for (const id of [a, b]) if (world.people[id]) world.people[id].timer = 0.5;
  }
  show("screen-join");
  say(j.text, j.speaker);
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

// First the talk: two accusations and their answers, one at a time, each
// spoken in that character's voice. Then Sam joins in.
async function roundTableTalk() {
  const lines = $("talk-lines");
  lines.replaceChildren();
  $("talk-options").hidden = true;
  $("to-vote").hidden = true;
  show("screen-talk");
  narrate("Everyone sits down at the Round Table.");
  const talk = tableTalk(game);
  for (const t of talk) {
    await wait(1500);
    lines.append(talkLine(t.speaker, t.text));
    say(t.text, t.speaker, { queue: true });
  }
  await wait(1000);
  const opts = $("talk-options");
  opts.replaceChildren();
  for (const o of talkOptions(game, talk)) {
    const b = document.createElement("button");
    b.className = "question";
    b.textContent = o.text;
    b.addEventListener("click", () => {
      playerSays(game, o);
      opts.hidden = true;
      if (o.kind !== "quiet") {
        lines.append(talkLine(game.playerId, o.text, "You"));
        say(o.text, game.playerId);
      }
      $("to-vote").hidden = false;
    });
    opts.append(b);
  }
  opts.hidden = false;
}

function talkLine(id, text, label = character(id).name) {
  const row = document.createElement("div");
  row.className = "talk-line";
  row.append(badge(character(id)));
  const bubble = document.createElement("p");
  bubble.className = "talk-bubble";
  const who = document.createElement("b");
  who.textContent = label + ": ";
  bubble.append(who, text);
  row.append(bubble);
  return row;
}

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
  // Every few chalkboards, stop and count the votes so far (Gareth).
  const counts = {};
  let pauses = 0;
  $("tally").hidden = true;
  for (const [i, [voter, target]] of result.votes.entries()) {
    counts[target] = (counts[target] || 0) + 1;
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
    if ((i + 1) % 6 === 0 && i + 1 < result.votes.length) {
      const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 3);
      const text = "Votes so far: " + top.map(([id, n]) => `${character(id).name} ${n}`).join(", ") + ".";
      $("tally").textContent = text;
      $("tally").hidden = false;
      pauses++;
      boards.dataset.pauses = String(pauses);
      // Wait for the storyteller to finish the count before carrying on.
      await Promise.all([narrate(text), wait(1500)]);
      $("tally").hidden = true;
    }
  }
  const out = character(result.banished);
  $("most-votes").textContent = `${out.name} has the most votes: ${result.counts[result.banished]}.`;
  $("most-votes").hidden = false;
  narrate($("most-votes").textContent);
  $("to-reveal").hidden = false;
  $("to-reveal").onclick = () => reveal(result);
}

// ─── Banished: drum roll, then "I am a... FAITHFUL!" ─────────────────────────

async function reveal(result) {
  const out = character(result.banished);
  $("banished-picture").replaceChildren(badge(out, true));
  $("banished-picture").firstChild.classList.add("reveal-portrait");
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
  narrate(text, { queue: true });
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
  narrate("Night falls. The Traitors are meeting in secret.");
  if (isRecruitNight(game)) return recruitNightFaithful();
  const victim = night(game);
  await wait(1800);
  if (victim === me) {
    $("letter-big").textContent = "you have been murdered.";
    $("night-text").textContent = "There's a letter under your door...";
    narrate("There's a letter under your door...", { queue: true });
    await wait(1200);
    $("letter").hidden = false;
    play("letter");
    narrate("By order of the Traitors, you have been murdered.", { queue: true });
    $("night-over").hidden = false;
  } else {
    $("night-text").textContent = "Phew! No letter for you tonight.";
    narrate("Phew! No letter for you tonight.", { queue: true });
    $("to-breakfast").hidden = false;
  }
}

// Night 1 for a Faithful: the Traitors recruit. Maybe Sam!
async function recruitNightFaithful() {
  const who = recruit(game);
  await wait(1800);
  if (who === game.playerId) {
    $("night-text").textContent = "There's a letter under your door...";
    narrate("There's a letter under your door...", { queue: true });
    await wait(1200);
    const others = stillIn(game).filter((id) => id !== who && isTraitor(game, id)).map((id) => character(id).name);
    $("letter-big").textContent = `you are now a Traitor! Your fellow Traitors are ${others.join(", ")}.`;
    $("letter").hidden = false;
    play("letter");
    narrate(`By order of the Traitors, you are now a Traitor! Your fellow Traitors are ${others.join(", ")}.`, { queue: true });
  } else {
    $("night-text").textContent = "Phew! No letter for you tonight.";
    narrate("Phew! No letter for you tonight.", { queue: true });
  }
  $("to-breakfast").hidden = false;
}

// Sam is a Traitor: the other Traitors give ideas, Sam picks. On night 1
// they pick someone to recruit instead of someone to murder.
let recruiting = false;
function traitorsMeeting() {
  play("night");
  victimPick = null;
  recruiting = isRecruitNight(game);
  $("murder").disabled = true;
  $("murder").textContent = recruiting ? "Recruit them" : "Send the letter";
  $("meeting-hint").textContent = recruiting
    ? "Tonight the Traitors recruit someone new. Who should join you? You pick."
    : "Who will the Traitors murder tonight? You pick.";
  const ideas = recruiting ? recruitIdeas(game) : murderIdeas(game);
  const fellows = stillIn(game).filter((id) => id !== game.playerId && isTraitor(game, id));
  const box = $("traitor-ideas");
  box.replaceChildren();
  fellows.forEach((f, i) => {
    const idea = character(ideas[Math.min(i, ideas.length - 1)]).name;
    const p = document.createElement("p");
    p.className = "idea";
    const line = recruiting
      ? `Let's recruit ${idea}. Nobody suspects them!`
      : `Let's pick ${idea}. They're getting close to us!`;
    p.textContent = `${character(f).name}: "${line}"`;
    box.append(p);
    say(line, f, { queue: true });
  });
  if (fellows.length === 0) {
    const p = document.createElement("p");
    p.className = "idea";
    p.textContent = "You're the last Traitor. It's all up to you!";
    box.append(p);
    narrate(p.textContent, { queue: true });
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
  if (!victim) {
    // The recruiting night: nobody was murdered.
    $("arrivals").hidden = true;
    $("crossout-picture").replaceChildren();
    $("crossout").classList.remove("crossed");
    $("missing").textContent = "Everyone came to breakfast! Nobody was murdered last night... strange!";
    narrate($("missing").textContent);
    $("crossout").hidden = false;
    await wait(2600);
    return showRoster();
  }
  // The missing one, big, then a red X is drawn across them (Gareth: "an
  // animated panel before showing the full roster").
  const name = character(victim).name;
  $("arrivals").hidden = true;
  $("crossout-picture").replaceChildren(badge(character(victim), true));
  $("crossout").classList.remove("crossed");
  $("missing").textContent = `${name} never came to breakfast...`;
  narrate($("missing").textContent);
  $("crossout").hidden = false;
  await wait(1400);
  $("crossout").classList.add("crossed");
  play("chalk");
  $("missing").textContent = `${name} never came to breakfast. ${name} was murdered by the Traitors!`;
  narrate(`${name} was murdered by the Traitors!`, { queue: true });
  await wait(2200);
  showRoster();
}

// Everyone, in the usual order: the ones who've gone are greyed out with a
// red X (Sam, 2026-10-24). Then a new day, or the end.
function showRoster() {
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
    narrate($("breakfast-over-text").textContent, { queue: true });
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
$("join-back").addEventListener("click", () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  backToCastle();
});
$("chat-back").addEventListener("click", () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  backToCastle();
});
// Tap the floor to walk; a door to change room.
$("stage").addEventListener("click", (e) => {
  const box = $("stage").getBoundingClientRect();
  tapTo(world, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
});
$("door-left").addEventListener("click", (e) => { e.stopPropagation(); tapTo(world, 0, world.me.y); });
$("door-right").addEventListener("click", (e) => { e.stopPropagation(); tapTo(world, 1, world.me.y); });
$("to-table").addEventListener("click", roundTableTalk);
$("to-vote").addEventListener("click", goToTable);
$("cast-vote").addEventListener("click", castVote);
$("next-day").addEventListener("click", goNight);
$("murder").addEventListener("click", () => {
  if (!victimPick) return;
  if (recruiting) {
    recruit(game, victimPick);
    breakfast(null);
  } else {
    breakfast(night(game, victimPick));
  }
});
$("to-breakfast").addEventListener("click", () => breakfast(game.history[game.history.length - 1].murdered ?? null));
$("start-day").addEventListener("click", startDay);
for (const id of ["play-again", "night-play-again", "breakfast-play-again"]) {
  $(id).addEventListener("click", () => location.reload());
}
