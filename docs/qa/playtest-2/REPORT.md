# Castle Protect: QA Playtest 2 (live web build)

Date: 22 Nov 2026. Target: https://njarrar.github.io/CastleProtectLive/

Build under test: JS asset `assets/index-1YtBgiq7.js` (CSS `index-Dhzzn1P1.css`). Checked with curl before the first run, and again from inside the page in both engines. Core: wasm, rules v3. One build for the whole playtest.

Nothing in the app code was changed. Nothing was committed.

## 0. What was tested, and how

Played with Playwright 1.52 in Chromium and WebKit. Every aim was a real pull-back drag that started on the picked Hob in the player's own fort. On the phone profiles in Chromium the drags and canvas taps were real touch events. In WebKit and on desktop they were mouse drags. Buttons were tapped (touch) or clicked (mouse), forced where the Fire pulse makes Playwright wait.

The player was a script that plays like a careful person. Each turn it picks a Hob (one with a Knack ready if there is one), pulls back from that Hob at about 45 degrees, reads where the dotted arc is heading, trims the power with Fine Tune taps or a second drag, and fires. After each shot it reads where its Pin landed and aims the next shot off that. It aims at the weakest Rival Hob, and at the Heartkettle once the kettle is at 35% or less. In two fights (1-3 in portrait, first try, in both engines) it aimed only at the Heartkettle. It does not read Lean Lines, Walk or use Doodads.

Totals: 46 scored fights plus 6 short 1-1 fights in the checks. 531 shots, 424 hurt the Rival fort (80%, the same as playtest 1). 1,084 aim drags. 1,980 Fine Tune taps, and every one of them moved the aim by one step.

| Letter | Profile | What ran |
|---|---|---|
| L | Phone landscape, 844 x 390, touch, Chromium | Full campaign 1-1 to 1-10, one save |
| P | iPhone 13 portrait, 390 x 844, touch, Chromium | Full campaign 1-1 to 1-10, one save |
| W | iPhone 13 portrait, WebKit | Campaign 1-1 to 1-7 in one save. 1-8 to 1-10 from a finished save: see 2.3 |
| V | Phone landscape, WebKit | 1-8 to 1-10 from a finished save: see 2.3 |
| vL, vP, vD | Landscape, portrait, desktop 1280 x 720, Chromium | Checks of the playtest-1 bugs, on a fresh install each |
| vV, vW, vS | Landscape, portrait, desktop, WebKit | The same checks |
| mL, mP | Landscape, portrait, Chromium | Skirmish and Couch Duel, full fights |
| fL, fP, fD | Landscape, portrait, desktop, Chromium | 1-6 at normal speed with a frame-by-frame watch of rounds 9 and 10. These are the three videos |
| eL, eP, eD | Chromium | Workshop detail, keyboard |

Screenshot names start with the letters above, then a number. All are in `docs/qa/playtest-2/screens/` (625 files, the largest is 106 KB).

Videos, one full 1-6 battle each at normal speed, in `docs/qa/playtest-2/video/`:
`phone-landscape-844x390-level-1-6-full-battle.mp4`, `iphone13-portrait-level-1-6-full-battle.mp4`, `desktop-1280x720-level-1-6-full-battle.mp4`. Each one shows rounds 9 and 10, where Fatigue starts.

Limits, said plainly:

- No real phone and no ears. Feel scores come from screenshots, video, timings and state read through the `?debug=1` handle.
- Up to six browsers shared four cores for part of the run. Fight times from then are 10 to 40% longer than they would be alone. Frame rate was measured later, one browser at a time.
- WebKit here is the Playwright Linux build with software drawing, not Safari on an iPhone. It ran at 12 fps, so WebKit fight times mean nothing. Its page crashed in a way that repeats (bug B2). Only a real iPhone can say if Safari does the same.
- WebKit in Playwright could not load the page with the network off ("WebKit encountered an internal error"). Offline is proven in Chromium only.
- The "Update ready" chip (m14) could not be tested. No new build went live during the playtest.
- Modes, Skirmish, Workshop and the Test Yard were opened by their deep links (`#skirmish` and so on) in the checks. The full Skirmish and Couch Duel fights used the saves from the end of the two campaigns.

## 1. Scorecard

