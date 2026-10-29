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

## How it works

**The host's device runs the real game.** It holds the whole `game` (the
same object single player uses) and makes every decision with the same pure
rules (castle.js, missions.js). Every other device is a window onto it: it
shows what its player is allowed to see and sends that player's taps to the
host. Nothing else changes the game.

**Secrets stay secret.** The host sends each player only what they may know:
their own side, their fellow Traitors if they are one, their own letters.
Other players' sides are never sent to a device that shouldn't have them, so
you can't peek by reading the data.

**The code.** Four symbols from a set of eight drawn icons (8^4 = 4,096
codes). It names the room in Firebase. Codes are thrown away after a game.

## Firebase layout (Realtime Database)

    rooms/<code>/                  everyone in the room can read
      host: <uid>                  only the host writes the room
      seats/<uid>: { character, joined }   each player writes their own
      public: { phase, day, ... }  what everyone may see
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
