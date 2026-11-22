// S16 Skirmish setup and S23 Couch Duel setup.
import { hashSeed, type App, type Screen } from '../app';
import type { BattleSetup, Blueprint, Help } from '../core/types';
import { btn, classBadge, h, seg } from '../ui/dom';
import { gear } from './home';

/** Skirmish and duel maps come from the core's content (non-campaign levels). */
function mapsOf(app: App): [string, string][] {
  const m = app.core.maps?.() ?? [];
  return m.length ? m : [['d1', 'Map 1']];
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
  const start = () => {
    const crew = app.roster().slice(0, 4);
    let mine = app.progress.blueprint;
    if (mine && !app.core.checkFort(mine, crew.length).ok) { app.notice('Your fort cannot take this crew, so you get a standard fort.'); mine = undefined; }
    const setup: BattleSetup = {
      mode: 'skirmish', map: st.map, seed: hashSeed(st.map) ^ Date.now(), difficulty: st.difficulty, windOff: st.wind === 'off',
      roundCap: Number(st.cap), wind: st.wind, shells: st.shells, volley: st.winBy === 'ko' ? undefined : Number(st.winBy),
      sides: [
        { name: 'You', human: true, crew, blueprint: mine },
        { name: 'Sir Pudge', human: false, crew: app.core.hobs().slice(0, 4).map((x) => x.id), blueprint: app.core.starterForts()[1] },
      ],
    };
    app.go({ to: 'battle', setup });
  };
  const el = h('main', { class: 'screen setup skirmish' },
    h('header', { class: 'topbar' }, btn('←', () => app.go({ to: 'modes' }), 'round-btn', { 'aria-label': 'Back' }), h('h1', {}, 'Skirmish'), gear(app, { to: 'skirmish' })),
    h('div', { class: 'sheet' },
      field('Map', seg(mapsOf(app), st.map, (v) => (st.map = v))),
      field('Rival', seg([['cozy', 'Cozy'], ['fair', 'Fair'], ['stubborn', 'Stubborn']], st.difficulty, (v) => (st.difficulty = v))),
      field('Rounds', seg([['10', '10'], ['15', '15'], ['20', '20']], st.cap, (v) => (st.cap = v))),
      field('Wind', seg([['off', 'Off'], ['light', 'Light'], ['full', 'Full']], st.wind, (v) => (st.wind = v))),
      field('Shells', seg([['draft', 'Draft'], ['quick', 'Quick Pick'], ['plain', 'Plain only']], st.shells, (v) => (st.shells = v))),
      winByRow(st),
    ),
    h('footer', { class: 'pinned' }, btn('START', start, 'primary big', { 'data-autofocus': true })),
  );
  return { el };
}

type WinBy = 'ko' | '6' | '10' | '14';
/** Win by: Knockout (Clean Sweep or Kettle Pop) or Volley Points, a fixed number of shots each (07 §4.7). */
function winByRow(st: { winBy: WinBy }): HTMLElement {
  const note = h('p', { class: 'small' });
  const say = () => { note.textContent = st.winBy === 'ko' ? 'Knockout: Clean Sweep or Kettle Pop.' : `Volley Points: ${st.winBy} shots each, the higher Siege Score wins. No round cap, no Squall.`; };
  say();
  return h('div', {}, field('Win by', seg([['ko', 'Knockout'], ['6', 'Volley 6'], ['10', 'Volley 10'], ['14', 'Volley 14']], st.winBy, (v) => { st.winBy = v; say(); }, 'Win by')), note);
}

function field(label: string, ctl: HTMLElement): HTMLElement {
  return h('div', { class: 'field-row' }, h('span', { class: 'lab' }, label), ctl);
}

const SILLY = ['Mabel', 'Otis', 'Captain Crumb', 'Dot', 'Big Gus', 'Pip', 'Nell', 'Biscuit', 'Wally', 'Fig', 'Rosie', 'Sprout', 'Lady Lump', 'Tug', 'Bramble', 'Pudding'];

