// Builds public/art from assets/ for the web app: what the game draws and nothing else.
//
// - Atlas pages are converted to lossless WebP (about a third of the PNG size, pixel exact).
//   The page JSON is rewritten to name the .webp. With no `sharp` the PNG pages are copied.
// - manifest.json (350 KB) becomes sprites.json: name -> [w, h, anchorX, anchorY] only.
// - animations.json is copied as it is (the play order, times, events and motion data).
// - Backgrounds go out at @1x and @2x (the app loads @2x later, and only on high-DPI screens).
// - assets/audio/ (if the sound pass has made it) is copied with its audio.json.
//
// Converted images are cached by content hash in node_modules/.cache/castle-art, so a
// rebuild with no art change costs a few file copies. Run alone: node scripts/build-art.mjs
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(here, '../node_modules/.cache/castle-art');

let sharpMod;
async function sharp() {
  if (sharpMod !== undefined) return sharpMod;
  try { sharpMod = (await import('sharp')).default; } catch { sharpMod = null; }
  return sharpMod;
}

/** src PNG -> dest WebP (lossless). Returns false when no encoder is there. */
async function toWebp(src, dest) {
  const buf = readFileSync(src);
  const key = createHash('sha1').update(buf).update('webp-lossless-e6').digest('hex');
  const hit = join(CACHE, `${key}.webp`);
  if (!existsSync(hit)) {
    const sh = await sharp();
    if (!sh) return false;
    mkdirSync(CACHE, { recursive: true });
    await sh(buf).webp({ lossless: true, effort: 6 }).toFile(hit);
  }
  copyFileSync(hit, dest);
  return true;
}

export async function buildArt(src, dest, log = console.log) {
  rmSync(dest, { recursive: true, force: true });
  if (!src || !existsSync(src)) { log('[castle] no art assets found, skipping'); return { webp: false }; }
  mkdirSync(join(dest, 'atlas'), { recursive: true });
  mkdirSync(join(dest, 'sprites'), { recursive: true });

  // Sprite sizes and anchors (px at @1x), all the renderer needs from the manifest.
  const man = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
  const meta = {};
  for (const s of man.sprites) meta[s.name] = [s.w, s.h, s.anchor[0], s.anchor[1]];
  writeFileSync(join(dest, 'sprites.json'), JSON.stringify(meta));
  copyFileSync(join(src, 'animations.json'), join(dest, 'animations.json'));

  let webp = true;
  for (const list of ['castle@1x.json', 'castle@2x.json']) {
    const lp = join(src, 'atlas', list);
    if (!existsSync(lp)) continue;
    copyFileSync(lp, join(dest, 'atlas', list));
    for (const pj of JSON.parse(readFileSync(lp, 'utf8')).pages) {
      const page = JSON.parse(readFileSync(join(src, 'atlas', pj), 'utf8'));
      const png = join(src, 'atlas', page.image);
      const name = page.image.replace(/\.png$/, '.webp');
      if (await toWebp(png, join(dest, 'atlas', name))) page.image = name;
      else { webp = false; copyFileSync(png, join(dest, 'atlas', page.image)); }
      writeFileSync(join(dest, 'atlas', pj), JSON.stringify(page));
    }
  }
  const spr = join(src, 'sprites');
  for (const f of readdirSync(spr)) {
    if (/^bg_\w+(@2x)?\.png$/.test(f)) {
      if (!(await toWebp(join(spr, f), join(dest, 'sprites', f.replace(/\.png$/, '.webp'))))) copyFileSync(join(spr, f), join(dest, 'sprites', f));
    } else if (/^(terrain_\w+|app_icon-(192|512))\.png$/.test(f)) copyFileSync(join(spr, f), join(dest, 'sprites', f));
  }
  // Sound pass output, if it exists: audio.json plus its files.
  const au = join(src, 'audio');
  if (existsSync(au) && statSync(au).isDirectory()) {
    const copy = (from, to) => {
      mkdirSync(to, { recursive: true });
      for (const f of readdirSync(from)) {
        const p = join(from, f);
        if (statSync(p).isDirectory()) copy(p, join(to, f));
        else if (/\.(json|ogg|opus|mp3|m4a|aac|webm|wav)$/i.test(f) && !/^(README|\.)/.test(f)) copyFileSync(p, join(to, f));
      }
    };
    copy(au, join(dest, 'audio'));
  }
  log(`[castle] built art from ${src}${webp ? ' (atlas as WebP)' : ' (no sharp: atlas as PNG)'}`);
  return { webp };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildArt(process.env.CASTLE_ASSETS ?? resolve(here, '../../../assets'), resolve(here, '../public/art'));
}
