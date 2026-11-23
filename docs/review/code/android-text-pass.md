# Android text pass

Android now reads every line a player sees or hears from `content/text.json`, and every name from content JSON. Follows `naming-decisions.md`, `content/text.md` and the content, assets and core passes. Only `apps/android` changed. Nothing is committed.

## Checks

| Check | Result |
|---|---|
| NDK | None in `~/android-sdk` (no `ndk` folder), so `scripts/build-android-libs.sh` was not run |
| `./gradlew testDebugUnitTest` | Pass: 153 tests, 0 failed, 15 skipped (the 15 need the native core). Was 143 with 8 failing, after the compile fix |
| Same, with the real core | Pass: 153 tests, 0 failed, 0 skipped. Core and JNI shim built for this machine into a scratch folder, as CI does (`-Pcastle.hostJni`) |
| `./gradlew lintDebug` | Pass. No new warnings (one old `ComposableNaming` on `SpriteImage`) |
| `./gradlew assembleDebug` | Pass. The APK carries `content/text.json`, `classes.json`, `materials.json` |
| `./gradlew assembleRelease` | Fails on purpose with no NDK: "a release build needs the native core". CI builds it with the NDK |

Before this pass the app did not compile: `GameSession.setMendTarget` clashed with the setter of `mendTarget`. The function is now `pickMendTarget`.

## 1. One string table

- `core/Text.kt` loads `content/text.json` (packed like the other content, copied by `build.gradle.kts`). It does dotted keys, `{placeholders}`, pools with no line twice running, `one` and `other` plurals, `byId` with a `default`, and never shows `_` note keys. A missing key shows the key, so a gap is easy to spot. Unit tests read the file from the repo.
- `core/Names.kt`: Hob short names from `hobs.<id>.short` (Old Thumper, Miss Quill, never cut at a space), the Rival's key and short name, the captive, and goal words (`levels.<id>.goals.<type>`, then `pennants.<type>`, then the level file).
- Class names come from `content/classes.json` (Digger, Bouncer). Shot "Good at" lines from `shots.<id>.good_at`.
- Gone from Kotlin: the "Best vs" table, the silly-name list (now `names.duel`), "Victory", "Gusty" (now "Full"), the Title Case `howText`, `brokeLine`, `whyText`, every hard-coded title, button, TalkBack line and error. A test fails if any of them come back.
- Core ids map to keys, never the core's English: `hud.why.<id>` for grey Fire, refused Fire, chips and the shot switch; `hud.why_short` for chip badges; `results.blow.<by>` for what broke you; `workshop.problems.<kind>` for fort checks (the core only sends English there, so `FortCheck.problemOf` reads it into a key). An unknown refusal shows `errors.move_failed`.
- Results follow the rule in `ResultText.kt`: campaign win shows the level's win title, the how line and the Rival's sign-off; other wins show `results.win.title.<how>`; a loss shows the title, the cause if it is not the same as the title, and Hetty's verdict. "Hetty says" shows only after 1-7 is cleared. Pools are picked once per result.
- TalkBack: fired, missed, shot summaries, Bonked, turn lines and the status line all name the Hob by its short name.
- The level card shows the Notice of Flattening, signed by the Rival.
- Field notes from `notes.*` show by the action. Only Bonk!, Thump!, Drop!, Snip! and Kettle Pop! shout.
- `SaveCompat.RULES` is 5. An old save shows `errors.saved_fight_old`.

## 2. Barks

`BarkLines` reads `old_thumper` (sounds still `bark_thumper_*`), `with_mate` (only when that Hob is on the crew), `with_rival` (only against a named Rival, with the short name), a bark's own `chance`, and `crew.win`, said after the winning Hob's line.

## 3. Sound cues

`lid_block` plays `doo_lid_bounce` (`lid` keeps the clang), `buried` `hob_buried_thlup`, `boss_phase` `cas_boss_horn`, `front` `wx_front_chime`, `threaded` `hit_threaded_zip`, `roller` `doo_roller_rumble` (`roller_stop` and `roller_done` 3 semitones down), `shears_jam` `doo_shears_jam`. `wx_squall_bell` is for the Squall only. A boss phase also shows its `levels.1-10.phases.<n>` line.

## 4. Rival look and idles

- `Sprites.team(side, human)`: side 0 blue, a person on side 1 orange (Couch Duel player 2), the game's side `rival`. Poses, portraits and prefetch use it. Neat Brigade units keep the Flattener art.
- Idle clips start at a random point in the loop (`random_start`), or at `start_offset_ms`. `AnimClip.seek` jumps there with no events.
- `AnimsAudioTest` reads the animation count from `animations.json` (366) and the sound count from `audio.json` `totals` (147). New tests cover the cues, rival clips and portraits, idle starts and the bark fields.

## 5. Rival data

`rival.name`, `rival.habit`, `pennants[].text`, `rival.think_ms` and `rival.roster` are read. Before a Skirmish fight the card shows `roster[seed % length]`; during the fight the app uses `hud.names[1]`. The Rival's pause is `hud.think_ms[1]`, else `app.json` `rival_think_seconds`. The turn banner shows the Rival's start taunt once, now and then a "thinking" line, else "{rival} aims".

## 6. Workshop

`FortGrid.HOME` is gone. The Workshop starts from `bp_home_3` in `content/blueprints.json`. Tests read the same blueprint.

## Tests changed on purpose

Wording tests now expect the table's words (round label, the Creaks, chip badges, best shot, last blow, nudge, peek labels, state words, double pop, old save). Fixture tests take the regenerated fixtures (kettle 200, map shifts, best shot 19, castle drop 3 cells). New: `TextTableTest` (8 tests) and 2 in `AnimsAudioTest`. Two native tests now expect rules 5 and the table's words for a resting Hob.

## Left for later

- Rival taunts for hits, misses and hurt are not shown yet. Only the start taunt is.
- `banners.weather` and the notice look are not two banner styles yet. Lines come from the table.
- Settings has no Captions, Mono or Colour set controls yet, so those keys are unused.
