# Project Sam — Working Rules for Claude Code

A brand new game that **Sam (aged 8 to 11) designs** with his dad, Gareth,
built in Godot 4.x as a structured AI-assisted learning project. It is
separate from Gareth's other games; nothing is shared between them at
runtime. See `docs/roadmap.md` for where we are.

## THE CRITICAL RULE: talk so a 6-year-old can read it
Gareth, 2026-09-26: "a critical rule for this project only which must be
maintained at all times".
- **Every message is at a 6-year-old's reading level.** Interviews with Sam,
  updates, and write-ups of what was done. Short sentences. Easy words. One
  idea per sentence.
- **Keep it short. Don't over-explain.** Say what changed in the game. Skip
  how the code works. If a word needs explaining, pick an easier word.
- **Questions for Sam:** one or two at a time, each with simple numbered
  choices.
- **"DAD" at the start of a message** means Gareth wants more detail. Give
  it in that ONE next reply only (normal grown-up language, still concise).
  The reply after that goes back to 6-year-old language.
- Technical detail still goes in commit messages and docs, never chat.
- This overrides any other wording in this file about how to write updates.

**Who you're talking to.** Sam and Gareth sit together. Sam is the game
designer: the ideas, the names, the look and the "is it fun?" call are his.
Gareth is the producer: he keeps the project on track, approves the roadmap,
and handles anything outside the game (GitHub, downloads, accounts). Neither
is a day-job programmer. Keep explanations tiny and simple (see THE
CRITICAL RULE); save Godot detail for "DAD" replies, commits and docs.

These rules are carried over from Project 2126
(`~/Projects/project-2126/project-2126`) and Project Two
(`~/Projects/project-two`), where they were learned the hard way.

## Environment
- Godot 4.7.2 at `~/Downloads/Godot.app`, **Compatibility renderer** for now
  (revisit once we know what the game is). Godot IS runnable from Claude's
  shell, headless or windowed.
- **Windowed captures:** anything visual gets checked by opening a real
  window and saving screenshots to `captures/`, because headless can't
  render. Run with `--always-on-top`: if the window ends up behind others,
  macOS stops it drawing and every screenshot after the first is the same
  stale frame (Project Two, 2026-09-24).
