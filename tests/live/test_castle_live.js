// A day at the castle on the real page: chat, vote with chalkboards, reveal.
import { test, assert, openPage, until } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL } from "../../js/game.js";
import {
  arriveAtCastle, roundTable, night, winner, stillIn, recruit, tableTalk, talkOptions, playerSays,
  nightKind, isTraitor,
} from "../../js/castle.js";
import {
  todaysMission, bellTune, pieRound, cookingDiner, shieldTruck, TRUCKS, HATES, flopResult, MISSIONS,
  whereRounds, jumbleWords, secretCode, makeMaze, canStep, MAZE_W, MAZE_H, galleryRounds,
  treasureSpot, truckFoods, SLING, SLING_POWER, FLIGHT, keyHides,
} from "../../js/missions.js";

// What flopMission does, as rules (for rehearsing a game to find a seed).
const rehearseFlop = (g) => flopResult(g, stillIn(g));

// Sam's words at the Round Table sway the others, so rehearsals must say them too.
const sayFirst = (g) => playerSays(g, talkOptions(g, tableTalk(g))[0]);
const sayQuiet = (g) => { const o = talkOptions(g, tableTalk(g)); playerSays(g, o[o.length - 1]); };

function seedFor(id, side) {
  for (let seed = 1; seed <= 10000; seed++) if (newGame(id, seed).playerSide === side) return seed;
  throw new Error(`no seed in 10000 makes ${id} a ${side}`);
}

// Station -> Chef Pepper -> secret -> castle. ?fast=1 skips the pauses.
async function toCastle(seed) {
  const page = await openPage(`../index.html?seed=${seed}&fast=1`);
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "cards built");
  doc.getElementById("start").click();
  doc.querySelectorAll("#cards .card")[4].click();
  doc.getElementById("choose").click();
  doc.getElementById("to-castle").click();
  await until(() => !doc.getElementById("screen-castle").hidden, "the train ride arrives at the castle (no mission on day 1)", 8000);
  return { page, doc };
}

// Give up today's mission at once (the test-only give-up: as badly as
// possible, the same as flopResult), then go to the castle.
async function flopMission(page, doc) {
  doc.getElementById("mission-go").click();
  page.missionGiveUp();
  assert.ok(visible(doc, "mission-result"), "the mission is over");
  doc.getElementById("mission-done").click();
  await until(() => !doc.getElementById("screen-castle").hidden, "on to the castle");
}
const visible = (doc, id) => !doc.getElementById(id).hidden;
// Redraw the castle now (after a test moves people about).
const redraw = (page) => page.castleTick();
// Someone in Sam's room who isn't busy chatting (tapping a chatting pair
// opens "join their chat" instead). Held still so they stay put.
function someoneFree(page, doc) {
  const room = page.world.me.room;
  const id = Object.entries(page.world.people).find(([, p]) => p.room === room && p.mode !== "chat")?.[0]
    ?? Object.keys(page.world.people).find((x) => x !== "pepper");
  Object.assign(page.world.people[id], { room, mode: "chat", with: page.game.playerId, timer: 99, x: 0.3, y: 0.85 });
  redraw(page);
  return doc.querySelector(`.puppet[data-id="${id}"]`);
}

test("the train takes you to the castle: everyone else is walking round its rooms", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  assert.ok(visible(doc, "screen-castle"));
  assert.eq(doc.getElementById("castle-day").textContent, "Day 1 of 12");
  assert.eq(Object.keys(page.world.people).length, 21, "21 others in the castle");
  assert.eq(doc.getElementById("room-name").textContent, "Great hall", "Sam starts in the great hall");
  await until(() => doc.querySelectorAll(".puppet:not(.me)").length > 0, "puppets in the room");
  const here = Object.entries(page.world.people).filter(([, p]) => p.room === "hall").length;
  assert.eq(doc.querySelectorAll(".puppet:not(.me)").length, here, "everyone in the hall is drawn");
  assert.eq(doc.querySelectorAll(".puppet.me").length, 1, "and Sam");
  assert.notOk(visible(doc, "fellows"), "a Faithful doesn't see any Traitors");
});

// Walking itself is tested in unit/test_puppets.js. In the full headless
// run the test browser stops sending animation frames partway, so this only
// checks that the door button is wired up and shows the right room.
test("the door shows the next room and starts Sam walking through it", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  assert.ok(doc.getElementById("door-right").textContent.startsWith("Library"), "the right door goes to the library");
  assert.ok(doc.getElementById("door-left").textContent.includes("Kitchen"), "the left door goes to the kitchen");
  doc.getElementById("door-right").click();
  assert.eq(page.world.me.door, "right", "heading for the door");
  assert.ok(page.world.me.walking, "walking");
});

test("chat: tap someone, ask all six questions, they answer", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  someoneFree(page, doc).click();
  assert.ok(visible(doc, "screen-chat"));
  const buttons = doc.querySelectorAll("#questions .question");
  assert.eq(buttons.length, 6);
  for (const b of buttons) {
    b.click();
    assert.ok(visible(doc, "bubble"), b.textContent);
    assert.gt(doc.getElementById("bubble-text").textContent.length, 0, b.textContent);
  }
  buttons[0].click();
  assert.eq(doc.querySelectorAll("#bubble-list li").length, 5, "their list shows 5 names");
  doc.getElementById("chat-back").click();
  assert.ok(visible(doc, "screen-castle"), "back to everyone");
});

