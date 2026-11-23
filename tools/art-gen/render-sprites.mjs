// Render assets/svg/*.svg to PNG at @1x and @2x, pack the atlases, and draw the contact sheet.
// Needs Playwright chromium (same as render.mjs). Run gen-sprites.mjs first.
//   node tools/art-gen/render-sprites.mjs                all steps (untrimmed legacy atlas schema)
//   node tools/art-gen/render-sprites.mjs --trim         tight alpha-bbox atlas trimming (4 -> 2 pages)
//   node tools/art-gen/render-sprites.mjs --dedup-hobs   neutral Hob + 16x16 scarf overlay dedup + aliases/overlays
//   node tools/art-gen/render-sprites.mjs --v2           enables --trim --dedup-hobs together (4 -> 1 @2x page, ~16 MB VRAM)
//   node tools/art-gen/render-sprites.mjs sheet          only the contact sheets and the previews
//   node tools/art-gen/render-sprites.mjs anim           only the animation sheet and the previews
//
// NOTE on --trim / --v2 (opt-in until all 3 clients read frame.trim / frame.sourceSize / aliases / overlays):
//   When --trim is passed, each atlas page sets `"trimmed": true` and each frame emits:
//     { x, y, w, h, trim: [tx, ty, tw, th], sourceSize: [origW, origH], scale?: frameScale }
//   When --dedup-hobs (or --v2) is passed, castle@1x.json and castle@2x.json emit:
//     { scale, v2?, trimmed?, dedupHobs: true, pages: [...], scarfOverlays: [...], aliases: {...}, overlays: {...} }
//   Clients drawing a trimmed frame anchored at (ax, ay) in @1x px draw subrect (x, y, w, h)
//   using fs = frame.scale ?? page.scale to destination ((tx / fs - ax) * drawScale, (ty / fs - ay) * drawScale,
//   (tw / fs) * drawScale, (th / fs) * drawScale) and then composite overlays[name] if present.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pngAlphaBbox, packShelf, packMaxRects, buildDedupTables, recompressDir, DEFAULT_PAGE, DEFAULT_PAD } from './atlas-pack.mjs';
const mib = ([a, b]) => `${(a / 1048576).toFixed(1)} -> ${(b / 1048576).toFixed(1)} MiB`;
const require = createRequire(process.env.PLAYWRIGHT_ROOT || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const V2 = args.includes('--v2');
const TRIM = V2 || args.includes('--trim');
const DEDUP_HOBS = V2 || args.includes('--dedup-hobs');
const charScaleArg = args.find(a => a.startsWith('--char-scale='));
const CHAR_SCALE_2X = charScaleArg ? Number(charScaleArg.split('=')[1]) : (DEDUP_HOBS ? 1 : 2);
if (CHAR_SCALE_2X !== 1 && CHAR_SCALE_2X !== 2) throw new Error('--char-scale must be 1 or 2');
const assetsIdx = args.indexOf('--assets-dir');
const ASSETS = assetsIdx >= 0 && args[assetsIdx + 1] ? path.resolve(args[assetsIdx + 1]) : path.join(ROOT, 'assets');
const SPR = path.join(ASSETS, 'sprites'), ATL = path.join(ASSETS, 'atlas');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));
const only = args.find((a, i) => !a.startsWith('--') && (assetsIdx < 0 || i !== assetsIdx + 1)) || 'all';
const PAGE = DEFAULT_PAGE, PAD = DEFAULT_PAD;

