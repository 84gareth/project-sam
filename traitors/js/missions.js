// Missions: one a day, before the castle (docs/missions.md). Pure: no page,
// no timers. Sam plays; everyone else scores from their skill plus luck.
// The team's scores fill the prize pot, and the best player wins the shield,
// so the Traitors can't murder them that night.

import { makeRandom, DAYS, TRAITOR } from "./game.js";
import { suspectList } from "./castle.js";
import { ROOMS } from "./puppets.js";

// All 13 of Sam's missions. `built` ones can be played so far.
export const MISSIONS = [
  { id: "bells", name: "Castle Bells", type: "memory", built: true,
    how: "Listen to the bells. Then ring them back in the same order!" },
  { id: "pies", name: "Chilli Pie Shuffle", type: "memory", built: true,
    how: "Watch Chef Pepper's chilli pie. Then find it after the shuffle!" },
  { id: "where", name: "Who Was Where?", type: "memory", built: true,
    how: "Look at who is in each room. Then answer: who was where?" },
  { id: "jumble", name: "Letter Jumble", type: "puzzle", built: true,
    how: "Tap the letters to spell each name. The first one might leave you a note!" },
  { id: "code", name: "Secret Code", type: "puzzle", built: true,
    how: "Use the key to crack the code. Tap the letters to spell each secret word." },
  { id: "maze", name: "Garden Maze", type: "puzzle", built: true,
    how: "Find your way out of the hedge maze. Tap the next square to walk!" },
  { id: "keys", name: "Lost Keys", type: "hunting", built: true,
    how: "Five keys are hidden in the library. Find them all, quick!" },
  { id: "footprints", name: "Muddy Footprints", type: "hunting", built: true,
    how: "Remember the boot print. Then follow the right footprints where the trail splits!" },
  { id: "portraits", name: "Portrait Gallery", type: "hunting", built: true,
    how: "Look at the pictures. When the lights come back on, which picture is new?" },
  { id: "treasure", name: "Treasure Hunt", type: "hunting", built: true,
    how: "Gold is hidden in the castle. Tap to search. Warmer means you're getting close!" },
  { id: "cooking", name: "Cooking Challenge", type: "puzzle", built: true,
    how: "Someone is coming to dinner. Cook them the food they hate! Then find the shield." },
  { id: "catapults", name: "Catapults", type: "hunting", built: true,
    how: "Fire stones at the pictures. Whoever gets hit is up for murder tonight! Don't hit the shield." },
  { id: "lights", name: "Lights Out", type: "puzzle", built: true,
    how: "Look at the shield. Then the lights flicker! Put the pieces back. Tap a piece, then its place." },
];

// Who is good (+1) or bad (-1) at each type, from their personality.
// Anyone not listed is normal (0).
export const SKILLS = {
  puddle: { hunting: 1, memory: -1 },
  gumdrop: { memory: 1, hunting: -1 },
  fizz: { puzzle: 1 },
  ruby: { memory: 1 },
  pepper: { hunting: 1 },
  waffle: { puzzle: -1 },
  plaster: { puzzle: 1 },
  lola: { memory: 1, puzzle: -1 },
  fern: { hunting: 1 },
  dot: { puzzle: 1, hunting: 1 },
  benny: { memory: -1 },
  mystic: { memory: 1 },
  tom: { hunting: 1 },
  zara: { hunting: 1, puzzle: -1 },
  grumble: { hunting: -1 },
  penny: { hunting: 1 },
  kick: { puzzle: -1 },
  stan: { memory: 1 },
  ivy: { puzzle: 1 },
  max: { memory: -1, hunting: -1 },
  olive: { puzzle: 1 },
  barry: { memory: -1 },
};

const POT_PER_MISSION = 10000;

function rng(game, ...parts) {
  let h = game.seed >>> 0;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return makeRandom(h);
}

// The missions this game plays, in order (a seeded shuffle of the built
// ones: 11 of the 13, one for each of days 2 to 12).
export function missionOrder(game) {
  const pool = MISSIONS.filter((m) => m.built);
  const r = rng(game, "missions");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DAYS - 1);
}

