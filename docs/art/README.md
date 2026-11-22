# Castle Protect concept art

Hand-built SVG concept sheets for `docs/design/06-art-direction.md`. Each SVG is self-contained (no external refs, no images) and has its own `viewBox`. `png/` holds 2x renders made with Playwright (Chromium) using the free fonts Fredoka and Nunito. Labels are live text with a font fallback list; production art outlines all type.

| File | Caption |
|---|---|
| `01-logo-title.svg` | Logo and title card: the walking fort, the Big Smoothie and "Tap to play". |
| `02-key-art-battle.svg` | Key art: two walking forts on hills, a pot bomb on its arc, wind flag, a hit and a Flattener floating off on a square balloon. |
| `03-material-wicker.svg` | Wicker block (30 HP) in 4 damage states, at in-game size, with palette. |
| `04-material-timber.svg` | Timber block (50 HP) in 4 damage states, at in-game size, with palette. |
| `05-material-cobble.svg` | Cobble block (80 HP) in 4 damage states, at in-game size, with palette. |
| `06-material-brassbound.svg` | Brassbound block (110 HP) in 4 damage states, at in-game size, with palette. |
| `07-material-moonbrick.svg` | Moonbrick block (140 HP), marked Update 3: 4 damage states, green heal sparkles, pale violet veins. |
| `08-material-footing.svg` | Footing row block: 3 damage states and the stub that never falls. |
| `09-hob-crew-lineup.svg` | The 7 launch Hob Classes with hat families, icons and colours, the Peeper marked Update 2, plus silhouette tests at 96, 24 and 16 px. |
| `10-flattener-lineup.svg` | Flattener crew (Hobs in pressed uniforms) and the Big Smoothie, plus a Hob versus Flattener silhouette test. |
| `11-baron-levelwell.svg` | Baron Levelwell on The Grand Roller, a portrait card and three expressions. |
| `12-heartkettle.svg` | The Heartkettle (300 HP in every fort) in 4 states: full, hurt at 50%, critical at 25%, popped. Plus the glow-through-walls rule and the Kettle Room spec. |
| `13-walking-fort-cutaway.svg` | A walking fort cutaway: Stompers, Footing, Nooks, Loopholes, Kettle Room and steam pipe, with a walk cycle. |
| `14-biomes.svg` | Six region thumbnails with palettes, in order: Downs, Crag, Fen, Flats at launch, then Frostwhisker Peaks (Update 2) and Clankmouth Mines (Update 3). |
| `15-shots-vfx.svg` | Ten shot and impact studies with the weapons doc names: Clodpot, Hatpin, Gravel Sneeze, Nibbler, Bouncebean, Emberpot, Snowglobe (U2), Static Sock (U3), Mendglob, Peep Pip (U2). Fire is ember red. A row of damage type badges sits below. |
| `16-hud-battle-mockup.svg` | Battle HUD on a phone in landscape at 844 x 390 pt: 5 Hobs at most, Rival Class icons always shown, round cap 15 with the storm cloud. A strip below shows the round label into Sudden Squall, the kettle gauge at 50% and 25%, and the crew pips. |
| `17-campaign-map-mockup.svg` | Brickabrac Map, whole-world view: four launch regions (Downs, Crag, Fen, Flats) on one strip, won ground risen, the rest ironed flat, and two locked signposts to the Peaks (U2) and the Mines (U3). |
| `18-workshop-mockup.svg` | Workshop castle builder: material palette (Moonbrick locked to U3), grid with legal and illegal drops, Hobs in Nooks, Test Yard. |
| `19-tinker-tree-mockup.svg` | Tinker Tree: a brass pipe tree from a workbench with four branches (Aim, Fort, Crew, Kit), 36 named launch nodes in three tiers, one fork per branch, node states and a node card. |
| `20-palette-and-style.svg` | Palette and style guide: UI, team, Class, skin, damage type and material colours (Fire ember red, Zap violet, Peeper lemon, Moonbrick veins violet), line and shade rules, type samples. |
| `21-pre-battle-screen-mockup.svg` | The one pre-battle screen: level card, goals, Rival with habit tag and crew icons, crew seats (5 at most), Blueprint, Doodads, the draft strip, "Same again" and Fight. |
| `22-launch-hob-roster.svg` | The 16 launch Hobs, each with name, Class hat family and one personal touch, plus a solid-ink hat family check. |
| `23-grand-forts.svg` | The four launch Grand Forts with weak spots and Rig Parts: the Topiary Keep, the Sanding Stair, the Great Sump, and the Last Level with the Baron on the Grand Roller (Level Engine inset). |
| `24-portrait-hud-mockup.svg` | Battle HUD on a phone in portrait at 390 x 844 pt, as stacked lenses: top strip with the round count and "Squall in 3", Top lens on the target fort (12 pt blocks, your Pins, a Loophole Flap, a shimmer on a weak block), Field Strip map in the middle, Bottom lens on your fort (16 pt blocks) with Pause, Walk pad and readout, then the shot tray, crew row and Fire. Side cells: the joined lens in flight, block sizes, turning the device, the thumb zone. |
| `25-couch-duel-mockup.svg` | Couch Duel on two phones in portrait. Left: setup with two player cards (name, Starter Box forts, crew with a "No line" mark, Help), the rules panel (Win by, Kind Clock, Seats) and Fight. Right: the hand-off card over the dimmed battle, with the last shot, the next player's name and crest, and Ready. Side cells: Player 2's look (orange scarf, diamond hat patch), shape cues, Help marks and house rules. |

Sheets 12, 14 to 17, 19 and 20 were redrawn after the review rulings (`docs/review/04-rulings.md`, art direction section 14). Sheets 21 to 23 are new. Sheets 24 and 25 were added after the owner chose portrait plus landscape and Couch Duel for launch, and follow `docs/review/06-learnings-decisions.md` (G1, G2). Sheets 07, 09 and 18 got small fixes so they match the same rulings.

## Source scripts
The SVGs come from the scripts in `tools/art-gen/`:

- `lib.mjs`: the drawing kit (blocks, Hobs, Flatteners, the Baron, kettle, forts, UI bits).
- `scene.mjs`: skies, hills and ground.
- `gen-a.mjs`: sheets 03 to 12. `gen-b.mjs`: 01, 02, 13. `gen-c.mjs`: 14 to 20. `gen-d.mjs`: 21 to 23. `gen-e.mjs`: 24 and 25 (pass `24` or `25` to write one).
- `render.mjs`: renders the PNGs with Playwright at 2x. Pass part of a file name to render only that sheet, for example `node render.mjs 19-`.

Run a `gen` script with Node to rewrite its SVGs, then run `render.mjs`.
