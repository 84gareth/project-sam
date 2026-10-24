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

// The iPad's English voices, in a fixed order (by name), so each character
// always gets the same one. The list can arrive late, so it's re-read when
// the browser says it has changed.
let english = [];
function loadVoices() {
  if (!window.speechSynthesis) return;
  english = window.speechSynthesis.getVoices()
    .filter((x) => x.lang && x.lang.startsWith("en"))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

// The storyteller who reads out the big moments (not a character).
export const NARRATOR = "narrator";

// Say `text` in character `id`'s voice: the same voice for every line they
// say (Sam). `queue`: wait for whoever is talking to finish, instead of
// interrupting. Nothing happens with voices off, or where it can't speak.
export function say(text, id, { queue = false } = {}) {
  if (!on || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const synth = window.speechSynthesis;
  if (!queue) synth.cancel();
  if (english.length === 0) loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  const v = id === NARRATOR ? { pitch: 1.0, rate: 0.95, voiceIndex: CHARACTERS.length } : voiceFor(id);
  if (english.length > 0) u.voice = english[v.voiceIndex % english.length];
  u.lang = u.voice ? u.voice.lang : "en-GB";
  u.pitch = v.pitch;
  u.rate = v.rate;
  synth.speak(u);
}

export const narrate = (text, opts) => say(text, NARRATOR, opts);
