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
  doodads?: string[]; // up to 2 Doodad ids
  previewPct?: number; // Couch Duel handicap: 30, 45, 60, 100
  crewSize?: number; // Couch Duel handicap: seat only the first n Hobs
}

export interface BattleSetup {
  mode: Mode;
  level?: string; // '1-1' ... '1-10' in campaign
  map?: string;
  seed: number;
  /** Which try at this fight (0 first, 1 the first Retry...): the core mixes it into the seed (rules v3). */
  attempt?: number;
  difficulty: Difficulty;
  windOff: boolean;
  roundCap?: number;
  wind?: 'off' | 'light' | 'full';
  shells?: 'draft' | 'quick' | 'plain';
  sides: [SideSetup, SideSetup];
  first?: Side; // who fires first (default 0)
  seats?: 'side' | 'one'; // Couch Duel: hand-off card between turns, or none
  /** What the save holds for this level (the core works out result.buttons from it). */
  progress?: { cleared: boolean; pennants: boolean[] };
  volley?: number; // Volley Points: Actions per side (6, 10, 14); Skirmish and Couch Duel only
}

export type Command =
  | { cmd: 'aim'; angle: number; power: number }
  | { cmd: 'fire'; dial?: 'puff_up' | 'rebuild' | 'hops3'; target?: [number, number] }
  | { cmd: 'walk'; dir: -1 | 0 | 1 }
  | { cmd: 'pick_hob'; id: string }
  | { cmd: 'pick_shot'; id: string }
  | { cmd: 'pick_shell'; id: string }
  | { cmd: 'quick_pick' }
  | { cmd: 'end_draft' }
  | { cmd: 'recall'; pin: string }
  | { cmd: 'fast'; on: boolean }
  | { cmd: 'set_wind'; wind: number } // Test Yard only (see CoreApi.features)
  | { cmd: 'give_up' } // see CoreApi.features
  | { cmd: 'shove_off' } // clear the picked Hob's buried Loophole
  | { cmd: 'pass' }
  | { cmd: 'doodad'; id: string; room?: string };

export interface CommandResult {
  ok: boolean;
  error?: string;
  /** Plain words for a refusal (rules v3 fire). */
  detail?: string;
  /** A refused fire: the shot that would go instead ("plain"), when there is one. */
  readyShot?: string;
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
  c: number; // castle grid column (for queries such as Lean Lines)
  r: number; // castle grid row, 0 = Footing
  root?: boolean; // the boss weak spot
  battered?: boolean; // Fatigue: hurt block with one less side reach
  held?: boolean; // held up by Hetty's Ridgepole
  peephole?: boolean;
}

export interface RoomView {
  side: Side;
  id: number; // Nook index
  x: number; y: number; w: number; h: number; // bottom-left, cells
  loophole?: { x: number; y: number; w: number; h: number };
  intact: boolean;
  flap: boolean; // Loophole Flap down until the next Weather Front
  lid: boolean; // Pot Lid
}

export interface PropView {
  id: number;
  side: 0 | 1 | 2; // 2 = level object
  kind: string; // cage_bar, captive, shell (crock), ...
  tag?: string;
  x: number; // feet centre, cells
  y: number;
  hp: number;
  maxHp: number;
}

export interface KettleView {
  room?: { x: number; y: number; w: number; h: number }; // the 2 x 2 Kettle Room
  side: Side;
  x: number;
  y: number;
  size: number; // 32
  hp: number;
  maxHp: number;
  lid?: boolean; // Pot Lid on the Kettle Room
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
  /** squashed: crushed by a fall (a Fatigue collapse), still in the fight and back up later (not Bonked). */
  state: 'ready' | 'rest' | 'bonked' | 'tumbled' | 'dug' | 'squashed';
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
  /** Trail look by damage type (view only). */
  trail?: 'blast' | 'pierce' | 'dig' | 'fire' | 'mend';
}

