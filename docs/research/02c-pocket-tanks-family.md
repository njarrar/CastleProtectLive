# 02c. Pocket Tanks and its family: store search teardown

Scope: every app in the Google Play search `pocket tanks` (apps, English), a deep look at the original Pocket Tanks, the clones, and what Castle Protect should take from them.

Date of research: 22 Nov 2026. All store numbers were read live on that day unless marked.

## 0. How to read this doc

- **[V]** = verified today from a primary source (store page, official site, or my own play).
- **[U]** = unverified. It comes from my memory of the PC and mobile game, or from one player review. Check before you rely on it.
- Weapon names in sections 1 to 4 are the real names used by those games. They are there for reference only. **Do not reuse them.** Section 6 gives the behaviors with original names.

## 1. What I played and what I could not

| Game | How | Result |
|---|---|---|
| Pocket Tanks (BlitWise, official) | **Not played.** No web build exists. The official site only offers Windows and Mac downloads plus store links. Android APK cannot run here: no `/dev/kvm`, no emulator, no adb. | Documented from the official site, both store pages, 40 Play reviews, 4 App Store reviews, Wikipedia. |
| Tank Stars (top result, web build on CrazyGames, Unity) | **Played** in headless Chromium by mouse drag and key press. | About 8 turns of level 1. Used 3 weapons (default shell, homing, nuke). Drove on fuel, picked up a supply crate, landed one direct hit. Did **not** finish the match. |
| "Pocket Tanks" web clone by BharathKumarRavichandran (owner reference) | **Played** from a local copy of the repo. | One full match, both sides, 10 shots, both weapons, moves used. Final score 15 to 30. |
| "Pocket Tanks" web clone by AtlantaTeam (owner reference) | **Played.** The repo needs a server, database and login, so I bundled only its game page with esbuild and ran it locally. | One full match against its bot. 5 shots each. I lost 1000 to 2000. |
| All other Android apps in the search | **Not played.** Store pages and reviews only. | |
| itch.io "Pocket Tanks 3D", "Pocket Tank" | **Not played.** Download only (Windows 162 MB, Android). | |

Screenshots are in `screens/pocket-tanks/` (12 files, all under 140 KB).

| File | Shows |
|---|---|
| `01-play-search-results.png` | Top of the Play search page |
| `02-play-pocket-tanks-page.png` | Official Pocket Tanks store page |
| `03-web-clone-bkr-missile-flight.png` | Bharath clone, missile in flight, key hints on every control |
| `04-web-clone-bkr-game-over.png` | Bharath clone, end card |
| `05-web-clone-atlanta-midmatch.png` | Atlanta clone, sand terrain after craters, tanks tilted on slopes |
| `06-web-clone-atlanta-bot-wins.png` | Atlanta clone, bot wins |
| `07-tankstars-web-aim-hud.png` | Tank Stars aim stick, power and angle readout, dotted arc |
| `08-tankstars-web-weapon-picker.png` | Tank Stars weapon drawer with star levels |
| `09-tankstars-web-homing-hit.png` | Tank Stars direct hit, health bar drops |
| `10-tankstars-web-nuke-crater.png` | Tank Stars big blast and crater |
| `11-tankstars-web-fuel-and-crate.png` | Tank Stars fuel bar, move pad, supply crate |
| `12-tankstars-web-level-map.png` | Tank Stars campaign path, shop, hangar, locked modes |

## 2. The search results

Source: `https://play.google.com/store/search?q=pocket+tanks&c=apps&hl=en`, loaded in Chromium. The list changes with region and from load to load. With `gl=US` the official Pocket Tanks is the large top card. Without a region it did not show at all on one load, which says a lot about how weak the brand's store position is. The table merges three loads. Ratings and installs come from each app's own page (US). [V]

"Type" is my label. **Artillery** means angle and power shots on a side view.