// No mission on day 1 (Gareth, 2026-10-24): days 2 to 12 have one each.
export function todaysMission(game) {
  if (game.day < 2) return null;
  const order = missionOrder(game);
  return order[(game.day - 2) % order.length];
}

// A computer player's score today, 0 to 1: skill plus luck.
export function computerScore(game, id, mission) {
  const skill = SKILLS[id]?.[mission.type] ?? 0;
  const luck = rng(game, "score", game.day, id)();
  return Math.min(1, Math.max(0, 0.5 + skill * 0.25 + (luck - 0.5) * 0.5));
}

// Finish today's mission with Sam's score (0 to 1). Everyone still in gets
// a score; the pot grows; the best player wins the shield.
// Returns { mission, scores: [[id, score]] best first, won, shield }.
// How many shields today's mission gives: usually 1, sometimes 2.
export const TWO_SHIELDS = 0.3;
export const shieldCount = (game) => (rng(game, "shields", game.day)() < TWO_SHIELDS ? 2 : 1);

// `mission` defaults to today's (the debug menu passes its own).
// `shield`: "broken" (nobody gets it) or who found it; else the best player.
export function finishMission(game, samScore, stillIn, mission = todaysMission(game), shield = undefined) {
  // `samScore`: the one real player's score, or { player: score } for several.
  const humanScore = (id) => (samScore && typeof samScore === "object" ? samScore[id] : id === game.playerId ? samScore : undefined);
  const scores = stillIn.map((id) => [id, humanScore(id) ?? computerScore(game, id, mission)]);
  scores.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const average = scores.reduce((sum, [, s]) => sum + s, 0) / scores.length;
  const won = Math.round((average * POT_PER_MISSION) / 500) * 500;
  game.pot = (game.pot ?? 0) + won;
  // Usually one shield, sometimes two (Sam: "should be possible for more
  // than one person to win one"): the best players win them. Someone who
  // found one (Cooking) gets one of them.
  const count = shieldCount(game);
  if (shield === "broken") game.shields = [];
  else {
    const first = shield ?? scores[0][0];
    game.shields = [first, ...scores.map(([id]) => id).filter((id) => id !== first)].slice(0, count);
  }
  return { mission, scores, won, shields: game.shields, count };
}

// ─── Castle Bells ───────────────────────────────────────────────────────────
// Four bells. Rounds of 3, 4, 5, 6 and 7 rings, each the start of one long
// tune. One mistake ends it.
export const BELLS = 4;
export const BELL_ROUNDS = [3, 4, 5, 6, 7];
export function bellTune(game) {
  const r = rng(game, "bells", game.day);
  return Array.from({ length: BELL_ROUNDS[BELL_ROUNDS.length - 1] }, () => Math.floor(r() * BELLS));
}
export const bellScore = (roundsDone) => roundsDone / BELL_ROUNDS.length;

// ─── Chilli Pie Shuffle ─────────────────────────────────────────────────────
// Three pies; the chilli pie starts in a random place. Each round has more
// swaps, and they go faster. Where it ends up is the answer.
export const PIE_ROUNDS = [{ swaps: 3, speed: 600 }, { swaps: 5, speed: 450 }, { swaps: 8, speed: 320 }];
export function pieRound(game, round) {
  const r = rng(game, "pies", game.day, round);
  const start = Math.floor(r() * 3);
  const swaps = [];
  for (let i = 0; i < PIE_ROUNDS[round].swaps; i++) {
    const a = Math.floor(r() * 3);
    const b = (a + 1 + Math.floor(r() * 2)) % 3;
    swaps.push([a, b]);
  }
  return { start, swaps, speed: PIE_ROUNDS[round].speed, answer: pieAfter(start, swaps) };
}
// Where the chilli pie is after the swaps (swapping the places a and b).
export function pieAfter(start, swaps) {
  let at = start;
  for (const [a, b] of swaps) {
    if (at === a) at = b;
    else if (at === b) at = a;
  }
  return at;
}
export const pieScore = (right) => right / PIE_ROUNDS.length;

