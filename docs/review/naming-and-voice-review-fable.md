# Naming and voice review

Scope: every name and line a player can read in Castle Protect, plus the parts of play and layout that feel filled in from a template. Read-only review. No code or content was changed.

Sources read: `content/*.json`, `content/levels/*.json`, `assets/audio/barks.json`, all string literals in `apps/web/src`, `apps/android/app/src/main`, `apps/ios/CastleProtect`, the player-facing strings in `core/castle-core/src`, and design docs 00, 01, 03, 04, 05, 07. I also played the live web build (title, level 1-1 to Round 7, pause, give up, results, map, level card, Couch Duel setup, hand-off card, settings) and read the text in place.

Short verdict: the world idea is strong and is not generic. Lumpy against tidy, a villain who spilled his tea, forts with kettles. The best lines in the project are very good ("Dud. It is a turnip." "I have moved. Officially." "Fix your block. Or annoy theirs."). The problem is not quality line by line. It is sameness. One naming mould was used 60 times, one joke shape was used 144 times, and every list has three things in it. A reader feels a generator behind it even when each item is fine. The fix is mostly to cut and to vary, not to add more jokes.

---

## 1. What reads as machine-written, and why

### 1.1 The surname machine

Every Hob is `First name + compound surname that states the job`. All 28 of them.

| Hob | The job, said twice |
|---|---|
| Quill Needlesworth | pins, needles |
| Jax Peppercorn | fires Pepper Rain |
| Old Thumper Grumbleby | old, thumps, grumbles: three labels on one Hob |
| Nan Clatterpot | fires Pan Parade, passive Clatter Call |
| Ember Toastwell | fire, toast |
| Frostine Nippet | frost, nip |
| Brine Picklewick | brine, pickle |
| Poultice Plumley | a healer named after a dressing |
| Petra Chiselwick | "Petra" means stone, plus chisel |
| Lady Carom Bankshot | carom and bank shot are the same thing |
| Winkle Spyglass, Echo Hootley, Wick Glimmer, Rivet Brasstack, Sprocket Tumm, Skip Pebblewick, Truffle Snoutworth, Bartleby Boulderbun, Gus Wobblebottom, Tansy Featherlight | same shape |

Why it reads as generated:

- No real village has 28 people whose names all describe their work. Real places have one or two (the baker called Baker) and the rest are just Mudgett and Hobbs.
- The same few endings repeat. `-wick` five times (Chiselwick, Pebblewick, Picklewick, Turfwick, Flintwick). `-well` five times (Levelwell, Rakewell, Drainwell, Toastwell, Skatewell). `-worth` twice. `-ley` and `-by` four times (Plumley, Hootley, Grumbleby, Clatterby). These are the stock "sounds British" endings.
- First names are objects from the job too: Quill, Bobbin, Rivet, Sprocket, Wick, Ember, Brine, Poultice. So the reader gets the job from the class icon, the first name, the surname, the Knack name and the barks. Five tellings of one fact.
- Two first names do not match their own trade. Quill (a pen) is the tailor with pins. Bobbin (thread) is the cobbler. It looks like nobody checked them against each other.
- Jax is the odd one out in the other way. It sounds like a 2020s gamer tag next to Marge, Hetty and Nan.

The names that work are the ones that break the mould: **Grub Mudgett** (Mudgett is a real surname and sounds like one), **Nan**, **Old Thumper**, **Flintwick the Lesser** (it tells you there is a Greater), **Sir Pudge**, **Pedlar Tuppence**.

### 1.2 Rivals: rank plus garden noun plus garden noun

Region 1: Private **Tuft** **Edge**rly, Corporal **Fern**sby **Clip**, Lance Corporal **Sod** **Turf**wick, Sergeant **Posy** **Rake**well, Warden **Privet** Snedd, Marshal **Mow**bray **Trimm**.

- Six for six: title, plant, tool. After the second one the player can write the rest.
- The ranks rise one step per level, which is a tidy list, not a cast. And the order is wrong: a Lance Corporal (1-4) is below a Corporal (1-3). A British reader spots that at once.
- "Sod" is a mild swear word in British English. "Lance Corporal Sod" and the shell "Sod Sack" will get a smirk from UK parents. Your own doc asks for a name check; this is one to run.
- Lieutenants add invented first names with stock endings: Grind**ella**, Rim**elda**, Twirl**a**, Frost**ine**. Real names (Prudence, Mowbray, Dabney) read far better. Steward Prudence Plumb is the proof: two real words, one quiet joke.
- Wings are all `The + noun + army word`: The Neat Brigade, The Chisel Corps, The Drain Fleet, The Level Guard, The Rink Wardens. Grand Forts are all `The + adjective + noun`: The Topiary Keep, The Sanding Stair, The Great Sump, The Square Gate, The Last Level.
- Enemy crew are all `noun + doer`: Hedge Snipper, Rake Hand, Mower Minder, Pebble Pitcher, Straw Stuffer (and in `mock.ts`: Pot Hand, Spade Hand, Bounce Hand, Ember Hand, Clipboard Clerk). Three of five alliterate.

### 1.3 Compound-word pile-up

Two plain words pressed into one is the house style: Brickabrac, Heartkettle, Clodpot, Bouncebean, Mendglob, Emberpot, Burrowbomb, Rolypoly, Sunspear, Skimmerstone, Scaldspill, Drenchbarrel, Borelight, Tinderbug, Gritspitter, Quickhedge, Crumblecake, Glimmerjolt, Shiverpuff, Clackerball, Moonbrick, Crumblecrag, Soggybottom, Frostwhisker, Clankmouth, Scatterjack.

One or two of these give a world its flavour. Twenty-six make it sound like a name generator with the "whimsical" box ticked. The compounds also hide the good stuff. Next to them sit names that are just real things, and those are the best in the game: **Hatpin, Old Turnip, Pot Lid, Mend Bucket, Coal Scuttle, Smelling Salts, Weathercock, Musical Chairs, Jack Screws, Barn Raising, Brolly, Hot Potato, Special Delivery, Dinner Gong, Tea Service**. The Doodad list is the best-named set in the project for this reason.

### 1.4 Alliteration and rhyme used as a default

Pan Parade, Mole Mail, Mole Mine, Rubber Radish, Sod Sack, Soggy Sock, Static Sock, Treacle Tart, Tonic Teapot, Splashback Stone, Candle Comet, Copycat Crock, Tick-Tock Crock, Pinball Pea, Well Wisher, Bubble Bonnet, Jester's Jingle, Spare Spring, Chimney Cough, Spyglass Sparrow, Lodestone Lump, Sleepy Sapper, Homecoming Hat, Mower Minder, Pebble Pitcher, Straw Stuffer, Sudden Squall, Siege Score, Tinker Tree, Kind Clock, Daily Dust-up. Over thirty.

Some are real phrases and earn it (Treacle Tart, Well Wisher, Hot Potato). The rest read as "make it catchy". When a third of the list alliterates, none of it lands.

### 1.5 Food as the fallback for cute

The setting doc turned down "The Sugarcrust Realms" because sugar art ages fast and narrows the appeal. Food came back in anyway through the names: Marge Dumpling, Grand Dumpling, Duke Dumpling, Pudding Bomb, Puddingstone Downs, Twin Puddings, Winter Pudding, "Pudding for all!", Bartleby Boulderbun, Anvil Bun, Crumblecake, Treacle Tart, Cheese Wheel, Heavy Gravy, Hot Potato, Rubber Radish, Old Turnip, Pinball Pea, Bouncebean, and silly names Biscuit, Pudding, Crumpet, Scone, Muffin, Marmalade, Pickle, Noodle, Fig, Sprout. "Pudding" alone appears in seven places. It is the easy way to sound sweet, and it is why the world drifts toward a bakery when its real idea is kettles, hills and patched coats.

### 1.6 Barks: one pun shape, 144 times

`barks.json` is a perfect grid: 8 Hobs, 6 events, exactly 3 lines each, 40% chance on every minor event. Inside the grid each Hob has one trade and every line is a play on it.

