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

// Every key the core sends must be one the adapter knows: drawn, read, or listed here on
// purpose as not shown yet. A new key in core/fixtures fails this test until the adapter is told.
const KNOWN: Record<string, string[]> = {
  '': ['aim', 'awaiting', 'castles', 'draft', 'events', 'full', 'ghosts', 'hash', 'hobs', 'hud', 'last_ai', 'level', 'map', 'mode', 'phase', 'preview', 'props', 'result', 'shells', 'side', 'terrain', 'tick'],
  // v0.2 lean aim snapshot: the new aim and preview are merged into the last full one
  '.aim': ['angle', 'hob', 'power', 'side'],
  '.castles[]': ['base_y', 'block', 'blocks', 'cols', 'fatigue', 'held', 'kettle', 'rooms', 'rows', 'shimmer', 'side', 'steam', 'steam_turn', 'x'],
  '.castles[].blocks[]': ['battered', 'c', 'hp', 'mat', 'max', 'peephole', 'r', 'root', 'x', 'y'],
  '.castles[].kettle': ['box', 'c', 'hp', 'intact', 'lid', 'max', 'r', 'room'],
  '.castles[].rooms[]': ['box', 'c', 'flap', 'id', 'intact', 'kind', 'lid', 'loophole', 'r'],
  '.ghosts[]': ['angle', 'hob', 'index', 'pin', 'points', 'power', 'recalled', 'round', 'self_hit', 'shot', 'side'],
  // not shown yet on purpose: cover, grudge, clatter (passives), dummy, nook
  '.hobs[]': ['aim', 'buried', 'can_fire', 'class', 'clatter', 'cover', 'def', 'dummy', 'grudge', 'hp', 'id', 'knack', 'knack_uses', 'max', 'name', 'nook', 'plain', 'rest', 'side', 'state', 'x', 'y'],
  '.hobs[].aim': ['angle', 'power'],
  // not shown yet on purpose: score, puff_up, front_rounds_left, crew (the pips read hobs[]),
  // shove_off_cost (the refusal says not_enough_steam), rules (objective and cap_win)
  // v0.3: fire (Fire lit or grey, and why), fatigue_in (the round label warns); fatigue and
  // fatigue_round are read from castles[].fatigue and fatigue_in instead
  '.hud': ['boss', 'control', 'crew', 'doodads', 'fatigue', 'fatigue_in', 'fatigue_round', 'fire', 'forecast', 'front_rounds_left', 'hands', 'handicap', 'kettle_pct', 'names', 'puff_up', 'round', 'round_cap', 'rules', 'score', 'selected', 'shots', 'shove_off_cost', 'side', 'squall', 'squall_round', 'squall_warning', 'steam', 'steam_max', 'steam_turn_left', 'turn', 'volley', 'wind'],
  '.hud.fire': ['ready', 'text', 'why'],
  '.hud.shots[]': ['id', 'ready', 'shot', 'text', 'why'],
  '.hud.handicap[]': ['crew', 'help', 'preview_pct', 'steam'],
  '.hud.volley': ['actions', 'left'],
  // roller and shears also come as props[]; roller_done shows as a greyed drum
  '.hud.boss': ['cut', 'jam', 'phase', 'roller', 'roller_done', 'shears'],
  '.hud.rules': ['cap_win', 'objective'],
  '.hud.rules.objective': ['count', 'tag'],
  '.hud.crew[][]': ['class', 'hp_pct', 'id', 'rest', 'state'],
  '.hud.hands[][]': ['card', 'dud', 'id', 'match', 'name', 'weight'],
  '.hud.selected': ['hob', 'shot'],
  '.map': ['chunk', 'h', 'w'],
  '.terrain': ['chunks'],
  '.terrain.chunks[]': ['cx', 'cy', 'data', 'h', 'w', 'x', 'y'],
  '.props[]': ['hp', 'id', 'kind', 'max', 'shot', 'side', 'tag', 'x', 'y'],
  // best_shot: the winner's, for "Best shot" on the results (v0.3)
  '.result': ['best_shot', 'broke', 'buttons', 'how', 'pennants', 'pennants_new', 'round', 'score', 'stats', 'winner'],
  '.result.best_shot': ['angle', 'dmg', 'hob', 'hob_name', 'power', 'round', 'shot', 'shot_name', 'side'],
  '.result.stats[].best_shot': ['angle', 'dmg', 'hob', 'hob_name', 'power', 'round', 'shot', 'shot_name', 'side'],
  // not shown yet on purpose: best_streak, bonks, blocks_lost, kettle_lost, hobs_lost (duel results show shots, hits, blocks)
  '.result.stats[]': ['best_shot', 'best_streak', 'blocks_dropped', 'blocks_lost', 'bonks', 'hits', 'hobs_lost', 'kettle_lost', 'shots'],
  // the "what broke you" line reads how, last and the losses; top (the three worst shots) is for the replay card
  '.result.broke': ['blocks_lost', 'hobs_bonked', 'how', 'kettle_lost', 'last', 'side', 'top'],
  '.result.broke.last': ['dmg', 'hob', 'hob_name', 'round', 'shot', 'shot_name'],
  '.result.broke.top[]': ['dmg', 'hob', 'hob_name', 'round', 'shot', 'shot_name'],
  '.draft': ['next', 'picks', 'picks_each', 'pool', 'wish'],
};