export interface PinView {
  id: string;
  /** Protocol recall key (`side:ghostIndex`), kept separate from unique `id` so animations never collide. */
  slot?: string;
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
  /** Optional fire dial choices from content / Hob passive (e.g. rebuild/puff_up, hops3). */
  dials?: ('puff_up' | 'rebuild' | 'hops3')[];
  /** True when the shot acts directly on your own fort with no flight arc (e.g. Barn Raising). */
  selfTarget?: boolean;
  /** True when the shot can target a chosen block of your own fort via `fire.target` (e.g. Mendglob). */
  canTargetOwn?: boolean;
  /** Plain-English card description from content/shots.json. */
  line?: string;
  /** Base damage or mend amount from content/shots.json, for the Shell Card. */
  dmg?: number;
  /** Blast radius band from content/shots.json (tiny/small/medium/large/huge/point), for the Shell Card. */
  band?: string;
}

/** One block of a falling chunk, as it stood before the fall (view coords, bottom-left). */
export interface FallingBlockView { x: number; y: number; c: number; r: number; mat: string; hp: number; maxHp: number; fall: number }

export type BattleEvent =
  | { t: 'turn'; side: Side; round: number }
  | { t: 'fire'; side: Side; x: number; y: number; kind: string; hob?: string; weight?: number; shotName?: string }
  | { t: 'hit'; x: number; y: number; dmg: number; what: 'block' | 'hob' | 'kettle' | 'ground'; hob?: string; side?: Side; mat?: Material; dtype?: string }
  | { t: 'break'; x: number; y: number; mat: Material; side?: Side }
  | { t: 'fall'; count: number; x: number; y: number }
  | { t: 'collapse'; side: Side; lean: -1 | 1; blocks: FallingBlockView[] }
  | { t: 'bonk'; hob: string; x: number; y: number }
  | { t: 'kettle_pop'; side: Side }
  | { t: 'boom'; x: number; y: number; r: number; dtype?: string }
  | { t: 'squall'; n: number }
  | { t: 'squall_warn'; left: number }
  /** A short word or line for a core event; `id` is that event's id (front, pass, boss_phase...). */
  | { t: 'note'; text: string; x?: number; y?: number; sound?: string; status?: boolean; id?: string }
  | { t: 'threaded'; x: number; y: number }
  | { t: 'thump'; side: Side }
  /** A Hob animation cue from a core event: tumble, land, dig (Shove Off), nextdoor (a Passive acts). */
  | { t: 'hob'; hob: string; act: 'tumble' | 'land' | 'dig' | 'nextdoor' | 'cheer' }
  /** Fatigue: 'warn' a round ahead, 'start' when its collapse runs (QA playtest 2, N1). */
  | { t: 'fatigue'; phase: 'warn' | 'start'; text: string }
  | { t: 'end'; winner: Side | -1; how: string; key?: string };

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
  howKey?: string; // the core's `how` id (clean_sweep, kettle_pop, squall, double_pop, rescue, round_cap, total_hp)
  round?: number;
  how: string; // the core's `how` id, as howKey
  pennants: boolean[]; // campaign: 3
  goals: string[];
  buttons: number;
  stats: [SideStats, SideStats];
  bestShot?: { side: Side; hob: string; round: number; dmg: number; angle: number; power: number };
  /** "What broke you" on a loss, as ids and names (the results screen words it from content/text.json). */
  broke?: {
    how: string;
    last?: ResultBlow;
    top: ResultBlow[];
    blocksLost: number;
    hobsBonked: number;
    bonkedNames: string[];
  };
  /** The Rival side's name as the core has it (hud.names[1]). */
  rival?: string;
  pennantsNew?: boolean[];
  score?: [number, number];
}
/** One blow: `by` is the core id (hob, squall, ground, fatigue, self, shears, prop); hob is a short name. */
export interface ResultBlow { by: string; hob: string; shot: string; round?: number; dmg?: number }
export interface SideStats {
  shots: number;
  hits: number;
  blocks: number;
  kettle: number; // percent left
  bonks?: number;
  streak?: number; // best run of hits
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
  fire: 'locked' | 'ready' | 'dug' | 'pass' | 'flight' | 'use' | 'fast';
  /** Why Fire is locked on a Plan step: the picked shot's reason from the core (hud.shots why). */
  fireWhy?: string;
  canWalk: boolean;
  thinking?: boolean; // Rival think pose
  doodads: { id: string; name: string; card: string }[]; // the active side's Doodads left
  canPass: boolean;
  /** Volley Points: Actions per side and left per side. */
  volley?: { actions: number; left: [number, number] };
  /** Volley Points / live Siege Scores per side. */
  score?: [number, number];
  /** Whether each side may still use Barn Raising's Puff Up dial. */
  puffUp?: [boolean, boolean];
  /** Steam cost to Shove Off a buried Loophole. */
  shoveOffCost?: number;
  /** Rounds left before the next Weather Front shifts the wind. */
  frontRoundsLeft?: number;
  /** Handicaps per side, shown openly (Couch Duel house rule 6). */
  handicap?: [{ help: string; steam: number; previewPct: number; crew: number }, { help: string; steam: number; previewPct: number; crew: number }];
  /** Grand Fort phases (1-10): phase, and the red cut line one boss turn before the snip. */
  boss?: { phase: number; cut?: { x: number; y: number; w: number; h: number }; jam: number };
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
  rooms: RoomView[];
  props: PropView[];
  fatigue: [boolean, boolean];
  /** Rounds until Fatigue starts (core v0.3 hud.fatigue_in), when the core sends it. */
  fatigueIn?: number;
  forts: [{ x: number; y: number; w: number; h: number }, { x: number; y: number; w: number; h: number }];
  events: BattleEvent[]; // since the last snapshot
  hud: HudView;
  draft?: DraftView;
  result?: ResultView;
}

