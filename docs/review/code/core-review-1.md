# Core review 1: `core/` and `content/`

Date: 2026-11-22. Scope: `core/` (castle-core, castle-ffi, castle-wasm, schema, fixtures) and `content/` at commit `9d57961`. No code was changed.

How it was checked: full read of every source file, `cargo test --workspace` (all green), `cargo clippy --workspace --all-targets -D warnings` (clean), a wasm32 release build (builds), and throwaway probes built outside the repo against the real crate. Findings marked **[probed]** were seen to happen in a probe. The rest come from reading the code.

Times are from a release build on the review server (x86_64). Phone numbers are estimates and are marked as such.

## Counts

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 5 |
| Medium | 11 |
| Low | 14 |

## What is sound

- No floats, no time, no threads, no `HashMap` in rules code. Trig is a table, square roots are integer, damage is rounded once in `i128`. All sorts are stable sorts on total keys.
- The battle random stream is used only during setup. The AI draws only from `ai.0` and `ai.1`. AI sims run on clones. The AI can not move the battle stream.
- Material HP, side support, damage multipliers, blast bands, falloff with the 25% floor, kettle 300, kettle crush 50%, kettle cap 60 with falls counted, the full HP Bonk clamp, self damage 50% with the 1 HP stop, Cover, Loophole Flap, Shove Off 15, Steam 100 and 40 per turn, Squall 50/100/150 and 10/20/30, the double pop rule, the Squall warning and Fatigue from round 10 all match the canonical numbers.
- 600 random couch battles with random aims, shots, walks, dials and Doodads ran with no panic and no stuck phase, once aims near straight up were left out (see C1).

---

## Critical

### C1. A beam fired near straight up overflows and crashes the app [probed]

- Where: `core/castle-core/src/actor.rs:185` and `:213` (position add), `core/castle-core/src/effects.rs:85` (age cap 2400), `content/shots.json` `sunspear` (`speed_pct` 300, `gravity_pct` 0), `core/Cargo.toml:26` (`overflow-checks = true` in release).
- Defect: a shell above the map top is never ended. A beam has no gravity and no wind, so it never comes back. Position is Q16.16 in `i32`, which holds 32,767 cells. Sunspear at power 100 moves 30 cells a tick and passes that limit after about 1,100 ticks, before the 2,400 tick age cap. The add panics.
- Failure: level 1-2 or later. Pick Quill, pick the Knack, aim 90.0 degrees, power 100, Fire. Probe result: `panicked at actor.rs:185: attempt to add with overflow`. Angle 88.0 at power 100 panics too. Straight up does it from about power 46. At power 100 so does any angle within about 2 degrees of straight up, more on wide maps. On iOS and Android the panic aborts the process (C3). On web the wasm traps and the battle is dead.
- Fix: in `fly_tick`, end a shell as `Hit::Off` when it is above the top and can not return: a beam at `y < 0`, any shell above `-4 * h`. Use checked or saturating adds for positions. Add a content check that a shot with `gravity_pct` 0 has `life_ticks` set.

### C2. Tick-Tock Crock wake indexes a prop list that it shrinks [probed]

- Where: `core/castle-core/src/battle.rs:858-877` (wake loop), `core/castle-core/src/effects.rs:1275` (`props.retain`).
- Defect: `begin_turn` collects prop indexes, then for each one removes that prop and runs its blast. The blast removes other broken shell props, so the saved indexes go stale.
- Failure: side 0 has an Old Turnip prop on the field (10 HP, it stays all battle). Later Old Thumper lands a Tick-Tock Crock within 42 cells of it. At side 0's next turn start the Crock wakes, its Large blast breaks the turnip, both leave the list, and the loop reads `props[0]` of an empty list. Probe result: `panicked at battle.rs:866: index out of bounds: the len is 0 but the index is 0`. The Starter Box kits hold both Old Thumper and Old Turnip, so Couch Duel can reach this in normal play. With other props still in the list, the stale index hits the wrong prop instead: a rival Crock goes off early and counts as the wrong side's shot.
- Fix: collect prop ids, not indexes. Look each one up by id in the loop and skip it if it is gone.

### C3. Panics cross the C ABI and are never caught

