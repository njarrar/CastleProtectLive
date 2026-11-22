// Sound with Web Audio. Two sources, one door:
//  - the sound pass (assets/audio, built to <base>/art/audio): audio.json maps each sound to a
//    core event or an animation event, with volume, pitch spread, loops and the music layers;
//  - a few synthesized sounds as the fallback for anything with no file, or before files decode.
// `play` takes the UI and HUD names, `cue` takes the feel cues (game events and animation events).
// Files are fetched and decoded only after the first user gesture (no sound before the Play tap),
// one format per platform (Opus, else AAC). Slow motion drops everything 3 semitones behind a
// low-pass and snaps back on a small whump (07 §6.4).
import type { Cue } from '../render/feel';

export type Sfx = 'tap' | 'fire' | 'whoosh' | 'hit' | 'break' | 'bonk' | 'thud' | 'turn' | 'turn2' | 'pennant' | 'pop' | 'squall' | 'sheet' | 'win' | 'lose' | 'walk' | 'creak' | 'whump' | 'coin' | 'handoff' | 'fire_press' | 'denied' | 'roll' | 'shears' | 'snip' | 'boom' | 'crock' | 'carve' | 'mound';

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
/** Set once a decode in the first format failed and the other format was tried. */
let fmtSwitched = false;
let manifestP: Promise<void> | null = null;
let rng = 0x51ab1e;
const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
/** Sound files fetched this session, to fetch again through the service worker once it controls the page. */
const fetched = new Set<string>();

/**
 * What a first shot needs, decoded first and one at a time on the first tap. The other effects
 * and stings follow in idle time; barks decode per fight (preloadBarks) and music per theme.
 */
const FIRST = [
  'ui_tap', 'ui_sheet_open', 'ui_fire_press', 'turn_yours', 'launch_lob', 'hit_blast_small', 'hit_blast_medium', 'hit_miss_thud',
  'mat_timber_hit', 'mat_timber_break', 'mat_wicker_hit', 'mat_cobble_hit', 'hob_hit_boing', 'hob_bonk', 'ket_hit', 'col_creak',
  'col_chunk_fall', 'col_chunk_land', 'aim_pin_drop', 'wx_wind_loop', 'fly_whistle_loop',
];
let warmed = false;
let firstDone: () => void = () => undefined;
/** Resolves once the first-shot sounds are in: music waits for them (first load budget, QA playtest 1). */
const firstReady = new Promise<void>((r) => { firstDone = r; });
/** The other effects and stings wait this long after the first ones: the first load stays small. */
const REST_DELAY_MS = 20_000;
async function warmUp(): Promise<void> {
  if (warmed || !ctx || !man) return;
  warmed = true;
  const rest = [...byId.values()].filter((s) => s.kind === 'sfx' || s.kind === 'sting').map((s) => s.id).filter((id) => !FIRST.includes(id));
  // One decode at a time, with a breath between, so the first frames of a fight never wait on them.
  for (const id of FIRST) {
    await buffer(id);
    await new Promise((r) => setTimeout(r, 16));
  }
  firstDone();
  await new Promise((r) => setTimeout(r, REST_DELAY_MS));
  for (const id of rest) {
    await buffer(id);
    await new Promise((r) => setTimeout(r, 16));
  }
}

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 20000;
    master.connect(lowpass).connect(ctx.destination);
    musicBus.connect(master);
    sfxBus.connect(master);
    applyVol();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
    void manifestP?.then(() => { void warmUp(); if (wanted) setMusic(wanted); if (barkHobs.length) preloadBarks(barkHobs); });
  }
  // iOS reports 'interrupted' after a call or Siri; any state but running needs a resume.
  if (ctx.state !== 'running' && document.visibilityState === 'visible') void ctx.resume().catch(() => undefined);
}

// A hidden tab or a locked phone goes quiet (Chrome keeps Web Audio running in a hidden tab).
if (typeof document !== 'undefined') {
  const quiet = () => { if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') quiet();
    else if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  });
  window.addEventListener('pagehide', quiet);
}

/** For tests and debugging: the context state and what is decoded. */
export function audioDebug(): { state: string; decoded: string[]; loops: number } {
  let n = 0;
  for (const l of loops.values()) if (l.on) n++;
  return { state: ctx?.state ?? 'none', decoded: [...buffers.keys()], loops: n };
}

let musicVol = 0.7;
/** Sound slider (effects, barks), Music slider and Mute all. */
export function setVolume(v: number, mute: boolean, mus = musicVol * 100): void {
  volume = v / 100;
  muted = mute;
  musicVol = mus / 100;
  applyVol();
}
function applyVol() {
  if (master) master.gain.value = muted ? 0 : 0.8;
  if (sfxBus) sfxBus.gain.value = volume;
  if (musicBus) musicBus.gain.value = musicVol * 0.8;
}
let sfxBus: GainNode | null = null;

