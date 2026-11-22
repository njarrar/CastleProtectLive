// Collapse choreography [06 §6.3, animations.json data.collapse], played from the core's
// collapse event. The sim has already dropped the chunk; this is the show:
//   creak   300 ms  blocks shiver 1 px, wobble by material, the crack overlay runs
//   lean    150 ms  the chunk tips toward its unsupported side, about the held lower corner
//   drop            rows let go one after another, bottom row first, 60 to 90 ms apart
//   land            squash to 90% and spring back, Cobble skids, dust by material
//   break           shards on cosmetic arcs, then rubble that settles and fades after 1.5 s
// View only, pooled, no allocation per frame.
import { anims, track, type Clip } from './anim';
import type { FxPool } from './fx';
import { sprites } from './sprites';
import { type Cam, type Rect, matKey, sx, sy } from './view';

export interface FallingBlock { x: number; y: number; mat: string; c: number; r: number; hp: number; maxHp: number; fall: number }
export interface CollapseEvent { side: number; blocks: FallingBlock[]; lean: -1 | 1 }

const G = 1800; // view gravity, cells/s^2
const MAX_LEAN = 12; // degrees
const DEG = Math.PI / 180;
const CREAK = 300;
const LEAN = 150;
const MAT_FILL: Record<string, string> = { wicker: '#E3B565', timber: '#B9733A', cobble: '#A9A39A', footing: '#5A4A42', brassbound: '#6B7A86' };

class CBlock {
  active = false;
  g!: CGroup;
  x = 0; y = 0; mat = ''; sprite = ''; fall = 0; row = 0;
  release = 0; landT = -1; broke = false; rubbled = false;
  crack: Clip | undefined;
}

class CGroup {
  active = false;
  t = 0;
  side = 0;
  lean = 1;
  deg = 0;
  px = 0; py = 0; // pivot, world
  gap = 60;
  rows = 1;
  count = 0;
  left = 0;
  fell = false;
  landed = 0;
  /** View speed of this group: 1, or 2 once the next turn has started (hurry). */
  speed = 1;
  wobble: [number, number][] = [];
  sway = 0;
}

export type CollapseSink = (kind: 'first_fall' | 'land' | 'creak', g: { side: number; count: number; x: number; y: number; mat: string; landed: number }) => void;

const SINK_ARG = { side: 0, count: 0, x: 0, y: 0, mat: '', landed: 0 };

export class Collapses {
  private blocks: CBlock[] = [];
  private groups: CGroup[] = [];
  reduceMotion = false;
  sink: CollapseSink | null = null;
  constructor(nb = 160, ng = 16) {
    for (let i = 0; i < ng; i++) this.groups.push(new CGroup());
    for (let i = 0; i < nb; i++) this.blocks.push(new CBlock());
  }

  get busy(): boolean { for (const g of this.groups) if (g.active) return true; return false; }

  clear(): void { for (const g of this.groups) g.active = false; for (const b of this.blocks) b.active = false; }

