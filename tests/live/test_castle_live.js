// A day at the castle on the real page: chat, vote with chalkboards, reveal.
import { test, assert, openPage, until } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL } from "../../js/game.js";
import {
  arriveAtCastle, roundTable, night, winner, stillIn, recruit, tableTalk, talkOptions, playerSays,
  nightKind, isTraitor,
} from "../../js/castle.js";
import { finishMission, todaysMission, bellTune, pieRound } from "../../js/missions.js";

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
  await until(() => !doc.getElementById("screen-mission").hidden, "the train ride arrives at the mission", 8000);
  await flopMission(page, doc);
  return { page, doc };
}

// Do today's mission badly on purpose (score 0, so Sam never wins the
// shield and rehearsals can use finishMission(g, 0, ...)), then go to the
// castle.
async function flopMission(page, doc) {
  const status = () => doc.getElementById("mission-status").textContent;
  const m = todaysMission(page.game);
  doc.getElementById("mission-go").click();
  let round = 0;
  await until(() => {
    if (!doc.getElementById("mission-result").hidden) return true;
    if (m.id === "bells" && status() === "Your turn!" && !doc.getElementById("bells").dataset.flopped) {
      doc.getElementById("bells").dataset.flopped = "yes";
      const wrong = (bellTune(page.game)[0] + 1) % 4;
      doc.querySelector(`.bell[data-bell="${wrong}"]`).click();
    }
    const pieBox = doc.getElementById("pies");
    if (m.id === "pies" && status() === "Which one is the chilli pie?" && pieBox.dataset.round === String(round)) {
      const { answer } = pieRound(page.game, round++);
      const pies = [...doc.querySelectorAll(".pie")].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
      pies[(answer + 1) % 3].click();
    }
    return false;
  }, "the mission ends", 15000);
  doc.getElementById("mission-done").click();
  await until(() => !doc.getElementById("screen-castle").hidden, "on to the castle");
}
const visible = (doc, id) => !doc.getElementById(id).hidden;

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
  await until(() => doc.querySelector(".puppet:not(.me)"), "someone to chat to");
  doc.querySelector(".puppet:not(.me)").click();
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
  await until(() => visible(doc, "letter"), "the letter", 8000);
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
    finishMission(g, 0, stillIn(g));
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
  await until(() => visible(doc, "letter"), "the letter", 8000);
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
  await until(() => doc.querySelector(".puppet:not(.me)"), "someone to chat to");
  const cardEl = doc.querySelector(".puppet:not(.me)");
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
  assert.eq(doc.querySelector("#talk-lines .talk-line:last-child b").textContent, "You: ", "Sam's line appears");
  assert.ok(visible(doc, "to-vote"));
  doc.getElementById("to-vote").click();
  assert.ok(visible(doc, "screen-table"));
});

test("join two chatting Traitors as a Faithful: they send you away", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  const [a, b] = page.game.players.filter((p) => p.side === TRAITOR).map((p) => p.id);
  for (const [id, other] of [[a, b], [b, a]]) {
    Object.assign(page.world.people[id], { room: "hall", mode: "chat", timer: 99, with: other, x: id === a ? 0.4 : 0.5, y: 0.85 });
  }
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
  await until(() => visible(doc, "screen-mission"), "then the day's mission", 8000);
  await flopMission(page, doc);
  assert.ok(visible(doc, "screen-castle"), "then the castle");
});

// Find a seed whose day-1 mission is `id`.
function missionSeed(id) {
  for (let seed = 1; seed <= 1000; seed++) {
    const g = arriveAtCastle(newGame("pepper", seed));
    if (todaysMission(g).id === id) return seed;
  }
  throw new Error(`no seed starts with ${id}`);
}

async function toMission(seed) {
  const page = await openPage(`../index.html?seed=${seed}&fast=1`);
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "cards built");
  doc.getElementById("start").click();
  doc.querySelectorAll("#cards .card")[4].click();
  doc.getElementById("choose").click();
  doc.getElementById("to-castle").click();
  await until(() => visible(doc, "screen-mission"), "the mission", 8000);
  return { page, doc };
}

test("Castle Bells: ring every tune back right and you win the shield", async () => {
  const { page, doc } = await toMission(missionSeed("bells"));
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
  assert.ok(visible(doc, "screen-castle"));
});

test("Chilli Pie Shuffle: follow the chilli pie three times", async () => {
  const { page, doc } = await toMission(missionSeed("pies"));
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
  assert.eq([...ids].sort(), ["bells", "pies"]);
  for (const id of ids) {
    doc.querySelector(`#debug-missions [data-mission="${id}"]`).click();
    assert.ok(visible(doc, "screen-mission"));
    const name = doc.getElementById("mission-name").textContent;
    assert.ok(name.includes(id === "bells" ? "Castle Bells" : "Chilli Pie"), name);
    // Do it badly, then back to the list.
    doc.getElementById("mission-go").click();
    let round = 0;
    await until(() => {
      if (visible(doc, "mission-result")) return true;
      const status = doc.getElementById("mission-status").textContent;
      if (id === "bells" && status === "Your turn!" && !doc.getElementById("bells").dataset.flopped) {
        doc.getElementById("bells").dataset.flopped = "yes";
        doc.querySelector(`.bell[data-bell="${(bellTune(page.game)[0] + 1) % 4}"]`).click();
      }
      if (id === "pies" && status === "Which one is the chilli pie?" && doc.getElementById("pies").dataset.round === String(round)) {
        const { answer } = pieRound(page.game, round++);
        const pies = [...doc.querySelectorAll(".pie")].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
        pies[(answer + 1) % 3].click();
      }
      return false;
    }, `${id} ends`, 15000);
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
