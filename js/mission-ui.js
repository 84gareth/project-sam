// The mission screens. Castle Bells, Chilli Pie Shuffle, Catapults and
// Cooking are here; the other nine are in mission-more.js. Rules come from
// missions.js; these files draw and listen.
import {
  finishMission, todaysMission, bellTune, BELL_ROUNDS, BELLS, bellScore, pieRound, PIE_ROUNDS, pieScore,
  STONES, finishCatapults, galleryTargets, moveTargets, landing, hitAt, SLING, SLING_MAX_PULL, FLIGHT, TRUCKS, HATES, cookingDiner, shieldTruck, finishCooking, flopResult, flopPart, cookScore, truckFoods,
} from "./missions.js";
import { PLAY } from "./mission-more.js";
import { soloEngine } from "./engine.js";
import { stillIn } from "./castle.js";
import { $, show, character, wait, badge, FAST, isMe, isRealPlayer, nameInto } from "./ui.js";
import { narrate, say } from "./voice.js";
import { bell } from "./sound.js";

const BELL_COLOURS = ["#f2c14e", "#7fc4f5", "#ff7b6b", "#9be38a"];
const BELL_NAMES = ["Yellow", "Blue", "Red", "Green"];
const money = (n) => `£${n.toLocaleString("en-GB")}`;

let game = null;
let onDone = null;
let mission = null;
let finished = true;
let cleanups = [];   // timers to stop when the mission ends

const CONTAINERS = ["bells", "pies", "catapult", "cooking", "mission-play"];

// Show today's mission (or `only`, from the debug menu); `done` runs when
// Sam taps the button at the end.
// `eng`: the engine making decisions (engine.js); none for the test menu,
// which plays a mission on its own.
let engine = null;
export function startMission(g, done, only = null, eng = null) {
  game = g;
  engine = eng ?? soloEngine(g);
  onDone = done;
  const m = mission = only ?? todaysMission(game);
  $("mission-done").textContent = only ? "Back to the missions" : "Go to the castle";
  $("screen-mission").classList.toggle("pies-mission", m.id === "pies" || m.id === "cooking");
  $("screen-mission").classList.toggle("garden-mission", ["catapults", "maze", "footprints"].includes(m.id));
  $("mission-name").textContent = `Mission ${game.day}: ${m.name}`;
  $("mission-how").textContent = m.how;
  $("mission-status").textContent = "";
  stopTimers();
  finished = false;
  for (const id of CONTAINERS) $(id).hidden = true;
  $("mission-play").replaceChildren();
  $("mission-how").hidden = false;
  $("bells").dataset.round = $("pies").dataset.round = "";
  delete $("bells").dataset.flopped;
  $("mission-result").hidden = true;
  $("mission-go").hidden = false;
  $("mission-go").onclick = () => {
    $("mission-go").hidden = true;
    if (m.id === "bells") playBells();
    else if (m.id === "pies") playPies();
    else if (m.id === "catapults") playCatapults();
    else if (m.id === "cooking") playCooking();
    else {
      $("mission-how").hidden = true;
      $("mission-play").hidden = false;
      // A fresh box for this go: if an old mission is still running
      // somewhere, it only draws into its own (gone) box and can't finish
      // this one.
      const box = document.createElement("div");
      box.className = "mission-box";
      $("mission-play").replaceChildren(box);
      const live = () => box.isConnected;
      PLAY[m.id]({
        game, mission: m, box,
        status: (t) => { if (live()) $("mission-status").textContent = t; },
        finish: (...args) => live() && finish(...args),
        every,
      });
    }
  };
  show("screen-mission");
  narrate(`Mission time! ${m.name}. ${m.how}`);
}

// A repeating timer that stops when the mission ends.
function every(ms, fn) {
  const t = setInterval(fn, ms);
  cleanups.push(() => clearInterval(t));
  return t;
}
function stopTimers() {
  for (const stop of cleanups) stop();
  cleanups = [];
}

// The tests' way to finish a mission at once, as badly as possible.
if (FAST) window.missionGiveUp = () => finish(null, "You gave up.", flopPart(mission));