const manByName = Object.fromEntries(manifest.sprites.map(s => [s.name, s]));
// Split an SVG file into its viewBox and inner markup.
const svgParts = (name) => {
  const txt = fs.readFileSync(path.join(ASSETS, manByName[name].svg), 'utf8');
  const m = /<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/.exec(txt);
  const [vx, vy, vw, vh] = m[1].split(/\s+/).map(Number);
  return { vx, vy, vw, vh, inner: m[2], head: txt.slice(0, txt.indexOf('>') + 1) };
};
// One SVG: the base sprite with overlays placed as the apps do it ({ sprite, dx, dy, rot, scale } in @1x px from the base anchor).
function compositeSvg(baseName, ovs) {
  const b = svgParts(baseName), bm = manByName[baseName];
  const kb = b.vw / bm.w, ax = b.vx + bm.anchor[0] * kb, ay = b.vy + bm.anchor[1] * kb;
  let inner = b.inner;
  for (const ov of ovs) {
    const om = manByName[ov.sprite];
    if (!om) throw new Error(`overlay sprite ${ov.sprite} is not in the manifest`);
    const o = svgParts(ov.sprite), ko = o.vw / om.w;
    const oax = o.vx + om.anchor[0] * ko, oay = o.vy + om.anchor[1] * ko;
    const k = (ov.scale ?? 1) * kb / ko;
    inner += `<g transform="translate(${ax + ov.dx * kb} ${ay + ov.dy * kb}) rotate(${ov.rot || 0}) scale(${k}) translate(${-oax} ${-oay})">${o.inner}</g>`;
  }
  return `${b.head}${inner}</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
// pages that load PNG files must come from a file URL, so write a temp page and open it
const TMP = path.join(ASSETS, '.tmp-render.html');
const openHtml = async (html) => { fs.writeFileSync(TMP, html); await page.goto('file://' + TMP, { waitUntil: 'load' }); };
const shot = async (html, w, h, file, clear = true) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}svg,img{display:block;position:absolute}</style></head><body>${html}</body></html>`);
  await page.screenshot({ path: file, omitBackground: clear, clip: { x: 0, y: 0, width: w, height: h } });
};

