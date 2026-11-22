// Review capture for the feel pass: finds an aim in level 1-1 that knocks part of the Rival fort
// down, then plays it in the real build at 390x844 and 844x390 with screenshots at the beats
// (aim, flight, impact, collapse, settle) and a Playwright video of each. Also profiles the
// shot with CPU throttling 4x and prints frame times.
//
//   npm run build && node scripts/capture-feel.mjs [outDir]
// Needs Chromium for Playwright (npx playwright install chromium).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? resolve(here, '../../../docs/review/code/web-shots/feel-1'));
const base = process.env.VITE_BASE ?? '/';
const port = 4181;
const url = `http://127.0.0.1:${port}${base}`;
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: resolve(here, '..'), stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* ok */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 500)); }

const SETUP = { mode: 'campaign', level: process.env.LEVEL ?? '1-1', seed: 1, difficulty: 'fair', windOff: false, sides: [{ name: 'You', human: true, crew: ['marge'] }, { name: 'Sir Pudge', human: false, crew: [] }] };

const browser = await chromium.launch();

/** Search aims on the core with no battle screen running; returns the aim with the biggest collapse. */
async function findAim() {
  const page = await browser.newPage();
  await page.goto(`${url}?debug=1#map`);
  await page.waitForSelector('html[data-ready=true]');
  const best = await page.evaluate((setup) => {
    const core = window.castleApp.core;
    let best = null;
    for (let angle = 300; angle <= 700; angle += 50) {
      for (let power = 40; power <= 100; power += 4) {
        core.newBattle(setup);
        let s = core.snapshot();
        if (s.phase === 'draft') { core.command({ cmd: 'end_draft' }); s = core.snapshot(); }
        for (let i = 0; i < 400 && s.phase !== 'plan'; i++) { core.step(4); s = core.snapshot(); }
        core.command({ cmd: 'aim', angle, power });
        if (!core.command({ cmd: 'fire' }).ok) continue;
        let fell = 0, broke = 0, dmg = 0;
        for (let i = 0; i < 900; i++) {
          core.step(2);
          s = core.snapshot();
          for (const e of s.events) {
            if (e.t === 'collapse') fell += e.blocks.length;
            if (e.t === 'break') broke++;
            if (e.t === 'hit') dmg += e.dmg;
          }
          s.events.length = 0;
          if (s.phase === 'rival' || (s.phase === 'plan' && i > 30)) break;
        }
        const score = fell * 100 + broke * 10 + dmg / 10;
        if (!best || score > best.score) best = { angle, power, fell, broke, dmg, score };
      }
    }
    return best;
  }, SETUP);
  await page.close();
  return best;
}