test("a Traitor sees the other two Traitors", async () => {
  const seed = seedFor("pepper", TRAITOR);
  const { page, doc } = await toCastle(seed);
  assert.ok(visible(doc, "fellows"));
  const others = page.game.players.filter((p) => p.side === TRAITOR && p.id !== "pepper");
  assert.eq(others.length, 2);
  const { CHARACTERS } = await import("../../js/characters.js");
  for (const o of others) {
    const name = CHARACTERS.find((c) => c.id === o.id).name;
    assert.ok(doc.getElementById("fellows").textContent.includes(name), name);
  }
});

// A seed where, after Sam (Chef Pepper) votes for the first person on the
// Round Table (Captain Puddle), the night does what `want` says.
function nightSeed(side, want) {
  for (let seed = 1; seed <= 5000; seed++) {
    if (newGame("pepper", seed).playerSide !== side) continue;
    const g = arriveAtCastle(newGame("pepper", seed));
    sayFirst(g);
    roundTable(g, "puddle");
    if (winner(g) || !stillIn(g).includes("pepper")) continue;
    if (side === TRAITOR || want(recruit(g))) return seed;
  }
  throw new Error("no seed found");
}

async function talkThenTable(doc) {
  if (doc.getElementById("screen-talk").hidden) doc.getElementById("to-table").click();
  await until(() => !doc.getElementById("talk-options").hidden, "the Round Table talk", 8000);
  doc.querySelector("#talk-options .question").click();
  await until(() => !doc.getElementById("to-vote").hidden, "Sam has spoken");
  doc.getElementById("to-vote").click();
}

async function voteAndReveal(doc) {
  await talkThenTable(doc);
  doc.querySelector("#table-cards .card").click();
  doc.getElementById("cast-vote").click();
  await until(() => !doc.getElementById("to-reveal").hidden, "all the chalkboards are up");
  doc.getElementById("to-reveal").click();
  await until(() => !doc.getElementById("after-reveal").hidden || !doc.getElementById("game-over").hidden, "the reveal", 8000);
}

test("Round Table: vote, everyone shows a chalkboard, drum roll, reveal, next day", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  await talkThenTable(doc);
  assert.ok(visible(doc, "screen-table"));
  assert.ok(doc.getElementById("cast-vote").disabled, "can't vote before picking");
  doc.querySelector("#table-cards .card").click();
  doc.getElementById("cast-vote").click();
  await until(() => visible(doc, "to-reveal"), "all the chalkboards are up");
  assert.eq(doc.querySelectorAll("#boards .chalkboard").length, 22, "22 chalkboards");
  assert.eq(doc.getElementById("boards").dataset.pauses, "3", "stopped 3 times to count the votes");
  assert.ok([...doc.querySelectorAll(".board-voter")].some((b) => b.textContent === "You"), "yours is there");
  doc.getElementById("to-reveal").click();
  await until(() => doc.getElementById("reveal").textContent.includes("!"), "the reveal", 8000);
  const out = page.game.history[0];
  const word = out.side === TRAITOR ? "TRAITOR!" : "FAITHFUL!";
  assert.eq(doc.getElementById("reveal").textContent, `I am a... ${word}`);
  assert.ok(visible(doc, "after-reveal"), "Night falls button");
  doc.getElementById("next-day").click();
  await until(() => visible(doc, "to-breakfast") || visible(doc, "night-over"), "the night passes");
  doc.getElementById("to-breakfast").click();
  await until(() => visible(doc, "start-day") || visible(doc, "breakfast-over"), "breakfast", 8000);
  assert.ok(page.game.history[0].recruited, "night 1: the Traitors recruited someone");
  assert.notOk(page.game.history[0].murdered, "and nobody was murdered");
  assert.ok(doc.getElementById("missing").textContent.includes("Nobody was murdered"));
  assert.eq(doc.querySelectorAll("#arrivals .arrival-person").length, 21, "all 21 came to breakfast");
  assert.ok(doc.getElementById("crossout").hidden, "the crossed-out panel has made way for everyone");
  assert.eq(doc.querySelectorAll("#gone .arrival-person").length, 22, "everyone on the list");
  const gone = [...doc.querySelectorAll("#gone .gone-person")].map((g) => g.dataset.id).sort();
  assert.eq(gone, [out.banished], "only the banished one is crossed out");
  doc.getElementById("start-day").click();
  await flopMission(page, doc);
  assert.eq(doc.getElementById("castle-day").textContent, "Day 2 of 12");
  await until(() => doc.querySelector(".puppet.me"), "back in the castle");
  assert.notOk(doc.querySelector(`.puppet[data-id="${out.banished}"]`), "the banished one has gone from the castle");
});

test("night 1: if the Traitors recruit Sam, a letter makes him a Traitor", async () => {
  const { page, doc } = await toCastle(nightSeed(FAITHFUL, (v) => v === "pepper"));
  await voteAndReveal(doc);
  doc.getElementById("next-day").click();
  await until(() => visible(doc, "envelope"), "a sealed letter", 8000);
  assert.notOk(visible(doc, "letter"), "sealed until you tap it");
  assert.notOk(visible(doc, "to-breakfast"), "open it first");
  doc.getElementById("envelope").click();
  await until(() => visible(doc, "letter"), "the letter unfolds", 8000);
  assert.ok(doc.getElementById("letter").textContent.includes("By order of the Traitors"));
  assert.ok(doc.getElementById("letter").textContent.includes("you are now a Traitor"));
  assert.eq(page.game.playerSide, TRAITOR);
  assert.ok(visible(doc, "to-breakfast"), "then breakfast, as a Traitor");
});

