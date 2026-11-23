# 02. Tech Tree and Progression

Status: revision 2, after the review pass. Date: 2026-11-22. Owner of this doc: systems and economy design.

This doc owns the **Tinker Tree**, Hob Training, castle growth in the **Workshop**, the Buttons and Pennants economy, collections and the unlock pace. It builds on `00-core-game-design.md` (cited as `[00 §N]`), whose **Canonical numbers** table it follows. `[R04 B13]` means `docs/review/04-rulings.md` section B, item 13; `[audit C59]` means row C59 of `docs/review/01-consistency-audit.md`.

The weapons doc (`01`) owns shell and Doodad names and numbers. The crew doc (`03`) owns Hob names, Quirks and join order. The campaign doc (`05`) owns what is new in each level; where the level table here differs from `05`, `05` wins and this table is regenerated from it [audit C57].

Every number here is a tuning target unless it says "fixed". Content carries one release tag: `[Launch]`, `[U1]`, `[U2]` or `[U3]` [R04 A]. Ideas cut for good sit in the appendix "Parked ideas".

---

## Changes in this revision

1. The Tinker Tree is rebuilt into **4 branches** (Aim, Fort, Crew, Kit), **60 nodes**: 36 `[Launch]`, 12 `[U2]`, 12 `[U3]`. Each branch has **one real fork**. It was 6 branches, 77 nodes and 12 choice pairs [R04 B13].
2. Forecast, Rival ghost lines, shot log and drift readout are now free in every battle. Their old nodes (Weathervane, Chalk Line, Shot Log, Drift Tally) are gone [R04 B13].
3. Tiers open on Grand Fort clears: Tiers 1 to 3 at launch, Tier 4 with U2, Tier 5 with U3. The tree opens at level 1-10 [R04 B14].
4. Hob growth is **3 Ranks**, each a Quirk pick; costs 300, 700, 1,500. No HP per level, no Knack tiers [R04 B8].
5. Crew cap is 5, reached at Grand Fort 2 as a free gift. Grid growth that seats the crew is a free gift; start grid 6 x 6 [R04 B3, audit C04].
6. Seat perks, Scurry, Neighbor Perks, Knack Pouch, Captain's Call, Tinker Plans, Cross Training and Kettle Plating are cut or parked [R04 B6, B7].
7. Material HP and costs follow `00`: Wicker 30 (5), Timber 50 (15), Cobble 80 (35), Brassbound 110 (70), Mossbrick 140 (150) [R04 B1].
8. The economy table now covers the 40-level launch campaign (Downs, Crag, Fen, Flats) plus the 20 levels of U2 and U3, and the no-grind-wall check is redone for all six region starts.
9. Earn table merged into one, with the audit lines: Grand Fort 500 + 25 per Pennant, Last Level 1,000 + 25 per Pennant, Trial 100, Daily 60 per calendar day, deny refund removed [audit C59 to C63].
10. Rooms at launch are Nook, Kettle Room and Cushion Loft. Lookout, Decoy Kettle Room, Boiler Loft move to U2, Tool Shed to U3; Snug is parked.
11. Hob joins follow `05` (Hetty 1-7, Dame Flicka 2-8) and the launch roster of 16 [audit C02, R04 A].
12. Mastery and Deeds move to U1. Achievements and cosmetics are tagged.
13. Final verification pass [review 05]: the Kit branch now carries exactly what the weapons doc sources from it (KT-02 Kitchen Drawer with 3 shells, KT-04 Molehill and KT-07 Bellows at launch, KT-09 Scarecrow in U2); the Frost and Sparks shell sets and the second launch set are gone, and three new non-shell nodes fill their slots (Snow Shovel, Swap Shop, Ore Cart). Totals, costs and the core set are unchanged. The recruit table, the Trial side paths and the "New this level" column follow 05 and 03 (Petra is U3, Pip joins at 4-8, Old Thumper at 2-3). Quirk counts follow 03. Mastery uses 6 Deeds per Hob.
14. **Review 06 applied** [review 06 A, B]. New free aim data joins 1.7 and is never a node: Lean Lines, the shimmer on hanging blocks, the "Drop!" callout, Loophole Flap marks, "Squall in 3", "No line" marks and the Rival's wish.
15. **Shove Off** (15 Steam in the Walk step clears a buried Loophole) is a base rule, so Steam now has a third use beside Walk and Steam Shot. CR-13 Dig Out becomes "your first Shove Off each battle costs no Steam" [U3].
16. **Loose shells in 1-3 and 1-4** (Lid Lifter, Bag of Marbles) are lent for one level each. They are not unlocks, so the shell count and the start six at 1-8 do not change (4.4, 6.1).
17. Kit set note: Miner's Lamp (KT-02) is now a Light Digger set-up shell [01 §4.3]. The node text does not change.

---

## 0. Design goals for progression

What research and the reviews tell us to do, and what to avoid:

| Lesson | Source | Rule in this doc |
|---|---|---|
| A long XP wall kills fun. "You rarely unlock something new" | `01 §3` ShellShock Live | No player XP. Something new every level (section 6) |
| Paid or grind power ruins fairness | `01 §4`, `02b §15`, `02d §1.6.2` | Nothing sold changes a battle. All power comes from play |
| A rework that cut levels and rewards caused 215 of 495 reviews to turn angry | `02d §1.4`, `02d §1.6.1` | Earned progress never goes down (section 7) |
| Upgrade timers and gold walls made players quit | `01 §6`, `02b §15` | Instant buys, no timers, first clears alone pay for the par build |
| A star tree that changes how towers play is loved; about 30 upgrades, each felt | `01 §12` Kingdom Rush, review 02 §3.6 | 36 nodes at launch. Nodes change behavior. Pure +2% nodes do not exist |
| A tree that sells the UI back breaks pillar 2 | review 02 §3.6, R04 B13 | Readouts are free. The tree sells verbs, reach and fort shape |
| Choices only count if you must pick | review 02 §3.6 | One real fork per branch. Respec stays free, so forks are about play style, not lock-in |

**Progress tracks (four, all earned only by play):**

1. **Tinker Tree**, bought with **Pennants**. Changes how you play. Free respec.
2. **Hob Training**, bought with **Buttons**. Three Ranks, each a **Quirk** pick. No stat growth.
3. **Workshop**: castle size, materials and rooms. Blocks bought with Buttons.
4. **Collections**: achievements, cosmetics, and Mastery from U1. No power at all.

---

## 1. Tinker Tree

### 1.1 Rules

- **Currency.** Pennants. Spending a Pennant on a node does not destroy it: a respec gives it all back. Think of Pennants as points you place.
- **Four branches** [R04 B13]: **Aim** (`AM`), **Fort** (`FT`), **Crew** (`CR`), **Kit** (`KT`, shells, Doodads and Steam). 15 nodes per branch, 60 in all.
- **Tiers 1 to 5. Beat Grand Fort N, open Tier N** (fixed rule: a progress gate, not a grind gate).

| Tier | Opens | Tag | Nodes per branch | Node costs | Max hold per branch | Core per branch |
|---|---|---|---|---|---|---|
| 1 | Grand Fort 1 clear (level 1-10) | [Launch] | 3 | 1, 1, 2 | 4 | 4 (all) |
| 2 | Grand Fort 2 clear (level 2-10) | [Launch] | 3: one node and the fork pair | 3, fork 3 or 3 | 6 | 6 (fork either side) |
| 3 | Grand Fort 3 clear (level 3-10) | [Launch] | 3 | 4, 5, 6 | 15 | 4 (the 4-cost node) |
| 4 | Grand Fort 4 clear (level 4-10, the Baron) | [U2] | 3 | 2, 3, 4 | 9 | 2 |
| 5 | Grand Fort 5 clear (level 5-10) | [U3] | 3 | 2, 3, 4 | 9 | 2 |

- **Needs.** A node needs the node(s) in its "Needs" column. "A or B" means either one.
- **The fork (pick 1 of 2).** Each branch has one fork, in Tier 2. You hold only one side. The two sides are two ways to play, so neither is strictly better. Swap for free outside battle.
- **Totals.** Holding every node you can at once (one side of each fork) costs **100 Pennants at launch** and **172** with all tiers. The **core set** (marked C) costs **56 at launch** and **72** with all tiers. Pennants in the game: **138 at launch**, 144 with U1, 177 with U2, **210** with U3 [00 Canonical numbers].
- **Core set** means the nodes level design assumes for "par" tuning on Fair. No level needs any node to win (fixed rule, `00 §3` Grind). Bots prove this (section 4.7).
- **Free respec (fixed).** Outside battle you may refund one node (and anything that needs it), a branch, or the whole tree. No cost, no cooldown, no limit. Refunds are 100%. The UX doc's "Untinker" button sits on every owned node [audit C52].
- **First visit.** When the tree opens at 1-10, all three Tier 1 nodes of every branch are buyable. The first visit spotlights **Trick Sight**, a node that changes the very next shot [audit C58].
- **Try first.** Every node, including both sides of each fork, can be switched on in the **Test Yard** for free.
- **No paid readouts (fixed).** No node sells information the HUD already has: forecast, Rival ghost lines, shot log and drift readout are free [R04 B13, section 1.7].
- **Ironclad** [U2] ignores preview-length nodes (Long Sight, Eagle Sight). All other nodes work there.
- **Rivals** do not use the Tinker Tree. The enemies doc gives Rivals a short table of fixed perks, shown on the Rival card [audit C56].

### 1.2 Tree diagram

Arrows show "Needs". `[a | b]` is the fork. `C` marks the core set.

