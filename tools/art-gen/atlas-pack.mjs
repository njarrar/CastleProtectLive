// Pure-Node atlas packing, PNG alpha-bbox trimming, and Hob deduplication helpers.
// Zero external dependencies; shared by render-sprites.mjs, gen-sprites.mjs, and verify-atlas.mjs.
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { SCARF_OVERLAYS, hobOverlayEntries, portraitOverlayEntries } from './sprite-hob.mjs';

// Old sprite names the apps still ask for, kept as aliases of the renamed sprite.
export const LEGACY_ALIASES = { icon_gravel: 'icon_gravel_sneeze' };

export const DEFAULT_PAGE = 2048;
export const DEFAULT_PAD = 2;

// Pure-Node PNG RGBA tight alpha-bbox decoder (supports all 5 PNG scanline filters, zero extra deps).
export function pngAlphaBbox(buf) {
  let p = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idats = [];
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len;
  }
  if (!w || !h || bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    return { trim: [0, 0, w, h], sourceSize: [w, h], opaquePixels: w * h };
  }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = 4, stride = w * bpp;
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  let minX = w, minY = h, maxX = -1, maxY = -1, opaquePixels = 0;
  for (let y = 0; y < h; y++) {
    const rowOff = y * (stride + 1);
    const ft = raw[rowOff];
    for (let i = 0; i < stride; i++) {
      const val = raw[rowOff + 1 + i];
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      if (ft === 0) cur[i] = val;
      else if (ft === 1) cur[i] = (val + a) & 255;
      else if (ft === 2) cur[i] = (val + b) & 255;
      else if (ft === 3) cur[i] = (val + ((a + b) >> 1)) & 255;
      else {
        const c = i >= bpp ? prev[i - bpp] : 0;
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        cur[i] = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < w; x++) {
      if (cur[x * 4 + 3] > 0) {
        opaquePixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  if (maxX < minX) return { trim: [0, 0, 1, 1], sourceSize: [w, h], opaquePixels: 0 };
  return { trim: [minX, minY, maxX - minX + 1, maxY - minY + 1], sourceSize: [w, h], opaquePixels };
}

function makeFrameRecord(it, x, y, pageScale) {
  const rec = it.trim
    ? { x, y, w: it.w, h: it.h, trim: it.trim, sourceSize: [it.sourceW, it.sourceH] }
    : { x, y, w: it.w, h: it.h };
  if (it.frameScale !== undefined && it.frameScale !== pageScale) rec.scale = it.frameScale;
  return rec;
}

// Legacy shelf packer (tallest first, 2 px gap). Matches original render-sprites.mjs behavior exactly.
export function packShelf(items, PAGE = DEFAULT_PAGE, PAD = DEFAULT_PAD, pageScale = 1) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || a.name.localeCompare(b.name));
  const pages = [];
  let pg = null, x = 0, y = 0, rowH = 0;
  const newPage = () => { pg = { frames: {}, items: [] }; pages.push(pg); x = PAD; y = PAD; rowH = 0; };
  newPage();
  for (const it of sorted) {
    if (x + it.w + PAD > PAGE) { x = PAD; y += rowH + PAD; rowH = 0; }
    if (y + it.h + PAD > PAGE) newPage();
    pg.frames[it.name] = makeFrameRecord(it, x, y, pageScale);
    pg.items.push({ ...it, x, y });
    x += it.w + PAD;
    rowH = Math.max(rowH, it.h);
  }
  return pages;
}

// Best-Short-Side-Fit (BSSF) MaxRects 2D bin packer for --trim / --v2 tight packing.
export function packMaxRects(items, PAGE = DEFAULT_PAGE, PAD = DEFAULT_PAD, pageScale = 1) {
  const sorted = [...items].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || (b.w * b.h) - (a.w * a.h) || a.name.localeCompare(b.name));
  const pages = [];
  const makePage = () => ({
    frames: {},
    items: [],
    free: [{ x: PAD, y: PAD, w: PAGE - PAD, h: PAGE - PAD }],
  });
  pages.push(makePage());

  const placeInPage = (pg, it, bestIdx) => {
    const f = pg.free[bestIdx];
    const px = f.x, py = f.y;
    const rw = it.w + PAD, rh = it.h + PAD;
    const next = [];
    for (const r of pg.free) {
      if (px >= r.x + r.w || px + rw <= r.x || py >= r.y + r.h || py + rh <= r.y) {
        next.push(r);
        continue;
      }
      if (px > r.x) next.push({ x: r.x, y: r.y, w: px - r.x, h: r.h });
      if (px + rw < r.x + r.w) next.push({ x: px + rw, y: r.y, w: (r.x + r.w) - (px + rw), h: r.h });
      if (py > r.y) next.push({ x: r.x, y: r.y, w: r.w, h: py - r.y });
      if (py + rh < r.y + r.h) next.push({ x: r.x, y: py + rh, w: r.w, h: (r.y + r.h) - (py + rh) });
    }
    // Prune free rectangles strictly contained inside another free rectangle.
    const pruned = [];
    for (let i = 0; i < next.length; i++) {
      const a = next[i];
      let contained = false;
      for (let j = 0; j < next.length; j++) {
        if (i === j) continue;
        const b = next[j];
        if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
          contained = true;
          break;
        }
      }
      if (!contained) pruned.push(a);
    }
    pg.free = pruned;
    pg.frames[it.name] = makeFrameRecord(it, px, py, pageScale);
    pg.items.push({ ...it, x: px, y: py });
  };

  for (const it of sorted) {
    const rw = it.w + PAD, rh = it.h + PAD;
    if (rw > PAGE - PAD || rh > PAGE - PAD) {
      throw new Error(`sprite ${it.name} (${it.w}x${it.h}) exceeds atlas page size ${PAGE}`);
    }
    let placed = false;
    for (const pg of pages) {
      let bestIdx = -1, bestShort = Infinity, bestLong = Infinity;
      for (let i = 0; i < pg.free.length; i++) {
        const fr = pg.free[i];
        if (rw <= fr.w && rh <= fr.h) {
          const shortSide = Math.min(fr.w - rw, fr.h - rh);
          const longSide = Math.max(fr.w - rw, fr.h - rh);
          if (shortSide < bestShort || (shortSide === bestShort && longSide < bestLong)) {
            bestShort = shortSide;
            bestLong = longSide;
            bestIdx = i;
          }
        }
      }
      if (bestIdx >= 0) {
        placeInPage(pg, it, bestIdx);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const pg = makePage();
      pages.push(pg);
      placeInPage(pg, it, 0);
    }
  }
  return pages.map(({ frames, items: placedItems }) => ({ frames, items: placedItems }));
}

