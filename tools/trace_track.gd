extends SceneTree
## Turns a photo of a hand-drawn track (two closed pen lines, the road
## between them, a start line across the road) into a centre line in metres.
##
##   Godot --headless --script res://tools/trace_track.gd -- \
##       <drawing.jpg> <out.json> <preview.png> [lap_metres]
##
## How: the drawing's dark lines are thickened a little (closing small pen
## gaps), then flood-filled from outside the outer line and from inside the
## inner line. Rays from the middle find where each fill ends; the halfway
## point is the centre of the road. The start line is the dark ink found in
## the road between the two fills. The road width is NOT taken from the
## drawing (Sam: "same all the way"); the game sets it.
##
## Output points run in the race direction, starting at the start line.
## Direction: the first stretch heads UP the page (Sam, 2026-09-27).

const WORK_WIDTH: int = 480        ## drawing is scaled to this before tracing
const DARK: float = 0.35           ## luminance below this counts as ink
const THICKEN: int = 3             ## pixels added round every ink pixel
const EDGE_MARGIN: float = 0.1     ## ignore this share of the LEFT edge
const OTHER_MARGIN: float = 0.01   ## and this much of the others
## (Track 1's photo has dark cloth down the left; the pen lines come close
## to the other edges.)
const RAYS: int = 720
const OUT_POINTS: int = 96
const SMOOTH_PASSES: int = 3

enum { UNKNOWN, INK, OUTSIDE, INSIDE }

