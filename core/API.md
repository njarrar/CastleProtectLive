# Castle Protect core API (v0.2)

Rules version 2 (`cp_version().rules`). What changed from v0.1 is listed in
"Changes in v0.2" at the end of this file and in the Fixes section of
`docs/review/code/core-review-1.md`.

The core owns every game rule. Apps send commands as JSON and read frame
snapshots as JSON. Same calls on all three platforms:

| C ABI (`castle-ffi`, header `castle-ffi/include/castle_core.h`) | Wasm (`castle-wasm`) | What it does |
|---|---|---|
| `CpGame* cp_new(const char* content_json, const char* level_json, uint64_t seed)` | `new Game(content_json, level_json, seed)` or `cp_new(...)` | Start a battle. Returns NULL (C) or throws (Wasm) on a bad setup; `cp_last_error(NULL)` (C, per thread) or `last_error()` (Wasm) gives the reason. Wasm: `seed` is a u64, pass a `BigInt` (`42n`); a plain number throws |
| `char* cp_command(CpGame*, const char* json)` | `game.command(json)` | Apply one command, or a JSON array of commands. Returns the reply JSON |
| `char* cp_step(CpGame*, int32_t ticks)` | `game.step(ticks)` | Advance the sim by whole 120 Hz ticks. Returns `{"tick":n,"phase":"..."}` |
| `char* cp_snapshot(CpGame*)` | `game.snapshot()` | The frame snapshot. Drains events and dirty terrain chunks |
| `void cp_free_string(char*)` | (not needed) | Free any string the C ABI returned |
| `void cp_free(CpGame*)` | `game.free()` | Free the battle |
| `char* cp_last_error(CpGame*)` | `last_error()` / `cp_last_error()` | The last refusal reply (JSON) or panic text for that handle; with NULL, this thread's last `cp_new` error. NULL when there is none |
| `char* cp_version(void)` | `cp_version()` | `{"sim":"0.2.0","rules":2,"tick_hz":120}` |
| `char* cp_golden_hashes(void)` | `golden_hashes()` | Golden replay hashes, one `name hash` line each |
| `uint64_t cp_daily_seed(const char* date)` | `daily_seed(date)` | Daily Dust-up seed from the local date text (`2026-11-22`) and the rules version |
| | `default_content()` | The built in content bundle as JSON |

All strings are UTF-8. Every `char*` the C ABI returns must go back through
`cp_free_string`. The core starts no threads; call it from one thread per
handle (debug builds refuse a call from another thread with
`wrong_thread`). A string argument that is not valid UTF-8 is an error
(`cp_new` returns NULL, `cp_command` replies `bad_json`), never "".

### Errors and panics

- No panic crosses the C ABI. Every function runs inside `catch_unwind`.
  A panic during a call on a handle returns
  `{"ok":false,"reason":"panic","detail":"..."}` (from `cp_command`,
  `cp_step` or `cp_snapshot`), stores `panic: ...` for `cp_last_error`, and
  marks the handle **dead**: every later call on it returns
  `{"ok":false,"reason":"dead_handle",...}` and touches nothing. `cp_free`
  still works. Rebuild the battle: `cp_new` with the same setup and seed,
  then `{"cmd":"resume","log":[...saved log...]}`.
- A NULL handle gives `{"ok":false,"reason":"null_handle"}` from
  `cp_command`, `cp_step` and `cp_snapshot`.
- Apps should treat any snapshot or step reply that has `"ok": false` as an
  error (a normal snapshot has no `ok` key).
- Wasm: a panic is a trap and can not be caught in Rust. The call throws a
  JS `RuntimeError`; the panic text is kept first and `last_error()` returns
  it. That `Game` is dead (wasm-bindgen leaves it borrowed; every method
  throws): drop it, make a new `Game` and send `resume` with the saved log.

JSON Schemas for everything below live in `core/schema/`:
`setup.schema.json`, `command.schema.json`, `reply.schema.json`,
`snapshot.schema.json`. Sample files the apps can test against live in
`core/fixtures/` (made by `cargo run -p castle-core --example make_fixtures`
from `castle_core::fixtures::build()`; a test fails when any file, snapshot
or hash in them is stale): `setup_1_1.json` (the setup),
`commands_1_1.json` (seed, the commands, `plan_hash` and `after_hash`),
`replies_1_1.json` (the replies), `snapshot_plan.json` (full snapshot after
the commands), `snapshot_aim_lean.json` (lean snapshot after an `aim`, with
`aim` and `preview`), `snapshot_lean.json` (lean snapshot mid flight),
`snapshot_after_shot.json` (full snapshot after the shot settles),
`snapshot_rescue_1_7.json` (props: cage bars and the captive),
`snapshot_boss_1_10.json` (the root block and `hud.boss`),
`setup_couch.json` and `snapshot_ended.json` (a Couch Duel with Help, given
up: the full `result`).

