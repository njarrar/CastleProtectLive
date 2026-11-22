# 02. Reference gameplay teardown

Hands-on study of Pocket Tanks, Castle Clashers (now sold as "Castle Busters") and playable web artillery games.
Written for the Castle Protect design team. Date of play: 22 Nov 2026.

Companion file: `02b-castle-clashers-deep-dive.md` goes deeper on the Castle Clashers meta game. This file
covers how the games play second by second, and what that means for us.

## 0. What I played and how sure I am

| Game | How I studied it | Confidence |
|---|---|---|
| Tank Duel (tembrica.com), a modern web artillery game with 18 weapons, wind, fuel and AI | Played live in headless Chromium. 53 turns over two sessions, desktop and phone layout, every weapon fired, timings logged | High. First hand |
| BharathKumarRavichandran/pocket-tanks (web clone) | Cloned, served, played a full 5 shot match with keyboard input. Read all 1,030 lines of code | High. First hand |
| AtlantaTeam/pocket-tanks (React + canvas clone with a bot) | Cloned, built the game page with a small esbuild harness (login and server stripped), played vs the bot | High for what ran. The bot stalled on its second turn in my harness |
| Pocket Tanks (BlitWise, commercial) | Could not run. Rebuilt from Wikipedia, the BlitWise site, both store pages, user reviews, and long standing knowledge of the game | Medium. Items marked [M] come from memory of the real game and need a phone check |
| Castle Clashers / Castle Busters (EpiCoro, published by Voodoo) | Could not run (needs phone and network). Rebuilt from both store pages, the official site, store screenshots, three industry breakdowns and about 30 user reviews | Medium. Items marked [?] are not confirmed |

Screenshots from my play are in `screens/` with the prefix `t02-`.

Two facts to know up front:

1. **Castle Clashers has no campaign and no boss fights.** No source shows any. It is a trophy ladder of 1v1 matches
   that are sold as PvP but, by many player reports, are mostly bots. The brief asks how its boss fights work. The honest
   answer is that there are none. That gap is our opening.
2. **The two open source clones are thin.** One has two weapons and no AI. The other has one weapon and a slow bot.
   They teach more by what they lack than by what they have.

---

## 1. Pocket Tanks

### 1.1 What it is

A one on one artillery duel on a single screen. Two tanks sit on a dirt hill. Each side fires 10 shots. Most points
wins. No health bar, no death. The maker pitches it as the fastest artillery game, with the fiddly parts of older
games cut out. It launched in 2001 on Windows and is still updated in 2026. Android alone shows 10M+ installs and a
4.4 rating. It has no ads and a one time Deluxe unlock.

### 1.2 Match structure

1. **Title menu.** One Player, Two Players, Target Practice, Options, weapon pack shop. [M]
2. **Player entry.** Name, tank colour, CPU level. The CPU has about ten skill steps. [M]
3. **Weapon Shop (the draft).** 20 weapons are drawn at random from all the weapons you own. Players take turns
   picking one each until both hold 10. There is a quick pick button for players who want to skip the draft.
4. **Battle.** 10 volleys. A volley is one shot from each side. Each weapon fires once and is gone.
5. **Result.** Final score, winner, rematch.

A full match runs about 5 to 8 minutes against the CPU. The draft takes 30 to 60 seconds of that.

### 1.3 One turn, second by second

| Time | What happens | How it feels |
|---|---|---|
| 0.0 s | Control passes to you. Your panel lights up. Last angle and power are kept | Calm. No clock |
| 0 to 3 s | Look at the hill, the enemy, the craters from last turn | The real thinking moment |
| 3 to 6 s | Pick a weapon from your list of what is left | Fun. Each pick is a small gamble because every weapon is single use |
| 6 to 12 s | Set angle, set power. Nudge by single steps. Maybe spend one of 4 moves | Fiddly on touch, see 1.9 |
| 12 s | Tap Fire. Barrel flash, launch sound | Sharp |
| 12 to 15 s | Shell flies. Camera does not move. A thin trail shows the arc | Tense. You judge the arc before it lands |
| 15 to 17 s | The weapon does its trick: splits, rolls, digs, rains, burns. Dirt moves. Points pop up and tick into your score | The payoff. Big weapons hold the screen for 2 to 4 s |
| 17 to 18 s | Dirt settles. Tanks slide down if the ground under them is gone | Small aftershock, often funny |
| 18 s | CPU turn starts at once. It aims in about a second and fires | Fast. No dead air |

