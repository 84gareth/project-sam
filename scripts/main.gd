extends Node3D
## The first drive (Phase 2): one car on the test area, a chase camera, and
## the game's name and version in the corner.

@onready var title_label: Label = %TitleLabel
@onready var version_label: Label = %VersionLabel

func _ready() -> void:
	title_label.text = str(ProjectSettings.get_setting("application/config/name"))
	version_label.text = "v" + str(ProjectSettings.get_setting("application/config/version"))
