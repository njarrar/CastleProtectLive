# Week 1 Build: Castle Protect v0.1

Goal: a playable, free game on web, Android and iOS in one week. The full plan (`docs/PLAN.md`) stays the target. This week ships a smaller first version that follows the same rules, names and art direction, so later work adds content instead of rewriting.

Owner decisions are final: everything free, native iOS and Android plus web, Couch Duel at launch, portrait and landscape, human-made final art (v0.1 uses our generated concept art), and the recommendations in PLAN section 10 (launch scope 4 regions as the target, iOS 16 and Android 8, no analytics, 14-day Daily delay).

## v0.1 scope

| Area | In v0.1 | Later |
|---|---|---|
| Campaign | Region 1, Puddingstone Downs: levels 1-1 to 1-10, ending in the Topiary Keep boss | Regions 2 to 6 |
| Modes | Campaign, Skirmish vs AI, Couch Duel (2 players, one device), Test Yard | Trials, Daily, Long Siege, others |
| Classes | Lobber, Zinger, Scatterjack, Delver, Boinker, Patcher (6) | Sizzler, Peeper |
| Hobs | Marge, Quill, Jax, Grub, Bobbin, Hetty, Old Thumper, Nan (8) with their Plain Shots and Knacks | The other 20 |
| Trick Shells | 8 from the launch list, Rummage draft (pool 6, 2 picks each) | The rest |
| Doodads | Mend Bucket, Pot Lid | The rest |
| Materials | Wicker, Timber, Cobble + Footing | Brassbound, Moonbrick |
| Rules | Turns, Walk with Steam, drag aim plus Fire button, Fine Tune, Ghost and Pins, 30% preview, Weather Fronts, collapse with Lean Lines, Clean Sweep and Kettle Pop, round cap and Sudden Squall with "Squall in 3", Loophole Flap, Shove Off, self damage at 50% | Statuses beyond Burn, Rest variants |
| Progress | Pennants (3 per level), Buttons, Hob Rank 1, simple Workshop (place and remove blocks on the grid, save one Blueprint) | Tinker Tree, full Workshop |
| AI | Candidate shots tested in the sim, human-like aim error, 3 presets (Cozy, Fair, Stubborn), one habit per Rival | Personalities beyond 3 |
| Screens | Portrait (stacked lenses) and landscape, first run to first shot in under 30 s | Full accessibility set |
| Save | Local save, autosave each turn, resume | Export codes |
| Audio | A few generated sound effects | Music and barks |

## Architecture (binding contract for every agent)

```
core/                 Rust workspace, the only place game rules live
  castle-core/        sim: terrain grid, blocks, support and collapse, shells, turns, wind, win rules, AI
  castle-ffi/         C ABI for iOS and Android (staticlib + cdylib)
  castle-wasm/        wasm-bindgen wrapper for the web
content/              JSON data: materials, classes, hobs, shells, doodads, levels (schema in content/schema)
assets/               sprites (PNG), generated from tools/art-gen, plus a manifest
apps/web/             TypeScript + Vite + Canvas2D or WebGL2, PWA, offline
apps/android/         Kotlin + Jetpack Compose + a SurfaceView/GL battle view, core via JNI (.so from cargo-ndk)
apps/ios/             Swift + SwiftUI + Metal or SpriteKit battle view, core via XCFramework (built on the Mac)
tools/                art-gen, content checks, bots
```

Core API rule: apps never compute game rules. They send commands as JSON (`{"cmd":"aim","angle":620,"power":74}`, `fire`, `walk`, `pick_hob`, `pick_shell`, `end_draft`...) and read a frame snapshot as JSON (terrain changes, blocks, hobs, shells in flight, events, HUD state). JSON keeps the three bindings small this week; FlatBuffers can replace it later. Fixed tick 120 Hz, integer or Q16.16 maths only in rules, seeded random numbers, so the same commands give the same result everywhere.

Numbers come from `docs/design/00-core-game-design.md` "Canonical numbers". Names come from its glossary.

## Gates (from review 07)

| Day | Gate |
|---|---|
| 1 to 2 | `core/API.md`, schema and fixtures frozen; core compiles and passes CI; web binds to the real core |
| 3 | One map playable on the web. The owner plays it on a real phone: aim feel, collapse feel, portrait stacked lenses. Fix what fails before scaling up |
| 4 to 5 | All 10 Region 1 levels, Skirmish, Couch Duel, Workshop on web; Android and iOS bound to the real core |
| 6 to 7 | Polish, Fable code reviews and fixes, all CI green, builds published |

Renderers for v0.1: Canvas2D (web), Canvas (Android), SpriteKit (iOS). English only. Campaign levels open with Quick Pick done and "Same again" selected. Fatigue from round 10. Daily seed by date and rules version.

## Ownership

Each agent owns one folder and does not edit others. The lead merges and commits. All commits are authored as njarrar with plain messages.

## Builds run on GitHub Actions, not on a laptop

Agents write code and push to `castle-protect-plan`. GitHub Actions builds and tests everything in the cloud on every push:

| Workflow | Runner | What it does | Output |
|---|---|---|---|
| `core.yml` | ubuntu-latest | `cargo fmt --check`, `clippy`, `cargo test`, golden replay hashes | Test report |
| `web.yml` | ubuntu-latest | Build the core to WebAssembly, build `apps/web` with Vite, run Playwright smoke tests | Web build artifact, deploy to a static host |
| `android.yml` | ubuntu-latest | Android SDK and NDK, `cargo-ndk` for the core, `gradle assembleDebug` | Debug APK artifact |
| `ios.yml` | macos-latest | Build the core XCFramework, `xcodebuild` the iOS app for the simulator, run tests | Simulator app artifact (signed builds need Apple certificates added as repo secrets) |
| `determinism.yml` | ubuntu and macos | Run the same recorded battles on Linux, macOS, wasm and the Android emulator; hashes must match | Pass or fail |

Local commands are only quick checks while writing code. A change counts as done when its GitHub Actions run is green.
