# 04 Tech Stack

Date: 2026-11-22. Scope: pick the stack and the build plan for Castle Protect.
Read `docs/BRIEF.md` first. This doc covers tech only, not game design.

## 1. Short answer

Build the game in **TypeScript**. Draw with **Phaser 4**. Bundle with **Vite**. Wrap for the stores with **Capacitor 8**. Ship the web build as a **PWA**.

Keep all game rules in a **pure TypeScript sim package** that knows nothing about Phaser, the DOM or the clock. The sim runs in Node for tests, bots and AI search. Phaser only draws what the sim says and passes input to it.

Why this wins for this game:

- Web is a first-class target here. This stack has the smallest web load of any option with a full feature set, bar Defold.
- Artillery on pixel terrain needs custom physics in every engine. No engine gives it for free. So engine physics counts for little, and a clean custom sim counts for a lot.
- Turn-based 2D play is light. A WebView handles it on low-end Android if we hold the budgets in section 14.
- One language covers game, tools, tests, bots and CI. Hiring for TypeScript is easy.
- Cost is zero. All parts are MIT licensed.
- The sim split caps our risk. If Phaser 4 lets us down, we swap the view layer (to PixiJS, or even to Godot or Defold with a port) and keep the rules, content and tests.

Runner-up: **Defold**. It is the best choice if low-end Android speed ever beats web tooling and hiring as the top need. See section 4.

## 2. How to read the facts

Each fact below has a tag:

- **[web]** found in a web search on 2026-11-22. Sources in section 17.
- **[est]** my estimate from past work. Measure it in the prototype before you trust it.

Limits of this research: the session could not open `phaser.io` or `defold.com` directly. Facts from those sites come from search summaries, not full page reads. Nobody ran a benchmark for this doc. Section 16 lists the checks the prototype must run to close these gaps.

## 3. Facts per option

### 3.1 Phaser 4 + Capacitor

- Phaser 4.0.0 shipped on 10 April 2026. Point releases continue. 4.2.1 is on npm. **[web]**
- New renderer built from scratch on a "RenderNode" design, with WebGL2 support and one filter system that replaces the old FX and masks. **[web]**
- Most new features are WebGL only. Canvas mode is a weak fallback. **[web]**
- No official min+gzip size for 4.x turned up. Phaser 3 full builds run about 1.2 MB min, about 350 KB gzip. Expect the same range for 4.x. **[est]**
- API stays close to Phaser 3, so most Phaser 3 skills and samples carry over. **[est]**
- License: MIT. Free.
- Capacitor 8 shipped 8 December 2025. 8.5 shipped 31 July 2026. New iOS projects use Swift Package Manager by default. **[web]**
- Capacitor 8 floor is about iOS 15 and Android 7 (API 24). One plugin vendor lists iOS 14 and API 23. Check the official support table. **[est]**

### 3.2 PixiJS 8 + custom code + Capacitor

- PixiJS 8.x is current (8.17 to 8.20 seen). Single package, tree-shakable. **[web]**
- Size: about 450 KB min for the full library per a third-party guide. Tree shaking cuts it. Expect 120 to 200 KB gzip in use. **[web] [est]**
- WebGL is the default renderer. WebGPU is opt-in. **[web]**
- It is a renderer, not a game framework. We would write or pick scenes, input, audio, loaders, tweens, particles and camera.
- License: MIT. Free.

### 3.3 Godot 4.x

- Web export is single-threaded by default since 4.3, which fixed many iOS and macOS load faults. **[web]**
- Official docs still warn that Safari has WebGL 2 faults other browsers lack. **[web]**
- Forum users report WebGL context loss and crashes on iOS 18 with 4.3 web builds, and page reloads when memory use passes about 300 MB. Reports, not proof. **[web]**
- Size: the stock wasm is about 27 to 40 MB raw and about 4 to 9 MB with Brotli. Custom stripped templates cut it more, at the cost of build work. **[web]**
- C# projects cannot export to web in Godot 4. Use GDScript. **[web]**
- Native iOS and Android exports are solid for 2D. **[est]**
- License: MIT. Free. No royalty.

### 3.4 Unity 6

- Personal is free up to 200,000 USD of yearly revenue and funding. Above that you need Pro. **[web]**
- Pro costs about 2,310 USD per seat per year after a 5 percent rise on 12 January 2026. Check the live price page. **[web]**
- The Runtime Fee is gone. Seat prices now rise each year. **[web]**
- Unity 6 supports mobile browsers on paper. Its docs still say mobile web needs a small build and tight code. **[web]**
- A forum user reports an empty Unity 6 web build using 200 MB of RAM. **[web]**
- Size: an empty 2D web build is about 5 to 10 MB with Brotli and loads in 5 to 15 s on a mid phone. **[est]**
- Native mobile speed is very good. Hiring pool is the largest of all engines.

