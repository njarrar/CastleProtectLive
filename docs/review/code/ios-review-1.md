# iOS code review 1

Scope: `apps/ios/` only (Swift 6, SwiftUI menus, SpriteKit battle view, C bridge to the Rust core).
Read against `core/API.md`, `docs/design/07-ux-ui-audio.md`, `docs/BUILD-WEEK-1.md`,
`docs/review/07-external-review-decisions.md` and `docs/review/code/core-review-1.md`.

Method: every Swift file, `project.yml`, the build scripts, the privacy manifest and the tests were read.
Core behaviour was checked in `core/castle-core/src/battle.rs` and `snapshot.rs` where a finding hangs on it.
Nothing was run on a device. Timings on phones are estimates taken from the core review's measurements.
No code was changed.

Paths below are relative to `apps/ios/CastleProtect/` unless they start with another folder.

## Counts

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 8 |
| Medium | 13 |
| Low | 10 |

## What is sound

- The bridge copies every core string and frees it once (`Core/FFICoreBridge.swift:61-65`). No string is kept past the call. The handle is freed once, in `end()` or `deinit`, and `start()` ends the old battle first.
- All core calls come from the main actor. The bridge class is not `Sendable`, so Swift 6 stops it from leaving. The API's "one thread per handle" rule holds today.
- Command names and fields match `core/API.md`. The setup uses only schema keys. The y flip is done in one place.
- Layout is a pure function of size and insets, with hysteresis, and is never saved. A resize ends the drag and keeps the aim.
- Aim Drag follows UX 3.1: 8 pt threshold, anchor at the touch, 12 pt cancel ring, second finger cancels, 150 ms Fire guard, Fire on finger up.
- Saves go to a temp file, then replace the old file, with one backup. Writes are off the frame path and flushed on background.
- Audio uses the `ambient` category, so the silent switch and the player's music are respected.
- Decoding is lenient, so a newer core does not crash an older app.

---

## Critical

### C1. A held Walk or Fine Tune key can repeat for ever, and then moves the Rival's fort

- Where: `UI/Theme.swift:148-191` (`RepeatButton`), `UI/BattleView.swift:260-266` (Tall HUD leaves the tree in flight), `Battle/BattleSession.swift:371-383` and `:410-414` (`nudge`, `walk` have no guard).
- Defect: the repeat loop is a `Task` kept in `@State`. Only `DragGesture.onEnded` cancels it. SwiftUI does not call `onEnded` when a gesture is cancelled by the system or when the view leaves the tree. There is no `onDisappear`, no scene phase check and no end to the loop. The loop holds the session, so it also outlives the battle.
- Failure 1: Tall layout. Hold Walk with the left thumb and tap Fire with the right. The HUD block inside `if !hud.inFlight` is removed, the gesture never ends, and `walk` is sent 10 times a second for the rest of the app's life. In flight the core refuses it and the phone buzzes "illegal" 10 times a second. On the Rival's Plan step the core accepts it (the core acts for the side whose turn it is), so the Rival's fort walks and its Steam drains. On the player's next turn their own Steam drains to 0. The next battle uses the same `CoreGame`, so it carries on there.
- Failure 2: hold Walk, a call or the Control Centre comes in. The touch is cancelled, the Pause card shows, and the fort keeps walking under the card because `walk` does not check `paused`.
- This breaks UX 3.10 rule 6 ("Nothing sticks").
- Fix: track the press with `@GestureState` (it resets on cancel) and cancel the task when it flips to false. Also cancel in `onDisappear`, when `scenePhase` leaves `.active`, and when the button's `enabled` input turns false. Add the guard in H3 so a stray call can never reach the core.

### C2. Level 1-7 cannot be read: props are never decoded or drawn