- Marge: Kettle's on, Apron on, In the oven it goes, Mind the crust, Hot pot coming, That rose nicely, Done to a turn, Golden brown, Save me a slice, Pudding for all, Seconds anyone. Eleven of 18 lines are cooking.
- Bobbin: Best foot forward, Laces tied, Off the toe, Right in the laces, Heel and toe, Mind the boots, My laces, Feet up, Just resting my soles, **Sole survivor!** Ten of 18 are feet. "Sole survivor" is said on a win where the whole crew is standing, so it is a pun that does not even fit the moment.
- Quill: all sewing. Jax: all market stall. Hetty: all classroom. Nan says "dear" or "dears" in 7 of 18 lines.
- Every Bonked line ends in "..." and is a sleep joke. Four Hobs have a win line that is "Lumpy forever" with one word changed.

This is the clearest tell in the game: a character defined as a word list, not as a point of view. The proof is in the same file. **Grub** has almost no trade words ("Hole." "Good hole." "Dark. Nice...") and he is the funniest and most real Hob in the cast. **Old Thumper** is second ("Hear that? I did." "I felt that in my knees."). Both have an attitude. The others have a theme.

Stock phrases to cut on sight: "And the crowd goes wild!", "Step right up!" and "Show time!" (American fairground, not a British market), "Gold star." (US classroom), "Back in my day we threw harder.", "Here comes the big one!", "Sorry! Sorry. Not sorry." (a 2015 internet line), "Straight and true!", "Victory!".

### 1.7 Title Case and strategy-guide phrases

The shell detail card speaks a different language from the rest of the game:

- "Best vs: Loopholes & Exposed Hobs", "Walls & Crew", "Dense Fort Clusters", "Walled Courtyards", "Ground-Level Walls", "Wide Roofs & Shelters", "Stacked Towers & Lids", "Damaged Own Fort", "Stops Rollers (Dud)".
- "Signature Knack (triggers a rest turn).", "Unlimited plain shot.", "Tactical shell.", "Target: Own Fort", "Earth Mound", "Delayed Blast", "Utility", "Revive a Bonked teammate".
- "Blueprint Inspector", "Crew Seated", "Rummage Draft", "Finish & Fight", "Quick Modes".

Tells: Every Word Capped, "X & Y" pairs on nearly every row, and words from no one's mouth ("exposed", "clusters", "tactical", "signature", "utility", "teammate", "triggers"). The glossary word is "Open", not "Exposed". The glossary word is "Puff Up", not "Revive".

Worse, the three apps each have a different "Best vs" table for the same shells (`apps/web/src/ui/shellMeta.ts`, `apps/android/.../core/ContentInfo.kt`, `apps/ios/.../Core/ContentCatalog.swift`). Web says Sod Sack is best against "Loam Hills & Footing". Android says "Rollers & Distraction". iOS says "Valleys & Rear Walls". Three writers, none of them the game.

### 1.8 Over-explained help text

iOS Doodad text (`HudParts.swift`):

- "Clamps a sturdy iron Pot Lid over your Kettle or a Nook to block incoming blasts."
- "Sloshes mortar paste over up to 3 battered fort blocks to restore their HP."

Compare the content card for the same Doodads: "The first shell to hit that room bounces off." and "Mends 3 of your blocks, 45 HP each." The iOS lines open on a showy verb, stack adjectives ("sturdy iron"), and use manual words ("incoming", "restore"). They also say less. The content cards are the right voice. Use them everywhere.

### 1.9 Triplets and tidy symmetry in copy

- Android tagline: "Stack it. Lob it. Un-flatten the Brickabrac." Three beats, rising, the classic shape. It also says "the Brickabrac", which is wrong: Brickabrac is a place name.
- "Free forever. No ads. Nothing to buy." This one is a promise and it is true, so it can stay, but it is the third three-beat line on one screen.
- Lieutenant sheets in doc 04: "Quiet, precise, polite." "Cool, elegant, vain." "Loud, gruff, deaf." Each villain is three adjectives.
- "They gave up. No shame in that." A soothing tag nobody asked for.

### 1.10 Results and banners all on one rhythm

- Win titles: Clean Sweep! Kettle Pop! Squall Pop! Double Pop! Rescued! Won on points! Every one is two words and a shout.
- Loss titles: Swept, Kettle popped, Squalled, Flattened.
- The cause line is one sentence with three slots: "Your kettle popped. The last blow: {who}'s {shot} in round {n}. Lost {x} blocks, {y} Hobs Bonked." It reads like a log.
- Live, giving up on 1-1 shows the title "You gave up" and under it, in quote marks, "You gave up." The same words twice, the second time dressed as speech.
- Float words: Threaded! Tumble! Drop! Thump! Split! Snip! Broke! Puffed up! Twelve shouts of one or two words. When all of them shout, Bonk! and Kettle Pop! stop being special.
- Status lines I saw in play: "Hit hob, 13 damage", "Hit block, 24 damage", "Left fired", "Round 2. Sir Pudge aims". "hob" is lower case, "Left" is a side id that leaked, and the rest is a debug log.

### 1.11 Developer words on screen

Seen in the live build or in shipped strings: "Nothing here needs a confirm." (level card), "Blueprint Level fort", "Draft: pool 6, pick 2", "Round cap 8, then the Squall", "Grand Fort: phase 2", "Three phases. Watch the tell.", "Privacy: Data Not Collected." (the store label, caps and all), "Version 0.1. Rules core: wasm 0.2.0.", "Save counter", "Today's seed (2026-11-23).", "The rules core stopped", "Nook numbers must start at 1 with no gaps", "Block Budget 80 over 72", "S 100" (Steam), "Fat. 3" (Fatigue), "R" (Recall).

### 1.12 Three apps, three voices

Web says "fight", Android says "battle". A Squall loss is "Squalled" on web and "Blown over" on iOS. Round-cap win is "{rival} dozed off!" on web and "He dozed off!" on iOS. Generic win is "Victory" on Android. Retry is "Retry", "Try again", "Play again" and "Rematch". The Dug-in state is "Loophole buried" (web), "DUG IN" (Android), "Dug in: Shove Off first" (iOS). The silly-name lists differ on all three. The stale mock content in `apps/web/src/core/content.ts` still says "Clod Pot", "Bounce Bean", "Mend Glob" and gives Old Turnip the card "Heavy, low and mean." A player who moves between devices meets three games.

### 1.13 What is already good (do not touch)

- Rival Habits. "Shoots wide first. Then a bit closer." "Forgets the wind on his first shot of each front." "Slow to find his range. Starts over when you move." Plain, specific, useful. These are the model for all rule text.
- Shot cards in `content/shots.json`. "Lob a pot. It goes boom." "Two hops, then pop." "Sits and ticks. Blows next turn." "Dud. It is a turnip."
- Onboarding prompts in doc 07: "Drag to aim", "Bit more", "Bit less", "Also works", "Mind the wind", "Climbs back". Two or three plain words each. Nothing to fix.
- "Carry on?" / "Leave it". "Fix it" on the loss screen. "Tonight" over the duel score. "Good game, both of you." "The Rival wants this."
- Difficulty names: Cosy, Fair, Stubborn. Three words with a view of the world.
- Story beats in doc 05: Evenhand and the frog, the saucer with a tall lip, Pudge rolling downhill asleep, "I counted wrong. On purpose." This is real writing. None of it is in the build yet, which is the biggest gap of all (see 5.1).
- The "KEEP OFF THE GRASS" sign drawn in `render/draw.ts`.

---

## 2. Voice and naming guide

### 2.1 The world in four lines

Brickabrac is a lumpy bit of country that looks like the back roads of England and Wales did a hundred years ago: lanes, allotments, market day, a kettle always on. The Hobs who live there are small, round, stubborn and a bit vain about their hats. They are not soldiers. They are a cook, a seamstress, a stallholder, a ditch digger, a cobbler, a schoolmistress, somebody's nan and an old man who has thrown things at hedges for sixty years. They fight because someone wants to iron their hill.

### 2.2 Who the Hobs are and how they talk

