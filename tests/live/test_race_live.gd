extends "res://tests/framework/live_case.gd"
## The race on Sam's track: the car starts behind the line facing the right
## way, the walls keep it on the road, and laps count up to "Finished!".

var _race: Node
var _car: CharacterBody3D
var _track: Node3D

func before_each() -> void:
	_race = load("res://scenes/race.tscn").instantiate()
	add_child(_race)
	_car = _race.get_node("%Car")
	_track = _race.get_node("Track")
	await until(func(): return _car.is_on_floor(), "car settles on the ground")

func after_each() -> void:
	for action: String in ["accelerate", "brake", "steer_left", "steer_right"]:
		Input.action_release(action)
	if is_instance_valid(_race):
		_race.queue_free()

func _lap_text() -> String:
	return _race.get_node("%LapLabel").text

func test_car_starts_just_behind_the_line_facing_up_the_track() -> void:
	var f: float = _track.progress_fraction(_car.global_position)
	assert_gt(f, 0.99, "just behind the start line (progress %.3f)" % f)
	var along: Vector2 = _track.path.direction_at(0.0)
	var facing := Vector2(-_car.global_basis.z.x, -_car.global_basis.z.z)
	assert_gt(facing.dot(along), 0.95, "facing the way round")
	assert_eq(_lap_text(), "Lap 1 / 3")

func test_walls_keep_the_car_on_the_road() -> void:
	Input.action_press("accelerate")
	Input.action_press("steer_right")
	var worst: Array[float] = [0.0]
	var half: float = _track.road_width / 2.0
	var t0: int = Time.get_ticks_msec()
	await until(func():
		worst[0] = maxf(worst[0], _track.path.distance_from_centre(
				Vector2(_car.global_position.x, _car.global_position.z)))
		return Time.get_ticks_msec() - t0 > 4000, "4 s of steering into the walls", 8.0)
	assert_lt(worst[0], half, "never left the road (furthest %.1f m, road half-width %.1f m)" % [worst[0], half])

func test_three_laps_then_finished() -> void:
	# Carry the car round the centre line (driving it for real would take
	# minutes); the race's own lap counter does the rest.
	var path: RefCounted = _track.path
	var d: float = path.length - 8.0
	var seen: Array[String] = []
	while d < path.length * 4.0 + 100.0:   # start, then over the line 3 times
		var p: Vector2 = path.point_at(d)
		_car.global_position = Vector3(p.x, 0.2, p.y)
		await get_tree().physics_frame
		if not seen.has(_lap_text()):
			seen.append(_lap_text())
		d += 40.0
	assert_eq(seen, ["Lap 1 / 3", "Lap 2 / 3", "Lap 3 / 3", "Finished!"] as Array[String])
