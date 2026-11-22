# 03. Crew and Units

Status: edit pass 2, for owner review. Date: 2026-11-22. Owner of this doc: character and unit designer.

This doc fills the crew system set out in `00-core-game-design.md`. It owns the Classes in detail, the named Hob roster, squad building, Hob ranks and Quirks, Hob mastery hooks, the animation list and the crew placement rules.

**What this doc does not own.**

- Shot names and numbers. `01-weapons-and-shots.md` owns them. Knack names below come from `01`. If `01` differs, `01` wins.
- Costs, node order and level numbers. `02-tech-tree` and `05-campaign` own them. This doc gives hooks and suggested levels.
- Rival crews. The enemies doc owns the Flatteners. They use the same Classes and the same rules.

**Binding rulings.** This pass applies `docs/review/04-rulings.md` (binding) and the rulings in `docs/review/01-consistency-audit.md` where 04 is silent.

**Cites.** `[00 §2.9]` means section 2.9 of the core doc. `[C02]` is row C02 of the consistency audit. `[B7]` is ruling B7 in review 04. Research cites follow the core doc style, for example `[02b §7]`.

**Tags.** Every content item carries one tag: `[Launch]` ships in 1.0. `[U1]` ships in Update 1, Long Siege. `[U2]` ships in Update 2, Frostwhisker Peaks. `[U3]` ships in Update 3, Clankmouth Mines [review 04 §A]. All numbers are tuning targets.

---

## Changes in this revision

| # | Change | Why |
|---|---|---|
| 1 | Cut the seat layer: seat words, Seat Perks, Neighbor Perks, Scamper, Scurry, Crowded, Perched, Porch. Moved to Parked ideas | [B7] |
| 2 | Hob states are now five: Open, Dropped, Tumbled, Squashed, Bonked. Rattled and Skylight are gone as states | [B7] |
| 3 | Hob growth is 3 ranks. Each rank is one Quirk pick from 2. No HP per level. No Knack tiers. The best tier idea of each Knack is now a rank 3 Quirk option | [B8] |
| 4 | Any Hob may fire any Trick Shell. The Match Class fires it with Rest 0 and +10%. Class "Trick families" are gone | [B6] |
| 5 | Crew cap 5. Crew grows 1, 2, 3 in the tutorial, 4 at 1-7, 5 as a free gift at Grand Fort 2 (per `00`) | [B3] |
| 6 | No lost turns. Tumble never skips a shot. A buried Loophole greys the Fire button. Puff Up is player side only | [B9] |
| 7 | Enemy crew Class icons stay visible all battle. Hidden crew and the Peeper Class move to `[U2]` | [B10] |
| 8 | 16 Hobs at launch, 2 in U1, 5 in U2, 5 in U3 (28 in all). Every Hob is tagged. Launch list in section 3.0 | [A] |
| 9 | Join levels follow the audit and the 4-region launch: Hetty 1-7, Dame Flicka 2-8, Truffle 3-7, Nan on the T3 path or at 2-10. The Flats are Region 4. Pip is the Flats rescue at 4-8 (was Tansy, now U2) | [C02], [A] |
| 10 | Mastery and Deeds move to `[U1]`. Bonds move to `[U2]` | Review 02 §2.3 |
| 11 | Class sheets use `01` numbers and Knack names. Five no-damage Knacks are Light | [C07], [C08] |
| 12 | Cover reads as the audit says: area payloads centred outside an intact Nook are halved, any type. Point hits are not | [C09], [C10] |
| 13 | Renames: Flicka's passive is "Joust", Nan's is "Pan Shield", the Quirk "Second Wind" is "Big Breath". The Sizzler Quirk "Wick" is "Wildfire" (clash with Wick Glimmer) | [C45], [C49] |
| 14 | Passives that relied on cut systems are rewritten for launch: Truffle (Good Nose), Poultice (Tea Round), Hetty (Tidy Up) | [B7], [B10] |
| 15 | Last Bell crew plans (The Slow Cook, the Turtle trio aim) are rewritten for Sudden Squall | [B5] |
| 16 | Per-Hob voice lines become subtitle lines over one voice set per Class | [C86] |
| 17 | Final verification pass: "Reload" and "Chill" read as **Rest** everywhere; the Match Class fires a shell with Rest 0 and +10% [00]. Old Thumper joins at 2-3 and Tansy at 5-8 (not a rescue), per `05`. Petra is the Canary Row (6-6) captive. The late-recruit rule follows `02`. If a whole crew is dug in, the newest burial clears, as in `00` and `01` | Review 05 |
| 18 | Four Passives replaced with positional rules that use the new word **next door** (section 1): Grub **Broad Back** (was Sure Feet), Hetty **Ridgepole** (was Tidy Up, which did nothing at launch), Old Thumper **Old Grudge** (was Can't Hear You), Nan **Clatter Call** (was Pan Shield). Each has a rule, a counter and a bark | Review 06 U1 to U4 |
| 19 | Fizz's Knack is **Rising Fizz** (was Popple Pod), with a new Knack Quirk, **Shaken Up** | Review 06 U5 |
| 20 | Knack lines follow `01`: Grand Dumpling's **Low Blow**, Long Skewer leaves the skewer in, Skimmerstone's 50 Blast floor | Review 06 U6 to U8 |
| 21 | Loophole Flap and Shove Off in the Loophole rules (7.2). Puff Up is open to both sides in Couch Duel. Peep Pip deals 12, as `01` sets it | Review 06 G2, G6, G7 |

---

## 1. Crew rules in short

These come from the core doc and the rulings. They frame all that follows.

- The Hob is the weapon. Picking who fires is picking the shot [00 §2.9, 02b §16.3].
- Each Hob has one Plain Shot (no limit, Light) and one Knack (2 uses per battle) [00 §2.9].
- Any Hob may load any drafted Trick Shell. Each shell card shows one Class badge. A Hob of that Class, its **Match**, fires it with Rest 0 and +10% [B6, 00 §2.15].
- One Action per turn. Medium and Heavy shots cost Rest, so you rotate the crew [00 §2.2]. Extra Rest from all sources caps at 1 turn [B9].
- Hobs sit in Nooks. Each Nook has a Loophole that faces the rival [00 §2.7].
- A Hob in an intact Nook takes half damage from area payloads centred outside it [C10].
- A Hob at 0 HP is Bonked. A Snooze Balloon floats it off. No lasting cost [00 §2.9].
- Hob HP runs from 80 to 140 by Class [00 §2.9]. HP does not grow with rank.
- Hobs are never sold. Every Hob joins through play [00 §3].
- No rule makes a Hob lose a shot [B9].
- **Next door** [00 glossary]. A Nook is next door to a Hob when it touches that Hob's Nook on the left, right, above or below, sharing a wall with no room between. Diagonal Nooks are not next door. "Behind" means the next-door Nook on the same row, on the side away from the rival. Four launch Passives use it (Grub, Hetty's column, Old Thumper, Nan). It is a pure sim rule: the Workshop shows next-door links as faint lines when you seat a Hob with such a Passive.

### 1.1 What every Hob shows

| Item | What it means |
|---|---|
| **HP** | Hit points. Class sets the base. A named Hob may sit up to 10 above or below it, inside the 80 to 140 range. Boss units are exempt [C21] |
| **Rank** | 0 to 3. Each rank adds one Quirk, picked from two (section 5) |
| **Passive** | One small rule that is always on |
| **Knack** | One special shot, 2 uses per battle. `01` owns its name and numbers |

Hobs never walk on the field. Only the castle walks [00 §2.14].

### 1.2 Hob states `[Launch]`

Five states, each with a clear picture and one rule. Section 7.4 has the detail.

| State | What happened | Rule |
|---|---|---|
| **Open** | A block on any side of the Nook is gone, or the Hob stands outside a Nook | No Cover |
| **Dropped** | The Nook floor broke | Falls to the first standing surface. Fall damage over 32 cells |
| **Tumbled** | Fell out of the castle | 20 damage. Climbs back to the lowest free Nook. Keeps its shot |
| **Squashed** | A chunk landed on it | Crush damage |
| **Bonked** | HP 0 | Floats off on a Snooze Balloon |

### 1.3 Class table at a glance

| Class | Role | HP | Good Loophole | Tag |
|---|---|---|---|---|
| **Lobber** | Demolisher | 120 | High, any depth | `[Launch]` |
| **Zinger** | Crew sniper | 80 | Level with enemy Nooks | `[Launch]` |
| **Scatterjack** | Area | 100 | High or middle, near the front | `[Launch]` |
| **Delver** | Underminer | 140 | Low, on the Footing | `[Launch]` |
| **Boinker** | Trick shots | 90 | Low | `[Launch]` |
| **Sizzler** | Zones | 100 | Middle, in fireproof walls | `[Launch]` |
| **Patcher** | Support | 110 | Middle, near the Kettle Room | `[Launch]` |
| **Peeper** | Scout | 80 | Top row | `[U2]` |

"Good Loophole" is advice, not a rule. Height and cover do the work [B7]: a high Loophole clears hills, a low one gives flat runs, and a deep Nook sits behind more blocks.

---

## 2. Class design

Each Class sheet lists role, stats, Plain Shot, strengths, weaknesses, counters and where it likes to sit. Counters are always things the player can see before the shot [00 §2.10, 02d §1.6.12]. Plain Shot numbers are from `01 §2` [C08].

### 2.1 Lobber `[Launch]`

**Role.** Demolisher. Opens roofs, drops floors, cracks the path to the Heartkettle.

| Item | Value |
|---|---|
| HP | 120 |
| Plain Shot | **Clodpot.** High arc pot. 35 Blast, Medium blast (28). Light. Wind moves it most |
| Knack style | Big lob, Large blast |
| Shell badge | Lobber shells: lobs and bursts |

**Plain Shot behavior.** The pot leaves at a steep angle and comes down steep. It bursts on first touch. It is the shot new players learn on. Steep arcs clear hills and front walls, so it works on every map.

**Strengths.**
- Best block damage per turn of any Plain Shot.
- High arcs clear ridges and front walls.
- Drops roofs, which sets up crush damage on Hobs below.

**Weaknesses.**
- Long flight, so wind moves it most.
- Cover halves its blast on Hobs until a Nook wall is gone.
- Blast is weak on Brassbound and Footing.

**Counters.** Strong wind levels. Thick Cobble or Brassbound roofs. Nooks deep under two roof layers. A Zinger, since 120 HP still falls to three Hatpins.

**Where it sits.** High, at any depth. Height adds range and keeps the arc steep. A Lobber does not need the front, so give the front to someone who does.

### 2.2 Zinger `[Launch]`

**Role.** Crew sniper. Hunts Hobs and pricks the Heartkettle.

| Item | Value |
|---|---|
| HP | 80 |
| Plain Shot | **Hatpin.** Flat fast pin, low gravity. 32 Pierce, point shot (48 to a Hob). Light. Wind moves it little |
| Knack style | Beam or lance through walls |
| Shell badge | Zinger shells: beams and guided shots |

**Plain Shot behavior.** The pin flies fast and nearly flat. It hits one thing: the first block or Hob in its path. It can thread an enemy Loophole (section 7.2) and skip Cover.

**Strengths.**
- Pierce does x1.5 to Hobs and full damage to the Heartkettle [00 §2.10].
- Fast flight, small wind drift.
- Point shots are not halved by Cover [C10].

**Weaknesses.**
- Lowest HP in the game.
- Needs a line. A hill, a mound or a Cobble wall stops it.
- Weak on Cobble and Brassbound. Almost nothing on Footing.
- Hits one thing. It never causes a collapse alone.
- Loophole Flap: each enemy Loophole takes one Thread per Weather Front, so a found line pays once, then needs a new aim [00 §2.10].

**Counters.** Ground between the castles. Raised mounds. Smoke Doodads. Walking the castle behind a ridge. Any blast into its Nook, since 80 HP goes fast.

**Where it sits.** The Loophole should sit near the height of the enemy Nooks so the flat pin has a line. Give it strong walls. It is the Hob the rival wants gone first.

### 2.3 Scatterjack `[Launch]`

