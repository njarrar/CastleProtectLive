import type { App, Route, Screen } from '../app';
import { play, unlockAudio } from '../audio/sfx';
import { clearBattle, dropBattleSave, loadBattleSave } from '../save/db';
import type { BattleSetup, Blueprint } from '../core/types';
import { btn, h } from '../ui/dom';
import { bigSmoothieIconUrl, topiaryPeacockIconUrl } from '../ui/svgIcons';
import { plural, t } from '../ui/text';

export function gear(app: App, back: Route): HTMLElement {
  return btn('⚙', () => app.go({ to: 'settings', back }), 'gear round-btn', { 'aria-label': t('common.settings') });
}

// ---------- S0 / S1: title and first run ----------
export function titleScreen(app: App): Screen {
  const first = !app.settings.seenFirstRun;
  const slider = h('input', { type: 'range', min: 0, max: 100, value: app.settings.sound, 'aria-label': t('home.sound') }) as HTMLInputElement;
  slider.addEventListener('input', () => { void app.setSettings({ sound: Number(slider.value) }); play('slider_tick'); });
  let jingled = false;
  const playJingleOnce = () => { if (jingled) return; jingled = true; unlockAudio(); play('title_jingle'); };
  const play_ = btn(t('home.play'), () => {
    jingled = true;
    unlockAudio();
    play('confirm');
    if (first) {
      void app.setSettings({ seenFirstRun: true });
      app.go({ to: 'battle', setup: app.campaignSetup('1-1') });
    } else app.go({ to: 'map' });
  }, 'primary big play silent', { 'data-autofocus': true, 'data-testid': 'play', title: first ? t('home.play_hint') : undefined });
  const bounceT = first ? window.setTimeout(() => play_.classList.add('bounce'), 6000) : 0;
  const backdropHills = h('div', { class: 'sky-hills', 'aria-hidden': 'true' });
  // Living storybook Puddingstone Downs backdrop: sunlit hills, drifting clouds, dry-stone wall,
  // and a charming animated walking fort silhouette (M-W05 / Live QA M5).
  backdropHills.innerHTML = `<svg viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice">`
    + `<defs>`
    + `<linearGradient id="thill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A8D4B8"/><stop offset="100%" stop-color="#7BB68D"/></linearGradient>`
    + `<linearGradient id="thill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87CE72"/><stop offset="100%" stop-color="#5AA555"/></linearGradient>`
    + `<linearGradient id="thill3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#71BC5D"/><stop offset="100%" stop-color="#4A8E43"/></linearGradient>`
    + `</defs>`
    + `<g class="title-clouds" fill="#FFFFFF" opacity="0.74">`
    + `<g class="tcloud c1"><ellipse cx="170" cy="72" rx="64" ry="24"/><ellipse cx="215" cy="68" rx="46" ry="20"/><ellipse cx="132" cy="76" rx="38" ry="16"/></g>`
    + `<g class="tcloud c2"><ellipse cx="940" cy="64" rx="74" ry="26"/><ellipse cx="992" cy="60" rx="50" ry="21"/><ellipse cx="892" cy="68" rx="42" ry="17"/></g>`
    + `<g class="tcloud c3"><ellipse cx="560" cy="96" rx="52" ry="18"/><ellipse cx="596" cy="94" rx="34" ry="15"/></g>`
    + `</g>`
    + `<path d="M0 245 Q180 155 390 212 T810 185 T1200 215 V420 H0 Z" fill="url(#thill1)"/>`
    + `<path d="M0 282 Q240 205 480 258 T960 228 L1200 255 V420 H0 Z" fill="url(#thill2)"/>`
    // Animated walking starter fort silhouette trundling along Puddingstone Downs
    + `<g class="title-fort" transform="translate(215 186)">`
    + `<g class="tf-steam" fill="#FFF4DE" opacity="0.82"><circle cx="40" cy="-10" r="6"/><circle cx="48" cy="-22" r="8"/><circle cx="58" cy="-34" r="6"/></g>`
    + `<g class="tf-legs" stroke="#2C221E" stroke-width="3" stroke-linejoin="round">`
    + `<g class="tf-leg-a"><rect x="14" y="64" width="10" height="18" rx="3" fill="#C88A2E"/><rect x="7" y="79" width="24" height="9" rx="4" fill="#2F6FDE"/></g>`
    + `<g class="tf-leg-b"><rect x="54" y="64" width="10" height="18" rx="3" fill="#C88A2E"/><rect x="47" y="79" width="24" height="9" rx="4" fill="#2F6FDE"/></g>`
    + `</g>`
    + `<g class="tf-body" stroke="#2C221E" stroke-width="3" stroke-linejoin="round">`
    + `<rect x="6" y="54" width="68" height="13" rx="3" fill="#5A4A42"/>`
    + `<rect x="10" y="18" width="60" height="38" rx="4" fill="#B9733A"/>`
    + `<rect x="14" y="22" width="22" height="16" rx="2" fill="#3B2D24"/><circle cx="25" cy="30" r="5" fill="#FFE08A" stroke="none"/>`
    + `<rect x="42" y="22" width="22" height="16" rx="2" fill="#3B2D24"/><circle cx="53" cy="30" r="5" fill="#4FE3C1" stroke="none"/>`
    + `<rect x="28" y="4" width="24" height="15" rx="3" fill="#A9A39A"/>`
    + `<line x1="60" y1="18" x2="60" y2="-8" stroke="#2C221E" stroke-width="2.5"/>`
    + `<polygon class="tf-flag" points="60,-7 86,0 60,7" fill="#2F6FDE"/>`
    + `</g></g>`
    // Foreground sunlit meadow & stone fence line
    + `<path d="M0 330 Q260 286 560 326 T1200 308 V420 H0 Z" fill="url(#thill3)"/>`
    + `<path d="M680 322 Q860 302 1040 318" fill="none" stroke="#8C7E74" stroke-width="7" stroke-linecap="round" stroke-dasharray="16 6" opacity="0.65"/>`
    + `</svg>`;

  const el = h('main', { class: 'screen title' },
    backdropHills,
    h('div', { class: 'logo', role: 'heading', 'aria-level': 1, 'aria-label': t('app.title') }, ...t('app.title').split(' ').map((w) => h('span', { 'aria-hidden': 'true' }, w))),
    h('p', { class: 'tagline' }, t('app.tagline')),
    first ? h('label', { class: 'row slider' }, h('span', {}, t('home.sound')), slider) : '',
    play_,
    h('p', { class: 'small free' }, t('app.promise')),
  );
  el.addEventListener('pointerdown', (e) => { if (!play_.contains(e.target as Node)) playJingleOnce(); }, { once: true });
  let alive = true;
  let resumeKey: ((e: KeyboardEvent) => void) | null = null;
  void loadBattleSave().then((save) => {
    if (!save || !alive) return;
    // A save from another rules engine or incompatible rules version is put aside (H-W13a).
    if (save.coreName !== app.core.name || (save.rules !== undefined && save.rules !== app.core.rules)) { void dropBattleSave(); return; }
    const setSiblingsInert = (on: boolean) => {
      for (const child of Array.from(el.children)) if (child !== sheet) (child as HTMLElement).inert = on;
    };
    const closeSheet = () => {
      if (resumeKey) { window.removeEventListener('keydown', resumeKey); resumeKey = null; }
      setSiblingsInert(false);
      sheet.remove();
      play_.focus({ preventScroll: true });
    };
    const dialog = h('div', { class: 'card resume', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'resume-h' },
      h('h2', { id: 'resume-h' }, t('home.carry_on.title')),
      h('p', {}, save.label),
      btn(t('home.carry_on.yes'), () => {
        unlockAudio();
        play('confirm');
        // The battle screen checks the version and the replay; a bad save routes to the map with a note.
        app.go({ to: 'battle', setup: save.setup, resume: save.core, handoff: save.handoff });
      }, 'primary silent', { 'data-autofocus': true, 'data-testid': 'resume' }),
      btn(t('home.carry_on.no'), () => {
        play('back');
        // Rule 1 (H-W13): Button payouts come strictly from Rust core battle outcomes, never TS UI hacks.
        void clearBattle();
        closeSheet();
      }, 'secondary silent'),
    );
    const sheet = h('div', { class: 'scrim' }, dialog);
    // True modal trap: inert siblings, Tab cycle, and Escape dismissal (Web-H7 #5).
    resumeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); play('back'); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')];
      if (!focusable.length) return;
      const idx = focusable.indexOf(document.activeElement as HTMLElement);
      const nxt = e.shiftKey ? (idx <= 0 ? focusable.length - 1 : idx - 1) : (idx + 1) % focusable.length;
      focusable[nxt].focus();
      e.preventDefault();
    };
    window.addEventListener('keydown', resumeKey);
    el.append(sheet);
    setSiblingsInert(true);
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }).catch(() => undefined);
  return {
    el,
    destroy: () => {
      alive = false;
      clearTimeout(bounceT);
      if (resumeKey) window.removeEventListener('keydown', resumeKey);
    },
  };
}