- Where: `Core/CoreProtocol.swift:643-688` (`CoreSnapshot` has no `props`), `Core/FrameAssembler.swift:139-262`, `Battle/BattleSpriteView.swift:165-299`.
- Defect: `snapshot.props[]` (cage bars, the captive, the Tick-Tock Crock, the turnip) is dropped at decode. Nothing draws them.
- Failure: level 1-7 "Hetty in a Jam" is a rescue. `content/levels/1-7.json` places `cage_bar` props and a captive. The goal is "Free Hetty" and one Pennant is "Captive takes no damage". The player sees neither the cage nor Hetty, so they must fire blind. Levels 1-8 to 1-10 unlock only after 1-7 is won. In Couch Duel the Starter Box kits hold Old Thumper and Old Turnip, and a Crock on the field is unseen until it blows.
- Fix: decode `props` (`id, side, kind, tag, x, y, hp, max, shot`), add a `PropView` list to `BattleSnapshot`, and draw them with a pooled node set and an HP state. Add a fixture test that loads 1-7 on the real core and expects props in the frame.

---

## High

### H1. All core work runs on the main thread: each Rival turn freezes the app

- Where: `Core/CoreGame.swift:113-120` (`ai_turn`), `:172-194` (`load` replays the whole log), `Battle/BattleSession.swift:173-186`.
- Defect: `ai_turn` is a blocking call made from the frame clock on the main actor. The core review measured 26 ms (Fair) to 58 ms (worst) on a server and expects 8 to 10 times that on a phone.
- Failure: on an iPhone 8 class device each Rival turn stops drawing and touch for about 200 to 500 ms (estimate). The think pose stutters, the Pause button is dead for that time, and the audio engine may glitch. Resume ("Carry on") replays a full battle the same way and can hold the main thread well past the 1.5 s target in UX 8.4.
- Fix: put the handle behind one serial owner off the main thread (an actor with a custom serial executor, or one `DispatchQueue`). The API only asks for one thread per handle. Send commands in, hand decoded snapshots back to the main actor. Until then, at least run `ai_turn` and `load` in that owner and show the think pose while waiting.

### H2. No Pass, Shove Off, Doodad, dial or target: a turn can lock

- Where: `Battle/BattleSession.swift` (no call sites), `UI/HudParts.swift:346-372`. `CoreCommand.pass`, `.shoveOff`, `.doodad`, `fire(dial:target:)` are only defined in `Core/CoreProtocol.swift:119-123`.
- Defect: the HUD can only pick a Hob, pick a shot, aim, walk, recall and fire. The core refuses Fire for a buried Hob (`hob_cannot_fire`) and expects Shove Off or Pass.
- Failure: the player's last standing Hob has its Loophole buried (on 1-1 the crew is one Hob). Fire shows the "dug in" icon and buzzes. There is no Shove Off key and no Pass key, so the turn never ends. The only way out is Pause, then Retry or Map. The same gap means Mend Bucket, Pot Lid, Puff Up and the Mendglob target, all in v0.1 scope, cannot be used.
- Fix: add Shove Off on the Fire spot when `dugIn` is true (15 Steam), a Pass key, Doodad chips in the tray (`hud.doodads` is already in the snapshot but is not decoded into the view), and the Puff Up dial. Show the refusal reason as a short banner, not only a buzz.

### H3. Session actions are not tied to the human's turn

- Where: `Battle/BattleSession.swift:354-440` (`fire`, `nudge`, `recall`, `pickHob`, `pickShot`, `walk`), `UI/BattleView.swift:158-159, 264-309`.
- Defect: the only gate is `allowsHitTesting(false)` and opacity on the HUD. The session methods send the command whatever the phase, whoever is awaiting, paused or not. The core does not check who sent a command: `fire`, `walk`, `aim` act for the active side, human or AI.
- Failure: with VoiceOver, Switch Control or Full Keyboard Access, an element that is dimmed to 0.4 but still in the tree (Tall layout: Fire, crew row, shot tray) can still be activated; hit testing is not part of that path. During the Rival's 1 s think pose that fires the Rival's own Hob with its old aim, or walks its fort. C1 reaches the same hole with no assistive tech.
- Fix: one guard at the top of every action: `guard hud.humanTurn, !paused, snapshot.phase == .plan else { return }`. Use `.disabled(...)` on the controls, not only `allowsHitTesting`, so assistive tech sees them as dimmed. Ask the core team to refuse turn commands when `awaiting` is `ai` unless they come from `ai_turn`.

### H4. Battle save has no rules version, no hash and no checksum

