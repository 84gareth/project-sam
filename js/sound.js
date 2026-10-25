// Sound effects: real recordings from Mixkit (free licence, OK'd by Gareth
// 2026-10-24; docs/sound-spec.md). Played with the Web Audio API so quick
// clicks can overlap. iPad Safari only plays sound after a tap, so the
// first tap anywhere switches sound on (unlockSounds).

import { FAST } from "./ui.js";

// name -> [file, longest it plays for (s), volume]
const SOUNDS = {
  click: ["click.mp3", 1.2, 0.5],
  chalk: ["chalk.mp3", 1.2, 0.35],
  drumRoll: ["drum-roll.mp3", 6.0, 0.9],
  boo: ["boo.mp3", 5.0, 0.7],
  crying: ["crying.mp3", 5.0, 0.6],
  cheering: ["cheering.mp3", 5.0, 0.7],
  night: ["night.mp3", 6.0, 0.6],
  letter: ["letter.mp3", 1.2, 0.9],
  train: ["train.mp3", 5.0, 0.8],
  walk: ["walk-drums.mp3", 12.0, 0.8],   // the slow walk to the Round Table (Gareth's pick)
};

let audio = null;
const buffers = {};

// Call from the first tap: makes the audio player and loads every sound.
export function unlockSounds() {
  if (audio) return;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    return;
  }
  for (const [name, [file]] of Object.entries(SOUNDS)) {
    fetch(`assets/sounds/${file}`)
      .then((r) => r.arrayBuffer())
      .then((data) => audio.decodeAudioData(data))
      .then((buf) => { buffers[name] = buf; })
      .catch(() => { /* this sound just stays silent */ });
  }
}

// Play a sound. Resolves when it has finished (or been cut short with a
// fade). Silent, but still waits, if sound isn't ready.
export function play(name) {
  const [, longest, volume] = SOUNDS[name];
  const buf = buffers[name];
  const seconds = buf ? Math.min(buf.duration, longest) : longest;
  if (buf && audio) {
    const src = audio.createBufferSource();
    src.buffer = buf;
    const gain = audio.createGain();
    const now = audio.currentTime;
    gain.gain.setValueAtTime(volume, now);
    if (buf.duration > longest) {
      gain.gain.setValueAtTime(volume, now + longest - 2.0);
      gain.gain.linearRampToValueAtTime(0, now + longest);
    }
    src.connect(gain).connect(audio.destination);
    src.start(now);
    src.stop(now + seconds);
  }
  return new Promise((resolve) => setTimeout(resolve, FAST ? 0 : seconds * 1000));
}

// The drum roll before the reveal: a real one this time (the made-up one
// "sounds a bit broken like its glitching", Gareth).
export const drumRoll = () => play("drumRoll");

// ─── Room sounds (Gareth, 2026-10-24: "background sound effects appropriate
// to each room") ─────────────────────────────────────────────────────────────
// Each loops quietly while Sam is in that room and fades when he leaves it.
const ROOM_SOUNDS = {
  hall: ["room-hall.mp3", 0.22],       // people chatting quietly
  garden: ["room-garden.mp3", 0.35],   // birds singing
  kitchen: ["room-kitchen.mp3", 0.25], // cooking sizzling
  library: ["room-library.mp3", 0.3],  // a quiet ticking clock
  // The Round Table's crackling fire. The recording is very quiet (loudest
  // point 0.08, measured 2026-10-25), so it needs a big boost to be heard
  // (Gareth, twice: "I can't hear the fireplace").
  table: ["room-table.mp3", 11],
};
const roomBuffers = {};
let roomNow = null;   // { room, src, gain }

function loadRooms() {
  for (const [room, [file]] of Object.entries(ROOM_SOUNDS)) {
    if (roomBuffers[room]) continue;
    fetch(`assets/sounds/${file}`)
      .then((r) => r.arrayBuffer())
      .then((data) => audio.decodeAudioData(data))
      .then((buf) => { roomBuffers[room] = buf; if (roomNow && roomNow.room === room && !roomNow.src) setRoomSound(room, true); })
      .catch(() => {});
  }
}

// Play `room`'s sound (or none, with null), fading across over a second.
export function setRoomSound(room, force = false) {
  if (!force && (roomNow ? roomNow.room : null) === room) return;
  document.body.dataset.roomSound = room || "";   // which one (live tests read it)
  if (roomNow && roomNow.src && audio) {
    const old = roomNow;
    old.gain.gain.setTargetAtTime(0, audio.currentTime, 0.3);
    setTimeout(() => { try { old.src.stop(); } catch { /* already stopped */ } }, 1500);
  }
  roomNow = room ? { room, src: null, gain: null } : null;
  if (!room || !audio) return;
  loadRooms();
  const buf = roomBuffers[room];
  if (!buf) return;   // starts when it has loaded
  const src = audio.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, audio.currentTime);
  gain.gain.setTargetAtTime(ROOM_SOUNDS[room][1], audio.currentTime, 0.4);
  src.connect(gain).connect(audio.destination);
  src.start();
  roomNow.src = src;
  roomNow.gain = gain;
}

// ─── Castle Bells: four made tones (no recordings needed) ──────────────────
const BELL_NOTES = [523.25, 659.25, 783.99, 1046.5];   // C, E, G, high C
export function bell(i) {
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = BELL_NOTES[i];
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 1.2);
}

// ─── Music (Gareth, 2026-10-25: "tense music during the round table") ──────
// One looping track at a time, under the room sounds, fading in and out.
const MUSIC = {
  table: ["music-round-table.mp3", 0.15],   // Mixkit 671 "Piano Horror" (loud: average 0.13)
};
const musicBuffers = {};
let musicNow = null;   // { name, src, gain }
export function setMusic(name) {
  if ((musicNow ? musicNow.name : null) === name) return;
  document.body.dataset.music = name || "";   // which one (live tests read it)
  if (musicNow && musicNow.src && audio) {
    const old = musicNow;
    old.gain.gain.setTargetAtTime(0, audio.currentTime, 0.5);
    setTimeout(() => { try { old.src.stop(); } catch { /* already stopped */ } }, 2500);
  }
  musicNow = name ? { name, src: null, gain: null } : null;
  if (!name || !audio) return;
  const start = () => {
    if (!musicNow || musicNow.name !== name || musicNow.src) return;
    const src = audio.createBufferSource();
    src.buffer = musicBuffers[name];
    src.loop = true;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.setTargetAtTime(MUSIC[name][1], audio.currentTime, 0.8);
    src.connect(gain).connect(audio.destination);
    src.start();
    musicNow.src = src;
    musicNow.gain = gain;
  };
  if (musicBuffers[name]) return start();
  fetch(`assets/sounds/${MUSIC[name][0]}`)
    .then((r) => r.arrayBuffer())
    .then((data) => audio.decodeAudioData(data))
    .then((buf) => { musicBuffers[name] = buf; start(); })
    .catch(() => { /* no music, then */ });
}