- They talk like people at a village fete when the marquee blows down: short, dry, more put out than scared.
- They understate. A fort falling in is "a bit of a draught". A direct hit is "Well. That's the roof."
- They grumble at each other more than at the enemy.
- They are never cruel and never grand. No war cries, no "for glory".
- Each Hob has **an attitude first and a trade second**. Marge fusses over everyone. Miss Quill cannot bear a crooked thing. Jax is always selling. Grub likes the dark and says so. Bobbin cannot stand still. Hetty is marking you. Nan has seen worse. Old Thumper thinks it was all better before.

Bark rules:

1. At most one line in three may use a word from the Hob's trade. The other two are about what just happened: the wind, the wall, the hat, the neighbour, the Rival by name.
2. No pun unless it is the true thing to say at that moment. "Who slammed the door?" from a cook whose fort just shook is right. "Sole survivor!" is not.
3. Let Hobs talk about each other. "Nan, duck." "That was Jax's wall." A cast is a set of people who know each other.
4. Uneven counts. Grub can have two lines for an event and one of them can be "...". Jax can have six. A full grid of threes is a spreadsheet.
5. Bonked lines need not all be sleep. Some Hobs are cross, some are polite about it.
6. Seven words at most. Contractions are fine. One "!" per Hob per event set, no more.
7. The crew motto "Lumpy forever!" is said by the crew together on a win. No single Hob gets a remix of it.

How the Flatteners talk: like a parish council letter. Polite, exact, sorry for the mess. "I have moved. Officially." and "That will need a form." are perfect. Keep that. They never gloat.

### 2.3 Naming rules

**People**

1. Mix the shapes. In any group of eight, aim for: two plain real names (Grub Mudgett), one title and name (Miss Quill, Nurse Plumley), one or two nicknames (Old Thumper, Tacks), one single name (Nan), one "the" name (Flintwick the Lesser), and **at most one** name that puns on the job (Marge Dumpling).
2. Use real surnames from the English and Welsh countryside. Mudgett, Hobbs, Pinnock, Popkin, Drake, Brine, Hailstone, Chandler, Bunn, Peake, Bottomley, Snedd. Many real ones are already funny.
3. First names from a village hall rota of 1925: Marge, Hetty, Edna, Walt, Stan, Dot, Alf, Ivy, Nell, Pru, Bert, Mabel, Otis, Enid. Not objects.
4. No invented endings: no -ella, -elda, -ine, -a tacked on a verb.
5. One of each trick. The Baron is the only "-well". If you want a "-wick", you get one in the whole game.
6. Vary length. One syllable next to four. "Nan" next to "Bartleby Bunn".
7. The UI shows short names. The long form lives in the Almanac, where it can carry one dry line ("Nan. Nobody recalls whose.").

**Things (shots, Doodads, blocks)**

1. First choice: a real object from a kitchen, shed, market or schoolroom, by its real name. Hatpin, Pot Lid, Darning Needle, Tea Cosy, Water Butt.
2. Second choice: a real phrase used straight. Barn Raising, Musical Chairs, Ducks and Drakes, Special Delivery.
3. A made-up compound is allowed only for core world words (Brickabrac, Heartkettle, Clodpot). Cap them at about one name in ten.
4. Alliteration only when the real name already has it.
5. No weapon words. The tone rule in doc 00 says so, and "bomb" and "mine" slipped in.
6. The card line is the joke. The name can be plain. "Old Turnip" is funny because of "Dud. It is a turnip."

**Places**

1. Real place-name parts: End, Bottom, Nether, Great and Little, Under, Top, Lane, Wheal (a Cornish mine), Heights.
2. Plain names for small places are best: Home Knoll, Loaf Hill, High Hill, Burp Hollow. Keep going like that.
3. One portmanteau region at most.

**Levels**

