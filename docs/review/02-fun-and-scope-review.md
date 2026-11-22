# Review 02. Fun and Scope Stress Test

Status: review for the owner, before approval. Date: 2026-11-22. Reviewer role: outside game director.

Read for this review: `BRIEF.md`, design docs `00`, `01`, `02`, `03`, `04`, `05`, `07`, research `01`, `02`, `02b`, `02c`, `02d`, and the build plan in research `04 §14 to §16`. I read `00` in full and the rule, count, boss, level and plan sections of the rest. I did not read every one of the 72 shell entries or all 60 level rows.

No design doc was changed. Cites use the design docs' own form: `[00 §2.2]` is the core doc, `[D01]` to `[D07]` are sibling design docs, `[R04]` is the tech stack doc.

Every time, effort and hit-count figure below that is not quoted from a doc is my own estimate. I mark the big ones **[est]**. Nothing here was play tested, because nothing is built.

---

## 0. Verdict in one page

**The core is good. The design around it is about three games deep.**

The best ideas here are strong and rare in this genre: a crew that lives inside a fort you built, two win paths on screen at all times, an AI that misses like a person, a draft before each fight, a villain who hates hills, and a hard promise of no ads, no timers and no lost progress. Protect those.

Three things will sink it if nothing changes:

1. **Too many rules for a phone game.** A new player meets about 26 ideas in the first 10 minutes and about 90 named rules by the end of Region 2. The full game has well over 500 named things. Pocket Tanks has three: angle, power, fire.
2. **Defense grows, attack does not.** Fort size, block HP, crew size, heals, shields and revives all go up through the campaign. Damage per turn stays flat by rule, and the round cap stays near 15. Late fights will end on the Last Bell tiebreak, not on a Kettle Pop. That is the worst way for an artillery match to end.
3. **The content plan is about 2.5 to 3 times the size of the 32-week plan** for a team of five **[est]**. Every specialist doc grew its own count: 24 Hobs became 28, "50+" shells became 72, 10 Doodads became 19, five tree branches became six, and 60 levels became 136 maps.

My advice: approve the core, cut the launch scope to roughly 55% of what is written, fix the pacing maths, prove the collapse feel in a prototype, and ship the rest as free updates. Section 5 has the numbers. Section 6 has the ranked list.

---

## 1. Playing it in my head

### 1.1 The first 10 minutes

**What works.**

- Cold open with no menu, one Hob, one tower, a ghost hand. First shot inside 30 seconds. This is right.
- Release does not fire. The Fire button is big and apart. This fixes the top touch complaint in the genre.
- Ghost line, pin, tap the pin, "Bit more". This teaches bracketing in four taps. It is the best thing in the UX doc.
- The first Rival misses wide, then closer. The player learns the AI is fair before they can doubt it.
- A dummy floats off on a balloon and the word "Bonk!" shows. The tone lands in one beat.
- Hills pop up on the map after the first win. The story is told in 10 seconds with no text.

**Where it goes wrong.**

- **The clock is not real.** `[00 §8.3]` gives Level 1 two minutes, Level 2 about 75 seconds and Level 3 about 75 seconds. A 6 to 10 round fight at the doc's own 16 to 20 seconds a round is 2 to 3.5 minutes, and a new player aims slowly. My guess is that 10 minutes gets a new player to the end of Level 3, not into Level 5 **[est]**. That is fine. But then the Workshop, the Rummage, Walk, Steam, Reload, the Tinker Tree and wind all land in minutes 10 to 20, back to back.
- **Too many prompts.** `[D07 §5]` lists 31 prompts in 10 minutes. That is one new thing every 20 seconds. Three-word prompts do not make 31 ideas into fewer ideas.
- **Minutes 7 to 10 are a system dump.** Workshop, seat a Hob, Test Yard, draft, peek at a card, Walk, Steam, Reload and the tech tree all show in three minutes. The player came to shoot things. This is where casual players quit.
- **The Workshop opens with one free block.** Dragging one block into one gap is not building. It is a tutorial for a feature that has nothing to give yet. The start grid has 8 solid blocks `[D02 §3.2]`.
- **The Muster is a memory test.** Enemy Class icons flash for 2 seconds, then hide `[00 §2.9]`. On a phone, on a bus, that is a quiz the player did not ask for.
- **Docs disagree on order.** Reload shows at Level 3 in the campaign table and at Level 4 in onboarding. Small, but it shows no one has laid the first 20 minutes end to end.

**Fix.** Levels 1 to 5 are aim, pick a Hob, pop the kettle, wind, and one Knack. Nothing else. The Workshop opens after the first Grand Fort teaser at about Level 6, with a real choice (three blocks, two spots). The Rummage opens at Level 7 or 8. The Tinker Tree opens at Level 10, as the boss reward. Walk comes in on a level that needs it.

### 1.2 A mid-game level: 4-6 Slippery Crown (King of the Hill)

I picked the level the campaign doc itself spells out `[D05 §7.2]`.

**Before the first shot.** Level card, seat check with clash icons and job lamps, pick a Blueprint, maybe swap the linked Tinker Plan, draft four shells from ten, pick two Doodads, watch the Muster. That is 60 to 90 seconds of menus for a fight meant to last 4 to 6 minutes **[est]**. Every level, 60 times.

**Turn 1 to 4.** Both forts walk to the dome. This is new and fun for one turn. Then it is two turns of holding a walk button while the Rival does the same. The player's first real shot comes around Round 3.

