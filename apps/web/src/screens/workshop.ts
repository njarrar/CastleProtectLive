// S10 Workshop Fort Builder (Part 2 Plate 4 Redesign): living cutaway drafting board with
// A-H / 1-9 coordinates, FRONT -> loopholes, 3 planted Stomper legs, unified 2x2 Kettle &
// seated Hob Nook bays, pinpoint error callouts, and structured AA+ inspector panel.
// Legality comes strictly from core.checkBlueprint; the editor only displays what the core says.
import { plural, t } from '../ui/text';
import type { App, Screen } from '../app';
import { play } from '../audio/sfx';
import { blueprintToRows } from '../core/bp';
import type { Blueprint, BlueprintCell, HobInfo } from '../core/types';
import { hobSpriteName, sprites } from '../render/sprites';
import { CLASS_COLOR, CLASS_ICON, CLASS_INK, btn, h } from '../ui/dom';
import { frontLoopholeUrl, heartkettleRoomUrl } from '../ui/svgIcons';
import { yardSetup } from './home';
import { RULES } from '../core/rules';
import materials from '../../../../content/materials.json' with { type: 'json' };

type Tool = BlueprintCell['kind'] | 'erase';
const COLS = RULES.workshop.cols;
// The core counts the Footing as a row of the fort, so the top row of RULES.workshop.rows can never
// be built on: the grid shows only the rows that can (QA playtest 2, n2).
const ROWS = RULES.workshop.rows - 1;
const MAX_NOOKS = RULES.workshop.max_nooks;
const COL_LETTERS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));
const BLOCK_COST: Record<string, number> = Object.fromEntries((materials.blocks ?? []).map((b) => [b.id, b.cost]));

