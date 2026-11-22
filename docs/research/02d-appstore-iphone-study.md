# 02d. App Store (iPhone) study: Castle Busters and Pocket Tanks

Scope: the two US App Store pages the owner named. We loaded each page in Playwright Chromium, read the hidden "Information" and "Version History" panels from the page HTML, pulled the public iTunes lookup API, and pulled the customer reviews RSS feed (pages 1 to 10, sorted by "most recent" and by "most helpful", merged and de-duplicated).

Date of capture: 2026-11-22.

Markers: **[V]** seen on the store page or API on that date. **[R]** drawn from reviews (player claims, not checked). **[I]** our reading of a screenshot or our inference. **[U]** unverified or conflicting.

Data pulled:

| | Castle Busters | Pocket Tanks |
|---|---|---|
| Unique text reviews collected | 938 | 662 |
| Review date range | 2025-10-23 to 2026-11-20 | 2009-04-14 to 2026-11-14 |
| Screenshots saved | 5 iPhone + 5 iPad | 5 iPhone + 5 iPad |

Screenshots live in `screens/appstore/castle-busters/` and `screens/appstore/pocket-tanks/` (`iphone-1.jpg` to `iphone-5.jpg`, `ipad-1.jpg` to `ipad-5.jpg`, all 1280px wide, 75 to 175 KB each).

A caution on reviews: text reviews are a small slice of all ratings and lean angry. Castle Busters has 119K ratings with 82% at 5 stars, yet our 938 text reviews average 2.8. Use the counts below to rank problems, not to judge overall liking.

---

## 1. Castle Busters (id 6746328263)

### 1.1 Facts

| Item | Value | Mark |
|---|---|---|
| Subtitle | "Smash & Brawl: 1v1 PvP Arena" | [V] |
| Seller / publisher | Voodoo. Copyright line reads "© 2026 EpiCoro" (the studio). | [V] |
| Former name | "Castle Clashers!" (a Jan 2026 review still uses that name; 02b covers the rename) | [V] [R] |
| Price | Free, with IAP and ads ("Contains Advertising") | [V] |
| Rating | 4.6 from about 119K ratings (API: 4.638, 118,559) | [V] |
| Star split | 5: 82%, 4: 9%, 3: 4%, 2: 1%, 1: 4% | [V] |
| Chart | #6 in Strategy | [V] |
| Age rating | 9+ (infrequent cartoon violence, mature or suggestive themes, guns or other weapons). The description says "Suitable for players 13+". | [V] [U] |
| Size | 676.3 MB | [V] |
| Needs | iOS 15.0+, also runs on M1 Mac and Vision Pro | [V] |
| Languages | English + 10 (AR, FR, DE, IT, JA, PT, RU, zh-Hans, ES, zh-Hant) | [V] |
| Online | "A network connection is required." Game Center. | [V] |
| Current version | 1.22.1, 2026-11-19 | [V] |
| First release (API) | 2025-05-26 (likely a soft launch; US reviews start Oct 2025) | [V] [I] |
| Live events on page | Season 6 "Light the Fuse" (a hero who powers up as your castle takes damage), Colosseum Season 2 (Bronze, Silver, Gold leagues), Treasure Hunt Tournament, Druid's Trial Tournament | [V] |

Description in short [V]: turn-based online 1v1. Aim and fire with physics artillery. Blast walls to open angles and collapse towers to expose heroes. Win by killing the whole enemy crew or turning the castle to rubble. Draft a crew of heroes with abilities that combine (damage, buffs, revive). Build and fortify your castle, which sits on wheels, place heroes inside, pick gadgets. Level heroes, unlock new ones, earn rewards from "the Forge". Trophy Road arenas, then Ranked mode with leaderboards.

### 1.2 IAP economy

The store shows the top 10 IAPs only [V]:

| IAP | Price |
|---|---|
| Loss Offer | $0.99 |
| Special Offer | $2.99 |
| Event Pack | $4.99 |
| Resources Pack | $4.99 |
| Small Gem Pack | $4.99 |
| Medium Gem Pack | $9.99 |
| No RV - Weekly | $9.99 |
| Battle Pass | $14.99 |
| Forge Pass - Biweekly | $14.99 |
| Large Gem Pack | $19.99 |

