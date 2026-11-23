// Plays assets/animations.json, the one animation list that web, Android and iOS share.
// It reads the real play order (`frames`), per-frame times (`ms`), `loop` with `loop_from`,
// `next`, `hold`, `pick` and the frame `events`, exactly as assets/README.md describes.
//
// Time is view time in ms: the caller passes the frame time already scaled by hit stop and
// slow motion, so a freeze freezes every clip. The hot path (step, frame) allocates nothing.

export interface Clip {
  name: string;
  frames: string[];
  ms: number[];
  total: number;
  loop: boolean;
  loopFrom: number;
  /** Event names by frame index (null where a frame has none). */
  ev: (string[] | null)[];
  next?: string;
  hold?: string;
  pick?: string;
  w: number;
  h: number;
  anchor: [number, number];
  /** Idle loops: start at a random time in the loop, so a crew never breathes in step. */
  randomStart?: boolean;
  /** Idle loops: where to start when the app does not randomise (differs per Hob and team). */
  startOffsetMs?: number;
}

type Track = [number, number][];

interface RawClip {
  frames: string[]; ms: number[]; loop: boolean; loop_from?: number; events?: Record<string, number>;
  next?: string; hold?: string; pick?: string; w: number; h: number; anchor: [number, number];
  random_start?: boolean; start_offset_ms?: number;
}

/** Motion data with no frames (animations.json `data`). Shapes as in the file. */
export interface AnimData {
  fort_bob: { frame_ms: number; dy: number[]; tilt: number[]; stomp_frames: number[] };
  collapse: {
    creak: { ms: number; shiver_x: Track };
    wobble_deg: Record<string, Track>;
    lean: { ms: number; deg: Record<string, number>; track: Track };
    drop: { row_gap_ms: number; sway_deg: Record<string, number> };
    land: { squash_y: Track; skid_px: Record<string, number> };
    break: { ms: number; chunks_per_block: Record<string, number>; rubble_hold_ms: number; dust_scale: Record<string, number> };
  };
  turn_banner: {
    in: { y: Track; opacity: Track }; hold_ms: number; out: { y: Track; opacity: Track };
    reduce_motion: { in: { opacity: Track }; out: { opacity: Track } };
  };
  hand_off_card: { in: { scale: Track; opacity: Track } };
}

class AnimLib {
  private clips = new Map<string, Clip>();
  data?: AnimData;
  ready = false;

  async load(base: string): Promise<void> {
    try {
      const r = await fetch(`${base}art/animations.json`);
      if (!r.ok) throw new Error('no animations.json');
      this.add((await r.json()) as { animations: Record<string, RawClip>; data: AnimData });
    } catch (e) {
      console.info('[castle] no animation list, using still frames:', (e as Error).message);
    }
  }

  add(json: { animations: Record<string, RawClip>; data: AnimData }): void {
    for (const name in json.animations) {
      const a = json.animations[name];
      const ev: (string[] | null)[] = a.frames.map(() => null);
      for (const k in a.events ?? {}) { const i = a.events![k]; (ev[i] ??= []).push(k); }
      this.clips.set(name, {
        name, frames: a.frames, ms: a.ms, total: a.ms.reduce((x, y) => x + y, 0), loop: a.loop, loopFrom: a.loop_from ?? 0,
        ev, next: a.next, hold: a.hold, pick: a.pick, w: a.w, h: a.h, anchor: a.anchor,
        randomStart: a.random_start, startOffsetMs: a.start_offset_ms,
      });
    }
    this.data = json.data;
    // The blast starbursts are still frames in the atlas: 8 frames at 30 fps, drawn as 4 [06 §7].
    for (const size of ['small', 'medium', 'large']) this.synth(`fx_boom_${size}`, [0, 1, 2, 3].map((i) => `fx_boom_${size}_${i}`), 67);
    this.ready = this.clips.size > 0;
  }

  /** A play-once clip made from still frames (for art that has no entry in the list). */
  synth(name: string, frames: string[], ms: number): void {
    if (this.clips.has(name)) return;
    this.clips.set(name, { name, frames, ms: frames.map(() => ms), total: ms * frames.length, loop: false, loopFrom: 0, ev: frames.map(() => null), w: 0, h: 0, anchor: [0, 0] });
  }

  get(name: string): Clip | undefined { return this.clips.get(name); }
  get count(): number { return this.clips.size; }
}

export const anims = new AnimLib();

/** Called when a frame with events first shows. `p` is the player, `tag` its owner's tag. */
export type EventSink = (name: string, p: AnimPlayer) => void;

/**
 * One running clip. Reused, never thrown away: `play` swaps the clip and resets time.
 * `reverse` reads the lists from the end (Flap roll-up, Pot Lid down, hand-off back to player 1).
 */
export class AnimPlayer {
  clip: Clip | null = null;
  t = 0;
  idx = 0;
  done = false;
  reverse = false;
  /** Free slot for the owner (a Hob id, an effect kind). */
  tag = 0;
  private lastIdx = -1;

