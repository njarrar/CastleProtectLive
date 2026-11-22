// Local save in IndexedDB: one key-value store. Falls back to memory if IndexedDB is blocked.
// Every record has a version and is checked field by field on load: a bad field falls back
// to its default, the raw record is kept under "<key>.broken", and the last good record is
// kept under "<key>.bak". Nothing read from storage can stop the app from booting.
import type { BattleSetup, Blueprint, BlueprintCell, Difficulty } from '../core/types';

export interface Settings {
  version: number;
  sound: number; // 0 to 100
  mute: boolean;
  difficulty: Difficulty;
  windOff: boolean;
  reduceMotion: boolean;
  quickFire: boolean;
  dragMode: 'pull' | 'point';
  rotation: 'follow' | 'wide' | 'tall';
  rivalFast: boolean;
  seenFirstRun: boolean;
}

export interface LevelRecord { pennants: boolean[]; wins: number; losses: number }

export interface Progress {
  version: number;
  levels: Record<string, LevelRecord>;
  buttons: number;
  lastCrew: string[];
  blueprint?: Blueprint;
  duelNames: [string, string];
  hints: string[];
  persistAsked?: boolean;
}

export interface BattleSave {
  setup: BattleSetup;
  core: string; // opaque core save
  coreName: string;
  label: string; // "Round 6, Otis's turn"
  savedAt: number;
  handoff?: boolean;
}

export const SETTINGS_VERSION = 1;
export const PROGRESS_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  sound: 70,
  mute: false,
  difficulty: 'fair',
  windOff: false,
  reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  quickFire: false,
  dragMode: 'pull',
  rotation: 'follow',
  rivalFast: false,
  seenFirstRun: false,
};

export const DEFAULT_PROGRESS: Progress = { version: PROGRESS_VERSION, levels: {}, buttons: 0, lastCrew: ['marge'], duelNames: ['Player 1', 'Player 2'], hints: [] };

const DB = 'castle-protect';
const STORE = 'kv';
let dbp: Promise<IDBDatabase | null> | null = null;
const mem = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => {
        const db = r.result;
        // Another tab upgrades, or iOS drops the connection in the background: open again next time.
        db.onversionchange = () => { db.close(); dbp = null; };
        db.onclose = () => { dbp = null; };
        res(db);
      };
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch {
      res(null);
    }
  });
  return dbp;
}

/** Run one request; reopen the database once if the connection was closed. Falls back to memory. */
async function run<T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest | void, memAct: () => T | undefined): Promise<T | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const db = await open();
    if (!db) return memAct();
    try {
      return await new Promise<T | undefined>((res, rej) => {
        const tx = db.transaction(STORE, mode);
        const req = act(tx.objectStore(STORE));
        tx.oncomplete = () => res(req ? (req.result as T | undefined) : undefined);
        tx.onerror = () => rej(tx.error ?? new Error('idb error'));
        tx.onabort = () => rej(tx.error ?? new Error('idb abort')); // quota and the like
      });
    } catch (e) {
      if (attempt === 0 && e instanceof DOMException && e.name === 'InvalidStateError') { dbp = null; continue; }
      return memAct();
    }
  }
  return memAct();
}

export function get<T>(key: string): Promise<T | undefined> {
  return run<T>('readonly', (s) => s.get(key), () => mem.get(key) as T | undefined);
}

export async function put(key: string, value: unknown): Promise<void> {
  mem.set(key, value);
  await run<void>('readwrite', (s) => { s.put(value, key); }, () => undefined);
}

export async function del(key: string): Promise<void> {
  mem.delete(key);
  await run<void>('readwrite', (s) => { s.delete(key); }, () => undefined);
}

// ---------- field checks ----------
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);
const strs = (v: unknown, d: string[], maxLen = 64): string[] => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? v.slice(0, maxLen) : d);
const KINDS = ['wicker', 'timber', 'cobble', 'footing', 'brassbound', 'nook', 'kettle'];

export function checkBlueprint(v: unknown): Blueprint | undefined {
  if (!isObj(v) || !Array.isArray(v.cells)) return undefined;
  const cells: BlueprintCell[] = [];
  for (const c of v.cells) {
    if (!isObj(c) || !Number.isInteger(c.col) || !Number.isInteger(c.row) || !KINDS.includes(String(c.kind))) return undefined;
    cells.push({ col: c.col as number, row: c.row as number, kind: c.kind as BlueprintCell['kind'], ...(Number.isInteger(c.room) ? { room: c.room as number } : {}) });
  }
  const bp: Blueprint = { name: typeof v.name === 'string' ? v.name.slice(0, 40) : 'My Fort', cols: num(v.cols, 1, 1, 32), rows: num(v.rows, 1, 1, 32), cells };
  if (typeof v.id === 'string') bp.id = v.id;
  if (typeof v.kit === 'string') bp.kit = v.kit;
  if (Array.isArray(v.rowsText) && v.rowsText.every((x) => typeof x === 'string')) bp.rowsText = v.rowsText as string[];
  return bp;
}

