'use client';
/**
 * Quiet, synthesised sound design (no audio files, nothing autoplays).
 * Only ever triggered by a user gesture, and only when the reader has switched sound on.
 */
let ctx: AudioContext | null = null;
let ambience: { stop: () => void } | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(ac: AudioContext, seconds: number, brown = false) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    } else d[i] = w;
  }
  return buf;
}

/** A soft paper movement: band-passed noise with a fast swell and long tail. */
function rustle({ duration = 0.32, freq = 2400, q = 0.7, gain = 0.05 } = {}) {
  const ac = audio();
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, duration);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, ac.currentTime);
  bp.frequency.exponentialRampToValueAtTime(freq * 0.45, ac.currentTime + duration);
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + duration * 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start();
}

export const sounds = {
  page: () => rustle({ duration: 0.34, freq: 2600, gain: 0.045 }),
  vellum: () => rustle({ duration: 0.5, freq: 4200, q: 0.5, gain: 0.025 }),
  unfold: () => rustle({ duration: 0.7, freq: 1500, q: 0.6, gain: 0.05 }),
  tap: () => rustle({ duration: 0.06, freq: 3200, q: 2, gain: 0.02 }),
};

/** Very faint room tone: low brown noise with a slow breath. */
export function setAmbience(on: boolean) {
  if (!on) {
    ambience?.stop();
    ambience = null;
    return;
  }
  const ac = audio();
  if (!ac || ambience) return;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 6, true);
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ac.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.035, ac.currentTime + 2.5);
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(lp).connect(g).connect(ac.destination);
  src.start();
  lfo.start();
  ambience = {
    stop: () => {
      g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
      window.setTimeout(() => {
        src.stop();
        lfo.stop();
      }, 900);
    },
  };
}