**Role.** Area. Chips many blocks, punishes open Nooks, finishes hurt Hobs.

| Item | Value |
|---|---|
| HP | 100 |
| Plain Shot | **Gravel Sneeze.** Fan of 3 stones, 6 degrees apart. 3 x 14 Blast, Tiny blast (10). Light |
| Knack style | Splits into many |
| Shell badge | Scatterjack shells: clusters and rapid shots |

**Plain Shot behavior.** Three stones leave in a fan. Each has its own arc. Tight at short range, wide at long range. The preview shows the middle stone only.

**Strengths.**
- Forgiving. A near miss still lands one or two stones, so early rounds never feel empty [00 §9.3].
- Shreds Wicker and Timber faces.
- Best finisher on Hobs in Open Nooks.

**Weaknesses.**
- Each stone is weak. Cobble and up shrug it off.
- Cover halves every stone. Against an intact fort it tickles.
- Wide easy shots score Skill Factor 0.5.

**Counters.** Cobble and Brassbound faces. Intact Nooks. Long range, where the fan spreads past the castle.

**Where it sits.** High or middle, near the front, so the fan is still tight when it lands.

### 2.4 Delver `[Launch]`

**Role.** Underminer. Tunnels ground, bores walls from the side, drops castles into pits.

| Item | Value |
|---|---|
| HP | 140 |
| Plain Shot | **Nibbler.** Low shot that bores 48 cells of Loam (Clay at half) and leaves a tunnel. Against a block: 34 Dig and a Peephole. Light |
| Knack style | Long bore, then a burst |
| Shell badge | Delver shells: diggers and ground shots |

**Plain Shot behavior.** A low arc shot that keeps going through Loam or Clay and leaves a tunnel one block wide. It stops at Rock, Bedrock and Footing. Against a castle block it deals Dig damage, leaves a Peephole and stops.

**Strengths.**
- Removes the hill a Zinger hides behind. Opens lines for the whole crew.
- Can carve ground from under a castle and cause a Thump [00 §2.7].
- Highest HP. A Delver holds a low Nook for a long time.
- Dig hurts the wall, not the Hob behind it, so Cover rarely matters.
- Digs out a buried Loophole (section 7.2).

**Weaknesses.**
- Dig does half damage to Hobs and nothing to the Heartkettle or Footing.
- Rock and Bedrock maps shut it down. The map preview shows this.
- Short reach on its Plain Shot. It often needs a Walk first.

**Counters.** Footing. Rock ground. Clay, which carves at half rate. A Patcher who fills the hole. Water, which floods a tunnel dug below the water line.

**Where it sits.** Low, on the Footing. A low Loophole gives a flat run into the ground. The Footing never falls, so the Delver is never Dropped there.

### 2.5 Boinker `[Launch]`

**Role.** Trick shots. Reaches spots no straight shot can: under ledges, behind mounds, along the ground into a low Nook.

| Item | Value |
|---|---|
| HP | 90 |
| Plain Shot | **Bouncebean.** Hops twice, bursts on the third touch or at once on a Hob. 30 Blast, Small blast (18), +5 per hop. Light |
| Knack style | Roller or skipper |
| Shell badge | Boinker shells: rollers and bouncers |

**Plain Shot behavior.** The bean keeps 70% of its speed on each hop. It bounces off ground and off castle blocks. The preview stops at the first bounce [00 §2.4].

**Strengths.**
- Beats direct cover: bounce under a ledge or over a low wall [00 §2.10].
- High skill, high joy. Bank shots make the best Brag Clips.

**Weaknesses.**
- Hard to aim. The preview hides the second hop.
- Mud and sticky ground stop it dead. Water sinks it.
- Low HP.

**Counters.** Mud, Water, sticky patches. A pit in front of the castle. A raised mound. All show on the map before the shot.

**Where it sits.** Low. A low Loophole makes long flat hops.

### 2.6 Sizzler `[Launch]`

**Role.** Zones. Burns wood, soaks ground. Shapes the next two turns.

| Item | Value |
|---|---|
| HP | 100 |
| Plain Shot | **Emberpot.** Fire pot. 15 Fire, Small blast (18). Burn on wood and Hobs. Leaves an Ember Patch for 2 turns. Light |
| Knack style | Fluid or field |
| Shell badge | Sizzler shells: fluids and fire (Frost shells join in `[U2]`) |

**Plain Shot behavior.** A medium arc pot. It breaks on first touch and lights what it hits. Burn spreads to touching Wicker and Timber [00 §2.10]. Water puts it out.

**Strengths.**
- Burn ticks every turn with no more Actions spent.
- Best answer to Wicker and Timber forts.
- Burn on a Hob ignores Cover on later turns.
- Fields deny spots and force the rival to Walk or patch.

**Weaknesses.**
- Fire does nothing to Brassbound, Footing and the Heartkettle, and little to Cobble.
- Slow payoff. A race to a Kettle Pop can outrun it.
- Its own wood walls burn if the rival shoots fire back.

**Counters.** Cobble and up. Water and Soaked. A Patcher. Walking out of a field.

**Where it sits.** Middle, inside fireproof walls. Never beside Wicker.

### 2.7 Patcher `[Launch]`

**Role.** Support. Mends blocks, shields rooms, brings one friend back.

| Item | Value |
|---|---|
| HP | 110 |
| Plain Shot | **Mendglob.** Own block: +50 HP. A broken block with support comes back at half HP in its old material. Rival block: 8 Blast, Tiny. Light |
| Knack style | Rebuild, shield or wall |
| Shell badge | Patcher shells: builders and shields |

**Plain Shot behavior.** A slow soft lob. Aimed at your own castle it shows a block cursor in place of an arc and mends the block you pick. Aimed at the rival it is a weak splat.

**Strengths.**
- Undoes the rival's turn. Closes an Open Nook and gives Cover back.
- Plugs the path to the Heartkettle.

**Weaknesses.**
- Mending costs the Action. A turn spent mending is a turn not shooting [00 §2.2].
- Almost no damage.
- Cannot mend a block with no support.
- A rival who sees the Patcher icon will go for it first.

**Counters.** Focus fire. Burn, which outpaces one block per turn. Collapses, which remove the support a mend needs. Kettle rushes, since a Patcher adds no kettle HP. Sudden Squall, which wears down every block at once [B5].

**Where it sits.** Middle, near the Kettle Room, so it can mend the kettle's walls first.

### 2.8 Peeper `[U2]`

The Peeper Class and the hidden crew game arrive together with Frostwhisker Peaks, where fog and blizzard give scouting a job [B10]. Until then enemy Class icons stay shown and there is nothing to scout.

**Role.** Scout. Finds the crew, marks the target, makes every other shot easier.

| Item | Value |
|---|---|
| HP | 80 |
| Plain Shot | **Peep Pip.** Fast chalk dart. Reveals the nearest enemy Nook within 32 cells of where it lands, all battle. 12 Pierce, point shot (18 to a Hob). Light |
| Knack style | Reveal and mark |
| Shell badge | Peeper shells: scout shots |

**Strengths.** Ends the guessing in fog and hidden-crew levels [02b §16.8]. Light shots, so it can act every turn. Its bold Ghost line doubles as a range finder.

**Weaknesses.** Does next to no damage. 80 HP. Worth less on Cozy, where the enemy crew is always shown [00 §8.1]. Takes a crew slot from a shooter.

**Counters.** Smoke. Moving the castle so old chalk arcs no longer line up. Bonking it early.

**Where it sits.** The top row. It needs the widest view.

### 2.9 Counter wheel

| Class | Beats | Loses to | Tag |
|---|---|---|---|
| Lobber | Wood forts, roofs, stacked Nooks | Wind, thick stone roofs, Zinger | `[Launch]` |
| Zinger | Low HP Hobs, open kettle paths | Mounds, hills, smoke, Scatterjack | `[Launch]` |
| Scatterjack | Open Nooks, Wicker, Zinger | Cobble faces, range | `[Launch]` |
| Delver | Hills, Clay cover, Wicker bases | Footing, Rock, Patcher | `[Launch]` |
| Boinker | Ledges, low walls, low Nooks | Mud, sticky ground, pits | `[Launch]` |
| Sizzler | Wicker, Timber, slow forts | Cobble and up, Water, Patcher | `[Launch]` |
| Patcher | Chip damage, Sizzler | Focus fire, collapses, kettle rush | `[Launch]` |
| Peeper | Hidden crews, fog | Smoke, any direct hit | `[U2]` |

---

## 3. The roster: 28 Hobs

**Count.** 28 Hobs in all: 16 at launch, then +2, +5, +5 [review 04 §A]. Lobber, Zinger, Scatterjack and Boinker have 4 each. Delver, Sizzler, Patcher and Peeper have 3 each [C01].

**How Hobs in one Class differ.** They share the Class Plain Shot. Each has its own Passive and its own Knack. No Hob is a straight upgrade of another.

**Knacks.** Names and numbers come from `01 §3`. Each Knack has 2 uses per battle. Weight is Medium unless marked Light or Heavy. Knacks with no damage are Light [C07]. There are no Knack tiers [B8]. Each Hob's best old tier idea is now its **Knack Quirk**, a rank 3 option (section 5.2).

**Looks.** Every Hob is small and round with a hat too big for it [00 §1.5]. The hat is the read. Each Hob must be clear as a black shape at 24 px [00 §10.3]. The art doc owns final style.

**Barks.** Short lines for: pick, fire, ouch, cheer. They show as captions over the Class voice set [C86].

**Unlocks.** Level codes are Region-Level, so 2-5 is Region 2, level 5. Launch regions: 1 Puddingstone Downs, 2 Crumblecrag, 3 Soggybottom Fen, 4 The Flats. Update regions: 5 Frostwhisker Peaks `[U2]`, 6 Clankmouth Mines `[U3]`. Tutorial Hobs join at the start of their level. All others join on first clear. `05` owns final levels.

### 3.0 Launch list

**The 16 launch Hobs** (7 Classes, no Peeper):

| Class | Launch Hobs | Count |
|---|---|---|
| Lobber | Marge Dumpling, Old Thumper Grumbleby, Pip Skyward | 3 |
| Zinger | Quill Needlesworth, Dame Flicka Brightspur | 2 |
| Scatterjack | Jax Peppercorn, Nan Clatterpot, Fizz Popkin | 3 |
| Delver | Grub Mudgett, Truffle Snoutworth | 2 |
| Boinker | Bobbin Springheel, Skip Pebblewick | 2 |
| Sizzler | Ember Toastwell, Brine Picklewick | 2 |
| Patcher | Hetty Mortarboard, Poultice Plumley | 2 |

**Updates.**

| Tag | Hobs | Count | Why there |
|---|---|---|---|
| `[U1]` Long Siege | Gus Wobblebottom (Boinker), Rivet Brasstack (Patcher) | 2 | Both work with launch rules. Long Siege rewards them |
| `[U2]` Frostwhisker Peaks | Frostine Nippet, Dotty Hailstone, Winkle Spyglass, Echo Hootley, Tansy Featherlight | 5 | Frost and Brittle arrive. The Peeper Class arrives |
| `[U3]` Clankmouth Mines | Wick Glimmer, Bartleby Boulderbun, Sprocket Tumm, Lady Carom Bankshot, Petra Chiselwick | 5 | Zap and Moonbrick arrive. Petra's Hairline needs Brittle, so she waits until both updates are out |

**Rules the list keeps.**

- No launch Knack needs Frost, Zap, Brittle, Moonbrick or hidden crew.
- Every launch rescue level frees a launch Hob: Hetty (1-7), Dame Flicka (2-8), Truffle (3-7), Pip (4-8) [C02].
- Region 1 gives 6 Hobs in 6 Classes. All 7 launch Classes are in hand by 2-1.

### 3.1 Lobbers

#### 1. Marge Dumpling `[Launch]`