- Where: `core/castle-ffi/src/lib.rs:37-145` (no `catch_unwind` in any `extern "C"` function), `core/castle-wasm/src/lib.rs:15-34`.
- Defect: a panic that reaches an `extern "C"` function aborts the whole process. The release profile turns every integer overflow into a panic, and C1, C2 and M3 are panics a player or app can cause. On wasm a panic is a trap: wasm-bindgen then leaves the `Game` marked as borrowed, so every later call throws.
- Failure: any of C1, C2, M3 closes the app with no message and no save on iOS and Android. On web the battle screen freezes for good.
- Fix: wrap the body of every `extern "C"` function in `std::panic::catch_unwind(AssertUnwindSafe(..))`. On a panic, store the message in `last_error`, mark the handle as poisoned, and return `{"ok":false,"reason":"panic"}` (or NULL). Later calls on a poisoned handle return the same refusal. On wasm, set a panic hook that keeps the message, and let the app rebuild the battle from its log. Add a test that feeds a panicking command through `cp_command` and expects a refusal.

---

## High

### H1. Dirt from a mound lifts a walking fort into the air [probed]

- Where: `core/castle-core/src/battle.rs:1768-1789` (walk uses `terrain.surface`), `core/castle-core/src/terrain.rs:107` (scans from the sky down), `core/castle-core/src/effects.rs:644-650` (Mound stamps into every air cell, also inside the fort).
- Defect: a Sod Sack mound that lands on a fort leaves Loam inside the fort's own box and on its roof. `walk` takes the highest ground under the footprint by scanning from the top of the map, so it finds that dirt and sets `base_y` to it.
- Failure: Sod Sack on the roof of the left fort on Twin Puddings, then that side walks 4 cells. Probe result: `base_y` went from 354 to 156. The fort now sits 198 cells up on a clod that hangs in the air, and paid the uphill price. Walking back does not undo it. The next carve in those columns drops the clod, and the fort then falls more than 48 cells and takes a Thump (10 to every block and Hob). The AI walks whenever no shot scores, so it does this to itself.
- Fix: find the walk height from the fort's base, not from the sky: start at `base_y`, climb while the cell is solid, and refuse a step that climbs more than a set height. Settle loose ground in the old and new footprint when a fort moves. Better still, do not stamp mound dirt into cells inside a fort; keep burial as a flag on the Loophole.

### H2. Firing a Plain Shot while resting wipes the Rest cog [probed]

- Where: `core/castle-core/src/battle.rs:1639-1643`.
- Defect: `hm.rest = if rest > 0 { rest + 1 } else { 0 }`. When every Hob rests, the lowest Rest Hob may fire a Plain Shot. That Light shot sets its Rest to 0.
- Failure: a lone Old Thumper fires the Heavy Crock (Rest 2). Next turn he fires a Plain Shot, as allowed. The turn after he fires the Crock again. Probe result: Knack on turns 1 and 5, Plain on 3 and 7, with `rest` back to 0 after each Plain Shot. Heavy costs the same tempo as Medium, and a small crew never sits out. Canon: Heavy sits out the next two turns.
- Fix: never lower Rest on firing: `hm.rest = hm.rest.max(if rest > 0 { rest + 1 } else { 0 })`. Add a test with one Hob and a Heavy shot.

### H3. The AI spends its whole budget on the first Hob's Plain Shot [probed]

- Where: `core/castle-core/src/ai.rs:447-506` (solve loop, `if units > t.budget / 2 { break; }` at `:486`), `:258-322` (28 probes of up to 700 ticks per target).
- Defect: aims are solved Hob by Hob, shot by shot, in list order. One Hob, one shot and seven targets use the whole solve half of the budget. Later Hobs and shots get no candidates.
- Failure: 24 Cozy against Cozy battles on d1, d2, 1-8 and 1-9: 850 of 852 turns were Hob 0's Plain Shot, and all 24 battles ended in a double pop at round 18. Fair fired Hob 0 on 62% of turns and 17 of 24 battles ran to the last Squall round. The target is an end in rounds 7 to 11. The Rest rule, Knacks and Trick Shells are close to unused by the Rival, and a Cozy Rival never wins.
- Fix: give each Hob and shot a fair share. Solve one rough aim per Hob, shot and target first (two angles, four power steps, a shorter probe), keep the best few, then refine. Walk the Hobs breadth first and start from a Hob picked with the AI stream. Add a bot test that fails when one Hob takes more than 60% of a side's shots, or when the median end round is over 12.

