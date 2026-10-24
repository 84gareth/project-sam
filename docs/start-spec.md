# Phase 2 spec: start at the station, choose who you are

From Sam's pitch (2026-10-24): you start at Havenbrook Station, choose one
of the 22 characters, and choose Faithful or Traitor.

## Screens
1. **Station**: Sam's picture fills the screen. Big "Start" button.
2. **Who do you want to be?** All 22 characters as cards (a coloured
   badge with their initials, their name, and their line). Tap one to pick
   it, then "Choose".
3. **Faithful or Traitor?** Two big buttons, each with one simple line:
   Faithful: "Catch the 3 Traitors." Traitor: "Don't get caught!"
4. **Ready**: "You are Chef Pepper. You are a Faithful." and "The train to
   the castle leaves soon..." (the castle is the next phase).

## Rules (pure, `js/game.js`)
- A new game has all 22 characters. Exactly 3 are Traitors: you plus 2
  others if you chose Traitor, 3 others if you chose Faithful. Which others
  is random, but seeded, so tests are repeatable.

## Not yet
Pictures of the characters, saving, the castle, missions, voting, the night
train: later phases.
