extends Node
## Every control in the game, for the Xbox controller and the keyboard.
## An autoload (a script Godot starts automatically, before any scene), so
## the controls exist everywhere. Registered in code rather than in Project
## Settings so the whole table is readable in one place, and testable.
##
## Keys use PHYSICAL positions, so WASD stays WASD on any keyboard layout.

const STICK_DEADZONE: float = 0.2

## action -> { keys: [...], axes: [[axis, direction], ...], buttons: [...] }
const ACTIONS: Dictionary = {
	"accelerate": {"keys": [KEY_W, KEY_UP], "axes": [[JOY_AXIS_TRIGGER_RIGHT, 1.0]], "buttons": []},
	"brake": {"keys": [KEY_S, KEY_DOWN], "axes": [[JOY_AXIS_TRIGGER_LEFT, 1.0]], "buttons": []},
	"steer_left": {"keys": [KEY_A, KEY_LEFT], "axes": [[JOY_AXIS_LEFT_X, -1.0]], "buttons": []},
	"steer_right": {"keys": [KEY_D, KEY_RIGHT], "axes": [[JOY_AXIS_LEFT_X, 1.0]], "buttons": []},
}

func _ready() -> void:
	install()

## Safe to call more than once: each action is rebuilt from the table.
static func install() -> void:
	for action: String in ACTIONS:
		if InputMap.has_action(action):
			InputMap.erase_action(action)
		InputMap.add_action(action, STICK_DEADZONE)
		var spec: Dictionary = ACTIONS[action]
		for key: int in spec["keys"]:
			var k := InputEventKey.new()
			k.physical_keycode = key as Key
			InputMap.action_add_event(action, k)
		for pair: Array in spec["axes"]:
			var m := InputEventJoypadMotion.new()
			m.device = -1   # any controller
			m.axis = pair[0] as JoyAxis
			m.axis_value = pair[1]
			InputMap.action_add_event(action, m)
		for button: int in spec["buttons"]:
			var b := InputEventJoypadButton.new()
			b.device = -1
			b.button_index = button as JoyButton
			InputMap.action_add_event(action, b)