### H4. Every full snapshot hashes the whole map [probed]

- Where: `core/castle-core/src/snapshot.rs:217`, `core/castle-core/src/battle.rs:2210`, `core/castle-core/src/terrain.rs:238-244`, `core/castle-core/src/battle.rs:1987` (every command sets `snap_full`).
- Defect: the state hash walks all terrain bytes (1.7 MB on a Standard map) one byte at a time. It is in every full snapshot, and every command, also every `aim`, forces a full snapshot. The preview probe (up to 900 ticks) runs each time too.
- Failure: measured 2.0 ms per hash and 2.5 ms per full snapshot after an `aim`. On a 2 GB phone core that is likely 15 to 25 ms (estimate), more in wasm. An aim drag sends `aim` every frame, so the drag itself drops frames. This is the aim feel the day 3 gate tests.
- Fix: keep one hash per 64 x 64 tile, updated in `Terrain::set`, and fold those. Or drop `hash` from the snapshot and leave it to the `hash` command and to turn ends. Cache the preview by (Hob, shot, angle, power, wind, terrain version).

### H5. The command log does not replay to the live state [probed]

- Where: `core/castle-core/src/battle.rs:1920-1930` (`run_until_plan` cuts each settle to 1 tick), `:2204` (hash includes `tick`), `:2130-2135` (`ai_turn` in the draft picks with no log entry), `:2252-2268`, `core/castle-core/tests/golden.rs:34-50`.
- Defect: API.md says replaying the log gives the same hash. The test for it uses `run_until_plan` on both sides, which skips 59 of the 60 settle ticks. A live app steps real ticks.
- Failure: 1-1, one aim and one fire, stepped tick by tick: tick 293, hash `e0696b71981f6965`. The same log through `run_until_plan`: tick 234, hash `49cba20b510f6979`. Any replay check, save check or Daily check against a live battle fails. Also: `ai_turn` during the draft calls `quick_pick` and logs nothing, so that log can not be replayed. And AI memory and the AI streams are not in the log, so a battle resumed from its log faces a Rival whose aim error is back to first shot size. Quit and resume resets the Rival's bracketing.
- Fix: make `run_until_plan` run the full settle, or take `tick` out of the hash and hash a turn counter. Log draft picks made by `ai_turn`. Add a real save: serialise battle state with the AI streams and memory, or log `ai_turn` itself and replay it. Add a test that plays live with `step(2)` and compares with the log replay.

---

## Medium

### M1. A kettle popped at a round start does not end the fight [probed]

- Where: `core/castle-core/src/battle.rs:1020-1030` (Fatigue collapse), `:1097-1123` (Squall collapse), `:1014-1017`.
- Defect: the Fatigue collapse at round 10 and the collapse after a Squall hit can crush a kettle or Bonk the last Hob. No win check follows. The Squall path checks kettles only, not a Clean Sweep.
- Failure: a fort with a Cobble roof over the Kettle Room, two roof blocks 1 HP down, kettle at 20. At the start of round 10 Fatigue drops the roof, crush takes the kettle to -10. Probe result: phase `plan`, side 0 to move, no result. Side 0 plays a full turn with a popped kettle. If that turn pops the rival kettle, the fight ends as a double pop and side 0 can win.
- Fix: call `check_win()` after the collapses in `round_start` and after `squall_hit`, before `begin_turn`.

### M2. Barn Raising with the Puff Up dial rebuilds and revives [probed]

- Where: `core/castle-core/src/battle.rs:1688-1696`.
- Defect: for self shots the filter keeps triggers with no dial and triggers with the picked dial. `effects.rs:33-49` has the right rule (exact dial first, else no dial) but `fire` does not use it.
- Failure: Hetty fires `{"cmd":"fire","dial":"puff_up"}` with 4 blocks lost and one Hob Bonked. Probe result: one `rebuild` event with 4 blocks and one `puff_up` event. Canon says rebuild 4 blocks or re-inflate one Hob.
- Fix: use `self.triggers(shot, TriggerOn::Fire)` after `c.dial` is set.

### M3. Bad command values crash or act on the wrong thing [probed in part]

