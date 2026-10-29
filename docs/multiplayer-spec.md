# Phase 8: Multiplayer (spec)

Sam and Gareth, 2026-10-29. "When starting a new game you can choose single
player or multiplayer with icons on the buttons. If you choose multiplayer
you have to either host or join a game. If you host you get given a 4 part
code which is made of symbols. Others have to enter that code to join you.
Everyone chooses a character but has to keep their role secret from each
other (playing locally in the same house)."

Decisions (their answers):
- Connector: **Firebase** (Gareth's own free project). Talked to over its
  plain web address (REST and live updates), so no library is added.
- Together: **everything** (chats, missions, Round Table, nights, final).
- Players: **up to all 22** real players; computer players fill the rest.
- Built **all at once**, over several sessions, before Sam plays it.

## How it works (as built, v0.25)

**Every change to the game is a numbered decision** (`js/engine.js`):
the mission result, what each player says, the vote, the whole night, the
final, and "ready" points (to the table, after the reveal, start of day).
Each device writes its player's part of decision k to its own seat; the
host, once every real player still in has answered k, writes decision k to
the room's log (`js/net-engine.js`); every device, the host too, applies
the log in order with the same rules. So every device has the same game.
Single player is the same engine with one player, decided at once.

**Secrets (changed from the first plan; told to Gareth 2026-10-29).** Every
device works the whole game out, so every device holds everyone's sides in
memory. Each screen only ever shows its own player's side, fellow Traitors
and letters, and secret lines (your side, Traitor talk, the recruiting
letter) are shown but never spoken aloud. Someone with developer tools
could dig the sides out; fine for a family game in one house, and far
simpler than the host sending each device its own view.

**Waiting, stuck players, rejoining.** A sign says who everyone's waiting
for; the host can tap "Don't wait" (their part is left out). A device that
reloads or sleeps can "Rejoin your game" from the station: it catches up
from the log and carries on at the right screen (`resumePoint`).

**Real players in the castle** walk about like everyone else; tapping one
says to talk to them for real.

**The code.** Four symbols from a set of eight drawn icons (8^4 = 4,096
codes). It names the room in Firebase.

## Firebase layout (Realtime Database)

    rooms/<code>/                  everyone in the room can read
      host: <uid>                  only the host writes the room
      seats/<uid>: { character, joined, act: { k, t, data } }
                                   each player writes their own
      play: { seed, humans, uids } the deal (host, at Start)
      log: [ { t, parts } ... ]    the decisions, in order (host)
    secrets/<code>/<uid>: { side, fellows, letter, ... }
                                   only that player and the host can read;
                                   only the host writes
    inbox/<code>/<uid>/<id>: { type, ... }
                                   a player's taps (votes, night picks):
                                   only that player writes, only they and
                                   the host can read

Secrets and taps live outside `rooms`, because Firebase can't hide part of
something a player is allowed to read. Every device signs in anonymously
(no names, no accounts for the players). The rules Gareth pastes are in
the chat message of 2026-10-29 and below.

    {
      "rules": {
        "rooms": {
          "$code": {
            ".read": "auth != null",
            ".write": "auth != null && (!data.exists() || data.child('host').val() === auth.uid)",
            "seats": { "$uid": { ".write": "auth != null && auth.uid === $uid" } }
          }
        },
        "secrets": {
          "$code": {
            "$uid": {
              ".read": "auth != null && (auth.uid === $uid || root.child('rooms').child($code).child('host').val() === auth.uid)",
              ".write": "auth != null && root.child('rooms').child($code).child('host').val() === auth.uid"
            }
          }
        },
        "inbox": {
          "$code": {
            "$uid": {
              ".read": "auth != null && (auth.uid === $uid || root.child('rooms').child($code).child('host').val() === auth.uid)",
              ".write": "auth != null && auth.uid === $uid"
            }
          }
        }
      }
    }

## Phases in a day, with several real players

1. **Mission** (from day 2): everyone plays it on their own device at the
   same time; the host waits for every score (or 2 minutes), then shares
   the pot and the shields.
2. **Castle**: each device runs its own castle (walking, chatting with
   computer players, joining chats). Real players can tap each other too and
   pick a line to say. When a player taps "Go to the Round Table" they wait
   until everyone has, or the host's "Everyone to the table".
3. **Round Table**: the talk is made by the host; each real player picks
   what to say; everyone votes on their own device; the chalkboards and the
   reveal play on every device together.
4. **Night**: real Traitors meet: each picks, the host takes the most-picked
   (ties: the first pick). Recruit/murder choice the same way. Faithful
   players wait for a letter.
5. **Breakfast**, then the next day.
6. **The final**: each real player picks their line at the fire pit, in turn.

## Steps of the build (all before Sam plays)

1. Start screen: Single player / Multiplayer (icons); Host / Join; the
   symbol code; the lobby (who's in, pick characters, Start).
2. A "transport" with two versions behind one face: Firebase, and a local
   one (between browser tabs) for building and for tests.
3. The host loop: phases, collecting actions, sending each player's view.
4. Each phase above, one by one, for real players.
5. Leaving and rejoining (a device sleeps, a page reloads).

## Gareth's setup (once)

Create a free Firebase project, turn on Anonymous sign-in and the Realtime
Database, paste the rules, and send Claude the web config. Step by step
instructions are in the chat message that asked for it (2026-10-29).