// ─── Catapults (Sam's idea) ─────────────────────────────────────────────────
// Everyone else throws one stone; Sam throws three. Whoever is hit is up
// for murder tonight (and that night always has a murder). Hit the shield
// and it breaks: nobody gets it tonight.
export const STONES = 5;
const SHIELD_SLIP = 0.03;   // a miss that hits the shield instead
export function computerThrows(game, stillIn) {
  const mission = MISSIONS.find((m) => m.id === "catapults");
  const humans = game.humans ?? [game.playerId];
  return stillIn.filter((id) => !humans.includes(id)).map((id) => {
    const r = rng(game, "throw", game.day, id);
    if (computerScore(game, id, mission) > 0.5) return { thrower: id, target: suspectList(game, id)[0] };
    return { thrower: id, target: r() < SHIELD_SLIP ? "shield" : null };
  });
}
// `samHits`: what Sam's stones hit (ids, "shield", or null for a miss).
// `samHits`: Sam's stones, or { player: stones } for several real players.
export function finishCatapults(game, samHits, stillIn, mission = MISSIONS.find((m) => m.id === "catapults")) {
  const byHuman = Array.isArray(samHits) ? { [game.playerId]: samHits } : samHits;
  const throws = [...computerThrows(game, stillIn),
    ...Object.entries(byHuman).flatMap(([thrower, hits]) => hits.map((target) => ({ thrower, target })))];
  const broken = throws.some((t) => t.target === "shield");
  const hit = [...new Set(throws.map((t) => t.target).filter((t) => t && t !== "shield"))];
  const scores = Object.fromEntries(Object.entries(byHuman).map(([id, hits]) => [id, hits.filter((t) => t && t !== "shield").length / STONES]));
  const result = finishMission(game, scores, stillIn, mission, broken ? "broken" : undefined);
  game.upForMurder = { day: game.day, ids: hit };
  return { ...result, hit, broken, throws };
}

// The shooting gallery (Gareth: pictures "moving around all around the
// screen like a proper shooting gallery", and a slingshot with a pull-back).
// Positions are fractions of the gallery (x across, y down). A target is
// hit if the stone lands within its oval.
export const TARGET_RX = 0.045, TARGET_RY = 0.08;
export const SLING = { x: 0.5, y: 0.9 };        // where the stone sits
export const SLING_POWER = 3.4;                 // landing = sling - pull x power
export const SLING_MAX_PULL = 0.2;
export const FLIGHT = 0.7;                      // seconds in the air
export function galleryTargets(game, ids) {
  const r = rng(game, "gallery-targets", game.day);
  return ids.map((id) => {
    const speed = 0.12 + r() * 0.2;
    const a = r() * Math.PI * 2;
    return { id, x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.55, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 1.6 };
  });
}
// Move everyone on by dt seconds, bouncing off the edges (they stay in the
// top part; the slingshot is at the bottom).
export function moveTargets(targets, dt) {
  return targets.map((t) => {
    let { x, y, vx, vy } = t;
    x += vx * dt; y += vy * dt;
    if (x < TARGET_RX) { x = 2 * TARGET_RX - x; vx = Math.abs(vx); }
    if (x > 1 - TARGET_RX) { x = 2 * (1 - TARGET_RX) - x; vx = -Math.abs(vx); }
    if (y < TARGET_RY) { y = 2 * TARGET_RY - y; vy = Math.abs(vy); }
    if (y > 0.7) { y = 1.4 - y; vy = -Math.abs(vy); }
    return { ...t, x, y, vx, vy };
  });
}
// Where a stone lands for a pull of (dx, dy) back from the sling.
export function landing(dx, dy) {
  const len = Math.hypot(dx, dy);
  const k = len > SLING_MAX_PULL ? SLING_MAX_PULL / len : 1;
  return { x: SLING.x - dx * k * SLING_POWER, y: SLING.y - dy * k * SLING_POWER };
}
// Which target (if any) is at that spot: the nearest one whose oval covers it.
export function hitAt(targets, at) {
  let best = null, bestD = 1;
  for (const t of targets) {
    const d = ((at.x - t.x) / TARGET_RX) ** 2 + ((at.y - t.y) / TARGET_RY) ** 2;
    if (d <= 1 && d < bestD) { best = t.id; bestD = d; }
  }
  return best;
}