## Units and coordinates

- World cells. The map is `map.w` x `map.h` (Standard 2400 x 720). **x grows
  right, y grows down, y = 0 is the top of the sky.**
- Side 0 is the left fort (the player in the campaign), side 1 the right.
- Angle: tenths of a degree, 0 to 1800. 0 points right, 900 straight up,
  1800 left. Side 0 usually aims 0 to 900, side 1 900 to 1800.
- Power: 0 to 100. Launch speed is 12 x power cells per second.
- Wind: -10 to +10, positive pushes right. 10 cells/s² per point.
- Time: ticks at 120 Hz. Rendering interpolates between snapshots.
- A castle block is 16 x 16 cells. Castle grid: column `c` from the fort's
  left edge, row `r` from the bottom, row 0 is the Footing. Block (c, r)
  covers x `castle.x + 16c` to `+15`, y `castle.base_y - 16(r+1)` to `+15`.

## Starting a battle

`content_json`: pass `""` (or NULL) to use the content built into the core,
which is the `content/` folder of this repo (including `content/app.json`).
`"{}"` is not the built in content; it is a bundle with every key missing and
is refused. To pass your own, send one
object whose keys match the content files:
`{"materials":…, "classes":…, "hobs":…, "shots":…, "doodads":…,
"blueprints":…, "rummage":…, "levels":[…every levels/*.json…],
"starter_box":…, "app":…}` (`app` is optional).

`level_json` is the battle setup:

```json
{
  "level": "1-1",
  "mode": "campaign",
  "sides": [
    {"control": "human", "crew": ["marge"], "blueprint": "bp_home_3", "doodads": ["mend_bucket", "pot_lid"]},
    {"control": "ai", "preset": "fair"}
  ],
  "first_turn": 0,
  "round_cap": 15,
  "squall": true,
  "wind": {"min": 0, "max": 2, "fronts": [], "front_rounds": 3},
  "rummage": {"pool": 6, "picks": 2, "source": []},
  "puff_up": true,
  "volley": null,
  "progress": {"cleared": false, "pennants": [false, false, false], "daily_paid": false}
}
```

| Field | Meaning |
|---|---|
| `level` | Required. A level id from content: `1-1` to `1-10`, `d1`, `d2` |
| `mode` | `campaign` (default for campaign levels), `skirmish` (default for `d*`), `couch` (both sides human, no AI), `test_yard` (`set_wind`; a side of dummies passes itself), `daily` (Daily Dust-up: a Skirmish that pays the Daily reward) |
| `sides[i].control` | `human` or `ai`. Default: side 0 human, side 1 AI; in `couch` both human |
| `sides[i].preset` | AI preset: `cozy`, `fair` (default), `stubborn` |
| `sides[i].crew` | Hob ids, seated in Nook 1, 2, … in order. Default: the level's crew (side 0 cut to the level's crew size) |
| `sides[i].blueprint` | Blueprint id. Or `rows` for an inline fort (Workshop): rows top down, front facing right, glyphs `.` empty, `w` Wicker, `t` Timber, `c` Cobble, `F` Footing, `K` Kettle Room, `1`-`5` Nooks |
| `sides[i].kit` | Starter Box kit id (`kit_oak`, `kit_stone`, `kit_reed`): sets blueprint, crew, Doodads and Rummage source |
| `sides[i].doodads` | Up to 2 Doodad ids (unknown ids are refused) |
| `sides[i].name`, `steam`, `aim` | Display name, Steam pool override 0 to 1000 (handicap), AI aim grade 1 to 5 |
| `sides[i].help` | Help handicap: `none` (default), `some`, `lots`. Sets the Steam pool from `content/app.json` `help_steam` (120, 140). An explicit `steam` wins |
| `sides[i].preview_pct` | Preview share for this side, 0 to 100 (Couch Duel handicap 30, 45, 60, 100). Default: the level's |
| `sides[i].crew_size` | Crew size handicap 1 to 5: seat only the first n Hobs |
| `volley` | Volley Points: Actions per side (6, 10 or 14; 1 to 30 accepted). Only `skirmish`, `daily`, `couch`. No round cap and no Squall; see "Volley Points" |
| `progress` | What the save holds for this level: `cleared`, `pennants` (3 bools), `daily_paid`. Used only for `result.buttons` |
| `first_turn` | `0`, `1` or `"coin"`. Default: level rule (campaign: player; skirmish: coin) |
| `round_cap`, `squall`, `wind`, `rummage`, `puff_up` | Overrides of the level rules (`round_cap` 1 to 40, wind -10 to 10, rummage pool 0 to 20 and picks 0 to 10) |

