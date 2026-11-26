// Loads the sprite atlas made by tools/art-gen (assets/, built to <base>/art by scripts/build-art.mjs).
// Atlas lists: atlas/castle@1x.json and castle@2x.json ->
//   { scale, v2?, trimmed?, dedupHobs?, pages: [page json], aliases?: { alias: canonical }, overlays?: { name: [{ sprite, dx, dy, rot?, scale? }] } }
// Each page: { image, size, scale, trimmed?, frames: { name: { x, y, w, h, trim?, sourceSize?, scale? } } }.
// Sizes and anchors (@1x px) come from sprites.json.
//
// Loading: the @1x page (one 2048 px page, WebP) is all the first load needs. On a high-DPI
// screen the @2x page(s) follow after the game is up, one at a time, and each page swaps
// its frames in as it lands. A low-DPI screen never fetches them.
// Backward-compatible with both legacy untrimmed atlases and v2 trimmed/deduplicated atlases.
// When the art is missing, every draw returns false and the renderer uses its plain shapes.

import { ctx2d, SKIA_WEBKIT } from './ctx2d';

/** Decoded pixels: an ImageBitmap where the browser has one, so pages are not decoded again each frame. */
export type Pix = (ImageBitmap | HTMLImageElement) & { width: number; height: number };
interface OverlayEntry { sprite: string; dx: number; dy: number; rot?: number; scale?: number }
interface RawFrame { x: number; y: number; w: number; h: number; trim?: [number, number, number, number]; sourceSize?: [number, number]; scale?: number }
interface Frame { img: Pix; x: number; y: number; w: number; h: number; scale: number; trim?: [number, number, number, number]; sourceSize?: [number, number] }
interface Meta { w: number; h: number; ax: number; ay: number }
interface Page { image: string; scale: number; trimmed?: boolean; frames: Record<string, RawFrame> }
interface AtlasIndex { scale?: number; pages: string[]; aliases?: Record<string, string>; overlays?: Record<string, OverlayEntry[]> }

const DEG = Math.PI / 180;
const BG = ['bg_downs_sky', 'bg_downs_hills_far', 'bg_downs_hills_near'];
const TILES = ['terrain_soil', 'terrain_loam', 'terrain_deep_soil'];

function blitLocal(ctx: CanvasRenderingContext2D, f: Frame, m: Meta | undefined): void {
  const ax = m ? m.ax : 0;
  const ay = m ? m.ay : 0;
  if (f.trim) {
    const inv = 1 / f.scale;
    ctx.drawImage(f.img, f.x, f.y, f.w, f.h, f.trim[0] * inv - ax, f.trim[1] * inv - ay, f.trim[2] * inv, f.trim[3] * inv);
  } else {
    const mw = m ? m.w : f.w / f.scale;
    const mh = m ? m.h : f.h / f.scale;
    ctx.drawImage(f.img, f.x, f.y, f.w, f.h, -ax, -ay, mw, mh);
  }
}

class SpriteBank {
  ready = false;
  /** 1 or 2: the best atlas scale loaded so far (bumps to 2 only after @2x BGs also finish). */
  scale = 0;
  /** Increments whenever background textures swap (invalidates LensCache cleanly). */
  bgVersion = 0;
  private frames = new Map<string, Frame>();
  private meta = new Map<string, Meta>();
  private aliases = new Map<string, string>();
  private overlays = new Map<string, OverlayEntry[]>();
  private textures = new Map<string, Pix>();
  private texUrls = new Map<string, string>();
  private urls = new Map<string, string>();
  /** Names asked for that the atlas does not have (debug builds read it to check every path resolves). */
  readonly misses = new Set<string>();
  private waiters: (() => void)[] = [];
  private upgradeWaiters = new Set<() => void>();
  private root = '';
  private upgrading = false;
  /** Background name (bg_x, bg_x@2x) -> file with its content hash, from bg.json. */
  private bg: Record<string, string> = {};

  async load(base: string): Promise<void> {
    this.root = `${base}art/`;
    try {
      const [meta] = await Promise.all([
        getJson<Record<string, [number, number, number, number]>>(`${this.root}sprites.json`),
      ]);
      for (const k in meta) { const m = meta[k]; this.meta.set(k, { w: m[0], h: m[1], ax: m[2], ay: m[3] }); }
      this.bg = await getJson<Record<string, string>>(`${this.root}bg.json`).catch(() => ({}));
      await this.loadScale(1);
      await Promise.all([
        ...BG.map(async (t) => { const i = await this.loadBg(t); if (i) { this.textures.set(t, await pix(i)); this.texUrls.set(t, i.src); } }),
        ...TILES.map(async (t) => { try { this.textures.set(t, await pix(await loadImg(`${this.root}sprites/${t}.png`))); } catch { /* optional */ } }),
      ]);
      this.ready = this.frames.size > 0;
    } catch (e) {
      console.info('[castle] no sprite atlas, using plain shapes:', (e as Error).message);
    }
    for (const w of this.waiters) w();
    this.waiters = [];
  }