- **Look.** Short and wide, like a cottage loaf. Cream apron, cherry red dress. A huge floppy cook's hat that sags over one eye. Carries a long bread peel and flings pots off it.
- **Personality.** Calm, warm, feeds everyone. Treats every bomb as a bake.
- **Barks.** "In the oven it goes." / "Mind the crust!" / "Oof. My good apron." / "That rose nicely."
- **HP.** 120.
- **Passive, Steady Hands.** Her preview is 10% longer on Plain Shots.
- **Knack, Grand Dumpling.** One fat pot on a high arc. 60 Blast, Large blast. **Low Blow:** blocks in the row just above the Footing take x1.3. Her Knack teaches "aim low, let it fall" [01 §3.1].
- **Knack Quirk, Gravy Boat.** Grand Dumpling carves Rock, and carves ground x1.5.
- **Unlock.** Start of 1-1. The first Hob.
- **Why players love her.** She is the first face and the first hit. Her kit is simple and never stops being useful.

#### 2. Old Thumper Grumbleby `[Launch]`

- **Look.** Bent, long nose, white whiskers to the belt. Moss green coat, mustard scarf. A striped nightcap that trails to the floor. A brass ear horn. His cane has a spoon on the end that flips the bomb.
- **Personality.** Grumpy, deaf when it suits him, sure that all was better long ago.
- **Barks.** "Eh? Speak up!" / "Back in my day we threw harder." / "I felt that in my knees." / "Hmph. Not bad." Grudge bark: "Right. Now I'm cross."
- **HP.** 130.
- **Passive, Old Grudge.** When a Hob next door to him is Bonked, his next Clodpot is one blast band larger: Large (42) in place of Medium (28). Damage stays 35. He holds one grudge at a time (a second Bonk does not stack); it is spent when he fires a Clodpot and lasts all battle until then. His Knack and Trick Shells are not changed. **Read:** his nightcap turns red and a small storm cloud sits on his portrait. **Counter:** Bonk him first, Bonk Hobs that are not next to him, or keep your Cover whole so the bigger pot is still halved. The AI reads the grudge like a player.
- **Knack, Tick-Tock Crock.** A crock that lands and sits. It blows with a Large blast at the start of his next turn. The rival sees it and has one turn to Walk away, shove it, mend or shield. Heavy.
- **Knack Quirk, Snooze Button.** Before firing, set the crock to blow next turn or the turn after. The clock face shows which.
- **Unlock.** First clear of 2-3.
- **Why players love him.** The pot that sits and ticks is a threat the rival must answer. He is the trap setter.

#### 3. Pip Skyward `[Launch]`

- **Look.** The smallest Hob. Sky blue smock, orange boots. A kite for a hat, with a ribbon tail that shows the wind. A sling stick taller than she is.
- **Personality.** Eager, loud, never tired. Counts out loud while the bomb flies.
- **Barks.** "Up up UP!" / "One... two... three..." / "I'm okay! I'm okay." / "Did you see? Did you SEE?"
- **HP.** 110.
- **Passive, Tailwind.** Wind that pushes against her shot counts half.
- **Knack, Chimney Drop.** The pot climbs very high and falls straight down. Wind stops at the top. Medium blast. It skips front walls and hits roofs and open tops.
- **Knack Quirk, Roof Punch.** Chimney Drop goes through one Wicker or Timber block before it bursts.
- **Unlock.** Rescued in 4-8 (The Flats). She was caught flying her kite over the Baron's plate and locked in the filing tower.
- **Why players love her.** She makes the windy Flats fair. The long wait while the bomb falls is pure drama.

#### 4. Bartleby Boulderbun `[U3]`

- **Look.** The biggest Hob, a slate grey boulder with arms. Plum vest. A tiny bowler hat he outgrew years ago and will not give up. No tool. He throws by hand.
- **Personality.** Gentle, shy, says sorry to things he breaks.
- **Barks.** "Sorry in advance." / "Hup." / "Oh. That is fine. I am fine." / "Was that too hard?"
- **HP.** 130.
- **Passive, Heavy Hand.** His shots feel wind at 0.6. His top power is 90.
- **Knack, Anvil Bun.** One great stone. Small blast, high damage. If it breaks the block it hits, it keeps going down and hits the block below too. Heavy.
- **Knack Quirk, Day-Old.** Anvil Bun treats Cobble as Timber.
- **Unlock.** Clankmouth Mines, suggested 6-3.
- **Why players love him.** He punches through a roof and the floor under it. He is the one Hob with a small hat, and he knows it.

### 3.2 Zingers

#### 5. Quill Needlesworth `[Launch]`

- **Look.** Thin and upright, the tallest silhouette in the early crew. Navy coat, silver thread. A pincushion hat full of pins. A spring flinger made from a sewing frame.
- **Personality.** Fussy, exact, cannot stand a crooked line.
- **Barks.** "Measure twice." / "Hold still, please." / "Tsk. A tear." / "Neat."
- **HP.** 80.
- **Passive, Thread the Needle.** Her threaded shots (section 7.2) deal 25% more.
- **Knack, Sunspear.** A straight beam with no gravity. It passes through the first block and hits what stands behind.
- **Knack Quirk, Mirror Polish.** Sunspear reflects once off Brassbound or Water.
- **Unlock.** Start of 1-2.
- **Why players love her.** She teaches that the crew is a target too. A threaded Loophole shot feels like a magic trick.

#### 6. Dame Flicka Brightspur `[Launch]`

- **Look.** A round knight in dented red and gold. A bucket helm with a plume three times her height. A jousting lance with a spring in the grip.
- **Personality.** Bold, grand, announces every shot like a herald.
- **Barks.** "Have at thee, wall!" / "For the lumps!" / "A scratch! Merely!" / "Huzzah!"
- **HP.** 90.
- **Passive, Joust.** If her castle walked this turn, her Plain Shot deals 20% more [C45].
- **Knack, Long Skewer.** A lance bolt. It pierces up to 3 Wicker or Timber blocks in a line, or 1 block of Cobble or better, and loses damage per block. The skewer stays in: every Nook whose wall it passed is Open until that wall is mended [01 §3.2]. Quill hits what stands behind a wall; Flicka opens rooms for the crew's area shots.
- **Knack Quirk, Greased.** After Long Skewer threads a Loophole, it goes on through the Hob to the back wall.
- **Unlock.** Rescued in 2-8 [C02].
- **Why players love her.** She pays you for spending Steam. Walk, then joust.

#### 7. Wick Glimmer `[U3]`

- **Look.** Small, hunched, dusk purple cloak. A lantern for a hat with a real glow that lights his face. A long lighter pole.
- **Personality.** Shy, soft spoken, afraid of the dark he works in.
- **Barks.** "Um. Lights on." / "Sorry. Bright." / "Eep!" / "Oh! It worked."
- **HP.** 80.
- **Passive, Lamplight.** Any Nook he hits stays revealed all battle.
- **Knack, Glimmerjolt.** A spark beam. Straight, no gravity, Zap damage. It passes one wall and chains along touching Brassbound blocks [00 §2.8].
- **Knack Quirk, Live Wire.** The first chain link does not halve.
- **Unlock.** Clankmouth Mines, suggested 6-1.
- **Why players love him.** He turns the best armor in the game into a wire.

#### 8. Sprocket Tumm `[U3]`

- **Look.** A kid in a teal boiler suit with copper patches. A top hat with goggles strapped on and a key in the crown. Launches a wind-up brass beetle from a box.
- **Personality.** Curious, chatty, takes things apart to see why they work.
- **Barks.** "Wind it up!" / "Go, Beetle, go!" / "That was not in the plans." / "It works! Mostly!"
- **HP.** 90.
- **Passive, Spare Key.** Guided Trick Shells she fires get one extra steer.
- **Knack, Clockwork Beetle.** A slow guided dart. Steered: tap once in flight and it turns toward the tap. Pierce, point shot.
- **Knack Quirk, Second Wind-Up.** Two taps.
- **Unlock.** Clankmouth Mines, suggested 6-9.
- **Why players love her.** One tap in flight gives a second chance to aim. Players who hate wind love her.

### 3.3 Scatterjacks

#### 9. Jax Peppercorn `[Launch]`

- **Look.** Barrel shaped, paprika red coat, black and white check trousers. A tall pepper mill for a hat. Fires from a giant grinder he cranks by hand.
- **Personality.** A market showman. Sells every shot to the crowd.
- **Barks.** "Step right up!" / "A little spice!" / "Achoo! Who threw that?" / "Sold!"
- **HP.** 100.
- **Passive, Extra Shake.** His Plain Shot fires 4 stones. Each deals a little less, for the same total plus one Chip.
- **Knack, Pepper Rain.** One shell splits at the top of its arc into 7 stones that rain on a wide strip.
- **Knack Quirk, Shaker.** Before firing, set Pepper Rain to a narrow or a wide strip.
- **Unlock.** Start of 1-4.
- **Why players love him.** The first Hob that hits lots of things at once. Good for players still learning to aim.

#### 10. Nan Clatterpot `[Launch]`

- **Look.** Tiny, bent, quick. Lavender shawl. A stack of copper pots and pans for a hat that rattles when she moves. Slings with a soup ladle.
- **Personality.** Sharp tongued granny. Calls everyone "dear" and means it as a warning.
- **Barks.** "Eat up, dear." / "Wash these after!" / "Mind my pots!" / "Told you so." Clatter Call bark: "Dinner bell! Get them, dears!"
- **HP.** 100.
- **Passive, Clatter Call.** When Nan's shot (any shot she fires) deals damage to an enemy Hob, each of your Hobs next door to her deals +15% with its next shot. The bonus does not stack (at most +15%), lasts until that Hob fires, and sits inside the 110 Thwack cap and the full-HP clamp. **Read:** a pan icon pops over each next-door Hob's portrait. **Counter:** keep your Nooks closed (her pans are weak on Cobble), Bonk Nan, or shield the Hob she buffs before it fires. Pan Parade walks a line across rooms, so it finds Hobs often; seating her between two shooters is the plan.
- **Knack, Pan Parade.** A run of 5 pans on one aim. Each lands a little farther than the last, so the hits walk across a castle face.
- **Knack Quirk, Marching Orders.** Before firing, set the step between pans to short or long.
- **Unlock.** Clear Trial T3 on the Region 2 side path. If the player skips it, she joins on clearing 2-10 [C02].
- **Why players love her.** Her Knack sweeps a whole wall from left to right. She is a Trial prize, so she marks a skilled player.

#### 11. Dotty Hailstone `[U2]`

- **Look.** Tall thin neck, yellow rain coat, storm blue boots. An open umbrella for a hat with a small weather vane on top. Tips shots out of a rain barrel.
- **Personality.** Chatty, obsessed with weather, right about half the time.
- **Barks.** "Looks like rain." / "Cold front coming!" / "That was not forecast." / "Clear skies!"
- **HP.** 100.
- **Passive, Forecast.** The next Weather Front shows all front long, not just in its last round [C54].
- **Knack, Hailbasket.** The shell splits at the top into 8 ice pellets. Each does Chip Frost damage and makes what it hits Brittle.
- **Knack Quirk, Black Ice.** Ground the pellets hit gets an Ice coat for 3 turns.
- **Unlock.** Frostwhisker Peaks, suggested 5-5.
- **Why players love her.** She makes a whole castle face Brittle in one go. Then the Lobber steps up.

#### 12. Fizz Popkin `[Launch]`

- **Look.** A bouncing kid in pink and lime. A cone party hat with streamers taller than the Hob. A big paper popper under one arm.
- **Personality.** Every day is a party. Cannot keep a secret.
- **Barks.** "Surprise!" / "Pop pop pop!" / "Hey! Party foul." / "Again again!"
- **HP.** 90.
- **Passive, Party Trick.** When Fizz fires a Dud [00 §2.15], it becomes a real burst of confetti bomblets with Chip damage.
- **Knack, Rising Fizz.** A soda bottle on a normal arc. At the top it pops into three bubbles that fall upward. Each bubble pops on first touch for 20 Blast, Small. Aim low and flat so the bubbles rise into roof lips, overhangs, wing necks and high Nook floors from below [01 §3.3].
- **Knack Quirk, Shaken Up.** Before firing, set Rising Fizz to split at the top of its arc or 120 cells after it leaves the Loophole, so the bubbles can rise under a ledge close to the shot.
- **Unlock.** First clear of 3-5.
- **Why players love her.** She makes the joke shell worth a pick in the Rummage. Her bubbles fall the wrong way, and the roof you thought was safe is not.

