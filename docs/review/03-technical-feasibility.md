# 03. Technical Feasibility Review

Status: review for owner and leads. Date: 2026-11-22. Reviewer: principal engineer.

Scope: can the full Castle Protect design (`docs/design/00` to `07`) be built well on the chosen stack (`docs/research/04-tech-stack.md`: TypeScript, Phaser 4, Vite, Capacitor 8, PWA, pure deterministic sim package)? This doc does not change any design rule. Where the design is unclear or two docs clash, section 8 lists it for a ruling.

**Cites.** `[00 §2.7]` is `docs/design/00-core-game-design.md` section 2.7. `D01` to `D07` are the other design docs. `R03` is `docs/research/03-code-and-tech-survey.md`, `R04` is `docs/research/04-tech-stack.md`.

**Tags.** `[est]` marks my estimate from past work. Every `[est]` number must be measured in the first six weeks (section 6) before we trust it.

---

## 0. Verdict

- **Yes, the stack can carry this design.** Nothing in it needs a physics engine, a server, threads beyond one worker, or native code. Turn-based play keeps the per-frame load small. The heavy work (AI search, resume, bots) runs on a pure sim that we own.
- **The design is about 2x the size the stack doc planned for.** R04 budgets 64 engineer-weeks. The design now holds 109 shots, 19 Doodads, 28 Hobs, 28 enemy units, about 23 hazards, 6 Grand Forts in 8 fights, 7 mini-bosses, 10 mission types, 8 modes and a full castle editor. My estimate: about 133 engineer-weeks for a sane launch scope, about 160 for the full design, both with contingency (section 7).
- **The three real risks** are (1) collapse that looks stiff next to rigid-body games, (2) AI search inside a fixed sim budget on a 2 GB phone, and (3) the long tail of shot rules breaking determinism or turning into one-off code. All three get a prototype with a pass line in weeks 1 to 6.
- **Physics ruling: custom deterministic support and collapse in the sim. No Planck.js in the sim.** Falls get their drama from the view (section 2).

---

## 1. System by system

Each system lists: how to build it, risk, cost on a 2 GB 2019-class Android phone in a WebView, and determinism traps. Perf numbers are `[est]`.

**Shared number rules for the whole sim** (they answer most traps below, so I state them once):

1. Sim math is float64 with only `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.abs`, `Math.min`, `Math.max`, `Math.sign`. JavaScript fixes these to IEEE 754 results on every engine and bans fused multiply-add, so V8 (Android, Chrome, Node), JavaScriptCore (iOS) and SpiderMonkey (Firefox) agree to the bit.
2. Banned in `packages/sim` by lint: `Math.sin/cos/tan/atan/atan2/exp/log/pow/hypot/cbrt/random`, the `**` operator, `Date`, `performance`, `Intl`, `toFixed`, `parseFloat` on computed text. Own `sin`, `cos`, `atan2` come from a 3600-entry table (tenths of a degree) plus a fixed polynomial.
3. Angles are integer tenths of a degree. Power is an integer 0 to 110 (Steam Shot [D02 SS-10]). HP and damage are integers, rounded once at apply time.
4. One seeded generator family (sfc32) with **named streams**: `battle` (shell dice, Lucky Dip, Golden Gosling), `ai.<side>` (aim error, jitter, pick rules), `hazard` (unused today: hazards never roll [D05 §4.5]), `cosmetic` (view only, never hashed). An AI candidate sim copies the `battle` stream state and never advances the real one.
5. Iterate arrays sorted by id. Never iterate a `Map`, `Set` or object keys that the view filled.
6. State hashing reads raw bits through a `Float64Array` view, maps `-0` to `+0` and every NaN to one pattern first. A NaN in state is a bug; property tests hunt for it.

### 1.1 Byte-grid terrain

- **Build.** One `Uint8Array` per map, one cell per logical pixel: M maps 2400 x 720 (1.7 MB), L maps 3200 x 720 (2.3 MB). A material table (about 24 ids: air, Loam, Clay, Rock, Bedrock, Mud, Water, Ice, Lava, Pressed Plate, Oil, Soup, Snow, Gas, plus fluid and coat helpers) holds hardness, loose flag, liquid flag, colour key. Ops: `carveCircle`, `carveWedge`, `carveColumn`, `stampMask` (mounds, hedges, Clay pillars), `convert` (Water to Ice, Loam to Mud), `settleLoose(rect)` by column compaction [R03 §6]. Every op returns a dirty rect. Shell sweeps walk cells with DDA [R03 §7.2]. A `solidAt(x, y)` query merges terrain and castle blocks.
- **Copy-on-write tiles.** Split the grid into 64 x 64 tiles behind an index array. An AI candidate sim clones only the index; the first write to a tile copies 4 KB. This lets AI sims carve (Rubber Radish pops change the next bounce) with no 1.7 MB copy.
- **Fluids** (Scaldspill 40 units, Drenchbarrel 60, Lamp Oil 30, Tide, the Water Line): no cellular flow. A pour finds the local low point by walking downhill along the surface, then fills the basin level by level with a fixed-order flood fill until the units run out. Units are cells x a constant. The fill is exact and instant in the sim; the view animates it over 400 ms.
- **Falling ground** (Rockfall Shelves, Hoisted Hills, Avalanche Slopes, Stalactites, snow slab): authored **loose bodies** with their own mask, not open-ended "find floating islands" search. On trigger the sim lifts the mask out, drops it straight down to first contact, stamps it back. Clay and Rock islands made by blasts simply hang, as in the genre.
- **Risk: Medium.** Carve and settle are proven. Fluids and loose bodies are new code but bounded.
- **Perf.** Medium blast carve (2.5k cells) about 0.1 ms; Huge (13k cells) about 0.3 ms; settle over a 160 x 720 rect about 0.5 ms; a 60-unit pour about 1 to 3 ms, once. Fine inside the 2 ms tick budget.
- **Traps.** Flood fill order must be fixed (scan line, left to right, top to bottom). Settle must use the rect from the sim, never from the view. Pour units must be conserved exactly (a property test). Fluids must see castles as solid, so rasterize castle footprints into a temp mask first.

### 1.2 Castle blocks, materials and support collapse

- **Build.** Each castle is its own small grid (up to 8 x 10 slots of 16 x 16 cells) with a world offset `(x, y)`. Store blocks as structure-of-arrays typed arrays (material, hp, maxHp, shape, flags, status turns), capped at 80. Each block has a **shape mask id**: full, Brace left, Brace right [D02 CM-03], and variants with a Peephole or Loophole slot cut in. Shells test the castle's box first, then the block slot, then the 16 x 16 bit mask. Own shots pass own blocks [00 §2.7].
- **Support solver.** Run once at the end of any tick that removed or changed a block:
  1. Seed: Footing row is supported with side reach 0.
  2. Column pass, bottom up: a block resting on a supported block gets reach 0.
  3. Side pass: a block beside a supported block gets `reach = neighbour + 1` if `reach <= limit` (2, or 4 along a Brace line, 0 for Heavy Gravy and Fault Line, ignored for Prop Up braced columns).
  4. Repeat 2 and 3 to a fixed point. 80 blocks settle in at most 10 passes.
  5. Unsupported blocks form chunks by 4-way flood fill in id order. Each chunk falls straight down, lands on the first block, castle, or terrain cell under any of its cells, breaks, and deals crush [00 §2.10]. Then re-solve. Cap the cascade at 6 rounds.
