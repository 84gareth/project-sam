# Phase 4 spec: the night

Sam and Gareth, 2026-10-24: "It needs a room where the traitors can meet and
plan their murders. The last person at breakfast is murdered. The faithfuls
get a letter in the room to find out by order of the traitors you have been
murdered." Then, from the questions:
- The word is **murdered**, like the TV show (this replaces "sent home on
  the night train" from the first interview). Nobody is hurt: it's a letter.
- If Sam is a Traitor, **he picks**; the other Traitors give ideas.
- People arrive at breakfast **in little groups** (2 or 3), like the show.
- Pictures: Claude writes prompts for the Traitors' room and the breakfast
  room. Until they arrive, the Traitors' room is the castle picture, dark,
  and breakfast is the Round Table room.

## How it works (`js/castle.js`)
- After the Round Table reveal: "Night falls...".
- A Faithful Sam waits in his room. Either "Phew! No letter for you
  tonight." or the letter: "By order of the Traitors, you have been
  murdered." (game over).
- A Traitor Sam goes to the secret meeting: each other Traitor suggests
  someone ("They're getting close to us!"), Sam taps who, "Send the letter".
- The computer Traitors pick the Faithful who suspects them most.
- Breakfast: groups walk in; then "X never came to breakfast. X was
  murdered by the Traitors!" Then a new day, or the end.
- The Traitors win when there are as many Traitors as Faithfuls.

## Tactical voting (Gareth, same day)
"More intrigue/tactical play/picking someone they think might get more
votes to save them." Faithfuls now have a plan each day: honest (50%),
follow the crowd if the front-runner is in their own top 3 (25%), stay safe
by piling on the front-runner when people suspect them (10%), or unsure
between two (15%). They never fib: they vote how they said. Traitors give
the same kinds of answers but fib about half the time.

Balance (300 computer-only games): the Faithfuls win about 60% (72% before
tactical voting; following the crowd let the Traitors steer them too much
until it was limited to a top-3 suspect). A game lasts about 9 days.

## Recruiting (Sam, later the same day, v0.6.2)
Night 1 is a recruiting night, not a murder: see `docs/roadmap.md`. A
recruited Sam gets a letter: "By order of the Traitors, you are now a
Traitor! Your fellow Traitors are ...". Breakfast after it: "Everyone came
to breakfast! Nobody was murdered last night... strange!"

## 12 days (v0.9.0)
The night rules changed with missions: see `docs/missions.md`, "The
12-day rules". In short, murders every other night, recruiting at 2
Traitors up to night 5, and no early Traitor win.
