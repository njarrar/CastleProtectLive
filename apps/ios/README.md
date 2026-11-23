# Castle Protect for iPhone and iPad

Native Swift app, iOS 16 and up, universal (iPhone and iPad), portrait and landscape.
SwiftUI for every menu and the HUD, SpriteKit for the battle field, the shared Rust
core for every rule. No third-party dependencies.

The app never computes a game rule. It sends commands to the core as JSON and draws
the snapshots the core sends back (see `core/API.md`).

## What is in here

| Path | What |
|---|---|
| `project.yml` | The XcodeGen spec. The `.xcodeproj` is generated, never checked in |
| `CastleProtect/App` | App entry, `AppModel` (screens, save, the battle in play), orientation lock |
| `CastleProtect/Core` | The core boundary: `CoreProtocol.swift` (setup, commands, replies and snapshot exactly as in `core/API.md` and `core/schema/`), `CoreBridge` (the C ABI as a protocol), `FFICoreBridge` (the real core), `FakeCoreBridge` (a thin player of `core/fixtures`), `CoreGame` (the frame loop, AI think pose, save and resume by replay), `FrameAssembler` (snapshot to view model, y flipped up), `ContentCatalog` (level names and goal text from `content/`) |
| `CastleProtect/Battle` | `BattleSession` (clock, Aim Drag, Fine Tune, Fire guard), `BattleLayout` (Wide layout and Tall stacked lenses, pure functions), `BattleSpriteView` (SpriteKit scene, one crop node per lens), `SpriteAtlas` (atlas pages and HUD sprites from `assets/`) |
| `CastleProtect/UI` | Title (First Run), Region 1 map (with Daily Dust-up and Test Yard), pre-battle sheet with the Rummage, battle HUD (with contextual shot dials, block targeting, Pot Lid room picker and native Rival peek), Pause card, Couch Duel setup and hand-off card, Results and Duel results, Skirmish setup, Workshop fort builder, Settings |
| `CastleProtect/Save` | `SaveData` (Codable, lenient decode) and `SaveStore` (Application Support, temp file then replace, backup copy, serialized utility queue) |
| `CastleProtect/Feedback` | Core Haptics (UX 6.5 table, Off, Light, Full, cached UIKit fallbacks) and AVAudioEngine sound cues (stereo panning, 3-layer bar-synced music, 30 ms/400 ms smooth ducking, world bus voice ducking, slow-mo rate shift) |
| `CastleProtect/Resources` | Asset catalog (app icon, launch logo and colour), privacy manifest (no data collected) |
| `Tests/CastleProtectTests` | XCTest: wire types against the core fixtures, command JSON, setup keys, the frame assembler, the battle runner (stand-in and, when linked, the real core with save and replay), save store, Aim Drag maths, layout, Workshop validation, rules v3/v4 and QA playtest regressions |
| `Tests/CastleProtectUITests` | Launches with an empty save, taps Play, checks the battle opens; opens and closes the Pause card |
| `scripts/core-module.sh` | Build phase: writes the `CastleCoreFFI` module map from the XCFramework header and copies `libcastle_ffi.a` (non-Debug builds fail if missing) |
| `scripts/sync-assets.sh` | Copies the app icon and launch logo from `assets/sprites` into the asset catalog |

The build copies only what iOS actually loads into the app bundle via targeted script phases in `project.yml`: `@2x` atlas sheets (`assets/atlas/castle@2x*`), UI-only `@2x` sprites (`portrait_*@2x.png`, `icon_*@2x.png`, `ui_*@2x.png`, `app_icon-512.png`), `assets/manifest.json`, `assets/animations.json`, AAC audio (`assets/audio/**/*.m4a` plus `audio.json` and `barks.json`), and `content/`. `core/fixtures/` is copied into `CastleProtectTests` and Debug app builds only (excluded from Release). Change the art in `assets/` and the next build picks it up.

## How CI builds it

`.github/workflows/ios.yml` runs on a pinned `macos-15` GitHub runner on pushes and pull requests that touch
`apps/ios`, `core`, `content` or `assets`:

