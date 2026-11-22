// Render assets/svg/*.svg to PNG at @1x and @2x, pack the atlases, and draw the contact sheet.
// Needs Playwright chromium (same as render.mjs). Run gen-sprites.mjs first.
//   node tools/art-gen/render-sprites.mjs            all steps
//   node tools/art-gen/render-sprites.mjs sheet      only the contact sheet
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(process.env.PLAYWRIGHT_ROOT || '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ASSETS = path.join(ROOT, 'assets');
const SPR = path.join(ASSETS, 'sprites'), ATL = path.join(ASSETS, 'atlas');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));
const only = process.argv[2] || 'all';
const PAGE = 2048, PAD = 2;

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

  // ---- atlases: shelf pack, tallest first, 2 px gap
  fs.rmSync(ATL, { recursive: true, force: true });
  fs.mkdirSync(ATL, { recursive: true });
  for (const [tag, k] of [['1x', 1], ['2x', 2]]) {
    const items = manifest.sprites.filter(s => s.atlas).map(s => ({ name: s.name, w: s.w * k, h: s.h * k, file: s.files[tag] }));
    items.sort((a, b) => b.h - a.h || b.w - a.w || a.name.localeCompare(b.name));
    const pages = [];
    let pg = null, x = 0, y = 0, rowH = 0;
    const newPage = () => { pg = { frames: {}, items: [] }; pages.push(pg); x = PAD; y = PAD; rowH = 0; };
    newPage();
    for (const it of items) {
      if (x + it.w + PAD > PAGE) { x = PAD; y += rowH + PAD; rowH = 0; }
      if (y + it.h + PAD > PAGE) newPage();
      pg.frames[it.name] = { x, y, w: it.w, h: it.h };
      pg.items.push({ ...it, x, y });
      x += it.w + PAD; rowH = Math.max(rowH, it.h);
    }
    for (let i = 0; i < pages.length; i++) {
      const base = `castle@${tag}-${i}`;
      const html = pages[i].items.map(it => `<img src="file://${path.join(ASSETS, it.file)}" style="left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px">`).join('');
      await page.setViewportSize({ width: PAGE, height: PAGE });
      await openHtml(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{position:absolute;display:block}</style></head><body>${html}</body></html>`);
      await page.screenshot({ path: path.join(ATL, base + '.png'), omitBackground: true });
      const sorted = Object.fromEntries(Object.entries(pages[i].frames).sort(([a], [b]) => a.localeCompare(b)));
      fs.writeFileSync(path.join(ATL, base + '.json'), JSON.stringify({ image: base + '.png', size: PAGE, scale: k, frames: sorted }, null, 1) + '\n');
      console.log('atlas', base, Object.keys(sorted).length, 'frames');
    }
    fs.writeFileSync(path.join(ATL, `castle@${tag}.json`), JSON.stringify({ scale: k, pages: pages.map((_, i) => `castle@${tag}-${i}.json`) }, null, 1) + '\n');
  }
}

// ---- contact sheet: every sprite at @2x on paper, grouped
{
  const order = ['blocks', 'fort', 'kettle', 'stompers', 'hobs', 'portraits', 'shells', 'icons', 'effects', 'ui', 'terrain', 'backgrounds', 'app'];
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
      if (grp === 'hobs') z = .75;
      if (w > 1000) z = 0.45;
      const label = grp === 'hobs' ? s.name.replace('hob_', '') : s.name;
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
  await openHtml(`<!doctype html><html><head><style>${css}</style></head><body><h1>Castle Protect v0.1 sprites</h1><div>${manifest.count} sprites, shown at @2x (small ones enlarged). Made by tools/art-gen.</div>${html}</body></html>`);
  await page.screenshot({ path: path.join(ASSETS, 'contact-sheet.png'), fullPage: true });
  console.log('contact sheet done');
}
fs.rmSync(TMP, { force: true });
await browser.close();
