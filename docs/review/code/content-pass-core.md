# Content pass: core, levels and forts

Follows `docs/review/naming-decisions.md`. Ids in code, saves and content are the same as before. Rules version stays 5 (not yet released). Nothing is committed.

## 1. Habit by id

- Each level now has `rival.habit_id`. The AI reads only that. The free text `rival.habit` line is display only, so a copy edit no longer changes play.
- Ids: `balanced`, `kettle_hunter`, `roof_wrecker`, `hob_sniper`, `cautious_mender` (`HABIT_IDS` in `content.rs`). No id plays `balanced` (Workshop, Couch and player sides, as before).
- Content checks refuse an unknown id and a level Rival with no id. The level schema lists the ids.
- Play is the same as before for every level. The test `rival_habits_come_from_ids` pins the habit each level got from the old word match: 1-1 balanced, 1-2 hob_sniper, 1-3 kettle_hunter, 1-4 balanced, 1-5 hob_sniper, 1-6 roof_wrecker, 1-7 balanced, 1-8 kettle_hunter, 1-9 cautious_mender, 1-10 roof_wrecker, d1 and d2 balanced.

## 2. Rivals and titles

| Level | Title | Rival | Think ms | Crew |
|---|---|---|---|---|
| 1-1 | First Lump | Sir Pudge | 1800 | Mower, Dummy |
| 1-2 | Two Hats | Private Tuft | 1300 | Pitcher, Pitcher |
| 1-3 | Kettle on the Knoll | Lance Corporal Fernsby | 1200 | Raker, Raker, Dummy |
| 1-4 | Breezy Tops | Corporal Dibber | 1400 | Mower, Pitcher, Raker (by the kettle) |
| 1-5 | Under the Roof (was The Big One) | Sergeant Posy Rake | 900 | Pitcher, Raker, Pitcher (no Hedger) |
| 1-6 | Roof Trouble | Warden Snedd | 600 | Hedger, Hedger, Raker |
| 1-7 | Hetty in a Jam | Corporal Fernsby | 1000 | Raker, Pitcher, Mower |
| 1-8 | Rummage Sale | Sergeant Posy Rake | 900 | Pitcher, Raker, Mower, Pitcher (no Hedger) |
| 1-9 | Over Loaf Hill | Corporal Dibber | 1500 | Raker, Mower, Raker (by the kettle) |
| 1-10 | The Topiary Keep | Marshal Mowbray Trimm | 1100 | Hedger, Hedger, Raker, Mower |
| d1 | Two Lumps (was Twin Puddings) | picked by seed | from roster | Hedger, Raker, Pitcher, Mower |
| d2 | Orchard Dip | picked by seed | from roster | Raker, Pitcher, Mower, Mower |

- The Hedger is now in 3 of 10 levels and 1 Skirmish map (was all 12).
- "The Big One" was level 1-5 in content (the roof level with the Knack), not 1-9. 1-5 is renamed.
- 1-7 had no habit line. It now reads "Plays it straight. Proud of his new stripe." Other habit lines are as they were.
- Skirmish: `rival.roster` lists Sir Pudge, Private Tuft, Lance Corporal Fernsby, Corporal Dibber, Sergeant Posy Rake and Warden Snedd with their think times. When the setup gives no Rival name, the core picks `roster[seed % 6]` with the app's seed (before the Retry mix, so a Retry keeps the same Rival). The habit stays `balanced` so Skirmish balance holds. A name in the setup still wins (the web app sends "Sir Pudge" today).
- Unit display names (Hedger, Raker, Mower, Pitcher, Dummy) live in `content/hobs.json`, which the writer agent owns. I did not edit it.

## 3. Forts

No two blueprints share a grid now (shape only, any material). The test `no_two_forts_share_a_grid` checks it.

