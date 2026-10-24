# Sound effects (asked for 2026-10-24)

Gareth: the made-up drum roll "sounds a bit broken like its glitching";
find a free real one, and "sound effects for all the interactions/button
presses too to make it more like a proper game".

## Sam's choices
- A click on every button tap
- Chalk scribbles as each chalkboard goes up
- The drum roll (a real recording), then: a banished **Faithful** gets
  **crying and booing**; a banished **Traitor** gets **cheering**
- A spooky sound at night, and when the letter comes

## Source
Mixkit (mixkit.co) free sound effects. Gareth checked the licence ("the
sound licence is fine yes") and approved this list (2.8 MB) before download:

| File (`assets/sounds/`) | Mixkit sound | Used for | Plays up to |
|---|---|---|---|
| click.mp3 | 1109 Select click | every button tap | 1.2 s |
| chalk.mp3 | 2372 Chalk line sound | each chalkboard; the breakfast X | 1.2 s |
| drum-roll.mp3 | 566 Drum Roll | before "I am a..." | 6 s |
| boo.mp3 + crying.mp3 | 463 Crowd disappointment long boo, 465 Creature sad crying | a Faithful is banished | 5 s each, fade |
| cheering.mp3 | 462 Huge crowd cheering victory | a Traitor is banished | 5 s, fade |
| night.mp3 | 698 Spooky wind metal music | night falls; the Traitors' meeting | 6 s, fade |
| letter.mp3 | 1530 Paper slide | the murder letter | 1.2 s |

Code: `js/sound.js` (Web Audio; the first tap switches sound on, an iPad
rule).

## Voices
Sam's swap (2026-10-24): Professor Fizz gets Granny Gumdrop's voice and
she gets his (`js/voice.js`, SWAPS).

Gareth, later the same day: "all lines should be voiced ... Each character
needs its own voice it uses for every line it says." Now:
- Every character line is spoken in that character's voice: chat answers,
  the reveal, and each Traitor's idea at the secret meeting (queued, so they
  take turns).
- A storyteller voice (`narrate`) reads the big moments: who you are, each
  new day, the most votes, night falling, the letter, who was murdered at
  breakfast, and who won.
- The iPad's voices are sorted by name so each character always gets the
  same one, and the list is re-read when it arrives late.
- A Traitor talking to another Traitor whispers the truth ("Shh! ...").
Tested by listening in on what the page says (`test_castle_live.js`).
