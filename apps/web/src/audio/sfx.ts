// Sound with Web Audio. Two sources, one door:
//  - the sound pass (assets/audio, built to <base>/art/audio): audio.json maps each sound to a
//    core event or an animation event, with volume, pitch spread, loops and the music layers;
//  - a few synthesized sounds as the fallback for anything with no file, or before files decode.
// `play` takes the UI and HUD names, `cue` takes the feel cues (game events and animation events).
// Files are fetched and decoded only after the first user gesture (no sound before the Play tap),
// one format per platform (Opus, else AAC). Slow motion drops everything 3 semitones behind a
// low-pass and snaps back on a small whump (07 §6.4).
import type { Cue } from '../render/feel';
import { t } from '../ui/text';

export type Sfx =
  | 'tap' | 'fire' | 'whoosh' | 'hit' | 'break' | 'bonk' | 'thud' | 'turn' | 'turn2' | 'pennant' | 'pop' | 'squall'
  | 'sheet' | 'win' | 'lose' | 'walk' | 'creak' | 'whump' | 'coin' | 'handoff' | 'fire_press' | 'denied' | 'roll'
  | 'shears' | 'snip' | 'boom' | 'crock' | 'carve' | 'mound'
  | 'aim_start' | 'aim_limit' | 'aim_recall' | 'aim_set' | 'aim_tick'
  | 'mend_bucket' | 'mend_fizz' | 'ket_patch' | 'bounce' | 'fast_zip' | 'split'
  | 'title_jingle' | 'block_place' | 'hob_pick' | 'back' | 'card_take' | 'confirm' | 'slider_tick' | 'toggle_on' | 'steam'
  // One cue per event where one sound used to cover many (assets/audio/README.md).
  | 'lid_bounce' | 'buried' | 'boss_horn' | 'front_chime' | 'threaded' | 'roller' | 'roller_low' | 'shears_jam';

