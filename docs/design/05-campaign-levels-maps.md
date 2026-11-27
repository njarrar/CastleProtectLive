# 05. Campaign, Levels and Maps

Status: revision 2, after the review rulings. Date: 2026-11-22. Owner of this doc: campaign and level designer.

This doc builds on `00-core-game-design.md` and uses its binding names as written. It holds the story, the regions, every level, the map rules and the side modes. It applies `docs/review/04-rulings.md`. Where a ruling and an older line of this doc clashed, the ruling won.

**Phase tags.** Every content item carries one tag: `[Launch]`, `[U1]` (Long Siege update), `[U2]` (Nithering Heights update) or `[U3]` (Wheal Clank update). A section tag covers all items in it. The launch scope is an owner decision; the plan here is the recommended one [rulings A, D1].

**Cites.** `[00 §2.6]` means the core doc, section 2.6. `[04 §4]` is the enemies doc. `[02 tree]` is the tech tree doc. `[07]` is the UX doc. `[rulings B5]` is `docs/review/04-rulings.md`, item B5. Research cites keep the core doc's style: `[02b §15]`.

**Enemy names.** Lieutenants, wings, Grand Forts, enemy units, mini-bosses and events follow `04-enemies-bosses-ai.md`. Rival names in *italics* in section 3.10 are proposals from this doc.

**Hob names.** Hobs follow `03-crew-units.md`. That doc owns the 16-Hob launch list. This doc owns the level at which each Hob joins [audit C02].

**Numbers.** All numbers are tuning targets unless marked fixed. Bots and playtests set final values [00 intro].

## Changes in this revision

1. **Launch is 40 levels in 4 regions:** Puddingstone Downs, Crag End, Soggy Bottom Fen and the Flats. The Flats moves up to Region 4, so the Baron and the true ending ship at launch [rulings A].
2. **Two wings got away.** Nithering Heights is now Region 5 and ships as U2 (+10 levels). Wheal Clank is Region 6 and ships as U3 (+10 levels). Story beats moved to fit (section 1).
3. **Level IDs changed.** Old 6-x (Flats) is now 4-x. Old 4-x (Heights) is now 5-x. Old 5-x (Mines) is now 6-x. Section 3.2 has the full map from old IDs to new.
4. **Five mission types at launch:** Siege, Demolition, Rescue, Puzzle, Grand Fort. 25 of the 40 launch levels are duels, each on a new map with a new stated Rival habit [rulings A, B17].
5. **Merges.** Trick-shot Challenge and Puzzle Shot are one type, Puzzle. Escort and Defend a Cart are one type, Escort, which ships in U2. King of the Hill ships in U3. Survive Waves lives only in Long Siege (U1) [rulings B16].
6. **Final boss in 2 Stages:** the Grand Roller, then the Level Engine. Hill Call is free from the first Roller turn. A clan crate comes before the last phase. Retry is from the Stage on every preset. The Steward gets her own level, 4-6, the Square Gate [rulings B12].
7. **Last Bell is gone.** The round cap stays, and a battle that reaches it ends in a Sudden Squall, with no tiebreak and no score sum [rulings B5].
8. **Onboarding slowed.** Levels 1-1 to 1-5 teach only aim, Hob pick, the kettle, wind and one Knack. Workshop opens at 1-6, the Rummage at 1-8, Walk at 1-9, the Tinker Tree at 1-10 [rulings B14].
9. **Crew cap 5.** Crew is 1, 2, 3 in the tutorial, 4 from 1-7, 5 by Tinker or a region gift. Rival crews top out at 5. Enemy Class icons stay shown [rulings B3, B10].
10. **Rescue levels free launch Hobs:** Hetty (1-7), Dame Flicka (2-8), Truffle (3-7), Pip (4-8). Tansy, a Lookout, waits for U2. Petra moves to U3. The fifth crew seat is a free gift for beating the Sanding Stair.
11. **Daily Dust-up is a seeded Skirmish** on existing maps. It has no maps of its own [rulings B18].
12. **Raid Rehearsal is a Test Yard button** [rulings B16].
13. **Duel fort gap is 1400 cells at most.** Long maps (up to 1800) come back with Escort in U2 [rulings C4].
14. **Map count at launch: 59.** 41 campaign maps (4-10 has two), 6 Trials, 12 shared by Skirmish and the Daily. The old plan had 136 (section 4.10).
15. **Curve and bands redone** for 40 levels (section 6). The top launch difficulty is 9 of 10. The updates climb to 10.
16. **Audit fixes applied:** Molehills (was Mole Mounds), straw tower (was scarecrow tower), Long Look (was Weather Vane boon), the Drill Sergeant, Trial pay of 100 Buttons, Long Siege pay of 10 per wave, loan shells in fixed pools, the 15% top band wording.
17. **Cut items** moved to Appendix A, "Parked ideas".
18. **Final verification pass** [review 05]. The Sudden Squall hits both sides at once at round end (00 §2.11), so the first-mover order no longer decides a dead level. Level 1-1 has a cap of 8 and no Squall, now also in the core doc. Rescue joins Demolition, Puzzle and Escort as a type with a round limit and no Squall. Canary Row (6-6) frees Petra, not Tacks. The 1-10 crew uses the Mower (the Clipboard Clerk is a U2 Lookout). Baron Rush opens after 6-10. Trial side paths are placed, and mode cards list the weapons doc's shell and Doodad rewards.
19. **Owner decisions applied** [rulings D]. The game is free with no monetization: the trial column, the trial lines in Trials and the Daily, and the Full Kingdom card on the map are gone. Couch Duel ships at launch (section 5.8). Gentle wind from 1-4 with a Wind off assist, and the first Doodad at 1-9, stand as decided.
20. **Loose Trick Shells in 1-3 and 1-4** [review 06 G8]. Lid Lifter is lent in 1-3 and Bag of Marbles in 1-4: one use each, fixed in hand, no draft, no new prompt. The first four levels are no longer Plain Shots only.
21. **"No line" checks in map fairness** [review 06 G10]. Section 4.5 items 15 and 16: a build-time bot sweep marks any launch Hob whose Plain Shot cannot reach the enemy on a map, and no campaign duel map may leave a whole Class with no line.
22. **Enemy swap** [review 06 U10]. The Shoring Crew ships at launch and first appears in 2-9, Scree's Gate. The Silt Lobber moves to U1, so the Fen fields Pump Hands and Plunger Petes; the Great Sump's Mud Rafts carry Plunger Petes [04 §4.4].
23. **Length check at real speed** [review 06 G3]. A round is about 32 s, so fairness item 7 now reads "inside 7 minutes", and the round cap 12 fallback in `00 §9.6` applies to every level if the slice gate fails.
24. **Couch Duel maps** serve the Starter Box (5.8). Loophole Flap and Shove Off need no map change.

---

## 1. Story

### 1.1 The short version

Brickabrac is lumpy and proud of it. Baron Levelwell thinks lumps cause all trouble. His clan, the Flatteners, mow, sand, drain, polish and stamp the land until it is as flat as a table. Your clan builds a walking fort, wins the hills back one region at a time and, at the end, stops the Baron's Level Engine. Each win makes hills pop back up on the Brickabrac Map.

The tone is warm and cheeky [00 §1.4]. Nobody is hurt. Flatteners are fussy, not mean [04 §1.3]. Losers float off on square Snooze Balloons and come back later, cross and a bit sooty.

**Launch and after.** The launch story runs Downs, Crag, Fen, Flats and ends with the Baron on a hill. Two lieutenants slip away in the last fight: Countess Glaze with the Bellows Towers and Ironmaster Bolt with the Stampers. They are "the wings that got away". Each regroups in its own region and returns in a free update: the Heights in U2, the Mines in U3.

### 1.2 Why the Baron does it

When the Baron was small he spilled his tea on a hill. The cup rolled away, then the saucer, then the cake [04 §1.2]. He has blamed hills ever since. Flat land is tidy, and on tidy land nothing rolls off. He does not want to hurt anyone. He thinks he is helping, and he sends the forms in triplicate first.

The player learns this in pieces: a "Notice of Flattening" with a tea ring on it (Region 1), a saucer with a very tall lip (Region 3), Clerk Evenhand's slip of the tongue (Region 4, after 4-3), the full tale in the ending (after 4-10).

### 1.3 Recurring characters

| Name | Side | Role in the story | Voice | Phase |
|---|---|---|---|---|
| **The Reeve** (you) | Clan Knobble (clan name is a proposal) | The player. Never shown, never speaks. You name your fort; the default is *the Wobbly* | none | Launch |
| **Marge Dumpling** [03 §3.1] | Your clan | First Lobber and first Hob. Hint voice in Region 1 | Cheery | Launch |
| **Hetty Mortarboard** [03 §3.7] | Your clan | First Patcher, the clan's builder. Caged in 1-7. Speaks for the clan in story scenes | Dry | Launch |
| **The Sleepy Hills** | The land | Hills have faint sleeping faces. Flat ones snore. When a region is won they yawn and rise. They never speak | Snores | Launch |
| **Baron Levelwell** | Flatteners | The villain. Long grey coat, the flattest cap in Brickabrac, a bubble-level monocle, a teacup always in hand [04 §1.4] | Calm, fussy | Launch |
| **Steward Prudence Plumb** | Flatteners | The Baron's right hand and lieutenant of the Flats. Quiet, exact, secretly likes a little lump. Fought in 4-6 | Polite | Launch |
| **Clerk Tally Evenhand** | Flatteners | A Weights and Measures Rival. He counts hills on a clipboard and crosses them off, starts to like them, and changes sides in 4-8 | Nervous | Launch |
| **Sir Pudge** | Flatteners | The lazy Rival of level 1-1, who naps between turns. He loses, gets a worse job in each region and turns up again | Yawns | Launch |
| **Marshal Mowbray Trimm** | Flatteners | Lieutenant of Puddingstone Downs, Parks and Verges. A fussy head gardener | Clipped | Launch |
| **Dame Enid Scree** | Flatteners | Lieutenant of Crag End, Steps and Slopes. A stern stonemason who respects a good shot | Exact | Launch |
| **Admiral Dabney Sluice** | Flatteners | Lieutenant of Soggy Bottom Fen, the Drainage Board. Soggy and cheerful | Gurgles | Launch |
| **Countess Glaze** | Flatteners | Lieutenant of the Rink Committee. Her crews run the Bellows Towers in the Flats (seen in 4-5). She skates away when the Baron falls and regroups in Nithering Heights. Scores your shots like a skating judge | Cool | Cameo at launch, boss in U2 |
| **Ironmaster Josiah Bolt** | Flatteners | Lieutenant of the Stamp Office. His crews run the Stampers in the Flats (seen in 4-3). He carts them off when the Baron falls and regroups in Wheal Clank. Deaf from the presses, so he shouts | SHOUTS | Cameo at launch, boss in U3 |
| **Pedlar Tuppence** | Neutral | Runs the Pedlar Fort, a tiny walking shop that you guard in Escort levels. Seen on the map at launch as a wave from the road; first met in play in U2 | Sing-song | U2 |

### 1.4 Story arc by region

| Region | Phase | Opening problem | Middle beat | Ending beat | Map change |
|---|---|---|---|---|---|
| 1. Puddingstone Downs | Launch | Parks and Verges mows the home hills into stripes. Your clan has one small Wicker fort | Hetty is caged (1-7) | The Topiary Keep sits down. Marshal Trimm floats off, still snipping | The Downs rise. The Baron's roller shows on the far edge of the map |
| 2. Crag End | Launch | Dame Scree sands the crags into steps, then slopes, then nothing | You learn to dig through Clay (2-4). Dame Flicka hangs in a cage under an arch (2-8) | The Sanding Stair comes down to gravel. The Dame says "good shot" and means it | Cliffs grow jagged again. Goats return |
| 3. Soggy Bottom Fen | Launch | Admiral Sluice pumps the fen dry | The pumps (3-6). Evenhand, sent to count puddles, is seen feeding a frog | The Great Sump sits in the mud. The Admiral sings anyway | Water floods back. Reeds sprout |
| 4. The Flats | Launch | The Baron's home ground. All plate, all level, hills hung in chains like washing. The Rink Committee blow the wind and the Stamp Office stamp the ground | Evenhand lets slip the words "spilled tea" (after 4-3). You beat the Steward (4-6). Evenhand swaps sides (4-8). The three freed regions send help (4-9) | The Level Engine gives one long sad whistle. The Baron finds that tea does not spill on a hill if you hold it level. Glaze and Bolt slip away | The whole launch map is lumpy. Far north a peak still shines flat. Far south a mine mouth still smokes |
| 5. Nithering Heights | U2 | Countess Glaze got away with the Bellows Towers. She has ironed the peaks into one rink | The avalanche you start on purpose (5-8). The Baron sends her a polite note to stop. She scores it 2.1 | The Glidehall glides off the map | Snow caps and sharp peaks return |
| 6. Wheal Clank | U3 | Ironmaster Bolt got away with the Stampers. He stamps the ore flat and tips the spoil into the caves | A Hob is caged in Canary Row (6-6). The Baron turns up in a mine cart, holding his tea level, to say sorry for the noise | The Stampmill loses its rhythm | Mine mouths reopen and glow. All of Brickabrac is lumpy |

### 1.5 Cutscene scripts

Format: still comic panels, 2 to 6 per scene, tap to step, hold to skip. At most 8 words per panel. No voice lines needed; captions carry it [00 §8.2]. Art doc owns the look. Scenes for Regions 1 to 4 are `[Launch]`.

**Intro: "Tidy" (plays after the cold open shot, before level 1-1 proper)**

| Panel | Picture | Words |
|---|---|---|
| 1 | Wide view of Brickabrac. Lumpy hills, each with a small odd fort | "Brickabrac. Lumpy. Proud of it." |
| 2 | A huge roller on the skyline. A very flat cap on top. A teacup | "Baron Levelwell disagrees." |
| 3 | The roller passes. A hill goes flat. Its sleeping face frowns | "Flat is tidy." |
| 4 | Your tiny Wicker fort on stubby legs. Marge waves a ladle | "We like our lumps." |
| 5 | The fort takes one wobbly step | "Up, Stompers." |

**After 1-10: "Stripes"**

| Panel | Picture | Words |
|---|---|---|
| 1 | The Topiary Keep sits in a puff of steam | "Pffffft." |
| 2 | Marshal Trimm drifts off on a square balloon, snipping the air | "My hedges!" |
| 3 | Hills rise with a yawn | "Good morning, Downs." |
| 4 | Far off, the Baron lowers his monocle. A form with a tea ring | "Untidy. Send the Dame." |

**Region 2 open: "Sandpaper"** (2 panels). Dame Scree rubs a crag with sandpaper gloves. Half of it is already steps. "Steps. Then slopes. Then nothing."

**After 2-10: "Gravel"** (3 panels). The Sanding Wheel rolls away down the gorge. A goat stands on Dame Scree's flat cap. She nods at your fort. "Good shot. I said so."

**Region 3 open: "Plug"** (2 panels). Admiral Sluice pulls a giant bath plug. The fen starts to swirl. "Flat AND dry!"

**Mid region 3 (after 3-6): "Frog"** (2 panels). Evenhand, alone, shares a biscuit with a frog. He hides it when the Baron's shadow falls. "Nothing, sir."

**After 3-10: "Soggy"** (3 panels). The Great Sump sits in mud. Water rushes back. The Baron's tea ripples; his saucer has a very tall lip. "Steady."

**Region 4 open: "Washing line"** (3 panels). The Flats: a plate to the skyline. Hills hang from chains like washing. Far back, a Bellows Tower turns and a Stamper slams. The Baron sips tea. "Nearly done."

**Mid Region 4 (after 4-3): "Slip"** (3 panels). Evenhand reads a list to a caged Hob (Pip). "Item nine: no more spilled te..." He claps a hand on his mouth. Pip's eyebrow goes up.

**After 4-6: "Plumb"** (2 panels). The Square Gate stands open. Steward Plumb bows and steps aside. She pockets one small pebble. "Rather lumpy. Well done."

**After 4-8: "Clipboard"** (3 panels). Evenhand snaps his clipboard in half. He steps into your fort. "I counted wrong. On purpose."

**Ending: "Level" (after 4-10)**

| Panel | Picture | Words |
|---|---|---|
| 1 | The Level Engine sputters. Steam from every pipe | One long, sad whistle |
| 2 | Chains snap. Hills pop up, all across the Flats | "Good morning, everyone." |
| 3 | The Baron floats down on a square balloon, cup in hand | "Oh dear." |
| 4 | He lands on a new hill. The tea tilts. He holds the cup level | "...It did not spill." |
| 5 | Hetty hands him a saucer with a lip | "For hills." |
| 6 | Wide view: Brickabrac, lumpy. The Baron sits on top, looking far | "Brickabrac. Lumpy again." |

**After the credits** (2 panels). Panel 1: Sir Pudge, asleep on a hillside. He rolls slowly down it. He does not wake. "Zzz." Panel 2: far off, a skate track runs north and a cart of Stampers rolls south. "Two got away."

**The wings that got away.**

- `[U2]` **Region 5 open: "Shine"** (3 panels). The Baron, on his hill, posts a letter. Countess Glaze buffs a peak. A goat slides past, legs out. She reads the letter and holds up a score card. "Two point one."
- `[U2]` **After 5-10: "Slide"** (3 panels). The Glidehall glides down its own rink and off the map edge. Snow falls on the peaks again. Hetty: "Told you. Grit."
- `[U3]` **Region 6 open: "Stamp"** (2 panels). Ironmaster Bolt rings a bell. A press comes down on a small hill. "STAMP!"
- `[U3]` **Mid Region 6 (after 6-6): "Sorry"** (2 panels). The Baron rolls past in a mine cart, cup held level. He lifts his cap to the freed Hob. "Dreadful racket. My fault."
- `[U3]` **After 6-10: "Out of step"** (3 panels). The three Stampers stop, one, two, three. The Stampmill sits. Lamps light, one by one, down the shafts. "Wheal Clank is open."
- `[U3]` **Last panel of all** (1 panel). All six regions, lumpy. "The Unflattening. Done."

---

## 2. The regions

Region names follow the core doc [00 §7.2]. Weather uses Weather Fronts [00 §2.5]. Hazards follow the Hazard Beat rule in section 4.6.

### 2.1 Summary

| # | Region | Phase | Biome | Lieutenant and Grand Fort [04 §1.4, §4] | Wind range | New mechanic taught |
|---|---|---|---|---|---|---|
| 1 | Puddingstone Downs | Launch | Grass hills, hedges, streams | Marshal Mowbray Trimm, **the Topiary Keep** | 0 to 3 | The core battle: aim, crew, Kettle Pop, wind, a Knack, the Workshop, the Rummage, Walk |
| 2 | Crag End | Launch | Cliffs, ledges, gorges | Dame Enid Scree, **the Sanding Stair** | 0 to 5, updrafts | Height: cliffs, Thump, Dig through Clay, bank shots, Fire on wood |
| 3 | Soggy Bottom Fen | Launch | Marsh, ponds, mud, reeds | Admiral Dabney Sluice, **the Great Sump** | 0 to 4, Drizzle | Wet play: Water, Mud, Soaked, Fire against Water, tide |
| 4 | The Flats | Launch | Rolled plate land, hills in chains | Steward Prudence Plumb (4-6), then Baron Levelwell: **the Last Level** | 0 to 6, bellows | Making ground: raise hills, drop hills, fight the machines |
| 5 | Nithering Heights | U2 | Snow peaks, ice lakes | Countess Glaze, **the Glidehall** | 4 to 10 | Strong wind, Frost and Brittle, Ice, sliding, hidden crew and the Lookout, Escort |
| 6 | Wheal Clank | U3 | Caves, rails, lava seams | Ironmaster Josiah Bolt, **the Stampmill** | 0, with Draughts | Ceilings, Zap chains, magnets, Mossbrick, King of the Hill |

### 2.2 Region 1: Puddingstone Downs `[Launch]`