| # | App | Developer | Rating (reviews) | Installs | Updated | Ads / IAP | Type | Pitch in one line |
|---|---|---|---|---|---|---|---|---|
| 1 | **Pocket Tanks** | BlitWise Productions | 4.3 (175K) | 10M+ | Aug 29, 2026 | No ads, IAP | **Artillery** | "The ultimate one-on-one artillery game." 45 free weapons, 400 with packs. |
| 2 | **Tank Stars** | CASUAL AZUR GAMES | 4.7 (2.87M) | 100M+ | Oct 13, 2026 | Ads, IAP | **Artillery** | Turn-based 2D tank duels, upgrade weapons, collect tanks. |
| 3 | World of Tanks Blitz | Wargaming | 4.1 (4.52M) | 100M+ | Oct 8, 2026 | Ads, IAP | 3D PvP | 7v7 tank battles, 600+ tanks. |
| 4 | Tanks a Lot | Highcore Labs | 4.3 (334K) | 10M+ | Nov 17, 2026 | Ads, IAP | Top-down PvP | 3v3 real-time arena brawler. |
| 5 | Tanks vs Bugs | Games Extras | 4.2 (14.9K) | 1M+ | Aug 25, 2026 | Ads, IAP | Top-down PvE | One-thumb tank against giant bugs. |
| 6 | MWT: Tank Battles | Artstorm | 4.6 (293K) | 10M+ | Nov 18, 2026 | Ads, IAP | 3D PvP | Modern combined arms shooter. |
| 7 | Awesome Tanks | Mno Go Apps | 4.7 (39.8K) | 5M+ | Oct 18, 2026 | Ads, IAP | Top-down PvE | Twin-stick shooter with a level editor. |
| 8 | Pocket Panzers | Segment Games | 4.5 (95) | 1K+ | Nov 3, 2026 | Ads, IAP | Map strategy | Turn-based WW2 grand strategy. Name match only. |
| 9 | Tank Arena Steel Battle | XGame Global | 4.7 (23.9K) | 5M+ | Feb 26, 2026 | Ads, IAP | Side-view action | 2D physics tank brawls, story mode. |
| 10 | Super Tank Rumble | Lumidia Games | 4.0 (238K) | 10M+ | Nov 5, 2026 | Ads, IAP | Side-view builder | Build a tank from parts, physics fights. Editors' Choice. |
| 11 | DDTank Mobile | 7road | 3.5 (51.7K) | 5M+ | Aug 19, 2026 | IAP | **Artillery** (online) | Classic web artillery MMO, dungeons, PvP. |
| 12 | Tanks Arena io | NOXGAMES | 4.5 (60.6K) | 5M+ | Feb 10, 2026 | Ads, IAP | Side-view builder | Craft a tank, 1v1 auto-fights. |
| 13 | TANKS: Sci-Fi Battle | Pink Pointer | 3.4 (902) | 100K+ | Aug 10, 2026 | IAP | Top-down PvE | 34 missions, ricochet shots, "smart AI". |
| 14 | Future Tanks | XDEVS | 4.0 (31.5K) | 1M+ | Nov 10, 2025 | Ads, IAP | 3D PvP | Sci-fi online tank shooter. |
| 15 | Flying Tank | HEXAGE | 4.3 (6.99K) | 1M+ | Jan 26, 2025 | IAP | Side shmup | 24 missions, bosses, bombs, offline. |
| 16 | Armored Elite 15v15 | IronHull Games | 3.9 (2.51K) | 100K+ | Sep 17, 2026 | Ads, IAP | 3D PvP | WW2 15v15 shooter. |
| 17 | Tank Game - Tank Shooter | Big Game Company | 4.7 (2.16K) | 100K+ | Oct 8, 2026 | Ads, IAP | Top-down PvE | Offline wave shooter, retro style. |
| 18 | Hills of Steel | Supercharge Mobile | 4.5 (457K) | 100M+ | Oct 9, 2026 | Ads, IAP | Side-view action | Physics tank driving and shooting over hills. |
| 19 | final tank | WEJOY | 3.3 (10.4K) | 500K+ | Oct 23, 2026 | Ads, IAP | Top-down | 3D take on the classic brick-maze tank game. |
| 20 | Tank Pack Attack | FATTOY | 4.2 (15.9K) | 1M+ | May 15, 2026 | Ads, IAP | Merge / auto | Backpack-merge weapons onto a tank. |
| 21 | Steelborn: Tank Idle RPG | SayGames | 3.7 (5.91K) | 500K+ | Nov 18, 2026 | Ads, IAP | Idle RPG | Forge gear, auto duels. |
| 22 | Laser Tanks: Pixel RPG | AbhiTechGames | 3.7 (300) | 10K+ | Oct 25, 2026 | Paid $0.49, IAP | Roguelike | Pixel dungeon shooter. |
| 23 | Tank-a-Boom | Wargaming | 4.5 (2.27K) | 100K+ | Nov 11, 2026 | IAP | Top-down PvP | 5v5 arcade league. |
| 24 | War Tanks | XDEVS | 4.2 (10.2K) | 1M+ | Nov 6, 2026 | Ads, IAP | 3D PvP | 100+ modern tanks online. |
| 25 | Modern Tanks | XDEVS | 4.3 (147K) | 10M+ | Oct 22, 2026 | Ads, IAP | 3D PvP | Five-minute online matches. |
| 26 | Armored Heroes | 1DER Entertainment | 4.7 (9.17K) | 1M+ | Sep 24, 2026 | Ads, IAP | Side-view action | WW2 diorama side-scroller. |
| 27 | Tank Sniper 3D | CASUAL AZUR GAMES | 4.4 (25.6K) | 10M+ | Nov 2, 2026 | IAP | 3D shooter | Hide, aim, one-shot levels. |
| 28 | Tank64 | AChub | 3.4 (274) | 50K+ | Oct 8, 2026 | IAP | Top-down PvP | Retro online deathmatch. |
| 29 | Puzzle Catcher | BlitWise Productions | 4.4 (139) | 10K+ | Jul 9, 2025 | IAP | Puzzle | Same studio as Pocket Tanks. Not a tank game. |
| 30 | Super Tank Hero, Dead Ahead: Zombie Warfare | BiBoGames, Mobirate | 3.6, 4.6 (list page) | not opened | not opened | not opened | Other | Appeared on one load only. |

"Similar apps" row on the same page, worth noting because two are true cousins:

| App | Developer | Rating (reviews) | Installs | Ads / IAP | Type |
|---|---|---|---|---|---|
| **Boom Slingers** | Hyperkani | 4.6 (42.6K) | 5M+ | Ads, IAP | **Artillery** 1v1, 40+ weapons, 70+ characters, bullet time |
| **Warlings 2: Total Armageddon** | 17th Pixel Poland | 4.4 (80.8K) | 10M+ | Ads, IAP | **Artillery** squad game in the worm-war style, has AI opponents |
| Steampunk Tower 2, Castle Creeps, Grim Defender, Castle Defender, Last Day Defense, Tower Defense Rush | various | 3.9 to 4.4 | not opened | not opened | Tower and castle defense |

### What the list tells us

1. **Only 5 of about 32 apps are real artillery games**: Pocket Tanks, Tank Stars, DDTank, Boom Slingers, Warlings 2. The rest ride the word "tank". The niche is thin.
2. **The two leaders sit at opposite ends.** Pocket Tanks: deep, fair, no ads, old look, 10M installs. Tank Stars: shallow, pretty, heavy ads, 100M installs. Nobody offers deep weapons **and** modern polish **and** a fair offline single-player game.
3. **Google already links this search to castle and tower defense** in "Similar apps". A castle artillery game fits the shelf.
4. **Almost every top app is online PvP.** Their worst reviews are about matchmaking, fake players, pay-to-win and lost accounts. A 1-player offline game avoids all four by design.
5. Pocket Tanks carries the tag "Offline" on its store page. Reviews praise that in plain words.

## 3. The original: Pocket Tanks and Pocket Tanks Deluxe

### 3.1 Facts

- Made by Michael P. Welch (BlitWise Productions), who also wrote Scorched Tanks (Amiga, 1993) and DX-Ball. Released for Windows on 26 Oct 2001. iOS on 15 Apr 2009. Android on 7 Dec 2012. [V, Wikipedia and official site]
- Still updated. App Store "What's New", version 3.0.0, 25 Aug 2025: the Danger Pack brought the total to **400 weapons**. Play shows "Updated on Aug 29, 2026". [V]
- Android: 4.3 stars, 175K reviews, 10M+ installs, **no ads**, IAP. iOS free app: 4.3 from 1.6K ratings. iOS Deluxe app: $4.99, 4.5 from 331 ratings, #64 in Family. [V]
- Desktop Deluxe: $19.99 for "All 320 Weapons". [V, official site]
- One line pitch from the author: "The fastest game of artillery you'll ever play... without all the complicated details found in most artillery games." [V]

### 3.2 Match format

- Two tanks, one on each side of a hilly 2D field. One human against one human, or against the computer. [V]
- Before the match, both players visit the **Weapon Shop**. [V] A random pool is shown and the players take turns picking one weapon each until both hold 10. There is also a "random" button that deals both arsenals at once. [U] Each weapon is used once.
- The match is **10 volleys each** (20 shots). [V, Wikipedia]
- **Nobody dies.** There is no health. Each hit adds points to the shooter. Highest score after 10 volleys wins. [V]
- A match takes about 5 minutes. [U]
- **Target Practice** mode lets you fire any weapon with no limits to learn it. [V]
- Modes on mobile: 1 player against CPU, 2 players on one device, WiFi real time, online turn-based with no turn timer. [V]

Why this format works:
- The draft is a small strategy game before the action. You grab what you want and you deny the other side.
- One use per weapon means every shot is a new toy. You never spam one best weapon.
- Points with no death means no early knockout and no one sits out. A player who is behind still fires all 10 shots, and a big late weapon can flip the score.
- Fixed length makes it a perfect "one more game".

### 3.3 Controls, movement, terrain

- Each turn you set **angle** and **power**, pick a weapon, and fire. [V] Power runs 0 to 100. [U]
- **Movement:** each tank may move up to **four times per match**, a short fixed step each time. [V, Wikipedia] This is a scarce resource, not free driving.
- Deluxe adds movement as *weapons*: jet jumps, digging tunnels, pedestals, lifts and teleports. So moving costs you a shot. [V]
- **Terrain is fully destructible and also buildable.** Blasts carve craters. Dirt weapons pile soil up. Tanks fall when the ground under them goes. Players dig bunkers, build walls and domes, and bury the enemy. A buried tank must waste a shot to dig out or it hits itself. [V for destructible, bunkers, pedestals, burying; details U]
- Special ground types change how shots act: bouncy ground reflects shots, glue stops rolling shots and cancels bounce, black char hides terrain. [V]
- **No wind.** A long-time player asks the dev to "add wind" as an option, which fits my memory. [U] This is one of the "complicated details" the author cut on purpose.
- "Large scrolling battlefields" on mobile. [V] Reviews complain that hills are too tall on phones and you cannot see where you shoot. [V]

### 3.4 Scoring

- Points depend on the weapon and on how close the hit lands. [V]
- The official weapon notes show that the designer balances with **points versus blast size**: the default shot has a "medium sized explosion and good points", the big blast has a "large explosion radius, but points are low", split shots give "low points per explosion", the precision shot has "no explosion radius, large points". [V] Easy-to-land weapons pay less. Hard ones pay more.
- Hitting yourself gives points to the enemy. [U]
- Some weapons score zero and exist only to reshape the field. [V]

### 3.5 AI levels

- The CPU has **10 levels**. Reviews mention "CPU 10" and "a 2 level bot". [V from reviews]
- This is the weakest part of the game by player account: "even a 2 level bot has 100% accuracy", "The AI never seems to miss which takes a lot of fun out of game", and from the other side, "even CPU 10... doesn't know how to use half of the weapons". One reviewer finds mid level "pinpoint". [V, reviews]
- Read: the AI scales by aim accuracy only. It does not get smarter with weapons or terrain. That feels unfair when low and dull when high.

### 3.6 The weapons

Official count: 30 packs on desktop, 320 weapons. Mobile has more packs and reaches 400. The full official list with one-line notes is at `classic.blitwise.com/ptanksdepot.html`. I read all of it. Below are the 30 core and 30 Deluxe weapons grouped by what they do, then the pack themes. All behavior notes are from the official list [V]; the "why it is fun" lines are my analysis.

**A. Plain shells (the yardstick)**
- Single Shot: one shell, medium blast, good points. The baseline every other weapon is judged against.
- Big Shot: large blast, low points. Easy to land, pays little.
- Crater Maker (Deluxe): very large blast with good points.
- Sniper Rifle: no blast, big points, throws the tank. Pure aim test.
- Fun: clear risk and reward. You always know why you picked it.

**B. Split and spread**
- 3 Shot, 5 Shot (core), 10 Shot (pack): a fan of shells, less points each.
- Scatter Shot: lands, then throws 5 shells upward.
- Firecracker: a row of blasts sideways from the landing point.
- Chain Reaction: random blasts around the landing point.
- Fission Bomb (Deluxe): warheads that keep splitting upward. Huge area.
- Buckshot (pack): pellets that spread with distance.
- Fun: forgiving for new players, and spectacular.

**C. Proximity bursts**
- Pineapple: bursts into many tiny blasts when near a tank.
- Crazy Ivan: proximity multi-warhead with wild results.
- Spider: sprays a web of shots at the nearest tank.
- Zapper, Super Zapper: fires a beam at the tank if the shell passes close.
- Pin Cushion, Color Bomb, Particle Bomb (Deluxe and packs).
- Fun: a near miss still pays. Rewards "close enough" with a light show.

**D. Homing and guided**
- Heatseeker: steers to the tank if it gets close.
- Homing Missile: stops moving sideways when over a tank and drops.
- Quad Missile, Barrage, Cluster Bombs (packs): several small seekers.
- Cheap Shot (pack): teleports a bomb onto the enemy. A sure small hit.
- Fun: a safety net. You pick it when you cannot afford a miss.

**E. Rollers, skippers, bouncers**
- Cruiser, Mega Cruiser: travels along the ground for a few seconds, then explodes.
- Roller, Heavy Roller: rolls only downhill.
- Skipper, Super Skipper: skips like a stone several times.
- Jackhammer: bounces straight up 5 times in place. "Lots of fun to use."
- Cannon Ball: bounces and rolls, no blast, high points.
- Boomerang: a cruiser that comes back, so it can hit you.
- Hail Storm: hundreds of bouncing pellets that flow along the ground.
- Popcorn: many small sputtering shots, damage but no craters.
- Fun: you read the terrain like a pinball table. Valleys become traps.

**F. Tunnelers (under the ground)**
- Ground Hog: bores through dirt and explodes on the far side.
- Worm: bores and tries to dig upward.
- Homing Worm: stops under the tank and rises.
- Late Bloomer: bores, then launches 5 shells when it comes out.
- Ground Shocker, Drillers, Hot Foot, Cauldron (packs).
- Fun: the answer to bunkers and walls. Makes "hide behind a hill" unsafe.

**G. Beams and line of sight**
- Laser: flies dead straight, ignores gravity.
- Super Laser, X-Ray Cannon, Railgun (packs): cut through layers of terrain.
- Laser Battery (Deluxe): beams fire in a ring around the landing point.
- Bazooka, Phaser, Carpet Bomb (packs): big reward if you have a clear line.
- Fun: makes position matter. Dig a firing slot, or deny one.

**H. Rapid fire**
- Tommy Gun: "a very satisfying automatic machine gun-style weapon".
- Minigun (Deluxe): bullets with small blasts.
- Fun: many small hits feel great, and the stream chews terrain.

**I. Fire and liquid**
- Napalm: a burning liquid that flows downhill and pools.
- Fire Bolt (Deluxe): a fireball that burns out, so speed matters.
- Flamethrower, Volcano, Lava, Acid (packs): flowing or eating effects.
- Sprinkler (Deluxe): sprays in all directions. As easy to hit yourself as the enemy.
- Fun: fluids make low ground deadly. A tank in a pit is in trouble.

**J. Dirt adders (build and bury)**
- Dirtball, Big Dirtball: a lump of soil where it lands.
- Dirt Slinger: a V of dirt.
- Magic Wall: a tall thin wall grows where it lands.
- Mud Pie (Deluxe): a storm of dirt lumps.
- Cruball (Deluxe): a rolling dirt layer.
- Rainbow Dirt, Great Wall, Dome Protect, Blockade, Snowblower (packs).
- Fun: you can bury the enemy so their next shot blows up in their face, or wall yourself in.

**K. Dirt removers (dig and drop)**
- Pile Driver: small damage, blast goes straight down and makes a shaft.
- Dirt Mover: removes a wedge of dirt in the firing direction.
- Mountain Mover: removes a lot of dirt, scores nothing.
- Digger (Deluxe): a narrow tunnel along the firing angle.
- Well Digger (Deluxe): digs you out of any amount of dirt.
- Potholes (Deluxe): rips the ground into pits to trap tanks.
- Earth Mover, Bulldozer, Tunnel, Excavator (packs).
- Fun: prep shots. Open a lane now for a big beam next turn.

**L. Surface changers**
- Bouncy Dirt (Deluxe): coats ground so shots reflect.
- Glue Bomb (Deluxe): sticky ground that stops rollers and cancels bounce.
- Flash Blast (Deluxe): scorches and scores but leaves the dirt.
- Tar Ball, Shadow Blast (packs): black terrain that is hard to see.
- Fun: counters and combos. Bounce beats direct fire, glue beats bounce and rollers.

**M. Tank movers and disruptors**
- Jump Jets (Deluxe): your tank flies by angle and power.
- Blast Off, Turn and Burn, Booster Rocket, Elevator, Pedestal, Backtrack (packs): escape, climb or reposition.
- Wacky Tank (Deluxe): scrambles the enemy's angle and power.
- Backfire (pack): random teleport.
- Tornado, Tractor Beam, Magnet, Anvil, Slammer (packs): throw, lift, pull or sink the enemy.
- Smoke Bomb, Star Dust, Blackout (packs): hide things or confuse aim.
- Fun: comedy and tempo. Moving the enemy ruins their saved aim.

**N. Scouting**
- Tracer: 5 harmless shots at spread angles that show how to adjust.
- Super Tracer (Deluxe): 10 of them.
- Laser Tracer (pack): the same for beam weapons.
- Fun: lets a player trade one shot for knowledge.

**O. Wild cards and jokes**
- Chaos Grenade, Grab Bag, Mystery Bombs (packs): random effect.
- Golden Bullet (pack): thirty duds and one huge hit.
- Lemon (pack): "the most intentionally useless weapon ever". A dud you hope the enemy gets stuck with in the draft.
- Fun: stories. Players retell the lucky shot.

**Pack themes (how 30 weapons became 400):** Nuke, Ambush, Flamethrower, Meteor, Chaos, Power, Super, Gravity, Fireworks, Snowball, Gold, Fuzz, Tornado, Nano, Magic, Acid, Rocket, Laser, Party, Blast, Ice, Fire, Space, Plasma, Energy, Toy, Cyclone, Quantum, then mobile-only packs up to Danger (2025). Each pack is a theme (element, toy, weather, science) with a handful of new behaviors and several remixes of old ones. The tone is light: water balloons, pillow fights, lollipops, popcorn. No blood, no people. [V]

### 3.7 The weapon pack model

- **Free tier:** the core game with 45 weapons on mobile, all modes, **no ads at all**. [V]
- **Deluxe unlock:** one purchase ($4.99 on iOS) adds 100 weapons, the movement tools, bouncy ground and digging, and the right to add packs. [V]
- **Packs come in pairs.** Since 2002 nearly every release has been one **free 5-weapon pack** and one **paid 15-weapon pack** on the same day. [V, official release dates] The free pack keeps every Deluxe owner coming back. The paid pack earns.
- Desktop sells everything in one bundle for $19.99. [V] On mobile, players report about $20 in total to own it all. [V, one review]
- New packs arrived for 23 years. The steady drip is the live service, with no server needed.

Where it hurts (from reviews) [V]:
- "Advertised to unlock the full game with Deluxe Edition for $4.99... I have to pay another $12." The word Deluxe promises more than it gives.
- "There is absolutely no way to beat someone who has paid for all the weapons." Paid weapons are stronger in PvP.
- "Nothing earned in game... nowhere to advance." There is no progression at all.
- Purchases lost when changing devices or stores.

### 3.8 Why it has lasted 25 years

1. **You can explain it in ten seconds.** Angle, power, fire.
2. **A match is five minutes** and always ends. No grind, no timers.
3. **Variety per minute is very high.** Ten weapons a match, each used once, from a pool of hundreds. One reviewer has played for 20 years and says "I always feel like I'm learning new things about how to combine the weapons". Another: "Just finding out what each weapon actually does is fun."
4. **The terrain is a second player.** Every shot changes the map, so no two matches look alike.
5. **It is kind.** No death, no gore, no ads, no energy, no nagging. Reviews: "no drama, no ads just pure enjoy", "NO ADS, absolute perfection".
6. **Couch play.** Two people, one device. Many reviews are about siblings, school friends and partners.
7. **It runs on anything and works offline.**
8. **One author kept shipping** new toys on a steady beat and kept the old ones working.
9. **Nostalgia.** A large share of 5 star reviews open with "I played this as a kid".

What it never did, and what players ask for [V, reviews]:
- A turn timer online. The top complaint on both stores.
- A campaign, progression, or anything to earn.
- Fair AI. See 3.5.
- Balance between free and paid weapons.
- Better fit on phone screens (tall hills, tiny tanks, "too many clicks").
- Wind and map options, chat and emotes, player blocking, win and loss records.
- A modern look. The store art is from another era.

## 4. The clones compared

### 4.1 Tank Stars (played, web build)

What I saw in play [V]:
- **Health bars, not points.** The first tank to reach zero loses. This changes the genre from "score attack" to "duel".
- **Aim by thumb stick.** Drag a round pad: direction sets angle, distance sets power. Numbers for power and angle show next to the tank. A dotted arc previews the first part of the flight. **Last turn's arc stays on screen in a second color.** That one feature teaches aim better than any tutorial.
- **Fire is a separate big button.** No shot by accident.
- **Move on a fuel bar** with left and right pads, before you shoot.
- **Supply crates drop** between turns. I drove to one and it gave me a new weapon.
- **Weapons live in a side drawer.** Each has a 5 star upgrade level. Level 1 gave me a default shell, a homing shell and a nuke.
- **Tutorial by pictograms**, one idea per card, no text beyond three words ("ADJUST YOUR AIM", "CHANGE WEAPON", "PICK UP DROPBOX").
- **Juice.** Chunky craters with root cracks, smoke, screen flash, camera that follows the shell and zooms on impact. A crater reshaped the hill between us at once.
- **Campaign path** of numbered nodes with gift nodes, a shop, a hangar, and locked modes ("VS FRIEND 0/5 battles", "TOURNAMENTS 2 tanks").
- **Ad before the game even loaded** on the web portal, and a "progress won't be saved" nag.
- My shots flew wild once my tank sat on a slope: the barrel angle is relative to the hull. It is fair physics but it was not explained.

What it adds over Pocket Tanks: modern look, health and tension, per-tank weapon sets and abilities, upgrades, a path to climb, crates, strong onboarding.

What fails (store reviews) [V]:
- "They let greed take them into showing an ad after every fight." Each fight is about a minute.
- Ad removal sold as a subscription: "$6.99 a WEEK".
- "Extremely overpowered tanks" and "whoever starts first has the advantage".
- Crashes and lost progress.
- Depth is low. A handful of weapons per tank, and upgrades are stat bumps.

### 4.2 Bharath web clone (played)

- Fixed scene: two tanks, one static triangle hill, a painted mountain backdrop. [V]
- 5 shots and 4 moves each. Two weapons, a shell (15 points) and a missile (20 points). Hot-seat only, no AI. [V]
- The hill never deforms. Blasts leave a smoke sprite and nothing else. Code for hill damage exists but is not wired up. [V]
- Power did not respond to its keys in my run; it stayed at 1 for the whole match. The angle I set for player 1 carried over to player 2. [V]
- Good idea worth keeping: **every control shows its key on the HUD** (A and D on Move, J and L on Angle, F under Fire). Zero learning cost on desktop.
- Lesson: without destructible ground, a draft and many weapons, the game is flat. I finished 15 to 30 and felt nothing.

### 4.3 Atlanta web clone (played)

- Random sand terrain that **deforms and collapses**. Tanks tilt to the slope and slide. [V]
- One weapon ("Bullet"), 5 shots each, 4 moves, power and angle steppers, mouse aim, a big red fire button. [V]
- A **bot named Terminator** with difficulty 1 to 5 in code. It searches for a firing solution in a web worker and sends taunts by toast when it hits or gets hit. [V]
- Scoring is points, and a self hit costs you. Leaderboard, forum, login, i18n around the game. [V]
- I lost 1000 to 2000. The bot found the range on its first shot.
- Lessons: falling sand and a tilting tank add a lot of life for little code. A bot with a face and a voice makes a solo match feel like a duel. One weapon is not a game.