What it tells us:
- Three currencies show on the build screen: gold coins, wood logs, and gems [V, screenshot 3].
- "Loss Offer" at $0.99 is a deal shown right after a defeat [I from the name].
- "No RV - Weekly" ($9.99) removes rewarded-video prompts for one week. Reviews confirm ad removal lasts only 7 days and call it greedy [R, 9 reviews say so directly].
- Two passes: a season Battle Pass and a two-week Forge Pass. One reviewer says the bi-weekly pass renewed with no clear way to cancel [R].
- Premium heroes are sold as offers. Reviewers name Laser Man, Webley (a web or spider hero), Insect Master, Poison Ivy, and Napalmer as paid and strong [R].
- Rewarded ads: watch to double match rewards or open extra chests. Reviewers split: 31 say too many ads, 29 praise ads as optional and fair [R].

### 1.3 Screenshot breakdown

The iPhone and iPad sets show the same five scenes. iPad crops show a bit more (a zoom button in iPad 5). All are landscape.

1. **"RULE THE ARENA!"** (`iphone-1.jpg`) Split-screen versus card before a match. Left: blue-roof castle; right: red-roof castle, both on tank treads, in a lava world with a skull-shaped rock. Top HUD: castle icon with health % for each side (100% / 100%), player name, avatar, and trophy count (7600 vs 7520). Blue bar left, red bar right, like a fighting game. Enemy side shows two gadget slots (a shield turret and a cannon, each "1/1") and a column of four hero cards with levels (20, 21, 20, 22). The castle is made of stone blocks braced with wooden beams. Gadgets sit at the base of the castle between the treads. [I]
2. **"DESTROY ENEMY CASTLE!"** (`iphone-2.jpg`) Jungle map with a big toad statue and waterfalls. A purple-black blast hits the enemy castle and takes a bite out of it. Floating damage number "-70" and a small HP bar with a level tag over the hit hero. Center top: "ROUND 3/24", so matches have a round cap. Gadget slots now read "0/1" (used). The ground is flat. [I]
3. **"BUILD YOUR CASTLE!"** (`iphone-3.jpg`) Desert build screen. Castle of 2x3 block cells with two spire tops. Dashed empty slots around it each show a wood cost (100 for the top row and upper sides, 1,000 for lower sides). Tabs: Building (active), Upgrading (red alert dot), Foundations (locked). Right side: four hero portraits with info buttons (an ogre, a bearded fighter, a goblin, a hooded skull). Top left: coins 9,923, wood 7,617, gems 4,510, each with a "+" buy button. Home button top right. [V for text, I for meaning]
4. **"AIM, FIRE, DESTROY!"** (`iphone-4.jpg`) Snow map. Your own castle shows as an x-ray: the walls go dark and you see inside, with heroes standing on small ledges on several floors. A white arrow marks the active hero (a red imp with a gun). A dotted aim line runs out from it, short, so it only hints the start of the arc. In the air: a green oval portal marked "+1" (a pickup or bonus shot) and a blue curved shield arc in front of the enemy castle. [I]
5. **"WAGE WAR ON WHEELS!"** (`iphone-5.jpg`) Crystal cave map. A big yellow blast hits the enemy castle (damage "-8"). Your castle on the left is dark x-ray with heroes inside and a glitch effect. A chat or emote bubble sits top left. "ROUND 2/28". iPad 5 also shows a magnifier button for zoom. [I]

Key HUD rules we read from these [I]:
- Two win paths shown at all times: castle % at the top corners and hero HP bars on hit.
- Hero roster with levels lives in a right-side column; gadgets in two slots above it.
- Own castle goes see-through on your turn so you can see and pick the shooter.
- Big bright floating damage numbers.
- No angle or power numbers on screen. Aim is drag with a dotted line, not numeric.
- Arenas change art (lava, jungle, snow, crystal cave, desert) but the ground stays mostly flat.

### 1.4 Review themes (938 reviews)

Counts come from keyword tagging of title + body, checked by reading about 160 reviews by hand. One review can hit many themes. Treat counts as rough (plus or minus 20%).

**Love**

