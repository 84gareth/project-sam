extends "res://tests/framework/test_case.gd"
## The arcade handling rules in scripts/car_rules.gd.

const R = preload("res://scripts/car_rules.gd")
const DT: float = 1.0 / 60.0

func _run(speed: float, throttle: float, brake: float, seconds: float) -> float:
	for i in int(seconds / DT):
		speed = R.step_speed(speed, throttle, brake, DT)
	return speed

func test_throttle_speeds_up_to_top_speed_and_no_further() -> void:
	assert_gt(_run(0.0, 1.0, 0.0, 0.5), 0.0, "moving after half a second")
	assert_almost_eq(_run(0.0, 1.0, 0.0, 10.0), R.MAX_SPEED, 0.001, "capped")

func test_top_speed_takes_about_one_and_a_half_seconds() -> void:
	assert_lt(_run(0.0, 1.0, 0.0, 1.0), R.MAX_SPEED, "not there after 1 s")
	assert_almost_eq(_run(0.0, 1.0, 0.0, 2.0), R.MAX_SPEED, 0.001, "there by 2 s")

func test_half_trigger_is_gentler_than_full() -> void:
	assert_lt(_run(0.0, 0.5, 0.0, 0.5), _run(0.0, 1.0, 0.0, 0.5))

func test_no_pedals_coasts_to_a_stop_not_backwards() -> void:
	assert_eq(_run(10.0, 0.0, 0.0, 10.0), 0.0)
	assert_eq(_run(-5.0, 0.0, 0.0, 10.0), 0.0)

func test_brake_stops_then_reverses_up_to_the_limit() -> void:
	assert_eq(R.step_speed(0.2, 0.0, 1.0, DT), 0.0, "a brake never jumps straight into reverse")
	assert_lt(_run(10.0, 0.0, 1.0, 1.0), 0.0, "held brake ends up reversing")
	assert_almost_eq(_run(10.0, 0.0, 1.0, 10.0), -R.MAX_REVERSE, 0.001, "reverse capped")

func test_throttle_while_reversing_stops_first() -> void:
	assert_eq(R.step_speed(-0.2, 1.0, 0.0, DT), 0.0)

func test_a_stopped_car_cannot_turn() -> void:
	assert_eq(R.turn_rate(0.0, 1.0), 0.0)

func test_steering_left_turns_left_and_right_turns_right() -> void:
	assert_gt(R.turn_rate(10.0, 1.0), 0.0)
	assert_lt(R.turn_rate(10.0, -1.0), 0.0)

func test_reversing_steers_the_other_way() -> void:
	assert_lt(R.turn_rate(-5.0, 1.0), 0.0)

func test_steering_eases_off_at_top_speed() -> void:
	assert_lt(R.turn_rate(R.MAX_SPEED, 1.0), R.turn_rate(R.FULL_TURN_SPEED, 1.0))
	assert_gt(R.turn_rate(R.MAX_SPEED, 1.0), 0.0, "but can still turn")