- **Look.** Round green hills dotted with puddingstone (pebbles set in rock like fruit in a cake). Dry stone walls, hedges, jam orchards, washing lines. Mown stripes and clipped hedges where Parks and Verges has been.
- **Palette notes.** Warm and soft. Meadow green, butter yellow, jam red for accents, pale sky blue. Flattener parts in flat grey and hazard stripe. Art doc sets the values.
- **Terrain style.** Loam hills with Rock cores. Height gaps of 40 to 120 cells. Small streams (shallow Water) and one or two Clay banks. No caves yet.
- **Hazards.**
  1. **Tumblestones.** Round boulders perched on slopes. Carve the ground under one, or hit it, and it rolls downhill. It crushes 30 per block it rolls over and stops in the first pit or water.
  2. **Springy Hedges.** Thick hedges. Light shells bounce off them once. Medium and Heavy shells tear a hole. Fire burns them away.
  3. **Molehills.** At a marked spot, a mole pushes up a 24-cell Loam mound at each new Weather Front. Mounds block rollers and flat shots.
- **Weather.** Clear, then Breeze. No wind in levels 1-1 to 1-3 [00 §2.5]. Wind 2 from 1-4. Never above 3.
- **Music mood.** Jaunty, sunny, safe: banjolele, tin whistle, tuba, washboard [07 §9.2].
- **New mechanic taught.** One thing per level: aim, Hob pick, Kettle Pop, wind, a Knack, the Workshop, Rescue, the Rummage, Walk, then a Grand Fort (section 6.4).
- **Enemy style.** Parks and Verges [04 §1.4]: low, neat Wicker and Timber boxes with hedge caps, 1 to 4 Hobs, Aim 1 to 2 of 5.

### 2.3 Region 2: Crag End `[Launch]`

- **Look.** Tall grey and rust cliffs with layers like a stack of books. Half the crags are sanded into neat steps with Steps and Slopes scaffolds bolted on. Goats on every ledge.
- **Palette notes.** Slate grey, rust orange, lichen green, a cold white sky. Clay bands in ochre so players can read where Dig works.
- **Terrain style.** Rock cliffs with Clay seams and thin Loam caps. Ledges, overhangs, arches, gorges. Height gaps of 120 to 260 cells. This region sets the high mark for height.
- **Hazards.**
  1. **Rockfall Shelves.** Cracked ledges of Rock. A Heavy hit, or two Medium hits, breaks one loose. It falls straight down and crushes like 6 Cobble blocks.
  2. **Updraft Vents.** Columns of warm air in gorges. A shell that crosses one gains lift (about +80 cells of height). A drifting feather marks each column.
  3. **Butting Goats.** A goat on a ledge butts any roller or bouncing shell back the way it came. Blasts scare the goat off for 2 rounds. No goat is ever hurt.
- **Weather.** Clear and Breeze. Wind 0 to 5. Wind is stronger above the cliff tops than in the gorges (a "wind line" drawn as blowing grass).
- **Music mood.** Bold, craggy, echoing: hammered dulcimer, alpine horn, stomps and rock knocks [07 §9.2].
- **New mechanic taught.** Shooting up and down. Thump from carved ledges. Fire on wood (Edna joins in 2-1). Dig through Clay. Bank shots off Rock.
- **Enemy style.** Steps and Slopes: tall Cobble towers set in ledges, terraced like stairs, 3 to 4 Hobs, Aim 2 to 3. First fixed Outposts. The **Shoring Crew** braces a tall tower's column from 2-9 on: Bonk the prop and the fort falls, the region's lesson in one unit [04 §2.2].

### 2.4 Region 3: Soggy Bottom Fen `[Launch]`

- **Look.** Low green marsh under a big sky. Reed beds, lily ponds, stilt huts, leaning willows. Drainage Board pumps and pipes suck the water away, leaving cracked mud.
- **Palette notes.** Moss green, pond teal, mud brown, reed gold, pink lilies. Pumps in dull brass.
- **Terrain style.** Low Loam and Mud islands in Water. Dykes of Clay. Few tall hills, so the Lump Rule is met by water, pits, dykes and height gaps of 80 to 100 cells [00 §2.6]. Barge forts float.
- **Hazards.**
  1. **Burp Vents.** Geysers. On a set beat they fling any shell above them straight up 150 cells and spray water (Soaked) in a Small radius.
  2. **Tide.** The water level rises or falls 60 cells on a set beat. A Nook under water greys its Fire button. Burn ends. Loam it touches turns to Mud.
  3. **Marsh Gas.** Bubbles that drift up from marked mud. Fire sets one off as a Small Blast of Fire. Anything else pops it with no effect.
  4. **Sink Mud.** Deep Mud patches. A fort that ends its Walk on one sinks 16 cells per round, to a cap of 48. It can walk out at x3 Steam.
- **Weather.** Breeze and **Drizzle**. Drizzle: Burn lasts 1 turn, not 2; bare Loam turns to Mud after two Weather Fronts. **Fog Bank** in one level, 3-7 (section 4.7).
- **Music mood.** Sneaky, damp, sly: bass clarinet, jaw harp, marimba, frog guiro [07 §9.2].
- **New mechanic taught.** Soaked, Mud, Fire against Water, fluid patches that pool low, skipping shots on water, tide timing.
- **Enemy style.** The Drainage Board: forts on barges and stilts with pipes outside, Timber hulls and Cobble pump rooms, 4 Hobs, Aim 2 to 3. Pump Hands and Plunger Petes; Dredgers and Silt Lobbers join in U1 [04 §2.2].

### 2.5 Region 4: The Flats `[Launch]`

- **Look.** A pressed metal-grey plain to the skyline, with rivet lines and tidy drains. The stolen hills hang above it from cranes and balloons, in chains, like washing. Stampers built by the Stamp Office, rollers, Bellows Towers run by the Rink Committee. The Baron's tea tent.
- **Palette notes.** Flat grey and off-white with hazard yellow. Every hill the player frees brings back green, so colour returns to the screen as the level goes on.
- **Terrain style.** The ground is Pressed Plate (acts as Rock) with rolled trenches, drains and pits. **Hoisted Hills** (floating chunks of Rock and Loam on chains) give the height. The Lump Rule still holds on every map: each has at least a trench or pit plus a Hoisted Hill, a cliff-edged plate step or a tower [00 §2.6].
- **Hazards.** All four are first met here. The region teaches each one in a plain level before the boss uses it.
  1. **Hoisted Hills** (first in 4-1). Cut a chain (40 HP) and the hill falls. It crushes like 10 Cobble blocks and stays as a real hill.
  2. **Big Ethel** (first in 4-2). The lawn roller mini-boss of [04 §5.1], used here as a map hazard. It crosses the field at 96 cells per turn and flattens Loam and Clay in its lane. A fort it reaches takes a Thump and loses its cover hill. It does not care whose side it is on. A mound stops it for one turn. Its boiler (120 HP) is a Weak Spot.
  3. **Stampers** (first in 4-3). Stamp Office pistons set over marked zones on the plate. Each slams on its beat: Blast 60 in its zone, and the ground there drops 16 cells. The zone glows one round ahead. A Stamper that slams onto a fresh mound jams for a round.
  4. **Bellows Towers** (first in 4-5). Rink Warden wind machines. Each standing tower adds 2 wind toward the player. Break a tower (120 HP) to stop it.
- **Weather.** **Bellows Gale.** Wind is whatever the Bellows Towers make: 0, 2, 4 or 6. With none standing, wind is 0. This is the strongest wind at launch. Wind of 7 to 10 waits for the Heights.
- **Music mood.** Stiff, too neat, uneasy: snare, piccolo, a metronome tick. Each time the player adds or restores ground, a folk instrument from Regions 1 to 3 joins, until the Lump Tune takes the march over [07 §9.2].
- **New mechanic taught.** Making ground. Mound shells, Hill Call and dropped hills build cover, stall machines and give height. Every earlier lesson returns.
- **Enemy style.** Weights and Measures: Brassbound and Cobble squares on an exact grid, mirrored, 4 to 5 Hobs, Aim 3 to 4. Machines as second targets. Mossbrick faces are added to these forts in U3 for Ironclad and Baron Rush only; the launch levels never need it.
- **After the Baron falls.** The Bellows Towers and Stampers leave the Flats with Glaze and Bolt. Replays of Flats levels keep them, since replays show the level as it was.

### 2.6 Region 5: Nithering Heights `[U2]`

The first wing that got away. Countess Glaze took the Bellows Towers north.

- **Look.** Sharp white peaks with wind plumes like whiskers. Half are buffed to glassy domes by Countess Glaze and her Rink Committee. Pine stubs, prayer-flag washing lines, frozen tarns.
- **Palette notes.** Ice blue, snow white, pine green, with warm orange lamp light in forts so crews read well against snow.
- **Terrain style.** Rock peaks with Ice skins and loose snow (Loam that settles fast). Frozen lakes: Ice over Water. Steep slopes of 30 to 45 degrees. Height gaps of 100 to 220 cells.
- **Hazards.**
  1. **Snow Drifts.** At each new Weather Front the wind piles a 32-cell snow mound on the lee side of every ridge. Drifts bury low Loopholes until cleared.
  2. **Icicle Racks.** Rows of icicles under overhangs. Any blast within a Medium radius drops them. Each deals Pierce 20 straight down.
  3. **Thin Ice.** Ice over water, marked with cracks. Fire or a Heavy blast breaks it. A fort on broken ice drops into the water: Thump, Soaked, and it cannot Walk for 2 rounds.
  4. **Avalanche Slopes.** A loaded slope, marked with a dotted line. A Heavy blast at the top sends the snow down. It buries what is at the foot under 60 cells of snow.
- **Weather.** **Snowfall** (wind 4 to 6) and **Blizzard** (wind 7 to 10; this is the Gale event of [04 §5.2] with snow). In one level the Weather Front lasts 1 round. The forecast always shows [00 §2.5].
- **Music mood.** Thin, bright, on edge: celesta, bowed saw, sleigh bells, long quiet gaps [07 §9.2].
- **New mechanic taught.** Aiming in strong wind. Wind shadow behind ridges. Frost and Brittle. A Frost hit can make a Hob need a rest [rulings B16]. Ice speeds rollers and breaks under Fire.
- **Enemy style.** The Rink Committee: ice palaces on runners, thin spires, Brassbound frames with frost panels, 4 to 5 Hobs, Aim 3. Skater forts that Walk every turn [04 §3].
- **Also new in U2.** Hidden enemy crew and the Lookout Class arrive here, where fog and blizzard give scouting a job [rulings B10]. The Escort mission type and Long maps arrive here too.

### 2.7 Region 6: Wheal Clank `[U3]`

The second wing that got away. Ironmaster Bolt took the Stampers underground.

- **Look.** Big lamp-lit caverns. Timber props, rails, ore carts, brass pipes, glowing lava seams far below. Stamp Office pistons stamp the ore flat and spoil chutes pour the leavings in from the roof.
- **Palette notes.** Dark blue-brown rock, lamp amber, lava orange, brass. Forts and crews are lit by their own lamps so they stay readable. No level is dark enough to hide a shell.
- **Terrain style.** Rock floor and Rock ceiling with Clay and Loam infill. Ceiling height of 220 to 320 cells above the floor. Pillars, galleries on two levels, shafts. Lava in pits.
- **Hazards.**
  1. **Lodestones.** Big magnets. Shells tagged "metal" (weapons doc sets the tag) bend toward one inside its marked ring. Stone and wicker shells ignore it.
  2. **Stalactites.** Hang from the roof. A blast within a Small radius drops one: Pierce 30 and it sticks in the ground as a Rock spike.
  3. **Mine Carts.** Roll along rails on a set beat. A cart blocks shots and crushes 20. A Switch Lever, when hit, sends it down the other track.
  4. **Lava.** Not solid. A shell that lands in it throws a Small Fire splash. A fort cannot walk into it. Fluids that reach it turn to steam.
  5. **Gas Pockets.** Marked green haze. Fire inside one sets off a Large Blast. It can be burned off on purpose, by either side.
- **Weather.** No wind underground. **Draughts**: marked shafts where air moves at a fixed wind value inside the shaft only.
- **Music mood.** Work song, heavy, driving: bass accordion, low brass, anvil hits, a hummed Hob choir [07 §9.2].
- **New mechanic taught.** Low arcs and bank shots under a roof. Zap chains through Brassbound [00 §2.8]. Bending shots with magnets.
- **Enemy style.** The Stamp Office: wide Brassbound mill forts with shutters, rails and dynamo rooms, 5 Hobs, Aim 3 to 4. Spark Fitters and Ore Droppers. One fort that hangs from the roof (6-9).
- **Also new in U3.** Mossbrick, the Zap damage type and King of the Hill arrive here.

---

## 3. The levels

Launch has 40 levels. U2 adds 10 and U3 adds 10, for 60 in all.

### 3.1 Mission types

Five types ship at launch. Each uses the core turn model [00 §2.2]. None needs a clock in seconds; "timed" means a round limit [00 §2.13].

| Code | Type | Phase | Rules | Win | Lose |
|---|---|---|---|---|---|
| SS | **Siege** | Launch | The core duel | Clean Sweep or Kettle Pop [00 §2.11]. After the level's round cap the Sudden Squall forces one of them | Your fort falls |
| TD | **Demolition** | Launch | Flattener structures have an integrity bar. Bring them under the target % inside the round limit. Light return fire | Target met in time | Round limit reached, or your fort falls |
| RH | **Rescue** | Launch | A captive (60 HP) sits in a Cage (a Nook with bar blocks). Break 2 bars to open it. The Cover rule guards the captive while the Cage is whole [00 §2.10]. Once open, the captive rides a balloon to your fort in 1 round and cannot be hit | Captive lands in your fort | Captive Bonked, round limit reached, or your fort falls |
| PZ | **Puzzle** | Launch | Fixed crew, fixed shells, fixed shot count. No Rival turns. Hazards keep their beat. Free retry and Take Back are always on. The goal is one of two kinds: clear the targets, or ring Bell Targets that each have a condition (after a bounce, through a hoop, after a skip). This type merges the old Puzzle Shot and Trick-shot Challenge | Goal met with shots in hand | Out of shots |
| GF | **Grand Fort** | Launch | Boss. A fort with Rig Parts and phases. Every Set Piece shows at least one full player turn ahead. Heartkettle HP is 300, as for every fort; phases gate the boss [rulings B4] | Kettle Pop or Clean Sweep; both stay open | Your fort falls |
| ES | **Escort** | U2 | An ally moves a set distance each round if the way is clear: the Pedlar Fort on foot, or a Cart on a road, rail, sled run or raft. It has 150 HP and no shots. It stops at steps over 32 cells, water, rubble and enemy mounds. You clear and shield; Patchers can mend it. This type merges the old Escort and Defend a Cart | Ally reaches its flag, or the Rival falls first | Ally at 0 HP, round limit, or your fort falls |
| KH | **King of the Hill** | U3 | A marked Hilltop zone, 160 cells wide. At each Round end a fort with over half its Footing in the zone scores 1 Crown. Both in: no Crown. Steam is 200. A fallen Rival comes back as a fresh reserve fort 2 rounds later (2 reserves) | First to 5 Crowns | Rival reaches 5 Crowns, or your fort falls |
| SW | **Waves** | U1, in Long Siege only | Rival forts come one after another. Your damage stays (section 5.5). No campaign level uses it | | |

**Sudden Squall.** The core doc owns the rule [00 §2.11]: after the round cap a storm starts. The wind grows at each Squall round start, and at each Squall round end both sides' kettles and blocks lose HP at once, so any fight ends by the end of the third Squall round. If both kettles pop on the same hit, the side with more total HP left wins; there is no score sum [rulings B5]. A level row sets the round cap; the default is 15. In Demolition, Puzzle, Rescue and Escort the round or shot limit is the mission rule itself, so those rows give a limit and no Squall follows. Level 1-1 is the one Siege with no Squall (see its row).

**Shared Action rule.** When the Rival side has more than one piece (a fort plus Outposts), the side still gets one Action per Turn [00 §2.2]. This keeps rounds short. Summoned add-ons in Grand Forts share the boss's Action in the same way.

**Outposts.** Small fixed Flattener emplacements with no Stompers: 2 x 2 to 3 x 3 blocks, one Hob, no Heartkettle. Bonk the Hob to clear one. They follow the same pattern as the add-on forts that bosses summon [04 §4.1, §4.4].

**Every fort passes the validator.** Each fort, player or Rival, must pass the Workshop validator [rulings B3]. Fort sizes in the rows are hints. Where an archetype's layout and a row's block count differ, the archetype's shape wins and the row's crew and materials stand. Level data that fails the validator fails the build.

**Level data may set** the round cap, the pool size and picks for the Rummage, Steam and front length. The level card shows each change [audit C38, C72]. A fixed pool may lend shells from the Rival's list; the card marks them "on loan" [audit C37].

### 3.2 How to read the tables

- **ID** is region-level. **Type** uses the codes above.
- **Map** gives a size class (P, S, M, L; see 4.8) and the shape in words, left to right. You are always on the left [00 §2.1].
- **Cap n** is the round cap; the Sudden Squall starts after it. The default is 15. **Aim n** is the Rival's aim rating of 5 [00 §3].
- **Enemy setup** names Classes and materials. Each Class maps to the wing's unit in [04 §2.2]: a Region 1 Lobber is a Hedger, a Region 3 Stoker is a Pump Hand, and so on. Enemy Class icons show on the card and stay on in battle [rulings B10]. Section 3.10 names the Rival and its habit. Section 3.11 names the castle archetype.
- **Pennants**: 1 is always the win. 2 and 3 are the level goals [00 §5.1]. No goal needs a hard preset. Goals 2 and 3 never clash, so one clean run can earn all three. Good goals teach a new line of play; few goals are plain speed goals.
- **Diff** is target difficulty, 1 to 10, on Fair.
- **+Name** means that Hob joins: tutorial Hobs (Marge, Miss Quill, Jax) at the start of the level, all others on first clear.

**Old IDs to new IDs.**

| Old ID | New ID | Note |
|---|---|---|
| 1-1 to 1-3 | 1-1 to 1-3 | Same levels, slower lessons |
| 1-4 Rummage Sale | 1-8 | First Rummage moves back |
| 1-5 Breezy Tops | 1-4 | Wind moves up |
| 1-6 Tumblestone Lane | none | Its lesson (collapse) moves to Trial T1 and 2-5. See Appendix A |
| 1-7 Hetty in a Jam | 1-7 | Same |
| 1-8 Hedge Hop | Trial T2 | Now a Trial; Bobbin joins at 1-8 |
| 1-9 Jam Cart Road | 1-9 Over Loaf Hill | Same map as a duel. The cart version is held for Escort (Appendix A) |
| 2-3 Goat Track | 2-6 | Same crag as a duel. The Escort version is held |
| 2-5 Echo Gorge | 2-3 | |
| 2-6 Crown of the Crag | 2-7 | Same mesa as a duel. The King of the Hill version is held for U3 |
| 2-7 Scaffold Row | 2-5 | |
| 2-9 Scree's Gate | 2-9 | Now one duel. The wave script feeds Long Siege |
| 3-3 Ferry Cross | 3-3 | Same pond as a duel against a drifting barge |
| 3-8 Stilt Town | 3-8 | Same knoll as a duel |
| 3-9 The Leaky Line | 3-9 | Now one duel. The wave script feeds Long Siege |
| 4-1 to 4-10 (Heights) | 5-1 to 5-10 | U2 |
| 5-1 to 5-10 (Mines) | 6-1 to 6-10 | U3 |
| 6-1 to 6-4 (Flats) | 4-1 to 4-4 | |
| 6-5 The Long Flat Mile | none | Held (Appendix A) |
| 6-6 Full Bellows | 4-5 | |
| 6-7 Everyone's Hill | none | Held for U3 (Appendix A) |
| 6-8 Evenhand's Mistake | 4-8 | Frees Pip, not Tansy |
| 6-9 The Last Lump | 4-9 | Now one duel |
| 6-10 The Last Level | 4-10 | Two Stages. Stage 1 of the old fight is level 4-6 |

Levels not listed keep their ID and name.

