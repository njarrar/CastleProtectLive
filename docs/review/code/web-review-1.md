# Web code review 1: apps/web

Scope: `apps/web/` only (TypeScript, Vite, Canvas2D, PWA, wasm core), plus `.github/workflows/web.yml`. Commit `98ebee8`. No app code was changed.

Checked against `core/API.md`, `docs/BUILD-WEEK-1.md`, `docs/review/07-external-review-decisions.md` and `docs/design/07-ux-ui-audio.md`.

## How it was checked

- Read every file in `apps/web/src`, the tests, the Vite and Playwright config, and `web.yml`.
- Built the wasm core (`scripts/build-wasm.sh --target web`), then `npm ci && npm run build && npx playwright test`: build clean, 4 of 4 tests pass with the default base.
- Drove the real wasm core from Node to read real snapshots, replies and timings.
- Drove the production build in headless Chromium (Playwright): touch drags, multi-touch, rotation, offline reload, bad saves, bad links, Couch Duel hand-off, resume.
- Items marked **Seen** were reproduced. Items marked **Read** come from the code only.

Screenshots in `docs/review/code/web-shots/`:

- `portrait-390x844-battle-1-1.png` (stacked lenses, first turn)
- `portrait-390x844-aiming.png`, `portrait-390x844-flight.png`
- `landscape-844x390-battle-1-1.png`
- `landscape-844x390-duel-handoff.png`

## Counts

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 7 |
| Medium | 14 |
| Low | 11 |

---

## Critical

### C1. Offline, the app drops the real core and plays the mock rules engine
`src/core/index.ts:19-28`. **Seen.**

`loadCore()` first sends a `HEAD` request for `core/castle_wasm.js`. The service worker precache only answers `GET`. Offline, `HEAD` fails, the `catch` runs, and the app returns `MockCore` with only a `console.info`.

Test: load once online, go offline, reload. Result: `data-core="mock"`. In the same offline page, `fetch(..., {method:'GET'})` for the same file returns 200 and `HEAD` fails.

Failure: a player installs the PWA and plays on a train. They get the stand-in TypeScript rules (other damage, other wind, other shells, no real AI). Their real save is not offered (`coreName` differs, `home.ts:32`), and wins made in the mock still write Pennants and Buttons to the same progress record.

Fix: drop the `HEAD` probe. Just `await import(url)` and `await mod.default()`. In a production build, never fall back: show a "Could not load the game, try again" screen with a Retry button. Keep the mock for `?core=mock` and dev only.

### C2. The CI smoke test cannot pass, so the web build never goes green or deploys
`.github/workflows/web.yml:105` and `:108-122`, `playwright.config.ts:5`. **Seen.**

`VITE_BASE` is set only on the Build step. The Playwright step runs without it, so `vite preview` and the test `baseURL` use `/` while `dist/index.html` points at `/CastleProtect/assets/...`. The script 404s and the app never boots.

Test: `VITE_BASE=/CastleProtect/ npm run build`, then `CI=1 npx playwright test --project=chromium` with no `VITE_BASE`: both smoke tests fail waiting for `html[data-ready=true]`. With `VITE_BASE` set for the test run, both pass.

Failure: every push fails the `build` job. The Pages artifact step and the `deploy` job never run. Week 1 says a change is done only when its Actions run is green.

Fix: move `VITE_BASE` to job level `env:` (or repeat it on the Playwright step).

---

## High

### H1. A saved Workshop fort with too few Nooks makes levels and duels fail to start, with no message
`src/app.ts:136`, `src/core/real.ts:120-131`, `src/screens/prebattle.ts:20-25`, `src/screens/setup.ts:96-110`. **Seen.**

The Workshop checks a fort only against its own Nook count (`real.ts:108`). The default Workshop fort has 3 Nooks. Campaign setup sends that fort for every level. Levels 1-7 to 1-10 seat 4 Hobs, so the core throws `3 Nooks for 4 Hobs`. Nothing catches it.

