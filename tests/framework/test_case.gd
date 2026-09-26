extends RefCounted
## Minimal test base. A test script does `extends "res://tests/framework/test_case.gd"`
## and defines `test_*` methods. Assert helpers record failures; the runner reports
## them. Optional before_each()/after_each() hooks can be overridden.
##
## Deliberately dependency-free (no addon) so it runs via:
##   godot --headless --script res://tests/run_tests.gd

var _failures: Array[String] = []

func before_each() -> void:
	pass

func after_each() -> void:
	pass

func _fail(msg: String) -> void:
	_failures.append(msg)

func assert_true(v: bool, msg: String = "") -> void:
	if not v:
		_fail("assert_true failed" + _suffix(msg))

func assert_false(v: bool, msg: String = "") -> void:
	if v:
		_fail("assert_false failed" + _suffix(msg))

func assert_eq(a: Variant, b: Variant, msg: String = "") -> void:
	if a != b:
		_fail("assert_eq failed: %s != %s%s" % [str(a), str(b), _suffix(msg)])

func assert_ne(a: Variant, b: Variant, msg: String = "") -> void:
	if a == b:
		_fail("assert_ne failed: both %s%s" % [str(a), _suffix(msg)])

func assert_null(v: Variant, msg: String = "") -> void:
	if v != null:
		_fail("assert_null failed: got %s%s" % [str(v), _suffix(msg)])

func assert_not_null(v: Variant, msg: String = "") -> void:
	if v == null:
		_fail("assert_not_null failed" + _suffix(msg))

func assert_almost_eq(a: float, b: float, tol: float = 0.0001, msg: String = "") -> void:
	if absf(a - b) > tol:
		_fail("assert_almost_eq failed: %s vs %s (tol %s)%s" % [str(a), str(b), str(tol), _suffix(msg)])

func assert_gt(a: Variant, b: Variant, msg: String = "") -> void:
	if not (a > b):
		_fail("assert_gt failed: %s !> %s%s" % [str(a), str(b), _suffix(msg)])

func assert_lt(a: Variant, b: Variant, msg: String = "") -> void:
	if not (a < b):
		_fail("assert_lt failed: %s !< %s%s" % [str(a), str(b), _suffix(msg)])

func _suffix(msg: String) -> String:
	return "  —  " + msg if msg != "" else ""
