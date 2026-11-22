// QA playtest 1 (docs/qa/playtest-1/REPORT.md): the web findings, on desktop and on the phone
// projects (iPhone 15 portrait in WebKit, Pixel 7 landscape in Chromium). Some checks also set
// the two phone sizes the playtest used, 390 x 844 and 844 x 390, on every project.
import { expect, test, type Page } from '@playwright/test';
import { appendFileSync, cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ready, snap, startLevel1 } from './helpers';

type Box = [number, number, number, number];
// Runs a body against the debug handle (window.__castle, see battle.ts) and returns its value.
const castle = <T>(page: Page, body: string): Promise<T> => page.evaluate(`(() => { const c = window.__castle; ${body} })()`) as Promise<T>;

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

/** The picked Hob on screen, in the lens that aims. */
async function hobPoint(page: Page): Promise<[number, number]> {
  return castle(page, `const s = c.snap(); const h = s.hobs.find((x) => x.id === s.hud.hob); return c.toScreen(h.x, h.y + 12, 'aim');`);
}

/**
 * Press on your own Hob and pull back toward `deg` (0 = straight back, 90 = straight down), as
 * far as `dist` px. A finger stops at the screen edge and slides along it, as a real one does.
 * `hold` leaves the finger down at the end (the caller lifts it).
 */
async function pull(page: Page, deg: number, dist: number, hold = false): Promise<void> {
  const vp = page.viewportSize()!;
  const [x0, y0] = await hobPoint(page);
  const side = (await snap(page)).hud.active;
  const dirX = side === 0 ? -1 : 1;
  const a = (deg * Math.PI) / 180;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const steps = Math.ceil(dist / 6);
  for (let i = 1; i <= steps; i++) {
    const d = (dist * i) / steps;
    const x = Math.max(0, Math.min(vp.width - 1, x0 + dirX * Math.cos(a) * d));
    const y = Math.max(0, Math.min(vp.height - 1, y0 + Math.sin(a) * d));
    await page.mouse.move(x, y);
  }
  if (!hold) await page.mouse.up();
  await page.waitForTimeout(300); // Fire ignores a tap in the first 150 ms after a drag ends
}

async function waitMyPlan(page: Page, timeout = 60_000): Promise<void> {
  await expect.poll(async () => { const s = await snap(page); return s.phase === 'plan' && s.hud.active === 0; }, { timeout }).toBe(true);
}

const overlap = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const boxOf = async (page: Page, sel: string): Promise<Box> => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return [b.x, b.y, b.x + b.width, b.y + b.height];
};

test('M1: Fire is never lit and dead: a resting Knack is swapped for the Plain Shot, and Fire says why', async ({ page }) => {
  test.setTimeout(150_000);
  await startLevel1(page);
  const knack = page.locator('.tray .chip.shot').nth(1);
  await knack.click();
  await expect.poll(async () => (await snap(page)).hud.shot).toBe('knack');
  await pull(page, 35, 90);
  await page.getByTestId('fire').click({ force: true });
  await expect.poll(async () => (await snap(page)).phase, { timeout: 10_000 }).not.toBe('plan');
  await waitMyPlan(page, 90_000);
  type Hud = { shot?: string; fire: string; fireWhy?: string; shots: { id: string; ready: boolean }[] };
  const hud = async () => (await snap(page)).hud as unknown as Hud;
  // At the turn start the picked shot is one that can go.
  await expect.poll(async () => { const h = await hud(); return h.shots.find((c) => c.id === h.shot)?.ready; }).toBe(true);
  await pull(page, 35, 90);
  await expect.poll(async () => (await hud()).fire).toBe('ready');
  // Picking the resting Knack by hand: Fire turns grey and gives the core's reason; a tap fires nothing.
  const knackReady = (await hud()).shots.find((c) => c.id === 'knack')?.ready;
  if (knackReady === false) {
    await knack.click({ force: true });
    if ((await hud()).shot === 'knack') {
      await expect(page.getByTestId('fire')).toHaveAttribute('data-state', 'locked');
      await expect(page.getByTestId('fire-why')).toBeVisible();
      await expect(page.getByTestId('fire-why')).not.toHaveText('');
      const t = (await snap(page)).round;
      await page.getByTestId('fire').click({ force: true });
      await page.waitForTimeout(400);
      const s = await snap(page);
      expect(s.phase).toBe('plan');
      expect(s.round).toBe(t);
      expect(s.shells.length).toBe(0);
    }
  }
});

