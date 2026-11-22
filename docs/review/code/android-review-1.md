# Android code review 1

Scope: `apps/android/` only, at commit `a059af9` plus the working tree on 2026-11-22. No code was changed.

How it was checked:

- Read every source file in `apps/android/`.
- Ran `./gradlew assembleDebug testDebugUnitTest` with `ANDROID_HOME=~/android-sdk`. Both pass. 2 unit tests, 0 failures. The APK has no `libcastle_jni.so`, so it runs on `FakeCore`.
- Compiled `castle_jni.c` with host gcc (`-Wall -Wextra -fsyntax-only`) against a stub header that matches the ABI the shim expects. It is clean. No NDK is installed here, so the real CMake build was not run.
- Compared the shim and `Snapshot.kt` with the core that is now in the tree (`core/castle-ffi/src/lib.rs`, `core/castle-core/src/snapshot.rs`, `battle.rs`).
- Nothing was run on a device or emulator. Findings on crashes, input and TalkBack come from reading the code. The action versions in `android.yml` could not be checked from here.

Paths below are relative to `apps/android/app/src/main/` unless they start with `apps/`, `core/`, `scripts/` or `.github/`. Kotlin files are under `kotlin/games/castleprotect/`.

Counts: 2 critical, 8 high, 16 medium, 16 low.

---

## Critical

### C1. The app cannot talk to the real core, and the build hides it

Files: `cpp/castle_jni.c:5-15, 52-103`, `apps/android/app/build.gradle.kts:16-28`, `core/NativeCore.kt:11-29`, `core/CoreBridge.kt:46-69`, `core/Snapshot.kt:91-173`, `game/GameSession.kt:70-79, 156-177`

What is wrong. The shim and the Kotlin bridge were written against a guessed core. The core that has now landed is different in every layer.

| Layer | Android expects | Core has |
|---|---|---|
| C names | `castle_new`, `castle_command`, `castle_advance`, `castle_snapshot`, `castle_query`, `castle_save`, `castle_load`, `castle_string_free`, `castle_free` | `cp_new`, `cp_command`, `cp_step`, `cp_snapshot`, `cp_last_error`, `cp_version`, `cp_golden_hashes`, `cp_free_string`, `cp_free` |
| Start | `castle_new(void)`, then a `new_battle` command | `cp_new(content_json, level_json, seed)`, one handle per battle |
| Time | `castle_advance(ms)` | `cp_step(ticks)`, returns a string that must be freed |
| Save, load, menu query | three calls | none in the C ABI |
| Commands | `pick_shell` (shot), `draft_pick`, `ready`, `abandon`, `speed`, `new_battle` | `pick_shot` (shot), `pick_shell` (draft pick), `pass`, `ai_turn`, `doodad`, `shove_off`; no `ready`, `abandon`, `speed`, `new_battle` |
| Snapshot | `forts[]` with `blocks` and `hobs`, `world`, `terrain` as a height list, `active_side`, `turn_seq`, `shots`, `aim`, `can_fire`, `handoff`, events with `type` and `cue` | `castles[]`, top level `hobs[]`, `map`, `terrain.chunks` as base64, `side`, `hud.turn`, `hud.hands`, per Hob `aim`, events with `t`, result with `how` |
| Phases | `pre`, `plan`, `flight`, `resolve`, `handoff`, `ended` | `draft`, `plan`, `resolve`, `settle`, `ended` |

Failure scenario. CI runs `scripts/build-android-libs.sh`. `build.rs` writes `castle_core.h` with the `cp_` names. `build.gradle.kts:19` finds no `castle_` name in it, sets `nativeCore = false`, prints one warning and builds on. The APK ships three copies of `libcastle_ffi.so` (it sits in the default `jniLibs` folder, about 2 to 4 MB each) that nothing loads, no `libcastle_jni.so`, and runs the toy rules. `android.yml` is green. If someone only renames the C calls, `Snapshot.parse` reads `forts` as empty and every battle draws a blank sky with no error, because every field uses `opt...` with a default.

Suggested fix.
1. Agree one contract first. Write `core/API.md` (the file `Snapshot.kt:8` points at does not exist) and treat it as the source for all three apps.
2. Add what Android needs to `castle-ffi`: save, load, menu queries, and a ms or tick rule. Or change `GameSession` to own one handle per battle and keep campaign progress through the core's own save bytes.
3. Rewrite `castle_jni.c`, `Cmd` and `Snapshot.kt` to match, then add a test that parses a snapshot file made by the Rust core (a golden JSON in `core/castle-core/tests/golden`), so drift fails a test and not a player.
4. Make the build fail, not warn, when CI expects the core: for example `-Pcastle.requireNative=true` in `android.yml` whenever `steps.check.outputs.core == 'true'`.
5. Make `Snapshot.parse` loud in debug builds when a must-have field is missing.

### C2. Panning the field, or a deep shot, crashes the render thread

Files: `battle/BattleRenderer.kt:118-129`, `battle/BattleView.kt:185, 226-229, 246-251`

What is wrong. `i0` is clamped at 0 but not at `n - 1`:

```kotlin
val i0 = max(0, (l.wx(rc.left) / step).toInt() - 1); val i1 = min(n - 1, ...)
...
path.rewind(); path.moveTo(l.sx(i0 * step), l.sy(s.terrain[i0]))   // line 129
```

When the left edge of a lens is past the right end of the world, `i0 > n - 1` and `s.terrain[i0]` throws `ArrayIndexOutOfBoundsException`. Nothing catches it on `castle-render`, so the app dies. Two ways to get there:

- Pan. `panX` and `topPan` have no limits (`BattleView.kt:228, 248-249`). In the Wide layout during the Rival's turn or a flight, swipe left twice with one finger. In the Tall layout, swipe left twice in the Top lens.
- Scale goes below zero. `BattleView.kt:185` does `scale = min(scale, clearH / (sh.y - base + 110f))`. When a shell drops more than 110 cells below the lower fort (both forts on hills, shot lands in the valley; the stand-in terrain allows a drop of about 150), the divisor is negative, so the scale is negative. Then `wx(rc.left)` is a huge positive number and `i0` is far out of range. Before the crash the picture also flips.

Suggested fix. Clamp `i0` and `i1` to `0..n-1` and skip the ground when `i0 > i1`. Clamp `panX`, `panY`, `topPan` so the lens centre stays inside the world. Use `max(1f, sh.y - base + 110f)` and never let a lens scale go below a small positive floor. Wrap `drawFrame` in a try/catch that logs and skips the frame, so one bad frame cannot kill the app.

---

## High

### H1. A release build can ship the stand-in core, and the two cores share one save file

Files: `core/CoreBridge.kt:42`, `core/NativeCore.kt:31-37`, `core/FakeCore.kt` (in `main`), `apps/android/app/build.gradle.kts:21-28`, `game/SaveStore.kt:12`

What is wrong. `Core.create()` falls back to `FakeCore` on any `UnsatisfiedLinkError`, in every build type. `FakeCore` is in the `main` source set, so it is in release APKs. Both cores read and write `files/save/castle.sav`.

Failure scenario. A release goes out with a broken `.so` for one ABI (see M12), or without the libs at all. Players on that phone get toy rules with no sign of it. `FakeCore.load` refuses the real save, and the next autosave writes a stand-in save over it. All campaign progress is gone. The update that fixes the lib then refuses the stand-in save.

Suggested fix. Move `FakeCore` to `src/debug` (or gate it with `BuildConfig.DEBUG`). In release, a failed load of the native lib should stop with a clear error. Fail the Gradle release build when `nativeCore` is false. Tag the save file with the core that wrote it, or use two file names.

### H2. A save that fails to load is silently replaced

Files: `game/GameSession.kt:69-80, 156-159`, `game/SaveStore.kt:14, 17-27`

What is wrong. If `saves.read()` returns text and `core.load(data)` returns false, nothing happens. The core stays empty. The next `saveNow()` (first turn, or `onStop`) writes the empty state over the file. `read()` also turns every error, even a short read, into "no save".

Failure scenario. An app update changes the save format, or the player moves back to an older build through device restore. `load` returns false. The player sees a fresh map. They press Home. `onStop` saves. The old file, which a later fix could have read, is gone. Auto Backup then uploads the empty one.

Suggested fix. On a failed load, rename the file to `castle.sav.bad-<time>` before any write, keep the last good copy as `castle.sav.prev` on every successful write, and tell the player. Have the app check a format version and size before it hands the bytes to the core. Do not save at all until a load has either worked or been set aside.

### H3. The save in `onStop` may never reach the disk

Files: `game/GameSession.kt:91-97, 156-159`

What is wrong. `onStop` calls `saveNow()`, which hands the write to a background executor and returns. `onStop` is the last call the system promises. After it returns the process can be killed at any time.

Failure scenario. Player makes walks and picks in a turn, then swipes the app away from Recents. The process dies before the `io` thread runs. The file still holds the state from the turn start, or from the turn before if that write was also queued.

Suggested fix. In `onStop`, write on the calling thread (a 10 to 40 KB `AtomicFile` write is a few ms), or submit and `get()` with a short timeout. Keep the async path for the per-turn autosave only.

### H4. "Carry on" survives a new battle and an abandon, and the kept battle is lost without a word

Files: `game/GameSession.kt:187-197, 199-209, 234-238, 251-255`, `ui/Menus.kt:81-85, 144`

What is wrong. `leaveBattle()` sets `canResume = true`. `openLevel`, `startPre` and `goBack` from Pre-battle never clear it, and never ask before they replace the battle in the core.

Failure scenario. Pause, "Save and leave". On the map, tap a level. The core starts a new battle over the saved one. Press Back: `goBack` sends `abandon`, which clears the battle. The map still shows "Carry on". Tap it: `resume()` shows the Battle screen with an empty snapshot, a blank sky and no controls. The kept battle is gone and the next autosave makes that final.

Suggested fix. Make "can resume" a fact read from the core (a battle is in play), not a flag in the session. Before a new battle replaces one in play, ask, or keep the old one in a second slot. Clear the flag in every path that ends or replaces a battle.

### H5. A held key can stick: the repeat job outlives its gesture

Files: `ui/Theme.kt:143-162`, used by `ui/BattleScreen.kt:325, 424`

What is wrong. The repeat loop is launched in `rememberCoroutineScope()`, and it is cancelled only by the line after `waitForUpOrCancellation()`. When `enabled` flips to false while the finger is down, `pointerInput(enabled, tapOnly)` restarts, the gesture block is cancelled, `job?.cancel()` never runs, and the loop keeps calling `step()` 20 times a second until the key leaves the screen.

Failure scenario. Hold "pow -" until power reaches 0. The key turns off (`hud.aimPower > 0` is false). Lift the finger. The loop still runs. Each run calls `nudge`, which sets `fineOpen = true`, so the pad never folds. Press "pow +": the loop pulls the power back down every 50 ms. The same thing happens with "ang -", "ang +", "pow +" at their limits, and with the Walk keys when Steam runs out (the app then sends `walk` 20 times a second until Fire). The design says a lost pointer must stop the repeat at once.

Suggested fix. Run the repeat inside the gesture scope, or wrap the wait in `try { ... } finally { job?.cancel() }`. Also stop the loop when `step` reports that nothing changed. Add a Compose UI test for hold-to-limit.

### H6. JNI passes modified UTF-8 to Rust, so an emoji in a player name breaks commands and loads

Files: `cpp/castle_jni.c:46-50, 69-74, 86-91, 98-103`, `core/CoreBridge.kt:70`, `ui/Menus.kt:351`

What is wrong. `GetStringUTFChars` gives modified UTF-8. A character above U+FFFF comes out as two 3-byte surrogates, which is not valid UTF-8. The comment at line 46 says this cannot happen, but `JSONObject.quote` does not escape non-ASCII text, and the Couch Duel name field takes anything. `it.take(12)` can also cut a surrogate pair in half. On the Rust side `read_str` turns bad UTF-8 into `""`.

Failure scenario. Player 1 types "Mabel🙂". The command reaches Rust as an empty string and is refused. `startPre` ignores the result (`GameSession.kt:206`), so the Pre-battle screen opens with no battle and a dead FIGHT button. Worse: once names are stored in a save, the save text goes back through the same path at the next launch, the load fails, and H2 wipes the progress.

Suggested fix. Pass bytes, not `jstring`: in Kotlin `json.toByteArray(Charsets.UTF_8)`, in C `GetByteArrayRegion` into a NUL-ended buffer (or pass pointer and length). Return `jbyteArray` the same way. Trim names by code point. Add a unit test with an emoji name.

### H7. The sim thread builds and parses the whole world as JSON about 83 times a second

Files: `game/GameSession.kt:107-124`, `core/FakeCore.kt:353-407`, `core/Snapshot.kt:89-173`

What is wrong. Every 12 ms in battle (every 50 ms in menus, and also while paused) the loop asks for a full snapshot: 201 terrain numbers, about 90 blocks, hobs, pins and ghost paths. It is turned into a string, parsed with `org.json`, and copied into new lists and data classes. Nothing checks whether the sim moved. The loop is not tied to the display, so many snapshots are never drawn.

Failure scenario. On a 2 GB phone this is roughly 20 KB of text and a few hundred small objects per pass, so several MB of garbage a second and a GC every second or two, each one a dropped frame. With the real core the cost is higher (base64 terrain chunks, JNI copies). The phone gets warm on the title screen, where the loop still runs at 20 Hz.

Suggested fix. Step the sim on a fixed clock but take a snapshot only when the tick or a command changed something, at most once per display frame (drive it from `Choreographer` or the render thread). Do not snapshot in menus or when paused. Send terrain only when it changed (the core already drains dirty chunks). Longer term use the byte buffers from `docs/research/04b` section 7.

### H8. The renderer makes a lot of garbage every frame, with regex compiles in the hot path

Files: `battle/Sprites.kt:47-58, 64-68`, `battle/BattleRenderer.kt:92-99, 155, 164, 172, 194, 212-213, 219, 232-234, 246-256, 280, 291`, `battle/BattleView.kt:150, 176`

