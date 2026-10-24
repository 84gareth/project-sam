// Start at the station, pick a character, pick a side: on the real page.
import { test, assert, openPage, until } from "../framework.js";
import { TRAITOR } from "../../js/game.js";

const visible = (doc, id) => !doc.getElementById(id).hidden;

async function tapThrough(characterIndex, sideButton) {
  const page = await openPage();
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "22 cards built");
  doc.getElementById("start").click();
  doc.querySelectorAll(".card")[characterIndex].click();
  doc.getElementById("choose").click();
  doc.getElementById(sideButton).click();
  return { page, doc };
}

test("the station picture shows first, with a Start button", async () => {
  const page = await openPage();
  const doc = page.document;
  const img = doc.getElementById("station-picture");
  await until(() => img.complete && img.naturalWidth > 0, "station picture loaded");
  assert.ok(visible(doc, "screen-station"), "station showing");
  assert.notOk(visible(doc, "screen-pick"), "picker hidden");
  assert.gt(doc.getElementById("start").getBoundingClientRect().height, 59, "Start is big enough to tap");
});

test("all 22 characters are on the picker", async () => {
  const page = await openPage();
  const doc = page.document;
  doc.getElementById("start").click();
  await until(() => doc.querySelectorAll(".card").length === 22, "22 cards");
  assert.ok(visible(doc, "screen-pick"));
  const names = [...doc.querySelectorAll(".card-name")].map((n) => n.textContent);
  assert.ok(names.includes("Captain Puddle") && names.includes("Barry Banjo"), "first and last are there");
});

test("you can't choose until you've picked someone", async () => {
  const page = await openPage();
  const doc = page.document;
  doc.getElementById("start").click();
  assert.ok(doc.getElementById("choose").disabled, "Choose starts greyed out");
  doc.querySelectorAll(".card")[4].click();
  assert.notOk(doc.getElementById("choose").disabled, "then it works");
  assert.ok(doc.querySelectorAll(".card")[4].classList.contains("picked"), "the card lights up");
});

test("pick Chef Pepper as a Faithful", async () => {
  const { page, doc } = await tapThrough(4, "pick-faithful");
  assert.ok(visible(doc, "screen-ready"));
  assert.eq(doc.getElementById("ready-who").textContent, "You are Chef Pepper.");
  assert.eq(doc.getElementById("ready-side").textContent, "You are a Faithful.");
  assert.eq(page.game.playerId, "pepper");
});

test("pick Barry Banjo as a Traitor", async () => {
  const { page, doc } = await tapThrough(21, "pick-traitor");
  assert.eq(doc.getElementById("ready-who").textContent, "You are Barry Banjo.");
  assert.eq(doc.getElementById("ready-side").textContent, "You are a Traitor. Shh!");
  const me = page.game.players.find((p) => p.id === "barry");
  assert.eq(me.side, TRAITOR);
});