Test: save the default 3 Nook fort, open 1-7, press FIGHT. The screen stays on pre-battle, the page logs an uncaught error, nothing is shown. Same in Couch Duel with "Mine" and 5 crew: `3 Nooks for 5 Hobs`, FIGHT does nothing.

Also in `start()` (`real.ts:128-131`) the old game is freed before the new one is built. If the constructor throws, `this.game` points at freed memory and the next call throws `null pointer passed to rust`.

Fix: catch errors from `newBattle` and show the core's reason on the sheet. Before FIGHT, check the fort for the level's crew size (`validate_blueprint` with `seats` = crew size) and fall back to the level's own Blueprint. Build the new `Game` first, then free the old one.

### H2. No Shove Off, Pass, Doodad, Puff Up or Mendglob target in the UI; a buried Hob can lock the turn
`src/core/real.ts:148-176`, `src/battle/battle.ts:747-753`, `:511-515`. **Read** (protocol side seen in Node).

The view command set has no `shove_off`, `pass`, `doodad`, and `fire` never sends `dial` or `target`. When the picked Hob is buried the Fire state is `dug`, but a tap still sends plain `fire`, which the core refuses (`hob_cannot_fire`). There is no other way to end the turn.

Failure: on a one Hob level, or when every able Hob is dug in, the player has no legal action on screen. The battle is stuck until Retry. Doodads, Puff Up and Rebuild cannot be used at all, though the pre-battle sheet says "Mend Bucket, Pot Lid" on 1-10 (`prebattle.ts:147`); the core reports `hud.doodads` empty there because the setup never sends any.

Fix: when the state is `dug`, Fire sends `shove_off` for the picked Hob (label and Steam cost from the core reply). Add a Pass entry (Pause sheet is fine for v0.1). Add the Doodads chip or remove the Doodads line until it exists.

### H3. Resume replays the log with no version, hash or error check
`src/core/real.ts:389-412`, `src/screens/home.ts:31-38`, `src/battle/battle.ts:31`. **Seen** for the corrupt case, **Read** for the rest.

- The save has `v: 1` and `core`, but `loadBattle` reads neither. It does not store or compare the rules version (`cp_version().rules`) or the state hash.
- Replies from replayed commands are ignored (`real.ts:403`). If a new build changes rules or content, some commands are refused or land elsewhere, and the player resumes a different battle with no warning.
- A broken save throws inside `app.go`. Test: a save with cut-off JSON, press Resume: uncaught `SyntaxError`, the "Carry on?" sheet stays, Resume does nothing forever. Only "Leave it" works.
- `home.ts:32` hides, but keeps, a save from another core name for good.

Fix: store `rules`, `sim` and the `hash` at save time. On load, check `v` and `rules` first; after replay compare the hash. On any mismatch or throw, delete the save and tell the player ("This saved fight is from an older version"). Wrap `loadBattle` in try/catch in `battleScreen` and route back to the map.

### H4. A bad or old progress record bricks the app at boot
`src/save/db.ts:103-108`, `src/main.ts:15-49`, `src/screens/home.ts:54-59`. **Seen.**

`loadProgress` and `loadSettings` do a shallow merge with no shape check and no schema version. `boot()` has no catch.

Test: progress stored as `{levels: null, hints: 'x'}`, reload. Result: `TypeError: Cannot read properties of null`, the page stays on the "Castle Protect" boot text, `data-ready` is never set. Settings cannot be reached, so Reset is out of reach too.

Failure: any later change to the progress shape (or one partial write) locks every returning player out until they clear site data by hand.

Fix: add `version` to each record and a small migrate step. Validate each field on load and fall back to the default per field. Wrap `boot()` so a failure shows a screen with "Reset save" and "Reload".

### H5. A full rules engine in TypeScript ships in the production bundle
`src/core/mock.ts` (854 lines), `src/core/content.ts`, `src/core/index.ts:1,15,27`. **Read.**

