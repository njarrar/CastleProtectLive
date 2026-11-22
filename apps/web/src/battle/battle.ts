// The battle screen: canvas lenses, HUD in both layouts, aim input, camera, hand-off card.
// It never decides an outcome. It sends commands to the core and draws its snapshots.
import type { App, Route, Screen } from '../app';
import { bark, cue, loop, musicLayers, play, setMusic, slowmoAudio, stopLoops, unlockAudio } from '../audio/sfx';
import type { BattleSetup, Command, PinView, Side, Snapshot } from '../core/types';
import { SaveError, TICK_HZ } from '../core/types';
import { clearBattle, dropBattleSave, saveBattle } from '../save/db';
import { DEBUG } from '../ui/fatal';
import { CLASS_COLOR, CLASS_ICON, btn, h, repeatKey } from '../ui/dom';
import { type DrawOpts, LensCache, drawLens, drawStrip } from '../render/draw';
import { type Cam, type Rect, toScreen, toWorld } from '../render/view';
import { Feel } from '../render/feel';
import { firePress, handoffFlip, turnBanner } from '../ui/motion';
import { TerrainLayer } from '../render/terrain';
import { hobSpriteName, sprites } from '../render/sprites';

type LensId = 'wide' | 'top' | 'bottom' | 'joined' | 'strip';

interface Gesture {
  id: number;
  lens: LensId;
  mode: 'maybe-aim' | 'aim' | 'maybe-pan' | 'pan' | 'strip' | 'lean';
  x0: number;
  y0: number;
  x: number;
  y: number;
  prevAim?: { angle: number; power: number };
  t0: number;
}