- **Falling chunks are sim actors**, not instant teleports. A chunk falls with `y += v; v += g` at the sim step until contact, so a marble or bee in the same resolve meets the chunk where the player sees it. Chunks move only down, never rotate in the sim.
- **Ground under the castle.** The castle rests on the highest solid cell under its Stomper footprint. If ground is carved away, it drops; over 48 cells is a Thump [00 §2.7].
- **Risk: Medium for the rules, High for feel.** The rules are simple. Making a straight-down drop look like a real topple is the main feel risk of the project. Section 2 covers it.
- **Perf.** Solver about 20 to 50 µs for 80 blocks; a full cascade under 0.5 ms. Two castles plus Outposts and boss add-ons stay under the 250-piece scene cap [00 §2.7].
- **Traps.** The core rule reads two ways (does a block sitting on a cantilevered block count as "support below"?). Pick one and write a test table of 30 shapes (section 8, item 1). Chunk ids must come from a fixed scan order. Never derive chunk order from a `Set`.

### 1.3 Footing

- **Build.** A row flag, not a material quirk in code: material `footing`, `neverFalls`, Dig x0, Blast x0.25, elements x0 [00 §2.8]. Bore shots stop and pop at half [D01 §1.6]. Dug In widens it by one block each side [D02 SS-K2].
- **Risk: Low.** **Perf:** none. **Traps:** none beyond the shared rules.

### 1.4 Nooks, Loopholes, Peepholes and cover

- **Build.** A Nook is a 2 x 2 hollow tracked as a room record: the slot ids of its walls, floor and ceiling, its Loophole rect (6 cells tall in the front wall [D03 §7.2]), its seat words, its Hob id or ids (Crowded). `isIntact(nook)` checks four sides as the crew doc reads it (floor, ceiling, front, back) [D03 §9 item 2]. Cover halves area payloads centred outside an intact Nook [D01 §9 item 2]. Threading: a Pin-flagged actor whose sweep enters the Loophole rect hits the Hob with no cover. A buried Loophole is a solid terrain cell inside the Loophole rect at fire time; the shot bursts at once [D03 §7.2]. A Peephole is a flag plus a 6-cell gap in the block mask.
- **Risk: Low to Medium.** The ladder in D03 §7.4 (Rattled to Squashed) has many states; each is a small rule.
- **Perf.** Room checks run at blast time over at most 6 Nooks. Trivial.
- **Traps.** The cover check must use the block state at the moment of the blast, before this tick's collapse. Write the phase order down (section 3.4) and test it.

### 1.5 Hob statuses and crew

- **Build.** Hob record with HP, class, Nook id, reload count, last aim, Knack uses, and a status list `{kind, turns, stacks, source}`. Kinds: Burn, Brittle, Chill, Soaked, plus Mark (Tattle Bell), RedTape, BuriedLoophole. Block statuses share the same list type: Burn, Brittle, Soaked, Oiled, Heavy, Braced, Quilted. Turn-edge ticks run in a fixed order: Burn damage, Burn spread (downwind rule at wind 5+ [D01 combo 1]), Moonbrick heal (skipped if Brittle), timers count down, expiries. Combo bonuses (Brittle x1.5, Soaked + Zap x1.5) do not stack [D01 §9 item 4].
- **Fall ladder.** When a Nook floor breaks the Hob becomes a tiny actor that drops to the first surface. Land in a free Nook: reseat. Land on rubble: Perched. Out of the castle: Tumbled, 20 damage, climbs to the lowest free Nook.
- **Risk: Low.** Many small rules, each easy to unit test.
- **Perf.** Negligible.
- **Traps.** Burn spread must pick targets in block id order and use the spread state from the start of the tick, not mid-update, or two fires race.

### 1.6 The 72 Trick Shells (and all 109 shots)

- **Build.** Every shot is data: a flight model, triggers and effect parts (section 3.3). The sim ships about 10 flight models and about 40 effect parts. No shell id appears in sim code (a CI grep fails the build if it does).
- **Rollers** (Rolypoly, Cheese Wheel, Wick Runner, marbles, Mow Line): on low-speed contact, switch from ballistic to `roll`. The actor sticks to the surface, gets tangential gravity from the surface normal, climbs up to 45 degrees, hops 16 cells with Little Jump, stops in Mud, Sticky and Water [00 §2.1]. Normal comes from a 5 x 5 solidity sample around the contact cell, a fixed integer kernel.
- **Bouncers** (Rubber Radish, Pinball Pea, Clackerball, Splashback Stone, Skimmerstone): reflect velocity about the surface normal with a per-shell keep factor; count touches; fire `bounce` triggers. Skip rule: landing angle under 30 degrees on Water, Ice or ground.
- **Crawl** (Snailbomb): contour following with a fixed neighbour order (Moore tracing), 40 cells per second.
- **Bore** (Nibbler, Mole Mail, Burrowbomb, Sleepy Sapper): moves through loose ground at a per-material speed, carves a tunnel of set width as it goes, stops at Rock, Bedrock, Footing.
- **Beams** (Sunspear, Borelight, Looking-Glass Ray, Kettle Tickler): instant ray march in one tick with pass-through counts and reflections off Brassbound, Ice, Water.
- **Guided** (Nosy Goose, Plumb Bob, Pigeon Post, Doorknocker, bees): steer toward a Revealed target with a max turn rate per step. Targets come from the firing side's knowledge, never the true state. Bees do not path-find; they steer and bounce.
- **Steered** (Clockwork Beetle, Snoop Kite): player taps and drags become `steer` commands stamped with the sim tick and stored in the log.
- **Gravity and fields** (Lodestone Lump, Featherfall Dust, Updraft Vents, Draughts, Bellows): a short list of force fields (box or circle, kind, strength) applied each step. Lodestone pull uses `k * dx / d2`, which needs only division and `sqrt`.
- **Timed** (Tick-Tock Crock, Hot Potato, Cuckoo Clock, Sky Order, Sleepy Sapper, Alarm Egg): spawn a prop with HP and a `turnStart` or `tripped` trigger. Props attach to a block id or a terrain cell, so a Walk carries a Cuckoo Clock along and leaves a Sky Order mark behind.
- **Terrain builders** (Sod Sack, Quickhedge, Molehill Surprise, Cobble Cork, Tall Order, Scrap Stack, Jack Screws): `stampMask` for ground, `addBlocks` for snapped blocks, `liftFort` for pillars.
- **Risk: High for schedule, Medium for tech.** Each part is easy. 109 shots times tiers times combos is a lot of edge cases.
- **Perf.** One shell is about 360 steps per resolve; a 12-piece cluster is about 3k actor-steps. At 120 Hz that is 2 to 25 actor-steps per frame: under 0.1 ms. The cap from D01 red flag 13 (12 sub-shells, 60 fluid units, 3 zones) keeps the view safe.
- **Traps.** (a) Steered input must be in the log with its tick. On resume during a Steered flight, restore the turn's Plan step instead of replaying a flight whose later taps were never saved. (b) Random shells (Lucky Dip, Golden Gosling) draw from the `battle` stream at fire time, once. (c) Copycat Crock copies the resolved shot def, tiers and mods included, from the log, not from a live pointer. (d) Splits spawn children in a fixed index order, and children start moving the next tick.

### 1.7 Elemental Coats and Zones

- **Build.** Coats (Sticky, Bouncy, Oil, Ice) live in a half-resolution `Uint8Array` coat grid (one byte per 2 x 2 cells, 0.43 MB on M maps) that holds a coat instance index, plus a coat list with type, owner and turns left. A block coat is a block flag. Zones (Ember Patch, Frost Field, Soot Cloud, Feather Zone, Storm Cloud) are circles with owner, turns left and drift rule, capped at 3 per side [D01 §9 item 15]. Ticks run at the owner's turn start in id order.
- **Risk: Medium.** Interactions (Burnt Toffee, Skating Rink, Fry-Up) are many but each is a rule on a tick, so the event order in section 3.4 makes them testable.
- **Perf.** Turn-edge only; under 1 ms per turn edge.
- **Traps.** "A new coat replaces the old one on the same cells" must write cells in a fixed scan order. Zone drift by wind uses integer cells per wind point.

