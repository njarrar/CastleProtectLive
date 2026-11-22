# iOS code review 2

Scope: `apps/ios/` (Swift 6, SwiftUI, SpriteKit, C bridge to the Rust core) and `.github/workflows/ios.yml`.
Read against `docs/review/code/ios-review-1.md` (findings and Fixes table), `docs/review/code/ios-build-log.md`,
`core/API.md` (v0.2), `assets/animations.json`, `assets/audio/audio.json` and `docs/design/07-ux-ui-audio.md`.

Method: every Swift file, `project.yml`, the scripts, the privacy manifest, the workflow and the test names were read.
Core behaviour was checked in `core/castle-core/src/battle.rs`, `effects.rs`, `snapshot.rs` and `core/castle-ffi/src/lib.rs`
where a finding hangs on it. This machine has no Xcode, so nothing was built or run. CI is green (72 unit tests, 2 UI tests).
Audio findings rest on how `AVAudioEngine` is documented to act and should be heard on a device before and after the fix.
No code was changed.

Paths are relative to `apps/ios/CastleProtect/` unless they start with another folder.

## Counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 3 |
| Medium | 8 |
| Low | 10 |

Round 1: of 33 findings, 17 are fully fixed, 14 are partly fixed and 2 are still open (L7, L8).
No fix marked "Fixed" was found to be missing. Two fixes have slipped back in part (H8 with M1, and M6). See below.

## What is sound in the new work

- The v0.2 wire types match `core/API.md`: 64 cell chunks, lean `aim` frames, `give_up`, `set_wind`, `resume`, setup `help`,
  `preview_pct`, `volley`, `progress`, the new HUD and result fields. Decoding stays lenient.
- The dead handle path follows the API: `cp_new` with the same setup and seed, then `resume` with the log kept at the turn start.
  The old handle is freed. It is tried at most twice. The core clears the replay's events, so no old sounds play.
- A save holds rules, sim and hash. A resume flag stops a crash loop. The result is stored in the frame it arrives.
- `FieldFX` never reads the wall clock and never touches the sim. Hit stop, shake and slow motion follow the UX tables
  (one stop per 250 ms, halved at 2x, capped with Reduce motion, no shake in Plan, 1.5 s slow motion cap per turn).
- The collapse reads the core's cells the right way: `[c, r, mat]` is where each block stood before the fall, and
  `falls` is how far each column drops (`Battle/FieldFX.swift:732-745`). Ghost blocks are placed from the frame
  before the event, where those blocks still exist.
- Music layers share one start time and loop from the file by the manifest's `samples`, which are equal for all three.
- The audio session is `ambient`, the silent switch and the player's own music are kept, no sound plays before Play.
- The privacy check in CI reads the real Release binary.

## Round 1 findings: checked one by one