if (only === 'all') {
  // ---- sprites
  fs.rmSync(SPR, { recursive: true, force: true });
  fs.mkdirSync(SPR, { recursive: true });
  for (const s of manifest.sprites) {
    const svg = fs.readFileSync(path.join(ASSETS, s.svg), 'utf8');
    const sized = (w, h) => svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
    if (s.files['1x']) {
      await shot(sized(s.w, s.h), s.w, s.h, path.join(ASSETS, s.files['1x']));
      await shot(sized(s.w * 2, s.h * 2), s.w * 2, s.h * 2, path.join(ASSETS, s.files['2x']));
    } else {
      for (const [px, file] of Object.entries(s.files)) await shot(sized(+px, +px), +px, +px, path.join(ASSETS, file), false);
    }
  }
  console.log('rendered', manifest.sprites.length, 'sprites');

  // ---- legacy files for aliased names (--dedup-hobs / --v2). The atlas only holds the neutral Hob, but
  // the old per-team names (hob_marge_blue_idle_0, portrait_jax_orange, icon_gravel, ...) still get their
  // own PNG files, drawn as base + overlays exactly as the apps composite them. Not packed in the atlas.
  if (manifest.dedup && manifest.dedup.aliases) {
    let n = 0;
    for (const [alias, target] of Object.entries(manifest.dedup.aliases)) {
      const base = manByName[target];
      if (!base || !base.files['1x']) continue;
      const svg = compositeSvg(target, manifest.dedup.overlays?.[alias] || []);
      const sized = (w, h) => svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
      await shot(sized(base.w, base.h), base.w, base.h, path.join(SPR, `${alias}.png`));
      await shot(sized(base.w * 2, base.h * 2), base.w * 2, base.h * 2, path.join(SPR, `${alias}@2x.png`));
      n++;
    }
    console.log('rendered', n, 'legacy alias files (not in the atlas)');
  }

  console.log('sprites recompressed', mib(recompressDir(SPR)));

  // ---- atlases: shelf pack (legacy) or MaxRects BSSF (--trim / --dedup-hobs / --v2), 2 px gap
  fs.rmSync(ATL, { recursive: true, force: true });
  fs.mkdirSync(ATL, { recursive: true });
  const dedupInfo = DEDUP_HOBS
    ? (manifest.dedup
      ? { ...manifest.dedup, packedSprites: manifest.sprites.filter(s => s.atlas) }
      : buildDedupTables(manifest.sprites.filter(s => s.atlas)))
    : null;
  const atlasSprites = dedupInfo ? dedupInfo.packedSprites.filter(s => s.atlas) : manifest.sprites.filter(s => s.atlas);

  for (const [tag, k] of [['1x', 1], ['2x', 2]]) {
    let rawPx = 0, packedPx = 0;
    const items = atlasSprites.map(s => {
      // Character sprites (hobs/flatteners) are drawn at HOB_SCALE=0.4 (72x80 @1x is already 2.5x display size).
      // In --dedup-hobs / --v2 @2x mode, packing oversampled characters at CHAR_SCALE_2X (default 1) keeps all UI/props/blocks
      // at crisp @2x while fitting the entire cast + Part 2 props on 1 single 2048x2048 @2x page (~16 MB VRAM).
      const isOversampledChar = k === 2 && DEDUP_HOBS && (s.group === 'hobs' || s.group === 'flatteners') && !/^hob_(scarf|patch)_/.test(s.name);
      const frameScale = isOversampledChar ? CHAR_SCALE_2X : k;
      const srcTag = frameScale === 1 ? '1x' : tag;
      const origW = s.w * frameScale, origH = s.h * frameScale;
      rawPx += (s.w * k) * (s.h * k);
      if (TRIM) {
        const { trim, sourceSize } = pngAlphaBbox(fs.readFileSync(path.join(ASSETS, s.files[srcTag])));
        const sw = sourceSize[0] || origW, sh = sourceSize[1] || origH;
        packedPx += trim[2] * trim[3];
        return { name: s.name, w: trim[2], h: trim[3], sourceW: sw, sourceH: sh, trim, frameScale, file: s.files[srcTag] };
      }
      packedPx += origW * origH;
      return { name: s.name, w: origW, h: origH, sourceW: origW, sourceH: origH, trim: null, frameScale, file: s.files[srcTag] };
    });
    const pages = (TRIM || DEDUP_HOBS)
      ? packMaxRects(items, PAGE, PAD, k)
      : packShelf(items, PAGE, PAD, k);
    for (let i = 0; i < pages.length; i++) {
      const base = `castle@${tag}-${i}`;
      const html = pages[i].items.map(it => it.trim
        ? `<div class="crop" style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px"><img src="file://${path.join(ASSETS, it.file)}" style="left:${-it.trim[0]}px;top:${-it.trim[1]}px;width:${it.sourceW}px;height:${it.sourceH}px"></div>`
        : `<img src="file://${path.join(ASSETS, it.file)}" style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px">`).join('');
      await page.setViewportSize({ width: PAGE, height: PAGE });
      await openHtml(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}.crop{position:absolute;overflow:hidden}img{position:absolute;display:block}</style></head><body>${html}</body></html>`);
      await page.screenshot({ path: path.join(ATL, base + '.png'), omitBackground: true });
      const sorted = Object.fromEntries(Object.entries(pages[i].frames).sort(([a], [b]) => a.localeCompare(b)));
      const pageJson = TRIM
        ? { image: base + '.png', size: PAGE, scale: k, trimmed: true, ...(DEDUP_HOBS ? { dedupHobs: true } : {}), frames: sorted }
        : { image: base + '.png', size: PAGE, scale: k, ...(DEDUP_HOBS ? { dedupHobs: true } : {}), frames: sorted };
      fs.writeFileSync(path.join(ATL, base + '.json'), JSON.stringify(pageJson, null, 1) + '\n');
      console.log('atlas', base, Object.keys(sorted).length, 'frames');
    }
    if (TRIM || DEDUP_HOBS) {
      const savedPct = ((1 - packedPx / Math.max(1, rawPx)) * 100).toFixed(1);
      console.log(`atlas @${tag}${V2 ? ' v2' : ''}: ${pages.length} page(s), ${savedPct}% pixel footprint reduced`);
    }
    const indexJson = {
      scale: k,
      ...(V2 ? { v2: true } : {}),
      ...(TRIM ? { trimmed: true } : {}),
      ...(DEDUP_HOBS ? { dedupHobs: true } : {}),
      pages: pages.map((_, i) => `castle@${tag}-${i}.json`),
      ...(dedupInfo ? {
        scarfOverlays: dedupInfo.scarfOverlays,
        aliases: dedupInfo.aliases,
        overlays: dedupInfo.overlays,
      } : {}),
    };
    fs.writeFileSync(path.join(ATL, `castle@${tag}.json`), JSON.stringify(indexJson, null, 1) + '\n');
  }
}

if (only === 'all') console.log('atlas recompressed', mib(recompressDir(ATL)));

// ---- contact sheet: every sprite at @2x on paper, grouped
if (only !== 'anim') {
  const order = ['blocks', 'fort', 'kettle', 'stompers', 'hobs', 'flatteners', 'portraits', 'props', 'shells', 'icons', 'effects', 'ui', 'terrain', 'backgrounds', 'app'];
  let html = '';
  for (const grp of order) {
    const list = manifest.sprites.filter(s => s.group === grp);
    if (!list.length) continue;
    html += `<h2>${grp} (${list.length})</h2><div class="row">`;
    for (const s of list) {
      const file = s.files['2x'] || s.files['512'];
      let w = s.files['2x'] ? s.w * 2 : 512, h = s.files['2x'] ? s.h * 2 : 512;
      // small sprites are shown bigger so they can be checked; big ones smaller
      let z = w < 40 ? 3 : w < 80 ? 2 : 1;
      if (grp === 'hobs' || grp === 'flatteners') z = .75;
      if (w > 1000) z = 0.45;
      const label = grp === 'hobs' ? s.name.replace('hob_', '') : grp === 'flatteners' ? s.name.replace('flattener_', '') : s.name;
      html += `<figure><div class="cell" style="width:${w * z}px;height:${h * z}px"><img src="file://${path.join(ASSETS, file)}" style="width:${w * z}px;height:${h * z}px"></div><figcaption>${label}</figcaption></figure>`;
    }
    html += '</div>';
  }
  const css = `body{margin:0;padding:24px;background:#FFF4DE;font:11px/1.2 sans-serif;color:#2B1E2E;width:2352px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 8px;border-bottom:2px dashed #D9952B;padding-bottom:4px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}figure{margin:0;text-align:center}
.cell{background-color:#EADFC6;background-image:linear-gradient(45deg,#DCCFB2 25%,transparent 25%,transparent 75%,#DCCFB2 75%),linear-gradient(45deg,#DCCFB2 25%,transparent 25%,transparent 75%,#DCCFB2 75%);background-size:16px 16px;background-position:0 0,8px 8px;border-radius:4px;overflow:hidden}
img{display:block;image-rendering:auto}figcaption{max-width:150px;margin:2px auto 0;overflow-wrap:anywhere;opacity:.8;font-size:9px}`;
  await page.setViewportSize({ width: 2400, height: 1200 });
  await openHtml(`<!doctype html><html><head><style>${css}</style></head><body><h1>Castle Protect ${manifest.v2 ? 'v2' : 'v0.1'} sprites</h1><div>${manifest.count} sprites, shown at @2x (small ones enlarged). Made by tools/art-gen.</div>${html}</body></html>`);
  await page.screenshot({ path: path.join(ASSETS, 'contact-sheet.png'), fullPage: true });
  console.log('contact sheet done');
}

// ---- animation contact sheet: every animation as a strip of frames in play order
const ANIM = JSON.parse(fs.readFileSync(path.join(ASSETS, 'animations.json'), 'utf8'));
const byName = Object.fromEntries(manifest.sprites.map(s => [s.name, s]));
if (manifest.dedup && manifest.dedup.aliases) {
  for (const [alias, target] of Object.entries(manifest.dedup.aliases)) {
    // Use the composited legacy file (base + scarf) when it exists, so previews show the team colours.
    if (!byName[alias] && byName[target]) byName[alias] = fs.existsSync(path.join(SPR, `${alias}@2x.png`))
      ? { ...byName[target], name: alias, files: { '1x': `sprites/${alias}.png`, '2x': `sprites/${alias}@2x.png` } }
      : byName[target];
  }
}
const CHECK = `background-color:#EADFC6;background-image:linear-gradient(45deg,#DCCFB2 25%,transparent 25%,transparent 75%,#DCCFB2 75%),linear-gradient(45deg,#DCCFB2 25%,transparent 25%,transparent 75%,#DCCFB2 75%);background-size:16px 16px;background-position:0 0,8px 8px`;
{
  const SECT = [['Hobs', k => k.startsWith('hob_')], ['Flatteners', k => k.startsWith('flattener_')], ['Fort', k => /^(stomper|kettle|fx_kettle|loophole|pot_lid)/.test(k)], ['Collapse pieces', k => /^fx_(crack|chunk|dustcloud|rubble)/.test(k)], ['Shots and effects', k => k.startsWith('fx_')], ['UI motion', k => k.startsWith('ui_')]];
  const seen = new Set();
  let html = '';
  for (const [title, test] of SECT) {
    const keys = Object.keys(ANIM.animations).filter(k => !seen.has(k) && test(k));
    keys.forEach(k => seen.add(k));
    html += `<h2>${title} (${keys.length} animations)</h2><div class="row">`;
    let last = '';
    for (const k of keys) {
      const a = ANIM.animations[k];
      const w = a.w * 2, h = a.h * 2;
      const z = (title === 'Hobs' || title === 'Flatteners') ? .6 : w < 40 ? 3 : w < 80 ? 2 : 1;
      // one line per Hob/team or Flattener
      const who = title === 'Hobs' ? k.split('_').slice(0, 3).join('_') : title === 'Flatteners' ? k.split('_').slice(0, 2).join('_') : '';
      if (who && who !== last) { html += `</div><h3>${who}</h3><div class="row">`; last = who; }
      const cells = a.frames.map((n, i) => `<div class="cell${a.events && Object.values(a.events).includes(i) ? ' ev' : ''}" style="width:${w * z}px;height:${h * z}px"><img src="file://${path.join(ASSETS, byName[n].files['2x'])}" style="width:${w * z}px;height:${h * z}px"></div>`).join('');
      const total = a.ms.reduce((x, y) => x + y, 0);
      html += `<figure><div class="strip">${cells}</div><figcaption>${who ? k.slice(who.length + 1) : k} · ${a.pick ? 'pick by ' + a.pick : total + ' ms'}${a.loop ? ' loop' : ''}</figcaption></figure>`;
    }
    html += '</div>';
  }
  const css = `body{margin:0;padding:24px;background:#FFF4DE;font:11px/1.2 sans-serif;color:#2B1E2E;width:2352px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 8px;border-bottom:2px dashed #D9952B;padding-bottom:4px}h3{font-size:12px;margin:10px 0 3px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}figure{margin:0;text-align:center}.strip{display:flex;gap:2px}
.cell{${CHECK};border-radius:4px;overflow:hidden;box-sizing:content-box;border-bottom:3px solid transparent}.cell.ev{border-bottom-color:#E5484D}
img{display:block}figcaption{margin:2px auto 0;opacity:.8;font-size:9px}`;
  await page.setViewportSize({ width: 2400, height: 1200 });
  await openHtml(`<!doctype html><html><head><style>${css}</style></head><body><h1>Castle Protect animation frames</h1><div>${ANIM.count} animations from animations.json, frames in play order. A red bar marks a frame with an event. Made by tools/art-gen.</div>${html}</body></html>`);
  await page.screenshot({ path: path.join(ASSETS, 'contact-sheet-anim.png'), fullPage: true });
  console.log('animation contact sheet done');
  console.log('contact sheets recompressed', mib(recompressDir(ASSETS, f => f.startsWith('contact-sheet'))));
}

// ---- previews: animated PNG (APNG) files in assets/previews/. Any browser plays them
{
  const PRE = path.join(ASSETS, 'previews');
  fs.rmSync(PRE, { recursive: true, force: true });
  fs.mkdirSync(PRE, { recursive: true });
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const parse = (buf) => { const out = []; let p = 8; while (p < buf.length) { const len = buf.readUInt32BE(p); out.push({ type: buf.toString('latin1', p + 4, p + 8), data: buf.subarray(p + 8, p + 8 + len) }); p += 12 + len; } return out; };
  // frames: [{ png: Buffer, ms }], all the same size
  const apng = (all) => {
    // join frames that look the same
    const frames = [];
    for (const fr of all) { const last = frames[frames.length - 1]; if (last && last.png.equals(fr.png)) last.ms += fr.ms; else frames.push({ ...fr }); }
    const first = parse(frames[0].png), ihdr = first.find(c => c.type === 'IHDR').data;
    const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
    const actl = Buffer.alloc(8); actl.writeUInt32BE(frames.length, 0); actl.writeUInt32BE(0, 4);
    parts.push(chunk('acTL', actl));
    let seq = 0;
    frames.forEach((fr, i) => {
      const ch = i ? parse(fr.png) : first;
      if (!ch.find(c => c.type === 'IHDR').data.equals(ihdr)) throw new Error('preview frames differ in size or type');
      const fc = Buffer.alloc(26); fc.writeUInt32BE(seq++, 0); fc.writeUInt32BE(ihdr.readUInt32BE(0), 4); fc.writeUInt32BE(ihdr.readUInt32BE(4), 8); fc.writeUInt16BE(Math.round(fr.ms), 20); fc.writeUInt16BE(1000, 22);
      parts.push(chunk('fcTL', fc));
      for (const c of ch) if (c.type === 'IDAT') { if (!i) parts.push(chunk('IDAT', c.data)); else { const sq = Buffer.alloc(4); sq.writeUInt32BE(seq++); parts.push(chunk('fdAT', Buffer.concat([sq, c.data]))); } }
    });
    parts.push(chunk('IEND', Buffer.alloc(0)));
    return Buffer.concat(parts);
  };
  const img = (name, x, y, z, extra = '') => { const s = byName[name]; return `<img src="file://${path.join(ASSETS, s.files['2x'])}" style="left:${x - s.anchor[0] * z}px;top:${y - s.anchor[1] * z}px;width:${s.w * z}px;height:${s.h * z}px;${extra}">`; };
  const cache = new Map();
  const snap = async (w, h, html) => {
    const key = w + 'x' + h + html;
    if (!cache.has(key)) {
      await page.setViewportSize({ width: w, height: h });
      await openHtml(`<!doctype html><html><head><style>html,body{margin:0;overflow:hidden;background:#FFF4DE}img,div{position:absolute;display:block}</style></head><body>${html}</body></html>`);
      cache.set(key, await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
    }
    return cache.get(key);
  };
  // steps of a chain of animations: [[sprite, ms], ...]. A loop plays `loops` times
  const chain = (keys, loops = 2) => {
    const st = [];
    for (const k of keys) {
      const a = ANIM.animations[k];
      if (!a) { st.push([k, 500]); continue; }   // a plain sprite name: hold it
      const lf = a.loop ? (a.loop_from || 0) : a.frames.length;
      for (let i = 0; i < lf; i++) st.push([a.frames[i], a.ms[i]]);
      if (a.loop) for (let n = 0; n < loops; n++) for (let i = lf; i < a.frames.length; i++) st.push([a.frames[i], a.ms[i]]);
      if (a.hold) st.push([a.hold, 500]);
    }
    return st;
  };
  // side by side columns, each a chain. z = screen px per @1x px
  const columns = async (file, cols, z, loops) => {
    const chains = cols.map(c => chain(c, loops));
    let up = 0, down = 0, x = 12;
    const xs = [];
    for (const ch of chains) {
      let l = 0, r = 0;
      for (const [n] of ch) { const s = byName[n]; l = Math.max(l, s.anchor[0]); r = Math.max(r, s.w - s.anchor[0]); up = Math.max(up, s.anchor[1]); down = Math.max(down, s.h - s.anchor[1]); }
      xs.push(x + l * z); x += (l + r) * z + 12;
    }
    const W = Math.ceil(x), H = Math.ceil((up + down) * z + 24), y0 = 12 + up * z;
    const tot = chains.map(ch => ch.reduce((a, [, ms]) => a + ms, 0)), T = Math.max(...tot);
    const cuts = new Set([0]);
    chains.forEach((ch, i) => { for (let t0 = 0; t0 < T; t0 += tot[i]) { let t = t0; for (const [, ms] of ch) { if (t < T) cuts.add(t); t += ms; } } });
    const ts = [...cuts].sort((a, b) => a - b);
    const at = (ch, total, t) => { let u = t % total; for (const [n, ms] of ch) { if (u < ms) return n; u -= ms; } return ch[ch.length - 1][0]; };
    const frames = [];
    for (let i = 0; i < ts.length; i++) {
      const html = `<div style="left:0;top:${y0}px;width:${W}px;height:2px;background:#D9952B;opacity:.5"></div>` + chains.map((ch, c) => img(at(ch, tot[c], ts[i]), xs[c], y0, z)).join('');
      frames.push({ png: await snap(W, H, html), ms: (ts[i + 1] ?? T) - ts[i] });
    }
    fs.writeFileSync(path.join(PRE, file), apng(frames));
    console.log('preview', file, frames.length, 'frames');
  };
  const track = (tr, t) => { if (t <= tr[0][0]) return tr[0][1]; for (let i = 1; i < tr.length; i++) if (t <= tr[i][0]) { const [t0, v0] = tr[i - 1], [t1, v1] = tr[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); } return tr[tr.length - 1][1]; };
  const frameAt = (a, t, loop = true) => { const total = a.ms.reduce((x, y) => x + y, 0); let u = loop ? t % total : Math.min(t, total - 1); for (let i = 0; i < a.ms.length; i++) { if (u < a.ms[i]) return i; u -= a.ms[i]; } return a.ms.length - 1; };

  const H = (h, t, list) => [list.map(n => `hob_${h}_${t}_${n}`)].flat();
  await columns('hobs_fire.png', ['marge', 'thumper', 'quill', 'jax', 'nan', 'grub', 'bobbin', 'hetty'].map((h, i) => H(h, i % 2 ? 'orange' : 'blue', ['idle', 'fire', 'idle'])), 2, 1);
  await columns('hob_idle_hit_bonked.png', [H('quill', 'orange', ['idle', 'hit', 'bonked'])], 2, 3);
  await columns('hob_tumble_land.png', [H('grub', 'blue', ['tumble', 'land', 'idle'])], 2, 3);
  await columns('hob_cheer.png', [H('bobbin', 'orange', ['cheer', 'idle']), H('marge', 'blue', ['cheer', 'idle'])], 2, 1);
  await columns('hob_dig.png', [H('hetty', 'blue', ['dig', 'idle']), H('grub', 'orange', ['dig', 'idle'])], 2, 1);
  await columns('hob_nextdoor.png', ['grub', 'hetty', 'thumper', 'nan'].map((h, i) => H(h, i % 2 ? 'orange' : 'blue', ['nextdoor'])), 2, 1);
  await columns('kettle_pop.png', [['kettle_critical', 'kettle_pop']], 4, 1);
  await columns('fort_parts.png', [['fx_kettle_steam'], ['loophole_open', 'loophole_flap_blue_close'], ['loophole_open', 'loophole_flap_orange_close'], ['pot_lid_raise']], 4, 1);
  await columns('collapse_pieces.png', [['fx_crack_cobble'], ['fx_chunk_cobble'], ['fx_chunk_timber'], ['fx_chunk_wicker'], ['fx_rubble_cobble'], ['fx_rubble_wicker'], ['fx_dustcloud']], 4, 2);
  await columns('trails.png', ['blast', 'pierce', 'dig', 'fire', 'mend'].map(n => ['fx_trail_' + n]), 8, 1);
  await columns('impacts.png', ['wicker', 'timber', 'cobble', 'footing', 'dirt'].map(n => ['fx_impact_' + n]), 4, 1);
  await columns('splash_fizz.png', [['fx_splash'], ['fx_fizz_bubble', 'fx_fizz_pop']], 4, 2);
  await columns('weather.png', [['fx_squall'], ['fx_wind_leaf']], 4, 1);
  await columns('marks.png', [['fx_pin_p1_drop'], ['fx_pin_p2_drop'], ['fx_ghost_dot_p1_pulse'], ['fx_ghost_dot_p2_pulse'], ['fx_shimmer']], 4, 1);
  await columns('ui_motion.png', [['ui_fire', 'ui_fire_press'], ['ui_pennant_empty', 'ui_pennant_earn'], ['ui_button_coin_spin'], ['ui_handoff_flip']], 2, 1);

  // fort walk: a small fort on four Stompers, moved by data.fort_bob. Shows how the data is used
  {
    const z = 3, W = 320, Hh = 320, gx = 80, ground = 270, hipY = ground - (30 - 4.57) * z + 2;
    const bob = ANIM.data.fort_bob, wa = ANIM.animations.stomper_blue_walk, frames = [];
    const rows = [['timber', 'timber', 'timber'], ['cobble', 'cobble', 'cobble'], ['footing', 'footing', 'footing']];
    for (let i = 0; i < 12; i++) {
      const fi = i % 6, t = i * bob.frame_ms;
      let body = '';
      rows.forEach((r, ry) => r.forEach((m, cx) => { body += img(`block_${m}_fresh`, cx * 16 * z, ry * 16 * z, z); }));
      body += img('hob_marge_blue_idle_' + [0, 1, 0, 3][Math.floor(t / 400) % 4], 24 * z, 0, 24 / 50 * z) + img('flag_blue', 2 * z, 0, z);
      let html = `<div style="left:0;top:${ground}px;width:${W}px;height:${Hh - ground}px;background:#7CC46A"></div>`;
      // ground marks slide back so the fort reads as walking on the spot
      for (let k = 0; k < 6; k++) html += `<div style="left:${((k * 75.4 - i * 12.57) % 452.4 + 452.4) % 452.4 - 30}px;top:${ground + 14}px;width:26px;height:5px;border-radius:3px;background:#5AA555"></div>`;
      for (const [hx, ph, back] of [[10, 3, true], [38, 0, true], [10, 0, false], [38, 3, false]]) html += img(`stomper_blue_walk_${(fi + ph) % 6}`, gx + hx * z, hipY + bob.dy[fi] * z * .5, z, back ? 'filter:brightness(.7)' : '');
      html += `<div style="left:${gx}px;top:${hipY - 48 * z + 4 + bob.dy[fi] * z}px;width:${48 * z}px;height:${48 * z}px;transform-origin:50% 100%;transform:rotate(${bob.tilt[fi]}deg)">${body}</div>`;
      if (bob.stomp_frames.includes(fi)) html += img('fx_dust_0', gx + (fi ? 12 : 54) * z, ground - 4, z * .8);
      frames.push({ png: await snap(W, Hh, html), ms: bob.frame_ms });
    }
    fs.writeFileSync(path.join(PRE, 'fort_walk.png'), apng(frames));
    console.log('preview fort_walk.png');
  }
  // collapse: creak, lean, staggered drop, land, break. Driven by data.collapse
  {
    const z = 4, W = 340, Hh = 360, x0 = 120, floor = 310, c = ANIM.data.collapse, m = 'cobble', frames = [];
    const fall = 16 * z, T0 = 300, T1 = T0 + c.lean.ms, step = 40, end = 2400;
    for (let t = 0; t < end; t += step) {
      let html = `<div style="left:0;top:${floor}px;width:${W}px;height:${Hh - floor}px;background:#9A6440"></div>`;
      html += img('block_footing_fresh', x0 - 16 * z, floor - 16 * z, z) + img('block_cobble_fresh', x0 - 16 * z, floor - 32 * z, z) + img('block_cobble_fresh', x0 - 16 * z, floor - 48 * z, z);
      // two blocks hang off the side of the wall; the block under them has just gone. Row 0 is the lower one and lets go first
      for (let r = 0; r < 2; r++) {
        const start = T1 + r * c.drop.row_gap_ms, restY = floor - 16 * z - 16 * z * (r + 1), dur = 200;
        const u = Math.min(1, Math.max(0, (t - start) / dur)), y = restY - fall + fall * u * u, landed = t - (start + dur);
        const sh = t < T0 ? track(c.creak.shiver_x, t) * z : 0, wob = t < T0 ? track(c.wobble_deg[m], t) : 0;
        const lean = t >= T0 && landed < 0 ? c.lean.deg[m] * track(c.lean.track, t - T0) : 0;
        const breakAt = 60;
        if (landed < breakAt) {
          const sq = landed >= 0 ? track(c.land.squash_y, landed) : 1;
          html += `<div style="left:${x0 + sh}px;top:${y}px;width:${16 * z}px;height:${16 * z}px;transform-origin:0% 100%;transform:rotate(${wob + lean}deg) scaleY(${sq})">${img(`block_${m}_${r ? 'scuffed' : 'battered'}`, 0, 0, z)}${t < T1 ? img(`fx_crack_${m}_${Math.min(2, Math.floor(t / 100))}`, 0, 0, z) : ''}</div>`;
        } else {
          const b = landed - breakAt, ra = ANIM.animations[`fx_rubble_${m}`], bx = x0, by = floor - 16 * z * (r + 1);
          if (r === 0 && b < 1500 + 270) html += img(b < 240 ? ra.frames[frameAt(ra, b, false)] : ra.hold, bx, by + 16 * z * 0, z, `opacity:${b > 1400 ? Math.max(0, 1 - (b - 1400) / 300) : 1}`);
          if (b < c.break.ms + 150) for (let k = 0; k < c.break.chunks_per_block[m]; k++) {
            const vx = (k - 1.5) * 34 + r * 12, v = b / 1000, ca = ANIM.animations[`fx_chunk_${m}`];
            html += img(ca.frames[(frameAt(ca, b) + k) % 4], bx + 8 * z + vx * v * z, by + 8 * z + (-70 * v + 260 * v * v) * z * (1 + k * .15), z);
          }
          const da = ANIM.animations.fx_dustcloud;
          if (r === 0 && b < 450) html += img(da.frames[frameAt(da, b, false)], bx + 8 * z, floor, z * c.break.dust_scale[m]);
        }
      }
      frames.push({ png: await snap(W, Hh, html), ms: step });
    }
    fs.writeFileSync(path.join(PRE, 'collapse.png'), apng(frames));
    console.log('preview collapse.png', frames.length, 'frames');
  }
}
fs.rmSync(TMP, { force: true });
await browser.close();
