# Roadmap

The single ordered list. Work it top to bottom; new items get proposed and
agreed before they're added (CLAUDE.md rule 11).

Sam's first game, Turbo Town, is archived with its own roadmap:
`archive/turbo-town/docs/roadmap.md` (Phases 0-4 done, power-ups never
started).

## Phase 0: Web setup ✅ (v0.1.0, 2026-10-24)
- ✅ Turbo Town moved to `archive/turbo-town/`, tagged `turbo-town-v0.4.1`
- ✅ A plain web page for the iPad showing the name and version
- ✅ Tests in headless Chrome, both lanes, crash trap, `--only` filter
- ✅ `tools/playtest.sh` serves it on the Mac and the home Wi-Fi
- ✅ Repo public; published on GitHub Pages

## Phase 1: Sam's new idea ✅
- ✅ Sam's idea: a game like The Traitors, starting at Havenbrook Station
- ✅ Interview: `docs/pitch.md`
- ✅ 22 characters, all approved by Sam: `docs/characters.md`

Gareth OK'd the plan (2026-10-24: "We'll keep working on the game while sam
draws some pictures"). Sam's drawings go in as they arrive, whatever the
phase. Voices (the iPad's own) arrive with Phase 3, when people start
talking.

## Phase 2: Choose who you are ✅ (v0.2.1)
Spec: `docs/start-spec.md`.
- ✅ The station screen with Sam's picture and a Start button
- ✅ All 22 characters to pick from
- ✅ The game tells you if you're a Faithful or a Traitor (fair deal)
- ✅ Gareth: "good start", then moved on to the castle

## Phase 3: A day at the castle ✅ (v0.3.0)
- ✅ Castle and Round Table pictures (Gareth's, from Claude's prompts)
- ✅ Chat: tap anyone, four questions, Traitors fib and blame
- ✅ Round Table: tap your vote, everyone shows a chalkboard
- ✅ Drum roll, then "I am a... FAITHFUL!"; next day; win or banished
- ✅ Voices (the iPad's own), with an on/off button
- ✅ Sam and Gareth: "We liked the first day!" (2026-10-24). Gate passed.
Spec: `docs/castle-spec.md` (Sam's interview, 2026-10-24).
The Round Table: chat to people (some act sneaky), everyone votes, the one
banished shows if they were a Traitor. The core of the game: fun first.
Characters speak with the iPad's own voices.

## Phase 4: The night — built, waiting for Sam (v0.4.0)
Spec: `docs/night-spec.md`.
- ✅ The Traitors' secret meeting; Sam picks if he's a Traitor
- ✅ The letter: "By order of the Traitors, you have been murdered."
- ✅ Breakfast in little groups; who never came?
- ✅ Tactical voting (Gareth's request): crowd, staying safe, unsure
- ✅ Pictures for the Traitors' room and breakfast (Gareth's)
- ✅ Breakfast: the missing one crossed out with an animated red X, then
  everyone, with the gone crossed out
- Gate: Sam plays it

## Sound effects ✅ (v0.5.0)
Real recordings for every tap, the chalkboards, the drum roll, the reveal
(crying and booing for a Faithful, cheering for a Traitor), the night and
the letter: `docs/sound-spec.md`.

## Phase 4.5: Walk around the castle (paper puppets) — built (v0.6.0)
Agreed 2026-10-24 (Sam: "actually move around the castle and actually see
the other characters moving around"; Gareth picked paper puppets). Sam's
drawings cut out like stickers, wobbling as they walk through side-on rooms.
- ✅ Tap where to go; tap someone to chat (`js/puppets.js`, pure, tested)
- ✅ Rooms: great hall, library, garden, kitchen (Gareth's pictures,
  `assets/rooms/`)
- ✅ Others walk room to room and sometimes stop to chat ("..." bubbles)
- ✅ Characters without a drawing yet: their coloured circle as a paper badge
- ✅ Drawings cut out like stickers (`tools/image-fix/cutout.gd` ->
  `assets/puppets/`); they wobble as they walk
- Gate: Sam plays it

## Recruiting ✅ (v0.6.2)
Sam, 2026-10-24: on the first night the Traitors recruit a 4th instead of
murdering. A Traitor Sam picks (the others suggest people nobody
suspects); otherwise the computer Traitors pick, and if they pick Sam he
becomes a Traitor (no choice). Whoever is picked says yes. Balance stays in
band with four Traitors.

## Room sounds ✅ (v0.7.4)
Gareth: background sounds for each room. Quiet chatting in the great hall,
birds in the garden, cooking in the kitchen, a ticking clock in the
library; they loop softly and fade between rooms (`docs/sound-spec.md`).

## Phase 5: Missions and the prize pot
Mini-games in the day that win money for the pot. Sam's 13 missions are in
`docs/missions.md`. Built (v0.8.0): the daily mission, the pot, the shield,
Castle Bells and Chilli Pie Shuffle. v0.9.0: the 12-day rules. v0.9.2: the
slow-motion walk to the Round Table (Sam). v0.10.0: Catapults and the
Cooking Challenge. v0.11.0: all 13 missions built. Next: Sam plays them.

## Phase 6: A whole game, with saving
Days and nights until the end; who wins the pot; the game remembers where
you got to. Built (2026-10-25): saving at the start of each day with "Carry on"
(v0.13.0); the final after day 12, like the TV show (everyone votes to end
it or banish again), then the big reveal, the pot shared by the winners, a
party, and every Traitor of the game (v0.14.0). Next: Sam plays a whole
game.

## Phase 7: Look and sound
Anything else for the look and sound, once the game is fun. Started
2026-10-25 at Gareth's request: the storybook look (Sam's pick: chunky
squashy buttons, Fredoka and Luckiest Guy fonts, outlined purple panels;
v0.15.0).

## Sam's character drawings ✅ all 22 (2026-10-24)
Added as they come in. Done: 22 of 22 (Captain Puddle, Granny Gumdrop, Professor Fizz, Ruby Rails, Chef Pepper, Sir Reginald Waffle, Doctor Plaster, Lola Loud, Farmer Fern, Detective Dot, Benny Biscuit, Madame Mystic, Tiny Tom, Zara Zoom, Mr Grumble, Penny Pockets, Coach Kick, Stationmaster Stan, Ivy Inkwell, Max Muddle, Olive Oddsocks, Barry Banjo).

## Phase 8: Multiplayer (OK'd by Gareth 2026-10-29)
Single player or multiplayer at the start; host or join with a 4-symbol
code; up to all 22 real players, everything together, roles kept secret;
through Gareth's own Firebase project. Built all at once over several
sessions (Sam and Gareth's choice): see `docs/multiplayer-spec.md`.
Done so far: the start screens, host and join with the code, and the
lobby, working between real devices through Firebase (v0.21.0; Gareth's
project set up 2026-10-29); every change to the game is an engine
decision (v0.22.0); multiplayer games play in step on every device:
missions, castle, Round Table, nights, the final (v0.23.x; tried for real
in two tabs through Firebase). Then: the waiting sign and
"Don't wait" (v0.24.0), rejoining (v0.25.0). Next: Sam and Gareth play it
for real on several devices.

