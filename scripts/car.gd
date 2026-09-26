extends CharacterBody3D
## The player's car. A CharacterBody3D (moved by code, not pushed around by
## physics), so handling is predictable and testable. All the numbers live
## in car_rules.gd.
##
## On the ground the car moves ALONG the slope under it, so driving up a ramp
## gives it upward speed and it launches off the top. In the air it keeps
## that speed and falls.

const CarRules = preload("res://scripts/car_rules.gd")

## Off for computer cars later; they'll set the pedals themselves.
@export var driven_by_player: bool = true

## Forward speed in metres per second (negative = reversing).
var speed: float = 0.0

@onready var _visual: Node3D = $Visual

func _physics_process(delta: float) -> void:
	var throttle: float = 0.0
	var brake: float = 0.0
	var steer: float = 0.0
	if driven_by_player:
		throttle = Input.get_action_strength("accelerate")
		brake = Input.get_action_strength("brake")
		steer = Input.get_axis("steer_right", "steer_left")

	if is_on_floor():
		speed = CarRules.step_speed(speed, throttle, brake, delta)
		rotate_y(CarRules.turn_rate(speed, steer) * delta)
		var n: Vector3 = get_floor_normal()
		var forward: Vector3 = -global_basis.z
		velocity = (forward - n * forward.dot(n)).normalized() * speed
	else:
		velocity.y -= CarRules.AIR_GRAVITY * delta

	move_and_slide()

	# Hitting a wall slows the car to what it actually managed.
	if is_on_wall():
		var real: float = get_real_velocity().length()
		speed = signf(speed) * minf(absf(speed), real)

	_tilt_to_ground(delta)

## Lean the body to match the slope under it (the collision box stays
## upright; only the look tilts).
func _tilt_to_ground(delta: float) -> void:
	if not is_on_floor():
		return
	var up_local: Vector3 = (global_basis.inverse() * get_floor_normal()).normalized()
	var target := Quaternion(Vector3.UP, up_local)
	_visual.quaternion = _visual.quaternion.slerp(target, 1.0 - exp(-12.0 * delta))