### 4.4 The rest, from store pages and reviews [V unless marked]

| Game | What it adds | What fails | What players ask for |
|---|---|---|---|
| **Boom Slingers** | 1v1 physics artillery with characters, hats, 40+ collectible weapons, bullet time, custom maps, weekly events. Matches "almost never exceed 3 minutes". Called "well balanced". | Trophy grind. Ads added before matches later, with a bug after them. | Rewards for kill counts, less grind. |
| **Warlings 2** | Squad artillery with soldier classes, wide arsenal, AI opponents, gold and unlocks. | "Hard level bots are LUDICROUSLY unfair." Most weapons are single use with no refills. | **Toggle which weapons the AI and I may use.** Ammo drops. A wind meter. A level editor. |
| **DDTank Mobile** | Old web artillery MMO: dungeons, world bosses, gear. | 3.5 stars. Always-online: "always says connecting", lag, forced maintenance, pay to progress. | To be able to play at all. |
| **Hills of Steel** | Not turn-based. Drive and shoot over physics hills, collect and upgrade tanks. 100M+. | Bugs and freezes in newer modes. | Fixes, balance for special attacks. |
| **Super Tank Rumble / Tanks Arena io** | Build a vehicle from parts, then fight. | Fiddly touch controls for building, unfair matchmaking, slow rewards. | A free-build sandbox, cheaper upgrades, free placement of parts. |
| **Tank Pack Attack** | Merge weapons on a grid, auto-battle. | "The game is just an ad simulator." "You MUST watch ads" to pass later stages. | Shorter and fewer ads. |
| **Flying Tank** | Premium-feel offline shmup, 24 missions, bosses, bombs. | Slow currency, and **you lose gear on death**. Missions "WAY too long". | Easy mode as default, shorter missions. |
| **Awesome Tanks** | Level editor with sharing, upgrades, secrets. | Minor editor friction. | Boss fights, daily rewards, a permanent 2x coin purchase ("I would love to buy it"). |
| **Tank Game - Tank Shooter** | Offline retro waves. | No cloud save. | More content at level 50, an expert mode, a base to raid. |
| **TANKS: Sci-Fi Battle** | No ads, 34 missions. | Controller bugs. | "I need more levels." |
| PvP shooters (WoT Blitz, MWT, Modern Tanks, War Tanks, Tanks a Lot, Armored Elite) | Scale and graphics. | Matchmaking, bots posing as players, pay to win, hacked or lost accounts, rug-pulled upgrades. | Fair matches. |

### 4.5 Patterns across the family

**People love**
- Short matches (3 to 5 minutes).
- Many weapons that each do something visibly different.
- Ground that breaks.
- No ads, or very few. Players say they would rather pay once.
- Offline play.
- A fair computer opponent with a personality.
- Things to collect and a path to climb.

**People hate**
- Ads after every match, and ad walls for progress.
- Weekly subscriptions.
- AI that never misses, or AI that cheats through walls.
- Paid weapons that beat free ones.
- "Deluxe" that is not the whole game.
- Losing gear, progress or purchases.
- Tall terrain that hides the target on a phone.
- Long levels with no checkpoint.

## 5. 20 lessons for Castle Protect

1. **Keep the core to three inputs: angle, power, fire.** Everything else is optional depth. Pocket Tanks has held players for 25 years on that.
2. **Short, fixed-length battles.** Aim for 3 to 5 minutes. Always show how many shots or turns are left.
3. **Limit the loadout per battle and make most weapons scarce.** A small hand (8 to 10) chosen before the fight beats a full menu. One or few uses each forces variety.
4. **Add a pre-battle pick against the AI.** A draft from a shared pool, where the enemy lord also picks, gives a strategy beat before the first shot and makes each replay differ.
5. **Balance by payoff against ease.** Wide blast, low reward. Narrow or tricky shot, high reward. Copy the principle, not the numbers.
6. **Terrain must break, pile up and fall.** Craters, added earth, collapsing sand. Then let castles sit on it, so undermining a wall is a real tactic.
7. **Give a use for every kind of ground change.** Dig lanes, raise ramparts, bury a gate, flood a moat. Utility weapons that score nothing still earn their slot if they set up the next shot.
8. **Make movement a cost.** Few moves per battle, or moving uses the turn. For us: repositioning a siege engine or raising a shield should compete with shooting.
9. **Show the last shot's arc** next to the current aim line. Tank Stars does it and it removes most frustration. Add a short dotted preview, with longer previews as a tech upgrade.
10. **Put fire on its own large button** and aim on a drag pad. No shot on release. Works for thumb, mouse and keys. Show key hints on the HUD on web.
11. **Design the phone view first.** Keep terrain height within the camera, auto-frame both sides, follow the shell, zoom on impact. Pocket Tanks loses stars on this today.
12. **AI must vary by behavior, not only accuracy.** Low tiers pick poor weapons and correct slowly. High tiers plan terrain and combos. The AI should bracket (miss long, miss short, then hit) so players see it "learning". Never 100% hits. Never shoot through cover.
13. **Give each enemy a face and a voice.** A named lord who taunts and groans made even a one-weapon clone feel alive.
14. **Add what Pocket Tanks never had: something to earn.** Campaign map, unlocks, tech tree. Reviews ask for it in plain words.
15. **Do not sell power or a false "full game".** If we charge, sell one clear unlock or honest content packs. Say exactly what is in it.
16. **No forced ads between battles.** If ads exist at all, make them opt-in for a bonus, and offer one fair permanent remove-ads price. No weekly subscription.
17. **Ship a practice range.** Any unlocked weapon, endless ammo, a dummy castle. Discovery is a large part of the fun.
18. **Use theme packs to grow.** Build weapons in families (fire, frost, storm, earth, alchemy, clockwork, beasts). A new family is a new world or chapter, and it fits a medieval setting.
19. **Keep the tone light.** Silly weapons sit next to serious ones, and one joke dud is a feature. No gore. This is why families play it.
20. **Save locally and never take things away.** No lost gear on defeat, no account needed, purchases restorable. Reward experiments instead of punishing them.

