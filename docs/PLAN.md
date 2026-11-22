# Castle Protect: Master Plan

Status: **draft for owner approval.** No game code exists yet. Nothing gets built until the owner says go.

This file is the summary. The detail lives in the docs it links. Where this file and a design doc differ, the design doc wins, and `docs/design/00-core-game-design.md` "Canonical numbers" wins over all.

---

## 1. The pitch

**Castle Protect: The Unflattening** is a turn-based artillery game where your crew lives inside a walking fort you built yourself. Every shot breaks wood, stone and ground in a way you can read and plan. You win by bonking the whole enemy crew or by popping the steam kettle at the heart of their fort. It is single player with a two-player mode on one device, works fully offline, is completely free, and has a hand-made campaign, a real tech tree, and no ads, timers, energy or paid power.

Platforms: native iOS (iPhone and iPad), native Android, and web, all on one shared rules core.

### Why this can be the best in its class

Research (section 9) found an empty spot in the market. Nobody sells a deep, offline, single-player castle artillery game with a real campaign.

| Game | What it does well | What it lacks, that we bring |
|---|---|---|
| Pocket Tanks | Deep weapon list, weapon draft, 20+ years of fans | No campaign, no castle, nothing to earn, no aim line, and a CPU that beat us at level 2 of 7 every match by burying our tank |
| Castle Busters (once Castle Clashers) | Crew inside a breakable castle, 10M+ downloads | Online only, no campaign or bosses, pay to win, ads and timers. Its ratings crashed after an update cut players' progress |
| Tank Stars | Polish, campaign path, health bars | Ads after every fight, paid power |
| Worms | Chaos and charm | Slow turns, complex, mostly multiplayer |

---

## 2. The world

**Brickabrac** is a lumpy patchwork land. Small, stubborn folk called **Hobs** each claim a hill and build walking forts from whatever they can stack. Every fort runs on a **Heartkettle**, a big steam kettle that drives its clockwork legs, the **Stompers**.

The villains, the **Flatteners** under **Baron Levelwell**, want to roll the world flat, because flat is tidy (and because he once spilled his tea on a hill). The player fights to keep Brickabrac lumpy. Every region you win back gets its hills back. This turns the genre's worst habit, flat boring maps, into the story.

Tone: bloodless slapstick, safe for a nine-year-old, not babyish for a forty-year-old. A Hob at 0 HP is **Bonked** and floats off on a **Snooze Balloon**.

Art style: "patchwork storybook". Round chunky shapes, warm plum outlines, flat fill with one hard shade, stitched seams. Theme rule: Hobs are round and lumpy, Flatteners are square and level. See `docs/art/` and `docs/design/06-art-direction.md`.

---

## 3. How a battle plays

| Part | Rule |
|---|---|
| Turns | Strict alternating turns. Each turn: an optional **Walk** (costs Steam), then one **Action**. No turn timer by default |
| Aim | Press on your own fort and drag to set angle and power (a press elsewhere pans the camera). Lifting your finger does not fire; a big Fire button does. A Fine Tune pad and exact numbers are always on screen |
| Aim help | The preview shows the first 30% of the arc (45% and 60% with upgrades). Your last two shots stay on screen as a **Ghost** with impact **Pins**. **Recall** restores an old aim once |
| Wind | Holds for 3 rounds (a **Weather Front**). The next front is shown in advance, free |
| Your fort | Blocks of 5 materials on a grid, crew rooms (**Nooks**) with gun slots (**Loopholes**), a protected **Kettle Room**, and a bottom row (**Footing**) that cannot be dug, which blocks the "dig out the base" trick |
| Crew | Up to 5 **Hobs**. Each has a free **Plain Shot** and a signature **Knack** (2 uses per battle) |
| Draft | Before battle, you and the Rival take turns picking 4 **Trick Shells** from a pool of 10 (the **Rummage**). Quick Pick does it for you |
| Gadgets | 2 **Doodads** per battle |
| Collapse | Blocks with no support fall. Falling chunks crush what they land on. Collapse is the damage that grows as forts get bigger |
| Win | **Clean Sweep** (all enemy Hobs Bonked) or **Kettle Pop** (enemy Heartkettle at 0). Both bars are always on screen |
| No stalemates | At the round cap (15), the **Sudden Squall** starts: both forts crumble at once and wind grows. Any fight ends within 3 more rounds |
| Length | Most battles end by round 8 to 12, in about 4 to 6 minutes (pacing redone at real speed, about 32 s per round). If slice tests run long, the cap drops to 12 |
| End warning | "Squall in 3" shows two rounds before the cap |
| Read the fort | Hold any block to see what would fall (**Lean Lines**). Weakly held blocks shimmer. A "Drop!" callout marks the first big collapse |
| Gun slots | After a shot threads a Loophole, that slot closes to threads until the wind changes (**Loophole Flap**), so one kept aim cannot win every turn |
| Buried Hobs | **Shove Off** digs one out for 15 Steam in the Walk step, not your Action |

Fairness rules that answer the genre's top complaints:
- The AI misses like a person: a wide first shot, then short, long, hit. It only sees what you can see. No hidden catch-up cheats.
- No lost turns. No status effect skips your shot.
- Self hits do 50% and never knock out your own Hob. A buried fort always digs out.
- Before battle, a "No line" mark warns when a Hob has no clear shot on this map.
- A crash never costs a match: the game saves every turn and resumes exactly.
- You never lose what you earned. If an update weakens something, you get a full refund.

Detail: `docs/design/00-core-game-design.md` sections 2 to 3.

---

## 4. Content at launch and in updates

| | Launch 1.0 | Update 1: Long Siege | Update 2: Frostwhisker Peaks | Update 3: Clankmouth Mines | Total |
|---|---|---|---|---|---|
| Regions | 4 | | +1 | +1 | 6 |
| Campaign levels | 40 (4 boss forts) | | +10 | +10 | 60 |
| Crew classes | 7 | | +Peeper | | 8 |
| Named Hobs | 16 | +2 | +5 | +5 | 28 |
| Trick Shells | 30 (2 joke Duds) | +8 | +10 | +10 | 58 |
| Doodads | 8 | +2 | +2 | +2 | 14 |
| Materials | 4 + Footing | | | +Moonbrick | 5 + Footing |
| Tinker Tree nodes | 36 | | +12 | +12 | 60 |
| Enemy unit types | 14 | +3 | +6 | +5 | 28 |
| Maps | 59 | +14 | +11 | +11 | 95 |
| Modes | Campaign, Skirmish, Couch Duel (2 players, one device), Test Yard, Trials, Daily Dust-up | +Long Siege | +Ironclad | +Baron Rush | 9 |

All designed content is kept. Content after launch is tagged `[U1]`, `[U2]` or `[U3]` in the design docs. Updates are free.

### 4.1 The crew: 7 classes and 16 launch Hobs

| Class | Role | Plain Shot | Launch Hobs (Knack) |
|---|---|---|---|
| Lobber | Wrecks walls | Clodpot | Marge (Grand Dumpling), Old Thumper (Tick-Tock Crock), Pip (Chimney Drop) |
| Zinger | Snipes crew | Hatpin | Quill (Sunspear), Dame Flicka (Long Skewer) |
| Scatterjack | Area spread | Gravel Sneeze | Jax (Pepper Rain), Nan (Pan Parade), Fizz (Rising Fizz: bubbles that fall upward) |
| Delver | Digs under | Nibbler | Grub (Burrowbomb), Truffle (Molehill Surprise) |
| Boinker | Bounces and rolls | Bouncebean | Bobbin (Rolypoly), Skip (Skimmerstone) |
| Sizzler | Fire and water | Emberpot | Ember (Scaldspill), Brine (Drenchbarrel) |
| Patcher | Repairs and shields | Mendglob | Hetty (Barn Raising), Poultice (Bubble Bonnet) |
| Peeper `[U2]` | Scouts hidden crew | Peep Pip | Arrives in Update 2 |