export interface LevelInfo {
  id: string;
  name: string;
  /** The level type id; `type` is its display word. */
  kind: 'siege' | 'rescue' | 'grand_fort';
  type: string;
  rival: string;
  /** The Rival crew's content Hob ids (no Dummies). */
  rivalUnits?: string[];
  habit: string;
  rivalCrew: HobClass[];
  aim: number;
  roundCap: number;
  squall: boolean;
  wind: string;
  goals: [string, string, string];
  crewSize: number;
  draft: boolean;
  draftPool: number;
  draftPicks: number;
  doodads: string[]; // Doodads the player brings to this level
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

export interface CoreFeatures {
  setWind: boolean; // Test Yard wind slider
  giveUp: boolean; // Couch Duel Give up
}

export interface CoreApi {
  readonly name: string;
  readonly version: string;
  /** Rules version (cp_version().rules); saves from another rules version are not replayed. */
  readonly rules: number;
  readonly features: CoreFeatures;
  levels(): LevelInfo[];
  hobs(): HobInfo[];
  starterForts(): Blueprint[];
  /** The fort the Workshop starts from. */
  defaultBlueprint(): Blueprint;
  checkBlueprint(bp: Blueprint): BlueprintCheck;
  /** Can this fort seat `seats` Hobs? The core validator decides. */
  checkFort(bp: Blueprint, seats: number): { ok: boolean; why?: string };
  /** A content Blueprint the core accepts for `seats` Hobs. */
  fortFor(seats: number): Blueprint | undefined;
  /** Lean Lines query: blocks that would fall if (c, r) of that side broke. Changes nothing. */
  leanLines(side: Side, c: number, r: number): [number, number][];
  /** Send the whole map again in the next snapshot (a screen takes over a battle another screen built). */
  resendTerrain?(): void;
  /** Display name of a Doodad id. */
  doodadName?(id: string): string;
  /** Skirmish and duel maps: [level id, name]. */
  maps?(): [string, string][];
  /** The Skirmish Rival the core will pick for this map and seed (its `rival.roster`). */
  skirmishRival?(map: string, seed: number): { name: string; habit: string } | undefined;
  newBattle(setup: BattleSetup): void;
  command(c: Command): CommandResult;
  /** Advance the sim by whole ticks at 120 Hz. */
  step(ticks: number): void;
  snapshot(): Snapshot;
  /** Opaque save of the live battle (commands plus seed); the layout is never in it. */
  saveBattle(): string;
  /**
   * Replays a save. Throws a SaveError when it is from another version, damaged, or the core
   * refuses its log. A log that replays but lands on another state hash still loads: the
   * returned text is a note for the player.
   */
  loadBattle(data: string): string | void;
  /** Bumps each time a battle is built; a screen can take over the live battle when it still matches. */
  readonly battleGen?: number;
}

export const TICK_HZ = 120;

/** A battle save that cannot be resumed (old version, corrupt, or it replays to a different state). */
export class SaveError extends Error {
  constructor(message: string, readonly why: 'version' | 'corrupt' | 'mismatch') { super(message); this.name = 'SaveError'; }
}