```
TIER       T1 (after GF1)            T2 (after GF2)                      T3 (after GF3)                T4 [U2]                 T5 [U3]

AIM
           AM-01 C Trick Sight --+-> [AM-05a Dead Eye | AM-05b Spotter's Eye] -> AM-07 Called Shot
           AM-03 C Bracket Ring -+                                          -> AM-09 C Lookout Post -> AM-10 Tattletale Chalk
           AM-02 C Long Sight -----> AM-04 C Eagle Sight ------------------+-> AM-06 C Ricochet ----> AM-14 Pinpoint (U3)
                                                                         +-> AM-08 Gust Rider
           (U2: AM-11 Ice Line needs AM-01.  U3: AM-12 C Bank Sight needs AM-01, AM-13 Lodestar needs any Aim T4)

FORT
           FT-01 C Wider Footing -+-> FT-04 C Brass Forge ---------------+-> FT-08 Pop-Up Wall
           FT-02 C Stacker -------+                                      +-> FT-11 Frost Mortar (U2), FT-12 C Mossbrick Kiln (U3), FT-13 Ground Wire (U3)
                          |
                          +--------------------------------------------> FT-06 C Grand Keep ---> FT-14 Pit Props (U3)
           FT-03 C Braces -------> [FT-05a Spring Bricks | FT-05b Rubble Catch] -> FT-07 Counterweight
           (U2: FT-09 C Decoy Kettle needs any Fort T3, FT-10 Ice Footing needs FT-09)

CREW
           CR-01 C Bench Call ---+-> CR-04 C Buddy Shot -----------------> CR-06 C Pep Talk
           CR-03 C Rally Horn ---+-> [CR-05a Brave Face | CR-05b Many Hands] -> CR-07 Hot Streak
                    |
                    +---------------------------------------------------> CR-08 Last Stand
           CR-02 C Hard Hats ------------------------------------------------------------------------> CR-11 Sled Run (U2)
           (U2: CR-09 C Mittens, CR-10 Scout's Honor.  U3: CR-12 C Rubber Boots, CR-13 Dig Out, CR-14 Second Call needs CR-01)

KIT
           KT-01 C Free Hand ----+-> KT-04 C Molehill -----------------+-> KT-07 Bellows
                                 |                                      +-------------------------> KT-09 C Scarecrow (U2), KT-14 Tool Shed (U3)
                                 +-> [KT-05a Spare Pocket | KT-05b Double Up]
           KT-02 C Kitchen Drawer -------------------------------------------------------------------> KT-12 C Swap Shop (U3)
           KT-03 C Bigger Boiler ----------------------------------------> KT-06 C Stomp ------------> KT-10 Snow Shovel (U2)
                                 +-------------------------------------> KT-08 Steam Shot
                                 +-----------------------------------------------------------> KT-11 Boiler Loft (U2), KT-13 Ore Cart (U3)
```

### 1.3 Nodes: Aim (AM)

Theme: read the field, then nail it [00 §1.2 pillar 2]. Aim help grows as new ways to shape and read a shot, never as auto-aim and never as a paid readout.

| ID | Name | Tag | Tier | Cost | Core | Needs | Effect | Why it is fun |
|---|---|---|---|---|---|---|---|---|
| AM-01 | Trick Sight | [Launch] | 1 | 1 | C | none | After the first trigger point (bounce, split, roll), the preview draws one more leg at half opacity, 20% of arc length | Bouncers and splitters stop being dice. The first-visit spotlight |
| AM-02 | Long Sight | [Launch] | 1 | 1 | C | none | Preview grows from 30% to 45% of the arc [00 §2.4] | Longer lobs become plannable |
| AM-03 | Bracket Ring | [Launch] | 1 | 2 | C | none | After a miss, a ring marks the landing and a tick on the power bar shows the power that would have hit dead centre with no wind | Teaches the old artillery craft of bracketing |
| AM-04 | Eagle Sight | [Launch] | 2 | 3 | C | AM-02 | Preview grows from 45% to 60% | Long lobs over hills become a plan, not a hope |
| AM-05a | Dead Eye | [Launch] | 2 | 3 | C (fork) | AM-01 or AM-03 | **Fork.** Your preview is 15 points shorter. Point hits (the shell body touches a Hob or the kettle) deal +25% and get Skill Factor +0.5. Per-shot caps still apply | The ace build. High risk, loud payoff, big Scores |
| AM-05b | Spotter's Eye | [Launch] | 2 | 3 | C (fork) | AM-01 or AM-03 | **Fork.** A hit on an enemy Nook wall makes that Nook **Spotted** until the end of your next turn. Your shells that pass within 2 blocks of a Spotted Nook bend 1 block toward it, once per shell | The team build: crack with one Hob, strike with the next [audit C20] |
| AM-06 | Ricochet | [Launch] | 3 | 4 | C | AM-04 | Your point shots that strike Rock, Footing or Brassbound at under 30 degrees glance off once at half damage. The preview shows the glance | Bank a Hatpin off the Footing into a Loophole |
| AM-07 | Called Shot | [Launch] | 3 | 5 | | AM-05a or AM-05b | Before you fire, tap a block or Hob to call it. If the shot's first hit is within 1 block of the call, it deals +20% and Skill Factor +0.5 | Say it, then do it. Pure bragging rights with teeth |
| AM-08 | Gust Rider | [Launch] | 3 | 6 | | AM-04 | At wind 5 or more, your Light shots take half wind | The Flats bellows and storm levels become your weather |
| AM-09 | Lookout Post | [U2] | 4 | 2 | C | any Aim T3 | Unlocks the **Lookout** room (1 x 1, top row). While it stands, one hidden enemy Nook flashes its Class icon at the start of your turn | Hidden crew returns in U2; a room worth guarding |
| AM-10 | Tattletale Chalk | [U2] | 4 | 3 | | AM-09 | A hit on an enemy Nook wall reveals that Nook (Class, HP) for 2 enemy turns | Every wall hit is also a scouting shot |
| AM-11 | Ice Line | [U2] | 4 | 4 | | AM-01 | On Ice, the preview for rollers and skippers runs on to where they stop | Frozen lakes become bowling lanes |
| AM-12 | Bank Sight | [U3] | 5 | 2 | C | AM-01 | The preview shows one bounce off a cave ceiling or Rock | Mines ceilings become a second sky |
| AM-13 | Lodestar | [U3] | 5 | 3 | | any Aim T4 | Your Guided shells turn 1 block farther | Seekers find crew around corners |
| AM-14 | Pinpoint | [U3] | 5 | 4 | | AM-06 or AM-07 | A point shot that Threads a Loophole deals +15% (inside the full-HP clamp) | The Zinger's final polish |

### 1.4 Nodes: Fort (FT)

Theme: your castle, your plan [pillar 4]. Size, materials and clever shapes. Grid steps that seat the crew are free gifts (section 3.2); Fort nodes add room beyond them.

| ID | Name | Tag | Tier | Cost | Core | Needs | Effect | Why it is fun |
|---|---|---|---|---|---|---|---|---|
| FT-01 | Wider Footing | [Launch] | 1 | 1 | C | none | Grid +1 wide (cap 8) | Room for a wing beside the Kettle Room |
| FT-02 | Stacker | [Launch] | 1 | 1 | C | none | Grid +1 tall. Roof and cap shapes (cosmetic) no longer count toward the Block Budget | Tall forts, and room to dress them |
| FT-03 | Braces | [Launch] | 1 | 2 | C | none | Unlocks the **Brace**: a half-block diagonal in any material (half HP, half cost). Side support along its line reaches 2 blocks further [00 §2.7] | Overhangs and jutting Nooks, even in stone. Also a weak point Rivals learn to aim at |
| FT-04 | Brass Forge | [Launch] | 2 | 3 | C | FT-01 or FT-02 | Unlocks **Brassbound** blocks | Strong walls that still hold wings like wood |
| FT-05a | Spring Bricks | [Launch] | 2 | 3 | C (fork) | FT-03 | **Fork.** Mark up to 3 blocks as Spring Bricks in the Workshop. The first shell to hit each one bounces back along a mirror path at 60% speed, then the brick turns normal | Return fire with the Rival's own shell. Pure slapstick |
| FT-05b | Rubble Catch | [Launch] | 2 | 3 | C (fork) | FT-03 | **Fork.** Your falling chunks deal half crush to your own Hobs and kettle. Chunks that land outside your castle leave a Clay mound 1 block high | Your own collapse builds you a wall |
| FT-06 | Grand Keep | [Launch] | 3 | 4 | C | FT-02 | Grid +1 tall (to the 8 x 10 cap) | Full size. Room for five Nooks and a real fort |
| FT-07 | Counterweight | [Launch] | 3 | 5 | | FT-05a or FT-05b | Each of your chunks that lands outside your castle rolls toward the Rival as a roller: Light, 20 Blast, Small blast | When your fort falls, it falls on them |
| FT-08 | Pop-Up Wall | [Launch] | 3 | 6 | | FT-04 | Once per battle, during your Walk, raise a Timber wall 1 block wide and 2 tall on the ground within 3 blocks of your front. It is yours: your shots pass it, theirs do not | A wall out of nowhere stops the roller that was about to win |
| FT-09 | Decoy Kettle | [U2] | 4 | 2 | C | any Fort T3 | Unlocks the **Decoy Kettle Room** (2 x 2). It glows through walls like the real one. The first hit pops it and shows it as fake. The AI sees the same two glows you would [audit C76] | Bluff the Rival, honestly |
| FT-10 | Ice Footing | [U2] | 4 | 3 | | FT-09 | Rollers and bouncers that touch your Footing slide 1 block back toward the Rival | Bouncers bounce off your doorstep |
| FT-11 | Frost Mortar | [U2] | 4 | 4 | | FT-04 | Your Cobble cannot be Brittle | Answer the Frost Rivals of the Heights |
| FT-12 | Mossbrick Kiln | [U3] | 5 | 2 | C | FT-04 | Unlocks **Mossbrick** blocks | The top material and the late Button goal |
| FT-13 | Ground Wire | [U3] | 5 | 3 | | FT-04 | Zap that chains through your Brassbound stops after 1 block | Brass forts stop being Zap traps |
| FT-14 | Pit Props | [U3] | 5 | 4 | | FT-06 | Your castle ignores Thump | Dig-outs and drops lose their sting |

### 1.5 Nodes: Crew (CR)

Theme: the Hob is the weapon [00 §2.9]. Bench, tempo and team play. Crew size is not sold: the fourth and fifth seats are campaign gifts [R04 B3].