test("a Faithful who is murdered (night 2) gets the letter", async () => {
  // A seed where the night-1 recruit isn't Sam and night 2 murders Sam.
  let seed = 0;
  for (let s = 1; s <= 5000 && !seed; s++) {
    if (newGame("pepper", s).playerSide !== FAITHFUL) continue;
    const g = arriveAtCastle(newGame("pepper", s));
    sayFirst(g);
    roundTable(g, "puddle");
    if (winner(g) || !stillIn(g).includes("pepper") || recruit(g) === "pepper") continue;
    rehearseFlop(g);
    sayQuiet(g);
    roundTable(g, stillIn(g).find((id) => id !== "pepper"));
    if (winner(g) || !stillIn(g).includes("pepper")) continue;
    if (nightKind(g) === "murder" && night(g) === "pepper") seed = s;
  }
  assert.gt(seed, 0, "found a game");
  const { page, doc } = await toCastle(seed);
  await voteAndReveal(doc);
  doc.getElementById("next-day").click();
  await until(() => visible(doc, "to-breakfast"), "no letter on night 1", 8000);
  doc.getElementById("to-breakfast").click();
  await until(() => visible(doc, "start-day"), "breakfast", 8000);
  doc.getElementById("start-day").click();
  await flopMission(page, doc);
  // Day 2: the Round Table picks the first person still on the list.
  doc.getElementById("to-table").click();
  await until(() => visible(doc, "talk-options"), "the talk", 8000);
  doc.querySelector("#talk-options .question:last-child").click();
  doc.getElementById("to-vote").click();
  [...doc.querySelectorAll("#table-cards .card")].find((c) => c.dataset.id !== "pepper").click();
  doc.getElementById("cast-vote").click();
  await until(() => visible(doc, "to-reveal"), "the chalkboards", 20000);
  doc.getElementById("to-reveal").click();
  await until(() => visible(doc, "after-reveal") || visible(doc, "game-over"), "the reveal", 8000);
  if (visible(doc, "game-over")) return;   // the game ended at the table instead
  doc.getElementById("next-day").click();
  await until(() => visible(doc, "envelope"), "a sealed letter", 8000);
  doc.getElementById("envelope").click();
  await until(() => visible(doc, "letter"), "the letter unfolds", 8000);
  assert.ok(doc.getElementById("letter").textContent.includes("you have been murdered"));
  assert.ok(visible(doc, "night-over"), "Play again");
});

test("a Traitor goes to the secret meeting and picks who to recruit (night 1)", async () => {
  const { page, doc } = await toCastle(nightSeed(TRAITOR));
  await voteAndReveal(doc);
  doc.getElementById("next-day").click();
  assert.ok(visible(doc, "screen-traitors"), "the secret meeting");
  assert.gt(doc.querySelectorAll("#traitor-ideas .idea").length, 0, "the others give ideas");
  assert.ok(doc.getElementById("meeting-hint").textContent.includes("recruit"), "it's the recruiting night");
  assert.ok(doc.getElementById("murder").disabled, "pick first");
  const pick = doc.querySelectorAll("#victim-cards .card")[2];
  pick.click();
  doc.getElementById("murder").click();
  await until(() => visible(doc, "start-day") || visible(doc, "breakfast-over"), "breakfast", 8000);
  assert.eq(page.game.history[0].recruited, pick.dataset.id, "Sam's pick joined the Traitors");
  assert.eq(page.game.players.find((p) => p.id === pick.dataset.id).side, TRAITOR);
  for (const id of [...doc.querySelectorAll("#victim-cards .card")].map((c) => c.dataset.id)) {
    if (id === pick.dataset.id) continue;
    assert.eq(page.game.players.find((p) => p.id === id).side, FAITHFUL, "only Faithfuls to pick from");
  }
});

test("the voices button switches voices off and on", async () => {
  const { page, doc } = await toCastle(1);
  const btn = doc.getElementById("voices");
  const before = btn.textContent;
  btn.click();
  assert.ne(btn.textContent, before);
  btn.click();
  assert.eq(btn.textContent, before);
});

// Listen in on what the page says out loud (instead of really speaking).
function listen(page) {
  const said = [];
  page.speechSynthesis.cancel = () => {};
  page.speechSynthesis.speak = (u) => said.push({ text: u.text, pitch: u.pitch, rate: u.rate });
  page.localStorage.setItem("project-sam-voices", "on");
  return said;
}

test("every chat answer is spoken, in that character's own voice every time", async () => {
  const { voiceFor } = await import("../../js/voice.js");
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  const said = listen(page);
  const cardEl = someoneFree(page, doc);
  const id = cardEl.dataset.id;
  cardEl.click();
  for (const b of doc.querySelectorAll("#questions .question")) b.click();
  const lines = said.filter((s) => !s.text.startsWith("Day "));
  assert.eq(lines.length, 6, "six answers, six spoken lines");
  for (const l of lines) {
    assert.near(l.pitch, voiceFor(id).pitch, 1e-6, "same voice every line");
    assert.near(l.rate, voiceFor(id).rate, 1e-6);
  }
  assert.eq(lines[5].text, doc.getElementById("bubble-text").textContent, "it says what the bubble says");
});

test("at the secret meeting, each Traitor says their idea out loud", async () => {
  const { voiceFor } = await import("../../js/voice.js");
  const { page, doc } = await toCastle(nightSeed(TRAITOR));
  await voteAndReveal(doc);
  const said = listen(page);
  doc.getElementById("next-day").click();
  const ideas = [...doc.querySelectorAll("#traitor-ideas .idea")];
  const spoken = said.filter((s) => s.text.startsWith("Let's"));
  assert.eq(spoken.length, ideas.length, "one spoken line per idea");
  const fellows = page.game.players.filter((p) => p.side === TRAITOR && p.id !== "pepper" && p.inGame);
  spoken.forEach((s, i) => assert.near(s.pitch, voiceFor(fellows[i].id).pitch, 1e-6, "in their own voice"));
});