- Where: `Core/CoreGame.swift:152-194`, `Save/SaveData.swift:108-120`, `App/AppModel.swift:343-357`.
- Defect: the save is the setup plus the core's log. It does not store `cp_version().rules`, the state hash at save time or any checksum. `load` trusts any replay that is not refused. UX 8.4 rule 6 asks for a hash check and UX 8.1 for a counter and checksum.
- Failure 1: the app updates with a rules change while a battle is saved. The replay runs under new rules. Either a command is refused, the save is deleted and the player reads "This fight could not be saved" (wrong words for a load), or worse, the replay is accepted and lands in a different state: other HP, other hands, maybe already ended, and the result is recorded as real.
- Failure 2: a log entry that makes the core panic aborts the app (core review C3). "Carry on" then crashes every time it is tapped. Nothing marks the save as bad.
- Failure 3: the core review (H5) notes that AI memory is not in the log, so a resumed Rival aims like it is its first shot.
- Fix: store `rules`, `sim` and the `hash` reply next to the log. On load, refuse a save whose `rules` differs, with a plain message. After the replay, compare `hash`. Write a "resume in progress" flag before the replay and clear it after; if it is set at launch, drop the battle save and say so. Fix the notice text.

### H5. A win is not saved for 1.2 s and can be lost

- Where: `Battle/BattleSession.swift:207-214`, `App/AppModel.swift:266-273, 285-301`.
- Defect: when the core reports a result, the session waits 1.2 s in a free `Task` before it calls `onEnded`. Only `battleEnded` records Pennants and clears the battle save. `battleEnded` returns early if the session is no longer current.
- Failure: the kettle pops. In the next 1.2 s the player taps Pause then Map, or swipes the app away, or the system kills it in the background. Pennants are not recorded. The battle save from the last turn start is still there, so "Carry on?" offers the fight again from before the last shot.
- Fix: record progress and clear the battle save in the same frame the result arrives. Keep the 1.2 s only for the screen change. Cancel that task in `stop()`.

### H6. The ground is drawn as a height line, so the screen can disagree with the sim

- Where: `Core/FrameAssembler.swift:95-116`, `Battle/BattleSpriteView.swift:328-351`.
- Defect: the terrain grid is cut down to one height per 8 columns: the first cell from the top that is not air. The view fills everything under that line with one dirt colour. Material codes (Clay, Rock, Bedrock, Mud, Water) are ignored.
- Failure: a Delver shot digs a tunnel, or a blast on a slope leaves an overhang. The sim has air there; the view shows solid dirt. A later shell flies "through the ground". A crater narrower than 8 cells may fall between samples and not show at all. One loose cell high in a column draws as a full pillar. Water and Rock look like Loam, so the player cannot tell why a shot did nothing.
- Fix: draw the grid itself. Keep one texture per 256 x 256 chunk (`SKMutableTexture`, one byte per cell mapped through a small palette) and update only the chunks the snapshot sends. That also drops the `SKShapeNode` path rebuild and is cheap on old phones.

### H7. A release build can ship with the stand-in core and nobody is told

- Where: `scripts/core-module.sh:12-15, 24-27`, `Core/CoreBridge.swift:31-40`, `project.yml:52-55`, `.github/workflows/ios.yml` (simulator Debug only).
- Defect: if `Frameworks/CastleCore.xcframework` is missing, or has no slice for the platform, the script prints a note and exits 0. `canImport` turns false and the app builds with the fixture player. CI checks for the real core only on the simulator slice in Debug. No job builds the device slice or the Release config.
- Failure: the first signed archive is made on a Mac where the device slice was not built. The app passes its smoke test (Play opens a battle from fixtures), goes to TestFlight or App Review, and every battle is a canned loop.
- Fix: in the script, `exit 1` when `CONFIGURATION` is Release and the core is missing. Add `#if !DEBUG` plus `#error` in `CoreFactory` when `canImport(CastleCoreFFI)` is false. Remove `-useStandIn` from release builds. Add a CI step that builds `-sdk iphoneos -configuration Release CODE_SIGNING_ALLOWED=NO`.

### H8. The battle clock and the aim path do too much work per frame