/** Each field checked on its own: a bad field gets its default, the rest is kept. */
export function migrateProgress(raw: unknown): { value: Progress; clean: boolean } {
  const d = structuredClone(DEFAULT_PROGRESS);
  if (!isObj(raw)) return { value: d, clean: raw === undefined };
  let clean = true;
  const bad = () => { clean = false; };
  // v0 (no version field) had the same shape as v1.
  const ver = raw.version === undefined ? 0 : raw.version;
  if (typeof ver !== 'number' || ver > PROGRESS_VERSION) bad();
  const levels: Record<string, LevelRecord> = {};
  if (isObj(raw.levels)) {
    for (const [id, r] of Object.entries(raw.levels)) {
      if (!/^[\w-]{1,12}$/.test(id) || !isObj(r)) { bad(); continue; }
      const pens = Array.isArray(r.pennants) ? [0, 1, 2].map((i) => (r.pennants as unknown[])[i] === true) : [false, false, false];
      levels[id] = { pennants: pens, wins: num(r.wins, 0, 0), losses: num(r.losses, 0, 0) };
    }
  } else if (raw.levels !== undefined) bad();
  const out: Progress = {
    version: PROGRESS_VERSION,
    levels,
    buttons: num(raw.buttons, d.buttons, 0),
    lastCrew: strs(raw.lastCrew, d.lastCrew, 5),
    duelNames: Array.isArray(raw.duelNames) && raw.duelNames.length === 2 && raw.duelNames.every((x) => typeof x === 'string')
      ? [String(raw.duelNames[0]).slice(0, 12), String(raw.duelNames[1]).slice(0, 12)] : d.duelNames,
    hints: strs(raw.hints, d.hints),
    persistAsked: raw.persistAsked === true,
  };
  if (raw.buttons !== undefined && !(typeof raw.buttons === 'number' && Number.isFinite(raw.buttons))) bad();
  if (raw.blueprint !== undefined) {
    const bp = checkBlueprint(raw.blueprint);
    if (bp) out.blueprint = bp; else bad();
  }
  for (const k of ['lastCrew', 'hints', 'duelNames'] as const) if (raw[k] !== undefined && !Array.isArray(raw[k])) bad();
  return { value: out, clean };
}

export function migrateSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isObj(raw)) return { ...d };
  return {
    version: SETTINGS_VERSION,
    sound: num(raw.sound, d.sound, 0, 100),
    mute: bool(raw.mute, d.mute),
    difficulty: oneOf(raw.difficulty, ['cozy', 'fair', 'stubborn'] as const, d.difficulty),
    windOff: bool(raw.windOff, d.windOff),
    reduceMotion: bool(raw.reduceMotion, d.reduceMotion),
    quickFire: bool(raw.quickFire, d.quickFire),
    dragMode: oneOf(raw.dragMode, ['pull', 'point'] as const, d.dragMode),
    rotation: oneOf(raw.rotation, ['follow', 'wide', 'tall'] as const, d.rotation),
    rivalFast: bool(raw.rivalFast, d.rivalFast),
    seenFirstRun: bool(raw.seenFirstRun, d.seenFirstRun),
  };
}

export function checkBattleSave(v: unknown): BattleSave | undefined {
  if (!isObj(v) || typeof v.core !== 'string' || typeof v.coreName !== 'string' || !isObj(v.setup)) return undefined;
  const s = v.setup;
  if (!['campaign', 'skirmish', 'duel', 'yard'].includes(String(s.mode)) || !Array.isArray(s.sides) || s.sides.length !== 2) return undefined;
  return {
    setup: s as unknown as BattleSetup, core: v.core, coreName: v.coreName,
    label: typeof v.label === 'string' ? v.label.slice(0, 80) : 'Saved fight',
    savedAt: num(v.savedAt, 0), handoff: v.handoff === true,
  };
}

async function safeGet<T>(key: string): Promise<T | undefined> {
  try { return await get<T>(key); } catch { return undefined; }
}

export async function loadSettings(): Promise<Settings> {
  return migrateSettings(await safeGet('settings'));
}

/** The progress record, checked. A damaged one is kept as "progress.broken"; the last good copy is "progress.bak". */
export async function loadProgress(): Promise<Progress> {
  const raw = await safeGet<unknown>('progress');
  const m = migrateProgress(raw);
  if (m.clean) {
    if (raw !== undefined) void put('progress.bak', m.value).catch(() => undefined);
    return m.value;
  }
  void put('progress.broken', { at: Date.now(), raw }).catch(() => undefined);
  const bak = migrateProgress(await safeGet<unknown>('progress.bak'));
  const best = bak.clean && raw !== undefined && Object.keys(bak.value.levels).length >= Object.keys(m.value.levels).length ? bak.value : m.value;
  void put('progress', best).catch(() => undefined);
  return best;
}

export const saveSettings = (s: Settings) => put('settings', s);
export const saveProgress = (p: Progress) => put('progress', p);
export const saveBattle = (b: BattleSave) => put('battle', b);
export const clearBattle = () => del('battle');

/** The saved fight, checked. A damaged one is moved to "battle.broken" and not offered. */
export async function loadBattleSave(): Promise<BattleSave | undefined> {
  const raw = await safeGet<unknown>('battle');
  if (raw === undefined) return undefined;
  const b = checkBattleSave(raw);
  if (!b) await dropBattleSave(raw);
  return b;
}

export async function dropBattleSave(raw?: unknown): Promise<void> {
  try {
    const r = raw ?? (await safeGet<unknown>('battle'));
    if (r !== undefined) await put('battle.broken', { at: Date.now(), raw: r });
    await clearBattle();
  } catch { /* nothing to do */ }
}

/** Wipe every key (the boot error screen's "Reset save"). */
export async function resetAll(): Promise<void> {
  mem.clear();
  try { indexedDB.deleteDatabase(DB); } catch { /* blocked */ }
  dbp = null;
}

/** Ask the browser to keep the save (Safari may clear unused site data after a week). */
export async function askPersist(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
