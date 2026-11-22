// The battle screen: canvas lenses, HUD in both layouts, aim input, camera, hand-off card.
// It never decides an outcome. It sends commands to the core and draws its snapshots.
import type { App, Route, Screen } from '../app';
import { bark, cue, loop, musicLayers, play, preloadBarks, releaseBarks, setMusic, slowmoAudio, stopLoops, unlockAudio } from '../audio/sfx';
import type { BattleSetup, Command, PinView, Side, Snapshot } from '../core/types';
import { SaveError, TICK_HZ } from '../core/types';
import { clearBattle, dropBattleSave, loadBattleSave, saveBattle } from '../save/db';
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
  /** A drag on your turn that did not start on your fort (it pans, and says where to aim from once). */
  skyAim?: boolean;
  /** The pull direction while the finger was clear of the screen edge (unit vector, world y up). */
  lockDir?: [number, number];
  t0: number;
}

export function battleScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'battle' }>;
  const setup: BattleSetup = r.setup;
  const core = app.core;
  // A save that is from another version, damaged, or whose log the core refuses is put aside and
  // the player lands on the map with a note (App.go turns the throw into that). A log that
  // replays to another hash still loads, with a note: a good fight is never thrown away.
  // Back from Settings takes over the live battle when the core still holds it (a shot in the
  // air carries on where it was); the save string is only the fallback.
  let loadNote: string | void = undefined;
  try {
    if (r.live !== undefined && r.live === core.battleGen) core.resendTerrain?.();
    else if (r.resume) loadNote = core.loadBattle(r.resume);
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
  // A bark shows its subtitle as a speech tag over the Hob, with or without sound (07 §7.6).
  feel.bark = (nm, ev, side, step, id) => {
    const line = bark(nm, ev, side, step);
    if (!line) return;
    const hb = snap.hobs.find((q) => q.id === id);
    if (hb) feel.fx.word(`"${line}"`, hb.x, hb.y + 70, 13, side === 0 ? '#CFE0FF' : '#FFD9B8', false, Math.max(2000, 1500 + 60 * line.length));
  };
  preloadBarks(snap.hobs.map((hb) => hobSpriteName(hb.def ?? hb.id, hb.cls)));
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
  // Fine Tune sits on its own, never on the active fort: in Tall it docks on the side of the bottom
  // lens away from your fort, in a short Wide view it sits under the top strip, off the tray. It
  // also hides while a finger aims (QA playtest 1, M7).
  const aimCluster = h('div', { class: 'aimcluster' }, readout);
  // Edge markers (wide layout): the Rival fort when it is off screen, and where the aim arc leaves it.
  // The marker is also a one-tap peek: the camera pulls out to show both forts, a second tap
  // (or an aim, or the next turn) brings it home (QA playtest 2, N3).
  const fortMark = h('button', { class: 'edgemark fortmark', type: 'button', 'data-testid': 'fort-mark' });
  fortMark.addEventListener('click', (e) => { e.preventDefault(); peek = !peek; if (peek) manual = false; play('tap'); });
  const arcMark = h('div', { class: 'edgemark arcmark', 'data-testid': 'arc-mark', 'aria-hidden': 'true' }, h('i', {}, '\u27A4'));
  const fire = h('button', { class: 'btn fire', type: 'button', 'aria-label': 'Fire', 'data-testid': 'fire' }, 'FIRE');
  // Why Fire is grey (the picked shot is not ready): the core's reason, next to the button.
  const fireWhyEl = h('div', { class: 'firewhy', 'data-testid': 'fire-why', role: 'status' });
  const reframe = btn('⌖', () => { manual = false; topManual = false; bottomManual = false; peek = false; }, 'reframe round-btn', { 'aria-label': 'Re-frame' });
  const banner = h('div', { class: 'banner', role: 'status' });
  const prompt = h('div', { class: 'prompt' });
  const hand = h('div', { class: 'ghosthand', 'aria-hidden': 'true' });
  // The owner rule taught on every Plan step until three aims were started from the fort: a ring
  // on the picked Hob (QA playtest 2, n3).
  const ownRing = h('div', { class: 'ownring', 'aria-hidden': 'true', 'data-testid': 'own-ring' });
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
    // The wind slider only where the core takes a wind command.
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
    hud.className = `hud ${layout}${setup.mode === 'yard' ? ' yard' : ''}`;
    // Turning the device ends a drag as if the finger lifted: the aim so far is kept (07 §2.6).
    if (drag?.mode === 'aim') endDrag('keep');
    top.replaceChildren(
      layout === 'wide' ? pause : '',
      kettleEl[0], pipsEl[0], roundEl, windEl, pipsEl[1], kettleEl[1], saveTick,
    );
    if (layout === 'wide') {
      hud.replaceChildren(top, hobsEl, walkEl, trayEl, pad, aimCluster, fire, fireWhyEl, fortMark, arcMark, reframe, banner, ownRing, prompt, hand, overlay);
      if (yardBar) hud.append(yardBar);
    } else {
      floatsL.replaceChildren(pause, walkEl);
      floatsR.replaceChildren(aimCluster);
      lensBottom.replaceChildren(floatsL, floatsR, pad, banner);
      crewRow.replaceChildren(hobsEl, fire);
      dock.replaceChildren(trayEl, crewRow);
      hud.replaceChildren(top, lensTop, strip, lensBottom, dock, fireWhyEl, reframe, ownRing, prompt, hand, overlay);
      if (yardBar) lensTop.replaceChildren(yardBar);
    }
    resize();
    rectsDirty = true;
    snapCams = true;
  }

  // ---------- canvas sizing ----------
  let W = 0, H = 0, dpr = 1;
  // Adaptive resolution: if the work in a frame runs long (a slow phone, a software canvas), the
  // field draws at fewer pixels per point, down to 1; it steps back up when there is room again.
  // It times the work inside tick, not the gap between frames: a phone capped at 30 fps (iOS Low
  // Power Mode) has 33 ms gaps but may draw in 5 ms, and must not stay blurry for good.
  let dprCap = 2;
  let slowFrames = 0, fastFrames = 0;
  function adaptRes(workMs: number): void {
    if (workMs > 14) { slowFrames++; fastFrames = 0; } else if (workMs < 8) { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
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
  const rc: Record<'top' | 'bottom' | 'strip' | 'clear' | 'fire' | 'tray', Rect> = { top: z(), bottom: z(), strip: z(), clear: z(), fire: z(), tray: z() };
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
    rc.tray = { x: tr.left, y: tr.top, w: tr.width, h: tr.height };
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
  /** Tall: the bottom lens was panned by a drag that did not start on the fort. */
  let bottomManual = false;
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
  // Only a human side acts. In the Test Yard that is side 0: the Dummy's turn passes itself.
  const isHuman = (side: Side): boolean => snap.sides[side].human && !(setup.mode === 'yard' && side === 1);

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
  /** On a phone the plan frame may go down to 6 px blocks to hold both forts (QA playtest 2, N3). */
  const planFloor = () => (Math.min(W, H) < 520 ? 0.375 : FLOOR);
  /** One-tap peek at both forts (the Rival fort marker), at any zoom. */
  let peek = false;
  const ZMAX = 1.25;
  let wideRate = 5;
  let wideCut = false;
  let rmFrame: 'from' | 'to' = 'from';
  const camT: Cam = { cx: 0, cy: 0, s: 1 };
  /** Plan frame for a side: both forts when they fit at the floor, else this fort and the way to the other. */
  function planFrame(cr: Rect, side: Side, out: Cam): Cam {
    const f = snap.forts;
    const fa = f[side], fo = f[other(side)];
    const x0 = Math.min(fa.x, fo.x) - 32, x1 = Math.max(fa.x + fa.w, fo.x + fo.w) + 32;
    const y0 = Math.min(fa.y, fo.y) - 30, y1 = Math.max(fa.y + fa.h, fo.y + fo.h) + 150;
    const both = Math.min(cr.w / (x1 - x0), cr.h / (y1 - y0));
    const dir = fo.x > fa.x ? 1 : -1;
    // Both forts whenever their blocks still draw at 8 px or more (the zoom floor); else this fort
    // and the way to the other, with the Rival fort's edge marker (QA playtest 1, M3).
    if (both >= planFloor() || (peek && side === youSide())) {
      out.s = Math.min(both, ZMAX);
      // 55/45 toward the rival (07 §3.5); a Couch Duel stays centred.
      // The 55/45 lean only when there is room to spare: it must never push a fort off the frame.
      const spare = Math.max(0, cr.w / out.s - (x1 - x0)) / 2;
      out.cx = (x0 + x1) / 2 + (setup.mode === 'duel' ? 0 : dir * Math.min(spare, (x1 - x0) * 0.05));
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
      const s = clamp(t.s, Math.min(FLOOR, planFloor()), 1); // the plan scale: no zoom jump at Fire
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
    } else if (feel.time < fatigueUntil && !manual) {
      // The Fatigue collapse: your own fort (both forts when they fit), never the Rival's alone,
      // so what it does to your crew is seen and the camera is home for your turn (N1).
      camFollowX = null;
      planFrame(cr, youSide(), t);
      wideRate = 6;
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
    if (!peek) t.s *= zoomWide;
    // Pan limits: the map edge plus a little slack, so the view never shows past the map.
    const mw = terr.w || snap.terrain.width;
    const half = cr.w / 2 / t.s, slack = 40;
    if (mw > 0) t.cx = 2 * half > mw ? mw / 2 : clamp(t.cx, half - slack, mw - half + slack);
    return t;
  }
  let camFollowX: number | null = null;
  /** View time until which the Fatigue collapse holds the camera on your own fort. */
  let fatigueUntil = -1e9;

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
    if (!bottomManual) ease(camBottom, { cx: sideX(me, rb, bs, fm), cy: fm.y + (0.5 - 0.2) * (rb.h / bs), s: bs }, dt, rm);
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
    const work0 = performance.now();
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
    const vs = feel.update(!paused ? dt * 1000 : 0, snap, calm, lw.cam.cx, lw.cam.cy, lw.rect.w / lw.cam.s, shellBuf, nShell);
    slowmoAudio(feel.juice.slowing !== null);
    sounds();
    if (running) {
      // "Rival turns at 2x" speeds up the whole Rival turn: think pose and flight.
      const rivalTurn = !isHuman(snap.hud.active) && setup.mode !== 'yard';
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
    if (!paused && !handoffOpen && document.visibilityState === 'visible') adaptRes(performance.now() - work0);
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
      h('p', {}, 'Something went wrong in this fight. Retry picks it up from the last saved turn.'),
      btn('Retry', () => {
        closeCards();
        // A new Game replays the saved log (core/API.md "Errors and panics"); no save: a fresh fight.
        void loadBattleSave().catch(() => undefined).then((sv) => app.go(sv && sv.coreName === core.name && setup.mode !== 'yard' ? { to: 'battle', setup: sv.setup, resume: sv.core } : { to: 'battle', setup }));
      }, 'primary', { 'data-autofocus': true, 'data-testid': 'crash-retry' }),
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
    const human = isHuman(snap.hud.active);
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
          // The Test Yard Dummy passes every turn: no banner over the Back key for that (n6).
          if (setup.mode === 'yard' && /passed$/.test(e.text)) break;
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
        case 'fatigue':
          // Fatigue gets its own banner, held before the turn banner (QA playtest 2, N1), and at
          // its start the camera stays on your own fort while the collapse plays there.
          showBanner(e.text, e.phase === 'start' ? 'danger' : 'slate', e.phase === 'start' ? 2200 : 1800);
          say(e.text);
          play(e.phase === 'start' ? 'creak' : 'sheet');
          if (e.phase === 'start') {
            fatigueUntil = feel.time + 3200;
            // A settle frame after the show also stays home.
            const f = snap.forts[youSide()];
            feel.impactX = f.x + f.w / 2;
          }
          break;
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
    peek = false;
    bottomManual = false;
    const human = isHuman(side);
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
  /** A held banner (Fatigue) is not covered by the turn banner: that one waits its turn. */
  let bannerHold = 0;
  let turnBannerT = 0;
  function showBanner(text: string, tone: string, hold = 0): void {
    if (!hold && performance.now() < bannerHold) return;
    banner.getAnimations().forEach((a) => a.cancel());
    banner.textContent = text;
    banner.className = `banner show ${tone}`;
    clearTimeout(bannerT);
    if (hold) bannerHold = performance.now() + hold;
    bannerT = window.setTimeout(() => banner.classList.remove('show'), hold || 1200);
  }
  /** The turn banner slides in, holds and slides out (animations.json data.turn_banner); it fades with Reduce motion. */
  function showTurnBanner(text: string, tone: string): void {
    clearTimeout(turnBannerT);
    const wait = bannerHold - performance.now();
    if (wait > 0) { turnBannerT = window.setTimeout(() => { if (alive) showTurnBanner(text, tone); }, wait + 60); return; }
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
    const human = isHuman(hd.active);
    const plan = s.phase === 'plan' && human;
    setClass(hud, 'aiming', drag?.mode === 'aim');
    // The tall lenses joined for a flight: the strip borders go and the floats move up off the drawn strip.
    setClass(hud, 'joined', layout === 'tall' && joined);
    setClass(hud, 'flight', s.phase === 'flight' || s.phase === 'resolve' || s.phase === 'rival' || !human);
    setData(hud, 'phase', s.phase);
    setData(hud, 'active', String(hd.active));
    setData(hud, 'you', String(me));
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
          class: `pip ${side ? 'p-diamond' : 'p-round'} ${c.state === 'bonked' ? 'bonked' : c.state === 'squashed' ? 'squashed' : ''}`,
          style: `--c:${CLASS_COLOR[c.cls]};--f:${Math.round((100 * c.hp) / c.maxHp)}%`,
          title: `${c.name} ${c.hp}${c.state === 'squashed' ? ', Squashed' : ''}`,
        }, side ? CLASS_ICON[c.cls] : '')));
      }
    }
    const sq = s.squall;
    const fat = s.fatigue?.[0] || s.fatigue?.[1];
    const vo = s.hud.volley;
    const bo = s.hud.boss;
    // Fatigue warned a few rounds ahead when the core says when it comes (QA playtest 1, M2).
    const fatIn = !fat && s.fatigueIn !== undefined && s.fatigueIn > 0 && s.fatigueIn <= 3 ? s.fatigueIn : 0;
    const rk = vo ? `v${vo.left[0]}:${vo.left[1]}:${vo.actions}` : `${sq.on}:${s.round}:${s.roundCap}:${sq.warn}:${fat}:${fatIn}:${bo?.phase ?? 0}:${layout}`;
    if (changed(roundEl, 'k', rk)) {
      // Portrait has a narrow top strip: a short label (n7), the full words in the title and for screen readers.
      const long = setup.mode === 'yard' ? 'Test Yard' : vo ? `Shots left ${vo.left[0]} : ${vo.left[1]} of ${vo.actions}`
        : sq.on ? `Squall ${sq.on} of 3` : `Round ${s.round}/${s.roundCap}${sq.warn ? `  Squall in ${sq.warn}` : ''}${fat ? ', Fatigue' : fatIn ? `  Fatigue in ${fatIn}` : ''}${bo ? `, Phase ${bo.phase}` : ''}`;
      const short = setup.mode === 'yard' || vo || sq.on ? long
        : `R${s.round}/${s.roundCap}${sq.warn ? ` \u00B7 Sq ${sq.warn}` : ''}${fat ? ' \u00B7 Fatigue' : fatIn ? ` \u00B7 Fat. ${fatIn}` : ''}${bo ? ` \u00B7 P${bo.phase}` : ''}`;
      roundEl.textContent = layout === 'tall' ? short : long;
      roundEl.title = long;
      roundEl.setAttribute('aria-label', long);
    }
    setClass(roundEl, 'squall', !!sq.on);
    const arrow = (w: number) => (w === 0 ? '• 0' : `${w > 0 ? '→' : '←'} ${Math.abs(w)}`);
    setText(windEl, `${arrow(s.wind)}   ⇢ ${Math.abs(s.forecast)}`);
    if (changed(windEl, 'title', `${s.wind}/${s.forecast}`)) windEl.title = `Wind ${s.wind}, next ${s.forecast}`;
    setData(top, 'active', String(hd.active));

    // crew
    const crew = s.hobs.filter((x) => x.side === me);
    const ck = crew.map((c) => `${c.id}:${c.hp}:${c.state}:${c.rest}`).join(',') + `|${hd.hob}|${plan}|${sprites.ready}|${sprites.scale}`;
    if (ck !== hudKey) {
      hudKey = ck;
      rectsDirty = true;
      hobsEl.replaceChildren(...crew.map((c) => {
        const pu = sprites.url(`portrait_${hobSpriteName(c.def ?? c.id, c.cls)}_${me === 0 ? 'blue' : 'orange'}`);
        const b = btn(h('span', { class: 'face' }, pu ? h('img', { src: pu, alt: '' }) : CLASS_ICON[c.cls]), () => { send({ cmd: 'pick_hob', id: c.id }); }, `hob ${c.id === hd.hob ? 'on' : ''} ${c.state}`, {
          'aria-label': `${c.name}, ${c.cls}, ${c.hp} HP${c.state === 'rest' ? ', needs a rest' : c.state === 'dug' ? ', Loophole buried' : c.state === 'squashed' ? ', Squashed, back up soon' : ''}`,
          style: `--c:${CLASS_COLOR[c.cls]};--f:${Math.round((360 * c.hp) / c.maxHp)}deg`,
          'data-hob': c.id,
          disabled: c.state === 'bonked' || !plan,
        });
        if (c.state === 'rest') b.append(h('em', { class: 'cog' }, `${c.rest}`));
        return b;
      }));
    }
    // tray: shots, then Doodads (each Doodad is an Action, used from its card)
    const tk = hd.shots.map((x) => `${x.id}:${x.uses}:${x.ready}:${x.weight}`).join(',') + `|${hd.doodads.map((d) => d.id).join(',')}|${hd.shot}|${plan}|${sprites.ready}|${sprites.scale}`;
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
        // iOS Safari sends no contextmenu on a long press: a 500 ms hold opens the card too.
        longPress(b, () => shellCard(c.name, c.weight, c.best));
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
    // Fire is never lit while the picked shot cannot go: it is grey (locked) and says why.
    const why = plan && fs === 'locked' ? hd.fireWhy ?? '' : '';
    setData(fire, 'why', why);
    if (changed(fire, 'title', why)) fire.title = why;
    if (why && changed(fire, 'aria-why', why)) fire.setAttribute('aria-label', `Fire, not ready: ${why}`);
    setText(fireWhyEl, why);
    setHidden(fireWhyEl, !why);
    if (why) {
      // Wide: over the shot tray (the valley between the forts, the dimmed chip just below).
      // Tall: in the free space of the crew row, left of Fire.
      const fr = rc.fire, tr = rc.tray;
      if (layout === 'wide') {
        setStyle(fireWhyEl, 'left', `${Math.round(clamp(tr.x + tr.w / 2, 110, W - 110))}px`);
        setStyle(fireWhyEl, 'top', `${Math.round(tr.y - 8)}px`);
        setStyle(fireWhyEl, 'transform', 'translate(-50%, -100%)');
      } else {
        setStyle(fireWhyEl, 'left', `${Math.round(Math.max(8, fr.x - 10 - 190))}px`);
        setStyle(fireWhyEl, 'top', `${Math.round(fr.y + fr.h / 2)}px`);
        setStyle(fireWhyEl, 'transform', 'translateY(-50%)');
      }
    }
    if (plan) autoPickReady();
    ownerRing(plan);
    setHidden(reframe, !(manual || topManual || bottomManual || wideLook || peek));
    if (plan) { openOnActiveHob(); }
    edgeMarks(plan, me);
    // onboarding prompts (1-1)
    updatePrompt(now, plan);
  }

  /** Wide layout, your Plan step: a marker on the screen edge for a Rival fort that is off screen
   *  (or cut), and an arrow where the aim arc runs off screen. Tall shows the target in the top lens. */
  function edgeMarks(plan: boolean, me: Side): void {
    const on = layout === 'wide' && plan && !paused && !handoffOpen;
    const l = LW[0];
    const cr = clearRect();
    let fortOff = false;
    if (on) {
      const fo = snap.forts[other(me)];
      const [ax, ay] = toScreen(l.rect, camWide, fo.x, fo.y);
      const [bx, by] = toScreen(l.rect, camWide, fo.x + fo.w, fo.y + fo.h);
      const left = Math.min(ax, bx), right = Math.max(ax, bx);
      // Off screen or cut by more than a quarter of its width.
      const seen = Math.max(0, Math.min(right, W) - Math.max(left, 0));
      fortOff = seen < 0.75 * (right - left) || peek;
      if (fortOff) {
        const toRight = (left + right) / 2 > W / 2;
        // While peeking the fort is in view: the key sits low, off it.
        const y = peek ? clamp(Math.max(ay, by) + 30, cr.y + 24, cr.y + cr.h - 24) : clamp((ay + by) / 2, cr.y + 24, cr.y + cr.h - 24);
        const name = setup.mode === 'duel' ? snap.sides[other(me)].name : setup.mode === 'yard' ? 'Dummy' : 'Rival';
        const back = peek;
        setText(fortMark, back ? 'Back to my fort' : toRight ? `View ${name} fort \u25B6` : `\u25C0 View ${name} fort`);
        if (changed(fortMark, 'aria', String(back))) fortMark.setAttribute('aria-label', back ? 'Back to my fort' : `View the ${name} fort`);
        setData(fortMark, 'side', toRight ? 'right' : 'left');
        setStyle(fortMark, 'top', `${Math.round(y)}px`);
        setStyle(fortMark, 'left', toRight ? 'auto' : `${Math.round(cr.x + 4)}px`);
        setStyle(fortMark, 'right', toRight ? `${Math.round(W - (cr.x + cr.w) + 4)}px` : 'auto');
      }
    }
    setHidden(fortMark, !fortOff);
    // The arc: the first preview point past the screen edge (the top strip counts as the edge).
    let exit: [number, number, number] | null = null;
    const pv = on ? snap.hud.preview : [];
    const top = cr.y;
    let px = 0, py = 0;
    for (let i = 0; i < pv.length; i++) {
      const [x, y] = toScreen(l.rect, camWide, pv[i][0], pv[i][1]);
      if (i > 0 && (x < 0 || x > W || y < top)) {
        const ang = (Math.atan2(y - py, x - px) * 180) / Math.PI;
        exit = [clamp(x, 18, W - 18), clamp(y, top + 18, H - 18), ang];
        break;
      }
      px = x; py = y;
    }
    setHidden(arcMark, !exit);
    if (exit && !pad.hidden) {
      // Never on the Fine Tune pad (n9): step clear of it, below or above.
      const pb = pad.getBoundingClientRect();
      if (exit[0] > pb.left - 18 && exit[0] < pb.right + 18 && exit[1] > pb.top - 18 && exit[1] < pb.bottom + 18) {
        exit[1] = pb.bottom + 22 < H - 18 ? pb.bottom + 22 : Math.max(top + 18, pb.top - 22);
        if (exit[1] > pb.top - 18 && exit[1] < pb.bottom + 18) exit[0] = pb.left - 24;
      }
    }
    if (exit) {
      setStyle(arcMark, 'left', `${Math.round(exit[0])}px`);
      setStyle(arcMark, 'top', `${Math.round(exit[1])}px`);
      setStyle(arcMark, '--a', `${Math.round(exit[2])}deg`);
    }
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
  /** Where the picked Hob is on screen, in the lens that aims (bottom or wide). */
  function pickedHobScreen(): [number, number] {
    const hb = snap.hobs.find((x) => x.id === snap.hud.hob);
    const ls = lensRects();
    const l = ls.find((x) => x.id === 'bottom' || x.id === 'wide') ?? ls[0];
    if (hb && l) return toScreen(l.rect, l.cam, hb.x, hb.y);
    const f = snap.forts[snap.hud.active];
    return l ? toScreen(l.rect, l.cam, f.x + f.w / 2, f.y + f.h / 2) : [W / 2, H / 2];
  }
  let nudgeUntil = 0;
  let nudged = false;
  function skyNudge(): void {
    if (nudged || !canAim()) return;
    nudged = true;
    nudgeUntil = performance.now() + 2600;
    say('Drag from your fort to aim');
  }
  const AIM_TEACH = 3;
  const aimStarts = () => app.progress.hints.filter((x) => x.startsWith('aim-start-')).length;
  function countAimStart(): void {
    const n = aimStarts();
    if (n < AIM_TEACH) { app.progress.hints.push(`aim-start-${n + 1}`); void app.saveProgress(); }
  }
  /** The ring on the picked Hob (your fort's grip) every Plan step until 3 aims were started from it. */
  function ownerRing(plan: boolean): void {
    const on = plan && !paused && !handoffOpen && drag?.mode !== 'aim' && aimStarts() < AIM_TEACH && !(layout === 'tall' && joined);
    setHidden(ownRing, !on);
    if (!on) return;
    const [x, y] = pickedHobScreen();
    setStyle(ownRing, 'left', `${Math.round(x)}px`);
    setStyle(ownRing, 'top', `${Math.round(y - 14)}px`);
  }

  // A turn opens on a Hob who can act (n1): when the picked Hob has no shot it may fire this turn,
  // the first crewmate who has one is picked instead, once per turn. None: Pass stays on offer.
  let actKey = '';
  function openOnActiveHob(): void {
    const hd = snap.hud;
    const key = `${turnCount}:${hd.active}`;
    if (key === actKey || !hd.shots.length) return;
    actKey = key;
    if (hd.fire === 'dug' || hd.shots.some((c) => c.ready)) return;
    const start = hd.hob;
    const crew = snap.hobs.filter((x) => x.side === hd.active && x.id !== start && x.state !== 'bonked')
      .sort((a, b) => (a.state === 'ready' ? 0 : 1) - (b.state === 'ready' ? 0 : 1));
    for (const c of crew) {
      if (!send({ cmd: 'pick_hob', id: c.id })) continue;
      snap = merge(snap, core.snapshot());
      if (snap.hud.shots.some((x) => x.ready)) { autoKey = ''; return; }
    }
    if (start && snap.hud.hob !== start && send({ cmd: 'pick_hob', id: start })) snap = merge(snap, core.snapshot());
  }

  function doneHint(id: string): void {
    if (!app.progress.hints.includes(id)) { app.progress.hints.push(id); void app.saveProgress(); }
  }
  function updatePrompt(now: number, plan: boolean): void {
    if (plan && !paused && now < nudgeUntil) {
      // A drag that started in the sky: once per battle, point at the fort to aim from.
      const [hx, hy] = pickedHobScreen();
      setText(prompt, 'Drag from your fort to aim');
      const half = Math.min(W / 2 - 8, (prompt.offsetWidth || 250) / 2 + 8);
      setStyle(prompt, 'left', `${Math.round(clamp(hx, half, W - half))}px`);
      setStyle(prompt, 'top', `${Math.round(clamp(hy - 96, 8, H - 120))}px`);
      setData(prompt, 'hint', 'sky');
      setHidden(prompt, false);
      setHidden(hand, true);
      return;
    }
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
      setText(prompt, 'Drag from your fort to aim');
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
  const canAim = () => snap.phase === 'plan' && isHuman(snap.hud.active) && !paused && !handoffOpen;

  /** Aiming starts only from your own fort (owner rule): a press on the fort, or within about two
   *  blocks of it, or within 48 px of the picked Hob. A press anywhere else pans the camera. */
  function onOwnFort(l: { rect: Rect; cam: Cam }, px: number, py: number): boolean {
    const f = snap.forts?.[snap.hud.active];
    if (!f) return true;
    const [wx, wy] = toWorld(l.rect, l.cam, px, py);
    const m = 32;
    const inX = wx >= f.x - m && wx <= f.x + f.w + m;
    const inY = wy >= Math.min(f.y, f.y - f.h) - m && wy <= Math.max(f.y, f.y + f.h) + m;
    if (inX && inY) return true;
    const hb = snap.hobs.find((x) => x.id === snap.hud.hob);
    if (hb) { const [hx, hy] = toScreen(l.rect, l.cam, hb.x, hb.y); if (Math.hypot(px - hx, py - hy) <= 48) return true; }
    return false;
  }

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
    if ((l.id === 'wide' || l.id === 'bottom') && canAim() && onOwnFort(l, e.clientX, e.clientY)) drag = { ...base, mode: 'maybe-aim', prevAim: snap.hud.aim ? { ...snap.hud.aim } : undefined };
    else drag = { ...base, skyAim: (l.id === 'wide' || l.id === 'bottom') && canAim() };
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
      countAimStart();
    }
    if (drag.mode === 'maybe-pan' && dist(drag) >= 8) drag.mode = 'pan';
    if (drag.mode === 'aim') aimFromDrag(drag);
    else if (drag.mode === 'pan') {
      const cam = drag.lens === 'top' ? camTop : camWide;
      if (drag.skyAim) skyNudge();
      if (drag.lens === 'bottom') {
        // Tall: a drag off the fort in the bottom lens pans it (it did nothing before, n3).
        bottomManual = true;
        camBottom.cx -= (e.clientX - prev.x) / camBottom.s;
        camBottom.cy += (e.clientY - prev.y) / camBottom.s;
        return;
      }
      if (drag.lens === 'top') topManual = true; else if (drag.lens === 'wide') manual = true; else return;
      cam.cx -= (e.clientX - prev.x) / cam.s;
      cam.cy += (e.clientY - prev.y) / cam.s;
    } else if (drag.mode === 'strip') stripLook(e.clientX);
  });

  /** How far a finger can pull from the anchor along (ux, uy) before it meets the screen edge. */
  function room(x0: number, y0: number, ux: number, uy: number, m: number): number {
    let t = Infinity;
    if (ux < 0) t = Math.min(t, (x0 - m) / -ux); else if (ux > 0) t = Math.min(t, (W - m - x0) / ux);
    if (uy < 0) t = Math.min(t, (y0 - m) / -uy); else if (uy > 0) t = Math.min(t, (H - m - y0) / uy);
    return Math.max(0, t);
  }
  function aimFromDrag(g: Gesture): void {
    let dx = g.x0 - g.x, dy = g.y - g.y0; // pull-back: shot goes opposite the pull, world y up
    if (app.settings.dragMode === 'point') { dx = -dx; dy = -dy; }
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    // A finger pinned on the screen edge can only slide along it, which would bend the angle
    // (asked 45, got 40). Once the pull meets the edge, the angle keeps the direction it had
    // and only the power follows the finger (QA playtest 1, m3).
    const m = 6;
    const atEdge = g.x <= m || g.x >= W - m || g.y <= m || g.y >= H - m;
    let ux = dx / len, uy = dy / len;
    if (atEdge && g.lockDir) { ux = g.lockDir[0]; uy = g.lockDir[1]; }
    else if (!atEdge) g.lockDir = [ux, uy];
    let deg = (Math.atan2(uy, ux) * 180) / Math.PI;
    if (deg < 0) deg = deg < -90 ? 180 : 0;
    const angle = Math.round(deg * 2) * 5;
    // Full power is reached before the finger meets the edge: the pull for 100 is the usual
    // 40% of the short side, or less when the anchor is near the edge (never under 64 px).
    const sgn = app.settings.dragMode === 'point' ? -1 : 1;
    const full = clamp(room(g.x0, g.y0, -ux * sgn, uy * sgn, m + 2), 64, 0.4 * Math.min(W, H));
    const along = Math.max(0, dx * ux + dy * uy);
    const power = clamp(Math.round((along / full) * 100), 0, 100);
    pendingAim = { angle, power }; // sent once per frame by flushAim
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

  // A picked shot that cannot go this turn (a Knack on a rest turn, a Knack with no uses left) is
  // swapped for a ready one (the Plain Shot first) once per turn and Hob. A player who then picks
  // the Knack by hand keeps it, and Fire stays grey with the core's reason.
  let autoKey = '';
  function autoPickReady(): void {
    const hd = snap.hud;
    const key = `${turnCount}:${hd.active}:${hd.hob}`;
    if (key === autoKey) return;
    const cur = hd.shots.find((c) => c.id === hd.shot);
    if (!hd.shots.length) return;
    autoKey = key;
    if (!cur || cur.ready) return;
    const pick = hd.shots.find((c) => c.ready && c.kind === 'plain') ?? hd.shots.find((c) => c.ready);
    if (pick && send({ cmd: 'pick_shot', id: pick.id })) snap = merge(snap, core.snapshot());
  }

  // ---------- fire, walk, keys ----------
  const afterAction = () => { padOpen = false; recallIdx = 0; manual = false; topManual = false; bottomManual = false; wideLook = false; peek = false; };
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
    if (snap.hud.fire === 'locked' && snap.hud.fireWhy) { showBanner(snap.hud.fireWhy, 'paper'); say(snap.hud.fireWhy); play('tap'); return; }
    const res = core.command({ cmd: 'fire' });
    lastRefusal = res.ok ? '' : res.error ?? '';
    if (res.ok) { doneHint('fire'); afterAction(); firePress(fire); play('fire_press'); return; }
    // Never a silent tap: say why, and move to the shot that can go when the core names one.
    const why = res.detail ?? snap.hud.fireWhy ?? 'That shot cannot fire now';
    showBanner(why, 'paper'); say(why); play('tap');
    if (res.readyShot) send({ cmd: 'pick_shot', id: res.readyShot });
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
    // No low-pass or pitch drop held on the music while the Pause card is up.
    slowmoAudio(false);
    const lvl = setup.level ? app.levels().find((l) => l.id === setup.level) : undefined;
    const goals = lvl ? h('ul', { class: 'goals' }, ...lvl.goals.map((g) => h('li', {}, g))) : '';
    // Give up where the core has the command.
    const giveUp = setup.mode !== 'yard' && core.features.giveUp ? btn('Give up', () => { closePause(); send({ cmd: 'give_up' }); }, 'secondary', { 'data-testid': 'give-up' }) : '';
    // Pass is always on offer on your turn, so no turn can lock.
    const pass = snap.hud.canPass ? btn('Pass turn', () => { closePause(); flushAim(); if (send({ cmd: 'pass' })) afterAction(); }, 'secondary', { 'data-testid': 'pass' }) : '';
    card('pause-card', 'pause-h',
      h('h2', { id: 'pause-h' }, 'Paused'),
      goals,
      h('p', { class: 'small' }, lvl ? 'Win by Clean Sweep or Kettle Pop.' : ''),
      btn('Resume', () => closePause(), 'primary', { 'data-autofocus': true }),
      pass,
      btn('Retry', () => { closePause(); void clearBattle(); app.go({ to: 'battle', setup: retrySetup(setup) }); }, 'secondary'),
      btn('Settings', () => {
        // Back from Settings takes over this live battle (core.battleGen); the save is the fallback.
        const data = core.saveBattle();
        app.go({ to: 'settings', back: { to: 'battle', setup, resume: data, live: core.battleGen, handoff: false, paused: true } });
      }, 'secondary', { 'data-testid': 'pause-settings' }),
      btn('Map', () => { void autosave(snap.hud.active, snap.round).then(() => app.go({ to: 'map' })); }, 'secondary', { 'data-testid': 'pause-map' }),
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
      handicapLine(side, help),
      h('p', { class: 'small' }, `♨ ${pct}%  ${crew.map((c) => CLASS_ICON[c.cls]).join(' ')}  Round ${round}/${snap.roundCap}`),
      ready,
    );
    play('sheet');
    handoffFlip(overlay.querySelector('.handoff') as HTMLElement, side, app.settings.reduceMotion);
    setTimeout(() => ready.focus(), 0);
  }

  /** The handicaps the core applies to this side (hud.handicap), shown openly: Help, Steam, preview share, crew. */
  function handicapLine(side: Side, help: string): HTMLElement | string {
    const hc = snap.hud.handicap?.[side];
    const parts: string[] = [];
    const hl = hc?.help ?? help;
    if (hl && hl !== 'none') parts.push(`Help: ${hl === 'some' ? 'Some +' : hl === 'lots' ? 'Lots ++' : hl}`);
    if (hc?.steam) parts.push(`Steam ${hc.steam > 0 ? '+' : ''}${hc.steam}`);
    if (hc?.previewPct !== undefined && hc.previewPct < 100) parts.push(`Preview ${hc.previewPct}%`);
    if (hc?.crew) parts.push(`Crew ${hc.crew}`);
    return parts.length ? h('p', { class: 'helpmark', 'data-testid': 'handicap' }, parts.join(' · ')) : '';
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
  if (snap.phase === 'plan' && setup.mode !== 'yard' && !r.paused) showTurnBanner(setup.mode === 'duel' ? `${snap.sides[snap.hud.active].name}'s turn` : 'Your turn', snap.hud.active === 0 ? 'blue' : 'orange');
  hud.append(liveEl);
  raf = requestAnimationFrame(frame);
  // The @2x art (1.9 MB) waits a minute in the very first fight, so the first load stays small;
  // from the second fight on it loads in idle time at once.
  const firstFight = !Object.keys(app.progress.levels).length && !r.resume;
  const upT = window.setTimeout(() => { if (alive) sprites.upgrade(); }, firstFight ? 60_000 : 0);
  // Nothing may scroll the battle sideways (focus or a wide banner did, and the HUD slid with the
  // shake, n8). Cards keep their own scroll.
  root.addEventListener('scroll', (e) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLElement) || overlay.contains(t)) return;
    if (t.scrollLeft || t.scrollTop) { t.scrollLeft = 0; t.scrollTop = 0; }
  }, true);
  root.dataset.core = core.name;
  root.dataset.testid = 'battle';
  // A resumed Couch Duel shows the hand-off card first, as the saved turn did.
  if (r.resume && r.handoff && setup.mode === 'duel' && setup.seats !== 'one' && snap.phase === 'plan') openHandoff(snap.hud.active, snap.round);
  // Back from Settings (opened from Pause) lands on the Pause card again, never straight in the fight.
  else if (r.paused && snap.phase !== 'over') openPause();

  // For tests and debugging only (dev, or ?debug in the URL): a read-only view of the latest snapshot.
  if (DEBUG) (window as unknown as { __castle?: unknown }).__castle = { snap: () => snap, layout: () => layout, core: core.name, cam: () => ({ ...camWide }), dpr: () => dpr, joined: () => joined, fx: feel.fx, wordBoxes: () => feel.fx.lastWords, feel: () => ({ terr: terr.rev, fx: feel.fx.live, collapse: feel.col.busy || feel.col.started > 0, slow: feel.juice.slowing, trauma: feel.juice.trauma }),
    // World point to screen px in the lens that aims ('aim': wide or bottom) or shows the target ('target': wide or top).
    toScreen: (x: number, y: number, which: 'aim' | 'target' = 'aim') => {
      const l = lensRects().find((q) => q.id === 'wide' || q.id === (which === 'aim' ? 'bottom' : 'top')) ?? lensRects()[0];
      return toScreen(l.rect, l.cam, x, y);
    },
    /** Screen boxes [x0, y0, x1, y1] of both forts: your fort in the aiming lens, the other in the target lens. */
    fortBoxes: () => [0, 1].map((side) => {
      const f = snap.forts[side as Side];
      const l = lensRects().find((q) => q.id === 'wide' || q.id === (side === youSide() ? 'bottom' : 'top')) ?? lensRects()[0];
      const [ax, ay] = toScreen(l.rect, l.cam, f.x, f.y);
      const [bx, by] = toScreen(l.rect, l.cam, f.x + f.w, f.y + f.h);
      return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
    }) };
  if (loadNote) app.notice(loadNote);

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
      releaseBarks();
      // iOS Safari frees canvas memory late: give every cache canvas back now (a few Retries
      // must not hit the canvas limit and draw blank).
      for (const k in caches) caches[k].free();
      terr.free();
      canvas.width = 0; canvas.height = 0;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', lose);
      clearTimeout(bannerT);
      clearTimeout(turnBannerT);
      clearTimeout(padT);
      clearTimeout(upT);
    },
  };
}

/** Keep the last full terrain view; merge incremental snapshot data. */
function merge(prev: Snapshot, next: Snapshot): Snapshot {
  next.events = [...(prev.events ?? []), ...next.events];
  next.terrain.chunks = [...(prev.terrain.chunks ?? []), ...next.terrain.chunks];
  return next;
}

/** A 500 ms hold with the finger still (under 10 px): for cards iOS will not open on contextmenu. */
function longPress(el: HTMLElement, fn: () => void): void {
  let t = 0, x = 0, y = 0;
  const stop = () => clearTimeout(t);
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    x = e.clientX; y = e.clientY;
    stop();
    t = window.setTimeout(() => { fn(); }, 500);
  });
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) stop(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, stop);
}

/** A Retry is the next try at the same fight: the core mixes the try count into the seed (rules v3). */
export function retrySetup(s: BattleSetup): BattleSetup {
  return { ...s, attempt: (s.attempt ?? 0) + 1 };
}

function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }
