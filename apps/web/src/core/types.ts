// The web app's view of the rules core. All game rules live in core/ (Rust).
// The app only sends commands and reads snapshots. Nothing here decides an outcome.
// Units: world cells (map 2400 x 720 standard), y grows upward from the map floor.
// Angle in tenths of a degree, 0 = right, 900 = straight up, 1800 = left. Power 0 to 100.

export type Side = 0 | 1;
export type Material = 'wicker' | 'timber' | 'cobble' | 'footing' | 'brassbound';
export type HobClass = 'lobber' | 'zinger' | 'scatterjack' | 'delver' | 'boinker' | 'patcher' | 'sizzler' | 'peeper';
export type Difficulty = 'cozy' | 'fair' | 'stubborn';
export type Mode = 'campaign' | 'skirmish' | 'duel' | 'yard';
export type Help = 'none' | 'some' | 'lots';

export interface BlueprintCell {
  col: number; // 0 at the fort's back edge
  row: number; // 0 just above the Footing
  kind: Material | 'nook' | 'kettle';
  room?: number; // Nook number (rooms are 2 x 2 cells)
}
export interface Blueprint {
  id?: string; // content blueprint id
  kit?: string; // Starter Box kit id (Couch Duel)
  rowsText?: string[]; // core glyph rows, top first, Footing last
  name: string;
  cols: number;
  rows: number;
  cells: BlueprintCell[];
}

export interface SideSetup {
  name: string;
  human: boolean;
  crew: string[]; // Hob ids
  blueprint?: Blueprint; // omitted: level or starter fort
  help?: Help;
}

export interface BattleSetup {
  mode: Mode;
  level?: string; // '1-1' ... '1-10' in campaign
  map?: string;
  seed: number;
  difficulty: Difficulty;
  windOff: boolean;
  roundCap?: number;
  wind?: 'off' | 'light' | 'full';
  shells?: 'draft' | 'quick' | 'plain';
  sides: [SideSetup, SideSetup];
  first?: Side; // who fires first (default 0)
  seats?: 'side' | 'one'; // Couch Duel: hand-off card between turns, or none
}

export type Command =
  | { cmd: 'aim'; angle: number; power: number }
  | { cmd: 'fire' }
  | { cmd: 'walk'; dir: -1 | 0 | 1 }
  | { cmd: 'pick_hob'; id: string }
  | { cmd: 'pick_shot'; id: string }
  | { cmd: 'pick_shell'; id: string }
  | { cmd: 'quick_pick' }
  | { cmd: 'end_draft' }
  | { cmd: 'recall'; pin: string }
  | { cmd: 'fast'; on: boolean }
  | { cmd: 'set_wind'; wind: number } // Test Yard only
  | { cmd: 'give_up' };

export interface CommandResult {
  ok: boolean;
  error?: string;
}

export interface TerrainChunk {
  cx: number;
  cy: number;
  rev: number;
  // Area in y-up cells (bottom-left origin). Absent: the square chunk at cx, cy.
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // Either material codes, row-major from the bottom row (0 air, 1 Loam, 2 Clay,
  // 3 Rock, 4 Bedrock, 5 Mud, 6 Water), or run-length rows of empty and Loam starting with empty.
  cells?: Uint8Array;
  rle?: number[];
}
export interface TerrainView {
  width: number;
  height: number;
  chunk: number; // chunk size in cells (square)
  chunks: TerrainChunk[]; // only chunks whose rev changed since the last snapshot, all on the first
}

export interface BlockView {
  id: number;
  side: Side;
  x: number; // bottom-left, cells
  y: number;
  size: number; // 16
  mat: Material;
  hp: number;
  maxHp: number;
  falling?: boolean;
  shimmer?: boolean; // weakly held (view hint from the core)
}

export interface KettleView {
  room?: { x: number; y: number; w: number; h: number }; // the 2 x 2 Kettle Room
  side: Side;
  x: number;
  y: number;
  size: number; // 32
  hp: number;
  maxHp: number;
}

export interface HobView {
  id: string;
  def?: string; // content id (sprite name), e.g. marge, hedge_snipper
  side: Side;
  name: string;
  cls: HobClass;
  x: number; // feet centre
  y: number;
  hp: number;
  maxHp: number;
  state: 'ready' | 'rest' | 'bonked' | 'tumbled' | 'dug';
  rest: number;
}

export interface ShellView {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: string; // sprite id of the shell in flight (shell_<kind>)
  side: Side;
}

export interface PinView {
  id: string;
  side: Side;
  hob: string;
  x: number;
  y: number;
  round: number;
  spent: boolean;
  angle: number;
  power: number;
  path: [number, number][]; // ghost line, world points
  windAt: number;
}