What is wrong.
- `Sprites.hobKey` builds up to 8 `Regex` objects per Hob per call. `drawFort` calls it for every Hob, for every lens, every frame: with 8 Hobs and 2 lenses that is over 100 regex compiles a frame.
- Sprite names are built with string templates for every block, Hob, shell, pin and preview dot every frame (`"block_${b.mat}_..."` twice per block). Each `sprites.get(...)` also makes a vararg array and takes a lock.
- `floatArrayOf` for the drag, `listOf(...)` for the strip, `withIndex()` and `String.format` are made per frame.

Failure scenario. In the Tall layout with two forts on screen the render thread makes several thousand short-lived objects a frame. On a low-end phone the young GC runs many times a second and the 60 fps target (30 fps floor) is missed during an Aim Drag, which is the moment the player feels it.

Suggested fix. Resolve sprites once per snapshot, not per frame: cache `Sprite` refs by (material, wear), by Hob id and pose, by shell kind. Make `hobKey` a map lookup filled once per battle, or have the core send the sprite key. Reuse one `FloatArray` for the drag and fixed lens arrays. Format the readout text only when angle or power changes.

---

## Medium

### M1. `surfaceDestroyed` can return while the render thread still draws

Files: `battle/BattleView.kt:87-89, 98-116`

`quit()` joins for 400 ms and then gives up. If a frame is slow (first decode of the 2048 x 1024 sky inside `drawFrame`, a GC pause), `surfaceDestroyed` returns while the thread is still between `lockHardwareCanvas` and `unlockCanvasAndPost`. Drawing to a surface after that call returns is not allowed and can crash in native code on some devices. This path runs on every Home press, every screen change away from Battle, and every Tall to Wide switch (the view is moved by `movableContentOf`).

Fix: join without a time limit (a frame is short once decodes are moved off the thread), or guard lock, draw and post with a lock that `surfaceDestroyed` also takes.

### M2. A stale snapshot can overwrite a fresh one

Files: `game/GameSession.kt:114-121, 169-174`

The sim thread reads a snapshot under the lock, then parses and publishes it outside the lock. The main thread can send a command and call `refresh()` in between. The sim thread then publishes its older frame over the newer one and runs `react` on it. Effects: one frame of the old battle on a new screen, `lastTurnSeq` flips back and forth so `saveNow()` runs up to three times, and an old `ENDED` frame after Rematch sets `canResume = false` and bumps `menuEpoch`.

Fix: publish only from one thread (post commands to the sim thread and let it publish), or carry a sequence number and drop frames older than the last one shown.

### M3. The main thread waits on the sim lock, and menu queries run during composition

Files: `game/GameSession.kt:164-177`, `battle/BattleView.kt:298`, `ui/Menus.kt:106`, `ui/BattleScreen.kt:106, 112`

Every `send` and `query` on the main thread takes the lock that the sim thread holds for `advance` plus `snapshot`. With the real core an AI turn inside a step can take 100 to 400 ms on a 2 GB phone. A touch move or a button press in that window freezes the UI for that long. `MapScreen` calls `session.campaign()` inside `remember` during composition, and `GameSession` loads the save on the main thread in its constructor.

Fix: a command queue that the sim thread drains, with replies posted back. Load menu data in a `LaunchedEffect` or a `StateFlow`.

### M4. A battle that is stopped mid-flight cannot be resumed

Files: `game/GameSession.kt:75`, `core/FakeCore.kt:438-441`

`canResume` is true only when the loaded phase is PLAN or HANDOFF. If the process is killed after an `onStop` save taken during a flight or a resolve, and the real core saves that phase as it is, the title shows no "Carry on" and the next level start replaces the battle. The stand-in hides this by saving every live phase as "plan", which has its own fault: the shot is undone but the shell or Knack use is already spent, and a player can redo a bad shot by killing the app.

Fix: treat any phase that is not none or ended as resumable and enter the Battle screen. Decide in the core what a mid-flight save means (the plan says a command log plus turn snapshot).

### M5. Sprites: 384 loose PNGs, about 16 MB for three backgrounds, never freed, decoded on the render and main threads

Files: `battle/Sprites.kt:26-58`, `ui/Theme.kt:181-186`, `game/GameSession.kt:34`, `apps/android/app/build.gradle.kts:86-92`

- The build copies every `@2x` PNG (384 files) and the full 151 KB `manifest.json`. The atlases in `assets/atlas` are not used, so each sprite is its own GPU texture and nothing batches.
- `bg_downs_sky@2x` is 2048 x 1024 (8 MB decoded), the two hill bands are 4 MB each. All sprites decoded come to about 42 MB. The cache lives in the ViewModel for the life of the process and has no `onTrimMemory` path. With a hardware canvas each bitmap also has a GPU copy.
- `get` decodes on first use under one lock: inside `drawFrame` on the render thread (a visible hitch at the first battle and at the first blast), and inside composition on the main thread (`SpriteImage`), which can also wait behind the render thread's decode.
- `Sprites` is built on the main thread at first composition: `assets.list("sprites")` on 384 entries plus a 151 KB JSON parse adds to cold start.