// Who won a shield today, in words.
function shieldLine(r) {
  const shields = r.shields;
  const me = game.playerId;
  if (shields.length === 0) return "The shield is broken! Nobody has a shield tonight.";
  const two = shields.length === 2 ? "Two shields today! " : "";
  const others = shields.filter((id) => id !== me).map((id) => character(id).name);
  if (shields.includes(me)) {
    const how = r.found ? "You found a shield!" : "You win a shield!";
    return `${two}${how} Nobody can murder you tonight!${others.length ? ` ${others[0]} wins one too.` : ""}`;
  }
  return `${two}${others.join(" and ")} ${others.length === 2 ? "win shields" : "wins the shield"}!`;
}

// The leaderboard (Gareth, 2026-10-29): the top 5, plus you and every real
// player wherever they came. `scores`: [[id, score 0 to 1], ...], best first.
export const LEADERS = 5;
function drawLeaders(scores) {
  const rows = scores.map(([id, s], i) => ({ id, s, place: i + 1 }))
    .filter((row) => row.place <= LEADERS || isMe(row.id) || isRealPlayer(row.id));
  $("mission-leaders").replaceChildren(...rows.map(({ id, s, place }) => {
    const row = document.createElement("div");
    row.className = "leader" + (isMe(id) ? " leader-you" : "") + (isRealPlayer(id) && !isMe(id) ? " leader-player" : "");
    row.dataset.id = id;
    const name = document.createElement("span");
    name.className = "leader-name";
    nameInto(name, id, character(id).name + (isMe(id) ? " (you)" : ""));
    const bar = document.createElement("span");
    bar.className = "leader-bar";
    bar.append(Object.assign(document.createElement("span"), { style: `width: ${Math.round(s * 100)}%` }));
    row.append(Object.assign(document.createElement("span"), { className: "leader-place", textContent: place }), badge(character(id)), name, bar);
    return row;
  }));
}

// `done`: a result already worked out (Catapults, Cooking); `extra`: one
// more line to show. Only the first finish counts.
async function finish(score, line, done = null, extra = "") {
  if (finished) return;
  finished = true;
  stopTimers();
  // `done` here is this player's part: { score, hits?, found? }.
  const part = done ?? { score };
  // Waiting for the others to finish (multiplayer); at once on your own.
  $("mission-status").textContent = engine.kind === "solo" ? "" : "Waiting for everyone to finish...";
  const r = await engine.decide("mission", { mission: mission.id, ...part });
  if (typeof extra === "function") extra = extra(r);
  $("mission-score").textContent = line;
  $("mission-pot").textContent = `The team won ${money(r.won)}! The pot is now ${money(game.pot)}.`;
  $("mission-extra").textContent = extra;
  $("mission-extra").hidden = !extra;
  $("mission-shield").textContent = shieldLine(r);
  drawLeaders(r.scores ?? []);
  for (const id of CONTAINERS) $(id).hidden = true;
  $("mission-status").textContent = "";
  $("mission-result").hidden = false;
  $("mission-done").onclick = () => onDone();
  narrate(`${line} ${$("mission-pot").textContent} ${extra} ${$("mission-shield").textContent}`);
}

// ─── Castle Bells ───────────────────────────────────────────────────────────

async function playBells() {
  const tune = bellTune(game);
  const box = $("bells");
  box.replaceChildren();
  const bells = [];
  for (let i = 0; i < BELLS; i++) {
    const b = document.createElement("button");
    b.className = "bell";
    b.dataset.bell = i;
    b.style.background = BELL_COLOURS[i];
    b.textContent = BELL_NAMES[i];
    box.append(b);
    bells.push(b);
  }
  box.hidden = false;
  const ring = async (i, ms) => {
    bell(i);
    bells[i].classList.add("lit");
    await wait(ms);
    bells[i].classList.remove("lit");
  };
  let done = 0;
  for (const length of BELL_ROUNDS) {
    $("mission-status").textContent = "Listen...";
    box.style.pointerEvents = "none";
    await wait(700);
    for (let k = 0; k < length; k++) {
      await ring(tune[k], 450);
      await wait(200);
    }
    $("mission-status").textContent = "Your turn!";
    box.dataset.round = length;   // which round is waiting (tests read it)
    box.style.pointerEvents = "";
    const ok = await new Promise((resolve) => {
      let k = 0;
      for (const b of bells) {
        b.onclick = () => {
          const i = Number(b.dataset.bell);
          ring(i, 250);
          if (i !== tune[k]) return resolve(false);
          k += 1;
          if (k === length) resolve(true);
        };
      }
    });
    for (const b of bells) b.onclick = null;
    if (!ok) break;
    done += 1;
    $("mission-status").textContent = done < BELL_ROUNDS.length ? "Yes! Now a longer one..." : "Perfect!";
    await wait(800);
  }
  const line = done === BELL_ROUNDS.length
    ? "You rang every tune perfectly!"
    : `You got ${done} tune${done === 1 ? "" : "s"} out of ${BELL_ROUNDS.length} right.`;
  finish(bellScore(done), line);
}

