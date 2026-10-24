// The mission screens. Castle Bells, Chilli Pie Shuffle, Catapults and
// Cooking are here; the other nine are in mission-more.js. Rules come from
// missions.js; these files draw and listen.
import {
  finishMission, todaysMission, bellTune, BELL_ROUNDS, BELLS, bellScore, pieRound, PIE_ROUNDS, pieScore,
  STONES, finishCatapults, TRUCKS, HATES, cookingDiner, shieldTruck, finishCooking, flopResult, truckFoods,
} from "./missions.js";
import { PLAY } from "./mission-more.js";
import { stillIn } from "./castle.js";
import { $, show, character, wait, badge, FAST } from "./ui.js";
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
export function startMission(g, done, only = null) {
  game = g;
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
if (FAST) window.missionGiveUp = () => finish(null, "You gave up.", flopResult(game, stillIn(game), mission));

// `done`: a result already worked out (Catapults, Cooking); `extra`: one
// more line to show. Only the first finish counts.
async function finish(score, line, done = null, extra = "") {
  if (finished) return;
  finished = true;
  stopTimers();
  const r = done ?? finishMission(game, score, stillIn(game), mission);
  $("mission-score").textContent = line;
  $("mission-pot").textContent = `The team won ${money(r.won)}! The pot is now ${money(game.pot)}.`;
  $("mission-extra").textContent = extra;
  $("mission-extra").hidden = !extra;
  $("mission-shield").textContent = r.shield === null
    ? "The shield is broken! Nobody has a shield tonight."
    : r.found
      ? "You found the shield! Nobody can murder you tonight!"
      : r.shield === game.playerId
        ? "You were the best! You win the shield. Nobody can murder you tonight!"
        : `${character(r.shield).name} was the best, and wins the shield!`;
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

// ─── Catapults ──────────────────────────────────────────────────────────────
// Pictures slide along the wall; whatever is under the red line when Sam
// taps Fire is hit. The wall's `data-aim` says what's under it (tests).

const SLOT = 110;      // each picture's space on the wall
const PICTURE = 90;    // the picture itself; the rest is a gap (a miss)
const BELT_SPEED = 170;   // pixels a second

async function playCatapults() {
  const r = Math.random;
  const ids = stillIn(game).filter((id) => id !== game.playerId);
  const order = [...ids];
  order.splice(Math.floor(order.length / 2 + (r() - 0.5) * 6), 0, "shield");
  const belt = $("belt");
  belt.replaceChildren(...order.map((id) => {
    const t = document.createElement("div");
    t.className = "target";
    t.dataset.id = id;
    if (id === "shield") {
      const s = document.createElement("div");
      s.className = "shield-target";
      t.append(s, "Shield");
    } else {
      t.append(badge(character(id)), character(id).name);
    }
    return t;
  }));
  $("catapult").hidden = false;
  $("mission-how").hidden = true;
  const wall = $("wall");
  const width = order.length * SLOT;
  let offset = Math.floor(r() * (width - wall.clientWidth));
  let dir = 1;
  let last = performance.now();
  const aimAt = () => {
    const x = offset + wall.clientWidth / 2;
    const slot = Math.floor(x / SLOT);
    return x - slot * SLOT < PICTURE + (SLOT - PICTURE) / 2 && x - slot * SLOT > (SLOT - PICTURE) / 2 ? order[slot] ?? "" : "";
  };
  const move = every(30, () => {
    const now = performance.now();
    offset += dir * BELT_SPEED * Math.min(0.1, (now - last) / 1000);
    last = now;
    const max = width - wall.clientWidth;
    if (offset < 0) { offset = 0; dir = 1; }
    if (offset > max) { offset = max; dir = -1; }
    belt.style.transform = `translateX(${-offset}px)`;
    wall.dataset.aim = aimAt();
  });
  const hits = [];
  $("stones").textContent = `Stones left: ${STONES}`;
  $("mission-status").textContent = "Wait for someone to line up, then fire!";
  await new Promise((resolve) => {
    $("fire").onclick = () => {
      const aim = aimAt() || null;
      hits.push(aim);
      wall.classList.remove("thud");
      void wall.offsetWidth;
      wall.classList.add("thud");
      if (aim === "shield") $("mission-status").textContent = "Oh no! You hit the shield!";
      else if (aim) {
        belt.querySelector(`[data-id="${aim}"]`).classList.add("hit");
        $("mission-status").textContent = `Splat! You hit ${character(aim).name}!`;
      } else $("mission-status").textContent = "Missed!";
      $("stones").textContent = `Stones left: ${STONES - hits.length}`;
      if (hits.length === STONES) resolve();
    };
  });
  $("fire").onclick = null;
  clearInterval(move);
  await wait(900);
  const result = finishCatapults(game, hits, stillIn(game), mission);
  const mine = hits.filter((h) => h && h !== "shield");
  const line = mine.length ? `You hit ${mine.length} out of ${STONES}!` : "You didn't hit anyone!";
  const names = result.hit.map((id) => id === game.playerId ? "you" : character(id).name);
  const extra = names.length
    ? `Up for murder tonight: ${names.join(", ")}.`
    : "Nobody was hit, so nobody is up for murder!";
  finish(null, line, result, extra);
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
  const result = finishCooking(game, diner, meal, box, stillIn(game), mission);
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
