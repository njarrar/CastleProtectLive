// App rule numbers that are not in the core snapshot yet. They live in content/app.json
// (schema: content/schema/app.schema.json), never in TypeScript. See the "Core requests"
// section of docs/review/code/web-review-1.md for the ones the core should send instead.
import data from '../../../../content/app.json';

export interface AppRules {
  version: number;
  rewards: { buttons_win: number; buttons_loss: number };
  joins: Record<string, string>;
  campaign: { walk_from: string; doodads_from: string; doodads: string[]; modes_after: string };
  help_steam: { none: number; some: number; lots: number };
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