### 3.5 Defold

- Free, source-available, monthly releases. Version 1.13.0 is current. **[web]**
- Empty HTML5 engine is about 1 MB gzip. Defold's own chart shows it far below Unity and Godot. **[web]**
- License: the Defold License, based on Apache 2.0. You may not sell the engine itself. Games ship free of fees or royalty. **[web]**
- Native engine in C++, game code in Lua. Runs well on very weak phones. **[est]**
- Small hiring pool. Lua has weaker typing and test tools than TypeScript. **[est]**

### 3.6 Cocos Creator 3.8

- 3.8 is the LTS line. Latest found is 3.8.8 from 16 December 2025. No 2026 release turned up. **[web]**
- 3.8.6 added property mangling to cut package size. **[web]**
- TypeScript engine with a full editor. Native builds use its own runtime, not a WebView. **[est]**
- Web size for a 2D game with unused modules off is about 1 to 2 MB gzip. **[est]**
- Docs and community lean Chinese. The slow release pace in 2026 is a long-term risk. **[est]**

### 3.7 Flutter + Flame

- Flutter web draws with CanvasKit or skwasm. CanvasKit adds about 1.5 MB to the download. **[web]**
- skwasm needs WasmGC. In practice it loads by default only on Chromium browsers. Safari falls back to CanvasKit. **[web]**
- A full Flame web build is about 2.5 to 4 MB gzip before assets. **[est]**
- Native mobile speed is good. Flame has no fit for pixel terrain. We would write that part in Dart. **[est]**
- Dart game developers are rare.

## 4. Scorecard

Scores run 1 (poor) to 5 (best) for this game. Weights reflect the brief: web matters, offline matters, the game is 2D and turn-based.

| Criterion | Weight | Phaser 4 + Cap | Pixi 8 + Cap | Godot 4 | Unity 6 | Defold | Cocos 3.8 | Flame |
|---|---|---|---|---|---|---|---|---|
| Web load size and start time | 3 | 5 | 5 | 2 | 1 | 5 | 4 | 2 |
| Low-end Android speed | 3 | 3 | 3 | 4 | 4 | 5 | 4 | 4 |
| Destructible terrain fit | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 3 |
| Physics options | 1 | 4 | 3 | 5 | 5 | 4 | 4 | 3 |
| Offline (PWA, local save) | 2 | 5 | 5 | 3 | 3 | 4 | 4 | 4 |
| Store builds | 2 | 4 | 4 | 4 | 5 | 5 | 4 | 5 |
| In-app purchase plugins | 1 | 4 | 4 | 3 | 5 | 4 | 3 | 5 |
| Dev speed | 3 | 5 | 3 | 4 | 4 | 3 | 3 | 3 |
| Testing and headless bots | 3 | 5 | 5 | 3 | 3 | 3 | 4 | 4 |
| Hiring | 2 | 5 | 4 | 3 | 5 | 2 | 2 | 2 |
| License cost | 1 | 5 | 5 | 5 | 2 | 5 | 5 | 5 |
| Long-term risk | 2 | 4 | 4 | 4 | 3 | 4 | 2 | 3 |
| **Weighted total (max 130)** | | **115** | **106** | **89** | **89** | **100** | **90** | **89** |

Notes on the scores:

- **Terrain.** Every option needs a custom bitmap terrain. The web stacks score a point higher because typed arrays plus partial texture upload are simple and fast in JavaScript, and the same code runs headless in Node.
- **Low-end Android.** The WebView stacks carry the main risk here. JavaScript in a WebView runs slower than native code and the WebView version varies by phone. A turn-based game with one shell in flight is the kind of load a WebView handles. Section 16 tests this early.
- **Testing.** A pure TypeScript sim runs thousands of bot matches a minute in Node with no engine binary. Godot, Unity and Defold can run headless, but slower and with more setup.
- **Unity.** It loses on web size and on cost above the 200,000 USD cap. It would win for a 3D or mobile-only game.
- **Godot.** A fine engine held back here by web size and Safari faults.
- **Defold.** The real rival. It beats the pick on raw speed and matches it on web size. It loses on hiring, on Lua tooling and on sharing one sim across game, bots and tools.
- **Pixi vs Phaser.** Pixi saves about 150 to 200 KB gzip and costs us weeks of framework code. Not worth it for this game.

## 5. Chosen stack