A full volley (you plus CPU) is about 25 to 30 seconds. Most of it is your own aiming time.

### 1.4 Controls

- **Angle.** A number readout with left and right step buttons. On touch you can also drag near the barrel. [M]
- **Power.** A 0 to 100 bar with step buttons for fine tune.
- **Move.** Left and right buttons. 4 moves per match, each a fixed short hop. Not per turn. This makes a move a
  real choice.
- **Weapon.** A list box of your remaining weapons. Tap to open, tap to pick.
- **Fire.** One large button in the centre of the panel.
- The keyboard on desktop mirrors all of this with arrows and a few keys.

### 1.5 UI layout and camera

- Whole field fits on one fixed screen. No scroll, no zoom, no follow cam.
- Top left and top right: player names and scores.
- Bottom strip: Move, Weapon, Fire, Angle, Power, left to right. The BharathKumar clone copies this strip exactly
  (see `screens/t02-bk-clone-play.png`).
- Playfield takes about 75% of screen height.

### 1.6 Wind, terrain, damage, scoring

- **Wind.** The classic game has none. The official pitch says it drops the "complicated details" of older artillery
  games, and wind is the main one. Some second hand sources claim a wind option. I could not confirm it. Treat
  Pocket Tanks as a no wind game.
- **Terrain.** Random dirt hill, fully destructible, per pixel. Dirt can be removed (craters, diggers) and added
  (dirt balls, walls). Loose dirt falls. You can bury a tank, dig it a bunker, or raise it on a pedestal.
- **Damage model.** There is none in the usual sense. Tanks cannot die. A hit only gives points.
- **Scoring.** Points depend on the weapon and on how close the blast is to the target. Hitting yourself costs
  points. Many small hits from a spray weapon can beat one big hit.
- **Burial.** A tank under dirt must shoot its way out, which can waste a shot. That is the main form of "defence".

### 1.7 Weapons and how each family feels

The base game ships about 30 weapons. Deluxe and packs bring the desktop total to 320 and mobile to 385. The
families matter more than the list:

| Family | Examples named in official text | Feel |
|---|---|---|
| Plain shell | single shot, big shot | The baseline. Teaches range |
| Multi shot | 3 shot, 5 shot, tommy gun | Forgiving. Small pops in a row feel like a drum roll |
| Cluster or split | firecracker, hail storm | Loud and wide. Great when your aim is rough |
| Ground crawler | skipper, cruiser, spider | Skips or runs along dirt. Fun to watch because the result is not known until late |
| Digger | pile driver, digger | Punches down. Counters bunkers |
| Dirt adder | dirt ball, magic wall | Buries or blocks. Defence and trolling |
| Dirt remover | dirt mover, earth mover | No damage, reshapes the map. A setup move |
| Fire and liquid | napalm | Flows downhill and pools. Rewards hitting a pit |
| Seeker | heatseeker | Bends toward the target. A rescue for bad aim |
| Ranging aid | tracer | Fires a fan of harmless shots to show you the right angle. A weapon that teaches |
| Mobility | jump jets | Spend a shot to move far |
| Odd rules | bouncy dirt, sniper rifle | Change how the next shots behave |

What makes the roster work is that almost every weapon changes a rule (how it flies, how it meets dirt, or what it
leaves behind) and not just a damage number.

### 1.8 Progression and menus

- No levels, no XP, no unlock tree, no story. Progress is the size of your weapon pool.
- Money buys weapon packs. Many 5 weapon packs are free.
- Target Practice gives every weapon with no limit. It is the lab and the tutorial in one.
- Menus are plain and quick. From launch to first shot is under a minute.

