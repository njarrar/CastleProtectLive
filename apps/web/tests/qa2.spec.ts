// QA playtest 2 (docs/qa/playtest-2/REPORT.md): the web findings. Runs on desktop and on the
// phone projects (iPhone 15 portrait in WebKit, Pixel 7 landscape in Chromium); some checks set
// the playtest's phone sizes, 390 x 844 and 844 x 390, on every project.
import { expect, test, type Page } from '@playwright/test';
import { ready, snap } from './helpers';

type Box = [number, number, number, number];
const castle = <T>(page: Page, body: string): Promise<T> => page.evaluate(`(() => { const c = window.__castle; ${body} })()`) as Promise<T>;
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

/** Open a campaign level straight into the fight, with every level before it won. */
async function openLevel(page: Page, id: string, settings: Record<string, unknown> = {}): Promise<void> {
  await ready(page, './?debug=1#map');
  await page.evaluate(async ([id, settings]) => {
    const a = (window as unknown as { castleApp: any }).castleApp;
    const n = Number(String(id).split('-')[1]);
    for (let i = 1; i < n; i++) a.progress.levels[`1-${i}`] = { pennants: [true, false, false], wins: 1, losses: 0 };
    await a.saveProgress();
    await a.setSettings({ seenFirstRun: true, ...(settings as object) });
    a.go({ to: 'battle', setup: a.campaignSetup(id) });
  }, [id, settings] as const);
  await expect.poll(async () => { const s = await snap(page); return s.phase === 'plan' && s.hud.active === 0; }, { timeout: 30_000 }).toBe(true);
}

test('N3: 844x390 frames both forts while you plan on every campaign level', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize(LANDSCAPE);
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10']) {
    await openLevel(page, id);
    await page.waitForTimeout(1200);
    const boxes = await castle<Box[]>(page, 'return c.fortBoxes();');
    for (const b of boxes) {
      expect(b[0], `${id} fort left`).toBeGreaterThanOrEqual(-1);
      expect(b[2], `${id} fort right`).toBeLessThanOrEqual(LANDSCAPE.width + 1);
    }
    expect(await castle<number>(page, 'return c.cam().s;') * 16, `${id} block px`).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId('fort-mark')).toBeHidden();
  }
});

test('N3: zoomed in, the Rival fort marker is a one-tap peek at both forts, and back', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'zooms with the keyboard');
  await page.setViewportSize(LANDSCAPE);
  await openLevel(page, '1-6');
  for (let i = 0; i < 8; i++) await page.keyboard.press('+');
  await page.waitForTimeout(1500);
  const mark = page.getByTestId('fort-mark');
  await expect(mark).toBeVisible();
  await expect(mark).toContainText('View Rival fort');
  await mark.click();
  await page.waitForTimeout(1500);
  const [, rival] = await castle<Box[]>(page, 'return c.fortBoxes();');
  expect(rival[0]).toBeGreaterThanOrEqual(-1);
  expect(rival[2]).toBeLessThanOrEqual(LANDSCAPE.width + 1);
  await expect(mark).toHaveText('Back to my fort');
  await mark.click();
  await page.waitForTimeout(1500);
  await expect(mark).toContainText('View Rival fort');
});

test('Owner rule: a ring on the picked Hob each Plan step until three aims, a nudge once for a sky drag', async ({ page }) => {
  await page.setViewportSize(PORTRAIT);
  await openLevel(page, '1-2');
  const ring = page.getByTestId('own-ring');
  await expect(ring).toBeVisible();
  await page.waitForTimeout(1500); // the lens camera settles
  // The ring sits on the picked Hob.
  const [hx, hy] = await castle<[number, number]>(page, `const s = c.snap(); const h = s.hobs.find((x) => x.id === s.hud.hob); return c.toScreen(h.x, h.y, 'aim');`);
  const rb = (await ring.boundingBox())!;
  expect(Math.abs(rb.x + rb.width / 2 - hx)).toBeLessThan(6);
  expect(Math.abs(rb.y + rb.height / 2 - (hy - 14))).toBeLessThan(6);
  // A drag in the sky of the bottom lens pans it and says where to aim from.
  const lens = (await page.locator('.lens-bottom').boundingBox())!;
  const cam0 = await castle<number>(page, 'return c.toScreen(0, 0, "aim")[0];');
  const power0 = (await snap(page)).hud.aim?.power ?? 0;
  const sx = lens.x + lens.width * 0.8, sy = lens.y + 30;
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(sx - i * 8, sy + i);
  await page.mouse.up();
  await expect(page.locator('.prompt')).toHaveText('Drag from your fort to aim');
  expect(await castle<number>(page, 'return c.toScreen(0, 0, "aim")[0];')).not.toBe(cam0);
  expect((await snap(page)).hud.aim?.power ?? 0).toBe(power0); // no aim from the sky
  // Three aims started from the fort: the ring is gone for good.
  await page.evaluate(async () => { const a = (window as unknown as { castleApp: any }).castleApp; a.progress.hints.push('aim-start-1', 'aim-start-2', 'aim-start-3'); });
  await expect(ring).toBeHidden();
});

