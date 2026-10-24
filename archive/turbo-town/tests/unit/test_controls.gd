extends "res://tests/framework/test_case.gd"
## Every control works on both the keyboard and the Xbox controller.

const ControlMap = preload("res://scripts/controls.gd")

func before_each() -> void:
	ControlMap.install()

func _keys(action: String) -> Array[int]:
	var out: Array[int] = []
	for e in InputMap.action_get_events(action):
		if e is InputEventKey:
			out.append(int(e.physical_keycode))
	return out

func _xbox(action: String) -> Array[InputEvent]:
	var out: Array[InputEvent] = []
	for e in InputMap.action_get_events(action):
		if e is InputEventJoypadMotion or e is InputEventJoypadButton:
			out.append(e)
	return out

func test_every_control_has_a_key_and_an_xbox_input() -> void:
	for action: String in ControlMap.ACTIONS:
		assert_true(InputMap.has_action(action), action)
		assert_gt(_keys(action).size(), 0, action + " has a key")
		assert_gt(_xbox(action).size(), 0, action + " has an Xbox input")

func test_go_is_w_up_and_right_trigger() -> void:
	assert_eq(_keys("accelerate"), [KEY_W, KEY_UP] as Array[int])
	var rt: InputEventJoypadMotion = _xbox("accelerate")[0]
	assert_eq(rt.axis, JOY_AXIS_TRIGGER_RIGHT)

func test_steering_uses_both_sides_of_the_left_stick() -> void:
	var left: InputEventJoypadMotion = _xbox("steer_left")[0]
	var right: InputEventJoypadMotion = _xbox("steer_right")[0]
	assert_eq(left.axis, JOY_AXIS_LEFT_X)
	assert_eq(right.axis, JOY_AXIS_LEFT_X)
	assert_lt(left.axis_value, 0.0)
	assert_gt(right.axis_value, 0.0)

func test_installing_twice_does_not_double_up() -> void:
	var before: int = InputMap.action_get_events("accelerate").size()
	ControlMap.install()
	assert_eq(InputMap.action_get_events("accelerate").size(), before)