### 1.9 Fun and dull

Fun:
- The draft. You see 20 toys and fight over them.
- One use weapons. Every shot is fresh. No "best gun" spam.
- Watching a weapon you have never used do its thing.
- Terrain tricks: burying, tunnelling, sliding.
- Speed. The CPU does not make you wait.

Dull or weak:
- No stakes inside a match. Nothing dies, so no last shot drama and no comeback kill.
- No reason to play the next match beyond the match itself. No goals, no map, no growth.
- One hill shape, one foe, one mode. It all rests on the weapons.
- A long list of weapons with short names and no icons. New players pick blind.
- Reviews note that the same angle and power do not always land in the same place. That hurts trust in aim.

### 1.10 Touch pain points

- Angle and power are two separate small controls. Setting both takes 4 to 8 taps or a drag plus taps.
- Step buttons are small next to a thumb. Reviews ask for slide on the panel values.
- The weapon list covers the field while open, so you choose without seeing the map.
- No aim preview at all. First shot of every match is a guess.
- Fixed camera means tanks and shells are small on a phone.

---

## 2. Castle Clashers / Castle Busters

### 2.1 What it is

A 1v1 castle against castle artillery game in landscape. Each side has a fort on wheels with a crew of units
standing in rooms. Each turn one unit fires its own kind of shot. Walls, floors and towers break. You win by
killing the whole crew, by wrecking the castle, or by being ahead when the round cap hits. Made by EpiCoro,
published by Voodoo, launched May 2025, 10M+ Android installs, 3.9 on Google Play and 4.6 on iOS.

The store text says both "real time" and "turn based". Screens and reviews show turns: a round counter reads
"Round 3/24", and players write about waiting for the foe to move.

### 2.2 Screen and UI (from store screenshots)

- **Top bar.** Castle icon and castle health in percent at each corner (for example 88% vs 100%). Player name and
  trophy count beside each. A blue against red "VS" bar in the middle. Round counter under it.
- **Right edge.** Two gadget slots with a use count (0/1) and four unit portraits with their levels.
- **Field.** Your castle on the left in cutaway view, so you see your units in their rooms. The enemy castle is
  shown from outside. Each castle sits on tank tracks or wheels.
- **Aim.** A short dotted line leaves the active unit. It shows the first part of the arc only.
- **Bonus rings.** Glowing rings float between the castles with "+1" on them. Shooting through one grants a bonus.
  [?] on what exactly the bonus is.
- **Hits.** Floating damage numbers (for example "-70") and a small health bar on the part that was hit.

### 2.3 One turn, second by second (rebuilt)

| Time | What happens | Notes |
|---|---|---|
| 0 s | Round counter ticks. Your active unit is marked with an arrow | One unit acts per turn. [?] whether you pick the unit or it rotates |
| 0 to 3 s | Read the enemy fort: which wall is thin, where the crew stands | The cutaway of your own fort also reminds you what you might lose |
| 3 to 8 s | Drag to aim. The dotted line follows your finger. Optionally roll the castle (costs fuel) or trigger a gadget | A review says the launch control sits in the left corner and a slipped finger sends shots into the ground |
| 8 s | Release to fire | Drag and release is one gesture. Faster than Pocket Tanks, less exact |
| 8 to 10 s | Shot flies. It may pass a bonus ring | Ring adds a small skill test to every shot |
| 10 to 13 s | Impact. Blocks break, parts fall, units drop through holes, damage numbers pop | The best moment in the game. Physics collapse can chain |
| 13 to 14 s | Castle percent drops. Dead units vanish from the portrait row | Clear feedback on both win paths |
| 14 s on | Enemy turn. Often a bot | Players report freezes while "waiting for the enemy" |

A match is capped at 24 rounds (18 at launch) and takes about 5 minutes.

### 2.4 Controls

- **Aim and fire.** Drag back or drag toward the target, release to shoot. Angle and power come from one drag.
- **Move.** Roll the whole castle left or right on its wheels. Wheel sets have speed and fuel stats.
- **Gadgets ("helper items").** One tap tools with limited uses. Some attack, some defend or heal.
- **Weapon pick.** There is no weapon list. The unit is the weapon. Choosing who fires is choosing what fires.
- No custom control layout. Players ask for one.

