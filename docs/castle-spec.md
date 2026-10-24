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
| Castle picture | Claude writes a prompt; Gareth makes the picture to match the station |

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
4. **Banished**: the most votes leaves (a tie: the first tied player in
   the vote order... to be decided by playing). Drum roll, then "I am a...
   FAITHFUL!" or "TRAITOR!"
5. Back to a new day (the night train comes in Phase 4).

## Testing it (balance measured, not vibed)
The suspicion and voting rules live in pure code, so a test can play
hundreds of Round Tables and check bands, like: Faithful computer players
find a Traitor more often than chance, but not every time.
