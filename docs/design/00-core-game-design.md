# 00. Core Game Design

Status: revision 2, after the review pass. Date: 2026-11-22. Owner of this doc: lead game designer.

This doc sets the rules, names and numbers that every other design doc builds on. Specialist docs (weapons, tech tree, crew, enemies and bosses, campaign and levels, art, UX and audio) may add detail. They may not change a rule here without a note in `docs/review/`.

**How to read the cites.** `[02 §5.7]` means file `docs/research/02-reference-gameplay-teardown.md`, section 5, item 7. Files: `01` market, `02` teardown, `02b` Castle Clashers deep dive, `02c` Pocket Tanks family, `02d` App Store study, `03` code and tech survey, `04` tech stack. `[R04 B3]` means `docs/review/04-rulings.md` section B, item 3. `[audit C27]` means row C27 of `docs/review/01-consistency-audit.md`. `[D01]` to `[D07]` are the sibling design docs.

**Binding words.** Terms in **bold** in section 7 are canonical. Later docs use them as written.

**Numbers.** Every number in this doc is a tuning target unless it says "fixed". Bots and playtests set the final values [04 §14].

**Release tags.** Content carries one tag: `[Launch]`, `[U1]` (Long Siege), `[U2]` (Nithering Heights) or `[U3]` (Wheal Clank) [R04 A]. A rule with no tag applies from Launch. Ideas cut for good sit in the appendix "Parked ideas".

---

## Changes in this revision

1. Added the **Canonical numbers** table below. Other docs follow it.
2. Material HP is now Wicker 30, Timber 50, Cobble 80, Brassbound 110, Mossbrick 140. Mossbrick heals 7 a turn and not after a hit [R04 B1].
3. Stone side support drops from 2 blocks to 1, so tall stone forts are top heavy. Falling chunks now crush the Heartkettle too [R04 B2].
4. Crew cap is 5. Crew grows 1, 2, 3 in the tutorial, 4 at level 1-7, 5 at Grand Fort 2 as a free gift. Start grid 6 x 6; grid steps that seat the crew are free [R04 B3].
5. Heartkettle is 300 HP on every fort, bosses included [R04 B4].
6. **Sudden Squall** replaces the Last Bell tiebreak and the Final Volley [R04 B5].
7. Any Hob may fire any Trick Shell. The **Match** Class fires it with no Rest and +10%. Grey cards, deny refunds and families are gone [R04 B6].
8. Seat words, perks, Scamper, Scurry, Crowded, Perched and Porch are cut. Hob states are Open, Fell a floor, Tumbled, Squashed, Bonked [R04 B7].
9. Hob growth is 3 Ranks, each a Quirk pick. No HP per level, no Knack tiers [R04 B8].
10. No lost turns: Tumble never skips a shot, extra Rest caps at 1, a buried Loophole greys the Fire button, Puff Up is player side only [R04 B9].
11. Enemy crew stays shown after the Muster. Hidden crew and the Lookout wait for U2 [R04 B10].
12. Pins fade after one reuse; the AI walks out of a bracket after two hits from one aim [R04 B11].
13. Tinker Tree has 4 branches (Aim, Fort, Crew, Kit), 36 nodes at launch, 60 in all. Forecast, Rival ghost lines, shot log and drift readout are free [R04 B13].
14. New onboarding: levels 1-5 teach only aim, Hob pick, kettle, one Knack and wind. Workshop at 1-6, Rummage at 1-8, Tinker Tree at 1-10. 11 prompts in the first 10 minutes [R04 B14].
15. One pre-battle screen with "Same again" on replays [R04 B15].
16. Merges: Reload and Chill are now **Rest**; ground effects are **patches**; Puzzle, Escort and the Test Yard raid button replace six old names; no rarity [R04 B16].
17. "What broke you" replay after each loss; each Rival states one habit [R04 B17].
18. Daily Dust-up is a seeded Skirmish on existing maps [R04 B18].
19. Launch scope: 4 regions (Downs, Crag, Fen, Flats), 40 levels, 4 Grand Forts, 7 Classes, 16 Hobs, 30 Trick Shells, 8 Doodads, 4 damage types [R04 A].
20. Tech: one 120 Hz sim clock, deterministic support check, AI think 400 ms, duel gap 1000 to 1400 [R04 C].
21. Pacing maths redone with the new numbers (section 9.6).
22. Audit rulings applied: Cover wording (C09, C10), shot caps (C27, C28), Point blast band (C40), foreign blocks (C15), Burn downwind (C23), Brittle rules (C24, C25), grid and Block Budget (C04, C65), level caps (C70, C71), economy lines (C59 to C64).
23. Final verification pass [review 05]: the Sudden Squall now hits both sides at once at round end, and a double pop goes to the side with more total HP. The full-HP clamp is now "no single shot Bonks a Hob from full HP" (clamped to its HP minus 1). The per-shot Thwack cap is 110, as the weapons doc sets it. A Beam through a block deals half to the kettle. Duds are always labeled. If every Hob is dug in, the newest burial clears. Level 1-1 has a cap of 8 and no Squall. Onboarding order follows the campaign and UX docs (wind at 1-4, the Knack at 1-5). Launch maps (59) and enemy unit types (14) added to the scope table.
24. **Owner decisions applied** [R04 D]. The game is free with no monetization: no price, no trial, no unlock, no in-app purchases, no ads. Couch Duel (two players on one device) ships at launch (section 6.1). Portrait and landscape both ship at launch; the UX and art docs own the layouts. Final art is by human artists. A Sudden Squall double pop goes to more total HP. Gentle wind from 1-4 with a Wind off assist. The first Doodad comes at 1-9.
25. **Lessons from the reference games applied** [review 06, sections A and B]. Items 26 to 36 list them.
26. **Couch Duel house rules** (G2, section 6.1): everything is open, Molehill included; player-only rules such as Puff Up apply to both sides; a **Hand-off card** between turns shows the last shot and a Ready button; an optional **Kind Clock**, off by default, nudges but never fires; a **Starter Box** of even loaner forts plays from first launch; handicaps show openly; **Table mode** in portrait. The Couch Duel Rummage rule is now one rule, the same as `01 §1.9`.
27. **Pacing redone at real speed** (G3, sections 2.12 and 9.6). A round is about 32 s (two shots), not 16 to 20. The vertical slice gates on median seconds per round. Round cap 12 is the fallback if fights run long.
28. **"Squall in 3" warning** (G4, section 2.11): two rounds before the cap a banner and the round counter count down.
29. **Teach "aim low"** (G5): **Lean Lines** (hold a block to see what would fall), a shimmer on blocks that hang on weak support, and a **"Drop!"** callout on the first big collapse. All free aim data (sections 2.4, 2.10).
30. **Loophole Flap** (G6, section 2.10): after a Thread passes a Loophole, that Loophole is closed to Threads until the Weather Front changes. It replaces the hidden "one Thread per battle on Fair" AI rule.
31. **Shove Off** (G7, section 2.7): a dug-in Hob digs out for 15 Steam in the Walk step, not your Action.
32. **Loose Trick Shells in 1-3 and 1-4** (G8, section 8.3), a **Rival wish** in the Rummage (G9, section 2.15), a **"No line" mark** on the pre-battle screen (G10, section 4.2), and a **Volley Points** option in Skirmish and Couch Duel (G11, section 6.2).
33. **Portrait battle view** (G1, section 2.1): stacked lenses. The UX doc owns the layout.
34. **"Next door"** joins the glossary for the new positional Passives in `03` (Grub, Hetty, Old Thumper, Nan). Ginger's Knack is now **Rising Fizz** [01]. Dollop mends +50 everywhere (U11).
35. **Enemy roster swap** (U10): the Shoring Crew ships at launch and the Silt Lobber moves to U1. Launch enemy types stay 14; U1 is now +4 and U3 +4.
36. **Native tech plan** [research 04b]: one shared Rust core (sim, AI, content, saves, Daily, bots) in integer Q16.16 fixed point with no floats in rules; native iOS (Swift, SwiftUI, Metal) and Android (Kotlin, Compose, OpenGL ES 3.0) apps and a web app (TypeScript, WebGL2, core as Wasm, offline PWA). Team, effort and launch weeks updated in **Tech and team**.
37. **Kettle and Creaks rebalance, rules v5** (bundle patch 02, verified in core): Heartkettle 200 HP (was 300), per-shot kettle cap 80 (was 60), kettle takes Blast at 75% and crush at 100% (was 50% each), no Beam-through-wall penalty, a **kettle crack** at half HP weakens the Kettle Room walls, **the progressive Creaks** (called Fatigue until the naming pass; round 10 under 50% HP, round 12 under 80%), and Tumbled fall damage 45 + (fall - 64) / 8, max 70 (was 20). Saves from rules v4 do not resume.

---

## Canonical numbers

The single source for these values. Where another doc differs, this table wins until a review note changes it.

### Scope by release [R04 A]

| | Launch | U1 Long Siege | U2 Nithering Heights | U3 Wheal Clank | Total |
|---|---|---|---|---|---|
| Regions | 4: Puddingstone Downs, Crag End, Soggy Bottom Fen, The Flats | | +1 | +1 | 6 |
| Campaign levels | 40 (4 Grand Forts) | | +10 | +10 | 60 |
| Trials | 6 | +2 | +1 | +1 | 10 |
| Classes | 7 (no Lookout) | | +Lookout | | 8 |
| Hobs | 16 | +2 | +5 | +5 | 28 |
| Trick Shells | 30 (2 Duds) | +8 | +10 | +10 | 58 |
| Doodads | 8 | +2 | +2 | +2 | 14 |
| Materials | Wicker, Timber, Cobble, Brassbound + Footing | | | +Mossbrick | 5 + Footing |
| Damage types | Blast, Pierce, Dig, Fire | | +Frost | +Zap | 6 |
| Statuses | Burn, Soaked | | +Brittle | | 3, plus Rest |
| Tinker nodes | 36 | | +12 | +12 | 60 |
| Mission types | Siege, Demolition, Rescue, Puzzle, Grand Fort | Waves (in Long Siege) | +Escort | +King of the Hill | 8 |
| Modes | Campaign, Skirmish, Couch Duel, Test Yard, Trials, Daily Dust-up | +Long Siege | +Ironclad | +Baron Rush | 9 |
| Pennants | 138 (120 levels, 18 Trials) | +6 | +33 | +33 | 210 |
| Maps | 59 (41 campaign, 6 Trial, 12 shared) | +14 | +11 | +11 | 95 |
| Enemy unit types | 14 (13 that fire, plus the Dummy) | +4 | +6 | +4 | 28 |
| Grand Forts | 4 (the fourth is the Last Level) | | +1 | +1 | 6 |

### Battle

| Item | Value |
|---|---|
| Map | 2400 x 720 cells (Standard). Pocket 1200, Small 1600, Long 3200 wide |
| Fort gap (inner face) | Duels 1000 to 1400 (pad centre gap up to 1500). Long maps up to 1800. Pocket and Small maps may go under 1000 for Puzzle and teaching levels only |
| Camera zoom | 0.6 floor, 1.25 max |
| Sim clock | One clock, 120 Hz. Rendering at display rate. Deterministic: integer Q16.16 fixed point, no floats in rules [04b] |
| Gravity, wind | 600 cells/s². Wind -10 to +10, 10 cells/s² per point |
| Power, angle | 0 to 100 on every screen. 0 to 180 degrees in tenths. Steam Shot adds +10% launch speed, not power |
| Weather Front | 3 rounds (levels may set 1). Forecast free: shows the next front all front long |
| Turn | One Action plus an optional Walk before it. One Action per side even with Outposts |
| Rest | Light 0, Medium 1, Heavy 2. Extra Rest from any effect caps at 1. Match Class: Rest 0 on that shell |
| Round cap | 15 by default. Levels 8 to 20 (8 only in 1-1, which has no Squall). Other Grand Forts: 18 to 20. Last Level: 12 per Stage. **Fallback:** if the slice gate fails (9.6), the default drops to 12 and Grand Fort caps drop by 3 |
| Sudden Squall | Starts after the cap. Squall rounds 1, 2, 3: wind moves 3 further from 0 at the round start; at the round end both sides are hit at once: each kettle loses 50, 100, 150 and each block loses 10, 20, 30. If both kettles pop at once, the side with more total HP left wins. Any fight ends by the end of the third Squall round |
| Round time | About 32 s (two shots): player turn about 20 s, Rival turn about 12 s. The slice gates on median seconds per round |
| Typical battle end | Round 8 to 12 |
| Battle length | 4 to 7 min; over 8 in under 10% of battles (each Last Level Stage counts alone; Grand Forts see 9.6) |
| Squall warning | "Squall in 3" at the start of the round two before the cap, then 2, then 1 |
| Steam | 100 per battle (Bigger Boiler 130), 40 per turn. "Refill" means refill to your cap. **Shove Off** (dig out one buried Loophole) costs 15 in the Walk step |
| Preview | 30%, Long Sight 45%, Eagle Sight 60%. Ironclad [U2] 30% fixed |
| Recall | A pin restores one aim once, then fades |
| Loophole Flap | After a Thread passes a Loophole, that Loophole takes no Threads until the Weather Front changes. Both sides |
| AI think | 400 ms p95 on the 2 GB phone, all presets, hidden by a 0.8 to 1.5 s think pose |

### Castle

| Item | Value |
|---|---|
| Block | 16 x 16 cells |
| Grid | Start 6 x 6 (gift). Free step at 1-7 to seat 4. Free step at Grand Fort 2 to seat 5. Fort nodes grow it to the 8 x 10 cap |
| Block cap | 80 grid cells including Footing. Block Budget 72, shown as x / 72 |
| Nooks | Never fewer than seated Hobs. Cap 5. Enemy forts 1 to 5 |
| Kettle Room | 2 x 2, at least one block in from every outer face |
| Materials (HP, Buttons, side support) | Wicker 30, 5, 2. Timber 50, 15, 1 (was 2, tuned for pacing in core v0.2). Cobble 80, 35, 1. Brassbound 110, 70, 2. Mossbrick [U3] 140, 150, 1. Footing 400, free, never falls |
| Mossbrick heal [U3] | 7 HP at its owner's turn start; none if it was hit since its owner's last turn, if Brittle, or with a Cuckoo Clock on it |
| Heartkettle | 200 HP on every fort, bosses included (was 300, rules v5). Blast 75%, crush 100%, Pierce 100%, Zap 100% [U3]. Fire, Dig, Frost 0. A Beam that has passed through a block deals full damage to it (no wall penalty since rules v5). Never Brittle |
| Kettle crack | At or under half HP (100) the kettle cracks once (`kettle_crack` event). From then on each block of the Kettle Room walls reaches one less to the side, so a hurt kettle room tends to cave in |
| Cover | 35% off (65% taken) on area payloads (was 50%, tuned for pacing in core v0.2; value lives in `content/materials.json` as `cover_pct`) (Tiny band or larger, any type) centred outside an intact Nook. Intact: every block on all four sides stands |
| Pacing tune (core v0.2) | Timber, Cobble and Hob crush raised. Measured on 96 Fair vs Fair bot battles: median end round 10, 63% end on rounds 7 to 11, 12.5% go past the round cap. Rerun with `cargo run -p castle-core --example pacing` |
| Self damage | Your own blasts hurt your own blocks and Hobs at 50%. A self hit never Bonks your own Hob (stops at 1 HP) |
| Thump, fall, crush | Drop over 48: 10 to every block and Hob. Fell a floor, a fall over 32: 10 per 16, max 40. Tumbled (out of the fort, a fall over 64 that lands in no free Nook): 45 + (fall - 64) / 8, max 70. Crush 15 per block (Cobble x2, Wicker 0) |
| The Creaks | Progressive, from round 10 (not in Volley Points or the Test Yard). Round 10: blocks under 50% HP reach one less to the side. Round 12: blocks under 80% HP. Blocks that no longer stand fall at the round start; that fall and its crush stop at 1 HP, so the Creaks alone never pop a kettle or Bonks a Hob. "Creaks next round" warning in round 9 |

