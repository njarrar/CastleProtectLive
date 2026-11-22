// S4: the pre-battle sheet, with the Rummage draft strip (07 §4.1).
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import { LEVEL_FORT } from '../core/bp';
import type { BattleSetup, DraftChip, Snapshot } from '../core/types';
import { CLASS_COLOR, CLASS_ICON, btn, classBadge, h } from '../ui/dom';

export function prebattleScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'prebattle' }>;
  const found = app.levels().find((l) => l.id === r.level);
  if (!found) throw new Error(`There is no level ${r.level}.`);
  const lvl = found;
  const replay = (app.progress.levels[lvl.id]?.wins ?? 0) + (app.progress.levels[lvl.id]?.losses ?? 0) > 0;
  let setup: BattleSetup & { fortNote?: string } = app.campaignSetup(lvl.id);
  const roster = app.roster();
  const hobs = app.core.hobs();
  let picks: string[] = [];
  let focusChip: string | undefined;
  let snap: Snapshot | undefined;

  const warn = h('p', { class: 'warn', role: 'alert', hidden: true });
  function say(text?: string): void { warn.textContent = text ?? ''; warn.hidden = !text; }

  /**
   * Build the battle in the core. If the core refuses the player's fort, use the level's own
   * fort and say why; any other refusal is shown on the sheet and FIGHT stays on the sheet.
   */
  function build(): boolean {
    const make = () => {
      app.core.newBattle(setup);
      for (const id of picks) app.core.command({ cmd: 'pick_shell', id });
      snap = app.core.snapshot();
    };
    try {
      make();
      return true;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      if (setup.sides[0].blueprint && setup.sides[0].blueprint.id !== LEVEL_FORT.id) {
        setup.sides[0].blueprint = LEVEL_FORT;
        bpName.textContent = LEVEL_FORT.name;
        try {
          make();
          say(`Your fort cannot take this fight (${why}). Using the level's fort.`);
          return true;
        } catch (e2) {
          say(`This fight cannot start: ${e2 instanceof Error ? e2.message : String(e2)}`);
          return false;
        }
      }
      say(`This fight cannot start: ${why}`);
      return false;
    }
  }
  // A draft level makes the battle now, so the core runs the draft.
  function prepare(): void { if (lvl.draft) build(); }

  const crewEl = h('div', { class: 'crew' });
  const draftEl = h('section', { class: 'draft' });
  const bpName = h('b', {}, setup.sides[0].blueprint?.name ?? LEVEL_FORT.name);
  prepare();
  if (setup.fortNote) say(setup.fortNote);

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
        say(setup.fortNote);
        bpName.textContent = setup.sides[0].blueprint?.name ?? LEVEL_FORT.name;
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
    // The battle is built here so a refusal shows on this sheet; FIGHT never fails silently.
    if (!lvl.draft && !build()) return;
    if (!snap) return;
    if (snap.draft && !snap.draft.done) app.core.command({ cmd: 'end_draft' });
    const { fortNote: _n, ...clean } = setup;
    app.go({ to: 'battle', setup: clean, prepared: true });
  }, 'primary big fightbtn', { 'data-autofocus': !replay, 'data-testid': 'fight' });
  const again = replay ? btn('Same again', () => fight.click(), 'secondary', { 'data-autofocus': true }) : '';
  // Offer the Workshop fort only when the core says it seats this crew.
  const blueprints = [app.progress.blueprint, LEVEL_FORT].filter((b) => b && (b === LEVEL_FORT || app.core.checkFort(b, setup.sides[0].crew.length).ok));
  let bi = 0;

  const el = h('main', { class: 'screen prebattle' },
    h('div', { class: 'sheet' },
      h('header', { class: 'sheet-head' },
        h('span', { class: 'lvlid' }, lvl.id), h('h1', {}, lvl.name),
        h('span', { class: 'tag' }, lvl.type),
        h('span', { class: 'tag' }, lvl.id === '1-1' ? `Round cap ${lvl.roundCap}` : `Round cap ${lvl.roundCap}, then the Squall`),
        h('span', { class: 'tag' }, lvl.wind),
        lvl.draft ? h('span', { class: 'tag' }, `Draft: pool ${lvl.draftPool}, pick ${lvl.draftPicks}`) : '',
        btn('✕', () => app.go({ to: 'map', focus: lvl.id }), 'round-btn close', { 'aria-label': 'Close' }),
      ),
      h('div', { class: 'cols' },
        h('section', { class: 'level' }, h('div', { class: 'thumb', 'aria-hidden': 'true' }, h('i', { class: 'f0' }), h('i', { class: 'f1' })), h('h3', {}, 'Goals'), goals),
        h('section', { class: 'rival' },
          h('div', { class: 'face', 'aria-hidden': 'true' }, lvl.rival.split(' ').map((w) => w[0]).join('').slice(0, 2)),
          h('div', {},
            h('h2', {}, lvl.rival, ' ', h('span', { class: 'ai' }, 'AI')),
            h('p', { class: 'aim' }, 'Aim ', '◆'.repeat(lvl.aim), '◇'.repeat(5 - lvl.aim)),
            lvl.habit ? h('p', { class: 'habit' }, h('i', { 'aria-hidden': 'true' }, '◆'), ` "${lvl.habit}"`) : '',
            h('p', { class: 'theircrew' }, 'Their crew ', ...lvl.rivalCrew.map((c) => classBadge(c, 1))),
          ),
        ),
      ),
      h('section', { class: 'yourside' },
        h('div', {}, h('h3', {}, 'Crew'), h('p', { class: 'small' }, `${lvl.crewSize} ${lvl.crewSize === 1 ? 'seat' : 'seats'} now, 5 at most`)), crewEl,
        h('div', { class: 'bp' }, h('span', { class: 'small' }, 'Blueprint '), bpName,
          blueprints.length > 1 ? btn('Swap', () => { bi = (bi + 1) % blueprints.length; setup.sides[0].blueprint = blueprints[bi]; bpName.textContent = blueprints[bi]!.name; prepare(); drawDraft(); }, 'secondary small') : ''),
        h('div', { class: 'doodads' }, h('span', { class: 'small' }, 'Doodads '), h('b', {}, lvl.doodads.length ? lvl.doodads.map((d) => app.core.doodadName?.(d) ?? d).join(', ') : 'none yet')),
        warn,
      ),
      draftEl,
      h('footer', { class: 'sheet-foot' }, h('p', { class: 'small' }, 'Nothing here needs a confirm.'), again, fight),
    ),
  );
  drawCrew();
  drawDraft();
  return { el };
}
