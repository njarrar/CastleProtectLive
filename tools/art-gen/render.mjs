// Render docs/art/*.svg to docs/art/png/*.png at 2x with Playwright chromium.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ART = '/home/user/CastleProtect/docs/art';
const OUT = path.join(ART, 'png');
const FONTS = process.env.FONTS_DIR || new URL('./fonts/node_modules/@fontsource', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const face = (fam, dir, w) => `@font-face{font-family:'${fam}';font-weight:${w};src:url('file://${FONTS}/${dir}/files/${dir}-latin-${w}-normal.woff2') format('woff2');}`;
const css = [300, 400, 500, 600, 700].map(w => face('Fredoka', 'fredoka', w)).join('') + [400, 600, 700, 800].map(w => face('Nunito', 'nunito', w)).join('');

const browser = await chromium.launch();
const files = fs.readdirSync(ART).filter(f => f.endsWith('.svg')).filter(f => !only.length || only.some(o => f.includes(o)));
for (const file of files) {
  const svg = fs.readFileSync(path.join(ART, file), 'utf8');
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const w = Math.ceil(+m[1]), h = Math.ceil(+m[2]);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const html = `<!doctype html><html><head><style>${css} html,body{margin:0;padding:0;background:#fff} svg{display:block}</style></head><body>${svg}</body></html>`;
  const tmp = path.join(OUT, '.tmp.html');
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
  await page.locator('svg').first().screenshot({ path: path.join(OUT, file.replace('.svg', '.png')) });
  await page.close();
  console.log('rendered', file, w, h);
}
fs.rmSync(path.join(OUT, '.tmp.html'), { force: true });
await browser.close();
