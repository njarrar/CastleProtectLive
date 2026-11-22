// Blueprint form conversions (data only): view cells <-> the core's glyph rows (core/API.md).
import type { Blueprint, BlueprintCell, Material } from './types';

export const GLYPHS: Record<string, Material> = { w: 'wicker', t: 'timber', c: 'cobble', F: 'footing' };

/** View cells (row 0 just above the Footing, col 0 at the back) to glyph rows, top first, Footing last. */
export function blueprintToRows(bp: Blueprint, glyphs: Record<string, Material> = GLYPHS): string[] {
  const inv: Record<string, string> = {};
  for (const [g, m] of Object.entries(glyphs)) inv[m] = g;
  const cols = Math.max(1, ...bp.cells.map((c) => c.col + 1));
  const rows = Math.max(1, ...bp.cells.map((c) => c.row + 1));
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.'));
  for (const c of bp.cells) {
    grid[c.row][c.col] = c.kind === 'kettle' ? 'K' : c.kind === 'nook' ? String(c.room ?? 1) : inv[c.kind] ?? 't';
  }
  return grid.reverse().map((r) => r.join('')).concat(['F'.repeat(cols)]);
}

export function rowsToBlueprint(rows: string[], name: string, glyphs: Record<string, Material> = GLYPHS): Blueprint {
  const body = rows.filter((r) => !/^F+$/.test(r));
  const cells: BlueprintCell[] = [];
  body.forEach((line, i) => {
    const row = body.length - 1 - i;
    [...line].forEach((g, col) => {
      if (g === '.') return;
      if (g === 'K') cells.push({ col, row, kind: 'kettle' });
      else if (/[1-5]/.test(g)) cells.push({ col, row, kind: 'nook', room: Number(g) });
      else if (glyphs[g]) cells.push({ col, row, kind: glyphs[g] });
    });
  });
  return { name, cols: Math.max(1, ...body.map((r) => r.length)), rows: body.length, cells, rowsText: rows };
}