**Turn 5 on.** Now the player must hold in their head: wind 6 to 8 that changes every three rounds, a slide rule for ice slopes, thin ice on the tarn, a snow drift on a beat, a cloud that zaps the tallest column and jumps if hit with fire, a Rival Knack that turns the ramp to ice, Crowns scored at round end, 200 Steam, and a Rival that comes back twice after being popped. That is nine rules that exist only on this level, on top of the base game.

**Is it fun?** The idea is. Knocking a fort off a hill so it slides away is a great picture. But popping the Rival "buys time, not the win", so the core verb of the game (break the fort) is turned off. Wind at 6 to 8 with a 30% preview means most lobs miss. A missed turn in King of the Hill costs a Crown. I expect this level to feel like a board game with too many tokens.

**The wider point.** Two thirds of the campaign changes the goal `[D05 §3.9]`. Ten mission types is a lot of rules to build, teach and tune. The plain duel is the fun part. Angry Birds and Kingdom Rush both ship one mode with many layouts. Use three or four mission types well, not ten once or twice.

### 1.3 A Grand Fort: 1-10 The Topiary Keep

**What works.** A hedge fort shaped like a peacock. Hedges that grow back while a root stands. A lawn roller named Big Smoothie Jr. that shaves your hill. Giant shears with a red cut line. Every phase has a tell and a counter. The boss is built from parts the region already taught. This is the right way to do bosses and players will remember it.

**Where it strains.**

- **Three phases in 18 to 20 rounds** is 6 to 8 minutes at best. That is at the top of the "never over 8" rule before a single retry.
- **The phase turn.** The boss skips a turn to change. Good for fairness. But three banners, a roller that rolls, and shears that open all add watch time to a game that promised fast turns.
- **Clean Sweep is not a real path.** The doc says so: "Kettle Pop is faster than Clean Sweep here". Later bosses summon fresh Hobs. Pillar 3, two ways to win, goes quiet in the six fights that matter most.
- **Burst skips content.** Phases fire on kettle HP. A good Sunspear turn can jump a phase. Then the roller never rolls and the best joke is lost. Or the notch holds the kettle and the big hit feels wasted.
- **Each boss is custom code.** Six kinds of Rig Part, 24 phases across the campaign, each with its own script, art, tell and AI. See section 5.

### 1.4 The final boss: 6-10 The Last Level

Three Stages. Each Stage has three phases and a 12-round cap. One draft covers all three: pool of 14, six picks `[D04 §4.7]`.

**Stage 1, the Square Gate.** A mirrored Moonbrick fort that heals 10% a turn. A Plain Shot does 35 x 0.6 = 21 to a Moonbrick block. The block heals 24 at its owner's turn start `[00 §2.8, §2.10]`. So a Plain Shot does less than nothing. A 60 damage Knack nets 12. The crew doc says a rival "must open it in one turn or not at all", and no single Action in the game does 240 to Moonbrick. The player will spend this Stage on Pierce shots and whatever shells they drafted. It will feel like chipping a safe.

**Stage 2, the Grand Roller.** The best set piece in the game. A fort on a drum rolls at you and flattens the map. You build mounds to stop it. The theme and the verb are one thing. But the counter needs mound shots. A player who did not bring a Delver, a Patcher or a mound shell has no answer and learns that on turn 4 of Stage 2, 10 minutes in.

**Stage 3, the Level Engine.** Phase 2 gives a free Hill Call each turn, which fixes the Stage 2 problem one Stage late. Then Phase 3: "There is no trick left. Use your best shells." By now the player has fought up to 30 rounds on six shells. The hand is empty. The climax of the whole game is Plain Shots at healing Moonbrick with the Baron at Stubborn aim.

**Length.** Nine phases and up to 36 rounds is 15 to 25 minutes **[est]**. The game's own rule is "never over 8". On Stubborn a loss in Stage 3 restarts Stage 1.

**The ending is lovely.** The Baron puts down his teacup once. He lands on a hill and finds his tea does not spill. Keep every word.

**Fix.** Two Stages, not three: the Roller, then the Engine. Fold the Steward into Region 6 as its own level. Give Hill Call from the first Roller turn. At the last phase the clan sends a crate: Knacks refill and the player picks two shells. Retry is from the current Stage on every preset.

---

## 2. Complexity budget

### 2.1 The count

What a player must learn, as written. Counts come from the docs.

| Group | Launch count as designed | Source |
|---|---|---|
| Classes | 8 | `[00 §2.9]` |
| Plain Shots | 8 | `[D01 §2]` |
| Knacks | 28, each with 3 tiers (84 states) | `[D01 §3]` |
| Trick Shells | 72 in 15 families, 13 fire tags, 4 rarities | `[D01 §4]` |
| Doodads | 19 | `[D01 §5]` |
| Enemy-only Twists | 8 | `[D01 §4.16]` |
| Shot keywords | Threads, Peephole, Prop, Zone, Coat, Dial, Steered, Metal, Weight, Reload, Skill Factor | `[D01 §1.2]` |
| Build materials | 5 plus Footing | `[00 §2.8]` |
| Ground types | 7 | `[00 §2.1]` |
| Damage types | 6, in a 6 x 7 table | `[00 §2.10]` |
| Statuses | 4 core, plus Mark, Sticky, Oil, Ice coat and 5 Zone kinds | `[00 §2.10]`, `[D01]` |
| Rooms | 8 | `[D02 §3.3]` |
| Seat words | 7 | `[D03 §1.2]` |
| Seat Perks and Neighbor Perks | 8 and 8 | `[D03 §1.3]` |
| Hob stats | HP, Scamper, Nook needs, Passive (28 of them) | `[D03 §1.1]` |
| Nook states | 9, from Rattled to Squashed | `[D03 §7.4]` |
| Quirks | 48 (8 Classes x 3 levels x 2) | `[D03 §5.2]` |
| Tinker nodes | 77 in 6 branches, 12 choice pairs, saved Plans | `[D02 §1]` |
| Currencies and tokens | Buttons, Pennants, Iron Pennants, Keepsakes, Scrap, Crowns, Deeds, stamps, medals | `[00 §5]`, `[D05 §5]` |
| Mission types | 10 | `[D05 §3.1]` |
| Modes | 9 | `[00 §6]` |
| Difficulty | 4 presets and 7 assist toggles | `[00 §8.1]` |
| Win rules | 2 paths, a round cap and a 4-step tiebreak | `[00 §2.11]` |
| Map hazards | 20 or more, 3 or 4 new per region | `[D05 §6.4]` |
| Glossary | 60 or more binding terms | `[00 §7.2]` |

