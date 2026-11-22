# Android code review 2

Scope: `apps/android/` only, at commit `15dc40c` on 2026-11-22. No code was changed.

How it was checked:

- Read `android-review-1.md` and its Fixes table, `android-build-log.md`, `core/API.md` (v0.2), `assets/animations.json`, `assets/audio/audio.json` and README, and the parts of `docs/design/07-ux-ui-audio.md` on camera (2.x, 3.5), juice (6), pause (8.3) and audio (9).
- Read every Kotlin and C file under `apps/android/app/src/main`, and the test list.
- Ran `./gradlew assembleDebug testDebugUnitTest lintDebug` with `ANDROID_HOME=~/android-sdk`. All pass. 54 tests, 0 failed, 5 skipped (the 5 need the host build of the real core, which only CI has). Lint: 0 errors, 29 warnings, none about lifecycle or threads.
- Checked two points against the core source where the API text was not enough: the `collapse` event (`core/castle-core/src/effects.rs:1438-1463`) and the Pennant rules (`battle.rs:1835`).
- Nothing was run on a device or emulator. Findings on sound, frame cost and TalkBack come from reading the code. Each one says so where it matters.

Paths are relative to `apps/android/app/src/main/kotlin/games/castleprotect/` unless they start with `apps/`, `core/` or `assets/`.

Counts for new findings: 0 critical, 3 high, 16 medium, 22 low.

---

## 1. First-round findings: what holds

42 findings in round 1. Now: 25 fixed and hold, 11 partly fixed, 2 regressed, 2 not fixed (as the table said), 2 not rechecked because the fix is outside `apps/android`.

| Id | Now | Proof or gap |
|---|---|---|
| C1 | Fixed | `cpp/castle_jni.c:64-109` uses only `cp_` calls. `core/CoreBridge.kt:50-81` commands match `core/API.md`. `apps/android/app/build.gradle.kts:24-33` fails the build with `-Pcastle.requireNative=true` |
| C2 | Fixed | `battle/Camera.kt:17-32, 53-59` clamps scale, zoom, centre and pan. `battle/BattleView.kt:148-150` skips a bad frame. Terrain is a bitmap (`battle/BattleRenderer.kt:92-131`), no height list index |
| H1 | Fixed | `core/CoreBridge.kt:46`, `game/GameSession.kt:108-113` (own file for the stand-in). No `FakeCore` in the tree |
| H2 | Fixed | `game/SaveStore.kt:45-63` (set aside, backup tried), `82-98` (temp, sync, rename, `.prev`), `83` (no write before load) |
| H3 | Fixed | `game/GameSession.kt:229-236` waits for the save on the sim thread, 2 s cap |
| H4 | Fixed | `game/GameSession.kt:705-710` asks first, `675` drops an unused Rummage, `523` clears on a result. One gap, see N-M13 |
| H5 | Fixed | `ui/Theme.kt:159-183`: cancel in `finally`, on dispose, on `enabled` change, and when the step returns false |
| H6 | Fixed | `cpp/castle_jni.c:24-62` and `core/NativeCore.kt:29`: bytes both ways, no `jstring` |
| H7 | Partly | Sim blocks when idle (`game/GameSession.kt:258-260`), lean frames, streaming parser. Not true: "at most once per 16 ms". A snapshot is taken after every job batch (`260-265`), so an Aim Drag makes one per touch move. And each aim step recomposes the HUD, see N-M9 |
| H8 | Regressed in part | Blocks, shells and the readout are still clean. The new animation code builds strings, pairs, sets and lambdas every frame, see N-M8. The class comment at `battle/BattleRenderer.kt:30-32` is no longer true |
| M1 | Fixed | `battle/BattleView.kt:114, 126`: interrupt and full join |
| M2 | Fixed | Only `publish()` on the sim thread sets `frame` and `_ui` (`game/GameSession.kt:311-327`) |
| M3 | Fixed | `game/GameSession.kt:611-621`: jobs to the sim thread, replies posted back |
| M4 | Fixed | `game/GameSession.kt:566-589, 762-777`: any saved battle replays with `resume`. Gap for a save taken in the Rummage, see N-M13 |
| M5 | Partly | As the table said: `battle/Sprites.kt:36-54` (index on a worker), `77-84` (half size backgrounds), `87-96` (trim). Still loose PNGs decoded on first draw. It matters more now, see N-M10 |
| M6 | Regressed | The idle test is there (`battle/BattleView.kt:137`) but `renderer.animating` is `fx.busy`, and wind leaves keep `fx` filled all battle, see N-M2. "Nothing while paused" also leaves a black field, see N-M3 |
| M7 | Fixed | `ui/BattleScreen.kt:204` pads all four insets in the Wide layout |
| M8 | Fixed | `ui/BattleScreen.kt:505-517`: `rememberUpdatedState`, `open = false` for the Slow Drag |
| M9 | Partly | `game/GameSession.kt:648-658` steps from the last aim sent. Recall does not update it, see N-M4 |
| M10 | Fixed | `battle/BattleView.kt:402, 467`: the old aim is real and is sent back on cancel |
| M11 | Partly | Pad stays open (`ui/BattleScreen.kt:127-129`), cards hide the HUD (`163`), live region node (`232`). The shot result is still not heard, see N-M11. Field nodes still missing (as the table said) |
| M12 | Fixed | Shim checks (`cpp/castle_jni.c:24-40, 86, 96, 102`), handle check (`core/NativeCore.kt:15`), close then join (`game/GameSession.kt:238-246`). Core v0.2 now has `catch_unwind`, and `core/LiveBattle.kt` rebuilds a dead handle |
| M13 | Fixed | `cpp/CMakeLists.txt:9-11` (`IMPORTED_NO_SONAME`), `apps/android/app/build.gradle.kts:64` (CMake 3.22.1). The CI check is outside this scope |
| M14 | Not rechecked | The fix is in `.github/workflows/android.yml`. The build log shows run 18 green with tests and lint |
| M15 | Partly | 54 JVM tests. Still no Compose UI test and no on-device test. Nothing tests collapse placement, Recall then nudge, or audio focus |
| M16 | Partly | The old items are as the table said. New view rules were added in Kotlin, see N-L11 |
| L1 | Partly | Compose state is posted (`game/GameSession.kt:253`). Two cross-thread touches remain, see N-L10 |
| L2 | Partly | `battle/BattleView.kt:77-81` copies for input. Rects still shared |
| L3 | Fixed | `game/GameSession.kt:547` clears the queue, `battle/BattleView.kt:204` clears effects on a new map |
| L4 | Fixed | `game/GameSession.kt:232, 258, 278` |
| L5 | Fixed | `ui/BattleScreen.kt:154` forces left to right, `242-246` swaps clusters by hand |
| L6 | Fixed | `MainActivity.kt:49-53` |
| L7 | Partly | Give up asks (`ui/BattleScreen.kt:646-653`), replies are parsed (`core/Snapshot.kt:858-880`). A refused start sets `notice`, but only the Title shows it, see N-L9 |
| L8 | Partly | As the table said |
| L9 | Fixed | `game/GameSession.kt:321` logs and keeps the last frame. Side effect in N-L14 |
| L10 | Fixed | `Sfx.kt` is gone. `game/Audio.kt` runs on one thread and has focus handling (with faults, see N-H1) |
| L11 | Fixed | No stand-in rules or save |
| L12 | Fixed | `ui/BattleScreen.kt:532` (64 x 48 dp Recall), `397-403` (pause icon with a label) |
| L13 | Not fixed | Text is still in Kotlin |
| L14 | Partly | As the table said. Tests still use the Maven `org.json` (`apps/android/app/build.gradle.kts:143`) |
| L15 | Not rechecked | CI only |
| L16 | Not fixed | Nothing to change in the app |

