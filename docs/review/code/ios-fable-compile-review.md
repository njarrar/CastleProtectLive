# iOS compile review

A read of every edited and new Swift file under `apps/ios`, done by hand. There is no Swift compiler on this machine, so nothing here was built. The aim was to find what Xcode 16 (Swift 6, strict concurrency, iOS 16 target) would refuse, and tests that would fail, before CI runs.

Nothing was committed.

## What was read

- All 33 app files under `apps/ios/CastleProtect/`, in full.
- All 11 test files under `apps/ios/Tests/`, in full, the old ones too, since the app's API moved under them.
- `project.yml`, `.github/workflows/ios.yml`, `docs/review/code/ios-text-pass.md`.
- `content/text.json`, the level, shot, Hob, class, Doodad, app, blueprint and Starter Box files, `assets/animations.json`, `assets/audio/audio.json`, `assets/audio/barks.json`, the @2x atlas and `core/fixtures/`.

## Compile errors fixed

| # | File and line | What was wrong | Fix |
|---|---|---|---|
| 1 | `App/AppModel.swift:377` | `BattleSetup.testYard(seed:)` does not exist. `startTestYard` could not compile. | `BattleSetup(mode: .yard, map: "d1", seed: Self.newSeed())`, the same setup the tests use. |

## Likely compile errors made safe

These are forms Swift 6 may refuse or may fail to type-check in time. Each was changed to a form the last green build already uses.

| # | File and line | Risk | Fix |
|---|---|---|---|
| 2 | `Battle/BattleSession.swift:192` | `DisplayLinkProxy` was a plain class whose `fire()` took `self` into `MainActor.assumeIsolated`. Swift 6 can refuse that capture ("sending self risks causing data races"). | The proxy is `@MainActor` and calls `owner?.handleFire()` directly, as the old `FrameClock` did. |
| 3 | `Feedback/SoundEngine.swift:1159` | `guard let self = me.value` inside a closure that does not capture `self`. | The local is named `sound`. |
| 4 | `Core/BattleSetup.swift:153` | A closure with several statements given to `map`, with no result type to infer from. | `{ i -> CoreSideConfig in`. |
| 5 | `Battle/BattleSession.swift:1119` | The same, with a labelled tuple result. | `{ id -> (id: String?, label: String, enabled: Bool) in`. |
| 6 | `Battle/BattleSession.swift:1142` | An unlabelled tuple joined to a labelled tuple list with `+`. | `kettle` is typed `(id: String, label: String)`. |
| 7 | `UI/HudParts.swift:48` | One long `accessibilityLabel` line: three closures, two `+`, a ternary and two mixed dictionaries. A type-check time-out risk. | Moved into `PipRow.spokenLabel` (line 52), built in steps. Same words. |
| 8 | `Battle/BattleSpriteView.swift:780` | A ternary, a closure, `sin` and `??` on one line. A type-check time-out risk. | Two plain lines with `if let walking`. Same value. |

## Bugs fixed in the app

| # | File and line | What was wrong | Fix |
|---|---|---|---|
| 9 | `Core/FrameAssembler.swift:59, 111, 160, 256` | The hand-off line used the core's raw side names ("Left skipped a go") while the HUD shows "You". `AuditFixTests` expects "You skipped a go" and would fail. | One `displayNames` helper gives both the HUD and the hand-off line the same names. |
| 10 | `UI/WorkshopView.swift:193` | The "won't stand" mark looked for the word "hang" in the problem line. The new line is "Nothing under it", so the mark never showed. | It compares with `workshop.problems.nothing_under`. |

## Tests that would have failed

The content, the assets and the core fixtures all changed in this work tree. These tests still held the old numbers.

| # | File and line | Old | New | Why |
|---|---|---|---|---|
| 11 | `CoreV02Tests.swift:202` | 140 sounds | 147 | `audio.json` now lists 147 (`totals.sounds`). |
| 12 | `CoreV02Tests.swift:36` | top blow 29 | 19 | `snapshot_ended.json` was made again. Android already says 19. |
| 13 | `QAPlaytestOneTests.swift:307, 315` | best shot 29 | 19 | The same fixture. |
| 14 | `QAPlaytestTwoTests.swift:503, 504` | `cell(4, 0)` is Nook 3, `cell(0, 5)` is Timber | `cell(4, 4)` is Nook 3, `cell(0, 5)` is Wicker | `bp_home_3` in `content/blueprints.json` is a new fort. |
| 15 | `ReviewTwoTests.swift:293` | `advance(milliseconds: 20)` | `4000` | A full frame now sets the think pose from `hud.think_ms` (1800 in the fixture), so the test's `thinkMs = 0` is written over and no `ai_turn` was ever sent. |

## Checked and found sound

