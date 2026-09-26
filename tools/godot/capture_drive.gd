extends Node
## Windowed look-check for the first drive. Drives at the ramp ahead and
## saves screenshots to captures/: at the start, on the ramp, in the air, and
## after landing. Headless can't render, so this opens a real window.
##   Godot --path . --always-on-top res://tools/godot/capture_drive.tscn

var _main: Node
var _car: CharacterBody3D
var _shots: Dictionary = {}
var _t: float = 0.0
var _was_airborne: bool = false

func _ready() -> void:
	_main = load("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_car = _main.get_node("%Car")

func _process(delta: float) -> void:
	_t += delta
	if _t > 0.6:
		Input.action_press("accelerate")
	if _t > 0.5 and not _shots.has("start"):
		_shot("start")
	if _car.global_position.y > 1.5 and _car.is_on_floor() and not _shots.has("ramp"):
		_shot("ramp")
	if not _car.is_on_floor() and _car.global_position.y > 3.3:
		_was_airborne = true
		if not _shots.has("air"):
			_shot("air")
	if _was_airborne and _car.is_on_floor() and not _shots.has("landed"):
		_shot("landed")
	if _shots.size() == 4 or _t > 8.0:
		print("fps %d, shots: %s" % [Engine.get_frames_per_second(), _shots.keys()])
		get_tree().quit()

func _shot(tag: String) -> void:
	var img: Image = get_viewport().get_texture().get_image()
	var path: String = ProjectSettings.globalize_path("res://captures/drive_%s.png" % tag)
	img.save_png(path)
	_shots[tag] = path