### 3.3 Region 1: Puddingstone Downs `[Launch]`

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 1-1 | First Lump | SS | S. You on a low knoll, one round hill mid-field, Rival 40 cells lower in the open | Clean Sweep Sir Pudge | No wind. Cap 8. Full preview on shot 1 only [00 §8.3]. No Squall here: if Round 8 ends, Sir Pudge dozes off, his fort sits down and you win with 1 Pennant | Wicker 4 x 4, 1 Hob (Lobber) and 1 Dummy. Aim 1 | Marge alone. Aim Drag, Fire button, Ghost, Pin, Bonk | 1 Win. 2 Land 2 hits in a row. 3 Win by Round 5 | 1 |
| 1-2 | Two Hats | SS | S. Twin humps with a dip between. Rival fort has a tall tower above the far hump and a low room behind it | Clean Sweep | No wind. Cap 10. The tower Hob needs a flat shot; the low Hob needs a lob | Wicker 4 x 4, 2 Hobs (Zinger high, Lobber low). Aim 1 | +Miss Quill (Zinger). Pick the shooter. Fine Tune | 1 Win. 2 Bonk a Hob with each of your Hobs. 3 No Hob of yours Bonked | 1 |
| 1-3 | Kettle on the Knoll | SS | S. Shallow valley. Rival on a knoll 100 cells up; its Heartkettle glows one block behind a thin wall | Kettle Pop or Clean Sweep | No wind. Cap 12. Crew sits deep, kettle sits shallow. **Loose shell:** one Lid Lifter in the hand, lent for this level (one use, no draft); its card glows under the "Pop the kettle" prompt | Timber-faced Wicker 4 x 4, 2 Hobs (Lobber, Scatterjack) and 1 Dummy. Aim 1 | Kettle Pop, the second way to win | 1 Win. 2 Win by Kettle Pop. 3 Your kettle above 50% | 1 |
| 1-4 | Breezy Tops | SS | M. Three rolling hills. Rival on the far crest, 80 cells above you | Beat the Rival | Wind 2, then 1 the other way. Forecast pointed out once. **Loose shell:** one Bag of Marbles in the hand, lent for this level; Jax is its Match, so he fires it with no Rest. No new prompt | Timber 5 x 4, 3 Hobs (Lobber, Scatterjack, Zinger). Aim 1 | +Jax (Scatterjack). Wind, Weather Front, forecast | 1 Win. 2 Land 3 hits in a row. 3 No Hob of yours Bonked | 2 |
| 1-5 | Under the Roof | SS | M. A dell with a Molehill spot on its near rim. The Rival sits in the dell under a two-block Timber roof | Beat the Rival | Wind 0 to 2. A Plain Shot needs four turns to open the roof; Marge's Knack needs one. The Knack makes her "need a rest" for a turn | Timber 5 x 4, 3 Hobs (Lobber, Zinger, Scatterjack). Aim 2 | One Knack and "needs a rest". Molehills. Skirmish opens after this level [00 §6] | 1 Win. 2 Bonk a Hob with a Knack. 3 Your kettle above 60% | 2 |
| 1-6 | Roof Trouble | SS | M. A long slope up to the right. The Rival's Stamp Tower stands half way up and lobs down on you. You in a hollow below | Beat the Rival | The Workshop opens before this level with 3 free Cobble blocks and two good spots for them: over your top Nook or over your Kettle Room. Wind 0 to 2 | Beanpole (the Stamp Tower), Timber 4 x 7, 3 Hobs (Lobber, Lobber, Zinger). Aim 1 | The Workshop, with a real choice. A Rival habit to build against. Test Yard opens. +Grub (Digger) | 1 Win. 2 No Hob of yours Bonked. 3 Your kettle above 60% | 2 |
| 1-7 | Hetty in a Jam | RH | M. A Cage on a stone post on the middle hill. Rival fort in a hollow beyond. Springy Hedge in front of the Cage | Free Hetty Mortarboard | Cage has 3 Timber bars. Break 2. Blasts near the Cage hurt her. Cap 14 | Timber 4 x 4, 3 Hobs (Lobber, Zinger, Scatterjack). Aim 1 | Rescue. Crew of 4, with a free fourth Nook. Springy Hedges. +Hetty (Patcher) | 1 Win. 2 Captive takes no damage. 3 Free her by Round 6 | 2 |
| 1-8 | Rummage Sale | SS | M. Two orchards on two low hills. A stream gully between them. A low stone ridge in front of the Rival | Beat the Rival | First Rummage: pool of 4, 2 picks each [00 §8.3]. One pool shell is on loan. Wind 0 to 2 | Timber 5 x 5, 4 Hobs (Lobber, Zinger, Scatterjack, Bouncer). Aim 2 | The Rummage and shell cards. +Bobbin (Bouncer) | 1 Win. 2 Bonk a Hob with a Trick Shell. 3 Use both your Trick Shells | 3 |
| 1-9 | Over Loaf Hill | SS | M. See the example in section 7.1. Home Knoll, a ford, a low hump, then Loaf Hill between you and the Rival on High Hill | Beat the Rival | Loaf Hill shuts every flat line from your start pad. A Walk of about 30 Steam to the hump opens one. One Tumblestone on Loaf Hill. Wind 0 to 2 | Pancake fort on a high hill, Timber with a Cobble roof, 4 Hobs (Lobber, Lobber, Scatterjack, Bouncer). Aim 2 | Walk and Steam. Tumblestones. Cobble on a Rival fort | 1 Win. 2 Land hits from two different spots. 3 No Hob of yours Bonked | 3 |
| 1-10 | The Topiary Keep | GF | M. You and the boss face each other across one gentle hill with a lawn roller parked on top. A stream behind you | Beat Marshal Trimm | Three phases [04 §4.2]: hedges regrow while the Sprinkler Root stands; Little Ethel rolls 120 cells a turn and shaves the hill; giant shears snip your top rows. Cap 18 | Grand Fort, Timber with hedge skin. Crew: 2 Hedgers, Raker, Mower. Aim 2 | Grand Fort. Phases and Rig Parts. The Tinker Tree opens on the first win. Daily Dust-up opens. Trial end card | 1 Win. 2 Break the Sprinkler Root by Round 4. 3 The hill keeps over half its height | 4 |

### 3.4 Region 2: Crag End `[Launch]`

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 2-1 | Long Way Up | SS | M. You in a valley. Rival on a cliff shelf 200 cells up, under an overhang that shields its lower rooms from lobs | Beat the Rival | Wind 0 to 3. Its top floors are Timber and burn; its base is Cobble and does not | Timber over Cobble 4 x 6, 3 Hobs (Zinger, Lobber, Scatterjack). Aim 2 | Shooting uphill. +Edna (Stoker). Fire on Timber | 1 Win. 2 Burn 3 enemy blocks. 3 No Hob of yours Bonked | 3 |
| 2-2 | Shelf Life | SS | M. Two facing ledges over a deep gorge. Each ledge is Clay on Rock. A Rockfall Shelf hangs over each fort | Beat the Rival | Carve the ledge and the fort drops 60 cells: Thump. Works both ways | Cobble 4 x 5, 4 Hobs (Lobber, Digger, Zinger, Scatterjack). Aim 2 | Thump. Rockfall Shelves | 1 Win. 2 Thump the Rival. 3 Your fort never Thumps | 3 |
| 2-3 | Echo Gorge | PZ | P. A zigzag canyon of bare Rock, open at the top. Two Updraft Vents. Four bells on ledges | Ring 4 bells with 7 shots | Each bell must ring after a wall bounce or an updraft ride | None | Puzzle, the first in the campaign. Bank shots. Updraft Vents. Breather. +Old Thumper (Lobber) | 1 Win. 2 Use 5 shots or fewer. 3 Ring a bell after 3 bounces | 3 |
| 2-4 | The Under-Way | SS | M. A Rock wall 300 cells high splits the map. A Clay seam runs through its base. A narrow notch at the top | Beat the Rival | Wind 3 to 5 above the wall, 0 below. Flat shots cannot pass until someone digs. A Tidy Balloon drifts over the wall top [04 §5.2] | Cobble 5 x 5, 4 Hobs (Lobber, Lobber, Digger, Patcher). Aim 2 | Dig through Clay with Grub. Wind line | 1 Win. 2 Hit the Rival through a tunnel. 3 Your kettle above 50% | 4 |
| 2-5 | Scaffold Row | TD | M. A sawn cliff face on the right with three Timber scaffolds bolted on at three heights. A gorge between | Drop all 3 scaffolds in 9 rounds | Each scaffold falls on the one below. Outposts sit on the scaffolds. Sir Pudge naps in the lowest | 3 Outposts (Zinger, Lobber, Lobber). Aim 2 | Demolition, the first in the campaign. Chain collapse. Cobble Crush x2 seen in play. Breather | 1 Win. 2 Done in 6 rounds. 3 Drop 2 scaffolds with one shot | 3 |
| 2-6 | Goat Track | SS | M. A switchback crag. You on the lower bend. Rival on a spur 160 cells up. Goats on two ledges between | Beat the Rival | A goat butts any roller or bouncing shell back the way it came. Blasts scare a goat off for 2 rounds. Wind 0 to 4 | Cobble 4 x 6, 4 Hobs (Bouncer, Bouncer, Lobber, Zinger). Aim 2 | Butting Goats. A Rival whose own shots can come back | 1 Win. 2 A goat sends a Rival shot back into the Rival. 3 Your fort never Thumps | 4 |
| 2-7 | Crown of the Crag | SS | M. A Rock mesa in the centre, 240 cells above both pads, with a Loam ramp on each side and a pit at the foot of each ramp | Beat the Rival | Flat lines are shut until a fort climbs a ramp or carves it. Wind 0 to 4. Rockslide Rex rolls toward the lower fort [04 §5.1] | Onion, Cobble 5 x 5, 4 Hobs (Lobber, Digger, Bouncer, Patcher). Aim 3 | A long Walk as a real choice. A mini-boss on the map | 1 Win. 2 Rockslide Rex never reaches your fort. 3 No Hob of yours Bonked | 5 |
| 2-8 | The Hanging Cage | RH | M. A Rock arch over the gorge. The Cage hangs under it, hidden from lobs. Rival on the far rim | Free Dame Flicka | Only a bounce, a beam or an updraft ride reaches the Cage. Cage bars are Cobble. Cap 15 | Bait Box, Cobble 5 x 6, 4 Hobs (Zinger, Zinger, Lobber, Patcher). Aim 3 | Indirect shots as the only way in. Dummys in the outer Nooks. +Dame Flicka (Zinger) | 1 Win. 2 Captive takes no damage. 3 Free her by Round 8 | 5 |
| 2-9 | Scree's Gate | SS | M. A narrow pass. You on a rock sill. The Rival on a stepped road at the upper right, 180 cells up | Beat the Rival | The Rival walks one step down the road each time its kettle loses a third. Each step is lower and closer | Cobble 5 x 6, 4 Hobs (Lobber, Zinger, Shoring Crew, Digger). The Shoring Crew braces the column under the top Nook. Aim 3 | No new rule. A Rival that closes in. First Shoring Crew: Bonk it and the braced column falls | 1 Win. 2 Your kettle above 50% at the end. 3 Win before the Squall | 5 |
| 2-10 | The Sanding Stair | GF | M. A cliff on the right with three ledges: high, middle, low. A Loam ridge between the forts. Loose boulders in the cliff above your pad | Beat Dame Scree | Three phases [04 §4.3]: Rockfall over your fort; the tower rides a lift down one ledge per phase; the Sanding Wheel shields one face, then sands the ridge down 16 cells a turn. Cap 18 | Grand Fort, tall Cobble tower on 3 Timber Prop Beams. A Chiseler and a Filler join in phase 2. Aim 3 | A boss that changes height. A Shield with a Weak Spot. First win gives the fifth crew seat as a gift | 1 Win. 2 Never hit by Rockfall. 3 Break all 3 Prop Beams | 6 |

### 3.5 Region 3: Soggy Bottom Fen `[Launch]`

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 3-1 | Wet Feet | SS | M. Two mud islands, a wide pond between. Reed banks. Rival low on a flat, 80 cells under you | Beat the Rival | Drizzle. Wind 0 to 3. Shells that fall short splash and Soak | Timber 5 x 4, 4 Hobs (Stoker, Lobber, Scatterjack, Zinger). Aim 2 | +Skip (Bouncer). Water, Mud, Soaked. Fire against Water. Pump Hands | 1 Win. 2 Land 3 hits with no shot of yours in the water. 3 No Hob of yours Bonked | 4 |
| 3-2 | Burp Hollow | SS | M. A hollow of mud with three Burp Vents in a row across the middle. Low dykes at each end | Beat the Rival | Vents fire on even rounds. A shell over a live vent goes up 150 cells | Sump Pit, Cobble 5 x 5, 4 Hobs (Lobber, Bouncer, Stoker, Patcher). Aim 3 | Burp Vents. Timing a shot to a Hazard Beat | 1 Win. 2 Land a hit off a vent. 3 Your kettle above 50% | 5 |
| 3-3 | Ferry Cross | SS | M. A long pond. The Rival's barge fort drifts on it. Two reed islets give soft cover. You on the near bank | Beat the Rival | The barge drifts 60 cells left at each Round end for 2 rounds, then back for 2. Sir Pudge poles it, hired by mistake. The gap swings from 1,100 to 1,340 cells | Timber barge 5 x 5, 4 Hobs (Lobber, Scatterjack, Stoker, Zinger). Aim 3 | A target that moves on a beat. +Nurse Plumley (Patcher) | 1 Win. 2 Land 3 hits in a row on the barge. 3 No Hob of yours Bonked | 5 |
| 3-4 | Lily Pad Skip | PZ | P. A still pond with lily pads, a willow that hangs low, and a sunk boat | Ring 4 bells with 7 shots | Shells skip off water at low angles. Two bells need a skip first | None | Skipping shots. Breather | 1 Win. 2 Use 5 shots or fewer. 3 Skip 3 times in one shot | 4 |
| 3-5 | High Tide, Low Tide | SS | M. Rival on a dyke. You on a low island. A Clay hump between. Wide shallows | Beat the Rival | Tide rises 60 cells on rounds 4 to 6 and 10 to 12. A flooded Nook greys its Fire button | Twin Keeps, Cobble 5 x 5, 4 Hobs (Stoker, Lobber, Digger, Zinger). Aim 3 | Tide. Walking to dry ground as a real choice. +Ginger (Scatterjack) | 1 Win. 2 None of your Nooks ever floods. 3 Hit the Rival while one of its Nooks is flooded | 6 |
| 3-6 | Pump Number Nine | TD | M. See the example in section 7.3. Three brass pumps on stilts across a draining pond. Rival fort behind them on a dyke | Break 3 pumps in 10 rounds | Each standing pump drops the water 20 cells per round. As mud shows, the Rival walks closer. Sergeant Squeegee crosses on Round 5 and dumps a Mud mound; tip the bucket to send it the other way [04 §5.1] | Moat Fort, Cobble 5 x 5, 4 Hobs (Lobber, Scatterjack, Stoker, Patcher). Pumps are Brassbound 2 x 3. Aim 3 | Brassbound seen for the first time | 1 Win. 2 Done in 7 rounds. 3 Water never under half | 6 |
| 3-7 | Fog Lantern | RH | M. A stilt hut in a Fog Bank at mid-map holds the Cage. Marsh Gas vents under it. Rival beyond on a reed bank | Free Truffle | The preview stops at the fog line for both sides [04 §5.2]. Fire near gas hurts the captive. Cap 15 | Hedge Box on stilts, Timber 5 x 5, 4 Hobs (Stoker, Stoker, Lobber, Scatterjack). Aim 2 | Fog Bank. Marsh Gas. +Truffle (Digger). Lighter level | 1 Win. 2 Set off no Marsh Gas. 3 Free the captive by Round 8 | 5 |
| 3-8 | Stilt Town | SS | M. One dry knoll in the centre of a mud flat. The Rival's barge-fort beyond it. Sink Mud on the short ways round; a long firm ramp on each side | Beat the Rival | The knoll is the only hard cover. Flattening Notice: from Round 4 the knoll is pressed 16 cells lower each round; mound shells undo it [04 §5.2]. Mud costs x3 Steam [00 §2.14] | Moat Fort on a barge, Cobble 5 x 5, 4 Hobs (Stoker, Lobber, Bouncer, Patcher). Aim 3 | Sink Mud. Raising ground, a first taste of the Flats | 1 Win. 2 Never touch Sink Mud. 3 The knoll keeps half its height | 6 |
| 3-9 | The Leaky Line | SS | M. You on a Clay dyke with water held back behind you. A barge fort on open water to the right | Beat the Rival | Barges float, so Dig cannot drop them. If the Rival breaches your dyke your low Nooks flood | Cobble barge 5 x 6, 4 Hobs (Stoker, Lobber, Digger, Patcher). Aim 3 | No new rule. Guarding ground, not only walls. +Walt (Stoker) | 1 Win. 2 The dyke holds. 3 No Hob of yours Bonked | 7 |
| 3-10 | The Great Sump | GF | M. Open fen. The paddle barge on the right. Your pad is a low island with a higher Clay bank 200 cells behind it | Beat Admiral Sluice | Three phases [04 §4.4]: a Spray Curtain drags shells; the Water Line drops 48 cells, mud shows and the barge paddles 64 cells a turn with two Dredger Rafts; then the water rises 16 cells a turn toward your Nooks. Cap 18 | Grand Fort barge, Timber hull, Cobble pump rooms, 3 Pumps. Aim 3 | A boss that moves the water | 1 Win. 2 Break all 3 Pumps. 3 None of your Nooks floods | 7 |