export function duelScreen(app: App): Screen {
  const hobs = app.core.hobs();
  const forts = app.core.starterForts();
  const mine = app.progress.blueprint;
  const last = app.lastSetup?.mode === 'duel' ? app.lastSetup : undefined;
  type P = { name: string; fort: number; crew: string[]; help: Help };
  const players: [P, P] = [
    { name: last?.sides[0].name ?? app.progress.duelNames[0], fort: 1, crew: last?.sides[0].crew ?? hobs.slice(0, 5).map((x) => x.id), help: last?.sides[0].help ?? 'none' },
    { name: last?.sides[1].name ?? app.progress.duelNames[1], fort: 0, crew: (last?.sides[1].crew ?? hobs.slice(0, 5).map((x) => x.id)).map((c) => c.replace(/^p2_/, '')), help: last?.sides[1].help ?? 'none' },
  ];
  const rules = { map: pickMap(app, last?.map), cap: String(last?.roundCap ?? 15) as '10' | '15' | '20', wind: last?.wind ?? 'light', shells: last?.shells ?? 'draft', seats: 'side' as 'side' | 'one', winBy: (last?.volley ? String(last.volley) : 'ko') as WinBy };
  const cards = h('div', { class: 'duelcards' });

  const fortOf = (i: number): Blueprint | undefined => (i < forts.length ? forts[i] : mine);
  function card(i: 0 | 1): HTMLElement {
    const p = players[i];
    const name = h('input', { class: 'name', value: p.name, maxlength: 12, 'aria-label': `Player ${i + 1} name` }) as HTMLInputElement;
    name.addEventListener('input', () => (p.name = name.value.trim() || `Player ${i + 1}`));
    const crewRow = h('div', { class: 'crew' });
    const paintCrew = () => crewRow.replaceChildren(...p.crew.map((id) => classBadge(hobs.find((x) => x.id === id)?.cls ?? 'lobber', i)), btn('swap', () => openPicker(i, crewRow, paintCrew), 'secondary small'));
    paintCrew();
    const fortOpts: [string, string][] = forts.map((f, k) => [String(k), f.name]);
    if (mine) fortOpts.push([String(forts.length), `Mine: ${mine.name}`]);
    return h('section', { class: `pcard side${i}` },
      h('div', { class: 'phead' }, h('span', { class: `crest ${i ? 'diamond' : 'round'}`, 'aria-hidden': 'true' }, '⚑'), h('b', {}, `PLAYER ${i + 1}`), name,
        btn('⚄', () => { p.name = SILLY[Math.floor(Math.random() * SILLY.length)]; name.value = p.name; }, 'round-btn dice', { 'aria-label': 'Silly name' })),
      field('Fort', seg(fortOpts, String(p.fort), (v) => (p.fort = Number(v)))),
      field('Crew', crewRow),
      field('Help', seg([['none', 'None'], ['some', 'Some'], ['lots', 'Lots']], p.help, (v) => (p.help = v))),
    );
  }
  function openPicker(i: 0 | 1, after: HTMLElement, done: () => void): void {
    const p = players[i];
    const sel = new Set(p.crew);
    const box = h('div', { class: 'picker' });
    const paint = () => box.replaceChildren(...hobs.map((hb) => btn(hb.name, () => {
      if (sel.has(hb.id)) { if (sel.size > 1) sel.delete(hb.id); } else if (sel.size < 5) sel.add(hb.id);
      paint();
    }, `chip ${sel.has(hb.id) ? 'on' : ''}`)), btn('Done', () => { p.crew = [...sel]; box.remove(); done(); }, 'primary small'));
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
    app.notice(`${p.name}: that fort cannot take ${p.crew.length} Hobs, so ${alt?.name ?? 'a standard fort'} is used.`);
    return alt;
  }

  function go(): void {
    app.progress.duelNames = [players[0].name, players[1].name];
    void app.saveProgress();
    const forts2: [Blueprint | undefined, Blueprint | undefined] = [fortFit(0), fortFit(1)];
    const setup: BattleSetup = {
      mode: 'duel', map: rules.map, seed: hashSeed(rules.map) ^ (Date.now() & 0xffff), difficulty: 'fair',
      windOff: rules.wind === 'off', roundCap: Number(rules.cap), wind: rules.wind, shells: rules.shells, volley: rules.winBy === 'ko' ? undefined : Number(rules.winBy),
      sides: [
        { name: players[0].name, human: true, crew: players[0].crew, blueprint: forts2[0], help: players[0].help },
        { name: players[1].name, human: true, crew: players[1].crew, blueprint: forts2[1], help: players[1].help },
      ],
    };
    setup.seats = rules.seats;
    if (rules.shells === 'draft') setup.shells = 'quick'; // the duel draft card comes later; Quick Pick keeps one tap
    app.go({ to: 'battle', setup });
  }

  const el = h('main', { class: 'screen setup duel' },
    h('header', { class: 'topbar' },
      btn('←', () => app.go({ to: 'map' }), 'round-btn', { 'aria-label': 'Back' }),
      h('h1', {}, 'Couch Duel'),
      btn('Swap sides', () => { players.reverse(); paint(); }, 'secondary small'),
    ),
    h('p', { class: 'small sub' }, '2 players, 1 device. Free forever, no ads.'),
    cards,
    h('section', { class: 'rules sheet' },
      field('Map', seg(mapsOf(app), rules.map, (v) => (rules.map = v))),
      field('Rounds', seg([['10', '10'], ['15', '15'], ['20', '20']], rules.cap, (v) => (rules.cap = v))),
      field('Wind', seg([['off', 'Off'], ['light', 'Light'], ['full', 'Full']], rules.wind, (v) => (rules.wind = v))),
      field('Shells', seg([['quick', 'Quick Pick'], ['plain', 'Plain only']], rules.shells === 'draft' ? 'quick' : rules.shells, (v) => (rules.shells = v))),
      field('Seats', seg([['side', 'Side by side'], ['one', 'One seat']], rules.seats, (v) => (rules.seats = v))),
      winByRow(rules),
    ),
    h('footer', { class: 'pinned' },
      btn('Quick start', () => { players[0].crew = hobs.slice(0, 5).map((x) => x.id); players[1].crew = hobs.slice(3, 8).map((x) => x.id); go(); }, 'secondary'),
      btn('FIGHT', go, 'primary big', { 'data-autofocus': true, 'data-testid': 'duel-fight' }),
    ),
  );
  return { el };
}
