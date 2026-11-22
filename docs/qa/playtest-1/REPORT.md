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