New launch Passives fill roles the reference games showed we lacked. They act on the Hobs **next door** (the rooms touching this Hob's room):

| Hob | Passive | Role |
|---|---|---|
| Grub | **Broad Back:** the Hob next door behind him keeps Cover even if their wall breaks | Front tank |
| Hetty | **Ridgepole:** blocks in her column above her room cannot fall while she stands | Column holder |
| Old Thumper | **Old Grudge:** after a Hob next door is Bonked, his next Clodpot is one blast size larger | Reacts to a loss |
| Nan | **Clatter Call:** after she hits a Hob, Hobs next door deal +15% on their next shot | Buffs neighbours |

Marge's Grand Dumpling now has **Low Blow** (x1.3 to the row just above Footing), so aiming low pays off in the open. Long Skewer leaves its skewer in place, and Skimmerstone has a damage floor so it is never a dead pick on hills.

Any Hob can fire any Trick Shell. The shell's matching class fires it better (no rest and +10%). Hobs grow in 3 ranks, each rank a perk choice. Ranks never add raw power, so the game cannot drift toward pay to win. Each Hob has a personality and voice lines. Detail: `docs/design/03-crew-units.md`.

### 4.2 Weapons

- **8 Plain Shots**, one per class, always free to fire.
- **28 Knacks**, one per named Hob (16 at launch).
- **58 Trick Shells** in groups: splash, cluster, digger, roller, bouncer, guided, fire, terrain builders, gravity, timed, utility, and joke Duds (Old Turnip, Soggy Sock, Squeaky Duck). Every Dud is labeled.
- **14 Doodads** (gadgets), such as Scarecrow, Mole Mine and Kettle Lid.
- **26 named combos**, such as Tinder and Bellows (fire plus wind) and Cold Snap (frost plus falling stone).
- One balance formula scores every shot. Bots check 20 red flags each night.

The rule for every weapon: it must change the picture, and it must differ from the others by what it does, not by its numbers. Detail: `docs/design/01-weapons-and-shots.md`.

### 4.3 Enemies and bosses

- The **Flatteners** are Hobs too, in creased grey uniforms and pancake-flat caps.
- **Lieutenants and boss forts at launch:** Marshal Trimm (Topiary Keep), Dame Scree (Sanding Stair), Admiral Drainwell (Great Sump), Steward Plumb, then Baron Levelwell (The Last Level).
- **Lieutenants in the updates:** Countess Glaze (Peaks) and Ironmaster Bolt (Mines) are "the wings that got away".
- **Units and castles:** 14 enemy unit types at launch, 16 castle styles that each teach something, 7 mini-bosses and 8 level events.
- **Boss forts:** 3 phases each. A boss always warns a turn before a big attack and never heals back past a phase line.
- **Final boss:** 2 stages, the Grand Roller, then the Level Engine. You win by raising hills. You can retry from the current stage on any difficulty.
- **AI personalities:** 8 of them, including Bully, Sniper, Builder, Gambler and Coward. Each Rival states one habit you can build against.
Detail: `docs/design/04-enemies-bosses-ai.md`.

### 4.4 The campaign

| # | Region | Look | New idea taught | Boss |
|---|---|---|---|---|
| 1 | Puddingstone Downs | Grass hills, hedges, streams | Aim, crew, kettle, wind, a Knack, building, draft, walking | Topiary Keep |
| 2 | Crumblecrag | Cliffs, ledges, gorges | Height, falls, digging, bank shots, fire on wood | Sanding Stair |
| 3 | Soggybottom Fen | Marsh, ponds, mud | Water, mud, soaked, fire against water, tide | Great Sump |
| 4 | The Flats | Rolled flat land, chained hills | Raising and dropping ground, fighting machines | The Last Level |
| 5 `[U2]` | Frostwhisker Peaks | Snow, ice lakes | Strong wind, frost, ice, hidden crew, escort | Glidehall |
| 6 `[U3]` | Clankmouth Mines | Caves, rails, lava | Ceilings, shock chains, magnets, Moonbrick | Stampmill |

- **Launch mission mix:** 25 Siege, 4 Demolition, 4 Rescue, 3 Puzzle, 4 Grand Fort. Each level has 3 **Pennant** goals, the star rating.
- **Pacing:** a saw-tooth difficulty curve with breather levels, and no flat maps anywhere.
- **Onboarding:** the first five levels teach only aim, picking a Hob, the kettle, wind and one Knack. The castle builder opens at 1-6, the draft at 1-8 and the Tinker Tree at 1-10. At most 12 prompts in the first 10 minutes, each three words or fewer.
- **Couch Duel:** two players take turns on one device, each with their own fort and crew. Everything is open to both, help levels are shown openly, even Starter Box forts are ready from the first launch, and an optional Kind Clock (off by default) nudges but never fires. Win by knockout or by **Volley Points** (a fixed number of shots, highest score wins). No AI, fully offline.
- **Side modes:** Trials (puzzle challenges), Daily Dust-up (a seeded daily skirmish that works offline, with no streak pressure), Skirmish, the Test Yard sandbox. Updates add Long Siege, Ironclad and Baron Rush.

Detail: `docs/design/05-campaign-levels-maps.md`.

---

## 5. Progression and economy

| Currency | Earned by | Spent on |
|---|---|---|
| **Buttons** | Every battle, win or lose | Castle blocks, Hob ranks |
| **Pennants** | Up to 3 per level (the star rating) | The **Tinker Tree** |

- **Tinker Tree:** 4 branches (Aim, Fort, Crew, Kit) of 15 nodes each, 36 at launch. Each branch has one real fork. Beating each boss fort opens the next tier. Resets are free at any time with a full refund. Info readouts such as the wind forecast and the shot log are free, not upgrades.
- **Workshop:** a free fort editor with undo, mirror, X-ray and a test-fire range. You can save up to 5 **Blueprints**. Blocks sell back at full price.
- **No grind wall:** a script checked every level. A player who earns only 1 Pennant per level and never replays can still afford what each region needs.
- **Time to finish:** the launch campaign takes about 5 hours. All 60 levels take about 7 to 8 hours. Full completion takes 12 to 14 hours.
- **Collections:** 40 achievements (no streaks), plus cosmetics earned by play: banners, castle skins, hats and statues.

Detail: `docs/design/02-tech-tree-and-progression.md`.

---

## 6. Screens, feel and sound

- **Speed:** first launch to first shot in about 25 seconds. Later launches open on the map.
- **Portrait battle view (stacked lenses):** the target fort close at the top, a thin strip map of both forts with the last Pins in the middle, your fort and the controls at the bottom. Blocks draw at 12 to 16 pt. The camera follows the shell and holds on impact. Every turn control sits in the lowest 220 pt, so one thumb is enough.
- **Couch Duel screens:** one-screen setup with names, forts and help levels, a hand-off card between turns showing the last shot and a Ready button, a named turn banner, results and rematch. A Table mode in portrait gives each player their own half.
- **Battle screen:** the field fills 71 to 85% of the screen in landscape and about 70% in portrait, and 85 to 88% while aiming. Every button is at least 48 pt; Fire is 76 pt. Portrait and landscape both work at launch, and turning the device mid-battle keeps everything.
- **Before battle:** one screen holds the level card, crew seats, draft strip and Doodads, with "Same again" for replays. During the draft the Rival glances at the one shell it wants most.
- **Input:** every button acts on release with no minimum press time, so a quick click always works on web and desktop (a lesson from the Mac playtest).
- **After a loss:** a short slow-motion "what broke you" replay.
- **Feel:** small hit freezes, capped screen shake (none while aiming), short slow-motion moments, and haptics on every platform.
- **Accessibility:** teams differ by shape and pattern as well as colour, 3 colour sets, text sizes, reduced motion, a one-hand mode, 11 aim aids, subtitles and remappable controls. Screen readers cover the menus. Battles are not fully playable by ear at launch.
- **Saves:** saved every turn, resumed after a crash or a call, and movable between devices with an export code.
- **Audio:** one shared tune with layers that change by region, 75 sound effects and 100 voice lines in made-up Hob gibberish with subtitles at launch. About 9.7 MB at launch.
- **Languages:** English only for early versions (owner decision). Spanish, Portuguese, French, German, then Japanese, Korean and Chinese come later.

Detail: `docs/design/07-ux-ui-audio.md`.

---

> **Build of record:** the week 1 build in `BUILD-WEEK-1.md` supersedes the timeline in section 8, with the gates in `docs/review/07-external-review-decisions.md` (day 3 phone playtest on web, then scale up). Section 8 stays as the long-range plan for the full launch.

## 7. Tech plan: native apps on a shared core

Owner requirement: a native iOS app (iPhone and iPad), a native Android app, and a web app.

| Layer | Choice |
|---|---|
| Shared core | **Rust.** The rules (sim), AI, content loading, saves, export codes, the Daily seed and bots. Integer Q16.16 fixed point with table trig and no floats in the rules, so all three apps give exactly the same result. A small "presentation core" holds aim gesture maths, camera rules and collapse choreography, so the apps feel the same |
| iOS (iPhone, iPad) | **Swift, SwiftUI, Metal** battle view. The core ships as an XCFramework |
| Android | **Kotlin, Jetpack Compose, OpenGL ES 3.0** battle view. The core ships as NDK libraries through a thin JNI layer |
| Web | **TypeScript, WebGL2.** The core runs as WebAssembly (about 150 to 250 KB, estimate). Installable and offline as a PWA |
| Core to app link | A C interface of about 30 functions plus FlatBuffers. Commands go in. A packed sprite list, changed terrain chunks and events come out. Terrain chunks upload as 8-bit textures straight from core memory |
| Threads | Sim and AI on their own threads on iOS and Android. On web the sim runs on the main thread and the AI in a Worker |
| Native per platform | UI, rendering, audio (AVAudioEngine, SoundPool and ExoPlayer, Web Audio), storage, input, VoiceOver, TalkBack and ARIA |
| Collapse | Our own support check in the core. The look comes from each renderer: creak, lean, staggered drops, dust. No physics engine in the rules |
| Content | Schema-checked data files. 109 shots built from about 60 reusable parts |
| AI | Under 400 ms on a 2 GB phone |
| Saves | Local only, one shared format on every platform, two copies with checksums, export code to move between devices |
| Tests | The same recorded battles must give identical hashes on Linux, macOS, the iOS Simulator, the Android emulator, real arm64 and armv7 phones, and WebAssembly in Chromium, Firefox and WebKit. 20,000 bot battles each night |
| Release | fastlane to TestFlight and Play internal testing. The web app goes to a static host. All three ship on one content version |
| Repo | One monorepo: `core/` (Cargo), `apps/ios` (Xcode, generated by XcodeGen), `apps/android` (Gradle with cargo-ndk), `apps/web` (Vite) |
| Minimum OS (to confirm) | iOS 16, Android 8 |
| Money | None. No purchase, ad or analytics SDKs |
| Fallback | A shared Rust renderer (wgpu) under native menus, if the three native renderers miss the week 2 gate |

Scores against the other options (max 115): three fully separate native apps 69, shared Rust core 93, Kotlin Multiplatform 82, C++ core 83, Rust core plus shared renderer 80. Detail: `docs/research/04b-native-tech-stack.md`. The older Phaser plan in `04-tech-stack.md` is kept for reference only.

---

## 8. Build plan

| Phase | Done by week | Goal | Gate to pass |
|---|---|---|---|
| Risk prototype | 6 | Prove the hard parts | (1) the same battle gives identical hashes on every target; (2) terrain drawn at 60 fps by all three renderers on a 2 GB phone; (3) castle collapse, playtested against a tumbling version; (4) the core to app interface frozen, 12 shots built from data only; (5) AI under 400 ms on a 2 GB phone; (6) export codes, the Daily, quick click, portrait and landscape, VoiceOver and TalkBack on all three |
| Vertical slice | 16 | Half of Region 1 on iOS, Android and web, final art style, Couch Duel playable | 20 testers: 70% finish in one sitting, the median fight is under 5 minutes, seconds per round on target |
| Alpha | 32 | All 40 levels playable on all three | Bots clear every level with no upgrades. Under 15% of fights reach the Squall |
| Beta | 44 | Final art and audio, store builds (English only for early versions) | Crash-free rate, performance budgets and accessibility checks met |
| Launch | 48 to 54 | iOS, Android and web on the same day | Store review passed |
| Updates 1, 2, 3 | About +8, +10, +10 weeks each | Long Siege, Peaks, Mines | Same bot and balance gates |

**Team:** 6 to 7 engineers (3 on the Rust core, 1 iOS, 1 Android, 1 web, half a build and release role), 1 artist plus a contract animator, 1 designer, 1 level designer, part-time audio. About **200 engineer-weeks** for launch scope, up from 133 for the old single-codebase plan. Three separate native codebases would cost about 290. Staggering the Android launch would save about 22 engineer-weeks; we advise against it.

---

## 9. How this plan was made

| Step | What we did | Files |
|---|---|---|
| Market | 20 games compared, trends, gaps, player types | `docs/research/01-market-and-competitors.md` |
| Hands-on play | Played Tank Duel, both Pocket Tanks copies you linked, Tank Stars (web), Castle Siege Artillery and Archery Bastions in a browser, with screenshots | `docs/research/02-reference-gameplay-teardown.md`, `02b`, `02c` |
| Hands-on play on the Mac | Played Castle Busters and the official Pocket Tanks as iPad apps on the Mac mini: wins, losses, menus, shop, upgrades, 34 screenshots | `docs/research/02e-hands-on-playtest.md` (screenshots kept private) |
| Store study | Castle Busters and Pocket Tanks store pages, 20 store screenshots, about 1,600 App Store reviews sorted by theme | `docs/research/02d-appstore-iphone-study.md` |
| Code | Both linked repos read in depth, about 30 more surveyed (Hedgewars is the best reference) | `docs/research/03-code-and-tech-survey.md` |
| Tech | 7 engines compared, then 5 native architectures after the owner asked for native apps | `docs/research/04-tech-stack.md`, `04b-native-tech-stack.md` |
| Design | A lead designer, then 7 specialists, across two model families | `docs/design/00` to `07` |
| Art | 23 concept sheets drawn as SVG and checked by eye | `docs/art/` |
| Review | 3 independent reviews: consistency (89 conflicts found), fun and scope, technical | `docs/review/01` to `03` |
| Lessons pass | Two independent reviews of the Mac playtest, merged into 11 gameplay and 11 unit changes | `docs/review/06-learnings-decisions.md` |
| Fix | One rulings file, 4 editors, then a final 18-check verification | `docs/review/04-rulings.md`, `05-final-verification.md` |

### 9.1 What playing the two reference games taught us

The Mac playtest closed the last research gaps. Most of the plan holds. Ideas only: no names, numbers or content come across.

**Open questions, now answered** (02b section 19):

| Question | Answer | What it means for us |
|---|---|---|
| Turn clock | 30 s. Miss one and the next turn gets 10 s. Three misses in a row lose the match | Keeps our rule: no turn clock in single player (`00` §2.13) |
| Wind | None in Castle Busters, not even in the code. Pocket Tanks has it as an option, off by default | Keeps our rule: wind in Weather Fronts, off in 1-1 to 1-3, Cozy can turn it off |
| Tie at the round cap | Higher castle health % wins. Caps are 12 rounds in Arena 1 and 14 in Arena 2 | Our Sudden Squall gives a real ending instead of a health count. Keep it |
| Gadgets | 11 of them, each with ammo and a cooldown, locked until Forge Level 8 to 200. We never reached one in about 30 minutes of play | Decision 14 (approved): our first Doodad now comes on the 1-9 win |

**What it confirmed:**
- Pull-back aim with angle and power numbers on screen feels right. A longer aim line or one that upgrades helps. Ours already does both (`00` §2.3 and §2.4).
- "Aim low and break the base" is the fun. Collapse is the payoff. Our Footing row stops the cheap dig, and collapse damage keeps low shots worth it.
- Battles ran 4 to 7 minutes. We redid our pacing at that real speed: about 4 to 6 minutes typical (`00` §2.12).
- The ground in early arenas is hilly, not flat, and castles tilt on slopes. Our "no flat maps" rule still beats it, because hills there never change the plan.
- Weapons are pure data: one row per shot with count, gap, force, gravity, spread, damage, radius and pierce. Gravity even goes negative. This backs our "one JSON file per shell, built from reusable parts" plan (section 7). Damage per turn sits in one band of about 200 to 350 points, with a few planned outliers. Our balance formula (`01`) should use the same idea.
- A missed shot needs a clear marker. Pocket Tanks has none and it hurt. Our Ghost and Pins fix this.

**What it warns us off:**
- **Opponents you cannot read.** Our Rivals have names and faces, say they are AI, and show their difficulty settings in the open.
- **Daily caps with an ad to reset**, an ad button placed above Continue, and wait timers on upgrades. None of these belong in our game.
- **A flat first hour.** With gadgets locked, every early turn looks the same.
- **Self-hit traps.** In Pocket Tanks the CPU buried our tank and dug pits under it, and our own shots into that dirt cost us points. New rule in `00` §2.10: self hits do 50%, never Bonk your own Hob, and a buried side always digs out.
- **Mis-taps.** In Castle Busters a tap on the wrong unit card fired the wrong unit. We keep the separate Fire button by default and offer Quick Fire (release fires) as an option.
- **Mouse input.** On the Mac a quick click did nothing in either game; only a held press worked. Our week 6 prototype gate must test click, tap and keyboard on all three platforms.

The playtest added one canonical rule (self damage at 50%) and changed no other number.

---

## 10. Decisions for the owner

Each has a recommendation. Say yes or change any of them.

| # | Decision | Recommendation |
|---|---|---|
| 1 | Launch with 4 regions and 40 levels, then 3 dated free updates to 6 regions and 60 levels | **Decided.** A v0.1 with Region 1 ships first (see `BUILD-WEEK-1.md`). All 6 at launch would take 18 to 24 months |
| 2 | Price and money | **Decided.** Everything is free: every level, mode and update. No price, no purchases, no ads, nothing monetized |
| 3 | Local two-player on one device ("Couch Duel") | **Decided.** Ships at launch |
| 4 | Screen orientation | **Decided.** Portrait and landscape both at launch |
| 5 | Audio size | Full plan, 14 MB in all, about 9.7 MB at launch |
| 6 | Final art | **Decided.** Made by human artists. The concepts set the direction |
| 7 | Max camera zoom | 1.25x |
| 8 | Target players | Genre fans first, casual players second |
| 9 | Trademark search on all names | Before art production |
| 10 | Content owner | One named person holds the counts |
| 11 | Sudden Squall double pop | **Decided.** If both kettles pop at once, more total HP left wins |
| 12 | New content from the final pass | Approve 3 new Kit nodes (Snow Shovel, Swap Shop, Ore Cart) and the "Lid On" achievement |
| 13 | Next step | **Decided.** Build v0.1 in one week with parallel agents, builds on GitHub Actions (`BUILD-WEEK-1.md`) |
| 14 | First Doodad sooner | **Approved.** Winning 1-9 gives the first Doodad (Mend Bucket) and one slot, so the 1-10 boss has a gadget turn. Pot Lid and slot 2 stay at 2-1. 1-9 still teaches only Walk. The reference locks gadgets for hours and the early game feels flat (section 9.1) |
| 15 | Wind | **Decided.** Gentle wind from level 1-4, with a Wind off option |
| 16 | Native apps | **Decided.** Native iOS and Android plus web. Recommended build: shared Rust core with native Swift, Kotlin and TypeScript apps, about 200 engineer-weeks, launch at weeks 48 to 54 |
| 17 | Minimum OS and Daily | **Decided:** Daily seed keyed by date and rules version, no 14-day delay (review 07). Also: iOS 16, Android 8, no analytics at launch, a 14-day delay before a new Daily table goes live so web and store builds match |

Once you approve (with any changes), the first step is the 6-week risk prototype in section 8. Each week ends with a pass or fail result reported to you.