### 3.4 Delvers

#### 13. Grub Mudgett `[Launch]`

- **Look.** Low and wide, like a turnip. Brown coat caked in dirt. A miner's helmet so big it hides his eyes, with a candle on top. A corkscrew spade.
- **Personality.** Says little. Mumbles. Happy only below ground.
- **Barks.** "Mm. Digging." / "Down we go." / "Mmf." / "Heh. Hole." Broad Back bark: "Mm. Behind me."
- **HP.** 140.
- **Passive, Broad Back.** While Grub is not Bonked, the Hob next door behind him (same row, on the side away from the rival) keeps Cover even if their shared wall breaks. Only the shared wall is excused: if any other block around that Nook goes, Cover goes as normal. If Grub is Bonked, Dropped or Tumbled out of his Nook, the excuse ends at once. **Read:** the shield pip of the Hob behind him shows a small link to Grub's portrait. **Counter:** open Grub's Nook first or Bonk him (140 HP is a lot), lob over him onto the rear Nook's roof, or hit the rear Nook from its other walls. Seat him in the front of the low row with a Zinger or Patcher behind him.
- **Knack, Burrowbomb.** A long bore through ground or 2 castle blocks, then a Medium blast where it stops.
- **Knack Quirk, Clay Teeth.** Burrowbomb bores Clay at full speed and reaches farther.
- **Unlock.** First clear of 1-6.
- **Why players love him.** He removes the hill in the way. His mumbles are the funniest barks in Region 1.

#### 14. Petra Chiselwick `[U3]`

- **Look.** Straight backed, marble white smock, dusty rose scarf. A huge chalky beret. A mallet and a chisel on a spring.
- **Personality.** An artist. Sees every crater as her work and signs it.
- **Barks.** "Hold that pose." / "I call this one Rubble." / "Critics!" / "My best work."
- **HP.** 130.
- **Passive, Fault Finder.** Her Dig deals full damage to Cobble.
- **Knack, Hairline.** A crack shot. Dig damage to the block it hits. Cracks spread to every touching block, which become Brittle.
- **Knack Quirk, Fault Line.** For 1 turn the cracked blocks get no side support. Those with nothing below fall.
- **Unlock.** Rescued in the Mines, suggested 6-6 (the old Canary Row rescue).
- **Why players love her.** She is the answer to stone forts. She sets up the next big hit.

#### 15. Truffle Snoutworth `[Launch]`

- **Look.** Pear shaped with a very big nose. Tan coat. A red spotted mushroom cap for a hat. Carries a basket of drill beets, root vegetables that burrow.
- **Personality.** A happy forager. Sniffs before every shot. Thinks with his nose.
- **Barks.** "I smell a draft." / "Fetch, beet!" / "Ow, my nose." / "Found one!"
- **HP.** 140.
- **Passive, Good Nose.** His preview marks the ground types along the path under ground: Loam, Clay, Rock. In `[U2]` it also reveals any enemy Nook within 1 block of his tunnel.
- **Knack, Molehill Surprise.** The shot burrows, then pushes up a Loam mound where it stops. No damage. Light. Use it as cover for your fort, or raise it against a low enemy Loophole to bury it (section 7.2).
- **Knack Quirk, Packed Dirt.** The mound is Clay, so it holds its shape and carves at half.
- **Unlock.** Rescued in 3-7 [C02].
- **Why players love him.** He adds ground in a game about losing it. Burying a Loophole is a sneaky, legal joy.

### 3.5 Boinkers

#### 16. Bobbin Springheel `[Launch]`

- **Look.** Long legs, short body. Grass green jacket, tan leather apron. A boot for a hat, laces flying. Kicks balls out of a spring loaded shoe.
- **Personality.** A sunny cobbler. Bounces on his toes. Cannot stand still.
- **Barks.** "Best foot forward!" / "Boing!" / "Right in the laces." / "Sole survivor!"
- **HP.** 90.
- **Passive, Extra Hop.** Before firing his Plain Shot, pick 2 hops or 3.
- **Knack, Rolypoly.** A big roller. It rolls along the ground, climbs gentle slopes and bursts at the first wall with a Medium blast. Mud stops it.
- **Knack Quirk, Little Jump.** Rolypoly hops gaps and small steps.
- **Unlock.** First clear of 1-8.
- **Why players love him.** The roller reaches a low Nook that no arc can touch.

#### 17. Skip Pebblewick `[Launch]`

- **Look.** Slouched, sleepy eyed. River blue shirt. A straw hat as wide as a cart wheel, hung with fishing lures. Casts stones with a fishing rod.
- **Personality.** Lazy, calm, half asleep. Hits anyway.
- **Barks.** "Mm? My turn?" / "Skip, skip, skip." / "Hey. I was napping." / "Got a bite."
- **HP.** 90.
- **Passive, Flat Stone.** His shots skip on Water (and Ice in `[U2]`) and lose no speed.
- **Knack, Skimmerstone.** A low flat stone that skips up to 4 times. Each skip is a Tiny blast. The last is Small, 50 Blast. Any touch that cannot skip counts as the last one, so a hill or a ridge still gets the full 50 [01 §3.5]. Skip is never a dead pick on rough ground.
- **Knack Quirk, Roof Skim.** Skimmerstone skips on castle roofs too.
- **Unlock.** First clear of 3-1 (Soggybottom Fen).
- **Why players love him.** Water stops every other Boinker. For Skip it is a road.

#### 18. Lady Carom Bankshot `[U3]`

- **Look.** Tall, poised, burgundy coat. A felt green top hat with a blue chalk cube on the brim. A long cue stick.
- **Personality.** Smug trick shot artist. Calls the shot before she takes it.
- **Barks.** "Off the wall, corner Nook." / "Watch closely." / "A foul!" / "As called."
- **HP.** 90.
- **Passive, Called Shot.** Her preview runs past the first bounce to the second.
- **Knack, Clackerball.** A hard ball that bounces off any surface 3 times and bursts on a Hob or when it comes to rest. It can go into an Open Nook and rattle around inside.
- **Knack Quirk, Room Rattle.** Each bounce inside a room also pops for a little damage.
- **Unlock.** Clankmouth Mines, suggested 6-4. The brass walls of the Mines are her table.
- **Why players love her.** She shows the bounce no one else can see. Expert players main her.

#### 19. Gus Wobblebottom `[U1]`

- **Look.** The roundest Hob. Raspberry coat, mint trim. A jelly mould for a hat with a jelly still in it that shakes. Flings jellies off a spoon.
- **Personality.** Jolly, giggles at everything, most of all at himself.
- **Barks.** "Wibble!" / "Jelly time!" / "Hee hee, that tickled." / "Wobble on!"
- **HP.** 100.
- **Passive, Wobble.** He takes half damage from crush and from falls.
- **Knack, Wobble Jelly.** A jelly blob. Small blast, Light damage. It leaves a sticky patch for 3 rounds. Balls and rollers that touch the patch stop dead [00 §2.10].
- **Knack Quirk, Family Size.** The sticky patch is half again as wide.
- **Unlock.** Long Siege, a first-run milestone (`05` and `02` set which wave).
- **Why players love him.** He is the Boinker who shuts down Boinkers. He survives collapses that flatten the rest.

### 3.6 Sizzlers

#### 20. Ember Toastwell `[Launch]`

- **Look.** Thin, sooty, ember orange scarf. A tall stovepipe hat that puffs real smoke. A coal scuttle on a sling.
- **Personality.** A cheerful sweep. Loves fire. Lectures others on fire safety.
- **Barks.** "Safety first!" / "Mind the hot bits." / "Singed my hat!" / "Toasty."
- **HP.** 100.
- **Passive, Slow Burn.** Burn she causes lasts 3 turns, not 2.
- **Knack, Scaldspill.** Hot soup. A fluid that flows downhill, pools in low spots, then burns for 2 turns. It fills pits, tunnels and Open low Nooks.
- **Knack Quirk, Skin on Top.** Scaldspill floats and burns on Water.
- **Unlock.** First clear of 2-1.
- **Why players love her.** Fluid finds its own way in. She pairs with every Delver.

#### 21. Frostine Nippet `[U2]`

- **Look.** Small, bundled up, mint and white with pink mittens. A bobble hat with ear flaps down to her knees. A big ice scoop.
- **Personality.** Chirpy, always cold, sniffles between words.
- **Barks.** "Brrr! Here goes." / "Chilly scoop!" / "A-choo!" / "Ice work!"
- **HP.** 100.
- **Passive, Cold Hands.** Frost never adds Rest to her.
- **Knack, Shiverpuff.** A cold cloud. A Large field that lasts 2 turns. Blocks in it turn Brittle. Hobs in it need a rest (Rest +1, within the cap of 1 extra). Water in it turns to Ice.
- **Knack Quirk, Fog Bank.** The cloud drifts with the wind each turn.
- **Unlock.** Frostwhisker Peaks, suggested 5-1.
- **Why players love her.** She slows the rival's best Hob and softens its walls in one shot.

#### 22. Brine Picklewick `[Launch]`

- **Look.** Squat, pickle green coat, glass blue gloves. A pickle jar for a hat with one pickle afloat in it. A barrel with a squirt pump.
- **Personality.** Sour and deadpan. Not one smile. Secretly the kindest of the lot.
- **Barks.** "Fine. I'll do it." / "Brine." / "Typical." / "Could be worse."
- **HP.** 110.
- **Passive, Briny.** His Plain Shot can be aimed at your own castle. There it does no damage, ends Burn and leaves Soaked.
- **Knack, Drenchbarrel.** A flood. Water that pools, makes Soaked, ends fires and turns Loam to Mud. Mud triples the rival's Walk cost and stops rollers. Light.
- **Knack Quirk, Flash Flood.** Drenchbarrel shoves props twice as far and washes off every coat.
- **Unlock.** First clear of 3-9.
- **Why players love him.** He is the fire brigade and the mud maker. A defensive Sizzler is a fresh idea.

### 3.7 Patchers

#### 23. Hetty Mortarboard `[Launch]`

- **Look.** Square, sturdy, brick red dress, grey apron. A flat mason's board for a hat with a blob of mortar on top. A big trowel.
- **Personality.** A bossy school teacher. Marks everyone's work, the rival's too.
- **Barks.** "Sit up straight." / "Do it again, properly." / "Who did that?" / "Full marks." Ridgepole bark: "Nobody moves. The roof stays."
- **HP.** 110.
- **Passive, Ridgepole.** While Hetty is not Bonked, the blocks in her column above her Nook (the two block columns straight above it, up to the top of the fort) cannot fall from lost support. They still break at 0 HP, and Heavy Gravy and the Squall still work on them. If Hetty is Bonked, or Dropped or Tumbled out of her Nook, the support check runs at once and what she held falls as one chunk, with crush. Same sim rule as the Shoring Crew's brace [01 Twist 5]. **Read:** a glowing rafter line runs up her column. **Counter:** focus her (110 HP and Cover like anyone), hit the blocks beside her column, or use Heavy Gravy. Her Bonk is often the biggest collapse of the fight, so a daring overhang on her is a real choice for both players.
- **Knack, Barn Raising.** Pick one. Rebuild up to 4 lost blocks that still have support. Or, once per battle, Puff Up: re-inflate one Bonked Hob at 40 HP in the lowest free Nook [00 §2.9]. Puff Up is for the player side only against the AI; in Couch Duel both sides may use it [00 §6.1]. Rival Patchers rebuild but never re-inflate [B9].
- **Knack Quirk, Fresh Paint.** Rebuilt blocks and the blocks they touch lose Burn (and Brittle in `[U2]`).
- **Unlock.** Rescued in 1-7 [C02]. This gives the player a Patcher for the cart in 1-9.
- **Why players love her.** She brings a friend back, and she holds the roof up while she stands. No other moment gets a bigger cheer.

#### 24. Poultice Plumley `[Launch]`

