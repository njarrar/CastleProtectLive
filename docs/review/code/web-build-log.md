# Web build log (GitHub Actions, njarrar/CastleProtectLive)

Workflow: `.github/workflows/web.yml`, branch `main`.

## Status on 2026-11-22

- Green run: https://github.com/njarrar/CastleProtectLive/actions/runs/45042435505 (commit cbab45f). The build job passes all 19 Playwright tests against the production build with `VITE_BASE=/CastleProtectLive/`.
- Pages URL: https://njarrar.github.io/CastleProtectLive/ (not live yet, returns 404, see below).

## Blocked on the repo owner: GitHub Pages is not enabled

The deploy job runs, but `actions/deploy-pages` gets `Failed to create deployment (status: 404) ... Ensure GitHub Pages has been enabled`. The job stays green on purpose (`continue-on-error` plus a "Pages deploy failed" warning annotation). This is a repo setting, not a build bug.

Fix: in the repo, Settings, Pages, Build and deployment, Source: **GitHub Actions**. Then re-run the latest web run (or push any web change). The web-dist artifact on each run is the fallback until then.

Live boot check (Playwright load of the Pages URL, screenshot to `web-shots/live.png`) is still to do once Pages is on.

## Failures found and fixed

1. **Playwright could not install Chromium** (runs 9 to 13, for example 45040088609). `ubuntu-latest` moved to Ubuntu 26.04 and Playwright 1.52 says `does not support chromium on ubuntu26.04-x64`. The visible log tail only showed the artifact upload step after it. Fix: build job pinned to `runs-on: ubuntu-24.04`.
2. **Core failed to load in the browser** (run 45041509352, 14 of 19 tests failed). The page showed "Could not load the game"; the trace console had `CoreLoadError: ... WebAssembly.Table.grow(): failed to grow table by 4`. Cause: the workflow installed wasm-opt from apt, which on ubuntu-24.04 is binaryen 108, and that wasm-opt breaks the externref table wasm-bindgen emits for the Rust 1.97 build. Locally there was no wasm-opt at all, so local runs never hit it. Reproduced locally: binaryen 108 fails the smoke tests, binaryen 123 passes 19 of 19. Fix: the workflow installs `binaryen@123.0.0` from npm (setup-node moved before the wasm step), and `scripts/build-wasm.sh` now skips any wasm-opt older than 123 with a message instead of shipping a broken core.

## Live

Pages is on. https://njarrar.github.io/CastleProtectLive/ returns 200, boots the real wasm core with no page errors, and reaches level 1-1 at iPhone size (see web-shots/live.png).
