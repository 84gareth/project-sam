# Development process

Carried over from Project 2126 (adopted 2026-09-08), Project Two and Turbo
Town (`archive/turbo-town`).

## 1. Interview, not prompt
Every non-trivial feature **starts with a numbered-question interview** until
the design has no holes. Claude asks, Sam decides (Gareth signs off on the
roadmap). Questions come a few at a time, with numbered choices. The answers
become a short spec in `docs/` **before any code**.

## 2. Tests before trust
Game rules should be **pure and seeded** so they're unit-testable. **When
Claude claims something works, a test has to say so too.**

- **Pure logic** (rules, maths, scoring, progression) → a module with no
  `document` and no timers, unit-tested in `tests/unit/`.
- **The real page** (drawing, touches, screens) → a live test in
  `tests/live/`, which loads `index.html` in an iPad-sized frame.
- **Feel** (controls, juice, timing, "is it fun?") → can't be tested; Sam
  plays it on the iPad.

The runner is a tiny self-owned one in `tests/framework.js` (no library).
It fails a test that crashes, a page that throws an error, and a test file
that doesn't load.

## 3. Balance measured, not vibed
Once there are numbers to balance, keep them in pure seeded modules so a
test can simulate whole games and assert bands (e.g. "a level lasts 1–3
minutes"). Prefer relative bands over exact numbers. When a band fails, fix
the design, not the assertion.

## Running the tests
```bash
./run_tests.sh
```
Runs everything in a hidden Chrome. Ends with `All green.` or `FAILED.`
Focus with `./run_tests.sh --only=<name>` (matches test file names). To
watch them in a normal browser: `tools/playtest.sh tests`.

## Writing a test
```js
import { test, assert, openPage, until } from "../framework.js";

test("what it checks", async () => {
  const page = await openPage();               // live lane only
  await until(() => /* something */ true, "what we're waiting for");
  assert.eq(actual, expected, "message");
});
```
Asserts: `ok/notOk/eq/ne/gt/lt/near`. Add the new file to the list in
`tests/index.html`.
