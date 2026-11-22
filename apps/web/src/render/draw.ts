// Canvas2D drawing of one lens (a viewport with a camera) from the snapshot.
import type { BlockView, HobView, KettleView, PinView, Side, Snapshot } from '../core/types';
import type { TerrainLayer } from './terrain';
import { hobSpriteName, sprites } from './sprites';

const HOB_SCALE = 0.4; // Hob frames are 72 x 80 at @1x; a Hob stands about 1.6 blocks tall
const KETTLE_SCALE = 0.72;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Cam { cx: number; cy: number; s: number }

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

export function toScreen(r: Rect, c: Cam, x: number, y: number): [number, number] {
  return [r.x + r.w / 2 + (x - c.cx) * c.s, r.y + r.h / 2 - (y - c.cy) * c.s];
}
export function toWorld(r: Rect, c: Cam, sx: number, sy: number): [number, number] {
  return [c.cx + (sx - r.x - r.w / 2) / c.s, c.cy - (sy - r.y - r.h / 2) / c.s];
}

export interface Fx {
  parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }[];
  texts: { x: number; y: number; text: string; life: number; max: number; big: boolean; color: string }[];
  shake: number;
  booms: { x: number; y: number; t: number; size: 'small' | 'medium' | 'large' }[];
}
export function newFx(): Fx { return { parts: [], texts: [], shake: 0, booms: [] }; }

export function stepFx(fx: Fx, dt: number): void {
  for (const p of fx.parts) { p.vy -= 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const t of fx.texts) { t.y += 30 * dt; t.life -= dt; }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  for (const b of fx.booms) b.t += dt;
  fx.booms = fx.booms.filter((b) => b.t < 0.4);
}

export interface DrawOpts {
  you: Side;
  seeThrough: Side | -1;
  pickedHob?: string;
  showPreview: boolean;
  time: number;
  reduceMotion: boolean;
  label?: string;
}

