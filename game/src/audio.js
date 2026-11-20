// Synthesized sound: WebAudio effects and a small procedural music loop, no
// audio files and no network. Everything is guarded, so a browser without
// audio (or a headless test) simply stays silent instead of throwing.

let context = null;
let musicTimer = null;
let musicStep = 0;
let muted = false;

function audio() {
  if (muted) return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Call once from a user gesture so the browser unlocks audio. */
export function unlockAudio() {
  audio();
}

export function setMuted(value) {
  muted = value;
  if (muted && musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

function tone(freq, seconds, type, volume, slideTo) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  } catch {
    // A failed blip is never worth breaking the game.
  }
}

function noise(seconds, volume, lowpass) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    // Silence on failure, as above.
  }
}

export const sfx = {
  shoot() {
    noise(0.09, 0.25, 3200);
    tone(880, 0.08, 'square', 0.08, 220);
  },
  hit() {
    tone(160, 0.12, 'sawtooth', 0.14, 70);
  },
  pickup() {
    tone(660, 0.09, 'sine', 0.16);
    setTimeout(() => tone(990, 0.12, 'sine', 0.16), 80);
  },
  cash() {
    tone(1320, 0.08, 'sine', 0.14);
    setTimeout(() => tone(1760, 0.14, 'sine', 0.14), 70);
  },
  mission() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.18), i * 90));
  },
  busted() {
    tone(220, 0.5, 'sawtooth', 0.16, 55);
    tone(110, 0.7, 'sawtooth', 0.12, 40);
  },
  engine() {
    tone(70, 0.18, 'sawtooth', 0.05, 120);
  },
  reload() {
    tone(440, 0.06, 'square', 0.08);
    setTimeout(() => tone(560, 0.06, 'square', 0.08), 110);
  },
  punch() {
    noise(0.07, 0.2, 900);
  },
  siren() {
    tone(700, 0.35, 'sine', 0.05, 950);
  },
};

// A slow minor-key bassline with a hat tick, one bar every 1.9 seconds.
const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];

export function startMusic() {
  if (musicTimer !== null) return;
  musicTimer = setInterval(() => {
    const note = BASS[musicStep % BASS.length];
    musicStep += 1;
    if (note > 0) tone(note, 0.42, 'triangle', 0.07);
    if (musicStep % 2 === 0) noise(0.03, 0.03, 6000);
  }, 1900 / 16);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