### 3.6 Region 4: The Flats `[Launch]`

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 4-1 | Flat Out | SS | M. Pressed plate with a rolled trench in the middle. One Hoisted Hill hangs over the Rival's side. You on a small step | Beat the Rival | No wind. Cut the chain to drop the hill. The level's fixed pool holds one mound shell | Roller Box, Brassbound-faced Cobble 5 x 5, 4 Hobs (Zinger, Lobber, Scatterjack, Patcher). Aim 3 | Hoisted Hills. Mound shells as cover | 1 Win. 2 Drop the hill on the Rival. 3 No Hob of yours Bonked | 6 |
| 4-2 | Ethel's Lane | SS | M. Plate with two drains (pits). One lane runs the whole width | Beat the Rival | Big Ethel crosses every third round at 96 cells a turn [04 §5.1]. A fort it reaches takes a Thump. A mound stops it for a turn. Steering it into the Rival is fair | Roller Box, Brassbound 6 x 5, 5 Hobs (Lobber, Lobber, Digger, Zinger, Patcher). Aim 3 | Big Ethel. Building mounds to stop a machine. First Rival crew of 5 | 1 Win. 2 Stop Big Ethel twice. 3 Your fort never Thumps | 7 |
| 4-3 | Stamp Duty | TD | M. A row of four Stampers on a raised plate step. A trench in front. Ironmaster Bolt shouts from a gantry at the back; he takes no part | Break 4 Stampers in 10 rounds | Each Stamper slams its zone on its own beat. One that slams on a fresh mound jams for a round and shows its piston (Weak Spot). Sir Pudge sleeps in the far Outpost and never fires | 4 Stampers (Brassbound, 150 HP) and 2 Outposts (Zinger, Lobber). Aim 3 | Stampers | 1 Win. 2 Done in 8 rounds. 3 Jam 3 Stampers | 7 |
| 4-4 | Three on a Chain | PZ | P. Three Hoisted Hills in a row over three Outposts in a trench | Clear 3 Outposts with 3 shots | Fixed crew: Zinger, Zinger, Bouncer. Each hill swings when its neighbour drops, so order matters | 3 Outposts, no return fire | Planning a chain of drops. Breather | 1 Win. 2 Use 2 shots. 3 All three hills end in the trench | 6 |
| 4-5 | Full Bellows | SS | M. Three Bellows Towers behind the Rival. Plate steps at each end. A long shallow drain. Countess Glaze scores each shot from a tower top; she takes no part | Beat the Rival | Bellows Gale: wind 6 against you, minus 2 per tower broken. The Rival's Patcher mends one tower if you leave it | The Square, Brassbound 6 x 6, 5 Hobs (Lobber, Zinger, Scatterjack, Stoker, Patcher). Aim 4 | Bellows Towers. Wind you can break | 1 Win. 2 Break all 3 Bellows Towers. 3 Win before the Squall | 8 |
| 4-6 | The Square Gate | SS | M. A dead-level plate avenue, mirrored left and right. Your pad is a plate step 60 cells high; the gatehouse stands on a step 140 cells high. A square drain in the exact centre. One Hoisted Hill over each half | Beat Steward Plumb | The Plumb Line: from Round 5 a plumb bob swings over one of your Nooks for a full turn, then drops for Massive damage. Walk out from under it, or snap the line at the tower top. No phases; this is a duel | The Square as a mirrored gatehouse, Brassbound 6 x 6, 5 Hobs (Zinger, Zinger, Lobber, Scatterjack, Patcher). Aim 4 | A lieutenant as a plain Rival. The Plumb Line | 1 Win. 2 Never hit by the plumb bob. 3 Drop both hills | 8 |
| 4-7 | Washing Day | TD | M. Four cranes on a plate step, each with a Hoisted Hill on its chain. A trench below them. The Ironing Board hovers over mid-map | Bring the crane line under 25% in 9 rounds | A crane that breaks drops its hill, which stays as a real hill. The Ironing Board is a kettle-less platform with 3 Ruler Snipers [04 §5.1]; it shares one Action per turn | 4 cranes (Brassbound 2 x 4) and the Ironing Board. Aim 3 | The Ironing Board. Freeing hills as the goal | 1 Win. 2 Done in 7 rounds. 3 Land 2 hills in the trench | 7 |
| 4-8 | Evenhand's Mistake | RH | M. The Weights and Measures filing tower, a tall thin Timber and Brassbound stack on a plate step. The Cage is on floor 4. A drain in front | Free Pip | Clerk Evenhand, the jailer, tells you each round which enemy Hob fires next. Paperwork Day: no Walk for either side on Rounds 3, 6 and 9 [04 §5.2]. The tower sheds floors as it is hit, so the Cage can fall. Cap 15 | Beanpole (the filing tower) 4 x 9 with 2 Outpost rooms (Zinger, Lobber) and a guard fort 5 x 5 (4 Hobs). Aim 3 | An ally inside the target. +Pip (Lobber). Evenhand changes sides. Lighter level | 1 Win. 2 The Cage never falls. 3 Free Pip by Round 9 | 6 |
| 4-9 | The Last Lump | SS | M. You on the last real hill in the Flats, far left. A trench, then open plate. Two Hoisted Hills overhead. Sir Pudge holds a flag in the trench and gives up at once | Beat the Rival | At each new Weather Front one freed region sends a gift to a marked spot: a Tumblestone, then a Rockfall, then a Burp Vent. Each shows a round ahead and favours you (rule 4.5 item 5). Wind 0 to 4 from one Bellows Tower pair | The Square, Brassbound 6 x 6, 5 Hobs (Lobber, Lobber, Zinger, Digger, Patcher). Aim 4 | No new rule. Hazards as allies | 1 Win. 2 The Last Lump keeps over half its height. 3 No Hob of yours Bonked | 8 |
| 4-10 | The Last Level | GF | M, two maps in a row. See the example in section 7.2 | Beat the Baron twice | Two Stages [04 §4.6, rulings B12]: the Grand Roller, then the Level Engine. Hill Call is free every turn from the first Roller turn. A clan crate arrives before the last phase: Knacks refill and you pick 2 shells. Cap 12 per Stage. One Rummage of 12 with 5 picks each. Half your block damage mends between Stages. Retry is from the Stage on every preset | Stage 1: the Baron on the Grand Roller. Stage 2: the Baron's fort on the Level Engine. Aim 4 | Everything. Hill Call. The ending | 1 Win. 2 The Grand Roller never reaches its 300-cell mark. 3 Three hills stand above the water at the end | 9 |

### 3.7 Region 5: Nithering Heights `[U2]` and Region 6: Wheal Clank `[U3]`

These 20 levels are designed and held. They ship with their updates. Rows use the launch rules; anything that needs a later system (Frost, Zap, hidden crew, Mossbrick) is in step with the phase table [rulings A]. Hob joins for these levels follow 03's update list; section 6.4 gives the working plan.

**Region 5: Nithering Heights `[U2]`.** Types in use: Siege 5, Escort 2, Puzzle 1, Demolition 1, Grand Fort 1.

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 5-1 | Cold Snap | SS | M. Snow slopes down to a frozen tarn in the middle. Rival on the far slope, level with you | Beat the Rival | Snowfall. Wind 4 to 6. Rollers race across the ice | Cobble 5 x 5, 4 Hobs (Stoker with Frost, Lobber, Zinger, Bouncer). Aim 3 | Frost and Brittle. Ice | 1 Win. 2 Hit 3 Brittle targets. 3 Win by Round 12 | 6 |
| 5-2 | Whisker Wind | SS | M. Twin peaks with a deep notch between. Each fort sits on a shoulder below its peak | Beat the Rival | Wind 7 to 9 above the ridge line, 0 to 2 below it. Low shots must thread the notch | Cobble 5 x 6, 4 Hobs (Zinger, Lobber, Scatterjack, Patcher). Aim 3 | Strong wind. Wind shadow | 1 Win. 2 Land a hit through the notch. 3 No Hob of yours Bonked | 7 |
| 5-3 | Drift Road | ES | L. A mountain road along a ridge with three lee hollows. Two Outposts on the high side | Bring the Pedlar Fort to the hut | Round limit 15. A Snow Drift fills each hollow at every Weather Front. Clear them or the Pedlar stops | 2 Outposts (Lobber, Stoker) and a Skater fort 4 x 4 (3 Hobs) that trails you. Aim 3 | Snow Drifts. Ground that regrows. A Skater fort. Escort and Long maps | 1 Win. 2 Pedlar never stops for 2 rounds in a row. 3 Arrive by Round 11 | 7 |
| 5-4 | Icicle Alley | PZ | P. An ice cave open to the left. Three Outposts on the floor. Icicle Racks in the roof above and between them | Clear 3 Outposts with 3 shots | Fixed crew: Lobber, Bouncer, Zinger. One Plain Shot each | 3 Outposts, no return fire | Icicle Racks. Breather | 1 Win. 2 Use 2 shots. 3 Drop every icicle | 6 |
| 5-5 | Thin Ice | SS | M. A wide frozen lake. Both forts stand on the ice. Rock islets at each end are safe ground | Beat the Rival | Thin Ice breaks under Fire or Heavy blasts. A sunk fort is Soaked and stuck for 2 rounds. Thaw: at Round 6 all Ice turns to water [04 §5.2], shown on the card and counted down. Wind 5 to 7 | Cobble 5 x 5, 4 Hobs (Stoker, Lobber, Digger, Scatterjack). Aim 3 | Thin Ice. Thaw. Whether to walk to rock first | 1 Win. 2 Sink the Rival. 3 Your fort never sinks | 8 |
| 5-6 | Slippery Crown | SS | S. An ice dome in the centre, snow ramp on your side, frozen tarn on the Rival's side. Map as in Appendix B | Beat the Rival | A fort on an Ice slope slides 30 cells downhill at Round end. Wind 6 to 8. From the crown, flat lines open both ways. The Grumblenimbus hails on the tallest column each round [04 §5.1] | Skater fort 5 x 5, Brassbound frame with frost panels, 4 Hobs (Stoker, Bouncer, Lobber, Patcher). Aim 3 | Sliding forts. High ground that costs HP | 1 Win. 2 Make the Rival slide twice. 3 Your fort never slides | 8 |
| 5-7 | Sled Run | ES | L. One long downhill from right to left with two jumps and a covered snow shed half way | Bring the supply sled home | The sled gains speed: 80, 120, 160, 200 cells per round. In the air over a jump it cannot be hit. Round limit 8 | 3 Outposts on spurs above the run (Zinger, Lobber, Scatterjack). Aim 3 | Fast, short level. Lighter after 5-5 and 5-6 | 1 Win. 2 Sled above 60% HP. 3 Clear 2 Outposts | 7 |
| 5-8 | White Wall | TD | M. A Flattener plough-dam (Cobble, 8 x 6) holds back a snowfield above a village. An Avalanche Slope hangs over the dam | Bring the dam under 25% in 8 rounds | Trigger the Avalanche at the right time and it hits the dam for Massive damage. Too early and it only buries the Outposts | Dam with 2 Outposts on top (Lobber, Zinger). Aim 3 | Avalanche Slopes, before the Countess uses one on you | 1 Win. 2 Done in 6 rounds. 3 Hit the dam with the avalanche | 8 |
| 5-9 | Blizzard Watch | SS | M. You on a saddle between two peaks. The Rival climbs from the right on Moving Day: it Walks every turn [04 §5.2] | Beat the Rival | Blizzard. The Weather Front lasts 1 round; wind swings 7 to 10 each way. Forecast still shows | Skater fort, Cobble and Brassbound 6 x 6, 5 Hobs. Aim 3 | No new rule. Wind that changes every round, as it will at the Glidehall | 1 Win. 2 Land 5 hits at wind 8 or more. 3 Kettle above 50% at the end | 9 |
| 5-10 | The Glidehall | GF | M. A frozen lake. The palace on runners at the right. You on the near shore with a loaded snow slope behind you | Beat Countess Glaze | Three phases [04 §4.7]: two Bellows Towers set the wind each turn and the palace glides 32 to 64 cells with it; a Frost Shield re-forms over the kettle each turn; an avalanche slab comes down behind you. Cap 18 | Grand Fort, Brassbound frame with frost panels. A Glazer and an Icicle Zinger join in phase 2. Aim 3 | A boss that sets the wind and moves with it | 1 Win. 2 Break both Bellows Towers by Round 6. 3 No Hob of yours is buried | 9 |

**Region 6: Wheal Clank `[U3]`.** Types in use: Siege 4, Puzzle 2, Escort 1, Rescue 1, King of the Hill 1, Grand Fort 1.

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 6-1 | Mind Your Head | SS | M. One long cavern, roof 260 cells up. Two rock pillars. Stalactites over both forts | Beat the Rival | No wind. High lobs hit the roof. Stalactites drop when shaken | Brassbound-faced Cobble 5 x 5, 5 Hobs (Zinger, Zinger, Lobber, Digger, Patcher). Aim 3 | Ceilings. Stalactites | 1 Win. 2 Drop a Stalactite on the Rival. 3 Win by Round 12 | 7 |
| 6-2 | Lodestone Bend | SS | M. A cavern bent like a boomerang around a central rock mass. A Lodestone on the inside of the bend and one in the roof | Beat the Rival | Metal shells curve inside the marked rings. The Rival is out of direct line | Brassbound 5 x 5, 5 Hobs (Zinger, Lobber, Bouncer, Scatterjack, Lookout). Aim 3 | Lodestones. Curved shots | 1 Win. 2 Land 3 curved hits. 3 No Hob of yours Bonked | 8 |
| 6-3 | Cart Before the Hob | ES | L. Two rail lines through a cavern: a high open trestle and a low line under a rock shelf. Two Switch Levers | Bring the ore cart home | Hit a lever to send the cart low. The Rival shoots levers too. Round limit 12 | Brassbound 5 x 6 on a gallery, 5 Hobs (Lobber, Lobber, Zinger, Digger, Scatterjack). Aim 3 | Mine Carts. Switch Levers | 1 Win. 2 Cart above 50% HP. 3 Cart never rides the high trestle twice | 8 |
| 6-4 | Ricochet Shaft | PZ | P. A tall shaft with offset ledges, a hanging bucket and a Draught blowing up the middle | Ring 5 bells with 8 shots | Draught is wind 6, upward-left, inside the shaft only | None | Draughts. Breather | 1 Win. 2 Use 6 shots or fewer. 3 Ring 3 bells with one shot | 7 |
| 6-5 | Hot Seam | SS | M. A Rock bridge over a lava pit in the centre. Each fort on a ledge beside the lava. Clay floors that can be dug away | Beat the Rival | Shots that land in lava splash Fire. Dig the floor and a fort drops to a hot lower ledge: Thump and Burn on wood. The Mole Train surfaces under a fort every 2 turns and shifts the ground 16 cells [04 §5.1] | Cobble and Brassbound 6 x 5, 5 Hobs (Stoker, Digger, Lobber, Zinger, Patcher). Aim 4 | Lava. Fireproof forts as an answer [00 §2.8] | 1 Win. 2 Burn the Rival with a lava splash. 3 Your fort never Thumps | 9 |
| 6-6 | Canary Row | RH | M. A long gallery with three Cages on trestles. Green Gas Pockets around the first and third | Free 3 captives | One is Petra Mason; two are villagers. Fire in gas makes a Large Blast. Burn the gas off from a safe side first, or avoid Fire | Brassbound 5 x 5, 5 Hobs (Stoker, Stoker, Zinger, Lobber, Lookout). Aim 3 | Gas Pockets. Three targets in one rescue. +Petra (Digger) | 1 Win. 2 No captive takes damage. 3 Free all 3 by Round 10 | 8 |
| 6-7 | Brass Tacks | PZ | P. A side chamber. One all-Brassbound fort with its kettle buried four blocks deep. A water trough above it | Pop the kettle with 4 shots | Fixed crew and shells: one Zap shell, one Frost shell, two Plain Shots. Soaked Brassbound takes Zap x1.5 [audit C22] | 1 fort 5 x 5, no return fire | Zap chains [00 §2.8]. Breather | 1 Win. 2 Use 3 shots. 3 Chain Zap through 6 blocks | 8 |
| 6-8 | The Lift | KH | M. Two galleries, upper left and lower right, joined by a mine lift platform 160 cells wide in the centre | Hold the lift | The lift is the Hilltop. It moves between the galleries every 2 rounds; a bell rings a round ahead. A fort on it rides along | Brassbound 5 x 5, 5 Hobs (Digger, Bouncer, Lobber, Zinger, Patcher), 2 reserves. Aim 4 | A moving Hilltop | 1 Win. 2 Ride the lift 3 times. 3 Win by Round 12 | 9 |
| 6-9 | Backfill | SS | M. A cavern with three roof chutes. The Rival's fort hangs from the roof on the right | Beat the Rival | Each round one chute drops a 40-cell Loam mound (the spot shows a round ahead). The cave fills. Dig to keep your Loopholes clear; a buried Loophole greys its Fire button | Brassbound 6 x 6 with Mossbrick faces, hung from the roof, 5 Hobs. Aim 4 | No new rule. Shrinking space. A roof-hung fort. Mossbrick on a Rival | 1 Win. 2 No Loophole of yours buried at Round end. 3 Kettle above 50% at the end | 9 |
| 6-10 | The Stampmill | GF | M. A wide cavern. The mill fills the right third. Three Stampers hang over the floor between the forts. A rail line in front of the mill | Beat Ironmaster Bolt | Three phases [04 §4.8]: shutters close the Loopholes between shots; two Dynamos raise a Spark Dome over the kettle and ore carts roll in; then a Stamper slams a marked zone every 2 turns. Cap 18 | Grand Fort, wide Brassbound mill with 2 Dynamo Rooms. Ore Droppers arrive by cart. Aim 4 | Timing shots to open shutters. Stampers | 1 Win. 2 Jam all 3 Stampers. 3 No Hob of yours Bonked | 10 |

**Optional in U3: the Hilltop set.** Four held maps can ship as King of the Hill Skirmish maps when the type arrives: Crown of the Crag, Stilt Town, Slippery Crown and Everyone's Hill. They are the first cut if U3 runs late. They are not in the map count.

### 3.8 Level type count

| Type | Launch | U2 | U3 | Total | Launch levels |
|---|---|---|---|---|---|
| Siege | 25 | 5 | 4 | 34 | 1-1 to 1-6, 1-8, 1-9, 2-1, 2-2, 2-4, 2-6, 2-7, 2-9, 3-1 to 3-3, 3-5, 3-8, 3-9, 4-1, 4-2, 4-5, 4-6, 4-9 |
| Demolition | 4 | 1 | 0 | 5 | 2-5, 3-6, 4-3, 4-7 |
| Rescue | 4 | 0 | 1 | 5 | 1-7, 2-8, 3-7, 4-8 |
| Puzzle | 3 | 1 | 2 | 6 | 2-3, 3-4, 4-4 |
| Grand Fort | 4 | 1 | 1 | 6 | 1-10, 2-10, 3-10, 4-10 |
| Escort | 0 | 2 | 1 | 3 | |
| King of the Hill | 0 | 0 | 1 | 1 | |
| **Total** | **40** | **10** | **10** | **60** | Pennants: 120 at launch, 180 in all, plus Trials (section 5.1) |

At launch 25 of 40 levels are the plain duel. The review asked for at least 22 [02 review §6 item 11]. Every duel has its own map and its own stated Rival habit. No other type runs twice in a row.

### 3.9 Rule for every pre-battle card

The card shows: level name, type icon, a thumbnail of the map with both forts, the objective in one line, the special rule in one line, the three Pennant goals, the Rival's name, Aim rating and **habit**, the enemy Class icons, and the reward [00 §4.2, §5.4]. Nothing about a level is hidden. The UX doc folds this card, the crew, the Blueprint, the draft strip and the Doodads into one pre-battle screen [07 §4.5, rulings B15].

### 3.10 Rivals and habits by level

Each Rival states one habit on its card, in plain words [rulings B17]. A habit is true: the AI weights its picks to match it [04 §6.6]. It gives the player something to build or plan against. Names in *italics* are proposals. Every Rival is named AI and says so on its card [00 §3]. Sir Pudge appears once per region in a smaller job each time.

**Region 1, Parks and Verges.**

| Level | Rival (main personality) | Habit on the card | What the player can do about it |
|---|---|---|---|
| 1-1 | Sir Pudge (Builder, naps) | "Shoots wide first. Then a bit closer." | Learn that the AI finds its range like you do |
| 1-2 | *Private Tuft* (Tidy) | "Shoots your top Hob first." | Pick who sits on top once you can |
| 1-3 | Lance Corporal Fernsby (Builder) | "Hides his crew deep. Leaves the kettle near the wall." | Go for the kettle |
| 1-4 | *Corporal Dibber* (Tidy) | "Forgets the wind on his first shot of each front." | Use the free turn |
| 1-5 | *Sergeant Posy Rake* (Bully) | "Goes for your hurt Hob." | Spread the shooting; keep a hurt Hob resting |
| 1-6 | *Warden Snedd*, keeper of the Stamp Tower | "Aims at roofs." | Put the 3 Cobble blocks over a Nook or over the Kettle Room |
| 1-7 | Corporal Fernsby (acting), promoted for caging Hetty (Sniper) | Rescue; no habit line | |
| 1-8 | Sergeant Rake again | "Grabs the biggest shell in the Rummage. Fires it fast." | Take it first, or leave it and plan for it |
| 1-9 | Lance Corporal Dibber again | "Slow to find his range. Starts over when you move." | Walk when his shots get close |
| 1-10 | Marshal Trimm | Grand Fort; phases are on the card | |

**Region 2, Steps and Slopes.**

| Level | Rival (main personality) | Habit on the card | What the player can do about it |
|---|---|---|---|
| 2-1 | Flintwick the Lesser (Sniper) | "Only shoots what he can see in a straight line." | Keep the crew behind stone on his side |
| 2-2 | *Mason Cobbina Slate* (Sapper) | "Digs at the ledge under you." | Walk back from the edge, or drop her first |
| 2-4 | *Foreman Gritty Tallus* (Sapper) | "Tunnels first. Shoots second." | Guard the Nook that faces the Clay seam |
| 2-5 | Flintwick the Lesser and Sir Pudge in the Outposts | Demolition; no habit line | |
| 2-6 | *Prentice Chip Dustable* (Gambler) | "Loves a bounce shot, even a bad one." | Let the goats send them back |
| 2-7 | *Sister Emery Buff* (Tidy) | "Shoots your tallest column." | Build wide and low for this one |
| 2-8 | Mason Slate again (Sniper) | Rescue; no habit line | |
| 2-9 | *Flintwick the Greater* (Gambler) | "Opens with her biggest shell." | Shield or Walk on turn one |
| 2-10 | Dame Scree | Grand Fort | |

**Region 3, the Drainage Board.**

