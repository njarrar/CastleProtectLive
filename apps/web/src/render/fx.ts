// Pooled view effects: animated sprite effects (impacts, trails, dust, chunks, splash, leaves,
// steam, pin drops), plain specks, and the damage numbers of 07 §6.3. Everything is preallocated
// and reused; spawning and drawing allocate nothing. Effects never touch the sim [06 §7].
import { AnimPlayer, anims, type Clip } from './anim';
import { sprites } from './sprites';
import { type Cam, type Rect, sx, sy } from './view';

const INK = '#2B1E2E';

/** 06 §7 budgets: Mid tier is 120 particles on screen. Debris over the cap is dropped. */
export const FX_CAP = 140;

export class SpriteFx {
  active = false;
  p = new AnimPlayer();
  x = 0; y = 0; vx = 0; vy = 0; g = 0;
  rot = 0; vr = 0;
  scale = 1;
  alpha = 1;
  /** Ms to keep showing the last (or hold) frame after the clip ends, fading over `fade` ms. */
  hold = 0;
  fade = 0;
  age = 0;
  flip = false;
  /** Drift with the wind (cells/s per wind unit). */
  wind = 0;
  /** Plain speck: no clip, a square of this colour and size (cells). */
  color = '';
  size = 0;
  life = 0;
  /** 1: drawn behind the forts (dust, trails); 0: in front. */
  back = 0;
  /** Lands and stops at this world y (debris); -1e9 for none. */
  floor = -1e9;
}

export type DmgType = 'blast' | 'pierce' | 'dig' | 'fire' | 'crush' | 'heal' | 'frost' | 'zap';

export class DmgNum {
  active = false;
  key = '';
  x = 0; y = 0;
  val = 0;
  str = '';
  size = 20;
  type: DmgType = 'blast';
  /** 0 block, 1 Hob, 2 kettle, 3 a word (Bonk!, Drop!, a note). */
  kind = 0;
  age = 0;
  bump = 999;
  dir = 1;
  burst = false;
  life = 700;
  color = '#FFF4DE';
  font = '';
}

const TYPE_COLOR: Record<DmgType, string> = {
  blast: '#FFF4DE', pierce: '#FFF2A6', dig: '#D9B27C', fire: '#E0392B', crush: '#C9C3BA', heal: '#7BD36A', frost: '#BFE6FF', zap: '#B48CFF',
};
const FONTS: Record<number, string> = {};
const font = (px: number) => (FONTS[px] ??= `700 ${px}px Fredoka, Nunito, system-ui, sans-serif`);

/** 07 §6.3 size by band (00 §9.3): Chip 14, Light 16, Standard 20, Heavy 26, Massive 32. */
export function bandSize(dmg: number): number {
  return dmg >= 85 ? 32 : dmg >= 46 ? 26 : dmg >= 28 ? 20 : dmg >= 14 ? 16 : 14;
}

export class FxPool {
  readonly items: SpriteFx[] = [];
  readonly nums: DmgNum[] = [];
  live = 0;
  wind = 0;
  constructor(n = FX_CAP, nn = 24) {
    for (let i = 0; i < n; i++) this.items.push(new SpriteFx());
    for (let i = 0; i < nn; i++) this.nums.push(new DmgNum());
  }

  clear(): void { for (const f of this.items) f.active = false; for (const n of this.nums) n.active = false; this.live = 0; }

  private free(): SpriteFx | null {
    if (this.live >= FX_CAP) return null;
    for (let i = 0; i < this.items.length; i++) if (!this.items[i].active) return this.items[i];
    return null;
  }

  /** An animated effect at a world point. Returns the slot (to set velocity and so on) or null when full. */
  spawn(clip: Clip | undefined, x: number, y: number, scale = 1, back = 0): SpriteFx | null {
    if (!clip) return null;
    const f = this.free();
    if (!f) return null;
    f.active = true; this.live++;
    f.p.play(clip);
    f.x = x; f.y = y; f.vx = 0; f.vy = 0; f.g = 0; f.rot = 0; f.vr = 0; f.scale = scale; f.alpha = 1;
    f.hold = 0; f.fade = 0; f.age = 0; f.flip = false; f.wind = 0; f.color = ''; f.size = 0; f.life = 0; f.back = back; f.floor = -1e9;
    return f;
  }

  spawnName(name: string, x: number, y: number, scale = 1, back = 0): SpriteFx | null {
    return this.spawn(anims.get(name), x, y, scale, back);
  }

  /** A plain square speck (dust, grit), life in ms. */
  speck(x: number, y: number, vx: number, vy: number, color: string, size: number, life: number, g = 600): SpriteFx | null {
    const f = this.free();
    if (!f) return null;
    f.active = true; this.live++;
    f.p.play(null);
    f.x = x; f.y = y; f.vx = vx; f.vy = vy; f.g = g; f.rot = 0; f.vr = 0; f.scale = 1; f.alpha = 1;
    f.hold = 0; f.fade = life * 0.5; f.age = 0; f.flip = false; f.wind = 0; f.color = color; f.size = size; f.life = life; f.back = 0; f.floor = -1e9;
    return f;
  }

