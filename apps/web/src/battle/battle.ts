// The battle screen: canvas lenses, HUD in both layouts, aim input, camera, hand-off card.
// It never decides an outcome. It sends commands to the core and draws its snapshots.
import type { App, Route, Screen } from '../app';
import { play, unlockAudio } from '../audio/sfx';
import type { BattleSetup, Command, PinView, Side, Snapshot } from '../core/types';
import { TICK_HZ } from '../core/types';
import { clearBattle, saveBattle } from '../save/db';
import { CLASS_COLOR, CLASS_ICON, btn, h, repeatKey } from '../ui/dom';
import { type Cam, type Rect, drawLens, drawStrip, newFx, stepFx, toScreen, toWorld } from '../render/draw';
import { TerrainLayer } from '../render/terrain';
import { hobSpriteName, sprites } from '../render/sprites';

type LensId = 'wide' | 'top' | 'bottom' | 'joined' | 'strip';

interface Gesture {
  id: number;
  lens: LensId;
  mode: 'maybe-aim' | 'aim' | 'maybe-pan' | 'pan' | 'strip';
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
  if (r.resume) core.loadBattle(r.resume);
  else if (!r.prepared) core.newBattle(setup);
  app.lastSetup = setup;
  let snap = core.snapshot();
  if (snap.phase === 'draft') { core.command({ cmd: 'end_draft' }); snap = merge(snap, core.snapshot()); }

  const terr = new TerrainLayer();
  terr.apply(snap.terrain);
  sprites.whenLoaded(() => { const t = sprites.texture('terrain_soil'); if (t) terr.setSoil(t); });
  const fx = newFx();
  const canvas = h('canvas', { class: 'field', 'aria-label': 'Battle field' });
  const ctx = canvas.getContext('2d')!;
  const root = h('div', { class: 'battle' }, canvas);
  const hud = h('div', { class: 'hud' });
  root.append(hud);

