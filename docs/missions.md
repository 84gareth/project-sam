# Missions (Phase 5)

12 missions, one per day, like the TV show. Types: memory, puzzles, hunting.
Characters are good or bad at each type (Max Muddle is bad at memory).
The prize is money for the pot plus a shield; the best player wins the
shield. Some missions give clues using people who have gone.

## Sam's picks (2026-10-24)

Yes:
- Castle Bells (memory): bells ring in an order; ring them back.
- Chilli Pie Shuffle (memory): which pie is the chilli one after the shuffle?
- Who Was Where? (memory): a castle picture flashes up; who was in the library?
- Letter Jumble (puzzle, clue): jumbled letters spell someone who has gone.
- Secret Code (puzzle): crack a symbol code to read a message.
- Garden Maze (puzzle): find the way through the hedge maze.
- Lost Keys (hunting): find 5 keys hidden in the library.
- Muddy Footprints (hunting, clue): follow footprints to a hidden name.
- Portrait Gallery (hunting, clue): which portrait of someone gone is new?
- Treasure Hunt (hunting): find gold coins round the castle.

No: Memory Match, Train Timetable.

## Sam's own missions (2026-10-24)

In Sam's words, then his answers:

- **Cooking Challenge** (Sam): "3 trucks with healthy stuff, meat, and
  dessert. You have to cook a meal and there's a secret box in each truck
  that contains a shield. If you have a least favourite food that gets used
  then you get money."
  Every character has a least favourite food. Cook it for them, you get money.
- **Catapults** (Sam): "fire catapults at pictures of the other players, if
  you hit them they're up for murder that night. There's a shield and if you
  hit it nobody gets it." Everyone fires.
  Who gets the shield if nobody hits it? Sam picked "Nobody, the shield
  only matters if it's hit" ("the shield only matters if its hit").
  Check with Sam when building it: does hitting the shield win it, or stop
  anyone getting it?
- **Lights Out** (Sam): "the lights go out in a room and the traitors have
  to build a picture of a shield from pieces without seeing it properly."
  Everyone builds, Faithfuls too; the best builder wins the shield.

## How many

13 missions for 12 days: each game picks 12 at random, so one is left out
each time (Sam and Gareth: "We might add more later").

## How a mission day works (spec, v0.8.0)

- Each day starts with the day's mission, before the castle. Day 1 too.
- The day's mission comes from a seeded order of the missions that are
  built; once 12 or more are built, a game uses 12 of them.
- Sam plays it. Everyone else gets a score from 0 to 1 from their skill at
  that type (good, normal or bad, from their personality; Max Muddle is bad
  at memory), plus luck. Traitors try too (Sam: Traitors don't spoil).
- The pot: the team's average score times £10,000, rounded to £500.
- The shield: the best score today wins it. Everyone knows who has it, so
  the Traitors can't pick them tonight. It lasts one night.

First two missions:
- **Castle Bells**: four bells ring in an order; ring them back. Rounds of
  3, 4, 5, 6 and 7 bells; one mistake ends it. Score = rounds done / 5.
- **Chilli Pie Shuffle**: three pies, one is Chef Pepper's chilli pie. They
  are covered and swapped about; tap the chilli pie. Three rounds, more
  swaps and faster each time. Score = right answers / 3.

Waiting for Gareth: the rule changes (always 12 days, murders every other
night, recruit when 2 Traitors are left). See the question in chat: if the
Traitors always recruit back up to 3, they can never all be caught, so the
Faithfuls could never win.