| Theme | Count | Paraphrase |
|---|---|---|
| Fun, addictive, "my wind-down game" | ~580 mention fun/love/addictive (many inside complaints) | Easy to pick up, hard to put down; hours a day. |
| Strategy and placement | ~120 | Where you put heroes and walls matters; "build a fortress or go all offense". |
| Can win without paying (early) | ~25 | Beat spenders with free heroes; no forced spending at first. |
| Ads feel optional (some players) | 29 | Ads only for bonuses felt fair. |
| Art and destruction | many short notes | Bright cartoon look, satisfying blasts. Some call it a Pocket Tanks or Angry Birds feel. |

**Hate**

| Theme | Count | Paraphrase |
|---|---|---|
| The 1.21.0 update (Oct 28, 2026): hero level cap cut from 100 to 50, levels halved, rarities dropped (legendary to epic), damage nerfed, rewards cut, upgrade costs kept | 215 of the 495 reviews on 1.21.0 to 1.22.1 | "Months of work erased", "I paid for heroes you then nerfed", "rewards cut 80 to 90%". |
| Pay to win, premium heroes too strong | ~160 (55 name "premium" or paid heroes; 44 name Laser Man; 19 name Webley or the web hero) | Paid heroes shred walls with no aim; mid ranks need money. |
| Matchmaking unfair | ~70 | Paired with fully maxed castles or players thousands of trophies above. |
| Crashes mid-match, counts as a loss | ~87 | Crash every 3 to 5 games; lost win streaks and quest progress. |
| Phone overheats, drains battery | ~22 | Two matches and the phone is hot. |
| "PvP" opponents are bots | ~47 | Game pauses when you leave the app, so the "live" foe must be a bot; foes all play the same. |
| Too many ads / forced ads after matches | 31 (+14 say ads pop after every match even when skipped) | Unclosable ads, tiny X, no permanent ad removal. |
| Grind got slow | ~120 touch coins, wood, or slow progress | After the update, building takes far longer without paying. |
| Hero balance (free ones too) | ~120 | One free bomber hero is in "90% of lineups"; ice defense too strong; one barrel hero "invincible". |
| Lost progress or account issues | ~19 | Levels halved when switching devices; wins not counted. |
| Flat terrain, same tactic | ~37 | "Not like the ad" (tall castles, a mountain between). Fights are flat and side by side, so the one winning plan is to bore the base. |
| Max castle size | a handful | Once maxed, every castle looks the same; only wall strength upgrades remain. |
| Too loud, no volume until 3 rounds in | 12 | Had to delete it on first launch. |
| Rage quit counts as a loss for the winner | 12 | Foe exits and the winner gets nothing. |

**Requests**

| Request | Paraphrase |
|---|---|
| Undo the 1.21 changes | Restore levels or give compensation. |
| Separate paid and free players in matchmaking | Match spenders with spenders. |
| Permanent, one-time ad removal | Not a weekly fee. |
| Spend extra wood on decorations | A sink for surplus resources once the castle is maxed. |
| Separate controls: a dial for angle and power, a fire button on the other side | More precise aim. |
| Tie-break rule | Most heroes killed should win a tie, or a sudden-death round. |
| Battle logs and a report button | For cheaters and quitters. |
| Screen orientation lock, volume from the first second | Basic settings. |
| Offline or single-player mode | 14 mention it. |

Trend [R]: average stars of text reviews by month rose from 3.1 (Mar 2026) to 4.0 (Apr), sat near 3.1 to 3.6 through summer, then fell to 2.2 in Oct and 2.6 in Nov after 1.21.0. Reviews before 1.21.0 average 3.34; after, 2.39.

### 1.5 Version history insights

[V] The page lists 25 builds from 1.7.0 (Mar 27, 2026) to 1.22.1 (Nov 19, 2026). That is a build every 7 to 14 days.

- Only 1.7.0 has real notes: tournaments, global leaderboard, player profiles, new emotes, banners, avatars. Every later note says only "Improvements and bug fixes".
- Reviews show what those silent builds did [R]:
  - ~1.10 (late May 2026): new name, level shown beside each hero.
  - 1.12 to 1.13 (Jun to Jul): matchmaking changes; more "always vs maxed players" reviews.
  - 1.16.1 (Aug): crash on match start for many; a hero art redesign some call "AI-looking".
  - 1.19.0 (Sep 29): new progression system ("devalued overnight, no warning").
  - 1.20.x (Oct): new paid web hero (Webley).
  - 1.21.0 (Oct 28): the big rework: hero level cap 100 to 50, rarity tiers re-cut, upgrade cards split by tier, reward cut, new "fair" matchmaking. Review volume tripled and ratings crashed.
  - 1.22.x (Nov): crash fixes claimed; more nerfs to free heroes reported.
