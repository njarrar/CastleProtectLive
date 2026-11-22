// Sound with Web Audio. Two sources, one door:
//  - the sound pass (assets/audio, built to <base>/art/audio): audio.json maps each sound to a
//    core event or an animation event, with volume, pitch spread, loops and the music layers;
//  - a few synthesized sounds as the fallback for anything with no file, or before files decode.
// `play` takes the UI and HUD names, `cue` takes the feel cues (game events and animation events).
// Files are fetched and decoded only after the first user gesture (no sound before the Play tap),
// one format per platform (Opus, else AAC). Slow motion drops everything 3 semitones behind a
// low-pass and snaps back on a small whump (07 §6.4).
import type { Cue } from '../render/feel';

export type Sfx = 'tap' | 'fire' | 'whoosh' | 'hit' | 'break' | 'bonk' | 'thud' | 'turn' | 'turn2' | 'pennant' | 'pop' | 'squall' | 'sheet' | 'win' | 'lose' | 'walk' | 'creak' | 'whump' | 'coin' | 'handoff' | 'fire_press' | 'denied';

interface Sound { id: string; kind: string; files: { ogg?: string; m4a?: string }; loop: boolean; volume: number; pitch_var_semitones: number; layer?: string | null; repeat_gap_s?: number; samples?: number; sample_rate?: number }
interface Manifest { sounds: Sound[]; shot_launch: Record<string, string | null>; material_sounds: Record<string, { hit: string | null; brk: string | null }>; blast_sounds: Record<string, string> }

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let lowpass: BiquadFilterNode | null = null;
let volume = 0.7;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let slow = false;

let man: Manifest | null = null;
const byId = new Map<string, Sound>();
const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer | null>>();
let base = '';
let fmt: 'ogg' | 'm4a' = 'ogg';
let manifestP: Promise<void> | null = null;
let rng = 0x51ab1e;
const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.7;
    lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 20000;
    master.connect(lowpass).connect(ctx.destination);
    musicBus.connect(master);
    applyVol();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
    // Effects, stings and barks decode now (small); music decodes when a screen asks for it.
    void manifestP?.then(() => { for (const s of byId.values()) if (s.kind !== 'music') void buffer(s.id); if (wanted) setMusic(wanted); });
  }
  // iOS reports 'interrupted' after a call or Siri; any state but running needs a resume.
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
}

export function setVolume(v: number, mute: boolean): void {
  volume = v / 100;
  muted = mute;
  applyVol();
}
function applyVol() {
  if (master) master.gain.value = muted ? 0 : volume * 0.8;
}

/** Read audio.json, if the build has one. Nothing is fetched beyond it until a gesture. */
export function loadAudio(at: string): Promise<void> {
  if (manifestP) return manifestP;
  base = `${at}art/audio/`;
  const a = document.createElement('audio');
  fmt = a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a';
  manifestP = (async () => {
    try {
      const r = await fetch(`${base}audio.json`);
      if (!r.ok) return;
      man = (await r.json()) as Manifest;
      for (const s of man.sounds ?? []) byId.set(s.id, s);
      if (ctx) { for (const s of byId.values()) if (s.kind !== 'music') void buffer(s.id); if (wanted) setMusic(wanted); }
    } catch { /* no sound files: synth only */ }
  })();
  return manifestP;
}

function buffer(id: string): Promise<AudioBuffer | null> {
  const have = buffers.get(id);
  if (have) return Promise.resolve(have);
  const p0 = pending.get(id);
  if (p0) return p0;
  const s = byId.get(id);
  const file = s?.files[fmt] ?? s?.files.ogg ?? s?.files.m4a;
  if (!s || !file || !ctx) return Promise.resolve(null);
  const c = ctx;
  const p = (async () => {
    try {
      const r = await fetch(base + file);
      if (!r.ok) return null;
      const b = await c.decodeAudioData(await r.arrayBuffer());
      buffers.set(id, b);
      return b;
    } catch { return null; }
  })();
  pending.set(id, p);
  return p;
}