1. Installs Rust (`aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios`) and runs `scripts/build-xcframework.sh`, which builds `castle-ffi` for iOS device plus a fat `arm64 + x86_64` simulator slice and writes `apps/ios/Frameworks/CastleCore.xcframework` (header `castle_core.h` included).
2. `brew install xcodegen`, then `xcodegen generate` in `apps/ios`.
3. `xcodebuild build` and `xcodebuild test` for the newest iPhone simulator (and layout/Workshop/real-core suites on an iPad simulator), scheme `CastleProtect`, Debug, `CODE_SIGNING_ALLOWED=NO`.
4. Builds an unsigned Release device bundle, verifies the privacy manifest against both undefined C symbols and ObjC selector references (requiring non-empty reason codes), checks that Release contains no `fixtures/` or `@1x` atlases, and runs all real-core test classes against a `--dev` core to exercise the core thread-affinity check.
5. Uploads the simulator `.app` as an artifact, and the test results when a step fails.

How the core gets in: the `Core module map` build phase finds the simulator or device
slice of the XCFramework, copies `castle_core.h` and the static library into
`$(BUILT_PRODUCTS_DIR)/CastleCoreFFI`, and writes a module map with `link "castle_ffi"`.
`SWIFT_INCLUDE_PATHS` and `LIBRARY_SEARCH_PATHS` point there, so `import CastleCoreFFI`
works and Swift links the library. When the XCFramework is missing, the phase writes
nothing, `#if canImport(CastleCoreFFI)` is false, and the app builds and runs with the
stand-in core. So the app never fails to build for want of the core.

## Run it on your Mac

You need a Mac with Xcode 16 or newer (Xcode 26 for App Store builds), Homebrew and
rustup.

```sh
brew install xcodegen
git clone <this repo> && cd CastleProtect
scripts/build-xcframework.sh          # builds the Rust core into apps/ios/Frameworks
cd apps/ios
xcodegen generate                     # writes CastleProtect.xcodeproj
open CastleProtect.xcodeproj
```

In Xcode pick the `CastleProtect` scheme and an iPhone or iPad simulator, then Run
(Cmd+R). Tests run with Cmd+U.

On your own iPhone or iPad: select the `CastleProtect` target, Signing and
Capabilities, tick Automatically manage signing and pick your team (a free Apple ID
works for your own devices), change the bundle id if Xcode asks, plug the device in,
pick it as the run destination and Run. The first time, allow the developer profile in
Settings, General, VPN and Device Management.

Without Rust you can still run it: skip `build-xcframework.sh` and the app uses the
stand-in core, which replays the core's fixture frames (one shot and the Rival's turn,
on a loop). Settings, About names the core in use.

From the command line:

```sh
cd apps/ios && xcodegen generate
xcodebuild test -project CastleProtect.xcodeproj -scheme CastleProtect \
  -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO
```

Launch arguments: `-useStandIn` uses the stand-in core even when the real one is
linked; `-uiTesting` also starts from an empty save in a temp folder (UI tests use it).

## How a battle runs

- `CoreGame` follows the frame loop in `core/API.md`: it calls `cp_step` only in
  `resolve` and `settle`, shows the think pose for 1 s and then sends `ai_turn` when
  `awaiting` is `"ai"`, and reads a snapshot every tick (8 ms). Lean snapshots are
  merged with the last full one; terrain chunks are kept in a grid and turned into
  ground heights.
- The core works in cells with y down; `FrameAssembler` flips y once so the view
  model and SpriteKit both use y up.
- Layout is a pure function of the window size and safe areas (`BattleLayout`), never
  saved. Wide when the width is at least 1.2 times the height, with 1.15 and 1.25
  hysteresis. Tall shows the Top lens on the target fort, the Field Strip, and the
  Bottom lens on your fort; on Fire they join into one follow lens. Turning the device
  keeps the aim, the picked Hob, the Pins and the shell in flight; a turn during an Aim
  Drag ends the drag with its aim kept and fires nothing.
