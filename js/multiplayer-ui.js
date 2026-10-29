// Multiplayer screens (Phase 8, docs/multiplayer-spec.md): Host or Join,
// the symbol code, and the lobby where everyone picks a character. Rules
// come from lobby.js; rooms are shared through net.js.
import { CHARACTERS } from "./characters.js";
import {
  SYMBOLS, CODE_LENGTH, newCode, codeName, newRoom, join, pick, takenBy, canStart, seatOrder,
  setName,
} from "./lobby.js";
import { localNet } from "./net.js";
import { netEngine, resumePoint, waitingLine } from "./net-engine.js";
import { arriveAtCastle, winner } from "./castle.js";
import { newGame } from "./game.js";
import { firebaseNet } from "./firebase-net.js";
import { $, show, badge, card, character, FAST } from "./ui.js";
import { narrate } from "./voice.js";

// Drawn icons: the code symbols, and the buttons' pictures. Sam's own
// shield and dagger drawings are two of the symbols.
const INK = 'stroke="#241238" stroke-width="3" stroke-linejoin="round"';
const SVGS = {
  one: `<circle cx="32" cy="18" r="10" fill="#ffd447" ${INK}/><path d="M14 58c0-14 8-22 18-22s18 8 18 22z" fill="#6fb6ff" ${INK}/>`,
  many: `<circle cx="18" cy="24" r="8" fill="#ff8a7a" ${INK}/><path d="M4 58c0-12 6-18 14-18s14 6 14 18z" fill="#ff8a7a" ${INK}/>`
    + `<circle cx="46" cy="24" r="8" fill="#7be08f" ${INK}/><path d="M32 58c0-12 6-18 14-18s14 6 14 18z" fill="#7be08f" ${INK}/>`
    + `<circle cx="32" cy="16" r="9" fill="#ffd447" ${INK}/><path d="M17 58c0-14 7-20 15-20s15 6 15 20z" fill="#6fb6ff" ${INK}/>`,
  crown: `<path d="M8 50 L12 18 L24 34 L32 12 L40 34 L52 18 L56 50 Z" fill="#ffd447" ${INK}/><rect x="8" y="48" width="48" height="8" fill="#f5a623" ${INK}/>`,
  key: `<circle cx="18" cy="32" r="11" fill="#ffd447" ${INK}/><circle cx="18" cy="32" r="4" fill="#fff8e0" ${INK}/><path d="M29 29h28v7h-5v7h-6v-7h-4v5h-6v-5h-7z" fill="#ffd447" ${INK}/>`,
  star: `<polygon points="32,5 40,24 60,25 44,38 50,58 32,46 14,58 20,38 4,25 24,24" fill="#ffd447" ${INK}/>`,
  moon: `<path d="M40 6a26 26 0 1 0 18 40A21 21 0 0 1 40 6z" fill="#cfd8ff" ${INK}/>`,
  sun: `<g fill="#f5a623" ${INK}><circle cx="32" cy="32" r="13"/></g><g stroke="#f5a623" stroke-width="5" stroke-linecap="round"><path d="M32 4v9M32 51v9M4 32h9M51 32h9M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g>`,
  bell: `<path d="M32 8c-11 0-16 9-16 20v12l-6 8h44l-6-8V28c0-11-5-20-16-20z" fill="#ffd447" ${INK}/><circle cx="32" cy="54" r="5" fill="#f5a623" ${INK}/>`,
};
const PICTURES = { shield: "assets/shield.png", dagger: "assets/dagger.png" };

export function icon(name, size = 56) {
  if (PICTURES[name]) {
    const img = document.createElement("img");
    img.src = PICTURES[name];
    img.alt = name;
    img.className = "symbol-icon";
    img.style.height = `${size}px`;
    return img;
  }
  const span = document.createElement("span");
  span.className = "symbol-icon";
  span.innerHTML = `<svg viewBox="0 0 64 64" width="${size}" height="${size}">${SVGS[name]}</svg>`;
  return span;
}

// Fill the [data-icon] spots in the page's buttons.
for (const spot of document.querySelectorAll("[data-icon]")) spot.replaceChildren(icon(spot.dataset.icon, 72));

// Gareth's Firebase project, between devices. Tests (?fast=1) and ?local
// use the local version (between tabs), so they never touch the internet.
const local = FAST || new URLSearchParams(location.search).has("local");
const net = local ? localNet() : firebaseNet();
let roomName = null;
let stopWatching = null;
let current = null;   // the room as we last saw it

// Something went wrong talking to the other devices: say so plainly.
function trouble(where, err) {
  console.error(err);
  $(where).textContent = "Couldn't reach the other devices. Check the internet and try again.";
  $(where).hidden = false;
}

// ─── Host ───────────────────────────────────────────────────────────────────

async function host() {
  try {
    await net.ready();
    // A code nobody is using (try a few).
    let code = newCode();
    for (let i = 0; i < 5 && await net.readRoom(codeName(code)); i++) code = newCode();
    roomName = codeName(code);
    await net.createRoom(roomName, newRoom(code, net.uid, Date.now()));
  } catch (err) {
    show("screen-multi");
    return trouble("multi-error", err);
  }
  openLobby();
  narrate("You're the host! Show everyone the four symbols so they can join.");
}

