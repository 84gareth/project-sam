@tool
extends StaticBody3D
## A wedge ramp, rising towards -Z (the way cars face). Builds its own mesh
## and collision from three sizes, so each ramp in a scene can differ.
## @tool means it also runs in the editor, so ramps show up there too.

@export var length: float = 8.0:
	set(v):
		length = v
		_build()
@export var height: float = 3.0:
	set(v):
		height = v
		_build()
@export var width: float = 6.0:
	set(v):
		width = v
		_build()
@export var color: Color = Color(0.95, 0.6, 0.15):
	set(v):
		color = v
		_build()

func _ready() -> void:
	_build()

func _build() -> void:
	if not is_inside_tree():
		return
	var w: float = width / 2.0
	var l: float = length / 2.0
	var p0 := Vector3(-w, 0, l)
	var p1 := Vector3(w, 0, l)
	var p2 := Vector3(-w, 0, -l)
	var p3 := Vector3(w, 0, -l)
	var p4 := Vector3(-w, height, -l)
	var p5 := Vector3(w, height, -l)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_quad(st, [p4, p5, p1, p0], Vector3(0, length, height).normalized())  # slope
	_quad(st, [p5, p4, p2, p3], Vector3.FORWARD)                           # back wall
	_quad(st, [p0, p1, p3, p2], Vector3.DOWN)                              # bottom
	_tri(st, [p0, p2, p4], Vector3.LEFT)
	_tri(st, [p1, p3, p5], Vector3.RIGHT)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	# Draw both sides, so triangle winding can't make a face vanish.
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	st.set_material(mat)

	var mesh_node: MeshInstance3D = _child("Mesh", MeshInstance3D)
	mesh_node.mesh = st.commit()
	var shape_node: CollisionShape3D = _child("Shape", CollisionShape3D)
	var shape := ConvexPolygonShape3D.new()
	shape.points = PackedVector3Array([p0, p1, p2, p3, p4, p5])
	shape_node.shape = shape

func _quad(st: SurfaceTool, p: Array, n: Vector3) -> void:
	_tri(st, [p[0], p[1], p[2]], n)
	_tri(st, [p[0], p[2], p[3]], n)

func _tri(st: SurfaceTool, p: Array, n: Vector3) -> void:
	for v: Vector3 in p:
		st.set_normal(n)
		st.add_vertex(v)

## The mesh and shape are made at runtime, not saved in the scene.
func _child(child_name: String, type: Variant) -> Node:
	var c: Node = get_node_or_null(child_name)
	if c == null:
		c = type.new()
		c.name = child_name
		add_child(c)
	return c
