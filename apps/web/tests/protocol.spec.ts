// Checks the view adapter against the core's own fixtures (core/fixtures, core/API.md),
// with no browser and no wasm: a fake Game hands back the fixture snapshots.
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RealCore } from '../src/core/real';
import type { WasmModule } from '../src/core/protocol';

const root = resolve(process.cwd(), '../..');
const fx = (n: string) => JSON.parse(readFileSync(resolve(root, 'core/fixtures', n), 'utf8'));
const has = existsSync(resolve(root, 'core/fixtures/snapshot_plan.json')) && existsSync(resolve(root, 'content/levels'));

function bundle(): string {
  const c = (n: string) => JSON.parse(readFileSync(resolve(root, 'content', n), 'utf8'));
  const levels = readdirSync(resolve(root, 'content/levels')).filter((f) => f.endsWith('.json')).map((f) => c(`levels/${f}`));
  return JSON.stringify({ materials: c('materials.json'), hobs: c('hobs.json'), shots: c('shots.json'), blueprints: c('blueprints.json'), starter_box: c('starter_box.json'), levels });
}

function fake(snaps: unknown[]): { mod: WasmModule; sent: string[] } {
  const sent: string[] = [];
  let i = 0;
  class Game {
    command(json: string) { sent.push(json); return JSON.stringify({ ok: true }); }
    step() { return JSON.stringify({ tick: 0, phase: 'plan' }); }
    snapshot() { const s = snaps[Math.min(i, snaps.length - 1)]; i++; return JSON.stringify(s); }
    free() {}
  }
  const mod = { default: async () => undefined, Game, cp_version: () => '{"sim":"0.1.0","tick_hz":120}', default_content: bundle } as unknown as WasmModule;
  return { mod, sent };
}

test.skip(!has, 'core fixtures not present');

test('plan snapshot maps to the view (y flipped, HUD, crew)', () => {
  const plan = fx('snapshot_plan.json');
  const { mod, sent } = fake([plan]);
  const core = new RealCore(mod);
  core.newBattle({ mode: 'campaign', level: '1-1', seed: 42, difficulty: 'fair', windOff: false, sides: [{ name: 'You', human: true, crew: ['marge'] }, { name: 'Sir Pudge', human: false, crew: [] }] });
  const s = core.snapshot();
  expect(s.phase).toBe('plan');
  expect(s.roundCap).toBe(8);
  const marge = s.hobs.find((h) => h.def === 'marge')!;
  expect(marge.y).toBe(plan.map.h - plan.hobs[0].y);
  expect(s.hud.hob).toBe('0');
  expect(s.hud.shots[0].id).toBe('plain');
  expect(s.terrain.width).toBe(plan.map.w);
  expect(s.blocks.length).toBeGreaterThan(0);
  // view commands become protocol commands with the API names
  core.command({ cmd: 'aim', angle: 450, power: 62 });
  core.command({ cmd: 'pick_hob', id: '0' });
  expect(sent.map((x) => JSON.parse(x).cmd)).toEqual(['aim', 'pick_hob']);
  expect(JSON.parse(sent[1]).hob).toBe(0);
});

test('lean snapshot keeps the last full one and moves shells', () => {
  const { mod } = fake([fx('snapshot_plan.json'), fx('snapshot_lean.json')]);
  const core = new RealCore(mod);
  core.newBattle({ mode: 'campaign', level: '1-1', seed: 42, difficulty: 'fair', windOff: false, sides: [{ name: 'You', human: true, crew: ['marge'] }, { name: 'R', human: false, crew: [] }] });
  core.snapshot();
  core.command({ cmd: 'fire' }); // pulls the lean snapshot
  const s = core.snapshot();
  expect(s.shells.length).toBe(1);
  expect(s.shells[0].kind).toBe('clodpot');
  expect(s.hobs.length).toBeGreaterThan(0);
});