The mock holds shell flight, wind, blast damage, block HP, collapse, Squall and a Rival. It has its own Hob stats and shell table. Review 07 point 1 says stand-in cores shrink to thin fixture players, and Week 1 says apps never compute rules. It is linked into the main bundle and is one failed fetch away from the player (see C1).

Fix: delete it or cut it to a fixture player, and load it by dynamic import only under `import.meta.env.DEV` or `?core=mock`.

### H6. Snapshot fields the level goals depend on are never drawn
`src/core/real.ts:290-387`, `src/render/draw.ts`. **Seen** in Node, **Read** in the view.

- `props[]` is never read. Level 1-7 (Rescue) sends 3 `cage_bar` props and the captive. The web draws none of them, so the level's goal cannot be seen.
- `blocks[].root` is dropped. 1-10 has one root block (the boss weak spot); it looks like any other block.
- Also unused: `castles[].rooms` (Nook `intact`, `flap`, `lid`, `loophole`), `kettle.lid`, `held`, `fatigue`, `blocks[].battered`, `peephole`, Hob `buried` marker on the field, `cover`, `grudge`, `clatter`, `hud.front_rounds_left`, `hud.score`, `hud.doodads`, `hud.puff_up`, `result.round`, `last_ai`.
- `protocol.ts:74` has no `battered` on `PBlock` and `:76-82` has no `fatigue` on `PCastle`.
- Queries `lean_lines`, `shimmer` and `hash` are typed but never sent. Lean Lines (design 3.11) is not there.

Fix: map props, root, flap, lid and battered into the view model and draw them, at least as plain shapes. Add the missing protocol fields. Add a test that walks the keys of `core/fixtures/snapshot_*.json` and fails on a key the adapter does not know.

### H7. An app update reloads the page in the middle of a fight
`vite.config.ts:62` (`registerType: 'autoUpdate'`), `src/main.ts:46`. **Read** (the built `sw.js` has `skipWaiting`, the bundle has `location.reload`).

With `autoUpdate` the new service worker takes over at once and the page reloads itself. The aim and the turn in progress are lost, and the player lands on the title screen. The save is then replayed on the new core (see H3).

Fix: use `registerType: 'prompt'`. Apply the update only on the title or map screen, or show an "Update ready" chip there. Never reload while the battle screen is up.

---

## Medium

### M1. Each drag move is a logged command plus a full snapshot
`src/battle/battle.ts:635-643`, `src/core/real.ts:141-146`; core `battle.rs` `is_logged` includes `aim`. **Seen** in Node.

Every `pointermove` in an Aim Drag sends `aim`. Each one runs `JSON.stringify`, the core preview, a full 13.5 KB snapshot, `JSON.parse`, and adds a line to the replay log. Node timing: 300 `aim` + snapshot + parse took 755 ms (2.5 ms each on a desktop). The log gains one entry per move; the whole log is rewritten to IndexedDB every turn.

Failure: on a slow phone with a 120 Hz touch screen, aim calls eat the frame budget and the drag stutters. A long duel saves and replays many thousands of aim lines.

Fix: keep the newest aim from the drag and send it once per animation frame. Ask the core owner to log only the last `aim` before an Action.

### M2. The 2x button cancels itself
`src/battle/battle.ts:749` and `:756`. **Seen.**

A capture `pointerdown` on the root sets `fast = true` in Resolve. The click on the 2x button then runs `fast = !fast`, which turns it off again. After one click the label still reads `2x`.

Fix: skip the root handler when the target is the Fire button, or make the button set a value in place of a toggle.

### M3. Shot Weight never shows: content uses `L`, `M`, `H`
`src/core/real.ts:33`, `:423-426`. **Seen** in content (15 `L`, 13 `M`, 2 `H`).

`WEIGHT` knows `light`, `medium`, `heavy`. `"M"` and `"H"` fall to 0. Every Knack and Trick Shell shows as Light, no cogs are drawn, and the Shell card says "Weight: Light". Players get a Rest they were not told about.

Fix: map `l/m/h` as well, or read the weight the core sends in `hud.hands`. Add a unit test over `content/shots.json`.

