extends Logger
## Catches SCRIPT and SHADER errors raised while a test runs, so a test that
## crashes partway fails instead of passing.
##
## WHY. GDScript has no exceptions. When a line in a test hits a runtime error
## (assigning null to a typed int, calling a method on a freed object), Godot
## prints "SCRIPT ERROR", abandons the rest of that function and carries on. A
## runner that only counts assertion failures sees a test that died before its
## first assertion as a PASS. This bit Project 2126 badly; both runners here
## install this trap from day one.
##
## Engine-level ERRORs are NOT trapped: they are frequent, often benign in a
## test that builds and tears down scenes, and not what hides a crashed test.

var _mutex := Mutex.new()
var _errors: PackedStringArray = PackedStringArray()

func _log_error(function: String, file: String, line: int, code: String,
		rationale: String, _editor_notify: bool, error_type: int,
		_script_backtraces: Array[ScriptBacktrace]) -> void:
	if error_type != ERROR_TYPE_SCRIPT and error_type != ERROR_TYPE_SHADER:
		return
	var kind: String = "SCRIPT ERROR" if error_type == ERROR_TYPE_SCRIPT else "SHADER ERROR"
	var what: String = rationale if not rationale.is_empty() else code
	_mutex.lock()
	_errors.append("%s: %s  (%s:%d in %s)" % [kind, what, file, line, function])
	_mutex.unlock()

func _log_message(_message: String, _error: bool) -> void:
	pass

## Everything caught since the last call, and forget it.
func take() -> PackedStringArray:
	_mutex.lock()
	var out: PackedStringArray = _errors
	_errors = PackedStringArray()
	_mutex.unlock()
	return out
