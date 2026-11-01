// The other nine missions' screens (docs/missions.md). Each gets a box to
// draw in and finishes with a score from 0 to 1. Rules come from
// missions.js; this file draws and listens.
import {
  whereRounds, jumbleWords, noteFrom, secretCode, CODE_TRIES, makeMaze, mazeMove, mazeSquare, MAZE_SPEED, mazeScore,
  MAZE_W, MAZE_H, MAZE_SECONDS, keyHides, jingles, KEYS, LOOKS, footprintEvents, footprintScore, footprintNote,
  galleryRounds, treasureSpot, treasureTap, treasureScore, TREASURE_TAPS, lightsTray, lightsScore,
  PIECES, LIGHTS_SECONDS, gone, lightsDesign, lightsStart, lightsTap,
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
      const slots = [...w.word].map(() => el("span", "jumble-slot"));
      answer.append(...slots);
      // What's typed is read from the slots, so what Sam sees is what's
      // checked. `tries` counts attempts: a clear-up from an older wrong
      // try is ignored, so it can't wipe letters typed since (Sam got
      // stuck mashing letters, 2026-10-29).
      const typed = () => slots.map((sl) => sl.textContent).join("");
      let tries = 0, done = false;
      const reset = () => {
        tries += 1;
        for (const sl of slots) sl.textContent = "";
        for (const t of tiles.children) t.disabled = false;
      };
      // Undo the last letter (Gareth: "needs an undo button").
      const undo = () => {
        const last = [...slots].reverse().find((sl) => sl.textContent);
        if (done || !last) return;
        tries += 1;   // a wrong try's clear-up is cancelled: you're fixing it
        const tile = [...tiles.children].reverse().find((t) => t.disabled && t.dataset.letter === last.textContent);
        last.textContent = "";
        if (tile) tile.disabled = false;
      };
      w.letters.forEach((letter) => {
        const t = button("jumble-tile", letter);
        t.dataset.letter = letter;
        t.onclick = () => {
          const slot = slots.find((sl) => !sl.textContent);
          if (done || !slot) return;
          t.disabled = true;
          slot.textContent = letter;
          if (typed().length < w.word.length) return;
          if (typed() === w.word) { done = true; resolve(true); return; }
          answer.classList.remove("shake");
          void answer.offsetWidth;
          answer.classList.add("shake");
          ctx.status("Not quite! Try again.");
          const now = tries;
          setTimeout(() => { if (tries === now) reset(); }, FAST ? 0 : 500);
        };
        tiles.append(t);
      });
      const back = button("question", "Undo");
      back.id = "jumble-undo";
      back.onclick = undo;
      const again = button("question", "Start again");
      again.onclick = reset;
      const skip = button("question", "Skip");
      skip.id = "jumble-skip";
      skip.onclick = () => { done = true; resolve(false); };
      const tools = el("div", "jumble-tools");
      tools.append(back, again, skip);
      // A clue: their picture (Gareth: the jumble was too hard).
      const clue = el("div", "jumble-clue");
      clue.append(badge(character(w.id)));
      box.replaceChildren(clue, answer, tiles, tools);
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

// A joystick: drag the knob; `read()` gives the push as {x, y}, each -1..1.
function joystick() {
  const base = el("div", "joystick");
  const knob = el("div", "knob");
  base.append(knob);
  let push = { x: 0, y: 0 };
  let id = null;
  const move = (e) => {
    const r = base.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    push = { x, y };
    knob.style.transform = `translate(${x * 60}px, ${y * 60}px)`;
  };
  const stop = () => { id = null; push = { x: 0, y: 0 }; knob.style.transform = ""; };
  base.addEventListener("pointerdown", (e) => { id = e.pointerId; base.setPointerCapture?.(id); move(e); });
  base.addEventListener("pointermove", (e) => { if (e.pointerId === id) move(e); });
  base.addEventListener("pointerup", stop);
  base.addEventListener("pointercancel", stop);
  return { el: base, read: () => push };
}

function maze(ctx) {
  const { game, box } = ctx;
  const m = makeMaze(game);
  let pos = { x: m.start[0] + 0.5, y: m.start[1] + 0.5 };
  const grid = el("div", "maze");
  grid.style.gridTemplateColumns = `repeat(${MAZE_W}, 1fr)`;
  for (let y = 0; y < MAZE_H; y++) {
    for (let x = 0; x < MAZE_W; x++) {
      const c = el("div", "maze-cell");
      const w = m.walls[y][x];
      c.style.borderTopWidth = w.n ? "6px" : "0";
      c.style.borderRightWidth = w.e ? "6px" : "0";
      c.style.borderBottomWidth = w.s ? "6px" : "0";
      c.style.borderLeftWidth = w.w ? "6px" : "0";
      if (x === m.exit[0] && y === m.exit[1]) c.classList.add("maze-exit");
      grid.append(c);
    }
  }
  const token = el("div", "maze-token");
  grid.append(token);
  const draw = () => {
    token.style.left = `${(pos.x / MAZE_W) * 100}%`;
    token.style.top = `${(pos.y / MAZE_H) * 100}%`;
    box.dataset.pos = `${pos.x.toFixed(3)},${pos.y.toFixed(3)}`;
  };
  draw();
  const stick = joystick();
  const row = el("div", "maze-row");
  row.append(stick.el, grid);
  box.replaceChildren(row);
  let last = performance.now();
  ctx.every(16, () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = stick.read();
    if (!p.x && !p.y) return;
    const speed = MAZE_SPEED * (FAST ? 4 : 1);   // tests walk faster
    pos = mazeMove(m, pos, p.x * speed * dt, p.y * speed * dt);
    draw();
    const [sx, sy] = mazeSquare(pos);
    if (sx === m.exit[0] && sy === m.exit[1]) ctx.finish(1, "You found the way out!");
  });
  countdown(ctx, MAZE_SECONDS, "Use the joystick to walk.", () => {
    const score = mazeScore(m, mazeSquare(pos));
    ctx.finish(score, score > 0.5 ? "Time's up! You were nearly out." : "Time's up! Lost in the hedges.");
  });
}