- Where and defect:
  - `battle.rs:1748`: `dx.abs()` panics for `{"cmd":"walk","dx":-2147483648}` [probed].
  - `battle.rs:632`: `steam += 20` panics when the setup gives `steam` near `i32::MAX`.
  - `battle.rs:2041`, `:2112`: `as u8` wraps, so `{"cmd":"pick_hob","hob":256}` picks Hob 0 and says `ok` [probed].
  - `battle.rs:2086`: `as usize` cuts a `u64`. `{"cmd":"recall","ghost":4294967296}` recalls ghost 0 on wasm32 and is refused on 64 bit. This is a real cross platform split, and the command is logged on one side only.
  - `battle.rs:2085-2110`: `recall` has no phase or `acted` check. It runs in `resolve`, `draft` and `ended`, changes the kept aim and is logged [probed].
  - `battle.rs:2077-2082`, `:2111`: a number with a fraction is ignored and the reply is still `ok: true`. `{"cmd":"aim","angle":452.7}` changes nothing [probed]. An app that sends a fraction, or uses a JSON writer that prints a whole double as `12.0` (kotlinx.serialization does), gets silent no-ops.
- Fix: parse every number through one helper that takes `i64`, checks the range and returns `bad_value`. Refuse non-integers. Clamp `dx` to the map width before `abs`. Give `recall` the same phase check as `aim`.

### M4. The state hash leaves out much of the state

- Where: `core/castle-core/src/battle.rs:2202-2249`.
- Defect: not hashed: Doodads left, draft pool and picks, future fronts, `squall_dir`, `first_side`, `acted`, the selection, `buried`, `grudge`, `clatter`, `extra_rest`, `puff_up_used`, `turns_taken`, block `max` and `root`, prop side and kind, the settle counter, score and stats.
- Failure: a port bug that flips Old Grudge, a Doodad count or the Puff Up flag gives the same golden hash on every platform until much later, or never.
- Fix: hash every field that can change a later result. Easiest: one `hash_into` per struct, with a test that changes each field in turn and expects a new hash.

### M5. One shot can hold the turn for up to 20 seconds [probed]

- Where: `core/castle-core/src/battle.rs:17` (`MAX_ACTOR_AGE` 2400), `core/castle-core/src/effects.rs:85-88`.
- Defect: the only limit on flight is 2,400 ticks. A shell that ages out ends with no `miss` event and no pin.
- Failure: Sunspear at 75 degrees, power 10: 2,401 ticks. Hatpin at 85 degrees, power 100: 2,057 ticks (17 s). Rubber Radish straight up: 1,875 ticks. Canon: flight 1.5 to 3.5 s, a hard 4 s cap on any AI resolve.
- Fix: end beams that leave the top at once (C1). Cap flight at about 720 ticks for other shots, or speed the sim up once a shell is far above the map. Send `miss` when a shell ages out.

### M6. Error reporting and string handling in the C ABI

- Where: `core/castle-ffi/src/lib.rs`.
- Defects:
  - `:12`, `:96-102`: `CpGame.last_error` is never set. `cp_last_error(handle)` always returns NULL. API.md says it returns the last error.
  - `:28`, `:48`, `:99`: `LAST_NEW_ERROR` is a `static mut` with no lock. Two threads in `cp_new` (a preload thread and the UI thread) is a data race. A later good `cp_new` does not clear the old error.
  - `:15-20`: bad UTF-8 becomes `""`. For `content_json` that means the built in content is used with no error. `"{}"` does the same (`content.rs:744`).
  - No guard on one thread per handle. A render thread calling `cp_step` while the UI thread calls `cp_command` is undefined behaviour.
- Fix: set `last_error` on every refusal and caught panic. Put the `cp_new` error behind a `Mutex`, or return it through an out parameter. Return an error for bad UTF-8. In debug builds store the owning thread id in the handle and refuse calls from another thread.

### M7. Cozy rules and other AI rules are not enforced

