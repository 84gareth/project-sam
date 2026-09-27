# Phase 4 spec: racers

Sam's answers, 2026-09-27:
- **Medium** difficulty: sometimes you win, sometimes you lose.
- The other cars are the **same car as yours** for now ("get crazier in other
  races" later, Phase 6). **All purple.** Your own colour choice is Phase 6.
- **Cars bump** each other.
- **3, 2, 1, GO!** start: everyone waits, then goes.
- The end shows **places** (1st, 2nd, 3rd...).
- **Silly names:** Zoomy, Bumper, Wobble, Turbo Tim, Speedy.

## How it works
- 6 cars on a grid behind the line, two by two, 12 m apart. Sam starts at
  the back (left), so the race is about overtaking.
- Computer drivers (`scripts/ai_rules.gd`, pure) aim at a point ahead on the
  track, each in its own lane (within 4.5 m of the middle), and ease off for tight bends. Each has its own
  top-speed share (88-95% of the car's top speed) so they spread out.
  Balance is measured, not guessed: a simulated AI lap of Sam's track must
  take 42-60 s and never leave the road (unit test).
- Bumps: when cars touch, the one hit gets a shove and the one hitting loses
  a little speed.
- Places during the race: laps done, then distance round the lap
  (`scripts/race_rules.gd`, pure). Shown under the lap counter ("3rd").
- When Sam finishes, a results panel lists all 6 places (cars still racing
  are placed by how far round they are). Press A / Enter / Space to race
  again.