func _initialize() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	if args.size() < 3:
		printerr("usage: -- <drawing> <out.json> <preview.png> [lap_metres]")
		quit(2)
		return
	var lap_metres: float = float(args[3]) if args.size() > 3 else 2000.0
	var img := Image.load_from_file(args[0])
	if img == null or img.is_empty():
		printerr("could not load ", args[0])
		quit(1)
		return
	img.resize(WORK_WIDTH, int(img.get_height() * WORK_WIDTH / float(img.get_width())))
	var w: int = img.get_width()
	var h: int = img.get_height()

	var ink: PackedByteArray = _ink_mask(img)
	var thick: PackedByteArray = _thicken(ink, w, h)
	var cells := PackedByteArray()
	cells.resize(w * h)
	for i in w * h:
		cells[i] = INK if thick[i] else UNKNOWN

	# Outside: flood from every margin pixel that isn't ink.
	var x0: int = int(w * EDGE_MARGIN)
	var x1: int = int(w * (1.0 - OTHER_MARGIN))
	var y0: int = int(h * OTHER_MARGIN)
	var y1: int = int(h * (1.0 - OTHER_MARGIN))
	var seeds: Array[Vector2i] = []
	for x in range(x0, x1):
		seeds.append(Vector2i(x, y0))
		seeds.append(Vector2i(x, y1 - 1))
	for y in range(y0, y1):
		seeds.append(Vector2i(x0, y))
		seeds.append(Vector2i(x1 - 1, y))
	_fill(cells, w, h, seeds, OUTSIDE, Rect2i(x0, y0, x1 - x0, y1 - y0))

	# Inside: the biggest untouched region that isn't the road. Scan the
	# middle row: ink, road, ink, INSIDE, ink, road, ink.
	var inside_seed: Vector2i = _find_inside_seed(cells, w, h, x0, x1)
	if inside_seed.x < 0:
		printerr("could not find the inside of the track")
		quit(1)
		return
	_fill(cells, w, h, [inside_seed], INSIDE, Rect2i(x0, y0, x1 - x0, y1 - y0))

	var centre := Vector2.ZERO
	var count: int = 0
	for y in h:
		for x in w:
			if cells[y * w + x] == INSIDE:
				centre += Vector2(x, y)
				count += 1
	centre /= count

	# Rays: halfway between leaving INSIDE and reaching OUTSIDE.
	var raw: Array[Vector2] = []
	var start_angles: Array[float] = []
	for r in RAYS:
		var a: float = TAU * r / RAYS
		var dir := Vector2(cos(a), sin(a))
		var r_in: float = -1.0
		var r_out: float = -1.0
		var d: float = 0.0
		while d < w + h:
			var p: Vector2i = Vector2i((centre + dir * d).round())
			if p.x < 0 or p.y < 0 or p.x >= w or p.y >= h:
				break
			var c: int = cells[p.y * w + p.x]
			if r_in < 0.0 and c != INSIDE:
				r_in = d
			if c == OUTSIDE:
				r_out = d
				break
			d += 0.5
		if r_in < 0.0 or r_out < 0.0:
			continue
		raw.append(centre + dir * (r_in + r_out) / 2.0)
		# Start line: RAW ink well inside the road band (not the thickened
		# edge lines).
		var band: float = r_out - r_in
		var hits: int = 0
		var t: float = r_in + band * 0.25
		while t < r_out - band * 0.25:
			var q: Vector2i = Vector2i((centre + dir * t).round())
			if ink[q.y * w + q.x]:
				hits += 1
			t += 0.5
		if hits > 0:
			start_angles.append(a)

	if start_angles.is_empty():
		printerr("could not find the start line")
		quit(1)
		return
	start_angles.sort()
	var start_angle: float = start_angles[start_angles.size() / 2]
	var start_px: Vector2 = _nearest(raw, centre + Vector2(cos(start_angle), sin(start_angle)) * 1000.0, centre)

	var pts: Array[Vector2] = _resample(raw, OUT_POINTS)
	for i in SMOOTH_PASSES:
		pts = _smooth(pts)
	pts = _resample(pts, OUT_POINTS)

	# Rotate so point 0 is at the start line, then orient so the first
	# stretch heads UP the page (smaller y).
	var best: int = 0
	for i in pts.size():
		if pts[i].distance_to(start_px) < pts[best].distance_to(start_px):
			best = i
	var ordered: Array[Vector2] = []
	for i in pts.size():
		ordered.append(pts[(best + i) % pts.size()])
	if ordered[1].y > ordered[0].y:
		var rev: Array[Vector2] = [ordered[0]]
		for i in range(ordered.size() - 1, 0, -1):
			rev.append(ordered[i])
		ordered = rev

	# Scale to metres: page x -> world x, page y (down) -> world z.
	var length_px: float = 0.0
	for i in ordered.size():
		length_px += ordered[i].distance_to(ordered[(i + 1) % ordered.size()])
	var scale: float = lap_metres / length_px
	var mid := Vector2.ZERO
	for p in ordered:
		mid += p
	mid /= ordered.size()
	var out: Array = []
	for p in ordered:
		var m: Vector2 = (p - mid) * scale
		out.append([snappedf(m.x, 0.01), snappedf(m.y, 0.01)])

	var f := FileAccess.open(args[1], FileAccess.WRITE)
	f.store_string(JSON.stringify({"source": args[0].get_file(), "lap_metres": lap_metres, "points": out}, "\t"))
	f.close()

	_preview(img, cells, ordered, args[2])
	print("traced %d points, lap %.0f m, %.2f m per drawing pixel, start at (%.0f, %.0f)px"
			% [out.size(), lap_metres, scale, ordered[0].x, ordered[0].y])
	quit(0)

func _ink_mask(img: Image) -> PackedByteArray:
	var w: int = img.get_width()
	var h: int = img.get_height()
	var m := PackedByteArray()
	m.resize(w * h)
	for y in h:
		for x in w:
			m[y * w + x] = 1 if img.get_pixel(x, y).get_luminance() < DARK else 0
	return m

func _thicken(m: PackedByteArray, w: int, h: int) -> PackedByteArray:
	var out := PackedByteArray()
	out.resize(w * h)
	for y in h:
		for x in w:
			if not m[y * w + x]:
				continue
			for dy in range(-THICKEN, THICKEN + 1):
				for dx in range(-THICKEN, THICKEN + 1):
					var xx: int = x + dx
					var yy: int = y + dy
					if xx >= 0 and yy >= 0 and xx < w and yy < h:
						out[yy * w + xx] = 1
	return out

