# Phase 3 spec: a day at the castle

## Sam's answers (2026-10-24)
| Topic | Sam's call |
|-------|-----------|
| Chatting | **Tap and ask**: tap a person, pick a question, they answer |
| Spotting Traitors | **Little fibs** and **blaming others** |
| How many chats | **As many as you like** each day |
| Questions you can ask | **"Show me your list"** (every player keeps a list of who they think the Traitors are), **"Who do you suspect?"**, **"Are you a Traitor?"**, **"Who will you vote for?"** |
| Voting | **Tap their picture** at the Round Table |
| Banished | **Drum roll, then tell**: "I am a... FAITHFUL!" Then they leave. |
| Voices | **You choose**: a button turns voices on or off. Characters' talking is read aloud with the iPad's own voices. |
| Castle picture | Claude wrote a prompt; Gareth made it (`assets/castle.jpg`), plus the Round Table room (`assets/round-table.jpg`) |
| Chalkboards | Sam: "they all need to have a chalk board for who theyre going to write down". Drawn by the game, not the picture: every vote is shown as a chalkboard |

## How the sneaky bits work (Claude's proposal; Sam to check by playing)
Every computer player keeps a **suspect list**: everyone else, most
suspected first. That list is what they show you, and what they vote from.

- **Faithfuls are honest.** Their list is their real guess. It starts as a
  hunch and changes as things happen: who voted for someone who turned out
  to be Faithful, who got caught fibbing, who blamed whom.
- **Traitors fib.** Their list never puts another Traitor near the top; it
  points at Faithfuls instead (**blaming others**). Asked "Are you a
  Traitor?", everyone says no, Traitors included.
- **Fibs you can catch:** a Traitor might say "I'll vote for Max" and then
  vote for someone else; or their answer to "Who do you suspect?" doesn't
  match the list they show you. Watching the votes (Sam, interview 1)
  is how you catch them.
- **Traitors stick together** at the Round Table: they vote for the same
  Faithful, which a sharp player can spot.
- If **Sam is a Traitor**, he sees who the other two are, and the others'
  lists can point at him. He has to avoid being voted out.

## The day, screen by screen
1. Arrive at the castle (its picture), with everyone still in the game.
2. **Chat**: everyone as cards (Sam's drawings or circles). Tap one, pick a
   question, they answer in a speech bubble (and out loud, if voices are
   on). Chat to as many as you like, then "Go to the Round Table".
3. **Round Table**: tap who you think is a Traitor. Everyone else votes
   too, one by one: "Captain Puddle votes for Max Muddle."
4. **Banished**: the most votes leaves (a tie: a fair, seeded coin flip
   between the tied players). Drum roll, then "I am a...
   FAITHFUL!" or "TRAITOR!"
5. Back to a new day (the night train comes in Phase 4).

## Balance as built (v0.3.0, measured over 300 computer-only games)
Traitors vote with their team 60% of the time (always was too easy to
spot: Faithfuls won in a median 5 days). Faithfuls who voted out a Faithful
become +0.12 more suspicious to the others. Result: day 1 catches a Traitor
about 7% of the time (a guess); days 2-6 about 38%; all three caught in a
median 8 days. The Traitors can't win yet: that needs the night train
(Phase 4). Numbers: `js/castle.js`; bands: `tests/unit/test_castle.js`.

## Testing it (balance measured, not vibed)
The suspicion and voting rules live in pure code, so a test can play
hundreds of Round Tables and check bands, like: Faithful computer players
find a Traitor more often than chance, but not every time.

## Round Table talk and vote counts (Gareth, 2026-10-24, v0.5.3)
"Some conversation with options for us to join in during the round table
before we all vote", and "stop for a vote count a few times during the
chalk board reveals".
- Before the vote, two people accuse someone (whoever they plan to vote
  for), and each accused person sticks up for themselves, all spoken.
- Sam then picks: agree with an accusation, stick up for someone, defend
  himself if accused, or stay quiet. Honest players listen: an accusation
  makes them a little more suspicious of that person (+0.12), sticking up
  for someone a little less; the one Sam accused starts to suspect Sam.
- During the chalkboards, every 6 votes the game stops and shows the votes
  so far (top 3) on a big chalkboard, read out by the storyteller.