// ─── Cooking Challenge (Sam's idea) ─────────────────────────────────────────
// Three trucks of food. Someone comes to dinner with a clue about the food
// they hate: cook it and win money. One truck's secret box has the shield.
export const TRUCKS = [
  { id: "healthy", name: "Healthy truck", foods: ["Carrots", "Broccoli", "Soup", "Salad", "Peas", "Cabbage"] },
  { id: "meat", name: "Meat truck", foods: ["Sausages", "Fish", "Chicken", "Burger", "Meatballs", "Ham"] },
  { id: "dessert", name: "Dessert truck", foods: ["Strawberries", "Jelly", "Ice cream", "Pancakes", "Cake", "Custard"] },
];
// Today's menu: 4 of each truck's 6 foods, different each time (Gareth:
// "all missions should have randomised elements"). The diner's hated food
// is always on it somewhere.
export function truckFoods(game, diner) {
  const r = rng(game, "menu", game.day);
  return TRUCKS.map((t) => {
    const hated = t.foods.includes(HATES[diner][0]) ? [HATES[diner][0]] : [];
    const rest = shuffled(t.foods.filter((f) => !hated.includes(f)), r).slice(0, 4 - hated.length);
    return shuffled([...hated, ...rest], r);
  });
}
// Everyone's least favourite food, and the clue they give.
export const HATES = {
  puddle: ["Soup", "I hate anything wet!"],
  gumdrop: ["Broccoli", "Little green trees? No thank you, dearie."],
  fizz: ["Jelly", "Wobbly food is scientifically suspicious!"],
  ruby: ["Sausages", "Anything shaped like a train carriage. I just can't!"],
  pepper: ["Strawberries", "Anything red and sweet that ISN'T a chilli!"],
  waffle: ["Pancakes", "Flat and round, but not a waffle. My sworn enemy!"],
  plaster: ["Burger", "Too greasy! Doctor's orders."],
  lola: ["Ice cream", "Cold food freezes my singing voice!"],
  fern: ["Chicken", "I'd never eat my farmyard friends with feathers."],
  dot: ["Carrots", "Orange and crunchy. Very suspicious."],
  benny: ["Salad", "Leaves? Where's the crunch?"],
  mystic: ["Fish", "I saw it in my crystal ball... and it was swimming!"],
  tom: ["Carrots", "Long and thin, just like me. Too weird!"],
  zara: ["Soup", "You have to eat it slowly. I don't do slow!"],
  grumble: ["Jelly", "Wobbly, cheerful food. Bah!"],
  penny: ["Soup", "It leaks out of my pockets!"],
  kick: ["Salad", "Rabbit food! I need proper energy!"],
  stan: ["Fish", "It smells like platform two at lunchtime."],
  ivy: ["Strawberries", "Red juice drips all over my books!"],
  max: ["Burger", "I got lost inside a burger once. Long story."],
  olive: ["Broccoli", "It's green and doesn't match my socks."],
  barry: ["Pancakes", "As flat as my banjo playing!"],
};
export function cookingDiner(game, stillIn) {
  const others = stillIn.filter((id) => id !== game.playerId);
  return others[Math.floor(rng(game, "diner", game.day)() * others.length)];
}
export const shieldTruck = (game) => Math.floor(rng(game, "shield-box", game.day)() * TRUCKS.length);
export const cookScore = (diner, meal) => (meal.includes(HATES[diner][0]) ? 1 : 0.3);
export function finishCooking(game, diner, meal, box, stillIn, mission = MISSIONS.find((m) => m.id === "cooking")) {
  const found = box === shieldTruck(game);
  const score = cookScore(diner, meal);
  return { ...finishMission(game, score, stillIn, mission, found ? game.playerId : undefined), found, score };
}

// ─── Notes from people who have gone (Sam: "a note from them") ──────────────
// Who has left the game, newest first; the murdered ones first of all.
export function gone(game) {
  const murdered = [], banished = [];
  for (const h of [...game.history].reverse()) {
    if (h.murdered) murdered.push(h.murdered);
    if (h.banished) banished.push(h.banished);
  }
  return [...murdered, ...banished];
}
// `who` (gone) names the person they suspected most. They might be wrong!
export function noteFrom(game, who) {
  if (!game.scores[who]) return null;
  return { from: who, suspect: suspectList(game, who)[0] };
}

