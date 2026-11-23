# Web text pass

Work in `apps/web` only. It follows `docs/review/naming-decisions.md` and `content/text.md`. Rules version 5. Nothing is committed.

## Result

| Check | Result |
|---|---|
| `scripts/build-wasm.sh` (web target) | built, copied by Vite |
| `npm ci` | ok |
| `npm run build` | ok |
| `npm run typecheck` | ok (there is no lint script) |
| Before this pass, the same run (three phone and desktop projects) | 105 passed, 20 failed |
| `npx playwright test --trace off`, all four projects, real core | 126 passed, 6 skipped, 0 failed (chromium 57, iphone 33 + 4 skipped, pixel-landscape 35 + 2 skipped, webkit-long 1) |
| `VITE_BASE=/CastleProtectLive/ npm run build` | ok; 329 asset URLs fetched under that base, 0 missing |
| Phone play-through at 390 x 844, scale 1 (1-1 to a result, Skirmish, Couch Duel hand-off, 1-10, Test Yard) | 0 page errors, 0 missing sprites, 0 missing text keys, on both bases |

## 1. One string table

New `src/ui/text.ts` reads `content/text.json`:

- `t(key, vars)` fills `{placeholders}`. A list is a pool: a random line, never the same one twice running. A `{one, other}` pair picks by `n`.
- `byId(group, id)` looks up an id the core sends, else `group.default`. An empty line counts as "say nothing".
- `hobShort(id)` gives `hobs.<id>.short`. Names are never cut at the first space, so Miss Quill and Old Thumper stay whole. The old `shortName()` in `real.ts` is gone.
- `rivalShort`, `rivalLine` find the Rival by `levels.<id>.rival` or by the name the core sends.
- `className` reads `content/classes.json`, so badges say Digger and Bouncer, not Delver and Boinker.

Every screen now reads from it: title, map, modes, level card, Rummage, fight HUD, banners, notes, pause, hand-off, results, Skirmish and Couch Duel setup, Workshop, settings, error screens, sound captions. The page title, the page description and the install manifest come from `app.title`, `app.tagline` and `app.promise` (Vite fills them at build time).

Removed from the web:

- The "Best vs" table in `shellMeta.ts`. The card shows the content card line and a "Good at" line from `shots.<id>.good_at`.
- The silly-name list. The dice use `names.duel`. Default names are `names.player_default`.
- The stale names in `core/content.ts` (mock data): Clod Pot, Mend Glob, Pudding Bomb, Marble Sack, Sod Sack, "Private Tuft Edgerly", "Sod Turfwick", "The Big One" and the rest. It now builds its tables from content JSON and the level files.
- The `HOW`, `WHY` and "broke" English tables in `real.ts`.
- "Nothing here needs a confirm.", "Privacy: Data Not Collected.", "Rules core: wasm 0.2.0", "Captive Bonked: you win!", "Grand Fort: phase 2", the doubled "You gave up", "Victory", "Fatigue" and "battle" on screen.

Core ids mapped to keys, never core English:

| Core sends | Shown from |
|---|---|
| event ids (`front`, `drop`, `lid_block`, `boss_phase`, `roller`, `shears_jam`...) | `notes.*`, `banners.weather.*`, `banners.notice.*`, `levels.1-10.phases.<n>` |
| `fatigue_warning`, `fatigue` | `banners.creaks.warn`, `banners.creaks.start` |
| `hud.fire.why`, `hud.shots[].why`, refusal `reason` | `hud.why.<id>` with `{hob}` and `{shot}`, `hud.why_short.<id>` on chips |
| `result.how` | `results.win.title`, `results.win.how`, `results.loss.title`, `results.loss.cause` |
| `result.broke.last.by` | `results.loss.verdict.<by>` pool, else by `how` |
| Workshop `invalid_blueprint` detail | `workshop.problems.*` (see "For the core" below) |