| ID | Name | Tag | Tier | Cost | Core | Needs | Effect | Why it is fun |
|---|---|---|---|---|---|---|---|---|
| CR-01 | Bench Call | [Launch] | 1 | 1 | C | none | Once per battle, as your Action, swap a seated Hob (not Bonked) for one on your bench. The new Hob arrives at full HP with Rest 0 | The bench matters. Answer the Rival you saw in the Muster |
| CR-02 | Hard Hats | [Launch] | 1 | 1 | C | none | A Hob of yours that Fell a floor or is Squashed takes half damage and gets up with Rest 0 | When your fort falls, your crew comes up swinging |
| CR-03 | Rally Horn | [Launch] | 1 | 2 | C | none | When one of your Hobs is Bonked, every other Hob of yours drops to Rest 0 | Losing a friend sets up a full counter punch |
| CR-04 | Buddy Shot | [Launch] | 2 | 3 | C | CR-01 or CR-03 | Once per battle, as your Action, two Hobs fire their Plain Shots on one aim; the second fires at 4 less power. Both rest 1 | Two pots, one turn. Bracket in a single go |
| CR-05a | Brave Face | [Launch] | 2 | 3 | C (fork) | CR-03 | **Fork.** A Hob under 30% HP deals +25% and its shots have 1 less Rest | Comebacks. A hurt Hob is a scary Hob |
| CR-05b | Many Hands | [Launch] | 2 | 3 | C (fork) | CR-03 | **Fork.** A Hob that has not fired for 2 of your turns fires its next shot one Weight lighter (Heavy to Medium, Medium to Light) | Rotate the whole crew and Heavy shots come round fast |
| CR-06 | Pep Talk | [Launch] | 3 | 4 | C | CR-04 | Once per battle, at your turn start, clear one Hob's Rest | Your best Hob, twice in a row, when it counts |
| CR-07 | Hot Streak | [Launch] | 3 | 5 | | CR-05a or CR-05b | When your shot Bonks an enemy Hob, the Hob that fired has Rest 0 and its next shot deals +10% | Momentum you can feel |
| CR-08 | Last Stand | [Launch] | 3 | 6 | | CR-03 | When you have 1 Hob left, every shot it fires has Rest 0 and deals +25% | The last Hob standing is the most dangerous one |
| CR-09 | Mittens | [U2] | 4 | 2 | C | any Crew T3 | Your Hobs ignore the extra Rest from Frost | The Heights cannot slow you down |
| CR-10 | Scout's Honor | [U2] | 4 | 3 | | any Crew T3 | After your Lookout reveals a Hob, your next shot at that Hob deals +15% | Scout, then strike |
| CR-11 | Sled Run | [U2] | 4 | 4 | | CR-02 | A Tumbled Hob of yours takes 10, not 20, and climbs into the free Nook you pick | Tumbles become repositioning |
| CR-12 | Rubber Boots | [U3] | 5 | 2 | C | any Crew T4 | Your Hobs take half Zap | Brass forts stop being death traps |
| CR-13 | Dig Out | [U3] | 5 | 3 | | any Crew T4 | Your first Shove Off each battle costs no Steam [00 §2.7] | Cave-ins in the Mines cost you nothing |
| CR-14 | Second Call | [U3] | 5 | 4 | | CR-01 | Bench Call works twice per battle | Two answers from the bench |

### 1.6 Nodes: Kit (KT)

Theme: shells, gadgets and Steam, the toys you bring [00 §2.14, 00 §2.15]. One Shell Set adds Trick Shells to your Rummage pool and three nodes unlock Doodads; the weapons doc names and sources them [01 §4, §5]. Steam is never sold. Steam has three uses in every battle: Walk, Shove Off (15, to clear a buried Loophole [00 §2.7]) and, with KT-08, Steam Shot (15). Bigger Boiler is worth more now that a burial costs Steam, not a turn.

| ID | Name | Tag | Tier | Cost | Core | Needs | Effect | Why it is fun |
|---|---|---|---|---|---|---|---|---|
| KT-01 | Free Hand | [Launch] | 1 | 1 | C | none | The first Doodad you use each battle does not cost your Action | Patch and shoot in one turn. Doodads get used, not hoarded |
| KT-02 | Shell Set: Kitchen Drawer | [Launch] | 1 | 1 | C | none | Adds 3 Trick Shells to your pool: Dinner Gong, Miner's Lamp, Grandfather Clod [01 §4] | New toys at once |
| KT-03 | Bigger Boiler | [Launch] | 1 | 2 | C | none | Steam per battle 100 to 130 | One more good Walk per battle |
| KT-04 | Molehill | [Launch] | 2 | 3 | C | KT-01 | Unlocks the **Molehill** Doodad (the weapons doc owns its numbers) | Diggers and rollers now fear your front yard |
| KT-05a | Spare Pocket | [Launch] | 2 | 3 | C (fork) | KT-01 or KT-02 | **Fork.** After the Rummage, take 1 of the 2 leftover shells. Hand 4 to 5 | The shell player: one more surprise per battle |
| KT-05b | Double Up | [Launch] | 2 | 3 | C (fork) | KT-01 or KT-02 | **Fork.** The Doodad in slot 1 has 2 uses | The gadget player: bring your favourite twice |
| KT-06 | Stomp | [Launch] | 3 | 4 | C | KT-03 | During your Walk, spend 15 Steam to stomp a ditch 2 blocks wide and 1 deep in front of your castle (Loam, Mud, Clay only). Rollers and bouncers stop in it | Terraform as defence. Counters the Flats rollers |
| KT-07 | Bellows | [Launch] | 3 | 5 | | KT-04 | Unlocks the **Bellows** Doodad: set wind to any value from -5 to +5 for the rest of this Weather Front | Make your own weather on storm levels and against the Flats bellows |
| KT-08 | Steam Shot | [Launch] | 3 | 6 | | KT-03 | Spend 15 Steam on a shot: +10% launch speed for that shot. Power still reads 0 to 100; a steam badge shows [audit C53] | Reach far forts, find new arcs over tall hills |
| KT-09 | Scarecrow | [U2] | 4 | 2 | C | KT-04 | Unlocks the **Scarecrow** Doodad: a dummy Hob in an empty Nook. The Rival sees it as a Hob of the Class you pick until it is hit once. The AI reads it exactly as a player would [audit C76] | Hidden crew returns in U2; waste the Rival's big shot on straw |
| KT-10 | Snow Shovel | [U2] | 4 | 3 | | KT-06 | Stomp also works on snow and Ice. A Stomp ditch in Ice fills with water, so rollers sink in it | Dig a moat in the frozen lake |
| KT-11 | Boiler Loft | [U2] | 4 | 4 | | KT-03 | Unlocks the **Boiler Loft** room (2 x 1): +30 Steam while it stands. If it breaks, you lose 15 Steam | A fuel tank with a weak spot |
| KT-12 | Swap Shop | [U3] | 5 | 2 | C | KT-02 | After the Rummage, you may swap one of your Trick Shells for one of the 2 leftovers | One last look at the draft |
| KT-13 | Ore Cart | [U3] | 5 | 3 | | KT-03 | Walking along a mine rail costs half Steam | The Mines rails become your road |
| KT-14 | Tool Shed | [U3] | 5 | 4 | | KT-04 | Unlocks the **Tool Shed** room (1 x 1): a 3rd Doodad slot. If the Shed breaks before use, that slot's Doodad is lost | More gadgets, and a target Rivals want to hit |

### 1.7 Free aim data (not in the tree)

Pillar 2 says the player gets the data. These were nodes in the last draft and are now free in every battle, on every preset [R04 B13, 00 §2.4]:

| Free feature | Was node | What it does |
|---|---|---|
| Forecast | Weathervane | Shows the next Weather Front's wind for the whole current front |
| Rival ghost lines | Chalk Line | The Rival's last 2 shots leave full ghost lines; tap one for its angle and power |
| Shot log | Shot Log | Your last 6 shots from any Hob, with the wind each was fired in. Each entry can be Recalled once |
| Drift readout | Drift Tally | The preview tip shows how many blocks wind moves the shell by its first impact |
| Lean Lines | none (new) | Hold any block on either fort to see, by dashed outline, which blocks would fall if it broke [00 §2.4] |
| Shimmer | none (new) | Rival blocks that hang at the end of their support reach shine softly while you aim |
| "Drop!" callout | none (new) | The first collapse of 4 or more blocks from one shot gets a callout; the shot log tags every such shot "drop" |
| Loophole Flap marks | none (new) | A flapped Loophole shows its flap and the rounds left in the front [00 §2.10] |
| "Squall in 3" | none (new) | A countdown banner two rounds before the round cap [00 §2.11] |
| "No line" marks | none (new) | Pre-battle marks on Hobs whose Plain Shot cannot reach the enemy on this map [00 §4.2] |
| The Rival's wish | none (new) | The Rival pins the shell it wants before the first Rummage pick [00 §2.15] |

None of these may ever become a node, a Quirk or a reward. They are pillar 2.

### 1.8 Tree checks

| Check | Result |
|---|---|
| Node count | 60: 36 [Launch], 12 [U2], 12 [U3]. 15 per branch |
| Forks | 4, one per branch, all in Tier 2 so they shape two full regions at launch |
| Max hold cost | Launch 100 (25 per branch). All tiers 172 (43 per branch) |
| Core set cost | Launch 56 (14 per branch). All tiers 72 (18 per branch) |
| Core cost per tier | T1 16, T2 24, T3 16, T4 8, T5 8 |
| Core open vs Pennants at 2 per level, no Trials | After 1-10: 16 of 20. After 2-10: 40 of 40. After 3-10: 56 of 60. After 4-10: 64 of 80. After 5-10: 72 of 100. Always affordable |
| Max hold vs Pennants | Launch: 100 of 138 (72%). All: 172 of 210 (82%). A typical player holds the whole launch tree only near the end of The Flats, so picks matter on the way |
| First buy | Trick Sight, a verb, not a number |
| Paid readouts | None |
| Pure stat nodes | None alone. The few number nodes (Long Sight, Eagle Sight, Bigger Boiler) change what you can see or reach, and each sits next to a node that adds a verb |
| Power for money | None. No node or Pennant is sold |

---

## 2. Crew progression

### 2.1 Ranks and Training

Hobs grow only through **Training** with Buttons [00 §4.4]. No battle XP, so no Hob ever needs to be farmed. Training is instant. A Hob has **3 Ranks** above its join state [R04 B8].

