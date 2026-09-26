extends Node
## Base class for LIVE-TREE tests, the second test lane.
##
## Why a second lane exists: the unit lane runs under `--headless --script`,
## which cannot do two things a game needs:
##   1. `--script` does NOT register autoloads, so any script touching one
##      fails to compile there.
##   2. run_tests.gd does its work inside SceneTree._initialize() and quits.
##      Nodes added then are not in the tree: is_inside_tree() is false and
##      group lookups return nothing until a frame actually runs.
## So anything that mounts real nodes, walks the tree, or uses an autoload runs
## here, as a SCENE with real frames.
##
## WRITING ONE: subclass this, put it in tests/live/, and write `test_*`
## methods. They're coroutines: `await` the helpers below rather than counting
## frames by hand.
##
##   func test_thing() -> void:
##       var s := preload("res://scenes/thing.tscn").instantiate()
##       add_child(s)
##       await frames(1)
##       assert_true(s.is_inside_tree(), "scene came up")
##       await until(func(): return s.done, "the job finished")
##
## before_each/after_each run around every test method, same as the unit lane.

var failures: Array[String] = []
var assertions: int = 0

## Default ceiling for until(). Generous: headless frame delta is tiny, so
## wall-clock waits need real slack.
const DEFAULT_TIMEOUT: float = 10.0

## Both are AWAITED by the runner, so either may be a coroutine.
func before_each() -> void:
	pass

func after_each() -> void:
	pass

# ─── Waiting ─────────────────────────────────────────────────────────────────

## Let `n` frames pass. Use this only for "let the tree settle" (freshly added
## nodes need one frame to actually enter it); prefer until() for anything
## conditional.
func frames(n: int = 1) -> void:
	for i in n:
		await get_tree().process_frame

## Wait `t` seconds of wall clock.
func seconds(t: float) -> void:
	await get_tree().create_timer(t).timeout

## Poll `predicate` every frame until it returns true, or fail after `timeout`.
## This is the workhorse: "wait for the thing to happen" without guessing how
## many frames that takes. A wrong frame-count guess reads as a product
## failure when it's really a test bug.
func until(predicate: Callable, label: String = "", timeout: float = DEFAULT_TIMEOUT) -> bool:
	var deadline: float = Time.get_ticks_msec() / 1000.0 + timeout
	while true:
		if bool(predicate.call()):
			assertions += 1
			return true
		if Time.get_ticks_msec() / 1000.0 > deadline:
			_fail("timed out after %.1fs waiting for: %s" % [timeout, label])
			return false
		await get_tree().process_frame
	return false

# ─── Assertions (mirroring tests/framework/test_case.gd) ─────────────────────

func _fail(msg: String) -> void:
	failures.append(msg)

func _suffix(msg: String) -> String:
	return (": " + msg) if msg != "" else ""

func assert_true(v: bool, msg: String = "") -> void:
	assertions += 1
	if not v:
		_fail("expected true" + _suffix(msg))

func assert_false(v: bool, msg: String = "") -> void:
	assertions += 1
	if v:
		_fail("expected false" + _suffix(msg))

func assert_eq(a: Variant, b: Variant, msg: String = "") -> void:
	assertions += 1
	if a != b:
		_fail("expected %s == %s%s" % [a, b, _suffix(msg)])

func assert_ne(a: Variant, b: Variant, msg: String = "") -> void:
	assertions += 1
	if a == b:
		_fail("expected %s != %s%s" % [a, b, _suffix(msg)])

func assert_null(v: Variant, msg: String = "") -> void:
	assertions += 1
	if v != null:
		_fail("expected null, got %s%s" % [v, _suffix(msg)])

func assert_not_null(v: Variant, msg: String = "") -> void:
	assertions += 1
	if v == null:
		_fail("expected non-null" + _suffix(msg))

func assert_gt(a: Variant, b: Variant, msg: String = "") -> void:
	assertions += 1
	if not (a > b):
		_fail("expected %s > %s%s" % [a, b, _suffix(msg)])

func assert_lt(a: Variant, b: Variant, msg: String = "") -> void:
	assertions += 1
	if not (a < b):
		_fail("expected %s < %s%s" % [a, b, _suffix(msg)])

func assert_almost_eq(a: float, b: float, tol: float = 0.0001, msg: String = "") -> void:
	assertions += 1
	if absf(a - b) > tol:
		_fail("expected %s ≈ %s (tol %s)%s" % [a, b, tol, _suffix(msg)])
