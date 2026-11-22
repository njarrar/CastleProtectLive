# 01. Consistency Audit

Status: review for the lead designer and the owner. Date: 2026-11-22. Author: design editor.

**What this covers.** Every design doc in `docs/design/`: `00` core, `01` weapons, `02` tech tree, `03` crew, `04` enemies and AI, `05` campaign, `07` UX and audio. There is no `06` art doc yet, so this audit reads the text in the concept art under `docs/art/*.svg` in its place. Research files were skimmed for context only (`docs/research/04-tech-stack.md`, `03-code-and-tech-survey.md`).

**What this does not do.** It edits no design doc. Each ruling below is a proposal for the doc owner to apply. Where a ruling needs the owner, section 4 lists it.

**How to read the table.**

- **Src**: `K` means the issue was already known and named in the brief for this audit. `F` means this audit found it.
- **Docs**: doc number and section, for example `00 §2.9`. `art 19` means `docs/art/19-tinker-tree-mockup.svg`.
- **Impact**: `High` breaks a rule, a level or a build. `Med` makes two teams build different things. `Low` is wording or a number that only needs one edit.
- **Ruling**: one pick, then the reason. "Edit" names the doc text that should change.

**Count.** 89 conflicts in 9 tables: 27 rows cover the known items named in the brief for this audit, 62 were found by this audit. Section 3 lists the agreed values after the rulings. Section 4 lists what only the owner can decide.

---

## 1. Conflicts and rulings