| Layer | Choice | Note |
|---|---|---|
| Language | TypeScript 5.x, strict mode | One language for all code |
| View | Phaser 4.x, version pinned | Scenes, input, camera, particles, tweens, audio |
| Sim | Own package, pure TypeScript | No Phaser, no DOM, no `Date`, no `Math.random` |
| Physics | Own ballistics and pixel terrain in the sim | No engine physics in play rules |
| Cosmetic physics | Phaser Arcade or simple own code | Debris and sparks only, never read by rules |
| Bundler | Vite | Code split per scene, hashed files |
| Native shell | Capacitor 8.x | iOS and Android projects in the repo |
| Web | PWA with Workbox service worker | Full precache, works offline after first load |
| Save | Capacitor Filesystem on native, IndexedDB on web | Behind one `SaveStore` interface |
| Content | JSON files with Zod schemas | Checked at build and in CI |
| Unit tests | Vitest, fast-check for property tests | |
| Browser tests | Playwright | Chromium, WebKit, Firefox |
| Lint and format | Biome | One tool, fast |
| Packages | pnpm workspaces | |
| CI | GitHub Actions, fastlane for store upload | |
| Purchases (optional) | `@capgo/native-purchases` or `@revenuecat/purchases-capacitor` | See section 12 |

Rules that keep the stack honest:

1. `packages/sim` may not import Phaser, Capacitor or any browser API. A lint rule enforces it.
2. The view never changes sim state. It sends commands and reads state and events.
3. Pin Phaser and Capacitor to exact versions. Upgrade on purpose, on a branch, with the full test run.
4. All platform calls (save, haptics, purchases, share) go through small interfaces in `packages/platform` with a web version and a native version.

## 6. Project folder layout

```
CastleProtect/
  docs/                      research, design, art, review, PLAN.md
  packages/
    sim/                     pure rules, no engine imports
      src/
        core/                rng, fixed math, state, commands, events, hash
        terrain/             material grid, carve, add, settle, ray trace
        ballistics/          shells, wind, bounce, split, timers
        combat/              damage, status effects, castle parts, units
        ai/                  shot search, difficulty, plans
        match/               turn flow, win rules, scoring
        replay/              record, play back, verify
      test/
    content/                 data only
      weapons/*.json
      units/*.json
      enemies/*.json
      castles/*.json
      tech/*.json
      levels/*.json
      campaigns/*.json
      schema/                Zod schemas, inferred types, id checks
    game/                    Phaser view and UI
      src/
        scenes/              Boot, Menu, Map, Match, Shop, Result
        view/                terrain renderer, sprites, fx, camera
        ui/                  hud, aim control, dialogs
        audio/
        i18n/
        save/                SaveStore, schema, migrations
        app/                 config, feature flags, bootstrap
    platform/                web and native bridges
      src/                   storage, haptics, purchases, lifecycle, share
    bots/                    headless playtest bots and balance reports
  apps/
    web/                     Vite entry, index.html, manifest, service worker
    mobile/                  Capacitor config, ios/, android/
  assets/
    src/                     SVG sources, raw audio, fonts
    build/                   generated atlases and audio (not in git)
  tools/                     atlas build, audio build, content lint, level preview
  e2e/                       Playwright tests
  .github/workflows/
```

## 7. Deterministic sim

The sim is the heart of the build. Replays, AI search, bots and bug reports all rest on it.

**Rules**

- Fixed step: 60 ticks per second. The view draws between ticks with interpolation. The sim never reads wall time.
- State is one plain object tree plus typed arrays. No classes with hidden state. It can be cloned, hashed and saved.
- All randomness comes from one seeded generator (PCG32 or sfc32) held in the state.
- Input is a list of commands: `{tick, type, args}`. Example: `fire {weaponId, angleDeg, power}`.
- Output is new state plus a list of events (`explosion`, `terrainCarved`, `unitHit`). The view and audio react to events.

**Number safety**

- JavaScript `+ - * /` and `Math.sqrt` give the same bits on every engine. `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp` and `Math.atan2` may differ between engines.
- So the sim ships its own `sin`, `cos`, `atan2` (table or polynomial) and never calls the built-in ones. A lint rule bans them in `packages/sim`.
- Store angles as integer tenths of a degree and power as an integer 0 to 100. Store terrain as integers.
- Never iterate object keys or `Map` in an order that depends on insert history from the view. Use arrays sorted by id.

**Terrain**

- A grid of material ids in a `Uint8Array`, one cell per logical pixel. A 2400 by 720 map is 1.7 MB.
- Materials: air, dirt, rock, wood, stone, metal, and so on. Each has hardness and a draw style.
- Carve and fill with circles, lines and stamps. Each edit returns a dirty rectangle.
- Loose dirt settles column by column in a fixed order. Castle blocks use a simple support check, not rigid body physics.
- Shells move in sub-steps of at most one cell and test the grid, so fast shells never tunnel.

**Replays**

