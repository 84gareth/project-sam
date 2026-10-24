extends SceneTree
## Headless entry point for the test suite:
##   godot --headless --script res://tests/run_tests.gd
## Exits with code 0 if all tests pass, 1 if any fail (usable as a CI gate).

const TestRunner := preload("res://tests/framework/test_runner.gd")

func _initialize() -> void:
	print("── Running tests ──")
	var code: int = TestRunner.new().run_all()
	quit(code)
