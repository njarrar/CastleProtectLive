import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname;

// The core is built to WebAssembly by scripts/build-wasm.sh (wasm-pack, target web).
// We look for its pkg folder and copy it to public/core so the app can load it at
// runtime from `core/castle_wasm.js`. With no pkg the app falls back to the mock core.
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

function copyFirst(cands: string[], dest: string, label: string, keep: (rel: string) => boolean = () => true): void {
  const src = cands.find((p) => existsSync(p));
  rmSync(dest, { recursive: true, force: true });
  if (!src) {
    console.log(`[castle] no ${label} found, skipping`);
    return;
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
}

function castleCopy(): Plugin {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    copyFirst(wasmCandidates, resolve(here, 'public/core'), 'wasm core pkg');
    // Only what the web build draws: the manifest, the @2x atlas pages, and the
    // separate textures (backgrounds, terrain tiles, app icons). Keeps the offline cache small.
    copyFirst(artCandidates, resolve(here, 'public/art'), 'art assets', (rel) =>
      rel === 'manifest.json' || rel === 'atlas' || rel === 'sprites' ||
      /^atlas\/castle@2x/.test(rel) ||
      /^sprites\/(bg_\w+@2x|terrain_\w+|app_icon-\d+)\.png$/.test(rel));
  };
  return { name: 'castle-copy', config: run };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    castleCopy(),
    VitePWA({
      registerType: 'autoUpdate',
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
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,wasm,woff2,ogg,mp3}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: true },
  server: { port: 5173 },
  preview: { port: 4173 },
});