### Crew and shots

| Item | Value |
|---|---|
| Crew in battle | 1 (1-1), 2 (1-2, 1-3), 3 (1-4 to 1-6), 4 (from 1-7), 5 (from Grand Fort 2 clear). Cap 5 |
| Class HP | Lobber 120, Zinger 80, Scatterjack 100, Digger 140, Bouncer 90, Stoker 100, Patcher 110, Lookout 80 [U2]. Named Hobs within 10 (bosses exempt) |
| Hob Ranks | 0 to 3. Rank costs 300, 700, 1,500 Buttons (2,500 in all). Each Rank is a Quirk pick of 2. No HP growth |
| Knack | 2 uses per battle |
| Hand | Plain Shot, Knack, 4 Trick Shells from the Rummage, 2 Doodads |
| Rummage | Pool 10, 4 picks each, alternate. Levels may set pool size and picks |
| Match bonus | The shell's Match Class fires it with Rest 0 and +10% |
| Hard caps per shot | 80 to one kettle (falls it causes included). No single shot Bonks a Hob from full HP: the sim clamps that shot's damage to the Hob at its HP minus 1. 110 Thwack |
| Blast bands | Point 0, Tiny 10, Small 18, Medium 28, Large 42, Huge 64 |
| Plain Shots | Clodpot 35, Hatpin 32 (48 to a Hob), Gravel Sneeze 3 x 14, Nibbler 34 Dig, Jumping Bean 30 +5 per hop, Hot Coal 15 Fire, Dollop +50 HP (every doc), Chalk Dart 12 [U2] |
| Next door | The Nooks touching a Hob's Nook left, right, above and below (sharing a wall, no room between). Used by four launch Passives [D03] |

### Economy and progress

| Item | Value |
|---|---|
| Level first clear | 200 + 25 per Pennant |
| Grand Fort first clear | 500 + 25 per Pennant. Last Level 1,000 + 25 per Pennant |
| Replay win | 80 + 10 per new Pennant (Grand Fort 150 + 10) |
| Loss | 40 (also on "Leave it" after a resume) |
| Trial first clear | 100 |
| Daily Dust-up | 60 for the first clear each calendar day |
| Other | Long Siege [U1] 10 per wave, max 200 per run. Ironclad [U2] 100 per level. Baron Rush [U3] Bronze 500 once. Test Yard raid first win 50 once |
| Tinker Tree | 4 branches, 15 nodes each, one fork each. Hold cost: launch 100, full 172. Core: launch 56, full 72 |
| Tinker tiers | Beat Grand Fort N, open Tier N. Tiers 1 to 3 at launch, Tier 4 [U2], Tier 5 [U3] |
| Respec | Free, any time outside battle: a node with its children, a branch or the whole tree |
| Time targets | Region 1 about 40 min. Launch campaign about 5 h. All 60 levels about 7 to 8 h. All 210 Pennants 12 to 14 h |

### Tech and team [R04 C]

| Item | Value |
|---|---|
| Platforms | Native iOS app (iPhone and iPad: Swift, SwiftUI, Metal). Native Android app (Kotlin, Compose, OpenGL ES 3.0). Web app (TypeScript, WebGL2, the core as Wasm, installable offline PWA) [04b] |
| Shared core | One Rust core for the sim, AI, content, saves and export codes, Daily seed and bots. Integer Q16.16 fixed point, no floats in rules, so all three platforms give the same bits [04b] |
| Collapse | Deterministic custom support check in the sim. The look comes from the view. Week 4 prototype compares it with a cheap tumbling model; playtests may change the support rule but not determinism |
| AI think | 400 ms p95 on the 2 GB phone, all presets (unchanged) |
| Bots | About 80 matches per minute per CI core |
| Effort | About 200 engineer weeks for launch scope [04b] |
| Team | 6 to 7 engineers (3 core, 1 iOS, 1 Android, 1 web, half a build and release engineer), 1 artist plus contract animator, 1 designer, 1 level designer, part time audio |
| Launch target | Weeks 48 to 54 from start, on all three platforms at once |
| Audio | 14 MB full plan, 2.8 MB boot pack (owner to confirm) |

---

## 1. Vision

### 1.1 Vision in three sentences

Castle Protect is a turn-based artillery duel where your crew lives inside a walking castle you built yourself, and every shot breaks wood, stone and ground in a way you can read and plan. You win by bonking the whole enemy crew or by popping the steam kettle at the heart of their castle, and you lose bricks, floors and friends along the way in big, bloodless slapstick. It is free with no monetization at all, fully offline, with a hand-made campaign, a real tech tree, a two-player mode on one device, and no timers, ads or paid power.

### 1.2 Five design pillars

1. **Every shot changes the picture.** Each hit leaves a crater, a fallen wall, a dropped Hob or a new mound. No shot is a silent number [02 §5.19, 02 §5.20, 02c §5.6].
2. **Read it, then nail it.** Aim is learnable. Wind, preview, ghost of the last shot and clear weapon cards give the player the data, for free. Misses teach the fix [02 §5.10, 02 §5.11, 02c §5.9].
3. **Two ways to win, every turn.** Hunt the crew or crack the core. The best shot shifts as walls open [02 §2.9, 02b §15.2, 02d §1.6.5].
4. **Your castle, your plan.** You design the fort, seat the crew and draft the shells. Losing hurts because you built it; winning feels earned [02 §5.22, 02b §16.14, 01 gaps 4].
5. **Fair and kind.** Honest AI that misses like a person, no timers, no energy, no ads, no paid power, no lost turns, never lose what you earned, crash never costs a match [01 §1, 02d §1.6.1, 02d §1.6.8, 02c §5.20].

### 1.3 Target players

Genre fans first, casual phone players second [R04 D8]. The simple rules in this revision serve both. From `01` "Player types" and `02c §4.5`, in priority order:

| # | Group | What they need from us |
|---|---|---|
| 1 | Nostalgic artillery fans, 25 to 45 | Angle and power with numbers, deep weapon list, draft, fair AI, free with nothing to buy |
| 2 | Physics puzzle players | 3 Pennant ratings, one perfect shot, collapses |
| 3 | Casual phone players tired of ads | Offline, 5 minute matches, pause anywhere, no nag, few rules |
| 4 | Builders and tinkerers | Free fort editor, blueprints, test range |
| 5 | Collectors | Almanac of every shell and Hob, Curio Shelf, clear finish line |
| 6 | Parents and kids 9+ | Bloodless slapstick, no chat, no ads, no data collected [02d §3] |

### 1.4 Tone

- **Bloodless slapstick.** Hits make stars, soot, popped buttons and squeaks. A Hob at 0 HP is **Bonked**: eyes spin, a **Snooze Balloon** pops out of its hat and floats it off the field. No blood, no bodies, no gore jokes [01 §8 Bowmasters avoid, 01 gaps 7].
- **Family friendly.** Target age rating 9+ (Everyone 10+). No real weapons by name, no guns that look real. Shells are pots, stones, springs, kettles and contraptions [02c §3.6 tone notes, 02c §5.19].
- **Warm and cheeky.** Rivals taunt and groan between turns with short lines and comic voices [02c §5.13, 03 §3 AtlantaTeam taunts].
- **Original world.** No names, characters, art or music from any game we studied [BRIEF].

### 1.5 Setting: three options and the pick

| | A. Brickabrac (picked) | B. The Sugarcrust Realms | C. Skyreef Archipelago |
|---|---|---|---|
| Pitch | A lumpy, patchwork land where small stubborn clans of Hobs each claim a hill and build walking forts out of whatever they can stack: wicker, planks, cobbles, brass and rare moonbrick. Every fort has a steam kettle for a heart and stubby clockwork legs | Dessert kingdoms at war over the last good oven. Gingerbread forts, frosting mortar, candy shells | Floating sky islands. Kite-rigged castles drift on the wind and duel across the clouds |
| Why it fits | Homemade forts justify any block, any material ladder, any silly shell. Lumpy land makes terrain central. The kettle core and steam legs give our core, fuel and movement one source. Medieval-ish but not grim [02c §5.18] | Very strong kid appeal, bright art | Wind becomes the star, height everywhere |
| Risk | Must avoid generic fantasy look; art doc owns a clear style | Narrows appeal for 25 to 45 fans; materials read as food, not armor; sugar art ages fast | Falling off islands reads as death; void under the map fights destructible ground; walking castles make no sense in the sky |

**Pick: A. Brickabrac.**

**The hook.** The villain clan, the **Flatteners** under **Baron Levelwell**, want to stamp every hill in Brickabrac flat, because flat land is tidy. Their machines roll the world smooth. The player's clan fights to keep Brickabrac lumpy. This turns one of the genre's known faults, flat boring maps [02b §15, 02d §1.4 "Flat terrain"], into the story: every region we win back gets its hills back. The campaign is called **The Unflattening**.

**Launch story shape.** The launch game runs Downs, Crag, Fen, then The Flats, so the Baron falls and the story ends at launch. In U2 and U3 two lieutenants who fled, the wings that got away, regroup in Nithering Heights and Wheal Clank [R04 A]. The campaign doc owns the story beats.

**The people.** **Hobs** are small, round, stubborn folk in patched coats and too-big hats. Each Hob has a trade (its **Class**) and a signature shot. Hobs are tough, vain and easily startled.

**The forts.** Every castle stands on **Stompers** (clockwork legs) and runs on a **Heartkettle**, the big steam kettle in a protected room. Steam from the kettle drives the legs. Pop the kettle and the whole fort fizzles and sits down.

---

## 2. The core battle

### 2.1 The field

- Side view. Portrait and landscape both work at launch; the UX doc owns both layouts [R04 D4]. Your castle on the left, the rival's on the right. Sides stay fixed.
- **Portrait battle view: stacked lenses** [review 06 G1]. Top lens: the target fort, close. Middle: a thin **Field Strip** map of both forts with the last Pins. Bottom: your own fort and the HUD. The camera follows the shell in flight and holds on impact. Rotate the device any time with no state lost. The sim does not change; only the view does. A one-frame portrait view would draw a block at about 3 pt, which no one can read.
- Map size: 2400 x 720 sim cells by default, 1 cell = 1 logical pixel at the 960 x 540 logical screen [04 §7, 04 §9, 04 §10]. Pocket 1200, Small 1600 and Long 3200 cells wide. Camera pans and zooms from 0.6 to 1.25.
- **Fort gap.** Duel castles start 1000 to 1400 cells apart, so both forts fit one frame at the 0.6 zoom floor. Long maps may go to 1800; there the camera travels. Pocket and Small maps may go under 1000 for Puzzle and teaching levels only [R04 C4, audit C67, C68].
- Terrain is a destructible material grid [03 §5.4, 04 §7]. Ground materials (fixed list):

| Ground | Behavior |
|---|---|
| Loam | Default dirt. Carves easily, loose, settles after blasts [03 §6] |
| Clay | Carves at half rate, does not settle (holds overhangs and tunnels) |
| Rock | Carves only from Heavy and Massive blasts and Dig, never settles |
| Bedrock | Never carves. Map floor and some set pieces [03 §5.1] |
| Mud | Loam that is wet. Slows walking (x3 Steam), stops rollers |
| Water | Not solid. Shells pass with drag, fire goes out, rollers sink. Castles cannot walk into deep water |
| Ice | Solid, slippery. Rollers and skippers speed up. Breaks into water under Fire. Appears from [U2] |

### 2.2 Turn model (decided)

**Strict alternating turns. One Action per turn, plus an optional Walk before it.**

A **Turn** has five steps:

1. **Start.** Banner, colour shift and a sound say whose turn it is [02 §5.6]. Camera frames the active castle with a bias toward the rival. Wind arrow updates if a new Weather Front began. In a Sudden Squall, the wind steps up at the start of each Squall round (2.11).
2. **Plan.** Pick a Hob (tap its portrait or tap it in your see-through castle [02d §1.6.6]). Pick its shot: its **Plain Shot**, its **Knack**, or any drafted **Trick Shell**. Or pick a **Doodad**. Optionally **Walk** the castle (spends Steam). Aim.
3. **Fire.** Press the Fire button. The shot launches from the Hob's **Loophole**.
4. **Resolve.** Flight, impact, collapse, settle. Hard cap 3 s of settle after the last impact, then the sim forces rest [03 §10.3]. Tap to play the resolve at 2x. After Region 1, 2x is on by default for Rival turns.
5. **End.** Autosave. Control passes. After the second side's turn in a Squall round, the Squall hits both forts at once (2.11).

A **Round** is one turn by each side. The HUD always shows `Round 6/15` [02c §5.2].

**Why one action.** One action keeps the exchange fast [02 §5.1], keeps every choice weighty, and matches both references [02b §5]. Support moves (repair, shield) cost the action, which was the best choice in Tank Duel [02 §5.18, 02c §5.8].

**Tempo cost for big shots: Rest.** We take the GunBound idea that big shots cost tempo [01 §4] in a simple, readable form. Each shot has a **Weight**. After a Medium or Heavy shot the Hob **needs a rest**:

| Weight | Examples | Rest |
|---|---|---|
| Light | Plain Shots, scouting shells | 0. The Hob may fire again next turn |
| Medium | Most Knacks and Trick Shells | 1. The Hob sits out its castle's next turn |
| Heavy | Big blasts, long effects | 2. The Hob sits out its castle's next two turns |

A resting Hob shows a little spinning cog with a number. This forces you to rotate crew and spreads the fun across the whole roster [02 §5.14]. The AI obeys the same rule.

**Rest is one idea.** Effects that slow a Hob (Frost [U2], a few Knacks and shells) add Rest to the same cog. **Extra Rest from all sources caps at 1 turn** on top of the shot's own Rest [R04 B9, B16]. A Trick Shell fired by its **Match** Class has Rest 0 (2.15).

**No lost turns (fixed).** No rule takes away a whole turn from a side. Tumble never skips a shot. A buried Loophole greys that Hob's Fire button, so you pick another Hob or **Shove Off** for 15 Steam in your Walk step and fire that Hob after all (2.7). Some Hob can always act or a Doodad can be used. If every live Hob is dug in at its side's turn start, the newest burial clears by itself [D01]. If every Hob is resting, the side may still Walk and use a Doodad or a Plain Shot from the Hob with the lowest Rest count [R04 B9].

**Who goes first.** Campaign: the player, unless a level says otherwise. Skirmish: coin flip. To offset first-mover edge [02c §4.1 Tank Stars "whoever starts first"]: the first side cannot fire a Heavy shot on its first turn, and the second side gets +20 Steam and the first pick in the Rummage. The Sudden Squall hits both sides at once, so turn order does not decide who pops first (2.11).

**No retreat after firing.** You cannot walk after you fire. Walk first, then commit.

### 2.3 Aim controls

Three inputs at the core: angle, power, fire [02c §5.1]. Numbers always visible: angle in degrees to one decimal, power 0 to 100 [02d §2.3, screen: appstore/pocket-tanks/iphone-5.jpg].

**Touch (default)**

- **Aim Drag.** Put a finger on your own fort (or within about two blocks of it, or on the picked Hob) and drag; a press anywhere else pans the camera (owner rule after playtest). Default is pull-back (drag away from the target, like a sling). A setting flips it to point mode. Drag direction sets angle; drag length sets power. Full power is a drag of 40% of screen height, whatever the zoom, so the gesture feels the same zoomed in or out.
- **Release does not fire.** Lifting the finger only sets the aim. This kills the "slipped finger shot into the ground" complaint [02 §2.3, 02 §2.10, 02c §5.10].
- **Fine Tune.** After a drag, a small pad shows next to the readouts: angle -/+ (0.1 per tap, hold to repeat with ramp), power -/+ (1 per tap). Or drag on the readout strip itself at 1/5 gain [02 §5.8, 02d §1.4 "dial for angle and power"].
- **Fire button.** Large (at least 72 x 72 pt), bottom right by default, away from the drag zone. Movable in settings; mirrors for left-hand mode [02 §5.12, 02 §6.17]. Greyed when the picked Hob cannot fire (resting or a buried Loophole).
- **Pinch** to zoom, two-finger drag to look around. Camera snaps back on fire [03 §12].