// ─── Join: tap the four symbols ─────────────────────────────────────────────

let typed = [];
function drawSlots(box, code) {
  box.replaceChildren(...Array.from({ length: CODE_LENGTH }, (_, i) => {
    const slot = document.createElement("span");
    slot.className = "code-slot";
    if (code[i]) slot.append(icon(code[i]));
    return slot;
  }));
}
function openJoin() {
  typed = [];
  drawSlots($("mp-join-slots"), typed);
  $("mp-join-error").hidden = true;
  $("mp-join-go").disabled = true;
  const box = $("mp-join-symbols");
  box.replaceChildren(...SYMBOLS.map((name) => {
    const b = document.createElement("button");
    b.className = "symbol-button";
    b.dataset.symbol = name;
    b.append(icon(name));
    b.addEventListener("click", () => {
      if (typed.length >= CODE_LENGTH) return;
      typed.push(name);
      drawSlots($("mp-join-slots"), typed);
      $("mp-join-go").disabled = typed.length < CODE_LENGTH;
    });
    return b;
  }));
  show("screen-mp-join");
}
async function tryJoin() {
  const name = codeName(typed);
  let problem = null;
  try {
    await net.ready();
    const room = await net.readRoom(name);
    if (!room) problem = "There's no game with that code. Check the symbols!";
    else {
      const r = join(room, net.uid, Date.now());
      if (r.error) problem = r.error === "full" ? "That game is full." : "That game has already started.";
      else await net.setSeat(name, net.uid, r.room.seats[net.uid]);
    }
  } catch (err) {
    return trouble("mp-join-error", err);
  }
  if (problem) {
    $("mp-join-error").textContent = problem;
    $("mp-join-error").hidden = false;
    return;
  }
  roomName = name;
  openLobby();
}

// ─── The lobby: who's in, pick characters, start ────────────────────────────

function openLobby() {
  stopWatching?.();
  show("screen-lobby");
  stopWatching = net.watchRoom(roomName, drawLobby);
}

function drawLobby(room) {
  if (!room || !room.seats) return;
  current = room;
  const me = net.uid;
  const isHost = room.host === me;
  $("lobby-title").textContent = isHost ? "You're the host!" : "You're in!";
  drawSlots($("lobby-code"), room.code.split("-"));
  const mine = room.seats[me]?.character;
  $("lobby-hint").textContent = mine
    ? (isHost ? "Start when everyone has picked. Remember: keep your role secret!" : "Waiting for the host to start...")
    : "Pick who you want to be. Others can't pick the same one.";
  // Who's in.
  $("lobby-players").replaceChildren(...seatOrder(room).map((uid) => {
    const tile = document.createElement("div");
    tile.className = "who" + (uid === me ? " who-you" : "");
    tile.dataset.uid = uid;
    const c = room.seats[uid].character;
    if (c) tile.append(badge(character(c)));
    const name = document.createElement("span");
    name.className = "who-name";
    const real = room.seats[uid].name;
    if (real) name.append(Object.assign(document.createElement("span"), { className: "real-name", textContent: real }), document.createElement("br"));
    name.append((c ? character(c).name : "Choosing...") + (uid === me ? " (you)" : "") + (uid === room.host ? " (host)" : ""));
    tile.append(name);
    return tile;
  }));
  // Characters to pick.
  const cards = $("lobby-cards");
  if (cards.children.length !== CHARACTERS.length) {
    cards.replaceChildren(...CHARACTERS.map((c) => {
      const el = card(c, null);
      el.addEventListener("click", () => {
        const p = pick(current, net.uid, c.id);
        if (!p.error) net.setSeat(roomName, net.uid, p.room.seats[net.uid]).catch((err) => console.error(err));
      });
      return el;
    }));
  }
  for (const el of cards.children) {
    const owner = takenBy(room, el.dataset.id);
    el.classList.toggle("picked", owner === me);
    el.classList.toggle("taken", !!owner && owner !== me);
    el.disabled = !!owner && owner !== me;
  }
  const box = $("lobby-name");
  if (document.activeElement !== box) box.value = room.seats[me]?.name ?? "";
  $("lobby-name-row").hidden = room.started;
  $("lobby-start").hidden = !isHost || room.started;
  $("lobby-start").disabled = !canStart(room);
  $("lobby-cards").hidden = room.started;
  $("lobby-soon").hidden = true;
  if (room.started) begin(room);
}

function startGame() {
  if (!current || !canStart(current)) return;
  // The deal: a seed for the shared game, the real players (by character)
  // in seat order, and which device each is.
  const order = seatOrder(current);
  const play = {
    seed: Date.now() % 2147483647,
    humans: order.map((uid) => current.seats[uid].character),
    uids: Object.fromEntries(order.map((uid) => [current.seats[uid].character, uid])),
    names: Object.fromEntries(order.filter((uid) => current.seats[uid].name)
      .map((uid) => [current.seats[uid].character, current.seats[uid].name])),
  };
  net.setRoom(roomName, { started: true, play }).catch((err) => console.error(err));
}

