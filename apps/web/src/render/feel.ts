// Game feel: turns the core's snapshot events into animation, effects, numbers, shake, hit stop,
// slow motion and sound cues. It never decides anything: every effect here starts from an event
// or a change the core reported. All state is pooled or kept per object, so a frame allocates nothing.
import type { BattleEvent, HobView, KettleView, PinView, RoomView, Side, Snapshot } from '../core/types';
import { AnimPlayer, anims, frameIndexAt, type Clip } from './anim';
import { Collapses } from './collapse';
import { FxPool, type DmgType } from './fx';
import { Juice, blastBand, blastTrauma, hobHitStop } from './juice';
import { flattenerSpriteName, hobSpriteName, hobTeam, isCrewHob, sprites } from './sprites';
import { hobContentId, t } from '../ui/text';
import type { TerrainLayer } from './terrain';
import { matKey, stage } from './view';

/** Sound cues: game events and animation events (audio.json maps them to files). */
export type Cue =
  | 'release' | 'hit' | 'hit_hob' | 'break' | 'boom' | 'bonk' | 'inflate' | 'lift' | 'thud' | 'splash' | 'pop' | 'kettle_crack' | 'sit'
  | 'creak' | 'crack' | 'fall' | 'land' | 'hob_land' | 'tumble' | 'stomp' | 'threaded' | 'thump' | 'dig' | 'cheer' | 'squall' | 'wind'
  | 'pin' | 'flap' | 'lid' | 'split' | 'dust' | 'debris';
export type Bark = 'fire' | 'takes_hit' | 'hit_lands' | 'bonked' | 'win' | 'picked';

const HOB_CLIPS = ['idle', 'blink', 'aim', 'fire', 'hit', 'tumble', 'land', 'bonked', 'cheer', 'dig', 'nextdoor'] as const;
type HobClipName = typeof HOB_CLIPS[number];

class HobAnim {
  p = new AnimPlayer();
  clips: Partial<Record<HobClipName, Clip>> = {};
  mode: 'idle' | 'aim' | 'act' | 'tumble' | 'bonked' | 'nextdoor' = 'idle';
  blinkLeft = 0;
  nextBlink = 3000;
  lift = 0;
  lifting = false;
  lastY = 0;
  still = 0;
  tumbleMs = 0;
  nextdoorMs = 0;
  hurtMs = 0;
  flattener = false;
  cheering = false;
  barked = false;
  cheerGap = 0;
  key = '';
  nm = '';
  def: string | undefined = '';
  cls = '';
  side = -1;
  constructor(readonly id: string) {}
}

class TwoState {
  p = new AnimPlayer();
  on = false;
  seen = false;
}

export class Feel {
  juice = new Juice();
  fx = new FxPool();
  col = new Collapses();
  /** View time in ms (stops in a hit stop, slows in slow motion). */
  time = 0;
  reduceMotion = false;
  reduceFlashes = false;
  you: Side = 0;
  /** The fight's mode (the Rival look is for campaign and Skirmish, orange for a Couch Duel). */
  private mode = 'campaign';
  sound: (c: Cue, arg?: string, gain?: number, pan?: number) => void = () => undefined;
  /** A bark: content Hob id, event, side, turn step, and the Hob's snapshot id (for the subtitle tag). */
  bark: (hob: string, ev: Bark, side: number, step: number, id: string) => void = () => undefined;
  private shotN = 0;
  private lastShot = '';
  private shooter: HobAnim | null = null;
  /** For the camera: the last impact (world) and when (view ms). */
  impactX = 0; impactY = 0; impactAt = -1e9;
  collapseUntil = -1e9;

  private hobs = new Map<string, HobAnim>();
  private kettles = [new TwoState(), new TwoState()];
  private steam = [new AnimPlayer(), new AnimPlayer()];
  private rooms = new Map<number, TwoState>();
  private lids = new Map<number, TwoState>();
  private pins = new Map<string, AnimPlayer>();
  private livePinIds = new Set<string>();
  private trails = new Map<number, number>();
  private blockHp = new Map<number, number>();
  private crackAt = new Map<number, number>();
  private walkLeft = [0, 0];
  private walkT = [0, 0];
  private walkFrame = [-1, -1];
  private fortX = [NaN, NaN];
  private lastTick = -1;
  private lastWind = NaN;
  private leafT = 0;
  private fireTick = -1;
  private firstImpact = false;
  private kettleHitThisShot = false;
  private breaksThisBatch = 0;
  private rng = 0x9e3779b9;
  private hobPower = 0;
  private picked = '';
  private plan = false;
  private lastBonkX = 0;
  private lastBonkY = 0;
  /** Scratch out-values for the draw code (no tuples). */
  outDy = 0;
  outAlpha = 1;