| Fort | Used by | Shape | Block HP before, after |
|---|---|---|---|
| bp_home_3 | 1-1 to 1-5, Workshop start | Crooked: off-centre Cobble chimney, Wicker lean-to roof, a tall nook up a tower, left and right rooms one row apart, one Wicker patch | 1300, 1440 |
| bp_home_3_cobble | 1-6 | As above with a two-high Cobble chimney and a Cobble tower cap | 1510, 1610 |
| bp_home_4 | 1-7 to 1-10 | Crooked: tall tower nook, chimney on a Wicker lean-to, offset rooms, Wicker porch on the front. Four Nooks (was five) | 1950, 1980 |
| bp_home_5 | default for 5 Hobs | Roof corner missing, Wicker porch, Cobble low row | 2130, 2160 |
| bp_r1_box_wicker | 1-1 | Pudge's hamper on legs: Wicker basket on stilts, kettle under it | 780, 960 |
| bp_r1_kettle_knoll | 1-3 | 8 wide, front top corner cut, kettle one Wicker wall from the front | 980, 1090 |
| bp_r1_timber_3 | 1-4 | The Dibber: a tall thin spike on a low base, Raker seat by the kettle | 1300, 1390 |
| bp_r1_fernsby_post (new) | 1-7 | Hut on stilts with a Wicker lookout | 1300, 1440 |
| bp_r1_orchard | 1-8, d1, d2 | The neat Flattener box plus a Wicker rake rack at the back | 1950, 2130 |

Two first tries failed the balance check and were changed: a "spinning top" Pudge fort (1-1 Fair fell to 64% with the old crew) and a tall three-Nook tower for 1-3 (72%). In the home forts the first Nook is now a low one, so a crew of one is not seated at the top of the tower.

## 4. Think time

`rival.think_ms` on every level, `think_ms` on each Skirmish roster entry. Range 200 to 4000, checked. The core copies it to the snapshot as `hud.think_ms` (`[player, rival]`, `null` when unset). It is not in the state hash and the AI does not wait on it: apps own the pause.

## 5. Maps

One hand-placed feature per map, pads nudged off round numbers, Skirmish mirrors broken by a few cells:

