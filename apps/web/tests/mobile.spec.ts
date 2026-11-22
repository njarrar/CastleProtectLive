// Phone checks (the iphone and pixel-landscape projects; desktop runs them too, at its own size).
import { expect, test } from '@playwright/test';
import { snap, startLevel1 } from './helpers';

test('1-1: Fire three times with no drag; rounds advance and nothing throws', async ({ page }) => {
  // Regression: the 1-1 "Drag to aim" hint read the bottom lens while the portrait lenses were
  // joined after a shot, threw, and showed "The fight got stuck".
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/access control checks/.test(String(e))) errors.push(String(e)); }); // WebKit reports fetches cut off by a navigation
  await startLevel1(page);
  const round0 = (await snap(page)).round;
  for (let i = 0; i < 3; i++) {
    await expect.poll(async () => { const s = await snap(page); return s.phase === 'plan' && s.hud.active === 0; }, { timeout: 45_000 }).toBe(true);
    const s = await snap(page);
    await page.getByTestId('fire').click({ force: true });
    // A fire with no aim yet may be refused (locked); Pass from Pause keeps the turn moving then.
    const moved = await expect.poll(async () => (await snap(page)).tick !== s.tick || (await snap(page)).phase !== 'plan', { timeout: 3_000 }).toBe(true).then(() => true, () => false);
    if (!moved) {
      await page.getByRole('button', { name: 'Pause' }).click({ force: true });
      await page.getByTestId('pass').click();
    }
    await expect.poll(async () => (await snap(page)).round, { timeout: 45_000 }).toBeGreaterThan(s.round);
  }
  expect((await snap(page)).round).toBeGreaterThanOrEqual(round0 + 3);
  await expect(page.getByTestId('crash-retry')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the Shell card opens on a long press (iOS sends no contextmenu)', async ({ page }) => {
  await startLevel1(page);
  const chip = page.locator('.tray .chip.shot').first();
  await expect(chip).toBeVisible();
  const b = (await chip.boundingBox())!;
  const at = { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2, bubbles: true };
  await chip.dispatchEvent('pointerdown', at);
  await page.waitForTimeout(650);
  await chip.dispatchEvent('pointerup', at);
  await expect(page.locator('.shell-card')).toBeVisible();
  await expect(page.locator('.shell-card')).toContainText('Weight');
});

test('landscape: aim previews do not pile up on the field (the lens is cleared under a CSS sky)', async ({ page }) => {
  await startLevel1(page);
  const box = (await page.locator('canvas.field').boundingBox())!;
  const tall = (await page.locator('.hud.tall').count()) > 0;
  const area = tall ? (await page.locator('.lens-bottom').boundingBox())! : box;
  // White pixels (preview dots are white with an ink ring) on the whole field.
  const white = () => page.evaluate(() => {
    const c = document.querySelector('canvas.field') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250 && d[i + 3] > 250) n++;
    return n;
  });
  const drag = async (k: number) => {
    const x0 = area.x + area.width * 0.5, y0 = area.y + area.height * (tall ? 0.35 : 0.45);
    const s = Math.min(16, area.width / 26);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x0 - i * s * (0.6 + 0.15 * k), y0 + i * s * (1.4 - 0.15 * k));
    await page.mouse.up();
    await page.waitForTimeout(400); // the camera holds still: the backdrop cache is blitted
  };
  await drag(0);
  const one = await white();
  for (let k = 1; k <= 5; k++) await drag(k);
  const six = await white();
  expect(one).toBeGreaterThan(0);
  // Six different arcs piled up would be several times one arc.
  expect(six).toBeLessThan(one * 1.8 + 400);
});