- Where: `core/castle-core/src/ai.rs:447-585`, `:601-612`.
- Defects: canon says Cozy never Threads a Loophole. Nothing in the AI stops it; a Cozy Zinger's Hatpin sim that Threads is scored and fired like any other. In 60 Cozy games on 1-2 (231 Hatpins) no Thread happened, so today it is luck, not a rule. The same holds for "the AI never fires a Dud" (Old Turnip costs 0 in `shell_cost`, `:204-222`), the Sporting rule for Cozy and Fair, Cozy's 50% Shove Off and Doodad use, and the anti-lock rule (walk or change target after two hits from one aim). Budgets are 60k/120k/180k in code and API.md, 48k/96k/144k in design doc 04.
- Hidden information: the AI does not read the rival's hand, Doodads, draft picks or aim. The knowledge view still carries all future Weather Fronts, `squall_dir` and every random stream. Nothing reads them now.
- Fix: drop candidates whose sim raised `threaded` when the preset is Cozy. Skip `dud` shells. Add the Sporting weight. Wipe `fronts` past the forecast and the other side's streams in `knowledge()`. Settle the budget numbers in one place.

### M8. Level 1-7 (Rescue) has a Squall and can be won without the rescue

- Where: `content/levels/1-7.json` `rules`, `core/castle-core/src/battle.rs:1127-1179`.
- Defect: canon says Rescue has no Squall. 1-7 does not set `"squall": false`, so the default applies. `check_win` also lets a Kettle Pop or Clean Sweep win a Rescue level, and a captive at 0 HP changes nothing but a Pennant.
- Failure: the player ignores the Cage, pops the kettle or sits through the Squall, and gets "Free Hetty" with Hetty still caged. Or the Squall ends 1-7 as a double pop.
- Fix: set `"squall": false` and a cap rule for 1-7 (the cap runs out, the player loses). When `objective` is set, decide whether other win paths count, and add a loss when the captive reaches 0 HP if the level doc wants it. Have `Content::check` refuse `type: rescue` with `squall: true`.

### M9. The validator and content checks miss cases that break the sim

- Where: `core/castle-core/src/castle.rs:173-226`, `core/castle-core/src/content.rs:753-881`.
- Defects:
  - `validate_blueprint` does not run the support solver. A Workshop fort with hanging blocks passes. They all fall on the first damage anywhere on the field, and can crush that fort's own kettle on the rival's first miss.
  - The Block Budget check (`:222`) can never fail: 8 x 10 less the Footing row is 72.
  - `Content::check` has no checks for: duplicate ids (`shot_index` then finds the last one and `Content::shot` the first), split or prop cycles (a child that splits into itself on `expire` keeps `resolve` alive for ever), level `width` and `height` above 0 and wider than a fort (`battle.rs:463` `clamp` panics, `terrain.rs:44` panics), pads at least a fort plus 64 apart, HP above 0, known Pennant types (a typo gives a Pennant no one can earn), `first_turn` 0 to 2, `cap_win` 0 or 1, a block glyph that is one character and not `.`, `K`, `r` or a digit, and the per shot 110 cap.
  - `sides[i].doodads` in the setup are not checked against content.
- Fix: add these checks. Run `solve` in the validator and refuse any block with no support.

### M10. Collapse and event gaps

- Where: `core/castle-core/src/effects.rs:1296` (6 passes), `:839-853` (Thump), `core/castle-core/src/battle.rs:1084-1094` (Squall), `:1105-1108`, `effects.rs:1401-1405`.
- Defects: the collapse loop stops after 6 passes, so a long chain (crush breaks a block, more falls) can leave blocks with no support until the next damage. Blocks broken by a Thump or a Squall are removed with no `break` event. A Squall pop sends `kettle_pop` twice (in `apply_kettle` and in `squall_hit`). `big_drop` is sent again on every later pass of the same shot.
- Fix: loop until no chunk falls (the grid is at most 80 slots, so it ends). Send `break` for every removed block. Send `kettle_pop` and `big_drop` once.

### M11. Terrain chunks are too coarse for per frame JSON [probed]

- Where: `core/castle-core/src/terrain.rs:7` (`CHUNK` 256), `core/castle-core/src/snapshot.rs:69-82`.
- Defect: one changed cell resends a 256 x 256 chunk, about 87 KB of base64. A blast on a chunk corner resends four.
- Failure: a Mole Mail shot had a 171 KB frame. The first snapshot and every `terrain_all` is 2.3 MB of JSON (11 ms to build on the server). On a 2 GB phone the JNI string copy plus the JSON parse of frames this size will stutter (estimate).
- Fix: send dirty 64 x 64 tiles, or a dirty rectangle per chunk. Longer term, pass terrain bytes outside the JSON.