- A replay is: sim version, content hash, level id, seed, command list. A long match is a few kilobytes.
- Every 600 ticks the sim stores a state hash. Playback checks each one. A mismatch names the first bad tick.
- The game keeps the last 20 replays on the device. The player can export one as a file with a bug report.
- A sim version bump makes old replays "view not sure". Keep a folder of golden replays per version for tests.

**AI**

- The AI calls the same sim. `traceShot(state, shot)` flies a shell on a read-only state and returns where it lands and what it would hit. No clone needed.
- Search: sample angle and power, keep the best, refine near it. About 200 traces per turn.
- Difficulty adds aim error, limits the number of traces and limits weapon choice. Easy AI is the same code with worse inputs.
- Run the search in a Web Worker on web and native, with a per-frame time slice as a fallback.

## 8. Save system

Local only. No account. No server.

**Storage**

- Native: JSON files in the app data folder through Capacitor Filesystem. iOS device backup and Android Auto Backup cover this folder, so a save can survive a phone change.
- Web: IndexedDB. Call `navigator.storage.persist()` on first save.
- Risk on iOS Safari: script storage for a site in a browser tab can be wiped after 7 days without a visit. Home Screen web apps keep their own counter. **[web]** So the web build shows an "Add to Home Screen" hint on iOS and offers export.

**File set**

```
save/
  profile.a.json     main save, slot A
  profile.b.json     main save, slot B
  settings.json      volume, language, controls, consent flags
  replays/           last 20 replays
```

**Format**

```json
{
  "schema": 7,
  "app": "1.3.0",
  "savedAt": 1795000000,
  "counter": 412,
  "checksum": "crc32:9f2a11c0",
  "data": {
    "progress": { "campaign": "c01", "levelsDone": { "c01_l03": { "stars": 2 } } },
    "tech": { "unlocked": ["t_stone_wall", "t_long_fuse"] },
    "wallet": { "coins": 1250 },
    "loadout": { "weapons": ["w_ember_pot", "w_splitter"] },
    "stats": { "shots": 1830, "wins": 61 }
  }
}
```

**Write path**

1. Build the new save in memory.
2. Raise `counter`, compute the checksum.
3. Write to the slot that is not the latest one. Flip A and B each save.
4. On load, read both. Use the valid one with the higher counter. If one is corrupt, use the other and log it.

A crash during a write can cost one save at most, never the whole profile.

**Versions and migration**

- `schema` is an integer. Each bump adds one pure function `migrate_N_to_N+1(data)`.
- Load runs the chain from the file's version to the current one, then checks the result with the Zod schema.
- Keep one sample save file per old schema in the repo. A test loads each and runs the full chain.
- If a save comes from a newer app than the one running, do not load it and do not write over it. Tell the player to update.
- Saves hold content ids, never array positions. Removed content gets an alias or a refund rule in the migration.

**Player tools**

- Export save to a text code or file. Import it on another device. This is the only "cloud" at launch.
- Reset progress, with a confirm step.
- Mid-match resume: store seed plus command list, replay it on load. Free with the sim design.

## 9. Data-driven content

Designers change content without touching code. Weapons are built from parts, not from one script each.

**Format**

- JSON files, one per item, under `packages/content`.
- Zod schemas define each type. TypeScript types come from the schemas.
- A build step checks every file, checks every id reference, and packs all content into one `content.json` with a hash.
- Text shown to players lives in locale files. Content holds keys only.
- Ids are stable strings with a type prefix: `w_` weapon, `u_` unit, `e_` enemy, `l_` level, `t_` tech.

**Weapon example**

```json
{
  "id": "w_splitter",
  "nameKey": "weapon.w_splitter.name",
  "descKey": "weapon.w_splitter.desc",
  "icon": "weapons/splitter",
  "cost": 300,
  "tier": 2,
  "shell": { "mass": 1.0, "drag": 0.02, "radius": 4, "windFactor": 1.0, "sprite": "shells/splitter" },
  "triggers": [
    { "on": "apex", "do": [ { "type": "split", "count": 5, "spreadDeg": 30, "child": "w_splitter_child" } ] }
  ],
  "fx": { "launch": "sfx/thump_mid", "trail": "trail/smoke_thin" }
}
```

```json
{
  "id": "w_splitter_child",
  "hidden": true,
  "shell": { "mass": 0.4, "drag": 0.03, "radius": 2, "windFactor": 1.2, "sprite": "shells/shard" },
  "triggers": [
    { "on": "impact", "do": [
      { "type": "explode", "radius": 18, "damage": 12, "carve": true },
      { "type": "shake", "power": 0.2 }
    ] }
  ]
}
```

**Parts the sim knows**