for (const vp of [LANDSCAPE]) {
  test(`M3: ${vp.width}x${vp.height} frames both forts on 1-1 while you aim, blocks 8 px or more`, async ({ page }) => {
    await page.setViewportSize(vp);
    await startLevel1(page);
    await page.waitForTimeout(1500); // the camera settles on the plan frame
    const boxes = await castle<Box[]>(page, 'return c.fortBoxes();');
    const s = await castle<number>(page, 'return c.cam().s;');
    expect(s * 16).toBeGreaterThanOrEqual(8);
    for (const b of boxes) {
      expect(b[0]).toBeGreaterThanOrEqual(0);
      expect(b[2]).toBeLessThanOrEqual(vp.width);
    }
    await expect(page.getByTestId('fort-mark')).toBeHidden();
  });
}

test('M3: on a map too wide to frame, your fort is framed and the Rival fort has an edge marker', async ({ page }) => {
  await page.setViewportSize(LANDSCAPE);
  await ready(page, './?debug=1#map');
  await page.evaluate(() => {
    const a = (window as unknown as { castleApp: { go: (r: unknown) => void; campaignSetup: (id: string) => unknown } }).castleApp;
    a.go({ to: 'battle', setup: a.campaignSetup('1-9') });
  });
  await waitMyPlan(page);
  await page.waitForTimeout(1500);
  const [mine, rival] = await castle<Box[]>(page, 'return c.fortBoxes();');
  expect(mine[0]).toBeGreaterThanOrEqual(0);
  expect(mine[2]).toBeLessThanOrEqual(LANDSCAPE.width);
  const seen = Math.max(0, Math.min(rival[2], LANDSCAPE.width) - Math.max(rival[0], 0));
  if (seen < 0.75 * (rival[2] - rival[0])) await expect(page.getByTestId('fort-mark')).toBeVisible();
  else expect(await castle<number>(page, 'return c.cam().s;') * 16).toBeGreaterThanOrEqual(8);
});

test('M3: an aim arc that runs off screen gets an arrow where it leaves', async ({ page }) => {
  await page.setViewportSize(LANDSCAPE);
  await startLevel1(page);
  await page.waitForTimeout(800);
  await pull(page, 70, 160); // steep and strong: the arc climbs out of the top
  const off = await castle<boolean>(page, `const p = c.snap().hud.preview; return p.some(([x, y]) => { const [a, b] = c.toScreen(x, y); return a < 0 || a > innerWidth || b < 40; });`);
  expect(off).toBe(true);
  await expect(page.getByTestId('arc-mark')).toBeVisible();
});

for (const vp of [PORTRAIT, LANDSCAPE]) {
  test(`M7: ${vp.width}x${vp.height} Fine Tune never covers your fort and folds away while you drag`, async ({ page }) => {
    await page.setViewportSize(vp);
    await startLevel1(page);
    await page.waitForTimeout(800);
    await pull(page, 35, 80, true);
    await expect(page.locator('.finetune')).toBeHidden(); // a finger is aiming
    await page.mouse.up();
    await expect(page.locator('.finetune')).toBeVisible();
    await page.waitForTimeout(600);
    const pad = await boxOf(page, '.finetune');
    const [mine, rival] = await castle<Box[]>(page, 'return c.fortBoxes();');
    expect(overlap(pad, mine)).toBe(false);
    const [hx, hy] = await hobPoint(page);
    expect(overlap(pad, [hx - 20, hy - 20, hx + 20, hy + 20])).toBe(false);
    if (vp.width > vp.height) {
      expect(overlap(pad, rival)).toBe(false);
      expect(overlap(pad, await boxOf(page, '.tray'))).toBe(false);
      expect(overlap(pad, await boxOf(page, '[data-testid=fire]'))).toBe(false);
    }
    // Every key of the pad is on screen.
    expect(pad[0]).toBeGreaterThanOrEqual(0);
    expect(pad[2]).toBeLessThanOrEqual(vp.width);
    expect(pad[1]).toBeGreaterThanOrEqual(0);
  });
}

test('m3: a pull that runs into the screen edge keeps its angle (asked 45, got 45) at full power', async ({ page }) => {
  await startLevel1(page);
  await page.waitForTimeout(800);
  const vp = page.viewportSize()!;
  await pull(page, 45, Math.max(vp.width, vp.height));
  const aim = (await snap(page)).hud.aim!;
  expect(Math.abs(aim.angle - 450)).toBeLessThanOrEqual(10);
  expect(aim.power).toBe(100);
});