  start(e: CollapseEvent): void {
    const d = anims.data?.collapse;
    const g = this.groups.find((q) => !q.active);
    if (!g || !e.blocks.length) return;
    let rMin = 1e9, rMax = -1e9, x0 = 1e9, x1 = -1e9, yb = 1e9;
    const mats: Record<string, number> = {};
    for (const b of e.blocks) {
      rMin = Math.min(rMin, b.r); rMax = Math.max(rMax, b.r);
      x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + 16); yb = Math.min(yb, b.y);
      mats[b.mat] = (mats[b.mat] ?? 0) + 1;
    }
    const mat = Object.keys(mats).sort((a, b) => mats[b] - mats[a])[0];
    g.active = true; g.t = 0; g.side = e.side; g.lean = e.lean; g.count = e.blocks.length; g.left = 0; g.speed = 1;
    g.rows = rMax - rMin + 1; g.fell = false; g.landed = 0;
    // Taller chunks lean further: the material lean from the data, up to 12 degrees.
    g.deg = Math.min(MAX_LEAN, (d?.lean.deg[mat] ?? 4) * (1 + 0.4 * (g.rows - 1)));
    g.gap = 60 + 30 * Math.min(1, (g.rows - 1) / 5);
    g.px = e.lean > 0 ? x0 : x1; // the lower corner on the held side
    g.py = yb;
    g.wobble = d?.wobble_deg[mat] ?? [];
    g.sway = d?.drop.sway_deg[mat] ?? 0;
    for (const b of e.blocks) {
      const s = this.blocks.find((q) => !q.active);
      if (!s) break;
      g.left++; // only the slots taken count, so a full pool never leaves the group busy for good
      s.active = true; s.g = g; s.x = b.x; s.y = b.y; s.mat = b.mat; s.fall = Math.max(0, b.fall); s.row = b.r - rMin;
      const pct = b.maxHp ? b.hp / b.maxHp : 1;
      s.sprite = `block_${b.mat}_${pct >= 0.67 ? 'fresh' : pct >= 0.34 ? 'scuffed' : 'battered'}`;
      s.release = CREAK + LEAN + s.row * g.gap;
      s.landT = -1; s.broke = false; s.rubbled = false;
      s.crack = anims.get(`fx_crack_${matKey(b.mat)}`);
    }
    if (!g.left) { g.active = false; return; }
    if (this.sink) { SINK_ARG.side = g.side; SINK_ARG.count = g.count; SINK_ARG.x = (x0 + x1) / 2; SINK_ARG.y = yb; SINK_ARG.mat = mat; this.sink('creak', SINK_ARG); }
  }

  /**
   * The next turn has started (the core's 60 tick settle is shorter than the show): a group still
   * in its creak or lean skips to the drop, rows let go 30 ms apart, and the rest plays at 2x.
   */
  hurry(): void {
    for (const g of this.groups) {
      if (!g.active || g.speed > 1) continue;
      g.speed = 2;
      if (g.t < CREAK + LEAN) g.t = CREAK + LEAN;
      g.gap = Math.min(g.gap, 30);
    }
    for (const b of this.blocks) if (b.active && b.landT < 0) b.release = Math.min(b.release, CREAK + LEAN + b.row * b.g.gap);
  }

  /** Advance by view ms; spawns dust, shards and rubble into `fx` as blocks land. */
  step(dt: number, fx: FxPool): void {
    const d = anims.data?.collapse;
    for (const g of this.groups) { if (g.active) { g.t += dt * g.speed; g.landed = 0; } }
    for (const b of this.blocks) {
      if (!b.active) continue;
      const g = b.g;
      const t = g.t - b.release;
      if (t >= 0 && !g.fell) {
        g.fell = true;
        if (this.sink) { SINK_ARG.side = g.side; SINK_ARG.count = g.count; SINK_ARG.x = b.x; SINK_ARG.y = b.y; SINK_ARG.mat = b.mat; this.sink('first_fall', SINK_ARG); }
      }
      if (t >= 0 && b.landT < 0) {
        const fallen = 0.5 * G * (t / 1000) * (t / 1000);
        if (fallen >= b.fall) {
          b.landT = g.t;
          g.landed++;
          const lx = b.x + 8, ly = b.y - b.fall;
          // Dust by material, shards on arcs.
          const dust = fx.spawnName('fx_dustcloud', lx, ly, (d?.break.dust_scale[b.mat] ?? 1) * 0.5, 1);
          if (dust) dust.wind = 2;
          const n = d?.break.chunks_per_block[b.mat] ?? 3;
          const clip = anims.get(`fx_chunk_${matKey(b.mat)}`);
          for (let i = 0; i < n; i++) {
            const f = fx.spawn(clip, lx, ly + 8, 0.8);
            if (!f) break;
            const a = (i / Math.max(1, n - 1) - 0.5) * 2.2 + (g.lean * 0.3);
            f.vx = Math.sin(a) * (90 + 50 * ((i * 37) % 7) / 7);
            f.vy = 160 + 60 * ((i * 53) % 5) / 5;
            f.g = 900; f.vr = (i % 2 ? 1 : -1) * 9; f.floor = ly - 2; f.life = 900; f.fade = 300;
            f.p.t = (i * 70) % 280;
          }
        }
      }
      if (b.landT >= 0 && !b.rubbled && g.t - b.landT >= 140) {
        b.rubbled = true;
        const f = fx.spawnName(`fx_rubble_${matKey(b.mat)}`, b.x, b.y - b.fall + 16, 1, 1);
        if (f) { f.hold = d?.break.rubble_hold_ms ?? 1500; f.fade = 500; }
      }
      if (b.rubbled && g.t - b.landT >= 300) { b.active = false; g.left--; }
    }
    for (const g of this.groups) {
      if (!g.active) continue;
      if (g.landed && this.sink) { SINK_ARG.side = g.side; SINK_ARG.count = g.count; SINK_ARG.x = g.px; SINK_ARG.y = g.py; SINK_ARG.mat = ''; SINK_ARG.landed = g.landed; this.sink('land', SINK_ARG); }
      if (g.left <= 0) g.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, r: Rect, c: Cam): void {
    const d = anims.data?.collapse;
    const rm = this.reduceMotion;
    for (const b of this.blocks) {
      if (!b.active || b.rubbled) continue;
      const g = b.g;
      const t = g.t;
      const s = c.s;
      let rot = 0, shiver = 0, wob = 0, fallPx = 0, squash = 1, skid = 0;
      if (!rm) {
        if (t < CREAK) { shiver = d ? track(d.creak.shiver_x, t) : 0; wob = track(g.wobble, t) * DEG; }
        const leanT = Math.min(LEAN, Math.max(0, t - CREAK));
        rot = g.lean * g.deg * DEG * (d ? track(d.lean.track, leanT) : leanT / LEAN);
      }
      const tf = t - b.release;
      if (b.landT >= 0) {
        fallPx = b.fall * s;
        rot = 0;
        const tl = t - b.landT;
        if (!rm && d) { squash = track(d.land.squash_y, tl); skid = Math.min(1, tl / 100) * (d.land.skid_px[b.mat] ?? 0) * g.lean; }
      } else if (tf > 0) {
        const fallen = Math.min(b.fall, 0.5 * G * (tf / 1000) * (tf / 1000));
        fallPx = fallen * s;
        // Land flat: the lean eases out over the fall. Wicker flutters as it drops.
        if (b.fall > 0) rot *= 1 - fallen / b.fall;
        if (!rm && g.sway) rot += Math.sin((tf / 200) * Math.PI) * g.sway * DEG;
      }
      const bx = sx(r, c, b.x) + (shiver + skid) * s;
      const by = sy(r, c, b.y + 16);
      const size = 16 * s;
      if (bx > r.x + r.w + size * 2 || bx + size * 2 < r.x || by > r.y + r.h + size * 2 || by + size * 3 < r.y) continue;
      ctx.save();
      ctx.translate(0, fallPx);
      if (rot) {
        const px = sx(r, c, g.px), py = sy(r, c, g.py);
        ctx.translate(px, py); ctx.rotate(rot); ctx.translate(-px, -py);
      }
      // Wobble and squash both turn about the block's base centre.
      const cx = bx + size / 2, cy = by + size;
      if (wob || squash !== 1) { ctx.translate(cx, cy); if (wob) ctx.rotate(wob); if (squash !== 1) ctx.scale(2 - squash, squash); ctx.translate(-cx, -cy); }
      if (!sprites.draw(ctx, b.sprite, bx, by, s)) {
        ctx.fillStyle = MAT_FILL[b.mat] ?? '#B9733A';
        ctx.fillRect(bx, by, size, size);
        ctx.strokeStyle = '#2B1E2E'; ctx.lineWidth = Math.max(1, s); ctx.strokeRect(bx + 0.5, by + 0.5, size - 1, size - 1);
      }
      // The crack runs during the creak and stays on until the block lands.
      if (b.crack) sprites.draw(ctx, b.crack.frames[Math.min(b.crack.frames.length - 1, Math.floor(t / 100))], bx, by, s);
      ctx.restore();
    }
  }
}