- Where: `Battle/BattleSession.swift:154-186, 290-308`, `Core/CoreGame.swift:135-148`, `Core/FrameAssembler.swift:47-63, 139-262`.
- Defect: the clock is a `Task` that sleeps 8 ms, so it runs about 125 times a second and is not tied to the display. Each pass calls `cp_snapshot`, decodes the JSON with `JSONDecoder` and rebuilds the whole view model (every block, Hob, chip and string), even in the Plan step when nothing changed. Each touch move sends one `aim` command, and every command makes the next snapshot full (about 27 KB for 1-1, up to 2.3 MB after `terrain_all`). `drag` is `@Published`, so each touch move also re-runs the whole SwiftUI HUD.
- Failure: the core review measured 2.5 ms for one full snapshot after an `aim` on a server and expects 15 to 25 ms on a weak phone. With two or more per display frame, plus the decode and the HUD diff, an Aim Drag drops below 60 fps on old iPhones. That is the aim feel the day 3 gate judges. In flight, two snapshots land in some frames and one in others, so the shell steps unevenly. In Plan the app burns battery for no change.
- Fix: drive one step per display frame from `SKScene.update` or the existing `CADisplayLink`. Keep the newest aim in a field and send it once per frame. Skip `frame()` in Plan unless a command was sent. On a lean snapshot update only shells, phase and tick; do not rebuild forts. Draw the drag band in SpriteKit or give it its own small observable so the HUD does not re-run.

---

## Medium

### M1. The renderer rebuilds every sprite's state on every frame, three times in the Tall layout

- Where: `Battle/BattleSpriteView.swift:117-133, 165-299`, `Battle/SpriteAtlas.swift:148-153`.
- Defect: each lens has its own full copy of every node under its own `SKCropNode` (three crops in Tall, each an extra render pass). Each frame, for each lens, each block builds a name string (`"block_\(material)_\(wear)"`) and looks it up; each Hob runs `hobArtName` (lowercase, split, map); a new `Palette` with fresh `UIColor`s is made; texture, size, anchor and colour are set again even when nothing changed.
- Failure: about 100 blocks x 3 lenses x 60 fps is some 18,000 string builds and lookups a second, plus three off screen passes. On an iPhone 8 or iPad (6th gen) this is a likely cause of dropped frames and heat in portrait.
- Fix: resolve frames once when a full snapshot arrives and store them on the view model or the node. Touch a node only when its key changed. Build `Palette` once per colour set. Measure the crop cost in Instruments; if it is high, use one `SKView` per lens or scissor by clipping to opaque HUD bands.

### M2. The command log holds every drag sample and is re-read on the main thread each turn

- Where: `Core/CoreGame.swift:160-168`, `Battle/BattleSession.swift:299`, `App/AppModel.swift:107-114`.
- Defect: every touch move is an `aim` command and the core logs each one. `save()` asks for the whole log, parses it with `JSONSerialization`, writes it back out, wraps it in a second JSON layer as base64 `Data`, and the store writes the whole save file. This runs at every turn start and on every move to `inactive`.
- Failure: a 15 round battle with long drags holds tens of thousands of `aim` entries. The save grows from "a few KB" (UX 8.1) to hundreds of KB, the turn start hitches, and replay on resume gets slower each turn.
- Fix: send one aim per frame (H8), and drop every `aim` that is followed by another `aim` before the log is stored. Keep the log as a string, not `Data`. Do the pack step off the main actor.

### M3. Setup options that do nothing or do the wrong thing

- Where: `Core/BattleSetup.swift:70-73, 98-119`, `UI/DuelSetupView.swift:97, 118-124`, `UI/ResultsView.swift:151`.
- Defect: `winBy` and `help` are never sent to the core. With "Volley Points" the screen offers "Shots: 5, 10, 15" and that number is sent as `round_cap`.
- Failure: two players pick Volley Points with 5 shots. They get a Knockout fight that hits the Sudden Squall after round 5. A player with "Help: Lots ++" shown on the hand-off card gets no help at all.
- Fix: map Help to the API's `steam` and `aim` handicap fields, or hide it. Hide Volley Points until the core has it.