**Mouse**

- Click-drag on the field works like touch.
- **Point mode** (optional): the barrel follows the cursor for angle, wheel sets power. The nicest mouse input we saw [02 §3.3].
- Click Fire, or press Space.

**Keyboard**

- Left/Right: angle, 1 degree a step. Up/Down: power, 5 a step. Hold Shift for fine steps (0.1 and 1) [audit C88]. A/D: walk. Tab: next Hob. 1 to 9: pick a shot. Q: Doodads. Space or Enter: fire. R: recall last aim.
- Every control shows its key on the HUD on desktop [02c §4.2].

**Quick Fire** is an opt-in setting for experts: release fires. Off by default.

**Last aim is kept** per Hob between turns [02 §5.9].

### 2.4 Trajectory preview and free aim data

1. The preview runs the real sim from the Loophole with real gravity and real wind, and draws fading dots [03 §9].
2. Default length: the first **30%** of the arc's path length. Tinker nodes extend it to **45%** (Long Sight) and **60%** (Eagle Sight). It never shows the full arc in battle except with the Cosy assist "Training Arc" and in the Test Yard [03 §9, 02b §17.7]. Ironclad [U2] holds it at 30%.
3. For shells that split, roll or turn, the preview stops at the first trigger point. One exception: **Rising Fizz** splits at its apex into bubbles on one fixed path, so its preview runs on through the split, up to the preview length [D01].
4. Beams (no gravity) show a straight line up to the first solid thing, since the line is plain to see anyway.
5. The preview never reveals what the player cannot see.
6. Preview updates on input change only [03 §9].

**Free aim data (fixed).** These are pillar 2 and are never sold in the Tinker Tree [R04 B13]:

- **Ghost and pins.** The last two shots fired by the selected Hob stay as faint lines in its colour, with an impact **Pin** at each landing spot [02 §5.10, 02c §4.1 Tank Stars, 02c §5.9].
- **Rival ghost lines.** The Rival's last two shots leave full ghost lines, not just pins. Tap one to see its angle and power.
- **Shot log.** A strip lists your last 6 shots from any Hob with the wind each was fired in.
- **Drift readout.** The preview tip shows how many blocks wind will move the shell by its first impact.
- **Forecast.** See 2.5.
- **Lean Lines** [review 06 G5]. Press and hold any block on either fort. The blocks that would fall if it broke show a dashed outline. It runs the same support check as the sim, so it never lies, and it shows no damage and no arc. Works in every mode and preset.
- **Shimmer.** While you aim, blocks on the rival fort that hang at the end of their side support reach (one more lost support and they fall) shimmer softly. Reduce motion turns the shimmer into a static hatch.
- **Loophole Flap marks.** A closed Loophole shows a flap and the rounds left in the front (2.10).

**Recall and the anti-lock rule.** Tap a pin or a shot log entry to **Recall** that exact angle and power. A Recall can be used once; the pin then fades, so the next shot from it needs a fresh aim [R04 B11]. The AI has its own version: after it has hit the same target twice from one aim, it Walks or changes target before firing that aim again [04 owns the details].

**Impact marker.** Every shot leaves a small **Pin** where it first hit, for the rest of the round [02 §3.1 lesson 1]. "Pin" means only this marker; the zero-radius blast band is "Point" [audit C40].

### 2.5 Wind

- Wind is an integer from -10 to +10, shown as an arrow with a number and a moving streak of leaves on screen. Colour-blind safe: arrow shape and number carry it, not colour [01 "best ever" 14].
- Wind is a constant horizontal push on shells for the whole turn [03 §7.1]. Each shell has a wind factor (heavy stones 0.6, feathers and balloons 1.5, beams 0).
- **Weather Fronts.** Wind holds for 3 rounds, then changes. The **forecast** icon shows the next front's wind for the whole current front, for free. The Weathercock Doodad shows two fronts ahead. A miss then teaches the fix [02 §3.1 wind, 02 §5.11, audit C54].
- **Wind is a chore only if it is always on.** `02c §3.3` and `02c §6.39` warn that Pocket Tanks cut wind on purpose and fans still loved it; `02 §3.1` shows strong wind made blind aim slow. So: levels 1-1 to 1-3 have no wind; 1-4 teaches it. Most later levels range 0 to 6. Strong wind (7 to 10) is a level feature (storm levels, the Flats bellows, Nithering Heights [U2]). Cosy can turn wind off. Some shells and Doodads make gusts (the weapons doc owns them).

### 2.6 Terrain rules

- Blasts carve the grid. Loose ground settles at once in the sim and animates over 300 to 500 ms [03 §6].
- Some shells add ground (mounds, walls, ramps) [02c §5.6, 02c §5.7].
- **Patches.** Shots may leave a **patch** on the ground or a block: embers, oil, sticky goo, ice, smoke and other zones. Every patch shows one icon and a turn count, and does one plain thing (the weapons doc lists them) [R04 B16]. At most 3 patches per side at once [D01].
- **Lump Rule (fixed).** No campaign map is flat. Every map has at least two of: a hill or ridge between castles, a height gap of at least 80 cells between castle bases, water or a pit, a cave or overhang, a cliff. The level doc checks each map against this list [02b §15, 02d §1.6.3].
- **Phone view rule.** Terrain between castles never rises so high that the auto-frame zoom drops below 0.6 [02c §3.3 "hills too tall on phones", 02c §5.11]. Maps keep the top 15% of the screen free of targets as a margin under the HUD strip [audit C69].

### 2.7 Castle structure

**Grid.** A castle is a grid of **Blocks**, each 16 x 16 cells. The start grid is 6 x 6, a gift. Grid steps that seat the campaign crew are free gifts too: one at level 1-7 (4 Nooks) and one at Grand Fort 2 (5 Nooks). The Workshop validator proves each gift grid holds the Kettle Room plus that many walled Nooks. Fort nodes in the Tinker Tree grow it to the cap of 8 wide by 10 tall [R04 B3, audit C04]. The cap is 80 grid cells including Footing, so the **Block Budget** is 72 and the Workshop shows `x / 72` [audit C65]. This keeps us inside the 250-piece scene budget [03 §10.3].

**Layers, bottom to top.**

1. **Stompers.** The clockwork legs under the castle. Not blocks; not targetable. They let the castle walk and they rest on the ground.
2. **Footing.** The bottom row. Always present, full width. Special material (see 2.8). Counters the "bore the base" plan.
3. **Body.** Blocks of any material, plus rooms.
4. **Roofs and caps.** Light blocks on top. Cosmetic shapes are free.

**Rooms at launch.**

- **Nook.** A 2 x 2 hollow where one Hob stands. Each Nook has a **Loophole** on the side that faces the rival. A castle has as many Nooks as it seats Hobs or more, up to 5.
- **Kettle Room.** A 2 x 2 hollow that holds the **Heartkettle**. Exactly one per castle. Must sit at least one block in from every outer face of the castle when built (so it always starts covered).
- **Cushion Loft.** A 2 x 1 room. A Hob that falls through it takes no fall damage and is never Tumbled. Earned at Grand Fort 2.

More rooms come with updates (Lookout, Decoy Kettle Room and Boiler Loft [U2], Tool Shed [U3]); the tech tree doc owns them.

**The validator (fixed).** Every fort, player or Rival, must pass the Workshop validator: Kettle Room placement, Nooks never fewer than seated Hobs, every Nook walled on all four sides at build time, Block Budget. Level data that fails the validator fails the build [R04 B3, audit C05].

**Own shots pass through own castle.** Your own blocks never block your own shots. No one wants to shoot their own wall [02 §2.10 frustration]. **Foreign blocks** do block your shots: blocks or props the other side placed on or in your fort (a bush, a cork, scrap) count as foreign. A Hob whose Loophole is blocked by dirt or a foreign block has a **buried Loophole**: its portrait shows the dirt icon and its Fire button greys until any blast, any Digger shot or a Dollop on the Nook clears it. It never fires into its own face. If every live Hob on a side is dug in at its turn start, the newest burial clears by itself, so no side is ever forced to pass [R04 B9, audit C15, D01].

**Shove Off (fixed rule, numbers tune)** [review 06 G7]. In your Walk step, tap the dirt icon on a dug-in Hob and pay **15 Steam**: that Loophole clears at once, and the Hob may fire this turn. It costs no Action. The 15 counts toward the 40 Steam per turn cap. One Shove Off per Hob per turn. With under 15 Steam left, the old ways (a blast, a Digger shot, a Dollop, or the newest-burial rule) still clear it. The AI uses Shove Off by the same rule. Burial traps were the worst feel in the reference games; this keeps a mound a real wall without making it a lost turn.

**Support rule (fixed for the sim).** A block stays up if it has a path of touching blocks (below or beside) down to the Footing. Side support reaches out from a block that has support below: **2 blocks for Wicker, Timber and Brassbound, 1 block for Cobble and Mossbrick**. Reach is inherited: a block resting on a side-supported block does not reset the count. A Brace line adds 2 to the reach along it. Any group of blocks that loses support falls as one chunk, straight down in the sim. Falling chunks break on landing and deal crush (2.10). The rule is deterministic so the AI, preview, replays and the Daily agree [03 §7.3, 04 §7, R04 B2].

**Why stone reaches 1.** Collapse is the damage that grows with fort size [R04 B2]. A tall stone fort is top heavy: a good low hit on a late fort should drop about a third of it. Bots test a late fort by week 6.

**Collapse in the sim and the view [R04 C1].** The sim decides which blocks fall and where they land with the custom support check. The view gives the look: creak, lean, staggered row drops, squash and dust, and it must end where the sim says. The week 4 prototype compares this with a cheap tumbling model. Playtests may change the support rule. They may not break determinism.

**The castle on the ground.** The castle never tilts. It rests on the highest ground under its footprint. If ground under it is carved away, the castle drops until a Stomper touches ground. A drop of more than 48 cells is a **Thump**: every block takes 10 damage and every Hob takes 10. A castle that sinks into a pit gains natural cover from flat shots but becomes a target for fluids that pool low [02c §3.6 I]. Digging under a castle is a tactic, not a win button.

**See-through.** On your turn your own castle goes see-through so you see your Hobs, the kettle and the Nooks [02d §1.6.6, screen: appstore/castle-busters/iphone-4.jpg].

### 2.8 Materials

Four build tiers at launch, a fifth in U3, plus Footing. HP climbs gently; the **quirk** is the reason to pay [R04 B1, 02b §16.6].

| Tier | Material | Block HP | Cost (Buttons) | Side support | Quirk | Tag |
|---|---|---|---|---|---|---|
| 1 | **Wicker** | 30 | 5 | 2 | Light. Burns. Deals no crush when it falls | [Launch] |
| 2 | **Timber** | 50 | 15 | 2 | Burns. Cheap and stiff: good for wings and overhangs | [Launch] |
| 3 | **Cobble** | 80 | 35 | 1 | Fireproof. Heavy: crush x2 when it falls | [Launch] |
| 4 | **Brassbound** | 110 | 70 | 2 | Fireproof. Riveted: holds wings like wood. Takes half from Pierce and Dig. From U3, conducts Zap: a Zap hit chains to touching Brassbound at half damage | [Launch] |
| 5 | **Mossbrick** | 140 | 150 | 1 | Heals 7 HP at the start of its owner's turn. No heal if it was hit since its owner's last turn, while Brittle, or with a Cuckoo Clock on it | [U3] |
| fixed | **Footing** | 400 | free | n/a | Immune to Dig. Takes 25% from Blast. Never falls | [Launch] |

**Mossbrick heal check.** A Clodpot does 35 x 0.6 = 21 to Mossbrick. The heal is 7, one third of that, and it stops on any turn after a hit, so a Plain Shot always dents it [R04 B1].

### 2.9 Crew: Hobs and Classes

- **Crew size** grows with the campaign: 1 Hob in 1-1, 2 in 1-2 and 1-3, 3 in 1-4 to 1-6, 4 from 1-7, and 5 from the Grand Fort 2 clear, a free gift with its grid step. **Cap 5** [R04 B3]. A level may set fewer. You may bring fewer than the cap.
- **The Hob is the weapon.** Each Hob belongs to one **Class**. Its Class sets its Plain Shot and the style of its Knack [02 §5.16, 02b §16.3].
- **Kit per Hob**: one **Plain Shot** (unlimited, Light) and one **Knack** (its own signature shot, 2 uses per battle, usually Medium). Any Hob may also fire any drafted Trick Shell (2.15).
- Base Hob HP: 100. Classes range 80 to 140. Named Hobs sit within 10 of their Class base; bosses are exempt.
- **Growth: 3 Ranks.** Training with Buttons raises a Hob from Rank 0 to Rank 3. Each Rank is a pick of one **Quirk** out of two. Ranks add no HP and no damage, and Knacks have no tiers [R04 B8]. The best old Knack tier ideas are now Quirk options (the crew doc owns them).
- **Bonked** Hobs float away on a Snooze Balloon. They are out for this battle only. No lasting cost. Only the player's side can Puff Up a Bonked Hob (the Patcher Knack); Rival Patchers rebuild walls instead [R04 B9]. In Couch Duel both human sides may Puff Up (6.1).

**Hob states (fixed list).** Five states, each with a clear picture [R04 B7]:

| State | What happened | Rule |
|---|---|---|
| **Open** | A block on any side of its Nook is gone, or it stands outside a Nook | No Cover |
| **Fell a floor** | Its Nook floor broke | It falls straight down to the first standing surface. Fall damage if over 32 cells. In a free Nook it takes that seat; anywhere else it is Open |
| **Tumbled** | It fell out of the castle | 45 + (fall - 64) / 8 damage, max 70, then it climbs into the lowest free Nook. It does **not** skip a shot. If no Nook is free it stands on the Footing lip, Open |
| **Squashed** | A chunk landed on it | Takes crush (2.10), pops back up |
| **Bonked** | 0 HP | Out for the battle |

Slapstick, not punishment [02 §5.20]. Hobs never leave the battle by knockback.

Seven Classes at launch, the Lookout in U2. The crew doc names the Hobs: 16 at launch, 28 in all.

| Class | Role | Plain Shot | Knack style | Tag |
|---|---|---|---|---|
| **Lobber** | Breaks walls | Clodpot: high arc pot, Medium blast | Big lob, Large blast | [Launch] |
| **Zinger** | Picks off Hobs | Hatpin: flat fast pin, Pierce, threads Loopholes | Beam through one wall | [Launch] |
| **Scatterjack** | Hits a wide patch | Gravel Sneeze: fan of 3 small stones | Split at apex into many | [Launch] |
| **Digger** | Digs under | Nibbler: short tunnel shot, Dig | Long bore then burst | [Launch] |
| **Bouncer** | Goes round corners | Jumping Bean: bouncing bean, 2 hops | Roller or skipper | [Launch] |
| **Stoker** | Burns and soaks | Hot Coal: fire pot that leaves an ember patch | Fluid or fire field | [Launch] |
| **Patcher** | Mends | Dollop: repairs 1 own block, or chips an enemy block | Rebuild 4 blocks, or re-inflate one Bonked Hob at 40 HP once per battle (player side only against the AI; both sides in Couch Duel) | [Launch] |
| **Lookout** | Finds their crew | Chalk Dart: marker that reveals a hidden Nook | Fan of chalk arcs that reveal rooms | [U2] |

