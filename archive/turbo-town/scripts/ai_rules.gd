extends RefCounted
## How a computer racer drives: pure maths, so a whole lap can be simulated
## in a unit test. The race asks drive() every physics tick and hands the
## answer to the car as its pedals and steering.
##
## The driver aims at a point a little way ahead on the track, in its own
## lane, steers towards it, and eases off when that point is far round a
## bend. `skill` (0..1) caps its speed as a share of the car's top speed.

const CarRules = preload("res://scripts/car_rules.gd")

const LOOKAHEAD: float = 20.0          ## metres ahead, plus...
const LOOKAHEAD_PER_SPEED: float = 0.5 ## ...this many metres per m/s
const STEER_GAIN: float = 2.5          ## full lock at ~23 degrees off
const EASE_ANGLE: float = 0.35         ## radians off: lift off the throttle
const BRAKE_ANGLE: float = 0.7         ## radians off: brake

## pos: car position on the flat (x, z). forward: unit facing (x, z).
## Returns {"throttle": 0..1, "brake": 0..1, "steer": -1..1 (+ = left)}.
static func drive(path: RefCounted, pos: Vector2, forward: Vector2, speed: float,
		lane: float, skill: float) -> Dictionary:
	var d: float = path.progress_of(pos)
	var ahead: float = d + LOOKAHEAD + maxf(speed, 0.0) * LOOKAHEAD_PER_SPEED
	var dir: Vector2 = path.direction_at(ahead)
	var target: Vector2 = path.point_at(ahead) + Vector2(-dir.y, dir.x) * lane
	var off: float = signed_angle(forward, (target - pos).normalized())
	var steer: float = clampf(off * STEER_GAIN, -1.0, 1.0)

	var throttle: float = 1.0
	var brake: float = 0.0
	if absf(off) > BRAKE_ANGLE and speed > CarRules.FULL_TURN_SPEED * 2.0:
		throttle = 0.0
		brake = 0.6
	elif absf(off) > EASE_ANGLE:
		throttle = 0.4
	if speed > CarRules.MAX_SPEED * skill:
		throttle = 0.0
	return {"throttle": throttle, "brake": brake, "steer": steer}

## The angle to turn `from` into `to`, positive = LEFT, matching the car's
## rotate_y (Godot turns -Z towards -X for a positive angle).
static func signed_angle(from: Vector2, to: Vector2) -> float:
	return atan2(-(from.x * to.y - from.y * to.x), from.dot(to))

## One flat-ground tick of a car, the same maths car.gd does, for simulating
## laps without physics. Returns {pos, yaw, speed}.
static func sim_step(pos: Vector2, yaw: float, speed: float, inputs: Dictionary,
		delta: float) -> Dictionary:
	speed = CarRules.step_speed(speed, inputs["throttle"], inputs["brake"], delta)
	yaw += CarRules.turn_rate(speed, inputs["steer"]) * delta
	var forward := Vector2(-sin(yaw), -cos(yaw))
	return {"pos": pos + forward * speed * delta, "yaw": yaw, "speed": speed}
