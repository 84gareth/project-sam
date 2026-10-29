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

## Sam's answers for Catapults and Cooking (2026-10-24)

- Catapults: hit the shield and it breaks: nobody gets a shield tonight.
  If nobody hits it, the best player wins it. Catapult day always has a
  murder that night, and only someone who was hit can be murdered.
- Cooking: you cook for someone; you guess the food they hate from a
  clue. One truck's secret box has the shield; the others are empty; you
  open one box.

### How they play (spec, v0.10.0)
- **Catapults** (remade v0.12.9, Gareth: a proper shooting gallery with a
  pull-back slingshot): everyone's pictures, plus the shield, fly round
  the gallery, bouncing off the edges. Drag the stone back and let go:
  the further you pull, the further it goes (opposite way to the pull);
  it flies in a curve for 0.7 s, so aim ahead. Sam has 5 stones. Everyone
  else throws one: a good thrower hits who they suspect most, and now and
  then a stone hits the shield. Score = hits / 5. Everyone hit is up for
  murder. On a recruiting night the Traitors still recruit instead.
- **Cooking Challenge**: someone comes to dinner and gives a clue about
  the food they hate. Three trucks (healthy, meat, dessert), four foods
  each; pick one from each. Then open one truck's secret box. The hated
  food in the meal scores 1 (a nice meal without it scores 0.3). Find the
  shield and you win it; otherwise the best player does.

## The other nine (spec, v0.11.0; Sam's answers 2026-10-24)

