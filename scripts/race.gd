extends Node3D
## A race on Sam's track: Sam against five purple computer racers.
## 3, 2, 1, GO!, then 3 laps. Places show under the lap counter, and a
## results panel appears when Sam finishes. A / Enter / Space races again.
## (Sam's choices: docs/racers-spec.md.)

const LapCounter = preload("res://scripts/lap_counter.gd")
const AiRules = preload("res://scripts/ai_rules.gd")
const RaceRules = preload("res://scripts/race_rules.gd")
const CarScene = preload("res://scenes/car.tscn")

const PURPLE: Color = Color(0.55, 0.25, 0.85)
const PLAYER_SLOT: int = 4     ## back row, left: Sam overtakes
## Name, grid slot, lane (metres left of the middle), skill (share of top speed).
const RIVALS: Array[Dictionary] = [
	{"name": "Zoomy", "slot": 0, "lane": -1.5, "skill": 0.95},
	{"name": "Bumper", "slot": 1, "lane": 3.0, "skill": 0.90},
	{"name": "Wobble", "slot": 2, "lane": 4.5, "skill": 0.88},
	{"name": "Turbo Tim", "slot": 3, "lane": -4.5, "skill": 0.93},
	{"name": "Speedy", "slot": 5, "lane": 0.0, "skill": 0.92},
]

@export var laps: int = 3
## Seconds of 3-2-1 before GO. Tests set 0 to skip it.
@export var countdown: float = 3.0

@onready var _track: Node3D = $Track
@onready var _hud: CanvasLayer = $HUD

## One entry per car, Sam first: {car, name, counter, finish, lane, skill}.
var racers: Array[Dictionary] = []
var _count_left: float = 0.0
var _go_shown_for: float = -1.0
var _next_place: int = 1

func _ready() -> void:
	var player: CharacterBody3D = %Car
	player.global_transform = _track.grid_transform(PLAYER_SLOT)
	racers.append({"car": player, "name": "You", "counter": LapCounter.new(laps),
			"finish": 0, "lane": 0.0, "skill": 1.0})
	for r: Dictionary in RIVALS:
		var car: CharacterBody3D = CarScene.instantiate()
		car.name = r["name"]
		car.driven_by_player = false
		car.paint = PURPLE
		add_child(car)
		car.global_transform = _track.grid_transform(r["slot"])
		racers.append({"car": car, "name": r["name"], "counter": LapCounter.new(laps),
				"finish": 0, "lane": r["lane"], "skill": r["skill"]})
	# The camera snapped to Sam's car before it moved to the grid (children
	# are ready before their parent), so snap it again.
	%ChaseCamera.snap()
	_count_left = countdown
	_set_can_drive(countdown <= 0.0)
	_hud.show_countdown("")
	_show_lap()

func _process(delta: float) -> void:
	if _count_left > 0.0:
		_count_left -= delta
		if _count_left > 0.0:
			_hud.show_countdown(str(ceili(_count_left)))
		else:
			_set_can_drive(true)
			_hud.show_countdown("GO!")
			_go_shown_for = 0.0
	elif _go_shown_for >= 0.0:
		_go_shown_for += delta
		if _go_shown_for > 1.0:
			_hud.show_countdown("")
			_go_shown_for = -1.0

func _physics_process(_delta: float) -> void:
	var path: RefCounted = _track.path
	for r: Dictionary in racers:
		var car: CharacterBody3D = r["car"]
		var pos := Vector2(car.global_position.x, car.global_position.z)
		if not car.driven_by_player:
			var fwd := Vector2(-car.global_basis.z.x, -car.global_basis.z.z).normalized()
			var inputs: Dictionary = AiRules.drive(path, pos, fwd, car.speed, r["lane"], r["skill"])
			car.throttle = inputs["throttle"]
			car.brake = inputs["brake"]
			car.steer = inputs["steer"]
		var counter: RefCounted = r["counter"]
		if counter.update(path.progress_of(pos) / path.length):
			if counter.finished() and r["finish"] == 0:
				r["finish"] = _next_place
				_next_place += 1
				if r["name"] == "You":
					_show_results()
			if r["name"] == "You":
				_show_lap()
	_hud.show_place(RaceRules.ordinal(player_place()))

func _unhandled_input(event: InputEvent) -> void:
	if _hud.results_showing() and event.is_action_pressed("ui_accept"):
		get_tree().reload_current_scene()

## Sam's place right now, 1 = winning.
func player_place() -> int:
	return _order().find(0) + 1

func _order() -> Array[int]:
	var entries: Array[Dictionary] = []
	for r: Dictionary in racers:
		entries.append({"finish": r["finish"], "distance": r["counter"].distance()})
	return RaceRules.order(entries)

func _set_can_drive(on: bool) -> void:
	for r: Dictionary in racers:
		r["car"].can_drive = on

func _show_lap() -> void:
	var counter: RefCounted = racers[0]["counter"]
	if counter.finished():
		_hud.show_lap("Finished!")
	else:
		_hud.show_lap("Lap %d / %d" % [counter.current_lap(), laps])

func _show_results() -> void:
	var lines: Array[String] = []
	var place: int = 1
	for i in _order():
		lines.append("%s   %s" % [RaceRules.ordinal(place), racers[i]["name"]])
		place += 1
	_hud.show_results(lines)
