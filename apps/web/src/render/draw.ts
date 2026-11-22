// Canvas2D drawing of one lens (a viewport with a camera) from the snapshot.
// The draw loop allocates nothing: world-to-screen goes through sx/sy (numbers, not tuples),
// sprite names are built once and cached, and effects come from the pooled Feel state.
import type { BlockView, HobView, KettleView, PinView, PropView, RoomView, Side, Snapshot } from '../core/types';
import type { Feel } from './feel';
import type { TerrainLayer } from './terrain';
import { anims, frameAt } from './anim';
import { sprites } from './sprites';
import { type Cam, type Rect, stage, sx, sy, toScreen, toWorld } from './view';

export { type Cam, type Rect, toScreen, toWorld };

const HOB_SCALE = 0.4; // Hob frames are 72 x 80 at @1x; a Hob stands about 1.6 blocks tall
const KETTLE_SCALE = 0.72;
/** Draw the Stompers under a fort while it walks (data.fort_bob moves the body over them). */
const STOMPERS = true;

export const INK = '#2B1E2E';
export const TEAM = ['#2F6FDE', '#E8730C'];
export const TEAM_LIGHT = ['#9DBDF5', '#FFB070'];
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
  private c = this.canvas.getContext('2d')!;
  private src: CanvasImageSource | null = null;
  private rev = -1; private w = 0; private h = 0;
  private pw = 0; private ph = 0; private prev = -1; private psrc: CanvasImageSource | null = null; private n = 0;
  get(src: CanvasImageSource, rev: number, w: number, h: number, smooth: boolean): HTMLCanvasElement | null {
    w = Math.round(w); h = Math.round(h);
    if (src === this.src && rev === this.rev && w === this.w && h === this.h) return this.canvas;
    if (w * h > 9e6 || w < 1 || h < 1) return null;
    if (src !== this.psrc || rev !== this.prev || w !== this.pw || h !== this.ph) { this.psrc = src; this.prev = rev; this.pw = w; this.ph = h; this.n = 0; return null; }
    if (++this.n < 3) return null;
    this.canvas.width = w; this.canvas.height = h;
    this.c.imageSmoothingEnabled = smooth;
    this.c.imageSmoothingQuality = 'high';
    this.c.drawImage(src, 0, 0, w, h);
    this.src = src; this.rev = rev; this.w = w; this.h = h;
    return this.canvas;
  }
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
  private ctx = this.canvas.getContext('2d')!;
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
    const alpha = o.seeThrough === side ? 0.55 : 1;
    const fatigue = snap.fatigue?.[side] ?? false;
    for (const b of snap.blocks) if (b.side === side) block(ctx, r, cam, b, alpha, o, fatigue, feel);
    for (const k of snap.kettles) if (k.side === side) kettle(ctx, r, cam, k, o.reduceMotion ? 0 : o.time, o.seeThrough === side, feel);
    for (const rm of snap.rooms ?? []) if (rm.side === side) room(ctx, r, cam, rm, feel);
    if (moved) ctx.restore();
    if (STOMPERS && feel.walking(side)) stompers(ctx, r, cam, f, side, feel);
    if (moved) {
      ctx.save();
      const bx = sx(r, cam, f.x + f.w / 2), by = sy(r, cam, f.y);
      ctx.translate(bx, by + dy * cam.s);
      ctx.rotate(tilt * DEG);
      ctx.translate(-bx, -by);
    }
    for (const hb of snap.hobs) if (hb.side === side) hob(ctx, r, cam, hb, hb.id === o.pickedHob, o.reduceMotion ? 0 : o.time, feel);
    if (moved) ctx.restore();
  }
  for (const p of snap.props ?? []) prop(ctx, r, cam, p);
  // Grand Fort 1-10: the red cut line, shown one boss turn before the shears snip.
  const cut = snap.hud.boss?.cut;
  if (cut) {
    ctx.save();
    ctx.strokeStyle = '#E5484D';
    ctx.lineWidth = Math.max(2, 3 * cam.s);
    ctx.setLineDash(DASH_CUT);
    ctx.strokeRect(sx(r, cam, cut.x), sy(r, cam, cut.y + cut.h), cut.w * cam.s, cut.h * cam.s);
    ctx.restore();
  }
  feel.col.draw(ctx, r, cam);
  for (const p of snap.pins) pin(ctx, r, cam, p, feel);

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
  feel.fx.drawNums(ctx, r, cam);
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
  } else {
    ctx.fillStyle = '#B7DDA8';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    for (let px = r.x; px <= r.x + r.w + 8; px += 8) {
      const wx = cam.cx * 0.5 + (px - r.x) / Math.max(0.3, cam.s * 0.6);
      ctx.lineTo(px, baseY - 30 * cam.s - 26 * Math.sin(wx / 180) * Math.min(1.5, cam.s + 0.3));
    }
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.fill();
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
      const pre = lc?.terr.get(terr.canvas, terr.rev, terr.w * k, terr.h * k, cam.s < 1);
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

/** Two Stompers in front of the Footing while the fort walks, each second leg 3 frames later. */
function stompers(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, f: { x: number; y: number; w: number }, side: number, feel: Feel) {
  const c = anims.get(side === 0 ? 'stomper_blue_walk' : 'stomper_orange_walk');
  if (!c) return;
  const t = feel.walkTime(side);
  const k = cam.s * (16 / 30); // the whole leg fits the Footing row
  const by = sy(r, cam, f.y) - (30 - 4.57) * k;
  for (let i = 0; i < 2; i++) {
    const lx = sx(r, cam, f.x + f.w * (i ? 0.72 : 0.28));
    sprites.draw(ctx, frameAt(c, t + (i ? 3 * 110 : 0)), lx, by, k, side === 1);
  }
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

/** Snapshot marks on a block: the boss root, Battered under Fatigue, Ridgepole hold, Lean Lines. */
function blockMarks(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, b: BlockView, o: DrawOpts, fatigue: boolean) {
  if (b.root) {
    ctx.save();
    ctx.strokeStyle = '#4FE3C1';
    ctx.lineWidth = Math.max(2, s / 7);
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = '#2FB7A6';
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y + s * 0.2); ctx.lineTo(x + s * 0.75, y + s * 0.55); ctx.lineTo(x + s / 2, y + s * 0.85); ctx.lineTo(x + s * 0.25, y + s * 0.55);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (fatigue && b.battered && s > 4) {
    ctx.save();
    ctx.strokeStyle = '#E5484D';
    ctx.lineWidth = Math.max(1, s / 12);
    ctx.setLineDash([Math.max(2, s / 5), Math.max(2, s / 6)]);
    ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    ctx.restore();
  }
  if (b.held) {
    ctx.fillStyle = '#E0AE3E';
    ctx.fillRect(x + s * 0.1, y + s * 0.42, s * 0.8, Math.max(2, s * 0.16));
  }
  const l = o.lean;
  if (l && l.side === b.side) {
    const k = `${b.c},${b.r}`;
    const held = l.c === b.c && l.r === b.r;
    if (held || l.falls.has(k)) {
      ctx.fillStyle = held ? 'rgba(255,194,61,0.55)' : 'rgba(229,72,77,0.5)';
      ctx.fillRect(x, y, s, s);
    }
  }
}

/** Nooks: a Loophole Flap that is down (it rolls down and up in 4 frames), a Pot Lid, a broken Nook. */
function room(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, rm: RoomView, feel: Feel) {
  if (rm.loophole) {
    const lp = rm.loophole;
    const x = sx(r, cam, lp.x), y = sy(r, cam, lp.y + lp.h);
    const f = feel.flapSprite(rm);
    if (f && !sprites.draw(ctx, f, x, y, cam.s) && rm.flap) {
      ctx.fillStyle = TEAM[rm.side];
      ctx.fillRect(x, y, lp.w * cam.s, lp.h * cam.s);
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x, y, lp.w * cam.s, lp.h * cam.s);
    }
  }
  lid(ctx, r, cam, rm.x, rm.y + rm.h, rm.w, feel.lidSprite(rm.side * 1000 + rm.id, rm.lid));
  if (!rm.intact) {
    const x = sx(r, cam, rm.x), y = sy(r, cam, rm.y + rm.h);
    ctx.strokeStyle = 'rgba(43,30,46,0.6)';
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

/** Level objects: cage bars and the captive (1-7), the crock and the turnip. */
function prop(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PropView) {
  const x = sx(r, cam, p.x), y = sy(r, cam, p.y);
  if (x < r.x - 60 || x > r.x + r.w + 60 || y < r.y - 80 || y > r.y + r.h + 20) return;
  ctx.save();
  if (p.kind === 'cage_bar') {
    const w = Math.max(2, 5 * cam.s), hh = 44 * cam.s;
    ctx.fillStyle = p.hp < p.maxHp ? '#8C7C6E' : '#6B5F57';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, cam.s * 1.2);
    ctx.fillRect(x - w / 2, y - hh, w, hh);
    ctx.strokeRect(x - w / 2, y - hh, w, hh);
    ctx.fillStyle = '#E0AE3E';
    ctx.fillRect(x - w, y - hh - 2 * cam.s, w * 2, 3 * cam.s);
  } else if (p.kind === 'roller') {
    // Big Smoothie Jr.: a drum with a boiler; it greys out once its boiler is beaten.
    const rad = Math.max(6, 22 * cam.s);
    ctx.fillStyle = p.hp > 0 ? '#77716B' : '#A9A39A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, cam.s * 2);
    ctx.beginPath(); ctx.arc(x, y - rad, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.hp > 0 ? '#B9733A' : '#7A6A60';
    ctx.fillRect(x - rad * 0.5, y - rad * 2.6, rad, rad * 0.9); ctx.strokeRect(x - rad * 0.5, y - rad * 2.6, rad, rad * 0.9);
  } else if (p.kind === 'shears') {
    // The shears' hinge on the roof: two blades about a pin.
    const len = Math.max(8, 26 * cam.s);
    ctx.strokeStyle = p.hp > 0 ? '#47525C' : '#A9A39A';
    ctx.lineWidth = Math.max(2, 4 * cam.s);
    ctx.beginPath(); ctx.moveTo(x - len, y - len * 0.6); ctx.lineTo(x + len, y + len * 0.2); ctx.moveTo(x - len, y + len * 0.2); ctx.lineTo(x + len, y - len * 0.6); ctx.stroke();
    ctx.fillStyle = '#E0AE3E';
    ctx.beginPath(); ctx.arc(x, y - len * 0.2, Math.max(2, 4 * cam.s), 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'captive') {
    if (!sprites.draw(ctx, 'hob_hetty_blue_idle_0', x, y, cam.s * HOB_SCALE)) {
      ctx.fillStyle = '#2FB7A6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, cam.s);
      ctx.beginPath(); ctx.arc(x, y - 18 * cam.s, 8 * cam.s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(x - 6 * cam.s, y - 10 * cam.s, 12 * cam.s, 10 * cam.s);
    }
    if (p.hp < p.maxHp) {
      const s = Math.max(10, 24 * cam.s);
      ctx.fillStyle = INK;
      ctx.fillRect(x - s * 0.3, y + 2, s * 0.6, 4);
      ctx.fillStyle = TEAM[0];
      ctx.fillRect(x - s * 0.3 + 1, y + 3, (s * 0.6 - 2) * Math.max(0, p.hp / p.maxHp), 2);
    }
  } else {
    const rad = Math.max(3, 9 * cam.s);
    ctx.fillStyle = p.kind === 'turnip' ? '#C86FC9' : '#B9733A';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, cam.s * 1.5);
    ctx.beginPath(); ctx.arc(x, y - rad, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function kettle(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, k: KettleView, t: number, glow: boolean, feel: Feel) {
  if (sprites.has('kettle_full')) {
    const room = k.room ?? { x: k.x, y: k.y, w: k.size, h: k.size };
    sprites.draw(ctx, 'kettle_room', sx(r, cam, room.x), sy(r, cam, room.y + room.h), cam.s * (room.w / 32), false, glow ? 0.6 : 1);
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
    if (k.lid && k.room) lid(ctx, r, cam, k.room.x, k.room.y + k.room.h, k.room.w, feel.lidSprite(k.side * 1000 + 999, true));
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

function hob(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, h: HobView, picked: boolean, t: number, feel: Feel) {
  const s = Math.max(10, 24 * cam.s);
  const x = sx(r, cam, h.x), y = sy(r, cam, h.y);
  if (x < r.x - s || x > r.x + r.w + s || y < r.y - s * 3 || y > r.y + r.h + s) return;
  const frame = feel.hobSprite(h);
  const lift = feel.outDy * cam.s;
  if (frame && sprites.draw(ctx, frame, x, y - lift, cam.s * HOB_SCALE, h.side === 1)) {
    hobMarks(ctx, cam, h, picked, s, x, y);
  } else hobBody(ctx, r, cam, h, picked, t, false, s, x, y);
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
    ctx.lineWidth = 2;
    ctx.setLineDash(DASH_PICK);
    ctx.beginPath(); ctx.arc(x, y - 14 * cam.s, 16 * cam.s, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
  if (h.state === 'rest') sprites.draw(ctx, 'fx_rest_cog', x + 10 * cam.s, y - 30 * cam.s, Math.max(0.8, cam.s));
  if (!bonked && h.hp < h.maxHp) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - s * 0.3, y + 2, s * 0.6, 4);
    ctx.fillStyle = TEAM[h.side];
    ctx.fillRect(x - s * 0.3 + 1, y + 3, (s * 0.6 - 2) * (h.hp / h.maxHp), 2);
  }
}
const DASH_PICK = [4, 3];

function hobBody(ctx: CanvasRenderingContext2D, _r: Rect, _cam: Cam, h: HobView, picked: boolean, t: number, _firing: boolean, s: number, x: number, y: number) {
  const bonked = h.state === 'bonked';
  if (bonked) {
    // balloon floats up
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y - s * 1.3); ctx.stroke();
    ctx.fillStyle = TEAM_LIGHT[h.side];
    ctx.beginPath(); ctx.ellipse(x, y - s * 1.55, s * 0.25, s * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.5;
  }
  const bob = picked && !bonked ? Math.sin(t * 5) * s * 0.04 : 0;
  // body
  ctx.fillStyle = '#7D6B5D';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s / 14);
  roundRect(ctx, x - s * 0.28, y - s * 0.5 + bob, s * 0.56, s * 0.5, s * 0.12);
  ctx.fill(); ctx.stroke();
  // scarf
  ctx.fillStyle = TEAM[h.side];
  ctx.fillRect(x - s * 0.3, y - s * 0.55 + bob, s * 0.6, s * 0.1);
  // head
  ctx.fillStyle = SKIN[(h.id.length + h.name.length) % SKIN.length];
  ctx.beginPath(); ctx.arc(x, y - s * 0.72 + bob, s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // hat by Class
  ctx.fillStyle = HAT[h.cls] ?? '#888';
  ctx.beginPath(); ctx.arc(x, y - s * 0.82 + bob, s * 0.22, Math.PI, 0); ctx.fill(); ctx.stroke();
  if (h.side === 1) {
    ctx.fillStyle = TEAM[1];
    diamond(ctx, x, y - s * 0.92 + bob, s * 0.07); ctx.fill();
  }
  // eyes
  ctx.fillStyle = INK;
  const dir = h.side === 0 ? 1 : -1;
  ctx.fillRect(x + dir * s * 0.06, y - s * 0.74 + bob, Math.max(1, s * 0.05), Math.max(1, s * 0.06));
  ctx.globalAlpha = 1;
  if (picked && !bonked) {
    ctx.strokeStyle = '#FFC23D';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (h.state === 'rest') {
    ctx.fillStyle = '#4A3A4C';
    ctx.font = `700 ${Math.max(9, s * 0.35)}px Fredoka, sans-serif`;
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
    ctx.lineWidth = 2;
    ctx.font = '700 9px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    const label = roundLabel(p.round);
    ctx.strokeText(label, x + 9, y - 22);
    ctx.fillText(label, x + 9, y - 22);
    return;
  }
  const mine = p.side === 0;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
  ctx.fillStyle = p.spent ? '#FFF4DE' : TEAM[p.side];
  if (mine) { ctx.beginPath(); ctx.arc(x, y - 18, 6, 0, Math.PI * 2); }
  else diamond(ctx, x, y - 18, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.spent ? INK : '#fff';
  ctx.font = '700 8px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(roundLabel(p.round), x, y - 15);
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
export function drawStrip(ctx: CanvasRenderingContext2D, r: Rect, snap: Snapshot, terr: TerrainLayer, lenses: { rect: Rect; cam: Cam }[], nLenses: number, you: Side) {
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
    if (p.side === you) { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
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
