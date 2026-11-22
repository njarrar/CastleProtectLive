# iOS build log

The iOS app (`apps/ios`) was first compiled by the `ios` workflow on GitHub Actions
(`macos-latest`, Xcode 26.6, iPhone simulator) in the public repo
njarrar/CastleProtectLive. This log lists each run and the fix that followed it.

| # | Run | Result | Cause | Fix |
|---|---|---|---|---|
| 1 | [45032642993](https://github.com/njarrar/CastleProtectLive/actions/runs/45032642993) | Failed in build | `project.yml` listed `../../assets/sounds` as a folder resource. `optional: true` still adds the reference, and the folder does not exist yet, so the resource copy failed ("The file sounds couldn't be opened"). | Removed the folder reference and added a `Copy sounds` post-compile script that copies `assets/sounds` into the bundle only when it exists. |
| 2 | [45032878269](https://github.com/njarrar/CastleProtectLive/actions/runs/45032878269) | Cancelled | Superseded by run 3. | None. |
| 3 | [45032962282](https://github.com/njarrar/CastleProtectLive/actions/runs/45032962282) | Failed in Swift compile | A stale `Core/CoreCommand.swift` was still in the public repo (the sync copies files but never deletes them). It redeclared `CoreCommand`, `BattleSetup`, `Preset` and the other setup types, which caused 58 "invalid redeclaration" and "ambiguous for type lookup" errors. | Deleted the stale file from the public repo. The private tree never had it. |
| 4 | [45033289521](https://github.com/njarrar/CastleProtectLive/actions/runs/45033289521) | Passed | Build and tests passed on the first full compile. Swift 6 strict concurrency gave no errors. | Added a workflow step that fails the job if the build used the stand-in core or if the real-core tests (`testRealCoreWhenLinked`, `testRefusedSetupIsReported`) were skipped instead of passing. The test step now prints every test case line. |
| 5 | [45034243343](https://github.com/njarrar/CastleProtectLive/actions/runs/45034243343) | Cancelled | Superseded by a newer push to main. | None. |
| 6 | [45034588325](https://github.com/njarrar/CastleProtectLive/actions/runs/45034588325) | Passed | | |
| 7 | [45040088579](https://github.com/njarrar/CastleProtectLive/actions/runs/45040088579) | Failed | Core v0.2 landed under the v0.1 app (the core push, before the iOS alignment). | The v0.2 alignment below. |
| 8 | [45042076694](https://github.com/njarrar/CastleProtectLive/actions/runs/45042076694) | Failed in Swift compile | First push of the v0.2 alignment, animations, juice, audio and camera: `CoreCastle` had no `fatigue` field. | Decoded `castles[].fatigue`. |
| 9 | [45042383213](https://github.com/njarrar/CastleProtectLive/actions/runs/45042383213) | Failed: 1 of 72 tests, privacy check | `testWalkAndKettlePopAnimate`: the kettle pop's hit stop and slow motion read the wall clock, so a test driving the clock by hand froze view time. The privacy check found `fstat` (Rust std, new in core v0.2) and `mach_absolute_time` (the music start time). | `FieldFX` keeps the real time it is handed and never reads the wall clock. Music layers start and find bar lines on the engine's sample clock, so no `mach_absolute_time`. `PrivacyInfo.xcprivacy` declares File Timestamp (C617.1). The test step now also prints `: error: ` lines. |
| 10 | [45043885750](https://github.com/njarrar/CastleProtectLive/actions/runs/45043885750) | Passed | | |
| 11 | [45044352325](https://github.com/njarrar/CastleProtectLive/actions/runs/45044352325) | Passed | UI sounds for Fire, drag start and refusals. Final green run: build, 72 unit tests and 2 UI tests on the real core, the 7 required real-core tests, Release device build and privacy check. | |

## What the green run proves

- `scripts/build-xcframework.sh` builds `castle-ffi` for `aarch64-apple-ios` and
  `aarch64-apple-ios-sim` and writes `CastleCore.xcframework`.
- The `Core module map` build phase found the `ios-arm64-simulator` slice and linked
  the real core ("Linking the real core from ..."), so `canImport(CastleCoreFFI)` is true
  and `FFICoreBridge` is compiled.
- 33 unit tests passed, including `CoreGameTests.testRealCoreWhenLinked` and
  `testRefusedSetupIsReported` against the Rust core, with none skipped.
- 2 UI tests passed: launch and tap Play, and open and resume the Pause card.
- The simulator `.app` is uploaded as the `castle-protect-ios-simulator-app` artifact.

## Notes for later

- The public sync script copies tracked files but does not remove deleted ones. A file
  deleted in the private repo must also be deleted in the public repo by hand.
- When `assets/sounds` is added, the `Copy sounds` phase picks it up with no project
  change.

## Core v0.2, animation and audio (final green run)

Final green run: https://github.com/njarrar/CastleProtectLive/actions/runs/45044352325

- `CoreProtocol` and `CoreGame` follow core v0.2: 64 cell chunks, lean `aim` snapshots, `give_up`,
  `set_wind`, `resume` (saves load with the core's own replay), setup `help`, `preview_pct`,
  `volley`, `progress`, HUD `steam_max`, `shove_off_cost`, `shots`, `handicap`, `volley`, `boss`,
  `rules`, result `pennants_new`, `buttons`, `score`, `stats`, `broke`. A `panic` or `dead_handle`
  reply rebuilds the battle with `cp_new` plus `resume` from the log kept at each turn start (at
  most twice a battle, then the fight stops with a notice).
- Required real-core tests now also include `testGiveUpOnTheRealCore` and
  `testHelpVolleyAndBossSetupsStart`.
- 72 unit tests and 2 UI tests passed, none skipped.


## Review 2 fixes

| # | Run | Result | Cause | Fix |
|---|---|---|---|---|
| 12 | [45047453012](https://github.com/njarrar/CastleProtectLive/actions/runs/45047453012) | Cancelled | Superseded by run 13 (the own-fort aim rule). | None. |
| 13 | [45048275843](https://github.com/njarrar/CastleProtectLive/actions/runs/45048275843) | Failed in tests | The new core thread ran `sync` work inside `withoutActuallyEscaping`; the thread's job queue still held the closure when the caller returned, so the runtime trapped ("closure argument was escaped"). Each trap restarted the test runner. | `CoreHost.sync` takes an escaping closure. |
| 14 | [45050397036](https://github.com/njarrar/CastleProtectLive/actions/runs/45050397036) | Failed: 1 test | `testEveryCoreCallRunsOnOneThread` saved after a Rival turn; the stand-in does not log `ai_turn`, so its replay hash differed. The debug core step passed (4 real-core tests, no `wrong_thread`). | The test saves and replays before the shot. |
| 15 | [45052238644](https://github.com/njarrar/CastleProtectLive/actions/runs/45052238644) | Passed | | |

Final green run: https://github.com/njarrar/CastleProtectLive/actions/runs/45052238644

- 93 test cases passed (unit and UI), none skipped; the run now fails below 85.
- Required real-core tests now also include `testLeanAimReachesTheHudOnTheRealCore` and
  `testCouchDuelAfterReadyOnTheRealCore`.
- New step "Thread rule on a debug core": builds the core with `--dev` (the `wrong_thread` check on)
  and runs `testRealCoreWhenLinked`, `testMultiTurnReplayMatchesTheHash` and the two lean HUD tests. All pass.
- Privacy check: `fstat` (File Timestamp, declared) is still the only hit; `NSUserDefaults` is now checked
  too and is not used. The `nm` probe for which archive member imports `fstat` printed nothing on this
  runner (the release archive path did not match), so the source stays as review 2 found it: Rust std's
  panic and backtrace code, not the rules. `PrivacyInfo.xcprivacy` says so in a comment.
