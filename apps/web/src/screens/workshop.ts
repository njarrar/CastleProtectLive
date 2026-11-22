// S10 simple Workshop: place and remove blocks on the grid, save one Blueprint.
// Legality comes from core.checkBlueprint; the editor only shows what the core says.
import type { App, Screen } from '../app';
import { play } from '../audio/sfx';
import { blueprintToRows } from '../core/bp';
import type { Blueprint, BlueprintCell } from '../core/types';
import { sprites } from '../render/sprites';
import { btn, h } from '../ui/dom';
import { yardSetup } from './home';
import { RULES } from '../core/rules';

type Tool = BlueprintCell['kind'] | 'erase';
const COLS = RULES.workshop.cols;
const ROWS = RULES.workshop.rows;
const MAX_NOOKS = RULES.workshop.max_nooks;

export function workshopScreen(app: App): Screen {
  const fresh = () => structuredClone(app.progress.blueprint ?? app.core.defaultBlueprint());
  let bp: Blueprint = fresh();
  bp.cols = COLS;
  bp.rows = ROWS;
  let tool: Tool = 'cobble';
  const undo: string[] = [];
  const redo: string[] = [];
  const gridEl = h('div', { class: 'grid', role: 'grid', 'aria-label': 'Fort grid' });
  const status = h('div', { class: 'status', 'aria-live': 'polite' });
  const saveBtn = btn('Save', () => save(), 'primary');
  let dirty = false;

  const key = (c: number, r: number) => `${c},${r}`;
  function cellAt(c: number, r: number) { return bp.cells.find((x) => x.col === c && x.row === r); }
  function snapshotState() { undo.push(JSON.stringify(bp.cells)); if (undo.length > 50) undo.shift(); redo.length = 0; }

  function apply(c: number, r: number): void {
    snapshotState();
    if (tool === 'erase') {
      const hit = cellAt(c, r);
      if (hit?.kind === 'kettle') bp.cells = bp.cells.filter((x) => x.kind !== 'kettle');
      else if (hit?.kind === 'nook') bp.cells = bp.cells.filter((x) => !(x.kind === 'nook' && x.room === hit.room));
      else bp.cells = bp.cells.filter((x) => !(x.col === c && x.row === r));
    } else if (tool === 'kettle' || tool === 'nook') {
      // Rooms are 2 x 2. One Kettle Room; Nooks are numbered 1 to 5 (seat order).
      if (c + 1 >= COLS || r + 1 >= ROWS) { undo.pop(); return; }
      let room: number | undefined;
      if (tool === 'kettle') bp.cells = bp.cells.filter((x) => x.kind !== 'kettle');
      else {
        const used = new Set(bp.cells.filter((x) => x.kind === 'nook').map((x) => x.room));
        room = Array.from({ length: MAX_NOOKS }, (_, i) => i + 1).find((n) => !used.has(n));
        if (!room) { undo.pop(); status.textContent = `${MAX_NOOKS} Nooks at most.`; return; }
      }
      const box = [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]];
      if (bp.cells.some((x) => (x.kind === 'nook' || x.kind === 'kettle') && box.some(([a, b]) => a === x.col && b === x.row))) { undo.pop(); return; }
      bp.cells = bp.cells.filter((x) => !box.some(([a, b]) => a === x.col && b === x.row));
      for (const [a, b] of box) bp.cells.push({ col: a, row: b, kind: tool, room });
    } else {
      const hit = cellAt(c, r);
      if (hit?.kind === 'kettle' || hit?.kind === 'nook') { undo.pop(); return; }
      bp.cells = bp.cells.filter((x) => !(x.col === c && x.row === r));
      bp.cells.push({ col: c, row: r, kind: tool });
    }
    dirty = true;
    play('tap');
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
  function paint(): void {
    bp.rowsText = undefined;
    const check = app.core.checkBlueprint(trim(bp));
    const minC = Math.min(COLS, ...bp.cells.map((x) => x.col));
    const bad = new Set(check.problems.map((p) => key(p.col + minC, p.row)));
    const hadFocus = gridEl.contains(document.activeElement);
    gridEl.replaceChildren();
    for (let r = ROWS - 1; r >= 0; r--) {
      const row = h('div', { class: 'gridrow', role: 'row' });
      for (let c = 0; c < COLS; c++) {
        const cell = cellAt(c, r);
        const img = cell && cell.kind !== 'nook' && cell.kind !== 'kettle' ? sprites.url(`block_${cell.kind}_fresh`) : undefined;
        const on = c === cursor[0] && r === cursor[1];
        const el = h('div', {
          class: `cell ${cell ? cell.kind : 'empty'} ${bad.has(key(c, r)) && cell ? 'bad' : ''}`,
          role: 'gridcell', 'data-c': c, 'data-r': r, tabindex: on ? 0 : -1,
          'aria-label': `Column ${c + 1}, row ${r + 1}${cell ? `, ${cell.kind}` : ', empty'}`,
          style: img ? `background-image:url(${img})` : undefined,
        }, cell?.kind === 'nook' ? String(cell.room ?? 'N') : cell?.kind === 'kettle' ? '♨' : '');
        row.append(el);
      }
      gridEl.append(row);
    }
    if (hadFocus) gridEl.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    gridEl.append(...Array.from({ length: COLS }, () => h('div', { class: 'cell footing-row', 'aria-hidden': 'true' })));
    const why = [...new Set(check.problems.map((p) => p.why))];
    status.textContent = `Blocks ${check.blocks}/${check.budget}   Cost ${check.cost}   ${check.ok ? 'Ready' : why.join('. ')}`;
    status.classList.toggle('bad', !check.ok);
    saveBtn.toggleAttribute('disabled', !check.ok);
  }

  const cellFromEvent = (e: PointerEvent) => {
    const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!t?.dataset.c) return null;
    return [Number(t.dataset.c), Number(t.dataset.r)] as [number, number];
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

  const tools: [Tool, string][] = [['wicker', 'Wicker'], ['timber', 'Timber'], ['cobble', 'Cobble'], ['nook', 'Nook'], ['kettle', 'Kettle'], ['erase', 'Erase']];
  const palette = h('div', { class: 'palette', role: 'toolbar', 'aria-label': 'Palette' });
  const paintPalette = () => palette.replaceChildren(...tools.map(([t, label]) => {
    const ic = t !== 'nook' && t !== 'kettle' && t !== 'erase' ? sprites.url(`palette_block_${t}`) ?? sprites.url(`block_${t}_fresh`) : undefined;
    return btn(h('span', {}, ic ? h('img', { src: ic, alt: '' }) : '', label), () => { tool = t; paintPalette(); }, `chip tool ${tool === t ? 'on' : ''}`, { 'aria-pressed': String(tool === t) });
  }));
  paintPalette();
  sprites.whenLoaded(() => { paintPalette(); paint(); });

  function save(): void {
    const t = trim(bp);
    if (!app.core.checkBlueprint(t).ok) return;
    t.name = t.name && t.name !== 'Home fort' ? t.name : 'My Fort';
    t.rowsText = blueprintToRows(t);
    delete t.id;
    app.progress.blueprint = t;
    void app.saveProgress();
    dirty = false;
    status.textContent = 'Saved.';
    play('pennant');
  }

  const el = h('main', { class: 'screen workshop' },
    h('header', { class: 'topbar' },
      btn('←', () => app.go({ to: 'map' }), 'round-btn', { 'aria-label': 'Back' }),
      h('h1', {}, 'Workshop'),
      btn('Undo', () => { const s = undo.pop(); if (s) { redo.push(JSON.stringify(bp.cells)); bp.cells = JSON.parse(s); paint(); } }, 'secondary small'),
      btn('Redo', () => { const s = redo.pop(); if (s) { undo.push(JSON.stringify(bp.cells)); bp.cells = JSON.parse(s); paint(); } }, 'secondary small'),
    ),
    h('div', { class: 'ws-body' }, h('div', { class: 'gridwrap' }, gridEl), status),
    palette,
    h('footer', { class: 'pinned' },
      btn('Revert', () => { snapshotState(); bp = fresh(); bp.cols = COLS; bp.rows = ROWS; paint(); }, 'secondary'),
      btn('Test Yard', () => { if (dirty) save(); const tb = trim(bp); tb.rowsText = blueprintToRows(tb); delete tb.id; app.go({ to: 'battle', setup: yardSetup(app, tb) }); }, 'team'),
      saveBtn,
    ),
  );
  paint();
  return { el, destroy: () => window.removeEventListener('blur', stop) };
}

/** Cut the grid to the used box so the fort sits on its Footing. */
function trim(bp: Blueprint): Blueprint {
  if (!bp.cells.length) return { name: bp.name, cols: 1, rows: 1, cells: [] };
  const minC = Math.min(...bp.cells.map((c) => c.col));
  const maxC = Math.max(...bp.cells.map((c) => c.col));
  const maxR = Math.max(...bp.cells.map((c) => c.row));
  return { name: bp.name, cols: maxC - minC + 1, rows: maxR + 1, cells: bp.cells.map((c) => ({ ...c, col: c.col - minC })) };
}
