import { className, t } from './text';
import { play } from '../audio/sfx';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/**
 * A button that acts on release with no minimum press time (07 §3.10).
 * The native click event fires only when the press went down and came up
 * inside the button, and it also fires for keys and assistive tech.
 */
export function btn(label: Child, act: () => void, cls = '', extra: Attrs = {}): HTMLButtonElement {
  const b = h('button', { class: `btn ${cls}`.trim(), type: 'button', ...extra }, label);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (b.disabled) return;
    if (!cls.includes('silent')) play('tap');
    act();
  });
  return b;
}

/**
 * A key with a tap action that repeats on hold: first repeat at 350 ms, then 8 a second,
 * 20 a second after 1 s (07 §3.2). A plain quick click still steps once. Nothing sticks
 * if the pointer is lost.
 */
export function repeatKey(label: Child, step: () => void, cls = '', extra: Attrs = {}): HTMLButtonElement {
  const b = h('button', { class: `btn key ${cls}`.trim(), type: 'button', ...extra }, label);
  let timer = 0;
  let repeated = false;
  let started = 0;
  // The window blur listener lives only while a key is held, so nothing is left behind.
  const stop = () => { clearTimeout(timer); timer = 0; window.removeEventListener('blur', stop); };
  const loop = () => {
    repeated = true;
    step();
    const rate = performance.now() - started > 1350 ? 50 : 125;
    timer = window.setTimeout(loop, rate);
  };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    repeated = false;
    started = performance.now();
    stop();
    timer = window.setTimeout(loop, 350);
    window.addEventListener('blur', stop);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) b.addEventListener(ev, stop);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    stop();
    if (!repeated) step();
    repeated = false;
  });
  return b;
}

export function seg<T extends string>(options: [T, string][], value: T, onPick: (v: T) => void, label?: string): HTMLElement {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const render = (v: T) => {
    wrap.replaceChildren(
      ...options.map(([k, text]) =>
        btn(text, () => { onPick(k); render(k); }, k === v ? 'chip on' : 'chip', { role: 'radio', 'aria-checked': String(k === v) }),
      ),
    );
  };
  render(value);
  return wrap;
}

export function toggle(label: string, value: boolean, onSet: (v: boolean) => void): HTMLElement {
  let v = value;
  const b = btn('', () => { v = !v; paint(); if (v) play('toggle_on'); else play('tap'); onSet(v); }, 'toggle silent', { role: 'switch' });
  const paint = () => { b.textContent = v ? t('common.on') : t('common.off'); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); };
  paint();
  return h('label', { class: 'row' }, h('span', {}, label), b);
}

export const CLASS_ICON: Record<string, string> = {
  lobber: '●', // bomb
  zinger: '⚡', // bolt
  scatterjack: '∴', // three dots
  delver: '▼', // drill
  boinker: '◎', // ball
  patcher: '+',
  sizzler: '♨',
  peeper: '◉',
};
export const CLASS_COLOR: Record<string, string> = {
  lobber: '#C4362B', zinger: '#3FA9F5', scatterjack: '#8BCB3A', delver: '#9A6A3A', boinker: '#F06EAA', patcher: '#2FB7A6', sizzler: '#B8325A', peeper: '#F2E05A',
};
/** Foreground color paired with each CLASS_COLOR so every badge meets WCAG AA (>= 4.5:1). */
export const CLASS_INK: Record<string, string> = {
  lobber: '#FFFFFF', zinger: '#2C221E', scatterjack: '#2C221E', delver: '#FFFFFF', boinker: '#2C221E', patcher: '#2C221E', sizzler: '#FFFFFF', peeper: '#2C221E',
};

export function classBadge(cls: string, side: 0 | 1 = 0): HTMLElement {
  const cap = className(cls);
  return h('span', { class: `cls ${side ? 'diamond' : 'round'}`, style: `--c:${CLASS_COLOR[cls] ?? '#888'};--fg:${CLASS_INK[cls] ?? '#2C221E'}`, title: cap, 'aria-label': cap }, h('i', {}, CLASS_ICON[cls] ?? '?'));
}
