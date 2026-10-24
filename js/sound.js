// The drum roll before someone says if they were a Faithful or a Traitor
// (Sam's choice). Made from noise with the Web Audio API: no sound files.

let audio = null;

// Resolves when the roll ends (`ms` long). Silent where audio can't play.
export function drumRoll(ms = 2200) {
  return new Promise((resolve) => {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      const noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.05), audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      // Hits get closer together and louder, then one big crash.
      let t = 0, gap = 0.12;
      while (t < ms / 1000 - 0.2) {
        hit(noise, now + t, 0.25 + 0.5 * (t / (ms / 1000)));
        t += gap;
        gap = Math.max(0.035, gap * 0.93);
      }
      hit(noise, now + ms / 1000 - 0.1, 1.0);
    } catch { /* no audio here: just wait */ }
    setTimeout(resolve, ms);
  });
}

function hit(buffer, when, volume) {
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const gain = audio.createGain();
  gain.gain.value = volume;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(when);
}