### M4. Text does not follow Dynamic Type, and "Large text" does nothing

- Where: `UI/Theme.swift:37-39`, `UI/RootView.swift:31`, `UI/HudParts.swift:200, 340`, `UI/SettingsView.swift:90`.
- Defect: every font is `.system(size:)` with a fixed size. `dynamicTypeSize(...)` then pins the tree to `.large` or `.xxLarge`, which has no effect on fixed sizes and overrides the system setting where a view would have used it. Chip names are 9 pt, draft names 11 pt; UX 7.2 sets a 12 pt floor.
- Failure: a player with large system text sees no change. Turning on "Large text" changes nothing in the game. Shot names are hard to read on a small phone.
- Fix: build the three steps in UX 7.2 into `Theme` (a scale factor read from settings, first set from the system size) or use `relativeTo:` fonts with a capped range. Let the tray scroll when it no longer fits. Raise the floor to 12 pt.

### M5. VoiceOver and keyboard play in battle fall short of the plan

- Where: `Battle/BattleSpriteView.swift:24-26`, `App/AppModel.swift:368-388, 413-416`, whole app for keys.
- Defect: the field is one element, "Battlefield", with the hint "Drag on your fort to aim", which a VoiceOver user cannot do. Only turn starts and the Squall warning are spoken. Hits, damage, Bonks, misses and the result are not. There is no adjustable action for angle and power. There are no key commands at all, so an iPad with a keyboard cannot aim, walk, pick or fire (UX 3.7, 7.7). The Fire value says "locked" with no reason.
- Failure: a VoiceOver user can open Fine Tune and fire, but never hears what the shot did. A keyboard user on iPad can do nothing.
- Fix: speak each `hit`, `bonk`, `miss`, `kettle_pop` and `win` in one short line per shot. Make the readout an adjustable element (swipe up and down steps the angle; a custom action steps power). Add `UIKeyCommand`s or `.keyboardShortcut` for the table in UX 3.7. Change the field's hint when VoiceOver runs.

### M6. Audio session events are not handled

- Where: `Feedback/SoundEngine.swift:36-57, 59-85, 98-113`, `App/AppModel.swift:133-147`.
- Defect: no observer for interruptions, route changes, engine configuration changes or media services reset. The session is never set inactive on background (UX 8.3 says release it). Sound resumes on `.active`, not on Resume. Files are read from disk on the main thread at first use. A file that is not 44.1 kHz mono float is skipped with no log and the synth blip plays in its place.
- Failure: after a media services reset the engine never starts again and the game is silent until relaunch. A 48 kHz or stereo sound asset added later never plays and nobody sees why. The first blast of a session hitches while its file loads. `player.stop()` on a busy node can block the main thread for a few ms.
- Fix: observe `AVAudioSession.interruptionNotification`, `.mediaServicesWereResetNotification` and `.AVAudioEngineConfigurationChange`; rebuild the graph on reset. Call `setActive(false, options: .notifyOthersOnDeactivation)` on background. Preload all cues off the main thread when the first battle loads and convert formats with `AVAudioConverter`. Stop the engine when no battle is up.

### M7. Haptics: start cost, no recovery, and two rules from the table are missed

- Where: `Feedback/Haptics.swift:28-35, 41-58`, `App/AppModel.swift:401-411`.
- Defect: `engine.start()` is called on the main thread before every pattern, and a new pattern and player are built each time. There is no `resetHandler` or `stoppedHandler`. Core Haptics does not follow the System Haptics switch, but UX 6.5 says ours must. `hobHit` ("Your Hob hit") is never played because `hit` events with target `hob` map to no kind. Blast size is judged from damage over 40, not from the blast band.
- Failure: with auto shutdown on, the first blast after a quiet spell pays the engine start on the frame it lands. A cluster shot makes one player per burst in one frame. After a server reset every play throws and falls to the UIKit generators.
- Fix: start the engine once when a battle opens and stop it when it closes. Cache one player per kind. Add the two handlers. Rate limit to a few patterns per 100 ms. Map `hit` on the player's Hob to `hobHit`. Take the blast size from the event's `r`.

### M8. The Rival's aim is shown

