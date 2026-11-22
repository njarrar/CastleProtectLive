import type { App, Route, Screen } from '../app';
import { play, unlockAudio } from '../audio/sfx';
import { clearBattle, dropBattleSave, loadBattleSave } from '../save/db';
import type { BattleSetup, Blueprint } from '../core/types';
import { btn, h } from '../ui/dom';

export function gear(app: App, back: Route): HTMLElement {
  return btn('⚙', () => app.go({ to: 'settings', back }), 'gear round-btn', { 'aria-label': 'Settings' });
}

// ---------- S0 / S1: title and first run ----------
export function titleScreen(app: App): Screen {
  const first = !app.settings.seenFirstRun;
  const slider = h('input', { type: 'range', min: 0, max: 100, value: app.settings.sound, 'aria-label': 'Sound' }) as HTMLInputElement;
  slider.addEventListener('input', () => void app.setSettings({ sound: Number(slider.value) }));
  const play_ = btn('Play', () => {
    unlockAudio();
    play('tap');
    if (first) {
      void app.setSettings({ seenFirstRun: true });
      app.go({ to: 'battle', setup: app.campaignSetup('1-1') });
    } else app.go({ to: 'map' });
  }, 'primary big play', { 'data-autofocus': true, 'data-testid': 'play' });
  if (first) setTimeout(() => play_.classList.add('bounce'), 6000);
  const el = h('main', { class: 'screen title' },
    h('div', { class: 'sky-hills', 'aria-hidden': 'true' }),
    h('div', { class: 'logo' }, h('span', {}, 'Castle'), h('span', {}, 'Protect')),
    first ? h('label', { class: 'row slider' }, h('span', {}, 'Sound'), slider) : '',
    play_,
    h('p', { class: 'small free' }, 'Free forever. No ads.'),
  );
  void loadBattleSave().then((save) => {
    if (!save) return;
    // A save from another rules engine is never replayed; it is put aside, not kept forever.
    if (save.coreName !== app.core.name) { void dropBattleSave(); return; }
    const sheet = h('div', { class: 'scrim' }, h('div', { class: 'card resume', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'resume-h' },
      h('h2', { id: 'resume-h' }, 'Carry on?'),
      h('p', {}, save.label),
      btn('Resume', () => {
        unlockAudio();
        // The battle screen checks the version and the replay; a bad save routes to the map with a note.
        app.go({ to: 'battle', setup: save.setup, resume: save.core, handoff: save.handoff });
      }, 'primary', { 'data-autofocus': true, 'data-testid': 'resume' }),
      btn('Leave it', () => { void clearBattle(); sheet.remove(); }, 'secondary'),
    ));
    el.append(sheet);
    sheet.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }).catch(() => undefined);
  return { el };
}

// ---------- S3: Brickabrac Map, Region 1 ----------
const NODE_POS: [number, number][] = [
  [6, 62], [15, 48], [24, 60], [33, 42], [42, 56], [51, 38], [60, 54], [70, 40], [79, 56], [91, 42],
];

