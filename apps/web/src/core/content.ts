// Dev only: data for the mock core (mock.ts). Nothing in the production build imports this;
// the real core ships all of it from content/ JSON. Names, habits and goal words come from
// content JSON and content/text.json too, so the mock never shows a stale name. Only the
// mock's own play numbers (radius, damage) live here.
import hobsRaw from '../../../../content/hobs.json' with { type: 'json' };
import shotsRaw from '../../../../content/shots.json' with { type: 'json' };
import classesRaw from '../../../../content/classes.json' with { type: 'json' };
import appRaw from '../../../../content/app.json' with { type: 'json' };
import { has, hobShort, rivalShort, t } from '../ui/text';
import type { Blueprint, BlueprintCell, HobClass, HobInfo, LevelInfo } from './types';

interface RawLevelFile {
  id: string; name: string; type: string;
  player: { crew_size: number };
  rival: { name?: string; habit?: string; crew: string[]; aim?: number };
  rules: { round_cap: number; squall?: boolean; wind?: { min: number; max: number }; rummage?: { pool: number } };
  pennants: { type: string; text: string; value?: number }[];
}
const levelFiles = import.meta.glob<RawLevelFile>('../../../../content/levels/*.json', { eager: true, import: 'default' });
const hobDefs = hobsRaw as { id: string; name: string; class: string; hp: number; player?: boolean }[];
const shotName = (id: string): string => (shotsRaw as { id: string; name: string }[]).find((x) => x.id === id)?.name ?? id;
const JOINS = (appRaw as { joins: Record<string, string> }).joins;

export const HOBS: HobInfo[] = hobDefs.filter((x) => x.player).map((x) => ({
  id: x.id, name: hobShort(x.id, x.name), cls: x.class as HobClass, hp: x.hp, joins: JOINS[x.id],
}));

const classOf = (id: string): string => hobDefs.find((x) => x.id === id)?.class ?? 'lobber';
const levelOrder = (id: string) => Number(id.split('-')[1] ?? 0);

export const LEVELS: Omit<LevelInfo, 'draftPool' | 'draftPicks' | 'doodads'>[] = Object.values(levelFiles)
  .filter((l) => /^\d+-\d+$/.test(l.id))
  .sort((a, b) => levelOrder(a.id) - levelOrder(b.id))
  .map((l) => {
    const kind: LevelInfo['kind'] = l.type === 'rescue' ? 'rescue' : l.type === 'grand_fort' ? 'grand_fort' : 'siege';
    const w = l.rules.wind ?? { min: 0, max: 0 };
    const goal = (p: RawLevelFile['pennants'][number] | undefined): string => {
      if (!p) return '';
      const vars = { n: p.value, rival: rivalShort(l.rival.name, l.id) };
      if (has(`levels.${l.id}.goals.${p.type}`)) return t(`levels.${l.id}.goals.${p.type}`, vars);
      return has(`pennants.${p.type}`) ? t(`pennants.${p.type}`, vars) : p.text;
    };
    return {
      id: l.id, name: l.name, kind, type: t(`map.types.${kind}`), rival: l.rival.name ?? '', habit: l.rival.habit ?? '',
      rivalCrew: l.rival.crew.map(classOf).filter((c) => c !== 'dummy') as HobClass[],
      rivalUnits: l.rival.crew.filter((id) => classOf(id) !== 'dummy'),
      aim: l.rival.aim ?? 1, roundCap: l.rules.round_cap, squall: l.rules.squall !== false,
      wind: w.max === 0 ? t('level_card.wind_none') : w.min === w.max ? t('level_card.wind_one', { n: w.max }) : t('level_card.wind_range', { min: w.min, max: w.max }),
      goals: [0, 1, 2].map((i) => goal(l.pennants[i])) as [string, string, string],
      crewSize: l.player.crew_size, draft: (l.rules.rummage?.pool ?? 0) > 0,
    };
  });

export interface ShellDef {
  id: string;
  name: string;
  weight: 0 | 1 | 2;
  best?: HobInfo['cls'];
  hint: string;
  dud?: boolean;
  radius: number;
  dmg: number;
  dig?: number;
  split?: number;
  grav?: number;
  kettleX?: number;
}

const card = (id: string): string => {
  const c = (shotsRaw as { id: string; card?: string | { line?: string } }[]).find((x) => x.id === id)?.card;
  return typeof c === 'string' ? c : c?.line ?? '';
};
const shell = (id: string, weight: 0 | 1 | 2, best: HobClass, nums: Omit<ShellDef, 'id' | 'name' | 'weight' | 'best' | 'hint'>): ShellDef =>
  ({ id, name: shotName(id), weight, best, hint: card(id), ...nums });

export const SHELLS: ShellDef[] = [
  shell('pudding_bomb', 2, 'lobber', { radius: 52, dmg: 70 }),
  shell('marble_sack', 0, 'scatterjack', { radius: 22, dmg: 28, split: 3 }),
  shell('mole_mail', 1, 'delver', { radius: 34, dmg: 40, dig: 40 }),
  shell('nosy_goose', 0, 'zinger', { radius: 20, dmg: 45, grav: 0.55 }),
  shell('lid_lifter', 1, 'patcher', { radius: 24, dmg: 35, kettleX: 2.2 }),
  shell('old_turnip', 1, 'lobber', { radius: 26, dmg: 55, grav: 1.3 }),
  shell('rubber_radish', 0, 'boinker', { radius: 26, dmg: 34 }),
  shell('sod_sack', 0, 'delver', { radius: 24, dmg: 20, dig: -1 }),
];