**Per turn**, a late-game player picks one of six Hobs, checks each cog, picks from a Plain Shot, a Knack and up to four shells that this Hob may or may not be able to fire, or one of two or three Doodads, or a Scurry, and may Walk first. That is 20 to 30 legal moves before aim. Pocket Tanks has about 10 and they shrink each turn.

### 2.2 Is it too much?

**Yes, for target group 3 (casual phone players) and group 6 (kids 9+). It is about right for group 1 (old artillery fans), and only if it comes in slowly.**

The docs know this risk and answer with "one term per level" and the Almanac `[00 §10.3]`. That handles the drip. It does not handle the load. By Region 3 a player still holds all of it at once on a 6 inch screen.

The deeper issue is not the count of toys. Seventy shells are fine: each one is a toy you meet once on a card. The issue is the count of **systems that touch every turn**: Reload, Cover, Nook states, seat words, perks, statuses, Zones, coats, tags, hidden crew. Toys are cheap to learn. Systems are not.

### 2.3 Cut, merge, delay

**Cut for good.**

| Cut | Why |
|---|---|
| Seat words and Seat Perks | Seven new nouns and eight perks to say "high is good for lobs, low is good for rollers". The Loophole height already does that through physics. Let geometry be the perk |
| Scamper stat | Three grades that change fall damage by 16 cells. No one will feel it |
| Scurry | A whole Action to move one Hob one room. Musical Chairs already does it as a Doodad |
| Crowded, Perched, Porch states | Keep five: Open, Dropped, Tumbled, Squashed, Bonked |
| Knack tiers | 56 extra rule variants. Quirks already do this job |
| Rarity on shells | Offline, earned, no gacha. Rarity is a word with no use |
| Tinker Plans, Knack Pouch, Captain picks linked to Blueprints | A loadout of loadouts. Free respec is enough |
| Deny refund of 10 Buttons | A rule and a UI line for pocket change |
| Brisk timer, Take Back as separate toggles | Fold into presets |
| Family and tag as two ideas | One word on the card: who can fire it |

**Merge.**

| Merge | Into |
|---|---|
| 10 Hob levels at +1.5% HP each | 3 ranks. Each rank gives a Quirk pick. No dead levels |
| 6 tree branches | 4: Aim, Fort, Crew, Kit (shells, Doodads and Steam) |
| Chill and Reload effects | One idea: "needs a rest". Cap at one extra turn |
| Oil, Sticky, Ice coat, Zones | One idea: a patch on the ground with one icon and a turn count |
| Level card, seat check, Doodads | One screen (the UX doc already asks for this). Add the draft as a strip on the same screen |
| Trick-shot Challenge and Puzzle Shot | One type: Puzzle |
| Escort and Defend a Cart | One type: Escort |
| Raid Rehearsal | A button in the Test Yard |

**Delay to updates.**

| Delay | When |
|---|---|
| Peeper Class and hidden crew as a system | With Frostwhisker Peaks (fog and blizzard give it a job) |
| Frost and Zap as damage types, Brittle, Chill | With Peaks and Mines |
| Moonbrick | With Mines |
| King of the Hill, Survive Waves as campaign types | With updates |
| Long Siege, Ironclad, Baron Rush | Updates 1 and 3 |
| Keystones, Decoy Kettle Room, Tool Shed, Snug, Boiler Loft | With the regions that open their tree tier |
| Mastery, Deeds, Bonds | Update 1 or 2. About 280 Deeds is a content job of its own |

### 2.4 What a launch player learns

| Group | Launch | After updates |
|---|---|---|
| Classes | 7 | 8 |
| Hobs and Knacks | 16 | 28 |
| Trick Shells | 30 (2 Duds) | 60 to 72 |
| Doodads | 8 | 14 to 19 |
| Materials | 4 plus Footing | 5 plus Footing |
| Damage types | 4 (Blast, Pierce, Dig, Fire) | 6 |
| Statuses | 2 (Burn, Soaked) | 4 |
| Rooms | 3 (Nook, Kettle Room, Cushion Loft) | 6 to 8 |
| Quirks | 28 (7 Classes x 2 ranks x 2) | 48 |
| Tinker nodes | 36 | 60 |
| Mission types | 5 (Siege, Demolition, Rescue, Puzzle, Grand Fort) | 8 |
| Modes | 5 (Campaign, Skirmish, Test Yard, Trials, Daily) | 8 |
| Currencies | 2 | 2, plus Scrap inside Long Siege |

---

## 3. Fun checks

### 3.1 Weapons that feel the same or dull

The "one line, no numbers" test in `[D01 §1.1]` is the right rule. By that same test these fail or come close:

- **Gravel Sneeze, Pepper Rain, Popple Pod, Hailbasket, Pan Parade** and the Cluster family are all "many small Blast hits in a spread". In flight they differ. On the wall they look the same: a row of small numbers. Cover halves every one. Scatterjack is the Class most at risk of feeling weak and samey.
- **Sunspear and Glimmerjolt** are the same beam with a different damage type. If Zap waits for the Mines update, Glimmerjolt waits with it.
- **Clodpot, Grand Dumpling, Pudding Bomb and the Splash family** are "a lob that goes boom" in four sizes. Size is a number.
- **The five echo shells** (Treacle Tart, Quickhedge, Sod Sack, Kettle Tickler, Lantern Moth) are by design weaker copies of Knacks. A weaker copy is not a new toy. Cut them from launch.
- **Peep Pip does 5 damage.** A turn that deals 5 while the Rival deals 35 is a lost turn. Scouting has to pay for itself in the same turn or no one will fire it twice.
- **Mendglob** is +50 HP to one block against a Rival dealing 35 to 70 a turn. It is the right call only on a Nook wall. Most turns it is dull, and when it is not dull it makes fights longer.
- **Doodads cost the Action.** Nineteen gadgets that mostly say "do not get hurt this turn" and cost your shot. The good ones (Coal Scuttle, Scarecrow, Mole Mine, Bellows) change the picture. Pot Lid, Kettle Lid, Bucket Brigade, Lightning Rod and Anchor Chain are answers to one shell each. Ship eight.
- **The three Duds.** A joke the player fires by mistake is on the player. Quick Pick never hands you one, so only careful players get stung. Make every Dud say so on its tile and make firing one funny and a little useful.

The shots I would fight to keep: Tick-Tock Crock, Chimney Drop, Anvil Bun, Burrowbomb, Hairline with Fault Line, Molehill Surprise, Rolypoly, Clackerball, Scaldspill, Drenchbarrel, Scrap Stack, and the Nibbler plus Hatpin pair through a Peephole. Each one changes what the next turn looks like.

### 3.2 Dominant strategies

1. **Stall to the Last Bell with more Hobs.** The first tiebreak is Hobs standing. Bonk one Hob, then shield, mend and revive. The tools are many: Mendglob, Mend Bucket, Barn Raising, Puff Up (bring back a Bonked Hob), Bubble Bonnet, Pot Lid, Kettle Lid, Brolly, Patchwork Quilt, Moonbrick heal, Snug heal. The docs flag this as "Turtle" in `[D01 §7.6]` and even list it as a suggested crew, "The Slow Cook: win at Last Bell" `[D03 §4.2]`. A crew whose plan is to run out the clock is a design smell.
2. **Recall lock.** Forts stand still, wind holds for three rounds, Plain Shots have no Reload, and Recall restores an exact aim. Find the range once, then tap the pin and Fire each turn. It is the best play and it is five turns of the same shot. The AI must walk out of a bracket more than it does now, and the pin should fade after one reuse.
3. **Kettle rush with pass-through shots.** Sunspear does 40 Pierce to the kettle through one wall from turn 1, and the kettle must sit only one block in. The docs flag it. Raise the build rule to two blocks, or make beams lose half through a wall.
4. **The deep bunker.** Own shots pass through own blocks, and a deep Nook "fires as well as a Front Nook" `[D03 §7.2]`. So the best fort is always the thickest shell with the crew in the middle. If Seat Perks are cut, give depth a real cost: a shot loses power for each own block it passes, or deep Nooks cannot fire flat.
5. **Moonbrick.** As the numbers stand, a Plain Shot cannot dent it (21 damage against 24 heal). An all-Moonbrick fort costs 16,000 Buttons, which is the whole campaign's income, so the game's end goal is a fort the AI cannot break. Change the heal to a flat 8, or stop the heal for two turns after a hit.
6. **Cozy with Training Arc.** Pennants pay the same on every preset and the full-arc assist is free `[00 §8.1]`. So the best way to three-Pennant the game is Cozy. That is kind, and I would keep it. But then the Aim branch sells 45% and 60% previews that a free toggle beats. Either the Aim branch sells other things (it has good ones: Bracket Ring, Trick Sight), or the assist is a preset choice that tags the save with a small leaf, no shame.
7. **Respec per level.** Free respec with saved Plans means the best play is to re-spec for each map. Choice pairs stop being choices. Fine as kindness. Just do not count the 12 pairs as depth.

### 3.3 Feel-bad moments

| Moment | Why it hurts | Fix |
|---|---|---|
| Last Bell tiebreak | The match ends on a sum, not a bang. Four tiebreak steps is a rulebook | See 3.4 |
| A drafted shell no one can fire | Its Class Hob got Bonked or is on Reload. The shell is dead in hand | Any Hob may fire any shell. The right Class fires it with a bonus |
| Tumbled: skip your next shot | A lost turn in a one-Action game is the worst penalty there is | 20 damage and a new seat is enough |
| Chill, Cold Shoulder, Red Tape | More lost turns | Cap extra Reload at 1 from all sources, at launch, not after bots |
| Thump on a Wicker fort | 10 to every block at 30 HP. Three Thumps and the fort is gone to a dig, the plan the Footing was built to stop | Thump hits Hobs and the bottom two rows only |
| Buried Loophole | Your own shot bursts in your face | Shot is blocked with a clear "dug in" icon and the Fire button greys. Never self-harm from a UI miss |
| Puff Up | The player spends three turns on a Bonk and the AI undoes it | Player-only, or the revived Hob comes back for one shot |
| AI threads your Zinger | 48 of 80 HP from one pin through a 6-cell slot | Fine if rare. Hold the AI to one Thread per battle on Fair |
| Final boss restart on Stubborn | Twenty minutes lost | Retry from the Stage on all presets |
| The 2-second Muster | Miss it and you guess all match | Class icons stay shown. Hide HP and exact seat until hit, if hidden info is kept at all |