| Rank | Buttons for this step | Total | What it gives |
|---|---|---|---|
| 0 | | 0 | Base kit: Plain Shot, Knack (2 uses) |
| 1 | 300 | 300 | **Quirk 1**: pick 1 of 2. First hat band |
| 2 | 700 | 1,000 | **Quirk 2**: pick 1 of 2. Second hat band |
| 3 | 1,500 | 2,500 | **Quirk 3**: pick 1 of 2. Third hat band and brass coat buttons |

**Training opens at level 2-2**, after the opening region has taught the core [R04 B14].

**No stat growth (fixed).** Ranks add no HP and no damage. Knacks have no tiers; the best old tier ideas are now Quirk options in the crew doc. A Rank 0 Hob in skilled hands beats a Rank 3 Hob in careless ones.

**Quirks** change behavior, not size. Ranks 1 and 2 each offer a Class pair; Rank 3 offers one Class Quirk or the Hob's own Knack Quirk. At launch that is 35 Class Quirks (7 Classes) and 16 Knack Quirks [03 §5.2]. The crew doc owns them. Swaps are free, any time outside battle.

**Late-recruit rule (fixed).** A Hob that joins after Region 1 joins at the Rank of your fifth-highest Hob, free. A new Hob is never dead weight, and no one trains a Hob from scratch to field a full crew [03 §5.1].

**Training is never lost.** Ranks and Quirks stay through any patch. If a patch weakens a Hob, the Buttons spent on it are refunded in full and its Ranks stay (section 7).

**Old saves.** A pre-revision save maps old Hob levels to Ranks: levels 1 to 2 to Rank 0, 3 to 5 to Rank 1, 6 to 8 to Rank 2, 9 to 10 to Rank 3, and any Buttons spent past the new Rank's total are refunded (section 7.2).

### 2.2 Crew size and Nooks

| Stage | Hobs per battle | Nooks | Source |
|---|---|---|---|
| 1-1 | 1 | 1 or more | Start grid 6 x 6 (gift) |
| 1-2 and 1-3 | 2 | 2 or more | Same grid |
| 1-4 to 1-6 | 3 | 3 or more | Same grid holds the Kettle Room and 3 walled Nooks |
| 1-7 on | 4 | 4 or more | Free grid step with the fourth seat [audit C04] |
| Grand Fort 2 clear on | 5 (cap) | 5 | Free grid step and fifth seat, a region gift [R04 B3] |

Fixed rules: Nooks are never fewer than seated Hobs; Hobs per battle is the lower of the crew cap and your Nooks; levels may set fewer (puzzle levels); every fort must pass the Workshop validator [00 §2.7]. Rival crews never outgrow the player's cap at that point in the campaign.

### 2.3 Recruit schedule

28 Hobs in all; **16 at launch** in 7 Classes [R04 A]. Join levels follow the campaign doc, so each Rescue level frees a real Hob [audit C02]. The crew doc owns names and order.

| Region | Tag | Levels where a Hob joins | New | Running total | Classes owned |
|---|---|---|---|---|---|
| 1 Puddingstone Downs | [Launch] | Marge 1-1, Miss Quill 1-2, Jax 1-4, Grub 1-6, Hetty 1-7, Bobbin 1-8 | 6 | 6 | 6 |
| 2 Crag End | [Launch] | Edna 2-1, Old Thumper 2-3, Dame Flicka 2-8 (rescued), Nan (Trial 3 path, or 2-10 if skipped) | 4 | 10 | 7 (from 2-1) |
| 3 Soggy Bottom Fen | [Launch] | Skip 3-1, Nurse Plumley 3-3, Ginger 3-5, Truffle 3-7 (rescued), Walt 3-9 | 5 | 15 | 7 |
| 4 The Flats | [Launch] | Pip 4-8 (rescued); the last stretch tests the crew you have | 1 | 16 | 7 |
| Long Siege | [U1] | Gus and Tacks as first-run wave milestones | 2 | 18 | 7 |
| 5 Nithering Heights | [U2] | Aunty Nip 5-1, Winkle 5-3, Dotty 5-5, Olive 5-7, Tansy 5-8, with the Lookout Class | 5 | 23 | 8 |
| 6 Wheal Clank | [U3] | Wick 6-1, Bartleby 6-3, Lady Carom 6-4, Petra 6-6 (rescued), Ernest 6-9 | 5 | 28 | 8 |

The split follows the crew doc [03 §3.0, §3.9]. Update join levels are working suggestions until each update is built [05 §6.4]. Rule: no Hob may be missable.

### 2.4 Hob Mastery [U1]

Mastery is a play track per Hob, built on **Deeds** (small feats with that Hob, 6 per Hob) [03 §5.3]. It costs nothing and gives no power. It ships with U1: 108 hand-written Deeds for the 18 Hobs out by then, and each later Hob brings its own six [review 02 §2.3].

| Rank | Deeds done | Reward |
|---|---|---|
| Green | 1 | Portrait frame |
| Handy | 2 | Hat (an Outfit) |
| Seasoned | 3 | Shot trail colour and a second bark set |
| Proud | 5 | Gold thread hat trim, a cheer, and a title on its Nook card |
| Legend | 6 | Keepsake statue on the Curio Shelf and an Almanac story page |

Deeds count in any mode and on any difficulty except the Test Yard. No Deed needs a loss, a wait or a big count.

---

## 3. Castle progression

### 3.1 Materials

| Material | Tag | Unlock | When | HP | Cost per block | Side support |
|---|---|---|---|---|---|---|
| **Wicker** | [Launch] | Start | Level 1-1 | 30 | 5 | 2 |
| **Timber** | [Launch] | Workshop | Level 1-6 | 50 | 15 | 2 |
| **Cobble** | [Launch] | Workshop gift of 3 blocks | Level 1-6 | 80 | 35 | 1 |
| **Brassbound** | [Launch] | FT-04 Brass Forge | Tier 2, after Grand Fort 2 | 110 | 70 | 2 |
| **Mossbrick** | [U3] | FT-12 Mossbrick Kiln | Tier 5, after Grand Fort 5 | 140 | 150 | 1 |
| **Footing** | [Launch] | Always | Fixed | 400 | free | n/a |

HP, cost and quirks are from `00 §2.8`. The Brace shape (FT-03) costs half the block price in any material.

**Block Stock (fixed rule).** Buttons buy blocks into your **Stock**, not into one castle. Every Blueprint draws from the same Stock, since only one castle fights at a time. Editing a Blueprint costs nothing. You can sell blocks back for 100% at any time [00 §5.3]. The starter castle's blocks are a gift and sit in Stock from level 1-1.

### 3.2 Workshop capacity by stage

The grid sets how much castle you may have. **Block Budget** = grid cells above the Footing row. Rooms use their cells from the budget, so more crew means fewer walls. That trade-off is a design goal. Gifts come from the campaign; nodes are optional extras [R04 B3].

| Stage | When | Grid (wide x tall) | Block Budget | Nooks | Typical rooms | Solid blocks (about) |
|---|---|---|---|---|---|---|
| Start | 1-1 (Workshop opens 1-6) | 6 x 6 (gift) | 30 | 3 | Kettle Room, 3 Nooks | 14 |
| Crew of 4 | 1-7 | 7 x 7 (gift) | 42 | 4 | Kettle Room, 4 Nooks | 20 |
| Tier 1 | after 1-10 | up to 8 x 8 (Wider Footing, Stacker) | 56 | 4 | Kettle Room, 4 Nooks | 30 |
| Crew of 5 | after 2-10 | +1 tall (gift): up to 8 x 9 | 64 | 5 | Kettle Room, 5 Nooks, Cushion Loft | 34 |
| Full | after 3-10 | 8 x 10 (Grand Keep) | 72 | 5 | Kettle Room, 5 Nooks, Cushion Loft, a spare room | 40 |

Without any node a player ends at 7 x 8 (Block Budget 49), which is enough for 5 walled Nooks; no level needs more. Hard cap: 80 grid cells including Footing; the Workshop shows `x / 72` [audit C65]. The Workshop validator proves each gift grid holds its crew before the gift ships.

### 3.3 Room types

| Room | Tag | Size | Unlock | Max | Effect |
|---|---|---|---|---|---|
| **Nook** | [Launch] | 2 x 2 | Start | Seated Hobs, cap 5 | Holds 1 Hob. Loophole faces the Rival [00 §2.7] |
| **Kettle Room** | [Launch] | 2 x 2 | Start | 1 (fixed) | Holds the Heartkettle. Must start covered on every outer face |
| **Cushion Loft** | [Launch] | 2 x 1 | Grand Fort 2 | 2 | A Hob that falls through it takes no fall damage and is never Tumbled |
| **Lookout** | [U2] | 1 x 1, top row only | AM-09 | 1 | One hidden enemy Nook flashes its Class each of your turns |
| **Decoy Kettle Room** | [U2] | 2 x 2 | FT-09 | 1 | A fake glow. Pops on first hit |
| **Boiler Loft** | [U2] | 2 x 1 | KT-11 | 1 | +30 Steam; lose 15 if it breaks |
| **Tool Shed** | [U3] | 1 x 1 | KT-14 | 1 | 3rd Doodad slot; that Doodad is lost if the Shed breaks first |

Every room except the Kettle Room is optional. Every room is a target. The enemies doc lists which Rival archetypes carry which rooms, so the player learns each one by facing it [audit C56].

### 3.4 Blueprint slots

| When | Slots |
|---|---|
| Level 1-6 (Workshop opens) | 2 |
| Grand Fort 2 | 3 |
| Grand Fort 3 | 4 |
| Grand Fort 4 (the Last Level) | 5 (cap, `00 §4.4`) |

Each Blueprint saves layout and seating. **Studio Plans**: each region gives 2 ready-made example Blueprints that teach a style (tall sniper tower, low bunker). They do not use slots. Blueprints export as a text code, so players can swap forts.

---

## 4. Economy model

### 4.1 Earn rates

The single earn table for every doc [audit C63]. Same values as `00 §5.2`.