  constructor() {
    this.col.sink = (kind, g) => {
      if (kind === 'creak') this.sound('creak');
      else if (kind === 'first_fall') {
        if (g.count >= 6) this.juice.slow('collapse');
        this.collapseUntil = this.time + 1600;
        this.sound('fall');
      } else if (kind === 'land') {
        this.juice.shake(Math.min(0.4, 0.05 * g.landed), 250);
        if (g.count >= 3 && g.landed === g.count) this.juice.hitStop(50);
        // Rumble by block count: 1 block 0.5, 6 or more 1.0.
        this.sound('land', '', Math.min(1, 0.4 + 0.1 * g.count));
        this.sound('dust', '', 0.65);
      }
    };
  }

  private rand(): number { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }

  reset(): void { this.fx.clear(); this.col.clear(); this.hobs.clear(); this.pins.clear(); this.trails.clear(); }

  // ---------------- events ----------------

  /** One core event, already turned into a view event by the adapter. */
  onEvent(e: BattleEvent, snap: Snapshot, viewCenterX: number, viewW: number): void {
    const panOf = (x: number) => (viewW > 0 ? Math.max(-0.85, Math.min(0.85, (x - viewCenterX) / (viewW * 0.5))) : 0);
    switch (e.t) {
      case 'turn':
        this.juice.newTurn();
        // Let active collapse choreography finish cleanly on normal speed; only hurry when fast/reduced-motion.
        if (this.juice.fast || this.reduceMotion) this.col.hurry();
        this.fireTick = -1;
        break;
      case 'fire': {
        this.juice.newShot();
        this.fireTick = snap.tick;
        this.firstImpact = true;
        this.kettleHitThisShot = false;
        if ((e.weight ?? 0) >= 2) this.juice.shake(0.1, 100);
        this.shotN++;
        this.lastShot = e.kind;
        const a = e.hob ? this.hobs.get(e.hob) : undefined;
        this.shooter = a ?? null;
        // The launch sound starts on the fire clip's release frame; with no clip, now.
        if (a?.clips.fire && a.mode !== 'bonked') { a.p.play(a.clips.fire); a.mode = 'act'; }
        else this.release(a);
        break;
      }
      case 'boom': {
        const [tr, decay] = blastTrauma(e.r);
        this.shakeAt(tr, decay, e.x, e.y, viewCenterX, viewW);
        this.boom(e.x, e.y, e.r);
        this.impact(e.x, e.y, snap);
        this.sound('boom', blastBand(e.r), 1, panOf(e.x));
        // Near miss on a kettle under 25% (07 §6.4).
        for (const k of snap.kettles) {
          if (k.hp <= 0 || k.hp > k.maxHp * 0.25 || this.kettleHitThisShot) continue;
          const kx = k.x + k.size / 2, ky = k.y + k.size / 2;
          if (Math.hypot(kx - e.x, ky - e.y) < e.r + 40) this.juice.slow('near_miss');
        }
        break;
      }
      case 'hit': {
        const dir = (e.side ?? (e.x < (snap.forts[0].x + snap.forts[1].x) / 2 ? 0 : 1)) === 0 ? -1 : 1;
        const type = dmgType(e.dtype);
        const pan = panOf(e.x);
        if (e.dmg > 0) {
          if (e.what === 'hob') {
            this.fx.number(`h${e.hob ?? e.x}`, e.x, e.y + 10, e.dmg, 1, type, dir);
            this.juice.hitStop(Math.max(e.dmg >= 25 ? 45 : 0, hobHitStop(e.dmg)));
            const a = e.hob ? this.hobs.get(e.hob) : undefined;
            if (a) a.hurtMs = 650;
            if (a?.clips.hit && a.mode !== 'bonked' && a.mode !== 'tumble') { a.p.play(a.clips.hit); a.mode = 'act'; }
            this.sound('hit_hob', '', 1, pan);
            if (a) this.bark(a.nm, 'takes_hit', a.side, this.shotN, a.id);
            const sh = this.shooter;
            if (sh && a && sh.side !== a.side) this.bark(sh.nm, 'hit_lands', sh.side, this.shotN, sh.id);
          } else if (e.what === 'kettle') {
            this.kettleHitThisShot = true;
            if (e.dmg >= 20) this.juice.hitStop(45);
            this.fx.number(`k${e.side ?? 0}`, e.x, e.y + 16, e.dmg, 2, type, dir);
            this.fx.spawnName('fx_impact_cobble', e.x, e.y, 1);
            this.sound('hit', 'kettle', 1, pan);
          } else {
            if ((e.mat === 'cobble' || e.mat === 'brassbound') && e.dmg >= 25) this.juice.hitStop(45);
            this.fx.number(`b${e.side ?? 0}`, e.x, e.y + 8, e.dmg, 0, type, dir);
            this.fx.spawnName(`fx_impact_${matKey(e.mat ?? 'timber')}`, e.x, e.y - 8, 1);
            this.sound('hit', e.mat ?? 'timber', 1, pan);
          }
          this.impact(e.x, e.y, snap);
        } else {
          // A miss: a puff of dirt, or a splash in water.
          const water = this.waterAt(e.x, e.y);
          this.fx.spawnName(water ? 'fx_splash' : 'fx_impact_dirt', e.x, e.y + (water ? 2 : 4), 1);
          this.sound(water ? 'splash' : 'thud', '', 1, pan);
          this.impact(e.x, e.y, snap);
        }
        break;
      }
      case 'break': {
        this.breaksThisBatch++;
        this.shakeAt(0.1, 150, e.x, e.y, viewCenterX, viewW);
        const clip = anims.get(`fx_chunk_${matKey(e.mat)}`);
        for (let i = 0; i < 3; i++) {
          const f = this.fx.spawn(clip, e.x, e.y, 0.7);
          if (!f) break;
          f.vx = (this.rand() - 0.5) * 220; f.vy = 120 + this.rand() * 160; f.g = 900; f.vr = (this.rand() - 0.5) * 16;
          f.floor = e.y - 40; f.life = 800; f.fade = 300;
        }
        const r = this.fx.spawnName(`fx_rubble_${matKey(e.mat)}`, e.x - 8, e.y + 8, 1, 1);
        if (r) { r.hold = 1500; r.fade = 500; }
        this.sound('break', e.mat, 1, panOf(e.x));
        if (this.breaksThisBatch === 2) this.sound('debris', '', 0.7, panOf(e.x));
        break;
      }
      case 'collapse':
        this.col.start(e);
        break;
      case 'fall':
        this.fx.word(t('notes.big_drop'), e.x, e.y - 14, 20, '#FFF4DE', true, 1400); // at the base of the fall, under the numbers
        break;
      case 'bonk': {
        this.fx.word(t('notes.bonk'), e.x, e.y + 44, 22, '#FFF4DE', true, 1400);
        this.juice.hitStop(80);
        // A plain Bonk slow. Whether it ended the fight is the core's call: the win event
        // (how: clean_sweep) turns it into the Clean Sweep slow below. In Volley Points a side
        // with no Hobs left plays on, so nothing here guesses from a count.
        this.lastBonkX = e.x; this.lastBonkY = e.y;
        this.juice.slow('bonk');
        this.sound('bonk');
        const ba = this.hobs.get(e.hob);
        if (ba) this.bark(ba.nm, 'bonked', ba.side, -1 - this.shotN, ba.id);
        break;
      }
      case 'kettle_pop': {
        const k = snap.kettles.find((q) => q.side === e.side);
        const st = this.kettles[e.side];
        st.p.play(anims.get('kettle_pop'));
        st.on = true;
        this.juice.hitStop(80);
        this.juice.shake(1, 600);
        if (k) {
          const kx = k.x + k.size / 2, ky = k.y + k.size / 2;
          this.juice.slow('kettle_pop', true, [kx, ky], 1.4);
          this.fx.word(t('notes.kettle_pop'), kx, ky + 60, 24, '#4FE3C1', true, 2000);
          this.boom(kx, ky, 42);
        }
        break;
      }
      case 'threaded':
        this.juice.slow('threaded', false, [e.x, e.y], 1.25);
        this.sound('threaded');
        break;
      case 'thump':
        this.juice.shake(0.5, 300, 0, 0, 1, true);
        this.juice.hitStop(50);
        this.sound('thump');
        break;
      case 'hob': {
        const a = this.hobs.get(e.hob);
        if (!a) break;
        if (e.act === 'tumble' && a.clips.tumble) { a.p.play(a.clips.tumble); a.mode = 'tumble'; a.tumbleMs = 0; a.still = 0; }
        else if (e.act === 'land' && a.clips.land) { a.p.play(a.clips.land); a.mode = 'act'; }
        else if (e.act === 'dig' && a.clips.dig) { a.p.play(a.clips.dig); a.mode = 'act'; }
        else if (e.act === 'nextdoor') a.nextdoorMs = 2400;
        else if (e.act === 'cheer' && a.clips.cheer) { a.p.play(a.clips.cheer); a.mode = 'act'; }
        break;
      }
      case 'note':
        if (e.text && e.x !== undefined && e.y !== undefined) this.fx.word(e.text, e.x, e.y + 30, 16, '#FFF4DE', false, 1400);
        break;
      case 'squall':
        if (e.n === 1) this.sound('squall');
        break;
      case 'end':
        if (e.key === 'clean_sweep') {
          if (e.winner === this.you) this.juice.slow('clean_sweep', true, [this.lastBonkX, this.lastBonkY + 30], 1.35);
          else this.juice.slow('own_last_bonk', true);
        }
        for (const h of snap.hobs) {
          if (h.side !== e.winner || h.state === 'bonked') continue;
          const a = this.hobs.get(h.id);
          if (a) a.cheering = true;
        }
        break;
    }
  }