// ─── Lost Keys ──────────────────────────────────────────────────────────────

const KEY_SVG = '<svg viewBox="0 0 60 24" width="54" height="22"><circle cx="11" cy="12" r="8" fill="none" stroke="#f2c14e" stroke-width="5"/><rect x="18" y="9" width="38" height="6" rx="2" fill="#f2c14e"/><rect x="44" y="14" width="5" height="8" fill="#f2c14e"/><rect x="51" y="14" width="5" height="6" fill="#f2c14e"/></svg>';
const THINGS = {
  books: '<rect x="8" y="30" width="12" height="44" fill="#8b1a1a"/><rect x="21" y="24" width="12" height="50" fill="#1e5aa8"/><rect x="34" y="34" width="12" height="40" fill="#2e8b57"/><rect x="47" y="28" width="12" height="46" fill="#c98a3a"/>',
  chair: '<rect x="18" y="10" width="44" height="40" rx="8" fill="#6b3d1f"/><rect x="12" y="46" width="56" height="14" rx="5" fill="#8b5a2b"/><rect x="16" y="58" width="6" height="18" fill="#4a2a12"/><rect x="58" y="58" width="6" height="18" fill="#4a2a12"/>',
  painting: '<rect x="8" y="12" width="64" height="50" fill="#c9a227"/><rect x="15" y="19" width="50" height="36" fill="#5d8aa8"/><path d="M15 55 L35 35 L48 47 L56 40 L65 55 Z" fill="#2e8b57"/>',
  clock: '<rect x="24" y="4" width="32" height="72" rx="6" fill="#5a3a1a"/><circle cx="40" cy="24" r="12" fill="#f4e9c8"/><path d="M40 24 V16 M40 24 H47" stroke="#222" stroke-width="2"/>',
  globe: '<circle cx="40" cy="34" r="24" fill="#3b7dd8"/><path d="M28 24 q8 6 4 14 q-6 4 -2 10 M48 20 q-4 8 4 12" stroke="#2e8b57" stroke-width="6" fill="none"/><rect x="34" y="58" width="12" height="6" fill="#5a3a1a"/><rect x="24" y="64" width="32" height="8" rx="3" fill="#5a3a1a"/>',
  lamp: '<polygon points="22,40 58,40 50,12 30,12" fill="#f2d16b"/><rect x="37" y="40" width="6" height="28" fill="#5a3a1a"/><rect x="26" y="66" width="28" height="8" rx="3" fill="#5a3a1a"/>',
  chest: '<rect x="10" y="30" width="60" height="40" rx="4" fill="#8b5a2b"/><path d="M10 34 q30 -24 60 0" fill="#a0692f"/><rect x="36" y="40" width="8" height="12" fill="#c9a227"/>',
  plant: '<path d="M40 44 q-20 -10 -18 -34 q14 10 18 34 q4 -24 18 -34 q2 24 -18 34" fill="#2e8b57"/><polygon points="26,44 54,44 50,74 30,74" fill="#b5651d"/>',
};

