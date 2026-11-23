// S16 Skirmish setup and S23 Couch Duel setup.
import { hashSeed, type App, type Screen } from '../app';
import { play } from '../audio/sfx';
import type { BattleSetup, Blueprint, Difficulty, Help } from '../core/types';
import { btn, classBadge, h, seg } from '../ui/dom';
import { gear } from './home';
import { list, t } from '../ui/text';
import { hobSpriteName, sprites } from '../render/sprites';

/** Skirmish and duel maps come from the core's content (non-campaign levels). */
function mapsOf(app: App): [string, string][] {
  const m = app.core.maps?.() ?? [];
  return m.length ? m : [['d1', t('map.skirmish_maps.d1')]];
}
const pickMap = (app: App, id?: string) => (mapsOf(app).some(([k]) => k === id) ? id! : mapsOf(app)[0][0]);

export function skirmishScreen(app: App): Screen {
  const last = app.lastSetup?.mode === 'skirmish' ? app.lastSetup : undefined;
  const st = {
    map: pickMap(app, last?.map),
    difficulty: last?.difficulty ?? app.settings.difficulty,
    cap: String(last?.roundCap ?? 15) as '10' | '15' | '20',
    wind: last?.wind ?? 'light',
    shells: last?.shells ?? 'quick',
    winBy: (last?.volley ? String(last.volley) : 'ko') as WinBy,
  };
  // The seed is fixed when the screen opens (and when the map changes), so the Rival shown here
  // is the one the core picks: `rival.roster[seed % length]`. No Rival name goes in the setup.
  let seed = (hashSeed(st.map) ^ Date.now()) >>> 0;
  const rivalEl = h('div', { class: 'rival-line' });
  const showRival = () => {
    const rv = app.core.skirmishRival?.(st.map, seed);
    // The Rival's crew in the Rival look (portrait_<name>_rival), never your red hats.
    const faces = app.core.hobs().slice(0, 4).map((hb) => {
      const u = sprites.url(`portrait_${hobSpriteName(hb.id, hb.cls)}_rival`);
      return u ? h('img', { src: u, alt: '', class: 'portrait-img rival-face', title: hb.name }) : '';
    });
    rivalEl.replaceChildren(
      h('b', {}, rv?.name ?? t('setup.rival_is_game')),
      h('span', { class: 'rival-crew', 'aria-hidden': 'true' }, ...faces),
      rv?.habit ? h('p', { class: 'small habit' }, rv.habit) : '',
      h('p', { class: 'small' }, t('setup.rival_plays', { grade: t(`setup.difficulty.${st.difficulty}`) })),
    );
  };
  showRival();
  const start = () => {
    play('confirm');
    const crew = app.roster().slice(0, 4);
    let mine = app.progress.blueprint;
    if (mine && !app.core.checkFort(mine, crew.length).ok) { app.notice(t('setup.fort_swapped_plain')); mine = undefined; }
    const setup: BattleSetup = {
      mode: 'skirmish', map: st.map, seed, difficulty: st.difficulty, windOff: st.wind === 'off',
      roundCap: Number(st.cap), wind: st.wind, shells: st.shells, volley: st.winBy === 'ko' ? undefined : Number(st.winBy),
      sides: [
        { name: t('common.you'), human: true, crew, blueprint: mine },
        // No name: the core names the Rival from the map's roster by the seed (core/API.md).
        { name: '', human: false, crew: app.core.hobs().slice(0, 4).map((x) => x.id), blueprint: app.core.starterForts()[1] },
      ],
    };
    app.go({ to: 'battle', setup });
  };
  const el = h('main', { class: 'screen setup skirmish' },
    h('header', { class: 'topbar' }, btn('←', () => { play('back'); app.go({ to: 'modes' }); }, 'round-btn silent', { 'aria-label': t('common.back') }), h('h1', {}, t('setup.skirmish_title')), gear(app, { to: 'skirmish' })),
    h('div', { class: 'sheet' },
      field(t('setup.map'), seg(mapsOf(app), st.map, (v) => { st.map = v; seed = (hashSeed(v) ^ Date.now()) >>> 0; showRival(); })),
      field(t('setup.rival'), rivalEl),
      field(t('setup.difficulty.label'), seg(DIFFS(), st.difficulty, (v) => { st.difficulty = v; showRival(); })),
      field(t('setup.rounds'), seg([['10', '10'], ['15', '15'], ['20', '20']], st.cap, (v) => (st.cap = v))),
      field(t('setup.wind.label'), seg(WINDS(), st.wind, (v) => (st.wind = v))),
      field(t('setup.shells.label'), seg([['draft', t('setup.shells.draft')], ['quick', t('setup.shells.quick')], ['plain', t('setup.shells.plain')]], st.shells, (v) => (st.shells = v))),
      winByRow(st),
    ),
    h('footer', { class: 'pinned' }, btn(t('common.fight'), start, 'primary big silent', { 'data-autofocus': true, 'data-testid': 'skirmish-fight' })),
  );
  return { el };
}