  // ---------- HUD parts ----------
  const kettleEl: [HTMLElement, HTMLElement] = [h('div', { class: 'kettle side0' }), h('div', { class: 'kettle side1' })];
  const pipsEl: [HTMLElement, HTMLElement] = [h('div', { class: 'pips side0' }), h('div', { class: 'pips side1' })];
  const roundEl = h('div', { class: 'round', 'aria-live': 'polite' });
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
    const slider = h('input', { type: 'range', min: -10, max: 10, step: 1, value: 0, 'aria-label': 'Wind' }) as HTMLInputElement;
    const lab = h('span', {}, 'Wind 0');
    slider.addEventListener('input', () => { send({ cmd: 'set_wind', wind: Number(slider.value) }); lab.textContent = `Wind ${slider.value}`; });
    yardBar = h('div', { class: 'yardbar' }, btn('Back', () => app.go(app.progress.blueprint ? { to: 'workshop' } : { to: 'map' }), 'small'), lab, slider);
  }

  // ---------- layout ----------
  let layout: 'wide' | 'tall' = app.layout;
  function relayout(): void {
    layout = app.layout;
    hud.className = `hud ${layout}`;
    if (drag?.mode === 'aim') endDrag(true);
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
    snapCams = true;
  }

  // ---------- canvas sizing ----------
  let W = 0, H = 0, dpr = 1;
  function resize(): void {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  const rectOf = (el: HTMLElement): Rect => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  function clearRect(): Rect {
    const t = top.getBoundingClientRect().bottom;
    const bottom = Math.min(trayEl.getBoundingClientRect().top, fire.getBoundingClientRect().top) - 4;
    const left = hobsEl.getBoundingClientRect().right + 4;
    return { x: left, y: t, w: Math.max(100, W - left - 8), h: Math.max(80, bottom - t) };
  }

  // ---------- cameras ----------
  const camWide: Cam = { cx: 1200, cy: 300, s: 0.4 };
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
  function ease(c: Cam, t: Cam, dt: number, cut: boolean): void {
    const k = cut || snapCams ? 1 : 1 - Math.exp(-dt * 5);
    c.cx += (t.cx - c.cx) * k;
    c.cy += (t.cy - c.cy) * k;
    c.s += (t.s - c.s) * k;
  }

  function updateCams(dt: number, now: number): void {
    const f = snap.forts;
    const rm = app.settings.reduceMotion;
    const sh = snap.shells[0];
    if (sh) { lastShell = [sh.x, sh.y]; holdUntil = now + 600; }
    const following = !!sh || now < holdUntil;
    const full: Rect = { x: 0, y: 0, w: W, h: H };
    if (layout === 'wide') {
      const cr = clearRect();
      let t: Cam;
      const bx0 = Math.min(f[0].x, f[1].x) - 140, bx1 = Math.max(f[0].x + f[0].w, f[1].x + f[1].w) + 140;
      const by0 = Math.min(f[0].y, f[1].y) - 60, by1 = Math.max(f[0].y + f[0].h, f[1].y + f[1].h) + 220;
      if (following && lastShell && !rm) {
        const [sx, sy] = lastShell;
        t = frameBox(cr, Math.min(bx0, sx - 200), Math.max(bx1, sx + 200), by0, Math.max(by1, sy + 120), 0.15, 2);
        t.s = Math.min(t.s, frameBox(cr, bx0, bx1, by0, by1, 0.15, 2).s);
      } else if (following && rm) {
        t = frameBox(cr, 0, 2400, 0, 720, 0.1, 2);
      } else {
        t = frameBox(cr, bx0, bx1, by0, by1, 0.15, 2);
        const bias = (snap.hud.active === 0 ? 1 : -1) * (bx1 - bx0) * 0.05;
        t.cx += bias * (setup.mode === 'duel' ? 0 : 1);
      }
      if (manual && !following) return;
      if (following) manual = false;
      t.s *= zoomWide;
      ease(camWide, toFull(full, cr, t), dt, rm);
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
      const s = clamp((8 * vw) / 390, 6, 14) / 16 * 1.0;
      const lowY = Math.min(f[0].y, f[1].y) - 30 + (rj.h / s) * 0.5;
      const t: Cam = { cx: lastShell[0], cy: Math.max(lowY, lastShell[1] - (rj.h / s) * 0.1), s };
      if (!wasJoined) { camJoin.cx = camBottom.cx; camJoin.cy = camBottom.cy + (rt.h / 2) / camBottom.s; camJoin.s = camBottom.s; }
      ease(camJoin, t, dt, false);
    }
    wasJoined = joined;
  }
  let wasJoined = false;

  function lensRects(): { id: LensId; rect: Rect; cam: Cam }[] {
    if (layout === 'wide') return [{ id: 'wide', rect: { x: 0, y: 0, w: W, h: H }, cam: camWide }];
    const rt = rectOf(lensTop), rb = rectOf(lensBottom), rs = rectOf(strip);
    if (joined) return [{ id: 'joined', rect: { x: rt.x, y: rt.y, w: rt.w, h: rb.y + rb.h - rt.y }, cam: camJoin }];
    return [
      { id: 'top', rect: rt, cam: camTop },
      { id: 'strip', rect: rs, cam: camTop },
      { id: 'bottom', rect: rb, cam: camBottom },
    ];
  }

  // ---------- commands ----------
  function send(c: Command): boolean {
    const res = core.command(c);
    return res.ok;
  }

  // ---------- frame loop ----------
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let fast = false;
  let alive = true;
  let ended = false;
  let turnHits = { blocks: 0, dmg: 0, who: '' };
  let firstDrop = true;
  let missCount = 0;
  let handoffOpen = false;
  let paused = false;
  const startT = performance.now();

  function frame(now: number): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && !handoffOpen) {
      acc += dt * TICK_HZ * (fast ? 2 : 1) * (snap.phase === 'rival' && app.settings.rivalFast ? 2 : 1);
      const n = Math.floor(acc);
      acc -= n;
      if (n > 0) {
        core.step(n);
        snap = merge(snap, core.snapshot());
      }
    } else {
      snap = merge(snap, core.snapshot());
    }
    terr.apply(snap.terrain);
    snap.terrain.chunks = [];
    handleEvents(now);
    stepFx(fx, dt);
    updateCams(dt, now);
    snapCams = false;
    render(now);
    updateHud(now);
  }

  function render(now: number): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#9ED8EC';
    ctx.fillRect(0, 0, W, H);
    const me = youSide();
    const human = snap.sides[snap.hud.active].human || setup.mode === 'yard';
    const plan = snap.phase === 'plan' && human;
    const lenses = lensRects();
    for (const l of lenses) {
      if (l.id === 'strip') continue;
      drawLens(ctx, l.rect, l.cam, snap, terr, fx, {
        you: me, seeThrough: plan ? snap.hud.active : -1, pickedHob: plan ? snap.hud.hob : undefined,
        showPreview: plan, time: (now - startT) / 1000, reduceMotion: app.settings.reduceMotion,
      });
    }
    if (layout === 'tall') {
      const rs = joined ? { ...rectOf(strip), y: rectOf(lensBottom).y + rectOf(lensBottom).h - 34 } : rectOf(strip);
      drawStrip(ctx, rs, snap, terr, joined ? [{ rect: lenses[0].rect, cam: camJoin }] : [{ rect: rectOf(lensTop), cam: camTop }, { rect: rectOf(lensBottom), cam: camBottom }], me);
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

  // ---------- events -> sound, effects, banners, save ----------
  function handleEvents(now: number): void {
    for (const e of snap.events) {
      switch (e.t) {
        case 'fire': play('fire'); setTimeout(() => play('whoosh'), 80); turnHits = { blocks: 0, dmg: 0, who: snap.sides[e.side].name }; break;
        case 'hit':
          if (e.dmg > 0) {
            fx.texts.push({ x: e.x, y: e.y, text: String(e.dmg), life: 1.2, max: 1.2, big: e.dmg > 50, color: '#FFF4DE' });
            fx.booms.push({ x: e.x, y: e.y - 12, t: 0, size: e.dmg > 60 ? 'large' : e.dmg > 30 ? 'medium' : 'small' });
            fx.shake = Math.min(12, fx.shake + e.dmg / 8);
            turnHits.dmg += e.dmg;
            play('hit');
          } else {
            play('thud');
            missCount++;
            fx.booms.push({ x: e.x, y: e.y, t: 0, size: 'small' });
          }
          for (let i = 0; i < 10; i++) fx.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 220, vy: Math.random() * 240, life: 0.7, max: 0.7, color: e.what === 'ground' ? '#9A6440' : '#FFF1D0', size: 4 });
          break;
        case 'break':
          turnHits.blocks++;
          play('break');
          for (let i = 0; i < 6; i++) fx.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 260, vy: Math.random() * 260, life: 0.9, max: 0.9, color: matColor(e.mat), size: 5 });
          break;
        case 'fall':
          if (e.count >= 6 && firstDrop) { firstDrop = false; fx.texts.push({ x: e.x, y: e.y + 30, text: 'Drop!', life: 1.4, max: 1.4, big: true, color: '#FFC23D' }); }
          play('thud');
          break;
        case 'bonk':
          fx.texts.push({ x: e.x, y: e.y + 40, text: 'Bonk!', life: 1.4, max: 1.4, big: true, color: '#FFD23F' });
          play('bonk');
          break;
        case 'boom':
          fx.booms.push({ x: e.x, y: e.y, t: 0, size: e.r > 40 ? 'large' : e.r > 22 ? 'medium' : 'small' });
          fx.shake = Math.min(12, fx.shake + e.r / 6);
          break;
        case 'kettle_pop': play('pop'); fx.texts.push({ x: snap.forts[e.side].x + snap.forts[e.side].w / 2, y: snap.forts[e.side].y + 80, text: 'Kettle Pop!', life: 2, max: 2, big: true, color: '#4FE3C1' }); break;
        case 'squall_warn': if (e.left === 3) showBanner('Squall in 3', 'slate'); break;
        case 'squall': if (e.n === 1) { showBanner('Sudden Squall', 'slate'); play('squall'); } break;
        case 'turn': onTurn(e.side, e.round, now); break;
        case 'end': onEnd(); break;
      }
    }
    snap.events = [];
  }

  let turnCount = 0;
  function onTurn(side: Side, round: number, _now: number): void {
    turnCount++;
    fast = false;
    padOpen = false;
    const human = snap.sides[side].human || setup.mode === 'yard';
    if (setup.mode === 'duel') {
      showBanner(`${snap.sides[side].name}'s turn`, side === 0 ? 'blue' : 'orange');
      play(side === 0 ? 'turn' : 'turn2');
      if (turnCount > 1 && setup.seats !== 'one') openHandoff(side, round);
    } else if (setup.mode !== 'yard') {
      if (human) { showBanner('Your turn', 'blue'); play('turn'); }
      else showBanner(`${snap.sides[side].name} aims`, 'orange');
    }
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
    void clearBattle();
    play(res && res.winner === 0 ? 'win' : setup.mode === 'duel' ? 'win' : 'lose');
    setTimeout(() => { if (alive) app.go({ to: 'results', setup }); }, app.settings.reduceMotion ? 600 : 1500);
  }

  let bannerT = 0;
  function showBanner(text: string, tone: string): void {
    banner.textContent = text;
    banner.className = `banner show ${tone}`;
    clearTimeout(bannerT);
    bannerT = window.setTimeout(() => banner.classList.remove('show'), 1200);
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
  let hudKey = '';
  function updateHud(now: number): void {
    const s = snap;
    const hd = s.hud;
    const me = youSide();
    const human = s.sides[hd.active].human || setup.mode === 'yard';
    const plan = s.phase === 'plan' && human;
    hud.classList.toggle('aiming', drag?.mode === 'aim');
    hud.classList.toggle('flight', s.phase === 'flight' || s.phase === 'resolve' || s.phase === 'rival' || !human);
    hud.dataset.phase = s.phase;
    hud.dataset.active = String(hd.active);
    // top strip
    for (const side of [0, 1] as Side[]) {
      const k = s.kettles.find((x) => x.side === side);
      const pct = k ? Math.round((100 * k.hp) / k.maxHp) : 0;
      kettleEl[side].textContent = `♨ ${pct}%`;
      kettleEl[side].dataset.state = pct <= 25 ? 'critical' : pct <= 50 ? 'hurt' : 'full';
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
    roundEl.textContent = sq.on ? `Squall ${sq.on} of 3` : `Round ${s.round}/${s.roundCap}${sq.warn ? `  Squall in ${sq.warn}` : ''}`;
    roundEl.classList.toggle('squall', !!sq.on);
    const arrow = (w: number) => (w === 0 ? '• 0' : `${w > 0 ? '→' : '←'} ${Math.abs(w)}`);
    windEl.textContent = `${arrow(s.wind)}   ⇢ ${Math.abs(s.forecast)}`;
    windEl.title = `Wind ${s.wind}, next ${s.forecast}`;
    top.dataset.active = String(hd.active);

    // crew
    const crew = s.hobs.filter((x) => x.side === me);
    const ck = crew.map((c) => `${c.id}:${c.hp}:${c.state}:${c.rest}`).join(',') + `|${hd.hob}|${plan}|${sprites.ready}`;
    if (ck !== hudKey) {
      hudKey = ck;
      hobsEl.replaceChildren(...crew.map((c) => {
        const pu = sprites.url(`portrait_${hobSpriteName(c.def ?? c.id, c.cls)}_${me === 0 ? 'blue' : 'orange'}`);
        const b = btn(h('span', { class: 'face' }, pu ? h('img', { src: pu, alt: '' }) : CLASS_ICON[c.cls]), () => { send({ cmd: 'pick_hob', id: c.id }); }, `hob ${c.id === hd.hob ? 'on' : ''} ${c.state}`, {
          'aria-label': `${c.name}, ${c.cls}, ${c.hp} HP${c.state === 'rest' ? ', needs a rest' : ''}`,
          style: `--c:${CLASS_COLOR[c.cls]};--f:${Math.round((360 * c.hp) / c.maxHp)}deg`,
          'data-hob': c.id,
          disabled: c.state === 'bonked' || !plan,
        });
        if (c.state === 'rest') b.append(h('em', { class: 'cog' }, `${c.rest}`));
        return b;
      }));
    }
    // tray
    const tk = hd.shots.map((x) => `${x.id}:${x.uses}:${x.ready}`).join(',') + `|${hd.shot}|${plan}|${sprites.ready}`;
    if (trayEl.dataset.k !== tk) {
      trayEl.dataset.k = tk;
      trayEl.replaceChildren(...hd.shots.map((c, i) => {
        const ic = c.icon ? sprites.url(`icon_${c.icon}`) : undefined;
        const b = btn(h('span', { class: 'nm' }, ic ? h('img', { src: ic, alt: '', class: 'ico' }) : '', c.name), () => send({ cmd: 'pick_shot', id: c.id }), `chip shot ${c.id === hd.shot ? 'on' : ''} ${c.ready ? '' : 'off'}`, {
          'aria-label': `${c.name}${c.uses >= 0 ? `, ${c.uses} left` : ''}${c.ready ? '' : ', not ready'}`,
          'data-key': String(i + 1), disabled: !plan,
        });
        if (c.uses >= 0) b.append(h('em', { class: 'uses' }, String(c.uses)));
        if (c.weight) b.append(h('i', { class: 'cogs' }, '⚙'.repeat(c.weight)));
        if (c.best && c.kind === 'shell') b.append(h('i', { class: 'best', style: `--c:${CLASS_COLOR[c.best]}` }, CLASS_ICON[c.best]));
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); shellCard(c.name, c.weight, c.best); });
        return b;
      }));
    }
    // walk
    walkEl.hidden = !hd.canWalk && !(plan && setup.mode !== 'campaign');
    (steamBar.children[0] as HTMLElement).style.width = `${hd.steam}%`;
    (steamBar.children[1] as HTMLElement).textContent = `S ${hd.steam}`;
    // readout
    const a = hd.aim;
    readout.textContent = a && a.power > 0 ? `${(a.angle / 10).toFixed(1)}° | ${a.power}` : '--';
    pad.hidden = !(plan && (padOpen || padAlways()));
    // fire
    const fs = hd.fire;
    fire.dataset.state = fs;
    fire.textContent = fs === 'fast' ? (fast ? '1x' : '2x') : 'FIRE';
    fire.hidden = fs === 'flight' || (!human && fs !== 'fast');
    reframe.hidden = !(manual || topManual || wideLook);
    // onboarding prompts (1-1)
    updatePrompt(now, plan);
  }

  function hint(id: string, text: string, target: HTMLElement | null, showHand = false): void {
    if (app.progress.hints.includes(id)) { prompt.hidden = true; hand.hidden = true; return; }
    prompt.textContent = text;
    prompt.hidden = false;
    prompt.dataset.hint = id;
    if (target) {
      const b = target.getBoundingClientRect();
      prompt.style.left = `${clamp(b.left + b.width / 2, 70, W - 70)}px`;
      prompt.style.top = `${Math.max(8, b.top - 44)}px`;
    }
    hand.hidden = !showHand;
  }
  function doneHint(id: string): void {
    if (!app.progress.hints.includes(id)) { app.progress.hints.push(id); void app.saveProgress(); }
  }
  function updatePrompt(_now: number, plan: boolean): void {
    prompt.hidden = true;
    hand.hidden = true;
    if (!plan || setup.level !== '1-1' || paused) return;
    if (!app.progress.hints.includes('drag')) {
      const r0 = layout === 'tall' ? rectOf(lensBottom) : clearRect();
      const [hx, hy] = (() => {
        const hb = snap.hobs.find((x) => x.id === snap.hud.hob);
        const l = lensRects().find((x) => x.id === 'bottom' || x.id === 'wide')!;
        return hb ? toScreen(l.rect, l.cam, hb.x, hb.y) : [r0.x + r0.w * 0.3, r0.y + r0.h * 0.6];
      })();
      hand.style.left = `${hx}px`;
      hand.style.top = `${hy}px`;
      prompt.style.left = `${clamp(hx + 60, 70, W - 70)}px`;
      prompt.style.top = `${Math.max(8, hy - 90)}px`;
      prompt.textContent = 'Drag to aim';
      prompt.hidden = false;
      hand.hidden = false;
      return;
    }
    if (!app.progress.hints.includes('fire') && snap.hud.fire === 'ready') { hint('fire', 'Fire!', fire); return; }
    if (missCount > 0 && !app.progress.hints.includes('pin') && snap.pins.some((p) => p.side === 0)) {
      const p = snap.pins.filter((x) => x.side === 0).slice(-1)[0];
      const l = lensRects().find((x) => x.id === 'top' || x.id === 'wide');
      if (p && l) {
        const [px, py] = toScreen(l.rect, l.cam, p.x, p.y);
        prompt.style.left = `${clamp(px, 70, W - 70)}px`;
        prompt.style.top = `${Math.max(8, py - 70)}px`;
        prompt.textContent = 'Tap the pin';
        prompt.hidden = false;
      }
    }
  }

  // ---------- input: aim drag, pan, pinch, taps ----------
  let drag: Gesture | null = null;
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
      if (drag?.mode === 'aim') endDrag(true);
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
    const a = snap.hud.aim;
    if (!a || a.angle !== angle || a.power !== power) send({ cmd: 'aim', angle, power });
    // edge help: slide the anchor away from a near edge while power is under 100
    if (power < 100) {
      const m = 12;
      if (g.x < m) g.x0 += m - g.x; else if (g.x > W - m) g.x0 -= g.x - (W - m);
      if (g.y < m) g.y0 += m - g.y; else if (g.y > H - m) g.y0 -= g.y - (H - m);
    }
  }

  function endDrag(cancel: boolean): void {
    if (!drag) return;
    const g = drag;
    drag = null;
    if (g.mode === 'aim') {
      lastDragEnd = performance.now();
      if (cancel || dist(g) < 12) {
        if (g.prevAim) send({ cmd: 'aim', angle: g.prevAim.angle, power: g.prevAim.power });
        return;
      }
      padNudge();
      if (app.settings.quickFire && !cancel) doFire(true);
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
    if (g.mode === 'aim') { endDrag(false); return; }
    drag = null;
    if (g.mode === 'strip') {
      const now = performance.now();
      if (now - lastTap < 320) { wideLook = !wideLook; topManual = false; } else stripLook(e.clientX);
      lastTap = now;
      return;
    }
    if (g.mode === 'maybe-aim' || g.mode === 'maybe-pan') tapAt(e.clientX, e.clientY);
  });
  const lose = () => { if (drag?.mode === 'aim') endDrag(true); drag = null; pinch = null; pointers.clear(); stopWalk(); };
  canvas.addEventListener('pointercancel', lose);
  canvas.addEventListener('lostpointercapture', (e) => { if (drag?.id === e.pointerId && drag.mode === 'aim') endDrag(false); });
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
  function doFire(fromDrag = false): void {
    unlockAudio();
    if (snap.hud.fire === 'fast') { fast = !fast; send({ cmd: 'fast', on: fast }); return; }
    if (!fromDrag && performance.now() - lastDragEnd < 150) return;
    if (!canAim()) return;
    if (send({ cmd: 'fire' })) { doneHint('fire'); padOpen = false; recallIdx = 0; manual = false; topManual = false; wideLook = false; }
  }
  fire.addEventListener('click', (e) => { e.preventDefault(); doFire(); });
  // Resolve speed-up: a tap anywhere during Resolve also speeds up (07 §2.8).
  root.addEventListener('pointerdown', () => { if (snap.phase === 'resolve' && !fast) { fast = true; } }, true);

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
    if (k === 'Escape' || k === 'p' || k === 'P') { paused ? closePause() : openPause(); e.preventDefault(); return; }
    if (paused) return;
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
  function card(cls: string, ...kids: (Node | string)[]): HTMLElement {
    const c = h('div', { class: `card ${cls}`, role: 'dialog', 'aria-modal': 'true' }, ...kids);
    const scrim = h('div', { class: 'scrim' }, c);
    overlay.replaceChildren(scrim);
    return scrim;
  }
  function closeCards(): void { overlay.replaceChildren(); }

  function openPause(): void {
    if (ended) return;
    paused = true;
    lose();
    const lvl = setup.level ? app.levels().find((l) => l.id === setup.level) : undefined;
    const goals = lvl ? h('ul', { class: 'goals' }, ...lvl.goals.map((g) => h('li', {}, g))) : '';
    const giveUp = setup.mode === 'duel' ? btn('Give up', () => { closePause(); send({ cmd: 'give_up' }); }, 'secondary') : '';
    card('pause-card',
      h('h2', {}, 'Paused'),
      goals,
      h('p', { class: 'small' }, lvl ? 'Win by Clean Sweep or Kettle Pop.' : ''),
      btn('Resume', () => closePause(), 'primary', { 'data-autofocus': true }),
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
    card(`handoff side${side}`,
      h('p', { class: 'lastshot' }, hits.who ? `${hits.who} hit: ${hits.blocks} blocks, ${Math.round(hits.dmg)} damage` : 'New turn'),
      h('div', { class: `crest ${side ? 'diamond' : 'round'}` }, '⚑'),
      h('p', {}, 'Pass the device to'),
      h('h2', { class: 'who' }, name.toUpperCase()),
      help !== 'none' ? h('p', { class: 'helpmark' }, `Help: ${help === 'some' ? 'Some +' : 'Lots ++'}`) : '',
      h('p', { class: 'small' }, `♨ ${pct}%  ${crew.map((c) => CLASS_ICON[c.cls]).join(' ')}  Round ${round}/${snap.roundCap}`),
      ready,
    );
    play('sheet');
    setTimeout(() => ready.focus(), 0);
  }

  function shellCard(name: string, weight: number, best?: string): void {
    const sc = card('shell-card',
      h('h3', {}, name),
      h('p', {}, `Weight: ${['Light', 'Medium', 'Heavy'][weight]}`),
      best ? h('p', {}, `Best with: ${best}`) : '',
      h('p', { class: 'small' }, 'Any Hob can fire it.'),
      btn('Close', () => closeCards(), 'secondary', { 'data-autofocus': true }),
    );
    sc.addEventListener('click', (e) => { if (e.target === sc) closeCards(); });
  }

  // ---------- start ----------
  relayout();
  for (const e of snap.events) if (e.t === 'turn') turnCount++;
  if (turnCount === 0 && snap.phase !== 'over') turnCount = 1;
  snap.events = snap.events.filter((e) => e.t !== 'turn');
  if (snap.phase === 'plan' && setup.mode !== 'yard') showBanner(setup.mode === 'duel' ? `${snap.sides[snap.hud.active].name}'s turn` : 'Your turn', snap.hud.active === 0 ? 'blue' : 'orange');
  raf = requestAnimationFrame(frame);
  root.dataset.core = core.name;
  root.dataset.testid = 'battle';

  // For tests and debugging: a read-only view of the latest snapshot.
  (window as unknown as { __castle?: unknown }).__castle = { snap: () => snap, layout: () => layout, core: core.name };

  return {
    el: root,
    relayout,
    destroy: () => {
      alive = false;
      cancelAnimationFrame(raf);
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
function matColor(m: string): string {
  return ({ wicker: '#E3B565', timber: '#B9733A', cobble: '#A9A39A', footing: '#5A4A42', brassbound: '#6B7A86' } as Record<string, string>)[m] ?? '#B9733A';
}
