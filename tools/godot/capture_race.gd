extends Node
## Windowed look-check for the race: the start, driving up the first
## straight, the tight bottom bend close up, and the whole track from above.
##   Godot --path . --always-on-top res://tools/godot/capture_race.tscn

var _race: Node
var _car: CharacterBody3D
var _cam: Camera3D
var _t: float = 0.0
var _step: int = 0

func _ready() -> void:
	_race = load("res://scenes/race.tscn").instantiate()
	add_child(_race)
	_car = _race.get_node("%Car")
	_cam = _race.get_node("%ChaseCamera")

func _process(delta: float) -> void:
	_t += delta
	match _step:
		0:
			if _t > 0.6:
				_shot("race_start")
				Input.action_press("accelerate")
				_next()
		1:
			if _t > 2.5:
				_shot("race_driving")
				Input.action_release("accelerate")
				# The bend at the bottom of Sam's drawing: the lowest point.
				var path: RefCounted = _race.get_node("Track").path
				var best: float = 0.0
				for i in 200:
					var d: float = path.length * i / 200.0
					if path.point_at(d).y > path.point_at(best).y:
						best = d
				_car.global_transform = Transform3D(
						Basis(Vector3.UP, atan2(-path.direction_at(best - 30).x, -path.direction_at(best - 30).y)),
						Vector3(path.point_at(best - 30).x, 0.2, path.point_at(best - 30).y))
				_cam.snap()
				_next()
		2:
			if _t > 0.5:
				_shot("race_bend")
				_cam.set_physics_process(false)
				_cam.global_position = Vector3(0, 1100, 1)
				_cam.look_at(Vector3.ZERO)
				_next()
		3:
			if _t > 0.3:
				_shot("race_overview")
				get_tree().quit()

func _next() -> void:
	_step += 1
	_t = 0.0

func _shot(tag: String) -> void:
	get_viewport().get_texture().get_image().save_png(
			ProjectSettings.globalize_path("res://captures/%s.png" % tag))
