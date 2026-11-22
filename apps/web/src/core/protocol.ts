// The castle-wasm protocol, exactly as core/API.md (v0.1) defines it.
// World cells, x right, y DOWN (y = 0 is the top of the sky). Angle in tenths, power 0..100.
// The rest of the app reads a view model (types.ts); core/real.ts converts between the two.

export type PSide = 0 | 1;

export interface PSideCfg {
  control?: 'human' | 'ai';
  preset?: 'cozy' | 'fair' | 'stubborn';
  crew?: string[];
  blueprint?: string;
  rows?: string[];
  doodads?: string[];
  kit?: string;
  name?: string;
  steam?: number;
  aim?: number;
  /** v0.2 handicaps: Help (Steam from content/app.json, read by the core), preview share, crew size. */
  help?: 'none' | 'some' | 'lots';
  preview_pct?: number;
  crew_size?: number;
}

export interface PWind { min: number; max: number; fronts?: number[]; front_rounds?: number }
export interface PRummage { pool: number; picks: number; source?: string[] }

export interface PSetup {
  level: string;
  mode?: 'campaign' | 'skirmish' | 'couch' | 'test_yard' | 'daily';
  sides?: PSideCfg[];
  first_turn?: 0 | 1 | 'coin';
  round_cap?: number;
  squall?: boolean;
  wind?: PWind;
  rummage?: PRummage;
  puff_up?: boolean;
  /** Volley Points: Actions per side (skirmish, daily, couch). */
  volley?: number;
  progress?: { cleared: boolean; pennants: boolean[]; daily_paid: boolean };
}

export type PCommand =
  | { cmd: 'pick_shell'; shell: string; side?: PSide }
  | { cmd: 'quick_pick'; side?: PSide }
  | { cmd: 'end_draft' }
  | { cmd: 'pick_hob'; hob: number }
  | { cmd: 'pick_shot'; shot: string }
  | { cmd: 'aim'; angle?: number; power?: number }
  | { cmd: 'recall'; ghost: number }
  | { cmd: 'walk'; dx: number }
  | { cmd: 'shove_off'; hob: number }
  | { cmd: 'fire'; dial?: 'puff_up' | 'rebuild' | 'hops3'; target?: [number, number] }
  | { cmd: 'doodad'; doodad: string; targets?: [number, number][]; room?: string }
  | { cmd: 'pass' }
  | { cmd: 'ai_turn'; preset?: string }
  | { cmd: 'lean_lines'; side: PSide; c: number; r: number }
  | { cmd: 'shimmer'; side: PSide }
  | { cmd: 'validate_blueprint'; rows: string[]; seats: number }
  | { cmd: 'hash' }
  | { cmd: 'log' }
  | { cmd: 'terrain_all' }
  | { cmd: 'give_up'; side?: PSide }
  | { cmd: 'set_wind'; wind: number }
  | { cmd: 'resume'; log: PCommand[] };

export type PReason =
  | 'bad_json' | 'unknown_command' | 'not_drafting' | 'not_your_pick' | 'not_in_pool' | 'not_planning'
  | 'already_acted' | 'bad_hob' | 'bad_shot' | 'hob_cannot_fire' | 'resting_plain_only' | 'no_shot'
  | 'unknown_shot' | 'no_knack_uses' | 'not_in_hand' | 'no_heavy_first_turn' | 'bad_dial'
  | 'puff_up_not_allowed' | 'cannot_walk_now' | 'cannot_walk_there' | 'cannot_shove_now' | 'not_buried'
  | 'not_enough_steam' | 'no_hob' | 'cannot_use_now' | 'no_doodad' | 'unknown_doodad' | 'bad_room'
  | 'no_ghost' | 'pin_faded' | 'invalid_blueprint'
  | 'bad_value' | 'nothing_to_mend' | 'no_one_to_puff_up' | 'bad_target' | 'no_actions_left' | 'battle_over'
  | 'test_yard_only' | 'cannot_resume' | 'bad_log' | 'buried' | 'resting';

export interface PReply {
  ok: boolean;
  reason?: PReason | string;
  detail?: string;
  [k: string]: unknown;
}

export type PPhase = 'draft' | 'plan' | 'resolve' | 'settle' | 'ended';
export type Box = [number, number, number, number];

