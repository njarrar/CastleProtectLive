# Castle Protect: QA Playtest 1 (live web build)

Date: 22 Nov 2026. Target: https://njarrar.github.io/CastleProtectLive/

Played with Playwright, with real gestures: touch drags (many small steps) on the phone profiles, mouse drags and keys on desktop, real taps on Fire, Fine Tune, portraits, shot chips, Pause, Settings, the hand-off card and the Workshop grid. Nothing in the app code was changed.

## 0. What was tested, and on which build

Three web builds went live while this playtest ran. Each result below says which one it came from.

| Tag | Commit | JS asset | What ran on it |
|---|---|---|---|
| Build 1 | 196e36b (web.yml run 19) | `index-BGvaLJnX.js` | The whole desktop campaign 1-1 to 1-10, first runs on all 3 profiles, first Couch Duel (phone landscape), first feature pass (phone portrait) |
| Build 2 | 779e111 (run 20) | `index-BFVqJMtZ.js` | First runs again on both phones, feature pass on phone portrait and desktop, Couch Duel (portrait), Skirmish, Workshop, Test Yard, 1-3 (landscape), 1-5 (portrait), 1-7 and 1-10 again, WebKit smoke, keyboard and mouse checks |
| Build 3 | 5322b8b (run 21), **live now** | `index-ClfCXfTA.js` | First run to first shot, repeated drag check, sky drag check, edge reach check and a full 1-1 on all 3 profiles; the 3 videos |

Screenshot names: first letter is the profile, then a number. `b2-` means Build 2, `b3-` means Build 3, no tag means Build 1. All are in `docs/qa/playtest-1/screens/`.

| Letter | Profile |
|---|---|
| P | iPhone 13 portrait, 390 x 844, touch, Chromium |
| L | Phone landscape, 844 x 390, touch, Chromium |
| D | Desktop 1280 x 720, mouse. The honest campaign save |
| K | Desktop 1280 x 720, keyboard and mouse checks, and the Build 3 first run |
| X | Desktop 1280 x 720 where levels were opened with the `?debug` handle, to reach 1-7 and 1-10 early |
| W | iPhone 13 portrait in the WebKit engine |

Videos (one full 1-1 battle each, Build 3) are in `docs/qa/playtest-1/video/`:
`desktop-1280x720-level-1-1-full-battle.mp4`, `iphone13-portrait-level-1-1-full-battle.mp4`, `phone-landscape-844x390-level-1-1-full-battle.mp4`.

Limits of this playtest, said plainly:

- No real phone and no ears. Feel scores come from screenshots, video, timings and state read through the `?debug=1` handle.
- The player was a script that aims like a careful person: it pulls back until the dotted arc looks right, taps Fine Tune, fires, then corrects from where the Pin landed. It hit the Rival fort with about 80% of its shots. It does not read Lean Lines or plan collapses.
- Build 3 changed how an aim starts. Only the first run and 1-1 were replayed on it. The bugs below marked Build 1 or Build 2 were not all tested again on Build 3.
- The hotfix was not live at the start: run 17 was cancelled and run 18 failed to build (`battle.ts` called `free` on `LensCache` and `TerrainLayer`, which did not have it). Testing started once run 19 was green.

Checks the owner asked for:

| Check | Result |
|---|---|
| "The fight got stuck" after the first shot in 1-1 | **Fixed.** Not seen once in about 40 battles on Builds 1, 2 and 3, on any profile. The turn came back every time |
| Repeated drags leave only one preview arc | **Fixed.** 5 drags in a row on each profile, on all 3 builds: one arc, no old band. `K012`, `P144`, `L129` (Build 3), `D005`, `P005`, `L005` (Build 1) |
| Console errors, page errors, failed requests | **None** in any run on any build |

## 1. Scorecard

