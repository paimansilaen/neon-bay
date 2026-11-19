// All sound is synthesized with WebAudio: no audio files, no network.
// A bassline sequencer plays a slow neon-noir loop; engine, siren and one-shots
// are oscillators and filtered noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let muted = false;
  // A minor-key bass walk, 16 steps, ~112 BPM.
  const BASS = [55, 0, 55, 65.41, 0, 55, 0, 49, 55, 0, 55, 65.41, 73.42, 0, 65.41, 58.27];
  const HAT_STEPS = [2, 6, 10, 14];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 25;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineOsc2.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, filterFreq, volume) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    shoot() { noiseBurst(0.12, 2400, 0.5); tone(180, 0.08, 'square', 0.2, 60); },
    punch() { noiseBurst(0.08, 500, 0.4); },
    crash() { noiseBurst(0.3, 900, 0.7); tone(70, 0.25, 'sine', 0.5, 35); },
    pickup() { tone(660, 0.09, 'sine', 0.3); tone(990, 0.14, 'sine', 0.3); },
    coin() { tone(880, 0.07, 'triangle', 0.25); tone(1320, 0.12, 'triangle', 0.25); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.3), i * 90)); },
    fail() { tone(220, 0.4, 'sawtooth', 0.25, 110); },
    hurt() { tone(140, 0.15, 'sawtooth', 0.3, 80); },
    busted() { tone(440, 0.3, 'square', 0.25, 220); tone(330, 0.5, 'square', 0.25, 165); },
    engine(speed01, on) {
      if (!ctx) return;
      const target = on ? 0.05 + speed01 * 0.1 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 90, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(22 + speed01 * 45, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) {
        const t = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(t);
        sirenOsc.frequency.setValueAtTime(700, t);
        sirenOsc.frequency.linearRampToValueAtTime(950, t + 0.45);
        sirenOsc.frequency.linearRampToValueAtTime(700, t + 0.9);
      }
    },
    music(dt, playing) {
      if (!ctx || !playing) return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer += 0.135;
      const step = musicStep % 16;
      musicStep += 1;
      const bass = BASS[step];
      if (bass) tone(bass, 0.22, 'triangle', 0.16);
      if (HAT_STEPS.includes(step)) noiseBurst(0.03, 6000, 0.06);
      if (step === 0) tone(220, 0.5, 'sine', 0.05);
    },
  };
}
