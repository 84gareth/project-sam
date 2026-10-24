// The 22 characters, all approved by Sam on 2026-10-24
// (docs/characters.md). Pure data: no page code.
// `picture`: Sam's drawing, once he's done it (assets/characters/<id>.jpg).
// Without one, the game shows a coloured circle with their initials.

export const CHARACTERS = [
  { id: "puddle", name: "Captain Puddle", about: "A sailor who is scared of water.", colour: "#2f6fb3",
    picture: "assets/characters/puddle.jpg" },
  { id: "gumdrop", name: "Granny Gumdrop", about: "Loves sweets and knitting.", colour: "#d4548e",
    picture: "assets/characters/gumdrop.jpg" },
  { id: "fizz", name: "Professor Fizz", about: "A scientist. Things often go bang.", colour: "#7a4fc9",
    picture: "assets/characters/fizz.jpg" },
  { id: "ruby", name: "Ruby Rails", about: "Drives the trains.", colour: "#c0392b",
    picture: "assets/characters/ruby.jpg" },
  { id: "pepper", name: "Chef Pepper", about: "Sneaks chilli peppers into his pies. Says they're strawberries!", colour: "#e67e22",
    picture: "assets/characters/pepper.jpg" },
  { id: "waffle", name: "Sir Reginald Waffle", about: "A posh knight. His armour and sword are made of waffles!", colour: "#7f8c8d",
    picture: "assets/characters/waffle.jpg" },
  { id: "plaster", name: "Doctor Plaster", about: "A doctor with plasters for everything.", colour: "#16a085" },
  { id: "lola", name: "Lola Loud", about: "A singer who never stops singing.", colour: "#e84393" },
  { id: "fern", name: "Farmer Fern", about: "Takes her goat everywhere.", colour: "#3f8f3a" },
  { id: "dot", name: "Detective Dot", about: "Always has a magnifying glass.", colour: "#34495e" },
  { id: "benny", name: "Benny Biscuit", about: "A baker who loves biscuits.", colour: "#b9770e" },
  { id: "mystic", name: "Madame Mystic", about: "Says she can see the future.", colour: "#6c3483" },
  { id: "tom", name: "Tiny Tom", about: "Very, very tall.", colour: "#1abc9c" },
  { id: "zara", name: "Zara Zoom", about: "A racing cyclist.", colour: "#f1c40f" },
  { id: "grumble", name: "Mr Grumble", about: "Grumpy, but kind inside.", colour: "#5d6d7e" },
  { id: "penny", name: "Penny Pockets", about: "Collects shiny things.", colour: "#d4ac0d" },
  { id: "kick", name: "Coach Kick", about: "A football coach. Shouts a lot.", colour: "#27ae60" },
  { id: "stan", name: "Stationmaster Stan", about: "Runs Havenbrook Station. Loves his whistle.", colour: "#1f3a5f" },
  { id: "ivy", name: "Ivy Inkwell", about: "Writes stories.", colour: "#2e86c1" },
  { id: "max", name: "Max Muddle", about: "Always gets lost.", colour: "#a04000" },
  { id: "olive", name: "Olive Oddsocks", about: "Never wears socks that match.", colour: "#808b38" },
  { id: "barry", name: "Barry Banjo", about: "Plays the banjo. Badly.", colour: "#ca6f1e" },
];

// "Chef Pepper" -> "CP"; one-word names give one letter.
export function initials(name) {
  return name.split(" ").filter((w) => w.length > 0).map((w) => w[0]).join("").slice(0, 2);
}
