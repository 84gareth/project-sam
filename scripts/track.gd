@tool
extends Node3D
## Builds a race track from a traced centre line (tracks/*.json): the road,
## centre dashes, a chequered start line, low walls on both edges, and a row
## of blocky buildings outside. The ground, sky and sun are in track.tscn.
## @tool, so the track also shows in the editor.

const TrackPath = preload("res://scripts/track_path.gd")
const BuildingRules = preload("res://scripts/building_rules.gd")

@export_file("*.json") var track_file: String = "res://tracks/track_1.json"
## The same all the way round (Sam, 2026-09-27).
@export var road_width: float = 24.0
@export var wall_height: float = 1.2
@export var city_seed: int = 1

const WALL_THICKNESS: float = 1.0
const ROAD_Y: float = 0.03
const MARK_Y: float = 0.05

var path: RefCounted

func _ready() -> void:
	build()

## Where the car sits at the start: 8 m behind the line, facing the way round.
func start_transform() -> Transform3D:
	var d: float = path.length - 8.0
	var p: Vector2 = path.point_at(d)
	var dir: Vector2 = path.direction_at(d)
	return Transform3D(Basis(Vector3.UP, atan2(-dir.x, -dir.y)), Vector3(p.x, 0.2, p.y))

## 0..1: how far round the lap a world position is (0 = the start line).
func progress_fraction(pos: Vector3) -> float:
	return path.progress_of(Vector2(pos.x, pos.z)) / path.length

## Half the road plus the wall: what buildings must stay clear of.
func clear_width() -> float:
	return road_width / 2.0 + WALL_THICKNESS

func build() -> void:
	path = TrackPath.load_json(track_file)
	for c in get_children():
		if c.has_meta("built"):
			remove_child(c)
			c.queue_free()
	_add(_road_mesh(), "Road")
	_add(_dash_mesh(), "Dashes")
	_add(_start_line(), "StartLine")
	_add(_walls(), "Walls")
	_add(_buildings(), "Buildings")

func _add(n: Node, n_name: String) -> void:
	n.name = n_name
	n.set_meta("built", true)
	add_child(n)

## Unit vector to the left of the direction of travel at point i.
func _side(i: int) -> Vector2:
	var n: int = path.points.size()
	var dir: Vector2 = (path.points[(i + 1) % n] - path.points[(i - 1 + n) % n]).normalized()
	return Vector2(-dir.y, dir.x)

func _v3(p: Vector2, y: float) -> Vector3:
	return Vector3(p.x, y, p.y)

func _flat_material(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.9
	# No shine: a flat road seen at a low angle otherwise mirrors the sky and
	# looks pale blue.
	m.metallic_specular = 0.0
	# Godot's front faces are CLOCKWISE. A face wound the wrong way still
	# draws (both sides are on) but turns nearly black. Both are checked by
	# eye in tools/godot/capture_race.tscn.
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _road_mesh() -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n: int = path.points.size()
	var half: float = road_width / 2.0
	for i in n:
		var j: int = (i + 1) % n
		var li: Vector3 = _v3(path.points[i] + _side(i) * half, ROAD_Y)
		var ri: Vector3 = _v3(path.points[i] - _side(i) * half, ROAD_Y)
		var lj: Vector3 = _v3(path.points[j] + _side(j) * half, ROAD_Y)
		var rj: Vector3 = _v3(path.points[j] - _side(j) * half, ROAD_Y)
		for v: Vector3 in [li, ri, lj, ri, rj, lj]:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)
	st.set_material(_flat_material(Color(0.16, 0.16, 0.17)))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	return mi

func _strip(st: SurfaceTool, from_d: float, to_d: float, half_w: float, y: float) -> void:
	var steps: int = maxi(1, int((to_d - from_d) / 2.0))
	for s in steps:
		var d0: float = lerpf(from_d, to_d, float(s) / steps)
		var d1: float = lerpf(from_d, to_d, float(s + 1) / steps)
		var a: Vector2 = path.point_at(d0)
		var b: Vector2 = path.point_at(d1)
		var sa: Vector2 = path.direction_at(d0).orthogonal() * half_w
		var sb: Vector2 = path.direction_at(d1).orthogonal() * half_w
		for v: Vector3 in [_v3(a + sa, y), _v3(b + sb, y), _v3(a - sa, y),
				_v3(a - sa, y), _v3(b + sb, y), _v3(b - sb, y)]:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)

func _dash_mesh() -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var d: float = 10.0
	while d < path.length - 12.0:
		_strip(st, d, d + 7.0, 0.3, MARK_Y)
		d += 16.0
	st.set_material(_flat_material(Color(0.95, 0.95, 0.9)))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	return mi

func _start_line() -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_strip(st, -3.0, 0.0, road_width / 2.0, MARK_Y)
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://shaders/checker_ground.gdshader")
	mat.set_shader_parameter("color_a", Color.WHITE)
	mat.set_shader_parameter("color_b", Color(0.08, 0.08, 0.08))
	mat.set_shader_parameter("cell", 1.5)
	st.set_material(mat)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	return mi

## One StaticBody3D holding a box per wall segment, both sides of the road.
## The look is one MultiMesh (one box mesh drawn many times, cheaply).
func _walls() -> StaticBody3D:
	var body := StaticBody3D.new()
	var transforms: Array[Transform3D] = []
	var n: int = path.points.size()
	var off: float = road_width / 2.0 + WALL_THICKNESS / 2.0
	for i in n:
		var j: int = (i + 1) % n
		for side_sign: float in [1.0, -1.0]:
			var a: Vector2 = path.points[i] + _side(i) * off * side_sign
			var b: Vector2 = path.points[j] + _side(j) * off * side_sign
			var dir: Vector2 = (b - a).normalized()
			var seg_len: float = a.distance_to(b) + WALL_THICKNESS
			var seg_basis := Basis(Vector3.UP, atan2(-dir.x, -dir.y))
			var t := Transform3D(seg_basis, _v3((a + b) / 2.0, wall_height / 2.0))
			var shape := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(WALL_THICKNESS, wall_height, seg_len)
			shape.shape = box
			shape.transform = t
			body.add_child(shape)
			transforms.append(t.scaled_local(Vector3(WALL_THICKNESS, wall_height, seg_len)))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = BoxMesh.new()
	mm.mesh.material = _flat_material(Color(0.92, 0.3, 0.25))
	mm.instance_count = transforms.size()
	for k in transforms.size():
		mm.set_instance_transform(k, transforms[k])
	var look := MultiMeshInstance3D.new()
	look.multimesh = mm
	body.add_child(look)
	return body

func _buildings() -> MultiMeshInstance3D:
	var list: Array[Dictionary] = BuildingRules.place(path, clear_width(), city_seed)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var box := BoxMesh.new()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.8
	box.material = mat
	mm.mesh = box
	mm.instance_count = list.size()
	for k in list.size():
		var b: Dictionary = list[k]
		var t := Transform3D(Basis(Vector3.UP, b["yaw"]), _v3(b["center"], b["size"].y / 2.0))
		mm.set_instance_transform(k, t.scaled_local(b["size"]))
		mm.set_instance_color(k, b["color"])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	return mmi