### 1.8 Doodads

- **Build.** A Doodad is a command (`useDoodad {id, target?}`) whose def reuses effect parts plus five small ones (setWind, wipeGhosts, revealHand, swapNooks, clearReload). Mole Mine is a hidden prop owned by one side; hidden props are filtered out of the rival's knowledge.
- **Risk: Low.** **Perf:** negligible. **Traps:** Jester's Jingle resets AI bracketing, so the AI memory lives in sim state (hashed), not in the worker's private memory.

### 1.9 Walking forts on Stompers with Steam

- **Build.** `walk {side, dxCells}` command. The sim steps the fort one cell at a time: rest height is the highest solid cell under the footprint; uphill costs x2, Mud x3, Ice half with Mud Boots; stop at a cliff over 64 cells, deep water, Sticky with Jelly Legs, or the per-turn Steam cap. Tripped props (Alarm Egg, Sleepy Sapper) fire as the fort passes. Barges and rafts rest on the water surface. Boss Movers and Big Smoothie use the same mover code on a rail.
- **Risk: Low to Medium.** The castle never tilts [00 §2.7], which keeps it simple.
- **Perf.** A 40-Steam walk is at most 160 cell steps, each a footprint height scan (128 columns): about 20k reads, under 1 ms.
- **Traps.** The walk preview bar must call the same sim function on a copy. Steam is an integer.

### 1.10 Weather fronts and wind

- **Build.** Wind is an integer per front, drawn from the `battle` stream at battle start for all fronts (so the forecast is known and stable). Bottled Gust, Bellows, Weathercock and Gust Puff write overrides with turn spans. Draughts and wind lines are local fields.
- **Risk: Low.** **Perf:** none.
- **Traps.** Draw all fronts up front. If a front is drawn lazily, any extra RNG call (a Lucky Dip) shifts later wind and breaks golden replays when a shell changes.

### 1.11 Hazards (about 23)

- **Build.** Five reusable kinds cover them: **beat object** (Mole Mounds, Burp Vents, Tide, Stampers, Mine Carts, Snow Drifts, Sink Mud), **reactive object** (Tumblestones, Rockfall Shelves, Icicle Racks, Gas Pockets, Marsh Gas, Hoisted Hills, Thin Ice, Avalanche Slopes, Stalactites), **field** (Updraft Vents, Lodestones, Bellows Towers, Draughts), **surface object** (Springy Hedges, Butting Goats), **material** (Lava). Each has a data def plus at most one named behaviour. The Hazard Beat runs at Round start, left to right [D05 §4.6]. Snow Drift spots are authored, not computed from wind shadow.
- **Risk: Medium.** Content volume, not tech.
- **Perf.** Turn-edge work under 2 ms; Tide rewrites up to about 150k cells once (about 1 ms) plus about 10 chunk redraws spread over frames.
- **Traps.** Reactive hazards trigger from sim events in the same tick order as everything else. "Hazards never roll dice" holds today; keep a lint that the hazard module has no RNG import.

### 1.12 Boss moving parts (Rig Parts)

- **Build.** A boss is a castle plus a rig script in data: phases, notch triggers (kettle %, part broken, round, Hobs left), and a list of actions per phase that run only at turn edges [D04 §4.1]. Action kinds: `regrow`, `moveRail`, `shieldOn/Off` (by damage type or face), `terrainScript` (water line, sand ridge, flatten line), `summon` (Hob into Nook, add-on fort), `setPiece` (telegraph now, fire next turn with scripted error), `setWind`. Shields with shape (the Sanding Wheel rim that glances shots) are actor colliders with a reflect rule. A few bosses need one named behaviour each (Level Engine Hill Call, Grand Roller flatten line).
- **Risk: Medium to High.** Eight fights with three phases each is a lot of scripted content that bots must pass.
- **Perf.** Turn-edge only. The Great Press flattens a band of terrain once per slam: a 200-cell wide rewrite, about 1 ms.
- **Traps.** Stage saves in the final fight need the snapshot path (section 1.15). Phase triggers check in a fixed order at a fixed point in the turn.

### 1.13 AI candidate sim inside a fixed sim budget

- **Build.** As D04 §6.2, with four engineering rules:
  1. **The worker keeps a replica sim.** It gets the same commands as the main sim and checks the turn hash. No per-turn state transfer.
  2. **Budget in work units, not sims.** 1 unit = 1 actor-step. Carving costs cells / 64. A support solve costs 200. A cluster shell costs what it really costs. A fixed unit budget per preset keeps the AI equal on every device and stops a cluster-heavy hand from blowing the time.
  3. **Believed world.** Candidate sims run on a copy where hidden Nooks hold "maybe a Hob" at last-known class, built from the knowledge view. The AI module never imports the true crew layout [D04 §6.2 step 1].
  4. **Logged output.** The AI's chosen command goes in the log. Replays and resume never rerun the AI.
- **Risk: High** until the week 5 prototype passes. Section 4.2 has the math.
- **Traps.** AI must draw jitter and errors from its own stream, in a fixed order, regardless of how many candidates it sims. The sort of candidates must break ties by a stable key (candidate index), not by score alone.

### 1.14 Replays

- **Build.** A replay is `{simVersion, contentHash, levelId, seed, loadouts, commands[], turnHashes[]}`. Hash at each turn end (not every 600 ticks mid-resolve; a full-state hash mid-flight is a frame spike). Keep per-tile hashes that update on dirty writes so a turn hash costs under 1 ms. Brag Clips and the "best shot" window replay from the nearest turn snapshot. Almanac and Rummage card clips run tiny canned scenes once and cache the event tape; only one clip draws at a time.
- **Risk: Low** given the sim rules. **Perf:** a few KB per battle.
- **Traps.** A content patch changes outcomes, so the replay stores the content hash and shows "may differ" when it does not match.

### 1.15 Crash resume by command log

- **Build.** At each turn start write the battle save: the command log (truth) plus a **turn snapshot** (cache): terrain as a run-length diff against the level's base grid, castles, Hobs, props, zones, coats, RNG states, AI memory. 10 to 40 KB, deflated. Resume loads the snapshot, checks its hash against the log's turn hash, and opens the Plan step. If the snapshot is bad, replay the log from the seed.
- **Do not ship old sim versions** to resume old battles (D07 §8.4 suggests it). After an update, load the snapshot under the new rules: the battle carries on under the new rules from that turn. Replays of old versions show "may differ". This avoids bundling and testing several sims.
- **Risk: Low to Medium.** **Perf:** snapshot load under 50 ms; full log replay of 15 rounds (about 14k ticks) about 0.3 s on the low-end phone, well inside D07's 1.5 s.
- **Traps.** Write the save off the main thread path and never during a resolve. The background write in D07 §8.1 (aim, camera, Steam walked) is view state; keep it out of the hash.

### 1.16 Daily Dust-up seeded mode

- **Build.** Seed is FNV-1a 32 (with `Math.imul`) of `CP-DAILY|YYYY-MM-DD|tableVersion` [D05 §5.2]. The seed picks from versioned, append-only tables with the `battle` stream. Fair AI uses the fixed budget, so the battle is the same on every device on the same content version.
- **Risk: Low.**
- **Traps.** A balance patch changes a past date's battle. Store the content hash with each Daily best score and mark scores from older content. Local date comes from the UI layer and enters the sim only as the seed text.