Roles follow `02b §7` (Slayers, Demolishers, Tacticians) in original form. Every Class must have a hard counter visible on the map [02c §6 combo rules, 02d §1.6.12].

**Seating.** You seat Hobs in Nooks in the Workshop, saved per Blueprint. Where a Hob sits matters through the plain physics: a high Loophole lobs better, a low one fires flat and skims, what stands above a Nook can crush it, and Cover needs whole walls. There are no seat words or seat perks [R04 B7].

**Enemy crew info.** At battle start a 2 s **Muster** fly-by shows each enemy Nook with the Class icon of the Hob inside. The icons stay on after the Muster, and HP pips show on the HUD for both sides [R04 B10]. The AI knows the same: it sees your crew icons and HP, never your aim plans. Hidden crew returns in U2 with the Lookout, where fog and blizzard give it a job [U2].

### 2.10 Damage model

**Damage types (fixed list):** Blast, Pierce, Dig, Fire [Launch]. Frost [U2]. Zap [U3].

**Blast falloff.** Damage = base x (0.25 + 0.75 x (1 - d / R)), where d is distance from the blast centre to the target's edge and R is the blast radius. Linear with a 25% floor so edge hits still count [03 §11.1].

**Material multipliers (tuning targets):**

| Type | Wicker | Timber | Cobble | Brassbound | Mossbrick [U3] | Footing | vs Hob | Kettle |
|---|---|---|---|---|---|---|---|---|
| Blast | 1.2 | 1.0 | 0.8 | 0.7 | 0.6 | 0.25 | 1.0 | 0.5 |
| Pierce | 1.0 | 1.0 | 0.6 | 0.5 | 0.5 | 0.1 | 1.5 | 1.0 |
| Dig | 1.0 | 1.0 | 0.7 | 0.5 | 0.7 | 0 | 0.5 | 0 |
| Fire | 1.5 + Burn | 1.5 + Burn | 0.2 | 0 | 0.3 | 0 | 1.0 + Burn | 0 |
| Frost [U2] | 0.5 + Brittle | 0.5 + Brittle | 0.5 + Brittle | 0.5 + Brittle | 0.5 + Brittle | 0 | 0.5 + Rest 1 | 0 |
| Zap [U3] | 0.3 | 0.3 | 0.3 | 1.0 + chain | 0.5 | 0 | 1.2 | 1.0 |
| Crush | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0 | 1.0 | 0.5 |

**Statuses (fixed list, numbers tune):**

- **Burn** [Launch]: 8 damage at the start of the owner's turn for 2 turns. Spreads once to touching Wicker and Timber. At wind 5 or more, each tick it may also jump one wood block downwind, even over a one-block gap; at most one downwind jump per tick [audit C23]. Water ends it.
- **Soaked** [Launch]: from water. Ends Burn, blocks new Burn for 1 turn, turns Loam to Mud. From U3, a Soaked target takes Zap x1.5, applied after the material or Hob multiplier; it does not stack with Brittle [audit C22].
- **Brittle** [U2]: from Frost. The next Blast or Pierce hit on that block or Hob does x1.5. Lasts until hit or 2 turns. Fire ends Brittle. A Brittle Mossbrick block does not heal. Brittle and Soaked bonuses never stack. The Heartkettle is never Brittle [audit C24, C25].
- **Rest** (from Frost and some shots): adds 1 to a Hob's Rest cog, within the cap of 1 extra (2.2). This replaces the old Chill status.

Combo rules from `02c §6`: Fire lights wood, Water stops fire and makes mud, Frost makes things brittle, Tunnelers beat walls, Footing beats tunnelers, Bounce beats direct fire, sticky ground beats bounce and rollers. Every counter must be visible before the shot [02c §6].

**Cover rule (fixed).** A Hob in an intact Nook takes 50% damage from **area payloads** (blast band Tiny or larger, any damage type) centred outside its Nook. A Nook is intact while every block on all four of its sides stands: floor, ceiling, front and back, up to 8 blocks. A Footing floor counts. Block HP does not matter. Point hits, Threads through a Loophole, Burn ticks, crush and fall damage are never halved [audit C09, C10]. No line-of-sight math [03 §11.1].

**Loophole Flap (fixed rule)** [review 06 G6]. When a Thread passes a Loophole (the game calls "Threaded!"), a flap drops over that Loophole. Until the Weather Front changes, Threads cannot pass it: a point shot that reaches the slot hits the wall block instead. The Hob inside still fires as normal, and area shots, Beams through blocks and Burn are not changed. The flap shows on the fort with the rounds left in the front, for both sides, and lifts when the new front starts. It applies to every side, player and AI, on every preset, and in Couch Duel. **Why.** A kept aim plus a Loophole Thread could Bonk a 120 HP Lobber in two turns, again and again. Now each Loophole takes at most one Thread per front, and each new Thread needs a new aim. This replaces the old hidden AI rule "one Thread per battle on Fair" [D04 §6.5].

**Crush.** A falling chunk deals 15 per block in it (x2 for Cobble, 0 for Wicker) to the blocks, Hobs and Heartkettle it lands on. The kettle takes crush in full (100%). Big forts fall harder; that is how damage scales late in the campaign [R04 B2].

**Fall.** A Hob that drops more than 32 cells takes 10 per 16 cells, max 40. A Tumbled Hob (it fell more than 64 cells and landed in no free Nook) takes 45 + (fall - 64) / 8, max 70.

**Self damage.** Your blasts can hurt your own blocks and Hobs if they land near you, at 50%, and a self hit never Bonks one of your own Hobs (it stops at 1 HP). The Ghost and Pins mark a self hit in red so the cause is plain. Your shots still pass through your own castle in flight. No Rival shell may trap a fort with no way out: a buried side always digs out [02e §3.4, §3.8].

**Heartkettle (fixed HP).** 200 HP on every fort, bosses included; boss fights are gated by phases, not by a bigger kettle [R04 B4]. Its glow shows through walls on both castles at all times, so the core path is always plain [02d §1.6.5]. Multipliers are in the table above. Kettle rules (rules v5): Blast hits it at 75% and falling chunks at their full crush; a Beam that has passed through a block deals full damage (the old half-damage wall penalty is gone). At or under half HP the kettle cracks once: the blocks walling the Kettle Room each reach one less to the side, so a hurt kettle room tends to fall in on it [R04 B2, D01].

**Hard caps per shot (fixed, sim clamps) [audit C27, C28].**

- One shot deals at most 80 to one Heartkettle, counting the falls it causes. A Kettle Pop takes at least three good hits after the wall opens.
- No single shot Bonks a Hob from full HP. If a Hob starts a shot at full HP, the sim clamps that shot's direct damage to it at its HP minus 1, whatever its Class. Crush, falls and Burn ticks are not shot damage and do not count [review 05].
- One shot deals at most 110 Thwack in all, Match bonus included [D01].

**Juice rule.** Every hit shows a number, shakes the screen by size, and big hits get a short hit-stop. Every Hob hit gets a reaction [02 §6.11, 03 §11.1]. The UX doc owns shake, hit-stop and slow-motion values [audit C83].

**"Drop!" callout** [review 06 G5]. The first time in a battle that one shot drops 4 or more blocks by collapse, a short "Drop!" callout and sting play, and the shot log tags that entry "drop". Later drops of 4 or more get the tag and the sting, not the word. It teaches that a low hit plus gravity is the big damage.

### 2.11 Win conditions

Two paths, plus the **Sudden Squall** after the round cap [02 §2.9, 02d §1.6.5, R04 B5]:

1. **Clean Sweep.** Every enemy Hob is Bonked.
2. **Kettle Pop.** The enemy Heartkettle hits 0 HP. Steam blows out of every window, the Stompers fold and the castle sits down.
3. **Sudden Squall.** If neither happens by the round cap (15 by default), a storm rolls in and keeps growing until something pops. No score sums; the only tie rule is the double pop below (more total HP wins).

**Sudden Squall rules (fixed shape, numbers tune).**

| Squall round | Wind, at the round start | At the round end, each kettle loses | At the round end, each block loses (not Footing) |
|---|---|---|---|
| 1 (round 16 by default) | Moves 3 points further from 0, cap 10 | 50 | 10 |
| 2 | Moves 3 more | 100 | 20 |
| 3 | Moves 3 more | 150 | 30 |

- **Both sides at once (fixed).** Each side takes its turn as normal. When the round ends, after the second side has acted, the Squall hits both forts in the same tick. Blocks that hit 0 break, so forts start to fall, and the collapse resolves for both sides before the next round. Turn order never decides who pops first.
- **Double pop (fixed).** If both kettles reach 0 on the same Squall hit, the side with more total HP left wins. Total HP is that side's kettle HP plus the HP of its standing Hobs plus the HP of its standing blocks, counted just before that Squall hit. If that is equal too, the side that went second wins, which offsets the first-mover edge.
- A kettle popped by a shot during a Squall round ends the fight at once, as at any time.
- Squall damage ignores Cover, shields, lids and armour, and is not clamped by the per-shot caps. Heals and mends still work, but nothing heals a kettle.
- If wind is 0 when the Squall starts, it starts blowing toward a side picked by the battle seed.
- A kettle at 200 has lost 150 after Squall round 2 (it cracks there) and pops at the end of Squall round 3 at the latest; the crack and its crush often pop it a round sooner. **Every fight ends by the end of the third round after the cap.** Section 9.6 shows the check.
- Grand Forts use the Squall too. If a boss kettle drops through a phase in the Squall, the phase is skipped.
- **Level 1-1 is the one exception.** It has no Squall: when its cap of 8 runs out, Sir Pudge dozes off, his fort sits down and the player wins with 1 Pennant, so no first match ends in a storm the player was never taught [D05 §3.3, D07 §5.2].
- Mission types whose round or shot limit is the mission rule (Demolition, Puzzle, Rescue, Escort) have no Squall [D05 §3.1].

Players asked for a clear end and for kills to count [02d §1.4 requests]. The Squall keeps both: a side with more kettle left lasts longer, a side with more Hobs and walls left wins a double pop, and the match always ends with a bang.

The HUD shows both win paths at all times: Hob portraits with HP pips on each side, and each kettle's HP % in the top corners [02d §1.3]. In a Squall, a storm meter on each kettle shows what the next Squall will take.

**"Squall in 3" warning (fixed)** [review 06 G4]. At the start of the round two before the cap (round 13 at cap 15), a banner reads "Squall in 3", clouds gather on the horizon and the round counter turns amber. The next round shows "Squall in 2", the cap round "Squall in 1". The round counter (`Round 13/15`) stays on the HUD all battle. Levels with no Squall (1-1, Demolition, Puzzle, Rescue, Escort) show their own round count and no banner.

**Score.** Every battle also keeps a score for Pennant goals, the Daily Dust-up and the Long Siege [U1]. Balance by payoff against ease [02c §3.4, 02c §5.5]:

- Damage dealt x the shot's **Skill Factor** (0.5 for wide easy shots, 1.0 for Plain Shots, 1.5 for point shots and beams).
- +150 per Bonk. +400 for a Kettle Pop.
- +50 per unused round.
- +200 if no Hob of yours was Bonked.

### 2.12 Match length target

| Part | Target |
|---|---|
| Menu to first shot (Skirmish, repeat) | under 5 s [02 §5.24] |
| Pre-battle screen | one tap with last picks kept; 30 to 45 s with a full Rummage, 2 s with Quick Pick |
| One turn, player | About 20 s: 12 to 15 s to read and aim, 4 to 5 s resolve, a beat for the camera |
| One turn, AI | About 12 s: 0.8 to 1.5 s think pose, 2 to 5 s resolve (2x after Region 1), camera moves; hard 4 s cap on any AI resolve [02 §5.1, 02 §5.2] |
| One round | **About 32 s.** Both reference games ran close to 20 s per shot in our play [02e §2.2, §3.2]. The old guess of 16 to 20 s per round was too fast |
| Typical battle end | Round 8 to 12 (section 9.6): about 4.3 to 6.4 min |
| Round cap | 15. Levels may set 8 to 20; 8 only in 1-1, which has no Squall. Other Grand Forts: 18 to 20. Last Level: 12 per Stage [audit C70, C71]. Fallback cap 12 (9.6) |
| After the cap | "Squall in 3" warning before it, then the Sudden Squall, at most 3 more rounds |
| Whole battle | 4 to 7 min. Over 8 in under 10% of battles, held by the slice gate and the cap 12 fallback in 9.6. Each Last Level Stage is its own battle for this rule; Grand Forts may run longer (9.6) [02b §13, 02c §5.2] |

**Final boss shape.** The Last Level has 2 Stages, the Roller and the Engine. Hill Call works from the first Roller turn, the clan sends a crate before the last phase (Knacks refill, pick two shells), and a loss retries from the current Stage on every preset. The Baron's teacup scene stays as written [R04 B12]. The enemies doc owns the phases.

### 2.13 Turn timer policy

- **No turn timer, ever.** Against the AI nothing waits on you [02b §16.11]. The old opt-in Brisk timer is parked. In Couch Duel the other player waits, so two players may switch on the **Kind Clock** (6.1): off by default, it nudges a slow player but never fires, skips or locks anything.
- Campaign main wins never need a timer. Optional Trials may use one, marked up front.
- Pause anywhere, any time. Leaving the app pauses and saves.

### 2.14 Move and fuel: Steam

- Each castle has a **Steam** gauge of 100 per battle. It does not refill on its own. Bigger Boiler raises it to 130. "Refill" in any doc means refill to your cap [audit C73].
- Walking costs 1 Steam per 4 cells on flat ground, x2 uphill, x3 in mud. So about 400 cells of flat walking per battle.
- At most 40 Steam per turn.
- **Shove Off:** 15 Steam in the Walk step clears one buried Loophole (2.7). It counts toward the 40.
- Walking is part of your turn, before your Action. It does not use the Action [02 §5.23, 02c §5.8].
- A castle cannot walk off a cliff higher than 64 cells or into deep water. The walk bar shows where it would stop.
- **Steam Shot** (Tinker node): spend 15 Steam to fire one shot at +10% launch speed. Power still reads 0 to 100; a small steam badge shows on the readout and the preview uses the real speed [audit C53].
- Some Doodads and Tinker nodes add Steam. Steam is never sold. Level data may set the Steam pool.

### 2.15 How shots are chosen: kits plus the Rummage

Each battle hand has three parts. Around 8 to 10 meaningful choices, most scarce [02c §5.3]:

1. **Hob kits.** Each Hob's Plain Shot (unlimited) and Knack (2 uses). Fixed by who you bring.
2. **The Rummage.** A pre-battle draft against the Rival [02 §5.15, 02c §5.4, screen: appstore/pocket-tanks/iphone-4.jpg]:
   - A pool of 10 **Trick Shells** is drawn from your unlocked shells and the Rival's list.
   - You and the Rival alternate picks until each holds 4. Two are left over.
   - **Any Hob may fire any Trick Shell** [R04 B6]. Each shell card shows one Class icon, its **Match**. A Hob of the Match Class fires it with Rest 0 and +10% to its main number. Any other Hob fires it at its Weight's Rest. No shell is ever dead in hand, so there are no grey cards and no deny refund.
   - Each Trick Shell is single use. Shells have no rarity [R04 B16].
   - **The Rival's wish** [review 06 G9]. Before the first pick, the Rival glances at one tile and a small pin marks it: "I want that one." The pin is the shell the draft AI scores highest for itself, so it is true. The Rival takes it at its first chance if it is still there. On Stubborn and Ironclad the Rival may keep its wish to itself (the card says "plays its cards close"). No wish in Couch Duel, where no AI runs. This makes a deny pick a read, not a guess [D04 §6.8].
   - **Quick Pick** fills both hands at once using the Fair draft AI, and never takes a Dud for the player [audit C77]. **Pool lock**: a level may fix the pool for puzzle design. A level's fixed pool may lend shells from the Rival's list, marked "on loan".
   - The pool includes a **Dud** now and then (a joke shell), so denying it to the Rival is part of the fun [02c §6.55]. Every Dud is labeled "Dud" on its tile and card, for both sides, from launch on; there is no hidden Dud and no stamp rule. Firing one is funny and a little useful [D01]. From U2, a Lookout in the crew shows the Rival's draft picks as they are made [U2].
