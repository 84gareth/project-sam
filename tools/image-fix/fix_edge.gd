extends SceneTree
# Hides the cut edge on a photo of Sam's drawing: paints paper colour over
# everything left of the cut line (plus a margin). Paper colour is taken
# from the right edge of each row. Below y=1650 dark pen lines are kept
# (Lola Loud's mic stand crossed the line); change that for other photos.
#   Godot --headless --path tools/image-fix --script res://fix_edge.gd -- \
#       in.jpg out.jpg x0,y0 x1,y1 ...   (points along the cut line, top down)
func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
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
		# Paper colour from just right of the line, on this row.
		var row_paper := img.get_pixel(img.get_width() - 12, y)
		# Above the mic stand's foot, cover the whole strip, shadow and all;
		# lower down, keep dark pen lines (the stand crosses the line there).
		var keep_ink := y > 1650
		for x in int(lx + 62):
			if x >= img.get_width():
				break
			if keep_ink and img.get_pixel(x, y).get_luminance() <= 0.33:
				continue
			img.set_pixel(x, y, row_paper)
	img.save_jpg(a[1], 0.85)
	print("paper ", paper)
	quit()
