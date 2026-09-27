extends "res://tests/framework/live_case.gd"
## The first drive in the real scene: the car goes, steers, answers the Xbox
## trigger, flies off the ramp ahead and lands, with the camera behind it.

var _main: Node
var _car: CharacterBody3D

func before_each() -> void:
	_main = load("res://scenes/test_drive.tscn").instantiate()
	add_child(_main)
	_car = _main.get_node("%Car")
	await until(func(): return _car.is_on_floor(), "car settles on the ground")

func after_each() -> void:
	for action: String in ["accelerate", "brake", "steer_left", "steer_right"]:
		Input.action_release(action)
	_trigger(0.0)
	if is_instance_valid(_main):
		_main.queue_free()

func _trigger(value: float) -> void:
	var e := InputEventJoypadMotion.new()
	e.device = 0
	e.axis = JOY_AXIS_TRIGGER_RIGHT
	e.axis_value = value
	Input.parse_input_event(e)

func test_holding_go_drives_forward() -> void:
	var start_z: float = _car.global_position.z
	Input.action_press("accelerate")
	await until(func(): return _car.global_position.z < start_z - 5.0, "car moves 5 m forward (-Z)")
	assert_almost_eq(_car.global_position.x, 0.0, 0.1, "straight, no drift")

func test_steering_left_turns_left() -> void:
	Input.action_press("accelerate")
	Input.action_press("steer_left")
	await until(func(): return _car.rotation.y > 0.5, "car turns left", 2.0)
	# Facing -Z, a left turn heads towards -X. (Checked because a car turning
	# the WRONG way spins round and its angle wraps past 0.5 too.)
	assert_lt(_car.global_position.x, -0.1, "went left, not right")
	Input.action_release("steer_left")
	Input.action_press("steer_right")
	await until(func(): return _car.rotation.y < 0.0, "and back right")

func test_xbox_right_trigger_drives() -> void:
	_trigger(1.0)
	await frames(1)
	assert_gt(Input.get_action_strength("accelerate"), 0.9, "RT counts as Go")
	await until(func(): return _car.speed > 5.0, "car speeds up on RT")

func test_car_flies_off_the_ramp_and_lands() -> void:
	Input.action_press("accelerate")
	# The ramp top is 3 m up. A car that only drives over the edge peaks at
	# 3 m; one that LAUNCHES (moves along the slope) goes clearly higher.
	var peak: Array[float] = [0.0]
	await until(func():
		peak[0] = maxf(peak[0], _car.global_position.y)
		return peak[0] > 3.0 and _car.is_on_floor() and _car.global_position.y < 0.5,
		"car flies off the ramp and lands", 6.0)
	assert_gt(peak[0], 3.4, "launched above the ramp top (peak %.2f m)" % peak[0])
	assert_lt(_car.global_position.z, 16.0, "landed beyond the ramp")
	assert_gt(_car.speed, 5.0, "still moving after landing")

func test_camera_stays_behind_the_car() -> void:
	var cam: Camera3D = _main.get_node("%ChaseCamera")
	Input.action_press("accelerate")
	Input.action_press("steer_left")
	await seconds(1.5)
	var offset: Vector3 = cam.global_position - _car.global_position
	var forward: Vector3 = -_car.global_basis.z
	assert_lt(offset.dot(forward), 0.0, "camera is behind, not in front")
	assert_gt(offset.y, 1.0, "camera is above the car")
	assert_lt(offset.length(), 12.0, "camera keeps up")
