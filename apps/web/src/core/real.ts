// RealCore: drives castle-wasm through the protocol (protocol.ts, core/API.md) and turns
// its snapshots into the view model the renderer and HUD read. No rule is computed here:
// positions are flipped to y-up, events get screen anchors, and that is all.
import { LEVELS as MOCK_LEVELS } from './content';
import { blueprintToRows, rowsToBlueprint } from './bp';
import type {
  PCastle, PCommand, PEvent, PHob, PReply, PSetup, PSideCfg, PSnapshot, WasmGame, WasmModule,
} from './protocol';
import type {
  BattleEvent, BattleSetup, Blueprint, BlueprintCheck, BlockView, Command, CommandResult, CoreApi,
  DraftView, HobClass, HobInfo, HobView, LevelInfo, Material, PinView, ResultView, ShotChip, Side, Snapshot,
} from './types';
import { TICK_HZ } from './types';

interface Bundle {
  materials: { blocks: { id: string; glyph: string; cost: number }[] };
  hobs: { id: string; name: string; class: string; hp: number; player?: boolean; knack?: string }[];
  shots: { id: string; name: string; weight?: string | number; match_class?: string; dud?: boolean; card?: { line?: string } | string }[];
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

const JOINS: Record<string, string> = { quill: '1-2', jax: '1-4', grub: '1-5', hetty: '1-7', bobbin: '1-8', old_thumper: '1-9', nan: '1-10' };
const THINK_TICKS = Math.round(TICK_HZ * 1.0); // the Rival's think pose before ai_turn
const WEIGHT: Record<string, 0 | 1 | 2> = { light: 0, medium: 1, heavy: 2 };
const HOW: Record<string, string> = { clean_sweep: 'Clean Sweep', kettle_pop: 'Kettle Pop', squall: 'Sudden Squall', double_pop: 'Sudden Squall', rescue: 'Rescue', round_cap: 'Doze Off', total_hp: 'Round cap' };

export class RealCore implements CoreApi {
  readonly name = 'wasm';
  readonly version: string;
  private bundle: Bundle;
  private game?: WasmGame;
  private scratch?: WasmGame;
  private setupJson = '';
  private seed = 1n;
  private viewSetup?: BattleSetup;
  private last?: PSnapshot; // last full snapshot
  private lastCastles?: [PCastle, PCastle];
  private events: BattleEvent[] = [];
  private chunks: Snapshot['terrain']['chunks'] = [];
  private think = 0;
  private walkDir: -1 | 0 | 1 = 0;
  private walkTicks = 0;
  private stats = [{ shots: 0, hits: 0, blocks: 0, kettle: 100 }, { shots: 0, hits: 0, blocks: 0, kettle: 100 }];
  private shotDmg = 0;
  private shotBy?: { side: Side; hob: string; round: number; angle: number; power: number };
  private best?: ResultView['bestShot'];
  private levelsCache?: LevelInfo[];

  constructor(private mod: WasmModule) {
    try { this.version = JSON.parse(mod.cp_version()).sim ?? 'wasm'; } catch { this.version = 'wasm'; }
    this.bundle = JSON.parse(mod.default_content()) as Bundle;
  }

  // ---------- content views ----------
  levels(): LevelInfo[] {
    if (this.levelsCache) return this.levelsCache;
    const cls = (id: string) => this.bundle.hobs.find((x) => x.id === id)?.class ?? 'lobber';
    this.levelsCache = this.bundle.levels.filter((l) => /^\d+-\d+$/.test(l.id)).map((l) => {
      const mock = MOCK_LEVELS.find((m) => m.id === l.id);
      const w = l.rules.wind ?? { min: 0, max: 0 };
      return {
        id: l.id, name: l.name,
        type: l.type === 'rescue' ? 'Rescue' : l.type === 'grand_fort' || l.type === 'boss' ? 'Grand Fort' : 'Siege',
        rival: l.rival.name, habit: l.rival.habit ?? mock?.habit ?? '',
        rivalCrew: l.rival.crew.map(cls).filter((c) => c !== 'dummy') as HobClass[],
        aim: l.rival.aim ?? 1, roundCap: l.rules.round_cap,
        wind: w.max === 0 ? 'No wind' : w.min === w.max ? `Wind ${w.max}` : `Wind ${w.min} to ${w.max}`,
        goals: [0, 1, 2].map((i) => l.pennants[i]?.text ?? '') as [string, string, string],
        crewSize: l.player.crew_size, draft: (l.rules.rummage?.pool ?? 0) > 0,
      };
    });
    return this.levelsCache;
  }

