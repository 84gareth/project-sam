# Phase 2 spec: first drive

Approved by Gareth 2026-09-26 (roadmap and controls in one go).

## What Sam gets
A red placeholder car on a big checkered test area with walls round the
edge and a few ramps. Drive, steer, fly off ramps. The camera follows from
behind.

## Controls
| Action | Xbox | Keyboard |
|---|---|---|
| Go | RT | W or Up |
| Brake, then reverse | LT | S or Down |
| Steer | Left stick | A/D or Left/Right |

Throw (A / Space) and pause (Menu / Esc) were agreed too but are added when
something uses them (throw in Phase 5; pause when it's on the roadmap).

## Handling (arcade, all numbers in `scripts/car_rules.gd`)
- Top speed 48 m/s, about 1.4 s to reach it. Sam asked twice: 24 -> 34 ("too slow!", v0.2.1) -> 48 ("even faster!", v0.2.2). Coasts to a stop.
- Holding brake stops the car, then reverses slowly (max 8 m/s).
- No turning when stopped; steering eases off a little at top speed;
  reversing steers the other way, like a real car.
- On a ramp the car moves along the slope, so it launches off the top.
  Gravity in the air is stronger than real (25 m/s^2) so jumps feel snappy.

## Tests
- Unit: speed and steering rules; every control has a key and an Xbox input.
- Live: holding Go drives forward; steering turns; the Xbox trigger drives;
  the car flies off a ramp and lands; the camera stays behind the car.
- Windowed capture of a ramp jump, checked by eye.
