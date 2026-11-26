import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
// @ts-expect-error plain .mjs build script, no types
import { buildArt } from './scripts/build-art.mjs';

const here = import.meta.dirname;

// The app's name and its one-line pitch come from the one string table, like every other line.
const TEXT = JSON.parse(readFileSync(resolve(here, '../../content/text.json'), 'utf8')) as { app: { title: string; tagline: string; promise: string } };
const DESCRIPTION = `${TEXT.app.tagline} ${TEXT.app.promise}`;
const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** index.html carries the table's title and description, not its own copy. */
function castleHtml(): Plugin {
  return {
    name: 'castle-html',
    transformIndexHtml: (html) => html
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(TEXT.app.title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(DESCRIPTION)}$2`)
      .replace(/(<div class="boot">)[^<]*(<\/div>)/, `$1${esc(TEXT.app.title)}$2`),
  };
}

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

/**
 * The core goes to public/core/<hash>/ (the first 10 hex digits of the wasm and glue bytes), so
 * its URL changes only when the core does. The service worker then precaches it without a
 * cache-busting revision and its install reuses the copy the page just fetched (no second
 * 1 MB download on the first visit). The app reads the folder from __CASTLE_CORE_DIR__.
 */
function hashCore(dir: string): string {
  if (!existsSync(dir)) return '';
  const files = readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
  if (!files.length) return '';
  const h = createHash('sha256');
  for (const f of files) h.update(f).update(readFileSync(resolve(dir, f)));
  const key = h.digest('hex').slice(0, 10);
  mkdirSync(resolve(dir, key));
  for (const f of files) renameSync(resolve(dir, f), resolve(dir, key, f));
  return `core/${key}/`;
}

function castleCopy(): Plugin {
  let coreDir = 'core/';
  let done = false;
  const run = async (command: string) => {
    if (done) return;
    done = true;
    // Only the js glue and the wasm: no .d.ts files in the shipped build.
    const haveCore = copyFirst(wasmCandidates, resolve(here, 'public/core'), 'wasm core pkg', (rel) => !rel.endsWith('.d.ts') && rel !== 'package.json');
    if (!haveCore && command === 'build' && !process.env.CASTLE_ALLOW_NO_CORE) {
      throw new Error('[castle] no wasm core pkg found. Run scripts/build-wasm.sh first (or set CASTLE_ALLOW_NO_CORE=1).');
    }
    if (haveCore) coreDir = hashCore(resolve(here, 'public/core')) || coreDir;
    // Only what the web build draws, with the atlas pages as WebP (scripts/build-art.mjs).
    await buildArt(artCandidates.find((p) => existsSync(p)), resolve(here, 'public/art'));
  };
  // `vite preview` serves dist as built: it must not wipe and rebuild public/core and public/art.
  return {
    name: 'castle-copy',
    config: async (_c, env) => {
      if (env.isPreview) return undefined;
      await run(env.command);
      return { define: { __CASTLE_CORE_DIR__: JSON.stringify(coreDir) } };
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    castleCopy(),
    castleHtml(),
    VitePWA({
      // 'prompt': a new version waits; the app offers "Update" on the title or map, never mid fight.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      // The install icons (145 KB of PNG) are fetched by the browser when it installs the app;
      // they are not part of the first load or of offline play.
      includeManifestIcons: false,
      manifest: {
        name: TEXT.app.title,
        short_name: TEXT.app.title,
        description: DESCRIPTION,
        theme_color: '#FFC23D',
        background_color: '#9ED8EC',
        // iOS has no fullscreen display mode; standalone works on both.
        display: 'standalone',
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
        // The JSON that names those files (page JSON, bg.json, audio.json, barks.json) IS
        // precached with a revision, and the files have a content hash in their names
        // (scripts/build-art.mjs), so CacheFirst never serves a stale image or sound.
        // The app icons are fetched by the browser when it installs the app, not by the game.
        globIgnores: ['**/art/atlas/castle@2x-*.{webp,png}', '**/art/sprites/bg_*@2x.*', '**/art/audio/**/*.{ogg,opus,mp3,m4a,aac,webm,wav}', '**/art/sprites/app_icon-*.png'],
        // Files whose URL carries a content hash (Vite assets, art with .<hash10>., the core
        // folder) are precached with no revision: the install fetch is a plain GET that the
        // browser answers from the copy the page has just loaded, so the first visit downloads
        // the 1 MB core and the 0.8 MB atlas once, not twice, and an update installs at once.
        dontCacheBustURLsMatching: /(^assets\/)|(\.[0-9a-f]{10}\.[a-z0-9]+$)|(^core\/[0-9a-f]{10}\/)/,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Take control on the first visit (no old worker to wait for), so the sounds and @2x art
        // of the first session are cached. An update still waits for the Update tap (prompt mode).
        clientsClaim: true,
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/art\/(atlas\/castle@2x-|sprites\/bg_\w+@2x)/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'castle-art-2x', expiration: { maxEntries: 16, purgeOnQuotaError: true } },
        }, {
          // Skip SW audio caching only on Linux WebKitGTK (Playwright webkit-long Skia crash, QA playtest 2 B2).
          // Real Safari on iOS, iPadOS, and macOS caches audio cleanly offline for full Rule 6 parity.
          urlPattern: ({ url }) => /\/art\/audio\/.+\.(ogg|opus|mp3|m4a|aac|webm|wav)$/.test(url.pathname)
            && !(
              /AppleWebKit/.test(self.navigator.userAgent)
              && !/Chrome|Chromium|Edg\//.test(self.navigator.userAgent)
              && (/Linux/i.test(self.navigator.platform ?? '') || /Linux/i.test(self.navigator.userAgent))
              && !/Android/i.test(self.navigator.userAgent)
            ),
          handler: 'CacheFirst',
          options: { cacheName: 'castle-audio', expiration: { maxEntries: 200, purgeOnQuotaError: true } },
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