// A seeded shuffle.
function shuffled(list, r) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Who Was Where? ─────────────────────────────────────────────────────────
// Up to 3 people in each room; then 3 questions, each with 4 names.
export function whereRounds(game, stillIn) {
  const r = rng(game, "where", game.day);
  const people = shuffled(stillIn.filter((id) => id !== game.playerId), r);
  const per = Math.min(3, Math.floor(people.length / ROOMS.length));
  const rooms = Object.fromEntries(ROOMS.map((room, i) => [room.id, people.slice(i * per, i * per + per)]));
  const placed = Object.values(rooms).flat();
  const questions = shuffled(ROOMS, r).slice(0, 3).map((room) => {
    const answer = rooms[room.id][Math.floor(r() * per)];
    const others = shuffled(placed.filter((id) => !rooms[room.id].includes(id)), r).slice(0, 3);
    return { room: room.id, answer, options: shuffled([answer, ...others], r) };
  });
  return { rooms, questions };
}

// ─── Letter Jumble ──────────────────────────────────────────────────────────
// Three names to unjumble. The first is the last person murdered (or
// banished): spell it to get their note.
export function jumbleWords(game, stillIn) {
  const r = rng(game, "jumble", game.day);
  const first = gone(game)[0] ?? null;
  const pool = shuffled([...stillIn, ...gone(game)].filter((id) => id !== first && id !== game.playerId && id.length >= 3), r);
  const ids = [first ?? pool.pop(), pool[0], pool[1]];
  return ids.map((id) => {
    const word = id.toUpperCase();
    let letters = shuffled([...word], r);
    for (let k = 0; letters.join("") === word && k < 10; k++) letters = shuffled([...word], r);
    return { id, word, letters, note: id === first };
  });
}

// ─── Secret Code ────────────────────────────────────────────────────────────
// Each letter has a coloured shape. Three words to spell from their shapes.
export const SHAPES = ["circle", "square", "triangle", "diamond", "cross"];
export const SHAPE_COLOURS = ["#e2453c", "#3b7dd8", "#3fa34d"];
export const CODE_WORDS = ["SHIELD", "CASTLE", "TOWER", "CROWN", "FEAST", "KNIGHT", "SECRET", "DRAGON", "TORCH", "SWORD", "GOLD", "TRAIN"];
export function secretCode(game) {
  const r = rng(game, "code", game.day);
  let words, letters;
  do {
    words = shuffled(CODE_WORDS, r).slice(0, 3);
    letters = [...new Set(words.join(""))];
  } while (letters.length > SHAPES.length * SHAPE_COLOURS.length);
  const symbols = shuffled(SHAPES.flatMap((shape) => SHAPE_COLOURS.map((colour) => ({ shape, colour }))), r);
  const key = Object.fromEntries(shuffled(letters, r).map((l, i) => [l, symbols[i]]));
  return { words, key };
}
export const CODE_TRIES = 3;

// ─── Garden Maze ────────────────────────────────────────────────────────────
// A hedge maze, made by a seeded walk. walls[y][x] = { n, e, s, w } (true =
// a hedge). Start top left, way out bottom right.
export const MAZE_W = 9, MAZE_H = 7, MAZE_SECONDS = 60;
export function makeMaze(game) {
  const r = rng(game, "maze", game.day);
  const walls = Array.from({ length: MAZE_H }, () => Array.from({ length: MAZE_W }, () => ({ n: true, e: true, s: true, w: true })));
  const seen = new Set(["0,0"]);
  const stack = [[0, 0]];
  const steps = { n: [0, -1, "s"], e: [1, 0, "w"], s: [0, 1, "n"], w: [-1, 0, "e"] };
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = Object.entries(steps)
      .map(([d, [dx, dy, back]]) => [d, x + dx, y + dy, back])
      .filter(([, nx, ny]) => nx >= 0 && ny >= 0 && nx < MAZE_W && ny < MAZE_H && !seen.has(`${nx},${ny}`));
    if (!next.length) { stack.pop(); continue; }
    const [d, nx, ny, back] = next[Math.floor(r() * next.length)];
    walls[y][x][d] = false;
    walls[ny][nx][back] = false;
    seen.add(`${nx},${ny}`);
    stack.push([nx, ny]);
  }
  // Start and way out in opposite corners, a different pair each time.
  const corners = [[0, 0], [MAZE_W - 1, 0], [0, MAZE_H - 1], [MAZE_W - 1, MAZE_H - 1]];
  const start = corners[Math.floor(r() * corners.length)];
  const exit = [MAZE_W - 1 - start[0], MAZE_H - 1 - start[1]];
  return { walls, start, exit };
}