---

## 2. New findings

### High

#### N-H1. One audio focus loss mutes the game until the app is killed

File: `game/Audio.kt:60, 123, 253, 312-316, 324-331, 347`

What is wrong. `focusGain` is set to 0 on `AUDIOFOCUS_LOSS` and is set back to 1 only in the `AUDIOFOCUS_GAIN` callback. After a full loss the system sends no gain. `requestFocus()` can get focus back, but a granted request does not call the listener, so `focusGain` stays 0. `playNow` then returns for every effect (`v <= 0f`), and `music()` and `onStart()` do not start tracks (`focusGain > 0f` is false).

Failure scenario. The player is in a battle and taps Play on a music app in the notification shade (or a video starts in a split window). The game gets `AUDIOFOCUS_LOSS`. The player stops that music and plays on. No music, no effects, no barks for the rest of the session, also after Home and back, also in the next battle.

Fix. When `requestAudioFocus` returns `GRANTED`, set `focusGain = 1f` and resume. Keep effects playing after a full loss (they are short and use `USAGE_GAME`); only music should stop. Add a unit test with a fake focus source.

#### N-H2. No sound at all unless the player taps "Play" on the title

Files: `ui/Menus.kt:100-104`, `game/Audio.kt:56, 96, 108, 157, 233`, `game/GameSession.kt:816`

What is wrong. Sound is locked until `unlock()`. Only the Play button calls `firstTap()`. `unlocked` starts from `settings.seenIntro`, and `seenIntro` is set to true in one branch only: Play, first run, no battle to carry on. "2 Players", "Skirmish", "Settings" and "Carry on" never unlock.

Failure scenario. A new player opens the app and taps "2 Players". The whole Couch Duel is silent. The same on every later launch, until they tap Play once. If a battle is kept (`canResume`), Play unlocks for this run but does not set `seenIntro`, so the next launch is silent again.

Fix. Unlock on the first tap of any title button, and set `seenIntro` there. Or drop the lock after the first launch has shown the title.

#### N-H3. Every collapse is drawn too high by the fall height

Files: `battle/FieldFx.kt:211, 213, 314-323`, `core/castle-core/src/effects.rs:1438-1463`

What is wrong. The core's `collapse` event lists the blocks at the cells they stood in before the fall (`blocks_json` is built before the chunk is removed), and `falls` is how far each column drops. `FieldFx.collapse` treats the cells as the landing place: `y = k.baseY - 16f * (row + 1) - fall`. So each piece is first drawn `fall` cells above where it stood, creaks there, drops back to its old cell, and breaks there. The rubble and dust play at the old place, not where the chunk landed.

Failure scenario. A shot takes out a support and four timber blocks fall 32 cells. On screen the four blocks jump up 32 cells, shiver in the air, fall back to where they were and turn to rubble in mid air above the real landing spot.

Fix. Start at `k.baseY - 16f * (row + 1)` and end `fall` lower. Add a JVM test that feeds a `collapse` event from a core fixture and checks the start and end y of a piece.

### Medium

#### N-M1. Rubble stays for 10 s as a wrong sized ghost block

File: `battle/FieldFx.kt:88, 189, 302`, `assets/animations.json` (`fx_rubble_*` has `hold: block_<mat>_broken`)

`spawn("fx_rubble_$mat", ...)` uses the default life of 10 000 ms. An effect is removed when its clip is done and has no `hold`, or when its life ends. Rubble has a `hold`, so it stays 10 s. It then draws `block_<mat>_broken` at the rubble's size and anchor (20 x 20, offset 10 cells down), with no fade, next to the proper `Rubble` object that fades after 1.5 s. It also keeps `fx.busy` true for 10 s after every broken block. Fix: give the rubble effect a life equal to its clip, and let the `Rubble` object show the hold.

#### N-M2. The field redraws at the full display rate for the whole battle when there is wind (M6 regressed)