- **Text keys.** A script pulled every literal key from the Swift code: all are in `text.json`. Keys built at run time (`setup.difficulty.<id>`, `hud.why_short.<id>`, `shell_card.damage_types.<id>`, `workshop.tools.<id>`, `settings.comfort.colours.<id>`, `map.types.<kind>` and the rest) were checked by id. Every refusal id maps to a line with no placeholder left when a Hob, a shot and a Doodad are given.
- **Test words.** A script filled the same lines the tests ask for and compared them: all match `text.json`.
- **Content decoding.** All 12 level files, 30 shots, 13 Hobs, 6 classes, 2 Doodads, `app.json`, `blueprints.json` and `starter_box.json` fit the Swift `Decodable` shapes (no wrong type, no missing field).
- **Assets.** All 366 clips parse. `random_start` and `start_offset_ms` are there, and the `_rival_` clips and frames. Every sound id the code plays is in `audio.json`. The @2x atlas index and page fit `AtlasIndex` and `AtlasPage`.
- **Core words.** The Workshop reasons in `core/castle-core/src/castle.rs` ("no support", "Nooks for", "must be walled", "Block Budget", "outside") match what `WorkshopGrid.plainWords` looks for. The core's rules version is 5. `cp_daily_seed` is in the header.
- **Camera tests.** The plan frame, small frame and Fine Tune tests were run in a small Python copy of the camera maths on the new fixture: all pass (blocks draw at 8.25 pt in phone landscape; 8 is needed).
- **Main actor.** Static members of SwiftUI views are main actor under the iOS 18 SDK. Every test that reads one (`PipRow.fill`, `BestShotLine.text`, `HandOffCard.metrics`, `DuelSetupView.metrics`, `DuelSetupView.sillyNames`, `LensLayer.crushedScale`, `Camera`) is `@MainActor`. The ones read from plain code (`BrokeView.shotWords` and friends, `BattleSession.refusalText`, the Creaks lines) are `nonisolated`.
- **`TerrainGrid`** is now `@MainActor`. Every user is a main actor type or an `@MainActor` test.
- **`CoreHost.sync`** now wants a `@Sendable` closure with a `Sendable` result. Every call site gives one.
- **iOS 16.** No API newer than iOS 16 is used. `onChange` keeps the one-value form.
- **Names.** No type is declared twice. The test module name is `CastleProtect`, as in `project.yml`. The 16 tests the workflow names all exist; there are 179 test methods (140 are needed).

## Not sure without a compiler

- **Type-check time.** The long SwiftUI bodies (`WideHud`, `TallHud`, `ShellInspectCard`, `draftingBoard`, `KnackFallbackIcon`) read as valid, but only a build shows whether one line is too slow to check.
- **Mixed literal warnings.** A few tests assign mixed dictionary literals to `Any` without `as [String: Any]`. Swift gives a warning there, not an error, when the literal sits inside a larger expression. The last green build had the same form.
- **Real-core tests.** They read as right against the core source, but they only run on CI.
- **Rival banner.** One Rival turn in four shows a `rivals.banner.thinking` line. No test pins it.
- **UI tests.** The two launch tests rely on the `play`, `fire`, `pause` and `resume` ids, which are all still set.

## Second pass

The first pass missed two real errors, both fixed before this pass: `App/AppModel.swift:473` (an unlabelled tuple after `??`, then `.mates` and `.rival`) and `UI/WorkshopView.swift:215` (`frame(minWidth:height:)`, which SwiftUI does not have).

This pass read every Swift file under `apps/ios/CastleProtect` (33 files) and `apps/ios/Tests` (11 files) again, line by line, with the list of new lines since `ff3f679` beside it. Still no compiler on this machine, so nothing was built. Nothing was committed.

### What was checked this time

- Every SwiftUI modifier call in `UI/` was listed by name and labels (a script) and each shape was checked against iOS 16: `frame` (no call mixes fixed and flexible sizes now, and labels are in order), `padding`, `overlay` and `background` with `alignment`, `mask`, `stroke` on shapes and on the Canvas context, `foregroundStyle` and `fill` with ternaries (both sides the same type), `onChange` (one value form), `confirmationDialog`, `alert`, `keyboardShortcut`, `italic`, `scrollContentBackground`.
- Every call to a function declared in this repo was checked against its declaration for labels and order (a script, then by eye for the names the script could not tell from system names). Every `Type.member`, `session.`, `hud.`, `fx.`, `model.`, `catalog.`, `layout.`, `snap.`, `Theme.`, `palette.` member used in the app and the tests exists on that type.
- Every memberwise call (`ShotChip`, `LevelInfo`, `BattleSetup`, `CoreSideConfig`, `BattleLayout`, `WorkshopCheck`, `AnimClip`, `DraftChip`, `BattleResult`, `ResultInfo` and the views) against the property order.
- Tuples: every `??`, ternary and `map` that gives a tuple, and every `.0`, `.1` and label read after one.
- Main actor: every test that touches a main actor type or a view's static member is `@MainActor`; every static read from plain code is `nonisolated`. `TerrainGrid` is only used from main actor types. Every closure handed to `CoreHost.sync`, `run` and `background` takes only `Sendable` values. Every `static var` is in a main actor type; every `static let` is `Sendable`.
- Brackets balance in all 44 files. No type is declared twice.

### Certain compile errors found

None beyond the two above.

### Likely or unclear, made plain

