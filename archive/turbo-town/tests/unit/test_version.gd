extends "res://tests/framework/test_case.gd"
## The version string in project.godot is the single source of truth, and it
## is bumped on every gameplay change. Keep it plain MAJOR.MINOR.PATCH.

func test_version_is_major_minor_patch() -> void:
	var v: String = str(ProjectSettings.get_setting("application/config/version", ""))
	var re := RegEx.create_from_string("^\\d+\\.\\d+\\.\\d+$")
	assert_not_null(re.search(v), "application/config/version is \"%s\"" % v)
