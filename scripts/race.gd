extends Node3D
## A race on Sam's track: the car starts behind the line, and the lap
## counter follows how far round it is. 3 laps, then "Finished!".

const LapCounter = preload("res://scripts/lap_counter.gd")

@export var laps: int = 3

@onready var _track: Node3D = $Track
@onready var _car: CharacterBody3D = %Car
@onready var _hud: CanvasLayer = $HUD

var lap_counter: RefCounted

func _ready() -> void:
	_car.global_transform = _track.start_transform()
	# The camera snapped to the car before it moved to the start (children
	# are ready before their parent), so snap it again.
	%ChaseCamera.snap()
	lap_counter = LapCounter.new(laps)
	_show()

func _physics_process(_delta: float) -> void:
	if lap_counter.update(_track.progress_fraction(_car.global_position)):
		_show()

func _show() -> void:
	if lap_counter.finished():
		_hud.show_lap("Finished!")
	else:
		_hud.show_lap("Lap %d / %d" % [lap_counter.current_lap(), laps])