Two more that fall out of the castle twist:
- Pocket Tanks is points with no death; Tank Stars is health with death. **A castle can do both**: structure health per piece gives visible progress and the win condition, while a score or star rating per battle rewards style and gives replay goals.
- "Similar apps" on this very search are castle and tower defense games. Store text and art should speak to both crowds.

## 6. Weapon behavior archetypes to cover, with original names and twists

Names below are placeholders I made up for Castle Protect. Each line is a **behavior**, then a **castle twist** that the tank games cannot do. None of these names appear in the games above as far as I could check; confirm in the naming pass.

**Direct fire**
1. **Fieldstone**: plain ballistic shot, medium blast. The yardstick. Twist: cracks one block and loosens its neighbors.
2. **Millwheel**: huge soft blast, low damage per block. Twist: strips roofs and banners, exposes what is inside.
3. **Needle Bolt**: no blast, very high damage to the single piece it touches. Twist: can pass through an arrow slit to hit a unit behind the wall.
4. **Twin Yoke / Hand of Five**: 2 to 5 shots in a fan. Twist: fan angle is set by how long you hold the fire button.

**Burst and area**
5. **Hornet Jar**: bursts near any enemy piece into many stingers. Twist: stingers seek soft targets (crew, tents) and ignore stone.
6. **Seedpod**: lands, then pops bomblets upward that rain back down. Twist: bomblets roll off sloped roofs and collect in courtyards.
7. **Ridge Runner**: a row of blasts sideways along the surface. Twist: follows the top of a wall and clears the battlements.
8. **Ember Lottery**: random blasts in a zone. Twist: each blast that finds wood starts a fire.

**Guided**
9. **Falcon Shot**: bends toward the nearest target late in flight. Twist: you tag the target piece first with a scout shot or a spyglass tech.
10. **Plumb Stone**: when it passes over a target it stops and drops straight down. Twist: made for towers and wells, it punches down through floors.
11. **Courier Pigeons**: several small seekers released mid flight. Twist: each carries a different small payload you pick in the workshop.

**Ground travel**
12. **Barrel Roll**: rolls along the ground for a few seconds, then bursts. Twist: stopped by moats, spikes and mud; climbs ramps you built.
13. **Downhill Boulder**: only rolls downhill and gains damage with speed. Twist: you can dig the slope first to aim it at the gate.
14. **Skipping Stone**: skips several times before the blast. Twist: skips on water, so a moat helps the attacker.
15. **Hop Hammer**: bounces in place straight up several times. Twist: each hop drives one floor deeper into a tower.
16. **Iron Marble**: heavy ball, no blast, bounces and knocks pieces loose by physics. Twist: topples stacked blocks, and what falls does the damage.
17. **Homecoming**: travels out, turns around and comes back. Twist: used on purpose to hit the back of a wall, with real risk to your own keep.

**Under the ground**
18. **Mole Charge**: bores through earth and bursts on the far side. Twist: stone foundations stop it, so players learn to look for dirt footings.
19. **Root Seeker**: bores, stops under the first structure and rises. Twist: collapses the tile it comes up through.
20. **Sapper's Gift**: bores, then sits. It goes off after two turns or when something heavy stands on it. Twist: a buried trap for enemy units that sortie.

**Beams and line of sight**
21. **Sunglass**: a straight ray with no gravity that stops at the first solid thing. Twist: bounces off polished shields and water.
22. **Borehole Ray**: straight ray that drills through several layers and gets weaker with each. Twist: leaves a hole you can shoot through next turn.
23. **Lantern Ring**: lands, then fires short rays in a circle. Twist: best dropped into a courtyard.

**Rapid fire**
24. **Rattle Gun**: a stream of small shots along one arc; the stream walks as the barrel kicks. Twist: you can sweep it by dragging during the burst.

**Fire and fluids**
25. **Pitch Pot**: burning liquid that flows downhill, pools and burns for a few turns. Twist: spreads across wood, stops at stone, and water puts it out.
26. **Short Fuse Comet**: a fireball that loses heat in flight, so a fast flat shot hits hardest. Twist: lights fuses and powder stores on contact.
27. **Brine Burst**: a wave of water that pushes loose things, floods pits and douses fire. Twist: turns dirt to mud that slows rollers and bogs units.
28. **Vitriol**: slow acid that eats down through whatever it sits on over three turns. Twist: stone resists, mortar does not, so it unseats blocks.
29. **Rimefall**: freezes what it hits. Frozen pieces shatter from the next blunt hit; frozen water becomes a bridge.

**Earth shaping**
30. **Sod Lobber**: adds a mound of earth where it lands. Twist: patch your own breach or bury an enemy engine so its next shot backfires.
31. **Thornwall**: grows a tall thin barrier. Twist: it is a hedge, so it burns.
32. **Trench Cut**: removes a wedge of ground in the firing direction, no damage. Twist: opens a firing lane or drains a moat.
33. **Well Shaft**: blast goes straight down in a narrow column. Twist: drops whatever stood there into the hole.
34. **Landslip**: shakes a hillside so loose earth slides down. Twist: buries anything at the foot of a slope.
35. **Dig Out**: clears all earth around your own piece. The escape from being buried.

**Surface coats**
36. **Springmoss**: coats a patch so shots bounce off it. Twist: lay it on your own roof, or bank a shot off it around a corner.
37. **Tar Mat**: sticky patch that stops rollers and skippers and cancels bounce. Twist: units that walk on it are held for a turn.
38. **Soot Veil**: blackens an area and hides it from the aim preview. Twist: the AI aims worse into it, and so do you.