| Level | Rival (main personality) | Habit on the card | What the player can do about it |
|---|---|---|---|
| 3-1 | Bosun Gurgle (Builder) | "Mends a cracked wall before she shoots." | Crack two walls at once |
| 3-2 | *Mate Sluice Wetherby* (Gambler) | "Times every shot to the vents." | Count the beat; his odd rounds are quiet |
| 3-3 | *Purser Dribble Mackle* (Bully) | "Aims at your lowest Nook." | Put your toughest Hob low, or leave it empty |
| 3-5 | *Lieutenant Bogart Squelch* (Sapper) | "Waits for high tide, then shoots low." | Walk to dry ground before Round 4 |
| 3-6 | *Chief Engineer Valva Stopcock* (Builder) | Demolition; no habit line | |
| 3-7 | *Midshipman Tad Polliwog* (Coward) | Rescue; no habit line | |
| 3-8 | Bosun Gurgle again (Tidy) | "Flattens any mound you raise." | Raise two; she can only flatten one a turn |
| 3-9 | Midshipman Polliwog again | "Paddles back when his kettle is hit." | Hit the kettle to buy the dyke a turn |
| 3-10 | Admiral Sluice | Grand Fort | |

**Region 4, Weights and Measures.**

| Level | Rival (main personality) | Habit on the card | What the player can do about it |
|---|---|---|---|
| 4-1 | Clerk Tally Evenhand (Tidy; he says sorry for every hit) | "Aims at whatever stands tallest." | Drop the hill so it is taller than you |
| 4-2 | *Captain Rule Straightly* (Bully) | "Fires flat and level. Never lobs." | A mound in front of you is a wall |
| 4-3 | *Inspector Flush Margin* in the Outposts; Sir Pudge asleep | Demolition; no habit line | |
| 4-5 | *Auditor Columna Ledger* (Sniper) | "Picks one Hob and shoots it till it is Bonked." | Give that Hob stone, or a Patcher next door |
| 4-6 | Steward Prudence Plumb (Sniper) | "Mirrors you. Aims at the Nook you last fired from." | Take turns between Hobs; never fire twice from one Nook |
| 4-7 | Inspector Margin on the Ironing Board | Demolition; no habit line | |
| 4-8 | *Sergeant Trueline Squareham* (Tidy) in the guard fort | Rescue; no habit line | |
| 4-9 | Captain Straightly again | "Shoots the hill under you before he shoots you." | Mend the hill, or make him pay for the turns |
| 4-10 | Baron Levelwell | Grand Fort | |

**Regions 5 and 6** `[U2]` `[U3]`. Rival names stand as before: Miss Twirl, *Sir Axel Toeloop*, *Warden Hoar Blusterby*, *Madame Frappe Chillingham*, *Judge Sniffin Sixpoint* and Countess Glaze in the Heights; Shift Boss Ratchet, *Gaffer Cog Mangleworth*, *Fitter Nell Gasket*, *Smelter Blaise Cinderby*, *Overseer Tappet Grimes* and Ironmaster Bolt in the Mines. Each gets a habit line when its update is built.

### 3.11 Castle archetypes, mini-bosses and events by level

Doc 04 defines the castle archetypes [04 §3], the mini-bosses [04 §5.1] and the events [04 §5.2]. This table places the launch ones. Archetype names follow doc 04. The Square is its Region 4 archetype; the Moon Square, with Mossbrick faces, is the U3 form.

| Level | Archetype | Mini-boss or event |
|---|---|---|
| 1-1 to 1-5, 1-7, 1-8 | Hedge Box | |
| 1-6 | Beanpole (the Stamp Tower) | |
| 1-9 | Pancake on a hill | |
| 1-10 | Grand Fort | Little Ethel (boss phase 2) |
| 2-1, 2-2, 2-6, 2-9 | Ledge Perch | |
| 2-4 | Onion | Tidy Balloon |
| 2-7 | Onion | Rockslide Rex |
| 2-8 | Bait Box | |
| 3-1, 3-6 | Moat Fort | 3-6: Sergeant Squeegee |
| 3-2 | Sump Pit | |
| 3-3, 3-9 | Moat Fort on a barge | |
| 3-5 | Twin Keeps | |
| 3-7 | Hedge Box on stilts | Fog Bank |
| 3-8 | Moat Fort on a barge | Flattening Notice |
| 4-1, 4-2 | Roller Box | 4-2: Big Ethel |
| 4-5, 4-6, 4-9 | The Square | 4-6: the Plumb Line |
| 4-7 | Outposts on cranes | The Ironing Board |
| 4-8 | Beanpole (the filing tower) | Paperwork Day |

Held for updates: Glass Spire, Skater, the Grumblenimbus, Thaw, Moving Day and Gale `[U2]`; Turtle, Brass Net, Overhang Den, the Mole Train and Moon Square in Mossbrick `[U3]`. **Tea Break** is used only as a Daily modifier. **Night Shift** is parked (Appendix A).

---

## 4. Map design rules

### 4.1 No flat maps

1. **Lump Rule (fixed in core).** Every map has at least two of: a hill or ridge between the forts, a height gap of 80 cells or more between fort bases, water or a pit, a cave or overhang, a cliff [00 §2.6]. Section 7 shows the check filled in for three levels. Every level file carries the same check as data, and the build fails if a map has fewer than two.
2. **Lump Rule plus.** From region 2 on, every map has at least three of the five.
3. **No level line.** No stretch of walkable surface longer than 320 cells may be level to within 8 cells, except Ice lakes, water and the Pressed Plate of the Flats. Those have their own hazards.
4. **The Flats obey too.** Region 4 gets height from Hoisted Hills, plate steps, trenches and towers.
5. **Ground has layers.** Each map uses at least two ground materials [00 §2.1], drawn so the player can tell them apart at a glance. Clay bands show where Dig works. Rock shows where it does not.

### 4.2 Height and cover

- **Fort heights differ.** In at least 70% of duel maps the two fort bases differ by 40 cells or more. The player has the low ground in about half of them. Low ground is harder, so those levels give the player a second edge: a wind shadow, a Rock cap, or first use of a hazard.
- **Three kinds of cover on every duel map.** One piece of hard cover (Rock: stops flat shots for good), one piece of soft cover (Loam or snow: can be carved away or built up), and one piece of open ground where a fort is in the open. Walking between them must cost Steam worth thinking about: 15 to 40 [00 §2.14].
- **Cover is never total.** No spot on any map hides a whole fort from every arc. The fairness check in 4.5 proves it.
- **Forts stand on a pad.** Each start spot has a level pad at least 160 cells wide, so an 8-block fort stands flat without help [00 §2.7].
- **Thump spots are marked.** Any start spot or Hilltop where carving can cause a Thump has visible cracks or a ledge edge [00 §2.7].

### 4.3 Sightlines

Each duel map is checked against three lines from each side:

| Line | Meaning | Rule |
|---|---|---|
| **Flat line** | Angle under 20 degrees, for Zingers and beams | Blocked at the start on at least 60% of maps. Opens by Walk, by carving, or by breaking cover |
| **Lob line** | 35 to 60 degrees, for Lobbers | Open on all maps except under ceilings. In the Mines the roof cuts lobs over 55 degrees |
| **Steep line** | Over 70 degrees, for drop shots | Open unless an overhang or roof says no. Overhangs are always drawn with a dark under-edge |

Rules:

1. Every Class has at least one useful line on every map where the player can bring it. If a map shuts a Class out (Zingers behind a wall in 2-4), the pre-battle card warns with a Class icon and a cross.
2. The Heartkettle glow shows through all terrain [00 §2.10]. The path to it may be hard. It is never unknown.
3. The HUD top strip is under 10% of screen height [07 §2.3]. Maps keep the top 15% of the screen free of targets and hazard markers at auto-frame zoom, as a safety margin [audit C69].
4. Tall terrain between the forts never forces auto-frame zoom under 0.6 [00 §2.6]. See 4.8 for the numbers.
5. A shot may leave the top of the screen. The camera follows it and a small edge arrow shows where it is.

### 4.4 How terrain blocks the "bore the base" plan

The plan: aim low at the foot of the enemy fort, grind out the bottom row and drop the lot [02b §15, 02d §1.6.3]. The core doc already blunts it with Footing, the support rule and Thump limits [00 §3]. Maps add six more blocks:

| # | Tool | How it works | Used in (launch) |
|---|---|---|---|
| 1 | **Plinths** | The Rival's pad sits on Rock or Bedrock in at least half of duel maps. Nothing digs under it | All regions |
| 2 | **Height gaps** | A fort above you shows you its Footing and little else. A flat shot at its base hits the hillside. A fort below you is easier to drop shots into than to undercut | 1-3, 1-6, 2-1, 2-4, 3-5 |
| 3 | **Lips and berms** | A low rise 24 to 48 cells high in front of a pad eats flat shots and stops rollers. It can be carved, but that costs turns | 1-8, 3-2, 4-1 |
| 4 | **Pits that help the one who falls** | A fort dropped into a pit gains cover from flat shots [00 §2.7]. So digging a foe down is a trade, not a win | 2-2, 2-7 |
| 5 | **Water and barges** | Barge forts float. There is no ground to bore. Shells drag in water | 3-3, 3-8, 3-9, 3-10 |
| 6 | **Forts that move** | Drifting barges, a Rival that steps down a road, bosses that roll | 2-9, 3-3, 4-10 |

The new collapse rule pulls the other way on purpose. Stone now needs side support from 1 block, not 2, so tall stone forts are top heavy and a good low hit on a late fort should drop about a third of it [rulings B2]. Maps do not try to stop that. They stop only the dull version: the same low shot at the same spot every turn.

**The Plan Variety check.** Nightly bots [04 §14] run each duel level with three one-plan bots: Base Borer (only low shots at the foot), Kettle Rusher (only at the glow) and Crew Sniper (only at Nooks). A level fails if any one-plan bot wins more than 15 points above the mixed-plan bot, or if the mixed bot's shots are more than 60% of one kind.

### 4.5 Fairness checks

Every level passes all of these before it ships. Items 1 to 8, 15 and 16 are automated.

1. **Reach.** From its start pad, each side has a firing answer to every enemy Nook and to the kettle's nearest wall, at power 90 or less, at both ends of the level's wind range.
2. **No first-turn win.** No single shot from the start state can win, or remove more than 35% of a side's total HP, outside Puzzle levels.
3. **No start-state hazard hit.** No hazard can hit either fort in round 1.
4. **Hazard Beat is honest.** Each hazard shows its next action one full round ahead with an icon at the spot (4.6). Hazards never roll dice.
5. **Hazards do not pick sides.** Over a full cap, a hazard threatens the player's start pad no more often than the Rival's. Where a map breaks this for story reasons (4-9), it favours the player.
6. **Win-rate bands.** Targets are the enemies doc's [04 §7.2]; section 6.2 gives the working numbers for the new region order. A level's Diff rating says where in its band it sits: breathers at the top, peaks at the bottom. Bots get only the Tinker progress that first clears give [00 §3 "Grind"].
7. **Length.** Median battle ends by round 12 and inside 7 minutes at about 32 s a round [00 §2.12, §9.6]. Under 15% of battles reach the Squall round [02 review §5.3]. Each Stage of 4-10 counts as its own battle and stays under 8 minutes.
8. **Determinism.** The same seed and commands give the same result on all platforms [00 §2.7]. Each level ships with three golden replays.
9. **Pennants in one run.** A designer must record one run that earns all three Pennants on Fair with the crew a player will have by then.
10. **Walk is real.** On every duel map, at least one Walk of 40 Steam or less changes which lines are open.
11. **Read at a glance.** A tester who has not seen the map can point to every hazard and both kettles within 5 seconds at auto-frame zoom on a 6.1 inch phone.
12. **Colour-blind pass.** Hazards, ground types and zones differ by shape or pattern as well as hue [00 §8.2].
13. **No dead ends.** No reachable spot traps a fort for the rest of the battle. Sink Mud and Thin Ice hold a fort for 2 rounds at most before it can leave.
14. **Loss is not a wall.** After 2 losses on a level the result card offers a hint and the assist toggles [04 §6.12, 07]. This doc adds one thing to that card: a Test Yard copy of the map. The loss screen also plays the "what broke you" replay [07 §4.6]. The game never changes the Rival behind the player's back.
15. **No line, per Hob** [review 06 G10, 00 §4.2]. A build-time bot sweep fires each launch Hob's Plain Shot from the player's start pad and from every spot a 40 Steam Walk reaches, at power 100, across the level's wind range. A Hob with no shot that reaches any enemy Nook or the kettle's nearest wall gets the "No line" mark on the pre-battle screen. Skippers and rollers with no surface their Knack can use get the "rough ground" mark. The sweep reruns on every map change.
16. **No dead Class.** No campaign duel map may give "No line" to every launch Hob of one Class, outside Puzzle levels. A map that fails gets a lower ridge, a notch or a Walk spot. Zinger and Bouncer lines are checked first, since hills shut them most.

### 4.6 The Hazard Beat

- Hazards act at Round start, before the first Turn, in a fixed order by map position from left to right.
- Each hazard has a period in rounds and an offset, both in the level data. Example: Burp Vents in 3-2 have period 2, offset 0.
- A hazard that will act next round shows a pulsing icon and a countdown pip. The HUD has a small Hazard strip with the same icons, so nothing depends on the camera.
- Hazards that react to hits (Tumblestones, Rockfall Shelves, Hoisted Hills, and later Icicle Racks and Gas Pockets) do not use the beat. They show what they will do with a dotted path when a preview crosses them.
- Hazards hurt both sides the same. The AI knows hazards exactly as the player does [00 §3].
- At most 3 hazard kinds per map, and at most 2 that act on the beat.

### 4.7 Weather tags

| Tag | Effect | Regions | Phase |
|---|---|---|---|
| Clear | Wind 0 | 1, 2 | Launch |
| Breeze | Wind 1 to 5 | 1, 2, 3 | Launch |
| Drizzle | Breeze plus: Burn lasts 1 turn; bare Loam turns to Mud after 2 Weather Fronts | 3 | Launch |
| Fog Bank | A marked zone, not the whole map. The preview stops at the fog line for both sides. AI error into fog is x1.3 [04 §5.2] | 3 (3-7) | Launch |
| Bellows Gale | Wind set by standing Bellows Towers, 2 per tower, 6 at most | 4 | Launch |
| Snowfall | Wind 4 to 6. Snow Drifts grow | 5 | U2 |
| Blizzard | Wind 7 to 10 (the Gale event [04 §5.2]). Level may set a 1-round Weather Front | 5 | U2 |
| Draught | Wind inside a marked shaft only | 6 | U3 |

The forecast icon shows the next Weather Front on every level, for free. It is not a Tinker node [rulings B13]. Cosy may turn wind off, and then Bellows Gale and Draught are off too.

### 4.8 Map sizes for the phone view

The logical screen is 960 x 540 and the auto-frame floor is zoom 0.6 [00 §2.1, §10.3]. At zoom 0.6 the screen shows 1600 x 900 cells. So:

| Class | Size (cells) | Whole map fits at | Fort centre gap | Used for | Launch campaign maps |
|---|---|---|---|---|---|
| **P** Pocket | 1200 x 720 | zoom 0.75 | 500 to 800 | Puzzle | 3 |
| **S** Small | 1600 x 720 | zoom 0.6 | 900 to 1300 | Teaching duels | 3 |
| **M** Standard | 2400 x 720 | never whole; both forts fit at 0.6 | 1000 to 1400 | All other levels | 35 |
| **L** Long | 3200 x 720 | never whole; camera travels | up to 1800 | Escort only | 0 at launch; 2 in U2, 1 in U3 |

Rules:

1. **Both forts in one frame. Duel gap is 1400 at most (fixed by rulings C4).** In every duel, a box around both forts plus a 100-cell margin is at most 1600 cells wide. A player can always see their fort and the target at once without panning. A Rival that moves (3-3, 2-9) stays inside the same limit at every step.
2. **Pocket and Small maps may go under 1000** for Puzzle levels and teaching duels only [audit C68].
3. **Height fits.** All maps are 720 cells high. At zoom 0.6 the view is 900 high, so full height always fits. The top 100 cells of every map are sky only, to leave room for arcs.
4. **Peak cap.** Terrain between the forts rises at most 420 cells above the lower fort's pad. With Loam hills the cap is 300, since blasts can cut a gap.
5. **Things stay big enough.** At zoom 0.6 one Block is 9.6 logical pixels. That is small. So the auto-frame holds zoom 0.75 or more whenever the fort gap allows (gap of 1150 or less), and zooms in to 1.0 on the active fort during Plan [00 §2.2]. Targets that matter (bells, cages, chains, cranes) are at least 32 cells across and get an outline at low zoom.
6. **Long maps** `[U2]`. On L maps the level goal moves (a cart, the Pedlar Fort), and the camera frames the player's fort and the moving thing. The far Rival may be off screen at Turn start; an edge arrow with its portrait points to it. L maps never host a plain duel.
7. **Thumb zones.** Nothing the player must tap in battle sits in the lower right 20% of the screen, where the Fire button lives [00 §2.3], at auto-frame zoom. Start pads keep the player's fort in the left 40% of the frame.
8. **Tablet and desktop** show more sky and ground, never more information. The same frame box is used.

### 4.9 Level data

Each level is one data file [04 §9]: size class, ground bitmap or heightline plus material layers, start pads, objects (hazards, cages, bells, Outposts), Hazard Beats, wind range and weather tag, round cap, Rival blueprint, crew and habit, Rummage pool or pool lock, Pennant goals, Lump Rule check, bot bands. Maps are hand made. No campaign map is random.

### 4.10 Map count

Every map is hand made, so the count is the level designer's workload. One named content owner holds these numbers [rulings D10].

| Set | Launch | U1 | U2 | U3 | Total |
|---|---|---|---|---|---|
| Campaign maps | 41 (40 levels; 4-10 has 2) | | 10 | 10 | 61 |
| Trial maps | 6 | 2 | 1 | 1 | 10 |
| Shared maps (Skirmish and Daily) | 12 | | | | 12 |
| Long Siege maps | | 12 | | | 12 |
| **Total** | **59** | **14** | **11** | **11** | **95** |

- The old plan had 136 maps: 60 campaign levels with 62 maps, 10 Trials, 40 Dust-up maps and 24 Siege maps. The 40 Dust-up maps are cut for good. Siege maps drop from 24 to 12.
- Launch campaign maps by size: 3 Pocket, 3 Small, 35 Standard.
- At one finished map every two working days, 59 maps is about 24 weeks of level design, which fits one level designer from week 6 with a second in alpha [rulings C6].
- **If the schedule slips:** cut shared maps from 12 to 8, then Trials from 6 to 4. If the team is more than three weeks behind at the week 30 gate, cut the Fen to a post-launch update and ship three regions; the Flats then becomes Region 3 [02 review §5.3]. Never cut a level inside a region to save time.

---

## 5. Side modes

Unlock order follows the core doc [00 §6]. No mode sells or gives battle power that the campaign does not [00 §3 "Pay-to-win"]. Rewards are Buttons, cosmetics, Keepsakes and badges. All modes work offline. Where the weapons doc pays a shell or a Doodad from a mode, that reward shows on the mode's card; the weapons doc is the source [audit C36].

| Mode | Phase | Unlock | One line | Main reward |
|---|---|---|---|---|
| Trials | Launch (6), U1 +2, U2 +1, U3 +1 | Side paths from Region 1 | Hand-made puzzles | 3 Pennants each |
| Test Yard | Launch | With the Workshop, before 1-6 | Free fire at dummies or at your own fort; Rehearse a raid | A tool |
| Skirmish | Launch | After 1-5 [00 §6] | One battle with your rules | Buttons on replay rates; the Musical Chairs Doodad for beating 5 different Rivals [01 §5] |
| Daily Dust-up | Launch | After 1-10 | A seeded Skirmish, the same for everyone that day | 60 Buttons a day, stamps |
| Couch Duel | Launch | Main menu, from the first launch | Two players on one device, taking turns, no AI | None: a local head-to-head tally and Brag Clips |
| Long Siege | U1 | After 3-10 | Endless waves, damage carries | Keepsakes, Outfits |
| Ironclad | U2 | After each region | Hard replay with a twist | Iron Pennants |
| Baron Rush | U3 | After 6-10 | All Grand Forts, no repairs | Medals, decor, Homecoming Hat and Where Was I? [01] |

