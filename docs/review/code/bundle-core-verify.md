# Bundle core check (patches 01 to 10, core and content)

Base: `ff3f679` plus the 10 patch bundle, not committed. The bundle was made with no Rust toolchain, so this is the first build and test of its core work.

## Result

All green:

- `cargo fmt --check`
- `RUSTFLAGS="-D warnings" cargo clippy --workspace --all-targets`
- `cargo test --workspace` and `cargo test --workspace --release`
- `scripts/build-wasm.sh`
- `scripts/run-golden.sh`: native and wasm hashes match (`first_lump 7debeaa57d91e349`, `twin_puddings_bots 493f0993189fa95a`, `couch_starter_box ddc58668cc9fa3fa`)

**Rules version is now 5** (`RULES_VERSION` in `castle-core/src/lib.rs`). Apps compare it with the saved value, so saves from v4 are refused cleanly. The Daily seed also changes. Note for app owners: the iOS `FakeCoreBridge` still says `"rules":4` (fixture only).

## The two failing tests

Both were rule changes made on purpose by patch 02, not broken rules. Tests updated, with comments.

1. `review_fixes.rs` `h1_a_mound_on_the_roof_does_not_lift_a_walking_fort`. Patch 02 made the Starter Box forts stepped, with an open notch at the top. Dirt from a mound now settles into that open notch, which sits inside the fort's bounding box, so the old "no dirt anywhere in the box" check failed. The H1 rule itself still holds: walking climbs only from the base through ground (`ground_under`), so roof dirt never lifts the fort. The test now runs twice: a flat roofed fort with the old strict whole-box check, and the stepped Oak fort with "no dirt in a block cell or a room under one", plus the walk check for both.
2. `rules.rs` `squall_warning_and_squall_ends_the_fight`. With Kettle 200, the second Squall leaves the kettle at 50, it cracks, the Kettle Room walls lose side reach, fall in and crush it for 30 twice (crush is now 100%). So it pops on the second Squall, not the third. The Squall rules hold: warnings 2 and 1, both hit at once, double pop to the side that went second on equal HP, and 50 + 100 + 150 still pops a full 200 kettle by the third Squall (now asserted).

## Review of the core changes

Determinism: no floats, no hash maps, no time or thread use in the sim. `no_floats` test passes. New maths widens to `i64` before multiplying (`ground_height`, `stamp`, `clear_bore`, `hill_mass`). The bore start uses an arithmetic shift on `i64`, which Rust defines the same on every target. New state (`fatigue_pct`, `Draft.auto`) is in the hash. `field_source` is only set inside one call, so it is rightly left out. Cozy's random draft pick uses the side's own AI stream. The wasm and native golden hashes agree.

FFI and wasm: no new `unsafe` beyond the existing C entry points. NULL handles are refused, `cp_daily_seed(NULL)` now returns 0, `cp_last_error` is wrapped in `catch_unwind` and uses `try_with` on the thread local. Things to know, none blocking:

- In debug builds a `wrong_thread` refusal no longer sets `last_error`. This is on purpose (it would write to the handle from the wrong thread), but the refusal text is only in the return value.
- `cp_step` and `cp_snapshot` no longer copy refusals into `last_error` (event text could look like a refusal). Panics are still recorded and kill the handle.
- wasm adds `cp_daily_seed` as a second name for `daily_seed`.

Other notes:

- The AI picks a Rival habit by looking for words in the level's free text `habit` line ("kettle", "hob", "roof", "mend" and so on). It works, but a copy edit can change how a Rival plays. A plain `habit_id` field would be safer later.
- `replay` now runs on a copy and only swaps it in on success, so a bad log no longer leaves a half replayed battle. Good.

## Balance

Bot: `core/castle-core/examples/winrate.rs` (the playtest player bot, does not read Lean Lines). 200 battles per row, a new seed each. "Before" is `ff3f679` run with the same bot today. Skirmish plays as the web app (cap 10, both sides on the Stone Skirt kit fort).

| Level | Fair before | Fair after | Fair median round | Cozy before | Cozy after |
|---|---|---|---|---|---|
| 1-1 | 99% | 100% | 6 | 100% | 100% |
| 1-2 | 86% | 84% | 9 | 80% | 83% |
| 1-3 | 95% | 96% | 9 | 98% | 98% |
| 1-4 | 94% | 96% | 11 | 95% | 98% |
| 1-5 | 87% | 88% | 10 | 95% | 97% |
| 1-6 | 84% | 89% | 12 | 90% | 98% |
| 1-7 | 83% | 93% | 7 | 87% | 95% |
| 1-8 | 74% | 76% | 15 | 83% | 95% |
| 1-9 | 70% | 76% | 13 | 79% | 88% |
| 1-10 boss | 55% | 41% | 17 | 85% | 58% |
| d1 | 62% | 64% | 12 | 62% | 97% |
| d2 | 58% | 63% | 12 | 70% | 95% |

Bundle as applied, before my tuning: 1-10 Fair 25%, d1 47%, d2 44%. Cozy is now clearly easier than Fair (before it was about the same in Skirmish).

Content tuned (two changes):

1. `bp_kit_stone` (Stone Skirt Starter Box fort) back to its old full 7 x 10 shape. The stepped version cut the bot's fort hits from 78% to 67% and Skirmish Fair to 45%. With the old shape both maps are back at 63 to 64%. The Oak and Reed kits keep their new stepped shapes.
2. 1-10 Rival: `knack_uses` 1 and `hp_pct` 75 (was full Knacks, 100%). The boss fell to 25% on Fair, from both the moved Sprinkler Root in `bp_gf1_topiary` (base code with the new content: 40%) and the round 12 Fatigue step on a cap 18 fight. Now 41%, about 2 to 3 tries.

Still off target: median end round. Early levels end on 6 to 12, later ones and Skirmish on 12 to 17. This bot does not plan collapses, and the medians were the same or longer before (13 to 16). Kettle Pop wins are still rare for the bot (under 5%). Worth a check with real players before more tuning.

## Docs

- `docs/design/00-core-game-design.md`: canonical numbers (Kettle 200, Blast 75%, crush 100%, cap 80, no Beam wall penalty, kettle crack, progressive Fatigue, Tumbled fall 45 + (fall - 64) / 8 max 70, Cover wording), the kettle, crush, fall and hard cap sections, the Squall check, and change note 37.
- `core/API.md`: rules version 5, `kettle_crack` and `fatigue.pct` events, kettle example at 200, and a "Changes for bundle patch 02 (rules version 5)" section.
