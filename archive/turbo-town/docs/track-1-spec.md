# Phase 3 spec: Sam's first track

Sam drew it (`tracks/drawings/track_1.jpg`, 2026-09-27) and wanted the first
track simple. His answers:
- Road the same width all the way round (the drawing's thin bottom was not
  on purpose)
- No ramps yet
- Drive UP the page from the start line
- Grass in the middle, blocky buildings outside
- Walls keep you on the road

## How the drawing becomes a track
`tools/trace_track.gd` finds the middle of the road between Sam's two lines
and the start line across it, and writes `tracks/track_1.json` (96 points,
metres, race order, point 0 on the line). Re-run it for a new drawing:
```bash
Godot --headless --script res://tools/trace_track.gd -- "$PWD/tracks/drawings/track_1.jpg" "$PWD/tracks/track_1.json" "$PWD/captures/trace_track_1.png" 2000
```
The preview PNG shows the traced line over the drawing (red end = start).

## Numbers
- Lap 2000 m; road 24 m wide; walls 1.2 m high on both edges.
- 3 laps. At top speed a lap is about 45-50 s.
- A lap counts only after passing checkpoints at 1/4, 1/2 and 3/4 of the way
  round (`scripts/lap_counter.gd`).
- Buildings: one seeded row outside the outer wall (`scripts/building_rules.gd`).

## Not in this phase
Racers (Phase 4), power-ups (Phase 5), a timer or results screen (Phase 4).
After 3 laps the screen says "Finished!" and you can keep driving.