// ─── Chilli Pie Shuffle ─────────────────────────────────────────────────────

const PIE_X = [0, 235, 470];

async function playPies() {
  const box = $("pies");
  box.replaceChildren();
  const pies = [];
  for (let i = 0; i < 3; i++) {
    const p = document.createElement("button");
    p.className = "pie";
    p.dataset.pie = i;
    p.innerHTML = '<span class="chilli"></span><span class="crust"></span>';
    p.style.left = `${PIE_X[i]}px`;
    box.append(p);
    pies.push(p);
  }
  box.hidden = false;
  let right = 0;
  for (let round = 0; round < PIE_ROUNDS.length; round++) {
    const { start, swaps, speed } = pieRound(game, round);
    // `slot[i]` = which pie stands in place i.
    const slot = [0, 1, 2];
    for (const p of pies) { p.className = "pie"; p.style.transitionDuration = "0ms"; }
    slot.forEach((pie, place) => { pies[pie].style.left = `${PIE_X[place]}px`; });
    box.style.pointerEvents = "none";
    pies[slot[start]].classList.add("show-chilli");
    $("mission-status").textContent = `Round ${round + 1}. Here's the chilli pie!`;
    await wait(1600);
    pies[slot[start]].classList.remove("show-chilli");
    $("mission-status").textContent = "Shuffle!";
    await wait(400);
    for (const p of pies) p.style.transitionDuration = `${FAST ? 0 : speed}ms`;
    for (const [a, b] of swaps) {
      [slot[a], slot[b]] = [slot[b], slot[a]];
      pies[slot[a]].style.left = `${PIE_X[a]}px`;
      pies[slot[b]].style.left = `${PIE_X[b]}px`;
      await wait(speed + 60);
    }
    $("mission-status").textContent = "Which one is the chilli pie?";
    box.dataset.round = round;   // which round is waiting (tests read it)
    box.style.pointerEvents = "";
    const { answer } = pieRound(game, round);
    const picked = await new Promise((resolve) => {
      slot.forEach((pie, place) => { pies[pie].onclick = () => resolve(place); });
    });
    for (const p of pies) p.onclick = null;
    pies[slot[answer]].classList.add("show-chilli", picked === answer ? "right" : "wrong");
    if (picked === answer) {
      right += 1;
      $("mission-status").textContent = "Yes! That's the chilli pie!";
    } else {
      pies[slot[picked]].classList.add("wrong");
      $("mission-status").textContent = "Oh no! That one's strawberry.";
    }
    await wait(1500);
  }
  finish(pieScore(right), `You found the chilli pie ${right} time${right === 1 ? "" : "s"} out of ${PIE_ROUNDS.length}.`);
}

// ─── Catapults: a shooting gallery ──────────────────────────────────────────
// Everyone's pictures fly round the gallery. Drag the stone back and let go:
// it flies in a curve and lands a moment later, so aim ahead of them.
// Targets carry data-x/-y/-vx/-vy (where they are and how they're moving),
// for the tests.

