extends Camera3D
## Follows a car from behind and a little above, smoothly. Uses only the
## car's facing on the flat (not its tilt), so ramps don't make it lurch.

@export var target_path: NodePath
@export var distance: float = 7.5
@export var height: float = 3.2
@export var look_height: float = 1.2
## Bigger = snappier follow.
@export var follow: float = 6.0

var _target: Node3D

func _ready() -> void:
	_target = get_node(target_path)
	snap()

## Jump straight to the resting spot (no smoothing).
func snap() -> void:
	global_position = _desired()
	look_at(_target.global_position + Vector3.UP * look_height)

func _physics_process(delta: float) -> void:
	global_position = global_position.lerp(_desired(), 1.0 - exp(-follow * delta))
	look_at(_target.global_position + Vector3.UP * look_height)

func _desired() -> Vector3:
	var back: Vector3 = _target.global_basis.z
	back.y = 0.0
	back = back.normalized()
	return _target.global_position + back * distance + Vector3.UP * height
