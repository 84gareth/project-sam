// Sam's home page: a big tile per game that fits any screen, and a way back
// from the game. It replaces The Traitors' old Start screen.
import { test, assert, openPage, until } from "./framework.js";

test("two big tiles: The Traitors, and Sam's new game (coming soon)", async () => {
  const page = await openPage("../index.html", 1024, 768);
  const doc = page.document;
  const links = [...doc.querySelectorAll("a.game")];
  assert.eq(links.map((a) => a.getAttribute("href")), ["traitors/"], "only The Traitors opens for now");
  assert.ok(doc.querySelector("#traitors .name").textContent.includes("The Traitors"));
  assert.ok(doc.querySelector("#new-game .name").textContent.includes("Coming soon"));
  for (const t of doc.querySelectorAll(".game")) {
    const r = t.getBoundingClientRect();
    assert.gt(r.width, 300, `${t.id} is big`);
    assert.gt(r.height, 300, `${t.id} is big`);
  }
});

test("fits an iPad either way up and a phone sideways, with nothing to scroll", async () => {
  for (const [w, h] of [[1024, 768], [768, 1024], [844, 390]]) {
    const page = await openPage("../index.html", w, h);
    const doc = page.document;
    assert.ok(doc.documentElement.scrollHeight <= h && doc.documentElement.scrollWidth <= w, `no scrolling at ${w}x${h}`);
    const [a, b] = [...doc.querySelectorAll(".game")].map((x) => x.getBoundingClientRect());
    for (const r of [a, b]) assert.ok(r.left >= 0 && r.top >= 0 && r.right <= w && r.bottom <= h, `on screen at ${w}x${h}`);
    if (w > h) assert.lt(a.right, b.left, "side by side when held sideways");
    else assert.lt(a.bottom, b.top, "one above the other when held upright");
  }
});

test("a Home Screen icon: the castle", async () => {
  const page = await openPage("../index.html");
  const img = new Image();
  img.src = page.document.querySelector('link[rel="apple-touch-icon"]').href;
  await img.decode();
  assert.eq([img.naturalWidth, img.naturalHeight], [180, 180]);
});

test("The Traitors opens with a house button back to this page", async () => {
  const home = new URL("../", location.href).href;
  const game = await openPage("../traitors/index.html", 1024, 768);
  await until(() => game.document.getElementById("version").textContent !== "v0.0.0", "The Traitors started", 15000);
  const house = game.document.getElementById("home");
  assert.eq(house.href, home);
  const r = house.getBoundingClientRect();
  assert.ok(r.width >= 60 && r.top >= 0 && r.left >= 0, "big enough and on screen");
});

test("the tile's picture is there", async () => {
  const page = await openPage("../index.html", 1024, 768);
  const castle = await fetch(new URL("traitors/assets/castle.jpg", page.location.href));
  assert.ok(castle.ok, "the castle picture");
});