| Event | Tag | Buttons | Pennants |
|---|---|---|---|
| Level, first clear | [Launch] | 200 + 25 per Pennant (225 to 275) | 1 to 3 |
| Grand Fort, first clear | [Launch] | 500 + 25 per Pennant (525 to 575) | 1 to 3 |
| Last Level, first clear | [Launch] | 1,000 + 25 per Pennant (1,025 to 1,075) | 1 to 3 |
| Replay win | [Launch] | 80 + 10 per new Pennant | any missing goals |
| Grand Fort replay win | [Launch] | 150 + 10 per new Pennant | any missing goals |
| Loss (also "Leave it" after a resume) | [Launch] | 40 | 0 |
| Trial, first clear | [Launch] | 100 | up to 3 |
| Daily Dust-up, first clear each calendar day | [Launch] | 60 (back dates pay nothing) | 0 |
| Test Yard Raid, first win | [Launch] | 50, once | 0 |
| Long Siege | [U1] | 10 per wave, max 200 per run | 0 |
| Ironclad level, first clear | [U2] | 100 | 1 Iron Pennant (cosmetic) |
| Baron Rush Bronze | [U3] | 500, once | 0 |

**Pennant goals** are tracked one by one. Earn the win today, "Kettle above 50%" next week. Goals never need a hard difficulty [00 §8.1].

**Trials**: 10 in all, worth 30 Pennants. Side paths per the campaign doc [05 §5.1]. Launch: 6, after 1-8 (T1), 1-9 (T2), 2-6 (T3), 2-8 (T4), 3-5 (T5), 4-4 (T6). U1: 2, after 1-10 (T7) and 4-8 (T8). U2: 1, after 5-8 (T9). U3: 1, after 6-5 (T10).

### 4.2 Sinks

| Sink | Size | Purpose |
|---|---|---|
| Blocks (into Stock) | Par castle 320 (Region 2) to 2,400 (Region 6). Full Mossbrick castle about 6,000 [U3] | Main sink, refundable |
| Hob Training | 2,500 per Hob to Rank 3. Par: 5 Hobs at Rank 2 by the Last Level = 5,000 | Main sink |
| Decor | 20 to 500 each: flags, roof caps, paint, Stomper styles, Curio stands | Endless, cosmetic, for spare Buttons [02d §1.4] |
| Training the full roster | Launch 16 x 2,500 = 40,000. All 28 = 70,000 | Long tail for fans. Never needed |

No sink takes away anything earned. No sink has a timer.

### 4.3 Player models

- **Floor**: wins each level once with 1 Pennant, no losses, no Trials. The worst case.
- **Typical**: Pennants per first clear 2.6 (Region 1) falling to 2.2 (Region 4), 2.1 (Heights) and 2.0 (Mines); losses 0.2 to 0.8 per level; Trials taken with 2 of 3 Pennants.
- **Max**: 3 Pennants everywhere plus all Trials.

### 4.4 Level by level table

Buttons and Pennants per level for the typical player, with floor and max for checks. "+T" marks a level with a Trial on its side path (its Pennants and Buttons are in that row). "Tier open" is the highest tier open after that level. "Core cost open" is the cost of core nodes in all opened tiers. Hours count retries, menus and the Workshop. "New this level" lists economy items and a few rule beats; `05` owns the full list and wins where they differ.

Rows 1 to 40 are the launch campaign. The U1 Trials at 1-10 and 4-8 add 200 Buttons and about 4 Pennants to the running totals from those rows on; a launch-only player has 138 max Pennants after 4-10, not 144.