type WinBy = 'ko' | '6' | '10' | '14';
const DIFFS = (): [Difficulty, string][] => [['cozy', t('setup.difficulty.cozy')], ['fair', t('setup.difficulty.fair')], ['stubborn', t('setup.difficulty.stubborn')]];
const WINDS = (): ['off' | 'light' | 'full', string][] => [['off', t('setup.wind.off')], ['light', t('setup.wind.light')], ['full', t('setup.wind.full')]];
/** Win by: Knockout (Clean Sweep or Kettle Pop) or Volley Points, a fixed number of shots each (07 §4.7). */
function winByRow(st: { winBy: WinBy }): HTMLElement {
  const note = h('p', { class: 'small' });
  const say = () => { note.textContent = st.winBy === 'ko' ? t('setup.win_by.knockout_rule') : t('setup.win_by.volley_rule', { n: st.winBy }); };
  say();
  const lab = t('setup.win_by.label');
  return h('div', {}, field(lab, seg([['ko', t('setup.win_by.knockout')], ['6', t('setup.win_by.volley', { n: 6 })], ['10', t('setup.win_by.volley', { n: 10 })], ['14', t('setup.win_by.volley', { n: 14 })]], st.winBy, (v) => { st.winBy = v; say(); }, lab)), note);
}

function field(label: string, ctl: HTMLElement, hint?: string): HTMLElement {
  return h('div', { class: 'field-row' }, h('span', { class: 'lab', title: hint }, label), ctl);
}

/** The one Couch Duel name list, shared by every platform (content/text.json names.duel). */
const silly = (): string[] => list('names.duel');