Results follow the rule in `text.md`: a campaign win shows `levels.<id>.win_title`, then `results.win.how`, then a Rival sign-off line (1-1 uses `rivals.pudge.dozed` for the round cap). A loss shows the title, the cause when it is not empty and not the same as the title, what it cost by Hob name, then one Hetty line. "Hetty says" is only printed once Hetty is on the crew.

Screen reader lines use the Hob's name: "Marge fired Clodpot.", "Hit Miss Quill for 40.", "Old Thumper is Bonked.", "Round 2. Pudge aims." The old "Left fired" and "Hit hob, 13 damage" are gone. In a one-player fight your own side is "You" and your kettle is "Kettle 100%", not "Left's kettle".

## 2. Barks

`sfx.ts` reads `assets/audio/barks.json` by content Hob id (`old_thumper`), and takes each bark's sound id from its own `sound` field (`bark_thumper_*`). `with_mate` lines join the pool only when that Hob is on the same crew, `with_rival` lines only against a named Rival (with `{rival}` filled), and `chance` overrides the event chance. `crew.win` ("Lumpy forever!") is said once by the winning crew at the end.

`apps/web/public/art/audio/barks.json` is not a second source. `scripts/build-art.mjs` copies `assets/audio` into `public/art` on every build, and `public/art/` is git-ignored. After this build the copy matches `assets/audio/barks.json` byte for byte.

## 3. Sounds

| Event | Cue |
|---|---|
| `lid_block` | `doo_lid_bounce` |
| `buried` | `hob_buried_thlup` |
| `boss_phase` | `cas_boss_horn` |
| `front` | `wx_front_chime` |
| `threaded` | `hit_threaded_zip` (one sound, not two) |
| `roller`, `roller_move` | `doo_roller_rumble` |
| `roller_stop`, `roller_done` | `doo_roller_rumble`, 3 semitones down |
| `shears_jam` | `doo_shears_jam` |

`wx_squall_bell` is now played only for the Squall. Each new cue has a caption and a synth stand-in for when the file has not decoded yet.

## 4. Rival look and idle start

- A crew Hob on the Rival side in campaign or Skirmish plays `hob_<name>_rival_*` clips. A Couch Duel player 2 stays orange. Flattener units keep `flattener_*`. The renderer no longer draws Skirmish crew Hobs as Flatteners.
- The Skirmish setup shows the Rival's crew as `portrait_<name>_rival`.
- Idle loops start at a random point (`random_start`), else at `start_offset_ms`, through a new `AnimPlayer.seek()`. Seen in play: a crew no longer breathes in step.

## 5. Rival data

- Level card: `rival.name`, `rival.habit`, the worded `pennants[]` goals (by the `text.md` order: `levels.<id>.goals.<type>`, then `pennants.<type>`, then the level file), the Notice of Flattening with its signature, and the Rival's units by name.
- Skirmish: the setup sends no Rival name, so the core picks from `rival.roster`. The screen shows `roster[seed % length]` with the same seed before the fight, and the fight reads `hud.names[1]`.
- Think pause: `hud.think_ms[side]`, else `app.json` `rival_think_seconds`.
- Taunts: the start line once, then hit, miss, hurt and "unit Bonked" lines now and then, never two turns running. The "thinking" banner replaces "Pudge aims" one turn in four at most.

## 6. Assets

- All 366 clips and every frame resolve in the v2 one-page atlas. The play-through also records every sprite name the app asks for: 0 misses on 1-1, 1-10, Skirmish, Couch Duel, Test Yard, Workshop and the level cards.
- With `VITE_BASE=/CastleProtectLive/`: page, core, atlas pages, backgrounds, terrain tiles, 147 sounds, `barks.json`, `animations.json` and the manifest all answer 200 with the right type. The play-through on that base also has 0 misses.

## Fixes found on the way