| Lvl | Code | Tag | Kind | Buttons (typ) | Cum Buttons (typ) | Cum Buttons (floor) | Pennants (typ) | Cum Pennants (typ) | Cum at 2 per level | Cum max | Tier open | Core cost open | Hours (typ) | New this level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1-1 | [Launch] | Level | 273 | 273 | 225 | 2.6 | 3 | 2 | 3 | none | 0 | 0.1 | Marge (Lobber) joins. Aim Drag, Fire, Ghost, Pin |
| 2 | 1-2 | [Launch] | Level | 273 | 546 | 450 | 2.6 | 5 | 4 | 6 | none | 0 | 0.1 | Miss Quill (Zinger) joins. Pick a Hob, Fine Tune |
| 3 | 1-3 | [Launch] | Level | 273 | 819 | 675 | 2.6 | 8 | 6 | 9 | none | 0 | 0.2 | Kettle Pop. Loose Lid Lifter lent for the level (not an unlock) |
| 4 | 1-4 | [Launch] | Level | 273 | 1,092 | 900 | 2.6 | 10 | 8 | 12 | none | 0 | 0.3 | Jax (Scatterjack) joins. Wind and forecast. Loose Bag of Marbles lent for the level (not an unlock) |
| 5 | 1-5 | [Launch] | Level | 273 | 1,365 | 1,125 | 2.6 | 13 | 10 | 15 | none | 0 | 0.3 | First Knack, Rest cog. Skirmish opens |
| 6 | 1-6 | [Launch] | Level | 273 | 1,638 | 1,350 | 2.6 | 16 | 12 | 18 | none | 0 | 0.4 | Grub (Digger) joins. Workshop: Wicker, Timber, 3 Cobble gift. 2 Blueprints. Test Yard. First Rival habit |
| 7 | 1-7 | [Launch] | Level | 273 | 1,911 | 1,575 | 2.6 | 18 | 14 | 21 | none | 0 | 0.5 | Hetty (Patcher) rescued. Crew of 4, free grid step |
| 8 | 1-8 | [Launch] | Level +T | 373 | 2,284 | 1,800 | 4.6 | 23 | 16 | 27 | none | 0 | 0.6 | Bobbin (Bouncer) joins. Rummage: start six Trick Shells, pool of 4. Trial 1 (+1 Trick Shell) |
| 9 | 1-9 | [Launch] | Level +T | 373 | 2,657 | 2,025 | 4.6 | 27 | 18 | 33 | none | 0 | 0.6 | Walk and Steam. Tumblestones. +2 Trick Shells. Trial 2 (+1 Trick Shell). Win: Mend Bucket, Doodad slot 1 |
| 10 | 1-10 | [Launch] | Grand Fort +T [U1] | 673 | 3,330 | 2,550 | 4.6 | 32 | 20 | 39 | T1 | 16 | 0.7 | Grand Fort 1. Tinker Tree, Tier 1 (Kitchen Drawer set: +3 Trick Shells). Daily. +1 Trick Shell. [U1] Trial 7 |
| 11 | 2-1 | [Launch] | Level | 276 | 3,606 | 2,775 | 2.4 | 34 | 22 | 42 | T1 | 16 | 0.9 | Edna (Stoker) joins: all 7 Classes. Fire on Timber. Doodad slot 2 and Pot Lid |
| 12 | 2-2 | [Launch] | Level | 276 | 3,882 | 3,000 | 2.4 | 37 | 24 | 45 | T1 | 16 | 1.0 | Thump. Training opens (Rank 1). +1 Trick Shell |
| 13 | 2-3 | [Launch] | Level | 276 | 4,158 | 3,225 | 2.4 | 39 | 26 | 48 | T1 | 16 | 1.1 | Old Thumper (Lobber) joins. First Puzzle |
| 14 | 2-4 | [Launch] | Level | 276 | 4,434 | 3,450 | 2.4 | 42 | 28 | 51 | T1 | 16 | 1.2 | Dig through Clay. Wind line |
| 15 | 2-5 | [Launch] | Level | 276 | 4,710 | 3,675 | 2.4 | 44 | 30 | 54 | T1 | 16 | 1.3 | First Demolition. Chain collapse. +1 Trick Shell |
| 16 | 2-6 | [Launch] | Level +T | 376 | 5,086 | 3,900 | 4.4 | 48 | 32 | 60 | T1 | 16 | 1.5 | Butting Goats. Trial 3 (+1 Trick Shell; Nan joins on its path) |
| 17 | 2-7 | [Launch] | Level | 276 | 5,362 | 4,125 | 2.4 | 51 | 34 | 63 | T1 | 16 | 1.6 | A long Walk as a choice. Mini-boss on the map. Coal Scuttle (Doodad). +1 Trick Shell |
| 18 | 2-8 | [Launch] | Level +T | 376 | 5,738 | 4,350 | 4.4 | 55 | 36 | 69 | T1 | 16 | 1.7 | Dame Flicka (Zinger) rescued. Trial 4 (+1 Trick Shell) |
| 19 | 2-9 | [Launch] | Level | 276 | 6,014 | 4,575 | 2.4 | 58 | 38 | 72 | T1 | 16 | 1.8 | No new rule. A Rival that closes in |
| 20 | 2-10 | [Launch] | Grand Fort | 576 | 6,590 | 5,100 | 2.4 | 60 | 40 | 75 | T2 | 40 | 2.0 | Grand Fort 2. Tier 2. Crew of 5, free grid step. Cushion Loft. 3 Blueprints. +1 Trick Shell |
| 21 | 3-1 | [Launch] | Level | 278 | 6,868 | 5,325 | 2.3 | 62 | 42 | 78 | T2 | 40 | 2.1 | Skip (Bouncer) joins. Water, Mud, Soaked |
| 22 | 3-2 | [Launch] | Level | 278 | 7,146 | 5,550 | 2.3 | 65 | 44 | 81 | T2 | 40 | 2.2 | Burp Vents. +1 Trick Shell |
| 23 | 3-3 | [Launch] | Level | 278 | 7,424 | 5,775 | 2.3 | 67 | 46 | 84 | T2 | 40 | 2.3 | Nurse Plumley (Patcher) joins. A moving target |
| 24 | 3-4 | [Launch] | Level | 278 | 7,702 | 6,000 | 2.3 | 69 | 48 | 87 | T2 | 40 | 2.5 | Skipping shots (Puzzle) |
| 25 | 3-5 | [Launch] | Level +T | 378 | 8,080 | 6,225 | 4.3 | 74 | 50 | 93 | T2 | 40 | 2.6 | Ginger (Scatterjack) joins. Tide. +1 Trick Shell. Trial 5 (+1 Trick Shell) |
| 26 | 3-6 | [Launch] | Level | 278 | 8,358 | 6,450 | 2.3 | 76 | 52 | 96 | T2 | 40 | 2.7 | First Brassbound (pumps). Smelling Salts (Doodad) |
| 27 | 3-7 | [Launch] | Level | 278 | 8,636 | 6,675 | 2.3 | 78 | 54 | 99 | T2 | 40 | 2.9 | Truffle (Digger) rescued. Fog Bank, Marsh Gas |
| 28 | 3-8 | [Launch] | Level | 278 | 8,914 | 6,900 | 2.3 | 80 | 56 | 102 | T2 | 40 | 3.0 | Sink Mud, raising ground. +1 Trick Shell |
| 29 | 3-9 | [Launch] | Level | 278 | 9,192 | 7,125 | 2.3 | 83 | 58 | 105 | T2 | 40 | 3.1 | Walt (Stoker) joins: 15 Hobs. No new rule |
| 30 | 3-10 | [Launch] | Grand Fort | 578 | 9,770 | 7,650 | 2.3 | 85 | 60 | 108 | T3 | 56 | 3.3 | Grand Fort 3. Tier 3. 4 Blueprints. +1 Trick Shell. [U1] Long Siege |
| 31 | 4-1 | [Launch] | Level | 283 | 10,053 | 7,875 | 2.2 | 87 | 62 | 111 | T3 | 56 | 3.4 | Hoisted Hills, mound shells as cover |
| 32 | 4-2 | [Launch] | Level | 283 | 10,336 | 8,100 | 2.2 | 89 | 64 | 114 | T3 | 56 | 3.6 | Big Ethel. Rival crews of 5. +1 Trick Shell |
| 33 | 4-3 | [Launch] | Level | 283 | 10,619 | 8,325 | 2.2 | 92 | 66 | 117 | T3 | 56 | 3.7 | Stampers. Weathercock (Doodad) |
| 34 | 4-4 | [Launch] | Level +T | 383 | 11,002 | 8,550 | 4.2 | 96 | 68 | 123 | T3 | 56 | 3.9 | Chain of drops (Puzzle). Trial 6 (+1 Trick Shell) |
| 35 | 4-5 | [Launch] | Level | 283 | 11,285 | 8,775 | 2.2 | 98 | 70 | 126 | T3 | 56 | 4.0 | Bellows Towers. +1 Trick Shell |
| 36 | 4-6 | [Launch] | Level | 283 | 11,568 | 9,000 | 2.2 | 100 | 72 | 129 | T3 | 56 | 4.2 | The Square Gate: Steward Plumb as a Rival |
| 37 | 4-7 | [Launch] | Level | 283 | 11,851 | 9,225 | 2.2 | 102 | 74 | 132 | T3 | 56 | 4.3 | The Ironing Board. +1 Trick Shell |
| 38 | 4-8 | [Launch] | Level +T [U1] | 383 | 12,234 | 9,450 | 4.2 | 107 | 76 | 138 | T3 | 56 | 4.5 | Pip (Lobber) rescued: all 16 launch Hobs. [U1] Trial 8 |
| 39 | 4-9 | [Launch] | Level | 283 | 12,517 | 9,675 | 2.2 | 109 | 78 | 141 | T3 | 56 | 4.6 | No new rule. Hazards as allies |
| 40 | 4-10 | [Launch] | Grand Fort | 1,095 | 13,612 | 10,700 | 2.2 | 111 | 80 | 144 | T4 | 64 | 4.8 | The Last Level (2 Stages). Ending. 5 Blueprints. +1 Trick Shell. Tier 4 waits for U2 |
| 41 | 5-1 | [U2] | Level | 280 | 13,892 | 10,925 | 2.1 | 113 | 82 | 147 | T4 | 64 | 5.0 | Heights open. Aunty Nip (Stoker) joins. Tier 4. Frost, Brittle, Ice, hidden crew. Ironclad opens for cleared regions. +1 Trick Shell |
| 42 | 5-2 | [U2] | Level | 280 | 14,172 | 11,150 | 2.1 | 115 | 84 | 150 | T4 | 64 | 5.1 | Strong wind. +1 Trick Shell |
| 43 | 5-3 | [U2] | Level | 280 | 14,452 | 11,375 | 2.1 | 117 | 86 | 153 | T4 | 64 | 5.2 | Winkle (Lookout) joins: Lookout Class. Escort, Long maps. +1 Trick Shell |
| 44 | 5-4 | [U2] | Level | 280 | 14,732 | 11,600 | 2.1 | 119 | 88 | 156 | T4 | 64 | 5.4 | Icicle Racks (Puzzle) |
| 45 | 5-5 | [U2] | Level | 280 | 15,012 | 11,825 | 2.1 | 122 | 90 | 159 | T4 | 64 | 5.6 | Dotty (Scatterjack) joins. Thin Ice, Thaw. +1 Trick Shell |
| 46 | 5-6 | [U2] | Level | 280 | 15,292 | 12,050 | 2.1 | 124 | 92 | 162 | T4 | 64 | 5.7 | Sliding forts. +1 Trick Shell |
| 47 | 5-7 | [U2] | Level | 280 | 15,572 | 12,275 | 2.1 | 126 | 94 | 165 | T4 | 64 | 5.8 | Olive (Lookout) joins. Chimney Cough (Doodad). +1 Trick Shell |
| 48 | 5-8 | [U2] | Level +T [U2] | 380 | 15,952 | 12,500 | 4.1 | 130 | 96 | 171 | T4 | 64 | 6.0 | Tansy (Lookout) joins. Avalanche Slopes. +1 Trick Shell. Trial 9 (+1 Trick Shell) |
| 49 | 5-9 | [U2] | Level | 280 | 16,232 | 12,725 | 2.1 | 132 | 98 | 174 | T4 | 64 | 6.1 | Blizzard. +1 Trick Shell |
| 50 | 5-10 | [U2] | Grand Fort | 580 | 16,812 | 13,250 | 2.1 | 134 | 100 | 177 | T5 | 72 | 6.3 | Grand Fort 5. Tier 5 waits for U3. +1 Trick Shell |
| 51 | 6-1 | [U3] | Level | 282 | 17,094 | 13,475 | 2.0 | 136 | 102 | 180 | T5 | 72 | 6.4 | Mines open. Wick (Zinger) joins. Tier 5. Zap, Mossbrick, Stalactites. +1 Trick Shell |
| 52 | 6-2 | [U3] | Level | 282 | 17,376 | 13,700 | 2.0 | 138 | 104 | 183 | T5 | 72 | 6.6 | Lodestones. +1 Trick Shell |
| 53 | 6-3 | [U3] | Level | 282 | 17,658 | 13,925 | 2.0 | 140 | 106 | 186 | T5 | 72 | 6.7 | Bartleby (Lobber) joins. Mine Carts. +1 Trick Shell |
| 54 | 6-4 | [U3] | Level | 282 | 17,940 | 14,150 | 2.0 | 142 | 108 | 189 | T5 | 72 | 6.9 | Lady Carom (Bouncer) joins. Draughts (Puzzle). +1 Trick Shell |
| 55 | 6-5 | [U3] | Level +T [U3] | 382 | 18,322 | 14,375 | 4.0 | 146 | 110 | 195 | T5 | 72 | 7.0 | Lava. Trial 10 (+1 Trick Shell) |
| 56 | 6-6 | [U3] | Level | 282 | 18,604 | 14,600 | 2.0 | 148 | 112 | 198 | T5 | 72 | 7.2 | Petra (Digger) rescued. Gas Pockets. +1 Trick Shell |
| 57 | 6-7 | [U3] | Level | 282 | 18,886 | 14,825 | 2.0 | 150 | 114 | 201 | T5 | 72 | 7.3 | Zap chains (Puzzle). Lightning Rod (Doodad) |
| 58 | 6-8 | [U3] | Level | 282 | 19,168 | 15,050 | 2.0 | 152 | 116 | 204 | T5 | 72 | 7.5 | King of the Hill. +1 Trick Shell |
| 59 | 6-9 | [U3] | Level | 282 | 19,450 | 15,275 | 2.0 | 154 | 118 | 207 | T5 | 72 | 7.6 | Ernest (Zinger) joins. A roof-hung fort. +1 Trick Shell |
| 60 | 6-10 | [U3] | Grand Fort | 582 | 20,032 | 15,800 | 2.0 | 156 | 120 | 210 | T5 | 72 | 7.8 | Grand Fort 6. +1 Trick Shell. Baron Rush. Where Was I? and Homecoming Hat from its Bronze clear |

### 4.5 Target completion time

| Goal | Typical time |
|---|---|
| Region 1 | about 40 min |
| Launch campaign, first clears (40 levels) | about 5 hours |
| All 138 launch Pennants | 8 to 10 hours |
| Full campaign with U2 and U3 (60 levels) | about 7 to 8 hours |
| All 210 Pennants | 12 to 14 hours [audit C66] |
| Everything: Ironclad, all achievements, Seasoned Mastery on 8 Hobs | 25 to 30 hours |
| Side modes (Daily, Skirmish, Couch Duel, Long Siege, Baron Rush) | Open ended. Couch Duel pays nothing and changes no progress [00 §6.1] |

### 4.6 No grind wall check

**Par build** is what level design tunes "par" against: the core Tinker set for the tiers open, the par castle and par Training below. The check: income from first clears at the **floor** must cover the par build at the start of each region. No replays, no Daily, no Trials.

| Region start | Tag | Par castle (blocks x avg cost) | Par Training | Par total | Floor income so far | Typical income so far | Floor margin |
|---|---|---|---|---|---|---|---|
| R1 Downs (1-1) | [Launch] | Starter castle, free | 0 | 0 | 0 | 0 | ok |
| R2 Crag (2-1) | [Launch] | 16 x 20 = 320 | 0 (Training opens at 2-2) | 320 | 2,550 | 3,330 | +697% |
| R3 Fen (3-1) | [Launch] | 22 x 25 = 550 | 5 at Rank 1, 2 of them at Rank 2 = 2,900 | 3,450 | 5,100 | 6,590 | +48% |
| R4 Flats (4-1) | [Launch] | 36 x 45 = 1,620 | 5 at Rank 2 = 5,000 | 6,620 | 7,650 | 9,770 | +16% |
| R5 Heights (5-1) | [U2] | 40 x 50 = 2,000 | 4 at Rank 2, 1 at Rank 3 = 6,500 | 8,500 | 10,700 | 13,612 | +26% |
| R6 Mines (6-1) | [U3] | 40 x 60 = 2,400 | 3 at Rank 2, 2 at Rank 3 = 8,000 | 10,400 | 13,250 | 16,812 | +27% |

The tightest gate is The Flats at +16%. It still clears with no replays. A Rank 1 crew with a Cobble fort beats every Flats level on Fair; the par build is a tuning line, not a wall.