- 1-1: a ditch in front of the Rival. Pads 412, 1293.
- 1-2: a boulder in the dip between the humps. Pads 374, 1331.
- 1-3: an old stump on the far slope. Pads 388, 1306.
- 1-4: a narrow ditch in the first valley. Pads 431, 1762.
- 1-5: a boulder past the ridge. Pads 409, 1826.
- 1-6: a stump half way up the slope. Pads 433, 1543.
- 1-7: a wet ditch on your side. Pads 414, 1857.
- 1-8: a stump in the near orchard. Pads 427, 1806.
- 1-9: a boulder at the foot of High Hill. Pads 312, 1712.
- 1-10: a boulder behind the boss fort (away from the roller's path). Pads 523, 1847.
- d1: one stone in the stream, right hill peak moved 10 cells and 3 lower, right slope point moved. Pads 446, 1957.
- d2: a stump at the bottom of the dip, the two rims 5 cells apart in height. Pads 517, 1889.

Features are rock or clay ground patches and ditches in the heightline, so the apps draw them with no new art. Map notes say where they are.

## 6. Pennants

The win goal is worded per level ("Send Pudge home", "Send Tuft packing", "Chase Fernsby off the knoll", "See Dibber off the tops", "Send Posy Rake home", "See Snedd off the slope", "Free Hetty", "Send Posy home empty-handed", "Get Dibber off High Hill", "Send Marshal Trimm home"). Each level has one goal no other level has (test `region_one_rivals_and_pennants_are_their_own`). The 50/60/60 kettle set is gone: one kettle goal is left (1-6, 70%), and "No Hob of yours Bonked" is used once.

Two new checks in the core, both read at the end of the fight:

- `ground_kept` with `area: [x0, x1]`: that stretch keeps `value` percent of its height above its lowest point. 1-1 "Leave the round hill its hump" (90), 1-9 "Leave Loaf Hill standing" (70).
- `bonk_nook`: the Rival Hob in Nook `value` is the first Rival Hob Bonked. 1-2 "Bonk the Hob in the tower first", 1-6 "Bonk the Hob atop the Stamp Tower first". This adds `first_bonked` to the side stats, which is in the hash.

## 7. Core text

Per the lead: the round 10 collapse blow is named "The Creaks" (was "Fatigue collapse" and "Fatigue"), the `fatigue_warning` text is "The Creaks next round: cracked blocks hold less", and a refusal says "resume only on a new fight". Event and field ids (`fatigue`, `fatigue_warning`, `battle_start`, `battle_over`) are unchanged. No core text said "Victory".

## 8. Checks

All green: `cargo fmt --check`, `RUSTFLAGS="-D warnings" cargo clippy --workspace --all-targets`, `cargo test --workspace` in debug and release, `scripts/build-wasm.sh`, `scripts/run-golden.sh`. Native and wasm golden hashes match:

- `first_lump 0de68b68920801f1`
- `twin_puddings_bots eec6d635135e1255`
- `couch_starter_box f11966db541d94eb`

Goldens and fixtures were regenerated on purpose: new maps, forts and crews change every recorded fight, `first_bonked` joined the hash, the snapshot carries `think_ms`, and the writer agent's display names are in the fixtures. Two tests poked exact cells of the old Cobble home fort; they now pass that old fort inline (`m1_...` in `review_fixes.rs`, `qa2_n2_...` in `qa_playtest_2.rs`).

## 9. Balance

`examples/winrate.rs`, 200 fights a row. It now also prints the share of fights that earned each Pennant. Before is the bundle check in `bundle-core-verify.md`.

| Level | Fair before | Fair now | Cozy before | Cozy now |
|---|---|---|---|---|
| 1-1 | 100% | 100% | 100% | 100% |
| 1-2 | 84% | 94% | 83% | 87% |
| 1-3 | 96% | 96% | 98% | 99% |
| 1-4 | 96% | 99% | 98% | 98% |
| 1-5 | 88% | 90% | 97% | 98% |
| 1-6 | 89% | 88% | 98% | 98% |
| 1-7 | 93% | 94% | 95% | 95% |
| 1-8 | 76% | 75% | 95% | 97% |
| 1-9 | 76% | 79% | 88% | 92% |
| 1-10 boss | 41% | 49% | 58% | 91% |
| d1 | 64% | 59% | 97% | 99% |
| d2 | 63% | 65% | 95% | 96% |

- 1-10: with the new content the boss sat at 34 to 38% Fair, and the drop did not come from the new home fort, the pads or the boulder (each tested alone). The Marshal's crew now has `knack_uses` 0 (was 1), which gives 49%.
- 1-2 Cozy is below Fair, as it was before this pass. Its Cozy losses are all Squall ends. Worth a look with real players.
- 1-8 and 1-9 stay under 85% Fair, as before; they are not early levels.
- The bot never aims at a kettle or walks, so it shows 0% on "Pop the kettle by his wall" and "Land hits from two different spots". 1-1's hill goal is near 97% for the bot.

## For the apps

New content fields to read (all in `content/levels/<id>.json`):

- `rival.habit_id`: AI habit id. Apps do not need it for play; show `rival.habit` as the Habit line.
- `rival.think_ms`: think pose ms before each `ai_turn`. Fall back to `app.json` `rival_think_seconds`. Live value per fight: snapshot `hud.think_ms[1]`.
- `rival.name`: display name. d1 and d2 have no `rival.name` now; they have `rival.roster: [{name, think_ms}]`. To show the Rival before the fight use `roster[seed % roster.length]` with the seed passed to the core; during the fight read `hud.names[1]`. To get the pick, stop sending a Rival `name` in the Skirmish setup.
- `pennants[].text`: the worded goals. New `type` values `ground_kept` (with `area`) and `bonk_nook`; the core does the check, apps only show the text.
- `name` (level title): 1-5 is "Under the Roof", d1 is "Two Lumps".
- `map_note` mentions the new feature.
- `content/blueprints.json`: new `bp_r1_fernsby_post`; `bp_home_3` (the Workshop start fort) has new rows. Android `Workshop.kt` still hard codes the old `bp_home_3` rows in `HOME`.
