# webkit-long crash on CI (commit 271621f)

Work in `apps/web` only. `.github/workflows/web.yml` and the test are not changed. Nothing is committed.

## What failed

CI run 29 (`web`, job `webkit-long`): `tests/webkit-long.spec.ts:30`, "the page crashed" at line 74, 56.8 s.

The CI trace shows when. The last poll that came back was at 30.5 s (round 6, the Rival aims). The next `page.evaluate` never returned. The page sent no new frame. Then the web process died at about 58 s. So the page did not run out of time or memory: WebKit's web process stopped and then aborted.

## It does happen here

Same setup as CI: `scripts/build-wasm.sh --target web`, `VITE_BASE=/CastleProtectLive/ npm run build`, `CI=1 npx playwright test --project=webkit-long --retries=0`, Playwright WebKit 18.4 build v2158 (the same build CI downloads).

| Build | Runs | Crashes |
|---|---|---|
| 271621f, one at a time | 8 | 2 |
| 271621f, three at a time | 12 | 1 |
| 271621f, extra GC pressure | 6 | 1 |
| ff3f679 (worktree, own core and build) | 15 | 0 |
| 271621f with the fix | 15 + 5 | 0 |

## Where it dies

The kernel log has one line per crash: `trap invalid opcode ... in libWPEWebKit-2.0.so.1.6.0[5664b29 ...]`. Every crash in this session, and the one the text pass saw before (`56643d9`), is at one of two places next to each other.

With gdb on the web process (`handle SIGILL stop`) the stack is, from the top:

1. `GrResourceCache::notifyARefCntReachedZero`: a GPU resource with a bad slot number in the cache's list (a bounds check, so a RELEASE assert, not a bad pointer).
2. Skia's resource allocator and path renderers, inside `GrDrawingManager::flush`.
3. `ImageBufferSkiaAcceleratedBackend` and `CoordinatedPlatformLayerBufferNativeImage`: the field canvas handing its frame to the compositor.
4. `RenderingUpdate`, `LayerFlushTimerFired`, the main run loop.

Two of the crashes were on a `SkiaGPUWorker` thread at the same address. So the main thread and the Skia GPU workers both touch the same GPU resource cache, and it gets out of step. (The names come from the strings Skia and WebKit keep next to each frame; the library has no symbols.)

## Root cause

A bug in WebKit's Skia GPU canvas on Linux (WPE and WebKitGTK). An accelerated 2D canvas keeps its textures in Skia's GPU resource cache. Under load, that cache is changed from two threads, and WebKit aborts.

The game does nothing wrong, but the new build hits the bug far more. Per fight, in WebKit (same 1-8 play, about 45 s, measured by wrapping the canvas calls):

| | ff3f679 | 271621f |
|---|---|---|
| frames drawn | 712 | 536 |
| `save()` | 6,036 | 16,152 |
| gradients made | 0 | 638 |
| offscreen canvases made / resized | 11 / 46 | 19 / 70 |

The frame is heavier (Rival overlays, trimmed frames, lights and glows), so each flush runs longer and the window for the race is wider. Drawing the atlas from plain images in place of ImageBitmaps made it worse (5 crashes in 15), so the more GPU work the canvas does, the more it crashes.

It is not memory. The web process stays at 0.9 to 1.1 GB, flat after the first seconds, and canvas memory is about 27 MB. The atlas pages are 2048 x 2048, and there is one @2x page now, not four. Sound decode, the service worker and the WebP pages are not on the stack.

This is not the iPhone crash the test was written for (B2, the service worker answering sound files). Safari on iPhone, iPad and Mac draws a canvas with Core Graphics, not Skia, so it cannot hit this code.

## Fix

New `src/render/ctx2d.ts`. On WebKit on Linux only (WebKit user agent, not Chrome, `navigator.platform` says Linux, not Android) every game canvas asks for the CPU backend (`willReadFrequently: true`). Then no canvas work goes through Skia's GPU cache. On that WebKit the sprite pages stay decoded `<img>` (an ImageBitmap there is a GPU texture, slow to draw on a CPU canvas).

Used by the field canvas (`battle.ts`), the lens and scaled copies (`draw.ts`), the terrain layer (`terrain.ts`), the sprite chip canvases (`sprites.ts`) and the results clips (`motion.ts`).

Safari, Chrome and Firefox keep their default canvas. Playwright's iPhone emulation keeps the iPhone user agent but reports `Linux x86_64` as the platform, so CI takes the CPU path. That matches what this test can check on Linux: the fight runs past round 12, no crash, canvas memory under the iOS limits, no sound in the worker cache.

Cost in CI's WebKit: about 9.5 frames a second in place of 12 (llvmpipe, no GPU). The test does not depend on frame rate, and the adaptive resolution steps down once.

## Checks

| Check | Result |
|---|---|
| `scripts/build-wasm.sh --target web` | ok |
| `npm run build` (default base, includes `tsc --noEmit`) | ok |
| `npx playwright test --trace off`, all four projects, real core | 126 passed, 6 skipped, 0 failed |
| First-load budget (qa1 m12) | passes, under 2 MB, unchanged |
| `VITE_BASE=/CastleProtectLive/ npm run build` | ok |
| `webkit-long` the CI way, 5 in a row | 5 passed (58 to 59 s each); web process peak 0.93 GB, was 0.95 to 1.13 GB |
| `webkit-long` with the fix, three at a time | 15 passed, 0 crashed |

## How sure

The crash site, the threads and the before and after counts agree. Before: 4 crashes in 26 runs. After: 0 in 20. If the fix did nothing, 20 clean runs in a row would come about 1 time in 30. CI's runner is slower than this one and crashed on its first try, so its rate was likely higher, which the fix removes along with the GPU path itself. The test is not changed, skipped or retried.

## Left open

- The WebKit bug itself. A small page that draws a busy accelerated canvas in WPE for a minute would show it to the WebKit team.
- `apps/web/src/render/sprites.ts` still skips `ImageBitmap.close()` on all WebKit. On Safari that is now the only reason; it could be looked at again on a real iPhone.
- The local core build is 1.16 MB after `wasm-opt` (CI warns above 1 MB). It was the same before this change.