function keys(ctx) {
  const { game, box } = ctx;
  const hides = keyHides(game);
  const room = el("div", "key-room");
  room.style.backgroundImage = 'url("assets/rooms/library.jpg")';
  let found = 0, looks = 0;
  const left = () => `${LOOKS - looks} looks left. Keys found: ${found} of ${KEYS}.`;
  hides.spots.forEach((s, i) => {
    const b = button("hide");
    b.dataset.place = i;
    b.innerHTML = `<span class="key-behind">${KEY_SVG}</span><svg class="thing" viewBox="0 0 80 80" width="74" height="74">${THINGS[s.kind]}</svg>`;
    b.style.left = `${s.x * 100}%`;
    b.style.top = `${s.y * 100}%`;
    b.onclick = () => {
      if (b.disabled || looks >= LOOKS) return;
      b.disabled = true;
      looks += 1;
      if (hides.keys.includes(i)) {
        found += 1;
        b.classList.add("has-key");
        ctx.status(`A key! ${left()}`);
      } else {
        b.classList.add("empty");
        const n = jingles(hides, i);
        ctx.status(`${n === 0 ? "Nothing there. Not even a jingle." : n === 1 ? "Nothing... but you hear a jingle nearby!" : "Nothing... but you hear lots of jingling nearby!"} ${left()}`);
      }
      if (found === KEYS) ctx.finish(1, "You found all 5 keys!");
      else if (looks >= LOOKS) setTimeout(() => ctx.finish(found / KEYS, `Out of looks! You found ${found} out of ${KEYS} keys.`), FAST ? 0 : 1200);
    };
    room.append(b);
  });
  box.replaceChildren(room);
  ctx.status(`Tap things to look behind them. Listen for jingles! ${left()}`);
}

// ─── Muddy Footprints ───────────────────────────────────────────────────────

const PRINTS = {
  boot: '<svg viewBox="0 0 40 70" width="44" height="76"><ellipse cx="20" cy="24" rx="15" ry="20" fill="#5b3a1a"/><ellipse cx="20" cy="57" rx="11" ry="11" fill="#5b3a1a"/><path d="M10 18h20M9 26h22M11 34h18" stroke="#3a2510" stroke-width="3"/></svg>',
  fox: '<svg viewBox="0 0 40 40" width="52" height="52"><ellipse cx="20" cy="26" rx="10" ry="9" fill="#a0522d"/><circle cx="9" cy="13" r="4" fill="#a0522d"/><circle cx="17" cy="8" r="4" fill="#a0522d"/><circle cx="25" cy="8" r="4" fill="#a0522d"/><circle cx="32" cy="13" r="4" fill="#a0522d"/></svg>',
  duck: '<svg viewBox="0 0 40 40" width="56" height="56"><path d="M20 38 L4 10 Q12 16 20 6 Q28 16 36 10 Z" fill="#c98a3a"/></svg>',
};