test('the adapter knows every snapshot key in core/fixtures', () => {
  const unknown: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) { for (const x of v) walk(x, `${path}[]`); return; }
    if (!v || typeof v !== 'object') return;
    if (path.startsWith('.events') || path.startsWith('.last_ai')) return; // events are read by type in toView
    for (const [k, x] of Object.entries(v)) {
      if (!(KNOWN[path] ?? []).includes(k)) unknown.push(`${path || '<root>'}.${k}`);
      walk(x, `${path}.${k}`);
    }
  };
  for (const f of ['snapshot_plan.json', 'snapshot_lean.json', 'snapshot_after_shot.json', 'snapshot_aim_lean.json', 'snapshot_boss_1_10.json', 'snapshot_ended.json', 'snapshot_rescue_1_7.json']) walk(fx(f), '');
  expect([...new Set(unknown)]).toEqual([]);
});

test('Shot Weight from content maps to Light, Medium, Heavy', async () => {
  const { weightOf } = await import('../src/core/real');
  const shots = JSON.parse(readFileSync(resolve(root, 'content/shots.json'), 'utf8')) as { id: string; weight?: string }[];
  const want: Record<string, number> = { L: 0, M: 1, H: 2 };
  for (const s of shots) if (s.weight) expect(weightOf(s.weight), s.id).toBe(want[s.weight]);
  expect(shots.some((s) => weightOf(s.weight) === 2)).toBe(true);
});

test('rooms, props, root and battered reach the view', () => {
  const plan = fx('snapshot_plan.json');
  const s0 = structuredClone(plan);
  s0.props = [{ id: 1, side: 2, kind: 'cage_bar', tag: 'cage', x: 1182, y: 284, hp: 50, max: 50, shot: null }];
  s0.castles[1].blocks[0].root = true;
  s0.castles[0].blocks[0].battered = true;
  s0.castles[0].fatigue = true;
  s0.castles[0].rooms[0].flap = true;
  const { mod } = fake([s0]);
  const core = new RealCore(mod);
  core.newBattle({ mode: 'campaign', level: '1-1', seed: 1, difficulty: 'fair', windOff: false, sides: [{ name: 'You', human: true, crew: ['marge'] }, { name: 'R', human: false, crew: [] }] });
  const s = core.snapshot();
  expect(s.props[0]).toMatchObject({ kind: 'cage_bar', y: plan.map.h - 284 });
  expect(s.blocks.some((b) => b.side === 1 && b.root)).toBe(true);
  expect(s.blocks.some((b) => b.side === 0 && b.battered)).toBe(true);
  expect(s.fatigue[0]).toBe(true);
  expect(s.rooms.find((r) => r.side === 0)?.flap).toBe(true);
});