export function workshopScreen(app: App): Screen {
  const fresh = (): Blueprint => {
    const b = structuredClone(app.progress.blueprint ?? app.core.defaultBlueprint());
    b.cols = COLS;
    b.rows = ROWS;
    b.cells = b.cells.filter((x) => x.row < ROWS);
    return b;
  };
  let bp: Blueprint = fresh();
  let tool: Tool = 'cobble';
  let savedNote = false;
  const undo: string[] = [];
  const redo: string[] = [];

  // Seated crew roster preview (seat 1..5 in player crew order)
  const allHobs = app.core.hobs();
  const rosterIds = app.roster();
  const seatCrew: HobInfo[] = [
    ...rosterIds.map((id) => allHobs.find((x) => x.id === id)).filter((x): x is HobInfo => !!x),
    ...allHobs.filter((x) => !rosterIds.includes(x.id)),
  ].slice(0, MAX_NOOKS);

  const gridEl = h('div', { class: 'grid', role: 'grid', 'aria-label': t('workshop.grid') });
  const loopholeGutter = h('div', { class: 'loophole-gutter', 'aria-hidden': 'true' });
  const status = h('div', { class: 'status', 'aria-live': 'polite' });
  const metricsEl = h('div', { class: 'ws-metrics' });
  const saveBtn = btn(t('common.save'), () => save(), 'primary silent');
  const testBtn = btn(t('workshop.test_yard'), () => {
    const tb = trim(bp);
    if (!app.core.checkBlueprint(tb).ok) return;
    tb.rowsText = blueprintToRows(tb);
    delete tb.id;
    play('confirm');
    app.go({ to: 'battle', setup: yardSetup(app, tb) });
  }, 'team silent');

  const key = (c: number, r: number) => `${c},${r}`;
  function cellAt(c: number, r: number) { return bp.cells.find((x) => x.col === c && x.row === r); }
  function snapshotState() { savedNote = false; undo.push(JSON.stringify(bp.cells)); if (undo.length > 50) undo.shift(); redo.length = 0; }

  function apply(c: number, r: number): void {
    snapshotState();
    if (tool === 'erase') {
      const hit = cellAt(c, r);
      if (hit?.kind === 'kettle') bp.cells = bp.cells.filter((x) => x.kind !== 'kettle');
      else if (hit?.kind === 'nook') bp.cells = bp.cells.filter((x) => !(x.kind === 'nook' && x.room === hit.room));
      else bp.cells = bp.cells.filter((x) => !(x.col === c && x.row === r));
      play('tap');
    } else if (tool === 'kettle' || tool === 'nook') {
      // Rooms are 2 x 2. One Kettle Room; Nooks are numbered 1 to 5 (seat order).
      if (c + 1 >= COLS || r + 1 >= ROWS) { undo.pop(); play('denied'); return; }
      let room: number | undefined;
      if (tool === 'kettle') bp.cells = bp.cells.filter((x) => x.kind !== 'kettle');
      else {
        const used = new Set(bp.cells.filter((x) => x.kind === 'nook').map((x) => x.room));
        room = Array.from({ length: MAX_NOOKS }, (_, i) => i + 1).find((n) => !used.has(n));
        if (!room) { undo.pop(); status.textContent = `${MAX_NOOKS} Nooks at most.`; play('denied'); return; }
      }
      const box = [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]];
      if (bp.cells.some((x) => (x.kind === 'nook' || x.kind === 'kettle') && box.some(([a, b]) => a === x.col && b === x.row))) { undo.pop(); play('denied'); return; }
      bp.cells = bp.cells.filter((x) => !box.some(([a, b]) => a === x.col && b === x.row));
      for (const [a, b] of box) bp.cells.push({ col: a, row: b, kind: tool, room });
      play('block_place');
    } else {
      const hit = cellAt(c, r);
      if (hit?.kind === 'kettle' || hit?.kind === 'nook') { undo.pop(); play('denied'); return; }
      bp.cells = bp.cells.filter((x) => !(x.col === c && x.row === r));
      bp.cells.push({ col: c, row: r, kind: tool });
      play('block_place');
    }
    paint();
  }

  // Keyboard: arrow keys move, Enter or Space places the current tool (one roving tab stop).
  const cursor: [number, number] = [0, 0];
  gridEl.addEventListener('keydown', (e) => {
    const mv: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (mv[e.key]) {
      cursor[0] = Math.max(0, Math.min(COLS - 1, cursor[0] + mv[e.key][0]));
      cursor[1] = Math.max(0, Math.min(ROWS - 1, cursor[1] + mv[e.key][1]));
      paint();
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      apply(cursor[0], cursor[1]);
      e.preventDefault();
    }
  });
  let painting = false;
  let lastCell = '';

  function buildRoomArt(kind: 'kettle' | 'nook', roomNum: number): HTMLElement {
    if (kind === 'kettle') {
      return h('div', { class: 'room-art kettle-art', 'aria-hidden': 'true' },
        h('img', { src: heartkettleRoomUrl(), alt: '' }),
      );
    }
    const seated = seatCrew[roomNum - 1];
    const portraitUrl = seated ? sprites.url(`portrait_${hobSpriteName(seated.id, seated.cls)}_blue`) : undefined;
    return h('div', { class: 'room-art nook-art', 'aria-hidden': 'true' },
      h('span', { class: 'nook-lantern' }),
      portraitUrl
        ? h('img', { class: 'nook-hob-img', src: portraitUrl, alt: '' })
        : h('span', {
          class: 'nook-hob-dot',
          style: seated ? `--c:${CLASS_COLOR[seated.cls]};--fg:${CLASS_INK[seated.cls]}` : '--c:#2F6FDE;--fg:#fff',
        }, seated ? CLASS_ICON[seated.cls] : String(roomNum)),
      h('span', { class: 'nook-seat-pill' }, `${roomNum}${seated ? ` ${seated.name}` : ''}`),
    );
  }

  function paint(): void {
    bp.rowsText = undefined;
    const check = app.core.checkBlueprint(trim(bp));
    const minC = bp.cells.length ? Math.min(COLS, ...bp.cells.map((x) => x.col)) : 0;
    // Rust prepends the footing row at row 0 (p.row === 0), so editable grid row is `p.row - 1` (Web-C3).
    const badMap = new Map<string, string>();
    for (const p of check.problems) {
      if (p.col >= 0 && p.row >= 1) badMap.set(key(p.col + minC, p.row - 1), p.why);
    }
    // Compute bottom-left origin of each 2x2 room so Kettle and Nooks render as unified rooms (Plate 4).
    const roomOrigin = new Map<string, [number, number]>();
    const nookTopRows = new Set<number>();
    for (const cell of bp.cells) {
      if (cell.kind !== 'kettle' && cell.kind !== 'nook') continue;
      const rk = cell.kind === 'kettle' ? 'kettle' : `nook:${cell.room ?? 0}`;
      const cur = roomOrigin.get(rk);
      if (!cur) roomOrigin.set(rk, [cell.col, cell.row]);
      else roomOrigin.set(rk, [Math.min(cur[0], cell.col), Math.min(cur[1], cell.row)]);
    }
    for (const [rk, [, r0]] of roomOrigin.entries()) {
      if (rk.startsWith('nook:')) nookTopRows.add(r0 + 1);
    }

    const hadFocus = gridEl.contains(document.activeElement);
    gridEl.replaceChildren();
    for (let r = ROWS - 1; r >= 0; r--) {
      const row = h('div', { class: 'gridrow', role: 'row' });
      for (let c = 0; c < COLS; c++) {
        const cell = cellAt(c, r);
        const img = cell && cell.kind !== 'nook' && cell.kind !== 'kettle' ? sprites.url(`block_${cell.kind}_fresh`) : undefined;
        const on = c === cursor[0] && r === cursor[1];
        const badWhy = badMap.get(key(c, r));
        const isBad = badWhy !== undefined;
        let quad = '';
        let roomArt: HTMLElement | string = '';
        if (cell && (cell.kind === 'kettle' || cell.kind === 'nook')) {
          const rk = cell.kind === 'kettle' ? 'kettle' : `nook:${cell.room ?? 0}`;
          const o = roomOrigin.get(rk);
          if (o) {
            const left = c === o[0];
            const top = r === o[1] + 1;
            quad = top ? (left ? 'q-tl' : 'q-tr') : (left ? 'q-bl' : 'q-br');
            if (top && left) roomArt = buildRoomArt(cell.kind, cell.room ?? 1);
          }
        }
        // Pinpoint inline error callout badge on empty gaps ("Needs wall") or unsupported blocks ("Floating").
        let errBadge: HTMLElement | string = '';
        if (isBad) {
          const isGap = !cell;
          const tag = isGap ? t('workshop.problems.needs_wall') : /float|hang|ground|support/i.test(badWhy) ? t('workshop.problems.nothing_under') : t('workshop.fix');
          errBadge = h('span', { class: `cell-err ${isGap ? 'gap' : 'blk'}`, 'aria-hidden': 'true' }, tag);
        }
        const colName = COL_LETTERS[c] ?? String(c + 1);
        const what = !cell ? '' : cell.kind === 'nook' ? t('workshop.nook', { n: cell.room ?? 1 }) : cell.kind === 'kettle' ? t('workshop.kettle_room') : t(`workshop.tools.${cell.kind}`);
        const problem = isBad ? (cell ? plainWhy(badWhy ?? '') : t('workshop.problems.needs_wall')) : '';
        const label = !cell
          ? (isBad ? t('a11y.workshop_cell_bad', { col: colName, row: r + 1, what: t('workshop.tools.erase'), problem: problem.replace(/\.$/, '') }) : t('a11y.workshop_cell_empty', { col: colName, row: r + 1 }))
          : isBad ? t('a11y.workshop_cell_bad', { col: colName, row: r + 1, what, problem: problem.replace(/\.$/, '') }) : t('a11y.workshop_cell', { col: colName, row: r + 1, what });
        const el = h('div', {
          class: `cell ${cell ? cell.kind : 'empty'} ${quad} ${isBad ? (cell ? 'bad bad-blk' : 'bad bad-gap') : ''}`,
          role: 'gridcell', 'data-c': c, 'data-r': r, tabindex: on ? 0 : -1,
          'aria-label': label,
          style: img ? `background-image:url(${img})` : undefined,
        }, roomArt, errBadge);
        row.append(el);
      }
      gridEl.append(row);
    }
    if (hadFocus) gridEl.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    gridEl.append(...Array.from({ length: COLS }, () => h('div', { class: 'cell footing-row', 'aria-hidden': 'true' })));

    // Right-hand enemy-facing arched Loophole gutter synced with Nook rows.
    loopholeGutter.replaceChildren(
      ...Array.from({ length: ROWS }, (_, idx) => {
        const r = ROWS - 1 - idx;
        return h('span', { class: `lp-slot ${nookTopRows.has(r) ? 'has-lp' : ''}` },
          nookTopRows.has(r) ? h('i', { class: 'lp-arch', title: t('workshop.shoots_this_way') }) : '',
        );
      }),
      h('span', { class: 'lp-slot foot' }),
    );

    // Structured Inspector Panel (Plate 4): honest counts + AA+ status card + issue list.
    const why = [...new Set(check.problems.map((p) => plainWhy(p.why)))];
    const solidCells = bp.cells.filter((x) => x.kind === 'wicker' || x.kind === 'timber' || x.kind === 'cobble');
    const blocksCount = !check.ok && check.blocks === 0 && solidCells.length > 0 ? solidCells.length : check.blocks;
    const costTotal = !check.ok && check.cost === 0 && solidCells.length > 0
      ? solidCells.reduce((acc, x) => acc + (BLOCK_COST[x.kind] ?? 0), 0)
      : check.cost;
    const nookCount = new Set(bp.cells.filter((x) => x.kind === 'nook').map((x) => x.room ?? 0)).size;
    const crewTarget = Math.max(1, Math.min(MAX_NOOKS, Math.max(3, rosterIds.length)));
    const blockPct = Math.min(100, Math.round((blocksCount / Math.max(1, check.budget)) * 100));

    status.classList.toggle('bad', !check.ok);
    status.classList.toggle('good', check.ok);
    if (check.ok) {
      status.replaceChildren(
        h('div', { class: 'status-head' }, `✓ ${savedNote ? t('workshop.saved_ready') : t('workshop.ready')}`),
      );
    } else {
      const issueCount = why.length;
      status.replaceChildren(
        h('div', { class: 'status-head' }, solidCells.length ? plural('workshop.to_fix', issueCount) : t('workshop.empty')),
        h('ul', { class: 'status-list' }, ...why.map((line) => h('li', {}, line))),
      );
    }

    metricsEl.replaceChildren(
      h('div', { class: 'metric-row' },
        h('span', { class: 'metric-k' }, t('workshop.nooks', { n: nookCount, total: crewTarget })),
        h('b', { class: `metric-v ${nookCount >= crewTarget ? 'ok' : ''}`, 'aria-hidden': 'true' }, `${nookCount} / ${crewTarget}`),
      ),
      h('div', { class: 'metric-row' },
        h('span', { class: 'metric-k' }, t('workshop.blocks')),
        h('div', { class: 'metric-bar' }, h('i', { class: blocksCount > check.budget ? 'over' : '', style: `width:${blockPct}%` })),
        h('b', { class: 'metric-v', 'aria-label': t('workshop.blocks_count', { n: blocksCount, total: check.budget }) }, `${blocksCount}/${check.budget}`),
      ),
      h('div', { class: 'metric-row' },
        h('span', { class: 'metric-k' }, t('workshop.cost')),
        h('b', { class: 'metric-v' }, `${costTotal}`),
      ),
    );

    saveBtn.toggleAttribute('disabled', !check.ok);
    testBtn.toggleAttribute('disabled', !check.ok);
    testBtn.title = check.ok ? t('workshop.test_yard_hint') : t('workshop.fix_first');
  }

  const cellFromEvent = (e: PointerEvent) => {
    const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const cellEl = t?.closest<HTMLElement>('.cell[data-c]');
    if (!cellEl?.dataset.c) return null;
    return [Number(cellEl.dataset.c), Number(cellEl.dataset.r)] as [number, number];
  };
  gridEl.addEventListener('pointerdown', (e) => {
    const c = cellFromEvent(e);
    if (!c) return;
    painting = true;
    cursor[0] = c[0]; cursor[1] = c[1];
    lastCell = key(...c);
    apply(...c);
    try { gridEl.setPointerCapture(e.pointerId); } catch { /* ok */ }
  });
  gridEl.addEventListener('pointermove', (e) => {
    if (!painting || tool === 'kettle' || tool === 'nook') return;
    const c = cellFromEvent(e);
    if (!c || key(...c) === lastCell) return;
    lastCell = key(...c);
    apply(...c);
  });
  const stop = () => { painting = false; };
  gridEl.addEventListener('pointerup', stop);
  gridEl.addEventListener('pointercancel', stop);
  window.addEventListener('blur', stop);

  const tools: [Tool, string][] = (['wicker', 'timber', 'cobble', 'nook', 'kettle', 'erase'] as Tool[]).map((k) => [k, t(`workshop.tools.${k}`)]);
  const palette = h('div', { class: 'palette', role: 'toolbar', 'aria-label': t('workshop.palette') });
  const paintPalette = () => palette.replaceChildren(...tools.map(([tl, label]) => {
    const ic = tl === 'kettle'
      ? heartkettleRoomUrl()
      : tl !== 'nook' && tl !== 'erase'
        ? sprites.url(`palette_block_${tl}`) ?? sprites.url(`block_${tl}_fresh`)
        : undefined;
    return btn(h('span', { class: 'tool-in' }, ic ? h('img', { src: ic, alt: '' }) : '', label), () => { tool = tl; paintPalette(); }, `chip tool ${tool === tl ? 'on' : ''}`, { 'aria-pressed': String(tool === tl) });
  }));
  paintPalette();
  sprites.whenLoaded(() => { paintPalette(); paint(); });

  function save(): void {
    const tb = trim(bp);
    if (!app.core.checkBlueprint(tb).ok) return;
    tb.name = tb.name && tb.name !== t('workshop.home_fort') ? tb.name : t('workshop.my_fort');
    tb.rowsText = blueprintToRows(tb);
    delete tb.id;
    app.progress.blueprint = tb;
    void app.saveProgress();
    savedNote = true;
    paint();
    play('confirm');
  }

  const rowTicks = h('div', { class: 'row-ticks', 'aria-hidden': 'true' },
    ...Array.from({ length: ROWS }, (_, i) => h('span', {}, String(ROWS - i))),
    h('span', { class: 'foot-tick' }, 'F'),
  );
  const colTicksTop = h('div', { class: 'col-ticks top', 'aria-hidden': 'true' },
    ...COL_LETTERS.map((ch) => h('span', {}, ch)),
  );
  const colTicksBot = h('div', { class: 'col-ticks bottom', 'aria-hidden': 'true' },
    ...COL_LETTERS.map((ch) => h('span', {}, ch)),
  );
  const frontBadge = h('div', { class: 'front-badge', 'aria-label': t('workshop.front_hint') },
    h('img', { src: frontLoopholeUrl(), alt: '', class: 'front-ico', 'aria-hidden': 'true' }),
    h('span', { 'aria-hidden': 'true' }, `${t('workshop.front')} →`),
  );
  // Three planted Stomper legs illustrated beneath the dark stone Footing row (Plate 4).
  const stompersEl = h('div', { class: 'ws-stompers', 'aria-hidden': 'true' });
  stompersEl.innerHTML = `<svg viewBox="0 0 320 34" preserveAspectRatio="none"><g stroke="#2C221E" stroke-width="2.5" stroke-linejoin="round">`
    + `<ellipse cx="160" cy="30" rx="142" ry="4" fill="rgba(44,34,30,0.22)" stroke="none"/>`
    + [54, 160, 266].map((cx) =>
      `<rect x="${cx - 7}" y="0" width="14" height="22" rx="2" fill="#C88A2E"/>`
      + `<circle cx="${cx}" cy="11" r="5" fill="#FFE08A"/>`
      + `<rect x="${cx - 19}" y="19" width="38" height="10" rx="4" fill="#2F6FDE"/>`
      + `<line x1="${cx - 12}" y1="24" x2="${cx + 12}" y2="24" stroke="#9DBDF5" stroke-width="2"/>`,
    ).join('')
    + `</g></svg>`;

  const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('workshop.your_fort') }, status, metricsEl);

  const el = h('main', { class: 'screen workshop' },
    h('header', { class: 'topbar' },
      btn('←', () => { play('back'); app.go({ to: 'map' }); }, 'round-btn silent', { 'aria-label': t('common.back') }),
      h('h1', {}, t('workshop.title')),
      btn(t('common.undo'), () => { const s = undo.pop(); if (s) { savedNote = false; redo.push(JSON.stringify(bp.cells)); bp.cells = JSON.parse(s); paint(); } }, 'secondary small'),
      btn(t('common.redo'), () => { const s = redo.pop(); if (s) { savedNote = false; undo.push(JSON.stringify(bp.cells)); bp.cells = JSON.parse(s); paint(); } }, 'secondary small'),
    ),
    h('div', { class: 'ws-body' },
      h('div', { class: 'gridwrap' },
        h('div', { class: 'gridhead' }, h('span', { class: 'rear-badge' }), frontBadge),
        colTicksTop,
        h('div', { class: 'gridframe' }, rowTicks, gridEl, loopholeGutter),
        stompersEl,
        colTicksBot,
      ),
      inspector,
    ),
    palette,
    h('footer', { class: 'pinned' },
      btn(t('common.revert'), () => { snapshotState(); bp = fresh(); paint(); }, 'secondary'),
      testBtn,
      saveBtn,
    ),
  );
  paint();
  return { el, destroy: () => window.removeEventListener('blur', stop) };
}

