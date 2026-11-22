// App numbers the core does not send. They live in content/app.json (schema:
// content/schema/app.schema.json), never in TypeScript. Since core v0.2 the core sends the
// Buttons earned (result.buttons), applies Help Steam (setup `help`), the Steam bar's full
// value (hud.steam_max), the Shove Off cost and the Workshop budget, so the web no longer
// reads those from app.json (the core still does).
import data from '../../../../content/app.json' with { type: 'json' };

export interface AppRules {
  version: number;
  joins: Record<string, string>;
  campaign: { walk_from: string; doodads_from: string; doodads: string[]; modes_after: string };
  wind_presets: Record<string, { min: number; max: number }>;
  rummage_presets: Record<string, { pool: number; picks: number }>;
  workshop: { budget: number; cols: number; rows: number; max_nooks: number };
  walk: { cells: number; ticks: number };
  rival_think_seconds: number;
}

export const RULES: AppRules = data as AppRules;

/** Campaign level order: "1-9" < "1-10" < "2-1". */
export function levelIndex(id: string): number {
  const [r, n] = id.split('-').map(Number);
  return Number.isFinite(r) && Number.isFinite(n) ? r * 100 + n : -1;
}
export function levelAtLeast(id: string | undefined, from: string): boolean {
  return !!id && levelIndex(id) >= 0 && levelIndex(id) >= levelIndex(from);
}
