// UI motion from animations.json: the turn banner slide (data.turn_banner), the hand-off card
// (ui_handoff_flip plus data.hand_off_card), Pennant stamps (ui_pennant_earn), the coin spin
// (ui_button_coin_spin) and the Fire press (ui_fire_press timing and its fire event).
// Sprite clips play on small canvases from one shared ticker that runs only while one is live.
import { AnimPlayer, anims, trackKeyframes, type EventSink } from '../render/anim';
import { sprites } from '../render/sprites';
import { play } from '../audio/sfx';

interface Live { el: HTMLCanvasElement; p: AnimPlayer; scale: number; still: boolean; sink?: EventSink; done?: () => void }
const live: Live[] = [];
let raf = 0;
let last = 0;

function tick(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  for (let i = live.length - 1; i >= 0; i--) {
    const l = live[i];
    if (!l.el.isConnected) { live.splice(i, 1); continue; }
    if (!l.still) l.p.step(dt, l.sink);
    paint(l);
    // A still clip is painted once (sprites loaded) and leaves the ticker: no repaint every frame.
    if (l.p.done || (l.still && sprites.ready)) { live.splice(i, 1); if (l.p.done) l.done?.(); }
  }
  raf = live.length ? requestAnimationFrame(tick) : 0;
}

function paint(l: Live): void {
  const ctx = l.el.getContext('2d');
  const c = l.p.clip;
  const name = l.p.frame();
  if (!ctx || !c || !name) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, l.el.width, l.el.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sprites.draw(ctx, name, c.anchor[0] * l.scale, c.anchor[1] * l.scale, l.scale);
}

/**
 * A canvas that plays one clip. `still`: hold the first frame (Reduce motion holds loops still).
 * Returns null when the clip or the art is missing, so the caller keeps its plain look.
 */
export function clipCanvas(name: string, scale: number, opts: { reverse?: boolean; still?: boolean; delay?: number; sink?: EventSink; done?: () => void; cls?: string } = {}): HTMLCanvasElement | null {
  const c = anims.get(name);
  if (!c || !sprites.ready || !sprites.has(c.frames[0])) return null;
  const el = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  el.width = Math.round(c.w * scale * dpr);
  el.height = Math.round(c.h * scale * dpr);
  el.style.width = `${c.w * scale}px`;
  el.style.height = `${c.h * scale}px`;
  el.className = opts.cls ?? 'clip';
  el.setAttribute('aria-hidden', 'true');
  const p = new AnimPlayer().play(c, !!opts.reverse);
  const l: Live = { el, p, scale, still: !!opts.still, sink: opts.sink, done: opts.done };
  const start = () => {
    live.push(l);
    paint(l);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };
  if (opts.delay) { paint(l); setTimeout(start, opts.delay); } else start();
  return el;
}

/** Turn banner: slide in, hold, slide out from data.turn_banner; Reduce motion fades. Never blocks taps. */
export function turnBanner(el: HTMLElement, reduce: boolean, done: () => void): void {
  for (const a of el.getAnimations()) a.cancel();
  const d = anims.data?.turn_banner;
  if (!d || typeof el.animate !== 'function') { setTimeout(done, 1200); return; }
  const fmt = (k: string, v: number): [string, string] => (k === 'y' ? ['transform', `translate(-50%, ${v}px)`] : ['opacity', String(v)]);
  const inn = trackKeyframes(reduce ? { opacity: d.reduce_motion.in.opacity } : { y: d.in.y, opacity: d.in.opacity }, fmt);
  const out = trackKeyframes(reduce ? { opacity: d.reduce_motion.out.opacity } : { y: d.out.y, opacity: d.out.opacity }, fmt);
  const a = el.animate(inn.frames, { duration: inn.ms, fill: 'forwards' });
  a.onfinish = () => {
    const b = el.animate(out.frames, { duration: out.ms, delay: d.hold_ms, fill: 'forwards' });
    b.onfinish = () => { done(); b.cancel(); a.cancel(); };
  };
}

/**
 * Fire press: the button dips and springs back on the ui_fire_press frame times (40, 70, 90 ms).
 * The HUD key keeps its word, so the motion is the clip's timing on the key itself.
 */
export function firePress(el: HTMLElement): void {
  const c = anims.get('ui_fire_press');
  if (typeof el.animate !== 'function' || document.documentElement.classList.contains('reduce-motion')) return;
  const ms = c?.ms ?? [40, 70, 90];
  const total = ms[0] + ms[1] + ms[2];
  el.animate([
    { transform: 'translateY(0) scale(1)', offset: 0 },
    { transform: 'translateY(3px) scale(0.96)', offset: ms[0] / total },
    { transform: 'translateY(6px) scale(1.04, 0.9)', offset: (ms[0] + ms[1]) / total },
    { transform: 'translateY(0) scale(1)', offset: 1 },
  ], { duration: total, easing: 'ease-out' });
}

/** Hand-off card: pop-in scale (data.hand_off_card) and the crest flip, backwards for player 2 to player 1. */
export function handoffFlip(card: HTMLElement | null, side: number, reduce: boolean): void {
  if (!card) return;
  const d = anims.data?.hand_off_card;
  if (d && !reduce && typeof card.animate === 'function') {
    const k = trackKeyframes({ scale: d.in.scale, opacity: d.in.opacity }, (n, v) => (n === 'scale' ? ['transform', `scale(${v})`] : ['opacity', String(v)]));
    card.animate(k.frames, { duration: k.ms, easing: 'linear' });
  }
  const crest = card.querySelector('.crest');
  if (!crest) return;
  const cv = clipCanvas('ui_handoff_flip', 0.9, { reverse: side === 0, still: reduce, cls: 'clip flip', sink: (ev) => { if (ev === 'swap') play('handoff'); } });
  if (cv) crest.replaceWith(cv);
}
