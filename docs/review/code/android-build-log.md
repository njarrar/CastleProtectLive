# Android build log

The Android app (`apps/android`) is built by the `android` workflow
(`.github/workflows/android.yml`) on GitHub Actions in the public repo
njarrar/CastleProtectLive. CI is the only place the real Rust `.so` files are built
(cargo-ndk for arm64-v8a, armeabi-v7a and x86_64) and the only place the JNI bridge
tests run against the real core on the host.

## Core v0.2 pass

| # | Run | Result | Cause | Fix |
|---|---|---|---|---|
| 15 | [45040088582](https://github.com/njarrar/CastleProtectLive/actions/runs/45040088582) | Failed | Pushed by the core pass, before the Android app moved to v0.2. | This pass. |
| 16 | [45041396672](https://github.com/njarrar/CastleProtectLive/actions/runs/45041396672) | Failed | Gradle could not resolve the Android Gradle Plugin's dependencies from Maven Central (every POM "not found"), a network fault on the runner. The same files resolved on the next run with no change. | None needed. |
| 17 | [45042076703](https://github.com/njarrar/CastleProtectLive/actions/runs/45042076703) | Cancelled | Superseded by run 18. | None. |
| 18 | [45042113973](https://github.com/njarrar/CastleProtectLive/actions/runs/45042113973) | Passed | | |

Locally the stale `SnapshotParserTest` shell position (v0.1 fixture values) was found
and fixed before the push: the test task had been reported up to date, because the
fixture files are read from the repo path and are not Gradle inputs.

## Final green run

- Run: https://github.com/njarrar/CastleProtectLive/actions/runs/45042113973
- APK artifact: `castle-protect-debug-apk` (debug APK, about 27 MB, with
  `libcastle_jni.so` and `libcastle_ffi.so`; 16 KB page alignment and zip alignment checked)
- Reports artifact: `castle-protect-android-reports`

Every step passed: the core built for Android, the host core and JNI shim built for
the unit tests, `testDebugUnitTest lintDebug assembleDebug` with
`-Pcastle.requireNative=true`, and the APK native library checks.

Unit tests in that run: 54, 0 skipped, 0 failed.

| Suite | Tests | What it covers |
|---|---|---|
| NativeHostTest | 4 | The real shim and core: fixture replies and hash, emoji names, a bad setup's reason, log replay |
| LiveBattleTest | 4 | Dead handle recovery (a panic, then `cp_new` plus `resume` from the kept log and the last aim; giving up after 3 failures), and on the real core: `resume` gives the same hash, `give_up` ends with `how: "give_up"` |
| CoreV02Test | 6 | New HUD fields, the full result with `broke`, boss and Rescue fixtures, the lean `aim` snapshot, collapse and walk event fields, `panic` and `dead_handle` snapshots |
| AnimsAudioTest | 11 | All 212 animations load with real frames, play order, events, `loop_from`, `next`, `hold`, backwards; all 140 sounds and both formats exist; every cue the app plays is in `audio.json`; barks and subtitles; music layer rules; hit stop, slow motion and shake rules; blocks at least 8 dp in landscape; trails |
| ContractTest | 4 | Every command (`give_up`, `set_wind`, `resume` included) and setup (Help, `preview_pct`, `volley`, `progress`) against `core/schema` |
| Others | 25 | Snapshot parser, JSON reader, saves, camera limits, fixture player |
