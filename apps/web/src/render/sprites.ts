// Loads the sprite atlas made by tools/art-gen (assets/, copied to <base>/art by vite.config.ts).
// Atlas pages: atlas/castle@2x.json -> { scale, pages: [page json] }, each page
// { image, size, scale, frames: { name: { x, y, w, h } } }. Anchors and @1x sizes come from manifest.json.
// When the art is missing, every draw returns false and the renderer uses its plain shapes.

interface Frame { img: HTMLImageElement; x: number; y: number; w: number; h: number; scale: number }
interface Meta { w: number; h: number; anchor: [number, number] }

class SpriteBank {
  ready = false;
  private frames = new Map<string, Frame>();
  private meta = new Map<string, Meta>();
  private textures = new Map<string, HTMLImageElement>();
  private urls = new Map<string, string>();
  private waiters: (() => void)[] = [];

  async load(base: string): Promise<void> {
    try {
      const root = `${base}art/`;
      const [man, list] = await Promise.all([
        fetch(`${root}manifest.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('no manifest')))),
        fetch(`${root}atlas/castle@2x.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('no atlas')))),
      ]) as [{ sprites: { name: string; w: number; h: number; anchor: [number, number] }[] }, { pages: string[] }];
      for (const s of man.sprites) this.meta.set(s.name, { w: s.w, h: s.h, anchor: s.anchor });
      await Promise.all(list.pages.map(async (p) => {
        const page = (await (await fetch(`${root}atlas/${p}`)).json()) as { image: string; scale: number; frames: Record<string, { x: number; y: number; w: number; h: number }> };
        const img = await loadImg(`${root}atlas/${page.image}`);
        for (const [name, f] of Object.entries(page.frames)) this.frames.set(name, { img, ...f, scale: page.scale });
      }));
      const tex = ['bg_downs_sky@2x', 'bg_downs_hills_far@2x', 'bg_downs_hills_near@2x', 'terrain_soil', 'terrain_loam', 'terrain_deep_soil'];
      await Promise.all(tex.map(async (t) => {
        try { this.textures.set(t, await loadImg(`${root}sprites/${t}.png`)); } catch { /* optional */ }
      }));
      this.ready = this.frames.size > 0;
    } catch (e) {
      console.info('[castle] no sprite atlas, using plain shapes:', (e as Error).message);
    }
    for (const w of this.waiters) w();
    this.waiters = [];
  }

  whenLoaded(f: () => void): void { if (this.ready) f(); else this.waiters.push(f); }

  has(name: string): boolean { return this.frames.has(name); }
  size(name: string): Meta | undefined { return this.meta.get(name); }
  texture(name: string): HTMLImageElement | undefined { return this.textures.get(name); }

  /**
   * Draw a sprite with its anchor at (x, y). `scale` is screen px per @1x sprite px.
   * Returns false if the sprite is not loaded so the caller can draw a fallback.
   */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number, flip = false, alpha = 1): boolean {
    const f = this.frames.get(name);
    if (!f) return false;
    const m = this.meta.get(name) ?? { w: f.w / f.scale, h: f.h / f.scale, anchor: [0, 0] as [number, number] };
    const w = m.w * scale, hh = m.h * scale;
    const ax = m.anchor[0] * scale, ay = m.anchor[1] * scale;
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

  /** A data URL of one frame, for DOM chips and portraits. Cached. */
  url(name: string): string | undefined {
    if (this.urls.has(name)) return this.urls.get(name);
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

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => res(i);
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
  const bare = id.replace(/^p2_/, '');
  return NAMES.has(bare) ? bare : BY_CLASS[cls] ?? 'marge';
}
