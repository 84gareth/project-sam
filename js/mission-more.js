// The other nine missions' screens (docs/missions.md). Each gets a box to
// draw in and finishes with a score from 0 to 1. Rules come from
// missions.js; this file draws and listens.
import {
  whereRounds, jumbleWords, noteFrom, secretCode, CODE_TRIES, makeMaze, canStep, mazeScore,
  MAZE_W, MAZE_H, MAZE_SECONDS, keySpots, KEYS, KEYS_SECONDS, footprintTrail, footprintNote,
  galleryRounds, treasureSpot, treasureTap, treasureScore, TREASURE_TAPS, lightsTray, lightsScore,
  PIECES, LIGHTS_SECONDS, gone,
} from "./missions.js";
import { stillIn } from "./castle.js";
import { ROOMS } from "./puppets.js";
import { badge, character, wait, FAST } from "./ui.js";
import { say } from "./voice.js";

const ROOM_NAME = Object.fromEntries(ROOMS.map((r) => [r.id, r.name.toLowerCase()]));

function el(tag, className = "", text = "") {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}
const button = (className, text) => el("button", className, text);
// Wait for one of `buttons` to be tapped; resolves with its index.
const tapOne = (buttons) => new Promise((resolve) => {
  buttons.forEach((b, i) => { b.onclick = () => resolve(i); });
});
const nameOf = (game, id) => (id === game.playerId ? "you" : character(id).name);

// A note from someone who has gone (Sam): who they suspected.
function readNote(game, who) {
  const note = noteFrom(game, who);
  if (!note) return "";
  const text = `A note from ${character(who).name}: "I think ${nameOf(game, note.suspect)} ${note.suspect === game.playerId ? "are" : "is"} a Traitor!"`;
  say(`I think ${nameOf(game, note.suspect)} ${note.suspect === game.playerId ? "are" : "is"} a Traitor!`, who, { queue: true });
  return text;
}

// A countdown shown in the status line. Calls `end` when time is up.
function countdown(ctx, seconds, label, end) {
  let left = seconds;
  const show = () => ctx.status(`${label} ${left} seconds left.`);
  show();
  ctx.every(1000, () => {
    left -= 1;
    if (left <= 0) end();
    else show();
  });
}

// ─── Who Was Where? ─────────────────────────────────────────────────────────

async function where(ctx) {
  const { game, box } = ctx;
  const { rooms, questions } = whereRounds(game, stillIn(game));
  const grid = el("div", "where-rooms");
  for (const room of ROOMS) {
    const card = el("div", "where-room");
    card.style.backgroundImage = `url("${room.picture}")`;
    card.append(el("span", "where-room-name", room.name));
    const people = el("div", "where-people");
    for (const id of rooms[room.id]) people.append(badge(character(id)));
    card.append(people);
    grid.append(card);
  }
  box.replaceChildren(grid);
  ctx.status("Remember who is in each room!");
  await wait(7000);
  let right = 0;
  for (const [i, q] of questions.entries()) {
    box.dataset.question = i;
    ctx.status(`Who was in the ${ROOM_NAME[q.room]}?`);
    const options = q.options.map((id) => {
      const b = button("where-option");
      b.dataset.id = id;
      b.append(badge(character(id)), el("span", "", character(id).name));
      return b;
    });
    const row = el("div", "where-options");
    row.append(...options);
    box.replaceChildren(row);
    const picked = q.options[await tapOne(options)];
    if (picked === q.answer) right += 1;
    ctx.status(picked === q.answer ? "Yes!" : `No, it was ${character(q.answer).name}.`);
    await wait(1200);
  }
  ctx.finish(right / 3, `You got ${right} out of 3 right!`);
}

// ─── Letter Jumble ──────────────────────────────────────────────────────────

