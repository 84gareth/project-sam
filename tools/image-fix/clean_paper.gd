extends SceneTree
# Keeps only Sam's pen and crayon marks and turns everything else (paper,
# shadows, cut edges, the table underneath) into plain paper colour. Pen is
# dark; crayon is colourful; shadows and paper are pale and grey.
#   Godot --headless --path tools/image-fix --script res://clean_paper.gd -- in.jpg out.jpg
const PAPER := Color(0.96, 0.95, 0.92)
const DARK := 0.30        ## luminance below this is pen
const COLOURFUL := 0.16   ## saturation above this is crayon

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	var img := Image.load_from_file(a[0])
	for y in img.get_height():
		for x in img.get_width():
			var c := img.get_pixel(x, y)
			var ink := maxf(smoothstep(DARK + 0.12, DARK, c.get_luminance()),
					smoothstep(COLOURFUL - 0.06, COLOURFUL + 0.06, c.s * c.v))
			img.set_pixel(x, y, PAPER.lerp(c, ink))
	img.save_jpg(a[1], 0.88)
	quit()
