extends SceneTree
# Hides the cut edge on a photo of Sam's drawing: paints paper colour over
# everything left of the cut line (plus a margin). Paper colour is taken
# from the right edge of each row.
#   Godot --headless --path tools/image-fix --script res://fix_edge.gd -- \
#       in.jpg out.jpg x0,y0 x1,y1 ... [keep=Y] [hard=N]   (points along the cut line, top down)
var HARD := 10     ## px past the line painted no matter what ("hard=N" to change)
var SOFT := 45   ## px past the line where only paper is painted

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	# Optional last arg "keep=Y": below row Y, dark pen lines are kept even
	# left of the line (Lola Loud's mic stand crossed it).
	var keep_ink_below := -1
	while a[a.size() - 1].contains("="):
		var opt := a[a.size() - 1]
		if opt.begins_with("keep="):
			keep_ink_below = int(opt.substr(5))
		elif opt.begins_with("hard="):
			HARD = int(opt.substr(5))
		a.remove_at(a.size() - 1)
	var img := Image.load_from_file(a[0])
	var pts: Array[Vector2] = []
	for i in range(2, a.size()):
		var p := a[i].split(",")
		pts.append(Vector2(float(p[0]), float(p[1])))
	var paper := img.get_pixel(img.get_width() / 2, int(img.get_height() * 0.15))
	for y in img.get_height():
		var lx := 0.0
		for i in pts.size() - 1:
			if y >= pts[i].y and y <= pts[i + 1].y:
				lx = lerpf(pts[i].x, pts[i + 1].x, (y - pts[i].y) / maxf(pts[i + 1].y - pts[i].y, 1.0))
		var row_paper := img.get_pixel(img.get_width() - 12, y)
		for x in int(lx + SOFT):
			if x >= img.get_width():
				break
			# Up to just past the line: paint everything (the cut line itself
			# is dark). Further in: only paint paper, keeping Sam's pen lines.
			if x >= lx + HARD and img.get_pixel(x, y).get_luminance() <= 0.45:
				continue
			if keep_ink_below >= 0 and y > keep_ink_below and img.get_pixel(x, y).get_luminance() <= 0.33:
				continue
			img.set_pixel(x, y, row_paper)
	img.save_jpg(a[1], 0.85)
	print("paper ", paper)
	quit()