async function jumble(ctx) {
  const { game, box } = ctx;
  const words = jumbleWords(game, stillIn(game));
  let solved = 0;
  let note = "";
  for (const [i, w] of words.entries()) {
    box.dataset.word = i;
    ctx.status(w.note ? "Someone who has left the castle..." : `Name ${i + 1} of 3. Who is it?`);
    const ok = await new Promise((resolve) => {
      const answer = el("div", "jumble-answer");
      const tiles = el("div", "jumble-tiles");
      let typed = "";
      const slots = [...w.word].map(() => el("span", "jumble-slot"));
      answer.append(...slots);
      const reset = () => {
        typed = "";
        for (const s of slots) s.textContent = "";
        for (const t of tiles.children) t.disabled = false;
      };
      w.letters.forEach((letter) => {
        const t = button("jumble-tile", letter);
        t.dataset.letter = letter;
        t.onclick = () => {
          t.disabled = true;
          slots[typed.length].textContent = letter;
          typed += letter;
          if (typed.length < w.word.length) return;
          if (typed === w.word) resolve(true);
          else {
            answer.classList.remove("shake");
            void answer.offsetWidth;
            answer.classList.add("shake");
            ctx.status("Not quite! Try again.");
            setTimeout(reset, FAST ? 0 : 500);
          }
        };
        tiles.append(t);
      });
      const again = button("question", "Start again");
      again.onclick = reset;
      const skip = button("question", "Skip");
      skip.id = "jumble-skip";
      skip.onclick = () => resolve(false);
      const tools = el("div", "jumble-tools");
      tools.append(again, skip);
      box.replaceChildren(answer, tiles, tools);
    });
    if (ok) {
      solved += 1;
      ctx.status(`Yes! It's ${character(w.id).name}!`);
      if (w.note) note = readNote(game, w.id);
    } else {
      ctx.status(`It was ${w.word}.`);
    }
    await wait(1400);
  }
  ctx.finish(solved / 3, `You spelled ${solved} out of 3 names!`, null, note);
}

// ─── Secret Code ────────────────────────────────────────────────────────────

const SVG = "http://www.w3.org/2000/svg";
function shape({ shape: kind, colour }, size = 44) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.classList.add("code-shape");
  const paths = {
    circle: '<circle cx="20" cy="20" r="15"/>',
    square: '<rect x="6" y="6" width="28" height="28" rx="3"/>',
    triangle: '<polygon points="20,4 37,35 3,35"/>',
    diamond: '<polygon points="20,3 37,20 20,37 3,20"/>',
    cross: '<polygon points="14,3 26,3 26,14 37,14 37,26 26,26 26,37 14,37 14,26 3,26 3,14 14,14"/>',
  };
  svg.innerHTML = paths[kind];
  svg.setAttribute("fill", colour);
  return svg;
}

async function code(ctx) {
  const { game, box } = ctx;
  const { words, key } = secretCode(game);
  const keyBox = el("div", "code-key");
  for (const letter of Object.keys(key).sort()) {
    const k = el("div", "code-pair");
    k.append(shape(key[letter], 32), el("span", "", letter));
    keyBox.append(k);
  }
  let solved = 0;
  for (const [i, word] of words.entries()) {
    box.dataset.word = i;
    ctx.status(`Secret word ${i + 1} of 3. What does it say?`);
    const ok = await new Promise((resolve) => {
      const row = el("div", "code-word");
      const cells = [...word].map((letter) => {
        const c = el("div", "code-cell");
        c.append(shape(key[letter]), el("span", "code-letter"));
        row.append(c);
        return c;
      });
      cells[0].classList.add("now");
      let at = 0, mistakes = 0;
      const letters = el("div", "code-letters");
      for (const letter of Object.keys(key).sort()) {
        const b = button("code-button", letter);
        b.dataset.letter = letter;
        b.onclick = () => {
          if (letter === word[at]) {
            cells[at].querySelector(".code-letter").textContent = letter;
            cells[at].classList.remove("now");
            at += 1;
            if (at === word.length) return resolve(true);
            cells[at].classList.add("now");
          } else {
            mistakes += 1;
            row.classList.remove("shake");
            void row.offsetWidth;
            row.classList.add("shake");
            ctx.status(`Oops! ${CODE_TRIES - mistakes} wrong letter${CODE_TRIES - mistakes === 1 ? "" : "s"} left.`);
            if (mistakes >= CODE_TRIES) resolve(false);
          }
        };
        letters.append(b);
      }
      box.replaceChildren(keyBox, row, letters);
    });
    ctx.status(ok ? `Cracked it! ${word}!` : `The word was ${word}.`);
    if (ok) solved += 1;
    await wait(1400);
  }
  ctx.finish(solved / 3, `You cracked ${solved} out of 3 secret words!`);
}

// ─── Garden Maze ────────────────────────────────────────────────────────────