  /** End of one batch of events (one sim step): 3 or more blocks broken by one hit is a 50 ms hit stop. */
  endBatch(): void {
    if (this.breaksThisBatch >= 3) this.juice.hitStop(50);
    this.breaksThisBatch = 0;
  }

  private shakeAt(tr: number, decay: number, x: number, y: number, cx: number, vw: number): void {
    // Reduce Motion / Fewer flashes suppress impact white rim flashes (Web-M17 / M-W03).
    if (this.reduceMotion) return;
    if (this.juice.shakeScale <= 0) { if (!this.reduceFlashes) this.juice.rimAt(x, y, 30 * tr + 10); return; }
    const d = vw > 0 ? Math.abs(x - cx) / vw : 0;
    this.juice.shake(tr, decay, d, cx - x, 0);
    void y;
  }

  private impact(x: number, y: number, snap: Snapshot): void {
    this.impactX = x; this.impactY = y; this.impactAt = this.time;
    if (this.firstImpact) {
      this.firstImpact = false;
      // A shot with under 1 s of flight (07 §6.4).
      if (this.fireTick >= 0 && snap.tick - this.fireTick < 120) this.juice.slow('quick_impact');
    }
  }

  /** The 06 §7 starburst: radius equals the blast radius, 8 frames at 30 fps (4 drawn frames). */
  private boom(x: number, y: number, r: number): void {
    const size = r >= 42 ? 'large' : r >= 22 ? 'medium' : 'small';
    const w = size === 'large' ? 128 : size === 'medium' ? 64 : 32;
    const clip = anims.get(`fx_boom_${size}`);
    this.fx.spawn(clip, x, y, Math.max(0.4, (2 * Math.max(10, r)) / w));
    for (let i = 0; i < 4; i++) {
      const f = this.fx.spawnName('fx_dustcloud', x + (this.rand() - 0.5) * r, y + this.rand() * 6, 0.35 + r / 120, 1);
      if (f) { f.wind = 3; f.vy = 8; }
    }
  }

