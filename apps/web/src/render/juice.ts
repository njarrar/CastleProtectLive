// Feedback and juice from 07 section 6: hit stop (6.1), trauma shake (6.2) and slow motion (6.4).
// These are view numbers, not rules: they only scale how fast the view (and so the fixed-step
// sim, which is stepped in view time) moves on the wall clock. The sim's ticks never change,
// so replays and saves do not care. Shake uses its own cosmetic random numbers.

export type Slow = 'kettle_pop' | 'clean_sweep' | 'bonk' | 'own_last_bonk' | 'collapse' | 'quick_impact' | 'near_miss' | 'threaded';

/** 07 §6.4: speed and real time per trigger. */
const SLOW: Record<Slow, [number, number]> = {
  kettle_pop: [0.25, 1200],
  clean_sweep: [0.3, 1000],
  bonk: [0.5, 400],
  own_last_bonk: [0.5, 600],
  collapse: [0.5, 600],
  quick_impact: [0.4, 300],
  near_miss: [0.5, 300],
  threaded: [0.4, 400],
};

/** Blast radius bands (cells, 00 §9.3): the one place the view keeps them. */
const BLAST_MIN = [64, 42, 28, 18] as const;
const BLAST_NAME = ['huge', 'large', 'medium', 'small', 'tiny'] as const;
/** 0 huge .. 4 tiny. */
function blastIdx(r: number): number { let i = 0; while (i < 4 && r < BLAST_MIN[i]) i++; return i; }
/** A blast radius to its band name (sound files are named by it). */
export function blastBand(r: number): string { return BLAST_NAME[blastIdx(r)]; }

const TRAUMA: [number, number][] = [[0.8, 450], [0.55, 350], [0.35, 250], [0.2, 200], [0.1, 150]];
/** 07 §6.2: trauma added and decay, by blast radius band. */
export function blastTrauma(r: number): [number, number] { return TRAUMA[blastIdx(r)]; }

/** 07 §6.1: hit stop ms for a hit of this much damage on a Hob (bands from 00 §9.3). */
export function hobHitStop(dmg: number): number {
  if (dmg >= 90) return 80;
  if (dmg >= 50) return 50;
  if (dmg >= 30) return 30;
  return 0;
}

const CAP_PX = 12;
const CAP_ROLL = Math.PI / 180;
const NOISE_N = 256;

export class Juice {
  // settings, set by the battle each frame
  reduceMotion = false;
  /** 1, 0.5 or 0 (07 Reduce shake). */
  shakeScale = 1;
  /** Resolve at 2x: hit stops halve, slow motion is off for the turn. */
  fast = false;

  // hit stop
  private stopLeft = 0;
  private lastStopAt = -1e9;
  // slow motion
  private slowLeft = 0;
  private slowSpeed = 1;
  private slowKind: Slow | null = null;
  /** Added wall time this turn (ms), capped at 1.5 s. */
  private addedThisTurn = 0;
  private slowThisShot = false;
  /** The slow-mo push-in target, world cells, while one plays. */
  focusX = 0;
  focusY = 0;
  focusOn = false;
  focusZoom = 1;

  // shake
  trauma = 0;
  private decayPerMs = 0;
  private vertical = false;
  private kickX = 0;
  private kickY = 0;
  private kickLeft = 0;
  private t = 0;
  private noise = new Float32Array(NOISE_N * 3);
  /** Field offset in screen px and roll in radians, for this frame. */
  ox = 0;
  oy = 0;
  roll = 0;
  /** 0% shake: a 2 pt white rim on the blast in its place. */
  rim: { x: number; y: number; r: number; left: number } = { x: 0, y: 0, r: 0, left: 0 };

  private wall = 0;

  constructor(seed = 0x2f6fde) {
    // Cosmetic random numbers (never the sim RNG): a small LCG over a fixed table.
    let s = seed >>> 0;
    for (let i = 0; i < this.noise.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      this.noise[i] = (s / 4294967296) * 2 - 1;
    }
  }

  /** A new turn: the slow-mo budget starts again. */
  newTurn(): void { this.addedThisTurn = 0; this.slowThisShot = false; this.trauma = 0; }
  /** A new shot: one slow-mo per shot. */
  newShot(): void { this.slowThisShot = false; }

  /** Freeze the view for `ms` (07 §6.1). At most one per 250 ms; halves at 2x; 50 ms cap with Reduce motion. */
  hitStop(ms: number): void {
    if (ms <= 0) return;
    if (this.wall - this.lastStopAt < 250) return;
    let d = this.fast ? ms / 2 : ms;
    if (this.reduceMotion) d = Math.min(50, d);
    this.lastStopAt = this.wall;
    this.stopLeft = Math.max(this.stopLeft, d);
  }

