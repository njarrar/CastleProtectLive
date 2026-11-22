// S9 results with Pennants, and S25 duel results.
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import type { ResultView, Side } from '../core/types';
import { btn, h } from '../ui/dom';

export function resultsScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'results' }>;
  const setup = r.setup;
  const res = app.lastResult as ResultView | undefined;
  if (!res) { queueMicrotask(() => app.go({ to: 'map' })); return { el: h('main', { class: 'screen' }) }; }
  if (setup.mode === 'duel' || setup.mode === 'skirmish') return versusResults(app, setup, res);

  const win = res.winner === 0;
  const lvl = app.levels().find((l) => l.id === setup.level);
  // Record progress. Pennants are kept: a later run only adds to them.
  if (lvl) {
    const rec = app.progress.levels[lvl.id] ?? { pennants: [false, false, false], wins: 0, losses: 0 };
    rec.pennants = rec.pennants.map((p, i) => p || !!res.pennants[i]);
    if (win) rec.wins++; else rec.losses++;
    app.progress.levels[lvl.id] = rec;
    app.progress.buttons += res.buttons;
    void app.saveProgress();
  }
  const title = win ? (res.how === 'Kettle Pop' ? 'Kettle Pop!' : 'Clean Sweep!') : 'Flattened';
  const pens = h('div', { class: 'pennants' }, ...(lvl?.goals ?? []).map((g, i) => h('div', { class: `pennant ${res.pennants[i] ? 'got' : ''}`, 'data-i': i },
    h('i', { 'aria-hidden': 'true' }, '⚑'), h('span', {}, g))));
  const next = app.levels()[app.levels().findIndex((l) => l.id === setup.level) + 1];
  const nextBtn = win && next ? btn('Next', () => app.go({ to: 'prebattle', level: next.id }), 'primary big', { 'data-autofocus': true }) : '';
  const retry = btn('Retry', () => app.go({ to: 'battle', setup }), win ? 'secondary' : 'primary big', { 'data-autofocus': !win || !next });
  const el = h('main', { class: `screen results ${win ? 'win' : 'loss'}` },
    h('div', { class: 'sheet' },
      h('h1', {}, title),
      h('p', { class: 'small' }, `Round ${res.stats[0].shots ? '' : ''}${lvl ? `${lvl.id} ${lvl.name}` : ''}${res.how === 'Doze Off' ? '. Sir Pudge dozed off.' : ''}`),
      pens,
      h('p', { class: 'score' }, `Buttons +${res.buttons}`),
      res.bestShot && win ? h('p', { class: 'small' }, `Best shot: ${res.bestShot.hob}, ${(res.bestShot.angle / 10).toFixed(1)} / ${res.bestShot.power}, ${res.bestShot.dmg} dmg`) : '',
      !win && res.cause ? h('p', { class: 'cause' }, `"${res.cause}"`) : '',
      h('div', { class: 'row-btns' },
        btn('Map', () => app.go({ to: 'map', focus: setup.level }), 'secondary'),
        retry,
        !win && app.levelDone('1-5') ? btn('Fix it', () => app.go({ to: 'workshop' }), 'secondary') : '',
        nextBtn,
      ),
    ),
  );
  // Stamp the Pennants in, one at a time (skippable: a tap shows all).
  const stamps = [...pens.children] as HTMLElement[];
  const timers: number[] = [];
  const instant = app.settings.reduceMotion;
  stamps.forEach((s, i) => {
    if (instant) { s.classList.add('in'); return; }
    timers.push(window.setTimeout(() => { s.classList.add('in'); if (res.pennants[i]) play('pennant'); }, 400 + i * 500));
  });
  el.addEventListener('pointerdown', () => { timers.forEach(clearTimeout); stamps.forEach((s) => s.classList.add('in')); }, { once: true });
  return { el, destroy: () => timers.forEach(clearTimeout) };
}

function versusResults(app: App, setup: Extract<Route, { to: 'results' }>['setup'], res: ResultView): Screen {
  const duel = setup.mode === 'duel';
  const w = res.winner;
  const names = setup.sides.map((s) => s.name);
  if (duel && w >= 0) app.duelScore[names[w]] = (app.duelScore[names[w]] ?? 0) + 1;
  const title = w < 0 ? 'A draw!' : duel ? `${names[w]} wins!` : w === 0 ? 'You win!' : `${names[1]} wins`;
  const helpMark = (s: Side) => (setup.sides[s].help === 'some' ? ' +' : setup.sides[s].help === 'lots' ? ' ++' : '');
  const col = (s: Side) => h('div', { class: `statcol side${s}` },
    h('h3', {}, `${s === 0 ? '●' : '◆'} ${names[s]}${helpMark(s)}`),
    h('p', {}, `Shots ${res.stats[s].shots}   Hits ${res.stats[s].hits}`),
    h('p', {}, `Blocks broken ${res.stats[s].blocks}`),
    h('p', {}, `Kettle left ${res.stats[s].kettle}%`),
  );
  const order: Side[] = w === 1 ? [1, 0] : [0, 1];
  const rematchSetup = () => {
    const s = structuredClone(setup);
    s.seed = (s.seed * 1103515245 + 12345) >>> 0;
    if (w >= 0) s.first = (w === 0 ? 1 : 0); // the loser fires first
    return s;
  };
  const el = h('main', { class: 'screen results duel' },
    h('div', { class: 'sheet' },
      h('h1', { class: w >= 0 ? `side${w}` : '' }, title),
      h('p', { class: 'small' }, `${res.how}${w >= 0 && duel ? helpMark(w as Side) && ` (Help${helpMark(w as Side)})` : ''}`),
      h('div', { class: 'stats' }, col(order[0]), col(order[1])),
      res.bestShot ? h('p', { class: 'small' }, `Best shot: ${names[res.bestShot.side]}, Round ${res.bestShot.round}, ${res.bestShot.dmg} dmg`) : '',
      duel ? h('p', { class: 'tonight' }, `Tonight: ${names[0]} ${app.duelScore[names[0]] ?? 0} : ${app.duelScore[names[1]] ?? 0} ${names[1]}`) : '',
      h('div', { class: 'row-btns' },
        btn('Map', () => { app.duelScore = {}; app.go({ to: 'map' }); }, 'secondary'),
        btn('Change setup', () => app.go({ to: duel ? 'duel' : 'skirmish' }), 'secondary'),
        duel ? btn('Swap sides', () => { const s = structuredClone(setup); s.sides = [s.sides[1], s.sides[0]]; app.go({ to: 'battle', setup: s }); }, 'secondary') : '',
        btn('REMATCH', () => app.go({ to: 'battle', setup: rematchSetup() }), 'primary big', { 'data-autofocus': true }),
      ),
    ),
  );
  return { el };
}