test("Round Table talk: people accuse and defend, then Sam joins in", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  doc.getElementById("to-table").click();
  await until(() => visible(doc, "screen-talk"), "after the walk, talk comes before the vote", 8000);
  await until(() => visible(doc, "talk-options"), "Sam's turn to speak", 8000);
  assert.gt(doc.querySelectorAll("#talk-lines .talk-line").length, 1, "people have spoken");
  const opts = doc.querySelectorAll("#talk-options .question");
  assert.ok(opts.length >= 3, "options to join in");
  opts[0].click();
  await until(() => visible(doc, "to-vote"), "then the vote");
  assert.ok([...doc.querySelectorAll("#talk-lines .talk-line b")].some((b) => b.textContent === "You: "), "Sam's line appears");
  doc.getElementById("to-vote").click();
  assert.ok(visible(doc, "screen-table"));
});

test("join two chatting Traitors as a Faithful: they send you away", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  const [a, b] = page.game.players.filter((p) => p.side === TRAITOR).map((p) => p.id);
  for (const [id, other] of [[a, b], [b, a]]) {
    Object.assign(page.world.people[id], { room: "hall", mode: "chat", timer: 99, with: other, x: id === a ? 0.4 : 0.5, y: 0.85 });
  }
  redraw(page);
  await until(() => doc.querySelector(`.puppet[data-id="${a}"]`), "they're in the hall");
  doc.querySelector(`.puppet[data-id="${a}"]`).click();
  assert.ok(visible(doc, "screen-join"), "Sam joins their chat");
  assert.eq(doc.querySelectorAll("#join-actions .join-chat").length, 0, "not welcome: nobody to chat to");
  assert.gt(doc.getElementById("join-text").textContent.length, 0);
  assert.eq(doc.querySelectorAll("#join-pictures img.cutout, #join-pictures .badge").length, 2, "both of them, cut out");
});

test("talking to someone shows their cut-out puppet", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  // Held still, already turned to Sam, so nobody else can start a chat with
  // him first (that would rightly open "join their chat" instead).
  Object.assign(page.world.people.puddle, { room: "hall", mode: "chat", with: "pepper", timer: 99, x: 0.3, y: 0.85 });
  redraw(page);
  await until(() => doc.querySelector('.puppet[data-id="puddle"]'), "Captain Puddle in the hall");
  doc.querySelector('.puppet[data-id="puddle"]').click();
  assert.ok(visible(doc, "screen-chat"));
  assert.ok(doc.querySelector("#chat-picture img.cutout"), "the cut-out, not the framed portrait");
});

test("a welcoming group: Sam can pick anyone in it to talk to", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  const { joinChat } = await import("../../js/castle.js");
  const faithful = page.game.players.filter((p) => p.side === FAITHFUL && p.id !== "pepper").map((p) => p.id);
  let pair = null;
  for (let i = 0; i < faithful.length - 1 && !pair; i++) {
    if (joinChat(page.game, faithful[i], faithful[i + 1]).welcome) pair = [faithful[i], faithful[i + 1]];
  }
  const [a, b] = pair;
  for (const [id, other, x] of [[a, b, 0.4], [b, a, 0.5]]) {
    Object.assign(page.world.people[id], { room: "hall", mode: "chat", timer: 99, with: other, x, y: 0.85 });
  }
  redraw(page);
  await until(() => doc.querySelector(`.name-tag[data-id="${a}"]`), "their name tags");
  doc.querySelector(`.name-tag[data-id="${b}"]`).click();
  assert.ok(visible(doc, "screen-join"));
  const buttons = [...doc.querySelectorAll("#join-actions .join-chat")].map((x) => x.dataset.id).sort();
  assert.eq(buttons, [a, b].sort(), "a button for each of them");
  doc.querySelector(`#join-actions .join-chat[data-id="${b}"]`).click();
  assert.ok(visible(doc, "screen-chat"));
  assert.eq(doc.getElementById("chat-name").textContent, (await import("../../js/characters.js")).CHARACTERS.find((c) => c.id === b).name);
});

test("name tags never overlap, even in a crowd", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  const ids = Object.keys(page.world.people).slice(0, 6);
  ids.forEach((id, i) => Object.assign(page.world.people[id], { room: "hall", mode: "chat", with: "pepper", timer: 99, x: 0.45 + i * 0.01, y: 0.85 }));
  redraw(page);
  await until(() => ids.every((id) => doc.querySelector(`.name-tag[data-id="${id}"]`)), "all six name tags");
  await new Promise((r) => setTimeout(r, 200));
  const rects = ids.map((id) => doc.querySelector(`.name-tag[data-id="${id}"]`).getBoundingClientRect());
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    assert.notOk(overlap, `${ids[i]} and ${ids[j]} overlap`);
  }
});

test("All aboard! plays the train ride before the castle", async () => {
  const page = await openPage(`../index.html?seed=1&fast=1`);
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "cards built");
  doc.getElementById("start").click();
  doc.querySelectorAll("#cards .card")[4].click();
  doc.getElementById("choose").click();
  doc.getElementById("to-castle").click();
  assert.ok(visible(doc, "screen-train"), "the train ride shows first");
  await until(() => visible(doc, "screen-castle"), "then the castle: no mission on day 1", 8000);
});