/** Read audio.json and barks.json, if the build has them. Nothing else is fetched until a gesture. */
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
      if (ctx) { void warmUp(); if (wanted) setMusic(wanted); if (barkHobs.length) preloadBarks(barkHobs); }
    } catch { /* no sound files: synth only */ }
    try {
      const r = await fetch(`${base}barks.json`);
      if (r.ok) barkLines = ((await r.json()) as { hobs?: BarkLines }).hobs ?? null;
    } catch { /* no subtitles file */ }
  })();
  return manifestP;
}

/** decodeAudioData in both forms: old Safari has only the callback one. */
function decode(c: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((res, rej) => {
    const p = c.decodeAudioData(data, res, rej) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === 'function') p.then(res, rej);
  });
}

async function fetchDecode(c: AudioContext, s: Sound, f: 'ogg' | 'm4a'): Promise<AudioBuffer | null> {
  const file = s.files[f];
  if (!file) return null;
  const url = base + file;
  const r = await fetch(url);
  if (!r.ok) return null;
  fetched.add(url);
  return decode(c, await r.arrayBuffer());
}

function buffer(id: string): Promise<AudioBuffer | null> {
  const have = buffers.get(id);
  if (have) return Promise.resolve(have);
  const p0 = pending.get(id);
  if (p0) return p0;
  const s = byId.get(id);
  if (!s || !ctx) return Promise.resolve(null);
  const c = ctx;
  const p = (async () => {
    let b: AudioBuffer | null = null;
    try {
      b = await fetchDecode(c, s, s.files[fmt] ? fmt : fmt === 'ogg' ? 'm4a' : 'ogg');
    } catch {
      // canPlayType speaks for <audio>, not for decodeAudioData. On a decode error try the other
      // format once, and keep it for the rest of the session when it works.
      if (!fmtSwitched) {
        const other = fmt === 'ogg' ? 'm4a' : 'ogg';
        try {
          b = await fetchDecode(c, s, other);
          if (b) { fmt = other; fmtSwitched = true; }
        } catch { b = null; }
      }
    }
    // A failed load is not kept: the next request tries again (a network blip, an offline start).
    // A bark that lands after its fight let the barks go is not kept either.
    const stale = id.startsWith('bark_') && !barkHobs.some((h) => id.startsWith(`bark_${h}_`));
    if (b && !stale) buffers.set(id, b);
    pending.delete(id);
    return b;
  })();
  pending.set(id, p);
  return p;
}

/** Drop decoded sounds (Web Audio keeps them as 32 bit floats: a minute of music is about 20 MB). */
function release(ids: Iterable<string>): void { for (const id of ids) buffers.delete(id); }

/**
 * Sound files fetched before the service worker controlled the page went past its cache.
 * Fetch them again through it, so a second launch offline still has the sounds played so far.
 */
export function warmOfflineCache(): void {
  if (!navigator.serviceWorker?.controller) return;
  for (const u of fetched) void fetch(u).catch(() => undefined);
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
  src.connect(g).connect(sfxBus ?? master);
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
  o.connect(g).connect(sfxBus ?? master);
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
  s.connect(f).connect(g).connect(sfxBus ?? master);
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
  // The Grand Fort's roller and shears, props and ground (they act between turns, so never silent).
  roll: ['launch_roll', -3], shears: ['ui_card_flip', -5], snip: ['hit_pierce', 2], boom: ['hit_blast_medium', 0], crock: ['aim_tick', -4],
  carve: ['hit_dig_carve', 0], mound: ['gnd_mound_grow', 0],
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
    case 'roll': noise(0.6, 0.3, 160, 0.6); tone(55, 0.6, 'sine', 0.4, 0.8); break;
    case 'shears': tone(900, 0.08, 'square', 0.12, 1.4); tone(1300, 0.08, 'square', 0.1, 0.7, 0.1); break;
    case 'snip': tone(1600, 0.06, 'square', 0.15, 0.5); noise(0.1, 0.3, 2500, 2); break;
    case 'boom': tone(80, 0.35, 'sine', 0.8, 0.5); noise(0.35, 0.5, 350, 0.7); break;
    case 'crock': tone(1000, 0.04, 'square', 0.1); tone(800, 0.04, 'square', 0.1, 1, 0.25); break;
    case 'carve': noise(0.3, 0.3, 500, 1); break;
    case 'mound': noise(0.4, 0.25, 220, 0.8); break;
  }
}


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
// Bonks and wins always [assets/audio/README.md]. The subtitle (barks.json) shows even with the
// sound off (07 §7.6), so the choice is made here and the line handed back to the caller.
type BarkLines = Record<string, { barks?: Record<string, { sound?: string; subtitles?: string[] }> }>;
let barkLines: BarkLines | null = null;
const lastLine = new Map<string, number>();
let lastBark = -1e9;
const barkStep = [-1, -1];
let barkHobs: string[] = [];