// ---------- S3: Brickabrac Map, Region 1 (Plate 5 Storybook Redesign) ----------
const NODE_POS: [number, number][] = [
  [6, 62], [15, 48], [24, 60], [33, 42], [42, 56], [51, 38], [60, 54], [70, 40], [79, 56], [91, 46],
];

/** Smooth curved cubic Bezier SVG path through the 10 Puddingstone Downs stops. */
function smoothRoadPath(pts: [number, number][]): string {
  if (!pts.length) return '';
  let d = `M ${pts[0][0]} ${pts[0][1] + 3}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = ((x0 + x1) / 2).toFixed(2);
    d += ` C ${mx} ${(y0 + 3).toFixed(2)}, ${mx} ${(y1 + 3).toFixed(2)}, ${x1} ${(y1 + 3).toFixed(2)}`;
  }
  return d;
}

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
    const grand = l.kind === 'grand_fort';
    const b = btn(
      grand
        ? h('span', { class: 'grand-crest', 'aria-hidden': 'true' },
          h('img', { src: topiaryPeacockIconUrl(), alt: '', class: 'peacock-ico' }),
          h('span', { class: 'num grand-num' }, '10'),
        )
        : h('span', { class: 'num' }, l.id.split('-')[1]),
      () => app.go({ to: 'prebattle', level: l.id }),
      `node ${st} ${grand ? 'grand' : ''}`,
      { style: `left:${x}%;top:${y}%`, 'aria-label': st === 'locked' ? t('map.node_locked', { id: l.id, name: l.name }) : st === 'done' ? t('map.node_done', { id: l.id, name: l.name, n: pen.filter(Boolean).length }) : t('map.node', { id: l.id, name: l.name }), disabled: st === 'locked', 'data-level': l.id },
    );
    b.append(h('span', { class: 'pens', 'aria-hidden': 'true' }, ...[0, 1, 2].map((k) => h('i', { class: pen[k] ? 'got' : '' }))));
    b.append(h('span', { class: 'nm' }, l.name));
    return b;
  });

  // Layered painted SVG rolling Puddingstone Downs hills + curved cobbled storybook road (Plate 5).
  const roadD = smoothRoadPath(NODE_POS);
  const backdrop = h('div', { class: 'road', 'aria-hidden': 'true' });
  backdrop.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">`
    + `<defs>`
    + `<linearGradient id="msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8FD2EA"/><stop offset="52%" stop-color="#FFF2D6"/></linearGradient>`
    + `<linearGradient id="mhill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A8D4B8"/><stop offset="100%" stop-color="#89BC99"/></linearGradient>`
    + `<linearGradient id="mhill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#89CE74"/><stop offset="100%" stop-color="#62AE54"/></linearGradient>`
    + `<linearGradient id="mhill3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#76C062"/><stop offset="100%" stop-color="#4F9647"/></linearGradient>`
    + `</defs>`
    + `<rect width="100" height="100" fill="url(#msky)"/>`
    + `<ellipse cx="18" cy="14" rx="7" ry="4" fill="#FFFFFF" opacity="0.72"/><ellipse cx="22" cy="15" rx="5" ry="3" fill="#FFFFFF" opacity="0.72"/>`
    + `<ellipse cx="58" cy="12" rx="8" ry="4" fill="#FFFFFF" opacity="0.65"/><ellipse cx="63" cy="13" rx="6" ry="3" fill="#FFFFFF" opacity="0.65"/>`
    + `<ellipse cx="86" cy="16" rx="6" ry="3.5" fill="#FFFFFF" opacity="0.58"/>`
    + `<path d="M0 44 Q14 26 28 38 T58 32 T86 36 L100 30 V100 H0 Z" fill="url(#mhill1)"/>`
    + `<path d="M0 54 Q18 36 36 48 T72 42 T100 46 V100 H0 Z" fill="url(#mhill2)"/>`
    // Sculpted clipped topiary hedges behind the foreground meadow so bottom blends naturally into mhill3 (M-W05).
    + `<path d="M84 48 Q87 30 91 34 Q95 26 99 38 V100 H84 Z" fill="#2F7A46" opacity="0.58"/>`
    + `<path d="M0 70 Q20 56 42 66 T82 60 L100 66 V100 H0 Z" fill="url(#mhill3)"/>`
    // Grounded shadow beneath Big Smoothie Jr. resting on the far-right hillside
    + `<ellipse cx="92" cy="70" rx="4.2" ry="1.6" fill="#2C221E" opacity="0.24"/>`
    // Curved cobbled storybook road connecting nodes 1-10
    + `<path class="road-edge" d="${roadD}"/>`
    + `<path class="road-fill" d="${roadD}"/>`
    + `<path class="road-dash" d="${roadD}"/>`
    + `</svg>`;

  const rollerLandmark = h('div', { class: 'roller', 'aria-hidden': 'true' },
    h('img', { src: bigSmoothieIconUrl(), alt: '', class: 'roller-ico' }),
  );
  const strip = h('div', { class: 'mapstrip' }, backdrop, ...nodes, rollerLandmark);
  const scroller = h('div', { class: 'mapscroll' }, strip);
  const dock = h('nav', { class: 'dock' },
    btn(t('home.play'), () => app.go({ to: 'prebattle', level: next }), 'primary', { 'data-testid': 'dock-play', 'aria-label': t('home.play_next_hint', { id: next, name: levels.find((l) => l.id === next)?.name ?? '' }) }),
    btn(t('modes.duel.button'), () => app.go({ to: 'duel' }), 'secondary twoplayers', { 'data-testid': 'two-players', 'aria-label': t('modes.duel.name') }),
    app.modesOpen() ? btn(t('map.modes'), () => app.go({ to: 'modes' }), 'secondary') : '',
    app.modesOpen() ? btn(t('map.workshop'), () => app.go({ to: 'workshop' }), 'secondary') : '',
  );
  const el = h('main', { class: 'screen map' },
    h('header', { class: 'topbar' },
      gear(app, { to: 'map' }),
      h('div', { class: 'title' }, h('b', {}, t('map.regions.downs.name')), h('span', { class: 'map-count', 'aria-label': t('map.cleared', { done, total: levels.length }) }, ` ${done}/${levels.length}`)),
      h('div', { class: 'purse' },
        h('span', { class: 'purse-pill', title: t('map.pennants'), 'aria-label': t('map.pennants_count', { n: pennants, total: levels.length * 3 }) }, h('i', { class: 'pen-dot', 'aria-hidden': 'true' }), `${pennants}/${levels.length * 3}`),
        h('span', { class: 'purse-pill', title: t('map.buttons'), 'aria-label': plural('map.buttons_count', app.progress.buttons) }, h('i', { class: 'btn-dot', 'aria-hidden': 'true' }), String(app.progress.buttons)),
      ),
    ),
    h('div', { class: 'rail' }, h('span', { class: 'chip on' }, t('map.regions.downs.chip')), h('span', { class: 'chip off' }, t('map.regions.crag.chip')), h('span', { class: 'chip off' }, t('map.regions.fen.chip')), h('span', { class: 'chip off' }, t('map.regions.flats.chip'))),
    scroller,
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
  const row = (name: string, line: string, go: () => void) =>
    h('div', { class: 'moderow' }, h('div', {}, h('b', {}, name), h('p', { class: 'small' }, line)), btn(t('common.play'), go, 'primary', { 'aria-label': name }));
  const el = h('main', { class: 'screen modes' },
    h('header', { class: 'topbar' }, btn('←', () => { play('back'); app.go({ to: 'map' }); }, 'round-btn silent', { 'aria-label': t('common.back') }), h('h1', {}, t('map.modes')), gear(app, { to: 'modes' })),
    h('div', { class: 'list' },
      row(t('modes.duel.name'), t('modes.duel.line'), () => app.go({ to: 'duel' })),
      row(t('modes.skirmish.name'), t('modes.skirmish.line'), () => app.go({ to: 'skirmish' })),
      row(t('modes.yard.name'), t('modes.yard.line'), () => app.go({ to: 'battle', setup: yardSetup(app) })),
      row(t('modes.workshop.name'), t('modes.workshop.line'), () => app.go({ to: 'workshop' })),
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
      { name: t('common.you'), human: true, crew, blueprint },
      { name: t('common.dummy'), human: false, crew: [] },
    ],
  };
}