  /** A damage number (merges hits on the same target within 300 ms) or a word. */
  number(key: string, x: number, y: number, val: number, kind: number, type: DmgType, dir: number, burst = false): void {
    if (kind === 0 && val < 10) return; // block hits under 10: the block cracks instead
    for (const n of this.nums) {
      if (n.active && n.kind !== 3 && n.key === key && n.age < 300 + n.life) {
        if (n.age > 300 && n.bump > 300) continue;
        n.val += val;
        n.str = String(Math.round(n.val));
        n.size = bandSize(n.val);
        n.font = font(n.size);
        n.bump = 0;
        n.age = Math.min(n.age, 160);
        if (burst) n.burst = true;
        return;
      }
    }
    const n = this.freeNum(kind);
    if (!n) return;
    n.active = true; n.key = key; n.x = x; n.y = y; n.val = val; n.str = String(Math.round(val));
    n.size = bandSize(val); n.font = font(n.size); n.type = type; n.kind = kind; n.age = 0; n.bump = 999; n.dir = dir; n.burst = burst;
    n.life = 700; n.color = TYPE_COLOR[type];
  }

  /** A word in the number font: Bonk!, Drop!, Kettle Pop!, Threaded!, a note. */
  word(text: string, x: number, y: number, size: number, color: string, burst: boolean, life = 1300): void {
    const n = this.freeNum(3);
    if (!n) return;
    n.active = true; n.key = ''; n.x = x; n.y = y; n.val = 0; n.str = text; n.size = size; n.font = font(size);
    n.type = 'blast'; n.kind = 3; n.age = 0; n.bump = 999; n.dir = 0; n.burst = burst; n.life = life; n.color = color;
  }

  /** 07 §6.3 cap: 12 numbers on screen; the oldest block numbers drop first, Hob and kettle numbers never. */
  private freeNum(kind: number): DmgNum | null {
    let count = 0, oldest: DmgNum | null = null, free: DmgNum | null = null;
    for (const n of this.nums) {
      if (!n.active) { free ??= n; continue; }
      count++;
      if (n.kind === 0 && (!oldest || n.age > oldest.age)) oldest = n;
    }
    if (count >= 12 && kind !== 3) {
      if (oldest) { oldest.active = false; return oldest; }
      if (kind === 0) return null;
    }
    return free;
  }

  /** Advance by view ms. */
  step(dt: number): void {
    const s = dt / 1000;
    let live = 0;
    for (let i = 0; i < this.items.length; i++) {
      const f = this.items[i];
      if (!f.active) continue;
      f.age += dt;
      if (f.color || f.life > 0) {
        if (f.age >= f.life) { f.active = false; continue; }
        if (!f.color) { f.p.step(dt); if (f.fade > 0 && f.age > f.life - f.fade) f.alpha = Math.max(0, (f.life - f.age) / f.fade); }
      } else {
        f.p.step(dt);
        if (f.p.done || !f.p.clip) {
          if (f.hold <= 0) { f.active = false; continue; }
          f.hold -= dt;
          if (f.fade > 0 && f.hold < f.fade) f.alpha = Math.max(0, f.hold / f.fade);
        }
      }
      if (f.vx || f.vy || f.g || f.wind) {
        f.vy -= f.g * s;
        f.x += (f.vx + f.wind * this.wind) * s;
        f.y += f.vy * s;
        if (f.y < f.floor) { f.y = f.floor; f.vy = -f.vy * 0.25; f.vx *= 0.5; f.vr *= 0.4; if (Math.abs(f.vy) < 20) { f.vy = 0; f.g = 0; f.vx = 0; f.vr = 0; } }
      }
      f.rot += f.vr * s;
      live++;
    }
    this.live = live;
    for (const n of this.nums) {
      if (!n.active) continue;
      n.age += dt;
      n.bump += dt;
      if (n.age >= n.life) n.active = false;
    }
  }