The core doc owns these unlock points [00 §6]. None lands in the first 10 minutes [rulings B14].

### 5.1 Trials

- **What.** Hand-made puzzle levels on side paths of the Brickabrac Map. Six at launch: two each in Regions 1 and 2, one each in Regions 3 and 4. Side paths branch after: T1 1-8, T2 1-9, T3 2-6, T4 2-8, T5 3-5, T6 4-4; U1 adds T7 after 1-10 and T8 after 4-8; T9 after 5-8; T10 after 6-5. Each sits after the level that teaches what it uses.
- **Rules.** Fixed crew, fixed pool, fixed shots. No Rival turns. Free retry in under 1 second. Take Back is on for all presets. After 5 fails, a hint offers the first 30% of one answer's arc.
- **Pennants.** 3 each: 1 solve it, 2 solve it at par, 3 the sly goal. That is 18 at launch and 30 in all [00 §5.2].

| # | Name | Region | Phase | Puzzle | Sly goal |
|---|---|---|---|---|---|
| T1 | One Good Push | 1 | Launch | One Lobber shot. Topple a straw tower with a Tumblestone. This is where collapse is first shown on purpose | The stone must also ring the bell in the stream |
| T2 | Hedge Hop | 1 | Launch | Three bells in a walled orchard, six Bouncer shots. Bells 1 and 3 must ring after a bounce. Bobbin is on loan if not yet owned | Ring 2 bells with one shot |
| T3 | Goat Gap | 2 | Launch | Two bounces through a rock notch to a far ledge | No goat butts the shell |
| T4 | Card Tower | 2 | Launch | One Zinger beam. Drop a 4 x 9 Timber tower | The top block lands in the gorge |
| T5 | Full Kettle | 3 | Launch | Use the Tide: one shot must land in the 1 round when the kettle is above water | Do it with a skip |
| T6 | Laundry Day | 4 | Launch | Four Hoisted Hills, two shots. Rebuild a ridge to match the outline | The ridge must stop Big Ethel |
| T7 | Three Hats | 1 | U1 | Three shots, three Flattener dummies behind three hedges | Use two shots |
| T8 | Hat Trick | 4 | U1 | One roller must cross a drain, a plate step and a ramp to bonk three dummies | Do it before Big Ethel crosses |
| T9 | Snowball | 5 | U2 | Start an Avalanche that buries three Outposts | Bury none of the two village huts |
| T10 | Pull | 6 | U3 | Bend one metal shell round two Lodestones into a kettle | Drop a Stalactite on the way |

- **Rewards.** 100 Buttons per first solve [audit C60]. A Keepsake for all ten: the Puzzle Box. Nan joins on the path past T3; if the player skips it she joins on clearing 2-10.
- **Moved or held.** Old T2 is now T7 and old T10 is now T6. Old T6 Fog Horn needed a Lookout and old T8 Hat Trick on Ice needed ice; both are in Appendix A.

### 5.2 Test Yard `[Launch]`

Owned by the core doc [00 §6]. From this doc it gets every cleared map, with hazards on a manual beat button.

**Rehearse a raid.** Raid Rehearsal is no longer a mode. It is one button in the Test Yard [rulings B16].

- Pick a Blueprint, a Rival you have beaten and a map you have cleared.
- The Rival attacks at Fair. Your side is run by the Drill Sergeant, an AI at Fair. Speed x1, x2 or x4. Stop any time. You may take over and defend it yourself.
- At the end the game plays the same "what broke you" replay as a loss does [07 §4.6]: the shot that did the most harm, in slow motion, over your Blueprint, with one line of plain words.
- One tap goes back to the Workshop with the first blocks to fall marked. One tap reruns the same seed, so a change can be judged like for like.
- It pays 50 Buttons the first time and nothing after. It is a tool.

### 5.3 Skirmish and the 12 shared maps `[Launch]`

Skirmish is owned by the core doc [00 §6]. The player sets Rival, map, preset, weather tag, hazards on or off, round cap and wind range. Maps on offer: every cleared campaign duel map, plus 12 shared maps that open three at a time as each region is cleared.

The shared maps are plain duel maps with strong shapes and few hazards, built for replay. They also serve the Daily Dust-up. All are Standard size and pass the checks in section 4.

| Id | Name | Region look | Shape, left to right |
|---|---|---|---|
| D1 | Two Lumps | Downs | Two equal round hills, a stream between. The fair, even map |
| D2 | Orchard Dip | Downs | You high, Rival in a dell behind a hedge row. Three Molehill spots |
| D3 | Long Meadow | Downs | A wide shallow saddle with one Tumblestone at each end |
| C1 | Stack of Books | Crag | Stepped ledges, each fort two steps up, a gorge in the middle |
| C2 | Split Crag | Crag | A Rock fin with a Clay seam at its base between the forts |
| C3 | Goat Balcony | Crag | You under an overhang, Rival on a spur. Two goats. One Updraft Vent |
| F1 | Reed Maze | Fen | Three low islands, two ponds, a dyke on the Rival's side |
| F2 | Burp Row | Fen | Four Burp Vents across a mud flat, forts on dykes |
| F3 | Low Water | Fen | A tide map: wide shallows, one dry hump mid-field |
| L1 | Drain Board | Flats | Plate with three drains and a plate step under each fort |
| L2 | Two Hills Hanging | Flats | Two Hoisted Hills over mid-field, a trench under them |
| L3 | Rivet Row | Flats | One Bellows Tower behind each fort, a long berm between |

In updates the Skirmish list grows with the new region's duel maps. No more shared maps are planned.

### 5.4 Daily Dust-up `[Launch]`

An offline daily battle, the same for everyone on the same date [00 §4.5]. No server, no account. It is a seeded Skirmish. It has no maps of its own [rulings B18].

**How the seed works.**

1. Seed = a 32-bit hash of the text `CP-DAILY|YYYY-MM-DD|table version`. The date is the device's local calendar date.
2. The seed drives the sim's own seeded RNG [00 §7.1]. It picks, from fixed tables in the app: one map from the 12 shared maps and the campaign duel maps, one Rival blueprint, crew and habit, the wind script, one modifier and the Rummage pool.
3. The tables are versioned and only ever added to. A given date under a given table version always makes the same battle. Updates add a new table version from a set date forward, so old dates do not change.
4. Every map in the table has already passed the checks in section 4. The seed only picks and combines.

**Rules.**

- **Loan fort and crew.** Each daily gives a set loan Blueprint and a loan crew of 4 or 5 Hobs from the launch 16, all at the same rank. So the result depends on aim and plan, not on unlocks. Tinker Tree nodes do not apply.
- **Modifiers** (one per day, eight at launch): Gale (wind +2), No Knacks, Double Rummage, Wicker Only, One Hob Each, Mirror Map, Tea Break and Flattening Notice [04 §5.2]. Updates may add more.
- **Result.** Score [00 §2.11]. Bands shown before the battle: Tin, Brass, Gold. Band lines come from bot runs on that map and modifier.
- **Tries.** Unlimited. The game keeps the best result and, apart from it, the **First Try** result with a small ribbon.
- **Difficulty.** Fixed at Fair for the band. Cosy and Stubborn are playable but show under their own label.
- **Calendar.** A 30-day stamp card. The last 30 dates stay playable [00 §4.5]. Dates ahead are locked. A missed day costs nothing; there is no streak to break [00 §2.16].
- **Clock changes.** We do not police the device clock. Results are local and there is nothing to cheat.
- **Sharing.** The result card can copy a short text line (date, score, band, First Try ribbon). Nothing is sent by the app.

**Rewards.** 60 Buttons for the first Daily clear each calendar day, whatever date is played [audit C62]. Stamp cards: 7 stamps gives an Outfit piece, 30 stamps a fort flag.

### 5.5 Long Siege `[U1]`

Endless waves [00 §4.5]. Unlocks after Region 3. This is the only home of the Waves rule.

**Run rules.**

1. Pick a Blueprint, a crew and two Doodads. That is the run's fort.
2. Each wave is one battle against one Rival fort on one of 12 Siege maps, picked by the run seed. Round cap 12.
3. **Damage carries.** Block HP, lost blocks, Hob HP and your Heartkettle HP stay as they are between waves.
4. **Bonked Hobs** sit out the next wave, then come back at 50% HP. If all your Hobs are Bonked at once, the run ends.
5. **Knacks** refill each wave. Trick Shells come from a 6-shell Rummage each wave, 2 picks each.
6. **Scrap** is the run-only currency: 10 per wave won. Spend it between waves: mend a block (1 to 8 by material), heal a Hob 20 HP (5), mend the kettle 30 HP (10), +30 Steam next wave (4).
7. **Odds and Ends.** After each wave pick 1 of 3 boons, for this run only.
8. **Big Waves.** Every fifth wave adds a mini-boss [04 §5.1]; every tenth is a Grand Fort on a Siege map. Beat a Big Wave for a free mend of 10 blocks.
9. **Ramp.** Rival Aim, fort size and materials step up every 3 waves. From wave 10, each wave adds one Daily modifier. From wave 20, two.
10. **End.** The run ends when your fort falls.
11. **Save.** The run autosaves at every Turn [00 §3]. One run at a time. You may give up and bank the result.

**The 12 Siege maps** reuse work already done. Two come from the held wave scripts of Scree's Gate and the Leaky Line. The other ten are new, three per launch region and one spare.

**Odds and Ends, sample set of 12** (weapons doc may add):

| Name | Effect for this run |
|---|---|
| Spare Lid | Heartkettle +60 max HP |
| Thick Socks | Tumbled Hobs take no damage |
| Second Breakfast | One Hob heals 30 at each wave start |
| Long Spoon | Preview +15% |
| Deep Pockets | +1 Rummage pick per wave |
| Warm Kettle | +25 Steam per wave |
| Lucky Brick | The first block lost each wave is mended free |
| Loud Hat | Rival aims at one chosen Nook 20% more often |
| Borrowed Ladder | A Tumbled Hob climbs back to its old Nook if it still stands |
| Long Look | Forecast shows two Weather Fronts ahead |
| Odd Sock | One extra Knack use per wave for one Hob |
| Rainy Day Tin | Bank 20 Scrap now; it doubles if unspent after 3 waves |

**Result.** Waves cleared, then Score [00 §6]. Local top 10 runs with crew, Blueprint and date.

**Rewards.** 10 Buttons per wave won, 200 at most per run [audit C61]. One-time Keepsakes at waves 5, 10, 20 and 30. Trick Shells at waves 5, 10, 15, 20, 25 and 30, the Jack Screws Doodad at wave 12 and Spare Spring at wave 18 [01 §4, §5]. Gus and Tacks join at first-run wave milestones [03 §3.9]. The mode card shows each of these. Outfits at waves 15 and 25. A title for the save file at wave 40. No reward past that needs endless play.

### 5.6 Ironclad `[U2]`

Replay any cleared region on the Ironclad preset [00 §8.1]. Unlocks region by region.

- **Knobs** as the core table: tight AI aim, best shells plus combos, hidden enemy crew, wind +2, no Tinker preview bonus. No Take Back.
- **Iron twist.** Each region adds one map rule so it is not only a numbers change:

| Region | Iron twist |
|---|---|
| Puddingstone Downs | Molehills rise every round |
| Crag End | Every ledge is a Rockfall Shelf |
| Soggy Bottom Fen | Tide moves every 2 rounds |
| The Flats | Big Ethel on every map |
| Nithering Heights | Weather Front lasts 1 round on all levels |
| Wheal Clank `[U3]` | One more Lodestone on every map |

- **Iron Pennants.** One per level for a win: 50 when U2 ships, 60 after U3. They are badges, not currency [00 §5.1].
- **Rewards.** 100 Buttons per level, once. 10 Iron Pennants in a region gives iron trim decor in that region's style. All of them gives the Iron Kettle Keepsake and an iron border on the save file.

### 5.7 Baron Rush `[U3]`

All six Grand Forts in order, back to back [00 §4.5]. The order is the story order: Topiary Keep, Sanding Stair, Great Sump, the Last Level, Glidehall, Stampmill.

- **Setup.** One Blueprint, one crew of 5, two Doodads, and one long Rummage: 8 Trick Shells for the whole Rush.
- **No repairs.** Block and kettle damage stays. Bonked Hobs stay out for the rest of the Rush. The Last Level's own mend between Stages is off here.
- **Between forts.** Knacks refill. Steam refills to your cap [audit C73]. Pick one more Trick Shell from 3.
- **Bosses** are the campaign versions with Fair numbers, on their own maps. The Last Level counts as two forts, so the Rush is seven fights.
- **Result** is total rounds used. Fewer is better.
- **Medals.** Bronze: finish. Silver: 85 rounds or fewer. Gold: 65 rounds or fewer with at most one Hob Bonked. Lines move after bot runs.
- **Save.** Autosaves each Turn. You may stop between forts and come back.
- **Rewards.** Bronze: Keepsake, the Baron's Spare Saucer, 500 Buttons once, the Homecoming Hat shell and the Where Was I? Doodad [01 §4, §5]. Silver: flat-cap Outfit set. Gold: gold Stompers decor.

### 5.8 Couch Duel `[Launch]`

Two players on one device, taking turns. The core doc owns the rules [00 §6.1]. From this doc it gets maps only.

- **Maps.** Every duel map Skirmish offers on the device's save, plus the three Downs shared maps (D1 Two Lumps, D2 Orchard Dip, D3 Long Meadow) from the first launch. Quick Match uses D1, the fair, even map.
- **Map rules.** Every map on offer already passes the checks in section 4, including the Fairness checks from both sides (4.5). No map is made for Couch Duel alone.
- **Loaner forts** come from the Daily loan tables (5.4). The **Starter Box** [00 §6.1] uses three mirror kits from those tables, playable from the first launch.
- **No line** marks (4.5 item 15) show in Couch Duel too, so neither player brings a dead pick by mistake.
- **Wind** follows the setup choice: Off, Gentle (0 to 3), the map's range, or the map's range +2.
- **Hazards** run on their Hazard Beat (4.6), the same as in Skirmish, and can be turned off.

---

## 6. Difficulty curve and pacing

### 6.1 Curve

Target difficulty on Fair, per level. `B` marks a Grand Fort. `o` marks a breather. `#` is any other level. Regions 1 to 4 are the launch game. Regions 5 and 6 are post-game updates, so they start below the Baron and climb past him.

```
10 |                                                                B
 9 |                                          B         #B     #  ##B
 8 |                                     ##  #B     ## ##B  ## ##o##B
 7 |                              #B  ## ### #B  ## ##o##B ###o##o##B
 6 |                    B     ## ##B ###o###o#B ###o##o##B ###o##o##B
 5 |                 ###B  ## ##o##B ###o###o#B ###o##o##B ###o##o##B
 4 |         B    # ####B ###o##o##B ###o###o#B ###o##o##B ###o##o##B
 3 |       ##B ##o#o####B ###o##o##B ###o###o#B ###o##o##B ###o##o##B
 2 |   ######B ##o#o####B ###o##o##B ###o###o#B ###o##o##B ###o##o##B
 1 |#########B ##o#o####B ###o##o##B ###o###o#B ###o##o##B ###o##o##B
   +------------------------------------------------------------------
    1234567890 1234567890 1234567890 1234567890 1234567890 1234567890
    R1 Downs   R2 Crag    R3 Fen     R4 Flats   R5 Heights   R6 Mines
    launch     launch     launch     launch     U2         U3
    level in region (0 = level 10, the Grand Fort)
```

Shape: a saw that climbs. Each region starts 1 to 3 points under the last boss, climbs, dips once or twice, and peaks at its Grand Fort. The player never meets two new peaks in a row without a dip between. The launch game tops out at 9. The scale's 10 is kept for the end of U3.

| Region | Diff by level, 1 to 10 |
|---|---|
| 1 Downs | 1, 1, 1, 2, 2, 2, 2, 3, 3, 4 |
| 2 Crag | 3, 3, 3, 4, 3, 4, 5, 5, 5, 6 |
| 3 Fen | 4, 5, 5, 4, 6, 6, 5, 6, 7, 7 |
| 4 Flats | 6, 7, 7, 6, 8, 8, 7, 6, 8, 9 |
| 5 Heights `[U2]` | 6, 7, 7, 6, 8, 8, 7, 8, 9, 9 |
| 6 Mines `[U3]` | 7, 8, 8, 7, 9, 8, 8, 9, 9, 10 |

### 6.2 Rules of the curve

1. A region's first level is at least 1 point easier than the Grand Fort before it.
2. No step up of more than 2 points between neighbours.
3. Regions 2 to 6 each have at least one breather in levels 3 to 8. It follows the hardest level so far in that region or comes right before the run-in to the boss. Region 1 is gentle all through and needs none.
4. A level that brings in a new mission type is no harder than the level before it.
5. The level before a Grand Fort adds no new hazard and no new mission type. The boss itself is built from parts the region has already shown (6.5). The one exception is 1-9, which teaches Walk because the Topiary Keep's roller asks for it.
6. Difficulty comes from the map, the goal and the Rival's habit before it comes from Aim rating. Aim is 1 to 2 in Region 1, 2 to 3 in Regions 2 and 3, and 3 to 4 in Region 4. Bosses use their region's top grade [audit C74].
7. **Late forts must still fall.** Defense no longer outgrows attack: block HP is flat (30, 50, 80, 110), crew stops at 5, every kettle is 300 and tall stone is top heavy [rulings B1 to B4]. Bots run a Region 4 fort against a Region 4 fort by week 6. Pass mark: the median duel ends by Round 12, and under 15% of battles reach the Squall.

**Win-rate bands** for the Regular proxy on Fair, plus or minus 5 [04 §7.2 owns the table; these are the working numbers for the new region order]: 92% in 1-1 to 1-5, 85% in 1-6 to 1-9, 75% in Region 2, 70% in Region 3, 62% in Region 4, 50% first try on a Grand Fort and 90% clear by try 4. Regions 5 and 6: 60%. A level's Diff says where in its band it sits: breathers at the top, peaks at the bottom. Bots get only the Tinker progress that first clears give [00 §3 "Grind"].

### 6.3 Breather levels

| Level | Why it is light |
|---|---|
| 2-3 Echo Gorge | No return fire. Bank shots for fun |
| 2-5 Scaffold Row | Light return fire. Big collapses |
| 3-4 Lily Pad Skip | No return fire. Short |
| 3-7 Fog Lantern | Low Aim Rival, slow pace, story beat |
| 4-4 Three on a Chain | Three shots, free retry |
| 4-8 Evenhand's Mistake | An ally helps. Story reward before the last climb |
| 5-4 Icicle Alley `[U2]` | Three shots, free retry |
| 5-7 Sled Run `[U2]` | 8 rounds, fast, loud |
| 6-4 Ricochet Shaft `[U3]` | No return fire |
| 6-7 Brass Tacks `[U3]` | Four shots, free retry |

### 6.4 Pacing of new content

One main new thing per level, two at most [00 §8.3]. Nothing new in a Grand Fort except the boss.

**The onboarding list (fixed order, rulings B14).** Levels 1-1 to 1-5 teach only aim, Hob pick, the kettle, wind and one Knack. The UX doc holds the prompts and keeps them to 12 in the first 10 minutes [07 §5].

| Step | The one lesson | Crew | What opens | What is held back |
|---|---|---|---|---|
| Cold Open | Drag to aim, Fire | Marge | | Everything else |
| 1-1 First Lump | Ghost, Pin, Recall, Bonk a crew | 1 | The map | Kettle, wind, Knacks, Hob pick |
| 1-2 Two Hats | Pick the shooter, Fine Tune | 2 | | |
| 1-3 Kettle on the Knoll | Kettle Pop (a loose Lid Lifter in hand) | 2 | | |
| 1-4 Breezy Tops | Wind and the forecast (a loose Bag of Marbles in hand) | 3 | | |
| 1-5 Under the Roof | One Knack, and "needs a rest" | 3 | Skirmish (after the win) | The Rummage, Doodads |
| Before 1-6 | The Workshop: 3 blocks, 2 good spots | | Workshop, Test Yard | Decor, rooms |
| 1-6 Roof Trouble | A Rival habit you build against | 3 | | |
| 1-7 Hetty in a Jam | Rescue | 4 (free fourth Nook) | | |
| 1-8 Rummage Sale | The Rummage: 4 cards, 2 picks | 4 | | Full pool of 10 (from 2-1), Doodads (Mend Bucket after 1-9; Pot Lid and slot 2 at 2-1) [01 §5] |
| 1-9 Over Loaf Hill | Walk and Steam | 4 | Mend Bucket and Doodad slot 1 (on the win, first used at 1-10) [PLAN decision 14] | Pot Lid, slot 2 |
| 1-10 The Topiary Keep | A Grand Fort with phases | 4 | Tinker Tree (on the first win), Daily Dust-up | |

