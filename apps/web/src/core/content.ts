// Display data for the mock core only. The real core ships these from content/ JSON.
import type { Blueprint, BlueprintCell, HobInfo, LevelInfo } from './types';

export const HOBS: HobInfo[] = [
  { id: 'marge', name: 'Marge', cls: 'lobber', hp: 120 },
  { id: 'quill', name: 'Quill', cls: 'zinger', hp: 80, joins: '1-2' },
  { id: 'jax', name: 'Jax', cls: 'scatterjack', hp: 100, joins: '1-4' },
  { id: 'grub', name: 'Grub', cls: 'delver', hp: 140, joins: '1-5' },
  { id: 'hetty', name: 'Hetty', cls: 'patcher', hp: 110, joins: '1-7' },
  { id: 'bobbin', name: 'Bobbin', cls: 'boinker', hp: 90, joins: '1-8' },
  { id: 'thumper', name: 'Old Thumper', cls: 'lobber', hp: 120, joins: '1-9' },
  { id: 'nan', name: 'Nan', cls: 'scatterjack', hp: 100, joins: '1-10' },
];

export const LEVELS: LevelInfo[] = [
  { id: '1-1', name: 'First Lump', type: 'Siege', rival: 'Sir Pudge', habit: 'Shoots wide first. Then a bit closer.', rivalCrew: ['lobber'], aim: 1, roundCap: 8, wind: 'No wind', goals: ['Win', 'Land 2 hits in a row', 'Win by Round 5'], crewSize: 1, draft: false },
  { id: '1-2', name: 'Two Hats', type: 'Siege', rival: 'Private Tuft Edgerly', habit: 'Shoots your top Hob first.', rivalCrew: ['zinger', 'lobber'], aim: 1, roundCap: 10, wind: 'No wind', goals: ['Win', 'Bonk with each Hob', 'No Hob of yours Bonked'], crewSize: 2, draft: false },
  { id: '1-3', name: 'Kettle on the Knoll', type: 'Siege', rival: 'Corporal Fernsby Clip', habit: 'Hides his crew deep. Leaves the kettle near the wall.', rivalCrew: ['lobber', 'zinger'], aim: 1, roundCap: 12, wind: 'No wind', goals: ['Win', 'Pop the kettle', 'Win by Round 8'], crewSize: 2, draft: false },
  { id: '1-4', name: 'Breezy Tops', type: 'Siege', rival: 'Lance Corporal Sod Turfwick', habit: 'Forgets the wind on his first shot of each front.', rivalCrew: ['lobber', 'scatterjack', 'zinger'], aim: 1, roundCap: 15, wind: 'Wind 2', goals: ['Win', 'Hit in a wind of 2', 'Kettle over half'], crewSize: 3, draft: false },
  { id: '1-5', name: 'The Big One', type: 'Siege', rival: 'Sergeant Posy Rakewell', habit: 'Goes for your hurt Hob.', rivalCrew: ['lobber', 'zinger', 'scatterjack'], aim: 2, roundCap: 15, wind: 'Wind 0 to 2', goals: ['Win', 'Open the roof with a Knack', 'Win by Round 9'], crewSize: 3, draft: false },
  { id: '1-6', name: 'Roof Trouble', type: 'Siege', rival: 'Warden Privet Snedd', habit: 'Aims at roofs.', rivalCrew: ['lobber', 'lobber', 'zinger'], aim: 1, roundCap: 15, wind: 'Wind 0 to 2', goals: ['Win', 'Keep your top Nook', 'Kettle over half'], crewSize: 3, draft: false },
  { id: '1-7', name: 'Hetty in a Jam', type: 'Rescue', rival: 'Corporal Fernsby Clip', habit: 'Rescue. Break the bars.', rivalCrew: ['lobber', 'zinger', 'scatterjack'], aim: 1, roundCap: 14, wind: 'Wind 0 to 2', goals: ['Win', 'Free Hetty by Round 6', 'Hetty unhurt'], crewSize: 4, draft: false },
  { id: '1-8', name: 'Rummage Sale', type: 'Siege', rival: 'Sergeant Posy Rakewell', habit: 'Grabs the biggest shell in the Rummage.', rivalCrew: ['lobber', 'zinger', 'scatterjack', 'boinker'], aim: 2, roundCap: 15, wind: 'Wind 0 to 2', goals: ['Win', 'Bonk a Hob with a Trick Shell', 'Use both your Trick Shells'], crewSize: 4, draft: true },
  { id: '1-9', name: 'Over Loaf Hill', type: 'Siege', rival: 'Lance Corporal Sod Turfwick', habit: 'Slow to find his range. Starts over when you move.', rivalCrew: ['lobber', 'lobber', 'scatterjack', 'zinger'], aim: 2, roundCap: 15, wind: 'Wind 0 to 2', goals: ['Win', 'Walk to the hump', 'No Hob of yours Bonked'], crewSize: 4, draft: true },
  { id: '1-10', name: 'The Topiary Keep', type: 'Grand Fort', rival: 'Marshal Trimm', habit: 'Three phases. Watch the tell.', rivalCrew: ['zinger', 'zinger', 'lobber', 'scatterjack'], aim: 2, roundCap: 18, wind: 'Wind 0 to 3', goals: ['Win', 'Break the Sprinkler Root by Round 4', 'Keep the hill over half'], crewSize: 4, draft: true },
];

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

