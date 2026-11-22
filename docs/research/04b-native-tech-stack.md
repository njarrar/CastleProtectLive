# 04b Native Tech Stack

Date: 2026-11-22. Status: proposal for owner and leads. Replaces the mobile part of `docs/research/04-tech-stack.md` (R04). Keeps every game rule in `docs/design/00-core-game-design.md` (00) and every sim rule in `docs/review/03-technical-feasibility.md` (T03) unless this doc says so.

**Why this doc exists.** The owner set a new binding rule: ship a **native iOS app** (iPhone and iPad), a **native Android app** and a **web app**. The old plan (TypeScript, Phaser 4, Capacitor 8 WebView) no longer meets it for mobile. The game stays free with no monetization, so the build carries no purchase code and no ad SDK [00 §5.5].

**Tags.** **[web]** found in a web search on 2026-11-22, sources in section 16. **[est]** my estimate; measure it in the week 1 to 6 prototype before you trust it. **[known]** a stable fact from past work that the search did not recheck.

---

## 1. Short answer

**Pick option B: one shared core in Rust, native apps on top.**

- **Shared Rust core:** the sim (120 Hz, fixed point), terrain, castle, shots, AI, content compiler, replays, saves and export codes, Daily seed, bots. Plus a small **presentation core**: aim gesture math, camera rules, collapse choreography, audio cue rules and the accessibility tree. One source, one compiler (LLVM), every platform.
- **iOS:** Swift 6, SwiftUI for menus and HUD, a Metal view for the battle. The core ships as an XCFramework.
- **Android:** Kotlin, Jetpack Compose for menus and HUD, an OpenGL ES 3.0 view for the battle. The core ships as `.so` files built with the NDK, called through a thin JNI layer.
- **Web:** TypeScript, DOM UI, WebGL2 for the battle. The core ships as WebAssembly. Installable PWA that works offline.

**The reason in one line:** the hard part of this game is a deterministic rules engine that must give the same bits on three platforms, and a single Rust core is the only option that gives us that once, fast on a 2 GB phone, small on the web, while each app stays truly native where players touch it.

**Cost:** about **200 engineer-weeks** for launch scope, up from 133 (+50%). Team grows from 3 to 4 engineers to 6 to 7. Launch moves from weeks 46 to 52 to **weeks 48 to 54**. Detail in section 13.

**Fallback:** option E (Rust core plus a shared `wgpu` renderer) if two of the week 1, 2 and 4 gates fail. The core, content and tests carry over unchanged.

---

## 2. What the owner rule changes and what it keeps

| Area | Old plan (R04, T03) | New plan |
|---|---|---|
| Rules engine | TypeScript `packages/sim`, float64 with banned ops | Rust crate `cp-sim`, fixed point integers, no floats in rules |
| iOS app | Phaser in WKWebView via Capacitor | Swift, SwiftUI, Metal |
| Android app | Phaser in Android WebView via Capacitor | Kotlin, Compose, OpenGL ES 3.0 |
| Web app | Phaser 4 PWA | TypeScript, DOM UI, WebGL2, Rust core in Wasm, PWA |
| AI thread | Web Worker | Native thread on iOS and Android, Web Worker on web |
| Saves | Capacitor Filesystem or IndexedDB | Bytes built by the core, written by each app to native storage |
| Purchases | Optional plugin | None. No IAP, no ads, no analytics SDK |
| Backup | Defold | Option E (shared `wgpu` renderer) |

Kept as is: the 120 Hz single clock, the custom support and collapse rule (no physics engine in rules), copy-on-write terrain tiles, the work-unit AI budget (400 ms p95 on the 2 GB phone), replays as seed plus command log, crash resume by log plus snapshot, A and B save slots, export codes with the 32-symbol alphabet, data-driven shots, golden replays, bots, and every performance budget in T03 §4.1 (most get easier).

---

## 3. Facts behind the choice

