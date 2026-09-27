# Roadmap

The single ordered list. Work it top to bottom; new items get proposed and
agreed before they're added (CLAUDE.md rule 11).

## Phase 0: Project setup ✅ (v0.1.0)
- ✅ Godot 4.7 project, Compatibility renderer, 1600x900 window
- ✅ Placeholder main scene showing name and version
- ✅ Test runner with both lanes (unit and live), crash trap, `--only` filter
- ✅ Git repo, working rules (CLAUDE.md, docs/process.md) and hard limits
  (`.claude/`)

## Phase 1: Decide the game (with Sam) ✅ (v0.1.1)
- ✅ Interviews 1 and 2 (2026-09-26): the game is **Turbo Town**, a 3D
  crazy-car city race. Pitch: `docs/pitch.md`
- ✅ Title screen shows the name
- ✅ Roadmap to a first playable approved by Gareth (2026-09-26)

Each phase below ends with Sam playing it.

## Phase 2: First drive ✅ (v0.2.2)
Spec: `docs/first-drive-spec.md`.
- ✅ One car on a flat test area with five ramps, and a chase camera
- ✅ Arcade handling: quick, grippy, forgiving
- ✅ Controls: Xbox controller and keyboard
- ✅ Sam's playtests: "too slow!" (v0.2.1), "even faster!" (v0.2.2), then
  "Fun! Let's make a race track" (2026-09-26). Gate passed.

## Phase 3: A track ✅ (v0.3.0)
Spec: `docs/track-1-spec.md`. Sam drew the track himself.
- ✅ Sam's drawing traced into a real track (`tools/trace_track.gd`)
- ✅ Walls both sides, grass in the middle, blocky buildings outside
- ✅ 3 laps, a lap counter, a chequered start/finish line
- The old field with ramps is still there: `tools/playtest.sh test_drive`
- ✅ Sam raced it (2026-09-27). Gate passed.

## Phase 4: Racers
- 5 computer cars, race positions, a results screen

## Phase 5: Power-ups (Sam's ideas, 2026-09-27)
- Pickups on the track that give a power-up
- Jelly: traps a racer for a few seconds
- Water balloon: throw it in front or behind; the racer hit spins out for a
  few seconds
- Worm: your car turns into a worm and digs under the track
- Banana skins (from interview 1)

## Phase 6: Choices
- Pick your hero and your car's colour
- Win races to unlock crazy cars

## Phase 7: Look and sound
- Only once the racing is fun. Revisit the renderer (Forward+) here.