- **Look.** Soft and slow, sage green robe, cream shawl. A teapot in a knitted cosy for a hat, spout forward, with steam. Pours from a second teapot.
- **Personality.** Soothing, sleepy, offers tea in the middle of a siege.
- **Barks.** "Tea, anyone?" / "There, there." / "Oh my. Spilled." / "Lovely."
- **HP.** 110.
- **Passive, Tea Round.** Once per battle, at the start of your turn, if a Hob in your crew is under half HP, she pours it a cup: it heals 20. No Action spent.
- **Knack, Bubble Bonnet.** A steam bubble around one of your Nooks or the Kettle Room. It soaks the next hit, up to Heavy band damage, or fades after 2 rounds.
- **Knack Quirk, Double Bubble.** The bubble soaks two hits, with the same total cap.
- **Unlock.** First clear of 3-3.
- **Why players love her.** She is the crew's nurse. The bubble on the kettle wins close races.

#### 25. Rivet Brasstack `[U1]`

- **Look.** Broad shoulders, oil blue overalls, brass buckles. A welder's helmet tipped back, far too big, with a row of rivets. A rivet hammer.
- **Personality.** Blunt, tough, proud of her work. Hates a weak joint.
- **Barks.** "Hold this." / "Built to last." / "That'll buff out." / "Solid."
- **HP.** 120.
- **Passive, Overbuild.** A block she brings back from 0 HP returns as Brassbound for this battle.
- **Knack, Scrap Stack.** She throws up a wall of scrap 3 blocks tall on the ground where you aim. It blocks flat shots. To the other side it is a foreign block [C15].
- **Knack Quirk, Spiky Bits.** Rollers and bouncers that touch the scrap burst there.
- **Unlock.** Long Siege, a first-run milestone (`05` and `02` set which wave).
- **Why players love her.** Her repairs come back stronger than before. The scrap wall is the hard answer to Zingers.

### 3.8 Peepers `[U2]`

#### 26. Winkle Spyglass `[U2]`

- **Look.** Thin and twitchy, sky grey coat, robin red scarf. A bird's nest for a hat with a small bird in it that points where she looks. A spyglass that puffs chalk.
- **Personality.** A whispering bird watcher. Gets far too excited and then shushes herself.
- **Barks.** "Shh. I see one." / "There! No, there!" / "My nest!" / "Spotted!"
- **HP.** 80.
- **Passive, Sharp Eyes.** Hobs she reveals also show their Rest cog and their Knack uses left.
- **Knack, Chalk Fan.** A fan of 5 harmless chalk arcs. They stay all battle and reveal every room they cross. Light.
- **Knack Quirk, Sharp Chalk.** Each arc ends in a pin you can Recall.
- **Unlock.** Frostwhisker Peaks, suggested 5-3. The first Peeper.
- **Why players love her.** She draws five aim lines for the whole crew to use. Her bird has its own fans.

#### 27. Echo Hootley `[U2]`

- **Look.** Round chest, midnight blue coat, gold buttons. A great brass bell for a hat that rings when hit. A hand bell on a long handle.
- **Personality.** A town crier. A scout who cannot whisper. Proud of it.
- **Barks.** "HEAR YE!" / "BONG!" / "MY EARS!" / "ALL IS WELL!"
- **HP.** 90.
- **Passive, Hear Ye.** When an enemy Hob fires, its Nook stays revealed for one round.
- **Knack, Tattle Bell.** A ringing bell. No damage. Light. It reveals every Nook in a Huge radius. Hobs it reveals are Marked: the next hit on each deals 20% more [C20].
- **Knack Quirk, Long Ring.** Its reveals hold through soot and smoke.
- **Unlock.** Frostwhisker Peaks, suggested 5-7.
- **Why players love him.** The loud scout is a great joke. His mark turns a scout shot into real damage.

#### 28. Tansy Featherlight `[U2]`

- **Look.** Light and long limbed, paper white tunic, ink blue trim, a red ribbon. A folded paper boat for a hat. Flies paper kites from a reel.
- **Personality.** A day dreamer. Looks at clouds. Speaks in half thoughts.
- **Barks.** "Oh. Hello, wind." / "Off you float." / "Mm? Was that me?" / "Pretty."
- **HP.** 80.
- **Passive, Paper Trail.** Ghost lines of every Hob on your side stay for 3 shots, not 2.
- **Knack, Snoop Kite.** A kite you fly. Steered: drag steers it for 3 seconds. It reveals each Nook it passes over and ends in a Chip pop. Light.
- **Knack Quirk, Tail Bow.** Before firing, pick: end in a pop or in a small soot cloud.
- **Unlock.** Frostwhisker Peaks, suggested first clear of 5-8. She drifted north on a kite when the Countess's wing fled, and lands at your fort after the dam falls.
- **Why players love her.** Flying the kite is a calm, hands-on break in a tense fight. Her passive helps every aimer.

### 3.9 Unlock order

| Region | Hobs that join | Running total | Tag |
|---|---|---|---|
| 1 Puddingstone Downs | Marge (1-1), Quill (1-2), Jax (1-4), Grub (1-6), Hetty (1-7, rescued), Bobbin (1-8) | 6 | `[Launch]` |
| 2 Crumblecrag | Ember (2-1), Old Thumper (2-3), Dame Flicka (2-8, rescued), Nan (T3 path or 2-10) | 10 | `[Launch]` |
| 3 Soggybottom Fen | Skip (3-1), Poultice (3-3), Fizz (3-5), Truffle (3-7, rescued), Brine (3-9) | 15 | `[Launch]` |
| 4 The Flats | Pip (4-8, rescued) | 16 | `[Launch]` |
| Long Siege | Gus, Rivet (first-run milestones) | 18 | `[U1]` |
| 5 Frostwhisker Peaks | Frostine (5-1), Winkle (5-3), Dotty (5-5), Echo (5-7), Tansy (5-8) | 23 | `[U2]` |
| 6 Clankmouth Mines | Wick (6-1), Bartleby (6-3), Lady Carom (6-4), Petra (6-6, rescued), Sprocket (6-9) | 28 | `[U3]` |

- Region 1 gives 6 Hobs in 6 Classes. That is enough to feel squad choice before Region 2.
- All 7 launch Classes are in hand by 2-1. The Peeper Class arrives in Region 5.
- Each region's Hobs fit its ground: fen Hobs like water, peak Hobs like wind and frost, mine Hobs like metal.
- The Flats add one Hob only. The last stretch before the Baron tests the squad you have.
- Update levels are suggestions. `05` owns them.

---

## 4. Squad building

### 4.1 Crew size by stage `[Launch]`

| Stage | Hobs in battle | Hobs owned | Note |
|---|---|---|---|
| 1-1 | 1 | 1 | Marge alone [00 §8.3] |
| 1-2 and 1-3 | 2 | 2 | Quill joins |
| 1-4 to 1-6 | 3 | 3 | Jax joins |
| 1-7 on | 4 | 4 to 6 | Grub joined at 1-6. Hetty is rescued here. First real choice: who stays home |
| After Grand Fort 2 (2-10) | 5 | about 10 to 12 | A free gift, per `00`. No level needs it |

Rules:

- The crew cap is 5 [B3]. A level may set a lower cap for a puzzle.
- You may bring fewer Hobs than the cap. No reward, no penalty.
- No two copies of one Hob. Two Hobs of one Class is fine.
- A Blueprint must have at least as many Nooks as seated Hobs. Grid growth that seats the campaign crew is a free gift, not a node [C04], [B3].
- The one pre-battle screen shows the rival's Class icons, so you can swap a Hob with one tap. Last picks are kept [B15].
- Trials fix the crew. Skirmish lets you set both crews. In Couch Duel each player brings a crew from the save, a guest save or a loaner fort, and may cap crew size as a handicap [00 §6.1].

### 4.2 Squad shapes

A good crew of 4 covers four jobs. The pre-battle screen shows four small lamps that light when a job is covered. It is a hint, never a rule.

| Job | Who covers it |
|---|---|
| Break walls | Lobber, Delver, Scatterjack |
| Hunt Hobs | Zinger, Boinker, Scatterjack |
| Shape the field | Sizzler, Delver, Boinker |
| Help the team | Patcher (and Peeper in `[U2]`) |

Starter shapes the Almanac suggests:

- **The Hammer** `[Launch]`: 2 Lobbers, Delver, Patcher. Go for the Kettle Pop.
- **The Hunt** `[Launch]`: 2 Zingers, Scatterjack, Boinker. Go for the Clean Sweep. In `[U2]` swap the Boinker for a Peeper.
- **The Slow Burn** `[Launch]`: 2 Sizzlers, Patcher, Lobber. Set the fort alight, hold your own walls, then pop the kettle while the rival burns. Sudden Squall from round 15 means a crew cannot win by waiting [B5].
- **The Circus** `[Launch]`: 2 Boinkers, Delver, Scatterjack. For players who want Brag Clips.

### 4.3 Synergy pairs

| # | Pair | Why it works | Tag |
|---|---|---|---|
| 1 | Dotty Hailstone + Marge Dumpling | Hail makes a whole face Brittle. Marge's big pot then hits every block at x1.5 | `[U2]` |
| 2 | Petra Chiselwick + Bartleby Boulderbun | Petra cracks stone. Bartleby's stone punches through the cracked block and the one below | `[U3]` |
| 3 | Winkle Spyglass + Quill Needlesworth | Chalk arcs find the Nook. Quill threads the Loophole on the first try | `[U2]` |
| 4 | Pip Skyward + Dame Flicka Brightspur | Pip's Chimney Drop opens a roof. Flicka walks, then jousts the Hob below | `[Launch]` |
| 5 | Grub Mudgett + Ember Toastwell | Grub digs a channel to the base. Ember's hot soup runs down it and pools at the wall | `[Launch]` |
| 6 | Truffle Snoutworth + Bobbin Springheel | Truffle builds a ramp. Bobbin's roller runs up it and over a low wall | `[Launch]` |
| 7 | Brine Picklewick + Wick Glimmer | Brine soaks Hobs and blocks. Wick's spark beam deals x1.5 to Soaked targets [C22] | `[U3]` |
| 8 | Fizz Popkin + Jax Peppercorn | Seven stones strip the roof top. Fizz's bubbles crack the roof lip from below, and the loosened roof drops | `[Launch]` |
| 9 | Hetty Mortarboard + Old Thumper Grumbleby | Thumper's ticking pot draws fire to him. Hetty mends his Nook each turn until it blows | `[Launch]` |
| 10 | Poultice Plumley + Quill Needlesworth | The 80 HP sniper gets a steam bubble when hunted and a cup of tea when low | `[Launch]` |
| 11 | Rivet Brasstack + Sprocket Tumm | The scrap wall blocks flat shots at your fort. Sprocket's beetle steers around it | `[U3]` |
| 12 | Skip Pebblewick + Brine Picklewick | Brine floods the low ground. Skip's stone runs across the new pond | `[Launch]` |
| 13 | Gus Wobblebottom + Brine Picklewick | Sticky patch plus Mud. Enemy rollers stop and the rival's Walk costs triple | `[U1]` |
| 14 | Fizz Popkin + Pip Skyward | Pip hits the roof from above, Fizz from below. A roof hit from both sides falls in two turns | `[Launch]` |
| 15 | Tansy Featherlight + Lady Carom Bankshot | Three ghosts per Hob plus a two-bounce preview. Bank shots become a science | `[U3]` |
| 16 | Wick Glimmer + Echo Hootley | Two cheap reveal sources. The rival's whole crew is known by Round 3 | `[U3]` |
| 17 | Nan Clatterpot + Ember Toastwell | Nan's pans strip a Wicker face. Fire spreads through what is left | `[Launch]` |
| 18 | Grub Mudgett + Quill Needlesworth | Grub in the front low Nook, Quill right behind him. Broad Back keeps her Cover when the wall between them goes, so the 80 HP sniper lasts | `[Launch]` |
| 19 | Nan Clatterpot + Old Thumper Grumbleby | Seat them next door. Nan's pan finds a Hob and Thumper's crock or pot hits 15% harder next turn | `[Launch]` |
| 20 | Hetty Mortarboard + Dame Flicka Brightspur | Ridgepole holds a daring overhang above Hetty. Flicka sits in it with a clear lance line | `[Launch]` |