| Id | Round 1 status | Now | Where (file:line) | Note |
|---|---|---|---|---|
| C1 | Fixed | Fixed | `UI/Theme.swift:139-168, 199-248`, `Battle/BattleSession.swift:272-274, 699-704` | `@GestureState`, `onDisappear`, scene phase, disabled and a refusing action all end the repeat |
| C2 | Fixed | Fixed | `Core/CoreProtocol.swift:510-530`, `Core/FrameAssembler.swift:250-253`, `Battle/BattleSpriteView.swift:365-394` | Roller and shears hinge are plain boxes, no art yet |
| H1 | Fixed | Partly | `Core/CoreHost.swift:8-62`, `Core/CoreGame.swift:207-218, 338-353` | `ai_turn` and the replay are off the main thread. But `end()` and Give up wait on the queue (`Core/CoreGame.swift:92`, `Battle/BattleSession.swift:720`), and a serial queue is not one thread (M2 below) |
| H2 | Fixed | Partly | `Battle/BattleSession.swift:580-642`, `UI/HudParts.swift:357-425` | Pass, Shove Off and Doodads work. Still missing: Puff Up dial and Mendglob target. `fire` is only ever sent bare (`Battle/BattleSession.swift:595`) |
| H3 | Fixed | Fixed | `Battle/BattleSession.swift:272-279` and every action | |
| H4 | Fixed | Fixed | `Core/CoreGame.swift:294-303, 338-369`, `App/AppModel.swift:96-103, 477-505` | See M1 for a new race in Carry on |
| H5 | Fixed | Fixed | `Battle/BattleSession.swift:372-381`, `App/AppModel.swift:389-407` | |
| H6 | Fixed | Fixed | `Core/CoreModels.swift:66-177`, `Battle/BattleSpriteView.swift:673-711, 782-804` | Cost note in L7 |
| H7 | Fixed | Fixed | `scripts/core-module.sh:12-20`, `Core/CoreBridge.swift:32-34, 39-48`, `.github/workflows/ios.yml:176-191` | |
| H8 | Fixed | Slipped | `Battle/BattleSession.swift:130-155, 519-526`, `Core/CoreGame.swift:240-244` | The core is idle in Plan. The renderer is not: see M7. The lean path also broke the HUD: see H1 and H2 |
| M1 | Partly | Partly | `Battle/BattleSpriteView.swift:526-531` | Names are still built per block per draw, three crop nodes, cost not measured. Draws are now more frequent (M7) |
| M2 | Partly | Partly | `Core/CoreGame.swift:176-182, 317-327` | Two full log reads and parses on the main thread at each turn start now (save plus the recovery point) |
| M3 | Not fixed | Fixed | `Core/BattleSetup.swift:113-141`, `UI/ResultsView.swift:186-196` | Help and Volley Points reach the core. Small text slip in L6 |
| M4 | Fixed | Fixed | `UI/Theme.swift:37-50`, `UI/RootView.swift:32` | |
| M5 | Partly | Partly | `App/AppModel.swift:523-572` | No adjustable readout, no key commands. H1 below makes the readout wrong for VoiceOver |
| M6 | Partly | Partly, one step back | `Feedback/SoundEngine.swift:214-227, 247-273, 339-350, 367` | Preload is now off the main thread. A file that is not 48 kHz is dropped with no log at all (round 1 said a warning was added). Route changes are not handled well (M3 below) |
| M7 | Partly | Partly | `Feedback/Haptics.swift:39-107`, `App/AppModel.swift:574-579` | Blast size now comes from `r`. The System Haptics switch is still not followed |
| M8 | Fixed | Fixed | `Core/FrameAssembler.swift:184-186, 260, 289-293` | The same switch causes H2 below |
| M9 | Partly | Partly | `Battle/BattleSpriteView.swift:525-580` | Shimmer, battered, root, Flaps and the Pot Lid are drawn. No damage numbers, Lean Lines, ghost lines or "Drop!" |
| M10 | Partly | Partly | `Battle/BattleSession.swift:463-466`, `UI/BattleView.swift:76` | No Pencil palm rejection |
| M11 | Fixed (no checksum) | Same | `Save/SaveStore.swift:44-63, 86-105`, `Save/SaveData.swift:97-105` | |
| M12 | Partly | Partly | `Resources/PrivacyInfo.xcprivacy:11-21`, `.github/workflows/ios.yml:196-227`, `project.yml:52-55` | File Timestamp is declared. `core/fixtures` and raw `content/` still ship in Release |
| M13 | Fixed | Fixed and extended | `Core/CoreGame.swift:146-173, 256-264` | Now rebuilds, then faults after two tries |
| L1 | Fixed | Fixed | `Battle/BattleSession.swift:293-306, 376-380` | |
| L2 | Fixed | Fixed | `Core/CoreModels.swift:101-103` | |
| L3 | Fixed | Partly | `Core/CoreHost.swift:33-55`, `Core/FFICoreBridge.swift:18-20` | One owner, yes. One thread, no (M2 below) |
| L4 | Fixed | Fixed | `Core/CoreGame.swift:210` | |
| L5 | Fixed | Fixed | `Battle/BattleSession.swift:669-679`, `UI/HudParts.swift:289` | |
| L6 | Partly | Fixed | `Battle/BattleSpriteView.swift:178-212, 842-878` | Camera now eases, holds in a drag, cuts with Reduce motion |
| L7 | Not fixed | Not fixed | `Battle/SpriteAtlas.swift:58-103` | Art still loads on the main thread at first use |
| L8 | Not fixed | Not fixed | `Core/ContentCatalog.swift` | |
| L9 | Partly | Partly | `Core/FrameAssembler.swift:247`, `Core/BattleSetup.swift:96-102` | `40 - steam_turn_left` and the wind ranges still live in Swift |
| L10 | Partly | Partly | | Same gaps as before |

## The web's crash class: checked

The web crashed right after a shot in portrait because a hint overlay looked up the bottom lens with a forced unwrap
while the lenses were joined. On iOS:

- There is no tutorial or hint overlay that looks up a lens. The first run prompts of UX 5.1 are not built yet.
- The whole app has one forced unwrap, in a fallback that cannot fail (`Feedback/SoundEngine.swift:205`). No `try!`, no `as!`.
- Lens lookups in the Tall HUD are optional: `layout.lenses.last?.viewport ?? .zero` and `layout.lenses.first?.viewport`
  (`UI/BattleView.swift:265, 354`). The scene hides extra lens layers and only indexes `lenses[i]` under `i < lenses.count`
  (`Battle/BattleSpriteView.swift:161-170`). `snap.shells[0]` is behind an empty check (`:316-317`).
- The HUD arrays that are indexed with 0 and 1 (`kettlePercent`, `crews`, `names`) are always built with two items
  (`Battle/BattleSession.swift:66-69`).
- The frame after Fire in portrait was walked through by hand: `apply`, `relayout`, `TallHud`, `BattleScene.render`,
  `LensLayer.update`, `FieldFX.ingest`, `AppModel.handle`, `updateAudio`. No trap was found.

So the web bug has no twin here. A few unchecked lookups remain that only a faulty core or bad data file could hit; they are L1 and L2.
Two bugs of a near kind were found: the HUD is right after a shot but wrong after an aim or a hand-off (H1, H2).

---

## High

### H1. The aim readout and Fine Tune numbers do not change when the aim changes

- Where: `Battle/BattleSession.swift:363-366`, `Core/FrameAssembler.swift:47-85`, core `battle.rs:2859` (`aim` sets `snap_aim`, not `snap_full`).
- Defect: in core v0.2 an `aim` gives a lean snapshot. The assembler updates `aim` and `preview` on it and marks the frame lean.
  The session rebuilds the HUD state only when a frame is full or the phase changed. So `hud.aim` keeps the old value.
  The stand-in core answers `aim` with a full frame (`Core/FakeCoreBridge.swift:68-72, 200`), so tests and UI tests cannot see it.
- Failure: drag to aim, lift. The dots are right, but the readout still shows the angle and power from before the drag.
  Open Fine Tune and tap plus: the dots move, the numbers stand still. The VoiceOver label ("Angle 45.0 degrees, power 60")
  is wrong too, and Fine Tune is the only way a VoiceOver user can aim. The same rule keeps the 2x label from flipping
  when 2x is tapped in flight (`UI/BattleView.swift:421`), until the next event.
- Fix: refresh the HUD on a lean frame when `aim`, `canFire`, `preview` emptiness or `speed` differ from the HUD's copy,
  or give the aim its own small observable as the drag band has. Make the stand-in answer `aim` with the lean fixture
  (`snapshot_aim_lean.json`). Add a session test on the real core: nudge, then expect `hud.aim` to match.

### H2. Couch Duel: after READY there is no aim, no preview and Fire looks locked

- Where: `Core/CoreGame.swift:195-198` (`ready`), `Core/FrameAssembler.swift:47-85, 186, 260, 285`.
- Defect: the full frame at a turn start is built while the hand-off card is up, so the aim is unset, the preview is empty
  and `canFire` is false. READY only clears the app's own flag. The core has nothing new to say, so the next frame is lean,
  and the lean path keeps the forts, aim, preview and `canFire` of that hidden frame. A lean aim frame is then ignored too,
  because the old aim is "not set" (`:64`).
- Failure: every Couch Duel turn but the first, with the default seats (Side by side), and after Carry on into a hand-off.
  The player taps READY. The readout shows `-- | --`, there are no preview dots during or after a drag, and Fire is cream
  and reads "locked" to VoiceOver. Fire still fires if tapped (it is only dimmed), and Quick Fire still works, so the player
  shoots blind. Picking a Hob or a shot, a Walk or a Recall forces a full frame and cures it for that turn.
- Fix: keep the last full core snapshot and rebuild the view from it when the hand-off state changes
  (in `ready()`, or in `assemble` when `handoffTo` differs from the one the last view was built with).
  Add a test: full frame with `handoffTo`, then a lean frame with `nil`, expect aim set, preview filled and `canFire` true.

### H3. After 16 sounds, each new sound cuts off the one before it

- Where: `Feedback/SoundEngine.swift:420-429`.
- Defect: the pool looks for a free voice with `player.isPlaying`. That flag stays true after a buffer has ended; it only
  turns false on `stop()` or `pause()`. Once all 16 voices have been used once, none ever reads as free. The loop then
  keeps the last voice it passed that is not on the kettle bus, which is the voice just before `nextVoice`: the newest one,
  not the oldest. `nextVoice` then stays where it was, so the same voice is taken again and again.
- Failure: from the 17th sound of a run on (the first turn or two), one blast frame plays like this: the blast starts,
  the block break stops it in the same frame, the creak stops the break. Only the last sound of each frame is heard, and
  a launch cuts the turn chime. The game sounds thin and broken, and the "3 of one sound in 50 ms" rule never matters.
