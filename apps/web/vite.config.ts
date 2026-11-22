import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain .mjs build script, no types
import { buildArt } from './scripts/build-art.mjs';

const here = import.meta.dirname;

// The core is built to WebAssembly by scripts/build-wasm.sh (cargo + wasm-bindgen, target web).
// We look for its pkg folder and copy it to public/core so the app can load it at
// runtime from `core/castle_wasm.js`. There is no stand-in core in a production build, so
// `vite build` fails when no pkg is found (set CASTLE_ALLOW_NO_CORE=1 to build anyway).
const wasmCandidates = [
  process.env.CASTLE_WASM_PKG,
  resolve(here, '../../core/castle-wasm/pkg'),
  resolve(here, '../../core/pkg'),
  resolve(here, '../../pkg'),
].filter((p): p is string => !!p);

// Sprites and the manifest from assets/ are copied to public/art the same way.
const artCandidates = [process.env.CASTLE_ASSETS, resolve(here, '../../assets')].filter(
  (p): p is string => !!p,
);

function copyFirst(cands: string[], dest: string, label: string, keep: (rel: string) => boolean = () => true): boolean {
  const src = cands.find((p) => existsSync(p));
  rmSync(dest, { recursive: true, force: true });
  if (!src) {
    console.log(`[castle] no ${label} found, skipping`);
    return false;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
      if (p.endsWith('.gitignore') || p.includes('node_modules')) return false;
      const rel = p.slice(src.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
      return rel === '' || keep(rel);
    },
  });
  console.log(`[castle] copied ${label} from ${src}`);
  return true;
}

function castleCopy(): Plugin {
  let done = false;
  const run = async (command: string) => {
    if (done) return;
    done = true;
    // Only the js glue and the wasm: no .d.ts files in the shipped build.
    const haveCore = copyFirst(wasmCandidates, resolve(here, 'public/core'), 'wasm core pkg', (rel) => !rel.endsWith('.d.ts') && rel !== 'package.json');
    if (!haveCore && command === 'build' && !process.env.CASTLE_ALLOW_NO_CORE) {
      throw new Error('[castle] no wasm core pkg found. Run scripts/build-wasm.sh first (or set CASTLE_ALLOW_NO_CORE=1).');
    }
    // Only what the web build draws, with the atlas pages as WebP (scripts/build-art.mjs).
    await buildArt(artCandidates.find((p) => existsSync(p)), resolve(here, 'public/art'));
  };
  return { name: 'castle-copy', config: (_c, env) => run(env.command) };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    castleCopy(),
    VitePWA({
      // 'prompt': a new version waits; the app offers "Update" on the title or map, never mid fight.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Castle Protect',
        short_name: 'Castle Protect',
        description: 'Build a fort, aim a shot, pop the kettle.',
        theme_color: '#FFC23D',
        background_color: '#9ED8EC',
        display: 'fullscreen',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'art/sprites/app_icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'art/sprites/app_icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-mask.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // First load and offline play need the @1x art only. The @2x pages (high-DPI screens,
        // loaded after the game starts) are cached the first time they are fetched.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,wasm,woff2,ogg,opus,mp3,m4a}'],
        // Sound (5 MB in two formats) is cached as it is first played, one format per device.
        globIgnores: ['**/art/atlas/castle@2x-*.{webp,png}', '**/art/sprites/bg_*@2x.*', '**/art/audio/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/art\/(atlas\/castle@2x-|sprites\/bg_\w+@2x)/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'castle-art-2x', expiration: { maxEntries: 16 } },
        }, {
          urlPattern: ({ url }) => /\/art\/audio\//.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'castle-audio', expiration: { maxEntries: 200 } },
        }],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
  // content/app.json is imported from outside the app folder.
  server: { port: 5173, fs: { allow: [resolve(here, '../..')] } },
  preview: { port: 4173 },
});
