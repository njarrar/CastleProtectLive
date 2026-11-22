# 02b. Castle Clashers deep dive (now "Castle Busters")

Scope: the one game the owner pointed at, Google Play id `com.epicoro.castleclashers`.
The general teardown lives in `02-reference-gameplay-teardown.md`. This file covers only this game.

Tags used below:
- **[V]** verified. We read it on the live store page, the official site or patch notes, or saw it in the store screenshots, or two or more independent sources agree.
- **[U]** unverified: one weak source (mod APK sites, SEO guide farms), or sources disagree.

Second pass, 22 Nov 2026: we loaded the live Play and App Store pages and the official site in headless Chromium, saved the store gallery, read about 60 Play reviews and 4 App Store reviews, and played two browser games in the same style. Many first pass [U] claims are now [V].

---

## 1. What we played

**We did not play Castle Busters itself.** It runs only on iOS, Android and Google Play Games for PC. No web build exists, and this machine has no KVM, so no Android emulator. Two sites that claim "play Castle Busters in browser" (castlebusters.org, brush-jjaemu.org) are unofficial SEO pages and we skipped them.

What we did instead:

| What | How | Result |
|---|---|---|
| Castle Busters store pages | Playwright Chromium on play.google.com and apps.apple.com | Full text, ratings, 60+ reviews, 10 gallery images (5 unique, saved) |
| Official site and 3 patch posts | Playwright on castlebusters.com | Rules, unit stats, rarity table, chest drop rates |
| **Castle Siege Artillery** (itch.io, npstudiogames) | Played in headless Chromium. Keyboard and slider input, a small ranging bot that read the shot log | Played levels 1, 2, 3. Won 1 (once with 3 stars on the first shot, once in 14 turns) and won 2 in 14 turns. Ran out of turns on level 3 while my own keep was half eroded. Opened the Upgrades screen. |
| **Archery Bastions: Castle War** (Y8) | Played in headless Chromium with mouse drag aim | 4 sessions, about 30 volleys. Cut the enemy squad 15 to 9 to 4. Never finished the level: the last 4 archers sat on a tall tower that our flat shots could not reach. |
| Castel Wars: Middle Ages (CrazyGames) | Loaded only | Real time pixel shooter, not turn based artillery. Not played further. |
| YouTube | Search results page loaded (titles, lengths, views). Watch pages hit a Google captcha. | 20 video titles, no transcripts |

Why these two games: Castle Siege Artillery is a turn based castle vs castle artillery duel with destructible stone and terrain, cannons mounted in the keep, and an offline campaign. That is the closest web match to the Castle Busters battle and to our brief. Archery Bastions puts a squad of units on top of each castle and fires them as a volley with drag aim. That is the closest web match to the Castle Busters "units inside the castle" idea.

### Screenshots (kept in the private archive)

| File | What it shows |
|---|---|
| store-01-versus-lava.png | Castle Busters: two wheeled castles, trophies, enemy unit levels and gadget counters on the right |
| store-02-hit-round-counter.png | A hit for -70, "ROUND 3/24", castle percent at the top corners |
| store-03-castle-builder.png | Castle editor: wood cost per new block slot (100, then 1,000), tabs Building, Upgrading, Foundations, gold 9,923, wood 7,617, gems 4,510 |
| store-04-aim-cutaway-bonus-ring.png | Your castle drawn as a dark cutaway with units on ledges. Dotted aim line. A green "+1" ring floating in mid air. |
| store-05-wheels-cave.png | Hit for -8 on the enemy castle, "ROUND 2/28" |
| play-csa-01-briefing.png | Castle Siege Artillery level brief: wind, range, terrain, enemy strength, 3 star goals |
| play-csa-02-own-castle-eroded.png | Our keep half eaten by enemy fire after 14 turns, with the angle and power panel |
| play-csa-03-upgrades.png | Upgrades: more cannons, explosives tier, fortification tier, free refunds |
| play-csa-04-victory.png | Victory screen with 3 star goals and gold breakdown |
| play-ab-01-drag-aim.png | Archery Bastions: drag tutorial hand, 6 vs 15 counters, bomb power up |
| play-ab-02-enemy-tower-hit.png | The enemy tower with red archers, our volley landing |
| play-ab-03-menu-ad-upgrades.png | Main menu: Team, Power, Castle upgrades all gated by watching an ad |

