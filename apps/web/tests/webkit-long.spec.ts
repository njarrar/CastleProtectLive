// QA playtest 2, B2: WebKit died 13 to 30 s after Fatigue started on 1-8 and 1-10 (crew of 4).
// This plays 1-8 in WebKit (the webkit-long project) past round 12 and checks the page lives,
// with canvas memory under the iOS Safari limits the whole way: total canvas backing store under
// 300 MB (Safari allows about 384 MB) and no single canvas over 16.7 M pixels (4096 x 4096).
import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const CANVAS_WATCH = () => {
  const live: WeakRef<HTMLCanvasElement>[] = [];
  const W = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!;
  const H = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height')!;
  let maxOne = 0;
  let maxEdge = 0;
  const track = (c: HTMLCanvasElement) => {
    if (!(c as unknown as { __t?: 1 }).__t) { (c as unknown as { __t?: 1 }).__t = 1; live.push(new WeakRef(c)); }
    const w = W.get!.call(c) as number;
    const h = H.get!.call(c) as number;
    maxOne = Math.max(maxOne, w * h);
    maxEdge = Math.max(maxEdge, w, h);
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get() { return W.get!.call(this); }, set(v) { W.set!.call(this, v); track(this); }, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'height', { get() { return H.get!.call(this); }, set(v) { H.set!.call(this, v); track(this); }, configurable: true });
  (window as unknown as { __canvasMem: () => { mb: number; maxOne: number; maxEdge: number } }).__canvasMem = () => {
    let px = 0;
    for (const r of live) { const c = r.deref(); if (c) px += W.get!.call(c) * H.get!.call(c); }
    return { mb: Math.round((px * 4) / 1e6), maxOne, maxEdge };
  };
};

test('B2: 1-8 plays past round 12 in WebKit without a crash, canvas memory in iOS limits', async ({ page }) => {
  test.setTimeout(20 * 60_000);
  let crashed = false;
  page.on('crash', () => { crashed = true; });
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/access control checks/.test(String(e))) errors.push(String(e)); });
  await page.addInitScript(CANVAS_WATCH);
  await ready(page);
  // The second load is controlled by the service worker (clientsClaim), as a returning player is.
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    const a = (window as unknown as { castleApp: any }).castleApp;
    for (let i = 1; i < 8; i++) a.progress.levels[`1-${i}`] = { pennants: [true, false, false], wins: 1, losses: 0 };
    await a.saveProgress();
    // Cozy so the Rival rarely sweeps the crew before Fatigue; its turns at 2x.
    await a.setSettings({ seenFirstRun: true, rivalFast: true, difficulty: 'cozy' });
    a.go({ to: 'battle', setup: a.campaignSetup('1-8') });
  });
  await expect(page.locator('.battle')).toBeVisible();
  // A real tap first, so sound runs as it does for a player.
  await page.locator('canvas.field').click({ position: { x: 40, y: 140 }, force: true });
  let round = 0, phase = '', maxMb = 0, maxOne = 0, maxEdge = 0, fatigue = false, k = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 18 * 60_000 && !crashed) {
    const st = await page.evaluate((k) => {
      const c = (window as unknown as { __castle?: any }).__castle;
      const a = (window as unknown as { castleApp: any }).castleApp;
      if (!c) return null;
      const s = c.snap();
      if (s.phase === 'plan' && s.hud.active === 0) {
        // Short shots into the valley (a flight and a landing each turn, and the fight runs long), else pass.
        a.core.command({ cmd: 'aim', angle: 450 + (k % 4) * 25, power: 22 + (k % 3) * 3 });
        if (!a.core.command({ cmd: 'fire' }).ok) a.core.command({ cmd: 'pass' });
      } else if (s.hud.fire === 'fast') a.core.command({ cmd: 'fast', on: true });
      return { round: s.round as number, phase: s.phase as string, fat: !!(s.fatigue?.[0] || s.fatigue?.[1]), mem: (window as unknown as { __canvasMem: () => { mb: number; maxOne: number; maxEdge: number } }).__canvasMem() };
    }, k++).catch(() => null);
    if (!st) { if (crashed) break; await page.waitForTimeout(300); continue; }
    round = st.round; phase = st.phase; fatigue ||= st.fat;
    maxMb = Math.max(maxMb, st.mem.mb); maxOne = Math.max(maxOne, st.mem.maxOne); maxEdge = Math.max(maxEdge, st.mem.maxEdge);
    if (phase === 'over' || round > 12) break;
    await page.waitForTimeout(250);
  }
  // Past round 12 lets the Fatigue collapse (round 10) and the 30 s after it play out.
  if (!crashed && round > 12) await page.waitForTimeout(5000);
  expect(crashed, 'the page crashed').toBe(false);
  expect(fatigue, 'Fatigue started').toBe(true);
  expect(round).toBeGreaterThan(12);
  expect(maxMb, 'canvas memory (MB)').toBeLessThan(300);
  expect(maxOne, 'largest canvas (px)').toBeLessThanOrEqual(4096 * 4096);
  expect(maxEdge, 'largest canvas edge (px)').toBeLessThanOrEqual(4096);
  // The cause: sound files answered by the service worker. On WebKit they now bypass it, so the
  // worker's sound cache stays empty (the old build filled castle-audio here, and crashed behind
  // a slow network). The page is controlled by the worker, so the check means something.
  const sw = await page.evaluate(async () => {
    const keys = await caches.keys();
    let audio = 0;
    for (const k of keys) if (/audio/.test(k)) audio += (await (await caches.open(k)).keys()).length;
    return { controlled: !!navigator.serviceWorker.controller, audio };
  });
  expect(sw.audio, 'sound files cached by the worker').toBe(0);
  expect(errors).toEqual([]);
});