export function duelScreen(app: App): Screen {
  const hobs = app.core.hobs();
  const forts = app.core.starterForts();
  const mine = app.progress.blueprint;
  const last = app.lastSetup?.mode === 'duel' ? app.lastSetup : undefined;
  const fortIdx = (bp?: Blueprint): number => {
    if (!bp) return 0;
    if (mine && !bp.id && bp.name === mine.name) return forts.length;
    const k = forts.findIndex((f) => (bp.id && f.id === bp.id) || f.name === bp.name);
    return k >= 0 ? k : 0;
  };
  type P = { name: string; fort: number; crew: string[]; help: Help };
  // Default to symmetric Starter Box forts (0 vs 0, Oak) and preserve prior selections on Change setup (QA-M8 / Web-M15).
  const players: [P, P] = [
    { name: last?.sides[0].name ?? app.progress.duelNames[0], fort: last ? fortIdx(last.sides[0].blueprint) : 0, crew: last?.sides[0].crew ?? hobs.slice(0, 5).map((x) => x.id), help: last?.sides[0].help ?? 'none' },
    { name: last?.sides[1].name ?? app.progress.duelNames[1], fort: last ? fortIdx(last.sides[1].blueprint) : 0, crew: (last?.sides[1].crew ?? hobs.slice(0, 5).map((x) => x.id)).map((c) => c.replace(/^p2_/, '')), help: last?.sides[1].help ?? 'none' },
  ];
  // Default Shells stays 'quick' for one-tap start while 'draft' is selectable and opens the in-battle Draft modal (Web-H10).
  const rules = {
    map: pickMap(app, last?.map),
    cap: String(last?.roundCap ?? 15) as '10' | '15' | '20',
    wind: last?.wind ?? 'light',
    shells: last?.shells ?? 'quick',
    seats: (last?.seats ?? 'side') as 'side' | 'one',
    winBy: (last?.volley ? String(last.volley) : 'ko') as WinBy,
  };
  const cards = h('div', { class: 'duelcards' });

  const fortOf = (i: number): Blueprint | undefined => (i < forts.length ? forts[i] : mine);
  function card(i: 0 | 1): HTMLElement {
    const p = players[i];
    const name = h('input', { class: 'name', value: p.name, maxlength: 12, 'aria-label': t('setup.player_name', { n: i + 1 }) }) as HTMLInputElement;
    name.addEventListener('input', () => (p.name = name.value.trim() || t('setup.player_label', { n: i + 1 })));
    const crewRow = h('div', { class: 'crew' });
    const paintCrew = () => crewRow.replaceChildren(...p.crew.map((id) => classBadge(hobs.find((x) => x.id === id)?.cls ?? 'lobber', i)), btn(t('common.swap'), () => openPicker(i, crewRow, paintCrew), 'secondary small', { 'aria-label': t('setup.pick_crew') }));
    paintCrew();
    const fortOpts: [string, string][] = forts.map((f, k) => [String(k), f.name]);
    if (mine) fortOpts.push([String(forts.length), t('setup.fort_mine', { name: mine.name })]);
    return h('section', { class: `pcard side${i}` },
      h('div', { class: 'phead' }, h('span', { class: `crest ${i ? 'diamond' : 'round'}`, 'aria-hidden': 'true' }, '⚑'), h('b', { title: t(i ? 'setup.player_side_right' : 'setup.player_side_left') }, t('setup.player_label', { n: i + 1 })), name,
        btn('⚄', () => {
          // A new name from the one list, never the other player's and never the same one again.
          const pool = silly().filter((x) => x !== p.name && x !== players[i === 0 ? 1 : 0].name);
          p.name = pool[Math.floor(Math.random() * pool.length)] ?? p.name;
          name.value = p.name;
        }, 'round-btn dice', { 'aria-label': t('setup.silly_name_hint', { n: i + 1 }), title: t('setup.silly_name') })),
      field(t('setup.fort'), seg(fortOpts, String(p.fort), (v) => (p.fort = Number(v)))),
      field(t('setup.crew'), crewRow),
      field(t('setup.help.label'), seg([['none', t('setup.help.none')], ['some', t('setup.help.some')], ['lots', t('setup.help.lots')]], p.help, (v) => (p.help = v)), t('setup.help.what')),
    );
  }
  function openPicker(i: 0 | 1, after: HTMLElement, done: () => void): void {
    // Toggle/replace one picker per player card so repeated taps never stack duplicates (Web-M15).
    const existing = after.parentElement?.querySelector('.picker');
    if (existing) { existing.remove(); return; }
    const p = players[i];
    const sel = new Set(p.crew);
    const box = h('div', { class: 'picker' });
    const paint = () => box.replaceChildren(...hobs.map((hb) => btn(hb.name, () => {
      if (sel.has(hb.id)) { if (sel.size > 1) sel.delete(hb.id); } else if (sel.size < 5) sel.add(hb.id);
      paint();
    }, `chip ${sel.has(hb.id) ? 'on' : ''}`)), btn(t('common.done'), () => { p.crew = [...sel]; box.remove(); done(); }, 'primary small'));
    paint();
    after.after(box);
  }
  function paint(): void { cards.replaceChildren(card(0), card(1)); }
  paint();

  /** The chosen fort if the core says it seats that crew; else a content fort that does, with a note. */
  function fortFit(i: 0 | 1): Blueprint | undefined {
    const p = players[i];
    const f = fortOf(p.fort);
    if (!f || app.core.checkFort(f, p.crew.length).ok) return f;
    const alt = app.core.fortFor(p.crew.length);
    // {fort} may open a sentence ("the Wobbly"): give it a capital there.
    app.notice(t('setup.fort_swapped', { name: p.name, n: p.crew.length, fort: t('setup.fort_default_name') }).replace(/\. ([a-z])/g, (_m, c: string) => `. ${c.toUpperCase()}`));
    return alt;
  }

  function go(): void {
    play('confirm');
    app.progress.duelNames = [players[0].name, players[1].name];
    void app.saveProgress();
    const forts2: [Blueprint | undefined, Blueprint | undefined] = [fortFit(0), fortFit(1)];
    const previewFor = (help: Help): number | undefined => (help === 'lots' ? 100 : help === 'some' ? 60 : undefined);
    const setup: BattleSetup = {
      mode: 'duel', map: rules.map, seed: hashSeed(rules.map) ^ (Date.now() & 0xffff), difficulty: 'fair',
      windOff: rules.wind === 'off', roundCap: Number(rules.cap), wind: rules.wind, shells: rules.shells, volley: rules.winBy === 'ko' ? undefined : Number(rules.winBy),
      sides: [
        { name: players[0].name, human: true, crew: players[0].crew, blueprint: forts2[0], help: players[0].help, previewPct: previewFor(players[0].help) },
        { name: players[1].name, human: true, crew: players[1].crew, blueprint: forts2[1], help: players[1].help, previewPct: previewFor(players[1].help) },
      ],
    };
    setup.seats = rules.seats;
    app.go({ to: 'battle', setup });
  }

  const el = h('main', { class: 'screen setup duel' },
    h('header', { class: 'topbar' },
      btn('←', () => { play('back'); app.go({ to: 'map' }); }, 'round-btn silent', { 'aria-label': t('common.back') }),
      h('h1', {}, t('setup.duel_title')),
      btn(t('setup.swap_sides'), () => {
        players.reverse();
        app.duelScore = [app.duelScore[1], app.duelScore[0]];
        paint();
      }, 'secondary small'),
    ),
    h('p', { class: 'small sub' }, `${t('modes.duel.line')} ${t('app.promise')}`),
    cards,
    h('section', { class: 'rules sheet' },
      field(t('setup.map'), seg(mapsOf(app), rules.map, (v) => (rules.map = v))),
      field(t('setup.rounds'), seg([['10', '10'], ['15', '15'], ['20', '20']], rules.cap, (v) => (rules.cap = v))),
      field(t('setup.wind.label'), seg(WINDS(), rules.wind, (v) => (rules.wind = v))),
      field(t('setup.shells.label'), seg([['quick', t('setup.shells.quick')], ['draft', t('setup.shells.draft')], ['plain', t('setup.shells.plain')]], rules.shells, (v) => (rules.shells = v))),
      field(t('setup.seats.label'), seg([['side', t('setup.seats.side_by_side')], ['one', t('setup.seats.one_seat')]], rules.seats, (v) => (rules.seats = v))),
      winByRow(rules),
    ),
    h('footer', { class: 'pinned' },
      btn(t('setup.quick_start'), () => { players[0].crew = hobs.slice(0, 5).map((x) => x.id); players[1].crew = hobs.slice(3, 8).map((x) => x.id); go(); }, 'secondary silent'),
      btn(t('common.fight'), go, 'primary big silent', { 'data-autofocus': true, 'data-testid': 'duel-fight' }),
    ),
  );
  return { el };
}