  /**
   * High-DPI only: fetch the @2x pages and backgrounds in the background, one page at a time
   * so a game in progress never waits on them. Safe to call more than once.
   */
  upgrade(): void {
    if (this.upgrading || !this.ready || (window.devicePixelRatio || 1) < 1.5 || /[?&]art=1x/.test(location.search)) return;
    this.upgrading = true;
    const idle = (f: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void, o?: object) => void }).requestIdleCallback ?? ((g: () => void) => setTimeout(g, 200)))(f, { timeout: 2000 });
    idle(() => {
      void (async () => {
        try {
          await this.loadScale(2);
          for (const t of BG) {
            const i = await this.loadBg(`${t}@2x`);
            if (i) {
              const next = await pix(i);
              const old = this.textures.get(t);
              this.textures.set(t, next);
              this.texUrls.set(t, i.src);
              if (old && old !== next) freePix(old);
            }
          }
          this.urls.clear();
          this.scale = 2;
          this.bgVersion++;
          for (const w of this.upgradeWaiters) w();
        } catch (e) {
          console.info('[castle] @2x art not loaded:', (e as Error).message);
          this.upgrading = false; // try again at the next fight
        }
      })();
    });
  }

  private async loadBg(name: string): Promise<HTMLImageElement | undefined> {
    const f = this.bg[name];
    if (f) { try { return await loadImg(`${this.root}${f}`); } catch { return undefined; } }
    return loadTex(`${this.root}sprites/${name}`);
  }

  private async loadScale(scale: 1 | 2): Promise<void> {
    const list = await getJson<AtlasIndex>(`${this.root}atlas/castle@${scale}x.json`);
    // @1x: all pages at once (there is one). @2x: in turn, so the network stays free for play.
    const one = async (p: string) => {
      const page = await getJson<Page>(`${this.root}atlas/${p}`);
      const img = await pix(await loadImg(`${this.root}atlas/${page.image}`));
      for (const name in page.frames) {
        const f = page.frames[name];
        const old = this.frames.get(name);
        if (old && old.img !== img) replaced.add(old.img);
        this.frames.set(name, {
          img, x: f.x, y: f.y, w: f.w, h: f.h,
          scale: f.scale ?? page.scale,
          trim: f.trim,
          sourceSize: f.sourceSize,
        });
      }
    };
    const replaced = new Set<Pix>();
    if (scale === 1) await Promise.all(list.pages.map(one));
    else for (const p of list.pages) await one(p);
    if (list.aliases) {
      this.aliases.clear();
      for (const k in list.aliases) this.aliases.set(k, list.aliases[k]);
    }
    if (list.overlays) {
      this.overlays.clear();
      for (const k in list.overlays) this.overlays.set(k, list.overlays[k]);
    }
    if (scale === 1) this.scale = 1;
    // An @1x page no frame points at any more is closed (its decoded pixels freed).
    const used = new Set<Pix>();
    for (const f of this.frames.values()) used.add(f.img);
    for (const img of replaced) if (!used.has(img)) freePix(img);
  }

  whenLoaded(f: () => void): void { if (this.ready) f(); else this.waiters.push(f); }
  /** Notified when @2x art and backgrounds finish loading; returns an unsubscribe fn. */
  onUpgrade(f: () => void): () => void {
    if (this.scale >= 2) f();
    this.upgradeWaiters.add(f);
    return () => { this.upgradeWaiters.delete(f); };
  }

  private resolve(name: string): string { return this.aliases.get(name) ?? name; }

  has(name: string): boolean { return this.frames.has(this.resolve(name)); }
  size(name: string): { w: number; h: number; anchor: [number, number] } | undefined {
    const m = this.meta.get(name) ?? this.meta.get(this.resolve(name));
    return m ? { w: m.w, h: m.h, anchor: [m.ax, m.ay] } : undefined;
  }
  /** Backgrounds by base name (best scale loaded), terrain tiles by file name. */
  texture(name: string): Pix | undefined { return this.textures.get(name); }
  /** The URL of a background, for CSS. */
  textureUrl(name: string): string | undefined { return this.texUrls.get(name); }

  private drawOverlays(ctx: CanvasRenderingContext2D, ovs: OverlayEntry[]): void {
    for (let i = 0; i < ovs.length; i++) {
      const ov = ovs[i];
      const oc = this.resolve(ov.sprite);
      const of = this.frames.get(oc);
      if (!of) continue;
      const om = this.meta.get(ov.sprite) ?? this.meta.get(oc);
      ctx.save();
      ctx.translate(ov.dx, ov.dy);
      if (ov.rot) ctx.rotate(ov.rot * DEG);
      const os = ov.scale ?? 1;
      if (os !== 1) ctx.scale(os, os);
      blitLocal(ctx, of, om);
      ctx.restore();
    }
  }

  /**
   * Draw a sprite with its anchor at (x, y). `scale` is screen px per @1x sprite px.
   * Supports trimmed frames, per-frame scales, dedup aliases, and scarf/balloon overlays.
   * Returns false if the sprite is not loaded so the caller can draw a fallback.
   */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number, flip = false, alpha = 1): boolean {
    const canonical = this.resolve(name);
    const f = this.frames.get(canonical);
    if (!f) { if (this.ready) this.misses.add(name); return false; }
    const m = this.meta.get(name) ?? this.meta.get(canonical);
    const ovs = this.overlays.get(name);
    if (flip || (ovs && ovs.length > 0)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip ? -scale : scale, scale);
      if (alpha !== 1) ctx.globalAlpha *= alpha;
      blitLocal(ctx, f, m);
      if (ovs && ovs.length > 0) this.drawOverlays(ctx, ovs);
      ctx.restore();
      return true;
    }
    const ax = m ? m.ax : 0;
    const ay = m ? m.ay : 0;
    const prevAlpha = ctx.globalAlpha;
    if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
    if (f.trim) {
      const inv = scale / f.scale;
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, x + f.trim[0] * inv - ax * scale, y + f.trim[1] * inv - ay * scale, f.trim[2] * inv, f.trim[3] * inv);
    } else {
      const mw = m ? m.w : f.w / f.scale;
      const mh = m ? m.h : f.h / f.scale;
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, x - ax * scale, y - ay * scale, mw * scale, mh * scale);
    }
    if (alpha !== 1) ctx.globalAlpha = prevAlpha;
    return true;
  }

  /**
   * Draw with a turn (radians, about the anchor) and a squash (y scale about the anchor).
   * Used by the collapse, debris and the bonked float.
   */
  drawEx(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number, flip: boolean, alpha: number, rot: number, sy: number): boolean {
    if (rot === 0 && sy === 1) return this.draw(ctx, name, x, y, scale, flip, alpha);
    const canonical = this.resolve(name);
    const f = this.frames.get(canonical);
    if (!f) { if (this.ready) this.misses.add(name); return false; }
    const m = this.meta.get(name) ?? this.meta.get(canonical);
    const ovs = this.overlays.get(name);
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(flip ? -scale : scale, scale * sy);
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    blitLocal(ctx, f, m);
    if (ovs && ovs.length > 0) this.drawOverlays(ctx, ovs);
    ctx.restore();
    return true;
  }

  /** A data URL of one frame (reconstructed to full sourceSize if trimmed, with overlays composited), for DOM chips and portraits. Cached. */
  url(name: string): string | undefined {
    const u0 = this.urls.get(name);
    if (u0) return u0;
    const canonical = this.resolve(name);
    const f = this.frames.get(canonical);
    if (!f) { if (this.ready) this.misses.add(name); return undefined; }
    const m = this.meta.get(name) ?? this.meta.get(canonical);
    const ovs = this.overlays.get(name);
    const c = document.createElement('canvas');
    if (!f.trim && (!ovs || !ovs.length)) {
      c.width = f.w;
      c.height = f.h;
      ctx2d(c).drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    } else {
      const cw = f.sourceSize?.[0] ?? (m ? Math.round(m.w * f.scale) : f.w);
      const ch = f.sourceSize?.[1] ?? (m ? Math.round(m.h * f.scale) : f.h);
      c.width = Math.max(1, cw);
      c.height = Math.max(1, ch);
      const g = ctx2d(c);
      if (f.trim) g.drawImage(f.img, f.x, f.y, f.w, f.h, f.trim[0], f.trim[1], f.trim[2], f.trim[3]);
      else g.drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, cw, ch);
      if (ovs && ovs.length > 0) {
        const ax = m ? m.ax : 0;
        const ay = m ? m.ay : 0;
        g.save();
        g.translate(ax * f.scale, ay * f.scale);
        g.scale(f.scale, f.scale);
        this.drawOverlays(g, ovs);
        g.restore();
      }
    }
    const u = c.toDataURL('image/png');
    c.width = 0;
    c.height = 0;
    this.urls.set(name, u);
    return u;
  }
}

