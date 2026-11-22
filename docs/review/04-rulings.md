# Review 04. Rulings for the Edit Pass

This file settles what the three reviews raised. Editors apply it to every design doc. Where this file and the consistency audit (01) disagree, this file wins. Where this file is silent, the audit's ruling stands.

Items marked **OWNER** stay as recommendations until the owner approves the plan. Section D marks each owner call that is now decided.

## A. Scope: launch and updates (OWNER, recommended)

Adopt the phased plan in review 02 §5.3. Do not delete designed content. Tag every content item in every doc with one of: `[Launch]`, `[U1]`, `[U2]`, `[U3]`.

| | Launch 1.0 | U1 Long Siege | U2 Frostwhisker Peaks | U3 Clankmouth Mines |
|---|---|---|---|---|
| Regions | 4: Downs, Crag, Fen, Flats (Flats moves to Region 4, so the Baron ships) | | +1 | +1 |
| Campaign levels | 40 (4 Grand Forts) | | +10 | +10 |
| Classes | 7 (no Peeper) | | +Peeper | |
| Hobs | 16 | +2 | +5 | +5 (28) |
| Trick Shells | 30 (2 Duds) | +8 | +10 | +10 (58) |
| Doodads | 8 | +2 | +2 | +2 |
| Materials | Wicker, Timber, Cobble, Brassbound + Footing | | | +Moonbrick |
| Damage types | Blast, Pierce, Dig, Fire | | +Frost | +Zap |
| Tinker nodes | 36 | | +12 | +12 (60) |
| Mission types | Siege, Demolition, Rescue, Puzzle, Grand Fort | Waves (in Long Siege) | +Escort | +King of the Hill |
| Modes | Campaign, Skirmish, Couch Duel, Test Yard, Trials, Daily | +Long Siege | +Ironclad | +Baron Rush |

Peaks and Mines return as "the wings that got away": two lieutenants regroup after the Baron falls.
Cuts beyond the table come from review 02 §2.3 "Cut for good". Content cut for good moves to an appendix "Parked ideas" in its doc.

## B. Core rule changes (binding)

1. **Pacing maths.** Material HP: Wicker 30, Timber 50, Cobble 80, Brassbound 110, Moonbrick 140. Quirks, not HP, justify cost. Moonbrick heal per turn must be at most one third of a Plain Shot's damage to it, and stops on any turn it is hit.
2. **Collapse is the damage that scales.** Stone side support drops from 2 blocks to 1, so tall stone forts are top heavy. A good low hit on a late fort should drop about a third of it. Bot test a late fort by week 6.
3. **Crew cap 5.** Crew size grows 1, 2, 3 in the tutorial, 4 at level 1-7, 5 by Tinker or region gift. Grid growth needed to seat the crew is a free campaign gift. Every fort, player or Rival, must pass the Workshop validator.
4. **Heartkettle HP 300 for every fort,** bosses included. Phases gate bosses.
5. **Last Bell tiebreak is replaced by Sudden Squall.** From round 15 each round every block loses HP and wind grows until something pops. No score sums.
6. **Any Hob may fire any Trick Shell.** The matching Class fires it with no Reload and a small bonus. Remove grey cards, dead cards, deny refunds and per-class tags.
7. **Cut the seat layer.** No seat words, Seat Perks, Neighbor Perks, Scamper, Scurry, Crowded, Perched, Porch. Hob states: Open, Dropped, Tumbled, Squashed, Bonked. Loophole height and cover do the work.
8. **Hob growth is 3 ranks,** each rank a Quirk pick (2 choices). No HP per level, no Knack tiers. The best Knack tier ideas become Quirk options.
9. **No lost turns.** Tumble never skips a shot. Extra Reload caps at 1 turn. A buried Loophole greys the Fire button. Puff Up revive is player side only.
10. **Show enemy crew.** Class icons stay visible after the Muster. Hidden crew and the Peeper wait for U2.
11. **Anti Recall lock:** pins fade after one reuse; the AI walks out of a bracket after being hit twice from the same aim.
12. **Final boss in 2 Stages,** Hill Call from the first Roller turn, a clan crate before the last phase, retry from the Stage on all presets. Keep the teacup.
13. **Tinker Tree: 4 branches** (Aim, Fort, Crew, Kit). 36 nodes at launch, 60 in all. Do not sell UI readouts: forecast, Rival ghost lines, shot log and drift readout are free. Each branch has one real fork.
14. **Onboarding slows down.** Levels 1-5 teach only aim, Hob pick, kettle, wind and one Knack. Workshop at level 6, Rummage at level 7 or 8, Tinker Tree at level 10. At most 12 prompts in the first 10 minutes.
15. **One pre-battle screen,** one tap to fight, last picks kept, "Same again" default on replays.
16. **Merges:** Chill and Reload become "needs a rest"; Oil, Sticky, Ice and Zones become "patches" (one icon and a turn count); Trick-shot and Puzzle merge as Puzzle; Escort and Defend a Cart merge as Escort; Raid Rehearsal becomes a Test Yard button; no rarity on shells.
17. **After each loss,** a short slow-motion "what broke you" replay. Each Rival states one habit to build against.
18. Daily Dust-up is a seeded Skirmish on existing maps, no maps of its own.

## C. Tech rulings (binding)

1. Collapse uses the deterministic custom support check in the sim. The look comes from the view (creak, lean, staggered row drops, squash, dust). Week 4 prototype compares this with a cheap tumbling model; the playtest may change the support rule but not determinism.
2. One sim clock at 120 Hz. Rendering at display rate.
3. AI think target 400 ms on the 2 GB phone for all presets, budget in work units, hidden by a 0.8 to 1.5 s think pose.
4. Duel fort gap max 1400 cells. Long maps up to 1800.
5. Bot throughput estimate 80 matches per minute per CI core.
6. Effort: review 03 says about 133 engineer weeks for launch scope. Team: 3 to 4 engineers, 1 artist plus contract animator, 1 designer, 1 level designer, part time audio. Launch target 46 to 52 weeks from start.

## D. Owner decisions

Items marked **DECIDED** are binding. The rest stay as recommendations.

1. Launch scope per section A. Recommend yes. Couch Duel now sits in the launch modes (item 3).
2. **DECIDED. Free, no monetization.** No price, no trial, no Full Kingdom unlock, no web unlock code, no in-app purchases, no ads, no paid cosmetics. All levels, all content and all updates are free. Region 1 is not a trial and no rule changes for any player. Keep every "no paid power" rule. 00 §5.5.
3. **DECIDED. Couch Duel ships at launch.** Two players on one device, hotseat turns, a pass screen that hides nothing, open Rummage picks, no AI, fully offline. It is a Skirmish with two human controllers. 00 §6.1.
4. **DECIDED. Portrait and landscape both supported at launch.** The UX and art docs own the layouts.
5. Audio: 14 MB full plan, 2.8 MB boot pack. Recommend yes; raise the cap.
6. **DECIDED. Final art made by human artists;** concepts in docs/art set the direction.
7. Max camera zoom 1.25. Recommend yes.
8. Target players: genre fans first, casual players second; the simplifications above serve both.
9. Trademark search on world, crew and shell names before art production.
10. One named content owner who holds the counts.
11. **DECIDED. Sudden Squall double pop:** if both kettles pop on the same hit, more total HP left wins. 00 §2.11.
12. **DECIDED. Gentle wind from level 1-4,** with a Wind off assist. 00 §8.1.
13. **DECIDED. First Doodad at 1-9:** winning 1-9 gives the Mend Bucket and one slot. Pot Lid and slot 2 stay at 2-1.