/** Play a sound from the pack. Returns false when it is not decoded (the caller synthesizes). */
function sample(id: string | null | undefined, gain = 1, semis = 0): boolean {
  if (!id || !ctx || !master) return false;
  const b = buffers.get(id);
  const s = byId.get(id);
  if (!b || !s) { if (s) void buffer(id); return false; }
  const src = ctx.createBufferSource();
  src.buffer = b;
  const spread = s.pitch_var_semitones ? (rand() * 2 - 1) * s.pitch_var_semitones : 0;
  const st = semis + spread + (slow ? -3 : 0);
  if (st) src.playbackRate.value = Math.pow(2, st / 12);
  const g = ctx.createGain();
  g.gain.value = gain * (s.volume ?? 1);
  src.connect(g).connect(master);
  src.start();
  return true;
}

/** Slow motion on or off: 3 semitones down behind a low-pass; a small whump when it snaps back. */
export function slowmoAudio(on: boolean): void {
  if (on === slow) return;
  slow = on;
  if (!ctx || !lowpass) return;
  const t = ctx.currentTime;
  lowpass.frequency.cancelScheduledValues(t);
  lowpass.frequency.setTargetAtTime(on ? 900 : 20000, t, on ? 0.04 : 0.02);
  for (const l of loops.values()) if (l.src) l.src.playbackRate.setTargetAtTime(Math.pow(2, (l.semis + (on ? -3 : 0)) / 12), t, 0.05);
  for (const m of music) m.src.playbackRate.setTargetAtTime(on ? Math.pow(2, -3 / 12) : 1, t, 0.05);
  if (!on) play('whump');
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  const f = slow ? freq * 0.84 : freq;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
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
  if (slow) s.playbackRate.value = 0.84;
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

// A big collapse sends one hit per block at once: at most 3 of one sound within 50 ms (07 §9.5).
const recent = new Map<string, number[]>();
function gate(k: string): boolean {
  const now = performance.now();
  let a = recent.get(k);
  if (!a) { a = [-1e9, -1e9, -1e9]; recent.set(k, a); }
  let oldest = 0;
  for (let i = 1; i < 3; i++) if (a[i] < a[oldest]) oldest = i;
  if (now - a[oldest] < 50) return false;
  a[oldest] = now;
  return true;
}

/** UI and HUD sounds, by name. */
const PLAY_ID: Partial<Record<Sfx, [string, number]>> = {
  tap: ['ui_tap', 0], sheet: ['ui_sheet_open', 0], bonk: ['hob_bonk', 0], thud: ['hit_miss_thud', 0], hit: ['hit_blast_small', 0],
  break: ['mat_timber_break', 0], turn: ['turn_yours', 0], turn2: ['turn_yours', -2], pennant: ['meta_pennant_stamp', 0], pop: ['ket_pop', 0],
  squall: ['wx_squall_bell', 0], win: ['sting_win', 0], lose: ['sting_lose', 0], walk: ['cas_step', 0], creak: ['col_creak', 0],
  coin: ['ui_buttons_tick', 0], handoff: ['ui_handoff_flip', 0], fire_press: ['ui_fire_press', 0], denied: ['ui_denied', 0],
};

export function play(s: Sfx): void {
  if (!ctx || muted || !gate(s)) return;
  const id = PLAY_ID[s];
  if (id && sample(id[0], 1, id[1])) return;
  synth(s);
}

function synth(s: Sfx): void {
  switch (s) {
    case 'tap': tone(660, 0.06, 'triangle', 0.25); break;
    case 'sheet': case 'handoff': tone(420, 0.12, 'sine', 0.2, 1.5); break;
    case 'fire': case 'fire_press': tone(140, 0.25, 'sine', 0.8, 0.4); noise(0.18, 0.4, 900, 0.8); break;
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
    case 'creak': tone(180, 0.32, 'sawtooth', 0.06, 0.8); tone(240, 0.2, 'sawtooth', 0.04, 1.2, 0.12); break;
    case 'whump': tone(60, 0.14, 'sine', 0.5, 0.7); break;
    case 'coin': tone(1320, 0.08, 'triangle', 0.2); tone(1760, 0.12, 'triangle', 0.18, 1, 0.06); break;
    case 'denied': tone(160, 0.1, 'square', 0.12); break;
  }
}

const BANDS = ['tiny', 'small', 'medium', 'large', 'huge'];
/** A blast radius (cells, 00 §9.3) to its band name. */
export function bandOf(r: number): string { return BANDS[r >= 64 ? 4 : r >= 42 ? 3 : r >= 28 ? 2 : r >= 18 ? 1 : 0]; }

/** Feel cue -> sound id in the pack, with the cue's argument (shot id, material, band). */
function cueId(c: Cue, arg: string): string | null | undefined {
  const m = man;
  switch (c) {
    case 'release': return m?.shot_launch[arg] ?? 'launch_lob';
    case 'hit': return arg === 'kettle' ? 'ket_hit' : m?.material_sounds[arg]?.hit ?? 'mat_timber_hit';
    case 'break': return m?.material_sounds[arg]?.brk ?? 'col_debris_patter';
    case 'boom': return m?.blast_sounds[arg] ?? 'hit_blast_small';
    case 'hit_hob': return 'hob_hit_boing';
    case 'bonk': return 'hob_bonk';
    case 'inflate': return 'hob_balloon_inflate';
    case 'lift': return 'hob_balloon_float';
    case 'thud': return 'hit_miss_thud';
    case 'splash': return 'hit_water_splash';
    case 'pop': return 'ket_pop';
    case 'kettle_crack': return 'ket_crack';
    case 'sit': return 'ket_sit_down';
    case 'creak': return 'col_creak';
    case 'crack': return 'col_crack';
    case 'fall': return 'col_chunk_fall';
    case 'land': return 'col_chunk_land';
    case 'hob_land': return 'hob_land_thud';
    case 'tumble': return 'hob_tumble_roll';
    case 'stomp': return 'cas_step';
    case 'threaded': return 'hit_pierce';
    case 'thump': return 'cas_thump';
    case 'dig': return 'hob_shove_dig';
    case 'cheer': return 'hob_cheer';
    case 'squall': return 'wx_squall_bell';
    case 'wind': return 'wx_wind_shift';
    case 'pin': return 'aim_pin_drop';
    case 'flap': return 'cas_loophole_flap';
    case 'lid': return 'doo_pot_lid_clang';
    case 'split': return 'fly_split';
    case 'dust': return 'col_dust_settle';
    case 'debris': return 'col_debris_patter';
    default: return null;
  }
}
const CUE_SYNTH: Partial<Record<Cue, Sfx>> = {
  release: 'fire', hit: 'hit', hit_hob: 'hit', break: 'break', bonk: 'bonk', thud: 'thud', boom: 'hit', pop: 'pop', creak: 'creak',
  land: 'thud', hob_land: 'thud', stomp: 'walk', splash: 'thud', kettle_crack: 'break', threaded: 'bonk', thump: 'thud', dig: 'walk',
  cheer: 'pennant', squall: 'squall', wind: 'whoosh', pin: 'tap', flap: 'sheet', lid: 'sheet',
};

/** A feel cue: the pack's sound if it is decoded, else a synth stand-in. `gain` scales it (collapse size). */
export function cue(c: Cue, arg = '', gain = 1): void {
  if (!ctx || muted) return;
  const id = cueId(c, arg);
  if (!gate(id ?? c)) return;
  if (sample(id, gain)) return;
  const s = CUE_SYNTH[c];
  if (s) synth(s);
}

// ---------- barks (Hob-speak) ----------
// One bark per side per turn step and 1.5 s between barks; most events bark 40% of the time,
// Bonks and wins always [assets/audio/README.md].
let lastBark = -1e9;
const barkStep = [-1, -1];
export function bark(hob: string, ev: 'fire' | 'takes_hit' | 'hit_lands' | 'bonked' | 'win' | 'picked', side: number, step: number): void {
  if (!ctx || muted) return;
  const always = ev === 'bonked' || ev === 'win';
  const now = performance.now();
  if (now - lastBark < 1500 || barkStep[side] === step) return;
  if (!always && rand() > 0.4) return;
  if (sample(`bark_${hob}_${ev}`)) { lastBark = now; barkStep[side] = step; }
}

// ---------- loops: kettle whistle, wind bed, squall, shell whistle ----------
interface Loop { src: AudioBufferSourceNode | null; g: GainNode | null; on: boolean; semis: number; gapT: number }
const loops = new Map<string, Loop>();
/**
 * Keep a looped sound at `gain` (0 stops it) and `semis` pitch. A sound with repeat_gap_s plays,
 * waits, and plays again. Call every frame; it only touches the graph when something changes.
 */
export function loop(id: string, gain: number, semis = 0): void {
  if (!ctx || !master) return;
  let l = loops.get(id);
  if (!l) { l = { src: null, g: null, on: false, semis: 0, gapT: 0 }; loops.set(id, l); }
  const want = gain > 0.001 && !muted;
  const s = byId.get(id);
  const b = buffers.get(id);
  if (want && !l.on) {
    if (!b || !s) { if (s) void buffer(id); return; }
    const gap = s.repeat_gap_s ?? 0;
    if (gap && ctx.currentTime < l.gapT) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = !gap;
    if (!gap && s.samples && s.sample_rate) src.loopEnd = s.samples / s.sample_rate;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(master);
    src.start();
    l.src = src; l.g = g; l.on = true;
    if (gap) { src.onended = () => { if (l) { l.on = false; l.src = null; l.gapT = (ctx?.currentTime ?? 0) + gap; } }; }
  }
  if (!l.on || !l.g || !l.src) return;
  const t = ctx.currentTime;
  const target = want ? gain * (s?.volume ?? 1) : 0;
  if (Math.abs(l.g.gain.value - target) > 0.01) l.g.gain.setTargetAtTime(target, t, 0.12);
  if (semis !== l.semis) { l.semis = semis; l.src.playbackRate.setTargetAtTime(Math.pow(2, (semis + (slow ? -3 : 0)) / 12), t, 0.05); }
  if (!want && l.g.gain.value < 0.02) { try { l.src.stop(); } catch { /* ok */ } l.on = false; l.src = null; }
}
export function stopLoops(): void { for (const id of loops.keys()) loop(id, 0); }

// ---------- music: Region 1 layers, the map theme ----------
interface Track { id: string; src: AudioBufferSourceNode; g: GainNode }
let music: Track[] = [];
let musicKey = '';
let barS = 1.111111;
let musicT0 = 0;
/** Start a theme: 'battle' (Base, Stir and Peril on one sample), 'map', or '' for none. */
let wanted: 'battle' | 'map' | '' = '';
export function setMusic(key: 'battle' | 'map' | ''): void {
  wanted = key;
  if (!ctx || !man) return; // starts on the first gesture (no sound before the Play tap)
  if (key === musicKey) return;
  musicKey = key;
  layerState = 0;
  const old = music;
  music = [];
  if (ctx) for (const m of old) { m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); m.src.stop(ctx.currentTime + 1.5); }
  if (!key || !ctx || !musicBus) return;
  const ids = key === 'battle' ? ['mus_r1_base', 'mus_r1_stir', 'mus_r1_peril'] : ['mus_map'];
  void Promise.all(ids.map(buffer)).then((bs) => {
    if (musicKey !== key || !ctx || !musicBus || bs.some((b) => !b)) return;
    const t0 = ctx.currentTime + 0.1;
    musicT0 = t0;
    barS = key === 'battle' ? 1.111111 : 1.304348;
    music = ids.map((id, i) => {
      const s = byId.get(id)!;
      const src = ctx!.createBufferSource();
      src.buffer = bs[i];
      src.loop = true;
      if (s.samples && s.sample_rate) src.loopEnd = s.samples / s.sample_rate;
      const g = ctx!.createGain();
      g.gain.value = i === 0 ? (s.volume ?? 1) : 0;
      src.connect(g).connect(musicBus!);
      src.start(t0);
      return { id, src, g };
    });
  });
}
let layerState = 0;
/** Stir and Peril fade in or out on the next bar line, over one bar. */
export function musicLayers(stir: boolean, peril: boolean): void {
  const st = (stir ? 1 : 0) | (peril ? 2 : 0);
  if (st === layerState || !ctx || music.length < 3) return;
  layerState = st;
  const t = ctx.currentTime;
  const nextBar = musicT0 + Math.ceil((t - musicT0) / barS) * barS;
  for (let i = 1; i < 3; i++) {
    const on = i === 1 ? stir || peril : peril;
    const g = music[i].g.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, nextBar);
    g.linearRampToValueAtTime(on ? 1 : 0, nextBar + barS);
  }
}