- Aim Drag (UX 3.1): 8 pt to start, anchor where the finger went down, pull-back or
  point mode, power 100 at 40% of the short side in both layouts, 0.5 degree snap,
  12 pt cancel ring, a second finger cancels. Fine Tune steps 0.1 degree and 1 power,
  repeats when held (350 ms, then 8 a second, 20 after 1 s), and folds after 4 s on
  phones. Every button acts on release with no minimum press. Fire acts on release
  inside the button, with a 150 ms guard after a drag.
- Save: `SaveData` in Application Support. The battle save is written at every turn
  start and when the app leaves: the setup plus the core's own command log (`log`).
  Carry on replays that log from the seed (the core is deterministic), drops the
  replay's events, and asks for the whole map again (`terrain_all`).
- Couch Duel: `mode: "couch"`, both sides human, Starter Box kits. The hand-off card is
  app state shown at each turn start with Side by side seats, and Ready ignores taps for
  its first 400 ms.

## Core rules 4, QA playtest 2 and current features

The app speaks core rules 4 (`core/API.md`). Tests live under `Tests/CastleProtectTests/` (including `QAPlaytestOneTests.swift`, `QAPlaytestTwoTests.swift`, `CoreV02Tests.swift`, `ReviewFixTests.swift` and `ReviewTwoTests.swift`); all real-core classes are required by CI.

- Fire is lit from `hud.fire`. Unready shot chips stay tappable and show the core's `why` (a short word) and `text` (VoiceOver and the banner). Match Class shells display a gold star badge (`match_class`, including `"all"`). Contextual action controls expose `dial` (`Rebuild` / `Puff Up` on Barn Raising, `2 Hops` / `3 Hops` on Bobbin's Plain Shot), own-fort block targeting (`mendglob` and `mend_bucket`), and Pot Lid room selection (`Kettle` or `Nook 1..N`).
- Pass is separated from `FIRE` into the utility strip and requires a brief 350 ms hold (or tap confirmation in Tap-only / VoiceOver mode) to prevent accidental turn forfeits.
- Fatigue: the round label reads "Fatigue in 3", "2", "1", then "Fatigue"; a "Fatigue next round" banner shows at the start of round 9; the round 10 collapse (`why: "fatigue"`) holds the camera on your own fort until it settles.
- Results show "Your best shot" from `stats[0].best_shot` (and the winner's `result.best_shot` after a loss), "What broke you" (`result.broke`), Siege Score, Buttons, and Double Pop tie-break copy matching `total_hp` (kettle, Hobs and standing blocks).
- Workshop: build and validate a custom fort live against the Rust core (`WorkshopChecker` on a dedicated core thread), save it to `SaveData.fort` (automatically used in Campaign, Skirmish, Daily Dust-up, Test Yard and selectable as "My Fort" in Couch Duel when Nook seats suffice), or jump straight into the Test Yard to test-fire it.
- Daily Dust-up and Test Yard: directly launchable from the Map dock and Skirmish setup. Daily Dust-up seeds deterministically via `cp_daily_seed` and passes `progress.daily_paid` for once-per-day rewards.
- Layout & Accessibility: phone landscape frames both forts down to 6 pt blocks (8 pt on iPad), with a native SwiftUI safe-area-inset "View Rival fort" / "Back to my fort" button when the rival is off-screen. Fine Tune stays away from your fort and supports VoiceOver adjustable actions plus iPad hardware keyboard shortcuts. Reduce Motion keeps Tall lenses split during flight and halts continuous animations.

## Remaining scope notes

- Terrain is rendered from real cell-grid chunk textures (`TerrainGrid`) in main lenses and lightweight contour fill in the 32 pt Field Strip.
- Pinch zoom, two-finger pan, long-press Shell info cards and Table mode (facing seats) are planned for a later milestone.
- The Rust core runs on its own dedicated `CoreThread` (`CoreHost`), so AI thinking and battle replays never block the main actor.