**Pennant check.** A player who earns 2 per level and skips every Trial has 78 Pennants before the Last Level. The launch core costs 56 and the whole launch tree 100. A floor player (1 per level) has 39 there and holds the Tier 1 core and most of Tier 2; that is fine because no level needs any node.

**Result: no grind wall.** Every gate the floor player meets, launch and both updates, is passable on first clears alone.

### 4.7 No XP gate check

| Possible gate | Our rule |
|---|---|
| Player level or account XP | Does not exist |
| Hob XP from battles | Does not exist. Hobs grow by Training only |
| Pennant count to open a region | Does not exist. Beat the Grand Fort, open the next region. A 1-Pennant run moves on |
| Tinker tiers | Open on Grand Fort clears, never by Pennants held |
| Crew size and grid | Free campaign gifts at 1-7 and Grand Fort 2, never nodes |
| Level needs an upgrade | Never (fixed). Bots run every level on Fair with the **floor build** (no nodes, gift grids grown with floor income, Rank 0 Hobs) and must win at least 1 in 3 tries with expert aim [04 §14] |
| Hard difficulty for a goal | Never [00 §8.1] |

Bot gates for each build (tuning targets):

| Build | Bot aim | Win rate on Fair |
|---|---|---|
| Floor build | Expert | 35% or more |
| Par build | Typical | 60% to 80% |
| Max build | Typical | 85% or less (the max build must not trivialize) |

The same bots report the Squall share per level; over 15% opens a tuning ticket [00 §9.6].

### 4.8 Replay rewards rules

1. Replay is always free and always one tap. "Same again" keeps last picks [00 §4.2].
2. A replay win pays 80 Buttons (150 for a Grand Fort) plus 10 per new Pennant. Losses pay 40.
3. No daily cap, no decay, no energy. A replay pays the same on the 100th go.
4. Missing Pennant goals can be earned one at a time on any replay, any difficulty.
5. Replaying never risks anything: no Pennant, level, block or Hob can be lost.
6. Farm rate is low on purpose (about 900 Buttons per hour) and never needed (section 4.6). It is a way to buy decor or Mossbrick sooner, not a way through.
7. After 3 losses on a level, the result card offers a hint: a suggested Hob, shell, or Studio Plan, after the "what broke you" replay. Never a paid skip, because none exists.

---

## 5. Collections and goals

### 5.1 Achievements (40)

Rewards are cosmetic. No achievement asks for more than 50 of anything, and none needs a hard difficulty unless it is about that mode. 35 ship at launch.

| # | Name | Tag | How | Reward |
|---|---|---|---|---|
| 1 | First Bonk | [Launch] | Bonk your first Hob | Banner: Snooze Balloon |
| 2 | Kettle Popper | [Launch] | Win by Kettle Pop | Hat: kettle lid |
| 3 | Clean Sweeper | [Launch] | Win by Clean Sweep | Banner: broom |
| 4 | Lumpy Again | [Launch] | Clear Puddingstone Downs | Castle skin: Mossy Wicker |
| 5 | Cliffhanger | [Launch] | Clear Crag End | Castle skin: Chalky Timber |
| 6 | Wet Feet | [Launch] | Clear Soggy Bottom Fen | Castle skin: Reedy Cobble |
| 7 | The Unflattener | [Launch] | Beat Baron Levelwell | Castle skin: Patchwork Hills, banner: Baron's roller |
| 8 | Frostbitten | [U2] | Clear Nithering Heights | Castle skin: Frosted Brass |
| 9 | Deep Digger | [U3] | Clear Wheal Clank | Castle skin: Sooty Mossbrick |
| 10 | Pennant Pole | [Launch] | Earn 100 Pennants | Tall flag pole |
| 11 | Full Hoist | [Launch] | Earn every Pennant released so far | Gold flag pole |
| 12 | Brick by Brick | [Launch] | Own 25 blocks of every material | Hat: hod |
| 13 | Architect | [Launch] | Fill all 5 Blueprint slots | Stomper style: drafting compass |
| 14 | House Proud | [Launch] | Win with a Blueprint you built from scratch, no Studio Plan | Banner: trowel |
| 15 | Full Crew | [Launch] | Bring 5 Hobs into one battle | Hat: party crown |
| 16 | Old Friends | [Launch] | Train any Hob to Rank 3 | Coat: brass buttons for all Hobs of that Class |
| 17 | Quirky | [Launch] | Pick a Quirk on 8 different Hobs | Hat: feather |
| 18 | Domino | [Launch] | Collapse 10 blocks with one shot | Banner: dominoes |
| 19 | Long Bomb | [Launch] | Hit a target 1,600 cells away | Trail: comet |
| 20 | Bank Shot | [Launch] | Win with a hit after 3 bounces | Hat: ball cap |
| 21 | Through the Wall | [Launch] | Bonk a Hob with a beam through 2 blocks | Trail: needle |
| 22 | Wet Blanket | [Launch] | Put out a Burn with water | Hat: sou'wester |
| 23 | Shatter | [U2] | Break a Brittle block with a Blast | Banner: snowflake crack |
| 24 | Pothole | [Launch] | Make the Rival castle Thump | Stomper style: spring legs |
| 25 | Nimble | [Launch] | Walk 1,000 cells in one battle | Stomper style: boots |
| 26 | Ditch Digger | [Launch] | Stop a roller with a Stomp ditch | Hat: miner's lamp |
| 27 | Mirror Mirror | [Launch] | Hit the Rival with its own shell (Spring Bricks) | Banner: mirror |
| 28 | Lid On | [Launch] | Bounce a Rival shell off your Pot Lid | Hat: saucepan |
| 29 | Dud Day | [Launch] | Win a battle in which you fired a Dud | Hat: jester cap |
| 30 | Perfect Match | [Launch] | Fire 25 Trick Shells with their Match Class | Banner: matchstick |
| 31 | Fork in the Road | [Launch] | Win with each side of one fork | Banner: arch |
| 32 | Try Everything | [Launch] | Test every Tinker node once in the Test Yard | Test Yard dummy skin |
| 33 | Weathered | [Launch] | Win during a Sudden Squall | Hat: storm hood |
| 34 | Down to the Wire | [Launch] | Win in the third Squall round | Trail: fireworks |
| 35 | Untouched | [Launch] | Win with no Hob of yours hit | Banner: halo |
| 36 | Speedy | [Launch] | Win by Round 4 | Hat: winged cap |
| 37 | Trial and Error | [Launch] | Clear every Trial released so far | Curio: puzzle box |
| 38 | Daily Habit | [Launch] | Play 7 Daily Dust-ups (any days, not in a row) | Banner: calendar |
| 39 | Siege Weary | [U1] | Clear wave 15 of Long Siege | Castle skin: Battle-scarred |
| 40 | Iron Will | [U2] | Clear any region on Ironclad | Castle skin: Ironclad Rivets |

No achievement needs streaks or days in a row (no daily pressure [00 §5.4]). Once earned, "released so far" achievements stay earned when updates add more.

### 5.2 Cosmetics earned by play

| Kind | At launch | With all updates | Earned by |
|---|---|---|---|
| **Banners** (castle flag) | 16 | 24 | Achievements, each Grand Fort, Trials |
| **Castle skins** | 6 | 12 | Regions, Baron, Long Siege, Ironclad |
| **Hob hats** | 12 | 44 | Achievements, Trials; Mastery rank Handy from U1 (28) |
| **Shot trails** | 4 | 34 | Achievements; Mastery rank Seasoned from U1 (28) |
| **Stomper styles** | 4 | 6 | Achievements |
| **Curio Shelf Keepsakes** | 5 (4 Grand Forts, the Puzzle Box for all Trials released) | 13 | Grand Forts, all Trials, Long Siege waves 5, 10, 20, 30, Ironclad, Baron Rush [05 §5] |
| **Mastery statues** | 0 | 28 | Mastery rank Legend [U1] |

All are **Outfits** in `00` terms. None is sold at launch. None changes a hitbox, a silhouette size or any number. The art doc keeps hats inside the Hob's readable outline.

### 5.3 Almanac and stats

The Almanac fills as you see things: each Hob, shell, Doodad, Rival and room gets a card with a looping clip [00 §4.4]. Local stats (opt-in, never sent): favourite Hob, best shot, longest hit, total blocks broken. These feed achievements, and Mastery from U1.

---

## 6. Unlock pacing chart

### 6.1 By region

| Region | Tag | Levels | Tinker | Hobs (Classes new) | Castle | Shells and Doodads | Modes | Map feature | Cosmetic |
|---|---|---|---|---|---|---|---|---|---|
| 1 Puddingstone Downs | [Launch] | 1-1 to 1-10 | Tree opens at 1-10, Tier 1 (12 nodes) | 6 (Lobber, Zinger, Scatterjack, Digger, Patcher, Bouncer) | Workshop at 1-6: Wicker, Timber, Cobble; 2 Blueprints; grid 6 x 6, then 7 x 7 at 1-7 | Rummage at 1-8 with the start six; +2 from levels, +1 at the Grand Fort, +2 from Trials; Kitchen Drawer (+3) once the tree opens; 1 Doodad (Mend Bucket, on the 1-9 win) | Skirmish (1-5), Test Yard (1-6), Trials (1-8), Daily (1-10) | Grass hills, first wind | Mossy Wicker |
| 2 Crag End | [Launch] | 2-1 to 2-10 | Tier 2 after 2-10 (12 nodes, 4 forks) | 4 (Stoker new): all 7 launch Classes from 2-1 | Training at 2-2; Cushion Loft, 3 Blueprints, crew of 5 at 2-10 | +4 shells, +2 from Trials; 2 Doodads (Pot Lid, Coal Scuttle) | | Cliffs, Clay, Thump, Burn | Chalky Timber |
| 3 Soggy Bottom Fen | [Launch] | 3-1 to 3-10 | Tier 3 after 3-10 (12 nodes) | 5: 15 Hobs by 3-9 | Brassbound (Tier 2); 4 Blueprints | +4 shells, +1 from a Trial; 1 Doodad (Smelling Salts) | Long Siege [U1] after 3-10 | Mud, water, Soaked, patches | Reedy Cobble |
| 4 The Flats | [Launch] | 4-1 to 4-10 | Tier 3 in use; grid to 8 x 10 | 1 (Pip, rescued at 4-8): all 16 | 5 Blueprints after 4-10 | +4 shells, +1 from a Trial; 1 Doodad (Weathercock) | | Raise-ground levels; the Baron's rollers; the Last Level in 2 Stages | Patchwork Hills |
| 5 Nithering Heights | [U2] | 5-1 to 5-10 | Tier 4 (12 nodes) after 4-10 | 5 (Lookout new) | Lookout, Decoy Kettle, Boiler Loft | +10 shells (Frost); 2 Doodads (Chimney Cough, Scarecrow) | Ironclad | Ice, strong wind, Frost, hidden crew | Frosted Brass |
| 6 Wheal Clank | [U3] | 6-1 to 6-10 | Tier 5 (12 nodes) after 5-10 | 5 | Mossbrick, Tool Shed | +10 shells (Zap; one from Baron Rush); 2 Doodads (Lightning Rod, Where Was I?) | Baron Rush | Caves, tunnels, Zap | Sooty Mossbrick |