Files: `battle/FieldFx.kt:81, 355-364`, `battle/BattleRenderer.kt:78`, `battle/BattleView.kt:137`

Wind leaves are `Fx` objects that live up to `mapW / (|wind| * 0.03)` ms (11 to 66 s) and a new one comes every 1400 / |wind| ms. So `fx` is never empty, `busy` is true, and the idle path is never taken. In the Tall layout that is two full lens draws (sky, two hill bands, terrain, both forts) every vsync through every Plan step. On a 120 Hz screen it is 120 a second. Heat and battery on a 2 GB phone. Fix: leave ambient effects (leaves, shimmer, Squall tiles) out of `busy` and let them run at the 12 fps idle rate; cap the loop at 60 fps.

#### N-M3. Paused means nothing is drawn, so the field is black after Home, a turn of the device, or a layout switch

File: `battle/BattleView.kt:135`

While `session.paused` the render loop sleeps and never draws. `onStop` sets `paused` (`game/GameSession.kt:232`) and the surface is destroyed. On return a new surface is made and stays empty behind the 60% scrim of the Pause card. The same on rotate or a Tall to Wide switch while paused: the surface changes size and is not redrawn. Fix: when `redraw` is set, draw one frame even when paused.

#### N-M4. Recall, then a Fine Tune step, throws the recalled aim away (M9 partly)

Files: `ui/BattleScreen.kt:147`, `game/GameSession.kt:648-658`

Recall goes out with `session.send(Cmd.recall(...))`. It does not touch `lastAimKey`, `lastAimA`, `lastAimP`. If the player aimed this turn before Recall (a drag or a nudge), `aimBase` still returns that older aim, so the next key press sends old aim plus one step. The pad also shows the old numbers. Scenario: drag, do not like it, Recall the last shot, press "ang +" once: the aim jumps back to the drag. Fix: clear `lastAimKey` on recall, pick_hob and any refused aim, or set it from the reply.

#### N-M5. A relit kettle keeps the popped look

Files: `battle/FieldFx.kt:131, 409`, `battle/BattleRenderer.kt:428-432`

`kettle[side]` is set on `kettle_pop` and never cleared. `kettleSprite` then returns the clip's hold (`kettle_popped`) for good, and the renderer uses it before the state. After a `relight` (Volley Points) the kettle is intact in the snapshot but still drawn popped, with no halo. Fix: drop the clip on `relight` and when `ks.intact` is true again.

#### N-M6. Wide layout: the camera moves while a finger aims

File: `battle/BattleView.kt:325-337, 265`

In Plan the Wide target box takes in the preview dots. The dots change with every aim step, so the camera pans and zooms during the drag. `07` says "Holds still. No camera move while a finger aims". The aim itself is safe (it is worked out in screen px), but the fort and the arc slide under the thumb. The Tall layout is fine. Fix: freeze `fitOut` while `draggingFlag` is true.

#### N-M7. Music layers: a re-seek every 2 s can loop for ever, and old phones get gaps

File: `game/Audio.kt:93, 241, 253, 281-291, 342`

- The three players are started one after the other, so they begin a few to tens of ms apart. The check reads three positions at three moments and seeks any layer more than 40 ms off. A seek on a slow phone takes longer than that and is not sample exact in Ogg, so the layer is off again at the next check and is seeked again. That is a click or stutter every 2 s in Stir and Peril, at the very moments they are heard. There is no wait for seek complete and no back off.
- Android 8 and 9 get the `.m4a` files. `MediaPlayer` looping of AAC and `SoundPool` loops of AAC keep the encoder padding, so `mus_*`, `wx_wind_loop`, `fly_whistle_loop` and `aim_band_stretch` have a gap or tick at each loop. The audio README says to trim to `samples`; neither API can.

Not heard on a device. Fix: mix the three layers in one `AudioTrack` (decode once with `MediaCodec`, loop by sample count), which fixes both. As a small step: only re-seek a layer that is silent, with a wider limit, once.

