extends SceneTree
# Keeps only the drawing (pen and colourful marker) from a photo of Sam's
# drawing, with a thin white sticker edge round it; everything else (paper,
# shadows, holes) becomes see-through. For drawings with holes in, like the
# shield necklace (cutout.gd would keep the paper inside the loop).
#   Godot --headless --path tools/image-fix --script res://ink_only.gd -- \
#       <photo> <out.png> [height] [edge] [fill]
# height: the PNG's height in pixels (default 240); edge: sticker edge (4);
# "fill": also keep gaps inside the drawing (paper showing through crayon),
# so a coloured-in shape stays solid. Without it, holes are see-through.

# How dark counts as pen, and how colourful counts as crayon. The shield
# needed strict ones (0.22, 0.3) to lose its paper shadows; soft crayon
# and photographed black paint need looser ones: pass "dark=0.32 colour=0.18"
# after the other arguments.
var DARK := 0.22
var COLOUR := 0.3

func is_ink(c: Color) -> bool:
	# Black marker is very dark; colourful marker is strongly coloured.
	# Paper shadows are mid-grey or a dull brown, so neither.
	return c.get_luminance() < DARK or (c.s > COLOUR and c.v > 0.35)

# Mark as drawing everything the picture's edge can't reach without
# crossing the drawing: the gaps inside it.
func fill_holes(mask: PackedByteArray, w: int, h: int) -> PackedByteArray:
	var outside := PackedByteArray(); outside.resize(w * h)
	var stack := []
	for x in w:
		stack.append(x); stack.append((h - 1) * w + x)
	for y in h:
		stack.append(y * w); stack.append(y * w + w - 1)
	while stack.size() > 0:
		var i: int = stack.pop_back()
		if outside[i] or mask[i]:
			continue
		outside[i] = 1
		var x := i % w
		var y := i / w
		if x > 0: stack.append(i - 1)
		if x < w - 1: stack.append(i + 1)
		if y > 0: stack.append(i - w)
		if y < h - 1: stack.append(i + w)
	var out := PackedByteArray(); out.resize(w * h)
	for i in w * h:
		out[i] = 0 if outside[i] else 1
	return out

# Drop specks: keep only joined-up parts at least `frac` of the biggest.
func keep_big_parts(mask: PackedByteArray, w: int, h: int, frac: float) -> PackedByteArray:
	var label := PackedInt32Array(); label.resize(w * h)
	var sizes := [0]
	var next := 1
	for start in w * h:
		if not mask[start] or label[start]:
			continue
		var stack := [start]
		label[start] = next
		var size := 0
		while stack.size() > 0:
			var i: int = stack.pop_back()
			size += 1
			var x := i % w
			var y := i / w
			for n in [i - 1 if x > 0 else -1, i + 1 if x < w - 1 else -1, i - w if y > 0 else -1, i + w if y < h - 1 else -1]:
				if n >= 0 and mask[n] and not label[n]:
					label[n] = next
					stack.append(n)
		sizes.append(size)
		next += 1
	var biggest := 0
	for sz in sizes: biggest = max(biggest, sz)
	var out := PackedByteArray(); out.resize(w * h)
	for i in w * h:
		out[i] = 1 if mask[i] and sizes[label[i]] >= biggest * frac else 0
	return out

func _init() -> void:
	var all := OS.get_cmdline_user_args()
	var args := []
	for a in all:
		if a.begins_with("dark="): DARK = float(a.substr(5))
		elif a.begins_with("colour="): COLOUR = float(a.substr(7))
		else: args.append(a)
	var img := Image.load_from_file(args[0])
	img.convert(Image.FORMAT_RGBA8)
	var height := int(args[2]) if args.size() > 2 else 240
	var edge := int(args[3]) if args.size() > 3 else 4
	# Work at a manageable size first.
	var scale := float(height * 3) / img.get_height()
	img.resize(int(img.get_width() * scale), height * 3, Image.INTERPOLATE_LANCZOS)
	var w := img.get_width()
	var h := img.get_height()
	var ink := PackedByteArray(); ink.resize(w * h)
	for y in h:
		for x in w:
			ink[y * w + x] = 1 if is_ink(img.get_pixel(x, y)) else 0
	ink = keep_big_parts(ink, w, h, 0.05)
	if args.size() > 4 and args[4] == "fill":
		ink = fill_holes(ink, w, h)
	# The sticker edge: any pixel within `edge` of ink (scaled to this size).
	var r := edge * 3
	var near := PackedByteArray(); near.resize(w * h)
	for y in h:
		for x in w:
			if not ink[y * w + x]:
				continue
			for dy in range(-r, r + 1):
				var yy := y + dy
				if yy < 0 or yy >= h:
					continue
				for dx in range(-r, r + 1):
					var xx := x + dx
					if xx < 0 or xx >= w or dx * dx + dy * dy > r * r:
						continue
					near[yy * w + xx] = 1
	var out := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var minx := w; var miny := h; var maxx := 0; var maxy := 0
	for y in h:
		for x in w:
			var i := y * w + x
			if ink[i]:
				out.set_pixel(x, y, img.get_pixel(x, y))
			elif near[i]:
				out.set_pixel(x, y, Color(1, 1, 1, 1))
			else:
				out.set_pixel(x, y, Color(0, 0, 0, 0))
				continue
			minx = min(minx, x); miny = min(miny, y); maxx = max(maxx, x); maxy = max(maxy, y)
	out = out.get_region(Rect2i(minx, miny, maxx - minx + 1, maxy - miny + 1))
	out.resize(int(out.get_width() * float(height) / out.get_height()), height, Image.INTERPOLATE_LANCZOS)
	out.save_png(args[1])
	print("wrote ", args[1], " ", out.get_width(), "x", out.get_height())
	quit()
