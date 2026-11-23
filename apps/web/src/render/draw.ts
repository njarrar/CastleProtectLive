// Canvas2D drawing of one lens (a viewport with a camera) from the snapshot.
// The draw loop allocates nothing: world-to-screen goes through sx/sy (numbers, not tuples),
// sprite names are built once and cached, and effects come from the pooled Feel state.
import type { BlockView, HobView, KettleView, PinView, PropView, RoomView, Side, Snapshot } from '../core/types';
import type { Feel } from './feel';
import type { TerrainLayer } from './terrain';
import { anims, frameAt } from './anim';
import { ctx2d } from './ctx2d';
import { flattenerSpriteName, isCrewHob, sprites } from './sprites';
import { list } from '../ui/text';
import { type Cam, type Rect, stage, sx, sy, toScreen, toWorld } from './view';

export { type Cam, type Rect, toScreen, toWorld };

const HOB_SCALE = 0.4; // Hob frames are 72 x 80 at @1x; a Hob stands about 1.6 blocks tall
const KETTLE_SCALE = 0.72;
/** Draw the Stompers under a fort (planted at rest, marching while walking). */
const STOMPERS = true;

export const INK = '#2C221E';
export const TEAM = ['#2F6FDE', '#E8730C'];
export const TEAM_LIGHT = ['#9DBDF5', '#FFB070'];
/** Reusable 16x16 occupancy grid for double-weight fort outer silhouette contour (zero per-frame allocs). */
const FORT_OCC = new Uint8Array(256);
const MAT: Record<string, [string, string, string]> = {
  wicker: ['#E3B565', '#B8843A', '#F6D894'],
  timber: ['#B9733A', '#87491F', '#D9985A'],
  cobble: ['#A9A39A', '#77716B', '#CFCAC0'],
  brassbound: ['#6B7A86', '#47525C', '#E0AE3E'],
  footing: ['#5A4A42', '#3F332D', '#7A6A60'],
};
const HAT: Record<string, string> = {
  lobber: '#D9483B', zinger: '#3FA9F5', scatterjack: '#8BCB3A', delver: '#9A6A3A', boinker: '#F06EAA', patcher: '#2FB7A6', sizzler: '#B8325A', peeper: '#F2E05A',
};
const SKIN = ['#F2C9A0', '#D99A6C', '#A8673F', '#7A4A2E', '#F5D7B8', '#C68457'];
const STAGES = ['fresh', 'scuffed', 'battered'];
const DEG = Math.PI / 180;

// Sprite names, built once per material or kind (no string building in the draw loop).
const blockNames: Record<string, string[]> = {};
const blockName = (mat: string, st: number) => (blockNames[mat] ??= STAGES.map((x) => `block_${mat}_${x}`))[st];
const shellNames: Record<string, string> = {};
const shellName = (k: string) => (shellNames[k] ??= `shell_${k}`);
const crackNames: Record<string, string[]> = {};
const crackName = (mat: string, i: number) => (crackNames[mat] ??= [0, 1, 2].map((n) => `fx_crack_${mat === 'wicker' || mat === 'timber' || mat === 'footing' ? mat : 'cobble'}_${n}`))[i];
const KETTLE_ST = ['kettle_full', 'kettle_hurt', 'kettle_critical', 'kettle_popped'];

export interface DrawOpts {
  you: Side;
  seeThrough: Side | -1;
  pickedHob?: string;
  showPreview: boolean;
  /** Seconds since the fight view opened (wall time, for clouds). */
  time: number;
  reduceMotion: boolean;
  label?: string;
  /** Lean Lines: blocks that would fall, as "c,r", and the held block. */
  lean?: { side: Side; c: number; r: number; falls: Set<string> };
  /** Mendglob own-fort block target `[c, r]` on `you` side. */
  mendTarget?: [number, number];
  /** The sky is the canvas's CSS background: clear instead of drawing it. */
  cssSky: boolean;
  /** Canvas pixels per CSS pixel (for the backdrop cache). */
  dpr: number;
  /** Shell positions carried on between ticks: [id, x, y] per shell. */
  shells: Float64Array;
  nShells: number;
}

/**
 * A copy of an image pre-scaled to the size it is drawn at, so a moving camera blits it at 1:1
 * instead of scaling a big image every frame. Rebuilt once the size has held for 3 frames.
 */
class ScaledCopy {
  canvas = document.createElement('canvas');
  private c = ctx2d(this.canvas);
  private src: CanvasImageSource | null = null;
  private rev = -1; private w = 0; private h = 0;
  private pw = 0; private ph = 0; private prev = -1; private psrc: CanvasImageSource | null = null; private n = 0;
  get(src: CanvasImageSource, rev: number, w: number, h: number, smooth: boolean): HTMLCanvasElement | null {
    w = Math.round(w); h = Math.round(h);
    if (src === this.src && rev === this.rev && w === this.w && h === this.h) return this.canvas;
    if (w * h > 9e6 || w > 4096 || h > 4096 || w < 1 || h < 1) return null;
    if (src !== this.psrc || rev !== this.prev || w !== this.pw || h !== this.ph) { this.psrc = src; this.prev = rev; this.pw = w; this.ph = h; this.n = 0; return null; }
    if (++this.n < 3) return null;
    this.canvas.width = w; this.canvas.height = h;
    this.c.imageSmoothingEnabled = smooth;
    this.c.imageSmoothingQuality = 'high';
    this.c.drawImage(src, 0, 0, w, h);
    this.src = src; this.rev = rev; this.w = w; this.h = h;
    return this.canvas;
  }

  /**
   * The terrain copy: after a crater only the painted rects are scaled again, at once, not the
   * whole map three frames later. A size change, or a gap in the terrain's log, rebuilds it all.
   */
  getTerrain(t: TerrainLayer, w: number, h: number, smooth: boolean): HTMLCanvasElement | null {
    const rw = Math.round(w), rh = Math.round(h);
    if (this.src === t.canvas && rw === this.w && rh === this.h && t.rev !== this.rev) {
      const rects = t.dirtySince(this.rev);
      if (rects) {
        const kx = rw / t.w, ky = rh / t.h;
        this.c.imageSmoothingEnabled = smooth;
        for (const q of rects) {
          const x0 = Math.max(0, q.x0 - 1), y0 = Math.max(0, q.y0 - 1), x1 = Math.min(t.w, q.x1 + 1), y1 = Math.min(t.h, q.y1 + 1);
          const dx0 = Math.max(0, Math.floor(x0 * kx)), dy0 = Math.max(0, Math.floor(y0 * ky));
          const dx1 = Math.min(rw, Math.ceil(x1 * kx)), dy1 = Math.min(rh, Math.ceil(y1 * ky));
          if (dx1 <= dx0 || dy1 <= dy0) continue;
          const sx0 = Math.max(0, Math.min(t.w - 1, dx0 / kx)), sy0 = Math.max(0, Math.min(t.h - 1, dy0 / ky));
          const sw = Math.min(t.w - sx0, (dx1 - dx0) / kx), sh = Math.min(t.h - sy0, (dy1 - dy0) / ky);
          if (sw <= 0 || sh <= 0) continue;
          this.c.clearRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
          this.c.drawImage(t.canvas, sx0, sy0, sw, sh, dx0, dy0, dx1 - dx0, dy1 - dy0);
        }
        this.rev = t.rev;
        return this.canvas;
      }
    }
    return this.get(t.canvas, t.rev, w, h, smooth);
  }

  free(): void { this.canvas.width = 0; this.canvas.height = 0; this.src = null; this.psrc = null; this.w = 0; this.h = 0; }
}

/**
 * The backdrop of a lens (sky, hills, terrain) is the costly part of a frame: several screen-sized
 * scaled draws. While the camera holds still (the Plan step, most of a game) it is drawn once into
 * a cache and blitted at 1:1; while the camera moves it is drawn straight, with no extra copy.
 */
export class LensCache {
  sky = new ScaledCopy();
  hills = [new ScaledCopy(), new ScaledCopy()];
  terr = new ScaledCopy();
  canvas = document.createElement('canvas');
  private ctx = ctx2d(this.canvas);
  private k = new Float64Array(10);
  private stillFrames = 0;
  valid = false;
  /** 0: draw straight (the camera moves). 1: blit the cache. 2: draw into `ctx2` (returned by build) then blit. */
  state(r: Rect, cam: Cam, terrRev: number, spriteScale: number, dpr: number, rm: boolean): number {
    const k = this.k;
    const same = k[0] === cam.cx && k[1] === cam.cy && k[2] === cam.s && k[3] === r.x && k[4] === r.y && k[5] === r.w && k[6] === r.h && k[7] === terrRev && k[8] === spriteScale + (rm ? 10 : 0) && k[9] === dpr;
    if (!same) {
      k[0] = cam.cx; k[1] = cam.cy; k[2] = cam.s; k[3] = r.x; k[4] = r.y; k[5] = r.w; k[6] = r.h; k[7] = terrRev; k[8] = spriteScale + (rm ? 10 : 0); k[9] = dpr;
      this.stillFrames = 0;
      this.valid = false;
      return 0;
    }
    if (this.valid) return 1;
    if (++this.stillFrames < 2) return 0;
    return 2;
  }
  /** Give every canvas back (the battle screen is gone). */
  free(): void {
    this.sky.free(); this.hills[0].free(); this.hills[1].free(); this.terr.free();
    this.canvas.width = 0; this.canvas.height = 0;
    this.valid = false;
  }
  build(r: Rect, dpr: number): CanvasRenderingContext2D {
    const w = Math.max(1, Math.round(r.w * dpr)), h = Math.max(1, Math.round(r.h * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.setTransform(dpr, 0, 0, dpr, -r.x * dpr, -r.y * dpr);
    this.valid = true;
    return c;
  }
}

export function drawLens(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, terr: TerrainLayer, feel: Feel, o: DrawOpts, cache?: LensCache): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const j = feel.juice;
  const shaking = j.ox !== 0 || j.oy !== 0 || j.roll !== 0;
  const st = !shaking && cache ? cache.state(r, cam, terr.rev, sprites.scale, o.dpr, o.reduceMotion) : 0;
  if (st === 2) { const c = cache!.build(r, o.dpr); backdrop(c, r, cam, cache, o); terrainLayer(c, r, cam, terr, o.dpr, cache); }
  if (st) {
    // The CSS sky shows through: the lens must be cleared first, or every frame's preview and
    // drag line pile up under a backdrop cache that has transparent sky.
    if (o.cssSky) ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(cache!.canvas, r.x, r.y, r.w, r.h);
    clouds(ctx, r, cam, snap, terr, o);
    if (snap.squall.on && !o.reduceMotion) squall(ctx, r, snap.wind, feel.time);
  } else {
    backdrop(ctx, r, cam, cache, o);
    clouds(ctx, r, cam, snap, terr, o);
    if (snap.squall.on && !o.reduceMotion) squall(ctx, r, snap.wind, feel.time);
    // Only the field shakes (the HUD is DOM and never moves): offset plus a little roll.
    if (shaking) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.translate(cx + j.ox, cy + j.oy);
      if (j.roll) ctx.rotate(j.roll);
      ctx.translate(-cx, -cy);
    }
    terrainLayer(ctx, r, cam, terr, o.dpr, cache);
  }

