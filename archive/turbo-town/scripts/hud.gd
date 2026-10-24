extends CanvasLayer
## On-screen text: the game's name and version in the corner, and in a race
## the lap and place at the top, the 3-2-1-GO countdown in the middle, and
## the results at the end. Race-only labels are optional, so the test drive
## can use this HUD too.

@onready var _title: Label = %TitleLabel
@onready var _version: Label = %VersionLabel
@onready var _lap: Label = get_node_or_null("%LapLabel")
@onready var _place: Label = get_node_or_null("%PlaceLabel")
@onready var _countdown: Label = get_node_or_null("%CountdownLabel")
@onready var _results: Control = get_node_or_null("%Results")
@onready var _results_list: Label = get_node_or_null("%ResultsList")

func _ready() -> void:
	_title.text = str(ProjectSettings.get_setting("application/config/name"))
	_version.text = "v" + str(ProjectSettings.get_setting("application/config/version"))
	if _results:
		_results.visible = false

func show_lap(text: String) -> void:
	if _lap:
		_lap.text = text

func show_place(text: String) -> void:
	if _place:
		_place.text = text

## Empty text hides it.
func show_countdown(text: String) -> void:
	if _countdown:
		_countdown.text = text
		_countdown.visible = text != ""

func show_results(lines: Array[String]) -> void:
	if _results:
		_results_list.text = "\n".join(lines)
		_results.visible = true

func results_showing() -> bool:
	return _results != null and _results.visible
