extends Control
## Placeholder main scene: shows the game's name and version so there is
## something runnable from day one. Replace once we know what the game is.

@onready var title_label: Label = %TitleLabel
@onready var version_label: Label = %VersionLabel

func _ready() -> void:
	title_label.text = str(ProjectSettings.get_setting("application/config/name"))
	version_label.text = "v" + str(ProjectSettings.get_setting("application/config/version"))