### 4.4 Synergy trios

| # | Trio | Plan | Tag |
|---|---|---|---|
| 1 | **Crack, Frost, Crash:** Petra + Dotty + Marge | Two ways to make Brittle, one big blast to cash it in | `[U3]` |
| 2 | **See, Mark, Stick:** Winkle + Echo + Quill | Reveal, mark for 20% more, then thread. A Clean Sweep engine | `[U2]` |
| 3 | **Dig, Pour, Light:** Grub + Ember + Jax | Channel, hot soup, then stones on the burning rubble | `[Launch]` |
| 4 | **The Bog:** Brine + Gus + Truffle | Mud, sticky patch and a mound. The rival cannot walk, roll or shoot flat | `[U1]` |
| 5 | **The Turtle:** Hetty + Rivet + Poultice | Mend, overbuild and bubble while the rival spends its Knacks, then a late Kettle Pop. Sudden Squall stops a pure wait [B5] | `[U1]` |
| 6 | **The Ice Rink:** Frostine + Skip + Lady Carom | Ice field, then skips and banks that gain speed | `[U3]` |
| 7 | **Kettle Crackers:** Wick + Quill + Bartleby | Bartleby opens the path. Two beams do full damage to the Heartkettle | `[U3]` |
| 8 | **Sky Crew:** Pip + Fizz + Flicka | Drop on the roof, bubble it from below, skewer the rooms that open | `[Launch]` |

### 4.5 Anti-synergies

The pre-battle screen shows a small "clash" icon when a crew has one of these. It warns. It does not block.

| # | Mix | What goes wrong | Tag |
|---|---|---|---|
| 1 | Ember + Frostine on one target | Fire melts Ice to Water and Water ends Burn. They erase each other's work | `[U2]` |
| 2 | Brine + Ember | A flood puts out your own fires. Aim them at different sides of the fort | `[Launch]` |
| 3 | Gus or Brine + your own Boinkers | Your sticky patch and Mud stop your rollers too | `[Launch]` |
| 4 | Truffle or Rivet + your own Zingers | Your mound or scrap wall blocks your flat pins. Own shots pass your castle, not your ground | `[Launch]` |
| 5 | Three or more Heavy Knack Hobs | Thumper, Bartleby and friends all sit resting at once | `[Launch]` |
| 6 | Two Peepers | A second scout adds little | `[U2]` |
| 7 | Two Patchers and no demolisher | You hold, but you cannot finish. Sudden Squall wears both forts down and the rival hits harder | `[Launch]` |
| 8 | Sizzler in a Wicker fort | One return fire pot and your own zone maker burns | `[Launch]` |
| 9 | Four Hobs under 100 HP | One good burst shell into the fort ends the fight | `[Launch]` |
| 10 | Delvers on Rock maps | The map preview shows Rock. Leave them home | `[Launch]` |
| 11 | Old Thumper or Nan with no one next door | Old Grudge and Clatter Call never fire. The Workshop shows the empty links | `[Launch]` |
| 12 | Hetty under a Cobble overhang with no columns | Bonk Hetty and the whole held stack falls on your crew at x2 crush | `[Launch]` |

### 4.6 Balance guards

- Bots log pick rate and win rate per Hob each night [00 §10.3]. Flag any Hob in more than 40% of winning crews.
- A fix never lowers a Hob the player has trained. Buff the others, or refund in full [00 §3].
- No Hob is needed for any level on Fair. Every level must be winnable with the six Region 1 Hobs and the free crew gifts.

---

## 5. Hob growth: ranks and Quirks `[Launch]`

### 5.1 Ranks

- **Three ranks** [B8]. A Hob joins at Rank 0. Training buys Rank 1, 2 and 3. Each rank adds one Quirk, picked from two.
- **Paid with Buttons. Instant. No timers** [00 §5.4]. `02` owns the costs.
- **No HP per rank. Nothing else scales.** No damage growth. Skill stays in charge.
- **New Hobs join at a fair rank:** a Hob that joins after Region 1 joins at the Rank of your fifth-highest Hob, free [02 §2.1]. A late Hob is never a chore to catch up.
- **Rank shows on the hat:** a small stitched band on the brim per rank. No number over the head in battle.

### 5.2 Quirks

A Quirk is a behavior perk. Swaps are free at any time outside battle [00 §3]. Ranks 1 and 2 offer a Class pair, so learning one Lobber teaches them all. Rank 3 offers one Class Quirk or the Hob's own **Knack Quirk** (listed on each Hob in section 3). The Knack Quirks are the best ideas from the old Knack tiers [B8]. `01` owns their numbers.

Launch count: 7 Classes x 2 ranks x 2 = 28 Class Quirks, 7 rank 3 Class Quirks, and 16 Knack Quirks. The Peeper rows and the 12 update Knack Quirks ship with their Hobs.

| Class | Rank 1: pick one | Rank 2: pick one | Rank 3 Class option (or the Knack Quirk) | Tag |
|---|---|---|---|---|
| Lobber | **Short Fuse:** Plain Shot bursts just above the first thing it would hit. **Thick Pot:** Plain Shot feels wind at 0.8 | **Dust Up:** blasts carve 20% more ground. **Soft Touch:** your blasts deal half damage to your own blocks and Hobs | **Big Finish:** the last Knack use has a blast one band larger | `[Launch]` |
| Zinger | **Long Draw:** pin speed up 15%. **Light Pin:** pin ignores wind | **Follow Up:** hitting the same Hob twice in a row adds 10 damage. **Chipper:** pins deal x0.8 to Cobble in place of x0.6 | **Clean Line:** the Knack passes 2 walls at 70% damage | `[Launch]` |
| Scatterjack | **Tight Pack:** fan narrows by a third. **Wide Cast:** fan is 5 stones at 8 damage each | **Ricochet:** stones that hit Cobble or better bounce once before they pop. **Grit:** stones deal x1.0 to Cobble | **Double Batch:** Knack bomblets up by a third, each 20% weaker | `[Launch]` |
| Delver | **Deep Breath:** Plain Shot bores 1 block farther. **Wide Bore:** tunnels are 2 cells taller | **Prop It:** tunnels you dig under your own castle do not cause a Thump. **Loose Dirt:** dug Loam piles up as a mound at the tunnel mouth | **Back Door:** the Knack burst is one band larger | `[Launch]` |
| Boinker | **Dead Ball:** pick 1 hop for 25% more damage. **Live Ball:** balls keep 80% speed per hop | **Mud Shoes:** balls hop once on Mud before they stop. **Wall Hug:** balls roll up one-block steps | **Encore:** if a Knack shot Bonks a Hob, it does not use a charge | `[Launch]` |
| Sizzler | **Wide Pot:** Plain Shot blast one band larger, damage down 20%. **Hot Pot:** the first Burn tick lands at once | **Wildfire:** Burn you cause spreads twice. **Stew:** your fields last 1 more turn | **Deep Pour:** fluid volume up by a third | `[Launch]` |
| Patcher | **Thick Mix:** mended blocks gain 20 HP over their cap until hit. **Long Arm:** mend works on blocks with no support if they touch a standing block | **Field Kit:** mending a Nook wall also heals the Hob inside 10. **Splat:** the glob deals 20 to enemy blocks | **Two Trowels:** Mendglob may mend two touching blocks for 30 each | `[Launch]` |
| Peeper | **Bright Chalk:** marker Ghost lines last all battle. **Sting:** marker deals 12 | **Wide Eye:** reveals reach 1 block farther. **Tag:** the last Hob you revealed takes 10% more from all hits | **Eagle Line:** one chalk arc of your choice shows the full path | `[U2]` |

Notes:

- Every Quirk pair offers an aim helper against a power option, so both new and expert players find a pick.
- Hob Passives and Quirks stack unless the text says they do not.
- AI Hobs use Quirks only on Stubborn and Ironclad, and the Rival card shows them.
- Old Quirks that add Knack uses (Third Helping, Trick Bag) and that add input in flight (Late Split) are parked. They broke the Plain Shot share target [C30] or the no-input rule [01 §1.1 rule 6].

### 5.3 Mastery and Deeds `[U1]`

Mastery is a play track for each Hob. It runs beside ranks and costs nothing. It gives no power at all.

- **How it grows.** Each Hob has a page of **Deeds** in the Almanac. A Deed is a small feat done in battle with that Hob. Each Deed done adds one Mastery point.
- **Ranks.** Five Mastery ranks: Green, Handy, Seasoned, Proud, Legend. `02` sets the points per rank.
- **Rewards.** All cosmetic or story: an Outfit, a new cheer, a hat trim in gold thread, an Almanac story page, a Keepsake for the Curio Shelf at Legend.
- **No grind rule.** Deeds count in any mode on any difficulty. Cozy counts. No Deed needs a loss, a long wait or a huge count.
- **Size.** 6 Deeds per Hob in U1 (108 for 18 Hobs). Later Hobs bring their own Deeds.

Deed patterns:

| Pattern | Example |
|---|---|
| Class basics | Marge: hit a block with a Plain Shot from the top row |
| Passive in use | Dame Flicka: land a shot after a Walk, 5 times |
| Knack pay-off | Old Thumper: Bonk a Hob with the Tick-Tock Crock |
| Skill shot | Quill: thread 3 Loopholes in one battle |
| Slapstick | Gus: survive a floor drop of 3 blocks or more |
| Win path | Ember: land the last hit of a Kettle Pop with Burn |

### 5.4 Crew Bonds `[U2]`

When two Hobs finish a pair Deed together, they gain a Bond: one new caption line each aimed at the other ("Nice pour, Ember." / "Nice hole, Grub."). No stats. It rewards trying the synergy pairs in section 4.3.

### 5.5 What never happens

- No rarity tiers. No duplicates. No shards [02d §1.6.1].
- No Hob is sold, rented or timed.
- No change that takes away a trained rank [02d §1.6.2].
- No stat ever locked behind Mastery.

---

## 6. Animation list

### 6.1 Rules for all Hob animation

- Hobs are view only. The sim never waits on an animation [00 §2.7].
- The hat carries the acting. Every state must read from the hat and body shape alone at 24 px [00 §10.3].
- Bloodless slapstick only: stars, soot, popped buttons, squeaks [00 §1.4].
- Each state has a reduce motion version with no bounce and no flash [00 §8.2].
- Loops are short. Target 6 to 12 frames per loop, or one rigged loop of about 1 second.

### 6.2 Core set (every Hob) `[Launch]`

| # | State | Trigger | Length | Notes |
|---|---|---|---|---|
| 1 | **Idle** | Default | Loop, about 2 s | Breathing bob. One personal fidget every 6 to 10 s |
| 2 | **Idle, picked** | Hob is the active shooter | Loop | Stands tall, hat tips toward the rival, soft glow at the feet |
| 3 | **Aim** | Aim Drag or Fine Tune | Pose blend | Body leans with the angle. Tool rises with power. Three power poses: low, mid, full |
| 4 | **Fire** | Fire pressed | 0.3 to 0.5 s | Wind up, release, recoil. Hat jumps and lands. The shell leaves on the release frame |
| 5 | **Follow** | Shell in flight | Hold | Hand over eyes, watching the arc. Head tracks the shell |
| 6 | **Hit, light** | Chip or Light damage | 0.3 s | Flinch. Hat spins a quarter turn. One star |
| 7 | **Hit, heavy** | Standard damage or more | 0.6 s | Knocked flat, hat lands on face, soot puff, two buttons pop |
| 8 | **Bonked** | HP 0 | 0.8 s | Eyes spin, body wobbles in a circle, sits down |
| 9 | **Snooze Balloon inflate** | After Bonked | 0.6 s | A balloon pops out of the hat with a squeak |
| 10 | **Snooze Balloon float** | After inflate | Loop until off screen, about 2 s | Hob hangs limp, snoring "Zzz" letters, drifts up and with the wind |
| 11 | **Cheer** | Own hit lands, Bonk, win | 0.8 s | Personal victory move. Hat thrown and caught |
| 12 | **Groan** | Own miss, ally Bonked | 0.6 s | Slump, hat droops |

### 6.3 State and status set (every Hob)