**Losing a Hob to a lucky shot** is handled well: Cover halves blasts, first-shot hit chance is under 15% on Fair, and nothing is lost after the battle. Keep that.

**Long AI turns** are handled well on paper: think 0.8 to 1.5 s, resolve 2 to 5 s, tap for 2x. The risk is not the think. It is shots with long tails (crawlers, rollers, nested splits, fluids that pool) and boss banners. Hold a hard 4-second cap on any AI resolve and let 2x be on by default for Rival turns after Region 1.

### 3.4 The pacing maths (the biggest design risk)

The core doc sets a Plain-Shot-only match at 10 to 14 good hits, a cap of 15 rounds, and battles that end by Round 8 to 12 `[00 §9.3]`. That holds for a 20-block Wicker fort with three Hobs. Then the campaign changes one side of the sum:

| | Start | Late game | Growth |
|---|---|---|---|
| Solid blocks | 8 | 36 to 42 | about 5x |
| Block HP | 30 (Wicker) | 180 to 240 | 6x to 8x |
| Hobs | 3 at 80 to 140 | 6 at up to 159 | about 2.2x |
| Heals, shields, revives | none | many | |
| Damage per Action | 35 Plain, 60 to 85 Knack | the same, by rule | 1x |
| Actions per battle | 15 | 15 (boss 18 to 20) | 1x |

A new player with a 30% preview will also miss or graze a third to a half of early shots **[est]**. So the true Action budget is nearer 9 good hits than 15.

Unless the numbers move, mid and late fights end at the Last Bell most of the time. The docs' own trip line is 15% of battles `[D01 §7.6]`. I expect far more than that from Region 3 on.

**Fixes, in order of how much I like them.**

1. **Make collapse the scaling damage.** Big forts should fall harder, not stand longer. Crush already grows with fort size. Cut side support from 2 blocks to 1 on stone, so tall stone forts are top-heavy. A good low hit on a late fort should drop a third of it.
2. **Replace the tiebreak with Sudden Squall.** From the cap on, every block loses HP each round and wind climbs. Two or three more rounds and something pops. No sums, no fourth step. One sentence in the rules.
3. **Flatten the material ladder.** HP of 30, 50, 80, 110, 140, not 30 to 240. Let the quirk be the reason to pay, as the doc itself says it should be.
4. **Cap crew at 5.** Six Hobs is 50% more to Bonk and a sixth portrait on a small phone.
5. **Kettle HP stays 300 for all.** Do not raise boss kettles to 400. Phases already gate them.

### 3.5 Is the castle building meaningful in battle?

**Half.** What reads in battle: height (arc and range), what sits above what (crush, chain drops), wood against stone (fire), wings on side support (one hit drops them). Those are good and physical.

What does not: the early Workshop is too small to choose anything. Seat and Neighbor Perks sit behind tree nodes and need seven seat words to read. Rooms like Snug and Boiler Loft are stat sticks. And the bunker beats every other shape.

Castle Busters reviewers said placement is the puzzle `[R02b §15]`. To earn pillar 4, the player must see their own choice win or lose a fight. Two cheap ways: after each loss, replay the shot that broke them in slow motion over their Blueprint with one line ("your loft had one leg"); and give each Rival one stated habit ("Pudge aims at roofs") so the player builds against it.

### 3.6 Is the tech tree exciting?

**The good nodes are very good.** Bracket Ring, Trick Sight, Tattletale Chalk, Lookout Post and the keystones change how you play. The rule "no pure +2% nodes" is right.

**Problems.**

- **77 nodes with 160 of 210 Pennants to spend** means you buy nearly all of it. The only real picks are 12 pairs, and respec is free. It is a shop with a tree shape.
- **It sells the UI back.** Chalk Line, Weathervane, Shot Log and Drift Tally are readability. Pillar 2 says the player gets the data. Then the tree holds the data for 3 Pennants. Give all of that for free.
- **It opens with a number.** Long Sight, 30% to 45%, is the first node. The first buy should be a new verb.
- **Hob Training is the dull track.** 300 Buttons for +1.5% HP on a 100 HP Hob is 1.5 HP. Six of nine level-ups give nothing you can see.

Kingdom Rush's star tree had about 30 upgrades and each one was felt. Aim for 36 at launch, 4 branches of 9, with one real fork per branch.

### 3.7 Are bosses memorable?

**Yes. This is the best doc in the set.** A gardener, a mason, a wet admiral, a skating countess, a deaf ironmaster and a polite steward, each with a fort that is a joke you can shoot. Each boss tests the region's lesson. Tells are always one turn ahead.

Risks: Clean Sweep fades as a path, burst can skip phases, each boss is bespoke code, and the last one is too long with an empty hand at the end (1.4). Fix those and the bosses are the store page.

### 3.8 Is replay value real?

| Source | Real? |
|---|---|
| The draft: a new hand each fight | Yes. This is the Pocket Tanks engine and it works |
| Skirmish with full rule control | Yes, and cheap |
| Long Siege (carry damage, pick boons) | Yes. The best long-term mode here. Also the costliest: boons, Scrap, 24 maps |
| Pennant goals on replay | Some. Good goals teach a new line; "win by Round 8" does not |
| Trials | Yes, but only 10 |
| Daily Dust-up | Weak offline. "Same for everyone" means nothing with no board. Keep it only as a free seeded Skirmish; do not build 40 maps for it |
| Ironclad | Fine, cheap, late |
| Baron Rush | One evening |
| Mastery and Deeds | A checklist. Works on collectors, costs 280 hand-written feats |
| Raid Rehearsal | Niche. Watching the AI shoot your fort is a Test Yard button |

