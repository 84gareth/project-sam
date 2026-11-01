// How each character talks (Gareth, 2026-10-24: "much more variety in the
// dialogue ... the characters should somewhat reflect their personalities").
// Pure data plus a helper that dresses up a line in a character's own way:
// sometimes an opener ("Arr!"), sometimes a little extra at the end.

export const PERSONALITY = {
  puddle: { openers: ["Arr!", "Ahoy!", "Shiver me timbers!"],
    extras: ["Just keep that water away from me.", "I'd rather walk the plank than go near a puddle.", "Steady as she goes."] },
  gumdrop: { openers: ["Oh, my dear!", "Goodness me!", "Ooh, sweetie!"],
    extras: ["Would you like a sweetie?", "I knitted a scarf while I was thinking about it.", "Granny knows best!"] },
  fizz: { openers: ["Fizzing fireworks!", "By my calculations...", "Eureka!"],
    extras: ["The science doesn't lie!", "Mind the goggles.", "Something's about to go BANG."] },
  ruby: { openers: ["Toot toot!", "All aboard this one:", "Right on schedule:"],
    extras: ["I never miss a train, and I never miss a Traitor.", "Full steam ahead!", "Mind the gap."] },
  pepper: { openers: ["Mmm!", "Hehe!", "Spicy!"],
    extras: ["Fancy a strawberry pie? Hehe.", "It's definitely strawberry. Definitely.", "Now THAT is a hot one!"] },
  waffle: { openers: ["I say!", "Good heavens!", "By my waffle sword!"],
    extras: ["A knight always tells the truth. Mostly.", "Pass the syrup.", "Tally-ho!"] },
  plaster: { openers: ["Doctor's orders:", "Hmm, let me check...", "Oh dear, oh dear."],
    extras: ["I've got a plaster for that.", "Take two biscuits and call me in the morning.", "Deep breaths, everyone."] },
  lola: { openers: ["La la la!", "Ooh, sing it!", "Darling!"],
    extras: ["That deserves a song!", "Hit it! La laaa!", "My voice is my secret weapon."] },
  fern: { openers: ["Ooh-arr!", "Well, now...", "Bless my boots!"],
    extras: ["My goat agrees. Don't you, goat?", "Back on the farm we'd sort this out.", "Baaa. That's the goat."] },
  dot: { openers: ["Elementary!", "Aha!", "Interesting..."],
    extras: ["My magnifying glass never lies.", "The clues are everywhere.", "Case nearly closed."] },
  benny: { openers: ["Crumbs!", "Oh, biscuits!", "Mmm, crunchy!"],
    extras: ["Anyone want a biscuit?", "That's the way the cookie crumbles.", "I bake when I'm nervous."] },
  mystic: { openers: ["I have seen it...", "The crystal ball says...", "Ooooh..."],
    extras: ["The spirits never lie.", "I see... a mystery.", "The future is cloudy. Like soup."] },
  tom: { openers: ["Hello down there!", "From up here...", "Mind your head!"],
    extras: ["I can see everything from up here.", "Being tall has its advantages.", "Duck! Oh wait, that's just me."] },
  zara: { openers: ["Zoom!", "Quick, quick!", "On your marks..."],
    extras: ["I'd race you to the Round Table.", "Gold medal thinking!", "Faster than a bicycle bell."] },
  grumble: { openers: ["Hmph.", "Bah!", "Grumble grumble..."],
    extras: ["Don't tell anyone I'm being nice.", "Now leave me alone.", "Kids these days."] },
  penny: { openers: ["Ooh, shiny!", "Psst!", "Look at this!"],
    extras: ["Want to see my shiny button?", "I keep my secrets in my pockets.", "Finders keepers!"] },
  kick: { openers: ["Oi!", "Listen up, team!", "Come on!"],
    extras: ["That's a red card!", "Back of the net!", "Run it again, faster!"] },
  stan: { openers: ["*Whistle*", "Attention please!", "Platform one:"],
    extras: ["Everything runs on time at my station.", "Tickets, please.", "Mind the doors!"] },
  ivy: { openers: ["Ooh, a plot twist!", "Let me write this down...", "Chapter one:"],
    extras: ["This would make a brilliant story.", "Every story needs a villain.", "Writing that one down."] },
  max: { openers: ["Erm...", "Wait, where am I?", "Oh! Hello!"],
    extras: ["Which way is the kitchen again?", "I think I've been in this room before.", "Sorry, I got lost."] },
  olive: { openers: ["Toe-tally!", "Odd, isn't it?", "Sock it to me!"],
    extras: ["Nothing matches in this castle. Like my socks.", "Odd things are going on.", "Have you seen my other sock?"] },
  barry: { openers: ["*Twang*", "Strum strum!", "Yee-haw!"],
    extras: ["I'll write a song about it. A bad one.", "*plays a wrong note*", "Twangalang!"] },
};

// Pick from a list with a random number.
export const pickOne = (list, r) => list[Math.floor(r() * list.length)];

// Dress up `line` the way `id` talks: about half the time an opener, about
// a third of the time an extra at the end.
export function inCharacter(id, line, r) {
  const p = PERSONALITY[id];
  if (!p) return line;
  let out = line;
  if (r() < 0.5) out = `${pickOne(p.openers, r)} ${out}`;
  if (r() < 0.35) out = `${out} ${pickOne(p.extras, r)}`;
  return out;
}