### 1.17 Save export codes

- **Build.** Canonical JSON of the profile (Blueprints packed as binary: 80 blocks x 2 bytes each), deflate with `fflate` (pure JS, same bytes on every platform; do not rely on `CompressionStream`, which older WebViews lack), then base32 with the 32-symbol alphabet that drops O, 0, I, 1 (26 + 10 - 4 = 32, an exact fit). Header `CP1-`, schema number, CRC32. A late save of about 25 KB JSON deflates to about 4 KB, which is about 6.4k characters: inside D07's 3k to 6k only if Blueprints are packed.
- **Risk: Low.**
- **Traps.** Clipboard writes on iOS WKWebView need a user gesture. Use the Capacitor Clipboard and Share plugins on native.

### 1.18 Systems not in the list that still cost real work

- **Workshop editor** (build, seat, Blueprints, Test Yard, decor, refunds): medium risk, 4 to 5 weeks. It runs the support solver live, so the solver must be fast and pure.
- **Camera and aim input** across touch, mouse, keyboard, gamepad: medium, 4 to 6 weeks.
- **Content tools**: terrain mask import, level preview, Lump Rule and reach checks as CI. 124 hand-made maps (60 campaign, 40 Dust-up, 24 Siege [D05 §5]) need a tool path. Medium.
- **Screen reader mirror layer and full accessibility** [D07]: medium, 3 weeks.

---

## 2. Physics ruling

**Ruling: custom deterministic support and collapse in the sim. Planck.js stays out of the sim and out of the launch build.**

Reasons:

1. **The design fixes the outcome rule.** `00 §2.7` makes the support rule part of the game: AI, preview, replays and Daily must agree. Planck would replace a 200-line rule with a solver whose result we can only observe.
2. **Cross-engine determinism.** Planck uses `Math.sin`, `Math.cos` and `Math.atan2` in rotations and is not promised bit-exact across V8, JavaScriptCore and SpiderMonkey [R03 §7.3]. Golden replays run in CI on all three; the Daily must match across phones.
3. **AI cost.** D04 §6.2 runs the full collapse on the top 8 candidates per turn. A Planck settle is about 180 steps at 60 Hz with 8 velocity iterations over up to 160 bodies, plus a world clone per candidate. The custom solver is under 0.5 ms per collapse.
4. **Settle time.** The core caps settle at 3 s [00 §2.2]. Rigid bodies wobble and need a forced-sleep hack (R03 §10.3). The custom fall ends when the sim says.
5. **Size and memory.** Planck adds about 200 KB min to a 600 KB code budget and a body per block.

**What we give up.** Sideways topples, blocks that slide off, and towers that lean before they fall. The view fakes each of these within the sim's end state.

**How falls look good (view only, never read back):**

- **Creak first.** 120 ms before a chunk drops, it shivers 1 px and the material creak plays. Cracked sprites (3 damage states per material) show stress earlier.
- **Pivot, then fall.** The view finds the last support edge the chunk lost and tilts the chunk up to 12 degrees around it as it starts down, then eases it back toward level so it lands square in the cells the sim chose. Tall chunks lean more.
- **Stagger.** A chunk of many rows releases its rows 60 to 90 ms apart from the bottom up, so a tower reads as a topple, not an elevator.
- **Land and break.** Squash on contact (90% height for 60 ms), then the chunk breaks into 2 to 4 shard sprites per block that fly on cosmetic arcs from the `cosmetic` stream, plus dust puffs sized by material. Wicker flutters, Cobble thuds and skids, Brassbound clangs and bounces once.
- **Debris that stays.** Shards fade into a rubble decal on the terrain chunk texture (cosmetic only).
- **Juice.** Shake level by blocks fallen [D01 §8.1], slow-mo rule 4 at 6+ blocks, Hob flail and squash poses, sound tails by material.
- **Tiers.** Low tier: 1 to 2 shards per block, 120 debris cap. High tier: 4 shards, 300 cap.
- **Optional later.** If week 3 playtests still say "stiff", Planck may drive shard sprites only on the high tier, behind a flag, never read by rules. Not for launch.

---

## 3. Sim architecture

### 3.1 Modules

```
packages/sim/src/
  core/      fixed math (trig tables), rng streams, ids, event queue, command types, hash, clock
  state/     BattleState types, snapshot write and read, copy-on-write tiles, clone for AI
  terrain/   grid, materials, carve, stamp, settle, pour (fluids), convert, loose bodies, normals, sweep
  castle/    block arrays, shapes, rooms, support solver, falling chunks, rest and walk, cover
  actors/    flight models: ballistic, beam, bore, roll, bounce, crawl, guided, steered, prop, chunk
  parts/     effect part registry (about 40 parts), each with tests
  fields/    wind, updraft, lodestone, feather, draught
  status/    statuses, coats, zones, turn-edge ticks
  crew/      hobs, fall ladder, reload, seat and neighbour perks
  match/     turn machine, Rummage, Doodads, win paths, tiebreak, Siege Score, mission rules, weather, hazard beat
  rig/       boss phases, rig parts, set pieces
  ai/        knowledge view, candidates, closed-form solve, budget, score, error model, draft, walk, doodads
  replay/    log, verify, golden runner
packages/content/   JSON + Zod schemas + compiler (resolve tiers and mods, check ids, Lump Rule, hash)
packages/bots/      proxy players, balance runs, reports
```

Lint rules: `sim` imports nothing outside `sim` and `content` types; `ai` may not import `state/true-crew`; no shell, Hob or level id string literal in `sim`.

### 3.2 Data model (TypeScript)