/**
 * The core's blueprint refusal in the table's words (workshop.problems). The core sends one reason
 * id (invalid_blueprint) with an English detail; the detail is only read here, never shown.
 */
function plainWhy(w: string): string {
  let m: RegExpMatchArray | null;
  if (/outside|grid \d+x\d+/i.test(w)) return /outside 3x3/.test(w) && /grid [0-2]x|grid \dx[0-2]\b/.test(w) ? t('workshop.problems.too_small') : t('workshop.problems.too_big', { cols: COLS, rows: ROWS });
  if (/no support|hanging|float/i.test(w)) return t('workshop.problems.nothing_under');
  if ((m = w.match(/Nook (\d+) must be walled/i))) return t('workshop.problems.nook_walls', { n: m[1] });
  if ((m = w.match(/(\d+) Nooks for (\d+) Hobs/i))) return t('workshop.problems.nooks_for_hobs', { n: m[1], hobs: m[2] });
  if (/at most \d+ Nooks/i.test(w)) return t('workshop.problems.nooks_max', { n: MAX_NOOKS });
  if ((m = w.match(/Budget (\d+) over (\d+)/i))) return plural('workshop.problems.over_budget', Math.max(1, Number(m[1]) - Number(m[2])));
  if (/Kettle Room must sit one block in/i.test(w)) return t('workshop.problems.kettle_room_edge');
  if (/Kettle Room must be walled/i.test(w)) return t('workshop.problems.kettle_room_walls');
  if (/Kettle Room must be 2 x 2/i.test(w)) return t('workshop.problems.kettle_room_size');
  if (/Kettle/i.test(w)) return t('workshop.problems.no_kettle_room');
  if (/Nook/i.test(w)) return t('workshop.problems.no_nook');
  if (/Footing/i.test(w)) return t('workshop.problems.footing_row');
  if (/no rows/i.test(w)) return t('workshop.empty');
  return t('workshop.problems.check_failed');
}

/** Cut the grid to the used box so the fort sits on its Footing. */
function trim(bp: Blueprint): Blueprint {
  if (!bp.cells.length) return { name: bp.name, cols: 1, rows: 1, cells: [] };
  const minC = Math.min(...bp.cells.map((c) => c.col));
  const maxC = Math.max(...bp.cells.map((c) => c.col));
  const maxR = Math.max(...bp.cells.map((c) => c.row));
  return { name: bp.name, cols: maxC - minC + 1, rows: maxR + 1, cells: bp.cells.map((c) => ({ ...c, col: c.col - minC })) };
}
