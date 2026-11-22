# Castle Protect core API (v0.1)

The core owns every game rule. Apps send commands as JSON and read frame
snapshots as JSON. Same calls on all three platforms:

| C ABI (`castle-ffi`, header `castle-ffi/include/castle_core.h`) | Wasm (`castle-wasm`) | What it does |
|---|---|---|
| `CpGame* cp_new(const char* content_json, const char* level_json, uint64_t seed)` | `new Game(content_json, level_json, seed)` or `cp_new(...)` | Start a battle. Returns NULL (C) or throws (Wasm) on a bad setup; `cp_last_error(NULL)` gives the reason |
| `char* cp_command(CpGame*, const char* json)` | `game.command(json)` | Apply one command, or a JSON array of commands. Returns the reply JSON |
| `char* cp_step(CpGame*, int32_t ticks)` | `game.step(ticks)` | Advance the sim by whole 120 Hz ticks. Returns `{"tick":n,"phase":"..."}` |
| `char* cp_snapshot(CpGame*)` | `game.snapshot()` | The frame snapshot. Drains events and dirty terrain chunks |
| `void cp_free_string(char*)` | (not needed) | Free any string the C ABI returned |
| `void cp_free(CpGame*)` | `game.free()` | Free the battle |
| `char* cp_last_error(CpGame*)` | | Last error text, or NULL |
| `char* cp_version(void)` | `cp_version()` | `{"sim":"0.1.0","rules":1,"tick_hz":120}` |
| `char* cp_golden_hashes(void)` | `golden_hashes()` | Golden replay hashes, one `name hash` line each |
| `uint64_t cp_daily_seed(const char* date)` | `daily_seed(date)` | Daily Dust-up seed from the local date text (`2026-11-22`) and the rules version |
| | `default_content()` | The built in content bundle as JSON |

All strings are UTF-8. Every `char*` the C ABI returns must go back through
`cp_free_string`. The core starts no threads; call it from one thread per
handle.

