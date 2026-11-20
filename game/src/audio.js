// Synthesized sound: WebAudio oscillators and noise, no audio files. Everything is guarded —
// a missing or suspended AudioContext just means silence, never a crash. The context is created
// lazily on the first user gesture, so headless screenshots stay quiet and the game never throws.

function makeNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createAudio() {
  let ctx = null;
  let noise = null;
  let musicTimer = 0;
  let musicStep = 0;
  let sirenHigh = false;
  let sirenTimer = 0;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx !== null) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      noise = makeNoiseBuffer(ctx);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, duration, type, volume, slideTo) {
    const c = ensure();
    if (!c || c.state !== 'running') return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + duration);
      gain.gain.setValueAtTime(volume, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration + 0.02);
    } catch {
      // Sound is garnish; a failed note never stops the game.
    }
  }

  function burst(duration, volume, filterFreq) {
    const c = ensure();
    if (!c || c.state !== 'running' || !noise) return;
    try {
      const source = c.createBufferSource();
      source.buffer = noise;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(volume, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      source.connect(filter).connect(gain).connect(c.destination);
      source.start();
      source.stop(c.currentTime + duration + 0.02);
    } catch {
      // See above.
    }
  }

  /** Call on the first user gesture so the context is allowed to run. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  return {
    unlock,
    shoot() { burst(0.09, 0.25, 2400); tone(190, 0.08, 'square', 0.12, 70); },
    punch() { burst(0.07, 0.2, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.14); tone(990, 0.12, 'sine', 0.12); },
    cash() { tone(880, 0.08, 'triangle', 0.14); tone(1174, 0.14, 'triangle', 0.12); },
    missionDone() { tone(523, 0.12, 'triangle', 0.16); tone(659, 0.12, 'triangle', 0.16); tone(784, 0.22, 'triangle', 0.16); },
    busted() { tone(320, 0.5, 'sawtooth', 0.16, 90); tone(160, 0.7, 'square', 0.1, 60); },
    hurt() { tone(140, 0.15, 'sawtooth', 0.14, 70); },
    engine(on, speed01) {
      const c = ensure();
      if (!c) return;
      try {
        if (on && c.state === 'running') {
          if (!engineOsc) {
            engineOsc = c.createOscillator();
            engineGain = c.createGain();
            engineOsc.type = 'sawtooth';
            engineGain.gain.value = 0.0;
            const filter = c.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 420;
            engineOsc.connect(filter).connect(engineGain).connect(c.destination);
            engineOsc.start();
          }
          engineOsc.frequency.value = 55 + speed01 * 130;
          engineGain.gain.value = 0.03 + speed01 * 0.03;
        } else if (engineGain) {
          engineGain.gain.value = 0;
        }
      } catch {
        // See above.
      }
    },
    /** Call every frame: a two-tone siren while wanted, and a slow procedural bassline. */
    update(dt, wanted) {
      const c = ensure();
      if (!c || c.state !== 'running') return;
      if (wanted > 0) {
        sirenTimer -= dt;
        if (sirenTimer <= 0) {
          sirenTimer = 0.42;
          sirenHigh = !sirenHigh;
          tone(sirenHigh ? 780 : 590, 0.36, 'sine', 0.045);
        }
      } else {
        sirenTimer = 0;
      }
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = 0.24;
        const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
        tone(bass[musicStep % bass.length], 0.22, 'triangle', 0.05);
        if (musicStep % 4 === 2) tone(bass[musicStep % bass.length] * 4, 0.1, 'sine', 0.02);
        musicStep += 1;
      }
    },
  };
}
