// The real page loads in an iPad-sized frame and shows the name and version.
import { test, assert, openPage, until } from "../framework.js";
import { VERSION, GAME_NAME } from "../../js/version.js";

test("page shows the name and version", async () => {
  const page = await openPage();
  const doc = page.document;
  await until(() => doc.getElementById("version").textContent !== "v0.0.0", "page script ran");
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