Fix: ship the atlas pages and a slim manifest (name, rect, anchor). Preload the battle set on a worker when Pre-battle opens. Decode backgrounds at a sample size that fits the screen and as `RGB_565` or hardware bitmaps. Drop caches on `onTrimMemory`. Build `Sprites` off the main thread.

### M6. The field redraws at full rate even when nothing moves

Files: `battle/BattleView.kt:101-114`, `battle/BattleRenderer.kt:92-101`

The render loop draws every vsync during the Plan step, behind the Pause card and behind the hand-off card. This is a turn-based game where the picture is still most of the time. In the Tall layout each frame also draws the full sky and both hill bands twice, scaled, plus the HUD on top. Battery and heat suffer on low-end phones.

Fix: draw on demand. Redraw when the snapshot tick, the camera, a drag or an idle animation frame changed, and cap idle animation at 10 to 15 fps. Skip drawing while paused.

### M7. In the Wide layout the top strip sits under the status bar

Files: `ui/BattleScreen.kt:164, 167-168`, `MainActivity.kt:33`

The app is edge to edge and never hides the system bars. The Wide layout pads start, end and bottom but not the top. `hudPad` (line 164) does count the top inset, so the camera and the HUD disagree. On a phone in landscape the clock and battery icons draw over the kettle gauges and the round label, and with a top cutout the strip can be cut off.

Fix: add the top inset to the column, or hide the system bars in battle with `WindowInsetsControllerCompat` (swipe to show) and still pad for cutouts.

### M8. Slow Drag stops after one step

Files: `ui/BattleScreen.kt:110-114, 148, 185, 390-400`

A drag on the readout calls `nudge`. `nudge` always sets `fineOpen = true`. In both layouts the readout is shown only while `fineOpen` is false, so the first step removes the readout from the screen and the drag ends. There is a second fault behind it: `pointerInput(Unit)` keeps the first `nudge` lambda, which holds the first `hud` value, so later steps would be worked out from an old aim.

Fix: give `nudge` a flag so a Slow Drag does not open the pad (or keep the readout in place while a pointer is down on it). Use `rememberUpdatedState` for the callback. Add a UI test.

### M9. Fine Tune steps are worked out from a HUD copy that can be a frame or two old

Files: `ui/BattleScreen.kt:110-112, 411-417`

`nudge` sends an absolute aim made from `hud.aimAngle + da`. The HUD only updates after the sim thread's next pass and a recomposition, about 30 to 50 ms on a slow phone. Two fast taps, or the 20 per second hold repeat, read the same old value, so steps are lost. The tick sound and buzz still play. The key limits (`0..1800`, `0..100`) are also set here and not by the core.

Fix: send a relative command (`nudge` with a delta) and let the core apply it, or keep the last sent aim in the session and step from that.

### M10. Cancelling the first Aim Drag still sets an aim

Files: `battle/BattleView.kt:241, 302-307`

On cancel the view sends `aim(prevAngle, prevPower)`. If there was no aim before the drag (`aimSet` false), this sets one at the default 45 degrees and power 50, and Fire unlocks. The design says the aim returns to what it was. A second finger landing by accident on the first drag of a turn leaves Fire armed with a shot the player never chose.

Fix: remember `aimSet` at drag start and send a `clear_aim` command (the core needs one), or have the core own drag begin, update, commit and cancel.

### M11. TalkBack: the Fine Tune pad times out, cards are not modal, shot results are never spoken

Files: `ui/BattleScreen.kt:91, 102, 194-195, 295, 447, 465`

- The pad folds 4 s after the last nudge (line 102). With TalkBack, moving focus to a key and double tapping often takes longer, so the pad vanishes under the user. The pad is the only way to aim without a drag.
- The hand-off card and the Pause card block touches but not accessibility focus. TalkBack users can still reach and use the controls under them. Behind the Pause card commands are still sent to the core, so a shot can be aimed and fired while "paused". Focus is not moved to the card and there is no pane title.
- Nothing announces where a shot landed or what it hit. The banner at line 295 is a live region on a node that appears and goes; many TalkBack versions do not speak a new node, only a changed one.
- The field is one node with a fixed description. The plan (`04b` section 9.6) asks for forts, Hobs, the kettle and pins as nodes.