```ts
// ---------- ids and small types ----------
type Id<T extends string> = string & { __kind: T };
type ShotId = Id<"shot">; type HobDefId = Id<"hob">; type LevelId = Id<"level">;
type Side = 0 | 1;
type DamageType = "blast" | "pierce" | "dig" | "fire" | "frost" | "zap";
type Weight = "L" | "M" | "H";
type BlastBand = "pin" | "tiny" | "small" | "medium" | "large" | "huge"; // 0,10,18,28,42,64 cells
type Cond = Record<string, string | number>;          // e.g. { "target": "brittle" }, { "turnOf": "owner" }
type ModOp = { select: string; path: string; op: "add" | "mul" | "set" | "addTrigger"; value: unknown };
type GoalDef = { type: string; value?: number };
type MaterialId = "wicker" | "timber" | "cobble" | "brassbound" | "moonbrick" | "footing" | "hedge" | "scrap" | "squatter";

// ---------- shots (content) ----------
interface ShotDef {
  id: ShotId;
  kind: "plain" | "knack" | "trick" | "twist" | "junk";
  hidden?: boolean;                  // child shells and props, never in the Rummage
  tag: "lob" | "burst" | "rapid" | "beam" | "guided" | "under" | "earth" | "ground"
     | "fluid" | "frost" | "shield" | "scout" | "any";
  family?: string;                   // design family, for pool rules
  weight: Weight;
  rarity?: "common" | "uncommon" | "rare" | "dud";
  damageType?: DamageType;
  skillFactor: 0.5 | 1 | 1.5;
  tagsExtra?: ("metal" | "pin" | "threads" | "ignoresCover")[];
  dial?: { kind: "direction" | "address" | "choice" | "turns"; options?: string[] };
  steered?: { input: "tap" | "drag"; taps?: number; seconds?: number };
  flight: FlightDef;
  triggers: TriggerDef[];
  tiers?: { name: string; patch: ModOp[] }[];   // Knack Tier 2 and 3
  ui: { icon: string; colour: DamageType | "none"; cardKey: string; launchSfx: string };
}

type FlightDef =
  | { model: "ballistic"; speedScale: number; gravityScale: number; windFactor: number; drag?: number;
      radius: number; turnBackAt?: number; windStopsAtApex?: boolean }
  | { model: "beam"; maxLen: number; passBlocks?: number[]; reflectOn?: string[]; maxReflects?: number }
  | { model: "bore"; maxCells: number; width: number; speedByGround: Record<string, number> }
  | { model: "roll"; seconds: number; maxSlopeDeg: number; hop?: number }
  | { model: "bounce"; touches: number; keep: number; skipUnderDeg?: number; base?: FlightDef }
  | { model: "crawl"; cellsPerSec: number; seconds: number }
  | { model: "guided"; base: FlightDef; bendDeg: number; from: number; targets: ("revealedHob" | "kettle" | "loophole")[] }
  | { model: "steered"; base: FlightDef; turnRateDeg: number }
  | { model: "prop"; hp: number; shove: boolean; attach: "block" | "ground" };

type TriggerKind = "launch" | "apex" | "impact" | "bounce" | "rest" | "near" | "hitHob"
  | "enterRoom" | "distance" | "turnStart" | "tripped" | "destroyed";

interface TriggerDef {
  on: TriggerKind;
  n?: number;                        // e.g. the Nth bounce, or turns after landing
  if?: Cond[];                       // e.g. { target: "brittle" }
  once?: boolean;
  do: EffectDef[];                   // run in order
}

type EffectDef =
  | { op: "explode"; dmg: number; type: DamageType; band: BlastBand; carve?: number; mult?: Partial<Record<MaterialId, number>> }
  | { op: "split"; child: ShotId; count: number; spreadDeg?: number; speedKeep?: number }
  | { op: "spawnProp"; prop: ShotId }
  | { op: "zone"; kind: string; radius: number; turns: number; drift?: number }
  | { op: "coat"; kind: "sticky" | "bouncy" | "oil" | "ice"; width: number; turns: number }
  | { op: "pour"; fluid: "water" | "soup" | "oil"; units: number }
  | { op: "stamp"; mask: string; material: string } | { op: "addBlocks"; material: MaterialId; shape: string; hp: number }
  | { op: "status"; kind: string; turns: number; radius?: number; onBlocks?: boolean; onHobs?: boolean }
  | { op: "reveal"; radius: number } | { op: "push"; cells: number } | { op: "setWind"; value: number; turns: number }
  | { op: "chain"; along: MaterialId; keep: number } | { op: "column"; dmg: number; type: DamageType; blocks: number }
  | { op: "transform"; pickFrom?: ShotId[]; copy?: "rivalLastTrick" }
  | { op: "special"; name: string; args?: Record<string, number | string> }; // about 10 named parts

// ---------- battle state (sim) ----------
interface Block {                    // stored as typed arrays; this is the logical view
  slot: number;                      // y * 8 + x in castle grid
  mat: MaterialId; hp: number; maxHp: number;
  shape: "full" | "braceL" | "braceR";
  flags: number;                     // peephole, loopholeCut, burning, oiled, soaked, heavy, braced, quilted
  statusTurns: Uint8Array;           // per status kind
}

interface Hob {
  id: number; def: HobDefId; side: Side; cls: string;
  hp: number; maxHp: number; level: number;
  nook: number | null; state: "seated" | "perched" | "porch" | "tumbled" | "bonked";
  reload: number; knackUses: number; lastAim: { angle10: number; power: number };
  statuses: { kind: string; turns: number; src: number }[];
}

interface Nook { id: number; walls: number[]; floor: number[]; ceiling: number[]; loophole: { x: number; y: number; h: 6 }; hobs: number[]; seat: string[] }
interface RigState { rigId: string; phase: number; parts: { id: string; hp: number; on: boolean }[]; pending: string[] }

interface Castle {
  side: Side; x: number; y: number; w: number; h: number;
  blocks: Block[]; nooks: Nook[]; kettle: { slot: number; hp: number; maxHp: number; shield?: number };
  steam: number; rig?: RigState;
}

interface Level {
  id: LevelId; size: "P" | "S" | "M" | "L"; width: number; height: 720;
  terrain: { mask: string; palette: Record<string, string> };        // PNG colour to material
  pads: [{ x: number; y: number; w: number }, { x: number; y: number; w: number }];
  mission: { type: "SS" | "DC" | "RH" | "TD" | "PS" | "ES" | "KH" | "SW" | "TS" | "GF"; params?: Record<string, unknown> };
  roundCap: number; firstTurn: Side | "coin";
  weather: { tag: string; windMin: number; windMax: number; frontRounds: number };
  hazards: { kind: string; at: [number, number]; period?: number; offset?: number; params?: Record<string, unknown> }[];
  objects: { kind: string; at: [number, number]; params?: Record<string, unknown> }[];
  rival: { id: string; blueprint: string; crew: HobDefId[]; personality: [string, string]; aim: 1 | 2 | 3 | 4 | 5; rig?: string };
  rummage: { pool: number; picks: number; lock?: ShotId[]; mustInclude?: string[] };
  pennants: [{ type: "win" }, GoalDef, GoalDef];
  checks: { lump: string[]; reachPowerMax: number; botBand: string };
  goldens: string[];                                                  // three replay files [D05 §4.5 item 8]
}
```

### 3.3 Event system for shell behaviours

Two layers:

1. **Triggers and effect parts (content).** An actor carries its shot def. When the flight model reports a fact (apex, contact, bounce N, at rest, near an enemy piece, entered a room, turn start for props), the actor's matching triggers queue their effects.
2. **Outcome events (sim bus).** Effects emit facts: `carved`, `blockDamaged`, `blockDestroyed`, `hobHit`, `bonk`, `statusApplied`, `propTripped`, `chunkFell`, `kettleHit`. Internal rules subscribe (Burn spread, Brittle consume, Alarm Egg trip, Mole Mine, support re-solve flag). The view and audio read the same stream. The view never writes back.

**Queue order.** Every queued effect has a key `(tick, phase, actorId, triggerIndex, seq)`. The queue is a binary heap with that total order. Spawned actors take the next id and first move on the next tick. Effects that spawn effects may nest 4 deep; an actor cap of 64 per shot stops runaway chains.

### 3.4 Tick and turn phases

Per tick (120 Hz, one clock for everything; this settles R03 120 Hz vs R04 60 Hz):

1. Apply commands for this tick (fire, steer, walk step).
2. Fields: wind, updrafts, lodestones, feather zones.
3. Move actors in id order; collect contacts.
4. Fire triggers in `(actorId, triggerIndex)` order; queue effects.
5. Drain the effect queue in key order. Damage and cover read block state as it was at the start of step 5.
6. Settle: loose ground in dirty rects, support solve, new falling chunks, Hob fall ladder.
7. Emit outcome events to the view.

Per turn edge: hazard beat (round start only), rig phase checks and actions, prop timers, zone ticks, status ticks, Moonbrick heal, weather front change, autosave.

Resolve ends when no actor moves and no chunk falls, or at the 3 s settle cap after the last impact [00 §2.2], counted in ticks (360).

### 3.5 How 109 shots stay data driven

