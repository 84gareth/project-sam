extends RefCounted
## A closed track centre line: points on the flat (x, z) in race order,
## point 0 on the start line. Pure maths, no nodes, so it's unit-testable.
## "Distance" below always means metres along the centre line from the start.

var points: PackedVector2Array
var length: float = 0.0
var _cum: PackedFloat32Array   # distance at each point; last = length

func _init(pts: PackedVector2Array) -> void:
	points = pts
	_cum = PackedFloat32Array([0.0])
	for i in points.size():
		length += points[i].distance_to(points[(i + 1) % points.size()])
		_cum.append(length)

## Reads tracks/<name>.json as written by tools/trace_track.gd.
static func load_json(path: String) -> RefCounted:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(path))
	var pts := PackedVector2Array()
	for p: Array in data["points"]:
		pts.append(Vector2(p[0], p[1]))
	return new(pts)

func wrap_distance(d: float) -> float:
	return fposmod(d, length)

func point_at(d: float) -> Vector2:
	var i: int = _segment_at(wrap_distance(d))
	var a: Vector2 = points[i]
	var b: Vector2 = points[(i + 1) % points.size()]
	return a.lerp(b, (wrap_distance(d) - _cum[i]) / (_cum[i + 1] - _cum[i]))

## Unit direction of travel at distance d.
func direction_at(d: float) -> Vector2:
	var i: int = _segment_at(wrap_distance(d))
	return (points[(i + 1) % points.size()] - points[i]).normalized()

## Distance along the track of the centre-line point closest to pos.
func progress_of(pos: Vector2) -> float:
	var best_d: float = 0.0
	var best_gap: float = INF
	for i in points.size():
		var a: Vector2 = points[i]
		var b: Vector2 = points[(i + 1) % points.size()]
		var ab: Vector2 = b - a
		var t: float = clampf((pos - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
		var gap: float = pos.distance_squared_to(a + ab * t)
		if gap < best_gap:
			best_gap = gap
			best_d = _cum[i] + t * (_cum[i + 1] - _cum[i])
	return best_d

## How far pos is from the centre line, in metres.
func distance_from_centre(pos: Vector2) -> float:
	return pos.distance_to(point_at(progress_of(pos)))

## Unit vector pointing to the outside of the loop at distance d. (Outside =
## away from the middle of all the points, which holds for loop shapes.)
func outward_at(d: float) -> Vector2:
	var dir: Vector2 = direction_at(d)
	var side := Vector2(-dir.y, dir.x)
	var p: Vector2 = point_at(d)
	return side if (p + side - centroid()).length() > (p - centroid()).length() else -side

func centroid() -> Vector2:
	var c := Vector2.ZERO
	for p in points:
		c += p
	return c / points.size()

func _segment_at(d: float) -> int:
	# Binary search for the segment containing distance d.
	var lo: int = 0
	var hi: int = points.size() - 1
	while lo < hi:
		var mid: int = (lo + hi + 1) / 2
		if _cum[mid] <= d:
			lo = mid
		else:
			hi = mid - 1
	return lo
