// Multiplayer start screens (Phase 8): host, join with the symbol code,
// the lobby. The test page plays the other device, through the same local
// room storage the page uses.
import { test, assert, openPage, until } from "../framework.js";
import { localNet } from "../../js/net.js";
import { pack, unpack } from "../../js/net-engine.js";
import { newRoom, join, pick, codeName } from "../../js/lobby.js";

const visible = (doc, id) => !doc.getElementById(id).hidden;
const other = () => ({ ...localNet(), uid: "other-device" });

async function toMulti() {
  const page = await openPage("../index.html?fast=1");
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "cards built");
  doc.getElementById("start").click();
  assert.ok(visible(doc, "screen-mode"), "single or multiplayer?");
  assert.ok(doc.querySelector("#mode-single svg") && doc.querySelector("#mode-multi svg"), "icons on the buttons");
  doc.getElementById("mode-multi").click();
  return { page, doc };
}

test("host: get a code, someone joins, everyone picks, start", async () => {
  const { page, doc } = await toMulti();
  doc.getElementById("multi-host").click();
  await until(() => visible(doc, "screen-lobby"), "the lobby");
  await until(() => doc.querySelectorAll("#lobby-code .code-slot .symbol-icon").length === 4, "the code");
  assert.eq(doc.querySelectorAll("#lobby-code .code-slot .symbol-icon").length, 4, "a 4-symbol code");
  const name = page.multiplayer.room;
  const net = other();
  net.updateRoom(name, (r) => join(r, net.uid, Date.now()).room);
  await until(() => doc.querySelectorAll("#lobby-players .who").length === 2, "the other player appears");
  net.updateRoom(name, (r) => pick(r, net.uid, "puddle").room);
  await until(() => doc.querySelector('#lobby-cards .card[data-id="puddle"]').disabled, "Puddle is taken");
  assert.ok(doc.getElementById("lobby-start").disabled, "can't start until you pick");
  doc.querySelector('#lobby-cards .card[data-id="pepper"]').click();
  await until(() => !doc.getElementById("lobby-start").disabled, "everyone has picked");
  doc.getElementById("lobby-start").click();
  await until(() => visible(doc, "screen-ready"), "the game starts: you find out your side");
  const room = await net.readRoom(name);
  assert.ok(room.started, "the other device sees it start");
  assert.eq(room.play.humans.sort(), ["pepper", "puddle"], "both real players are in the game");
  assert.eq(page.game.humans.sort(), ["pepper", "puddle"]);
});

// The other device, played by the test: whenever the host's device asks
// for decision k, it answers decision k too (simply).
function bot(net, name, me) {
  let done = -1;
  const stop = net.watchRoom(name, (room) => {
    if (!room?.play) return;
    const act = room.seats[room.host]?.act;
    if (!act || act.k <= done) return;
    done = act.k;
    const others = room.play.humans.filter((h) => h !== me);
    const data = {
      go: true,
      says: { kind: "quiet", target: null, text: "Say nothing." },
      votes: others[0],
      night: null,
      mission: { mission: unpack(act.data)?.mission, score: 0.5, hits: [null, "shield", null] },
      final: { vote: "end", line: "End it!" },
    }[act.t];
    net.setAct(name, net.uid, { k: act.k, t: act.t, data: pack(data) });
  });
  return stop;
}

test("two real players play a whole day together", async () => {
  const { page, doc } = await toMulti();
  doc.getElementById("multi-host").click();
  await until(() => visible(doc, "screen-lobby"), "the lobby");
  const name = page.multiplayer.room;
  const net = other();
  net.updateRoom(name, (r) => join(r, net.uid, Date.now()).room);
  net.updateRoom(name, (r) => pick(r, net.uid, "puddle").room);
  await until(() => doc.querySelector('#lobby-cards .card[data-id="pepper"]'), "cards");
  doc.querySelector('#lobby-cards .card[data-id="pepper"]').click();
  await until(() => !doc.getElementById("lobby-start").disabled, "ready to start");
  const stopBot = bot(net, name, "puddle");
  doc.getElementById("lobby-start").click();
  await until(() => visible(doc, "screen-ready"), "your side");
  doc.getElementById("to-castle").click();
  await until(() => visible(doc, "screen-castle"), "the castle", 8000);
  doc.getElementById("to-table").click();
  await until(() => visible(doc, "talk-options"), "the talk (after both are ready)", 15000);
  doc.querySelector("#talk-options .question").click();
  await until(() => visible(doc, "to-vote"), "both have spoken", 10000);
  doc.getElementById("to-vote").click();
  doc.querySelector("#table-cards .card").click();
  doc.getElementById("cast-vote").click();
  await until(() => visible(doc, "to-reveal"), "the chalkboards", 20000);
  const voter = [...doc.querySelectorAll(".board-voter")].find((b) => b.textContent.startsWith("Captain Puddle"));
  assert.ok(voter, "Captain Puddle's chalkboard is there");
  doc.getElementById("to-reveal").click();
  await until(() => visible(doc, "after-reveal") || visible(doc, "game-over"), "the reveal", 10000);
  if (visible(doc, "after-reveal")) {
    doc.getElementById("next-day").click();
    // The night: a Traitor host picks; a Faithful host waits.
    await until(() => visible(doc, "screen-traitors") || visible(doc, "to-breakfast") || visible(doc, "night-over")
      || visible(doc, "envelope"), "the night", 10000);
    if (visible(doc, "screen-traitors")) {
      doc.querySelector("#victim-cards .card").click();
      doc.getElementById("murder").click();
    } else if (visible(doc, "envelope")) {
      doc.getElementById("envelope").click();
      await until(() => visible(doc, "to-breakfast"), "after the letter", 8000);
      doc.getElementById("to-breakfast").click();
    } else if (visible(doc, "to-breakfast")) {
      doc.getElementById("to-breakfast").click();
    }
    await until(() => visible(doc, "start-day") || visible(doc, "breakfast-over"), "breakfast", 10000);
    doc.getElementById("start-day").click();
    await until(() => visible(doc, "screen-mission"), "day 2's mission, after both are ready", 10000);
    doc.getElementById("mission-go").click();
    page.missionGiveUp();
    await until(() => visible(doc, "mission-result"), "the mission result, once both have finished", 10000);
    assert.eq(page.game.day, 2);
    // The leaderboard: the top 5, plus you and the other real player (blue).
    const rows = [...doc.querySelectorAll("#mission-leaders .leader")];
    assert.gt(rows.length, 4, "a leaderboard");
    assert.eq(rows.filter((r) => r.classList.contains("leader-you")).length, 1, "you're on it");
    // (unless they were banished or murdered on day 1: the deal is random)
    const puddleIn = page.game.players.find((p) => p.id === "puddle").inGame;
    assert.eq(rows.filter((r) => r.classList.contains("leader-player")).length, puddleIn ? 1 : 0, "the other real player too");
  }
  const room = await net.readRoom(name);
  assert.gt(Object.keys(room.log).length, 5, "decisions in the shared log");
  stopBot();
});

