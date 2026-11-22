// S9 results with Pennants, and S25 duel results.
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import type { ResultView, Side } from '../core/types';
import { btn, h } from '../ui/dom';
import { clipCanvas } from '../ui/motion';

export function resultsScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'results' }>;
  const setup = r.setup;
  const res = app.lastResult;
  if (!res) { queueMicrotask(() => app.go({ to: 'map' })); return { el: h('main', { class: 'screen' }) }; }
  if (setup.mode === 'duel' || setup.mode === 'skirmish') return versusResults(app, setup, res);

  const win = res.winner === 0;
  const lvl = app.levels().find((l) => l.id === setup.level);
  // Progress was written by the battle screen the moment the fight ended (app.recordResult).
  const title = resultTitle(res, win, lvl?.rival);
  const pens = h('div', { class: 'pennants' }, ...(lvl?.goals ?? []).map((g, i) => h('div', { class: `pennant ${res.pennants[i] ? 'got' : ''}`, 'data-i': i },
    h('i', { 'aria-hidden': 'true' }, '⚑'), h('span', {}, g))));
  const next = app.levels()[app.levels().findIndex((l) => l.id === setup.level) + 1];
  const nextBtn = win && next ? btn('Next', () => app.go({ to: 'prebattle', level: next.id }), 'primary big', { 'data-autofocus': true }) : '';
  const retry = btn('Retry', () => app.go({ to: 'battle', setup }), win ? 'secondary' : 'primary big', { 'data-autofocus': !win || !next });
  const el = h('main', { class: `screen results ${win ? 'win' : 'loss'}` },
    h('div', { class: 'sheet' },
      h('h1', {}, title),
      h('p', { class: 'small' }, `${lvl ? `${lvl.id} ${lvl.name}` : ''}${res.round ? `, Round ${res.round}` : ''}`),
      pens,
      h('p', { class: 'score' }, clipCanvas('ui_button_coin_spin', 1, { still: app.settings.reduceMotion, cls: 'clip coin' }) ?? '', `Buttons +${res.buttons}`),
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
  // An earned Pennant plays ui_pennant_earn (its ding is the stamp sound), then holds ui_pennant.
  const stamp = (s: HTMLElement, i: number, quick: boolean) => {
    s.classList.add('in');
    const icon = s.querySelector('i');
    if (!icon || s.dataset.stamped) return;
    s.dataset.stamped = '1';
    if (!res.pennants[i]) return;
    const cv = clipCanvas('ui_pennant_earn', 2, { still: quick, reverse: quick, sink: (ev) => { if (ev === 'ding') play('pennant'); }, cls: 'clip pen' });
    if (cv) icon.replaceWith(cv);
    else if (!quick) play('pennant');
  };
  stamps.forEach((s, i) => {
    if (instant) { stamp(s, i, true); return; }
    timers.push(window.setTimeout(() => stamp(s, i, false), 400 + i * 500));
  });
  el.addEventListener('pointerdown', () => { timers.forEach(clearTimeout); stamps.forEach((s, i) => stamp(s, i, true)); }, { once: true });
  return { el, destroy: () => timers.forEach(clearTimeout) };
}

function versusResults(app: App, setup: Extract<Route, { to: 'results' }>['setup'], res: ResultView): Screen {
  const duel = setup.mode === 'duel';
  const w = res.winner;
  const names = setup.sides.map((s) => s.name);
  // Scored by side, never by name: two players may share a name, and a name is any text.
  if (duel && (w === 0 || w === 1)) app.duelScore[w]++;
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
      h('p', { class: 'small' }, `${resultTitle(res, true, w >= 0 ? names[w === 0 ? 1 : 0] : undefined).replace(/!$/, '')}${w >= 0 && duel ? helpMark(w as Side) && ` (Help${helpMark(w as Side)})` : ''}`),
      h('div', { class: 'stats' }, col(order[0]), col(order[1])),
      res.bestShot ? h('p', { class: 'small' }, `Best shot: ${names[res.bestShot.side]}, Round ${res.bestShot.round}, ${res.bestShot.dmg} dmg`) : '',
      duel ? h('p', { class: 'tonight' }, `Tonight: ${names[0]} ${app.duelScore[0]} : ${app.duelScore[1]} ${names[1]}`) : '',
      h('div', { class: 'row-btns' },
        btn('Map', () => { app.duelScore = [0, 0]; app.go({ to: 'map' }); }, 'secondary'),
        btn('Change setup', () => app.go({ to: duel ? 'duel' : 'skirmish' }), 'secondary'),
        duel ? btn('Swap sides', () => { const s = structuredClone(setup); s.sides = [s.sides[1], s.sides[0]]; app.duelScore = [app.duelScore[1], app.duelScore[0]]; app.go({ to: 'battle', setup: s }); }, 'secondary') : '',
        btn('REMATCH', () => app.go({ to: 'battle', setup: rematchSetup() }), 'primary big', { 'data-autofocus': true }),
      ),
    ),
  );
  return { el };
}

/** One title per `how` from core/API.md, for the winner's side or the loser's. */
export function resultTitle(res: ResultView, win: boolean, rival = 'The Rival'): string {
  const k = res.howKey ?? '';
  if (win) {
    return ({
      clean_sweep: 'Clean Sweep!', kettle_pop: 'Kettle Pop!', squall: 'Squall Pop!', double_pop: 'Double Pop!',
      rescue: 'Rescued!', round_cap: `${rival} dozed off!`, total_hp: 'Won on points!',
      give_up: `${rival} gave up!`, volley_points: 'Won on Volley Points!', captive_bonked: 'Captive Bonked: you win!',
    } as Record<string, string>)[k] ?? `${res.how}!`;
  }
  return ({
    clean_sweep: 'Swept', kettle_pop: 'Kettle popped', squall: 'Squalled', double_pop: 'Double Pop',
    rescue: 'Rescue failed', round_cap: 'Out of rounds', total_hp: 'Lost on points',
    give_up: 'You gave up', volley_points: 'Lost on Volley Points', captive_bonked: 'Captive Bonked',
  } as Record<string, string>)[k] ?? 'Flattened';
}
