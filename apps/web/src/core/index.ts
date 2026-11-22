import { MockCore } from './mock';
import { HOBS, LEVELS, STARTER_FORTS } from './content';
import type { BattleSetup, Blueprint, BlueprintCheck, Command, CommandResult, CoreApi, Snapshot } from './types';

export * from './types';

/**
 * Loads the real core (castle-wasm, built by scripts/build-wasm.sh and copied to
 * `<base>/core/` by vite.config.ts) and falls back to the mock when it is absent.
 * `?core=mock` forces the mock, `?core=wasm` forces the real one (fails loudly).
 */
export async function loadCore(): Promise<CoreApi> {
  const want = new URLSearchParams(location.search).get('core');
  if (want === 'mock') return new MockCore();
  try {
    const base = import.meta.env.BASE_URL;
    const url = `${base}core/castle_wasm.js`;
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || !(head.headers.get('content-type') ?? '').includes('javascript')) throw new Error('no wasm pkg');
    const mod = (await import(/* @vite-ignore */ url)) as WasmModule;
    if (typeof mod.default === 'function') await mod.default();
    return new WasmCore(mod);
  } catch (e) {
    if (want === 'wasm') throw e;
    console.info('[castle] using the mock core:', (e as Error).message);
    return new MockCore();
  }
}

// The shape we expect from castle-wasm (JSON in, JSON out). See core/API.md once it lands.
interface WasmBattle {
  command(json: string): string;
  step(ticks: number): void;
  snapshot(): string;
  save(): string;
  free?(): void;
}
interface WasmModule {
  default?: (input?: unknown) => Promise<unknown>;
  version?: () => string;
  levels?: () => string;
  hobs?: () => string;
  starter_forts?: () => string;
  check_blueprint?: (json: string) => string;
  new_battle?: (json: string) => WasmBattle;
  load_battle?: (save: string) => WasmBattle;
  Battle?: { new (json: string): WasmBattle; load?(save: string): WasmBattle };
}

class WasmCore implements CoreApi {
  readonly name = 'wasm';
  readonly version: string;
  private b?: WasmBattle;
  constructor(private mod: WasmModule) {
    this.version = mod.version?.() ?? 'wasm';
  }
  levels() { return this.mod.levels ? JSON.parse(this.mod.levels()) : LEVELS; }
  hobs() { return this.mod.hobs ? JSON.parse(this.mod.hobs()) : HOBS; }
  starterForts(): Blueprint[] { return this.mod.starter_forts ? JSON.parse(this.mod.starter_forts()) : STARTER_FORTS; }
  checkBlueprint(bp: Blueprint): BlueprintCheck {
    if (this.mod.check_blueprint) return JSON.parse(this.mod.check_blueprint(JSON.stringify(bp)));
    return new MockCore().checkBlueprint(bp);
  }
  newBattle(setup: BattleSetup): void {
    this.b?.free?.();
    const json = JSON.stringify(setup);
    this.b = this.mod.new_battle ? this.mod.new_battle(json) : new this.mod.Battle!(json);
  }
  command(c: Command): CommandResult {
    if (!this.b) return { ok: false, error: 'no battle' };
    return JSON.parse(this.b.command(JSON.stringify(c)));
  }
  step(ticks: number): void { this.b?.step(ticks); }
  snapshot(): Snapshot { return JSON.parse(this.b!.snapshot()); }
  saveBattle(): string { return this.b!.save(); }
  loadBattle(data: string): void {
    this.b?.free?.();
    this.b = this.mod.load_battle ? this.mod.load_battle(data) : this.mod.Battle!.load!(data);
  }
}
