# Castle Protect sprites and animation

Game-ready art for the build: the v0.1 sprites plus the animation frames and `animations.json`. Every file here is made by script from SVG, so it can be made again at any time. Do not edit the PNG files by hand.

## Make it again

```
node tools/art-gen/gen-sprites.mjs      # writes assets/svg/*.svg, assets/manifest.json and assets/animations.json
node tools/art-gen/render-sprites.mjs   # writes sprites, atlases, both contact sheets and the previews
node tools/art-gen/render-sprites.mjs anim   # only the animation sheet and the previews
```

The render step needs Playwright with Chromium (the same as `tools/art-gen/render.mjs`). Set `PLAYWRIGHT_ROOT` if Playwright is not in `/opt/node22/lib/node_modules/`.

## What is here

| Path | What |
|---|---|
| `svg/` | One SVG per sprite. The source of truth. Web can use these as they are |
| `sprites/` | PNG per sprite: `name.png` at @1x and `name@2x.png` at @2x |
| `atlas/` | Packed 2048 px pages with a JSON frame map |
| `manifest.json` | Every sprite: name, group, purpose, size, anchor, files |
| `animations.json` | Every animation: frames, times, loop, anchor, events. Plus motion data with no frames |
| `contact-sheet.png` | All sprites on one sheet, for a quick look |
| `contact-sheet-anim.png` | Every animation as a strip of frames in play order |
| `previews/` | Animated PNG (APNG) previews. Open them in a browser |

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
| stompers | `stomper_{blue,orange}_{0,1}`, `stomper_{blue,orange}_walk_{0..5}` | Two old walk frames and the 6-frame walk cycle. Anchor is the hip |
| hobs | `hob_{name}_{blue,orange}_{pose}_{frame}` | Names: marge, quill, jax, grub, bobbin, hetty, thumper, nan. Poses: idle (4), aim (3), fire (4), hit (3), bonked (4, tall frame, with Snooze Balloon), cheer (4), tumble (4), land (2), dig (3), nextdoor (2, only grub, hetty, thumper, nan). Anchor is the feet. The frame number is not the play order; see Animation |
| portraits | `portrait_{name}_{blue,orange}` | 48 px disc for the crew rings |
| shells | `shell_*` | In flight. Plain Shots: clodpot, hatpin, gravel, nibbler, bouncebean, mendglob. Trick Shells: pudding_bomb, lid_lifter, marble_sack (and marble), nosy_goose, mole_mail, old_turnip, rubber_radish, sod_sack. Doodads: mend_bucket, pot_lid |
| icons | `icon_*` | The same shots at 48 px for the tray and cards |
| effects (animated) | see Animation | Trails, impact puffs, splash, Rising Fizz, shimmer, Ghost dot pulse, Pin drop, wind leaves, Squall, crack overlays, chunks, dust cloud, rubble settle |
| effects | `fx_boom_{small,medium,large}_{0..3}`, `fx_dust_{0..2}`, `fx_chip_{material}_{0..2}`, `fx_shimmer`, `fx_ghost_*`, `fx_pin_p1`, `fx_pin_p2`, `fx_burn_{0..2}`, more | Pins and Ghost dots: round for player 1, diamond for player 2 |
| terrain | `terrain_{grass_top,soil,deep_soil,stone,loam}` | 64 px tiles. All repeat both ways; `grass_top` repeats sideways only |
| backgrounds | `bg_downs_sky`, `bg_downs_hills_far`, `bg_downs_hills_near` | 2048 px wide at @2x. All repeat sideways |
| ui | `ui_fire*`, `ui_walk_{left,right}`, `ui_pause`, `ui_chip*`, `ui_ring_*`, `ui_wind_arrow`, `ui_squall`, `ui_pennant*`, `ui_button_coin`, `ui_kettle_gauge_*`, `ui_kettle_bar_*`, `ui_class_*`, `ui_crest_*`, `palette_block_*` | No text is baked in |
| app | `app_icon-1024.png`, `-512`, `-192` | Full square, no clear pixels |

## Animation

`animations.json` is the one list that web, Android and iOS all play. Old sprite names and sizes did not change; new frames were added. Sprites made for animation have `"anim": true` in the manifest.

```
"hob_marge_blue_fire": {
  "frames": ["hob_marge_blue_fire_2", "hob_marge_blue_fire_3", "hob_marge_blue_fire_0", "hob_marge_blue_fire_1"],
  "ms": [120, 60, 100, 140], "loop": false, "w": 72, "h": 80, "anchor": [30, 76],
  "events": { "release": 1 }, "next": "hob_marge_blue_idle" }
```

