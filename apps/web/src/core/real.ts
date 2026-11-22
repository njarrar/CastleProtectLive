// RealCore: drives castle-wasm through the protocol (protocol.ts, core/API.md) and turns
// its snapshots into the view model the renderer and HUD read. No rule is computed here:
// positions are flipped to y-up, events get screen anchors, and that is all. Numbers the
// core does not send yet come from content/app.json (rules.ts).
import { blueprintToRows, rowsToBlueprint } from './bp';
import { RULES, levelAtLeast } from './rules';
import type {
  PCastle, PCommand, PEvent, PHob, PReply, PSetup, PSideCfg, PSnapshot, PVersion, WasmGame, WasmModule,
} from './protocol';
import type {
  BattleEvent, BattleSetup, Blueprint, BlueprintCheck, BlockView, Command, CommandResult, CoreApi,
  DraftView, HobClass, HobInfo, HobView, KettleView, LevelInfo, Material, PinView, PropView, ResultView, RoomView,
  ShellView, ShotChip, Side, SideStats, Snapshot,
} from './types';
import { SaveError, TICK_HZ } from './types';

interface Bundle {
  materials: { blocks: { id: string; glyph: string; cost: number }[] };
  hobs: { id: string; name: string; class: string; hp: number; player?: boolean; knack?: string }[];
  shots: { id: string; name: string; weight?: string | number; match_class?: string; dud?: boolean; card?: { line?: string } | string }[];
  doodads?: { id: string; name: string; card?: string }[];
  blueprints: { id: string; name: string; rows: string[] }[];
  levels: RawLevel[];
  starter_box: { map: string; kits: { id: string; name: string; blueprint: string; crew: string[] }[] };
}
interface RawLevel {
  id: string; name: string; type: string; width: number; height: number;
  player: { crew: string[]; crew_size: number; blueprint: string };
  rival: { name: string; habit?: string; crew: string[]; aim?: number };
  rules: { round_cap: number; squall?: boolean; wind?: { min: number; max: number }; rummage?: { pool: number; picks: number } };
  pennants: { type: string; text: string }[];
}

const SAVE_VERSION = 2;
const THINK_TICKS = Math.round(TICK_HZ * RULES.rival_think_seconds); // the Rival's think pose before ai_turn
// Content writes Shot Weight as L / M / H; accept the long names too.
const WEIGHT: Record<string, 0 | 1 | 2> = { l: 0, m: 1, h: 2, light: 0, medium: 1, heavy: 2 };
const HOW: Record<string, string> = {
  clean_sweep: 'Clean Sweep', kettle_pop: 'Kettle Pop', squall: 'Squall Pop', double_pop: 'Double Pop',
  rescue: 'Rescue', round_cap: 'Doze Off', total_hp: 'On points',
};
const newStats = (): [SideStats, SideStats] => [{ shots: 0, hits: 0, blocks: 0, kettle: 100 }, { shots: 0, hits: 0, blocks: 0, kettle: 100 }];

interface ViewCache {
  rev: number;
  blocks: BlockView[]; kettles: KettleView[]; hobs: HobView[]; pins: PinView[]; rooms: RoomView[]; props: PropView[];
  chips: ShotChip[]; preview: [number, number][]; forts: Snapshot['forts']; draft?: DraftView;
}

export class RealCore implements CoreApi {
  readonly name = 'wasm';
  readonly version: string;
  readonly rules: number;
  readonly features = { setWind: false, giveUp: false };
  private bundle: Bundle;
  private game?: WasmGame;
  private scratch?: WasmGame;
  private setupJson = '';
  private seed = 1n;
  private viewSetup?: BattleSetup;
  private last?: PSnapshot; // last full snapshot merged with lean ones
  private lastCastles?: [PCastle, PCastle]; // the full snapshot before `last`
  private rev = 0; // bumps on every full snapshot
  private cache?: ViewCache;
  private steamMax: [number, number] = [0, 0];
  private events: BattleEvent[] = [];
  private chunks: Snapshot['terrain']['chunks'] = [];
  private think = 0;
  private walkDir: -1 | 0 | 1 = 0;
  private walkTicks = 0;
  private stats = newStats();
  private shotDmg = 0;
  private shotBy?: { side: Side; hob: string; round: number; angle: number; power: number };
  private best?: ResultView['bestShot'];
  private levelsCache?: LevelInfo[];

  constructor(private mod: WasmModule) {
    let v: Partial<PVersion> = {};
    try { v = JSON.parse(mod.cp_version()) as PVersion; } catch { /* keep defaults */ }
    this.version = v.sim ?? 'wasm';
    this.rules = typeof v.rules === 'number' ? v.rules : 0;
    this.bundle = JSON.parse(mod.default_content()) as Bundle;
  }

