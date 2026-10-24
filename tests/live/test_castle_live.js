// A day at the castle on the real page: chat, vote with chalkboards, reveal.
import { test, assert, openPage, until } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL } from "../../js/game.js";
import { arriveAtCastle, roundTable, night, winner, stillIn } from "../../js/castle.js";

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
  return { page, doc };
}
const visible = (doc, id) => !doc.getElementById(id).hidden;

test("the train takes you to the castle: everyone else is walking round its rooms", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  assert.ok(visible(doc, "screen-castle"));
  assert.eq(doc.getElementById("castle-day").textContent, "Day 1 at the castle");
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

test("chat: tap someone, ask all four questions, they answer", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  await until(() => doc.querySelector(".puppet:not(.me)"), "someone to chat to");
  doc.querySelector(".puppet:not(.me)").click();
  assert.ok(visible(doc, "screen-chat"));
  const buttons = doc.querySelectorAll("#questions .question");
  assert.eq(buttons.length, 4);
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
    roundTable(g, "puddle");
    if (winner(g) || !stillIn(g).includes("pepper")) continue;
    if (side === TRAITOR || want(night(g))) return seed;
  }
  throw new Error("no seed found");
}

async function talkThenTable(doc) {
  doc.getElementById("to-table").click();
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
  const murdered = page.game.history[0].murdered;
  assert.ok(doc.getElementById("missing").textContent.includes("never came to breakfast"));
  assert.eq(doc.querySelectorAll("#arrivals .arrival-person").length, 20, "20 came to breakfast");
  assert.ok(doc.getElementById("crossout").hidden, "the crossed-out panel has made way for everyone");
  assert.eq(doc.querySelectorAll("#gone .arrival-person").length, 22, "everyone on the list");
  const gone = [...doc.querySelectorAll("#gone .gone-person")].map((g) => g.dataset.id).sort();
  assert.eq(gone, [out.banished, murdered].sort(), "the banished and the murdered, greyed out with a red X");
  doc.getElementById("start-day").click();
  assert.eq(doc.getElementById("castle-day").textContent, "Day 2 at the castle");
  await until(() => doc.querySelector(".puppet.me"), "back in the castle");
  for (const gone of [out.banished, murdered]) {
    assert.notOk(doc.querySelector(`.puppet[data-id="${gone}"]`), `${gone} has gone from the castle`);
  }
});

test("a Faithful who is murdered gets the letter", async () => {
  const { doc } = await toCastle(nightSeed(FAITHFUL, (v) => v === "pepper"));
  await voteAndReveal(doc);
  doc.getElementById("next-day").click();
  await until(() => visible(doc, "letter"), "the letter", 8000);
  assert.ok(doc.getElementById("letter").textContent.includes("By order of the Traitors"));
  assert.ok(doc.getElementById("letter").textContent.includes("you have been murdered"));
  assert.ok(visible(doc, "night-over"), "Play again");
  assert.notOk(visible(doc, "to-breakfast"), "no breakfast for you");
});

test("a Traitor goes to the secret meeting and picks who is murdered", async () => {
  const { page, doc } = await toCastle(nightSeed(TRAITOR));
  await voteAndReveal(doc);
  doc.getElementById("next-day").click();
  assert.ok(visible(doc, "screen-traitors"), "the secret meeting");
  assert.gt(doc.querySelectorAll("#traitor-ideas .idea").length, 0, "the others give ideas");
  assert.ok(doc.getElementById("murder").disabled, "pick first");
  const pick = doc.querySelectorAll("#victim-cards .card")[2];
  pick.click();
  doc.getElementById("murder").click();
  await until(() => visible(doc, "start-day") || visible(doc, "breakfast-over"), "breakfast", 8000);
  assert.eq(page.game.history[0].murdered, pick.dataset.id, "Sam's pick was murdered");
  for (const id of [...doc.querySelectorAll("#victim-cards .card")].map((c) => c.dataset.id)) {
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
  assert.eq(lines.length, 4, "four answers, four spoken lines");
  for (const l of lines) {
    assert.near(l.pitch, voiceFor(id).pitch, 1e-6, "same voice every line");
    assert.near(l.rate, voiceFor(id).rate, 1e-6);
  }
  assert.eq(lines[3].text, doc.getElementById("bubble-text").textContent, "it says what the bubble says");
});

test("at the secret meeting, each Traitor says their idea out loud", async () => {
  const { voiceFor } = await import("../../js/voice.js");
  const { page, doc } = await toCastle(nightSeed(TRAITOR));
  await voteAndReveal(doc);
  const said = listen(page);
  doc.getElementById("next-day").click();
  const ideas = [...doc.querySelectorAll("#traitor-ideas .idea")];
  const spoken = said.filter((s) => s.text.startsWith("Let's pick"));
  assert.eq(spoken.length, ideas.length, "one spoken line per idea");
  const fellows = page.game.players.filter((p) => p.side === TRAITOR && p.id !== "pepper" && p.inGame);
  spoken.forEach((s, i) => assert.near(s.pitch, voiceFor(fellows[i].id).pitch, 1e-6, "in their own voice"));
});

test("Round Table talk: people accuse and defend, then Sam joins in", async () => {
  const { page, doc } = await toCastle(seedFor("pepper", FAITHFUL));
  doc.getElementById("to-table").click();
  assert.ok(visible(doc, "screen-talk"), "talk comes before the vote");
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
