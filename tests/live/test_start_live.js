// Start at the station, pick a character, pick a side: on the real page.
import { test, assert, openPage, until } from "../framework.js";
import { newGame, TRAITOR, FAITHFUL } from "../../js/game.js";

const visible = (doc, id) => !doc.getElementById(id).hidden;

// The first seed that makes `id` the given side. Gives up (a clean FAIL,
// not a frozen run) if the deal never produces it.
function seedFor(id, side) {
  for (let seed = 1; seed <= 10000; seed++) if (newGame(id, seed).playerSide === side) return seed;
  throw new Error(`no seed in 10000 makes ${id} a ${side}`);
}

async function tapThrough(characterIndex, seed) {
  const page = await openPage(`../index.html?seed=${seed}`);
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "22 cards built");
  doc.getElementById("start").click();
  doc.getElementById("mode-single").click();
  doc.querySelectorAll(".card")[characterIndex].click();
  doc.getElementById("choose").click();
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
  doc.getElementById("mode-single").click();
  await until(() => doc.querySelectorAll(".card").length === 22, "22 cards");
  assert.ok(visible(doc, "screen-pick"));
  const names = [...doc.querySelectorAll(".card-name")].map((n) => n.textContent);
  assert.ok(names.includes("Captain Puddle") && names.includes("Barry Banjo"), "first and last are there");
});

test("you can't choose until you've picked someone", async () => {
  const page = await openPage();
  const doc = page.document;
  doc.getElementById("start").click();
  doc.getElementById("mode-single").click();
  assert.ok(doc.getElementById("choose").disabled, "Choose starts greyed out");
  doc.querySelectorAll(".card")[4].click();
  assert.notOk(doc.getElementById("choose").disabled, "then it works");
  assert.ok(doc.querySelectorAll(".card")[4].classList.contains("picked"), "the card lights up");
});

test("pick Chef Pepper: the game says you're a Faithful", async () => {
  const { page, doc } = await tapThrough(4, seedFor("pepper", FAITHFUL));
  assert.ok(visible(doc, "screen-ready"), "straight to who you are: no choosing a side");
  assert.eq(doc.getElementById("ready-who").textContent, "You are Chef Pepper.");
  assert.eq(doc.getElementById("ready-side").textContent, "You are a Faithful.");
  assert.eq(page.game.playerId, "pepper");
});

test("pick Barry Banjo: the game says you're a Traitor", async () => {
  const { page, doc } = await tapThrough(21, seedFor("barry", TRAITOR));
  assert.eq(doc.getElementById("ready-who").textContent, "You are Barry Banjo.");
  assert.eq(doc.getElementById("ready-side").textContent, "You are a Traitor. Shh!");
  assert.eq(page.game.playerSide, TRAITOR);
});

test("there's no Faithful-or-Traitor button to pick", async () => {
  const page = await openPage();
  assert.eq(page.document.querySelectorAll("#pick-faithful, #pick-traitor").length, 0);
});

test("Sam's drawings show on the picker; the rest show their initials", async () => {
  const page = await openPage();
  const doc = page.document;
  doc.getElementById("start").click();
  doc.getElementById("mode-single").click();
  const cards = doc.querySelectorAll(".card");
  const img = cards[0].querySelector("img.portrait");
  assert.ok(img, "Captain Puddle's card has a picture");
  await until(() => img.complete && img.naturalWidth > 0, "the drawing loaded");
  assert.ok(cards[1].querySelector("img.portrait"), "Granny Gumdrop's card has a picture");
  assert.eq(doc.querySelectorAll("#cards .card img.portrait").length, 22, "all 22 are Sam's drawings now");
});
