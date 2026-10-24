extends SceneTree
# Cuts Sam's drawings out of their paper, like stickers, for the paper
# puppet castle. Pen (dark) and crayon (colourful) marks are thickened by
# GROW pixels so gaps in the outline close up; everything the photo's edge
# can reach without crossing that thickened drawing becomes see-through.
# So paper INSIDE the drawing stays, and a thin paper border is left round
# it, like a real sticker. Then it trims to the drawing and shrinks it.
# (v1 filled across "paper-coloured" pixels and leaked through outline gaps:
# Madame Mystic and Tiny Tom lost whole parts, Gareth 2026-10-24.)
#   Godot --headless --path tools/image-fix --script res://cutout.gd -- \
#       <project folder> id1 id2 ...
# Reads assets/characters/<id>.jpg, writes assets/puppets/<id>.png.
const HEIGHT := 320
const GROW := 9

func is_ink(c: Color) -> bool:
	return c.get_luminance() < 0.5 or c.s * c.v > 0.08

# Max filter along rows then columns with a running count: O(pixels).
func grow(mask: PackedByteArray, w: int, h: int, r: int) -> PackedByteArray:
	var tmp := PackedByteArray(); tmp.resize(w * h)
	for y in h:
		var count := 0
		for x in range(-r, w + r):
			var add := x + r
			if add < w and mask[y * w + add]: count += 1
			var sub := x - r - 1
			if sub >= 0 and sub < w and mask[y * w + sub]: count -= 1
			if x >= 0 and x < w: tmp[y * w + x] = 1 if count > 0 else 0
	var out := PackedByteArray(); out.resize(w * h)
	for x in w:
		var count := 0
		for y in range(-r, h + r):
			var add := y + r
			if add < h and tmp[add * w + x]: count += 1
			var sub := y - r - 1
			if sub >= 0 and sub < h and tmp[sub * w + x]: count -= 1
			if y >= 0 and y < h: out[y * w + x] = 1 if count > 0 else 0
	return out

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	var root := a[0]
	for i in range(1, a.size()):
		var id := a[i]
		var img := Image.load_from_file(root + "/assets/characters/" + id + ".jpg")
		img.convert(Image.FORMAT_RGBA8)
		var w := img.get_width()
		var h := img.get_height()
		var ink := PackedByteArray(); ink.resize(w * h)
		for y in h:
			for x in w:
				ink[y * w + x] = 1 if is_ink(img.get_pixel(x, y)) else 0
		var solid := grow(ink, w, h, GROW)
		var outside := PackedByteArray(); outside.resize(w * h)
		var stack: Array[Vector2i] = []
		for x in w:
			stack.append(Vector2i(x, 0)); stack.append(Vector2i(x, h - 1))
		for y in h:
			stack.append(Vector2i(0, y)); stack.append(Vector2i(w - 1, y))
		while not stack.is_empty():
			var p: Vector2i = stack.pop_back()
			if p.x < 0 or p.y < 0 or p.x >= w or p.y >= h:
				continue
			var k := p.y * w + p.x
			if outside[k] or solid[k]:
				continue
			outside[k] = 1
			stack.append(p + Vector2i.LEFT); stack.append(p + Vector2i.RIGHT)
			stack.append(p + Vector2i.UP); stack.append(p + Vector2i.DOWN)
		for y in h:
			for x in w:
				if outside[y * w + x]:
					img.set_pixel(x, y, Color(0, 0, 0, 0))
				else:
					# Inside the sticker: clean paper, but blend so even light
					# crayon keeps its colour.
					var c := img.get_pixel(x, y)
					var keep := maxf(smoothstep(0.55, 0.35, c.get_luminance()),
							smoothstep(0.04, 0.12, c.s * c.v))
					img.set_pixel(x, y, Color(0.97, 0.96, 0.93).lerp(c, keep))
		var box := img.get_used_rect()
		var out := img.get_region(box)
		out.resize(int(box.size.x * HEIGHT / float(box.size.y)), HEIGHT, Image.INTERPOLATE_BILINEAR)
		out.save_png(root + "/assets/puppets/" + id + ".png")
		print(id, " ", out.get_size())
	quit()
