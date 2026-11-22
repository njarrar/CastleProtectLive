// A lens is a rect on screen with a camera. World cells are y-up; screen px are y-down.
export interface Rect { x: number; y: number; w: number; h: number }
export interface Cam { cx: number; cy: number; s: number }

/** World x to screen x (no allocation; use in the draw loop). */
export function sx(r: Rect, c: Cam, x: number): number { return r.x + r.w / 2 + (x - c.cx) * c.s; }
/** World y to screen y. */
export function sy(r: Rect, c: Cam, y: number): number { return r.y + r.h / 2 - (y - c.cy) * c.s; }

export function toScreen(r: Rect, c: Cam, x: number, y: number): [number, number] {
  return [sx(r, c, x), sy(r, c, y)];
}
export function toWorld(r: Rect, c: Cam, px: number, py: number): [number, number] {
  return [c.cx + (px - r.x - r.w / 2) / c.s, c.cy - (py - r.y - r.h / 2) / c.s];
}

/** Effect art exists for wicker, timber, cobble and footing; Brassbound borrows Cobble's. */
export function matKey(m: string): string { return m === 'wicker' || m === 'timber' || m === 'footing' ? m : 'cobble'; }

export function stage(hp: number, max: number): number {
  const p = max ? hp / max : 1;
  return p >= 0.67 ? 0 : p >= 0.34 ? 1 : 2;
}