- Why [I]: the pattern fits a live-ops team tuning for revenue and a longer grind. Cut levels, re-cut rarity, sell new strong heroes, sell weekly ad removal and passes. Silent notes hide the changes, so players learn of them in-game and feel cheated.

### 1.6 Lessons for Castle Protect

1. **Never take earned power away.** The 1.21 rework is the single biggest source of 1-star reviews. In an offline game, a balance patch must not lower a saved hero, castle, or unlock. If we must rebalance, re-scale both sides and refund currency.
2. **No paid power.** Paid heroes that out-class free ones are the top long-run complaint. Any purchase should be a one-time unlock or cosmetic. Every weapon and unit must be earnable in play.
3. **Fix the "flat field, bore the base" problem.** Players wanted what the ads showed: tall castles, hills and a mountain between them. Give maps real height, gaps, and cover, so no single shot path always wins. Add map modifiers in late game.
4. **Be honest about AI.** Castle Busters hid bots behind "PvP" and players caught it. We are single player, so name AI foes, give them clear styles, and never pretend.
5. **Keep both win paths.** "Kill the crew or wreck the castle" plus a visible castle % and hero HP bars reads well. A round cap (24 to 28 rounds) needs a clear tie-break; players asked for one.
6. **See-through own castle on your turn** is a neat way to pick a shooter inside a fort. Worth an original take.
7. **Ads, if any, must be opt-in and removable for good with one purchase.** Weekly ad removal drew scorn. Forced ads after each match drew more.
8. **Crash-safe matches.** Auto-save each turn and resume after a crash. Never turn a crash into a loss or a broken streak.
9. **Performance budget.** Overheating after two matches is a common gripe; the app is 676 MB. Aim for a small install, a 30 fps battery mode, and short GPU bursts.
10. **Settings from second one.** Volume and orientation must be reachable before the first match.
11. **Late-game sinks and variety.** A size cap made every endgame castle look alike. Add decorations or castle shapes that change play, and a use for surplus resources.
12. **Balance free picks too.** One free bomber hero ruled most lineups. Give every unit a counter and check pick rates in playtests.
13. **Write real patch notes.** Players forgive changes they are told about. Silence made Castle Busters look sneaky.

---

## 2. Pocket Tanks (id 311544087)

### 2.1 Facts

| Item | Value | Mark |
|---|---|---|
| Subtitle / category | Strategy (API genres: Strategy, Family, Entertainment) | [V] |
| Seller | Blitwise Productions, LLC (author Michael P. Welch, also DX-Ball and Scorched Tanks) | [V] |
| Price | Free, with IAP. No ads since v2.4.4 (2019). | [V] |
| Rating | 4.3 from about 1.6K ratings (API: 4.291, 1,578) | [V] |
| Star split | 5: 73%, 4: 8%, 3: 5%, 2: 4%, 1: 10% | [V] |
| Age rating | Page says 13+ (frequent guns or other weapons, infrequent cartoon violence). API says 9+. | [V] [U] |
| Size | 102.3 MB | [V] |
| Needs | iOS 12.0+; also M1 Mac, Vision Pro | [V] |
| Language | English only | [V] |
| Current version | 3.0.0, 2025-08-25 | [V] |
| First iOS release | 2009-04-15 (PC game from 2001) | [V] |
| Modes in description | vs CPU, Target Practice, local WiFi real-time, online turn-based (async), random online foe | [V] |

Description in short [V]: "The Ultimate One-on-One Artillery Game". Pick angle and power, fire. Bury the foe in dirt or hit with bullets. Visit the Weapon Shop before battle. Free version: 45 weapons, scrolling fields, WiFi and online play. Deluxe (IAP): 100 more weapons (145 with free packs), Jump Jets to move the tank, Bouncy Dirt, Digger to tunnel, support for paid and free weapon packs. As of 3.0.0 the game totals 400 weapons.

### 2.2 IAP economy

Top 10 IAPs shown [V]:

| IAP | Price |
|---|---|
| Pocket Tanks Deluxe | $4.99 |
| Space, Cyclone, Ambush, Gold, Power, Meteor, Fireworks, Energy, Tornado Pack | $0.99 each |