A new player reaches about the end of 1-3 in the first 10 minutes [02 review §1.1]. That is fine. Nothing but shooting happens in that time.

**New content by region.**

| Region | Classes first in hand | Mission types first seen | Hazards first seen | Weather | Enemy materials |
|---|---|---|---|---|---|
| 1 | Lobber, Zinger, Scatterjack, Digger, Patcher, Bouncer | Siege, Rescue, Grand Fort | Molehills, Springy Hedges, Tumblestones | Clear, Breeze | Wicker, Timber, first Cobble |
| 2 | Stoker (all seven launch Classes by 2-1) | Puzzle, Demolition | Rockfall Shelves, Updraft Vents, Butting Goats | Wind line | Cobble |
| 3 | none new | none new | Burp Vents, Tide, Marsh Gas, Sink Mud | Drizzle, Fog Bank | First Brassbound (pumps) |
| 4 | none new | none new | Hoisted Hills, Big Ethel, Stampers, Bellows Towers | Bellows Gale | Brassbound |
| 5 `[U2]` | Lookout | Escort | Snow Drifts, Icicle Racks, Thin Ice, Avalanche Slopes | Snowfall, Blizzard | Brassbound frames, frost panels |
| 6 `[U3]` | none new | King of the Hill | Stalactites, Lodestones, Mine Carts, Lava, Gas Pockets | Draught | Mossbrick |

**Hobs.** The crew doc owns the launch list of 16 Hobs in 7 Classes [03]. This doc owns when each joins. Each Rescue level frees a Hob from the launch list.

| Region | Hobs that join (level) | Running total |
|---|---|---|
| 1 | Marge (1-1), Miss Quill (1-2), Jax (1-4), Grub (1-6), **Hetty (1-7, rescued)**, Bobbin (1-8) | 6 |
| 2 | Edna (2-1), Old Thumper (2-3), **Dame Flicka (2-8, rescued)**, Nan (Trial T3 path, or 2-10) | 10 |
| 3 | Skip (3-1), Nurse Plumley (3-3), Ginger (3-5), **Truffle (3-7, rescued)**, Walt (3-9) | 15 |
| 4 | **Pip (4-8, rescued)** | 16 |

This matches the crew doc's final launch list: Lobber: Marge, Old Thumper, Pip. Zinger: Miss Quill, Dame Flicka. Scatterjack: Jax, Nan, Ginger. Digger: Grub, Truffle. Bouncer: Bobbin, Skip. Stoker: Edna, Walt. Patcher: Hetty, Nurse Plumley. Later Hobs: Gus and Tacks in U1; Aunty Nip, Dotty, Winkle, Olive and Tansy in U2; Wick, Bartleby, Ernest, Lady Carom and Petra in U3 [03]. Winkle (old 2-3), Petra (old 2-9) and Tansy (old 6-8) no longer join at launch. Join levels inside each update are set when that update is built. Tacks joins in U1, so the Canary Row (6-6) captive is Petra.

The trial (Region 1) gives 6 Hobs in 6 Classes. The Flats adds one Hob only: the last stretch tests the crew you have.

**Crew size.** 1 to 3 as owned through 1-6. 4 from 1-7, with a free fourth Nook; the grid growth that seats the crew is a campaign gift, not a node [rulings B3]. 5 from the first win at 2-10: the fifth seat is a free gift for beating the Sanding Stair, and the grid grows to hold it. Rival crews never lead the player's: 1 to 2 Hobs in 1-1 to 1-3, 3 in 1-4 to 1-7, 4 from 1-8, 5 from 4-2 (the player has had 5 since 2-10).

**What levels assume from the Tinker Tree.** Nothing. No node is needed to win on Fair [00 §3]. The Tinker Tree opens on the first win at 1-10, so no Region 1 level can lean on it. Forecast, Rival ghost lines, the shot log and the drift readout are free on every level [rulings B13]. Tiers open as the tech tree doc sets them.

**Session fit.** Region 1 runs about 40 minutes [audit C66]. Regions 2 to 4 run 50 to 70 minutes each on first clears. The launch campaign is about 4 to 5 hours without replays and 8 to 10 hours for all 138 launch Pennants. Each update adds about an hour of first clears.

### 6.5 Grand Forts in the campaign

The enemies doc owns boss rules, phases and numbers [04 §4]. The campaign adds these:

1. **Each boss is the region's lesson as a test.** The Topiary Keep: lobs, Walk, stopping a roller. The Sanding Stair: height, Thump, Dig. The Great Sump: water lines, mud, skips. The Last Level: making ground. In updates, the Glidehall: wind, Frost then Blast, moving targets. The Stampmill: timing, Zap chains.
2. **The region teaches every boss part first.** Each Rig Part kind or hazard a boss uses appears in a normal level of that region before level 10: a rolling thing in 1-9, Rockfall Shelves in 2-2, tide in 3-5, mounds against a roller in 4-2, raised ground against a press in 4-3, dropped hills in 4-1 and 4-7.
3. **Boss parts leave with the wings.** Bellows Towers (4-5) return at the Glidehall and Stampers (4-3) at the Stampmill. A player who cleared the Flats already knows the counter.
4. **The level before a boss adds no hazard and no mission type.** 2-9, 3-9 and 4-9 use only what the region has taught.
5. **Every kettle is 300 HP.** Phases, not HP, make a boss long [rulings B4].
6. **Rewards** follow [04 §4.1]: 500 Buttons plus 25 per Pennant, a Keepsake, one new Trick Shell, and the region rises on the map. The Last Level pays 1,000 plus 25 per Pennant [audit C59].

| Grand Fort | Phase | Keepsake [04 §4] |
|---|---|---|
| The Topiary Keep | Launch | Golden Shears |
| The Sanding Stair | Launch | Chipped Chisel |
| The Great Sump | Launch | Brass Bilge Bell |
| The Last Level | Launch | The Baron's Teacup |
| The Glidehall | U2 | Silver Skate |
| The Stampmill | U3 | Dented Bell |

---

## 7. Three example levels in full

Map key for all examples. Scale: one character is 30 cells wide and 60 cells tall, so a Standard map is 80 characters by 12 rows.

```
:  Loam          #  Rock          %  Clay         =  Bedrock (map floor)
~  Water         i  Ice           *  snow (loose Loam)
YY your fort     RR Rival fort    numbers and letters: objects, listed under each map
```

### 7.1 Level 1-9: Over Loaf Hill (Siege, teaches Walk) `[Launch]`

**Pitch.** Lance Corporal Dibber sits on High Hill and takes his time. Loaf Hill stands between you. You can trade lobs from where you start, or take a short walk and change the fight.

```
                                                       RRRR
        YYYY                                 :::       RRRR
        YYYY                               T:::::    :::::::::
      ::::::::     BB              nnn     :#####: H #########::::::::
::::::::::::::::::::::            :::::   ::#####::::#########::::::::::::::::::
:::::::######::::::::::::::~~~~:::::::::::::#####::::#########::::::::::::::::::
:::::::######:::::::::::::::::::::::::::::::#####::::#########::::::::::::::::::
:::::::######:::::::::::::::::::::::::::::::#####::::#########::::::::::::::::::
================================================================================
0         300       600       900       1200      1500      1800      2100  (cells)
```

| Mark | Thing |
|---|---|
| YY | Your fort on the west shoulder of Home Knoll, pad at height 360 cells. The knoll's crest is 150 cells to your right and 40 cells higher |
| B | An old barn. Timber, soft cover, no rule |
| ~ | The ford, shallow Water, 120 cells wide |
| n | The Bun, a low hump |
| T | A Tumblestone on the west face of Loaf Hill |
| H | A Springy Hedge at the foot of the Rival's hill |
| RR | Rival fort on High Hill, pad at height 420 cells |

**Setup.**

| Item | Value |
|---|---|
| Size | M, 2400 x 720. The right 500 cells are empty downs, for long misses |
| Fort centre gap | about 1,400 at the start; about 1,250 from the crest |
| Round cap | 14; the Squall follows |
| Wind | 0 to 2, Breeze, three Weather Fronts |
| Rival | Corporal Dibber (Tidy). A Pancake fort, Timber with a Cobble roof. Hobs: 2 Hedgers (Lobber), Raker (Scatterjack), Mower (Bouncer). Aim 2 |
| Habit on the card | "Slow to find his range. Starts over when you move." |
| Your crew | 4 Hobs from Marge, Miss Quill, Jax, Grub, Hetty, Bobbin |
| Rummage | Pool of 6, 3 picks each. One mound shell is in the pool, on loan |
| First turn | Player |

**How it plays.**

- **From the start pad.** Loaf Hill shuts the flat line both ways. Lobs work. Dibber's two Lobbers bracket you: wide, closer, closer. By Round 4 they are landing.
- **The walk.** The Walk pad glows once, with a ghost outline of the fort on the crest. About 30 Steam takes you 150 cells right and 40 cells up. Two things change. Miss Quill now has a flat line over Loaf Hill to the Pancake's top Nooks. And Dibber's bracket is gone: his next shot is wide again. This is the lesson: a Walk is a new angle and a dodge in one.
- **Steam.** You have 100 for the battle and can spend 40 in a turn [00 §2.14]. So there are three such walks in the battle, not ten. The Steam gauge prompt shows after the first one.
- **The Mower.** Its rollers run down High Hill toward you. The Hedge stops the first; after that, the ford or a mound stops them.
- **The Tumblestone.** Undercut it and it rolls west down Loaf Hill into the dip. Either side can spend it. It is the first rolling thing the player meets, three levels before a roller with a boss on it.
- **Two plans.** Trade plan: stay put, lob through the Cobble roof's ends, win on crew. Walk plan: go up, thread Miss Quill's bolts into the top Nooks, walk again when the lobs get close.
- **Why boring the base fails.** High Hill has a Rock core under the Rival's pad and the Hedge eats flat shots at its foot.

**Pennants.** 1 Win. 2 Land hits from two different spots. 3 No Hob of yours Bonked.

**Checks.**

| Check | Result |
|---|---|
| Lump Rule | Hill between forts (Loaf Hill), height gap 60 (not counted), water (ford), no cave, no cliff: 2 of 5. Pass |
| Sightlines | Flat line blocked both ways by Loaf Hill at the start; opens for the player from the crest. Lob line open. Steep line open |
| Cover | Hard: Loaf Hill core. Soft: the Bun, player mounds. Open: the knoll crest |
| Reach | Both forts reach each other's Nooks at power 75 to 85, wind 2 against |
| Frame | Both forts fit in one frame at zoom 0.6 from the start pads |
| Walk is real | One Walk of 30 Steam opens a flat line (rule 4.5 item 10) |
| Hazards | Tumblestone and Hedge react to hits; no beat hazards |
| Bot band | R1 late: 85% for the Regular proxy on Fair [04 §7.2] |

### 7.2 Level 4-10: The Last Level (Grand Fort, two Stages) `[Launch]`

**Pitch.** Two fights in a row down one long avenue of plate: the Baron's roller, then the Baron's engine. The enemies doc owns the bosses [04 §4.6]. This spec owns the two maps and how the ground lets the player win.

**Shared rules** [04 §4.6, rulings B12].

- Hobs keep HP between Stages; Bonked Hobs return at 30 HP. Half of lost block HP mends. Steam refills to your cap. Knacks reset.
- One Rummage covers both Stages: pool of 12, 5 picks each.
- **Hill Call** is free every turn from the first Roller turn to the end. It raises one Small mound on your half of the map and does not cost the Action. At most 4 Hill Call mounds stand at once; a fifth removes the oldest [04 §4.6]. In the picture, each call is answered by a freed region: Downs turf, Crag stone, Fen reed bank.
- **The clan crate** floats in on a balloon when Stage 2 reaches its last phase: Knacks refill and you pick 2 shells from 4. The hand is never empty for the finish.
- Round cap 12 per Stage; the Squall follows it. Each Stage is its own battle for the 8-minute rule. Autosave at each Stage start. A loss retries from that Stage on every preset.
- Both forts have a 300 HP Heartkettle.

**Stage 1 map: the Grand Roller** (M).

```
                             '       '       '
                             '       '       '
                            111     222     333
                           11111   22222   33333
      YYYY                                           GGG
      YYYY                                          GGGGG
   ::::::::::                                      GGGGGGG
::::::::::::::::                                   GGGGGGG
::::::::::::::::####  v  #######################################################
################################################################################
################################################################################
================================================================================
0         300       600       900       1200      1500      1800      2100  (cells)
```

| Mark | Thing |
|---|---|
| YY | Your fort on the Last Rise (Loam over Rock), pad at height 360 |
| v | The rolled trench, 150 cells wide, 60 deep. Its near lip is the Roller's 300-cell mark |
| 1, 2, 3 | Hoisted Hills on chains (`'` is a chain). Each is about 150 cells wide and 120 tall |
| GGGG | The Grand Roller at its start. The drum is its base; the Baron's fort rides on top |
| # | Pressed Plate (acts as Rock) |

| Item | Value |
|---|---|
| Size | M, 2400 x 720. The plate runs on to the right edge behind the Roller |
| Fort centre gap | about 1,400 at the start. It closes by 96 cells a turn |
| Wind | 0 to 2. No Bellows Towers here; Glaze has already left with them |
| The Roller | Rolls 96 cells toward you every turn and flattens Loam and Clay it crosses [04 §4.6]. From its start it is about 930 cells from the mark: 10 turns if nothing stops it |
| Stops | A mound 32 cells high in its path stops it for one turn; a mound shell or a Hill Call can make one. A dropped Hoisted Hill is worth two turns, since the drum must grind it down. A hit on the Drive Gear stalls it two turns |
| Hill Call reach | Your half of the map only, and 4 mounds at most. The Roller starts on the far half. So Hill Calls build your cover early and stop the Roller only in its last stretch before the mark |
| At the mark | The Roller stops and starts its last phase early |
| Rival crew | 4 Nooks on top: Roller Guards and Ruler Snipers. Two more Roller Guards join in phase 2, to a cap of 5 on the field |

How it plays:

- **Distance is the clock.** Ten turns to the mark, twelve rounds to the cap. Unstopped, the Roller wins the race. Three stops make the Stage safe; each one is a turn the player did not spend on damage.
- **Three hills, three choices.** Drop hill 3 early to stall the Roller far away and it is ground flat by Round 4. Keep hill 1 for last and it becomes your wall in front of the trench when the Great Press starts shaving the map. Hill 2 is the swing: cover now, or a stop later.
- **No dead hand.** A player with no Digger, no Patcher and no mound shell still has three hills to drop, the Drive Gear to hit and a free Hill Call each turn. The old version left that player with no answer [02 review §1.4].
- **Steam Pressure** hides the fort behind a cloud that stops the preview. A hill between you and the cloud gives a known point to range from: bounce or lob off its crest and count from there.
- **The Great Press** shaves hills from the Roller's side toward you, 200 cells a slam. Every hill you kept, dropped or called is one more slam before your pad goes.
- **Why boring the base fails.** The Roller's base is its drum. There is no ground under it to carve, since plate is Rock, and it moves every turn.

**Stage 2 map: the Level Engine** (M). A shallow bowl of plate, 100 cells deep at the centre. The Engine stands on a Bedrock plinth on the right rim. Your pad is a plate rise on the left rim, 40 cells above the bowl's edge. Two last Hoisted Hills hang over the bowl. Three press arms reach from the Engine toward your side.

- Lump Rule: pit (the bowl), height gap, overhangs: 3 of 5.
- **Calibrate.** Each Level Bubble on the Engine's face drives one press arm. The arms always show their ring a turn ahead. Break Bubbles to stop arms.
- **Dead Level** floods the bowl. The Water Line climbs 16 cells a turn. The Engine's kettle shield opens only while two or more hills stand above the water.
- **Hill Call** carries on. A Small mound drowns in about two turns. A dropped Hoisted Hill lasts about seven. So: drop both hills first for a safe count of two, then use Hill Calls to build on their tops, where the water reaches last.
- **Where to stand.** Your rise floods last. Walking down into the bowl to dodge a press arm costs you height against the tide.
- **Last Cup.** The Baron puts down his teacup, once. The clan crate lands. The Baron is in the top Nook behind Brassbound. No tricks are left on his side; you have full Knacks and two fresh shells. Focus one wall, or go for the kettle: both win paths are open.

**Pennants.** 1 Win. 2 The Grand Roller never reaches its 300-cell mark. 3 Three hills stand above the water at the end.

**Checks.**

| Check | Result |
|---|---|
| Lump Rule | Both maps: 3 of 5. Pass |
| Sightlines | Stage 1: flat line blocked by the drum; lob line open. Stage 2: all open; water is the cover |
| Telegraphs | Roller path and distance counter, Great Press line, press arm rings, water marks: all at least one player turn ahead [04 §4.1] |
| Frame | Each Stage starts with both forts in one frame at zoom 0.6 |
| Plain Shots only | Passable: hills drop to Plain Shots, and Hill Call is free |
| Length | Two Stages of up to 12 rounds: 8 to 14 minutes in all, under 8 per Stage. The old three-Stage fight ran 15 to 25 |
| Bot band | Grand Fort, first try: 50% for the Regular proxy on Fair. 90% clear by attempt 4 [04 §7.2] |

### 7.3 Level 3-6: Pump Number Nine (Demolition) `[Launch]`

**Pitch.** Three brass pumps are sucking the pond dry. Break them before the water is gone. The Rival behind them is in no hurry: every round of dry mud is a round closer to you.

```
                                                 RRRR
                  1         2         3          RRRR
    YYYY          ||        ||        ||       %%%%%%%%
    YYYY          ||        ||        ||      %%%%%%%%%%
 :::::::::~~~~~~~~||~~~~~~~~||~~~~~~~~||~~~~~~%%%%%%%%%%:::::::::::::::::::::::
::::::::::~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~%%%%%%%%%%:::::::::::::::::::::::
::::::::::mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm%%%%%%%%%%:::::::::::::::::::::::
::::::::::mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm%%%%%%%%%%:::::::::::::::::::::::
================================================================================
0         300       600       900       1200      1500      1800      2100  (cells)
```

| Mark | Thing |
|---|---|
| YY | Your fort on a Loam bank |
| 1, 2, 3 | The pumps, on stilts in the pond. Each is Brassbound, 2 x 3 blocks |
| ~ | The pond. It starts 120 cells deep |
| m | The Mud bed under the pond |
| % | The Rival's Clay dyke |
| RR | Rival Moat Fort on the dyke |

| Item | Value |
|---|---|
| Size | M, 2400 x 720 |
| Fort centre gap | about 1,330 |
| Round limit | 10. Break all 3 pumps inside it |
| Wind | 0 to 3, Drizzle |
| Pumps | Each standing pump drops the water 20 cells per round. With all three up, the pond is mud by Round 2 |
| Rival | Chief Engineer Valva Stopcock (Builder). Moat Fort, Cobble 5 x 5. Hobs: Lobber, Scatterjack, Pump Hand (Stoker), Filler (Patcher). Aim 3. Fires at you about half its turns and mends a pump with its Patcher when one is cracked |
| Mini-boss | Sergeant Squeegee crosses on Round 5 and dumps a Mud mound on the nearest fort; tip the bucket to send it the other way [04 §5.1] |

How it plays:

- **Order matters.** Pump 1 is the easy shot and pump 3 the hard one. But pump 3 is the one the Rival's Patcher can reach. Break it first and the other two stay broken.
- **Brassbound.** This is the player's first look at it. It shrugs off Fire. Pierce and Blast work. The card says so.
- **The water is a clock and a shield.** While it stands, the Rival cannot walk and short shots only splash. As it drops, mud shows, the Rival walks closer along the bed at x3 Steam, and its flat shots start to reach.
- **Why this is not a duel.** Popping the Rival's kettle does not win. It only stops the return fire. The pumps are the goal.