### M4. Game rules and numbers in TypeScript
**Read.** Each one should come from the core or from content:

| Where | What |
|---|---|
| `real.ts:358` | Buttons reward: 250 for a win, 40 for a loss |
| `real.ts:379` | Walk allowed only from level 1-9 in the campaign |
| `real.ts:376` | `steamMax: 100`. **Seen:** side two starts at 120, the bar is set to `120%` wide |
| `real.ts:454-455` | Help handicap: Steam 120 and 140 |
| `real.ts:466-469` | Wind presets 0 to 3 and 0 to 6, Rummage pool 6, picks 2 |
| `real.ts:114` | Workshop budget 72 and cost sum |
| `real.ts:31`, `app.ts:119-122` | Which Hob joins after which level |
| `real.ts:327-328`, `:334` | "Needs a rest" and Fire ready rules rebuilt from `rest` and `power > 0` |
| `real.ts:192` | The app sends `pass` for the Test Yard dummy |
| `real.ts:179`, `:195` | Walk speed: 4 cells every 4 ticks |
| `real.ts:253`, `:360` | Hit counting and the loss cause line |
| `prebattle.ts:128` | Text "Draft: pool 4, pick 2" (the app sends 6 and 2) |
| `prebattle.ts:147` | Doodads unlocked at level 10 |

### M5. Wrong or missing results text
`src/screens/results.ts:25`, `src/core/real.ts:34`. **Read.**

Any win that is not a Kettle Pop is titled "Clean Sweep!", so a Rescue, a round cap win, a `total_hp` win and a Squall win all say Clean Sweep. `double_pop` is shown as "Sudden Squall". A campaign loss always says "Flattened".

Fix: one title per `how` value from the API list.

### M6. A win can be lost in the 1.5 s before the results screen
`src/battle/battle.ts:406-414`, `src/screens/results.ts:17-24`. **Read.**

`onEnd` deletes the battle save at once. Progress is written only when the results screen is built 1.5 s later. Close the tab, lock the phone or hit an auto update in that gap and the win is gone and the save is gone.

Fix: write progress in `onEnd`, then clear the save, then show results.

### M7. IndexedDB writes can hang or throw
`src/save/db.ts:55-101`. **Read.**

- `put` and `del` listen for `oncomplete` and `onerror` but not `onabort`. A quota abort never settles the promise. Pause, Map (`battle.ts:839`) waits on that promise, so the button does nothing.
- `db.transaction()` throws if the connection was closed (iOS Safari drops it in the background). `get` then rejects; at boot that is the brick in H4.
- No `onversionchange` or `onclose` handler, no retry, and no `navigator.storage.persist()`, so Safari may wipe the save after a week unused.

Fix: settle on `onabort`, wrap `transaction()` in try/catch, reopen once on failure, fall back to the memory map, and ask for persistent storage after the first win.

### M8. A wasm trap or any throw in the frame loop freezes the game with no message
`src/battle/battle.ts:269-293`, `src/main.ts:49`. **Read.**

`frame` books the next frame first, then works. If `core.step` or a draw throws, it throws again every frame for good. There is no error screen anywhere in the app.

Fix: try/catch in `frame`; on error stop the loop and show a card with Retry and Map. Add `window.onerror` and `unhandledrejection` handlers that do the same.

### M9. Layout is read and written every frame
`src/battle/battle.ts:135-141`, `:210`, `:240`, `:311-312`, `:445-515`. **Seen.**

In portrait the loop calls `getBoundingClientRect` 8 times a frame, and `updateHud` sets `textContent`, `style.width`, classes and data attributes every frame even when nothing changed. Each write dirties layout, so each read forces a reflow. The view model is also rebuilt in full every frame (`real.ts:290-387`: block list, pins with paths, chips).

In headless Chromium (software drawing, 4x CPU slow down) the idle Plan frame took 83 ms median; the profile was 51% `drawImage`, 19% `stroke`. Real phones will do better, but the split is the same.