// Smooth walking (Gareth: "an onscreen joystick with smooth movement").
// You're a round counter of radius MAZE_R in square units; position {x, y}
// (the middle of square [i, j] is i + 0.5, j + 0.5). Move by (dx, dy): you
// can't pass a hedge, and can only go into the next square when you're
// lined up with the gap (no squeezing round corners).
export const MAZE_R = 0.28, MAZE_SPEED = 3;   // squares a second
function slide(maze, pos, d, axis) {
  const along = axis === "x" ? pos.x : pos.y;
  const across = axis === "x" ? pos.y : pos.x;
  const cell = Math.floor(along), lane = Math.floor(across);
  const lined = across - MAZE_R >= lane - 1e-9 && across + MAZE_R <= lane + 1 + 1e-9;
  const wall = (cx, cy, side) => cy < 0 || cy >= MAZE_H || cx < 0 || cx >= MAZE_W || maze.walls[cy][cx][side];
  const [i, j] = axis === "x" ? [cell, lane] : [lane, cell];
  let to = along + d;
  if (d > 0) {
    const blocked = !lined || wall(i, j, axis === "x" ? "e" : "s");
    if (blocked) to = Math.min(to, cell + 1 - MAZE_R);
    else to = Math.min(to, cell + 2 - MAZE_R);
  } else if (d < 0) {
    const blocked = !lined || wall(i, j, axis === "x" ? "w" : "n");
    if (blocked) to = Math.max(to, cell + MAZE_R);
    else to = Math.max(to, cell - 1 + MAZE_R);
  }
  return axis === "x" ? { x: to, y: pos.y } : { x: pos.x, y: to };
}
export function mazeMove(maze, pos, dx, dy) {
  let p = { ...pos };
  // Small steps, so a fast move can't jump a hedge.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
  for (let k = 0; k < steps; k++) {
    p = slide(maze, p, dx / steps, "x");
    p = slide(maze, p, dy / steps, "y");
  }
  return p;
}
export const mazeSquare = (pos) => [Math.floor(pos.x), Math.floor(pos.y)];
// Can you step from (x, y) to the square next door at (nx, ny)?
export function canStep(maze, [x, y], [nx, ny]) {
  const dx = nx - x, dy = ny - y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const d = dx === 1 ? "e" : dx === -1 ? "w" : dy === 1 ? "s" : "n";
  return !maze.walls[y][x][d];
}
// Steps from `from` to the way out.
export function stepsOut(maze, from) {
  const key = ([x, y]) => `${x},${y}`;
  const dist = new Map([[key(from), 0]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (key(at) === key(maze.exit)) return dist.get(key(at));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [at[0] + dx, at[1] + dy];
      if (n[0] < 0 || n[1] < 0 || n[0] >= MAZE_W || n[1] >= MAZE_H || dist.has(key(n)) || !canStep(maze, at, n)) continue;
      dist.set(key(n), dist.get(key(at)) + 1);
      queue.push(n);
    }
  }
  return Infinity;
}
export const mazeScore = (maze, at) => Math.max(0, 1 - stepsOut(maze, at) / stepsOut(maze, maze.start));

