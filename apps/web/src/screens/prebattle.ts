// S4: the pre-battle sheet, with the Rummage draft strip (07 §4.1).
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import { DEFAULT_BLUEPRINT } from '../core/content';
import type { BattleSetup, DraftChip, Snapshot } from '../core/types';
import { CLASS_COLOR, CLASS_ICON, btn, classBadge, h } from '../ui/dom';

export function prebattleScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'prebattle' }>;
  const lvl = app.levels().find((l) => l.id === r.level)!;
  const replay = (app.progress.levels[lvl.id]?.wins ?? 0) + (app.progress.levels[lvl.id]?.losses ?? 0) > 0;
  let setup: BattleSetup = app.campaignSetup(lvl.id);
  const roster = app.roster();
  const hobs = app.core.hobs();
  let picks: string[] = [];
  let focusChip: string | undefined;
  let snap: Snapshot | undefined;

  // A draft level makes the battle now, so the core runs the draft.
  function prepare(): void {
    if (!lvl.draft) return;
    app.core.newBattle(setup);
    for (const id of picks) app.core.command({ cmd: 'pick_shell', id });
    snap = app.core.snapshot();
  }
  prepare();

  const crewEl = h('div', { class: 'crew' });
  const draftEl = h('section', { class: 'draft' });
  const bpName = h('b', {}, setup.sides[0].blueprint?.name ?? DEFAULT_BLUEPRINT.name);

  function drawCrew(): void {
    crewEl.replaceChildren(
      ...setup.sides[0].crew.map((id) => {
        const hb = hobs.find((x) => x.id === id)!;
        return h('span', { class: 'portrait', style: `--c:${CLASS_COLOR[hb.cls]}`, title: hb.name }, CLASS_ICON[hb.cls], h('small', {}, hb.name));
      }),
      btn('Swap', () => openSwap(), 'secondary small'),
    );
  }

  function openSwap(): void {
    const box = h('div', { class: 'picker', role: 'dialog', 'aria-label': 'Pick crew' });
    const sel = new Set(setup.sides[0].crew);
    const paint = () => box.replaceChildren(
      h('p', { class: 'small' }, `Pick up to ${lvl.crewSize}.`),
      ...roster.map((id) => {
        const hb = hobs.find((x) => x.id === id)!;
        return btn(`${CLASS_ICON[hb.cls]} ${hb.name}`, () => {
          if (sel.has(id)) { if (sel.size > 1) sel.delete(id); } else if (sel.size < lvl.crewSize) sel.add(id);
          paint();
        }, `chip ${sel.has(id) ? 'on' : ''}`);
      }),
      btn('Done', () => {
        setup = app.campaignSetup(lvl.id, [...sel]);
        app.progress.lastCrew = [...sel];
        void app.saveProgress();
        box.remove();
        prepare();
        drawCrew();
        drawDraft();
      }, 'primary small'),
    );
    paint();
    crewEl.after(box);
  }

  function chip(c: DraftChip, d: NonNullable<Snapshot['draft']>): HTMLElement {
    const owner = c.owner;
    const b = btn(h('span', {}, c.name), () => {
      if (owner !== undefined || d.done) return;
      if (focusChip !== c.id) { focusChip = c.id; drawDraft(); return; }
      take(c.id);
    }, `chip shell ${owner === 0 ? 'mine' : owner === 1 ? 'theirs' : ''} ${focusChip === c.id ? 'focus' : ''}`, {
      'aria-label': `${c.name}${c.dud ? ', Dud' : ''}${owner === 0 ? ', yours' : owner === 1 ? ', theirs' : ''}`, 'data-shell': c.id,
    });
    if (c.weight) b.append(h('i', { class: 'cogs' }, '⚙'.repeat(c.weight)));
    if (c.dud) b.append(h('em', { class: 'dud' }, 'Dud'));
    if (d.wish === c.id && owner === undefined) b.append(h('em', { class: 'wish', title: 'The Rival wants this' }, '◆'));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); focusChip = c.id; drawDraft(); });
    return b;
  }

  function take(id: string): void {
    if (!app.core.command({ cmd: 'pick_shell', id }).ok) return;
    picks.push(id);
    play('tap');
    snap = app.core.snapshot();
    focusChip = undefined;
    drawDraft();
  }

  function drawDraft(): void {
    const d = snap?.draft;
    if (!lvl.draft || !d) { draftEl.hidden = true; return; }
    draftEl.hidden = false;
    const f = d.pool.find((p) => p.id === focusChip);
    const slot = (ids: string[], side: 0 | 1) => h('div', { class: `slots side${side}` }, ...Array.from({ length: d.perSide }, (_, i) => {
      const s = d.pool.find((p) => p.id === ids[i]);
      return h('span', { class: `slot ${s ? 'full' : ''}` }, s ? s.name : String(i + 1));
    }));
    draftEl.replaceChildren(
      h('div', { class: 'draft-head' }, h('b', {}, 'Draft'), h('span', { class: 'small' }, d.done ? 'Done' : `Your pick ${Math.min(d.perSide, d.picks[0].length + 1)} of ${d.perSide}`),
        btn('Quick Pick', () => { app.core.command({ cmd: 'quick_pick' }); snap = app.core.snapshot(); picks = [...(snap.draft?.picks[0] ?? picks)]; drawDraft(); }, 'secondary small', { disabled: d.done })),
      h('div', { class: 'pool' }, ...d.pool.map((c) => chip(c, d))),
      h('p', { class: 'hint' }, f ? `"${f.hint}"` : 'Tap a shell, tap again to take it.', f?.best ? h('span', {}, ' Best with ', classBadge(f.best)) : ''),
      h('div', { class: 'hands' }, h('span', {}, 'Yours'), slot(d.picks[0], 0), h('span', {}, 'Theirs'), slot(d.picks[1], 1)),
    );
  }

  const goals = h('ul', { class: 'goals' }, ...lvl.goals.map((g, i) => h('li', { class: app.progress.levels[lvl.id]?.pennants[i] ? 'got' : '' }, h('i', { 'aria-hidden': 'true' }, '⚑'), g)));
  const fight = btn('FIGHT', () => {
    if (lvl.draft && snap?.draft && !snap.draft.done) app.core.command({ cmd: 'end_draft' });
    app.go({ to: 'battle', setup, prepared: lvl.draft });
  }, 'primary big fightbtn', { 'data-autofocus': !replay, 'data-testid': 'fight' });
  const again = replay ? btn('Same again', () => fight.click(), 'secondary', { 'data-autofocus': true }) : '';
  const blueprints = [app.progress.blueprint, DEFAULT_BLUEPRINT].filter(Boolean);
  let bi = 0;
  const n = Number(lvl.id.split('-')[1]);

  const el = h('main', { class: 'screen prebattle' },
    h('div', { class: 'sheet' },
      h('header', { class: 'sheet-head' },
        h('span', { class: 'lvlid' }, lvl.id), h('h1', {}, lvl.name),
        h('span', { class: 'tag' }, lvl.type),
        h('span', { class: 'tag' }, lvl.id === '1-1' ? `Round cap ${lvl.roundCap}` : `Round cap ${lvl.roundCap}, then the Squall`),
        h('span', { class: 'tag' }, lvl.wind),
        lvl.draft ? h('span', { class: 'tag' }, 'Draft: pool 4, pick 2') : '',
        btn('✕', () => app.go({ to: 'map', focus: lvl.id }), 'round-btn close', { 'aria-label': 'Close' }),
      ),
      h('div', { class: 'cols' },
        h('section', { class: 'level' }, h('div', { class: 'thumb', 'aria-hidden': 'true' }, h('i', { class: 'f0' }), h('i', { class: 'f1' })), h('h3', {}, 'Goals'), goals),
        h('section', { class: 'rival' },
          h('div', { class: 'face', 'aria-hidden': 'true' }, lvl.rival.split(' ').map((w) => w[0]).join('').slice(0, 2)),
          h('div', {},
            h('h2', {}, lvl.rival, ' ', h('span', { class: 'ai' }, 'AI')),
            h('p', { class: 'aim' }, 'Aim ', '◆'.repeat(lvl.aim), '◇'.repeat(5 - lvl.aim)),
            h('p', { class: 'habit' }, h('i', { 'aria-hidden': 'true' }, '◆'), ` "${lvl.habit}"`),
            h('p', { class: 'theircrew' }, 'Their crew ', ...lvl.rivalCrew.map((c) => classBadge(c, 1))),
          ),
        ),
      ),
      h('section', { class: 'yourside' },
        h('div', {}, h('h3', {}, 'Crew'), h('p', { class: 'small' }, `${lvl.crewSize} ${lvl.crewSize === 1 ? 'seat' : 'seats'} now, 5 at most`)), crewEl,
        h('div', { class: 'bp' }, h('span', { class: 'small' }, 'Blueprint '), bpName,
          blueprints.length > 1 ? btn('Swap', () => { bi = (bi + 1) % blueprints.length; setup.sides[0].blueprint = blueprints[bi]; bpName.textContent = blueprints[bi]!.name; prepare(); drawDraft(); }, 'secondary small') : ''),
        h('div', { class: 'doodads' }, h('span', { class: 'small' }, 'Doodads '), h('b', {}, n >= 10 ? 'Mend Bucket, Pot Lid' : 'none yet')),
      ),
      draftEl,
      h('footer', { class: 'sheet-foot' }, h('p', { class: 'small' }, 'Nothing here needs a confirm.'), again, fight),
    ),
  );
  drawCrew();
  drawDraft();
  return { el };
}