async function playCatapults() {
  const box = $("catapult");
  box.replaceChildren();
  const field = document.createElement("div");
  field.className = "gallery-field";
  const ids = [...stillIn(game).filter((id) => id !== game.playerId), "shield"];
  let targets = galleryTargets(game, ids);
  const els = {};
  for (const t of targets) {
    const e = document.createElement("div");
    e.className = "flyer";
    e.dataset.id = t.id;
    if (t.id === "shield") {
      const s = document.createElement("img");
      s.className = "shield-target";
      s.src = "assets/shield.png";   // Sam's drawing
      s.alt = "Shield";
      e.append(s);
    } else {
      e.append(badge(character(t.id)));
    }
    els[t.id] = e;
    field.append(e);
  }
  const bands = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  bands.setAttribute("class", "bands");
  bands.setAttribute("viewBox", "0 0 100 100");
  bands.setAttribute("preserveAspectRatio", "none");
  const stone = document.createElement("div");
  stone.className = "stone";
  const fork = document.createElement("div");
  fork.className = "fork";
  field.append(fork, bands, stone);
  const left = document.createElement("p");
  left.className = "stones";
  box.append(field, left);
  box.hidden = false;
  $("mission-how").hidden = true;

  const place = (e, x, y) => { e.style.left = `${x * 100}%`; e.style.top = `${y * 100}%`; };
  const draw = () => {
    for (const t of targets) {
      const e = els[t.id];
      place(e, t.x, t.y);
      Object.assign(e.dataset, { x: t.x, y: t.y, vx: t.vx, vy: t.vy });
    }
  };
  let last = performance.now();
  every(16, () => {
    const now = performance.now();
    targets = moveTargets(targets, Math.min(0.05, (now - last) / 1000));
    last = now;
    draw();
  });
  draw();

  const hits = [];
  let flying = false;
  let pull = null;
  const restStone = () => { place(stone, SLING.x, SLING.y); stone.style.transform = "translate(-50%, -50%)"; bands.innerHTML = ""; };
  restStone();
  left.textContent = `Stones left: ${STONES}`;
  $("mission-status").textContent = "Drag the stone back, aim, and let go!";
  const frac = (e) => {
    const r = field.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const drawPull = () => {
    const len = Math.hypot(pull.x, pull.y);
    const k = len > SLING_MAX_PULL ? SLING_MAX_PULL / len : 1;
    const sx = SLING.x + pull.x * k, sy = SLING.y + pull.y * k;
    place(stone, sx, sy);
    bands.innerHTML = `<line x1="${(SLING.x - 0.04) * 100}" y1="${SLING.y * 100 - 6}" x2="${sx * 100}" y2="${sy * 100}"/>`
      + `<line x1="${(SLING.x + 0.04) * 100}" y1="${SLING.y * 100 - 6}" x2="${sx * 100}" y2="${sy * 100}"/>`;
  };
  await new Promise((resolve) => {
    let down = null;
    field.onpointerdown = (e) => {
      if (flying || hits.length >= STONES) return;
      const p = frac(e);
      if (Math.hypot(p.x - SLING.x, (p.y - SLING.y) * 0.56) > 0.08) return;   // grab the stone
      down = e.pointerId;
      field.setPointerCapture?.(down);
      pull = { x: 0, y: 0 };
      drawPull();
    };
    field.onpointermove = (e) => {
      if (e.pointerId !== down) return;
      const p = frac(e);
      pull = { x: p.x - SLING.x, y: p.y - SLING.y };
      drawPull();
    };
    field.onpointerup = async (e) => {
      if (e.pointerId !== down) return;
      down = null;
      if (!pull || Math.hypot(pull.x, pull.y) < 0.02) { restStone(); return; }   // barely pulled: no throw
      const land = landing(pull.x, pull.y);
      const from = { ...SLING };
      flying = true;
      bands.innerHTML = "";
      // Fly in a curve, getting smaller as it goes further away.
      const t0 = performance.now();
      const seconds = FLIGHT;
      await new Promise((done) => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / 1000 / seconds);
          const x = from.x + (land.x - from.x) * t;
          const y = from.y + (land.y - from.y) * t - Math.sin(Math.PI * t) * 0.25;
          place(stone, x, y);
          stone.style.transform = `translate(-50%, -50%) scale(${1 - 0.55 * t})`;
          if (t >= 1) done(); else setTimeout(step, 16);
        };
        step();
      });
      const hit = hitAt(targets, land);
      hits.push(hit);
      const splat = document.createElement("div");
      splat.className = "splat";
      place(splat, land.x, land.y);
      field.append(splat);
      setTimeout(() => splat.remove(), 800);
      if (hit === "shield") {
        $("mission-status").textContent = "Oh no! You hit the shield! It's broken!";
        els.shield.classList.add("hit");
        targets = targets.filter((t) => t.id !== "shield");
      } else if (hit) {
        $("mission-status").textContent = `Splat! You hit ${character(hit).name}!`;
        els[hit].classList.add("hit");
        targets = targets.filter((t) => t.id !== hit);
      } else {
        $("mission-status").textContent = "Missed!";
      }
      left.textContent = `Stones left: ${STONES - hits.length}`;
      flying = false;
      pull = null;
      restStone();
      if (hits.length === STONES) resolve();
    };
  });
  field.onpointerdown = field.onpointermove = field.onpointerup = null;
  await wait(900);
  const mine = hits.filter((h) => h && h !== "shield");
  const line = mine.length ? `You hit ${mine.length} out of ${STONES}!` : "You didn't hit anyone!";
  finish(null, line, { score: mine.length / STONES, hits }, (result) => {
    const names = result.hit.map((id) => id === game.playerId ? `${character(id).name} (you)` : character(id).name);
    return names.length
      ? `Up for murder tonight: ${names.join(", ")}.`
      : "Nobody was hit, so nobody is up for murder!";
  });
}