function maze(ctx) {
  const { game, box } = ctx;
  const m = makeMaze(game);
  let at = [...m.start];
  const grid = el("div", "maze");
  grid.style.gridTemplateColumns = `repeat(${MAZE_W}, 1fr)`;
  const cells = [];
  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      const c = button("maze-cell");
      const w = m.walls[y][x];
      c.style.borderTopWidth = w.n ? "6px" : "0";
      c.style.borderRightWidth = w.e ? "6px" : "0";
      c.style.borderBottomWidth = w.s ? "6px" : "0";
      c.style.borderLeftWidth = w.w ? "6px" : "0";
      c.dataset.x = x;
      c.dataset.y = y;
      if (x === m.exit[0] && y === m.exit[1]) c.classList.add("maze-exit");
      c.onclick = () => {
        if (!canStep(m, at, [x, y])) return;
        at = [x, y];
        draw();
        if (x === m.exit[0] && y === m.exit[1]) ctx.finish(1, "You found the way out!");
      };
      cells.push(c);
      grid.append(c);
    }
  }
  const draw = () => {
    for (const c of cells) c.classList.toggle("maze-me", Number(c.dataset.x) === at[0] && Number(c.dataset.y) === at[1]);
    box.dataset.at = at.join(",");
  };
  draw();
  box.replaceChildren(grid);
  countdown(ctx, MAZE_SECONDS, "Tap the square next to you to walk.", () => {
    const score = mazeScore(m, at);
    ctx.finish(score, score > 0.5 ? "Time's up! You were nearly out." : "Time's up! Lost in the hedges.");
  });
}

// ─── Lost Keys ──────────────────────────────────────────────────────────────

const KEY_SVG = '<svg viewBox="0 0 60 24" width="54" height="22"><circle cx="11" cy="12" r="8" fill="none" stroke="#c9a227" stroke-width="5"/><rect x="18" y="9" width="38" height="6" rx="2" fill="#c9a227"/><rect x="44" y="14" width="5" height="8" fill="#c9a227"/><rect x="51" y="14" width="5" height="6" fill="#c9a227"/></svg>';

function keys(ctx) {
  const { game, box } = ctx;
  const room = el("div", "key-room");
  room.style.backgroundImage = 'url("assets/rooms/library.jpg")';
  let found = 0;
  keySpots(game).forEach((s, i) => {
    const k = button("key");
    k.dataset.key = i;
    k.innerHTML = KEY_SVG;
    k.style.left = `${s.x * 100}%`;
    k.style.top = `${s.y * 100}%`;
    k.style.transform = `translate(-50%, -50%) rotate(${s.turn}deg)`;
    k.onclick = () => {
      k.classList.add("found");
      k.disabled = true;
      found += 1;
      if (found === KEYS) ctx.finish(1, "You found all 5 keys!");
    };
    room.append(k);
  });
  box.replaceChildren(room);
  countdown(ctx, KEYS_SECONDS, "Find the keys!", () => ctx.finish(found / KEYS, `Time's up! You found ${found} out of ${KEYS} keys.`));
}

// ─── Muddy Footprints ───────────────────────────────────────────────────────

function print(sole) {
  const patterns = {
    stripes: '<path d="M14 22h32M12 34h36M12 46h36M14 58h32M18 70h24" stroke="#3a2510" stroke-width="5"/>',
    dots: '<g fill="#3a2510"><circle cx="22" cy="24" r="4"/><circle cx="38" cy="24" r="4"/><circle cx="20" cy="40" r="4"/><circle cx="40" cy="40" r="4"/><circle cx="22" cy="56" r="4"/><circle cx="38" cy="56" r="4"/><circle cx="30" cy="72" r="4"/></g>',
    zigzag: '<polyline points="14,24 22,34 30,24 38,34 46,24" fill="none" stroke="#3a2510" stroke-width="5"/><polyline points="14,50 22,60 30,50 38,60 46,50" fill="none" stroke="#3a2510" stroke-width="5"/>',
    star: '<polygon points="30,24 35,38 50,38 38,47 42,62 30,53 18,62 22,47 10,38 25,38" fill="#3a2510"/>',
    squares: '<g fill="#3a2510"><rect x="16" y="20" width="10" height="10"/><rect x="34" y="20" width="10" height="10"/><rect x="16" y="40" width="10" height="10"/><rect x="34" y="40" width="10" height="10"/><rect x="25" y="62" width="10" height="10"/></g>',
  };
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 60 90");
  svg.setAttribute("width", 80);
  svg.setAttribute("height", 120);
  svg.innerHTML = `<ellipse cx="30" cy="45" rx="25" ry="40" fill="#8a5a2b" stroke="#3a2510" stroke-width="3"/>${patterns[sole]}`;
  return svg;
}