More packs exist past the top 10 (version notes name Danger, Gamma, Booster, Chasm, Spark, Turbo, Stomper, Twenty, Battery, Neutron, Puzzle, Quantum, Toy packs) [V]. Prices for those are not shown [U].

What it tells us:
- One clear premium unlock ($4.99) plus a long tail of $0.99 five-weapon packs.
- No currencies, no energy, no timers, no ads. You buy content, not power-ups or time.
- Friction [R]: some players expected Deluxe to hold every weapon and felt nickeled when packs kept coming (7 direct, more in passing). Online, buyers face foes with packs a free player lacks, so 11 reviews call online "pay to win". One claims a $53.99 total spend.

### 2.3 Screenshot breakdown

Both sets show real gameplay. Art is flat green terrain bands on a black-to-purple sky, small tanks, thin trails. No screen captions.

1. **Spider shot** (`iphone-1.jpg`) Two names top corners in big pixel fonts with score under each (Rosencrantz 18, Guildenstern 60). Top center: "3rd Volley". A spider weapon throws legs or strands that leave orange rings on a slope. A tall thin spike of terrain stands in the middle. Bottom control bar (about 22% of the screen): Move (1 left), Weapon (icon + name), Fire button, Angle (113), Power bar + number (46). [V for text, I for meaning]
2. **Weapon picker** (`iphone-2.jpg`) A scrolling list over the battlefield with icon tiles: Super Star, Gamma Blaster, Big Shot, Scatter Shot (highlighted), Pile Driver, Cruiser, Heatseeker. A big green check confirms. A small cyan arrow at the screen edge points to an off-screen tank. A tan sand peak shows a second terrain type. [V]
3. **Super Star** (`iphone-3.jpg`) Stars arc in and burst, raining many "2" damage numbers over the target. Dark circle scars show where the ground was cut. Score Luke 156 vs Leia 19, "2nd Volley". [I]
4. **Weapon Shop draft** (`iphone-4.jpg`) Title "WEAPON SHOP", "9 remaining". Player 1 list (red frame) and Player 2 list (orange frame). Center pool: Skipper, Dirtball, Mountain Mover (highlighted), Dirt Slinger. Arrow "PICK ONE" points to the side whose turn it is. Buttons: back and "Quick Pick". The pool has duplicates (two Dirt Slingers; Player 1 holds two Crazy Ivans). [V]
5. **Fine angle control** (`iphone-5.jpg`) The control bar becomes a ruler slider (60 to 80, red window on 70), left and right nudge arrows, "Angle 70" readout, green check. A crosshair marks the touch aim point in the sky. Opponent is "CPU 5" (AI level 5). [V]

iPad extras: Chain Reaction weapon with red blast rings and several damage numbers (`ipad-1.jpg`); picker with Flea Circus, Heatseeker, Hail Storm, Zapper (`ipad-2.jpg`); Drillers raining from the sky (`ipad-3.jpg`); shop with a "Random" button and weapons such as Napalm, Firecracker, Tracer, Ground Hog, Pineapple (`ipad-4.jpg`); Super Star again (`ipad-5.jpg`). [V]

Key UI rules we read [I]:
- Score is total damage dealt, not tank HP. Each side drafts 10 weapons (the shop shows 11 picked and "9 remaining", so 20 in all) and fires each once; high score wins.
- Each weapon is used once. The draft is the strategy layer before any shot.
- Angle and power are plain numbers with a fine-tune ruler. Touch the sky to set a rough aim, then nudge.
- Off-screen arrows show where the foe is on a field wider than the screen.
- Terrain is the star: digging, piling, sand, spikes, scars.

### 2.4 Review themes (662 reviews, 2009 to 2026)

**Love**

| Theme | Count | Paraphrase |
|---|---|---|
| Fun, classic, addictive | ~400 | Quick, simple, hard to stop; a few minutes per game. |
| Play with friends and family on one device or WiFi | ~140 (avg 4.5 stars) | "Me and my brother play nonstop"; grandma is "a beast". |
| Weapon variety | ~180 mention weapons | New ways to use weapons after years; wild effects. |
| Nostalgia (PC, school computers, floppy disk) | ~100 (avg 4.6) | "My childhood"; found it again after years. |
| Dev still updates after 20+ years | ~100 | Thanks to the solo dev; keeps it running on new phones. |
| Music and sound | ~25 (avg 4.8) | Loved the soundtrack (a few find battle music gloomy). |
| No ads | 6 | "A fun game with no ads." |

