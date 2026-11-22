# Review 05. Final Verification

Status: final check of the design set after the edit pass. Date: 2026-11-22. Author: final verifier.

**Scope.** All eight design docs in `docs/design/` (00 to 07), read against `docs/review/04-rulings.md` (binding) and `docs/review/01-consistency-audit.md` (where 04 is silent). The art agent owns `docs/art/`; nothing there was edited. One research file was touched for the style check only (see section 3).

**Method.** Each check below was run with a script or a grep over every design doc, then read by hand where the hit needed context. Hits inside a doc's "Changes in this revision" list or its "Parked ideas" appendix were treated as history, not as live rules. Every fix was written into the owning doc, and each doc's "Changes in this revision" list now has a line for this pass.

---

## 1. Checks run

| # | Check | How | Result before fixes | Result now |
|---|---|---|---|---|
| 1 | Launch counts agree: 4 regions, 40 levels, 7 Classes, 16 Hobs, 30 Trick Shells (2 Duds), 8 Doodads, 36 Tinker nodes, 14 enemy unit types, 4 Grand Forts, 59 maps | grep of every count statement; table counts parsed from 01, 02, 03, 04, 05 | Fail: 00 had no map or enemy-type count; 02 sourced 8 launch shells from two Shell Sets and 7 Doodads from levels, against 01's 3 and 5; 02 §6.1 said "all 16 launch Hobs by 3-9" | Pass |
| 2 | Totals after U3: 6 regions, 60 levels, 8 Classes, 28 Hobs, 58 shells, 14 Doodads, 60 nodes, 28 enemy types, 6 Grand Forts, 95 maps, 210 Pennants | same | Pass, except 04 cited "5 bench Knacks" (01 has 4) | Pass |
| 3 | Every Hob exists in 03 with one tag, and 01's Launch Hob set and later-Hob table carry the same tag | script: 03 headings against 01 tables | Pass (28 Hobs: 16, 2, 5, 5) | Pass |
| 4 | Every Knack named in 03 exists in 01 §3 with the same tag as its Hob | script | Pass | Pass |
| 5 | Every Trick Shell named outside 01 exists in 01 with the same tag; no parked shell or Doodad is used as live | script over the 58 shell names and the 15 parked shells and 5 parked Doodads | Pass for shells; Junk Shell had no source (needed a keystone that 02 no longer has) | Pass (Junk Shell parked) |
| 6 | Every Doodad named anywhere has the tag and source 01 gives it | grep of the 14 names | Fail: 00 listed Chimney Cough (U2) as a launch example; 02 put Scarecrow at launch and Bellows in U2, Mole Mine in U3; 02 achievement "Straw Man" needed the U2 Scarecrow; 07's level 1-8 mock showed a Doodad before Doodads open; 01 gave Mend Bucket and Pot Lid at 1-6, 00 and 02 at 2-1 | Pass |
| 7 | Every enemy unit named outside 04 exists in 04 with the same tag | grep of the 28 unit names | Fail: 05 put the Clipboard Clerk (U2 Peeper) in the 1-10 crew, and Dredgers (U1) in the Region 3 style line | Pass |
| 8 | Every Tinker node named outside 02 exists in 02 with the same tag; 36 / 12 / 12 split; 15 per branch; one fork per branch | script over 02's node table | Fail: 01 §9 asked for Kit nodes that 02 did not have (one 3-shell set, Mole Mine and Bellows at launch, Scarecrow in U2); 02 sold shell sets (Hops and Lobs, Splash and Smoke, Frost, Sparks) that 01 never sources | Pass |
| 9 | Level ids use the new numbering in 05 §3.2 | grep of every `n-n` id with context in all docs | Fail: 02's recruit table and level table had Old Thumper 2-5, Petra 2-9, Flats with no Hob, Thump at 2-3, Fire at 2-7, Trials on old side paths; 03 had Old Thumper 2-5; 00 had Thump 2-3 and Burn 2-7. 04 already used new ids | Pass |
| 10 | No stale terms: Last Bell tiebreak, Final Volley, Reload or Chill as terms, seat words, Scamper, Scurry, Crowded, Perched, Porch, Knack tiers, rarity, Pin as a blast band, six branches, 1800 duel gap, crew of 6, "matching Class" | script that skips Changes and Parked sections | Fail: "Reload" live in 03 (6 places), 04 (8), 07 (1); "Chill" live in 01 (2) and 03 (5); "1 to 6 Nooks" in 04 (2); "Matching Class" in 03 and 04 (7) | Pass. Remaining hits are history lines ("replaces Reload and Chill", "no rarity"), the 1800 Long-map gap (allowed by R04 C4) and "Crowded Pins" in 07, which is a UI term for stacked impact markers, not the cut Hob state |
| 11 | Glossary names spelled one way (Heartkettle, Kettle Pop, Clean Sweep, Daily Dust-up, Test Yard, Fine Tune, Aim Drag, Quick Pick, Weather Front, Block Budget, Full Kingdom, Tinker Tree, Loophole, Nook, Siege Score, Grand Fort, Trick Shell, Plain Shot, Sudden Squall, Match) | grep of 40 likely variants | Pass, except "Matching Class" for **Match** (see check 10) | Pass |
| 12 | Canonical numbers agree (material HP and cost, kettle 300, Training 300 / 700 / 1,500, gap 1000 to 1400, Steam 100 / 130, preview 30 / 45 / 60, caps) | grep for old values (Timber 60, Cobble 120, 4,100 Buttons, kettle 400, 60 Hz) | Fail: 00 said 120 Thwack per shot, 01 said 110; 00 round-cap range "6 to 20" while 05 and 07 used 8 for 1-1 | Pass |
| 13 | Onboarding order agrees in 00, 05, 07 | read side by side | Fail: 00 taught the Knack at 1-4 and wind at 1-5, a Rummage pool of 6; 05 and 07 teach wind at 1-4, the Knack at 1-5, a pool of 4 | Pass (00 now summarises 05 and 07) |
| 14 | Mode unlocks agree | read 00 §6, 05 §5, 02 §6.1 | Fail: Baron Rush after 4-10 in 05, after Grand Fort 6 in 00 | Pass (after 6-10) |
| 15 | Quirk, Mastery and late-recruit rules agree in 02 and 03 | read | Fail: 02 said 6 Quirks per Class (42 at launch) and ~10 Deeds per Hob; 03 said 35 Class Quirks plus 16 Knack Quirks and 6 Deeds per Hob; late recruits joined "one under your lowest" (03) or "at your fifth-highest" (02) | Pass |
| 16 | Economy table in 02 adds up after the Trial moves | script recomputed Buttons, cumulative Buttons, Pennants and max Pennants | n/a | Pass: 13,612 Buttons and 144 max Pennants after 4-10; 20,032 and 210 after 6-10, as before |
| 17 | No em dashes or en dashes anywhere in `docs/` | Python count of U+2014 and U+2013 in every .md, .svg, .txt, .html | Pass (0) | Pass (0) |
| 18 | No mentions of the AI assistant by name in `docs/` | case-insensitive grep | Fail: 3 lines in `docs/research/MAC-PLAYTEST-BRIEF.md` | Pass for prose. One git branch name, used twice in that brief, still carries the assistant's product name because it is a real branch ref; see owner decision 12 |