  private waterAt(x: number, y: number): boolean {
    const t = this.terr;
    if (!t || !t.w) return false;
    const xi = Math.round(x);
    for (let dy = -6; dy <= 2; dy += 2) {
      const yi = Math.round(y + dy);
      if (xi >= 0 && xi < t.w && yi >= 0 && yi < t.h && t.mask[yi * t.w + xi] === 6) return true;
    }
    return false;
  }
  terr?: TerrainLayer;

  // ---------------- per frame ----------------

  /**
   * Advance by wall ms. Returns the view-time scale (0 in a hit stop, the slow-mo speed in
   * slow motion). `calm`: the Plan step or an Aim Drag, when nothing shakes.
   */
  update(wallMs: number, snap: Snapshot, calm: boolean, viewX: number, viewY: number, viewW: number, shells: Float64Array, nShells: number): number {
    this.juice.reduceMotion = this.reduceMotion;
    this.col.reduceMotion = this.reduceMotion;
    const scale = this.juice.update(wallMs, calm);
    const dt = wallMs * scale;
    this.time += dt;
    this.fx.wind = snap.wind;
    this.plan = snap.phase === 'plan';
    this.picked = snap.hud.hob ?? '';
    this.hobPower = snap.hud.aim?.power ?? 0;
    const newTick = snap.tick !== this.lastTick;
    this.lastTick = snap.tick;
    if (newTick) this.scanBlocks(snap);
    this.fx.step(dt);
    this.col.step(dt, this.fx);
    this.stepHobs(dt, snap);
    this.stepFort(dt, snap);
    this.stepPins(dt, snap);
    this.stepTrails(dt, shells, nShells, snap);
    this.stepWeather(dt, snap, viewX, viewY, viewW);
    return scale;
  }

