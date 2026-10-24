extends SceneTree
# Cuts Sam's drawings out of their paper, like stickers, for the paper
# puppet castle. Paper reached from the edge of the photo becomes
# see-through; paper INSIDE the drawing (a white shirt) stays. Then it trims
# to the drawing and shrinks it.
#   Godot --headless --path tools/image-fix --script res://cutout.gd -- \
#       <project folder> id1 id2 ...
# Reads assets/characters/<id>.jpg, writes assets/puppets/<id>.png.
const HEIGHT := 320

func is_paper(c: Color) -> bool:
	return c.get_luminance() > 0.5 and c.s * c.v < 0.14

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	var root := a[0]
	for i in range(1, a.size()):
		var id := a[i]
		var img := Image.load_from_file(root + "/assets/characters/" + id + ".jpg")
		img.convert(Image.FORMAT_RGBA8)
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
			if not is_paper(img.get_pixelv(p)):
				continue
			img.set_pixelv(p, Color(0, 0, 0, 0))
			stack.append(p + Vector2i.LEFT); stack.append(p + Vector2i.RIGHT)
			stack.append(p + Vector2i.UP); stack.append(p + Vector2i.DOWN)
		var box := img.get_used_rect()
		var out := img.get_region(box)
		out.resize(int(box.size.x * HEIGHT / float(box.size.y)), HEIGHT, Image.INTERPOLATE_BILINEAR)
		out.save_png(root + "/assets/puppets/" + id + ".png")
		print(id, " ", out.get_size())
	quit()
