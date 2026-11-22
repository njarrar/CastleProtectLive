// Shared helpers for the specs (not a spec itself).
import { expect, type Page } from '@playwright/test';

export type Snap = {
  tick: number; phase: string; round: number;
  hud: { aim?: { angle: number; power: number }; fire: string; active: number; canPass: boolean };
  shells: unknown[]; pins: unknown[];
  kettles: { side: number; room?: { x: number; y: number; w: number; h: number } }[];
  hobs: { id: string; side: number; x: number; y: number }[];
};
type Castle = { snap: () => Snap; layout: () => string; joined: () => boolean; dpr: () => number };
export const snap = (page: Page) => page.evaluate(() => (window as unknown as { __castle: Castle }).__castle.snap());
export const layout = (page: Page) => page.evaluate(() => (window as unknown as { __castle: Castle }).__castle.layout());

export function idbGet(page: Page, key: string): Promise<unknown> {
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

export function idbPut(page: Page, key: string, value: unknown): Promise<void> {
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

export async function ready(page: Page, url = './?debug=1'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('html[data-ready=true]')).toBeAttached();
}

/** First run: Play goes straight into level 1-1. Waits for the Plan step. */
export async function startLevel1(page: Page): Promise<void> {
  await ready(page);
  await page.getByTestId('play').click();
  await expect(page.locator('.battle')).toBeVisible();
  await expect.poll(async () => (await snap(page)).phase).toBe('plan');
}

/** An Aim Drag in the lens that aims (the bottom lens when tall, the field when wide). */
export async function aim(page: Page): Promise<void> {
  const tall = (await layout(page)) === 'tall';
  const box = (await page.locator(tall ? '.lens-bottom' : 'canvas.field').boundingBox())!;
  const x0 = box.x + box.width * 0.5, y0 = box.y + box.height * (tall ? 0.35 : 0.45);
  const step = Math.min(18, box.width / 24);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 - i * step, y0 + i * step * 0.9);
  await page.mouse.up();
  await expect.poll(async () => (await snap(page)).hud.aim?.power ?? 0).toBeGreaterThan(10);
  await page.waitForTimeout(200);
}

/** Aim, fire, and wait until the shell is in the air. */
export async function fireShot(page: Page): Promise<void> {
  await aim(page);
  await page.getByTestId('fire').click({ force: true });
  await expect.poll(async () => (await snap(page)).phase, { timeout: 10_000 }).not.toBe('plan');
}

/** Open Pause by its key (Wide: top strip; Tall: the floats over the bottom lens). */
export async function openPause(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause' }).click({ force: true });
  await expect(page.locator('.pause-card')).toBeVisible();
}