export interface PBlock { c: number; r: number; x: number; y: number; mat: string; hp: number; max: number; peephole: boolean; root: boolean; battered: boolean }
export interface PRoom { kind: 'nook'; id: number; c: number; r: number; box: Box; intact: boolean; flap: boolean; lid: boolean; loophole: Box }
export interface PCastle {
  side: PSide; x: number; base_y: number; cols: number; rows: number; block: number;
  blocks: PBlock[]; rooms: PRoom[];
  kettle: { hp: number; max: number; box: Box; room: Box; c: number; r: number; lid: boolean; intact: boolean };
  steam: number; steam_turn: number; fatigue: boolean;
  shimmer: [number, number][]; held: [number, number][];
}
export interface PHob {
  id: number; side: PSide; def: string; name: string; class: string;
  hp: number; max: number; state: 'seated' | 'open' | 'dropped' | 'tumbled' | 'squashed' | 'bonked';
  nook: number | null; x: number; y: number; rest: number; knack: string | null; knack_uses: number; plain: string;
  buried: boolean; cover: boolean; dummy: boolean; grudge: boolean; clatter: boolean; can_fire: boolean;
  aim: { angle: number; power: number };
}
/** [id, x, y, rot, shot] */
export type PShell = [number, number, number, number, string];
export interface PProp { id: number; side: 0 | 1 | 2; kind: string; tag?: string; x: number; y: number; hp: number; max: number; shot?: string | null }
export interface PGhost {
  index: number; side: PSide; hob: number; shot: string; angle: number; power: number; round: number;
  pin: [number, number] | null; self_hit: boolean; recalled: boolean; points: [number, number][];
}
export interface PHandShell { id: string; name: string | null; match: string | null; weight: string | number | null; dud: boolean | null; card: unknown }
export interface PHud {
  turn: number; round: number; round_cap: number; side: PSide;
  wind: number; forecast: number; front_rounds_left: number;
  steam: [number, number]; steam_turn_left: number; kettle_pct: [number, number];
  crew: [{ id: number; hp_pct: number; state: string; class: string; rest: number }[], { id: number; hp_pct: number; state: string; class: string; rest: number }[]];
  squall_warning: number | null; squall_round: number; squall: boolean;
  hands: [PHandShell[], PHandShell[]]; doodads: [string[], string[]];
  selected: { hob: number; shot: string };
  names: [string, string]; control: ['human' | 'ai', 'human' | 'ai'];
  score: [number, number]; puff_up: [boolean, boolean];
  // v0.2
  steam_max?: [number, number];
  shove_off_cost?: number;
  shots?: { shot: string; id: string; ready: boolean; why: string | null }[];
  handicap?: [PHandicap, PHandicap];
  volley?: { actions: number; left: [number, number] } | null;
  boss?: PBoss | null;
  rules?: { objective: { tag: string; count: number } | null; cap_win: 0 | 1 | null };
}
export interface PHandicap { help: string; steam: number; preview_pct: number; crew: number }
export interface PBoss { phase: number; roller: PProp | null; roller_done: boolean; shears: PProp | null; cut: [number, number, number, number] | null; jam: number }
export interface PDraft { pool: string[]; picks: [string[], string[]]; next: PSide; picks_each: number; wish: string | null }
export interface PResultStats { shots: number; hits: number; blocks_dropped: number; bonks: number; blocks_lost: number; kettle_lost: number; hobs_lost: number; best_streak: number }
export interface PBlow { shot: string; shot_name: string; hob: number; hob_name: string; round?: number; dmg?: number }
export interface PResult {
  winner: PSide; how: string; round: number; pennants: boolean[];
  // v0.2
  pennants_new?: boolean[]; buttons?: number; score?: [number, number]; stats?: [PResultStats, PResultStats];
  broke?: { side: PSide; how: string; last: PBlow | null; top: PBlow[]; kettle_lost: number; blocks_lost: number; hobs_bonked: number } | null;
}

export type PEvent = { t: string; tick?: number; [k: string]: unknown };

export interface PChunk { cx: number; cy: number; x: number; y: number; w: number; h: number; data: string }

/** A full snapshot. A lean one (`full: false`) has only tick, phase, side, awaiting, full, terrain, shells, events. */
export interface PSnapshot {
  tick: number; phase: PPhase; side: PSide; awaiting: 'human' | 'ai' | 'none'; full: boolean;
  level: string; mode: string;
  map: { w: number; h: number; chunk: number };
  terrain: { chunks: PChunk[] };
  castles: [PCastle, PCastle]; hobs: PHob[]; shells: PShell[]; props: PProp[];
  preview: [number, number][]; ghosts: PGhost[];
  hud: PHud; draft: PDraft | null; events: PEvent[];
  result: PResult | null; hash: string; last_ai?: unknown[];
  /** Lean snapshot after an `aim` (v0.2): the new aim and preview. */
  aim?: { side: PSide; hob: number; angle: number; power: number };
}

/** What castle-wasm (wasm-bindgen, target web) exports. */
export interface WasmGame {
  command(json: string): string;
  step(ticks: number): string;
  snapshot(): string;
  free(): void;
}
/** cp_version(): {"sim":"0.2.0","rules":2,"tick_hz":120} */
export interface PVersion { sim: string; rules: number; tick_hz: number }

export interface WasmModule {
  default: (input?: unknown) => Promise<unknown>;
  Game: new (content_json: string, level_json: string, seed: bigint) => WasmGame;
  cp_version(): string;
  default_content(): string;
  golden_hashes?(): string;
}
