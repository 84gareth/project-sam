// A tiny self-owned test runner (no library), run in a real browser by
// ./run_tests.sh (headless Chrome), or by opening tests/index.html.
//
// Two lanes, like the Godot projects:
//   tests/unit/  pure logic: import a game module, check its answers.
//   tests/live/  the real page: load index.html in a frame and check it.
//
// A test file registers tests with test("name", fn); fn may be async.
// Crash trap: any error thrown, rejected or reported to the window while a
// test runs fails that test. A test file that fails to load, or registers
// no tests, fails too, so a broken file can't vanish from the run silently.

const registered = [];
let currentFile = "";
let pageErrors = [];

export function test(name, fn) {
  registered.push({ file: currentFile, name, fn });
}

class AssertionError extends Error {}

function show(v) {
  return typeof v === "string" ? JSON.stringify(v) : String(v);
}

function fail(msg, why) {
  throw new AssertionError(why + (msg ? "  -  " + msg : ""));
}

export const assert = {
  ok(v, msg = "") { if (!v) fail(msg, "expected true"); },
  notOk(v, msg = "") { if (v) fail(msg, "expected false"); },
  eq(a, b, msg = "") {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) fail(msg, `expected ${sb}, got ${sa}`);
  },
  ne(a, b, msg = "") {
    if (JSON.stringify(a) === JSON.stringify(b)) fail(msg, `expected not ${show(b)}`);
  },
  gt(a, b, msg = "") { if (!(a > b)) fail(msg, `expected ${show(a)} > ${show(b)}`); },
  lt(a, b, msg = "") { if (!(a < b)) fail(msg, `expected ${show(a)} < ${show(b)}`); },
  near(a, b, tol = 1e-4, msg = "") {
    if (Math.abs(a - b) > tol) fail(msg, `expected ${show(a)} ≈ ${show(b)} (tol ${tol})`);
  },
};

// ─── Helpers for the live lane ──────────────────────────────────────────────

// Wait until predicate() is true, or fail after timeoutMs.
export async function until(predicate, label = "", timeoutMs = 5000) {
  const end = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() > end) fail(label, `timed out after ${timeoutMs} ms waiting`);
    await new Promise((r) => setTimeout(r, 16));
  }
}

// Load the real game page in an iPad-sized frame. Returns its window.
// Only one game page runs at a time: each new one closes the last, so old
// pages' timers (puppets walking, catapults sliding) don't slow later tests
// down until they time out (2026-10-24: flaky castle tests).
let lastFrame = null;
export async function openPage(path = "../index.html", width = 1024, height = 768) {
  if (lastFrame) lastFrame.remove();
  const frame = document.createElement("iframe");
  lastFrame = frame;
  frame.style.width = width + "px";
  frame.style.height = height + "px";
  document.body.appendChild(frame);
  await new Promise((resolve) => {
    frame.onload = resolve;
    frame.src = path;
  });
  // The page's own errors count against the test that opened it.
  frame.contentWindow.addEventListener("error", (e) => pageErrors.push(`PAGE ERROR: ${e.message}`));
  frame.contentWindow.addEventListener("unhandledrejection", (e) => pageErrors.push(`PAGE REJECTION: ${e.reason}`));
  return frame.contentWindow;
}

export function closePages() {
  for (const f of document.querySelectorAll("iframe")) f.remove();
}

// ─── Running ────────────────────────────────────────────────────────────────

window.addEventListener("error", (e) => pageErrors.push(`ERROR: ${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener("unhandledrejection", (e) => pageErrors.push(`REJECTION: ${e.reason}`));

export async function run(files) {
  const out = document.getElementById("out");
  const lines = [];
  const print = (s) => { lines.push(s); out.textContent = lines.join("\n"); };

  // ./run_tests.sh --only=<name> arrives as ?only=<name>: only test files
  // whose name contains it.
  const only = new URLSearchParams(location.search).get("only") || "";
  const chosen = files.filter((f) => f.includes(only));
  if (only) print(`   (filtered to "${only}": ${chosen.length} of ${files.length} files)`);

  let total = 0, passed = 0;
  for (const file of chosen) {
    currentFile = file;
    const before = registered.length;
    try {
      await import("./" + file);
    } catch (e) {
      total++;
      print(`  FAIL  ${file} (failed to load: ${e.message})`);
      continue;
    }
    if (registered.length === before) {
      total++;
      print(`  FAIL  ${file} (no tests - did it fail to load?)`);
    }
  }

  for (const t of registered) {
    total++;
    pageErrors = [];
    const fails = [];
    try {
      await t.fn();
    } catch (e) {
      fails.push(e instanceof AssertionError ? e.message : `CRASH: ${e && e.stack ? e.stack.split("\n")[0] : e}`);
    }
    closePages();
    fails.push(...pageErrors);
    if (fails.length === 0) {
      passed++;
      print(`  PASS  ${t.file}::${t.name}`);
    } else {
      print(`  FAIL  ${t.file}::${t.name}`);
      for (const f of fails) print(`          ${f}`);
    }
  }
  print("");
  print(`Total: ${total}   Passed: ${passed}   Failed: ${total - passed}`);
}
