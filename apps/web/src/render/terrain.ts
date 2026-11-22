// Keeps a view copy of the terrain mask from snapshot chunks and paints it to an
// offscreen canvas, one chunk at a time. View only: the core owns the real terrain.
import type { TerrainView } from '../core/types';

const MEADOW = [124, 196, 106];
const MEADOW_D = [90, 165, 85];
const LOAM = [154, 100, 64];
const LOAM_D = [122, 74, 46];
const INK = [43, 30, 46];
// terrain material codes: 1 Loam, 2 Clay, 3 Rock, 4 Bedrock, 5 Mud (6 Water is drawn see-through)
const MATS: Record<number, number[]> = { 2: [217, 164, 65], 3: [142, 150, 160], 4: [90, 74, 66], 5: [110, 90, 62] };
const solid = (c: number) => c >= 1 && c <= 5;

export class TerrainLayer {
  w = 0;
  h = 0;
  chunk = 64;
  mask = new Uint8Array(0);
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img?: ImageData;
  dirty = true;
  /** Bumped on every repaint (the lens background cache keys on it). */
  rev = 0;
  /** Column tops for the Field Strip silhouette. */
  tops = new Int16Array(0);

  private soil?: Uint8ClampedArray;
  private soilW = 0;

  /** Use the terrain_soil tile (1 px per cell at @1x) for the ground body, and repaint. */
  setSoil(img: CanvasImageSource & { width: number; height: number }): void {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    this.soil = x.getImageData(0, 0, img.width, img.height).data;
    this.soilW = img.width;
    if (this.w) this.paint(0, 0, this.w, this.h);
  }

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;
  }

  apply(t: TerrainView): void {
    if (t.width !== this.w || t.height !== this.h) {
      this.w = t.width;
      this.h = t.height;
      this.chunk = t.chunk;
      this.mask = new Uint8Array(t.width * t.height);
      this.canvas.width = t.width;
      this.canvas.height = t.height;
      this.img = this.ctx.createImageData(t.width, t.height);
      this.tops = new Int16Array(t.width);
    }
    if (!t.chunks.length) return;
    const C = t.chunk;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ch of t.chunks) {
      const x0 = ch.x ?? ch.cx * C, y0 = ch.y ?? ch.cy * C;
      const w = ch.w ?? C, hh = ch.h ?? C;
      if (ch.cells) {
        for (let row = 0; row < hh; row++) {
          const y = y0 + row;
          if (y < 0 || y >= this.h) continue;
          for (let col = 0; col < w; col++) {
            const x = x0 + col;
            if (x < this.w) this.mask[y * this.w + x] = ch.cells[row * w + col];
          }
        }
      } else if (ch.rle) {
        let i = 0, v = 0, left = ch.rle[0] ?? w * hh;
        for (let y = y0; y < y0 + hh; y++)
          for (let x = x0; x < x0 + w; x++) {
            while (left === 0 && i < ch.rle.length - 1) { i++; v ^= 1; left = ch.rle[i]; }
            left--;
            if (y < this.h && x < this.w) this.mask[y * this.w + x] = v;
          }
      }
      minX = Math.min(minX, x0); maxX = Math.max(maxX, x0 + w);
      minY = Math.min(minY, y0); maxY = Math.max(maxY, y0 + hh);
    }
    this.paint(Math.max(0, minX), Math.max(0, minY - 12), Math.min(this.w, maxX), Math.min(this.h, maxY + 2));
  }

  private paint(x0: number, y0: number, x1: number, y1: number): void {
    const img = this.img!;
    const d = img.data;
    const W = this.w, H = this.h, m = this.mask;
    for (let x = x0; x < x1; x++) {
      let top = 0;
      for (let y = H - 1; y >= 0; y--) if (solid(m[y * W + x])) { top = y; break; }
      this.tops[x] = top;
      for (let y = y0; y < y1; y++) {
        const p = ((H - 1 - y) * W + x) * 4;
        const code = m[y * W + x];
        if (code === 6) { d[p] = 95; d[p + 1] = 168; d[p + 2] = 220; d[p + 3] = 170; continue; }
        if (!solid(code)) { d[p + 3] = 0; continue; }
        // depth below the open air straight above
        let depth = 0;
        while (depth < 14 && y + depth + 1 < H && solid(m[(y + depth + 1) * W + x])) depth++;
        let c: number[];
        if (code !== 1 && depth >= 2) c = MATS[code] ?? LOAM;
        else if (depth < 2) c = INK;
        else if (depth < 8) c = MEADOW;
        else if (depth < 11) c = MEADOW_D;
        else if (this.soil) {
          const q = (((H - 1 - y) % this.soilW) * this.soilW + (x % this.soilW)) * 4;
          d[p] = this.soil[q]; d[p + 1] = this.soil[q + 1]; d[p + 2] = this.soil[q + 2]; d[p + 3] = 255;
          continue;
        } else c = ((x * 7 + y * 13) % 97 < 3) ? LOAM_D : LOAM;
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0, x0, H - y1, x1 - x0, y1 - y0);
    this.dirty = true;
    this.rev++;
  }
}