| Area | Playtest 1 | Playtest 2 | Why it changed, or why not |
|---|---|---|---|
| Stability | 8 | 5 | Chromium: no crash and no console error in 30 campaign, Skirmish and video fights. But 2 of 3 portrait Couch Duels ended on "The fight got stuck", and Retry led to the same card again (B1). And in WebKit the page died soon after round 10 on 1-8 and 1-10, 5 times out of 5 (B2). Save, reload, resume, rotate, Back and offline all still work |
| Controls and aim feel | 6 | 8 | Fire is honest now. The pull no longer bends at the screen edge (asked 45, 30, 64: got 45.0, 30.0, 64.0 at 100). The pad is off the fort. All 1,980 Fine Tune taps landed. Held back by turns that open on a Hob who must sit out (n1) and the camera being away from your fort when round 10 opens (N1) |
| Collapse and impact feel | 6 | 6 | The Fatigue collapse now plays and never ends a fight. But the collapse on your own fort is off camera, crushed Hobs look Bonked (N2), and damage numbers still pile up |
| Portrait layout | 7 | 8 | Pad docks beside the fort, Couch Duel setup and the hand-off card fit. New small faults: the long round label crowds the top strip, the Test Yard bar covers the target, the whole page shakes sideways |
| Landscape layout | 4 | 6 | Both forts are in view while you aim on 1-1 to 1-4 and 1-10. On 1-5 to 1-9, Skirmish, Couch Duel and the Test Yard the Rival fort is still off screen, with an edge marker (N3). Workshop cells are 24 px and usable. Duel setup and hand-off fit |
| Clarity | 5 | 6 | Fire says why it is grey. The round label counts "Fatigue in 3, 2, 1". Best shot names your Hob. Still: no Fatigue banner, the hint does not say where to press, a "Double Pop!" win is not explained |
| AI fairness and challenge | 5 | 7 | Fair campaign is winnable now: landscape 10 of 10 with 1 Retry, portrait 10 of 10 with 3. A Retry is a new fight. Kettle aim nearly works (2% left in 1-3). Skirmish on Fair is still lost 3 of 3, and 1-7 is still over in 3 to 5 rounds |
| Pacing | 7 | 7 | 9 to 12 s a round. Early fights 36 to 120 s. Late fights now run 14 to 19 rounds and 150 to 220 s, which is long for a phone |
| Visual polish | 6 | 6 | Same plain title, map and results. Same pale own fort and stacked numbers. New: a blank strip shows at the screen edge when the page shakes |
| Audio | 6 | 6 | Judged from network and code only, as before. 49 to 57 sound files load in the first fight, none failed. Not heard |
| Performance | 7 | 8 | 58 to 60 fps in Chromium alone on all three profiles, worst frame 33 to 67 ms. First load is 1.5 MB at the first aim (was 3.6 MB) |
| Accessibility | 5 | 5 | No change found. The Fire reason is a live status line, which helps. Still no text size, 10 px chip names, no remap |
| **Overall** | **6** | **7** | Campaign play is clearly better: honest Fire, fair Fair, both forts in view on the first levels, a Fatigue you can see coming. It is held at 7 by a Couch Duel that can get stuck at its last shot and by a Fatigue start that hides what it does to your own fort. If the WebKit crash (B2) also happens in Safari on a real iPhone, this drops to 5 |

### Numbers behind the scores

First run to first shot (fresh install, Chromium):

| Step | Desktop | Phone portrait | Phone landscape |
|---|---|---|---|
| Page ready (title shown) | 2.1 s | 2.5 s | 2.2 s |
| Play tapped, 1-1 ready to aim | 0.5 s | 0.6 s | 1.0 s |
| Bytes at the title | 1.44 MB, 20 requests | 1.44 MB, 20 | 1.44 MB, 20 |
| Bytes at the first aim | 1.47 MB, 29 requests | 1.45 MB, 25 | 1.46 MB, 27 |
| Bytes 10 s into 1-1 | 1.54 MB | 1.51 MB | 1.57 MB |

Frame rate during a full round of 1-1, one browser alone: desktop 59.6 fps (worst frame 33 ms), phone landscape 57.9 (33 ms), phone portrait 57.7 (67 ms). WebKit software drawing: 12 fps, not counted.

Script plan time: 1.6 to 7.7 s a turn (it goes up with crew size, since the script taps through the portraits). Fights: see section 2.

Things that worked on every profile and both engines: Pause card with goals, Pass turn, Retry, Settings, Map, Give up (`vL010`, `vP010`). Back from Settings lands on Pause. Browser Back in a fight opens Pause, Back again closes it (`vL013`, `vP013`). Rotate mid-plan keeps the aim (50.0 / 58 before and after), rotate mid-flight keeps the shell flying, and the fight goes on (`vL014`, `vL015`, `vP014`, `vP015`). Reload mid-fight shows "Carry on? Level 1-1, Round 4" and Resume gives the same state, Hob for Hob (`vL016`, `vL017`, `vP016`, `vP017`). In Chromium the page reloads with the network off, resumes and fires a shot (`vL018`, `vL019`, `vP018`, `vP019`, `vD016`). Keyboard on desktop: Enter starts, arrows and Shift+arrows aim, Space fires, Esc pauses. Wheel zoom works.

## 2. Per-level tables

Fair difficulty for every fight. "Tries" counts the first try and each Retry (up to 4 Retries were allowed, none of the levels needed more than 1). "Rounds" is the round the fight ended on, then the cap.

### 2.1 Phone landscape, 844 x 390 (L, Chromium, touch)