Each of these read as valid but leaned on a rule that is easy to get wrong without a compiler, or was a long line that could time out. Each now says its types out loud. Behaviour is the same.

| # | File and line | Risk | Fix |
|---|---|---|---|
| 1 | `UI/HudParts.swift:976` | `@State private var holdTask: Task<Void, Never>?` had no start value. A private wrapped property with no start value can make the memberwise init private, and `PassButton(session:)` is called from `BattleView.swift`. | `= nil`. |
| 2 | `UI/HudParts.swift:2` | `UIAccessibility` used with only `import SwiftUI`. | `import UIKit`. |
| 3 | `UI/HudParts.swift:462`, `:555` | An `if` in a view builder with four `\|\|`, three `??` and four number literals. | Moved to `hasStats`, built in steps. |
| 4 | `UI/HudParts.swift:483`, `Core/ContentCatalog.swift:83` | `switch` on an optional string with plain string cases. | `switch (x ?? "").lowercased()`. |
| 5 | `App/AppModel.swift:473`, `:488` | The bark context after `??`. | Both sides typed `(mates: [String], rival: String?)`. |
| 6 | `App/AppModel.swift:793`, `Battle/FieldFX.swift:595`, `:822`, `Battle/BattleSession.swift:770`, `UI/MapView.swift:10` | Two or three `first { }` closures joined by `??` in one line. | Typed steps with `first(where:)`. |
| 7 | `Battle/BattleSession.swift:1146` | An unlabelled tuple from `map` joined to a labelled list. | The closure returns `(id: String, label: String)`. |
| 8 | `Battle/BattleSpriteView.swift:112` to `:118` | `0` or a `UInt64` in a ternary, then six `!=` in one line. | `UInt64` written out; the line split in three. |
| 9 | `Battle/BattleSpriteView.swift:491` | `CGFloat / Double` in one line. | `Double(worldRect.midX)`. |
| 10 | `Battle/BattleSpriteView.swift:819` | A closure with nine operators and four literals. | Four named edges and a typed closure. |
| 11 | `Battle/BattleSpriteView.swift:293`, `:1080` | A `Hashable` struct declared inside a static method of a main actor class. | Moved to file scope (`private struct CellKey`). |
| 12 | `Battle/BattleSpriteView.swift:1610`, `:1687`, `:1783` | A statement that starts with `(` on the line after a call. | A named `UIColor`, then `.setFill()`. |
| 13 | `Battle/BattleSpriteView.swift:1981` | A static method called with no type name inside a static `let`. | `BattleArtCache.hobFallbackTexture(...)`. |
| 14 | `Battle/FieldFX.swift:1098` | A closure with `abs`, an enum case with no type and three literals. | A typed closure in steps. |
| 15 | `Battle/SpriteAtlas.swift:110` | A stored property `overlays` and a method `overlays(for:)` in one class. | The property is `overlayTable`. |
| 16 | `Core/CoreModels.swift:173` | A ternary of two tuples of number literals. | `if` and `else`. |
| 17 | `Core/GameText.swift:145` | A closure over a dictionary entry with `== .line(name)`. | A typed closure with guards. |
| 18 | `Core/WorkshopGrid.swift:286`, `:300` | `Self.` inside a `@Sendable` closure in a main actor class. | `WorkshopChecker.validateOnCore`. |
| 19 | `Save/SaveStore.swift:45` | `queue.sync` with a many-line closure and no result type. | `return queue.sync { () -> SaveData in`. |
| 20 | `UI/MapView.swift:360` to `:372`, `:660` to `:672` | `cos` and `sin` mixed with `CGFloat` and literals; a nested ternary of `tx` calls inside `Text(...)`. | Typed locals; the line is built before the view. |
| 21 | `UI/Theme.swift:630` | The same `cos` and `sin` mix. | Typed locals. |
| 22 | `Tests/CastleProtectTests/AuditFixTests.swift:175` | Six `abs` compares in one closure. | A small `near` helper. |
| 23 | `Tests/CastleProtectTests/RedesignPartTwoTests.swift:148` | `Data.withUnsafeBytes { buf in` fits two overloads. | `(buf: UnsafeRawBufferPointer)`. |
| 24 | `UI/Theme.swift:178`, `:217` | `makeBody` had `let` lines and then a view with no `return`. That only works because the protocol marks it as a view builder. | `return` written out. |

### Still not sure without a compiler

- **Type-check time.** The long view bodies (`WideHud`, `TallHud`, `ShellInspectCard`, `draftingBoard`, `PreBattleContent`) and the Canvas drawing in `KnackFallbackIcon` read as valid. Only a build shows whether one line is too slow.
- **Strict concurrency.** The rules were followed as written above, but Swift 6 can still flag a capture that looks fine on paper. The new `FrameClock`, `DisplayLinkProxy`, `SoundCleanupBag` and `ViewObserverBox` are the newest code of that kind.
- **A real check is possible.** A Swift 6 toolchain for Linux can be fetched on this machine and would type-check the files with no SwiftUI or SpriteKit in them (`Core/`, `Save/`, `BattleLayout`, `Animations`). Running it was not allowed in this session.