- **Count:** 8 Plain Shots, 28 Knacks, 72 Trick Shells, 1 Junk Shell = 109. Plus 5 bench Knacks and 8 Flattener Twists on the same parts.
- **Parts budget:** about 10 flight models, 12 trigger kinds, about 30 general effect ops, about 10 named `special` ops. Specials I expect: `copyShot` (Copycat Crock), `hoverDrop` (Plumb Bob), `deliver` (Special Delivery), `gongRing` (Dinner Gong), `tossTopRow` (Upsy-Daisy), `liftFort` (Tall Order, Jack Screws), `brassRun` (Kettle Tickler), `stormStrike` (Storm in a Teacup), `lidLift` (Lid Lifter), `tamp` (Tamp Down, Press Flat). Each special is still a named, reusable, tested part.
- **Mods, not forks.** Tiers, Quirks, Tinker nodes and Long Siege boons are `ModOp`s: `{select, path, op: "add" | "mul" | "set" | "addTrigger", value}` on a whitelist of paths. The content compiler applies them at battle start and freezes the resolved hand into battle state, so the hash and the replay carry the exact numbers used.
- **Rules of the road.** A new shot that fits existing parts is JSON only, plus one golden clip replay. A new part is a sim change with unit tests, a property test entry and an Almanac clip. CI fails if a sim file names a content id.

### 3.6 Content schema example: three shells and one level

```json
{
  "id": "sh_rubber_radish", "kind": "trick", "tag": "ground", "family": "bouncer",
  "weight": "M", "rarity": "common", "damageType": "blast", "skillFactor": 1,
  "flight": { "model": "bounce", "touches": 6, "keep": 0.8,
              "base": { "model": "ballistic", "speedScale": 1, "gravityScale": 1, "windFactor": 1, "radius": 4 } },
  "triggers": [
    { "on": "bounce", "do": [ { "op": "explode", "dmg": 14, "type": "blast", "band": "tiny", "carve": 1 } ] },
    { "on": "rest",   "once": true, "do": [ { "op": "explode", "dmg": 30, "type": "blast", "band": "small", "carve": 1 } ] }
  ],
  "ui": { "icon": "shells/rubber_radish", "colour": "blast", "cardKey": "shot.sh_rubber_radish.card", "launchSfx": "launch/ground" }
}
```

```json
{
  "id": "sh_nosy_goose", "kind": "trick", "tag": "guided", "family": "guided",
  "weight": "M", "rarity": "common", "damageType": "blast", "skillFactor": 0.5,
  "flight": { "model": "guided", "bendDeg": 25, "from": 0.67, "targets": ["revealedHob", "kettle"],
              "base": { "model": "ballistic", "speedScale": 1, "gravityScale": 1, "windFactor": 1, "radius": 5 } },
  "triggers": [
    { "on": "impact", "do": [ { "op": "explode", "dmg": 48, "type": "blast", "band": "small", "carve": 1 } ] }
  ],
  "ui": { "icon": "shells/nosy_goose", "colour": "blast", "cardKey": "shot.sh_nosy_goose.card", "launchSfx": "launch/guided" }
}
```

```json
{
  "id": "sh_hot_potato", "kind": "trick", "tag": "lob", "family": "timed",
  "weight": "M", "rarity": "uncommon", "damageType": "blast", "skillFactor": 1,
  "flight": { "model": "ballistic", "speedScale": 1, "gravityScale": 1, "windFactor": 1, "radius": 5 },
  "triggers": [
    { "on": "rest", "once": true, "do": [ { "op": "spawnProp", "prop": "pr_hot_potato" } ] }
  ],
  "ui": { "icon": "shells/hot_potato", "colour": "blast", "cardKey": "shot.sh_hot_potato.card", "launchSfx": "launch/lob" }
}
```

```json
{
  "id": "pr_hot_potato", "kind": "trick", "tag": "any", "weight": "L", "skillFactor": 1, "hidden": true,
  "flight": { "model": "prop", "hp": 20, "shove": true, "attach": "ground" },
  "triggers": [
    { "on": "turnStart", "n": 1, "if": [ { "turnOf": "owner" } ], "do": [ { "op": "explode", "dmg": 85, "type": "blast", "band": "large", "carve": 1 } ] },
    { "on": "destroyed", "do": [ { "op": "explode", "dmg": 85, "type": "blast", "band": "large", "carve": 1 } ] }
  ]
}
```

The shove rule (1 cell per point of damage, up to 80) is a property of `prop` with `shove: true`, so Hot Potato, Tick-Tock Crock and Lodestone Lump share it. Dinner Gong's "timers in the ring go off now" sends a `destroyed`-style early fire through the same trigger.

```json
{
  "id": "l_1_09", "nameKey": "level.l_1_09.name", "size": "M", "width": 2400, "height": 720,
  "terrain": { "mask": "levels/l_1_09.png", "palette": { "#7a5a3a": "loam", "#8a8a8a": "rock", "#3a6aa0": "water", "#000000": "bedrock" } },
  "pads": [ { "x": 120, "y": 360, "w": 160 }, { "x": 1700, "y": 300, "w": 200 } ],
  "mission": { "type": "DC", "params": { "cart": { "w": 2, "h": 2, "hp": 150, "start": [1110, 410], "stepPerRound": 80, "gateX": 420 }, "rivalTargetsCart": 0.6 } },
  "roundCap": 10, "firstTurn": 0,
  "weather": { "tag": "breeze", "windMin": 0, "windMax": 2, "frontRounds": 3 },
  "hazards": [
    { "kind": "tumblestone", "at": [1150, 300] },
    { "kind": "springyHedge", "at": [1560, 350] }
  ],
  "objects": [ { "kind": "barn", "at": [400, 380] } ],
  "rival": { "id": "rv_posy_rakewell", "blueprint": "bp_pancake_timber_cobble_roof",
             "crew": ["hob_hedge_snipper", "hob_hedge_snipper", "hob_rake_hand", "hob_mower_minder"],
             "personality": ["bully", "tidy"], "aim": 2 },
  "rummage": { "pool": 6, "picks": 3, "mustInclude": ["earth", "shield"] },
  "pennants": [ { "type": "win" }, { "type": "cartHpOver", "value": 50 }, { "type": "winBeforeCartHome" } ],
  "checks": { "lump": ["hillBetween", "water"], "reachPowerMax": 85, "botBand": "r1_late" },
  "goldens": [ "goldens/l_1_09_a.cpr", "goldens/l_1_09_b.cpr", "goldens/l_1_09_c.cpr" ]
}
```

---

## 4. Performance

### 4.1 Budget per system (2 GB, 2019-class Android, WebView, `@1x` tier)

| System | When it runs | Cost on low-end `[est]` | Budget | Memory |
|---|---|---|---|---|
| Sim tick, quiet flight (1 to 3 actors) | Every 8.3 ms in resolve | 5 to 20 µs | 2 ms | none extra |
| Sim tick, busy (12 actors, 3 zones) | Same | 0.1 ms | 2 ms | actor pool, 64 slots |
| Huge blast tick (carve, damage, settle, collapse) | Once per blast | 1 to 2 ms | 2 ms | dirty rects |
| Terrain grid | Always | none | | 1.7 MB (M), 2.3 MB (L) |
| Coat grid (half res) | Always | none | | 0.43 to 0.58 MB |
| Terrain chunk redraw (256 x 256, material to RGBA plus edge pass) | After a carve | 1 to 2 ms per chunk | 4 ms per frame; spread 2 chunks per frame behind the blast flash | 30 to 40 chunk textures: 7.7 to 10 MB GPU at cell res; 1.9 to 2.5 MB at half res on the lowest tier |
| Fluid pour (60 units) | Once per pour | 1 to 3 ms | 4 ms | temp mask 1.7 MB, reused |
| Tide or Water Line move | Turn edge | about 1 ms plus chunk redraws | 4 ms | |
| Support solve and cascade | End of tick after block loss | under 0.5 ms | 1 ms | none |
| Falling chunks (sim) | During resolve | under 10 µs per tick | | |
| Debris and shards (view) | After falls | 0.5 to 1.5 ms per frame | 120 sprites low tier, 300 high | pooled |
| Particles (view) | Always | 1 to 2 ms per frame | 200 low tier | pooled |
| Turn-edge ticks (statuses, zones, coats, hazards, rig) | Turn edge | under 2 ms | 4 ms | |
| Walk preview | On drag change | under 1 ms | 2 ms | |
| Trajectory preview | On aim change only | 0.3 ms (360 steps) | 2 ms | |
| AI search (worker) | AI turn | see 4.2: 75 to 300 ms | inside the 0.8 s pose | COW tiles, up to 1 MB |
| Turn hash (tile cache) | Turn end | under 1 ms | 2 ms | 1 hash per tile |
| Battle save (log plus snapshot) | Turn start | 5 to 15 ms off the frame path | 30 ms | 10 to 40 KB |
| Resume (snapshot) / (full log) | Launch | 50 ms / 0.3 s | 1.5 s | |
| Draw calls | Every frame | | under 60 | atlases 2048 px pages |
| Textures loaded | Per world | | 3 atlas pages at `@1x` on low tier | 48 MB GPU max; try ETC2 on WebGL2 |
| JS heap in a match | | | under 120 MB [R04 §14] | content JSON about 1 to 2 MB |