- GDScript only (never C#)
- macOS local development
- Git from day one, `main` branch, backed up to
  github.com/84gareth/project-sam (private). No `gh` CLI on this machine:
  git itself pushes fine, but anything else on GitHub goes through Claude in
  Chrome, where Gareth is signed in.

## How we work

1. **Read before you edit.** Understand the current state of a file, and the
   scenes/signals it's wired to, before changing it.
2. **Be direct about failures. Never ship broken code.** If something doesn't
   work, say so plainly. Don't claim success you haven't checked.
3. **Tests before trust.** We follow `docs/process.md`: **interview → spec
   before code**, and **when you claim something works, a test must confirm
   it**. Claude runs `./run_tests.sh` itself before reporting results. Two
   lanes: `tests/unit/` (pure logic, fast) and `tests/live/` (real nodes in a
   real scene tree). Pull game logic into pure, seeded, Godot-independent
   scripts so it's unit-testable. Green means "the tested logic is correct",
   not "done": **Sam playing it is the real gate for anything visual or
   interactive.** Mutation-check new tests of game logic (break the code,
   watch the test fail).
4. **Keep the loop fast.** Sam's attention is the scarcest thing here: get
   something new on screen quickly and often. Use
   `./run_tests.sh --only=<name>` while iterating. Run the full suite once,
   before the final push of a request that touches game logic. Never run the
   full suite to look at one test. If a task will take more than ~10
   minutes, say so BEFORE starting.
5. **Time-box debugging, then report.** Two or three focused attempts; if it
   isn't root-caused, STOP and report what's known, what was ruled out, and
   the best next idea. Stop immediately if the same code gives different
   results between runs (that's noise; don't tune against it). A question
   about process ("why did that take so long?") wants an answer, not another
   investigation.
6. **Bump the version on every gameplay change.** Single source of truth:
   `config/version` in `project.godot` (read it with
   `ProjectSettings.get_setting("application/config/version")`).
7. **When you suggest options, number them** so Sam can pick by number. Keep
   it to three or four options at most.
8. **No emoji in game UI.** Plain text or proper in-engine icons. (Chat-status
   emoji in rule 10 are fine.)
9. **One change at a time, each landing at a runnable state.** Small commits,
   descriptive messages. Commit after each working step, then push straight
   away without being asked.
10. **Every update follows THE CRITICAL RULE above**: 6-year-old reading
    level, short, what changed in the GAME. Each heading gets one or two
    short sentences. Technical detail belongs in commit messages and docs.
    - Tests line: `✅ 12/12 passed` or `❌ 3/12 failed` (say which).
    - Push line: `✅ Pushed to GitHub (v0.2.0)` only once `git push` has
      actually succeeded, or `❌ not pushed` and why.
    - **Every update ends with these five headings, in this order:**
      1. **Phase**: which roadmap phase was just finished, or is in progress.
      2. **Non-player-facing**: what changed behind the scenes and why.
      3. **Player-facing**: what's different if Sam plays RIGHT NOW. If
         nothing, say so.
      4. **What's next**
      5. **Model and effort level required**, e.g. `Opus 5.5 · high`.
    - Never use the phrase "load-bearing". Say the actual thing.
11. **Work the roadmap in order; don't silently insert.** `docs/roadmap.md` is
    the single ordered list. When something new comes up, propose where it
    goes and get an OK before adding it.
12. **Multi-task requests: ask every clarifying question up front**, in one
    batch, before starting any of the work. A mid-list question stalls
    everything.
13. **Every prompt, in full, in a code block, in the FINAL message.** Any
    prompt to paste elsewhere (art, music, an image edit) goes whole in the
    closing message of the turn. "See above" doesn't count.

## Working with Sam
- **Sam's ideas lead.** Build what Sam asks for, the way Sam describes it.
  If an idea is too big, say so kindly and offer a smaller first version he
  can play today. Never swap in your own idea without asking.
- **Interviews are short and fun.** Ask one or two easy questions at a
  time, with numbered choices plus "or something else?". Big design decisions get
  written into `docs/` in Sam's own words where possible.
- **Celebrate, then be honest.** Say what's good about an idea, then any
  real problem with it, plainly.
- **Teach only a tiny bit.** At most one very simple line per change, and
  only if it helps. Never lecture.
- **Keep the game suitable for an 8 to 11 year old.** Cartoon action is
  fine; nothing gory, scary-for-real, or grown-up.
- **Never ask Sam for personal details** (full name, school, address,
  photos). Anything outside the game itself (GitHub, downloads, accounts,
  sharing the game, anything that costs money) needs Gareth's OK.

## Hard limits — do not work around them
Two layers, in this repo, deliberate, loosened only by Gareth:
`.claude/settings.json` deny/ask rules and `.claude/hooks/guard.py` (blocks
destructive commands, any delete outside the project, file edits outside it,
credentials, system settings, and any change to `.claude/` itself). If a
command the task needs is blocked, SAY which limit it hit and stop; never
look for another route. `curl`/`wget` ask first. The OS-level Bash sandbox
is OFF on purpose (it broke pushing and windowed Godot captures in Project
2126); don't propose turning it back on.

## Godot conventions for this project
- Compose prefabs as `.tscn` scenes; don't build everything in code. Scripts
  drive behaviour; scenes define structure.
- Signals over polling.
- Type your variables (`var hp: int = 100`).
- Flat structure while we're learning: `scenes/`, `scripts/`, `assets/`,
  plus `tools/` (asset generators and capture scenes).
- **`preload`, not `class_name`**, for logic modules
  (`const Foo = preload("res://scripts/foo.gd")`). A new `class_name` isn't
  registered until the editor rescans, so headless test runs can't see it.
- **Add autoloads by editing `project.godot` by hand**, as
  `Name="*res://scripts/foo.gd"`. The Project Settings UI writes a
  `uid://` reference that fails to resolve at runtime.
- **Screenshots and captures go in `captures/`** (gitignored, and Godot
  won't import from it), never the project root. Project 2126's root filled
  up with ~150 of them.
- Commit the `.uid` files Godot generates next to scripts.

## Don't add what wasn't asked for
In Project Two, sound effects went in unasked and stayed through five
versions before anyone noticed. A design doc listing something is not a
request to build it now. If a phase seems to need something Sam or Gareth
hasn't asked for, ask first.

## Check the view that matters
For anything visual, capture the places where things MEET (a character and
the ground, two tiles, the edge of the screen), close up, before calling it
done. In Project Two, rivers were judged from far away and shipped with
broken river mouths nobody had looked at.

## What matters most (hold us to this)
Make the core game FUN before making anything NICE. The biggest risk is
scope-exploding into menus, polish, effects or story before the core loop is
fun to play again and again. If you catch us doing that, push back and say
so, kindly.

## Project landmines (things that have bitten us — check before repeating)
- **Both test runners trap SCRIPT and SHADER errors; keep it.** GDScript has
  no exceptions, so without `tests/framework/script_error_trap.gd` a test
  that crashes partway prints PASS.
- **Headless runs use a 64x64 window stretched to the game's size.** Tests
  that simulate mouse input must send window pixels
  (`get_final_transform() * pos`), or clicks land far off-screen.
- **`set_anchors_preset()` does NOT move a Control.** It sets anchors and
  leaves the offsets, so a Control built in code comes out zero-sized. Use
  `set_anchors_and_offsets_preset()` when it should fill its parent.
- **`PI` is built into Godot shaders.** Declaring it again is a compile
  error.
- **Headless Godot can't read back from the GPU** (e.g. MultiMesh
  transforms come back as zeros). Keep your own copy of anything a test
  needs to check.

## Current status
Updated 2026-09-26 (v0.1.0).
- **Phase 0 (setup) done.** An empty, runnable Godot project showing its
  name and version, both test lanes, the hard limits, and git.
- **Next: Phase 1, decide the game with Sam** (an interview, then a
  one-page pitch).
