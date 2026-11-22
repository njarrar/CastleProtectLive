# Web code review 2: apps/web

Scope: `apps/web/`, `.github/workflows/web.yml`, `scripts/build-wasm.sh`. Commit `15dc40c`. No app code was changed.

Read against `docs/review/code/web-review-1.md` (and its Fixes table), `web-build-log.md`, `core/API.md` (v0.2), `assets/animations.json`, `assets/audio/audio.json` and `docs/design/07-ux-ui-audio.md`.

## How it was checked

- `scripts/build-wasm.sh`: passed (no `wasm-opt` on this machine, so the wasm is the plain 1.3 MB build; CI runs binaryen 123).
- `npm ci && npm run build`: passed. Precache is 33 entries, 2.75 MB.
- `npx playwright test`: 19 of 19 passed (desktop Chromium, 1280x720 only).
- Read every file in `src/`, the build scripts, the Vite config and the built `dist/sw.js`.
- Ran three extra scripts against the production build (not kept in the repo): a save taken in each phase and loaded again, Pause then Settings then Back, and the Give up result title.
- Screenshots at 390x844 and 844x390 (2x pixels) in `docs/review/code/web-shots/review-2/`: plan, flight, impact, collapse, settle for each. All ten were looked at.

Not checked on a real device: nothing here ran on iOS Safari or on a phone. The iOS items below come from reading the code. No WebKit run was done.

## Counts

| Rank | Count |
|---|---|
| Critical | 0 |
| High | 3 |
| Medium | 14 |
| Low | 13 |

Round 1 fixes: 28 of 34 hold as written. 6 are partial or have a new hole (H2, H3, H6, M12, L5, L6 below).

## 1. Round 1 fixes, checked

| Id | Now | Where | Note |
|---|---|---|---|
| C1 | Holds | `src/core/index.ts:21-34`, `tests/recovery.spec.ts:41` | Plain GET import, no mock in `dist` (grep gives 0), offline test passes |
| C2 | Holds | `web.yml:54-55`, `playwright.config.ts:5` | One `VITE_BASE` for build, preview and tests |
| H1 | Holds | `src/app.ts:211`, `src/screens/setup.ts:27,117`, `prebattle.ts:156`, `home.ts:129`, `real.ts:197-221` | |
| H2 | Still partial | `src/core/types.ts` (no `dial`, no `target` on `fire`) | Puff Up, Rebuild, `hops3` and the Mendglob target are in core v0.2 but still cannot be sent. See M9 |
| H3 | Holds, with a new hole | `real.ts:634-661` | The version and hash check is right. But the app saves at moments the check can never pass. See H1 below |
| H4 | Holds | `src/save/db.ts:187-239`, `main.ts:81-85` | |
| H5 | Holds | `index.ts:22` | Mock is dev only |
| H6 | Still partial | `draw.ts:485-519`, `real.ts:438` | Grudge and Clatter now play the next-door clip. Still not drawn: `peephole`, `cover`, `hud.puff_up`, `front_rounds_left`, live `hud.score` |
| H7 | Holds | `vite.config.ts:68`, `main.ts:56-65`, `app.ts:135-142` | Chip only on title and map |
| M1 | Fixed in full now | `battle.ts:412-419`, `real.ts:296-304` | Core v0.2 logs a run of `aim` as one entry and sends a lean snapshot |
| M2 | Holds | `battle.ts:1076-1079` | |
| M3 | Holds | `real.ts:701-704` | |
| M4 | Still partial | `real.ts:101,598`, `feel.ts:150-154,214-219` | New view code adds more rule-like numbers. See M11 |
| M5 | Holds for v0.1 keys, misses v0.2 keys | `results.ts:103-114`, `real.ts:38-41` | `give_up`, `volley_points`, `captive_bonked` have no title. See M9 |
| M6 | Holds | `battle.ts:649-660` | |
| M7 | Holds | `db.ts:81-125` | |
| M8 | Holds | `battle.ts:436-502` | Retry after a real wasm trap is a risk. See M12 |
| M9 | Holds | `battle.ts:179-193,688-694` | Keys are still built each frame. See L5 |
| M10 | Still partial | `draw.ts:64-127` | Backdrop cache added. Forts are still drawn block by block. The new terrain copies cost memory. See M7 |
| M11 | Holds | `battle.ts:134` | |
| M12 | Partial | `main.ts:51`, `app.ts:69-73` | Back in a fight opens Pause. But Back in Settings opened from Pause restarts the fight. See H2 below |
| M13 | Now real, not hidden | `real.ts:54,256-257` | `set_wind` and `give_up` are sent. The comments at `types.ts:70` and `battle.ts:117,1177` still say the core lacks them |
| M14 | Holds for battle cards | `battle.ts:1143-1169` | The title "Carry on?" sheet (`home.ts:36`) is not inert and does not trap Tab. Bark subtitles are missing. See M13 |
| L1 to L4 | Hold | | |
| L5 | Partial | `battle.ts:247-268` | At 844x390 the ground and soil fill about 45% of the Plan view and the target fort is cut by the right edge (`landscape-844x390-1-plan.png`) |
| L6 | Changed | `sfx.ts:180-191` | The gate is now 3 plays of one sound per 50 ms, not 1. That matches 07 section 9.5. Resume on any state but `running` holds (`sfx.ts:57`) |
| L7 to L10 | Hold | `battle.ts:525-536,1281` | |
| L11 | Better | `web.yml`, `build-art.mjs` | Precache went from about 9 MB to 2.75 MB with WebP and lazy @2x |