---

## 2. Open items settled

| Item | Ruling | Written into |
|---|---|---|
| (a) Sudden Squall first-mover fairness | The wind steps up at each Squall round start. At each Squall round end, after both sides have acted, both kettles and all blocks lose HP in the same tick (kettle 50, 100, 150; blocks 10, 20, 30). A kettle popped by a shot still ends the fight at once. If both kettles reach 0 on the same Squall hit, the side with more total HP left wins (kettle plus standing Hobs plus standing blocks, counted just before that hit); if that is equal too, the side that went second wins. Zero wind at the start blows toward a seeded side | 00 canonical numbers, §2.2, §2.11, §9.4, §9.6, glossary; 04 §6.14 and §8; 05 §3.1; 06 §7.1; 07 §2.9 |
| (b) Rivet joins in U1 but the U3 Rescue frees him | The Canary Row (6-6) captive is **Petra Chiselwick** (Delver, U3), the rescue 03 already planned. Tansy joins at 5-8 on first clear, not as a rescue, since 5-8 is a Demolition level | 05 §3.7 row 6-6, §6.4, §9 item 3; 03 §3 (Tansy), §3.9; 02 §2.3 |
| (c) The 99 full-HP clamp fails for 80 and 90 HP Hobs | "No single shot Bonks a Hob from full HP": if a Hob starts a shot at full HP, the sim clamps that shot's direct damage to it at its HP minus 1. Crush, falls and Burn ticks do not count | 00 canonical numbers, §2.10; 01 changes, §1.6, §7.3, red flag 4, §9 item 5; 02 AM-14 |
| (d) Kettle rules in 00 | Confirmed and stated twice in 00: falling chunks hit the Heartkettle at 50% of their crush, and a Beam that has passed through any block deals half to the Heartkettle | 00 canonical numbers (Heartkettle row), §2.10 Heartkettle paragraph; 01 §9 item 3 closed |
| (e) Duds always labeled at launch | Every Dud says "Dud" on its tile and card, for both sides, from launch. No hidden Dud, no stamp, no Peeper rule. From U2 a Peeper shows the Rival's draft picks instead | 00 §2.15 and glossary; 07 §4.1 (the `?` stamp is gone) |
| (f) Kit nodes 01 §9 asks of 02 | Kit branch rebuilt inside the same budget (36 launch, 60 total, same costs and core set): KT-02 **Kitchen Drawer** adds Dinner Gong, Borelight and Grandfather Clod; KT-04 **Mole Mine** and KT-07 **Bellows** unlock those Doodads at launch; KT-09 **Scarecrow** is U2. The four old shell-set nodes are gone; three new non-shell nodes fill the free slots: KT-10 **Snow Shovel** (U2), KT-12 **Swap Shop** (U3, core), KT-13 **Ore Cart** (U3). No keystones exist, so the Junk Shell is parked | 02 §1.2, §1.6, §6.1, §8; 01 glossary, §4 unlock plan, §5 Doodad sources, Appendix B.1, §9 item 7 |
| (g) Level 1-1 Squall exception | Kept. 1-1 has a cap of 8 and no Squall: when the cap runs out, Sir Pudge dozes off and the player wins with 1 Pennant. The core range is now 8 to 20, with 8 only in 1-1 | 00 canonical numbers, §2.11, §2.12, §8.3, §9.4; 05 row 1-1, §9 items 4 and 6 |
| (h1) Thwack cap 120 (00) vs 110 (01) | 110, as the weapons doc sets it (01 owns shot numbers; its Heavy band tops at 100, Match at 110) | 00 canonical numbers, §2.10, §9.3 |
| (h2) Onboarding order | Wind at 1-4, one Knack at 1-5, Rummage pool of 4 with 2 picks at 1-8; no wind in 1-1 to 1-3. 00's table now summarises 05 (owner of levels) and 07 (owner of prompt words) | 00 §2.5, §8.3 |
| (h3) All-dug-in rule | If every live Hob on a side is dug in at its turn start, the **newest** burial clears by itself (01's rule). 03's "lowest Loophole" and its buried-Delver exception are dropped; a Delver shot or Mendglob on the Nook clears a burial | 00 §2.2, §2.7, glossary; 03 §7.2, §9 item 8 |
| (h4) Rescue and the Squall | Rescue joins Demolition, Puzzle and Escort as a type whose round limit is the mission rule; no Squall follows, and reaching the limit is a loss | 05 §3.1; 07 §2.9; 00 §2.11 |
| (h5) First Doodads | Doodads open at 2-1 with Mend Bucket and Pot Lid, so 1-6 teaches only the Workshop (R04 B14, pillar "one idea per level") | 01 §5 and changes; 02 §4.4, §6.1; 05 §6.4; 07 §4.1 mock |
| (h6) Trial side paths | 05 places them: T1 after 1-8, T2 after 1-9, T3 after 2-6, T4 after 2-8, T5 after 3-5, T6 after 4-4; U1 T7 after 1-10, T8 after 4-8; T9 after 5-8; T10 after 6-5. Each follows the level that teaches what it uses | 05 §5.1; 02 §4.1, §4.4 (recomputed), §4.6 |
| (h7) Baron Rush unlock | After 6-10, since it runs all six Grand Forts | 05 §5 table |
| (h8) Late-recruit rank | 02's rule: a Hob that joins after Region 1 joins at the Rank of your fifth-highest Hob (kinder, pillar 5) | 03 §5.1, §9 item 3 |
| (h9) Quirk and Deed counts | 03's model: Ranks 1 and 2 a Class pair, Rank 3 a Class Quirk or the Knack Quirk (35 Class Quirks and 16 Knack Quirks at launch); 6 Deeds per Hob, Mastery ranks at 1, 2, 3, 5, 6 | 02 §2.1, §2.4, §8 |
| (h10) Rival perk "Keystone" | Now "Fork pick": one side of one Tinker fork the player can own, from Region 3 | 04 §3.3, §8 item 5 |
| (h11) Trial Keepsakes | One Puzzle Box for all Trials released, as 05 says, not one Keepsake per Trial | 02 §5.2 |

---

## 3. Fixes made, by file

**00-core-game-design.md**
- Changes list: item 23 for this pass.
- Canonical numbers: new rows for maps (59 / 95), enemy unit types (14 / 28) and Grand Forts (4 / 6); round-cap row (8 to 20, 1-1 no Squall, "other Grand Forts"); Sudden Squall row; Heartkettle row (crush 50%, Beam half); hard caps row (HP minus 1 clamp, 110 Thwack).
- §2.2 turn steps 1 and 5, the no-lost-turns rule (newest burial clears), who goes first.
- §2.5 wind starts at 1-4.
- §2.7 buried Loophole clears (blast, Delver shot, Mendglob) and the all-dug-in rule.
- §2.10 Heartkettle paragraph, per-shot caps.
- §2.11 Squall table and rules rewritten; 1-1 and limit-type exceptions.
- §2.12 round cap; §2.15 Doodad examples, Dud rule.
- §5.5 free trial holds both Region 1 Trials.
- §7.2 glossary: Sudden Squall, Buried Loophole, Dud.
- §8.3 onboarding tables rebuilt from 05 and 07; Region 2 lesson line.
- §9.3 Massive band note; §9.4 round cap and Squall; §9.6 Squall check table and notes.

**01-weapons-and-shots.md**
- Changes 8 and 22 to 25; short-form "Kit set" names KT-02.
- §1.6 full-HP clamp; §4 unlock plan names KT-02, drops the "no shell node" fallback.
- §4.10 Cold Shoulder text no longer says "Chills".
- §4.16 Junk Shell parked; score table row removed; Appendix B.1 now lists 15 shells.
- §5 Doodads: Mend Bucket and Pot Lid from 2-1; Bellows KT-07, Mole Mine KT-04, Scarecrow KT-09.
- §7.3 hard caps and clamp note; red flag 4.
- §9 items 3, 4, 5, 7, 8, 9, 10, 11 closed.
- Appendix A Quirk count line.

**02-tech-tree-and-progression.md**
- Changes item 13.
- §1.2 Kit diagram and §1.6 Kit table rebuilt (see 2f). AM-14 clamp wording.
- §2.1 Quirk counts; §2.3 recruit table and update split; §2.4 Mastery (6 Deeds).
- §4.1 Trial side paths; §4.4 level table: Trial markers moved, Buttons and Pennants recomputed, "New this level" regenerated from 05, 03 and 01 for all 60 rows; §4.6 typical income column.
- §5.1 achievement 28 is now "Lid On" (launch), so 35 still ship at launch; §5.2 Keepsakes.
- §6.1 region rows (Hobs, shells, Doodads); shell and Doodad source paragraphs; §8 notes 1 to 3.

**03-crew-units.md**
- Changes item 17.
- §1 rules: Rest and Match wording.
- §3.0 U2 line and launch-rule line (no Chill); Old Thumper unlock 2-3; Frostine passive and Shiverpuff; Winkle passive; Tansy unlock (5-8, not a rescue); §3.9 table.
- §4.4 trio name; §4.5 anti-synergy 5; §5.1 late-recruit rank; §6.3 state 13; §7.2 buried Loophole; §7.4 Rest count.
- §9 items 3, 5, 8 closed.

**04-enemies-bosses-ai.md**
- Changes item 18 and item 7 (1 to 5 Nooks).
- §2.1 bench Knack count (4), Rest, Match bonus; §2.2 Ruler Sniper (20 then 40) and Clerk Major (Rest).
- §3.1 Nooks 1 to 5; §3.3 Fork pick perk.
- §6.1, §6.3, §6.7, §6.8, §7.4: Rest and Match wording.
- §6.14 Squall behaviour rewritten for the round-end hit and the double-pop rule.
- §8 items 1, 4, 5.

**05-campaign-levels-maps.md**
- Changes item 18.
- §2.4 Region 3 enemy style (Silt Lobbers; Dredgers in U1).
- §3.1 Rescue lose line; Squall paragraph.
- §3.3 row 1-1 (Cap 8); row 1-10 crew (Mower Minder).
- §3.7 row 6-6 (Petra).
- §5 mode table (Skirmish reward, Baron Rush after 6-10); §5.1 Trial side paths; §5.5 Long Siege rewards; §5.7 Baron Rush rewards.
- §6.4 onboarding row 1-8 (Doodads from 2-1); Rivet note.
- §9 items 3, 4, 6 closed.

**06-art-direction.md**
- Changes item 13; §7.1 Squall text and block shiver on both forts.

**07-ux-ui-audio.md**
- Changes item 19.
- §2.9 Squall text, tick row, screen reader line, limit types.
- §4.1 pre-battle mock (no Doodad at 1-8), Dud chip, "best with" wording; §4.2 shell card wording.
- §4.7 Crew screen shows Rank.
- §6.4 Threaded and Dud slow-mo rows; §6.5 Threaded double tick.
- §7.5 Auto-pick Hob wording.

**docs/research/MAC-PLAYTEST-BRIEF.md** (style check only)
- Two prose mentions of the assistant reworded. Branch names unchanged.

---

## 4. Remaining items

### 4.1 Owner decisions (rulings section D, kept)

1. Launch scope per 04 section A. Recommend yes.
2. Price: free Region 1, one Full Kingdom unlock at 6.99 USD, all updates free; web unlock on a code. Recommend yes.
3. Couch Duel: U1, off at launch, sim supports it from day one. Recommend yes.
4. Portrait: landscape only at launch. Recommend yes.
5. Audio: 14 MB full plan, 2.8 MB boot pack. Recommend yes; raise the cap.
6. Final art by human artists; concepts in `docs/art` set the direction. Recommend yes.
7. Max camera zoom 1.25. Recommend yes.
8. Target players: genre fans first, casual players second.
9. Trademark search on world, crew and shell names before art production (now also Kitchen Drawer, Snow Shovel, Swap Shop, Ore Cart, Lid On).
10. One named content owner who holds the counts.

### 4.2 New owner decisions from this pass

11. **Double-pop rule.** R04 B5 says "no score sums". The new tie rule compares total HP only when both kettles pop on the same Squall hit, which bots should show is rare. Confirm this narrow sum is acceptable, or pick "the side that went second wins" alone. Recommend the total-HP rule: it keeps kills and walls meaningful to the very end.
12. **Branch names in the playtest brief.** `docs/research/MAC-PLAYTEST-BRIEF.md` names one git branch twice, and that branch name starts with the assistant's product name. It is a live ref, so it was left. Rename the branch and update the brief, or accept it.
13. **New content from this pass.** Three Kit nodes (Snow Shovel, Swap Shop, Ore Cart), achievement "Lid On" and the Trial side-path placements are new. The content owner confirms them with the counts.

### 4.3 Design items still open (not owner calls)

- **Thump on Wicker** (01 §9 item 12): a Thump takes 10 of 30 from every Wicker block; the fun review asks for Hobs and the bottom two rows only. The core rule stands until red flag 7 trips in bots.
- **Fall share** (01 §9 item 13) and the late-fort collapse gate: week 6 bot run.
- **Squall and boss notches, Hill Call cap, clan crate pool, Rival chatter voice** (04 §8 items 1 to 3, 6, 7).
- **Campaign items** 05 §9 items 5, 7 to 13 and 17 to 21 (habit weights, Rival names, Bellows Towers, Plumb Line read, win-rate bands, story cast, new sim objects, held levels, Grumblenimbus, Fen cut line).
- **Audio tag:** 07 §9.3 tags `launch_dud` as U1 while two Duds ship at launch. The audio owner either retags it Launch (76 launch events) or lets launch Duds use their group's launch sound.
- **Concept sheets to redraw** (06 §14 item 8) stay with the art agent; add the Kit branch names above to the art 19 relabel.

---

## 5. Owner decisions applied

The owner ruled on rulings section D. The design editor applied it to docs 00 to 05 and to 04-rulings (section D now marks each call DECIDED).

- **Free, no monetization.** Every price, trial, Full Kingdom unlock, web unlock code, Restore Purchases line and Supporter Pack is gone. Region 1 is no longer a trial; the trial column (05 §2.1), the trial Trials line (05 §5.1), the Daily loan rule for trial players (00 §5.5, 05 §5.4) and the map card (05 §8) are removed. "No paid power" rules stay.
- **Couch Duel at launch.** New 00 §6.1 holds the full design; 05 §5.8 gives its maps; 01 §1.9 and 04 §6.1 cover the open draft and no AI. Scope tables in 00 and 04-rulings section A list it as a launch mode.
- **Portrait and landscape.** Landscape-only lines in 00 now say both; 06 and 07 own the layouts.
- **Confirmed:** human final art, the double-pop rule (item 11 in 4.2 above is closed), gentle wind from 1-4 with Wind off, first Doodad at 1-9.
- **Still open:** launch scope, audio size, zoom, trademark search, content owner, the branch name item, new content counts. Couch Duel at launch needs a tech plan re-estimate.

