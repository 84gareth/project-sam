# The 22 characters ✅ all approved

Made up by Claude, 2026-10-24. Sam approved every one: "put all of them
in the game!!!" The game's copy is `js/characters.js`.

## Sam's drawings
Gareth sends photos as Sam finishes them. Every new drawing also needs its
puppet cut-out for the castle:
`Godot --headless --path tools/image-fix --script res://cutout.gd -- "$PWD" <id>`
(run from the project folder; run it under bash, as zsh won't split a list
of ids). Messy backgrounds: `clean_paper.gd`
keeps only pen (dark) and crayon (colourful) and makes the rest plain paper;
`fix_edge.gd` paints out a cut line; `paint_rect.gd` a box (all in
`tools/image-fix/`). Each is cropped to the drawing
(`sips -c <h> <w> --cropOffset <y> <x>`, then `sips -Z 700`), saved as
`assets/characters/<id>.jpg`, and listed as `picture` in
`js/characters.js`. A test fails if a listed picture is missing.

Done: ALL 22 (2026-10-24):
- Captain Puddle (2026-10-24: pirate hat with a "no water" sign, peg leg,
  skull shirt; re-photographed without the shadow)
- Granny Gumdrop (2026-10-24: purple dress, hair in a bun, a bag of sweets)
- Professor Fizz (2026-10-24: goggles, lab coat and tie, an exploding flask)
- Ruby Rails (2026-10-24: stripy driver's cap and overalls)
- Chef Pepper (2026-10-24: chef's hat, a pie full of secret chillies)
- Sir Reginald Waffle (2026-10-24: waffle armour, waffle shield, waffle sword)
- Doctor Plaster (2026-10-24: a doctor's hat and coat with red crosses)
- Lola Loud (2026-10-24: pink cap, microphone on a stand; the cut paper
  edge painted out with `tools/image-fix/fix_edge.gd`)
- Farmer Fern (2026-10-24: straw hat, a piece of straw to chew, the goat on a lead)
- Detective Dot (2026-10-24: deerstalker hat, pipe, magnifying glass; the
  tablecloth at the edge painted out with `tools/image-fix/paint_rect.gd`)
- Benny Biscuit (2026-10-24: baker's hat, a biscuit in each hand)
- Madame Mystic (2026-10-24: a crown, a long blue dress, a crystal ball)
- Tiny Tom (2026-10-24: very long legs; cut-out paper cleaned with
  `tools/image-fix/clean_paper.gd` then `fix_edge.gd ... hard=30`)
- Zara Zoom (2026-10-24: helmet, racing bike, the Olympic rings on her jersey)
- Mr Grumble (2026-10-24: glasses, a grumpy face, a walking stick)
- Penny Pockets (2026-10-24: green cloak, a belt of pockets, a shiny blue gem)
- Coach Kick (2026-10-24: striped kit, shouting through a megaphone, a red card)
- Stationmaster Stan (2026-10-24: cap, big moustache, blowing his whistle)
- Ivy Inkwell (2026-10-24: glasses, a pencil and a notebook)
- Max Muddle (2026-10-24: scratching his head under a big question mark;
  tablecloth photo: `paper_only.gd`, `clean_paper.gd`, two `paint_rect.gd`)
- Olive Oddsocks (2026-10-24: one green-striped sock, one black shoe)
- Barry Banjo (2026-10-24: big black hair, his banjo, a banjo on his shirt)

Cut-outs redone 2026-10-24 (Gareth: Lola Loud cut too much, Ruby had
shadow blobs): cutout.gd ignores grey photo shadows and drops floating
specks; Lola rebuilt from her original photo and cut with `grow=16`; Ruby's
photo cleaned with `clean_paper.gd` first.

Redrawn with more detail (coloured faces), 2026-10-24: Tiny Tom (photo on a
tablecloth: `paper_only.gd` then `clean_paper.gd`), Zara Zoom, Madame Mystic.

| # | Name | About them |
|---|------|-----------|
| 1 | Captain Puddle | A sailor who is scared of water. |
| 2 | Granny Gumdrop | Loves sweets and knitting. |
| 3 | Professor Fizz | A scientist. Things often go bang. |
| 4 | Ruby Rails | Drives the trains. |
| 5 | Chef Pepper | Sneaks chilli peppers into his pies. Says they're strawberries! (Sam's line, 2026-10-24) |
| 6 | Sir Reginald Waffle | A posh knight. His armour and sword are made of waffles! (Sam's line, 2026-10-24) |
| 7 | Doctor Plaster | A doctor with plasters for everything. |
| 8 | Lola Loud | A singer who never stops singing. |
| 9 | Farmer Fern | Takes her goat everywhere. |
| 10 | Detective Dot | Always has a magnifying glass. |
| 11 | Benny Biscuit | A baker who loves biscuits. |
| 12 | Madame Mystic | Says she can see the future. |
| 13 | Tiny Tom | Very, very tall. |
| 14 | Zara Zoom | A racing cyclist. |
| 15 | Mr Grumble | Grumpy, but kind inside. |
| 16 | Penny Pockets | Collects shiny things. |
| 17 | Coach Kick | A football coach. Shouts a lot. |
| 18 | Stationmaster Stan | Runs Havenbrook Station. Loves his whistle. |
| 19 | Ivy Inkwell | Writes stories. |
| 20 | Max Muddle | Always gets lost. |
| 21 | Olive Oddsocks | Never wears socks that match. |
| 22 | Barry Banjo | Plays the banjo. Badly. |

**Drawings with holes in** (like Sam's shield necklace): use
`tools/image-fix/ink_only.gd <photo> <out.png> [height] [edge]`. It keeps
only strong pen and marker, drops paper, shadows and specks, and adds a
thin white sticker edge (cutout.gd would keep the paper inside the loop).