## 2. Findings

### High

#### H1. A save taken while a shot is in the air can never be loaded, and the fight is thrown away

Where: `src/battle/battle.ts:1188-1192` (Pause card: Settings and Map), `src/core/real.ts:619-661`, `src/battle/battle.ts:43`.

What happens: the Pause card works in every phase. Settings calls `core.saveBattle()` and Map calls `autosave()`. Both store the log plus the state hash at that tick. `resume` replays the log and stops right after the last command. If the last command was `fire` (or the Rival's `ai_turn`) and the sim has stepped since, the hash after replay is not the stored hash. `loadBattle` throws `SaveError`, `battleScreen` calls `dropBattleSave()`, and the player lands on the map with "This saved fight no longer replays the same. It was put aside."

Run: save then load on the real core gave: flight THROW, resolve THROW, Rival shell in flight THROW, Rival thinking ok. In the UI: fire, press Escape in flight, Settings, Back. Result: map screen and the fight is gone. Pause then Map in flight also writes the bad save over the good turn-start save, so Resume on the title fails later.

Fix: save only what can replay. Either keep the last turn-start save and never write one outside `plan` (Settings can carry the live `Game` instead of a save string: the core object outlives the screen), or ask the core to log the tick with the save and step to it after `resume`. Until then do not drop a save on a hash miss when the log replayed with no refusal: load it at the last command.

#### H2. Back from Settings (opened from Pause) restarts the fight

Where: `src/app.ts:69-73,110-113`, `src/battle/battle.ts:1188-1191`.

What happens: going from the battle to Settings pushes the old battle route on the back stack. That route has no `resume` data. The browser Back button or the Android Back gesture pops it and builds a new battle screen from it, which calls `core.newBattle(setup)`.

Run: round 2 with 2 pins, Pause, Settings, browser Back. Result: battle screen at round 1 with 0 pins and no message. The Back arrow on the Settings screen itself is fine (it uses `route.back`).

Fix: give the Settings screen an `onBack` that goes to its `back` route, or do not push a battle route on the back stack at all.

#### H3. @2x art and sound are cached forever under names that never change

Where: `apps/web/vite.config.ts:90-102`, `scripts/build-art.mjs:60-66`, `dist/sw.js`.

What happens: `castle@2x-N.json` (the frame rects) is in the precache and is replaced on each update. `castle@2x-N.webp`, the `@2x` backgrounds and everything in `art/audio/` are runtime `CacheFirst` with no max age and no hash in the name. After any art pass that repacks the atlas, a returning phone gets new rects with the old image, so sprites are cut from the wrong places for good. `audio.json` and every sound file are the same: a changed sound or a new entry in `audio.json` never reaches a player who has played before. `cleanupOutdatedCaches` only clears the precache.

Fix: put a content hash in the file names in `build-art.mjs` (the page JSON and `audio.json` already name the files), or use `StaleWhileRevalidate`, or add a build id to the two cache names and delete old ones on activate.

### Medium

#### M1. Portrait: lens borders cross the flight view, and Pause sits on the Field Strip

Where: `src/styles.css:323` (`.hud.tall .strip` borders), `src/battle/battle.ts:373-385,568`.

Seen in `portrait-390x844-2-flight.png` and `-3-impact.png`: two 3 px ink lines run across the joined lens at about y 290 and y 328. They are the DOM borders of the strip, which stay put while the canvas draws one joined lens. The strip itself is drawn at the foot of the lens, where the Pause key covers its left end and the left lens bracket.

Fix: set a `joined` class on the HUD while `joined` is true (it is not the same as `.flight`) and hide the strip borders with it. Move Pause up 40 px in that state, or inset the strip.

#### M2. "Drop!" sits on or against the damage number

Where: `src/core/real.ts:361,412,422`, `src/render/feel.ts:162,209,261`, `src/render/fx.ts:220-251`.

Two cases:
- A Hob falls: the note word "Drop!" (or "Tumble!") is placed at the Hob plus 30 cells. The fall damage number is placed at the Hob plus 36 cells. That is 6 cells apart, 3 to 6 px on a phone, for text 16 to 32 px tall. They overlap, and which one is on top depends on the pool slot.
- The big drop callout: the gold "Drop!" burst is placed 14 cells under the fort base and the merged block number near the hit. In `portrait-390x844-3-impact.png` the "125" and the burst touch. In `portrait-390x844-4-collapse.png` the burst covers the Rival kettle in the Top lens.

Cause: offsets are in world cells but the text size is in screen px, so they close up as the zoom drops.

Fix: lay words out in screen px. Draw words first and numbers on top. Put "Drop!" to the side away from the number (the number already drifts by `dir`), and keep it off the kettle box.

#### M3. Sound does not stop when it should

Where: `src/audio/sfx.ts:313-342`, `src/battle/battle.ts:505-522,1294-1300`.

- No `visibilitychange` or `pagehide` handler anywhere in `src`. With the tab hidden or the phone locked, music and the wind loop play on (Chrome on Android and desktop do not stop Web Audio in a hidden tab).
- `stopLoops()` only starts a fade. `loop()` stops a source only on a later call when the gain has dropped under 0.02, and no later call comes after `destroy`. The wind, kettle and squall loops run silent for the rest of the session.
- A pause in slow motion: `feel.update(0)` holds `slowLeft`, so the low-pass and the 3 semitone drop stay on the music for as long as the Pause card is open.

Fix: `ctx.suspend()` on hidden and `resume()` on visible. In `stopLoops` stop each source after the fade with `src.stop(t + 0.4)`. Call `slowmoAudio(false)` when Pause opens.

#### M4. About 95 MB of decoded sound is held for the whole session

Where: `src/audio/sfx.ts:27,54,93-113,352-381`, `assets/audio/audio.json`.

Web Audio holds decoded sound as 32 bit floats. The three battle layers are 71.1 s (one stereo, two mono): about 55 MB. The map theme is 41.7 s stereo: 16 MB. The 85 effects, 3 stings and 48 barks add about 79 s: up to 25 MB. `buffers` never drops anything, so the map theme and the battle layers are both kept. On an older iPhone this sits next to 64 MB of @2x atlas pages and the canvas caches of M7, and Safari kills tabs for less.

Also: all 136 effects and barks are fetched and decoded at once on the first tap (`sfx.ts:54`), which is the same tap that starts level 1-1.

Fix: drop the map theme buffer when the battle theme starts and the other way round. Decode barks only for Hobs in this fight. Spread the first decode over a few frames or decode the 15 or so sounds a first shot needs first.

#### M5. The first session caches no sound, so the second launch offline has none

Where: `vite.config.ts:92-102` (sound is runtime cache only), `src/main.ts:56-65` (no `clientsClaim`).

The service worker does not control the page on the first visit, so nothing fetched in that session goes to the `castle-audio` or `castle-art-2x` cache. Install, play one session with sound, go offline, open again: `audio.json` fails, so there is no music and only the synth stand-ins. Art falls back to @1x, which is fine.

Also `pending` keeps a failed fetch as `null` for the session (`sfx.ts:109-111`), and `setMusic` never tries again once `musicKey` is set (`sfx.ts:355-364`).

Fix: precache `audio.json` and the small effects in one format, or warm the cache from the page once the worker is active. Delete the `pending` entry on failure. Clear `musicKey` when a layer fails to load.

#### M6. Ogg Opus is picked by `canPlayType` with no way back

Where: `src/audio/sfx.ts:79-80,99-109`.

`canPlayType` speaks for the `<audio>` tag. `decodeAudioData` is a different path and Safari has said yes to one and failed the other before. If the decode fails, every sound is `null` for the session and the game plays only the synth sounds, with no retry in m4a.

Fix: on a decode error try the other format once and switch `fmt` for the rest of the session. Test on Safari 17 and 18.4.

#### M7. Canvas memory is never given back (iOS Safari)

Where: `src/render/draw.ts:68-127,345`, `src/battle/battle.ts:546,1294-1306`, `src/render/terrain.ts:44-46`.

Each battle screen makes a terrain canvas and four `LensCache` objects, each with a lens canvas and four pre-scaled copies. The terrain copy is the whole map at `cam.s * dpr`, up to 9 million px (36 MB) per lens. `destroy` frees none of it. iOS Safari is slow to free canvas memory, and after a few Retry taps the tab can hit its canvas limit and draw blank.

Also every crater bumps `terr.rev`, so each lens rebuilds its whole-map copy three frames later: a multi-megapixel scale on the frame after each hit.

Fix: in `destroy` set `width = height = 0` on every cache canvas and the terrain canvas. Rebuild only the dirty rect of the scaled terrain copy, or scale only the visible part.

#### M8. Resolution drops to 1x for good on a 30 fps phone

Where: `src/battle/battle.ts:162-167`.

`adaptRes` reads the gap between frames. iOS Low Power Mode caps `requestAnimationFrame` at 30 fps, so every gap is 33 ms, `slowFrames` passes 20, and `dprCap` falls to 1. It can never climb back because no frame is under 17.5 ms. The field is blurry for the whole fight on a phone that draws fine.

Fix: time the work inside `tick` (`performance.now()` at the start and end) and judge that, not the frame gap.

#### M9. Core v0.2: parts of the new data never reach the screen

Where: `src/core/real.ts:38-41,322-451,603`, `src/screens/results.ts:103-114`, `src/battle/battle.ts:1199-1223`, `src/core/types.ts:60-72`.

- Result titles: `give_up`, `volley_points` and `captive_bonked` are not in `HOW` or in `resultTitle`. A Volley Points win in Skirmish reads "volley_points!". A loss reads "Flattened" for all three.
- `hud.handicap` is mapped (`real.ts:603`) and never shown. API.md says to show Help, Steam, preview share and crew openly. The hand-off card shows Help only, from the setup.
- Boss phases: `boss_phase` gives a banner and the cut line is drawn. `roller_move`, `shears`, `column`, `prop`, `prop_wake`, `carve` and `mound` fall to `default: return []`, so the roller jumps with no sound or word, and `hud.boss.jam` and `roller_done` are not shown.
- `fire` cannot carry `dial` or `target`, so Puff Up, Rebuild, `hops3` and a Mendglob on your own block are out of reach (round 1 H2, still open).
- Give up and Volley: checked and fine. Give up sends `give_up` with no side, the core picks the right one, and the result comes from the core. Volley shows "Shots left a : b of n" (`battle.ts:729`).
- Resume: uses the core's `resume`, checks rules version and hash. Fine apart from H1.

Fix: add the three titles, a handicap line on the hand-off card and the pre-battle sheet, notes and sounds for the boss events, and the dial and target fields.

#### M10. The collapse show is longer than the core's settle

Where: `src/render/collapse.ts:19-20,94,134-140`, `core/API.md` ("settle: 60 ticks").

The show is 300 ms creak, 150 ms lean, 60 to 90 ms per row, the fall, then 300 ms. That is 1.0 to 1.5 s. The core waits 0.5 s. In `portrait-390x844-4-collapse.png` and `landscape-844x390-5-settle.png` the banner reads "Sir Pudge aims" (and his shell is already up) while the blocks still fall. In a Couch Duel the hand-off card opens over it and the blocks hang in the air until READY, because the card stops view time.

Fix: cut the creak and lean when the next turn starts (jump the group to its drop), or have the core hold `settle` for the length the data gives.

#### M11. Rules and rule numbers in the new view code

Where: `src/render/feel.ts:148,150-154,214-219`, `src/render/juice.ts:21-35`, `src/audio/sfx.ts:235`, `src/render/fx.ts:65-67`, `src/battle/battle.ts:1249-1254`.

- Clean Sweep is worked out in TypeScript by counting Hobs that are not Bonked (`feel.ts:214-219`). It then plays the battle-ending slow motion, which skips the 1.5 s budget and the 2x rule. In Volley Points a side with no Hobs left does not end the fight (they Puff Up), so the "ending" slow motion plays in the middle of a game. Use the `win` event and its `how`.
- The blast bands (64, 42, 28, 18) are typed in three files. The damage bands are in two. Put them in `content/app.json` or one module.
- The near miss rule (kettle at 25% or less, blast within r + 40) and the Pot Lid room filter (`rm.intact && !rm.lid`) are picked in the view. Low risk, but they are rules.
- `feel.ending` is set and never read.

#### M12. Retry after a wasm trap may fail the first time (by reading, not run)

Where: `src/core/real.ts:197-221`, `src/battle/battle.ts:490-501`, `core/API.md` "Errors and panics".

After a trap the `Game` is left borrowed and every method throws. `start()` makes the new `Game`, sets `this.game`, then calls `old?.free()`. If that throws, the resets and the first `pull()` are skipped: the core object holds a new game with the old snapshot, and the player sees "This fight cannot start". A second Retry works. Also the crash card says "Your last turn is saved" but Retry starts a new fight; API.md says to make a new `Game` and `resume` the saved log.

Fix: wrap `old?.free()` in try and catch. Make Retry load the autosave when there is one.

#### M13. Accessibility gaps in the new work

- Bark subtitles: `barks.json` is shipped and never read. 07 section 7.6 says a bark shows as a speech tag, and still shows at volume 0. There are no sound cue captions either. A deaf player gets none of the new voice work.
- No Voices slider and no Mono toggle (07 section 8, Sound). Barks ride the effects bus (`sfx.ts:128`).
- The Shell card opens on `contextmenu` only (`battle.ts:770`). iOS Safari does not send that event on a long press, so Weight and "Best with" cannot be read on an iPhone.
- No `-webkit-touch-callout: none` in `styles.css`. The 450 ms Lean Lines hold can bring up the iOS callout on a portrait image.
- No haptics (`navigator.vibrate`) though 07 section 6.5 lists them for Android Chrome.
- Reduce motion is handled well in the new code: no shake, a 50 ms cap on hit stop, a 150 ms hold in place of slow motion, loops hold a frame, the banner fades, no leaves, parallax off.

#### M14. CI tests one desktop size in one engine

Where: `apps/web/playwright.config.ts:18`, `.github/workflows/web.yml:134-141`.

All 19 tests run in Chromium at 1280x720. One test turns to 390x844 for a moment. Nothing runs in WebKit, with touch, or at a phone size from the start, and no test covers sound, the update chip, or a save in flight. H1, H2 and M1 all pass the suite.

Fix: add a `webkit` project and a phone project (390x844, touch). Add tests for H1 and H2.

### Low

- L1. `Collapses.start` sets `g.left = e.blocks.length` before it takes pool slots (`collapse.ts:79,88-90`). If the 160 block pool runs out, the group never reaches 0, `busy` stays true and the landscape camera stays on the settle frame for the rest of the fight (`battle.ts:316`). Count the slots taken.
- L2. `Juice.slow` adds to `addedThisTurn` and sets `slowThisShot` before the "a stronger slow is running" return (`juice.ts:127-130`), so a slow that never plays still spends the budget. `FX_CAP` is 140 where the comment says 120 (`fx.ts:10-11`).
- L3. Music sync: the three layers start on one time and get the same rate change, so they stay locked to each other. But `musicLayers` works out the next bar from `musicT0` and wall time (`sfx.ts:389`), so after any slow motion the fades no longer land on a bar line. `cancelScheduledValues` in the middle of a ramp makes the gain jump (`sfx.ts:393-394`). The layer target is 1, not the sound's `volume`.
- L4. `loop()` reads `gain.value` every frame and calls `setTargetAtTime` again until the value is within 0.01 (`sfx.ts:338`): about 30 events per fade. Keep the last target in a field.
- L5. Garbage each frame, against the "allocates nothing" notes: the HUD key strings and filtered arrays (`battle.ts:708-757`), camera target objects (`battle.ts:348,366-384`), `prevShell` pairs (`battle.ts:471`), two array spreads in `merge` (`battle.ts:1311-1315`), and the whole view cache (all blocks, three Sets per fort) on every aim change in a drag (`real.ts:298-304`).
- L6. Lazy @2x: `upgrade()` runs only when a battle starts (`battle.ts:1274`), so the title, map and Workshop stay @1x. Crew portraits and tray icons in the fight stay @1x too, because their keys use `sprites.ready`, not `sprites.scale` (`battle.ts:740,757`). `upgrading` is never reset, so a failed fetch is not tried again. The old @1x bitmap is never closed.
- L7. `unlockAudio` is called only by Play, Resume and the battle (`home.ts:17,40`). A player who opens `#map` or the Workshop gets no sound and no map theme until a fight.
- L8. Portrait: the save quill sits on the Rival pips (`styles.css:359`, seen in `portrait-390x844-4-collapse.png`). In the joined lens the bottom third is clay and rock (`battle.ts:381`).
- L9. `clipCanvas` with `still: true` never ends, so one `requestAnimationFrame` loop repaints a still canvas each frame while it is on screen (`motion.ts:17-24`).
- L10. Stale text: `types.ts:70` and `battle.ts:117,1177` say the real core has no `give_up` or wind command. The view still counts shots and hits in `real.ts:342,357,385` though the core result now has them.
- L11. Service worker: no update check while the app stays open (an installed app can run for days). The `castle-copy` plugin also runs for `vite preview` and wipes and rebuilds `public/core` and `public/art` (`vite.config.ts:59`).
- L12. iOS: the manifest asks for `display: fullscreen`, which iOS does not have; say `standalone`. `100vh` is used at `styles.css:204,370`; use `100dvh`. Old Safari returns nothing from the promise form of `decodeAudioData` (`sfx.ts:106`).
- L13. `build-wasm.sh` keeps the plain wasm when `wasm-opt` is missing or old, with a note only on stderr. A CI run can ship 1.3 MB in place of the small build and stay green. Print the final size and warn in the workflow.

## 3. New work, in short

| Part | Verdict |
|---|---|
| Animation player (`anim.ts`) | Sound. Reads `frames`, `ms`, `loop_from`, `next`, `hold`, `pick` and events as the data says. No allocation in `step` or `frame`. The 64 step guard stops a zero length frame from hanging |
| Effects (`fx.ts`) | Pooled, capped, culled. Number merge and the 12 number cap match 07 section 6.3. See M2 for word placement |
| Feel (`feel.ts`) | Every effect starts from a core event. Maps are bounded by fort and crew size; no leak found. See M11 |
| Collapse (`collapse.ts`) | Reads the data tracks; Reduce motion drops lean, wobble and squash. See M10, L1 |
| Juice (`juice.ts`) | Hit stop, shake and slow motion scale view time only; sim ticks do not change. Shake uses its own numbers, not the sim RNG. See L2 |
| Camera (`battle.ts:196-387`) | Follows with a dead zone, holds 0.6 s, widens for the collapse, clamps to the map. Reduce motion uses cuts. Landscape Plan view wastes space (L5 of round 1) |
| Audio (`sfx.ts`) | No sound before a tap; the context is made in a tap and resumed from any state. Layers start on one sample. See M3 to M6, L3, L4 |
| WebP build (`build-art.mjs`) | Lossless, cached by content hash, falls back to PNG with no `sharp`. See H3 for names |
| Service worker | Prompt mode, chip only on title and map, never reloads in a fight. See H3, M5 |
| `web.yml`, `build-wasm.sh` | Runner and binaryen pins are right and explained in the build log. See M14, L13 |

## 4. Order of work

1. H1 and H2 (a fight is lost by two common taps), with tests.
2. H3 before the next art or sound pass ships.
3. M1 and M2 (the two known portrait issues, both still there).
4. M3, M4, M7, M8 on a real iPhone, then M5 and M6.
5. M9 to M14, then the Low list.