  // ghosts and pins under the forts: the picked Hob's last two, and the Rival's last two
  let pickedLast: PinView | undefined;
  let mineN = 0, rivalN = 0;
  for (let i = snap.pins.length - 1; i >= 0; i--) {
    const p = snap.pins[i];
    if (p.side === o.you && p.hob === o.pickedHob && mineN < 2) { ghost(ctx, r, cam, p, mineN ? 0.2 : 0.4, mineN ? DASH_OLD : DASH_NEW); if (!mineN) pickedLast = p; mineN++; }
    else if (p.side !== o.you && rivalN < 2) { ghost(ctx, r, cam, p, 0.3, DASH_RIVAL); rivalN++; }
  }
  if (pickedLast && o.showPreview) ghostDots(ctx, r, cam, pickedLast, feel, o.reduceMotion);

  feel.fx.draw(ctx, r, cam, 1);

  for (let side = 0 as Side; side < 2; side = (side + 1) as Side) {
    const f = snap.forts[side];
    const isBossFort = side === 1 && !!snap.hud.boss;
    // Grounded contact shadow beneath the fort and its 3 Stomper feet.
    fortShadow(ctx, r, cam, f);
    const dy = feel.bobDy(side), tilt = feel.bobTilt(side);
    const moved = dy !== 0 || tilt !== 0;
    if (moved) {
      // Fort bob: the body and all on it, about the base centre. Not the legs.
      ctx.save();
      const bx = sx(r, cam, f.x + f.w / 2), by = sy(r, cam, f.y);
      ctx.translate(bx, by + dy * cam.s);
      ctx.rotate(tilt * DEG);
      ctx.translate(-bx, -by);
    }
    // 1-10 Boss: sculpted clipped-hedge Peacock tail fanning behind the boss fort.
    if (isBossFort) bossPeacockTail(ctx, r, cam, f);
    // Opaque cutaway room backing (#3B2D24) + warm lantern glow keeps background trees from
    // bleeding through your fort, while solid walls stay 100% opaque (alpha = 1).
    const cutaway = o.seeThrough === side;
    if (cutaway) {
      fortCutawayBack(ctx, r, cam, snap, f, side, o.reduceMotion ? 0 : o.time);
    }
    const fatigue = snap.fatigue?.[side] ?? false;
    for (const b of snap.blocks) if (b.side === side) block(ctx, r, cam, b, 1, o, fatigue, feel);
    // Double-weight 3px dark espresso outer silhouette contour for crisp figure-ground pop.
    fortOuterContour(ctx, r, cam, snap, side);
    for (const k of snap.kettles) if (k.side === side) kettle(ctx, r, cam, k, o.reduceMotion ? 0 : o.time, cutaway, feel);
    for (const rm of snap.rooms ?? []) if (rm.side === side) room(ctx, r, cam, rm, feel);
    if (isBossFort) bossPeacockCrest(ctx, r, cam, snap, f, o.reduceMotion ? 0 : o.time);
    fortFlag(ctx, r, cam, snap, f, side, o.reduceMotion ? 0 : o.time);
    if (moved) ctx.restore();
    if (STOMPERS) stompers(ctx, r, cam, f, side, feel);
    if (moved) {
      ctx.save();
      const bx = sx(r, cam, f.x + f.w / 2), by = sy(r, cam, f.y);
      ctx.translate(bx, by + dy * cam.s);
      ctx.rotate(tilt * DEG);
      ctx.translate(-bx, -by);
    }
    for (const hb of snap.hobs) if (hb.side === side) hob(ctx, r, cam, hb, snap, hb.id === o.pickedHob, o.reduceMotion ? 0 : o.time, feel);
    // Subtle 0.16 window glaze sheen over occupied cutaway Nooks (Plate 1).
    if (cutaway) fortCutawayGlaze(ctx, r, cam, snap, side);
    if (moved) ctx.restore();
  }
  const hasCageBars = (snap.props ?? []).some((q) => q.kind === 'cage_bar' && q.hp > 0);
  for (const p of snap.props ?? []) prop(ctx, r, cam, p, snap, hasCageBars, o.reduceMotion ? 0 : o.time);
  // Grand Fort 1-10: the red cut line, shown one boss turn before the shears snip.
  const cut = snap.hud.boss?.cut;
  if (cut) {
    ctx.save();
    ctx.strokeStyle = '#C9363E';
    ctx.lineWidth = Math.max(2, 3 * cam.s);
    ctx.setLineDash(DASH_CUT);
    ctx.strokeRect(sx(r, cam, cut.x), sy(r, cam, cut.y + cut.h), cut.w * cam.s, cut.h * cam.s);
    ctx.restore();
  }
  feel.col.draw(ctx, r, cam);
  // Cap rendered pin markers to the 2 most recent per side for visual clarity (Plate 2),
  // while snap.pins stays complete for recall & tap targeting.
  let p0 = 0, p1 = 0;
  for (let i = snap.pins.length - 1; i >= 0; i--) {
    const p = snap.pins[i];
    if (p.side === 0) { if (p0 >= 2) continue; p0++; }
    else { if (p1 >= 2) continue; p1++; }
    pin(ctx, r, cam, p, feel);
  }

