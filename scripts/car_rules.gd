extends RefCounted
## Arcade car handling as pure maths, so it can be unit-tested without a
## scene. car.gd asks these functions what to do each physics tick.
## Tune the feel here; docs/first-drive-spec.md says what each number is for.

const MAX_SPEED: float = 34.0        ## metres per second, forwards
const ACCEL: float = 24.0            ## speed gained per second on full throttle
const BRAKE: float = 32.0            ## speed lost per second on full brake
const REVERSE_ACCEL: float = 10.0
const MAX_REVERSE: float = 8.0
const COAST: float = 5.0             ## speed lost per second with no pedals
const TURN_RATE: float = 2.4         ## radians per second at full lock
const FULL_TURN_SPEED: float = 6.0   ## below this, steering is weaker
const TOP_SPEED_TURN: float = 0.6    ## share of steering left at top speed
const AIR_GRAVITY: float = 25.0      ## stronger than real, for snappy jumps

## The new speed after one tick. throttle and brake are 0..1 (triggers are
## analogue). Holding brake stops the car, then reverses it.
static func step_speed(speed: float, throttle: float, brake: float, delta: float) -> float:
	var push: float = throttle - brake
	if push > 0.0:
		if speed < 0.0:
			return move_toward(speed, 0.0, BRAKE * push * delta)
		return minf(speed + ACCEL * push * delta, MAX_SPEED)
	if push < 0.0:
		if speed > 0.0:
			return maxf(speed + BRAKE * push * delta, 0.0)
		return maxf(speed + REVERSE_ACCEL * push * delta, -MAX_REVERSE)
	return move_toward(speed, 0.0, COAST * delta)

## How fast the car turns (radians per second, positive = left). steer is
## -1 (right) .. 1 (left). A stopped car can't turn; reversing steers the
## other way, like a real car.
static func turn_rate(speed: float, steer: float) -> float:
	var grip: float = clampf(absf(speed) / FULL_TURN_SPEED, 0.0, 1.0)
	var fade: float = lerpf(1.0, TOP_SPEED_TURN, clampf(absf(speed) / MAX_SPEED, 0.0, 1.0))
	var direction: float = 1.0 if speed >= 0.0 else -1.0
	return steer * TURN_RATE * grip * fade * direction