- Fix: do not use `isPlaying`. Keep a `busyUntil` time per voice (start plus buffer length over rate), or clear a flag in
  the buffer's completion handler. Take a free voice first, else the one with the oldest start that is not on the kettle bus.
  Add a unit test on the pick rule with a fake clock.

---

## Medium

### M1. Carry on has no guard while the replay runs

- Where: `App/AppModel.swift:475-505`, `Core/CoreGame.swift:338-353`. `resuming` is set but no view reads it.
- Defect: after Carry on the card goes away and the map is live while the replay runs off the main thread
  (up to 1.5 s on an old phone by the UX target). Nothing blocks input and nothing shows progress.
- Failure: the player taps a level in that time. `begin` finds no session, `game.start` waits for the replay, ends it and
  starts the new fight with its own session. Then the Carry on task wakes up: `load` sets `recoveryLog` and `handoffTo`
  of the old save on the new battle, returns ok, and `AppModel` makes a second session on the same `CoreGame` without
  stopping the first. Two frame clocks now step one battle (double speed), each drains half the events, the title and
  setup are those of the old save, and the result may go to the stale session and never be stored.
- Fix: show a blocking "Loading" card while `resuming`. Refuse `begin`, Skirmish and Duel starts while it is set.
  Give `CoreGame.start` a counter and let `load` and `carryOn` drop their result when the counter moved.

### M2. The core queue is not one thread, and the `ai_turn` reply is thrown away

- Where: `Core/CoreHost.swift:33-55`, `Core/CoreGame.swift:216`, `core/castle-ffi/src/lib.rs:27-28, 83-91`.
- Defect: `queue.sync` runs its block on the calling thread (main). `queue.async` runs on a worker thread. So `cp_new`
  runs on main, and `ai_turn` and the resume replay run on another thread. `core/API.md` asks for one thread per handle,
  and a debug build of the core checks it and refuses with `wrong_thread`. CI builds the core in release, where the
  check is compiled out, so nothing shows. The reply of `ai_turn` is dropped, so any refusal is tried again every
  second with no word to the player.
- Failure: a developer builds with `scripts/build-xcframework.sh --dev`. The Rival never moves; the fight sits on
  "Rival aims" for good. Carry on is worse: the replay is refused, `load` returns `replayFailed`, and the app clears
  the saved fight (`App/AppModel.swift:501-502`). The per thread `cp_last_error(NULL)` store also only works today
  because `cp_new` and the error read share one block.
- Fix: give the handle a real thread (a `Thread` with a run loop or a small blocking queue), and make every call there,
  the quick ones too. Read the `ai_turn` reply: on a dead handle recover, on any other refusal raise a fault after a
  few tries. Add a CI job step that links the debug core and runs `testRealCoreWhenLinked`.

### M3. Route changes and pause: music can go silent, sound keeps playing under the Pause card

- Where: `Feedback/SoundEngine.swift:222-224, 240-244, 281-290`, `App/AppModel.swift:175-190`, `Battle/BattleSession.swift:472-477`.
- Defect 1: on `AVAudioEngineConfigurationChange` (headphones in or out with a new format) the engine stops and its
  player nodes lose what was scheduled. The handler restarts the engine and calls `play()` on the layer players, but
  nothing is scheduled again, and the wind, Squall and kettle loops are never looked at.
- Defect 2: `resumeMusicIfNeeded()` runs even when `engine.start()` failed (`try?`). `AVAudioPlayerNode.play()` on an
  engine that is not running raises an Objective-C exception that Swift cannot catch.
- Defect 3: there is no `routeChangeNotification` observer. UX 8.3 says: headphones pulled out, the game pauses and mutes.
- Defect 4: the Pause button does not stop sound at all (UX 8.2), so the flight whistle loop drones on while paused
  mid-flight. After an app switch, `sound.resume()` runs on `.active` while the Pause card is still up (UX 8.3 rule 4
  says audio comes back only after Resume). Any UI sound on the Pause card also restarts the engine through `prepare()`.
- Failure: connect AirPods mid battle: sound effects carry on, music and wind are gone until the next battle.
  Pull the headphones out: the phone speaker plays the game. In a rare case (engine cannot start, for example during a
  call, after a route change) the app can crash on return.
- Fix: on a configuration change rebuild as `rebuild()` does (stop music, start it again, clear `loops`). Only call
  `play()` when `engine.isRunning`. Observe `routeChangeNotification` and pause the session on `oldDeviceUnavailable`.
  Tie `sound.pause()` and `sound.resume()` to the session's `paused` state, not to the scene phase alone.