func _fill(cells: PackedByteArray, w: int, _h: int, seeds: Array, value: int, bounds: Rect2i) -> void:
	var stack: Array[Vector2i] = []
	for s: Vector2i in seeds:
		if cells[s.y * w + s.x] == UNKNOWN:
			stack.append(s)
	while not stack.is_empty():
		var p: Vector2i = stack.pop_back()
		var i: int = p.y * w + p.x
		if cells[i] != UNKNOWN:
			continue
		cells[i] = value
		for n: Vector2i in [p + Vector2i.LEFT, p + Vector2i.RIGHT, p + Vector2i.UP, p + Vector2i.DOWN]:
			if bounds.has_point(n) and cells[n.y * w + n.x] == UNKNOWN:
				stack.append(n)

## Along the middle rows, the UNKNOWN runs are: road, inside, road. The
## inside is the middle one.
func _find_inside_seed(cells: PackedByteArray, w: int, h: int, x0: int, x1: int) -> Vector2i:
	for frac: float in [0.5, 0.45, 0.55, 0.4, 0.6]:
		var y: int = int(h * frac)
		var runs: Array[Vector2i] = []
		var x: int = x0
		while x < x1:
			if cells[y * w + x] == UNKNOWN:
				var a: int = x
				while x < x1 and cells[y * w + x] == UNKNOWN:
					x += 1
				runs.append(Vector2i(a, x - 1))
			x += 1
		if runs.size() == 3:
			return Vector2i((runs[1].x + runs[1].y) / 2, y)
	return Vector2i(-1, -1)

func _nearest(pts: Array[Vector2], far: Vector2, centre: Vector2) -> Vector2:
	var dir: Vector2 = (far - centre).normalized()
	var best: Vector2 = pts[0]
	var best_score: float = -INF
	for p in pts:
		var score: float = (p - centre).normalized().dot(dir)
		if score > best_score:
			best_score = score
			best = p
	return best

func _resample(pts: Array[Vector2], n: int) -> Array[Vector2]:
	var cum: Array[float] = [0.0]
	for i in pts.size():
		cum.append(cum[i] + pts[i].distance_to(pts[(i + 1) % pts.size()]))
	var total: float = cum[cum.size() - 1]
	var out: Array[Vector2] = []
	var seg: int = 0
	for k in n:
		var d: float = total * k / n
		while cum[seg + 1] < d:
			seg += 1
		var t: float = (d - cum[seg]) / maxf(cum[seg + 1] - cum[seg], 0.0001)
		out.append(pts[seg].lerp(pts[(seg + 1) % pts.size()], t))
	return out

func _smooth(pts: Array[Vector2]) -> Array[Vector2]:
	var n: int = pts.size()
	var out: Array[Vector2] = []
	for i in n:
		var s := Vector2.ZERO
		for k in range(-2, 3):
			s += pts[(i + k + n) % n]
		out.append(s / 5.0)
	return out

func _preview(img: Image, cells: PackedByteArray, pts: Array[Vector2], path: String) -> void:
	var w: int = img.get_width()
	var out: Image = img.duplicate()
	for y in img.get_height():
		for x in w:
			var c: int = cells[y * w + x]
			if c == INSIDE:
				out.set_pixel(x, y, out.get_pixel(x, y).lerp(Color.GREEN, 0.3))
			elif c == OUTSIDE:
				out.set_pixel(x, y, out.get_pixel(x, y).lerp(Color.SKY_BLUE, 0.3))
	for i in pts.size():
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[(i + 1) % pts.size()]
		for s in 20:
			var p: Vector2i = Vector2i(a.lerp(b, s / 20.0).round())
			var col: Color = Color.RED if i < 3 else Color.ORANGE_RED.lerp(Color.BLUE, float(i) / pts.size())
			for dy in range(-1, 2):
				for dx in range(-1, 2):
					out.set_pixel(clampi(p.x + dx, 0, w - 1), clampi(p.y + dy, 0, out.get_height() - 1), col)
	out.save_png(path)