3. **Doodads.** Two slots, chosen before battle from what you have unlocked. One use each. Using one costs your Action. The weapons doc names them (launch examples: Mend Bucket, Pot Lid, Coal Scuttle, Weathercock) [02b §16.12].

**Level data may change** Steam, front length, pool size, picks and round cap. The pre-battle screen shows each change [audit C72].

### 2.16 Stakes

- **Inside a battle:** your Hobs and your castle. Losing a wall you built, or watching your best Hob float off, is the drama Pocket Tanks lacks [02 §1.9, 02 §6.10].
- **Between battles:** nothing is ever lost. A loss pays 40 Buttons and costs only time. Castles repair for free after every battle. No streak to break, no gear to drop [02c §4.4 Flying Tank, 02c §5.20].
- **Optional stakes** live in end-game modes: the Long Siege [U1] carries damage between waves (section 4.5).

---

## 3. The genre's known problems and our rule for each

| Problem | Our rule | Trace |
|---|---|---|
| **Perfect-aim AI** | AI aim has a per-difficulty error spread with a floor; first shot at a new target uses the widest spread (direct-hit chance under 15% on Fair); each next shot at the same target halves the error (bracketing); after two hits from one aim the AI walks or changes target; AI never sees what the player cannot, obeys Rest and Steam; AI thinks behind a 0.8 to 1.5 s pose; each Rival card shows "Aim 2 of 5". No difficulty ever has zero error outside boss scripts | 01 §1, 02d §2.6.1, 02c §3.5, 02c §5.12, 03 §8.4 |
| **"Bore through the base" plan** | Footing row is immune to Dig and takes 25% Blast; a carved-out castle drops and sits in its pit, it does not collapse; Patchers repair; Lump Rule maps put castles at different heights; some levels have other goals | 02 §2.8, 02 §6.4, 02b §15, 02d §1.6.3 |
| **Flat maps** | Lump Rule (section 2.6). The villain literally flattens land, and our campaign gives hills back | 02 §6.3, 02d §1.4 |
| **Slow turns** | Exchange under 12 s not counting player aim; AI acts behind a 1.5 s pose; settle capped at 3 s; AI resolve capped at 4 s; tap for 2x resolve; no confirm dialogs in battle; banner says whose turn it is | 02 §5.1, 02 §5.2, 02 §3.3 bot wait, 03 §10.3 |
| **Fights that end on a sum** | Flat material ladder, top-heavy stone, crush on the kettle and a crew cap of 5 keep fights to Round 8 to 12. The Sudden Squall ends any fight within 3 rounds of the cap, with a bang | Review 02 §3.4, R04 B1 to B5 |
| **Lost turns** | Nothing skips a side's turn. Extra Rest caps at 1. A buried Loophole greys one Hob, not the side | Review 02 §3.3, R04 B9 |
| **Blind aim** | 30% preview from the first battle, ghost of the last two shots, Rival ghost lines, pins, Recall, shot log, drift readout, forecast: all free. Every shell has a card with a looping clip. Test Yard with endless ammo | 02 §5.10, 02 §5.17, 02c §5.9, 02c §5.17, 02d §2.6.3 |
| **Cramped phone UI** | Battle in landscape or portrait (UX doc owns both); field gets at least 70% of screen; HUD is a top strip under 10% of height plus corner clusters; touch targets at least 48 pt; Fire at least 72 pt and movable; left-hand mode; pinch zoom and auto-frame; shell picker is a slim tray that never covers both castles | 02 §2.10, 02 §3.1 phone layout, 02 §6.6, screen: t02-tankduel-phone-layout.png |
| **Too many rules** | Onboarding adds one idea per level; levels 1-5 teach only five things; at most 12 prompts in the first 10 minutes; one pre-battle screen | Review 02 §1.1, R04 B14, B15 |
| **Crash counted as a loss** | Autosave at every turn start (seed plus command log); on relaunch the battle resumes at the exact turn; a crash never records a loss and never breaks anything | 02b §15.2, 02d §1.6.8, 04 §8 |
| **Grind** | No level needs upgrades to win on Fair; a player who clears each level once with 2 Pennants can afford the core Tinker Tree as each tier opens; every level gives a reward the first time; no XP wall; respec Quirks and Tinker nodes for free; Workshop blocks refund 100% when removed | 01 §3 ShellShock, 02b §15, 02d §1.4 |
| **Pay-to-win** | Nothing is for sale. The game is free with no monetization: no price, no unlock, no in-app purchases, no ads [R04 D2]. Every Hob, shell, Doodad and material is earned in play; balance patches never lower a saved unlock, and if a number must drop we refund in full | 01 §7, 02c §5.15, 02d §1.6.1, 02d §1.6.2 |
| **Fake opponents** | Every Rival is named AI and says so | 02b §17.1, 02d §1.6.4 |
| **Silent patches** | Every update ships plain patch notes in game | 02d §1.6.13 |
| **Lost saves** | A/B save slots, checksums, export and import code, never write over a newer save | 04 §8, 01 §14 Stick War |
| **Loud first launch** | Volume and orientation lock on the first screen, before any sound | 02d §1.4, 02d §1.6.10 |

---

## 4. Game loops

### 4.1 Second to second

Read the field (wind, ghost pins, open walls) → pick a Hob and shot → drag to aim, nudge → fire → watch the arc → impact: blocks break, a Hob tumbles, numbers pop → read the result → next turn.

The two best seconds are the impact and the 1 s after it, when things fall [02 §5.20]. The art and audio docs spend most of their effort there.

### 4.2 Battle loop

**One pre-battle screen** [R04 B15, audit C87]: the level card (Rival, its one stated habit, map preview, rule changes, Pennant goals), crew and Blueprint, a Rummage strip and the Doodad slots, all on one page. A Hob card shows a **"No line"** mark when no Plain Shot of that Hob can reach any enemy Nook or the kettle wall from your start pad or any spot a 40 Steam Walk reaches, at power 100, across the level's wind range [review 06 G10]. Skippers and rollers show a "rough ground" mark on maps where their Knack meets no surface it can skip or roll on. The marks come from a bot sweep of each map at build time [D05 §4.5], like the Rock warning for Diggers [D03 §4.5]. They warn; they never block a pick. Last picks are kept. One tap to fight. On a replay the default button is **Same again** → Muster fly-by → turns until Clean Sweep, Kettle Pop or the Squall pops a kettle → result card (Pennants, Buttons, Score, best shot replay) → Next, Retry or Map.

**After a loss**, the result card first plays a short slow-motion **"what broke you"** replay over your Blueprint: the shot that did the most harm, with one plain line ("your loft had one leg") [R04 B17].

**Rival habits.** Each Rival states one habit on its card ("Pudge aims at roofs"), so the player can build against it [R04 B17].

Retry is one tap from the result card and from the pause menu. No cost, ever [01 §10 Angry Birds avoid].

### 4.3 Session loop (5 to 10 minutes)

Open the app → land on the Brickabrac Map with the next level glowing → play 1 or 2 battles → spend Pennants on a Tinker node or Buttons in the Workshop or on Training → see the new thing in the next battle → close. A session can be one battle in a bus stop or five on a flight. Every exit point saves.

### 4.4 Meta loop

- **The Brickabrac Map.** Four regions at launch in a chain, 10 levels each (9 levels plus a **Grand Fort** boss). U2 and U3 add one region each [R04 A]. Side paths hold Trials. Winning a region "un-flattens" it: hills rise on the map [02 §6.1, 02b §16.15].
- **Workshop** (opens at level 1-6). Build and edit your castle between battles. Free to edit at any time. Save up to 5 **Blueprints**. **Test Yard** button: shell your own castle with any unlocked shot, or press **Raid** to watch a Rival attack it [02b §16.14, 02b §17.6, R04 B16].
- **Tinker Tree** (opens at level 1-10). The tech tree, bought with Pennants. Four branches: **Aim** (preview length, trick sights, aim verbs), **Fort** (grid size, Brassbound, shapes), **Crew** (bench, tempo, team play), **Kit** (shell sets, Doodads, Steam). Each branch has one real fork. Nodes change behavior, not only numbers [01 §3, 01 §17, 01 §12 Kingdom Rush, R04 B13]. The tech tree doc owns it.
- **Hob roster.** New Hobs join through the campaign (about one every 2 levels in Regions 1 to 3). **Training** with Buttons raises a Hob through 3 **Ranks**; each Rank is a Quirk pick of two, free to swap [02b §12, 02d §1.6.12].
- **Collections.** Almanac (every shell, Hob and Rival with a looping clip), Curio Shelf (keepsakes from Grand Forts and Trials that become castle decor), Outfits (cosmetic, earned), Brag Clips (last 20 replays, save or share as a file) [02 §6.15, 04 §7 replays]. Mastery and Deeds come in U1.

### 4.5 Modes beyond the campaign

- **Skirmish** [Launch]. Custom battle vs AI on any unlocked map. Offers **Volley Points** as a rule set (6.2).
- **Couch Duel** [Launch]. Two players on one device, taking turns. No AI, fully offline, open information, its own house rules (section 6.1). Offers Volley Points (6.2).
- **Test Yard** [Launch]. Sandbox. Any unlocked shot, endless ammo, dummy castles, your blueprints, wind slider, and the Raid button [02c §5.17].
- **Trials** [Launch]. Puzzle levels: one shot, fixed pool, special goals (topple the straw tower in 1 shot). 3 Pennants each. 6 at launch, 10 in all.
- **Daily Dust-up** [Launch]. A Skirmish seeded from the date on existing maps, fully offline. Same map, Rival and pool for everyone on that date. It has no maps of its own [R04 B18]. Best score kept locally. Last 30 days playable.
- **Long Siege** [U1]. Endless waves of rival castles. Your castle keeps its damage between waves. Between waves pick 1 of 3 **Odds and Ends** (run-only boons) and spend run-only Scrap to patch. Score is waves cleared and Score [01 §6 Tank Stars tournament, 02 §6.13].
- **Ironclad** [U2]. Replay any region on Ironclad difficulty for Iron Pennants (cosmetic badges only).
- **Baron Rush** [U3]. All Grand Forts back to back with one crew, no repairs between.

---

## 5. Economy

### 5.1 Currencies (two, plus Pennants as ratings)

| Name | Type | Earned by | Spent on | Sold for money |
|---|---|---|---|---|
| **Buttons** | Soft currency | Every battle | Workshop blocks and materials, Hob Training, decor | Never |
| **Pennants** | Progress currency and star rating | Pennant goals: up to 3 per level | Tinker Tree nodes | Never |

Nothing in the game is sold, so "Never" holds for everything (5.5).

**Pennant rating per level (the star rating):** 1 Pennant for the win, plus 2 level goals (examples: win by Round 8, Heartkettle above 50%, no Hob Bonked, Score over 2,000). Earned Pennants never go away. You can earn missing ones on replay [01 §10, 01 §12].

Iron Pennants [U2] and Keepsakes (Curio Shelf) are collectibles, not currencies. Scrap [U1] lives only inside a Long Siege run.

### 5.2 Earn rates (tuning targets)

| Event | Buttons |
|---|---|
| Win, first clear | 200 + 25 per Pennant earned |
| Grand Fort, first clear | 500 + 25 per Pennant. Last Level 1,000 + 25 per Pennant |
| Win, replay | 80 + 10 per new Pennant (Grand Fort 150 + 10) |
| Loss | 40 (also on "Leave it" after a resumed battle) |
| Trial, first clear | 100 |
| Daily Dust-up | 60 for the first clear each calendar day; back dates pay nothing |
| Test Yard Raid, first win | 50, once |
| Long Siege [U1] | 10 per wave, max 200 per run |
| Ironclad level, first clear [U2] | 100 |
| Baron Rush Bronze [U3] | 500, once |

Expected income on first clears for a typical player: about 13,600 Buttons by the end of the launch campaign, about 20,000 with U2 and U3. The tech tree doc holds the level by level table.

Pennants: 40 levels x 3 + 6 Trials x 3 = **138 at launch**. With all updates: 60 x 3 + 10 x 3 = **210**. Tinker Tree hold cost: 100 at launch (core 56), 172 with all tiers (core 72).

### 5.3 Sinks

- Workshop blocks (2.8 costs). A full Mossbrick castle (about 40 solid blocks, since Footing is free and rooms are hollow) costs about 6,000 [U3]. A mixed Cobble and Brassbound castle is affordable by Region 4.
- Hob Training: Rank 1 300, Rank 2 700, Rank 3 1,500 (2,500 per Hob). Target: 5 Hobs at Rank 2 by the final boss without replay farming.
- Decor: flags, roof shapes, paint, Stomper styles. Endless, cosmetic only. Answers "spend extra wood on decorations" [02d §1.4 requests].
- No sink takes away earned things. Removing a block refunds it fully.

### 5.4 Fixed rules

- No timers on anything. Training and building are instant [02b §17.9].
- No energy or lives. Retry is always free [01 §10].
- No ads of any kind. No reward ads, no forced ads.
- Nothing for sale. No price, no in-app purchases, no store screen (5.5).
- No loot boxes. Rewards are fixed and shown before the battle.
- "Data Not Collected" store label. Opt-in local stats only [02d §3, 04 §13].

### 5.5 Free, no monetization (owner decision)

**Decided [R04 D2]: the whole game is free, with no monetization.** Rules:

- No price, no trial, no unlock, no in-app purchases, no ads, no paid cosmetics, no tip jar. Nothing in the game or the store page is for sale.
- Every region, level, mode, Hob, shell, Doodad, material and cosmetic is free and earned in play. Region 1 is the start of the campaign, not a trial, and nothing is gated behind it.
- U1, U2 and U3 are free updates. The store page says what is in the box today and what comes next, with dates [02c §3.7, 02d §2.2].
- The build carries no purchase code, no in-app purchase plugin and no ad SDK. There is nothing to restore and nothing to check online, so the game works offline forever.
- The web app is the same free game with the same content, built on the same shared core (TypeScript and WebGL2, the core as Wasm, installable as an offline PWA) [04b]. No code is needed.
- No nag screens, no "buy" cards, no "rate us" walls.

---

## 6. Game modes

| Mode | Tag | Unlock | Notes |
|---|---|---|---|
| **The Unflattening** (campaign) | [Launch] | Start | 4 regions, 40 levels incl. 4 Grand Forts. U2 and U3 add 10 levels each |
| **Skirmish** | [Launch] | After level 1-5 | Custom battle vs AI: pick map, Rival, rules, round cap, wind range, and which shells each side may use [02c §4.4 Warlings request]. Volley Points option (6.2) |
| **Couch Duel** (hotseat) | [Launch] | From the main menu at first launch | Two players, one device, no AI, Starter Box from the first launch. Section 6.1. Volley Points option (6.2) |
| **Test Yard** | [Launch] | With the Workshop, level 1-6 | Sandbox, practice range, Raid button |
| **Trials** | [Launch] | Side path from level 1-8 | Puzzle levels, 3 Pennants each |
| **Daily Dust-up** | [Launch] | After Region 1 | Seeded offline Skirmish on existing maps |
| **Long Siege** | [U1] | After Grand Fort 3 | Endless |
| **Ironclad** | [U2] | After each region | Hard replay, cosmetic badges |
| **Baron Rush** | [U3] | After Grand Fort 6 | All Grand Forts in a row |

