// RealCore: drives castle-wasm through the protocol (protocol.ts, core/API.md) and turns
// its snapshots into the view model the renderer and HUD read. No rule is computed here:
// positions are flipped to y-up, events get screen anchors, and that is all. Numbers the
// core does not send yet come from content/app.json (rules.ts).
import { blueprintToRows, rowsToBlueprint } from './bp';
import { RULES, levelAtLeast } from './rules';
import type {
  PBestShot, PCastle, PCommand, PEvent, PHob, PReply, PSetup, PSideCfg, PSnapshot, PVersion, WasmGame, WasmModule,
} from './protocol';
import type {
  BattleEvent, BattleSetup, Blueprint, BlueprintCheck, BlockView, Command, CommandResult, CoreApi,
  DraftView, HobClass, HobInfo, HobView, HudView, KettleView, LevelInfo, Material, PinView, PropView, ResultView, RoomView,
  ShellView, ShotChip, Side, SideStats, Snapshot,
} from './types';
import { SaveError, TICK_HZ } from './types';
import { byId, has, hobShort, plural, rivalShort, t } from '../ui/text';

interface BundleShot {
  id: string;
  name: string;
  weight?: string | number;
  match_class?: string;
  dud?: boolean;
  card?: { line?: string } | string;
  dials?: string[];
  flight?: { kind?: string; block_dmg?: number };
  triggers?: { on?: string; do?: { op?: string; dmg?: number; band?: string; hp?: number; radius?: number }[] }[];
  self_effects?: { op?: string; hp?: number }[];
}
interface Bundle {
  materials: { blocks: { id: string; glyph: string; cost: number }[] };
  hobs: { id: string; name: string; class: string; hp: number; player?: boolean; knack?: string; passive?: { kind?: string; max?: number } }[];
  shots: BundleShot[];
  doodads?: { id: string; name: string; card?: string }[];
  blueprints: { id: string; name: string; rows: string[] }[];
  levels: RawLevel[];
  starter_box: { map: string; kits: { id: string; name: string; blueprint: string; crew: string[] }[] };
}
interface RawLevel {
  id: string; name: string; type: string; width: number; height: number;
  player: { crew: string[]; crew_size: number; blueprint: string };
  rival: { name?: string; habit?: string; crew: string[]; aim?: number; think_ms?: number; roster?: { name: string; think_ms?: number }[] };
  rules: { round_cap: number; squall?: boolean; wind?: { min: number; max: number }; rummage?: { pool: number; picks: number } };
  pennants: { type: string; text: string; value?: number }[];
}

const SAVE_VERSION = 2;
/** The Rival's think pose before ai_turn: the level's `think_ms` (snapshot hud.think_ms), else app.json. */
const thinkTicks = (ms: number | null | undefined): number =>
  Math.round(typeof ms === 'number' && ms > 0 ? (TICK_HZ * ms) / 1000 : TICK_HZ * RULES.rival_think_seconds);
