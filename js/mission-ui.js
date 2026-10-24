// The mission screens: Castle Bells and Chilli Pie Shuffle. Rules come
// from missions.js; this file draws and listens.
import { finishMission, todaysMission, bellTune, BELL_ROUNDS, BELLS, bellScore, pieRound, PIE_ROUNDS, pieScore } from "./missions.js";
import { stillIn } from "./castle.js";
import { $, show, character, wait, FAST } from "./ui.js";
import { narrate } from "./voice.js";
import { bell } from "./sound.js";

const BELL_COLOURS = ["#f2c14e", "#7fc4f5", "#ff7b6b", "#9be38a"];
const BELL_NAMES = ["Yellow", "Blue", "Red", "Green"];
const money = (n) => `£${n.toLocaleString("en-GB")}`;

let game = null;
let onDone = null;

// Show today's mission; `done` runs when Sam taps "Go to the castle".
export function startMission(g, done) {
  game = g;
  onDone = done;
  const m = todaysMission(game);
  $("screen-mission").classList.toggle("pies-mission", m.id === "pies");
  $("mission-name").textContent = `Mission ${game.day}: ${m.name}`;
  $("mission-how").textContent = m.how;
  $("mission-status").textContent = "";
  $("bells").hidden = true;
  $("pies").hidden = true;
  $("bells").dataset.round = $("pies").dataset.round = "";
  delete $("bells").dataset.flopped;
  $("mission-result").hidden = true;
  $("mission-go").hidden = false;
  $("mission-go").onclick = () => {
    $("mission-go").hidden = true;
    if (m.id === "bells") playBells();
    else playPies();
  };
  show("screen-mission");
  narrate(`Mission time! ${m.name}. ${m.how}`);
}

async function finish(score, line) {
  const r = finishMission(game, score, stillIn(game));
  $("mission-score").textContent = line;
  $("mission-pot").textContent = `The team won ${money(r.won)}! The pot is now ${money(game.pot)}.`;
  $("mission-shield").textContent = r.shield === game.playerId
    ? "You were the best! You win the shield. Nobody can murder you tonight!"
    : `${character(r.shield).name} was the best, and wins the shield!`;
  $("bells").hidden = true;
  $("pies").hidden = true;
  $("mission-status").textContent = "";
  $("mission-result").hidden = false;
  $("mission-done").onclick = () => onDone();
  narrate(`${line} ${$("mission-pot").textContent} ${$("mission-shield").textContent}`);
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