---

## 2. Identity card (read from live stores, 22 Nov 2026)

| Field | Value | Trust |
|---|---|---|
| Current name | **Castle Busters** (launched as "Castle Clashers!") | [V] |
| Subtitle (iOS) | "Smash & Brawl: 1v1 PvP Arena" | [V] |
| Package id | com.epicoro.castleclashers; iOS id 6746328263 | [V] |
| Publisher | VOODOO. Copyright line "© 2026 EpiCoro", site footer "Epicoro Games". EpiCoro is the studio, Voodoo publishes. | [V] |
| Released on Play | 18 Jul 2025 (soft launch earlier, May 2025 per AppMagic) | [V] |
| Latest version | 1.22.1, updated 20 Nov 2026 | [V] |
| Platforms | Android 8+, iOS 15+, Windows via Google Play Games. No Steam, no web. | [V] |
| Size | 676 MB on iOS | [V] |
| Play rating | **3.4 stars, 231K reviews, 10M+ downloads**, #9 top free action | [V] |
| App Store rating | **4.6 stars, 119K ratings**, #6 Strategy, age 9+ | [V] |
| Play content rating | Teen (violence, blood), "In-Game Purchases (Includes Random Items)" | [V] |
| IAP price range | $0.99 to $99.99 per item | [V] |
| Online | "A network connection is required." | [V] |
| Store tags | Action, Shooter, Artillery shooter, Competitive multiplayer, Stylized, Destruction | [V] |
| Revenue | Over $14.8M IAP by mid 2026; about $4M a month in April 2026; 72% of the mobile artillery niche that month | [V] AppMagic, Gamigion |
| Support | castlebusters-support@voodoo.io, Discord, TikTok | [V] |

Note the 1.2 star gap between iOS (4.6) and Android (3.4). Android reviews are far angrier about ads and the October to November 2026 economy changes.

---

## 3. Core loop

**Battle loop (about 5 minutes):**
1. Before the fight, set your squad (up to 8 units) and place each unit in a room of your castle. [V]
2. Both castles sit on wheels or tracks on mostly flat ground, side by side. [V] screenshots, App Store review
3. On your turn, pick one living unit, drag to set angle and power, release. The dotted aim line shows the first part of the arc. [V] store text "your rival gets the next one", store-04
4. Shots knock out blocks. Floors fall. Units that lose cover take hits. [V]
5. Floating green "+1" rings in the air give a bonus when a shot passes through them. Reviews call them "boosters you should hit each round" and "bonus targets". [V] store-04 plus 2 reviews
6. You may roll the castle to change range. Wheels have speed and fuel. A 1.20 fix mentions "a crash when fuel ran out during battle". [V]
7. You may fire a helper gadget. The HUD shows two gadget slots, each "0/1" or "1/1". [V] screenshots
8. Win by killing every enemy unit or turning the castle to rubble. At the round cap (seen as 24 and 28 in screenshots), more castle left wins. [V]