A setup number out of range, an unknown mode, help, kit, Hob, Doodad or
blueprint makes `cp_new` fail with the reason; nothing is clamped in silence.

The second side to act gets +20 Steam and the first Rummage pick. The first
side may not fire a Heavy shot on its first turn.

## Commands

Send `{"cmd": "<name>", ...}`. Every reply has `"ok": true|false`; a refusal
has `"reason"` (a short key, listed below) and sometimes `"detail"`.

**Numbers.** Every number field must be a whole JSON number inside its
range. A fraction, a string, or a value out of range is refused with
`bad_value` (with a `detail` naming the field and range). `12.0` counts as a
fraction: write `12`. Ranges: `angle` 0 to 1800, `power` 0 to 100, `hob`
0 to 255, `ghost` 0 to 1000, `dx` -100000 to 100000 (cut to the map width),
`side` 0 or 1, `c`/`r` -64 to 64, `seats` 0 to 5, `wind` -10 to 10.
Commands always act for the side whose turn it is (`snapshot.side`), except
draft commands, which act for `draft.next` unless `side` is given.

### Rummage (phase `draft`)

| Command | Fields | Effect |
|---|---|---|
| `pick_shell` | `shell`, optional `side` | Take a shell from the pool. AI sides then pick at once |
| `quick_pick` | optional `side` | Fill that side's remaining picks (Fair draft AI; never a Dud for a human) |
| `end_draft` | | Quick Pick everything left for both sides and start the battle |

### Turn (phase `plan`)

