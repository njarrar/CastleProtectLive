// Offline real core, save recovery and the "never stuck" paths, against the production build.
import { expect, test, type Page } from '@playwright/test';

type Snap = { phase: string; round: number; hud: { fire: string; active: number; canPass: boolean } };
const snap = (page: Page) => page.evaluate(() => (window as unknown as { __castle: { snap: () => Snap } }).__castle.snap());

/** Write one key in the app's IndexedDB store, as an older build or a bad write would have. */
function idbPut(page: Page, key: string, value: unknown): Promise<void> {
  return page.evaluate(([k, v]) => new Promise<void>((res, rej) => {
    const r = indexedDB.open('castle-protect', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k as string);
      tx.oncomplete = () => { r.result.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  }), [key, value] as const);
}
function idbGet(page: Page, key: string): Promise<unknown> {
  return page.evaluate((k) => new Promise((res, rej) => {
    const r = indexedDB.open('castle-protect', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => {
      const q = r.result.transaction('kv', 'readonly').objectStore('kv').get(k);
      q.onsuccess = () => { res(q.result); r.result.close(); };
      q.onerror = () => rej(q.error);
    };
  }), key);
}

const SETUP_1_1 = { mode: 'campaign', level: '1-1', seed: 1, difficulty: 'fair', windOff: false, sides: [{ name: 'You', human: true, crew: ['marge'] }, { name: 'Sir Pudge', human: false, crew: [] }] };
const battleRecord = (core: string) => ({ setup: SETUP_1_1, core, coreName: 'wasm', label: 'Level 1-1, Round 2', savedAt: 1 });

async function ready(page: Page, url = './?debug=1'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
}

test('offline: the reload plays the real wasm core from the precache', async ({ page, context }) => {
  await ready(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now the service worker controls the page
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-core', 'wasm');
  await page.getByTestId('play').click();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  await expect(page.locator('.battle')).toHaveAttribute('data-core', 'wasm');
  await context.setOffline(false);
});

test('production never loads the stand-in core, even when asked', async ({ page }) => {
  await ready(page, './?core=mock&debug=1');
  await expect(page.locator('html')).toHaveAttribute('data-core', 'wasm');
});

test('a bad progress record does not brick boot; it is kept aside', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await ready(page);
  await idbPut(page, 'progress', { levels: null, hints: 'x', buttons: 'lots', lastCrew: 7 });
  await idbPut(page, 'settings', { sound: 'loud', rotation: 'sideways', seenFirstRun: true });
  await page.reload();
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
  await expect(page.getByTestId('play')).toBeVisible();
  const broken = (await idbGet(page, 'progress.broken')) as { raw: { hints: string } } | undefined;
  expect(broken?.raw.hints).toBe('x');
  const fixed = (await idbGet(page, 'progress')) as { levels: object; hints: unknown[]; version: number };
  expect(fixed.levels).toEqual({});
  expect(Array.isArray(fixed.hints)).toBe(true);
  expect(fixed.version).toBe(1);
  await page.getByTestId('play').click(); // seenFirstRun survived the bad settings fields
  await expect(page.locator('.screen.map')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a cut-off battle save is put aside with a note, never a dead Resume', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await ready(page);
  await idbPut(page, 'battle', battleRecord('{"v":2,"rules":1,"setup":"{"lev'));
  await page.reload();
  await page.getByTestId('resume').click();
  await expect(page.locator('.screen.map')).toBeVisible();
  await expect(page.locator('.notice')).toContainText('damaged');
  expect(await idbGet(page, 'battle')).toBeUndefined();
  expect(await idbGet(page, 'battle.broken')).toBeTruthy();
  expect(errors).toEqual([]);
});

test('a battle save from an older version is not replayed', async ({ page }) => {
  await ready(page);
  await idbPut(page, 'battle', battleRecord(JSON.stringify({ v: 1, core: 'wasm', setup: '{"level":"1-1"}', seed: '1', view: SETUP_1_1, log: [] })));
  await page.reload();
  await page.getByTestId('resume').click();
  await expect(page.locator('.notice')).toContainText('older version');
  expect(await idbGet(page, 'battle')).toBeUndefined();
});

test('a garbage battle record is not offered at all', async ({ page }) => {
  await ready(page);
  await idbPut(page, 'battle', 'not a save');
  await page.reload();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByTestId('resume')).toHaveCount(0);
  expect(await idbGet(page, 'battle.broken')).toBeTruthy();
});

/** Play 1-1 to the Rival's turn so the autosave runs; returns the save record. */
async function playToSave(page: Page): Promise<{ core: string; label: string }> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.getByTestId('play').click();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  const box = (await page.locator('canvas.field').boundingBox())!;
  const x0 = box.x + box.width * 0.5, y0 = box.y + box.height * 0.45;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 - i * 18, y0 + i * 16);
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.getByTestId('fire').click({ force: true });
  await expect.poll(async () => (await idbGet(page, 'battle')) as unknown, { timeout: 30_000 }).toBeTruthy();
  return (await idbGet(page, 'battle')) as { core: string; label: string };
}