### 2.5 Castle building

- You build your own castle in a grid editor out of battle: walls, floors, towers, foundations, unit slots.
- Parts have material tiers. The official site names wood and stone at the low end and diamond and magma at the top.
- You can expand the castle footprint up to a hard cap. Reviews say that at the cap every castle has the same
  width and height, and only wall strength still grows.
- One reviewer says a built castle cannot be freely rearranged later. [?] may have changed.
- Unit placement matters most. Reviews say good placement makes you nearly unbeatable.
- A cosmetic layer exists (skins, decor).

### 2.6 Units

- 30+ units. You bring 4 at the start and up to 8 later.
- Each unit has one signature shot. Named on the official site: one fires a delayed fuse bomb, one a single huge
  area bomb, one rains orbs from above, one fires a straight strong laser, one throws three boomerangs that come
  back. Reviews also name a mortar unit, a sniper and an ice cannon. Store text adds knights, archers and bombers.
- Roles beyond damage: units that buff the crew, units that revive dead crew, and a season unit that hits harder
  the more damage your castle has taken.
- Units have levels and rarity tiers (epic, legendary). Level ups unlock perks.
- Some units are premium only (paid). Players call them far too strong.
- Two helper unit types, trainers and builders, gate upgrades behind timers.

### 2.7 Upgrades and economy

- Currencies: wood (walls), coins or gold (units and castle), gems (premium), cards per unit. A late change made
  three card types by unit tier.
- **The Forge.** A reward track. Upgrading things earns Forge progress, which pays out wheels, gadgets and
  resources. A paid Forge Pass sits on top.
- Timers on upgrades. Ads or gems skip them.
- Daily chests with a cap, streaks, quests, a battle pass that one player finished in 2 to 3 days.
- Rewarded video on match end multipliers, speed ups and chest refills. Android reviews also report a forced ad
  after every match.

### 2.8 Level structure, enemies, bosses

- **No levels in the campaign sense.** Progress is trophies. Trophy Road unlocks arenas, then Ranked mode.
- Arenas change the backdrop and add hazards and obstacles. [?] on the hazard list.
- Side modes: Colosseum leagues (bronze, silver, gold), timed tournaments, seasons with a featured unit.
- **Enemies** are other castles only. Many players say they are bots with no plan, and some bots carry premium
  units.
- **No bosses.** No PvE stage, no story foe, no set piece fight in any source.
- Battlefields are mostly flat with the two castles close together. One long review says the ads show tall castles
  with a mountain between them, but real play is flat ground, and the one winning plan is to bore through the base
  of the enemy fort.

### 2.9 Fun and dull

Fun:
- Breaking a built thing. Players compare it to Worms and Angry Birds.
- Two win paths. Kill the crew or wreck the fort. You switch plan mid match as walls open.
- Your own fort is at risk in view. Loss feels personal because you built it.
- Unit as weapon. Each crew member has a face and a trick.
- Short matches with a hard round cap.

Dull or bad:
- One dominant plan (dig through the bottom). Flat maps make it worse.
- Fake PvP. Bots dressed as players, with no real tactics.
- Pay to win units, and a patch that downgraded bought units.
- Upgrade timers and ad walls.
- After the castle is maxed there is nothing left to do.
- Crashes and freezes that count as losses.
- No replays, no sharing of a great shot.

### 2.10 Touch pain points

- Launch control in a corner. Finger slips ruin shots. No way to move it.
- Short aim line. Long shots are still guesses.
- Landscape only with small units inside small rooms.
- Online only. No network means no game. We are offline first, so this is a straight win for us.

---

## 3. Web games I played

### 3.1 Tank Duel (tembrica.com)

The best playable reference I found. Turn based duel vs AI on five maps, 18 weapons, wind, fuel, health bars, best
of 1, 3 or 5 rounds.