**Meta loop (days):**
1. Win to earn trophies, gold, wood, cards and chests. Climb "Trophy Road" through numbered arenas. [V]
2. Wood buys castle block slots and foundations; gold and cards level units. [V]
3. Unit levels feed the Forge (pass), which raises Castle Level. Castle Level caps block count and material tier. [V]
4. Ranked mode unlocks later. From 1.20 the "Colosseum" is a seasonal ladder for Arena 26+, with Bronze, Silver, Gold leagues. [V]
5. Seasons with a Battle Pass and a pass exclusive hero (Season 6 is "Light the Fuse"). Weekend tournaments (Treasure Hunt, Druid's Trial). Daily and weekly quests. [V]

---

## 4. Controls

- **Aim:** tap a unit in your castle cutaway, drag to set direction and power, release. [V] store-04, site text
- **Aim help:** a dotted line covers the first stretch of the arc. Patch 1.16 says "the aim line now has a little more room to turn green", so the line turns green when the angle is good. [V]
- **Your castle is a cutaway:** you see your own units on dark ledges inside. You see the enemy castle as a solid shell. [V] store-04, store-05
- **Placement:** drag units to rooms before battle. Since 1.16 some heroes care about neighbors, row or column. [V]
- **Known pain:** one review says tapping one shooter selects another and fires the wrong way. [V] single review, but a direct report

---

## 5. Turn model (now settled)

**Alternating turns, one shot per turn, with a turn clock.** [V]

- Play text: "Turn-based 1v1 PvP ... Make every shot count because your rival gets the next one." App Store: "a turn-based online PvP battle game."
- The official site still says "real time 1v1". That is old copy.
- The round counter counts both players' shots. One reviewer: "I've taken out players in 11 rounds, which is only 5 or 6 turns." So "ROUND 3/24" means each side gets 12 shots.
- A clock exists: a review says "I lost due to inactivity ... and it wasn't even my turn." The exact seconds are still [U] (one mod site says 30).
- The cap moved over time: 18 rounds at first, then 24, and 28 seen in a screenshot. After the November 2026 damage cuts one reviewer says matches take "nearly 28 rounds". [V]
- Opponents: many reviews say most fights are against bots ("you only ever play against AI", "every castle you face is a bot"). [V] repeated theme

For Castle Protect this is good news. The proven rhythm is turn based, one shot at a time, with a round cap. All of it works offline against AI.

---

## 6. Castle structure and how it breaks

- **Grid of blocks** on a wooden base with wheels or tracks. Towers have pointed roofs. [V] store-03
- **Building:** the editor shows empty slots around the castle, each with a wood price. Near slots cost 100 wood, outer ones 1,000. Tabs: Building, Upgrading, Foundations. [V] store-03
- **Castle Level** sets how many blocks you may place and how high materials go. [V] official post
- **Materials:** a tier ladder; players mention "fully blue walls", "glowing all red" max castles and "max lava bases". The fan path is wood, stone, up to diamond and magma. [V] tier ladder, [U] exact names
- **Size cap:** "after a certain point every castle will be the same height and width". [V] App Store review
- **Collapse:** blocks that lose support fall; a unit on a lost floor drops. Webley's web makes walls hold in the air until she dies. [V]
- **Weak point:** on flat ground side by side, "the only winning strategy is to bore through the bottom of the opponent's castle". [V] App Store review. The ad showed tall castles with a mountain between them; the real game does not. [V]
- **Hidden units:** you cannot see enemy units inside the shell. Reviews: "you have to use most of your turns trying to find the spider." Poison and lasers reveal or reach them. [V]

---

## 7. Units and roles

30+ units. Each has one projectile type. Rarity: Common, Rare, Epic, Legendary. Max level 50 (was 100). Starting level by rarity: Common 1, Rare 5, Epic 10, Legendary 25. [V] official post

Stats per unit (from the November 2026 balance post): **HP, Projectile damage (vs units), Projectile destruction (vs blocks), Accuracy, number of projectiles, bomb interval, castle base damage**. This split between "damage" and "destruction" is the key design lever. [V]

Known units and what they do (names are theirs; we will not reuse any):

| Unit | Shot | Role | Trust |
|---|---|---|---|
| Bomber | Several bombs, wide blast, 70% accuracy | Base breaker, top pick in every tier list | [V] |
| Wrecker | One big bomb; HP 120, dmg 70, destruction 150 | Demolisher | [V] |
| Bishop (premium) | Bomb with delayed blast | Demolisher | [V] |
| Fairy (premium) | Orbs from above | Top down | [V] |
| Pulsar, Laser Man (premium), SunRay | Beams | Snipers, reach units inside | [V] |
| Saxton | 3 boomerangs that return | Multi hit | [V] |
| Air Striker | Shot plus air strike bomb; poison gas reveals hidden units' HP | Scout | [V] |
| Napalmer | Fire bombs dropped along the path (0.22 s interval) | Area | [V] |
| Infector | 4 blasts | Area | [V] |
| Robot | 10 projectiles, low per hit | Spray | [V] |
| Joker | 2 to 9 projectiles, 15% chance of 18 | Gamble | [V] |
| Burrower | Digs; damage cut from 90 to 25 | Underminer | [V] |
| Graviter, Spike, Crow, Scout, Ice Blaster, Breacher, Mummy, Pyro (premium) | Various | Mixed | [V] names, [U] details |
| Sir Rally (free, Arena 7) | Buffs damage of allies next to him | Position support | [V] |
| Leif (free, Arena 25) | On a kill, revives every fallen ally in his row | Position support | [V] |
| Wolfie (Battle Pass) | Transforms and hits harder when a neighbor dies | Position bruiser | [V] |
| Webley (Battle Pass, 1.20) | Webs reinforce every wall in her column; walls fall when she dies | Builder, defense | [V] |
| Fuse (Season 6 pass) | Gets stronger the more damage your castle takes | Comeback | [V] |

The pattern since mid 2026: each season adds a pass exclusive hero with a rule changing ability. Players see each one as pay to win (Webley "pretty much makes the game pay to play", "if you have Fuse or Mummy you are at too much disadvantage"). [V]

---

## 8. Weapons

There is no weapon shop. **The unit is the weapon.** Shot families we can see:
lob bomb, cluster, delayed bomb, top drop, beam, boomerang, gas cloud, fire trail, spray, random count, digger.

Gadgets ("helpers") fill two HUD slots per fight: shield, cannon style gadgets in the screenshots; fan wiki lists heal, ice cannon, portal maker, shield, adrenaline shot, anti missile. [V] two slots, [U] full list

---

## 9. Upgrades and economy

| Currency | Used for | Trust |
|---|---|---|
| Gold (coins) | Unit levels and some castle upgrades | [V] |
| Wood (logs) | Castle block slots, foundations | [V] |
| Gems | Skip timers, buy offers | [V] |
| Unit cards (4 rarities) | Unit levels | [V] |
| Wild Cards (4 rarities) | Any unit of that rarity | [V] |

- **Chests** with published odds (Bronze to Diamond and "Magical"). Legendary card odds: 0% Bronze, 3% Gold, 7% Diamond. [V] official table
- **Upgrade timers**, skippable with gems or ads. [V] reviews
- **Rewarded ads** for 2x rewards and pass steps. [V]
- **Paid ad removal lasts only 5 to 7 days; the pass 14 days.** [V] reviews
- **Loss offers:** "Every time you lose a match it offers for you to buy a boost." [V] review
- **October to November 2026 economy squeeze:** level cap halved, card counts rescaled, daily chest gold cut to about 10%, wood reward cut from 600 to 300, upgrade costs up. This caused the review crash. [V] many reviews plus official post

---

## 10. Level and world structure

- **No campaign.** Trophy Road of numbered arenas with named tiers ("IV. Élite" around Arena 18, "III. Maestro" around 21). Arena 26+ opens the Colosseum. [V]
- Arenas change the backdrop (lava, jungle, snow, crystal cave in the screenshots), not the rules. Ground is mostly flat. [V]
- Live ops: seasons, tournaments, quests, events. [V]
- One reviewer asks for more modes: a 1 minute free fire mode, a shooting range. [V]

---

## 11. Enemy and boss types

- Every foe is another castle, run by a player or, often, a bot. [V]
- **No bosses, no PvE stages, no story.** [V] absent from store text, site and all reviews

---

## 12. Difficulty curve

- Early arenas are easy and bot filled. [V]
- Mid game: matchmaking against bigger castles and higher units ("glowing all red 95% of the time"). [V]
- Late game: pass heroes and maxed castles decide fights. Some skilled free players still claim 90% win rates, so skill matters until the meta shifts. [V]
- Balance swings each season cause sharp rating drops. [V]

---

## 13. Session length

- One match: about 5 minutes; 24 to 28 rounds means 12 to 14 shots each. [V]
- Ads after every match on Android, per several reviews. [V]
- Timers and chests pull players back several times a day. [V]

---

## 14. Monetization and ads

- Interstitial ads after matches, some up to a minute, that kick players to the Play Store and sometimes restart the game. [V] multiple reviews
- Rewarded ads for 2x loot and free pass steps; a free pass step that needs an ad blocks the steps after it. [V]
- IAP: premium units, season pass, pass exclusive heroes, resource packs, gem offers, timed ad removal. $0.99 to $99.99. Random item chests. [V]

---

## 15. What is fun, what is annoying

### Fun (from reviews and store text)
1. **Every brick breaks.** People compare it to Worms and Angry Birds. [V]
2. **Two ways to win.** Kill the crew or flatten the fort, and each shot picks one. [V]
3. **Placement puzzles.** "Once you figure out the best placement for your units you can become virtually unstoppable." [V]
4. **Build your own fort and see it hold.** [V]
5. **Short, tense, turn based duels.** [V]
6. **Readable shot types** with clear stat splits. [V]
7. **Hidden units and scouting.** [V]

### Annoying (ranked by how often reviews raise it)
1. **Pay to win** pass heroes and premium units. [V]
2. **Economy squeezes and nerfs** after people paid, level cap halved. [V]
3. **Ads**: forced, long, hard to close, lost rewards, kick to store. [V]
4. **Crashes**, counted as losses; inactivity losses; wins not saved. [V]
5. **Bots** passed off as players. [V]
6. **Monotony**: flat maps, "only strategy is to bore through the bottom", same size castles late. [V]
7. **Unfair matchmaking.** [V]
8. **Castle layout cannot be changed once built; little customization.** [V]
9. **Battery drain, heat, jerky play.** [V]
10. **Online only**: "I wish it was offline capable since I travel a lot." [V]

---

## 16. Lessons from the two browser games we played

**Castle Siege Artillery (played 3 levels):**
- The **shot log** works. Each entry gives angle, power, wind, SHORT/HIT/LONG and "30 m before target" or "320 m past Watch Hill". A blind duel becomes a fun ranging puzzle, and the log turned a guess into a plan in 3 to 6 shots.
- **Landmarks** ("Green Knoll", "Old Barrow") give misses meaning.
- **Briefing card** (wind range, approx range, terrain, enemy guns and fortification, 3 star goals) sets up each level in one screen.
- **HIT is not a kill.** We scored 10 hits on level 1 before the cannon fell; you must strip stone off the gun first. Good, but a pure blind HIT gives little joy. Show the damage.
- **The enemy ranges in too.** Its craters crept toward our keep turn by turn, and by turn 14 on level 3 half our keep was gone. A visible threat clock without a timer.
- **Free refunds on upgrades** ("Respec is free") remove fear of a wrong buy.
- Weak spots: long camera pans each turn (we had to hit "Skip camera"), and slow fights when you miss the cannon.

**Archery Bastions (about 30 volleys):**
- **A squad counter** (6 vs 15) at the top is a clear, quick win state.
- **Drag aim** with a "Last: 70% 18°" readout helps you repeat a good shot.
- **A tall enemy tower** that flat shots cannot reach made the last 4 foes a wall. We never found a high arc that worked. A target you cannot reach needs a hint or a tool.
- **Upgrades behind ads** (Team, Power, Castle: "AD Upgrade") feel cheap.

---

## 17. 15 ideas Castle Protect should take, made original

Each idea is a genre mechanic, reworded and reshaped. No names, art or numbers carried over.

1. **Garrison inside the walls.** Our crew stands on ledges in rooms. The fort is armor; the crew is life. Lose all crew or all fort and you lose.
2. **Cutaway view of your own fort, solid view of theirs.** You plan around what you can see; they stay a mystery.
3. **Two stats per shot: "hurt" and "break".** Every crew type has one number against bodies and one against blocks. That split makes roles clear.
4. **The crew member is the weapon,** plus one swappable ammo charm from our tech tree.
5. **Position bonuses.** Neighbor, row and column effects: a banner bearer who boosts the pair beside it, a mason who props up its column.
6. **Fort on wheels with a fuel budget,** and real hills and mud so moving matters.
7. **Material ladder with quirks.** Thatch burns, starglass bends beams, ironbound shrugs off arrows.
8. **Floors that fall** when support goes.
9. **Hidden crew and scouting tools.** Fog over enemy rooms; flares, gas and spotter birds reveal.
10. **Sky bonus rings** that add an extra bomblet or a second shot when a shell passes through, placed by level design.
11. **Round cap with a scored finish.** About 12 shots each, then fort and crew left decide.
12. **Shot log with landmarks** and SHORT/LONG/HIT readouts, from Castle Siege Artillery, for night or fog missions where you cannot see the target.
13. **Mission briefing card** with wind, range, terrain, foe strength and 3 star goals.
14. **Free respec** of upgrades and fort layout between missions.
15. **Seasonal "rule twist" heroes, made free.** A new crew member each update whose ability changes how you build (a web spinner that holds walls, a berserker fed by your losses), earned in the campaign.

---

## 18. 10 things we must do better

1. **Fully offline, single player, honest AI.** AI foes have names and faces and say they are AI.
2. **No pay to win.** All crew and gadgets earned in play. Sell cosmetics or a one time full unlock only.
3. **No forced ads.** No ad after each match, no ad that sends you to a store, no ad gated upgrades.
4. **Never lose progress.** Autosave each turn; a crash resumes the fight.
5. **Real PvE.** Hand made missions, set piece forts, and true bosses: a walking siege tower, a fort that rebuilds itself, a flying keep.
6. **Varied ground.** Hills, ravines, bridges, water, height gaps, so "dig the base" is not the only plan. The Castle Busters ad promised this and the game did not deliver it.
7. **Rebuild any time** between fights; respec is free.
8. **Readable aim and feedback.** Clear arc start, wind shown, damage numbers, and the last shot's angle and power on screen.
9. **No timers and no surprise nerfs.** If we rebalance, refund upgrades in full and keep player levels.
10. **Pocket Tanks depth.** Dozens of shot types (bouncers, diggers, splitters, rollers, magnets, quakes) on top of crew identity, plus destructible terrain under the forts.

---

## 19. Still open (needs a phone)

1. Exact turn clock length.
2. Whether wind exists. We saw no wind gauge in any store screenshot, so probably not. [U]
3. Exact tie break at the round cap.
4. Full gadget list and numbers.

---

## 20. Sources

Read live in headless Chromium on 22 Nov 2026:
- Google Play: https://play.google.com/store/apps/details?id=com.epicoro.castleclashers&hl=en (description, ratings, 60+ reviews, gallery)
- App Store: https://apps.apple.com/us/app/castle-busters/id6746328263 (description, events, ratings, 4 long reviews)
- Official site: https://castlebusters.com/
- Progression update: https://castlebusters.com/progression-system/
- Patch notes 1.16: https://www.castlebusters.com/patch-notes-1-16/
- Patch notes 1.20: https://castlebusters.com/patch-notes-1-20/
- Hero changes (Season 6): https://castlebusters.com/hero-changes/
- YouTube search "castle busters gameplay" (titles only; watch pages hit a captcha): KSunnyTV "The Secret to Instant Wins in Castle Busters" (122K views), Deck Destroyer YT "Wolfie strategy" and "AIR STRIKER God of Castle Busters", EXPLORE THE GAMES "Arena 20" (50 min), BadSadKarma "NEW HERO FUSE! First Look", Techzamazing "Walkthrough Part 1"

Games played:
- Castle Siege Artillery: https://npstudiogames.itch.io/castle-wars
- Archery Bastions: Castle War: https://www.y8.com/games/archery_bastions_castle_war
- Castel Wars: Middle Ages (loaded only): https://www.crazygames.com/game/castle-wars-middle-ages

Read through search results only (first pass):
- AppMagic: https://appmagic.rocks/blog/voodoo-new-big-three
- Gamigion: https://www.gamigion.com/castle-busters-a-new-game-changer-in-the-artillery-shooter-market/
- Friendly GameDev: https://friendlygamedev.com/game-reviews/castle-busters/
- Fan guides: https://atcampfire.xyz/castle-busters/ , https://castlebustersguide.com/ , https://www.treyexgaming.com/castle-busters-tier-list/ , https://grindnstrat.com/castle-busters-tier-list/
- Sentiment: https://gametrending.com/games/castle-busters/ , https://marlvel.ai/intel-report/games/castle-clashers , https://iphoneappsarena.com/castle-busters/
- Low trust, only for [U] claims: modplays.com, modded-1.com, oyunclubnet.com (mod APK sites)