| Field | Meaning |
|---|---|
| `frames` | Sprite names in play order. This order is the truth, not the number in the name (old frames kept their numbers) |
| `ms` | Time for each frame, in ms. Same count as `frames` |
| `loop` | `true`: go round again. `false`: play once |
| `loop_from` | Only with `loop`. Frames before this index play once, then the loop runs from this index (tumble, bonked) |
| `w`, `h`, `anchor` | Px at @1x. All frames of one animation share them, so a player only swaps the image |
| `events` | Name to frame index. Fire the event when that frame first shows (`release`: the shell leaves the Hob) |
| `next` | Animation to start when a play-once animation ends |
| `hold` | Sprite to show when a play-once animation ends |
| `pick` | A set of poses, not a timed clip. Aim: frame 0, 1, 2 for low, mid, full power |

How to play one, on any platform:

1. Keep `t` in ms. Each view frame, add the frame time (use view time, so hit stop and slow motion work).
2. Walk the `ms` list to find the frame for `t`. Draw that sprite with its anchor on the object's point.
3. When the frame index changes, fire any event with that index.
4. At the end: if `loop`, go back to `loop_from` (or 0). If not, start `next` or show `hold`.
5. Flip Hobs for the right-hand fort, as before. To play an animation backwards (Flap rolls up, Pot Lid comes down, hand-off card to player 1), read the lists from the end.

Animation names:

| Group | Names |
|---|---|
| Hobs | `hob_{name}_{team}_` + `idle`, `blink`, `aim`, `fire`, `hit`, `tumble`, `land`, `bonked`, `cheer`, `dig` (Shove Off), `nextdoor` (Broad Back, Ridgepole, Old Grudge, Clatter Call: a gold glow at the feet) |
| Fort | `stomper_{team}_walk`, `fx_kettle_steam`, `kettle_pop`, `loophole_flap_{team}_close`, `pot_lid_raise` |
| Collapse | `fx_crack_{material}` (3 stages), `fx_chunk_{material}`, `fx_dustcloud`, `fx_rubble_{material}`. Materials: wicker, timber, cobble, footing |
| Shots and effects | `fx_trail_{blast,pierce,dig,fire,mend}`, `fx_impact_{material or dirt}`, `fx_splash`, `fx_fizz_bubble`, `fx_fizz_pop`, `fx_shimmer`, `fx_ghost_dot_{p1,p2}_pulse`, `fx_pin_{p1,p2}_drop`, `fx_wind_leaf`, `fx_squall` |
| UI | `ui_fire_press`, `ui_pennant_earn`, `ui_button_coin_spin`, `ui_handoff_flip` |

Motion with no frames is under `data` in the same file. A track is a list of `[time ms, value]` keys; go in a straight line from key to key.

| Data | What |
|---|---|
| `fort_bob` | Fort body `dy` (px at @1x) and `tilt` (degrees) for each Stomper walk frame. Also in `manifest.json` under `data`. Start every second leg 3 frames later |
| `collapse` | Creak shiver, wobble and lean angles by material, row gap for the staggered drop, land squash, break counts, dust scale |
| `turn_banner` | Slide in, hold, slide out, and the fade to use with Reduce motion |
| `hand_off_card` | Pop-in scale for the card |

Hit stop, shake and slow motion numbers stay in `docs/design/07-ux-ui-audio.md` section 6. With Reduce motion on, hold the first frame of loops and skip `fort_bob`.

`previews/fort_walk.png` and `previews/collapse.png` are built from this data by `render-sprites.mjs`, so that code is a small worked example.

## Team rules

- Player 1 is blue `#2F6FDE` with round shapes and solid fills. Player 2 is orange `#E8730C` with diamond shapes and white hatch lines.
- Orange Hobs have a hatched scarf and a diamond patch on the hat. Their Snooze Balloon has a diamond tag on the string.
- All Hobs face right. Flip them for the fort on the right.
- No shot or effect is orange or team blue. Nothing but the kettle glows teal.

## Choices made here

- The 8 Trick Shells are the Region 1 start six (Pudding Bomb, Lid Lifter, Marble Sack, Nosy Goose, Mole Mail, Old Turnip) plus the two Region 1 level shells (Rubber Radish, Sod Sack), from `docs/design/01-weapons-and-shots.md`.
- Team colour is baked into the blue and orange sprites for v0.1. The art doc asks for tinted parts later.
- Blocks have one fresh look each. Seeded variants can come later.
- Hobs are frame sprites for now. The art doc asks for paper-doll rigs later; the poses and times here carry over.
- Trails are grouped by damage type (blast, pierce, dig, fire, mend). The owner rim is drawn in code.
- One next door glow serves all four Passives. It is gold, so it is never read as a team colour or the kettle teal.
- The @2x atlas grew from 2 pages to 4.