const HOB_NEUTRAL_RE = /^hob_([a-z]+)_neutral_([a-z]+)_(\d+)$/;
const HOB_TEAM_RE = /^hob_([a-z]+)_(blue|orange)_([a-z]+)_(\d+)$/;
const PORTRAIT_NEUTRAL_RE = /^portrait_([a-z]+)_neutral$/;
const PORTRAIT_TEAM_RE = /^portrait_([a-z]+)_(blue|orange)$/;

// Build Hob deduplication aliases, scarf/balloon overlays, and canonical sprite list.
// Works seamlessly on BOTH neutral manifests (gen-sprites --dedup-hobs) and legacy manifests.
export function buildDedupTables(sprites) {
  const byName = new Map(sprites.map(s => [s.name, s]));
  const hasNeutralHobs = sprites.some(s => HOB_NEUTRAL_RE.test(s.name));
  const aliases = {};
  const overlays = {};
  const packedSprites = [];

  for (const s of sprites) {
    if (hasNeutralHobs) {
      const hm = HOB_NEUTRAL_RE.exec(s.name);
      if (hm) {
        const [, hk, pose, idxStr] = hm;
        const idx = Number(idxStr);
        for (const tk of ['blue', 'orange']) {
          const legacyName = `hob_${hk}_${tk}_${pose}_${idx}`;
          aliases[legacyName] = s.name;
          overlays[legacyName] = hobOverlayEntries(hk, tk, pose, idx);
        }
        packedSprites.push(s);
        continue;
      }
      const pm = PORTRAIT_NEUTRAL_RE.exec(s.name);
      if (pm) {
        const [, hk] = pm;
        for (const tk of ['blue', 'orange']) {
          aliases[`portrait_${hk}_${tk}`] = s.name;
          overlays[`portrait_${hk}_${tk}`] = portraitOverlayEntries(hk, tk);
        }
        packedSprites.push(s);
        continue;
      }
      // Skip any stray legacy team-duplicated hob/portrait if neutral already exists
      if (HOB_TEAM_RE.test(s.name) || PORTRAIT_TEAM_RE.test(s.name)) continue;
      packedSprites.push(s);
    } else {
      // Legacy manifest fallback: pack only blue base frames and alias both teams to them
      const hm = HOB_TEAM_RE.exec(s.name);
      if (hm) {
        const [, hk, tk, pose, idxStr] = hm;
        const idx = Number(idxStr);
        const canonical = byName.has(`hob_${hk}_blue_${pose}_${idx}`) ? `hob_${hk}_blue_${pose}_${idx}` : s.name;
        if (tk === 'orange' && canonical !== s.name) {
          aliases[s.name] = canonical;
          overlays[s.name] = hobOverlayEntries(hk, 'orange', pose, idx);
          continue;
        }
        if (tk === 'blue') {
          overlays[s.name] = hobOverlayEntries(hk, 'blue', pose, idx);
        }
        packedSprites.push(s);
        continue;
      }
      const pm = PORTRAIT_TEAM_RE.exec(s.name);
      if (pm) {
        const [, hk, tk] = pm;
        const canonical = `portrait_${hk}_blue`;
        if (tk === 'orange' && byName.has(canonical)) {
          aliases[s.name] = canonical;
          continue;
        }
        packedSprites.push(s);
        continue;
      }
      packedSprites.push(s);
    }
  }

  for (const [legacy, target] of Object.entries(LEGACY_ALIASES)) {
    if (!byName.has(legacy) && byName.has(target)) aliases[legacy] = target;
  }
  return {
    mode: hasNeutralHobs ? 'neutral-scarf' : 'legacy-dedup',
    scarfOverlays: Object.keys(SCARF_OVERLAYS),
    aliases: Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b))),
    overlays: Object.fromEntries(Object.entries(overlays).sort(([a], [b]) => a.localeCompare(b))),
    packedSprites,
  };
}

