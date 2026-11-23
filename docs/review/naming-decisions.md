# Naming and voice: decisions

Two reviews ran apart: `naming-and-voice-review-fable.md` and `naming-and-voice-review-opus.md`. Both found the same thing. Most lines are fine on their own. What gives the game away is sameness: every Hob has a compound surname that states the job, every Rival has a rank plus two garden nouns, every bark puns on a trade, and every result reads like a log line.

This page lists what we change. Where the reviews differ, the choice and the reason are given. The Fable review is the base text for voice rules (its section 2) and copy rewrites (its section 4). Use the Opus review for the counts and the non-text list.

## Rules that bind all text

1. Voice and naming rules: Fable review, section 2, as written.
2. Ids in code, saves and content stay the same. Only display names change. Old saves keep working.
3. One string table, `content/text.json`, read by web, Android and iOS. Names and cards come only from content JSON. No app keeps its own copy of a name, a "Best vs" table or a silly-name list.
4. British spelling. Sentence case. "!" only for Bonk!, Thump!, Drop!, Snip! and Kettle Pop!.
5. "Fight", never "battle", on screen. "Kettle" on screen, "Heartkettle" only in the Almanac.

## Core terms

Keep: Castle Protect, Brickabrac, Hob, Flatteners, Baron Levelwell, Heartkettle, Knack, Plain Shot, Trick Shell, Doodad, the Rummage, Quick Pick, Pennant, Buttons, Rival, Habit, Couch Duel, Skirmish, Bonked, Squashed, Tumbled, Squall, Shove Off, Puff Up, Clean Sweep, Kettle Pop, Sir Pudge, Bobbin.

| Now | New | Why |
|---|---|---|
| Fatigue | The Creaks ("Creaks in 3", "The fort creaks.") | A house creaks; blocks do not get tired. The sound already plays |
| Battered (block) | Cracked | One word a child can see on the sprite |
| Dropped (Hob status) | Fell a floor | "Drop!" is the wall shout |
| Loophole buried | Dug in | Android and iOS already say it |
| Exposed | Open | One word per thing |
| Squall Pop | Blown Out | Too many "Pop" results |
| Siege Score | Score | |
| Cozy | Cosy | British spelling |
| Gusty (Android wind) | Full | Same word on all apps |
| Victory!, No shame in that. | Cut | Hype and comfort lines |

Sir Pudge stays: players know him, and the clash the Opus review found is small.

## Classes (display names)

| Now | New | Why |
|---|---|---|
| Delver | Digger | "Delve" is a known machine-writing word |
| Boinker | Bouncer | "Boink" is US slang for sex, and it collides with "Bonk". A bouncer is also a cricket ball that rears up |
| Sizzler | Stoker | Restaurant chain mark; a real trade |
| Peeper | Lookout | Unwanted second sense |
| Roles (Demolisher, Crew sniper...) | Breaks walls. Picks off Hobs. Hits a wide patch. Digs under. Goes round corners. Mends. | Say what the Hob does |

## Hobs in the build

| Now | New |
|---|---|
| Marge Dumpling | keep |
| Quill Needlesworth | Miss Quill |
| Jax Peppercorn | Jax Pepper |
| Grub Mudgett | keep |
| Bobbin Springheel | keep |
| Hetty Mortarboard | keep |
| Old Thumper Grumbleby | Old Thumper (everywhere, never "Thumper") |
| Nan Clatterpot | Nan |

Passives: Extra Shake to Fourth Stone, Extra Hop to One More Hop, Clatter Call to Dinner Bell. Hobs not yet in the build: Fable review table 3.4.

## Rivals in Region 1

Private Tuft, Lance Corporal Fernsby (Corporal Fernsby in 1-7, after his promotion), Corporal Dibber, Sergeant Posy Rake, Warden Snedd, Marshal Mowbray Trimm. "Skirmish Rival" becomes one of the named Rivals, picked by seed. Units: Hedger, Raker, Mower, Pitcher; Straw Stuffer becomes Dummy. Later Flatteners, Big Ethel and Little Ethel, and the council wings: Fable review table 3.9.

