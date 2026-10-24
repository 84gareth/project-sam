// Every character has their own voice, the same every time.
import { test, assert } from "../framework.js";
import { CHARACTERS } from "../../js/characters.js";
import { voiceFor } from "../../js/voice.js";

test("voices stay in a friendly range and never change", () => {
  for (const c of CHARACTERS) {
    const v = voiceFor(c.id);
    assert.ok(v.pitch >= 0.7 && v.pitch <= 1.5, `${c.name} pitch ${v.pitch}`);
    assert.ok(v.rate >= 0.9 && v.rate <= 1.15, `${c.name} rate ${v.rate}`);
    assert.eq(voiceFor(c.id), v);
  }
});

test("characters sound different from each other", () => {
  const pitches = new Set(CHARACTERS.map((c) => voiceFor(c.id).pitch.toFixed(2)));
  assert.gt(pitches.size, 15, `${pitches.size} different pitches for 22 people`);
});