#### N-M8. Garbage every frame is back in the draw path (H8 regressed in part)

Files: `battle/FieldFx.kt:272, 278, 281, 301, 333, 337-341, 373, 384, 411-413, 451`, `battle/BattleRenderer.kt:196, 219-220, 282, 415-417, 439, 451`

Per frame, per lens: a `HashSet` of Hob ids; a new lambda for every Hob, every effect (up to 160), each leg, lid and pin; a string template per Hob in a one shot pose, per Hob with a passive, per falling piece (`"block_${p.mat}_scuffed"`), per room (`"$side:$room"`, twice, plus `"loophole_flap_$team"`), per Pin, per prop, and for kettle steam; a `Pair` per Hob from `hobFrame`. Each name then goes through `sprites.get`, which takes a lock twice and hashes the string. In a big collapse in the Tall layout this is a few thousand short objects a frame. Fix: resolve sprite refs when a clip changes frame (keep them on the clip), key flaps, lids and pins by int, pass one shared callback object, and return the frame through fields, not a `Pair`.

#### N-M9. Every Aim Drag step recomposes the whole HUD (H7 partly)

Files: `core/Snapshot.kt:330`, `game/GameSession.kt:326`, `ui/BattleScreen.kt:98`

A lean snapshot after `aim` copies the Hob list with the new angle. `BattleUi.of(f)` then differs, the state flow emits, and `BattleScreen` and all its parts (which take the whole `BattleUi`) recompose, about 60 times a second during a drag. The comment at `game/GameSession.kt:51` says lean frames do not recompose; aim frames do. The HUD does not even show the aim during a drag (the field draws the readout). This is main thread work at the moment the player feels lag most. Fix: keep the aim out of `BattleUi` (a small flow of its own, read only by the Readout and the pad).

#### N-M10. Sprites: 870 loose PNGs, decoded on the render thread at first use, never dropped until the system asks

File: `battle/Sprites.kt:62-71, 77-84, 87-96`

- First use of a sprite decodes it inside `drawFrame`. The new animation frames (Hob poses, booms, chunks, dust, cracks, trails) are first used at the first fire, first hit and first collapse, so those beats get a hitch of tens of ms on a slow phone.
- All `@2x` sprites decoded come to about 61 MB (74 MB less the half size backgrounds). Nothing bounds the cache; it grows over a session as new Hobs appear. Each bitmap also has a GPU copy.
- `trim` at `RUNNING_LOW` clears every bitmap while the battle is on screen. The next frame decodes all visible sprites at once, a stall of a few hundred ms just when memory is short.
- A failed decode (also an `OutOfMemoryError`) is cached as null, so that sprite is gone until the next trim.

Fix: preload the battle's sprite set on a worker when Pre-battle opens, ship atlas pages, bound the cache (LRU by bytes), do not cache a failed decode, and on `RUNNING_LOW` drop only what the current battle does not use.

#### N-M11. TalkBack still does not hear the shot result

Files: `game/GameSession.kt:412-419`, `ui/BattleScreen.kt:122-123, 232`

On `turn_start` the session emits the shot summary and then the turn text, back to back. The screen keeps one `spoken` string. Both land in the same frame, so only "Your turn" reaches the live region. Two equal texts in a row are also dropped (state does not change). Fix: send one joined text, or queue the texts and use `View.announceForAccessibility` for each.

#### N-M12. Collapse beats land after the sim has moved on

Files: `battle/FieldFx.kt:312-318`, `game/GameSession.kt:491-498`, `game/Juice.kt:46, 110`, `battle/BattleView.kt:211`