**Mission types** [R04 A, B16]: Siege (the plain duel), Demolition, Rescue, Puzzle (Trick-shot and Puzzle Shot merged) and Grand Fort at launch. At least 22 of the 40 launch levels are the plain duel on a new map with a new Rival habit. Waves come with Long Siege [U1], Escort (Escort and Defend a Cart merged) with U2, King of the Hill with U3. The campaign doc owns them.

### 6.1 Couch Duel `[Launch]`

**Decided [R04 D3]: Couch Duel ships at launch.** Two people play one duel on one device, taking turns. No AI on either side, no server, no account, fully offline. Research shows strong love for same-device play: about 140 Pocket Tanks reviews at 4.5 stars average [02d §2.4, 02d §2.6.9, 02c §3.8.6].

**House rules (fixed)** [review 06 G2]. Rules written for a human against the AI break between two people. These apply whenever both sides are human:

1. **Everything is open.** Crews, Class icons, HP, Steam, Rest cogs, hands, Doodads and props show for both sides all battle. Items that are hidden from the AI Rival elsewhere show to both players here: a Molehill draws in plain view on the ground where it was buried [D01 §5]. Hidden crew and the Lookout [U2] are off; a Lookout may join a crew, but its reveals do nothing.
2. **Player-only rules apply to both sides.** Puff Up (the Patcher brings back a Bonked Hob, once per battle, player side only against the AI) is open to each side once per battle. The same goes for any later rule marked "player side only". A setup toggle turns Puff Up off for both.
3. **Hand-off card.** After each shot settles, a card fills the screen: the next player's name and colour, a one-line recap of the last shot ("Kettle -35, one Hob Tumbled") with its Pin shown on a small Field Strip, and a big **Ready** button. It hides nothing. Its job is to stop a stray tap while the device changes hands. A "Skip hand-off card" toggle suits two players side by side.
4. **Kind Clock** (off by default). Each side may set 30, 45 or 60 s. The clock runs during that side's Plan step and shows as a ring on its Fire button. At zero a soft chime plays and the ring turns amber. That is all: it never fires, never skips a turn, never locks aim or Walk, and the shot is never taken away. It exists so a slow player feels a gentle nudge, not a penalty.
5. **Starter Box.** Even loaner forts that play from the first launch, before any campaign level: three mirror kits, each a validator-passing fort with a crew of 4 from the Region 1 Hobs at Rank 0, the six start shells as the Rummage source, and Mend Bucket plus Pot Lid. Both sides pick from the same three kits, so a guest is never short of anything.
6. **Handicaps in plain sight.** Every handicap a side takes (Steam, preview, crew size, Take Back) shows as a badge on that side's HUD and on the Hand-off card, for both players, all battle.
7. **Table mode** (portrait only). The device lies flat between two players. The screen splits: each half carries its player's HUD, Hob portraits and Fire button, turned to face that player. The shared battle view sits in the middle and turns to face the active side at each Hand-off. The UX doc owns the layout.

**Quick start.** Couch Duel sits on the main menu from the first launch. It does not wait for any campaign level. Three taps to the first shot: Couch Duel, Quick Match (Starter Box kits, Two Lumps, default rules), Fight. A player who has not played 1-1 gets a three-card "how to play" panel (drag to aim, Fire, pop the kettle) that one tap skips. These cards do not count toward the campaign's 12-prompt cap.

**Setup screen.** One screen, like the pre-battle screen [R04 B15]. Last settings are kept, and "Same again" is the default after a match.

1. **Names.** Each player types a short name or keeps "Left" and "Right". Each side has its own colour, shown on its fort flag, HUD and Hand-off card.
2. **Fort and crew.** Each player picks a Blueprint and a crew from one of three sources:
   - **Starter Box.** The three even kits above. A fresh install can play at once.
   - **This save.** Any Blueprint and any owned Hobs on the device's save. Both players may use this save. Nothing is spent and nothing changes in it.
   - **Guest save.** Paste a friend's save export code [04 §8]. Their Blueprints and Hobs load into a guest slot for Couch Duel only. The host save is never touched. The guest slot is kept for rematches until deleted.
   Every fort must pass the Workshop validator, as everywhere [R04 B3].
3. **Even Fort** (on by default). Tinker nodes and Hob Ranks are off for both sides, as in the Daily, so the match is about aim and plan. Off: each side brings its fort, nodes and Ranks as they are.
4. **Handicaps, per side, shown openly.**
   - **Steam:** 70, 100 (default), 130 or 160.
   - **Preview:** 30% (default), 45%, 60% or full arc (Training Arc).
   - **Crew size:** 1 to 5 (default: the smaller of the two crews brought).
   - **Take Back:** off by default; on gives that side one undo per battle (section 8.1).
   - **Kind Clock:** off (default), 30, 45 or 60 s.