Fix: keep the pad open while touch exploration is on (`AccessibilityManager.isTouchExplorationEnabled`) or when Tap only is set. Show cards in a `Dialog`, or clear the semantics of the content under them. Announce turn start, hit summary and result with `announceForAccessibility` from core events. Add an `ExploreByTouchHelper` when the core's a11y tree exists.

### M12. JNI: unchecked results, per-call class lookups, no guard for a closed handle, panics end the app

Files: `cpp/castle_jni.c:26-44, 64-103`, `core/NativeCore.kt:11-17`, `game/GameSession.kt:99-105`, `core/castle-ffi/src/lib.rs` (for context)

- `take_string` does not check `FindClass`, `GetMethodID` or `NewStringUTF` for NULL, and does not check for a pending exception before the next JNI call. Under memory pressure that is a native abort, not a Java error. It also looks the class and method up on every call, about 250 times a second. The Rust string is freed on every path, which is right.
- No native call checks `h != 0`. After `close()` the handle is 0. `onCleared` joins the sim thread for only 500 ms and then closes the core, so a late loop pass can call into the core with a NULL handle. The current `cp_` calls guard NULL, but the shim should not rely on it.
- A Rust panic cannot cross `extern "C"`; it aborts the process. The workspace turns `overflow-checks` on in release, so any overflow in the rules is an instant app death with no save. `castle-ffi` has no `catch_unwind`.
- `nativeLoad` treats non-zero as success. The comment says "int/bool". If the real call returns 0 for success the result is reversed.
- Threads: all calls come from Java threads under one lock, so no attach is needed. Keep it that way; if the core ever calls back from its own thread it must attach.

Fix: cache the class and method id as global refs in `JNI_OnLoad`, or return `jbyteArray` and decode in Kotlin (also fixes H6). Check every JNI result. Check the handle in Kotlin (`check(handle != 0L)`) and in C. Join the sim thread fully before `close`. Ask the core team for `catch_unwind` in every `extern "C"` function with an error reply.

### M13. The shim may record a build-machine path for `libcastle_ffi.so`

Files: `cpp/CMakeLists.txt:6-7, 12`, `apps/android/app/build.gradle.kts:57-58`

`castle_ffi` is an IMPORTED library given by full path. If the Rust `.so` has no SONAME, the linker writes the full CI path into `libcastle_jni.so` as the needed library. On a phone that path does not exist, `System.loadLibrary` throws `UnsatisfiedLinkError`, and `tryCreate` quietly returns the stand-in (H1). Whether rustc sets a SONAME for Android cdylibs depends on the toolchain version, so this must be checked, not assumed.

Fix: set `IMPORTED_NO_SONAME ON` on the target, or pass `-C link-arg=-Wl,-soname,libcastle_ffi.so` in `scripts/build-android-libs.sh`. Add a CI step: `llvm-readelf -d libcastle_jni.so | grep NEEDED` must show the bare file name. Also pin the CMake version in Gradle (`externalNativeBuild.cmake.version = "3.22.1"`) so CI does not pick up a different one.

### M14. CI builds the APK but runs no tests and no lint

Files: `.github/workflows/android.yml:88-93`, `apps/android/app/build.gradle.kts:78`

The workflow runs `assembleDebug` only. `testDebugUnitTest` never runs, lint is set to never fail, and nothing checks that the native core is in the APK (C1). A change that breaks the bridge test or adds a lint error such as a missing permission goes green.

Fix: run `./gradlew testDebugUnitTest lintDebug assembleDebug`. Add a step that fails when `lib/arm64-v8a/libcastle_jni.so` is missing from the APK while the core job ran. Upload the test report.

### M15. Tests cover the stand-in only

Files: `apps/android/app/src/test/kotlin/games/castleprotect/BridgeContractTest.kt`

There are 2 tests, both drive `FakeCore`. Missing:
- `Snapshot.parse` against a snapshot written by the Rust core, plus bad and partial JSON.
- `SaveStore`: write, kill mid-write, read back; failed load keeps the old file (H2).
- `GameSession` navigation: leave, new level, back, Carry on (H4); rematch; process death restore.
- Aim maths in `BattleView.updateAim`: pull-back and point mode, both sides, angle clamp below the horizon, power scale. It is not testable today because it lives inside the view; move it to a pure function.
- Compose UI tests: Fire acts on release and not on slide-off, the 150 ms guard, 0 ms tap, hold repeat and stop at limit (H5), Slow Drag (M8), hand-off 400 ms guard, Tall to Wide switch keeps aim and pad state.
- Renderer bounds: lens panned past each world edge, zero and negative scale (C2).
- JNI: an instrumented test that loads the lib, runs one command and one snapshot, with an emoji name (H6).
- `Cmd` JSON escaping for quotes and backslashes in names.

### M16. Game rules and content data in Kotlin

Apart from `FakeCore` (a marked stand-in, but see H1), these pieces decide things the core or the content files should decide, and iOS and web would have to copy them by hand:

- `battle/BattleRenderer.kt:218-219`: block wear steps at 34% and 67% pick fresh, scuffed, battered. The core should send the wear state.
- `battle/BattleRenderer.kt:232`, `ui/BattleScreen.kt:236-237`, `core/Snapshot.kt:24`: kettle look at 50% and 25%, the "!" mark, and the round-up of kettle percent (the core rounds down in `hud.kettle_pct`).
- `battle/Sprites.kt:64-72`, `core/FakeCore.kt:216`: Class to plain shot sprite, and Hob sprite guessed from id or name with a fall back to Marge. This is content data.
- `battle/BattleView.kt:132-138, 153-192`: camera framing. `04b` section 9.5 says the framing rule runs in the core so all three apps match.
- `battle/BattleRenderer.kt:189`, `core/FakeCore.kt:217`: the Loophole height (`y + 14`) used for the aim arrow.
- `ui/BattleScreen.kt:111, 411-417`, `battle/BattleView.kt:291-294`: aim limits and snap steps.
- `game/GameSession.kt:133`: which sound cue buzzes and how long. `04b` section 9.1 says haptics come from `Haptic` events.
- `ui/Menus.kt:200, 257, 289-291, 325-328`: reason names, round and wind choices, and a fixed "Blueprint: Oak Lump" line.

Fix: add these fields to the snapshot contract in C1 and delete the Kotlin copies as each one lands.

---

## Low

### L1. Compose state is written from the sim thread
`game/GameSession.kt:144`. `canResume = false; menuEpoch++` runs on `castle-sim` while `quitBattle` (line 245) does `menuEpoch++` on the main thread. The add is not atomic, so a bump can be lost and the map can show old Pennants. Post these writes to the main thread.

### L2. Lens and drag fields are shared between threads with no sync
`battle/BattleView.kt:58, 66-74, 150, 201, 212, 227, 246`. `main`, `top`, `bottom` are changed on the render thread and read in `onTouchEvent`; `anchorX`, `anchorY` go the other way. The worst case is one wrong hit test or one odd frame. Copy what input needs into volatile fields once per frame.

### L3. Blast events can go stale, and their height rides in a text field
`game/GameSession.kt:129`, `battle/BattleView.kt:149`. `fx` fills while the Battle view is not on screen (up to 32) and plays when the next battle opens. The blast y comes from `e.text.toFloatOrNull()`. Clear `fx` on battle start and give events real `x`, `y` fields.

### L4. Coming back from the background drops straight into a running sim
`game/GameSession.kt:84-97`. `onStop` does not set `paused`. After a call, the Rival's turn runs the moment the app is back, before the player has looked. Set `paused = true` in `onStop` when a battle is on screen and it is not a hand-off.

### L5. Left-hand layout is done with RTL, and a real RTL phone flips the fixed sides
`ui/BattleScreen.kt:129-130, 164, 167, 170, 214-226, 322-325`. Forcing `LayoutDirection.Rtl` puts the right arrow on the left of the Walk pad, fills the Steam bar from the right, and right-aligns chip text. The Tall layout ignores the setting. On a phone set to Arabic or Hebrew (`supportsRtl="true"`) the top strip is mirrored, so the blue gauge sits over the orange fort, and `padding(start = left inset)` puts the cutout padding on the wrong side. Mirror the clusters by hand, and wrap the battle HUD in `Ltr`.

### L6. The screen is kept on in every screen
`MainActivity.kt:35`. `FLAG_KEEP_SCREEN_ON` is set for the whole activity. A phone left on the title or the map never sleeps. Set it only while a battle is on screen and not paused.

### L7. Small flow gaps
`ui/BattleScreen.kt:476`: "Give up" ends the battle with one tap and no confirm. `game/GameSession.kt:60, 231-232`: after "Carry on" from a cold start there is no Rematch because `lastBattleCmd` is not saved. `game/GameSession.kt:204-218`: `startPre`, `fight` and `startNow` ignore a refused command and change screen anyway. `game/GameSession.kt:166`: success is found with `contains("\"ok\":true")`; parse the reply.

### L8. One finger pan and pinch do little in the Tall layout
`battle/BattleView.kt:164, 170-171, 226-229, 246-251`. Pinch changes `zoom`, which the Top and Bottom lenses never use (the design gives each a pinch range). A pan that starts in the Bottom lens on the Rival's turn only turns on "Re-frame" and then makes the joined flight view jump by the stored `panX`. Pan speed uses `main.scale`, which is stale in the Tall layout.

### L9. A bad snapshot becomes an empty world with no trace
`core/Snapshot.kt:89`, `core/NativeCore.kt:13`. Any parse error, or a NULL from native, gives `EMPTY`: a blank field for a frame, the HUD back to "You" and "Rival" at 100%, and `react` sees turn 0 and saves. Keep the last good snapshot and log the error.

