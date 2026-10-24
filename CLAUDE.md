# Project Sam — Working Rules for Claude Code

A game that **Sam (aged 8 to 11) designs** with his dad, Gareth, built as a
**web page he plays on his iPad**, as a structured AI-assisted learning
project. Separate from Gareth's other games. See `docs/roadmap.md` for where
we are.

Sam's first game here, **Turbo Town** (a Godot crazy-car race), was put away
on 2026-10-24 when Sam chose a new idea: `archive/turbo-town/`, git tag
`turbo-town-v0.4.1`. It still runs and passes its tests.

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
CRITICAL RULE); save technical detail for "DAD" replies, commits and docs.

These rules are carried over from Project 2126
(`~/Projects/project-2126/project-2126`) and Project Two
(`~/Projects/project-two`), where they were learned the hard way.

## Environment
- **A plain web page: HTML, CSS and JavaScript, no build step, no
  libraries.** Open `index.html` and that's the game. JavaScript modules
  (`import`/`export`), which need the page served over http, not opened as
  a file (`tools/playtest.sh` serves it).
- **Plays on Sam's iPad, in Safari.** Touch controls only (no keyboard, no
  mouse hover). Design for a landscape iPad first; check portrait too.
- **Published with GitHub Pages:** https://84gareth.github.io/project-sam/
  (the repo is PUBLIC since 2026-10-24, Gareth's call, like his other web
  games). Every push to `main` updates it within a minute or two. Never put
  anything private in the repo: no surnames, school, photos of people.
- No Node or npm on this Mac. Python 3 and Google Chrome are here.
- Git from day one, `main` branch, github.com/84gareth/project-sam. No `gh`
  CLI: git pushes fine; anything else on GitHub goes through Claude in
  Chrome, where Gareth is signed in.
- **Look at it for real** in the built-in browser at iPad size
  (`resize_window` preset tablet, or 1024x768 for landscape), served by
  `python3 -m http.server` in the background. `.claude/` is read-only to
  Claude, so there is no `.claude/launch.json`; open the URL with
  `preview_start`. Screenshots worth keeping go in `captures/` (gitignored).

## How we work

1. **Read before you edit.** Understand the current state of a file, and
   what calls it, before changing it.
2. **Be direct about failures. Never ship broken code.** If something doesn't
   work, say so plainly. Don't claim success you haven't checked.
3. **Tests before trust.** We follow `docs/process.md`: **interview → spec
   before code**, and **when you claim something works, a test must confirm
   it**. Claude runs `./run_tests.sh` itself before reporting results. Two
   lanes: `tests/unit/` (pure logic) and `tests/live/` (the real page in an
   iPad-sized frame). Keep game rules in pure modules that don't touch the
   page, so they're unit-testable. Green means "the tested logic is
   correct", not "done": **Sam playing it on the iPad is the real gate for
   anything visual or interactive.** Mutation-check new tests of game logic
   (break the code, watch the test fail).
4. **Keep the loop fast.** Sam's attention is the scarcest thing here: get
   something new on screen quickly and often. Use
   `./run_tests.sh --only=<name>` while iterating. Run the full suite once,
   before the final push of a request that touches game logic. If a task
   will take more than ~10 minutes, say so BEFORE starting.
5. **Time-box debugging, then report.** Two or three focused attempts; if it
   isn't root-caused, STOP and report what's known, what was ruled out, and
   the best next idea. Stop immediately if the same code gives different
   results between runs (that's noise; don't tune against it). A question
   about process ("why did that take so long?") wants an answer, not another
   investigation.
6. **Bump the version on every gameplay change.** Single source of truth:
   `VERSION` in `js/version.js`.
7. **When you suggest options, number them** so Sam can pick by number. Keep
   it to three or four options at most.
8. **No emoji in game UI.** Plain text or proper drawn icons. (Chat-status
   emoji in rule 10 are fine.)