**Pennants.** 1 Win. 2 Done in 7 rounds. 3 Water never under half.

**Checks.**

| Check | Result |
|---|---|
| Lump Rule | Water, height gap 90 (dyke above bank), a pit once the pond drains: 3 of 5. Pass |
| Sightlines | Flat line open over the water to pumps 1 and 2. Pump 3 needs a lob. Steep line open |
| Hazards | The pumps act on the beat (period 1). Sergeant Squeegee acts once and shows a round ahead |
| Reach | All three pumps at power 55 to 85 |
| Bot band | R3: 70% for the Regular proxy on Fair, low end of the band |

---

## 8. Brickabrac Map flow

- The map is one scroll, left to right, home in the west and the Flats in the east. At launch it has four regions. Each region is a cluster of 10 nodes on a winding road. Trials sit on short side paths with a puzzle-piece sign.
- Levels unlock in order. From Region 2 on, each region has one fork where two levels open at once (levels 4 and 5, or 5 and 6), so a stuck player has somewhere else to go.
- A cleared node shows its Pennants as small flags. A node with all three flies a gold one.
- When a region's Grand Fort falls, its hills rise in a 3-second scene that can be skipped [07]. Regions not yet won look ironed flat.
- Sir Pudge shows up on the map near his next odd job. Tap him for a one-line grumble.
- The road east of 1-10 runs straight on to Crag End. The game is free with no monetization, so no card or gate stands on any road [00 §5.5].
- **The wings.** After 4-10 the map shows two roads leading off its edge: north to a flat, shiny peak and south to a smoking mine mouth. Each has a signpost with the update's name. Nothing can be tapped there until its update is installed. When U2 ships, the Heights hang off the map as a north spur with 10 nodes; U3 adds the Mines as a south spur. The store page and the signposts say the same thing: what is in the box today, and what is coming for free [02 review §5.3].

---

## 9. Open points for review

| # | Point | Detail | Who decides |
|---|---|---|---|
| 1 | Launch scope | 40 levels in 4 regions, with Heights as U2 and Mines as U3. Recommended; not yet approved | Owner [rulings D1] |
| 2 | Launch Hob list | Settled. Section 6.4 follows the crew doc's final list of 16 and frees Hetty, Dame Flicka, Truffle and Pip in Rescue levels | Closed |
| 3 | Canary Row captive | Closed: the captive is Petra Mason, the crew doc's U3 rescue. "Sorry" names only "the freed Hob" | Closed |
| 4 | Round cap in 1-1 to 1-3 | Closed: the core doc's range is now 8 to 20, with 8 only in 1-1 | Closed |
| 5 | Test Yard and Skirmish unlocks | Follow the core doc: Test Yard with the Workshop at 1-6, Skirmish after 1-5. Skirmish opens before the Rummage is taught, so its shell rules should stay hidden until 1-8 | Core doc owner |
| 6 | Level 1-1 has no Squall | Closed: the core doc carries the exception (00 §2.11). The Squall order is fixed too: both sides take each Squall hit at once at round end, and a double pop goes to more total HP | Closed |
| 7 | Rival habits | The habit lines in 3.10 are proposals. Each needs a matching AI weight | Enemies doc |
| 8 | Rival names and count | The names in italics in 3.10 are proposals. Launch has 23 named Rivals plus 4 lieutenants and the Baron; the scope review planned about 20. Rivals reuse unit art, so the cost is small | Enemies doc, art doc |
| 9 | Tinker Tree and the boss | The tech tree doc opens the tree at 1-10. This doc reads that as the reward for the first win, so the Topiary Keep is fought with no nodes | Tech tree doc |
| 10 | Hill Call and the Roller | Doc 04 lets Hill Call mounds land on the player's half only, 4 at most. Check with bots that this cannot stall the Roller for good in its last stretch | Enemies doc |
| 11 | Bellows Towers | Now 2 wind each, 6 at most, since the Flats comes right after the Fen. The Glidehall may use stronger ones in U2 | Enemies doc |
| 12 | The Plumb Line in a duel | 4-6 is a plain duel with one Rig Part. Check that it reads as a Rival, not a fifth Grand Fort | Enemies doc, playtest |
| 13 | Win-rate bands | Working numbers for the new region order are in 6.2. Doc 04 owns the table | Enemies doc |
| 14 | Side Rivals | Not built. The weapons doc gave every Doodad another source, so the audit's side Rivals [audit C34] are parked (Appendix A) | Closed |
| 15 | Daily on trial | Closed: the game is free with no trial, so the Daily needs no lending rule for trial players [rulings D2] | Closed |
| 16 | Daily result | Uses the core doc's Score for its bands | Closed |
| 17 | Story cast | Clan Knobble, Pedlar Tuppence, the Sleepy Hills and the Baron's saucer are from this doc. Check against the art and UX docs | Owner |
| 18 | New sim objects at launch | Cage, Bell Target, Outpost, crane, drifting barge, and 15 map hazards. Each needs a deterministic rule that acts only at turn edges, like Rig Parts [04 §4.1]. Cart, Pedlar Fort and Switch Lever wait for U2; Hilltop zone for U3 | Tech plan |
| 19 | Held levels | Jam Cart Road, the Escort Goat Track, the cart Ferry Cross, the Long Flat Mile and four King of the Hill maps have no slot. Appendix A lists them. Decide per update whether any return | Content owner |
| 20 | The Grumblenimbus in U2 | It zaps, and Zap is U3. In 5-6 it hails (Frost) until then | Enemies doc |
| 21 | Fen as the cut line | If the team is over three weeks behind at week 30, the Fen ships after launch and the Flats becomes Region 3 | Owner |

---

## Appendix A. Parked ideas

Nothing here is in any phase plan. Group 1 is cut for good by the rulings. Group 2 is designed work with no slot; it may come back if a later update has room.

### A.1 Cut for good

| Item | Why |
|---|---|
| 40 hand-made Dust-up maps | The Daily is a seeded Skirmish on existing maps [rulings B18] |
| Daily weekday themes (a different mission type each weekday, a Sunday Grand Fort) | Same ruling. The Daily is a duel with one modifier |
| Daily Keepsake set of 12 for Sunday Golds | Went with the Sunday Grand Fort |
| 12 of the 24 Siege maps | Long Siege ships with 12 [02 review §5.3] |
| Last Bell, the four-step Tiebreak and "ahead at Last Bell" win lines | Replaced by Sudden Squall [rulings B5] |
| Stage 1 of the old three-Stage final boss | The Steward is level 4-6; the boss is two Stages [rulings B12] |
| Retry from Stage 1 on Stubborn and Ironclad | Retry is from the Stage on every preset |
| Raid Rehearsal as a mode, with its report card, heat map, Sturdy rating, side-by-side compare, stamps and the Fire Drill Outfit | It is a Test Yard button [rulings B16]. The "what broke you" replay does the report card's job |
| Trick-shot Challenge and Defend a Cart as their own mission types | Merged into Puzzle and Escort [rulings B16] |
| Survive Waves as a campaign type | Waves live in Long Siege only |
| Hidden enemy seating on the level card | Enemy Class icons stay shown at launch [rulings B10] |
| Fort gaps of 1400 to 1800 in duels | Duel gap is 1400 at most [rulings C4] |
| "Borrowed Ladder: Tumbled Hobs do not skip a shot" | Tumble never skips a shot now; the boon has a new effect |
| Night Shift (dark battles) | Strains the "read it" rule. Not placed in any phase |
| One optional side Rival per region [audit C34] | The weapons doc no longer pays any Doodad from side Rivals, so they have no job |

### A.2 Designed, no slot

Rows below are from the last revision, under their old IDs, as written then. They would need a pass against the rulings before any use.

| ID | Name | Type | Map | Objective | Special rule | Enemy setup | New thing | Pennants | Diff |
|---|---|---|---|---|---|---|---|---|---|
| 1-6 | Tumblestone Lane | TD | M. Long slope up to the right. A tall thin Flattener Stamp Tower half way up. Three Tumblestones perched above it | Bring the tower under 30% in 8 rounds | Tumblestones roll when undercut. Tower is 3 x 8 Timber | Stamp Tower with 1 Hob (Lobber) at the top. Aim 1 | Timed Demolition. Tumblestones. Collapse and Crush. +Grub (Digger) | 1 Win. 2 Done in 5 rounds. 3 Hit the tower with 2 Tumblestones | 2 |
| 1-9 | Jam Cart Road | DC | M. See example in section 7.1. A sunk road with a ford, a hump and Loaf Hill between the road and the Rival | Bring the Jam Cart home | Cart rolls 80 cells per round. Wind 0 to 2 | Pancake fort on a high hill, Timber with a Cobble roof, 4 Hobs (Lobber, Lobber, Scatterjack, Bouncer). Aim 2 | Defend a Cart. Cobble on a Rival fort | 1 Win. 2 Cart above 50% HP. 3 Beat the Rival before the Cart is home | 3 |
| 2-3 | Goat Track | ES | L. A switchback path up the crag in three steps. Rubble piles on the path. Two Outposts on spurs above | Bring the Pedlar Fort to the top flag | Cap 14. Three rubble piles (Loam, 40 cells) block the way. Sir Pudge mans the first Outpost | 2 Outposts (Lobber, Scatterjack). Aim 2 | Escort. Outposts. Butting Goats. Pedlar Tuppence. +Winkle (Lookout) | 1 Win. 2 Pedlar kettle above 60%. 3 Arrive by Round 10 | 4 |
| 2-6 | Crown of the Crag | KH | M. A mesa in the centre with a Loam ramp on each side. Pits at the foot of each ramp | Hold the mesa top | Cap 14. Ramps can be carved to slow the climb. Wind 0 to 4. Rockslide Rex rolls toward the lower fort [04 §5.1] | Cobble 5 x 5, 4 Hobs (Lobber, Digger, Bouncer, Patcher), 2 reserves. Aim 3 | King of the Hill. Long walks with 200 Steam | 1 Win. 2 Win by Round 10. 3 Rival scores 2 Crowns or fewer | 5 |
| 2-9 | Scree's Gate | SW | M. A narrow pass. You on a rock sill. Rivals come down a stepped road from the upper right, one step per wave | Beat 3 waves | Cap 18. Each wave starts one step lower and closer | Wave 1 Timber 4 x 4 (3 Hobs). Wave 2 Cobble 4 x 6 (4). Wave 3 Cobble 5 x 6 (4). Aim 2 to 3 | Survive Waves. Damage carries. +Petra (Digger) | 1 Win. 2 Kettle above 50% at the end. 3 Win by Round 14 | 5 |
| 3-3 | Ferry Cross | DC | L. A long pond. The Cart rides a raft from the right bank to your jetty. Two reed islets with Outposts. Rival fort on the far bank. Sir Pudge poles the raft | Bring the raft home | Raft drifts 110 cells per round. A blast in the water within 60 cells rocks it for 10 damage | Timber 5 x 5, 3 Hobs (Lobber, Scatterjack, Stoker) plus 2 Outposts (Zinger, Lobber). Aim 3 | Moving target on water. +Nurse Plumley (Patcher) | 1 Win. 2 Clear both Outposts. 3 Cart above 50% HP | 5 |
| 3-8 | Stilt Town | KH | M. One dry knoll in the centre of a mud flat. Sink Mud on the short ways up; a long firm ramp on each side | Hold the knoll | Cap 14. Mud costs x3 Steam [00 §2.14]. Sink Mud pulls forts down. Flattening Notice: from Round 4 the knoll is pressed 16 cells lower each round; mound shells undo it [04 §5.2] | Cobble barge-fort 5 x 5, 4 Hobs (Stoker, Lobber, Bouncer, Patcher), 2 reserves. Aim 3 | Sink Mud. Route choice under Steam limits. Raising ground, a first taste of region 6 | 1 Win. 2 Never touch Sink Mud. 3 Win by Round 11 | 6 |
| 3-9 | The Leaky Line | SW | M. You on a Clay dyke with water held back behind you. Barge forts come across open water from the right | Beat 3 waves | Cap 18. Barges float, so Dig cannot drop them. If the Rival breaches your dyke your low Nooks flood | Wave 1 Timber barge (4 Hobs). Wave 2 Cobble barge (4). Wave 3 two small barges with a shared Action (3 and 3). Aim 3 | Barge forts. Guarding ground, not only walls. +Walt (Stoker) | 1 Win. 2 The dyke holds. 3 No Hob of yours Bonked in waves 1 and 2 | 7 |
| 6-5 | The Long Flat Mile | ES | L. A bare plate road with no cover, two drains and one plate step. Big Ethel's lane runs beside the road | Bring the Hill Seed wagon to the far post | Cap 16. You must raise mounds for cover. Big Ethel flattens them every fourth round | Brassbound 6 x 6, 5 Hobs (Lobber, Zinger, Zinger, Scatterjack, Stoker) plus 2 Outposts. Aim 4 | Cover you make yourself | 1 Win. 2 Wagon kettle above 60%. 3 Arrive by Round 12 | 9 |
| 6-7 | Everyone's Hill | KH | M. Flat plate with a Hoisted Hill over the centre and a pit at each side | Hold the hill you make | Cap 15. No Hilltop zone until the hill is dropped. A Stamper over the centre slams every fourth round | Brassbound 6 x 6, 5 Hobs (Digger, Lobber, Bouncer, Zinger, Patcher), 2 reserves. Aim 4 | A Hilltop the player creates | 1 Win. 2 Drop the hill by Round 2. 3 Win by Round 12 | 8 |
| 6-9 | The Last Lump | SW | M. You on the last real hill in the Flats, far left. A trench, then open plate. Two Hoisted Hills overhead | Beat 4 waves | Cap 20. Before each wave one freed region sends a gift: a Tumblestone, a Rockfall, a Burp Vent, a Snow Drift. Sir Pudge is in wave 1 and gives up at once | Wave 1 Timber 4 x 4 (3). Wave 2 Cobble 5 x 6 (5). Wave 3 Brassbound 6 x 6 (5). Wave 4 Mossbrick-faced 6 x 7 (6). Aim 3 to 4 | Hazards as allies | 1 Win. 2 The Last Lump keeps over half its height. 3 No Hob of yours Bonked in waves 1 to 3 | 9 |

- **Jam Cart Road, the Escort Goat Track and the cart Ferry Cross** are Escort levels on launch regions. Escort ships in U2 with the Heights, which has its own two. These three could return as bonus Escort nodes.
- **Crown of the Crag, Stilt Town, Slippery Crown and Everyone's Hill** as King of the Hill are the optional Hilltop set for U3 (section 3.7).
- **The wave scripts** of Scree's Gate and the Leaky Line feed two Long Siege maps in U1. The wave versions of Blizzard Watch, Backfill and the Last Lump have no slot.
- **The Long Flat Mile** has no slot.
- **Tumblestone Lane** has no slot. Its lesson moved to Trial T1 and level 2-5.
- **Old Trials.** T6 Fog Horn (a target in a Fog Bank; one Lookout chalk fan, then one Lobber shot; sly goal: no Lookout shot) could return in U2 with the Lookout. T8 Hat Trick on Ice (a roller must cross Thin Ice, a jump and a ramp; sly goal: the ice must not break) could return in U2 as a swap for T9.

## Appendix B. Held level spec: Slippery Crown as King of the Hill `[U3, optional]`

This is the full spec from the last revision, kept for the Hilltop set. The U2 campaign level 5-6 uses the same map as a plain duel. The review found this level heavy: nine rules that exist only here [02 review §1.2]. Before it ships, cut it to four: the Hilltop, the slide, the Thin Ice and one beat hazard.

**Pitch.** One polished dome between two forts. Whoever stands on top at the bell scores. Ice makes the climb cheap and the stay hard.

```

                        [====]
                        iiiiii
                      ii######ii
                  ****##########i            RRRR
    YYYY      ******#############i           RRRR
    YYYY  ********::##############ii      ************
**************::::::##############::iiiiii::::::::::::
::::::::::::::::::::##############::~~~~~~::::::::::::
::::::::::::::::::::##############::~~~~~~::::::::::::
======================================================
0         300       600       900       1200      1500  (cells)
```

| Mark | Thing |
|---|---|
| YY | Your fort on a snow bench |
| `*` | Loose snow: your long ramp. Firm, slow, safe |
| i | Ice skin on the dome and its east face |
| [==] | The Hilltop zone, 180 cells wide, on the flat crown |
| ~ under i | The frozen tarn: Thin Ice over Water |
| RR | Rival Skater fort on the far bank |

**Setup.**

| Item | Value |
|---|---|
| Size | S, 1600 x 720 |
| Fort centre gap | about 1,250 |
| Round cap | 14. First to 5 Crowns |
| Wind | 6 to 8, Snowfall, changes at Rounds 4, 7, 10, 13 |
| Steam | 200 each [3.1]. Uphill on snow x2. On Ice x1 up and down |
| Slide rule | A fort that ends a Round on an Ice slope slides 30 cells downhill. The crown itself is level, so a fort wholly on it does not slide |
| Rival | Miss Twirl (Coward). A Skater fort, Brassbound frame with frost panels, 5 x 5. Hobs: Glazer (Stoker), Snowball Roller (Bouncer), Hedger (Lobber), Filler (Patcher). Aim 3. Two reserves |
| Hazards | Snow Drift on the lee side of the dome at each Weather Front (period 3). Thin Ice on the tarn. The Grumblenimbus [04 §5.1] |
| First turn | Player. The Rival gets +20 Steam [00 §2.2] |

**How it plays.**

- **The race.** Your ramp is 540 cells of snow, about 90 Steam at x2 uphill with the slope. The Rival's way is shorter, over the tarn and up the ice face, but it must stop on a slope at least once and so slides back 30. Both reach the crown around Round 3 or 4.
- **Staying up.** The zone is 180 cells and a fort is 80 to 128. A fort needs over half its Footing in the zone to score. Two forts do not fit, so it is one or the other.
- **Knocking off.** Three ways, all visible. Melt or blast the ice lip under the Rival's downhill Stompers so it stands on a slope and slides at Round end. Carve the snow under its uphill side so it drops below the zone. Or bury its Loopholes with the Snow Drift by shooting the drift loose at the right time.
- **The tarn.** If the Rival waits on the tarn, Fire or a Heavy blast breaks the ice: it sinks, is Soaked and cannot Walk for 2 rounds. It will try the same on you if you take the short way round.
- **Wind.** At 6 to 8, lobs to the crown drift up to 150 cells. The dome gives a wind shadow on its lee side, which swaps when the Front swaps. Waiting in the shadow is safe but scores nothing.
- **The Grumblenimbus.** A grumpy cloud drifts with the wind and zaps the tallest column on the map each round. That is nearly always whoever holds the crown. It glowers over its target a round ahead. A Fire shot makes it sneeze and jump 200 cells. So the hill pays Crowns and costs HP, and a short wide fort holds it better than a tall one.
- **The Glazer.** Its Polish Knack turns your snow ramp to Ice, so you slide too. Fire melts it back.
- **Reserves.** A popped Rival comes back in 2 rounds at the far bank. Popping it buys time on the hill, not the win.
- **Why boring the base fails.** The dome's core is Rock. And the goal is the zone, not the fort.

**Pennants.** 1 Win. 2 Win by Round 11. 3 Make the Rival slide off the zone twice.

**Checks.**

| Check | Result |
|---|---|
| Lump Rule | Hill between forts (the dome, 300 above your pad), water (tarn), height gap 60 (not counted), cliff on the east face: 3 of 5. Pass |
| Peak cap | Dome is Rock and Ice: 300 is under the 420 cap |
| Sightlines | Flat line blocked by the dome until a fort is on it. Lob line open. From the crown, flat lines open both ways: holding the hill makes you a target |
| Cover | Hard: dome core. Soft: snow ramp, drifts. Open: the crown and the tarn |
| Frame | Whole map fits at zoom 0.6 |
| Hazards | Two on the beat (Snow Drift, the Grumblenimbus), one reactive (Thin Ice). At the cap of rule 4.6 |
| Bot band | Late: 65% for the Regular proxy on Fair, low end of the band [04 §7.2] |
