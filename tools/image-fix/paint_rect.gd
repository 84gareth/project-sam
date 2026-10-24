extends SceneTree
# Paints a rectangle of a photo with paper colour, taken row by row from
# column `sample_x` (pick a column that is plain paper on those rows). Used
# to hide things around Sam's drawings, like a tablecloth at the edge.
#   Godot --headless --path tools/image-fix --script res://paint_rect.gd -- \
#       in.jpg out.jpg x0 y0 x1 y1 sample_x
func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	var img := Image.load_from_file(a[0])
	var x0 := int(a[2]); var y0 := int(a[3]); var x1 := mini(int(a[4]), img.get_width())
	var y1 := mini(int(a[5]), img.get_height()); var sx := int(a[6])
	for y in range(y0, y1):
		var paper := img.get_pixel(sx, y)
		for x in range(x0, x1):
			img.set_pixel(x, y, paper)
	img.save_jpg(a[1], 0.85)
	quit()
