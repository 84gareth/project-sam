extends Node
## Runner for the LIVE-TREE lane. See tests/framework/live_case.gd for why this
## lane exists and why it must be a scene rather than a `--script` run.
##
## Discovers every tests/live/test_*.gd, runs each `test_*` method as a
## coroutine with before_each/after_each around it, and quits 0/1 so it gates
## the same way the unit lane does.

const LIVE_DIR: String = "res://tests/live"

var _total: int = 0
var _failed: int = 0
## See script_error_trap.gd: without it a test that crashes partway PASSES.
var _trap = preload("res://tests/framework/script_error_trap.gd").new()

func _ready() -> void:
	OS.add_logger(_trap)
	_run_all()

func _run_all() -> void:
	print("── Running live-tree tests ──")
	var scripts: Array[String] = _discover()
	if scripts.is_empty():
		print("No live tests found in %s" % LIVE_DIR)
	for path in scripts:
		var started: int = Time.get_ticks_msec()
		await _run_script(path)
		print("   [%6dms] %s" % [Time.get_ticks_msec() - started, path.get_file()])

	print("──")
	if _failed == 0:
		print("Live: %d passed" % _total)
	else:
		print("Live: %d/%d FAILED" % [_failed, _total])
	get_tree().quit(1 if _failed > 0 else 0)

func _discover() -> Array[String]:
	var out: Array[String] = []
	var dir := DirAccess.open(LIVE_DIR)
	if dir == null:
		push_warning("live_runner: cannot open %s" % LIVE_DIR)
		return out
	dir.list_dir_begin()
	var name: String = dir.get_next()
	while name != "":
		# .gd only: Godot also reports .gd.uid / .remap entries here.
		if not dir.current_is_dir() and name.begins_with("test_") and name.ends_with(".gd"):
			out.append(LIVE_DIR + "/" + name)
		name = dir.get_next()
	dir.list_dir_end()
	out.sort()
	# `./run_tests.sh --only=<substring>` arrives as TEST_ONLY. An env var
	# rather than a command-line arg: Godot doesn't reliably pass user args
	# through when a scene is launched this way, and silently running the
	# FULL suite when you asked for one file defeats the point.
	var only: String = OS.get_environment("TEST_ONLY")
	if only == "":
		return out
	var filtered: Array[String] = []
	for path in out:
		if path.get_file().contains(only):
			filtered.append(path)
	print("   (filtered to \"%s\": %d of %d files)" % [only, filtered.size(), out.size()])
	return filtered

func _run_script(path: String) -> void:
	var script: GDScript = load(path)
	if script == null:
		print("  FAIL  %s (failed to load)" % path)
		_total += 1
		_failed += 1
		return

	var file: String = path.get_file()
	var methods: Array[String] = _test_methods(script)
	# A discovered test file with NO test methods is almost always a file that
	# failed to compile, which would otherwise vanish from the run silently.
	if methods.is_empty():
		print("  FAIL  %s (no test methods — did it fail to compile?)" % file)
		_total += 1
		_failed += 1
		return

	for method in methods:
		_total += 1
		var case: Node = script.new()
		add_child(case)
		# One frame so the case is genuinely inside the tree before it runs.
		await get_tree().process_frame

		_trap.take()   # anything raised between tests belongs to no test
		await case.before_each()
		await case.call(method)
		await case.after_each()
		for e in _trap.take():
			case.failures.append(e)

		if case.failures.is_empty():
			print("  PASS  %s::%s" % [file, method])
		else:
			_failed += 1
			print("  FAIL  %s::%s" % [file, method])
			for f in case.failures:
				print("          %s" % f)

		case.queue_free()
		await get_tree().process_frame

func _test_methods(script: GDScript) -> Array[String]:
	var out: Array[String] = []
	for m in script.get_script_method_list():
		var n: String = m.get("name", "")
		if n.begins_with("test_") and not out.has(n):
			out.append(n)
	out.sort()
	return out