// Straight to one mission, through the debug menu.
async function toMission(id, seed = 3) {
  const page = await openPage(`../index.html?debug&seed=${seed}&fast=1`);
  const doc = page.document;
  await until(() => visible(doc, "debug"), "the Test a mission button");
  doc.getElementById("debug").click();
  doc.querySelector(`#debug-missions [data-mission="${id}"]`).click();
  assert.ok(visible(doc, "screen-mission"));
  return { page, doc };
}

test("Castle Bells: ring every tune back right and you win the shield", async () => {
  const { page, doc } = await toMission("bells");
  assert.ok(doc.getElementById("mission-name").textContent.includes("Castle Bells"));
  doc.getElementById("mission-go").click();
  const tune = bellTune(page.game);
  for (const length of [3, 4, 5, 6, 7]) {
    await until(() => doc.getElementById("bells").dataset.round === String(length)
      && doc.getElementById("mission-status").textContent === "Your turn!", `round of ${length}`, 8000);
    for (let k = 0; k < length; k++) doc.querySelector(`.bell[data-bell="${tune[k]}"]`).click();
  }
  await until(() => visible(doc, "mission-result"), "the result", 8000);
  assert.ok(doc.getElementById("mission-score").textContent.includes("perfectly"));
  assert.ok(doc.getElementById("mission-shield").textContent.includes("You win the shield"));
  assert.gt(page.game.pot, 0);
  assert.ok(doc.getElementById("mission-pot").textContent.includes("£"));
  doc.getElementById("mission-done").click();
  assert.ok(visible(doc, "screen-debug"), "back to the test menu");
});

test("Chilli Pie Shuffle: follow the chilli pie three times", async () => {
  const { page, doc } = await toMission("pies");
  assert.ok(doc.getElementById("mission-name").textContent.includes("Chilli Pie"));
  doc.getElementById("mission-go").click();
  for (let round = 0; round < 3; round++) {
    await until(() => doc.getElementById("pies").dataset.round === String(round)
      && doc.getElementById("mission-status").textContent === "Which one is the chilli pie?", `round ${round + 1}`, 8000);
    const { answer } = pieRound(page.game, round);
    const pies = [...doc.querySelectorAll(".pie")].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
    pies[answer].click();
  }
  await until(() => visible(doc, "mission-result"), "the result", 8000);
  assert.ok(doc.getElementById("mission-score").textContent.includes("3 times out of 3"));
  assert.ok(doc.getElementById("mission-shield").textContent.includes("You win the shield"));
});

test("each room has its own sound, and the Round Table has a crackling fire", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  await until(() => doc.body.dataset.roomSound === "hall", "the great hall's sound");
  page.world.me.room = "garden";
  await until(() => doc.body.dataset.roomSound === "garden", "the garden's sound");
  doc.getElementById("to-table").click();
  await until(() => doc.body.dataset.roomSound === "table", "the fire at the Round Table");
  await new Promise((r) => setTimeout(r, 300));
  assert.eq(doc.body.dataset.roomSound, "table", "and it stays on");
  await voteAndReveal(doc);
  assert.eq(doc.body.dataset.roomSound, "table", "through the vote and the reveal");
  if (!visible(doc, "after-reveal")) return;   // the game ended at the table
  doc.getElementById("next-day").click();
  await until(() => doc.body.dataset.roomSound === "", "quiet at night");
});

test("debug menu (?debug): play any mission on its own, then back to the list", async () => {
  const page = await openPage(`../index.html?debug&seed=3&fast=1`);
  const doc = page.document;
  await until(() => visible(doc, "debug"), "the Test a mission button");
  doc.getElementById("debug").click();
  const ids = [...doc.querySelectorAll("#debug-missions .question")].map((b) => b.dataset.mission);
  assert.eq(ids.length, 13, "all 13 missions");
  for (const id of ids) {
    doc.querySelector(`#debug-missions [data-mission="${id}"]`).click();
    assert.ok(visible(doc, "screen-mission"));
    const name = doc.getElementById("mission-name").textContent;
    assert.ok(name.includes(MISSIONS.find((m) => m.id === id).name), name);
    // Give up at once, then back to the list.
    doc.getElementById("mission-go").click();
    page.missionGiveUp();
    assert.eq(doc.getElementById("mission-done").textContent, "Back to the missions");
    doc.getElementById("mission-done").click();
    assert.ok(visible(doc, "screen-debug"), "back to the list");
  }
});

test("no debug button without ?debug", async () => {
  const page = await openPage(`../index.html?fast=1`);
  await until(() => page.document.querySelectorAll(".card").length === 22, "cards built");
  assert.notOk(visible(page.document, "debug"));
});

test("a quiet night: the Traitors only plot, and everyone comes to breakfast", async () => {
  for (const side of [FAITHFUL, TRAITOR]) {
    // Day 1 must leave 3 Traitors, so tonight isn't a recruiting night.
    let seed = 0;
    for (let s = 1; s <= 5000 && !seed; s++) {
      if (newGame("pepper", s).playerSide !== side) continue;
      const g = arriveAtCastle(newGame("pepper", s));
      sayFirst(g);
      roundTable(g, "puddle");
      if (!winner(g) && stillIn(g).includes("pepper") && stillIn(g).filter((id) => isTraitor(g, id)).length === 3) seed = s;
    }
    assert.gt(seed, 0, "found a game");
    const { page, doc } = await toCastle(seed);
    await voteAndReveal(doc);
    // Pretend nights 1 and 2 have happened: tonight is night 3, a quiet one.
    page.game.history.unshift({ quiet: true }, { quiet: true });
    doc.getElementById("next-day").click();
    await until(() => visible(doc, "to-breakfast"), "the quiet night", 8000);
    assert.notOk(visible(doc, "letter"), "no letter");
    assert.ok(visible(doc, "screen-night"), `${side}: the night screen, not the Traitors' meeting`);
    const before = stillIn(page.game).length;
    doc.getElementById("to-breakfast").click();
    await until(() => visible(doc, "start-day"), "breakfast", 8000);
    assert.ok(doc.getElementById("missing").textContent.includes("Nobody was murdered"));
    assert.eq(stillIn(page.game).length, before, "nobody murdered");
  }
});