- Trigger events: `launch`, `apex`, `timer`, `impact`, `nearTarget`, `bounce`, `rest`.
- Effects: `explode`, `carve`, `addTerrain`, `split`, `bounce`, `burn`, `push`, `spawnUnit`, `heal`, `shield`, `drill`, `chain`, `status`.
- A new weapon is new JSON if the parts exist. A new part is a small sim change with its own tests.

**Level example**

```json
{
  "id": "l_c01_03",
  "nameKey": "level.l_c01_03.name",
  "terrain": { "kind": "generated", "seed": 9041, "profile": "rolling_hills", "width": 2400, "height": 720 },
  "wind": { "min": -3, "max": 3, "changeEachTurn": true },
  "player": { "castle": "c_wood_keep", "x": 300 },
  "enemy": { "castle": "c_bog_fort", "x": 2050, "ai": "ai_cautious", "weapons": ["w_ember_pot", "w_mud_ball"] },
  "goals": { "win": "destroyCore", "stars": [ { "type": "turnsUnder", "value": 12 }, { "type": "castleHpOver", "value": 50 } ] },
  "rewards": { "coins": 200, "unlock": ["t_stone_wall"] }
}
```

Hand-made terrain uses a PNG mask where each colour is a material. The build step turns it into a packed grid.

## 10. Asset pipeline

**Art source and output**

- Artists draw in vector (SVG or Affinity or Illustrator) and export SVG to `assets/src`.
- The game never draws SVG at run time. SVG is slow to draw and looks different per browser.
- A build script turns SVG into PNG at fixed scales with resvg and packs sprite atlases. WebP for atlases where alpha quality holds, PNG as the fallback.

**Sizes**

- Logical screen: 960 by 540 landscape, scaled to fit, with safe zones for notches. The camera pans and zooms over wider maps.
- Two atlas sets:
  - `@1x` for a 540 pixel tall draw buffer. Low-end phones.
  - `@2x` for a 1080 pixel tall draw buffer. Most phones, tablets, desktop.
- Pick the set at boot from screen size, pixel ratio and device memory. Cap the draw buffer at 1080 tall. Higher gives no gain a player can see and costs fill rate.
- Atlas pages are 2048 by 2048 at most. All target GPUs handle that.
- Group atlases by use: `ui`, `common`, one per world theme. Load a world's atlas when the player enters it.

**Terrain drawing**

- The view splits the terrain into 256 by 256 chunks, each with its own texture.
- After a carve, redraw and upload only the chunks under the dirty rectangle. A big blast touches 4 to 9 chunks.
- Colour comes from the material id, a tiling texture per material and an edge shade pass. Do the work on an offscreen canvas, then upload.

**Other assets**

- Fonts: one bitmap font for numbers in play, one web font for UI text with fallbacks for CJK. Subset fonts per language.
- Animation: sprite frames and tweens first. Add Spine or Rive only if the art plan needs skeletal characters. Spine costs a license per seat.
- Every generated file name has a content hash. The service worker and the loader use a manifest.

## 11. Audio

- Use the Phaser sound manager on Web Audio. Add a thin `AudioDirector` that maps sim events to sounds.
- Formats: Opus in WebM first, AAC in M4A as the fallback. Build both from WAV with ffmpeg.
- Sound effects: one audio sprite per group (ui, weapons, impacts, voices). Short, mono, 48 to 64 kbps.
- Music: stereo, 96 kbps, loop points in metadata. Stream by loading per world, not all at boot.
- Budget: all audio under 6 MB at launch.
- Unlock audio on the first tap. Browsers and WebViews block sound until then.
- Pause all sound on `visibilitychange` and on the Capacitor `pause` event. Resume on return.
- Limit voices: at most 16 at once, and at most 3 of the same sound within 50 ms.
- Settings: music volume, effects volume, mute, haptics on or off. Use Capacitor Haptics for hits on native.

## 12. Offline, PWA, stores, purchases

**Offline on web**

- Workbox precaches the app shell, code, content and the common atlases at install. Per-world atlases and music cache on first use, with a "download all" button in settings.
- Updates: a new service worker waits. The game shows "Update ready" on the menu and swaps on the next start. Never swap during a match.
- Web manifest with icons, landscape mode and `display: fullscreen`.

**Offline on native**

- All files ship inside the app. No network call at start. No network permission needed for play.
- Test with flight mode on in CI device runs and before each release.

**Store builds**

- Capacitor makes real Xcode and Android Studio projects. fastlane builds, signs and uploads.
- Google Play: new apps and updates must target Android 16 (API 36) since 31 August 2026. **[web]** Capacitor 8 covers this. Ship as AAB.
- Apple: build with the current Xcode and SDK. Check the live rule before each upload.
- Apple review rule 4.2 can reject thin web wrappers. A full game with native haptics, offline play and no browser chrome passes in practice. Keep the app feeling native. **[est]**
- Set the minimum WebView on Android in the Capacitor config and show a plain "update Android System WebView" screen below it.

