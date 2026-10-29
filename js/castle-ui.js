// The castle screens: chatting, the Round Table with chalkboards, and the
// drum-roll reveal. Rules come from castle.js; this file draws and listens.
import { TRAITOR, FAITHFUL } from "./game.js";
import {
  arriveAtCastle, answer, roundTable, winner, stillIn, isTraitor, QUESTIONS,
  night, murderIdeas, breakfastGroups, tableTalk, talkOptions, playerSays,
  isRecruitNight, recruit, recruitIdeas, joinChat, nightKind, quietNight, whosWho,
  finalRound, finalChoices, prizeShare, allTraitors, hasShield, isHuman,
  isDaggerNight, giveDagger, daggerIdeas, daggerHolder, hasDagger,
  computerChoice, canMurderTonight, noMurderToday, pleaOptions,
} from "./castle.js";
import { DAYS } from "./game.js";
import { $, show, badge, card, character, wait, FAST, setTeam, isFellow, setPlayers, isRealPlayer, realName, nameInto } from "./ui.js";
import {
  ROOMS, FLOOR, createWorld, step, tapTo, walkUpTo, nextTo, neighbour, peopleIn,
} from "./puppets.js";
import { say, narrate, voicesOn, setVoices } from "./voice.js";
import { drumRoll, play, setRoomSound, setMusic } from "./sound.js";
import { startMission } from "./mission-ui.js";
import { todaysMission } from "./missions.js";
import { saveGame, clearSave } from "./save.js";
import { soloEngine, daggerTonight } from "./engine.js";

let game = null;
let tableVote = null;

// Everyone's name as shown on screen; Sam's own character says "(you)" too
// (Gareth: show your character's name, not just "You").
// "A, B and C" (Gareth: "A and B and C" read badly).
const andList = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const label = (id) => (id === game.playerId ? `${character(id).name} (you)` : character(id).name);
// The same in one line, with a real player's name first (talk lines).
const fullLabel = (id) => (realName(id) ? `${realName(id)} (${label(id)})` : label(id));

let world = null;
let chatTarget = null;
let joinTarget = null;

// `resume`: carry on a saved game from the start of its day.
// `engine`: how decisions are made (engine.js): at once in single player,
// with everyone in multiplayer.
let engine = null;
export function goToCastle(g, { resume = false, engine: e = null } = {}) {
  game = resume ? g : arriveAtCastle(g);
  engine = e ?? soloEngine(game);
  setPlayers(game.humans ?? [], game.names);
  // Fellow Traitors, marked in red, but only if Sam is a Traitor himself.
  setTeam((id) => game.playerSide === TRAITOR && id !== game.playerId && isTraitor(game, id));
  window.game = game;
  world = createWorld(game, Math.random);
  window.world = world;
  showVoicesButton();
  startDay();
}

// Rejoining a multiplayer game (a reload, a sleepy iPad): the engine has
// caught up; carry on at `pos` (net-engine.js resumePoint), using what was
// decided last (`results`) where a screen needs it.
export function rejoinCastle(g, e, pos, results) {
  game = g;
  engine = e;
  setPlayers(game.humans ?? [], game.names);
  setTeam((id) => game.playerSide === TRAITOR && id !== game.playerId && isTraitor(game, id));
  window.game = game;
  world = createWorld(game, Math.random);
  window.world = world;
  showVoicesButton();
  const last = (type) => results.filter((r) => r && type(r)).pop() ?? {};
  if (!stillIn(game).includes(game.playerId)) {
    showRoster();
    $("start-day").hidden = true;
    $("breakfast-over-text").textContent = "You're out of this game. The others are playing on!";
    $("breakfast-over").hidden = false;
    return show("screen-breakfast");
  }
  if (pos === "castle") return enterCastle();
  if (pos === "dayStart") return startDay();
  if (pos === "talk") return roundTableTalk();
  if (pos === "table") return goToTable();
  if (pos === "reveal") return reveal(last((r) => r.banished));
  // A draw part-way through (resumePoint): what the last decision says.
  const latest = results[results.length - 1] ?? {};
  if (pos === "voted") return latest.tie ? tieTalk(latest) : reveal(latest);
  if (pos === "pleaded") { tieOnly = game.tie?.tied ?? null; return goToTable(); }
  if (pos === "revoted") return latest.tie ? chestScreen(latest) : reveal(latest);
  if (pos === "night") return goNight();
  if (pos === "breakfast") { nightResult = last((r) => r.kind); return breakfast(nightResult.victim ?? null); }
  if (pos === "final") return finalScreen();
  return ending();
}

// ─── Chatting ───────────────────────────────────────────────────────────────

// Each day from day 2 starts with its mission, then the castle.
// (No mission on day 1: Gareth.)
function startDay() {
  if (engine.kind === "solo") saveGame(game);   // a reload comes back to here (single player)
  setMusic(null);
  if (game.day === 1) enterCastle();
  else startMission(game, enterCastle, null, engine);
}