export function mapScreen(app: App, r: Route): Screen {
  const levels = app.levels();
  const next = app.nextLevel();
  const done = levels.filter((l) => app.levelDone(l.id)).length;
  const pennants = levels.reduce((a, l) => a + (app.progress.levels[l.id]?.pennants.filter(Boolean).length ?? 0), 0);
  const focus = (r as { focus?: string }).focus ?? next;
  const nodes = levels.map((l, i) => {
    const [x, y] = NODE_POS[i] ?? [i * 9, 50];
    const st = app.levelDone(l.id) ? 'done' : l.id === next ? 'next' : app.levelOpen(l.id) ? 'open' : 'locked';
    const pen = app.progress.levels[l.id]?.pennants ?? [];
    const b = btn(
      h('span', { class: 'num' }, l.type === 'Grand Fort' ? '♜' : l.id.split('-')[1]),
      () => app.go({ to: 'prebattle', level: l.id }),
      `node ${st} ${l.type === 'Grand Fort' ? 'grand' : ''}`,
      { style: `left:${x}%;top:${y}%`, 'aria-label': `Level ${l.id}, ${l.name}${st === 'locked' ? ', locked' : ''}`, disabled: st === 'locked', 'data-level': l.id },
    );
    b.append(h('span', { class: 'pens', 'aria-hidden': 'true' }, ...[0, 1, 2].map((k) => h('i', { class: pen[k] ? 'got' : '' }))));
    b.append(h('span', { class: 'nm' }, l.name));
    return b;
  });
  const path = h('div', { class: 'road', 'aria-hidden': 'true' });
  path.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M${NODE_POS.map(([x, y]) => `${x} ${y + 4}`).join(' L')}" /></svg>`;
  const strip = h('div', { class: 'mapstrip' }, path, ...nodes, h('div', { class: 'roller', 'aria-hidden': 'true' }, '▬●'));
  const scroller = h('div', { class: 'mapscroll' }, strip);
  const dock = h('nav', { class: 'dock' },
    btn('Play', () => app.go({ to: 'prebattle', level: next }), 'primary', { 'data-testid': 'dock-play' }),
    app.modesOpen() ? btn('Modes', () => app.go({ to: 'modes' }), 'secondary') : '',
    app.modesOpen() ? btn('Workshop', () => app.go({ to: 'workshop' }), 'secondary') : '',
  );
  const el = h('main', { class: 'screen map' },
    h('header', { class: 'topbar' },
      gear(app, { to: 'map' }),
      h('div', { class: 'title' }, h('b', {}, 'Puddingstone Downs'), h('span', {}, ` ${done}/${levels.length}`)),
      h('div', { class: 'purse' }, h('span', { title: 'Pennants' }, `⚑ ${pennants}/${levels.length * 3}`), h('span', { title: 'Buttons' }, `◎ ${app.progress.buttons}`)),
    ),
    h('div', { class: 'rail' }, h('span', { class: 'chip on' }, 'Downs'), h('span', { class: 'chip off' }, 'Crag'), h('span', { class: 'chip off' }, 'Fen'), h('span', { class: 'chip off' }, 'Flats')),
    scroller,
    btn('2 Players', () => app.go({ to: 'duel' }), 'pill twoplayers', { 'data-testid': 'two-players' }),
    dock,
  );
  requestAnimationFrame(() => {
    const n = strip.querySelector<HTMLElement>(`[data-level="${focus}"]`);
    if (n) scroller.scrollLeft = n.offsetLeft - scroller.clientWidth / 2;
    n?.focus({ preventScroll: true });
  });
  return { el };
}

// ---------- S15: Modes ----------
export function modesScreen(app: App): Screen {
  const row = (name: string, line: string, go?: () => void) =>
    h('div', { class: `moderow ${go ? '' : 'locked'}` }, h('div', {}, h('b', {}, name), h('p', { class: 'small' }, line)), go ? btn('Go', go, 'primary') : h('span', { class: 'small' }, line));
  const el = h('main', { class: 'screen modes' },
    h('header', { class: 'topbar' }, btn('←', () => app.go({ to: 'map' }), 'round-btn', { 'aria-label': 'Back' }), h('h1', {}, 'Modes'), gear(app, { to: 'modes' })),
    h('div', { class: 'list' },
      row('Couch Duel', 'Two players, one device.', () => app.go({ to: 'duel' })),
      row('Skirmish', 'One fight with a Rival.', () => app.go({ to: 'skirmish' })),
      row('Test Yard', 'Try any shot. Endless uses.', () => app.go({ to: 'battle', setup: yardSetup(app) })),
      row('Workshop', 'Build your fort.', () => app.go({ to: 'workshop' })),
      row('Trials', 'Opens after 1-8.'),
      row('Daily Dust-up', 'Opens after 1-10.'),
    ),
  );
  return { el };
}

/** The Test Yard: your fort (when the core accepts it) and as many of your crew as it seats. */
export function yardSetup(app: App, fort: Blueprint | undefined = app.progress.blueprint): BattleSetup {
  const roster = app.roster();
  const nooks = fort ? new Set(fort.cells.filter((c) => c.kind === 'nook').map((c) => c.room ?? 0)).size : 0;
  const crew = roster.slice(0, Math.max(1, Math.min(5, nooks || 5)));
  let blueprint = fort;
  if (blueprint && !app.core.checkFort(blueprint, crew.length).ok) blueprint = app.core.fortFor(crew.length);
  return {
    mode: 'yard', seed: 7, difficulty: app.settings.difficulty, windOff: true,
    sides: [
      { name: 'You', human: true, crew, blueprint },
      { name: 'Dummy', human: false, crew: [] },
    ],
  };
}