export function drawLens(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, snap: Snapshot, terr: TerrainLayer, fx: Fx, o: DrawOpts): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  // sky and far hills: sprites when loaded, plain shapes otherwise
  const sky = sprites.texture('bg_downs_sky@2x');
  if (sky) ctx.drawImage(sky, r.x, r.y, r.w, r.h);
  else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#9ED8EC');
    g.addColorStop(1, '#FFF1D0');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const [, baseY] = toScreen(r, cam, 0, 230);
  const far = sprites.texture('bg_downs_hills_far@2x');
  const near = sprites.texture('bg_downs_hills_near@2x');
  if (far && near) {
    for (const [img, par, k] of [[far, 0.2, 0.9], [near, 0.45, 0.7]] as [HTMLImageElement, number, number][]) {
      const hh = Math.max(60, Math.min(r.h * 0.6, 256 * Math.max(0.35, cam.s) * k));
      const ww = (img.width / img.height) * hh;
      const off = ((-(cam.cx * cam.s * par)) % ww + ww) % ww;
      const yb = Math.min(r.y + r.h, baseY + hh * 0.35);
      for (let x = r.x - ww + off; x < r.x + r.w; x += ww) ctx.drawImage(img, x, yb - hh, ww + 1, hh);
    }
  } else {
    ctx.fillStyle = '#B7DDA8';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    for (let sx = r.x; sx <= r.x + r.w + 8; sx += 8) {
      const wx = cam.cx * 0.5 + (sx - r.x) / Math.max(0.3, cam.s * 0.6);
      ctx.lineTo(sx, baseY - 30 * cam.s - 26 * Math.sin(wx / 180) * Math.min(1.5, cam.s + 0.3));
    }
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.fill();
  }
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 6; i++) {
    const wx = ((i * 431 + o.time * 6 * (snap.wind || 0.5)) % 2800) - 200;
    const [sx, sy] = toScreen(r, cam, wx, 560 + (i % 3) * 50);
    cloud(ctx, sx, sy, 18 * Math.max(0.5, cam.s));
  }
  const shake = o.reduceMotion ? 0 : fx.shake;
  const sx0 = shake ? (Math.random() - 0.5) * shake : 0;
  const sy0 = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(sx0, sy0);

  // terrain
  if (terr.w) {
    const [tx, ty] = toScreen(r, cam, 0, terr.h);
    ctx.imageSmoothingEnabled = cam.s < 1;
    ctx.drawImage(terr.canvas, tx, ty, terr.w * cam.s, terr.h * cam.s);
    // below the map floor and past its ends: plain loam, so no gap shows
    const [, floorY] = toScreen(r, cam, 0, 0);
    ctx.fillStyle = '#9A6440';
    if (floorY < r.y + r.h) ctx.fillRect(r.x, floorY - 1, r.w, r.y + r.h - floorY + 1);
  }

  // ghosts and pins under the forts
  const pickedPins = snap.pins.filter((p) => p.side === o.you && p.hob === o.pickedHob);
  const rivalPins = snap.pins.filter((p) => p.side !== o.you).slice(-2);
  pickedPins.forEach((p, i) => ghost(ctx, r, cam, p, i === pickedPins.length - 1 ? 0.4 : 0.2, i === pickedPins.length - 1 ? [10, 6] : [4, 6]));
  rivalPins.forEach((p) => ghost(ctx, r, cam, p, 0.3, [2, 4, 8, 4]));

  for (const b of snap.blocks) block(ctx, r, cam, b, o.seeThrough === b.side ? 0.55 : 1, o);
  for (const k of snap.kettles) kettle(ctx, r, cam, k, o.time, o.seeThrough === k.side);
  for (const hb of snap.hobs) hob(ctx, r, cam, hb, hb.id === o.pickedHob, o.time, snap.phase === 'flight' && snap.shells.some((x) => x.side === hb.side));
  for (const p of snap.pins) pin(ctx, r, cam, p, p.side === o.you);

  // preview arc (already cut to the preview share by the core)
  if (o.showPreview && snap.hud.preview.length > 1) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    const pts = snap.hud.preview;
    const step = Math.max(1, Math.round(8 / Math.max(0.3, cam.s * 3)));
    for (let i = 1; i < pts.length; i += step) {
      const [x, y] = toScreen(r, cam, pts[i][0], pts[i][1]);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, 4 * Math.min(1, cam.s * 1.2)), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // shells in flight
  for (const s of snap.shells) {
    const [x, y] = toScreen(r, cam, s.x, s.y);
    const rad = Math.max(3, 6 * cam.s);
    if (sprites.has(`shell_${s.kind}`)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(-s.vy, s.vx) * (s.kind === 'hatpin' || s.kind === 'nosy_goose' ? 1 : 0));
      sprites.draw(ctx, `shell_${s.kind}`, 0, 0, Math.max(0.6, cam.s));
      ctx.restore();
      continue;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = rad;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - s.vx * 0.03 * cam.s, y + s.vy * 0.03 * cam.s);
    ctx.stroke();
    ctx.fillStyle = s.kind === 'plain' ? '#3B3633' : '#6A5A7A';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFC23D';
    ctx.beginPath();
    ctx.arc(x + rad * 0.5, y - rad * 0.8, rad * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // effects
  for (const b of fx.booms) {
    const [x, y] = toScreen(r, cam, b.x, b.y);
    sprites.draw(ctx, `fx_boom_${b.size}_${Math.min(3, Math.floor(b.t / 0.1))}`, x, y, cam.s);
  }
  for (const p of fx.parts) {
    const [x, y] = toScreen(r, cam, p.x, p.y);
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    const sz = Math.max(1.5, p.size * cam.s);
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  for (const t of fx.texts) {
    const [x, y] = toScreen(r, cam, t.x, t.y);
    ctx.globalAlpha = Math.min(1, t.life / (t.max * 0.4));
    ctx.font = `700 ${t.big ? 26 : 16}px Fredoka, Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.strokeText(t.text, x, y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (o.label) {
    ctx.save();
    ctx.font = '600 11px Nunito, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(43,30,46,0.6)';
    ctx.fillText(o.label, r.x + 8, r.y + 14);
    ctx.restore();
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.arc(x + s, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
  ctx.arc(x - s, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function block(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, b: BlockView, alpha: number, o: DrawOpts) {
  const [x, y] = toScreen(r, cam, b.x, b.y + b.size);
  const s = b.size * cam.s;
  if (x > r.x + r.w || y > r.y + r.h || x + s < r.x || y + s < r.y) return;
  const st = b.hp >= b.maxHp * 0.75 ? 'fresh' : b.hp >= b.maxHp * 0.4 ? 'scuffed' : 'battered';
  if (sprites.draw(ctx, `block_${b.mat}_${st}`, x, y, cam.s, false, alpha)) {
    if (b.shimmer && !o.reduceMotion) sprites.draw(ctx, 'fx_shimmer', x, y, cam.s, false, 0.3 + 0.3 * Math.sin(o.time * 2));
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
      for (const f of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(x, y + s * f); ctx.lineTo(x + s, y + s * f); ctx.stroke(); }
    } else if (b.mat === 'wicker') {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(x + s * (0.2 + i * 0.3), y); ctx.lineTo(x + s * (0.05 + i * 0.3), y + s); }
      ctx.stroke();
    } else if (b.mat === 'cobble') {
      ctx.fillStyle = light;
      for (const [cx, cy] of [[0.3, 0.3], [0.72, 0.35], [0.5, 0.68]]) { ctx.beginPath(); ctx.arc(x + s * cx, y + s * cy, s * 0.17, 0, Math.PI * 2); ctx.fill(); }
    } else if (b.mat === 'footing') {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3); ctx.lineTo(x + s / 2, y + s * 0.6); ctx.lineTo(x + s, y + s * 0.3);
      ctx.stroke();
    }
  }
  if (b.hp < b.maxHp * 0.5 && s > 6) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s / 16);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.1); ctx.lineTo(x + s * 0.45, y + s * 0.45); ctx.lineTo(x + s * 0.35, y + s * 0.8);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s / 10);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (b.shimmer && !o.reduceMotion) {
    const t = (o.time % 3) / 3;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + s * t, y, s * 0.15, s);
  }
  ctx.globalAlpha = 1;
}

function kettle(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, k: KettleView, t: number, glow: boolean) {
  if (sprites.has('kettle_full')) {
    const [rx, ry] = toScreen(r, cam, k.x, k.y + k.size);
    sprites.draw(ctx, 'kettle_room', rx, ry, cam.s * (k.size / 32), false, glow ? 0.6 : 1);
    const pct = k.hp / k.maxHp;
    const [fx0, fy0] = toScreen(r, cam, k.x + k.size / 2, k.y);
    if (k.hp > 0) sprites.draw(ctx, 'kettle_halo', fx0, fy0 - 14 * cam.s, cam.s * (0.8 + 0.08 * Math.sin(t * 3)), false, 0.7);
    sprites.draw(ctx, `kettle_${k.hp <= 0 ? 'popped' : pct <= 0.25 ? 'critical' : pct <= 0.5 ? 'hurt' : 'full'}`, fx0 - 4 * cam.s * (k.side ? -1 : 1), fy0, cam.s * KETTLE_SCALE, k.side === 1);
    return;
  }
  const [x, y] = toScreen(r, cam, k.x + k.size / 2, k.y + k.size * 0.45);
  const s = k.size * cam.s;
  if (glow || k.hp > 0) {
    ctx.fillStyle = `rgba(79,227,193,${0.25 + 0.15 * Math.sin(t * 3)})`;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = k.hp > 0 ? '#D9773A' : '#7A6A60';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, s / 14);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.45, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#E0AE3E';
  ctx.fillRect(x - s * 0.45, y - s * 0.05, s * 0.9, s * 0.1);
  ctx.fillStyle = '#4FE3C1';
  ctx.beginPath();
  ctx.arc(x, y + s * 0.12, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // spout and lid knob
  ctx.fillStyle = '#D9773A';
  ctx.fillRect(x + (k.side === 0 ? s * 0.38 : -s * 0.58), y - s * 0.15, s * 0.2, s * 0.08);
  ctx.beginPath();
  ctx.arc(x, y - s * 0.4, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function hob(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, h: HobView, picked: boolean, t: number, firing = false) {
  const s = Math.max(10, 24 * cam.s);
  const [x, y] = toScreen(r, cam, h.x, h.y);
  if (x < r.x - s || x > r.x + r.w + s || y < r.y - s * 2 || y > r.y + r.h + s) return;
  const bonked = h.state === 'bonked';
  const team = h.side === 0 ? 'blue' : 'orange';
  const nm = hobSpriteName(h.id, h.cls);
  const pose = bonked ? `bonked_${Math.floor(t * 1.5) % 2}`
    : firing && picked ? `fire_${Math.floor(t * 6) % 2}`
    : h.hp < h.maxHp * 0.3 ? `hit_${Math.floor(t * 2) % 2}`
    : picked ? `aim_${Math.floor(t * 2) % 2}` : `idle_${Math.floor(t * 2 + h.x) % 3}`;
  if (sprites.draw(ctx, `hob_${nm}_${team}_${pose}`, x, y, cam.s * HOB_SCALE, h.side === 1)) {
    if (picked && !bonked) {
      ctx.strokeStyle = '#FFC23D';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(x, y - 14 * cam.s, 16 * cam.s, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (h.state === 'rest') sprites.draw(ctx, 'fx_rest_cog', x + 10 * cam.s, y - 30 * cam.s, Math.max(0.8, cam.s));
    if (!bonked && h.hp < h.maxHp) {
      ctx.fillStyle = INK;
      ctx.fillRect(x - s * 0.3, y + 2, s * 0.6, 4);
      ctx.fillStyle = TEAM[h.side];
      ctx.fillRect(x - s * 0.3 + 1, y + 3, (s * 0.6 - 2) * (h.hp / h.maxHp), 2);
    }
    return;
  }
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

function pin(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PinView, mine: boolean) {
  const [x, y] = toScreen(r, cam, p.x, p.y);
  if (x < r.x - 20 || x > r.x + r.w + 20 || y < r.y - 30 || y > r.y + r.h + 10) return;
  if (sprites.draw(ctx, p.side === 0 ? 'fx_pin_p1' : 'fx_pin_p2', x, y, 1.3, false, p.spent ? 0.45 : 1)) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.font = '700 9px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(String(p.round), x + 9, y - 22);
    ctx.fillText(String(p.round), x + 9, y - 22);
    void mine;
    return;
  }
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
  ctx.fillText(String(p.round), x, y - 15);
}

function ghost(ctx: CanvasRenderingContext2D, r: Rect, cam: Cam, p: PinView, alpha: number, dash: number[]) {
  if (p.path.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = TEAM[p.side];
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  p.path.forEach(([wx, wy], i) => { const [x, y] = toScreen(r, cam, wx, wy); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
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
export function drawStrip(ctx: CanvasRenderingContext2D, r: Rect, snap: Snapshot, terr: TerrainLayer, lenses: { rect: Rect; cam: Cam }[], you: Side) {
  ctx.save();
  ctx.fillStyle = '#FFF4DE';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const sx = r.w / Math.max(1, terr.w);
  const sy = (r.h - 6) / 500;
  ctx.fillStyle = '#7CC46A';
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h);
  for (let i = 0; i <= r.w; i += 2) {
    const wx = Math.min(terr.w - 1, Math.floor(i / sx));
    const top = terr.tops[wx] ?? 0;
    ctx.lineTo(r.x + i, r.y + r.h - Math.max(0, top - 120) * sy);
  }
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.fill();
  const wx = (x: number) => r.x + x * sx;
  const wy = (y: number) => r.y + r.h - Math.max(0, y - 120) * sy;
  snap.forts.forEach((f, i) => {
    ctx.fillStyle = TEAM[i];
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    if (i === 0) { ctx.fillRect(wx(f.x), wy(f.y + f.h) , Math.max(6, f.w * sx), Math.max(6, f.h * sy)); ctx.strokeRect(wx(f.x), wy(f.y + f.h), Math.max(6, f.w * sx), Math.max(6, f.h * sy)); }
    else { diamond(ctx, wx(f.x + f.w / 2), wy(f.y + f.h / 2), Math.max(5, f.h * sy * 0.6)); ctx.fill(); ctx.stroke(); }
  });
  for (const p of snap.pins.slice(-4)) {
    ctx.fillStyle = TEAM[p.side];
    if (p.side === you) { ctx.beginPath(); ctx.arc(wx(p.x), wy(p.y) - 4, 3, 0, Math.PI * 2); ctx.fill(); }
    else { diamond(ctx, wx(p.x), wy(p.y) - 4, 3.5); ctx.fill(); }
  }
  if (snap.hud.preview.length) {
    ctx.fillStyle = INK;
    snap.hud.preview.forEach(([x, y], i) => { if (i % 3 === 0) ctx.fillRect(wx(x) - 1, wy(y) - 1, 2, 2); });
  }
  for (const s of snap.shells) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(wx(s.x), Math.max(r.y + 3, wy(s.y)), 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(43,30,46,0.7)';
  ctx.lineWidth = 2;
  for (const l of lenses) {
    const half = l.rect.w / 2 / l.cam.s;
    const a = wx(l.cam.cx - half), b = wx(l.cam.cx + half);
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
