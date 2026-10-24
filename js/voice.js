// Characters talk with the iPad's own voices (Web Speech). A button turns
// voices on or off (Sam: "you choose"); the choice is remembered.
// iPad Safari only speaks after a tap, so speak() is called from tap handlers.

import { CHARACTERS } from "./characters.js";

const KEY = "project-sam-voices";

function load() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
let on = load();

export const voicesOn = () => on;
export function setVoices(value) {
  on = value;
  try { localStorage.setItem(KEY, value ? "on" : "off"); } catch { /* private mode */ }
  if (!value && window.speechSynthesis) window.speechSynthesis.cancel();
}

// Sam's voice swaps: this character uses that character's voice.
// (2026-10-24: Professor Fizz should sound like Granny Gumdrop did.)
const SWAPS = { fizz: "gumdrop", gumdrop: "fizz" };

// Each character's voice: a pitch, a speed, and which of the iPad's English
// voices to use. Pure and fixed per character, so they always sound the same.
export function voiceFor(who) {
  const id = SWAPS[who] ?? who;
  const i = CHARACTERS.findIndex((c) => c.id === id);
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return {
    pitch: 0.7 + ((h % 1000) / 1000) * 0.8,          // 0.7 .. 1.5
    rate: 0.9 + (((h >>> 10) % 1000) / 1000) * 0.25,  // 0.9 .. 1.15
    voiceIndex: i,
  };
}

// Say `text` in character `id`'s voice (nothing happens with voices off,
// or where the browser can't speak).
export function say(text, id) {
  if (!on || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = voiceFor(id);
  const english = synth.getVoices().filter((x) => x.lang && x.lang.startsWith("en"));
  if (english.length > 0) u.voice = english[v.voiceIndex % english.length];
  u.pitch = v.pitch;
  u.rate = v.rate;
  synth.speak(u);
}