// ─── Lost Keys (remade: Sam, "look behind things") ──────────────────────────
// 14 things in the library; 5 hide a key. You can look behind 9 of them.
// Look behind one with no key and you might hear a jingle: a key is close.
export const KEYS = 5, HIDING_PLACES = 14, LOOKS = 9, JINGLE_NEAR = 0.24;
export const HIDING_KINDS = ["books", "chair", "painting", "clock", "globe", "lamp", "chest", "plant"];
export function keyHides(game) {
  const r = rng(game, "keys", game.day);
  const spots = [];
  for (let tries = 0; spots.length < HIDING_PLACES && tries < 5000; tries++) {
    const s = { x: 0.07 + r() * 0.86, y: 0.22 + r() * 0.64 };
    if (spots.every((o) => Math.hypot(o.x - s.x, (o.y - s.y) * 0.56) > 0.085)) spots.push(s);
  }
  spots.forEach((s, i) => { s.kind = HIDING_KINDS[i % HIDING_KINDS.length]; });
  const keys = shuffled([...spots.keys()], r).slice(0, KEYS).sort((x, y) => x - y);
  return { spots, keys };
}
// How many hidden keys are near place i (not counting one behind it).
export function jingles(hides, i) {
  const s = hides.spots[i];
  return hides.keys.filter((k) => k !== i && Math.hypot(hides.spots[k].x - s.x, (hides.spots[k].y - s.y) * 0.56) < JINGLE_NEAR).length;
}

// ─── Muddy Footprints (remade: Gareth, "it needs a complete rework") ────────
// Boot prints pop up one at a time along a trail round the garden; tap each
// before it fades. Fox and duck prints pop up too: don't tap those! It gets
// faster. Follow the trail well and you find a note at the end.
export const BOOT_PRINTS = 16;
export function footprintEvents(game) {
  const r = rng(game, "footprints", game.day);
  const events = [];
  // On the ground: the bottom part of the garden picture.
  const TOP = 0.58, BOTTOM = 0.92;
  let x = 0.08, y = TOP + r() * (BOTTOM - TOP), heading = (r() - 0.5) * 0.8;
  let at = 600;
  for (let i = 0; i < BOOT_PRINTS; i++) {
    // Wander on, turning a little, bouncing off the edges of the garden.
    heading += (r() - 0.5) * 1.1;
    let nx = x + Math.cos(heading) * 0.075, ny = y + Math.sin(heading) * 0.07;
    if (nx < 0.06 || nx > 0.94) { heading = Math.PI - heading; nx = x + Math.cos(heading) * 0.075; }
    if (ny < TOP || ny > BOTTOM) { heading = -heading; ny = y + Math.sin(heading) * 0.07; }
    x = Math.min(0.94, Math.max(0.06, nx));
    y = Math.min(BOTTOM, Math.max(TOP, ny));
    const side = i % 2 ? 1 : -1;   // left foot, right foot
    const life = Math.round(1700 - (1000 * i) / (BOOT_PRINTS - 1));   // 1.7 s down to 0.7 s
    events.push({ kind: "boot", x: x + Math.sin(heading) * 0.012 * side, y: y - Math.cos(heading) * 0.02 * side,
      angle: (heading * 180) / Math.PI + 90, at, life });
    // Now and then a fox or a duck crosses the trail too.
    if (i > 1 && r() < 0.45) {
      events.push({ kind: r() < 0.5 ? "fox" : "duck", x: 0.08 + r() * 0.84, y: TOP + r() * (BOTTOM - TOP),
        angle: r() * 360, at: at + Math.round(r() * 300), life: life + 300 });
    }
    at += Math.round(life * 0.8);
  }
  return events.sort((p, q) => p.at - q.at);
}
// Score: boot prints tapped out of all of them, less a bit for each wrong tap.
export const footprintScore = (hits, wrong) => Math.max(0, Math.min(1, hits / BOOT_PRINTS - wrong * 0.1));
export const footprintNote = (score) => score >= 0.6;

// ─── Portrait Gallery ───────────────────────────────────────────────────────
// Three rounds: a wall of 6, 8 then 10 portraits, then one new one. The
// last new one is someone who has gone (with a note), if anyone has.
export function galleryRounds(game) {
  const r = rng(game, "gallery", game.day);
  const left = gone(game);
  const all = shuffled(game.players.map((p) => p.id).filter((id) => id !== game.playerId), r);
  const last = left[0] ?? all[0];
  const others = all.filter((id) => id !== last);
  return [6, 8, 10].map((n, i) => {
    const newcomer = i === 2 ? last : others[i];
    const wall = shuffled(others.filter((id) => id !== newcomer), r).slice(0, n);
    const after = [...wall];
    after.splice(Math.floor(r() * (n + 1)), 0, newcomer);
    return { wall, after, newcomer, note: i === 2 && left.length > 0 };
  });
}

