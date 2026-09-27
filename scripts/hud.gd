extends CanvasLayer
## On-screen text: the game's name and version in the corner, and (in a
## race) the lap in big letters at the top.

@onready var _title: Label = %TitleLabel
@onready var _version: Label = %VersionLabel
@onready var _lap: Label = get_node_or_null("%LapLabel")

func _ready() -> void:
	_title.text = str(ProjectSettings.get_setting("application/config/name"))
	_version.text = "v" + str(ProjectSettings.get_setting("application/config/version"))

func show_lap(text: String) -> void:
	if _lap:
		_lap.text = text