export interface ShotChip {
  id: string;
  name: string;
  kind: 'plain' | 'knack' | 'shell' | 'doodad';
  icon?: string; // sprite id: icon_<icon>, shell_<icon>
  uses: number; // -1 = endless
  weight: 0 | 1 | 2;
  best?: HobClass;
  ready: boolean;
  why?: string; // short reason when not ready
}

export type BattleEvent =
  | { t: 'turn'; side: Side; round: number }
  | { t: 'fire'; side: Side; x: number; y: number; kind: string }
  | { t: 'hit'; x: number; y: number; dmg: number; what: 'block' | 'hob' | 'kettle' | 'ground' }
  | { t: 'break'; x: number; y: number; mat: Material }
  | { t: 'fall'; count: number; x: number; y: number }
  | { t: 'bonk'; hob: string; x: number; y: number }
  | { t: 'kettle_pop'; side: Side }
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'squall'; n: number }
  | { t: 'squall_warn'; left: number }
  | { t: 'end'; winner: Side | -1; how: string };

export interface DraftChip {
  id: string;
  name: string;
  weight: 0 | 1 | 2;
  best?: HobClass;
  hint: string;
  dud?: boolean;
  owner?: Side;
}
export interface DraftView {
  pool: DraftChip[];
  picks: [string[], string[]];
  perSide: number;
  turn: Side;
  wish?: string; // the shell the Rival wants next
  done: boolean;
}

export interface ResultView {
  winner: Side | -1;
  how: 'Clean Sweep' | 'Kettle Pop' | 'Sudden Squall' | 'Doze Off' | 'Give Up' | string;
  pennants: boolean[]; // campaign: 3
  goals: string[];
  buttons: number;
  stats: [SideStats, SideStats];
  bestShot?: { side: Side; hob: string; round: number; dmg: number; angle: number; power: number };
  cause?: string; // 'what broke you' line on a loss
}
export interface SideStats {
  shots: number;
  hits: number;
  blocks: number;
  kettle: number; // percent left
}

export interface HudView {
  active: Side; // whose turn
  you: Side; // the side whose HUD shows (the active human side)
  steam: number;
  steamMax: number;
  steamTurn: number; // left to walk this turn
  hob?: string; // picked Hob
  shot?: string; // picked shot
  aim?: { angle: number; power: number };
  shots: ShotChip[];
  preview: [number, number][]; // arc points, already cut to the preview share
  previewEndsFlap?: boolean;
  fire: 'locked' | 'ready' | 'dug' | 'flight' | 'use' | 'fast';
  canWalk: boolean;
  thinking?: boolean; // Rival think pose
}

export interface Snapshot {
  tick: number;
  phase: 'draft' | 'plan' | 'flight' | 'resolve' | 'rival' | 'over';
  mode: Mode;
  round: number;
  roundCap: number;
  squall: { warn: number; on: number }; // warn: rounds left before the Squall, 0 none. on: Squall round, 0 none
  wind: number;
  forecast: number;
  sides: [{ name: string; human: boolean; help: Help }, { name: string; human: boolean; help: Help }];
  terrain: TerrainView;
  blocks: BlockView[];
  kettles: KettleView[];
  hobs: HobView[];
  shells: ShellView[];
  pins: PinView[];
  forts: [{ x: number; y: number; w: number; h: number }, { x: number; y: number; w: number; h: number }];
  events: BattleEvent[]; // since the last snapshot
  hud: HudView;
  draft?: DraftView;
  result?: ResultView;
}

export interface LevelInfo {
  id: string;
  name: string;
  type: 'Siege' | 'Rescue' | 'Grand Fort';
  rival: string;
  habit: string;
  rivalCrew: HobClass[];
  aim: number;
  roundCap: number;
  wind: string;
  goals: [string, string, string];
  crewSize: number;
  draft: boolean;
}

export interface HobInfo {
  id: string;
  name: string;
  cls: HobClass;
  hp: number;
  joins?: string;
}

export interface BlueprintCheck {
  ok: boolean;
  blocks: number;
  budget: number;
  cost: number;
  problems: { col: number; row: number; why: string }[];
}

export interface CoreApi {
  readonly name: string;
  readonly version: string;
  levels(): LevelInfo[];
  hobs(): HobInfo[];
  starterForts(): Blueprint[];
  /** The fort the Workshop starts from. */
  defaultBlueprint(): Blueprint;
  checkBlueprint(bp: Blueprint): BlueprintCheck;
  newBattle(setup: BattleSetup): void;
  command(c: Command): CommandResult;
  /** Advance the sim by whole ticks at 120 Hz. */
  step(ticks: number): void;
  snapshot(): Snapshot;
  /** Opaque save of the live battle (commands plus seed); the layout is never in it. */
  saveBattle(): string;
  loadBattle(data: string): void;
}

export const TICK_HZ = 120;
