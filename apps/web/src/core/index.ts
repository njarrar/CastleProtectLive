import { RealCore } from './real';
import type { WasmModule } from './protocol';
import type { CoreApi } from './types';

export * from './types';

/** The real core could not be loaded. A production build shows a Retry screen; it never plays a stand-in. */
export class CoreLoadError extends Error {
  constructor(cause: unknown) {
    super(`Could not load the game rules: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'CoreLoadError';
  }
}

/**
 * Loads the real core (castle-wasm, built by scripts/build-wasm.sh and copied to
 * `<base>/core/` by vite.config.ts). It is a plain GET import, so the service worker's
 * precache answers it offline. There is no fallback in a production build.
 * Dev only: `?core=mock` loads the TypeScript stand-in by dynamic import.
 */
export async function loadCore(): Promise<CoreApi> {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('core') === 'mock') {
    const { MockCore } = await import('./mock');
    return new MockCore();
  }
  try {
    const url = `${import.meta.env.BASE_URL}core/castle_wasm.js`;
    const mod = (await import(/* @vite-ignore */ url)) as WasmModule;
    await mod.default();
    return new RealCore(mod);
  } catch (e) {
    throw new CoreLoadError(e);
  }
}
