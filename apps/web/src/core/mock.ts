// MockCore: a stand-in that returns plausible snapshots until castle-wasm lands.
// It is NOT the rules. Numbers are rough, physics is simple, and the real core
// (core/castle-wasm) replaces it as soon as its pkg is present. Do not tune gameplay here.
import {
  DEFAULT_BLUEPRINT, HOBS, KNACK, LEVELS, PLAIN, SHELLS, STARTER_FORTS, levelFort, type ShellDef,
} from './content';
import type {
  BattleEvent, BattleSetup, Blueprint, BlueprintCheck, BlockView, Command, CommandResult, CoreApi,
  DraftView, HobClass, HobView, KettleView, Material, PinView, ShellView, ShotChip, Side, Snapshot, TerrainChunk,
} from './types';

const W = 2400;
const H = 720;
const CH = 64;
const B = 16;
const G = 600;
const HZ = 120;
const SPEED = 10.5;
const HP: Record<Material, number> = { wicker: 30, timber: 50, cobble: 80, brassbound: 110, footing: 400 };
const COST: Record<Material, number> = { wicker: 5, timber: 15, cobble: 35, brassbound: 70, footing: 0 };

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Hob extends HobView { facing: 1 | -1; shots: Map<string, number>; lastAim?: { angle: number; power: number } }
interface Block extends BlockView { vy: number }
interface Shell extends ShellView { def: Fly; hob: string; path: [number, number][]; split?: number; apex: boolean; aim: { angle: number; power: number } }
interface Fly { radius: number; dmg: number; grav: number; dig: number; kettleX: number; split: number; dud: boolean; name: string }

type Logged = { tick: number; c: Command };

