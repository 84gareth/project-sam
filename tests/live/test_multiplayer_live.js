// Multiplayer start screens (Phase 8): host, join with the symbol code,
// the lobby. The test page plays the other device, through the same local
// room storage the page uses.
import { test, assert, openPage, until } from "../framework.js";
import { localNet } from "../../js/net.js";
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
  assert.ok(visible(doc, "screen-lobby"));
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
  await until(() => visible(doc, "lobby-soon"), "started");
  assert.ok(net.readRoom(name).started, "the other device sees it start");
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
  assert.ok(visible(doc, "mp-join-error"), "no game with that code");
  doc.getElementById("mp-join-clear").click();
  for (const s of code) doc.querySelector(`.symbol-button[data-symbol="${s}"]`).click();
  assert.eq(doc.querySelectorAll("#mp-join-slots .symbol-icon").length, 4);
  doc.getElementById("mp-join-go").click();
  assert.ok(visible(doc, "screen-lobby"), "in the lobby");
  assert.eq(Object.keys(net.readRoom(codeName(code)).seats).length, 2, "the host sees them join");
  assert.notOk(visible(doc, "lobby-start"), "only the host can start");
});