9. **One change at a time, each landing at a runnable state.** Small commits,
   descriptive messages. Commit after each working step, then push straight
   away without being asked. (Pushing also publishes the game.)
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
    - **EVERY update ends with the "link to play"** (Gareth, 2026-09-26,
      widened to every update 2026-09-27): after the five headings, the
      iPad link (https://84gareth.github.io/project-sam/) and a `bash` code
      block that runs the launcher, so it starts with the Run button:
      ```bash
      cd "/Users/gareth/Projects/Project Sam" && tools/playtest.sh
      ```
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
  time, with numbered choices plus "or something else?". Big design
  decisions get written into `docs/` in Sam's own words where possible.
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
is OFF on purpose; don't propose turning it back on.
- The guard reads command TEXT: a shell command that merely mentions the
  limits files' path, or an `rm` of a `$VARIABLE`, is blocked even inside a
  heredoc. Edit such files with the Edit tool instead.

## Web conventions for this project
- `index.html` at the root (GitHub Pages serves it). `js/` for code (ES
  modules), `css/` for styles, `assets/` for pictures and sounds when
  there are any.
- Game rules live in pure modules (no `document`, no timers) so unit tests
  can import them. The page code only draws and handles touches.
- Every test file is listed in `tests/index.html`; the runner fails a file
  that doesn't load or registers no tests.
- Touch: use Pointer Events (`pointerdown`/`pointermove`/`pointerup`), not
  mouse events. Buttons at least 60 px. `touch-action: none` on the game so
  Safari doesn't scroll or zoom.

## Don't add what wasn't asked for
In Project Two, sound effects went in unasked and stayed through five
versions before anyone noticed. A design doc listing something is not a
request to build it now. If a phase seems to need something Sam or Gareth
hasn't asked for, ask first.

## Check the view that matters
For anything visual, look where things MEET (a character and the ground,
the edge of the screen, the iPad's rounded corners and home bar), close up,
at iPad size, before calling it done.

## What matters most (hold us to this)
Make the core game FUN before making anything NICE. The biggest risk is
scope-exploding into menus, polish, effects or story before the core loop is
fun to play again and again. If you catch us doing that, push back and say
so, kindly.

## Project landmines (things that have bitten us — check before repeating)
- **Don't name functions or variables after built-ins** of the language
  (a Godot method called `wrap` took a whole test file down, 2026-09-27).
- **A test helper that searches (for a seed, say) must give up**, or a
  broken rule makes it loop forever and freezes the run. The runner has a
  120 s stopwatch for this since 2026-10-24; keep it.
- **Browsers keep old copies of the game's files.** A stale `js/main.js`
  next to a new `index.html` made "All aboard!" do nothing (2026-10-24).
  `tools/playtest.sh` now sends `Cache-Control: no-store`. GitHub Pages
  caches for up to 10 minutes: after a push, a hard refresh (Cmd+Shift+R)
  or a short wait. If it keeps biting, version-stamp the imports.
- **iPad Safari only speaks (and plays sound) after a tap.** Call `say()`
  and `drumRoll()` from tap handlers, never on a timer started earlier.
- **Test the crash trap when changing the runner.** Without it, a test that
  crashes partway can look like a pass (learned in Project 2126).

## Current status
Updated 2026-10-24 (v0.5.1).
- **Phase 0 (web setup) done.** Tests in headless Chrome; GitHub Pages;
  Turbo Town archived.
- **Phase 1 done.** The game: like The Traitors, starting at Havenbrook
  Station (`docs/pitch.md`). 22 characters, all approved by Sam
  (`js/characters.js`, `docs/characters.md`).
- **Phase 2 (choose who you are) built, waiting for Sam (v0.2.1).**
  Station, character picker, then the game TELLS you your side (fair deal,
  Sam's change). Rules in `js/game.js`.
- **Phase 3 (a day at the castle) done (v0.3.0); "We liked the first day!"** Rules
  in `js/castle.js` (pure, balance-tested); screens in `js/castle-ui.js`;
  voices `js/voice.js`; drum roll `js/sound.js`. `?fast=1` skips pauses.
- **Sound effects (v0.5.0)**: real Mixkit recordings, `docs/sound-spec.md`.
- **Next: walk around the castle as paper puppets** (Sam and Gareth's
  pick). Sam's answers: tap where to go; rooms are the great hall, library,
  garden and kitchen; others wander and sometimes chat to each other.
- **Phase 4 (the night) built, waiting for Sam (v0.4.0).** Traitors'
  meeting, the letter, breakfast; tactical voting (`docs/night-spec.md`).
- **Roadmap OK'd by Gareth.** Sam draws the 22 pictures as we go (12 of 22
  in: how to add one is in `docs/characters.md`); voices
  are the iPad's own (Web Speech), arriving with Phase 3.
