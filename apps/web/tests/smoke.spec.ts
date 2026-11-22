import { expect, test, type Page } from '@playwright/test';

type Snap = { phase: string; hud: { aim?: { angle: number; power: number }; fire: string }; events: unknown[]; shells: unknown[]; pins: unknown[] };
const snap = (page: Page) => page.evaluate(() => (window as unknown as { __castle: { snap: () => Snap } }).__castle.snap());
const layout = (page: Page) => page.evaluate(() => (window as unknown as { __castle: { layout: () => string } }).__castle.layout());

test('loads, starts level 1-1, fires a shot, rotates to portrait', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?debug=1');
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
  await expect(page.getByText('Castle')).toBeVisible();

  // First run: Play goes straight into level 1-1 (the 30 s budget).
  await page.getByTestId('play').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect(page.locator('.hud.wide')).toBeVisible();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');

  // Aim Drag on the field: pull back down and left from the middle.
  const box = (await page.locator('canvas.field').boundingBox())!;
  const x0 = box.x + box.width * 0.5, y0 = box.y + box.height * 0.45;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 - i * 18, y0 + i * 16);
  await page.mouse.up();
  await expect.poll(async () => (await snap(page)).hud.aim?.power ?? 0).toBeGreaterThan(20);

  // Fire acts on release, a plain quick click.
  await page.waitForTimeout(200);
  await page.getByTestId('fire').click({ force: true }); // it pulses, so skip the stable check
  await expect.poll(async () => (await snap(page)).phase, { timeout: 10_000 }).not.toBe('plan');
  // The shell lands: a Pin appears.
  await expect.poll(async () => (await snap(page)).pins.length, { timeout: 20_000 }).toBeGreaterThan(0);

  // Turn to portrait: instant relayout to the stacked lenses, the battle carries on.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => layout(page)).toBe('tall');
  await expect(page.locator('.hud.tall')).toBeVisible();
  await expect(page.locator('.hud.tall .lens-top')).toBeVisible();
  await expect(page.locator('.hud.tall .strip')).toBeVisible();
  await expect(page.getByTestId('fire')).toBeAttached();

  // And back to landscape.
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(() => layout(page)).toBe('wide');
  expect(errors).toEqual([]);
});

test('map, pre-battle, Couch Duel setup and settings open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?debug=1#map');
  await expect(page.locator('.screen.map')).toBeVisible();
  await page.locator('[data-level="1-1"]').click();
  await expect(page.getByTestId('fight')).toBeVisible();
  await page.goto('./?debug=1#duel');
  await expect(page.getByTestId('duel-fight')).toBeVisible();
  await page.getByTestId('duel-fight').click();
  await expect(page.locator('.battle')).toBeVisible();
  // A hash change never drops a fight (M12), so load the settings link as a fresh page.
  await page.goto('./?debug=2#settings');
  await expect(page.getByText('Reduce motion')).toBeVisible();
});

test('Give up ends a Couch Duel at once, with the result from the core', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?debug=1#duel');
  await page.getByTestId('duel-fight').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  await page.keyboard.press('Escape');
  await page.getByTestId('give-up').click();
  await expect(page.locator('.screen.results')).toBeVisible({ timeout: 15_000 });
});

test('a shot plays the feel layer: effects run and nothing throws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?debug=1#map');
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
  await page.evaluate(() => (window as unknown as { castleApp: { go: (r: unknown) => void } }).castleApp.go({ to: 'battle', setup: { mode: 'campaign', level: '1-1', seed: 1, difficulty: 'fair', windOff: false, sides: [{ name: 'You', human: true, crew: ['marge'] }, { name: 'Sir Pudge', human: false, crew: [] }] } }));
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
  await page.evaluate(() => (window as unknown as { castleApp: { core: { command: (c: unknown) => unknown } } }).castleApp.core.command({ cmd: 'aim', angle: 300, power: 60 }));
  await page.getByTestId('fire').click({ force: true });
  const feel = () => page.evaluate(() => (window as unknown as { __castle: { feel: () => { fx: number; collapse: boolean } } }).__castle.feel());
  await expect.poll(async () => (await feel()).fx, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await feel()).collapse, { timeout: 10_000 }).toBe(true);
  expect(errors).toEqual([]);
});