// ─── Treasure Hunt ──────────────────────────────────────────────────────────
export const TREASURE_TAPS = 12;
export function treasureSpot(game) {
  const r = rng(game, "treasure", game.day);
  return { room: ROOMS[Math.floor(r() * ROOMS.length)].id, x: 0.15 + r() * 0.7, y: 0.3 + r() * 0.6 };
}
// A tap at (x, y) in `room`: "found", "warmer", "colder" or "wrong room".
// `before`: the last distance in the right room (or null).
export const FOUND_NEAR = 0.09;
export function treasureTap(spot, room, x, y, before) {
  if (room !== spot.room) return { said: "wrong room", dist: null };
  const dist = Math.hypot(x - spot.x, y - spot.y);
  if (dist <= FOUND_NEAR) return { said: "found", dist };
  if (before === null) return { said: dist < 0.3 ? "warm" : "cold", dist };
  return { said: dist < before ? "warmer" : "colder", dist };
}
export const treasureScore = (found, taps) => (found ? Math.max(0.3, 1 - (taps - 1) / TREASURE_TAPS) : 0);

// ─── Lights Out ─────────────────────────────────────────────────────────────
export const PIECES = 9, LIGHTS_SECONDS = 45;
export const lightsTray = (game) => shuffled([...Array(PIECES).keys()], rng(game, "lights", game.day));
// Which of the shield pictures to rebuild today.
export const SHIELD_DESIGNS = 4;
export const lightsDesign = (game) => Math.floor(rng(game, "lights-design", game.day)() * SHIELD_DESIGNS);
export const lightsScore = (placed) => placed.filter((p, slot) => p === slot).length / PIECES;

// Doing a mission as badly as possible (the tests' "give up"): nobody hit,
// a meal without the hated food and the wrong box, or a score of 0.
export function flopResult(game, stillIn, mission = todaysMission(game)) {
  if (mission.id === "catapults") return finishCatapults(game, [null, null, null], stillIn, mission);
  if (mission.id === "cooking") {
    const diner = cookingDiner(game, stillIn);
    const meal = TRUCKS.map((t) => t.foods.find((f) => f !== HATES[diner][0]));
    return finishCooking(game, diner, meal, (shieldTruck(game) + 1) % TRUCKS.length, stillIn, mission);
  }
  return finishMission(game, 0, stillIn, mission);
}

// Moving the pieces (Gareth: "you need to be able to swap pieces you've
// already placed"). State: { placed: [9 slots: piece or null], tray: [pieces],
// picked: null or { from: "tray" | "slot", at: piece or slot } }. Tap a tray
// piece or a placed piece to pick it up; tap a slot to put it there (swapping
// with whatever was there); tap the tray to put a placed piece back.
export function lightsStart(game) {
  return { placed: Array(PIECES).fill(null), tray: lightsTray(game), picked: null };
}
export function lightsTap(state, where, at) {
  const s = { placed: [...state.placed], tray: [...state.tray], picked: state.picked };
  const p = s.picked;
  if (where === "tray-piece") {
    s.picked = p && p.from === "tray" && p.at === at ? null : { from: "tray", at };
    return s;
  }
  if (where === "tray") {
    if (p && p.from === "slot") {
      s.tray.push(s.placed[p.at]);
      s.placed[p.at] = null;
    }
    s.picked = null;
    return s;
  }
  // A slot.
  if (!p) {
    if (s.placed[at] !== null) s.picked = { from: "slot", at };
    return s;
  }
  if (p.from === "slot") {
    [s.placed[at], s.placed[p.at]] = [s.placed[p.at], s.placed[at]];
  } else {
    if (s.placed[at] !== null) s.tray.push(s.placed[at]);
    s.placed[at] = p.at;
    s.tray = s.tray.filter((x) => x !== p.at);
  }
  s.picked = null;
  return s;
}

// The same, as one real player's part of the decision (engine.js).
export function flopPart(mission) {
  if (mission.id === "catapults") return { score: 0, hits: [null, null, null] };
  if (mission.id === "cooking") return { score: 0.3, found: false };
  return { score: 0 };
}