### 1.1 Crew, roster and castle fit

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C01 | K | 00 §2.9, §10.3; 03 §3; 02 §2.3; 05 §3.2 | 00: 3 Hobs per Class, "about 24". 03, 02, 05: 28 (Lobber, Zinger, Scatterjack, Boinker have 4) | High: art, voice, Almanac, scope | **28 Hobs.** Three docs and all 28 Knacks in 01 are built on it. Edit 00 §2.9 and the scope line in §10.3 |
| C02 | K | 03 §3, §3.9; 05 §6.4, §9.2; 02 §2.3, §4.4, §8.12 | 03 and 02: Hetty 1-10, Dame Flicka 2-7, Rivet 5-5, Tansy 6-2. 05 moves them to 1-7, 2-8, 5-6, 6-8 so each Rescue level frees a real Hob. 02 §8.12 says 05 lists 24 joins (stale: 05 lists 28) | Med | **05's levels.** A rescue that pays a Hob is the better story beat, and Hetty at 1-7 gives trial players a Patcher for the cart in 1-9. Edit 03 §3 and §3.9, 02 §2.3 and the "New this level" cells for L7, L10, L17, L18, L45, L46, L52, L58. Delete 02 §8.12 |
| C03 | K | 00 §2.9, §9.2; 02 §2.2; 03 §4.1, §9.1; 07 §12 risks | 00: start with 4 Hobs and 3 Nooks (a crew of 4 cannot sit in 3 Nooks). 02 and 03: 1, 2, 3 Hobs as owned, 4 from 1-7 with a free fourth Nook, 5 at CT-05, 6 at CT-09. 07: "4-Hob start" | High | **02 and 03 schedule.** It matches who you own. Fixed rule: Nooks are never fewer than seated Hobs. Edit 00 §2.9 and §9.2 to "Hobs per battle: 1 to 3 in levels 1-1 to 1-6, 4 from 1-7, cap 6". Edit 07 risk row |
| C04 | F | 02 §3.2, §1.4; 00 §3 "Grind" | 02 says a 5 x 5 grid fits the Kettle Room and 2 walled Nooks, and 6 x 6 fits 3. But the player seats 3 Hobs from 1-4 and 4 from 1-7, while 6 x 6 needs CM-01 and CM-02 (Tier 1, buyable only after 1-4) and a fourth walled Nook needs CM-04 (Tier 2, Region 2). So levels 1-4 to 1-10 need nodes to seat the crew. 00 fixes "no level needs any node" | High | **Grid growth that seats the campaign crew is a free gift, not a node.** Start grid 6 x 6 (02's own "Early" row: Kettle Room plus 3 Nooks). At 1-7 the free fourth Nook comes with the smallest free grid step that the Workshop validator proves can hold Kettle Room plus 4 walled Nooks. CM-01, CM-02, CM-04, CM-07 become the steps above the gift up to 8 x 10. The fixed no-grind rule outranks a node price |
| C05 | F | 04 §3 rules; 05 §3.3 to §3.8; 04 §3 table | 04: every enemy fort follows player build rules: Kettle Room one block in from every face, 3 to 6 Nooks. A covered 2 x 2 Kettle Room needs a fort at least 4 wide. 05: 1-1 Wicker 3 x 3 with a Hob and a dummy; 1-2, 1-3, 1-4 and 2-9 wave 1 are 4 x 4 with 2 or 3 Hobs; 1-1 has 2 rooms, under the minimum of 3. 04: The Beanpole is 3 wide with a kettle; The Hedge Box is 5 x 4 with 3 Nooks | High: forts cannot be built | **Every fort, player or Rival, must pass the Workshop validator.** 05 sizes are hints; 05 §3.12 already says the archetype shape wins. Change 04's rule to "1 to 6 Nooks" so Region 1 forts may have 1 or 2. The Beanpole becomes at least 4 wide. Level data that fails the validator fails the build |
| C06 | K | 01 §3, §9.6; 03 §5.1; 02 §2.1 | 01: Knack Tier 2 at Hob level 4, Tier 3 at level 8. 03: a level adds HP and "nothing else scales". 02 table: levels 4 and 8 give HP only | Med | **Keep tiers at Hob levels 4 and 8.** Those levels give nothing today; tiers add reach or a rule and at most +15% damage from Base to Tier 3. Training is earned by play, so this is not paid power. Edit 03 §5.1 to "levels add HP; levels 4 and 8 also open Knack tiers" and add both to the 02 §2.1 table. Bots for the floor build use Base tier |
| C07 | K | 03 §3 intro; 01 §3, §9.7 | 03: Knacks are Medium unless marked Heavy. 01: Molehill Surprise, Drenchbarrel, Chalk Fan, Tattle Bell, Snoop Kite are Light | Med | **01.** A scout Knack that benches the scout is a bad trade. Edit 03 §3 intro and the five Hob entries |
| C08 | F | 03 §2.2 to §2.5, §2.8; 01 §2, §9.8 | 03: Zinger bolt 30, Scatterjack pellet 12, Delver 30, Boinker flat 30. 01: 32, 14, 34 plus a Peephole, +5 per hop | Low | **01.** 03 already says 01 wins on shot numbers. Edit the 03 Class sheets |
| C09 | K | 00 §2.10; 03 §7.3, §9.2 | 00: a Nook is intact while "all four of its outer wall blocks" stand. A 2 x 2 hollow touches 8 blocks. 03 reads it as four sides: floor, ceiling, front, back | Med | **Four sides, every block on each side (up to 8 blocks).** Any one gone makes the Nook Open. A Cellar floor is Footing and counts. HP does not matter. Edit 00 §2.10 |
| C10 | K | 00 §2.10; 03 §7.3; 01 §1.6, §9.2 | 00: Cover halves "blasts" from outside. 03: only Blast type is halved. 01: every area payload centred outside, any type | High | **01.** Area payloads (blast band Tiny or larger) centred outside an intact Nook are halved whatever the type. Point hits (band "Point", see C47), Threads, Burn ticks, crush and fall are not. Without this, Fire and Frost bursts hit covered crew harder than Blast. Edit 03 §7.3 bullets 3 and 4 |
| C11 | K | 03 §1.1 (P) | Scamper stat (Slow, Steady, Quick) sets fall safety and Scurry reach. 00 has no such stat | Low | **Accept.** Small, readable, used by Scurry and the Peeper seat puzzle |
| C12 | K | 03 §1.2 (P) | Seat words: Cellar, Loft, Middle, Front, Back, Core, Neighbors. 00 has none | Low | **Accept** as Workshop terms. Add them to the 00 glossary |
| C13 | K | 03 §1.3, §2 (P); 00 §2.9 | 03 adds a Seat Perk and a Neighbor Perk per Class. 00 gives one example perk (Patcher heals 5) | Low | **Accept.** The 00 example is kept as the Patcher perk "Mend" (renamed, see C49) |
| C14 | K | 03 §7.2 (P); 01 §1.2 "Threads", §9.1 | "Pin through Loophole": a point shot that enters the 6-cell slot hits the Hob in full with no Cover and calls "Threaded!" | Med | **Accept.** 01 and 03 agree. Blasts, fluids and fields never thread |
| C15 | F | 03 §7.2; 04 §4.5 phase 3; 01 §7.6 flag 8; 04 §2.2 Topiary Drop; 01 §4.8 Cobble Cork; 00 §2.7 | 03: a buried Loophole makes the Hob's shot burst on the dirt until any blast or Delver shot clears it. 04 GF4: buried Hobs skip a turn, then dig out alone after 1 turn. 01: auto-clear after 2 turns only as a bot fix. Bush blocks and Cobble Cork add blocks to your fort, but 00 says own blocks never block own shots | Med | **03's rule everywhere.** No skip and no auto-clear unless bots trip flag 8. Blocks placed by the other side (bush, squatter cork, scrap) are foreign and do block your shots; the Hob's portrait shows the dirt or block icon. Edit 04 §4.5 phase 3 and add the foreign-block line to 00 §2.7 |
| C16 | K | 03 §7.4 (P) | Crowded Nook: two Hobs in one room, neither has Cover, a blast inside hits both | Med | **Accept.** It makes stacked Nooks a real trade. HUD marks it (03 §7.8) |
| C17 | K | 03 §7.4 (P) | Perched and Porch states for a Hob with no free Nook | Low | **Accept.** It closes a hole in the 00 Tumble rule |
| C18 | K | 03 §7.6 (P); 02 CT-04 | Scurry as an Action, behind a Crew node | Low | **Accept.** 02 already places it at CT-04 |
| C19 | F | 03 §1.2; 02 CT-10 | 03: Neighbors share a wall block "or sit one block apart". 02 CT-10 Bunk Mates: perks reach Nooks one block apart, "not only touching". The node does nothing under 03's definition | Med | **Base Neighbors share a wall block. CT-10 adds one block apart.** Edit 03 §1.2 |
| C20 | F | 01 §3.8, §9.16; 02 AS-K2 | Tattle Bell "marks" a Hob for +20% on the next hit. AS-K2 Spotter's Eye gives a "Mark" for 3 turns that bends shells. Same word, two effects; neither is in the 00 status list | Med | **Tattle Bell keeps "Marked" as a Knack effect, not a status. AS-K2's effect is renamed "Spotted".** One word, one meaning |
| C21 | F | 03 §1.1; 04 §4.7 Stage 3 | 03: a named Hob sits within 10 of its Class base HP. 04 makes the Baron a Lobber Hob with 140 HP (Lobber base 120) | Low | **Boss units are exempt from the ±10 rule.** The rule guards the player roster. Note it in 03 §1.1 |

### 1.2 New rules in the weapons doc

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C22 | K | 01 §6 combo 3, §9.3; 03 §4.3 (P); 05 5-7; 04 §4.4 phase 3, §2.2 Dredger; 01 §4.11 Puddle Jumper | 01 and 03: Zap deals x1.5 to Soaked targets. 05 relies on it. 04 GF3 says Soaked Hobs take Zap "x1.2" (that is the base Hob multiplier) and the Dredger adds a chain from nearby brass to Soaked Hobs. 01's own Puddle Jumper says Soaked Hobs take 36 (30 x 1.2), which skips the x1.5 | High | **Soaked: Zap x1.5, applied after the material or Hob multiplier.** It does not stack with Brittle (01 §9.4). Puddle Jumper on a Soaked Hob deals 54. Edit 04 GF3 phase 3 text and drop the Dredger's extra chain. Add Soaked x1.5 Zap to the 00 status list |
| C23 | K | 01 §6 combo 1, §9.11; 00 §2.10 | 00: Burn spreads once to touching wood. 01: at wind 5 or more, each tick Burn also jumps one wood block downwind, even over a one-block gap | Med | **Accept, with a cap of one downwind jump per tick.** Red flag 6 (fire snowball) stays the guard. Add to 00 §2.10 |
| C24 | K | 01 §1.5, §9.4; 00 §2.8, §2.10 | 01: a Brittle Moonbrick block does not heal; Fire ends Brittle; Brittle and Soaked bonuses do not stack. 00 is silent | Med | **Accept all three.** They are what make Frost the Moonbrick answer. Add to 00 §2.10 |
| C25 | F | 01 §1.6, §9.5; 00 §2.10 | 01: the Heartkettle takes 0 from Frost and cannot be Brittle. 00's kettle line lists no Frost | Low | **Accept 01.** Add Frost 0 to 00 §2.10 |
| C26 | F | 01 §1.2, §1.1 rule 6, §9.10, §9.15 | New sim rules with no 00 line: Peephole, Metal tag, Roller hop, Steered shots (2x off while one flies), cap of 3 props and 3 zones per side | Med | **Accept all.** Tech plan adds them to the sim spec. Add Peephole and Steered to the 00 glossary |
| C27 | F | 01 §1.6, §7.3 hard cap; §4.3 Woodpecker, Gritspitter; §4.5 Brass Marble | Hard cap: no shot deals over 60 to the kettle in one use. Woodpecker can put 93 Pierce on one spot; Gritspitter 80 at point blank; Brass Marble up to 5 x 22 = 110 | High | **The sim clamps any one shot's total to one kettle at 60.** Then tune the three shells so the clamp rarely fires. A cap that the data breaks is not a cap |
| C28 | F | 01 §7.3 hard cap; §4.2 Bumblejar; §4.3 Gritspitter; §4.5 Brass Marble | Hard cap: no shot Bonks a full-HP base Hob (100) through Cover in one use. Bumblejar 8 x 13 = 104 (threads, no Cover); Gritspitter 10 x 12 = 120 close up; Brass Marble 5 x 33 | High | **The sim clamps one shot's total to one Hob at 99 when that Hob started the shot at full HP.** Tune bee and pellet counts after |
| C29 | F | 01 §1.5, §4.13 Cuckoo Clock | 01 twice says Cuckoo Clock "out-paces Moonbrick's heal". 20 Blast x 0.6 = 12 per pop; Moonbrick heals 24 | Med | **Make it a rule, not a number: a block with a Cuckoo Clock on it does not heal.** Keeps the stated role without a damage buff |
| C30 | K | 01 §7.4, §7.6 flag 9, §9.9; 02 CT-03, CT-K1; 03 §5.2 Third Helping, Trick Bag | A 4-Hob crew holds 8 Knack uses, 4 shells, 2 Doodads: 14 special Actions in an 8 to 12 turn battle, so Plain Shots go unused and Light Weight stops mattering. Knack Pouch, Captain's Call and two Quirks add more uses | High: Plain Shots and Weight lose their job | **Keep the hand as is for M1 bots, with the fix pre-agreed.** Bots report Plain Shot share; target 25% to 40%. If under 20%, every Knack's second use opens at Round 5, and 3-use effects (Pouch, Quirks) give the third use from Round 8. Decided now so no doc waits on it |

### 1.3 Shots, Knacks and unlock references

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C31 | F | 04 §2.1, §2.2; 01 §4.16, §3.10 | 04 §2.1: enemy units fire their Class Knack plus, for a few, a Twist. 04 §2.2 then names about 20 other enemy Knacks (Leaf Storm, Survey, Ledge Cut, Grit Line, Sanding, Bog Spray, Suction Pop, Silt Tunnel, Mud Pile, Polish, Avalanchette, Frostline, Rivet Rain, Live Wire, Cartload, Floodlight, Plumb Line, Grid Survey, Scald Sweep, Teatime). 01 owns every shot name and stats only the 8 Twists | High: no stats for most enemy shots | **Each enemy unit fires one of 01's 33 Knacks (28 crew plus 5 bench) or one of the Twists.** 04's names stay only as card titles when the stats match a 01 Knack exactly. The Baron's Teatime becomes Twist 9 with stats in 01. Live Wire and Plumb Line names go (see C49) |
| C32 | K | 04 §2.1, §4.1 rule 10, §8.3; 05 §6.4, §9.3; 03 (no slot) | 04: one Turncoat Hob joins per Grand Fort. 05: counted as Outfits. 03: 28 Hobs, no Turncoat slot | Med | **Outfits at launch** (a Flattener cap and tool for an existing Hob of that Class). Keeps 28 Hobs and Twists enemy-only. A post-launch Turncoat Hob is an owner call (section 4) |
| C33 | F | 01 §1.9 Duds; 07 §4.1 | 01: the Dud `?` stamp shows if the crew has a Peeper "or owns the node the UX doc names". 07: shows "only if the player owns the Peeper node for it (weapons doc owns the rule)". No such node exists in 02 | Med | **The stamp shows when the crew includes a Peeper.** Drop the node clause in both docs |
| C34 | F | 01 §5 Doodads 11 to 16; 05 §8; 00 §4.4 | 01: six Doodads unlock from "Side Rival, R1" to "R6". 00 says side paths hold Trials and optional Rivals. 05 defines no side Rival levels | High: 6 Doodads cannot be earned | **05 adds one optional side Rival per region on the map** (a replayable duel, 1 Pennant-free reward each). Until then these six Doodads ship with no source |
| C35 | F | 01 §4 unlock plan; 05 §5.1 | 01: Trial reward shells are 2 per region for R1 to R5 (Bouncemoss and Cuckoo Clock in R5) and none in R6. 05: Trials are 2 each in R1 to R4, 1 in R5, 1 in R6 | Med | **Cuckoo Clock moves to the R6 Trial (T10).** 01 edits one row |
| C36 | F | 01 §4 unlock plan, §5; 05 §5.2 to §5.6 | 01 pays shells and Doodads from modes: Long Siege waves 5 to 30 and wave 12 (Jack Screws), Daily 5 and 15 played, Baron Rush clear (Homecoming Hat), Raid Rehearsal first win (Dowsing Rod), Skirmish 5 Rivals (Ear Trumpet). 05's reward lists for those modes name none of them | Med | **01 is the source. 05's reward lines add each one.** Players must see the toy on the mode card |
| C37 | F | 05 §7.1; 01 §4 unlock plan | 1-9's pool "always holds one Earth shell (makes a mound) and one Shield shell". By 1-9 no mound shell (Sod Sack is R2) and no Shield-tag shell (R3 to R4) is unlocked | Med | **A level's fixed pool may lend shells from the Rival's list** (01 §1.9 already gives the Rival 4 slots). Mark them "on loan" on the card. Hetty (1-7 under C02) can fire the Shield shell |
| C38 | F | 05 1-4, 6-10, §7.1; 01 §1.9; 00 §2.15 | 01's pool rules assume a pool of 10 (6 from you, 4 from the Rival, fit and spread rules). 05 uses pools of 4, 6 and 14, and 6 picks | Low | **Level data may set pool size and picks.** 01's build rules apply to standard pools of 10; small pools use the level's fixed list |
| C39 | F | 02 RS-09; 01 §4 | RS-09 "adds 3 Heavy Trick Shells (Massive damage band)". Nesting Pots is Heavy but peaks at 30 | Low | **Reword RS-09 to "3 Heavy Trick Shells".** |

### 1.4 Glossary and names

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C40 | F | 00 §7.2, §9.3; 01 throughout | Glossary: **Pin** is the impact marker. 00 §9.3 and 01 also use "Pin" as a blast band (radius 0) and "pin shot" for a direct shot | Med | **Rename the blast band "Point" and the shot kind "point shot".** Pin stays the impact marker only |
| C41 | F | 00 §2.9, §2.15; 01 §1.9; 02 §1.6, CT-07 | 00 uses "Trick families" for who can fire a shell. 01 calls that the **tag** and uses "family" for its 15 behaviour groups. 02 uses "family" in 00's sense | Med | **"Family" keeps 00's meaning (13 families: who can fire it).** 01's behaviour groups are renamed "groups". 01 edits §1.9 and section 4 headings |
| C42 | F | 00 §7.2; 04 §4.7 Hill Call, §8.5 | Glossary: a Doodad costs the Action. 04: Hill Call is a Doodad that does not, in Stage 3 only | Low | **Hill Call is a Stage 3 rule, not a Doodad.** Keep it free; it is the theme of the final fight |
| C43 | F | 00 §7.2 Reload | Glossary: "Turns a Hob sits out after a heavy shot". Medium shots also cost Reload 1 | Low | **Reword: "Turns a Hob sits out after a Medium or Heavy shot".** |
| C44 | F | 00 §7.2 Tumbled; 04 §2.2 Gust Bellows | Tumbled means a Hob that fell out of its castle. 04 says hitting the bellows "outside its Nook" Tumbles the Hob | Low | **04 says "drops the bellows and stuns the Hob for its next shot", or the hit must break the Nook floor.** Binding words keep one meaning |
| C45 | F | 03 §3.2 Dame Flicka; 02 SS-K1 | "Charge!" is both a Hob passive and a keystone | Low | **Keystone keeps "Charge!"; Flicka's passive becomes "Joust".** |
| C46 | F | 01 §3.2 Glimmerjolt T2; 04 §2.2 Spark Fitter | "Live Wire" is a Knack tier and an enemy Knack | Low | **Retired from 04 under C31.** |
| C47 | F | 04 §2.2 Ruler Sniper, §4.7 Stage 1; 01 Plumb Bob | "Plumb Line" is an enemy Knack and a boss Rig Part; "Plumb Bob" is a shell | Low | **The Rig Part keeps "Plumb Line"; the enemy Knack is retired under C31.** |
| C48 | F | 02 AS-03; 05 §5.3 Odds and Ends; 01 Doodad 6 | Weathervane (node), Weather Vane (run boon), Weathercock (Doodad) | Low | **Boon renamed "Long Look".** Weathervane and Weathercock differ enough |
| C49 | F | several | More clashes: Anchor (SS-06b) and Anchor Chain (Doodad); Sharp Eye (RS-01) and Sharp Eyes (Winkle); Pot Lid (Doodad) and Pot Lids (Nan); the Patcher perk "Mend", Mend Bucket and Mendglob; Second Wind (Quirk) and Second Wind-Up (Beetle tier); "the Steward" runs your side in Raid Rehearsal (05 §5.6) but is also Steward Prudence Plumb; "scarecrow" is the Doodad, the Cold Open tower (00 §8.3, 07 §5) and Trial T1, while 04's dummy is the Straw Stuffer; Mole Mounds, Mole Mine, Mole Mail, Mole Train | Low | **Rename:** SS-06b to "Stand Fast"; RS-01 to "Keen Eye"; Nan's passive to "Pan Shield"; the perk to "Tend"; the Quirk to "Big Breath"; Raid Rehearsal AI to "the Drill Sergeant"; Cold Open tower and T1 to "straw tower"; Mole Mounds to "Molehills". Each name then has one owner |
| C50 | F | 00 §7.2; art 15; 02 §1.8, §8.13; 00 §2.15; 07 §4.5 | Placeholder shot and Doodad names still in use: art 15 (Pot Bomb, Zing Bolt, Fan Pop, Bore Spike, Fire Pot, Frost Jar, Zap Coil, Mortar Glob); 02 and 07 "patch kit"; 00 "deflector, smoke screen, steam boost" | Low | **01 names everywhere** (Clodpot, Hatpin, Gravel Sneeze, Nibbler, Bouncebean, Emberpot, Mendglob, Peep Pip, Mend Bucket, Pot Lid, Chimney Cough, Coal Scuttle). Art 15 relabels |

### 1.5 Tech tree and progression

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C51 | K | 00 §4.4; 02 §1.1, §8.1; 07 §4.4; art 19 | 00, 07 and art 19: five boughs (Aim, Crew, Fort, Arsenal, Steam). 02: six branches (Arsenal splits into Rummage and Shells, and Doodads), 77 nodes | Med | **Six.** 02 owns the tree and its totals (160 and 100) are built on six. 07 bough rail gets six tabs; art 19 redraws |
| C52 | K | 02 §1.1, §7.3; 07 §4.4, §12.2 | 02: free respec of a node (and its children), a branch or the whole tree, any time outside battle, 100% back. 07: "Untinker" refunds owned leaf nodes only | Med | **02.** It is the wider rule and "never lose what you earned" needs no leaf limit. 07's Untinker button stays, on every owned node, and refunds the node plus anything that needs it |
| C53 | K | 02 SS-10, §8.5; 00 §2.3, §9.1; 07 §2.4, §3.2 | SS-10 lifts max power to 110 for 15 Steam. 00: power 0 to 100. 07 readout and Fine Tune stop at 100 | Med | **Power stays 0 to 100 on every screen. Steam Shot adds +10% launch speed to that one shot** (same range gain, about 21%). The readout shows a small steam badge; the preview uses the real speed. No input or AI change |
| C54 | F | 00 §2.5; 07 §2.4, §5; 02 AS-03; 05 §4.7, 4-1; 03 Dotty; 01 Weathercock | 00: the next front shows "one round ahead". 07: forecast states include "locked (no Tinker node)" yet onboarding teaches it at level 5. 02 AS-03: shows all the time and 2 fronts ahead. 05: "the forecast icon always shows". Dotty: "two rounds ahead" | Med | **Base (00): the forecast shows in the last round of each front.** AS-03: shown all front long, plus the front after. Dotty: shown all front long (no second front). Weathercock and the run boon: two fronts. Edit 07 (drop "locked"), 05 §4.7 and 4-1, 03 Dotty |
| C55 | F | art 19; 02 §1.3 to §1.8 | Art 19 node labels (Recall, Forecast, 5th Hob, 6th Hob, Cobble, Wider, Taller, Trick pool, 2nd Doodad, Big shells, Light step, +20 Steam, Mud boots) do not match 02 (Recall is AS-07 Shot Log, Cobble comes from the campaign, base is already 2 Doodad slots, Bigger Boiler is +30) | Low | **02's names and numbers.** Art 19 is a mockup; relabel |
| C56 | F | 02 §1.1, §3.3, §4.4 (L22, L44, L55); 04 | 02: "the enemies doc gives Rivals their own fixed perks" and "the same rooms"; levels show a Rival Lookout, Snug and Boiler Loft, and "keystone perks". 04 defines no Rival perks and no Rival rooms | Med | **04 adds a short Rival perks table and lists which archetypes carry which rooms.** Until it does, those three 02 rows point at nothing |
| C57 | F | 02 §4.4 "New this level"; 05 §3.3 to §3.8 | The 02 column drifts from 05: Clay at L16 (05: 2-4), strong wind L33 (05: 4-2), avalanche L39 (05: 4-8), mine carts L49 (05: 5-3), "Rival walks a lot" L26, "hill that grows" L57 and others | Low | **05 owns what is new in each level.** 02 regenerates the column from 05 after C02 |
| C58 | F | 00 §8.3 9:30; 02 §1.1; 07 §4.4 | 00: "Tinker Tree opens with one node, Long Sight". 02: all 12 Tier 1 nodes open after level 4 | Low | **All 12 are buyable; the first visit spotlights Long Sight** (07's wording). Edit 00 §8.3 |

### 1.6 Economy

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C59 | F | 00 §5.2; 02 §4.1, §8.7, L60 row; 04 §4.1, §4.7; 05 §6.5 | Grand Fort first clear: 00 500; 02 500 + 25 per Pennant; 04 and 05 500, and 1,000 for the Last Level; 02's L60 row still pays 582 | Med | **500 + 25 per Pennant; the Last Level 1,000 + 25 per Pennant** (it is three Stages). Edit 00 §5.2 and 02 L60 |
| C60 | F | 02 §4.1; 05 §5.1 | Trial first clear: 02 100 Buttons; 05 60 | Low | **100.** 02's income model (+T rows) uses it |
| C61 | F | 02 §4.1; 05 §5.3 | Long Siege: 02 10 per wave, max 200 per run; 05 20 per wave won | Low | **02.** The cap keeps farming slow (02 §4.8 rule 6) |
| C62 | F | 00 §5.2; 02 §4.1; 05 §5.2, §9.14 | Daily: 00 and 02 "60 once per day". 05 reads it as 60 once per date for any of the last 30 dates | Low | **60 for the first Daily clear each calendar day,** whatever date is played. Back-catalogue dates pay nothing. Stops a one-time 1,800 Button dump |
| C63 | F | 05 §5.4, §5.6; 02 §4.1 | Rewards in 05 that 02's earn table lacks: Raid Rehearsal 50 once; Baron Rush Bronze 500 once. 02 lists Ironclad 100 per level; 05 does not | Low | **02 §4.1 is the single earn table and adds the 05 lines; 05 adds Ironclad Buttons.** |
| C64 | F | 00 §5.3; 02 §4.2 | Full Moonbrick castle: 00 "80 blocks costs 16,000"; 02 "about 8,000" | Low | **About 8,000.** Footing is free and rooms are hollow, so a full 8 x 10 fort holds about 40 solid blocks. Edit 00 §5.3 |
| C65 | F | 00 §2.7, §9.2; 02 §3.2; 07 §4.3; art 18 | 00: "at most 80 blocks". 02: 80 grid cells including Footing, so the Block Budget is 72. 07 and art 18 show "Blocks 31/80" and "50/80" | Low | **The cap is the 8 x 10 grid (80 cells with Footing); the Workshop counter shows the Block Budget, x / 72.** |
| C66 | F | 00 §10.3; 02 §4.5; 05 §6.4 | Region 1: 00 and 05 40 min, 02 45. Campaign first clears: 02 7 h, 05 5 to 7 h. All Pennants: 02 11 to 13 h for 210, 05 12 to 15 h for 180 | Low | **Region 1 about 40 min; campaign about 7 h; all 210 Pennants 12 to 14 h.** One set of targets for bots |
| C89 | K | 05 §5.2, §9.13; 00 §5.5, §4.5 | 00: the trial holds Region 1 and the Daily, and every date's Daily is the same for everyone. 05: the Daily lends a loan crew and later-region maps, so trial players play content they have not bought | Med | **Keep one shared Daily and allow the loans.** Nothing a loan shows is unlocked, and the result card links to Full Kingdom once. Splitting the Daily by owner status would break "same battle for everyone". Owner confirms (section 4) |

### 1.7 Battle rules, maps and bosses

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C67 | K | 00 §2.1, §9.1; 05 §4.8, §9.5; 07 §2.6 | 00: castles 1000 to 1800 cells apart. 05: at the 0.6 zoom floor both forts fit only if centres are 1400 or less apart. 07 repeats 1000 to 1800 | High | **Duel gap 1000 to 1400.** Up to 1800 only on Long maps, where the camera travels. Keeping both forts in one frame is a pillar 2 need. Edit 00 §2.1, §9.1 and 07 §2.6 |
| C68 | F | 00 §2.1; 05 §4.8, §9.6 | Pocket and Small maps use gaps of 500 to 1300, under the 1000 minimum | Low | **Allowed for Puzzle Shot, Trick-shot and teaching duels only.** 00 notes it |
| C69 | F | 00 §3; 07 §2.3; 05 §4.3 rule 3 | 00: top HUD strip under 10% of height; 07 measures 9.2%. 05: "the top 15% of the screen is under the HUD strip" | Low | **The strip is under 10%. 05 keeps a 15% top band free of targets as a safety margin** and says so in those words |
| C70 | F | 00 §2.12, §9.4, §8.3; 05 1-1 | 00 sets level caps at 8 to 20, but its own onboarding gives level 1 a 6-round cap, and 05 uses 6 | Low | **Caps 6 to 20; 6 only for 1-1.** Edit 00 §2.12 |
| C71 | K | 00 §4.4, §7.2, §2.12; 04 §4.1 rule 8, §4.7, §7.3, §8.1; 05 6-10, §5.4 | 00: one Grand Fort per region, the Baron is the last; battles "never over 8 min". 04 and 05: the Last Level is one level in three Stages, 12 rounds each (36 in all), with a mend and autosave between Stages; Baron Rush counts it as 3 fights. 04 §4.1 says Grand Fort caps 18 to 20, 04 §7.3 says 12 to 18 rounds | Med | **Keep six Grand Forts, the sixth in three Stages.** Each Stage is its own battle for the 8-minute rule and saves at its start. Grand Fort caps: 18 to 20 for GF1 to GF5, 12 per Stage for GF6. Edit 00 §2.12 and §4.4 |
| C72 | F | 00 §2.14, §2.5, §2.15; 05 §3.1 KH, 4-9, §5.3; 04 §4.7 | Levels change "core" numbers: King of the Hill Steam 200, 1-round fronts, Long Siege pools of 6, Rush pools of 8 | Low | **00 adds one line: level data may set Steam, front length, pool size, picks and round cap, and the level card shows each change.** |
| C73 | F | 04 §4.7, §5.4; 05 §5.4; 02 SS-01 | GF6 Stages and Baron Rush "refill Steam to 100". Bigger Boiler raises the pool to 130 | Low | **"Refill to your Steam cap".** |
| C74 | F | 04 §6.13 Mood; 05 1-10, 3-10, 5-10, 6-10 | 04: bosses aim one grade above the region's Rivals. 05 gives bosses the region's top grade (1-10 Aim 2 with Rivals 1 to 2; 6-10 Aim 4 with Rivals 4) | Low | **05.** Bosses get hard through phases, not aim (05 §6.2 rule 6). Edit 04 §6.13 |
| C75 | F | 05 §3.1, §9.8 | One Action per side per turn even with a fort plus Outposts or boss add-ons | Low | **Accept.** It keeps rounds short and matches 00 §2.2 |
| C76 | F | 01 §5 Scarecrow; 02 CM-06b Decoy Kettle; 03 §7.1 rule 7; 00 §2.10; 04 §2.2 Straw Stuffer | 03: "The Muster shows empty Nooks as empty. No fake icons." 00: the kettle glow makes the core path "always plain". The Scarecrow Doodad shows a fake Hob and the Decoy Kettle a fake glow. 04's Straw Stuffer is always shown as a dummy | Med | **Fakes come only from named player tools (Scarecrow, Decoy Kettle) that Rivals may also field and that the AI reads exactly as a player would.** Reword 03 rule 7 to "the game never fakes info on its own". The Straw Stuffer stays honest |
| C77 | F | 01 §1.9 Quick Pick; 04 §6.15 | 01: Quick Pick takes the best-fit four by Class, then rarity, never a Dud. 04: Quick Pick runs the draft AI at Fair | Low | **04's draft AI at Fair, with 01's rule that it never takes a Dud for the player.** |

### 1.8 Tech plan

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C78 | K | 00 §2.7 note, §10.3; research 03 §10, §13; research 04 §7; 03 §7.5 | Research 03: blocks as Planck.js rigid bodies. Research 04 and 00: a simple deterministic support check. AI, preview, replays and the Daily need the same result on every device | High | **Deterministic support check decides what falls and where. Physics, if any, is view only and must end where the sim says.** Prototype the look of both in M0, per 00 §10.3 |
| C79 | F | 00 §9.1; research 04 §7 (60 Hz); research 03 (120 Hz shells); 04 §6.11 (360 steps for 3 s) | Sim step is still open: 60 Hz in one file, 120 Hz shells in another, and the AI budget assumes 120 Hz | Med | **One 60 Hz sim tick; shells take 2 sub-steps per tick (120 Hz).** Both research files are then right, and 04's cost numbers hold |

### 1.9 UX, audio and art

| ID | Src | Docs | What each says | Impact | Ruling |
|---|---|---|---|---|---|
| C80 | K | research 04 §11; 07 §9.6, §12.1 | Research 04: all audio under 6 MB. 07: six layered region themes need about 14 MB (Full plan); a Lean plan fits 5.5 MB | Med | **Full plan, 14 MB cap, 3 MB boot pack.** Regions load on entry, so first shot never waits; 14 MB is still tiny for the store. Owner confirms (section 4) |
| C81 | F | 07 §1.3, §9.6 | Cold Open must load under 1.5 MB, but its audio alone is about 1.2 MB | Low | **Cold Open load cap 2 MB** (audio 1.2, the rest map, Hob, prop and code). Still inside the 2 s boot card |
| C82 | F | 01 §1.3; 07 §6.3, §7.1; art 20 | Type colours and badges differ. 01: Blast orange, Pierce white needle, Fire red, Zap yellow. 07: Blast warm white, Pierce pale yellow arrowhead, Dig tan spade, Fire orange, Zap violet. Art 20: Zap pale blue (close to Frost), Fire orange. The Rival side is orange #E8730C, so orange Blast or Fire trails read as "theirs" | Med | **07's table owns type colour and badge.** Fire moves off the Rival orange toward red; art 20 moves Zap to violet so it does not match Frost. 01 cards and trails follow 07 |
| C83 | F | 01 §8.1; 07 §6.1, §6.2, §6.4, §6.5 | Juice numbers differ. Shake: 01 levels up to 14 px, 07 trauma cap 12 px. Hit-stop: 01 30 ms on Medium blasts, 07 none under 30 damage. Slow-mo: Kettle Pop 0.3x (01) vs 0.25x (07); Bonk 300 ms at 0.4x vs 400 ms at 0.5x. Reduce shake: 01 halves and drops levels 0 and 1, 07 offers 100, 50, 0%. Haptics: 01 has a "Threaded!" double tick, 07 does not | Low | **07's values and settings** (07 owns feel). Keep 01's extra rules: the Threaded slow-mo and zoom, the Dud mock slow-mo once per battle, the Threaded double tick. Both keep the 1.5 s slow-mo cap per turn |
| C84 | F | art 12; 07 §2.4, §9.2 | Kettle art changes state at 70% and 40%. HUD gauge, whistle and music use 50% and 25% | Low | **50% and 25% everywhere.** One threshold per meaning |
| C85 | F | 01 §1.3, §2, §3.9, §4; 07 §9.3 | 01 gives every shot its own launch cue (8 Plain, 28 Knacks, 72 shells) and says the ear can tell what the Rival fired. 07 budgets 124 sound events with 12 launch sounds | Med | **07's 124 events are the base; each shot gets a short launch layer on top of its family sound.** About 110 more small files, about 0.4 MB, inside the 14 MB plan |
| C86 | F | 03 §6.5, §3; 07 §9.4 | 03: each Hob needs about 20 lines, its own snore loop and squeak pitch. 07: one voice set per Class (14 events), pitch-shifted per Hob; no new recordings per Hob | Med | **07 for recordings.** 03's per-Hob barks become subtitle lines (07 already writes subtitles fresh). Snore and squeak are pitch shifts |
| C87 | F | 00 §4.2; 07 §4.5, §12.3 | 00 lists pre-battle card, seat check and Doodad pick as steps. 07 folds them into one Level card | Low | **Accept 07.** Same content, fewer screens |
| C88 | F | 00 §5.2; 07 §8.4, §12.4, §12.5; 00 §2.3 | 07 pays the 40 Button loss payout when a player drops a resumed battle; sets keyboard steps at 1 degree and 5 power. 00 is silent | Low | **Accept both.** A crash never costs the player (00 §3) |

---

## 2. Cross-checks that passed

These were checked and agree across docs. They need no edit.

- **Trick Shell counts.** 72 shells: 23 Common, 30 Uncommon, 16 Rare, 3 Dud. Family counts in 01 §1.9 add up to 72. 53 from campaign and Shell Sets match 02 §6.1 (6 + 27 + 6 + 14).
- **Shell Set contents** match their families: RS-02 Ground and Lob, RS-04 Fluid and Frost, RS-07 Beam, Guided and Scout.
- **Tinker totals.** 77 nodes; max hold 160 by tier (12, 22, 29, 35, 32, 30) and by branch; core 100 by tier (10, 18, 16, 29, 27, 0) and by branch. Pennants 210 = 180 + 30.
- **Campaign Doodad schedule.** 01 (L6 two, L9, 2-9, 3-8, 4-8) matches 02 §4.4. Tinker Doodads DD-03, DD-04, DD-07, DD-08 match.
- **Mode unlocks.** Test Yard after level 2, Skirmish and Raid Rehearsal after level 3, Daily after 1-10, Long Siege after 3-10, Baron Rush after 6-10, Ironclad per region. 00, 02, 05 agree.
- **Training costs** 100 to 1,000 (4,100 total), Quirks at 3, 6, 9, +13.5% HP at level 10: 00, 02, 03 agree.
- **Hob HP.** All 28 named Hobs sit within 10 of their Class base and inside 80 to 140.
- **Damage maths in 01.** Pudding Bomb, Crumblecake, Grandfather Clod, Woodpecker, Cold Snap (122), Gravy Avalanche (60), Downhill Dairy (90), Pinball Pea (75) and every x1.5 Pierce-to-Hob figure check out against the 00 tables.
- **AI aim knobs.** 04 §6.13 matches 00 §8.1 (sigmas and bracketing x0.75, x0.5, x0.5, x0.4). 04 §7.2 win-rate bands match 05 §4.5.
- **Region names, wings, lieutenants, Grand Fort names and Keepsakes** match across 00, 04, 05 and art 14.
- **Material HP and cost** match across 00, 02 and the art cards 03 to 08.

---

## 3. Canonical facts sheet

The single agreed value for each key number and name after the rulings above. Numbers are tuning targets unless 00 marks them fixed.

### 3.1 World and battle

| Item | Value |
|---|---|
| Map | 2400 x 720 cells (Standard). Pocket 1200, Small 1600, Long 3200 wide |
| Fort centre gap | Duels 1000 to 1400. Long maps up to 1800. Pocket and Small teaching maps may go under 1000 |
| Zoom floor | 0.6 (whole 720 height fits) |
| Sim | 60 Hz tick, shells on 2 sub-steps (120 Hz). Deterministic support check decides collapse |
| Gravity, wind | 600 cells/s²; wind -10 to +10, 10 cells/s² per point |
| Power, angle | 0 to 100 on every screen; 0 to 180 degrees in tenths. Steam Shot: +10% launch speed |
| Weather Front | 3 rounds (levels may set 1). Forecast shows in the last round of a front; AS-03 shows it all front long plus one more front |
| Turn | One Action plus an optional Walk before it. One Action per side even with Outposts |
| Reload | Light 0, Medium 1, Heavy 2 |
| Round cap | 15 by default; levels 6 to 20 (6 only in 1-1); Grand Forts 1 to 5: 18 to 20; Last Level: 12 per Stage |
| Battle length | 3 to 6 min, never over 8 (each Last Level Stage counts alone) |
| Steam | 100 per battle (Bigger Boiler 130), 40 per turn; refills "to your cap" |
| Preview | 30%, Long Sight 45%, Eagle Sight 60%, Ironclad 30% fixed |

### 3.2 Castle

| Item | Value |
|---|---|
| Block | 16 x 16 cells |
| Grid | Start 6 x 6 (gift). Free step at 1-7 to hold 4 Nooks. Tinker steps to the 8 x 10 cap |
| Block cap | 80 grid cells including Footing; Block Budget 72 shown as x / 72 |
| Nooks | Never fewer than seated Hobs; cap 6. Enemy forts 1 to 6 |
| Kettle Room | 2 x 2, one block in from every outer face |
| Materials (HP, Buttons) | Wicker 30, 5. Timber 60, 15. Cobble 120, 40. Brassbound 180, 90. Moonbrick 240, 200. Footing 400, free |
| Heartkettle | 300 HP. Blast 50%, Pierce and Zap 100%, Fire, Dig and Frost 0. Never Brittle |
| Cover | 50% from area payloads of any type centred outside an intact Nook. Intact: every block on all four sides stands |
| Thump, fall, crush | Drop over 48: 10 to all. Fall over 32: 10 per 16, max 40. Crush 15 per block (Cobble x2, Wicker 0) |
| Status | Burn, Brittle, Chill, Soaked. Soaked: Zap x1.5, no stack with Brittle. Brittle Moonbrick does not heal. Fire ends Brittle. Burn jumps one block downwind at wind 5 or more |

### 3.3 Crew

| Item | Value |
|---|---|
| Hobs | 28 (4 each for Lobber, Zinger, Scatterjack, Boinker; 3 for the rest) |
| Join levels | Per 05 §6.4: Hetty 1-7, Dame Flicka 2-8, Rivet 5-6, Tansy 6-8, Nan on the T3 path or at 2-10 |
| Crew in battle | 1 to 3 by ownership through 1-6; 4 from 1-7; 5 with CT-05; 6 with CT-09 |
| Class HP | Lobber 120, Zinger 80, Scatterjack 100, Delver 140, Boinker 90, Sizzler 100, Patcher 110, Peeper 80. Named Hobs within 10 (bosses exempt) |
| Training | Levels 1 to 10, 4,100 Buttons total, +1.5% HP per level, Quirks at 3, 6, 9, Knack tiers at 4 and 8 |
| Knack | 2 uses; Light if little or no damage (5 Knacks), else Medium or Heavy per 01 |
| Turncoats | Outfits at launch |

### 3.4 Shots and draft

| Item | Value |
|---|---|
| Plain Shots | Clodpot 35, Hatpin 32 (48 to a Hob), Gravel Sneeze 3 x 14, Nibbler 34 Dig, Bouncebean 30 +5 per hop, Emberpot 15 Fire, Mendglob +50 HP, Peep Pip 5 |
| Knacks | 28 (one per Hob) plus 5 bench |
| Trick Shells | 72 (53 at launch core, 19 from side modes) |
| Doodads | 19 (6 campaign, 4 Tinker, 9 side content); 2 slots base |
| Flattener Twists | 9 (8 plus the Baron's Teatime), enemy-only |
| Rummage | Pool 10, 4 picks each; levels may set size and picks |
| Hard caps per shot | 60 to one kettle; 99 to one full-HP Hob; 120 Thwack |
| Blast bands | Point 0, Tiny 10, Small 18, Medium 28, Large 42, Huge 64 |

### 3.5 Economy

| Item | Value |
|---|---|
| Level first clear | 200 + 25 per Pennant |
| Grand Fort first clear | 500 + 25 per Pennant; Last Level 1,000 + 25 per Pennant |
| Replay | 80 + 10 per new Pennant (Grand Fort 150 + 10) |
| Loss | 40 (also on "Leave it" after a resume) |
| Trial first clear | 100 |
| Daily | 60 for the first clear each calendar day |
| Long Siege | 10 per wave, max 200 per run |
| Other | Ironclad level 100; Raid Rehearsal first time 50; Baron Rush Bronze 500 once; deny refund 10 |
| Pennants | 180 from levels + 30 from Trials = 210. Full tree 160, core 100 |
| Respec | Free, whole tree, branch or node with its children, any time outside battle |
| Full Moonbrick fort | About 8,000 Buttons |
| Time targets | Region 1 about 40 min; campaign about 7 h; all 210 Pennants 12 to 14 h |

### 3.6 Tinker Tree

Six branches: Aim and Sight, Castle and Masonry, Crew Training, Rummage and Shells, Steam and Stompers, Doodads. 77 nodes, 12 choice pairs. Tier N opens on entering Region N; Tier 1 after level 4.

### 3.7 UX and audio

| Item | Value |
|---|---|
| HUD top strip | Under 10% of height; maps keep the top 15% free of targets |
| Field share at rest | 70% or more on phones |
| Kettle warnings | 50% and 25% |
| Type colours and badges | 07 §6.3, with Fire moved off the Rival orange and Zap off Frost blue |
| Audio | 14 MB cap, 3 MB boot pack; 124 events plus per-shot launch layers; voice per Class |
| Cold Open load | Under 2 MB |
| Portrait | None at launch (pending owner) |

---

## 4. Open owner decisions

Only the owner should decide these. Each has a recommendation.

1. **Scope sign-off.** 28 Hobs, 72 shells, 19 Doodads, 60 levels, 10 Trials, 136 maps in all. Recommend yes, with the cut lines in 01 §7.7 and 05 §9.16.
2. **Audio size.** 14 MB with a 3 MB boot pack, or the 6 MB Lean plan. Recommend 14 MB.
3. **Turncoats.** Outfits only, or one Flattener Hob per Grand Fort after launch. Recommend Outfits now, Hobs as a later free update.
4. **Daily for trial players.** The Daily lends later Hobs, shells and maps to players who have not bought Full Kingdom. Recommend yes, as loans only (nothing unlocks), since every date must be the same for everyone.
5. **Side Rivals.** Six Doodads need optional Rival levels that 05 does not have yet (C34). Add six, or move those Doodads to other sources.
6. **Price and trial size.** $6.99 with Region 1 free, or premium only on iOS (00 §10.1.2).
7. **Web unlock.** Trial only, a store code, or a paid web storefront build (00 §10.1.3).
8. **Couch Duel.** Allow a free hotseat mode after launch (00 §6).
9. **Portrait.** 07 says no portrait anywhere at launch. Confirm.
10. **Rating ask.** One system prompt after the Region 1 Grand Fort win, never again (07 §12.4). Allow or not.
11. **Brag Clips.** Replay file only (offline) or video capture at launch (07 §12.5).
12. **Gamepad on phones.** Supported at launch, or "works, not promised" (07 §12.2).
13. **Names.** Trademark and store search for Brickabrac, Hob, all 28 Hob names, shell names and the renames in C45 to C49.
14. **Story cast.** Clan Knobble, Pedlar Tuppence and the Sleepy Hills are new in 05. Keep or cut.
15. **Age rating and save sync.** 9+ / Everyone 10+, and export codes only between web and phone (00 §10.1.4 and .7).