/**
 * Free a page or background the @2x art replaced. WebKit (Safari, every iOS browser) can still be
 * drawing it when the swap lands, and closing it there killed the web process (a RELEASE_ASSERT in
 * the 1-8 long fight, webkit-long). There it is left to the garbage collector; elsewhere it is
 * closed at once.
 */
const WEBKIT = typeof navigator !== 'undefined' && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);
function freePix(p: Pix): void {
  if (!WEBKIT && 'close' in p) (p as ImageBitmap).close();
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`no ${url}`);
  return (await r.json()) as T;
}

/** A background: WebP from the build, PNG when the build had no encoder. */
async function loadTex(base: string): Promise<HTMLImageElement | undefined> {
  try { return await loadImg(`${base}.webp`); } catch { /* try png */ }
  try { return await loadImg(`${base}.png`); } catch { return undefined; }
}

async function pix(i: HTMLImageElement): Promise<Pix> {
  // On WebKit/Linux the canvases are CPU-backed (ctx2d.ts) and an ImageBitmap there is a GPU
  // texture, so the decoded image is drawn as it is.
  if (typeof createImageBitmap !== 'function' || SKIA_WEBKIT) return i;
  try { return await createImageBitmap(i); } catch { return i; }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.decoding = 'async';
    // Decode before the first frame needs it, so the battle does not pay for a 2048 px page mid draw.
    i.onload = () => { (i.decode ? i.decode() : Promise.resolve()).then(() => res(i), () => res(i)); };
    i.onerror = () => rej(new Error(`image ${src}`));
    i.src = src;
  });
}

