// Every line a player reads or hears read out comes from content/text.json, the one string table
// that web, Android and iOS share (content/text.md). Names and card lines come from content JSON.
// This file only looks lines up: keys are dotted paths, {placeholders} are swapped for values,
// a list is a pool (a random line, never the same one twice running), and a { one, other } pair
// is a plural. Keys that start with `_` are notes for people and are never shown.
import raw from '../../../../content/text.json' with { type: 'json' };
import classesRaw from '../../../../content/classes.json' with { type: 'json' };

type Node = string | Node[] | { [k: string]: Node };
export type Vars = Record<string, string | number | undefined>;

const ROOT = raw as unknown as { [k: string]: Node };

function node(key: string): Node | undefined {
  let n: Node | undefined = ROOT;
  for (const part of key.split('.')) {
    if (!n || typeof n !== 'object' || Array.isArray(n) || part.startsWith('_')) return undefined;
    n = (n as { [k: string]: Node })[part];
  }
  return n;
}

/** True when the table has a line (or a pool, or a plural) at `key`. */
export function has(key: string): boolean {
  const n = node(key);
  if (n === undefined) return false;
  if (typeof n === 'string') return n.length > 0;
  return true;
}

/** Swap each {word} for its value. A placeholder with no value is left out. */
export function fill(s: string, vars?: Vars): string {
  if (!vars || s.indexOf('{') < 0) return s;
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (vars[k] === undefined ? '' : String(vars[k])));
}

const lastPick = new Map<string, number>();
let seed = (Date.now() ^ 0x5eed) >>> 0;
function rand(): number { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

/** One line from a pool, never the one shown last time for that key. */
function fromPool(key: string, pool: Node[]): string {
  const lines = pool.filter((x): x is string => typeof x === 'string');
  if (!lines.length) return '';
  let i = Math.floor(rand() * lines.length);
  if (lines.length > 1 && i === lastPick.get(key)) i = (i + 1) % lines.length;
  lastPick.set(key, i);
  return lines[i];
}

function resolve(key: string, n: Node | undefined, vars?: Vars): string {
  if (n === undefined) return '';
  if (typeof n === 'string') return fill(n, vars);
  if (Array.isArray(n)) return fill(fromPool(key, n), vars);
  // A plural pair: { one, other } picked by {n}.
  if ('other' in n || 'one' in n) {
    const count = Number(vars?.n ?? 0);
    const form = count === 1 && n.one !== undefined ? n.one : n.other ?? n.one;
    return resolve(key, form, vars);
  }
  return '';
}

/**
 * The line at `key` with its placeholders filled. A pool gives one line at random, a plural
 * pair picks by `vars.n`. A missing key gives '' (and a warning in dev), never the key itself.
 */
export function t(key: string, vars?: Vars): string {
  const n = node(key);
  if (n === undefined && import.meta.env?.DEV) console.warn(`[text] no line for ${key}`);
  return resolve(key, n, vars);
}

/** `group.<id>` when the table has it (an empty line counts: it means "say nothing"), else `group.default`. For ids the core sends (how, why, by...). */
export function byId(group: string, id: string | undefined, vars?: Vars): string {
  if (id && node(`${group}.${id}`) !== undefined) return t(`${group}.${id}`, vars);
  return has(`${group}.default`) ? t(`${group}.default`, vars) : '';
}

/** A plural: `key.one` or `key.other` by n (n also fills {n}). */
export function plural(key: string, n: number, vars?: Vars): string {
  return t(key, { ...vars, n });
}

/** The list at `key` as it is (for menus such as the Couch Duel names). */
export function list(key: string): string[] {
  const n = node(key);
  return Array.isArray(n) ? n.filter((x): x is string => typeof x === 'string') : [];
}

// ---------- names ----------

/** Content Hob ids by the names the web used before (sprite name `thumper`, a `p2_` prefix). */
export function hobContentId(id: string): string {
  return id.replace(/^p2_/, '').replace(/^thumper$/, 'old_thumper');
}

/**
 * A Hob's short name for chips, banners and spoken lines (`hobs.<id>.short`). Never cut a content
 * name at the first space: that turns Old Thumper into "Old" and Miss Quill into "Miss".
 */
export function hobShort(id: string | undefined, fallback = ''): string {
  if (id) {
    const k = `hobs.${hobContentId(id)}.short`;
    if (has(k)) return t(k);
  }
  return fallback;
}

interface RivalEntry { key: string; name: string; short: string }
let rivalList: RivalEntry[] | undefined;
function rivals(): RivalEntry[] {
  if (rivalList) return rivalList;
  const r = node('rivals');
  rivalList = [];
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    for (const key of Object.keys(r)) {
      if (key.startsWith('_') || key === 'banner' || key === 'skirmish') continue;
      const name = node(`rivals.${key}.name`);
      const short = node(`rivals.${key}.short`);
      if (typeof name === 'string') rivalList.push({ key, name, short: typeof short === 'string' ? short : name });
    }
  }
  return rivalList;
}

/** The Rival's key in `rivals`: by the level's own key first, else by the name the core sends. */
export function rivalKey(name?: string, level?: string): string | undefined {
  if (level && has(`levels.${level}.rival`)) {
    const k = t(`levels.${level}.rival`);
    if (has(`rivals.${k}.name`)) return k;
  }
  if (!name) return undefined;
  return rivals().find((r) => r.name === name)?.key;
}

/** The Rival's short name (`rivals.<key>.short`), else the name as it came. */
export function rivalShort(name?: string, level?: string): string {
  const k = rivalKey(name, level);
  return k ? t(`rivals.${k}.short`) : name ?? '';
}

/** One line from the Rival's pool under `rivals.<key>.<path>`, or '' when the Rival has none. */
export function rivalLine(path: string, name?: string, level?: string, vars?: Vars): string {
  const k = rivalKey(name, level);
  return k && has(`rivals.${k}.${path}`) ? t(`rivals.${k}.${path}`, vars) : '';
}

/** "A and B", "A, B and C". */
export function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return t('common.list_and', { a: items[0], b: items[1] });
  return t('common.list_and', { a: items.slice(0, -1).join(', '), b: items[items.length - 1] });
}

/** A Class's display name from content/classes.json (Digger, Bouncer...), else the id as it came. */
export function className(cls: string | undefined): string {
  if (!cls) return '';
  return (classesRaw as { id: string; name: string }[]).find((c) => c.id === cls)?.name ?? cls;
}