---

## Low

### L1. A Loophole buried in Rock can not be cleared

`battle.rs:1281-1291`, `terrain.rs:176-186`. `clear_rect` skips cells with `bore_pct` 0. A fort that has sunk next to Rock keeps the Hob buried. Shove Off takes 15 Steam and clears nothing, and the "newest burial clears" rule sends `dug_out` while the Hob stays buried. With one Hob the side can only pass. Fix: clear every solid cell in the Loophole box, or do not count Rock and Bedrock as burial. Refund Steam when nothing cleared. Also `shove_off` (`:1811`) accepts a Bonked Hob whose `buried` flag is stale.

### L2. Pot Lid does not stop rollers or bores

`effects.rs:167-176` checks the lid only on a flight contact. A Rolypoly that stops at the wall or a Burrowbomb that bores in bursts with the lid still up. Fix: check `lid_at` in `roll_stop` and `bore_stop`.

### L3. Apex triggers never fire for a flat shot [probed]

`actor.rs:176`, `:214`. `was_rising` is read after gravity is added. At angle 0 or 180.0 the shell is never rising, so Pepper Rain does not split (0 `split` events in the probe) and Nosy Goose never guides. Fix: treat a shell that starts with `vy >= 0` as past its apex on the first tick and fire the trigger.

### L4. A split on a bounce trigger would not end the parent

`effects.rs:226`. The return value of `run_effects` is dropped, and `resolve_tick` (`:72-74`) writes the local copy back over the `done` flag. No shipped shot splits on bounce. Fix: `if self.run_effects(..) { a.done = true; return; }`.

### L5. Left and right do not mirror to the last bit

`math.rs:23`, `:29-30`, `actor.rs:184-185`. `fx_mul` floors, `pct` floors with `div_euclid`, sub steps cut toward zero. For a Hatpin (`wind_pct` 40) wind -3 pushes 55 units a tick and wind +3 pushes 54. Side 1's launch speed is up to one unit larger than side 0's at the mirror angle. The same on every platform, so not a determinism bug. It is a small fairness skew. Fix: round symmetric (toward zero or half away from zero) in all three.

### L6. The selection goes stale

`battle.rs:920-929`, `:2056-2070`. After a Trick Shell is fired, or the last Knack use, `sel.shot` keeps that value. The next turn's preview is empty and Fire returns `not_in_hand` or `no_knack_uses` until the app sends `pick_shot`. Fix: reset to `plain` in `begin_turn` when the shot is no longer valid.

### L7. Wasted Actions are accepted

`battle.rs:1863-1872` (Mend Bucket with nothing to mend still uses the Doodad and the turn), `effects.rs:689-693` (Mendglob with a `target` outside the grid does nothing), `effects.rs:764-779` (Puff Up with no Bonked Hob or free Nook still uses the Knack), `effects.rs:714-731` (a mend digs out only the first buried Hob it finds). Fix: refuse before paying, with a reason.

### L8. Walk rules differ from canon

`battle.rs:1772-1780`. Mud does not cost x3. A fort can climb a cliff of any height in one 4 cell step for 2 Steam. A walk off a drop of 49 to 64 cells gives no Thump. Fix: add the mud price, a climb limit and the Thump.

### L9. The snapshot shows the rival's kept aim and both hands

`snapshot.rs:131`, `:186`. API.md says aim is for the side to move only. In Couch Duel a curious player can read the other side's aim from the snapshot. Fix: blank `aim` for the side not on turn.

### L10. Lean snapshots do full work, then throw it away [probed]

`snapshot.rs:83-142` builds every block, room, Hob and two support solves before the `full` test at `:143`. Measured 163 microseconds per lean snapshot. Fix: test `full` first.

### L11. The log keeps every `aim`, and the AI clones it

`battle.rs:1988-1990`, `ai.rs:146`. A drag sends thousands of `aim` commands. All are kept, all are returned by `log`, and `knowledge()` deep copies them each AI turn before clearing them. AI sims also build JSON events that no one reads. Fix: fold a run of `aim` commands into the last one. Clear before the clone. Add a flag that turns events off in sims.

### L12. AI think time is close to the limit on slow devices [probed]