async function capture(aim, w, h, tag) {
  const vdir = join(out, `.video-${tag}`);
  rmSync(vdir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, recordVideo: { dir: vdir, size: { width: w, height: h } } });
  const page = await ctx.newPage();
  await page.goto(`${url}?debug=1#map`);
  await page.waitForSelector('html[data-ready=true]');
  await page.evaluate((setup) => window.castleApp.go({ to: 'battle', setup }), SETUP);
  await page.waitForFunction(() => window.__castle?.snap().phase === 'plan');
  await page.waitForTimeout(1600);
  await page.evaluate((a) => window.castleApp.core.command({ cmd: 'aim', angle: a.angle, power: a.power }), aim);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${tag}-1-aim.png`) });
  const shots = [];
  await page.getByTestId('fire').click({ force: true });
  const t0 = Date.now();
  let flight = false, impact = false, collapse = false, settle = false;
  while (Date.now() - t0 < 12000) {
    const st = await page.evaluate(() => ({ s: window.__castle.snap().shells.length, f: window.__castle.feel() }));
    if (!flight && st.s && Date.now() - t0 > 500) { flight = true; shots.push(page.screenshot({ path: join(out, `${tag}-2-flight.png`) })); }
    if (flight && !impact && !st.s) { impact = true; await page.waitForTimeout(60); shots.push(page.screenshot({ path: join(out, `${tag}-3-impact.png`) })); }
    if (impact && !collapse && st.f.collapse) { collapse = true; await page.waitForTimeout(350); shots.push(page.screenshot({ path: join(out, `${tag}-4-collapse.png`) })); }
    if (impact && !settle && Date.now() - t0 > 6000) { settle = true; shots.push(page.screenshot({ path: join(out, `${tag}-5-settle.png`) })); break; }
    await page.waitForTimeout(30);
  }
  await Promise.all(shots);
  await page.waitForTimeout(500);
  const v = page.video();
  await ctx.close();
  const vp = await v.path();
  renameSync(vp, join(out, `${tag}-shot-and-collapse.webm`));
  rmSync(vdir, { recursive: true, force: true });
}

/** Frame times over one shot with CPU throttling 4x (a mid phone), at the phone landscape size. */
async function profile(aim) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: Number(process.env.DPR ?? 2) });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${url}?debug=1${process.env.ART ? `&art=${process.env.ART}` : ''}#map`);
  await page.waitForSelector('html[data-ready=true]');
  await page.evaluate((setup) => window.castleApp.go({ to: 'battle', setup }), SETUP);
  await page.waitForFunction(() => window.__castle?.snap().phase === 'plan');
  await page.waitForTimeout(1000);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const heap0 = (await cdp.send('Performance.getMetrics')).metrics;
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    window.__t0 = performance.now();
    const f = (t) => { window.__frames.push([t - window.__t0, t - last]); last = t; if (window.__frames.length < 100000) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  await page.waitForTimeout(2000); // idle plan step
  await page.evaluate((a) => window.castleApp.core.command({ cmd: 'aim', angle: a.angle, power: a.power }), aim);
  await page.getByTestId('fire').click({ force: true });
  await page.waitForTimeout(7000);
  const frames = await page.evaluate(() => window.__frames);
  const heap1 = (await cdp.send('Performance.getMetrics')).metrics;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
  const pick = (m, k) => m.find((x) => x.name === k)?.value ?? 0;
  const plan = frames.filter(([t]) => t > 200 && t < 2000).map(([, d]) => d), shot = frames.filter(([t]) => t > 2100).map(([, d]) => d);
  const stats = (a) => {
    const s = [...a].sort((x, y) => x - y);
    const avg = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return { frames: a.length, fps: +(1000 / avg).toFixed(1), avg_ms: +avg.toFixed(2), p95_ms: +s[Math.floor(s.length * 0.95)].toFixed(2), worst_ms: +s[s.length - 1].toFixed(2), over_20ms: a.filter((x) => x > 20).length };
  };
  return {
    plan: stats(plan), shot: stats(shot),
    js_heap_mb: +(pick(heap1, 'JSHeapUsedSize') / 1048576).toFixed(1),
    script_s: +(pick(heap1, 'ScriptDuration') - pick(heap0, 'ScriptDuration')).toFixed(2),
    layout_count: pick(heap1, 'LayoutCount') - pick(heap0, 'LayoutCount'),
  };
}

/** What a first visit downloads (low-DPI and high-DPI), from the network log. */
async function loadSize(dpr) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const seen = new Map();
  page.on('response', async (r) => {
    try { const b = await r.body(); seen.set(r.url(), b.length); } catch { /* redirects */ }
  });
  await page.goto(`${url}`);
  await page.waitForSelector('html[data-ready=true]');
  await page.waitForTimeout(1500);
  const boot = [...seen.values()].reduce((a, b) => a + b, 0);
  await page.getByTestId('play').click();
  await page.waitForTimeout(6000);
  const all = [...seen.values()].reduce((a, b) => a + b, 0);
  const atlas2x = [...seen.keys()].filter((u) => /castle@2x-\d\.(\w+\.)?webp/.test(u)).length;
  await ctx.close();
  return { dpr, boot_mb: +(boot / 1048576).toFixed(2), after_first_battle_mb: +(all / 1048576).toFixed(2), atlas2x_pages: atlas2x };
}

const only = process.env.ONLY;
const aim = process.env.AIM ? JSON.parse(process.env.AIM) : await findAim();
console.log('aim', JSON.stringify(aim));
if (!only || only === 'shots') {
  await capture(aim, 390, 844, 'portrait-390x844');
  await capture(aim, 844, 390, 'landscape-844x390');
}
console.log('profile', JSON.stringify(await profile(aim)));
for (const d of [1, 2]) console.log('load', JSON.stringify(await loadSize(d)));
console.log('files', readdirSync(out).join(' '));
await browser.close();
stop();
process.exit(0);