interface Sound {
  id: string; kind: string; files: { ogg?: string; m4a?: string }; loop: boolean;
  volume: number; pitch_var_semitones: number; layer?: string | null;
  repeat_gap_s?: number; samples?: number; sample_rate?: number;
}
interface Manifest {
  sounds: Sound[];
  shot_launch: Record<string, string | null>;
  material_sounds: Record<string, { hit: string | null; brk: string | null }>;
  blast_sounds: Record<string, string>;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicDuck: GainNode | null = null;
let sfxBus: GainNode | null = null;
let worldDuck: GainNode | null = null;
let barkBus: GainNode | null = null;
let uiBus: GainNode | null = null;
let lowpass: BiquadFilterNode | null = null;

let volume = 0.7;
let musicVol = 0.7;
let voicesVol = 0.85;
let muted = false;
let mono = false;
let audioPaused = false;
let noiseBuf: AudioBuffer | null = null;
let slow = false;

const MAX_SFX_VOICES = 16;
const activeVoices = new Set<AudioBufferSourceNode>();
let captionSink: ((text: string) => void) | null = null;

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
 * What a first shot needs, decoded first with bounded concurrency on the first tap. The other
 * effects and stings follow in idle time; barks decode per fight and music per theme.
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
const REST_DELAY_MS = 12_000;

async function decodePool(ids: string[], concurrency: number, gapMs: number): Promise<void> {
  let idx = 0;
  const worker = async () => {
    while (idx < ids.length) {
      const id = ids[idx++];
      await buffer(id);
      if (gapMs > 0) await new Promise((r) => setTimeout(r, gapMs));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
}

async function warmUp(): Promise<void> {
  if (warmed || !ctx || !man) return;
  warmed = true;
  const rest = [...byId.values()].filter((s) => s.kind === 'sfx' || s.kind === 'sting').map((s) => s.id).filter((id) => !FIRST.includes(id));
  await decodePool(FIRST, 4, 0);
  firstDone();
  await new Promise((r) => setTimeout(r, REST_DELAY_MS));
  await decodePool(rest, 2, 16);
}

export function isAudioRunning(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function unlockAudio(): boolean {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    musicDuck = ctx.createGain();
    sfxBus = ctx.createGain();
    worldDuck = ctx.createGain();
    barkBus = ctx.createGain();
    uiBus = ctx.createGain();
    lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 20000;
    master.connect(lowpass).connect(ctx.destination);
    musicBus.connect(musicDuck).connect(master);
    sfxBus.connect(worldDuck).connect(master);
    barkBus.connect(master);
    uiBus.connect(master);
    applyVol();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
    void manifestP?.then(() => { void warmUp(); if (wanted) setMusic(wanted); if (barkHobs.length) preloadBarks(barkCrews, barkRival); });
  }
  // iOS reports 'interrupted' after a call or Siri; any state but running needs a resume.
  if (ctx.state !== 'running' && document.visibilityState === 'visible') void ctx.resume().catch(() => undefined);
  return ctx.state === 'running';
}

// A hidden tab or a locked phone goes quiet (Chrome keeps Web Audio running in a hidden tab).
if (typeof document !== 'undefined') {
  const quiet = () => { if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') quiet();
    else if (ctx && ctx.state !== 'running' && !audioPaused) {
      void ctx.resume().catch(() => undefined);
      applyVol();
    }
  });
  window.addEventListener('pagehide', quiet);
}

/** For tests and debugging: the context state and what is decoded. */
export function audioDebug(): { state: string; decoded: string[]; loops: number } {
  let n = 0;
  for (const l of loops.values()) if (l.on) n++;
  return { state: ctx?.state ?? 'none', decoded: [...buffers.keys()], loops: n };
}

export function setCaptionSink(fn: ((text: string) => void) | null): void {
  captionSink = fn;
}

/** Pause ducks music and mutes world loops; resuming restores levels smoothly. */
export function setPaused(p: boolean): void {
  if (audioPaused === p) return;
  audioPaused = p;
  if (p) stopLoops();
  else if (ctx && ctx.state !== 'running' && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    void ctx.resume().catch(() => undefined);
  }
  applyVol();
}

/** Sound slider (effects), Music slider, Voices slider, Mono mixdown, and Mute all. */
export function setVolume(v: number, mute: boolean, mus = musicVol * 100, voices = voicesVol * 100, isMono = mono): void {
  volume = v / 100;
  muted = mute;
  musicVol = mus / 100;
  voicesVol = voices / 100;
  mono = isMono;
  applyVol();
}

function applyVol(): void {
  if (master) {
    master.gain.value = muted ? 0 : 0.8;
    master.channelCountMode = mono ? 'explicit' : 'max';
    master.channelCount = mono ? 1 : 2;
  }
  if (sfxBus) sfxBus.gain.value = volume;
  if (uiBus) uiBus.gain.value = volume;
  if (barkBus) barkBus.gain.value = voicesVol;
  if (musicBus && ctx) {
    const target = musicVol * 0.8 * (audioPaused ? 0.3 : 1);
    musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.06);
  }
}

let duckReleaseAt = 0;
/** Smooth 30 ms attack ducking of music and world SFX when a voice bark speaks. */
function duckFor(durSec: number): void {
  if (!ctx || !musicDuck || !worldDuck) return;
  const t = ctx.currentTime;
  const end = Math.max(duckReleaseAt, t + Math.max(0.25, durSec));
  duckReleaseAt = end;
  musicDuck.gain.cancelScheduledValues(t);
  musicDuck.gain.setTargetAtTime(0.56, t, 0.03);
  musicDuck.gain.setTargetAtTime(1, end, 0.14);
  worldDuck.gain.cancelScheduledValues(t);
  worldDuck.gain.setTargetAtTime(0.65, t, 0.03);
  worldDuck.gain.setTargetAtTime(1, end, 0.14);
}

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
    } catch { /* no sound files: synth only */ }
    try {
      const r = await fetch(`${base}barks.json`);
      if (r.ok) {
        const bj = (await r.json()) as { hobs?: BarkLines; crew?: Record<string, { subtitles?: string[] }> };
        barkLines = bj.hobs ?? null;
        crewLines = bj.crew ?? null;
      }
    } catch { /* no subtitles file */ }
    // Barks name their sound ids in barks.json, so they are fetched once both lists are in.
    if (ctx && man) { void warmUp(); if (wanted) setMusic(wanted); if (barkHobs.length) preloadBarks(barkCrews, barkRival); }
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