**Movers and disruptors**
39. **Bellows**: a gust that shoves light things and bends shots for one turn. Twist: this is how we add wind, as a weapon and as weather on some maps, never as a default chore.
40. **Iron Hunger**: pulls metal pieces and shots toward itself for two turns. Twist: drags enemy cannonballs off course or yanks a portcullis.
41. **Catapult Leap**: flings your own mobile unit or engine to a new spot by angle and power. Costs the turn.
42. **Stilt Tower**: raises the ground under your piece into a pedestal. Better arc, more exposed.
43. **Jester's Bell**: scrambles the enemy's saved aim and swaps two weapons in their hand.
44. **Swap Mirror**: trades the places of two pieces. Twist: only among pieces of similar size.

**Scouting**
45. **Chalk Arrows**: five harmless marker shots at spread angles. They leave chalk arcs for the rest of the battle. Twist: the arcs also reveal hidden rooms they pass over.

**Sky and timing**
46. **Skyfall Call**: mark a spot; stones fall on it at the start of your next turn. Twist: the enemy sees the mark and can move or shield.
47. **Storm Bottle**: a cloud that drifts and stops over the first enemy piece, then rains small hits for three turns.
48. **Slow Match**: a bomb that bounces and counts down in view. Twist: either side can knock it away with another shot.

**Living payloads (fits the castle theme)**
49. **Gnat Cloud**: releases a swarm that harasses crew for a few turns and lowers the enemy's accuracy.
50. **Ratpack**: critters that run along the ground, slip through gaps and chew supplies or fuses.

**Defensive tools as "shots"**
51. **Wicker Dome**: grows a light dome over one of your pieces. Blocks one hit, burns easily.
52. **Mason's Hour**: repairs a few blocks. Cost: you do not fire this turn.

**Wild cards**
53. **Tinker's Sack**: a random effect from a known list. The list is shown, the pick is not.
54. **Golden Goose**: many duds and one very strong hit. A gamble weapon for a turn when you are behind.
55. **Old Turnip**: a dud on purpose. It does almost nothing and appears in the shared draft, so the fun is making the enemy lord take it. Twist: with the right tech-tree perk it becomes useful in an odd way.

**Combo rules to design in from day one**
- Fire lights wood, pitch and fuses. Water stops fire and makes mud. Frost makes things brittle. Acid loosens mortar.
- Bounce coat beats direct fire. Tar beats bounce and rollers. Tunnelers beat walls. Stone footings beat tunnelers. Beams need a lane, diggers make lanes.
- Every hard counter should be visible on the map before the shot, so a loss reads as "I should have seen that", not "the game cheated".

## 7. Sources

Store and official pages (read 22 Nov 2026 in Chromium):
- Play search: https://play.google.com/store/search?q=pocket+tanks&c=apps&hl=en (also with `&gl=US`)
- Pocket Tanks on Play, with the first 40 reviews: https://play.google.com/store/apps/details?id=com.blitwise.ptankshd
- Pocket Tanks on the App Store: https://apps.apple.com/us/app/pocket-tanks/id311544087
- Pocket Tanks Deluxe on the App Store: https://apps.apple.com/us/app/pocket-tanks-deluxe/id311466554
- Official site: https://www.blitwise.com/ptanks.html
- Official weapon pack list, all 30 desktop packs with notes: https://classic.blitwise.com/ptanksdepot.html
- Wikipedia: https://en.wikipedia.org/wiki/Pocket_Tanks
- Fan wiki, standard pack list (via its API): https://pocket-tanks.fandom.com/wiki/Pack:Standard
- Play pages, 3 reviews each, pattern `https://play.google.com/store/apps/details?id=<id>`: com.playgendary.tanks, net.wargaming.wot.blitz, com.idspe.tanks2, com.redspell.nanotanks, com.Shooter.ModernWarfront, com.emittercritter.awesometanks, com.segmentgames.pocketpanzers, com.tank.arena.steel.battle, com.stove.supertank.google, com.wan.ddten, com.noxgames.tank.arena.cartoon.pvp, com.pinkpointer.tanks, com.extremedevelopers.futuretanks, net.hexage.flt, com.zszf.tk2, com.the.ultimate.tank, com.superplusgames.hosandroid, com.wepie.finaltank, com.fattoy.tankpack, com.playbrew.tanks, com.atgstudios.lasertanks, net.boomgame, com.xtornado.militarytanks, com.extremedevelopers.armada, com.OsOs.ArmoredHeroes, shoot.some.tank, com.tank64.app, com.blitwise.puzzle, com.tuokio.boomslingers, com.warlings5

Played:
- Tank Stars web build: https://www.crazygames.com/game/tank-stars-online
- https://github.com/BharathKumarRavichandran/pocket-tanks (run from a local clone)
- https://github.com/AtlantaTeam/pocket-tanks (game page bundled and run locally; server, login and leaderboard stubbed out)

Looked at, not played:
- https://itch.io/search?q=pocket+tanks
- https://itch.io/games/html5/tag-artillery

Could not open (bot wall, HTTP 403): GameFAQs weapon FAQ, StrategyWiki, the fan wiki's normal pages.

## 8. Open items

- Nobody on this team has played the real Pocket Tanks in this session. Someone should play ten matches on a phone and confirm the [U] items: draft flow, power range, move distance, no wind, self-hit scoring, match length.
- Tank Stars: finish a match and play 10 levels on a phone to see the reward screen, ad cadence, upgrade costs and how tanks differ.
- Boom Slingers and Warlings 2 deserve a hands-on look. They are the closest living artillery games with good ratings, and Warlings has AI opponents.
- Check every placeholder name in section 6 against trademarks and against the 400 Pocket Tanks weapon names before it goes into design docs.