test("everyone walks to the Round Table in slow motion, to drums", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  doc.getElementById("to-table").click();
  assert.ok(visible(doc, "screen-walk"), "the walk comes first");
  const walkers = [...doc.querySelectorAll("#walk-line [data-id]")].map((e) => e.dataset.id).sort();
  assert.eq(walkers, stillIn(page.game).sort(), "everyone still in, Sam too");
  await until(() => visible(doc, "screen-talk"), "then the talk", 8000);
});

// Fire one stone at `id`, aiming where it will be when the stone lands.
async function fireAt(page, doc, id) {
  const field = doc.querySelector(".gallery-field");
  const t = doc.querySelector(`.flyer[data-id="${id}"]`).dataset;
  const aim = { x: +t.x + +t.vx * FLIGHT, y: +t.y + +t.vy * FLIGHT };
  const pull = { x: (SLING.x - aim.x) / SLING_POWER, y: (SLING.y - aim.y) / SLING_POWER };
  const r = field.getBoundingClientRect();
  const at = (x, y) => ({ bubbles: true, pointerId: 1, clientX: r.left + x * r.width, clientY: r.top + y * r.height });
  const before = doc.querySelector(".stones").textContent;
  field.dispatchEvent(new page.PointerEvent("pointerdown", at(SLING.x, SLING.y)));
  field.dispatchEvent(new page.PointerEvent("pointermove", at(SLING.x + pull.x, SLING.y + pull.y)));
  field.dispatchEvent(new page.PointerEvent("pointerup", at(SLING.x + pull.x, SLING.y + pull.y)));
  await until(() => doc.querySelector(".stones").textContent !== before || visible(doc, "mission-result"), "the stone lands", 8000);
}
// A target well away from the edges, so it won't bounce mid-flight.
const easyTarget = (doc, want) => [...doc.querySelectorAll(".flyer:not(.hit)")].find((f) => {
  const d = f.dataset;
  const x = +d.x + +d.vx * FLIGHT, y = +d.y + +d.vy * FLIGHT;
  return want(f.dataset.id) && x > 0.2 && x < 0.8 && y > 0.2 && y < 0.6;
});

test("Catapults: pull back, let go, and hit someone flying round; they're up for murder", async () => {
  const { page, doc } = await toMission("catapults");
  doc.getElementById("mission-go").click();
  let hit = null;
  for (let k = 0; k < 5 && !hit; k++) {
    await until(() => easyTarget(doc, (id) => id !== "shield"), "a target in reach", 8000);
    const id = easyTarget(doc, (x) => x !== "shield").dataset.id;
    await fireAt(page, doc, id);
    if (doc.querySelector(`.flyer.hit[data-id="${id}"]`)) hit = id;
  }
  assert.ok(hit, "one of five aimed stones hits");
  // Barely pulling doesn't throw.
  const field = doc.querySelector(".gallery-field");
  if (!visible(doc, "mission-result")) {
    const before = doc.querySelector(".stones").textContent;
    const r = field.getBoundingClientRect();
    const at = { bubbles: true, pointerId: 1, clientX: r.left + SLING.x * r.width, clientY: r.top + SLING.y * r.height };
    field.dispatchEvent(new page.PointerEvent("pointerdown", at));
    field.dispatchEvent(new page.PointerEvent("pointerup", at));
    assert.eq(doc.querySelector(".stones").textContent, before, "no stone used");
  }
  while (!visible(doc, "mission-result")) {
    const t = easyTarget(doc, () => true) ?? doc.querySelector(".flyer:not(.hit)");
    await fireAt(page, doc, t.dataset.id);
  }
  await result(doc);
  assert.ok(page.game.upForMurder.ids.includes(hit), "up for murder");
  assert.ok(doc.getElementById("mission-extra").textContent.startsWith("Up for murder tonight"));
});

test("Catapults: hit the shield and it breaks", async () => {
  const { page, doc } = await toMission("catapults");
  doc.getElementById("mission-go").click();
  for (let k = 0; k < 5 && !doc.querySelector('.flyer.hit[data-id="shield"]'); k++) {
    await until(() => easyTarget(doc, (id) => id === "shield"), "the shield in reach", 15000);
    await fireAt(page, doc, "shield");
  }
  while (!visible(doc, "mission-result")) await fireAt(page, doc, doc.querySelector(".flyer:not(.hit)").dataset.id);
  await result(doc);
  assert.eq(page.game.shield, null);
  assert.ok(doc.getElementById("mission-shield").textContent.includes("broken"));
});