**Purchases (optional)**

- The game must run in full with no store reply. Never block play on a purchase check.
- Simplest fit: one non-consumable "full game" or "supporter pack" unlock. No coins for cash at launch.
- Plugin choice:
  - `@capgo/native-purchases`: calls StoreKit 2 and Play Billing direct. No backend, no third-party account. Best fit for an offline game. **[web]**
  - `@revenuecat/purchases-capacitor`: official plugin, version 13 on npm, with dashboards and receipt checks on RevenueCat servers. More features than we need. One user reported a setup fault with Swift Package Manager in July 2026. **[web]**
- Cache the entitlement in the save file after the store confirms it. Offer "Restore purchases". Recheck when online.
- Web has no store purchase at launch.

## 13. Localization and analytics

**Localization**

- One JSON file per language: `en.json`, `es.json` and so on. Flat keys.
- ICU MessageFormat for plurals and gender through a small library (`intl-messageformat`), loaded once.
- Launch set suggestion: English, Spanish, Portuguese (Brazil), French, German. Then Japanese, Korean, Simplified Chinese with a CJK font subset.
- Rules: no text baked into art. Leave 40 percent spare width in every text box. Numbers and dates through `Intl`.
- A pseudo-locale (`xx`) stretches and accents all text. CI takes screenshots in it to catch clipping.
- CI fails on a missing key or an unused key.
- Right-to-left languages need layout work. Plan them after launch.

**Analytics (optional, opt-in, off by default)**

- The game works the same with analytics off. No ad SDK. No device id.
- If the player opts in:
  - Events queue in local storage with a cap of 500 events or 200 KB. Oldest drop first.
  - The queue sends in one batch when the device is online and the app starts. No retries during play.
  - Events carry a random install id that the player can reset, the app version and the event data. No name, no email, no precise location.
- Events worth having: level start, level end (result, turns, stars), weapon picked, tech bought, quit point, frame rate bucket, crash.
- Backend choice comes later. A self-hosted PostHog or a tiny own endpoint fits. It is the only server in the project and the game never needs it.
- With analytics off, the same events feed a local "stats" screen for the player. The work is not wasted.
- Until then, headless bots (section 14) give balance data with no player data at all.

## 14. CI, tests, bots and budgets

**Test layers**

| Layer | Tool | What it checks | When |
|---|---|---|---|
| Types and lint | tsc, Biome | Strict types, banned imports in sim | Each push |
| Content | Zod, own script | Schema, id links, missing text keys, cost ranges | Each push |
| Sim unit | Vitest | Ballistics, carve, damage, each effect part | Each push |
| Sim property | fast-check | No NaN, no shell outside bounds, state hash stable, save round trip | Each push |
| Golden replays | Vitest | Stored replays give the same final hash | Each push |
| Save migration | Vitest | Every old save sample loads into the current schema | Each push |
| Bot smoke | Node | 200 matches across all levels end with no error | Each push |
| Bot balance | Node | 20,000 matches, win rates and weapon use per level | Nightly |
| Browser | Playwright | Boot, play one level, save, reload, offline reload | Each pull request |
| Visual | Playwright screenshots | Menu, HUD, pseudo-locale, notch layouts | Each pull request |
| Size | Own script | Bundle and asset budgets | Each pull request |
| Speed | Playwright with CPU throttle | Frame time in a stress scene | Nightly |
| Native build | fastlane | iOS and Android compile and sign | On main |
| Device | Real phones | Low-end Android and old iPhone smoke run | Each release candidate |

**Headless playtest bots**

- Bots live in `packages/bots` and drive the sim through the same commands as a player.
- Bot types: random, greedy (best single shot), each shipped AI level, and a "novice" that aims badly and picks odd weapons.
- Target speed: over 500 full matches a minute on one CI core. **[est]**
- Each run checks:
  - Every match ends inside a turn limit. No stuck states.
  - No unit or shell leaves the map in a bad state.
  - Each level can be won by the strong bot and lost by the novice bot.
  - Win rate per level sits in the band the design sets.
  - No weapon is unused and no weapon wins far more than its cost suggests.
- A failed match saves its replay as a CI file. A developer opens it in the game and watches the fault.
- A nightly report lists win rate, mean turns and weapon use per level as a table. Designers read it each morning.

**Performance budgets**