/** Decode the barks of the Hobs in this fight only. */
export function preloadBarks(hobs: string[]): void {
  barkHobs = [...new Set(hobs)];
  if (!ctx || !man) return;
  void (async () => {
    for (const id of byId.keys()) {
      if (!id.startsWith('bark_') || !barkHobs.some((h) => id.startsWith(`bark_${h}_`))) continue;
      await buffer(id);
      await new Promise((r) => setTimeout(r, 16));
    }
  })();
}
/** A fight is over: its barks are let go. */
export function releaseBarks(): void {
  barkHobs = [];
  release([...buffers.keys()].filter((id) => id.startsWith('bark_')));
}

/** Returns the subtitle line when the Hob barks (with or without sound), else undefined. */
export function bark(hob: string, ev: 'fire' | 'takes_hit' | 'hit_lands' | 'bonked' | 'win' | 'picked', side: number, step: number): string | undefined {
  const always = ev === 'bonked' || ev === 'win';
  const now = performance.now();
  if (now - lastBark < 1500 || barkStep[side] === step) return undefined;
  if (!always && rand() > 0.4) return undefined;
  const subs = barkLines?.[hob]?.barks?.[ev]?.subtitles ?? [];
  const id = `bark_${hob}_${ev}`;
  const sound = ctx && !muted && sample(id);
  if (!sound && !subs.length) return undefined;
  lastBark = now;
  barkStep[side] = step;
  if (!subs.length) return undefined;
  // A random line, never the same one twice in a row.
  let i = Math.floor(rand() * subs.length);
  if (subs.length > 1 && i === lastLine.get(id)) i = (i + 1) % subs.length;
  lastLine.set(id, i);
  return subs[i];
}

// ---------- loops: kettle whistle, wind bed, squall, shell whistle ----------
interface Loop { src: AudioBufferSourceNode | null; g: GainNode | null; on: boolean; semis: number; gapT: number; target: number }
const loops = new Map<string, Loop>();
/**
 * Keep a looped sound at `gain` (0 stops it) and `semis` pitch. A sound with repeat_gap_s plays,
 * waits, and plays again. Call every frame; it only touches the graph when something changes.
 */
export function loop(id: string, gain: number, semis = 0): void {
  if (!ctx || !master) return;
  let l = loops.get(id);
  if (!l) { l = { src: null, g: null, on: false, semis: 0, gapT: 0, target: 0 }; loops.set(id, l); }
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
    src.connect(g).connect(sfxBus ?? master);
    src.start();
    l.src = src; l.g = g; l.on = true; l.target = 0; l.semis = 0;
    const me = l;
    if (gap) src.onended = () => { if (me.src === src) { me.on = false; me.src = null; me.g = null; me.gapT = (ctx?.currentTime ?? 0) + gap; } };
  }
  if (!l.on || !l.g || !l.src) return;
  if (!want) { fadeOut(l); return; }
  const t = ctx.currentTime;
  const target = gain * (s?.volume ?? 1);
  // Only a real change schedules a new ramp (no event per frame while it glides).
  if (Math.abs(l.target - target) > 0.01) { l.target = target; l.g.gain.setTargetAtTime(target, t, 0.12); }
  if (semis !== l.semis) { l.semis = semis; l.src.playbackRate.setTargetAtTime(Math.pow(2, (semis + (slow ? -3 : 0)) / 12), t, 0.05); }
}
/** Fade a loop out and stop its source after the fade; the slot is free at once. */
function fadeOut(l: Loop): void {
  if (!ctx || !l.src || !l.g) { l.on = false; return; }
  const t = ctx.currentTime;
  l.g.gain.cancelScheduledValues(t);
  l.g.gain.setTargetAtTime(0, t, 0.1);
  try { l.src.stop(t + 0.5); } catch { /* already stopped */ }
  l.src.onended = null;
  l.on = false; l.src = null; l.g = null; l.target = 0;
}
/** A fight ends or the screen goes: every loop fades and its source stops. */
export function stopLoops(): void { for (const l of loops.values()) fadeOut(l); }