### M4. Every loop start leaks two audio nodes

- Where: `Feedback/SoundEngine.swift:453-458, 461-483`, `App/AppModel.swift:317-328`.
- Defect: `setLoop` makes a new player and varispeed, attaches and connects them, and on stop only calls `stop()` and
  forgets them. They are never detached. The flight whistle starts and stops on every shot.
- Failure: a 30 turn battle leaves 60 or more dead nodes on the SFX mixer, more with wind changes and the kettle whistle.
  Each connect on a running engine can click. The mixer pulls every input each render, so cost grows through a session.
- Fix: keep one player pair per loop id for the life of the engine and only change volume, or detach both nodes on stop.

### M5. The three music layers can start out of step

- Where: `Feedback/SoundEngine.swift:506-525, 288-290`.
- Defect: the shared start time comes from `engine.outputNode.lastRenderTime`. Right after the engine starts (first sound
  of a run, or after `rebuild()`) that time is not valid yet, `startTime` is nil, and the three `play(at: nil)` calls
  start one after another. `resumeMusicIfNeeded()` has the same shape.
- Failure: Stir and Peril sit a few ms off Base for the whole track: a flam or a hollow, phasey mix when they fade in.
  "Never restart a layer" means it does not heal.
- Fix: when there is no valid render time, wait one short timer tick and try again before starting any layer.
  In every resume path start all layers with one shared time. Add a debug check that compares the three
  `playerTime` sample times.

### M6. Collapse: what the landing does shows before the blocks fall, and the next turn starts mid fall

- Where: `Battle/FieldFX.swift:416-452, 732-765`, `Battle/BattleSession.swift:344-366`, `Core/CoreGame.swift:221-234`.
- Defect 1: the core has already dropped the chunk when the event comes. The ghost blocks then creak 300 ms, lean
  150 ms and fall. But the crush `hit` and `break` events, the kettle damage, the HUD numbers and a kettle pop from
  the crush all play at once, up to a second before the ghost lands on them.
- Defect 2: a Hob that fell is drawn at its landing spot at once with the tumble clip (`drop` carries `from` and `to`,
  they are not used). It stands at the bottom while its Nook still creaks above it.
- Defect 3: the core's settle is 60 ticks (0.5 s). The show takes about 0.45 s plus 40 ms per row plus the fall plus
  0.2 s. The next turn starts while blocks are in the air: banner, lens split in portrait, camera move, HUD back.
  The web added a "hurry" step for this; iOS has none.
- Defect 4: ghosts are placed from the old fort origin. If the fort sank in the same batch (`castle_drop`, then
  `collapse`), they hang too high by the sink.
- Fix: queue crush hits, breaks under the chunk and the Hob drop until `landTime` of that chunk (view only). Move the
  Hob from `from` to `to` with the fall. Hold `game.advance` (or the turn banner and relayout) while `fx.pieces` is not
  empty, or speed the rest up as the web does. Apply the `castle_drop` cells to the ghost origin.

### M7. The field is redrawn all the time, so Plan is not idle any more

- Where: `Battle/BattleSpriteView.swift:60-75, 149`, `Battle/FieldFX.swift:137-141, 341-345, 650-653`.
- Defect: the idle pose step is now 15 a second (`now / 66_000_000`), not 4. `fx.isActive` is true while any Hob
  clip is in `hobAnims`, and a Bonked entry is never removed, so after the first Bonk the scene draws at 60 fps for
  the rest of the battle. `cameraMoving` also counts hidden lens layers, so a rig that was easing when its lens was
  hidden (turn the phone from tall to wide mid ease) keeps the scene at 60 fps. Each draw still rebuilds every node
  in every lens (round 1 M1).
- Failure: heat and battery drain in the quiet Plan step on old phones, the thing round 1 H8 fixed.
- Fix: do not count the looping Bonked pose as active; draw it on the pose step. Count only shown layers in
  `cameraMoving`. Drop the pose step back to what the clips need (the idle frames are 400 ms; blinks can ask for a draw).

### M8. Kettle pop: the results screen cuts the slow motion, and a relit kettle stays popped

- Where: `Battle/BattleSession.swift:372-380`, `Battle/FieldFX.swift:306-325, 470-473`, `Battle/BattleSpriteView.swift:587-588`, `App/AppModel.swift:554-559`.
- Defect 1: the screen changes 1.2 s of real time after the result. The pop show needs about 1.8 s: 260 ms to the pop
  frame, an 80 ms stop, 1.2 s at quarter speed, then the sit frame. The win sting also starts in the first frame,
  before the kettle has cracked.