async function footprints(ctx) {
  const { game, box } = ctx;
  const { boot, splits } = footprintTrail(game);
  const big = el("div", "boot");
  big.append(print(boot));
  box.replaceChildren(big);
  ctx.status("Remember this muddy boot print!");
  await wait(3500);
  let right = 0;
  for (const [i, options] of splits.entries()) {
    box.dataset.split = i;
    ctx.status(`The trail splits! Which way? (${i + 1} of 3)`);
    const buttons = options.map((sole) => {
      const b = button("print-option");
      b.dataset.sole = sole;
      b.append(print(sole));
      return b;
    });
    const row = el("div", "print-options");
    row.append(...buttons);
    box.replaceChildren(row);
    const picked = options[await tapOne(buttons)];
    if (picked === boot) right += 1;
    ctx.status(picked === boot ? "Yes! The trail goes on..." : "Oops! Those were a fox's footprints. Back you go!");
    await wait(1300);
  }
  const who = gone(game)[0];
  const note = footprintNote(right) && who ? readNote(game, who) : "";
  const line = footprintNote(right)
    ? (who ? "You followed the trail to a hidden note!" : `You followed the trail! (${right} out of 3)`)
    : `You lost the trail. (${right} out of 3)`;
  ctx.finish(right / 3, line, null, note);
}

// ─── Portrait Gallery ───────────────────────────────────────────────────────

async function portraits(ctx) {
  const { game, box } = ctx;
  let right = 0;
  let note = "";
  for (const [i, round] of galleryRounds(game).entries()) {
    box.dataset.round = i;
    const wall = el("div", "gallery");
    for (const id of round.wall) wall.append(badge(character(id)));
    box.replaceChildren(wall);
    ctx.status(`Look carefully at the pictures... (${i + 1} of 3)`);
    await wait(3500 + i * 1000);
    box.replaceChildren(el("div", "gallery dark"));
    ctx.status("The lights go out!");
    await wait(1200);
    const after = round.after.map((id) => {
      const b = button("gallery-pick");
      b.dataset.id = id;
      b.append(badge(character(id)));
      return b;
    });
    const wall2 = el("div", "gallery");
    wall2.append(...after);
    box.replaceChildren(wall2);
    ctx.status("Which picture is new?");
    const picked = round.after[await tapOne(after)];
    const ok = picked === round.newcomer;
    if (ok) right += 1;
    ctx.status(ok ? `Yes! It's ${character(round.newcomer).name}!` : `No, the new one was ${character(round.newcomer).name}.`);
    if (ok && round.note) note = readNote(game, round.newcomer);
    await wait(1300);
  }
  ctx.finish(right / 3, `You spotted ${right} out of 3 new pictures!`, null, note);
}

// ─── Treasure Hunt ──────────────────────────────────────────────────────────

function treasure(ctx) {
  const { game, box } = ctx;
  const spot = treasureSpot(game);
  let room = ROOMS[0].id;
  let taps = 0;
  let before = null;
  const tabs = el("div", "treasure-tabs");
  const picture = el("div", "treasure-room");
  const show = () => {
    picture.style.backgroundImage = `url("${ROOMS.find((r) => r.id === room).picture}")`;
    for (const t of tabs.children) t.classList.toggle("picked", t.dataset.room === room);
    box.dataset.room = room;
  };
  for (const r of ROOMS) {
    const t = button("question", r.name);
    t.dataset.room = r.id;
    t.onclick = () => { room = r.id; before = null; picture.replaceChildren(); show(); };
    tabs.append(t);
  }
  const left = () => `${TREASURE_TAPS - taps} taps left.`;
  picture.addEventListener("click", (e) => {
    const rect = picture.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    taps += 1;
    const t = treasureTap(spot, room, x, y, before);
    if (t.dist !== null) before = t.dist;
    const words = { found: "Gold!", warmer: "Warmer!", colder: "Colder...", warm: "Warm!", cold: "Cold...", "wrong room": "Not in this room!" };
    const pop = el("div", "treasure-pop " + t.said.replace(" ", "-"), words[t.said]);
    pop.style.left = `${x * 100}%`;
    pop.style.top = `${y * 100}%`;
    picture.append(pop);
    if (t.said === "found") {
      const gold = el("div", "gold");
      gold.style.left = `${spot.x * 100}%`;
      gold.style.top = `${spot.y * 100}%`;
      picture.append(gold);
      ctx.status("You found the gold!");
      setTimeout(() => ctx.finish(treasureScore(true, taps), `You found the gold in ${taps} tap${taps === 1 ? "" : "s"}!`), FAST ? 0 : 1500);
      return;
    }
    ctx.status(`${words[t.said]} ${left()}`);
    if (taps >= TREASURE_TAPS) {
      ctx.finish(0, `Out of taps! The gold was in the ${ROOM_NAME[spot.room]}.`);
    }
  });
  show();
  box.replaceChildren(tabs, picture);
  ctx.status(`Pick a room and tap to search. ${left()}`);
}

