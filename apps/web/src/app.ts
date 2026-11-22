import type { BattleSetup, CoreApi, LevelInfo } from './core/types';
import { setVolume } from './audio/sfx';
import {
  loadBattleSave, loadProgress, loadSettings, saveProgress, saveSettings, type Progress, type Settings,
} from './save/db';
import { DEFAULT_BLUEPRINT } from './core/content';

export interface Screen {
  el: HTMLElement;
  destroy?: () => void;
  /** Called on a window resize; layout is a pure function of the window (07 §2.6.6). */
  relayout?: () => void;
}

export type Route =
  | { to: 'title' }
  | { to: 'map'; focus?: string }
  | { to: 'prebattle'; level: string; again?: boolean }
  | { to: 'battle'; setup: BattleSetup; resume?: string; prepared?: boolean }
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
  lastSetup?: BattleSetup;
  lastResult?: unknown;
  duelScore: Record<string, number> = {};
  layout: 'wide' | 'tall' = 'wide';

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async init(core: CoreApi): Promise<void> {
    this.core = core;
    this.settings = await loadSettings();
    this.progress = await loadProgress();
    setVolume(this.settings.sound, this.settings.mute);
    this.applyMotion();
    this.updateLayout(true);
    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { this.updateLayout(false); this.cur?.relayout?.(); });
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

  go(r: Route): void {
    const f = this.factories.get(r.to);
    if (!f) throw new Error(`no screen ${r.to}`);
    this.cur?.destroy?.();
    this.route = r;
    const s = f(this, r);
    this.cur = s;
    this.root.replaceChildren(s.el);
    document.documentElement.dataset.screen = r.to;
    const focus = s.el.querySelector<HTMLElement>('[data-autofocus]');
    focus?.focus({ preventScroll: true });
  }

  async setSettings(p: Partial<Settings>): Promise<void> {
    Object.assign(this.settings, p);
    setVolume(this.settings.sound, this.settings.mute);
    this.applyMotion();
    this.updateLayout(true);
    this.cur?.relayout?.();
    await saveSettings(this.settings);
  }

  async saveProgress(): Promise<void> { await saveProgress(this.progress); }

  levels(): LevelInfo[] { return this.core.levels(); }

  levelDone(id: string): boolean { return (this.progress.levels[id]?.wins ?? 0) > 0; }

  /** The next level to play: the first not won. */
  nextLevel(): string {
    return this.levels().find((l) => !this.levelDone(l.id))?.id ?? this.levels()[this.levels().length - 1].id;
  }

  levelOpen(id: string): boolean {
    const ls = this.levels();
    const i = ls.findIndex((l) => l.id === id);
    return i <= 0 || this.levelDone(ls[i - 1].id);
  }

  /** Hobs the player has, by campaign progress. */
  roster(): string[] {
    const done = this.levels().filter((l) => this.levelDone(l.id)).map((l) => l.id);
    return this.core.hobs().filter((h) => !h.joins || done.includes(prev(h.joins)) || h.joins === '1-1').map((h) => h.id);
  }

  campaignSetup(levelId: string, crew?: string[]): BattleSetup {
    const lvl = this.levels().find((l) => l.id === levelId)!;
    const roster = this.roster();
    const pick = (crew ?? this.progress.lastCrew).filter((c) => roster.includes(c));
    for (const r of roster) if (pick.length < lvl.crewSize && !pick.includes(r)) pick.push(r);
    return {
      mode: 'campaign',
      level: levelId,
      seed: hashSeed(levelId),
      difficulty: this.settings.difficulty,
      windOff: this.settings.windOff,
      sides: [
        { name: 'You', human: true, crew: pick.slice(0, lvl.crewSize), blueprint: this.progress.blueprint ?? DEFAULT_BLUEPRINT },
        { name: lvl.rival, human: false, crew: [] },
      ],
    };
  }

  async hasBattleSave(): Promise<boolean> { return !!(await loadBattleSave()); }
}

function prev(id: string): string {
  const [r, n] = id.split('-').map(Number);
  return `${r}-${Math.max(1, n - 1)}`;
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
