extends RefCounted
## Who is where in a race. Pure: works on plain numbers.

## "1st", "2nd", "3rd", "4th"...
static func ordinal(n: int) -> String:
	var tens: int = n % 100
	if tens >= 11 and tens <= 13:
		return "%dth" % n
	match n % 10:
		1: return "%dst" % n
		2: return "%dnd" % n
		3: return "%drd" % n
	return "%dth" % n

## Race order. Each entry: {"finish": int (finishing place, 0 = not yet),
## "distance": float (laps done + share of the current lap)}. Finished cars
## come first in the order they finished, then everyone else, furthest first.
## Returns the entry indexes, leader first.
static func order(entries: Array[Dictionary]) -> Array[int]:
	var idx: Array[int] = []
	for i in entries.size():
		idx.append(i)
	idx.sort_custom(func(a: int, b: int) -> bool:
		var fa: int = entries[a]["finish"]
		var fb: int = entries[b]["finish"]
		if fa > 0 or fb > 0:
			if fa > 0 and fb > 0:
				return fa < fb
			return fa > 0
		return entries[a]["distance"] > entries[b]["distance"])
	return idx