  /**
   * Slow motion (07 §6.4). `ending` is a battle-ending one: it always plays.
   * Returns true when it plays. With Reduce motion: no slow-mo, a 150 ms hold instead.
   */
  slow(kind: Slow, ending = false, at?: [number, number], zoom = 1): boolean {
    if (this.fast && !ending) return false;
    if (this.slowThisShot && !ending) return false;
    if (this.reduceMotion) {
      this.stopLeft = Math.max(this.stopLeft, 150);
      this.slowThisShot = true;
      return true;
    }
    const [speed, dur] = SLOW[kind];
    const added = dur * (1 - speed);
    let d = dur;
    if (!ending) {
      const room = 1500 - this.addedThisTurn;
      if (room <= 40) return false;
      if (added > room) d = room / (1 - speed);
    }
    // A stronger slow wins over a weaker one still running (and the weaker one spends nothing).
    if (this.slowLeft > 0 && this.slowSpeed < speed) return false;
    this.addedThisTurn += d * (1 - speed);
    this.slowThisShot = true;
    this.slowSpeed = speed;
    this.slowLeft = d;
    this.slowKind = kind;
    if (at) { this.focusX = at[0]; this.focusY = at[1]; this.focusZoom = zoom; this.focusOn = zoom !== 1; } else this.focusOn = false;
    return true;
  }

  /** Tapping 2x in Resolve cancels slow motion for the turn. */
  cancelSlow(): void { this.slowLeft = 0; this.slowSpeed = 1; this.focusOn = false; this.addedThisTurn = 1500; }

  get slowing(): Slow | null { return this.slowLeft > 0 ? this.slowKind : null; }
  get stopped(): boolean { return this.stopLeft > 0; }
  /** Wall ms left of the running slow-mo (the results card waits for a battle-ending one). */
  get slowRemaining(): number { return this.slowLeft; }

  /**
   * Add trauma (07 §6.2). `dist` is the blast's distance from the view centre in screen widths:
   * full within 1, none beyond 2. (dx, dy) points from the blast to the view centre.
   */
  shake(amount: number, decayMs: number, dist = 0, dx = 0, dy = 0, vertical = false): void {
    const k = dist <= 1 ? 1 : dist >= 2 ? 0 : 2 - dist;
    const add = amount * k;
    if (add <= 0) return;
    this.trauma = Math.min(1, this.trauma + add);
    this.decayPerMs = this.trauma / Math.max(1, decayMs);
    this.vertical = vertical;
    // The first kick points away from the blast.
    const len = Math.hypot(dx, dy);
    if (len > 0) { this.kickX = dx / len; this.kickY = dy / len; } else { this.kickX = 0; this.kickY = vertical ? 1 : 0; }
    this.kickLeft = 33;
  }

  /** The 0% shake setting draws a rim on the blast instead. */
  rimAt(x: number, y: number, r: number): void { this.rim.x = x; this.rim.y = y; this.rim.r = r; this.rim.left = 120; }

  /**
   * Advance by wall ms. Returns the view-time scale for this frame: 0 in a hit stop, the
   * slow-mo speed in slow motion, else 1. `calm` is the Plan step or an Aim Drag: no shake, ever.
   */
  update(wallMs: number, calm: boolean): number {
    this.wall += wallMs;
    let scale = 1;
    if (this.stopLeft > 0) {
      this.stopLeft -= wallMs;
      scale = 0;
    } else if (this.slowLeft > 0) {
      this.slowLeft -= wallMs;
      scale = this.slowSpeed;
      if (this.slowLeft <= 0) { this.slowSpeed = 1; this.focusOn = false; }
    }
    if (this.rim.left > 0) this.rim.left -= wallMs;
    // Shake runs on wall time, so it keeps moving through a hit stop (the freeze reads as a jolt).
    if (calm) { this.trauma = 0; this.kickLeft = 0; }
    else if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - this.decayPerMs * wallMs);
    this.t += wallMs;
    const tt = this.trauma * this.trauma * this.shakeScale;
    if (tt <= 0 || this.reduceMotion) { this.ox = 0; this.oy = 0; this.roll = 0; return scale; }
    let nx: number, ny: number, nr: number;
    if (this.kickLeft > 0) {
      this.kickLeft -= wallMs;
      nx = this.kickX; ny = this.kickY; nr = 0;
    } else {
      // Smooth value noise at about 30 Hz, from the cosmetic table.
      const p = this.t * 0.03;
      const i = Math.floor(p), f = p - i, s = f * f * (3 - 2 * f);
      const a = (i % NOISE_N) * 3, b = ((i + 1) % NOISE_N) * 3;
      const n = this.noise;
      nx = n[a] + (n[b] - n[a]) * s;
      ny = n[a + 1] + (n[b + 1] - n[a + 1]) * s;
      nr = n[a + 2] + (n[b + 2] - n[a + 2]) * s;
    }
    this.ox = this.vertical ? 0 : nx * CAP_PX * tt;
    this.oy = ny * CAP_PX * tt;
    this.roll = this.vertical ? 0 : nr * CAP_ROLL * tt;
    return scale;
  }
}