function buffer(id: string, expectedGen?: number): Promise<AudioBuffer | null> {
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
      if (!fmtSwitched) {
        const other = fmt === 'ogg' ? 'm4a' : 'ogg';
        try {
          b = await fetchDecode(c, s, other);
          if (b) { fmt = other; fmtSwitched = true; }
        } catch { b = null; }
      }
    }
    const stale = id.startsWith('bark_') && (
      (expectedGen !== undefined && expectedGen !== barkGen) ||
      !barkHobs.some((h) => id.startsWith(`bark_${h}_`))
    );
    if (b && !stale) buffers.set(id, b);
    pending.delete(id);
    return b;
  })();
  pending.set(id, p);
  return p;
}

/** Drop decoded sounds (Web Audio keeps them as 32 bit floats: a minute of music is about 20 MB). */
function release(ids: Iterable<string>): void { for (const id of ids) buffers.delete(id); }

const isWebKit = () => typeof navigator !== 'undefined' && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);

/**
 * Sound files fetched before the service worker controlled the page went past its cache.
 * Fetch them again through it, so a second launch offline still has the sounds played so far.
 * Skipped on WebKit where the SW deliberately ignores audio routes.
 */
export function warmOfflineCache(): void {
  if (!navigator.serviceWorker?.controller || isWebKit()) return;
  for (const u of fetched) void fetch(u).catch(() => undefined);
}

/** Play a sound from the pack. Returns false when it is not decoded (the caller synthesizes). */
function sample(
  id: string | null | undefined,
  gain = 1,
  semis = 0,
  bus: 'sfx' | 'ui' | 'bark' = 'sfx',
  pan = 0,
): AudioBuffer | null {
  if (!id || !ctx || !master) return null;
  const b = buffers.get(id);
  const s = byId.get(id);
  if (!b || !s) { if (s) void buffer(id); return null; }
  // 16-voice polyphony cap for world SFX (barks and UI always play).
  if (bus === 'sfx' && activeVoices.size >= MAX_SFX_VOICES) return b;
  const src = ctx.createBufferSource();
  src.buffer = b;
  const spread = s.pitch_var_semitones ? (rand() * 2 - 1) * s.pitch_var_semitones : 0;
  const st = semis + spread + (slow && bus !== 'ui' ? -3 : 0);
  if (st) src.playbackRate.value = Math.pow(2, st / 12);
  const g = ctx.createGain();
  g.gain.value = gain * (s.volume ?? 1);
  const dest = bus === 'bark' ? (barkBus ?? master) : bus === 'ui' ? (uiBus ?? master) : (sfxBus ?? master);
  if (!mono && pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    src.connect(g).connect(panner).connect(dest);
  } else {
    src.connect(g).connect(dest);
  }
  if (bus === 'sfx') {
    activeVoices.add(src);
    src.onended = () => { activeVoices.delete(src); };
  }
  src.start();
  return b;
}