// ---------- music: Region 1 layers, the map theme ----------
interface Track { id: string; src: AudioBufferSourceNode; g: GainNode }
let music: Track[] = [];
let musicKey = '';
let barS = 1.111111;
let musicT0 = 0;
const THEME: Record<'battle' | 'map', string[]> = { battle: ['mus_r1_base', 'mus_r1_stir', 'mus_r1_peril'], map: ['mus_map'] };
/** Start a theme: 'battle' (Base, Stir and Peril on one sample), 'map', or '' for none. */
let wanted: 'battle' | 'map' | '' = '';
export function setMusic(key: 'battle' | 'map' | ''): void {
  wanted = key;
  if (!ctx || !man) return; // starts on the first gesture (no sound before the Play tap)
  if (key === musicKey) return;
  musicKey = key;
  layerState = 0;
  layersAsked = false;
  clearTimeout(layersT);
  const old = music;
  music = [];
  if (ctx) for (const m of old) { m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); m.src.stop(ctx.currentTime + 1.5); }
  // Only one theme is kept decoded: the other one's buffers are let go.
  for (const k of ['battle', 'map'] as const) if (k !== key) release(THEME[k]);
  if (!key || !ctx || !musicBus) return;
  const ids = THEME[key];
  // The base layer starts once the first-shot sounds are in. Stir and Peril (1 MB) load later,
  // when the fight first needs them or after a while, and join in step on a bar line.
  void firstReady.then(() => (musicKey === key ? buffer(ids[0]) : null)).then((b) => {
    if (musicKey !== key || !ctx || !musicBus) return;
    // A layer that failed to load: forget the key so the next call tries again.
    if (!b) { musicKey = ''; return; }
    baseAt = performance.now();
    const t0 = ctx.currentTime + 0.1;
    musicT0 = t0;
    barS = key === 'battle' ? 1.111111 : 1.304348;
    music = [track(ids[0], b, t0, 0, true)];
    if (ids.length > 1) layersT = window.setTimeout(() => addLayers(key), LAYER_DELAY_MS);
  });
}
const LAYER_DELAY_MS = 45_000;
const LAYER_MIN_MS = 15_000;
let baseAt = 0;
let layersT = 0;
let layersAsked = false;
function track(id: string, b: AudioBuffer, when: number, offset: number, on: boolean): Track {
  const s = byId.get(id)!;
  const src = ctx!.createBufferSource();
  src.buffer = b;
  src.loop = true;
  if (s.samples && s.sample_rate) src.loopEnd = s.samples / s.sample_rate;
  const g = ctx!.createGain();
  g.gain.value = on ? (s.volume ?? 1) : 0;
  src.connect(g).connect(musicBus!);
  src.start(when, offset);
  return { id, src, g };
}
/** Load Stir and Peril and start them silent, in step with the base layer from the next bar. */
function addLayers(key: 'battle' | 'map'): void {
  if (layersAsked) return;
  // Not in the first seconds of the theme, even when the fight is tense at once (1-1 has one
  // Hob): the first load stays small. Stir and Peril join a little later, on a bar line.
  const wait = LAYER_MIN_MS - (performance.now() - baseAt);
  if (wait > 0) { clearTimeout(layersT); layersT = window.setTimeout(() => addLayers(key), wait); return; }
  layersAsked = true;
  clearTimeout(layersT);
  const ids = THEME[key].slice(1);
  void Promise.all(ids.map(buffer)).then((bs) => {
    if (musicKey !== key || !ctx || !musicBus || music.length !== 1) return;
    if (bs.some((b) => !b)) { layersAsked = false; return; }
    const base = music[0].src;
    const len = base.loopEnd > 0 ? base.loopEnd : base.buffer?.duration ?? 0;
    const t = ctx.currentTime + 0.05;
    const when = musicT0 + Math.ceil((t - musicT0) / barS) * barS;
    const offset = len > 0 ? (when - musicT0) % len : 0;
    for (let i = 0; i < ids.length; i++) music.push(track(ids[i], bs[i]!, when, offset, false));
    const st = pendingLayers;
    layerState = 0;
    if (st) musicLayers((st & 1) !== 0, (st & 2) !== 0);
  });
}
let pendingLayers = 0;
let layerState = 0;
/** Stir and Peril fade in or out on the next bar line, over one bar. */
export function musicLayers(stir: boolean, peril: boolean): void {
  const st = (stir ? 1 : 0) | (peril ? 2 : 0);
  pendingLayers = st;
  if (st && music.length === 1 && musicKey) addLayers(musicKey as 'battle' | 'map');
  if (st === layerState || !ctx || music.length < 3) return;
  layerState = st;
  const t = ctx.currentTime;
  const nextBar = musicT0 + Math.ceil((t - musicT0) / barS) * barS;
  for (let i = 1; i < 3; i++) {
    const on = i === 1 ? stir || peril : peril;
    const g = music[i].g.gain;
    const vol = byId.get(music[i].id)?.volume ?? 1;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setValueAtTime(g.value, nextBar);
    g.linearRampToValueAtTime(on ? vol : 0, nextBar + barS);
  }
}
