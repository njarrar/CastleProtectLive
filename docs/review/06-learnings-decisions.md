# Review 06. Lessons from the Reference Games: Changes We Make

Sources: two independent reviews (kept in the private archive) of the Mac playtest (`02e`), we take the change. Where they differed, this file picks one. Editors apply this file to the design docs. All names and numbers are our own; nothing comes from the reference games.

## A. Gameplay changes (binding)

| # | Change | Why | Source |
|---|---|---|---|
| G1 | **Portrait battle view: stacked lenses.** Top lens: the target fort, close. Middle: a thin Field Strip map of both forts with the last Pins. Bottom: your fort and the HUD. The camera follows the shell in flight and holds on impact. Rotate any time with no state loss. Sim unchanged | A one-frame portrait view shows blocks at about 3 pt, which no one can read | 06a G11, 06b G1 |
| G2 | **Couch Duel house rules.** Everything is open: hidden items such as the Mole Mine show to both players. Player-only rules (Puff Up revive) apply to both sides. A hand-off card between turns shows the last shot and a Ready button. Optional "Kind Clock" (off by default) nudges a slow player but never fires for them. Starter Box: even loaner forts playable from first launch. Handicaps shown openly. Table mode in portrait (the screen splits so each player reads their own side) | Rules written for the AI break between two people | 06a G10, 06b G2 |
| G3 | **Pacing re-check at real speed.** Both reference games ran about 20 s per shot. Re-run the pacing maths at about 32 s per round (two shots). The vertical slice gates on seconds per round. Keep round cap 12 as a fallback if fights run long | Our 16 to 20 s per round guess was too fast | 06a G1 |
| G4 | **"Squall in 3" warning** two rounds before the cap, with a round count on the HUD | Castle Busters' "3 rounds remain" banner made the end tense and fair | 06a, 06b G5 |
| G5 | **Teach "aim low".** Hold any block to see what would fall if it broke (**Lean Lines**). Blocks that hang with weak support shimmer. A short "Drop!" callout on the first big collapse | Low hits were the most fun moment in Castle Busters; ours must be readable, not a hidden bonus | 06a G5, 06b G4 |
| G6 | **Loophole Flap.** After a thread shot passes a Loophole, that Loophole closes to threads until the Weather Front changes. Shown on the fort. Replaces the hidden "one thread on Fair" AI rule | A kept aim plus a Loophole thread can Bonk a 120 HP Lobber in two turns, again and again | 06b U1 |
| G7 | **Shove Off.** Digging out a buried Hob costs 15 Steam in the Walk step, not your Action | Burial traps were the worst feel in Pocket Tanks | 06b G3 |
| G8 | **Early variety.** One loose Trick Shell in levels 1-3 and 1-4 | The first four levels used Plain Shots only, the same flat start the reference had | 06b G6 |
| G9 | **The Rival shows one wish in the Rummage** (it glances at the shell it wants) | Makes the draft a read on the opponent, as in Pocket Tanks | 06a, 06b G8 |
| G10 | **"No line" mark** before battle on a Hob whose shots cannot reach the enemy on this map | Pocket Tanks' Sniper and Skipper were dead picks on hills; our Zinger and Skip risk the same | 06b G7 |
| G11 | **Volley Points option** for Skirmish and Couch Duel: a fixed number of shots each, highest Siege Score wins | Pocket Tanks' points race is loved by couch players | 06a |

To test in the prototype, not yet binding: level-placed bonus hoops, a free Doodad before the shot, Medium Rest at 0.

## B. Unit changes (binding, launch counts unchanged: 16 Hobs, 14 enemy types)

Shared term for positional Passives: **next door** (the Nooks touching this Hob's Nook left, right, above and below).

| # | Hob or shot | Change | Fills |
|---|---|---|---|
| U1 | **Grub** (Delver, 140 HP) | Passive **Broad Back**: front tank. While Grub stands, the Hob next door behind him keeps Cover even if their shared wall breaks | A tank that soaks |
| U2 | **Hetty** (Patcher) | Passive **Ridgepole**: while Hetty stands, the blocks in her column above her Nook cannot fall from lost support. Replaces Tidy Up, which did nothing at launch | A column holder |
| U3 | **Old Thumper** (Lobber) | Passive **Old Grudge**: after a Hob next door is Bonked, his next Clodpot is one blast band larger | Crew that reacts to a loss |
| U4 | **Nan** (Scatterjack) | Passive **Clatter Call**: after Nan hits a Hob, Hobs next door deal +15% on their next shot | A neighbour buffer |
| U5 | **Fizz** (Scatterjack) | New Knack **Rising Fizz**: three bubbles that fall upward after the top of their arc, to hit roofs and overhangs | A rising-gravity shot |
| U6 | **Marge's Grand Dumpling** | Adds **Low Blow**: x1.3 to blocks in the row just above Footing | Teaches aim low; no longer just a bigger Clodpot |
| U7 | **Long Skewer** (Dame Flicka) | Leaves the skewer in place: the Nooks it passed stay Open until repaired | Splits our three pierce shots by role |
| U8 | **Skimmerstone** (Skip) | 50 Blast floor on its final hop | Removes a dead pick on hills |
| U9 | **Borelight** | Becomes a Delver set-up shell (opens a tunnel others can shoot down) | Overlap with Sunspear and Long Skewer |
| U10 | **Pudding Bomb** Match moves from Lobber to Scatterjack. **Shoring Crew** (enemy) moves to launch, **Silt Lobber** to U1 | Lobber was overloaded; two enemies both buried Loopholes |
| U11 | Fix: Mendglob heals the value in `00` canonical numbers everywhere | `01` said 40, `00` and `03` said 50 |

## C. Do not copy (both reviews)

Forfeiting turn clocks. Fake players and steered win rates. Hidden damage multipliers. Stuns and aim debuffs. Taps in flight. Random shot counts. Negative zones. Unit levels and rarity. Tilting castles. Endings by counting health. Burial traps. Ad and timer walls. Paid heroes. Nerfs that take away progress. Summoners and spawners.
