extends "res://tests/framework/test_case.gd"
## Computer drivers, race places and race distance.

const TrackPath = preload("res://scripts/track_path.gd")
const AiRules = preload("res://scripts/ai_rules.gd")
const RaceRules = preload("res://scripts/race_rules.gd")
const LapCounter = preload("res://scripts/lap_counter.gd")
const CarRules = preload("res://scripts/car_rules.gd")

const DT: float = 1.0 / 60.0
const HALF_ROAD: float = 12.0
const CAR_HALF_WIDTH: float = 0.9

# ─── Steering direction ──────────────────────────────────────────────────────

func test_a_target_on_the_left_steers_left() -> void:
	var fwd := Vector2(0, -1)                     # facing -z
	assert_gt(AiRules.signed_angle(fwd, Vector2(-1, -1).normalized()), 0.0, "left")
	assert_lt(AiRules.signed_angle(fwd, Vector2(1, -1).normalized()), 0.0, "right")
	assert_almost_eq(AiRules.signed_angle(fwd, fwd), 0.0, 0.0001, "straight on")

func test_sim_step_matches_the_car_turning_left() -> void:
	var s: Dictionary = {"pos": Vector2.ZERO, "yaw": 0.0, "speed": 10.0}
	for i in 30:
		s = AiRules.sim_step(s["pos"], s["yaw"], s["speed"],
				{"throttle": 1.0, "brake": 0.0, "steer": 1.0}, DT)
	assert_lt(s["pos"].x, 0.0, "a left turn from facing -z drifts to -x")

# ─── A whole simulated lap of Sam's track ────────────────────────────────────

## Drive one AI from just behind the line until it has done a full lap past
## the line. Returns {"lap_time", "worst_off_centre"}.
func _sim_lap(lane: float, skill: float) -> Dictionary:
	var path: RefCounted = TrackPath.load_json("res://tracks/track_1.json")
	var d0: float = path.length - 8.0
	var dir: Vector2 = path.direction_at(d0)
	var s: Dictionary = {"pos": path.point_at(d0) + Vector2(-dir.y, dir.x) * lane,
			"yaw": atan2(-dir.x, -dir.y), "speed": 0.0}
	var counter: RefCounted = LapCounter.new(3)
	var t: float = 0.0
	var lap_start: float = -1.0
	var worst: float = 0.0
	while t < 150.0:
		var fwd := Vector2(-sin(s["yaw"]), -cos(s["yaw"]))
		var inputs: Dictionary = AiRules.drive(path, s["pos"], fwd, s["speed"], lane, skill)
		s = AiRules.sim_step(s["pos"], s["yaw"], s["speed"], inputs, DT)
		t += DT
		var was_started: bool = counter.crossed_start
		var lapped: bool = counter.update(path.progress_of(s["pos"]) / path.length)
		if counter.crossed_start and not was_started:
			lap_start = t
		if lap_start >= 0.0:
			worst = maxf(worst, path.distance_from_centre(s["pos"]))
		if lapped:
			return {"lap_time": t - lap_start, "worst_off_centre": worst}
	return {"lap_time": INF, "worst_off_centre": worst}

func test_ai_laps_take_42_to_60_seconds_and_stay_on_the_road() -> void:
	for lane: float in [-4.5, 0.0, 4.5]:
		for skill: float in [0.88, 0.95]:
			var r: Dictionary = _sim_lap(lane, skill)
			var tag: String = "lane %s, skill %s: lap %.1f s, widest %.1f m" % [lane, skill, r["lap_time"], r["worst_off_centre"]]
			assert_gt(r["lap_time"], 42.0, tag)
			assert_lt(r["lap_time"], 60.0, tag)
			assert_lt(r["worst_off_centre"], HALF_ROAD - CAR_HALF_WIDTH, tag)

func test_more_skill_means_a_faster_lap() -> void:
	assert_lt(_sim_lap(0.0, 0.96)["lap_time"], _sim_lap(0.0, 0.88)["lap_time"])

# ─── Places ──────────────────────────────────────────────────────────────────

func test_ordinals() -> void:
	assert_eq([RaceRules.ordinal(1), RaceRules.ordinal(2), RaceRules.ordinal(3),
			RaceRules.ordinal(4), RaceRules.ordinal(6), RaceRules.ordinal(11),
			RaceRules.ordinal(22)], ["1st", "2nd", "3rd", "4th", "6th", "11th", "22nd"])

func test_order_puts_finishers_first_then_furthest() -> void:
	var e: Array[Dictionary] = [
		{"finish": 0, "distance": 2.5},
		{"finish": 2, "distance": 3.0},
		{"finish": 0, "distance": 2.9},
		{"finish": 1, "distance": 3.0},
	]
	assert_eq(RaceRules.order(e), [3, 1, 2, 0] as Array[int])

func test_grid_cars_behind_the_line_are_behind_cars_over_it() -> void:
	var behind: RefCounted = LapCounter.new(3)
	behind.update(0.99)
	var over: RefCounted = LapCounter.new(3)
	over.update(0.99)
	over.update(0.01)
	assert_true(over.crossed_start)
	assert_gt(over.distance(), behind.distance())
	assert_lt(behind.distance(), 0.0, "on the grid counts as not started")

func test_distance_counts_whole_laps() -> void:
	var c: RefCounted = LapCounter.new(3)
	for i in 300:   # 1.5 laps from just after the line
		c.update(fposmod(0.02 + i / 200.0, 1.0))
	assert_almost_eq(c.distance(), 1.515, 0.01)