/** Slow motion on or off: 3 semitones down behind a low-pass; a small whump when it snaps back. */
export function slowmoAudio(on: boolean): void {
  if (on === slow) return;
  slow = on;
  if (!ctx || !lowpass) return;
  const t = ctx.currentTime;
  const rate = on ? Math.pow(2, -3 / 12) : 1;
  setMusicRate(rate, t);
  lowpass.frequency.cancelScheduledValues(t);
  lowpass.frequency.setTargetAtTime(on ? 900 : 20000, t, on ? 0.04 : 0.02);
  for (const l of loops.values()) if (l.src) l.src.playbackRate.setTargetAtTime(Math.pow(2, (l.semis + (on ? -3 : 0)) / 12), t, 0.05);
  for (const m of music) m.src.playbackRate.setTargetAtTime(rate, t, 0.05);
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
const PLAY_ID: Partial<Record<Sfx, [string, number, 'ui' | 'sfx']>> = {
  tap: ['ui_tap', 0, 'ui'],
  sheet: ['ui_sheet_open', 0, 'ui'],
  back: ['ui_back', 0, 'ui'],
  confirm: ['ui_confirm', 0, 'ui'],
  card_take: ['ui_card_take', 0, 'ui'],
  slider_tick: ['ui_slider_tick', 0, 'ui'],
  toggle_on: ['ui_toggle_on', 0, 'ui'],
  title_jingle: ['mus_title_jingle', 0, 'ui'],
  block_place: ['meta_block_place', 0, 'ui'],
  hob_pick: ['turn_hob_pick', 0, 'ui'],
  aim_start: ['aim_drag_start', 0, 'ui'],
  aim_limit: ['aim_limit', 0, 'ui'],
  aim_recall: ['aim_recall', 0, 'ui'],
  aim_set: ['aim_set', 0, 'ui'],
  aim_tick: ['aim_tick', 0, 'ui'],
  bonk: ['hob_bonk', 0, 'sfx'],
  thud: ['hit_miss_thud', 0, 'sfx'],
  hit: ['hit_blast_small', 0, 'sfx'],
  break: ['mat_timber_break', 0, 'sfx'],
  turn: ['turn_yours', 0, 'ui'],
  turn2: ['turn_yours', -2, 'ui'],
  pennant: ['meta_pennant_stamp', 0, 'ui'],
  pop: ['ket_pop', 0, 'sfx'],
  squall: ['wx_squall_bell', 0, 'sfx'],
  win: ['sting_win', 0, 'ui'],
  lose: ['sting_lose', 0, 'ui'],
  walk: ['cas_step', 0, 'sfx'],
  steam: ['cas_steam', 0, 'sfx'],
  creak: ['col_creak', 0, 'sfx'],
  coin: ['ui_buttons_tick', 0, 'ui'],
  handoff: ['ui_handoff_flip', 0, 'ui'],
  fire_press: ['ui_fire_press', 0, 'ui'],
  denied: ['ui_denied', 0, 'ui'],
  mend_bucket: ['doo_mend_bucket_slosh', 0, 'sfx'],
  mend_fizz: ['hit_mend_fizz', 0, 'sfx'],
  ket_patch: ['ket_patch', 0, 'sfx'],
  bounce: ['fly_bounce_hop', 0, 'sfx'],
  fast_zip: ['fly_fast_zip', 0, 'sfx'],
  split: ['fly_split', 0, 'sfx'],
  // Separate cues: the lid clang, the buried thud, the boss horn and the weather front chime.
  // wx_squall_bell is the Squall's only (07 §6, naming-decisions "Play and look" 6).
  lid_bounce: ['doo_lid_bounce', 0, 'sfx'],
  buried: ['hob_buried_thlup', 0, 'sfx'],
  boss_horn: ['cas_boss_horn', 0, 'sfx'],
  front_chime: ['wx_front_chime', 0, 'sfx'],
  threaded: ['hit_threaded_zip', 0, 'sfx'],
  // Little Ethel rolls out on the rumble; when she stops or is done, the same rumble 3 semitones down.
  roller: ['doo_roller_rumble', 0, 'sfx'],
  roller_low: ['doo_roller_rumble', -3, 'sfx'],
  shears_jam: ['doo_shears_jam', 0, 'sfx'],
  // The Grand Fort's roller and shears, props and ground (they act between turns, so never silent).
  roll: ['launch_roll', -3, 'sfx'],
  shears: ['ui_card_flip', -5, 'sfx'],
  snip: ['hit_pierce', 2, 'sfx'],
  boom: ['hit_blast_medium', 0, 'sfx'],
  crock: ['aim_tick', -4, 'sfx'],
  carve: ['hit_dig_carve', 0, 'sfx'],
  mound: ['gnd_mound_grow', 0, 'sfx'],
};

/** Sound captions (content/text.json captions.*), by the sound or cue name. */
const CAPTION_KEY: Partial<Record<Sfx | Cue, string>> = {
  boom: 'boom',
  bonk: 'bonk',
  pop: 'kettle_pop',
  squall: 'squall',
  wind: 'wind',
  front_chime: 'wind',
  creak: 'creaks',
  fall: 'collapse',
  thump: 'thump',
  lid_bounce: 'lid',
  buried: 'buried',
  boss_horn: 'boss_phase',
  shears: 'shears_open',
  snip: 'snip',
  mend_bucket: 'mend',
  ket_patch: 'relight',
};
const caption = (k: Sfx | Cue): string | undefined => { const c = CAPTION_KEY[k]; return c ? t(`captions.${c}`) : undefined; };

export function play(s: Sfx, pan = 0): void {
  const cap = caption(s);
  if (cap) captionSink?.(cap);
  if (!ctx || muted || !gate(s)) return;
  const id = PLAY_ID[s];
  if (id && sample(id[0], 1, id[1], id[2], pan)) return;
  synth(s);
}

function synth(s: Sfx): void {
  switch (s) {
    case 'tap': case 'slider_tick': case 'aim_tick': case 'hob_pick': tone(660, 0.05, 'triangle', 0.22); break;
    case 'back': tone(440, 0.07, 'triangle', 0.2, 0.75); break;
    case 'confirm': case 'toggle_on': case 'card_take': case 'block_place': tone(580, 0.08, 'triangle', 0.24, 1.25); break;
    case 'aim_start': case 'aim_set': case 'aim_recall': tone(520, 0.06, 'sine', 0.18, 1.15); break;
    case 'aim_limit': tone(240, 0.06, 'square', 0.12); break;
    case 'sheet': case 'handoff': tone(420, 0.12, 'sine', 0.2, 1.5); break;
    case 'fire': case 'fire_press': tone(140, 0.25, 'sine', 0.8, 0.4); noise(0.18, 0.4, 900, 0.8); break;
    case 'whoosh': case 'fast_zip': noise(0.25, 0.15, 2100, 2); break;
    case 'bounce': tone(340, 0.09, 'sine', 0.28, 1.6); break;
    case 'split': tone(760, 0.07, 'triangle', 0.2, 1.4); break;
    case 'hit': tone(90, 0.3, 'sine', 0.9, 0.5); noise(0.3, 0.5, 400, 0.7); break;
    case 'break': noise(0.25, 0.5, 1200, 1.5); tone(300, 0.1, 'square', 0.1, 0.5); break;
    case 'thud': tone(70, 0.2, 'sine', 0.6, 0.6); break;
    case 'bonk': tone(880, 0.12, 'square', 0.25, 0.5); tone(1320, 0.2, 'triangle', 0.25, 1, 0.08); break;
    case 'turn': tone(660, 0.15, 'triangle', 0.3); tone(990, 0.2, 'triangle', 0.25, 1, 0.1); break;
    case 'turn2': tone(495, 0.15, 'triangle', 0.3); tone(742, 0.2, 'triangle', 0.25, 1, 0.1); break;
    case 'pennant': case 'ket_patch': tone(110, 0.15, 'sine', 0.7, 0.5); tone(784, 0.25, 'triangle', 0.3, 1, 0.05); break;
    case 'mend_bucket': case 'mend_fizz': tone(520, 0.14, 'sine', 0.22, 1.4); noise(0.18, 0.14, 2400, 2); break;
    case 'steam': noise(0.24, 0.16, 3200, 1.5); break;
    case 'pop': tone(1200, 0.5, 'sawtooth', 0.15, 0.2); noise(0.6, 0.6, 3000, 0.5); break;
    case 'squall': noise(1.2, 0.35, 250, 0.5); break;
    case 'win': case 'title_jingle': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.3, 1, i * 0.12)); break;
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
    case 'lid_bounce': tone(900, 0.18, 'triangle', 0.25, 0.8); break;
    case 'buried': tone(80, 0.22, 'sine', 0.6, 0.5); noise(0.2, 0.3, 300, 0.6); break;
    case 'boss_horn': tone(147, 0.9, 'sawtooth', 0.12, 1); break;
    case 'front_chime': tone(1175, 0.4, 'sine', 0.18); tone(1568, 0.5, 'sine', 0.14, 1, 0.12); break;
    case 'threaded': noise(0.2, 0.25, 2600, 2.5); tone(1400, 0.12, 'triangle', 0.15, 1.6); break;
    case 'roller': noise(0.7, 0.3, 140, 0.6); tone(50, 0.7, 'sine', 0.4, 0.9); break;
    case 'roller_low': noise(0.7, 0.3, 110, 0.6); tone(42, 0.7, 'sine', 0.4, 0.8); break;
    case 'shears_jam': tone(700, 0.1, 'square', 0.12, 0.6); tone(300, 0.2, 'square', 0.1, 0.5, 0.1); break;
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
    case 'threaded': return 'hit_threaded_zip';
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
  cheer: 'pennant', squall: 'squall', wind: 'whoosh', pin: 'tap', flap: 'sheet', lid: 'sheet', split: 'split',
};