export const SHELLS: ShellDef[] = [
  { id: 'pudding_bomb', name: 'Pudding Bomb', weight: 2, best: 'lobber', hint: 'Big pot, big boom.', radius: 52, dmg: 70 },
  { id: 'marble_sack', name: 'Marble Sack', weight: 0, best: 'scatterjack', hint: 'Splits in three at the top.', radius: 22, dmg: 28, split: 3 },
  { id: 'mole_mail', name: 'Mole Mail', weight: 1, best: 'delver', hint: 'Bores through the hill, then bursts.', radius: 34, dmg: 40, dig: 40 },
  { id: 'nosy_goose', name: 'Nosy Goose', weight: 0, best: 'zinger', hint: 'Flies flat and far.', radius: 20, dmg: 45, grav: 0.55 },
  { id: 'lid_lifter', name: 'Lid Lifter', weight: 1, best: 'patcher', hint: 'Hits a kettle hard.', radius: 24, dmg: 35, kettleX: 2.2 },
  { id: 'old_turnip', name: 'Old Turnip', weight: 1, best: 'lobber', hint: 'Heavy, low and mean.', radius: 26, dmg: 55, grav: 1.3 },
  { id: 'rubber_radish', name: 'Rubber Radish', weight: 0, best: 'boinker', hint: 'Bounces, then pops.', radius: 26, dmg: 34 },
  { id: 'sod_sack', name: 'Sod Sack', weight: 0, best: 'delver', hint: 'Dumps a heap of dirt.', radius: 24, dmg: 20, dig: -1 },
];

export const PLAIN: Record<string, { id: string; name: string; radius: number; dmg: number; grav?: number }> = {
  lobber: { id: 'clodpot', name: 'Clod Pot', radius: 30, dmg: 38 },
  zinger: { id: 'hatpin', name: 'Hatpin', radius: 16, dmg: 40, grav: 0.6 },
  scatterjack: { id: 'gravel', name: 'Gravel', radius: 24, dmg: 30 },
  delver: { id: 'nibbler', name: 'Nibbler', radius: 26, dmg: 34 },
  boinker: { id: 'bouncebean', name: 'Bounce Bean', radius: 24, dmg: 32 },
  patcher: { id: 'mendglob', name: 'Mend Glob', radius: 20, dmg: 30 },
  sizzler: { id: 'clodpot', name: 'Ember Pot', radius: 22, dmg: 30 },
  peeper: { id: 'hatpin', name: 'Lens Pin', radius: 14, dmg: 26 },
};
export const KNACK: Record<string, { name: string; radius: number; dmg: number; grav?: number; split?: number }> = {
  lobber: { name: 'Grand Dumpling', radius: 46, dmg: 60 },
  zinger: { name: 'Long Skewer', radius: 18, dmg: 70, grav: 0.4 },
  scatterjack: { name: 'Pepper Rain', radius: 20, dmg: 24, split: 5 },
  delver: { name: 'Anvil Bun', radius: 22, dmg: 80, grav: 1.2 },
  boinker: { name: 'Rising Fizz', radius: 26, dmg: 40 },
  patcher: { name: 'Big Patch', radius: 30, dmg: 40 },
  sizzler: { name: 'Hot Pot', radius: 30, dmg: 44 },
  peeper: { name: 'Glint', radius: 14, dmg: 40 },
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
  makeFort('Box 1', 5, 5, () => 'wicker', 5),
  makeFort('Box 2', 5, 5, (_c, r) => (r < 2 ? 'cobble' : 'timber'), 5),
  makeFort('Box 3', 6, 5, (c) => (c % 2 ? 'timber' : 'wicker'), 5),
];

export const DEFAULT_BLUEPRINT: Blueprint = makeFort('Oak Lump', 5, 5, (_c, r) => (r === 0 ? 'timber' : 'wicker'), 5);

export function levelFort(id: string): Blueprint {
  const n = Number(id.split('-')[1] ?? 1);
  const lvl = LEVELS.find((l) => l.id === id);
  const crew = lvl?.rivalCrew.length ?? 1;
  if (n <= 3) return makeFort('Hedge Box', 4, 4, (_c, r) => (n === 3 && r < 2 ? 'timber' : 'wicker'), Math.max(crew, 1));
  if (n <= 6) return makeFort('Hedge Box', 5, 4 + (n === 6 ? 3 : 0), () => 'timber', crew);
  if (n <= 9) return makeFort('Hedge Box', 5, 5, (_c, r) => (r >= 4 && n === 9 ? 'cobble' : 'timber'), crew);
  return makeFort('Topiary Keep', 7, 7, (c, r) => (r < 2 || c === 0 ? 'cobble' : 'timber'), crew);
}
