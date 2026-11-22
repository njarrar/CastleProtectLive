import type { BattleSetup, CoreApi, LevelInfo, ResultView } from './core/types';
import { setMusic, setVolume } from './audio/sfx';
import {
  askPersist, loadBattleSave, loadProgress, loadSettings, saveProgress, saveSettings, type Progress, type Settings,
} from './save/db';
import { LEVEL_FORT } from './core/bp';
import { RULES, levelAtLeast } from './core/rules';
import { btn, h } from './ui/dom';

export interface Screen {
  el: HTMLElement;
  destroy?: () => void;
  /** Called on a window resize; layout is a pure function of the window (07 §2.6.6). */
  relayout?: () => void;
  /** The Back button or key. Return true when the screen handled it (the battle opens Pause). */
  onBack?: () => boolean;
}

export type Route =
  | { to: 'title' }
  | { to: 'map'; focus?: string }
  | { to: 'prebattle'; level: string; again?: boolean }
  | { to: 'battle'; setup: BattleSetup; resume?: string; prepared?: boolean; handoff?: boolean; live?: number; paused?: boolean }
  | { to: 'results'; setup: BattleSetup }
  | { to: 'skirmish' }
  | { to: 'duel' }
  | { to: 'workshop' }
  | { to: 'settings'; back: Route }
  | { to: 'modes' };

type ScreenFactory = (app: App, r: Route) => Screen;

