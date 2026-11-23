# content/text.json

One string table for web, Android and iOS. Every line a player can read, or hear read out, lives here. No app keeps its own copy.

Names and card lines for Hobs, Classes, shots, Doodads and blocks are not in this file. Read those from `hobs.json`, `classes.json`, `shots.json`, `doodads.json` and `materials.json`. Level names, Rival names and Habits come from `content/levels`.

## Keys

Join the path with dots. `results.loss.title.kettle_pop` is the loss title for a popped kettle.

Keys are stable. Add new keys. Do not rename or reuse old ones.

Keys that start with `_` (`_note`, `_readme`) are notes for people. Never show them.

## Groups

| Group | What is in it |
|---|---|
| `app` | Title, subtitle, tagline, the free promise |
| `common` | Short buttons and words used on many screens |
| `home` | Title screen, Carry on, start a new fight |
| `map` | Region names, map chips, level nodes, level types, Skirmish map names |
| `modes` | Couch Duel, Skirmish, Test Yard, Workshop, Daily Dust-up |
| `setup` | Skirmish and Couch Duel setup |
| `names` | The one Couch Duel name list |
| `level_card` | Level card labels and the Notice of Flattening frame |
| `levels` | Per level: Rival key, Notice, signature, win title, goal wording, boss lines |
| `pennants` | Goal wording by Pennant type, for levels with no line of their own |
| `rivals` | Per Rival: name, short name, taunts, sign-off |
| `hobs` | Short names, Almanac lines, state words |
| `rummage` | The Rummage |
| `shell_card` | The shot detail card |
| `shots` | The "Good at" line by shot id |
| `hud` | Fight screen: aim, Steam, rounds, wind, Squall, the Creaks, chips, reasons a shot is locked |
| `banners` | Turn banners, weather signs, Flattener notices |
| `notes` | Small words by the action, keyed by core event |
| `a11y` | Screen-reader lines |
| `pause` | Pause menu and Give up |
| `handoff` | Couch Duel hand-off card |
| `results` | Win and loss titles, causes, Hetty's verdicts, stats |
| `workshop` | Workshop and fort problems |
| `settings` | Settings and About |
| `captions` | Sound captions |
| `errors` | Error lines |

## Placeholders

A placeholder is a plain word in curly braces: `{hob}`, `{rival}`, `{n}`. Swap each one for its value. There is no nesting and no format code.

| Placeholder | Value |
|---|---|
| `{hob}`, `{target}`, `{who}` | A Hob's short name from `hobs.<id>.short` |
| `{rival}` | The Rival's short name from `rivals.<key>.short` |
| `{name}` | A player's or side's name |
| `{captive}` | The captive's name from `levels.<id>.captive` |
| `{shot}`, `{shell}`, `{doodad}`, `{class}` | A display name from content |
| `{n}`, `{total}`, `{cap}`, `{min}`, `{max}`, `{pct}`, `{dmg}` | Whole numbers |
| `{id}` | A level id such as 1-4 |
| others | Named for what they hold. The line makes it clear |

Use short names in lines. Do not cut a content name at the first space. That turns Old Thumper into "Old" and Miss Quill into "Miss".

## Pools

A list is a pool. Pick one line at random. Do not show the same line twice running.

## Plurals

Where the count changes the words, the key holds `one` and `other`. Use `one` when the count is 1.

## Ids from the core

Sub-keys under `how`, `why`, `by`, `states` and most of `notes` are the ids the rules core sends (`kettle_pop`, `resting_plain_only`, `shears_snip`). Look the id up as it arrives. If there is no key, use `default`.

## Results

- Campaign win: title is `levels.<id>.win_title`. Under it goes `results.win.how.<how>`. Then one line from the Rival's `sign_off` pool.
- Any other win: title is `results.win.title.<how>`.
- Loss: title is `results.loss.title.<how>`. Then `results.loss.cause.<how>` if it is not empty. Then one line from `results.loss.verdict`.
- Never show a cause line that says the same thing as the title.

## Goals

For a Pennant of type `t` on level `L`: use `levels.L.goals.t` if it exists, else `pennants.t`, else the text in the level file. `{n}` is the Pennant's value.

## Rules for new lines

British spelling. Sentence case. "Fight", never "battle". "Kettle", not "Heartkettle". "!" only on Bonk!, Thump!, Drop!, Snip! and Kettle Pop!. Errors are plain and say what is safe.
