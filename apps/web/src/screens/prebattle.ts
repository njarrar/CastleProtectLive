// S4: the pre-battle sheet, with the Rummage draft strip (07 §4.1).
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import { LEVEL_FORT } from '../core/bp';
import type { BattleSetup, Blueprint, DraftChip, Snapshot } from '../core/types';
import { hobSpriteName, sprites } from '../render/sprites';
import { CLASS_COLOR, CLASS_ICON, CLASS_INK, btn, classBadge, h } from '../ui/dom';
import { bestClassStrip, describeShot, resolveShotIconUrl, restCogImgs } from '../ui/shellMeta';
import { andList, has, hobShort, plural, rivalShort, t } from '../ui/text';

export function prebattleScreen(app: App, route: Route): Screen {
  const r = route as Extract<Route, { to: 'prebattle' }>;
  const found = app.levels().find((l) => l.id === r.level);
  if (!found) throw new Error(t('level_card.no_level'));
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
          say(t('level_card.fort_too_small'));
          return true;
        } catch (e2) {
          console.error(e2);
          say(t('errors.fight_cannot_start'));
          return false;
        }
      }
      console.error(why);
      say(t('errors.fight_cannot_start'));
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
        const pu = sprites.url(`portrait_${hobSpriteName(hb.id, hb.cls)}_blue`);
        return h('span', { class: 'portrait', style: `--c:${CLASS_COLOR[hb.cls]};--fg:${CLASS_INK[hb.cls]}`, title: hb.name },
          pu ? h('img', { src: pu, alt: '', class: 'portrait-img' }) : CLASS_ICON[hb.cls],
          h('small', {}, hb.name),
        );
      }),
      btn(t('common.swap'), () => openSwap(), 'secondary small', { 'aria-label': t('setup.pick_crew') }),
    );
  }

  function openSwap(): void {
    // Toggle/replace a single picker so repeated taps never stack duplicates (Web-M15).
    const existing = crewEl.parentElement?.querySelector('.picker');
    if (existing) { existing.remove(); return; }
    const box = h('div', { class: 'picker', role: 'dialog', 'aria-label': t('setup.pick_crew') });
    const sel = new Set(setup.sides[0].crew);
    const paint = () => box.replaceChildren(
      h('p', { class: 'small' }, t('level_card.pick_up_to', { n: lvl.crewSize })),
      ...roster.map((id) => {
        const hb = hobs.find((x) => x.id === id)!;
        return btn(`${CLASS_ICON[hb.cls]} ${hb.name}`, () => {
          if (sel.has(id)) { if (sel.size > 1) sel.delete(id); } else if (sel.size < lvl.crewSize) sel.add(id);
          paint();
        }, `chip ${sel.has(id) ? 'on' : ''}`);
      }),
      btn(t('common.done'), () => {
        setup = app.campaignSetup(lvl.id, [...sel]);
        say(setup.fortNote);
        bpName.textContent = setup.sides[0].blueprint?.name ?? LEVEL_FORT.name;
        app.progress.lastCrew = [...sel];
        void app.saveProgress();
        box.remove();
        prepare();
        drawCrew();
        drawBlueprint();
        drawDraft();
      }, 'primary small'),
    );
    paint();
    crewEl.after(box);
  }

  function chip(c: DraftChip, d: NonNullable<Snapshot['draft']>): HTMLElement {
    const owner = c.owner;
    const ic = resolveShotIconUrl(c.id);
    const b = btn(h('span', { class: 'draft-chip-in' }, ic ? h('img', { src: ic, alt: '', class: 'ico' }) : '', h('span', {}, c.name)), () => {
      if (owner !== undefined || d.done) return;
      if (focusChip !== c.id) { focusChip = c.id; drawDraft(); return; }
      take(c.id);
    }, `chip shell silent ${owner === 0 ? 'mine' : owner === 1 ? 'theirs' : ''} ${focusChip === c.id ? 'focus' : ''}`, {
      'aria-label': owner === 0 ? t('rummage.taken_yours', { shell: c.name }) : owner === 1 ? t('rummage.taken_theirs', { shell: c.name }) : c.dud ? `${c.name}, ${t('rummage.dud')}` : c.name, 'data-shell': c.id,
    });
    if (c.weight) b.append(h('i', { class: 'cogs', 'aria-hidden': 'true' }, ...restCogImgs(c.weight)));
    if (c.dud) b.append(h('em', { class: 'dud' }, t('rummage.dud')));
    if (d.wish === c.id && owner === undefined) b.append(h('em', { class: 'wish', title: t('rummage.rival_wants', { rival: rivalShort(lvl.rival, lvl.id) }) }, '◆'));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); focusChip = c.id; drawDraft(); });
    return b;
  }

  function take(id: string): void {
    if (!app.core.command({ cmd: 'pick_shell', id }).ok) return;
    picks.push(id);
    play('card_take');
    snap = app.core.snapshot();
    focusChip = undefined;
    drawDraft();
  }

  function drawDraft(): void {
    const d = snap?.draft;
    if (!lvl.draft || !d) { draftEl.hidden = true; return; }
    draftEl.hidden = false;
    const f = d.pool.find((p) => p.id === focusChip);
    const fMeta = f ? describeShot(f.id) : undefined;
    const slot = (ids: string[], side: 0 | 1) => h('div', { class: `slots side${side}` }, ...Array.from({ length: d.perSide }, (_, i) => {
      const s = d.pool.find((p) => p.id === ids[i]);
      return h('span', { class: `slot ${s ? 'full' : ''}` }, s ? s.name : String(i + 1));
    }));
    draftEl.replaceChildren(
      h('div', { class: 'draft-head' }, h('b', {}, t('rummage.title')), h('span', { class: 'small' }, d.done ? t('rummage.all_picked') : t('rummage.your_pick', { n: Math.min(d.perSide, d.picks[0].length + 1), total: d.perSide })),
        btn(t('rummage.quick_pick'), () => { app.core.command({ cmd: 'quick_pick' }); play('card_take'); snap = app.core.snapshot(); picks = [...(snap.draft?.picks[0] ?? picks)]; drawDraft(); }, 'secondary small silent', { disabled: d.done })),
      h('div', { class: 'pool' }, ...d.pool.map((c) => chip(c, d))),
      f && fMeta
        ? h('div', { class: 'draft-preview' },
          h('p', { class: 'hint' }, h('b', {}, `${f.name}: `), fMeta.line || f.hint),
          h('div', { class: 'stat-chips' },
            fMeta.dmgLabel ? h('span', { class: 'stat-chip' }, fMeta.dmgLabel) : '',
            fMeta.rangeLabel ? h('span', { class: 'stat-chip' }, fMeta.rangeLabel) : '',
          ),
          fMeta.goodAt ? h('p', { class: 'small goodat' }, fMeta.goodAt) : '',
          bestClassStrip(f.best, true),
        )
        : h('p', { class: 'hint' }, t('rummage.hint')),
      d.wish && !d.done && d.pool.find((p) => p.id === d.wish)?.owner === undefined ? h('p', { class: 'small wishline' }, t('rummage.rival_wants_named', { rival: rivalShort(lvl.rival, lvl.id), shell: d.pool.find((p) => p.id === d.wish)?.name ?? '' })) : '',
      h('div', { class: 'hands' }, h('span', {}, t('rummage.yours')), slot(d.picks[0], 0), h('span', {}, t('rummage.theirs')), slot(d.picks[1], 1)),
    );
  }

  const goals = h('ul', { class: 'goals' }, ...lvl.goals.map((g, i) => h('li', { class: app.progress.levels[lvl.id]?.pennants[i] ? 'got' : '' }, h('i', { 'aria-hidden': 'true' }, '⚑'), g)));
  const fight = btn(t('common.fight'), () => {
    // The battle is built here so a refusal shows on this sheet; FIGHT never fails silently.
    if (!lvl.draft && !build()) return;
    if (!snap) return;
    if (snap.draft && !snap.draft.done) app.core.command({ cmd: 'end_draft' });
    const finalPicks = app.core.snapshot().draft?.picks[0] ?? picks;
    if (lvl.draft && finalPicks.length) app.lastDraftPicks.set(lvl.id, [...finalPicks]);
    play('confirm');
    const { fortNote: _n, ...clean } = setup;
    app.go({ to: 'battle', setup: clean, prepared: true });
  }, 'primary big fightbtn silent', { 'data-autofocus': !replay, 'data-testid': 'fight' });
  const again = replay ? btn(t('level_card.same_as_last'), () => {
    // Reuse the player's prior drafted shells when available in the pool (Web-L8).
    if (lvl.draft && snap?.draft && !snap.draft.done) {
      const saved = app.lastDraftPicks.get(lvl.id);
      if (saved?.length) {
        for (const id of saved) {
          if (snap.draft && !snap.draft.done && snap.draft.pool.some((p) => p.id === id && p.owner === undefined)) take(id);
        }
      }
    }
    fight.click();
  }, 'secondary silent', { 'data-autofocus': true }) : '';
  // Offer the Workshop fort only when the core says it seats the current crew (recomputed on crew swap, Web-M15).
  const bpRow = h('div', { class: 'bp' });
  function drawBlueprint(): void {
    const blueprints = [app.progress.blueprint, LEVEL_FORT].filter((b): b is Blueprint => !!b && (b === LEVEL_FORT || app.core.checkFort(b, setup.sides[0].crew.length).ok));
    let bi = Math.max(0, blueprints.findIndex((b) => b === setup.sides[0].blueprint || (b.id && b.id === setup.sides[0].blueprint?.id)));
    bpName.textContent = setup.sides[0].blueprint?.name ?? LEVEL_FORT.name;
    bpRow.replaceChildren(
      h('span', { class: 'small' }, `${t('setup.fort')} `),
      bpName,
      blueprints.length > 1 ? btn(t('common.swap'), () => {
        bi = (bi + 1) % blueprints.length;
        setup.sides[0].blueprint = blueprints[bi];
        bpName.textContent = blueprints[bi].name;
        prepare();
        drawDraft();
      }, 'secondary small') : '',
    );
  }
  // Recognizable terrain & fort silhouette preview (QA-m2).
  const hillPath = lvl.id === '1-4' || lvl.id === '1-9'
    ? 'M0,62 Q45,56 75,48 Q120,22 165,48 Q195,56 240,62 L240,96 L0,96 Z'
    : lvl.id === '1-7'
      ? 'M0,64 Q60,64 120,50 Q180,64 240,64 L240,96 L0,96 Z'
      : 'M0,60 Q70,74 120,72 Q170,74 240,58 L240,96 L0,96 Z';
  const cageSvg = lvl.id === '1-7'
    ? '<path d="M110,54 V40 A10,10 0 0 1 130,40 V54 Z" fill="#FAF3E3" stroke="#2C221E" stroke-width="2"/><line x1="115" y1="33" x2="115" y2="54" stroke="#2C221E" stroke-width="1.5"/><line x1="125" y1="33" x2="125" y2="54" stroke="#2C221E" stroke-width="1.5"/><circle cx="120" cy="27" r="3" fill="none" stroke="#FFC23D" stroke-width="2"/>'
    : '';
  const bossSvg = lvl.kind === 'grand_fort'
    ? '<path d="M214,34 L234,16 C228,8 214,8 206,18 Z" fill="#2F7A46" stroke="#2C221E" stroke-width="2"/><path d="M192,30 C191,20 198,16 202,22 C204,25 202,29 202,30 Z" fill="#46A35C" stroke="#2C221E" stroke-width="2"/><polygon points="191,21 183,24 191,26" fill="#FFC23D" stroke="#2C221E" stroke-width="1.2"/>'
    : '<polygon points="199,18 214,24 199,30" fill="#E8730C" stroke="#2C221E" stroke-width="1.5"/>';
  const thumb = h('div', { class: 'thumb', 'aria-hidden': 'true' });
  thumb.innerHTML = `<svg viewBox="0 0 240 96" preserveAspectRatio="none"><rect width="240" height="96" fill="#9ED8EC"/><path d="${hillPath}" fill="#7CC46A"/><path d="${hillPath}" transform="translate(0,12)" fill="#9A6440"/><rect x="26" y="34" width="32" height="28" rx="3" fill="#2F6FDE" stroke="#2C221E" stroke-width="2.5"/><rect x="34" y="24" width="12" height="10" fill="#2F6FDE" stroke="#2C221E" stroke-width="2"/><rect x="182" y="30" width="34" height="30" rx="3" fill="${lvl.kind === 'grand_fort' ? '#2F7A46' : '#5A6572'}" stroke="#2C221E" stroke-width="2.5"/>${bossSvg}${cageSvg}</svg>`;

  // The Notice of Flattening, signed by the level's Rival (levels.<id>.notice).
  const notice = has(`levels.${lvl.id}.notice`)
    ? h('section', { class: 'flat-notice', 'aria-label': t('level_card.notice.title') },
      h('h3', {}, t('level_card.notice.title')),
      h('p', { class: 'small ref' }, t('level_card.notice.ref', { id: lvl.id })),
      h('p', {}, t(`levels.${lvl.id}.notice`)),
      has(`levels.${lvl.id}.signature`) ? h('p', { class: 'signed' }, t('level_card.notice.signed', { signature: t(`levels.${lvl.id}.signature`) })) : '',
    )
    : '';
  const unitNames = [...new Set((lvl.rivalUnits ?? []).map((id) => hobShort(id)))];
  const rounds = lvl.squall ? t('level_card.rounds_squall', { n: lvl.roundCap }) : t('level_card.rounds_count', { n: lvl.roundCap });
  const el = h('main', { class: 'screen prebattle' },
    h('div', { class: 'sheet' },
      h('header', { class: 'sheet-head' },
        h('span', { class: 'lvlid' }, lvl.id), h('h1', {}, lvl.name),
        h('span', { class: 'tag' }, lvl.type),
        h('span', { class: 'tag' }, rounds),
        h('span', { class: 'tag' }, lvl.wind),
        lvl.draft ? h('span', { class: 'tag' }, t('level_card.rummage', { picks: lvl.draftPicks, pool: lvl.draftPool })) : '',
        btn('✕', () => { play('back'); app.go({ to: 'map', focus: lvl.id }); }, 'round-btn close silent', { 'aria-label': t('common.close') }),
      ),
      h('div', { class: 'cols' },
        h('section', { class: 'level' }, thumb, h('h3', {}, t('level_card.goals')), goals),
        h('section', { class: 'rival' },
          h('div', { class: 'face', 'aria-hidden': 'true' }, lvl.rival.split(' ').map((w) => w[0]).join('').slice(0, 2)),
          h('div', {},
            h('h2', {}, lvl.rival),
            h('p', { class: 'aim', 'aria-label': t('level_card.their_aim', { n: lvl.aim }) }, h('span', { 'aria-hidden': 'true' }, t('level_card.their_aim', { n: lvl.aim }), ' ', '◆'.repeat(lvl.aim), '◇'.repeat(5 - lvl.aim))),
            lvl.habit ? h('p', { class: 'habit' }, h('i', { 'aria-hidden': 'true' }, '◆'), ` ${lvl.habit}`) : '',
            h('p', { class: 'theircrew' }, `${t('level_card.their_crew')}: `, unitNames.length ? andList(unitNames) : '', ' ', ...lvl.rivalCrew.map((c) => classBadge(c, 1))),
          ),
        ),
      ),
      notice,
      h('section', { class: 'yourside' },
        h('div', {}, h('h3', {}, t('level_card.your_crew')), h('p', { class: 'small' }, plural('level_card.crew_of', lvl.crewSize))), crewEl,
        bpRow,
        h('div', { class: 'doodads' }, h('span', { class: 'small' }, lvl.doodads.length ? t('level_card.doodads', { list: andList(lvl.doodads.map((d) => app.core.doodadName?.(d) ?? d)) }) : t('level_card.doodads_none'))),
        warn,
      ),
      draftEl,
      h('footer', { class: 'sheet-foot' }, again, fight),
    ),
  );
  drawCrew();
  drawBlueprint();
  drawDraft();
  return { el };
}