## Shots, Knacks, shells, Doodads

Take Fable review tables 3.5, 3.6 and 3.7 as written. Where the Opus review offered a different name, the Fable one wins for one reason: it names a real object (Darning Needle over Long Stitch, Molehill over Garden Rake). The ones in the v0.1 build:

| Now | New |
|---|---|
| Sunspear | Darning Needle |
| Bouncebean | Jumping Bean |
| Mendglob | Dollop |
| Rolypoly | Roly-Poly |
| Bubble Bonnet | Tea Cosy |
| Burrowbomb | Seed Potato |
| Skimmerstone | Ducks and Drakes |
| Scaldspill | Boiled Over |
| Drenchbarrel | Water Butt |
| Pudding Bomb | Suet Pudding |
| Marble Sack | Bag of Marbles |
| Sod Sack | Barrow Load |
| Quickhedge | Quickset |
| Crumblecake | Rock Cake |
| Candle Comet | Roman Candle |
| Clod Pot (stale web text) | Clodpot |

Apply only the rows whose items exist in `content/`; the rest go into the design docs.

## Places and levels

Crumblecrag to Crag End, Soggybottom Fen to Soggy Bottom Fen, Frostwhisker Peaks to Nithering Heights, Clankmouth Mines to Wheal Clank, Twin Puddings to Two Lumps, Moonbrick to Mossbrick. Level 1-9 "The Big One" becomes "Under the Roof". Chain Gang becomes Three on a Chain, Roller Derby becomes Ethel's Lane. Other later levels: turn a third of the stock-phrase titles into plain places or people's names when those regions are built.

## Copy

Use Fable review section 4 for every screen, checked against Opus review section 4. Fix the live bugs both found:

- "Left fired" and "Hit hob, 13 damage" in screen reader text: use the Hob's name and plain words.
- Title "You gave up" with "You gave up." under it.
- "Captive Bonked: you win!"
- "Nothing here needs a confirm.", "Grand Fort: phase 2", "Privacy: Data Not Collected.", "Rules core: wasm 0.2.0" on player screens.
- Shell cards: drop the Title Case "Best vs" tables on all three apps; show the content card line and a sentence-case "Good at" line from content.
- Couch Duel names: one list (Fable 3.12); cut Rolo, the food run, and names that clash with Hobs.
- Tagline "Stack it. Lob it. Un-flatten the Brickabrac." becomes "Keep Brickabrac lumpy."
- Results: on a loss Hetty gives a one-line verdict; on a win the Rival signs off. Win titles vary per Rival.
- Ship the Notice of Flattening on the level card and give each Region 1 Rival a taunt.

## Barks

Rewrite `assets/audio/barks.json` to the bark rules (Fable 2.2): one trade line in three at most, uneven counts, Hobs naming each other and the Rival, varied Bonked lines, "Lumpy forever!" only as the crew's win line. Fix the key "thumper" to "old_thumper". Give each Hob its own gibberish syllables.

## Play and look

In v0.1 now:

1. Home forts lopsided and different from every Rival fort (no shared grids).
2. Rival crews mixed per level; Hedger not in every level. Rival think time per Rival (Pudge slow, Snedd quick).
3. Rival Hobs use the Flattener caps or scarf colour, never your red hats.
4. Each Hob gets its own idle tempo and a random idle start offset.
5. Pennant "Win" goal worded per level ("Send Pudge home"), plus one map-specific goal per level.
6. Separate sound cues where one sound now covers many events (lid clang, buried thud, boss-phase horn); `squall` only for the storm.
7. Two banner looks at least: weather sign and Flattener notice.

Later, with the human artist: a Brickabrac skyline in place of the stock sun, world-styled blasts, the map drawn as a real place.