The core's settle phase is 60 ticks (0.5 s). The view's collapse takes 300 ms creak, 150 ms lean, the row gaps and the fall before a piece lands, so the land beat comes when the phase is already Plan. Then: `shake(aiming = true)` zeroes the trauma, so the land shake never shows; the 50 ms hit stop freezes the next turn's idle poses; and `slowMo(0.5, 600)` runs into the next turn and marks `slowThisShot`, so the next shot can start at half speed and lose its own slow motion. From reading the times; not seen on a device. Fix: hold the turn change in the view until `fieldFx` has no pieces left (do not send `ai_turn`, do not show the banner or hand-off card), or shorten the view beats to fit settle. Do not apply view beats once the phase is Plan.

#### N-M13. Carry on into a battle saved during the Rummage leaves the player stuck

Files: `game/GameSession.kt:530-533, 762-777`, `ui/BattleScreen.kt` (no draft UI)

`saveNow` saves any phase but ended and none, so a battle opened for the Rummage in Pre-battle is saved in `draft`. If the process is killed there (app switch on a 2 GB phone), the next launch shows "Carry on". `resume()` replays and enters the Battle screen. That screen has no Rummage, `humanTurn` is false, and nothing ends the draft. The only ways out are Give up or starting a new battle. Fix: in `resume()`, when the phase is `draft`, send `end_draft` first, or go to Pre-battle with that spec.

#### N-M14. Loops can die and never come back

Files: `game/Audio.kt:113-115, 132-133, 137-147`, `game/GameSession.kt:462-470`

- `loop()` calls `playNow`, which returns 0 when the sound is not loaded yet (136 sounds load at start). The session has already stored `windOn = wind`, so it does not ask again until the wind changes. Carry on within a second or two of launch gives a battle with no wind bed.
- All sounds but the kettle bus play at priority 1. A fan of impacts can steal the wind, Squall or whistle stream. `loops[id]` then holds a dead id; `setVolume` and `setRate` do nothing and the loop stays silent until the next screen change. `07` 9.5 also says blasts and Bonks are never stolen.

Fix: give loops and blasts a higher priority, retry a loop that did not start, and restart one when `play` returned 0 or after a burst.

#### N-M15. Leaving and coming back: sound does not follow the design

Files: `game/Audio.kt:269, 292, 347-352`, `game/GameSession.kt:226`

- `07` 8.3 says audio resumes only after Resume. `onStart` restarts the music at once while the Pause card is up.
- The music ticker posts itself every 33 ms for as long as there are tracks, also in the background.
- `pool.autoResume()` runs only when there are tracks, so effects paused in `onStop` on the Results or Title screen stay paused and hold voices.
- Headphones pulled out is not handled (`ACTION_AUDIO_BECOMING_NOISY` is never registered). `07` 8.3 asks for pause and mute.
- Music asks for `AUDIOFOCUS_GAIN` even when Music is at 0 or Mute all is on, which stops the player's own music for nothing.

Fix: resume music from `paused = false`, stop the ticker in `onStop`, always `autoResume`, add the noisy receiver, and skip the focus request when the music bus is silent.

#### N-M16. Dead handle recovery: works, with gaps

Files: `core/LiveBattle.kt:44-51, 79-95`, `game/GameSession.kt:302-320, 330-338`

The design is sound: the log is kept after each command, a dead reply rebuilds with `cp_new` plus `resume`, the last aim is sent again, events of the replay are dropped, three tries then the battle is set aside with a message. Gaps:

- `recover()` does not close the new handle when `replay` throws (`85-93`), so a failed rebuild leaks one core handle. `open()` does close it (`107`).
- The command that panicked is dropped with no word to the player. A Fire that does nothing looks like a dead button. Show a short notice.
- `resume` reruns every AI turn of the battle (the log keeps `ai_turn`). Late in a battle that is seconds on the sim thread with no "Loading" state, and `onStop` can time out its 2 s wait behind it.
- After a fault in `publish()`, `dirty` is set but the loop may sleep up to 1 s before the next snapshot (`260`).
- A panic that repeats (same state, same command, for example `ai_turn`) costs three full replays before the battle is set aside.