// Plain Shots by Class: the id and name from content/classes.json and shots.json.
const plainOf = (cls: string, fallback: string): string => (classesRaw as { id: string; plain: string }[]).find((c) => c.id === cls)?.plain ?? fallback;
const plain = (cls: string, fallback: string, nums: { radius: number; dmg: number; grav?: number }) => {
  const id = plainOf(cls, fallback);
  return { id, name: shotName(id), ...nums };
};
export const PLAIN: Record<string, { id: string; name: string; radius: number; dmg: number; grav?: number }> = {
  lobber: plain('lobber', 'clodpot', { radius: 30, dmg: 38 }),
  zinger: plain('zinger', 'hatpin', { radius: 16, dmg: 40, grav: 0.6 }),
  scatterjack: plain('scatterjack', 'gravel_sneeze', { radius: 24, dmg: 30 }),
  delver: plain('delver', 'nibbler', { radius: 26, dmg: 34 }),
  boinker: plain('boinker', 'bouncebean', { radius: 24, dmg: 32 }),
  patcher: plain('patcher', 'mendglob', { radius: 20, dmg: 30 }),
  sizzler: plain('lobber', 'clodpot', { radius: 22, dmg: 30 }),
  peeper: plain('zinger', 'hatpin', { radius: 14, dmg: 26 }),
};
// Knacks by Class: the id and name from content/shots.json.
const knack = (id: string, nums: { radius: number; dmg: number; grav?: number; split?: number }) => ({ name: shotName(id), ...nums });
export const KNACK: Record<string, { name: string; radius: number; dmg: number; grav?: number; split?: number }> = {
  lobber: knack('grand_dumpling', { radius: 46, dmg: 60 }),
  zinger: knack('sunspear', { radius: 18, dmg: 70, grav: 0.4 }),
  scatterjack: knack('pepper_rain', { radius: 20, dmg: 24, split: 5 }),
  delver: knack('burrowbomb', { radius: 22, dmg: 80, grav: 1.2 }),
  boinker: knack('rolypoly', { radius: 26, dmg: 40 }),
  patcher: knack('barn_raising', { radius: 30, dmg: 40 }),
  sizzler: knack('grand_dumpling', { radius: 30, dmg: 44 }),
  peeper: knack('sunspear', { radius: 14, dmg: 40 }),
};

function grid(cols: number, rows: number, fill: (c: number, r: number) => BlueprintCell['kind'] | null): BlueprintCell[] {
  const out: BlueprintCell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = fill(c, r);
      if (k) out.push({ col: c, row: r, kind: k });
    }
  return out;
}

/** A fort with the kettle low in the middle and Nooks on the face toward the rival. */
export function makeFort(name: string, cols: number, rows: number, mat: (c: number, r: number) => BlueprintCell['kind'], nooks: number): Blueprint {
  const kc = Math.max(1, Math.floor(cols / 2) - 1);
  const nookSpots: [number, number][] = [];
  for (let r = rows - 2; r >= 0 && nookSpots.length < nooks; r -= 2) nookSpots.push([cols - 1, r]);
  for (let r = rows - 1; r >= 2 && nookSpots.length < nooks; r -= 2) nookSpots.push([cols - 2 > kc + 1 ? cols - 2 : 0, r]);
  const cells = grid(cols, rows, (c, r) => {
    if ((c === kc || c === kc + 1) && (r === 0 || r === 1)) return 'kettle';
    if (nookSpots.some(([nc, nr]) => nc === c && nr === r)) return 'nook';
    return mat(c, r);
  });
  return { name, cols, rows, cells };
}

export const STARTER_FORTS: Blueprint[] = [
  makeFort(t('workshop.level_fort'), 5, 5, () => 'wicker', 5),
  makeFort(t('workshop.level_fort'), 5, 5, (_c, r) => (r < 2 ? 'cobble' : 'timber'), 5),
  makeFort(t('workshop.level_fort'), 6, 5, (c) => (c % 2 ? 'timber' : 'wicker'), 5),
];

export const DEFAULT_BLUEPRINT: Blueprint = { id: 'default', ...makeFort(t('workshop.home_fort'), 5, 5, (_c, r) => (r === 0 ? 'timber' : 'wicker'), 5) };

export function levelFort(id: string): Blueprint {
  const n = Number(id.split('-')[1] ?? 1);
  const lvl = LEVELS.find((l) => l.id === id);
  const crew = lvl?.rivalCrew.length ?? 1;
  if (n <= 3) return makeFort(t('workshop.level_fort'), 4, 4, (_c, r) => (n === 3 && r < 2 ? 'timber' : 'wicker'), Math.max(crew, 1));
  if (n <= 6) return makeFort(t('workshop.level_fort'), 5, 4 + (n === 6 ? 3 : 0), () => 'timber', crew);
  if (n <= 9) return makeFort(t('workshop.level_fort'), 5, 5, (_c, r) => (r >= 4 && n === 9 ? 'cobble' : 'timber'), crew);
  return makeFort(t('workshop.level_fort'), 7, 7, (c, r) => (r < 2 || c === 0 ? 'cobble' : 'timber'), crew);
}