  // ---------- content views ----------
  levels(): LevelInfo[] {
    if (this.levelsCache) return this.levelsCache;
    const cls = (id: string) => this.bundle.hobs.find((x) => x.id === id)?.class ?? 'lobber';
    this.levelsCache = this.bundle.levels.filter((l) => /^\d+-\d+$/.test(l.id)).map((l) => {
      const w = l.rules.wind ?? { min: 0, max: 0 };
      const rum = l.rules.rummage ?? { pool: 0, picks: 0 };
      return {
        id: l.id, name: l.name,
        type: l.type === 'rescue' ? 'Rescue' : l.type === 'grand_fort' || l.type === 'boss' ? 'Grand Fort' : 'Siege',
        rival: l.rival.name, habit: l.rival.habit ?? '',
        rivalCrew: l.rival.crew.map(cls).filter((c) => c !== 'dummy') as HobClass[],
        aim: l.rival.aim ?? 1, roundCap: l.rules.round_cap,
        wind: w.max === 0 ? 'No wind' : w.min === w.max ? `Wind ${w.max}` : `Wind ${w.min} to ${w.max}`,
        goals: [0, 1, 2].map((i) => l.pennants[i]?.text ?? '') as [string, string, string],
        crewSize: l.player.crew_size, draft: rum.pool > 0, draftPool: rum.pool, draftPicks: rum.picks,
        doodads: levelAtLeast(l.id, RULES.campaign.doodads_from) ? [...RULES.campaign.doodads] : [],
      };
    });
    return this.levelsCache;
  }

  /** Skirmish and duel maps: the core's non-campaign levels. */
  maps(): [string, string][] {
    return this.bundle.levels.filter((l) => /^d\d+$/.test(l.id)).map((l) => [l.id, l.name]);
  }

  resendTerrain(): void {
    if (!this.game) return;
    this.game.command(JSON.stringify({ cmd: 'terrain_all' } satisfies PCommand)); // a query: not logged
    this.pull();
  }

  doodadName(id: string): string { return this.bundle.doodads?.find((d) => d.id === id)?.name ?? id; }

  hobs(): HobInfo[] {
    return this.bundle.hobs.filter((h) => h.player).map((h) => ({ id: h.id, name: h.name.split(' ')[0] === 'Old' ? 'Old Thumper' : h.name.split(' ')[0], cls: h.class as HobClass, hp: h.hp, joins: RULES.joins[h.id] }));
  }

  starterForts(): Blueprint[] {
    return this.bundle.starter_box.kits.map((k) => {
      const bp = this.bundle.blueprints.find((b) => b.id === k.blueprint);
      return { ...rowsToBlueprint(bp?.rows ?? [], k.name, this.glyphs()), kit: k.id, id: k.blueprint };
    });
  }

  defaultBlueprint(): Blueprint {
    const b = this.bundle.blueprints.find((x) => x.id === 'bp_home_3') ?? this.bundle.blueprints[0];
    return { ...rowsToBlueprint(b.rows, 'Home fort', this.glyphs()), id: undefined };
  }

  private glyphs(): Record<string, Material> {
    const g: Record<string, Material> = {};
    for (const b of this.bundle.materials.blocks) g[b.glyph] = b.id as Material;
    return g;
  }

  private validate(rows: string[], seats: number): PReply {
    this.scratch ??= new this.mod.Game('', JSON.stringify({ level: 'd1', mode: 'test_yard' }), 1n);
    return JSON.parse(this.scratch.command(JSON.stringify({ cmd: 'validate_blueprint', rows, seats } satisfies PCommand))) as PReply;
  }

  private rowsOf(bp: Blueprint): string[] {
    if (bp.rowsText?.length) return bp.rowsText;
    if (bp.cells.length) return blueprintToRows(bp, this.glyphs());
    return this.bundle.blueprints.find((b) => b.id === bp.id)?.rows ?? [];
  }

  checkBlueprint(bp: Blueprint): BlueprintCheck {
    const rows = this.rowsOf(bp);
    const seats = bp.cells.some((c) => c.kind === 'nook') ? new Set(bp.cells.filter((c) => c.kind === 'nook').map((c) => c.room ?? 0)).size : 0;
    const rep = this.validate(rows, seats);
    const cost = new Map(this.bundle.materials.blocks.map((b) => [b.id, b.cost]));
    const blocks = bp.cells.filter((c) => c.kind !== 'nook' && c.kind !== 'kettle');
    return {
      ok: rep.ok, blocks: blocks.length, budget: RULES.workshop.budget, cost: blocks.reduce((a, c) => a + (cost.get(c.kind) ?? 0), 0),
      problems: rep.ok ? [] : [{ col: -1, row: -1, why: String(rep.detail ?? rep.reason ?? 'Not legal') }],
    };
  }

  checkFort(bp: Blueprint, seats: number): { ok: boolean; why?: string } {
    const rows = this.rowsOf(bp);
    if (!rows.length) return { ok: false, why: 'No fort' };
    const rep = this.validate(rows, seats);
    return rep.ok ? { ok: true } : { ok: false, why: String(rep.detail ?? rep.reason ?? 'Not legal') };
  }

  fortFor(seats: number): Blueprint | undefined {
    const ok = this.bundle.blueprints.filter((b) => this.validate(b.rows, seats).ok);
    const pick = ok.find((b) => b.id.startsWith('bp_home')) ?? ok[0];
    return pick ? { ...rowsToBlueprint(pick.rows, pick.name, this.glyphs()), id: pick.id, rowsText: undefined, cells: [] } : undefined;
  }

  leanLines(side: Side, c: number, r: number): [number, number][] {
    if (!this.game) return [];
    const rep = JSON.parse(this.game.command(JSON.stringify({ cmd: 'lean_lines', side, c, r } satisfies PCommand))) as PReply;
    return rep.ok && Array.isArray(rep.falls) ? (rep.falls as [number, number][]) : [];
  }

  // ---------- battle ----------
  newBattle(setup: BattleSetup): void {
    const p = toProtocolSetup(setup, this.glyphs());
    this.start(JSON.stringify(p), BigInt(setup.seed >>> 0));
    this.viewSetup = structuredClone(setup);
  }