function enterCastle() {
  $("castle-day").textContent = `Day ${game.day} of ${DAYS}`;
  $("no-murder").hidden = !noMurderToday(game, todaysMission(game)?.id);
  narrate(game.day === DAYS ? "The last day at the castle!" : `Day ${game.day} at the castle.`);
  const me = game.playerId;
  if (game.playerSide === TRAITOR) {
    const fellows = stillIn(game).filter((id) => id !== me && isTraitor(game, id));
    $("fellows").textContent = fellows.length
      ? `Shh! The other Traitors are ${andList(fellows.map((id) => character(id).name))}.`
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
// Where each drawing's chin is, as a fraction of its height from the top
// (Gareth: Benny Biscuit's was over his face; tall hats push chins down).
// Measured by eye from the cut-outs, 2026-10-25.
const NECK = {
  puddle: 0.33, gumdrop: 0.22, fizz: 0.19, ruby: 0.28, pepper: 0.33, waffle: 0.34,
  plaster: 0.25, lola: 0.23, fern: 0.32, dot: 0.30, benny: 0.45, mystic: 0.41,
  tom: 0.19, zara: 0.25, grumble: 0.20, penny: 0.29, kick: 0.22, stan: 0.32,
  ivy: 0.27, max: 0.33, olive: 0.18, barry: 0.28,
};
// ...and across, where the head isn't in the middle of the picture (a goat
// on a lead, a pie held out). Anyone not listed is in the middle (0.5).
const NECK_X = {
  gumdrop: 0.43, fizz: 0.42, pepper: 0.36, waffle: 0.45, plaster: 0.55, lola: 0.58,
  fern: 0.30, dot: 0.45, mystic: 0.60, tom: 0.55, penny: 0.42, kick: 0.45,
  ivy: 0.36, barry: 0.38,
};
// The chain shows from 8.8% below the necklace's top (its hidden part).
const NECK_HIDDEN = 0.088;
function necklace(id) {
  const n = document.createElement("img");
  n.style.top = `${((NECK[id] ?? 0.24) - NECK_HIDDEN) * 100}%`;
  n.style.left = `${(NECK_X[id] ?? 0.5) * 100}%`;
  n.className = "necklace";
  n.src = "assets/shield.png";
  n.alt = "";
  n.draggable = false;
  return n;
}
// A cut-out, wearing the shield necklace if they have one today.
function wearing(id, picture) {
  const shield = hasShield(game, id), dagger = hasDagger(game, id);
  if (!shield && !dagger) return picture;
  const box = document.createElement("span");
  box.className = "wearing" + (shield ? " has-shield" : "") + (dagger ? " has-dagger" : "");
  box.append(picture);
  if (shield) box.append(necklace(id));
  if (dagger) box.append(daggerImg());
  return box;
}

function cutout(id, extraClass = "") {
  const c = character(id);
  if (!c.picture) return badge(c, true);
  const img = document.createElement("img");
  img.className = "cutout " + extraClass + (id === game.playerId ? " me-cutout" : "") + (isFellow(id) ? " fellow-cutout" : "");
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
// Tests (?fast=1) can move the castle on one step and redraw it at once,
// instead of waiting for the browser to get round to it.
if (FAST) window.castleTick = () => tick(performance.now(), true);

function tick(now, fromBackup = false) {
  if ($("screen-castle").hidden) {
    looping = false;
    // Still chatting in the room, or at the Round Table (its own fire)?
    // Keep that sound. Anywhere else: quiet.
    const atTable = ["screen-talk", "screen-table", "screen-votes", "screen-banished"].some((id) => !$(id).hidden);
    if ($("screen-chat").hidden && $("screen-join").hidden && !atTable) setRoomSound(null);
    return;
  }
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
  // Sam's shield necklace, worn by whoever won a shield today (Sam: "seen
  // wearing this around their necks until the next day").
  body.append(necklace(id), daggerImg());
  // A big speech bubble with bouncing dots when they're chatting.
  const dots = document.createElement("span");
  dots.className = "puppet-chat";
  for (let i = 0; i < 3; i++) dots.append(document.createElement("i"));
  el.append(dots, body);
  if (id !== game.playerId) el.addEventListener("click", (e) => { e.stopPropagation(); tapPerson(id); });
  return el;
}

// Tapping a person (their puppet or their name): walk up and chat, or join
// their chat if they're talking to someone else.
function tapPerson(id) {
  const p = world.people[id];
  joinTarget = p.mode === "chat" && p.with && p.with !== game.playerId ? [id, p.with] : null;
  if (FAST) return joinTarget ? openJoin(...joinTarget) : openChat(id);
  chatTarget = id;
  walkUpTo(world, id);
}

// Name tags, in their own layer above every puppet (Gareth: "should be
// possible to click on their names cleanly"). Each sits under its puppet's
// feet; if it would overlap another, it moves down a row.
function placeNames(ids) {
  const layer = $("names");
  for (const el of [...layer.children]) if (!ids.includes(el.dataset.id)) el.remove();
  // The stage's own size (not its size on screen, which shrinks on phones).
  const box = { width: $("stage").clientWidth, height: $("stage").clientHeight };
  const placed = [];
  const order = [...ids].sort((a, b) => pos(a).x - pos(b).x);
  for (const id of order) {
    let tag = layer.querySelector(`[data-id="${id}"]`);
    if (!tag) {
      tag = document.createElement("button");
      tag.className = "name-tag" + (id === game.playerId ? " me" : "");
      tag.dataset.id = id;
      nameInto(tag, id, label(id));
      if (id !== game.playerId) tag.addEventListener("click", (e) => { e.stopPropagation(); tapPerson(id); });
      layer.append(tag);
    }
    tag.classList.toggle("fellow", isFellow(id));
    tag.classList.toggle("real-player", isRealPlayer(id) && id !== game.playerId);
    const p = pos(id);
    const w = tag.offsetWidth || 90;
    const h = tag.offsetHeight || 26;
    const x = Math.min(Math.max(p.x * box.width - w / 2, 2), box.width - w - 2);
    const clash = (y) => placed.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y);
    // Under the feet first, then further down while it fits in the room,
    // then up over the puppet.
    let y = p.y * box.height + 4;
    while (clash(y) && y + 2 * h + 3 <= box.height) y += h + 3;
    if (clash(y) || y + h > box.height) {
      y = p.y * box.height - h - 4;
      while (clash(y) && y > 0) y -= h + 3;
    }
    placed.push({ x, y, w, h });
    tag.style.left = `${x}px`;
    tag.style.top = `${y}px`;
  }
}
const pos = (id) => (id === game.playerId ? world.me : world.people[id]);

// Draw the room Sam is in, and everyone in it, where they are now.
function render() {
  const room = world.me.room;
  setRoomSound(room);
  const left = neighbour(room, "left");
  const right = neighbour(room, "right");
  const here = stillIn(game);
  if (room !== shownRoom) {
    shownRoom = room;
    const r = ROOMS.find((x) => x.id === room);
    $("room-picture").src = r.picture;
    $("room-name").textContent = r.name;
    $("puppets").replaceChildren();
    $("names").replaceChildren();
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
    el.classList.toggle("has-shield", hasShield(game, id));
    el.classList.toggle("has-dagger", hasDagger(game, id));
    el.classList.toggle("fellow", isFellow(id));
    el.classList.toggle("real-player", isRealPlayer(id) && id !== game.playerId);
    el.classList.toggle("flip", p.facing === "left");
    el.classList.toggle("chatting", p.mode === "chat" && id !== chatTarget);
  }
  placeNames(ids);
}

// Another real player (multiplayer): talk to them for real, not here.
function realPlayerChat(id) {
  $("chat-picture").replaceChildren(wearing(id, cutout(id)));
  $("chat-name").textContent = character(id).name;
  $("bubble-text").textContent = `${character(id).name} is a real player! Talk to them for real... but keep your secret!`;
  $("bubble-list").hidden = true;
  $("bubble").hidden = false;
  $("questions").replaceChildren();
  show("screen-chat");
}

function openChat(id) {
  if (isHuman(game, id) && id !== game.playerId) return realPlayerChat(id);
  const c = character(id);
  // They stop to talk while you chat.
  const them = world && world.people[id];
  if (them) { them.mode = "chat"; them.timer = 3; them.with = game.playerId; }
  $("chat-picture").replaceChildren(wearing(id, cutout(id)));
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
  // A chat with a real player in it: go and talk to them for real.
  if (isHuman(game, a) || isHuman(game, b)) return realPlayerChat(isHuman(game, a) ? a : b);
  const j = joinChat(game, a, b);
  for (const id of [a, b]) {
    const p = world.people[id];
    if (p) { p.mode = "chat"; p.timer = 3; }
  }
  $("join-pictures").replaceChildren(wearing(a, cutout(a, "join-cutout")), wearing(b, cutout(b, "join-cutout")));
  $("join-names").textContent = `${character(a).name} and ${character(b).name}`;
  $("join-who").textContent = character(j.speaker).name + ":";
  $("join-text").textContent = j.text;
  // Welcome? Then Sam can talk to anyone in the group (Gareth).
  const actions = $("join-actions");
  actions.replaceChildren();
  if (j.welcome) {
    for (const id of [a, b]) {
      const btn = document.createElement("button");
      btn.className = "big join-chat";
      btn.dataset.id = id;
      btn.textContent = `Chat to ${character(id).name}`;
      btn.addEventListener("click", () => openChat(id));
      actions.append(btn);
    }
  }
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
  // A Traitor whispering to a Traitor is a secret (not spoken in multiplayer).
  say(spoken, id, { secret: game.playerSide === TRAITOR && isTraitor(game, id) });
}

function showVoicesButton() {
  $("voices").textContent = voicesOn() ? "Voices: On" : "Voices: Off";
}

// ─── The Round Table ────────────────────────────────────────────────────────

// First the talk: two accusations and their answers, one at a time, each
// spoken in that character's voice. Then Sam joins in.
// Everyone walks to the Round Table in slow motion, in one long line, to
// big drums (Sam, 2026-10-24: "slow motion walk towards the round table
// ... with some dramatic music"; every day, everyone at once).
async function walkToTable() {
  const line = $("walk-line");
  line.replaceChildren(...stillIn(game).map((id) => {
    const el = cutout(id);
    el.dataset.id = id;
    return wearing(id, el);
  }));
  // Restart the walk animation from the right-hand edge.
  line.style.animation = "none";
  void line.offsetWidth;
  line.style.animation = "";
  show("screen-walk");
  narrate("Everyone walks to the Round Table...");
  await play("walk");
  roundTableTalk();
}

async function roundTableTalk() {
  const lines = $("talk-lines");
  lines.replaceChildren();
  $("talk-options").hidden = true;
  $("to-vote").hidden = true;
  $("to-vote").textContent = "Time to vote";
  tieOnly = null;
  show("screen-talk");
  setRoomSound("table");   // a crackling fire (Gareth)
  setMusic("table");       // and tense music, for the whole Round Table (Gareth)
  // Each person finishes speaking before the next starts, and Sam's turn
  // only comes when everyone's done (Gareth: lines were cut off when he
  // tapped a choice too quickly).
  await narrate("Everyone sits down at the Round Table.");
  const talk = tableTalk(game);
  for (const t of talk) {
    addLine(lines, talkLine(t.speaker, t.text));
    await Promise.all([say(t.text, t.speaker), wait(900)]);
  }
  await wait(400);
  const opts = $("talk-options");
  opts.replaceChildren();
  for (const o of talkOptions(game, talk)) {
    const b = document.createElement("button");
    b.className = "question";
    b.textContent = o.text;
    b.addEventListener("click", async () => {
      opts.hidden = true;
      // Everyone's choices are made together; then each is said in turn.
      const { lines: said } = await engine.decide("says", o);
      for (const { id, option, reply } of said) {
        if (option.kind !== "quiet") {
          addLine(lines, talkLine(id, option.text, fullLabel(id)));
          await say(option.text, id);
        }
        if (reply) {
          addLine(lines, talkLine(reply.speaker, reply.text));
          await say(reply.text, reply.speaker);
        }
      }
      $("to-vote").hidden = false;
    });
    opts.append(b);
  }
  opts.hidden = false;
}

// Add a line and keep the newest in view (the list scrolls; the buttons
// below it stay on the screen).
// Speech bubbles take turns on the left and right; only the newest two
// show, and older ones fade away, so nothing goes off the bottom (Gareth,
// 2026-10-29). Old lines stay in the page, hidden.
export const TALK_SHOWN = 2;
function addLine(lines, row) {
  row.classList.add(lines.children.length % 2 ? "talk-right" : "talk-left");
  lines.append(row);
  const showing = [...lines.querySelectorAll(".talk-line:not(.talk-gone)")];
  for (const old of showing.slice(0, -TALK_SHOWN)) {
    old.classList.add("talk-fading");
    setTimeout(() => old.classList.add("talk-gone"), FAST ? 0 : 600);
  }
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

// A draw (Gareth, 2026-10-29): the new vote is between just these people,
// and they can't vote in it.
let tieOnly = null;

function goToTable() {
  tableVote = null;
  $("cast-vote").disabled = true;
  if (tieOnly?.includes(game.playerId)) return sitOut();
  $("table-title").textContent = tieOnly ? "Vote again! Who should leave?" : "Who do you think is a Traitor?";
  const cards = $("table-cards");
  cards.replaceChildren();
  for (const id of (tieOnly ?? stillIn(game)).filter((id) => id !== game.playerId)) {
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
  $("cast-vote").disabled = true;
  showVotes(await engine.decide(tieOnly ? "revote" : "votes", tableVote));
}
// Tied in a draw: the others vote without you.
async function sitOut() {
  $("boards").replaceChildren();
  $("most-votes").textContent = "You can't vote this time. The others are voting...";
  $("most-votes").hidden = false;
  $("to-reveal").hidden = true;
  $("tally").hidden = true;
  show("screen-votes");
  showVotes(await engine.decide("revote", null));
}

async function showVotes(result) {
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
    nameInto(who, voter, label(voter));
    if (voter === game.playerId) b.classList.add("me-board");
    if (voter === result.dagger) {
      const x2 = document.createElement("span");
      x2.className = "dagger-x2";
      x2.textContent = "x2";
      b.append(x2);
    }
    const chalk = document.createElement("span");
    chalk.className = "chalk";
    chalk.textContent = character(target).name + (target === game.playerId ? " (you!)" : "");
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
  if (result.tie) {
    const names = andList(result.tie.map((id) => character(id).name));
    $("most-votes").textContent = result.revote
      ? `Still a draw! ${names} must each pick a chest.`
      : `It's a draw! ${names} have ${result.counts[result.tie[0]]} votes each.`;
    $("most-votes").hidden = false;
    narrate($("most-votes").textContent);
    $("to-reveal").textContent = result.revote ? "To the chests" : "Hear them out";
    $("to-reveal").hidden = false;
    $("to-reveal").onclick = () => (result.revote ? chestScreen(result) : tieTalk(result));
    return;
  }
  tieOnly = null;
  const out = character(result.banished);
  $("most-votes").textContent = `${out.name} has the most votes: ${result.counts[result.banished]}.`;
  $("most-votes").hidden = false;
  narrate($("most-votes").textContent);
  $("to-reveal").textContent = "Find out...";
  $("to-reveal").hidden = false;
  $("to-reveal").onclick = () => reveal(result);
}

// A draw: the tied people each say something, then the new vote.
async function tieTalk(result) {
  tieOnly = result.tie;
  const me = game.playerId;
  const lines = $("talk-lines");
  lines.replaceChildren();
  const opts = $("talk-options");
  opts.hidden = true;
  $("to-vote").hidden = true;
  show("screen-talk");
  await narrate(`It's a draw! ${andList(result.tie.map((id) => character(id).name))}, you each get to say something.`);
  let part = null;
  if (result.tie.includes(me)) {
    part = await new Promise((resolve) => {
      opts.replaceChildren(...pleaOptions(game, me).map((text) => {
        const b = document.createElement("button");
        b.className = "question";
        b.textContent = text;
        b.addEventListener("click", () => { opts.hidden = true; resolve(text); });
        return b;
      }));
      opts.hidden = false;
    });
  }
  const { pleas } = await engine.decide("pleas", part);
  for (const p of pleas) {
    addLine(lines, talkLine(p.speaker, p.text, fullLabel(p.speaker)));
    await Promise.all([say(p.text, p.speaker), wait(900)]);
  }
  $("to-vote").textContent = result.tie.includes(me) ? "On to the vote" : "Vote again";
  $("to-vote").hidden = false;
}

// Still a draw: one chest each. One is empty; whoever gets it leaves.
const CHEST_SVG = `<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="8" y="34" width="84" height="42" rx="6" fill="#9a5b2a" stroke="#2b1a10" stroke-width="5"/>`
  + `<path class="lid" d="M8 36 Q8 8 50 8 Q92 8 92 36 Z" fill="#b8733a" stroke="#2b1a10" stroke-width="5"/>`
  + `<rect x="42" y="30" width="16" height="16" rx="3" fill="#f2c14e" stroke="#2b1a10" stroke-width="4"/></svg>`;
async function chestScreen(result) {
  tieOnly = null;
  const me = game.playerId;
  const tied = result.tie;
  const box = $("chests");
  const buttons = tied.map((_, i) => {
    const b = document.createElement("button");
    b.className = "chest";
    b.dataset.chest = i;
    b.innerHTML = CHEST_SVG;
    const who = document.createElement("span");
    who.className = "chest-who";
    b.append(who);
    return b;
  });
  box.replaceChildren(...buttons);
  $("chests-go").hidden = true;
  show("screen-chests");
  const mine = tied.includes(me);
  $("chest-text").textContent = "One chest is empty. The others hold a shield. Whoever gets the empty chest leaves the castle."
    + (mine ? " Pick a chest!" : "");
  narrate($("chest-text").textContent);
  let pick = null;
  if (mine) {
    pick = await new Promise((resolve) => {
      for (const b of buttons) b.onclick = () => {
        b.classList.add("picked");
        for (const o of buttons) o.onclick = null;
        resolve(Number(b.dataset.chest));
      };
    });
  }
  for (const b of buttons) { b.onclick = null; b.disabled = true; }
  const r = await engine.decide("chests", pick);
  for (const c of r.chests) {
    const b = buttons[c.chest];
    nameInto(b.querySelector(".chest-who"), c.id, label(c.id));
    await wait(900);
    b.classList.add("open", c.chest === r.empty ? "empty" : "safe");
    if (c.chest === r.empty) {
      b.append(Object.assign(document.createElement("span"), { className: "chest-inside", textContent: "Empty!" }));
    } else {
      b.append(Object.assign(document.createElement("img"), { className: "chest-inside", src: "assets/shield.png", alt: "Shield" }));
    }
  }
  const out = r.banished === me ? "You got" : `${character(r.banished).name} got`;
  $("chest-text").textContent = `${out} the empty chest!`;
  narrate($("chest-text").textContent);
  $("chests-go").hidden = false;
  $("chests-go").onclick = () => reveal(r);
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
    gameOver(`You've been banished! The Traitors are: ${traitorNames()}.`);
    return;
  }
  // What comes next: the night, the final (after day 12), or the end.
  afterReveal = won ? "ending" : game.day > DAYS ? "final" : "night";
  $("next-day").textContent = { ending: "The big reveal", final: "On to the final!", night: "Night falls..." }[afterReveal];
  $("after-reveal").hidden = false;
}
let afterReveal = "night";
function nextAfterReveal() {
  if (afterReveal === "ending") ending();
  else if (afterReveal === "final") finalScreen();
  else goNight();
}

// ─── The final (Sam: "like the TV show") ────────────────────────────────────
// Everyone left votes: end the game now, or banish someone else first.

function finalScreen() {
  const n = stillIn(game).length;
  $("final-text").textContent = `Day 12 is over! ${n} people are left. One by one, everyone throws a flame on the fire. Green to end the game. Red to banish someone else. It only ends if every flame is green.`;
  const choice = $("final-choice");
  choice.replaceChildren(...finalChoices(game).map((o) => {
    const b = document.createElement("button");
    b.className = "question final-option " + o.vote;
    b.dataset.vote = o.vote;
    b.textContent = o.text;
    b.addEventListener("click", () => finalChoice(o));
    return b;
  }));
  choice.hidden = false;
  $("final-stage").hidden = true;
  $("final-votes").replaceChildren();
  $("final-result").hidden = true;
  $("final-next").hidden = true;
  show("screen-final");
  setRoomSound("table");
  setMusic("table");
  narrate("The final! " + $("final-text").textContent + " What will you say?");
}

// Everyone throws their flame, one by one, and says why (Sam: "just like
// the TV show").
async function finalChoice(option) {
  $("final-choice").hidden = true;
  $("final-text").textContent = "Everyone gathers round the fire pit...";
  const { votes, allEnd } = await engine.decide("final", { vote: option.vote, line: option.text });
  $("final-stage").hidden = false;
  const speaker = $("final-speaker");
  const flame = $("final-flame");
  const box = $("final-votes");
  for (const [id, v, line] of votes) {
    // Who's speaking, and what they say.
    const bubble = document.createElement("p");
    bubble.className = "talk-bubble";
    const who = document.createElement("b");
    who.textContent = fullLabel(id) + ": ";
    bubble.append(who, line);
    speaker.replaceChildren(badge(character(id), true), bubble);
    speaker.dataset.id = id;
    flame.hidden = true;
    await say(line, id);
    // Their flame on the fire.
    flame.src = `assets/final/flame-${v === "end" ? "green" : "red"}.png`;
    flame.className = "flame burn";
    flame.hidden = false;
    play("chalk");
    const tile = document.createElement("div");
    tile.className = "who final-vote";
    tile.dataset.id = id;
    tile.dataset.vote = v;
    tile.append(badge(character(id)));
    const mini = document.createElement("img");
    mini.className = "mini-flame";
    mini.src = flame.src;
    mini.alt = v === "end" ? "End" : "Banish";
    const name = document.createElement("span");
    name.className = "who-name";
    nameInto(name, id, label(id));
    tile.append(mini, name);
    box.append(tile);
    await wait(1400);
  }
  const banishers = votes.filter(([, v]) => v === "banish").length;
  $("final-result").textContent = allEnd
    ? "Every flame is green! The game is over. Time for the big reveal..."
    : `${banishers === 1 ? "One red flame" : `${banishers} red flames`}! Back to the Round Table to banish someone else.`;
  $("final-result").hidden = false;
  narrate($("final-result").textContent);
  $("final-next").textContent = allEnd ? "The big reveal" : "Back to the Round Table";
  $("final-next").onclick = allEnd ? ending : goToTable;
  $("final-next").hidden = false;
}

// ─── The end: the big reveal, the money, a party, every Traitor ─────────────

async function ending() {
  clearSave();
  const left = stillIn(game);
  const share = prizeShare(game);
  $("ending-title").textContent = "The big reveal!";
  const row = $("ending-reveal");
  row.replaceChildren();
  $("ending-result").hidden = true;
  $("confetti").hidden = true;
  show("screen-ending");
  setRoomSound("table");
  narrate("The big reveal! Who is a Faithful, and who is a Traitor?");
  await drumRoll();
  // Everyone left turns round, one by one.
  for (const id of left) {
    const side = game.players.find((p) => p.id === id).side;
    const tile = document.createElement("div");
    tile.className = "who ending-tile";
    tile.dataset.id = id;
    tile.append(badge(character(id)));
    const name = document.createElement("span");
    name.className = "who-name";
    nameInto(name, id, label(id));
    const tag = document.createElement("span");
    tag.className = "who-tag " + side;
    tag.textContent = side === TRAITOR ? "TRAITOR!" : "FAITHFUL!";
    tile.append(name, tag);
    row.append(tile);
    play("chalk");
    say(side === TRAITOR ? "I'm a Traitor!" : "I'm a Faithful!", id);
    await wait(1300);
  }
  // Who wins the money.
  const money = `£${share.each.toLocaleString("en-GB")}`;
  const samWins = share.winners.includes(game.playerId);
  $("ending-winner").textContent = share.side === TRAITOR ? "The Traitors win!" : "The Faithfuls win!";
  $("ending-winner").className = "reveal " + share.side;
  $("ending-money").textContent = samWins
    ? `You win ${money}! Each winner gets ${money} from the £${(game.pot ?? 0).toLocaleString("en-GB")} pot.`
    : `Oh no! Each of them gets ${money}. Better luck next time!`;
  // Every Traitor of the whole game.
  const traitors = $("ending-traitors");
  traitors.replaceChildren();
  for (const t of allTraitors(game)) {
    const tile = document.createElement("div");
    tile.className = "who";
    tile.dataset.id = t.id;
    tile.append(badge(character(t.id)));
    const name = document.createElement("span");
    name.className = "who-name";
    nameInto(name, t.id, label(t.id));
    tile.append(name);
    const notes = [];
    if (t.recruited) notes.push("Recruited");
    notes.push(t.banished ? "Banished" : stillIn(game).includes(t.id) ? "Still here" : "Gone");
    for (const n of notes) {
      const tag = document.createElement("span");
      tag.className = "who-tag traitor";
      tag.textContent = n;
      tile.append(tag);
    }
    traitors.append(tile);
  }
  $("ending-result").hidden = false;
  narrate(`${$("ending-winner").textContent} ${$("ending-money").textContent}`, { queue: true });
  // A party if Sam wins; sad sounds if not.
  if (samWins) {
    party();
    play("cheering");
  } else {
    play("crying");
  }
}

function party() {
  const box = $("confetti");
  box.replaceChildren();
  const colours = ["#f2c14e", "#e2453c", "#3b7dd8", "#3fa34d", "#ffffff", "#c56bd6"];
  for (let i = 0; i < 80; i++) {
    const bit = document.createElement("span");
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colours[i % colours.length];
    bit.style.animationDelay = `${Math.random() * 2}s`;
    bit.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    box.append(bit);
  }
  box.hidden = false;
}

// Tests (?fast=1) can jump straight to the final or the end.
if (FAST) {
  window.castleJump = { finalScreen, ending, showRoster: () => showRoster(), enterCastle: () => enterCastle(),
    // A draw between `ids`, from its start or (chests) after a tied new vote.
    tie: (ids, chestsNow = false) => {
      game.tie = { day: game.day, votes: [], counts: Object.fromEntries(ids.map((id) => [id, 1])), tied: ids };
      return chestsNow ? chestScreen({ tie: ids, revote: true }) : tieTalk({ tie: ids, counts: game.tie.counts });
    } };
}

// Everyone who's a Traitor now (still in), for players who are out.
const traitorNames = () => stillIn(game).filter((id) => isTraitor(game, id)).map(fullLabel).join(", ") || "all caught!";

function gameOver(text) {
  clearSave();
  $("game-over-text").textContent = text;
  narrate(text, { queue: true });
  $("game-over").hidden = false;
}

// ─── The night ──────────────────────────────────────────────────────────────

let victimPick = null;

// The night is one decision (engine.js): a Traitor chooses first (what to
// do, who, and the dagger if it's that night), everyone else just waits,
// then it's decided and each player sees what happened to them.
async function goNight() {
  setRoomSound(null);
  setMusic(null);
  const me = game.playerId;
  const kind = nightKind(game);
  let part = null;
  if (game.playerSide === TRAITOR && stillIn(game).includes(me)) {
    part = await traitorsNight(kind);
  }
  // Night falls (a Traitor's choices are in; everyone waits for the rest).
  $("night-title").textContent = "Night falls...";
  $("night-text").textContent = game.playerSide === TRAITOR
    ? (kind === "quiet" ? "Tonight the Traitors just plot. No murder tonight." : "The Traitors' plan is set...")
    : "The Traitors are meeting in secret.";
  $("letter").hidden = true;
  $("envelope").hidden = true;
  $("to-breakfast").hidden = true;
  $("night-over").hidden = true;
  show("screen-night");
  play("night");
  narrate(`Night falls. ${$("night-text").textContent}`);
  const result = await engine.decide("night", part);
  nightResult = result;
  // A Traitor who made the plan goes straight to breakfast (as before).
  if (part && part.choice !== "none" && game.playerSide === TRAITOR) return breakfast(result.victim ?? null);
  await wait(1800);
  if (result.victim === me) {
    clearSave();
    await sealedLetter("you have been murdered.");
    // Out, and a Faithful: now you may know who the Traitors are (Gareth).
    $("night-text").textContent = `The Traitors are: ${traitorNames()}.`;
    $("night-over").hidden = false;
    return;
  }
  if (result.recruited === me) {
    const others = stillIn(game).filter((id) => id !== me && isTraitor(game, id)).map((id) => character(id).name);
    await sealedLetter(`you are now a Traitor! Your fellow Traitors are ${others.join(", ")}.`);
  } else if (game.playerSide !== TRAITOR) {
    $("night-text").textContent = "Phew! No letter for you tonight.";
    narrate("Phew! No letter for you tonight.", { queue: true });
  }
  $("to-breakfast").hidden = false;
}
let nightResult = {};

// A letter from the Traitors slides under the door, sealed. Tap it: it
// unfolds and is read out (Gareth). Resolves once it has been opened.
async function sealedLetter(words) {
  $("night-text").textContent = "There's a letter under your door...";
  narrate("There's a letter under your door... Tap it to open it.", { queue: true });
  await wait(1200);
  $("letter-big").textContent = words;
  $("envelope").className = "envelope";
  $("envelope").hidden = false;
  play("letter");
  await new Promise((resolve) => { $("envelope").onclick = resolve; });
  $("envelope").onclick = null;
  $("envelope").classList.add("opening");
  await wait(700);
  $("envelope").hidden = true;
  $("letter").classList.remove("unfold");
  void $("letter").offsetWidth;
  $("letter").classList.add("unfold");
  $("letter").hidden = false;
  narrate(`By order of the Traitors, ${words}`, { secret: words.includes("Traitor!") });
}

// A Traitor's night: choose (with only 2 left), pick who, and give out the
// dagger if it's that night. Returns their part of the decision.
async function traitorsNight(kind) {
  if (kind === "quiet") return { choice: "none" };
  let mode = kind === "recruit" ? "recruit" : "murder";
  if (kind === "choose") {
    const choice = await chooseScreen();
    if (choice === "none") return { choice };
    mode = choice;
  }
  const pick = await traitorsMeeting(mode);
  const dagger = daggerTonight(game, mode === "murder") ? await daggerMeeting() : null;
  return { choice: mode, pick, dagger };
}

// With only 2 Traitors left, a Traitor chooses: recruit someone new, or
// murder (or, on a no-murder night, do nothing).
function chooseScreen() {
  play("night");
  const murder = canMurderTonight(game);
  $("meeting-hint").textContent = murder
    ? "Only 2 Traitors are left! Recruit someone new tonight, or murder someone?"
    : "Only 2 Traitors are left! There's no murder tonight, but you can still recruit someone new.";
  narrate($("meeting-hint").textContent);
  $("traitor-ideas").replaceChildren();
  $("murder").hidden = true;
  show("screen-traitors");
  return new Promise((resolve) => {
    const option = (text, choice) => {
      const b = document.createElement("button");
      b.className = "question choose-option";
      b.textContent = text;
      b.addEventListener("click", () => { $("murder").hidden = false; resolve(choice); });
      return b;
    };
    $("victim-cards").replaceChildren(
      option("Recruit someone new", "recruit"),
      murder ? option("Murder someone", "murder") : option("Do nothing tonight", "none"),
    );
  });
}

// Pick someone from cards; resolves when the big button is tapped.
let meetingDone = null;
function pickFromCards(ids, button) {
  victimPick = null;
  $("murder").hidden = false;
  $("murder").disabled = true;
  $("murder").textContent = button;
  const cards = $("victim-cards");
  cards.replaceChildren();
  for (const id of ids) {
    const el = card(character(id), null);
    el.addEventListener("click", () => {
      victimPick = id;
      for (const other of cards.children) other.classList.toggle("picked", other === el);
      $("murder").disabled = false;
    });
    cards.append(el);
  }
  show("screen-traitors");
  return new Promise((resolve) => { meetingDone = resolve; });
}

function traitorsMeeting(mode) {
  play("night");
  const recruiting = mode === "recruit";
  const fewLeft = recruiting && game.history.length > 1;
  $("meeting-hint").textContent = recruiting
    ? `${fewLeft ? "Only 2 Traitors are left! " : ""}Tonight the Traitors recruit someone new. Who should join you? You pick.`
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
    say(line, f, { queue: true, secret: true });
  });
  if (fellows.length === 0) {
    const p = document.createElement("p");
    p.className = "idea";
    p.textContent = "You're the last Traitor. It's all up to you!";
    box.append(p);
    narrate(p.textContent, { queue: true });
  }
  return pickFromCards(ideas, recruiting ? "Recruit them" : "Send the letter");
}

// The night it gets down to 8, the Traitors also give out the dagger (Sam).
function daggerMeeting() {
  $("meeting-hint").textContent = "Only 8 players left! Who gets the dagger? It can be anyone, even you. Their vote counts twice at the next Round Table.";
  narrate($("meeting-hint").textContent);
  const ideas = daggerIdeas(game);
  const fellows = stillIn(game).filter((id) => id !== game.playerId && isTraitor(game, id));
  const box = $("traitor-ideas");
  box.replaceChildren();
  fellows.forEach((f) => {
    const idea = ideas[0] === f ? "me" : label(ideas[0]);
    const line = `Give the dagger to ${idea}. Two votes for us!`;
    const p = document.createElement("p");
    p.className = "idea";
    p.textContent = `${character(f).name}: "${line}"`;
    box.append(p);
    say(line, f, { queue: true, secret: true });
  });
  return pickFromCards(stillIn(game), "Give them the dagger");
}

// The dagger in someone's hand, shown on their puppet and cut-out.
function daggerImg() {
  const d = document.createElement("img");
  d.className = "held-dagger";
  d.src = "assets/dagger.png";
  d.alt = "";
  d.draggable = false;
  return d;
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
      nameInto(name, id, label(id));
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
    const name = document.createElement("span");
    nameInto(name, p.id, label(p.id));
    who.append(name);
    gone.append(who);
  }
  $("gone-box").hidden = false;
  // A no-murder night is announced at breakfast, so everyone knows (Sam).
  const quiet = noMurderToday(game, todaysMission(game)?.id);
  $("quiet-news").hidden = !quiet;
  if (quiet) narrate($("quiet-news").textContent, { queue: true });
  const holder = daggerHolder(game);
  $("dagger-news").hidden = !holder;
  if (holder) {
    $("dagger-news").textContent = holder === game.playerId
      ? "The Traitors gave YOU the dagger! Your vote counts twice at today's Round Table."
      : `The Traitors gave the dagger to ${character(holder).name}! Their vote counts twice at today's Round Table.`;
    narrate($("dagger-news").textContent, { queue: true });
  }
  const won = winner(game);
  if (won) {
    const traitors = game.players.filter((p) => p.side === TRAITOR).map((p) => character(p.id).name);
    $("breakfast-over-text").textContent =
      `${won === FAITHFUL ? "The Faithfuls win" : "The Traitors win"} the £${(game.pot ?? 0).toLocaleString("en-GB")} pot! The Traitors were ${traitors.join(", ")}.`;
    narrate($("breakfast-over-text").textContent, { queue: true });
    clearSave();
    $("breakfast-over").hidden = false;
  } else {
    $("start-day").hidden = false;
  }
}