  private held = [false, false];
  private scanBlocks(snap: Snapshot): void {
    this.held[0] = false; this.held[1] = false;
    for (const b of snap.blocks) {
      if (b.held) this.held[b.side] = true;
      const prev = this.blockHp.get(b.id);
      if (prev !== undefined && prev > b.hp && stage(b.hp, b.maxHp) > stage(prev, b.maxHp)) { this.crackAt.set(b.id, this.time); this.sound('crack', b.mat); }
      if (prev !== b.hp) this.blockHp.set(b.id, b.hp);
    }
  }

  private hobAnim(h: HobView, isFlattener: boolean): HobAnim {
    let a = this.hobs.get(h.id);
    if (a && a.def === h.def && a.cls === h.cls && a.side === h.side && a.flattener === isFlattener) return a;
    const fnm = flattenerSpriteName(h.def ?? h.id, h.cls);
    // A crew Hob on the Rival side wears the Rival look (hob_<name>_rival_*); a Couch Duel
    // player 2 stays orange; Rival units are Flatteners.
    const key = isFlattener
      ? `flattener_${fnm}_`
      : `hob_${hobSpriteName(h.def ?? h.id, h.cls)}_${this.team(h)}_`;
    a = new HobAnim(h.id);
    a.def = h.def; a.cls = h.cls; a.side = h.side; a.flattener = isFlattener;
    a.nm = hobContentId(h.def ?? h.id); // barks are keyed by content Hob id (barks.json)
    a.key = key;
    for (const c of HOB_CLIPS) {
      const clip = anims.get(key + c);
      if (clip && (!isFlattener || sprites.has(clip.frames[0]))) a.clips[c] = clip;
    }
    this.playIdle(a, a.clips.idle);
    a.lastY = h.y;
    a.nextBlink = 3000 + this.rand() * 2000;
    this.hobs.set(h.id, a);
    return a;
  }

  /** Sprite team for a crew Hob: blue, a Couch Duel orange, or the Rival look. */
  private team(h: HobView): 'blue' | 'orange' | 'rival' {
    const t = hobTeam(h.side, this.mode);
    // An atlas built before the Rival look has no rival frames: fall back to orange.
    return t === 'rival' && !anims.get(`hob_${hobSpriteName(h.def ?? h.id, h.cls)}_rival_idle`) ? 'orange' : t;
  }

  /**
   * Start an idle loop somewhere inside it, so a crew never breathes in step: a random point when
   * the clip says `random_start`, else its `start_offset_ms`.
   */
  private playIdle(a: HobAnim, clip: Clip | undefined): void {
    a.p.play(clip);
    if (!clip || !clip.loop) return;
    if (clip.randomStart) a.p.seek(this.rand() * clip.total);
    else if (clip.startOffsetMs) a.p.seek(clip.startOffsetMs);
  }