  /** Build the new Game first; only then free the old one, so a refused setup leaves no dangling handle. */
  private start(setupJson: string, seed: bigint): void {
    let g: WasmGame;
    try {
      g = new this.mod.Game('', setupJson, seed);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : String(e));
    }
    const old = this.game;
    this.game = g;
    this.setupJson = setupJson;
    this.seed = seed;
    old?.free();
    this.last = undefined;
    this.lastCastles = undefined;
    this.cache = undefined;
    this.steamMax = [0, 0];
    this.events = [];
    this.chunks = [];
    this.think = 0;
    this.walkDir = 0;
    this.stats = newStats();
    this.best = undefined;
    this.shotBy = undefined;
    this.pull();
  }

  private send(c: PCommand): PReply {
    if (!this.game) return { ok: false, reason: 'no_game' };
    const r = JSON.parse(this.game.command(JSON.stringify(c))) as PReply;
    this.pull();
    return r;
  }

  command(c: Command): CommandResult {
    const s = this.last;
    let pc: PCommand | null = null;
    switch (c.cmd) {
      case 'aim': pc = { cmd: 'aim', angle: c.angle, power: c.power }; break;
      case 'fire': pc = { cmd: 'fire' }; break;
      case 'pick_hob': pc = { cmd: 'pick_hob', hob: Number(c.id) }; break;
      case 'pick_shot': pc = { cmd: 'pick_shot', shot: c.id }; break;
      case 'pick_shell': pc = { cmd: 'pick_shell', shell: c.id }; break;
      case 'quick_pick': pc = { cmd: 'quick_pick' }; break;
      case 'end_draft': pc = { cmd: 'end_draft' }; break;
      case 'shove_off': pc = { cmd: 'shove_off', hob: s?.hud.selected.hob ?? -1 }; break;
      case 'pass': pc = { cmd: 'pass' }; break;
      case 'doodad': pc = c.room ? { cmd: 'doodad', doodad: c.id, room: c.room } : { cmd: 'doodad', doodad: c.id }; break;
      case 'recall': {
        const [side, n] = c.pin.split(':').map(Number);
        if (!s || side !== s.side) return { ok: false, error: 'no_ghost' };
        pc = { cmd: 'recall', ghost: n };
        break;
      }
      case 'walk':
        this.walkDir = c.dir;
        this.walkTicks = 0;
        if (c.dir !== 0) return this.walkStep();
        return { ok: true };
      case 'fast': return { ok: true };
      case 'set_wind': return { ok: false, error: 'unknown_command' };
      case 'give_up': return { ok: false, error: 'unknown_command' };
    }
    const r = this.send(pc!);
    return r.ok ? { ok: true } : { ok: false, error: String(r.reason ?? 'refused') };
  }

  private walkStep(): CommandResult {
    const r = this.send({ cmd: 'walk', dx: this.walkDir * RULES.walk.cells });
    if (!r.ok || r.moved === 0 || r.moved === false) this.walkDir = 0;
    return r.ok ? { ok: true } : { ok: false, error: String(r.reason) };
  }

  step(ticks: number): void {
    if (!this.game || !this.last) return;
    const s = this.last;
    if (s.phase === 'plan' && s.awaiting === 'ai') {
      this.think += ticks;
      if (this.think >= THINK_TICKS) { this.think = 0; this.send({ cmd: 'ai_turn' }); }
      return;
    }
    // The Test Yard dummy side never acts (core request: let the core skip it).
    if (s.phase === 'plan' && s.mode === 'test_yard' && s.side === 1) { this.send({ cmd: 'pass' }); return; }
    if (s.phase === 'plan' && this.walkDir !== 0) {
      this.walkTicks += ticks;
      while (this.walkTicks >= RULES.walk.ticks && (this.walkDir as number) !== 0) { this.walkTicks -= RULES.walk.ticks; this.walkStep(); }
      return;
    }
    this.game.step(ticks);
    this.pull();
  }

  /** Read a snapshot from the core, merge lean ones into the last full one, gather events and terrain. */
  private pull(): void {
    const raw = JSON.parse(this.game!.snapshot()) as PSnapshot;
    if (!raw.full && !this.last) throw new Error('the core sent a lean snapshot with no full one before it');
    if (raw.full || !this.last) {
      if (this.last) this.lastCastles = this.last.castles;
      this.last = raw;
      this.rev++;
      for (const i of [0, 1] as const) this.steamMax[i] = Math.max(this.steamMax[i], raw.hud.steam[i] ?? 0);
    } else {
      this.last = { ...this.last, tick: raw.tick, phase: raw.phase, side: raw.side, awaiting: raw.awaiting, shells: raw.shells, full: false };
    }
    const H = this.last.map.h;
    for (const ch of raw.terrain?.chunks ?? []) {
      const bytes = b64(ch.data);
      // flip rows to y-up: view chunk origin is its bottom-left
      const cells = new Uint8Array(ch.w * ch.h);
      for (let row = 0; row < ch.h; row++) cells.set(bytes.subarray(row * ch.w, (row + 1) * ch.w), (ch.h - 1 - row) * ch.w);
      this.chunks.push({ cx: ch.cx, cy: ch.cy, rev: raw.tick, x: ch.x, y: H - ch.y - ch.h, w: ch.w, h: ch.h, cells });
    }
    for (const e of raw.events ?? []) this.events.push(...this.toView(e));
  }

  /** The castle as it stood before this snapshot (a broken block is gone from the new one). */
  private castleBefore(side: number): PCastle | undefined {
    return this.lastCastles?.[side] ?? this.last?.castles[side];
  }

  private toView(e: PEvent): BattleEvent[] {
    const s = this.last!;
    const H = s.map.h;
    const hobAt = (id: number): [number, number] | undefined => { const h = s.hobs.find((x) => x.id === id); return h ? [h.x, H - h.y] : undefined; };
    const slotAt = (side: number, c: number, r: number): [number, number] | undefined => {
      const cs = this.castleBefore(side) ?? s.castles[side];
      return cs ? [cs.x + 16 * c + 8, H - (cs.base_y - 16 * (r + 1) + 8)] : undefined;
    };
    const fortMid = (side: number): [number, number] | undefined => {
      const cs = s.castles[side];
      return cs ? [cs.x + cs.cols * 8, H - cs.base_y + cs.rows * 8] : undefined;
    };
    const n = (k: string) => Number(e[k] ?? 0);
    const note = (text: string, at?: [number, number], sound?: string, status = true): BattleEvent[] =>
      [{ t: 'note', text, x: at?.[0], y: at?.[1], sound, status }];
    switch (e.t) {
      case 'turn_start': return [{ t: 'turn', side: n('side') as Side, round: n('round') }];
      case 'fire': {
        const side = n('side') as Side;
        const [x, y] = hobAt(n('hob')) ?? [0, 0];
        this.stats[side].shots++;
        this.shotDmg = 0;
        const h = s.hobs.find((q) => q.id === n('hob'));
        this.shotBy = { side, hob: h?.name.split(' ')[0] ?? '', round: s.hud.round, angle: n('angle'), power: n('power') };
        const def = this.bundle.shots.find((q) => q.id === String(e.shot));
        return [{ t: 'fire', side, x, y: y + 10, kind: String(e.shot), hob: String(n('hob')), weight: weightOf(def?.weight) }];
      }
      case 'explode': return [{ t: 'boom', x: n('x'), y: H - n('y'), r: n('r'), dtype: e.type ? String(e.type) : undefined }];
      case 'miss': return [{ t: 'hit', x: n('x'), y: H - n('y'), dmg: 0, what: 'ground' }];
      case 'hit': {
        const dmg = n('dmg');
        this.shotDmg += dmg;
        if (this.shotBy && (!this.best || this.shotDmg > this.best.dmg)) this.best = { ...this.shotBy, dmg: this.shotDmg };
        const tgt = String(e.target);
        // Hit counting stays a view stat until the core sends one (core request).
        if (this.shotBy && e.why !== 'crush' && e.why !== 'fall' && n('side') !== this.shotBy.side) this.stats[this.shotBy.side].hits++;
        const out: BattleEvent[] = [];
        if (e.threaded) out.push(...note('Threaded!', undefined, 'bonk'));
        const dtype = e.type ? String(e.type) : e.why === 'crush' || e.why === 'fall' ? 'crush' : undefined;
        if (tgt === 'hob') { const p = hobAt(n('hob')); if (p) out.push({ t: 'hit', x: p[0], y: p[1] + 26, dmg, what: 'hob', hob: String(n('hob')), side: n('side') as Side, dtype }); return out; }
        if (tgt === 'kettle') {
          const k = (this.castleBefore(n('side')) ?? s.castles[n('side')])?.kettle;
          if (k) out.push({ t: 'hit', x: (k.box[0] + k.box[2]) / 2, y: H - k.box[1] + 8, dmg, what: 'kettle', side: n('side') as Side, dtype });
          return out;
        }
        if (tgt === 'block') {
          const p = slotAt(n('side'), n('c'), n('r'));
          const mat = this.castleBefore(n('side'))?.blocks.find((b) => b.c === n('c') && b.r === n('r'))?.mat as Material | undefined;
          if (p) out.push({ t: 'hit', x: p[0], y: p[1] + 8, dmg, what: 'block', side: n('side') as Side, mat, dtype });
          return out;
        }
        if (tgt === 'prop') {
          const pr = s.props.find((p) => p.id === n('id')) ?? s.props.find((p) => p.kind === e.kind);
          if (pr) out.push({ t: 'hit', x: pr.x, y: H - pr.y + 12, dmg, what: 'block' });
          else if (e.x !== undefined) out.push({ t: 'hit', x: n('x'), y: H - n('y'), dmg, what: 'block' });
          return out;
        }
        return out;
      }
      case 'break': {
        const side = n('side');
        const p = slotAt(side, n('c'), n('r'));
        const mat = (this.castleBefore(side)?.blocks.find((b) => b.c === n('c') && b.r === n('r'))?.mat ?? 'timber') as Material;
        if (this.shotBy && side !== this.shotBy.side) this.stats[this.shotBy.side].blocks++;
        return p ? [{ t: 'break', x: p[0], y: p[1], mat, side: side as Side }] : [];
      }
      case 'collapse': {
        // The chunk as it stood, for the collapse show: where each block was, how far its
        // column falls, and which way it tips (toward the side with nothing next to it).
        const side = n('side');
        const blocks = (e.blocks as [number, number, string][]) ?? [];
        const before = this.castleBefore(side) ?? s.castles[side];
        if (!blocks.length || !before) return [];
        const fall = new Map(((e.falls as [number, number][]) ?? []).map(([c, d]) => [c, d]));
        const after = new Set((s.castles[side]?.blocks ?? []).map((b) => `${b.c},${b.r}`));
        let c0 = 1e9, c1 = -1e9, r0 = 1e9;
        for (const [c, r] of blocks) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); }
        const heldL = after.has(`${c0 - 1},${r0}`) || after.has(`${c0},${r0 - 1}`) && !after.has(`${c1},${r0 - 1}`);
        const heldR = after.has(`${c1 + 1},${r0}`) || after.has(`${c1},${r0 - 1}`) && !after.has(`${c0},${r0 - 1}`);
        const lean: -1 | 1 = heldL && !heldR ? 1 : heldR && !heldL ? -1 : (c0 + c1) / 2 < before.cols / 2 ? -1 : 1;
        const out = blocks.map(([c, r, mat]) => {
          const b = before.blocks.find((q) => q.c === c && q.r === r);
          return { x: before.x + 16 * c, y: H - before.base_y + 16 * r, c, r, mat: mat || b?.mat || 'timber', hp: b?.hp ?? 1, maxHp: b?.max ?? 1, fall: fall.get(c) ?? 16 };
        });
        return [{ t: 'collapse', side: side as Side, lean, blocks: out }];
      }
      case 'big_drop': {
        if (!e.callout) return [];
        const sh = this.shotBy;
        const f = sh ? this.castleBefore(sh.side === 0 ? 1 : 0) : undefined;
        return [{ t: 'fall', count: Math.max(6, n('blocks')), x: f ? f.x + f.cols * 8 : 0, y: f ? H - f.base_y : 0 }];
      }
      case 'bonk': { const [x, y] = hobAt(n('hob')) ?? [0, 0]; return [{ t: 'bonk', hob: String(n('hob')), x, y }]; }
      case 'kettle_pop': return [{ t: 'kettle_pop', side: n('side') as Side }];
      case 'squall_warning': return [{ t: 'squall_warn', left: n('n') }];
      case 'squall_round': return [{ t: 'squall', n: n('n') }];
      case 'win': return [{ t: 'end', winner: n('winner') as Side, how: HOW[String(e.how)] ?? String(e.how) }];
      // Everything else gets a short line, and a floating word where it has a place.
      case 'threaded': { const p = hobAt(n('hob')); return [...note('Threaded!', p, 'bonk'), ...(p ? [{ t: 'threaded' as const, x: p[0], y: p[1] }] : [])]; }
      case 'front': return note(`New Weather Front: wind ${n('wind')}`, undefined, 'squall');
      case 'drop': return [...note(e.state === 'tumbled' ? 'Tumble!' : 'Drop!', hobAt(n('hob')), 'thud'), { t: 'hob', hob: String(n('hob')), act: 'tumble' }];
      case 'climb': return [...note('Climbed back in', hobAt(n('hob'))), { t: 'hob', hob: String(n('hob')), act: 'land' }];
      case 'castle_drop': return note('The fort sank', fortMid(n('side')), 'thud');
      case 'thump': return [...note('Thump!', fortMid(n('side')), 'thud'), { t: 'thump', side: n('side') as Side }];
      case 'mend': return note('Mended', fortMid(n('side')), 'pennant');
      case 'rebuild': return note('Rebuilt', fortMid(n('side')), 'pennant');
      case 'puff_up': return note('Puffed up!', hobAt(n('hob')), 'pop');
      case 'fatigue': return note('Fatigue: hurt blocks hold less now', undefined, 'squall');
      case 'pass': return note(`${s.hud.names[n('side')] || 'Side'} passed`);
      case 'walk': return note('Walked', undefined, undefined, false);
      case 'split': return note('Split!', [n('x'), H - n('y')], undefined, false);
      case 'lid_block': return note('Bounced off the lid!', [n('x'), H - n('y')], 'thud');
      case 'lid': return note('Pot Lid on', fortMid(n('side')), 'sheet');
      case 'buried': return note('Loophole buried', hobAt(n('hob')), 'thud');
      case 'dug_out': case 'shove_off': return [...note('Shoved off', hobAt(n('hob')), 'walk'), { t: 'hob', hob: String(n('hob')), act: 'dig' }];
      // Passives that act on their own: the next door glow (Old Grudge, Clatter Call).
      case 'grudge': case 'clatter': return [{ t: 'hob', hob: String(n('hob')), act: 'nextdoor' }];
      case 'prop_break': return note(e.kind === 'cage_bar' ? 'A bar broke!' : 'Broke!', [n('x'), H - n('y')], 'break');
      case 'regrow': return note('The hedge grew back', slotAt(n('side'), n('c'), n('r')));
      default: return [];
    }
  }

  private trails = new Map<string, ShellView['trail']>();
  /** The trail look for a shot, from its content (flight kind and damage type). View only. */
  private trailOf(id: string): ShellView['trail'] {
    let t = this.trails.get(id);
    if (t) return t;
    const d = this.bundle.shots.find((q) => q.id === id) as { flight?: { kind?: string }; triggers?: unknown } | undefined;
    const js = JSON.stringify(d?.triggers ?? '');
    const dt = /"dtype":"(\w+)"/.exec(js)?.[1];
    t = d?.flight?.kind === 'dig' ? 'dig' : /"op":"(heal|mend|repair)/.test(js) ? 'mend' : dt === 'fire' ? 'fire' : dt === 'pierce' || d?.flight?.kind === 'beam' ? 'pierce' : 'blast';
    this.trails.set(id, t);
    return t;
  }

  private view(): ViewCache {
    const s = this.last!;
    if (this.cache?.rev === this.rev) return this.cache;
    const H = s.map.h;
    const hud = s.hud;
    const active = hud.side;
    const blocks: BlockView[] = [];
    const rooms: RoomView[] = [];
    const box = ([x0, y0, x1, y1]: [number, number, number, number]) => ({ x: x0, y: H - y1 - 1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    for (const cs of s.castles) {
      const sh = new Set(cs.shimmer.map(([c, r]) => `${c},${r}`));
      const held = new Set(cs.held.map(([c, r]) => `${c},${r}`));
      for (const b of cs.blocks) {
        blocks.push({
          id: cs.side * 100000 + b.r * 100 + b.c, side: cs.side, c: b.c, r: b.r, x: b.x, y: H - (b.y + 16), size: 16,
          mat: b.mat as Material, hp: b.hp, maxHp: b.max, shimmer: sh.has(`${b.c},${b.r}`),
          root: b.root, battered: b.battered, held: held.has(`${b.c},${b.r}`), peephole: b.peephole,
        });
      }
      for (const rm of cs.rooms) rooms.push({ side: cs.side, id: rm.id, ...box(rm.box), loophole: box(rm.loophole), intact: rm.intact, flap: rm.flap, lid: rm.lid });
    }
    const kettles: KettleView[] = s.castles.map((cs) => {
      const [x0, y0, x1, y1] = cs.kettle.room;
      return { side: cs.side, x: x0, y: H - y1 - 1, size: x1 - x0 + 1, hp: cs.kettle.hp, maxHp: cs.kettle.max, lid: cs.kettle.lid, room: { x: x0, y: H - y1 - 1, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
    });
    const hobs: HobView[] = s.hobs.map((h) => ({
      id: String(h.id), def: h.def, side: h.side, name: h.name.split(' ')[0], cls: (h.class === 'dummy' ? 'lobber' : h.class) as HobClass,
      x: h.x, y: H - h.y, hp: h.hp, maxHp: h.max, state: hobState(h), rest: h.rest,
    }));
    const props: PropView[] = (s.props ?? []).map((p) => ({ id: p.id, side: p.side, kind: p.kind, tag: p.tag, x: p.x, y: H - p.y, hp: p.hp, maxHp: p.max }));
    const nth = [0, 0];
    const pins: PinView[] = [];
    for (const g of s.ghosts) {
      const k = nth[g.side]++;
      if (!g.pin) continue;
      pins.push({ id: `${g.side}:${k}`, side: g.side, hob: String(g.hob), x: g.pin[0], y: H - g.pin[1], round: g.round, spent: g.recalled, angle: g.angle, power: g.power, path: g.points.map(([x, y]) => [x, H - y] as [number, number]), windAt: hud.wind });
    }
    const sel = s.hobs.find((h) => h.id === hud.selected.hob && h.side === active);
    const shotDef = (id: string) => this.bundle.shots.find((x) => x.id === id);
    const chips: ShotChip[] = [];
    if (sel) {
      // Per shot readiness is rebuilt from rest and uses until the core sends it (core request).
      const ready = sel.can_fire && s.phase === 'plan';
      chips.push({ id: 'plain', name: shotDef(sel.plain)?.name ?? 'Plain', icon: sel.plain, kind: 'plain', uses: -1, weight: weightOf(shotDef(sel.plain)?.weight), best: sel.class as HobClass, ready });
      if (sel.knack) chips.push({ id: 'knack', name: shotDef(sel.knack)?.name ?? 'Knack', icon: sel.knack, kind: 'knack', uses: sel.knack_uses, weight: weightOf(shotDef(sel.knack)?.weight), best: sel.class as HobClass, ready: ready && sel.knack_uses > 0 && sel.rest === 0, why: sel.rest > 0 ? 'Needs a rest' : undefined });
      for (const t of hud.hands[active] ?? []) chips.push({ id: t.id, name: t.name ?? t.id, icon: t.id, kind: 'shell', uses: 1, weight: weightOf(t.weight ?? shotDef(t.id)?.weight), best: (t.match ?? undefined) as HobClass | undefined, ready: ready && sel.rest === 0 });
    }
    let draft: DraftView | undefined;
    if (s.draft) {
      const all = [...s.draft.picks[0], ...s.draft.picks[1], ...s.draft.pool];
      draft = {
        pool: all.map((id) => {
          const d = shotDef(id);
          const owner = s.draft!.picks[0].includes(id) ? 0 : s.draft!.picks[1].includes(id) ? 1 : undefined;
          const card = d?.card;
          return { id, name: d?.name ?? id, weight: weightOf(d?.weight), best: d?.match_class as HobClass | undefined, hint: typeof card === 'string' ? card : card?.line ?? '', dud: d?.dud, owner };
        }),
        picks: [[...s.draft.picks[0]], [...s.draft.picks[1]]], perSide: s.draft.picks_each, turn: s.draft.next,
        wish: s.draft.wish ?? undefined, done: s.phase !== 'draft',
      };
    }
    const forts = s.castles.map((cs) => ({ x: cs.x, y: H - cs.base_y, w: cs.cols * 16, h: cs.rows * 16 })) as Snapshot['forts'];
    const preview = s.preview.map(([x, y]) => [x, H - y] as [number, number]);
    this.cache = { rev: this.rev, blocks, kettles, hobs, pins, rooms, props, chips, preview, forts, draft };
    return this.cache;
  }

  snapshot(): Snapshot {
    const s = this.last!;
    const H = s.map.h;
    const hud = s.hud;
    const active = hud.side;
    const human = (side: number) => hud.control[side] === 'human' || s.mode === 'test_yard';
    const you: Side = this.viewSetup?.mode === 'duel' ? active : 0;
    const v = this.view();
    const shells = s.shells.map(([id, x, y, rot, shot]) => {
      const a = (rot / 10) * (Math.PI / 180);
      return { id, x, y: H - y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, kind: shot, side: active, trail: this.trailOf(shot) };
    });
    const sel = s.hobs.find((h) => h.id === hud.selected.hob && h.side === active);
    const plan = s.phase === 'plan';
    const aim = sel && human(active) ? { ...sel.aim } : undefined;
    const mine = s.hobs.filter((h) => h.side === active && h.state !== 'bonked' && h.state !== 'squashed');
    const doodads = (hud.doodads?.[active] ?? []).map((id) => {
      const d = this.bundle.doodads?.find((x) => x.id === id);
      return { id, name: d?.name ?? id, card: d?.card ?? '' };
    });
    let fire: Snapshot['hud']['fire'];
    if (s.phase === 'resolve' || s.phase === 'settle') fire = s.shells.length ? 'flight' : 'fast';
    else if (!(plan && human(active))) fire = 'flight';
    else if (sel?.buried) fire = 'dug';
    else if (sel?.can_fire && (aim?.power ?? 0) > 0) fire = 'ready';
    // Nobody can fire, nobody can be shoved off and no Doodad: offer Pass so the turn never locks.
    else if (!mine.some((h) => h.can_fire || h.buried) && !doodads.length) fire = 'pass';
    else fire = 'locked';
    const level = this.viewSetup?.level ?? '';
    let result: ResultView | undefined;
    if (s.result) {
      this.stats[0].kettle = hud.kettle_pct[0];
      this.stats[1].kettle = hud.kettle_pct[1];
      const win = s.result.winner === 0;
      result = {
        winner: s.result.winner, how: HOW[s.result.how] ?? s.result.how, howKey: s.result.how, round: s.result.round, pennants: s.result.pennants,
        goals: this.levels().find((l) => l.id === level)?.goals ?? [], buttons: win ? RULES.rewards.buttons_win : RULES.rewards.buttons_loss,
        stats: [{ ...this.stats[0] }, { ...this.stats[1] }], bestShot: this.best,
        cause: !win ? lossCause(s.result.how) : undefined,
      };
    }
    const out: Snapshot = {
      tick: s.tick,
      phase: s.phase === 'draft' ? 'draft' : s.phase === 'ended' ? 'over' : s.phase === 'plan' ? (human(active) ? 'plan' : 'rival') : s.shells.length ? 'flight' : 'resolve',
      mode: this.viewSetup?.mode ?? 'campaign',
      round: hud.round, roundCap: hud.round_cap,
      squall: { warn: hud.squall_warning ?? 0, on: hud.squall_round },
      wind: hud.wind, forecast: hud.forecast,
      sides: [0, 1].map((i) => ({ name: hud.names[i] || (this.viewSetup?.sides[i].name ?? ''), human: human(i), help: this.viewSetup?.sides[i].help ?? 'none' })) as Snapshot['sides'],
      terrain: { width: s.map.w, height: H, chunk: s.map.chunk, chunks: this.chunks },
      blocks: v.blocks, kettles: v.kettles, hobs: v.hobs, shells, pins: v.pins, forts: v.forts, rooms: v.rooms, props: v.props,
      fatigue: [!!s.castles[0]?.fatigue, !!s.castles[1]?.fatigue],
      events: this.events,
      hud: {
        active, you, steam: hud.steam[active], steamMax: Math.max(1, this.steamMax[active], hud.steam[active]), steamTurn: hud.steam_turn_left,
        hob: sel ? String(sel.id) : undefined, shot: hud.selected.shot, aim,
        shots: v.chips, preview: plan ? v.preview : [],
        fire, canWalk: plan && human(active) && hud.steam_turn_left > 0 && (this.viewSetup?.mode !== 'campaign' || levelAtLeast(level, RULES.campaign.walk_from)),
        thinking: plan && s.awaiting === 'ai',
        doodads: plan && human(active) ? doodads : [],
        canPass: plan && human(active),
      },
      draft: v.draft, result,
    };
    this.events = [];
    this.chunks = [];
    return out;
  }

  private query<T>(c: PCommand, key: string): T | undefined {
    if (!this.game) return undefined;
    const r = JSON.parse(this.game.command(JSON.stringify(c))) as PReply;
    return r.ok ? (r[key] as T) : undefined;
  }

  saveBattle(): string {
    const log = this.query<PCommand[]>({ cmd: 'log' }, 'log') ?? [];
    const hash = this.query<string>({ cmd: 'hash' }, 'hash') ?? '';
    return JSON.stringify({
      v: SAVE_VERSION, core: 'wasm', rules: this.rules, sim: this.version, hash,
      setup: this.setupJson, seed: String(this.seed), view: this.viewSetup, log,
      stats: this.stats, best: this.best ?? null,
    });
  }

  /**
   * Replay the log: each command applies once the sim is back in a waiting phase. The save must
   * be this save format and this rules version, every command must be accepted again, and the
   * state hash at the end must match the one stored at save time.
   */
  loadBattle(data: string): void {
    let d: { v?: number; rules?: number; hash?: string; setup: string; seed: string; view: BattleSetup; log: PCommand[]; stats?: [SideStats, SideStats]; best?: ResultView['bestShot'] | null };
    try {
      d = JSON.parse(data);
      if (!d || typeof d !== 'object' || typeof d.setup !== 'string' || !Array.isArray(d.log) || !d.view) throw new Error('shape');
      BigInt(d.seed);
    } catch {
      throw new SaveError('This saved fight is damaged.', 'corrupt');
    }
    if (d.v !== SAVE_VERSION || d.rules !== this.rules) throw new SaveError('This saved fight is from an older version.', 'version');
    this.start(d.setup, BigInt(d.seed));
    this.viewSetup = d.view;
    const g = this.game!;
    const settle = () => { for (let i = 0; i < 200; i++) { const st = JSON.parse(g.step(2000)) as { phase: string }; if (st.phase !== 'resolve' && st.phase !== 'settle') break; } };
    for (const c of d.log) {
      settle();
      const rep = JSON.parse(g.command(JSON.stringify(c))) as PReply;
      if (!rep.ok) throw new SaveError('This saved fight no longer replays.', 'mismatch');
    }
    settle();
    const hash = this.query<string>({ cmd: 'hash' }, 'hash');
    if (d.hash && hash !== d.hash) throw new SaveError('This saved fight no longer replays the same.', 'mismatch');
    // The first snapshot after the replay is full (commands ran) and becomes the base; its
    // events are the replay's and are dropped. Then the whole map is sent again (that snapshot
    // may be lean: only terrain changed).
    const after = JSON.parse(g.snapshot()) as PSnapshot;
    if (after.full) {
      this.last = after;
      this.lastCastles = undefined;
      this.rev++;
      for (const i of [0, 1] as const) this.steamMax[i] = Math.max(this.steamMax[i], after.hud.steam[i] ?? 0);
    }
    this.cache = undefined;
    g.command(JSON.stringify({ cmd: 'terrain_all' }));
    this.events = [];
    this.chunks = [];
    this.pull();
    this.events = [];
    if (Array.isArray(d.stats) && d.stats.length === 2) this.stats = [{ ...newStats()[0], ...d.stats[0] }, { ...newStats()[1], ...d.stats[1] }];
    this.best = d.best ?? undefined;
  }
}

function lossCause(how: string): string {
  switch (how) {
    case 'kettle_pop': return 'Your kettle popped.';
    case 'clean_sweep': return 'Every Hob of yours was Bonked.';
    case 'squall': case 'double_pop': return 'The Squall finished your kettle.';
    case 'total_hp': case 'round_cap': return 'Out of rounds, and they had more left.';
    case 'rescue': return 'They got there first.';
    default: return 'A close one.';
  }
}

function hobState(h: PHob): HobView['state'] {
  if (h.state === 'bonked' || h.state === 'squashed') return 'bonked';
  if (h.buried) return 'dug';
  if (h.rest > 0) return 'rest';
  if (h.state === 'tumbled' || h.state === 'dropped') return 'tumbled';
  return 'ready';
}

export function weightOf(w: unknown): 0 | 1 | 2 {
  if (typeof w === 'number') return Math.max(0, Math.min(2, w)) as 0 | 1 | 2;
  return WEIGHT[String(w ?? 'l').toLowerCase()] ?? 0;
}

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The view setup in protocol form (core/API.md "Starting a battle"). */
export function toProtocolSetup(s: BattleSetup, glyphs: Record<string, Material>): PSetup {
  const side = (i: 0 | 1): PSideCfg => {
    const v = s.sides[i];
    const cfg: PSideCfg = { control: v.human || (s.mode === 'yard' && i === 1) ? 'human' : 'ai' };
    if (!v.human) cfg.preset = s.difficulty;
    if (v.name && s.mode !== 'campaign') cfg.name = v.name;
    if (v.crew.length && !(s.mode === 'campaign' && i === 1)) cfg.crew = v.crew.map((c) => c.replace(/^p2_/, '').replace(/^thumper$/, 'old_thumper'));
    const bp = v.blueprint;
    if (bp && bp.id !== 'default') {
      if (bp.kit && !cfg.crew) cfg.kit = bp.kit;
      else if (bp.id && !bp.rowsText?.length && !bp.cells.length) cfg.blueprint = bp.id;
      else if (bp.kit && bp.id) cfg.blueprint = bp.id;
      else if (bp.rowsText) cfg.rows = bp.rowsText;
      else if (bp.id) cfg.blueprint = bp.id;
      else if (bp.cells.length) cfg.rows = blueprintToRows(bp, glyphs);
    }
    if (v.doodads?.length) cfg.doodads = v.doodads.slice(0, 2);
    const steam = RULES.help_steam[v.help ?? 'none'];
    if (steam) cfg.steam = steam;
    return cfg;
  };
  const p: PSetup = {
    level: s.level ?? (s.map && /^d\d+$/.test(s.map) ? s.map : 'd1'),
    mode: s.mode === 'duel' ? 'couch' : s.mode === 'yard' ? 'test_yard' : s.mode,
    sides: [side(0), side(1)],
  };
  if (s.mode === 'campaign') p.sides = [{ ...side(0), control: 'human' }, { control: 'ai', preset: s.difficulty }];
  if (s.first !== undefined) p.first_turn = s.first;
  if (s.roundCap) p.round_cap = s.roundCap;
  const wind = s.windOff ? RULES.wind_presets.off : s.wind ? RULES.wind_presets[s.wind] : undefined;
  if (wind) p.wind = { min: wind.min, max: wind.max };
  if (s.mode !== 'campaign' && s.shells && RULES.rummage_presets[s.shells]) p.rummage = { ...RULES.rummage_presets[s.shells] };
  return p;
}
