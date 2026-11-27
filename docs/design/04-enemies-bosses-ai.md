# 04. Enemies, Bosses and AI

Status: edit pass 2, for owner review. Date: 2026-11-22. Owner of this doc: enemy and AI designer.

This doc builds on `00-core-game-design.md` (cited as `[00 §x]`). It fills in the Flatteners, the enemy crew, enemy castles, the Grand Forts, Baron Levelwell, mini-bosses, and the AI that drives every Rival.

**Binding rulings.** This pass applies `docs/review/04-rulings.md` (cited `[B4]`, `[C3]` and so on) and the rows of `docs/review/01-consistency-audit.md` (cited `[C31]`) where 04 is silent. Review 03 is the tech review (cited `[T §4.2]`).

**Cites.** Same scheme as `00`. Research files: `02` teardown, `02b` Castle Clashers deep dive, `02c` Pocket Tanks family, `02d` App Store study, `03` code and tech survey, `04r` tech stack (research `04`, to avoid a clash with this doc's number).

**Numbers.** Every number is a tuning target unless it says "fixed". Bots set the final values (section 7).

**Owners.** Unit stats and Hob rules belong to the units doc (`03`). Shot names and stats belong to the weapons doc (`01`). Level lists belong to the campaign doc (`05`). This doc names enemy units, behaviors and bosses, and owns the AI.

**Tags.** Every content item carries one tag: `[Launch]`, `[U1]` (Long Siege), `[U2]` (Nithering Heights), `[U3]` (Wheal Clank) [review 04 §A].

**Regions.** Launch: 1 Puddingstone Downs, 2 Crag End, 3 Soggy Bottom Fen, 4 The Flats. Updates: 5 Nithering Heights `[U2]`, 6 Wheal Clank `[U3]`. The Flats move up to Region 4 so the Baron ships at launch [review 04 §A].

---

## Changes in this revision

| # | Change | Why |
|---|---|---|
| 1 | Heartkettle 300 HP for every fort, bosses included. Phases gate bosses. The "raise to 400" note is gone. New rule: phase notches hold | [B4] |
| 2 | The final boss, The Last Level, is 2 Stages: the Grand Roller, then the Level Engine. Hill Call from the first Roller turn. A clan crate before the last phase. Retry from the Stage on every preset. The teacup stays | [B12] |
| 3 | Steward Prudence Plumb gets her own Flats level, The Square Gate, in place of Stage 1 | Review 02 §1.4 |
| 4 | Lieutenants and Grand Forts re-mapped to the 4-region launch. The Countess (Heights) and the Ironmaster (Mines) become `[U2]` and `[U3]`: "the wings that got away" | [review 04 §A] |
| 5 | 14 launch enemy unit types (13 that fire, plus the Dummy). The rest are tagged | Review 02 §5.3 |
| 6 | Every enemy unit fires a Knack from `01` or a Flattener Twist. Old enemy Knack names are retired | [C31] |
| 7 | Every Rival fort passes the Workshop validator. Archetypes have sizes that fit a covered Heartkettle. Enemy forts have 1 to 5 Nooks | [B3], [C05] |
| 8 | Rival rooms and Rival perks are defined (section 3.3), so `02`'s references point at something. Each Rival states one habit | [C56], [B17] |
| 9 | AI think target: p95 400 ms on the 2 GB phone for all presets, budget in work units, hidden by the 0.8 to 1.5 s think pose | [C3] |
| 10 | Anti Recall lock: the AI walks out of a bracket after being hit twice from the same aim | [B11] |
| 11 | Sudden Squall replaces Last Bell. New AI rules for the Squall | [B5] |
| 12 | Enemy crew Class icons stay shown. Hidden crew, enemy Lookouts and hidden-info AI tests move to `[U2]` | [B10] |
| 13 | No grey shells and no deny refund in the draft AI. Any Hob fires any shell | [B6] |
| 14 | Turncoats are Outfits. Grand Fort rewards: 500 + 25 per Pennant; the Last Level 1,000 + 25 per Pennant | [C32], [C59] |
| 15 | Bosses use the region's top Rival grade, not one above | [C74] |
| 16 | Buried Hobs never skip a turn. Gust Bellows no longer Tumbles a Hob | [B9], [C15], [C44] |
| 17 | Raid Rehearsal is a Test Yard button run by "the Drill Sergeant" | [B16], [C49] |
| 18 | Final verification pass: the Sudden Squall hits both sides at once at round end, and the AI's kettle race reads that way (6.14). Enemy forts have 1 to 5 Nooks (crew cap 5). "Reload" reads as Rest and "matching Class" as Match. The Keystone perk is now a Fork pick, since the tree has no keystones. 4 bench Knacks, as `01` lists. Knock-Knock numbers shown | Review 05 |
| 19 | **Shoring Crew to launch** (Region 2, Crag End, where falls are taught), **Silt Lobber to U1** (its mud mound repeated the Hedger's Loophole burial). Launch stays 14 types; U1 is +4 and U3 +4. Row numbers are ids and stay fixed when a unit moves | Review 06 U10 |
| 20 | The Great Sump's Mud Rafts carry a Plunger Pete, not a Silt Lobber | Review 06 U10 |
| 21 | **AI reads Lean Lines data:** its weak-point aim targets come from the same support query the player's Lean Lines use | Review 06 G5 |
| 22 | **AI respects Loophole Flap.** The hidden "one Thread on Fair" rule is gone. Cosy never Threads, as the preset table always said | Review 06 G6 |
| 23 | **AI uses Shove Off** (15 Steam in the Walk step) by the player's rule | Review 06 G7 |
| 24 | **The Rival shows one wish in the Rummage** (6.8) | Review 06 G9 |
| 25 | **Never loaded in Couch Duel**, not even for Quick Pick. The AI runs on its own thread over the shared Rust core (native thread on iOS and Android, Web Worker on web) | Review 06 G2, research 04b |

---

## Contents

1. The Flatteners
2. Enemy crew roster
3. Enemy castle archetypes, rooms and perks
4. Grand Forts and Baron Levelwell
5. Mini-bosses and special events
6. AI design
7. Testing and win-rate targets
8. Open questions
Appendix: Parked ideas

---

## 1. The Flatteners

### 1.1 Look

- Flatteners are Hobs, the same small, round folk as the player's clan. That keeps them silly, not scary, and lets the sim reuse every Hob rule [00 §2.9].
- They wear grey and cream uniforms with sharp ironed creases, white gloves and a flat cap pressed thin as a pancake. Rank shows as more creases.
- Each carries a tool of tidiness: a ruler, a spirit level, a rolling pin, a set square, a clipboard.
- Their forts are boxy, painted in neat stripes, with square windows and right-angle roofs. No domes, no lumps, no crooked chimneys. Their Stompers end in flat iron soles.
- Their banner is a plain level line on a grey field. The faction icon is a bubble level with the bubble dead centre.
- When Bonked, a Flattener floats away on a square Snooze Balloon, still trying to straighten its cap.
- Silhouette rule for the art doc: a Flattener reads at 24 px by the flat cap and the straight-edged tool. The player's Hobs have round or floppy hats. Never mix the two.

### 1.2 Motive

Baron Levelwell spilled his tea on a hill when he was small. The cup rolled away, then the saucer, then the cake. Since that day he has believed that hills cause all trouble: things roll off them, picnics tip, forts lean, maps are hard to fold. Flat land is tidy. Tidy land is good land.

So the Baron built rolling machines and gave each region to a lieutenant with orders to press it flat. The Flatteners are not cruel. They think they are helping. They fill in holes "for your safety", post "Keep Off the Lumps" signs, and send forms in triplicate before they flatten your hill.

The player's clan wants Brickabrac lumpy, odd and fun. Each Grand Fort we beat gives a region its hills back [00 §1.5].

### 1.3 Humor

- **Fussy, not mean.** Flatteners apologize for the mess they make. They measure craters after a hit. They tut at untidy blocks.
- **Paperwork.** Rivals hold up signs, stamp forms and file complaints. Battle start often shows a "Notice of Flattening" banner.
- **Straight lines.** They love right angles and hate curves. A Bouncer's bouncing ball upsets them more than damage does.
- **Running gags.** The Baron's tea. A clipboard that keeps getting knocked off a wall. The square Snooze Balloon. A Flattener who sweeps the debris back into a neat pile mid-battle.
- **Bloodless and kind.** No one is hurt. Bonked Flatteners float home grumpy. Beaten lieutenants change sides or retire to grow crooked gardens.

### 1.4 The lieutenants and their wings

Each region has one wing of the Flattener clan, led by one lieutenant. Regular Rivals in a region belong to that wing and copy its castle style, so a region feels like one opponent with many faces.

| Region | Wing | Lieutenant | Theme | Signature castle style | Personality | Tag |
|---|---|---|---|---|---|---|
| 1. Puddingstone Downs (grass hills, tutorial) | **Parks and Verges** | **Marshal Mowbray Trimm** | Lawn care. Hedges, mowers, rakes, topiary | Wicker and Timber boxes with clipped hedge caps; low, neat, symmetric | A fussy head gardener. Speaks in garden rules. Hates moles more than you. Easily flustered, never truly angry | `[Launch]` |
| 2. Crag End (cliffs) | **Steps and Slopes** | **Dame Enid Scree** | Quarry work. Sanding cliffs into steps, then into slopes, then into nothing | Tall Cobble towers set in cliff ledges; terraced like stairs; props and beams under ledges | A stern stonemason with sandpaper gloves. Proud of her craft, respects a good shot, says so | `[Launch]` |
| 3. Soggy Bottom Fen (water and mud) | **The Drainage Board** | **Admiral Dabney Sluice** | Pumping the fen dry to make it flat. Pumps, pipes, barges | Forts on barges and stilts; pipes on the outside; Timber hulls, Cobble pump rooms; moats | A soggy, cheerful naval type who has never been dry in his life. Loves a good splash. Sings on phase change | `[Launch]` |
| 4. The Flats (the Baron's rolled land) | **Weights and Measures** | **Steward Prudence Plumb**, the Baron's right hand | Perfect order. Rulers, plumb lines, measuring tape | Brassbound and Cobble squares, exact grid, mirrored on both sides; every Nook the same size (Mossbrick faces in `[U3]`) | Quiet, precise, polite. Corrects your grammar in taunts. Secretly likes a little lump | `[Launch]` |
| 5. Nithering Heights (ice, strong wind) | **The Rink Committee** | **Countess Glaze** | Ironing the snow into one flat rink. Skates, bellows, polish | Ice palaces on runners; thin spires; Brassbound frames with frost panels; wind bellows on the roof | Cool, elegant, vain about her rink. Scores your shots like a skating judge | `[U2]` |
| 6. Wheal Clank (caves, metal) | **The Stamp Office** | **Ironmaster Josiah Bolt** | Big presses that stamp ore and hills flat. Pistons, rails, rivets | Brassbound mill forts with shutters, rails and dynamo rooms; heavy, wide, lots of metal | Loud, gruff, deaf from the presses, so he shouts every line. Fair in his own way: he rings a bell before each big stamp | `[U3]` |

**The wings that got away** `[U2]` `[U3]`. When the Baron falls, two lieutenants refuse the peace. The Countess takes the Rink Committee up into the Heights. The Ironmaster takes the Stamp Office down into the Mines. "Flat is fair," they say, "and we are not finished." Each update opens with the clan's map showing one last grey patch, and a "Notice of Flattening" nailed to it.

**Baron Levelwell** leads them all. Look: a tall (for a Hob) Flattener in a long grey coat, the flattest cap in Brickabrac, a monocle shaped like a bubble level, a teacup always in hand. He rides **The Grand Roller**, a fort-sized rolling machine. Personality: pompous, tidy, sure he is right, and in the end a bit sad. In the epilogue he finds a hill is a nice place to sit and drink tea where you can see far. He keeps the cup on a saucer with a lip.

**Regular Rivals.** About 5 named Rivals per launch region (`05` lists them). Examples to set the tone: **Sir Pudge** (Region 1, level 1, lazy, naps between turns [00 §8.3]), **Lance Corporal Fernsby** (Region 1), **Flintwick the Lesser** (Region 2), **Bosun Gurgle** (Region 3), **Clerk Tally Evenhand** (Region 4), **Miss Twirl** (Region 5, `[U2]`), **Shift Boss Ratchet** (Region 6, `[U3]`). Every Rival is named AI and says so on its card [00 §3]. Every Rival card states one habit to build against (section 3.3) [B17].

---

## 2. Enemy crew roster

### 2.1 Rules for enemy crew

- Every enemy unit is a Flattener Hob built on one of the seven launch **Classes**, or the Lookout in `[U2]` [00 §2.9]. It uses that Class's Plain Shot and HP. The units doc owns Class stats.
- Each unit fires one Knack from `01 §3` (the 28 crew Knacks or the 4 bench Knacks), or one **Flattener Twist** from `01 §4.16` [C31]. The Knack does not have to be its own Class's. Old 04 Knack names are retired (Parked ideas).
- Enemy units obey every rule the player's Hobs obey: Rest, Cover, Tumble, Bonk, Footing, Steam, the dug-in rule. No hidden buffs. Exceptions: Rival Patchers never Puff Up [B9].
- Enemy crew may fire any Trick Shell the Rival drafted, with the same Match bonus as the player: Rest 0 and +10% [B6].
- **Show enemy crew** `[Launch]`: Class icons stay shown on every enemy Nook all battle. HP bars show once a unit is hit [B10].
- **Outfits.** After each Grand Fort, a Flattener Outfit (cap and tool) unlocks for one of your Hobs of a named Class. No new Hob joins [C32].
- "Tell" is what the player sees before the unit's big shot, so a loss reads as "I should have seen that" [02c §6].

### 2.2 Roster

**Launch count: 14 types** (13 that fire, plus the Dummy). All 7 launch Classes are covered. Later regions reuse earlier units, so Rivals mix wings.

**Region 1: Puddingstone Downs (Parks and Verges)**

| # | Name | Class | Look | Behavior | Knack | Weakness | Tag |
|---|---|---|---|---|---|---|---|
| 1 | **Hedger** | Lobber | Green apron, huge shears on its back, pancake cap with a leaf on top | Aims at the tallest column on your castle first ("Too tall!"). Steady, predictable | Twist **Topiary Drop**: a big hedge ball that leaves a Wicker bush block where it lands. A bush over your Loophole digs that Hob in [C15] | Slow high arc gives a long tell. Bush blocks are Wicker: one Fire shot clears them | `[Launch]` |
| 2 | **Raker** | Scatterjack | Lanky, rake held like a fan, leaves in its cap | Sprays your front wall. Likes Open Nooks | **Pepper Rain** (acorns) | Cover halves it. Wind blows it off course; it misses more on windy turns | `[Launch]` |
| 3 | **Clipboard Clerk** | Lookout | Spectacles, clipboard, pencil behind ear | Marks your Nooks, then the crew aims at what it marked | **Chalk Fan** | 80 HP. Bonk it first and the enemy loses future reveals | `[U2]` |
| 4 | **Mower** | Bouncer | Round, red-faced, pushes a toy mower on its Nook sill | Rolls shots down slopes into your Footing area. Loves downhill maps | Twist **Mow Line**: a roller that shaves small bumps flat, then bursts | Mud and sticky ground stop it. Uphill maps make it useless | `[Launch]` |
| 5 | **Dummy** | none (dummy) | A straw Flattener on a stick with a painted face | Does not fire. Sits in a Nook to soak shots. Tutorial and decoy unit | none | Shown as a dummy on every preset (honest). Burns in one Fire hit | `[Launch]` |

**Region 2: Crag End (Steps and Slopes)**

| # | Name | Class | Look | Behavior | Knack | Weakness | Tag |
|---|---|---|---|---|---|---|---|
| 6 | **Chiseler** | Digger | Goggles, hammer and chisel, dust on everything | Tunnels at the ground under your castle to cause a Thump | **Seed Potato** | Footing is immune to Dig [00 §2.8]. Rock ground stops it. Clay maps leave its tunnels open for your return fire | `[Launch]` |
| 7 | **Pitcher** | Zinger | Thin, a sling made from a measuring tape | Snipes Hobs in Open Nooks. Waits for a wall to fall, then strikes | **Darning Needle** (a gravel beam) | 80 HP. Pierce is weak on Cobble; a Cobble wall in front of a Nook blunts it | `[Launch]` |
| 8 | **Grit Spreader** | Scatterjack | Carries a sandbag on its back like a backpack | Sprays wide over roofs | **Clatterline** (bench) | Chip damage barely dents Cobble. Wasted against tall stone forts | `[U1]` |
| 9 | **Filler** | Patcher | Trowel, bucket of mortar, apron with a level line | Repairs its castle. Fills craters near its own fort so your Digger lanes close | Twist **Fill Up** | Bonk it first: every other unit gets easier. A mortar bucket icon shows over its Nook on turns it plans to repair | `[Launch]` |
| 27 | **Shoring Crew** | Patcher | Hard hat, a brace of props under its arm | Props up damaged blocks so they do not fall. Braces the column that holds its tallest tower | Twist **Prop Up** | Braced columns glow yellow. Bonk it and the braces drop at once (a free collapse): "Bonk the prop and the fort falls" | `[Launch]` |

**Region 3: Soggy Bottom Fen (The Drainage Board)**

| # | Name | Class | Look | Behavior | Knack | Weakness | Tag |
|---|---|---|---|---|---|---|---|
| 10 | **Pump Hand** | Stoker | Rubber boots, a stirrup pump, always damp | Soaks your castle, puts out your fires, turns the ground under you to Mud to drain your Steam | **Water Butt** | Water does nothing to Cobble or Brass. Walking out of the puddle beats it | `[Launch]` |
| 11 | **Plunger Pete** | Bouncer | Holds a giant sink plunger like a lance | Bounces plungers, then plunges straight down on a roof | **Pogo Pot** (bench): bounces straight up 4 times on one spot, breaking a layer each time | The plunger wobbles on the sill one turn before. A Brassbound roof holds it | `[Launch]` |
| 12 | **Dredger** | Digger | Diving helmet, flippers, snorkel | Digs under water and mud | **Corkscrew** (bench) | Water slows its bore. Footing and Rock stop it | `[U1]` |
| 13 | **Silt Lobber** | Lobber | Barrel-shaped, a bucket on a long pole | Lobs mud bombs. Likes to bury your Loopholes | **Molehill Surprise** (a mud mound) | Mud mounds are soft Loam: any blast clears them, and Shove Off clears one for 15 Steam. It must land at your castle face to bury a Loophole, so it misses a lot on high forts | `[U1]` |

**Region 4: The Flats (Weights and Measures)**

| # | Name | Class | Look | Behavior | Knack | Weakness | Tag |
|---|---|---|---|---|---|---|---|
| 14 | **Roller Guard** | Lobber | Rolling pin on the shoulder, very flat cap | Pounds the hill between castles flat, then pounds you | Twist **Press Flat** | Its first Knack each battle aims at terrain, not at you (tell: it unrolls a map). Mound shots undo its work | `[Launch]` |
| 15 | **Ruler Sniper** | Zinger | A long ruler for a rifle stock, square goggles | Fires dead straight lines; the best shot in the clan | **Knock-Knock** (bench): two bolts on one aim, 20 Pierce then 40, so the kettle clamp does not fire on every clean hit [01 §3.10] | It squares its goggles and takes two slow breaths before the Knack. A mound or a scrap wall blocks both bolts | `[Launch]` |
| 16 | **Level Surveyor** | Lookout | Tripod on its back, bubble-level monocle | Reveals and marks the "lumpiest" part of your castle | **Chalk Fan** | Walk and its old arcs stop lining up | `[U2]` |
| 17 | **Tamper** | Digger | Pogo stick with a flat foot | Stamps ground flat around your castle to remove your cover | Twist **Tamp Down** | Footing immune. Rock ground ignores it. Clay maps blunt it | `[Launch]` |
| 18 | **Steam Sweeper** | Stoker | Big brush, steam pipe on its back | Clears debris and Burns with hot steam (tidy habit) | **Boiled Over** | Fireproof forts ignore most of it. Water and Soaked blocks stop it | `[U1]` |
| 19 | **Clerk Major** | Patcher | Stacks of forms, a rubber stamp | Stamps "APPROVED" on its own blocks to repair them and "DENIED" on yours | Twist **Red Tape**: one of your Hobs needs a rest (Rest +1, within the cap of 1 extra) [B9] | Its stamp turns tell you which block it will fix. Fire burns the tape off | `[Launch]` |

**Region 5: Nithering Heights (The Rink Committee)** `[U2]`

| # | Name | Class | Look | Behavior | Knack | Weakness | Tag |
|---|---|---|---|---|---|---|---|
| 20 | **Glazer** | Stoker | Skates, a polishing cloth, frost on its cap | Turns ground to Ice so your castle slides when you Walk and rollers zoom at you | **Shiverpuff** | Fire melts its Ice to Water and ends the field. No effect on Footing | `[U2]` |
| 21 | **Gust Bellows** | Lookout | A tiny Hob behind a huge bellows | Changes next turn's wind. Shown on the forecast icon | Twist **Gust Puff** | No damage at all. The bellows sits outside its Nook: one hit breaks it, and Gust Puff is gone for the battle [C44] | `[U2]` |
| 22 | **Snowball Roller** | Bouncer | Bundled in scarves, pushing a snowball bigger than itself | Rolls snowballs down slopes | **Roly-Poly** | Uphill or flat ground keeps it small. Fire melts it mid-roll. A mound stops it | `[U2]` |
| 23 | **Icicle Zinger** | Zinger | Long icicle lance, cold blue nose | Snipes Hobs and cracks walls for a later big hit | **Darning Needle** | Its Plain Shot drifts in strong wind. A Patcher repair clears Brittle | `[U2]` |

**Region 6: Wheal Clank (The Stamp Office)** `[U3]`

| # | Name | Class | Look | Behavior | Knack | Weakness | Tag |
|---|---|---|---|---|---|---|---|
| 24 | **Rivet Gunner** | Scatterjack | Welding mask, a belt of rivets | Sprays rivets at your roof and Nook sills | **Pan Parade** (rivets) | Chip damage on Cobble and Brass is poor | `[U3]` |
| 25 | **Spark Fitter** | Zinger | Copper coat, wire for hair, crackles | Zaps Brassbound walls to chain damage through them | **Glimmerjolt** | Zap does x0.3 to Wicker, Timber and Cobble [00 §2.10]. A fort with no Brass laughs at it | `[U3]` |
| 26 | **Ore Dropper** | Lobber | Huge, a mine cart for a hat | Lobs heavy ore weights for collapse | **Anvil Bun** | Heavy: two safe turns after it fires. The cart hat tips when it loads (tell) | `[U3]` |
| 28 | **Lamp Lookout** | Lookout | Miner's lamp on its cap | Lights up your rooms for the whole crew | **Tattle Bell** | Smoke and dark Doodads hide from it. 80 HP | `[U3]` |

**Counts.** Launch 14: Hedger, Raker, Mower, Dummy, Chiseler, Pitcher, Filler, Shoring Crew, Pump Hand, Plunger Pete, Roller Guard, Ruler Sniper, Tamper, Clerk Major. U1 +4 (Grit Spreader, Dredger, Steam Sweeper, Silt Lobber). U2 +6 (four Heights units plus the Clipboard Clerk and Level Surveyor, who wait for the Lookout Class). U3 +4. 28 in all. The Baron is a boss, not a unit type.

**Flattener Twists.** `01 §4.16` owns their stats. Launch: Topiary Drop, Mow Line, Fill Up, Prop Up, Press Flat, Tamp Down, Red Tape, and the Baron's **Teatime** (Twist 9, [C31]). `[U2]`: Gust Puff. Twists stay enemy-only. Prop Up's brace uses the same sim rule as Hetty's Ridgepole [03], so both sides have a column holder.

---

## 3. Enemy castle archetypes, rooms and perks

### 3.1 The Workshop validator for Rival forts `[Launch]`

Every Rival fort, Outpost and Grand Fort body must pass the same Workshop validator as a player fort [B3], [C05]. Level data that fails the validator fails the build.

- **Grid.** The body fits the 8 x 10 grid (at most 8 wide, 10 tall) on a Footing row. Block Budget 72.
- **Covered Heartkettle.** The Kettle Room is 2 x 2 with a block on every outer side: left, right and top, with the Footing row or a block below. So the kettle never sits on an outer face.
- **Nooks.** 1 to 5 Nooks, each a 2 x 2 hollow with a block on all four sides. Never fewer Nooks than crew.
- **Outposts** pass the same check without a Kettle Room.
- **Rig Parts** (rollers, wheels, hulls, drums, presses) sit outside the grid. They are boss parts, not blocks.

**Size rule of thumb.** Walls are one block and may be shared. Rooms side by side need 3 columns each plus 1. Rooms stacked need 3 rows each, with the Footing as the first floor.

| Body | Rooms it holds |
|---|---|
| 4 x 3 | 1 (Kettle Room only) |
| 4 x 6 | 2, stacked |
| 4 x 9 | 3, stacked |
| 7 x 3 | 2, side by side |
| 7 x 6 | 4 |
| 7 x 9 | 6 |
| 8 wide | Same as 7, plus a spare column for a thicker face |

So the smallest Rival fort with a crew is 4 x 6 or 7 x 3 (Kettle Room plus 1 Nook). `05` sizes such as "4 x 4 with 2 Hobs" are hints; the archetype shape below wins [C05].

### 3.2 Archetypes

Each archetype is a layout pattern the level doc can reskin per wing. Each one teaches one lesson. `05` places them so lessons arrive one per level [00 §8.3].

| # | Archetype | Size and layout | What it teaches | First seen | Tag |
|---|---|---|---|---|---|
| 1 | **The Hedge Box** | 7 x 6. Wicker skin, Timber inside. Kettle Room low, 1 Nook beside it, up to 2 above. Small form: 4 x 6, kettle low, 1 Nook above | Basic aim; both win paths; Fire on wood | Region 1 | `[Launch]` |
| 2 | **The Beanpole** | 4 x 9 Timber tower. Kettle Room at the bottom, 2 Nooks stacked above | Hit the low support blocks and the top falls as one chunk [00 §2.7]. Collapse beats chip | Region 1 | `[Launch]` |
| 3 | **The Pancake** | 8 x 4: a solid base row, one band with the Kettle Room and 1 Nook, a flat Cobble roof. Later 8 x 7 with a second band (up to 3 Nooks) | Flat shots bounce off the long face; high lobs onto the roof work. The Flatteners' favorite shape | Region 1 | `[Launch]` |
| 4 | **The Onion** | 8 x 6. Wicker front column, Timber next, Kettle Room in the back of the low band wrapped in Cobble. Up to 3 Nooks | Peel in layers; pick the right damage type per layer | Region 2 | `[Launch]` |
| 5 | **The Ledge Perch** | 4 x 6 or 7 x 6 on a cliff ledge or stilts over a drop | Carve the ground under it for a Thump; Diggers and Blast on the cliff edge [00 §2.7] | Region 2 | `[Launch]` |
| 6 | **The Bait Box** | 7 x 9. Two outer Nooks with Dummys, up to 3 real crew deep inside | Read the icons. Dummies always show as dummies, so do not waste shots on them | Region 2 | `[Launch]` |
| 7 | **The Sump Pit** | 7 x 3 (kettle and 1 Nook) or 7 x 6, sunk in a pit so only the roof shows | Lobs and fluids that pool low [00 §2.7]; flat shots hit the pit lip | Region 3 | `[Launch]` |
| 8 | **The Moat Fort** | 7 x 6 Timber body, pumps on top, water moat in front | Fire does little near water; skippers cross water; Soaked rules | Region 3 | `[Launch]` |
| 9 | **The Twin Keeps** | A 4 x 6 keep (Kettle Room and 1 Nook) and a 4 x 6 Outpost tower (2 Nooks), joined by a Timber bridge | Choose your win path; break the bridge and the crew tower loses its link | Region 3 | `[Launch]` |
| 10 | **The Turtle** | 7 x 6, thick Cobble with a Brassbound core. Crew includes 2 Patchers (Filler, Clerk Major) | Bonk the healers first; burst damage in one turn beats slow chip | Region 4 | `[Launch]` |
| 11 | **The Square** | 7 x 9, Brassbound and Cobble, mirrored. The Kettle Room's twin room is a Nook. Up to 5 Nooks | Mirrored, even forts. Lumps you add (mounds) are the answer: "un-flatten to win" | Region 4 | `[Launch]` |
| 12 | **The Roller Box** | 8 x 4 low fort with a front ramp the Rival raises with mound shots | Ground can be added as well as removed; a fort can hide behind its own hill | Region 4 | `[Launch]` |
| 13 | **The Glass Spire** | 4 x 9 thin Brassbound frame with frost panels, high Nooks | Frost then Blast (Brittle x1.5); wind drift on high shots | Region 5 | `[U2]` |
| 14 | **The Skater** | 7 x 3 small fort that Walks every turn on Ice | Lead your shots; old pins go stale when a target moves | Region 5 | `[U2]` |
| 15 | **The Brass Net** | 7 x 6 Brassbound shell with all blocks touching | Zap chains through all of it [00 §2.8] | Region 6 | `[U3]` |
| 16 | **The Overhang Den** | 7 x 6 built under a Clay overhang, roof covered by ground | Bounce and roll shots in under the lip; Dig the overhang to drop it on the fort | Region 6 | `[U3]` |
| 17 | **The Moon Square** | The Square (11) with Mossbrick faces | Mossbrick heals a little each turn it is not hit [B1]: focus one spot | Region 6 | `[U3]` |

**Design rules for enemy castles**

- Every Rival fort passes the validator in 3.1.
- Every castle has at least one visible weak spot: an Open Nook, a thin wall near the kettle, a long unsupported span, or a cliff edge.
- Stone side support reaches 1 block [B2]. Tall stone forts are top heavy. That is a feature: a good low hit should drop about a third of a late fort.
- Every map with an archetype must pass the Lump Rule [00 §2.6].
- Region 4 castles are the most even and mirrored. Lumps the player adds (mounds and Hill Calls) are the answer.

### 3.3 Rival rooms, perks and habits `[Launch]`

This section answers `02`'s references to Rival rooms and Rival perks [C56].

**Rooms.** Rivals build the same rooms the player can. A Rival gets a room type only in the same release, and from the same region, in which the player can build it. Rooms are targets for both sides.

| Room | Archetypes that carry it | Rivals use it from | Tag |
|---|---|---|---|
| Nook, Kettle Room | All | Region 1 | `[Launch]` |
| Cushion Loft | Beanpole, Ledge Perch, The Square | The region after the player gets it (`02` sets when) | `[Launch]` |
| Lookout | Bait Box, Glass Spire | Region 5. It only matters with hidden crew | `[U2]` |
| Snug, Boiler Loft, Tool Shed, Decoy Kettle Room | Turtle (Snug), Roller Box and Skater (Boiler Loft), Pancake (Tool Shed), Bait Box (Decoy Kettle) | The release in which `02` ships each room | Follows `02` |

`02`'s level rows that name "a Rival with a Lookout room" and "Rival Snug and Boiler Loft" move with those rooms. If `02` keeps them out of launch, those rows move to the update levels.

**Perks.** Rivals do not use the Tinker Tree. A Rival may carry fixed perks that copy a player Tinker effect by name. The card lists them.

| Perk | Effect | Rivals may carry it from | Tag |
|---|---|---|---|
| **Bigger Boiler** | Steam cap +30 | Region 2 | `[Launch]` |
| **Fifth Hob** | Crew of 5 | Once the player can field 5 | `[Launch]` |
| **Braced Walls** | Its Blueprint uses Braces | Once the player has Braces | `[Launch]` |
| **Drilled Crew** | Its Hobs use Quirks at the region's rank (Rank 1 in Region 2, Rank 2 in Region 3, Rank 3 in Region 4) | Stubborn and Ironclad only, as now | `[Launch]` |
| **Fork pick** | One side of one Tinker fork the player can also own (for example Rubble Catch or Many Hands) | Region 3, once the player has Tier 2 | `[Launch]` |

Rules: at most 1 perk in Region 2, at most 2 from Region 3. No perk the player cannot also own. No perk changes aim. Perks never change during a battle.

**Habits.** Each Rival card states one habit to build against [B17]. The habit comes from its main personality (6.6), so it is true.

| Personality | Habit line on the card |
|---|---|
| Bully | "Hunts your weakest Hob." |
| Sniper | "Waits for an Open Nook, then pins it." |
| Builder | "Mends what you break." |
| Gambler | "Fires big shells early." |
| Coward | "Walks when you find its range." |
| Sapper | "Digs under your fort." |
| Tidy | "Shoots your tallest column." |
| Kettle Hunter | "Goes straight for your kettle." |

---

## 4. Grand Forts and Baron Levelwell

### 4.1 Boss rules (all Grand Forts)

These rules keep boss fights fair and readable.

1. **Same sim, more parts.** A Grand Fort is a normal castle plus **Rig Parts**: special blocks or attached objects with a script. Every Rig Part is data driven, runs on the deterministic sim, and fires its effects only at turn edges, never mid-flight. Replays and resume stay exact [00 §3, 04r §7].
2. **Rig Part kinds.**
   - **Weak Spot**: a glowing block. Hits on it deal bonus damage to a boss gauge or trigger a phase.
   - **Shield**: a barrier that blocks one damage type or all shots for a set time. Always drawn on screen with its type icon.
   - **Mover**: a part or the whole fort that moves along a rail a set number of cells each turn. Its next spot shows as a dotted outline.
   - **Terrain Script**: raises or lowers water, adds or removes ground in a marked zone.
   - **Summon**: puts a new Flattener Hob in an empty Nook or sends in an Outpost (a raft, a cart).
   - **Set Piece**: a big scripted shot. Always telegraphed at least one full player turn ahead with a target ring on the field (two turns on Cosy).
3. **Validator.** Every Grand Fort body and every summoned Outpost passes the validator (3.1). Rig Parts sit outside the grid.
4. **Phase triggers.** A phase starts when one of these is met: kettle HP under a notch, a Rig Part broken, Hobs left, or a round number. Each trigger shows on the boss bar as a notch.
5. **Notches hold.** The kettle cannot drop below the next notch until that phase has played at least one boss turn. Damage past the notch is banked as a cracked segment on the bar. It lands the moment the phase turn ends. A big hit is never wasted, and no phase is skipped [B4]. The one exception is the Sudden Squall: there notches do not hold, and a phase the kettle drops through is skipped, so every fight still ends within 3 rounds of the cap [00 §2.11].
6. **Phase turn.** When a phase starts, the boss spends its next turn changing (a short banner, skippable). It does not fire on that turn. The player gets a free beat to react.
7. **No backsliding.** A boss never heals its kettle above the last notch it passed.
8. **Kettle.** 300 HP, fixed, like every fort [B4]. Phases, not HP, make bosses last. Some phases add a shield in front of the kettle.
9. **Two ways to win stay open.** Every boss can be beaten by Clean Sweep or Kettle Pop. Summoned Hobs count while they stand. Phases may make one path harder, never impossible.
10. **Round cap.** Grand Forts use a cap of 18 to 20. The Last Level uses 12 per Stage [C71]. The Sudden Squall starts after the cap, as in any fight [00 §2.11], [B5].
11. **Boss aim.** Normal shots use the AI rules in section 6 at the region's top Rival grade [C74]. Set Pieces may use a tighter scripted error (table 6.13), only after their telegraph [00 §8.1].
12. **Rewards.** First clear: 500 Buttons + 25 per Pennant (the Last Level 1,000 + 25 per Pennant) [C59], up to 3 Pennants, one **Keepsake** for the Curio Shelf, one new Trick Shell in the player's Rummage pool, one Flattener **Outfit** [C32], and the region "un-flattens" on the map: hills rise.

### 4.2 Grand Fort 1: The Topiary Keep (Puddingstone Downs) `[Launch]`

- **Boss:** Marshal Mowbray Trimm. Personality: Builder with a Tidy streak (6.6).
- **Castle concept:** An 8 x 8 Timber fort shaped like a clipped hedge peacock. Hedge blocks (Timber skin, green) cover the walls; the tail fan is a Rig Part. A **Sprinkler Root** (Weak Spot) sits low at the back, feeding water to the hedges. Between the forts stands a gentle hill with a lawn roller parked on top.
- **Phase 1: Evergreen.** Every turn start, one broken hedge block regrows while the Sprinkler Root stands. Crew: 2 Hedgers, 1 Raker, 1 Mower.
  - Tell: green sparkles on the block that will regrow.
  - Counter: break the Sprinkler Root (it is low and Timber, so a Bouncer or Digger reaches it), or burn hedges, which stops regrowth on burning blocks.
- **Phase 2: Mowing Day** (kettle under 70% or Root broken). The Marshal releases **Little Ethel**, the lawn roller. It rolls 120 cells toward you each turn and shaves the hill flat as it goes. When the hill is gone, your castle loses its cover.
  - Tell: the roller's dotted path and the "Keep Off the Grass" sign it drops.
  - Counter: hit its boiler (Weak Spot on its back, 60 HP) to stop it, or raise a mound in its path; it cannot climb a mound taller than 32 cells.
- **Phase 3: The Big Snip** (kettle under 35%). Giant shears unfold from the roof. Set Piece: next turn they snip across the top 2 rows of your tallest column.
  - Tell: open shears and a red cut line over your castle for one full turn.
  - Counter: Walk out from under the line, or knock the shears' hinge (Weak Spot) with any point shot, which jams them for 2 turns.
- **How to win:** Break the Sprinkler Root early so damage sticks. Stop the roller before it flattens your cover. Kettle Pop is faster, but four small Hobs make Clean Sweep real.
- **Rewards:** Keepsake **Golden Shears**. Trick Shell: a hedge-growing shell (`01`). Outfit: Hedger cap and shears for a Lobber.

### 4.3 Grand Fort 2: The Sanding Stair (Crag End) `[Launch]`

- **Boss:** Dame Enid Scree. Personality: Sniper with a Sapper streak.
- **Castle concept:** A 7 x 10 Cobble tower built into a cliff with three ledges (high, middle, low). A great **Sanding Wheel** turns on the cliff face beside it. Three **Prop Beams** (Weak Spots, Timber) hold the tower's top section. Stone side support reaches 1 block, so the top is heavy [B2].
- **Phase 1: High Ledge.** The fort sits on the top ledge, far above you. Her Set Piece **Rockfall** shakes loose boulders from the cliff above your castle.
  - Tell: dust trickles over your castle for one turn, then rocks fall (crush damage on your roof).
  - Counter: Walk out of the dust zone, or have a roof of Cobble. Shots at the cliff edge under her ledge carve it away.
- **Phase 2: The Wheel Turns** (kettle under 70% or 1 Prop Beam broken). The fort rides a lift down to the middle ledge (Mover). The Sanding Wheel spins in front of the kettle side: shots that hit the wheel's rim glance off (Shield vs all shots on that face). The wheel's hub glows (Weak Spot): a direct hit stops it for 2 turns.
  - Summon: 1 Chiseler and 1 Filler appear in empty Nooks.
  - Tell: wheel sparks show its spin; the hub glows orange when it can be hit.
- **Phase 3: Down to Gravel** (kettle under 35%). The fort drops to the low ledge. The Wheel now sands the ridge between the forts, lowering it 16 cells each turn (Terrain Script). Your high ground melts away.
  - Tell: grit plume along the ridge, a level line drawn where the ground will stop.
  - Counter: the fort is now low and close: lob over it. Break all three Prop Beams and the top half of the tower falls onto its own Nooks (crush).
- **How to win:** Use Diggers and Blast on the cliff edge to Thump her ledges. Snipe the Prop Beams. Stop the wheel hub before Phase 3 to keep your ridge.
- **Rewards:** Keepsake **Chipped Chisel**. Trick Shell: a ledge-cutting bore. Outfit: Pitcher sling for a Zinger.

### 4.4 Grand Fort 3: The Great Sump (Soggy Bottom Fen) `[Launch]`

- **Boss:** Admiral Dabney Sluice. Personality: Gambler with a Builder streak.
- **Castle concept:** An 8 x 6 Timber and Cobble fort on a paddle-wheel barge. The hull is a Rig Part. Three **Pumps** (Weak Spots) stick out of the deck. The **Water Line** across the map is a Terrain Script that the pumps control.
- **Phase 1: Spray Curtain.** A wall of pumped water stands in front of the barge (Shield: shells pass with heavy drag, Fire goes out). Shots over the top of the curtain are not slowed.
  - Tell: the curtain's height mark shows on screen.
  - Counter: high lobs over it; or break any Pump, which drops the curtain by a third.
- **Phase 2: Drain Day** (2 Pumps broken or kettle under 65%). The Admiral reverses course and drains the fen. The Water Line drops 48 cells. Mud flats show under your castle: walking costs x3 [00 §2.14]. The barge now paddles 64 cells left or right each turn (Mover).
  - Summon: two **Mud Rafts**, each a 4 x 3 Outpost with one Plunger Pete. Bonking the Plunger Pete sinks the raft.
  - Tell: dotted outline of the barge's next spot. Rafts show their path.
- **Phase 3: High Tide** (kettle under 35%). The pumps run backward and flood. The Water Line rises 16 cells per turn toward your Footing. When it reaches your Nooks, your Hobs are Soaked: no Burn. (From `[U3]`, Soaked Hobs also take Zap x1.5 [C22].)
  - Tell: a tide mark on your castle where the water will be next turn.
  - Counter: break the last Pump to stop the flood. The barge also sits lower as the water drops back, which exposes its Kettle Room from the side.
- **How to win:** Break Pumps early, keep Fire for after the curtain falls, Walk before the mud traps you. Skipper shots shine on the open water.
- **Rewards:** Keepsake **Brass Bilge Bell**. Trick Shell: a skipping shell that splashes. Outfit: Pump Hand boots and pump for a Stoker.

### 4.5 The Square Gate: Steward Prudence Plumb (The Flats) `[Launch]`

The Steward is the Flats lieutenant. She gets her own level, not a Stage of the final fight [review 02 §1.4]. `05` places it; suggested 4-6, so 4-9 can stay a level with no new rule.

- **Type.** A lieutenant level with boss rules 4.1 (Rig Parts, notches, phase turn, telegraphs). Round cap 15. Normal level rewards plus Keepsake **Folded Ruler**.
- **Castle concept:** The Square (archetype 11), 7 x 9, a perfect Brassbound and Cobble gatehouse, mirrored, with a **Plumb Line** tower on top (Weak Spot) that hangs a weight over your fort. Personality: Sniper with a Tidy streak. Crew: 2 Ruler Snipers, 1 Clerk Major, 1 Roller Guard.
- **Phase 1: Measure Twice.** The Plumb Line tower drops a plumb bob over one of your Nooks. Set Piece: next turn it falls straight down for Heavy damage.
  - Tell: the bob swings over the target for a full turn.
  - Counter: Walk; or snap the line by hitting the tower top.
- **Phase 2: Cut Once** (kettle under 40%). The gate splits in two halves that slide apart (Mover), opening a lane to the kettle and giving the Steward two firing towers. Summon: 2 Ruler Snipers.
- **End:** At 0 kettle, the Steward bows, steps aside, and says "That was... rather lumpy. Well done." She joins the clan in the epilogue (an Outfit, no new Hob).
- `[U3]`: an Ironclad version swaps the faces to Mossbrick (The Moon Square).

### 4.6 Grand Fort 4: The Last Level (The Flats), with Baron Levelwell `[Launch]`

The Region 4 Grand Fort is the final battle of the launch game [00 §7.2]. It is one battle in **two Stages** [B12].

**Stage rules**

- **Stages.** Stage 1, the Grand Roller. Stage 2, the Level Engine. Each Stage is its own battle for the 8-minute rule, with a round cap of 12 [C71].
- **Hill Call** from the first Roller turn to the end [B12]. Each of your turns you may raise one Small mound on your half of the map. It does not cost the Action. It is a Stage rule, not a Doodad [C42]. At most 4 Hill Call mounds stand at once; a fifth removes the oldest. The HUD shows it as a big green button with a hill icon.
- **Between Stages.** Hobs keep their HP. Bonked Hobs return at 30 HP (the clan cheers them back). Your castle mends 50% of lost block HP. Steam refills to your Steam cap [C73]. Knacks reset.
- **Draft.** One Rummage covers the whole battle: pool 12, 5 picks each (`05` may tune).
- **Clan crate.** When Stage 2 reaches its last phase, the phase turn ends with a crate on a balloon from the freed regions. All your Knacks refill to 2 uses, and you pick 2 Trick Shells from 4 offered. The crate is a story beat; the Baron gets nothing.
- **Saves.** Autosave at each Stage start. A loss retries from the start of the current Stage on every preset [B12].

**Stage 1: The Grand Roller (Baron Levelwell, riding)**

- **Castle concept:** The Baron's 7 x 6 fort (Kettle Room and 3 Nooks) sits on a vast rolling drum. The drum is a Rig Part and the Mover: it rolls 96 cells toward you every turn and flattens all ground it passes over. Personality: Tidy with a Bully streak.
- **Phase 1: Rolling In.** Each turn the Roller advances. If it reaches the 300-cell mark from your castle, it stops and starts the Phase 3 crush early.
  - Tell: the dotted path and a "distance left" counter.
  - Counter: Hill Call mounds in its path (each mound 32 cells high stops it for one turn), or hit the **Drive Gear** (Weak Spot at the drum's hub) to stall it 2 turns.
- **Phase 2: Steam Pressure** (kettle under 65% or Drive Gear broken twice). The Roller vents steam: a Shield of steam clouds in front of the fort that blocks the preview (preview stops at the cloud edge, same rule for the AI) and burns Wicker. Summon: 2 Roller Guards.
  - Counter: Fire is useless here. A Water shot or any Large blast thins the cloud for 1 turn. (From `[U2]`, Frost condenses it for 2 turns.)
- **Phase 3: Flatten Everything** (kettle under 30%). Set Piece **The Great Press**: the drum lifts and slams, shaving every hill on the map to a flat line, starting from the Roller's side. Each slam moves the flat line 200 cells toward you.
  - Tell: the line glows and a big countdown shows over the drum.
  - Counter: keep raising hills with Hill Call; the higher your ground, the more slams it takes. Pop the kettle, or break the drum's **Boiler** (Weak Spot), to end the Stage.
- **End:** The Roller cracks and sinks. The Baron leaps out and runs to the Level Engine. His teacup survives.

**Stage 2: The Level Engine (Baron Levelwell, on foot)**

- **Castle concept:** A machine the size of a castle that presses all of Brickabrac flat from its centre. The Engine is a Rig Part. On top sits the Baron's own 7 x 6 fort (Kettle Room and 3 Nooks). The Baron is a Hob with 140 HP, class Lobber (boss units are exempt from the ±10 HP rule [C21]), Knack **Teatime**: a teapot lob that Burns and Soaks at once, a joke that still hurts. The Engine has 3 **Level Bubbles** (Weak Spots) in glass tubes on its face. Personality: Gambler with a Kettle-Hunter streak.
- **Phase 1: Calibrate.** Each Level Bubble drives one press arm. Each arm Set Piece hits a marked zone of your castle every 3 turns, staggered, so one arm swings each turn.
  - Tell: arm raised and target ring shown one turn ahead, every time.
  - Counter: break Bubbles to stop arms. The glass sits in Brassbound frames: point shots crack it. (From `[U2]`, Frost then Blast also works.)
- **Phase 2: Dead Level** (2 Bubbles broken or kettle under 60%). The Engine floods the map to make it one flat sheet of water. The Water Line rises 16 cells per turn (Terrain Script). The Engine's Shield over the kettle opens only while 2 or more hills stand taller than the water.
  - Tell: water rising markers; the kettle shield shows a hill counter "2 of 2".
  - Counter: keep raising hills with Hill Call. This is the core theme: you win by making Brickabrac lumpy again.
- **Clan crate** (see Stage rules), at the phase turn into Phase 3.
- **Phase 3: Last Cup** (kettle under 30%). The Baron climbs to the top Nook and fires everything. The Engine's armour falls away: no more shields. He spends his best shells; his aim stays his preset's [C74]. His Hobs are gone; Clean Sweep now means Bonking the Baron. Nooks around him are Brassbound, so focus fire.
  - Tell: he puts down his teacup. That is the only time he does.
  - Counter: the crate's fresh Knacks and two new shells, and the hills you raised.
- **End:** The Engine sputters and lets out one long, sad whistle. The hills of all Brickabrac pop back up. The Baron floats down on a square Snooze Balloon, lands on a new hill, and finds his tea does not spill if you hold it level. Credits roll over him sitting there.
- **Rewards:** Keepsake **The Baron's Teacup**. 1,000 Buttons + 25 per Pennant [C59]. Outfit: the Steward's tape and rule for a Zinger. Baron Rush and Ironclad tiers follow their update tags [00 §6].

### 4.7 Grand Fort 5: The Glidehall (Nithering Heights) `[U2]`

- **Boss:** Countess Glaze. Personality: Coward with a Sniper streak.
- **Castle concept:** An ice palace, 7 x 9 body, on long runners (Rig Part), on a frozen lake with a snow slope behind your castle. Two **Bellows Towers** (Weak Spots) on its wings blow wind. Frost panels on Brassbound frames.
- **Phase 1: The Gale.** The Bellows set the wind each turn, not each Weather Front. The forecast shows the next value one turn ahead. The palace glides with the wind 32 to 64 cells per turn (Mover).
  - Tell: forecast icon plus the palace's dotted next spot.
  - Counter: break a Bellows Tower and the wind drops to half; break both and wind returns to the level's normal front.
- **Phase 2: Mirror Frost** (both Bellows broken or kettle under 65%). A **Frost Shield** of ice blocks forms in front of the Kettle Room and re-forms each turn start. Fire melts it into water for one turn. Blast cracks it.
  - Summon: 1 Glazer, 1 Icicle Zinger.
  - Tell: frost creeps over the gap one turn before it closes.
- **Phase 3: Avalanche** (kettle under 35%). Set Piece: the Countess pulls a rope and a snow slab slides down the slope behind your castle, piling snow against your back wall and over low Loopholes.
  - Tell: cracks run across the slope for one full turn; a bell rings.
  - Counter: Walk forward off the slab's path, or blast the slope first so the slab breaks up small. Buried Hobs are dug in: their Fire button greys until any blast or a Digger clears the snow. No turn is skipped [B9], [C15].
- **How to win:** Lead your shots on the moving palace. Frost, then Blast on its glass panels. Keep a Fire shot for Phase 2.
- **Rewards:** Keepsake **Silver Skate**. Trick Shell: a gust shell. Outfit: Snowball Roller scarf for a Bouncer.

### 4.8 Grand Fort 6: The Stampmill (Wheal Clank) `[U3]`

- **Boss:** Ironmaster Josiah Bolt. Personality: Bully with a Gambler streak.
- **Castle concept:** An 8 x 6 Brassbound mill fort. Three piston **Stampers** (Rig Parts) hang over the ground between the forts. A rail line runs in front. Two **Dynamo Rooms** (Weak Spots) power the fort's shields. Steel shutters cover the Loopholes.
- **Phase 1: Shutters.** The Loopholes have shutters (Shield vs all shots on the Nook). They open on the boss's turn to fire and stay open through the player's next turn only if the Hob behind fired a Medium or Heavy shot.
  - Tell: open shutters glow; a shutter icon on each enemy Nook shows open or shut.
  - Counter: hit Nooks right after they fire big shots. Or ignore crew and go for the kettle.
- **Phase 2: Spark Dome** (kettle under 70% or round 6). The two Dynamos raise a Zap dome over the Kettle Room (Shield: blocks Blast and Pierce, lets Dig and Zap through). Ore carts roll in on the rail every 2 turns, each a 4 x 3 Outpost with one Ore Dropper (Summon).
  - Tell: humming dynamos, sparks along wires to the dome.
  - Counter: break both Dynamos (they sit low, under Brass: a Zap chain through the Brass reaches them). Or Dig under the dome.
- **Phase 3: Stamp** (kettle under 35%). Set Piece every 2 turns: a Stamper slams the ground in a marked zone. Ground there drops 16 cells, and a quake deals 5 to every Hob on both sides (fair: it hurts him too).
  - Tell: the Ironmaster rings a bell and shouts "STAMP!" one turn early; the zone glows.
  - Counter: Walk out of the zone. Hit a Stamper's piston (Weak Spot) to jam it for good. Jam all three and he loses his rhythm (and his temper).
- **How to win:** Time hits on open shutters. Zap through the Brass to the Dynamos. Avoid stamp zones.
- **Rewards:** Keepsake **Dented Bell**. Trick Shell: a chain-zap shell. Outfit: Shoring Crew hard hat for a Patcher.

**Count.** Four Grand Forts at launch, one per region [review 04 §A]. Two more come with the wings that got away.

---

## 5. Mini-bosses and special events

Mini-bosses appear at levels 5 or 6 of a region as a warm-up for the Grand Fort, and in Long Siege `[U1]`. Events are level modifiers `05` can drop into any level. All follow the boss rules in 4.1 (telegraphs, turn-edge effects, deterministic, notches hold).

### 5.1 Mini-bosses

| Name | Region | What it is | Mechanic | Tell | How to beat | Tag |
|---|---|---|---|---|---|---|
| **Big Ethel** | 1, 4 | A huge lawn roller with a tiny Flattener driver, rolling across the map between forts | Rolls 96 cells per turn from the far edge, flattening ground. If it reaches a castle, that castle takes a Thump and loses its cover hill. It does not care whose side it is on | Dotted path; driver honks | Hit the boiler on its back (Weak Spot, 120 HP). Mounds stop it for one turn. Steering it into the enemy is a valid trick | `[Launch]` |
| **Rockslide Rex** | 2 | A boulder with a cap that rolls downhill toward the lowest castle | Rolls each turn; big crush on contact | Dotted path | Break it into 4 smaller rocks with Blast; a mound diverts it | `[Launch]` |
| **The Tidy Balloon** | 2, 4 | A Flattener supply balloon drifting across the top of the map | Carries a Trick Shell crate. Whoever pops it gets the shell. The AI shoots at it too | Crate icon shows which shell is inside | A high Pierce or Scatterjack shot. Race the AI to it | `[Launch]` |
| **Sergeant Squeegee** | 3 | A huge mop-and-bucket walker that crosses the fen | Mops up all mud and water in its path, then dumps it as a Mud mound in front of the player's castle | Bucket fills as it walks | Tip the bucket (hit it) so the mud lands on the Flatteners' side | `[Launch]` |
| **The Ironing Board** | 4 | A flat flying platform with three Ruler Snipers on it | An Outpost that hovers over the middle of the map. No kettle; Bonk its crew to drop it | It tilts toward its next target | Lob onto it. Its underside is Wicker | `[Launch]` |
| **The Grumblenimbus** | 5 | A grumpy storm cloud with a face, drifting over the field | Each turn it strikes the tallest column on the map (either side). Rain Soaks a 6-block-wide area under it. Its strike is Blast in U2 and Zap from U3 | It drifts with the wind; it puffs up and glowers over its next target | Keep your castle shorter than the enemy's. Shoot it with Fire to make it "sneeze" and move 200 cells. Gust shells push it | `[U2]` |
| **The Mole Train** | 6 | A drilling train running under the ground on a hidden track | Every 2 turns it surfaces under one castle and lifts or drops ground by 16 cells | Dirt bulges where it will surface | Hit the drill head when it surfaces (Weak Spot) | `[U3]` |

### 5.2 Special events (level modifiers)

| Event | Effect | Counter or twist | Tag |
|---|---|---|---|
| **Weather Front: Gale** | Wind range 7 to 10 for the level | Beams and heavy shells shine; forecast always shown | `[Launch]` |
| **Paperwork Day** | Every 3 rounds, both sides must skip Walk ("Forms pending") | Pure flavor; tests static play | `[Launch]` |
| **Flattening Notice** | A Flattener crew presses the middle hill 16 cells lower each round from round 4 | Mound shots undo it; teaches the Region 4 theme early | `[Launch]` |
| **Tea Break** | At round 8 the Rival takes one turn off to drink tea (shown on its card) | Free turn for the player. Used once in Region 1 as a joke and a breather | `[Launch]` |
| **Moving Day** | The Rival's castle Walks every turn on a set path | Teaches leading shots | `[Launch]` |
| **Fog Bank** | Preview stops at the fog line for both sides; the AI's error is x1.3 into fog (same rule for the player) | Lookout chalk arcs stay visible through fog | `[U2]` |
| **Night Shift** | Enemy Nooks show only when lit | Fire shots light the area for one turn | `[U2]` |
| **Thaw** | Ice turns to water at round 6 | Castles on ice sink a step (Thump if over 48 cells) | `[U2]` |

---

## 6. AI design

### 6.1 Goals

From research, players hate AI that never misses [02c §3.5, 02d §2.6.1, 02 §3.3] and AI that wins by cheating [02c §5.12]. They like AI that "ranges in" and looks like it is learning [02 §3.3, 02c §5 lesson 12]. So:

1. **Same rules, same info.** The AI sees what the player sees and obeys Rest, Steam, Cover and the crew info rule: Class icons shown at launch, hidden crew in `[U2]` [B10].
2. **Misses like a person.** First shots miss. Misses land close enough to read. Each next shot narrows.
3. **Varies by behavior, not only aim.** Rivals differ in what they shoot at and why.
4. **Fast.** 0.8 to 1.5 s think pose on screen [00 §2.12]. Compute p95 under 400 ms on the 2 GB phone [C3].
5. **Deterministic.** Same seed and inputs give the same AI choice on every device, so replays, resume and the Daily Dust-up match [04r §7].
6. **Not in Couch Duel.** Couch Duel `[Launch]` has two human sides [00 §6.1]. The AI module is never loaded there, not for a side, not for Quick Pick (which picks at random within the pool rules) and not for a wish. Nightly bots that test Couch Duel use bot controllers in a test build only.

### 6.2 Architecture

The AI is a pipeline in the shared Rust core. It runs on its own thread (a native thread on iOS and Android, a Web Worker on web) that keeps a replica sim, fed the same commands as the main sim [T §1.13, 04b].

```
takeTurn(side):
  know   = buildKnowledge(side)             // only what this side may see
  plan   = choosePlan(know)                 // which Hob, which shot, which target, walk or not, doodad or not
  ideal  = solveAim(plan, know)             // best exact angle and power for that plan
  aim    = applyHumanError(ideal, plan, know)  // error model, section 6.4
  return Command{walk, hob, shot, aim}      // same command format as the player
```

**Step 1: Knowledge.** A read-only view built from public state: terrain, all blocks that are visible, wind and forecast, both castles' outer shapes, kettle glows (always visible [00 §2.10]), enemy Class icons (shown all battle at launch), HP bars of Hobs that were hit, its own pins and the player's pins. It never sees the player's drafted hand or live aim. In `[U2]` hidden-crew levels, hidden Nooks are "maybe a Hob here" with the last-known Class. This boundary is a code rule: the AI module cannot import the full world state. Tests check it (section 7.4).

**Step 2: Candidates.** For each usable (Hob, shot) pair:

- Pick **aim points**: each enemy Nook, the Kettle Room, weak structural points (blocks whose loss drops the most blocks under the support rule, found with the same **Lean Lines** query the player can run by holding a block [00 §2.4]; the AI gets no structure data the player cannot see), Rig Part Weak Spots, the ground under the enemy's Stompers (for Dig and Thump plans), and own blocks or Nooks (for repair and shield plans).
- **Loophole Flap.** A flapped player Loophole is not a Thread target until the front changes; a point shot aimed there is scored as a hit on the wall block. The AI never plans a Thread through a flap.
- For each aim point, sweep flight time `t` in 6 to 12 steps and solve angle and power in closed form with wind [03 §8.2]. Drop solutions out of range.
- For terrain-blocked aim points, fall back to a power bisect at a fixed angle [03 §8.3].
- Add the Walk options (6.9) and Doodad options (6.10) as extra candidates.

**Step 3: Simulate.** Run candidates, most likely first, through the real game sim on a copy-on-write copy of the world [T §1.1]: real gravity, wind, shell triggers, splits, bounces, digs, the damage model and the support rule. The full support-rule collapse runs only on the top 8 candidates. The rest use a cheap structure estimate. Work stops when the preset's work-unit budget is spent (6.11).

**Step 4: Robust score.** Each top candidate is re-run under 2 to 4 **jitter samples**, drawn from the AI's own error stream (6.4). The score is the mean plus a risk term (6.3). The AI picks shots that still work when it misses a little, as a person picks a "safe" target.

**Step 5: Choose.** Sort by score, ties broken by candidate index [T §1.13]. Apply the preset's shell choice rule (table 6.13). Refine the chosen aim by a local search of plus or minus 1 degree and 2% power.

**Step 6: Apply error** (6.4) and send the command. The command goes in the log; replays never rerun the AI. The AI never re-checks the result of its errored shot, so it cannot "fix" a miss it made on purpose.

### 6.3 Score function

For a simulated result `r`:

```
S = wHob   * HobDamage(r)          // expected damage to enemy Hobs, Cover applied
  + wBonk  * 150 * Bonks(r)
  + wKet   * 1.5 * KettleDamage(r) // kettle is worth more per HP than a Hob (300 HP, a whole win path)
  + wBlk   * BlockDamage(r) / 10
  + wFall  * (8 * BlocksDropped(r) + Crush(r))
  + wOpen  * 40 * NooksOrKettleOpened(r)   // blocks removed around a Nook or the Kettle Room
  + wDig   * 30 * LoopholesBuried(r)       // a dug-in player Hob cannot fire
  + wSee   * 40 * NooksRevealed(r)         // [U2] hidden crew only; 0 at launch
  + wFix   * OwnHPRestored(r) / 5
  + wFlat  * GroundRemovedAboveLevelLine(r) / 50   // the Flattener habit
  + wPart  * RigPartDamage(r)
  + wSkill * SkillFactor(shot)     // [00 §2.11] point shots and beams score higher for show-offs
  - wSelf  * 2 * OwnDamage(r)
  - wAmmo  * ShellValue(shot)      // the cost of using a Knack or Trick Shell now
  - wRel   * Rest(shot) * HobValue
  + 10000  * WinsNow(r)            // Kettle Pop or last Hob
  + wFocus * SameTargetAsLastTurn  // commits to a target, like a person
  + rRisk  * StdDev(S over jitter samples)
```

- **ShellValue** is high early, drops as the battle goes on, and drops to near 0 in the last 3 rounds and in Sudden Squall. Rivals do not die with unused Knacks.
- **Match Class.** A shell fired by its Match Class scores with Rest 0 and the +10% bonus [B6].
- **wDig** uses each personality's wOpen weight. A burial is worth half when the player has 15 or more Steam, since Shove Off clears it without the Action.
- **Threat.** Stubborn and Ironclad add `wThreat * ThreatRemoved(r)`: the expected damage the Bonked or dug-in player Hob would have dealt next turn.
- **Lethal check.** If any candidate's mean result wins now, the AI takes it, on every preset. A person would too. Error still applies.

### 6.4 Aim error: misses like a person

Each AI side keeps a small aim memory per target: an **offset** `b` (angle and power) that stands for "how wrong my aim is right now".

```
first shot at a target:     b0 = Normal(0, sigma0)            // per preset, section 6.13
after each shot, the AI reads its own pin (same pin the player sees) and corrects:
  c      = Uniform(cLow, cHigh)      // how much of the error it fixes this time
  b(n+1) = (1 - c) * b(n) + Normal(0, sigmaFloor)
aim     = ideal + b
clamp |b| <= 2.5 * sigma0
```

- With `c` around 0.5 the error halves each shot, matching the bracketing rule in `00 §8.1`. Because `c` can go above 1 (overcorrect), the AI sometimes lands short, then long, then hits. That is how people bracket [02c §5 lesson 12].
- `sigmaFloor` keeps a little wobble forever. No preset reaches zero error outside boss Set Pieces [00 §3].
- **Power error matters most.** At typical castle gaps, 1% power error moves the impact about 2% of range (25 to 35 cells, about 2 blocks). The power sigma and floor are tuned so a Fair AI on its 3rd shot still misses a single Nook about 40% of the time.
- **No Recall for the AI.** The AI re-solves its aim each turn through its offset memory. Pin fade [B11] is a player-side rule that `07` owns.
- The AI draws all errors from its own `ai.<side>` stream in a fixed order, however many candidates it sims [T §1.13].

**What resets the memory**

| Event | Effect on offset |
|---|---|
| New target on the same castle (aim point moved more than 3 blocks) | `b` grows back to `k_same x sigma0` (it "knows the range", not the spot) |
| Target castle Walked | Add the walk distance as a range error, scaled by `k_walk` |
| Own castle Walked | Grow `b` to 60% of `sigma0` |
| Wind changed (new front, gust, or Sudden Squall step) | Add `windSkill x delta wind` degrees of fresh error |
| Different shell (different gravity or wind factor) | Grow `b` to 70% of `sigma0`, unless the shells fly alike |
| Line of sight to the impact pin lost (fog, smoke) | No correction that turn (`c = 0`) |

**Wind use.** The ideal aim accounts for wind at the preset's wind factor (Cosy 50%). That is a bias, so the Cosy AI misses downwind in a steady way, which a player can read.

**Rival aim grade.** Each Rival card shows "Aim N of 5" [00 §3]. Grade 3 uses the preset's table values. Grades scale `sigma0` and `sigmaFloor`: grade 1 x1.4, grade 2 x1.2, grade 4 x0.85, grade 5 x0.7. The card's number is honest.

**Learning speed.** Grade 1 and 2 Rivals find their range slowly (they fix 45% and 70% of the usual share each shot). On Stubborn the same Rival learns one grade faster (70% and 100%): it starts as wide as its card says, then closes in quicker. A new aim point within 3 blocks of one it already fired at keeps what it learned there. When the no-self-harm redraw halves an error, the halved error is what it remembers.

### 6.5 The fair miss policy

1. **No miracle first shots.** On a new target, the chance of a direct hit on a Nook is capped by preset (table 6.13). Bots check it (section 7).
2. **Readable misses.** A miss lands within 2.5 sigma of the ideal (the clamp). No wild shots into the sky or behind the AI's own fort.
3. **No self-harm by error.** If the errored shot would hit the AI's own castle, it redraws the error once. If the redraw also self-hits, it fires anyway (people do that too). Gamblers skip the redraw.
4. **Misses still do something.** The candidate search prefers aim points where a near miss still damages blocks. This matches the "near misses still count" rule [00 §9.3].
5. **Never a fake miss.** The AI does not aim off on purpose at a lethal shot to be nice, then hit perfectly the next. Mercy, if any, works through target and shell choice, never through hidden aim changes (6.12).
6. **Visible learning.** Its pins stay on screen like the player's, so the player can watch it range in.
7. **Same luck.** Shells with random parts use the same seeded sim RNG for both sides.
8. **Threads follow Loophole Flap, in the open.** On every preset the AI obeys the same flap rule as the player: after a Thread passes a Loophole, no Thread passes it until the Weather Front changes [00 §2.10]. The old hidden "one Thread per battle on Fair" cap is gone. Cosy never Threads, as the preset table shows on the Rival card.

### 6.6 Personalities

A personality is a set of score weights plus a few habits. Each Rival blends a main and a second personality, 70/30. Lieutenants use their own blends (section 4). The main personality sets the habit line on the Rival card (3.3).

| Weight | Bully | Sniper | Builder | Gambler | Coward | Sapper | Tidy | Kettle Hunter |
|---|---|---|---|---|---|---|---|---|
| wHob | 1.6 | 1.5 | 0.8 | 1.0 | 1.0 | 0.7 | 0.8 | 0.6 |
| wBonk | 2.0 | 1.6 | 0.8 | 1.0 | 1.2 | 0.8 | 0.8 | 0.6 |
| wKet | 0.5 | 0.7 | 0.8 | 1.2 | 0.8 | 1.0 | 0.8 | 2.0 |
| wBlk | 0.6 | 0.3 | 1.0 | 1.0 | 0.6 | 1.0 | 1.3 | 1.0 |
| wFall | 0.8 | 0.4 | 0.8 | 1.6 | 0.6 | 1.6 | 1.2 | 1.0 |
| wOpen | 1.0 | 1.2 | 0.8 | 0.8 | 0.6 | 1.0 | 0.8 | 1.6 |
| wSee `[U2]` | 0.5 | 1.5 | 0.5 | 0.3 | 0.8 | 0.6 | 0.6 | 0.4 |
| wFix | 0.3 | 0.4 | 2.0 | 0.3 | 1.5 | 0.4 | 1.2 | 0.5 |
| wFlat | 0 | 0 | 0.2 | 0 | 0 | 0.5 | 1.5 | 0 |
| wSkill | 0.2 | 1.2 | 0 | 0.6 | 0 | 0 | 0.4 | 0 |
| wSelf | 1.0 | 1.0 | 2.0 | 0.4 | 3.0 | 1.0 | 1.5 | 1.0 |
| wAmmo | 1.0 | 1.0 | 1.2 | 0.3 | 1.4 | 1.0 | 1.0 | 0.8 |
| wFocus | 1.5 | 1.0 | 0.5 | 0.2 | 0.5 | 1.0 | 0.8 | 1.2 |
| rRisk | 0 | -0.3 | -0.5 | +0.8 | -0.8 | 0 | -0.2 | 0 |

**Habits**

- **Bully.** Picks the lowest-HP Hob it can hit and keeps hitting it. Barks when it Bonks. Easy to read, so easy to bait: put a tough Hob in an Open Nook.
- **Sniper.** Prefers Pierce and beams. Spends early turns opening Nook walls (and revealing Nooks in `[U2]`). Waits for walls to open. Weak to thick Cobble faces.
- **Builder.** Repairs when its exposure rises. Rebuilds walls in front of Nooks you hit. Slow to win, hard to finish; best beaten with burst damage in one turn.
- **Gambler.** Loves Heavy shells, splits and bank shots. High variance: big swings both ways. Spends Trick Shells fast, so it runs dry late.
- **Coward.** Walks away from the player's bracketing (6.9). Uses defensive Doodads. Targets the Hob that threatens it most.
- **Sapper.** Digs under the player's castle, drops ground for Thumps, cuts cliffs, buries Loopholes. Weak on Rock maps and against high Footing forts.
- **Tidy** (Flattener special). Shoots the tallest column of the player's castle ("height tax": +20% on blocks in the top row). Flattens the hill between forts when it has a terrain shot. Repairs crooked damage on its own fort.
- **Kettle Hunter.** Opens a lane to the kettle and keeps pushing it. Ignores crew unless a Hob threatens a win.
- **Reckless** (`habit_id: reckless`, a Gambler in play). Takes the biggest blast in the Rummage, spends Trick Shells fast, fires from its top three ideas instead of the best one, aims a quarter wider, and skips the no-self-harm redraw. Big swings both ways. Sergeant Posy Rake plays it on 1-8.

### 6.7 Weapon choice smarts

The score function does most of the work, because shells are simulated, not guessed. These rules add judgment on top:

| Rule | Detail | Presets |
|---|---|---|
| Material match | Fire on Wicker and Timber; skip Fire near water or Soaked blocks [00 §2.10]. Frost then Blast on Brittle-prone targets `[U2]`. Zap on Brass `[U3]` | All (Cosy ignores 50% of the time) |
| Match Class | Prefer to give a shell to its Match Class (Rest 0) when that Hob is free | Fair and up |
| Rest spread | Never leave fewer than 2 Hobs able to fire next turn if it can help it. Lower score for a Heavy shot when 2 Hobs already rest | Fair and up |
| Knack saving | Keep at least one Knack until a target is Open, unless in the last 3 rounds or Sudden Squall | Fair and up |
| Beam in wind | Prefer beams and low wind-factor shots when wind is 6 or more | Fair and up |
| Combo planning | Plan two-turn combos. Launch: open a Nook wall now, splash or thread it next; dig a lane now, pin through it next; Soak a burning fort's neighbor to stop your own fire spreading. `[U2]` Frost now, Blast next. `[U3]` Soak now, Zap next | Ironclad (Stubborn: the first launch combo only) |
| Counter-aware | If the player drafted a counter (a shield shell, a repair), the AI pushes damage before it can be used | Stubborn and up |
| Dud handling | The AI never fires a Dud, except the Gambler on Cosy, as a gag once per battle (it says so) | All |
| No overkill | Lower score for shells whose damage is mostly beyond a target's remaining HP when a cheaper shot also finishes it | Fair and up |

### 6.8 Rummage draft AI

The AI drafts against the player from the same pool [00 §2.15].

```
for each shell s in pool:
  own  = useValue(s, myCrew, theirCastle)     // expected damage vs their materials, Match bonus, personality fit
  deny = useValue(s, theirCrew, myCastle)     // how much the player could hurt me with it
  pickScore(s) = own + dDeny * deny + synergy(s, myHand)
```

- Any Hob may fire any shell, so every shell has use. A shell whose Match Class is in the crew scores higher [B6].
- `useValue` is a cheap table lookup: shell group, damage type, blast band, the enemy castle's material mix, Match Class present. No sim runs during the draft. It takes under 5 ms.
- `synergy` adds value for pairs (a Heavy Blast plus a wall opener; a mound shot plus a roller) on Ironclad only.
- `dDeny` by preset: Cosy 0, Fair 0.3, Stubborn 0.6, Ironclad 0.8.
- Pick rule by preset: Cosy random of best 4, Fair random of best 2, Stubborn best, Ironclad best with synergy [00 §8.1].
- Personality bias: Gambler +30% to Heavy shells, Builder +30% to builder and shield shells, Sniper +30% to beams and guided shells, Tidy +30% to shells that flatten.
- No deny refunds [B6].
- **The wish** [00 §2.15, review 06 G9]. Before the first pick, the Rival glances at its top `pickScore` shell for half a second and pins it: "I want that one." The pin is true: it is the shell it would take first. If the player takes it, the Rival says so ("Hmph. That was mine."). Cosy and Fair always show the wish. Stubborn shows it on half its battles and Ironclad never; the Rival card says "plays its cards close" when it hides it. Its line names why when it can ("Mine. You have two Bouncers.").
- The AI's pick shows with a short line ("Mine now. Tidy.") and a 0.5 s pause, so the draft reads like a duel, not a menu.
- **Quick Pick** for the player runs this draft AI at Fair, with the player's crew, and never takes a Dud for the player [C77].

### 6.9 How the AI uses Walk

Walk costs Steam and the AI has the same Steam as the player, max 40 per turn [00 §2.14]. It plans a Walk only when there is a reason:

| Trigger | Walk plan | Who |
|---|---|---|
| No candidate with a clear line (terrain blocks every arc) | Try walk offsets of -40, -20, +20, +40 Steam worth, pick the best with a fresh candidate search (half budget) | All presets |
| **Hit twice from the same aim** [B11] | The player's last two shots used the same aim (within 0.5 degrees and 1 power) and both hit this fort. Walk 20 to 40 Steam worth before firing, in the direction that best breaks the range | All presets, all personalities |
| Player is bracketing it (last two player pins within 3 blocks either side) | Walk 20 to 40 Steam away; the player's next shot needs a new range | Coward on Fair and up; all personalities on Ironclad |
| Standing in mud, a pool or a fire zone | Walk out | Fair and up |
| Its best candidate needs a dug-in Hob | **Shove Off** for 15 Steam in the Walk step, then fire that Hob [00 §2.7]. Scored as a normal candidate with 15 Steam spent | All presets (Cosy at random, 50%) |
| A Set Piece or event ring covers its castle | Walk out of the ring (bosses only walk if their fort can) | All |
| A better angle over a hill (score gain over 20%) | Walk toward it | Stubborn and up |

- **Steam reserve.** The AI keeps at least 30 Steam so it can answer a same-aim lock and make late dodges. The Gambler spends freely, but keeps 20 for the same-aim rule. No reserve in Sudden Squall.
- If it has no Steam for the same-aim walk, it scores a Doodad or a repair on the hit spot higher instead.
- The Walk bar shows the AI's walk like the player's, so the player sees it happen.
- The AI never walks after it fires [00 §2.2].

### 6.10 How the AI uses Doodads

Doodads cost the Action [00 §2.15], so they compete with shots in the score. Each Doodad role has a trigger that adds it as a candidate. `01` names the Doodads and picks the 8 at launch; this doc uses their roles.

| Doodad role | Trigger | Score idea |
|---|---|---|
| Repair | A wall in front of the kettle or a Nook is under 30% HP | Value of the HP restored x the threat on that spot |
| Shield | The player's last pin landed within 1 block of a Nook or the Kettle Room | Expected damage blocked next turn |
| Smoke or cover | A player Zinger has a clear line to one of its Nooks (and, in `[U2]`, the player has revealed 2 or more of its Nooks) | Value of breaking that line for 2 turns |
| Steam boost | Steam under 20 and a Walk trigger is active | Value of the Walk it enables |
| Gust or wind | The player's last shell was a long arc | Damage expected to be lost by the player |

- Cosy uses Doodads at random when a trigger fires (50%). Fair uses them by score. Stubborn and Ironclad also hold one Doodad for a phase change or the last 3 rounds.

### 6.11 Think time budget

- **Budget in work units, not milliseconds** [C3], [T §1.13]. A time cutoff would make the AI choose differently on fast and slow devices and break replays and the Daily Dust-up. Each preset has a fixed unit budget, the same on every device.
- **What a unit is.** 1 unit = 1 actor-step at the 120 Hz sim clock [C2]. Carving costs cells / 64. A support solve costs 200. A cluster shell costs what it really costs. An average candidate sim is about 600 units (a lob about 360; clusters and rollers 1k to 3k; beams about 50) [T §4.2].
- **Budget.** Cosy 48k, Fair 96k, Stubborn 144k, Ironclad 192k units per turn, plus fixed overhead (knowledge view, closed-form solves, 8 support solves, draft and Doodad scoring) [T §4.2].
- **Target.** p95 under 400 ms of compute on the 2 GB low-end phone for every preset [C3]. Expected: Ironclad about 300 to 350 ms on that phone, Fair about 150 ms, under 100 ms on a mid phone.
- **Show time.** The AI holds a "thinking" pose for at least 0.8 s and at most 1.5 s [00 §2.12]. Compute ends inside the pose, so the player never waits on it. If compute ends early, the pose fills the rest (scratching its cap, checking a clipboard). If a very slow device runs long, the pose simply lasts longer; the result is still the same.
- **Order of work.** Cheap closed-form solves first, then sims ranked by a quick estimate, so the most likely winners are simulated first.
- **If over budget** in testing: cut the jitter stage first, then use cheaper quick estimates. Never make the budget time based [T §6].
- **Battery mode** [00 §8.2] does not change the budget (determinism); it only lowers render cost.
- **Planning during the player's turn** is not used. It would read the player's live aim.
- **Resolve.** Any AI shot resolves in at most 4 s. 2x speed is on by default for Rival turns after Region 1 [review 02 §3.3].

### 6.12 Rubber-band rules

**No hidden rubber band. Ever.** The AI never gets better or worse aim, more HP or new shells because the score is close or lopsided. Players spot it and hate it [02c §5.12]. What we allow:

1. **Sporting rule (Cosy and Fair only, shown on the Rival card as a "Sporting" ribbon).** When the AI leads by 2 or more Hobs standing, its target choice shifts: wFocus drops to 0 and wKet rises, so it spreads damage instead of chain-Bonking the player's last Hobs. Aim error is untouched.
2. **Retry help (opt-in).** After 2 losses on the same level, the result card offers a hint (which personality, which weakness) and the assist toggles [00 §8.1]. The game never changes the AI behind the player's back.
3. **Onboarding fail-safe** [00 §8.3] lives on the player side (longer preview), not on the AI.

### 6.13 Per-preset tuning tables

**Aim (grade 3 Rival).** The first-shot and bracket values are from `00 §8.1`.

| Knob | Cosy | Fair | Stubborn | Ironclad |
|---|---|---|---|---|
| Angle sigma0 (deg) | 5 | 3 | 1.5 | 0.8 |
| Power sigma0 (%) | 10 | 6 | 3 | 1.5 |
| Mean correction c (error kept per shot) | 0.25 (x0.75) | 0.5 (x0.5) | 0.5 (x0.5) | 0.6 (x0.4) |
| c range | 0.10 to 0.40 | 0.30 to 1.10 | 0.35 to 0.95 | 0.45 to 0.80 |
| Angle floor (deg) | 1.5 | 0.6 | 0.3 | 0.15 |
| Power floor (%) | 3 | 1.2 | 0.6 | 0.3 |
| k_same (new spot, same castle) | 1.0 | 0.8 | 0.6 | 0.5 |
| k_walk (per 32 cells walked, x sigma0) | 0.6 | 0.4 | 0.3 | 0.2 |
| windSkill (deg per wind point changed) | 0.5 | 0.3 | 0.15 | 0.1 |
| Wind compensation | 50% | 100% | 100% | 100% |
| Boss Set Piece angle sigma (after telegraph) | 1.5 | 0.8 | 0.5 | 0.4 |
| Set Piece telegraph (player turns) | 2 | 1 | 1 | 1 |

**Outcome targets** (what bots must measure, section 7):

| Target | Cosy | Fair | Stubborn | Ironclad |
|---|---|---|---|---|
| Direct Nook hit, first shot at a new target | 5% or less | 15% or less [00 §3] | 30% or less | 45% or less |
| Hit the same Nook by the 3rd shot (no walks) | about 30% | about 60% | about 80% | about 90% |
| AI shots that touch nothing at all | under 35% | under 25% | under 15% | under 10% |

**Brain**

| Knob | Cosy | Fair | Stubborn | Ironclad |
|---|---|---|---|---|
| Work units per turn (fixed) | 48k | 96k | 144k | 192k |
| About how many average sims | 80 | 160 | 240 | 320 |
| Jitter samples per top candidate | 2 | 3 | 4 | 4 |
| Shell choice | random of best 4 | random of best 2 | best | best plus combos |
| Own safety (wSelf multiplier) | 0 | 1.0 | 1.0 | 1.2 |
| Threat term (wThreat) | 0 | 0 | 0.8 | 1.2 |
| Combo planning | no | no | first launch combo | full |
| Walk use | blocked, same-aim | blocked, same-aim, bracketed (Coward), hazard | plus angle seeking | plus dodge for all personalities |
| Doodad use | random on trigger (50%) | by score | by score, holds 1 | by score, holds 1, times phases |
| Knack saving | no | yes | yes | yes |
| Threads | never | Loophole Flap rule | Loophole Flap rule | Loophole Flap rule |
| Draft deny weight dDeny | 0 | 0.3 | 0.6 | 0.8 |
| Sporting rule | on | on | off | off |
| Enemy crew info for AI | same as player rule | same | same | same |

**Mood.** Rival aim grade ranges by preset: Cosy campaign Rivals are grade 1 to 2, Fair 2 to 4, Stubborn 3 to 4, Ironclad 4 to 5. Grand Fort bosses use the region's top Rival grade. Bosses get hard through phases, not aim [C74].

### 6.14 Sudden Squall behavior `[Launch]`

Sudden Squall replaces Last Bell [B5]. After the round cap, the wind steps up at each Squall round start, and at each Squall round end the Squall takes HP from both kettles and all blocks at once, so any fight ends within 3 rounds [00 §2.11]. If both kettles pop on the same hit, the side with more total HP left (kettle, Hobs and blocks) wins. The AI plays it as a person would: spend everything, go for the finish.

- **Forecast in the sim.** Candidate sims apply the next round-end Squall hit to both sides (kettle and block HP loss) and the next wind step before they score, so the AI sees which blocks will fall on their own.
- **Kettle race.** The AI compares kettles under the Squall, and on a tie compares total HP as the double-pop rule does. If the player wins the race even with no more hits, the AI goes all in on the player's kettle and Hobs. If the AI wins it, it turns Builder for the rest of the fight: wFix back to 1.0, and it mends walls and shields Hobs to protect its total HP lead. Otherwise it goes for the win, as below.
- **Spend it all.** ShellValue and wAmmo drop to 0. Knack saving is off. Steam reserve is 0.
- **Go for a win path.** wKet x1.5 and wBonk x1.5. wFix x0.3: mending is a poor trade when every block wears down, and nothing heals a kettle. wFlat and wSee drop to 0.
- **Collapse matters more.** wFall x1.5, since Squall-weakened blocks drop in chains.
- **Wind.** Each Squall wind step adds `windSkill x delta wind` fresh error (6.4), as for any wind change. Wind compensation follows the preset. Beams and low wind-factor shots gain value through the normal "beam in wind" rule.
- **No change to aim error or rubber band.** The Squall changes what the AI wants, never how well it aims.
- **Bosses.** Rig scripts keep running in the Squall. Notches do not hold there (4.1 rule 5), so a boss AI that is behind on the kettle race spends its Set Pieces at once.

### 6.15 Taunts and barks

Rivals talk, which makes a solo duel feel alive [02c §5 lesson 13]. Rules:

- **When.** Triggers: battle start, phase change, its own big hit, its own miss, a near miss by the player, a big hit by the player, a Hob Bonked (either side), kettle under 25% (either side), Sudden Squall start, win, loss.
- **How often.** At most one line per turn. 40% chance on minor triggers, 100% on battle start, phase change, win and loss. No repeat of a line within 10 lines.
- **Never during aim.** Lines show only during the AI's think pose or the resolve. Never while the player is aiming.
- **Short.** Under 8 words. Speech bubble 2.5 s, captioned, voice is comic gibberish plus a tone [00 §8.2].
- **Kind.** Teasing, never mean. No insults about skill. The AI is the butt of most jokes.
- **Off switch.** Settings: Rival chatter on, short, off.

**Sample lines** (the lines in the game are in `content/text.json` under `rivals`: each Region 1 Rival has its own taunts and a sign-off for when you win)

| Trigger | Line examples |
|---|---|
| Battle start (Flattener generic) | "Notice of Flattening. Sign here." / "Please keep off the lumps." |
| Own miss | "That was the wind. Probably." / "Measured wrong. Measuring again." |
| Own hit | "Neatly done, if I say so." / "Level. Much better." |
| Player near miss | "Ooh. A hair off." / "Close. Untidy, but close." |
| Player big hit | "My creases!" / "That will need a form." |
| Same aim, it walks away | "Not twice, thank you." / "I have moved. Officially." |
| Sudden Squall start | "Oh dear. Weather." / "Hold on to your caps." |
| Hob Bonked (theirs) | "Off you float, Dobbs." / "Report back to base. Slowly." |
| Hob Bonked (yours) | "Oh. Sorry about that." (Flatteners never gloat) |
| Kettle low (theirs) | "The kettle is whistling. That is bad." |
| Win | "Level. Thank you for your patience." ("Flat and finished." is the Baron's line, used once) |
| Loss | "I shall file a complaint." |
| Marshal Trimm | "Do keep off the lawn." / "Who planted a lump here?" |
| Dame Scree | "Good cut. Mine is better." / "Steps, then slopes, then nothing." |
| Admiral Sluice | "Splendid splash!" / "Pump harder, lads!" |
| Steward Plumb | "Fewer lumps, please." / "That was... rather lumpy." |
| Baron Levelwell | "A hill spilled my tea once." / "Flat is fair!" / "Not the cup!" |
| Countess Glaze `[U2]` | "Five point two. Poor landing." / "Mind the ice, darling." |
| Ironmaster Bolt `[U3]` | "WHAT? STAMP!" / "BELL MEANS DUCK!" |

### 6.16 AI on the player's side

The same AI drives:

- **The Drill Sergeant** [C49]: a Test Yard button that has the AI attack the player's Blueprint [B16].
- **Quick Pick** in the Rummage (6.8).
- **Bots** in testing (section 7), with the "proxy player" profiles.

---

## 7. Testing

### 7.1 Harness

- A headless runner plays full battles with the real sim, two AI sides, fixed seeds [04r §14].
- One side is a **Proxy Player**: the same AI, tuned to act like a human at a given skill. The other side is the real Rival at a preset.
- **Throughput.** About 80 matches a minute per CI core with AI on both sides [C5]. Nightly runs a rotating sample of 20k battles; a weekly job runs the full sweep [T §4.2].

| Proxy Player | Aim (first shot / floor) | Correction | Choices | Stands for |
|---|---|---|---|---|
| **Newcomer** | angle 4, power 9 / floors 1.5, 3 | x0.7 | random of best 4, no Walk, no Doodads | First-week casual |
| **Regular** | angle 2.5, power 5 / floors 0.6, 1.2 | x0.5 | best of 2, Walk if blocked, Doodads by trigger | Typical player |
| **Sharp** | angle 1.2, power 2.5 / floors 0.3, 0.6 | x0.45 | best, Walk to dodge, combos | Strong fan |
| **Ace** | angle 0.7, power 1.3 / floors 0.15, 0.3 | x0.4 | best plus combos | Top 5% |

Proxy Players get the 30% preview as a lower error on their first shot (one step of correction). They use Recall like a player, with pins that fade after one reuse [B11]. Bots also get the player's Tinker progress for the level band.

### 7.2 Win-rate targets (proxy wins vs AI)

Level bands: R1 early (1-1 to 1-4), R1 late (1-5 to 1-9), Mid (Regions 2 and 3), Flats (Region 4, levels 1 to 9), Grand Fort (first try), Wings (Regions 5 and 6, `[U2]` `[U3]`, played after the Baron).

| Proxy vs preset | R1 early | R1 late | Mid | Flats | Grand Fort (first try) | Wings |
|---|---|---|---|---|---|---|
| Newcomer vs Cosy | 95% | 90% | 85% | 80% | 65% | 75% |
| Regular vs Cosy | 99% | 97% | 95% | 92% | 85% | 90% |
| Newcomer vs Fair | 85% | 70% | 55% | 45% | 30% | 40% |
| Regular vs Fair | 92% | 85% | 75% | 65% | 50% | 60% |
| Sharp vs Stubborn | 85% | 75% | 65% | 55% | 45% | 50% |
| Regular vs Stubborn | 70% | 55% | 45% | 35% | 25% | 30% |
| Ace vs Ironclad | 75% | 65% | 55% | 50% | 40% | 45% |
| Sharp vs Ironclad | 55% | 45% | 35% | 30% | 20% | 25% |

Tolerance: plus or minus 5 points before a tuning change. Each cell runs at least 400 battles across seeds and maps.

**Grand Fort clear targets on Fair (Regular proxy):** median attempts to clear 2 or fewer; 90% clear by attempt 4. On Cosy (Newcomer): 90% clear by attempt 2. For the Last Level, count attempts per Stage.

### 7.3 Other metrics

| Metric | Target | Why |
|---|---|---|
| Rounds per battle | 8 to 12 median; Grand Forts 12 to 18; Last Level 8 to 12 per Stage | Match length [00 §2.12] |
| Battles that reach Sudden Squall | under 15% on regular levels | Battles should end by a win path [B5] |
| Late-fort collapse | A good low hit on a late Rival fort drops about a third of it. Bot test by week 6 | [B2] |
| Kettle Pop vs Clean Sweep share | each path at least 25% of AI wins | Both win paths stay live [00 §1.2] |
| AI first-shot direct hit rate | per table 6.13 | Fair miss policy |
| AI bracket curve | hit chance rises each shot on the same target, plateau by shot 4 | "It is learning" feel |
| Same-aim walk | after 2 same-aim hits, the AI walks 100% of the time it has the Steam | Anti Recall lock [B11] |
| Proxy repeats | no proxy wins more than 20% of its battles with 4 or more same-aim shots in a row | Recall lock is broken |
| AI self-damage | under 5% of its total damage dealt | No dumb self-hits |
| Personality mirror matches | each personality wins 40% to 60% vs each other on mirror forts | No dominant style |
| Class use by AI | no Class over 30% of AI shots across all levels | Variety [00 §10.3] |
| Think compute time | p95 under 400 ms on the 2 GB low-end phone, every preset; screen think time 0.8 to 1.5 s | Speed [C3] |
| AI resolve time | every AI shot resolves in 4 s or less | No long tails |
| Determinism | the same seed gives the same AI command log on web, iOS and Android (hash match) | Replays, resume, Daily [04r §7] |
| First-mover balance | AI vs AI mirror at Fair: first side wins 47% to 53% | Offset rules [00 §2.2] |
| Stalls | 0 battles where both sides only repair for 4 rounds | No turtling loops |
| Boss telegraph check | 100% of Set Pieces show their tell at least one full player turn before | Fair bosses |
| Phase skips | 0. Every phase plays at least one boss turn | Notches hold |
| Validator | 100% of Rival forts, Outposts and boss bodies pass | [B3] |

### 7.4 Fairness tests

- **Hidden hand test** `[Launch]`. Run each battle twice with the player's drafted hand shuffled. The AI's choices before the player fires a shell must match exactly.
- **Hidden crew test** `[U2]`. In hidden-crew levels, run each battle twice: once with the real crew, once with the hidden Nooks shuffled. The AI's choices before a Nook is revealed must match exactly. Any difference means it peeked.
- **Rule test.** Assert every AI command passes the same validation as a player command (Rest, Steam, Walk limits, Shove Off, Loophole Flap, one Action, dug-in Hobs).
- **Wish test.** In every Rummage where the wish shows, the AI's first pick is the wished shell whenever it is still in the pool.
- **Couch Duel load test.** A Couch Duel run in a release build never loads the AI module.
- **Rubber-band test.** For fixed seeds, force the score to lopsided and close states and check that aim error draws are identical. Only the Sporting rule's weight change may differ, and only on Cosy and Fair.
- **Playtest check.** In human playtests, ask after each battle: "Did the Rival feel fair?" Target 85% yes on Fair. Ask "Did it feel like it was learning?" Target 70% yes.

---

## 8. Open questions

1. **Sudden Squall in boss fights.** `00` skips a phase the kettle drops through in the Squall; notches hold before it. Confirm both with bots. The double-pop rule (more total HP wins) applies to bosses too; summoned Hobs count while they stand.
2. **Hill Call cap.** 4 mounds at once. Tune with bots.
3. **Clan crate offer.** 2 picks from 4 shells. `05` and `01` pick the pool.
4. **The Square Gate level.** Closed: `05` places it at 4-6.
5. **Rival rooms and perks.** Closed: `02` keeps Braces (FT-03) at launch, so Braced Walls stays. The Keystone perk is now a Fork pick.
6. **Flattener Twists.** Keep enemy-only. A post-launch Turncoat Hob per Grand Fort stays an owner call [audit §4 item 3].
7. **Rival chatter voice.** Gibberish voice plus captions, or text only to save audio scope? Audio doc decides.

---

## Appendix: Parked ideas

Cut by review 04 or replaced. Kept so nothing designed is lost.

**Three-Stage final.** Stage 1 was the Square Gate with the Steward, Stage 2 the Roller, Stage 3 the Engine, 12 rounds each, one draft of 14 with 6 picks, retry from Stage 1 on Stubborn and Ironclad. The Steward now has her own level (4.5).

**Square Gate heal phase.** "Order: every block heals 10% per turn (Mossbrick)." A Plain Shot could not out-damage it. Mossbrick now heals at most a third of a Plain Shot and not on a turn it is hit [B1].

**Last Cup at Stubborn aim on every preset.** Bosses now keep their preset's aim [C74].

**Boss kettle 400 HP.** Phases gate bosses instead [B4].

**Bosses one grade above the region's Rivals.** Now the region's top grade [C74].

**Last Bell tiebreak** for Grand Forts and the "Battles that hit Last Bell" metric. Replaced by Sudden Squall [B5].

**Turncoat Hobs** joining after each Grand Fort (Hedger, Pitcher, Pump Hand, Snowball Roller, Shoring Crew, the Steward). Outfits at launch [C32].

**Buried Hobs skip a turn and dig out alone** (Avalanche phase). Replaced by the dug-in rule [B9], [C15].

**Gust Bellows Tumble.** One hit on the bellows Tumbled the Hob. Now it breaks the bellows [C44].

**Dredger Zap chain.** Soaked Hobs near brass took an extra Zap chain. Dropped [C22].

**AI deny refund.** Deny picks of grey shells refunded 10 Buttons to the AI. No grey shells, no refunds [B6].

**Time target of p95 150 ms and a sim-count budget.** Replaced by 400 ms and work units [C3].

**Retired enemy Knack names** [C31]: Leaf Storm, Survey, Ledge Cut, Grit Line, Sanding, Bog Spray, Suction Pop, Silt Tunnel, Mud Pile, Polish, Avalanchette, Frostline, Rivet Rain, Live Wire, Cartload, Floodlight, Plumb Line (the enemy Knack; the Rig Part keeps the name [C47]), Grid Survey, Scald Sweep.

**Old archetype sizes** that failed the validator: the Hedge Box at 5 x 4 with 3 Nooks in a row, the Beanpole at 3 wide, the Moon Square at 7 x 7 [C05].

**Dredger Rafts** as 2 x 2 forts. Now 4 x 3 Mud Rafts with a Plunger Pete (the Silt Lobber moved to U1).