`ai.rs:325-350`, `:557-568`. Measured `ai_turn`: Cozy p95 13 ms, Fair 26 ms, Stubborn 35 ms, worst 58 ms. A 2 GB phone core is likely 8 to 10 times slower (estimate), and wasm slower again, so Stubborn can pass 400 ms. Work units do not count clones, collapse solves, events or the end of turn. A walk reruns the whole plan and doubles the cost. `ai_turn` blocks the calling thread. Fix: count units per sim tick inside the sim, cap the replan after a walk, and measure on the real phone.

### L13. Determinism is not proven on 32 bit ARM, and CI pins disagree

Reading the code, the golden hashes should match on arm64, x86_64, armv7 and wasm32: all maths is `i32`, `i64`, `u64` or `i128`, shifts on signed values are arithmetic in Rust, and no `usize` reaches the hash. The one split found is M3 (`recall` index). Gaps: no job runs the goldens on armv7 (the Android 32 bit ABI), and BUILD-WEEK-1 promises an Android emulator run that does not exist. `core/rust-toolchain.toml` pins 1.97.0 while `determinism.yml` sets 1.99.1; `core/Cargo.toml:14` pins wasm-bindgen 0.2.100 while the workflow sets 0.2.130, and the CLI must match the crate. Fix: one version source, and an armv7 golden run under qemu. Also, overflow panics depend on the workspace profile; a build with another profile wraps in silence. Use `checked_` or `saturating_` maths where overflow can happen so the result does not hang on a flag.

### L14. API.md and behaviour differ

- `cp_last_error(handle)` never returns text (M6).
- "Replaying the log gives the same hash" is false against a live battle (H5).
- `hobs[].aim` is sent for both sides (L9).
- `mode: "test_yard"` is accepted and does nothing special.
- wasm `new Game(content, level, seed)` needs a `BigInt` seed. API.md does not say so; a plain number throws.
- A null handle makes `cp_step` and `cp_snapshot` return `{}`, and `cp_command` returns reason `null_handle`, which is not in the refusal list.
- `content_json` of `"{}"` or bad UTF-8 loads the built in content.
- The reply to `ai_turn` also has `results`. In the draft it returns no `commands`.
- `events` list: no `break` for Thump or Squall losses; `kettle_pop` can come twice (M10).

---

## Test gaps

| Area | Missing test |
|---|---|
| Crash safety | A fuzz test in CI: random commands and aims over every shot, with aims at 0, 90.0 and 180.0 degrees and power 0 and 100. It would have found C1. A test that fires every shot straight up |
| Props | Two props of one side close together at turn start (C2). Props of both sides mixed in the list |
| FFI | A panic inside a call must come back as a refusal. NULL and bad UTF-8 for each string argument. `cp_last_error` after a bad command. Free of NULL |
| Replay | Live stepping with `step(2)` against log replay (H5). A draft played with `ai_turn`. Save and resume with the AI in the same state |
| Rest | One Hob crew with Medium and Heavy shots (H2). Two Hobs both resting |
| Walk | Walk after a mound on the fort (H1). Walk up a cliff, into mud, off a 60 cell drop |
| Round start | Fatigue collapse that pops a kettle or Bonks the last Hob (M1). Squall collapse that Bonks the last Hob |
| Dials | `puff_up` gives no rebuild (M2). Fire of a dial only Knack with no dial |
| AI | Share of shots per Hob and per shot kind, median end round, Plain Shot share 25% to 40% (canon 9.4). Cozy raises no `threaded` event. No Dud fired. Think time budget in units per preset |
| Hash | Each state field changes the hash (M4) |
| Golden | The three replays have no bore, roller, prop wake, Column, mound, Thread, Pot Lid block, Fatigue collapse, Rescue win or boss regrow. Add one replay per rule family. Run them on armv7 |
| Floats | `no_floats.rs` looks for the words `f32` and `f64` only. A bare literal such as `0.5` or a call to `as_f64` passes. Clippy catches arithmetic, not casts. Add a check for float literals |
| Content | Bad content cases: cycle, duplicate id, zero width map, unknown Pennant type, hanging blocks in a blueprint, Rescue with a Squall |
| Collapse | A chain longer than 6 passes. A chunk that lands on a Nook two columns wide. Crush on a kettle with the 60 cap already used |
| Input | Fractions, negatives, values past `u8` and `i32`, for every numeric command field (M3) |