// Content writes Shot Weight as L / M / H; accept the long names too.
const WEIGHT: Record<string, 0 | 1 | 2> = { l: 0, m: 1, h: 2, light: 0, medium: 1, heavy: 2 };
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
  readonly features = { setWind: true, giveUp: true };
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
  // Best shot per side: the results name the winner's own best shot, never the other side's.
  private best: [ResultView['bestShot'], ResultView['bestShot']] = [undefined, undefined];
  private levelsCache?: LevelInfo[];
  private ghostWind = new Map<string, number>();
  battleGen = 0;

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
      const kind: LevelInfo['kind'] = l.type === 'rescue' ? 'rescue' : l.type === 'grand_fort' || l.type === 'boss' ? 'grand_fort' : 'siege';
      return {
        id: l.id, name: l.name, kind,
        type: t(`map.types.${kind}`),
        rival: l.rival.name ?? '', habit: l.rival.habit ?? '',
        rivalCrew: l.rival.crew.map(cls).filter((c) => c !== 'dummy') as HobClass[],
        rivalUnits: l.rival.crew.filter((id) => cls(id) !== 'dummy'),
        aim: l.rival.aim ?? 1, roundCap: l.rules.round_cap, squall: l.rules.squall !== false,
        wind: w.max === 0 ? t('level_card.wind_none') : w.min === w.max ? t('level_card.wind_one', { n: w.max }) : t('level_card.wind_range', { min: w.min, max: w.max }),
        goals: [0, 1, 2].map((i) => (l.pennants[i] ? goalText(l, l.pennants[i]) : '')) as [string, string, string],
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

  /** The Skirmish Rival the core picks for this map and seed: `roster[seed % length]` (core/API.md). */
  skirmishRival(map: string, seed: number): { name: string; habit: string } | undefined {
    const l = this.bundle.levels.find((x) => x.id === map);
    const ro = l?.rival.roster;
    if (!l || !ro?.length) return l?.rival.name ? { name: l.rival.name, habit: l.rival.habit ?? '' } : undefined;
    return { name: ro[Number(BigInt(seed >>> 0) % BigInt(ro.length))].name, habit: l.rival.habit ?? '' };
  }

  resendTerrain(): void {
    if (!this.game) return;
    this.game.command(JSON.stringify({ cmd: 'terrain_all' } satisfies PCommand)); // a query: not logged
    this.pull();
  }

  doodadName(id: string): string { return this.bundle.doodads?.find((d) => d.id === id)?.name ?? id; }

  hobs(): HobInfo[] {
    return this.bundle.hobs.filter((h) => h.player).map((h) => ({ id: h.id, name: hobShort(h.id, h.name), cls: h.class as HobClass, hp: h.hp, joins: RULES.joins[h.id] }));
  }

  starterForts(): Blueprint[] {
    return this.bundle.starter_box.kits.map((k) => {
      const bp = this.bundle.blueprints.find((b) => b.id === k.blueprint);
      return { ...rowsToBlueprint(bp?.rows ?? [], k.name, this.glyphs()), kit: k.id, id: k.blueprint };
    });
  }

  defaultBlueprint(): Blueprint {
    const b = this.bundle.blueprints.find((x) => x.id === 'bp_home_3') ?? this.bundle.blueprints[0];
    return { ...rowsToBlueprint(b.rows, t('workshop.home_fort'), this.glyphs()), id: undefined };
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
    // v0.2: the core sends cost, used and budget; a refusal marks the cells (hanging blocks, open walls).
    // The reason id (and the core's own words, for the Workshop to read the problem from).
    const why = String(rep.detail ?? rep.reason ?? 'invalid_blueprint');
    const cells = Array.isArray(rep.cells) ? (rep.cells as [number, number][]) : [];
    return {
      ok: rep.ok, blocks: typeof rep.used === 'number' ? rep.used : blocks.length,
      budget: typeof rep.budget === 'number' ? rep.budget : RULES.workshop.budget,
      cost: typeof rep.cost === 'number' ? rep.cost : blocks.reduce((a, c) => a + (cost.get(c.kind) ?? 0), 0),
      problems: rep.ok ? [] : cells.length ? cells.map(([c, r]) => ({ col: c, row: r, why })) : [{ col: -1, row: -1, why }],
    };
  }

  checkFort(bp: Blueprint, seats: number): { ok: boolean; why?: string } {
    const rows = this.rowsOf(bp);
    if (!rows.length) return { ok: false, why: 'no_fort' };
    const rep = this.validate(rows, seats);
    return rep.ok ? { ok: true } : { ok: false, why: String(rep.reason ?? rep.detail ?? 'invalid_blueprint') };
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
    this.battleGen++;
    // After a wasm trap the old Game stays borrowed and free() throws: drop it all the same.
    try { old?.free(); } catch { /* dead handle */ }
    this.last = undefined;
    this.lastCastles = undefined;
    this.cache = undefined;
    this.steamMax = [0, 0];
    this.events = [];
    this.chunks = [];
    this.think = 0;
    this.walkDir = 0;
    this.stats = newStats();
    this.best = [undefined, undefined];
    this.shotBy = undefined;
    this.ghostWind.clear();
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
      case 'fire': {
        const f: Extract<PCommand, { cmd: 'fire' }> = { cmd: 'fire' };
        if (c.dial) f.dial = c.dial;
        if (c.target) f.target = c.target;
        pc = f;
        break;
      }
      case 'pick_hob': pc = { cmd: 'pick_hob', hob: Number(c.id) }; break;
      case 'pick_shot': pc = { cmd: 'pick_shot', shot: c.id }; break;
      case 'pick_shell': pc = { cmd: 'pick_shell', shell: c.id }; break;
      case 'quick_pick': pc = { cmd: 'quick_pick' }; break;
      case 'end_draft': pc = { cmd: 'end_draft' }; break;
      case 'shove_off': pc = { cmd: 'shove_off', hob: s?.hud.selected.hob ?? -1 }; break;
      case 'pass': pc = { cmd: 'pass' }; break;
      case 'doodad': pc = c.room ? { cmd: 'doodad', doodad: c.id, room: c.room } : { cmd: 'doodad', doodad: c.id }; break;
      case 'recall': {
        const matched = this.cache?.pins.find((p) => p.id === c.pin || p.slot === c.pin);
        const key = matched?.slot ?? c.pin;
        const [side, n] = key.split(':').map(Number);
        if (!s || !Number.isFinite(side) || !Number.isFinite(n) || side !== s.side) return { ok: false, error: 'no_ghost' };
        pc = { cmd: 'recall', ghost: n };
        break;
      }
      case 'walk':
        this.walkDir = c.dir;
        this.walkTicks = 0;
        if (c.dir !== 0) return this.walkStep();
        return { ok: true };
      case 'fast': return { ok: true };
      case 'set_wind': pc = { cmd: 'set_wind', wind: c.wind }; break;
      case 'give_up': pc = { cmd: 'give_up' }; break;
    }
    const r = this.send(pc!);
    // A refused fire (rules v3) says why in plain words and which shot would go instead.
    return r.ok ? { ok: true } : { ok: false, error: String(r.reason ?? 'refused'), detail: typeof r.detail === 'string' ? r.detail : undefined, readyShot: typeof r.ready_shot === 'string' ? r.ready_shot : undefined };
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
      if (this.think >= thinkTicks(s.hud.think_ms?.[s.side])) { this.think = 0; this.send({ cmd: 'ai_turn' }); }
      return;
    }
    if (s.phase === 'plan' && this.walkDir !== 0) {
      this.walkTicks += ticks;
      while (this.walkTicks >= RULES.walk.ticks && (this.walkDir as number) !== 0) { this.walkTicks -= RULES.walk.ticks; this.walkStep(); }
      return;
    }
    const sr = this.game.step(ticks);
    if (sr) {
      const parsed = JSON.parse(sr) as { ok?: boolean; error?: string; reason?: string };
      if (parsed && parsed.ok === false) throw new Error(String(parsed.error ?? parsed.reason ?? 'core step error'));
    }
    this.pull();
  }

  /** Read a snapshot from the core, merge lean ones into the last full one, gather events and terrain. */
  private pull(): void {
    const raw = JSON.parse(this.game!.snapshot()) as PSnapshot & { ok?: boolean; error?: string; reason?: string };
    if (raw && raw.ok === false) throw new Error(String(raw.error ?? raw.reason ?? 'core snapshot error'));
    if (!raw.full && !this.last) throw new Error('the core sent a lean snapshot with no full one before it');
    if (raw.full || !this.last) {
      if (this.last) this.lastCastles = this.last.castles;
      this.last = raw;
      this.rev++;
      for (const i of [0, 1] as const) this.steamMax[i] = raw.hud.steam_max?.[i] ?? Math.max(this.steamMax[i], raw.hud.steam[i] ?? 0);
    } else {
      this.last = { ...this.last, tick: raw.tick, phase: raw.phase, side: raw.side, awaiting: raw.awaiting, shells: raw.shells, full: false };
      // v0.2: a lean snapshot after `aim` carries the new aim and preview; patch preview in-place to avoid full ViewCache rebuilds.
      if (raw.aim) {
        const a = raw.aim;
        this.last.hobs = this.last.hobs.map((h) => (h.id === a.hob && h.side === a.side ? { ...h, aim: { angle: a.angle, power: a.power } } : h));
        if (raw.preview) {
          this.last.preview = raw.preview;
          if (this.cache) {
            const H0 = this.last.map.h;
            this.cache.preview = raw.preview.map(([x, y]) => [x, H0 - y] as [number, number]);
            this.cache.rev = ++this.rev;
          } else {
            this.rev++;
          }
        }
      }
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
      [{ t: 'note', text, x: at?.[0], y: at?.[1], sound, status, id: e.t }];
    switch (e.t) {
      case 'turn_start': return [{ t: 'turn', side: n('side') as Side, round: n('round') }];
      case 'fire': {
        const side = n('side') as Side;
        const [x, y] = hobAt(n('hob')) ?? [0, 0];
        this.stats[side].shots++;
        this.shotDmg = 0;
        const h = s.hobs.find((q) => q.id === n('hob'));
        this.shotBy = { side, hob: h ? hobShort(h.def, h.name) : '', round: s.hud.round, angle: n('angle'), power: n('power') };
        const def = this.bundle.shots.find((q) => q.id === String(e.shot));
        return [{ t: 'fire', side, x, y: y + 10, kind: String(e.shot), hob: String(n('hob')), weight: weightOf(def?.weight), shotName: def?.name }];
      }
      case 'explode': return [{ t: 'boom', x: n('x'), y: H - n('y'), r: n('r'), dtype: e.type ? String(e.type) : undefined }];
      case 'miss': return [{ t: 'hit', x: n('x'), y: H - n('y'), dmg: 0, what: 'ground' }];
      case 'hit': {
        const dmg = n('dmg');
        // Only damage to the other side counts toward a side's best shot.
        if (this.shotBy && n('side') !== this.shotBy.side) {
          this.shotDmg += dmg;
          const b = this.best[this.shotBy.side];
          if (!b || this.shotDmg > b.dmg) this.best[this.shotBy.side] = { ...this.shotBy, dmg: this.shotDmg };
        }
        const tgt = String(e.target);
        // A view count for the live hand-off card; the result uses the core's own stats.
        if (this.shotBy && e.why !== 'crush' && e.why !== 'fall' && n('side') !== this.shotBy.side) this.stats[this.shotBy.side].hits++;
        const out: BattleEvent[] = [];
        if (e.threaded) out.push(...note(t('notes.threaded'), undefined, undefined, false));
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
      case 'win': return [{ t: 'end', winner: n('winner') as Side, how: String(e.how), key: String(e.how) }];
      // Everything else gets a short line, and a floating word where it has a place.
      case 'threaded': { const p = hobAt(n('hob')); return [...note(t('notes.threaded'), p), ...(p ? [{ t: 'threaded' as const, x: p[0], y: p[1] }] : [])]; }
      case 'front': {
        const w = n('wind');
        return note(w === 0 ? t('banners.weather.front_none') : t(w > 0 ? 'banners.weather.front_right' : 'banners.weather.front_left', { n: Math.abs(w) }), undefined, 'front_chime');
      }
      case 'drop': return [...note(byId('notes.drop', String(e.state)), hobAt(n('hob')), 'thud'), { t: 'hob', hob: String(n('hob')), act: 'tumble' }];
      case 'climb': return [...note(t('notes.climb'), hobAt(n('hob'))), { t: 'hob', hob: String(n('hob')), act: 'land' }];
      case 'castle_drop': return note(t('notes.castle_drop'), fortMid(n('side')), 'thud');
      case 'thump': return [...note(t('notes.thump'), fortMid(n('side')), 'thud'), { t: 'thump', side: n('side') as Side }];
      case 'mend': return note(t('notes.mend'), fortMid(n('side')), 'mend_fizz');
      case 'rebuild': return note(t('notes.rebuild'), fortMid(n('side')), 'mend_fizz');
      case 'puff_up': return note(t('notes.puff_up'), hobAt(n('hob')), 'pop');
      // The Test Yard Dummy passes every turn: no word for it.
      case 'pass': return e.why === 'dummy' ? [] : note(t('notes.pass', { name: s.hud.names[n('side')] || t('common.rival') }));
      case 'walk': return [];
      case 'split': return note(t('notes.split'), [n('x'), H - n('y')], 'split', false);
      case 'bounce': return [{ t: 'note', text: '', x: n('x'), y: H - n('y'), sound: 'bounce', status: false }];
      case 'lid_block': return note(t('notes.lid_block'), [n('x'), H - n('y')], 'lid_bounce');
      case 'lid': return note(t('notes.lid'), fortMid(n('side')), 'sheet');
      case 'buried': return note(t('notes.buried'), hobAt(n('hob')), 'buried');
      case 'dug_out': case 'shove_off': return [...note(t('notes.dug_out'), hobAt(n('hob')), 'walk'), { t: 'hob', hob: String(n('hob')), act: 'dig' }];
      // Passives that act on their own: the next door glow (Old Grudge, Dinner Bell).
      case 'grudge': case 'clatter': return [...note(t(`notes.${e.t}`), hobAt(n('hob')), undefined, false), { t: 'hob', hob: String(n('hob')), act: 'nextdoor' }];
      case 'prop_break': return note(byId('notes.prop_break', String(e.kind)), [n('x'), H - n('y')], 'break');
      case 'regrow': return note(t('notes.regrow'), slotAt(n('side'), n('c'), n('r')));
      // v0.2: the Grand Fort phases on 1-10 and the Volley Points relight.
      case 'boss_phase': {
        const lv = this.viewSetup?.level ?? s.level;
        const k = `levels.${lv}.phases.${n('phase')}`;
        return note(has(k) ? t(k) : t('banners.notice.boss_phase_default'), undefined, 'boss_horn');
      }
      case 'roller': return note(t('banners.notice.roller_out'), [n('x'), H - n('y')], 'roller');
      case 'roller_stop': return note(t('banners.notice.roller_stuck'), undefined, 'roller_low');
      // The roller and the shears move on their own between turns: a sound and a word each, never silent.
      case 'roller_move': return note(e.why === 'blocked' ? t('banners.notice.roller_stuck') : t('banners.notice.roller_on'), [n('to'), H - n('y')], 'roller', false);
      case 'roller_done': return note(t('banners.notice.roller_done'), undefined, 'roller_low');
      case 'shears': return note(t('banners.notice.shears_up'), [n('x'), H - n('y')], 'shears');
      case 'column': return note(t('notes.column'), slotAt(n('side'), n('c'), n('r')), 'boom', false);
      case 'prop': return note(e.kind === 'turnip' || e.shot === 'turnip' || e.shot === 'turnip_prop' ? t('notes.prop.turnip') : t('notes.prop.crock'), [n('x'), H - n('y')], 'thud', false);
      case 'prop_wake': return note(t('notes.prop_wake'), [n('x'), H - n('y')], 'crock');
      case 'carve': return [{ t: 'note', text: '', x: n('x'), y: H - n('y'), sound: 'carve', status: false }];
      case 'mound': return [{ t: 'note', text: '', x: n('x'), y: H - n('y'), sound: 'mound', status: false }];
      case 'shears_open': return note(t('banners.notice.shears_open'), undefined, 'sheet');
      case 'shears_snip': return note(t('notes.shears_snip'), undefined, 'snip');
      case 'shears_jam': return note(plural('banners.notice.shears_jam', n('turns')), undefined, 'shears_jam');
      case 'relight': return note(t('notes.relight'), fortMid(n('side')), 'ket_patch');
      case 'kettle_crack': return note(t('notes.kettle_crack'), fortMid(n('side')), undefined, false);
      // The Creaks (core id fatigue) are warned a round ahead and named when they start; the
      // collapse comes as ordinary collapse events (why: fatigue) and plays like any other.
      case 'fatigue_warning': return [{ t: 'fatigue', phase: 'warn', text: t('banners.creaks.warn') }];
      case 'fatigue': return [{ t: 'fatigue', phase: 'start', text: t('banners.creaks.start') }];
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
      id: String(h.id), def: h.def, side: h.side, name: hobShort(h.def, h.name), cls: (h.class === 'dummy' ? 'lobber' : h.class) as HobClass,
      x: h.x, y: H - h.y, hp: h.hp, maxHp: h.max, state: hobState(h), rest: h.rest,
    }));
    const props: PropView[] = (s.props ?? []).map((p) => ({ id: p.id, side: p.side, kind: p.kind, tag: p.tag, x: p.x, y: H - p.y, hp: p.hp, maxHp: p.max }));
    const nth = [0, 0];
    const pins: PinView[] = [];
    for (const g of s.ghosts) {
      const k = nth[g.side]++;
      if (!g.pin) continue;
      const pid = `${g.side}:${g.hob}:${g.round}:${g.pin[0]}:${g.pin[1]}`;
      if (!this.ghostWind.has(pid)) this.ghostWind.set(pid, hud.wind);
      pins.push({
        id: pid, slot: `${g.side}:${k}`, side: g.side, hob: String(g.hob), x: g.pin[0], y: H - g.pin[1],
        round: g.round, spent: g.recalled, angle: g.angle, power: g.power,
        path: g.points.map(([x, y]) => [x, H - y] as [number, number]),
        windAt: this.ghostWind.get(pid) ?? hud.wind,
      });
    }
    const sel = s.hobs.find((h) => h.id === hud.selected.hob && h.side === active);
    const shotDef = (id: string) => this.bundle.shots.find((x) => x.id === id);
    const shotMeta = (d: BundleShot | undefined, extraDials?: ('puff_up' | 'rebuild' | 'hops3')[]): Pick<ShotChip, 'dials' | 'selfTarget' | 'canTargetOwn' | 'line' | 'dmg' | 'band'> => {
      const dials: ('puff_up' | 'rebuild' | 'hops3')[] = [];
      for (const dl of d?.dials ?? []) if (dl === 'puff_up' || dl === 'rebuild' || dl === 'hops3') dials.push(dl);
      for (const dl of extraDials ?? []) if (!dials.includes(dl)) dials.push(dl);
      const card = d?.card;
      const line = typeof card === 'string' ? card : card?.line;
      let dmg: number | undefined;
      let band: string | undefined;
      for (const tr of d?.triggers ?? []) {
        for (const eff of tr.do ?? []) {
          if (typeof eff.dmg === 'number' && (dmg === undefined || eff.dmg > dmg)) dmg = eff.dmg;
          if (typeof eff.band === 'string' && !band) band = eff.band;
        }
      }
      if (dmg === undefined && typeof d?.flight?.block_dmg === 'number') dmg = d.flight.block_dmg;
      if (dmg === undefined && typeof d?.self_effects?.[0]?.hp === 'number') dmg = d.self_effects[0].hp;
      return {
        dials: dials.length ? dials : undefined,
        selfTarget: d?.flight?.kind === 'self' || undefined,
        canTargetOwn: (d?.self_effects?.length ?? 0) > 0 || undefined,
        line, dmg, band,
      };
    };
    const chips: ShotChip[] = [];
    if (sel) {
      const ready = sel.can_fire && s.phase === 'plan';
      const hobDef = this.bundle.hobs.find((x) => x.id === sel.def);
      const hopDial = hobDef?.passive?.kind === 'hop_dial' ? (['hops3'] as ('hops3')[]) : undefined;
      const plainDef = shotDef(sel.plain);
      chips.push({ id: 'plain', name: plainDef?.name ?? sel.plain, icon: sel.plain, kind: 'plain', uses: -1, weight: weightOf(plainDef?.weight), best: sel.class as HobClass, ready, ...shotMeta(plainDef, hopDial) });
      if (sel.knack) {
        const kDef = shotDef(sel.knack);
        chips.push({ id: 'knack', name: kDef?.name ?? sel.knack, icon: sel.knack, kind: 'knack', uses: sel.knack_uses, weight: weightOf(kDef?.weight), best: sel.class as HobClass, ready: ready && sel.knack_uses > 0 && sel.rest === 0, why: sel.rest > 0 ? t('hud.why_short.resting') : undefined, ...shotMeta(kDef) });
      }
      for (const t of hud.hands[active] ?? []) {
        const tDef = shotDef(t.id);
        chips.push({ id: t.id, name: t.name ?? tDef?.name ?? t.id, icon: t.id, kind: 'shell', uses: 1, weight: weightOf(t.weight ?? tDef?.weight), best: (t.match ?? tDef?.match_class ?? undefined) as HobClass | undefined, ready: ready && sel.rest === 0, ...shotMeta(tDef) });
      }
      // v0.2: the core says which shots are ready and why not (what `fire` would refuse with).
      for (const c of chips) {
        const q = hud.shots?.find((x) => x.shot === c.id || (c.kind === 'shell' && x.id === c.id));
        // The reason id from the core, in the table's words (never the core's own English).
        if (q) { c.ready = q.ready; c.why = q.ready ? undefined : whyShort(q.why); }
      }
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
    // The Test Yard dummy side is 'human' in the protocol only so it never runs the AI; it passes itself.
    const human = (side: number) => hud.control[side] === 'human' && !(s.mode === 'test_yard' && side === 1);
    const you: Side = this.viewSetup?.mode === 'duel' ? active : 0;
    const v = this.view();
    const shells = s.shells.map(([id, x, y, rot, shot]) => {
      const a = (rot / 10) * (Math.PI / 180);
      return { id, x, y: H - y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, kind: shot, side: active, trail: this.trailOf(shot) };
    });
    const sel = s.hobs.find((h) => h.id === hud.selected.hob && h.side === active);
    const plan = s.phase === 'plan';
    const aim = sel && human(active) ? { ...sel.aim } : undefined;
    const doodads = (hud.doodads?.[active] ?? []).map((id) => {
      const d = this.bundle.doodads?.find((x) => x.id === id);
      return { id, name: d?.name ?? id, card: d?.card ?? '' };
    });
    // Fire is ready only when the picked shot is ready too (core hud.shots): a Knack on a rest
    // turn or with no uses left must never leave Fire lit and dead.
    const picked = v.chips.find((c) => c.id === hud.selected.shot);
    // A core that sends hud.fire (v0.3) says it outright; else the picked chip's readiness decides.
    const hf = hud.fire;
    const whyVars = { hob: sel ? hobShort(sel.def, sel.name) : '', shot: picked?.name ?? '' };
    const pickedWhy = picked ? hud.shots?.find((x) => x.shot === picked.id || (picked.kind === 'shell' && x.id === picked.id))?.why : undefined;
    const fireWhy = !(plan && human(active)) ? undefined
      : hf ? (hf.ready ? undefined : byId('hud.why', hf.why ?? undefined, whyVars))
      : picked && !picked.ready ? byId('hud.why', pickedWhy ?? undefined, whyVars) : undefined;
    const anyCanAct = s.hobs.some((h) => h.side === active && (h.can_fire || h.buried));
    let fire: Snapshot['hud']['fire'];
    if (s.phase === 'resolve' || s.phase === 'settle') fire = s.shells.length ? 'flight' : 'fast';
    else if (!(plan && human(active))) fire = 'flight';
    else if (sel?.buried) fire = 'dug';
    else if (sel?.can_fire && (picked?.selfTarget || (aim?.power ?? 0) > 0) && !fireWhy) fire = 'ready';
    // Nobody can fire (trusting core `can_fire`, including squashed Hobs), nobody can be shoved off and no Doodad: offer Pass so the turn never locks.
    else if (!anyCanAct && !doodads.length) fire = 'pass';
    else fire = 'locked';
    const level = this.viewSetup?.level ?? '';
    let result: ResultView | undefined;
    if (s.result) {
      this.stats[0].kettle = hud.kettle_pct[0];
      this.stats[1].kettle = hud.kettle_pct[1];
      // v0.2: the core counts shots and blocks; hits stay a view count.
      const rs = s.result.stats;
      const statsOf = (i: 0 | 1): SideStats => (rs ? { shots: rs[i].shots, hits: rs[i].hits, blocks: rs[i].blocks_dropped, kettle: hud.kettle_pct[i], bonks: rs[i].bonks, streak: rs[i].best_streak } : { ...this.stats[i] });
      const win = s.result.winner === 0;
      result = {
        winner: s.result.winner, how: s.result.how, howKey: s.result.how, round: s.result.round, pennants: s.result.pennants,
        goals: this.levels().find((l) => l.id === level)?.goals ?? [], buttons: s.result.buttons ?? 0,
        stats: [statsOf(0), statsOf(1)], bestShot: s.result.best_shot !== undefined ? fromBlow(s.result.best_shot, s.hobs) : bestOf(this.best, s.result.winner),
        broke: !win ? this.brokeView(s.result) : undefined,
        rival: s.hud.names[1] || undefined,
        pennantsNew: s.result.pennants_new, score: s.result.score,
      };
    }
    const out: Snapshot = {
      tick: s.tick,
      phase: s.phase === 'draft' ? 'draft' : s.phase === 'ended' ? 'over' : s.phase === 'plan' ? (human(active) ? 'plan' : 'rival') : s.shells.length ? 'flight' : 'resolve',
      mode: this.viewSetup?.mode ?? 'campaign',
      round: hud.round, roundCap: hud.round_cap,
      squall: { warn: hud.squall_warning ?? 0, on: hud.squall_round },
      wind: hud.wind, forecast: hud.forecast,
      // One player: side 0 is "You" (the core calls it Left), the Test Yard's far side the Dummy.
      sides: [0, 1].map((i) => ({
        name: this.viewSetup?.mode !== 'duel' && i === 0 ? t('common.you')
          : this.viewSetup?.mode === 'yard' && i === 1 ? t('common.dummy')
          : hud.names[i] || (this.viewSetup?.sides[i].name ?? ''),
        human: human(i), help: this.viewSetup?.sides[i].help ?? 'none',
      })) as Snapshot['sides'],
      terrain: { width: s.map.w, height: H, chunk: s.map.chunk, chunks: this.chunks },
      blocks: v.blocks, kettles: v.kettles, hobs: v.hobs, shells, pins: v.pins, forts: v.forts, rooms: v.rooms, props: v.props,
      fatigue: [!!s.castles[0]?.fatigue, !!s.castles[1]?.fatigue],
      fatigueIn: hud.fatigue_in ?? undefined,
      events: this.events,
      hud: {
        active, you, steam: hud.steam[active], steamMax: Math.max(1, this.steamMax[active], hud.steam[active]), steamTurn: hud.steam_turn_left,
        hob: sel ? String(sel.id) : undefined, shot: hud.selected.shot, aim,
        shots: v.chips, preview: plan ? v.preview : [],
        fire, fireWhy, canWalk: plan && human(active) && hud.steam_turn_left > 0 && (this.viewSetup?.mode !== 'campaign' || levelAtLeast(level, RULES.campaign.walk_from)),
        thinking: plan && s.awaiting === 'ai',
        doodads: plan && human(active) ? doodads : [],
        canPass: plan && human(active),
        volley: hud.volley ?? undefined,
        score: Array.isArray(hud.score) ? [hud.score[0], hud.score[1]] : undefined,
        puffUp: Array.isArray(hud.puff_up) ? [!!hud.puff_up[0], !!hud.puff_up[1]] : undefined,
        shoveOffCost: hud.shove_off_cost,
        frontRoundsLeft: hud.front_rounds_left,
        handicap: hud.handicap ? [0, 1].map((i) => ({ help: hud.handicap![i].help, steam: hud.handicap![i].steam, previewPct: hud.handicap![i].preview_pct, crew: hud.handicap![i].crew })) as HudView['handicap'] : undefined,
        boss: hud.boss ? { phase: hud.boss.phase, jam: hud.boss.jam, cut: hud.boss.cut ? { x: hud.boss.cut[0], y: H - hud.boss.cut[3] - 1, w: hud.boss.cut[2] - hud.boss.cut[0] + 1, h: hud.boss.cut[3] - hud.boss.cut[1] + 1 } : undefined } : undefined,
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

  /** "What broke you" (result.broke) as ids and names; the results screen words it from the table. */
  private brokeView(r: PSnapshot['result']): ResultView['broke'] {
    const b = r?.broke;
    if (!b) return undefined;
    const hobs = this.last?.hobs ?? [];
    const hobName = (id: number | null, name: string | null) => (id === null ? '' : hobShort(hobs.find((h) => h.id === id)?.def, name ?? ''));
    const blow = (x: NonNullable<typeof b.last>) => ({
      by: x.by ?? (x.shot === 'squall' ? 'squall' : x.shot === 'ground' ? 'ground' : 'hob'),
      hob: hobName(x.hob, x.hob_name),
      shot: this.bundle.shots.find((q) => q.id === x.shot)?.name ?? x.shot_name ?? '',
      round: x.round, dmg: x.dmg,
    });
    return {
      how: b.how, last: b.last ? blow(b.last) : undefined, top: (b.top ?? []).map(blow),
      blocksLost: b.blocks_lost, hobsBonked: b.hobs_bonked,
      bonkedNames: hobs.filter((h) => h.side === b.side && h.state === 'bonked').map((h) => hobShort(h.def, h.name)),
    };
  }

  saveBattle(): string {
    const log = this.query<PCommand[]>({ cmd: 'log' }, 'log') ?? [];
    let hash = this.query<string>({ cmd: 'hash' }, 'hash') ?? '';
    // `resume` replays the log and runs on to the next stable point (the next plan or draft).
    // A save taken while a shot is in the air or the fort settles must store the hash of the
    // state the replay lands on, not the hash of this tick, or it could never load. A scratch
    // Game replays the log once to find it (the live battle reaches the same state).
    const ph = this.last?.phase;
    if (ph === 'resolve' || ph === 'settle') hash = this.landingHash(log) ?? '';
    return JSON.stringify({
      v: SAVE_VERSION, core: 'wasm', rules: this.rules, sim: this.version, hash,
      setup: this.setupJson, seed: String(this.seed), view: this.viewSetup, log,
      stats: this.stats, bestBy: this.best,
    });
  }

  private landingHash(log: PCommand[]): string | undefined {
    let g: WasmGame | undefined;
    try {
      g = new this.mod.Game('', this.setupJson, this.seed);
      const rep = JSON.parse(g.command(JSON.stringify({ cmd: 'resume', log } satisfies PCommand))) as PReply & { hash?: string };
      return rep.ok ? rep.hash : undefined;
    } catch {
      return undefined;
    } finally {
      try { g?.free(); } catch { /* a trapped scratch game is dropped */ }
    }
  }

  /**
   * Replay the log with the core's `resume`. The save must be this save format and this rules
   * version, and the core must accept the whole log. The state hash after the replay is checked
   * against the stored one; a miss is reported as a note, never a reason to throw a good log away.
   */
  loadBattle(data: string): string | void {
    let d: { v?: number; rules?: number; hash?: string; setup: string; seed: string; view: BattleSetup; log: PCommand[]; stats?: [SideStats, SideStats]; best?: ResultView['bestShot'] | null; bestBy?: (ResultView['bestShot'] | null)[] };
    try {
      d = JSON.parse(data);
      if (!d || typeof d !== 'object' || typeof d.setup !== 'string' || !Array.isArray(d.log) || !d.view) throw new Error('shape');
      BigInt(d.seed);
    } catch {
      throw new SaveError(t('errors.saved_fight_damaged'), 'corrupt');
    }
    if (d.v !== SAVE_VERSION || d.rules !== this.rules) throw new SaveError(t('errors.saved_fight_old'), 'version');
    this.start(d.setup, BigInt(d.seed));
    this.viewSetup = d.view;
    const g = this.game!;
    // v0.2: the core replays the log itself, stepping between commands as a live app does,
    // and lands on the next stable point after the last command.
    const rep = JSON.parse(g.command(JSON.stringify({ cmd: 'resume', log: d.log } satisfies PCommand))) as PReply & { hash?: string };
    if (!rep.ok) throw new SaveError(t('errors.saved_fight_damaged'), 'mismatch');
    const note = d.hash && rep.hash !== d.hash ? t('errors.saved_fight_differs') : undefined;
    // The next snapshot is full with the whole map; its events are the replay's and are dropped.
    this.cache = undefined;
    this.lastCastles = undefined;
    this.last = undefined;
    this.events = [];
    this.chunks = [];
    this.pull();
    this.events = [];
    if (Array.isArray(d.stats) && d.stats.length === 2) this.stats = [{ ...newStats()[0], ...d.stats[0] }, { ...newStats()[1], ...d.stats[1] }];
    // bestBy: one per side. An older save has one best shot for the whole fight: keep it on its side.
    this.best = [undefined, undefined];
    if (Array.isArray(d.bestBy)) this.best = [d.bestBy[0] ?? undefined, d.bestBy[1] ?? undefined];
    else if (d.best && (d.best.side === 0 || d.best.side === 1)) this.best[d.best.side] = d.best;
    return note;
  }
}

/** The core's best shot (v0.3 result.best_shot) in view form; null stays undefined. */
function fromBlow(b: PBestShot | null, hobs: PHob[]): ResultView['bestShot'] {
  if (!b) return undefined;
  const def = hobs.find((h) => h.id === b.hob)?.def;
  return { side: b.side as Side, hob: hobShort(def, b.hob_name ?? ''), round: b.round, dmg: b.dmg, angle: b.angle, power: b.power };
}

/** The winner's best shot (kept by the view for a core without result.best_shot); on a draw the better of the two. */
export function bestOf(best: [ResultView['bestShot'], ResultView['bestShot']], winner: number): ResultView['bestShot'] {
  if (winner === 0 || winner === 1) return best[winner];
  const [a, b] = best;
  return a && b ? (b.dmg > a.dmg ? b : a) : a ?? b;
}

/** A refusal id from hud.shots, as the short chip word (`hud.why_short`). */
function whyShort(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return has(`hud.why_short.${id}`) ? t(`hud.why_short.${id}`) : t('hud.why_short.not_planning');
}

function hobState(h: PHob): HobView['state'] {
  if (h.state === 'bonked' || h.hp <= 0) return 'bonked';
  // Crushed by a fall: hurt and down for now, never Bonked (QA playtest 2, N2).
  if (h.state === 'squashed') return 'squashed';
  if (h.buried) return 'dug';
  if (h.rest > 0) return 'rest';
  if (h.state === 'tumbled' || h.state === 'dropped') return 'tumbled';
  return 'ready';
}

/** A Pennant's goal: `levels.<id>.goals.<type>`, else `pennants.<type>`, else the level file's text (content/text.md). */
function goalText(l: RawLevel, p: RawLevel['pennants'][number]): string {
  const vars = { n: p.value, rival: rivalShort(l.rival.name, l.id), captive: has(`levels.${l.id}.captive`) ? t(`levels.${l.id}.captive`) : '' };
  if (has(`levels.${l.id}.goals.${p.type}`)) return t(`levels.${l.id}.goals.${p.type}`, vars);
  if (has(`pennants.${p.type}`)) return t(`pennants.${p.type}`, vars);
  return p.text;
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
    // Test Yard: the far side is a lone Straw Stuffer, and a side of dummies passes itself
    // (core/API.md test_yard), so only the human side ever gets a turn.
    const dummy = s.mode === 'yard' && i === 1;
    const cfg: PSideCfg = { control: v.human || dummy ? 'human' : 'ai' };
    if (dummy) cfg.crew = ['straw_stuffer'];
    if (!v.human) cfg.preset = s.difficulty;
    if (v.name && s.mode !== 'campaign') cfg.name = v.name;
    if (!dummy && v.crew.length && !(s.mode === 'campaign' && i === 1)) cfg.crew = v.crew.map((c) => c.replace(/^p2_/, '').replace(/^thumper$/, 'old_thumper'));
    const bp = v.blueprint;
    if (bp && bp.id !== 'default') {
      if (bp.kit) cfg.kit = bp.kit;
      else if (bp.id && !bp.rowsText?.length && !bp.cells.length) cfg.blueprint = bp.id;
      else if (bp.rowsText) cfg.rows = bp.rowsText;
      else if (bp.id) cfg.blueprint = bp.id;
      else if (bp.cells.length) cfg.rows = blueprintToRows(bp, glyphs);
    }
    if (v.doodads?.length) cfg.doodads = v.doodads.slice(0, 2);
    // Help, preview share and crew size are handicaps the core applies (Steam from content/app.json).
    if (v.help && v.help !== 'none') cfg.help = v.help;
    if (v.previewPct !== undefined) cfg.preview_pct = v.previewPct;
    if (v.crewSize) cfg.crew_size = v.crewSize;
    return cfg;
  };
  const p: PSetup = {
    level: s.level ?? (s.map && /^d\d+$/.test(s.map) ? s.map : 'd1'),
    mode: s.mode === 'duel' ? 'couch' : s.mode === 'yard' ? 'test_yard' : s.mode,
    sides: [side(0), side(1)],
  };
  if (s.mode === 'campaign') p.sides = [{ ...side(0), control: 'human' }, { control: 'ai', preset: s.difficulty }];
  if (s.first !== undefined) p.first_turn = s.first;
  if (s.attempt) p.attempt = s.attempt; // the web has no Daily Dust-up, where the core ignores it
  if (s.roundCap && !s.volley) p.round_cap = s.roundCap;
  if (s.progress) p.progress = { cleared: s.progress.cleared, pennants: s.progress.pennants.slice(0, 3), daily_paid: false };
  const wind = s.windOff ? RULES.wind_presets.off : s.wind ? RULES.wind_presets[s.wind] : undefined;
  if (wind) p.wind = { min: wind.min, max: wind.max };
  if (s.mode !== 'campaign' && s.shells && RULES.rummage_presets[s.shells]) p.rummage = { ...RULES.rummage_presets[s.shells] };
  if (s.volley && (s.mode === 'skirmish' || s.mode === 'duel')) p.volley = s.volley;
  return p;
}