5. **Match settings.**
   - **Rules:** Duel (default: Clean Sweep, Kettle Pop, Squall) or **Volley Points** (6.2).
   - **Map:** any duel map Skirmish offers on this save, plus the three Downs shared maps (D1 to D3) always. Random is an option.
   - **Wind:** Off, Gentle (0 to 3), Map (the map's range, default) or Strong (map range +2).
   - **Round cap:** 8 to 20, default 15. "Squall in 3" warns as in 2.11.
   - **Squall:** On (default): the Sudden Squall runs as in section 2.11. Off: at the round cap the match ends and the side with more total HP left wins, the same count as a Squall double pop.
   - **Puff Up:** on for both (default) or off for both.
   - **Weather and hazards:** as Skirmish offers them, on or off.
6. **Who goes first.** Coin flip, shown on screen. The Skirmish offset applies: the first side fires no Heavy shot on its first turn, and the second side gets +20 Steam and the first Rummage pick (section 2.2).

**The Rummage in Couch Duel (one rule, shared with `01 §1.9`).** The pool of 10 takes 5 slots from each side's shell source (the six start shells for a Starter Box kit) under the normal spread rules. The second side picks first, then picks alternate until each side holds 4. Every pick shows at once, face up, in that side's colour. Duds stay labeled. **Quick Pick** fills one side's remaining picks at random within the spread rules; it is not an AI. There is no Rival wish. Doodads: 2 slots each, from that side's source.

**Turns.** Turns run exactly as in any battle (section 2.2): Walk (and Shove Off), then one Action. Loophole Flap, Lean Lines and every free aim aid work for both players. Each side keeps its own left-hand layout and Fire button spot, which swap in at its turn.

**Results screen.** The winner in their colour and the win path (Clean Sweep, Kettle Pop, Squall or Volley Points). The best shot replay of each player, a few plain stats per side (shots, hits, blocks dropped, Hobs Bonked) and a local head-to-head tally by name. Buttons: **Rematch** (same settings, first turn swaps), **Swap Sides** (forts trade left and right), **Settings**, **Menu**. Couch Duel pays no Buttons and no Pennants and changes no progress on any save. The replay joins the Brag Clips list.

**How it uses the sim.** A Couch Duel is a Skirmish with two human controllers. The sim, the seed and the command log are the same; only the controller tag on each side and the house rules differ. **The AI is never loaded** in Couch Duel, not even for Quick Pick. Autosave at every turn start, so a crash or a closed app resumes at the exact turn with the Hand-off card up for the right player. Replays and the "what broke you" replay (offered to the losing side) work as in Skirmish. Nightly bots run Couch Duel setups with two bot controllers to prove the rules match Skirmish apart from the house rules [04 §14].

**Orientation.** Couch Duel plays in portrait and landscape like every battle, plus Table mode in portrait. The UX doc owns the layouts and the Hand-off card.

### 6.2 Volley Points `[Launch]`

An optional rule set for Skirmish and Couch Duel only, never the campaign [review 06 G11]. Couch players love a points race in which nobody sits out and a late shot can flip it.

- **Length.** Each side gets a fixed number of Actions: 6, 10 (default) or 14. A Doodad counts as an Action. The HUD shows "Shots left 7/10" for each side. No round cap, no Squall.
- **Score.** Each side's Score (2.11), counted only from damage x Skill Factor, +150 per Bonk and +400 per Kettle Pop. The "unused round" and "no Hob Bonked" bonuses do not apply. Both scores show on the HUD all match.
- **Nothing ends early.** A Bonked Hob puffs back at the start of its side's next turn at half its HP in the lowest free Nook (that turn still counts for Rest). A popped kettle relights at 150 HP at the start of its owner's next turn. Blocks stay broken.
- **Winner.** Highest score after both sides fire their last Action. On a tie, the side that went second wins, as for a double pop.
- Every other rule holds: Rest, Steam, Shove Off, Loophole Flap, the per-shot caps and the full-HP clamp.

---

## 7. Systems list and glossary

### 7.1 Systems list

| # | System | Owner doc |
|---|---|---|
| 1 | Sim core: the shared Rust core, one 120 Hz clock, integer Q16.16 fixed point with no floats in rules, seeded RNG, own trig, commands, events, hash. Called by the native iOS and Android apps and, as Wasm, by the web app [04b, R04 C2] | Tech plan |
| 2 | Terrain grid: ground materials, carve, add, settle, patches | Tech plan, levels |
| 3 | Ballistics: shells, wind, gravity, triggers, bounce, split, roll, dig, beams | Weapons |
| 4 | Castle structure: blocks, materials, Footing, Nooks, Kettle Room, support rule, Thump, validator | This doc, Workshop UX |
| 5 | Crew: Hobs, Classes, kits, Rest, Hob states, Ranks, Quirks | Crew |
| 6 | Damage and status: types, falloff, multipliers, Burn, Soaked, Brittle, crush, fall, per-shot caps | This doc, weapons |
| 7 | Turn manager: turn steps, Walk, Action, rounds, Weather Fronts, win paths, Sudden Squall, Score | This doc |
| 8 | Rummage draft, Match bonus and Doodads | Weapons |
| 9 | AI: shot search in work units, error and bracketing, personality weights, Rival habits and lines [03 §8] | Enemies |
| 10 | Aim and HUD: Aim Drag, Fine Tune, preview, ghost, pins, Recall, shot log, drift readout, Lean Lines, shimmer, Loophole Flap marks, "Drop!" callout, "Squall in 3", Fire button | UX |
| 11 | Camera: frame, follow, impact hold, pinch [03 §12] | UX |
| 12 | Workshop: build, seat, blueprints, Test Yard, Raid, decor | UX, crew |
| 13 | Brickabrac Map and level flow | Campaign |
| 14 | Tinker Tree | Tech tree |
| 15 | Economy: Buttons, Pennants, rewards | This doc, tech tree |
| 16 | Collections: Almanac, Curio Shelf, Outfits, Brag Clips, stats | UX |
| 17 | Save, resume, export, migration [04 §8] | Tech plan |
| 18 | Replays and the "what broke you" replay | Tech plan, UX |
| 19 | Settings, accessibility, assists | UX |
| 20 | Audio director (sim events to sound) [04 §11] | Audio |
| 21 | Couch Duel: two human controllers, house rules, setup screen, Hand-off card, Kind Clock, Starter Box, Table mode, guest save slot, Volley Points | This doc, UX, tech plan |

### 7.2 Glossary (binding names)

| Term | Meaning |
|---|---|
| **Brickabrac** | The world |
| **The Unflattening** | The campaign |
| **Brickabrac Map** | The campaign map screen |
| **Flatteners** | The villain clan |
| **Baron Levelwell** | The villain leader, the Last Level |
| **Rival** | Any named AI commander and its castle. In Skirmish the Rival is one of the named Region 1 Rivals, picked by seed |
| **Notice of Flattening** | The Flatteners' letter on the level card, signed by the Rival, with the Habit as the small print |
| **Habit** | The one play pattern a Rival states on its card |
| **Grand Fort** | A boss castle, one per region |
| **Last Level** | The final Grand Fort: 2 Stages, each its own battle |
| **Hob** | A crew member |
| **Class** | A Hob's trade, which sets its Plain Shot and Knack style |
| **Lobber, Zinger, Scatterjack, Digger, Bouncer, Stoker, Patcher** | The seven launch Classes |
| **Lookout** | The eighth Class [U2] |
| **Rank** | A Hob's growth step, 0 to 3, bought by Training. Each Rank is a Quirk pick |
| **Quirk** | A behavior perk picked at each Rank, one of two, free to swap |
| **Plain Shot** | A Hob's unlimited basic shot |
| **Knack** | A Hob's signature shot, 2 uses per battle |
| **Trick Shell** | A drafted single-use shell any Hob may fire |
| **Match** | The Class shown on a Trick Shell card. A Match Hob fires it with Rest 0 and +10% |
| **Dud** | A joke Trick Shell, always labeled "Dud" |
| **The Rummage** | The pre-battle draft |
| **Quick Pick** | Auto-fill the Rummage |
| **Doodad** | A one-use gadget, costs the Action |
| **Weight** (Light, Medium, Heavy) | How heavy a shot is; sets Rest |
| **Rest** | Turns a Hob sits out after a Medium or Heavy shot, shown by a cog. Also what Frost adds. Replaces Reload and Chill. Extra Rest caps at 1 |
| **Open, Fell a floor, Tumbled, Squashed** | Hob states: no Cover; fell to a lower floor (was "Dropped": "Drop!" is the wall shout); fell out of the castle and climbs back; crushed by a chunk |
| **Bonked** | A Hob at 0 HP, out for the battle |
| **Snooze Balloon** | What carries a Bonked Hob away |
| **Puff Up** | Bring a Bonked Hob back at 40 HP (Barn Raising). Never "revive" on screen |
| **Cracked** | A block at a third of its HP or less (was "Battered"). One word for hurt, battered and damaged |
| **The Creaks** | Late in a fight, Cracked and worn blocks hold less and let go (was "Fatigue"). On the HUD: "Creaks in 3". On the banner: "The fort creaks." |
| **Muster** | The battle-start fly-by of enemy Nooks; Class icons stay shown after it |
| **Heartkettle** | The castle core, 200 HP on every fort. On screen it is just "kettle"; Heartkettle is the Almanac word |
| **Kettle Room** | The room that holds the Heartkettle |
| **Nook** | A crew room |
| **Loophole** | A Nook's firing window |
| **Dug in** | A Hob whose Loophole is blocked by dirt or a foreign block; that Hob's Fire button greys. If a whole crew is dug in, the newest burial clears |
| **Shove Off** | Pay 15 Steam in the Walk step to clear one buried Loophole; costs no Action |
| **Peephole** | A small gap cut in a block that point shots can pass |
| **Thread** | A point shot that enters a Loophole and hits the Hob with no Cover |
| **Loophole Flap** | After a Thread passes a Loophole, that Loophole takes no Threads until the Weather Front changes |
| **Next door** | The Nooks touching a Hob's Nook left, right, above and below, sharing a wall with no room between. Used by positional Passives |
| **Cover** | The 50% cut a Hob in an intact Nook gets from area payloads centred outside |
| **Block** | One 16 x 16 cell castle piece |
| **Block Budget** | Grid cells above the Footing row, 72 at the cap |
| **Footing** | The bottom row of every castle |
| **Foreign block** | A block or prop the other side placed in your fort; it blocks your shots |
| **Wicker, Timber, Cobble, Brassbound** | Material tiers 1 to 4 |
| **Mossbrick** | Material tier 5 [U3] |
| **Stompers** | The castle's clockwork legs |
| **Steam** | Walking fuel |
| **Steam Shot** | Spend 15 Steam for +10% launch speed on one shot |
| **Walk** | Moving the castle |
| **Thump** | Damage from a castle dropping |
| **Crush** | Damage from a falling chunk, to blocks, Hobs and the kettle |
| **Patch** | A ground or block effect with one icon and a turn count |
| **Weather Front** | A 3-round span of fixed wind |
| **Forecast** | The free icon that shows the next front's wind |
| **Turn, Round, Action** | One side's go; both sides' goes; the one shot or Doodad per turn |
| **Clean Sweep** | Win by Bonking all enemy Hobs |
| **Kettle Pop** | Win by destroying the enemy Heartkettle |
| **Sudden Squall** | The storm after the round cap; at each Squall round end both sides' kettles and blocks lose HP at once until a kettle pops; a double pop goes to the side with more total HP |
| **Score** | Per-battle score (was "Siege Score") |
| **Blown Out** | Win when the Squall pops their kettle first (was "Squall Pop") |
| **Dozed off** | Win at the round cap, said with the Rival's name: "Sir Pudge dozed off." |
| **Skill Factor** | Score weight of a shot |
| **Point** | The zero-radius blast band; a "point shot" hits only what it touches |
| **Buttons** | Soft currency |
| **Pennants** | Star rating and Tinker Tree currency |
| **Iron Pennants** | Ironclad badges [U2] |
| **Tinker Tree** | The tech tree: Aim, Fort, Crew, Kit |
| **Fork** | The one pick-1-of-2 node pair in each Tinker branch |
| **Training** | Buying a Hob's next Rank with Buttons |
| **Workshop** | The castle editor |
| **Blueprint** | A saved castle layout with seating |
| **Validator** | The Workshop check every fort must pass |
| **Test Yard** | Sandbox and practice range; its **Raid** button lets a Rival attack your Blueprint |
| **Aim Drag, Fine Tune, Recall** | Aim input, nudge pad, restore a ghost aim once |
| **Ghost, Pin** | Last-shot line, impact marker |
| **Lean Lines** | Hold a block to see, by dashed outline, which blocks would fall if it broke. Free |
| **Shimmer** | The soft shine on rival blocks that hang at the end of their support reach. Free |
| **"Drop!"** | The callout on a battle's first collapse of 4 or more blocks from one shot |
| **"Squall in 3"** | The countdown banner two rounds before the round cap |
| **Field Strip** | The thin whole-map lens in the portrait battle view |
| **No line** | The pre-battle mark on a Hob whose Plain Shot cannot reach the enemy on this map |
| **Wish** | The one shell the Rival pins in the Rummage before the first pick |
| **Shot log, Drift readout** | Free list of your last 6 shots; free wind drift number at the preview tip |
| **"What broke you"** | The slow-motion replay after a loss |
| **Almanac, Curio Shelf, Keepsake, Outfit, Brag Clip** | Collections |
| **Odds and Ends** | Long Siege run boons [U1] |
| **Couch Duel** | Two players on one device, taking turns, no AI |
| **Hand-off card** | The Couch Duel card between turns: next player, last shot, Ready button; it hides nothing. Replaces "pass screen" |
| **Kind Clock** | Optional Couch Duel clock, off by default; at zero it chimes and never fires or skips |
| **Starter Box** | Three even loaner kits for Couch Duel, playable from first launch |
| **Table mode** | Couch Duel portrait layout with the device flat and each player's HUD facing them |
| **Volley Points** | Skirmish and Couch Duel rule set: fixed Actions each, highest Score wins |
| **Loaner fort** | A ready fort and crew from the Daily loan tables, used in the Daily and the Couch Duel Starter Box |
| **Cosy, Fair, Stubborn, Ironclad** | Difficulty presets (Ironclad [U2]). The content id is still `cozy` |
| **Fight** | The word on screen for one match. Never "battle" on screen; this doc still says battle in rules prose |

Regions, in campaign order: Puddingstone Downs (grass hills, tutorial), Crag End (cliffs), Soggy Bottom Fen (water and mud), The Flats (the Baron's rolled land; levels about raising ground back) at launch; Nithering Heights (ice, strong wind) [U2]; Wheal Clank (caves, metal) [U3].

**Words on screen.** Every line a player reads comes from `content/text.json`, one table for web, Android and iOS. Display names come from the content JSON. Ids in code, saves and content keep their old spelling (`delver`, `boinker`, `sunspear`, `sod_sack`, `cozy`); only what the player sees has changed. Where a design doc quotes a line and `content/text.json` says something else, the string table wins. Voice and naming rules: `docs/review/naming-and-voice-review-fable.md` section 2, as fixed by `docs/review/naming-decisions.md`.

Shot, Doodad and Hob names belong to the weapons and crew docs. All names need a trademark and store search before art production [R04 D9].

---

## 8. Difficulty, accessibility and onboarding

### 8.1 Difficulty presets

Difficulty is a set of knobs, not one number [03 §8.4]. The player picks a preset any time, even mid-campaign. Pennants count the same on Cosy, Fair and Stubborn. Pennant goals that need a hard setting do not exist.

| Knob | Cosy | Fair (default) | Stubborn | Ironclad [U2] |
|---|---|---|---|---|
| AI angle error (deg, sigma, first shot) | 5 | 3 | 1.5 | 0.8 |
| AI power error (%, sigma, first shot) | 10 | 6 | 3 | 1.5 |
| Bracketing (error per next shot) | x0.75 | x0.5 | x0.5 | x0.4 |
| AI uses wind | half | yes | yes | yes |
| AI shell choice | random of best 4 | best of 2 | best | best plus combos |
| AI thinks about its own safety | no | yes | yes | yes |
| Threads a Loophole | never | yes, under Loophole Flap | yes, under Loophole Flap | yes, under Loophole Flap |
| Preview length | full arc (Training Arc) | 30% plus Tinker | 30% plus Tinker | 30%, no Tinker bonus |
| Take Back (undo your last shot, once per battle) | yes | no | no | no |
| Wind | off or gentle | per level | per level | per level +2 |

Bosses may script a tighter error on set-piece shots, but always telegraph them first (the enemies doc owns this). The AI think budget is counted in work units, with a target of 400 ms p95 on the 2 GB phone for every preset, hidden by the think pose [R04 C3].

**Assist toggles** (any preset): Training Arc, aim snap to last ghost, slow-motion on impact, extra +30 Steam, wind off.

### 8.2 Accessibility

- Colour-blind palettes (3 presets); team, wind and hazard info always carried by shape and icon too [01 "best ever" 14].
- Text size 3 steps; UI scale 2 steps.
- Reduce shake, reduce flashes, reduce motion toggles [04 §15 M3].
- Left-hand layout; movable Fire; drag direction toggle; Quick Fire toggle [02 §6.17].
- One-hand play: every battle action reachable with one thumb, in portrait and in landscape.
- Hold-to-repeat can be swapped for tap-only.
- Captions for Rival lines and key sound cues (incoming shot, kettle damage, Squall).
- Separate music, effects and voice volume, available on the first screen [02d §1.6.10].
- No time pressure anywhere. The Couch Duel Kind Clock is opt-in and never acts on its own.
- Full keyboard and mouse play on web and desktop.
- Haptics on or off.
- Battery mode: 30 fps cap [02d §1.6.9].

### 8.3 Onboarding: the first 10 minutes

Show, do not tell. One idea per beat, at most three words of on-screen text per prompt, pictograms first [02c §4.1 Tank Stars tutorial]. No account, no consent wall beyond the store's own. **At most 12 prompts in the first 10 minutes** [R04 B14]; this plan uses 11, numbered in the table. Levels 1-1 to 1-5 teach only five things: aim, pick a Hob, the kettle, wind and one Knack. The campaign doc owns the level order and the UX doc owns the exact prompt words and timing [D05 §6.4, D07 §5.1]; this table is a summary of theirs.

| Time | Beat | Prompt | What the player learns |
|---|---|---|---|
| 0:00 | Launch. Studio card under 2 s, tap to skip. First screen shows volume and the Play button | | Settings first [02d §1.6.10] |
| 0:08 | Cold open, no menu. A wobbly Flattener straw tower on a small hill. Marge the Lobber in a tiny Wicker castle. A ghost hand shows Aim Drag | 1. "Drag to aim" | Aim Drag |
| 0:22 | Player drags. Fire button pulses. Shot flies; full preview on this beat only | 2. "Fire!" | Fire is a button; release does not fire |
| 0:30 | If miss, the ghost and pin appear | 3. "Last shot", 4. "Tap the pin", 5. "Bit more" or "Bit less" | Ghost, Pin, Recall, Fine Tune |
| 0:50 | Hit. Tower blocks fall, a Flattener dummy squeaks and floats away on a balloon | | Destruction, Bonk, tone |
| 1:10 | Level 1-1 proper: Sir Pudge, a lazy Flattener. No wind, cap 8, no Squall. Pudge misses wide, then closer | | AI turns, AI misses like a person |
| 2:10 | Own castle goes see-through; pointer on the Rival's crew icon | 6. "Bonk them all" | Your crew lives inside; Clean Sweep |
| 3:30 | Win. Result card: Pennants with the two goals as icons. Buttons tick up | 7. "Pennants!" | Pennants and goals |
| 3:40 | Brickabrac Map. Hills rise around the cleared node. The Baron's roller rumbles far off | | Story hook in 10 s |
| 4:30 | Level 1-2: Miss Quill the Zinger joins | 8. "Tap a Hob" | Choose the shooter |
| 4:50 | Fine Tune pad lights up for one nudge | 9. "Nudge it" | Fine Tune |
| 7:30 | Level 1-3: the Rival's kettle glows through its walls. One loose Trick Shell, Lid Lifter, sits in the hand; its card glows under the same prompt | 10. "Pop the kettle" | Second win path, and a first special shell |
| 9:30 | Level 1-3 result card shows the other path as "Also works" | 11. "Also works" | Two win paths |

A new player reaches about the end of 1-3 in the first 10 minutes [review 02 §1.1]; that is fine. A fast player who reaches 1-4 meets one more prompt ("Mind the wind") and lands on 12. What follows is paced by level, one idea each:

| Level | New idea |
|---|---|
| 1-4 | **Wind** and the forecast, pointed out once. Jax the Scatterjack joins. One loose Trick Shell, Bag of Marbles, in the hand; its card glows, with no new prompt |
| 1-5 | **One Knack** (Marge's) and "needs a rest". Skirmish opens after the win |
| 1-6 | **Workshop** opens before this level, with a real choice: three Cobble blocks and two good spots. Test Yard button. The first Rival habit to build against. Grub the Digger joins |
| 1-7 | Rescue: Hetty the Patcher is freed. Crew of 4; the free grid step seats her |
| 1-8 | **Rummage**: a small pool of 4, two picks each. Bobbin the Bouncer joins. Trial 1 on the side path |
| 1-9 | **Walk** and Steam, on a level that needs a better angle |
| 1-10 | Grand Fort 1. The win opens the **Tinker Tree**; the first visit spotlights Trick Sight. Daily Dust-up opens |

**Loose Trick Shells** [review 06 G8]. Levels 1-3 and 1-4 each lend one fixed Trick Shell for that level only: one use, no draft, no unlock. Lid Lifter (1-3) points at the kettle lesson; Bag of Marbles (1-4) fits Jax, its Match. The first four levels would otherwise be Plain Shots only. Neither adds a prompt, so the count stays at 11 (12 for a fast player). Both join the pool with the start six when the Rummage opens at 1-8.

Winning 1-9 gives the first Doodad, Mend Bucket, and one Doodad slot, so the 1-10 boss has a gadget turn without 1-9 teaching two things [PLAN decision 14]. The second slot, Pot Lid and Fire on Timber (2-1), Training and Thump (2-2) come in Region 2. The campaign doc owns the level list.

Fail-safe: if the player misses 5 times in a row in levels 1-1 to 1-5, the preview grows by 10% for that battle and a hint suggests the ghost pin.

---

## 9. Numbers (all tuning targets)

### 9.1 World and ballistics

| Item | Start value | Note |
|---|---|---|
| Sim clock | One 120 Hz clock for everything; render at display rate | R04 C2 |
| Map | 2400 x 720 cells | 04 §9 |
| Castle gap | Duels 1000 to 1400; Long maps to 1800 | R04 C4 |
| Gravity | 600 cells/s² | 03 §7.2 |
| Power range | 0 to 100, integer; min useful 10 | 04 §7 |
| Launch speed | 12 x power cells/s (max 1200; Steam Shot 1320) | Max range at 45° with no wind: 2400 cells |
| Angle range | 0° to 180°, stored in tenths | 04 §7 |
| Wind range | -10 to +10, integer | |
| Wind push | 10 cells/s² per wind point (max 100, 1/6 of gravity) | About 200 cells drift on a 2 s flight at max |
| Weather Front | 3 rounds | |
| Flight time target | 1.5 to 3.5 s; under 1 s gets bright trail and slow-mo on impact | 02 §5.4 |
| Settle cap | 3 s (360 ticks) | |

### 9.2 Castle and crew

| Item | Start value |
|---|---|
| Block size | 16 x 16 cells |
| Castle grid | Start 6 x 6 (gift); free steps at 1-7 and Grand Fort 2; cap 8 x 10, 80 cells with Footing, Block Budget 72 |
| Nooks | Never fewer than seated Hobs; cap 5 |
| Hobs per battle | 1, 2, 3 in levels 1-1 to 1-6; 4 from 1-7; 5 from Grand Fort 2; cap 5 |
| Hob HP | 100 (class range 80 to 140); no growth with Rank |
| Heartkettle HP | 200, every fort; cracks at 100 |
| Block HP | Wicker 30, Timber 50, Cobble 80, Brassbound 110, Mossbrick 140 [U3], Footing 400 |
| Side support | Wood and brass 2, stone 1; Brace line +2 |
| Steam | 100 per battle, max 40 per turn |
| Walk cost | 1 Steam per 4 cells flat, x2 uphill, x3 mud |
| Thump | over 48 cells drop: 10 to every block and Hob |
| Fall damage | over 32 cells: 10 per 16 cells, max 40. Tumbled: 45 + (fall - 64) / 8, max 70 |
| Crush | 15 per falling block (Cobble x2, Wicker 0); kettle takes 100% |
| Kettle intake | Blast 75%, crush 100%, Pierce 100%; cap 80 per shot |
| The Creaks | Round 10: blocks under 50% HP lose one side reach. Round 12: under 80% |
| Cover rule | 65% taken (35% off) from area payloads centred outside an intact Nook (`cover_pct`) |

### 9.3 Damage and blast bands

| Damage band | Range | Typical use |
|---|---|---|
| Chip | 5 to 12 | Bomblets, rapid-fire pellets, Burn ticks |
| Light | 15 to 25 | Fans, rollers, Patcher glob |
| Standard | 30 to 40 | Plain Shots (Clodpot: 35) |
| Heavy | 50 to 70 | Knacks, big Trick Shells |
| Massive | 90 to 120 | Heavy Trick Shells, boss shots (per-shot cap 110 Thwack; Set Pieces are scripted) |

| Blast band | Radius (cells) | About this many blocks across |
|---|---|---|
| Point | 0 (direct only) | 1 |
| Tiny | 10 | 1 |
| Small | 18 | 2 |
| Medium | 28 | 3 to 4 |
| Large | 42 | 5 |
| Huge | 64 | 8 |

Falloff floor 25%. Near misses must still do at least 8 to blocks or Hobs, so early rounds never feel empty [02 §3.1 lesson 2].

### 9.4 Match and pacing

| Item | Start value |
|---|---|
| Round cap | 15 (levels 8 to 20, 8 only in 1-1; other Grand Forts 18 to 20; Last Level 12 per Stage). Fallback 12 if the slice gate fails (9.6) |
| Round time | About 32 s (player about 20, Rival about 12) |
| Squall warning | "Squall in 3" two rounds before the cap |
| Shove Off | 15 Steam in the Walk step |
| Loophole Flap | One Thread per Loophole per Weather Front |
| Sudden Squall | 3 rounds after the cap, both sides hit at once at each round end: kettle -50, -100, -150; blocks -10, -20, -30; wind +3 at each round start; double pop to more total HP |
| Rummage | pool 10, 4 picks each |
| Knack uses | 2 per battle |
| Doodad slots | 2 |
| Rest | Light 0, Medium 1, Heavy 2; extra Rest cap 1; Match Rest 0 |
| Match bonus | +10% |
| AI think pose | 0.8 to 1.5 s (search target 400 ms p95 on the 2 GB phone) |
| AI resolve cap | 4 s |

**Knack crowd-out guard [audit C30].** Bots report the share of Actions that are Plain Shots; the target is 25% to 40%. If it falls under 20%, every Knack's second use opens at Round 5. Decided now so no doc waits on it.

### 9.5 Economy

See 5.2 and 5.3. Pennants: 138 at launch, 210 in all. Tinker Tree hold 100 at launch (core 56), 172 in all (core 72).

### 9.6 Pacing check (redone at real speed)

This check now runs on the clock, not only on rounds [review 06 G3]. Both reference games ran close to 20 s per shot in our play, with a camera move each turn [02e §2.2, §3.2]. A round here is two shots, so the check uses **about 32 s per round** (player turn about 20 s, Rival turn about 12 s). The damage maths below is unchanged; the minutes are new.

**The problem it fixes.** With the old numbers (Mossbrick 240 healing 24 a turn, Brassbound 180, six Hobs, 400 HP boss kettles) a late fort needed about 1,050 Thwack to break and a typical hand reached about 420 by Round 12. Most late fights would have ended on the Last Bell sum [review 02 §3.4].

**Inputs.** All tuning targets; bots replace them by week 6 [R04 B2].

- **Thwack per Action at standard aim** (from `D01 §7.4`, misses and grazes included): Plain Shot 26, Knack 58, Trick Shell 56. Late, Rank 2 and 3 Quirks lift Knacks and shells to about 62.
- **Win cost**, the cheaper path, usually the kettle:
  - **Mid** (Soggy Bottom Fen, a 7 x 8 Timber and Cobble fort, 4 Rival Hobs): open the Kettle Room face (one Cobble block, 80 / 0.8 = 100 Blast) plus the 300 HP kettle by a mix of about 70% Blast at x0.5 and 30% Pierce at x1.0 (300 / 0.65 = about 460). About **560**.
  - **Late** (The Flats, an 8 x 10 Cobble and Brassbound fort, 5 Rival Hobs): open a thicker Kettle Room (about 200) plus the kettle (about 460). About **660**.
- **Falls.** From Round 3, once walls are cracked, each good hit also drops blocks. Crush lands on blocks, Hobs and the kettle. With stone side support at 1, a late fort drops more per hit than a mid one: falls add about **25%** on a mid fort and **45%** on a late one. Early Wicker forts add none (Wicker deals no crush).
- **Rival repairs.** A mid Rival mends once (about 50). A late Rival mends about every 4 rounds (50 each).
- **Hand.** 4 to 5 Hobs, 2 Knack uses each, 4 Trick Shells. Plain Shots are 25% of Actions, inside the 25% to 40% target.

**Typical player, Fair, one Action per round.** Each cell is the shot's Thwack, plus falls, minus Rival repairs. Bold marks the round the running total passes the win cost.

| Round | Mid: Action | Mid: shot + falls - repair | Mid: total (win at 560) | Late: Action | Late: shot + falls - repair | Late: total (win at 660) |
|---|---|---|---|---|---|---|
| 1 | Plain | 26 + 0 | 26 | Plain | 26 + 0 | 26 |
| 2 | Knack | 58 + 0 | 84 | Knack | 62 + 0 | 88 |
| 3 | Knack | 58 + 14 | 156 | Knack | 62 + 28 | 178 |
| 4 | Shell | 56 + 14 | 226 | Shell | 62 + 28 - 50 | 218 |
| 5 | Plain | 26 + 6 | 258 | Plain | 26 + 12 | 256 |
| 6 | Knack | 58 + 14 - 50 | 280 | Knack | 62 + 28 | 346 |
| 7 | Knack | 58 + 14 | 352 | Shell | 62 + 28 | 436 |
| 8 | Shell | 56 + 14 | 422 | Knack | 62 + 28 - 50 | 476 |
| 9 | Knack | 58 + 14 | 494 | Plain | 26 + 12 | 514 |
| 10 | Plain | 26 + 6 | 526 | Knack | 62 + 28 | 604 |
| 11 | Knack | 58 + 14 | **598** | Shell | 62 + 28 | **694** |
| 12 | Shell | 56 + 14 | 668 | Knack | 62 + 28 - 50 | 734 |

**Result by kind of player.**

| Player | Early (Downs, 3 Hobs, Wicker, win at about 300) | Mid (Fen) | Late (Flats) |
|---|---|---|---|
| Strong hand, good aim (Thwack x1.3) | Round 6 to 7: 3.2 to 3.7 min | Round 8: 4.3 min | Round 9: 4.8 min |
| Typical (table above) | Round 8: 4.3 min | Round 11: 5.9 min | Round 11: 5.9 min |
| Weak aim (Thwack x0.8) | Round 10: 5.3 min | Round 15, then the Squall: 8.0 to 9.1 min | Over the cap: the Squall ends it by round 18: 9.6 min |

So a typical mid and late fight ends by Round 8 to 12 (about 4.3 to 6.4 minutes), and the round cap of 15 is a real edge, not the normal end. At 32 s a round, a weak-aim fight that reaches the Squall runs past the 8 minute rule. That is the case the fallback below exists for. The Rival plays the same sums on your fort, so whichever side is ahead after Round 8 most often wins by a pop, not a score.

**Why it now holds.** Win cost fell from about 1,050 to about 660 on a late fort (flat HP ladder, 5 Hobs, kettle 300, Mossbrick heal down to 7). Rules v5 cut the kettle part again (200 HP, Blast at 75%, crush at 100%: about 240 instead of 460), so Kettle Pop is now a real rival to Clean Sweep; the worked table above still uses the v4 kettle and is kept as the upper bound. Falls now scale with fort size (stone reach 1, crush on the kettle), so bigger forts fall harder instead of standing longer [R04 B1 to B4].

**Sudden Squall check.** Worst case: both kettles still full (200, rules v5) when the cap ends, and no one lands a hit after it.

| Squall round (default round) | Each kettle after the round-end hit | Blocks lost so far (each) | Wind (from 0) |
|---|---|---|---|
| 1 (16) | 150 | 10 | 3 |
| 2 (17) | 50 (cracked: Kettle Room walls weaken and often fall in, which can pop it here) | 30 | 6 |
| 3 (18) | **0: both pop at once; more total HP wins** | 60 | 9 |

- Even with no hits at all, the fight ends at the end of round 18, three rounds after the cap. Any damage dealt earlier only brings the pop sooner.
- Turn order no longer matters: both forts take each Squall hit in the same tick. A double pop goes to the side with more kettle, Hob and block HP left, so kills and standing walls still count at the very end.
- Typical case: kettles near 40% (about 80) at the cap. 80 - 50 - 100 is below 0, so the lower kettle pops at the end of Squall round 2 (round 17).
- After two Squall rounds every Wicker block is gone and Timber is at 20 of 50, so wood forts start to fall at once. Stone stands longer but its Hobs lose Cover as wood wings drop.
- **Worst case on the clock.** Cap 15 plus 3 Squall rounds is 18 rounds: 9.6 minutes at 32 s. Cap 12 plus 3 is 15 rounds: 8.0 minutes. Each Last Level Stage (cap 12) ends by its round 15, so a Stage stays at 8 minutes.
- **Grand Forts** other than the Last Level (cap 18 to 20) can run to round 23: about 12 minutes. Boss fights are allowed to run long, but the slice gate below watches them, and the fallback drops their caps by 3 (to 15 to 17, at most about 10 minutes).

**Slice gates on the clock (vertical slice, then nightly on the 2 GB phone build).**

| Gate | Target | If it fails |
|---|---|---|
| Median seconds per round (player plus Rival) | 32 s or less | First cut camera cuts while aiming, then make 2x Rival resolve the default from 1-5 |
| Battles over 8 minutes (Last Level Stages counted alone, Grand Forts excluded) | under 10% | **Fallback:** default round cap 12, Grand Fort caps minus 3, and raise the fall share to hold the Squall gate |
| Round of the first Bonk | round 4 to 5 | Tune Cover and Hob HP before shell damage |
| Squall share | under 15% (gate below) | As below |

The default cap stays 15 until the slice data says otherwise. Round cap 12 is the planned fallback, not a guess made now.

**Bot gates (week 6 and nightly).** On a late fort: median fight end Round 9 to 12, under 15% of fights reach the Squall, and a good low hit drops about a third of the fort. If the Squall share goes over 15%, tune in this order: falls (support reach, crush), then Kettle Room depth, then Thwack bands. Do not raise kettle HP.

---

## 10. Open questions and risks

### 10.1 Owner decisions (R04 D)

1. **Launch scope.** Four regions, 40 levels, with U1 to U3 as free dated updates. Recommend yes.
2. **Price. Decided:** free, no monetization. No price, no trial, no unlock, no in-app purchases, no ads. All levels, content and updates free (5.5).
3. **Couch Duel. Decided:** ships at launch (6.1).
4. **Orientation. Decided:** portrait and landscape both at launch. The UX and art docs own the layouts.
5. **Audio.** 14 MB full plan with a 2.8 MB boot pack. Recommend yes; raise the cap.
6. **Art. Decided:** final art by human artists; concepts in `docs/art` set the direction.
7. **Camera.** Max zoom 1.25. Recommend yes.
8. **Names.** Trademark search on world, crew and shell names before art production.
9. **Content owner.** One named person holds the counts in the Canonical numbers table and can say no to a 17th launch Hob.
10. **Save sync between web and phone.** Export and import code only at launch, built by the shared core so all three apps read it [04 §8, 04b]. Is that enough?
11. **Age rating target.** 9+ / Everyone 10+ assumed.
12. **Sudden Squall double pop. Decided:** more total HP left wins (2.11).
13. **Wind. Decided:** gentle wind from 1-4, with a Wind off assist (8.1).
14. **First Doodad. Decided:** Mend Bucket and one slot on the 1-9 win.

### 10.2 Questions research could not close

- **Closed by the Mac playtest [02e].** Castle Busters uses a 30 s turn clock (10 s after a miss), has no wind, and breaks a round-cap tie by castle health %. Its 11 gadgets unlock late. None of this changes our rules. Sections 2.3 (aim) and 2.12 (match length) were re-checked and hold: pull-back aim with numbers felt right, and battles ran 4 to 7 minutes. See `PLAN.md` §9.1.
- Real Pocket Tanks power range and self-hit scoring [02c §8]. Its data files are protected, so these stay unconfirmed. We copy the principle only.

### 10.3 Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Collapse looks stiff next to rigid-body games | Collapse is the top fun [02b §15.1] | Deterministic outcome, showy view (creak, lean, staggered drops, dust); week 4 prototype compares a cheap tumbling model; playtest may change the support rule [R04 C1] |
| Fights run long and end in the Squall | Feels like a draw machine | Section 9.6; bot a late fort by week 6; gate: under 15% of fights reach the Squall |
| Rounds take longer than planned | At 32 s a round, a Squall fight passes 8 minutes | Slice gate on median seconds per round (9.6); fallback round cap 12; "Squall in 3" makes the end feel fair, not slow |
| A Loophole Thread repeats from a kept aim | One found line Bonks a Zinger target every two turns | Loophole Flap (2.10), shown on the fort, for both sides |
| Rest plus 5 Hobs feels like bookkeeping | Turns slow down while players count cogs | Cogs on portraits, greyed shots, Match Rest 0, extra Rest cap 1; drop Medium Rest to 0 if tests show friction |
| One Class dominates (one free bomber ruled 90% of Castle Busters lineups) | Kills variety | Pick-rate checks in bots and playtests; every Class has a visible counter [02d §1.6.12] |
| Any Hob firing any shell blurs Classes | Classes feel the same | Plain Shot and Knack stay Class-only; Match bonus; bots track how often a shell is fired by its Match |
| Wind too strong on phones | Blind aim returns | Ranges per region, free forecast and drift readout, Cosy off switch |
| Phone screen too small for 16-cell blocks at full zoom-out | Units unreadable | Auto-frame min zoom 0.6, Lump Rule height cap, art doc sets readable Hob silhouettes at 24 px |
| New players drown by minute 15 | They quit before Region 2 | Five-idea opening, 12 prompt cap, one pre-battle screen; slice test with casual players |
| Frame rate on low-end Android | 30 fps floor at risk with debris | Native OpenGL ES 3.0 view over the shared core; quality tiers, particles over bodies, 80-cell cap [03 §13, 04b] |
| Couch Duel at launch adds work | Schedule | It reuses Skirmish and the sim; new work is the house rules, setup screen, Hand-off card, Starter Box, Table mode, guest slot and Volley Points. Dropping purchases and the unlock gate frees some of that time. Tech plan re-estimates |
| Three native apps | Three UIs and renderers to build and keep in step | One shared Rust core holds every rule, so a rule change lands once; the apps only draw and take input [04b] |
| Scope | Schedule | Launch table in Canonical numbers; about 200 engineer weeks, weeks 48 to 54 with 6 to 7 engineers [04b]; if more than three weeks behind at alpha (week 30), move The Fen to an update and ship three regions; never cut Test Yard or Daily |

---

## Appendix: Parked ideas

Cut for good from the launch plan and all updates [R04 A, review 02 §2.3]. Kept here so the thinking is not lost. Reopening one needs a review note.

| Idea | Why it was parked | What does its job now |
|---|---|---|
| Last Bell tiebreak (Hobs standing, kettle %, integrity %) and the Final Volley | A match that ends on a sum, four steps of rules | Sudden Squall |
| Seat words (Cellar, Loft, Middle, Front, Back, Core, Neighbors) | Seven nouns to say "high is good for lobs" | Loophole height and Cover, through physics |
| Seat Perks and Neighbor Perks | Perks behind words behind nodes | Nothing; placement speaks through physics |
| Scamper stat (Slow, Steady, Quick) | No one feels 16 cells of fall safety | Cushion Loft |
| Scurry (move a Hob as an Action) | A whole Action to move one Hob | The Musical Chairs Doodad, if the weapons doc keeps it |
| Crowded, Perched, Porch, Rattled and Skylight states | Nine states to learn | Five: Open, Fell a floor, Tumbled, Squashed, Bonked |
| Knack tiers at Hob levels 4 and 8 | 56 extra rule variants | Quirk options |
| Ten Hob levels at +1.5% HP each | Six of nine level-ups gave nothing you could see | Three Ranks, each a Quirk pick |
| Tumble skipping the Hob's next shot | A lost turn in a one-Action game | 20 damage and the climb back |
| A buried Loophole bursting the Hob's own shot | Self-harm from a UI miss | The Fire button greys |
| Chill as its own status | A second word for "sits out" | Rest |
| Separate Reload and Chill counts | Two ideas for one cog | Rest, extra cap 1 |
| Trick families and per-Class fire tags; grey cards | Dead cards in hand | Any Hob fires any shell; Match |
| Deny refund of 10 Buttons | A rule for pocket change | Nothing |
| Rarity on Trick Shells | Offline, earned, no gacha: rarity means nothing | Nothing |
| Brisk turn timer | A timer in a game that promises none | Nothing |
| Take Back as its own toggle | One more switch | Part of the Cosy preset |
| Enemy crew hidden after a 2 s Muster at launch | A memory test on a phone | Icons stay shown; hidden crew returns with the Lookout in U2 |
| Mossbrick healing 10% a turn | A Plain Shot did less than nothing | Heal 7, none after a hit |
| Boss kettles at 400 | Longer boss fights for no new idea | Kettle 300 everywhere; phases gate bosses |
| Raid Rehearsal as a mode | A mode for one button | Test Yard Raid button |
| Trick-shot Challenge and Defend a Cart as their own mission types | Two more rule sets | Merged into Puzzle and Escort |
| Last Level in three Stages | 15 to 25 minutes and an empty hand at the end | Two Stages with a crate |
| 40 Daily-only maps | A map set for a mode that is a seeded Skirmish | Daily uses existing maps |