  private stepHobs(dt: number, snap: Snapshot): void {
    const rm = this.reduceMotion;
    this.mode = snap.mode;
    const enemyFlattener = snap.mode !== 'duel';
    for (const h of snap.hobs) {
      // Rival units are Flatteners; a crew Hob on the Rival side (Skirmish) wears the Rival look.
      const a = this.hobAnim(h, h.side === 1 && enemyFlattener && !isCrewHob(h.def ?? h.id));
      if (a.hurtMs > 0) a.hurtMs = Math.max(0, a.hurtMs - dt);
      if (h.state === 'bonked') {
        if (a.mode !== 'bonked') {
          a.mode = 'bonked';
          a.lift = 0;
          a.lifting = !a.clips.bonked;
          if (a.clips.bonked) a.p.play(a.clips.bonked);
        }
        this.cur = a;
        if (a.clips.bonked) a.p.step(rm ? 0 : dt, this.bonkSink);
        if (rm && (a.p.clip || !a.clips.bonked)) a.lifting = true;
        if (a.lifting) a.lift = Math.min(36, a.lift + (dt / 1000) * 24);
        continue;
      }
      if (a.mode === 'bonked') { a.mode = 'idle'; a.lift = 0; this.playIdle(a, a.clips.idle); }
      a.nextdoorMs = Math.max(0, a.nextdoorMs - dt);
      if (a.mode === 'tumble') {
        a.tumbleMs += dt;
        a.still = Math.abs(h.y - a.lastY) < 0.5 ? a.still + dt : 0;
        this.cur = a;
        a.p.step(dt, this.hobSink);
        if ((a.tumbleMs > 400 && a.still > 160) || a.tumbleMs > 3000) {
          if (a.clips.land) { a.p.play(a.clips.land); a.mode = 'act'; } else a.mode = 'idle';
        }
      } else if (a.mode === 'act') {
        this.cur = a;
        a.p.step(dt, this.hobSink);
        // A play-once clip ends on its `next` (idle): back to the idle logic.
        if (a.p.done || a.p.clip === a.clips.idle) a.mode = 'idle';
      } else {
        const aim = this.plan && h.id === this.picked && h.side === snap.hud.active && snap.sides[h.side].human;
        if (a.cheering && a.clips.cheer) {
          a.cheerGap -= dt;
          if (a.cheerGap <= 0) { a.p.play(a.clips.cheer); a.mode = 'act'; a.cheerGap = 900 + this.rand() * 600; continue; }
        }
        if (aim && a.clips.aim) {
          a.mode = 'aim';
          a.p.pick(a.clips.aim, this.hobPower < 34 ? 0 : this.hobPower < 67 ? 1 : 2);
        } else {
          const nd = a.clips.nextdoor && (a.nextdoorMs > 0 || (h.def === 'hetty' && this.held[h.side]));
          const want = nd ? a.clips.nextdoor : a.clips.idle;
          if (a.p.clip !== want || a.mode === 'aim') { if (nd) a.p.play(want); else this.playIdle(a, want); a.mode = nd ? 'nextdoor' : 'idle'; }
          // Reduce motion: loops hold their first frame; idle bobbing stops.
          if (!rm) a.p.step(dt);
          a.nextBlink -= dt;
          if (a.nextBlink <= 0 && a.clips.blink) { a.blinkLeft = a.clips.blink.total; a.nextBlink = 3000 + this.rand() * 2000; }
          if (a.blinkLeft > 0) a.blinkLeft -= dt;
        }
      }
      a.lastY = h.y;
    }
  }

  private cur: HobAnim | null = null;
  private bonkSink = (ev: string): void => {
    if (ev === 'lift') { if (this.cur) this.cur.lifting = true; this.sound('lift'); } else if (ev === 'inflate') this.sound('inflate');
  };
  private kettleSink = (ev: string): void => { if (ev === 'pop') this.sound('pop'); else if (ev === 'crack') this.sound('kettle_crack'); else if (ev === 'sit') this.sound('sit'); };
  private pinSink = (ev: string): void => { if (ev === 'stick') this.sound('pin'); };
  /** Animation events on Hob clips, as sounds (assets/audio/README.md "Sounds that follow animations"). */
  private hobSink = (ev: string): void => {
    const a = this.cur;
    if (ev === 'release') this.release(a);
    else if (ev === 'jump') { this.sound('cheer'); if (a && !a.barked) { a.barked = true; this.bark(a.nm, 'win', a.side, -100, a.id); } }
    else if (ev === 'thud' || ev === 'land') this.sound('hob_land');
    else if (ev === 'fall') this.sound('tumble');
    else if (ev === 'clear') this.sound('dig');
  };
  private release(a: HobAnim | null | undefined): void {
    this.sound('release', this.lastShot);
    if (a) this.bark(a.nm, 'fire', a.side, this.shotN, a.id);
  }

  /** The sprite for a Hob now. Sets outDy (cells, up) for the balloon float. */
  hobSprite(h: HobView): string | undefined {
    const a = this.hobs.get(h.id);
    this.outDy = 0;
    if (!a) return undefined;
    if (a.mode === 'bonked') {
      this.outDy = a.lift + (a.lift >= 36 && !this.reduceMotion ? Math.sin(this.time / 400) * 2 : 0);
      return a.p.clip ? a.p.frame() : undefined;
    }
    if (!a.p.clip) return undefined;
    if (a.blinkLeft > 0 && a.mode === 'idle' && a.clips.blink) return a.clips.blink.frames[0];
    return a.p.frame();
  }