Fix: cache the lens rects in `relayout`; write a DOM value only when it changed; rebuild the view only when the core sent a full snapshot. See M10 for the draw side.

### M10. Canvas work that can be cut
`src/render/draw.ts:68-69`, `:112-115`, `:134-147`, `:128`. **Read**, with the profile above.

- The 2400 x 720 terrain canvas is drawn whole for each lens, each frame. Draw only the source rect the lens shows.
- The sky (2048 x 1024) is scaled to each lens rect, so it is stretched; the sun shows in both lenses and is an oval in the lower one (see the portrait screenshot).
- On 1-1 the preview has 104 points. Each dot is its own path with a fill and a stroke, in both lenses. Batch them into one path.
- Own blocks are drawn with `globalAlpha` one by one in Plan. Cache the fort to an offscreen canvas until a block changes.
- `src/render/sprites.ts:85-93` waits for `onload` but not `decode()`, so the first frame pays the decode of two 2048 x 2048 atlas pages.

### M11. Turning the device during an Aim Drag throws the aim away
`src/battle/battle.ts:103`, `:652-661`. **Read.**

`relayout` calls `endDrag(true)`, which puts the old aim back. Design 2.6 says the drag ends as if the finger lifted and the aim so far is kept.

Fix: in `relayout`, end the drag without the restore (and without Quick Fire).

### M12. Links and the Back button
`src/main.ts:31-41`, `src/screens/prebattle.ts:10`. **Seen** for the first item.

- `#level=9-9` at load throws in `prebattleScreen` and the app stays on the boot text.
- `#level=1-10` opens any level, locked or not.
- Any hash change during a fight calls `app.go` and drops the battle with no save.
- The app never writes history, so the Android Back button leaves the app in mid fight.

Fix: check the level id and `levelOpen`; fall back to the map. Push a history entry per screen and map Back to Pause in battle.

### M13. Test Yard wind and duel Give up do nothing on the real core
`src/core/real.ts:171-172`, `src/battle/battle.ts:92-95`, `:828`. **Seen** (`unknown_command` from the core).

The wind slider moves and its label changes, but the wind stays. Give up closes the Pause sheet and the fight goes on.

Fix: hide both on the real core, or agree the commands with the core owner and add them to `core/API.md`.

### M14. Dialogs and live text for assistive tech
`src/battle/battle.ts:50`, `:462`, `:814-819`, `:846-873`; `src/screens/workshop.ts:23`, `:96-114`; `index.html:5`. **Seen** for the focus item.

- No focus trap: with the hand-off card open, two Tab presses put focus on Pause behind it. Focus is not put back when a card closes. Cards have no `aria-labelledby`.
- `roundEl` is `aria-live` and its text is set again every frame; some readers will repeat it without end.
- The Workshop grid is pointer only: cells cannot take focus, and `role="grid"` has no rows.
- The canvas has a label but no text for what happens (hit, miss, whose turn). The banner covers turns only.
- `user-scalable=no` blocks pinch zoom on menus.
- With Reduce motion on, hit particles, sprite cycling and cloud drift still run (`draw.ts:101-105`, `:186-192`, `:323-326`).

Fix: set `inert` on the HUD while a card is open, restore focus on close, write live text only on change, add arrow key moves and Enter to the grid, and post one status line per event.

---

## Low

