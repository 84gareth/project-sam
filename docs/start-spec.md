# Phase 2 spec: start at the station, choose who you are

From Sam's pitch (2026-10-24): you start at Havenbrook Station, choose one
of the 22 characters, and choose Faithful or Traitor.

## Screens
1. **Station**: Sam's picture fills the screen. Big "Start" button.
2. **Who do you want to be?** All 22 characters as cards (a coloured
   badge with their initials, their name, and their line). Tap one to pick
   it, then "Choose".
3. **Ready**: the game tells you who you are and your secret: "You are
   Chef Pepper. You are a Faithful." (or "You are a Traitor. Shh!") and "The
   train to the castle leaves soon..." (the castle is the next phase).
   (v0.2.0 had a "Faithful or Traitor?" screen; Sam changed his mind:
   "the game tells you ... you dont pick", v0.2.1.)

## Rules (pure, `js/game.js`)
- A new game has all 22 characters. Exactly 3 are Traitors, dealt fairly
  among all 22 (you included), seeded so tests are repeatable. `?seed=N` in
  the address fixes the deal (the live tests use it).

## Not yet
Pictures of the characters, saving, the castle, missions, voting, the night
train: later phases.
