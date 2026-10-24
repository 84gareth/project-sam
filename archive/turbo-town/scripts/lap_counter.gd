extends RefCounted
## Counts laps from how far round the track a car is (0..1, where 0 is the
## start line). A lap only counts if the car passed every checkpoint on the
## way round, so crossing the line backwards, or wiggling over it, never
## counts. Pure logic: feed it progress each tick.

const CHECKPOINTS: Array[float] = [0.25, 0.5, 0.75]
const CHECKPOINT_WINDOW: float = 0.05   ## counts if within this of one

var total_laps: int
var laps_done: int = 0
## True once the car has crossed the start line for the first time (cars
## start on the grid just behind it).
var crossed_start: bool = false
var _last: float = -1.0
var _passed: Array[bool] = [false, false, false]

func _init(laps: int = 3) -> void:
	total_laps = laps

func finished() -> bool:
	return laps_done >= total_laps

## The lap the car is on, 1-based, never past the last one.
func current_lap() -> int:
	return mini(laps_done + 1, total_laps)

## How far the car has raced, in laps (1.5 = halfway round lap 2). Negative
## on the grid behind the line, so grid order is right before the start.
func distance() -> float:
	var p: float = maxf(_last, 0.0)
	if not crossed_start:
		return p - 1.0 if p > 0.5 else p
	return laps_done + p

## Returns true on the tick a lap is completed.
func update(progress: float) -> bool:
	for i in CHECKPOINTS.size():
		if absf(progress - CHECKPOINTS[i]) < CHECKPOINT_WINDOW:
			_passed[i] = true
	var lap_done: bool = false
	if _last >= 0.0:
		if _last > 0.9 and progress < 0.1:        # crossed the line forwards
			crossed_start = true
			if not _passed.has(false) and not finished():
				laps_done += 1
				lap_done = true
			_passed = [false, false, false]
		elif _last < 0.1 and progress > 0.9:      # crossed it backwards
			_passed = [false, false, false]
	_last = progress
	return lap_done
