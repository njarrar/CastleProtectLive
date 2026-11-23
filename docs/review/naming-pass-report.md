# Naming pass: what changed

This is the report for the naming and voice pass. It follows `naming-decisions.md`. Ids in code, saves and content did not change. Only what a player reads changed.

## What was done

1. **Content names.** `content/classes.json`, `hobs.json` and `shots.json` carry the new display names, role lines, passive names and card lines.
2. **One string table.** `content/text.json` is new. It holds every line a player reads on web, Android and iOS. `content/text.md` explains keys and placeholders.
3. **Barks.** `assets/audio/barks.json` is rewritten to the bark rules.
4. **Design docs.** All eight docs in `docs/design` use the new names, for built and unbuilt things alike. The glossary in doc 00 has the new terms.

No app code, core code, level file, blueprint or tool was touched.

## Content names

| File | Change |
|---|---|
| classes | Delver to Digger, Boinker to Bouncer. Roles now say what the Hob does: "Breaks walls." "Picks off Hobs." "Hits a wide patch." "Digs under." "Goes round corners." "Mends." |
| hobs | Miss Quill, Jax Pepper, Old Thumper, Nan. Passives: Fourth Stone, One More Hop, Dinner Bell. Rival units: Hedger, Raker, Mower, Pitcher, Dummy |
| shots | Jumping Bean, Dollop, Darning Needle, Seed Potato, Roly-Poly, Suet Pudding, Bag of Marbles, Barrow Load, "Gravel Sneeze, four stones". Eleven card lines rewritten. The six best cards were left alone |
| doodads, materials, starter box | No change needed. Mend Bucket, Pot Lid, Wicker, Timber, Cobble, Footing, Oak, Stone Skirt and Reed Roof all stay |

Sizzler, Peeper and the later shells are not in `content/` yet. Their new names are in the design docs.

## The string table

Top-level groups in `content/text.json`:

`app`, `common`, `home`, `map`, `modes`, `setup`, `names`, `level_card`, `levels`, `pennants`, `rivals`, `hobs`, `rummage`, `shell_card`, `shots`, `hud`, `banners`, `notes`, `a11y`, `pause`, `handoff`, `results`, `workshop`, `settings`, `captions`, `errors`.

- Keys are dotted paths, such as `results.loss.title.kettle_pop`.
- Placeholders are plain words in curly braces: `{hob}`, `{rival}`, `{n}`.
- A list is a pool. Pick one line at random.
- Plurals use `one` and `other`.
- Keys that start with `_` are notes and are never shown.
- Sub-keys under `how`, `why`, `by`, `states` and `notes` are the ids the core sends.

What it holds that the apps did not have before:

- A Notice of Flattening for each Region 1 level, signed by its Rival.
- Taunts and a sign-off for each Region 1 Rival.
- A win title for each Region 1 level.
- A pool of one-line verdicts from Hetty for each way to lose.
- Goal wording for each Pennant type, and for each Region 1 level.
- A "Good at" line for every shot, in sentence case.
- Short names for Hobs, so that Old Thumper is never cut to "Old".
- One Couch Duel name list of 22 names.
- Screen-reader lines that use the Hob's name.

Live bugs fixed in the table: "Left fired", "Hit hob, 13 damage", the doubled "You gave up", "Captive Bonked: you win!", "Nothing here needs a confirm.", "Grand Fort: phase 2", "Privacy: Data Not Collected." and "Rules core: wasm 0.2.0".

## Barks

- The key `thumper` is now `old_thumper`. The sound ids still start `bark_thumper_`, because the sound files and `audio.json` use that name.
- Counts are uneven: two to six lines per event, where every event had three.
- Trade lines are under one in three for every Hob.
- Bonked lines are no longer all sleep jokes. Six of them still trail off; the rest are cross or polite.
- No single Hob says "Lumpy forever". It is a crew line under the new `crew.win` key.
- Two new optional fields: `with_mate` (lines that name another Hob, used only when that Hob is on the crew) and `with_rival` (lines with `{rival}`). Plain `subtitles` are safe in any fight. An optional `chance` lets Grub stay quiet when picked.

## Self-check counts

Content display strings (classes, hobs, shots, doodads, materials, starter box) plus barks:

| Check | Before | After |
|---|---|---|
| Em dash | 0 | 0 |
| "delve" or "Delver" | 1 | 0 |
| "Boinker" | 1 | 0 |
| "journey" | 0 | 0 |
| "Victory" | 0 | 0 |
| "battle" | 0 | 0 |
| "!" total | 47 | 5 |
| "!" outside the allowed shouts | 45 | 4 |
| Title Case lines | 4 | 3 |
| Names ending -wick | 0 | 0 |
| Names ending -well | 0 | 0 |
| Names ending -worth | 1 | 0 |
| Two-word names that alliterate | 14 | 9 |

The four "!" left are in barks, one per Hob per event at most, as the bark rules allow: "Roll up, roll up!", "Me? Me!", "Bounced it!", "Again!". The fifth is the crew line "Lumpy forever!".