1. **Couch Duel, Skirmish and Test Yard stuck in the Rummage.** With Shells set to Quick Pick (or none) the fight opened on the draft modal. That was most of the 20 tests that failed before this pass. Quick Pick now ends the draft at once; only "The Rummage" opens the modal.
2. **First load over budget.** The Rival look made the @1x atlas page 1.5 MB, and the precache was 2.26 MB against its 2 MB budget. The @1x page is now near-lossless WebP at quality 60 (no channel moves by more than 2 of 255; the @2x page stays lossless). Precache is now 1.90 MiB.
3. **WebKit crashes in the long 1-8 fight.** Two causes, both in WebKit's compositor (the kernel log shows asserts and a segfault at nearly the same place in `libWPEWebKit`):
   - Closing the ImageBitmaps the @2x art replaced. That is now skipped on WebKit and left to the garbage collector. Run alone: 2 crashes in 5 runs before, 0 in 5 after.
   - Sharing one WebKit browser with the phone specs when all projects run in one command (it crashed 4 times in 4 such runs; CI runs `webkit-long` in its own job, so CI never saw it). The `webkit-long` project now has its own launch options, so it always gets a fresh browser.
4. A stale Rummage line ("Sergeant Rake wants the Bag of Marbles" after he took it), duplicate unit names on the card, "the Wobbly" at the start of a sentence, a Dummy chip that said "Lobber", and a content blueprint name ("Home fort, five seats, Cobble low row") shown in a Couch Duel note.

## Tests changed on purpose

| Test | Was | Now |
|---|---|---|
| fixes, qa1: Pause | "Resume", "Retry" | "Keep fighting", "Start again" |
| mobile: Shell card | "Weight" | "Light. No Rest." style line |
| qa1 m1: best shot | the line has the player name | the line sits under the winner's name |
| qa2: fort marker, prompt, Workshop | "View Rival fort", "Drag from your fort to aim", "Ready" | "Look at the Rival's fort", "Drag back to aim", "Good to go" |
| qa2 N1: banners | "Fatigue next round", "Fatigue!" | "The Creaks start next round", "The fort creaks" |
| recovery: notices | "older version", "no longer replays" | "rules changed", "damaged" |
| smoke: settings | "Reduce motion" | "Less motion" |
| protocol: keys and fire reason | no `think_ms`; core English | `hud.think_ms` known; the table's line with the Hob's short name |
| fixes: words layout | a fixed 250 ms wait | waits for a drawn frame (WebKit can stall a few hundred ms as a fight opens) |
| `playwright.config.ts` | `webkit-long` reused the phone specs' WebKit | its own browser |

## Built bundle grep (`dist`, default base)

| Word | Hits | Note |
|---|---|---|
| Victory | 0 | |
| battle, Battle | 57, 9 | all code ids: the `battle` route, save key, music theme, CSS class, `newBattle()` and the like. None reach the screen |
| Fatigue | 0 | |
| Left fired | 0 | |
| Best vs | 0 | |
| Rolo | 0 | |
| em dash | 0 | |

## Voice read

Every string on the phone screenshots was read against the rules: British spelling, sentence case, "Fight" not "battle", "!" only on Bonk!, Thump!, Drop!, Snip! and Kettle Pop!, Hobs by short name. The issues found are fixed above. Left as is: "R1/8" and "45.0° | 60" are HUD figures, not words.

## For other owners

- **Core:** `validate_blueprint` sends one reason (`invalid_blueprint`) with an English `detail`. The web reads that detail by pattern to pick a `workshop.problems` key and never shows it. A problem id per refusal (`nook_walls`, `over_budget`...) would be safer.
- **Text table:** there is no "Your kettle" line, so the web says "Kettle 100%" for your own kettle in a one-player fight. Keys not used by web: `home.new_fight`, `modes.daily`, `pause.give_up_confirm` (web gives up at once; tests rely on it), `a11y.status`, `a11y.shot_summary`, `hobs.states.open` and `cover`.
- **Skirmish crew:** the web still sends four of your own Hobs as the Rival crew (as the balance runs assume), so a Skirmish Rival fields crew Hobs in the Rival look, not roster units.
