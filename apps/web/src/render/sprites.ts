// Loads the sprite atlas made by tools/art-gen (assets/, built to <base>/art by scripts/build-art.mjs).
// Atlas lists: atlas/castle@1x.json and castle@2x.json -> { scale, pages: [page json] }, each page
// { image, size, scale, frames: { name: { x, y, w, h } } }. Sizes and anchors (@1x px) come from sprites.json.
//
// Loading: the @1x page (one 2048 px page, WebP) is all the first load needs. On a high-DPI
// screen the four @2x pages follow after the game is up, one at a time, and each page swaps
// its frames in as it lands. A low-DPI screen never fetches them.
// When the art is missing, every draw returns false and the renderer uses its plain shapes.

/** Decoded pixels: an ImageBitmap where the browser has one, so pages are not decoded again each frame. */
export type Pix = (ImageBitmap | HTMLImageElement) & { width: number; height: number };
interface Frame { img: Pix; x: number; y: number; w: number; h: number; scale: number }
interface Meta { w: number; h: number; ax: number; ay: number }
interface Page { image: string; scale: number; frames: Record<string, { x: number; y: number; w: number; h: number }> }

const BG = ['bg_downs_sky', 'bg_downs_hills_far', 'bg_downs_hills_near'];
const TILES = ['terrain_soil', 'terrain_loam', 'terrain_deep_soil'];

class SpriteBank {
  ready = false;
  /** 1 or 2: the best atlas scale loaded so far. */
  scale = 0;
  private frames = new Map<string, Frame>();
  private meta = new Map<string, Meta>();
  private textures = new Map<string, Pix>();
  private texUrls = new Map<string, string>();
  private urls = new Map<string, string>();
  private waiters: (() => void)[] = [];
  private root = '';
  private upgrading = false;

  async load(base: string): Promise<void> {
    this.root = `${base}art/`;
    try {
      const [meta] = await Promise.all([
        getJson<Record<string, [number, number, number, number]>>(`${this.root}sprites.json`),
      ]);
      for (const k in meta) { const m = meta[k]; this.meta.set(k, { w: m[0], h: m[1], ax: m[2], ay: m[3] }); }
      await this.loadScale(1);
      await Promise.all([
        ...BG.map(async (t) => { const i = await loadTex(`${this.root}sprites/${t}`); if (i) { this.textures.set(t, await pix(i)); this.texUrls.set(t, i.src); } }),
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
    if (this.upgrading || !this.ready || (window.devicePixelRatio || 1) < 1.5) return;
    this.upgrading = true;
    const idle = (f: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void, o?: object) => void }).requestIdleCallback ?? ((g: () => void) => setTimeout(g, 200)))(f, { timeout: 2000 });
    idle(() => {
      void (async () => {
        try {
          await this.loadScale(2);
          for (const t of BG) { const i = await loadTex(`${this.root}sprites/${t}@2x`); if (i) { this.textures.set(t, await pix(i)); this.texUrls.set(t, i.src); } }
          this.urls.clear();
        } catch (e) { console.info('[castle] @2x art not loaded:', (e as Error).message); }
      })();
    });
  }

  private async loadScale(scale: 1 | 2): Promise<void> {
    const list = await getJson<{ pages: string[] }>(`${this.root}atlas/castle@${scale}x.json`);
    // @1x: all pages at once (there is one). @2x: in turn, so the network stays free for play.
    const one = async (p: string) => {
      const page = await getJson<Page>(`${this.root}atlas/${p}`);
      const img = await pix(await loadImg(`${this.root}atlas/${page.image}`));
      for (const name in page.frames) { const f = page.frames[name]; this.frames.set(name, { img, x: f.x, y: f.y, w: f.w, h: f.h, scale: page.scale }); }
    };
    if (scale === 1) await Promise.all(list.pages.map(one));
    else for (const p of list.pages) await one(p);
    this.scale = scale;
  }

  whenLoaded(f: () => void): void { if (this.ready) f(); else this.waiters.push(f); }

  has(name: string): boolean { return this.frames.has(name); }
  size(name: string): { w: number; h: number; anchor: [number, number] } | undefined {
    const m = this.meta.get(name);
    return m ? { w: m.w, h: m.h, anchor: [m.ax, m.ay] } : undefined;
  }
  /** Backgrounds by base name (best scale loaded), terrain tiles by file name. */
  texture(name: string): Pix | undefined { return this.textures.get(name); }
  /** The URL of a background, for CSS. */
  textureUrl(name: string): string | undefined { return this.texUrls.get(name); }

  /**
   * Draw a sprite with its anchor at (x, y). `scale` is screen px per @1x sprite px.
   * Returns false if the sprite is not loaded so the caller can draw a fallback.
   */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number, flip = false, alpha = 1): boolean {
    const f = this.frames.get(name);
    if (!f) return false;
    const m = this.meta.get(name);
    const mw = m ? m.w : f.w / f.scale, mh = m ? m.h : f.h / f.scale;
    const w = mw * scale, hh = mh * scale;
    const ax = (m ? m.ax : 0) * scale, ay = (m ? m.ay : 0) * scale;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, -ax, -ay, w, hh);
      ctx.restore();
    } else ctx.drawImage(f.img, f.x, f.y, f.w, f.h, x - ax, y - ay, w, hh);
    if (alpha !== 1) ctx.globalAlpha = 1;
    return true;
  }

  /**
   * Draw with a turn (radians, about the anchor) and a squash (y scale about the anchor).
   * Used by the collapse, debris and the bonked float.
   */
  drawEx(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number, flip: boolean, alpha: number, rot: number, sy: number): boolean {
    if (rot === 0 && sy === 1) return this.draw(ctx, name, x, y, scale, flip, alpha);
    const f = this.frames.get(name);
    if (!f) return false;
    const m = this.meta.get(name);
    const mw = m ? m.w : f.w / f.scale, mh = m ? m.h : f.h / f.scale;
    const ax = m ? m.ax : 0, ay = m ? m.ay : 0;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(flip ? -scale : scale, scale * sy);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(f.img, f.x, f.y, f.w, f.h, -ax, -ay, mw, mh);
    ctx.restore();
    return true;
  }

  /** A data URL of one frame, for DOM chips and portraits. Cached. */
  url(name: string): string | undefined {
    const u0 = this.urls.get(name);
    if (u0) return u0;
    const f = this.frames.get(name);
    if (!f) return undefined;
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    c.getContext('2d')!.drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const u = c.toDataURL('image/png');
    this.urls.set(name, u);
    return u;
  }
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
  if (typeof createImageBitmap !== 'function') return i;
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