  /** Draw the effects of one layer (1 behind the forts, 0 in front). */
  draw(ctx: CanvasRenderingContext2D, r: Rect, c: Cam, back: number): void {
    const x0 = r.x - 40, x1 = r.x + r.w + 40, y0 = r.y - 40, y1 = r.y + r.h + 40;
    for (let i = 0; i < this.items.length; i++) {
      const f = this.items[i];
      if (!f.active || f.back !== back) continue;
      const x = sx(r, c, f.x), y = sy(r, c, f.y);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (f.color) {
        const a = f.age > f.life - f.fade ? Math.max(0, (f.life - f.age) / f.fade) : 1;
        const z = Math.max(1.5, f.size * c.s);
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.fillRect(x - z / 2, y - z / 2, z, z);
        continue;
      }
      const name = f.p.frame();
      if (name) sprites.drawEx(ctx, name, x, y, c.s * f.scale, f.flip, f.alpha, f.rot, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Damage numbers and words, in screen space over the field (never shaken with it). */
  drawNums(ctx: CanvasRenderingContext2D, r: Rect, c: Cam): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const n of this.nums) {
      if (!n.active) continue;
      const word = n.kind === 3;
      const t = n.age;
      // Pop to 120% in 80 ms, settle; a merge bumps it again. Drift 24 pt up (and to the side) over 700 ms.
      let k = t < 80 ? 0.6 + 0.6 * (t / 80) : t < 160 ? 1.2 - 0.2 * ((t - 80) / 80) : 1;
      if (n.bump < 120) k += 0.25 * (1 - n.bump / 120);
      const drift = Math.min(1, t / (word ? 1000 : 700));
      const x = sx(r, c, n.x) + n.dir * 10 * drift;
      const y = sy(r, c, n.y) - (word ? 16 : 24) * drift;
      if (x < r.x - 60 || x > r.x + r.w + 60 || y < r.y - 40 || y > r.y + r.h + 40) continue;
      const fadeFrom = n.life - (word ? 300 : 200);
      ctx.globalAlpha = t > fadeFrom ? Math.max(0, (n.life - t) / (n.life - fadeFrom)) : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      if (n.burst) burst(ctx, n.size * (word ? 0.55 + 0.11 * n.str.length : 1.2));
      ctx.font = n.font;
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      const tx = word ? 0 : n.size * 0.45;
      if (!word) typeIcon(ctx, n.type, -measure(ctx, n) / 2 - n.size * 0.1, 0, n.size * 0.42);
      ctx.strokeText(n.str, tx, 0);
      ctx.fillStyle = n.color;
      ctx.fillText(n.str, tx, 0);
      if (n.type === 'heal' && !word) { ctx.strokeText('+', tx - measure(ctx, n) / 2 - n.size * 0.25, 0); ctx.fillText('+', tx - measure(ctx, n) / 2 - n.size * 0.25, 0); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }
}

// measureText allocates a TextMetrics; numbers change rarely, so cache the width per string.
const widths = new Map<string, number>();
function measure(ctx: CanvasRenderingContext2D, n: DmgNum): number {
  const key = n.font + n.str;
  let w = widths.get(key);
  if (w === undefined) { w = ctx.measureText(n.str).width; if (widths.size > 400) widths.clear(); widths.set(key, w); }
  return w;
}

/** The gold burst frame behind Bonk! and Kettle Pop! (the same build as Drop!). */
function burst(ctx: CanvasRenderingContext2D, rad: number) {
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const rr = i % 2 ? rad * 0.62 : rad;
    if (i) ctx.lineTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr * 0.8); else ctx.moveTo(Math.cos(a) * rr * 1.3, Math.sin(a) * rr * 0.8);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFC23D';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
}

/** One shape per damage type (07 §6.3), so colour is a bonus. */
function typeIcon(ctx: CanvasRenderingContext2D, t: DmgType, x: number, y: number, s: number) {
  ctx.beginPath();
  switch (t) {
    case 'blast':
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? s * 0.45 : s; if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + rr, y); }
      break;
    case 'pierce': ctx.moveTo(x + s, y); ctx.lineTo(x - s * 0.6, y - s * 0.7); ctx.lineTo(x - s * 0.2, y); ctx.lineTo(x - s * 0.6, y + s * 0.7); break;
    case 'dig': ctx.moveTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.lineTo(x - s * 0.2, y - s * 0.2); ctx.lineTo(x - s * 0.2, y - s); ctx.lineTo(x + s * 0.2, y - s); ctx.lineTo(x + s * 0.2, y - s * 0.2); ctx.lineTo(x + s * 0.7, y); break;
    case 'fire': ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s, y, x, y + s); ctx.quadraticCurveTo(x - s, y, x, y - s); break;
    case 'heal': ctx.rect(x - s * 0.25, y - s * 0.8, s * 0.5, s * 1.6); ctx.rect(x - s * 0.8, y - s * 0.25, s * 1.6, s * 0.5); break;
    case 'frost': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } break;
    case 'zap': ctx.moveTo(x + s * 0.3, y - s); ctx.lineTo(x - s * 0.4, y + s * 0.1); ctx.lineTo(x, y + s * 0.1); ctx.lineTo(x - s * 0.3, y + s); ctx.lineTo(x + s * 0.4, y - s * 0.1); ctx.lineTo(x, y - s * 0.1); break;
    default: ctx.moveTo(x - s * 0.8, y - s * 0.4); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x + s * 0.8, y - s * 0.4); break;
  }
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = TYPE_COLOR[t];
  ctx.fill();
  if (t === 'fire') { ctx.beginPath(); ctx.arc(x, y + s * 0.3, s * 0.35, 0, Math.PI * 2); ctx.fillStyle = '#FFC23D'; ctx.fill(); }
}