// ─── Cooking Challenge ──────────────────────────────────────────────────────

async function playCooking() {
  const diner = cookingDiner(game, stillIn(game));
  const [, clue] = HATES[diner];
  const pic = document.createElement("img");
  pic.className = "cutout";
  pic.src = `assets/puppets/${diner}.png`;
  pic.alt = character(diner).name;
  $("diner-picture").replaceChildren(pic);
  $("diner-clue").textContent = `${character(diner).name}: "${clue}"`;
  const meal = [null, null, null];
  let box = null;
  const trucks = $("trucks");
  trucks.replaceChildren();
  const ready = () => { $("serve").disabled = meal.includes(null) || box === null; };
  const menu = truckFoods(game, diner);
  TRUCKS.forEach((truck, i) => {
    const col = document.createElement("div");
    col.className = "truck";
    const h = document.createElement("h3");
    h.textContent = truck.name;
    col.append(h);
    for (const food of menu[i]) {
      const b = document.createElement("button");
      b.className = "food";
      b.dataset.food = food;
      b.textContent = food;
      b.onclick = () => {
        meal[i] = food;
        for (const o of col.querySelectorAll(".food")) o.classList.toggle("picked", o === b);
        ready();
      };
      col.append(b);
    }
    const bx = document.createElement("button");
    bx.className = "box";
    bx.dataset.box = i;
    bx.textContent = "Secret box";
    bx.onclick = () => {
      box = i;
      for (const o of trucks.querySelectorAll(".box")) o.classList.toggle("picked", o === bx);
      ready();
    };
    col.append(bx);
    trucks.append(col);
  });
  $("serve").disabled = true;
  $("cooking").hidden = false;
  $("mission-how").hidden = true;
  $("mission-status").textContent = "Pick one food from each truck, and one secret box.";
  say(`I'm coming to dinner! ${clue}`, diner);
  await new Promise((resolve) => { $("serve").onclick = resolve; });
  $("serve").onclick = null;
  $("serve").disabled = true;
  for (const b of $("trucks").querySelectorAll("button")) b.disabled = true;
  const where = shieldTruck(game);
  for (const o of trucks.querySelectorAll(".box")) {
    o.textContent = Number(o.dataset.box) === where ? "Shield!" : "Empty";
    o.classList.toggle("has-shield", Number(o.dataset.box) === where);
  }
  const result = { score: cookScore(diner, meal), found: box === where };
  const reaction = result.score === 1
    ? `Yuck! ${HATES[diner][0]}! My least favourite!`
    : "Mmm, that's quite nice actually.";
  $("mission-status").textContent = `${character(diner).name}: "${reaction}"`;
  await say(reaction, diner);
  await wait(1200);
  const line = result.score === 1
    ? `You cooked ${character(diner).name}'s least favourite food: ${HATES[diner][0]}!`
    : `${character(diner).name} hates ${HATES[diner][0]}, and it wasn't in the meal.`;
  finish(null, line, result);
}