**Menu.** One card: mode (vs computer, hot seat, online), difficulty (3 chips), rounds (3 chips), battlefield
(5 chips), Start. Start drops you into your first turn with no load screen. Menu to first shot took about 3 seconds.
This is the right bar for us.

**HUD.** Top: two health bars with numbers, round label, wind arrow with a strength number, round win pips.
Centre top of field: a pill that reads "Your turn" or "Computer is aiming". Below field: angle stepper, power
slider, move buttons with a fuel bar, weapon strip with ammo counts, red Fire button.
See `screens/t02-tankduel-desktop.png`.

**Timings I logged (ms from Fire).**

| Weapon | My shot resolves | Control back to me | Note |
|---|---|---|---|
| Sniper | 960 | 3,790 | Flat and fast. Over almost before you see it |
| Laser | 1,140 | 4,240 | Instant line across the screen, ignores wind and gravity |
| Homing missile | 1,480 | 5,700 | Bends toward the target late in flight. Mine still missed from a bad launch |
| Digger | 1,870 | 2,920 | Bores a narrow shaft |
| Big shot | 2,280 | 5,810 | Same arc as the basic shell, wider crater |
| Sand hog | 2,430 | 5,260 | Leaves a round tunnel under the surface |
| Nuke | 2,500 | 5,560 | Removed about a sixth of the map. See `screens/t02-tankduel-nuke-crater.png` |
| Triple spread | 2,790 | 5,510 | Three arcs fanning out |
| MIRV | 2,840 | 6,980 | Splits at the top into 4 that fall nearly straight down |
| Napalm | 2,900 | 5,940 | Fire pools low |
| Roller | 2,960 | 5,810 | Lands, then rolls downhill and pops in the valley |
| Bouncer | 3,170 | 6,520 | Two or three hops before it blows |
| Cluster bomb | 3,190 | 5,820 | Bursts mid air into 6 or so bomblets. See `screens/t02-tankduel-cluster-split.png` |
| Air strike | 4,160 | 8,200 | Marker shell, pause, then 4 bombs from the sky. Longest wait, best build up |
| Shield, repair, jump jets | about 550 | about 4,000 | Use the whole turn. Repair took me from 68 back to 100 |

So one full exchange (my shot, AI aim, AI shot) is 4 to 7 seconds plus my own aim time. The AI aims in about 1.2
seconds. That pace feels right. Nothing dragged.

**Wind.** Rolled once per round and held. The page explains why: the same wind next shot means your miss tells you
the fix. Wind was 6 to 8 in my rounds and it bent shots hard. The Moon map has no wind and low gravity.

**Terrain.** Smooth hills, real craters, tunnels. Tanks drop when the ground goes.

**Damage.** 100 health each. The AI's near misses cost me 3 to 5 each. Its closer hits cost 12 and 15. Damage falls
with distance from the blast centre. I never landed a hit on the AI with blind fixed aim, across 53 turns.

**What I learned by playing badly.** In my second session I played a whole round on the phone layout with the
basic shell only, one fixed angle, and power swept from 60 to 100 in steps of 3. The round lasted 31 turns and 152
seconds. I never hit. The medium AI did 8 damage in its first 16 turns, then found the range and took the other 92
in the next 7, with hits of 19, 16 and 30. I lost 0 to 100. Four lessons:

1. With strong wind and no record of where the last shot landed, bracketing by feel is slow. The game shows a faint
   trail in flight but keeps no marker after impact.
2. A near miss that does 3 to 5 out of 100 makes the early round feel like nothing is happening.
3. The AI ranging in over time is a good pattern. It gives the player a window, then turns up the heat. But the
   swing from harmless to lethal was sudden and had no warning.
4. There is no round cap, so a round of misses has no floor. Two and a half minutes with no hit of my own was dull.