function footprints(ctx) {
  const { game, box } = ctx;
  const garden = el("div", "footprint-garden");
  garden.style.backgroundImage = 'url("assets/rooms/garden.jpg")';
  box.replaceChildren(garden);
  const events = footprintEvents(game);
  const speed = FAST ? 4 : 1;   // tests run faster
  let hits = 0, wrong = 0, next = 0;
  const start = performance.now();
  const live = [];
  ctx.status("Tap the muddy boot prints before they fade! Not the fox or duck ones!");
  const end = () => {
    const score = footprintScore(hits, wrong);
    const who = gone(game)[0];
    const note = footprintNote(score) && who ? readNote(game, who) : "";
    const line = footprintNote(score)
      ? (who ? "You followed the trail all the way to a hidden note!" : `You followed the trail! ${hits} out of ${events.filter((e) => e.kind === "boot").length} prints.`)
      : `You lost the trail. ${hits} prints found${wrong ? `, ${wrong} wrong taps` : ""}.`;
    ctx.finish(score, line, null, note);
  };
  ctx.every(30, () => {
    const now = (performance.now() - start) * speed;
    while (next < events.length && events[next].at <= now) {
      const e = events[next++];
      const p = button("print " + e.kind);
      p.innerHTML = PRINTS[e.kind];
      p.dataset.kind = e.kind;
      p.style.left = `${e.x * 100}%`;
      p.style.top = `${e.y * 100}%`;
      p.style.transform = `translate(-50%, -50%) rotate(${e.angle}deg)`;
      p.onclick = () => {
        if (p.disabled) return;
        p.disabled = true;
        if (e.kind === "boot") { hits += 1; p.classList.add("got"); }
        else { wrong += 1; p.classList.add("wrong"); ctx.status(`Oops! That was a ${e.kind}!`); }
      };
      garden.append(p);
      live.push([p, e]);
    }
    for (const [p, e] of live) {
      if (!p.isConnected) continue;
      const age = now - e.at;
      p.style.opacity = String(Math.max(0, 1 - age / e.life));
      if (age > e.life) p.remove();
    }
    box.dataset.shown = String(next);
    const last = events[events.length - 1];
    if (next === events.length && now > last.at + last.life) end();
  });
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

// The shield pictures to rebuild: drawn here, so there's nothing to
// download. A different one can come up each time.
const SHIELDS = [
  ["#c62828", "#1e5aa8", "#f2c14e", "star"],
  ["#2e8b57", "#f2c14e", "#fff", "crown"],
  ["#5b2c83", "#e2453c", "#f2c14e", "circle"],
  ["#1e5aa8", "#ffffff", "#c62828", "cross"],
].map(([main, second, trim, emblem]) => {
  const emblems = {
    star: '<polygon points="90,40 100,68 128,68 105,85 114,112 90,95 66,112 75,85 52,68 80,68" fill="#fff"/><circle cx="210" cy="190" r="34" fill="#fff"/>',
    crown: '<polygon points="55,100 60,50 80,75 90,40 100,75 120,50 125,100" fill="#f2c14e" stroke="#7a5412" stroke-width="4"/><rect x="185" y="160" width="50" height="60" rx="8" fill="#fff"/>',
    circle: '<circle cx="90" cy="72" r="34" fill="#f2c14e"/><circle cx="90" cy="72" r="14" fill="#5b2c83"/><polygon points="210,150 245,215 175,215" fill="#fff"/>',
    cross: '<path d="M80 40h22v26h26v22h-26v26H80V88H54V66h26z" fill="#c62828"/><circle cx="210" cy="190" r="30" fill="#c62828"/>',
  };
  return "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">'
    + '<rect width="300" height="300" fill="#2b2f3a"/>'
    + `<path d="M30 20h240v110c0 80-60 130-120 155C90 260 30 210 30 130z" fill="${main}" stroke="${trim}" stroke-width="12"/>`
    + `<path d="M150 20v265M30 120h240" stroke="${trim}" stroke-width="10"/>`
    + `<path d="M150 20h120v100H150z" fill="${second}"/><path d="M30 120h120v110c-30-10-120-50-120-110z" fill="${second}"/>`
    + emblems[emblem] + "</svg>");
});
let SHIELD_PICTURE = SHIELDS[0];

function pieceEl(index, tag = "button") {
  const p = el(tag, "piece");
  p.dataset.piece = index;
  p.style.backgroundImage = `url("${SHIELD_PICTURE}")`;
  p.style.backgroundPosition = `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`;
  return p;
}

async function lights(ctx) {
  const { game, box } = ctx;
  SHIELD_PICTURE = SHIELDS[lightsDesign(game)];
  const whole = el("img", "whole-shield");
  whole.src = SHIELD_PICTURE;
  whole.alt = "The shield";
  box.replaceChildren(whole);
  ctx.status("Look at the shield carefully!");
  await wait(3500);
  let state = lightsStart(game);
  const board = el("div", "lights-board");
  const tray = el("div", "lights-tray");
  const finished = button("big", "Finished!");
  finished.id = "lights-done";
  const tap = (where, at) => { state = lightsTap(state, where, at); draw(); };
  const draw = () => {
    const p = state.picked;
    board.replaceChildren(...state.placed.map((piece, i) => {
      const slot = button("slot" + (p && p.from === "slot" && p.at === i ? " picked" : ""));
      slot.dataset.slot = i;
      if (piece !== null) slot.append(pieceEl(piece, "div"));
      slot.onclick = () => tap("slot", i);
      return slot;
    }));
    tray.replaceChildren(...state.tray.map((piece) => {
      const b = pieceEl(piece);
      if (p && p.from === "tray" && p.at === piece) b.classList.add("picked");
      b.onclick = (e) => { e.stopPropagation(); tap("tray-piece", piece); };
      return b;
    }));
    finished.disabled = state.placed.includes(null);
  };
  tray.onclick = () => tap("tray");
  draw();
  const flicker = el("div", "flicker");
  const area = el("div", "lights-area");
  area.append(board, tray, flicker);
  box.replaceChildren(area, finished);
  box.dataset.ready = "yes";
  const done = () => {
    const score = lightsScore(state.placed);
    const right = Math.round(score * PIECES);
    ctx.finish(score, right === PIECES ? "You built the whole shield in the dark!" : `You got ${right} out of ${PIECES} pieces in the right place.`);
  };
  finished.onclick = done;
  countdown(ctx, LIGHTS_SECONDS, "Tap a piece, then its place. Tap a placed piece to move it.", done);
}

export const PLAY = { where, jumble, code, maze, keys, footprints, portraits, treasure, lights };