**Rust and its tools**
- Rust 1.99 shipped 1 October 2026, with a 1.99.1 point release on 15 October. **[web]**
- iOS (`aarch64-apple-ios`, `aarch64-apple-ios-sim`), Android (`aarch64-linux-android`, `armv7-linux-androideabi`, `x86_64-linux-android`) and `wasm32-unknown-unknown` are all long-standing Tier 2 targets with prebuilt std. **[known]**
- Rust does not fuse a multiply and an add into one FMA unless you ask, and basic float ops follow IEEE 754. Library calls like `sin` are not promised bit exact across targets. **[known]** We use integers in the sim anyway (section 6).
- UniFFI (Mozilla's Swift and Kotlin binding generator) is at 0.32.0, released 30 June 2026, still pre-1.0 with breaking changes in Kotlin call sites. **[web]** We do not depend on it (section 7.3).
- The `rustwasm` GitHub org was wound down in September 2025. `wasm-bindgen` moved to its own org with new maintainers and is not deprecated. `wasm-pack` status is unclear. **[web]** We use `wasm-bindgen-cli` directly, not `wasm-pack`.
- `wgpu` is at 30.0.2 (12 November 2026), with a major version about every quarter. **[web]** Fast churn is a cost for option E.

**Apple**
- Since 28 April 2026, uploads to App Store Connect must be built with Xcode 26 and the iOS 26 SDK. The deployment target can stay lower. **[web]**
- Xcode 26 ships Swift 6.2. Metal 4 is supported in the 26 OS family. **[web]**
- SpriteKit is not deprecated (Apple forum reply); SceneKit was deprecated at WWDC 2025. **[web]** We still prefer a small Metal renderer (section 8.1).
- WebGPU ships in Safari on iOS 26. **[web]** WebGL2 has shipped in every Safari since 15. **[known]** The web build uses WebGL2 for reach.

**Google**
- New apps and updates on Play must target Android 16 (API 36) since 31 August 2026. **[web, via R04]**
- Apps with native code must support 16 KB memory pages. The official deadline for updates is 1 February 2027. **[web]** Our Rust `.so` files must be linked with 16 KB page alignment from day one.
- The Android Game Development Kit offers GameActivity, GameTextInput and Paddleboat (game controllers). **[web]** We use Compose plus a plain `SurfaceView` instead of GameActivity, and the stock `InputDevice` API for pads (section 9.4).

**Kotlin Multiplatform**
- Compose Multiplatform for iOS has been Stable since 1.8.0 (May 2025). **[web]**
- Kotlin/Wasm for the web is still **Beta**. Swift Export is still **Alpha** in the official docs, with a goal of Beta in 2026. **[web]**
- Kotlin/Wasm needs WasmGC in the browser. Safari added WasmGC in 18.2 (December 2024). **[known]** Older iPhones stuck below iOS 18.2 cannot run it.

**C++**
- Clang contracts `a * b + c` into an FMA by default in C and C++ (`-ffp-contract=on`), and arm64 has FMA, so the same C++ source can give different bits on arm64 and x86_64 unless every target sets `-ffp-contract=off`. **[known]** This is the classic cross-platform float trap.

---

## 4. The five options

### A. Three fully separate native codebases

Swift plus SpriteKit or Metal on iOS, Kotlin plus a custom renderer on Android, TypeScript on web. The sim is written three times.

- Most native feel and simplest builds per platform. Each team owns its whole stack.
- The sim is about 80 engineer-weeks of the 133 (T03 §7.1). Writing it three times is the biggest cost in this whole doc, and keeping three ports bit identical for replays, Daily and save codes is a forever tax. Every balance patch lands three times. Every bug can be a "which port" bug.
- Bots and AI tuning run on one port; the other two drift.
- Verdict: ruled out. Cost roughly 290 engineer-weeks **[est]** and the highest determinism risk.

### B. Shared Rust core, native UI and rendering per platform

The sim, AI, content, saves and a small presentation core in Rust. iOS gets an XCFramework, Android gets NDK `.so` files with a JNI shim, web gets Wasm. Each app writes its own UI and renderer.

- Truly native apps: SwiftUI, Compose and DOM where players tap, with native accessibility, text input, haptics and lifecycle.
- One compiler (LLVM) for all targets, and the sim uses integers only, so cross-platform bits match by construction.
- Native speed on the 2 GB phone; no WebView.
- Small web load: a Rust sim compiles to about 150 to 250 KB of Wasm after Brotli **[est]**.
- Costs: three renderers, three sets of screens, one FFI layer, a Rust learning curve for some hires.

### C. Shared core in Kotlin Multiplatform

Sim in Kotlin, compiled to JVM bytecode on Android, Kotlin/Native on iOS, Kotlin/Wasm on web. Native UI per platform (or Compose Multiplatform).

- Strong for Android. One language for Android app and core.
- Three different runtimes run the rules: ART on Android, Kotlin/Native with its own GC on iOS, a WasmGC engine on web. Integer rules still match, but GC pauses during the AI search and different collection order rules add risk.
- Web is Beta and needs WasmGC, which cuts off iPhones below iOS 18.2. Bundle with Kotlin std is larger than Rust **[est 0.8 to 2 MB Brotli]**.
- Swift interop goes through Objective-C headers until Swift Export leaves Alpha. Swift engineers get a clunky API.
- Verdict: a real option if we had an Android-heavy team and no web. We have web as a first-class target.

### D. Shared core in C++ with native shells

- Fast everywhere. Huge pool of game engineers. Emscripten for web is mature.
- Float contraction, undefined behaviour and memory bugs are real risks in a deterministic sim. CMake across Xcode, Gradle and Emscripten is slow work. Fuzzing and property tests are harder to set up than in Rust.
- Verdict: close to B on paper. Loses on safety, test tooling and the FMA trap. Pick it only if the core lead is a C++ expert and no Rust hire is found by week 2.

### E. Shared Rust core plus a shared Rust renderer (`wgpu`), native shells for menus only

- One renderer for all three: same pixels everywhere, fewer view bugs, about 8 to 10 engineer-weeks saved **[est]**.
- The battle screen, the part players see most, is no longer written natively. That bends the owner rule.
- `wgpu` changes major version about every quarter **[web]**. Its WebGL2 path and old Mali and Adreno GLES drivers on 2 GB phones are a known weak spot **[est]**. Embedding a `wgpu` surface inside SwiftUI and Compose with correct lifecycle, resize and accessibility is custom work.
- The web build grows by about 1 to 2 MB of Wasm for the renderer **[est]**.
- Verdict: the fallback. If the three native renderers fail the week 2 gate, we move to E and keep everything else.

---

## 5. Scorecard

Scores run 1 (poor) to 5 (best) for this game. Weights reflect the owner rule (native apps), the design (deterministic Daily and replays across all platforms) and the budgets (2 GB Android, small web load).

| Criterion | Weight | A Separate | B Rust core | C KMP core | D C++ core | E Rust + wgpu |
|---|---|---|---|---|---|---|
| Native feel, App Store and Play quality | 3 | 5 | 5 | 4 | 5 | 3 |
| Determinism across platforms | 3 | 2 | 5 | 4 | 4 | 5 |
| Speed on a 2 GB Android phone | 3 | 5 | 5 | 3 | 5 | 4 |
| Web load size and reach | 2 | 4 | 4 | 2 | 4 | 2 |
| Dev speed | 3 | 1 | 3 | 4 | 2 | 4 |
| Hiring | 2 | 5 | 3 | 4 | 3 | 2 |
| Testing (goldens, bots, fuzz) | 2 | 2 | 5 | 4 | 3 | 5 |
| Risk | 3 | 2 | 3 | 3 | 3 | 2 |
| Cost | 2 | 1 | 3 | 4 | 3 | 4 |
| **Weighted total (max 115)** | | **69** | **93** | **82** | **83** | **80** |

Notes on the scores:

- **Determinism.** B and E run one LLVM build of integer-only rules on every target. C runs three runtimes. D runs the same compiler but the FMA and UB traps need constant care. A ports the rules three times.
- **2 GB Android.** B and D run native code with no GC in the sim and AI. C's ART GC can pause during a 400 ms AI search that allocates. E carries driver risk.
- **Web.** B's Wasm core plus a small TypeScript view is about 350 to 500 KB of code after Brotli **[est]**, under the old 600 KB budget. C needs WasmGC (iOS 18.2+) and is larger.
- **Dev speed.** C and E share more code than B. B pays for three renderers and three sets of screens, which A also pays, plus one FFI layer.
- **Hiring.** Swift, Kotlin and TypeScript hires are easy. Rust game engineers are fewer than C++ ones but the pool grew fast; only 2 to 3 of the team need Rust.

---

## 6. Determinism plan (shared core)

The rules from T03 §1 still hold. The new core makes them stricter and simpler.

1. **No floats in the rules.** The `cp-sim`, `cp-ai`, `cp-content` (runtime part) and `cp-save` crates ban `f32` and `f64` with Clippy's `disallowed-types`. CI fails on any float in those crates.
2. **Fixed point.** Positions and velocities are Q16.16 in `i32`; products go through `i64`. A Long map is 3200 cells, so the range (plus or minus 32,768) fits with margin. Gravity is 600 cells/s², which is about 0.0417 cells per tick² at 120 Hz; Q16.16 resolves 0.000015, so drift over a 360-step flight is far under one cell **[est, check in week 1]**.
3. **Trig and roots.** `sin` and `cos` from a 3600-entry table (tenths of a degree, as the aim input already is). `atan2` by a fixed integer CORDIC. Square root by integer Newton steps. All in `cp-sim::math`, with a test that compares every table entry to a checked-in golden file.
4. **RNG.** sfc32 with the named streams from T03 §1 rule 4 (`battle`, `ai.<side>`, `hazard`, `cosmetic`). `cosmetic` lives in the presentation core and never enters the hash.
5. **Order.** No `HashMap` or `HashSet` in rules crates (Clippy `disallowed-types` again). Use `Vec` sorted by id, or `BTreeMap`.
6. **Integer overflow.** Release builds use `overflow-checks = true` in the rules crates. A wrap is a bug, not a silent difference between targets.
7. **Hash.** xxHash3 over the canonical state bytes, with the per-tile cache from T03 §1.14. Turn hash at each turn end.
8. **What enters from outside.** Only commands, the seed text and the content blob. Local date for the Daily arrives as text from the app [T03 §1.16]. No clock, no device info, no locale.

**Cross-platform proof.** Each of the five target builds (macOS arm64, Linux x86_64, iOS arm64, Android arm64 and armv7, Wasm) runs the same golden replays in CI and must give the same turn hashes (section 12).

**Daily across platforms.** The Daily must match on iOS, Android and web on the same date. Web updates the moment we deploy; store builds wait for review and for players to update. Rule: the Daily seed text carries a `tableVersion`, and a new table version (new maps, shells, Rivals) goes live only on a date set at least 14 days after the store release that carries it. Until then all three platforms use the older table. Best scores store the content hash [T03 §1.16].

---

## 7. Module boundary and FFI

### 7.1 What is shared and what is native

| Shared in Rust (`core/`) | Native per app |
|---|---|
| Battle sim, terrain, castle, crew, shots, props, zones, hazards, boss rigs | Windows, scenes, navigation, menus, HUD widgets |
| AI, draft, personalities, work-unit budget | Threads and their priorities |
| Content compiler and the compiled content blob | Asset loading (atlases, audio, fonts) |
| Campaign progress, economy, Tinker Tree, Workshop validator | Screens for all of these |
| Save format, A and B slot logic, migration chain, export and import codes | File writes and reads, atomic rename, backup flags |
| Replays, resume, golden runner | Share sheet, file pickers, clipboard |
| Daily seed and tables | Local date, notification of a new Daily (none at launch) |
| **Presentation core:** aim gesture math, Fine Tune steps, camera framing rules, collapse choreography (creak, pivot, stagger timings), shard and debris paths, audio cue rules (voice caps), sprite instance lists, accessibility tree, string keys with args | Draw calls, shaders, textures, particle drawing, sound playback, haptics, screen reader APIs, text layout and formatting |
| Bots and balance reports (CLI only) | |

**Rule:** if a choice changes the outcome, the feel of the aim, or what a screen reader says, it lives in the core so all three apps agree. If it is pixels, sound playback, layout or an OS API, it is native.

### 7.2 Shape of the API: commands in, frames and events out

Everything crosses the boundary as bytes. Structured messages use **FlatBuffers** (one `.fbs` schema set, code generated for Rust, Swift, Kotlin and TypeScript; zero-copy reads). Hot per-frame data uses plain packed structs read in place.

Commands in (FlatBuffers `Command` union): `PickHob`, `PickShot`, `SetAim {angleTenths, power}`, `Walk {dxCells}`, `Fire`, `Steer {dir}`, `UseDoodad {id, target}`, `RummagePick {slot}`, `TakeBack`, `Ready` (Couch Duel pass screen), `Concede`. The core checks every command against the rules and answers `Ok` or a reason key.

Out per display frame (`CpFrame`, read in place):
- header: sim tick, interpolation alpha, camera (x, y, zoom), phase (Plan, Resolve, End), whose turn;
- sprite instances: packed array of `{atlasFrame u16, layer u8, flags u8, x f32, y f32, rot f32, scale f32, tint u32}` (32 bytes each, 2,000 cap), already interpolated and already including collapse lean, stagger and shard arcs;
- dirty terrain chunks: list of chunk ids changed since the last frame;
- preview dots, ghost lines and pins as polylines.

Floats appear here on purpose: this is view data, never read back by rules.

Out per event batch (FlatBuffers `EventBatch`): `Carved`, `BlockDamaged`, `BlockBroke`, `ChunkFell`, `HobHit`, `Bonk`, `KettleHit`, `StatusApplied`, `TurnStarted`, `BattleEnded`, plus `AudioCue {cueId, pan, gain}`, `Haptic {kind}`, `Announce {stringKey, args}` (for screen readers) and `Caption {stringKey}`. Apps react; they never write state.

Queries (FlatBuffers request and reply), used by menus off the hot path: hand and shell cards, Hob roster, Tinker Tree, campaign map, Workshop validation, pre-battle summary, accessibility tree, settings defaults.

### 7.3 The C ABI

One hand-written Rust crate `cp-ffi` exposes about 30 `extern "C"` functions. `cbindgen` writes `cp_core.h`. Sketch:

```c
CpCore*      cp_core_new(const uint8_t* config, size_t len);
void         cp_core_free(CpCore*);
CpResult     cp_content_load(CpCore*, const uint8_t* blob, size_t len);
CpResult     cp_battle_start(CpCore*, const uint8_t* setup_fb, size_t len);
CpResult     cp_battle_resume(CpCore*, const uint8_t* save, size_t len);
CpResult     cp_command(CpCore*, const uint8_t* cmd_fb, size_t len);
void         cp_pointer(CpCore*, const CpPointerEvent* ev);   /* aim gesture input */
void         cp_key(CpCore*, uint32_t key, uint32_t mods, bool down);
void         cp_pad(CpCore*, const CpPadState* st, uint8_t side);
uint32_t     cp_sim_advance(CpCore*, uint64_t now_ns);         /* sim thread */
const CpFrame* cp_frame_acquire(CpCore*, uint64_t now_ns, const CpViewport*); /* render thread */
void         cp_frame_release(CpCore*);
const uint8_t* cp_terrain_chunk(CpCore*, uint32_t chunk_id);   /* R8, 256 x 256, valid until release */
size_t       cp_events_drain(CpCore*, uint8_t* out, size_t cap);
size_t       cp_query(CpCore*, const uint8_t* q_fb, size_t len, uint8_t* out, size_t cap);
size_t       cp_save_build(CpCore*, uint8_t* out, size_t cap, uint8_t* slot_out);
CpResult     cp_save_load(CpCore*, const uint8_t* a, size_t la, const uint8_t* b, size_t lb);
size_t       cp_export_code(CpCore*, char* out, size_t cap);
CpResult     cp_import_code(CpCore*, const char* code, size_t len);
CpAi*        cp_ai_new(const CpCore*);                          /* replica for the AI thread */
void         cp_ai_feed(CpAi*, const uint8_t* cmd_fb, size_t len);
size_t       cp_ai_think(CpAi*, uint8_t side, uint8_t* out_cmd, size_t cap);
CpVersion    cp_version(void);                                  /* sim version, content hash, save schema */
```

- **iOS:** Swift imports `cp_core.h` through a module map in a local Swift package that wraps the XCFramework. A small Swift layer (`CastleCore`) gives a typed API.
- **Android:** a `cp-jni` crate (using the `jni` crate) maps each call to a Kotlin `external fun` in `CoreNative`. The frame and terrain chunks come back as `DirectByteBuffer`s over Rust memory, so nothing is copied. A Kotlin layer gives the typed API.
- **Web:** `wasm-bindgen` exports the same functions. Frames and chunks are `Uint8Array` views on Wasm memory. The TypeScript layer rebuilds views after any `memory.grow`, and the core reserves its frame and chunk buffers at start so growth during play is rare.

**Why not UniFFI?** It suits rich object APIs, but it copies data across the line, it is pre-1.0 with breaking changes in 2026 **[web]**, and it has no web target. Our API is small, byte-shaped and hot, so a thin C ABI plus FlatBuffers is simpler and the same on all three.

### 7.4 Threading

| Thread | iOS | Android | Web |
|---|---|---|---|
| UI | Main thread (SwiftUI) | Main thread (Compose) | Main thread (DOM) |
| Render | `MTKView` draw callback on main or a display link thread | `GLSurfaceView` GL thread | Main thread, `requestAnimationFrame` |
| Sim | Dedicated `Thread`, QoS user-interactive | Dedicated `Thread`, `THREAD_PRIORITY_DISPLAY` | Main thread (see below) |
| AI | Dedicated `Thread`, QoS user-initiated | Dedicated `Thread`, background priority | Dedicated Web Worker with its own Wasm instance |
| Save write | Utility queue | `Dispatchers.IO` | IndexedDB is async already |

- The sim thread calls `cp_sim_advance` with the current time. It steps whole 120 Hz ticks and publishes a snapshot into a lock-free triple buffer inside the core. The render thread calls `cp_frame_acquire`, which interpolates between the last two snapshots and runs the presentation core. No locks on the frame path.
- **Web runs the sim on the main thread.** A 120 Hz tick costs 5 to 20 µs in a quiet flight and 1 to 2 ms on a huge blast **[est, T03 §4.1]**, so two ticks per frame fit. Wasm threads would need `SharedArrayBuffer`, which needs COOP and COEP headers on every host and breaks some embeds. The API is message-shaped, so moving the web sim into a Worker later is a drop-in.
- **AI** runs a replica core (`CpAi`) that gets the same commands and checks the turn hash, as T03 §1.13 says. It returns one command; replays never rerun the AI.
- The core itself starts no threads. Each app owns its threads, so OS rules on priority, background and memory are followed natively.

### 7.5 Terrain to the renderer, cheaply

- The terrain grid is the texture. Each 256 x 256 chunk of the byte grid uploads as a single-channel 8-bit texture (`R8`): 64 KB per chunk, a quarter of RGBA.
- One shared shader (written three times: Metal Shading Language, GLSL ES 3.00, GLSL for WebGL2) maps material id to colour through a 256 x 1 palette texture, samples the material's tiling texture, and draws the edge shade from the neighbour cells. The shader logic comes from one spec file with golden output images.
- After a carve the core marks dirty chunks. The renderer uploads only those, at most 2 per frame behind the blast flash [T03 §4.1]. A Huge blast touches 4 to 9 chunks.
- Uploads read straight from core memory: `MTLTexture.replace(region:...)` on iOS, `glTexSubImage2D` with the `DirectByteBuffer` on Android, `texSubImage2D` with the Wasm memory view on web. No copy on the app side.
- Coat grid (half resolution) uploads the same way as a second `R8` texture.
- Rubble decals and scorch stay cosmetic: the renderer stamps them into a per-chunk decal layer, never into the grid.
- Budget: at most 1 ms of upload per frame on the 2 GB phone **[est]**, down from 4 ms in the WebView plan.

---

## 8. Platform apps

### 8.1 iOS and iPadOS

- **Language and UI:** Swift 6.2, SwiftUI for every menu, the HUD and the Couch Duel pass screen. UIKit only where SwiftUI falls short (key commands, pointer interactions).
- **Battle view:** `MTKView` hosted in SwiftUI. A small sprite batcher (instanced quads from the `CpFrame` sprite list), the terrain shader, a particle pass. About 1,500 lines **[est]**.
- **Why Metal over SpriteKit:** SpriteKit would save about a week, but it hides texture upload timing, makes the shared terrain shader awkward, and its blending would look different from the Android and web renderers. One renderer design across three ports keeps screenshots comparable.
- **Deployment target:** iOS 16 and up (covers iPhone 8 and later) **[est, confirm with the device matrix]**. Built with Xcode 26 and the iOS 26 SDK as Apple requires **[web]**.
- **iPad:** full screen and Stage Manager resizing; the core gets the new viewport and the camera reframes. Pointer and trackpad through `UIPointerInteraction`; hardware keyboard through `UIKeyCommand` and `GCKeyboard`.
- **Store:** privacy manifest that declares no data collected and no tracking. No StoreKit, no ad SDK, no analytics SDK.

### 8.2 Android

- **Language and UI:** Kotlin, Jetpack Compose for every menu, the HUD and the pass screen.
- **Battle view:** `GLSurfaceView` with OpenGL ES 3.0, hosted in Compose through `AndroidView`. Same batcher design as iOS. GLES 3.0 runs on nearly every phone still in use; Vulkan on 2 GB phones has too many driver faults to be the default **[est]**.
- **SDK levels:** `minSdk` 26 (Android 8) **[est, confirm with the device matrix]**, `targetSdk` 36 as Play requires **[web]**.
- **ABIs:** `arm64-v8a`, `armeabi-v7a` (many 2 GB Android Go phones run 32-bit) and `x86_64` (emulator, Chromebooks). Shipped as an AAB, so each phone downloads one ABI.
- **16 KB pages:** link Rust `.so` files with `-Wl,-z,max-page-size=16384`; check in CI with the NDK's alignment tool and the Play Console bundle explorer **[web]**.
- **Store:** Data safety form says no data collected. No Play Billing, no ad SDK, no analytics SDK.

### 8.3 Web

- **Language and UI:** TypeScript, plain DOM for menus and HUD with a tiny view library (Preact, about 4 KB) **[known]**. Real buttons and labels, so screen readers work.
- **Battle view:** WebGL2 canvas with the same batcher design and terrain shader.
- **Core:** Wasm built with `wasm-bindgen-cli` and `wasm-opt`. Loaded with streaming compile.
- **Bundler:** Vite. Hashed file names, code split per screen.
- **Offline:** PWA with a Workbox service worker. Precache shell, code, Wasm, content and common atlases. Region atlases and music cache on first use, with "download all" in settings. Update waits for the next start, never mid-battle [R04 §12].
- **Storage:** IndexedDB, `navigator.storage.persist()` on first save, "Add to Home Screen" hint and export code on iOS Safari because of the 7-day script storage rule **[web, via R04]**.

### 8.4 Size and speed budgets (updated)

| Item | Old (WebView) | New (native) |
|---|---|---|
| Frame rate, 2 GB Android | 30 fps floor, 60 target | 60 fps target, 30 fps floor only in battery mode |
| Sim tick on low end | under 2 ms | under 1 ms **[est]** |
| AI think p95, 2 GB phone | 400 ms | 400 ms stays the rule; expect about 100 to 150 ms **[est]** |
| Terrain upload per frame | 4 ms | 1 ms |
| Memory in a match, native | 120 MB JS heap | under 150 MB whole app **[est]** |
| Web code, first load (Brotli) | under 600 KB | under 500 KB (Wasm core about 150 to 250 KB, TS view and UI about 120 to 200 KB) **[est]** |
| Web total to menu | under 3 MB | under 3 MB |
| Android download | under 30 MB | under 30 MB per ABI split (Rust `.so` about 2 to 4 MB) **[est]** |
| iOS download | under 40 MB | under 40 MB |
| Cold start to menu | under 2.5 s | under 1.5 s native **[est]** |
| Bots per CI core | about 80 matches a minute | about 250 to 400 **[est]** |

---

## 9. Cross-cutting systems

### 9.1 Audio

- The core emits `AudioCue` events after applying the voice rules from R04 §11 (at most 16 voices, at most 3 of the same cue within 50 ms), so every platform sounds the same. Music state (region, intensity stem) is a cue too.
- **iOS:** `AVAudioEngine` with pre-loaded `AVAudioPCMBuffer`s for effects and a streamed player for music. Session category `ambient` so the game respects the silent switch and other apps' music. AAC in `.caf` or `.m4a`.
- **Android:** `SoundPool` for effects (low latency is not critical in a turn-based game) and Media3 ExoPlayer for looping music. Ogg Opus. Audio focus handled.
- **Web:** Web Audio with decoded buffers. Opus in WebM, AAC fallback for older Safari. Unlock on first tap.
- **Haptics:** `UIImpactFeedbackGenerator` and Core Haptics on iOS, `VibrationEffect` on Android, nothing on web. Driven by `Haptic` events.
- One source folder of WAVs; a build script makes all three formats.

### 9.2 Saves

- The core owns the format: schema number, app version, counter, CRC32, canonical binary payload (deflate via `miniz_oxide`, same bytes on every target). Migrations `migrate_N_to_N+1` are Rust functions with a sample file per old schema in the repo [R04 §8].
- The core decides the slot (A or B) and hands bytes to the app. The app writes atomically:
  - **iOS:** Application Support folder, write to a temp file, then `replaceItemAt`. Included in device backup.
  - **Android:** `filesDir` with `AtomicFile`. Auto Backup rules include the save folder.
  - **Web:** IndexedDB, one transaction per write.
- Battle save (command log plus turn snapshot) at every turn start, 10 to 40 KB, off the frame path [T03 §1.15].
- **Export codes** come from the core, so a code made on iPhone imports on Android and web byte for byte. This is also the Couch Duel guest save path [00 §6.1].
- No cloud save at launch. Native backups plus export codes cover phone changes.

### 9.3 Input

- **One aim brain.** Apps send raw pointer events to `cp_pointer`: `{id, kind (touch, mouse, pen), phase (down, move, up, cancel), x, y in view points, time ns, buttons}`. The core's aim controller turns them into Aim Drag, Fine Tune, pin Recall, Quick Fire and camera pan and pinch, exactly as 00 §2.3 says. The 40%-of-screen-height power rule, pull-back or point mode, and left-hand mirroring all live there once.
- **Quick click must work.** The playtest found that a quick click did nothing in both reference games [PLAN §9.1]. Rules: every `down` and `up` pair counts, even inside one frame; buttons fire on `up` inside the target with no minimum hold; a tap under 10 points of travel is a tap, never a drag. The core aim controller has unit tests with down and up 0 ms, 16 ms and 50 ms apart. Native buttons (SwiftUI, Compose, DOM) handle their own taps, which they already do correctly.
- **iOS:** touches and pointer from a `UIView` subclass under the `MTKView`, Apple Pencil as touch, keyboard through `UIKeyCommand` and `GCKeyboard`, gamepads through the Game Controller framework.
- **Android:** `MotionEvent` from the `GLSurfaceView`, mouse and stylus via tool type, keys via `KeyEvent`, gamepads via `InputDevice` and `KeyEvent` or `MotionEvent` axes. Paddleboat is not needed for our button set.
- **Web:** Pointer Events (one path for mouse, touch and pen), `keydown` and `keyup`, Gamepad API polled each frame.
- **Key and pad maps** live in core data (00 §2.3 keys, 07 pad table), so the HUD shows the same key hints on every platform.

### 9.4 Portrait and landscape

- Both ship at launch [00 §2.1]. The battle view fills the screen; the HUD is native UI laid over it.
- **iOS:** SwiftUI size classes and `GeometryReader`. **Android:** Compose `WindowSizeClass`. **Web:** CSS container queries and `orientation` media queries.
- The core gets the viewport and the safe area on every change. The camera framing rule (both forts in frame at zoom 0.6 for duel gaps of 1000 to 1400 cells) runs in the core, so framing matches everywhere.
- One-hand play and the movable Fire button are HUD layout data stored in settings, read by each native HUD.
- Rotation mid-battle keeps the sim running; only the viewport changes.

### 9.5 Accessibility

- **Menus and HUD are native,** so VoiceOver, TalkBack and browser screen readers work with labels, traits and focus order we set. Dynamic Type on iOS and font scale on Android map to the 3 text-size steps [00 §8.2].
- **The battlefield** gets an accessibility tree from the core (`Query::A11yTree`): forts, Nooks, Hobs with HP and state, the Kettle, pins, wind. Each app maps it to native nodes: `UIAccessibilityElement`s in an accessibility container on iOS, `ExploreByTouchHelper` on the Android `SurfaceView`, a hidden DOM list on web. `Announce` events become `UIAccessibility.post`, `announceForAccessibility` and an ARIA live region.
- This makes the "screen reader mirror" from T03 §1.18 cheaper than in the WebView plan: the tree is built once, the mapping is small per app.
- Reduce motion follows the OS setting by default on each platform.

### 9.6 Localization

- One source of truth: `l10n/<locale>.json` with ICU MessageFormat strings and flat keys, as in R04 §13.
- A build tool generates native resources: an Xcode String Catalog (`.xcstrings`) for iOS, `strings.xml` with `<plurals>` for Android, and JSON for web (formatted with `Intl.PluralRules` and `Intl.NumberFormat`). The OS handles plurals, numbers and the screen reader language.
- The core never formats text. It sends keys with typed args (`{count: 3, hob: "hob_rake_hand"}`).
- CI checks missing and unused keys, and runs the pseudo-locale screenshot pass on all three apps.

### 9.7 Couch Duel

- In the core it is a Skirmish with two human controllers and no AI loaded [00 §6.1]. Nothing new in the sim.
- The core tracks which side is active and swaps per-side settings (left-hand layout, Fire spot, drag direction, Preview handicap) at each turn start. The native HUD reads them from the frame header.
- The pass screen is a native full-screen view with a large Ready button; `Ready` is a command, so a crash resumes with the right player's pass screen up.
- Guest save import uses the shared export code.
- **Two gamepads on one device** (one per side) works for free: `cp_pad` takes a side. Nice on iPad and Android TV boxes; "works, not promised" at launch.

---

## 10. Repo layout (monorepo)

```
CastleProtect/
  docs/
  core/                         Cargo workspace (Rust)
    Cargo.toml
    crates/
      cp-math/                  fixed point, trig tables, CORDIC, isqrt
      cp-sim/                   state, terrain, castle, actors, parts, fields, status, crew, match, rig, replay
      cp-ai/                    knowledge view, candidates, budget, score, draft
      cp-content/               schema types (serde), compiler, hash, Lump Rule and reach checks
      cp-save/                  format, slots, migrations, export codes
      cp-present/               aim controller, camera, choreography, cues, a11y tree, frame builder
      cp-ffi/                   C ABI (cbindgen header)
      cp-jni/                   Android JNI shim over cp-ffi
      cp-wasm/                  wasm-bindgen exports over cp-ffi
      cp-bots/                  headless bots and balance reports (CLI)
      cp-tools/                 level mask import, content lint, golden runner CLI
    goldens/                    replay files and expected turn hashes per sim version
    saves/                      one sample save per old schema
  content/                      JSON: shells, hobs, levels, rivals, tinker, daily tables
  schema/                       FlatBuffers .fbs (commands, events, queries, setup)
  shaders/                      terrain and sprite shader spec plus MSL, GLSL ES and WebGL2 versions, golden images
  l10n/                         ICU JSON per locale, pseudo-locale
  assets/
    src/                        SVG, raw audio, fonts
    build/                      generated atlases and audio (not in git)
  apps/
    ios/                        project.yml (XcodeGen), CastleProtect app, CastleCoreKit Swift package, XCTest, XCUITest
    android/                    Gradle project: app, core-bridge module, instrumented tests, baseline profile
    web/                        Vite app, TS view, renderer, service worker, Playwright tests
  tools/                        build scripts: xcframework, cargo-ndk, wasm, atlases, audio, l10n codegen, fbs codegen
  .github/workflows/
```

---

## 11. Build tooling

| Piece | Tool | Notes |
|---|---|---|
| Core | Cargo, pinned toolchain in `rust-toolchain.toml` | Clippy with `disallowed-types` and `disallowed-methods` in rules crates |
| iOS core | `cargo build` for `aarch64-apple-ios`, `aarch64-apple-ios-sim`, then `xcodebuild -create-xcframework` | Wrapped as a binary target in the local `CastleCoreKit` Swift package |
| iOS app | Xcode 26, project generated by XcodeGen from `project.yml` | Generated project avoids merge fights in `.pbxproj` |
| Android core | `cargo-ndk` for `arm64-v8a`, `armeabi-v7a`, `x86_64` | Called from a Gradle `Exec` task before `mergeJniLibs`; 16 KB page flag set |
| Android app | Gradle with Android Gradle Plugin, Android Studio | Version catalog; R8 on; baseline profile for start time |
| Web core | `cargo build --target wasm32-unknown-unknown`, `wasm-bindgen-cli`, `wasm-opt -Oz` | No `wasm-pack` |
| Web app | Vite, TypeScript strict, Biome | Workbox for the service worker |
| Schemas | `flatc` for Rust, Swift, Kotlin, TS | Generated code checked in so app builds do not need `flatc` |
| Header | `cbindgen` | Checked in; CI fails if it drifts |
| Assets | resvg, atlas packer, ffmpeg | As R04 §10 and §11 |
| One command | `just` recipes (`just ios`, `just android`, `just web`, `just test`) | One entry point for every engineer |

Local loop: core engineers work in Rust with `cargo test` and a desktop debug viewer (the web app run locally against a fresh Wasm build, under 10 s rebuild **[est]**). App engineers pull a prebuilt core artifact from CI if they do not touch Rust.

---

## 12. CI and release

### 12.1 CI

| Trigger | Runner | Jobs | Time target |
|---|---|---|---|
| Every push | Linux | `cargo fmt`, Clippy (bans), unit tests, property tests (proptest, 100 cases), content compile and checks, save migration samples, export code round trip, golden replays on x86_64, bot smoke (200 matches), header and schema drift check, Wasm build and size check | under 10 min |
| Every pull request | Linux | All of the above, plus Wasm goldens in headless Chromium, Firefox and WebKit via Playwright; web boot, one battle, save, reload, offline reload; web screenshot tests | under 20 min |
| Every pull request | Linux with KVM | Android emulator (x86_64, API 36): instrumented test runs goldens through JNI and checks turn hashes; Compose screenshot tests; quick-click input test | under 25 min |
| Every pull request | macOS | iOS Simulator (arm64): XCTest runs goldens through the XCFramework; SwiftUI snapshot tests; quick-click input test | under 25 min |
| Nightly | Linux, 16 cores | Property tests at 5,000 cases; 20k bot battles; red-flag report; aarch64 Linux goldens; pseudo-locale screenshot pass on all three apps | under 90 min |
| Weekly | Linux plus device farm | Full bot sweep (about 190k battles, now about 8 to 12 core-hours **[est]**); goldens on real devices: 2 GB arm64 Android, an `armeabi-v7a` Android Go phone, an old iPhone, an iPad; frame time and AI time; 100 forced-kill resumes | overnight |
| Release candidate | macOS and Linux | Signed store builds, flight mode run, freeze goldens for the sim version | |

**The cross-platform gate:** every golden must give identical turn hashes on x86_64 Linux, aarch64 (macOS and Linux), iOS Simulator, Android emulator, real arm64 and armv7 phones (weekly), and Wasm in three browser engines. One mismatch blocks the merge.

macOS runner minutes cost more, so iOS jobs run on pull requests and main only, not on every push.

### 12.2 Release pipeline

- **One version for all three.** Each build embeds sim version, content hash and save schema. A release goes out on all three in the same week.
- **iOS:** fastlane `match` for signing, `gym` to build, `pilot` to TestFlight (internal group daily from main, external group per release candidate), then App Store review.
- **Android:** fastlane `supply` (or Gradle Play Publisher) to the Play internal testing track daily from main, closed testing per release candidate, staged rollout at launch.
- **Web:** static hosting with HTTPS and long cache on hashed files (any static host: GitHub Pages, Cloudflare Pages or Netlify). Preview deploy per pull request; production deploy on release. The service worker shows "Update ready" and swaps on next start.
- **Order on release day:** web goes live after both store builds are approved, so the three stay on one content version. The Daily rule in section 6 covers players who update late.
- **Privacy:** no data collected on any platform, so App Store privacy labels and the Play Data safety form both say none. No network calls at all in the apps; the web app only fetches its own files.

---

## 13. Plan, team and effort

### 13.1 Risk prototype, weeks 1 to 6

Two core engineers from week 1. iOS, Android and web engineers from week 2. Each week ends with a pass or fail line. Two fails among weeks 1, 2 and 4 open the option E review (shared `wgpu` renderer); the core stays either way.

| Week | Build | Pass line | Fail means |
|---|---|---|---|
| 1 | Rust core: fixed point math, trig tables, RNG streams, hash, event queue, terrain grid with carve, settle, COW tiles, pour. Golden runner. Build for all targets: iOS device and sim, Android arm64, armv7, x86_64, Wasm | 100 scripted battles of random carves and pours give identical turn hashes on Linux x86_64, macOS arm64, iOS Simulator, Android emulator, one real armv7 phone and Wasm in Chromium, Firefox and WebKit. Huge carve under 0.3 ms on desktop. Pour conserves units in 10k fuzz runs. Fixed point drift under 1 cell over a 360-step flight versus a float64 reference | Fix the math layer before any feature work |
| 2 | Three thin renderers (Metal, GLES 3.0, WebGL2): R8 terrain chunks with palette and edge shader, blast VFX, 200 particles. Core linked in each app through the real FFI | 60 fps in the stress scene on the 2 GB Android phone and an old iPhone; 60 fps on a mid phone in mobile Safari and Chrome. Upload at most 1 ms per frame. Native app memory under 150 MB. Web code plus Wasm under 500 KB Brotli. No texture loss after 20 app switches. The three renderers' terrain screenshots match the shader golden images within tolerance | Half-res chunks and retest; a second fail on one platform opens the option E review for that platform |
| 3 | Castle blocks, support solver, falling chunks, Thump; collapse choreography in `cp-present`; side-by-side video against a cheap tumbling mock of the same 6 scenes | All 30 shape-table cases right [T03 §8 item 1]. Collapse under 0.5 ms. At least 4 of 6 playtesters rate the custom falls as good as or better than the mock. Same collapse frame sequence on all three apps | Spend week 4 on feel; the look lives in one crate, so fixes land everywhere |
| 4 | Flight model zoo and parts; 12 sample shots in JSON only [T03 §6]. FFI v0 frozen: commands, frame, events, queries, FlatBuffers schemas, Swift, Kotlin and TS wrappers | All 12 built with zero shot-specific code. No tunnelling in 10k fuzz shots. Preview matches flight to the cell. FFI cost per frame under 0.2 ms on the 2 GB phone, zero allocations per frame across JNI and Wasm (measured) | Add the missing part; if JNI or Wasm cost fails, batch frame data into one buffer per frame |
| 5 | AI v0 on its own thread (native) and Worker (web): replica core, knowledge view, closed-form seeds, work-unit budget, error model, bracketing. Bots CLI | Ironclad p95 at most 400 ms on the 2 GB phone and on a mid phone in the browser; Fair p95 at most 150 ms on the 2 GB phone. Hidden-info shuffle test passes. Same AI command for the same state on all platforms. Bots at least 200 matches a minute per CI core | Cut the jitter stage first; never make the budget time-based |
| 6 | Save, snapshot, resume, replay, export codes; one full battle on all three apps (two castles, 4 Hobs each, 12 shots, wind, one hazard); Couch Duel pass screen; portrait and landscape; input matrix. Go or no-go | 100 of 100 forced kills resume to the same hash on iOS and Android. Resume from log of a 15-round battle under 1 s on the 2 GB phone. An export code made on iOS imports on Android and web and gives the same profile hash. The Daily seed for 30 dates gives the same battle hash on all three. Quick click: 50 of 50 quick clicks and taps (down to up under 50 ms) register on iPad with trackpad, Android with mouse, Mac Safari, Windows Chrome, and touch on both phones. Keyboard and one gamepad play a full battle. VoiceOver and TalkBack read the main menu and the battle tree. Both orientations work on phone and tablet. Team plays 20 battles and 15 rate collapse and aim "fun" | No-go items go to the M1 plan with owners; the stack stays unless two of weeks 1, 2 and 4 failed |

### 13.2 Team shape

| Role | Count | Focus |
|---|---|---|
| Core lead (Rust, sim and physics) | 1 | Math, terrain, castle, determinism, FFI, perf |
| Core engineer (Rust, gameplay and AI) | 1 | Parts library, AI, bots, boss rigs |
| Core and tools engineer (Rust) | 1 from week 10 | Content compiler, level pipeline, Workshop logic, CI checks |
| iOS engineer (Swift, Metal) | 1 from week 2 | iOS app, Metal renderer, SwiftUI screens, iPad, accessibility |
| Android engineer (Kotlin, GLES) | 1 from week 2 | Android app, GLES renderer, Compose screens, device matrix |
| Web engineer (TypeScript, WebGL) | 1 from week 2 | Web app, WebGL2 renderer, PWA, also the debug viewer and level preview |
| Build and release (part time, or shared by the core lead) | 0.5 from week 8 | CI, device farm, fastlane, store setup |
| Game designer (systems) | 1 | Shots, crew, balance from bot reports |
| Level designer | 1 from week 6, 2 in alpha | Maps and Rivals |
| Artists | 1 plus contract animator (2 if budget allows) | Unchanged |
| Audio | contract | Unchanged |
| QA | contract from alpha | Now three apps and a device matrix per platform |

Engineers: 6 from week 2, 6.5 to 7 from week 10. Hiring note: one of the two first core hires must have shipped Rust in production. App engineers need no Rust; they work against the typed Swift, Kotlin and TS wrappers.

### 13.3 Effort, launch scope (engineer-weeks)

Old numbers are T03 §7.1 launch column. New numbers are **[est]**.

| Area | Old (TS + Capacitor) | New (Rust core + native) | Why it changed |
|---|---|---|---|
| Sim core, state, COW, hash, replay, snapshot | 6 | 6 | Same work in Rust |
| Terrain logic (grid, fluids, loose bodies) | 5 (of 9) | 5 | Same |
| Flight models, fields, parts | 11 | 11 | Same |
| Castle, support, walk, rooms, cover | 6 | 6 | Same |
| Crew, statuses, damage | 4 | 4 | Same |
| Shot content and tests | 6 | 6 | Same |
| Props, coats, zones | 4 | 4 | Same |
| Doodads | 1 | 1 | Same |
| Turn manager, Rummage, missions | 5 | 5 | Same |
| Hazards | 4 | 4 | Same |
| Boss rigs | 7 | 7 | Same |
| AI | 8 | 8 | Same |
| Save format, migration, export | 2 (of 3) | 2 | Same |
| Workshop, Tinker, map, economy logic | 3 (of 8) | 3 | Same |
| Modes logic (Daily, Trials, Skirmish, Couch Duel) | 2 (of 3) | 2 | Same |
| Presentation core (aim, camera, choreography, cues, a11y tree) | 0 | 4 | New: shared so three apps agree |
| FFI, schemas, wrappers (Swift, Kotlin, TS) | 0 | 4 | New |
| Rust ramp and fixed point conversion | 0 | 2 | New |
| **Shared core subtotal** | **74** | **84** | |
| Renderer (terrain, sprites, particles, debris) | 4 | 12 (4 per app) | Three renderers |
| HUD, aim hookup, camera hookup, input (touch, mouse, keys, pad) | 5 | 10 (iOS 3.5, Android 3.5, web 3) | Gesture math is shared; wiring is not |
| Screens (menus, map, Workshop, Tinker, pre-battle, Couch Duel, results, settings) | 5 (incl. Workshop and map UI) | 15 (5 per app) | Three UI toolkits |
| View polish (VFX, juice, anim hookup) | 6 | 9 (3 per app) | Choreography is shared; drawing is not |
| Audio, haptics, lifecycle, storage, offline | 3 | 6 (2 per app) | |
| Accessibility, localization plumbing, portrait and landscape | 4 | 7.5 (2.5 per app) | Native a11y is better and costs per app |
| Platform, store builds, PWA | 4 | 4.5 (1.5 per app) | No Capacitor; native store setup |
| **App subtotal** | **31** | **64** | |
| Tools (level import, preview, content checks) | 4 | 4 | Same |
| Bots, CI, perf rigs, device lab | 4 | 7 | Three platforms in CI, macOS runners, two device matrices |
| Beta fixes, perf, launch | 10 | 13 | Three apps to fix and submit |
| **Subtotal** | **123** by this split | **172** | |
| Contingency | 12% = 14 | 15% = 26 | Higher: three apps, more moving parts |
| **Total** | **about 133** (T03) | **about 198, call it 200** | **+67, about +50%** |

T03 shows a subtotal of 119 because some of its lines span core and app work; splitting them here adds about 4. The baseline stays T03's total of 133.

**For comparison [est]:** option A (sim written three times) lands near 290. Option C lands near 185 but with Beta web and a WasmGC cut-off. Option E lands near 190 and bends the native rule.

**If the owner wants to hold near the old budget:** ship iOS and web first, Android 8 to 10 weeks later. That moves about 22 engineer-weeks after launch. Not recommended: the 2 GB Android phone is the device that gains most from native.

### 13.4 Calendar

About 200 engineer-weeks at about 5.5 engineers on average (ramp in weeks 1 to 2, a seventh from week 10) gives about 37 weeks of build plus 6 weeks of store and launch work for three apps, plus slack.

| Phase | Done by week | Goal | Gate to pass |
|---|---|---|---|
| Risk prototype | 6 | Prove the hard parts on all three platforms | Section 13.1 week by week; two fails among weeks 1, 2 and 4 open the option E review |
| Vertical slice | 16 | Half of Region 1, 4 Hobs, 8 shells, 1 Grand Fort, final art style, on iOS, Android and web | 20 players test it across the three apps. 70% finish all levels in one sitting, the median fight is under 5 minutes, under 15% of fights reach the Squall. Goldens match on all platforms |
| Alpha | 32 | All 40 launch levels playable on all three, grey art where needed | Bots clear every level with no upgrades. Under 15% of fights reach the Squall. Feature parity list green on all three. If more than 3 weeks behind, the Fen moves to an update |
| Beta | 44 | Final art and audio, all 5 launch languages, store builds on TestFlight and Play closed testing, PWA live on a private URL | Crash-free rate, performance budgets and accessibility checks met on all three. VoiceOver and TalkBack pass on every menu |
| Launch | 48 to 54 | iOS, Android and web on one content version | Both store reviews passed; web goes live the same day |
| Updates 1, 2, 3 | About +9, +11, +11 weeks each | Long Siege, Peaks, Mines | Same bot and balance gates, three apps per update |

Updates cost about 10% more calendar than before **[est]**: content and rules are shared, but each new screen or VFX lands three times.

---

## 14. Top risks and what we do

| Risk | Odds | Hit | Action |
|---|---|---|---|
| Three renderers drift in look | Medium | Medium | One shader spec with golden images; shared sprite list and choreography from the core; screenshot tests per app |
| Rust hiring is slow | Medium | High | Hire the core lead first; app engineers need no Rust; C++ (option D) is the fallback language if no Rust lead by week 2 |
| FFI churn slows app teams | Medium | Medium | Freeze FFI v0 in week 4; FlatBuffers allow additive changes; wrappers generated or checked in CI |
| Feature parity slips on one app | High | Medium | A parity checklist per screen in CI; alpha gate needs it green on all three |
| Daily differs across platforms after a patch | Low | High | Delayed `tableVersion` rule (section 6); content hash on scores |
| GLES driver faults on 2 GB phones | Medium | Medium | Week 2 device test on 3 GPU families (Mali, Adreno, PowerVR); half-res fallback; option E only as a last resort |
| Wasm memory growth breaks views | Low | Low | Reserve buffers at start; rebuild views on growth; test |
| macOS CI cost | Medium | Low | iOS jobs on pull requests only; core tests run on Linux |

---

## 15. Decisions for the owner

1. **Approve option B** (Rust core, native apps) and the new effort of about 200 engineer-weeks with 6 to 7 engineers.
2. **Approve the launch window** of weeks 48 to 54 for all three platforms together, or choose the staggered Android launch (section 13.3) to hold cost.
3. **Confirm minimum OS:** iOS 16 and Android 8 (API 26) are proposed; the device matrix may raise them.
4. **Confirm no analytics** at launch, so all store privacy labels say "no data collected".
5. **Confirm the Daily rule** that new content enters the Daily 14 days after the store release that carries it.

---

## 16. Sources

Rust and tools
- Rust 1.96 release post: https://blog.rust-lang.org/2026/05/28/Rust-1.96.0/
- Rust release feed (1.99, 1.99.1): https://releasebot.io/updates/rust
- Rust releases on GitHub: https://github.com/rust-lang/rust/releases
- UniFFI changelog (0.32.0, June 2026): https://github.com/mozilla/uniffi-rs/blob/main/CHANGELOG.md
- UniFFI on docs.rs: https://docs.rs/crate/uniffi/latest
- Sunsetting the rustwasm GitHub org: https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org
- Future of Rust Wasm (forum): https://users.rust-lang.org/t/future-of-rust-wasm/133089
- wgpu releases: https://github.com/gfx-rs/wgpu/releases

Apple
- SDK minimum requirements (Xcode 26 from 28 April 2026): https://developer.apple.com/news/upcoming-requirements/
- Xcode 26 release notes (Swift 6.2): https://developer.apple.com/documentation/xcode-release-notes/xcode-26-release-notes
- SpriteKit continued support (forum): https://developer.apple.com/forums/thread/826562
- WebGPU in major browsers incl. iOS 26: https://web.dev/blog/webgpu-supported-major-browsers

Google
- Support 16 KB page sizes: https://developer.android.com/guide/practices/page-sizes
- Target API requirement: https://developer.android.com/google/play/requirements/target-sdk
- GameActivity text input: https://developer.android.com/games/agdk/game-activity/use-text-input
- Game controller library: https://developer.android.com/games/sdk/game-controller/controller
- New in WebGPU 146 (compatibility mode on Android): https://developer.chrome.com/blog/new-in-webgpu-146

Kotlin Multiplatform
- Stability of supported platforms: https://kotlinlang.org/docs/multiplatform/supported-platforms.html
- Swift export docs: https://kotlinlang.org/docs/native-swift-export.html
- Compose Multiplatform 1.8.0, iOS stable: https://blog.jetbrains.com/kotlin/2025/05/compose-multiplatform-1-8-0-released-compose-multiplatform-for-ios-is-stable-and-production-ready/
- Compose Multiplatform 1.9.0, web Beta: https://blog.jetbrains.com/kotlin/2025/09/compose-multiplatform-1-9-0-compose-for-web-beta/
- Kotlin roadmap: https://kotlinlang.org/docs/roadmap.html

Earlier project docs
- `docs/research/04-tech-stack.md` (old stack, budgets, saves, audio, PWA)
- `docs/research/03-code-and-tech-survey.md` (terrain, ballistics, AI, determinism)
- `docs/review/03-technical-feasibility.md` (sim design, perf, 133 engineer-weeks)
- `docs/design/00-core-game-design.md` (canonical numbers, Couch Duel, accessibility)