| Item | Budget |
|---|---|
| Frame rate, mid phones and up | 60 fps |
| Frame rate, low-end Android (2 GB RAM, 2019 class) | 30 fps floor, 60 fps target at `@1x` |
| Sim tick cost | under 2 ms on low-end |
| AI turn think time | under 1.5 s on low-end, in a worker |
| Terrain upload after a blast | under 4 ms on low-end |
| Draw calls in a match | under 60 |
| JS heap in a match | under 120 MB |
| Total memory on iOS web | under 250 MB |
| Web first load, code (gzip or Brotli) | under 600 KB |
| Web first load, total to menu | under 3 MB |
| Web time to menu, mid phone on 4G | under 4 s |
| Web time to menu, repeat visit | under 1.5 s |
| Full game cached for offline | under 25 MB |
| Android download size | under 30 MB |
| iOS download size | under 40 MB |
| Cold start to menu on native | under 2.5 s |
| Save write | under 30 ms, never during a shot |
| Garbage per frame in a match | near zero. Pool shells, particles and events |

CI fails a pull request that breaks a size budget. The nightly speed job warns on a frame budget break.

## 15. Milestone build plan

Team assumed: 2 engineers, 1 artist, 1 designer who also runs content, audio by contract. Effort is in person-weeks (pw) for engineering unless noted. These are rough numbers for planning, not a quote.

| Milestone | Weeks | Eng effort | Goal | Exit test |
|---|---|---|---|---|
| M0 Prototype | 3 | 6 pw | Prove fun and prove the stack | See below |
| M1 Vertical slice | 7 | 14 pw | One world at ship quality | One world plays start to end on all 3 platforms |
| M2 Alpha | 10 | 20 pw | All systems in, content rough | Full campaign playable, bots pass all levels |
| M3 Beta | 8 | 16 pw | All content in, tune and polish | Budgets met, no known crash, outside testers |
| M4 Launch | 4 | 8 pw | Store release | Live on App Store, Google Play and web |
| **Total** | **32** | **64 pw** | | |

Art, design and audio run beside this at about 40 pw of art, 30 pw of design and 6 pw of audio.

**M0 Prototype (3 weeks)**

- Sim core: fixed step, seeded RNG, own trig, state hash.
- Terrain grid with carve and settle. Chunked terrain drawing in Phaser 4.
- One shell type, wind, angle and power control, two castles as grey boxes.
- Simple AI with `traceShot`.
- Capacitor build on one low-end Android phone and one old iPhone. PWA on web.
- Run the risk checks in section 16. Decide go or no-go on the stack.

**M1 Vertical slice (7 weeks)**

- 8 weapons from JSON parts. 1 castle set. 1 enemy type. 5 levels. 1 small tech branch.
- Final art and sound for that one world.
- Save system with A and B slots and schema version 1.
- Replays, mid-match resume.
- HUD, menus, settings, English text through the locale system.
- CI with unit, replay, bot smoke, Playwright and size checks.

**M2 Alpha (10 weeks)**

- All effect parts, all unit and enemy behaviours, full tech tree, campaign map.
- All worlds in rough form. Level tools for designers (terrain mask import, level preview).
- AI levels and enemy plans.
- Nightly bot balance report.
- Asset pipeline with `@1x` and `@2x`, per-world loading.
- Purchases behind a flag if wanted. Opt-in analytics queue if wanted.
- Save migration tests in place before any tester gets a build.

**M3 Beta (8 weeks)**

- All content final. All languages in.
- Balance passes driven by bot reports and tester notes.
- Performance work to meet every budget on the low-end phones.
- Accessibility: colour-safe palettes, text size option, reduced shake option, full touch and mouse and keyboard control.
- Store pages, screenshots, age ratings, privacy labels.
- TestFlight and Play closed testing. Web beta on a hidden URL.

**M4 Launch (4 weeks)**

- Fix list from beta. Release candidates on real devices in flight mode.
- Store review time and one round of fixes.
- Launch on all three. Tag the sim version and freeze golden replays.
- Plan for patch one: crash fixes and balance from first week data.

## 16. Risks and early checks

Run these in M0. Each has a pass line. Two or more fails means we stop and weigh Defold.

| Risk | Check in M0 | Pass line |
|---|---|---|
| WebView too slow on low-end Android | Stress scene on a 2 GB, 2019 class phone: full map, 200 particles, big blast | 30 fps floor, blast upload under 4 ms |
| Phaser 4 is new (7 months old) | Build terrain chunks, particles, filters, text, audio on 4.2.x | No blocker bug without a fix or workaround |
| Phaser 4 size unknown | Measure the prod bundle | Code under 600 KB compressed |
| iOS WKWebView faults (audio, memory, context loss) | 30 minute play session on an old iPhone, app switch 20 times | No reload, no lost audio, no lost textures |
| Float drift between engines | Run the same 100 replays in V8 (Node, Chrome), JavaScriptCore (Safari, iOS), SpiderMonkey (Firefox) | Same final hash on all |
| Safari wipes web saves | Test persist call and Home Screen install | Save survives per WebKit rules, export works |
| Apple rejects as a web wrapper | Read current rule 4.2, add native haptics and offline play early | No web chrome, feels native |
| Store plugin breaks on an OS update | Keep purchases behind an interface and a flag | Game ships with the flag off if needed |