- Where: `Core/FrameAssembler.swift:198-203, 220-226`, `Battle/BattleSpriteView.swift:242-254`, `Battle/BattleSession.swift:58`.
- Defect: preview dots and the readout are built from the active side's selected Hob with no check on who controls that side. `core/API.md` says apps should not show the rival's live aim.
- Failure: during the Rival's think pose the field shows the Rival's preview dots and the HUD state holds its angle and power. In a campaign fight that is a free read of where the Rival last aimed.
- Fix: clear `preview` and `aim` in the assembler when the active side is not human (and during the hand-off card in a Couch Duel).

### M9. Fort reading aids in the snapshot are not shown

- Where: `Core/CoreProtocol.swift:297-312, 352-377`, `Core/CoreModels.swift:29`, `Battle/BattleSpriteView.swift:189-204`.
- Defect: `shimmer` is copied into `BlockView` and never drawn. `battered`, `fatigue`, `held`, `root`, `peephole`, room `flap` and `lid`, ghost `points` and shell `rot` are not decoded or not used. `lean_lines` is never asked. Damage numbers and the "Drop!" call-out are not shown.
- Failure: UX 3.11 depends on these. From round 10 the player cannot see which blocks are Battered and about to lose their reach. On 1-10 the boss weak spot (`root`) looks like any block, yet a Pennant asks the player to break it by round 4.
- Fix: decode the fields, add a shimmer and battered tint, a marker on `root`, the lid and flap states, and the Ghost line. Add Lean Lines on a long press of a block.

### M10. iPad multitasking, Pencil and system gestures

- Where: `Battle/BattleLayout.swift:73-76`, `Battle/BattleSession.swift:118`, `App/CastleProtectApp.swift:32-49`, `Battle/BattleSpriteView.swift:64-80`, `UI/BattleView.swift:66-68`.
- Defect 1: the 1.25 scale is chosen by device idiom, not by window size. In Slide Over or a one third Split View (320 pt wide) the Tall crew row needs five 64 pt portraits plus a 96 pt Fire button and does not fit.
- Defect 2: "Stay wide" and "Stay tall" cannot work on an iPad that allows multitasking; the request fails and the error handler is empty, so the setting silently does nothing.
- Defect 3: any second touch cancels the drag. With Apple Pencil a resting palm is a second touch, so the aim snaps back.
- Defect 4: system edge gestures are not deferred. A pull-back drag that ends near the bottom edge can be taken by the home gesture; the drag cancels and the aim returns.
- Fix: scale by the window's short side or size class. Hide the rotation setting on iPad or explain it. While a Pencil touch owns the drag, ignore `.direct` touches. Add `.defersSystemGestures(on: .all)` on the battle view.

### M11. Save file safety gaps

- Where: `Save/SaveStore.swift:29-33, 48-66, 76-81`, `Save/SaveData.swift:181-209`.
- Defect: `schema` is stored and never checked. Decoding is lenient at every level, so a damaged `progress` object reads as empty with no error, and the next settings change writes that empty progress over the good file. `counter` is said to pick the newer file but is never compared. When both files fail to decode, a fresh save overwrites them. Stale `save.<uuid>.tmp` files are never removed. Every slider step queues a full write and a backup copy.
- Failure: one bad field in `progress.pennants` (a bug in a later build, or a file from a newer schema) and the player's Pennants are gone after the first toggle in Settings. The backup is then one write away from the same fate.
- Fix: refuse to load a `schema` above `currentSchema` and keep the file untouched. Treat a failed decode of `progress` as a damaged file and fall back to the backup. Add a checksum over the payload. Before a fresh save overwrites two bad files, move them to `save.damaged.json`. Coalesce writes (one per 0.5 s). Clear old temp files at launch.

### M12. Privacy manifest and App Review risks

