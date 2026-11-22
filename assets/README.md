# Castle Protect v0.1 sprites

Game-ready art for the week 1 build. Every file here is made by script from SVG, so it can be made again at any time. Do not edit the PNG files by hand.

## Make it again

```
node tools/art-gen/gen-sprites.mjs      # writes assets/svg/*.svg and assets/manifest.json
node tools/art-gen/render-sprites.mjs   # writes sprites, atlases and the contact sheet
```

The render step needs Playwright with Chromium (the same as `tools/art-gen/render.mjs`). Set `PLAYWRIGHT_ROOT` if Playwright is not in `/opt/node22/lib/node_modules/`.

## What is here

| Path | What |
|---|---|
| `svg/` | One SVG per sprite. The source of truth. Web can use these as they are |
| `sprites/` | PNG per sprite: `name.png` at @1x and `name@2x.png` at @2x |
| `atlas/` | Packed 2048 px pages with a JSON frame map |
| `manifest.json` | Every sprite: name, group, purpose, size, anchor, files |
| `contact-sheet.png` | All sprites on one sheet, for a quick look |

## Sizes

One sim cell is 1 px at @1x. A block is 16 x 16 cells, so 16 px at @1x and 32 px at @2x. Hobs are drawn at 1 px per unit at @2x (about 100 px tall with the hat). Scale in the engine as the camera needs.

`w`, `h` and `anchor` in the manifest are px at @1x, from the top left. Double them for @2x.

## Atlas format

`atlas/castle@2x-0.json` and so on:

```
{ "image": "castle@2x-0.png", "size": 2048, "scale": 2,
  "frames": { "block_wicker_fresh": { "x": 2, "y": 2, "w": 32, "h": 32 } } }
```

`castle@1x.json` and `castle@2x.json` list the pages for each scale. Frames have a 2 px gap. They are not trimmed and not turned. Terrain tiles, backgrounds and the app icon are not in the atlas; load them as their own textures so they can repeat.

## Groups and names

| Group | Names | Notes |
|---|---|---|
| blocks | `block_{wicker,timber,cobble,footing}_{fresh,scuffed,battered,broken}` | `broken` is the rubble, shown for 1.5 s. Footing broken is the stub |
| fort | `nook`, `kettle_room`, `loophole_open`, `loophole_flap_{blue,orange}`, `flag_{blue,orange}` | Rooms are 2 x 2 blocks |
| kettle | `kettle_{full,hurt,critical,popped}`, `kettle_halo` | States change at 50% and 25%. The halo is its own sprite so code can pulse it |
| stompers | `stomper_{blue,orange}_{0,1}` | Two walk frames. Anchor is the hip |
| hobs | `hob_{name}_{blue,orange}_{pose}_{frame}` | Names: marge, quill, jax, grub, bobbin, hetty, thumper, nan. Poses: idle (3), aim (2), fire (2), hit (2), bonked (2, with Snooze Balloon), cheer (2). Anchor is the feet |
| portraits | `portrait_{name}_{blue,orange}` | 48 px disc for the crew rings |
| shells | `shell_*` | In flight. Plain Shots: clodpot, hatpin, gravel, nibbler, bouncebean, mendglob. Trick Shells: pudding_bomb, lid_lifter, marble_sack (and marble), nosy_goose, mole_mail, old_turnip, rubber_radish, sod_sack. Doodads: mend_bucket, pot_lid |
| icons | `icon_*` | The same shots at 48 px for the tray and cards |
| effects | `fx_boom_{small,medium,large}_{0..3}`, `fx_dust_{0..2}`, `fx_chip_{material}_{0..2}`, `fx_shimmer`, `fx_ghost_*`, `fx_pin_p1`, `fx_pin_p2`, `fx_burn_{0..2}`, more | Pins and Ghost dots: round for player 1, diamond for player 2 |
| terrain | `terrain_{grass_top,soil,deep_soil,stone,loam}` | 64 px tiles. All repeat both ways; `grass_top` repeats sideways only |
| backgrounds | `bg_downs_sky`, `bg_downs_hills_far`, `bg_downs_hills_near` | 2048 px wide at @2x. All repeat sideways |
| ui | `ui_fire*`, `ui_walk_{left,right}`, `ui_pause`, `ui_chip*`, `ui_ring_*`, `ui_wind_arrow`, `ui_squall`, `ui_pennant*`, `ui_button_coin`, `ui_kettle_gauge_*`, `ui_kettle_bar_*`, `ui_class_*`, `ui_crest_*`, `palette_block_*` | No text is baked in |
| app | `app_icon-1024.png`, `-512`, `-192` | Full square, no clear pixels |

## Team rules

- Player 1 is blue `#2F6FDE` with round shapes and solid fills. Player 2 is orange `#E8730C` with diamond shapes and white hatch lines.
- Orange Hobs have a hatched scarf and a diamond patch on the hat. Their Snooze Balloon has a diamond tag on the string.
- All Hobs face right. Flip them for the fort on the right.
- No shot or effect is orange or team blue. Nothing but the kettle glows teal.

## Choices made here

- The 8 Trick Shells are the Region 1 start six (Pudding Bomb, Lid Lifter, Marble Sack, Nosy Goose, Mole Mail, Old Turnip) plus the two Region 1 level shells (Rubber Radish, Sod Sack), from `docs/design/01-weapons-and-shots.md`.
- Team colour is baked into the blue and orange sprites for v0.1. The art doc asks for tinted parts later.
- Blocks have one fresh look each. Seeded variants can come later.