test("Cooking: cook their hated food and find the shield", async () => {
  const { page, doc } = await toMission("cooking");
  doc.getElementById("mission-go").click();
  const diner = cookingDiner(page.game, stillIn(page.game));
  assert.ok(doc.getElementById("diner-clue").textContent.includes(HATES[diner][1]), "the clue shows");
  assert.ok(doc.getElementById("serve").disabled, "can't serve an empty plate");
  const hated = HATES[diner][0];
  const menu = truckFoods(page.game, diner);
  assert.eq([...doc.querySelectorAll(".food")].map((f) => f.dataset.food), menu.flat(), "today's menu");
  for (const foods of menu) doc.querySelector(`.food[data-food="${foods.includes(hated) ? hated : foods[0]}"]`).click();
  doc.querySelector(`.box[data-box="${shieldTruck(page.game)}"]`).click();
  assert.notOk(doc.getElementById("serve").disabled);
  doc.getElementById("serve").click();
  await until(() => visible(doc, "mission-result"), "the result", 8000);
  assert.ok(doc.getElementById("mission-score").textContent.includes("least favourite"));
  assert.ok(doc.getElementById("mission-shield").textContent.includes("You found the shield"));
  assert.eq(page.game.shield, "pepper");
});

// ─── The other nine missions, played well ───────────────────────────────────

async function playMission(id) {
  const { page, doc } = await toMission(id);
  doc.getElementById("mission-go").click();
  return { page, doc, box: doc.querySelector("#mission-play .mission-box") };
}
const result = async (doc) => {
  await until(() => visible(doc, "mission-result"), "the result", 15000);
  return doc.getElementById("mission-score").textContent;
};

test("Who Was Where?: answer all three right", async () => {
  const { page, doc, box } = await playMission("where");
  const { questions } = whereRounds(page.game, stillIn(page.game));
  for (const [i, q] of questions.entries()) {
    await until(() => box.dataset.question === String(i) && box.querySelector(".where-option"), `question ${i + 1}`, 8000);
    box.querySelector(`.where-option[data-id="${q.answer}"]`).click();
  }
  assert.eq(await result(doc), "You got 3 out of 3 right!");
});

test("Letter Jumble: spell all three names", async () => {
  const { page, doc, box } = await playMission("jumble");
  for (const [i, w] of jumbleWords(page.game, stillIn(page.game)).entries()) {
    await until(() => box.dataset.word === String(i) && box.querySelector(".jumble-tile"), `word ${i + 1}`, 8000);
    for (const letter of w.word) box.querySelector(`.jumble-tile[data-letter="${letter}"]:not(:disabled)`).click();
  }
  assert.eq(await result(doc), "You spelled 3 out of 3 names!");
});

test("Secret Code: crack all three words", async () => {
  const { page, doc, box } = await playMission("code");
  for (const [i, word] of secretCode(page.game).words.entries()) {
    await until(() => box.dataset.word === String(i) && box.querySelector(".code-button"), `word ${i + 1}`, 8000);
    for (const letter of word) box.querySelector(`.code-button[data-letter="${letter}"]`).click();
  }
  assert.eq(await result(doc), "You cracked 3 out of 3 secret words!");
});

test("Garden Maze: steer out with the joystick", async () => {
  const { page, doc, box } = await playMission("maze");
  const m = makeMaze(page.game);
  const key = ([x, y]) => `${x},${y}`;
  const from = new Map([[key(m.start), null]]);
  const queue = [m.start];
  while (queue.length) {
    const at = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [at[0] + dx, at[1] + dy];
      if (n[0] < 0 || n[1] < 0 || n[0] >= MAZE_W || n[1] >= MAZE_H || from.has(key(n)) || !canStep(m, at, n)) continue;
      from.set(key(n), at);
      queue.push(n);
    }
  }
  const path = [];
  for (let at = m.exit; at; at = from.get(key(at))) path.unshift(at);
  await until(() => box.querySelector(".joystick"), "the joystick");
  const stick = box.querySelector(".joystick");
  const r = stick.getBoundingClientRect();
  const push = (type, x, y) => stick.dispatchEvent(new page.PointerEvent(type, {
    bubbles: true, pointerId: 1, clientX: r.left + r.width / 2 + x * r.width / 2, clientY: r.top + r.height / 2 + y * r.height / 2,
  }));
  push("pointerdown", 0, 0);
  const pos = () => box.dataset.pos.split(",").map(Number);
  // Steer to the middle of each square in turn.
  for (const [x, y] of path.slice(1)) {
    await until(() => {
      if (visible(doc, "mission-result")) return true;
      const [px, py] = pos();
      const dx = x + 0.5 - px, dy = y + 0.5 - py;
      if (Math.hypot(dx, dy) < 0.08) return true;
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      push("pointermove", Math.abs(dx) > 0.04 ? Math.sign(dx) * Math.min(1, len * 4) : 0, Math.abs(dy) > 0.04 ? Math.sign(dy) * Math.min(1, len * 4) : 0);
      return false;
    }, `square ${x},${y}`, 8000);
    if (visible(doc, "mission-result")) break;
  }
  push("pointerup", 0, 0);
  assert.eq(await result(doc), "You found the way out!");
});

test("Lost Keys: look behind the right things and find all five", async () => {
  const { page, doc, box } = await playMission("keys");
  const h = keyHides(page.game);
  await until(() => box.querySelectorAll(".hide").length === 14, "the hiding places");
  const empty = [...Array(14).keys()].find((i) => !h.keys.includes(i));
  box.querySelector(`.hide[data-place="${empty}"]`).click();
  assert.ok(doc.getElementById("mission-status").textContent.startsWith("Nothing"), "nothing behind that one");
  for (const k of h.keys) box.querySelector(`.hide[data-place="${k}"]`).click();
  assert.eq(await result(doc), "You found all 5 keys!");
});