| Command | Fields | Effect |
|---|---|---|
| `pick_hob` | `hob` (Hob id) | Select the Hob that will act. Reply has `can_fire` |
| `pick_shot` | `shot`: `"plain"`, `"knack"` or a Trick Shell id in hand | Select the shot |
| `aim` | `angle`, `power` (either may be left out) | Set the selected Hob's aim. Aim is kept per Hob between turns. An `aim` does not force a full snapshot: the next lean snapshot carries `aim` and `preview`. A run of `aim` commands is one log entry |
| `recall` | `ghost` (index among this side's ghosts) | `plan` only. Restore that ghost's Hob, angle and power once; then the pin fades |
| `walk` | `dx` (cells, + right, - left) | Walk before the Action. 1 Steam per 4 cells, x2 uphill, x3 in mud, at most 40 Steam per turn. A step climbs at most 16 cells and drops at most 64; a drop over 48 is a Thump (10 to every block and Hob) and ends the walk. The height is found from the fort's base, so dirt on the roof is not ground. Reply has `moved`, `steam` |
| `shove_off` | `hob` | Pay 15 Steam (`hud.shove_off_cost`) to clear a buried Loophole. No Action spent. Only diggable ground counts as burial (Rock and Bedrock never bury a Loophole); refused with `not_buried` if nothing would clear |
| `fire` | optional `dial` (`"puff_up"`, `"rebuild"`, `"hops3"`), optional `target: [c, r]` | The Action: fire the selected Hob's selected shot. `target` aims a Mendglob at a block of your own fort (no arc). A dial trigger replaces the plain one (Barn Raising `puff_up` re-inflates, it does not also rebuild). A self shot that would do nothing is refused before anything is paid (`nothing_to_mend`, `no_one_to_puff_up`, `bad_target`). Phase becomes `resolve` |
| `doodad` | `doodad`, plus `targets: [[c, r], …]` (Mend Bucket, default: most hurt blocks) or `room: "kettle" \| "nook:N"` (Pot Lid) | The Action: use a Doodad. A Mend Bucket with nothing hurt to mend is refused (`nothing_to_mend`) and not spent |
| `pass` | | Spend the Action doing nothing |
| `ai_turn` | optional `preset` | Let the AI play this side's turn now (Walk, Shove Off, shot or Doodad), or in `draft` make this side's pick. Apps call it when `awaiting` is `"ai"`, after the think pose. Reply has `commands` (what the AI did) and `results`. The log keeps `{"cmd":"ai_turn"}` itself, not the commands: replaying it reruns the AI on the same state, memory and random stream |
| `give_up` | optional `side` | End the battle now: the other side wins with `how: "give_up"`. Any phase but `ended`. Default side: the only human side, else the side to move. In the campaign it pays the loss reward. Logged (with the tick, so a replay matches) |
| `set_wind` | `wind` (-10 to 10) | `test_yard` only: the wind now and for every later front |
| `resume` | `log` (a saved command log) | Only on a new battle (empty log). Replays the log, stepping tick by tick between commands as a live app does, and lands on the same state and hash as the battle that wrote it. Reply `{"ok":true,"applied":n,"hash":"…"}`, or `bad_log` with `index`. The next snapshot is full with the whole map |

### Queries (any phase, change nothing)

| Command | Fields | Reply |
|---|---|---|
| `lean_lines` | `side`, `c`, `r` | `falls: [[c, r], …]`: blocks that would fall if that block broke |
| `shimmer` | `side` | `blocks: [[c, r], …]` hanging at the end of their side reach |
| `validate_blueprint` | `rows`, `seats` | `ok` plus `cost` (Buttons), `used` (blocks against the budget) and `budget` (72); or `reason: "invalid_blueprint"` with `detail` and `cells: [[c, r], …]` (hanging blocks and open room walls to mark). Every block must stand: the support solver runs on the fort |
| `hash` | | `hash`: the state hash (16 hex digits) |
| `log` | | `log`: every accepted command so far. Save it with the setup and seed; `resume` (or replaying it) rebuilds the battle exactly |
| `terrain_all` | | Marks every terrain chunk dirty; the next snapshot is full and sends the whole map (use after an app reload) |

### Refusal reasons

`bad_json`, `unknown_command`, `not_drafting`, `not_your_pick`,
`not_in_pool`, `not_planning`, `already_acted`, `bad_hob`, `bad_shot`,
`hob_cannot_fire`, `resting_plain_only`, `no_shot`, `unknown_shot`,
`no_knack_uses`, `not_in_hand`, `no_heavy_first_turn`, `bad_dial`,
`puff_up_not_allowed`, `cannot_walk_now`, `cannot_walk_there`,
`cannot_shove_now`, `not_buried`, `not_enough_steam`, `no_hob`,
`cannot_use_now`, `no_doodad`, `unknown_doodad`, `bad_room`, `no_ghost`,
`pin_faded`, `invalid_blueprint`, and new in v0.2: `bad_value`,
`nothing_to_mend`, `no_one_to_puff_up`, `bad_target`, `no_actions_left`,
`battle_over`, `test_yard_only`, `cannot_resume`, `bad_log`, `buried`,
`resting` (in `hud.shots[].why`), and from the bindings `null_handle`,
`panic`, `dead_handle`, `wrong_thread`.

## The frame loop

```
cp_new → snapshot (full: whole map, all forts)
loop each display frame:
    if snapshot.awaiting == "human": read input → cp_command(...)
    if snapshot.awaiting == "ai":   show the think pose, then cp_command({"cmd":"ai_turn"})
    cp_step(ticks due at 120 Hz)   (only does work in phases resolve and settle)
    snapshot = cp_snapshot()
    draw; play events
until snapshot.phase == "ended"
```

Phases: `draft` → `plan` → `resolve` (shells fly) → `settle` (60 ticks of
calm for the collapse to play out) → next side's `plan` … → `ended`.
`cp_step` returns at once in `draft`, `plan` and `ended`. Stepping in any
chunk size gives the same state: `step(1)` 120 times equals `step(120)`.
A shell flies at most 720 ticks (6 s); one still out then ends with a
`miss` event (`why: "time"`). A shell above 4 map heights, or a beam above
the top of the map, ends at once with `miss`.

## Snapshot

Snapshots are **full** or **lean**. A snapshot is full when anything other
than shell flight or aim changed since the last one (a command that changes
the battle, any event, `terrain_all`, the first snapshot). Queries (`hash`,
`log`, `lean_lines`, `shimmer`, `validate_blueprint`) do not force one. A
lean snapshot (`"full": false`) carries only `tick`, `phase`, `side`,
`awaiting`, `full`, `terrain` (always present, usually empty), `shells` and
`events` (empty); keep everything else from the last full snapshot. After an
`aim` it also carries `aim: {"side","hob","angle","power"}` and `preview`:
replace those two. The full parts are built only when needed, and the state
hash is kept per terrain tile, so a lean frame costs microseconds.

```json
{
  "tick": 1520, "phase": "resolve", "side": 0, "awaiting": "none", "full": true,
  "level": "1-1", "mode": "campaign",
  "map": {"w": 1600, "h": 720, "chunk": 64},
  "terrain": {"chunks": [{"cx": 0, "cy": 5, "x": 0, "y": 320, "w": 64, "h": 64, "data": "<base64>"}]},
  "castles": [ … ], "hobs": [ … ], "shells": [ … ], "props": [ … ],
  "preview": [[x, y], …], "ghosts": [ … ],
  "hud": { … }, "draft": null, "events": [ … ],
  "result": null, "hash": "9f0c…"
}
```

| Field | Meaning |
|---|---|
| `tick` | Sim tick (120 per second) |
| `phase` | `draft`, `plan`, `resolve`, `settle`, `ended` |
| `side` | Whose turn it is |
| `awaiting` | `human`, `ai` or `none`: who must act next |
| `full` | Full or lean snapshot (above) |
| `level`, `mode` | Level id and mode |
| `map` | `w`, `h` in cells, `chunk` size (64) |
| `terrain.chunks` | Only the 64 x 64 chunks that changed since the last snapshot (all of them in the first: 456 on a 2400 x 720 map). `data` is base64 of `w * h` bytes, row major; each byte is a terrain material code. Chunks at the map edge are cut (`w`, `h` smaller) |
| `castles[side]` | One per side, see below |
| `hobs[]` | Every Hob of both sides, see below |
| `shells[]` | Shells in flight, compact: `[id, x, y, rot, shot]` (see below) |
| `props[]` | Things on the field: Tick-Tock Crock, the turnip, cage bars, the captive |
| `preview` | Aim preview dots `[x, y]` for the side in `plan` (30% of the arc, Marge +10% on Plain Shots, full on the first shot of 1-1). Empty when not planning |
| `ghosts[]` | Last 2 shots per Hob, both sides, with pins |
| `hud` | Everything the HUD shows, see below |
| `draft` | The Rummage, or null when the level has none |
| `events[]` | What happened since the last snapshot, in order, see below |
| `result` | null, or the result object below |
| `hash` | State hash, 16 hex digits (same on every platform). Covers every field that can change a later result, the AI memory and streams included |
| `last_ai` | Commands the AI sent on its last `ai_turn` |

Terrain material codes (from `content/materials.json`): 0 air, 1 Loam,
2 Clay, 3 Rock, 4 Bedrock, 5 Mud, 6 Water.

### castles[]

```json
{"side": 0, "x": 344, "base_y": 390, "cols": 7, "rows": 7, "block": 16,
 "blocks": [{"c": 0, "r": 0, "x": 344, "y": 374, "mat": "footing", "hp": 400, "max": 400, "peephole": false, "root": false, "battered": false}],
 "rooms": [{"kind": "nook", "id": 0, "c": 1, "r": 4, "box": [360, 278, 391, 309], "intact": true, "flap": false, "lid": false, "loophole": [392, 290, 407, 295]}],
 "kettle": {"hp": 300, "max": 300, "box": [366, 337, 386, 357], "room": [360, 326, 391, 357], "c": 1, "r": 1, "lid": false, "intact": true},
 "steam": 100, "steam_turn": 0, "fatigue": false,
 "shimmer": [[c, r]], "held": [[c, r]]}
```

`x`, `base_y`: world position of the fort's left edge and the bottom of the
Footing. `blocks` lists standing blocks only. `rooms` are the Nooks (`id` is
the Nook index; Hobs refer to it). `box` and `loophole` are world boxes
`[x0, y0, x1, y1]` inclusive. `flap`: Loophole Flap is down until the
Weather Front changes. `lid`: Pot Lid. `shimmer`: blocks at the end of
their reach. `held`: blocks Hetty's Ridgepole holds up. `fatigue`: true from
round 10; then a block below full HP is `battered` and reaches one block
less to the side (Cobble 1 becomes 0, wood 2 becomes 1). `root`: the boss
weak spot block.

### hobs[]

```json
{"id": 0, "side": 0, "def": "marge", "name": "Marge Dumpling", "class": "lobber",
 "hp": 120, "max": 120, "state": "seated", "nook": 0, "x": 376, "y": 309,
 "rest": 0, "knack": "grand_dumpling", "knack_uses": 2, "plain": "clodpot",
 "buried": false, "cover": true, "dummy": false, "grudge": false, "clatter": false,
 "can_fire": true, "aim": {"angle": 450, "power": 60}}
```

`x, y`: the Hob's feet. `state`: `seated` (in an intact Nook, has Cover),
`open`, `dropped`, `tumbled`, `squashed`, `bonked`. `rest`: the cog (turns
left to sit out; a value of 1 right after firing a Medium shot clears at the
end of this turn). `buried`: Loophole dug in (Fire greys; Shove Off clears).
`grudge`: Old Thumper's next Clodpot is one band larger. `clatter`: Nan's
+15% on this Hob's next shot. `aim` is sent only for the side whose turn it
is; it is `null` for the other side.

### shells[]

Compact transform per shell: `[id, x, y, rot, shot]`. `x, y` in cells,
`rot` the flight direction in tenths of a degree (0 right, 900 up), `shot` the
shot id (pick the sprite). Ids are stable while the shell lives.

### props[]

`{"id", "side" (2 = level object), "kind" ("shell", "cage_bar", "captive", "roller", "shears"), "tag", "x", "y", "hp", "max", "shot"}`.
`roller` (tag `boiler`) is Big Smoothie Jr. on 1-10; `shears` (tag `hinge`)
is the shears' hinge on the 1-10 roof. Hitting the boiler to 0 stops the
roller for good; breaking the hinge jams the shears.

### ghosts[]

`{"index", "side", "hob", "shot", "angle", "power", "round", "pin": [x, y] | null, "self_hit", "recalled", "points": [[x, y], …]}`.
`recall` takes the index among the active side's own ghosts in this list
order.

### hud

| Field | Meaning |
|---|---|
| `turn`, `round`, `round_cap` | `Round 6/15` |
| `side` | Whose turn |
| `wind`, `forecast`, `front_rounds_left` | Weather Front now, the next front, rounds left in this one |
| `steam` | `[side0, side1]` Steam left |
| `steam_turn_left` | Steam the active side may still spend this turn |
| `kettle_pct` | `[side0, side1]` |
| `crew` | Per side, `[{"id", "hp_pct", "state", "class", "rest"}]` (HP pips) |
| `squall_warning` | 3, 2, 1 or null ("Squall in 3") |
| `squall_round` | 0, or 1 to 3 in the Sudden Squall |
| `squall` | Whether this battle has a Squall |
| `hands` | Per side, Trick Shells in hand: `{"id", "name", "match", "weight", "dud", "card"}` |
| `doodads` | Per side, Doodad ids left |
| `selected` | `{"hob", "shot"}` for the active side |
| `names`, `control` | Side names; `human` or `ai` per side |
| `score` | Siege Score per side |
| `puff_up` | Per side, whether Puff Up is still available |
| `steam_max` | `[side0, side1]` Steam at the start (the bar's 100%; the second side starts with +20) |
| `shove_off_cost` | Steam a Shove Off costs (15) |
| `shots` | Shot chips for the selected Hob of the side on turn: `[{"shot": "plain" \| "knack" \| shell id, "id": shot id, "ready": bool, "why": reason \| null}]`. `why` is what `fire` would refuse with (`resting_plain_only`, `no_knack_uses`, `no_heavy_first_turn`, `buried`, `resting`, `no_actions_left`, `not_planning`, …) |
| `handicap` | Per side `{"help", "steam", "preview_pct", "crew"}`: show them openly (Couch Duel house rule 6) |
| `volley` | null, or `{"actions": n, "left": [a, b]}` ("Shots left 7/10") |
| `boss` | null, or on a Grand Fort with phases: `{"phase": 1..3, "roller": prop or null, "roller_done", "shears": prop or null, "cut": [x0, y0, x1, y1] or null, "jam": n}`. `cut` is the red cut line, shown one boss turn before the snip |
| `rules` | `{"objective": {"tag", "count"} or null, "cap_win": 0 \| 1 \| null}` |

### draft

`{"pool": [shell ids], "picks": [[…], […]], "next": side, "picks_each": n, "wish": shell id | null}`.
`wish` is the shell the AI Rival pinned before the first pick.

### events[]

Every event has `t` (type) and `tick`. Positions are world cells.

| `t` | Fields | Meaning |
|---|---|---|
| `draft_start` | `pool`, `first_pick`, `wish` | Rummage opened |
| `draft_pick` | `side`, `shell` | |
| `draft_end` | | |
| `battle_start` | `first`, `wind`, `forecast` | |
| `round_start` | `round` | |
| `turn_start` | `side`, `round`, `turn` | |
| `front` | `wind`, `forecast` | A new Weather Front; Loophole Flaps lift |
| `squall_warning` | `n`, `text` | "Squall in 3/2/1" |
| `squall_round` | `n`, `wind` | A Squall round starts, wind stepped up |
| `squall` | `n`, `kettle`, `blocks` | Squall hit at round end (HP lost by each kettle and block) |
| `fire` | `side`, `hob`, `shot`, `angle`, `power`, `dial` | |
| `walk` | `side`, `from: [x, base_y]`, `to`, `steam` | Animate the walk |
| `shove_off` | `hob` | |
| `split` | `x`, `y`, `count`, `child` | A shell split |
| `explode` | `x`, `y`, `r`, `dmg`, `type` | Burst (blast band radius `r`) |
| `carve` | `x`, `y`, `r` | Ground carved (the terrain chunk follows) |
| `mound` | `x`, `y`, `r` | Dirt added |
| `hit` | `target` (`block`, `hob`, `kettle`, `prop`), plus `side`, `c`, `r` / `hob` / `kind`, `dmg`, `type`, `threaded`, `why` (`crush`, `fall`, `thump`, `shot`) | Damage number |
| `break` | `side`, `c`, `r` | A block broke |
| `collapse` | `side`, `blocks: [[c, r, mat]]`, `falls: [[c, cells]]` | A chunk fell straight down (cells per column) and broke |
| `big_drop` | `callout` (true the first time: show "Drop!"), `blocks` | 4 or more blocks dropped by one shot |
| `drop` | `hob`, `side`, `from`, `to`, `cells`, `state` (`dropped`/`tumbled`), `dmg` | A Hob fell |
| `climb` | `hob`, `nook` | A dropped Hob climbed into a free Nook |
| `bonk` | `hob`, `side` | Snooze Balloon |
| `threaded` | `side`, `nook`, `hob` | "Threaded!"; that Loophole's flap drops |
| `kettle_pop` | `side` | |
| `castle_drop` | `side`, `cells` | Ground carved away, fort sank |
| `thump` | `side` | Drop over 48 cells |
| `buried`, `dug_out` | `hob` | Loophole buried or cleared |
| `lid`, `lid_block` | `side`, `room` / `x`, `y` | Pot Lid set; a shell bounced off it |
| `mend`, `rebuild` | `side`, `blocks` | Repairs |
| `puff_up` | `hob`, `nook` | Re-inflated |
| `prop`, `prop_wake`, `prop_break` | `x`, `y`, `shot`/`kind` | Crock or turnip lands; crock wakes; a prop breaks |
| `grudge`, `clatter` | `hob` | Passives switched on |
| `regrow` | `side`, `c`, `r` | Boss hedge regrows |
| `column` | `side`, `c`, `r` | Lid Lifter blast up a column |
| `fatigue` | `round` | Fatigue starts (round 10): battered blocks lose side reach |
| `miss` | `x`, `y` | A shell left the map |
| `pass` | `side` | |
| `win` | `winner`, `how`, `round`, `pennants` | Battle over |

`how`: `clean_sweep`, `kettle_pop`, `squall` (a Squall hit popped one
kettle), `double_pop`, `rescue`, `round_cap` (1-1: Sir Pudge dozes off; 1-7:
the cap ran out before the rescue, the rival wins), `total_hp` (cap with no
Squall), `give_up`, `volley_points`, `captive_bonked` (Rescue lost).

New events in v0.2: `relight` (`side`, `hp`: Volley Points kettle), `boss_phase`
(`phase`), `roller` (`x`, `y`, `hp`), `roller_move` (`from`, `to`, `y`, `why`),
`roller_stop`, `shears` (`x`, `y`, `hp`), `shears_open` (`side`, `c`, `cut`),
`shears_snip` (`blocks`), `shears_jam` (`turns`). `break` now also comes for
blocks lost to a Thump (`why: "thump"`) or a Squall (`why: "squall"`).
`kettle_pop` comes once per pop; `big_drop` once per shot. `miss` may carry
`why: "time"`. `win` also has `pennants_new` and `buttons`. `puff_up` may carry
`why: "volley"`. `pass` may carry `why: "dummy"` (Test Yard).

### result

```json
{"winner": 0, "how": "kettle_pop", "round": 9, "pennants": [true, false, true],
 "pennants_new": [true, false, true], "buttons": 250, "score": [1840, 920],
 "stats": [{"shots": 9, "hits": 7, "blocks_dropped": 6, "bonks": 2, "blocks_lost": 4,
            "kettle_lost": 60, "hobs_lost": 1, "best_streak": 4}, {…}],
 "broke": {"side": 1, "how": "kettle_pop",
           "last": {"shot": "grand_dumpling", "shot_name": "Grand Dumpling", "hob": 0, "hob_name": "Marge Dumpling", "round": 9},
           "top": [{"shot": "clodpot", "shot_name": "Clodpot", "hob": 0, "hob_name": "Marge Dumpling", "dmg": 210}],
           "kettle_lost": 300, "blocks_lost": 11, "hobs_bonked": 1}}
```

- `pennants_new`: Pennants earned now that `progress.pennants` did not hold.
- `buttons`: what the player (side 0) earns, design 5.2, numbers from
  `content/app.json` `rewards`: campaign first clear 200 (Grand Fort 500)
  + 25 per Pennant earned; replay win (`progress.cleared`) 80 (Grand Fort
  150) + 10 per new Pennant; loss or Give up 40; Daily Dust-up first clear
  of the day 60 (`progress.daily_paid` false); Skirmish, Couch Duel and Test
  Yard 0.
- `score`: Siege Score per side (damage x the shot's Skill Factor, +150 per
  Bonk, +400 per Kettle Pop; at the end +50 per unused round and +200 for no
  Hob lost, except in Volley Points).
- `broke`: "what broke you" for the losing side: the last enemy blow, the
  three shots that did the most damage (`shot` may also be `squall`,
  `ground` for falls with no shot, `prop` for a Tick-Tock Crock, `shears`),
  and what it lost.

## Volley Points

Setup `"volley": 6 | 10 | 14` in `skirmish`, `daily` or `couch`. Each side
gets that many Actions (a turn is one Action, a Doodad counts). No round
cap, no Squall, nothing ends early: a Bonked Hob puffs back at half HP in
the lowest free Nook at the start of its side's next turn, and a popped
kettle relights at 150 (`relight` event). Every other rule holds. When both
sides are out of Actions the higher Siege Score wins (`how:
"volley_points"`); a tie goes to the side that went second. `fire` and
`doodad` with no Actions left are refused with `no_actions_left`.

## Grand Fort 1-10 phases

Level rules `boss`: phase 2 when the boss kettle falls under 70% or the
Sprinkler Root breaks, phase 3 under 35%, checked at the boss's turn start
(a phase passed during the Squall is skipped). Phase 2 releases Big
Smoothie Jr. (a `roller` prop, 60 HP boiler): from the next boss turn it
rolls 120 cells toward the player each boss turn and shaves the ground down
to the flat line; dirt piled more than 32 cells over the map's own ground
stops it for that turn; a broken boiler stops it for good. Phase 3 opens
the shears (a `shears` hinge prop, 30 HP): one boss turn shows the cut line
(`hud.boss.cut`) over the top 2 rows of the player's tallest column, the
next boss turn snips every player block in that box. Walk out from under
the line to dodge it; breaking the hinge jams the shears for 2 boss turns.

## Rescue (1-7)

No Squall (`squall: false`) and `cap_win: 1`. The player wins only by the
objective (break 2 cage bars). The rival's kettle or crew does not end the
fight. The player loses if the captive is Bonked (`captive_bonked`), the
player's fort falls, or the cap runs out (`round_cap`, rival wins).

## Determinism

- Integer and Q16.16 maths only in rules (a test fails the build on `f32` or
  `f64` in `castle-core/src`, and on `HashMap`/`HashSet`). Trig from a
  checked in table, integer square roots.
- Random numbers: sfc32 streams `battle`, `hazard`, `ai.0`, `ai.1`, each
  seeded from the seed and its name.
- The log holds every command that changed the battle, `ai_turn` and the
  draft picks included. AI choices, memory and streams are derived from the
  log: replaying it (`resume`, or each entry after stepping to the next
  `plan`/`draft`) gives the same state and hash as the live battle, at the
  same tick. A save is setup + seed + log. Tests check this for every golden
  and for bot battles played live in 2 tick frames.
- Daily seed: `cp_daily_seed(date)` hashes the date text and
  `RULES_VERSION`. No content delay.
- Golden replays (`castle-core/tests/golden/*.json`) and their hashes
  (`expected.txt`) must match on every platform.

## The AI

Lives in `castle-core/src/ai.rs`. It builds a knowledge view (the other
side's hand, Doodads and live aim are wiped), picks targets (enemy Hobs,
the kettle, the block whose loss drops most by Lean Lines), solves angle and
power for each Hob and shot with real sim probes, runs the best candidates
through the real sim on a cloned battle, scores them, then adds aim error
from its own random stream. The error starts at the preset's sigma (Cozy
5°/10, Fair 3°/6, Stubborn 1.5°/3 power points, scaled by the Rival's aim
grade) and narrows each shot at the same target. Work is counted in units
(one actor tick): Cozy 60k, Fair 120k, Stubborn 180k per turn (`ai.rs`
`tuning()` is the one source). Aims are solved breadth first: every Hob and
flight gets a rough aim at each target in turn before any is refined, the
first Hob is picked with the AI stream, and the best candidate of each Hob is
simulated before the rest, so one Hob never takes the whole budget. A walk
replans with half the budget. Rules in code: a Cozy Rival never Threads a
Loophole (its shells do not thread, and Threading candidates are dropped);
no AI fires a Dud; the knowledge view also wipes Weather Fronts past the
forecast, the Squall direction and the other side's streams.

## Changes in v0.2

See the Fixes section of `docs/review/code/core-review-1.md` for the full
list with reasons. In short: panic safety and errors in both bindings;
`bad_value` for bad numbers; 64 cell terrain chunks; lean snapshots for
`aim`; rival aim hidden; new commands `give_up`, `set_wind`, `resume`;
`ai_turn` logged as itself; setup `help`, `preview_pct`, `crew_size`,
`volley`, `progress`, `daily` mode; `hud.steam_max`, `shove_off_cost`,
`shots`, `handicap`, `volley`, `boss`, `rules`; result `pennants_new`,
`buttons`, `score`, `stats`, `broke`; new `how` values and events;
`validate_blueprint` returns `cost`, `used`, `budget` and `cells`; the 1-10
roller and shears; Rescue rules; rules version 2.
