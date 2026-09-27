extends CharacterBody3D
## A car: Sam's, or a computer racer's. A CharacterBody3D (moved by code, not
## pushed around by physics), so handling is predictable and testable. All
## the numbers live in car_rules.gd.
##
## On the ground the car moves ALONG the slope under it, so driving up a ramp
## gives it upward speed and it launches off the top. In the air it keeps
## that speed and falls.

const CarRules = preload("res://scripts/car_rules.gd")

## Sam's car reads the controls. Computer cars have their pedals and steering
## set by the race each tick instead.
@export var driven_by_player: bool = true
## Body colour. Leave clear (alpha 0) to keep the scene's red.
@export var paint: Color = Color(0, 0, 0, 0)

## Forward speed in metres per second (negative = reversing).
var speed: float = 0.0
## False before GO: the car sits still whatever the pedals say.
var can_drive: bool = true
## Pedals 0..1 and steering -1 (right) .. 1 (left).
var throttle: float = 0.0
var brake: float = 0.0
var steer: float = 0.0

## Bumps: a shove from another car, fading away.
const BUMP_SHARE: float = 0.6        ## of the closing speed passed on
const BUMP_FADE: float = 18.0        ## m/s lost per second
const BUMP_MAX: float = 14.0
var _push: Vector3 = Vector3.ZERO
var _wanted: Vector3 = Vector3.ZERO

@onready var _visual: Node3D = $Visual

func _ready() -> void:
	if paint.a > 0.0:
		var m := StandardMaterial3D.new()
		m.albedo_color = paint
		m.roughness = 0.4
		($Visual/Body as MeshInstance3D).material_override = m

func _physics_process(delta: float) -> void:
	if driven_by_player:
		throttle = Input.get_action_strength("accelerate")
		brake = Input.get_action_strength("brake")
		steer = Input.get_axis("steer_right", "steer_left")
	if not can_drive:
		throttle = 0.0
		brake = 0.0
		steer = 0.0
		speed = 0.0

	if is_on_floor():
		speed = CarRules.step_speed(speed, throttle, brake, delta)
		rotate_y(CarRules.turn_rate(speed, steer) * delta)
		var n: Vector3 = get_floor_normal()
		var forward: Vector3 = -global_basis.z
		velocity = (forward - n * forward.dot(n)).normalized() * speed + _push
	else:
		velocity.y -= CarRules.AIR_GRAVITY * delta

	# move_and_slide() changes velocity to what the car actually managed (zero
	# when blocked head-on), so bumps use the speed it TRIED to go.
	_wanted = velocity
	move_and_slide()
	_push = _push.move_toward(Vector3.ZERO, BUMP_FADE * delta)

	for i in get_slide_collision_count():
		var hit: KinematicCollision3D = get_slide_collision(i)
		var other: Object = hit.get_collider()
		if other != self and other.has_method("bump"):
			_bump_into(other, hit.get_normal())

	# Hitting a wall slows the car to what it actually managed.
	if is_on_wall():
		var real: float = get_real_velocity().length()
		speed = signf(speed) * minf(absf(speed), real)

	_tilt_to_ground(delta)

## Another car hit this one: take the shove.
func bump(shove: Vector3) -> void:
	shove.y = 0.0
	_push = (_push + shove).limit_length(BUMP_MAX)

## This car ran into `other`. `normal` points from the other car to this one.
func _bump_into(other: Node, normal: Vector3) -> void:
	var flat := Vector3(normal.x, 0.0, normal.z).normalized()
	var closing: float = (_wanted - other._wanted).dot(-flat)
	if closing <= 0.0:
		return
	other.bump(-flat * closing * BUMP_SHARE)
	bump(flat * closing * BUMP_SHARE * 0.5)
	speed *= 0.85

## Lean the body to match the slope under it (the collision box stays
## upright; only the look tilts).
func _tilt_to_ground(delta: float) -> void:
	if not is_on_floor():
		return
	var up_local: Vector3 = (global_basis.inverse() * get_floor_normal()).normalized()
	var target := Quaternion(Vector3.UP, up_local)
	_visual.quaternion = _visual.quaternion.slerp(target, 1.0 - exp(-12.0 * delta))