export const sprites = new SpriteBank();

/** Sprite names use the crew name; Rival Hobs in the mock have no name, so map by Class. */
const BY_CLASS: Record<string, string> = {
  lobber: 'marge', zinger: 'quill', scatterjack: 'jax', delver: 'grub', boinker: 'bobbin', patcher: 'hetty', sizzler: 'thumper', peeper: 'nan',
};
const NAMES = new Set(['marge', 'quill', 'jax', 'grub', 'bobbin', 'hetty', 'thumper', 'nan']);
export function hobSpriteName(id: string, cls: string): string {
  const bare = id.replace(/^p2_/, '').replace(/^old_thumper$/, 'thumper');
  return NAMES.has(bare) ? bare : BY_CLASS[cls] ?? 'marge';
}

/** True for the eight crew Hobs (their sprites exist in blue, orange and the Rival look). */
export function isCrewHob(id: string): boolean {
  return NAMES.has(id.replace(/^p2_/, '').replace(/^old_thumper$/, 'thumper'));
}

/**
 * The team look for a Hob's sprites: blue for side 0, orange for a Couch Duel player 2, and the
 * Rival look (Flattener slate hat, hatched scarf) for a crew Hob on the Rival side in campaign
 * and Skirmish. Flattener units on the Rival side use their own flattener_* sprites.
 */
export function hobTeam(side: number, mode: string): 'blue' | 'orange' | 'rival' {
  return side === 0 ? 'blue' : mode === 'duel' ? 'orange' : 'rival';
}

/** Flattener enemy sprite keys (matches tools/art-gen/sprite-flattener.mjs). */
const FLATTENER_BY_CLASS: Record<string, string> = {
  lobber: 'snipper', scatterjack: 'rake', peeper: 'clerk', zinger: 'sniper',
  delver: 'tamper', boinker: 'tamper', sizzler: 'pump', patcher: 'filler',
};
const FLATTENER_NAMES = new Set(['snipper', 'rake', 'clerk', 'sniper', 'tamper', 'pump', 'filler']);
export function flattenerSpriteName(id: string, cls: string): string {
  const bare = id.toLowerCase().replace(/^(flattener_|rival_|p2_)/, '');
  if (FLATTENER_NAMES.has(bare)) return bare;
  if (bare.includes('sniper') || bare.includes('ruler')) return 'sniper';
  if (bare.includes('snipper') || bare.includes('hedge')) return 'snipper';
  if (bare.includes('rake')) return 'rake';
  if (bare.includes('clerk') || bare.includes('clip')) return 'clerk';
  if (bare.includes('tamp')) return 'tamper';
  if (bare.includes('pump')) return 'pump';
  if (bare.includes('fill')) return 'filler';
  return FLATTENER_BY_CLASS[cls] ?? 'snipper';
}
