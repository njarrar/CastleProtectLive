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
| `CastleProtect/UI` | Title (First Run), Region 1 map, pre-battle sheet with the Rummage, battle HUD, Pause card, Couch Duel setup and hand-off card, Results and Duel results, Skirmish setup, Settings |
| `CastleProtect/Save` | `SaveData` (Codable, lenient decode) and `SaveStore` (Application Support, temp file then replace, backup copy, utility queue) |
| `CastleProtect/Feedback` | Core Haptics (UX 6.5 table, Off, Light, Full) and AVAudioEngine sound cues |
| `CastleProtect/Resources` | Asset catalog (app icon, launch logo and colour), privacy manifest (no data collected) |
| `Tests/CastleProtectTests` | XCTest: wire types against the core fixtures, command JSON, setup keys, the frame assembler, the battle runner (stand-in and, when linked, the real core with save and replay), save store, Aim Drag maths, layout |
| `Tests/CastleProtectUITests` | Launches with an empty save, taps Play, checks the battle opens; opens and closes the Pause card |
| `scripts/core-module.sh` | Build phase: writes the `CastleCoreFFI` module map from the XCFramework header and copies `libcastle_ffi.a` |
| `scripts/sync-assets.sh` | Copies the app icon and launch logo from `assets/sprites` into the asset catalog |

The build copies these folders from the repo into the app bundle: `assets/atlas`,
`assets/sprites`, `assets/manifest.json`, `assets/sounds` (when it exists, by a script phase), `content/`
and `core/fixtures/`. Change the art in `assets/` and the next build picks it up.

## How CI builds it

`.github/workflows/ios.yml` runs on a GitHub macOS runner on pushes that touch
`apps/ios`, `core`, `content` or `assets`:

1. Installs Rust and runs `scripts/build-xcframework.sh`, which builds `castle-ffi` for
   `aarch64-apple-ios` and `aarch64-apple-ios-sim` and writes
   `apps/ios/Frameworks/CastleCore.xcframework` (header `castle_core.h` included).
2. `brew install xcodegen`, then `xcodegen generate` in `apps/ios`.
3. `xcodebuild build` and `xcodebuild test` for the newest iPhone simulator, scheme
   `CastleProtect`, Debug, `CODE_SIGNING_ALLOWED=NO`.
4. Uploads the simulator `.app` as an artifact, and the test results when a step fails.

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

## Core rules 3 and QA playtest 1

The app speaks core rules 3 (`core/API.md`, "Changes for QA playtest 1"). Tests are in
`Tests/CastleProtectTests/QAPlaytestOneTests.swift`; the real-core ones are required by CI.

- Fire is lit from `hud.fire`. Unready shot chips stay tappable and show the core's `why`
  (a short word) and `text` (VoiceOver and the banner). A `shot_switch` event shows the
  chip's words after the turn banner. A refused Fire shows the core's `detail` and moves the
  pick to its `ready_shot`.
- Fatigue: the round label reads "Fatigue in 3", "2", "1", then "Fatigue"; a "Fatigue next
  round" banner shows at the start of round 9; the round 10 collapse (`why: "fatigue"`)
  plays like any collapse.
- Results show "Your best shot" from `stats[0].best_shot` (and the winner's
  `result.best_shot` after a loss); the Couch Duel results show each player's.
- Retry keeps the seed and sends the next `attempt`; the Daily Dust-up never sends one.
- Test Yard: side 1 is the Dummy side and passes itself; the app treats only side 0 as a
  person and the round label reads "Test Yard".
- A save from rules 2 is refused with a plain message and cleared; progress is kept.
- Layout: the landscape plan frame holds both forts while blocks draw at 8 pt or more,
  else your fort and the arc with a "Rival fort" marker on the edge. Fine Tune sits on the
  side away from your fort and hides while a finger aims or pans. A pull into the screen
  edge keeps its angle and only power follows; full power comes before the edge (never
  under 64 pt). A press away from your fort pans the camera. The Couch Duel setup and the
  hand-off card are compact on a short screen. There is no Workshop screen on iOS yet, so
  the 24 pt cell rule has nothing to apply to.

## Known gaps in v0.1

- The core has no handicap, give up, Volley Points or Buttons economy yet, so Help and
  Volley Points are saved in the setup but not sent, Give up is not offered, and
  Results shows Pennants only.
- Ground is drawn from a height per 8-cell column, so carved overhangs show as dips.
- No pinch zoom or two-finger pan, no long-press Shell cards, no Table mode, no Workshop
  screen yet.
- The AI runs on the main actor inside `ai_turn`, so a slow think can cause a short
  hitch; it can move to its own thread with a replica handle later.
- Sounds fall back to small generated blips until `assets/sounds` exists (mono,
  44.1 kHz).
