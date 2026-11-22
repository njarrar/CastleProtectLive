// Local save in IndexedDB: one key-value store. Falls back to memory if IndexedDB is blocked.
import type { BattleSetup, Blueprint, Difficulty } from '../core/types';

export interface Settings {
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

export interface Progress {
  levels: Record<string, { pennants: boolean[]; wins: number; losses: number }>;
  buttons: number;
  lastCrew: string[];
  blueprint?: Blueprint;
  duelNames: [string, string];
  hints: string[];
}

export interface BattleSave {
  setup: BattleSetup;
  core: string; // opaque core save
  coreName: string;
  label: string; // "Round 6, Otis's turn"
  savedAt: number;
  handoff?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
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

export const DEFAULT_PROGRESS: Progress = { levels: {}, buttons: 0, lastCrew: ['marge'], duelNames: ['Player 1', 'Player 2'], hints: [] };

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
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch {
      res(null);
    }
  });
  return dbp;
}

export async function get<T>(key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return mem.get(key) as T | undefined;
  return new Promise((res) => {
    const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    tx.onsuccess = () => res(tx.result as T | undefined);
    tx.onerror = () => res(undefined);
  });
}

export async function put(key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) { mem.set(key, value); return; }
  return new Promise((res) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

export async function del(key: string): Promise<void> {
  const db = await open();
  if (!db) { mem.delete(key); return; }
  return new Promise((res) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await get<Settings>('settings')) ?? {}) };
}
export async function loadProgress(): Promise<Progress> {
  return { ...DEFAULT_PROGRESS, ...((await get<Progress>('progress')) ?? {}) };
}
export const saveSettings = (s: Settings) => put('settings', s);
export const saveProgress = (p: Progress) => put('progress', p);
export const loadBattleSave = () => get<BattleSave>('battle');
export const saveBattle = (b: BattleSave) => put('battle', b);
export const clearBattle = () => del('battle');