The campaign is about 7 hours by the docs' count and nearer 9 to 10 by mine **[est]**. Real replay comes from the draft, Skirmish and Long Siege. That is enough. Ship the first two at launch and the third as the first update.

---

## 4. Honest comparison

| Against | Where we win | Where we lose |
|---|---|---|
| **Pocket Tanks** | A campaign and things to earn. Stakes: a fort and crew to lose. AI that misses and says how good it is. Shell cards with clips. A phone HUD built for phones. A real tiebreak rule | Ten seconds to explain, against ten minutes. Menu to first shot. Purity: every turn there is a new toy fired by "you", with no Class lock, no cog, no seat. A match that always ends on a score. 400 weapons over 16 years. Couch play, which its fans love most and our brief bans |
| **Castle Busters** | Everything about trust: no ads, no timers, no paid heroes, no fake players, no nerfs to owned things, no crash losses. Hills. A fort you can edit. Offline | The pull of "a real person" on the other side, even a fake one. A simpler unit list. Likely the look of collapse: their bricks tumble as bodies, ours fall "as one chunk, straight down" `[00 §2.7]`. If our collapse looks stiff next to theirs, we lose the one thing reviewers there call fun number one |
| **Worms** | Fits a phone. Sessions of 5 minutes. A fair AI. A campaign with a point. No aiming by tiny d-pad | Chaos. Worms is funny because things chain: a mine, a barrel, a fall into the sea. Our forts never tilt, Hobs never leave, and every blast has a 3-second cap. We have chosen order. Also movement: the rope and the jetpack are half of Worms. Our Walk is a slider with fuel. And voices: Worms lines are jokes in real words; Hob-speak is cute noise |
| **Angry Birds** | Depth. An enemy that shoots back. A build of your own. A draft | One finger, one second to get it. A level in 30 seconds and a retry in one. Rigid-body spectacle. Characters you can draw from memory. We have 16 puzzle levels in all; that game is only puzzle levels |
| **Kingdom Rush** | A fort the player made. Turn-based, so no stress and a clean pause. Two win paths | Polish per item. That game shipped small (about a dozen stages, four tower types, about 30 tree upgrades, as I recall it; check before quoting) and made each one shine. We plan 72 shells and 77 nodes. Its tree made you choose. Its heroes had two skills, not a Passive, a Knack, three tiers and six Quirks |

**The honest summary.** We will not beat Pocket Tanks at being simple, Worms at being wild, or Angry Birds at being instant. We can beat all of them at being a fair, warm, single-player artillery campaign with a fort you care about. That spot is empty `[R01 gaps 1 to 4]`. It is won by polish on a small set, not by counts.

---

## 5. Scope and risk

### 5.1 The plan against the content

The plan: 2 engineers, 1 artist, 1 designer who also builds content, audio by contract. 32 weeks. 64 engineer-weeks, about 40 art-weeks, 30 design-weeks, 6 audio-weeks `[R04 §15]`.

The content as designed:

| Item | Count | Note |
|---|---|---|
| Distinct shot behaviours | 135 | 8 Plain, 28 Knacks, 72 shells, 19 Doodads, 8 Twists. With Knack tiers: 191 |
| Rule perks | about 140 | 28 Passives, 48 Quirks, 16 seat and neighbor perks, about 50 behaviour-changing tree nodes |
| Tinker nodes | 77 | "Each changes behaviour" means each is code |
| Characters to draw and animate | 63 or more | 28 Hobs, 28 enemy units, 6 lieutenants, the Baron, plus 30 to 40 Rival portraits |
| Boss phases | 24 | 6 Rig Part kinds, 3 final Stages |
| Mission types | 10 | 9 rule sets beyond the duel, each needing AI |
| Maps | 136 | 60 campaign (the last has 3), 10 Trials, 40 Daily, 24 Siege |
| Hazards | 20 or more | Each with art, sound, rules and bot tests |
| Screens | about 30 | Plus keyboard, mouse, gamepad, remap and a screen-reader mirror layer |
| Modes | 9 | Long Siege is a small roguelite on its own |
| Audio | 124 SFX events (about 260 files), 260 barks, 6 layered region scores | The UX doc already asks to lift the audio cap from 6 MB to 14 MB |
| Text | About 280 Deeds, 40 achievements, 191 shot cards, 60 level cards, cutscenes | Times the number of languages |

### 5.2 My estimate

Engineer-weeks for the full design **[est]**. These are a director's rough numbers, not a quote.

| Area | Weeks |
|---|---|
| Sim core, terrain, castle, support, collapse | 10 |
| 135 shots (code share only; data-driven helps, but "a new shot is a new rule" means many are new code) | 35 to 40 |
| Crew rules, perks, Quirks, Nook states | 9 |
| Tinker Tree with 77 nodes | 8 |
| 9 extra mission types | 12 |
| 6 bosses, 24 phases, Rig Parts | 13 |
| AI that uses 135 shots, Walk, Doodads, the draft, with personalities | 10 |
| Side modes | 8 |
| HUD, 30 screens, Workshop editor, input on 3 platforms | 25 |
| Save, replay, resume, stores, purchase, PWA, CI | 10 |
| Performance on low-end Android | 6 |
| Access features, languages | 5 |
| Bugs, tuning, polish (20% is low for a physics game) | 25 |
| **Total** | **about 175 to 180** |