  hobs(): HobInfo[] {
    return this.bundle.hobs.filter((h) => h.player).map((h) => ({ id: h.id, name: h.name.split(' ')[0] === 'Old' ? 'Old Thumper' : h.name.split(' ')[0], cls: h.class as HobClass, hp: h.hp, joins: JOINS[h.id] }));
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

  checkBlueprint(bp: Blueprint): BlueprintCheck {
    const rows = bp.rowsText ?? blueprintToRows(bp, this.glyphs());
    const seats = bp.cells.some((c) => c.kind === 'nook') ? new Set(bp.cells.filter((c) => c.kind === 'nook').map((c) => c.room ?? 0)).size : 0;
    this.scratch ??= new this.mod.Game('', JSON.stringify({ level: 'd1', mode: 'test_yard' }), 1n);
    const rep = JSON.parse(this.scratch.command(JSON.stringify({ cmd: 'validate_blueprint', rows, seats } satisfies PCommand))) as PReply;
    const cost = new Map(this.bundle.materials.blocks.map((b) => [b.id, b.cost]));
    const blocks = bp.cells.filter((c) => c.kind !== 'nook' && c.kind !== 'kettle');
    return {
      ok: rep.ok, blocks: blocks.length, budget: 72, cost: blocks.reduce((a, c) => a + (cost.get(c.kind) ?? 0), 0),
      problems: rep.ok ? [] : [{ col: -1, row: -1, why: String(rep.detail ?? rep.reason ?? 'Not legal') }],
    };
  }

  // ---------- battle ----------
  newBattle(setup: BattleSetup): void {
    this.viewSetup = structuredClone(setup);
    const p = toProtocolSetup(setup, this.glyphs());
    this.setupJson = JSON.stringify(p);
    this.seed = BigInt(setup.seed >>> 0);
    this.start();
  }

  private start(): void {
    this.game?.free();
    this.game = new this.mod.Game('', this.setupJson, this.seed);
    this.last = undefined;
    this.events = [];
    this.chunks = [];
    this.think = 0;
    this.walkDir = 0;
    this.stats = [{ shots: 0, hits: 0, blocks: 0, kettle: 100 }, { shots: 0, hits: 0, blocks: 0, kettle: 100 }];
    this.best = undefined;
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
      case 'set_wind': return { ok: false, error: 'not_in_core' };
      case 'give_up': return { ok: false, error: 'not_in_core' };
    }
    const r = this.send(pc!);
    return r.ok ? { ok: true } : { ok: false, error: String(r.reason ?? 'refused') };
  }

  private walkStep(): CommandResult {
    const r = this.send({ cmd: 'walk', dx: this.walkDir * 4 });
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
    if (s.phase === 'plan' && s.mode === 'test_yard' && s.side === 1) { this.send({ cmd: 'pass' }); return; }
    if (s.phase === 'plan' && this.walkDir !== 0) {
      this.walkTicks += ticks;
      while (this.walkTicks >= 4 && (this.walkDir as number) !== 0) { this.walkTicks -= 4; this.walkStep(); }
      return;
    }
    this.game.step(ticks);
    this.pull();
  }