| Area | Score | Why |
|---|---|---|
| Stability | 8 | No crash, no error card, no console error in about 40 battles. Save, reload, resume and offline all worked. One rule event ends fights with no warning (bug M2) |
| Controls and aim feel | 6 | Drag, single arc, Fine Tune, hold to repeat, keys and Pins all work. But Fire can be lit and dead (M1), the pull runs into the screen edge and bends the angle (m3), and the pad sits on the fort in portrait (M7) |
| Collapse and impact feel | 6 | Blocks fall, "Drop!", "Bonk!", shake and slow motion fire on most hits. Damage numbers pile on top of each other, and the biggest collapse in the game (Fatigue) is never shown (M2) |
| Portrait layout | 7 | Stacked lenses read well: target on top, strip, your fort below, joined view in flight. Pad covers the fort (M7), Couch Duel setup is cut off (M8) |
| Landscape layout | 4 | Desktop is fine (7). On a phone the Rival fort is off screen or cut while you aim (M3), the pad covers the tray, Workshop cells are 5 px (M5), Duel setup and the hand-off card are cut |
| Clarity | 5 | "Drag to aim" and "Fire!" get a new player to a first shot. After that the game does not say why Fire does nothing, why a fight ended, where to press to aim, or what a shell does |
| AI fairness and challenge | 5 | Fair is too hard at 1-2, 1-4 and 1-10 for a player who hits 80% of shots, and trivial at 1-6 (Rival hit nothing) and 1-7 (won in 2 shots). A Retry replays the exact same fight |
| Pacing | 7 | About 10 to 12 s per round (your turn plus the Rival's). Fights run 7 to 15 rounds, 60 to 190 s. 1-7 is over in 18 s |
| Visual polish | 6 | Battle art, Hobs, Pins and Ghost lines look good. Title, map, pre-battle picture and results are plain. Several overlaps and one faded-fort look |
| Audio | 6 | Judged from code and network only. 100 to 140 sound files load with no error, music layers and loops are wired, barks have subtitles. Not heard |
| Performance | 7 | 60 fps on desktop Chromium when run alone, worst frame 17 ms. Ready in about 2 s. First load is 3.6 MB, over the 2 MB budget. No real phone number |
| Accessibility | 5 | Focus trap, focus ring, labels, a live status line, Reduce motion, shake setting, round and diamond side shapes. No text size, some 10 px text, no remap, shell card only on right-click |
| **Overall** | **6** | A solid, stable core loop that wins or loses on real aim. It is held back by phone landscape framing, a dead Fire button, a silent early ending, and a bumpy difficulty curve |

### Numbers behind the scores

First run to first shot (fresh install, Build 3):

| Step | Desktop | Phone portrait | Phone landscape |
|---|---|---|---|
| Page ready (title shown) | 2.1 s | 2.0 s | 2.0 s |
| Play tapped, 1-1 ready to aim | 3.0 s | 2.9 s | 3.0 s |
| One aim drag (about 2.5 s) and Fire | about 6 s | about 6 s | about 6 s |

The script is faster than a person. Allowing 4 s to read "Drag to aim", 8 s to drag and 3 s to find Fire gives about 18 to 20 s. That is inside the 30 s budget. There is no account, consent or language screen. Title: `K006`, hint: `K007`, `P139`, `L124`.

Pacing (1-1 at normal speed, Build 3): script plan time 3.1 to 4.4 s, shell flight about 2.9 s, full round 9.7 to 11.0 s, battle 58 to 66 s for 7 rounds. Campaign fights at 2x after the second shot: 9 to 12 s per round.

Performance: 60 or 61 fps during flight with one browser running (worst frame 17 ms). With 4 browsers on a 4 core box it dropped to 42 to 57 fps. WebKit in software mode gave a meaningless 4 fps and is not counted. First load to battle: 31 to 36 requests, 3.63 to 3.66 MB.

Audio, from code and network: `art/audio/audio.json` and `barks.json` load, then 100 (Builds 2 and 3) to 140 (Build 1) `.ogg` files with status 200 and no decode error logged. Audio unlocks on the Play tap. Sound and Music sliders and Mute all are in Settings, plus a Sound slider on the first title. Loops are wired for wind, squall, kettle whistle and shell flight. Bark lines show as subtitles (`P055`).

Other things that worked: Pause card with goals, Pass turn, Retry, Settings, Map, Give up (`P031`, `P064`). Rotate mid-plan and mid-flight in both directions, the fight carried on and the aim was kept (`P035`, `P037`, `P068`, `P070`, `X055`). Browser Back in a fight opens Pause (`P071`). Reload mid-fight shows "Carry on? Level 1-2, Round 5" and resumes to the exact same state (`P072`, `P073`, `X059`, `X060`). Offline reload, resume and a shot with the network off (`P074`, `P075`, `X061`, `X062`). Workshop place, erase, undo, save, reload (`P133`, `X045`). Keyboard: arrows, Shift+arrows, Space, Esc, Tab trap in Pause, R, F, M, 1 and 2 (`K001`, `K002`). Wheel zoom, right-drag pan, long-press Lean Lines (`K003`, `K004`). WebKit: full 1-1 win with no error (`W001`, `W002`, `W014`). The "Update ready" chip showed and worked (`D237`, `D239`).

## 2. Per-level table

Main run: desktop, one save, played in order from a fresh install. All of it ran on Build 1, because the page kept the old build until "Update" was tapped (see m14). Fair difficulty unless said.

| Level | Result | Rounds | Time | Notes |
|---|---|---|---|---|
| 1-1 First Lump | Win, "Sir Pudge dozed off!" | 8 of 8 | 78 s | First try aimed at the kettle: 8 hits, kettle went from 100% to 77%, fight ended on the round cap. Pennants 2 of 3. `D017` |
| 1-1 again (Build 3, all 3 profiles) | Win, Clean Sweep | 7 | 58 to 66 s | Aimed at the top Hob. Pennants 2 of 3, Buttons +250. `K026`, `L143` |
| 1-2 Two Hats | Loss, Loss, then Win | 10, 10, 9 | 97 s, 101 s, 82 s | Lost twice while spreading shots (8 of 9 hit the fort, no Bonk). The 2 losses were the same fight shot for shot. Won once every shot went at one Hob. `D019`, `D026` |
| 1-3 Kettle on the Knoll | Win, Clean Sweep | 13 (cap 12) | 158 s | Aimed at the kettle all fight: it still had 30%. "Win by Kettle Pop" not earned. `D066` |
| 1-4 Breezy Tops | Loss x4 on Fair, Win on Cozy | 10, 10, 10, 10, then 12 | 92 to 100 s, then 187 s | 3 of the 4 losses were the silent round 10 ending (bug M2), `D118`. Won only after Settings, Cozy. Fire was dead twice (bug M1) |
| 1-5 The Big One | Win, Clean Sweep | 11 | 130 s | First try. Same result on phone portrait, Build 2: 11 rounds, 131 s. `P113`, `P114`, `P131` |
| 1-6 Roof Trouble | Win, Clean Sweep | 7 | 85 s | The Rival fired 6 shots and hit nothing. 3 of 3 Pennants. `D157`, `D161` |
| 1-7 Hetty in a Jam (Rescue) | Win, "Rescued!" | 2 | 18 s | One Grand Dumpling and one Sunspear broke the cage. Same on Build 2: 2 rounds, 25 s. `D172`, `X003`, `X008`, `X011` |
| 1-8 Rummage Sale | Win, Clean Sweep | 10 | 106 s | First level with the Rummage. Fight was one tap from the sheet. `D174`, `D187` |
| 1-9 Over Loaf Hill | Win, Clean Sweep | 15 (cap 14) | 182 s | Rival fort is not on screen when you aim. Walk buttons show. `D190`, `D196`, `D200` |
| 1-10 The Topiary Keep (boss) | Loss x2 on Fair, Win on Cozy | 7, 8, then 10 | 82 s, 85 s, 128 s | All 4 of my Hobs Bonked by round 7 or 8 on Fair. Same on Build 2 (2 more losses, 100 s and 103 s). Won on Cozy, Buttons +550. `D202`, `D215`, `D236`, `X013`, `X014`, `X025`, `X028` |

End state: Puddingstone Downs 10/10, Pennants 19/30, Buttons 3135. `D238`.

Other fights:

| Fight | Profile, build | Result | Rounds | Time | Notes |
|---|---|---|---|---|---|
| 1-3 | Phone landscape, Build 2 | Loss, Swept | 10 | 97 s | Rival fort is a sliver at the screen edge. `L105`, `L106`, `L122` |
| Skirmish vs Sir Pudge, Fair, 10 rounds, Twin Puddings | Phone landscape, Build 2 | Loss, Clean Sweep | 10 | 132 s | 9 of 9 shots hit the fort, still swept. Quill was Bonked in round 1. First try got stuck on the dead Fire button (M1). `L058`, `L085`, `L086`, `L103` |
| Couch Duel, 10 rounds | Phone landscape, Build 1 | Player 1, Clean Sweep | 11 | 250 s | 22 turns, hand-off card every turn. `L020`, `L022`, `L027`, `L028`, `L035`, `L036` |
| Couch Duel, 10 rounds | Phone portrait, Build 2 | Player 1, Double Pop in the Squall | 13 | 336 s | 26 turns. Both kettles at 0%. `P077`, `P079`, `P084`, `P085`, `P111` |
| Test Yard | All 3, Build 2 | No result (by design) | | | Wind slider and Back work. See bug M4. `L080`, `L082`, `X047`, `X049`, `P135`, `P137` |

## 3. Bugs

Console errors for every bug below: **none**. No bug here threw an error or failed a request.

### Blocker

None on the live build. The 1-1 stuck fight is fixed.

### Major

**M1. Fire is lit and pulsing but does nothing on a rest turn.**
- Steps: fresh install, Play, 1-1. Tap the Grand Dumpling chip. Drag to aim, tap Fire. Wait for round 2. Tap Fire.
- Expected: the shot fires with the Plain Shot, or Fire is grey and says "Marge needs a rest".
- Actual: Grand Dumpling stays picked and is dimmed. Fire still says FIRE and pulses. Tapping it does nothing: no shot, no banner, no sound cue. The only way on is to guess that you must tap Clodpot. State read from the page: `fire: ready`, picked shot `ready: false, why: "Needs a rest: Plain Shot only"`.
- Also hit in 1-4 and 1-10 (a Knack with no uses left stays picked) and in Skirmish, where the script sat on round 4 for 2 minutes.
- Profile: all. Seen on Builds 1 and 2, in the first level. Not tested again on Build 3.
- Screens: `L083-b2-rest-turn-fire-lit-but-knack-picked.jpg`, `L084-b2-rest-turn-after-fire-tap-nothing.jpg`, `D135-1-4-try3-r6-fire-ignored.jpg`, `D235-1-10-try3-r7-fire-ignored.jpg`.

**M2. At the start of round 10 a fight can end at once, with no warning and the wrong reason.**
- Steps: 1-4 on Fair. Play so that both sides have hurt forts and few Hobs left when round 9 ends. In my run: Marge on 54 HP, the Rival's last Hob on 45 HP, both kettles at 100%, round 9 of 15.
- Expected: a "Fatigue" banner, the blocks seen falling, then the fight goes on or ends with a true reason.
- Actual: the screen cuts from the end of round 9 straight to the results. Every Hob on both sides is Bonked and both kettles lost HP in one step. Title "Double Pop", a loss, with the line "The Squall finished your kettle." The HUD said Round 9/15 and there was no Squall. Happened 3 times out of 3 with the same play. A fourth run ended the same way as "Swept".
- Cause seen in the code: `FATIGUE_ROUND = 10` in `core/castle-core/src/battle.rs` runs the collapse for both forts inside `round_start`, then `check_win`, so the view never gets to play it.
- Profile: desktop, Build 1. The core did not change in Builds 2 and 3, so it should still be there. Not tested again.
- Screens: `D118-1-4-results-loss.jpg`, `D127-1-4-results-loss.jpg`.

**M3. Phone landscape: you cannot see the fort you are aiming at.**
- Steps: 844 x 390, start 1-1, 1-2, 1-3, a Skirmish or a Couch Duel. Or play in portrait and turn the phone.
- Expected: both forts in view while you plan, as on desktop.
- Actual: the camera frames your fort. In 1-1 the Rival fort is cut in half by the right edge. In 1-3 a thin sliver shows. In 1-2 and on the Duel map it is off screen. You aim with only the first 30% of the arc to go on. (On desktop the same thing happens on the wide 1-9 map.)
- Profile: phone landscape, Builds 1, 2 and 3.
- Screens: `L124-b3-1-1-start-drag-to-aim-hint.jpg`, `L126-b3-1-1-pull-back-45deg-max-reach.jpg`, `L106-b2-1-3-battle-start.jpg`, `P068-b2-1-2-rotated-to-wide.jpg`, `L022-duel-start.jpg`, `L028-duel-r1-pick-hob.jpg`, `D190-1-9-battle-start.jpg`.

**M4. Test Yard hands you the Dummy's turn.**
- Steps: Workshop, Test Yard (or `#yard`). Fire one shot.
- Expected: you keep firing with your own crew.
- Actual: after your shot the HUD turns orange, the angle reads 135, the portraits and shots are the Dummy's crew, and you now fire at your own fort. The label says "Round 2/15". Hobs also "need a rest" although the Modes screen says "Try any shot. Endless uses."
- Profile: all 3, Build 2.
- Screens: `X049-b2-test-yard-after-shots.jpg`, `L082-b2-test-yard-after-shots.jpg`, `P137-b2-test-yard-after-shots.jpg`.

**M5. Workshop cannot be used on a phone in landscape.**
- Steps: 844 x 390, open the Workshop.
- Expected: a grid you can tap.
- Actual: the whole fort grid is a thumbnail about 80 px wide. Each cell measures 5 x 5 px. (Portrait cells are 33 px and desktop 35 px, which is fine to use but under 44.)
- Profile: phone landscape, Build 2.
- Screen: `L077-b2-workshop-open.jpg`. Compare `P133-b2-workshop-placed-blocks.jpg`.

**M6. Fair is too hard in places and Retry replays the same fight.**
- Steps: play 1-2, 1-4 and 1-10 on Fair, hitting the Rival fort with most shots.
- Expected (BUILD-WEEK-1, review 07): early levels teach, with a Rival rated Aim 1 of 5.
- Actual: 1-2 lost 2 of 3, 1-4 lost 4 of 4, 1-10 lost 4 of 4, Skirmish on Fair lost, 1-3 on the phone lost. In Skirmish the Rival Bonked Quill with its first shot. Then 1-6 was a walk (Rival 0 hits in 6 shots) and 1-7 took 2 shots. A Retry uses the same seed, so the same inputs gave the same loss twice in 1-2 and 3 times in 1-4.
- Also: aiming at the Heartkettle, the clearest target on screen, cannot win. 8 hits in 1-1 took it to 77%. 13 rounds in 1-3 ("Kettle on the Knoll", goal "Win by Kettle Pop") left it at 30%.
- Profile: all. Builds 1 and 2.
- Screens: `D118-1-4-results-loss.jpg`, `D215-1-10-results-loss.jpg`, `X028-b2-1-10-results-loss.jpg`, `L103-b2-skirmish-results.jpg`, `L122-b2-1-3-results-loss.jpg`.

**M7. Portrait: the Fine Tune pad sits on top of your fort, where an aim now has to start.**
- Steps: iPhone portrait, 1-1, Build 3. Drag once from the fort.
- Expected: the pad opens clear of the fort and the Hob.
- Actual: the pad covers the lower half of the fort and the kettle, edge to edge. On Build 3 an aim must start on or near the fort, so the pad now blocks half of the only place you can press. In phone landscape the same pad covers the shot tray and the "2" badge on Grand Dumpling.
- Profile: phone portrait and landscape. Seen on all builds, worse on Build 3.
- Screens: `P141-b3-1-1-pull-back-45deg-max-reach.jpg`, `P144-b3-1-1-after-5-drags-arc-check.jpg`, `L126-b3-1-1-pull-back-45deg-max-reach.jpg`, `L005-1-1-after-5-drags-arc-check.jpg`.

**M8. Couch Duel setup does not fit a phone.**
- Steps: map, 2 Players, on 390 x 844 or 844 x 390.
- Expected: both player cards and all rules in reach.
- Actual: portrait: the name box runs off the right edge and the dice button is gone. The pinned Quick start and FIGHT cover the Wind row. Landscape: the Player 2 card is cut by the right edge and the rules sheet hides under the buttons. On both, Player 1's crew badges are blank white circles (only the Zinger bolt shows) while Player 2's are fine.
- Profile: both phones. Builds 1 and 2.
- Screens: `P077-b2-duel-setup.jpg`, `L020-duel-setup.jpg`.

### Minor

**m1. The win screen names the Rival's shot as "Best shot".** Steps: win 1-1. Expected: your best shot. Actual: "Best shot: Hedge, 130.9 / 61, 388 dmg". Hedge is the Rival's Hob and 130.9 is a Rival angle. Same on 1-7, 1-8 and 1-9 wins. All profiles, all builds. `K026-b3-1-1-results.jpg`, `D017-1-1-results.jpg`, `P062-b2-1-1-results.jpg`.

**m2. Back from Settings drops you straight into the fight, not Pause.** Steps: in a fight, Pause, Settings, tap the arrow. Expected (Build 2 notes): back on the Pause card. Actual: the fight is live at once. Phone portrait and desktop, Builds 1 and 2. `P067-b2-1-2-back-from-settings.jpg`, `X054-b2-1-2-back-from-settings.jpg`.

**m3. The pull runs into the screen edge and bends the angle (Build 3).** Steps: press on your fort and pull back toward 45 degrees at full power. Expected: 45.0 at 100. Actual: desktop 40.0 at 100 (asked 30: got 28.0, asked 64: got 58.5). Portrait 42.0. Phone landscape 45.0 is fine, 30 gives 28.0. Your fort is near the left edge and the pull goes left, so the finger hits the edge and the anchor slides. The first 1-1 aim is fine because it is a short pull. `K009-b3-1-1-pull-back-45deg-max-reach.jpg`, `P141-b3-1-1-pull-back-45deg-max-reach.jpg`, `L126-b3-1-1-pull-back-45deg-max-reach.jpg`.

**m4. Nothing tells you where to press to aim (Build 3).** The hint still says only "Drag to aim". In portrait a drag that starts in the sky of the bottom lens does nothing at all: no aim, no pan, no message. In landscape and on desktop it pans, and the re-frame button shows. `P139-b3-1-1-start-drag-to-aim-hint.jpg`, `P140-b3-1-1-sky-drag-pans-not-aims.jpg`, `K008-b3-1-1-sky-drag-pans-not-aims.jpg`.

**m5. Hand-off card is cut off in phone landscape.** READY is half below the screen edge. It can still be tapped. Build 1. `L027-duel-handoff-card-1.jpg`. Portrait is fine: `P084-b2-duel-handoff-card-1.jpg`.

**m6. Damage numbers stack on each other.** A hit that breaks several blocks draws 3 or 4 numbers and "Bonk!" in one spot. All profiles and builds. `D157-1-6-r1-impact-collapse.jpg`, `L035-duel-r8-impact-collapse.jpg`, `X025-b2-1-10-r5-impact-collapse.jpg`.

**m7. 1-7 Rescue is over in 2 shots.** 18 s on Build 1, 25 s on Build 2. The Rival fort never comes into play. "Free her by Round 6" is no test. `X008-b2-1-7-r1-impact.jpg`, `X011-b2-1-7-results-win.jpg`.

**m8. Keyboard players keep the "Drag to aim" hint for the whole of 1-1.** It only clears on a drag. Also F re-centres the camera but leaves the zoom changed. Desktop, Build 2. `K001-b2-keyboard-aim-before-space.jpg`, `K003-b2-zoomed-and-panned.jpg`.

**m9. The shell card does not say what the shell does, and only opens on right-click.** It shows name, weight and "Best with: lobber". Touch players cannot open it. Desktop, Build 2. `K005-b2-shell-card.jpg`.

**m10. "Carry on?" only shows on the title.** Reload a fight from a `#map` link and you land on the map with no offer. The save is kept and is offered the next time the title opens. Build 1. `P029-title-carry-on-card-from-earlier-fight.jpg`.

**m11. Map on phone landscape.** The "2 Players" pill covers level 9 and its name. The Pennant boxes under level 1 are cut by the panel edge. On all sizes the name of a finished level is white on cream and cannot be read. `L018-map.jpg`, `L056-b2-map.jpg`, `D018-map-before-1-2.jpg`.

**m12. First load is 3.6 MB.** The plan asks for under 2 MB for the Cold Open (07 section 1.3). 31 to 36 requests before the first fight. Build 3.

**m13. Deep links skip the unlock.** With only 1-1 won, `#skirmish`, `#workshop`, `#modes` and `#yard` all open, though the map hides Modes and Workshop until 1-5. Build 2. `L057-b2-modes.jpg`, `L058-b2-skirmish-setup.jpg`.

**m14. Returning players can stay on an old build.** The "Update ready" chip only shows after about 8 s on the title or map. The desktop save played for 25 minutes and 15 page loads on Build 1 while Builds 2 and 3 were live, because each visit moved on before the chip came. A hotfix will not reach a player who taps Play fast. `D237-title-after-campaign-update-chip-check.jpg`, `D239-after-update-tap.jpg`.

**m15. The results line passes the cap with no word on the Squall.** 1-3 ended "Round 13" on a cap of 12 and 1-9 "Round 15" on a cap of 14. The HUD does show "Squall in 3" (`L035`), so this is only the results line.

### Polish

- Your own fort is drawn pale and see-through on your turn. It looks switched off. `K007`, `P139`, `P085`.
- A grey slab shows under some forts and at the bottom of slopes. `D196-1-9-r1-rival-turn.jpg`, `D157-1-6-r1-impact-collapse.jpg`.
- In portrait a small pencil (the save tick) floats in the sky of the top lens and sits on the Rival's crew icons. `P056-b2-1-1-r2-rival-turn.jpg`, `P037-1-2-rotate-back-mid-flight.jpg`.
- The class badge covers the first letter of a chip name: "ole Mail". `X014-b2-1-10-battle-start.jpg`.
- Bark subtitles land on the damage numbers. `P055-b2-1-1-r2-impact.jpg`.
- The aim arc leaves the top of the screen on steep shots and the camera does not follow. `K012`, `D005`.
- While the Rival aims, the camera shows the Rival, not your fort, on desktop. `D013-1-1-r2-rival-turn.jpg`.
- Title screen and the pre-battle map picture are flat colour with no art. `K006`, `D019-1-2-prebattle.jpg`.
- The 1-10 pre-battle sheet is taller than 720 px and the draft row is cut. `X013-b2-1-10-prebattle.jpg`.
- Chip names are 10 px text. Workshop cells are 33 to 35 px.
- Fixed in Build 2, seen on Build 1 only: two black strip borders left across the joined flight view in portrait. `P006-1-1-first-shot-in-flight.jpg` (before), `P049-b2-1-1-first-shot-in-flight.jpg` (after).

## 4. Top 10 fixes, by player impact

1. **Make Fire honest (M1).** If the picked shot cannot fire, switch to the Plain Shot or grey the button and say why. It bites in round 2 of the first level.
2. **Show the target in phone landscape (M3).** Zoom out to hold both forts while planning, or pan to the target and back. Today landscape on a phone is aiming blind.
3. **Fix the round 10 Fatigue ending (M2).** Warn a round ahead, play the collapse, and give the true reason on the results. Do not end a fight between two frames.
4. **Smooth the Fair curve and change the seed on Retry (M6).** 1-2, 1-4 and 1-10 need to be winnable by a player who hits the fort. Make kettle damage matter, or stop pointing players at the kettle.
5. **Move the Fine Tune pad off the fort and off the tray, and say "Drag from your fort" (M7, m4).** In portrait, let a drag in the bottom lens sky pan or show a nudge.
6. **Stop the Test Yard from giving you the Dummy's turn (M4).** Also drop rest and rounds there.
7. **Fit the phone screens: Couch Duel setup, Workshop in landscape, hand-off card, map pill (M8, M5, m5, m11).**
8. **Keep the angle true when the pull meets the screen edge (m3).** Lock the angle while the anchor slides, or frame the fort further from the edge.
9. **Fix the small truths: "Best shot" owner, Back from Settings to Pause, faster "Update ready" (m1, m2, m14).**
10. **Make hits and shells readable: spread the damage numbers, and give touch players a shell card that says what the shell does (m6, m9).**

## 5. Day 3 gate view (review 07)

| Gate item | Verdict | Why |
|---|---|---|
| Aim feel | Pass with fixes | The drag, single arc, Fine Tune and Pins are sound. Fix M1, m3 and m4 before a real phone test, since Build 3 changed where an aim starts |
| Collapse feel | Not proven | Collapses happen and read in stills and video, but numbers pile up and the Fatigue collapse is never seen. Needs a hand on a real phone, with sound |
| Portrait stacked lenses | Pass | Top lens, Field Strip, bottom lens and the joined flight view all work and survive rotation, reload and offline. Move the pad (M7) |

## 6. Web fixes

Scope: `apps/web/` only. The rule and balance findings (M2 Fatigue at round 10, M6 the Fair curve and the Retry seed, the Test Yard rest rule) are with the core work. Every fix below has a Playwright test in `apps/web/tests/qa1.spec.ts`, run on desktop Chromium, iPhone 15 portrait (WebKit) and Pixel 7 landscape (Chromium); the layout tests also set 390 x 844 and 844 x 390 on every project. The whole suite passes at the root base and with `VITE_BASE=/CastleProtectLive/`. After screenshots, 390 x 844 and 844 x 390 each, are in `docs/qa/playtest-1/fixes/`.

| # | Finding | What changed | Test | After |
|---|---|---|---|---|
| 1 | M1 Fire lit and dead on a rest turn | Fire is `ready` only when the picked shot is ready (core `hud.shots`). At each turn start, and when the Hob changes, a picked shot that cannot go is swapped for the Plain Shot. A Knack picked by hand on a rest turn greys Fire, stops the pulse and shows the core's reason ("Needs a rest: Plain Shot only") by the tray in landscape and by Fire in portrait; a tap on grey Fire says the reason and fires nothing | `M1` | `F01a`, `F01b` |
| 2 | M3 Rival fort off screen in phone landscape | The plan frame holds both forts whenever blocks still draw at 8 px or more (was 12 px), and the 55/45 lean never pushes a fort out. 1-1 at 844 x 390 now shows both forts at 11 px blocks. When they cannot fit (1-9), your fort and the arc are framed and a "Rival fort" marker sits on the screen edge at the fort's height. An aim arc that leaves the screen gets an arrow where it leaves | `M3` (3 tests) | `F02a`, `F02b`, `F02c` |
| 3 | M7 Fine Tune pad on the fort | Portrait: a two-column pad docked in the bottom lens on the side away from your fort (right for side 0, left for side 1), above the readout. Phone landscape: under the top strip on the right, clear of the tray, Fire and both forts. Everywhere it hides while a finger aims and while the lenses are joined | `M7` at both sizes | `F03` |
| 4 | m3 Pull into the screen edge bends the angle | Full power is reached before the finger meets the edge (the pull for 100 is 40% of the short side, or the room left toward the edge, never under 64 px). Once the finger is on the edge, the angle keeps the direction it had and only power follows. The anchor no longer slides. Asked 45, got 45.0 at 100 on all three projects | `m3` | `F04` |
| 5 | M5 Workshop cells 5 px in landscape | Cells are never under 24 px. A short landscape screen puts the grid on the left and the palette and buttons on the right; the screen scrolls when it must | `M5` at both sizes | `F05` |
| 6 | M8, m5 Couch Duel setup and hand-off cut off | The player cards shrink to the width they have (rows wrap, the name box shrinks, the dice stay). Player 1's crew badges and crest are coloured again (a `.round` rule painted them white). The pinned buttons get a fade so rows under them read as scrolled. Cards and sheets scroll inside the scrim; the hand-off card is compact on a short screen, so READY is fully on screen at 844 x 390 | `M8`, `m5` at both sizes | `F06a`, `F06b` |
| 7 | M4 Test Yard hands you the Dummy's turn | The far side is a lone Straw Stuffer, so the core's "a side of dummies passes itself" applies; the view treats only side 0 as human there. The round label reads "Test Yard". The rest rule in the Yard is core work | `M4` | `F07` |
| 8 | m1 "Best shot" names the Rival's shot | The core result has no per-side best shot, so the adapter keeps one per side (damage to the other side only) and the results show the winner's (the better one on a draw). Older saves keep their one best shot on its side | `m1` (duel and unit) | `F08` |
| 9 | m2 Back from Settings drops into the fight | Confirmed on the current build: Back went straight into the live fight. Back from Settings, by the arrow or the browser Back, now lands on the Pause card, still paused | `m2`, `H1`, `H2` | `F09` |
| 10 | m12, m14 First load 3.6 MB and a slow "Update ready" | See below | `m12`, `m14` | `F10` |

First load. The playtest's 3.6 MB was mostly two downloads of the same files: the page fetched the core (1.07 MB) and the atlas (0.84 MB), and the service worker fetched both again with a cache-busting revision. Now the core sits in a content-hashed folder (`core/<hash>/`), every file with a hash in its URL is precached with no revision, so the worker's install reuses the copy the page just loaded. The install icons (145 KB) left the precache (the browser fetches them itself). Sound waits: only the first-shot effects load at the Play tap, the other effects 20 s later, the battle music base after the first-shot effects, and its Stir and Peril layers at least 15 s later (they join on a bar line). The @2x atlas (1.9 MB) waits 60 s in the very first fight. Map and Workshop art live in the one @1x atlas page the first fight needs, so there is nothing separate to lazy load there. Measured on a phone profile (390 x 844, 3x, gzip as the host serves it), fresh install:

| Point | Before | After |
|---|---|---|
| Title ready | 1.4 MB | 1.4 MB |
| 1-1 ready to aim | 5.0 MB, 57 requests | 1.5 MB, 46 requests |
| 10 s into 1-1 | 7.5 MB | 2.3 MB (incl. music base and install icons) |

"Update ready". The app now asks for a new version as soon as it registers the worker, and again when it comes back to the front. With the small, hash-keyed precache a new build installs almost at once: the chip showed 0.2 to 0.4 s after the title in the after screenshots, and the test requires under 2 s. It shows on the title, the map and Modes, never in a fight.

Core fields. The adapter also reads the fields the core work adds for these findings, when the core sends them: `hud.fire` (Fire lit or grey, with its `text`), `hud.shots[].text`, `result.best_shot` (the winner's) and `hud.fatigue_in` (the round label then says "Fatigue in 3", "2", "1" before round 10, for M2). Against a core without them, the web-side fallbacks in the table apply. The suite passed with the core built at the start of this work and again with one built from the core work in progress, which sends those fields.

Not changed here: m4 (where to press to aim), m6, m7, m8 to m11, m13, m15 and the polish list.

## 7. Core fixes

Scope: `core/` and `content/` only. Rules version 3 (`cp_version().rules`), so saves from rules version 2 do not resume. Every change is in `core/API.md` ("Changes for QA playtest 1"). Regression tests are in `core/castle-core/tests/qa_playtest_1.rs`. `cargo fmt`, `clippy -D warnings`, `cargo test --workspace`, `scripts/build-wasm.sh` and `scripts/run-golden.sh` pass; fixtures and golden hashes were regenerated, and native and Wasm goldens match.

| # | Finding | What changed in the core | Test |
|---|---|---|---|
| 1 | M2 Round 10 ends the fight with no warning, as "Double Pop, the Squall finished your kettle" | Fatigue still starts at round 10 and still drops blocks that no longer stand, but those falls and their crush stop at 1 HP: Fatigue alone never pops a kettle, never Bonks a Hob and never ends a fight. The collapse plays as normal `collapse` (with `why: "fatigue"`), `break`, `hit` and `drop` events at the round 10 start, so apps can animate it. New `fatigue_warning` event at round 9 and `hud.fatigue`, `hud.fatigue_round`, `hud.fatigue_in` for a "Fatigue next round" banner. A fight where both sides fall to one blow outside the Squall is no longer called `double_pop`; `double_pop` now only means a Squall hit popped both kettles | `qa_m2_the_round_10_fatigue_collapse_never_ends_the_fight` (the QA case on 1-4: round 9 of 15, both forts hurt, Marge on 54 HP, the Rival's last Hob on 45 HP; it ended the fight before the fix), `qa_m2_fatigue_is_announced_a_round_ahead`, `qa_m2_a_double_knockout_outside_the_squall_is_not_called_a_squall`, review test `m1_a_fatigue_collapse_stops_short_of_popping_a_kettle` |
| 2 | M1 Fire lit and dead on a rest turn | At each turn start, and on `pick_hob`, a picked shot that cannot fire (Rest, Knack used up, shell spent) switches to the Plain Shot, with a `shot_switch` event. `hud.fire` (`ready`, `why`, `text`) says whether Fire may be lit. Every chip in `hud.shots` with `ready: false` has a `why` key and a `text` line. A refused `fire` spends nothing and replies `reason`, `detail` ("Marge Dumpling needs a rest: Plain Shot only"), `shot`, `hob` and `ready_shot` (`"plain"` when that would fire). `pick_shot` and `pick_hob` replies carry `ready` and `why` | `qa_m1_a_rest_turn_switches_the_picked_knack_to_the_plain_shot` |
| 3 | M4 Test Yard hands you the Dummy's turn | In `test_yard` side 1 is always the Dummy side: its crew is Straw Stuffers whatever the setup sends (the web setup sent a human side with the level's Rival crew), and its turn passes itself. The player always fires first. Endless uses: Knacks and Trick Shells are not spent and no Hob rests. No round cap, no Squall, no Fatigue, no win | `qa_m4_the_test_yard_never_hands_the_player_the_dummy_turn` (20 shots, the turn is always side 0's) |
| 4 | m1 "Best shot" names the Rival's shot | `result.stats[i].best_shot` per side and `result.best_shot` (the winner's): side, Hob, shot, names, angle, power, round, damage to the other side. The blow that ends a fight now counts in the shot stats (it was dropped, so `hits` and the best shot missed the winning shot) | `qa_m1_best_shot_belongs_to_its_side` |
| 5 | M6 Retry replays the identical fight | Setup `attempt` (0 for the first try, 1 for the first Retry, …) is mixed into the seed: same rules, new fronts, Squall side, draft and AI rolls. Ignored in `daily`, so the Daily Dust-up stays one fight per date. The apps need to send it: the web app now sends the same seed (`hashSeed(level)`) on every try | `qa_m6_a_retry_is_a_new_fight_but_the_daily_is_fixed` |
| 6 | M6 The Fair curve in Region 1 | See below | `cargo run --release -p castle-core --example winrate -- 40 fair` |

Balance. Measured with a new bot, `core/castle-core/examples/winrate.rs`, that plays like the QA script: it fires a Hob that can fire, its Knack when ready (else a Trick Shell, else the Plain Shot), aims at the weakest Rival Hob (the cage on 1-7, Plain Shots only once Hetty is hurt), solves the arc with probes and adds aim error that shrinks as it corrects from its last Pin. It does not read Lean Lines, Walk or use Doodads. Its shots hurt the Rival fort 70 to 90% of the time, as the QA script's did. 40 battles per level, Rival on Fair, a new seed each battle. The player crew is the one the web app seats (for 1-9 and 1-10 that is Marge, Quill, Jax and Grub; the level files now list the crew in that order). "Before" is the core and content of the playtest build, with the same bot.

| Level | Diff (05) | Before: win % | After: win % | After: median round |
|---|---|---|---|---|
| 1-1 First Lump | 1 | 95 | 100 | 6 |
| 1-2 Two Hats | 1 | 42 | 85 | 10 |
| 1-3 Kettle on the Knoll | 1 | 77 | 97 | 10 |
| 1-4 Breezy Tops | 2 | 67 | 90 | 11 |
| 1-5 The Big One | 2 | 55 | 82 | 11 |
| 1-6 Roof Trouble | 2 | 42 | 80 | 12 |
| 1-7 Hetty in a Jam (Rescue) | 2 | 97 (5 rounds) | 80 (8 rounds) | 8 |
| 1-8 Rummage Sale | 3 | 42 | 77 | 15 |
| 1-9 Over Loaf Hill | 3 | 35 | 65 | 15 |
| 1-10 The Topiary Keep (boss) | 4 | 47 | 55 | 15 |

What changed:

- Rival aim grade now means something. Grades 1 and 2 (Region 1) aim wider (220% and 160% of the preset's error, was 140% and 120%) and correct from their Pins more slowly (45% and 70%). Before, grade 1 and 2 played almost the same as 3: the Rival found its range in two shots. Skirmish and later regions (grade 3 and up) are unchanged.
- New level fields `rival.knack_uses` (0 to 2) and `rival.hp_pct` (50 to 200), also allowed on `player`. Region 1 uses them so green Rivals hold back: 1-2 no Rival Knacks and Rival Hobs at 55% HP (the Rival's Lobber did most of the harm); 1-5 Rival Hobs 85%; 1-6 one Knack each, 85%; 1-8 and 1-9 one Knack each, 70%. 1-1, 1-3, 1-4 and the boss keep their crews; they moved with the aim grade change alone.
- 1-7: the three cage bars have 80 HP (was 50), so one Grand Dumpling and one Sunspear no longer free Hetty. A careful player needs about 6 to 8 rounds, the Rival gets turns, and "Free her by Round 6" is a real goal. Big blasts on the cage can now Bonk Hetty, as the level card says.
- 1-9 and 1-10 list the player crew in roster order, so the core's default crew is the one the app seats.

Notes. The bot's losses on the QA's single seed per level (the web app's `hashSeed(level)`, the same on every Retry) differ from its average over many seeds: on that seed it now wins 1-10 in 83% of its runs and 1-2 in 73%. That is why the playtest lost 1-10 four times in a row, and why the Retry seed matters. The bot found 1-6 hard (42%), not a walk: the playtest's 1-6 Rival missed six shots on one seed; across 40 seeds its two Lobbers on the high slope Bonk the player's crew more often than not. Rounds run long for this bot (median 10 to 15), because it does not plan collapses; a player who reads Lean Lines ends fights sooner.

For the apps: send `attempt` on Retry; light Fire from `hud.fire`; show `fire` refusals (`detail`); show "Best shot" from `result.best_shot`; play the round 10 `collapse` events (`why: "fatigue"`) and the `fatigue_warning` banner; the Test Yard no longer needs a lone Straw Stuffer from the app.