| # | State | Trigger | Notes | Tag |
|---|---|---|---|---|
| 13 | **Needs a rest** | Rest above 0 | Sits on the floor, fiddles with the tool. Small cog spins over the hat [00 §2.2]. Also used when Frost adds Rest in `[U2]` [B16] | `[Launch]` |
| 14 | **Open** | Its Nook loses a block | Peeks out, ducks back. Idle changes to a crouch | `[Launch]` |
| 15 | **Drop** | Floor breaks | Hangs in the air for 3 frames, hat stays up a beat longer, then falls | `[Launch]` |
| 16 | **Land** | End of a drop | Splat, pops back into shape, dusts off | `[Launch]` |
| 17 | **Tumbled** | Fell out of the castle | Rolls down the rubble, sits up with stars | `[Launch]` |
| 18 | **Climb back** | After Tumbled | Scrambles up the Stompers and in through the lowest free Nook | `[Launch]` |
| 19 | **Squashed** | A chunk lands on it | Flattened like a pancake, pops back | `[Launch]` |
| 20 | **Dug in** | Its Loophole is buried | Pushes at the dirt, spits out a clod | `[Launch]` |
| 21 | **Burn** | Has Burn | Hat smokes, Hob hops from foot to foot, pats hat | `[Launch]` |
| 22 | **Soaked** | Has Soaked | Hat droops, water drips, shakes like a dog once | `[Launch]` |
| 23 | **Brittle** | Has Brittle | Thin frost cracks on the hat, holds very still | `[U2]` |
| 24 | **Mended** | Healed by a Patcher | Small sigh, a plaster appears on the hat | `[Launch]` |
| 25 | **Re-inflate** | Brought back by Puff Up | Balloon reels back down, Hob wakes with a start | `[Launch]` |
| 26 | **Taunt** | Rival misses wide | Small personal jab. Never rude | `[Launch]` |
| 27 | **Muster wave** | Battle start fly-by | Looks at the camera, waves or hides, by personality | `[Launch]` |
| 28 | **Win pose and lose pose** | Result card | One held frame each | `[Launch]` |

Total: 28 states per Hob (27 at launch). States 1 to 12 are needed for the first playable. States 13 to 28 can share a rig and ship in two passes.

### 6.4 Personal touches

Each Hob has its own idle fidget, fire style, cheer and Snooze Balloon. The balloon is a strong brand read, so each is distinct. Tags follow the Hob.

| Hob | Idle fidget | Fire | Cheer | Snooze Balloon |
|---|---|---|---|---|
| Marge Dumpling | Dusts flour off her hands | Slides the pot off the peel | Claps flour clouds | Cream, shaped like a bread roll |
| Old Thumper Grumbleby | Nods off, snaps awake | Flips the cane spoon | One small nod | Striped like his nightcap |
| Pip Skyward | Jumps to see over the sill | Whole body sling, falls over | Runs in a circle | A tiny kite balloon with a tail |
| Bartleby Boulderbun | Straightens his tiny hat | Slow overhand heave | Shy thumbs up | Very big balloon, strains to lift him |
| Quill Needlesworth | Picks lint off her sleeve | One crisp snap | Small tidy bow | Silver, with a stitched seam |
| Dame Flicka Brightspur | Salutes no one | Lunges with the lance | Raises the lance, plume bobs | Red and gold with a pennant |
| Wick Glimmer | Cups the lantern flame | Taps with the pole, flinches | Lantern flares bright | Glows from inside like a lamp |
| Sprocket Tumm | Winds the hat key | Opens the box, beetle zooms | Goggles down, fist pump | Brass colored, with a key that turns |
| Jax Peppercorn | Juggles pepper pots | Cranks the grinder fast | Arms wide to the crowd | Check pattern, sneezes pepper |
| Nan Clatterpot | Stirs a pot on her head | Ladle flick, pans clang | Bangs two lids | Copper pot lid with a balloon under it |
| Dotty Hailstone | Holds a hand out for rain | Tips the barrel | Spins the umbrella hat | Grey cloud that drips |
| Fizz Popkin | Blows a party horn | Pulls the popper string | Throws confetti | Bright party balloon with streamers |
| Grub Mudgett | Sniffs the floor | Stabs and twists the spade | Low chuckle, candle flares | Brown, with a clod of dirt on top |
| Petra Chiselwick | Frames the view with her fingers | Mallet tap on chisel | Signs the air | White, with a paint smear |
| Truffle Snoutworth | Sniffs left, sniffs right | Drops a beet, it drills off | Pats his nose | Red with white spots |
| Bobbin Springheel | Bounces on his toes | Kicks the spring shoe | Back flip | Boot shaped |
| Skip Pebblewick | Asleep under the hat | Lazy cast, one eye open | Yawns, small wave | Straw yellow, drifts sideways |
| Lady Carom Bankshot | Chalks her cue | Lines up, one clean strike | Blows chalk off the tip | Felt green, round as a ball |
| Gus Wobblebottom | Hat jelly wobbles, he giggles | Spoon fling | Belly laugh, whole body shakes | Pink jelly dome that wobbles |
| Ember Toastwell | Warms her hands at her hat | Swings the scuttle | Tips her smoking hat | Soot black with an orange glow |
| Frostine Nippet | Shivers, rubs mittens | Scoop and toss | Sneezes a snowflake | Mint, frosted, sheds snow |
| Brine Picklewick | Sighs, checks the pickle | Two bored pumps | One slow blink | Jar glass blue, pickle inside |
| Hetty Mortarboard | Taps her foot, checks walls | Trowel flick | Draws a tick in the air | Brick red, square edged |
| Poultice Plumley | Sips tea | Pours a long arc | Raises a cup | Tea cosy pattern, steams |
| Rivet Brasstack | Tests a wall with her fist | Hammer swing | Flips her mask down, nods | Brass, with rivets |
| Winkle Spyglass | Bird and Hob look opposite ways | Puff from the spyglass | Bird sings | Grey with a red breast, bird rides on top |
| Echo Hootley | Clears his throat, loud | Rings the hand bell | Hat bell rings, he beams | Gold bell shape, bongs softly |
| Tansy Featherlight | Watches a cloud | Lets the kite go | Soft smile, small wave | A folded paper balloon |

### 6.5 Sound hooks

One voice set per Class (14 events), pitch-shifted per Hob [C86]. Each Hob's barks above are caption lines over that set, plus select, rest done, Tumbled, Mended, ally Bonked, win and lose. The snore loop and balloon squeak are pitch shifts of one Class sound. The audio doc owns the cast and the mix. Voice has its own volume slider [00 §8.2].

---

## 7. Castle crew placement rules and puzzles

### 7.1 Seating rules `[Launch]`

1. One Hob per Nook. A Nook never holds two Hobs.
2. Any Hob may sit in any Nook. Nothing is locked and no seat gives a perk. Height, depth and cover do the work [B7].
3. Seating is saved in the Blueprint [00 §2.9]. The pre-battle screen lets you swap two Hobs with one drag.
4. Spare Nooks are allowed and useful. An empty Nook is a place to climb to after a drop or a Tumble.
5. The game never fakes info on its own. Fakes come only from named tools that both sides may use and the AI reads as a player would [C76].
6. The Kettle Room holds no Hob.

### 7.2 Loopholes `[Launch]`

The core doc says each Nook has a Loophole on the side that faces the rival, and shots launch from it [00 §2.2, §2.7].

- **Shape.** A slot 6 cells tall in the front wall of the Nook, at Hob chest height. It is art and a hit zone. It does not weaken the wall block.
- **Launch.** Your shots start at the Loophole and pass your own blocks [00 §2.7]. A deep Nook costs a little range, since the shot starts farther back. Its gain is the blocks in front of it.
- **Threading.** A point shot with the Threads keyword (a Hatpin, a beam, a guided dart) that enters the slot hits the Hob inside for full damage. Cover does not apply. The game calls out "Threaded!" and scores Skill Factor 1.5. Blasts, fluids and fields never thread [C14].
- **Loophole Flap** [00 §2.10]. After a Thread passes a Loophole, a flap drops over it. Until the Weather Front changes, no Thread can pass that Loophole: a point shot that reaches it hits the wall block. The Hob inside still fires. The flap shows on the fort with the rounds left. Both sides, every preset. So a found line pays once per front, and the next Thread needs a new Loophole or a new front.
- **Front wall gone.** The Hob fires from the open gap. The Nook is Open (section 7.4).
- **Buried Loophole.** Your shots pass your castle, not the ground or blocks the other side placed. If ground or a foreign block (a mound, a pit wall, a bush, a scrap wall) covers a Loophole, that Hob's Fire button greys and its portrait shows a "dug in" icon [B9], [C15]. Pick another Hob, or **Shove Off**: in your Walk step pay 15 Steam to clear that Loophole, and the Hob may fire this turn with no Action lost [00 §2.7]. Any blast on the dirt clears it. Any Delver shot or a Mendglob on the Nook clears it too. If every live Hob in your crew is dug in at the start of your turn, the newest burial clears by itself, so you never lose a turn [00 §2.7, 01 §1.6].
- **High and low.** A high Loophole clears hills and adds range. A low Loophole gives flat runs for pins, balls and bores. This is the main seat choice.
- **What the rival sees.** Loopholes show on the outside of every castle at all times, as dark slots.

### 7.3 Cover `[Launch]`

- **Intact** means every block on all four sides of the Nook stands: floor, ceiling, front and back, up to 8 blocks for a 2 x 2 room. A Footing floor counts. HP does not matter. A wall at 1 HP still gives Cover [C09].
- **Open** means any one of those blocks is gone. An Open Nook gives no Cover.
- **What Cover halves.** Area payloads (blast band Tiny or larger) centred outside an intact Nook are halved, whatever the damage type [C10].
- **What Cover does not halve.** Point hits, threaded shots, Burn ticks, crush and fall damage.
- A blast centred inside the Nook deals full damage.
- A Patcher who mends the missing block gives Cover back at once.
- **Two Passives touch Cover.** Grub's Broad Back keeps Cover for the Hob behind him when their shared wall breaks. Dame Flicka's Long Skewer leaves Nooks Open until their skewered wall is mended [01 §3.2].
- The HUD shows a small shield pip beside the HP of each Hob that has Cover. When the pip breaks, the player knows why the next hit hurts more.

**Material and Cover.** Cover is the same 50% for all materials. The material sets how long Cover lasts. HP per `00` after [B1].

| Wall | Feels like | Tag |
|---|---|---|
| Wicker (30) | One Plain Shot opens it. Cheap, and it does not crush the Hob below when it falls | `[Launch]` |
| Timber (50) | Two hits. Burns | `[Launch]` |
| Cobble (80) | Solid cover. If it falls on a Hob, crush is doubled. Side support reaches only 1 block [B2] | `[Launch]` |
| Brassbound (110) | Strong, fireproof. Zap chains along it into the next Nook in `[U3]` | `[Launch]` |
| Moonbrick (140) | Heals a little each turn it is not hit [B1] | `[U3]` |

### 7.4 When a Nook breaks `[Launch]`

Five Hob states. Each has a clear picture, a bark and one rule [B7].

| State | What happened | Rule | Hob reaction |
|---|---|---|---|
| **Open** | A block on any side is gone, or the Hob stands outside a Nook | No Cover [00 §2.10] | Crouches, peeks out |
| **Dropped** | The floor is gone | The Hob falls straight down to the first standing surface. Fall damage if the drop is over 32 cells [00 §2.10]. Then see "Where it ends up" | Hangs in the air a beat, then falls |
| **Tumbled** | It falls out of the castle | 20 damage. At the end of the turn it climbs to the lowest free Nook. It keeps its next shot [B9] | Rolls, sits up with stars, scrambles back |
| **Squashed** | A chunk lands on it | Crush: 15 per block, x2 for Cobble, 0 for Wicker [00 §2.10] | Flattened like a pancake, pops back |
| **Bonked** | HP 0 | Floats off on a Snooze Balloon. Puff Up can bring it back, player side only (both sides in Couch Duel) | Eyes spin, balloon pops out |

**Where it ends up.**