test("Lost Keys: run out of looks", async () => {
  const { page, doc, box } = await playMission("keys");
  const h = keyHides(page.game);
  await until(() => box.querySelectorAll(".hide").length === 14, "the hiding places");
  const empties = [...Array(14).keys()].filter((i) => !h.keys.includes(i));
  for (const i of empties.slice(0, 9)) box.querySelector(`.hide[data-place="${i}"]`).click();
  assert.eq(await result(doc), "Out of looks! You found 0 out of 5 keys.");
});


test("Muddy Footprints: tap every boot print, never a fox or duck", async () => {
  const { doc, box } = await playMission("footprints");
  await until(() => {
    for (const p of box.querySelectorAll('.print[data-kind="boot"]:not(:disabled)')) p.click();
    return visible(doc, "mission-result");
  }, "the trail ends", 20000);
  assert.ok((await result(doc)).includes("You followed the trail"));
});

test("Muddy Footprints: tapping a fox print costs you", async () => {
  const { doc, box } = await playMission("footprints");
  await until(() => box.querySelector('.print[data-kind="fox"], .print[data-kind="duck"]'), "an animal print", 20000);
  box.querySelector('.print[data-kind="fox"], .print[data-kind="duck"]').click();
  assert.ok(doc.getElementById("mission-status").textContent.startsWith("Oops!"));
});


test("Portrait Gallery: spot every new picture", async () => {
  const { page, doc, box } = await playMission("portraits");
  for (const [i, round] of galleryRounds(page.game).entries()) {
    await until(() => box.dataset.round === String(i) && box.querySelector(".gallery-pick"), `round ${i + 1}`, 8000);
    box.querySelector(`.gallery-pick[data-id="${round.newcomer}"]`).click();
  }
  assert.eq(await result(doc), "You spotted 3 out of 3 new pictures!");
});

test("Treasure Hunt: wrong room, then warmer, then gold", async () => {
  const { page, doc, box } = await playMission("treasure");
  const spot = treasureSpot(page.game);
  await until(() => box.querySelector(".treasure-room"), "the castle rooms");
  const room = box.querySelector(".treasure-room");
  const tapAt = (x, y) => {
    const r = room.getBoundingClientRect();
    room.dispatchEvent(new page.MouseEvent("click", { bubbles: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height }));
  };
  const other = ["kitchen", "hall", "library", "garden"].find((r) => r !== spot.room);
  box.querySelector(`.treasure-tabs [data-room="${other}"]`).click();
  tapAt(0.5, 0.5);
  assert.ok(doc.getElementById("mission-status").textContent.startsWith("Not in this room"));
  box.querySelector(`.treasure-tabs [data-room="${spot.room}"]`).click();
  tapAt(spot.x, spot.y);
  assert.eq(await result(doc), "You found the gold in 2 taps!");
});

test("Lights Out: put all nine pieces back", async () => {
  const { doc, box } = await playMission("lights");
  await until(() => box.dataset.ready === "yes", "the pieces", 8000);
  // Put pieces 0 and 1 the wrong way round, then the rest right.
  const put = (piece, slot) => {
    box.querySelector(`.lights-tray [data-piece="${piece}"]`).click();
    box.querySelector(`.slot[data-slot="${slot}"]`).click();
  };
  put(0, 1);
  put(1, 0);
  for (let i = 2; i < 9; i++) put(i, i);
  assert.notOk(visible(doc, "mission-result"), "nothing ends until you say");
  // Swap the two placed pieces round.
  box.querySelector('.slot[data-slot="0"]').click();
  box.querySelector('.slot[data-slot="1"]').click();
  box.querySelector("#lights-done").click();
  assert.eq(await result(doc), "You built the whole shield in the dark!");
});

test("staying quiet at the Round Table: someone notices", async () => {
  const { doc } = await toCastle(seedFor("pepper", FAITHFUL));
  doc.getElementById("to-table").click();
  await until(() => visible(doc, "talk-options"), "Sam's turn to speak", 8000);
  const before = doc.querySelectorAll("#talk-lines .talk-line").length;
  doc.querySelector("#talk-options .question:last-child").click();
  await until(() => visible(doc, "to-vote"), "then the vote");
  const lines = doc.querySelectorAll("#talk-lines .talk-line");
  assert.eq(lines.length, before + 1, "one reply, no line from Sam");
  assert.ok(lines[lines.length - 1].textContent.includes("Chef Pepper"), "they say Sam's name");
});

test("your own character is marked: the walk, your chalkboard, the reveal list", async () => {
  const { doc } = await toCastle(seedFor("pepper", FAITHFUL));
  assert.ok(doc.querySelector('.puppet.me'), "your puppet glows in the castle");
  doc.getElementById("to-table").click();
  assert.ok(doc.querySelector('#walk-line .me-cutout[data-id="pepper"]'), "you glow in the walk");
  assert.eq(doc.querySelectorAll("#walk-line .me-cutout").length, 1, "only you");
  await talkThenTable(doc);
  doc.querySelector("#table-cards .card").click();
  doc.getElementById("cast-vote").click();
  await until(() => doc.querySelector(".chalkboard.me-board"), "your chalkboard", 20000);
  assert.ok(doc.querySelector(".chalkboard.me-board").textContent.includes("You"));
});

test("pause: shows everyone, and closes again", async () => {
  const { doc } = await toCastle(seedFor("pepper", FAITHFUL));
  assert.ok(visible(doc, "pause"));
  doc.getElementById("pause").click();
  assert.ok(visible(doc, "overview"));
  assert.eq(doc.querySelectorAll("#overview-people .who").length, 22);
  assert.ok(doc.querySelector('.who.who-you[data-id="pepper"]'));
  doc.getElementById("overview-close").click();
  assert.notOk(visible(doc, "overview"));
});
