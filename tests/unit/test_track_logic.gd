extends "res://tests/framework/test_case.gd"
## Track path maths, lap counting and building placement.

const TrackPath = preload("res://scripts/track_path.gd")
const LapCounter = preload("res://scripts/lap_counter.gd")
const BuildingRules = preload("res://scripts/building_rules.gd")

## A circle of radius 100, anticlockwise, starting at (100, 0).
func _circle() -> RefCounted:
	var pts := PackedVector2Array()
	for i in 64:
		var a: float = TAU * i / 64.0
		pts.append(Vector2(cos(a), sin(a)) * 100.0)
	return TrackPath.new(pts)

# ─── Track path ──────────────────────────────────────────────────────────────

func test_length_is_about_the_circumference() -> void:
	assert_almost_eq(_circle().length, TAU * 100.0, 2.0)

func test_point_at_wraps_round() -> void:
	var t: RefCounted = _circle()
	assert_almost_eq(t.point_at(0.0).distance_to(Vector2(100, 0)), 0.0, 0.01)
	assert_almost_eq(t.point_at(t.length).distance_to(Vector2(100, 0)), 0.0, 0.01, "one lap on")
	assert_almost_eq(t.point_at(-t.length / 2.0).distance_to(Vector2(-100, 0)), 0.0, 1.0, "negative")

func test_progress_of_a_point_off_the_line() -> void:
	var t: RefCounted = _circle()
	# A quarter of the way round is (0, 100); a point 5 m outside it.
	assert_almost_eq(t.progress_of(Vector2(0, 105)), t.length / 4.0, 1.0)
	assert_almost_eq(t.distance_from_centre(Vector2(0, 105)), 5.0, 0.2)

func test_direction_follows_the_loop() -> void:
	var t: RefCounted = _circle()
	assert_gt(t.direction_at(1.0).y, 0.99, "starts heading +y (anticlockwise)")

func test_outward_points_away_from_the_middle() -> void:
	var t: RefCounted = _circle()
	for d: float in [0.0, 100.0, 300.0, 500.0]:
		assert_gt(t.outward_at(d).dot(t.point_at(d).normalized()), 0.99, "at %s m" % d)

func test_sams_track_loads_and_starts_heading_up_the_page() -> void:
	var t: RefCounted = TrackPath.load_json("res://tracks/track_1.json")
	assert_gt(t.points.size(), 50)
	assert_almost_eq(t.length, 2000.0, 20.0)
	assert_lt(t.direction_at(1.0).y, -0.9, "up the page is -z")

# ─── Laps ────────────────────────────────────────────────────────────────────

## Drive round: progress steps from `from` for `laps` laps, 200 steps a lap.
func _drive(c: RefCounted, from: float, laps: float) -> int:
	var done: int = 0
	for i in int(laps * 200):
		if c.update(fposmod(from + i / 200.0, 1.0)):
			done += 1
	return done

func test_a_full_lap_counts_once() -> void:
	var c: RefCounted = LapCounter.new(3)
	assert_eq(c.current_lap(), 1)
	assert_eq(_drive(c, 0.02, 1.0), 1)
	assert_eq(c.current_lap(), 2)

func test_starting_behind_the_line_does_not_count_a_lap() -> void:
	var c: RefCounted = LapCounter.new(3)
	c.update(0.99)
	c.update(0.01)
	assert_eq(c.laps_done, 0)

func test_three_laps_finish_the_race_and_no_more_count() -> void:
	var c: RefCounted = LapCounter.new(3)
	_drive(c, 0.02, 4.0)
	assert_true(c.finished())
	assert_eq(c.laps_done, 3)
	assert_eq(c.current_lap(), 3)

func test_backwards_over_the_line_and_back_does_not_count() -> void:
	var c: RefCounted = LapCounter.new(3)
	_drive(c, 0.02, 0.95)   # nearly a lap: all checkpoints passed
	c.update(0.98)
	c.update(0.02)          # over the line: that's lap 1
	assert_eq(c.laps_done, 1)
	c.update(0.98)          # back over it...
	c.update(0.02)          # ...and forward again
	assert_eq(c.laps_done, 1, "a wiggle over the line is not a lap")

func test_skipping_a_checkpoint_does_not_count() -> void:
	var c: RefCounted = LapCounter.new(3)
	c.update(0.1)
	c.update(0.25)
	c.update(0.75)          # skipped 0.5
	c.update(0.95)
	c.update(0.02)
	assert_eq(c.laps_done, 0)

# ─── Buildings ───────────────────────────────────────────────────────────────

func test_buildings_line_the_outside_and_never_touch_the_road() -> void:
	var t: RefCounted = TrackPath.load_json("res://tracks/track_1.json")
	var clear: float = 14.0
	var list: Array[Dictionary] = BuildingRules.place(t, clear, 1)
	assert_gt(list.size(), 20, "a proper row of them")
	var c: Vector2 = t.centroid()
	for b in list:
		for corner in BuildingRules.corners(b):
			assert_gt(t.distance_from_centre(corner), clear, "corner clear of road")
		var p: Vector2 = t.point_at(t.progress_of(b["center"]))
		assert_gt(b["center"].distance_to(c), p.distance_to(c), "outside the loop, not the middle")

func test_the_same_seed_gives_the_same_city() -> void:
	var t: RefCounted = TrackPath.load_json("res://tracks/track_1.json")
	var a: Array[Dictionary] = BuildingRules.place(t, 14.0, 7)
	var b: Array[Dictionary] = BuildingRules.place(t, 14.0, 7)
	assert_eq(a.size(), b.size())
	assert_eq(a[0]["center"], b[0]["center"])