  // preview arc (already cut to the preview share by the core)
  if (o.showPreview && snap.hud.preview.length > 1) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    const pts = snap.hud.preview;
    const step = Math.max(1, Math.round(8 / Math.max(0.3, cam.s * 3)));
    const rad = Math.max(2.5, 4 * Math.min(1, cam.s * 1.2));
    // One path for all dots: one fill and one stroke per lens.
    ctx.beginPath();
    for (let i = 1; i < pts.length; i += step) {
      const x = sx(r, cam, pts[i][0]), y = sy(r, cam, pts[i][1]);
      if (x < r.x - 8 || x > r.x + r.w + 8 || y < r.y - 8 || y > r.y + r.h + 8) continue;
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  // shells in flight, at their carried-on positions
  for (let i = 0; i < snap.shells.length; i++) {
    const s = snap.shells[i];
    const has = i < o.nShells && o.shells[i * 3] === s.id;
    const x = sx(r, cam, has ? o.shells[i * 3 + 1] : s.x), y = sy(r, cam, has ? o.shells[i * 3 + 2] : s.y);
    const rad = Math.max(3, 6 * cam.s);
    const nm = shellName(s.kind);
    if (sprites.has(nm)) {
      const turn = s.kind === 'hatpin' || s.kind === 'nosy_goose' ? -Math.atan2(s.vy, s.vx) : 0;
      sprites.drawEx(ctx, nm, x, y, Math.max(0.6, cam.s), false, 1, turn, 1);
      continue;
    }
    ctx.fillStyle = s.kind === 'plain' ? '#3B3633' : '#6A5A7A';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  feel.fx.draw(ctx, r, cam, 0);
  // Shake at 0%: a 2 pt white rim on the blast in its place [07 §6.2].
  const rim = j.rim;
  if (rim.left > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(r, cam, rim.x), sy(r, cam, rim.y), Math.max(8, rim.r * cam.s), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Numbers sit over the field but never shake with it.
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  feel.fx.drawNums(ctx, r, cam, snap.kettles);
  ctx.restore();
  if (o.label) {
    ctx.save();
    ctx.font = '600 11px Nunito, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(43,30,46,0.6)';
    ctx.fillText(o.label, r.x + 8, r.y + 14);
    ctx.restore();
  }
}


/** Sky and the far hills (parallax), plain shapes when the art is missing. */
function backdrop(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, lc: LensCache | undefined, o: DrawOpts) {
  // sky and far hills: sprites when loaded, plain shapes otherwise
  const sky = sprites.texture('bg_downs_sky');
  // The wide lens shows the sky as the canvas's CSS background (the compositor draws it for free).
  if (o.cssSky) ctx.clearRect(r.x, r.y, r.w, r.h);
  else if (sky) {
    // Cover the lens and keep the art's aspect (no stretched sun); pinned to the top edge.
    const k = Math.max(r.w / sky.width, r.h / sky.height);
    const w = sky.width * k, hh = sky.height * k;
    const pre = lc?.sky.get(sky, 0, w * o.dpr, hh * o.dpr, true);
    ctx.drawImage(pre ?? sky, r.x + (r.w - w) / 2, r.y, w, hh);
  } else {
    ctx.fillStyle = '#9ED8EC';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const baseY = sy(r, cam, 230);
  const far = sprites.texture('bg_downs_hills_far');
  const near = sprites.texture('bg_downs_hills_near');
  if (far && near) {
    for (let li = 0; li < 2; li++) {
      const img = li ? near : far, par = li ? 0.45 : 0.2, k = li ? 0.7 : 0.9;
      const hh = Math.max(60, Math.min(r.h * 0.6, 256 * Math.max(0.35, cam.s) * k));
      const ww = (img.width / img.height) * hh;
      // Reduce motion: parallax off (the hills sit still).
      const off = o.reduceMotion ? 0 : ((-(cam.cx * cam.s * par)) % ww + ww) % ww;
      const yb = Math.min(r.y + r.h, baseY + hh * 0.35);
      const pre = lc?.hills[li].get(img, 0, (ww + 1) * o.dpr, hh * o.dpr, true);
      for (let x = r.x - ww + off; x < r.x + r.w; x += ww) ctx.drawImage(pre ?? img, x, yb - hh, ww + 1, hh);
    }
    // Subtle atmospheric sky-tint haze glaze (15-20%) over distant hills so foreground forts pop cleanly.
    const hazeTop = Math.max(r.y, baseY - 190 * Math.max(0.4, cam.s));
    const hazeH = Math.max(40, r.y + r.h - hazeTop);
    const hz = ctx.createLinearGradient(0, hazeTop, 0, r.y + r.h);
    hz.addColorStop(0, 'rgba(158, 216, 236, 0.22)');
    hz.addColorStop(0.55, 'rgba(186, 224, 236, 0.16)');
    hz.addColorStop(1, 'rgba(214, 236, 240, 0.08)');
    ctx.fillStyle = hz;
    ctx.fillRect(r.x, hazeTop, r.w, hazeH);
  } else {
    // Two layered procedural Downs hill ridges with atmospheric depth separation.
    ctx.fillStyle = '#A8D4C2';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    for (let px = r.x; px <= r.x + r.w + 8; px += 8) {
      const wx = cam.cx * 0.25 + (px - r.x) / Math.max(0.3, cam.s * 0.5);
      ctx.lineTo(px, baseY - 58 * cam.s - 34 * Math.sin(wx / 240 + 1.1) * Math.min(1.5, cam.s + 0.35));
    }
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.fill();
    ctx.fillStyle = '#B7DDA8';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    for (let px = r.x; px <= r.x + r.w + 8; px += 8) {
      const wx = cam.cx * 0.5 + (px - r.x) / Math.max(0.3, cam.s * 0.6);
      ctx.lineTo(px, baseY - 28 * cam.s - 24 * Math.sin(wx / 180) * Math.min(1.5, cam.s + 0.3));
    }
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.fill();
    ctx.fillStyle = 'rgba(158, 216, 236, 0.16)';
    ctx.fillRect(r.x, Math.max(r.y, baseY - 120 * cam.s), r.w, r.y + r.h - Math.max(r.y, baseY - 120 * cam.s));
  }
}

function clouds(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, terr: TerrainLayer, o: DrawOpts) {
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 6; i++) {
    const drift = o.reduceMotion ? 0 : o.time * 6 * (snap.wind || 0.5);
    const span = Math.max(1600, terr.w) + 400;
    const wx = ((((i * 431 + drift) % span) + span) % span) - 200;
    cloud(ctx, sx(r, cam, wx), sy(r, cam, 560 + (i % 3) * 50), 18 * Math.max(0.5, cam.s));
  }
}

function terrainLayer(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, terr: TerrainLayer, dpr: number, lc: LensCache | undefined) {
  // terrain
  if (terr.w) {
    // Only the part of the terrain canvas this lens shows (canvas y grows down from the map top).
    const wx0 = cam.cx + (-r.w / 2) / cam.s, wx1 = cam.cx + (r.w / 2) / cam.s;
    const wy1 = cam.cy + (r.h / 2) / cam.s, wy0 = cam.cy - (r.h / 2) / cam.s;
    const x0 = Math.max(0, Math.floor(wx0)), ex = Math.min(terr.w, Math.ceil(wx1));
    const y0 = Math.max(0, Math.floor(terr.h - wy1)), ey = Math.min(terr.h, Math.ceil(terr.h - wy0));
    ctx.imageSmoothingEnabled = cam.s < 1;
    if (ex > x0 && ey > y0) {
      const k = cam.s * dpr;
      const pre = lc?.terr.getTerrain(terr, terr.w * k, terr.h * k, cam.s < 1);
      if (pre) ctx.drawImage(pre, x0 * k, y0 * k, (ex - x0) * k, (ey - y0) * k, sx(r, cam, x0), sy(r, cam, terr.h - y0), (ex - x0) * cam.s, (ey - y0) * cam.s);
      else ctx.drawImage(terr.canvas, x0, y0, ex - x0, ey - y0, sx(r, cam, x0), sy(r, cam, terr.h - y0), (ex - x0) * cam.s, (ey - y0) * cam.s);
    }
    // below the map floor and past its ends: plain loam, so no gap shows
    const floorY = sy(r, cam, 0);
    ctx.fillStyle = '#9A6440';
    if (floorY < r.y + r.h + 20) ctx.fillRect(r.x - 20, floorY - 1, r.w + 40, r.y + r.h - floorY + 21);
    const lx = sx(r, cam, 0), rx = sx(r, cam, terr.w);
    if (lx > r.x - 20) { const gy = sy(r, cam, terr.tops[0] ?? 0); ctx.fillRect(r.x - 20, gy, lx - r.x + 21, r.y + r.h - gy + 20); }
    if (rx < r.x + r.w + 20) { const gy = sy(r, cam, terr.tops[terr.w - 1] ?? 0); ctx.fillRect(rx - 1, gy, r.x + r.w - rx + 21, r.y + r.h - gy + 20); }
  }

}

const DASH_CUT = [8, 5];
const DASH_BATTERED = [3, 3];
const DASH_NEW = [10, 6], DASH_OLD = [4, 6], DASH_RIVAL = [2, 4, 8, 4], NO_DASH: number[] = [], DOT_DASH = [2, 3];

/** Sudden Squall: slanted rain at the wind's angle, 30% opacity, behind the forts [06 §7.1]. */
function squall(ctx: CanvasRenderingContext2D, r: Rect, wind: number, t: number) {
  const c = anims.get('fx_squall');
  if (!c) return;
  const name = frameAt(c, t);
  const tile = 72;
  ctx.globalAlpha = 0.3;
  const lean = Math.max(-0.5, Math.min(0.5, wind * 0.05));
  for (let y = r.y - tile; y < r.y + r.h + tile; y += tile) {
    for (let x = r.x - tile; x < r.x + r.w + tile; x += tile) {
      sprites.drawEx(ctx, name, x + (y - r.y) * lean, y, tile / 48, false, 0.3, -lean, 1);
    }
  }
  ctx.globalAlpha = 1;
}

/** The Ghost line's dots pulse, each 60 ms behind the one before, so the pulse runs down the path. */
function ghostDots(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PinView, feel: Feel, rm: boolean) {
  const c = anims.get(p.side === 0 ? 'fx_ghost_dot_p1_pulse' : 'fx_ghost_dot_p2_pulse');
  if (!c || p.path.length < 4) return;
  const step = Math.max(2, Math.floor(p.path.length / 14));
  let k = 0;
  for (let i = step; i < p.path.length; i += step, k++) {
    const pt = p.path[i];
    const x = sx(r, cam, pt[0]), y = sy(r, cam, pt[1]);
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
    sprites.draw(ctx, rm ? c.frames[0] : frameAt(c, feel.time - k * 60), x, y, Math.max(0.9, cam.s * 1.2), false, 0.8);
  }
}

/** Grounded contact shadow beneath each fort & its Stomper feet. */
function fortShadow(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, f: { x: number; y: number; w: number }) {
  const cx = sx(r, cam, f.x + f.w * 0.5);
  const cy = sy(r, cam, f.y) + 2.5 * cam.s;
  const rx = Math.max(12, f.w * cam.s * 0.56);
  const ry = Math.max(3, 5.5 * cam.s);
  ctx.save();
  ctx.fillStyle = 'rgba(44, 34, 30, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Opaque cutaway room backing (#3B2D24) + warm amber lantern glow + brass steam pipe to Stompers (Plate 1). */
function fortCutawayBack(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, f: { x: number; y: number; w: number }, side: Side, t: number) {
  ctx.save();
  // 1. Intact Nook rooms: recessed warm timber backing + soft amber lantern glow + tiny hanging lantern.
  for (const rm of snap.rooms ?? []) {
    if (rm.side !== side || !rm.intact) continue;
    const rx = sx(r, cam, rm.x), ry = sy(r, cam, rm.y + rm.h);
    const rw = rm.w * cam.s, rh = rm.h * cam.s;
    if (sprites.has('fort_nook_backing')) {
      sprites.draw(ctx, 'fort_nook_backing', rx, ry, cam.s * (rm.w / 32), false, 1);
    } else {
      ctx.fillStyle = '#3B2D24';
      ctx.fillRect(rx, ry, rw, rh);
      // Warm wooden floor planks & wainscoting
      ctx.fillStyle = '#523C2D';
      ctx.fillRect(rx, ry + rh * 0.78, rw, rh * 0.22);
      ctx.strokeStyle = 'rgba(44,34,30,0.45)';
      ctx.lineWidth = Math.max(1, cam.s * 0.8);
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh * 0.78); ctx.lineTo(rx + rw, ry + rh * 0.78);
      ctx.moveTo(rx + rw * 0.5, ry); ctx.lineTo(rx + rw * 0.5, ry + rh * 0.78);
      ctx.stroke();
    }
    // Warm radial lantern halo inside Nook
    const lx = rx + rw * 0.5, ly = ry + rh * 0.34;
    const pulse = 1 + (t > 0 ? Math.sin(t * 2.8 + rm.id * 1.7) * 0.05 : 0);
    const grad = ctx.createRadialGradient(lx, ly, 1, lx, ly, Math.max(8, rw * 0.65 * pulse));
    grad.addColorStop(0, 'rgba(255, 214, 122, 0.34)');
    grad.addColorStop(0.55, 'rgba(255, 196, 98, 0.16)');
    grad.addColorStop(1, 'rgba(255, 196, 98, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(rx, ry, rw, rh);
    // Tiny hanging brass ceiling lantern
    if (rw >= 14) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, cam.s);
      ctx.beginPath(); ctx.moveTo(lx, ry); ctx.lineTo(lx, ry + rh * 0.16); ctx.stroke();
      ctx.fillStyle = '#FFE08A';
      ctx.beginPath(); ctx.arc(lx, ry + rh * 0.19, Math.max(1.8, 2.2 * cam.s), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  // 2. Heartkettle Room: recessed boiler bay + glowing brass steam pipe feeding down to the 3 Stompers.
  for (const k of snap.kettles) {
    if (k.side !== side || !k.room) continue;
    const rx = sx(r, cam, k.room.x), ry = sy(r, cam, k.room.y + k.room.h);
    const rw = k.room.w * cam.s, rh = k.room.h * cam.s;
    ctx.fillStyle = '#342720';
    ctx.fillRect(rx, ry, rw, rh);
    if (k.hp > 0) {
      const grad = ctx.createRadialGradient(rx + rw * 0.5, ry + rh * 0.55, 2, rx + rw * 0.5, ry + rh * 0.55, Math.max(10, rw * 0.72));
      grad.addColorStop(0, 'rgba(79, 227, 193, 0.32)');
      grad.addColorStop(0.55, 'rgba(255, 194, 61, 0.14)');
      grad.addColorStop(1, 'rgba(79, 227, 193, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(rx, ry, rw, rh);
    }
    // Glowing brass steam manifold running from the Heartkettle base to the 3 Stomper legs
    const kx = sx(r, cam, k.room.x + k.room.w * 0.5);
    const ky = sy(r, cam, k.room.y);
    const footY = sy(r, cam, f.y + 4);
    const pipeW = Math.max(2, 3.6 * cam.s);
    const xL = sx(r, cam, f.x + f.w * 0.18);
    const xR = sx(r, cam, f.x + f.w * 0.82);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = pipeW + 2.4;
    ctx.beginPath();
    ctx.moveTo(kx, ky - rh * 0.15); ctx.lineTo(kx, footY);
    ctx.moveTo(xL, footY); ctx.lineTo(xR, footY);
    ctx.stroke();
    ctx.strokeStyle = k.hp > 0 ? '#E5A93B' : '#7A6A60';
    ctx.lineWidth = pipeW;
    ctx.stroke();
    if (k.hp > 0) {
      ctx.strokeStyle = '#FFE08A';
      ctx.lineWidth = Math.max(1, pipeW * 0.35);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Subtle 0.16 warm cutaway window glaze over occupied Nooks (Plate 1). */
function fortCutawayGlaze(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, side: Side) {
  ctx.save();
  for (const rm of snap.rooms ?? []) {
    if (rm.side !== side || !rm.intact) continue;
    const rx = sx(r, cam, rm.x), ry = sy(r, cam, rm.y + rm.h);
    const rw = rm.w * cam.s, rh = rm.h * cam.s;
    if (sprites.has('fort_nook_glaze')) {
      sprites.draw(ctx, 'fort_nook_glaze', rx, ry, cam.s * (rm.w / 32), false, 0.22);
      continue;
    }
    // Delicate translucent glass pane highlight in upper corners (never obscures the Hob)
    ctx.fillStyle = 'rgba(255, 244, 222, 0.16)';
    ctx.beginPath();
    ctx.moveTo(rx + 1, ry + 1);
    ctx.lineTo(rx + rw * 0.45, ry + 1);
    ctx.lineTo(rx + 1, ry + rh * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 138, 46, 0.55)';
    ctx.lineWidth = Math.max(1, cam.s * 1.1);
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  }
  ctx.restore();
}

/** Double-weight 3px dark espresso outer silhouette contour around the fort's true boundary (zero allocs). */
function fortOuterContour(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, side: Side) {
  FORT_OCC.fill(0);
  let hasAny = false;
  for (const b of snap.blocks) {
    if (b.side !== side || b.c < 0 || b.c >= 16 || b.r < 0 || b.r >= 16) continue;
    FORT_OCC[(b.r << 4) | b.c] = 1;
    hasAny = true;
  }
  if (!hasAny) return;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2.4, 3 * Math.min(1.25, cam.s));
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const b of snap.blocks) {
    if (b.side !== side || b.c < 0 || b.c >= 16 || b.r < 0 || b.r >= 16) continue;
    const x = sx(r, cam, b.x);
    const y = sy(r, cam, b.y + b.size);
    const s = b.size * cam.s;
    if (x > r.x + r.w + 4 || y > r.y + r.h + 4 || x + s < r.x - 4 || y + s < r.y - 4) continue;
    // Left exposed edge
    if (b.c === 0 || !FORT_OCC[(b.r << 4) | (b.c - 1)]) { ctx.moveTo(x, y); ctx.lineTo(x, y + s); }
    // Right exposed edge
    if (b.c === 15 || !FORT_OCC[(b.r << 4) | (b.c + 1)]) { ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); }
    // Top exposed edge (world r+1 is above)
    if (b.r === 15 || !FORT_OCC[((b.r + 1) << 4) | b.c]) { ctx.moveTo(x, y); ctx.lineTo(x + s, y); }
    // Bottom exposed edge (world r-1 is below)
    if (b.r === 0 || !FORT_OCC[((b.r - 1) << 4) | b.c]) { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y + s); }
  }
  ctx.stroke();
  ctx.restore();
}

/** 1-10 The Topiary Keep: sculpted clipped-hedge Peacock tail fanned behind the boss fort (Plate 1). */
function bossPeacockTail(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, f: { x: number; y: number; w: number; h: number }) {
  const cx = sx(r, cam, f.x + f.w * 0.85);
  const cy = sy(r, cam, f.y + f.h * 0.45);
  const rad = Math.max(24, Math.max(f.w, f.h) * cam.s * 0.72);
  ctx.save();
  // Outer scalloped clipped-hedge tail fan
  ctx.fillStyle = '#2A6D3F';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2.5, 3 * cam.s);
  ctx.beginPath();
  ctx.moveTo(cx, cy + rad * 0.2);
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI * 0.72 + (i / 6) * Math.PI * 0.92;
    const fx = cx + Math.cos(a) * rad;
    const fy = cy + Math.sin(a) * rad;
    ctx.arc(fx, fy, rad * 0.19, a - 0.8, a + 0.8);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner lighter emerald topiary tier + brass-teal sculpted feather eyes
  ctx.fillStyle = '#3F9256';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.66 + (i / 5) * Math.PI * 0.78;
    const ex = cx + Math.cos(a) * rad * 0.82;
    const ey = cy + Math.sin(a) * rad * 0.82;
    ctx.beginPath(); ctx.arc(ex, ey, rad * 0.11, 0, Math.PI * 2); ctx.fillStyle = '#FFC23D'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, rad * 0.055, 0, Math.PI * 2); ctx.fillStyle = '#2FB7A6'; ctx.fill();
  }
  ctx.restore();
}

/** 1-10 The Topiary Keep: sculpted clipped-hedge Peacock head & plumes crowning the boss fort (Plate 1). */
function bossPeacockCrest(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, f: { x: number; y: number; w: number; h: number }, t: number) {
  let topY = f.y + f.h;
  let crestX = f.x + f.w * 0.32;
  for (const b of snap.blocks) {
    if (b.side !== 1) continue;
    if (b.y + b.size > topY) { topY = b.y + b.size; crestX = b.x + b.size * 0.5; }
  }
  const x = sx(r, cam, crestX);
  const y = sy(r, cam, topY);
  if (sprites.has('prop_topiary_peacock_crest')) {
    sprites.draw(ctx, 'prop_topiary_peacock_crest', x, y + 4 * cam.s, Math.max(0.65, cam.s * 0.95), false, 1);
    return;
  }
  const s = Math.max(12, 26 * cam.s);
  const sway = t > 0 ? Math.sin(t * 2.2) * 0.03 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  // Sculpted clipped-hedge base plinth
  ctx.fillStyle = '#2F7A46';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, 2.8 * cam.s);
  roundRect(ctx, -s * 0.72, -s * 0.25, s * 1.44, s * 0.34, s * 0.1);
  ctx.fill(); ctx.stroke();
  // Curved clipped-hedge peacock neck & regal head facing left toward player
  ctx.fillStyle = '#439E59';
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, -s * 0.2);
  ctx.quadraticCurveTo(-s * 0.32, -s * 0.92, -s * 0.08, -s * 1.24);
  ctx.arc(0, -s * 1.24, s * 0.34, Math.PI, 0, false);
  ctx.quadraticCurveTo(s * 0.34, -s * 0.75, s * 0.36, -s * 0.2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Clipped hedge highlight cheek
  ctx.fillStyle = '#62BA73';
  ctx.beginPath(); ctx.arc(s * 0.06, -s * 1.28, s * 0.14, 0, Math.PI * 2); ctx.fill();
  // Three brass-tipped crown plumes
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, 2 * cam.s);
  for (let i = -1; i <= 1; i++) {
    const px = i * s * 0.2 + s * 0.08;
    const py = -s * 1.85 + Math.abs(i) * s * 0.08;
    ctx.beginPath(); ctx.moveTo(s * 0.04, -s * 1.54); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = '#FFC23D';
    ctx.beginPath(); ctx.arc(px, py, Math.max(2, s * 0.1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // Golden beak facing left + stern topiary eye
  ctx.fillStyle = '#FFC23D';
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 1.28);
  ctx.lineTo(-s * 0.68, -s * 1.16);
  ctx.lineTo(-s * 0.28, -s * 1.08);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-s * 0.1, -s * 1.28, Math.max(1.6, s * 0.08), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFF4DE';
  ctx.beginPath(); ctx.arc(-s * 0.12, -s * 1.3, Math.max(0.7, s * 0.03), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Three planted Stomper legs under the Footing: planted at rest, marching gait when walking (Plate 1 & 2). */
function stompers(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, f: { x: number; y: number; w: number }, side: number, feel: Feel) {
  const walking = feel.walking(side);
  const c = walking ? anims.get(side === 0 ? 'stomper_blue_walk' : 'stomper_orange_walk') : undefined;
  const restFrame = side === 0 ? 'stomper_blue_0' : 'stomper_orange_0';
  const hasSprite = !!(c || sprites.has(restFrame));
  const t = feel.walkTime(side);
  const k = cam.s * (16 / 30); // the whole leg fits the Footing row
  const by = sy(r, cam, f.y) - (30 - 4.57) * k;
  const pos = [0.18, 0.5, 0.82];
  for (let i = 0; i < 3; i++) {
    const lx = sx(r, cam, f.x + f.w * pos[i]);
    if (hasSprite) {
      const frame = c ? frameAt(c, t + i * 220) : restFrame;
      sprites.draw(ctx, frame, lx, by, k, side === 1);
    } else {
      // Crisp Canvas2D fallback: brass steam piston leg + riveted knee + iron stomper foot
      const step = walking ? Math.sin(t * 0.018 + i * 2.1) : 0;
      const lift = walking ? Math.max(0, Math.cos(t * 0.018 + i * 2.1)) * 4 * cam.s : 0;
      const fy = sy(r, cam, f.y);
      const lh = Math.max(7, 13 * cam.s);
      const pw = Math.max(3, 5 * cam.s);
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, 2 * cam.s);
      // Upper brass piston strut
      ctx.fillStyle = '#C88A2E';
      ctx.fillRect(lx - pw * 0.5 + step * 2 * cam.s, fy - lh, pw, lh - lift);
      ctx.strokeRect(lx - pw * 0.5 + step * 2 * cam.s, fy - lh, pw, lh - lift);
      // Riveted knee joint
      ctx.fillStyle = '#FFE08A';
      ctx.beginPath(); ctx.arc(lx + step * 2 * cam.s, fy - lh * 0.55 - lift * 0.5, Math.max(2, 2.8 * cam.s), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Planted iron stomper foot pad with team trim
      ctx.fillStyle = side === 0 ? '#2F6FDE' : '#5A6572';
      roundRect(ctx, lx - pw * 1.15 + step * 3 * cam.s, fy - Math.max(3, 4.5 * cam.s) - lift, pw * 2.3, Math.max(3.5, 5.2 * cam.s), Math.max(1.5, 2 * cam.s));
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

/** Team pennant flag fluttering atop the highest roof block of each fort (Plate 1). */
function fortFlag(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, f: { x: number; y: number; w: number; h: number }, side: Side, t: number) {
  let topBlock: BlockView | undefined;
  for (const b of snap.blocks) {
    if (b.side !== side) continue;
    if (!topBlock || b.y > topBlock.y || (b.y === topBlock.y && (side === 0 ? b.x < topBlock.x : b.x > topBlock.x))) topBlock = b;
  }
  const wx = topBlock ? topBlock.x + topBlock.size * 0.5 : f.x + f.w * (side === 0 ? 0.25 : 0.75);
  const wy = topBlock ? topBlock.y + topBlock.size : f.y + f.h;
  const x = sx(r, cam, wx), y = sy(r, cam, wy);
  const flutter = t > 0 ? Math.sin(t * 4 + side * 2) * 0.05 : 0;
  const name = side === 0 ? 'flag_blue' : 'flag_orange';
  if (sprites.has(name)) {
    sprites.drawEx(ctx, name, x, y, Math.max(0.55, cam.s), side === 1, 1, flutter, 1);
    return;
  }
  // Crisp storybook fluttering pennant fallback
  const poleH = Math.max(16, 26 * cam.s);
  const fw = Math.max(14, 22 * cam.s);
  const fh = Math.max(8, 12 * cam.s);
  const dir = side === 0 ? 1 : -1;
  const wave = t > 0 ? Math.sin(t * 4.5 + side * 1.8) * fh * 0.18 : 0;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, 2.5 * cam.s);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - poleH); ctx.stroke();
  ctx.fillStyle = '#FFC23D';
  ctx.beginPath(); ctx.arc(x, y - poleH, Math.max(2, 2.8 * cam.s), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = side === 0 ? TEAM[0] : TEAM[1];
  ctx.beginPath();
  ctx.moveTo(x, y - poleH + 2 * cam.s);
  ctx.quadraticCurveTo(x + dir * fw * 0.5, y - poleH + wave, x + dir * fw, y - poleH + 3 * cam.s + wave);
  ctx.lineTo(x + dir * fw * 0.76, y - poleH + fh * 0.55 + wave * 0.6);
  ctx.lineTo(x + dir * fw, y - poleH + fh + wave);
  ctx.quadraticCurveTo(x + dir * fw * 0.5, y - poleH + fh - wave * 0.5, x, y - poleH + fh + 1 * cam.s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.arc(x + s, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
  ctx.arc(x - s, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function block(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, b: BlockView, alpha: number, o: DrawOpts, fatigue: boolean, feel: Feel) {
  const x = sx(r, cam, b.x), y = sy(r, cam, b.y + b.size);
  const s = b.size * cam.s;
  if (x > r.x + r.w || y > r.y + r.h || x + s < r.x || y + s < r.y) return;
  const st = stage(b.hp, b.maxHp);
  if (sprites.draw(ctx, blockName(b.mat, st), x, y, cam.s, false, alpha)) {
    // A damage stage just went up: the crack overlay runs to it, then fades into the new tile.
    const ci = feel.crackStage(b.id, b.hp, b.maxHp);
    if (ci >= 0) sprites.draw(ctx, crackName(b.mat, ci), x, y, cam.s, false, feel.outAlpha * alpha);
    if (b.shimmer) shimmer(ctx, x, y, s, b, o, feel, cam);
    blockMarks(ctx, x, y, s, b, o, fatigue);
    return;
  }
  const [base, shade, light] = MAT[b.mat] ?? MAT.timber;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y + s * 0.78, s, s * 0.22);
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(1, s / 14);
  if (s > 6) {
    if (b.mat === 'timber') {
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.33); ctx.lineTo(x + s, y + s * 0.33); ctx.moveTo(x, y + s * 0.66); ctx.lineTo(x + s, y + s * 0.66); ctx.stroke();
    } else if (b.mat === 'wicker') {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(x + s * (0.2 + i * 0.3), y); ctx.lineTo(x + s * (0.05 + i * 0.3), y + s); }
      ctx.stroke();
    } else if (b.mat === 'cobble') {
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(x + s * 0.3, y + s * 0.3, s * 0.17, 0, Math.PI * 2); ctx.moveTo(x + s * 0.89, y + s * 0.35);
      ctx.arc(x + s * 0.72, y + s * 0.35, s * 0.17, 0, Math.PI * 2); ctx.moveTo(x + s * 0.67, y + s * 0.68);
      ctx.arc(x + s * 0.5, y + s * 0.68, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.mat === 'footing') {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3); ctx.lineTo(x + s / 2, y + s * 0.6); ctx.lineTo(x + s, y + s * 0.3);
      ctx.stroke();
    }
  }
  if (st > 0 && s > 6) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s / 16);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.1); ctx.lineTo(x + s * 0.45, y + s * 0.45); ctx.lineTo(x + s * 0.35, y + s * 0.8);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s / 10);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  ctx.globalAlpha = 1;
  if (b.shimmer) shimmer(ctx, x, y, s, b, o, feel, cam);
  blockMarks(ctx, x, y, s, b, o, fatigue);
}

/** A weakly held block: a slow white glint every 3 s, 30% opacity; Reduce motion: a still dotted outline. */
function shimmer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, b: BlockView, o: DrawOpts, feel: Feel, cam: Cam) {
  if (o.reduceMotion) {
    ctx.save();
    ctx.strokeStyle = 'rgba(43,30,46,0.7)';
    ctx.lineWidth = Math.max(1, s / 12);
    ctx.setLineDash(DOT_DASH);
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.restore();
    return;
  }
  const f = feel.shimmerFrame(b.id);
  if (f) sprites.draw(ctx, f, x, y, cam.s, false, 0.3);
}

/** Snapshot marks on a block: the boss Sprinkler Root, Battered under Fatigue, Ridgepole hold, Lean Lines. */
function blockMarks(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, b: BlockView, o: DrawOpts, fatigue: boolean) {
  if (b.root) {
    // 1-10 Boss Sprinkler Root: sprite when packed, else bioluminescent emerald-cyan vine-wrapped root (Plate 1 & 3).
    if (!sprites.draw(ctx, 'prop_sprinkler_root', x + s * 0.5, y + s, (s / 24), false, 1)) {
      ctx.save();
      const pulse = o.reduceMotion ? 0.45 : 0.38 + 0.14 * Math.sin(o.time * 4.5);
      ctx.fillStyle = `rgba(79, 227, 193, ${pulse.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.65, 0, Math.PI * 2); ctx.fill();
      // Coiled dark woody vine tendrils wrapping the block
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(2.5, s * 0.22);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.08, y + s * 0.85);
      ctx.bezierCurveTo(x + s * 0.2, y + s * 0.2, x + s * 0.8, y + s * 0.85, x + s * 0.92, y + s * 0.18);
      ctx.stroke();
      ctx.strokeStyle = '#2F8A56';
      ctx.lineWidth = Math.max(1.5, s * 0.12);
      ctx.stroke();
      // Bioluminescent emerald-cyan core & brass sprinkler nozzle
      ctx.fillStyle = '#4FE3C1';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.2, s * 0.09);
      ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.52, s * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#E8FFF9';
      ctx.beginPath(); ctx.arc(x + s * 0.44, y + s * 0.45, s * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFC23D';
      ctx.fillRect(x + s * 0.36, y + s * 0.08, s * 0.28, s * 0.16);
      ctx.strokeRect(x + s * 0.36, y + s * 0.08, s * 0.28, s * 0.16);
      ctx.restore();
    }
  }
  if (fatigue && b.battered && s > 4) {
    ctx.save();
    ctx.strokeStyle = '#C9363E';
    ctx.lineWidth = Math.max(1, s / 12);
    ctx.setLineDash(DASH_BATTERED);
    ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    ctx.restore();
  }
  if (b.held) {
    ctx.fillStyle = '#E0AE3E';
    ctx.fillRect(x + s * 0.1, y + s * 0.42, s * 0.8, Math.max(2, s * 0.16));
  }
  if (o.mendTarget && b.side === o.you && b.c === o.mendTarget[0] && b.r === o.mendTarget[1]) {
    ctx.save();
    ctx.fillStyle = 'rgba(92, 195, 90, 0.35)';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#1F6B29';
    ctx.lineWidth = Math.max(2, s / 8);
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.restore();
  }
  const l = o.lean;
  if (l && l.side === b.side) {
    const k = `${b.c},${b.r}`;
    const held = l.c === b.c && l.r === b.r;
    if (held || l.falls.has(k)) {
      ctx.fillStyle = held ? 'rgba(255,194,61,0.55)' : 'rgba(201,54,62,0.5)';
      ctx.fillRect(x, y, s, s);
    }
  }
}

/** Nooks: dark arched Loophole on enemy-facing front wall, Loophole Flap, Pot Lid, broken Nook. */
function room(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, rm: RoomView, feel: Feel) {
  if (rm.loophole) {
    const lp = rm.loophole;
    const x = sx(r, cam, lp.x), y = sy(r, cam, lp.y + lp.h);
    const lw = lp.w * cam.s, lh = lp.h * cam.s;
    // Always draw the dark arched Loophole opening on the enemy-facing front wall of intact Nooks (Plate 1).
    if (rm.intact && lw >= 3 && lh >= 4) {
      ctx.save();
      ctx.fillStyle = '#241B17';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.2, cam.s * 1.4);
      const rad = Math.min(lw * 0.46, lh * 0.38);
      ctx.beginPath();
      ctx.moveTo(x + lw * 0.1, y + lh - 1);
      ctx.lineTo(x + lw * 0.1, y + rad + 1);
      ctx.arc(x + lw * 0.5, y + rad + 1, Math.max(1.5, lw * 0.4), Math.PI, 0);
      ctx.lineTo(x + lw * 0.9, y + lh - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const f = feel.flapSprite(rm);
    if (f && !sprites.draw(ctx, f, x, y, cam.s) && rm.flap) {
      ctx.fillStyle = TEAM[rm.side];
      ctx.fillRect(x, y, lw, lh);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, lw, lh);
    }
  }
  lid(ctx, r, cam, rm.x, rm.y + rm.h, rm.w, feel.lidSprite(rm.side * 1000 + rm.id, rm.lid));
  if (!rm.intact) {
    const x = sx(r, cam, rm.x), y = sy(r, cam, rm.y + rm.h);
    ctx.strokeStyle = 'rgba(44,34,30,0.6)';
    ctx.lineWidth = Math.max(1, cam.s * 2);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rm.w * cam.s, y + rm.h * cam.s); ctx.stroke();
  }
}

/** Pot Lid over a room: it rises into place (and comes down backwards) on its top edge. */
function lid(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, wx: number, wy: number, ww: number, frame: string) {
  if (!frame) return;
  const x = sx(r, cam, wx + ww / 2), y = sy(r, cam, wy);
  if (sprites.draw(ctx, frame, x, y + 8 * cam.s, cam.s * (ww / 32))) return;
  const w = ww * cam.s * 0.55;
  ctx.save();
  ctx.fillStyle = '#9AA3AB';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, cam.s * 1.5);
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.35, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y - w * 0.38, Math.max(1.5, w * 0.12), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** Handcrafted level & boss props: 1-7 Ornate Rescue Cage + Hetty, 1-10 Big Smoothie Jr. + Lawn Sign + Topiary Shears, Turnip, Crock (Plate 1 & 3). */
function prop(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PropView, snap: Snapshot, hasCageBars: boolean, t: number) {
  const x = sx(r, cam, p.x), y = sy(r, cam, p.y);
  if (x < r.x - 80 || x > r.x + r.w + 80 || y < r.y - 100 || y > r.y + r.h + 30) return;
  ctx.save();
  if (p.kind === 'cage_bar') {
    if (!sprites.draw(ctx, 'prop_cage_bar', x, y, Math.max(0.65, cam.s))) {
      // Riveted wrought-iron cage bar with brass collar (damaged bars bend/crack visually)
      const w = Math.max(2.6, 5.2 * cam.s), hh = 46 * cam.s;
      const hurt = p.hp < p.maxHp;
      ctx.fillStyle = hurt ? '#8A7668' : '#4E555E';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.4, cam.s * 1.6);
      roundRect(ctx, x - w / 2, y - hh, w, hh, Math.max(1, w * 0.25));
      ctx.fill(); ctx.stroke();
      // Metallic highlight streak & brass rivets
      ctx.fillStyle = '#9EA7B2';
      ctx.fillRect(x - w * 0.22, y - hh + 3 * cam.s, Math.max(1, w * 0.26), hh - 6 * cam.s);
      ctx.fillStyle = '#FFC23D';
      roundRect(ctx, x - w * 0.85, y - hh - 2 * cam.s, w * 1.7, Math.max(2.5, 4.2 * cam.s), 1.5);
      ctx.fill(); ctx.stroke();
      roundRect(ctx, x - w * 0.85, y - hh * 0.52, w * 1.7, Math.max(2, 3.6 * cam.s), 1.2);
      ctx.fill(); ctx.stroke();
      if (hurt) {
        ctx.strokeStyle = '#FFF4DE';
        ctx.lineWidth = Math.max(1, cam.s);
        ctx.beginPath(); ctx.moveTo(x - w * 0.4, y - hh * 0.35); ctx.lineTo(x + w * 0.4, y - hh * 0.28); ctx.stroke();
      }
    }
  } else if (p.kind === 'roller') {
    // 1-10 Big Smoothie Jr.: vintage brass-and-slate steam roller + "Keep off the grass" lawn sign!
    const alive = p.hp > 0;
    const drewSprite = sprites.draw(ctx, 'prop_big_smoothie_jr', x, y, Math.max(0.7, cam.s), false, alive ? 1 : 0.7)
      || sprites.draw(ctx, 'prop_roller', x, y, Math.max(0.7, cam.s), false, alive ? 1 : 0.7);
    if (!drewSprite) {
      const s = Math.max(10, 24 * cam.s);
      const lw = Math.max(1.8, 2.5 * cam.s);
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      // Contact shadow
      ctx.fillStyle = 'rgba(44, 34, 30, 0.25)';
      ctx.beginPath(); ctx.ellipse(x, y + 2 * cam.s, s * 1.45, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      // Smokestack + animated steam puff when alive
      ctx.fillStyle = alive ? '#3D4652' : '#7A7A7A';
      roundRect(ctx, x - s * 0.65, y - s * 1.85, s * 0.34, s * 0.75, 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = alive ? '#FFC23D' : '#9E9E9E';
      roundRect(ctx, x - s * 0.74, y - s * 1.92, s * 0.52, s * 0.16, 2);
      ctx.fill(); ctx.stroke();
      if (alive) {
        const puffY = t > 0 ? (t * 14) % 12 : 0;
        ctx.fillStyle = 'rgba(255, 250, 240, 0.88)';
        ctx.beginPath(); ctx.arc(x - s * 0.48, y - s * 2.15 - puffY * cam.s * 0.4, s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - s * 0.22, y - s * 2.32 - puffY * cam.s * 0.5, s * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      // Slate-and-crimson boiler chassis + brass rear cab dome
      ctx.fillStyle = alive ? '#5A6572' : '#969DA6';
      roundRect(ctx, x - s * 0.85, y - s * 1.25, s * 1.85, s * 0.68, s * 0.14);
      ctx.fill(); ctx.stroke();
      // Crimson side trim stripe
      ctx.fillStyle = alive ? '#C9363E' : '#8C7A7A';
      ctx.fillRect(x - s * 0.8, y - s * 0.82, s * 1.75, s * 0.18);
      // Brass pressure boiler dome
      ctx.fillStyle = alive ? '#C88A2E' : '#8A847D';
      roundRect(ctx, x + s * 0.25, y - s * 1.7, s * 0.65, s * 0.55, s * 0.1);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = alive ? '#FFE08A' : '#B5AFA7';
      roundRect(ctx, x + s * 0.18, y - s * 1.78, s * 0.79, s * 0.14, 2);
      ctx.fill(); ctx.stroke();
      // Heavy front steel flattening drum (left)
      const drumR = s * 0.58;
      ctx.fillStyle = alive ? '#95A2AF' : '#B2B6BA';
      ctx.beginPath(); ctx.arc(x - s * 0.72, y - drumR, drumR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = alive ? '#D4DDE6' : '#CBD0D4';
      ctx.beginPath(); ctx.arc(x - s * 0.84, y - drumR * 1.15, drumR * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = alive ? '#FFC23D' : '#8E8E8E';
      ctx.beginPath(); ctx.arc(x - s * 0.72, y - drumR, drumR * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Rear spoked brass-hub drive wheel (right)
      const wheelR = s * 0.52;
      ctx.fillStyle = alive ? '#3D4652' : '#7E8287';
      ctx.beginPath(); ctx.arc(x + s * 0.7, y - wheelR, wheelR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = alive ? '#FFE08A' : '#B0B0B0';
      ctx.beginPath(); ctx.arc(x + s * 0.7, y - wheelR, wheelR * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Iconic "Keep off the grass" wooden lawn sign planted beside Big Smoothie Jr. (Plate 1).
    drawLawnSign(ctx, x - Math.max(26, 44 * cam.s), y, cam.s);
  } else if (p.kind === 'shears') {
    // 1-10 Giant orange-handled brass-hinged Topiary Shears (animated snip on boss cut warning!).
    const alive = p.hp > 0;
    if (!sprites.draw(ctx, 'prop_shears', x, y, Math.max(0.75, cam.s), false, alive ? 1 : 0.65)) {
      const len = Math.max(12, 28 * cam.s);
      const cutting = !!snap.hud.boss?.cut;
      const spread = cutting ? (0.34 + 0.14 * Math.sin(t * 7)) : 0.22;
      ctx.translate(x, y - len * 0.35);
      ctx.lineWidth = Math.max(1.8, 2.4 * cam.s);
      ctx.strokeStyle = INK;
      // Draw two crossed metallic beveled blades + bright orange handles
      for (const sgn of [-1, 1]) {
        ctx.save();
        ctx.rotate(sgn * spread);
        // Steel blade pointing left toward player
        ctx.fillStyle = alive ? (sgn < 0 ? '#D8E0E8' : '#96A3B0') : '#A9A39A';
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.1);
        ctx.lineTo(-len * 1.15, -len * 0.02);
        ctx.lineTo(-len * 0.88, len * 0.16);
        ctx.lineTo(0, len * 0.14);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Orange-handled wooden grip extending right
        ctx.fillStyle = alive ? '#E8730C' : '#8C7A6B';
        roundRect(ctx, 0, -len * 0.1, len * 0.85, len * 0.22, len * 0.09);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // Giant brass pivot hinge rivet
      ctx.fillStyle = '#FFC23D';
      ctx.beginPath(); ctx.arc(0, 0, Math.max(3, 5.2 * cam.s), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1.2, 2 * cam.s), 0, Math.PI * 2); ctx.fill();
    }
  } else if (p.kind === 'captive') {
    // 1-7 Hetty Rescue Cage: ornate arched wrought-iron birdcage with brass finial ring + Hetty waving inside (Plate 3).
    const drewCageSprite = hasCageBars && sprites.draw(ctx, 'prop_rescue_cage_hetty', x, y, Math.max(0.7, cam.s));
    if (!drewCageSprite) {
      if (hasCageBars) {
        const cw = Math.max(20, 38 * cam.s), ch = Math.max(28, 52 * cam.s);
        // Wooden cage base plinth & back arch dome silhouette
        ctx.fillStyle = 'rgba(44, 34, 30, 0.22)';
        ctx.beginPath();
        ctx.moveTo(x - cw * 0.5, y);
        ctx.lineTo(x - cw * 0.5, y - ch * 0.65);
        ctx.arc(x, y - ch * 0.65, cw * 0.5, Math.PI, 0);
        ctx.lineTo(x + cw * 0.5, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#7A4E2D';
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.5, 2 * cam.s);
        roundRect(ctx, x - cw * 0.56, y - 5 * cam.s, cw * 1.12, 6 * cam.s, 2);
        ctx.fill(); ctx.stroke();
      }
      // Hetty inside, waving cheerfully for rescue!
      const wave = t > 0 ? Math.sin(t * 6) * 2.5 * cam.s : 0;
      if (!sprites.draw(ctx, 'hob_hetty_blue_idle_0', x, y - (hasCageBars ? 4 * cam.s : 0), cam.s * HOB_SCALE)) {
        const hs = Math.max(8, 16 * cam.s);
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.4, 1.8 * cam.s);
        // Waving little arms
        ctx.beginPath();
        ctx.moveTo(x - hs * 0.35, y - hs * 0.7); ctx.lineTo(x - hs * 0.72, y - hs * 1.15 + wave);
        ctx.moveTo(x + hs * 0.35, y - hs * 0.7); ctx.lineTo(x + hs * 0.72, y - hs * 1.15 - wave);
        ctx.stroke();
        // Plump coat + cobalt scarf
        ctx.fillStyle = '#8C6244';
        roundRect(ctx, x - hs * 0.42, y - hs * 0.9, hs * 0.84, hs * 0.85, hs * 0.24);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = TEAM[0];
        ctx.fillRect(x - hs * 0.44, y - hs * 0.96, hs * 0.88, hs * 0.2);
        ctx.strokeRect(x - hs * 0.44, y - hs * 0.96, hs * 0.88, hs * 0.2);
        // Round warm face + teal Patcher cap
        ctx.fillStyle = '#F2C9A0';
        ctx.beginPath(); ctx.arc(x, y - hs * 1.25, hs * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2FB7A6';
        ctx.beginPath(); ctx.arc(x, y - hs * 1.38, hs * 0.38, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // Ornate wrought-iron arched birdcage dome, crossbar band, and brass finial ring in front!
      if (hasCageBars) {
        const cw = Math.max(20, 38 * cam.s), ch = Math.max(28, 52 * cam.s);
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(2, 2.6 * cam.s);
        ctx.beginPath();
        ctx.moveTo(x - cw * 0.5, y - 4 * cam.s);
        ctx.lineTo(x - cw * 0.5, y - ch * 0.65);
        ctx.arc(x, y - ch * 0.65, cw * 0.5, Math.PI, 0);
        ctx.lineTo(x + cw * 0.5, y - 4 * cam.s);
        ctx.stroke();
        // Horizontal wrought-iron crossbar & brass finial ring atop the dome
        ctx.fillStyle = '#5A6572';
        ctx.fillRect(x - cw * 0.52, y - ch * 0.65, cw * 1.04, Math.max(2.5, 4 * cam.s));
        ctx.strokeRect(x - cw * 0.52, y - ch * 0.65, cw * 1.04, Math.max(2.5, 4 * cam.s));
        ctx.strokeStyle = '#FFC23D';
        ctx.lineWidth = Math.max(2, 2.6 * cam.s);
        ctx.beginPath(); ctx.arc(x, y - ch * 0.65 - cw * 0.5 - 4 * cam.s, Math.max(3, 5 * cam.s), 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1, 1.3 * cam.s);
        ctx.stroke();
      }
    }
    if (p.hp < p.maxHp) {
      const s = Math.max(10, 24 * cam.s);
      ctx.fillStyle = INK;
      ctx.fillRect(x - s * 0.3, y + 2, s * 0.6, 4);
      ctx.fillStyle = TEAM[0];
      ctx.fillRect(x - s * 0.3 + 1, y + 3, (s * 0.6 - 2) * Math.max(0, p.hp / p.maxHp), 2);
    }
  } else if (p.kind === 'turnip') {
    if (!sprites.draw(ctx, 'prop_turnip', x, y, Math.max(0.75, cam.s))) {
      const rad = Math.max(4, 10 * cam.s);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.4, cam.s * 1.8);
      // Leafy green sprout
      ctx.strokeStyle = '#1F6B29';
      ctx.beginPath(); ctx.moveTo(x, y - rad * 1.8); ctx.lineTo(x - rad * 0.5, y - rad * 2.5); ctx.moveTo(x, y - rad * 1.8); ctx.lineTo(x + rad * 0.5, y - rad * 2.5); ctx.stroke();
      // Plump purple-and-cream turnip bulb
      ctx.fillStyle = '#FFF4DE';
      ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(x, y - rad, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#B864BA';
      ctx.beginPath(); ctx.arc(x, y - rad, rad, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else {
    // Tick-Tock Crock prop: stoneware crock with brass alarm bells & ticking face
    if (!sprites.draw(ctx, 'prop_crock', x, y, Math.max(0.75, cam.s))) {
      const rad = Math.max(5, 11 * cam.s);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.4, cam.s * 1.8);
      ctx.fillStyle = '#FFC23D';
      ctx.beginPath(); ctx.arc(x - rad * 0.55, y - rad * 1.9, rad * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + rad * 0.55, y - rad * 1.9, rad * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#D9773A';
      roundRect(ctx, x - rad * 0.9, y - rad * 1.7, rad * 1.8, rad * 1.7, rad * 0.35);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFF4DE';
      ctx.beginPath(); ctx.arc(x, y - rad * 0.85, rad * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#A61C24';
      ctx.beginPath(); ctx.moveTo(x, y - rad * 0.85); ctx.lineTo(x, y - rad * 1.25); ctx.moveTo(x, y - rad * 0.85); ctx.lineTo(x + rad * 0.32, y - rad * 0.72); ctx.stroke();
    }
  }
  ctx.restore();
}

/** The lawn sign's words (content/text.json hud.signs, the first one), split over two lines. */
let signLines: [string, string] | undefined;
const SIGN_LINES = (): [string, string] => {
  if (signLines) return signLines;
  const w = (list('hud.signs')[0] ?? '').split(' ');
  const half = Math.ceil(w.length / 2);
  return (signLines = [w.slice(0, half).join(' '), w.slice(half).join(' ')]);
};

/** Tiny wooden "Keep off the grass" lawn sign planted beside 1-10 Big Smoothie Jr. (Plate 1). */
function drawLawnSign(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  if (sprites.draw(ctx, 'prop_lawn_sign', x, y, Math.max(0.65, s))) return;
  const k = Math.max(0.6, s);
  const bw = 28 * k, bh = 13 * k, stakeH = 14 * k;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.3, 1.8 * k);
  ctx.fillStyle = '#87491F';
  ctx.fillRect(x - 2 * k, y - stakeH, 4 * k, stakeH);
  ctx.strokeRect(x - 2 * k, y - stakeH, 4 * k, stakeH);
  ctx.fillStyle = '#FAF3E3';
  roundRect(ctx, x - bw * 0.5, y - stakeH - bh, bw, bh, 2 * k);
  ctx.fill(); ctx.stroke();
  if (k >= 0.65) {
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.max(6, Math.round(5.2 * k))}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const [l1, l2] = SIGN_LINES();
    ctx.fillText(l1, x, y - stakeH - bh * 0.54);
    ctx.fillText(l2, x, y - stakeH - bh * 0.16);
  }
  ctx.restore();
}

function kettle(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, k: KettleView, t: number, glow: boolean, feel: Feel) {
  if (sprites.has('kettle_full')) {
    const room = k.room ?? { x: k.x, y: k.y, w: k.size, h: k.size };
    sprites.draw(ctx, 'kettle_room', sx(r, cam, room.x), sy(r, cam, room.y + room.h), cam.s * (room.w / 32), false, 1);
    const pct = k.hp / k.maxHp;
    const fx0 = sx(r, cam, room.x + room.w / 2), fy0 = sy(r, cam, room.y);
    if (k.hp > 0) sprites.draw(ctx, 'kettle_halo', fx0, fy0 - 14 * cam.s, cam.s * (0.8 + 0.08 * Math.sin(t * 3)), false, 0.7);
    const dir = k.side ? -1 : 1;
    const popping = feel.kettleSprite(k);
    const kx = fx0 - 4 * cam.s * dir;
    if (popping) sprites.draw(ctx, popping, kx, fy0, cam.s * KETTLE_SCALE, k.side === 1);
    else sprites.draw(ctx, KETTLE_ST[k.hp <= 0 ? 3 : pct <= 0.25 ? 2 : pct <= 0.5 ? 1 : 0], kx, fy0, cam.s * KETTLE_SCALE, k.side === 1);
    // Steam puffs from the spout at 25% or less [07 §6.6].
    const steam = feel.steamSprite(k.side);
    if (steam) sprites.draw(ctx, steam, kx + dir * 15 * cam.s, fy0 - 18 * cam.s, cam.s, false, 0.9);
    // Call lidSprite unconditionally so Kettle Room Pot Lid plays its lowering animation when consumed (Web-L5).
    const kLid = feel.lidSprite(k.side * 1000 + 999, !!k.lid);
    if (kLid && k.room) lid(ctx, r, cam, k.room.x, k.room.y + k.room.h, k.room.w, kLid);
    return;
  }
  const x = sx(r, cam, k.x + k.size / 2), y = sy(r, cam, k.y + k.size * 0.45);
  const s = k.size * cam.s;
  if (glow || k.hp > 0) {
    ctx.fillStyle = 'rgba(79,227,193,0.3)';
    ctx.beginPath();
    ctx.arc(x, y, s * (0.72 + 0.04 * Math.sin(t * 3)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = k.hp > 0 ? '#D9773A' : '#7A6A60';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, s / 14);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.45, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4FE3C1';
  ctx.beginPath();
  ctx.arc(x, y + s * 0.12, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function hob(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, h: HobView, snap: Snapshot, picked: boolean, t: number, feel: Feel) {
  const s = Math.max(10, 24 * cam.s);
  const x = sx(r, cam, h.x), y = sy(r, cam, h.y);
  if (x < r.x - s || x > r.x + r.w + s || y < r.y - s * 3 || y > r.y + r.h + s) return;
  // Rival units are Flatteners; a crew Hob on the Rival side wears the Rival look (its own frames).
  const isFlattener = h.side === 1 && snap.mode !== 'duel' && !isCrewHob(h.def ?? h.id);
  const frame = feel.hobSprite(h);
  const lift = feel.outDy * cam.s;
  // Squashed (crushed by a fall): drawn flattened, never as Bonked; it pops back up (N2).
  const sq = h.state === 'squashed' ? 0.62 : 1;
  if (isFlattener) {
    // Campaign/Skirmish enemy units: try packed flattener_* sprite first, else render unmistakable
    // rigid tall rectilinear Slate-Grey Flattener (Plate 3: "Round vs Flat"), never cloned orange Hobs.
    const staticFlattener = !frame
      ? `flattener_${flattenerSpriteName(h.def ?? h.id, h.cls)}_${h.state === 'bonked' ? 'bonked' : 'idle'}_0`
      : undefined;
    const useFrame = frame && frame.startsWith('flattener_') && sprites.has(frame)
      ? frame
      : staticFlattener && sprites.has(staticFlattener)
        ? staticFlattener
        : undefined;
    if (useFrame && sprites.drawEx(ctx, useFrame, x, y - lift, cam.s * HOB_SCALE, true, 1, 0, sq)) {
      hobMarks(ctx, cam, h, picked, s, x, y);
    } else {
      flattenerBody(ctx, h, t, s, x, y - lift, feel.hobHurt(h.id));
      hobMarks(ctx, cam, h, picked, s, x, y);
    }
  } else if (frame && sprites.drawEx(ctx, frame, x, y - lift, cam.s * HOB_SCALE, h.side === 1, 1, 0, sq)) {
    hobMarks(ctx, cam, h, picked, s, x, y);
  } else hobBody(ctx, r, cam, h, picked, t, false, s, x, y - lift);
  if (h.state === 'dug') {
    // Buried Loophole: a heap of dirt in front of the Hob.
    const dir = h.side === 0 ? 1 : -1;
    ctx.fillStyle = '#9A6440';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s / 16);
    ctx.beginPath(); ctx.ellipse(x + dir * s * 0.45, y - s * 0.25, s * 0.42, s * 0.32, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function hobMarks(ctx: CanvasRenderingContext2D, cam: Cam, h: HobView, picked: boolean, s: number, x: number, y: number) {
  const bonked = h.state === 'bonked';
  if (picked && !bonked) {
    ctx.strokeStyle = '#FFC23D';
    ctx.lineWidth = 2.2;
    ctx.setLineDash(DASH_PICK);
    ctx.beginPath(); ctx.arc(x, y - 14 * cam.s, 16 * cam.s, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
  if (h.state === 'rest') {
    if (!sprites.draw(ctx, 'fx_rest_cog', x + 10 * cam.s, y - 30 * cam.s, Math.max(0.8, cam.s))) {
      ctx.fillStyle = '#FFC23D';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 10 * cam.s, y - 30 * cam.s, Math.max(4, 5.5 * cam.s), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (h.state === 'squashed') squashMark(ctx, x, y - 22 * cam.s, Math.max(0.8, cam.s));
  if (!bonked && h.hp < h.maxHp) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - s * 0.3, y + 2, s * 0.6, 4);
    ctx.fillStyle = TEAM[h.side];
    ctx.fillRect(x - s * 0.3 + 1, y + 3, (s * 0.6 - 2) * (h.hp / h.maxHp), 2);
  }
}
const DASH_PICK = [4, 3];

/** Three little stars over a Squashed Hob: dazed, not out. */
function squashMark(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  ctx.fillStyle = '#FFC23D';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    const cx = x + i * 7 * k, cy = y - Math.abs(i) * 2 * k, r = 3 * k;
    ctx.beginPath();
    for (let j = 0; j < 8; j++) { const a = (j * Math.PI) / 4, q = j % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

/**
 * Rigid tall rectilinear Slate-Grey Flattener (Plate 3: "Round vs Flat" silhouette contrast).
 * Creased #5A6572 suit, stark #FFFFFF gloves, flat spirit-level pancake cap with bright #4ADE80
 * green level bubble (tilts when hurt/bonked), sharp #E8730C tie, straight-edged tool, and a
 * square zzz Snooze Balloon when bonked!
 */
function flattenerBody(ctx: CanvasRenderingContext2D, h: HobView, t: number, s: number, x: number, y: number, hurt: boolean) {
  const bonked = h.state === 'bonked';
  const squashed = h.state === 'squashed';
  const lw = Math.max(1.5, s / 10);
  ctx.save();
  // Square zzz Snooze Balloon (strictly rectilinear vs Hob's puffy round balloon!)
  if (bonked) {
    const bx = x, by = y - s * 1.95;
    const bs = s * 0.56;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, s / 16);
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.lineTo(bx, by + bs * 0.5); ctx.stroke();
    // Orange diamond ribbon tag on string
    ctx.fillStyle = '#E8730C';
    diamond(ctx, x, y - s * 1.32, Math.max(2, s * 0.1));
    ctx.fill(); ctx.stroke();
    // Square flat-pack balloon cube
    ctx.fillStyle = '#C8D0DC';
    ctx.lineWidth = lw;
    ctx.fillRect(bx - bs * 0.5, by - bs * 0.5, bs, bs);
    ctx.strokeRect(bx - bs * 0.5, by - bs * 0.5, bs, bs);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(bx - bs * 0.4, by - bs * 0.4, bs * 0.25, bs * 0.2);
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.max(8, Math.round(s * 0.32))}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('zzz', bx, by + s * 0.11);
    ctx.globalAlpha = 0.72;
  }
  const stiffBob = !bonked && t > 0 ? Math.round(Math.sin(t * 2.4 + h.x * 0.05)) * s * 0.015 : 0;
  if (squashed) {
    ctx.translate(x, y);
    ctx.scale(1.22, 0.65);
    ctx.translate(-x, -y);
  }
  // Tall narrow angular legs & polished dark shoes
  ctx.fillStyle = '#3D4652';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.fillRect(x - s * 0.2, y - s * 0.34, s * 0.16, s * 0.34);
  ctx.strokeRect(x - s * 0.2, y - s * 0.34, s * 0.16, s * 0.34);
  ctx.fillRect(x + s * 0.04, y - s * 0.34, s * 0.16, s * 0.34);
  ctx.strokeRect(x + s * 0.04, y - s * 0.34, s * 0.16, s * 0.34);

  // Tall rigid vertical rectilinear Slate-Grey creased jacket (#5A6572)
  const jx = x - s * 0.27, jy = y - s * 0.94 + stiffBob, jw = s * 0.54, jh = s * 0.64;
  ctx.fillStyle = '#5A6572';
  ctx.fillRect(jx, jy, jw, jh);
  // Dark right side crease shadow
  ctx.fillStyle = '#3D4652';
  ctx.fillRect(x + s * 0.06, jy + 1, s * 0.2, jh - 2);
  // Pressed crisp collar & sharp orange rival tie (#E8730C)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.13, jy); ctx.lineTo(x + s * 0.08, jy); ctx.lineTo(x - s * 0.02, jy + s * 0.16);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#E8730C';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.07, jy + s * 0.05);
  ctx.lineTo(x + s * 0.03, jy + s * 0.05);
  ctx.lineTo(x + s * 0.05, jy + s * 0.42);
  ctx.lineTo(x - s * 0.02, jy + s * 0.5);
  ctx.lineTo(x - s * 0.09, jy + s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, lw * 0.65);
  ctx.stroke();
  // Crisp outer espresso silhouette on jacket
  ctx.lineWidth = lw;
  ctx.strokeRect(jx, jy, jw, jh);

  // Stark white gloved hands + class straight-edged tool pointing left
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - s * 0.42, jy + s * 0.24, s * 0.16, s * 0.15);
  ctx.strokeRect(x - s * 0.42, jy + s * 0.24, s * 0.16, s * 0.15);
  // Straight-edged tool (ruler / shears / tamper / clipboard)
  ctx.fillStyle = h.cls === 'zinger' ? '#FFC23D' : h.cls === 'lobber' ? '#CFD6DE' : '#96A3B0';
  ctx.fillRect(x - s * 0.54, jy - s * 0.08, s * 0.12, s * 0.48);
  ctx.strokeRect(x - s * 0.54, jy - s * 0.08, s * 0.12, s * 0.48);

  // Rigid rectangular head (pale neutral tone)
  const hx = x - s * 0.2, hy = y - s * 1.24 + stiffBob, hw = s * 0.4, hh = s * 0.31;
  ctx.fillStyle = '#EAD3C0';
  ctx.fillRect(hx, hy, hw, hh);
  ctx.strokeRect(hx, hy, hw, hh);
  // Stern flat brows & deadpan eyes (X eyes when bonked)
  ctx.fillStyle = INK;
  if (bonked) {
    ctx.lineWidth = Math.max(1.2, s / 16);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.15, hy + hh * 0.35); ctx.lineTo(x - s * 0.05, hy + hh * 0.58);
    ctx.moveTo(x - s * 0.05, hy + hh * 0.35); ctx.lineTo(x - s * 0.15, hy + hh * 0.58);
    ctx.stroke();
  } else {
    ctx.fillRect(x - s * 0.16, hy + hh * 0.32, s * 0.14, Math.max(1.5, s * 0.05));
    ctx.fillRect(x - s * 0.14, hy + hh * 0.46, Math.max(1.5, s * 0.06), Math.max(1.5, s * 0.06));
    ctx.fillRect(x - s * 0.13, hy + hh * 0.74, s * 0.14, Math.max(1.2, s * 0.04));
  }

  // Flat Spirit-Level Pancake Cap with bright #4ADE80 green level bubble (tilts off-center when hurt/bonked!)
  const capTilt = (hurt || bonked || squashed) ? -0.14 : 0;
  ctx.save();
  ctx.translate(x, hy);
  if (capTilt) ctx.rotate(capTilt);
  ctx.fillStyle = '#5A6572';
  ctx.lineWidth = lw;
  // Flat wide brim
  ctx.fillRect(-s * 0.36, -s * 0.05, s * 0.72, s * 0.08);
  ctx.strokeRect(-s * 0.36, -s * 0.05, s * 0.72, s * 0.08);
  // Flat rectilinear pancake crown
  ctx.fillRect(-s * 0.28, -s * 0.22, s * 0.56, s * 0.18);
  ctx.strokeRect(-s * 0.28, -s * 0.22, s * 0.56, s * 0.18);
  // Spirit-level glass vial window + glowing #4ADE80 green bubble
  const vw = s * 0.34, vh = s * 0.095;
  ctx.fillStyle = '#D8F5E0';
  ctx.fillRect(-vw * 0.5, -s * 0.18, vw, vh);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s / 18);
  ctx.strokeRect(-vw * 0.5, -s * 0.18, vw, vh);
  const bubbleShift = (hurt || bonked || squashed) ? s * 0.09 : 0;
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(-s * 0.07 + bubbleShift, -s * 0.17, s * 0.14, vh - 1);
  ctx.restore();

  ctx.restore();
}

function hobBody(ctx: CanvasRenderingContext2D, _r: Rect, _cam: Cam, h: HobView, picked: boolean, t: number, _firing: boolean, s: number, x: number, y: number) {
  const bonked = h.state === 'bonked';
  const squashed = h.state === 'squashed';
  if (bonked) {
    // Round puffy white/team zzz Snooze Balloon floats up (contrast with Flattener's square balloon!)
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, s / 16);
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y - s * 1.3); ctx.stroke();
    ctx.fillStyle = h.side === 0 ? '#FFF9EE' : TEAM_LIGHT[h.side];
    ctx.beginPath(); ctx.ellipse(x, y - s * 1.58, s * 0.28, s * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.max(8, Math.round(s * 0.28))}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('zzz', x, y - s * 1.5);
    ctx.globalAlpha = 0.55;
  }
  const bob = picked && !bonked ? Math.sin(t * 5) * s * 0.04 : 0;
  if (squashed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.2, 0.72);
    ctx.translate(-x, -y);
  }
  // Plump rounded warm body
  ctx.fillStyle = '#8C6244';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.4, s / 11);
  roundRect(ctx, x - s * 0.3, y - s * 0.52 + bob, s * 0.6, s * 0.52, s * 0.2);
  ctx.fill(); ctx.stroke();
  // Saturated team scarf (hatched orange in Couch Duel side 1)
  ctx.fillStyle = TEAM[h.side];
  ctx.fillRect(x - s * 0.32, y - s * 0.56 + bob, s * 0.64, s * 0.12);
  ctx.strokeRect(x - s * 0.32, y - s * 0.56 + bob, s * 0.64, s * 0.12);
  // Warm rounded head
  ctx.fillStyle = SKIN[(h.id.length + h.name.length) % SKIN.length];
  ctx.beginPath(); ctx.arc(x, y - s * 0.74 + bob, s * 0.24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Rounded domed hat by Class
  ctx.fillStyle = HAT[h.cls] ?? '#888';
  ctx.beginPath(); ctx.arc(x, y - s * 0.84 + bob, s * 0.25, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (h.side === 1) {
    ctx.fillStyle = TEAM[1];
    diamond(ctx, x, y - s * 0.94 + bob, s * 0.08); ctx.fill(); ctx.stroke();
  }
  // Eyes
  ctx.fillStyle = INK;
  const dir = h.side === 0 ? 1 : -1;
  ctx.fillRect(x + dir * s * 0.06, y - s * 0.76 + bob, Math.max(1.5, s * 0.055), Math.max(1.5, s * 0.065));
  if (squashed) ctx.restore();
  ctx.globalAlpha = 1;
  if (squashed) squashMark(ctx, x, y - s * 0.95, Math.max(0.8, s / 24));
  if (picked && !bonked) {
    ctx.strokeStyle = '#FFC23D';
    ctx.lineWidth = 2.2;
    ctx.setLineDash(DASH_PICK);
    ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
  if (h.state === 'rest') {
    ctx.fillStyle = '#5C4A3E';
    ctx.font = `700 ${Math.max(12, s * 0.4)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`⚙${h.rest}`, x + s * 0.45, y - s * 1.0);
  }
  // HP bar
  if (!bonked && h.hp < h.maxHp) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - s * 0.3, y + 2, s * 0.6, 4);
    ctx.fillStyle = TEAM[h.side];
    ctx.fillRect(x - s * 0.3 + 1, y + 3, (s * 0.6 - 2) * (h.hp / h.maxHp), 2);
  }
}

function pin(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PinView, feel: Feel) {
  const x = sx(r, cam, p.x), y = sy(r, cam, p.y);
  if (x < r.x - 20 || x > r.x + r.w + 20 || y < r.y - 30 || y > r.y + r.h + 10) return;
  if (sprites.draw(ctx, feel.pinSprite(p), x, y, 1.3, false, p.spent ? 0.45 : 1)) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.font = '700 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    const label = roundLabel(p.round);
    ctx.strokeText(label, x + 10, y - 22);
    ctx.fillText(label, x + 10, y - 22);
    return;
  }
  const mine = p.side === 0;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
  ctx.fillStyle = p.spent ? '#FFF4DE' : TEAM[p.side];
  if (mine) { ctx.beginPath(); ctx.arc(x, y - 20, 8, 0, Math.PI * 2); }
  else diamond(ctx, x, y - 20, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.spent ? INK : '#fff';
  ctx.font = '700 12px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(roundLabel(p.round), x, y - 16);
}
const ROUNDS: string[] = [];
const roundLabel = (n: number) => (ROUNDS[n] ??= String(n));

function ghost(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PinView, alpha: number, dash: number[]) {
  if (p.path.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = TEAM[p.side];
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  const path = p.path;
  ctx.moveTo(sx(r, cam, path[0][0]), sy(r, cam, path[0][1]));
  for (let i = 1; i < path.length; i++) ctx.lineTo(sx(r, cam, path[i][0]), sy(r, cam, path[i][1]));
  ctx.stroke();
  ctx.restore();
}

export function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The Field Strip: the whole field in small, both forts, Pins, the shell and each lens's edges. */
export function drawStrip(ctx: CanvasRenderingContext2D, r: Rect, snap: Snapshot, terr: TerrainLayer, lenses: { rect: Rect; cam: Cam }[], nLenses: number, _you: Side) {
  ctx.save();
  ctx.fillStyle = '#FFF4DE';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const kx = r.w / Math.max(1, terr.w);
  const ky = (r.h - 6) / 500;
  const bot = r.y + r.h;
  ctx.fillStyle = '#7CC46A';
  ctx.beginPath();
  ctx.moveTo(r.x, bot);
  for (let i = 0; i <= r.w; i += 2) {
    const wx = Math.min(terr.w - 1, Math.floor(i / kx));
    const top = terr.tops[wx] ?? 0;
    ctx.lineTo(r.x + i, bot - Math.max(0, top - 120) * ky);
  }
  ctx.lineTo(r.x + r.w, bot);
  ctx.fill();
  for (let i = 0; i < 2; i++) {
    const f = snap.forts[i];
    ctx.fillStyle = TEAM[i];
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    const fx = r.x + f.x * kx, fy = bot - Math.max(0, f.y + f.h - 120) * ky;
    if (i === 0) { ctx.fillRect(fx, fy, Math.max(6, f.w * kx), Math.max(6, f.h * ky)); ctx.strokeRect(fx, fy, Math.max(6, f.w * kx), Math.max(6, f.h * ky)); }
    else { diamond(ctx, r.x + (f.x + f.w / 2) * kx, bot - Math.max(0, f.y + f.h / 2 - 120) * ky, Math.max(5, f.h * ky * 0.6)); ctx.fill(); ctx.stroke(); }
  }
  // level objects (the 1-7 cage and captive): small marks, so the goal shows in portrait too
  for (const p of snap.props ?? []) {
    ctx.fillStyle = p.kind === 'captive' ? '#2FB7A6' : INK;
    if (p.kind === 'cage_bar') ctx.fillRect(r.x + p.x * kx - 1, bot - Math.max(0, p.y + 40 - 120) * ky, 2, Math.max(4, 40 * ky));
    else { ctx.beginPath(); ctx.arc(r.x + p.x * kx, bot - Math.max(0, p.y + 12 - 120) * ky, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  for (let i = Math.max(0, snap.pins.length - 4); i < snap.pins.length; i++) {
    const p = snap.pins[i];
    ctx.fillStyle = TEAM[p.side];
    const px = r.x + p.x * kx, py = bot - Math.max(0, p.y - 120) * ky - 4;
    // Colour-blind shape permanence: side 0 is always Circle, side 1 is always Diamond (Web-M14).
    if (p.side === 0) { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
    else { diamond(ctx, px, py, 3.5); ctx.fill(); }
  }
  const pv = snap.hud.preview;
  if (pv.length) {
    ctx.fillStyle = INK;
    for (let i = 0; i < pv.length; i += 3) ctx.fillRect(r.x + pv[i][0] * kx - 1, bot - Math.max(0, pv[i][1] - 120) * ky - 1, 2, 2);
  }
  for (const s of snap.shells) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(r.x + s.x * kx, Math.max(r.y + 3, bot - Math.max(0, s.y - 120) * ky), 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(43,30,46,0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < nLenses; i++) {
    const l = lenses[i];
    const half = l.rect.w / 2 / l.cam.s;
    const a = r.x + (l.cam.cx - half) * kx, b = r.x + (l.cam.cx + half) * kx;
    ctx.beginPath();
    ctx.moveTo(a + 4, r.y + 3); ctx.lineTo(a, r.y + 3); ctx.lineTo(a, r.y + r.h - 3); ctx.lineTo(a + 4, r.y + r.h - 3);
    ctx.moveTo(b - 4, r.y + 3); ctx.lineTo(b, r.y + 3); ctx.lineTo(b, r.y + r.h - 3); ctx.lineTo(b - 4, r.y + r.h - 3);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.restore();
}
