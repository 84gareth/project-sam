// Every character has their own voice, the same every time.
import { test, assert } from "../framework.js";
import { CHARACTERS } from "../../js/characters.js";
import { voiceFor } from "../../js/voice.js";

test("voices stay in a friendly range and never change", () => {
  for (const c of CHARACTERS) {
    const v = voiceFor(c.id);
    assert.ok(v.pitch >= 0.7 && v.pitch <= 1.5, `${c.name} pitch ${v.pitch}`);
    assert.ok(v.rate >= 0.78 && v.rate <= 1.02, `${c.name} rate ${v.rate}`);
    assert.eq(voiceFor(c.id), v);
  }
});

test("characters sound different from each other", () => {
  const pitches = new Set(CHARACTERS.map((c) => voiceFor(c.id).pitch.toFixed(2)));
  assert.gt(pitches.size, 15, `${pitches.size} different pitches for 22 people`);
});

test("Sam's swap: Professor Fizz has Granny Gumdrop's voice, and back", () => {
  const plain = (id) => { const v = voiceFor(id); return [v.pitch, v.rate]; };
  assert.ne(plain("fizz"), plain("gumdrop"), "they still sound different from each other");
  assert.ok(voiceFor("fizz").voiceIndex === 1, "Fizz uses Gumdrop's iPad voice");
  assert.ok(voiceFor("gumdrop").voiceIndex === 2, "Gumdrop uses Fizz's");
});

test("Zara Zoom talks slowly enough to follow", () => {
  assert.lt(voiceFor("zara").rate, 0.85);
});