**Trick Shell count at launch: 30** (the loose shells lent in 1-3 and 1-4 are start-six shells, not extra unlocks) = 6 when the Rummage opens at 1-8, 11 from levels, 1 per Grand Fort (4), 6 from Trials and 3 from the Kitchen Drawer set (KT-02). U1 adds 8 (6 from Long Siege waves, 2 from Trials); U2 adds 10 (9 from Heights levels and its Grand Fort, 1 from a Trial); U3 adds 10 (8 from Mines levels and its Grand Fort, 1 from a Trial, 1 from Baron Rush). The weapons doc owns the list [01 §4].

**Doodads at launch: 8** = 5 from campaign levels (Mend Bucket on the 1-9 win, Pot Lid at 2-1, Coal Scuttle at 2-7, Smelling Salts at 3-6, Weathercock at 4-3), Molehill (KT-04) and Bellows (KT-07) from the Kit branch, and Musical Chairs for beating 5 different Rivals in Skirmish. U1 adds Jack Screws and Spare Spring (Long Siege), U2 Chimney Cough and Scarecrow (KT-09), U3 Lightning Rod and Where Was I? (Baron Rush) [01 §5].

### 6.2 Every session shows something new

The "New this level" column of the table in 4.4 lists something new for each of the 60 levels. A session of 1 or 2 battles (`00 §4.3`) always ends on something new to try:

| Kind of "new" | How often |
|---|---|
| New Hob | About every 2 levels through Region 3, and in each update region |
| New Trick Shell or Shell Set | About every 2 levels |
| New Tinker tier | Every Grand Fort clear; Pennants to spend after almost every level from 1-10 |
| New room, material or Blueprint slot | About every 5 levels |
| New map feature or Rival habit | Every 2 to 3 levels (campaign doc) |
| Something to buy with Buttons | Every level from 2-2: a block upgrade, a Training step or decor |

Rule for the campaign doc: no two levels in a row may have an empty "new" cell.

---

## 7. Rules that protect players

### 7.1 Never reduce earned progress (fixed)

1. Pennants, Iron Pennants, Buttons, Hob Ranks, Quirks, Mastery, blocks in Stock, unlocks, achievements and cosmetics never go down because of a patch, a bug fix or a balance pass.
2. If a patch makes a node, Hob, shell, Doodad or material weaker, the player gets: a free respec of the tree, the Buttons spent on that thing refunded in full (Training and blocks stay too), and a line in the patch notes. If a number must drop, we refund; we never quietly cut [02d §1.6.1, 02b §17.8].
3. If a cost goes up, what you own stays owned. If a cost goes down, you get the difference back.
4. If a Pennant goal changes, earned Pennants stay. If it gets easier, nothing is taken. If a level is removed, its Pennants stay as **Legacy Pennants** that still count and spend.
5. If a node's needs or tier change, nodes you hold keep working until you respec them yourself.
6. Changing difficulty never costs Pennants or progress [00 §8.1].
7. Nothing is ever sold. The game is free with no monetization, so no purchase exists to grant Pennants, Buttons, Hobs, nodes, shells or blocks [00 §5.5].
8. Every update ships plain patch notes in game, and progress changes are listed first [02d §1.6.13].

### 7.2 Save migration rules

Built on `04 §8`:

1. The save stores content **ids** (`AM-07`, `hob.lobber.2`, `mat.cobble`), never list positions.
2. The tree is stored as the set of held node ids. Pennants held = earned minus spent, worked out on load, so a bad save cannot make Pennants vanish.
3. Earned Pennants are stored per level per goal, so the total can always be rebuilt.
4. Each schema bump adds one pure `migrate_N_to_N+1` function. A sample save for each old schema lives in the repo and CI loads every one [04 §8, 04 §14].
5. A renamed node, Hob or shell gets an alias in a migration table. A removed one is refunded at its highest past cost (Pennants or Buttons). A split node grants both halves. Pre-revision tree saves (six branches) refund every node and keep all Pennants; pre-revision Hob levels map to Ranks as in section 2.1.
6. A save from a newer app is never loaded and never overwritten. The player is told to update.
7. A/B save slots and checksums. A crash can cost one turn at most, never progress [00 §3].
8. Export and import as a text code. Importing an older save runs the migration chain.
9. Content is never gated by a purchase, so a lost save never loses access to any region or mode. Only earned progress lives in the save.

### 7.3 Respec is free (fixed)

| Thing | Respec rule |
|---|---|
| Tinker Tree | Free, any time outside battle, any number of times. Node with its children, branch or whole tree. 100% refund |
| Forks | Swap sides for free |
| Quirks | Swap for free |
| Blueprints and seating | Edit for free |
| Blocks | Sell back for 100% |
| Doodad and Rummage choices | Set on the pre-battle screen, free; last picks kept |
| Hob Training | Not refundable by choice (it is never lost, and has no wrong pick). Refunded in full if a patch weakens that Hob |
| Long Siege run boons [U1] | Fixed for that run; the run is the only place a choice sticks |

---

## 8. Notes for other docs

Each point is a cross-doc dependency, not a change to `00`.

1. **Crew doc (03):** Ranks 0 to 3; Ranks 1 and 2 a Class pair, Rank 3 a Class Quirk or the Knack Quirk; late-recruit rule (section 2.1); launch roster of 16 per section 2.3; old Knack tier ideas become Quirk options.
2. **Campaign doc (05):** Tier opening on Grand Fort clears; no level leans on any node. Crew of 5 from 3-1; Rival crews of 5 from 4-2. Trials at the side paths in section 4.1. "New this level" here is regenerated from 05.
3. **Weapons doc (01):** one launch Shell Set of 3 (KT-02 Kitchen Drawer: Dinner Gong, Miner's Lamp, Grandfather Clod); Molehill (KT-04) and Bellows (KT-07) at launch, Scarecrow (KT-09) in U2; Doodad sources in section 6.1.
4. **Enemies doc (04):** a short Rival perks table and which archetypes carry which rooms [audit C56]; Rival crews never exceed the player's crew cap at that point.
5. **UX doc (07):** the bough rail has four tabs (Aim, Fort, Crew, Kit); the fork shows as a split node; free readouts in section 1.7 move to the battle HUD; "Untinker" on every owned node.
6. **Art (06, art 19):** the tree mockup is redrawn with four branches and these node names [audit C55].

---

## Appendix: Parked ideas

Cut for good, from the last draft of this doc [R04 A, R04 B, review 02 §2.3]. Reopening one needs a review note. Nodes that moved to an update are not here; they are tagged above.

| Idea | Why it was parked | What does its job now |
|---|---|---|
| Six branches and 77 nodes (Aim and Sight, Castle and Masonry, Crew Training, Rummage and Shells, Steam and Stompers, Doodads) | A shop with a tree shape | Four branches, 60 nodes |
| 12 choice pairs and 6 keystone pairs | Not felt, and free respec turned them into per-map loadouts | One fork per branch |
| Weathervane, Chalk Line, Shot Log, Drift Tally | Sold the UI back | Free in every battle (section 1.7) |
| Tinker Plans and Blueprint-linked tree layouts | A loadout of loadouts | Free respec |
| Knack Pouch (3 Knack uses on one Hob) | Loadout of loadouts; crowds out Plain Shots | Quirks |
| Captain's Call | Blueprint-linked pick, and Chill on loss | Nothing |
| Good Neighbors, Bunk Mates (Neighbor Perks) | Seat layer cut [R04 B7] | Loophole height and Cover |
| Scurry | Seat layer cut | Bench Call |
| Fifth Hob and Full House (crew size nodes), sixth Hob | Crew size is a gift; cap 5 [R04 B3] | Campaign gifts at 1-7 and Grand Fort 2 |
| Cross Training (extra Trick family per Hob) | Families are gone; any Hob fires any shell [R04 B6] | Match |
| Kettle Plating (kettle 360) | Kettle is 300 on every fort [R04 B4] | Nothing |
| Duck and Cover (Cover 65%) | Made fights longer | Nothing |
| Snug Room (heal 6 per turn) | Heals stretch fights; a seat perk in disguise | Nothing |
| Clockwork Keep (rebuild a block each turn) | Heals stretch fights | Nothing |
| Sharp Eye (Rival's wanted shells starred) | A readout of the Rival's plan, and deny refunds are gone | Nothing |
| Dud Lover and Dud Planter | Rules about a joke shell | Duds stay a joke |
| Twin Load | Overlaps Buddy Shot | Buddy Shot |
| Old Favorite, Big Bag, Signature Shells | Blueprint-linked or hand-size loadouts | Spare Pocket |
| Gadgeteer, Junk Cannon, Refill Bell, Long Fuse, Quick Swap, Patch Plus, Kettle Lid node | Too many Doodad rule-benders; Kettle Lid answers one shell | Free Hand, Double Up |
| Mud Boots, Hill Climber, Sprinter, Stand Fast (was Anchor), Soft Landing, Wader, Kettle Link, Charge!, Dug In | Steam number nodes and keystones; few felt | Bigger Boiler, Stomp, Steam Shot |
| Hob levels 1 to 10 at +1.5% HP and the 4,100 Button ladder | Six of nine level-ups gave nothing [R04 B8] | Three Ranks, each a Quirk |
| Rummage deny refund | Pocket change | Nothing |