**Phone layout.** On a 393 x 727 viewport the battlefield is 381 x 214 pixels, under 30% of screen height. The HUD
takes the top fifth and the controls the bottom half. Step buttons are 44 px, Fire is 74 x 60, the power slider
track is 6 px tall. The weapon strip shows 3 and a half of 18 chips, with emoji icons and no names. Drag to aim on
the field works and sets angle and power in one move: one drag took me from 52 degrees and 62 power to 30 and 100,
which also shows how easy it is to overshoot. See `screens/t02-tankduel-phone-layout.png`.

### 3.2 BharathKumarRavichandran/pocket-tanks

Vanilla JS, one canvas, 1,030 lines. Two human players on one keyboard.

- **Flow.** Black title card with rules, Enter to start. 5 shots each, 4 moves each. End card shows both scores.
- **Controls.** A and D move 20 px, W and S swap weapon, J and L change angle by 1 degree (0 to 50 only), N and M
  change power (3 levels only), F fires, U hands over to the other player by hand.
- **Weapons.** Two. Single shot scores 15, missile scores 20. They differ in sprite and points only.
- **Terrain.** One hill from three random points. A hit paints a grey 12 px circle on it. Tanks do not react.
- **Shot time.** 0.3 to 2.0 seconds in my play. A high slow shot took 2.0 s and felt fine. The fast ones were over
  before I could follow them.
- **Feel.** With 3 power levels there are too few arcs to learn. The screen has no hit flash, no shake, no number
  popup. A hit just bumps the score. I scored 30 to 15 over 5 shots and felt nothing.
- **Bug that teaches.** Turn hand over is partly automatic and partly manual. I lost track of whose turn it was
  twice. Turn state must be loud and never manual.

### 3.3 AtlantaTeam/pocket-tanks

React UI around a canvas game, with a bot named after a film robot.

- **Flow.** Lands straight in battle. 5 shots each. Game over popup with winner and a restart button.
- **Controls.** Move the mouse over the field and the barrel follows it. Mouse wheel changes power. Click or Space
  fires. Arrow keys do the same. Ctrl plus arrows moves the tank 150 px (4 moves) or cycles weapons. Under the field:
  steppers for power and angle, a weapon dropdown, a moves stepper and a big round red Fire button.
  See `screens/t02-atlanta-clone-turn.png`.
- **Terrain.** Sand dunes from a height map. A 50 px blast lowers the ground. Tanks tilt to match the slope, which
  looks good.
- **Scoring.** A hit on the bot adds points. A hit on yourself gives points to the bot.
- **Bot.** It searches power and angle pairs by simulated shots until one hits, then adds a random error that
  shrinks with difficulty. In my run it took 8.8 seconds to answer, then hit me first try for 350 points. On its
  next turn it never fired and the match hung.
- **Feel.** Mouse aim is the nicest input of the three web games: zero taps to set angle. But a bot that waits
  9 seconds and then lands a perfect first shot is the worst of both worlds: slow and unfair.
- **Wind and bounce exist in code but are set to zero.** Walls bounce shells back into play, which is a neat
  rule: no shot is lost off screen.

---

## 4. Side by side

| Topic | Pocket Tanks | Castle Clashers | Tank Duel (web) |
|---|---|---|---|
| Goal | Most points after 10 shots each | Kill crew or wreck fort, 24 round cap | Drain 100 health, best of N rounds |
| Aim input | Angle steps plus power bar | One drag, release to fire | Drag on field, or steps plus slider |
| Aim preview | None | Short dotted line | Short arrow |
| Weapon pick | Draft 10 of 20, each single use | Unit is the weapon | 18 in a strip, limited ammo |
| Move | 4 short hops per match | Roll fort, fuel | Fuel per turn |
| Wind | None in classic | [?] not seen | Per round, shown, strong |
| Terrain | Dirt hill, add and remove | Flat ground, the fort is the terrain | Hills, craters, tunnels |
| Camera | Fixed, whole field | Fixed, landscape, both forts in view | Fixed |
| Turn length | 25 to 30 s per volley | About 12 to 15 s per turn | 4 to 7 s plus aim time |
| Match length | 5 to 8 min | About 5 min | 2 to 6 min per round |
| Progress | Buy weapon packs | Trophies, unit levels, fort tiers, Forge | None |
| Solo content | CPU duel, target practice | None, bots as fake PvP | AI at 3 levels |
| Money | One time unlock, no ads | Ads, gacha, premium units, timers | Free |