// Lossless PNG re-compression (Chromium screenshots use a fast zlib level). Decodes 8-bit RGB/RGBA,
// picks the best filter per row (smallest sum of abs values) and deflates at level 9.
// Other PNG kinds (palette, 16-bit, interlaced, APNG) are returned as they are.
export function pngRecompress(buf) {
  let p = 8, ihdr = null;
  const idats = [];
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idats.push(data);
    else if (type === 'acTL' || type === 'fcTL') return buf;
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!ihdr) return buf;
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), depth = ihdr[8], ct = ihdr[9], il = ihdr[12];
  if (depth !== 8 || (ct !== 6 && ct !== 2) || il !== 0) return buf;
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  // unfilter into pixels
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[row + i - bpp] : 0, b = y ? px[up + i] : 0, c = (i >= bpp && y) ? px[up + i - bpp] : 0;
      let v = raw[src + i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + i] = v & 255;
    }
  }
  // refilter: best of the 5 filters per row
  const out = Buffer.alloc((stride + 1) * h);
  const cand = Array.from({ length: 5 }, () => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = y * stride, up = row - stride;
    let best = 0, bestSum = Infinity;
    for (let ft = 0; ft < 5; ft++) {
      const cb = cand[ft];
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const x = px[row + i], a = i >= bpp ? px[row + i - bpp] : 0, b = y ? px[up + i] : 0, c = (i >= bpp && y) ? px[up + i - bpp] : 0;
        let v = x;
        if (ft === 1) v = x - a; else if (ft === 2) v = x - b; else if (ft === 3) v = x - ((a + b) >> 1);
        else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = x - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
        v &= 255; cb[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = ft; }
    }
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
  }
  const z = zlib.deflateSync(out, { level: 9, memLevel: 9 });
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const res = Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', Buffer.alloc(0))]);
  return res.length < buf.length ? res : buf;
}

// Re-compress every .png in a folder (not recursive). Returns [bytesBefore, bytesAfter].
export function recompressDir(dir, test = () => true) {
  let before = 0, after = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.png') || !test(f)) continue;
    const p = path.join(dir, f), b = fs.readFileSync(p), n = pngRecompress(b);
    before += b.length; after += n.length;
    if (n !== b) fs.writeFileSync(p, n);
  }
  return [before, after];
}