/** A feel cue: the pack's sound if it is decoded, else a synth stand-in. `gain` scales it (collapse size), `pan` (-1..1) places it in stereo. */
export function cue(c: Cue, arg = '', gain = 1, pan = 0): void {
  const cap = caption(c);
  if (cap) captionSink?.(cap);
  if (!ctx || muted) return;
  const id = cueId(c, arg);
  if (!gate(id ?? c)) return;
  if (sample(id, gain, 0, 'sfx', pan)) return;
  const s = CUE_SYNTH[c];
  if (s) synth(s);
}

// ---------- barks (Hob-speak) ----------
// One bark per side per turn step and 1.5 s between barks; most events bark 40% of the time,
// Bonks and wins always [assets/audio/README.md]. The subtitle (assets/audio/barks.json, the one
// source) shows even with the sound off (07 §7.6), so the choice is made here and the line handed
// back to the caller. Keys under `hobs` are content Hob ids (old_thumper); each bark names its own
// sound id (bark_thumper_*). `with_mate` lines join the pool only when that Hob is on the same
// crew, `with_rival` lines only against a named Rival, and `chance` overrides the event chance.
interface BarkDef { sound?: string; subtitles?: string[]; with_mate?: Record<string, string[]>; with_rival?: string[]; chance?: number }
type BarkLines = Record<string, { barks?: Record<string, BarkDef> }>;
let barkLines: BarkLines | null = null;
let crewLines: Record<string, { subtitles?: string[] }> | null = null;
const lastLine = new Map<string, string>();
let lastBark = -1e9;
const barkStep = [-1, -1];
let barkHobs: string[] = [];
let barkGen = 0;
/** Who is in this fight: each side's content Hob ids, and the Rival's short name ('' when unnamed). */
let barkCrews: [string[], string[]] = [[], []];
let barkRival = '';