// ─── Pause: who's who ───────────────────────────────────────────────────────

function openOverview() {
  const people = $("overview-people");
  people.replaceChildren();
  for (const p of whosWho(game)) {
    const tile = document.createElement("div");
    tile.className = "who" + (p.gone ? " who-gone" : "") + (p.you ? " who-you" : "");
    tile.dataset.id = p.id;
    tile.append(badge(character(p.id)));
    const name = document.createElement("span");
    name.className = "who-name";
    nameInto(name, p.id, label(p.id));
    tile.append(name);
    const lines = [];
    if (p.gone === "banished") lines.push(["Banished", ""]);
    if (p.gone === "murdered") lines.push(["Murdered", ""]);
    if (p.side) lines.push([p.side === TRAITOR ? "Traitor" : "Faithful", p.side]);
    if (p.shield) lines.push(["Has a shield", "shield"]);
    if (p.dagger) lines.push(["Has the dagger", "traitor"]);
    for (const [text, kind] of lines) {
      const tag = document.createElement("span");
      tag.className = "who-tag " + kind;
      tag.textContent = text;
      tile.append(tag);
    }
    people.append(tile);
  }
  const left = stillIn(game).length;
  $("overview-title").textContent = `Day ${Math.min(game.day, DAYS)} of ${DAYS}`;
  $("overview-pot").textContent = `${left} people left. The pot: £${(game.pot ?? 0).toLocaleString("en-GB")}.`;
  $("overview").hidden = false;
}

// ─── Buttons ────────────────────────────────────────────────────────────────

$("pause").addEventListener("click", openOverview);
$("overview-close").addEventListener("click", () => { $("overview").hidden = true; });

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
$("to-table").addEventListener("click", async () => {
  $("to-table").disabled = true;
  await engine.decide("go", true);   // everyone heads to the table together
  $("to-table").disabled = false;
  walkToTable();
});
$("to-vote").addEventListener("click", goToTable);
$("cast-vote").addEventListener("click", castVote);
$("next-day").addEventListener("click", async () => {
  $("next-day").disabled = true;
  await engine.decide("go", true);
  $("next-day").disabled = false;
  nextAfterReveal();
});
$("murder").addEventListener("click", () => {
  if (!victimPick || !meetingDone) return;
  const done = meetingDone;
  meetingDone = null;
  done(victimPick);
});
$("to-breakfast").addEventListener("click", () => breakfast(nightResult.victim ?? null));
$("start-day").addEventListener("click", async () => {
  $("start-day").disabled = true;
  await engine.decide("go", true);
  $("start-day").disabled = false;
  startDay();
});
for (const id of ["play-again", "night-play-again", "breakfast-play-again", "ending-play-again"]) {
  $(id).addEventListener("click", () => location.reload());
}
