extends SceneTree
# Keeps only the sheet of paper: anything round it (a patterned tablecloth)
# becomes plain paper colour. Fills in from the photo's edges across
# everything that ISN'T paper, so it stops at the paper's cut edge.
#   Godot --headless --path tools/image-fix --script res://paper_only.gd -- in.jpg out.jpg
const PAPER := Color(0.96, 0.95, 0.92)

func is_paper(c: Color) -> bool:
	return c.get_luminance() > 0.62 and c.s < 0.15

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	var img := Image.load_from_file(a[0])
	var w := img.get_width()
	var h := img.get_height()
	var seen := PackedByteArray()
	seen.resize(w * h)
	var stack: Array[Vector2i] = []
	for x in w:
		stack.append(Vector2i(x, 0)); stack.append(Vector2i(x, h - 1))
	for y in h:
		stack.append(Vector2i(0, y)); stack.append(Vector2i(w - 1, y))
	while not stack.is_empty():
		var p: Vector2i = stack.pop_back()
		if p.x < 0 or p.y < 0 or p.x >= w or p.y >= h or seen[p.y * w + p.x]:
			continue
		seen[p.y * w + p.x] = 1
		if is_paper(img.get_pixelv(p)):
			continue
		img.set_pixelv(p, PAPER)
		stack.append(p + Vector2i.LEFT); stack.append(p + Vector2i.RIGHT)
		stack.append(p + Vector2i.UP); stack.append(p + Vector2i.DOWN)
	img.save_jpg(a[1], 0.9)
	quit()