**Hate**

| Theme | Count | Paraphrase |
|---|---|---|
| CPU never misses, even on easy | ~49 (avg 2.7) | Top single complaint. Level 1 still lands direct hits; feels like cheating; it knows your spot. |
| Online: no turn timer, idle or quitting foes | ~20 | Wait 10 minutes per turn; the quitter's game sits until you forfeit. |
| Online "pay to win" | 11 | Foes bring weapons you cannot buy or do not own. |
| Crashes, freezes, stuck loading | ~31 | Mostly older builds and after big updates. |
| Lost purchases, login fails | ~18 | Paid packs gone after reinstall; a 2025 login break. |
| No weapon info, no aim help | ~14 (avg 2.8) | Weapons do not say what they do; guessing angle and power. |
| Deluxe does not include all | ~7 | Paid $4.99, still asked to buy packs. |
| Buried tank cannot escape | a few | Dirt weapons end games early (Deluxe). |
| Weapon damage spread too wide | ~17 | One weapon does 3, another 300. |

**Requests**

| Request | Count | Paraphrase |
|---|---|---|
| More weapons | ~32 | Keep packs coming. |
| Map and terrain choice, tank colors, custom tanks | ~31 | Pick maps; more terrain; color your tank. |
| Chat online | ~24 | Talk to friends in a match. |
| More than 2 players, teams | ~15 | 3 to 6 players, team colors. |
| Harder AI (top players) | 3 | Level 10 gets too easy for experts. |
| Aim aid, weapon descriptions | ~14 | Show what a weapon does and where a shot goes. |
| Turn timer online | ~20 | 30 to 90 seconds then auto fire. |
| Level editor, community levels | a few | Share maps. |

Trend [R]: yearly average of text reviews drifts down from 4.8 (2009) to about 3.3 to 3.9 (2023 to 2026), mostly from AI and online complaints. Old fans still post 5-star nostalgia reviews each year.

### 2.5 Version history insights

[V] The page lists builds from 2.0.2 (Mar 2014) to 3.0.0 (Aug 2025). Highlights:

- **2.0.4 (May 2014)**: online play opened to free players; local WiFi real-time; async turn-based online; replays; share shots.
- **2.0.5 (May 2014)**: ads in the online lobby for free users. The note says free online play "quadrupled our server bandwidth". Instant replay before your shot.
- **2.1.x (2014 to 2015)**: iOS 8 and iPhone 6 support; first expansion packs (Toy Pack free with Deluxe, Cyclone Pack paid).
- **2.2.0 (2015)**: Quantum Pack given free to all.
- **2.4.3 (2019)**: online moved off a third-party backend to their own AWS servers.
- **2.4.4 (2019)**: removed ads from the free version; notch support; "More Games" button; plea to "pitch in" for server costs.
- **2.5.x (2020)**: zoom options, tap to skip intro, Sign in with Apple.
- **2.6.0 to 2.7.5 (2021 to 2024)**: 5-weapon paid packs on a steady beat; "Twenty Pack" for the 20th year; goal of 400 weapons.
- **2.7.7 (2025)**: load, save, and sort weapon sets.
- **2.7.9 (2025)**: iOS 18 fixes.
- **3.0.0 (Aug 2025)**: Danger Pack (earthquakes, spiral terrain, tank flinging); 400 weapons total.

Why [I]: a solo or tiny team pays for servers and time with small content packs. Changes chase three things: keep it running on new iPhones, keep online alive at low cost, and keep a stream of fresh weapons. The notes are warm and specific, and reviews thank the dev by name. The AI complaint has run since at least 2014 and no note mentions a fix.

### 2.6 Lessons for Castle Protect

