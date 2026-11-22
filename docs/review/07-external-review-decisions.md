# Review 07. External Review: Decisions

An outside review of the plan, build plan and early code raised six points. The owner approved the recommended answers. These rulings bind every doc and agent.

| # | Point | Decision |
|---|---|---|
| 1 | The three apps invented different command protocols before the core API existed | Freeze `core/API.md`, one JSON Schema in `core/schema/` and golden fixtures in `core/fixtures/`. Apps bind only to that contract. Stand-in cores shrink to thin fixture players |
| 2 | `PLAN.md` and `BUILD-WEEK-1.md` disagree, and two fun risks are untested | `BUILD-WEEK-1.md` is the build plan of record. Add a **day 3 gate**: one map on the web, played by the owner on a real phone, to judge aim feel, collapse feel and the portrait stacked lenses. Content and native polish scale up only after it passes |
| 3 | Three custom GPU renderers are too much risk | v0.1 uses standard 2D renderers: Canvas2D on web, Canvas on Android, SpriteKit on iOS. Custom Metal, GLES or WebGL only if profiling demands it. Web binds to the real core first, then Android and iOS |
| 4a | Pre-battle setup is slow | The campaign keeps the Rummage, but each level opens with Quick Pick already done and "Same again" selected, so Fight is one tap. Opening the draft is optional |
| 4b | Launch scope is heavy | Keep 4 regions as the launch target and decide after playtests. **English only** for early versions (owner decision); other languages come later |
| 4c | Late fights may stall into the Squall | Add **Fatigue**: from round 10, a block that has taken damage loses support strength (stone side support 1 becomes 0 once Battered), so damaged forts fall apart sooner. Drop "round cap 12" as the fallback. Bots measure the round fights end on; target rounds 7 to 11 |
| 5a | Aim help may turn turns into arithmetic | Playtest one Ghost line against two. Default to one if testers find aiming too easy |
| 5b | Not every shot fits generic data parts | Allow a small `SpecialBehavior` enum in Rust for signature shots (Rising Fizz, Long Skewer leaving Nooks open). Stats and common parts stay in JSON |
| 6a | PR #2 mixes docs and broken work in progress | Merge the planning docs and art to `main` in a clean PR. Land code in smaller PRs that pass CI |
| 6b | Per-frame JSON could stutter | Snapshots send only changed terrain chunks and compact actor transforms |
| 6c | The 14-day Daily delay is needless | Key the Daily seed by date and rules version. No content delay |
| 6d | License mismatch | `core/Cargo.toml` uses MIT, like the repo |