- Defect 2: `kettlePops[side]` is set once and never cleared, and the renderer shows the pop clip while it exists.
  In Volley Points a popped kettle relights at 150 HP: it keeps the popped art, and a second pop has no show.
- Fix: change screens when the effects are idle (with a cap near 3 s), and start the sting on the pop frame.
  Clear `kettlePops[side]` on `relight`.

---

## Low

### L1. Lookups that trust the core's numbers
`Battle/BattleSpriteView.swift:342` (`snap.forts.count..<fortNodes.count` traps with three or more castles), `:488` (a
negative side), `UI/BattleView.swift:546-547` and `Battle/BattleSession.swift:106` (`side` used as an index),
`UI/MapView.swift:295` (`names[picker]`). None can happen with today's core. Fix: clamp the side to 0 or 1 once, in the assembler.

### L2. A zero in `animations.json` can crash a walk
`Battle/FieldFX.swift:297` and `Battle/BattleSpriteView.swift:503`: `Int(t / bobFrameMs)` traps when `fort_bob.frame_ms`
is 0 or not a number (`Battle/Animations.swift:226`). The shipped file is fine (110). Fix: `max(1, ...)` at parse time.

### L3. A held Walk looks and sounds rough
`Battle/FieldFX.swift:474-479, 297-303`: each 4 cell step starts a new walk clip from zero, so the fort snaps forward and
slides, and a step sound plays on each restart (10 a second). Fix: add the new `dx` to what is left of the running walk.

### L4. Small audio items
`App/AppModel.swift:325`: the whistle pitch is not clamped to -7..+7 (a shell above the map goes to the top rate).
`Feedback/SoundEngine.swift:393`: the session hint is read on every duck and fade step; cache it and update on the notice.
`:328-333`: one failed `engine.start()` sets `failed` for the whole run; try again on the next foreground.
`:367`: a file that is not 48 kHz is dropped with no log. `Battle/FieldFX.swift:874`: a shot whose launch sound is `null`
in the manifest (`barn_raising`) plays `launch_lob`. The title jingle and the win sting overlap the music that follows
(`App/AppModel.swift:196-201, 418-420`). Not built: slow motion pitch drop, world loops ducked by voice, "quietly after a loss".

### L5. Small items in the rebuild path
`Battle/BattleSession.swift:338-341`: after a rebuild `fx` is not reset; a stale Bonked pose blocks that Hob's fire clip
and launch sound (`Battle/FieldFX.swift:579`). `Core/CoreGame.swift:366-367`: the extra `snapshot` and `terrain_all`
after `resume` build the whole map twice for nothing (the core already clears events and marks all chunks).
A panic that repeats (for example in `ai_turn`) ends in a fault, then Carry on replays into the same panic each time;
after the second fault offer to drop the save.

### L6. Volley Points text
`UI/MapView.swift:207`: the pre-battle sheet says "Round cap 10, then the Squall" for a Volley fight, which has neither.

### L7. Terrain cost
`Battle/BattleSpriteView.swift:673-711`: at a battle start, a resume or a rebuild, up to 456 textures are made in one
frame on the main thread. The Field Strip lens draws every chunk sprite for a 32 pt strip. Fix: build textures over a
few frames, and draw the strip from the height line.

### L8. Reduce motion still joins the lenses
`Battle/BattleLayout.swift:96-104`: UX 2.6.3 says the lenses never join with Reduce motion on. The layout joins them
always; only the camera cuts.

### L9. Workflow
`.github/workflows/ios.yml:38` uses `macos-latest` with no Xcode pin, so a runner image change can turn the build red
with no code change (the web job was pinned for this). Actions are pinned by tag, not by commit (`:41, 65, 242`).
`RUST_VERSION: "1.99.1"` (`:30`) is not used; `scripts/setup-rust.sh` takes 1.97.0 from `core/rust-toolchain.toml`.
Nothing fails if the test count drops. Both UI tests run on the stand-in. No iPad run. The debug core is never linked (M2).

### L10. Privacy check gaps
`.github/workflows/ios.yml:222-225` looks for C symbols only. Add `_OBJC_CLASS_$_NSUserDefaults` (category UserDefaults),
so a later `UserDefaults` or `@AppStorage` use cannot slip by. The check passes when the category is named, whatever
the reason code is.

---

## Privacy manifest: File Timestamp, C617.1