export function battleScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'battle' }>;
  const setup: BattleSetup = r.setup;
  const core = app.core;
  // A save that is from another version, damaged, or replays to a different state is put
  // aside and the player lands on the map with a note (App.go turns the throw into that).
  try {
    if (r.resume) core.loadBattle(r.resume);
    else if (!r.prepared) core.newBattle(setup);
    else core.resendTerrain?.(); // the pre-battle sheet already read the first snapshot
  } catch (e) {
    console.error(e);
    if (r.resume) { void dropBattleSave(); throw new Error(e instanceof SaveError ? `${e.message} It was put aside.` : 'That saved fight could not be loaded. It was put aside.'); }
    throw new Error(`This fight cannot start: ${e instanceof Error ? e.message : String(e)}`);
  }
  app.lastSetup = setup;
  let snap = core.snapshot();
  if (snap.phase === 'draft') { core.command({ cmd: 'end_draft' }); snap = merge(snap, core.snapshot()); }

  const terr = new TerrainLayer();
  terr.apply(snap.terrain);
  sprites.whenLoaded(() => { const t = sprites.texture('terrain_soil'); if (t) terr.setSoil(t); });
  const feel = new Feel();
  feel.terr = terr;
  feel.sound = cue;
  feel.bark = bark;
  setMusic('battle');
  // Shell positions carried on between ticks: [id, x, y] per shell (no allocation per frame).
  const shellBuf = new Float64Array(3 * 16);
  let nShell = 0;
  const canvas = h('canvas', { class: 'field', 'aria-label': 'Battle field' });
  const ctx = canvas.getContext('2d')!;
  const root = h('div', { class: 'battle' }, canvas);
  let crashed = false;
  const hud = h('div', { class: 'hud' });
  root.append(hud);

  // ---------- HUD parts ----------
  const kettleEl: [HTMLElement, HTMLElement] = [h('div', { class: 'kettle side0' }), h('div', { class: 'kettle side1' })];
  const pipsEl: [HTMLElement, HTMLElement] = [h('div', { class: 'pips side0' }), h('div', { class: 'pips side1' })];
  const roundEl = h('div', { class: 'round' });
  // One status line per event for screen readers (the canvas has no text of its own).
  const liveEl = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  let liveT = 0;
  const say = (text: string) => { clearTimeout(liveT); liveT = window.setTimeout(() => { liveEl.textContent = text; }, 50); };
  const windEl = h('div', { class: 'wind' });
  const top = h('div', { class: 'topstrip' });
  const pause = btn('II', () => openPause(), 'pause round-btn', { 'aria-label': 'Pause', 'data-key': 'Esc' });
  const saveTick = h('span', { class: 'savetick', 'aria-hidden': 'true' }, '✎');
  const hobsEl = h('div', { class: 'hobs', role: 'group', 'aria-label': 'Crew' });
  const steamBar = h('div', { class: 'steam' }, h('i'), h('b'));
  const walkL = h('button', { class: 'btn key walkbtn', type: 'button', 'aria-label': 'Walk left' }, '◀');
  const walkR = h('button', { class: 'btn key walkbtn', type: 'button', 'aria-label': 'Walk right' }, '▶');
  const walkEl = h('div', { class: 'walk' }, steamBar, h('div', { class: 'walkkeys' }, walkL, walkR));
  const trayEl = h('div', { class: 'tray', role: 'group', 'aria-label': 'Shots' });
  const readout = btn('--', () => { padOpen = true; padNudge(); }, 'readout silent', { 'aria-label': 'Aim readout' });
  const nudge = (da: number, dp: number) => {
    const a = snap.hud.aim ?? { angle: 450, power: 50 };
    send({ cmd: 'aim', angle: clamp(a.angle + da, 0, 1800), power: clamp(a.power + dp, 0, 100) });
    padNudge();
    play('tap');
  };
  const up = () => (snap.hud.you === 0 ? 1 : -1);
  const pad = h('div', { class: 'finetune' },
    repeatKey('Ang \u25B2', () => nudge(up(), 0), 'k-ang-up', { 'aria-label': 'Angle up' }),
    repeatKey('Ang \u25BC', () => nudge(-up(), 0), 'k-ang-down', { 'aria-label': 'Angle down' }),
    btn('R', () => recallStep(), 'key k-recall', { 'aria-label': 'Recall' }),
    repeatKey('Pow +', () => nudge(0, 1), 'k-pow-up', { 'aria-label': 'Power up' }),
    repeatKey('Pow \u2212', () => nudge(0, -1), 'k-pow-down', { 'aria-label': 'Power down' }),
  );
  const aimCluster = h('div', { class: 'aimcluster' }, pad, readout);
  const fire = h('button', { class: 'btn fire', type: 'button', 'aria-label': 'Fire', 'data-testid': 'fire' }, 'FIRE');
  const reframe = btn('⌖', () => { manual = false; topManual = false; }, 'reframe round-btn', { 'aria-label': 'Re-frame' });
  const banner = h('div', { class: 'banner', role: 'status' });
  const prompt = h('div', { class: 'prompt' });
  const hand = h('div', { class: 'ghosthand', 'aria-hidden': 'true' });
  const lensTop = h('div', { class: 'lens-top' });
  const strip = h('div', { class: 'strip' });
  const lensBottom = h('div', { class: 'lens-bottom' });
  const floatsL = h('div', { class: 'floats-l' });
  const floatsR = h('div', { class: 'floats-r' });
  const crewRow = h('div', { class: 'crewrow' });
  const dock = h('div', { class: 'dockplate' });
  const overlay = h('div', { class: 'overlay-layer' });
  let yardBar: HTMLElement | null = null;
  if (setup.mode === 'yard') {
    // The wind slider only where the core takes a wind command (the real core does not yet).
    let windCtl: HTMLElement | string = '';
    if (core.features.setWind) {
      const slider = h('input', { type: 'range', min: -10, max: 10, step: 1, value: 0, 'aria-label': 'Wind' }) as HTMLInputElement;
      const lab = h('span', {}, 'Wind 0');
      slider.addEventListener('input', () => { send({ cmd: 'set_wind', wind: Number(slider.value) }); lab.textContent = `Wind ${slider.value}`; });
      windCtl = h('span', { class: 'row' }, lab, slider);
    }
    yardBar = h('div', { class: 'yardbar' }, btn('Back', () => app.go(app.progress.blueprint ? { to: 'workshop' } : { to: 'map' }), 'small'), windCtl);
  }

  // ---------- layout ----------
  let layout: 'wide' | 'tall' = app.layout;
  function relayout(): void {
    layout = app.layout;
    hud.className = `hud ${layout}`;
    // Turning the device ends a drag as if the finger lifted: the aim so far is kept (07 §2.6).
    if (drag?.mode === 'aim') endDrag('keep');
    top.replaceChildren(
      layout === 'wide' ? pause : '',
      kettleEl[0], pipsEl[0], roundEl, windEl, pipsEl[1], kettleEl[1], saveTick,
    );
    if (layout === 'wide') {
      hud.replaceChildren(top, hobsEl, walkEl, trayEl, aimCluster, fire, reframe, banner, prompt, hand, overlay);
      if (yardBar) hud.append(yardBar);
    } else {
      floatsL.replaceChildren(pause, walkEl);
      floatsR.replaceChildren(aimCluster);
      lensBottom.replaceChildren(floatsL, floatsR, banner);
      crewRow.replaceChildren(hobsEl, fire);
      dock.replaceChildren(trayEl, crewRow);
      hud.replaceChildren(top, lensTop, strip, lensBottom, dock, reframe, prompt, hand, overlay);
      if (yardBar) lensTop.replaceChildren(yardBar);
    }
    resize();
    rectsDirty = true;
    snapCams = true;
  }

  // ---------- canvas sizing ----------
  let W = 0, H = 0, dpr = 1;
  // Adaptive resolution: if frames run long (a slow phone, a software canvas), the field draws
  // at fewer pixels per point, down to 1; it steps back up when there is room again.
  let dprCap = 2;
  let slowFrames = 0, fastFrames = 0;
  function adaptRes(dtMs: number): void {
    if (dtMs > 22) { slowFrames++; fastFrames = 0; } else if (dtMs < 17.5) { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
    const full = Math.min(2, window.devicePixelRatio || 1);
    if (slowFrames > 20 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); slowFrames = 0; resize(); }
    else if (fastFrames > 240 && dprCap < full) { dprCap = Math.min(full, dprCap + 0.5); fastFrames = 0; resize(); }
  }
  function resize(): void {
    dpr = Math.min(2, dprCap, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  const readRect = (el: HTMLElement): Rect => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  // Layout is read once after it changes (relayout, a new crew or tray), never every frame.
  let rectsDirty = true;
  const z = (): Rect => ({ x: 0, y: 0, w: 0, h: 0 });
  const rc: Record<'top' | 'bottom' | 'strip' | 'clear' | 'fire', Rect> = { top: z(), bottom: z(), strip: z(), clear: z(), fire: z() };
  function readRects(): void {
    if (!rectsDirty) return;
    rectsDirty = false;
    if (layout === 'tall') { rc.top = readRect(lensTop); rc.bottom = readRect(lensBottom); rc.strip = readRect(strip); }
    const t = top.getBoundingClientRect().bottom;
    const tr = trayEl.getBoundingClientRect(), fr = fire.getBoundingClientRect();
    const bottom = Math.min(tr.height ? tr.top : H, fr.height ? fr.top : H) - 4;
    const left = hobsEl.getBoundingClientRect().right + 4;
    rc.clear = { x: left, y: t, w: Math.max(100, W - left - 8), h: Math.max(80, bottom - t) };
    rc.fire = { x: fr.left, y: fr.top, w: fr.width, h: fr.height };
  }
  const rectOf = (el: HTMLElement): Rect => (el === lensTop ? rc.top : el === lensBottom ? rc.bottom : el === strip ? rc.strip : el === fire ? rc.fire : readRect(el));
  function clearRect(): Rect { return rc.clear; }

  // ---------- cameras ----------
  const camWide: Cam = { cx: 800, cy: 300, s: 0.4 };
  const camTop: Cam = { cx: 1800, cy: 300, s: 0.75 };
  const camBottom: Cam = { cx: 600, cy: 300, s: 1 };
  const camJoin: Cam = { cx: 1200, cy: 300, s: 0.5 };
  let manual = false;
  let topManual = false;
  let zoomWide = 1;
  let zoomTop = 1;
  let snapCams = true;
  let holdUntil = 0;
  let lastShell: [number, number] | null = null;
  let joined = false;
  let wideLook = false;

  const youSide = (): Side => {
    if (setup.mode === 'duel') return snap.hud.active;
    return 0;
  };
  const other = (s: Side): Side => (s === 0 ? 1 : 0);

  function frameBox(rc: Rect, x0: number, x1: number, y0: number, y1: number, minS: number, maxS: number): Cam {
    const s = clamp(Math.min(rc.w / (x1 - x0), rc.h / (y1 - y0)), minS, maxS);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
  }
  function toFull(full: Rect, part: Rect, c: Cam): Cam {
    const dx = full.x + full.w / 2 - (part.x + part.w / 2);
    const dy = full.y + full.h / 2 - (part.y + part.h / 2);
    return { cx: c.cx + dx / c.s, cy: c.cy - dy / c.s, s: c.s };
  }
  function ease(c: Cam, t: Cam, dt: number, cut: boolean, rate = 5): void {
    const k = cut || snapCams ? 1 : 1 - Math.exp(-dt * rate);
    c.cx += (t.cx - c.cx) * k;
    c.cy += (t.cy - c.cy) * k;
    c.s += (t.s - c.s) * k;
    // Settle exactly, so a still camera is still (the backdrop cache keys on it).
    if (Math.abs(t.s - c.s) < 0.002 * t.s) c.s = t.s;
    if (Math.abs(t.cx - c.cx) < 0.05 && Math.abs(t.cy - c.cy) < 0.05) { c.cx = t.cx; c.cy = t.cy; }
  }

  // ---------- Wide camera (07 §3.5) ----------
  // Blocks never draw under 8 px (zoom floor): on a phone the play view frames your fort plus
  // the arc toward the target, follows the shell with a dead zone, holds on the impact for
  // 0.6 s, widens to show the collapse settle, then eases to the next side's frame.
  const FLOOR = 0.5;
  const ZMAX = 1.25;
  let wideRate = 5;
  let wideCut = false;
  let rmFrame: 'from' | 'to' = 'from';
  const camT: Cam = { cx: 0, cy: 0, s: 1 };
  /** Plan frame for a side: both forts when they fit at the floor, else this fort and the way to the other. */
  function planFrame(cr: Rect, side: Side, out: Cam): Cam {
    const f = snap.forts;
    const fa = f[side], fo = f[other(side)];
    const x0 = Math.min(fa.x, fo.x) - 60, x1 = Math.max(fa.x + fa.w, fo.x + fo.w) + 60;
    const y0 = Math.min(fa.y, fo.y) - 30, y1 = Math.max(fa.y + fa.h, fo.y + fo.h) + 170;
    const both = Math.min(cr.w / (x1 - x0), cr.h / (y1 - y0));
    const dir = fo.x > fa.x ? 1 : -1;
    // Both forts only when they still draw big (blocks 12 px or more); else this fort and its arc.
    if (both >= 0.75) {
      out.s = Math.min(both, ZMAX);
      // 55/45 toward the rival (07 §3.5); a Couch Duel stays centred.
      out.cx = (x0 + x1) / 2 + (setup.mode === 'duel' ? 0 : dir * (x1 - x0) * 0.05);
    } else {
      out.s = clamp(Math.min(cr.h / (fa.h + 190), (cr.w * 0.4) / (fa.w + 60)), FLOOR, 1);
      const half = cr.w / 2 / out.s;
      out.cx = dir > 0 ? fa.x - 40 + half : fa.x + fa.w + 40 - half;
    }
    groundY(cr, Math.min(fa.y, fo.y), out);
    return out;
  }
  /** Spare height goes to the sky, not the soil: the ground under the forts sits near the bottom. */
  function groundY(cr: Rect, base: number, out: Cam): void { out.cy = base + cr.h / 2 / out.s - 40 / out.s; }
  /** The hit fort with room for its collapse. */
  function settleFrame(cr: Rect, x: number, out: Cam): Cam {
    const f = snap.forts;
    const fo = Math.abs(f[0].x + f[0].w / 2 - x) < Math.abs(f[1].x + f[1].w / 2 - x) ? f[0] : f[1];
    out.s = clamp(Math.min(cr.w / (fo.w + 360), cr.h / (fo.h + 200)), FLOOR, 1);
    out.cx = (fo.x + fo.w / 2 + x) / 2;
    groundY(cr, fo.y, out);
    return out;
  }
  let shellVX = 0, shellVY = 0;
  function wideTarget(cr: Rect, _now: number, rm: boolean): Cam | null {
    const sh = snap.shells[0];
    const t = camT;
    const sinceHit = feel.time - feel.impactAt;
    if (sh) {
      const sx0 = nShell ? shellBuf[1] : sh.x, sy0 = nShell ? shellBuf[2] : sh.y;
      manual = false;
      const fromSide = snap.hud.active;
      if (rm) {
        // Reduce motion: a wide fixed frame per half of the flight, joined by cuts.
        const mid = (snap.forts[0].x + snap.forts[0].w / 2 + snap.forts[1].x + snap.forts[1].w / 2) / 2;
        const half = (sx0 - mid) * (snap.forts[fromSide].x < mid ? 1 : -1) > 0 ? 'to' : 'from';
        if (half !== rmFrame) { rmFrame = half; wideCut = true; }
        return planFrame(cr, half === 'to' ? other(fromSide) : fromSide, t);
      }
      planFrame(cr, fromSide, t);
      // Follow with lookahead; the middle 30% is a dead zone; never under the floor.
      const s = clamp(t.s, FLOOR, 1); // the plan scale: no zoom jump at Fire
      const lookX = sx0 + shellVX * 0.35, lookY = sy0 + shellVY * 0.2;
      const dz = (0.15 * cr.w) / s;
      const prev = (camWide.cx - (0 - (cr.x + cr.w / 2 - W / 2)) / camWide.s);
      let cx = camFollowX ?? prev;
      if (lookX > cx + dz) cx = lookX - dz; else if (lookX < cx - dz) cx = lookX + dz;
      camFollowX = cx;
      t.s = s;
      t.cx = cx;
      groundY(cr, Math.min(snap.forts[0].y, snap.forts[1].y), t);
      // A high shell pulls the frame up so it stays in the top 80%.
      const top = t.cy + (cr.h / 2) / s;
      if (lookY > top - (0.2 * cr.h) / s) t.cy += lookY - (top - (0.2 * cr.h) / s);
      wideRate = 7;
    } else if (sinceHit < 600) {
      // Impact: hold on the hit.
      camFollowX = null;
      t.cx = feel.impactX; t.s = clamp(camWide.s, FLOOR, ZMAX);
      groundY(cr, Math.min(snap.forts[0].y, snap.forts[1].y), t);
      wideRate = 6;
    } else if (feel.col.busy || feel.time < feel.collapseUntil || (snap.phase === 'resolve' && sinceHit < 2500)) {
      settleFrame(cr, feel.impactX, t);
      wideRate = 3;
    } else {
      camFollowX = null;
      rmFrame = 'from';
      if (manual) return null;
      planFrame(cr, snap.hud.active, t);
      wideRate = 6;
    }
    // Slow-mo push-in (Kettle Pop, Clean Sweep, Threaded!); none with Reduce motion.
    if (feel.juice.focusOn && !rm) {
      t.s = Math.min(1.6, t.s * feel.juice.focusZoom);
      t.cx = feel.juice.focusX;
      t.cy = Math.max(feel.juice.focusY, t.cy - (cr.h * 0.25) / t.s);
      wideRate = 8;
    }
    t.s *= zoomWide;
    // Pan limits: the map edge plus a little slack, so the view never shows past the map.
    const mw = terr.w || snap.terrain.width;
    const half = cr.w / 2 / t.s, slack = 40;
    if (mw > 0) t.cx = 2 * half > mw ? mw / 2 : clamp(t.cx, half - slack, mw - half + slack);
    return t;
  }
  let camFollowX: number | null = null;

  function updateCams(dt: number, now: number): void {
    const f = snap.forts;
    const rm = app.settings.reduceMotion;
    const sh = snap.shells[0];
    if (sh) { lastShell = [sh.x, sh.y]; holdUntil = now + 600; }
    const following = !!sh || now < holdUntil;
    const full: Rect = { x: 0, y: 0, w: W, h: H };
    if (layout === 'wide') {
      const cr = clearRect();
      const t = wideTarget(cr, now, rm);
      if (!t) return;
      ease(camWide, toFull(full, cr, t), dt, rm || wideCut, wideRate);
      wideCut = false;
      return;
    }
    // Tall: Bottom lens on your fort, Top lens on the target fort; joined in flight.
    const rt = rectOf(lensTop), rb = rectOf(lensBottom);
    const vw = rb.w;
    const bs = clamp((16 * vw) / 390, 12, 24) / 16;
    const ts = clamp((12 * vw) / 390, 10, 20) / 16;
    const me = youSide();
    const fm = f[me], ft = f[other(me)];
    const sideX = (side: Side, rc: Rect, s: number, fo: typeof fm) =>
      fo.x + fo.w / 2 + (side === 0 ? 1 : -1) * (0.5 - 0.27) * (rc.w / s);
    ease(camBottom, { cx: sideX(me, rb, bs, fm), cy: fm.y + (0.5 - 0.2) * (rb.h / bs), s: bs }, dt, rm);
    if (wideLook) {
      const t = frameBox(rt, Math.min(f[0].x, f[1].x) - 80, Math.max(f[0].x + f[0].w, f[1].x + f[1].w) + 80, Math.min(f[0].y, f[1].y) - 40, Math.max(f[0].y + f[0].h, f[1].y + f[1].h) + 120, 0.05, 2);
      ease(camTop, t, dt, rm);
    } else if (!topManual) {
      ease(camTop, { cx: ft.x + ft.w / 2, cy: ft.y + (0.5 - 0.25) * (rt.h / (ts * zoomTop)), s: ts * zoomTop }, dt, rm);
    }
    joined = following && !rm;
    if (joined && lastShell) {
      const rj: Rect = { x: rt.x, y: rt.y, w: rt.w, h: rb.y + rb.h - rt.y };
      // 8 pt blocks at the top of the arc, easing in to 12 pt as the shell comes down (07 §2.6.3).
      const ground = Math.min(f[0].y, f[1].y);
      const k = clamp((lastShell[1] - ground) / 420, 0, 1);
      const s = (clamp((8 * vw) / 390, 6, 14) / 16) * (1.5 - 0.5 * k);
      // The ground sits a quarter up the joined lens (the Field Strip covers its foot).
      const lowY = ground + (rj.h / s) * 0.25;
      const t: Cam = { cx: lastShell[0], cy: Math.max(lowY, lastShell[1] - (rj.h / s) * 0.1), s };
      if (!wasJoined) { camJoin.cx = camBottom.cx; camJoin.cy = camBottom.cy + (rt.h / 2) / camBottom.s; camJoin.s = camBottom.s; }
      ease(camJoin, t, dt, false);
    }
    wasJoined = joined;
  }
  let wasJoined = false;

  // The lens list is rebuilt in place each frame (no new arrays or rects in the frame loop).
  type Lens = { id: LensId; rect: Rect; cam: Cam };
  const LW: Lens[] = [{ id: 'wide', rect: z(), cam: camWide }];
  const LJ: Lens[] = [{ id: 'joined', rect: z(), cam: camJoin }];
  const LT: Lens[] = [{ id: 'top', rect: rc.top, cam: camTop }, { id: 'strip', rect: rc.strip, cam: camTop }, { id: 'bottom', rect: rc.bottom, cam: camBottom }];
  function lensRects(): Lens[] {
    if (layout === 'wide') { const r0 = LW[0].rect; r0.w = W; r0.h = H; return LW; }
    const rt = rectOf(lensTop), rb = rectOf(lensBottom);
    LT[0].rect = rt; LT[1].rect = rectOf(strip); LT[2].rect = rb;
    if (joined) { const r0 = LJ[0].rect; r0.x = rt.x; r0.y = rt.y; r0.w = rt.w; r0.h = rb.y + rb.h - rt.y; return LJ; }
    return LT;
  }

  // ---------- commands ----------
  function send(c: Command): boolean {
    const res = core.command(c);
    lastRefusal = res.ok ? '' : res.error ?? '';
    return res.ok;
  }
  let lastRefusal = '';
  // Aim Drag: keep only the newest aim and send it once per frame (and on release), so a 120 Hz
  // touch screen does not send 120 logged aim commands and snapshots a second.
  let pendingAim: { angle: number; power: number } | null = null;
  function flushAim(): void {
    if (!pendingAim) return;
    const a = snap.hud.aim;
    const p = pendingAim;
    pendingAim = null;
    if (!a || a.angle !== p.angle || a.power !== p.power) { send({ cmd: 'aim', ...p }); snap = merge(snap, core.snapshot()); }
  }

  // ---------- frame loop ----------
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let fast = false;
  let alive = true;
  let ended = false;
  let turnHits = { blocks: 0, dmg: 0, who: '' };
  let missCount = 0;
  let handoffOpen = false;
  let paused = false;
  const startT = performance.now();

  let lastN = 1;
  const prevShell = new Map<number, [number, number]>();
  function frame(now: number): void {
    if (!alive || crashed) return;
    try {
      tick(now);
      raf = requestAnimationFrame(frame);
    } catch (e) {
      crash(e);
    }
  }
  function tick(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    if (!paused && !handoffOpen && document.visibilityState === 'visible') adaptRes(now - last);
    last = now;
    readRects();
    flushAim();
    // Hit stop and slow motion scale view time; the fixed-step sim is stepped in view time,
    // so it freezes and slows with the view and its ticks never change (07 §6.1, §6.4).
    const running = !paused && !handoffOpen;
    const calm = snap.phase === 'plan' || drag?.mode === 'aim';
    const lw = lensRects()[0];
    feel.reduceMotion = app.settings.reduceMotion;
    feel.juice.shakeScale = app.settings.reduceShake / 100;
    feel.juice.fast = fast;
    feel.you = youSide();
    const vs = feel.update(running ? dt * 1000 : 0, snap, calm, lw.cam.cx, lw.cam.cy, lw.rect.w / lw.cam.s, shellBuf, nShell);
    slowmoAudio(feel.juice.slowing !== null);
    sounds();
    if (running) {
      // "Rival turns at 2x" speeds up the whole Rival turn: think pose and flight.
      const rivalTurn = !snap.sides[snap.hud.active].human && setup.mode !== 'yard';
      acc += dt * vs * TICK_HZ * (fast ? 2 : 1) * (rivalTurn && app.settings.rivalFast ? 2 : 1);
      const n = Math.floor(acc);
      acc -= n;
      if (n > 0) {
        prevShell.clear();
        for (const sh of snap.shells) prevShell.set(sh.id, [sh.x, sh.y]);
        lastN = n;
        core.step(n);
        snap = merge(snap, core.snapshot());
      }
    } else {
      snap = merge(snap, core.snapshot());
    }
    terr.apply(snap.terrain);
    snap.terrain.chunks = [];
    handleEvents(now);
    carryShells();
    updateCams(dt, now);
    snapCams = false;
    render(now);
    updateHud(now);
  }

  /** A throw in the frame loop (a wasm trap, a draw bug): stop the loop and offer a way out. */
  function crash(e: unknown): void {
    if (crashed) return;
    crashed = true;
    alive = false;
    cancelAnimationFrame(raf);
    console.error(e);
    card('crash-card', 'crash-h',
      h('h2', { id: 'crash-h' }, 'The fight got stuck'),
      h('p', {}, 'Something went wrong in this fight. Your last turn is saved.'),
      btn('Retry', () => { closeCards(); app.go({ to: 'battle', setup }); }, 'primary', { 'data-autofocus': true, 'data-testid': 'crash-retry' }),
      btn('Map', () => { closeCards(); app.go({ to: 'map' }); }, 'secondary'),
    );
  }

  /** Loops and music layers from what the snapshot shows (assets/audio/README.md). */
  function sounds(): void {
    let lowK = 1;
    for (const k of snap.kettles) if (k.hp > 0) lowK = Math.min(lowK, k.hp / k.maxHp);
    // A Heartkettle at 50% or less whistles, higher as HP drops (up to 3 semitones).
    loop('ket_whistle_loop', lowK <= 0.5 && !ended ? 0.8 : 0, Math.round((0.5 - Math.min(0.5, lowK)) * 6));
    loop('wx_wind_loop', ended ? 0 : Math.min(1, Math.abs(snap.wind) / 10) * 0.7);
    loop('wx_squall_loop', snap.squall.on && !ended ? Math.min(1, 0.5 + 0.15 * snap.squall.on) : 0);
    const sh = snap.shells[0];
    loop('fly_whistle_loop', sh && !paused ? 0.5 : 0, sh ? Math.round(clamp((sh.y - snap.forts[0].y) / 60 - 7, -7, 7)) : 0);
    let fewest = 9;
    for (let side = 0; side < 2; side++) {
      let n = 0;
      for (const hb of snap.hobs) if (hb.side === side && hb.state !== 'bonked') n++;
      fewest = Math.min(fewest, n);
    }
    const sq = snap.squall;
    musicLayers(lowK <= 0.5 || fewest <= 2 || (sq.warn > 0 && sq.warn <= 3), fewest <= 1 || lowK <= 0.25 || sq.on > 0);
  }

  /** Between ticks the shell is carried on by the part of a tick that has passed (smooth on 90 and 144 Hz). */
  function carryShells(): void {
    nShell = Math.min(16, snap.shells.length);
    const k = paused || handoffOpen ? 0 : Math.min(1, acc) / Math.max(1, lastN);
    for (let i = 0; i < nShell; i++) {
      const sh = snap.shells[i];
      const p = prevShell.get(sh.id);
      shellBuf[i * 3] = sh.id;
      shellBuf[i * 3 + 1] = p ? sh.x + (sh.x - p[0]) * k : sh.x;
      shellBuf[i * 3 + 2] = p ? sh.y + (sh.y - p[1]) * k : sh.y;
      if (i === 0 && p) { shellVX = ((sh.x - p[0]) / Math.max(1, lastN)) * TICK_HZ; shellVY = ((sh.y - p[1]) / Math.max(1, lastN)) * TICK_HZ; }
    }
  }
  const opts: DrawOpts = { you: 0, seeThrough: -1, showPreview: false, time: 0, reduceMotion: false, cssSky: false, dpr: 1, shells: shellBuf, nShells: 0 };
  // Wide layout: the sky art as the canvas background, sized like the old draw (cover, pinned to the top).
  let skySet = '';
  function skyCss(): boolean {
    const src = sprites.textureUrl('bg_downs_sky');
    if (!src) return false;
    if (skySet !== src) { skySet = src; canvas.style.background = `#9ED8EC url("${src}") center top / cover no-repeat`; }
    return true;
  }
  const caches: Record<string, LensCache> = { wide: new LensCache(), top: new LensCache(), bottom: new LensCache(), joined: new LensCache() };
  const stripRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  const stripLenses: { rect: Rect; cam: Cam }[] = [{ rect: rc.top, cam: camTop }, { rect: rc.bottom, cam: camBottom }];

  function render(now: number): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The wide lens covers the whole canvas; only the tall layout has gaps between lenses.
    if (layout === 'tall') { ctx.fillStyle = '#9ED8EC'; ctx.fillRect(0, 0, W, H); }
    const me = youSide();
    const human = snap.sides[snap.hud.active].human || setup.mode === 'yard';
    const plan = snap.phase === 'plan' && human;
    const lenses = lensRects();
    opts.you = me; opts.seeThrough = plan ? snap.hud.active : -1; opts.pickedHob = plan ? snap.hud.hob : undefined;
    opts.showPreview = plan; opts.time = (now - startT) / 1000; opts.reduceMotion = app.settings.reduceMotion; opts.lean = lean ?? undefined;
    opts.nShells = nShell;
    opts.dpr = dpr;
    opts.cssSky = layout === 'wide' && skyCss();
    for (const l of lenses) {
      if (l.id === 'strip') continue;
      drawLens(ctx, l.rect, l.cam, snap, terr, feel, opts, caches[l.id]);
    }
    if (layout === 'tall') {
      if (joined) { stripRect.x = rc.strip.x; stripRect.w = rc.strip.w; stripRect.h = rc.strip.h; stripRect.y = rc.bottom.y + rc.bottom.h - 34; stripLenses[0].rect = lenses[0].rect; stripLenses[0].cam = camJoin; }
      else { stripLenses[0].rect = rc.top; stripLenses[0].cam = camTop; stripLenses[1].rect = rc.bottom; }
      drawStrip(ctx, joined ? stripRect : rc.strip, snap, terr, stripLenses, joined ? 1 : 2, me);
    }
    if (drag && drag.mode === 'aim') {
      ctx.save();
      ctx.strokeStyle = app.settings.quickFire && dist(drag) > 12 ? '#E5484D' : 'rgba(43,30,46,0.7)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(drag.x0, drag.y0);
      ctx.lineTo(drag.x, drag.y);
      ctx.stroke();
      ctx.fillStyle = '#FFF4DE';
      ctx.beginPath(); ctx.arc(drag.x0, drag.y0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- events -> feel (effects, numbers, shake, sound), banners, save ----------
  function handleEvents(now: number): void {
    const l = lensRects()[0];
    const vw = l.rect.w / l.cam.s;
    for (const e of snap.events) {
      feel.onEvent(e, snap, l.cam.cx, vw);
      switch (e.t) {
        case 'fire': turnHits = { blocks: 0, dmg: 0, who: snap.sides[e.side].name }; say(`${snap.sides[e.side].name} fired`); break;
        case 'note':
          if (e.x === undefined || e.y === undefined) showBanner(e.text, 'slate');
          if (e.sound) play(e.sound as Parameters<typeof play>[0]);
          if (e.status) say(e.text);
          break;
        case 'hit':
          if (e.dmg > 0) say(`Hit ${e.what}, ${e.dmg} damage`); else say('Missed');
          if (e.dmg > 0) turnHits.dmg += e.dmg; else missCount++;
          break;
        case 'break': turnHits.blocks++; break;
        case 'collapse': turnHits.blocks += e.blocks.length; break;
        case 'kettle_pop': say(`${snap.sides[e.side].name}'s kettle popped`); break;
        case 'squall_warn': if (e.left === 3) showBanner('Squall in 3', 'slate'); break;
        case 'squall': if (e.n === 1) showBanner('Sudden Squall', 'slate'); break;
        case 'turn': onTurn(e.side, e.round, now); break;
        case 'end': onEnd(); break;
      }
    }
    if (snap.events.length) feel.endBatch();
    snap.events.length = 0;
  }

  let turnCount = 0;
  function onTurn(side: Side, round: number, _now: number): void {
    turnCount++;
    fast = false;
    padOpen = false;
    const human = snap.sides[side].human || setup.mode === 'yard';
    if (setup.mode === 'duel') {
      showTurnBanner(`${snap.sides[side].name}'s turn`, side === 0 ? 'blue' : 'orange');
      play(side === 0 ? 'turn' : 'turn2');
      if (turnCount > 1 && setup.seats !== 'one') openHandoff(side, round);
    } else if (setup.mode !== 'yard') {
      if (human) { showTurnBanner('Your turn', 'blue'); play('turn'); }
      else showTurnBanner(`${snap.sides[side].name} aims`, 'orange');
    }
    say(`Round ${round}. ${human ? (setup.mode === 'duel' ? `${snap.sides[side].name}'s turn` : 'Your turn') : `${snap.sides[side].name} aims`}`);
    if (turnCount > 1) void autosave(side, round);
  }

  async function autosave(side: Side, round: number): Promise<void> {
    if (setup.mode === 'yard') return;
    try {
      await saveBattle({
        setup, core: core.saveBattle(), coreName: core.name,
        label: setup.mode === 'duel' ? `Round ${round}, ${snap.sides[side].name}'s turn` : `${setup.level ? `Level ${setup.level}, ` : ''}Round ${round}`,
        savedAt: Date.now(), handoff: setup.mode === 'duel',
      });
      saveTick.classList.remove('show');
      void saveTick.offsetWidth;
      saveTick.classList.add('show');
    } catch { /* a failed save never stops play */ }
  }

  function onEnd(): void {
    if (ended) return;
    ended = true;
    const res = snap.result;
    app.lastResult = res;
    // Progress first, then drop the save, then the results: closing the tab in between loses nothing.
    void (res ? app.recordResult(setup, res) : Promise.resolve()).catch(() => undefined).then(() => clearBattle());
    play(res && res.winner === 0 ? 'win' : setup.mode === 'duel' ? 'win' : 'lose');
    if (res) say(res.winner === 0 || setup.mode === 'duel' ? `${snap.sides[res.winner === 1 ? 1 : 0].name} wins` : 'You lost');
    // A battle-ending slow motion (Kettle Pop, Clean Sweep) plays out before the results.
    setTimeout(() => { if (alive) app.go({ to: 'results', setup }); }, (app.settings.reduceMotion ? 600 : 1500) + feel.juice.slowRemaining * 2);
  }

  let bannerT = 0;
  function showBanner(text: string, tone: string): void {
    banner.getAnimations().forEach((a) => a.cancel());
    banner.textContent = text;
    banner.className = `banner show ${tone}`;
    clearTimeout(bannerT);
    bannerT = window.setTimeout(() => banner.classList.remove('show'), 1200);
  }
  /** The turn banner slides in, holds and slides out (animations.json data.turn_banner); it fades with Reduce motion. */
  function showTurnBanner(text: string, tone: string): void {
    clearTimeout(bannerT);
    banner.textContent = text;
    banner.className = `banner show slide ${tone}`;
    turnBanner(banner, app.settings.reduceMotion, () => banner.classList.remove('show', 'slide'));
  }

  // ---------- HUD update ----------
  let padOpen = false;
  let padT = 0;
  const padAlways = () => Math.min(W, H) >= 700;
  function padNudge(): void {
    padOpen = true;
    clearTimeout(padT);
    padT = window.setTimeout(() => { padOpen = false; }, 4000);
  }
  // DOM writes only when a value changed: each write dirties layout, and the HUD runs every frame.
  const memo = new WeakMap<HTMLElement, Record<string, string>>();
  const changed = (el: HTMLElement, k: string, v: string) => { let m = memo.get(el); if (!m) memo.set(el, (m = {})); if (m[k] === v) return false; m[k] = v; return true; };
  const setText = (el: HTMLElement, v: string) => { if (changed(el, 't', v)) el.textContent = v; };
  const setData = (el: HTMLElement, k: string, v: string) => { if (changed(el, `d${k}`, v)) el.dataset[k] = v; };
  const setHidden = (el: HTMLElement, v: boolean) => { if (changed(el, 'h', String(v))) el.hidden = v; };
  const setClass = (el: HTMLElement, c: string, on: boolean) => { if (changed(el, `c${c}`, String(on))) el.classList.toggle(c, on); };
  const setStyle = (el: HTMLElement, k: string, v: string) => { if (changed(el, `s${k}`, v)) el.style.setProperty(k, v); };
  let hudKey = '';
  function updateHud(now: number): void {
    const s = snap;
    const hd = s.hud;
    const me = youSide();
    const human = s.sides[hd.active].human || setup.mode === 'yard';
    const plan = s.phase === 'plan' && human;
    setClass(hud, 'aiming', drag?.mode === 'aim');
    setClass(hud, 'flight', s.phase === 'flight' || s.phase === 'resolve' || s.phase === 'rival' || !human);
    setData(hud, 'phase', s.phase);
    setData(hud, 'active', String(hd.active));
    // top strip
    for (const side of [0, 1] as Side[]) {
      const k = s.kettles.find((x) => x.side === side);
      const pct = k ? Math.round((100 * k.hp) / k.maxHp) : 0;
      setText(kettleEl[side], `♨ ${pct}%`);
      setData(kettleEl[side], 'state', pct <= 25 ? 'critical' : pct <= 50 ? 'hurt' : 'full');
      const crew = s.hobs.filter((x) => x.side === side);
      const pk = crew.map((c) => `${c.id}:${c.hp}:${c.state}`).join(',');
      if (pipsEl[side].dataset.k !== pk) {
        pipsEl[side].dataset.k = pk;
        pipsEl[side].replaceChildren(...crew.map((c) => h('span', {
          class: `pip ${side ? 'p-diamond' : 'p-round'} ${c.state === 'bonked' ? 'bonked' : ''}`,
          style: `--c:${CLASS_COLOR[c.cls]};--f:${Math.round((100 * c.hp) / c.maxHp)}%`,
          title: `${c.name} ${c.hp}`,
        }, side ? CLASS_ICON[c.cls] : '')));
      }
    }
    const sq = s.squall;
    const fat = s.fatigue?.[0] || s.fatigue?.[1];
    const vo = s.hud.volley;
    const bo = s.hud.boss;
    const rk = vo ? `v${vo.left[0]}:${vo.left[1]}:${vo.actions}` : `${sq.on}:${s.round}:${s.roundCap}:${sq.warn}:${fat}:${bo?.phase ?? 0}`;
    if (changed(roundEl, 'k', rk)) {
      roundEl.textContent = vo ? `Shots left ${vo.left[0]} : ${vo.left[1]} of ${vo.actions}`
        : sq.on ? `Squall ${sq.on} of 3` : `Round ${s.round}/${s.roundCap}${sq.warn ? `  Squall in ${sq.warn}` : ''}${fat ? ', Fatigue' : ''}${bo ? `, Phase ${bo.phase}` : ''}`;
    }
    setClass(roundEl, 'squall', !!sq.on);
    const arrow = (w: number) => (w === 0 ? '• 0' : `${w > 0 ? '→' : '←'} ${Math.abs(w)}`);
    setText(windEl, `${arrow(s.wind)}   ⇢ ${Math.abs(s.forecast)}`);
    if (changed(windEl, 'title', `${s.wind}/${s.forecast}`)) windEl.title = `Wind ${s.wind}, next ${s.forecast}`;
    setData(top, 'active', String(hd.active));

    // crew
    const crew = s.hobs.filter((x) => x.side === me);
    const ck = crew.map((c) => `${c.id}:${c.hp}:${c.state}:${c.rest}`).join(',') + `|${hd.hob}|${plan}|${sprites.ready}`;
    if (ck !== hudKey) {
      hudKey = ck;
      rectsDirty = true;
      hobsEl.replaceChildren(...crew.map((c) => {
        const pu = sprites.url(`portrait_${hobSpriteName(c.def ?? c.id, c.cls)}_${me === 0 ? 'blue' : 'orange'}`);
        const b = btn(h('span', { class: 'face' }, pu ? h('img', { src: pu, alt: '' }) : CLASS_ICON[c.cls]), () => { send({ cmd: 'pick_hob', id: c.id }); }, `hob ${c.id === hd.hob ? 'on' : ''} ${c.state}`, {
          'aria-label': `${c.name}, ${c.cls}, ${c.hp} HP${c.state === 'rest' ? ', needs a rest' : c.state === 'dug' ? ', Loophole buried' : ''}`,
          style: `--c:${CLASS_COLOR[c.cls]};--f:${Math.round((360 * c.hp) / c.maxHp)}deg`,
          'data-hob': c.id,
          disabled: c.state === 'bonked' || !plan,
        });
        if (c.state === 'rest') b.append(h('em', { class: 'cog' }, `${c.rest}`));
        return b;
      }));
    }
    // tray: shots, then Doodads (each Doodad is an Action, used from its card)
    const tk = hd.shots.map((x) => `${x.id}:${x.uses}:${x.ready}:${x.weight}`).join(',') + `|${hd.doodads.map((d) => d.id).join(',')}|${hd.shot}|${plan}|${sprites.ready}`;
    if (trayEl.dataset.k !== tk) {
      trayEl.dataset.k = tk;
      rectsDirty = true;
      const shotBtns = hd.shots.map((c, i) => {
        const ic = c.icon ? sprites.url(`icon_${c.icon}`) : undefined;
        const b = btn(h('span', { class: 'nm' }, ic ? h('img', { src: ic, alt: '', class: 'ico' }) : '', c.name), () => send({ cmd: 'pick_shot', id: c.id }), `chip shot ${c.id === hd.shot ? 'on' : ''} ${c.ready ? '' : 'off'}`, {
          'aria-label': `${c.name}${c.uses >= 0 ? `, ${c.uses} left` : ''}, ${['Light', 'Medium', 'Heavy'][c.weight]}${c.ready ? '' : `, not ready${c.why ? `: ${c.why}` : ''}`}`,
          'data-key': String(i + 1), disabled: !plan,
        });
        if (c.uses >= 0) b.append(h('em', { class: 'uses' }, String(c.uses)));
        if (c.weight) b.append(h('i', { class: 'cogs', 'aria-hidden': 'true' }, '⚙'.repeat(c.weight)));
        if (c.best && c.kind === 'shell') b.append(h('i', { class: 'best', style: `--c:${CLASS_COLOR[c.best]}` }, CLASS_ICON[c.best]));
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); shellCard(c.name, c.weight, c.best); });
        return b;
      });
      const doodadBtns = hd.doodads.map((d) => {
        const ic = sprites.url(`icon_${d.id}`);
        return btn(h('span', { class: 'nm' }, ic ? h('img', { src: ic, alt: '', class: 'ico' }) : '', d.name), () => doodadCard(d), 'chip shot doodad', {
          'aria-label': `${d.name}, Doodad. ${d.card}`, 'data-doodad': d.id, disabled: !plan,
        });
      });
      trayEl.replaceChildren(...shotBtns, ...doodadBtns);
    }
    // walk and Steam (the bar is a share of this side's starting Steam, not of 100)
    setHidden(walkEl, !hd.canWalk && !(plan && setup.mode !== 'campaign'));
    const pct = Math.max(0, Math.min(100, (100 * hd.steam) / Math.max(1, hd.steamMax)));
    setStyle(steamBar.children[0] as HTMLElement, 'width', `${pct.toFixed(1)}%`);
    setText(steamBar.children[1] as HTMLElement, `S ${hd.steam}`);
    // readout
    const a = hd.aim;
    setText(readout, a && a.power > 0 ? `${(a.angle / 10).toFixed(1)}° | ${a.power}` : '--');
    setHidden(pad, !(plan && (padOpen || padAlways())));
    // fire: FIRE, SHOVE OFF on a buried Loophole, PASS when nothing else is legal, 2x / 1x in Resolve
    const fs = hd.fire;
    setData(fire, 'state', fs);
    setText(fire, fs === 'fast' ? (fast ? '1x' : '2x') : fs === 'dug' ? 'SHOVE OFF' : fs === 'pass' ? 'PASS' : 'FIRE');
    if (changed(fire, 'aria', fs + fast)) fire.setAttribute('aria-label', fs === 'fast' ? (fast ? 'Normal speed' : 'Double speed') : fs === 'dug' ? 'Shove Off: clear the buried Loophole' : fs === 'pass' ? 'Pass the turn' : 'Fire');
    setHidden(fire, fs === 'flight' || (!human && fs !== 'fast'));
    setHidden(reframe, !(manual || topManual || wideLook));
    // onboarding prompts (1-1)
    updatePrompt(now, plan);
  }

  function hint(id: string, text: string, target: HTMLElement | null, showHand = false): void {
    if (app.progress.hints.includes(id)) { setHidden(prompt, true); setHidden(hand, true); return; }
    setText(prompt, text);
    setHidden(prompt, false);
    setData(prompt, 'hint', id);
    if (target) {
      const b = rectOf(target);
      setStyle(prompt, 'left', `${clamp(b.x + b.w / 2, 70, W - 70)}px`);
      setStyle(prompt, 'top', `${Math.max(8, b.y - 44)}px`);
    }
    setHidden(hand, !showHand);
  }
  function doneHint(id: string): void {
    if (!app.progress.hints.includes(id)) { app.progress.hints.push(id); void app.saveProgress(); }
  }
  function updatePrompt(_now: number, plan: boolean): void {
    if (!plan || setup.level !== '1-1' || paused) { setHidden(prompt, true); setHidden(hand, true); return; }
    if (!app.progress.hints.includes('drag')) {
      const r0 = layout === 'tall' ? rectOf(lensBottom) : clearRect();
      const [hx, hy] = (() => {
        const hb = snap.hobs.find((x) => x.id === snap.hud.hob);
        // While the lenses are joined (just after a shot) there is no bottom lens; fall back to the joined one.
        const ls = lensRects();
        const l = ls.find((x) => x.id === 'bottom' || x.id === 'wide') ?? ls[0];
        return hb && l ? toScreen(l.rect, l.cam, hb.x, hb.y) : [r0.x + r0.w * 0.3, r0.y + r0.h * 0.6];
      })();
      setStyle(hand, 'left', `${hx}px`);
      setStyle(hand, 'top', `${hy}px`);
      setStyle(prompt, 'left', `${clamp(hx + 60, 70, W - 70)}px`);
      setStyle(prompt, 'top', `${Math.max(8, hy - 90)}px`);
      setText(prompt, 'Drag to aim');
      setHidden(prompt, false);
      setHidden(hand, false);
      return;
    }
    if (!app.progress.hints.includes('fire') && snap.hud.fire === 'ready') { hint('fire', 'Fire!', fire); return; }
    if (missCount > 0 && !app.progress.hints.includes('pin') && snap.pins.some((p) => p.side === 0)) {
      const p = snap.pins.filter((x) => x.side === 0).slice(-1)[0];
      const l = lensRects().find((x) => x.id === 'top' || x.id === 'wide');
      if (p && l) {
        const [px, py] = toScreen(l.rect, l.cam, p.x, p.y);
        setStyle(prompt, 'left', `${clamp(px, 70, W - 70)}px`);
        setStyle(prompt, 'top', `${Math.max(8, py - 70)}px`);
        setText(prompt, 'Tap the pin');
        setHidden(prompt, false);
        setHidden(hand, true);
        return;
      }
    }
    setHidden(prompt, true);
    setHidden(hand, true);
  }

  // ---------- input: aim drag, pan, pinch, taps ----------
  let drag: Gesture | null = null;
  // Lean Lines (07 §3.11): hold still on a block to see what would fall if it broke. Core query only.
  let lean: { side: Side; c: number; r: number; falls: Set<string> } | null = null;
  let leanT = 0;
  function tryLean(g: Gesture): void {
    if (drag !== g || (g.mode !== 'maybe-aim' && g.mode !== 'maybe-pan') || dist(g) >= 8) return;
    const l = lensAt(g.x0, g.y0);
    if (!l || l.id === 'strip') return;
    const [wx, wy] = toWorld(l.rect, l.cam, g.x0, g.y0);
    const b = snap.blocks.find((q) => wx >= q.x && wx < q.x + q.size && wy >= q.y && wy < q.y + q.size);
    if (!b) return;
    const falls = core.leanLines(b.side, b.c, b.r);
    lean = { side: b.side, c: b.c, r: b.r, falls: new Set(falls.map(([c, r]) => `${c},${r}`)) };
    g.mode = 'lean';
    showBanner(falls.length ? `${falls.length} ${falls.length === 1 ? 'block falls' : 'blocks fall'} with it` : 'Nothing else falls', 'paper');
    say(falls.length ? `If that block breaks, ${falls.length} more fall` : 'If that block breaks, nothing else falls');
    play('tap');
  }
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { d0: number; z0: number; lens: LensId } | null = null;
  let lastDragEnd = 0;
  const dist = (g: Gesture) => Math.hypot(g.x - g.x0, g.y - g.y0);

  function lensAt(x: number, y: number): { id: LensId; rect: Rect; cam: Cam } | undefined {
    const ls = lensRects();
    return ls.find((l) => x >= l.rect.x && x < l.rect.x + l.rect.w && y >= l.rect.y && y < l.rect.y + l.rect.h);
  }
  const canAim = () => snap.phase === 'plan' && (snap.sides[snap.hud.active].human || setup.mode === 'yard') && !paused && !handoffOpen;

  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    if (pointers.size >= 3) return;
    if (pointers.size === 2) {
      if (drag?.mode === 'aim' || drag?.mode === 'lean') endDrag(true);
      const [p1, p2] = [...pointers.values()];
      const l = lensAt(p1.x, p1.y);
      pinch = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), z0: l?.id === 'top' ? zoomTop : zoomWide, lens: l?.id ?? 'wide' };
      drag = null;
      return;
    }
    const l = lensAt(e.clientX, e.clientY);
    if (!l) return;
    const base: Gesture = { id: e.pointerId, lens: l.id, mode: 'maybe-pan', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now() };
    if (e.button === 1 || e.button === 2) { drag = { ...base, mode: 'pan' }; return; }
    if (l.id === 'strip') { drag = { ...base, mode: 'strip' }; return; }
    if ((l.id === 'wide' || l.id === 'bottom') && canAim()) drag = { ...base, mode: 'maybe-aim', prevAim: snap.hud.aim ? { ...snap.hud.aim } : undefined };
    else drag = base;
    const g = drag;
    clearTimeout(leanT);
    leanT = window.setTimeout(() => tryLean(g), 450);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const z = clamp((pinch.z0 * Math.hypot(p1.x - p2.x, p1.y - p2.y)) / Math.max(1, pinch.d0), 0.6, 2.2);
      if (pinch.lens === 'top') { zoomTop = clamp(z, 0.8, 1.5); topManual = true; } else { zoomWide = z; manual = true; }
      const cam = pinch.lens === 'top' ? camTop : camWide;
      cam.cx -= (e.clientX - prev.x) / cam.s / 2;
      cam.cy += (e.clientY - prev.y) / cam.s / 2;
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.mode === 'lean') return;
    if (dist(drag) >= 8) clearTimeout(leanT);
    if (drag.mode === 'maybe-aim' && dist(drag) >= 8) {
      drag.mode = 'aim';
      doneHint('drag');
    }
    if (drag.mode === 'maybe-pan' && dist(drag) >= 8) drag.mode = 'pan';
    if (drag.mode === 'aim') aimFromDrag(drag);
    else if (drag.mode === 'pan') {
      const cam = drag.lens === 'top' ? camTop : camWide;
      if (drag.lens === 'top') topManual = true; else if (drag.lens === 'wide') manual = true; else return;
      cam.cx -= (e.clientX - prev.x) / cam.s;
      cam.cy += (e.clientY - prev.y) / cam.s;
    } else if (drag.mode === 'strip') stripLook(e.clientX);
  });

  function aimFromDrag(g: Gesture): void {
    let dx = g.x0 - g.x, dy = g.y - g.y0; // pull-back: shot goes opposite the pull, world y up
    if (app.settings.dragMode === 'point') { dx = -dx; dy = -dy; }
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg = deg < -90 ? 180 : 0;
    const angle = Math.round(deg * 2) * 5;
    const power = clamp(Math.round((Math.hypot(dx, dy) / (0.4 * Math.min(W, H))) * 100), 0, 100);
    pendingAim = { angle, power }; // sent once per frame by flushAim
    // edge help: slide the anchor away from a near edge while power is under 100
    if (power < 100) {
      const m = 12;
      if (g.x < m) g.x0 += m - g.x; else if (g.x > W - m) g.x0 -= g.x - (W - m);
      if (g.y < m) g.y0 += m - g.y; else if (g.y > H - m) g.y0 -= g.y - (H - m);
    }
  }

  /** cancel true: put the old aim back. false: a lift (Quick Fire may fire). 'keep': keep the aim, never fire. */
  function endDrag(cancel: boolean | 'keep'): void {
    clearTimeout(leanT);
    if (!drag) return;
    const g = drag;
    drag = null;
    if (g.mode === 'lean') { lean = null; return; }
    if (g.mode === 'aim') {
      lastDragEnd = performance.now();
      if (cancel === true || dist(g) < 12) {
        pendingAim = null;
        if (g.prevAim) send({ cmd: 'aim', angle: g.prevAim.angle, power: g.prevAim.power });
        return;
      }
      flushAim();
      padNudge();
      if (app.settings.quickFire && cancel === false) doFire(true);
    }
  }

  function stripLook(x: number): void {
    const rs = rectOf(strip);
    camTop.cx = ((x - rs.x) / rs.w) * terr.w;
    topManual = true;
    wideLook = false;
  }

  let lastTap = 0;
  canvas.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!drag || drag.id !== e.pointerId) return;
    const g = drag;
    if (g.mode === 'aim' || g.mode === 'lean') { endDrag(false); return; }
    clearTimeout(leanT);
    drag = null;
    if (g.mode === 'strip') {
      const now = performance.now();
      if (now - lastTap < 320) { wideLook = !wideLook; topManual = false; } else stripLook(e.clientX);
      lastTap = now;
      return;
    }
    if (g.mode === 'maybe-aim' || g.mode === 'maybe-pan') tapAt(e.clientX, e.clientY);
  });
  const lose = () => { if (drag?.mode === 'aim' || drag?.mode === 'lean') endDrag(true); clearTimeout(leanT); drag = null; pinch = null; pointers.clear(); stopWalk(); };
  canvas.addEventListener('pointercancel', lose);
  // Losing the pointer is not a lift: keep the aim, never Quick Fire.
  canvas.addEventListener('lostpointercapture', (e) => { if (drag?.id === e.pointerId && (drag.mode === 'aim' || drag.mode === 'lean')) endDrag('keep'); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const l = lensAt(e.clientX, e.clientY);
    const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    if (l?.id === 'top') { zoomTop = clamp(zoomTop * f, 0.8, 1.5); topManual = true; }
    else if (l?.id === 'wide') {
      const [wx, wy] = toWorld(l.rect, camWide, e.clientX, e.clientY);
      zoomWide = clamp(zoomWide * f, 0.6, 2.2);
      camWide.s *= f;
      const [nx, ny] = toWorld(l.rect, camWide, e.clientX, e.clientY);
      camWide.cx += wx - nx; camWide.cy += wy - ny;
      manual = true;
    }
  }, { passive: false });
  window.addEventListener('blur', lose);

  function tapAt(x: number, y: number): void {
    const l = lensAt(x, y);
    if (!l || l.id === 'strip') return;
    // pins first (44 pt tap), then Hobs
    let bestPin: PinView | undefined;
    let bd = 26;
    for (const p of snap.pins) {
      const [px, py] = toScreen(l.rect, l.cam, p.x, p.y - 0);
      const d = Math.hypot(px - x, py - 18 - y);
      if (d < bd) { bd = d; bestPin = p; }
    }
    if (bestPin) {
      if (bestPin.side === youSide() && !bestPin.spent && canAim()) {
        recallFrom = snap.hud.aim ? { ...snap.hud.aim } : undefined;
        if (send({ cmd: 'recall', pin: bestPin.id })) { padNudge(); doneHint('pin'); play('tap'); }
      } else showBanner(bestPin.side === youSide() ? 'Pin used' : `${snap.hobs.find((h2) => h2.id === bestPin!.hob)?.name ?? 'Rival'}, round ${bestPin.round}`, 'paper');
      return;
    }
    for (const hb of snap.hobs) {
      if (hb.side !== youSide() || hb.state === 'bonked') continue;
      const [hx, hy] = toScreen(l.rect, l.cam, hb.x, hb.y + 12);
      if (Math.hypot(hx - x, hy - y) < 24 && canAim()) { send({ cmd: 'pick_hob', id: hb.id }); play('tap'); return; }
    }
  }

  // Recall key: steps through last shot, the one before, then back to the current aim.
  let recallIdx = 0;
  let recallFrom: { angle: number; power: number } | undefined;
  function recallStep(): void {
    const mine = snap.pins.filter((p) => p.hob === snap.hud.hob && !p.spent).reverse();
    if (recallIdx === 0) recallFrom = snap.hud.aim ? { ...snap.hud.aim } : undefined;
    if (recallIdx < mine.length) { send({ cmd: 'recall', pin: mine[recallIdx].id }); recallIdx++; }
    else { if (recallFrom) send({ cmd: 'aim', ...recallFrom }); recallIdx = 0; }
    padNudge();
  }

  // ---------- fire, walk, keys ----------
  const afterAction = () => { padOpen = false; recallIdx = 0; manual = false; topManual = false; wideLook = false; };
  function doFire(fromDrag = false): void {
    unlockAudio();
    if (snap.hud.fire === 'fast') { fast = !fast; if (fast) feel.juice.cancelSlow(); send({ cmd: 'fast', on: fast }); return; }
    if (!fromDrag && performance.now() - lastDragEnd < 150) return;
    if (!canAim()) return;
    flushAim();
    if (snap.hud.fire === 'dug') {
      // A buried Loophole: Fire becomes Shove Off (Steam, no Action); then the Hob can fire.
      if (send({ cmd: 'shove_off' })) play('walk');
      else showBanner(lastRefusal === 'not_enough_steam' ? 'Not enough Steam to Shove Off' : 'Cannot Shove Off now', 'paper');
      return;
    }
    if (snap.hud.fire === 'pass') { if (send({ cmd: 'pass' })) afterAction(); return; }
    if (send({ cmd: 'fire' })) { doneHint('fire'); afterAction(); firePress(fire); play('fire_press'); }
  }
  fire.addEventListener('click', (e) => { e.preventDefault(); doFire(); });
  // Resolve speed-up: a tap anywhere during Resolve also speeds up (07 §2.8). Not on the 2x key
  // itself: that would set 2x here and its click would turn it straight off again.
  root.addEventListener('pointerdown', (e) => {
    if (fire.contains(e.target as Node)) return;
    if (snap.phase === 'resolve' && !fast) { fast = true; feel.juice.cancelSlow(); }
  }, true);
  // Audio unlock on a real user action for iOS (touchend / pointerup / keydown count, pointerdown may not).
  for (const ev of ['pointerup', 'touchend', 'keydown']) root.addEventListener(ev, () => unlockAudio(), { capture: true, passive: true });

  let walkHeld: -1 | 0 | 1 = 0;
  let walkMinT = 0;
  function startWalk(d: -1 | 1): void { if (!canAim()) return; walkHeld = d; walkMinT = performance.now(); send({ cmd: 'walk', dir: d }); play('walk'); }
  function stopWalk(): void {
    if (!walkHeld) return;
    const wait = Math.max(0, 160 - (performance.now() - walkMinT));
    walkHeld = 0;
    setTimeout(() => { if (!walkHeld) send({ cmd: 'walk', dir: 0 }); }, wait);
  }
  for (const [b, d] of [[walkL, -1], [walkR, 1]] as [HTMLElement, -1 | 1][]) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); startWalk(d); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stopWalk);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startWalk(d); setTimeout(stopWalk, 200); } });
  }

  function onKey(e: KeyboardEvent): void {
    if (handoffOpen || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const a = snap.hud.aim ?? { angle: 450, power: 50 };
    const k = e.key;
    if (crashed) return;
    if (k === 'Escape' || k === 'p' || k === 'P') { if (overlay.firstChild && !paused) { closeCards(); e.preventDefault(); return; } paused ? closePause() : openPause(); e.preventDefault(); return; }
    if (paused || overlay.firstChild) return;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const step = e.shiftKey ? 1 : 10;
      send({ cmd: 'aim', angle: clamp(a.angle + (k === 'ArrowLeft' ? step : -step), 0, 1800), power: a.power });
      padNudge(); e.preventDefault();
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      const step = e.shiftKey ? 1 : 5;
      send({ cmd: 'aim', angle: a.angle, power: clamp(a.power + (k === 'ArrowUp' ? step : -step), 0, 100) });
      padNudge(); e.preventDefault();
    } else if (k === ' ' || k === 'Enter') {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.target !== fire) return;
      doFire(); e.preventDefault();
    } else if (k === 'Tab') {
      const crew = snap.hobs.filter((x) => x.side === youSide() && x.state !== 'bonked');
      const i = crew.findIndex((x) => x.id === snap.hud.hob);
      const n = crew[(i + (e.shiftKey ? crew.length - 1 : 1)) % Math.max(1, crew.length)];
      if (n) send({ cmd: 'pick_hob', id: n.id });
      e.preventDefault();
    } else if (/^[1-9]$/.test(k)) {
      const c = snap.hud.shots[Number(k) - 1];
      if (c) send({ cmd: 'pick_shot', id: c.id });
    } else if (k === 'r' || k === 'R') recallStep();
    else if (k === 'f' || k === 'F') { manual = false; topManual = false; wideLook = false; }
    else if ((k === 'a' || k === 'A') && !e.repeat) startWalk(-1);
    else if ((k === 'd' || k === 'D') && !e.repeat) startWalk(1);
    else if (k === '+' || k === '=') { zoomWide = clamp(zoomWide * 1.1, 0.6, 2.2); }
    else if (k === '-') { zoomWide = clamp(zoomWide / 1.1, 0.6, 2.2); }
    else if (k === 'm' || k === 'M') void app.setSettings({ mute: !app.settings.mute });
  }
  function onKeyUp(e: KeyboardEvent): void {
    if ('aAdD'.includes(e.key)) stopWalk();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  // ---------- cards: pause, hand-off, shell ----------
  // A card is modal for real: everything else in the battle is inert while it is up (no Tab to
  // Pause behind the hand-off card), Tab cycles inside it, and focus goes back where it was.
  let focusBack: HTMLElement | null = null;
  function card(cls: string, labelId: string, ...kids: (Node | string)[]): HTMLElement {
    if (!overlay.firstChild) focusBack = document.activeElement as HTMLElement | null;
    const c = h('div', { class: `card ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelId }, ...kids);
    const scrim = h('div', { class: 'scrim' }, c);
    overlay.replaceChildren(scrim);
    for (const el of [canvas, ...Array.from(hud.children)]) if (el !== overlay) (el as HTMLElement).inert = true;
    // The tall layout nests the HUD parts; keep the overlay itself live.
    overlay.inert = false;
    c.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...c.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
      f[n].focus();
      e.preventDefault();
      e.stopPropagation();
    });
    return scrim;
  }
  function closeCards(): void {
    overlay.replaceChildren();
    for (const el of [canvas, ...Array.from(hud.children)]) (el as HTMLElement).inert = false;
    const back = focusBack;
    focusBack = null;
    if (back && back.isConnected && !back.inert) back.focus({ preventScroll: true });
  }

  function openPause(): void {
    if (ended) return;
    paused = true;
    lose();
    const lvl = setup.level ? app.levels().find((l) => l.id === setup.level) : undefined;
    const goals = lvl ? h('ul', { class: 'goals' }, ...lvl.goals.map((g) => h('li', {}, g))) : '';
    // Give up only where the core has the command (the real core does not yet).
    const giveUp = setup.mode !== 'yard' && core.features.giveUp ? btn('Give up', () => { closePause(); send({ cmd: 'give_up' }); }, 'secondary', { 'data-testid': 'give-up' }) : '';
    // Pass is always on offer on your turn, so no turn can lock.
    const pass = snap.hud.canPass ? btn('Pass turn', () => { closePause(); flushAim(); if (send({ cmd: 'pass' })) afterAction(); }, 'secondary', { 'data-testid': 'pass' }) : '';
    card('pause-card', 'pause-h',
      h('h2', { id: 'pause-h' }, 'Paused'),
      goals,
      h('p', { class: 'small' }, lvl ? 'Win by Clean Sweep or Kettle Pop.' : ''),
      btn('Resume', () => closePause(), 'primary', { 'data-autofocus': true }),
      pass,
      btn('Retry', () => { closePause(); void clearBattle(); app.go({ to: 'battle', setup }); }, 'secondary'),
      btn('Settings', () => {
        const data = core.saveBattle();
        app.go({ to: 'settings', back: { to: 'battle', setup, resume: data } });
      }, 'secondary'),
      btn('Map', () => { void autosave(snap.hud.active, snap.round).then(() => app.go({ to: 'map' })); }, 'secondary'),
      giveUp,
    );
    overlay.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }
  function closePause(): void { paused = false; closeCards(); last = performance.now(); }

  function openHandoff(side: Side, round: number): void {
    handoffOpen = true;
    lose();
    const name = snap.sides[side].name;
    const help = snap.sides[side].help;
    const k = snap.kettles.find((x) => x.side === side);
    const pct = k ? Math.round((100 * k.hp) / k.maxHp) : 0;
    const crew = snap.hobs.filter((x) => x.side === side && x.state !== 'bonked');
    const openedAt = performance.now();
    const ready = btn('READY', () => {
      if (performance.now() - openedAt < 400) return;
      handoffOpen = false;
      closeCards();
      last = performance.now();
    }, 'primary big', { 'data-autofocus': true, 'data-testid': 'ready' });
    const hits = turnHits;
    card(`handoff side${side}`, 'handoff-h',
      h('p', { class: 'lastshot' }, hits.who ? `${hits.who} hit: ${hits.blocks} blocks, ${Math.round(hits.dmg)} damage` : 'New turn'),
      h('div', { class: `crest ${side ? 'diamond' : 'round'}`, 'aria-hidden': 'true' }, '⚑'),
      h('p', {}, 'Pass the device to'),
      h('h2', { class: 'who', id: 'handoff-h' }, name.toUpperCase()),
      help !== 'none' ? h('p', { class: 'helpmark' }, `Help: ${help === 'some' ? 'Some +' : 'Lots ++'}`) : '',
      h('p', { class: 'small' }, `♨ ${pct}%  ${crew.map((c) => CLASS_ICON[c.cls]).join(' ')}  Round ${round}/${snap.roundCap}`),
      ready,
    );
    play('sheet');
    handoffFlip(overlay.querySelector('.handoff') as HTMLElement, side, app.settings.reduceMotion);
    setTimeout(() => ready.focus(), 0);
  }

  function shellCard(name: string, weight: number, best?: string): void {
    const sc = card('shell-card', 'shell-h',
      h('h3', { id: 'shell-h' }, name),
      h('p', {}, `Weight: ${['Light', 'Medium', 'Heavy'][weight]}`),
      best ? h('p', {}, `Best with: ${best}`) : '',
      h('p', { class: 'small' }, 'Any Hob can fire it.'),
      btn('Close', () => closeCards(), 'secondary', { 'data-autofocus': true }),
    );
    sc.addEventListener('click', (e) => { if (e.target === sc) closeCards(); });
  }

  /** A Doodad is the turn's Action. Mend Bucket mends the most hurt blocks; Pot Lid asks which room. */
  function doodadCard(d: { id: string; name: string; card: string }): void {
    if (!canAim()) return;
    const use = (room?: string) => {
      closeCards();
      flushAim();
      if (send({ cmd: 'doodad', id: d.id, room })) { afterAction(); play('sheet'); }
      else showBanner(`${d.name}: cannot use it now`, 'paper');
    };
    const rooms = snap.rooms.filter((rm) => rm.side === snap.hud.active && rm.intact && !rm.lid);
    const k = snap.kettles.find((x) => x.side === snap.hud.active);
    const choices = d.id === 'pot_lid'
      ? [...(k && !k.lid ? [btn('Kettle Room', () => use('kettle'), 'primary', { 'data-autofocus': true })] : []),
        ...rooms.map((rm) => btn(`Nook ${rm.id + 1}`, () => use(`nook:${rm.id}`), 'secondary'))]
      : [btn(`Use ${d.name}`, () => use(), 'primary', { 'data-autofocus': true, 'data-testid': 'use-doodad' })];
    const sc = card('shell-card doodad-card', 'doodad-h',
      h('h3', { id: 'doodad-h' }, d.name),
      h('p', {}, d.card),
      h('p', { class: 'small' }, 'Using it is your Action for this turn.'),
      ...choices,
      btn('Close', () => closeCards(), 'secondary'),
    );
    sc.addEventListener('click', (e) => { if (e.target === sc) closeCards(); });
    sc.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }

  // ---------- start ----------
  relayout();
  for (const e of snap.events) if (e.t === 'turn') turnCount++;
  if (turnCount === 0 && snap.phase !== 'over') turnCount = 1;
  snap.events = snap.events.filter((e) => e.t !== 'turn');
  if (snap.phase === 'plan' && setup.mode !== 'yard') showTurnBanner(setup.mode === 'duel' ? `${snap.sides[snap.hud.active].name}'s turn` : 'Your turn', snap.hud.active === 0 ? 'blue' : 'orange');
  hud.append(liveEl);
  raf = requestAnimationFrame(frame);
  sprites.upgrade();
  root.dataset.core = core.name;
  root.dataset.testid = 'battle';
  // A resumed Couch Duel shows the hand-off card first, as the saved turn did.
  if (r.resume && r.handoff && setup.mode === 'duel' && setup.seats !== 'one' && snap.phase === 'plan') openHandoff(snap.hud.active, snap.round);

  // For tests and debugging only (dev, or ?debug in the URL): a read-only view of the latest snapshot.
  if (DEBUG) (window as unknown as { __castle?: unknown }).__castle = { snap: () => snap, layout: () => layout, core: core.name, cam: () => ({ ...camWide }), feel: () => ({ terr: terr.rev, fx: feel.fx.live, collapse: feel.col.busy, slow: feel.juice.slowing, trauma: feel.juice.trauma }) };

  return {
    el: root,
    relayout,
    // Back in a fight opens Pause (or closes a card); it never leaves the fight unsaved.
    onBack: () => {
      if (crashed || ended) return false;
      if (overlay.firstChild && !paused) closeCards();
      else if (paused) closePause();
      else openPause();
      return true;
    },
    destroy: () => {
      alive = false;
      clearTimeout(leanT);
      clearTimeout(liveT);
      cancelAnimationFrame(raf);
      stopLoops();
      slowmoAudio(false);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', lose);
      clearTimeout(bannerT);
      clearTimeout(padT);
    },
  };
}

/** Keep the last full terrain view; merge incremental snapshot data. */
function merge(prev: Snapshot, next: Snapshot): Snapshot {
  next.events = [...(prev.events ?? []), ...next.events];
  next.terrain.chunks = [...(prev.terrain.chunks ?? []), ...next.terrain.chunks];
  return next;
}

function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }
