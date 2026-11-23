# iOS text pass

The iOS app now reads every line a player sees or hears from `content/text.json`, and every name from the content JSON. It follows `docs/review/naming-decisions.md` and `content/text.md`. Nothing was committed.

No Mac or Xcode was used. The app was not built here. See "Not checked" at the end.

## How text gets into the app

`project.yml` already copies the whole `content/` folder into the app as a folder resource. `content/text.json` rides along with it, at `content/text.json` in the bundle. No change to `project.yml` was needed. The new Swift files sit under `CastleProtect/` and `Tests/CastleProtectTests/`, so XcodeGen picks them up.

## What changed

1. **One string table.** New `Core/GameText.swift` loads `text.json` once. It skips `_` keys, fills `{placeholders}`, picks from pools (never the same line twice running), and does `one` and `other` plurals. `byId` looks up an id the core sends, then `default`. `complete` gives nil when a line needs a name we do not have. `tx(key, vars)` is the short form.
2. **Names from content.** Classes, Doodads and Hobs come from `classes.json`, `doodads.json` and `hobs.json`. Short names come from `hobs.<id>.short`, so Old Thumper and Miss Quill are never cut. Class `delver` shows as Digger.
3. **Copies removed.** The "Best vs" table is gone. The shell card shows the content card line and `shell_card.good_at` with `shots.<id>.good_at`. The silly-name list (with Rolo) is gone; the dice read `names.duel`. The Doodad blurbs are gone. Hard-coded titles, buttons, banners, pause, hand-off, results, Workshop and Settings lines now come from the table. "Rules core", "Save counter" and "Data Not Collected" are off the About tab.
4. **Core ids to keys.** Refusals map to `hud.why.*` and a few other keys (`BattleSession.refusalKey`). A line that needs a name falls back to the core's own words, then to `errors.move_failed`. Blows read `results.blow.<by>`. The Creaks lines replace the core's "Fatigue" text.
5. **Results.** Campaign win: `levels.<id>.win_title`, then `results.win.how`, then a Rival `sign_off`. Other wins: `results.win.title.<how>`. Loss: `results.loss.title`, the cause if it differs from the title, then a Hetty verdict, named only once 1-7 is cleared.
6. **VoiceOver.** The shot line uses the Hob's name (`a11y.shot_summary`, `a11y.shot_missed`), then the round and turn, then the wind.
7. **Barks.** `barks.json` is read with `with_mate`, `with_rival` and `chance`, plus `events.<event>.chance`. Mate lines join the pool only when that Hob is on the crew. Rival lines only against a named Rival, with the short name. `crew.win` shows once after the Hob win line.
8. **Sound cues.** `lid_block` plays `doo_lid_bounce`, `buried` plays `hob_buried_thlup`, `boss_phase` plays `cas_boss_horn`, `front` plays `wx_front_chime` (with a soft `wx_wind_shift`), `threaded` plays `hit_threaded_zip`, `roller` plays `doo_roller_rumble`, `roller_stop` and `roller_done` play it 3 semitones down, `shears_jam` plays `doo_shears_jam`. `wx_squall_bell` plays only on `squall_warning` and the first `squall_round`.
9. **Rival look.** A content Hob on the Rival side uses `hob_<name>_rival_*` clips (orange if an old atlas lacks them). Couch Duel player 2 stays orange. Neat Brigade units stay Flatteners. `SpriteImages.portrait` can give `portrait_<name>_rival`.
10. **Idle start.** `random_start` and `start_offset_ms` are read from `animations.json`. Each Hob's idle starts at a random point in the loop, or at its offset.
11. **Rival data.** `rival.name`, `rival.habit`, `rival.think_ms` and `rival.roster` are read. Skirmish and Daily show `roster[seed % count]` before the fight and `hud.names[1]` during. The pause before each Rival turn reads `hud.think_ms[1]`, then the level's `think_ms`, then `app.json` `rival_think_seconds`. Pennant goals follow text.md (level line, then `pennants.<type>`, then the level file). The level card shows the Notice of Flattening.
12. **Workshop fort.** The Workshop already starts from `bp_home_3` in `content/blueprints.json`. The hard-coded rows are only a fallback when that file is missing.
13. **Rules version 5.** The stand-in core says rules 5, and the tests that pin the version now say 5. `cp_daily_seed` returning 0 already falls back to a local hash.

## Files edited

App code, under `apps/ios/CastleProtect/`:

- `Core/GameText.swift` (new)
- `Core/ContentCatalog.swift`
- `Core/CoreModels.swift`
- `Core/FrameAssembler.swift`
- `Core/CoreGame.swift`
- `Core/CoreProtocol.swift`
- `Core/BattleSetup.swift`
- `Core/WorkshopGrid.swift`
- `Core/FakeCoreBridge.swift`
- `Battle/BattleSession.swift`
- `Battle/FieldFX.swift`
- `Battle/Animations.swift`
- `Battle/SpriteAtlas.swift`
- `Battle/BattleSpriteView.swift`
- `Feedback/SoundEngine.swift`
- `App/AppModel.swift`
- `Save/SaveData.swift`
- `UI/BattleView.swift`
- `UI/HudParts.swift`
- `UI/MapView.swift`
- `UI/ResultsView.swift`
- `UI/DuelSetupView.swift`
- `UI/SettingsView.swift`
- `UI/RootView.swift`
- `UI/WorkshopView.swift`

Tests, under `apps/ios/Tests/CastleProtectTests/`:

- `GameTextTests.swift` (new): loads `text.json` and fills keys with placeholders, plurals, pools, ids, short names, refusal lines, goals and roster, bark options, idle start and the Rival team
- `QAPlaytestOneTests.swift`, `QAPlaytestTwoTests.swift`, `AuditFixTests.swift`, `ReviewFixTests.swift`, `CoreV02Tests.swift`, `RedesignPartTwoTests.swift`: text expectations that changed on purpose, and rules 5

## Checks run here

- `swiftc` is not in the container, so no `swiftc -parse` was possible.
- Every JSON file in `content/`, `content/levels/`, `assets/audio/audio.json`, `assets/audio/barks.json` and `assets/animations.json` parses.
- A script checked every literal key the Swift code asks for: all exist in `text.json`. It also checked that each call passes the placeholders its line needs. The keys built at run time (by id or raw value) were checked by hand.
- A script checked that brackets, braces and parentheses balance in every Swift file.

## Not checked without Xcode

- **It has not compiled.** Main risks: type checking of the long `tx(...)` calls with mixed `Int` and `String` values in `[String: any CustomStringConvertible]`; static members on SwiftUI views being main actor under the iOS 18 SDK (the new test that reads `DuelSetupView.sillyNames` is marked `@MainActor`); the new `AnimClip` fields in its memberwise init.
- **Real core words.** The Workshop maps the core's `validate_blueprint` detail to `workshop.problems` by matching words ("no support", "nooks for", "walled"). If the core words differ, the player sees "Fix the red bits first." and two real-core Workshop asserts would fail.
- **Fixture names.** `AuditFixTests` expects "You skipped a go"; this needs the fixture's first name to be "You", as the old "You passed" did.
- **Daily Rival.** The Daily sheet assumes the core picks the Daily Rival from the `d1` roster with the same seed rule as Skirmish.
- **Rival banner.** One Rival turn in four (at most) shows a `rivals.banner.thinking` line in place of "{rival} aims". No test pins the Rival banner, but a future one should allow both.
- **Atlas.** The Rival clips must be in the @2x atlas the build copies. If not, the Rival's Hobs fall back to orange.

## Not done

- Rival taunts (`rivals.<key>.taunts`) and sound captions (`captions`) are in the table but not shown yet.
- The two-banner look (weather sign and Flattener notice) still uses the old banner colours; only the Squall and the Creaks have their own.
- Small field words (`notes.*`) are used for Drop!, Mended and Rebuilt only.
- Rival portraits are wired in `SpriteImages.portrait` but the HUD only shows your own crew, so nothing calls them yet.