---

## 5. Top 25 lessons for Castle Protect

**Turn flow**

1. Keep a full exchange (player shot plus enemy shot) under 12 seconds, not counting player aim time. Tank Duel's
   4 to 7 seconds felt best.
2. The enemy must act within 1.5 seconds of getting the turn. Show a short "aiming" cue, then fire. A 9 second wait
   kills the mood.
3. Let big weapons take longer. A 4 second air strike felt better than a 1 second sniper shot because of the build
   up. Scale wait time with payoff.
4. Shots under about 1 second of flight are hard to read. Give fast shots a bright trail and a slow motion beat on
   impact.
5. Cap match length with a round limit and a scored finish. Castle Clashers uses 24 rounds. Without a cap a round of
   misses has no end.
6. Make whose turn it is loud: a banner, a colour shift, a sound. Never ask the player to pass the turn.

**Aiming and controls**

7. One drag should set both angle and power. It is the fastest input on touch.
8. Add a fine tune layer on top of the drag: step buttons or a slow drag zone. One drag alone overshoots.
9. Keep the last angle and power between turns. All good artillery games do.
10. Show where the last shot landed and the arc it took. Bracketing is the core skill and the player needs the data.
11. Hold wind steady for a whole round and show it as an arrow with a number. A miss then teaches the fix.
12. Put Fire where the resting thumb is, make it large, and keep it away from the aim zone.

**Weapons and units**

13. Weapons must differ by rule, not by number. Split, roll, dig, bounce, burn, seek, rain, build, heal.
14. Limited ammo or single use forces variety and makes each pick a small choice. Unlimited strong guns get spammed.
15. A pre battle draft from a random offer is a great minute of play. It makes each match feel new at no content
    cost.
16. Tie weapons to crew with faces. "The unit is the weapon" gives each shot a character and gives the foe a target
    to hunt.
17. Include teaching tools as weapons: a ranging shot that shows the arc, a practice range with no limits.
18. Support moves (shield, repair, jump) should cost the turn. That trade was the most interesting choice in Tank
    Duel.

**Terrain and forts**

19. Destruction is the reward. Every hit must change the picture: a crater, a fallen wall, a dropped unit.
20. Things should fall. Tanks sliding, units dropping a floor, towers tipping. Secondary motion after the blast is
    where the laughs come from.
21. Two win paths (crew or structure) keep choices open through the whole match.
22. Show the player's own fort in cutaway. Seeing your crew in their rooms makes defence matter.
23. A fort on wheels with a fuel budget brings back the Pocket Tanks move choice in castle form.

**Structure**

24. Menu to first shot in a few seconds. One setup card, no load screens.
25. Players love the core loop of these games and hate what is wrapped around it. The loop is proven. The wrapper
    is where we win.

---

## 6. Things we must do better

1. **Real solo content.** A hand built campaign with maps, missions and true bosses. Castle Clashers has none and
   Pocket Tanks has none. This is the largest gap in the whole category.
2. **Honest foes.** Our enemies are AI and say so. Give each enemy type a clear style, a tell and a weakness so
   beating them is a skill, not a stat check.
3. **Varied ground.** Hills, pits, water, bridges, caves, high and low forts. Flat side by side maps lead to one
   winning plan. Each map should favour different weapons.
4. **No single best plan.** Counter the "bore through the base" plan with foundations that resist digging, crew
   that repair, and missions with other goals (protect a unit, hit a moving target, survive N rounds).
5. **Aim help that respects skill.** A partial arc preview that grows with an upgrade or shrinks with difficulty,
   a ghost of the last shot, and an impact marker.
6. **A phone first layout.** The field should get at least 60% of the screen in landscape. Controls overlay the
   edges. Tank Duel gives the field under 30% on a phone.
7. **Readable weapons.** Icon, name and a five word hint on every weapon chip. Long press for a looping preview.
   No blind picks.