test('a real save resumes, and a save whose state hash does not match still loads with a note', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const save = await playToSave(page);
  const core = JSON.parse(save.core) as { v: number; rules: number; hash: string; log: unknown[] };
  expect(core.v).toBe(2);
  expect(core.hash).toMatch(/^[0-9a-f]{16}$/);
  expect(core.log.length).toBeGreaterThan(0);

  await page.reload();
  await page.getByTestId('resume').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect(page.locator('.notice')).toHaveCount(0);

  // Same save with a wrong hash: the log replays with no refusal, so the fight loads (never put
  // aside) and the player gets a note that it replayed a little differently.
  await idbPut(page, 'battle', { ...save, core: JSON.stringify({ ...core, hash: '0000000000000000' }) });
  await page.goto('./?debug=3');
  await page.getByTestId('resume').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect(page.locator('.notice')).toContainText('replayed a little differently');
  expect(await idbGet(page, 'battle')).toBeTruthy();
  // A log the core refuses is a broken save: that one is put aside.
  await idbPut(page, 'battle', { ...save, core: JSON.stringify({ ...core, log: [{ cmd: 'fire' }, { cmd: 'fire' }, { cmd: 'nonsense' }] }) });
  await page.goto('./?debug=4');
  await page.getByTestId('resume').click();
  await expect(page.locator('.notice')).toContainText('no longer replays');
  await expect(page.locator('.screen.map')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a Workshop fort with too few Nooks never breaks FIGHT on 1-7', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await ready(page);
  await page.evaluate(() => {
    const a = (window as unknown as { castleApp: { progress: Record<string, unknown>; core: { defaultBlueprint(): unknown }; saveProgress(): Promise<void> } }).castleApp;
    const won = { pennants: [true, false, false], wins: 1, losses: 0 };
    a.progress.levels = { '1-1': won, '1-2': won, '1-3': won, '1-4': won, '1-5': won, '1-6': won };
    a.progress.blueprint = { ...(a.core.defaultBlueprint() as object), name: 'Three Nooks' }; // 3 Nooks, 1-7 seats 4
    return a.saveProgress();
  });
  await page.goto('./?debug=4#level=1-7');
  await expect(page.locator('.warn')).toContainText("level's fort");
  await page.getByTestId('fight').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  expect(errors).toEqual([]);
});

test('Pass from the Pause card ends the turn; a bad level link lands on the map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.getByTestId('play').click();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByTestId('pass').click();
  await expect.poll(async () => (await snap(page)).hud.active, { timeout: 10_000 }).toBe(1);

  await page.goto('./?debug=5#level=9-9');
  await expect(page.locator('.screen.map')).toBeVisible();
  await page.goto('./?debug=6#level=1-10'); // locked
  await expect(page.locator('.screen.map')).toBeVisible();
});

test('the hand-off card keeps focus inside it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, './?debug=1#duel');
  await page.getByTestId('duel-fight').click();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByTestId('pass').click();
  await expect(page.getByTestId('ready')).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.handoff'))).toBe(true);
  }
});
