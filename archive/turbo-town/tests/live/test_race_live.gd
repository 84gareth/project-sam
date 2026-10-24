extends "res://tests/framework/live_case.gd"
## The race on Sam's track: the grid, 3-2-1-GO, the purple racers driving
## round, the walls, laps up to "Finished!", places and results.

var _race: Node
var _car: CharacterBody3D
var _track: Node3D

## Most tests skip the countdown; the countdown test keeps it.
func _start(countdown: float = 0.0) -> void:
	_race = load("res://scenes/race.tscn").instantiate()
	_race.countdown = countdown
	add_child(_race)
	_car = _race.get_node("%Car")
	_track = _race.get_node("Track")
	await until(func(): return _car.is_on_floor(), "car settles on the ground")

func after_each() -> void:
	for action: String in ["accelerate", "brake", "steer_left", "steer_right"]:
		Input.action_release(action)
	if is_instance_valid(_race):
		_race.queue_free()

func _text(label: String) -> String:
	return _race.get_node("%" + label).text

func _flat(n: Node3D) -> Vector2:
	return Vector2(n.global_position.x, n.global_position.z)

func test_sam_starts_at_the_back_facing_up_the_track() -> void:
	await _start()
	var f: float = _track.progress_fraction(_car.global_position)
	assert_gt(f, 0.95, "behind the start line (progress %.3f)" % f)
	var along: Vector2 = _track.path.direction_at(0.0)
	var facing := Vector2(-_car.global_basis.z.x, -_car.global_basis.z.z)
	assert_gt(facing.dot(along), 0.95, "facing the way round")
	assert_eq(_text("LapLabel"), "Lap 1 / 3")
	var ahead: int = 0
	for r: Dictionary in _race.racers:
		if r["name"] != "You" and _track.progress_fraction(r["car"].global_position) > f + 0.001:
			ahead += 1
	assert_eq(ahead, 4, "all four racers in front")

func test_four_purple_racers_with_silly_names() -> void:
	await _start()
	var names: Array[String] = []
	for r: Dictionary in _race.racers:
		names.append(r["name"])
		if r["name"] != "You":
			var body: MeshInstance3D = r["car"].get_node("Visual/Body")
			assert_eq(body.material_override.albedo_color, _race.PURPLE, r["name"] + " is purple")
	assert_eq(names, ["You", "Zoomy", "Bumper", "Wobble", "Turbo Tim"] as Array[String])

func test_everyone_waits_for_go() -> void:
	await _start(3.0)
	Input.action_press("accelerate")
	await seconds(1.0)
	assert_true(_text("CountdownLabel") in ["3", "2"], "counting down (%s)" % _text("CountdownLabel"))
	assert_eq(_car.speed, 0.0, "Sam's car waits")
	assert_eq(_race.racers[1]["car"].speed, 0.0, "the racers wait too")
	await until(func(): return _text("CountdownLabel") == "GO!", "GO!", 4.0)
	await until(func(): return _car.speed > 5.0, "then Sam's car goes")

func test_racers_drive_round_and_stay_on_the_road() -> void:
	await _start()
	var starts: Array[float] = []
	for r: Dictionary in _race.racers:
		starts.append(r["counter"].distance())
	var worst: Array[float] = [0.0]
	var t0: int = Time.get_ticks_msec()
	await until(func():
		for r: Dictionary in _race.racers.slice(1):
			worst[0] = maxf(worst[0], _track.path.distance_from_centre(_flat(r["car"])))
		return Time.get_ticks_msec() - t0 > 5000, "5 s of racing", 8.0)
	for i in range(1, _race.racers.size()):
		var r: Dictionary = _race.racers[i]
		assert_gt(r["counter"].distance() - starts[i], 0.05, r["name"] + " got 100 m+ round")
	assert_lt(worst[0], _track.road_width / 2.0, "all stayed on the road (widest %.1f m)" % worst[0])

func test_walls_keep_the_car_on_the_road() -> void:
	await _start()
	Input.action_press("accelerate")
	Input.action_press("steer_right")
	var worst: Array[float] = [0.0]
	var half: float = _track.road_width / 2.0
	var t0: int = Time.get_ticks_msec()
	await until(func():
		worst[0] = maxf(worst[0], _track.path.distance_from_centre(_flat(_car)))
		return Time.get_ticks_msec() - t0 > 4000, "4 s of steering into the walls", 8.0)
	assert_lt(worst[0], half, "never left the road (furthest %.1f m, road half-width %.1f m)" % [worst[0], half])

func test_place_shows_under_the_lap() -> void:
	await _start()
	await frames(2)
	assert_eq(_text("PlaceLabel"), _race.RaceRules.ordinal(_race.player_place()))
	assert_gt(_race.player_place(), 4, "starting at the back")

func test_three_laps_then_finished_and_results() -> void:
	await _start()
	# Carry Sam's car round the centre line (driving it for real would take
	# minutes); the race's own lap counting does the rest.
	var path: RefCounted = _track.path
	var d: float = path.length - 32.0
	var seen: Array[String] = []
	while d < path.length * 4.0 + 100.0:   # grid, then over the line 3 times
		var p: Vector2 = path.point_at(d)
		_car.global_position = Vector3(p.x, 0.2, p.y)
		await get_tree().physics_frame
		if not seen.has(_text("LapLabel")):
			seen.append(_text("LapLabel"))
		d += 40.0
	assert_eq(seen, ["Lap 1 / 3", "Lap 2 / 3", "Lap 3 / 3", "Finished!"] as Array[String])
	assert_true(_race.get_node("%Results").visible, "results showing")
	var lines: PackedStringArray = _text("ResultsList").split("\n")
	assert_eq(lines.size(), 5, "all five places")
	assert_eq(lines[0], "1st   You", "carried round that fast, Sam wins")