Long-term notes:

- Phaser is run by a small company. MIT license means we can fork and fix. The sim split means we can leave.
- Capacitor is run by Ionic and has a wide plugin field. Yearly major versions need about a week of upgrade work.
- Google and Apple raise target SDK rules each year. Budget one maintenance pass per year.
- Keep `docs/research/04-tech-stack.md` current when a pinned version changes.

## 17. Sources

Searches ran on 2026-11-22. Direct fetch of `phaser.io` and `defold.com` was blocked in this session, so those facts come from search summaries.

Phaser and PixiJS
- Phaser 4.0.0 changelog: https://raw.githubusercontent.com/phaserjs/phaser/HEAD/changelog/v4/4.0/CHANGELOG-v4.0.0.md
- Phaser 3 vs Phaser 4 (May 2026): https://phaser.io/news/2026/05/phaser-3-vs-phaser-4
- Phaser 4 renderer (April 2026): https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games
- Phaser 4.2.1 README: https://cdn.jsdelivr.net/npm/phaser@4.2.1/README.md
- PixiJS v8 launch: https://pixijs.com/blog/pixi-v8-launches
- PixiJS v8 migration guide: https://pixijs.com/8.x/guides/migrations/v8
- PixiJS releases: https://github.com/pixijs/pixijs/releases
- PixiJS size note (third party): https://abratabia.com/pixijs/

Capacitor and purchases
- Capacitor 8 announcement: https://ionic.io/blog/announcing-capacitor-8
- Capacitor 8.5 release: https://ionic.io/blog/capacitor-8-5-released
- Capacitor support policy: https://capacitorjs.com/docs/next/main/reference/support-policy
- RevenueCat Capacitor install docs: https://www.revenuecat.com/docs/getting-started/installation/capacitor.md
- RevenueCat SPM setup report: https://community.revenuecat.com/sdks-51/capacitor-react-ios-configure-never-resolves-zero-native-sdk-logs-no-to-native-purchases-plugin-not-registering-7766
- Capgo native purchases: https://github.com/Cap-go/capacitor-native-purchases

Godot
- Exporting for the Web (4.6): https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html
- Web export progress report (4.3): https://godotengine.org/article/progress-report-web-export-in-4-3/
- Web size and load test: https://github.com/JohannesDeml/Godot-Web-LoadingTest
- Optimizing a build for size (4.6): https://docs.godotengine.org/en/4.6/engine_details/development/compiling/optimizing_for_size.html
- iOS 18 WebGL context loss report: https://forum.godotengine.org/t/webgl-context-loss-and-app-crash-in-godot-4-3-exported-web-on-ios-browsers/81024
- iPhone HTML5 load report: https://forum.godotengine.org/t/problems-with-iphone-when-exporting-to-html5/67937
- wasm compression thread: https://forum.godotengine.org/t/wasm-de-compression-is-this-really-working-or-am-i-getting-it-wrong/71728

Unity
- Pricing changes: https://unity.com/products/pricing-updates
- Optimize Web for mobile: https://docs.unity3d.com/Manual/web-optimization-mobile.html
- Web memory report (Unity 6): https://discussions.unity.com/t/web-build-memory-consumption-on-unity-6/1613334
- Web runtime updates: https://discussions.unity.com/t/web-runtime-updates-are-here-take-your-browser-to-the-next-level/934582

Defold and Cocos
- Defold product overview: https://defold.com/product
- Defold at gamescom 2026 (size chart): https://defold.com/gamescom2026/
- Defold build size repo: https://github.com/defold/build-size
- Defold on Wikipedia (license): https://en.wikipedia.org/wiki/Defold
- Cocos Creator 3.8.6 release: https://www.cocos.com/en/post/f539c7888e620701228458d6b89b80c7
- Cocos Creator downloads: https://www.cocos.com/en/creator-download

Flutter
- Flutter web renderers: https://docs.flutter.dev/platform-integration/web/renderers.html
- Flutter Wasm support: https://docs.flutter.dev/to/wasm
- CanvasKit vs skwasm (Sept 2026, third party): https://startdebugging.net/2026/09/canvaskit-vs-skwasm-for-flutter-web-in-2026/

Platform rules and storage
- Google Play target API rule: https://developer.android.com/google/play/requirements/target-sdk
- WebKit storage policy update: https://webkit.org/?p=14403
- WebKit bug on Home Screen app storage: https://bugs.webkit.org/show_bug.cgi?id=237350
- MDN storage quotas and eviction: https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