- **L1. Score table keyed by player name.** `results.ts:63`, `:85`. **Seen:** a player named `__proto__` shows "Tonight: 0 : [object Object]". Two players with the same name share one score. Key by side, or use a `Map`.
- **L2. Break effects use the wrong material.** `real.ts:222-224`, `:265`. The block is looked up in the new snapshot, where it is gone, so the colour is always timber. `lastCastles` is never reached. Hits on a prop land at world 0,0 (`real.ts:260`).
- **L3. Many events are dropped.** `real.ts:235-287`. `threaded`, `front`, `drop`, `climb`, `castle_drop`, `mend`, `puff_up`, `fatigue`, `pass`, `walk`, `split`, `lid_block`, `buried` give no banner, sound or effect.
- **L4. Stats and best shot reset on resume.** `real.ts:136-137`, `:405-411`. The duel resume also skips the hand-off card; the saved `handoff` flag is never read (`home.ts:36`).
- **L5. Camera assumes a 2400 wide map.** `battle.ts:144-147`, `:197`. Levels 1-1 to 1-3 are 1600 wide. In landscape the forts are small and half the screen is soil (see screenshot).
- **L6. Sound on iOS.** `sfx.ts:22` resumes only from `suspended`; iOS uses `interrupted` after a call. `battle.ts:584` unlocks on `pointerdown`, which iOS does not count as a user action for touch. A big collapse plays one `hit` sound per block at once (`battle.ts:340`).
- **L7. Leaks.** `dom.ts:66` adds a window `blur` listener per Fine Tune key and never removes it; each battle adds four. `battle.ts:897` and `main.ts:44` leave debug handles (`__castle`, `castleApp`) on `window` in production.
- **L8. Portrait top strip wraps.** The Rival's pips drop to a second row under the player's kettle (see screenshot). In 844 x 390, Pause is 48 x 40 and the Hob key 48 x 42, under the 44 pt floor. The save quill stays on screen.
- **L9. Small rule and label slips.** `real.ts:435` maps Knoll Hop to the same level as Two Tumps. "Rival turns at 2x" speeds up only the think pause (`battle.ts:275`). `lostpointercapture` ends a drag as a lift, which fires with Quick Fire on (`battle.ts:692`).
- **L10. Frame pacing.** No blend between ticks (`battle.ts:275-281`), so on 90 and 144 Hz screens the shell moves 0, 1 or 2 ticks a frame and looks uneven.
- **L11. Build and workflow tidy up.** `web.yml:32` pins Rust 1.99.1 but `core/rust-toolchain.toml` (1.97.0) wins; `web.yml:35` pins wasm-bindgen 0.2.130 but `Cargo.lock` (0.2.100) wins. The lock and the CLI do match, so the build is right; the pins just mislead. `web.yml:160` hides a failed deploy. There is no `pull_request` trigger. `wasm-opt` is not installed in CI, so the wasm ships at 1.1 MB. `vite.config.ts:8` says wasm-pack. `dist` ships source maps, `.d.ts` files and the unused 1024 px icon (248 KB, in the precache). Precache is 30 files, 4.86 MB.

---

## Checked and fine

- **XSS.** Player names go through `textContent`, `setAttribute` and `JSON.stringify` only. A name of `<b>Al</b>` shows as text on the setup card, the banner and the hand-off card. The one `innerHTML` (`home.ts:71`) uses fixed numbers.
- **Command names and fields** that are sent (`aim`, `fire`, `pick_hob`, `pick_shot`, `pick_shell`, `quick_pick`, `end_draft`, `recall`, `walk`, `ai_turn`, `pass`, `log`, `terrain_all`, `validate_blueprint`) match `core/API.md`. The Recall index maths is right.
- **Units.** The y flip, terrain chunk placement, base64 decode and lean snapshot merge are right. Events and dirty chunks are gathered across the extra snapshots, so none are lost.
- **Wasm strings and memory.** wasm-bindgen copies strings both ways; the seed goes in as a `BigInt`; the old `Game` is freed on each new battle (but see H1 for the order).
- **Input.** Quick tap on Fire works by touch with no hold time. The 150 ms guard after a drag is there. A second finger cancels the drag and puts the aim back (seen). `pointercancel` and window blur end drags and walks. Drag snaps to 0.5 degrees, Fine Tune steps 0.1 and repeats as the design says.
- **Rotation.** Portrait to landscape keeps phase, aim, pins and round (seen). Open cards survive the relayout.
- **Private mode.** If IndexedDB will not open, the app runs on a memory store.
- **Pages base.** Asset, core, art and manifest paths all honour `VITE_BASE`; with the base set in both steps the smoke test passes under `/CastleProtect/`.