/** The sound id for a Hob's bark: the entry's own `sound`, else bark_<id>_<event>. */
function barkSound(hob: string, ev: string): string {
  return barkLines?.[hob]?.barks?.[ev]?.sound ?? `bark_${hob}_${ev}`;
}

/**
 * Decode the barks of the Hobs in this fight only (content Hob ids per side), and note who can be
 * named in a line. Returns a monotonic fight ID for safe cleanup.
 */
export function preloadBarks(crews: [string[], string[]], rival = ''): number {
  const gen = ++barkGen;
  barkCrews = [[...new Set(crews[0])], [...new Set(crews[1])]];
  barkRival = rival;
  barkHobs = [...new Set([...crews[0], ...crews[1]])];
  if (!ctx || !man) return gen;
  const want = new Set<string>();
  for (const hb of barkHobs) for (const ev of Object.keys(barkLines?.[hb]?.barks ?? {})) want.add(barkSound(hb, ev));
  const ids = [...byId.keys()].filter((id) => want.has(id));
  void (async () => {
    for (const id of ids) {
      if (gen !== barkGen) return;
      await buffer(id, gen);
      await new Promise((r) => setTimeout(r, 12));
    }
  })();
  return gen;
}

/** A fight is over: its barks are let go (guarded by fight ID so a Retry never wipes the next fight's barks). */
export function releaseBarks(gen?: number): void {
  if (gen !== undefined && gen !== barkGen) return;
  barkHobs = [];
  release([...buffers.keys()].filter((id) => id.startsWith('bark_')));
}