export class MockCore implements CoreApi {
  readonly name = 'mock';
  readonly version = 'mock-0.1';
  private setup!: BattleSetup;
  private rand = rng(1);
  private tick = 0;
  private mask = new Uint8Array(W * H);
  private chunkRev: number[] = [];
  private sentRev: number[] = [];
  private blocks: Block[] = [];
  private kettles: KettleView[] = [];
  private crew: Hob[] = [];
  private shells: Shell[] = [];
  private pins: PinView[] = [];
  private events: BattleEvent[] = [];
  private phase: Snapshot['phase'] = 'plan';
  private active: Side = 0;
  private round = 1;
  private roundCap = 15;
  private wind = 0;
  private forecast = 0;
  private steam: [number, number] = [100, 100];
  private steamTurn = 40;
  private walkDir: -1 | 0 | 1 = 0;
  private picked: [string | undefined, string | undefined] = [undefined, undefined];
  private shot: [string, string] = ['plain', 'plain'];
  private hand: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
  private timer = 0;
  private nextId = 1;
  private draft?: DraftView;
  private forts: Snapshot['forts'] = [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }];
  private result?: Snapshot['result'];
  private stats = [{ shots: 0, hits: 0, blocks: 0, kettle: 100 }, { shots: 0, hits: 0, blocks: 0, kettle: 100 }];
  private hitStreak = [0, 0];
  private best?: NonNullable<Snapshot['result']>['bestShot'];
  private shotDmg = 0;
  private fullPreviewShots = 0;
  private log: Logged[] = [];
  private replaying = false;
  private squallOn = 0;

  levels() { return LEVELS; }
  hobs() { return HOBS; }
  starterForts() { return STARTER_FORTS; }

  checkBlueprint(bp: Blueprint): BlueprintCheck {
    const problems: BlueprintCheck['problems'] = [];
    const at = new Map(bp.cells.map((c) => [`${c.col},${c.row}`, c]));
    let blocks = 0;
    let cost = 0;
    let kettle = 0;
    let nooks = 0;
    for (const c of bp.cells) {
      if (c.kind === 'kettle') kettle++;
      else if (c.kind === 'nook') nooks++;
      else { blocks++; cost += COST[c.kind]; }
      if (c.row > 0 && c.kind !== 'kettle' && !at.has(`${c.col},${c.row - 1}`)) problems.push({ col: c.col, row: c.row, why: 'No support' });
    }
    if (kettle !== 4) problems.push({ col: 0, row: 0, why: 'Needs one kettle room' });
    if (nooks < 1) problems.push({ col: 0, row: 0, why: 'Needs a Nook' });
    if (blocks > 72) problems.push({ col: 0, row: 0, why: 'Over budget' });
    return { ok: problems.length === 0, blocks, budget: 72, cost, problems };
  }

  // ---------- setup ----------
  newBattle(setup: BattleSetup): void {
    this.setup = JSON.parse(JSON.stringify(setup));
    this.log = [];
    this.reset();
  }

  private reset(): void {
    const s = this.setup;
    this.rand = rng(s.seed || 1);
    this.tick = 0;
    this.nextId = 1;
    this.blocks = [];
    this.kettles = [];
    this.crew = [];
    this.shells = [];
    this.pins = [];
    this.events = [];
    this.result = undefined;
    this.best = undefined;
    this.stats = [{ shots: 0, hits: 0, blocks: 0, kettle: 100 }, { shots: 0, hits: 0, blocks: 0, kettle: 100 }];
    this.hitStreak = [0, 0];
    this.round = 1;
    this.squallOn = 0;
    this.active = 0;
    this.steam = [100, 100];
    this.hand = [new Map(), new Map()];
    const lvl = LEVELS.find((l) => l.id === s.level);
    this.roundCap = s.roundCap ?? lvl?.roundCap ?? 15;
    const windy = !s.windOff && s.wind !== 'off' && !(lvl && Number(lvl.id.split('-')[1]) <= 3);
    const wmax = s.wind === 'full' ? 6 : lvl ? Math.min(3, Number(lvl.id.split('-')[1]) >= 4 ? 2 : 0) : 3;
    this.wind = windy ? Math.round((this.rand() * 2 - 1) * wmax) : 0;
    this.forecast = windy ? Math.round((this.rand() * 2 - 1) * wmax) : 0;
    this.fullPreviewShots = s.level === '1-1' ? 1 : 0;
    this.buildTerrain();
    const left = s.sides[0].blueprint ?? DEFAULT_BLUEPRINT;
    const right = s.mode === 'campaign' ? levelFort(s.level ?? '1-1') : s.sides[1].blueprint ?? STARTER_FORTS[0];
    this.placeFort(0, left, 560, s.sides[0].crew);
    const rivalCrew = s.mode === 'campaign' ? (lvl?.rivalCrew ?? ['lobber']).map((c, i) => `rival_${c}_${i}`) : s.mode === 'yard' ? [] : s.sides[1].crew;
    this.placeFort(1, right, 1760, rivalCrew);
    if (s.mode === 'yard') this.wind = 0;
    const needDraft = s.shells === 'draft' || (s.mode === 'campaign' && lvl?.draft);
    if (needDraft) {
      const size = s.mode === 'campaign' ? 4 : 6;
      const pool = [...SHELLS].sort(() => this.rand() - 0.5).slice(0, size);
      this.draft = { pool: pool.map((d) => ({ id: d.id, name: d.name, weight: d.weight, best: d.best, hint: d.hint, dud: d.dud })), picks: [[], []], perSide: 2, turn: 0, done: false };
      this.updateWish();
      this.phase = 'draft';
    } else {
      this.draft = undefined;
      if (s.shells === 'quick') for (const side of [0, 1] as Side[]) for (const d of SHELLS.filter((x) => !x.dud).sort(() => this.rand() - 0.5).slice(0, 2)) this.hand[side].set(d.id, 1);
      this.startTurn(s.first ?? 0);
    }
    if (s.mode === 'yard') for (const d of SHELLS) this.hand[0].set(d.id, -1);
  }

  private buildTerrain(): void {
    const r = this.rand;
    const a1 = 20 + r() * 30, a2 = 10 + r() * 20, p1 = r() * 6, p2 = r() * 6;
    const hill = 60 + r() * 90;
    this.mask.fill(0);
    for (let x = 0; x < W; x++) {
      let h = 200 + a1 * Math.sin(x / 260 + p1) + a2 * Math.sin(x / 90 + p2);
      h += hill * Math.exp(-(((x - W / 2) / 260) ** 2));
      if (Math.abs(x - 600) < 130) h = 230;
      if (Math.abs(x - 1800) < 130) h = 230 - 40 * (this.setup.level === '1-1' ? 1 : 0);
      const top = Math.max(20, Math.min(H - 100, Math.round(h)));
      for (let y = 0; y < top; y++) this.mask[y * W + x] = 1;
    }
    const n = (W / CH) * Math.ceil(H / CH);
    this.chunkRev = new Array(n).fill(1);
    this.sentRev = new Array(n).fill(0);
  }

  private groundAt(x: number): number {
    const xi = Math.max(0, Math.min(W - 1, Math.round(x)));
    for (let y = H - 1; y >= 0; y--) if (this.mask[y * W + xi]) return y + 1;
    return 0;
  }

  private placeFort(side: Side, bp: Blueprint, cx: number, crew: string[]): void {
    const w = bp.cols * B;
    const x0 = Math.round(cx - w / 2);
    const gy = this.groundAt(cx);
    // Footing row
    for (let c = 0; c < bp.cols; c++) this.addBlock(side, x0 + c * B, gy, 'footing');
    const colX = (c: number) => (side === 0 ? x0 + c * B : x0 + (bp.cols - 1 - c) * B);
    const base = gy + B;
    const kettleCells = bp.cells.filter((c) => c.kind === 'kettle');
    if (kettleCells.length) {
      const kx = Math.min(...kettleCells.map((c) => colX(c.col)));
      const ky = base + Math.min(...kettleCells.map((c) => c.row)) * B;
      const hp = 300 * (this.setup.sides[side].help === 'lots' ? 1.5 : this.setup.sides[side].help === 'some' ? 1.25 : 1);
      this.kettles.push({ side, x: kx, y: ky, size: 32, hp, maxHp: hp });
    }
    const nooks = bp.cells.filter((c) => c.kind === 'nook').sort((a, b) => b.row - a.row);
    for (const c of bp.cells) if (c.kind !== 'nook' && c.kind !== 'kettle') this.addBlock(side, colX(c.col), base + c.row * B, c.kind);
    crew.slice(0, Math.max(1, nooks.length)).forEach((id, i) => {
      const nook = nooks[i];
      const info = HOBS.find((h) => h.id === id);
      const cls = (info?.cls ?? (id.split('_')[1] as HobClass)) || 'lobber';
      const hp = info?.hp ?? PLAIN_HP[cls];
      const hx = nook ? colX(nook.col) + B / 2 : x0 + w / 2;
      const hy = nook ? base + nook.row * B : base + bp.rows * B;
      const shots = new Map<string, number>([['plain', -1], ['knack', this.setup.mode === 'yard' ? -1 : 2]]);
      this.crew.push({
        id: side === 1 && this.setup.mode === 'duel' ? `p2_${id}` : id,
        side, name: info?.name ?? RIVAL_NAMES[cls], cls, x: hx, y: hy, hp, maxHp: hp, state: 'ready', rest: 0,
        facing: side === 0 ? 1 : -1, shots,
      });
    });
    this.forts[side] = { x: x0, y: gy, w, h: (bp.rows + 1) * B };
  }

  private addBlock(side: Side, x: number, y: number, mat: Material): void {
    this.blocks.push({ id: this.nextId++, side, x, y, size: B, mat, hp: HP[mat], maxHp: HP[mat], vy: 0 });
  }

  // ---------- commands ----------
  command(c: Command): CommandResult {
    const r = this.apply(c);
    if (r.ok && !this.replaying) this.log.push({ tick: this.tick, c });
    return r;
  }

  private human(side: Side) { return this.setup.sides[side].human || this.setup.mode === 'yard'; }

  private apply(c: Command): CommandResult {
    const side = this.active;
    switch (c.cmd) {
      case 'pick_shell': return this.draftPick(0 as Side, c.id);
      case 'quick_pick': this.finishDraft(); return { ok: true };
      case 'end_draft': this.finishDraft(); return { ok: true };
      case 'give_up':
        this.end(side === 0 ? 1 : 0, 'Give Up');
        return { ok: true };
      case 'set_wind':
        if (this.setup.mode !== 'yard') return { ok: false, error: 'yard only' };
        this.wind = Math.max(-10, Math.min(10, Math.round(c.wind)));
        return { ok: true };
      case 'fast': return { ok: true };
    }
    if (this.phase !== 'plan' || !this.human(side)) return { ok: false, error: 'not your turn' };
    switch (c.cmd) {
      case 'aim': {
        const h = this.hob(this.picked[side]);
        if (!h) return { ok: false, error: 'no hob' };
        h.lastAim = { angle: clamp(Math.round(c.angle), 0, 1800), power: clamp(Math.round(c.power), 0, 100) };
        return { ok: true };
      }
      case 'pick_hob': {
        const h = this.hob(c.id);
        if (!h || h.side !== side || h.state === 'bonked') return { ok: false, error: 'bad hob' };
        this.picked[side] = h.id;
        if (!this.shotUsable(h, this.shot[side])) this.shot[side] = 'plain';
        return { ok: true };
      }
      case 'pick_shot': {
        const h = this.hob(this.picked[side]);
        if (!h) return { ok: false, error: 'no hob' };
        this.shot[side] = c.id;
        return { ok: true };
      }
      case 'recall': {
        const p = this.pins.find((x) => x.id === c.pin);
        if (!p || p.side !== side || p.spent) return { ok: false, error: 'pin' };
        const h = this.hob(p.hob);
        if (!h || h.state === 'bonked') return { ok: false, error: 'hob' };
        this.picked[side] = h.id;
        h.lastAim = { angle: p.angle, power: p.power };
        return { ok: true };
      }
      case 'walk':
        if (!this.canWalk()) return { ok: false, error: 'no walk' };
        this.walkDir = c.dir;
        return { ok: true };
      case 'fire': return this.fire(side);
    }
    return { ok: false, error: 'unknown' };
  }

  private canWalk(): boolean {
    if (this.setup.mode !== 'campaign') return true;
    return Number((this.setup.level ?? '1-1').split('-')[1]) >= 9;
  }

  private hob(id?: string) { return this.crew.find((h) => h.id === id); }

  private shotUsable(h: Hob, id: string): boolean {
    if (h.state === 'bonked' || h.rest > 0) return false;
    if (id === 'plain') return true;
    if (id === 'knack') return (h.shots.get('knack') ?? 0) !== 0 && this.knackOpen();
    const n = this.hand[h.side].get(id) ?? 0;
    return n !== 0;
  }

  private knackOpen(): boolean {
    if (this.setup.mode !== 'campaign') return true;
    return Number((this.setup.level ?? '1-1').split('-')[1]) >= 5;
  }

  private flyFor(h: Hob, id: string): Fly {
    if (id === 'plain') { const p = PLAIN[h.cls]; return { radius: p.radius, dmg: p.dmg, grav: p.grav ?? 1, dig: 0, kettleX: 1, split: 0, dud: false, name: p.name }; }
    if (id === 'knack') { const k = KNACK[h.cls]; return { radius: k.radius, dmg: k.dmg, grav: k.grav ?? 1, dig: 0, kettleX: 1, split: k.split ?? 0, dud: false, name: k.name }; }
    const d = SHELLS.find((s) => s.id === id) as ShellDef;
    const m = d.best === h.cls ? 1.1 : 1;
    return { radius: d.radius, dmg: d.dmg * m, grav: d.grav ?? 1, dig: d.dig ?? 0, kettleX: d.kettleX ?? 1, split: d.split ?? 0, dud: !!d.dud, name: d.name };
  }

  private weightOf(h: Hob, id: string): number {
    if (id === 'plain') return 0;
    if (id === 'knack') return 1;
    const d = SHELLS.find((s) => s.id === id);
    if (!d) return 0;
    return d.best === h.cls ? 0 : d.weight;
  }

  private origin(h: Hob): [number, number] { return [h.x + h.facing * 8, h.y + 10]; }

  private fire(side: Side): CommandResult {
    const h = this.hob(this.picked[side]);
    if (!h || !h.lastAim) return { ok: false, error: 'no aim' };
    const id = this.shot[side];
    if (!this.shotUsable(h, id)) return { ok: false, error: 'shot not ready' };
    this.launch(h, id, h.lastAim);
    return { ok: true };
  }

  private launch(h: Hob, id: string, aim: { angle: number; power: number }): void {
    const side = h.side;
    const def = this.flyFor(h, id);
    const [ox, oy] = this.origin(h);
    const a = (aim.angle / 10) * (Math.PI / 180);
    const v = aim.power * SPEED * (this.setup.mode === 'yard' ? 1 : 1);
    this.shells.push({ id: this.nextId++, x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind: id === 'plain' || id === 'knack' ? PLAIN[h.cls].id : id, side, def, hob: h.id, path: [[ox, oy]], apex: false, aim: { ...aim } });
    if (id !== 'plain') {
      const m = id === 'knack' ? h.shots : this.hand[side];
      const n = m.get(id) ?? 0;
      if (n > 0) m.set(id, n - 1);
    }
    h.rest = this.weightOf(h, id) > 0 ? 1 : 0;
    const pin = this.pins.find((p) => p.hob === h.id && !p.spent && p.angle === aim.angle && p.power === aim.power);
    if (pin) pin.spent = true;
    this.stats[side].shots++;
    this.shotDmg = 0;
    this.events.push({ t: 'fire', side, x: ox, y: oy, kind: id });
    this.phase = 'flight';
    this.walkDir = 0;
    if (this.fullPreviewShots > 0 && side === 0) this.fullPreviewShots--;
  }

  // ---------- draft ----------
  private draftPick(side: Side, id: string): CommandResult {
    const d = this.draft;
    if (!d || d.done || d.turn !== side) return { ok: false, error: 'draft' };
    const chip = d.pool.find((p) => p.id === id && p.owner === undefined);
    if (!chip) return { ok: false, error: 'taken' };
    chip.owner = side;
    d.picks[side].push(id);
    if (this.setup.mode === 'duel' && this.human(1)) {
      d.turn = side === 0 ? 1 : 0;
      if (d.picks[d.turn].length >= d.perSide) d.turn = side;
    } else if (d.picks[1].length < d.perSide) {
      const want = d.wish && d.pool.find((p) => p.id === d.wish && p.owner === undefined) ? d.wish : d.pool.find((p) => p.owner === undefined)?.id;
      if (want) { d.pool.find((p) => p.id === want)!.owner = 1; d.picks[1].push(want); }
    }
    this.updateWish();
    if (d.picks[0].length >= d.perSide && d.picks[1].length >= d.perSide) this.closeDraft();
    return { ok: true };
  }

  private updateWish(): void {
    const d = this.draft;
    if (!d) return;
    const free = d.pool.filter((p) => p.owner === undefined && !p.dud).sort((a, b) => b.weight - a.weight);
    d.wish = free[0]?.id;
  }

  private finishDraft(): void {
    const d = this.draft;
    if (!d || d.done) return;
    let guard = 20;
    while (!d.done && guard-- > 0) {
      const side = d.turn;
      const free = d.pool.filter((p) => p.owner === undefined && !(side === 0 && p.dud));
      const pick = free[0] ?? d.pool.find((p) => p.owner === undefined);
      if (!pick) { this.closeDraft(); break; }
      this.draftPick(side, pick.id);
    }
  }

  private closeDraft(): void {
    const d = this.draft!;
    d.done = true;
    for (const s of [0, 1] as Side[]) for (const id of d.picks[s]) this.hand[s].set(id, 1);
    this.startTurn(this.setup.first ?? 0);
  }

  // ---------- turn flow ----------
  private startTurn(side: Side): void {
    this.active = side;
    this.steamTurn = Math.min(40, this.steam[side]);
    for (const h of this.crew) if (h.side === side && h.rest > 0 && h.state !== 'bonked') { h.rest--; }
    for (const h of this.crew) if (h.side === side) h.state = h.state === 'bonked' ? 'bonked' : h.rest > 0 ? 'rest' : 'ready';
    const cur = this.hob(this.picked[side]);
    if (!cur || cur.state !== 'ready') this.picked[side] = this.crew.find((h) => h.side === side && h.state === 'ready')?.id ?? this.crew.find((h) => h.side === side && h.state !== 'bonked')?.id;
    const p = this.hob(this.picked[side]);
    if (p && !this.shotUsable(p, this.shot[side])) this.shot[side] = 'plain';
    if (p && !p.lastAim && this.human(side)) p.lastAim = { angle: side === 0 ? 450 : 1350, power: 0 };
    this.phase = this.human(side) ? 'plan' : 'rival';
    this.timer = 0;
    this.events.push({ t: 'turn', side, round: this.round });
    if (this.setup.mode === 'yard') this.active = 0;
  }

  private endTurn(): void {
    if (this.result) return;
    if (this.checkWin()) return;
    if (this.setup.mode === 'yard') { this.startTurn(0); return; }
    const next: Side = this.active === 0 ? 1 : 0;
    if (next === (this.setup.first ?? 0)) {
      // round end
      if (this.squallOn > 0) {
        const n = this.squallOn;
        for (const k of this.kettles) k.hp = Math.max(0, k.hp - 50 * n);
        for (const b of this.blocks) if (b.mat !== 'footing') b.hp -= 10 * n;
        this.blocks = this.blocks.filter((b) => b.hp > 0);
        this.settle();
        if (this.checkWin()) return;
        if (n >= 3) {
          const tot = (s: Side) => this.kettles.filter((k) => k.side === s).reduce((a, k) => a + k.hp, 0) + this.crew.filter((h) => h.side === s).reduce((a, h) => a + h.hp, 0);
          this.end(tot(0) >= tot(1) ? 0 : 1, 'Sudden Squall');
          return;
        }
      }
      if (this.setup.level === '1-1' && this.round >= this.roundCap) { this.end(0, 'Doze Off'); return; }
      this.round++;
      if (this.round % 3 === 1) { this.wind = this.forecast; this.forecast = this.setup.windOff || this.setup.wind === 'off' ? 0 : clamp(Math.round(this.wind + (this.rand() * 4 - 2)), -3, 3); }
      const left = this.roundCap + 1 - this.round;
      if (this.setup.level !== '1-1' && left > 0 && left <= 3) this.events.push({ t: 'squall_warn', left });
      if (this.round > this.roundCap && this.setup.level !== '1-1') {
        this.squallOn = this.round - this.roundCap;
        this.wind = clamp(this.wind + Math.sign(this.wind || 1) * 3, -10, 10);
        this.events.push({ t: 'squall', n: this.squallOn });
      }
    }
    this.startTurn(next);
  }

  private checkWin(): boolean {
    for (const s of [0, 1] as Side[]) {
      const other: Side = s === 0 ? 1 : 0;
      const k = this.kettles.find((x) => x.side === other);
      const crew = this.crew.filter((h) => h.side === other);
      if (this.setup.mode === 'yard') continue;
      if (k && k.hp <= 0) { this.events.push({ t: 'kettle_pop', side: other }); this.end(s, 'Kettle Pop'); return true; }
      if (crew.length && crew.every((h) => h.state === 'bonked')) { this.end(s, 'Clean Sweep'); return true; }
    }
    return false;
  }

  private end(winner: Side, how: string): void {
    this.phase = 'over';
    for (const s of [0, 1] as Side[]) {
      const k = this.kettles.find((x) => x.side === s);
      this.stats[s].kettle = k ? Math.round((100 * k.hp) / k.maxHp) : 0;
    }
    const lvl = LEVELS.find((l) => l.id === this.setup.level);
    const win = winner === 0;
    const pennants = this.setup.mode === 'campaign'
      ? [win, win && (how === 'Kettle Pop' || this.round <= Math.ceil(this.roundCap * 0.6) || this.hitStreak[0] >= 2), win && this.stats[0].kettle > 50]
      : [];
    const cause = !win && this.setup.mode === 'campaign' ? (this.stats[0].kettle < 30 ? 'The kettle sat one block in.' : 'A close one. Nothing broke first.') : undefined;
    this.result = {
      winner, how, pennants, goals: lvl ? [...lvl.goals] : [], buttons: win ? 250 : 40,
      stats: [this.stats[0], this.stats[1]], bestShot: this.best, cause,
    };
    this.events.push({ t: 'end', winner, how });
  }

  // ---------- sim step ----------
  step(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.tick1();
  }

  private tick1(): void {
    this.tick++;
    if (this.phase === 'over' || this.phase === 'draft') return;
    if (this.phase === 'plan' && this.walkDir !== 0) this.walkTick();
    if (this.phase === 'rival') {
      this.timer++;
      if (this.timer === Math.round(HZ * 1.1)) this.aiFire();
    }
    if (this.phase === 'flight') {
      for (const s of [...this.shells]) this.moveShell(s);
      this.fallTick();
      if (this.shells.length === 0) { this.phase = 'resolve'; this.timer = 0; }
    } else if (this.phase === 'resolve') {
      this.timer++;
      const moving = this.fallTick();
      if (!moving && this.timer > HZ * 0.7) this.endTurn();
    }
  }

  private walkTick(): void {
    const side = this.active;
    if (this.tick % 3 !== 0) return;
    if (this.steamTurn <= 0 || this.steam[side] <= 0) { this.walkDir = 0; return; }
    const f = this.forts[side];
    const nx = f.x + this.walkDir * 2;
    if (nx < 40 || nx + f.w > W - 40) { this.walkDir = 0; return; }
    const other = this.forts[side === 0 ? 1 : 0];
    if (nx < other.x + other.w + 60 && nx + f.w > other.x - 60) { this.walkDir = 0; return; }
    const ny = this.groundAt(nx + f.w / 2);
    const dx = nx - f.x;
    const dy = ny - f.y;
    if (Math.abs(dy) > 24) { this.walkDir = 0; return; }
    for (const b of this.blocks) if (b.side === side) { b.x += dx; b.y += dy; }
    for (const k of this.kettles) if (k.side === side) { k.x += dx; k.y += dy; }
    for (const h of this.crew) if (h.side === side) { h.x += dx; h.y += dy; }
    f.x = nx; f.y = ny;
    this.steamTurn -= 1;
    this.steam[side] -= 1;
  }

  private solidAt(x: number, y: number): boolean {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) return false;
    return this.mask[yi * W + xi] === 1;
  }

  private moveShell(s: Shell): void {
    const dt = 1 / HZ;
    s.vx += this.wind * 10 * dt;
    s.vy -= G * s.def.grav * dt;
    const steps = 3;
    for (let k = 0; k < steps; k++) {
      s.x += (s.vx * dt) / steps;
      s.y += (s.vy * dt) / steps;
      if (s.x < -100 || s.x > W + 100 || s.y < -50) { this.removeShell(s); return; }
      if (this.hitTest(s.x, s.y, s.side, true)) { this.explode(s); return; }
    }
    if (this.tick % 4 === 0) s.path.push([s.x, s.y]);
    if (!s.apex && s.vy < 0) {
      s.apex = true;
      if (s.def.split > 1) {
        for (let i = 0; i < s.def.split; i++) {
          const spread = (i - (s.def.split - 1) / 2) * 45;
          const def = { ...s.def, split: 0 };
          this.shells.push({ ...s, id: this.nextId++, vx: s.vx + spread, def, path: [...s.path], apex: true });
        }
        this.removeShell(s, true);
      }
    }
  }

  private hitTest(x: number, y: number, side: Side, _own: boolean): boolean {
    if (this.solidAt(x, y)) return true;
    for (const b of this.blocks) if (x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size) {
      // own shells pass their own fort near the launch point
      if (b.side === side) return this.distToOrigin(x, y, side) > 40;
      return true;
    }
    for (const k of this.kettles) if (k.side !== side && x >= k.x && x < k.x + k.size && y >= k.y && y < k.y + k.size) return true;
    for (const h of this.crew) if (h.side !== side && h.state !== 'bonked' && Math.abs(x - h.x) < 7 && y >= h.y && y < h.y + 22) return true;
    return false;
  }

  private distToOrigin(x: number, y: number, side: Side): number {
    const h = this.hob(this.picked[side]);
    if (!h) return 999;
    const [ox, oy] = this.origin(h);
    return Math.hypot(x - ox, y - oy);
  }

  private removeShell(s: Shell, silent = false): void {
    this.shells = this.shells.filter((x) => x !== s);
    if (silent || this.shells.some((o) => o.hob === s.hob)) return;
    this.addPin(s, clamp(s.x, 0, W), Math.max(0, s.y));
    this.hitStreak[s.side] = 0;
  }

  private addPin(s: Shell, x: number, y: number): void {
    const mine = this.pins.filter((p) => p.hob === s.hob);
    if (mine.length >= 2) this.pins = this.pins.filter((p) => p !== mine[0]);
    this.pins.push({ id: `pin${this.nextId++}`, side: s.side, hob: s.hob, x, y, round: this.round, spent: false, angle: s.aim.angle, power: s.aim.power, path: s.path.filter((_, i) => i % 2 === 0).concat([[x, y]]), windAt: this.wind });
  }

  private explode(s: Shell): void {
    const { x, y } = s;
    const r = s.def.radius;
    let total = 0;
    let broke = 0;
    let hitThing = false;
    if (!s.def.dud) {
      for (const b of this.blocks) {
        if (b.mat === 'footing') continue;
        const d = Math.hypot(b.x + 8 - x, b.y + 8 - y);
        if (d > r + 8) continue;
        let dmg = s.def.dmg * (1 - Math.min(1, d / (r + 8)) * 0.5);
        if (b.side === s.side) dmg *= 0.5;
        b.hp -= dmg;
        total += dmg;
        hitThing = true;
        if (b.hp <= 0) { broke++; this.events.push({ t: 'break', x: b.x + 8, y: b.y + 8, mat: b.mat }); }
      }
      this.blocks = this.blocks.filter((b) => b.hp > 0);
      for (const k of this.kettles) {
        const d = Math.hypot(k.x + 16 - x, k.y + 16 - y);
        if (d > r + 16) continue;
        let dmg = s.def.dmg * 0.5 * s.def.kettleX * (1 - Math.min(1, d / (r + 16)) * 0.5);
        if (k.side === s.side) dmg *= 0.5;
        k.hp = Math.max(0, k.hp - dmg);
        total += dmg;
        hitThing = true;
        this.events.push({ t: 'hit', x: k.x + 16, y: k.y + 32, dmg: Math.round(dmg), what: 'kettle' });
      }
      for (const h of this.crew) {
        if (h.state === 'bonked') continue;
        const d = Math.hypot(h.x - x, h.y + 10 - y);
        if (d > r + 6) continue;
        let dmg = s.def.dmg * (1 - Math.min(1, d / (r + 6)) * 0.5);
        if (h.side === s.side) dmg *= 0.5;
        h.hp = Math.max(h.side === s.side ? 1 : 0, Math.round(h.hp - dmg));
        total += dmg;
        hitThing = true;
        this.events.push({ t: 'hit', x: h.x, y: h.y + 26, dmg: Math.round(dmg), what: 'hob' });
        if (h.hp <= 0) { h.state = 'bonked'; this.events.push({ t: 'bonk', hob: h.id, x: h.x, y: h.y }); }
      }
      if (s.def.dig >= 0) this.carve(x, y, Math.round(r * 0.55 + s.def.dig));
    }
    if (broke) this.events.push({ t: 'hit', x, y: y + 12, dmg: Math.round(total), what: 'block' });
    if (!hitThing) this.events.push({ t: 'hit', x, y, dmg: 0, what: 'ground' });
    if (hitThing) { this.stats[s.side].hits++; this.hitStreak[s.side]++; } else this.hitStreak[s.side] = 0;
    this.stats[s.side].blocks += broke;
    this.shotDmg += total;
    if (!this.best || this.shotDmg > this.best.dmg) this.best = { side: s.side, hob: this.hob(s.hob)?.name ?? '', round: this.round, dmg: Math.round(this.shotDmg), angle: s.aim.angle, power: s.aim.power };
    this.shells = this.shells.filter((q) => q !== s);
    if (!this.shells.some((o) => o.hob === s.hob)) this.addPin(s, x, y);
    this.markFalling();
  }

  private carve(cx: number, cy: number, r: number): void {
    for (let y = Math.max(0, cy - r); y < Math.min(H, cy + r); y++)
      for (let x = Math.max(0, cx - r); x < Math.min(W, cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && this.mask[y * W + x]) {
          this.mask[y * W + x] = 0;
          this.chunkRev[Math.floor(y / CH) * (W / CH) + Math.floor(x / CH)]++;
        }
  }

  private supportY(x: number, w: number, y: number, self?: Block): number {
    let top = 0;
    for (let xi = x + 2; xi < x + w - 2; xi += 4) {
      for (let yi = Math.min(H - 1, Math.floor(y)); yi >= 0; yi--) if (this.mask[yi * W + xi]) { top = Math.max(top, yi + 1); break; }
    }
    for (const b of this.blocks) if (b !== self && !b.falling && b.x < x + w - 1 && b.x + b.size > x + 1 && b.y + b.size <= y + 0.5) top = Math.max(top, b.y + b.size);
    for (const k of this.kettles) if (k.x < x + w - 1 && k.x + k.size > x + 1 && k.y + k.size <= y + 0.5) top = Math.max(top, k.y + k.size);
    return top;
  }

  private markFalling(): void {
    for (const b of this.blocks) if (b.mat !== 'footing' && !b.falling && this.supportY(b.x, b.size, b.y, b) < b.y - 0.5) { b.falling = true; b.vy = 0; }
  }

  private fallTick(): boolean {
    let moving = false;
    let landed = 0;
    let lx = 0, ly = 0;
    const sorted = this.blocks.filter((b) => b.falling).sort((a, b) => a.y - b.y);
    for (const b of sorted) {
      moving = true;
      b.vy -= G / HZ;
      const ny = b.y + b.vy / HZ;
      const sup = this.supportY(b.x, b.size, b.y, b);
      if (ny <= sup) {
        b.y = sup;
        b.falling = false;
        b.hp -= 10;
        landed++;
        lx = b.x; ly = b.y;
      } else b.y = ny;
    }
    if (landed) {
      this.blocks = this.blocks.filter((b) => b.hp > 0);
      this.events.push({ t: 'fall', count: landed, x: lx, y: ly });
      this.markFalling();
    }
    for (const h of this.crew) {
      const sup = this.supportY(h.x - 6, 12, h.y);
      if (sup < h.y - 1) { h.y = Math.max(sup, h.y - 3); moving = true; if (h.state === 'ready') h.state = 'tumbled'; }
    }
    for (const k of this.kettles) {
      const sup = this.supportY(k.x, k.size, k.y);
      if (sup < k.y - 1) { k.y = Math.max(sup, k.y - 3); moving = true; }
    }
    return moving;
  }

  private settle(): void { this.markFalling(); }

  // ---------- AI (mock only: the real AI is in castle-core) ----------
  private aiFire(): void {
    const side = this.active;
    const h = this.hob(this.picked[side]);
    if (!h) { this.endTurn(); return; }
    const foes = this.crew.filter((x) => x.side !== side && x.state !== 'bonked');
    const k = this.kettles.find((x) => x.side !== side);
    const target = foes.length && this.rand() < 0.6 ? foes[Math.floor(this.rand() * foes.length)] : k ? { x: k.x + 16, y: k.y + 16 } : foes[0];
    if (!target) { this.endTurn(); return; }
    let best = { angle: 1350, power: 70, d: 1e9 };
    for (let deg = 30; deg <= 70; deg += 5) {
      const angle = side === 1 ? 1800 - deg * 10 : deg * 10;
      let lo = 10, hi = 100;
      for (let it = 0; it < 12; it++) {
        const mid = (lo + hi) / 2;
        const end = this.simulate(h, angle, mid, 1, 600).end;
        const over = side === 1 ? end[0] < target.x : end[0] > target.x;
        if (over) hi = mid; else lo = mid;
      }
      const p = (lo + hi) / 2;
      const end = this.simulate(h, angle, p, 1, 600).end;
      const d = Math.hypot(end[0] - target.x, end[1] - target.y);
      if (d < best.d) best = { angle, power: p, d };
    }
    const err = this.setup.difficulty === 'cozy' ? 9 : this.setup.difficulty === 'fair' ? 5 : 2.5;
    const power = clamp(Math.round(best.power + (this.rand() * 2 - 1) * err), 5, 100);
    const options = ['plain', 'knack', ...this.hand[side].keys()].filter((id) => this.shotUsable(h, id));
    const id = options.find((o) => o !== 'plain' && this.rand() < 0.35) ?? 'plain';
    h.lastAim = { angle: best.angle, power };
    this.launch(h, id, h.lastAim);
  }

  private simulate(h: Hob, angle: number, power: number, grav: number, maxTicks: number) {
    const [ox, oy] = this.origin(h);
    const a = (angle / 10) * (Math.PI / 180);
    let x = ox, y = oy, vx = Math.cos(a) * power * SPEED, vy = Math.sin(a) * power * SPEED;
    const pts: [number, number][] = [[x, y]];
    const dt = 1 / HZ;
    for (let t = 0; t < maxTicks; t++) {
      vx += this.wind * 10 * dt;
      vy -= G * grav * dt;
      x += vx * dt;
      y += vy * dt;
      if (t % 3 === 0) pts.push([x, y]);
      if (x < 0 || x > W || y < 0) break;
      if (t > 6 && this.hitTest(x, y, h.side, true)) break;
    }
    pts.push([x, y]);
    return { pts, end: [x, y] as [number, number] };
  }

  // ---------- snapshot ----------
  snapshot(): Snapshot {
    const cols = W / CH;
    const chunks: TerrainChunk[] = [];
    for (let i = 0; i < this.chunkRev.length; i++) {
      if (this.chunkRev[i] === this.sentRev[i]) continue;
      this.sentRev[i] = this.chunkRev[i];
      const cx = i % cols, cy = Math.floor(i / cols);
      const rle: number[] = [];
      let cur = 0, run = 0;
      for (let y = cy * CH; y < cy * CH + CH; y++)
        for (let x = cx * CH; x < cx * CH + CH; x++) {
          const v = y < H ? this.mask[y * W + x] : 0;
          if (v === cur) run++;
          else { rle.push(run); cur = v; run = 1; }
        }
      rle.push(run);
      chunks.push({ cx, cy, rev: this.chunkRev[i], rle });
    }
    const you = this.active;
    const h = this.hob(this.picked[you]);
    const shots: ShotChip[] = [];
    if (h) {
      shots.push({ id: 'plain', name: PLAIN[h.cls].name, icon: PLAIN[h.cls].id, kind: 'plain', uses: -1, weight: 0, best: h.cls, ready: this.shotUsable(h, 'plain'), why: h.rest > 0 ? 'Needs a rest' : undefined });
      if (this.knackOpen()) shots.push({ id: 'knack', name: KNACK[h.cls].name, icon: PLAIN[h.cls].id, kind: 'knack', uses: h.shots.get('knack') ?? 0, weight: 1, best: h.cls, ready: this.shotUsable(h, 'knack') });
      for (const [id, n] of this.hand[you]) {
        const d = SHELLS.find((s) => s.id === id)!;
        shots.push({ id, name: d.name, icon: id, kind: 'shell', uses: n, weight: d.weight, best: d.best, ready: this.shotUsable(h, id) });
      }
    }
    let preview: [number, number][] = [];
    if (h && h.lastAim && h.lastAim.power > 0 && (this.phase === 'plan')) {
      const def = this.flyFor(h, this.shot[you]);
      const full = this.setup.mode === 'yard' || this.fullPreviewShots > 0 || this.setup.sides[you].help === 'lots';
      const share = full ? 1 : this.setup.sides[you].help === 'some' ? 0.6 : 0.3;
      const { pts } = this.simulate(h, h.lastAim.angle, h.lastAim.power, def.grav, 1400);
      preview = pts.slice(0, Math.max(2, Math.ceil(pts.length * share)));
    }
    const fireState: Snapshot['hud']['fire'] = this.phase === 'flight' || this.phase === 'rival' ? 'flight' : this.phase === 'resolve' ? 'fast' : h && h.lastAim && h.lastAim.power > 0 && this.shotUsable(h, this.shot[you]) ? 'ready' : 'locked';
    const ev = this.events;
    this.events = [];
    return {
      tick: this.tick,
      phase: this.phase,
      mode: this.setup.mode,
      round: this.round,
      roundCap: this.roundCap,
      squall: { warn: this.setup.level === '1-1' ? 0 : Math.max(0, this.roundCap + 1 - this.round) <= 3 && this.round <= this.roundCap ? this.roundCap + 1 - this.round : 0, on: this.squallOn },
      wind: this.wind,
      forecast: this.forecast,
      sides: [
        { name: this.setup.sides[0].name, human: this.setup.sides[0].human, help: this.setup.sides[0].help ?? 'none' },
        { name: this.setup.sides[1].name, human: this.setup.sides[1].human, help: this.setup.sides[1].help ?? 'none' },
      ],
      terrain: { width: W, height: H, chunk: CH, chunks },
      blocks: this.blocks.map(({ vy: _v, ...b }) => b),
      kettles: this.kettles.map((k) => ({ ...k, hp: Math.round(k.hp) })),
      hobs: this.crew.map(({ facing: _f, shots: _s, lastAim: _l, ...v }) => ({ ...v })),
      shells: this.shells.map(({ def: _d, hob: _h, path: _p, split: _s, apex: _a, aim: _m, ...v }) => v),
      pins: this.pins.map((p) => ({ ...p })),
      forts: [{ ...this.forts[0] }, { ...this.forts[1] }],
      events: ev,
      hud: {
        active: this.active, you, steam: this.steam[you], steamMax: 100, steamTurn: this.steamTurn,
        hob: this.picked[you], shot: this.shot[you], aim: h?.lastAim ? { ...h.lastAim } : undefined,
        shots, preview, fire: fireState, canWalk: this.canWalk() && this.phase === 'plan', thinking: this.phase === 'rival',
      },
      draft: this.draft ? JSON.parse(JSON.stringify(this.draft)) : undefined,
      result: this.result,
    };
  }

  saveBattle(): string {
    return JSON.stringify({ v: 1, setup: this.setup, tick: this.tick, log: this.log });
  }

  loadBattle(data: string): void {
    const d = JSON.parse(data) as { setup: BattleSetup; tick: number; log: Logged[] };
    this.setup = d.setup;
    this.reset();
    this.replaying = true;
    for (const e of d.log) {
      if (e.tick > this.tick) this.step(e.tick - this.tick);
      this.apply(e.c);
    }
    if (d.tick > this.tick) this.step(d.tick - this.tick);
    this.replaying = false;
    this.log = d.log;
    this.sentRev.fill(0);
    this.events = [];
  }
}

const PLAIN_HP: Record<HobClass, number> = { lobber: 120, zinger: 80, scatterjack: 100, delver: 140, boinker: 90, sizzler: 100, patcher: 110, peeper: 80 };
const RIVAL_NAMES: Record<HobClass, string> = { lobber: 'Pot Hand', zinger: 'Hedge Snipper', scatterjack: 'Rake Hand', delver: 'Spade Hand', boinker: 'Bounce Hand', sizzler: 'Ember Hand', patcher: 'Mower Minder', peeper: 'Clipboard Clerk' };

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