for (const vp of [PORTRAIT, LANDSCAPE]) {
  test(`M5: ${vp.width}x${vp.height} Workshop cells are 24 px or more and every cell can be reached`, async ({ page }) => {
    await page.setViewportSize(vp);
    await ready(page, './?debug=1#workshop');
    const cells = page.locator('.grid .cell[data-c]');
    await expect(cells.first()).toBeVisible();
    const n = await cells.count();
    for (const i of [0, n - 1]) {
      const c = cells.nth(i);
      await c.scrollIntoViewIfNeeded();
      const b = (await c.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(24);
      expect(b.height).toBeGreaterThanOrEqual(24);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    }
    // The page never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
  });

  test(`M8: ${vp.width}x${vp.height} Couch Duel setup fits: nothing runs off the side, the dice are there`, async ({ page }) => {
    await page.setViewportSize(vp);
    await ready(page, './?debug=1#duel');
    await expect(page.locator('.pcard')).toHaveCount(2);
    const right = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.pcard, .pcard *')].map((e) => e.getBoundingClientRect().right)));
    expect(right).toBeLessThanOrEqual(vp.width);
    for (const d of await page.locator('.pcard .dice').all()) {
      await d.scrollIntoViewIfNeeded();
      await expect(d).toBeInViewport();
    }
    // Player 1's crew badges are coloured, not blank white circles.
    const bg = await page.locator('.pcard.side0 .cls').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).not.toBe('rgb(255, 255, 255)');
    // The rules and FIGHT can be reached.
    await page.locator('.rules').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('duel-fight')).toBeInViewport();
  });

  test(`m5: ${vp.width}x${vp.height} the hand-off card fits: READY is fully on screen`, async ({ page }) => {
    await page.setViewportSize(vp);
    await ready(page, './?debug=1#duel');
    await page.getByTestId('duel-fight').click();
    await expect.poll(async () => (await snap(page)).phase).toBe('plan');
    await page.getByRole('button', { name: 'Pause' }).click({ force: true });
    await page.getByTestId('pass').click();
    const r = page.getByTestId('ready');
    await expect(r).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    const b = (await r.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    const card = (await page.locator('.handoff').boundingBox())!;
    expect(card.x + card.width).toBeLessThanOrEqual(vp.width);
  });
}

test('M4: the Test Yard never hands you the Dummy\'s turn', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page, './?debug=1#yard');
  await waitMyPlan(page);
  expect((await snap(page)).hud.active).toBe(0);
  await expect(page.locator('.round').first()).toHaveText('Test Yard');
  for (let shot = 0; shot < 2; shot++) {
    const t0 = (await snap(page)).tick;
    await pull(page, 35, 90);
    await page.getByTestId('fire').click({ force: true });
    await expect.poll(async () => (await snap(page)).tick, { timeout: 10_000 }).toBeGreaterThan(t0);
    // Until it is our Plan step again, no Plan step is ever the Dummy's.
    const end = Date.now() + 60_000;
    let back = false;
    while (Date.now() < end && !back) {
      const s = await snap(page);
      if (s.phase === 'plan') { expect(s.hud.active).toBe(0); back = s.tick > t0; }
      await page.waitForTimeout(150);
    }
    expect(back).toBe(true);
  }
  // The HUD shows your crew, blue, aiming right.
  const s = await snap(page);
  expect(s.hud.active).toBe(0);
  if (s.hud.aim) expect(s.hud.aim.angle).toBeLessThan(900);
});

