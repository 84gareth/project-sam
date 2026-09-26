extends "res://tests/framework/live_case.gd"
## The main scene loads in a real tree and shows the game's name and version.

var _main: Node

func after_each() -> void:
	if is_instance_valid(_main):
		_main.queue_free()

func test_main_scene_shows_name_and_version() -> void:
	var path: String = str(ProjectSettings.get_setting("application/run/main_scene"))
	_main = load(path).instantiate()
	add_child(_main)
	await frames(1)
	var game_name: String = str(ProjectSettings.get_setting("application/config/name"))
	var version: String = str(ProjectSettings.get_setting("application/config/version"))
	assert_eq(_main.get_node("%TitleLabel").text, game_name, "title label")
	assert_eq(_main.get_node("%VersionLabel").text, "v" + version, "version label")