### L10. Sound loading details
`game/Sfx.kt:42-52, 64, 68`. `release()` can run while the load thread is still calling `pool.load`. A cached `sfx_<cue>.wav` is reused for ever, so a changed tone table needs a cache clear. There is no audio focus handling, which is fine for effects but will matter when music is added.

### L11. The stand-in save leaves things out
`core/FakeCore.kt:436-479`. Not saved: the random state (after a load it is always `Random(1)`), pins and ghost lines, the per-turn walk count (kill the app to walk another 40), last aim for Recall. `"v": 1` is written but never read. `load` changes fields before it can fail, so a refused save leaves a half-loaded core. Only worth fixing if the stand-in stays for debug builds.

### L12. Tap targets and labels
`ui/BattleScreen.kt:415`: the Recall key is 48 x 28 dp, under the 48 dp rule in `07` section 0. Its only visible label is "R". `ui/BattleScreen.kt:303`: Pause shows "II" as text. Use icons with labels.

### L13. All UI text is in Kotlin
`res/values/strings.xml` has one string. Every label and every TalkBack text is a literal in `ui/*.kt`, with hand-made plurals ("${shot.uses} left"). `04b` section 9.7 asks for generated `strings.xml` with plurals. Fine for v0.1, but each new screen makes the move bigger.

### L14. Gradle and manifest small items
- `apps/android/gradle/wrapper/gradle-wrapper.properties`: no `distributionSha256Sum`, and CI has no wrapper check step.
- `apps/android/app/build.gradle.kts:40`: `versionCode = 1` is fixed; it needs a source before the first store upload.
- `apps/android/app/build.gradle.kts:110`: tests use the `org.json` jar from Maven, not Android's own copy, so parser quirks can differ from the phone.
- `kotlinx.coroutines` is used directly (`GameSession.kt:19`, `BattleScreen.kt:73`) but only arrives through other libraries. Declare it.
- `apps/android/app/build.gradle.kts:93-97`: the art launcher icon is one 192 px PNG in `mipmap-xxxhdpi`, not an adaptive icon, so launchers shrink it onto a white plate.
- `AndroidManifest.xml:5, 15`: `glEsVersion` is declared but GL is not used yet; `isGame` is the old flag next to `appCategory`.
- `apps/android/app/build.gradle.kts:86-97`: the copy tasks are tied to `preBuild`. It works. The `androidComponents` generated-source API is the supported way.
- `.github/workflows/android.yml:60-63`: the cache key lists `gradle/libs.versions.toml`, which does not exist. Harmless.

### L15. 16 KB pages are checked for the Rust libs only
`scripts/build-android-libs.sh` checks `jniLibs/*.so`. `libcastle_jni.so` is built later by CMake and is not checked, and nothing checks the final APK. The flags in `CMakeLists.txt:13` and `build.gradle.kts:50` look right. Add `zipalign -c -P 16 -v 4 app-debug.apk` and a `llvm-readelf -lW` pass over every `.so` in the APK.

### L16. Checked versions and levels
Pinned: AGP 8.13.0, Kotlin 2.2.20, Gradle 8.14.3, Compose BOM 2025.09.00, core-ktx 1.17.0, activity-compose 1.11.0, lifecycle 2.9.4, NDK 28.2.13676358 (same as `android.yml`). `minSdk` 26, `targetSdk` 36, `compileSdk` 36, Java 17. All as the plan asks. `local.properties` is ignored by git. `gradlew` is tracked as executable. The action versions (`checkout@v7`, `setup-java@v6`, `setup-android@v4`, `upload-artifact@v7`) and Rust `1.99.1` could not be checked from this machine; confirm they exist before relying on the workflow.

---

## What is in good shape

- One activity, `configChanges` covers turn and resize, all state in a ViewModel. A turn of the device ends a drag, keeps the aim and fires nothing (`BattleView.kt:91-96`).
- Fire acts on finger up inside the button, sliding off cancels, and the 150 ms guard after a drag is there (`Theme.kt:166-178`, `BattleScreen.kt:115-119`). Buttons use `clickable`, which has no minimum press time.
- A second finger cancels the drag and a new touch is needed before aiming again (`BattleView.kt:215-221, 234`). `ACTION_CANCEL` restores the old aim.
- Hand-off card: Ready ignores input for 400 ms, and the card blocks touches to the HUD under it.
- `AtomicFile` is used correctly: `startWrite`, `finishWrite`, `failWrite` on error, one writer at a time.
- The ViewModel holds only the application context. No activity or view leak was found.
- Rust strings returned to the shim are freed on every path.
- Shapes as well as colours tell the sides apart, and most controls carry content descriptions and state.