### 4.2 AI think budget math

Assumptions `[est]`: one actor-step with DDA sweep, castle box test and trigger checks costs about 0.15 µs on a desktop core, about 0.5 µs on a mid phone, about 1.5 µs on the 2019 low-end phone in a WebView worker. An average candidate sim costs about 600 work units (a lob is about 360; clusters and rollers run 1k to 3k; beams about 50).

**Budget per preset (fixed, device independent):**

| Preset | Sims in D04 §6.13 | Work units (sims x 600) | Low-end time | Mid phone time | CI core time |
|---|---|---|---|---|---|
| Cozy | 80 | 48k | 72 ms | 24 ms | 7 ms |
| Fair | 160 | 96k | 144 ms | 48 ms | 14 ms |
| Stubborn | 240 | 144k | 216 ms | 72 ms | 22 ms |
| Ironclad | 320 | 192k | 288 ms | 96 ms | 29 ms |

Add fixed overhead per turn: knowledge view and believed world about 2 ms, closed-form solves about 1 ms, 8 support solves (1.6k units), draft and Doodad scoring under 5 ms. Total Ironclad on the low-end phone is about 300 to 350 ms.

**How Fair spends 160 sims:**

| Stage | Count | Notes |
|---|---|---|
| Candidate pairs | 4 Hobs x about 3 usable shots = 12 | Plain, Knack, about 1 to 2 Trick Shells each |
| Aim points | about 8 | Revealed or last-known Nooks, Kettle Room, 2 weak structure points, ground under Stompers |
| Closed-form solves | 12 x 8 x 8 flight times = about 770 | 1 µs each; no sim |
| Ranked by quick estimate, simulated | 112 | Most likely first [D04 §6.11] |
| Jitter re-runs on top 8 | 24 | 3 samples each [D04 §6.13] |
| Local refine on the pick | 24 | plus or minus 1 degree, 2% power |
| Full collapse checks | 8 | Counted in units, not sims |

**Verdict.** Fair and Cozy meet D04's p95 target of 150 ms on the low-end phone. Stubborn and Ironclad do not. Change the target to **p95 under 400 ms on the low-end phone for all presets**, which the 0.8 s thinking pose hides [D04 §6.11]. Do not cut the Ironclad budget to fit the old number.

**Bots.** R04 hopes for 500 matches a minute per CI core. With AI on both sides, a 24-turn match costs about 24 x 25 ms of search plus about 70 ms of resolve: about 0.7 s, so about 80 matches a minute per core. D04 §7.2 asks for 400 battles per cell; across 60 levels and 8 proxy pairs that is about 190k battles, about 40 core-hours. So: nightly runs a rotating sample of 20k (about 4 core-hours, 15 minutes on 16 cores); a weekly job runs the full sweep.

---

## 5. Test strategy

### 5.1 Layers

| Layer | What | Tool |
|---|---|---|
| Unit | Each flight model, each effect part, each status, support solver shape table (30 cases), cover ladder, walk, pour, settle | Vitest |
| Property | No NaN or infinity in state; no actor outside map plus margin; no tunnelling through 1-cell walls at max speed; pour units conserved; after settle every standing block is supported; clone then step equals step then clone (hash); snapshot round trip; save and export code round trip; every AI command passes player validation; AI choice is the same when hidden Nooks are shuffled [D04 §7.4] | fast-check |
| Golden replays | 3 per level (180), 1 clip per shot (109), 1 per boss phase (24), resume-from-snapshot equals resume-from-log | Vitest in Node; Playwright in WebKit and Firefox |
| Cross-engine | Same goldens give the same turn hashes in V8, JavaScriptCore, SpiderMonkey | Node plus Playwright browsers; real iPhone and Android weekly |
| Bot balance | Proxy players vs presets, win-rate cells, red flags from D01 §7.6, plan variety from D05 §4.4, AI metrics from D04 §7.3 | `packages/bots` |
| Content | Zod schemas, id links, Lump Rule, reach check at power 90 both wind ends, no first-turn win, hazard fairness, key coverage | content compiler |
| Visual regression | HUD in 4 layouts, pseudo-locale, German, Large text; terrain render of fixed states (frozen view clock, fixed cosmetic seed); Almanac clip key frames; collapse sequences at 3 frames each | Playwright screenshots with a small pixel tolerance |
| Perf | Stress scene frame time with CPU throttle; AI think time on goldens; resume time | Playwright nightly; device lab weekly |
| Device | Low-end Android and old iPhone smoke, flight mode, 20 app switches, 100 forced kills | Real devices per release candidate |

### 5.2 What CI runs

| Trigger | Jobs | Time target |
|---|---|---|
| Every push | tsc, Biome, banned-API lint, content compile and checks, sim unit, property tests (100 runs each), goldens in Node, save migrations, export code round trip, bot smoke (200 matches with the cheap AI budget), bundle size | under 10 min |
| Every pull request | All of the above plus Playwright boot, play one level, save, reload, offline reload; visual regression; goldens in WebKit | under 20 min |
| Nightly | Goldens in all three engines; property tests at 5,000 runs; 20k bot battles (rotating levels); red-flag report; AI think-time and frame-time with throttle; full pseudo-locale screenshot pass | under 90 min on 16 cores |
| Weekly | Full bot sweep (about 190k battles); device lab run on the 2 GB Android and the old iPhone; 100 forced-kill resume test | overnight |
| Release candidate | Store builds via fastlane, flight mode run, freeze goldens for the sim version | |

---

## 6. Build order: the first six weeks

Two engineers from week 1, a third from week 3. Each week ends with a pass or fail line. Two fails in weeks 1 to 2 send us to the Defold fallback review [R04 §16].

