// The real page loads in an iPad-sized frame and shows the name and version.
import { test, assert, openPage, until } from "../framework.js";
import { VERSION, GAME_NAME } from "../../js/version.js";

test("page shows the name and version", async () => {
  const page = await openPage();
  const doc = page.document;
  // The first page of the run loads everything cold: give it longer.
  await until(() => doc.getElementById("version").textContent !== "v0.0.0", "page script ran", 15000);
  assert.eq(doc.getElementById("title").textContent, GAME_NAME);
  assert.eq(doc.getElementById("version").textContent, "v" + VERSION);
  assert.eq(doc.title, GAME_NAME);
});

test("page fills an iPad screen without scrolling", async () => {
  const page = await openPage("../index.html", 1024, 768);
  const doc = page.document;
  assert.ok(doc.documentElement.scrollHeight <= 768, `page is ${doc.documentElement.scrollHeight}px tall`);
  assert.ok(doc.documentElement.scrollWidth <= 1024, `page is ${doc.documentElement.scrollWidth}px wide`);
});

test("the page loads its code with the version stamped on", async () => {
  const page = await openPage();
  await until(() => page.document.getElementById("version").textContent !== "v0.0.0", "page script ran");
  const loaded = page.performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.includes("/js/"));
  assert.gt(loaded.length, 5, "it loaded its modules");
  for (const n of loaded) assert.ok(n.includes(`?v=${VERSION}`), `stamped: ${n}`);
});

test("a Home Screen icon (the castle) for the iPad", async () => {
  const page = await openPage();
  const link = page.document.querySelector('link[rel="apple-touch-icon"]');
  assert.ok(link, "the icon is linked");
  const img = new Image();
  img.src = link.href;
  await img.decode();
  assert.eq(img.naturalWidth, 180);
  assert.eq(img.naturalHeight, 180);
});

// Phones (Gareth, 2026-10-24: "bordering on unplayable on iPhone").
import { fitScale, turnSideways } from "../../js/fit.js";

test("the game shrinks evenly to fit a phone held sideways", async () => {
  assert.eq(fitScale(1024, 768), 1, "an iPad isn't shrunk");
  assert.eq(fitScale(768, 1024), 1, "nor an iPad held upright");
  const page = await openPage("../index.html?fast=1", 750, 340);
  const doc = page.document;
  await until(() => doc.getElementById("version").textContent !== "v0.0.0", "page script ran");
  assert.near(Number(doc.getElementById("app").style.getPropertyValue("--fit")), 0.5, 1e-9);
  const start = doc.getElementById("start").getBoundingClientRect();
  assert.ok(start.bottom <= 340 && start.right <= 750 && start.top >= 0, "Start is on the screen");
  assert.ok(doc.getElementById("turn").hidden, "no 'turn sideways' message");
  assert.ok(doc.documentElement.scrollHeight <= 340, "no scrolling");
});

test("a phone held upright is asked to turn sideways", async () => {
  assert.ok(turnSideways(390, 760));
  assert.notOk(turnSideways(768, 1024), "not an iPad");
  const page = await openPage("../index.html?fast=1", 390, 760);
  await until(() => page.document.getElementById("version").textContent !== "v0.0.0", "page script ran");
  assert.notOk(page.document.getElementById("turn").hidden);
});

test("character cards: rows centred, and no words spill out of a card", async () => {
  const page = await openPage("../index.html?fast=1");
  const doc = page.document;
  await until(() => doc.querySelectorAll(".card").length === 22, "cards built");
  doc.getElementById("start").click();
  doc.getElementById("mode-single").click();
  const cards = [...doc.querySelectorAll("#cards .card")];
  for (const c of cards) assert.ok(c.scrollHeight <= c.clientHeight + 1, `${c.dataset.id}'s words fit`);
  const box = doc.getElementById("cards").getBoundingClientRect();
  const last = cards[cards.length - 1].getBoundingClientRect();
  const rowStart = cards.filter((c) => Math.abs(c.getBoundingClientRect().top - last.top) < 2)[0].getBoundingClientRect();
  assert.near(rowStart.left - box.left, box.right - last.right, 12, "the last row is centred");
});

test("no two things on the page share an id", async () => {
  const page = await openPage("../index.html?fast=1");
  const ids = [...page.document.querySelectorAll("[id]")].map((e) => e.id);
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.eq(twice, [], "ids used twice");
});