  /** True briefly after a unit takes a hit (tilts Flattener spirit-level bubble). */
  hobHurt(id: string): boolean {
    const a = this.hobs.get(id);
    return !!a && a.hurtMs > 0;
  }

  private stepFort(dt: number, snap: Snapshot): void {
    const rm = this.reduceMotion;
    for (let s = 0; s < 2; s++) {
      const f = snap.forts[s];
      if (!Number.isNaN(this.fortX[s]) && Math.abs(f.x - this.fortX[s]) > 0.01) this.walkLeft[s] = 260;
      this.fortX[s] = f.x;
      if (this.walkLeft[s] > 0) {
        this.walkLeft[s] -= dt;
        this.walkT[s] += dt;
        const walk = anims.get(s === 0 ? 'stomper_blue_walk' : 'stomper_orange_walk');
        if (walk) {
          const fi = frameIndexAt(walk, this.walkT[s]);
          if (fi !== this.walkFrame[s]) {
            this.walkFrame[s] = fi;
            if (fi === 0 || fi === 3) {
              const d = this.fx.spawnName('fx_dustcloud', f.x + (fi === 0 ? f.w * 0.3 : f.w * 0.7), f.y + 1, 0.25, 1);
              if (d) d.wind = 2;
              this.sound('stomp');
            }
          }
        }
      } else { this.walkT[s] = 0; this.walkFrame[s] = -1; }
      // Kettle: the pop plays on, then holds kettle_popped; reset if Volley Points relights it (Web-H3).
      const k = this.kettles[s];
      const kv = snap.kettles[s];
      if (kv && kv.hp > 0 && k.on) { k.on = false; k.p.clip = null; }
      if (k.on) k.p.step(dt, this.kettleSink);
      if (kv && kv.hp > 0 && kv.hp <= kv.maxHp * 0.25) {
        if (!this.steam[s].clip) this.steam[s].play(anims.get('fx_kettle_steam'));
        if (!rm) this.steam[s].step(dt);
      } else this.steam[s].clip = null;
    }
    // Loophole Flaps and Pot Lids: play the clip when the core's flag changes.
    for (const rm2 of snap.rooms) {
      const key = rm2.side * 1000 + rm2.id;
      this.flagAnim(this.rooms, key, rm2.flap, anims.get(rm2.side === 0 ? 'loophole_flap_blue_close' : 'loophole_flap_orange_close'), dt, 'flap');
      this.flagAnim(this.lids, key, rm2.lid, anims.get('pot_lid_raise'), dt, 'lid');
    }
    for (const kv of snap.kettles) this.flagAnim(this.lids, kv.side * 1000 + 999, !!kv.lid, anims.get('pot_lid_raise'), dt, 'lid');
  }

  private flagAnim(map: Map<number, TwoState>, key: number, on: boolean, clip: Clip | undefined, dt: number, cue: Cue): void {
    let st = map.get(key);
    if (!st) { st = new TwoState(); map.set(key, st); }
    if (!st.seen) { st.seen = true; st.on = on; if (on && clip) { st.p.play(clip); st.p.done = true; } }
    else if (on !== st.on) { st.on = on; if (clip) st.p.play(clip, !on); this.sound(cue); }
    st.p.step(dt);
  }

  /** Flap sprite for a room: the clip frame, the hold, or '' when the Loophole is open. */
  flapSprite(rm: RoomView): string {
    const st = this.rooms.get(rm.side * 1000 + rm.id);
    if (!st || !st.p.clip) return rm.flap ? (rm.side === 0 ? 'loophole_flap_blue' : 'loophole_flap_orange') : '';
    if (!st.on && st.p.done) return '';
    return st.p.frame() ?? '';
  }

  lidSprite(key: number, on: boolean): string {
    const st = this.lids.get(key);
    if (!st || !st.p.clip) return on ? 'pot_lid_raise_2' : '';
    if (!st.on && st.p.done) return '';
    return st.p.frame() ?? '';
  }

  /** The kettle sprite while it pops, then kettle_popped; undefined: draw by HP. */
  kettleSprite(k: KettleView): string | undefined {
    const st = this.kettles[k.side];
    return st.on && st.p.clip ? st.p.frame() : undefined;
  }
  steamSprite(side: number): string | undefined { return this.steam[side].clip ? this.steam[side].frame() : undefined; }

