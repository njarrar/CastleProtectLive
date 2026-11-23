// Regression tests for web review 2 (docs/review/code/web-review-2.md). Run on desktop and on
// the phone projects (iPhone 15 portrait in WebKit, Pixel 7 landscape in Chromium).
import { expect, test, type Page } from '@playwright/test';
import { fireShot, idbGet, layout, openPause, ready, snap, startLevel1 } from './helpers';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/access control checks/.test(String(e))) errors.push(String(e)); }); // WebKit reports fetches cut off by a navigation
  return errors;
}

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('H1: Settings from Pause while a shot flies, then Back, carries on with the same shot', async ({ page }) => {
  const errors = watchErrors(page);
  await startLevel1(page);
  await fireShot(page);
  const before = await snap(page);
  await openPause(page);
  await page.getByTestId('pause-settings').click();
  await expect(page.locator('.screen.settings')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect(page.locator('.notice')).toHaveCount(0);
  const after = await snap(page);
  // The same fight at the same tick: the shot is still on its way (not a new fight, not put aside).
  expect(after.round).toBe(before.round);
  expect(after.tick).toBeGreaterThanOrEqual(before.tick);
  expect(after.tick).toBeLessThan(before.tick + 240);
  // Back lands on the Pause card (QA playtest 1, m2); Resume lets the shot fly on.
  await expect(page.locator('.pause-card')).toBeVisible();
  await page.getByRole('button', { name: 'Keep fighting' }).click();
  await expect.poll(async () => (await snap(page)).pins.length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('H1: Map from Pause in flight writes a save that loads, and the shot has landed', async ({ page }) => {
  const errors = watchErrors(page);
  await startLevel1(page);
  await fireShot(page);
  await openPause(page);
  await page.getByTestId('pause-map').click();
  await expect(page.locator('.screen.map')).toBeVisible();
  const save = await idbGet(page, 'battle') as { core: string } | undefined;
  expect(save).toBeTruthy();
  await ready(page, './?debug=2');
  await page.getByTestId('resume').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect(page.locator('.notice')).toHaveCount(0);
  // The core's resume lands on the next stable point after the shot: the pin is down.
  await expect.poll(async () => (await snap(page)).pins.length).toBeGreaterThan(0);
  expect(await idbGet(page, 'battle')).toBeTruthy(); // never put aside
  expect(errors).toEqual([]);
});

test('H2: browser Back from Settings (opened from Pause) returns to the paused fight', async ({ page }) => {
  const errors = watchErrors(page);
  await startLevel1(page);
  await fireShot(page);
  // Play on to the next Plan step so the fight has a history (a pin, the Rival's turn).
  await expect.poll(async () => { const s = await snap(page); return s.phase === 'plan' && s.hud.active === 0 && s.pins.length > 0; }, { timeout: 40_000 }).toBe(true);
  const before = await snap(page);
  await openPause(page);
  await page.getByTestId('pause-settings').click();
  await expect(page.locator('.screen.settings')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.battle')).toBeVisible();
  // Back from Settings lands on the Pause card it was opened from (QA playtest 1, m2).
  await expect(page.locator('.pause-card')).toBeVisible();
  const after = await snap(page);
  expect(after.round).toBe(before.round);
  expect(after.pins.length).toBe(before.pins.length);
  expect(after.tick).toBe(before.tick);
  // Back again closes Pause, and once more opens it: it never leaves the fight.
  await page.goBack();
  await expect(page.locator('.pause-card')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.pause-card')).toBeVisible();
  await expect(page.locator('.battle')).toBeVisible();
  expect(errors).toEqual([]);
});

test('H3: runtime-cached art and sound have content hashes; the JSON naming them is precached', async ({ page, request, baseURL }) => {
  await ready(page);
  const get = async (p: string) => { const r = await request.get(`${baseURL}${p}`); expect(r.ok(), p).toBe(true); return r; };
  const list = await (await get('art/atlas/castle@2x.json')).json() as { pages: string[] };
  for (const p of list.pages) {
    const page2 = await (await get(`art/atlas/${p}`)).json() as { image: string };
    expect(page2.image).toMatch(/^castle@2x-\d\.[0-9a-f]{10}\.(webp|png)$/);
    await get(`art/atlas/${page2.image}`);
  }
  const bg = await (await get('art/bg.json')).json() as Record<string, string>;
  expect(bg['bg_downs_sky@2x']).toMatch(/\.[0-9a-f]{10}\.(webp|png)$/);
  const audio = await (await get('art/audio/audio.json')).json() as { sounds: { files: Record<string, string> }[] };
  expect(audio.sounds.length).toBeGreaterThan(0);
  for (const s of audio.sounds.slice(0, 5)) for (const f of Object.values(s.files)) { expect(f).toMatch(/\.[0-9a-f]{10}\.(ogg|m4a)$/); await get(`art/audio/${f}`); }
  const sw = await (await get('sw.js')).text();
  for (const u of ['art/audio/audio.json', 'art/bg.json', 'art/atlas/castle@2x-0.json']) expect(sw).toContain(`"${u}"`);
  expect(sw).not.toMatch(/castle@2x-\d\.[0-9a-f]{10}\.webp/); // @2x images stay runtime-cached (lazy)
});

test('portrait: the joined flight lens has no strip borders and Pause sits above the drawn strip', async ({ page }) => {
  if ((page.viewportSize()?.width ?? 0) > (page.viewportSize()?.height ?? 0)) await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' }); // Reduce motion keeps the lenses apart
  await startLevel1(page);
  await expect.poll(() => layout(page)).toBe('tall');
  await fireShot(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __castle: { joined: () => boolean } }).__castle.joined())).toBe(true);
  await expect(page.locator('.hud.tall.joined')).toBeAttached();
  const border = await page.locator('.hud.tall .strip').evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(border).toMatch(/rgba\(.*,\s*0\)|transparent/);
  const pause = (await page.getByRole('button', { name: 'Pause' }).boundingBox())!;
  const lens = (await page.locator('.lens-bottom').boundingBox())!;
  // The strip is drawn 34 px above the bottom lens foot, 40 px tall.
  expect(pause.y + pause.height).toBeLessThanOrEqual(lens.y + lens.height - 34);
});

test('words never sit on damage numbers or a kettle: they are laid out in screen px', async ({ page }) => {
  await startLevel1(page);
  type Fx = { number(k: string, x: number, y: number, v: number, kind: number, t: string, dir: number): void; word(t: string, x: number, y: number, s: number, c: string, b: boolean, l: number): void };
  await page.evaluate(() => {
    const c = (window as unknown as { __castle: { fx: Fx; snap: () => { hobs: { side: number; x: number; y: number }[]; kettles: { side: number; room?: { x: number; y: number; w: number; h: number } }[] } } }).__castle;
    const s = c.snap();
    const hb = s.hobs[0];
    // A Hob falls: the fall number and the "Drop!" note at nearly the same world point.
    c.fx.number('h1', hb.x, hb.y + 36, 25, 1, 'crush', -1);
    c.fx.word('Drop!', hb.x, hb.y + 30, 16, '#FFF4DE', false, 1400);
    // The big Drop! burst right on top of the Rival kettle.
    const k = s.kettles.find((q) => q.side === 1)!.room!;
    c.fx.word('Drop!', k.x + k.w / 2, k.y + k.h / 2, 20, '#FFF4DE', true, 1400);
  });
  // Wait for a drawn frame that has them: a slow WebKit can stall a few hundred ms as the fight
  // opens (sound decoding), and a fixed 250 ms wait then read the boxes before any frame drew.
  const read = () => page.evaluate(() => (window as unknown as { __castle: { wordBoxes: () => number[][] } }).__castle.wordBoxes());
  await expect.poll(async () => { const b = await read(); return b.some((x) => x[0] === 3) && b.some((x) => x[0] !== 3); }, { timeout: 1200, intervals: [50] }).toBe(true);
  const boxes = await read();
  const words = boxes.filter((b) => b[0] === 3), nums = boxes.filter((b) => b[0] !== 3);
  expect(words.length).toBeGreaterThanOrEqual(1);
  expect(nums.length).toBeGreaterThanOrEqual(1);
  const overlap = (a: number[], b: number[]) => a[1] < b[3] && a[3] > b[1] && a[2] < b[4] && a[4] > b[2];
  for (const w of words) for (const n of nums) expect(overlap(w, n)).toBe(false);
});

test('Give up in the campaign gets its own result title', async ({ page }) => {
  await startLevel1(page);
  await openPause(page);
  await page.getByTestId('give-up').click();
  await expect(page.locator('.screen.results h1')).toHaveText('You gave up', { timeout: 15_000 });
});

test('sound: a hidden tab suspends audio, a visible one resumes it; loops stop after the fight', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Web Audio state is checked in Chromium');
  await startLevel1(page);
  type A = { state: string; decoded: string[]; loops: number };
  const audio = () => page.evaluate(() => (window as unknown as { castleAudio: () => A }).castleAudio());
  await expect.poll(async () => (await audio()).state).toBe('running');
  const setVis = (v: string) => page.evaluate((vis) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);
  await setVis('hidden');
  await expect.poll(async () => (await audio()).state).toBe('suspended');
  await setVis('visible');
  await expect.poll(async () => (await audio()).state).toBe('running');
  // Barks are decoded only for the Hobs in this fight; the other theme is not kept.
  await expect.poll(async () => (await audio()).decoded.some((d) => d.startsWith('bark_marge_')), { timeout: 15_000 }).toBe(true);
  expect((await audio()).decoded.some((d) => d.startsWith('bark_jax_'))).toBe(false);
  await openPause(page);
  await page.getByTestId('pause-map').click();
  await expect(page.locator('.screen.map')).toBeVisible();
  expect((await audio()).loops).toBe(0);
  expect((await audio()).decoded.some((d) => d.startsWith('bark_'))).toBe(false);
});

test('Walk: on 1-9 the ground is drawn and holding Walk right moves the fort', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page, './?debug=1#map');
  await page.evaluate(() => {
    const a = (window as unknown as { castleApp: { go: (r: unknown) => void; campaignSetup: (id: string) => unknown } }).castleApp;
    a.go({ to: 'battle', setup: a.campaignSetup('1-9') });
  });
  await expect.poll(async () => { const s = await snap(page); return s.phase === 'plan' && s.hud.active === 0; }, { timeout: 60_000 }).toBe(true);
  // 1-9 starts with a Rummage that the battle ends at once: the ground from the first snapshot must stay.
  const cols = await page.evaluate(() => (window as unknown as { __castle: { groundCols: () => number } }).__castle.groundCols());
  expect(cols).toBeGreaterThan(1000);
  const fortX = async () => (await page.evaluate(() => (window as unknown as { __castle: { snap: () => { forts: { x: number }[] } } }).__castle.snap().forts[0].x));
  const x0 = await fortX();
  const right = page.getByRole('button', { name: 'Walk right' });
  await expect(right).toBeVisible();
  const box = (await right.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(fortX).toBeGreaterThan(x0);
  await page.mouse.up();
  expect(errors).toEqual([]);
});
