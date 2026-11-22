import { MockCore } from './mock';
import { RealCore } from './real';
import type { WasmModule } from './protocol';
import type { CoreApi } from './types';

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
    await mod.default();
    return new RealCore(mod);
  } catch (e) {
    if (want === 'wasm') throw e;
    console.info('[castle] using the mock core:', (e as Error).message);
    return new MockCore();
  }
}

