# Naming and voice review (second reviewer)

Date: 2026-11-23. Scope: every name and line a player can see in Castle Protect, plus the look, sound and level data that read as made by a template. Read-only review. Sources: `content/*.json`, `content/levels/*.json`, `assets/audio/barks.json`, `assets/animations.json`, user strings in `apps/web/src`, `apps/android/app/src/main`, `apps/ios/CastleProtect`, `core/castle-core/src`, and design docs 00, 01, 03, 04, 05, 07. I also played level 1-1 on the live build (https://njarrar.github.io/CastleProtectLive/): title, battle, pause, give up, results, map.

The short verdict: the bones are good. The world hook (a fussy clan that wants the land flat) is fresh, the habit lines on Rival cards are the best copy in the game, and several names are genuinely funny (Gravel Sneeze, Nosy Goose, Pot Lid, Musical Chairs, Sir Pudge, Old Turnip). What makes it feel machine-made is not any one name. It is that almost every name is built with the same two or three moulds, every Hob talks only about its job, and the look and timing repeat with no seams. Fix the moulds and most of the "AI feel" goes.

---

## 1. Diagnosis: what makes this read as machine-written

### 1.1 The cozy compound surname, over and over

Every Hob has a first name plus a made-up surname glued from two English words. Of the 28 Hob surnames in doc 03, **20 are two-word compounds**: Needlesworth, Grumbleby, Skyward, Boulderbun, Brightspur, Peppercorn, Clatterpot, Hailstone, Chiselwick, Snoutworth, Springheel, Pebblewick, Bankshot, Wobblebottom, Toastwell, Picklewick, Mortarboard, Brasstack, Spyglass, Featherlight. The rest are pun suffixes (Popkin, Nippet, Plumley, Hootley, Tumm).

The same few suffixes do most of the work across Hobs and Rivals:

| Suffix | Names | Count |
|---|---|---|
| -wick | Chiselwick, Pebblewick, Picklewick, Turfwick, Flintwick (x2) | 6 |
| -well | Toastwell, Rakewell, Drainwell, Levelwell, Skatewell | 5 |
| -worth | Needlesworth, Snoutworth | 2 |
| -ley / -by | Plumley, Hootley, Grumbleby, Wetherby | 4 |

A human namer would hit "-wick" once and then avoid it. Six is a fingerprint.

### 1.2 Double puns: first name and surname tell the same joke

Many names say the job twice: **Quill Needlesworth** (pen, needle), **Ember Toastwell** (fire, toast), **Brine Picklewick** (brine, pickle), **Truffle Snoutworth** (pig, snout), **Fizz Popkin** (fizz, pop), **Grub Mudgett** (dirt, mud), **Sprocket** / **Rivet** / **Wick** as first names for metal and fire Hobs. When every part of a name is a pun, no part is a person.

### 1.3 Rank + first name + pun surname for every Rival

Of 31 named Rivals in doc 05, **28 follow "Title First Surname"**: Private Tuft Edgerly, Corporal Fernsby Clip, Lance Corporal Sod Turfwick, Sergeant Posy Rakewell, Warden Privet Snedd, Marshal Mowbray Trimm, Mason Cobbina Slate, Bosun Mopsy Gurgle, Purser Dribble Mackle, Chief Engineer Valva Stopcock, Auditor Columna Ledger, Sergeant Trueline Squareham, and so on. The Downs Rivals carry four garden puns each (Privet + Snedd, Mowbray + Trimm, Sod + Turfwick, Posy + Rakewell). Four-word Rival names also do not fit a phone banner: "Lance Corporal Sod Turfwick aims" is 33 characters.

### 1.4 Alliteration and stock phrases in shell names

- **Trick Shells:** 18 of 58 alliterate (Lid Lifter, Mole Mail, Sod Sack, Rubber Radish, Pinball Pea, Treacle Tart, Candle Comet, Static Sock, Soggy Sock, Tonic Teapot, Spyglass Sparrow, Copycat Crock, Cuckoo Clock, Lodestone Lump, Splashback Stone, Homecoming Hat, Sleepy Sapper, Well Wisher). Two end in "Sock".
- **Stock phrases reused as names:** 14 (Rug Pull, Special Delivery, Cold Shoulder, Storm in a Teacup, Puddle Jumper, Hot Potato, Heavy Gravy, Musical Chairs, Well Wisher, Barn Raising, Knock-Knock, Plumb Bob, Copycat, Smelling Salts). Some are great (Musical Chairs does exactly what it says). Some are just there because they were nearby (Cold Shoulder, Special Delivery).
- **Knacks:** 14 of 32 are single fused compounds (Sunspear, Glimmerjolt, Hailbasket, Burrowbomb, Skimmerstone, Clackerball, Scaldspill, Drenchbarrel, Shiverpuff, Clatterline...). "Noun+noun, one word" is the second mould.
- **Doodads:** 5 of 14 alliterate (Smelling Salts, Mole Mine, Spare Spring, Chimney Cough, Jester's Jingle).

### 1.5 One root word used for many things

- **"Clatter"**: Nan Clatterpot, her passive Clatter Call, the bench Knack Clatterline, Ironmaster Clatterby Bolt. 4 uses.
- **"Mole"**: Mole Mail, Mole Mine, Molehill Surprise. 3 uses, three different effects.
- **"Pot"**: Clodpot, Emberpot, Clatterpot, Pogo Pot, Hot Pot (Quirk and Knack), Pot Lid. 6 uses.
- **"Lump / Lumpy"**: First Lump, The Last Lump, Lodestone Lump, Lady Lump, Oak Lump, the Lump Tune, "Lumpy forever" in 3 win barks, "Lumpy, but exact", the intro panels. It has become a slogan instead of a joke.
- **"Extra"**: Extra Shake, Extra Hop (two of eight passives).
- **"Dame"**: Dame Flicka (your Hob) and Dame Scree (the region 2 boss).

### 1.6 Barks: one job, one joke, every line

`barks.json` has 144 subtitles for 8 Hobs. Each Hob is defined by a trade, and nearly every line is a pun on that trade:

- Marge (cook): 18 of 18 lines are about cooking ("In the oven it goes.", "Done to a turn.", "Golden brown.").
- Bobbin (cobbler): 13 of 18 are shoe words ("Laces tied!", "Off the toe!", "Right in the laces.", "My laces!", "Sole survivor!", "Just resting my soles...").
- Hetty (teacher): 15 of 18 are school words ("Full marks.", "Gold star.", "See me after.", "Class dismissed...").
- Jax (market): "Step right up!", "Roll up, roll up!", "Sold!", "No refunds!", "Sold... out...".

Other repeated shapes:

| Shape | Count | Examples |
|---|---|---|
| "Mind the X" / "Mind my X" | 7 | Mind the crust!, Mind the stall!, Mind the pans., Mind my pots!, Mind the boots!, Mind the mortar!, Mind out. |
| "My X!" when hit | 6 | My whiskers!, My pins!, My best pan!, My hat., My laces!, My good apron. |
| Bonked line ends in "..." | 21 of 24 | |
| Bonked line is about sleep or a meal | 11 of 24 | Just a little nap..., Night night..., Wake me for tea..., Wake me for supper..., Forty winks..., Feet up..., Mm. Nap. |
| "Lumpy forever" (win) | 3 | Marge, Thumper, Bobbin |
| "Told you (so)" | 3 | Nan twice, Thumper once |
| Line ends in "!" | 43 of 144 | |

Nobody ever names the Rival, the kettle, a teammate, or what just happened. The lines could be shuffled between battles and levels without anyone noticing. That is the core AI tell: lines written from a character sheet, not from a moment.

The Hob-speak sounds share one syllable pool too ("bo", "mum", "nok", "bim", "tat", "pip" across all 8 Hobs), so the gibberish under the subtitles sounds like one voice with eight hats.

### 1.7 Level titles: stock-phrase puns

Of the 40 launch level names in doc 05, **13 are stock phrases or set-phrase puns**: Rummage Sale, The Big One, Roof Trouble, Shelf Life, Ferry Cross, High Tide Low Tide, Pump Number Nine, Flat Out, Roller Derby, Stamp Duty, Chain Gang, Full Bellows, Washing Day. Add the bookends (First Lump, The Last Lump, The Last Level) and "Lump" or "Level" sits in 4 titles. Several name the mechanic the level teaches (Rummage Sale teaches the Rummage) which reads like a tutorial label. The good ones are places: Over Loaf Hill, Kettle on the Knoll, Burp Hollow, Goat Track, Stilt Town, Echo Gorge, Hetty in a Jam.

### 1.8 UI copy: exclamation marks and log-speak

- Battle notes in `apps/web/src/core/real.ts`: about 16 of 38 short lines end in "!" (Threaded!, Tumble!, Drop!, Thump!, Puffed up!, Split!, Snip!, A turnip!, The shears!, Broke!, A bar broke!, Bounced off the lid!, Blast up the column!, The Crock wakes!, Big Smoothie Jr. rolls out!, Fatigue! Battered blocks give way). The rest are flat log lines (Walked, Mended, Rebuilt, Climbed back in, The fort sank, The roller is done). Two registers, both generic.
- Results: the live game shows **"You gave up"** as the title and **"You gave up."** as the cause line right under it. The loss cause line is built like a debug log: "Your kettle popped. The last blow: Pudge's Clodpot in round 6. Lost 4 blocks, 1 Hob Bonked."
- Shell inspect cards use strategy-game jargon in Title Case with ampersands: "Best vs: Walls & Crew", "Dense Fort Clusters", "Walled Courtyards", "Wide Roofs & Shelters", "Stacked Towers & Lids", "Earth Mound", "Utility", "Delayed Blast". Android falls back to "Tactical shell." These are the most machine-sounding strings in the build.
- Android has a three-beat tagline: "Stack it. Lob it. Un-flatten the Brickabrac." Three short imperatives is a template, and "the Brickabrac" uses a wrong article.
- Shouting buttons, mixed: FIGHT, START, REMATCH, SHOVE OFF, REAR, but "Same again", "Retry", "Next".
- Store-label speak: "Privacy: Data Not Collected." and "Nothing here needs a confirm."
- The screen reader says "Left fired" for the player's shot (side name, not Hob name) and "Hit hob, 7 damage" (lower case Hob).
- Platforms disagree: a web loss by Clean Sweep is "Swept", iOS is "Swept clean", Android is "Every Hob was Bonked."; Android's default win title is the generic "Victory". The web map button says "2 Players" while the mode is "Couch Duel".
- Pennant goals repeat: "No Hob of yours Bonked" in 4 of 10 levels, "Your kettle above 60%" twice, "Land N hits in a row" twice.
- "Fatigue" is a new system (live: "Round 7/8 Fatigue in 3") with a clinical stats-game name that is in no glossary and matches nothing else in the world.

### 1.9 What is already right (keep this voice)

- Rival habits: "Shoots wide first. Then a bit closer." "Forgets the wind on his first shot of each front." "Grabs the biggest shell in the Rummage." Short, specific, a little sly, and true in play.
- Shell cards: "Lob a pot. It goes boom." "Two hops, then pop." "Dud. It is a turnip." "Bends toward a Hob it can see."
- Story panels in doc 05: "Brickabrac. Lumpy. Proud of it." / "I counted wrong. On purpose." / "Rather lumpy. Well done." These have timing and a person behind them.
- "{Rival} dozed off!" as a win title for Sir Pudge, and the Baron's tea backstory.

---

## 2. Principles for an authored voice

1. **One joke per name, at most.** If the first name is a pun, the surname is a plain real surname (Darby, Prosser, Hollis, Mabbs). If the surname is the joke, the first name is plain.
2. **Prefer real words that happen to fit** over made-up compounds. Mowbray, Snedd, Dibble, Mudgett and Clodpot are real words or surnames with a hint. That reads as found, not generated.
3. **Ban list for new names:** the suffixes -wick, -well, -worth, -ley, -kin; alliteration on both words; stock phrases unless the phrase is the exact effect (Musical Chairs, Pot Lid, Barn Raising); any root already used twice (Clatter, Mole, Pot, Lump, Extra).
4. **Vary the shape.** Some names are one word (Pudge, Tuft), some are a nickname (Old Thumper), some have a title, few have all three. No more than one Rival in four gets a rank title.
5. **Places over puns for level titles.** A level is a place you remember fighting at: Loaf Hill, the Knoll, Burp Hollow. Name the mechanic in the card, never in the title.
6. **Hobs react to the moment, not to their job.** At most one bark in three is a trade joke. The rest name the Rival, a teammate, the kettle, the wind, the last miss. Each Hob gets a want (Marge wants everyone fed, Quill wants it neat, Jax wants an audience, Grub wants quiet) and one verbal tic. Bonk lines are varied in mood: cross, proud, bargaining, sleepy, not all sleepy.
7. **Flatteners speak in paperwork.** Forms, notices, polite apologies, measurements. That is their voice and it is distinct from the Hobs. Use it in banners on Rival turns.
8. **UI copy is plain, sentence case, no ampersands.** One "!" per screen at most, saved for the big moments: Bonk!, Kettle Pop!, Drop!. Explanations never get "!".
9. **One fact, said once.** Never repeat the title in the body line.
10. **Same words on all three platforms.** Strings come from one table, not three hand-written copies.

---

## 3. Rename table

Keep means keep as is. "Drop surname in UI" means the Almanac can keep a full name but battle and menus use the short one.

### 3.1 Core terms (mostly keep)

| Term | Verdict | New | Reason |
|---|---|---|---|
| Castle Protect | Keep | | Plain, says the game |
| Brickabrac | Keep | | Real word with a twist; the hook depends on it |
| Hob | Keep | | Short, folk word, fits a 24 px read |
| Flatteners | Keep | | The whole story is in the word |
| The Unflattening | Keep | | Good campaign name |
| Baron Levelwell | Keep | | The one "-well" worth keeping; the villain's name is a pun by design. Remove "-well" everywhere else |
| Rival, Habit | Keep | | Clear |
| Knack | Keep | | Core and clear (see clash list) |
| Trick Shell | Keep | | Clear |
| Doodad | Keep | | Fun, kid-readable |
| The Rummage | Keep | | Fits the junk-shop world |
| Kettle, Heartkettle, Kettle Pop | Keep | | Best core term in the game |
| Bonk, Bonked, Snooze Balloon | Keep | | Core slapstick |
| Loophole, Nook | Keep | | Real castle words |
| Grand Fort | Keep | | Clear |
| Buttons | Keep | | Lovely currency |
| Pennants | Keep | | Clear |
| Tinker Tree, Workshop, Test Yard | Keep | | Clear |
| Sudden Squall, Squall in 3 | Keep | | Good, weather fits wind |
| Fatigue | Change | **Creak** ("Creaky in 3", "The fort creaks") | "Fatigue" is a stats word. Creak is a sound you hear, fits a wooden fort, and a creak sound is already in the SFX |
| Volley Points | Keep | | Clear enough |
| Cozy, Fair, Stubborn, Ironclad | Keep | | Good difficulty names. Note Ironclad is also a mode name; fine, they are linked |

### 3.2 Classes

| Class | Verdict | New | Reason |
|---|---|---|---|
| Lobber | Keep | | Says what it does |
| Zinger | Keep | | Fun, fast (minor clash, section 6) |
| Scatterjack | Keep | | Distinct shape, breaks the "-er" run |
| Delver | Keep | | Clear |
| Boinker | Change | **Hopper** | Too close to "Bonk"; "Boink" and "Bonk" both sound on hits and confuse kids reading fast |
| Sizzler | Change | **Stoker** | Sizzler is a restaurant trademark. Stoker is a real job, tends fires, fits steam |
| Patcher | Keep | | Clear |
| Peeper `[U2]` | Change | **Spotter** | "Peeper" carries a creepy meaning in English. Spotter is plain |

### 3.3 Launch player Hobs (in content now)

| Current | Verdict | New | Reason |
|---|---|---|---|
| Marge Dumpling | Keep | | Lead Hob, warm, one-word surname, one joke |
| Quill Needlesworth | Change | **Quill Darby** | Double pun and a "-worth". Quill carries the joke alone |
| Jax Peppercorn | Keep | | Plain first name, one joke |
| Grub Mudgett | Keep | | Mudgett is a real surname |
| Bobbin Springheel | Change | **Kit Springheel** | Bobbin is a sewing word (Quill's theme) on a cobbler, and the name of a well-known game hero (section 6). Springheel stays: it is a real folk name |
| Hetty Mortarboard | Keep | | Mortar (builder) plus mortarboard (teacher hat): a real double meaning that fits her |
| Old Thumper Grumbleby | Change | **Old Thumper** (no surname) | A nickname is the name. Matches the `thumper` bark key |
| Nan Clatterpot | Change | **Nan Prosser** | Fourth "Clatter" and a "pot". Nan is the joke |

Passives: keep Steady Hands, Thread the Needle, Broad Back, Ridgepole, Old Grudge, Extra Shake. Change **Extra Hop** to **Third Hop** (two "Extra"s; says the number). Change **Clatter Call** to **Dinner Bell** (matches her bark "Dinner bell! Get them, dears!" and frees "Clatter").

### 3.4 Other launch and update Hobs (docs only)

| Current | Verdict | New | Reason |
|---|---|---|---|
| Pip Skyward | Keep | | Short, one joke |
| Dame Flicka Brightspur | Change | **Flicka Brightspur** | Drop "Dame": the region 2 boss is Dame Scree |
| Fizz Popkin | Change | **Fizz Mallory** | Double pun |
| Truffle Snoutworth | Change | **Truffle Bagg** | Double pun, "-worth" |
| Skip Pebblewick | Change | **Skip Hennessy** | "-wick" |
| Ember Toastwell | Change | **Ember Cole** | Double pun, "-well". Cole is a quiet coal hint |
| Brine Picklewick | Change | **Brine Tully** | Double pun, "-wick" |
| Poultice Plumley | Keep | | Odd and specific; one "-ley" can stay |
| U1 to U3 Hobs | Apply rules | e.g. Petra Chiselwick to **Petra Cobb**, Echo Hootley to **Echo Fenn**, Tansy Featherlight to **Tansy Ward** | Same suffix and double-pun rules |

### 3.5 Rivals (levels in content now)

| Level | Current | New | Reason |
|---|---|---|---|
| 1-1 | Sir Pudge | Keep | Best Rival name; recurring gag (clash note in section 6) |
| 1-2 | Private Tuft Edgerly | **Private Tuft** | "Tuft" is funny on its own: a young private who is all hair. Edgerly adds a second garden pun and length |
| 1-3, 1-7 | Corporal Fernsby Clip | **Corporal Clip** | Short, banner fits |
| 1-4, 1-9 | Lance Corporal Sod Turfwick | **Ned Dibble** (no rank) | Four words, "-wick", and "Sod" is a mild British swear. Dibble is a real surname and a garden tool |
| 1-5, 1-8 | Sergeant Posy Rakewell | **Sergeant Posy Prout** | "-well". Posy stays |
| 1-6 | Warden Privet Snedd | **Warden Snedd** | Snedd is a real word (to trim branches); one joke is enough |
| 1-10 | Marshal Mowbray Trimm | **Marshal Mowbray** | Mowbray is a real surname with "mow" in it. Trimm doubles the joke |
| Skirmish | Skirmish Rival | Random from the Rival pool | "Skirmish Rival" is a placeholder the player sees |

Docs Rivals: apply the same rules. Strip ranks from at least two of every five; drop "-well" from Drainwell (Admiral **Dabney Drain**), Skatewell (**Twirla Skate**); Captain Rule Straightly, Sergeant Trueline Squareham and Auditor Columna Ledger are three of the same joke in one region; keep Ledger, rename the others to plain names with Flattener ranks (Captain **Hobday**, Sergeant **Penn**).

### 3.6 Enemy units

| Current | Verdict | New | Reason |
|---|---|---|---|
| Hedge Snipper | Change | **Clipper** | Short, a real job word |
| Rake Hand | Keep | | Plain, old word for a farm hand |
| Mower Minder | Change | **Mower** | Alliteration |
| Pebble Pitcher | Change | **Slinger** | Alliteration; a sling is what it carries |
| Straw Stuffer | Change | **Straw Dolly** | Alliteration; a corn dolly is a real country thing. "Scarecrow" is taken by a Doodad |
| Chiseler, Filler, Tamper, Pump Hand, Dredger | Keep | | Plain job words: this is the right mould |
| Plunger Pete | Keep | | One named unit is charming |
| Clerk Major, Roller Guard, Ruler Sniper | Keep | | Fit the Level Guard voice |
| Level Surveyor, Clipboard Clerk | Keep | | Fine |

### 3.7 Plain Shots

| Current | Verdict | New | Reason |
|---|---|---|---|
| Clodpot | Keep | | A real old word (a dolt) and a clay pot: perfect |
| Hatpin | Keep | | Real object |
| Gravel Sneeze | Keep | | Funniest name in the game |
| Nibbler | Keep | | Clear |
| Bouncebean | Keep | | Fine, fits a kid |
| Mendglob | Change | **Dollop** | The fused "verb+noun" mould. A dollop of mortar is a real phrase |
| Emberpot `[docs]` | Change | **Hot Coal** | Sixth "pot" |
| Peep Pip `[U2]` | Change | **Chalk Dart** | Matches the Spotter rename, says what it is |
| Extra Shake (variant name "Gravel Sneeze (Extra Shake)") | Keep | | |

### 3.8 Knacks (in content now)

| Current | Verdict | New | Reason |
|---|---|---|---|
| Grand Dumpling | Keep | | Marge in one name |
| Sunspear | Change | **Long Stitch** | Generic fantasy, and a famous place name in a fantasy series. Long Stitch fits Quill's sewing and the beam through a wall |
| Pepper Rain | Keep | | Clear, fits Jax |
| Burrowbomb | Keep | | Fused, but clear and the only "bomb" knack |
| Rolypoly | Keep | | A real kids' word for a woodlouse |
| Barn Raising | Keep | | Real idiom that is the effect |
| Tick-Tock Crock | Keep | | Rhyme earns its place: it sits and ticks |
| Pan Parade | Change | **Pots and Pans** | Alliteration; Nan shouting "Pots and pans!" is the bark |

Docs Knacks: rename Glimmerjolt, Shiverpuff, Scaldspill, Drenchbarrel to plain two-word things a Hob owns (e.g. **Bath Bucket** for Drenchbarrel, **Cold Breath** for Shiverpuff). Keep Anvil Bun, Chimney Drop, Knock-Knock, Hairline, Chalk Fan, Tattle Bell. Rename Clatterline (fifth Clatter) to **Rattle Line**.

### 3.9 Trick Shells (in content now)

| Current | Verdict | New | Reason |
|---|---|---|---|
| Pudding Bomb | Keep | | Clear and funny |
| Lid Lifter | Keep | | Alliterates, but says the effect; the column blast "lifts the lid" |
| Marble Sack | Change | **Bag of Marbles** | Plain phrase, and "lose your marbles" is a free joke |
| Nosy Goose | Keep | | Behaviour in the name |
| Mole Mail | Change | **Rabbit Hole** | Three "Mole"s. It goes in one side of the hill and out the other |
| Old Turnip | Keep | | Perfect dud |
| Rubber Radish | Keep | | Alliterates, but it is a bouncing vegetable and kids love it |
| Sod Sack | Change | **Mud Pie** | "Sod" is a mild swear in the UK; alliteration; a mud pie is what kids make |

Docs Trick Shells: drop one of the two "Sock"s (Static Sock to **Static Mitten**), cut Special Delivery and Cold Shoulder for plainer names (**Parcel Post**, **Frost Bite**), keep Dinner Gong, Grandfather Clod, Crumblecake, Hot Potato, Musical Chairs-style direct names.

### 3.10 Doodads

| Current | Verdict | New | Reason |
|---|---|---|---|
| Mend Bucket | Keep | | Clear |
| Pot Lid | Keep | | Best Doodad name |
| Coal Scuttle, Smelling Salts, Weathercock, Bellows, Musical Chairs, Jack Screws, Spare Spring, Chimney Cough, Lightning Rod, Scarecrow | Keep | | Real objects, each one does what it is |
| Mole Mine | Change | **Garden Rake** | Third "Mole". A hidden rake that whacks whoever steps near is pure slapstick and fits the Downs |
| Jester's Jingle | Change | **Raspberry** | Generic fantasy; blowing a raspberry wipes their aim, and kids get it |

### 3.11 Materials, statuses, states

| Current | Verdict | Reason |
|---|---|---|
| Wicker, Timber, Cobble, Brassbound, Footing, Moonbrick | Keep | Real, ordered, clear |
| Loam, Clay, Rock, Bedrock, Mud, Water | Keep | Real |
| Open, Dropped, Tumbled, Squashed, Bonked | Keep | Plain verbs |
| Burn, Soaked, Brittle, Rest | Keep | Plain |
| Fatigue | Change to **Creak** (see 3.1) | |

### 3.12 Places

| Current | Verdict | New | Reason |
|---|---|---|---|
| Puddingstone Downs | Keep | | A real rock name; perfect |
| Crumblecrag | Keep | | Fused, but sound-led and clear |
| Soggybottom Fen | Change | **Mardle Fen** | "Soggy bottom" is a famous TV baking catchphrase and a film band; it reads borrowed. Mardle is a real East Anglian word for a pond |
| The Flats | Keep | | Plain, and the joke is the villain's taste |
| Frostwhisker Peaks `[U2]` | Change | **The Icing** | Generic fantasy compound. "The Icing" ties to Puddingstone and the cake in the Baron's story |
| Clankmouth Mines `[U3]` | Keep | | Sound-led |
| Topiary Keep, Sanding Stair, Great Sump, Last Level, Glidehall, Stampmill | Keep | | Good boss forts |
| Hedge Box, Beanpole, Pancake | Keep | | Fine archetype names |

### 3.13 Levels

| Level | Current | Verdict | New | Reason |
|---|---|---|---|---|
| 1-1 | First Lump | Keep | | Bookends 4-9 |
| 1-2 | Two Hats | Keep | | Two towers, two hats |
| 1-3 | Kettle on the Knoll | Keep | | Place, and says the lesson softly |
| 1-4 | Breezy Tops | Keep | | Place |
| 1-5 | The Big One | Change | **Under the Thatch** | Generic. The Rival sits under a three-row roof |
| 1-6 | Roof Trouble | Change | **The Stamp Tower** | Stock phrase. The level has a named tower: use it |
| 1-7 | Hetty in a Jam | Keep | | Jam orchards plus trouble: earned pun |
| 1-8 | Rummage Sale | Change | **Jam Orchard** | Names the mechanic like a tutorial. The map is two orchards |
| 1-9 | Over Loaf Hill | Keep | | Best title |
| 1-10 | The Topiary Keep | Keep | | |
| d1 | Twin Puddings | Keep | | |
| d2 | Orchard Dip | Keep | | |
| 2-2 | Shelf Life | Change | **The Ledges** | Stock pun |
| 3-3 | Ferry Cross | Keep | | Place |
| 4-1 | Flat Out | Change | **First Plate** | Stock pun |
| 4-2 | Roller Derby | Change | **Big Smoothie** | Name the mini-boss |
| 4-3 | Stamp Duty | Change | **Stamp Yard** | A UK tax joke kids will not get |
| 4-4 | Chain Gang | Change | **Hills on Chains** | Prison meaning; the story image is better |
| 4-5 | Full Bellows | Keep | | Fine |
| 4-7 | Washing Day | Keep | | Ties to the washing-line story panel |
| Others | Keep | | Places and events already |

### 3.14 Modes and currencies

| Current | Verdict | Reason |
|---|---|---|
| The Unflattening, Skirmish, Couch Duel, Test Yard, Trials, Daily Dust-up, Long Siege, Ironclad, Baron Rush | Keep | All clear; Baron Rush is a fair nod to "boss rush" |
| "2 Players" (web map button) | Change to **Couch Duel** | One name per mode |
| Buttons, Pennants | Keep | |
| Siege Score | Keep | |

---

## 4. Before and after rewrites, by screen

### 4.1 Title and home

| Where | Before | After |
|---|---|---|
| Title footer (web) | Free forever. No ads. | Free. No ads. Nothing to buy. (same line on all three apps) |
| Android tagline | Stack it. Lob it. Un-flatten the Brickabrac. | Keep Brickabrac lumpy. |
| Resume | Carry on? / Resume / Leave it | Your fight is still on. / Carry on / Leave it |
| Modes: Couch Duel | Two players, one device. | Two of you, one screen. |
| Modes: Skirmish | One fight with a Rival. | One fight, your rules. |
| Modes: Test Yard | Try any shot. Endless uses. | Try any shot, as often as you like. |
| Modes: Workshop | Build your fort. | Build your fort. (keep) |
| Map button | 2 Players | Couch Duel |

### 4.2 Pre-battle and Rummage

| Before | After |
|---|---|
| The Rival wants this | Pudge has his eye on this. (use the Rival's short name) |
| Tap a shell to inspect, tap again to draft it. | Tap to look. Tap again to take it. |
| Nothing here needs a confirm. | (cut) |
| FIGHT / START / Finish & Fight | Fight (one word, sentence case, everywhere) |
| Rummage Draft | The Rummage |
| Their crew | Their crew (keep) |

### 4.3 Shell inspect card

| Before | After |
|---|---|
| Best vs: Walls & Crew | Good on: walls and Hobs |
| Best vs: Dense Fort Clusters | Good on: packed forts |
| Best vs: Walled Courtyards | Good on: rooms with a roof |
| Best vs: Wide Roofs & Shelters | Good on: wide roofs |
| Best vs: Stacked Towers & Lids | Good on: tall towers |
| Best vs: Loopholes & Exposed Hobs | Good on: Hobs in the window |
| Best vs: Stops Rollers (Dud) | It is a turnip. It does stop rollers. |
| Earth Mound / Utility / Delayed Blast | Makes a heap / Helps / Blows next turn |
| Best with: Lobber (No Rest, +10% dmg) | Lobbers fire it free and 10% harder |
| Tactical shell. (Android fallback) | (show the content card line; never a fallback) |
| Signature Knack (triggers a rest turn). | Big shot. Needs a rest after. |
| Unlimited plain shot. | Every turn, no limit. |

### 4.4 Battle banners and notes

| Before | After |
|---|---|
| Your turn / Sir Pudge aims | Keep. On Rival turns, rotate a Flattener line now and then: "Pudge files a form." "Clip measures twice." |
| New Weather Front: wind 3 | Wind turns: 3 to the right |
| Fatigue next round: hurt blocks hold less | Creaky next round. Cracked blocks will give. |
| Fatigue! Battered blocks give way | The fort creaks. Cracked blocks give way. |
| Round 7/8 Fatigue in 3 | Round 7/8 Creaks in 3 |
| Grand Fort: phase 2 | The hedges bristle. (one line per boss per phase) |
| Threaded! | Through the window! |
| Climbed back in / Walked / Mended / Rebuilt | Back in. / (no text, the fort moves) / Patched. / Back up. |
| Bounced off the lid! | Clang. Off the lid. |
| Blast up the column! | Up the stack. |
| A bar broke! | One bar down. |
| The hedge grew back | The hedge grows back. Hit the Sprinkler Root. |
| Screen reader: Left fired | Marge fires. |
| Screen reader: Hit hob, 7 damage | Hit Pudge's Hob, 7. |

Rule: keep "!" only for Bonk!, Kettle Pop!, Drop! and Snip!. Everything else is a calm line.

### 4.5 Results

| Case | Before | After |
|---|---|---|
| Win, Clean Sweep | Clean Sweep! | Clean sweep! |
| Win, Kettle Pop | Kettle Pop! | Kettle Pop! (keep) |
| Win in Squall | Squall Pop! | The storm finished it. |
| Win, Double Pop | Double Pop! + long rule paragraph | Both kettles blew. You had more left. |
| Win, rescue | Rescued! | Hetty's out! (name the captive) |
| Win, round cap | {Rival} dozed off! | Keep |
| Win, points | Won on points! | More of you left standing. |
| Win, Rival gives up | {Rival} gave up! | {Rival} waves a hanky. |
| Win, Volley | Won on Volley Points! | Top score. |
| Win, captive_bonked | Captive Bonked: you win! | Check this case: a win titled with your captive Bonked reads as a bug |
| Android win fallback | Victory | (remove; every case has a title) |
| Loss, sweep | Swept / Swept clean / Every Hob was Bonked. | Every Hob is up in a balloon. (one string, all apps) |
| Loss, kettle | Kettle popped | Your kettle blew its lid. |
| Loss, squall | Squalled | The storm got your kettle. |
| Loss, give up | Title "You gave up" + cause "You gave up." | Title: You called it a day. No cause line. |
| Loss cause | Your kettle popped. The last blow: Pudge's Clodpot in round 6. Lost 4 blocks, 1 Hob Bonked. | Pudge's Clodpot, round 6. Then the kettle went. (then the doc 07 cause line: "Your loft had one leg.") |
| Loss, no cause | A close one. | A close one. Nothing broke first. (keep, as doc 07 says) |
| Best shot | Best shot: Marge, 45.0 / 60, 38 dmg | Best shot: Marge, 38 off the wall. Angle 45, power 60. |
| Duel tally | Tonight: 2 : 1 | Tonight: Mabel 2, Otis 1 |

### 4.6 Pennant goals

| Before | After (vary per level) |
|---|---|
| No Hob of yours Bonked (x4) | 1-2: Nobody in a balloon / 1-4: Keep all three Hobs / 1-6: No balloons today / 1-9: Everyone home for tea |
| Your kettle above 60% (x2) | 1-5: Kettle still singing (60% or more) / 1-6: Keep the kettle warm (60%+) |
| Land 2 hits in a row | Two hits, back to back |
| Captive takes no damage | Not a scratch on Hetty |

### 4.7 Settings, workshop, errors

| Before | After |
|---|---|
| Privacy: Data Not Collected. | We collect nothing. Not even your name. |
| Your game saves on this device after every turn. | Keep |
| Blueprint Inspector | Fort check |
| Loophole fires right toward Rival | Windows face the Rival |
| Right side faces the rival / REAR | Front (Rival side) / Back |
| Fix the red problems before testing this fort | Fix the red blocks first. |
| Needs wall / Floating | Needs a wall / Nothing under it |
| That move did not go through, the game had a hiccup. (Android) vs Hiccup! Back to the start of the turn (iOS) | Hiccup. Back to the start of your turn. (all apps) |

### 4.8 Barks (by Hob)

Rule for every Hob: of six lines per event, keep at most two trade jokes; add lines that name the moment. The core can pass the Rival's short name, a teammate's name and whether the hit was on the kettle; subtitles can take `{rival}` and `{mate}`.

**Marge (warm cook, wants everyone fed)**

| Event | Before | After |
|---|---|---|
| picked | Kettle's on. / Ready, love. / Apron on. | Ready, love. / Who's hungry? / Me again? Lovely. |
| fire | In the oven it goes. / Mind the crust! / Hot pot coming. | Hot pot coming. / Here's your tea, {rival}. / Duck, dears. |
| hit_lands | That rose nicely. / Done to a turn. / Golden brown. | Done to a turn. / Seconds, {rival}? / Ooh, I felt that one land. |
| takes_hit | Oof. My good apron. / Oh, my hat! / Who slammed the door? | Oof. My good apron. / That was rude, {rival}. / I'm fine. I'm fine! |
| bonked | Save me a slice... / Just a little nap... / Night night... | Save me a slice. / Tell {mate} it's her turn to cook. / Well, that's done it. |
| win | Pudding for all! / Lumpy forever! / Seconds, anyone? | Pudding for all! / Everyone in, wash your hands. / Pack {rival} a sandwich. |

**Old Thumper (grumpy grandad, wants respect)**

| Event | Before | After |
|---|---|---|
| fire | Back in my day we threw harder. / Hup! / Mind out. | Back in my day we threw harder. / Watch this, whippersnapper. / Hup. |
| bonked | Wake me for tea... / Forty winks... / Bah. Night... | Bah. Lucky shot. / I let you have that one. / Fetch my stick. |
| win | Told you. The old way. / Hmph. Good. / Lumpy forever. Eh? | Told you. The old way. / Hmph. Not bad, {mate}. / Is it teatime? |

**Quill (fussy, exact, wants it neat)**

| Event | Before | After |
|---|---|---|
| hit_lands | Neat. / Threaded. / On the mark. | Neat. / Left a bit. No. Perfect. / That one's for the wall chart. |
| takes_hit | Tsk. A tear. / My pins! / Crooked! | Tsk. / That was not even aimed. / Who taught you to throw? |
| win | Neat and tidy. Our tidy. / Not a stitch out. / Lumpy, but exact. | Neat and tidy. Our tidy. / I counted. We hit more. / Can we go home now? |

**Jax (showman, wants a crowd)**

| Event | Before | After |
|---|---|---|
| hit_lands | Sold! / And the crowd goes wild! / Who wants more? | Sold! / Did everyone see that? / {mate}, are you watching? |
| bonked | Stall's shut... / Back after lunch... / Sold... out... | Sold out. / Tell them I was brilliant. / No refunds! |
| win | Sold! Sold! Sold! / Best show in Brickabrac! / Encore! | Best show in Brickabrac! / Same time tomorrow, {rival}? / Take a bow, Jax. |

**Nan (sharp granny, wants manners)**

| Event | Before | After |
|---|---|---|
| fire | Wash these after! / Catch, dear. / Mind the pans. | Catch, dear. / Pots and pans! / Elbows off the table, {rival}. |
| bonked | Wake me for supper... / Nan needs a sit... / Lids on, dears... | Nan needs a sit. / I'll be writing to your mother, {rival}. / Somebody fetch my shawl. |
| win | Told you so, dears. / Now wash up! / Supper's on me. | Told you so, dears. / Now say thank you. / {rival}, you can dry. |

**Grub (mumbler, wants quiet)**

| Event | Before | After |
|---|---|---|
| fire | Down we go. / Mm. Dig. / Hole. | Down we go. / Mm. / Shh. |
| bonked | Mm. Nap. / Dark. Nice... / Mmm... | Mm. Fair. / Bury me here. / Wake me when it's quiet. |
| win | Mm. Behind me. / Heh. Heh. / Good hole. | Good hole. / Heh. / Mm. Can I go back down? |

**Kit (was Bobbin; bouncy cobbler, wants to show off)**

| Event | Before | After |
|---|---|---|
| hit_lands | Right in the laces. / Heel and toe! / Bounced it! | Bounced it! / Two hops, {rival}! Two! / Did it hop? It hopped. |
| takes_hit | Mind the boots! / Whoops-a-daisy! / My laces! | Whoops-a-daisy! / Not the boots! / Ow. Ow. Still bouncing. |
| bonked | Feet up... / Just resting my soles... / Boing... zzz... | Just resting my soles. / Up I go, then. / Wave for me, {mate}! |

**Hetty (dry builder, the clan's voice in story)**

The bark set makes her a schoolteacher, but doc 05 makes her the clan's builder and a dry voice. Pick the builder.

| Event | Before | After |
|---|---|---|
| picked | Sit up straight. / Ready. Pay attention. / Trowel out. | Trowel out. / Right. Who broke what? / I'll fix it. I always fix it. |
| hit_lands | Full marks. / Gold star. / That is how it is done. | That is how it is done. / Their roof was rubbish anyway. / Tidy. |
| bonked | Class dismissed... / Mark my place... / Nobody moves... | Nobody touch my wall. / I'll be back. Leave the mortar. / Fine. Somebody else build. |

---

## 5. Non-text elements that feel templated, and fixes

| # | What | Evidence | Fix |
|---|---|---|---|
| 1 | **Your fort and the Rival's fort are the same fort.** | `bp_home_3` and `bp_r1_timber_3` have identical rows; `bp_home_4` and `bp_r1_orchard` are identical; `bp_r1_box_wicker` is `bp_home_3` in Wicker. Seven of 17 blueprints use the same `t11t22t / tKKt33t` grid with left-right mirrored rooms. Doc 04 says the Neat Brigade is "low, neat, symmetric", but your clan's forts should be crooked | Make home forts lopsided (a lean-to, an off-centre chimney, one tall nook). Give every Rival fort its own silhouette even in Region 1: hedge caps, a rake rack, a mown stripe. Keep the symmetry only for the Flatteners and make it a joke |
| 2 | **Level ground is a smooth spline with a dip in the middle.** | 10 of 12 maps have their low point or main hill between x 800 and 1250; 5 pads sit at exactly x 420; d1 is a mirror by design and d2 is two dead-flat plateaus at y 336 around a centre hump. All coords are round tens. In play the hill reads as one clean wave with flat brown fill and a yellow under-layer | Hand-place one odd feature per map: a lone boulder, a sheep pen, a ditch, a tree stump that stops rollers. Nudge pads off the grid. Break exact mirrors in Skirmish maps by a few cells and a prop so they feel found |
| 3 | **Same Rival crew everywhere.** | `hedge_snipper` is in all 10 Region 1 levels and both Skirmish maps. Aim is 1 or 2 in every level. Rival think time is a flat 1.0 s every turn | Give each Rival a crew mix that matches the habit. Vary think time by Rival (Pudge yawns 1.8 s; Snedd snaps in 0.6 s). Give each Rival one idle tell on its fort (Pudge's hat slides over his eyes) |
| 4 | **Identical animation timing for every Hob.** | `animations.json`: all 8 Hobs share exact ms per action (idle 400/400/400/400, fire 35/85/110/130, bonked 360/180/260/260). The idle is a metronome | Give each Hob a tempo: Grub idles slow (600 ms), Jax fast (280 ms), Thumper with a hitch. Offset each Hob's idle start at random so a crew never breathes in sync |
| 5 | **Rival crew reads as your crew.** | Live 1-1: the Rival Hobs wear the same red hats as yours. In the sprite sheet all Flatteners share one boxy grey body | Ship the flat caps on Rival turns now. Give each Flattener unit one big prop silhouette (shears, rake, mower) so 5 units do not read as one |
| 6 | **One banner style for everything.** | Weather, Squall, Creak, boss phase, Threaded, Pot Lid all use the same slate pill | Three banner kinds: weather (a hanging sign that swings), Flattener notices (a paper form with a stamp; "Notice of Flattening" is already in the docs), your crew's shouts (a speech bubble off the Hob) |
| 7 | **Sound cues reused for unrelated events.** | In `real.ts` the `thud` sound plays for 10 different notes (drop, fort sank, thump, lid bounce, buried, roller out, roller stop, roller done, shears jam, prop); `squall` plays for a new Weather Front and for a boss phase; `bonk` plays for Threaded | Give each frequent event its own cue: a lid "clang", a buried "thlup", a boss-phase horn. Keep `squall` only for the storm |
| 8 | **Bark gibberish shares one syllable pool.** | bo, mum, nok, bim, tat, pip, hoo across all 8 Hobs | Give each Hob two or three syllables nobody else uses (Grub only hums; Jax rolls his r's) |
| 9 | **Stock art motifs.** | Live battle: a big sun with a soft halo, identical round clouds, a starburst explosion, a gear icon for the Knack cog. Map: evenly spaced numbered circles on a dashed zigzag. Results: a cream card with a dashed "stitched" border | Swap the sun for a Brickabrac thing (a hill with a sleeping face on the skyline, as doc 05 says). Give blasts a world look: soot puffs, popped buttons, flying crockery. Draw the map as a real place: lanes, the stream, the Topiary Keep visible from the start |
| 10 | **Pennant sets read like a form.** | "Win" is the first goal on every level, and four levels repeat "No Hob of yours Bonked" | Keep "Win" but word it per level ("Send Pudge home"), and make one goal per level unique to its map |
| 11 | **Three apps, three wordings.** | Loss titles and errors differ across web, iOS and Android (section 4.5, 4.7) | One string table in `content/` (for example `content/text.json`) read by all three apps |
| 12 | **Placeholder text players can see.** | "Skirmish Rival" as a Rival name; "Box 1", "Box 2", "Map 1"; default duel names include "Lady Lump" and "Pudding" (more Lump) | Name every one: Skirmish picks a real Rival; Starter Box kits keep Oak, Stone Skirt, Reed Roof (good) |

---

## 6. Possible clashes with existing games or marks

Not legal advice. Each needs a store and trademark search before art and store copy are final (doc 00 already asks for one).

| Name | Clash | Risk | Suggestion |
|---|---|---|---|
| Sizzler (Class) | Sizzler restaurant chain, a registered mark | High | Rename (Stoker) |
| Knack (core term) | "Knack", a PlayStation game series | Medium | Keep as a common word in UI, but never as a logo or store keyword |
| Sunspear (Knack) | A well-known place in a fantasy book and TV series | Medium | Rename (Long Stitch) |
| Zinger (Class) | A famous fast-food burger mark | Low | Keep as a class word; avoid in store title |
| Sir Pudge (Rival) | Pudge is a famous hero in a big online battle game | Low to medium | Consider "Sir Podge" (a real dialect word for a fat lump) |
| Bobbin (Hob) | Bobbin Threadbare, hero of a classic adventure game | Medium | Rename (Kit) |
| Quill (Hob) | Quill, the mouse hero of a recent VR game series | Low | Keep; it is a common word |
| Jax (Hob) | Characters in two big fighting and online battle games | Low | Keep; common name |
| Fizz (Hob) | A champion in a big online battle game | Low | Keep or rename with the surname change |
| Old Thumper | Thumper, the rabbit in a famous animated film | Low | "Old Thumper" plus a grandad look is far enough; keep |
| Ironclad (mode and preset) | A character in a hit deck-building game, and a game studio name | Low | Keep as a common word |
| Soggybottom | A famous TV baking catchphrase and a film band name | Low, but reads borrowed | Rename (Mardle Fen) |
| Shiver / Frost peaks | A mountain range in a big online game is named "Shiverpeak" | Low | Avoid "Shiver" + "Peak"; use The Icing |
| Delver | A roguelike game title and a well-known trading card | Low | Keep as a class word |
| Brickabrac | Common word; used by some shops and toy brands | Low | Check store listings for "Brickabrac" games |
| Castle Protect | Generic; many "castle defense" titles | Low | Check the exact title in both app stores |

---

## Top 15 changes, in order

1. Stop the compound-surname mould: no -wick, -well, -worth; one joke per name (Quill Darby, Nan Prosser, Old Thumper with no surname).
2. Shorten Rivals to one joke and two words at most: Private Tuft, Corporal Clip, Ned Dibble, Sergeant Posy Prout, Warden Snedd, Marshal Mowbray.
3. Rewrite barks so two in three lines react to the moment and name the Rival or a mate; vary Bonk lines away from "nap..." and drop "Lumpy forever".
4. Make Rival forts look different from yours; break the identical `bp_home_3` / `bp_r1_timber_3` and `bp_home_4` / `bp_r1_orchard` pairs.
5. Give each Hob its own animation tempo and offset idles so a crew never moves in sync.
6. Rename Sizzler to Stoker and Sunspear to Long Stitch (clashes).
7. Rename Boinker to Hopper so "Boink" and "Bonk" stop colliding.
8. Free up overused roots: Mole Mail to Rabbit Hole, Mole Mine to Garden Rake, Clatter Call to Dinner Bell, Pan Parade to Pots and Pans.
9. Replace stock-phrase level titles with places: Under the Thatch, The Stamp Tower, Jam Orchard (and Shelf Life, Flat Out, Chain Gang, Stamp Duty in docs).
10. Rename Fatigue to Creak, with banners "Creaky in 3" and "The fort creaks."
11. Fix the results screen: no title repeated in the cause line; plain loss causes; one wording on all three apps; remove "Victory".
12. Rewrite shell card "Best vs" jargon into plain "Good on:" lines with no ampersands or Title Case.
13. Cut "!" from explanation banners; keep it for Bonk!, Kettle Pop!, Drop!, Snip!.
14. Give banners three looks (weather sign, Flattener form, crew bubble) and stop reusing `thud`, `squall` and `bonk` for unrelated events.
15. Move all player-facing text into one shared string table read by web, iOS and Android.
