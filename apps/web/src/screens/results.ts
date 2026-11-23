// S9 results with Pennants, and S25 duel results.
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import type { ResultView, Side } from '../core/types';
import { btn, h } from '../ui/dom';
import { clipCanvas } from '../ui/motion';
import { retrySetup } from '../battle/battle';
import { andList, byId, has, plural, rivalLine, rivalShort, t, type Vars } from '../ui/text';

export function resultsScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'results' }>;
  const setup = r.setup;
  const res = app.lastResult;
  if (!res) { queueMicrotask(() => app.go({ to: 'map' })); return { el: h('main', { class: 'screen' }) }; }
  if (setup.mode === 'duel' || setup.mode === 'skirmish') return versusResults(app, setup, res);

  const win = res.winner === 0;
  const lvl = app.levels().find((l) => l.id === setup.level);
  const how = res.howKey ?? res.how;
  const rival = rivalShort(res.rival ?? lvl?.rival, setup.level);
  const vars = { rival, captive: captiveOf(setup.level) };
  // Progress was written by the battle screen the moment the fight ended (app.recordResult).
  const title = resultTitle(res, win, setup.level, res.rival ?? lvl?.rival);
  // Under the title: on a win, how it was won and the Rival signs off; on a loss, the cause
  // (never the same words as the title) and one line from Hetty.
  const lines: (HTMLElement | string)[] = [];
  if (win) {
    // 1-1: Sir Pudge dozes off at the round cap (rivals.pudge.dozed).
    const dozed = how === 'round_cap' ? rivalLine('dozed', res.rival ?? lvl?.rival, setup.level) : '';
    const howLine = dozed || byId('results.win.how', how, vars);
    if (howLine && howLine !== title) lines.push(h('p', { class: 'how' }, howLine));
    const sign = rivalLine('sign_off', res.rival ?? lvl?.rival, setup.level);
    if (sign) lines.push(h('p', { class: 'signoff' }, sign));
  } else {
    const cause = lossCause(res, how, vars);
    if (cause && cause !== title) lines.push(h('p', { class: 'cause' }, cause));
    const cost = lossCost(res);
    if (cost) lines.push(h('p', { class: 'small' }, cost));
    const verdict = lossVerdict(res, how);
    // Hetty gives the verdict once she is on the crew; before 1-7 the line has no name on it.
    if (verdict) lines.push(h('p', { class: 'verdict' }, app.roster().includes('hetty') ? h('b', {}, `${t('results.loss.verdict_by')}: `) : '', verdict));
  }
  const pens = h('div', { class: 'pennants' }, ...(lvl?.goals ?? []).map((g, i) => h('div', {
    class: `pennant ${res.pennants[i] ? 'got' : ''}`, 'data-i': i, 'aria-label': t(res.pennants[i] ? 'pennants.got' : 'pennants.not_got', { goal: g }),
  }, h('i', { 'aria-hidden': 'true' }, '⚑'), h('span', { 'aria-hidden': 'true' }, g))));
  const next = app.levels()[app.levels().findIndex((l) => l.id === setup.level) + 1];
  const nextBtn = win && next ? btn(t('results.next'), () => app.go({ to: 'prebattle', level: next.id }), 'primary big', { 'data-autofocus': true }) : '';
  const retry = btn(t('results.again'), () => app.go({ to: 'battle', setup: retrySetup(setup) }), win ? 'secondary' : 'primary big', { 'data-autofocus': !win || !next });
  const best = res.bestShot && win ? h('p', { class: 'small' }, t('results.best_shot_long', { hob: res.bestShot.hob, n: res.bestShot.dmg, angle: (res.bestShot.angle / 10).toFixed(1), power: res.bestShot.power })) : '';
  const el = h('main', { class: `screen results ${win ? 'win' : 'loss'}` },
    h('div', { class: 'sheet' },
      h('h1', {}, title),
      h('p', { class: 'small' }, [lvl ? `${lvl.id} ${lvl.name}` : '', res.round ? t('results.round', { n: res.round }) : ''].filter(Boolean).join('. ')),
      ...lines,
      doublePopNote(res),
      pens,
      h('p', { class: 'score' }, clipCanvas('ui_button_coin_spin', 1, { still: app.settings.reduceMotion, cls: 'clip coin' }) ?? '',
        h('span', { 'aria-label': t('results.buttons_spoken', { n: res.buttons }) }, t('results.buttons', { n: res.buttons })),
        !win ? h('span', { class: 'small note' }, ` ${t('results.buttons_loss_note')}`) : ''),
      best,
      h('div', { class: 'row-btns' },
        btn(t('results.map'), () => app.go({ to: 'map', focus: setup.level }), 'secondary'),
        retry,
        !win && app.levelDone('1-5') ? btn(t('results.loss.fix_it'), () => app.go({ to: 'workshop' }), 'secondary') : '',
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
  const how = res.howKey ?? res.how;
  // Skirmish: the Rival's name as the core picked it (hud.names[1]).
  const names = setup.sides.map((s, i) => (!duel && i === 1 ? res.rival ?? s.name : s.name));
  // Scored by side, never by name: two players may share a name, and a name is any text.
  if (duel && (w === 0 || w === 1)) app.duelScore[w]++;
  const rival = rivalShort(names[1]);
  const title = w < 0 ? t('results.duel.draw')
    : duel ? t('results.duel.title', { name: names[w] })
    : resultTitle(res, w === 0, undefined, names[1]);
  const helpMark = (s: Side) => (setup.sides[s].help === 'some' || setup.sides[s].help === 'lots' ? t('setup.help.mark', { level: t(`setup.help.${setup.sides[s].help}`) }) : '');
  const statsOf = (s: Side) => res.stats[s];
  const col = (s: Side) => h('div', { class: `statcol side${s}` },
    h('h3', {}, `${s === 0 ? '●' : '◆'} ${names[s]}`),
    helpMark(s) ? h('p', { class: 'small' }, helpMark(s)) : '',
    res.score ? h('p', { class: 'siegescore', 'data-testid': `score-${s}` }, t('results.score', { a: res.score[s], b: res.score[s === 0 ? 1 : 0] })) : '',
    h('p', {}, t('results.stats', { shots: statsOf(s).shots, hits: statsOf(s).hits, bonks: statsOf(s).bonks ?? 0, blocks: statsOf(s).blocks, streak: statsOf(s).streak ?? 0 })),
    h('p', {}, t('results.kettle_left', { n: statsOf(s).kettle })),
    // The winner's own best shot, under the winner's name.
    res.bestShot && res.bestShot.side === s ? h('p', { class: 'small best' }, t('results.best_shot', { hob: res.bestShot.hob, n: res.bestShot.dmg })) : '',
  );
  const order: Side[] = w === 1 ? [1, 0] : [0, 1];
  const rematchSetup = () => {
    const s = structuredClone(setup);
    s.seed = (s.seed * 1103515245 + 12345) >>> 0;
    if (w >= 0) s.first = (w === 0 ? 1 : 0); // the loser fires first
    return s;
  };
  // Under the title: how it ended. Couch Duel and a Skirmish win use the win line; a Skirmish loss the cause.
  const sub = w >= 0 && (duel || w === 0) ? byId('results.win.how', how, { rival, captive: '' })
    : w === 1 ? byId('results.loss.cause', how, { rival }) : '';
  const el = h('main', { class: 'screen results duel' },
    h('div', { class: 'sheet' },
      h('h1', { class: w >= 0 ? `side${w}` : '' }, title),
      sub && sub !== title ? h('p', { class: 'small' }, sub) : '',
      !duel && w === 0 ? h('p', { class: 'signoff' }, rivalLine('sign_off', names[1])) : '',
      doublePopNote(res),
      h('div', { class: 'stats' }, col(order[0]), col(order[1])),
      duel ? h('p', { class: 'tonight' },
        h('span', { class: 't-lab' }, `${t('results.duel.tonight')}: `),
        h('span', { class: 't-name side0' }, names[0]),
        h('span', { class: 't-score' }, ` ${app.duelScore[0]} : ${app.duelScore[1]} `),
        h('span', { class: 't-name side1' }, names[1]),
      ) : '',
      duel && w >= 0 ? h('p', { class: 'small' }, t('results.duel.good_game')) : '',
      h('div', { class: 'row-btns' },
        btn(t('results.map'), () => { app.duelScore = [0, 0]; app.go({ to: 'map' }); }, 'secondary'),
        btn(t('results.change_setup'), () => app.go({ to: duel ? 'duel' : 'skirmish' }), 'secondary'),
        duel ? btn(t('results.swap_sides'), () => {
          const s = structuredClone(setup);
          s.sides = [s.sides[1], s.sides[0]];
          s.seed = (s.seed * 1103515245 + 12345) >>> 0;
          if (s.first !== undefined) s.first = s.first === 0 ? 1 : 0;
          app.duelScore = [app.duelScore[1], app.duelScore[0]];
          app.go({ to: 'battle', setup: s });
        }, 'secondary') : '',
        btn(t('results.rematch'), () => app.go({ to: 'battle', setup: rematchSetup() }), 'primary big', { 'data-autofocus': true, 'data-testid': 'rematch' }),
      ),
    ),
  );
  return { el };
}

/** A Double Pop names its winner by a rule nobody sees: say the real rule (QA-M6). */
function doublePopNote(res: ResultView): HTMLElement | string {
  return res.howKey === 'double_pop' ? h('p', { class: 'small', 'data-testid': 'double-pop-note' }, t('results.double_pop_rule')) : '';
}

function captiveOf(level?: string): string {
  return level && has(`levels.${level}.captive`) ? t(`levels.${level}.captive`) : t('hud.objects.captive');
}

/**
 * The results title (content/text.md "Results"): a campaign win is the level's own win title,
 * any other win `results.win.title.<how>`, a loss `results.loss.title.<how>`.
 */
export function resultTitle(res: ResultView, win: boolean, level?: string, rivalName?: string): string {
  const how = res.howKey ?? res.how;
  const vars = { rival: rivalShort(rivalName, level), captive: captiveOf(level) };
  if (win && level && has(`levels.${level}.win_title`)) return t(`levels.${level}.win_title`, vars);
  return byId(win ? 'results.win.title' : 'results.loss.title', how, vars);
}

/** `results.loss.cause.<how>`, with the last blow's Hob and shot where the line has room for them. */
function lossCause(res: ResultView, how: string, vars: Vars): string {
  const last = res.broke?.last;
  if (how === 'kettle_pop') {
    return last && last.by === 'hob' && last.hob && last.round
      ? t('results.loss.cause.kettle_pop', { who: last.hob, shot: last.shot, n: last.round })
      : last?.round ? t('results.loss.cause.kettle_pop_plain', { n: last.round }) : '';
  }
  if (how === 'clean_sweep') return t('results.loss.cause.clean_sweep_plain');
  return byId('results.loss.cause', how, vars);
}

/** What the loss cost: blocks and the Hobs that were Bonked, by name. */
function lossCost(res: ResultView): string {
  const b = res.broke;
  if (!b || (!b.blocksLost && !b.bonkedNames.length)) return '';
  const hobs = andList(b.bonkedNames);
  if (b.blocksLost && hobs) return t('results.loss.cost.blocks_and_hobs', { blocks: b.blocksLost, hobs });
  if (hobs) return t('results.loss.cost.hobs', { hobs });
  return plural('results.loss.cost.blocks', b.blocksLost);
}

/** One line from Hetty: by the last blow's `by` when it has a pool (ground, fatigue, self, shears), else by how. */
function lossVerdict(res: ResultView, how: string): string {
  const by = res.broke?.last?.by;
  if (by && by !== 'hob' && has(`results.loss.verdict.${by}`)) return t(`results.loss.verdict.${by}`);
  return byId('results.loss.verdict', how);
}
