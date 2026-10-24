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
      gain.gain.setValueAtTime(volume, now + longest - 0.8);
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