export class App {
  core!: CoreApi;
  settings!: Settings;
  progress!: Progress;
  root: HTMLElement;
  private cur?: Screen;
  route: Route = { to: 'title' };
  private factories = new Map<Route['to'], ScreenFactory>();
  private back: Route[] = [];
  lastSetup?: BattleSetup;
  lastResult?: ResultView;
  /** Couch Duel wins tonight, by side. Swap sides swaps it. */
  duelScore: [number, number] = [0, 0];
  layout: 'wide' | 'tall' = 'wide';
  /** Set by the service worker when a new version is waiting. Applied only on the title or map. */
  pendingUpdate?: () => void;
  private updateChip?: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async init(core: CoreApi): Promise<void> {
    this.core = core;
    this.settings = await loadSettings();
    this.progress = await loadProgress();
    setVolume(this.settings.sound, this.settings.mute, this.settings.music);
    this.applyMotion();
    this.updateLayout(true);
    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { this.updateLayout(false); this.cur?.relayout?.(); });
    });
    // Android Back and the browser Back: in a fight it opens Pause; elsewhere it goes up one screen.
    history.replaceState({ cp: true }, '');
    window.addEventListener('popstate', () => {
      if (this.cur?.onBack?.()) { history.pushState({ cp: true }, ''); return; }
      const prev = this.back.pop();
      if (prev) this.go(prev, { history: false });
    });
  }

  register(name: Route['to'], f: ScreenFactory): void { this.factories.set(name, f); }

  /** Wide when width >= 1.2 x height; switch to Tall under 1.15 and back over 1.25 (07 §2.6). */
  updateLayout(first: boolean): void {
    const r = window.innerWidth / Math.max(1, window.innerHeight);
    let next = this.layout;
    if (this.settings.rotation === 'wide') next = 'wide';
    else if (this.settings.rotation === 'tall') next = 'tall';
    else if (first) next = r >= 1.2 ? 'wide' : 'tall';
    else if (this.layout === 'wide' && r < 1.15) next = 'tall';
    else if (this.layout === 'tall' && r > 1.25) next = 'wide';
    this.layout = next;
    document.documentElement.dataset.layout = next;
  }

  applyMotion(): void {
    document.documentElement.classList.toggle('reduce-motion', this.settings.reduceMotion);
  }

  go(r: Route, opt: { history?: boolean } = {}): void {
    const f = this.factories.get(r.to);
    if (!f) throw new Error(`no screen ${r.to}`);
    let s: Screen;
    try {
      s = f(this, r);
    } catch (e) {
      // A screen that cannot be built never leaves the app stuck: say why and go to the map.
      console.error(e);
      if (r.to === 'map' || r.to === 'title') throw e;
      this.notice(e instanceof Error ? e.message : String(e));
      this.go({ to: 'map' }, opt);
      return;
    }
    this.cur?.destroy?.();
    // A battle route on the back stack is stale once a fight is entered again (it would start a new one).
    if (r.to === 'battle') this.back = this.back.filter((b) => b.to !== 'battle');
    if (opt.history !== false && this.route.to !== r.to && r.to !== 'battle' && r.to !== 'results') {
      // Settings opened from a fight: Back (browser or Android) must return to that fight, not
      // rebuild it from its setup, so the route kept is the one Settings goes back to.
      this.back.push(r.to === 'settings' ? r.back : this.route);
      if (this.back.length > 20) this.back.shift();
      history.pushState({ cp: true }, '');
    }
    if (r.to === 'map' || r.to === 'title') this.back = [];
    // A fight always has a history entry of its own, so Back (browser or Android) reaches the
    // battle's onBack (Pause) and never leaves the app or pops past the fight.
    if (r.to === 'battle') history.pushState({ cp: true, fight: true }, '');
    this.route = r;
    this.cur = s;
    // The map theme under menus, the Region 1 layers in a fight (started by the battle), a sting on results.
    if (r.to !== 'battle') setMusic(r.to === 'results' ? '' : 'map');
    this.root.replaceChildren(s.el);
    document.documentElement.dataset.screen = r.to;
    const focus = s.el.querySelector<HTMLElement>('[data-autofocus]');
    focus?.focus({ preventScroll: true });
    this.showUpdateChip();
  }

  /** A short message that stays a few seconds (routed errors, refused saves). */
  notice(text: string): void {
    const el = h('div', { class: 'notice', role: 'status' }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), 5000);
  }

  /** "Update ready" chip: on the title, the map and Modes, never mid fight. */
  showUpdateChip(): void {
    this.updateChip?.remove();
    this.updateChip = undefined;
    const calm: Route['to'][] = ['title', 'map', 'modes'];
    if (!this.pendingUpdate || !calm.includes(this.route.to)) return;
    const apply = this.pendingUpdate;
    this.updateChip = h('div', { class: 'update-chip', role: 'status' }, h('span', {}, 'Update ready'), btn('Update', () => apply(), 'primary small'));
    this.root.append(this.updateChip);
  }

  async setSettings(p: Partial<Settings>): Promise<void> {
    Object.assign(this.settings, p);
    setVolume(this.settings.sound, this.settings.mute, this.settings.music);
    this.applyMotion();
    this.updateLayout(true);
    this.cur?.relayout?.();
    await saveSettings(this.settings);
  }

  async saveProgress(): Promise<void> { await saveProgress(this.progress); }

  /** Write a campaign result into progress at once (the save is cleared only after this). */
  async recordResult(setup: BattleSetup, res: ResultView): Promise<void> {
    if (setup.mode !== 'campaign' || !setup.level) return;
    const lvl = this.levels().find((l) => l.id === setup.level);
    if (!lvl) return;
    const rec = this.progress.levels[lvl.id] ?? { pennants: [false, false, false], wins: 0, losses: 0 };
    rec.pennants = [0, 1, 2].map((i) => !!rec.pennants[i] || !!res.pennants[i]);
    if (res.winner === 0) rec.wins++; else rec.losses++;
    this.progress.levels[lvl.id] = rec;
    this.progress.buttons += res.buttons;
    if (res.winner === 0 && !this.progress.persistAsked) { this.progress.persistAsked = true; void askPersist(); }
    await this.saveProgress();
  }

  levels(): LevelInfo[] { return this.core.levels(); }

  levelDone(id: string): boolean { return (this.progress.levels[id]?.wins ?? 0) > 0; }

  /** The next level to play: the first not won. */
  nextLevel(): string {
    return this.levels().find((l) => !this.levelDone(l.id))?.id ?? this.levels()[this.levels().length - 1].id;
  }

  levelOpen(id: string): boolean {
    const ls = this.levels();
    const i = ls.findIndex((l) => l.id === id);
    if (i < 0) return false;
    return i === 0 || this.levelDone(ls[i - 1].id);
  }

  modesOpen(): boolean { return this.levelDone(RULES.campaign.modes_after); }

  /** Hobs the player has, by campaign progress (who joins after which level is content/app.json). */
  roster(): string[] {
    const ls = this.levels();
    const before = (id: string) => { const i = ls.findIndex((l) => l.id === id); return i <= 0 ? undefined : ls[i - 1].id; };
    return this.core.hobs().filter((hb) => {
      if (!hb.joins) return true;
      const p = before(hb.joins);
      return !p || this.levelDone(p);
    }).map((hb) => hb.id);
  }

  /**
   * The campaign setup for a level. The saved Workshop fort is used only when the core says it
   * seats this level's crew; otherwise the level's own fort is used and `fortNote` says why.
   */
  campaignSetup(levelId: string, crew?: string[]): BattleSetup & { fortNote?: string } {
    const lvl = this.levels().find((l) => l.id === levelId)!;
    const roster = this.roster();
    const pick = (crew ?? this.progress.lastCrew).filter((c) => roster.includes(c));
    for (const r of roster) if (pick.length < lvl.crewSize && !pick.includes(r)) pick.push(r);
    const seats = pick.slice(0, lvl.crewSize);
    let blueprint = this.progress.blueprint ?? LEVEL_FORT;
    let fortNote: string | undefined;
    if (this.progress.blueprint) {
      const chk = this.core.checkFort(this.progress.blueprint, seats.length);
      if (!chk.ok) {
        blueprint = LEVEL_FORT;
        fortNote = `Your fort cannot take this crew (${chk.why}). Using the level's fort.`;
      }
    }
    return {
      mode: 'campaign',
      level: levelId,
      seed: hashSeed(levelId),
      difficulty: this.settings.difficulty,
      windOff: this.settings.windOff,
      progress: { cleared: (this.progress.levels[levelId]?.wins ?? 0) > 0, pennants: [...(this.progress.levels[levelId]?.pennants ?? [false, false, false])] },
      sides: [
        { name: 'You', human: true, crew: seats, blueprint, doodads: levelAtLeast(levelId, RULES.campaign.doodads_from) ? lvl.doodads : undefined },
        { name: lvl.rival, human: false, crew: [] },
      ],
      fortNote,
    };
  }

  async hasBattleSave(): Promise<boolean> { return !!(await loadBattleSave()); }
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