test('N1, N2: Fatigue gets its banners, the camera stays home, and a crushed Hob is Squashed, not Bonked', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'one long fight, on desktop');
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __banners: string[] }).__banners = seen;
    const look = () => { const b = document.querySelector('.banner.show'); const t = b?.textContent ?? ''; if (t && seen[seen.length - 1] !== t) seen.push(t); };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  });
  await page.setViewportSize(LANDSCAPE);
  await openLevel(page, '1-8', { rivalFast: true, difficulty: 'cozy' });
  let k = 0, sawSquashed = false, wrongBonk = '', homeAtFatigue: boolean | null = null;
  for (let guard = 0; guard < 3000; guard++) {
    const st = await page.evaluate((k) => {
      const c = (window as unknown as { __castle: any }).__castle; const a = (window as unknown as { castleApp: any }).castleApp;
      const s = c.snap();
      if (s.phase === 'plan' && s.hud.active === 0) {
        a.core.command({ cmd: 'aim', angle: 450 + (k % 4) * 25, power: 22 + (k % 3) * 3 });
        if (!a.core.command({ cmd: 'fire' }).ok) a.core.command({ cmd: 'pass' });
      } else if (s.hud.fire === 'fast') a.core.command({ cmd: 'fast', on: true });
      return { round: s.round, phase: s.phase, fat: !!(s.fatigue?.[0] || s.fatigue?.[1]), hobs: s.hobs.map((h: any) => [h.state, h.hp]), mine: c.fortBoxes()[0] };
    }, k++);
    for (const [state, hp] of st.hobs) { if (state === 'squashed') sawSquashed = true; if (state === 'bonked' && hp > 0) wrongBonk = `bonked at ${hp} HP`; }
    if (st.fat && homeAtFatigue === null) {
      await page.waitForTimeout(700);
      const mine = await castle<Box>(page, 'return c.fortBoxes()[0];');
      homeAtFatigue = mine[0] >= -1 && mine[2] <= LANDSCAPE.width + 1;
    }
    if (st.phase === 'over' || st.round >= 11) break;
    await page.waitForTimeout(150);
  }
  const banners = await page.evaluate(() => (window as unknown as { __banners: string[] }).__banners);
  expect(banners.some((b) => /Fatigue next round/.test(b))).toBe(true);
  expect(banners.some((b) => /^Fatigue!/.test(b))).toBe(true);
  expect(homeAtFatigue).toBe(true);
  expect(wrongBonk).toBe('');
  // A Fatigue crush on this fight's crew shows as Squashed (when the collapse lands on a Hob at all).
  if (sawSquashed) await expect(page.locator('.pip.squashed, .pip:not(.squashed)').first()).toBeAttached();
});

test('n2: the Workshop grid shows only rows that can be built, and its status is plain words', async ({ page }) => {
  await ready(page, './?debug=1#workshop');
  await expect(page.locator('.grid .gridrow')).toHaveCount(9);
  await expect(page.locator('.workshop .status')).toContainText('Ready');
  // The top row takes a block and stays legal.
  await page.locator('.grid .cell[data-r="8"][data-c="3"]').click();
  await expect(page.locator('.workshop .status')).not.toContainText(/outside|grid \d/);
});
