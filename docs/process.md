# Development process

Carried over from Project 2126 (adopted 2026-09-08) and Project Two.

## 1. Interview, not prompt
Every non-trivial feature **starts with a numbered-question interview** until
the design has no holes. Claude asks, Sam decides (Gareth signs off on the
roadmap). Questions come a few at a time, with numbered choices. The answers
become a short spec in `docs/` **before any code**. No building on a vague
prompt.

## 2. Tests before trust
Game logic should be **pure and seeded** so rules are unit-testable. **When
Claude claims something works, a test has to say so too.**

- **Pure logic** (rules, maths, scoring, progression) → a Godot-independent
  script, unit-tested in `tests/unit/`.
- **Anything needing real nodes** (scenes, the tree, signals between nodes,
  autoloads, physics, timers) → a live test in `tests/live/`.
- **Feel** (controls, juice, timing, "is it fun?") → can't be tested; Sam
  plays it.

The framework is a tiny self-owned runner in `tests/framework/` (no addon).
Both runners also catch SCRIPT and SHADER errors, so a test that crashes
partway fails instead of passing.

## 3. Balance measured, not vibed
Once there are numbers to balance, keep the numeric model out of the
real-time layer, in pure seeded scripts, so a harness can simulate it and
assert bands (e.g. "a level lasts 2–4 minutes", "no power-up is strictly
best"). Prefer relative bands over exact numbers. When a band fails, fix the
design, not the assertion.

## Running the tests
```bash
./run_tests.sh
```
Runs both lanes headless. Ends with `Both lanes green.` or says which lane
failed. Focus on one area with `./run_tests.sh --only=<name>` (matches test
file names).

## Writing a test
- **Unit**: `tests/unit/test_<thing>.gd`, starting
  `extends "res://tests/framework/test_case.gd"`, with `test_*` methods.
- **Live**: `tests/live/test_<thing>_live.gd`, starting
  `extends "res://tests/framework/live_case.gd"`. Test methods are
  coroutines: `await frames(1)` to let the tree settle, `await until(...)`
  to wait for something to happen.
- Asserts: `assert_eq/ne/true/false/null/not_null/almost_eq/gt/lt`, plus
  optional `before_each()` / `after_each()`.