  /** Fort body bob while it walks (data.fort_bob), and the Stomper frame. */
  walking(side: number): boolean { return this.walkLeft[side] > 0; }
  bobDy(side: number): number {
    const d = anims.data?.fort_bob;
    if (!d || this.reduceMotion || this.walkLeft[side] <= 0) return 0;
    return d.dy[Math.max(0, this.walkFrame[side]) % d.dy.length];
  }
  bobTilt(side: number): number {
    const d = anims.data?.fort_bob;
    if (!d || this.reduceMotion || this.walkLeft[side] <= 0) return 0;
    return d.tilt[Math.max(0, this.walkFrame[side]) % d.tilt.length];
  }
  walkTime(side: number): number { return this.walkT[side]; }

  /** Crack overlay index (0 to 2) and fade for a block whose damage stage just went up; -1 none. */
  crackStage(id: number, hp: number, max: number): number {
    const at = this.crackAt.get(id);
    if (at === undefined) return -1;
    const e = this.time - at;
    if (e > 600) { this.crackAt.delete(id); return -1; }
    this.outAlpha = e < 400 ? 1 : 1 - (e - 400) / 200;
    return Math.min(stage(hp, max) - 1, Math.floor(e / 100));
  }

  private stepPins(dt: number, snap: Snapshot): void {
    const liveIds = this.livePinIds;
    liveIds.clear();
    for (const p of snap.pins) {
      liveIds.add(p.id);
      let a = this.pins.get(p.id);
      if (!a) {
        a = new AnimPlayer();
        // Pins that were there before the fight view opened just stand.
        a.play(anims.get(p.side === 0 ? 'fx_pin_p1_drop' : 'fx_pin_p2_drop'));
        if (this.lastTick < 0 || this.time < 50) a.done = true;
        this.pins.set(p.id, a);
      }
      a.step(dt, this.pinSink);
    }
    for (const id of this.pins.keys()) if (!liveIds.has(id)) this.pins.delete(id);
  }
  pinSprite(p: PinView): string {
    const a = this.pins.get(p.id);
    return (a && a.frame()) || (p.side === 0 ? 'fx_pin_p1' : 'fx_pin_p2');
  }

  /** Trail puffs behind each shell, one every 28 ms of view time, by damage type. */
  private stepTrails(dt: number, sh: Float64Array, n: number, snap: Snapshot): void {
    for (let i = 0; i < n; i++) {
      const id = sh[i * 3], x = sh[i * 3 + 1], y = sh[i * 3 + 2];
      const t = (this.trails.get(id) ?? 28) + dt;
      if (t >= 28) {
        const kind = snap.shells[i]?.trail ?? 'blast';
        const f = this.fx.spawnName(`fx_trail_${kind}`, x, y, 1, 1);
        if (f) f.wind = 1.5;
        this.trails.set(id, 0);
      } else this.trails.set(id, t);
    }
    if (!n && this.trails.size) this.trails.clear();
  }

  /** Wind leaves when the wind changes, and a few while it blows hard. */
  private stepWeather(dt: number, snap: Snapshot, vx: number, vy: number, vw: number): void {
    if (this.reduceMotion) { this.lastWind = snap.wind; return; }
    const changed = !Number.isNaN(this.lastWind) && snap.wind !== this.lastWind;
    this.lastWind = snap.wind;
    this.leafT -= dt;
    const many = changed ? 8 : Math.abs(snap.wind) >= 4 && this.leafT <= 0 ? 1 : 0;
    if (changed) this.sound('wind');
    for (let i = 0; i < many; i++) {
      const f = this.fx.spawnName('fx_wind_leaf', vx + (this.rand() - 0.5 - Math.sign(snap.wind) * 0.4) * vw, vy + (this.rand() - 0.3) * 160, 1);
      if (!f) break;
      f.wind = 22; f.vy = (this.rand() - 0.5) * 30; f.vr = (this.rand() - 0.5) * 4; f.life = 2600; f.fade = 700;
      f.p.t = this.rand() * 400;
    }
    if (many && !changed) this.leafT = 900;
  }

  /** The shimmer glint plays once every 3 s; each block on its own beat. */
  shimmerFrame(id: number): string | undefined {
    const c = anims.get('fx_shimmer');
    if (!c) return undefined;
    const t = (this.time + id * 397) % 3000;
    return t < c.total ? c.frames[frameIndexAt(c, t)] : undefined;
  }
}

function dmgType(t?: string): DmgType {
  switch (t) {
    case 'pierce': case 'dig': case 'fire': case 'heal': case 'frost': case 'zap': case 'crush': return t;
    case 'fall': case 'thump': return 'crush';
    case 'mend': case 'repair': return 'heal';
    default: return 'blast';
  }
}