  play(c: Clip | undefined | null, reverse = false, restart = true): this {
    if (!c) { this.clip = null; return this; }
    if (!restart && this.clip === c && this.reverse === reverse && !this.done) return this;
    this.clip = c;
    this.t = 0;
    this.idx = reverse ? c.frames.length - 1 : 0;
    this.lastIdx = -1;
    this.done = false;
    this.reverse = reverse;
    return this;
  }

  /**
   * Jump to `ms` into the clip (a loop wraps), with no frame events fired for the frames skipped.
   * Used to start idle loops at a random point (animations.json `random_start`, `start_offset_ms`).
   */
  seek(ms: number): this {
    const c = this.clip;
    if (!c || c.pick || c.total <= 0) return this;
    let t = c.loop ? ((ms % c.total) + c.total) % c.total : Math.max(0, Math.min(ms, c.total));
    let i = 0;
    while (i < c.ms.length - 1 && t >= c.ms[i]) { t -= c.ms[i]; i++; }
    this.idx = i;
    this.t = t;
    this.lastIdx = i;
    return this;
  }

  /** Show one frame of a `pick` clip (aim power), no timing. */
  pick(c: Clip | undefined, i: number): void {
    if (!c) return;
    this.clip = c;
    this.idx = Math.max(0, Math.min(c.frames.length - 1, i));
    this.done = false;
    this.lastIdx = this.idx;
  }

  /** Advance by dt ms of view time. Fires frame events through `sink`; follows `next` and `hold`. */
  step(dt: number, sink?: EventSink, lib = anims): void {
    const c = this.clip;
    if (!c || c.pick) return;
    if (this.lastIdx < 0) { this.lastIdx = this.idx; this.fire(sink); }
    if (this.done) return;
    this.t += dt;
    // Walk the frame times; a long dt may cross several frames (each fires its events).
    let guard = 64;
    while (guard-- > 0) {
      const dur = c.ms[this.idx];
      if (this.t < dur) break;
      this.t -= dur;
      const last = this.reverse ? this.idx === 0 : this.idx === c.frames.length - 1;
      if (last) {
        if (c.loop) {
          this.idx = this.reverse ? c.frames.length - 1 : c.loopFrom;
        } else if (c.next && !this.reverse) {
          const n = lib.get(c.next);
          if (!n) { this.done = true; this.t = 0; return; }
          this.play(n);
          this.step(0, sink, lib);
          return;
        } else { this.done = true; this.t = 0; return; }
      } else this.idx += this.reverse ? -1 : 1;
      if (this.idx !== this.lastIdx) { this.lastIdx = this.idx; this.fire(sink); }
    }
  }

  private fire(sink?: EventSink): void {
    const e = this.clip?.ev[this.idx];
    if (e && sink) for (let i = 0; i < e.length; i++) sink(e[i], this);
  }

  /** The sprite to draw now: the current frame, or `hold` when a play-once clip is over. */
  frame(): string | undefined {
    const c = this.clip;
    if (!c) return undefined;
    if (this.done) {
      if (this.reverse) return c.frames[0];
      return c.hold ?? c.frames[c.frames.length - 1];
    }
    return c.frames[this.idx];
  }
}

/** A data track: [time ms, value] keys, straight lines between keys, held past the ends. */
export function track(keys: Track, t: number): number {
  const n = keys.length;
  if (!n) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < n; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const span = k1[0] - k0[0];
      return span > 0 ? k0[1] + ((k1[1] - k0[1]) * (t - k0[0])) / span : k1[1];
    }
  }
  return keys[n - 1][1];
}

/** The last key time of a track. */
export function trackEnd(keys: Track): number { return keys.length ? keys[keys.length - 1][0] : 0; }

/** Keyframes for the Web Animations API from two tracks that share a timeline. */
export function trackKeyframes(tracks: Record<string, Track>, fmt: (k: string, v: number) => [string, string]): { frames: Keyframe[]; ms: number } {
  const times = new Set<number>();
  for (const k in tracks) for (const [t] of tracks[k]) times.add(t);
  const sorted = [...times].sort((a, b) => a - b);
  const ms = sorted[sorted.length - 1] || 1;
  const frames = sorted.map((t) => {
    const f: Keyframe = { offset: t / ms };
    for (const k in tracks) { const [prop, val] = fmt(k, track(tracks[k], t)); (f as Record<string, unknown>)[prop] = val; }
    return f;
  });
  return { frames, ms };
}

/**
 * The frame of a clip at time `t` ms with no player (for many copies of one loop: shimmer,
 * Ghost dots, Stomper legs). Loops wrap from `loop_from`; play-once clips hold the last frame.
 */
export function frameAt(c: Clip, t: number): string {
  let i = frameIndexAt(c, t);
  if (i < 0) i = c.frames.length - 1;
  return c.frames[i];
}
export function frameIndexAt(c: Clip, t: number): number {
  if (t < 0) t = 0;
  if (t >= c.total) {
    if (!c.loop) return c.frames.length - 1;
    let pre = 0;
    for (let i = 0; i < c.loopFrom; i++) pre += c.ms[i];
    const span = c.total - pre;
    t = span > 0 ? pre + ((t - pre) % span) : 0;
  }
  for (let i = 0; i < c.ms.length; i++) { if (t < c.ms[i]) return i; t -= c.ms[i]; }
  return c.frames.length - 1;
}