- Is the reason right? Yes. The Swift code uses no required reason API (no `UserDefaults`, no file dates, no uptime, no
  disk space; checked by search). The only hit is `fstat`, imported by the Rust static library. `C617.1` (file data
  inside the app's own container) is the only reason in that group that fits an app's own code. The other three are for
  showing dates to the user, files the user picked, and third party SDK wrappers.
- Is `fstat` really needed? Not by the game. Nothing in `castle-core` or `castle-ffi` opens a file (search for `std::fs`,
  `std::io`, `std::env` finds nothing). The import comes from Rust `std` itself, most likely the panic and backtrace
  code that can read the app's own binary to name symbols, which stays linked because `catch_unwind` keeps the panic
  path alive. The build log says "the Rust core calls fstat"; more exact is "Rust std links it, the rules never call it".
  This could not be proved here without the binary.
- What to do: keep the entry. Removing the import needs a nightly `build-std` setup and would cost the panic safety,
  which is worth more. Run the linker once with a map file (or `-Wl,-why_live,_fstat`) and note the true source in the
  build log, so the next person need not guess.

## Test gaps

72 unit tests pass, but the new bugs sit where the stand-in core and the real core differ, or where no test looks.

| Area | Test to add |
|---|---|
| Lean aim and the HUD | On the real core: nudge, then expect `session.hud.aim` to match (H1). Make the stand-in send lean aim frames |
| Hand-off | Full frame with a hand-off, READY, then expect aim, preview and `canFire` (H2) |
| Voice pool | The pick rule with a fake clock: 20 sounds, none cuts a voice that is still sounding (H3) |
| Carry on | Start a level while `resuming` is true; expect one session and the right setup (M1) |
| Thread rule | Link the debug core in one CI step and run a Rival turn and a resume (M2) |
| Audio session | A manual device script: headphones in and out, a call, the silent switch, pause mid-flight (M3 to M5) |
| Collapse | A drop with a Hob on it: the Hob is not at its landing spot before the chunk lands (M6) |
| Idle draw | Count draws over one second in Plan after a Bonk; expect the pose rate, not 60 (M7) |
| Volley | A relit kettle draws the lit art (M8) |
| Still missing from round 1 | Layout sizes, lifecycle, performance, accessibility audit, an iPad run |

## Suggested order of work

1. H1 and H2 together: one fix in how lean frames reach the HUD, plus the stand-in change so tests can see it.
2. H3: the voice pick rule.
3. M1 and M2: Carry on guard, one real core thread, read the `ai_turn` reply.
4. M3, M4, M5 in one pass over `SoundEngine`, then a device listen.
5. M6 and M8: order of the collapse and the pop show.
6. M7, then the low items.

## Fixes

Fixed on branch `castle-protect-plan`. Paths are relative to `apps/ios/CastleProtect/`. New tests are in
`apps/ios/Tests/CastleProtectTests/ReviewTwoTests.swift`. The stand-in core now answers `aim` with a lean frame
carrying `aim` and `preview`, as the real core does, so the stand-in no longer hides the lean path.

| Id | Status | What changed | Test |
|---|---|---|---|
| H1 | Fixed | `Core/FrameAssembler.swift`: a lean frame is merged into the last full snapshot (`aim` into the selected Hob, `preview`, phase, side, awaiting). Plan and draft frames rebuild the view from the merged state; flight frames keep the cheap path. `Battle/BattleSession.swift` refreshes the HUD on a lean frame when the aim, `canFire`, the selected Hob or the speed differ | `testFineTuneMovesTheReadoutOnALeanFrame`, `testLeanAimReachesTheHudOnTheRealCore` (real core, required in CI), `testSpeedLabelFlipsInFlight` |
| H2 | Fixed | The assembler remembers the hand-off state of the last view and rebuilds from the merged full state when it changes (READY), so aim, preview and `canFire` come back; a lean aim frame after READY is applied | `testReadyRebuildsAimPreviewAndFire`, `testCouchDuelAfterReadyOnTheRealCore` (real core, required in CI) |
| H3 | Fixed | `Feedback/SoundEngine.swift`: `VoicePool` keeps when each voice's sound ends (length over rate) and the buffer's `.dataPlayedBack` completion frees it, guarded by a generation so a stolen voice's old handler is ignored. A free voice first, else the oldest not on the kettle bus. `isPlaying` is no longer read | `VoicePoolTests` (4 tests, fake clock) |
| H8 / M1 (regression, M7 here) | Fixed | Idle pose step back to 5 a second (`Battle/BattleSpriteView.swift`); a Bonked Hob's looping pose no longer counts as active after its balloon lift; `cameraMoving` counts shown lenses only | `testBonkedHobLetsThePlanStepGoIdle` |
| M6 (regression, wrong format) | Fixed | A sound file that is not 48 kHz is skipped with an `os.Logger` warning | None (needs a bad asset) |
| M1 | Fixed | A blocking "Loading your fight" card while `resuming` (`UI/RootView.swift`); `begin` refuses while it is set; `CoreGame.start` bumps `startCount` and a load that finds it moved returns `.superseded` and touches nothing; Carry on drops its result when a session already exists | `testLoadIsDroppedWhenAnotherBattleStarts` |
| M2 | Fixed | `Core/CoreHost.swift`: one dedicated `Thread` with an ordered job queue runs every core call, `cp_new` and the quick ones included; the handle is freed there too. The `ai_turn` reply is read: a dead handle is rebuilt, any other refusal is retried, and three in a row raise a fault. CI now builds the debug core and runs the Rival, replay and lean aim tests on it | `testEveryCoreCallRunsOnOneThread`, `testRefusedRivalTurnRaisesAFault`, CI step "Thread rule on a debug core" |
| M3 | Fixed | Configuration change: voices, loops and music are cleared, the engine restarts, the music starts again from its first sample and the loops come back from their stored gains. `play()` only runs with the engine running (`prepare()` returns false otherwise). Route change `oldDeviceUnavailable` pauses the battle. The Pause card holds the sound (`SoundEngine.setHeld`), so nothing plays under it, coming back to the app does not restart it, and Resume does | `testPauseCardHoldsTheSound` |
| M4 | Fixed | A stopped loop's player and varispeed are disconnected and detached | `testLoopsLeaveNoNodesBehind` |
| M5 | Fixed | Music layers wait (20 ms ticks, up to 0.5 s) for a valid engine render time and start together on it; a layer that stopped restarts the whole track; Debug builds log if the layers' sample times differ | Device listen still needed |
| M6 | Fixed (defects 1 to 3) | `Battle/FieldFX.swift`: collapses are read first; crush and fall hits and breaks, a kettle pop from the crush and a Hob drop wait for the chunk's landing. The Hob is drawn at `from` and falls to `to` with its chunk; crushed blocks stay drawn until the ghosts land; the HUD keeps its numbers until then; the sim waits (no settle steps) while the fall show plays, so the next turn never starts mid fall. Defect 4 (sink in the same batch) is open | `testCrushAndHobDropWaitForTheLanding` |
| M7 | Fixed | See the H8 regression row | |
| M8 | Fixed | Results wait at least 1.2 s, then for the pop show and any collapse to end, capped at 3 s; the win or lose sting starts on the pop frame (or at the screen change if the frame never came). `relight` clears the pop | `testKettlePopShowAndRelight` |
| L1 | Fixed | Side clamped to 0 or 1 in the assembler; the fort node range no longer traps with more castles | |
| L2 | Fixed | `fort_bob.frame_ms` is at least 1 | |
| L4 | Partly | Whistle pitch clamped to -7..+7; the session hint is cached; a failed engine start is retried on the next foreground; a `null` launch sound plays nothing; the wrong-format warning is back. Slow motion pitch drop and voice ducking of world loops are not built | |
| L5 | Partly | `fx` is reset after a dead-handle rebuild | |
| L6 | Fixed | The pre-battle sheet says "N shots each, most damage wins" for Volley Points | |
| L9 | Partly | Unused `RUST_VERSION` removed; the run fails when fewer than 85 test cases pass; the debug core is linked in one step. No Xcode pin yet | |
| L10 | Partly | The privacy check also looks for `_OBJC_CLASS_$_NSUserDefaults` (UserDefaults) and matches names exactly | |
| Owner rule (design 00, 2.3) | Done | `Battle/BattleSession.swift` `aimMayStart(at:)`: an Aim Drag starts only on the active side's fort (its block box grown by 32 cells) or within 48 pt of the picked Hob, using the lens camera (`LensMap` in `Battle/BattleSpriteView.swift`). A press anywhere else never changes the aim | `testDragFromOpenSkyLeavesTheAim`, `testDragFromTheOwnFortAims` |
| Privacy | Kept | The File Timestamp entry stays, with a comment in `PrivacyInfo.xcprivacy`: `fstat` comes from Rust std's panic and backtrace code, kept linked by `catch_unwind`; the rules never call it. CI prints which archive members of `libcastle_ffi.a` import it | |

Not done this round: L3 (held Walk), L7 (terrain textures over frames), L8 (Reduce motion lens join), M6 defect 4.