The three Title Case lines left are names: Thread the Needle, One More Hop, Bag of Marbles.

The nine names that still alliterate were all kept by the rename tables: Broad Back, Lid Lifter, Mole Mail, Pan Parade, Rubber Radish, Reed Roof, Stone Skirt, Sneeze stone, Shake stone.

Barks alone:

| Check | Before | After |
|---|---|---|
| Lines | 144 | 174 |
| Lines with "!" | 44 | 4 |
| Bonked lines that end in "..." | 23 | 6 |
| Hob lines with "Lumpy" in them | 4 | 0 |
| Lines per event | always 3 | 2, 3, 4 or 6 |

`content/text.json` (new, so there is no before):

| Check | Count |
|---|---|
| Strings | 1,065 |
| Em dash | 0 |
| "delve", "journey", "Victory", "battle", "Fatigue", "Exposed" | 0 |
| "&" | 0 |
| "!" total | 13 |
| "!" outside Bonk!, Thump!, Drop!, Snip!, Kettle Pop! | 0 |
| Title Case UI lines | 0 |
| Names ending -wick, -well, -worth | 0 |

The check flags 39 lines in the table as Title Case. Each one is a name or a line built from the game's own nouns, such as "Sergeant Posy Rake", "Soggy Bottom Fen" or "Squall in {n}". None is a Title Case label.

For comparison, the old strings in the three apps had 69 "!" between them, 41 uses of "battle", 28 "&" pairs and 22 uses of "Fatigue".

Design docs, names by ending:

| Ending | Before | After |
|---|---|---|
| -wick | Chiselwick, Fenwick, Flintwick, Pebblewick, Picklewick, Turfwick | Flintwick |
| -well | Drainwell, Levelwell, Rakewell, Skatewell, Toastwell | Levelwell |
| -worth | Mangleworth, Needlesworth, Snoutworth | Mangleworth |

Mangleworth is a later Rival that the rename tables do not cover.

## Things the lead needs to know

1. **Core fixtures are stale.** `cargo test --workspace` passes except `fixtures_are_current`. The fixtures hold display names, and the names changed. Run `cargo run -p castle-core --example make_fixtures`. That folder belongs to the core owner, so it was left alone.
2. **`good_at` is in `text.json`, not `shots.json`.** The core refuses unknown fields on a shot, so adding `good_at` to `shots.json` would stop the content from loading. It lives at `shots.<id>.good_at` in the string table. If the core adds an optional `good_at` string to `ShotDef` and to `shots.schema.json`, the lines can move over.
3. **Short names.** The core refuses a `short` field on a Hob too. Short names are at `hobs.<id>.short` in the string table. Web keeps "Old Thumper" by a special rule but would cut "Miss Quill" to "Miss". Android cuts every name at the first space.
4. **Web reads the old bark key.** `apps/web/src/audio/sfx.ts` looks up bark lines by sprite name, which turns `old_thumper` into `thumper`. Until that is changed, Old Thumper has no subtitles on web. Android and iOS read by sound id and are fine. `apps/web/public/art/audio/barks.json` is a copy and needs a sync.
5. **The bark tool will undo the rewrite.** `tools/audio-gen/barks.py` holds the old lines and the `thumper` key, and it writes `barks.json`. It needs the new lines before anyone runs it again.
6. **Gibberish per Hob.** Each Hob still shares one pool of Hob-speak sounds. New syllables need new sound files from the audio tool, so that was not done here.
7. **Core strings.** The core sends a few English lines of its own: "Fatigue", "Fatigue collapse", "The Squall", "A fall", "Your own shot", "The shears", and the reasons a shot is locked. The apps should show the `text.json` line for the id (`results.blow.<by>`, `hud.why.<why>`) and not the core's text.
8. **Stale app copies.** `apps/web/src/core/content.ts`, `apps/web/src/ui/shellMeta.ts`, `apps/android/.../core/ContentInfo.kt` and `apps/ios/.../Core/ContentCatalog.swift` each hold old names and their own "Best vs" table. Those go when the apps read the string table.
9. **Sprite and sound ids** still say `thumper`, `battered` and `fatigue` in places. Those are ids and stay.

## Open questions

- **Three mole things.** The Doodad is now Molehill. Downs maps also grow Molehills, and Truffle's Knack is Molehill Surprise. The rename table asked for this, but a player may mix them up. One of the three could take a new name before art is made.
- **Rule 4 against the bark rules.** The binding rule allows "!" on five shouts only. The bark rules allow one per Hob per event. The barks follow the bark rules and use four.
- **Hetty before 1-7.** She gives the loss verdict, but the player has not met her until she is rescued. The table says to show the line with no name on it until then.
- **"battle" in the design docs.** The docs still say battle in rules prose. On-screen lines quoted in doc 07 were changed to match the string table, and both docs 00 and 07 now say that the string table wins.