| Level | Result | Tries | Rounds | Time | Notes |
|---|---|---|---|---|---|
| 1-1 First Lump | Win, Clean Sweep | 1 | 6 of 8 | 47 s | 6 of 6 shots hit. Rival hit 1 of 5. `L008` |
| 1-2 Two Hats | Win, Clean Sweep | 1 | 12 of 10 | 118 s | Went into the Squall. Fatigue at round 10 took Quill to 1 HP. `L018` |
| 1-3 Kettle on the Knoll | Win, Clean Sweep | 1 | 8 of 12 | 81 s | `L024` |
| 1-4 Breezy Tops | Win, Clean Sweep | 1 | 6 of 15 | 79 s | Lost 4 of 4 here in playtest 1. Rival hit 1 of 5. `L030` |
| 1-5 The Big One | Win, Clean Sweep | 1 | 5 of 15 | 45 s | Rival fort off screen while aiming. `L032`, `L037` |
| 1-6 Roof Trouble | Win, Clean Sweep | 1 | 14 of 15 | 148 s | Fatigue at round 10 crushed Quill and Jax to 1 HP. `L043` to `L047` |
| 1-7 Hetty in a Jam | Win, Rescued | 1 | 3 of 14 | 33 s | One Grand Dumpling did 188 to the cage. `L052`, `L053` |
| 1-8 Rummage Sale | Loss (Swept), then Win | 2 | 15 of 15, 14 of 15 | 160 s, 152 s | First try: Rival hit 12 of 15. The Retry was a new fight (the Rival's first shot differed). `L063`, `L069` |
| 1-9 Over Loaf Hill | Win, "Double Pop!" | 1 | 17 of 14 | 220 s | Both kettles at 0% in the third Squall round, and it counts as a win. Rival fort off screen. `L073`, `L079` |
| 1-10 The Topiary Keep | Win, Clean Sweep | 1 | 15 of 18 | 167 s | First try on Fair. Lost 4 of 4 in playtest 1. Buttons +550. `L083`, `L089` |

End state: Puddingstone Downs 10/10, Pennants 20/30, Buttons 2840. `L090`. Shots that hurt the Rival fort: 93 of 114 (82%).

### 2.2 iPhone 13 portrait, 390 x 844 (P, Chromium, touch)

| Level | Result | Tries | Rounds | Time | Notes |
|---|---|---|---|---|---|
| 1-1 First Lump | Win, Clean Sweep | 1 | 5 of 8 | 36 s | 3 of 3 Pennants. `P008` |
| 1-2 Two Hats | Win, Clean Sweep | 1 | 9 of 10 | 89 s | `P015` |
| 1-3 Kettle on the Knoll | Loss (Swept), then Win | 2 | 14 of 12, 8 of 12 | 118 s, 88 s | First try aimed only at the kettle: 13 of 14 shots hit, kettle down to 2%, then my last Hob was Bonked. Second try at Hobs: won. `P026`, `P028` |
| 1-4 Breezy Tops | Win, Clean Sweep | 1 | 10 of 15 | 120 s | `P038` |
| 1-5 The Big One | Win, Clean Sweep | 1 | 14 of 15 | 158 s | All 3 of my Hobs ended on 1 HP. `P048` |
| 1-6 Roof Trouble | Win, Clean Sweep | 1 | 11 of 15 | 108 s | `P058` |
| 1-7 Hetty in a Jam | Loss (Captive Bonked), then Win | 2 | 5 of 14, 5 of 14 | 66 s, 62 s | First try ended with Hetty Bonked. `P064`, `P066` |
| 1-8 Rummage Sale | Loss (Swept), then Win | 2 | 14 of 15, 8 of 15 | 161 s, 107 s | First try: Rival hit 11 of 14. `P076`, `P078` |
| 1-9 Over Loaf Hill | Win, "Double Pop!" | 1 | 17 of 14 | 171 s | Same ending as landscape. `P088` |
| 1-10 The Topiary Keep | Win, Clean Sweep | 1 | 19 of 18 | 184 s | Won in the first Squall round. `P098` |

End state: 10/10, Pennants 22/30, Buttons 2970. `P099`. Shots that hurt the Rival fort: 110 of 139 (79%).

### 2.3 iPhone 13 portrait in WebKit (W, mouse drags)

| Level | Result | Tries | Rounds | Time | Notes |
|---|---|---|---|---|---|
| 1-1 | Win, Clean Sweep | 1 | 7 of 8 | 68 s | `W008` |
| 1-2 | Win, Clean Sweep | 1 | 12 of 10 | 127 s | `W018` |
| 1-3 | Win, Clean Sweep | 1 | 13 of 12 | 209 s | Kettle aim on this try too: kettle at 41% when the last Rival Hob fell. `W028` |
| 1-4 | Win, Clean Sweep | 1 | 11 of 15 | 180 s | `W038` |
| 1-5 | Loss (Swept), then Win | 2 | 10 of 15, 4 of 15 | 105 s, 56 s | `W049`, `W051` |
| 1-6 | Win, Clean Sweep | 1 | 14 of 15 | 248 s | `W061` |
| 1-7 | Win, Rescued | 1 | 3 of 14 | 69 s | `W067` |
| 1-8 | Page crashed in round 10, 3 times of 3 | | 10 of 15 | | Bug B2. Played from a finished save after the first crash. `W107` to `W110` |
| 1-9 | Win, Clean Sweep | 1 | 6 of 14 | 78 s | From a finished save. `W207` |
| 1-10 | Page crashed in round 10 | | 10 of 18 | | Bug B2. `W213` to `W216` |

WebKit, phone landscape (V), from a finished save: 1-8 Win, Clean Sweep, 7 of 15, 84 s (`V107`). 1-9 Win, Clean Sweep, 6 of 14, 84 s (`V113`). 1-10: page crashed in round 10 (`V119` to `V122`).

No console error from the game in any WebKit fight, also not before the crashes. Times are slow because of the 12 fps software drawing.

### 2.4 Other fights

| Fight | Profile | Result | Rounds | Time | Notes |
|---|---|---|---|---|---|
| Skirmish, Fair, 10 rounds, opened by `#skirmish` on a fresh install | mL | Loss, Clean Sweep | 4 of 10 | 41 s | 1 Hob against 4, because the deep link skips the unlock. `mL002`, `mL007` |
| Skirmish, Fair, 10 rounds, full crew (save after 1-10) | mP | Loss, Clean Sweep | 11 of 10 | 97 s | Rival hit 11 of 11. I hit 11 of 11 too. `mP011` |
| Skirmish, Fair, 10 rounds, full crew | mL | Loss, Double Pop | 13 of 10 | 141 s | Rival broke 29 blocks, I broke 3. `mL050` |
| Couch Duel, 10 rounds, Quick start | mL | Player 2 wins, Double Pop | 13 | 210 s | 27 turns, hand-off card every turn, both kettles 0%. `mL011`, `mL019` |
| Couch Duel, again | mL | Player 2 wins, Double Pop | 13 | 215 s | `mL067` |
| Couch Duel, 10 rounds, Quick start | mP | **"The fight got stuck"** in round 10 | 10 | 152 s | Bug B1. `mP023` |
| Couch Duel, again | mP | **"The fight got stuck"** in round 9, 3 times | 9 | 155 s | Retry brought the fight back, the next shot hit the card again. `mP033` to `mP037` |
| Couch Duel, third go | mP | Player 2 wins, Clean Sweep | 13 | 207 s | Ended as it should. 26 turns |
| 1-6 at normal speed (video) | fL, fP, fD | Win x3 | 16, 13, 11 | 199 s, 194 s, 155 s | Rounds 9 and 10 watched frame by frame |
| 1-1 in the checks | all six | Win x6 | 4 to 8 | | With pause, rotate, reload and offline in the middle |
| Test Yard | all six | No result (by design) | | | 4 Knack shots in a row, always my turn. `vL022`, `vP022`, `vD020` |

## 3. Playtest-1 bugs: fixed or not

"Fixed" means I could not make it happen again on this build. Console errors for every row: none.

| Bug | Claimed | Verdict | What I saw | Screenshots |
|---|---|---|---|---|
| M1 Fire lit and dead on a rest turn | Fixed (web and core) | **Fixed** | Fired a Grand Dumpling in round 1. Round 2 opened on the Plain Shot with Fire lit, and it fired. Picking the resting Knack by hand turned Fire grey, stopped the pulse and showed "Marge Dumpling needs a rest: Plain Shot only". A tap on grey Fire showed the same line as a banner and fired nothing. In 253 campaign turns Fire was never lit with a shot that could not go. All six profile and engine pairs | `vL007`, `vL008`, `vL009`, `vP007`, `vP008`, `vP009`, `vD008`, `vW008` |
| M2 Fight ends at round 10 with no warning | Fixed (core and web) | **Fixed in part** | No fight ended at the start of round 10 (more than 20 fights passed it). The round label counts "Fatigue in 3", "in 2", "in 1", then ", Fatigue". The collapse plays with "Drop!" and numbers. Not done: the "Fatigue next round" and "Fatigue!" banners never show (banner log of the three video fights: only "Your turn" and "... aims"). New faults at the Fatigue start are in N1 and N2 | `fL003`, `fL006` to `fL014`, `L043` to `L046`, `P022` to `P025` |
| M3 Phone landscape cannot see the Rival fort | Fixed (web) | **Fixed in part** | Both forts are in view while you aim on 1-1 (11 px blocks), 1-2 (11), 1-3 (10), 1-4 (8) and 1-10 (8). On 1-5, 1-6, 1-7, 1-8, 1-9, Skirmish, Couch Duel and the Test Yard the Rival fort is off screen and an orange "Rival fort" marker sits on the edge. The arc gets an arrow where it leaves the screen. The camera does zoom out to hold both forts during flight on the same maps (`L046`) | Both in view: `L003`, `L010`, `L020`, `L026`, `L081`. Marker only: `L032`, `L039`, `L049`, `L055`, `L071`, `mL002`, `vL022` |
| M4 Test Yard hands you the Dummy's turn | Fixed (web and core) | **Fixed** | 4 Knack shots in a row. Always my turn, label reads "Test Yard", Knack uses stay at 2, no Hob rests, "Dummy passed" after each shot | `vL022`, `vP022`, `vD020`, `vW021` |
| M5 Workshop cells 5 px in landscape | Fixed (web) | **Fixed** | Cells are 24 px at 844 x 390 (33 px portrait, 35 px desktop). Grid on the left, palette and buttons on the right. Place, undo, save, reload and "Test Yard" with the saved fort all work. Two new small faults: n2 | `vL023`, `eL002`, `eL003`, `vP023` |
| M6 Fair too hard, Retry replays the same fight | Fixed (core) | **Fixed for the campaign. Not for Skirmish** | Landscape won 9 of 10 levels on the first try, portrait 7 of 10. 1-2, 1-4 and 1-10 were all first-try wins. The Rival's first shot was different on every Retry (1-3: 156.6/62 then 143.1/66; 1-8: 166.7/87 then 138.1/94). Kettle aim: 13 hits took the 1-3 kettle to 2%, still a loss, so close but not yet a path. Skirmish on Fair: lost 3 of 3, Rival hit 11 of 11 in one | `L030`, `L089`, `P026`, `mP011`, `mL050` |
| M7 Fine Tune pad on the fort | Fixed (web) | **Fixed** | Portrait: a two-column pad on the right of the bottom lens, clear of the fort, the Hob, the tray and Fire. Landscape: a row under the top strip on the right, clear of both forts, the tray and Fire. It opens when the finger lifts. Keys are 52 to 59 by 44 px. One overlap left: n9 | `vP006`, `vL006`, `vD006`, `L004`, `P004` |
| M8 Couch Duel setup does not fit a phone | Fixed (web) | **Fixed** | Nothing runs off the edge at 390 or 844 wide. Dice buttons are there. Player 1's badges are coloured. The rules sheet scrolls clear of the pinned buttons | `vP026`, `vP027`, `vL026`, `vL027` |
| m1 "Best shot" names the Rival's shot | Fixed (web and core) | **Fixed** | Every campaign win named one of my Hobs with one of my angles ("Best shot: Marge, 45.0 / 62, 447 dmg"). Duel and Skirmish name the winner's side | `vL020`, `vP020`, `L079`, `mL019` |
| m2 Back from Settings drops into the fight | Fixed (web) | **Fixed** | Pause, Settings, Back: the Pause card is up and the fight is still paused. Same with the browser Back | `vL012`, `vP012`, `vD012`, `vW012` |
| m3 Pull into the screen edge bends the angle | Fixed (web) | **Fixed** | Asked 45, 30 and 64 at full pull: got 45.0, 30.0 and 64.0 at power 100 on all three Chromium profiles and on WebKit landscape and desktop. WebKit portrait gave 29.5 to 30.5 for 30. No aim in 1,084 drags came out more than 2 degrees off | `vL005`, `vP005`, `vD005`, `vV005` |
| m5 Hand-off card cut off in landscape | Fixed (web) | **Fixed** | READY is fully on screen at 844 x 390 and in portrait | `mL011`, `mP016` |
| m7 1-7 is over in 2 shots | Fixed (core) | **Not fixed** | Won in 3 rounds in landscape (33 s) and WebKit, 5 rounds in portrait. One Grand Dumpling still does 188 to the cage. "Free her by Round 6" is still no test. It is harder in one way: the captive can now be Bonked (1 loss) | `L052`, `L053`, `P064`, `W067` |
| m12 First load 3.6 MB | Fixed (web) | **Fixed** | 1.45 to 1.47 MB at the first aim, 1.5 to 1.6 MB ten seconds in | section 1 |
| m14 Slow "Update ready" chip | Fixed (web) | **Not tested** | No new build went live during the playtest | |
| m4 Nothing says where to press | Not claimed | **Still there, in part** | See section 4.1 | `vL002`, `vP002`, `vP003` |
| m6 Damage numbers stack | Not claimed | Still there | Two to four numbers and "Drop!" on one spot | `P013`, `fL006`, `L086` |
| m8 Keyboard players keep the hint | Not claimed | Still there | "Drag to aim" is still up in round 2 after an aim and a shot by keys | `eD001` |
| m9 Shell card only on right-click | Not claimed | Not tested again | | |
| m10 "Carry on?" only on the title | Not claimed | Not tested again | | |
| m11 Map: pill over level 10, done names white on cream | Not claimed | Still there | | `L090` |
| m13 Deep links skip the unlock | Not claimed | Still there | `#modes`, `#skirmish`, `#workshop`, `#yard` and `#duel` open with only 1-1 won. Skirmish then seats 1 Hob against 4 | `vL030`, `mL002` |
| m15 Results line passes the cap with no word on the Squall | Not claimed | Still there | "1-9 Over Loaf Hill, Round 17" on a cap of 14 | `L079` |
| The 1-1 stuck fight | Fixed in playtest 1 | Still fixed in 1-1 | The same card now shows in Couch Duel for another reason: B1 | |

Regressed: none. No fixed bug came back. The new faults below sit beside the fixes.

## 4. The watch list

### 4.1 Can a first-time player tell where to press to aim? (owner rule)

Mostly yes on the first turn, and not after it.

The rule itself holds on all six profile and engine pairs: an aim only starts on your own fort (the fort plus about two blocks around it) or within 48 px of the picked Hob. A drag from a wall block of your fort aims (`vL004`, `vP004`). A drag that starts 60 px outside the fort does not.

What helps a new player: on the first turn of 1-1 the "Drag to aim" bubble sits right over your fort with its tail pointing at it, and a white ring slides back from the Hob again and again (`vL002`, `vP002`, `vD002`).

What does not help:

- The words do not say "from your fort". The ring is a plain 30 px circle, not a hand, and it fades to nothing for part of each loop.
- The hint shows once. It is gone after the first drag.
- In landscape and on desktop a drag that starts in the sky or on the Rival fort pans the camera with no word. A small re-frame button appears (`vL003`, `vD003`).
- In portrait a drag that starts in the sky of the bottom lens does nothing at all: no aim, no pan, no word (`vP003`). This is unchanged from playtest 1.
- When round 10 opens, the camera is on the Rival fort for about 1.5 s while the banner says "Your turn". Your own fort, the only place you may press, is off screen (`fL006`, `fL010`, `L060`). On 1-10 the crew column also covers it (`L086`).

### 4.2 The Fatigue warning and collapse

Better, but the player still cannot see what Fatigue did to them. Details in N1 and N2. In short: the label warns three rounds ahead, no banner ever shows, the collapse on the Rival fort is shown, the collapse on your own fort is not, and healthy Hobs drop to 1 HP and are drawn as Bonked.

### 4.3 Fire on rest turns

Honest on every turn I saw. Fire was never lit with a shot that could not fire (0 of 253 campaign turns). A resting Knack is swapped for the Plain Shot when the turn opens (`L007`, `P007`). When Fire is grey it says why, next to the tray in landscape and next to Fire in portrait (`vL008`, `vP008`).

One rough edge (n1): a turn can open on a Hob who must sit the whole turn out. Fire is grey and reads "Jax Peppercorn needs a rest this turn", every chip is dim, and the player has to work out that another Hob must be tapped. Seen 3 times (`mL017`, `mL062`, `fD001`).

### 4.4 Both forts in landscape

See M3 in section 3 and N3. Five campaign levels of ten frame both forts while you aim. The other five, and all three side modes, show a marker.

### 4.5 Fine Tune placement

Good on all three shapes. See M7. The pad never sat on a fort, the Hob, the tray or Fire in any fight. One overlap: the arrow that marks where the arc leaves the screen can sit on the pad's first key (n9).

## 5. New bugs

### Blocker

**B1. A Couch Duel can end on "The fight got stuck", and Retry leads straight back to it.**
- Steps: iPhone portrait, 390 x 844. Open Couch Duel (2 Players). Set Rounds 10. Tap Quick start. Play both sides, hand-off card each turn, until one side is down to its last Hob.
- Expected: the fight ends and the duel results show.
- Actual: in round 10 of the first duel and round 9 of the second, a shot resolved and the card "The fight got stuck. Something went wrong in this fight. Retry picks it up from the last saved turn." came up. In the second duel I tapped Retry. The fight came back at the start of that turn, I fired again, and the card came up again. Three times out of three. The only way out is Map, and the duel is lost.
- How often: 2 of 3 portrait duels. 0 of 2 landscape duels, 0 of 41 other fights. Nothing in the cause below is tied to portrait, so I expect it in landscape too. State at the card in the second duel: Player 1 had only Marge left (102 HP, resting), Player 2 had four Hobs, kettles 85% and 100%.
- Console error, each time: `TypeError: Cannot read properties of null (reading 'split')` at `qr` (index-1YtBgiq7.js:1:52552), called from `snapshot`.
- Cause seen in the code: `qr` builds the "what broke you" line for the results. It reads `result.broke.last.hob_name.split(' ')`. The core sends `hob_name: null` when the last blow on the losing side did not come from a Hob (`note_taken` in `core/castle-core/src/effects.rs` records Hob -1 then). The web source is `apps/web/src/core/real.ts` line 744. So the fight is in fact over, and it is the results text that breaks. Any mode that shows this line can hit it. I did not find which blow it was.
- Also: the card and the fight after Retry are drawn shifted sideways. The card text is cut on the left (`mP033`), and after Retry the Fire button and the readout are half off the right edge (`mP034`).
- Screens: `mP023-duel-error-card.jpg`, `mP033-duel-3-error-card-1.jpg`, `mP034-duel-3-after-crash-retry-1.jpg`, `mP035-duel-3-error-card-2.jpg`, `mP037-duel-3-error-card-3.jpg`.

**B2. WebKit only: the page dies soon after Fatigue starts on 1-8 and 1-10. Blocker on iPhone if Safari does the same.**
- Steps: WebKit, iPhone 13 portrait or 844 x 390 landscape. Play 1-8 Rummage Sale or 1-10 The Topiary Keep on Fair until round 10.
- Expected: the fight goes on.
- Actual: 13 to 30 s after round 10 opens with ", Fatigue" in the label, the page crashes. Playwright reports "Target crashed". The kernel log shows `WPEWebProcess trap invalid opcode in libWPEWebKit` each time (once in its compositor thread). 5 times out of 5: 1-8 portrait 3 times, 1-10 portrait once, 1-10 landscape once. The last three were with the machine nearly idle. There was no console error and no page error from the game before any of them.
- What did not crash: the same two levels in Chromium (5 fights that went past round 10). WebKit fights with crews of 2 or 3 that passed round 10 (1-2, 1-3, 1-4, 1-6 in portrait). WebKit 1-8 and 1-9 that ended before round 10. So it needs a crew of 4 and Fatigue.
- Two more WebKit crashes came in the 1-1 checks while six browsers shared four cores. Those did not repeat when run alone, and the kernel log shows the same kind of crash twice before this playtest began. I count those two as the test machine.
- Limit: this is the Playwright WebKit build for Linux with software drawing. I could not find the cause. It may not happen in Safari. It must be tried on a real iPhone: play 1-8 past round 10.
- Screens (last frames before each crash): `W108-1-8-try1-r10-fatigue-collapse-1.jpg`, `W110-1-8-try1-r10-fatigue-collapse-3.jpg`, `W214-1-10-try1-r10-fatigue-collapse-1.jpg`, `W216-1-10-try1-r10-fatigue-collapse-3.jpg`, `V120-1-10-try1-r10-fatigue-collapse-1.jpg`, `V122-1-10-try1-r10-fatigue-collapse-3.jpg`.

### Major

**N1. When Fatigue starts, the game does not say so and does not show what it did to your fort.**
- Steps: any fight that reaches round 10. Clearest in 1-6 on Fair. Watch the start of round 10 (all three videos show it).
- Expected (playtest-1 fix notes): a "Fatigue next round" banner in round 9, a "Fatigue!" banner in round 10, and the collapse shown.
- Actual: the only warning is small text in the round label. No Fatigue banner shows in round 9 or 10. The banner at both moments is "Your turn". When round 10 opens the camera goes to the Rival fort and shows its blocks drop. The drop on your own fort happens at the same time, off screen. In landscape 1-6 my Quill (73 HP) and Jax (93 HP) fell to 1 HP there and I saw none of it, only two portraits turning grey. The camera takes about 1.5 s to come back, and "Your turn" is already up.
- In the web source the `fatigue` case is listed twice in the event switch of `real.ts` (lines 439 and 471), so the second text can never show.
- Profile: all. Seen in 16 fights. Console errors: none.
- Screens: `fL003-1-6-round-9-your-turn-fatigue-warning.jpg`, `fL006-1-6-round-10-start-frame-1.jpg`, `fL010-1-6-round-10-start-frame-3.jpg`, `fL012-1-6-round-10-start-frame-5.jpg`, `L044-1-6-try1-r10-fatigue-collapse-1.jpg`, `L060-1-8-try1-r10-fatigue-collapse-1.jpg`, `L086-1-10-try1-r10-fatigue-collapse-1.jpg`, `P023-1-3-try1-r10-fatigue-collapse-1.jpg`.

**N2. A crushed Hob is drawn as Bonked.**
- Steps: 1-6 on Fair, round 10. Or any collapse that lands on a Hob.
- Expected: a crushed Hob looks hurt and comes back (design doc 00: "Squashed: takes crush, pops back up").
- Actual: the Hob's portrait goes grey and cannot be tapped, and its pip in the top strip goes hollow, the same as a Bonked Hob. It has 1 HP and returns later (in one 1-6 fight Jax was greyed in round 10 and alive at the end in round 14). At the start of round 10 on desktop the picked Hob was itself one of the greyed ones. After Fatigue in 1-8 all four of my pips were hollow while I still had turns (`L062`). A player reads this as "Fatigue Bonked my crew".
- The web adapter maps the core's `squashed` state to `bonked` (`real.ts` line 764).
- Profile: all. Console errors: none.
- Screens: `fL009-1-6-round-10-your-turn-after-fatigue-collapse.jpg`, `L044-1-6-try1-r10-fatigue-collapse-1.jpg`, `L062-1-8-try1-r10-fatigue-collapse-3.jpg`.

**N3. Phone landscape: the Rival fort is still off screen on half the campaign and in every side mode.**
- Steps: 844 x 390. Start 1-5, 1-6, 1-7, 1-8 or 1-9, a Skirmish, a Couch Duel or the Test Yard.
- Expected: both forts in view while you plan.
- Actual: your fort and the first third of the arc are framed. An orange "Rival fort" (or "Dummy fort", "Player 2 fort") marker sits on the right edge. You aim by the arc and the Pins of the last shots. The same maps do fit both forts when the camera zooms out in flight (`L046`), so the room is there.
- Console errors: none.
- Screens: `L032-1-5-try1-start-plan-frame.jpg`, `L039-1-6-try1-start-plan-frame.jpg`, `L049-1-7-try1-start-plan-frame.jpg`, `L055-1-8-try1-start-plan-frame.jpg`, `L071-1-9-try1-start-plan-frame.jpg`, `L073`, `mL002`, `vL022`, `vL028`.

**N4. Skirmish on Fair cannot be won by a player who hits with every shot.**
- Steps: finish the campaign, Modes, Skirmish, Rival Fair, Rounds 10, START.
- Expected: about the same test as the late campaign.
- Actual: lost 3 of 3. In portrait the Rival hit 11 of 11 and I hit 11 of 11: it broke 24 blocks, I broke 5. In landscape it broke 29 blocks to my 3. The best shot each time was Sir Pudge's, 538 to 894 damage. The core notes say Skirmish kept its old Rival aim. From a fresh install the `#skirmish` link seats 1 Hob against 4 and the fight is over in 4 rounds.
- Console errors: none.
- Screens: `mP011-skirmish-results-loss.jpg`, `mL050-skirmish-results-loss.jpg`, `mL007-skirmish-results-loss.jpg`.

### Minor

**n1. A turn can open on a Hob who has to sit out.** Steps: a fight with 3 or more Hobs, fire Heavy shots. Expected: the turn opens on a Hob who can act. Actual: Fire is grey and says "... needs a rest this turn", all chips are dim, and nothing points at the crew. Honest, but slow. `mL017-duel-r11-fire-tap-did-nothing.jpg`, `mL062-duel-3-r8-fire-tap-did-nothing.jpg`, `fD001-1-6-fatigue-watch-r8-fire-tap-did-nothing.jpg`.

**n2. Workshop: the top row cannot be used, and the reason is in code words.** Steps: Workshop, Wicker, tap any cell in the top row. Expected: a block, or a plain "too tall". Actual: the status turns red and reads "Blocks 0/72 Cost 0 grid 8x11 outside 3x3 to 8x10", the block count drops to 0 and Save greys. The grid draws 10 rows but only 9 can be built on. In phone landscape that status line is half below the screen edge (its box ends at 400 px on a 390 px screen). `eL001-workshop-block-in-top-row-status-line.jpg`, `eP001-workshop-block-in-top-row-status-line.jpg`, `vL024`.

**n3. Where to press is only half taught (m4, carried over).** See 4.1. Expected: a drag that starts off the fort pans or gives a nudge. Actual in portrait: nothing happens. `vP003-1-1-sky-drag-result.jpg`.

**n4. 1-7 is still over in 3 rounds (m7, carried over).** `L053-1-7-try1-results-win.jpg`.

**n5. "Double Pop!" as a win is not explained.** On 1-9 both kettles reached 0% in the third Squall round and the title was "Double Pop!" with Win stamped, on both phones. In Couch Duel the same ending gave "Player 2 wins!" with both kettles at 0%. Nothing says how the winner was picked. `L079-1-9-try1-results-win.jpg`, `P088`, `mL019-duel-results.jpg`.

**n6. Test Yard bar gets in the way.** Landscape: the "Dummy passed" banner covers the Back button and the Wind label after every shot (`vL022`). Portrait: the bar covers the top of the target lens, where the arc comes down (`vP022`).

**n7. The round label is too long for portrait.** "Round 10/12 Squall in 3, Fatigue" fills the top strip and pushes into the kettle pills. In the duel "Round 9/10 Squall in 2 Fatigue in 1" does the same. `P023`, `mP008`, `mP034`.

**n8. Screen shake moves the whole page.** On a big collapse in portrait the HUD slides 20 to 50 px sideways with the field. Pause and the left portrait are cut by the edge and a blank strip shows on the other side. After B1 the shift stays. `mP008-skirmish-r10-fatigue-collapse-1.jpg`, `mP023`, `mP034`.

**n9. The arc's edge arrow can sit on the Fine Tune pad.** In landscape, on a steep shot from the right-hand fort, the round arrow covers "Ang up". `mL017`.

**n10. Deep links still skip the unlock (m13).** Worse now for Skirmish: 1 Hob against 4. `mL002`.

**n11. A page load cut short logs an error.** Reloading while the title is still loading logged `CoreLoadError: Could not load the game rules: Failed to fetch` once in Chromium. In WebKit, sound files cut off by a reload logged "... due to access control checks" as page errors. No effect on play.

### Polish

- Damage numbers still stack on one spot (m6). `P013`, `fL006`.
- Done level names are white on cream, and the "2 Players" pill covers the boss node's Pennants (m11). `L090`.
- Your own fort is still drawn pale on your turn. `vP002`.
- Bark subtitles land on the crew column in landscape ("Mind the stall!"). `fL006`.
- A flat brown block shows at the left end of the 1-6 map, and a grey slab stands in mid-field on 1-8 at round 10. `L045`, `L060`.
- Class badges still cover the first letter of chip names on a full tray. `L083`.
- The results card runs past the bottom of a phone in landscape. Buttons stay in reach. `L079`, `mL019`.
- The landscape "Player 1's turn" banner slides in over the round label. `vL028`.
- Title, map and pre-battle sheet are still flat colour. `vP029`.

## 6. Top 10 fixes, by player impact

1. **Make the results line safe when the last blow has no Hob (B1).** One null check ends the "fight got stuck" card. Then play ten Couch Duels to the end in each shape.
2. **Play 1-8 and 1-10 past round 10 on a real iPhone in Safari (B2).** If it crashes there too, it comes before everything else. If it does not, note it and move on.
3. **Show Fatigue (N1).** Put up the "Fatigue next round" and "Fatigue!" banners before "Your turn". Show the collapse on your own fort first, or both forts in one wide frame. Bring the camera home before the turn banner.
4. **Draw a crushed Hob as crushed, not Bonked (N2).** Keep the portrait live, mark it squashed, keep the pip filled.
5. **Frame both forts in phone landscape on every map (N3).** The flight camera already does it. Use that frame for planning, or let a tap on the marker hold the wide view.
6. **Bring Skirmish Fair in line with the campaign (N4).** Use the gentler aim grades for Cozy and Fair, and never seat 1 Hob against 4.
7. **Open each turn on a Hob who can act (n1).** If none can, say so and offer Pass.
8. **Teach where to press (n3).** "Drag from your fort", a hand in place of the ring, and a nudge when a drag starts elsewhere. Make the portrait sky drag pan or nudge.
9. **Workshop: drop the dead top row, write the status in plain words, and keep it on screen in landscape (n2).**
10. **Lengthen 1-7 for real, explain a Double Pop win, and tidy the layout: a shorter round label in portrait, shake the field and not the HUD, move the Test Yard bar, keep the edge arrow off the pad (n4 to n9).**

## 7. Day 3 gate view (review 07)

| Gate item | Playtest 1 | Playtest 2 | Why |
|---|---|---|---|
| Aim feel | Pass with fixes | Pass | Fire, the edge pull and the pad are fixed. The owner rule holds on every profile. Teach it better (n3) |
| Collapse feel | Not proven | Not proven | Fatigue now plays, but half of it is off camera and the Hob states read wrong. Still needs a hand on a real phone, with sound |
| Portrait stacked lenses | Pass | Pass for the campaign in Chromium | Campaign in portrait is the best way to play this build. Couch Duel can stick at its last shot (B1). WebKit needs the iPhone check (B2) |