// ─── Lights Out ─────────────────────────────────────────────────────────────

// The shield picture to rebuild: drawn here, so there's nothing to download.
const SHIELD_PICTURE = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">'
  + '<rect width="300" height="300" fill="#2b2f3a"/>'
  + '<path d="M30 20h240v110c0 80-60 130-120 155C90 260 30 210 30 130z" fill="#c62828" stroke="#f2c14e" stroke-width="12"/>'
  + '<path d="M150 20v265M30 120h240" stroke="#f2c14e" stroke-width="10"/>'
  + '<path d="M150 20h120v100H150z" fill="#1e5aa8"/><path d="M30 120h120v110c-30-10-120-50-120-110z" fill="#1e5aa8"/>'
  + '<polygon points="90,40 100,68 128,68 105,85 114,112 90,95 66,112 75,85 52,68 80,68" fill="#fff"/>'
  + '<circle cx="210" cy="190" r="34" fill="#fff"/><circle cx="210" cy="190" r="16" fill="#2e8b57"/>'
  + "</svg>");

function pieceEl(index, tag = "button") {
  const p = el(tag, "piece");
  p.dataset.piece = index;
  p.style.backgroundImage = `url("${SHIELD_PICTURE}")`;
  p.style.backgroundPosition = `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`;
  return p;
}

async function lights(ctx) {
  const { game, box } = ctx;
  const whole = el("img", "whole-shield");
  whole.src = SHIELD_PICTURE;
  whole.alt = "The shield";
  box.replaceChildren(whole);
  ctx.status("Look at the shield carefully!");
  await wait(3500);
  const placed = Array(PIECES).fill(null);
  let picked = null;
  const board = el("div", "lights-board");
  const tray = el("div", "lights-tray");
  for (let i = 0; i < PIECES; i++) {
    const s = button("slot");
    s.dataset.slot = i;
    s.onclick = () => {
      if (picked === null) return;
      if (placed[i] !== null) tray.append(pieceEl(placed[i]));   // swap the old one back out
      placed[i] = picked;
      s.replaceChildren(pieceEl(picked, "div"));
      tray.querySelector(`[data-piece="${picked}"].picked`)?.remove();
      picked = null;
      wire();
      if (!placed.includes(null)) done();
    };
    board.append(s);
  }
  const wire = () => {
    for (const p of tray.querySelectorAll(".piece")) {
      p.onclick = () => {
        picked = Number(p.dataset.piece);
        for (const o of tray.children) o.classList.toggle("picked", o === p);
      };
    }
  };
  for (const i of lightsTray(game)) tray.append(pieceEl(i));
  wire();
  const flicker = el("div", "flicker");
  const area = el("div", "lights-area");
  area.append(board, tray, flicker);
  box.replaceChildren(area);
  box.dataset.ready = "yes";
  const done = () => {
    const score = lightsScore(placed);
    const right = Math.round(score * PIECES);
    ctx.finish(score, right === PIECES ? "You built the whole shield in the dark!" : `You got ${right} out of ${PIECES} pieces in the right place.`);
  };
  countdown(ctx, LIGHTS_SECONDS, "Tap a piece, then its place.", done);
}

export const PLAY = { where, jumble, code, maze, keys, footprints, portraits, treasure, lights };