8. **Pinch zoom and a shot follow option.** Fixed cameras make everything tiny on phones. Zoom out on fire, ease
   back after.
9. **Fair basic gun.** The default shot should finish a round in about 8 to 10 good hits. Near misses that deal 3
   out of 100 drag rounds out.
10. **Stakes inside the match.** Health, crew loss and collapse give drama that a pure points game lacks. Keep
    points as a star rating on top, so both skill and survival count.
11. **Juice on every hit.** Screen shake, hit pause, debris, damage numbers, a crew reaction. The clones have none
    of it and feel flat even when you score.
12. **Growth with no timers and no pay walls.** Upgrades apply at once. No unit is locked behind money. No patch
    takes away what a player earned.
13. **An end game.** Daily challenge forts, a boss rush, a fort editor with a test range, harder map remixes.
    Castle Clashers runs dry once the fort is maxed.
14. **Free fort editing.** Let players rebuild and move rooms and crew at any time, and save several layouts.
15. **Replay and share.** Save the last shot as a short clip. Players ask for it and it costs no server.
16. **Stable and offline.** No network calls in the core loop. A crash never costs progress. Mid match state is
    saved every turn.
17. **Control options.** Left or right handed layout, movable Fire button, drag direction toggle, separate music
    and sound sliders. All are direct asks from reviews.
18. **A fast AI that can miss on purpose.** Pick a target error, then solve the shot directly. Never brute force
    search in the frame loop and never open with a perfect hit.

---

## 7. Open questions for someone with a phone

1. Pocket Tanks mobile: is there a wind option in current builds? What exactly does the drag gesture set?
2. Pocket Tanks: point values for a direct hit of the basic shot against a near miss.
3. Castle Clashers: does the player choose which unit fires each turn, or does it rotate?
4. Castle Clashers: what do the bonus rings grant, and how does the round cap tie break work?
5. Castle Clashers: is there a turn timer, and how long?
6. Castle Clashers: what hazards do later arenas add?

---

## 8. Sources

Played first hand:
- Tank Duel, https://tembrica.com/en/tank-duel (page text, FAQ and live play)
- https://github.com/BharathKumarRavichandran/pocket-tanks (code and live play)
- https://github.com/AtlantaTeam/pocket-tanks (code and live play of the game page)

Pocket Tanks:
- https://en.wikipedia.org/wiki/Pocket_Tanks
- https://www.blitwise.com/ptanks.html
- https://play.google.com/store/apps/details?id=com.blitwise.ptankshd&hl=en (listing and reviews)
- https://itch.io/t/3056516/ (a fan browser port's rules summary: 10 volleys, score by accuracy, self hits cost points)
- https://grokipedia.com/page/Pocket_Tanks (used with care, some claims conflict with other sources)
- Search result summaries of the Pocket Tanks fandom wiki and a speedrun.com weapon guide (pages blocked direct access)

Castle Clashers / Castle Busters:
- https://play.google.com/store/apps/details?id=com.epicoro.castleclashers&hl=en (listing and reviews)
- https://apps.apple.com/us/app/castle-clashers/id6746328263 (listing, events and reviews)
- https://castlebusters.com/ (official site: units, building, wheels, helper items, upgrading)
- https://friendlygamedev.com/game-reviews/castle-busters/ (round cap, win conditions, progression layers, ad placements)
- https://appmagic.rocks/blog/voodoo-new-big-three (timers, passes, events, scale)
- https://www.gamigion.com/castle-clashers-a-new-voodoo-game-rocking/ (monetisation critique)
- https://nextbiggames.com/2026/04/02/castle-clashers-by-voodoo-midcore-pvp-growth/
- https://gametrending.com/games/castle-busters/ (review sentiment summary)
- https://game-solver.com/castle-clashers/ (collected App Store reviews, including the bot and control layout reports)
- Store screenshots saved by a teammate in `screens/castle-clashers/`

Could not reach: strategywiki.org, pocket-tanks.fandom.com, tvtropes.org and speedrun.com all refused the headless
browser. YouTube gameplay was not watched.