/** One line from a pool, never the one said last time under that key. */
function pickLine(key: string, lines: string[]): string | undefined {
  if (!lines.length) return undefined;
  let i = Math.floor(rand() * lines.length);
  if (lines.length > 1 && lines[i] === lastLine.get(key)) i = (i + 1) % lines.length;
  lastLine.set(key, lines[i]);
  return lines[i];
}

/** Returns the subtitle line when the Hob barks (with or without sound), else undefined. `hob` is the content id. */
export function bark(hob: string, ev: 'fire' | 'takes_hit' | 'hit_lands' | 'bonked' | 'win' | 'picked', side: number, step: number): string | undefined {
  const def = barkLines?.[hob]?.barks?.[ev];
  const always = ev === 'bonked' || ev === 'win';
  const chance = def?.chance ?? (always ? 1 : 0.4);
  const now = performance.now();
  if (ev === 'picked') {
    if (now - lastBark < 1500) return undefined;
  } else {
    if (now - lastBark < 1500 || barkStep[side] === step) return undefined;
  }
  if ((ev !== 'picked' || def?.chance !== undefined) && rand() > chance) return undefined;
  // The pool: plain lines, plus lines naming a mate on this crew, plus Rival lines in a named-Rival fight.
  const mates = barkCrews[side === 1 ? 1 : 0];
  const subs = [
    ...(def?.subtitles ?? []),
    ...Object.entries(def?.with_mate ?? {}).filter(([m]) => m !== hob && mates.includes(m)).flatMap(([, l]) => l),
    ...(barkRival ? (def?.with_rival ?? []).map((l) => l.replace(/\{rival\}/g, barkRival)) : []),
  ];
  const id = barkSound(hob, ev);
  const played = ctx && !muted && voicesVol > 0 ? sample(id, 1, 0, 'bark', side === 0 ? -0.25 : 0.25) : null;
  if (played) duckFor(played.duration);
  if (!played && !subs.length) return undefined;
  lastBark = now;
  if (ev !== 'picked') barkStep[side] = step;
  return pickLine(`${hob}:${ev}`, subs);
}

/** A whole-crew line from barks.json `crew` (crew.win: "Lumpy forever!"), with no sound of its own. */
export function crewLine(ev: string): string {
  return pickLine(`crew:${ev}`, crewLines?.[ev]?.subtitles ?? []) ?? '';
}

// ---------- loops: kettle whistle, wind bed, squall, shell whistle, roll, aim band ----------
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
  const want = gain > 0.001 && !muted && !audioPaused;
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
    // Inherit slow-mo playback rate immediately on start (Web-M3).
    src.playbackRate.value = Math.pow(2, (semis + (slow ? -3 : 0)) / 12);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(sfxBus ?? master);
    src.start();
    l.src = src; l.g = g; l.on = true; l.target = 0; l.semis = semis;
    const me = l;
    if (gap) src.onended = () => { if (me.src === src) { me.on = false; me.src = null; me.g = null; me.gapT = (ctx?.currentTime ?? 0) + gap; } };
  }
  if (!l.on || !l.g || !l.src) return;
  if (!want) { fadeOut(l); return; }
  const t = ctx.currentTime;
  const target = gain * (s?.volume ?? 1);
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

// ---------- music: Region 1 layers, the map theme (playhead-integrated slow-mo sync) ----------
interface Track { id: string; src: AudioBufferSourceNode; g: GainNode }
let music: Track[] = [];
let musicKey = '';
let barS = 1.111111;
let musicPos = 0;
let musicRateT = 0;
let musicRate = 1;