test("join: tap the host's four symbols", async () => {
  const net = other();
  const code = ["moon", "key", "bell", "dagger"];
  net.updateRoom(codeName(code), () => newRoom(code, net.uid, 1));
  const { doc } = await toMulti();
  doc.getElementById("multi-join").click();
  // A wrong code first.
  for (const s of ["sun", "sun", "sun", "sun"]) doc.querySelector(`.symbol-button[data-symbol="${s}"]`).click();
  doc.getElementById("mp-join-go").click();
  await until(() => visible(doc, "mp-join-error"), "no game with that code");
  doc.getElementById("mp-join-clear").click();
  for (const s of code) doc.querySelector(`.symbol-button[data-symbol="${s}"]`).click();
  assert.eq(doc.querySelectorAll("#mp-join-slots .symbol-icon").length, 4);
  doc.getElementById("mp-join-go").click();
  await until(() => visible(doc, "screen-lobby"), "in the lobby");
  assert.eq(Object.keys((await net.readRoom(codeName(code))).seats).length, 2, "the host sees them join");
  assert.notOk(visible(doc, "lobby-start"), "only the host can start");
});

test("waiting for someone: the sign says who, and the host can stop waiting", async () => {
  const { page, doc } = await toMulti();
  doc.getElementById("multi-host").click();
  await until(() => visible(doc, "screen-lobby"), "the lobby");
  const name = page.multiplayer.room;
  const net = other();
  net.updateRoom(name, (r) => join(r, net.uid, Date.now()).room);
  net.updateRoom(name, (r) => pick(r, net.uid, "puddle").room);
  await until(() => doc.querySelector('#lobby-cards .card[data-id="pepper"]'), "cards");
  doc.querySelector('#lobby-cards .card[data-id="pepper"]').click();
  await until(() => !doc.getElementById("lobby-start").disabled, "ready to start");
  doc.getElementById("lobby-start").click();   // Puddle's device never answers
  await until(() => visible(doc, "screen-ready"), "your side");
  doc.getElementById("to-castle").click();
  await until(() => visible(doc, "screen-castle"), "the castle", 8000);
  doc.getElementById("to-table").click();
  await until(() => visible(doc, "waiting"), "the waiting sign");
  assert.ok(doc.getElementById("waiting-text").textContent.includes("Captain Puddle"));
  assert.ok(visible(doc, "dont-wait"), "the host can stop waiting");
  doc.getElementById("dont-wait").click();
  await until(() => visible(doc, "screen-walk") || visible(doc, "screen-talk"), "on without them", 8000);
});

test("rejoining after a reload: back into the game where you left it", async () => {
  const { page, doc } = await toMulti();
  doc.getElementById("multi-host").click();
  await until(() => visible(doc, "screen-lobby"), "the lobby");
  const name = page.multiplayer.room;
  const net = other();
  net.updateRoom(name, (r) => join(r, net.uid, Date.now()).room);
  net.updateRoom(name, (r) => pick(r, net.uid, "puddle").room);
  await until(() => doc.querySelector('#lobby-cards .card[data-id="pepper"]'), "cards");
  doc.querySelector('#lobby-cards .card[data-id="pepper"]').click();
  await until(() => !doc.getElementById("lobby-start").disabled, "ready to start");
  const stopBot = bot(net, name, "puddle");
  doc.getElementById("lobby-start").click();
  await until(() => visible(doc, "screen-ready"), "your side");
  doc.getElementById("to-castle").click();
  await until(() => visible(doc, "screen-castle"), "the castle", 8000);
  doc.getElementById("to-table").click();
  await until(() => visible(doc, "talk-options"), "the talk", 15000);
  // The page reloads (the iPad slept)...
  const again = await openPage("../index.html?fast=1&rejoin");
  const doc2 = again.document;
  await until(() => visible(doc2, "rejoin"), "the Rejoin button", 8000);
  doc2.getElementById("rejoin").click();
  await until(() => visible(doc2, "talk-options"), "back at the Round Table talk", 15000);
  assert.eq(again.game.history.length, 0, "no vote yet");
  doc2.querySelector("#talk-options .question").click();
  await until(() => visible(doc2, "to-vote"), "both have spoken, carrying on", 10000);
  stopBot();
});
