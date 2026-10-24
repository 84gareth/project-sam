extends RefCounted
## Where the blocky city buildings go: one row round the OUTSIDE of the
## track (Sam: grass in the middle, buildings outside). Seeded, so the same
## track always gets the same city. Pure: returns a list, builds nothing.

const SPACING: float = 34.0          ## metres along the track between tries
const GAP: float = 8.0               ## clear grass between wall and building
const MIN_SIZE: float = 14.0
const MAX_SIZE: float = 26.0
const MIN_HEIGHT: float = 12.0
const MAX_HEIGHT: float = 55.0
const COLORS: Array[Color] = [
	Color(0.95, 0.55, 0.35), Color(0.45, 0.65, 0.95), Color(0.95, 0.85, 0.4),
	Color(0.75, 0.5, 0.9), Color(0.5, 0.85, 0.7), Color(0.9, 0.9, 0.92),
]

## Each: {"center": Vector2, "size": Vector3 (x width, y height, z depth),
## "yaw": float, "color": Color}. clear_width is the half-width of road plus
## wall that no building may touch.
static func place(path: RefCounted, clear_width: float, seed_value: int) -> Array[Dictionary]:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var out: Array[Dictionary] = []
	var d: float = 0.0
	while d < path.length:
		var w: float = rng.randf_range(MIN_SIZE, MAX_SIZE)
		var depth: float = rng.randf_range(MIN_SIZE, MAX_SIZE)
		var h: float = rng.randf_range(MIN_HEIGHT, MAX_HEIGHT)
		var color: Color = COLORS[rng.randi() % COLORS.size()]
		var dir: Vector2 = path.direction_at(d)
		var center: Vector2 = path.point_at(d) + path.outward_at(d) * (clear_width + GAP + depth / 2.0)
		var b: Dictionary = {"center": center, "size": Vector3(w, h, depth),
				"yaw": atan2(-dir.x, -dir.y), "color": color}
		if _clear_of_road(path, b, clear_width + GAP * 0.5) and _clear_of_others(b, out):
			out.append(b)
		d += SPACING
	return out

## The four corners of a building's footprint.
static func corners(b: Dictionary) -> Array[Vector2]:
	var half := Vector2(b["size"].x, b["size"].z) / 2.0
	var out: Array[Vector2] = []
	for s: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		out.append(b["center"] + (half * s).rotated(-b["yaw"]))
	return out

static func _clear_of_road(path: RefCounted, b: Dictionary, clear: float) -> bool:
	for c in corners(b):
		if path.distance_from_centre(c) < clear:
			return false
	return path.distance_from_centre(b["center"]) >= clear

static func _clear_of_others(b: Dictionary, others: Array[Dictionary]) -> bool:
	var r: float = Vector2(b["size"].x, b["size"].z).length() / 2.0
	for o in others:
		var ro: float = Vector2(o["size"].x, o["size"].z).length() / 2.0
		if b["center"].distance_to(o["center"]) < r + ro:
			return false
	return true
