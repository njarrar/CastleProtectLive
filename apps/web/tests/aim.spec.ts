// The aim upgrade: the same pull gives the same power wherever it starts on your fort, and the
// band, beam, badges, cancel spot and miss tag draw (screens saved for a look by eye).
import { expect, test, type Page } from '@playwright/test';
import { snap, startLevel1 } from './helpers';

const castle = <T>(page: Page, body: string): Promise<T> => page.evaluate(`(() => { const c = window.__castle; ${body} })()`) as Promise<T>;
const hobPoint = (page: Page) => castle<[number, number]>(page, `const s = c.snap(); const h = s.hobs.find((x) => x.id === s.hud.hob); return c.toScreen(h.x, h.y + 12, 'aim');`);

async function pullFrom(page: Page, x0: number, y0: number, dx: number, dy: number, hold = false): Promise<void> {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + (dx * i) / 12, y0 + (dy * i) / 12);
  if (!hold) { await page.mouse.up(); await page.waitForTimeout(300); }
}

for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
  test(`${vp.width}x${vp.height}: the same pull gives the same power from the top and the bottom of your fort`, async ({ page }) => {
    await page.setViewportSize(vp);
    await startLevel1(page);
    await page.waitForTimeout(800);
    const [hx, hy] = await hobPoint(page);
    const side = (await snap(page)).hud.active;
    const dir = side === 0 ? -1 : 1;
    // 60 px back and 60 px down: about 85 px, so about power 50 to 55 on these screens.
    await pullFrom(page, hx, hy, dir * 60, 60);
    const a = (await snap(page)).hud.aim!;
    await pullFrom(page, hx, hy - 24, dir * 60, 60);
    const b = (await snap(page)).hud.aim!;
    expect(Math.abs(a.power - b.power)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.angle - b.angle)).toBeLessThanOrEqual(10);
    const full = 0.4 * Math.min(vp.width, vp.height);
    expect(Math.abs(a.power - Math.round((Math.hypot(60, 60) / full) * 100))).toBeLessThanOrEqual(3);
  });
}

test('the aim band, beam, badges and miss tag draw after a shot', async ({ page }, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await startLevel1(page);
  await page.waitForTimeout(800);
  let [hx, hy] = await hobPoint(page);
  const dir = (await snap(page)).hud.active === 0 ? -1 : 1;
  await pullFrom(page, hx, hy, dir * 70, 40);
  await page.getByTestId('fire').click({ force: true });
  await expect.poll(async () => { const s = await snap(page); return s.phase === 'plan' && s.hud.active === 0 && s.pins.length > 0; }, { timeout: 60_000 }).toBe(true);
  await page.waitForTimeout(800);
  [hx, hy] = await hobPoint(page);
  await pullFrom(page, hx, hy, dir * 76, 36, true);
  await page.screenshot({ path: info.outputPath('aim-drag.png') });
  await page.mouse.move(hx + 4, hy + 4);
  await page.screenshot({ path: info.outputPath('aim-cancel.png') });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('aim-rest.png') });
});
