// Keeps a view copy of the terrain mask from snapshot chunks and paints it to an
// offscreen canvas, one chunk at a time. View only: the core owns the real terrain.
// Part 2 Art Direction: painterly stratified cross-section soil (Loam, terracotta Clay,
// cool faceted slate Rock, espresso-basalt Bedrock, marsh Mud, sparkling Water) using
// 100% deterministic zero-allocation hash math.
import type { TerrainView } from '../core/types';

// Dark espresso storybook contour (#2C221E)
const INK_R = 44, INK_G = 34, INK_B = 30;
const solid = (c: number) => c >= 1 && c <= 5;

/** Deterministic integer hash (0..255), zero allocations. */
function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 255;
}

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
  /** The canvas rect each repaint touched, by rev (x0, y0, x1, y1 in canvas px, y down), newest last. */
  readonly dirtyLog: { rev: number; x0: number; y0: number; x1: number; y1: number }[] = [];
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
    const soil = this.soil;
    const soilW = this.soilW;
    for (let x = x0; x < x1; x++) {
      let top = 0;
      for (let y = H - 1; y >= 0; y--) if (solid(m[y * W + x])) { top = y; break; }
      this.tops[x] = top;
      const waveX = Math.sin(x * 0.042) * 3.2 + Math.cos(x * 0.11) * 1.4;
      for (let y = y0; y < y1; y++) {
        const p = ((H - 1 - y) * W + x) * 4;
        const code = m[y * W + x];
        if (code === 6) {
          // Translucent Downs brook water with pale sunlit surface crest
          const above = y + 1 < H ? m[(y + 1) * W + x] : 0;
          const above2 = y + 2 < H ? m[(y + 2) * W + x] : 0;
          if (above === 0) {
            d[p] = 205; d[p + 1] = 240; d[p + 2] = 252; d[p + 3] = 215;
          } else if (above2 === 0 && ((x + y) & 3) < 2) {
            d[p] = 152; d[p + 1] = 212; d[p + 2] = 242; d[p + 3] = 190;
          } else {
            const rip = ((x >> 3) + (y >> 2)) & 3 ? 0 : 10;
            d[p] = 86 + rip; d[p + 1] = 160 + rip; d[p + 2] = 214 + rip; d[p + 3] = 172;
          }
          continue;
        }
        if (!solid(code)) { d[p + 3] = 0; continue; }
        // depth below the open air straight above
        let depth = 0;
        while (depth < 14 && y + depth + 1 < H && solid(m[(y + depth + 1) * W + x])) depth++;
        let r: number, g: number, b: number;
        if (depth < 2) {
          r = INK_R; g = INK_G; b = INK_B;
        } else if (code === 1 && depth < 12) {
          // Lush layered meadow turf cap with dappled grass highlights & dark root seam
          const blade = hash2(x >> 1, y >> 1);
          if (depth < 5) {
            r = blade > 175 ? 142 : 124; g = blade > 175 ? 209 : 196; b = blade > 175 ? 114 : 106;
          } else if (depth < 9) {
            r = blade < 70 ? 86 : 100; g = blade < 70 ? 158 : 174; b = blade < 70 ? 80 : 90;
          } else if (depth < 11) {
            r = 78; g = 136; b = 74;
          } else {
            // Subtle root-to-loam transition seam
            r = 104; g = 74; b = 52;
          }
        } else if (code === 2) {
          // Clay (2): painterly stratified warm terracotta bands with horizontal sediment seams
          const bandY = (y + waveX) | 0;
          const band = ((bandY % 14) + 14) % 14;
          const grain = hash2(x, y);
          const peb = hash2(x >> 2, y >> 1);
          if (band === 0 || band === 7) {
            // Horizontal dark terracotta sediment seam
            r = 152; g = 88; b = 46;
          } else if (band < 4) {
            // Warm ochre-amber clay layer
            r = 214; g = 154; b = 82;
          } else if (band < 7) {
            // Mid warm terracotta clay
            r = 194; g = 124; b = 68;
          } else if (band < 11) {
            // Deep sunlit ochre-terracotta
            r = 204; g = 138; b = 72;
          } else {
            // Rich burnt sienna vein
            r = 176; g = 106; b = 56;
          }
          if (peb > 236) { r += 16; g += 12; b += 8; }
          else if (grain < 24) { r -= 16; g -= 12; b -= 8; }
        } else if (code === 3) {
          // Rock (3): cool faceted slate-grey angular strata + diagonal mineral veins
          const gx = (x + ((y >> 1) * 3)) >> 3;
          const gy = (y - (x >> 2)) >> 3;
          const facet = hash2(gx, gy) & 3;
          const diag = ((x + y * 2) % 23 + 23) % 23;
          const cross = ((x * 2 - y * 3) % 31 + 31) % 31;
          const glint = hash2(x, y);
          if (diag === 0 || (cross === 0 && (facet & 1) === 0)) {
            // Dark slate fracture seam
            r = 76; g = 85; b = 96;
          } else if (diag === 1) {
            // Cool lit bevel edge next to fracture
            r = 166; g = 176; b = 186;
          } else if (facet === 0) {
            r = 122; g = 132; b = 144;
          } else if (facet === 1) {
            r = 140; g = 150; b = 161;
          } else if (facet === 2) {
            r = 106; g = 116; b = 128;
          } else {
            r = 152; g = 161; b = 172;
          }
          if (glint > 246) { r += 18; g += 18; b += 16; }
          else if (glint < 14) { r -= 14; g -= 14; b -= 12; }
        } else if (code === 4) {
          // Bedrock (4): deep espresso-basalt crystalline bands
          const band = ((y + ((x >> 3) & 3)) % 11 + 11) % 11;
          const cell = hash2(x >> 2, y >> 2);
          if (band === 0) {
            r = 54; g = 44; b = 40;
          } else if (band < 4) {
            r = 82; g = 68; b = 62;
          } else if (band < 8) {
            r = 70; g = 58; b = 54;
          } else {
            r = 92; g = 78; b = 74;
          }
          if (cell > 238) { r += 18; g += 14; b += 18; }
          else if (cell < 22) { r -= 12; g -= 10; b -= 8; }
        } else if (code === 5) {
          // Mud (5): dark marshy peat with damp speckle & organic flecks
          const speck = hash2(x, y);
          const clump = hash2(x >> 2, y >> 2);
          if (clump < 64) { r = 88; g = 70; b = 48; }
          else if (clump > 195) { r = 124; g = 102; b = 72; }
          else { r = 106; g = 86; b = 60; }
          if (speck > 240) { r += 20; g += 18; b += 12; }
          else if (speck < 28) { r -= 18; g -= 14; b -= 10; }
        } else if (soil) {
          // Loam (1) with loaded terrain_soil tile + gentle depth darkening
          const q = (((H - 1 - y) % soilW) * soilW + (x % soilW)) * 4;
          const shade = y < 100 ? -10 : 0;
          r = soil[q] + shade; g = soil[q + 1] + shade; b = soil[q + 2] + shade;
        } else {
          // Fallback Loam (1): pebbled organic Puddingstone earth with warm undulating bands
          const band = (((y + waveX) | 0) % 18 + 18) % 18;
          const peb = hash2(x >> 2, y >> 2);
          const grain = hash2(x, y);
          if (band < 3) { r = 136; g = 86; b = 54; }
          else if (band < 11) { r = 154; g = 100; b = 64; }
          else { r = 144; g = 92; b = 58; }
          if (peb > 236 && (x & 3) > 0 && (y & 3) > 0) { r = 186; g = 136; b = 94; }
          else if (peb < 18 && (x & 3) < 3 && (y & 3) < 3) { r = 112; g = 68; b = 44; }
          else if (grain < 22) { r -= 14; g -= 10; b -= 8; }
        }
        d[p] = r < 0 ? 0 : r > 255 ? 255 : r;
        d[p + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        d[p + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        d[p + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0, x0, H - y1, x1 - x0, y1 - y0);
    this.dirty = true;
    this.rev++;
    this.dirtyLog.push({ rev: this.rev, x0, y0: H - y1, x1, y1: H - y0 });
    if (this.dirtyLog.length > 32) this.dirtyLog.shift();
  }

  /** The rects painted after `rev` up to now, or null when the log no longer reaches back that far. */
  dirtySince(rev: number): readonly { x0: number; y0: number; x1: number; y1: number }[] | null {
    const log = this.dirtyLog;
    if (!log.length || log[0].rev > rev + 1) return null;
    let i = log.length;
    while (i > 0 && log[i - 1].rev > rev) i--;
    return log.slice(i);
  }

  /** Give the canvas memory back (the screen is gone). */
  free(): void {
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.img = undefined;
    this.mask = new Uint8Array(0);
    this.w = 0;
    this.h = 0;
    this.dirtyLog.length = 0;
  }
}
