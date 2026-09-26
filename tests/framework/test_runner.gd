extends RefCounted
## Discovers and runs the UNIT test lane. Finds every `test_*.gd` under
## res://tests/ (excluding this framework dir and the live lane), instantiates
## each, runs its `test_*` methods with a fresh instance per method, and reports
## pass/fail. Returns a process exit code (0 = all passed, 1 = failures).
##
## tests/live/ is deliberately skipped: those cases need a real scene tree and
## autoloads, neither of which exist under `--script`. Running them here doesn't
## just fail them, it can take down this whole lane before it reports. They're
## run by tests/framework/live_runner.gd instead (both lanes: ./run_tests.sh).

## See script_error_trap.gd: without it a test that crashes partway PASSES.
var _trap = preload("res://tests/framework/script_error_trap.gd").new()

func run_all() -> int:
	OS.add_logger(_trap)
	var files: Array = []
	_scan("res://tests/", files)
	files.sort()
	# `./run_tests.sh --only=<substring>` arrives as TEST_ONLY. Both lanes
	# honour it, so one flag focuses the whole suite.
	var only: String = OS.get_environment("TEST_ONLY")
	if only != "":
		var filtered: Array = []
		for path in files:
			if str(path).get_file().contains(only):
				filtered.append(path)
		print("   (filtered to \"%s\": %d of %d files)" % [only, filtered.size(), files.size()])
		files = filtered

	var total: int = 0
	var passed: int = 0
	var failed: int = 0

	for path in files:
		var script: GDScript = load(path)
		if script == null:
			print("  ERROR  could not load ", path)
			failed += 1
			continue
		var method_names: Array = []
		var probe: Object = script.new()
		for m in probe.get_method_list():
			if String(m.name).begins_with("test_"):
				method_names.append(m.name)
		method_names.sort()

		# No test methods = the file almost certainly failed to compile, which
		# would otherwise drop it from the run with no visible failure.
		if method_names.is_empty():
			print("  FAIL  %s (no test methods — did it fail to compile?)"
					% String(path).get_file())
			total += 1
			failed += 1
			continue

		for mname in method_names:
			var inst: Object = script.new()
			total += 1
			_trap.take()   # anything raised between tests belongs to no test
			inst.before_each()
			inst.call(mname)
			inst.after_each()
			var fails: Array = inst._failures.duplicate()
			# See script_error_trap.gd: without this a test that crashes
			# partway PASSES, because it recorded no assertion failures.
			for e in _trap.take():
				fails.append(e)
			if fails.is_empty():
				passed += 1
				print("  PASS  %s::%s" % [String(path).get_file(), mname])
			else:
				failed += 1
				print("  FAIL  %s::%s" % [String(path).get_file(), mname])
				for f in fails:
					print("          " + String(f))

	print("")
	print("Total: %d   Passed: %d   Failed: %d" % [total, passed, failed])
	return 0 if failed == 0 else 1

func _scan(dir_path: String, out: Array) -> void:
	var d: DirAccess = DirAccess.open(dir_path)
	if d == null:
		return
	d.list_dir_begin()
	var name: String = d.get_next()
	while name != "":
		if d.current_is_dir():
			# "live" is the other lane; see this file's header.
			if name != "framework" and name != "live" and not name.begins_with("."):
				_scan(dir_path.path_join(name), out)
		elif name.begins_with("test_") and name.ends_with(".gd"):
			out.append(dir_path.path_join(name))
		name = d.get_next()
	d.list_dir_end()