JSON Schemas for everything below live in `core/schema/`:
`setup.schema.json`, `command.schema.json`, `reply.schema.json`,
`snapshot.schema.json`. Sample files the apps can test against live in
`core/fixtures/` (made by `cargo run -p castle-core --example make_fixtures`):
`setup_1_1.json` (the setup), `commands_1_1.json` (seed and the commands),
`replies_1_1.json` (the replies), `snapshot_plan.json` (full snapshot after
the commands), `snapshot_lean.json` (lean snapshot mid flight),
`snapshot_after_shot.json` (full snapshot after the shot settles).

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
which is the `content/` folder of this repo. To pass your own, send one
object whose keys match the content files:
`{"materials":…, "classes":…, "hobs":…, "shots":…, "doodads":…,
"blueprints":…, "rummage":…, "levels":[…every levels/*.json…],
"starter_box":…}`.

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
  "puff_up": true
}
```

| Field | Meaning |
|---|---|
| `level` | Required. A level id from content: `1-1` to `1-10`, `d1`, `d2` |
| `mode` | `campaign` (default for campaign levels), `skirmish` (default for `d*`), `couch` (both sides human, no AI), `test_yard` |
| `sides[i].control` | `human` or `ai`. Default: side 0 human, side 1 AI; in `couch` both human |
| `sides[i].preset` | AI preset: `cozy`, `fair` (default), `stubborn` |
| `sides[i].crew` | Hob ids, seated in Nook 1, 2, … in order. Default: the level's crew (side 0 cut to the level's crew size) |
| `sides[i].blueprint` | Blueprint id. Or `rows` for an inline fort (Workshop): rows top down, front facing right, glyphs `.` empty, `w` Wicker, `t` Timber, `c` Cobble, `F` Footing, `K` Kettle Room, `1`-`5` Nooks |
| `sides[i].kit` | Starter Box kit id (`kit_oak`, `kit_stone`, `kit_reed`): sets blueprint, crew, Doodads and Rummage source |
| `sides[i].doodads` | Up to 2 Doodad ids |
| `sides[i].name`, `steam`, `aim` | Display name, Steam pool override (handicap), AI aim grade 1 to 5 |
| `first_turn` | `0`, `1` or `"coin"`. Default: level rule (campaign: player; skirmish: coin) |
| `round_cap`, `squall`, `wind`, `rummage`, `puff_up` | Overrides of the level rules |

The second side to act gets +20 Steam and the first Rummage pick. The first
side may not fire a Heavy shot on its first turn.

## Commands

Send `{"cmd": "<name>", ...}`. Every reply has `"ok": true|false`; a refusal
has `"reason"` (a short key, listed below) and sometimes `"detail"`.
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
| `aim` | `angle`, `power` (either may be left out) | Set the selected Hob's aim. Aim is kept per Hob between turns |
| `recall` | `ghost` (index among this side's ghosts) | Restore that ghost's Hob, angle and power once; then the pin fades |
| `walk` | `dx` (cells, + right, - left) | Walk before the Action. 1 Steam per 4 cells, x2 uphill, at most 40 Steam per turn. Reply has `moved`, `steam` |
| `shove_off` | `hob` | Pay 15 Steam to clear a buried Loophole. No Action spent |
| `fire` | optional `dial` (`"puff_up"`, `"rebuild"`, `"hops3"`), optional `target: [c, r]` | The Action: fire the selected Hob's selected shot. `target` aims a Mendglob at a block of your own fort (no arc). Phase becomes `resolve` |
| `doodad` | `doodad`, plus `targets: [[c, r], …]` (Mend Bucket, default: most hurt blocks) or `room: "kettle" \| "nook:N"` (Pot Lid) | The Action: use a Doodad |
| `pass` | | Spend the Action doing nothing |
| `ai_turn` | optional `preset` | Let the AI play this side's turn now (Walk, Shove Off, shot or Doodad). Apps call it when `awaiting` is `"ai"`, after the think pose. Reply has `commands` (what the AI did; these go into the log) |

### Queries (any phase, change nothing)

| Command | Fields | Reply |
|---|---|---|
| `lean_lines` | `side`, `c`, `r` | `falls: [[c, r], …]`: blocks that would fall if that block broke |
| `shimmer` | `side` | `blocks: [[c, r], …]` hanging at the end of their side reach |
| `validate_blueprint` | `rows`, `seats` | `ok`, or `reason: "invalid_blueprint"` with `detail` |
| `hash` | | `hash`: the state hash (16 hex digits) |
| `log` | | `log`: every accepted command so far (a replay) |
| `terrain_all` | | Marks every terrain chunk dirty, so the next snapshot sends the whole map (use after an app reload) |

### Refusal reasons

`bad_json`, `unknown_command`, `not_drafting`, `not_your_pick`,
`not_in_pool`, `not_planning`, `already_acted`, `bad_hob`, `bad_shot`,
`hob_cannot_fire`, `resting_plain_only`, `no_shot`, `unknown_shot`,
`no_knack_uses`, `not_in_hand`, `no_heavy_first_turn`, `bad_dial`,
`puff_up_not_allowed`, `cannot_walk_now`, `cannot_walk_there`,
`cannot_shove_now`, `not_buried`, `not_enough_steam`, `no_hob`,
`cannot_use_now`, `no_doodad`, `unknown_doodad`, `bad_room`, `no_ghost`,
`pin_faded`, `invalid_blueprint`.

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
`cp_step` returns at once in `draft`, `plan` and `ended`.

## Snapshot

Snapshots are **full** or **lean**. A snapshot is full when anything other
than shell flight changed since the last one (any command, any event, the
first snapshot). A lean snapshot (`"full": false`) carries only `tick`,
`phase`, `side`, `awaiting`, `full`, `terrain` (always present, usually
empty), `shells` and `events` (empty); keep everything else from the last
full snapshot.

```json
{
  "tick": 1520, "phase": "resolve", "side": 0, "awaiting": "none", "full": true,
  "level": "1-1", "mode": "campaign",
  "map": {"w": 1600, "h": 720, "chunk": 256},
  "terrain": {"chunks": [{"cx": 0, "cy": 1, "x": 0, "y": 256, "w": 256, "h": 256, "data": "<base64>"}]},
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
| `map` | `w`, `h` in cells, `chunk` size (256) |
| `terrain.chunks` | Only the 256 x 256 chunks that changed since the last snapshot (all of them in the first). `data` is base64 of `w * h` bytes, row major; each byte is a terrain material code |
| `castles[side]` | One per side, see below |
| `hobs[]` | Every Hob of both sides, see below |
| `shells[]` | Shells in flight, compact: `[id, x, y, rot, shot]` (see below) |
| `props[]` | Things on the field: Tick-Tock Crock, the turnip, cage bars, the captive |
| `preview` | Aim preview dots `[x, y]` for the side in `plan` (30% of the arc, Marge +10% on Plain Shots, full on the first shot of 1-1). Empty when not planning |
| `ghosts[]` | Last 2 shots per Hob, both sides, with pins |
| `hud` | Everything the HUD shows, see below |
| `draft` | The Rummage, or null when the level has none |
| `events[]` | What happened since the last snapshot, in order, see below |
| `result` | null, or `{"winner": 0|1, "how": "...", "round": n, "pennants": [bool, bool, bool]}` |
| `hash` | State hash, 16 hex digits (same on every platform) |
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
+15% on this Hob's next shot. `aim` is visible for the side whose turn it is;
apps should not show the rival's live aim.

### shells[]

Compact transform per shell: `[id, x, y, rot, shot]`. `x, y` in cells,
`rot` the flight direction in tenths of a degree (0 right, 900 up), `shot` the
shot id (pick the sprite). Ids are stable while the shell lives.

### props[]

`{"id", "side" (2 = level object), "kind" ("shell", "cage_bar", "captive"), "tag", "x", "y", "hp", "max", "shot"}`.

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
kettle), `double_pop`, `rescue`, `round_cap` (1-1: Sir Pudge dozes off),
`total_hp` (cap with no Squall).

## Determinism

- Integer and Q16.16 maths only in rules (a test fails the build on `f32` or
  `f64` in `castle-core/src`, and on `HashMap`/`HashSet`). Trig from a
  checked in table, integer square roots.
- Random numbers: sfc32 streams `battle`, `hazard`, `ai.0`, `ai.1`, each
  seeded from the seed and its name.
- `ai_turn` expands into plain commands in the log; replaying the log with
  no AI gives the same hash.
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
(one actor tick): Cozy 60k, Fair 120k, Stubborn 180k per turn.
