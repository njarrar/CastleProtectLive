// S16 Skirmish setup and S23 Couch Duel setup.
import { hashSeed, type App, type Screen } from '../app';
import type { BattleSetup, Blueprint, Help } from '../core/types';
import { btn, classBadge, h, seg } from '../ui/dom';
import { gear } from './home';

const MAPS: [string, string][] = [['two-tumps', 'Two Tumps'], ['long-dip', 'Long Dip'], ['knoll-hop', 'Knoll Hop']];

export function skirmishScreen(app: App): Screen {
  const last = app.lastSetup?.mode === 'skirmish' ? app.lastSetup : undefined;
  const st = {
    map: last?.map ?? 'two-tumps',
    difficulty: last?.difficulty ?? app.settings.difficulty,
    cap: String(last?.roundCap ?? 15) as '10' | '15' | '20',
    wind: last?.wind ?? 'light',
    shells: last?.shells ?? 'quick',
  };
  const start = () => {
    const crew = app.roster().slice(0, 4);
    const setup: BattleSetup = {
      mode: 'skirmish', map: st.map, seed: hashSeed(st.map) ^ Date.now(), difficulty: st.difficulty, windOff: st.wind === 'off',
      roundCap: Number(st.cap), wind: st.wind, shells: st.shells,
      sides: [
        { name: 'You', human: true, crew, blueprint: app.progress.blueprint },
        { name: 'Sir Pudge', human: false, crew: app.core.hobs().slice(0, 4).map((x) => x.id), blueprint: app.core.starterForts()[1] },
      ],
    };
    app.go({ to: 'battle', setup });
  };
  const el = h('main', { class: 'screen setup skirmish' },
    h('header', { class: 'topbar' }, btn('←', () => app.go({ to: 'modes' }), 'round-btn', { 'aria-label': 'Back' }), h('h1', {}, 'Skirmish'), gear(app, { to: 'skirmish' })),
    h('div', { class: 'sheet' },
      field('Map', seg(MAPS, st.map, (v) => (st.map = v))),
      field('Rival', seg([['cozy', 'Cozy'], ['fair', 'Fair'], ['stubborn', 'Stubborn']], st.difficulty, (v) => (st.difficulty = v))),
      field('Rounds', seg([['10', '10'], ['15', '15'], ['20', '20']], st.cap, (v) => (st.cap = v))),
      field('Wind', seg([['off', 'Off'], ['light', 'Light'], ['full', 'Full']], st.wind, (v) => (st.wind = v))),
      field('Shells', seg([['draft', 'Draft'], ['quick', 'Quick Pick'], ['plain', 'Plain only']], st.shells, (v) => (st.shells = v))),
      h('p', { class: 'small' }, 'Win by Knockout: Clean Sweep or Kettle Pop.'),
    ),
    h('footer', { class: 'pinned' }, btn('START', start, 'primary big', { 'data-autofocus': true })),
  );
  return { el };
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
  const rules = { map: last?.map ?? 'two-tumps', cap: String(last?.roundCap ?? 15) as '10' | '15' | '20', wind: last?.wind ?? 'light', shells: last?.shells ?? 'draft', seats: 'side' as 'side' | 'one' };
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

  function go(): void {
    app.progress.duelNames = [players[0].name, players[1].name];
    void app.saveProgress();
    const setup: BattleSetup = {
      mode: 'duel', map: rules.map, seed: hashSeed(rules.map) ^ (Date.now() & 0xffff), difficulty: 'fair',
      windOff: rules.wind === 'off', roundCap: Number(rules.cap), wind: rules.wind, shells: rules.shells,
      sides: [
        { name: players[0].name, human: true, crew: players[0].crew, blueprint: fortOf(players[0].fort), help: players[0].help },
        { name: players[1].name, human: true, crew: players[1].crew, blueprint: fortOf(players[1].fort), help: players[1].help },
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
      field('Map', seg(MAPS, rules.map, (v) => (rules.map = v))),
      field('Rounds', seg([['10', '10'], ['15', '15'], ['20', '20']], rules.cap, (v) => (rules.cap = v))),
      field('Wind', seg([['off', 'Off'], ['light', 'Light'], ['full', 'Full']], rules.wind, (v) => (rules.wind = v))),
      field('Shells', seg([['quick', 'Quick Pick'], ['plain', 'Plain only']], rules.shells === 'draft' ? 'quick' : rules.shells, (v) => (rules.shells = v))),
      field('Seats', seg([['side', 'Side by side'], ['one', 'One seat']], rules.seats, (v) => (rules.seats = v))),
    ),
    h('footer', { class: 'pinned' },
      btn('Quick start', () => { players[0].crew = hobs.slice(0, 5).map((x) => x.id); players[1].crew = hobs.slice(3, 8).map((x) => x.id); go(); }, 'secondary'),
      btn('FIGHT', go, 'primary big', { 'data-autofocus': true, 'data-testid': 'duel-fight' }),
    ),
  );
  return { el };
}