// Everyone's game starts the same way (engine.js keeps them in step); main.js
// tells each player their secret side.
let begun = false;
function begin(room, rejoining = false) {
  if (begun || !room.play || !room.seats[net.uid]) return;
  begun = true;
  const me = room.seats[net.uid].character;
  const game = newGame(me, room.play.seed, room.play.humans);
  game.names = room.play.names ?? {};
  // Rejoining: arrive first, so the engine can apply everything decided so
  // far (a new game arrives at the castle later, in goToCastle).
  if (rejoining) arriveAtCastle(game);
  const engine = netEngine(net, roomName, game, room.host === net.uid, showWaiting);
  engineRef = engine;
  remember();
  if (!rejoining) {
    document.dispatchEvent(new CustomEvent("multiplayer-start", { detail: { game, engine } }));
    return;
  }
  engine.catchUp().then(({ types, results }) => {
    const pos = resumePoint(types, winner(game) !== null);
    document.dispatchEvent(new CustomEvent("multiplayer-rejoin", { detail: { game, engine, pos, results } }));
  });
}

// ─── Rejoining (a reload, or the iPad went to sleep) ────────────────────────
// This device remembers the game it's in, and its sign-in, so the station
// can offer to rejoin it.
const REJOIN = "project-sam-rejoin";
function remember() {
  try {
    const auth = sessionStorage.getItem("project-sam-firebase");
    const uid = sessionStorage.getItem("project-sam-uid");
    localStorage.setItem(REJOIN, JSON.stringify({ room: roomName, auth, uid, local }));
  } catch { /* can't remember: no rejoin, that's all */ }
}
export function forget() {
  try { localStorage.removeItem(REJOIN); } catch { /* fine */ }
}
async function offerRejoin() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(REJOIN)); } catch { saved = null; }
  if (!saved || saved.local !== local) return;
  try {
    if (saved.auth && !sessionStorage.getItem("project-sam-firebase")) sessionStorage.setItem("project-sam-firebase", saved.auth);
    if (saved.uid && !sessionStorage.getItem("project-sam-uid")) sessionStorage.setItem("project-sam-uid", saved.uid);
  } catch { /* fine */ }
  await net.ready();
  const room = await net.readRoom(saved.room).catch(() => null);
  if (!room || !room.started || !room.seats?.[net.uid]) return forget();
  $("rejoin").hidden = false;
  $("rejoin").onclick = () => {
    roomName = saved.room;
    current = room;
    stopWatching?.();
    stopWatching = net.watchRoom(roomName, (r) => { if (r) current = r; });
    begin(room, true);
  };
}
// (Tests switch it on with ?rejoin.)
if (!FAST || new URLSearchParams(location.search).has("rejoin")) offerRejoin().catch((err) => console.error(err));

// ─── Waiting for the others ─────────────────────────────────────────────────
// A sign at the top while this device waits for other players; after a
// while the host can choose not to wait (a sleeping iPad, say).
let waitTimer = null;
let engineRef = null;
function showWaiting(who, type) {
  const sign = $("waiting");
  clearTimeout(waitTimer);
  const others = who.filter((id) => id !== (window.game && window.game.playerId));
  if (others.length === 0) { sign.hidden = true; return; }
  waitTimer = setTimeout(() => {
    $("waiting-text").textContent = waitingLine(others.map((id) => character(id).name), type);
    sign.hidden = false;
    $("dont-wait").hidden = !(engineRef && engineRef.isHost);
  }, FAST ? 0 : 1500);
}

// ─── Buttons ────────────────────────────────────────────────────────────────

$("mode-multi").addEventListener("click", () => show("screen-multi"));
$("multi-back").addEventListener("click", () => show("screen-mode"));
$("multi-host").addEventListener("click", host);
$("multi-join").addEventListener("click", openJoin);
$("mp-join-back").addEventListener("click", () => show("screen-multi"));
$("mp-join-clear").addEventListener("click", openJoin);
$("mp-join-go").addEventListener("click", tryJoin);
$("lobby-start").addEventListener("click", startGame);
// Your real name: saved when you finish typing (or tap Done).
function saveName() {
  if (!current) return;
  const r = setName(current, net.uid, $("lobby-name").value);
  if (r.error) return;
  $("lobby-name").value = r.room.seats[net.uid].name;
  net.setSeat(roomName, net.uid, r.room.seats[net.uid]).catch((err) => console.error(err));
}
$("lobby-name").addEventListener("change", saveName);
$("lobby-name").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
$("dont-wait").addEventListener("click", () => { engineRef?.dontWait(); $("waiting").hidden = true; });
$("lobby-leave").addEventListener("click", () => { stopWatching?.(); location.reload(); });

// For the tests: which tab this is, and its room.
window.multiplayer = { get uid() { return net.uid; }, get room() { return roomName; } };
