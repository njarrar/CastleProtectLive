# 01. Weapons and Shots

Status: revision 2, after the review pass. Date: 2026-11-22. Owner of this doc: weapons designer.

This doc owns every shot name in Castle Protect: 8 Plain Shots, 28 Knacks (one for each Hob in the crew doc), 4 bench Knacks that only enemies fire, 58 Trick Shells, 14 Doodads and the 9 enemy-only Flattener Twists. It also owns the ballistics system (core system 3), the Rummage pool rules and Doodads (core system 8), and the shot side of damage and status (core system 6). It builds on `00-core-game-design.md`. Where a number here differs from a sibling doc, this doc is the source for shots.

**How to read the cites.** `[00 §2.10]` is the core design. `[D02]` tech tree, `[D03]` crew, `[D04]` enemies, `[D05]` campaign, `[D06]` art, `[D07]` UX and audio. `[R04 B6]` is ruling B6 in `docs/review/04-rulings.md`. `[A C27]` is row C27 of the consistency audit (`docs/review/01`). `[R02 §3.1]` is the fun and scope review. `[R03 §1.6]` is the technical review.

**Numbers.** Every number is a tuning target. Bots and playtests set the final values. Damage and radius use the core bands [00 §9.3].

**Names.** All names are new and fit Brickabrac: pots, puddings, socks, kettles and contraptions. All need the trademark pass [R04 D9].

**Tags.** Every shell, Knack, Twist and Doodad carries one tag: `[Launch]`, `[U1]` (Long Siege), `[U2]` (Nithering Heights) or `[U3]` (Wheal Clank) [R04 A]. Nothing designed is deleted. Items that no longer ship sit in Appendix B, "Parked ideas".

---

## Changes in this revision

What changed since the first draft, and which ruling asked for it.