1. **AI must miss, and miss in a fair way.** "CPU never misses" is the top hate for 12 years. Give each AI level a visible error spread, bad weapon picks at low levels, and the same info the player has (wind, no peeking). Tell the player how good each AI is.
2. **The pre-battle draft is a cheap, loved strategy layer.** Alternate picks from a random pool, "Quick Pick" and "Random" for speed. Our version should add our own twist (castle parts or units in the pool) and use original names.
3. **Explain every weapon.** A short card with what it does, a tiny animation, and Target Practice to try it. Players who guessed blamed the game.
4. **Offer aim help that scales with difficulty.** Numeric angle and power plus a fine-tune ruler and nudge arrows work. Add an optional short trajectory preview on easy.
5. **Terrain is the fun.** Dirt moving, burying, tunneling, sand, spikes. Keep destructible ground central and give tanks (or castles) a way out of a burial so games do not stall.
6. **Weapon count drives long life.** 45 free, 145 with Deluxe, 400 over 16 years via small packs. For us: ship a big base set, add free offline content drops. If we sell anything, one clear unlock that truly holds "all current content".
7. **Keep damage in a sane band.** A 3-to-300 spread frustrates. Use score or HP so most hits matter and big hits feel earned.
8. **Quick matches.** A full match of 10 shots each in a few minutes fits phone play. Keep AI turns fast and let players skip replays.
9. **Local two-player love is strong (~140 reviews)**, but the brief says single player only. Flag for the owner: a same-device "hot seat" mode needs no server and would answer this. We do not assume it.
10. **No ads and no data collection read as a feature.** Players thank Pocket Tanks for having no ads.
11. **Keep purchases safe offline.** Lost packs after reinstall hurt trust. Use store restore and local saves that survive updates.

---

## 3. Side by side

| | Castle Busters | Pocket Tanks |
|---|---|---|
| Core | Castle on wheels, crew of heroes, 1v1 PvP (often bots) | Two tanks, angle + power, 10 volleys, vs CPU or friend |
| Win | Kill crew or wreck castle within a round cap | Higher total damage score after all volleys |
| Aim | Drag with a short dotted line | Numbers, ruler slider, touch point |
| Pre-match choice | Build castle, place heroes, pick 2 gadgets | Draft weapons one by one |
| Money | Gems, wood, coins, passes, weekly ad removal, paid heroes, loss offers | $4.99 Deluxe + $0.99 packs |
| Ads | Yes (rewarded + reported forced) | None since 2019 |
| Size | 676 MB | 102 MB |
| Privacy (store label) | Data used to track you: location, identifiers, usage, diagnostics, other. Same set linked to you. | Linked to you: contact info. Not linked: contact info, user content, identifiers, usage. |
| Top hate | Taking away earned power; paid power | AI that never misses |
| Top love | Building and blasting castles, addictive | Classic feel, weapons, play with friends |

Lesson for Castle Protect from the privacy rows [I]: an offline single-player game can ship with "Data Not Collected". That is a selling point next to Castle Busters' tracking label.

---

## 4. Method notes and limits

- The RSS feed is flaky. Many pages came back empty on first try; we retried each page until it filled (8 rounds). Apple caps each sort at 500 reviews. Merging "most recent" and "most helpful" gave 938 and 662 unique reviews. The store page itself shows only 10 reviews per game.
- Theme counts use keyword rules checked against a hand-read sample of about 160 reviews per game. Expect plus or minus 20% per theme. Non-English reviews (Russian, Spanish, Arabic) mostly say "too many ads" or "update ruined it" and were counted where keywords hit.
- IAP lists show the top 10 only. Hidden IAPs and their prices are unknown [U].
- Our screenshot reads (what a portal, gadget, or icon does) are guesses from still images [I].
- Age rating differs between page and API for both games [U].
- Castle Busters version history before 1.7.0 is not shown on the page [U].

## 5. Sources

- App Store, Castle Busters: https://apps.apple.com/us/app/castle-busters/id6746328263 (main, iPhone tab, reviews, version history, privacy, information panels)
- App Store, Pocket Tanks: https://apps.apple.com/us/app/pocket-tanks/id311544087 (same panels)
- iTunes lookup API: https://itunes.apple.com/lookup?id=6746328263 and https://itunes.apple.com/lookup?id=311544087
- Customer reviews RSS JSON: https://itunes.apple.com/us/rss/customerreviews/page=N/id=ID/sortby=mostrecent/json and .../sortby=mosthelpful/json, N = 1 to 10, both IDs
- Store screenshots (mzstatic.com, from the lookup API `screenshotUrls` and `ipadScreenshotUrls`), saved under `screens/appstore/`
- Context: `02b-castle-clashers-deep-dive.md` (the Google Play version of Castle Busters)