- A dropped Hob that lands in a free Nook takes that Nook as its seat. Its Loophole is now that Nook's Loophole.
- A dropped Hob that lands anywhere else (a block top, a full Nook, rubble) climbs at the end of the turn to the lowest free Nook.
- If no Nook is free, it stays where it landed and is Open. It fires from where it stands.
- A Tumbled Hob with no free Nook stands on the Footing lip at the front, Open.
- A Hob keeps its Rest count and its last aim through any drop.
- A Nook is a 2 x 2 hollow, so a one-floor drop into the room below is 32 cells and does no fall damage. Longer drops do.
- The Footing never falls [00 §2.8]. A Hob in a Nook on the Footing can be Open and Squashed, never Dropped.
- If a whole chunk falls with a Nook in it, the Hob rides it down, takes fall damage for the drop, then ends up as above.

**Class reactions.** Barks and poses only. The only rule effects come from Passives.

| Class | When its Nook opens | When it drops |
|---|---|---|
| Lobber | Annoyed. Folds arms | Lands hard. Slow to get up |
| Zinger | Ducks low, hat flat | Lands in a neat crouch |
| Scatterjack | Shakes a fist at the rival | Drops its shots, grabs them in the air |
| Delver | Does not notice | Lands on its feet with a grunt |
| Boinker | Laughs | Bounces twice |
| Sizzler | Guards its pot from the draft | Juggles the hot pot all the way down |
| Patcher | Starts fixing the hole out of habit | Checks the others first |
| Peeper `[U2]` | Hides behind its hat | Glides a little, arms out |

### 7.5 Falling floors `[Launch]`

The support rule is fixed in the core doc [00 §2.7]. Stone side support reaches 1 block, wood 2 [B2]. For crew, that means:

- **Stacked Nooks are a chain.** Break the floor of the top Nook and its Hob drops toward the Nook below. That room is full, so the Hob climbs to the next free Nook or stands Open.
- **Wings hang.** A Nook built out to the side gets a wide view and clear angles. One hit on the block that holds it drops the whole wing as a chunk. Stone wings can reach only 1 block out.
- **Tall stone is top heavy.** A good low hit on a tall Cobble fort can drop a third of it [B2]. Seat the crew low in stone forts.
- **Heavy roofs cut both ways.** A Cobble roof takes many hits. When it falls, crush is doubled on your own Hobs.
- **Wicker lofts are safe to stand under.** They break fast and crush nothing.
- **Held columns.** While Hetty stands, her column cannot fall from lost support (Ridgepole). A Shoring Crew's brace does the same for one column on a Rival fort. Bonk either and the support check runs at once.
- **The view tumbles, the sim decides.** Hobs flail and bounce for show. They end where the sim says [00 §2.7, C78].

### 7.6 Placement puzzles

These are the build and seat problems the game is made to pose. The campaign doc can turn each into a level. The Workshop tips teach them one at a time.

| # | Puzzle | The pull | The price | Tag |
|---|---|---|---|---|
| 1 | **High or low** | A top Loophole clears hills and adds range | The Hob takes the longest fall, and lobs find it first | `[Launch]` |
| 2 | **Front or deep** | A front Nook keeps fans tight and pins flat | It is the first wall the rival hits. A deep Nook has more blocks in front | `[Launch]` |
| 3 | **The stack** | Nooks in a column save width and blocks | One floor break sends a Hob looking for a new room, maybe Open | `[Launch]` |
| 4 | **The wing** | A hanging Nook gets angles no one else has | One neck block holds it all up. Stone wings reach only 1 block | `[Launch]` |
| 5 | **Kettle guard** | Hobs in front of the Kettle Room soak hits for it | Blasts meant for the kettle hurt your crew | `[Launch]` |
| 6 | **The cage** | Brassbound walls stop fire and most blasts | In `[U3]` Zap chains through the whole cage into every Nook that shares it | `[Launch]` |
| 7 | **Low and safe** | Nooks on the Footing never drop. Delvers and Boinkers love them | Rollers, skippers and fluids all end up at the bottom | `[Launch]` |
| 8 | **Spare room** | An empty Nook is a refuge after a drop or Tumble | It costs wall blocks and gives the rival one more room to open | `[Launch]` |
| 9 | **Wicker hat** | A Wicker loft is cheap and falls soft | It burns, and fire spreads down to Timber | `[Launch]` |
| 10 | **The pit** | Walk into a dip for cover from flat shots | Low Loopholes get buried and fluids pool on you [00 §2.7] | `[Launch]` |
| 11 | **Glass sniper** | A Zinger at the front gets its line | 80 HP at the front wall. Give it a Brassbound sill | `[Launch]` |
| 12 | **Split or cluster** | Spread Nooks so no blast hits two | A spread fort is wider and needs more wall blocks | `[Launch]` |
| 13 | **Open on purpose** | Leave a low Nook with a low front wall so a Boinker has a clear run on a pit map | That Hob starts with no Cover | `[Launch]` |
| 14 | **Crow's Nest** | A Peeper in the top row sees the most | The top row has the least support and the longest fall | `[U2]` |

### 7.7 Reading the enemy crew

The same rules face the other way. They give the player a hunt.

- **At launch** [B10]: the Muster shows each enemy Nook and its Class icon, and the icons stay on all battle. HP bars show once a Hob is hit. The AI sees your crew the same way. `[Launch]`
- Loopholes show at all times. `[Launch]`
- A Hob that fires shows a small flash at its Loophole. `[Launch]`
- The AI reads your fort by the same rules. It does not see through walls [00 §3]. `[Launch]`
- **Hidden crew** `[U2]`: in fog, blizzard and hidden-crew levels, icons fade after the Muster to "last known", and Peepers turn guesses into facts.

---

## 8. Data hooks for the tech plan

Hobs are data, not code [00 §10.3]. One record per Hob:

| Field | Example |
|---|---|
| `id` | `hob_marge` |
| `class` | `lobber` |
| `tag` | `launch`, `u1`, `u2` or `u3` |
| `hp` | 120 |
| `passive` | id plus params (for example `next_door: behind`, `band_up: 1`, `bonus: 0.15`) |
| `knack` | shot id from 01 |
| `knackQuirk` | Quirk id plus params (01 owns numbers) |
| `unlock` | level id, Trial id or Long Siege milestone |
| `barks` | caption line ids by trigger |
| `anim_set` | rig id plus personal clips |
| `balloon` | sprite id |
| `deeds` | list of Deed ids `[U1]` |

One record per Class: base HP, Plain Shot id, shell badge, voice set id, Quirk table (ranks 1 to 3).

Passives and Quirks must be pure sim rules with no random rolls, so replays and the AI agree [00 §2.7].

---

## 9. Open points for review

| # | Item | Type | Section |
|---|---|---|---|
| 1 | **Launch Hob list.** This doc's 16 (section 3.0). The weapons doc and `05` should match it. Pip as the Flats rescue at 4-8 replaces Tansy | For 01, 05 | 3.0, 3.9 |
| 2 | **Fifth Hob.** `00` gives it free at Grand Fort 2. `02` should not also sell it | For 02 | 4.1 |
| 3 | **Rank costs** and the late-recruit rule: closed. `02` sets 300, 700, 1,500 and "joins at the Rank of your fifth-highest Hob" | Closed | 5.1 |
| 4 | **Knack Quirk numbers** for all 28 Hobs | For 01 | 3, 5.2 |
| 5 | **Match bonus** on Trick Shells: Rest 0 and +10%. Closed: `00` and `01` set it | Closed | 1 |
| 6 | **Long Siege milestones** that give Gus and Rivet | For 05, 02 | 3.9 |
| 7 | **Rewritten passives:** Truffle (Good Nose), Poultice (Tea Round), and the four next-door Passives (Broad Back, Ridgepole, Old Grudge, Clatter Call). Bots must show that forts with Hetty or Grub do not last more than one round longer on average, and that Old Grudge and Clatter Call fire in at least a third of battles where the Hob is seated with a neighbour. Check Tea Round heal value | Balance | 3 |
| 8 | **All-dug-in rule:** closed. If every Hob is dug in, the newest burial clears at turn start, as `00` and `01` say | Closed | 7.2 |
| 9 | **Hob names:** all 28 need the trademark check [review 04 §D9] | Check | 3 |

---

## Appendix: Parked ideas

Cut for good by review 04 [B7, B8] and review 02 §2.3. Kept here so nothing designed is lost.

**Seat words.** Cellar (floor on the Footing), Loft (top two rows), Middle, Front (nearest column to the rival), Back, Core, Neighbors (rooms that share a wall block). Cut: seven nouns to say "high is good for lobs, low is good for rollers". Loophole height already does that.

**Scamper stat.** Slow, Steady, Quick. Quick made the first 16 cells of any fall free and gave 2-Nook Scurry reach. Cut: no one would feel 16 cells.

**Scurry.** As your Action, move one Hob to a free Nook within reach, behind a Crew node. Cut: a whole Action to move one room.

**Seat Perks and Neighbor Perks.**

| Class | Seat Perk | Neighbor Perk |
|---|---|---|
| Lobber | High Perch: in a Loft Nook, 10% more preview | Loader: once per battle, a neighbor's Reload ends a turn early |
| Zinger | Steady Sill: while its walls stand, Fine Tune shows the first hit | Call the Mark: neighbors get 10% more preview on a Hob the Zinger hit |
| Scatterjack | Wide Window: in a Front Nook, pick tight or wide fan | Duck!: neighbors take 10% less from Chip and Light hits |
| Delver | Ground Floor: in a Cellar, Plain Shot bores 1 block farther | Shored Up: neighbor floors take half Dig |
| Boinker | Springboard: low seat, first hop keeps 80% speed | Springy Floor: first floor drop each battle does no fall damage |
| Sizzler | Cool Hearth: in fireproof walls, cannot Burn | Warm Hands: neighbors cannot be Chilled |
| Patcher | Hub: 3 or more neighbors, Mend heals 7 | Mend (later "Tend"): heals neighbors 5 HP each turn |
| Peeper | Crow's Nest: top row marker reveals within 3 blocks | Point It Out: neighbors deal 10% more to Hobs it revealed |

**Extra Nook states.** Rattled (a wall under half HP, warning only). Skylight (ceiling gone). Perched (landed on a block top). Crowded (two Hobs in one Nook, neither with Cover, a blast hits both). Porch (Tumbled with no free Nook). Open covers all of them now.

**Tumble skips the next shot.** Replaced by "keeps its shot" [B9].

**Old Passives replaced in review 06.** Grub's Sure Feet (no fall damage; he sat on the Footing, where he never fell). Hetty's Tidy Up (her mend ends Burn; every Mendglob already does). Old Thumper's Can't Hear You (no Thump damage; Thumps are rare). Nan's Pan Shield (25% less from Chip hits and Burn ticks; an unseen number). Replaced by Broad Back, Ridgepole, Old Grudge and Clatter Call.

**Fizz's Popple Pod** (splits on impact, seeds hop out). Too close to Marble Sack; Rising Fizz took its slot [01 B.3].

**Buried Loophole bursts in your face.** Replaced by the greyed Fire button [B9].

**Hob levels 1 to 10 at +1.5% HP each, Quirks at levels 3, 6, 9.** Replaced by 3 ranks [B8].

**Knack tiers** (Tier 2 at level 4, Tier 3 at level 8). One idea per Hob lives on as its Knack Quirk. The rest stay in `01`'s history.

**Parked Quirks.** Third Helping (Knack 3 uses at 85%), Quick Hands (Knack Reload 0 once), Late Split (tap in flight to split), Mole Sense (full path below ground; now part of Truffle's Good Nose), Trick Bag (Knack 3 uses), Flash (field ticks on landing), Big Breath (once "Second Wind": Puff Up returns at 60 HP), Scaffold (rebuild 6 blocks), Rattle (pellet hits reveal a Hob), Chalk Seven (7 chalk arcs).

**Crew plans built on Last Bell.** The Slow Cook (win at Last Bell) and the Turtle aimed at integrity tiebreaks. Sudden Squall replaced Last Bell [B5].

**Per-Hob recorded voice sets** (about 20 lines, own snore loop). Replaced by Class voice sets with caption lines [C86].