| # | Change | Source |
|---|---|---|
| 1 | **Material HP is 30, 50, 80, 110, 140** (Wicker, Timber, Cobble, Brassbound, Mossbrick). Every shell's material line and the whole score table are redone on these numbers | R04 B1 |
| 2 | **Mossbrick heals 7 a turn** (one third of a Clodpot's 21) and not on a turn after it was hit. A block with a Cuckoo Clock on it does not heal | R04 B1, A C29 |
| 3 | **Any Hob fires any Trick Shell.** Each shell names one Match Class. A Hob of that Class fires it with no Rest and +10%. Tags, families as "who can fire it", grey cards, dead cards and the fit rules in the Rummage are gone | R04 B6 |
| 4 | **No rarity.** Budget bands are by Weight. The Rummage pool has no rarity weights | R04 B16 |
| 5 | **Knack tiers are removed.** Each Knack has one form. The best tier ideas are Quirk candidates for the crew editor in Appendix A. One tier rule moved into the base Knack (Hairline now takes side support away) | R04 B8 |
| 6 | **Statuses merged.** Reload and Chill are one idea, **Rest**: the Hob needs a rest (the cog). Oil, Sticky, Ice and all Zones are one idea: a **patch** with one icon and a turn count | R04 B16 |
| 7 | **No lost turns.** No shot skips a turn. Extra rest from all sources caps at 1 turn. A buried Loophole greys that Hob's Fire button; the shot never bursts on its own sill. Puff Up is player side only | R04 B9 |
| 8 | **Sim clamps.** One use of one shot deals at most 60 to one Heartkettle, and never Bonks a Hob that started the shot at full HP (see change 22). Grit Bin, Brass Marble, Bumblejar and Woodpecker are retuned so the clamps rarely fire | A C27, A C28 |
| 9 | **A Beam that has passed through a block deals half to the Heartkettle.** Answers the kettle rush | R02 §3.2 |
| 10 | **Blast band "Pin" is now "Point"**, and a "pin shot" is a "point shot". Pin means only the impact marker | A C40 |
| 11 | **"Family" is no longer used here.** The 15 behaviour sets in section 4 are "groups" | A C41 |
| 12 | **Enemy Knacks have stats.** Every enemy unit fires a Knack from section 3, a bench Knack from 3.10 or a Twist from 4.16. The old enemy Knack names are retired and parked in the enemies doc. The Baron's Teatime is Twist 9. Section 4.16 lists who fires what | A C31, C46, C47 |
| 13 | **Trial rewards are one shell per Trial:** 6 at launch, 2 in U1, 1 in U2, 1 in U3. Cuckoo Clock is the last Trial's reward | A C35 |
| 14 | **Duds are always labeled.** Every Dud says "Dud" on its tile and card, for both sides, always. The hidden Dud and the `?` stamp rule are gone. From U2 the Lookout can reveal the rival's draft picks instead | Coordinator ruling, R02 §3.1 |
| 15 | **Type colours and badges follow 07 and 06.** Blast is warm white, Pierce pale yellow, Dig tan, Fire red, Frost ice blue, Zap violet. No trail or card uses the Rival orange | A C82 |
| 16 | **Shake, hit-stop and slow-mo use 07's numbers.** This doc keeps three extras: the Threaded slow-mo and push-in, the Dud mock slow-mo and the Threaded double tick | A C83 |
| 17 | **Sound.** 07's event list is the base. Each shot adds one short launch layer on its group's launch sound | A C85 |
| 18 | **Scope tags.** 30 shells (2 Duds), 16 Knacks and 8 Doodads ship at launch, using only Blast, Pierce, Dig and Fire. Totals after U3: 58 shells, 28 Knacks, 14 Doodads | R04 A |
| 19 | **Cut items moved to Parked ideas:** 14 shells, 5 Doodads, 1 bench Knack, 3 combos, rarity, tags, the echo rule and Knack tiers | R04 A |
| 20 | **Smaller fixes.** Dollop mends 40 (was 50). Chalk Dart deals 12 (was 5). Old Turnip leaves a turnip that stops one roller. Rock Cake 60 (was 68), Well Wisher 40 a block (was 50), Miner's Lamp 40, 32, 26, 20 (was 50, 38, 28, 21), so none of them one-shots a full block it should only hurt. Scrap blocks 50 HP, Cobble Cork parked, Tea Cosy soaks 60, Mend Bucket mends 45 a block | R04 B1, R02 §3.1 |
| 21 | **Balance table re-run** with a new overkill term. Win cost drops from 600 to about 550 Thwack. Three new red flags (21 to 23) | R04 B1, B2 |
| 22 | **Full-HP clamp is now "no single shot Bonks a Hob from full HP".** The sim clamps the shot's damage to that Hob at its HP minus 1, so 80 and 90 HP Hobs are covered too | Review 05 |
| 23 | **Kit nodes settled with the tech tree doc.** KT-02 Kitchen Drawer adds the three Kit set shells; KT-04 unlocks Molehill and KT-07 Bellows at launch; KT-09 unlocks Scarecrow in U2 | Review 05 |
| 24 | **First Doodads at 2-1.** Mend Bucket and Pot Lid arrive when Doodads open at level 2-1, not with the Workshop, so 1-6 teaches one thing | Review 05, R04 B14 |
| 24b | **First Doodad moved up to 1-9.** Mend Bucket and slot 1 are the reward for winning 1-9, so the 1-10 boss has a gadget turn. Pot Lid and slot 2 stay at 2-1. The Mac playtest showed late gadgets make the first hour flat | PLAN decision 14, research 02e |
| 25 | **Junk Shell parked.** The four-branch tree has no keystones, so the shell that needed one has no source | Review 05 |
| 26 | **Rising Fizz replaces Popple Pod** as Ginger's Knack: three bubbles that fall upward after the top of their arc, to hit roofs, wing necks and overhangs from below. The first rising-gravity shot. Popple Pod is parked (B.3) | Review 06 U5 |
| 27 | **Grand Dumpling gains Low Blow:** x1.3 to blocks in the row just above the Footing. Marge's Knack now teaches "aim low" | Review 06 U6 |
| 28 | **Long Skewer leaves the skewer in:** every Nook whose wall it passed stays Open until that wall is mended. Darning Needle hits what is behind, Long Skewer opens rooms, Miner's Lamp makes a lane | Review 06 U7 |
| 29 | **Ducks and Drakes has a 50 Blast floor:** any touch that cannot skip is the last touch. No more 14 on a hill | Review 06 U8 |
| 30 | **Miner's Lamp is a Digger set-up shell:** Match Digger, Light, 12 Pierce a block, nothing to Hobs or the kettle. It opens a Peephole lane others shoot down | Review 06 U9 |
| 31 | **Suet Pudding's Match moves from Lobber to Scatterjack.** Match counts at launch: Lobber 5, Zinger 2, Scatterjack 4, Digger 5 | Review 06 U10 |
| 32 | **Dollop mends +50,** the value in the core canonical numbers. Change 20's 40 is withdrawn | Review 06 U11 |
| 33 | **Loophole Flap:** after a Thread passes a Loophole, it takes no Threads until the Weather Front changes. Shown on the fort. Replaces the hidden AI cap in red flag 4 | Review 06 G6 |
| 34 | **Shove Off:** a dug-in Hob clears its Loophole for 15 Steam in the Walk step, not the Action | Review 06 G7 |
| 35 | **Loose shells in 1-3 and 1-4:** Lid Lifter and Bag of Marbles are lent for one level each (4, unlock plan) | Review 06 G8 |
| 36 | **Couch Duel:** the Rummage rule is one rule with the core doc (1.9). Molehill shows to both players and Puff Up is open to both sides there. The Rival shows one wish in the Rummage against the AI | Review 06 G2, G9 |
| 37 | **Enemy roster swap:** the Shoring Crew (Prop Up, Twist 5) ships at launch; the Silt Lobber moves to U1. Launch Twists: 8 | Review 06 U10 |
| 38 | **Balance table re-run** for the changed rows (7.5): Grand Dumpling, Long Skewer, Rising Fizz, Ducks and Drakes, Dollop, Suet Pudding, Miner's Lamp. The class gap and the typical hand hold | Review 06 |

---

## Launch Hob set

Sixteen Hobs ship at launch: 2 or 3 in each of 7 Classes, no Lookout [R04 A, B3]. This list is the crew doc's final list [D03]; this doc tags every Knack to match it. Every launch Knack uses only Blast, Pierce, Dig or Fire.

| # | Class | Hob | Knack | Type | W |
|---|---|---|---|---|---|
| 1 | Lobber | Marge Dumpling | Grand Dumpling | Blast | M |
| 2 | Lobber | Old Thumper | Tick-Tock Crock | Blast | H |
| 3 | Lobber | Young Pip | Chimney Drop | Blast | M |
| 4 | Zinger | Miss Quill | Darning Needle | Pierce | M |
| 5 | Zinger | Dame Flicka | Long Skewer | Pierce | M |
| 6 | Scatterjack | Jax Pepper | Pepper Rain | Blast | M |
| 7 | Scatterjack | Nan | Pan Parade | Blast | M |
| 8 | Scatterjack | Ginger Popkin | Rising Fizz | Blast | M |
| 9 | Digger | Grub Mudgett | Seed Potato | Dig, Blast | M |
| 10 | Digger | Truffle Hogg | Molehill Surprise | None | L |
| 11 | Bouncer | Bobbin Springheel | Roly-Poly | Blast | M |
| 12 | Bouncer | Skip Drake | Ducks and Drakes | Blast | M |
| 13 | Stoker | Edna Toast | Boiled Over | Fire | M |
| 14 | Stoker | Walt Brine | Water Butt | Blast (water) | L |
| 15 | Patcher | Hetty Mortarboard | Barn Raising | None | M |
| 16 | Patcher | Nurse Plumley | Tea Cosy | None | M |

Class count: Lobber 3, Zinger 2, Scatterjack 3, Digger 2, Bouncer 2, Stoker 2, Patcher 2.

**Later Hobs.**

| Update | Hobs (Class, Knack) |
|---|---|
| `[U1]` +2 | Gus Bottomley (Bouncer, Wobble Jelly). Tacks Brassey (Patcher, Scrap Stack) |
| `[U2]` +5 | Aunty Nip (Stoker, Shiverpuff). Dotty Hailstone (Scatterjack, Hailbasket). Winkle Peake (Lookout, Chalk Fan). Owl-Eyed Olive (Lookout, Tattle Bell). Tansy Downe (Lookout, Snoop Kite) |
| `[U3]` +5 | Wick Chandler (Zinger, Glimmerjolt). Bartleby Bunn (Lobber, Anvil Bun). Ernest Tumm (Zinger, Clockwork Beetle). Lady Carom (Bouncer, Clackerball). Petra Mason (Digger, Hairline) |

## Content tags at a glance

| Kind | `[Launch]` | `[U1]` | `[U2]` | `[U3]` | Total | Parked |
|---|---|---|---|---|---|---|
| Plain Shots | 7 | | 1 (Chalk Dart) | | 8 | |
| Knacks | 16 | 2 | 5 | 5 | 28 | |
| Bench Knacks (enemy only) | 2 | 2 | | | 4 | 1 |
| Trick Shells | 30 (2 Duds) | 8 (1 Dud) | 10 | 10 | 58 | 14 |
| Doodads | 8 | 2 | 2 | 2 | 14 | 5 |
| Flattener Twists | 8 | | 1 | | 9 | |
| Damage types in use | Blast, Pierce, Dig, Fire | | + Frost | + Zap | 6 | |
| Statuses in use | Burn, Soaked, Rest | | + Brittle | | 4 | |

**Short forms used in this doc.**

| Short form | Meaning |
|---|---|
| R1 to R4 | Launch regions: Puddingstone Downs, Crag End, Soggy Bottom Fen, The Flats [R04 A] |
| Heights, Mines | Nithering Heights (U2) and Wheal Clank (U3) |
| GF2 | Grand Fort of region 2, as a first-clear reward |
| Kit set | KT-02 Kitchen Drawer, the Kit branch node that adds three shells to your Rummage pool [D02 §1.6] |
| Trial reward | Given for the first clear of one Trial. One shell per Trial |
| L / M / H | Weight: Light (Rest 0), Medium (Rest 1), Heavy (Rest 2) [00 §2.2] |
| Match Class | The Class that fires a shell with no Rest and +10% (1.9) |
| Thwack, TPT | The balance score and its per-turn form (section 7) |

---

## 1. Weapon design rules

### 1.1 The ten rules

1. **A new shot is a new rule.** Each shot differs in how it flies, what sets it off, or what it leaves behind. Two shots may never differ by numbers alone. Test: describe the shot in one line with no number in it. If the line matches another shot, cut one. This revision ran the test again and parked 14 shells that came too close [R02 §3.1].
2. **One trick per shot.** A shot has one main rule and at most one small rider. If the card needs two sentences, the shot is two shots.
3. **The picture changes.** Every shot leaves a mark the next turn can use: a crater, a hole, a mound, a patch, a status or a fallen block [00 §1.2 pillar 1].
4. **Easy pays less.** Wide, safe shots score low. Narrow or tricky shots score high. The Skill Factor carries this into Score.
5. **Every shot has a counter you can see.** The counter is on the map or in the HUD before the shot: a material, a ground type, a Doodad, a walk, a rival Class.
6. **No input after Fire.** No Plain Shot or Trick Shell asks for a tap in flight. Tap already means 2x resolve, the AI must play by the same rules, and one-thumb play must hold. A few shells have one **Dial** set before firing (a direction, an address). Two later Knacks are **Steered** (Snoop Kite `[U2]`, Clockwork Beetle `[U3]`). No Steered shot ships at launch.
7. **Set-up shots earn their slot.** A shot that deals no damage must open a play worth more than a Plain Shot within two turns.
8. **Nothing is silent.** A full miss still carves, scorches or leaves a pin. Near misses deal at least 8 through the 25% falloff floor [00 §9.3].
9. **Kind chaos.** Random shots show their list on the card. The roll uses the seeded sim, so replays and the Daily Dust-up agree [R03 §1.6].
10. **Slapstick only.** Shells are pots, stones, socks, birds and bakes. Nothing looks like a real weapon.

Two rules from the review now sit beside these ten [R04 B9]:

- **No shot takes a turn away.** A shot may hurt, move, bury or slow. It never makes a side pass.
- **Collapse is the damage that grows.** Shell damage stays flat all game. Big forts fall harder, they do not stand longer [R04 B2]. Shots that take away support (Heavy Gravy, Lid Lifter, Well Wisher, and Hairline from U3) are the late game's big hitters.

### 1.2 Shot anatomy

Every shot is four picks from these lists. The data file for a shot is these four fields plus numbers [R03 §3.5].

| Part | Options |
|---|---|
| **Flight** | Lob (plain arc), Flat (low gravity, fast), Beam (straight, no gravity, no wind), Float (slow, wind factor 1.5 or more), Rise (gravity turns upward after a trigger: Rising Fizz), Bore (travels in ground), Roll, Bounce, Crawl (sticks to surfaces), Self-flown (guided) |
| **Trigger** | Impact, Apex, Near (within a set range of an enemy piece), Stop (when it comes to a halt), Timer (at the start of a later turn), Tripped (a castle or prop comes close) |
| **Payload** | One damage type [00 §2.10], a damage band, a blast band. Or no damage and a build, patch, heal or shield |
| **Leftover** | Crater, tunnel, Peephole, mound, block, patch, prop, status |

**Shared keywords.**

- **Threads.** A Loophole is a slot 6 cells tall in the Nook wall that faces the rival [D03 §7.2]. A shot with this keyword that enters the slot hits the Hob inside in full, with no Cover. The game calls "Threaded!" and scores Skill Factor 1.5. Blasts, fluids and patches never thread. This is the point shot of the game: hard to land, high pay. **Loophole Flap** [00 §2.10]: once a Thread passes a Loophole, a flap drops over it and no Thread can pass it until the Weather Front changes. A point shot that reaches a flapped slot hits the wall block. The Hob inside still fires. Both sides, every preset.
- **Peephole.** A hole 6 cells wide bored through a block. The block keeps standing. Pierce shots and Beams aimed at the hole pass through. A Dollop closes it. Recall of the boring shot's Ghost lines a Beam up with the hole.
- **Prop.** A thing that sits on the field: a keg, a potato, an egg, a clock. Props have HP. A blast shoves a prop 1 cell per point of damage, up to 80 cells. Each side may have 3 props out; a fourth pops the oldest.
- **Patch.** One idea for everything that marks an area for a few turns [R04 B16]. A patch lies on ground, on blocks or in the air. It shows a dashed outline, one icon for its kind and a turn count. Each side may have 3 patches out; a fourth ends the oldest. A new patch replaces an old one where they overlap. Patches tick at the start of their owner's turn. Kinds:

| Patch | Tag | What it does |
|---|---|---|
| **Ember** | `[Launch]` | 8 Fire per tick to props, hedges and Tumbled Hobs in it. Burn to wood blocks within 8 cells |
| **Sticky** | `[Launch]` | Rollers, bouncers and marbles stop and burst in it. Walking across costs x3 Steam. Any Fire turns it into an Ember patch for 2 turns |
| **Soot** | `[U2]` | No preview dots, Ghosts or pins inside. AI aim error x2 into or out of it. Drifts 10 cells per wind point each turn |
| **Oil** | `[U1]` | Oiled blocks can Burn whatever they are made of (the Burn tick only). Fire lights it. Water washes it off |
| **Bouncy** | Parked | See Bouncemoss in Appendix B |
| **Ice** | `[U2]` | Rollers and skippers gain 25% speed. Fluids slide twice as far. Fire melts it to Water |
| **Frost** | `[U2]` | Blocks in it turn Brittle. Hobs in it need a rest. Fire ends it |
| **Feather** | `[U2]` | Half gravity inside. No fall damage, half crush |
| **Storm** | `[U3]` | Strikes the tallest block under it each turn. Rain Soaks what is below. Drifts 20 cells per wind point |

- **Rest.** One idea for every way a Hob sits out [R04 B16]. It replaces Reload and Chill. The cog on the portrait shows the turns left. A Hob's own Medium or Heavy shot sets the cog (1 or 2). An enemy effect (Red Tape, Cold Shoulder, a Frost patch) adds at most 1 turn, once: a Hob that already carries an added turn cannot get another until the cog is clear. No effect makes a side pass.
- **Dial.** One choice set on the card before firing: a direction or an address.
- **Roller hop.** Any Roll shot hops one block high just before it bursts, so it hits the first Body row and not only the Footing.
- **Revealed** `[U2]`. At launch the Muster shows every enemy Hob and the Class icons stay up all battle [R04 B10], so every Nook counts as Revealed and guided shells steer to any Hob or to the kettle. Hidden crew, reveals and the Lookout arrive in U2. From then on guided shells steer only to Revealed Nooks and to the Heartkettle, whose glow always shows.
- **Steered** `[U2]`. While a Steered shot flies, touch steers it and 2x is off. Steer taps go in the command log with their sim tick. If the app dies mid-flight, the turn resumes from its Plan step [R03 §8 item 7].
- **Metal** `[U3]`. A data tag for shots made of metal. Lodestones (the Mines hazard and the Lodestone Lump shell) pull Metal shots twice as hard. It does nothing before U3. Metal shots: Hatpin, Long Skewer, Tick-Tock Crock, Pan Parade, Clockwork Beetle, Clackerball, Scrap Stack, Woodpecker, Brass Marble, Plumb Bob, Kettle Tickler, Cuckoo Clock.

### 1.3 Readability

Each shot ships with all six items below. A shot that lacks one is not done.

| Item | Rule |
|---|---|
| **Icon** | One object in silhouette, readable at 32 px. No two icons share an outline |
| **Colour and badge** | Set by damage type, never by group. Shape carries it for colour-blind players. 07 owns colour and badge [D07 §6.3]; 06 owns the hex values [D06 §3.7] |
| **Weight pips** | 1, 2 or 3 cogs on the card corner. Same cog as the Rest cog on portraits. A gold cog with a line through it means "no Rest for this Hob" (Match Class) |
| **Card text** | One line, 12 words or fewer, verb first. Plus a looping 3 s clip |
| **Sound cue** | A launch sound from 07's launch set, picked by flight kind, plus one short launch layer of the shot's own (8.1). Impact sound by damage type. A player can tell by ear what the rival fired |
| **Counter line** | The Almanac page names one counter in six words or fewer |

| Damage type | Tag | Colour | Badge shape | Impact sound |
|---|---|---|---|---|
| Blast | `[Launch]` | Warm white | Eight-point burst | Low "whump" |
| Pierce | `[Launch]` | Pale yellow | Arrowhead | Sharp "tink" |
| Dig | `[Launch]` | Tan | Spade | Gravel crunch |
| Fire | `[Launch]` | Red (flame red, clear of the Rival orange `#E8730C`) | Flame | Whoosh and crackle |
| Frost | `[U2]` | Ice blue | Six-arm flake | Glassy chime |
| Zap | `[U3]` | Violet | Bolt | Snap and buzz |
| No damage, heal, build | `[Launch]` | Green | Plus | Soft "pomf" |

Trails use the same colour, so the shot in the air matches its card. No shot trail, card or number is orange: orange means "the Rival" everywhere [A C82]. Cards in this doc do not list a colour; the type sets it.

### 1.4 Counters

Every shot lists its counter. The main counter loops, all visible before the shot:

| This | Beats | Because | From |
|---|---|---|---|
| Fire | Wicker, Timber, hedges, Sticky patches | Burn and x1.5 | Launch |
| Water, Soaked | Fire, Burn, Oil | Ends and blocks Burn | Launch |
| Cobble, Brassbound | Fire, pellets, bees | Fireproof, hard | Launch |
| Bore and Dig | Hills, thick walls | Go under or through | Launch |
| Footing, Rock, Bedrock | Bore and Dig | Stop it dead | Launch |
| Bounce and Roll | Hills, low cover | Go around direct fire | Launch |
| Sticky, Mud, Water | Bounce and Roll | Stop or sink them | Launch |
| Beams | Open lanes | No drop, no wind | Launch |
| Mounds, hedges | Beams and Flat shots | Block the lane | Launch |
| Walk | Timers, eggs, patches | Leave the spot (costs Steam) | Launch |
| Patcher | Peepholes, clocks, gravy, chip damage | Dollop closes, wipes and knocks off | Launch |
| Spread crew | Blasts, gongs | One hit finds one Hob | Launch |
| Columns | Heavy Gravy, Hairline | Nothing hangs, so nothing drops | Launch |
| Frost | Thick single walls, Mossbrick | Brittle x1.5 on the next hit | U2 |
| Soot, hidden Nooks | Guided shells, snipers | No address, no preview | U2 |
| Zap | Brassbound | Chains through touching brass | U3 |
| Wood and Cobble gaps | Zap chains | Brass must touch brass | U3 |

### 1.5 Shots against materials

Multipliers are in the core table [00 §2.10]. HP is the new flat ladder [R04 B1]. Quirks, not HP, are the reason to pay for a better block. "Clodpots to break" is how many Lobber Plain Shots (35 Blast) a full block takes.

| Material | HP | Clodpot deals | Clodpots to break | Weak to | Strong against | What breaks the tie |
|---|---|---|---|---|---|---|
| **Wicker** | 30 | 42 | 1 | Everything. Fire lights it. Pellets and marbles clear it | Crush: it deals none when it falls, so a Wicker roof is a safe hat | Cheap to rebuild with Barn Raising |
| **Timber** | 50 | 35 | 2 | Fire (x1.5 and Burn), Blast at full | Chip shots: a pellet takes a tenth | Tinderbox turns a Timber fort into a three-turn problem |
| **Cobble** | 80 | 28 | 3 | Rock Cake, losing its support | Fire (x0.2), Pierce (x0.6), bees | Falls at x2 crush, and stone now hangs on only 1 block of side support [R04 B2]. A tall Cobble fort is top heavy |
| **Brassbound** | 110 | 25 | 5 | Zap chains `[U3]`, dropping it | Fire (0), Blast (x0.7), Pierce (x0.5) | A brass run from the outer wall to the Kettle Room is a fuse once Zap ships |
| **Mossbrick** `[U3]` | 140 | 21 | 7 | One big hit, Brittle then Blast, dropping it | Chip damage: it heals 7 at the start of its owner's turn | It does not heal on a turn after it was hit, while Brittle, or with a Cuckoo Clock on it. A Plain Shot every turn always makes headway |
| **Footing** | 400 | 9 | Do not | Nothing worth the shot | Dig (0), Blast (x0.25), all elements (0) | Dig the ground under it, or go over |

What the flat ladder does to shots:

- **Walls open sooner.** A Cobble wall falls to three Clodpots, not five. Brassbound to five, not eight.
- **Big single hits waste more.** A 95 Blast shell on a 50 HP block throws 45 away. Section 7 now counts that (the overkill term).
- **Small hits finish jobs.** Pellets, pans and marbles break hurt blocks that a big shell would over-pay for. This lifts the Scatterjack, the Class the review feared would feel weak [R02 §3.1].
- **Mending is worth less.** Heals and rebuilds scale with block HP, so each is about a quarter smaller than in the first draft.

### 1.6 Shots against Footing, the Heartkettle and Hobs

**Footing.** Bore shots stop at Footing and pop at half damage. Rollers hop it (Roller hop). Shafts stop at it. The only shots that use Footing are ground shots: Trencher's Spoon, Rug Pull `[U1]` and Sleepy Sapper `[U1]` take the ground from under it and cause a drop or a Thump [00 §2.7].

**Heartkettle** (300 HP on every fort, bosses included [R04 B4]; Blast 50%, Pierce and Zap 100%, Fire, Dig and Frost 0 [00 §2.10]).

- The Kettle Room starts covered on every face, so the kettle path is always two steps: open a wall, then shoot through. Pierce is the kettle type. Blast is the wall type.
- **Kettle clamp (sim rule).** The sim adds up all direct damage that one use of one shot deals to one Heartkettle and stops at 60. Parts that land later (a Cuckoo Clock's pops, a timed blast) count toward the same 60. Crush and falls are not shot damage and do not count; a falling chunk crushes the Heartkettle at 50% [00 canonical numbers]. A Kettle Pop takes at least five good hits after the wall opens [A C27].
- **Beams lose half through a wall.** A Beam that has passed through any block deals half to the Heartkettle. Darning Needle through one wall deals 20, not 40. Open the wall first for full damage [R02 §3.2].
- Frost deals 0 and cannot make the kettle Brittle. It is a hot kettle.
- Guided shells may steer to the kettle, because its glow shows. They still must get through the wall.

**Hobs.**

- **Cover.** A Hob in an intact Nook takes 50% from every area payload (blast band Tiny or larger) centred outside the Nook, whatever its damage type [A C10]. Point hits, Threads, Burn ticks, crush and falls are not halved. Shots that enter the Nook (Threads, jets, bees) or ignore walls (Dinner Gong) skip Cover. Each of these is weak in raw damage on purpose.
- Pierce deals x1.5 to Hobs. A point shot on a Hob is the best single hit in the game and the hardest to land.
- **Full-HP clamp (sim rule).** No single shot Bonks a Hob from full HP. If a Hob starts a shot at full HP, the sim caps the direct damage that shot deals to it at its HP minus 1 [00 canonical numbers, A C28, review 05]. Every fresh Hob, 80 HP Zingers included, lives through the first shot that finds it. Crush, falls and Burn ticks are not shot damage and do not count.
- No shot moves a Hob out of its castle. Shots may drop a Hob a floor (fall damage) or Tumble it by breaking its floor. A Tumbled Hob takes its damage and a new Nook. It never skips its next shot [R04 B9].
- **Dug in.** A mound, bush or foreign block on a Loophole greys the Fire button for that Hob and puts a "dug in" icon on its portrait. The shot never bursts on the Hob's own sill. Any blast on the spot, any Digger shot or a Dollop on the Nook clears it. Or the side pays **15 Steam to Shove Off** in its Walk step: the Loophole clears and the Hob may fire this turn, with no Action spent [00 §2.7]. If every live Hob on a side is dug in at the start of its turn, the newest burial clears by itself, so no side is ever forced to pass.
- Status on Hobs uses the fixed list only: Burn, Soaked, needs a rest [00 §2.10]. This doc adds no new status. The Tattle Bell mark `[U2]` is a Knack effect, not a status [A C20].

### 1.7 Shots against terrain

| Ground [00 §2.1] | Blast | Bore | Roll and Bounce | Fluids and fire | Build |
|---|---|---|---|---|---|
| Loam | Carves full, settles | Full speed | Normal | Soaks in slowly; water makes Mud | Mounds settle to a 45 degree slope |
| Clay | Carves half, holds its shape | Half speed | Normal | Pools on top | Pillars and ramps hold |
| Rock | Only Heavy shots and Rock Cake carve it | Stops, pops at half | Bounces keep 90% of speed | Pools | Good base for hedges |
| Bedrock | Never | Stops | Bounces keep 90% | Pools | Holds anything |
| Mud | Carves full, splats (no settle) | Half speed | Stops rollers; bouncers stick and burst | Fire goes out in 1 turn | Mounds sink 8 cells |
| Water | No crater; shell slows | Cannot enter | Rollers sink; skippers skip | Fire out | Mounds fill it and turn to Mud |
| Ice `[U2]` | Breaks to Water under Fire or Heavy Blast | Stops | Rollers and skippers gain 25% speed | Fluids slide twice as far | Nothing sticks |

### 1.8 Shots and wind

Wind pushes every shell by its **wind factor** [00 §2.5]. The card shows a small leaf: none, one, two or three.

| Leaf | Factor | Shots |
|---|---|---|
| None | 0 | Beams, Bore shots while in ground, rollers on the ground, self-flown shells |
| One | 0.3 to 0.6 | Bolts, kegs, Grandfather Clod |
| Two | 1.0 | Most shells |
| Three | 1.5 to 2.0 | Bees, moths, feathers, soot, clouds, the Flatteners' Leaf Storm |

Wind also moves Soot and Storm patches each turn. Fire reacts to wind (combo 1). The Bellows and Weathercock Doodads let a player set or still the wind for a short time. Wind never changes mid-turn.

### 1.9 The Rummage pool

The core sets the draft: pool of 10, 4 picks each, 2 left over [00 §2.15]. The Rummage opens at level 7 or 8 [R04 B14]. This doc sets how the pool is built.

- **Any Hob fires any shell** [R04 B6]. No shell is ever dead in hand.
- **Match Class.** Each shell names one Class on its card. A Hob of that Class fires it with **no Rest** and **+10%**: damage shells deal 10% more; a shell with no damage lasts 1 turn longer, or is 10% bigger if nothing about it lasts. Any other Hob fires it at the printed Weight with no bonus. Shells marked "All" have no Match Class: every Hob fires them at the printed Weight.
- **Source.** 6 slots draw from the player's unlocked shells, 4 from the Rival's list. A shell both sides own can fill either. Level data may set pool size, picks and a fixed list; fixed pools may lend shells marked "on loan" [A C37, C38].
- **Weights.** Every unlocked shell has the same chance. No rarity. At most 1 Heavy shell and at most 3 shells of one group per pool.
- **Spread.** Each pool has at least one shell with no damage (build, shield or patch), at least one that deals 50 or more, and at least 3 Match Classes that sit in the player's crew.
- **Duds.** 35% of pools hold one Dud in place of a Light shell. Never two. Every Dud is labeled "Dud" on its tile and its card, for both sides, from the first Rummage on. Players always know. No stamp, no Lookout rule, no node. Every Dud does one small useful thing.
- **Lookout and the draft** `[U2]`. With a Lookout in the crew, the player sees the rival's draft picks as they are made. The crew doc owns the details.
- **Quick Pick** runs the draft AI at Fair for the player [D04 §6.15]. It never takes a Dud for the player [A C77].
- **The Rival's wish** [00 §2.15]. Against the AI, before the first pick, the Rival pins the one shell its draft scores highest for itself. It takes it at its first chance if it is still there. Stubborn and Ironclad may hide the wish.
- **Couch Duel** `[Launch]`. One rule, word for word the core doc's [00 §6.1]: the pool of 10 takes 5 slots from each side's shell source (the six start shells for a Starter Box kit) under the spread rules above. The second side picks first, then picks alternate until each side holds 4. Every pick shows at once, face up, in that side's colour. Duds stay labeled. Quick Pick fills one side's remaining picks at random within the spread rules; no AI runs and there is no wish.
- **Kit branch nodes** that change the pool or the hand act after these rules [D02].

**Match Class count.** Shells per Match Class at launch and after U3.

| Match Class | Launch | After U3 |
|---|---|---|
| Lobber | 5 | 6 |
| Zinger | 2 | 4 |
| Scatterjack | 4 | 8 |
| Digger | 5 | 7 |
| Bouncer | 4 | 7 |
| Stoker | 4 | 11 |
| Patcher | 3 | 4 |
| Lookout `[U2]` | 0 | 2 |
| All | 3 | 9 |
| **Total** | **30** | **58** |

### 1.10 Notes for the sim

These follow the tech rulings [R04 C] and the technical review [R03 §1.6, §3.3].

- Every shot is data: a flight model, triggers and effect parts. No shot id appears in sim code.
- One sim clock at 120 Hz. Times in this doc ("rolls for 3 s") are 120 ticks a second. Resolve ends at rest or 3 s after the last impact.
- Damage is an integer, rounded once when it is applied. The two clamps in 1.6 apply after the rounding.
- Caps per shot: 12 sub-shells, 60 fluid units, 64 actors, effects nested 4 deep. Caps per side: 3 props, 3 patches.
- Random shells draw once from the `battle` stream when fired. Copycat copies the resolved shot from the log.
- Splits spawn their pieces in a fixed order. Pieces first move on the next tick.
- Duel forts stand at most 1400 cells apart [R04 C4]. Every range in this doc fits that gap.

---

## 2. Plain Shots

One per Class. Unlimited, Light, Rest 0 [00 §2.9]. A Plain Shot is the Class in one sentence. Each has a job no other does.

| Class | Plain Shot | Tag | What it does | Numbers | Its job | Counter |
|---|---|---|---|---|---|---|
| **Lobber** | **Clodpot** | `[Launch]` | A clay pot of rubble on a steep arc. Bursts on first touch | 35 Blast, Medium (28). Wind two leaves | The yardstick. Opens walls, carves ground. Breaks Timber in two hits and Cobble in three | Cover halves it. Brassbound takes five. Wind moves it most |
| **Zinger** | **Hatpin** | `[Launch]` | A long pin, fast and nearly flat. Hits the first block or Hob in its path. Threads Loopholes and Peepholes | 32 Pierce, Point (48 to a Hob). Gravity x0.35, speed x1.5, wind one leaf. Metal | Bonks crew through gaps. Two pins drop a Zinger, three a Lobber | Dug-in Loopholes, hedges, hard walls (19 to Cobble, 16 to Brassbound) |
| **Scatterjack** | **Gravel Sneeze** | `[Launch]` | Three stones in a fan, 6 degrees apart. The preview shows the middle stone | 3 x 14 Blast, Tiny (10) | Forgiving. Clears Wicker, roofs and props. Finishes hurt blocks. Finds the range when you do not know it | Cobble takes 11 a stone. Cover halves each stone |
| **Digger** | **Nibbler** | `[Launch]` | A low shot that keeps going in soft ground and leaves a tunnel. Against a block it bites once and stops | Bores 48 cells of Loam (Clay at half), tunnel one block wide. 34 Dig to one block, and leaves a Peephole in it | Makes lanes for Hatpins and Beams. Eats hill tops. Digs out buried Loopholes | Footing, Rock and Bedrock stop it. Brassbound takes 17. Dollop closes the hole |
| **Bouncer** | **Jumping Bean** | `[Launch]` | Hops twice, bursts on the third touch or at once on a Hob. Keeps 70% speed per hop | 30 Blast, Small (18), +5 per hop (40 after two) | Reaches behind hills and under roofs | Sticky and Mud hold it. Water sinks it |
| **Stoker** | **Hot Coal** | `[Launch]` | A fire pot. Lights what it hits and leaves an Ember patch | 15 Fire, Small (18): 23 to wood. Burn on wood and Hobs. Patch lasts 2 turns | Patches. Punishes wood forts and pits. A burning Timber block loses 39 of its 50 over two turns | Cobble, Brassbound, Water, Soaked |
| **Patcher** | **Dollop** | `[Launch]` | A glob of mortar. Aimed at your own castle it shows a block cursor, not an arc. The one shot that lands on your own fort | Own block: +50 HP [00 canonical numbers]. A broken block comes back at half HP in its old material if it still has support. Closes a Peephole, ends Burn, wipes Heavy Gravy, knocks off a Cuckoo Clock, digs out a buried Loophole, pulls out a Long Skewer. Rival block: 8 Blast, Tiny | Keeps Cover up | Out-damage it: one block mended a turn loses to two shooters. Bonk the Patcher |
| **Lookout** | **Chalk Dart** | `[U2]` | A fast chalk dart. Reveals the nearest enemy Nook within 32 cells of where it lands, for the whole battle. Its Ghost is drawn bold, so it doubles as a range finder | 12 Pierce, Point (18 to a Hob). Wind one leaf | Finds crew. Feeds guided shells. Now also stings, so a scout turn is not an empty turn [R02 §3.1] | Chimney Cough hides Nooks again |

**Readability sheet.**

| Plain Shot | Icon | Launch layer | Card text |
|---|---|---|---|
| Clodpot | Round pot with a cork | Hollow "thonk" | "Lob a pot. It goes boom." |
| Hatpin | Long pin with a pearl head | Thin "zip" | "Fast pin. Threads Loopholes." |
| Gravel Sneeze | Three pebbles in a fan | "Ah-choo" and a rattle | "Sneeze three stones in a fan." |
| Nibbler | Toothy grub | Crunchy chomp | "Bores a short hole in anything soft." |
| Jumping Bean | Bean with a grin | Rubber "boing" | "Two hops, then pop." |
| Hot Coal | Pot with a flame lid | Lit-match hiss | "Starts a small fire that stays." |
| Dollop | Trowel and blob | Wet "splat" | "Fix your block. Or annoy theirs." |
| Chalk Dart | Chalk stick with an eye | Flute "peep" | "Reveal the room you hit." |

---

## 3. Knacks

The crew doc gives each of its 28 Hobs one Knack [D03 §3]. This section names all 28 and sets their numbers.

- **Uses.** 2 per battle [00 §9.4].
- **Weight.** Medium unless the table says Light or Heavy. Knacks with little or no damage are Light, so they do not bench the Hob [A C07].
- **One form.** A Knack has no tiers [R04 B8]. Hobs grow in 3 ranks and each rank is a Quirk pick, owned by the crew doc. The tier ideas from the first draft are in Appendix A as Quirk candidates.
- **Crowd-out guard.** If bots show Plain Shots under 20% of Actions, every Knack's second use opens at Round 5 [A C30].

### 3.1 Lobber (demolisher)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Grand Dumpling** | `[Launch]` | Marge Dumpling | One fat pot on a high arc. 60 Blast, Large (42). Breaks Wicker and Timber at the centre; Cobble takes 48 of 80, Brassbound 42. **Low Blow:** blocks in the row just above the Footing take x1.3 (78 Blast at the centre: Timber there breaks, Cobble takes 62 of 80, so one more hit on that row drops what leans on it). The Footing still takes 25% | M | Cover, Cobble, spread crew. Brassbound or columns in the low row. A 3 s flight gives time to read it |
| **Tick-Tock Crock** | `[Launch]` | Old Thumper | Lands and sits (a prop, 30 HP). Blows at the start of his next turn: 85 Blast, Large (42). Cobble takes 68 of 80, Brassbound 60, the kettle 43. Metal | H | Shove it with any blast. Walk away. Mend or shield. Water Butt washes it off |
| **Chimney Drop** | `[Launch]` | Young Pip | Climbs very high and falls straight down; wind stops at the apex. Skips front walls. 50 Blast, Medium (28): a full Timber roof block breaks | M | Brolly, Cobble roofs (40 of 80) |
| **Anvil Bun** | `[U3]` | Bartleby Bunn | One great stone. 70 Blast, Small (18). If it breaks the block it hits, it keeps going down and hits the block below for 70 too. Goes through any stack of wood; a full Cobble block (56 of 80) stops it | H | Cobble or Brassbound roofs. Seat crew off the centre column. It benches him for 2 turns |

### 3.2 Zinger (crew sniper)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Darning Needle** | `[Launch]` | Miss Quill | A Beam. Passes through the first block (40 Pierce to it: 24 to Cobble, 20 to Brassbound) and hits what stands behind for 40 Pierce (60 to a Hob). Through a wall the kettle takes half: 20 | M | Mounds, hedges, double walls. A Beam needs a straight lane |
| **Long Skewer** | `[Launch]` | Dame Flicka | A lance bolt. Pierces up to 3 Wicker or Timber blocks in a line, or 1 block of Cobble or better. 45, then 30, then 20 Pierce. A Hob takes x1.5 of what is left. **Leaves the skewer in:** every Nook whose wall blocks it passed counts as Open (no Cover) until that wall is mended (Dollop on the block, a Barn Raising rebuild or a Mend Bucket). The skewer blocks nothing else. Metal | M | Stone or brass outer walls. Depth: seat crew four blocks in. A Patcher pulls the skewer |
| **Glimmerjolt** | `[U3]` | Wick Chandler | A spark Beam. Zap. Passes one wall (40 Zap to it: 40 to Brassbound, 12 to wood or stone) and hits the next thing for 40 (48 to a Hob). Chains along touching Brassbound at half per link. Through a wall the kettle takes 20 | M | No brass near crew. Lightning Rod. Wood and stone take x0.3 |
| **Clockwork Beetle** | `[U3]` | Ernest Tumm | A slow dart. Steered: one tap in flight turns it toward the tap. 38 Pierce, Point (57 to a Hob). Threads. Metal | M | Soot Puff hides the target. Any blast near it knocks it down. Slow, so a Brolly or hedge can be placed first |

### 3.3 Scatterjack (area)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Pepper Rain** | `[Launch]` | Jax Pepper | Splits at the top of its arc into 7 stones that rain on a wide strip. 13 Blast, Small (18) each. Four stones on one Timber block break it | M | Cover, hard roofs. A Brolly stops only the first stone |
| **Pan Parade** | `[Launch]` | Nan | 5 pans on one aim, each landing 24 cells past the last. 18 Blast, Small each. Walks a line across a roof or along a wall top. Metal | M | Cobble faces (14 a pan). Step back with a Walk and the run lands short |
| **Rising Fizz** | `[Launch]` | Ginger Popkin | A soda bottle on a normal arc. At the top of its arc it pops into 3 bubbles, 4 degrees apart, that keep its forward speed and **fall upward** at one third of gravity (200 cells/s²). Wind two leaves (factor 1.2). Each bubble pops on first touch: 20 Blast, Small (18). A bubble that touches nothing within 2 s pops in the air and leaves a Pin. Aim a low, flat arc so the apex sits under a roof lip, an overhang, a wing's neck block or a high Nook floor. Three bubbles on one Timber block break it (60); Cobble takes 16 a bubble, Brassbound 14. The preview runs on through the apex split, up to the preview length [00 §2.4] | M | Deep Nooks with closed ceilings. Hard roof undersides. Wind. Pot Lid |
| **Hailbasket** | `[U2]` | Dotty Hailstone | Splits at the top into 8 ice pellets. 10 Frost, Tiny each (5 to a block). All they hit turns Brittle | M | Fire ends Brittle. The kettle ignores Frost. Hit back before the follow-up |

### 3.4 Digger (underminer)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Seed Potato** | `[Launch]` | Grub Mudgett | Bores through up to 96 cells of ground or 2 castle blocks (30 Dig each), then bursts where it stops: 50 Blast, Medium (28). Two hurt Timber blocks will not stop it | M | Footing, Rock, Brassbound outer walls (15 Dig each) |
| **Hairline** | `[U3]` | Petra Mason | A crack shot. 55 Dig to the block it hits: breaks Wicker and Timber, 39 to Cobble, 28 to Brassbound. Cracks spread: for 1 turn every touching block gets no side support, and those with nothing below fall. The cracked blocks also turn Brittle | M | Columns ignore it. Fire ends Brittle. Dollop on a cracked block ends the crack |
| **Molehill Surprise** | `[Launch]` | Truffle Hogg | Burrows, then pushes up a Loam mound 48 tall and 40 wide where it stops. No damage. Cover for your fort, or a plug for a low enemy Loophole (that Hob is dug in) | L | Any blast clears Loam. Digger shots dig out. Rock stops the burrow |

### 3.5 Bouncer (trick shots)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Roly-Poly** | `[Launch]` | Bobbin Springheel | A big roller. Rolls for 3 s, climbs slopes up to 45 degrees, bursts at the first wall: 70 Blast, Medium (28). Breaks the Timber it meets; Cobble takes 56 of 80 | M | Mud, Sticky, Water, pits, a Stomp ditch, Alarm Egg |
| **Ducks and Drakes** | `[Launch]` | Skip Drake | A low flat stone. Skips up to 4 times on ground or Water (and Ice from U2) when it meets the surface at under 35 degrees. Each skip pops 14 Blast, Tiny. The last touch is 50 Blast, Small. **Floor:** any touch that cannot skip (a steep slope, Mud, Sticky, a block or a Hob) counts as the last touch, so the worst case is a flat 50, never a 14 | M | Sticky and Mud end it early (still 50). Closed low walls. Cover |
| **Clackerball** | `[U3]` | Lady Carom | A hard ball. Bounces off any surface 3 times with no loss of speed. Bursts on a Hob or when it rests: 65 Blast, Small (18). Metal | M | Closed Nooks. Sticky |
| **Wobble Jelly** | `[U1]` | Gus Bottomley | A jelly blob. 20 Blast, Small. Leaves a Sticky patch 80 wide for 3 rounds | M | Fire burns it off. Lobs do not care. Water Butt |

### 3.6 Stoker (patches)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Boiled Over** | `[Launch]` | Edna Toast | Hot soup. 40 units flow downhill and pool, filling pits, tunnels and opened low Nooks. 12 Fire (18 to wood) and Burn to what it touches. The pool is an Ember patch for 2 turns | M | Water, Soaked, Cobble, high ground |
| **Water Butt** | `[Launch]` | Walt Brine | A flood. 60 units of water pool and soak. 10 Blast, Medium. Ends fires, washes off Sticky and Oil, turns Loam to Mud, shoves props 48 cells | L | High ground. It helps a rival whose fort is on fire |
| **Shiverpuff** | `[U2]` | Aunty Nip | A cold cloud: a Frost patch, Large (42), 2 turns. 15 Frost on landing. Blocks in it turn Brittle, Hobs in it need a rest (+1, once), Water turns to Ice, fire goes out | M | Fire melts the patch. Walk out. The kettle ignores it |

### 3.7 Patcher (support)

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Barn Raising** | `[Launch]` | Hetty Mortarboard | Dial picks one. **Rebuild**: up to 4 lost blocks that still have support return in their old material at 75% HP (Timber 38, Cobble 60, Brassbound 83). **Puff Up**, once per battle and for the player's side only against the AI (both sides in Couch Duel [00 §6.1]): re-inflate one Bonked Hob at 40 HP in the lowest free Nook, with a rest of 1 [R04 B9] | M | Break more than 4. Bonk the Patcher first. No free Nook, no return |
| **Tea Cosy** | `[Launch]` | Nurse Plumley | A steam bubble round one of your Nooks or the Kettle Room. Soaks the next hit, up to 60 damage, or fades after 2 rounds | M | Pop it with a cheap hit first (pellets, a Plain Shot). Wait 2 rounds |
| **Scrap Stack** | `[U1]` | Tacks Brassey | Throws up a wall of scrap on the ground where you aim: 1 block wide, 3 tall. Each scrap block has 50 HP, is fireproof and deals no crush. Blocks Flat shots. Metal | M | Lobs go over. Rock Cake and Heavy blasts clear it. Trencher's Spoon |

### 3.8 Lookout (scout) `[U2]`

The whole Class ships with Nithering Heights, where fog and hidden crew give it a job [R04 B10].

| Knack | Tag | Hob [D03] | Rule and numbers | W | Counter |
|---|---|---|---|---|---|
| **Chalk Fan** | `[U2]` | Winkle Peake | 5 harmless chalk arcs, 2 degrees apart. They stay all battle and reveal every room they cross | L | Chimney Cough, Soot Puff. Walk: the arcs stay where they were drawn |
| **Tattle Bell** | `[U2]` | Owl-Eyed Olive | A ringing bell. No damage. Its ring reveals every Nook within Huge (64). Hobs it reveals are Marked: the next hit on each deals 20% more | L | Heal or shield the Marked Hob. Spread Nooks past the ring |
| **Snoop Kite** | `[U2]` | Tansy Downe | A slow glider. Steered: drag steers it for 3 s. Reveals each Nook it passes over. Ends in a pop: 10 Blast, Tiny | L | Wind three leaves pushes it about. Any blast near it knocks it down |

### 3.9 Knack readability sheet

Colour and badge follow the damage type (1.3).

| Knack | Icon | Launch layer | Card text |
|---|---|---|---|
| Grand Dumpling | Fat dumpling with steam | Deep "bloomp" | "Huge dumpling. Hits the low row harder." |
| Tick-Tock Crock | Crock with a clock face | Slosh and tick | "Sits and ticks. Blows next turn." |
| Chimney Drop | Pot above a chimney | Rising whistle, then a hush | "Falls straight down on the roof." |
| Anvil Bun | Bun shaped like an anvil | Grunt and a heavy "whoof" | "One great stone. Goes through the floor." |
| Darning Needle | Sunbeam through a brick | Bright harp sting | "A ray through one wall." |
| Long Skewer | Skewer through three planks | Long "shiiing" | "Skewers three wood blocks. Rooms stay open." |
| Glimmerjolt | Jagged beam with a star | Snap and a hum | "A spark ray. Brass carries it on." |
| Clockwork Beetle | Beetle with a key | Ratchet whirr | "Slow dart. Tap once to turn it." |
| Pepper Rain | Pepper pot tipping | Shake-shake, rattle | "Splits up high. Rains seven stones." |
| Pan Parade | Five pans in a row | Five clangs, rising | "Five pans walk across the wall." |
| Rising Fizz | Soda bottle with three bubbles going up | Cork pop, then rising fizz | "Pops at the top. Bubbles fall upward." |
| Hailbasket | Basket of ice | Wicker creak, icy patter | "Eight ice pellets. All they hit goes brittle." |
| Seed Potato | Mole in a helmet | Muffled drum roll | "Bores in, then bursts inside." |
| Hairline | Chisel and a crack | Sharp tap, spreading crackle | "Cracks one block. What leans on it falls." |
| Molehill Surprise | Molehill with a flag | Scrabble, then "foomp" | "Burrows, then throws up a hill." |
| Roly-Poly | Pill bug in a ball | Rumble that rises | "Rolls along the ground, then bursts." |
| Ducks and Drakes | Flat stone with ripples | "Plip, plip, plip" | "Skips up to four times. Always ends big." |
| Clackerball | Ball with three ricochet marks | Hard "clack" | "Three bounces off anything, then boom." |
| Wobble Jelly | Jelly on a plate | Wobbly "blub" | "Small pop. Leaves a sticky patch." |
| Boiled Over | Tipped soup pot | Glug | "Hot soup runs downhill and burns." |
| Water Butt | Barrel with a wave | Slosh | "A flood. Soaks, shoves, makes mud." |
| Shiverpuff | Puffy cloud in a scarf | Breathy "hooo" | "A cold cloud that makes things brittle." |
| Barn Raising | Hammer and four planks | Four quick knocks | "Rebuild four blocks. Or bring back a Hob." |
| Tea Cosy | Nook in a bubble | Kettle whistle, soft "pop" | "A bubble that soaks the next hit." |
| Scrap Stack | Pile of pots and pans | Clatter that stacks up | "Throw up a wall of scrap." |
| Chalk Fan | Five chalk lines | Chalk squeak | "Five chalk arcs that stay and reveal." |
| Tattle Bell | Hand bell with an eye | Clear "ding" that spreads | "Rings out every Nook near. Marks the crew." |
| Snoop Kite | Kite with an eye | Flutter and string hum | "Fly it yourself. It peeks as it goes." |

### 3.10 Bench Knacks (enemy only)

Five Knacks in the first draft had no Hob. The enemies doc now gives four of them to Flattener units [D04 §2.2], so they ship as enemy-only Knacks with the unit's tag. The fifth is in Appendix B. Each has 2 uses, is Medium, and obeys Cover and both sim clamps.

| Knack | Tag | Fired by | Rule | Numbers | Counter |
|---|---|---|---|---|---|
| **Knock-Knock** | `[Launch]` | Ruler Sniper, Zinger | Two bolts on one aim. The second deals double to anything the first hit | 20 Pierce, then 40 (30 and 60 to a Hob; the kettle takes 60 at most). Was 30 and 60: the kettle clamp fired on every clean hit. Metal | A mound, hedge or scrap wall blocks both bolts. Cobble takes 12 and 24 |
| **Pogo Pot** | `[Launch]` | Plunger Pete, Bouncer | Bounces straight up 4 times on the spot. Each landing breaks down one layer | 4 x 18 Blast, Small. Timber takes 18 a landing: three landings break a full block | Cobble roofs (14 a landing). Sticky holds it after the first bounce |
| **Clatterline** | `[U1]` | Grit Spreader, Scatterjack | On impact, 5 pops march along the surface away from the shooter and follow wall tops | 5 x 16 Blast, Small, 20 cells apart | Cobble tops. Cover. A gap in the wall top stops the march |
| **Corkscrew** | `[U1]` | Dredger, Digger | A straight drill through 3 blocks. Leaves a Peephole in each. No blast | 40 Dig each: a full Timber block stands with a hole in it. Cobble 28, Brassbound 20 | Dollop closes the holes. Footing stops it |

---

## 4. Trick Shells

58 shells in 15 groups. Each is single use and drafted in the Rummage [00 §2.15]. 30 ship at launch, 8 in U1, 10 in U2 and 10 in U3 [R04 A]. There is no rarity [R04 B16]. Entries use this form:

- **Head line:** tag, Match Class (1.9), Weight, unlock source.
- **Does:** the rule. **Numbers.** **Materials:** what full blocks, the kettle and Hobs take, on the new HP (Wicker 30, Timber 50, Cobble 80, Brassbound 110). **Fun.** **Counter.** **Card:** card text, icon, launch layer. Colour follows the damage type (1.3).

**Unlock plan.**

| Source | Tag | Count | Shells |
|---|---|---|---|
| R1 start six (first Rummage) | `[Launch]` | 6 | Suet Pudding, Lid Lifter, Bag of Marbles, Nosy Goose, Mole Mail, Old Turnip |
| R1 levels and GF1 | `[Launch]` | 3 | Rubber Radish, Barrow Load; GF1 Quickset |
| R2 levels and GF2 | `[Launch]` | 4 | Cheese Wheel, Rock Cake, Roman Candle; GF2 Trencher's Spoon |
| R3 levels and GF3 | `[Launch]` | 4 | Odd Sock, Treacle Tart, Nan's Tonic; GF3 Skimmer |
| R4 levels and GF4 | `[Launch]` | 4 | Heavy Gravy, Hot Potato, Brolly; GF4 Copycat |
| Trial rewards, one per Trial | `[Launch]` | 6 | Grit Bin, Special Delivery, Dried Pea, Well Wisher, Wick Runner, Tinderbox |
| Kit set (Tinker node KT-02 Kitchen Drawer) | `[Launch]` | 3 | Dinner Gong, Miner's Lamp, Grandfather Clod |
| Loose shells, lent for one level (not unlocks) | `[Launch]` | 0 new | Lid Lifter in 1-3, Bag of Marbles in 1-4. One use, fixed in hand, no draft. Both are start-six shells, so they join the pool for good at 1-8 [00 §8.3] |
| Long Siege waves 5, 10, 15, 20, 25, 30 | `[U1]` | 6 | Squeaky Duck, Bumblejar, Alarm Egg, Rug Pull, Dragon Hiccup, Sleepy Sapper |
| U1 Trials | `[U1]` | 2 | Fizzwhistle, Lamp Oil Jug |
| Heights levels and Grand Fort | `[U2]` | 9 | Snowglobe, Plumb Bob, Featherfall Dust, Winter Pudding, Cold Shoulder, Spyglass Sparrow, Soot Puff, Sky Order; Grand Fort Bottled Gust |
| U2 Trial | `[U2]` | 1 | Icicle Drop |
| Mines levels and Grand Fort | `[U3]` | 8 | Static Sock, Snailbomb, Woodpecker, Lodestone Lump, Brass Marble, Puddle Jumper, Storm in a Teacup; Grand Fort Kettle Tickler |
| U3 Trial (the last Trial) | `[U3]` | 1 | Cuckoo Clock |
| Baron Rush clear | `[U3]` | 1 | Homecoming Hat |

The Grand Fort rewards match the enemies doc's asks: a hedge shell, a ledge-cutting dig, a skipper that splashes, a gust and a chain zap [D04 §3]. The last Grand Fort pays Copycat. The campaign doc's mode cards must show each mode reward listed here [A C36].

### 4.1 Splash (5)

One shell, one blast. The group differs by blast shape: wide and soft, tight and hard, upward, or through walls.

**1. Suet Pudding** `[Launch]` | Scatterjack | M | Unlock: R1 start six

- **Does:** A soft, very wide blast. It strips roofs and Wicker and shows what is inside.
- **Numbers:** 30 Blast, Huge (64). x2 to roof caps and Wicker. Carves ground at half depth.
- **Materials:** Wicker goes in one hit (72). Timber takes 30 of 50, Cobble 24, Brassbound 21. Cover halves it on Hobs (15). Kettle takes 15.
- **Fun:** One shot and the whole fort has lost its hat. Then you plan. Area is the Scatterjack's job, so the Scatterjack is its Match (the Lobber was overloaded with Matches).
- **Counter:** Cobble caps and Cover. It barely dents a hard wall.
- **Card:** "Huge soft blast. Blows the roofs off." Icon: wobbly pudding with a cherry. Layer: wet "splorp", then a deep whump.

**2. Rock Cake** `[Launch]` | Lobber | M | Unlock: R2

- **Does:** A dense cake that hates stone. It treats Cobble as soft and makes it fall harder.
- **Numbers:** 60 Blast, Small (18). x1.2 to Cobble, not x0.8. Cobble it breaks or drops deals +10 crush per block. Carves Rock.
- **Materials:** Cobble takes 72 of 80: any scratch and it breaks. Timber breaks (60). Brassbound takes 42. Mossbrick 36. Footing 15. Kettle 30.
- **Fun:** The answer to "my fort is all stone". Stone forts fall on their own crew.
- **Counter:** Skin Cobble with Brassbound or Timber. Keep heavy blocks off the rows above crew.
- **Card:** "Cracks Cobble. Stone falls hard." Icon: rock cake with a crack. Layer: gritty crunch.

**3. Dinner Gong** `[Launch]` | Scatterjack | M | Unlock: Kit set

- **Does:** A gong that rings through walls. It rattles crew, not blocks, and sets off every timer in the ring.
- **Numbers:** 32 Blast to each Hob within Large (42). No falloff. Ignores Cover. 0 to blocks, no crater. Timed props in the ring go off now.
- **Materials:** Walls do not matter. The Heartkettle takes 0. Hobs take it at x1.0.
- **Fun:** The fort stands and the crew sees stars. It also rings your own Hot Potato early.
- **Counter:** Seat Hobs more than 5 blocks apart. Tea Cosy soaks it. It never opens a wall.
- **Card:** "Rings through walls. Rattles every Hob near." Icon: gong and mallet. Layer: huge "BONGGG" with a wobble.

**4. Grandfather Clod** `[Launch]` | Lobber | H | Unlock: Kit set

- **Does:** The biggest lump in Brickabrac. So heavy it falls short.
- **Numbers:** 95 Blast, Huge (64). Launch speed x0.7, so about half range. Wind one leaf. Carves Rock, ground x1.5. The first side cannot fire it on turn one [00 §2.2].
- **Materials:** Wicker and Timber near the centre are gone. Cobble at the centre takes 76 of 80. Brassbound 67. Footing 24. Kettle 48. Your own fort takes it too if you stand close. Most of its worth is the fall it starts, not the 95.
- **Fun:** The shell everyone stops to watch. You must Walk close to use it, and close is where it bites you.
- **Counter:** Keep your distance: it cannot reach. Brolly halves it. Spread crew. A Hob who is not a Lobber sits out 2 turns after it.
- **Card:** "Enormous. Short range. Mind your own toes." Icon: boulder with a moustache. Layer: creaking rope, a hush, then a boom that ducks the music.

**5. Lid Lifter** `[Launch]` | Lobber | M | Unlock: R1 start six

- **Does:** A blast that goes up, not out. It hits the block it lands on and the blocks straight above.
- **Numbers:** 40 Blast to the block hit, 25 to each of up to 2 blocks above. Roof caps in that column fly off. No splash sideways.
- **Materials:** Wicker column: all three break. Timber takes 40 of 50, then 25 and 25. Cobble 32, 20, 20. Brassbound 28, 18, 18. A Hob in the column takes it as an outside blast (Cover).
- **Fun:** Shoot the wall low and the tower above jumps. On a hurt column the low block goes and the rest comes down.
- **Counter:** Cobble or Brassbound in the low rows. Wide forts lose one column, not the fort.
- **Card:** "The blast goes straight up the column." Icon: pot lid on a spring. Layer: "Pwing", then a clatter.

### 4.2 Cluster (3)

One shell becomes many. The group differs by when it splits and what the pieces do next.

**6. Bag of Marbles** `[Launch]` | Scatterjack | M | Unlock: R1 start six

- **Does:** Splits on impact into 8 marbles that roll downhill and pop.
- **Numbers:** 8 x 10 Blast, Tiny (10). Marbles roll for up to 2 s and pop when they stop or touch a Hob.
- **Materials:** Wicker takes 12 a marble: three clear a block. Timber 10, Cobble 8, Brassbound 7. Marbles find pits, open tops and gaps. Mud and Sticky hold them.
- **Fun:** You watch them hunt for the hole.
- **Counter:** Sticky patch, Mud, whole roofs with caps (they roll off).
- **Card:** "Bursts into eight rolling marbles." Icon: drawstring bag. Layer: glassy clatter.

**7. Fizzwhistle** `[U1]` | Scatterjack | M | Unlock: U1 Trial

- **Does:** Bursts at the top of its arc into 5 stars. They fly out in a ring and pop in the air.
- **Numbers:** 5 x 14 Blast, Small (18). Stars pop after 60 cells. No crater.
- **Materials:** Hits roofs and top Nooks from above and from the side. Timber takes 14 a star, Cobble 11.
- **Fun:** A firework that is useful. The skill is to put the apex right over the fort.
- **Counter:** Hard roofs and Cover. Walk to move the apex off your fort.
- **Card:** "Bursts at the top into five stars." Icon: rocket on a stick with a whistle. Layer: rising whistle, five crackles.

**8. Bumblejar** `[U1]` | Scatterjack | M | Unlock: Long Siege, wave 10

- **Does:** Bursts near any enemy piece into 6 bees. Each bee seeks the nearest Hob it can reach by air.
- **Numbers:** Near trigger at 40 cells. 6 x 10 Pierce (15 to a Hob, so 90 at most on one Hob). Bees reach 120 cells. Threads. Wind three leaves.
- **Materials:** Bees fly into Open Nooks and through Loopholes. With no Hob in reach they sting wood for 10. They bounce off Cobble and Brassbound.
- **Fun:** A near miss still pays, and bees pouring into a Loophole is a great clip.
- **Counter:** Wind, buried Loopholes, hard walls. A Squeaky Duck draws them off.
- **Card:** "Near miss? The bees finish the job." Icon: jar with a bee on the lid. Layer: angry buzz that rises.

### 4.3 Beam and Rapid (3)

Straight lines and streams. Beams need a lane. Rapid shells reward a steady aim point.

**9. Grit Bin** `[Launch]` | Scatterjack | L | Unlock: Trial reward

- **Does:** A cone of 7 grit pellets. Deadly close, weak far.
- **Numbers:** 7 x 8 Pierce in a 16 degree cone (12 each to a Hob, 84 at most). Each pellet loses 1 per 200 cells flown, down to 3. Threads.
- **Materials:** Pellets slip through Loopholes and gaps. Timber takes 8 a pellet, Cobble 5, Brassbound 4. Kettle 56 at most.
- **Fun:** A reason to spend Steam and Walk in.
- **Counter:** Distance, hard walls, a mound in front.
- **Card:** "A cone of grit. Deadly up close." Icon: pepper mill mid-sneeze. Layer: "PfffTCH".

**10. Miner's Lamp** `[Launch]` | Digger | L | Unlock: Kit set

- **Does:** A Digger's set-up Beam. It drills a straight lane through up to 4 blocks and leaves a Peephole in each, so the next shot can fly down it. It is the tunnel others shoot through, not a hit of its own.
- **Numbers:** 12 Pierce to each of up to 4 blocks in the line. 0 to Hobs and to the Heartkettle. Nothing behind the line takes damage.
- **Materials:** Every block in the line keeps standing with a hole in it: Timber takes 12 of 50, Cobble 7, Brassbound 6. The Peepholes are the point.
- **Fun:** One line through the whole fort. Next turn a Hatpin, Darning Needle or Long Skewer flies down it (the Keyhole combo), and a Beam through Peepholes hits the kettle in full.
- **Counter:** A mound or hedge in the lane. Dollop closes the holes. Walk to break the line.
- **Card:** "Drills a lane of holes. Shoot down it next." Icon: lantern with a drill beam. Layer: rising hum, four ticks.

**11. Woodpecker** `[U3]` | Scatterjack | M | Unlock: Mines

- **Does:** A tin bird that pecks one spot 6 times: five quick pecks, then one hard one.
- **Numbers:** Pecks of 6, 7, 8, 9, 10 and 20 Pierce (60 in all). If the block breaks, later pecks hit what is behind. Threads. Metal.
- **Materials:** Wicker breaks on the fourth peck, so a Hob behind takes 15 and 30. A full Timber block breaks on the last peck; a hurt one sooner. Cobble takes 36 in all and holds. Brassbound 30. Kettle 60 at most.
- **Fun:** A drill you aim. The last peck is the one that counts.
- **Counter:** Cobble and Brassbound. Dollop between turns.
- **Card:** "Six pecks, one spot. The last is the hard one." Icon: tin bird with a wind-up key. Layer: fast "tok-tok-tok".

### 4.4 Digger (5)

Shots that use the ground: under it, down through it, or by taking it away.

**12. Mole Mail** `[Launch]` | Digger | M | Unlock: R1 start six

- **Does:** Bores through the hill and bursts where it meets air or a block.
- **Numbers:** Bores up to 400 cells of Loam (Clay at half speed). 50 Blast, Medium (28). Leaves a tunnel 10 cells wide.
- **Materials:** Wicker and Timber at the centre break. Cobble takes 40 of 80. Brassbound 35. Stops at Rock, Bedrock and Footing and pops at half (6 to Footing). The tunnel stays as a lane for Flat shots.
- **Fun:** The hill between you is no longer cover.
- **Counter:** Rock and Clay maps, Footing, a Molehill in the yard.
- **Card:** "Tunnels through the hill and pops out the far side." Icon: mole with a letter. Layer: muffled scrabble, then a pop.

**13. Well Wisher** `[Launch]` | Digger | M | Unlock: Trial reward

- **Does:** Punches a shaft straight down from where it lands.
- **Numbers:** 40 Dig to each of up to 3 blocks in the column. In ground: a shaft 28 wide and 140 deep.
- **Materials:** Wicker breaks. Timber takes 40 of 50, Cobble 28, Brassbound 20. Stops at Footing and Rock. A Hob whose floor breaks drops a floor [00 §2.10].
- **Fun:** The floor goes and the Hob drops with a squeak.
- **Counter:** Cobble or Brassbound floors. A Cushion Loft. Footing.
- **Card:** "Punches a shaft straight down." Icon: well bucket on a rope. Layer: falling whistle, three thuds.

**14. Trencher's Spoon** `[Launch]` | Digger | L | Unlock: GF2

- **Does:** Scoops a wedge out of the ground along the firing line.
- **Numbers:** Wedge 140 long and 40 deep. 10 Dig to blocks in it. Clears mounds, hedges and ground patches in its path.
- **Materials:** Cuts Loam and Clay. Rock stops it. Water it opens runs downhill and drains.
- **Fun:** A set-up shot: a lane for bolts and Beams, a drained moat, a cut ledge, a ramp for a Cheese Wheel.
- **Counter:** Barrow Load fills it. Rock ground.
- **Card:** "Scoops a trench. Opens a lane." Icon: big wooden spoon. Layer: "Shhhunk".

**15. Sleepy Sapper** `[U1]` | Digger | H | Unlock: Long Siege, wave 30

- **Does:** Bores in, then naps. It wakes with a bang two turns on, or at once if a castle stands or walks over it.
- **Numbers:** Bores up to 300 cells. A prop under the ground, shown as a snoring mound. 90 Blast, Large (42). Carves ground x1.5.
- **Materials:** Under a fort the Footing soaks the blast (23), but the ground goes and the fort drops. A drop over 48 is a Thump [00 §2.7].
- **Fun:** A snoring trap that owns a patch of the map.
- **Counter:** Do not walk over it. A Squeaky Duck or any roller wakes it early. A Digger shot digs it up. Jack Screws lift you after.
- **Card:** "Digs in and naps. Wakes with a bang." Icon: mole in a nightcap. Layer: snore loop, then an alarm clock.

**16. Rug Pull** `[U1]` | Digger | M | Unlock: Long Siege, wave 20

- **Does:** Scoops a wide bowl of ground from under a fort. The fort drops.
- **Numbers:** Bowl 96 wide and 50 deep. No blast. 20 Dig to blocks in the bowl. A fort drops only when its whole footprint loses ground; forts over 6 blocks wide need two.
- **Materials:** A drop over 48 is a Thump: 10 to every block and Hob [00 §2.7]. Wicker forts lose a third of every block. Rock and Bedrock hold.
- **Fun:** The whole fort drops with a bump and every Hob bounces.
- **Counter:** Walk off first. Stand on Rock. Jack Screws lift you back. A sunk fort gains cover from Flat shots.
- **Card:** "Pulls the ground out from under them." Icon: rug with tassels, flying. Layer: cloth snap, long slide whistle.

### 4.5 Roller (4)

Shots that travel on the ground. All use the Roller hop. Mud, Sticky and Water are their end.

**17. Cheese Wheel** `[Launch]` | Bouncer | M | Unlock: R2

- **Does:** Rolls only downhill. The more height it loses, the harder it hits.
- **Numbers:** 20 Blast, +1 per 5 cells of height lost, max 90. Medium (28). On flat or uphill ground it stops and bursts.
- **Materials:** At full speed: Timber is gone, Cobble takes 72 of 80, Brassbound 63. From flat ground: Timber takes 20. Roller hop puts the burst on the first Body row.
- **Fun:** The map becomes a ramp. Dig the slope first and aim it at the gate.
- **Counter:** Be uphill. A Stomp ditch, Mud, Sticky, a Sod bump.
- **Card:** "Rolls downhill. Faster means bigger." Icon: cheese wheel with speed lines. Layer: rumble that rises in pitch.

**18. Wick Runner** `[Launch]` | Stoker | M | Unlock: Trial reward

- **Does:** Rolls and leaves a trail of fire, then ends in a small fire burst.
- **Numbers:** Rolls 3 s. An Ember patch along up to 150 cells for 2 turns. End burst: 25 Fire, Small (18), and Burn.
- **Materials:** Timber takes 38 of 50 and Burn finishes most of the rest. Wicker is gone. Lights Sticky patches, hedges and wood rows next to the trail. Cobble takes 5. Brassbound 0.
- **Fun:** You draw a line of fire across the map.
- **Counter:** Water, Mud, Soaked. Cobble low rows.
- **Card:** "Rolls and leaves a trail of fire." Icon: ball of string, alight. Layer: fizzing fuse.

**19. Snailbomb** `[U3]` | Bouncer | M | Unlock: Mines

- **Does:** Crawls along any surface: up the wall, over the roof and into the first gap.
- **Numbers:** Crawls 40 cells a second for 4 s. Bursts at the end or on a Hob. 65 Blast, Small (18).
- **Materials:** Inside a gap or Open Nook it deals full damage. Timber breaks. Cobble takes 52 of 80. Sticky holds it. Ice makes it slide off.
- **Fun:** Slow dread. Both sides watch it climb.
- **Counter:** Sticky patch, Ice. Close the gap with a Dollop.
- **Card:** "Crawls up the wall and over." Icon: snail with a fuse. Layer: squelchy creep with a tick.

**20. Brass Marble** `[U3]` | Bouncer | M | Unlock: Mines

- **Does:** A very heavy ball. No blast. It hits what it touches and keeps going.
- **Numbers:** 18 Pierce on each touch of a block or Hob, up to 5 touches, at most 2 on any one target. Low bounces, then it rolls. Wind one leaf. Metal.
- **Materials:** Wood takes 18 a touch, Cobble 11, Brassbound 9. A Hob takes 27 a touch (54 at most). Kettle 36 at most. Inside an opened fort it plays pinball.
- **Fun:** No bang at all, and still the room goes quiet.
- **Counter:** Sticky, Mud, Brassbound.
- **Card:** "No bang. Just a very heavy ball." Icon: shiny ball. Layer: "Dong... dong... dong".

### 4.6 Bouncer (4)

Shots that hop, skip or come back. The preview stops at the first bounce [00 §2.4], so these are the skill group.

**21. Rubber Radish** `[Launch]` | Bouncer | M | Unlock: R1

- **Does:** Bounces 5 times. Every bounce pops.
- **Numbers:** Each bounce: 14 Blast, Tiny (10). Last touch: 30 Blast, Small (18). Keeps 80% speed per bounce.
- **Materials:** Wicker takes 17 a pop: two break it. Timber 14, then 30 at the end. Cobble 11 and 24.
- **Fun:** A line of pops that walks toward the fort.
- **Counter:** Sticky, Mud, Water.
- **Card:** "Five bouncing pops." Icon: radish with a grin. Layer: "Boing-pop", five times.

**22. Dried Pea** `[Launch]` | Bouncer | M | Unlock: Trial reward

- **Does:** Only the last touch bursts. Each bounce before it adds power.
- **Numbers:** 30 Blast, +15 per bounce. Bursts on the fourth touch (75), or at once on a Hob. Medium (28).
- **Materials:** At 75: Timber is gone, Cobble takes 60 of 80, Brassbound 53. Bounces off ground, blocks and Rock.
- **Fun:** The bank shot you brag about.
- **Counter:** Sticky, Mud.
- **Card:** "Each bounce adds power. Bursts on the fourth touch." Icon: pea with stars round it. Layer: pitch climbs on each bounce.

**23. Skimmer** `[Launch]` | Bouncer | M | Unlock: GF3

- **Does:** Skips up to 5 times and soaks what it skips on.
- **Numbers:** Skips on ground and Water (and Ice from U2) if it lands at under 30 degrees. Each skip: 12 Blast, Tiny, and Soaked within 18. Last touch: 35 Blast, Small.
- **Materials:** Timber takes 35 of 50 at the end, Cobble 28. Skips twice as far on Water, so a moat helps the attacker. Turns Loam to Mud as it goes. Puts out fires along its path.
- **Fun:** A pond is now a runway.
- **Counter:** Sticky, Mud, rough ground, steep landings.
- **Card:** "Skips and soaks. Loves a pond." Icon: flat stone with drops. Layer: "Plip, plip, sploosh".

**24. Homecoming Hat** `[U3]` | Lobber | M | Unlock: Baron Rush clear

- **Does:** Flies out, turns round and flies home low. It hits the back of what it passed.
- **Numbers:** Turns at 70% of its arc. 75 Blast, Medium (28). If it hits nothing, it lands near you.
- **Materials:** Back walls are often thin, and a kettle is often closer to the back. Timber is gone, Cobble takes 60 of 80. Kettle 38.
- **Fun:** Hit the kettle from behind. Or hit yourself, which is also a good clip.
- **Counter:** Thick back walls. A Bottled Gust on its way home.
- **Card:** "Flies past, turns round, hits the back." Icon: bowler hat with wings. Layer: "Whup-whup-whup".

### 4.7 Guided (3)

Shots that steer themselves. At launch every Nook counts as Revealed (1.2), so they always have a target. Each is weak for its Weight: you pay for the help. From U2 they need a Revealed Nook or the kettle glow.

**25. Special Delivery** `[Launch]` | Zinger | L | Unlock: Trial reward

- **Does:** Pick an address. The parcel flies itself and comes down the chimney.
- **Numbers:** Dial: tap an enemy Hob you can see or the Heartkettle. 18 Pierce (27 to a Hob). Ignores walls and Cover.
- **Materials:** Material does not matter. The kettle takes 18.
- **Fun:** The sure finisher when a Hob has 20 HP left.
- **Counter:** Tea Cosy. Heal. From U2: stay hidden.
- **Card:** "Pick an address. It always arrives." Icon: parcel with wings. Layer: bicycle bell.

**26. Nosy Goose** `[Launch]` | Zinger | M | Unlock: R1 start six

- **Does:** Bends toward a Hob it can see, late in its flight.
- **Numbers:** Bends up to 25 degrees toward the nearest enemy Hob or the kettle in the last third of the arc. 48 Blast, Small (18).
- **Materials:** Walls still stop it. Timber takes 48 of 50, Cobble 38, Brassbound 34. Cover halves it on the Hob.
- **Fun:** It honks when it turns. A rescue for rough aim.
- **Counter:** Walls and Cover. From U2: stay hidden (Chimney Cough).
- **Card:** "Bends toward a Hob it can see." Icon: goose head, neck out. Layer: a honk at the turn.

**27. Plumb Bob** `[U2]` | Zinger | M | Unlock: Heights

- **Does:** Stops over its target and drops straight down through two floors.
- **Numbers:** Stops over a Revealed Nook or the kettle column. 35 Blast, Small (18), on each of 2 floors. Metal.
- **Materials:** Breaks Wicker floors. Timber takes 35 of 50 a burst. Cobble and Brassbound roofs stop the first burst.
- **Fun:** You overshoot on purpose and it corrects.
- **Counter:** Brolly, hard roofs, staying hidden.
- **Card:** "Stops over its target and drops." Icon: plumb weight on a string. Layer: a "tink" as it stops, then a whistle.

### 4.8 Terrain builder (3)

Shots that add ground, blocks or patches. Each opens or shuts a play for the next two turns.

**28. Barrow Load** `[Launch]` | Digger | L | Unlock: R1

- **Does:** Drops a heap of dirt.
- **Numbers:** A Loam mound, radius 36. No damage.
- **Materials:** Fills craters and tunnels. Buries a Loophole, so that Hob is dug in and its Fire button greys until the dirt is cleared (1.6). Smothers Ember patches. In Water it becomes Mud.
- **Fun:** Bury their window. Their best shooter must wait or be dug out.
- **Counter:** Any blast clears it. Digger shots and Dollop dig out.
- **Card:** "Drops a heap of dirt." Icon: sack spilling soil. Layer: "Floomp".

**29. Quickset** `[Launch]` | Patcher | M | Unlock: GF1

- **Does:** Grows a tall hedge where it lands, on ground or on a roof.
- **Numbers:** 1 block wide, 6 tall. Six hedge blocks of 30 HP. Wicker rules: burns, no crush.
- **Materials:** Stops Flat shots, Beams and sight lines. Bees get lost in it. Lobs go over.
- **Fun:** An instant wall. Or set fire to theirs.
- **Counter:** Fire. Lobs. Trencher's Spoon.
- **Card:** "Grows a tall hedge. It burns." Icon: clipped hedge. Layer: leafy rustle that swells.

**30. Treacle Tart** `[Launch]` | Stoker | L | Unlock: R3

- **Does:** Lays a sticky patch. Anything that rolls or bounces stops in it.
- **Numbers:** Sticky patch, 110 cells wide, 4 turns. Rollers, skippers, bouncers and marbles stick and burst there. Walking across costs x3 Steam. 5 Blast.
- **Materials:** Burns: any Fire turns it into an Ember patch for 2 turns. Water washes it off.
- **Fun:** Lay it in front of your fort and watch their Roly-Poly stop dead.
- **Counter:** Fire. Lobs do not care. Water Butt.
- **Card:** "Sticky patch. Stops anything that rolls." Icon: tart with drips. Layer: "Glorp".

### 4.9 Fire (4)

Fire wins against wood and loses to stone, brass and water.

**31. Roman Candle** `[Launch]` | Stoker | M | Unlock: R2

- **Does:** A fireball that cools as it flies. A fast, flat shot hits hardest.
- **Numbers:** 60 Fire at launch, less 15 per second of flight, never under 15. Small (18). Burn.
- **Materials:** A hot comet breaks any wood block (90). A cold one deals 23 and Burn. Cobble takes 12 at most. Brassbound and the kettle take 0.
- **Fun:** Walk close for a hot shot. Range is the dial.
- **Counter:** Distance, Cobble, Brassbound, Water, Soaked.
- **Card:** "Hot when fresh. Fire it fast and flat." Icon: candle with a comet tail. Layer: a roar that fades with range.

**32. Tinderbox** `[Launch]` | Stoker | M | Unlock: Trial reward

- **Does:** One spark that keeps spreading.
- **Numbers:** 10 Fire, Point. The Burn it starts spreads to touching wood every turn for 3 turns, not once.
- **Materials:** Each burning block loses 16 over two turns: over half a Wicker block, a third of a Timber block. A Cobble row is a firebreak.
- **Fun:** A slow disaster the rival must answer.
- **Counter:** Cobble firebreaks, Soaked, Dollop (ends Burn on a block), Water Butt.
- **Card:** "One spark. It keeps spreading." Icon: glowing beetle. Layer: tiny crackle and a chirp.

**33. Lamp Oil Jug** `[U1]` | Stoker | L | Unlock: U1 Trial

- **Does:** Oil today, fire tomorrow. A set-up shell with no damage.
- **Numbers:** 30 units of oil. Flows and lays an Oil patch for 5 turns. Oiled blocks can Burn whatever they are made of (the Burn tick only). Burn on oiled wood lasts 4 turns.
- **Materials:** Makes Cobble and Brassbound burnable: 16 a block, or 32 on oiled wood. Fire lights it. Water washes it off. Footing and the kettle stay immune.
- **Fun:** The stone fort that thought it was fireproof.
- **Counter:** Water Butt, high ground. Or light it early on your own terms.
- **Card:** "Oil today. Fire tomorrow." Icon: oil jug. Layer: glug.

**34. Dragon Hiccup** `[U1]` | Stoker | M | Unlock: Long Siege, wave 25

- **Does:** On impact it hiccups a jet of flame straight on along its line of flight.
- **Numbers:** Jet 90 cells long. 22 Fire and Burn to everything in it. Passes Loopholes, gaps and Open Nooks.
- **Materials:** Wood in the jet takes 33 and Burn. A jet that enters a Nook hits the Hob in full. Cobble and Brassbound stop the jet.
- **Fun:** Aim at a Loophole and the flame goes in.
- **Counter:** Hard walls, a buried Loophole, Soaked.
- **Card:** "Hic! A jet of flame goes straight on." Icon: small dragon, hand over mouth. Layer: "Hic", then a whoosh.

### 4.10 Frost (4) `[U2]`

Frost does little damage and sets up the next hit. The whole group ships with the Heights.

**35. Snowglobe** `[U2]` | Stoker | M | Unlock: Heights

- **Does:** Everything inside the globe goes brittle.
- **Numbers:** 25 Frost, Large (42). Blocks get Brittle. Hobs in it need a rest (+1, once). Water turns to Ice. Fire goes out.
- **Materials:** Blocks take 13. Every material turns Brittle: the next Blast or Pierce hit deals x1.5. The Heartkettle does not. Footing does not.
- **Fun:** The fort turns to glass. The next hit shatters it.
- **Counter:** Fire ends Brittle. Dollop ends it on one block. Hit first before they follow up.
- **Card:** "Shake it. Everything inside goes brittle." Icon: snow globe. Layer: sleigh-bell shimmer.

**36. Icicle Drop** `[U2]` | Stoker | M | Unlock: U2 Trial

- **Does:** Falls straight down from its apex. Hits wet or brittle things much harder.
- **Numbers:** 36 Pierce, Point. Against a Brittle or Soaked target: 54 (81 to a Hob), and it uses up the status. Wind stops at the apex.
- **Materials:** The second step of a two-step: Snowglobe or Odd Sock first, then this. 54 breaks a full Timber block.
- **Fun:** The shatter you set up yourself.
- **Counter:** Brolly. Stay dry. Fire.
- **Card:** "Hits wet or brittle things much harder." Icon: icicle. Layer: "Tinkle", then a crack.

**37. Cold Shoulder** `[U2]` | Stoker | M | Unlock: Heights

- **Does:** Frosts every Hob near. Each one needs a rest.
- **Numbers:** Hobs within Large (42) get +1 turn on their cog, or a cog of 1 if they have none. Never more than +1 on any Hob (1.2). No Cover: cold seeps in. 10 Frost.
- **Materials:** Blocks only take 5 and Brittle does not apply.
- **Fun:** Freeze their big gun just after it fires a Heavy shell. The rival still has a shot: it must come from someone else.
- **Counter:** Spread crew. Smelling Salts and Nan's Tonic clear the cog. Fire.
- **Card:** "Frosts every Hob near. Each needs a rest." Icon: hob with a frosty shoulder. Layer: "Brrrr".

**38. Winter Pudding** `[U2]` | Stoker | M | Unlock: Heights

- **Does:** Freezes everything wet.
- **Numbers:** Within Huge (64): Water, Mud and fluids turn to Ice. Fires go out. Soaked blocks take 40 Frost (20) and turn Brittle. Soaked Hobs need a rest. Dry things take 10 Frost (5).
- **Materials:** A frozen moat is a road for rollers and skippers. A frozen flood is a bridge.
- **Fun:** Pour a flood, then freeze it. Two shells, new map.
- **Counter:** Stay dry. Fire turns Ice back to Water.
- **Card:** "Freezes everything wet." Icon: pudding with icicles. Layer: creaking ice.

### 4.11 Shock (4) `[U3]`

Zap is the brass breaker and a kettle type. The whole group ships with the Mines.

**39. Static Sock** `[U3]` | Scatterjack | M | Unlock: Mines

- **Does:** A zap, and a spark that jumps to the nearest Hob.
- **Numbers:** 35 Zap, Small (18). Chains through touching Brassbound at half per link. One spark jumps to the nearest Hob within 40 cells: 20 Zap (24), no Cover.
- **Materials:** Wood and stone take 11. Brassbound takes 35 of 110 and passes it on. The kettle takes 35.
- **Fun:** The sock always finds someone.
- **Counter:** No brass near crew. Lightning Rod. Spread Nooks.
- **Card:** "Zap, and a spark jumps to the nearest Hob." Icon: sock with sparks. Layer: crackle and "bzzt".

**40. Kettle Tickler** `[U3]` | Zinger | M | Unlock: Mines Grand Fort

- **Does:** A flat Zap bolt. Brass carries it all the way in.
- **Numbers:** 50 Zap, Point (60 to a Hob). If it hits Brassbound, the charge runs along touching Brassbound with no loss. Each Hob in a Nook walled by that run takes 15. If the run touches the Kettle Room, the kettle takes 40. Metal.
- **Materials:** On wood or stone it is a weak point shot (15). On a brass fort it is a fuse.
- **Fun:** The rival's best armour becomes the way in.
- **Counter:** Break the brass run with any other material. Lightning Rod. Tea Cosy.
- **Card:** "Brass carries it all the way in." Icon: feather with a spark. Layer: a giggle, then a buzz.

**41. Storm in a Teacup** `[U3]` | All | H | Unlock: Mines

- **Does:** A small storm cloud that follows the wind and strikes the tallest thing under it.
- **Numbers:** A Storm patch. Drifts 20 cells per wind point each turn and stops over the first enemy piece. At the start of your next 3 turns: 25 Zap to the tallest block under it, with brass chains. Rain Soaks what is below.
- **Materials:** A tall Wicker spire takes the strike for the fort (8). Brassbound takes 25 and chains.
- **Fun:** Weather with a grudge. Push it with a gust.
- **Counter:** Lightning Rod. Walk. Bottled Gust blows it back. Build a spire.
- **Card:** "A small storm that follows the wind." Icon: teacup with a cloud. Layer: thunder roll and a china "tink".

**42. Puddle Jumper** `[U3]` | Stoker | M | Unlock: Mines

- **Does:** Shocks everything wet.
- **Numbers:** Dry: 15 Zap, Small (18). Wet: 30 Zap to everything in Water, on Mud or Soaked within 110 cells. No Cover.
- **Materials:** Soaked targets take Zap x1.5 after the material or Hob multiplier [A C22]. A Soaked Hob takes 54. Soaked Brassbound takes 45. Soaked wood takes 14.
- **Fun:** Flood first, then zap. The whole pond lights up.
- **Counter:** Stay dry. High ground.
- **Card:** "Shocks everything wet." Icon: frog with a spark. Layer: "Ribbit", then a zap.

### 4.12 Gravity (3)

Shots that change how things fall, fly or hang.

**43. Heavy Gravy** `[Launch]` | Lobber | M | Unlock: R4

- **Does:** Makes blocks too heavy to hang.
- **Numbers:** The block hit and each block touching it turn Heavy for 2 turns: side support does not hold them and their crush is x2. 10 Blast.
- **Materials:** Blocks with nothing below them fall at once. Columns do not care. Balconies and overhangs do. Heavy Cobble lands for 60 a block, which breaks Timber and most of a Cobble block.
- **Fun:** The clever overhang that fooled three Rivals comes down.
- **Counter:** Build columns. Dollop wipes the gravy off one block.
- **Card:** "Makes blocks too heavy to hang." Icon: gravy boat with a weight. Layer: "Glug", then a long creak.

**44. Featherfall Dust** `[U2]` | Patcher | M | Unlock: Heights

- **Does:** Half gravity inside a big circle.
- **Numbers:** A Feather patch, radius 90, 3 turns. Shells inside fall at half speed, so they sail long. Falling chunks deal half crush. No fall damage inside.
- **Materials:** Lob shots overshoot. Flat shots and Beams barely change.
- **Fun:** The rival's saved aim sails over your roof.
- **Counter:** Re-aim (Recall will lie). Flat shots and Beams.
- **Card:** "Half gravity in a big circle." Icon: feather. Layer: harp slide up.

**45. Lodestone Lump** `[U3]` | All | M | Unlock: Mines

- **Does:** A magnet for shells. Everyone's shells.
- **Numbers:** A prop with 40 HP. Sticks where it lands for 4 turns. Every shell within 150 cells bends toward it. Metal shots bend twice as hard. Beams ignore it.
- **Materials:** Place it by the rival and your shots curve in. Place it by a hill and it eats their shots.
- **Fun:** It bends the rules for both sides, so the better planner wins.
- **Counter:** Break it (40 HP: two Clodpots near it). Beams. Use it yourself.
- **Card:** "A magnet for shells. Everyone's shells." Icon: rock with a horseshoe magnet. Layer: low hum.

### 4.13 Timed (4)

Shots that act on a later turn. The rival always sees them and always has one turn to answer.

**46. Hot Potato** `[Launch]` | Lobber | M | Unlock: R4

- **Does:** Lands, sits and blows at the start of your next turn. Unless someone bats it back.
- **Numbers:** A prop with 20 HP. 85 Blast, Large (42). Any blast shoves it 1 cell per point of damage, up to 80.
- **Materials:** Wicker and Timber at the centre are gone. Cobble takes 68 of 80. Brassbound 60. Kettle 43. A shove can send it home.
- **Fun:** The rival spends a turn batting it back. Then you bat it back.
- **Counter:** Shove it. Walk. Water Butt. A Dinner Gong sets it off now.
- **Card:** "Blows next turn. Unless someone bats it back." Icon: steaming potato. Layer: sizzle and a tick.

**47. Alarm Egg** `[U1]` | Bouncer | L | Unlock: Long Siege, wave 15

- **Does:** Sits and waits for footsteps.
- **Numbers:** A prop with 15 HP, 4 turns. Bursts when a castle comes within 70 cells or a roller or prop touches it: 55 Blast, Medium (28). If nothing trips it, it hatches a harmless chick.
- **Materials:** Timber at the centre breaks. Cobble takes 44. Mostly it guards ground.
- **Fun:** Area denial with a chick at the end.
- **Counter:** A Squeaky Duck or any roller trips it. Shoot it. Do not walk there.
- **Card:** "Sits and waits for footsteps." Icon: egg with an alarm bell. Layer: idle "cheep". Then a bell.

**48. Sky Order** `[U2]` | Lookout | M | Unlock: Heights

- **Does:** Mark a spot. Stones fall on it next turn.
- **Numbers:** A flare marks where it lands; both sides see the ring. At the start of your next turn 4 stones fall straight down, 20 cells apart: 26 Blast, Small (18) each.
- **Materials:** Ignores wind and hills. Hits roofs. Two stones on one Timber block break it. Cobble takes 21 a stone. The mark stays on the ground if the fort walks.
- **Fun:** The Lookout gets a punch, and the rival must choose: Walk or take it.
- **Counter:** Walk. Brolly. Cobble roof.
- **Card:** "Mark a spot. Stones fall there next turn." Icon: order slip with a rock stamp. Layer: flare fizz. Next turn: four falling whistles.

**49. Cuckoo Clock** `[U3]` | All | M | Unlock: U3 Trial

- **Does:** Sticks to a block and pops the same spot three turns running.
- **Numbers:** A prop with 10 HP. At the start of each of your next 3 turns: 20 Blast, Tiny (10). If the block is gone, the pop drops to the next thing below. A block with a clock on it does not heal. Metal.
- **Materials:** Timber takes 60 in all and breaks on the third pop. Cobble takes 48. Mossbrick takes 36 and cannot heal while the clock is on it.
- **Fun:** A nag. The rival hears the cuckoo and winces.
- **Counter:** Dollop knocks it off. So does any hit.
- **Card:** "Pops the same spot three turns running." Icon: cuckoo clock. Layer: "Cuck-oo" before each pop.

### 4.14 Utility and support (5)

Shield, scout, wind and heal. No damage. Each must be worth a turn.

**50. Brolly** `[Launch]` | Patcher | M | Unlock: R4

- **Does:** Stops the next thing that falls on you.
- **Numbers:** Opens over your own castle for 2 turns. The first shell that comes down steeper than 45 degrees bounces off harmless, and the Brolly shuts. A Heavy shell breaks it and loses half its damage.
- **Materials:** Flat shots, Bore shots and rollers pass under it.
- **Fun:** Their Grand Dumpling bounces into the field.
- **Counter:** Flat shots, Beams, rollers. Bait it with a Plain Shot.
- **Card:** "Stops the next thing that falls on you." Icon: umbrella. Layer: "Fwip", then "pop".

**51. Nan's Tonic** `[Launch]` | Patcher | M | Unlock: R3

- **Does:** Tea for the crew. Heals and warms.
- **Numbers:** Lands on your own castle. The Hob in the Nook hit heals 35. Hobs in touching Nooks heal 15. Ends Burn on all of them and clears any rest an enemy added.
- **Materials:** No damage.
- **Fun:** Tea fixes everything.
- **Counter:** Focus one Hob. Out-damage the heal.
- **Card:** "Tea for the crew. Heals and warms." Icon: teapot with heart-shaped steam. Layer: a pour and an "aaah".

**52. Spyglass Sparrow** `[U2]` | Lookout | L | Unlock: Heights

- **Does:** Flies over and peeks in every window.
- **Numbers:** Flies straight at the launch angle with no gravity for 1200 cells. Reveals every Nook within 60 cells of its path, with HP. Shows the rival's Doodads. Wind three leaves.
- **Materials:** No damage.
- **Fun:** A fly-by that turns outlines into faces.
- **Counter:** Chimney Cough. Soot Puff.
- **Card:** "Flies over and peeks in every window." Icon: sparrow with a spyglass. Layer: chirp.

**53. Soot Puff** `[U2]` | All | L | Unlock: Heights

- **Does:** A black cloud. Nobody aims well through it.
- **Numbers:** A Soot patch, radius 70, 3 turns. Drifts 10 cells per wind point each turn. Inside: no preview dots, Ghosts or pins. Revealed Nooks inside go back to last-known. AI aim error x2 into or out of it. Bees get lost.
- **Materials:** No damage. Rain and gusts clear it.
- **Fun:** Hide your weak Nook, or blind their sniper.
- **Counter:** Bottled Gust, Water Butt, time. Big blasts do not need eyes.
- **Card:** "A black cloud. Nobody aims well through it." Icon: soot cloud with eyes. Layer: a cough.

**54. Bottled Gust** `[U2]` | All | L | Unlock: Heights Grand Fort

- **Does:** Uncork a gale for two turns.
- **Numbers:** Dial: left or right. Wind is 8 that way for the rival's next turn and your next turn. Shoves props and Soot and Storm patches 60 cells. Then the Weather Front's wind returns.
- **Materials:** Fans fire (combo 1). Blows Storm patches and Hot Potatoes about.
- **Fun:** The rival's saved aim is now wrong, and you knew the wind first.
- **Counter:** Weathercock. Beams and bolts.
- **Card:** "Uncork a gale for two turns." Icon: bottle with a swirl inside. Layer: cork pop, then a howl.

### 4.15 Chaos and jokes (4)

Duds and a copycat. Every Dud says "Dud" on its card and does one small useful thing [R02 §3.1].

**55. Old Turnip** `[Launch]` | All | L | Dud | Unlock: R1 start six

- **Does:** It is a turnip.
- **Numbers:** 1 Blast, Tiny. Three sad bounces. Then it sits there: a prop with 10 HP that stops the first roller or marble to touch it.
- **Materials:** Nothing notices.
- **Fun:** The fun is in the Rummage: make the rival take it. And once in a while a turnip stops a Roly-Poly.
- **Counter:** Do not pick it. Or pick it so the rival cannot leave it for you.
- **Card:** "Dud. It is a turnip." Icon: turnip. Layer: sad parp.

**56. Odd Sock** `[Launch]` | All | L | Dud | Unlock: R3

- **Does:** Wet. Smelly. Technically a shell.
- **Numbers:** 2 Blast. Soaks what it hits and all within 18 cells.
- **Materials:** Soaked ends Burn and blocks new Burn for a turn. From U2 it also sets up Icicle Drop and Winter Pudding, and from U3 Puddle Jumper.
- **Fun:** The Dud with a secret job. Players who find it feel clever.
- **Counter:** Not needed.
- **Card:** "Dud. Wet. Smelly. Puts fires out." Icon: dripping sock. Layer: wet slap.

**57. Squeaky Duck** `[U1]` | All | L | Dud | Unlock: Long Siege, wave 5

- **Does:** Squeak. Squeak. Squeak.
- **Numbers:** 0 damage. Six bounces. Floats on Water.
- **Materials:** Trips every Tripped prop it passes (Alarm Egg, Molehill) and wakes a Sleepy Sapper. Bees chase it.
- **Fun:** A safe way to clear traps, and the funniest sound in the game.
- **Counter:** None needed.
- **Card:** "Dud. Squeak. Trips traps." Icon: rubber duck. Layer: a squeak on every bounce.

**58. Copycat** `[Launch]` | All | M | Unlock: GF4

- **Does:** Copies the rival's last Trick Shell.
- **Numbers:** Becomes a copy of the last Trick Shell the rival fired, with that shell's Weight and Match Class. If the rival has fired none, it is an Old Turnip.
- **Materials:** As the shell it copies.
- **Fun:** The rival's best shell is yours too. Fire your Dud first and their Copycat copies a turnip.
- **Counter:** Fire dull shells before good ones. Hold your best for last.
- **Card:** "Copies the rival's last Trick Shell." Icon: pot shaped like a cat. Layer: a meow with an echo.

### 4.16 Enemy shots: Twists and enemy Knacks

**Rule.** Every enemy unit fires its Class Plain Shot from section 2 under its own skin, and one Knack from this doc: a crew Knack (section 3), a bench Knack (3.10) or a Flattener Twist (below) [A C31]. No enemy shot exists without stats in this doc. Enemy Knacks have 2 uses and obey Weight, Cover and both sim clamps like any shot. Puff Up is never on an enemy Knack [R04 B9].

**Junk Shell** is parked (Appendix B.1). It needed a Kit keystone, and the four-branch tree has none [D02 §1.6].

**Flattener Twists.** Nine enemy-only Knacks. Each has a tell the player can see and a counter.

| # | Twist | Tag | Unit, Class | Rule | Numbers | W | Tell | Counter |
|---|---|---|---|---|---|---|---|---|
| 1 | **Topiary Drop** | `[Launch]` | Hedger, Lobber | A big hedge ball. Where it lands it leaves a bush block on your roof or the ground, snapped to the grid | 45 Blast, Large (42). Bush: 30 HP, Wicker rules. A bush on a Loophole digs that Hob in (1.6) | M | Slow high arc, leaves in the trail | One Fire shot clears the bush. Nibbler or Dollop digs out |
| 2 | **Mow Line** | `[Launch]` | Mower, Bouncer | A roller that shaves the top off small bumps it rolls over, then bursts | Rolls 3 s. Carves bumps under 16 cells tall flat. 50 Blast, Medium (28) | M | Toy mower revs on the sill | Mud, Sticky, uphill ground |
| 3 | **Fill Up** | `[Launch]` | Filler, Patcher | Rebuilds, or fills a crater near its own fort to the level line | Rebuild 4 blocks at 75% HP. Or add Loam up to 60 deep and 120 wide within 200 cells of its fort | M | Mortar bucket icon over its Nook | Bonk it first. Dig again: Loam carves easily |
| 4 | **Gust Puff** | `[U2]` | Gust Bellows, Lookout | Changes the wind for the next turn only. The forecast shows it at once | Wind +2 or -2 for one turn. No damage | L | Bellows pump outside its Nook | Hit the bellows and it drops: no more Gust Puff this battle. The Hob keeps its turn [A C44]. Beams and bolts ignore wind |
| 5 | **Prop Up** | `[Launch]` | Shoring Crew, Patcher | Rebuilds brass, or braces one column so it ignores the support rule | Rebuild 4 Brassbound blocks at 50% HP (55 each). Or brace one column (one block wide, from the Footing up) for 2 turns: its blocks cannot fall from lost support. They still break at 0 HP. Same sim rule as Hetty's Ridgepole [D03] | M | Braced columns glow yellow | Bonk it and the braces drop at once, and the support check runs: a free collapse. Heavy Gravy. Kettle Tickler `[U3]` loves the new brass |
| 6 | **Press Flat** | `[Launch]` | Roller Guard, Lobber | Shaves all ground above the blast's centre line | 30 Blast, Large (42). Removes ground above the centre line within 42 cells | M | It unrolls a map before the first use, which always aims at terrain | Barrow Load and Molehill Surprise put ground back. Rock holds |
| 7 | **Tamp Down** | `[Launch]` | Tamper, Digger | Stamps the ground lower around your fort | Lowers ground 16 cells within Medium (28). 10 Dig to blocks. Three in one place can cause a Thump | M | Pogo stick bounces twice | Rock and Clay ground. Footing is immune. Walk off |
| 8 | **Red Tape** | `[Launch]` | Clerk Major, Patcher | Wraps one of your Nooks. That Hob needs a rest | +1 turn on that Hob's cog after its next shot (the cap in 1.2 holds). No damage. Lasts until used or 3 turns | L | Stamp raised, "DENIED" | Fire burns the tape off. Dollop on that Nook removes it. Smelling Salts. Nan's Tonic |
| 9 | **Teatime** | `[Launch]` | Baron Levelwell, Lobber | A teapot lob that scalds and soaks at once. The joke: the tea puts out its own fire | 45 Blast, Medium (28). Burn on wood and Hobs in the blast. At the start of the Baron's next turn the spill Soaks everything within Small (18), which ends that Burn after one tick. Kettle takes 23 | M | The Baron lifts his cup, little finger out | Cobble roofs. Cover. The Soak that follows shields you from fire for a turn: use it |

Twists stay enemy-only. Each is the Flatteners' style, and the player's toys should build lumps, not shave them. Turncoats are Outfits, not Hobs [A C32].

**Who fires what.** The enemies doc owns the roster [D04 §2.2]; this table only points each unit at its stats. A unit's Knack keeps the name and numbers in this doc under a Flattener skin (acorns for Pepper Rain, rivets for Pan Parade, a mud mound for Molehill Surprise). The old enemy Knack names are retired and parked in the enemies doc.

| Unit | Class | Tag | Knack | Stats in |
|---|---|---|---|---|
| Hedger | Lobber | `[Launch]` | Topiary Drop | Twist 1 |
| Raker | Scatterjack | `[Launch]` | Pepper Rain | 3.3 |
| Mower | Bouncer | `[Launch]` | Mow Line | Twist 2 |
| Chiseler | Digger | `[Launch]` | Seed Potato | 3.4 |
| Pitcher | Zinger | `[Launch]` | Darning Needle | 3.2 |
| Filler | Patcher | `[Launch]` | Fill Up | Twist 3 |
| Pump Hand | Stoker | `[Launch]` | Water Butt | 3.6 |
| Plunger Pete | Bouncer | `[Launch]` | Pogo Pot | 3.10 |
| Silt Lobber | Lobber | `[U1]` | Molehill Surprise | 3.4 |
| Roller Guard | Lobber | `[Launch]` | Press Flat | Twist 6 |
| Ruler Sniper | Zinger | `[Launch]` | Knock-Knock | 3.10 |
| Tamper | Digger | `[Launch]` | Tamp Down | Twist 7 |
| Clerk Major | Patcher | `[Launch]` | Red Tape | Twist 8 |
| Baron Levelwell | Lobber | `[Launch]` | Teatime | Twist 9 |
| Grit Spreader | Scatterjack | `[U1]` | Clatterline | 3.10 |
| Dredger | Digger | `[U1]` | Corkscrew | 3.10 |
| Steam Sweeper | Stoker | `[U1]` | Boiled Over | 3.6 |
| Clipboard Clerk, Level Surveyor | Lookout | `[U2]` | Chalk Fan | 3.8 |
| Glazer | Stoker | `[U2]` | Shiverpuff | 3.6 |
| Gust Bellows | Lookout | `[U2]` | Gust Puff | Twist 4 |
| Snowball Roller | Bouncer | `[U2]` | Roly-Poly | 3.5 |
| Icicle Zinger | Zinger | `[U2]` | Darning Needle | 3.2 |
| Rivet Gunner | Scatterjack | `[U3]` | Pan Parade | 3.3 |
| Spark Fitter | Zinger | `[U3]` | Glimmerjolt | 3.2 |
| Ore Dropper | Lobber | `[U3]` | Anvil Bun | 3.1 |
| Shoring Crew | Patcher | `[Launch]` | Prop Up | Twist 5 |
| Lamp Lookout | Lookout | `[U3]` | Tattle Bell | 3.8 |

The Dummy fires nothing. An enemy unit may fire a Knack before the Hob who owns it joins the player (Boiled Over, Roly-Poly and Darning Needle are launch Knacks; Anvil Bun and Glimmerjolt arrive with their Hobs in U3), so no enemy Knack ships ahead of its tag.

---

## 5. Doodads

A Doodad is a one-use gadget. Two slots, chosen before battle on the one pre-battle screen [R04 B15]. Using one costs the Action [00 §2.15]. A Doodad never deals damage on its own, with one exception (Molehill). Each must be worth a turn at the right moment and worth nothing at the wrong one.

14 Doodads: 8 at launch, then 2 with each update [R04 A]. The review asked for the ones that change the picture and fewer that answer a single shell [R02 §3.1]. Five more are parked (Appendix B). No Doodad needs a side Rival level any more [A C34].

| # | Doodad | Tag | What it does | Use it when | Counter | Unlock |
|---|---|---|---|---|---|---|
| 1 | **Mend Bucket** | `[Launch]` | Mends 3 of your blocks, 45 HP each | A Nook wall or the Kettle Room wall is one hit from gone | Out-damage it. Hit a different wall | Win 1-9: Doodad slot 1 opens with it [PLAN decision 14] |
| 2 | **Pot Lid** | `[Launch]` | A Hob holds a big lid over one Nook or the Kettle Room until your next turn. The first shell to hit that room bounces off harmless | The rival's last pin sat one block from a Nook. Its next shot is on its way | Bait it with a Plain Shot. Patches and fluids ignore it | R2 start (2-1), with Doodad slot 2 |
| 3 | **Coal Scuttle** | `[Launch]` | +40 Steam now. This turn's Walk cap is 80, and you may Walk after you use it | You are in a pit, a pool, a marked circle or a bad angle with an empty gauge | A Hot Potato or a Sticky patch where forts walk | R2 |
| 4 | **Smelling Salts** | `[Launch]` | One Hob heals 40, loses Burn, and its Rest cog clears | Your best Hob is low, or resting at the wrong time | Focus it again | R3 |
| 5 | **Weathercock** | `[Launch]` | The wind is 0 for the rest of this Weather Front. The forecast shows two fronts ahead | A storm level, or you hold lobs and the wind is foul | Bellows can set wind again after it | R4 |
| 6 | **Bellows** | `[Launch]` | Set the wind to any value from -5 to +5 for the rest of this Weather Front | You hold lobs and floaters and want a kind wind for three rounds | Weathercock. Beams and bolts | Tinker node KT-07 |
| 7 | **Molehill** (was Mole Mine; not the same as the Molehills that rise on Downs maps [05], nor the Knack Molehill Surprise) | `[Launch]` | Plant a molehill up to 6 blocks from your castle, hidden from the AI Rival (in Couch Duel it shows to both players [00 §6.1]; the AI never sees it, as it never sees the player's hand). It bursts when a shell, roller or digger touches it: 40 Blast, Medium (28) | The rival's crew has a Digger or a Bouncer | Lobs fly over it. Squeaky Duck trips it | Tinker node KT-04 |
| 8 | **Musical Chairs** | `[Launch]` | Swap the Nooks of two of your Hobs, or move one Hob to a free Nook. Saved aims stay with the Hobs. This is the only way to move a Hob by choice | A hurt Hob sits in an Open Nook and a healthy one sits deep. Or a Hob is dug in | The rival saw the swap | Skirmish: beat 5 different Rivals |
| 9 | **Jack Screws** | `[U1]` | Lifts your castle back to the level of the ground beside it, up to 64 cells, on a Clay plug. Frees it from a pit, a pool, Mud or Sticky | After a Rug Pull, a Tamp Down or a flood | The plug can be dug. Press Flat | Long Siege, wave 12 |
| 10 | **Spare Spring** | `[U1]` | Clears the Rest cog on all your Hobs | Two Hobs are resting and you need a Heavy shell next turn | Bonk the Hob that matters | Long Siege, wave 18 |
| 11 | **Chimney Cough** | `[U2]` | Your fort coughs soot for 2 turns. All your Nooks go back to hidden (last-known). Guided shells lose their addresses. AI aim error x1.5 | The rival has reveals on two or more of your Nooks | Chalk Dart again after it clears. Blasts do not need eyes | Heights |
| 12 | **Scarecrow** | `[U2]` | A dummy Hob in an empty Nook. The rival sees a Hob of the Class you pick until it is hit once. Rivals may field it too, and the AI reads it as a player would [A C76] | You have a spare Nook near the front | Any reveal on that Nook shows straw. Pellets and bees test it cheaply | Tinker node KT-09 (Tier 4) |
| 13 | **Lightning Rod** | `[U3]` | A rod on your roof for 3 turns. All Zap within 100 cells goes to the rod, harmless. Brass chains stop. Storm patches strike it | The rival holds a Zap shell, or a Storm in a Teacup is drifting in | Any hit on the rod's block drops it. Wait 3 turns | Mines |
| 14 | **Where Was I?** | `[U3]` | Wipes the rival's Ghosts, pins and Recall. The AI's bracketing resets to its first-shot error | The rival has your range and its next shot will land | A fresh ranging shot. Pins already fade after one reuse [R04 B11] | Baron Rush, Bronze |

**Readability.** Doodad cards are green with a wrench badge and a square frame, so they never look like shells. Each has a one-line card and a two-note sting when used. The AI's use of each role follows the enemies doc: patch (1), deflector (2), Steam (3), gust (6), and smoke (11) from U2 [D04 §6.10].

---

## 6. Combos and synergies

A combo is two shots, a shot and a material, or a shot and the weather, that together do more than their sum. Every combo below works by rules already stated, so the sim needs no special case. The Almanac names a combo the first time the player lands it and gives a small Score bonus (+50).

| # | Combo | Tag | Parts | What happens | Counter |
|---|---|---|---|---|---|
| 1 | **Tinder and Bellows** | `[Launch]` | Any Burn + wind of 5 or more (weather or Bellows) | At each tick the Burn also jumps to one wood block downwind, even across a gap of one block. One jump per tick at most [A C23] | Cobble firebreaks two wide. Weathercock. Soak |
| 2 | **Keyhole** | `[Launch]` | Nibbler or Miner's Lamp (Peephole) + Recall + Hatpin, Darning Needle or Long Skewer | The point shot flies down the hole and hits the Hob or the kettle behind the wall. A Beam through a Peephole has passed no block, so the kettle takes it in full | Dollop closes the hole. A hedge in the lane |
| 3 | **Top Heavy** | `[Launch]` | Well Wisher, Lid Lifter or Grand Dumpling (Low Blow) low in a tall Cobble fort. Hairline from U3 | Stone hangs on only 1 block of side support [R04 B2]. Take one low block and the rows that leaned on it drop, at x2 crush. A good low hit drops about a third of a late fort | Columns. Brassbound in the low rows. Wicker up top |
| 4 | **Gravy Avalanche** | `[Launch]` | Heavy Gravy + a Cobble overhang or balcony | The blocks fall at once with crush x2 for Cobble and x2 again for Heavy: 60 per block | Columns. Wicker balconies |
| 5 | **Burnt Toffee** | `[Launch]` | Treacle Tart + any Fire | The Sticky patch becomes an Ember patch for 2 turns. Lay it under their wood rows first | Do not stand on Sticky. Soak |
| 6 | **Hedge Roast** | `[Launch]` | Quickset or a Topiary bush + any Fire | The hedge burns and passes Burn to wood it touches | Do not grow hedges against your own Timber |
| 7 | **Mud in Your Eye** | `[Launch]` | Barrow Load or Molehill Surprise on a Loophole | That Hob is dug in: its Fire button greys until the dirt is cleared (1.6). No turn is lost; the side fires with another Hob, or pays 15 Steam to Shove Off and fires it anyway | The portrait shows the dug-in icon. Shove Off (15 Steam). Clear it with any blast, a Digger shot or a Dollop. Musical Chairs |
| 8 | **Pass the Parcel** | `[Launch]` | Hot Potato or Tick-Tock Crock + a shove (any blast, Water Butt) | The prop slides up to 80 cells. Either side can send it back | Walk. Do it first |
| 9 | **Dinner Bell** | `[Launch]` | Your own Hot Potato or Tick-Tock Crock near their fort + Dinner Gong | The gong sets the prop off now. The rival gets no turn to bat it back | Bat it back before the gong. Spread out |
| 10 | **Down the Hatch** | `[Launch]` | Well Wisher or Lid Lifter (open a column) + Chimney Drop or Bag of Marbles. Later: Plumb Bob | The second shot falls down the open shaft and bursts beside the kettle or an inner Nook | Dollop the roof |
| 11 | **Downhill Dairy** | `[Launch]` | Trencher's Spoon (cut a slope) + Cheese Wheel | The wheel loses 350 cells of height and hits for the full 90 | Stomp ditch, Sticky, Mud |
| 12 | **Fry-Up** | `[U1]` | Lamp Oil Jug + any Fire | Stone and brass blocks Burn. Oiled wood burns 4 turns | Water Butt |
| 13 | **Soup Bowl** | `[U1]` | Rug Pull or Sleepy Sapper (sink the fort) + Boiled Over | The soup pools in the pit around the fort and burns every wood block in the low rows for 2 turns | Jack Screws, Cobble low rows |
| 14 | **Duck Hunt** | `[U1]` | Squeaky Duck + Alarm Egg, Molehill or Sleepy Sapper | The duck trips every trap on its path, safely | Lay traps off the duck's line |
| 15 | **Cold Snap** | `[U2]` | Snowglobe or Hailbasket (Brittle) + Rock Cake on Cobble | 60 x 1.2 x 1.5 = 108. Any Cobble block breaks in one hit, and what it held falls with x2 crush and +10 a block | Fire ends Brittle. Skin Cobble with brass |
| 16 | **Skating Rink** | `[U2]` | Water Butt or a pond + Winter Pudding or Shiverpuff | Water turns to Ice. Roly-Poly, Ducks and Drakes and Skimmer cross it 25% faster and farther | Fire melts it. Mud over it |
| 17 | **Chalk and Goose** | `[U2]` | Chalk Dart, Chalk Fan, Snoop Kite or Spyglass Sparrow (reveal) + any guided shell | Guided shells gain their address | Chimney Cough, Soot Puff |
| 18 | **Frozen Cogs** | `[U2]` | Cold Shoulder just after the rival fires a Heavy shell | That Hob's rest of 2 becomes 3. The +1 cap means it never grows past that [R04 B9] | Smelling Salts, Spare Spring, Nan's Tonic. Fire the Heavy shell from its Match Class: no cog to freeze |
| 19 | **Cold Feet** | `[U2]` | Odd Sock + Icicle Drop | The Dud soaks a Hob. The icicle deals 54 (81 to a Hob) | Brolly. Soaked fades after a turn |
| 20 | **Moon Shot** | `[U2]` | Featherfall Dust in mid-field + Grandfather Clod | Half gravity in the patch carries the heavy shell the full distance | Patches show on the map for 3 turns. Walk back |
| 21 | **Marked for Delivery** | `[U2]` | Tattle Bell (Marked, +20%) + Special Delivery | A sure hit with the mark bonus: 32 on a Hob | Tea Cosy. Heal |
| 22 | **Bath Time** | `[U3]` | Soaked (Water Butt, Skimmer, Odd Sock, storm rain) + any Zap | Zap deals x1.5 to Soaked targets, after the material or Hob multiplier. It does not stack with Brittle [A C22] | Stay dry. Lightning Rod. High ground |
| 23 | **Brass Band** | `[U3]` | Storm in a Teacup + Bottled Gust or Bellows + a brass fort | You steer the cloud over the tallest brass. Three strikes chain through the walls | Lightning Rod. A Wicker spire |
| 24 | **Magnet Rain** | `[U3]` | Lodestone Lump + Pepper Rain, Bag of Marbles or Pan Parade | Every piece bends to one point. Pan Parade is Metal and bends twice as hard: all five pans, one block | Break the Lump (40 HP) |
| 25 | **Under the Eaves** | `[Launch]` | Rising Fizz under an overhang or a wing + any blast on the wing's neck block | The bubbles crack the neck from below; the next hit drops the whole wing as one chunk | Columns under wings. Closed ceilings |

**Anti-combos** (bad pairs the card warns about with a small grey link icon): Water Butt on a fort you set on fire. Treacle Tart under your own Roly-Poly. Barrow Load on the wall you mean to Thread. From U2: Soot Puff on the Nook you just revealed, Featherfall Dust over the fort you want to lob.

---

## 7. Balance framework

### 7.1 The Thwack score

One number per shot: the damage a competent player can expect it to be worth, in points of Plain damage.

```
Thwack = D x K x O x A x F x E + U
TPT    = Thwack / (1 + 0.25 x Rest)
```

| Term | Meaning | Values |
|---|---|---|
| **D** | Damage that can connect in one use: the sum over all parts, at the centre of each blast | From the shot |
| **K** | Type factor: the mean multiplier against the Standard Fort (below) | Blast 0.83, Pierce 0.9, Dig 0.75, Fire 0.71, Frost 0.5, Zap 0.6 |
| **O** | Overkill factor, new in this revision. Damage past a block's HP is wasted. For each hit, each block type counts at most its own HP; targets off the blast centre count at 60% of the hit | 1.0 for hits under 25. About 0.97 at 50 Blast, 0.89 at 70, 0.87 at 85, 0.86 at 95. Fire on wood drops fastest: 0.77 at 50 |
| **A** | Area factor: how many 16-cell targets the blast band catches, weighted by falloff | Point 1.0, Tiny 1.0, Small 1.2, Medium 1.5, Large 1.9, Huge 2.4 |
| **F** | Focus factor: damage on one target finishes it sooner | 1.0 normal. 1.2 to 1.3 for lines and swarms. 1.5 for a single point shot |
| **E** | Ease: the share of the damage a player with standard aim lands | 0.3 traps. 0.45 timers. 0.5 trick bounces. 0.55 to 0.6 point shots. 0.7 lobs. 0.85 wide blasts. 0.9 guided. 1.0 cannot miss |
| **U** | Utility points for what the shot leaves behind (7.2) | From the table |
| **Rest** | Turns the Hob rests. With 4 or 5 Hobs, one resting Hob removes a quarter or a fifth of the side's choices for a turn | Light 0, Medium 1, Heavy 2. 0 for the Match Class |

**Standard Fort** (the target mix behind K and O): 5% Wicker (30 HP), 30% Timber (50), 30% Cobble (80), 15% Brassbound (110), 20% Hobs behind Cover three turns in four. The mix follows a Region 3 rival. Bots re-fit K and O per region.

**TPT** (Thwack per turn) answers "what did this Action cost me in tempo". **Match TPT** is the score when the Match Class fires a shell: Thwack x 1.1 with no Rest.

**What Thwack does not see.** It counts damage to what the shot touches. It does not count what falls after. With the flat HP ladder and stone on 1 block of side support, falls are the damage that grows [R04 B2]. Bots must report **blocks dropped per use** beside Thwack for every shot, and **Bonks per use** for every Pierce shot.

### 7.2 Utility points

| Effect | U |
|---|---|
| Burn on a wood block or a Hob | 12 each |
| Brittle on a block (needs a follow-up) `[U2]` | 8 each |
| A Hob needs a rest (+1 turn) | 10 each. +18 if it already has a cog |
| Soaked, with no combo in hand | 3 each |
| Reveal a Nook `[U2]` | 8 each |
| Peephole, tunnel or lane | 8 to 15 |
| Support taken away (a crack, gravy) | 30 to 45 |
| Drop or Thump a fort | 45 to 55 |
| Mound, hedge or wall that blocks a lane | 30 to 45 |
| Patch that denies ground | 25 to 45 |
| HP mended on blocks | 0.5 per HP |
| HP healed on Hobs | 0.8 per HP |
| Damage soaked by a shield | 0.75 per point of cap |
| Re-inflate a Hob (player side only) | 75 |
| Wind change, aim wipe | 25 to 35 |
| Forces the rival to answer (timer, dug in) | 6 to 10 |

### 7.3 Budget bands

Bands are by Weight. There is no rarity [R04 B16].

| Kind | Thwack target | TPT target | Notes |
|---|---|---|---|
| Plain Shot | 22 to 32 | same | Clodpot is the top by design. Point shots sit low on Thwack and high on Bonks |
| Knack, Light (little or no damage) | 35 to 46 | same | |
| Knack, Medium | 45 to 75 | 36 to 60 | About 2x a Plain Shot. Bench Knacks sit in this band |
| Knack, Heavy | 70 to 85 | 47 to 57 | |
| Trick Shell, Light | 30 to 45 | same | |
| Trick Shell, Medium | 40 to 85 | 32 to 68 | A stranger rule buys the top of the band, not more damage |
| Trick Shell, Heavy | up to 100 | up to 67 | One per pool at most. Match TPT up to 110 |
| Dud | under 10 | same | |

**Hard caps.**

- No shot over 110 Thwack, Match bonus included.
- No shot deals over 60 to one Heartkettle in one use. **The sim enforces this** (1.6).
- No single shot Bonks a Hob from full HP: damage to a Hob that started the shot at full HP is clamped at its HP minus 1. **The sim enforces this** (1.6).
- No effect adds more than 1 turn of rest to a Hob, and no shot takes a turn from a side (1.2).

**Tuned so the clamps rarely fire.** Grit Bin 7 x 8 (kettle 56, Hob 84). Brass Marble 18 a touch, 2 touches per target (kettle 36, Hob 54). Bumblejar 6 bees (Hob 90). Woodpecker 60 in all (kettle 60, Hob 90). No launch shot can reach 99 on one Hob. The full-HP clamp is a guard for combos, marks, later shells and the small Classes: a fresh 80 HP Zinger hit by an 85 Blast prop in an Open Nook is left on 1 HP, not Bonked. Bots report how often each clamp fires (red flag 22).

**Skill discount.** Shots with Skill Factor 1.5 may sit up to 15% under their band. Good aim (E near 1) lifts them well over it, and the Score pays them 1.5x.

### 7.4 Value per turn

**Win cost.** On the Standard Fort with 4 Hobs a win now costs about **550 Thwack**: about 135 to open walls (it was 180 on the old HP) and 415 on crew. With 5 Hobs it is about 650. A Kettle Pop costs about 410 by Pierce: 110 to open the Kettle Room, then 300 kettle HP. By Blast it costs about 710.

**Three hands, ten Actions each (a Round 10 battle), launch content.**

| Plan | Actions | Thwack | Reaches 550 by |
|---|---|---|---|
| Plain Shots only, standard aim | 10 x 26 | 260 | Never inside the cap. This is right: a hand with no plan should lose |
| Plain Shots only, expert aim (E = 1) | about 13 x 43 | 560 | Round 13. Inside the core target of 10 to 14 clean hits [00 §9.3] |
| Typical hand: 5 Knack uses, 3 shells, 2 Plain Shots | 5 x 59 + 3 x 56 + 2 x 26 = 515, plus about 25% from falls, crush and Burn ticks | 645 | Round 9 against 4 Hobs, Round 10 against 5 |
| Strong hand, good aim, one combo | the same Actions at about x1.3 | 840 | Round 7 |

The fall share rises from 15% to about 25% because blocks break sooner and stone hangs on less [R04 B2]. That number is a guess until the week 6 bot run on a late fort. If it comes in under 15%, fights will run to the Sudden Squall [R04 B5] too often and shell damage must rise.

So one Knack use is worth about 2.3 Plain Shots, one average shell about 2.1, and a landed combo about one extra Action.

**What a Doodad must be worth.** It costs an Action, so it must swing about 55 Thwack: block 55 damage, save a Hob, or buy a Walk that turns a miss into a hit.

**Crowd-out risk.** A 5-Hob crew holds 10 Knack uses, 4 shells and 2 Doodads: 16 special Actions for a battle of 8 to 12 turns. Any Hob can now fire any shell, and the Match Class fires it with no Rest, so a special is on offer every turn. Bots must report the share of Actions that are Plain Shots; the target is 25% to 40%. The fix is agreed in advance [A C30]: if the share falls under 20%, every Knack's second use opens at Round 5.

### 7.5 Score table: every shot

Thwack and TPT at standard aim against the Standard Fort, on the new HP. Re-run for this revision with the overkill term. Compared with the first draft: big single hits lost 6% to 14% (Tick-Tock Crock 84 to 74, Grandfather Clod 116 to 99), small hits held, and retuned shells moved by their new numbers.

| Shot | Tag | Kind | W | Thwack | TPT | Match TPT | Skill Factor |
|---|---|---|---|---|---|---|---|
| Clodpot | `[Launch]` | Plain, Lobber | L | 31 | 31 | | 1.0 |
| Hatpin | `[Launch]` | Plain, Zinger | L | 24 | 24 | | 1.5 |
| Gravel Sneeze | `[Launch]` | Plain, Scatterjack | L | 27 | 27 | | 0.5 |
| Nibbler | `[Launch]` | Plain, Digger | L | 27 | 27 | | 1.0 |
| Jumping Bean | `[Launch]` | Plain, Bouncer | L | 23 | 23 | | 1.0 |
| Hot Coal | `[Launch]` | Plain, Stoker | L | 29 | 29 | | 1.0 |
| Dollop | `[Launch]` | Plain, Patcher | L | 28 | 28 | | 1.0 |
| Chalk Dart | `[U2]` | Plain, Lookout | L | 29 | 29 | | 1.0 |
| Grand Dumpling | `[Launch]` | Knack, Lobber | M | 72 | 58 | | 1.0 |
| Tick-Tock Crock | `[Launch]` | Knack, Lobber | H | 74 | 49 | | 1.0 |
| Chimney Drop | `[Launch]` | Knack, Lobber | M | 56 | 45 | | 1.0 |
| Anvil Bun | `[U3]` | Knack, Lobber | H | 70 | 47 | | 1.0 |
| Darning Needle | `[Launch]` | Knack, Zinger | M | 61 | 49 | | 1.5 |
| Long Skewer | `[Launch]` | Knack, Zinger | M | 62 | 50 | | 1.5 |
| Glimmerjolt | `[U3]` | Knack, Zinger | M | 58 | 46 | | 1.5 |
| Clockwork Beetle | `[U3]` | Knack, Zinger | M | 46 | 37 | | 1.0 |
| Pepper Rain | `[Launch]` | Knack, Scatterjack | M | 60 | 48 | | 0.5 |
| Pan Parade | `[Launch]` | Knack, Scatterjack | M | 64 | 51 | | 1.0 |
| Rising Fizz | `[Launch]` | Knack, Scatterjack | M | 53 | 42 | | 1.5 |
| Hailbasket | `[U2]` | Knack, Scatterjack | M | 60 | 48 | | 0.5 |
| Seed Potato | `[Launch]` | Knack, Digger | M | 68 | 54 | | 1.0 |
| Hairline | `[U3]` | Knack, Digger | M | 62 | 50 | | 1.0 |
| Molehill Surprise | `[Launch]` | Knack, Digger | L | 45 | 45 | | 1.0 |
| Roly-Poly | `[Launch]` | Knack, Bouncer | M | 52 | 42 | | 1.0 |
| Ducks and Drakes | `[Launch]` | Knack, Bouncer | M | 60 | 48 | | 1.5 |
| Clackerball | `[U3]` | Knack, Bouncer | M | 50 | 40 | | 1.5 |
| Wobble Jelly | `[U1]` | Knack, Bouncer | M | 46 | 37 | | 1.0 |
| Boiled Over | `[Launch]` | Knack, Stoker | M | 69 | 55 | | 1.0 |
| Water Butt | `[Launch]` | Knack, Stoker | L | 46 | 46 | | 0.5 |
| Shiverpuff | `[U2]` | Knack, Stoker | M | 60 | 48 | | 0.5 |
| Barn Raising | `[Launch]` | Knack, Patcher | M | 60 | 48 | | 1.0 |
| Tea Cosy | `[Launch]` | Knack, Patcher | M | 45 | 36 | | 1.0 |
| Scrap Stack | `[U1]` | Knack, Patcher | M | 45 | 36 | | 1.0 |
| Chalk Fan | `[U2]` | Knack, Lookout | L | 36 | 36 | | 1.0 |
| Tattle Bell | `[U2]` | Knack, Lookout | L | 44 | 44 | | 1.0 |
| Snoop Kite | `[U2]` | Knack, Lookout | L | 36 | 36 | | 1.0 |
| Suet Pudding | `[Launch]` | Shell, Splash. Match: Scatterjack | M | 58 | 46 | 64 | 0.5 |
| Rock Cake | `[Launch]` | Shell, Splash. Match: Lobber | M | 53 | 42 | 58 | 1.0 |
| Dinner Gong | `[Launch]` | Shell, Splash. Match: Scatterjack | M | 55 | 44 | 61 | 1.0 |
| Grandfather Clod | `[Launch]` | Shell, Splash. Match: Lobber | H | 99 | 66 | 109 | 0.5 |
| Lid Lifter | `[Launch]` | Shell, Splash. Match: Lobber | M | 53 | 42 | 58 | 1.0 |
| Bag of Marbles | `[Launch]` | Shell, Cluster. Match: Scatterjack | M | 54 | 43 | 59 | 0.5 |
| Fizzwhistle | `[U1]` | Shell, Cluster. Match: Scatterjack | M | 54 | 43 | 59 | 1.0 |
| Bumblejar | `[U1]` | Shell, Cluster. Match: Scatterjack | M | 53 | 42 | 58 | 0.5 |
| Grit Bin | `[Launch]` | Shell, Beam and Rapid. Match: Scatterjack | L | 37 | 37 | 41 | 1.0 |
| Miner's Lamp | `[Launch]` | Shell, Beam and Rapid. Match: Digger | L | 41 | 41 | 45 | 1.0 |
| Woodpecker | `[U3]` | Shell, Beam and Rapid. Match: Scatterjack | M | 45 | 36 | 50 | 1.5 |
| Mole Mail | `[Launch]` | Shell, Digger. Match: Digger | M | 52 | 42 | 57 | 1.0 |
| Well Wisher | `[Launch]` | Shell, Digger. Match: Digger | M | 62 | 50 | 68 | 1.0 |
| Trencher's Spoon | `[Launch]` | Shell, Digger. Match: Digger | L | 38 | 38 | 42 | 1.0 |
| Sleepy Sapper | `[U1]` | Shell, Digger. Match: Digger | H | 85 | 57 | 94 | 1.0 |
| Rug Pull | `[U1]` | Shell, Digger. Match: Digger | M | 55 | 44 | 61 | 1.0 |
| Cheese Wheel | `[Launch]` | Shell, Roller. Match: Bouncer | M | 57 | 46 | 63 | 1.0 |
| Wick Runner | `[Launch]` | Shell, Roller. Match: Stoker | M | 60 | 48 | 66 | 1.0 |
| Snailbomb | `[U3]` | Shell, Roller. Match: Bouncer | M | 52 | 42 | 57 | 1.0 |
| Brass Marble | `[U3]` | Shell, Roller. Match: Bouncer | M | 44 | 35 | 48 | 1.0 |
| Rubber Radish | `[Launch]` | Shell, Bouncer. Match: Bouncer | M | 52 | 42 | 57 | 1.0 |
| Dried Pea | `[Launch]` | Shell, Bouncer. Match: Bouncer | M | 51 | 41 | 56 | 1.5 |
| Skimmer | `[Launch]` | Shell, Bouncer. Match: Bouncer | M | 57 | 46 | 63 | 1.0 |
| Homecoming Hat | `[U3]` | Shell, Bouncer. Match: Lobber | M | 60 | 48 | 66 | 1.5 |
| Special Delivery | `[Launch]` | Shell, Guided. Match: Zinger | L | 34 | 34 | 37 | 0.5 |
| Nosy Goose | `[Launch]` | Shell, Guided. Match: Zinger | M | 50 | 40 | 55 | 0.5 |
| Plumb Bob | `[U2]` | Shell, Guided. Match: Zinger | M | 68 | 54 | 75 | 1.0 |
| Barrow Load | `[Launch]` | Shell, Terrain builder. Match: Digger | L | 32 | 32 | 35 | 1.0 |
| Quickset | `[Launch]` | Shell, Terrain builder. Match: Patcher | M | 45 | 36 | 50 | 1.0 |
| Treacle Tart | `[Launch]` | Shell, Terrain builder. Match: Stoker | L | 30 | 30 | 33 | 1.0 |
| Roman Candle | `[Launch]` | Shell, Fire. Match: Stoker | M | 46 | 37 | 51 | 1.0 |
| Tinderbox | `[Launch]` | Shell, Fire. Match: Stoker | M | 54 | 43 | 59 | 1.0 |
| Lamp Oil Jug | `[U1]` | Shell, Fire. Match: Stoker | L | 40 | 40 | 44 | 1.0 |
| Dragon Hiccup | `[U1]` | Shell, Fire. Match: Stoker | M | 79 | 63 | 87 | 1.5 |
| Snowglobe | `[U2]` | Shell, Frost. Match: Stoker | M | 54 | 43 | 59 | 0.5 |
| Icicle Drop | `[U2]` | Shell, Frost. Match: Stoker | M | 44 | 35 | 48 | 1.5 |
| Cold Shoulder | `[U2]` | Shell, Frost. Match: Stoker | M | 55 | 44 | 61 | 1.0 |
| Winter Pudding | `[U2]` | Shell, Frost. Match: Stoker | M | 46 | 37 | 51 | 1.0 |
| Static Sock | `[U3]` | Shell, Shock. Match: Scatterjack | M | 52 | 42 | 57 | 1.0 |
| Kettle Tickler | `[U3]` | Shell, Shock. Match: Zinger | M | 62 | 50 | 68 | 1.5 |
| Storm in a Teacup | `[U3]` | Shell, Shock. Match: All | H | 73 | 49 |  | 1.0 |
| Puddle Jumper | `[U3]` | Shell, Shock. Match: Stoker | M | 44 | 35 | 48 | 1.0 |
| Heavy Gravy | `[Launch]` | Shell, Gravity. Match: Lobber | M | 55 | 44 | 61 | 1.0 |
| Featherfall Dust | `[U2]` | Shell, Gravity. Match: Patcher | M | 42 | 34 | 46 | 1.0 |
| Lodestone Lump | `[U3]` | Shell, Gravity. Match: All | M | 50 | 40 |  | 1.0 |
| Hot Potato | `[Launch]` | Shell, Timed. Match: Lobber | M | 64 | 51 | 70 | 1.0 |
| Alarm Egg | `[U1]` | Shell, Timed. Match: Bouncer | L | 38 | 38 | 42 | 1.0 |
| Sky Order | `[U2]` | Shell, Timed. Match: Lookout | M | 70 | 56 | 77 | 1.0 |
| Cuckoo Clock | `[U3]` | Shell, Timed. Match: All | M | 51 | 41 |  | 1.0 |
| Brolly | `[Launch]` | Shell, Utility. Match: Patcher | M | 50 | 40 | 55 | 1.0 |
| Nan's Tonic | `[Launch]` | Shell, Utility. Match: Patcher | M | 48 | 38 | 53 | 1.0 |
| Spyglass Sparrow | `[U2]` | Shell, Utility. Match: Lookout | L | 30 | 30 | 33 | 1.0 |
| Soot Puff | `[U2]` | Shell, Utility. Match: All | L | 32 | 32 |  | 1.0 |
| Bottled Gust | `[U2]` | Shell, Utility. Match: All | L | 40 | 40 |  | 1.0 |
| Old Turnip | `[Launch]` | Shell, Chaos, Dud. Match: All | L | 4 | 4 |  | 0.5 |
| Odd Sock | `[Launch]` | Shell, Chaos, Dud. Match: All | L | 8 | 8 |  | 0.5 |
| Squeaky Duck | `[U1]` | Shell, Chaos, Dud. Match: All | L | 4 | 4 |  | 0.5 |
| Copycat | `[Launch]` | Shell, Chaos. Match: All | M | 53 | 42 | | 1.0 |

**Reading the table.**

- Hatpin and the point Knacks sit low on Thwack because K averages over blocks. Against a Hob they deal x1.5.
- Shells whose worth depends on the fort show their average. Tinderbox is about 90 on a wood fort and 15 on brass. Roman Candle is 46 on the mix and about 75 fired hot at Timber. Heavy Gravy is 10 on a fort of columns and over 100 on a fort of balconies.
- Shield and build shells score on U alone. Their true worth shows in win rate, not Thwack.
- Copycat is the mean launch shell.
- **Rows re-run for review 06.** Grand Dumpling 68 to 72 (Low Blow adds about 6% when aimed low). Long Skewer 53 to 62 (U about 10 per Nook held Open, 1.5 Nooks a use). Rising Fizz 53 (3 x 20 Blast, Small, E 0.65, plus U 8 for the undersides only it reaches; Popple Pod was 63). Ducks and Drakes 56 to 60 (the floor lifts E). Dollop 24 to 28 (+10 HP mended at 0.5 per HP, less waste). Miner's Lamp 84 to 41 (4 x 12 Pierce, Point, plus U 15 for the lane; now a Light set-up shell inside the Light band). Suet Pudding keeps its numbers under its new Match. The mean launch Knack Thwack stays about 59, so 7.4 holds.
- **Class gap check at launch** (mean TPT of the Plain Shot and the launch Knacks): Lobber 46, Stoker 43, Scatterjack 42, Digger 42, Zinger 41, Bouncer 38, Patcher 37. Mean 41. The widest gap is 12%, inside the 25% line of red flag 20.

### 7.6 Red flags to test with bots

The bot runs [R04 C5] must report each of these. A flag opens a tuning ticket. All 20 flags from the first draft were checked against the new rules. Flags 1 to 20 keep their numbers; three are new.

| # | Red flag | Trip line | First fix | Check in this revision |
|---|---|---|---|---|
| 1 | One shot in too many winning hands | Any shell picked first in over 30% of Rummages where it appears, or any Knack in over 40% of winning crews | Lower E-side reach (radius, range), not damage | Holds. Watch Grandfather Clod fired by its Match Class. Miner's Lamp is now a Light set-up shell; watch its Keyhole follow-ups instead |
| 2 | Dead shell | Picked in under 5% of pools where it appears | Raise U side: longer patch, wider reach | Reworded: every crew can fire every shell now |
| 3 | Kettle rush | Kettle Pop wins before Round 6 in over 10% of battles | Lower Darning Needle pass-through damage, then Miner's Lamp's lane length | More likely on the new HP: a Kettle Room wall is 3 Clodpots, not 5. The half-through-a-wall rule (1.6) is the first guard. Next fix is the core's: kettle two blocks in |
| 4 | Sniper lock | A Zinger Bonks 2 Hobs by Round 4 in over 15% of battles | Narrow the Loophole hit zone from 6 cells to 5 | Holds. The full-HP clamp stops every one-shot Bonk from full HP. **Loophole Flap** [00 §2.10] caps Threads at one per Loophole per Weather Front, for both sides, in the open; the hidden "one Thread on Fair" AI rule is gone. If Zinger pick rate then falls under 10%, raise Hatpin to 36 (54 to a Hob) |
| 5 | Rest lock | Any Hob rests more turns than its own shot's Rest plus 1 | It is a bug: the +1 cap is a rule now | Changed from a tuning flag to an assert |
| 6 | Fire snowball | Tinderbox or Fry-Up removes over 40% of a fort's block HP alone | Cut spread turns from 3 to 2 | Tighter now: a Burn takes 16 of a Timber block's 50, not of 60. Keep the line; expect it to trip sooner on all-wood forts |
| 7 | Thump chain | Rug Pull, Tamp Down and Sleepy Sapper cause 2 or more Thumps on one fort in 3 turns | A fort that Thumps is immune to Thump for 2 turns | Holds. Only Tamp Down exists at launch. A Thump still takes a third of every Wicker block; the core doc owns that number [R02 §3.3] |
| 8 | Burial lock | The same Hob is dug in on 3 turns in a row | Dug-in Loopholes clear themselves after 2 turns | Milder again: Shove Off clears a burial for 15 Steam with no Action spent. Watch Steam spent on Shove Off; if it passes 30% of a side's Steam, Truffle's mound grows from 48 to 64 cells |
| 9 | Plain Shot crowd-out | Plain Shots under 20% of Actions | Knack second use from Round 5 (7.4) | More likely with 5 Hobs and Match Class shells. Fix agreed in advance |
| 10 | Turtle | Battles reach the Sudden Squall in over 15% of games when one side holds 2 or more of Brolly, Tea Cosy, Nan's Tonic, Mend Bucket, Pot Lid, Barn Raising | Shields drop 1 turn of length | Reworded for the Squall. Milder: Puff Up is player only against the AI, three shield items are parked. Dollop is back at +50; watch Patcher pairs |
| 11 | Self-harm | A shell hurts its own side in over 25% of uses (Grandfather Clod, Hot Potato; Homecoming Hat from U3) | Wider preview warning ring; keep the risk, show it better | Holds |
| 12 | Settle overrun | Any shot whose resolve passes the 3 s settle cap or 5 s in all in over 2% of uses (Bag of Marbles, Wick Runner; Snailbomb and Storm strikes later). Any Rival resolve over 4 s [R02 §3.3] | Shorten crawl and roll times | Holds. The 4 s Rival line is new |
| 13 | Frame cost | Any shot that drops a low-end phone under 30 fps: over 12 sub-shells, over 60 fluid units, over 3 patches a side, over 64 actors | Cut piece counts; pieces become particles | Holds. Caps now match the sim limits in 1.10 |
| 14 | First-turn swing | Side one wins over 55% of mirror matches | Raise the second side's Steam bonus | More likely: walls open a turn sooner, so the first shot matters more. Watch it from the first bot run |
| 15 | Combo spike | Any two-shot combo over 200 Thwack in total, falls included | Cap the multiplier: Brittle and Soaked bonuses do not stack | Holds. Top Heavy and Gravy Avalanche are the launch suspects, and Hairline with Heavy Gravy from U3, since falls now carry more of the damage |
| 16 | Dud harm | A side that ends with a Dud in hand loses over 60% | Drop Dud rate from 35% toward 25% | Holds. Milder: Duds are marked and each has a small use |
| 17 | Guided crutch | Guided shells land over 90% and make up over 30% of a winner's damage | Lower bend angle from 25 to 20 degrees | More likely at launch: every Nook counts as Revealed. If it trips, Special Delivery drops to 14 Pierce |
| 18 | Lodestone chaos `[U3]` | Shots near a Lodestone Lump miss by over 100 cells for both sides in over half of uses | Shorten pull range from 150 to 110 | Holds. Not in launch runs |
| 19 | AI misuse | The AI fires a set-up shell (Barrow Load, Treacle Tart, Heavy Gravy; Oil and Snowglobe later) with no follow-up within 2 turns in over 50% of uses on Stubborn | AI weights, not shell numbers | Holds. With 30 shells the AI has fewer to learn [R02 §5.4] |
| 20 | Class gap | Any Class's mean TPT across its kit is over 25% above or below the all-Class mean | Tune that Class's Plain Shot first | Holds. Widest gap today is 12% (7.5). Seven Classes at launch |
| 21 | Soft walls (new) | A Kettle Room or Nook wall of full Cobble opens in under 2 Actions in over 25% of battles | Raise that shell's overkill: lower damage, not HP | Guards the new HP ladder from the other side |
| 22 | Clamp wear (new) | The kettle clamp or the full-HP clamp fires in over 2% of uses of any one shot | Retune that shot's numbers | A cap the data keeps hitting is a wrong number [A C27] |
| 23 | Squall rate (new) | Over 15% of all battles reach the Sudden Squall, in any region | First raise the fall share (support rule), then shell damage by 10% | The pacing gate for week 6 and week 30 [R02 §5.3] |

### 7.7 Tuning order and cut line

**Order.** When bots flag a shot: first its Ease side (radius, range, speed), then its Leftover (turns, width), then Weight, and damage last. The player learns damage numbers by heart; change them least.

**No quiet nerfs.** If a shot a player owns gets weaker, the patch notes say so.

**Cut line.** Launch ships 30 shells. If scope bites, cut in this order: the Kit set (3), then Trial shells (6). Never cut the Duds, the start six or a Grand Fort reward. If the Fen moves to after launch [R02 §5.3], its 4 shells move with it, and so do the Hobs the crew doc has join there. Launch is then 26 shells.

---

## 8. Visual and audio feel

### 8.1 Rules for all shots

The core Juice rule stands: every hit shows a number, shakes by size and may hit-stop [00 §2.10]. **The UX doc owns the feel numbers and the sound ids** [D07 §6, §9.3]. Where the first draft of this doc had its own shake, hit-stop and slow-mo numbers, 07's now apply [A C83]. This section says what each shot asks of those systems and keeps three extras of its own.

**Shake and hit-stop.** Shots do not carry their own shake level. The view reads the blast band and the damage band and uses 07's tables.

| What happened | Shake [D07 §6.2] | Hit-stop [D07 §6.1] |
|---|---|---|
| Point hits, pellets, patches, builds | None | None under 30 damage |
| Tiny, Small, Medium, Large, Huge blast | Trauma 0.10, 0.20, 0.35, 0.55, 0.80 | 30 ms on a Standard hit to a Hob, 50 ms on a Heavy hit or 3 blocks broken, 80 ms on a Massive hit |
| Launch of a Heavy shot | Trauma 0.10 | None |
| Chunk lands, Thump | 0.05 per block up to 0.40; Thump 0.50, up and down only | Thump 50 ms |
| Bonk | By the blast | 80 ms |
| Kettle Pop | Trauma 1.00 | 80 ms, then slow-mo |
| Clusters, fans, rapid shots | Each piece adds its own trauma; the 12 px cap holds | First hit only |

The cap is 12 px and 1 degree of roll. "Reduce shake" is 100, 50 or 0% [D07 §7.3].

**Slow-mo.** 07's table and rules apply [D07 §6.4]: Kettle Pop 0.25x for 1.2 s; the last enemy Hob 0.3x for 1.0 s; any other Bonk 0.5x for 0.4 s; a fall of 6 or more blocks 0.5x for 0.6 s; impact of a flight under 1 s at 0.4x for 0.3 s with a bright trail. At most one slow-mo per shot and 1.5 s of added time per turn. Tapping 2x cancels it. "Reduce motion" turns it off.

**This doc's three extras** (07 adds them to its tables [A C83]):

1. **Threaded.** 0.2 s at 0.3x as the point shot enters the slot, with a push-in to the 1.25 zoom cap [R04 D7] and the "Threaded!" call.
2. **Dud.** A mock slow-mo: 0.4 s at 0.5x and a drum roll, then the parp. Once per battle.
3. **Threaded haptic.** A double tick on "Threaded!", beside 07's haptic table [D07 §6.5].

**Trails.** Trail colour is the damage colour (1.3): warm white, pale yellow, tan, red, ice blue, violet, green. Never orange. Trail shape is the Weight: Light a thin line, Medium a ribbon, Heavy a ribbon with smoke puffs. A player can read type and Weight from the trail alone.

**Camera.** Follow the shell. For splits, follow the centre of the pieces and zoom out to hold them. For timers, cut back to the prop for 0.5 s at the start of the turn it goes off. Hold on the impact for 0.6 s before the pan back. Any Rival resolve ends inside 4 s.

**Numbers.** Damage numbers follow 07: type icon, size by band, hits on one target within 300 ms merge into one rising total [D07 §6.3]. A hit cut by a sim clamp shows the number it dealt, never the number it would have.

**Sound budget.** 07's event list is the base [D07 §9.3]. A shot's sound is built from four parts, and only the second is new audio:

| Layer | Source | New files |
|---|---|---|
| Launch | One of 07's 12 launch events, picked by flight kind (table below) | None |
| Launch layer | A short sound of the shot's own, 0.3 to 0.6 s, played on top of the launch event. This is the "Layer" on each card | One per shot |
| Flight loop and impact | 07's flight and impact events, by flight kind and damage type | None |
| Tail | 07's material events: Wicker creak, Timber crack, Cobble clack, Brassbound clang, Footing thud, kettle gong | None |

| Flight kind | 07 launch event | Shots |
|---|---|---|
| Lob | `launch_lob` | Clodpot, Splash, Cluster, Guided, Gravity, Timed |
| Bolt | `launch_bolt` | Hatpin, Long Skewer, Shock, Knock-Knock |
| Fan and stream | `launch_fan` | Gravel Sneeze, Grit Bin, Woodpecker, Pepper Rain |
| Bore | `launch_dig` | Nibbler, Digger, Seed Potato |
| Bounce and roll | `launch_bounce` | Jumping Bean, Roller, Bouncer |
| Fire | `launch_firepot` | Hot Coal, Fire, Boiled Over |
| Glob and build | `launch_glob` | Dollop, Terrain builder, Nan's Tonic, Water Butt |
| Marker | `launch_marker` | Chalk Dart, scout shells, Brolly |
| Beam | `launch_beam_charge`, `launch_beam_fire` | Darning Needle, Miner's Lamp, Glimmerjolt |
| Heavy | `launch_heavy` | Any Heavy shot, in place of its flight kind |
| Dud | `launch_dud` | The three Duds |

**Launch layer count.** At launch: 7 Plain Shots, 16 Knacks, 30 shells, 8 Twists and 2 bench Knacks, 63 files and about 0.22 MB. An enemy unit that fires a crew Knack reuses that Knack's layer. After U3: 8 + 28 + 58 + 9 + 4 = 107 files and about 0.4 MB, which is the figure the audit budgets inside the 14 MB plan [A C85]. If the SFX budget tightens, layers for "All" shells and Twists go first and the group's launch event plays alone.

**Rival shots.** The same feel, mirrored. The rival's launch sound plays 20% quieter and the impact on your fort plays 20% louder, so the player feels hits they take.

### 8.2 Feel by group

Shake and hit-stop follow the table in 8.1. This table lists only what is special to the group.

| Group | Trail | Impact | Slow-mo and camera | Audio |
|---|---|---|---|---|
| Plain Shots | Thin line in the type colour | Small, clean, fast. Never upstages a Knack | Short-flight rule for Hatpin only | Short and dry. The player hears each a hundred times: no long tails |
| Splash | Fat warm-white ribbon, slow tumble of the shell | A ring of dust that matches the true radius, then debris | Collapse rule when roofs go. Grandfather Clod: music ducks 300 ms before impact | Low whump with a long tail. Dinner Gong: one pure tone that wobbles |
| Cluster | Ribbon that frays at the split | A drum roll of small bursts, 60 to 90 ms apart, never all at once | Camera pulls out at the split | Rising rattle. Pitch climbs with each pop |
| Beam and Rapid | Beam: a hard pale-yellow line that draws in 100 ms and fades in 400. Rapid: dashes | Beam: a flare at each block passed. Rapid: chips fly off one spot | Threaded extra on a thread. Beams hold the line on screen for 0.4 s | Beam: harp sting or hum. Rapid: wood-block ticks, one per hit |
| Digger | The trail goes under: a moving bump on the surface with dirt spray | Dirt fountain where it comes out. Shafts suck dust down | Camera tilts down 5 degrees to follow a bore. See-through strip on the ground along the path | Muffled scrabble under the music. A hollow "poomp" on exit |
| Roller | No air trail after landing. Dust puffs and a groove on the ground | Hop, then burst one block up | Camera tracks at ground level. No slow-mo: the roll is the suspense | A rumble that rises in pitch with speed |
| Bouncer | Dotted arc that restarts at each bounce | A squash and stretch on each touch. Final burst as Splash | Camera leads the bounce by a quarter screen | Boing family. Pitch steps up per bounce, so the ear counts them |
| Guided | Ribbon with a curl. A dotted line snaps to the target when it locks | Small and exact | A quick push-in on the lock | A voice for each: honk, bell, tink. The lock has its own "tik" |
| Terrain builder | Tan or green line, clods falling off | Ground or blocks grow in 300 ms with a squash. No flash | None. The new thing pulses once so the player sees what changed | Soft, low, friendly: floomp, rustle, glorp |
| Fire | Red ribbon with sparks. Roman Candle's trail thins as it cools | Flames lick up, never out. Burn shows as small flames on the block edge and a flame pip on its HP bar | None on impact. Each Burn tick gets a 150 ms flare | Whoosh and crackle. Burn ticks are one soft crackle, not an alarm |
| Frost `[U2]` | Ice-blue ribbon with falling flakes | A white flash, then frost creeps over blocks in 300 ms. Brittle blocks show hairline cracks and glint | Collapse rule when a Brittle block shatters; the shatter is glass, not stone | Glassy chime. A Brittle hit adds a bright "crack" on top of the normal tail |
| Shock `[U3]` | Violet zigzag, drawn in 2 frames | Arcs jump block to block along brass, 50 ms per link, so the chain reads as a path | Camera follows the chain if it runs toward the kettle | Snap and buzz. Each chain link ticks up in pitch |
| Gravity | A clear ripple, like heat haze. No colour of its own | Things lift or sag with a slow ease-in. Dust hangs | Collapse rule on the drop | Slide whistles and long creaks. Low hum for patches |
| Timed | Normal lob. On landing the prop bobs and shows a clear dial with turns left | The blast as Splash. Before it: 0.5 s of fast ticks | Camera cuts to the prop at the start of its turn. No slow-mo: the wait was the tension | Tick, cuckoo, sizzle or snore loops, quiet, placed in stereo |
| Utility and support | Green line | A soft glow on what was helped. Shields show a clear outline that all players can read | None | Warm two-note stings. Heal has an "aaah". Never a combat sound |
| Chaos and jokes | A wobbly line, off its true path by 1 px (visual only) | Duds: a puff and a pause | Dud extra | Sad parp for Duds |

**Patches on screen.** Every patch has a dashed outline in its type colour, a pattern fill (flames, drips, flakes, dots, feathers, raindrops) for colour-blind players, one icon and a turn counter. Nothing that lasts turns is ever shown without its counter. A resting Hob shows the cog and its count; a dug-in Hob shows the dirt icon on its portrait and a greyed Fire button.

---

## 9. Open items for review

Items the review settled are closed and listed under "Changes in this revision". What is left needs a yes from another doc's owner or from the owner.

1. **Launch Hob set.** Closed. The table at the top is the crew doc's final list, and every Knack tag matches it.
2. **Match Class bonus.** Closed. Rest 0 and +10%, as the core doc's canonical numbers set it.
3. **Beams and the kettle.** Closed. The core doc carries the rule (00 §2.10 and its canonical numbers). If kettle rush still trips, the core's next step is "kettle two blocks in".
4. **Never a forced pass.** Closed. The core doc carries it (00 §2.2, §2.7); the crew doc uses the same "newest burial clears" rule.
5. **Full-HP clamp and small Hobs.** Closed. The core doc changed the clamp to "no single shot Bonks a Hob from full HP" (HP minus 1).
6. **Dud labels.** Closed. Every Dud is labeled on its tile and card. The UX doc should drop the `?` stamp state. The U2 Lookout draft reveal needs a line in the crew doc.
7. **Tech tree asks.** Closed. KT-02 Kitchen Drawer adds Dinner Gong, Miner's Lamp and Grandfather Clod; KT-04 Molehill and KT-07 Bellows are launch nodes; KT-09 Scarecrow is U2. There are no keystones, so the Junk Shell is parked.
8. **Enemies doc asks.** Closed in 04. Knock-Knock is now 20 then 40 Pierce (was 30 then 60), so the kettle clamp does not fire on every clean hit; the Ruler Sniper's entry should say so. Gust Bellows loses Gust Puff when its bellows is hit; it is not Tumbled and it does not skip a turn. The Baron's Teatime has stats as Twist 9.
9. **Campaign doc asks.** Closed in 05 (mode reward lines and Trial rewards). One shell per Trial (6, 2, 1, 1). Mode cards show their rewards: Long Siege waves 5 to 30 (six shells, Jack Screws at 12, Spare Spring at 18), Skirmish 5 Rivals (Musical Chairs), Baron Rush (Homecoming Hat, Where Was I?). The Daily pays no shell. Level pools may lend "on loan" shells.
10. **Art and UX asks.** Closed: 06 §3.7 and 07 §6.3 use ember red for Fire, and 07 §6.4 and §6.5 now carry the three feel extras. A red for Fire that is clear of the Rival orange, in 06 §3.7 and 07 §6.3. The three feel extras in 8.1 added to 07's tables. 62 launch layers in the launch SFX count.
11. **Core doc asks.** Closed. "Patch" and Peephole are in the core glossary.
12. **Thump on Wicker.** A Thump still takes 10 of 30 from every Wicker block. The review asks that Thump hit Hobs and the bottom two rows only [R02 §3.3]. The core doc owns it; red flag 7 watches it.
13. **Fall share.** Section 7.4 assumes falls add 25% to a hand's damage under the new support rule. The week 6 bot run on a late fort must confirm it [R04 B2].
14. **Names.** All names in this doc need the trademark and store search [R04 D9]. Watch list: Hot Potato, Brolly, Copycat (common words, low risk).

---

## Appendix A. Quirk candidates from the old Knack tiers

For the crew editor. Hob growth is 3 ranks and each rank is a Quirk pick from 2 choices [R04 B8]. Launch needs 28 rank 1 and 2 Class Quirks (7 Classes x 2 ranks x 2), plus the rank 3 options the crew doc sets [D03 §5.2]. The first draft gave every Knack two upgrade tiers; those are gone. The best tier ideas are below, reworded so a whole Class can use them. Each adds a rule or reach, never more than 15% damage. A star marks the picks this doc would fight for. "From" names the old tier and its Knack.

| Class | Quirk candidate | What it does | From | Tag |
|---|---|---|---|---|
| Lobber | **Extra Crumbs** ★ | This Hob's Blast lobs throw 3 crumbs on impact: 10 Blast, Tiny each | Grand Dumpling T2 | Launch |
| Lobber | **Snooze Button** ★ | Timed props this Hob fires get a Dial: blow next turn or the turn after. The face shows which | Tick-Tock Crock T3 | Launch |
| Lobber | **Sticky Base** | Props this Hob fires cannot be shoved | Tick-Tock Crock T2 | Launch |
| Lobber | **Gravy Boat** | This Hob's lobs carve Rock, and carve ground x1.5 | Grand Dumpling T3 | Launch |
| Lobber | **Roof Punch** | This Hob's lobs go through one Wicker or Timber block before they burst | Chimney Drop T2 | Launch |
| Lobber | **Day-Old** | This Hob's Blast treats Cobble as Timber (x1.0) | Anvil Bun T2 | U3 |
| Zinger | **Greased** ★ | After this Hob's point shot threads a Loophole it goes on through the Hob to the back wall | Long Skewer T2 | Launch |
| Zinger | **Mirror Polish** ★ | This Hob's Beams reflect once off Brassbound and Water (and Ice from U2) | Darning Needle T3 | Launch |
| Zinger | **Hard Tip** | This Hob's piercing shots count Cobble as wood for how many blocks they pass | Long Skewer T3 | Launch |
| Zinger | **Tell-Tale** | This Hob's point shots reveal the Nook they reach | Darning Needle T2 | U2 |
| Zinger | **Extra Wind-Up** | Steered shots take two taps. Renamed from "Second Wind-Up" to stay clear of the old Quirk name [A C49] | Clockwork Beetle T2 | U3 |
| Zinger | **Wet Wire** | This Hob's Zap also chains through Soaked blocks and Water | Glimmerjolt T3 | U3 |
| Scatterjack | **Shaker** ★ | Split shots get a Dial: a narrow or a wide spread | Pepper Rain T2 | Launch |
| Scatterjack | **Hot Pepper** ★ | A piece that lands in an Open Nook deals +50% | Pepper Rain T3 | Launch |
| Scatterjack | **Room Service** | If a split shot lands inside a room, all its pieces stay in the room | Popple Pod T3 (Knack now parked) | Launch |
| Scatterjack | **Drum Roll** | A piece that hits the same block as the piece before deals +4 | Pan Parade T3 | Launch |
| Scatterjack | **Black Ice** | Ground this Hob's Frost hits gets an Ice patch for 3 turns | Hailbasket T3 | U2 |
| Digger | **Clay Teeth** ★ | This Hob bores Clay at full speed and reaches half as far again | Seed Potato T2 | Launch |
| Digger | **Snug Fit** ★ | A burst inside a Nook or the Kettle Room deals +15% | Seed Potato T3 | Launch |
| Digger | **Spiderweb** | Cracks and bites reach two blocks out, not one | Hairline T2 | U3 |
| Digger | **Packed Dirt** | Mounds this Hob makes are Clay: they hold their shape and carve at half | Molehill Surprise T3 | Launch |
| Bouncer | **Little Jump** ★ | This Hob's rollers hop gaps and steps up to 16 cells | Roly-Poly T2 | Launch |
| Bouncer | **Flat Hand** ★ | This Hob's skips and bounces get 2 more touches | Ducks and Drakes T2 | Launch |
| Bouncer | **Running Start** | Rollers gain +1 per 20 cells rolled downhill, up to +10 | Roly-Poly T3 | Launch |
| Bouncer | **Roof Skim** | Skippers skip on castle roofs too | Ducks and Drakes T3 | Launch |
| Bouncer | **Room Rattle** | Each bounce inside a room also pops for 10, Tiny | Clackerball T3 | U3 |
| Stoker | **Clingy** ★ | This Hob's fluids coat wall faces as they run down | Boiled Over T2 | Launch |
| Stoker | **Flash Flood** ★ | This Hob's water shoves props twice as far and washes off every patch | Water Butt T2 | Launch |
| Stoker | **Skin on Top** | This Hob's fire floats and burns on Water | Boiled Over T3 | Launch |
| Stoker | **Bog Maker** | Mud this Hob makes lasts all battle | Water Butt T3 | Launch |
| Stoker | **Fog Bank** | This Hob's cloud patches drift 10 cells per wind point each turn | Shiverpuff T2 | U2 |
| Patcher | **Good Stock** ★ | Blocks this Hob rebuilds return at full HP | Barn Raising T2 | Launch |
| Patcher | **Pop!** ★ | When this Hob's shield bursts it puts out fire nearby and shoves props 48 cells | Tea Cosy T3 | Launch |
| Patcher | **Fresh Paint** | This Hob's mends also end Burn (and Brittle from U2) on the block and the ones it touches | Barn Raising T3 | Launch |
| Patcher | **Double Bubble** | This Hob's shield soaks two hits, with the same total | Tea Cosy T2 | Launch |
| Patcher | **Spiky Bits** | Rollers and bouncers that touch this Hob's builds burst there | Scrap Stack T3 | U1 |
| Lookout | **Sharp Chalk** | Each reveal line ends in a pin you can Recall | Chalk Fan T2 | U2 |
| Lookout | **Long Ring** | This Hob's reveals hold through soot and Chimney Cough | Tattle Bell T2 | U2 |
| Lookout | **Gossip** | This Hob's Knack also shows the rival's hand of Trick Shells | Tattle Bell T3 | U2 |
| Lookout | **Tail Bow** | Dial: this Hob's glider ends in a pop or in a small Soot patch | Snoop Kite T3 | U2 |

Launch rows: 3 or more for each of the 7 Classes, 29 in all, so the crew editor can pick from here and write the rest. Tags follow the Hob whose Knack the idea came from; a Class-wide Quirk can ship sooner if the crew doc wants it. Tier ideas not listed (Tall Hill, Family Size, Tall Stack, Long String, Marching Orders, Fourth Wall, Stale, Soot Stack, Burrower, Live Wire, Sleet, Deep Chill, Bouncy Seeds, Jelly Legs, Wet Chalk) were plain "more of the same" and are dropped.

---

## Appendix B. Parked ideas

Designed in the first draft, not in any release plan now. Nothing here is built or counted. Each can come back as a later free update if it earns a place. Numbers are on the new HP where HP matters.

### B.1 Parked Trick Shells (15)

| Shell | Old group | Rule and numbers | Why parked |
|---|---|---|---|
| **Nesting Pots** | Cluster | A pot in a pot in a pot. 30 Blast, Medium; then 3 pots of 18, Small, 40 cells on; then 9 bits of 6, Tiny. Heavy | A third "many small blasts" shell [R02 §3.1]. Hard on the settle cap |
| **Clackety Sling** | Rapid | 8 pebbles in a stream, 9 Blast, Tiny each; each leaves 0.4 degrees higher | Reads the same on the wall as Gravel Sneeze and Pepper Rain. Its flight lives on in the enemy Rivet Rain |
| **Looking-Glass Ray** | Beam | A 55 Pierce Beam that reflects up to twice off Brassbound, Ice and Water | The reflect rule is now the Mirror Polish Quirk candidate |
| **Up-Sprout** | Digger | Bores up to 300 cells, then throws 5 sprouts up and forward: 15 Blast, Small each | Mole Mail with a cluster on the end. Two tricks in one shell |
| **Pigeon Post** | Guided | 3 pigeons at the apex, each to a different Revealed target: 16 Pierce (24 to a Hob). Threads | Three sure hits is the guided crutch (flag 17) in one card |
| **Doorknocker** | Guided | Steers to a Loophole within 80 cells and bursts inside: 40 Blast, Tiny, no Cover | Removes the skill from Threads, the best skill shot in the game |
| **Tall Order** | Terrain builder | Lifts your whole fort on a Clay pillar 64 high | Jack Screws does the rescue job. A fort on a plinth breaks the camera frame |
| **Cobble Cork** | Terrain builder | Adds one block where it lands: 80 HP Cobble on your fort, a 30 HP squatter on the rival's | Dollop and Quickset cover it. Foreign blocks in a rival fort are costly to make clear |
| **Bouncemoss** | Terrain builder | A Bouncy patch on 96 cells for 3 turns. Light and Medium shells bounce off and keep 80% speed | A ninth patch kind. The preview cannot show the bounce, so hits feel random |
| **Upsy-Daisy** | Gravity | Tosses every top block within 48 cells up 60 cells. Each takes and deals crush | Heavy Gravy and Lid Lifter own "the fort hurts itself". Worth 0 on Wicker roofs |
| **Patchwork Quilt** | Utility | Halves Blast on a 3 x 3 group of your blocks for 2 turns | One more way to stall [R02 §3.2] |
| **Lantern Moth** | Utility | Reveals rooms within 64 cells; your next shot there shows its whole arc | An echo of Tattle Bell. Full previews belong to the assist options |
| **Tinker's Lucky Dip** | Chaos | Becomes one of six listed shells, by seeded roll | Its list needs Frost and Zap shells. One Dud roll in six reads as a cheat on a small hand |
| **Junk Shell** | Chaos | Left behind after each Doodad you use. All Classes. Light. 25 Blast, Small (18) | Its source was a Kit keystone; the four-branch tree has no keystones [D02] |
| **Golden Gosling** | Chaos | A fan of 7 eggs. Six deal 2. One, by seeded roll, deals 100 Blast, Medium | Pure dice. Fails "easy pays less" |

### B.2 Parked Doodads (5)

| Doodad | What it did | Why parked |
|---|---|---|
| **Kettle Lid** | Your Heartkettle takes no damage for the next 2 enemy turns | A stall tool. Tea Cosy and Pot Lid already guard the kettle for one hit |
| **Bucket Brigade** | Soaks your whole castle. Ends every Burn, washes off Oil and Sticky | Answers one shell group. Water Butt, Skimmer and Odd Sock do it by aim |
| **Anchor Chain** | For 3 turns your castle cannot drop, Thump or be stopped by patches. It also cannot Walk | Answers three shots. Jack Screws fixes the same harm after the fact |
| **Dowsing Rod** | Your next 2 shots show the full arc. Shows ground types and buried props | Sells a UI readout, which the rulings forbid [R04 B13] |
| **Ear Trumpet** | Shows the rival's hand, Doodads and every cog. Reveals 2 random Nooks | Enemy crew and cogs are shown for free now [R04 B10] |

### B.3 Parked bench Knack (1) and crew Knack (1)

| Knack | Class | Rule | Numbers |
|---|---|---|---|
| **Farthing Shot** | Zinger | A bolt that grows as it flies. Rewards a long walk back | 30 Pierce, +1 per 30 cells flown, max 60. Wind none |
| **Popple Pod** (was Ginger's Knack) | Scatterjack | Splits on impact. 5 seeds hop once, 30 cells outward, and pop. Read too much like Bag of Marbles; Rising Fizz took its slot [review 06 U5] | 5 x 16 Blast, Small |

The other four bench Knacks ship as enemy-only Knacks (3.10).

### B.4 Parked combos (3)

| Combo | Parts | Why parked |
|---|---|---|
| **Trampoline** | Bouncemoss + Dried Pea or Clackerball | Bouncemoss is parked |
| **Tea Service** | Tea Cosy + Lightning Rod + Kettle Lid | Kettle Lid is parked, and a three-layer kettle shield is the Turtle |
| **Mirror Maze** | Winter Pudding (Ice) + Looking-Glass Ray | Looking-Glass Ray is parked. It returns if Mirror Polish ships as a Quirk |

### B.5 Parked rules

| Rule | What it was | Why parked |
|---|---|---|
| **Rarity** | Common, Uncommon, Rare and Dud, with pool weights 5, 3, 1 | No gacha, so the word has no job [R04 B16] |
| **Fire tags** | 13 tags (Lob, Burst, Rapid, Beam, Guided, Under, Earth, Ground, Fluid, Frost, Shield, Scout, Any) that set which Classes could fire a shell | Any Hob fires any shell [R04 B6]. One Match Class per card replaces them |
| **Knack tiers** | Tier 2 at Hob level 4 and Tier 3 at level 8 for all 28 Knacks | Hob growth is 3 Quirk ranks [R04 B8]. See Appendix A |
| **Echo rule** | A shell could be a weaker copy of a Knack, six at most | A weaker copy is not a new toy [R02 §3.1]. Kept shells that were echoes (Barrow Load, Quickset, Treacle Tart, Kettle Tickler) now stand on their own rules |
| **Shot on a buried Loophole bursts on the sill** | The Hob's own shot hit the dirt at its window | Self-harm from a UI miss. The Fire button greys [R04 B9] |
| **Chill as its own status** | Reload +1 on the Hob's next shot, stacking with other sources | Merged into Rest with a +1 cap [R04 B16] |
| **Coats and Zones as two keywords** | Sticky, Bouncy, Oil, Ice coats and five Zone kinds, each with its own rules text | Merged into "patch" [R04 B16] |
| **Own shake and slow-mo tables** | Six shake levels up to 14 px and this doc's own slow-mo speeds | 07 owns feel numbers [A C83] |
| **Side Rival Doodads** | Six Doodads unlocked from optional side Rival levels | Those levels were never built into the campaign [A C34]. Every Doodad now has a source that exists |