  /** Read a snapshot from the core, merge lean ones into the last full one, gather events and terrain. */
  private pull(): void {
    const raw = JSON.parse(this.game!.snapshot()) as PSnapshot;
    if (raw.full || !this.last) {
      if (this.last) this.lastCastles = this.last.castles;
      this.last = raw;
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

  private castleOf(side: number): PCastle | undefined {
    return this.last?.castles[side] ?? this.lastCastles?.[side];
  }

  private toView(e: PEvent): BattleEvent[] {
    const s = this.last!;
    const H = s.map.h;
    const hobAt = (id: number): [number, number] => { const h = s.hobs.find((x) => x.id === id); return h ? [h.x, H - h.y] : [0, 0]; };
    const slotAt = (side: number, c: number, r: number): [number, number] => {
      const cs = this.castleOf(side);
      return cs ? [cs.x + 16 * c + 8, H - (cs.base_y - 16 * (r + 1) + 8)] : [0, 0];
    };
    const n = (k: string) => Number(e[k] ?? 0);
    switch (e.t) {
      case 'turn_start': return [{ t: 'turn', side: n('side') as Side, round: n('round') }];
      case 'fire': {
        const side = n('side') as Side;
        const [x, y] = hobAt(n('hob'));
        this.stats[side].shots++;
        this.shotDmg = 0;
        const h = s.hobs.find((q) => q.id === n('hob'));
        this.shotBy = { side, hob: h?.name.split(' ')[0] ?? '', round: s.hud.round, angle: n('angle'), power: n('power') };
        return [{ t: 'fire', side, x, y: y + 10, kind: String(e.shot) }];
      }
      case 'explode': return [{ t: 'boom', x: n('x'), y: H - n('y'), r: n('r') }];
      case 'miss': return [{ t: 'hit', x: n('x'), y: H - n('y'), dmg: 0, what: 'ground' }];
      case 'hit': {
        const dmg = n('dmg');
        this.shotDmg += dmg;
        if (this.shotBy && (!this.best || this.shotDmg > this.best.dmg)) this.best = { ...this.shotBy, dmg: this.shotDmg };
        const tgt = String(e.target);
        if (this.shotBy && e.why !== 'crush' && e.why !== 'fall' && n('side') !== this.shotBy.side) this.stats[this.shotBy.side].hits++;
        if (tgt === 'hob') { const [x, y] = hobAt(n('hob')); return [{ t: 'hit', x, y: y + 26, dmg, what: 'hob' }]; }
        if (tgt === 'kettle') {
          const k = this.castleOf(n('side'))?.kettle;
          return [{ t: 'hit', x: k ? (k.box[0] + k.box[2]) / 2 : 0, y: k ? H - k.box[1] + 8 : 0, dmg, what: 'kettle' }];
        }
        if (tgt === 'block') { const [x, y] = slotAt(n('side'), n('c'), n('r')); return [{ t: 'hit', x, y: y + 8, dmg, what: 'block' }]; }
        return [{ t: 'hit', x: n('x'), y: H - n('y'), dmg, what: 'block' }];
      }
      case 'break': {
        const side = n('side');
        const [x, y] = slotAt(side, n('c'), n('r'));
        const mat = (this.castleOf(side)?.blocks.find((b) => b.c === n('c') && b.r === n('r'))?.mat ?? 'timber') as Material;
        if (this.shotBy && side !== this.shotBy.side) this.stats[this.shotBy.side].blocks++;
        return [{ t: 'break', x, y, mat }];
      }
      case 'collapse': {
        const blocks = (e.blocks as [number, number, string][]) ?? [];
        if (!blocks.length) return [];
        const [x, y] = slotAt(n('side'), blocks[0][0], blocks[0][1]);
        return [{ t: 'fall', count: blocks.length, x, y }];
      }
      case 'big_drop': {
        if (!e.callout) return [];
        const sh = this.shotBy;
        const f = sh ? this.castleOf(sh.side === 0 ? 1 : 0) : undefined;
        return [{ t: 'fall', count: Math.max(6, n('blocks')), x: f ? f.x + f.cols * 8 : 0, y: f ? H - f.base_y : 0 }];
      }
      case 'bonk': { const [x, y] = hobAt(n('hob')); return [{ t: 'bonk', hob: String(n('hob')), x, y }]; }
      case 'kettle_pop': return [{ t: 'kettle_pop', side: n('side') as Side }];
      case 'squall_warning': return [{ t: 'squall_warn', left: n('n') }];
      case 'squall_round': return [{ t: 'squall', n: n('n') }];
      case 'win': return [{ t: 'end', winner: n('winner') as Side, how: HOW[String(e.how)] ?? String(e.how) }];
      default: return [];
    }
  }

  snapshot(): Snapshot {
    const s = this.last!;
    const H = s.map.h;
    const hud = s.hud;
    const active = hud.side;
    const human = (side: number) => hud.control[side] === 'human' || s.mode === 'test_yard';
    const you: Side = this.viewSetup?.mode === 'duel' ? active : 0;
    const blocks: BlockView[] = [];
    for (const cs of s.castles) {
      const sh = new Set(cs.shimmer.map(([c, r]) => `${c},${r}`));
      for (const b of cs.blocks) blocks.push({ id: cs.side * 100000 + b.r * 100 + b.c, side: cs.side, x: b.x, y: H - (b.y + 16), size: 16, mat: b.mat as Material, hp: b.hp, maxHp: b.max, shimmer: sh.has(`${b.c},${b.r}`) });
    }
    const kettles = s.castles.map((cs) => {
      const [x0, y0, x1, y1] = cs.kettle.room;
      return { side: cs.side, x: x0, y: H - y1 - 1, size: x1 - x0 + 1, hp: cs.kettle.hp, maxHp: cs.kettle.max, room: { x: x0, y: H - y1 - 1, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
    });
    const hobs: HobView[] = s.hobs.map((h) => ({
      id: String(h.id), def: h.def, side: h.side, name: h.name.split(' ')[0], cls: (h.class === 'dummy' ? 'lobber' : h.class) as HobClass,
      x: h.x, y: H - h.y, hp: h.hp, maxHp: h.max, state: hobState(h), rest: h.rest,
    }));
    const shells = s.shells.map(([id, x, y, rot, shot]) => {
      const a = (rot / 10) * (Math.PI / 180);
      return { id, x, y: H - y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, kind: shot, side: active };
    });
    const nth = [0, 0];
    const pins: PinView[] = [];
    for (const g of s.ghosts) {
      const k = nth[g.side]++;
      if (!g.pin) continue;
      pins.push({ id: `${g.side}:${k}`, side: g.side, hob: String(g.hob), x: g.pin[0], y: H - g.pin[1], round: g.round, spent: g.recalled, angle: g.angle, power: g.power, path: g.points.map(([x, y]) => [x, H - y] as [number, number]), windAt: hud.wind });
    }
    const sel = s.hobs.find((h) => h.id === hud.selected.hob && h.side === active);
    const shotName = (id: string) => this.bundle.shots.find((x) => x.id === id);
    const chips: ShotChip[] = [];
    if (sel) {
      const ready = sel.can_fire && s.phase === 'plan';
      chips.push({ id: 'plain', name: shotName(sel.plain)?.name ?? 'Plain', icon: sel.plain, kind: 'plain', uses: -1, weight: 0, best: sel.class as HobClass, ready });
      if (sel.knack) chips.push({ id: 'knack', name: shotName(sel.knack)?.name ?? 'Knack', icon: sel.knack, kind: 'knack', uses: sel.knack_uses, weight: weightOf(shotName(sel.knack)?.weight), best: sel.class as HobClass, ready: ready && sel.knack_uses > 0 && sel.rest === 0, why: sel.rest > 0 ? 'Needs a rest' : undefined });
      for (const t of hud.hands[active] ?? []) chips.push({ id: t.id, name: t.name ?? t.id, icon: t.id, kind: 'shell', uses: 1, weight: weightOf(t.weight), best: (t.match ?? undefined) as HobClass | undefined, ready: ready && sel.rest === 0 });
    }
    const plan = s.phase === 'plan';
    const aim = sel && human(active) ? { ...sel.aim } : undefined;
    const fire: Snapshot['hud']['fire'] = s.phase === 'resolve' || s.phase === 'settle'
      ? (s.shells.length ? 'flight' : 'fast')
      : plan && human(active) ? (sel?.buried ? 'dug' : sel?.can_fire && (aim?.power ?? 0) > 0 ? 'ready' : 'locked') : 'flight';
    const level = this.viewSetup?.level ?? '';
    const lvlN = Number(level.split('-')[1] ?? 99);
    let draft: DraftView | undefined;
    if (s.draft) {
      const all = [...s.draft.picks[0], ...s.draft.picks[1], ...s.draft.pool];
      draft = {
        pool: all.map((id) => {
          const d = shotName(id);
          const owner = s.draft!.picks[0].includes(id) ? 0 : s.draft!.picks[1].includes(id) ? 1 : undefined;
          const card = d?.card;
          return { id, name: d?.name ?? id, weight: weightOf(d?.weight), best: d?.match_class as HobClass | undefined, hint: typeof card === 'string' ? card : card?.line ?? '', dud: d?.dud, owner };
        }),
        picks: [[...s.draft.picks[0]], [...s.draft.picks[1]]], perSide: s.draft.picks_each, turn: s.draft.next,
        wish: s.draft.wish ?? undefined, done: s.phase !== 'draft',
      };
    }
    let result: ResultView | undefined;
    if (s.result) {
      this.stats[0].kettle = hud.kettle_pct[0];
      this.stats[1].kettle = hud.kettle_pct[1];
      const win = s.result.winner === 0;
      result = {
        winner: s.result.winner, how: HOW[s.result.how] ?? s.result.how, pennants: s.result.pennants,
        goals: this.levels().find((l) => l.id === level)?.goals ?? [], buttons: win ? 250 : 40,
        stats: [{ ...this.stats[0] }, { ...this.stats[1] }], bestShot: this.best,
        cause: !win ? (hud.kettle_pct[0] < 30 ? 'The kettle sat one block in.' : 'A close one. Nothing broke first.') : undefined,
      };
    }
    const forts = s.castles.map((cs) => ({ x: cs.x, y: H - cs.base_y, w: cs.cols * 16, h: cs.rows * 16 })) as Snapshot['forts'];
    const out: Snapshot = {
      tick: s.tick,
      phase: s.phase === 'draft' ? 'draft' : s.phase === 'ended' ? 'over' : s.phase === 'plan' ? (human(active) ? 'plan' : 'rival') : s.shells.length ? 'flight' : 'resolve',
      mode: this.viewSetup?.mode ?? 'campaign',
      round: hud.round, roundCap: hud.round_cap,
      squall: { warn: hud.squall_warning ?? 0, on: hud.squall_round },
      wind: hud.wind, forecast: hud.forecast,
      sides: [0, 1].map((i) => ({ name: hud.names[i] || (this.viewSetup?.sides[i].name ?? ''), human: human(i), help: this.viewSetup?.sides[i].help ?? 'none' })) as Snapshot['sides'],
      terrain: { width: s.map.w, height: H, chunk: s.map.chunk, chunks: this.chunks },
      blocks, kettles, hobs, shells, pins, forts,
      events: this.events,
      hud: {
        active, you, steam: hud.steam[active], steamMax: 100, steamTurn: hud.steam_turn_left,
        hob: sel ? String(sel.id) : undefined, shot: hud.selected.shot, aim,
        shots: chips, preview: plan ? s.preview.map(([x, y]) => [x, H - y] as [number, number]) : [],
        fire, canWalk: plan && human(active) && hud.steam_turn_left > 0 && (this.viewSetup?.mode !== 'campaign' || lvlN >= 9),
        thinking: plan && s.awaiting === 'ai',
      },
      draft, result,
    };
    this.events = [];
    this.chunks = [];
    return out;
  }

  saveBattle(): string {
    const log = this.game ? (JSON.parse(this.game.command(JSON.stringify({ cmd: 'log' }))) as { log: PCommand[] }).log : [];
    return JSON.stringify({ v: 1, core: 'wasm', setup: this.setupJson, seed: String(this.seed), view: this.viewSetup, log });
  }

  /** Replay the log: each command applies once the sim is back in a waiting phase. */
  loadBattle(data: string): void {
    const d = JSON.parse(data) as { setup: string; seed: string; view: BattleSetup; log: PCommand[] };
    this.viewSetup = d.view;
    this.setupJson = d.setup;
    this.seed = BigInt(d.seed);
    this.start();
    const g = this.game!;
    const settle = () => { for (let i = 0; i < 200; i++) { const st = JSON.parse(g.step(2000)) as { phase: string }; if (st.phase !== 'resolve' && st.phase !== 'settle') break; } };
    for (const c of d.log) { settle(); g.command(JSON.stringify(c)); }
    settle();
    g.snapshot(); // drop the replay's events
    g.command(JSON.stringify({ cmd: 'terrain_all' }));
    this.last = undefined;
    this.events = [];
    this.chunks = [];
    this.pull();
    this.events = [];
  }
}

function hobState(h: PHob): HobView['state'] {
  if (h.state === 'bonked' || h.state === 'squashed') return 'bonked';
  if (h.buried) return 'dug';
  if (h.rest > 0) return 'rest';
  if (h.state === 'tumbled' || h.state === 'dropped') return 'tumbled';
  return 'ready';
}

function weightOf(w: unknown): 0 | 1 | 2 {
  if (typeof w === 'number') return Math.max(0, Math.min(2, w)) as 0 | 1 | 2;
  return WEIGHT[String(w ?? 'light').toLowerCase()] ?? 0;
}

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const MAP_LEVEL: Record<string, string> = { 'two-tumps': 'd1', 'long-dip': 'd2', 'knoll-hop': 'd1' };

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
    if (v.help === 'some') cfg.steam = 120;
    if (v.help === 'lots') cfg.steam = 140;
    return cfg;
  };
  const p: PSetup = {
    level: s.level ?? MAP_LEVEL[s.map ?? ''] ?? 'd1',
    mode: s.mode === 'duel' ? 'couch' : s.mode === 'yard' ? 'test_yard' : s.mode,
    sides: [side(0), side(1)],
  };
  if (s.mode === 'campaign') p.sides = [{ ...side(0), control: 'human' }, { control: 'ai', preset: s.difficulty }];
  if (s.first !== undefined) p.first_turn = s.first;
  if (s.roundCap) p.round_cap = s.roundCap;
  if (s.windOff || s.wind === 'off') p.wind = { min: 0, max: 0 };
  else if (s.wind === 'light') p.wind = { min: 0, max: 3 };
  else if (s.wind === 'full') p.wind = { min: 0, max: 6 };
  if (s.mode !== 'campaign' && s.shells) p.rummage = s.shells === 'plain' ? { pool: 0, picks: 0 } : { pool: 6, picks: 2 };
  return p;
}