1. A third are plain places or events (Pump Number Nine, Kettle on the Knoll).
2. A third are named for a person (Hetty in a Jam, Evenhand's Mistake).
3. A third may be a stock phrase turned (Shelf Life, Stamp Duty). No more than that.

### 2.4 UI copy rules

1. Short, plain verbs. Fight, Fix it, Carry on, Leave it, Again, Map.
2. Sentence case everywhere. Capitals only for the game's own nouns (Hob, Knack, Nook, Squall).
3. One word per thing, on every platform. Fight (not battle). Dug in (not Loophole buried). Puff Up (not revive). Open (not exposed). Kettle in the UI, Heartkettle only in the Almanac.
4. No hype and no comfort. No "Victory!", no "No shame in that."
5. Say the number once, with no label if the icon carries it. "35" by a blast icon beats "35 Blast Damage".
6. No "&" pairs, no brackets, no colons in help lines if a full stop will do.
7. Errors are plain and say what is safe. No jokes in errors.
8. British spelling throughout. The build has "Colour set" and "Cozy" side by side. Use Cosy.
9. One string table shared by web, Android and iOS, with the content JSON as the only source for names and cards.
10. If a line could sit in any other game, cut it or make it about this one.

---

## 3. Rename table

Keep means keep as is. Display names can change without changing ids in code or save data.

### 3.1 Core terms

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Castle Protect (title) | Keep | | Known. The game says "fort" everywhere else, so show "The Unflattening" under the title as iOS does |
| Brickabrac | Keep | | The one portmanteau that is a real pun and the whole setting. Never "the Brickabrac" |
| Hob | Keep | | Real English folk word for a small house spirit, and a kettle sits on a hob. Could not be better |
| Flatteners | Keep | | Plain and clear |
| Baron Levelwell | Keep | | Core. Make his the only "-well" in the game |
| The Unflattening | Keep | | Odd, plain, memorable |
| Heartkettle | Keep, use less | "kettle" in all UI | The live UI already says "Your kettle popped". Heartkettle is the Almanac word |
| Stompers, Nook, Loophole, Footing, Kettle Room | Keep | | Plain and real |
| Knack | Keep | | Real word, right meaning |
| Plain Shot | Keep | | |
| Trick Shell | Keep | | Known. "Shell" is the one arms word; it is too deep to move |
| Dud | Keep | | |
| Doodad | Keep | | Known to the owner. It is the one American word in the set; "Gubbins" would be the British one if you ever want it |
| The Rummage | Keep | | Best term in the game. Stop also calling it "Draft" on screen |
| Quick Pick | Keep | | |
| Pennant, Buttons | Keep | | Buttons as money is a lovely homely touch |
| Rival, Habit | Keep | | |
| Grand Fort | Keep | | |
| Workshop, Blueprint, Test Yard, Tinker Tree | Keep | | |
| Couch Duel | Keep | | Known. The home screen button says "2 Players", which is clearer; keep both |
| Skirmish | Keep | | |
| Daily Dust-up | Keep | | "Dust-up" is good British |
| Starter Box, Kind Clock, Hand-off card | Keep | | |
| Clean Sweep, Kettle Pop, Double Pop | Keep | | |
| Squall Pop | Change | Blown Out | Four "Pop" results in a row. The Squall should sound like weather |
| Doze Off | Keep | "Dozed off" | Good joke, only works with the Rival's name: "Sir Pudge dozed off." |
| Volley Points | Keep | | |
| Siege Score | Change | Score | Nothing else in the UI says siege but the level type |
| Sudden Squall, Squall | Keep | | Real word, right size |
| Weather Front, Forecast | Keep | | |
| Fatigue | Change | The Creaks | Fatigue is a balance-sheet word and blocks do not get tired. The build already plays the "Timber creaks" sound when it starts. "Creaks in 3" reads at a glance and sounds like a house |
| Battered (block state) | Change | Cracked | "Hurt", "battered" and "damaged" are all used. Pick one a child can see on the sprite |
| Bonked | Keep | | Core and known. Note for the name check: "bonk" has a second, ruder sense in British slang. Mild, but run it past UK testers |
| Snooze Balloon | Keep | | |
| Squashed | Keep | | Funny and exact. "Squashed. Back up soon." |
| Tumbled | Keep | | |
| Dropped | Change | Fell a floor | "Drop!" is already the glossary shout for a wall collapse. The web build uses "Drop!" for a Hob too |
| Open (no Cover) | Keep | | Use it; stop writing "Exposed" |
| Loophole buried, Buried Loophole | Change | Dug in | Android and iOS already say it. Two short words |
| Shove Off | Keep | | Funny, and it is what you would say |
| Puff Up | Keep | | Drop "Revive" from the UI |
| Rest, Needs a rest | Keep | | |
| Thread, Threaded! | Keep | | |
| Thump, Crush | Keep | | |
| Steam, Steam Shot, Walk | Keep | | |
| Muster | Keep | | |
| Cover | Keep | | |
| Light, Medium, Heavy | Keep | | |
| Cozy, Fair, Stubborn | Change one | Cosy | British spelling, to match "Colour set" |
| Help: None, Some, Lots | Keep | | |
| Wind: Off, Light, Full | Keep | Android says "Gusty" for Full. Use "Full" | One word per thing |
| Knockout (win rule) | Keep | | |

### 3.2 Classes

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Lobber | Keep | | Real word |
| Zinger | Keep | | Fine. The only sound-word class once Boinker goes |
| Scatterjack | Keep | | The one odd-shaped class name; it gives the set texture |
| Delver | Change | Digger | "Delve" is the best-known machine-writing word there is, and no Hob would say it. Grub digs |
| Boinker | Change | Bouncer | "Boink" is slang for sex in US English. "Bouncer" is plain, and a bouncer is also a cricket ball that rears up, which is the shot |
| Sizzler | Change | Stoker | A real trade, and the world runs on kettles and steam. Classes are meant to be trades (doc 00) |
| Patcher | Keep | | |
| Peeper (U2) | Change | Lookout | "Peeper" has a second sense you do not want in a 9+ game |
| Roles: Demolisher, Crew sniper, Area, Underminer, Trick shots, Support | Change | Breaks walls. Picks off Hobs. Hits a wide patch. Digs under. Goes round corners. Mends. | The current six are genre labels. Say what the Hob does |

### 3.3 Hobs in the build

The UI already shows first names only, so surnames can change at no cost to players.

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Marge Dumpling | Keep | | The mascot. She is the one Hob allowed a job-pun surname |
| Quill Needlesworth | Change | Miss Quill | Fussy and exact: of course everyone calls her Miss Quill. New shape, drops a "-worth" |
| Jax Peppercorn | Change | Jax Pepper | Pepper is a real surname. Shorter, and Pepper Rain still lands. If you ever rename a first name, this is the one: "Jacko" fits the village better |
| Grub Mudgett | Keep | | Best name in the cast |
| Bobbin Springheel | Keep | | Springheel has real folk roots (Spring-heeled Jack). It earns its place |
| Hetty Mortarboard | Keep | | A two-way pun (builder's board, teacher's cap) that explains why the builder talks like a schoolmistress |
| Old Thumper Grumbleby | Change | Old Thumper | Three labels on one man. The nickname is enough. Use "Old Thumper" everywhere; the build shows "Thumper" in places |
| Nan Clatterpot | Change | Nan | Nobody's nan has a surname. Almanac line: "Nobody recalls whose." |

Passives: Steady Hands (keep), Thread the Needle (keep), Extra Shake (change to **Fourth Stone**: it adds a fourth stone), Broad Back (keep), Extra Hop (change to **One More Hop**), Ridgepole (keep, real word), Old Grudge (keep), Clatter Call (change to **Dinner Bell**: her own bark already calls it that).

### 3.4 Hobs not yet in the build

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Pip Skyward | Change | Young Pip | Pairs with Old Thumper, the other Lobber |
| Dame Flicka Brightspur | Change | Dame Flicka | A Dame is styled with her first name. Brightspur is stock fantasy |
| Fizz Popkin | Change | Ginger Popkin | Popkin is a real Welsh surname, keep it. "Fizz" plus "Pop" says it twice; "Ginger" (as in ginger beer) says it sideways |
| Truffle Snoutworth | Change | Truffle Hogg | One joke across two real words beats two jokes |
| Skip Pebblewick | Change | Skip Drake | His Knack is stone skipping, and the old name for that game is ducks and drakes |
| Ember Toastwell | Change | Edna Toast | A real first name and one funny plain surname |
| Brine Picklewick | Change | Walt Brine | Brine is a real surname. One hint is enough |
| Poultice Plumley | Change | Nurse Plumley | Title and real name |
| Gus Wobblebottom | Change | Gus Bottomley | Real surname, same joke at half the volume. Remove "Big Gus" and "Gus" from the silly-name lists |
| Rivet Brasstack | Change | Tacks Brassey | A nickname and a real surname |
| Frostine Nippet | Change | Aunty Nip | Invented "-ine" name. Family titles (Nan, Aunty) suit a clan |
| Dotty Hailstone | Keep | | Hailstone is a real English surname. It reads true |
| Winkle Spyglass | Change | Winkle Peake | Real surname, quiet joke |
| Echo Hootley | Change | Owl-Eyed Olive | A nickname-first shape the cast does not have yet |
| Tansy Featherlight | Change | Tansy Downe | Tansy is a real hedgerow name; keep it and lose the fantasy compound |
| Wick Glimmer | Change | Wick Chandler | A chandler made candles. Real trade surname |
| Bartleby Boulderbun | Change | Bartleby Bunn | Bunn is real. Long first name, short last |
| Sprocket Tumm | Change | Ernest Tumm | Tumm is great. Too many Hobs are named after parts |
| Lady Carom Bankshot | Change | Lady Carom | Says it once |
| Petra Chiselwick | Change | Petra Mason | Trade surname, drops a "-wick" |

### 3.5 Plain Shots and Knacks

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Clodpot | Keep | | Known, first shot a player sees, and close to "clodpoll", an old word for a fool. Fix the stale "Clod Pot" in `content.ts` |
| Hatpin | Keep | | Real object |
| Gravel Sneeze | Keep | | A picture, not a compound |
| Gravel Sneeze (Extra Shake) | Change | Gravel Sneeze, four stones | Brackets in a name |
| Nibbler | Keep | | |
| Bouncebean | Change | Jumping Bean | The real thing has a real name |
| Mendglob | Change | Dollop | "Glob" is American. "Dollop" is the British word and funnier. Keep the card: "Fix your block. Or annoy theirs." |
| Emberpot | Change | Hot Coal | Plain, and a Stoker would have one |
| Peep Pip (U2) | Change | Chalk Dart | The doc already describes it as "a fast chalk dart" |
| Grand Dumpling | Keep | | Marge's one pun |
| Tick-Tock Crock | Keep | | The rhyme is the sound it makes |
| Chimney Drop | Keep | | |
| Sunspear | Change | Darning Needle | Sunspear is from a different game. Miss Quill owns a long needle |
| Long Skewer | Keep | | |
| Pepper Rain | Keep | | |
| Pan Parade | Keep | | The picture is right: "Five pans walk across the wall." |
| Rising Fizz | Keep | | |
| Burrowbomb | Change | Seed Potato | "Bomb" breaks the no-weapons tone rule. You plant it and it comes up loud. Card: "Plant it deep. It comes up loud." |
| Molehill Surprise | Keep | | |
| Rolypoly | Change | Roly-Poly | Real word, real spelling |
| Skimmerstone | Change | Ducks and Drakes | The real name of the game |
| Scaldspill | Change | Boiled Over | What a kettle does |
| Drenchbarrel | Change | Water Butt | The real garden barrel. Nine-year-olds will also laugh |
| Barn Raising | Keep | | Best Knack name. Real folk custom, right meaning |
| Bubble Bonnet | Change | Tea Cosy | A real thing that covers and keeps safe |
| Child shots: Sneeze stone, Shake stone, Pepper stone, Pan, Marble, Turnip | Keep | | Plain |

### 3.6 Trick Shells

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Pudding Bomb | Change | Suet Pudding | Weapon word, and one pudding fewer. A suet pudding is the heavy one. Low priority if players are fond of it |
| Lid Lifter | Keep | | |
| Marble Sack | Change | Bag of Marbles | What a child calls it |
| Nosy Goose | Keep | | Best shell name |
| Mole Mail | Keep | | |
| Old Turnip | Keep | | |
| Rubber Radish | Keep | | Known from the start six; one alliteration is fine |
| Sod Sack | Change | Barrow Load | Drops the mild British swear and the alliteration. It is a barrow load of dirt |
| Quickhedge | Change | Quickset | The real word for a planted hedge |
| Cheese Wheel | Keep | | Real object |
| Crumblecake | Change | Rock Cake | The real hard bun |
| Candle Comet | Change | Roman Candle | The real firework |
| Trencher's Spoon | Keep | | Odd and specific |
| Soggy Sock | Change | Odd Sock | Everyone has one |
| Treacle Tart | Keep | | Real |
| Tonic Teapot | Change | Nan's Tonic | Ties a shell to a person |
| Splashback Stone | Change | Skimmer | Short |
| Heavy Gravy | Keep | | Funny as it is |
| Hot Potato | Keep | | |
| Brolly | Keep | | |
| Copycat Crock | Change | Copycat | One word does it |
| Gritspitter | Change | Grit Bin | The yellow box at the side of every British hill road |
| Special Delivery | Keep | | |
| Pinball Pea | Change | Dried Pea | A pea-shooter pea |
| Well Wisher | Keep | | Real phrase, good joke |
| Wick Runner | Keep | | |
| Tinderbug | Change | Tinderbox | Real object |
| Dinner Gong | Keep | | |
| Borelight | Change | Miner's Lamp | Real object |
| Grandfather Clod | Keep | | One clock pun is allowed |
| Update shells (28) | Review | | Run each through 2.3 before art. Flag now: Snailbomb (weapon word), Static Sock and Soggy Sock (two socks), Spyglass Sparrow, Lodestone Lump, Sleepy Sapper, Homecoming Hat (alliteration by habit) |

### 3.7 Doodads

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Mend Bucket, Pot Lid, Coal Scuttle, Smelling Salts, Weathercock, Bellows, Musical Chairs, Jack Screws, Spare Spring, Chimney Cough, Scarecrow, Lightning Rod | Keep | | Real things. This list is the standard for the rest |
| Mole Mine | Change | Molehill | Weapon word. A molehill you should not step on |
| Jester's Jingle | Change | Where Was I? | There are no jesters in Brickabrac. It makes the Rival lose its place, so name it that. A question is a new shape for a name |

### 3.8 Materials and ground

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Wicker, Timber, Cobble, Footing | Keep | | |
| Brassbound | Keep | | A real word |
| Moonbrick (U3) | Change | Mossbrick | Nothing else in this world comes from the moon. It heals itself each turn, and moss grows back |
| Loam, Clay, Rock, Bedrock, Mud, Water | Keep | | |

### 3.9 Flatteners

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Sir Pudge | Keep | | |
| Private Tuft Edgerly | Change | Private Tuft | Keep the word players have seen. One garden noun, not two |
| Corporal Fernsby Clip | Change | Lance Corporal Fernsby | Fernsby is a fine real-sounding name on its own. Fixes the rank order. When he comes back in 1-7 he is "Corporal Fernsby (acting)": he got promoted for caging Hetty |
| Lance Corporal Sod Turfwick | Change | Corporal Dibber | Drops "Sod" and a "-wick". A dibber is a real garden tool and a funny word |
| Sergeant Posy Rakewell | Change | Sergeant Posy Rake | Drops a "-well" |
| Warden Privet Snedd | Change | Warden Snedd | "Sned" is a real dialect word for lopping branches. It needs no help |
| Marshal Mowbray Trimm | Keep | | Mowbray is a real name with "mow" in it. The good kind of pun. The UI already shortens to Marshal Trimm |
| Skirmish Rival | Change | A Rival | Or pick one of the named Region 1 Rivals at random |
| Hedge Snipper, Rake Hand, Mower Minder, Pebble Pitcher | Change | Hedger, Raker, Mower, Pitcher | Real job nouns. The live HUD already cuts them to "Hedge" |
| Straw Stuffer | Change | Dummy | The Test Yard already calls it that |
| Dame Grindella Scree | Change | Dame Enid Scree | Real first name |
| Admiral Dabney Drainwell | Change | Admiral Dabney Sluice | Drops a "-well". Sluice is a real word and wetter |
| Steward Prudence Plumb | Keep | | The model |
| Clerk Tally Evenhand | Keep | | A tally clerk is a real job |
| Countess Rimelda Glaze | Change | Countess Glaze | Invented first name |
| Ironmaster Clatterby Bolt | Change | Ironmaster Josiah Bolt | A real ironmaster's name |
| Flintwick the Lesser | Keep | | The only "-wick" that stays |
| Bosun Mopsy Gurgle | Change | Bosun Gurgle | |
| Twirla Skatewell | Change | Miss Twirl | |
| Shift Boss Ratchet, Pedlar Tuppence | Keep | | |
| Big Smoothie, Big Smoothie Jr. | Change | Big Ethel, Little Ethel | A smoothie is a drink. Steam rollers and traction engines get women's names painted on the side. The Baron would name his after his mother |
| The Grand Roller, the Level Engine | Keep | | |
| The Neat Brigade and the other wings | Change | Parks and Verges; Steps and Slopes; the Drainage Board; Weights and Measures; the Rink Committee; the Stamp Office | The Flatteners send forms in triplicate. They are a council, not an army. This is a new joke the cast can use all game |
| The Topiary Keep, The Sanding Stair, The Great Sump, The Square Gate, The Last Level, The Glidehall, The Stampmill | Keep | | Fine one at a time; the wing change above breaks the "The X Y" run |
| "Notice of Flattening" | Keep | | Put it on screen (5.1) |

### 3.10 Places

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| Puddingstone Downs | Keep | | Puddingstone is a real rock from the Chilterns and "Downs" is real. The one pudding that should stay |
| Crumblecrag | Change | Crag End | Real place-name shape. The map chip already says "Crag" |
| Soggybottom Fen | Change | Soggy Bottom Fen | Just split it. "Bottom" is a real place-name word and the joke is an old British one |
| The Flats | Keep | | Best region name |
| Frostwhisker Peaks | Change | Nithering Heights | "Nithering" is Yorkshire for bitter cold. One good pun in place of a compound |
| Clankmouth Mines | Change | Wheal Clank | "Wheal" is what Cornish mines are called (Wheal Jane, Wheal Betsy) |
| Home Knoll, Loaf Hill, High Hill, Burp Hollow, Canary Row | Keep | | |
| Twin Puddings (map) | Change | Two Lumps | One pudding fewer, and "lump" is the game's own word |
| Orchard Dip (map) | Keep | | |
| Kits: Oak, Stone Skirt, Reed Roof | Keep | | Uneven on purpose, reads hand-made |
| Clan Knobble, "the Wobbly" | Keep | | |

### 3.11 Levels

| Current | Verdict | Proposed | Reason |
|---|---|---|---|
| First Lump, Two Hats, Kettle on the Knoll, Roof Trouble, Hetty in a Jam, Rummage Sale, Over Loaf Hill, The Topiary Keep | Keep | | Varied and plain. Region 1 titles are the model |
| Breezy Tops | Keep | | |
| The Big One | Change | Under the Roof | "The big one" is a stock phrase, and a bark already uses it. The level is about a roof you need a Knack to open |
| Chain Gang (4-4) | Change | Three on a Chain | The phrase has a grim history. Not for a 9+ game |
| Roller Derby (4-2) | Change | Ethel's Lane | Ties the level to a named thing |
| Flat Out, Cold Snap, Thin Ice, Wet Feet, Mind Your Head, Brass Tacks, Cart Before the Hob, Shelf Life, Stamp Duty | Keep half | | Fine alone. Regions 2 to 6 are about 60% stock phrases with the gimmick word in them. Turn a third into plain places or people's names, as 2.3 says. Pump Number Nine, Evenhand's Mistake and Burp Hollow show how |

### 3.12 Silly names for Couch Duel

Use one list on all platforms, built like Android's: Mabel, Otis, Pru, Bert, Dot, Alf, Ivy, Stan, Nell, Wilf, Ada, Clem, Hattie, Winnie, Bertie, Tilly, Lettie, Moss. Add a few with a handle so the dice still gets a laugh: Captain Crumb, Lady Lump, Granny Gale, Uncle Tug. Cut the food run (Biscuit, Pudding, Crumpet, Scone, Muffin, Marmalade, Pickle, Noodle, Fig, Sprout). Cut **Rolo** now: it is a sweet brand. Cut Gus, Pip and Duke Dumpling: they clash with Hobs.

---

## 4. Copy rewrites by screen

### 4.1 Title

| Before | After |
|---|---|
| Stack it. Lob it. Un-flatten the Brickabrac. (Android) | Keep Brickabrac lumpy. |
| Free forever. No ads. | Keep |
| Carry on? / Resume / Leave it (web) | Carry on? / Carry on / Leave it |
| Starts the first battle (iOS hint) | Starts your first fight |
| This build is missing its game engine and cannot start a battle. Please reinstall the app. | The game did not install properly. Please install it again. |

### 4.2 Map and modes

| Before | After |
|---|---|
| Modes: Skirmish against AI | Skirmish. One fight with a Rival. |
| Play one battle against the AI / One battle against the AI. | One fight with a Rival. |
| Rival (AI) | A Rival (the game plays it) |
| Test Yard: Try any shot. Endless uses. | Try any shot. They never run out. |
| Free-fire practice range with custom wind | Shoot at a dummy. Set your own wind. |
| Test Yard. Free fire, no round cap. | Test Yard. No rounds, no rush. |
| Build and save your own fort | Build your fort. |
| Quick Modes | Modes |
| Daily Dust-up, shared daily seed | Daily Dust-up. The same fight for everyone today. |
| Today's seed (2026-11-23). | Cut |
| Daily Done | Done today |
| Couch Duel: Two players, one device. | Keep |
| 2 players, 1 device. Free forever, no ads. | Two players, one device. |

### 4.3 Level card and the Rummage

| Before | After |
|---|---|
| Nothing here needs a confirm. | Cut |
| Same again | Same as last time |
| Blueprint Level fort | Fort: the level's own |
| Fort: Using your saved Workshop fort. | Fort: yours |
| 1 seat now, 5 at most | Crew of 1 |
| Round cap 8, then the Squall | 8 rounds, then the Squall |
| Round cap 8, highest total HP wins | 8 rounds. Then whoever has more left wins. |
| Draft: pool 6, pick 2 | Rummage: take 2 of 6 |
| Rummage Draft | The Rummage |
| Finish & Fight | Fight |
| Tap a shell to inspect, tap again to draft it. | Tap a shell to look. Tap again to take it. |
| Shows what it does / Tap again to take it | Keep |
| Your pick 1 of 2 | Your pick, 1 of 2 |
| Picks left are filled for you | Keep |
| Doodads none yet | Doodads: none yet |
| Your fort cannot take this crew ({why}). Using the level's fort. | Your fort has too few Nooks for this crew. You get the level's fort this time. |
| There is no level 1-12. | Cut the id: That level is not here yet. |
| Three phases. Watch the tell. | Hedges grow back while the Sprinkler Root stands. (the content line) |
| Rescue. Break the bars. | Guards the Cage. Shoots whoever shot last. (give 1-7 a real Habit) |

Pennant goals, same rules, said like a person:

| Before | After |
|---|---|
| Win | Win |
| Land 2 hits in a row | Two hits running |
| Win by Round 5 | Done by Round 5 |
| Bonk a Hob with each of your Hobs | Every Hob bags one |
| No Hob of yours Bonked | Nobody Bonked |
| Win by Kettle Pop | Pop his kettle |
| Your kettle above 50% | Kettle over half |
| Your kettle above 60% | Kettle barely scratched (and make the number 2 in 3) |
| Bonk a Hob with a Knack | A Knack does the Bonking |
| Captive takes no damage | Not a mark on Hetty |
| Free her by Round 6 | Out by Round 6 |
| Use both your Trick Shells | Fire both Trick Shells |
| Land hits from two different spots | Hit from two spots |
| The hill keeps over half its height | Save the hill |

### 4.4 Battle HUD and banners

| Before | After |
|---|---|
| Drag from your fort to aim | Drag back to aim |
| Ang ▲ / Ang ▼ / Pow + / Pow − | Keep the arrows, spell it once in the label: Angle, Power |
| R | A pin icon, label "Last aim" |
| S 100 | Steam 100 |
| Round 7/8 Fatigue in 3 | Round 7 of 8. Creaks in 3 |
| Fat. 3 | Creaks 3 |
| Fatigue next round: hurt blocks hold less | The Creaks start next round. Cracked blocks hold less. |
| Fatigue! Battered blocks give way | The Creaks! Cracked blocks let go. |
| Squall in 3 / Sudden Squall | Keep |
| Your turn / Sir Pudge aims | Keep |
| Left fired | Marge fired (use the Hob's name) |
| Hit hob, 13 damage | Hit Hedger for 13 |
| Hit block, 24 damage | Hit a wall for 24 |
| Missed. The shell left the field. | Over the hedge. Missed. |
| New Weather Front: wind 2 | Wind's changed: 2 |
| Grand Fort: phase 2 / The Grand Fort wakes up: phase 2. / The Grand Fort changes: phase 2 | Say what changed: "The hedges are growing back." "Little Ethel is out." "The shears are up." |
| Big Smoothie Jr. rolls out! | Here comes Little Ethel. |
| The roller rolls on / bumps to a stop / stopped / is done | Ethel rolls on. / Ethel's stuck. / Ethel's gone home. |
| The shears open: the red line is cut next turn | Shears open. They cut along the red line next turn. |
| Blast up the column! | Up the chimney! |
| A turnip! | It is a turnip. |
| The Crock wakes! | Ding. |
| Pot Lid on | Lid on |
| Loophole buried / DUG IN / Dug in: Shove Off first | Dug in. Shove Off first. |
| Shove Off (15 Steam): clear the buried Loophole | Shove Off: dig yourself out, 15 Steam |
| Walked | Cut |
| Threaded! Tumble! Split! Broke! | Keep the words, drop the "!" on all but Bonk!, Thump!, Drop! and Kettle Pop! |
| Tap an own fort block to mend, or drag to shoot | Tap one of your blocks to mend it. Or drag to shoot. |
| Tap up to 3 own blocks (or Use for auto) | Tap up to 3 of your blocks. Or just press Use. |
| Rebuild 4 / Revive | Rebuild 4 blocks, or Puff Up a Hob |
| Revive a Bonked teammate / No Bonked Hob to revive | Puff Up a Bonked Hob / Nobody to Puff Up |
| Using it is your Action for this turn. | This is your go for the turn. |
| You have already used this Doodad. | Used already. |
| That room is no longer standing. | That room is gone. |
| No open room left to lid. | No room left to lid. |
| You have acted this turn | You've had your go. |
| That Pin has faded | Keep |
| The rules core stopped | The game stopped. Try again. |
| Hiccup! Back to the start of the turn | Something slipped. Back to the start of your turn. |

Shell card:

| Before | After |
|---|---|
| Unlimited plain shot. | Plain Shot. Never runs out. |
| Signature Knack (triggers a rest turn). / Signature Hob Knack | Marge's Knack. She rests a turn after. |
| Tactical shell. | Cut |
| Any Hob can fire it. | Keep |
| Weight: Medium · 1 Rest Cog | Medium. Rest 1 turn. |
| Best with: Lobber (No Rest, +10% dmg) | Best with a Lobber: no Rest, hits 10% harder |
| Target: Own Fort | Aim it at your own fort |
| Earth Mound / Delayed Blast / Utility | Heap of dirt / Goes off next turn / cut |
| Damage: 1 (Dud) | Dud |
| Nothing (Decoy) | Nothing. It is a turnip. |
| Clamps a sturdy iron Pot Lid over your Kettle or a Nook to block incoming blasts. | The first shell to hit that room bounces off. |
| Sloshes mortar paste over up to 3 battered fort blocks to restore their HP. | Mends 3 of your blocks, 45 HP each. |

"Best vs" becomes "Good at", one sentence-case line per shot, the same on every platform, stored in `content/shots.json`:

| Shot | Before (web) | After |
|---|---|---|
| Clodpot | Walls & Crew | Good at: walls |
| Hatpin | Loopholes & Exposed Hobs | Good at: a Hob you can see through its Loophole |
| Gravel Sneeze | Wicker Roofs (2×) | Good at: Wicker and roofs |
| Nibbler | Soft Loam & Outer Walls | Good at: digging under |
| Jumping Bean | Walled Courtyards | Good at: getting over a hill |
| Dollop | Damaged Own Fort | Good at: your own cracked wall |
| Grand Dumpling | Low Row & Footing | Good at: the bottom row |
| Pepper Rain | Wide Roofs & Shelters | Good at: a wide roof |
| Old Turnip | Stops Rollers (Dud) | Good at: nothing. Rollers trip on it. |
| Barrow Load | Loam Hills & Footing | Good at: burying a Loophole |

### 4.5 Pause and hand-off

| Before | After |
|---|---|
| Win by Clean Sweep or Kettle Pop. | Bonk them all, or pop their kettle. |
| Give up this battle? / It ends here and counts as a loss. You still get the loss Buttons. | Give up? It counts as a loss. You still get the Buttons for trying. (the iOS line, everywhere) |
| Keep playing / Keep fighting | Keep fighting |
| The battle is saved at the start of every turn and when you leave. | Saved at the start of every turn. |
| Save and leave | Keep |
| Pass the device to / PLAYER 2 / READY | Hand it to / MABEL / Ready |
| New turn | Keep |
| Pass this turn? | Skip your go? |
| Start a new battle? The battle you left will be lost. | Start a new fight? The one you left will be gone. |

### 4.6 Results

| Before | After |
|---|---|
| Victory / Victory! | You win |
| Squall Pop! / The Squall did it! | Blown Out |
| Squalled / Blown over | Blown over |
| {rival} dozed off! / He dozed off! | Sir Pudge dozed off. |
| Captive Bonked: you win! | They Bonked the captive. You win. |
| They gave up. No shame in that. / You gave up. No shame in that. | They gave up. / You gave up. |
| Title "You gave up" with "You gave up." in quotes under it | Title only. Never repeat the title as the cause line |
| Your kettle popped. The last blow: Hedge's Clodpot in round 6. Lost 12 blocks, 1 Hob Bonked. | Hedger's Clodpot popped your kettle in Round 6. It cost you 12 blocks and Marge. |
| Every Hob of yours was Bonked. | They got everyone. Jax went last, Round 7. |
| The Squall finished your kettle. | The Squall took your kettle. |
| Out of rounds, and they had more left. | Out of rounds. They had more left standing. |
| Out of shots, and they scored more. | Out of shots. They scored more. |
| A close one. Nothing broke first. | Close. Nothing gave way first. |
| What broke you | Keep |
| Kettle lost 80   Blocks lost 12   Hobs Bonked 1 | Kettle 80. Blocks 12. Bonked: Marge. |
| Best shot: Marge, 45.0 / 60, 35 dmg | Best shot: Marge, 35 |
| Siege Score 310 to 240 | Score 310 to 240 |
| Blocks dropped / Blocks broken | Blocks broken (one term) |
| Retry / Try again / Play again / Rematch | Again (solo), Rematch (duel) |
| Back to the map / Map | Map |
| Both kettles popped in the same Squall round. The side with higher total HP before that round (kettle, Hobs, and standing blocks) wins. | Both kettles went in the same Squall round. Whoever had more left standing before it wins. |
| Wobbly, but standing. Try again? | Keep, but only when the fort is in fact still standing |
| Good game, both of you. / Tonight | Keep |

### 4.7 Workshop

| Before | After |
|---|---|
| Blueprint Inspector | Your fort |
| Crew Seated 3 / 3 | Nooks 3 of 3 |
| ✓ Saved · Ready to roll | Saved. Good to go. (rollers are the enemy's thing) |
| 2 issues to fix | 2 things to fix |
| Try this draft fort in the Test Yard without overwriting your saved fort | Try it in the Test Yard. Your saved fort is not touched. |
| Fix the red problems before testing this fort / Fix fort issues before opening Test Yard | Fix the red bits first. |
| Loophole fires right toward Rival | Shoots this way |
| Blocks & Rooms | Blocks and rooms |
| Not legal | Won't stand |
| Kettle Room must sit one block in from every outer face | Put a wall all the way round the Kettle Room. |
| Kettle Room must be walled / Nook 2 must be walled on all four sides | The Kettle Room needs four walls. / Nook 2 needs four walls. |
| Nook numbers must start at 1 with no gaps | Never show this; renumber for the player |
| Block Budget 80 over 72 | 8 blocks too many. |
| Footing only in row 0 | Footing goes on the bottom row. |
| No support / Floating | Nothing under it |
| Needs one kettle room | Needs a Kettle Room |

### 4.8 Settings and errors

| Before | After |
|---|---|
| Assists | Help |
| Access | Comfort |
| Cozy | Cosy |
| Quick Fire (lift to fire) / (lifting the finger fires) / (finger up fires) | Quick Fire: let go to shoot |
| Tap only (no hold to repeat) | Taps only, no holding |
| Subtitles / Sound captions / Subtitles for Hob-speak | Subtitles for Hob-speak |
| Privacy: Data Not Collected. | We collect nothing. |
| Version 0.1. Rules core: wasm 0.2.0. | Version 0.1 (rules 0.2.0) |
| Save counter | Cut |
| Type RESET to confirm. Settings are kept. | Keep |
| That move did not go through, the game had a hiccup. The battle is safe: please try again. | That did not go through. Nothing is lost. Try again. |
| The battle hit a problem the game could not recover from ({why}). It was set aside. | This fight broke and had to stop. Your progress is safe. |
| The game rules changed since this fight was saved, so it cannot be carried on. Your progress and Pennants are safe. | Keep. This is how an error should read |
| This saved fight replayed a little differently from when it was saved. | Keep |

### 4.9 Barks

Keep Grub and Old Thumper almost whole. For the rest, keep the best trade line per event and replace the others with lines about the moment.

| Hob, event | Before | After |
|---|---|---|
| Marge, picked | Kettle's on. / Ready, love. / Apron on. | Kettle's on. / Ready, love. / Go on, then. |
| Marge, fire | In the oven it goes. / Mind the crust! / Hot pot coming. | In the oven it goes. / Mind your heads. / This one's heavy. |
| Marge, hit lands | That rose nicely. / Done to a turn. / Golden brown. | That rose nicely. / Ooh, his hat. / Sorry, love. |
| Marge, takes hit | keep "Who slammed the door?" | add: That was my wall. |
| Marge, win | Pudding for all! / Lumpy forever! / Seconds, anyone? | Kettle's still on. / Who wants a cup? / Seconds, anyone? |
| Old Thumper, fire | Back in my day we threw harder. | We threw rocks. Proper ones. |
| Quill, picked | Measure twice. / Ready. Exactly. / Pins in. | Ready. Exactly. / Hold my hat straight. / At last. |
| Quill, hit lands | Neat. / Threaded. / On the mark. | Neat. / Threaded. / As I said. |
| Quill, bonked | Oh. A loose thread... / Hem me in... / Unpicked... | Unpicked... / Oh. How untidy. / My good side, too. |
| Jax, picked | Step right up! / Roll up, roll up! / Show time! | Roll up, roll up! / Any more for any more? / Who's first? |
| Jax, hit lands | Sold! / And the crowd goes wild! / Who wants more? | Sold! / Ta very much. / Mind your change. |
| Jax, bonked | keep "Back after lunch..." | Stall's shut... / Back after lunch... / Hold my float... |
| Nan, all | "dear" in 7 lines | "dear" in 2 lines at most |
| Nan, hit lands | Told you so. / Dinner bell! Get them, dears! / That'll teach them. | Told you so. / Elbows off the wall. / I've had worse. |
| Nan, takes hit | Mind my pots! / Rude, dear. / My best pan! | Rude. / Is that all? / My best pan! |
| Bobbin, picked | Best foot forward! / Laces tied! / Hop to it! | Me? Me! / Laces tied! / Can't stand still. |
| Bobbin, hit lands | Right in the laces. / Heel and toe! / Bounced it! | Bounced it! / Round the corner! / Did you see? |
| Bobbin, bonked | Feet up... / Just resting my soles... / Boing... zzz... | Feet up... / Boots off... / Oh. Down I go. |
| Bobbin, win | Sole survivor! / Three cheers and a hop! / Lumpy forever! | Three cheers and a hop! / Lucky boots. / Again! |
| Hetty, hit lands | Full marks. / Gold star. / That is how it is done. | Full marks. / See? / That is how it is done. |
| Hetty, takes hit | keep "See me after." | Who did that? / See me after. / That wall was new. |
| Crew, win (all) | four remixes of "Lumpy forever" | Lumpy forever! once, said by everyone |

Add a small set of lines where Hobs name each other. Six is enough to change the feel: "Nan, duck." (Marge) "That was Jax's wall." (Hetty) "Grub? Grub. He's fine." (Nan) "Nobody tell Miss Quill." (Jax) "Thumper's asleep." (Bobbin) "Mm. Loud lot." (Grub)

Flattener taunts in doc 04: keep "I have moved. Officially.", "That will need a form.", "Measured wrong. Measuring again.", "Close. Untidy, but close.", "Report back to base. Slowly.", "I shall file a complaint." Cut "Sorry! Sorry. Not sorry." and "Straight and true!" Use "Flat and finished." once, for the Baron only.

---

## 5. Play and layout that feel templated, and how to make them feel made

### 5.1 The best writing is not in the game

The docs hold a Notice of Flattening with a tea ring, a villain who spilled his tea, a clerk who feeds a frog, and a full set of Rival taunts. The live build shows none of it. In play the Rival never speaks. It is a name and a quote on a card. So what a player meets is the naming moulds without the heart behind them.

Fix: put three small things on screen before anything else. (1) The level card opens as a "Notice of Flattening" with the Rival's name signed at the foot and the Habit as the fine print. (2) Rival taunts, even six lines for Region 1. (3) The five-panel intro.

### 5.2 Your fort is as tidy as theirs

`content/blueprints.json`: the player's home fort `bp_home_3` and the Rival's `bp_r1_timber_3` are the same seven rows, cell for cell. `bp_home_4` and `bp_r1_orchard` are also identical. Every room in every fort is a 2 by 2 box on a strict grid.

The story is lumpy against tidy. The Flatteners' forts are meant to be "boxy, exact, every Nook the same size". Right now that describes the player's fort too. Make the home fort crooked: a room one block off line, a chimney, one Wicker patch in a Timber wall, a roof that does not reach the edge. Let the Rival boxes stay perfect. The player will feel the theme with no words at all.

### 5.3 The same three enemies in a new order

Region 1 Rival crews: Hedge Snipper appears in all ten levels. Levels 1-4, 1-5 and 1-7 field the same three units in a different order. Give each Rival one thing only they have: Private Tuft has a second hat he will not risk, Corporal Dibber's Raker always sits by the kettle, Sergeant Rake fields no Hedger at all. One odd choice per level reads as a person.

### 5.4 Pennant goals from a short menu

Slot 1 is "Win" on every level. Slots 2 and 3 come from five stock goals. "No Hob of yours Bonked" is used four times, "Your kettle above N%" three times with 50, 60, 60. Write at least one goal per level that could only be on that level: "Knock the tower down before the low room" (1-2), "Leave Loaf Hill standing" (1-9), "Never hit the Cage" (1-7). Keep the checks simple; change the framing.

### 5.5 The bark grid

Eight Hobs, six events, three lines, 40% everywhere. Break the grid as in 2.2: uneven counts, cross-talk, one Hob who says less. Let Grub stay silent half the time he is picked. Silence is a character trait too.

### 5.6 Results as a log line

One sentence with three slots, the same for every loss. Have a person give the verdict. On a loss, Hetty (the builder) says one line about the fort: "Kettle was one block from the wall." "Two Hobs on the top floor. Brave." The mock core already has "The kettle sat one block in.", which is the right idea. On a win, the Rival signs off in his own voice: "Filed under: lost. Private Tuft." Six lines per cause is plenty, picked by what really happened.

### 5.7 Every list has three things

Three Pennants, three bark lines, three kits, three difficulties, three wind settings, three help levels, three Squall rounds, three round lengths (10, 15, 20), three Volley lengths (6, 10, 14), three screen-shake steps. Any one of these is fine. All of them together is a pattern the eye picks up. Easy breaks: two kits plus "Yours", four round lengths, Volley 6 and 12 only.

### 5.8 Numbers on a ruler

Hob HP runs 80, 90, 100, 110, 120, 130, 140 with one Hob on almost every rung. Rewards are 250, 200, 80, 40, 25, 10. This is honest balance work and low priority, but where a number is only flavour let it be odd: 45 Buttons for a loss "for the kettle fund", 7 for a new Pennant. Odd numbers look chosen.

### 5.9 Rivals on a rank ladder

One rank up per level, from Private to Marshal, is a table, not an army. After the fix in 3.9, let the ladder wobble: Sir Pudge outranks them all and does nothing; Fernsby is promoted mid-region; the Warden is not in the army at all and resents being asked.

### 5.10 Villains built from one sheet

Each region is one biome, one tool-themed lieutenant with a title, one wing called "The X Y", one Grand Fort called "The X Y", and three adjectives. The beats in doc 05 already break this well (the Dame who says "good shot" and means it, the Steward who pockets a pebble). Go one step more: let one region have no proper lieutenant. Sir Pudge was sent to run the Fen by a filing error and the Admiral is cross about it.

### 5.11 Float words and banners all shout

Twelve one-word shouts in the same style and size. Keep the shout for the four that matter and set the rest in a small, quiet style. Then "Kettle Pop!" lands.

### 5.12 Two doom clocks that sound alike

"Squall in 3" and "Fatigue in 3" can both be on the HUD late in a fight. Two countdowns with the same shape read as system text. If both stay, make them unlike: the Squall is weather in the sky strip, the Creaks are a sound and a mark on your own walls.

### 5.13 Level titles after Region 1

Region 1 is varied. Regions 2 to 6 lean on "stock phrase with the gimmick word in it" for about 60% of titles. Apply the thirds rule in 2.3.

### 5.14 One game, three scripts

Set up one shared string file and one source for names and cards. Delete the stale names in `apps/web/src/core/content.ts`. This is the cheapest fix on the list and it removes a whole class of "who wrote this?" moments.

### 5.15 Small made-by-hand touches worth adding

- More signs like "KEEP OFF THE GRASS" on Rival lawns: "NO LUMPS", "LEVEL CROSSING" (their best joke, unused), "PLEASE QUEUE".
- A tea ring on every Flattener notice.
- The Almanac gives each Hob one dry line, not a stat blurb. "Grub Mudgett. Digs. Has opinions about soil."
- The default fort name "the Wobbly" shown on the results screen: "The Wobbly is still standing."
- Sir Pudge asleep somewhere on every region map.

---

## 6. Order of work

1. One string table for all three apps; fix "Left fired", "Hit hob", the doubled "You gave up", and "Nothing here needs a confirm."
2. Shell card text: cut the Title Case "Best vs" tables, use content cards.
3. Rewrite barks to the rules in 2.2.
4. Class renames (Digger, Bouncer, Stoker) and Fatigue to the Creaks, display names only.
5. Hob and Rival surnames.
6. Shot, shell and place renames, before any more art is made for them.
7. Crooked home fort, Notice of Flattening on the level card, Rival taunts.
8. Results verdict lines and level-specific Pennant goals.