- Where: `Resources/PrivacyInfo.xcprivacy:11-12`, `UI/SettingsView.swift:50-54, 76, 90-91`, `project.yml:44-49`.
- Defect 1: the manifest lists no required reason APIs. The Swift code uses none that need one, but the linked Rust static library brings in `std`, which can reference `stat`, `fstat` and `mach_absolute_time` (file timestamp and boot time groups). This was not checked against the built binary.
- Defect 2: controls with no effect: Music, Voices, Subtitles, Large text, and a footer that names Take Back, which does not exist. Guideline 2.1 (completeness) covers this.
- Defect 3: the bundle ships `core/fixtures`, raw `content/`, every loose sprite and (by folder copy) the unused @1x atlas.
- Fix: run `nm -u` on the linked app and add the reason codes it calls for (`C617.1`, `35F9.1`) if the symbols are present. Hide dead settings until they work. Copy fixtures only in Debug and trim the art copy to what the app loads.

### M13. A dead core leaves a blank field with no message

- Where: `Core/FFICoreBridge.swift:40-53`, `Core/CoreGame.swift:135-148`, `Battle/BattleSpriteView.swift:118`.
- Defect: today a core panic aborts the app. Once the core returns a refusal for a panic, the bridge maps a NULL snapshot to `{"phase":"none"}`, which decodes fine, the scene hides every lens and the HUD hides its clusters. No notice is raised.
- Failure: after the core fix, a panic mid battle shows an empty sky for good. The player has to guess that Pause then Map is the way out.
- Fix: treat `reason == "panic"`, a NULL reply or phase `none` while running as a fault. Stop the clock, show "This fight hit a snag", and offer to rebuild from the last autosave (replay the stored log) or leave.

---

## Low

### L1. Tasks that outlive their owner
`Battle/BattleSession.swift:157-163`: `guard let self` holds the session across the sleep, so the weak capture does nothing and the session lives until `stop()`. `:209-213`: the end-of-battle task is not cancelled by `stop()`. Fix: keep the task handles and cancel them; take `self` only for the `tick()` call.

### L2. A bad terrain chunk can crash the app
`Core/FrameAssembler.swift:67-92`: `0..<chunk.h` traps when `h` is negative, and `w * h` is not bounded before the grid is allocated. Only a faulty core can send this, but the decoder is lenient by design. Fix: `guard chunk.w > 0, chunk.h > 0, chunk.w <= 4096, chunk.h <= 4096`, and cap the map size.

### L3. The bridge's thread rule is only a comment
`Core/CoreBridge.swift:11-13`, `Core/FFICoreBridge.swift:11`: nothing is marked `@MainActor`, and `deinit` can free the handle from any thread. `cp_last_error(NULL)` reads a shared static in the core. Safe today because `AppModel` owns the bridge for the app's life. Fix: mark the protocol `@MainActor` now, or move it to the one owner in H1.

### L4. `ai_turn` during the draft
`Core/CoreGame.swift:107-111`: sent on every clock pass while the draft waits for the AI, even while `holdTurns` is set. The core now picks for the AI by itself, so this path should be dead; if it does run, the core does not log it (core review H5) and the save cannot be replayed. Fix: remove it.

### L5. Recall feedback and a small key
`Battle/BattleSession.swift:390-394`: the reply is dropped, so a faded Pin (`pin_faded`) gives no buzz and Fine Tune still opens. `UI/HudParts.swift:280`: the "R" key is 40 x 28 pt, under the 44 pt floor. Fix: buzz on refusal, skip faded Pins, grow the key.

### L6. Camera and motion
`Battle/BattleSpriteView.swift:374-410`: the camera rect is set fresh each frame with no easing, so it jumps when a shell appears, when the side changes and between Plan and flight. `follow` tracks only the first shell of a split. `UI/SettingsView.swift:91`: Reduce motion never reads the system flag (UX 7.3). Shells are not turned to their `rot`. Fix: ease the rect over about 0.25 s (cut when Reduce motion is on), frame all shells, seed the setting from `UIAccessibility.isReduceMotionEnabled`.

### L7. Art loads on the main thread at first use
`Battle/SpriteAtlas.swift:65-103, 129-142`: two 2048 x 2048 pages are decoded when the first battle view is made, inside the 30 s first run budget, and are never dropped on a memory warning. HUD icons load from disk inside SwiftUI `body`. Fix: preload on a background queue at launch, and clear the icon cache on a memory warning.

