// A few synthesized sound effects with Web Audio. No files to load.
export type Sfx = 'tap' | 'fire' | 'whoosh' | 'hit' | 'break' | 'bonk' | 'thud' | 'turn' | 'turn2' | 'pennant' | 'pop' | 'squall' | 'sheet' | 'win' | 'lose' | 'walk';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.7;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVol();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setVolume(v: number, mute: boolean): void {
  volume = v / 100;
  muted = mute;
  applyVol();
}
function applyVol() {
  if (master) master.gain.value = muted ? 0 : volume * 0.6;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, freq: number, q = 1, delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

export function play(s: Sfx): void {
  if (!ctx || muted) return;
  switch (s) {
    case 'tap': tone(660, 0.06, 'triangle', 0.25); break;
    case 'sheet': tone(420, 0.12, 'sine', 0.2, 1.5); break;
    case 'fire': tone(140, 0.25, 'sine', 0.8, 0.4); noise(0.18, 0.4, 900, 0.8); break;
    case 'whoosh': noise(0.4, 0.15, 1800, 2); break;
    case 'hit': tone(90, 0.3, 'sine', 0.9, 0.5); noise(0.3, 0.5, 400, 0.7); break;
    case 'break': noise(0.25, 0.5, 1200, 1.5); tone(300, 0.1, 'square', 0.1, 0.5); break;
    case 'thud': tone(70, 0.2, 'sine', 0.6, 0.6); break;
    case 'bonk': tone(880, 0.12, 'square', 0.25, 0.5); tone(1320, 0.2, 'triangle', 0.25, 1, 0.08); break;
    case 'turn': tone(660, 0.15, 'triangle', 0.3); tone(990, 0.2, 'triangle', 0.25, 1, 0.1); break;
    case 'turn2': tone(495, 0.15, 'triangle', 0.3); tone(742, 0.2, 'triangle', 0.25, 1, 0.1); break;
    case 'pennant': tone(110, 0.15, 'sine', 0.7, 0.5); tone(784, 0.25, 'triangle', 0.3, 1, 0.05); break;
    case 'pop': tone(1200, 0.5, 'sawtooth', 0.15, 0.2); noise(0.6, 0.6, 3000, 0.5); break;
    case 'squall': noise(1.2, 0.35, 250, 0.5); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.3, 1, i * 0.12)); break;
    case 'lose': [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, 1, i * 0.18)); break;
    case 'walk': tone(200, 0.05, 'square', 0.05); break;
  }
}