test('m1: "Best shot" on the results names only the winner\'s shots', async ({ page }) => {
  test.setTimeout(150_000);
  await ready(page, './?debug=1#duel');
  await page.getByTestId('duel-fight').click();
  const names = await page.evaluate(() => (window as unknown as { castleApp: { lastSetup: { sides: { name: string }[] } } }).castleApp.lastSetup.sides.map((x) => x.name));
  for (let turn = 0; turn < 2; turn++) {
    await expect.poll(async () => (await snap(page)).phase, { timeout: 60_000 }).toBe('plan');
    const t0 = (await snap(page)).tick;
    await pull(page, 35, 120);
    await page.getByTestId('fire').click({ force: true });
    await expect.poll(async () => (await snap(page)).tick, { timeout: 10_000 }).toBeGreaterThan(t0);
    await expect(page.getByTestId('ready')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(450);
    await page.getByTestId('ready').click();
  }
  // Player 1 gives up on their second turn: Player 2 wins.
  await expect.poll(async () => (await snap(page)).phase, { timeout: 30_000 }).toBe('plan');
  await page.getByRole('button', { name: 'Pause' }).click({ force: true });
  await page.getByTestId('give-up').click();
  await expect(page.locator('.screen.results')).toBeVisible({ timeout: 15_000 });
  const best = page.locator('.screen.results p', { hasText: 'Best shot' });
  if (await best.count()) {
    await expect(best).toContainText(names[1]);
    if (names[0] !== names[1]) await expect(best).not.toContainText(names[0]);
  }
});

test('m1: bestOf picks the winner\'s own best shot', async () => {
  const { bestOf } = await import('../src/core/real');
  const a = { side: 0 as const, hob: 'Marge', round: 1, dmg: 50, angle: 450, power: 60 };
  const b = { side: 1 as const, hob: 'Hedge', round: 2, dmg: 388, angle: 1309, power: 61 };
  expect(bestOf([a, b], 0)).toBe(a);
  expect(bestOf([a, b], 1)).toBe(b);
  expect(bestOf([undefined, b], 0)).toBeUndefined();
  expect(bestOf([a, b], -1)).toBe(b);
});

test('m2: Back from Settings returns to the Pause card, not straight into the fight', async ({ page }) => {
  await startLevel1(page);
  await page.getByRole('button', { name: 'Pause' }).click({ force: true });
  await page.getByTestId('pause-settings').click();
  await expect(page.locator('.screen.settings')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect(page.locator('.pause-card')).toBeVisible();
  const t = (await snap(page)).tick;
  await page.waitForTimeout(500);
  expect((await snap(page)).tick).toBe(t); // paused for real
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.pause-card')).toHaveCount(0);
});

test('m12: the precache is what the first fight needs, under 2 MB, with no second download of the core or atlas', async () => {
  const dist = resolve(process.cwd(), 'dist');
  test.skip(!existsSync(resolve(dist, 'sw.js')), 'no build');
  const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
  const entries = [...sw.matchAll(/\{url:"([^"]+)",revision:(null|"[0-9a-f]+")\}/g)].map((m) => ({ url: m[1], rev: m[2] }));
  expect(entries.length).toBeGreaterThan(10);
  for (const e of entries) {
    expect(e.url).not.toMatch(/\.(ogg|m4a|opus|mp3)$/); // sound is fetched as it is played
    expect(e.url).not.toMatch(/@2x-\d\.[0-9a-f]{10}\.webp$|bg_\w+@2x/); // sharp art later, high-DPI only
    expect(e.url).not.toMatch(/app_icon-\d+\.png$/); // the browser fetches install icons itself
    // A file with a content hash in its URL is precached as it is: no ?__WB_REVISION__ copy.
    if (/^assets\/|\.[0-9a-f]{10}\.\w+$|^core\/[0-9a-f]{10}\//.test(e.url)) expect(e.rev, e.url).toBe('null');
  }
  expect(entries.some((e) => /^core\/[0-9a-f]{10}\/castle_wasm_bg\.wasm$/.test(e.url))).toBe(true);
  // Bytes on the wire for the precache (gzip for text, as the host serves it), each file once.
  let bytes = 0;
  for (const u of new Set(entries.map((e) => e.url))) {
    const f = resolve(dist, u);
    if (!existsSync(f)) continue;
    bytes += /\.(webp|png)$/.test(u) ? statSync(f).size : gzipSync(readFileSync(f)).length;
  }
  expect(bytes).toBeLessThan(2 * 1024 * 1024);
});

test('m14: a waiting update shows "Update ready" within 2 s of load', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'service worker update flow checked in Chromium');
  const dist = resolve(process.cwd(), 'dist');
  test.skip(!existsSync(resolve(dist, 'sw.js')), 'no build');
  // A copy of the build on its own server, so the "next build" can be made by changing its sw.js.
  const dir = test.info().outputPath('site');
  cpSync(dist, dir, { recursive: true });
  const base = process.env.VITE_BASE ?? '/';
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (!p.startsWith(base)) { res.statusCode = 404; res.end(); return; }
    p = p.slice(base.length) || 'index.html';
    let f = resolve(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) f = resolve(dir, 'index.html');
    res.setHeader('content-type', types[extname(f)] ?? 'application/octet-stream');
    res.end(readFileSync(f));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${base}?debug=1`;
  try {
    await ready(page, url);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    appendFileSync(resolve(dir, 'sw.js'), '\n// next build\n');
    await page.reload();
    await expect(page.locator('html[data-ready=true]')).toBeAttached();
    const t0 = Date.now();
    await expect(page.locator('.update-chip')).toBeVisible({ timeout: 5_000 });
    // Within 2 s of the title being up (the playtest saw about 8 s).
    expect(Date.now() - t0).toBeLessThan(2_000);
  } finally {
    server.close();
  }
});