That is about 2.7 times the 64 in the plan. With two engineers it is 88 weeks, not 32.

Art is worse. One artist has about 40 weeks. Sixty-three animated characters at even three days each is 38 weeks, before six biomes, tiles for five materials in damage states, 91 shot icons, VFX, 30 screens, boss rigs, decor, Outfits and store art.

Design: 136 hand-made maps in 30 weeks is one map a day with no time left for tuning 135 shots, 77 nodes and 60 Pennant goal pairs.

Three more warning signs:

- **M1 builds 8 weapons in 7 weeks. M2 must then build the other 127** plus every other system in 10 weeks.
- **The bot plan assumes the tuning is cheap.** Twenty red flags, each "opens a tuning ticket". With 135 shots and 28 Hobs that is a full-time job no one on the team has.
- **Every doc grew.** Hobs +17%, shells +44% over "50+", Doodads +90%, maps +127% over 60. Nobody was holding the line. Someone must.

**Verdict on the 32-week plan: not real for this content. Real for about a third of it.**

### 5.3 Phased content plan

Same team of five, plus a contract animator from the slice on. Weeks count from the start.

| | Prototype | Vertical slice | Launch 1.0 | Update 1 | Update 2 | Update 3 |
|---|---|---|---|---|---|---|
| **Done by week** | 4 | 14 | 46 to 52 | +8 | +10 more | +10 more |
| **Theme** | Is collapse fun? | Is this game fun for 30 minutes? | The Unflattening, four regions | Long Siege | Frostwhisker Peaks | Clankmouth Mines |
| Regions | grey box | half of Region 1 | 4: Downs, Crag, Fen, Flats | | +1 | +1 (6 total) |
| Campaign levels | 1 map | 5 and 1 Grand Fort | 40 (4 Grand Forts) | | +10 | +10 (60) |
| Trials | | 1 | 6 | +2 | +1 | +1 (10) |
| Other maps | | | 12 shared by Skirmish and Daily | +12 Siege | | (about 82 total) |
| Mission types | duel | duel, Puzzle, Grand Fort | 5 | Waves (in Siege) | +Escort | +King of the Hill (8) |
| Classes | 2 | 4 | 7 | | +Peeper (8) | |
| Hobs and Knacks | 2 | 4 | 16 | +2 | +5 | +5 (28) |
| Trick Shells | 0 | 8 | 30 | +8 | +10 Frost | +10 Zap (58) |
| Doodads | 0 | 2 | 8 | +2 | +2 | +2 (14) |
| Materials | 2 | 3 | 4 | | | +Moonbrick (5) |
| Damage types | 1 | 3 | 4 | | +Frost | +Zap (6) |
| Tinker nodes | 0 | 8 | 36 | | +12 | +12 (60) |
| Enemy unit types | 1 | 4 | 14 | +2 | +5 | +5 (26) |
| Named Rivals | 1 | 4 | 20 | | +6 | +6 |
| Modes | duel | Campaign, Test Yard | +Skirmish, Trials, Daily | +Long Siege, Couch Duel if the owner says yes | +Ironclad | +Baron Rush |
| SFX events | 10 | 35 | 75 | +10 | +15 | +15 (115) |
| Barks | 0 | 30 | 100 | +20 | +40 | +40 (200) |
| Music | none | 1 region, 2 layers | 4 regions, 2 layers, 1 menu theme | | +1 | +1 |
| Languages | EN | EN | EN plus 4 | | | more by sales |

**Story fit.** The Flats moves up to be Region 4, so the launch game has the Baron and a true ending. Peaks and Mines come back as "the wings that got away": two lieutenants regroup after the Baron falls. The epilogue still works. Nothing written is thrown away; it ships later.

**Gates.**

- **Week 4.** Ten strangers each play the grey box for 10 minutes. Pass: seven ask for one more go, and a block-fall test of the two collapse models picks one. Fail: stop and rethink collapse before any content.
- **Week 14.** Twenty players play the slice. Pass: 70% finish all six levels in one sitting, median fight under 5 minutes, under 15% of fights reach the cap.
- **Week 30 (alpha).** Bots clear all 40 levels with the floor build. Last Bell under 15%. If the team is more than three weeks behind here, cut the Fen to post-launch and ship three regions.

**Price.** Forty good levels, Skirmish, Trials and a Daily is a fair $4.99 to $6.99 game with free updates promised and dated. Say on the store page what is in the box today.

### 5.4 Top risks, ranked

| # | Risk | Odds | Cost if it hits | Early test |
|---|---|---|---|---|
| 1 | Collapse looks stiff: chunks fall straight down | High | The core joy is gone | Week 4 prototype, both models side by side |
| 2 | Fights run long and end on the cap | High | The game feels like a draw machine | Bot runs on a late-game fort in week 6, before any content |
| 3 | Scope kills polish | Certain as written | A wide, thin game | Approve the launch table in 5.3 |
| 4 | New players drown by minute 15 | High | Trial players never buy | Slice test with casual players, not genre fans |
| 5 | Low-end Android in a WebView with debris, fluids and Zones | Medium | Bad reviews on the largest market | Already in the M0 checks. Keep it |
| 6 | AI cannot use 135 shots well | Medium | Rivals feel dumb or all the same | Launch with 30 shells; the AI gets good at those |
| 7 | One artist | High | Art sets the ship date | Contract animator from week 5 |
| 8 | Float drift between JS engines breaks replays and the Daily | Medium | Resume and replays break | Already in the M0 checks. Keep it |

---

## 6. Top 15 changes before building