| Week | Build | Pass line | Fail means |
|---|---|---|---|
| 1 | Sim core (fixed step, RNG streams, trig tables, hash, event queue), terrain grid with carve, settle, COW tiles, pour. Golden runner in Node, WebKit and Firefox | 100 scripted battles of random carves and pours give the same turn hashes in all three engines. Huge carve under 0.5 ms in Node. Pour conserves units in 10k fuzz runs | Fix the banned-op gap before any feature work |
| 2 | Phaser 4 view: chunked terrain, edge pass, blast VFX, 200 particles. Capacitor build on the 2 GB Android and an old iPhone; PWA on web | 30 fps floor in the stress scene; chunk redraw plus upload at most 4 ms per frame; JS heap under 120 MB; no texture loss after 20 app switches | Drop to half-res chunks and retest; a second fail opens the Defold review |
| 3 | Castle blocks, shapes, rooms, support solver, falling chunks, Thump; view fall polish (creak, pivot, stagger, shards). Side-by-side video against a Planck mock of the same 6 scenes | All 30 shape-table cases right. Collapse under 1 ms. At least 4 of 6 playtesters rate the custom falls as good as or better than the Planck mock | Spend week 4 on feel; if still behind, allow cosmetic Planck shards on high tier only |
| 4 | Flight model zoo and parts: ballistic, bounce, roll, crawl, bore, beam, guided, steered, prop; fields; 12 sample shots in JSON only (Clodpot, Hatpin, Rubber Radish, Rolypoly, Snailbomb, Mole Mail, Sunspear, Nosy Goose, Hot Potato, Scaldspill, Lodestone Lump, Pepper Rain) | All 12 built with zero shot-specific sim code. No tunnelling in 10k fuzz shots. Preview matches flight to the cell. Steered taps replay exactly | Add the missing part and its test; if more than 2 shots need bespoke code, rework the part model |
| 5 | AI v0 in a worker: replica sim, knowledge view, closed-form seeds, work-unit budget, score, error model, bracketing | Fair p95 at most 150 ms and Ironclad p95 at most 400 ms on the 2 GB phone. Hidden-info shuffle test passes. Fair first-shot Nook hit at most 15% and third-shot about 60% over 2k shots | Cut the jitter stage first, then cheaper quick estimates; never make the budget time based |
| 6 | Save, snapshot, resume, replay, export code; one full battle (two castles, 4 Hobs each, 12 shots, wind, one hazard) on all three platforms. Go or no-go | 100 of 100 forced kills resume to the same hash. Resume from log of a 15-round battle under 1.5 s on the low-end phone. Export code round trips 1k fuzzed saves. Team plays 20 battles and 15 rate collapse and aim "fun" | No-go items go to the M1 plan with owners; the stack stays unless weeks 1 or 2 failed |

---

## 7. Effort estimate and team

### 7.1 Engineering by system (engineer-weeks)

| Area | Full design | Launch scope | Launch cuts |
|---|---|---|---|
| Sim core, state, COW, hash, replay, snapshot | 6 | 6 | |
| Terrain grid, fluids, loose bodies, render | 10 | 9 | |
| Flight models, fields, parts library | 12 | 11 | |
| Castle model, support, walk, rooms, cover | 6 | 6 | |
| Crew, statuses, damage, fall ladder | 4 | 4 | |
| Shot content and tests (109 vs about 89) | 8 | 6 | 19 side-mode shells later [D01 §7.7] |
| Props, coats, zones, combos | 4 | 4 | |
| Doodads (19 vs 10) | 2 | 1 | Side-Rival Doodads later |
| Turn manager, Rummage, 10 mission types, scoring | 5 | 5 | |
| Hazards (23 vs about 16) | 5 | 4 | Ironclad twists later |
| Boss rigs, 8 fights, 7 mini-bosses, 8 events | 8 | 7 | Fewer mini-bosses |
| AI and draft and personalities | 8 | 8 | |
| Save, migration, export, settings | 3 | 3 | |
| Workshop, Blueprints, Test Yard, decor | 5 | 4 | Fewer decor kinds |
| Map, Tinker Tree, Training, economy, collections | 5 | 4 | Mastery and Deeds later |
| HUD, aim, camera, input (touch, mouse, keys, pad) | 6 | 5 | Gamepad "works, not promised" |
| Screens, i18n, accessibility, screen reader mirror | 6 | 4 | Screen reader mirror later |
| View polish: VFX, juice, debris, anim hookup, audio director, stems, haptics | 7 | 6 | |
| Platform: Capacitor, PWA, offline, purchases, store builds | 4 | 4 | |
| Tools: level import, preview, content checks | 5 | 4 | |
| Bots, CI, perf rigs, device lab | 4 | 4 | |
| Modes: Daily, Trials, Skirmish (launch); Long Siege, Baron Rush, Raid Rehearsal, Ironclad (full) | 7 | 3 | Long Siege, Baron Rush, Raid Rehearsal after launch |
| Beta fixes, perf, launch | 12 | 10 | |
| **Subtotal** | **143** | **119** | |
| Contingency 12% | 17 | 14 | |
| **Total** | **about 160** | **about 133** | |

Launch scope keeps all six regions, all 60 levels, all 28 Hobs, 53 campaign and Shell Set shells, 6 Grand Forts, Daily Dust-up and Test Yard (the core says never cut those two [00 §10.3]). If more must go, cut region 6 to 5 as the core allows: that saves about 8 engineer-weeks and a lot of content time.

R04 planned 64 engineer-weeks. The gap is scope, not stack.

### 7.2 Team shape

| Role | Count | Focus |
|---|---|---|
| Sim and physics lead | 1 | Core, terrain, castle, determinism, perf |
| Gameplay and AI engineer | 1 | Parts library, AI, bots, boss rigs |
| Client engineer | 1 | Phaser view, HUD, input, camera, platform, PWA |
| Tools and content engineer | 1 from week 10 | Level pipeline, content compiler, Workshop, CI checks |
| Game designer (systems) | 1 | Shots, crew, balance from bot reports |
| Level designer | 1 from week 6, 2 in alpha | 124 hand-made maps is the biggest content risk |
| Artists | 2 (1 character and animation, 1 world and VFX) | 56 Hob and Flattener rigs, 6 biomes |
| Audio | contract | |
| QA | contract from alpha | Device matrix, resume tests |

**Calendar.** Launch scope at about 3.5 engineers on average: about 38 weeks of build plus 4 to 6 weeks of store and launch work, about 10 to 11 months. Full design: about 12 to 13 months with 4 engineers.

---

## 8. Items for a ruling

1. **Support rule wording [00 §2.7].** Does a block on top of a side-supported block count as "support below" (so its own side reach restarts at 0)? Recommend: no. Reach is inherited, so a balcony on a balcony does not reset the count. Ship a picture table of 30 shapes with the answer.
2. **Tick rate.** R03 says 120 Hz shells and 60 Hz bodies; R04 says 60 Hz. With no rigid bodies, use one 120 Hz clock. D04 §6.11 already assumes 120 Hz.
3. **AI think target.** Change D04 §7.3 from p95 150 ms to p95 400 ms on the low-end phone (section 4.2).
4. **Bot throughput.** Replace R04's 500 matches a minute with about 80, and run the full D04 §7.2 sweep weekly, not nightly.
5. **Resume after an update.** Do not ship old sim versions (D07 §8.4). Resume from the snapshot under new rules.
6. **Hash cadence.** Hash at turn end with a tile cache, not every 600 ticks (R04 §7).
7. **Steered shots and crash.** If a crash comes mid-flight of a Steered shot, restore the Plan step of that turn instead of replaying a partial steer log.
8. **Fort gap.** 00 §2.1 allows 1800 cells; D05 §4.8 caps duels at 1400. Recommend D05's cap.
9. **Save code length.** D07 §8.6 says 3k to 6k characters; that needs binary-packed Blueprints. Accept up to 8k as the hard cap.
10. **Brag Clip format.** Ship replay files (tiny, offline). Video capture is a post-launch native feature.
11. **Shot count at launch.** Ship 53 campaign and Shell Set shells, add the 19 side-mode shells with Long Siege and Baron Rush.

---

## 9. Bottom line

The stack fits. Build the sim first and keep it pure, rule out Planck in the sim, spend real effort on how falls look in the view, and budget the AI in work units. Plan for about 133 engineer-weeks at launch scope with a team of 3 to 4 engineers, not the 64 in the stack doc. The first six weeks above tell us early if any of that is wrong.