### Low

- **N-L1. Cheer restarts with its sounds.** `battle/FieldFx.kt:278-283`. `cheer` is play once with `next: idle`; the pose is reset to idle and then asked for again, so each winner Hob replays `hob_cheer` and `hob_land_thud` every 0.8 s until the Results screen (1.4 s). Make cheer loop in the view without events after the first pass.
- **N-L2. Bonked Hobs replay the balloon on every new view.** `battle/FieldFx.kt:277`. A new `BattleView` (Carry on, back from the map) starts the `bonked` clip from frame 0 for Hobs Bonked long ago, with the inflate and lift sounds. Start such clips at `loop_from`.
- **N-L3. Events fire on the wrong frame when a clip plays backwards.** `battle/Anims.kt:193-197` uses the play order index for `def.events`, not the real frame. The Pot Lid `up` sound comes at the wrong end.
- **N-L4. `clear()` leaves state behind.** `battle/FieldFx.kt:83, 256-259`. `flapState`, `lidState`, `pinKnown`, `legs`, `squall`, `shimmerClip` and `lastStateFrame` survive a new battle, so a flap can animate at the start for no reason and an old frame is kept alive.
- **N-L5. Wide flight camera can lose a shell below the target fort.** `battle/BattleView.kt:306`: `y1 = boxB[3]` ignores `sh.y`. A shot into a valley drops out of the bottom of the view. Use `max(sh.y, boxB[3])`.
- **N-L6. The aim stretch loop can stick on.** `battle/BattleView.kt:212-217` (render thread posts `loop(true)`) races `465` (UI thread posts `loop(false)`). Rare. Start and stop the loop from one thread.
- **N-L7. Audio small items.** `game/Audio.kt:168` sets `barkAt` even when Voices is 0, so music ducks for a silent bark. `259`: `release()` is skipped if `stop()` throws; use `finally`. No `OnErrorListener`, so a dead player stays silent while `musicKey` blocks a restart (`230`). `243`: `prepare()` blocks the audio thread, so taps sound late when a battle opens.
- **N-L8. Size and memory of sound.** `apps/android/app/build.gradle.kts:110` ships both `.ogg` and `.m4a` (2.7 MB never used on any one phone). All 136 non-music sounds, all 48 barks included, are decoded at start (about 8 to 17 MB of PCM). Load barks for the crew in play.
- **N-L9. A refused battle start is shown only on the Title.** `game/GameSession.kt:738`, `ui/Menus.kt:87`. On Pre-battle the FIGHT button just comes back. Show `notice` on every screen.
- **N-L10. Cross-thread touches.** `game/GameSession.kt:226` writes `lastStepAt` from the main thread; `806` reads `lastResult` and `frame` on the main thread. Also `lastResult` stays set after Results, so the map music stays quiet until the next battle. No 16 ms cap on command snapshots (see H7).
- **N-L11. View rules now in Kotlin** (the other apps must copy them by hand): blast band from radius, a copy of the core table (`game/Juice.kt:134-141`); hit stop by damage band (`game/GameSession.kt:374`); music layer rule (`game/AudioManifest.kt:176-183`); kettle whistle rule (`game/GameSession.kt:472-476`); the shooter's name guessed as `1 - e.side` (`411`), wrong when a side acts twice; "cleared" taken from Pennant bit 0 (`game/GameSession.kt:693`, `ui/Menus.kt:123`), true only while every level's first Pennant is `win`; `WALK_STEP = 4` (`ui/BattleScreen.kt:435`); "Phase n/3" (`259`); `brokeLine` thresholds (`ui/Menus.kt:355-363`); aim pose by power thirds (`battle/FieldFx.kt:280`); Couch Help preview 60 and 100 (`core/CoreBridge.kt:151-155`). Ask for `band`, `shooter`, `cleared` and the layer flags in the snapshot or in shared data files.
- **N-L12. Numbers use the phone's locale.** `battle/BattleView.kt:216`, `ui/BattleScreen.kt:503, 530`. `"%.1f"` gives "45,5" or other digits. Use `Locale.ROOT` until text is localised.
- **N-L13. A bad snapshot loses its terrain chunks.** `game/GameSession.kt:321`. `cp_snapshot` drains dirty chunks; when the parse throws they are gone and a crater never shows. Send `terrain_all` after a parse error.
- **N-L14. Wide layout: the field node is not hidden under cards.** `ui/BattleScreen.kt:202` is outside the column that gets `hidden` (`204`). TalkBack can still land on "Battle field" behind the Pause card.
- **N-L15. Set-aside saves pile up and are backed up.** `game/SaveStore.kt:76`, `res/xml/backup_rules.xml`. `.bad-<time>` files are never removed and sit in `save/`, which Auto Backup uploads. Keep the newest two.
- **N-L16. `onCleared` can block the main thread.** `game/GameSession.kt:241-244`: after the 3 s wait, `sim.join()` has no limit. A long replay at that moment holds the main thread.
- **N-L17. Overdraw and the effect cap.** `battle/FieldFx.kt:494-501`: the Squall is about 20 blended tiles over each lens, on top of sky and hills. `88-90, 348-352`: trails (one per shell every 40 ms) share the 160 cap with blasts and rubble and can push them out; leaves take up to a third of it.
- **N-L18. Tall layout: the field changes size at each Fire and each settle.** `ui/BattleScreen.kt:188-195`. The tray leaves the column in flight, so the `SurfaceView` is resized twice a turn. Some phones show a stretched or black frame on a surface resize. Check on a device; an overlay tray avoids it.
- **N-L19. `Juice` is not thread safe.** `game/Juice.kt:20-36, 92-126`. `addTrauma` (sim and render threads), `shake` (render) and `cancelSlow` (main) write `trauma`, `decayPerMs`, `shakeT`, `lastStopAt` with no lock. A blast shake or first kick can be lost. The class comment says only the sim thread writes. Use one lock.
- **N-L20. Give up reply is not read.** `game/GameSession.kt:637-641`. If the core refuses, the Pause card is gone and the battle goes on with no word.
- **N-L21. Steal order.** `game/Audio.kt:132`: only the kettle bus has a higher priority. `07` 9.5 lists UI first, then world loops, flight, material, voice.
- **N-L22. Tests.** No test covers N-H1, N-H2, N-H3, N-M4, N-M5 or N-M13. `AnimsAudioTest` runs on the Maven `org.json`, which treats JSON null in `optString` in a different way from Android's; today `animations.json` has no nulls, so it is safe, but a `"next": null` would behave differently on a phone.

---

## 3. What is in good shape

- The core binding: one handle per battle, all calls on one thread (which also fits the core's debug `wrong_thread` check), bytes across JNI, every string freed, replies parsed.
- Dead handle recovery keeps the save and the app alive, and the tests cover a panic, a rebuild and giving up after three tries.
- Hit stop and slow motion change only how fast the sim is fed, never a rule; 2x cancels slow motion; Reduce motion turns slow motion into a short hold.
- Reduce motion and shake at 0% are honoured in the camera, the fort bob, leaves, shimmer and the rim flash; the Bottom lens never shakes under the aiming thumb.
- The animation player handles `loop_from`, `next`, `hold`, `pick` and long frames with a guard, and all 212 animations and 140 sounds are checked against the manifests by tests.
- Sound has one thread, pan, pitch spread, the 3 in 50 ms rule, ducking, and releases its `SoundPool`, players and focus in `release()`. No leak of an activity or view was found.
- Help, Volley Points, Give up, the boss HUD and the Results screen read everything from the core's `hud` and `result`. Buttons are summed from `result.buttons` once per battle.
- Portrait: Title, Map, Pre-battle, Results, Skirmish and Couch Duel setup all scroll and pad for insets.