Clue missions (Letter Jumble, Muddy Footprints, Portrait Gallery) give a
**note from someone who has gone**, naming who they suspected. They might
be wrong (a banished Traitor's note points at a Faithful). Before anyone
has gone, there's no note.

- **Who Was Where?** (memory): the four rooms flash up with people in
  them; then "Who was in the library?" with four names. 3 questions.
- **Letter Jumble** (puzzle, clue): tap jumbled letters to spell three
  names; the first is the last person murdered (or banished). Spell it and
  you get their note.
- **Secret Code** (puzzle): a key of coloured shapes and letters; spell
  three secret words from their shapes. Three wrong letters lose a word.
- **Garden Maze** (puzzle): steer a counter out of the hedge maze with an
  on-screen joystick, within a minute (Gareth, v0.12.5: smooth movement;
  start and way out in random opposite corners). Part-way counts for some.
- **Lost Keys** (hunting; remade v0.12.10, Sam: "look behind things"):
  14 things in the library (books, chairs, paintings, clocks...), 5 hide
  a key, and you can look behind 9. An empty one might jingle: a key is
  close by.
- **Muddy Footprints** (hunting, clue; remade v0.12.8, Gareth: "a complete
  rework"): boot prints pop up one by one along a trail round the garden;
  tap each before it fades (1.7 s, getting quicker). Fox and duck prints
  pop up too; tapping one costs points. Follow it well (60%+) and you find
  the note at the end.
- **Portrait Gallery** (hunting, clue): look at the wall; the lights go
  out; a new portrait has gone up. Which one? Three rounds, more pictures
  each time; the last new portrait is someone who has gone, with a note.
- **Treasure Hunt** (hunting): the gold is hidden in one room. Tap to
  search: "warmer", "colder", or "not in this room". 12 taps.
- **Lights Out** (puzzle): see the shield picture, then the lights
  flicker while you put its 9 pieces back (tap a piece, then its place;
  tap a placed piece to move or swap it; Finished! when done). 45 seconds. Everyone builds; the best builder wins the shield.

## Fresh every time (Gareth, v0.12.6)

Every mission's details come from the game's random seed, so they change
from game to game: tunes, shuffles, the catapult wall, the diner, hiding
places, words, mazes (and their corners), trails, galleries and treasure.
Added: the Cooking menu (4 of 6 foods per truck, the hated food always on
it) and four Lights Out shield pictures.

## No mission on day 1 (Gareth, v0.11.1)

Day 1 goes straight to the castle. Days 2 to 12 have a mission each, so a
game plays 11 of the 13.

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

## The 12-day rules (v0.9.0, OK'd by Gareth)

- Every game lasts 12 days. It ends early only if every Traitor is caught.
  After day 12's Round Table, any Traitor still in wins the pot; if none,
  the Faithfuls share it.
- Nights: night 1 the Traitors recruit. After that they murder every other
  night (nights 2, 4, 6...) and only plot on the others.
- When only 2 Traitors are left, they recruit instead, but only up to
  night 5, so they can still all be caught (Gareth, v0.9.1; `RECRUIT_UNTIL`
  in `js/castle.js`).
- Balance, measured over 300 computer games: Faithfuls win about 55%.
  (Night 8 gave about 15%; night 6, 41%; night 4, 61%.)

## The final and the end (Sam, 2026-10-25; v0.14.0)

After day 12's Round Table comes the final, "like the TV show": everyone
left votes "End the game" or "Banish someone else". Traitors always vote to
end; a Faithful wants another vote if one person stands out on their list
(`FINAL_MARGIN`). Any banish vote means another Round Table; it ends when
everyone says end (or two are left). Then the big reveal (everyone left,
one by one), who wins the money (the pot shared by the winners still in),
a party if Sam's side wins (confetti, cheering; crying if not), and every
Traitor of the whole game, recruits and the banished marked.

## Shields (Sam, 2026-10-25; v0.16.0)

Sam drew the shield: a gold necklace with a medallion
(`assets/shield-drawing.jpg`, cut out to `assets/shield.png` with
`tools/image-fix/ink_only.gd`). Whoever wins a shield wears it round their
neck (on their puppet, in the walk, when you chat to them) until the next
day, and can't be murdered that night. Most missions give one shield;
some (30%, `TWO_SHIELDS`) give two, to the top two players. Sam's drawing
is also the shield in Catapults.

## The fire pit (Sam, 2026-10-25; v0.17.0)

Sam drew the final's fire pit and its two flames (`assets/final/`). After
day 12, everyone left takes a turn at the fire pit: they say why, in
their own way (`finalLine`; a banish line often names their top suspect),
and throw a green flame (end the game) or a red one (banish again). Sam
picks one of four lines (`finalChoices`: two green, two red). Any red
flame means another Round Table, until everyone throws green or two are
left.

## The dagger (Sam, 2026-10-25; v0.18.0)

Sam drew the dagger (`assets/dagger.png`). The night it gets down to 8
players, the Traitors give it to someone: anyone, even one of themselves
(a Traitor Sam picks; otherwise they give it to their least-suspected
Traitor, `daggerIdeas`). The holder carries it all the next day (on their
puppet, in the walk) and their vote counts twice at that day's Round
Table (an "x2" on their chalkboard). Breakfast says who has it. Once a
game.

## Nights, version 3 (Sam and Gareth, 2026-10-25; v0.19.0)

Replaces "murders every other night" and "recruit at 2 up to night 5".
- Night 1: the Traitors recruit.
- Most nights: a murder. A few nights have no murder: a couple at random,
  plus any night where another murder would leave too few for a final of
  about 5 at the end of day 12 (`quietTonight`). A no-murder night is
  announced at breakfast and shown in the castle all day.
- Whenever only 2 Traitors (or fewer) are left, they may recruit instead,
  any night (a Traitor Sam chooses; the computer Traitors recruit if down
  to one or if they can't murder, otherwise 35% of the time).
- Balance (Gareth: "they should get more suspicious of the newer
  traitors"): honest players grow more suspicious of every recruit each
  day (`RECRUIT_TELL` 0.25). 300 computer games: Faithfuls win ~57%; every
  game reaches day 12.

## Round Table draws (Gareth, 2026-10-29)

"If it's a draw ... make everyone vote again with just the people with the
most votes as option - if it's a draw still they each pick a chest - one
has a shield in, the others are eliminated." Then: "Only one person
eliminated, the tied people can't vote", and "They should get a chance to
say something before the new vote too".

As built (v0.28.0): the tied people each say something (a real player
picks from three lines); everyone else votes again between just them; if
it's still a draw, one chest each: one is empty, the rest hold shields, and
whoever gets the empty one leaves. Rules: `firstVote`, `tiePleas`,
`revote`, `chests` in `js/castle.js`; engine decisions "pleas", "revote",
"chests".