Ranked by impact.

1. **Cut launch to the table in 5.3.** Four regions, 40 levels, 7 Classes, 16 Hobs, 30 shells, 8 Doodads, 36 nodes. Date the three updates. Nothing else on this list matters if this does not happen.
2. **Fix the pacing maths before content.** Flatten block HP, cap crew at 5, let collapse be the damage that grows with fort size, and bot-test a late-game fort in the first six weeks (3.4).
3. **Replace the four-step tiebreak with Sudden Squall.** From the cap, forts crumble and wind climbs until something pops. Every match ends with a bang.
4. **Prototype collapse first and let it veto the support rule.** Build the "straight down as one chunk" model and a cheap tumbling one. Ship the one that makes people laugh. Chain reactions are where Worms and Angry Birds beat us today.
5. **Any Hob can fire any shell.** The matching Class fires it better (a small bonus or no Reload). Kills dead cards, grey cards, the deny refund, and 13 tags.
6. **Cut the seat layer.** Seat words, Seat Perks, Neighbor Perks, Scamper, Scurry, Crowded, Perched, Porch. Let Loophole height, depth and what sits above you do the work.
7. **Slow the first 20 minutes.** Levels 1 to 5 are only aim, Hob pick, kettle, wind and one Knack. Workshop at Level 6 with a real choice. Draft at Level 7 or 8. Tree at Level 10.
8. **One pre-battle screen, one tap to fight.** Card, seats, a draft strip and Doodads on one page, with last time's picks kept. "Same again" is the default button on replays.
9. **Shrink the tree to 36 nodes and stop selling the UI.** Forecast, the Rival's ghost lines, shot log and drift read-out are free. Each branch opens with a verb and has one real fork.
10. **Hob growth in 3 ranks, no HP crumbs, no Knack tiers.** Each rank is a Quirk pick. Twenty-eight Quirks at launch.
11. **Five mission types at launch.** Siege, Demolition, Rescue, Puzzle, Grand Fort. At least 22 of 40 levels are the duel on a new map with a new Rival habit.
12. **Rebuild the final boss as two Stages** with Hill Call from the first Roller turn, a clan crate before the last phase, and retry from the Stage on all presets. Keep the teacup.
13. **Take lost turns out of the game.** No skipped shot on Tumble. Extra Reload capped at 1. Buried Loophole greys the Fire button and never bursts in your face. Puff Up is player-only.
14. **Show the enemy crew.** Class icons stay on after the Muster. Hold the Peeper and the full hidden-crew game for the Peaks update, where fog gives it a job.
15. **Give building a voice.** A slow-motion "what broke you" replay after each loss, and one stated habit per Rival to build against. Raise the start grid so the first Workshop visit has three blocks and two good spots.

Also worth doing, lower rank: break the Recall lock (pins fade after one reuse; the AI walks out of brackets); kettle two blocks in; drop rarity; label every Dud; make Daily a seeded Skirmish with no maps of its own; default 2x on Rival turns after Region 1; settle the eight cross-doc conflicts the docs list themselves (Hob count, shell count, Doodad count, branch count, Cover wording, fort gap, audio cap, Reload timing) in one pass with one owner.

---

## 7. Ten things that are great and must be protected

1. **Fair and kind, as hard rules.** No ads, no timers, no energy, no paid power, never lose what you earned, a crash never costs a match. This is the reason to buy and the reason to tell a friend.
2. **The AI that misses like a person.** Wide first shot, bracketing, no wall hacks, "Aim 2 of 5" on the card, no hidden rubber band. Twelve years of Pocket Tanks reviews asked for this.
3. **The aim loop.** Drag, release does not fire, Fine Tune, a big Fire button, the ghost of the last two shots, pins, Recall, numbers always on screen.
4. **Two win paths on screen at all times.** Crew pips and the kettle glow through the wall. The best shot changes as walls open.
5. **The Hob is the weapon, and your crew lives inside your fort.** See-through on your turn. Floors drop, Hobs tumble, hats stack. This is the picture on the store page.
6. **The Unflattening.** A villain who hates lumps turns the genre's worst fault into the story, and hills rising on the map is the reward. Plus the Lump Rule that holds every map to it.
7. **The Rummage.** A short draft against a named Rival, with Quick Pick for those in a hurry.
8. **Grand Forts built from tells and counters.** Themed lieutenants, one-turn warnings, a free beat at each phase, bosses made of parts the region taught. And the Baron's last cup of tea.
9. **Bloodless slapstick with a voice.** Bonked, Snooze Balloons, pots and puddings, Marge and her bread peel. Warm, funny, safe for a nine-year-old, not babyish for a forty-year-old.
10. **The deterministic sim with bots, replays and exact resume.** It is what makes the fair AI, the crash rule, the Daily and nightly balance checks possible. It is also the one piece that lets the team cut and add content without fear.

Two more that cost little and matter a lot: the **Test Yard** with every shot free to try, and **"every shot changes the picture"** as the test for each new shell.

---

## 8. Questions the owner should answer before approval

1. Do you accept a four-region launch with two regions as free, dated updates? If not, the honest schedule for all six is 18 to 24 months with this team **[est]**.
2. Who holds the content counts from here on? One named person must be able to say no to a 29th Hob.
3. Is the casual phone player (group 3) truly a target? If yes, items 5, 6, 7, 8 and 14 in section 6 are not optional. If the game is for old artillery fans first, more of the depth can stay, and the trial will convert fewer people.
4. Couch Duel: the research says it is the most loved thing about Pocket Tanks and the sim gives it nearly free. I would put it in Update 1. The brief says no. Your call.