### L8. Menu data can drift from the core
`Core/ContentCatalog.swift:65-125`: the app reads `content/` from its bundle while the core uses the copy compiled into it, and `fallbackLevels` is a third, hand typed copy. Fix: ask the core for names (Wasm has `default_content()`; the C ABI needs the same call) and drop the fallback table from release builds.

### L9. Game numbers that live in Swift
Not rule breaks today, but each is a number the core should own:
`Core/BattleSetup.swift:84-90` (wind ranges for Off, Light, Full), `Core/FrameAssembler.swift:195` (`40 - steamTurnLeft`), `Core/ContentCatalog.swift:41-61` (level unlock rule), `App/AppModel.swift:291` (no Pennants on a loss), `App/AppModel.swift:14-24` (headline: every win that is not a Kettle Pop reads "Clean Sweep!", so `squall`, `rescue`, `round_cap`, `total_hp` and `double_pop` are named wrong, and every loss reads "Flattened"), `App/AppModel.swift:393, 403` (large blast is damage over 40), `Core/FrameAssembler.swift:254-255` (Buttons are always 0, so the Buttons count never moves). Fix: take them from the snapshot or the level data; map `how` to its own headline.

### L10. Build script and small UX gaps
`scripts/core-module.sh:10, 30-31` deletes and copies the static library on every build, so every build relinks, and `canImport` results can go stale in an incremental build when the framework appears or goes. Small gaps against the UX doc: no edge help or Slow Drag (3.1), no pan on the Rival's turn (3.9), no three finger pause (8.2), Fire shows no Weight cogs (3.3), "Same again" does the same as Fight (decision 4a), default Sound and Voices are 70 not 85 and 80 (9.5), the pause on `inactive` autosaves twice per app switch.

---

## Test gaps

35 tests pass, but they sit on the easy parts. Missing:

| Area | Test to add |
|---|---|
| Stuck input | Hold Walk, remove the view or cancel the touch, and check no more `walk` commands are sent (C1). UX 3.10 asks for this test |
| Turn guard | Call `fire`, `walk`, `nudge` on the session while `awaiting` is `ai`, in flight and while paused; expect no command (H3) |
| Session | No test covers `BattleSession` at all: Quick Fire, the 150 ms guard, cancel ring restore, resize mid drag, second finger |
| Props and rescue | Start 1-7 on the real core and expect props in the frame (C2) |
| Soft lock | Bury the only Hob and expect a way to end the turn (H2) |
| Real core replay | Play 3 or more turns with Walk, Recall and a Trick Shell, save, load, and compare the `hash` reply, not only the turn count. Today `testRealCoreWhenLinked` plays one shot and compares `turnSeq` |
| Golden hashes | Call `cp_golden_hashes()` in the iOS test target so the arm64 static library is proven, not only the Rust test run |
| Save | Rules version mismatch, both files damaged, a newer `schema`, a damaged `progress`, a kill between backup and replace |
| Result | End a battle, call `leaveToMap` in the 1.2 s window, expect the Pennants to be stored (H5) |
| Decode | Full snapshot with every optional field, a lean one with terrain chunks, a chunk with bad sizes (L2), a `{"phase":"none"}` frame (M13) |
| Layout | iPad Split View sizes (320, 507, 678 pt wide), Slide Over, iPhone SE landscape with a crew of 5 |
| Lifecycle | Move to `inactive` and `background` mid flight and mid drag: aim restored, save written once, clock stopped |
| Performance | An XCTest measure block for `frame()` on a full snapshot and for an aim drag of 120 moves |
| Build | A device (`iphoneos`) Release build in CI, an iPad simulator run, and a UI test on the real core (the two UI tests use the stand-in) |
| Accessibility | An audit pass (`performAccessibilityAudit`) on the map, pre-battle, battle and results screens |

## Suggested order of work

1. C1 and H3 together (one guard, one fixed button).
2. C2 and H2 (the campaign cannot be finished without them).
3. H5 and H4 (results and saves that can be trusted).
4. H7 (cheap, and stops a bad upload).
5. H8, then H1 (aim feel first, then the Rival's turn).
6. H6, M9 (the field tells the truth).
7. The medium items by screen, then the low ones.