function currentMusicPos(at = ctx?.currentTime ?? 0): number {
  return Math.max(0, musicPos + (at - musicRateT) * musicRate);
}
function setMusicRate(rate: number, at: number): void {
  musicPos = currentMusicPos(at);
  musicRateT = at;
  musicRate = rate;
}

const THEME: Record<'battle' | 'map', string[]> = { battle: ['mus_r1_base', 'mus_r1_stir', 'mus_r1_peril'], map: ['mus_map'] };
let wanted: 'battle' | 'map' | '' = '';
let layersT = 0;
let layersAsked = false;
const LAYER_DELAY_MS = 4_000;

export function setMusic(key: 'battle' | 'map' | ''): void {
  wanted = key;
  if (!ctx || !man) return;
  if (key === musicKey) return;
  musicKey = key;
  layerState = 0;
  layersAsked = false;
  clearTimeout(layersT);
  const old = music;
  music = [];
  if (ctx) for (const m of old) { m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); m.src.stop(ctx.currentTime + 1.5); }
  for (const k of ['battle', 'map'] as const) if (k !== key) release(THEME[k]);
  if (!key || !ctx || !musicBus) return;
  const ids = THEME[key];
  void firstReady.then(() => (musicKey === key ? buffer(ids[0]) : null)).then((b) => {
    if (musicKey !== key || !ctx || !musicBus) return;
    if (!b) { musicKey = ''; return; }
    const t0 = ctx.currentTime + 0.1;
    musicPos = 0;
    musicRateT = t0;
    musicRate = slow ? Math.pow(2, -3 / 12) : 1;
    barS = key === 'battle' ? 1.111111 : 1.304348;
    music = [track(ids[0], b, t0, 0, true)];
    if (ids.length > 1) {
      if (pendingLayers) addLayers(key);
      else layersT = window.setTimeout(() => addLayers(key), LAYER_DELAY_MS);
    }
  });
}

function track(id: string, b: AudioBuffer, when: number, offset: number, on: boolean): Track {
  const s = byId.get(id)!;
  const src = ctx!.createBufferSource();
  src.buffer = b;
  src.loop = true;
  if (s.samples && s.sample_rate) src.loopEnd = s.samples / s.sample_rate;
  // Inherit current slow-mo playback rate so layers never drift out of phase (Web-M3).
  src.playbackRate.value = musicRate;
  const g = ctx!.createGain();
  g.gain.value = on ? (s.volume ?? 1) : 0;
  src.connect(g).connect(musicBus!);
  src.start(when, offset);
  return { id, src, g };
}

/** Load Stir and Peril and start them silent, sample-synced to the integrated playhead on the next bar. */
function addLayers(key: 'battle' | 'map'): void {
  if (layersAsked) return;
  layersAsked = true;
  clearTimeout(layersT);
  const ids = THEME[key].slice(1);
  void Promise.all(ids.map((id) => buffer(id))).then((bs) => {
    if (musicKey !== key || !ctx || !musicBus || music.length !== 1) return;
    if (bs.some((b) => !b)) { layersAsked = false; return; }
    const baseSrc = music[0].src;
    const len = baseSrc.loopEnd > 0 ? baseSrc.loopEnd : baseSrc.buffer?.duration ?? 0;
    const t = ctx.currentTime + 0.05;
    const pos = currentMusicPos(t);
    const nextBarPos = Math.ceil(pos / barS) * barS;
    const when = t + (nextBarPos - pos) / Math.max(0.1, musicRate);
    const offset = len > 0 ? nextBarPos % len : 0;
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
  const pos = currentMusicPos(t);
  const nextBarPos = Math.ceil(pos / barS) * barS;
  const nextBar = t + (nextBarPos - pos) / Math.max(0.1, musicRate);
  const fadeDur = barS / Math.max(0.1, musicRate);
  for (let i = 1; i < 3; i++) {
    const on = i === 1 ? stir || peril : peril;
    const g = music[i].g.gain;
    const vol = byId.get(music[i].id)?.volume ?? 1;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setValueAtTime(g.value, nextBar);
    g.linearRampToValueAtTime(on ? vol : 0, nextBar + fadeDur);
  }
}
