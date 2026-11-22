# 06. Art Direction

Status: revision 3, after the owner's decisions on orientation, Couch Duel, price and human-made art. Date: 2026-11-22. Owner of this doc: art director.

This doc sets how Castle Protect looks: style, colour, readability, the block kit, characters, effects, UI, type, icons, the asset list and the pipeline from vector source to atlas. It builds on `00-core-game-design.md` and uses its binding names as written. It follows the screen and colour rules of `07-ux-ui-audio.md`, the looks in `03-crew-units.md` and `04-enemies-bosses-ai.md`, the regions in `05-campaign-levels-maps.md`, and the asset pipeline of `docs/research/04-tech-stack.md` §10.

Concept art lives in `docs/art/` (SVG source) and `docs/art/png/` (2x renders). `docs/art/README.md` lists every file. Cites like `[07 §7.1]` point to section 7.1 of `07-ux-ui-audio.md`. `[art: 09]` points to `docs/art/09-hob-crew-lineup.svg`. `[rulings B13]` points to `docs/review/04-rulings.md`.

**Phase tags.** `[Launch]`, `[U1]`, `[U2]`, `[U3]` follow the phased plan in the rulings, section A. Launch is four regions (Downs, Crag, Fen, Flats), 7 Classes, 16 Hobs and four materials plus Footing. The launch scope is an owner decision; the counts here follow the recommended plan.

## Changes in revision 3 (owner decisions)

1. **Portrait and landscape both ship at launch.** Section 4.5 sets what that means for art: one UI kit laid out two ways, the stacked-lens battle view, camera framing, safe bands on the map and the cutscene panels, and the few new pieces (Field Strip marks, a pipe kit for the Tinker Tree). No new sprite scale is needed [07 §2.6].
2. **Couch Duel ships at launch.** Player 2 is a Hob clan in orange with diamond shapes, not a Flattener (section 5.5).
3. **Everything is free.** The words "paid game" and every store or unlock asset are gone. The app listing art stays, since a free game still has a listing.
4. **Human-made final art is decided** (section 13). It is no longer a recommendation.
5. **New marks from the reference-game lessons** [review 06]: Lean Lines, the shimmer on weakly held blocks, the **Drop!** hit word, the Loophole Flap, the Rival's wish tag, the **No line** mark and the Squall count (sections 6.4 and 10).
6. Two new concept sheets: `[art: 24]` the portrait battle HUD and `[art: 25]` Couch Duel setup and the hand-off card.

## Changes in revision 2

1. **Fire moved off the Rival orange.** Fire is now ember red `#E0392B` with a gold core. Blast stays warm white with a gold rim. No damage type uses orange or team blue (section 3.7) [audit C82].
2. **Kettle warning states match the HUD and the sound:** hurt at 50%, critical at 25%. The concept sheet's 70% and 40% states are retired (section 3.6) [audit C84].
3. **Team colours confirmed:** you blue `#2F6FDE`, Rival orange `#E8730C`, with shape, side and pattern cues (section 3.2).
4. **Lobber hat stays brick red** `#D9483B`, clear of the Rival orange (section 3.4).
5. **Moonbrick is U3.** It keeps its palette row but is not in the launch block kit. Frost art is U2 and Zap art is U3. The Peeper Class is U2.
6. **Asset counts cut to launch scope** (section 11): 16 Hobs, 14 Flattener unit types, 4 regions, 4 Grand Forts, about 61 shot sprites and cards, 5 block materials with Footing. A second table lists what each update adds.
7. **Tinker Tree has four branches,** not five boughs: Aim, Fort, Crew, Kit (section 8) [rulings B13].
8. **Statuses and states trimmed.** Launch status overlays are Burn and Soaked. Chill is gone; a resting Hob shows one cog. Ground effects share one "patch" look with a turn count. Hob states are Open, Dropped, Tumbled, Squashed, Bonked [rulings B7, B16].
9. **New art for new rules:** Sudden Squall (section 7.1), the "what broke you" replay frame, Rival habit tag, collapse view (creak, lean, staggered rows) [rulings B5, B17, C1].
10. **Brickabrac Map shows four regions at launch,** with two signposted roads for the wings that got away.
11. **Human-made art** is now decided by the owner (revision 3). The 1.25 max zoom [rulings D7] and a trademark search before production starts [rulings D9] stand.
12. **Concept sheets to redraw** are listed in section 14. Cut items are in Appendix A, "Parked ideas".
13. **Final verification pass** [review 05]: the Sudden Squall now hits both forts at once at each Squall round end, so the block shiver plays on both sides together (section 7.1).

---

## 1. Art pillars

1. **Patchwork storybook.** Brickabrac is a quilt of lumpy hills sewn together. We show it with chunky rounded shapes, flat colour, one hard shade and a stitched seam motif on hills, panels and roofs. It looks hand-made, like the forts.
2. **Read it at a glance.** Every shot changes the picture [00 §1.2], so the picture must read on a phone at arm's length. Shape first, value second, colour third. Every Hob reads as a black shape at 24 px.
3. **Round versus flat.** The whole game's theme is lumps against flatness. Hobs, their forts and the land are round, lumpy and crooked. Flatteners, their forts and their machines are square, level and neat. This one rule drives silhouettes, props, UI accents and region art.
4. **Bloodless slapstick.** Hits make stars, soot, popped buttons and snooze balloons. Nothing bleeds, nothing breaks a body. Damage reads as cracks, char, dents and steam [00 §1.4].
5. **Warm, kind, not loud.** A warm paper base, a warm ink line and soft skies. Bright colour is saved for things you act on: your crew, the shot, the kettle glow, the Fire button.

### 1.1 How we stay clearly original

We studied screenshots of genre games (kept in the private archive). We take mechanics, never looks.

| Seen in the references | Castle Protect does instead |
|---|---|
| Thick pure-black outlines, glossy painted characters, gothic spires, wintry painted backdrops (Castle Clashers style) | Warm plum-brown ink line (`#2B1E2E`), matte flat fills, one hard shade, stitched seams. Forts are stacked wicker, planks and cobbles on clockwork legs, with domed or crooked roofs |
| Blue versus red team bars across the top | Blue versus orange (`07 §7.1`), plus shape, side and pattern cues. No full-width VS bar; a 36 pt paper strip |
| Treads and wheels under castles | Stompers: brass gear knees and boots (yours) or flat iron soles (Flatteners) |
| Neon lines on black, pixel terrain (Pocket Tanks family) | Cross-section terrain with quilted strata, pebbles and a stitched grass cap |
| Knights, wizards, generic fantasy soldiers | Hobs: small round folk in patched coats and too-big hats; Flatteners: the same folk in pressed grey uniforms and pancake caps |

---

## 2. Style

### 2.1 Shape language

- **Hobs and their world:** circles, domes, pears, lumps, soft cones and floppy brims. Corners round to at least 25% of the short side. Nothing quite level: roofs sag, chimneys lean 3 to 6 degrees.
- **Flatteners and their world:** rectangles, flat tops, right angles, straight tools (rulers, levels, rakes, clipboards), rollers. Corners round only 2 to 4 units so they still feel friendly [04 §1.1].
- **Neutral world parts** (blocks, terrain, UI): rounded rectangles. Blocks use a 10% corner radius (6% for Footing).
- **Silhouette first.** Every character, shell and prop gets a solid-fill test before colour [art: 09, 10].

### 2.2 Line

- One ink colour: `#2B1E2E`. Never pure black.
- Line width at final screen size: 2 px on 32 px blocks, 3 px on 64 px Hobs, 4 px on UI panels, 1.5 px on icons at 24 px. Inner detail lines use 60 to 70% of the outer width.
- Soft things (smoke, steam, glow, clouds far away) have no outline or a 2 px outline at 40% opacity. Hard things (blocks, Hobs, shells, props) always have a full outline.
- Line caps and joins are round.

### 2.3 Shading

- Flat base colour plus **one hard shade**: ink at 13 to 20% opacity, laid as a clean crescent or wedge on the bottom right. Light comes from the top left everywhere.
- **One highlight tick:** a short white stroke at 40 to 50% opacity near the top left edge.
- No gradients on characters, blocks or shells. Gradients are allowed only in skies, glows and the kettle halo.
- **Stitched seams:** dashed lines (6 on, 6 off at 1x) at 20 to 35% ink, or white at 55% on grass caps. Use them on hills, panels, flags and roofs. Never on characters' faces.

### 2.4 Value plan (depth)

| Layer | Value and saturation | Outline |
|---|---|---|
| Sky | Lightest, low saturation | none |
| Far hills | Light, 60% saturation | 3 px |
| Mid hills | Mid light | 3 px |
| Play terrain | Mid to dark; strata darken with depth | 4 px on the surface only |
| Forts, Hobs, shells, effects | Full saturation, full contrast | full |
| HUD | Paper plates with ink edges | 2 to 4 px |

Background layers never use the team blue or orange, the kettle teal or the Pennant gold.

---

## 3. Colour

All values are sRGB hex. The palette sheet is `[art: 20]`.

### 3.1 UI core

| Name | Hex | Use |
|---|---|---|
| Ink | `#2B1E2E` | All outlines, body text |
| Ink soft | `#4A3A4C` | Secondary text, annotation plates |
| Paper | `#FFF4DE` | Panels, top strip, HUD plates |
| Cream | `#FBE9C4` | Panel fills, inactive cards |
| Parchment | `#F3DDB0` | Workshop and map backing |
| Action gold | `#FFC23D` | Primary buttons (Play, Fire, Tinker it), selected chip |
| Action dark | `#D9952B` | Button lip and pressed state |
| Action light | `#FFE08A` | Highlights, selected nav tab |
| Pennant gold | `#FFD23F` | Pennants, stars, rewards |
| Kettle glow | `#4FE3C1` | **Reserved:** Heartkettle glow and Steam only |
| Glow light | `#C8FFF0` | Kettle highlights |
| Good | `#5CC35A` | Legal placement, bubble-level dot |
| Danger | `#E5484D` | Illegal placement, critical warnings |

### 3.2 Teams (aligned with `07 §7.1`)

| Cue | You | Rival |
|---|---|---|
| Colour | Blue `#2F6FDE` (dark `#1F4FA8`, light `#9DBDF5`) | Orange `#E8730C` (dark `#B35400`, light `#FFB070`) |
| On characters | Hob scarf | Flattener tie and hazard stripes |
| On forts | Flag, Stomper boots | Flag stripe, machine stripes |
| Shape | Round pips, round pin heads, pennant flags | Diamond pips, diamond pin heads, square flags |
| Pattern | Solid fills, long-dash ghost | Hatched fills, dot-dash ghost |

In a Couch Duel, Player 1 takes the "You" column and Player 2 the "Rival" column, with Hob art on both sides (section 5.5).

The Dusk and Ink colour sets from `07 §7.1` swap only these team values. Art must not bake team colour into shared sprites: scarves, ties, flags and boots are separate tinted parts.

### 3.3 Materials

| Material | Base | Shade | Light | Dark (holes, rubble) | Texture cue |
|---|---|---|---|---|---|
| Wicker | `#E3B565` | `#B8843A` | `#F6D894` | `#6B4A22` | Basket weave of rounded strands |
| Timber | `#B9733A` | `#87491F` | `#D9985A` | `#4A2A16` | Three planks, grain, nail heads |
| Cobble | `#A9A39A` (mortar `#8A8378`) | `#77716B` | `#CFCAC0` | `#3B3633` | Seven rounded stones |
| Brassbound | plate `#6B7A86`, brass `#E0AE3E` | `#47525C`, `#A9781E` | `#8C9BA6`, `#F7D57A` | `#2A3036` | Brass bands, rivets |
| Moonbrick `[U3]` | `#E6E9F5` | `#AEB5D6` | `#FFFFFF`, emboss `#CDD3EE` | `#3A3F66` | Crescent emboss, pale violet veins `#B9A8FF` |
| Footing | `#5A4A42` | `#3F332D` | `#7A6A60` | `#241C19` | Chevron stitching, four bolts `#A3938A` |

Per `07 §7.1`, materials differ by texture and outline first, hue second. Launch ships Wicker, Timber, Cobble, Brassbound and Footing. Moonbrick ships with Clankmouth Mines in U3; its veins moved from cyan to pale violet so that nothing near a fort glows close to the kettle teal. Material HP is now a flat ladder (30, 50, 80, 110, 140) [rulings B1], so art must sell each material by its quirk, not by looking twice as thick: Wicker burns and flutters, Timber burns and splinters, Cobble crushes, Brassbound shrugs off fire.

### 3.4 Hobs

| Part | Values |
|---|---|
| Skin (any Class, any Hob) | `#F2C9A0`, `#D99A6C`, `#A8673F`, `#7A4A2E`, `#F5D7B8`, `#C68457` |
| Coats (muted, patched) | `#7D6B5D`, `#6F7F5A`, `#8A5A4A`, `#5F6B7A`, `#94785A`, `#6A5A7A`, `#7A6A4A`, `#5A7468` |
| Boots | `#4A3328` |
| Blush | `#F28B82` at 55% |
| Team scarf | You blue `#2F6FDE` |

Class colours sit on the hat only and back up the hat shape:

| Class | Hat family (the read) | Colour |
|---|---|---|
| Lobber | Round dome or pot, with a knob | `#D9483B` brick red (fixed: keeps clear of Rival orange) |
| Zinger | Low cap with a long bill and a tall plume | `#3FA9F5` sky |
| Scatterjack | Wide floppy brim, low crown | `#8BCB3A` lime |
| Delver | Hard dome with a headlamp | `#9A6A3A` umber |
| Boinker | Beanie with a spring and ball on top | `#F06EAA` pink |
| Sizzler | Tall puffy toque with a smoke puff | `#B8325A` wine |
| Patcher | Puffy flat cap with a trowel tucked behind | `#2FB7A6` teal |
| Peeper `[U2]` | Pointed hood that curls back, big brass lens | `#F2E05A` lemon |

Seven Classes ship at launch. The Peeper joins in U2, in lemon so that it does not match Pennant gold. Named Hobs [03 §3] keep their own hats, but each stays inside its Class family. Example: Marge Dumpling's floppy cook's hat is a soft round dome, which fits the Lobber family.

### 3.5 Flatteners

Flatteners are Hobs too [04 §1.1]: same body, pressed uniform.

| Part | Hex |
|---|---|
| Uniform grey | `#8A90A2` (dark `#5B6172`, light `#C9CDD8`) |
| Cream collar, aprons, flags | `#F2E8D5` |
| Pancake cap | `#4A4F5E`, band `#5B6172` |
| Bubble level badge | `#C9F7B0` with dot `#5CC35A` |
| White gloves | `#FFFFFF` |
| Team tie and hazard stripe | Rival orange `#E8730C`; the Flats add hazard yellow `#F2C200` |
| Machines (rollers, Grand Roller) | Steel `#8C93A8`, dark `#5E6478`, light `#C3C8D6` |
| Baron Levelwell | Coat `#8A90A2`, deep `#5B6172`, cap `#3E4250`, brass trim `#E0AE3E`, skin `#EAD3C0` |

### 3.6 Heartkettle

Copper `#D9773A`, shade `#A4521F`, light `#F2A469`, brass bands `#E0AE3E`, porthole and halo Kettle glow `#4FE3C1`. No shell, hazard or UI element may glow teal [art: 12].

Every Heartkettle has 300 HP, bosses included [rulings B4], so one kettle sprite set serves all forts. Its states change at the same marks as the HUD gauge, the whistle and the music [07 §2.4, §9.2]:

| State | Kettle HP | What shows |
|---|---|---|
| Full | 100 to 51% | Clean copper, steady glow, slow simmer wisp |
| Hurt | 50 to 26% | One crack across the belly, glow flickers, thin steam from the spout |
| Critical | 25 to 1% | Crack web, lid rattles, steam puffs in pulses, glow pulses with the whistle |
| Popped | 0 | Lid off, 12-frame pop, the fort sits down |

One threshold per meaning: 50% and 25% everywhere [audit C84]. The copper stays copper in every state. It never turns orange or red, so a hurt kettle on your side never reads as "theirs".

### 3.7 Effects

`07 §6.3` owns each type's colour and badge. Shot cards, trails and the weapons doc follow it [audit C82].

| Damage type | Phase | Badge shape | Colour | Art hex |
|---|---|---|---|---|
| Blast | Launch | Eight-point burst | Warm white | burst `#FFF3C4`, rim `#FFD23F`, soot `#5A4E52` |
| Pierce | Launch | Arrowhead | Pale yellow | streak `#FFF3A6` |
| Dig | Launch | Spade | Tan | dirt `#9A6440` |
| Fire | Launch | Flame | Ember red | flame `#E0392B`, mid `#F26B4E`, core `#FFD23F` |
| Frost | U2 | Six-arm flake | Ice blue | shards `#9FD8EE`, frost `#BFEFFF` |
| Zap | U3 | Bolt | Violet | arc core `#FFFFFF`, arc glow `#B49CFF` |
| Crush, Fall, Thump | Launch | Down chevron | Grey | dust `#CFC8C0` |
| Heal, repair | Launch | Plus | Green | sparkle `#7DDC7A` with `+` |

Rules that keep types clear of the sides:

- **No damage type is orange.** The Rival side is orange `#E8730C`. An orange trail reads as "theirs", whoever fired it. Fire moved to ember red; its hue sits about 25 degrees from the Rival orange and it always carries the flame badge.
- **No damage type is team blue.** Frost (U2) is a pale ice blue, far lighter than `#2F6FDE`, and always carries the flake badge.
- **Zap is violet, not cyan,** so it stays clear of the kettle teal and of Frost.
- **Fire against Danger red.** Fire `#E0392B` and the UI Danger red `#E5484D` are close. They never meet: Danger is a HUD and Workshop colour on paper plates; Fire is a field effect with a gold core.
- **The shell's owner** shows by the trail's edge, not its fill: a thin blue rim on your shots, a thin orange hatched rim on the Rival's. The fill is the damage type.
- Burn on a block uses the same ember red with a gold core. Lava (U3) and lamp light (U2, U3) in backgrounds shift to red-hot `#E5402A` and amber `#FFC857` so no background prop is orange (section 4.3).

### 3.8 Region biomes

Names and palette notes follow `05 §2`. Thumbnails: `[art: 14]`.

| Region | Sky top / bottom | Far hills | Ground cap | Ground body | Accents |
|---|---|---|---|---|---|
| 1. Puddingstone Downs | `#9ED8EC` / `#FFF1D0` | `#B7DDA8` | meadow `#7CC46A`, `#5AA555` | loam `#9A6440`, `#7A4A2E` | butter `#FFE08A`, jam `#D9483B`, puddingstone `#C9A27A` |
| 2. Crumblecrag | `#D6E2EA` / `#F7F9FA` | slate `#B9C0C8` | lichen `#9DB35A` | slate `#8E96A0`, rust bands `#A8502E` | ochre Clay `#D9A441` (marks where Dig works) |
| 3. Soggybottom Fen | `#BFD9C8` / `#F1F4E2` | moss `#A9C8A0` | reed `#8FAE4A` | mud `#6E5A3E`, `#55452E` | pond teal `#5FA8A0`, reed gold `#C9A84A`, lily `#E27FA0` |
| 4. The Flats | `#DCD6E4` / `#F7F4F0` | plate `#E1DED8` | plate `#A8ABB2` | rivets `#6E727A` | off-white `#F2EEE6`, hazard `#F2C200`; freed hills bring back `#7CC46A` |
| 5. Frostwhisker Peaks `[U2]` | `#8FC6EE` / `#EAF6FF` | snow `#DDEBF8` | snow `#F4FAFF` | rock `#6F7E9A`, `#4E5A72` | ice `#9FD8EE`, pine `#3F6E73`, lamp amber `#FFC857` |
| 6. Clankmouth Mines `[U3]` | `#1E222B` / `#3A3A44` | cave `#4A4440` | ore floor `#8C7A5A` | blue-brown `#4A4440`, `#2A2E38` | lamp `#FFC857`, lava `#E5402A`, brass `#E0AE3E` |

Regions 1 to 4 ship at launch [05 §2]. The Flats is now Region 4. It starts grey; each freed hill adds back the colours of Regions 1 to 3, so colour returns as the level goes [05 §2.5]. The Mines (U3) have no level dark enough to hide a shell: forts and crews carry their own lamps, and shells get a 1 px light rim there.

---

## 4. Readability rules

### 4.1 Sides and teams

- Four cues at once, never colour alone [07 §7.1]: colour (blue vs orange), shape (round vs diamond), side of screen (you left, rival right), pattern (solid vs hatched).
- Character shape is a fifth cue: round hats on your side, flat caps on theirs [04 §1.1]. A Couch Duel has Hobs on both sides, so this cue is absent there; the diamond hat patch and hatched scarf of Player 2 stand in for it (section 5.5).
- In the Tall layout the side-of-screen cue becomes: your fort in the Bottom lens, the target in the Top lens, blue at the left end of the Field Strip and orange at the right [07 §2.6].
- Your fort goes see-through on your turn [00 §2.7]: blocks drop to 35% opacity, Nooks and the Kettle Room draw at full strength with a 2 px light rim.

### 4.2 Silhouette tests (must pass before colour)

| Test | Size | Pass rule |
|---|---|---|
| Hob Class | 24 px tall, solid ink | All 7 launch Classes named correctly by 4 of 5 testers (8 once the Peeper ships) |
| Hob Class, worst case | 16 px tall (zoom 0.6 at @1x) | Lobber, Zinger, Sizzler distinct; the rest by colour plus context |
| Hob vs Flattener | 24 px, solid | 5 of 5 testers tell the sides apart |
| Shells | 12 px, solid | Each family reads by outline: round pot, bolt, ball, jar, spike |
| Blocks | 19 px (zoom 0.6 at @2x) | Material named by texture in greyscale |

The tests are drawn in `[art: 09]` and `[art: 10]`. CI should render each new character as a solid shape at 24 px and put it on a contact sheet for review.

### 4.3 Contrast and clutter

- HUD glyphs at least 3:1 on any ground; text at least 4.5:1 [07 §7.1]. Every HUD element sits on a paper plate or has an ink outline.
- Terrain body and forts differ by at least 25 L* (CIELAB). Forts are lighter than the strata behind them.
- The trajectory preview is white dots with an ink ring. Nothing else on the field uses white dots.
- At most one bright accent per region background. No background prop may be orange, blue, teal or gold. Crumblecrag's rust bands are a dull brown-red `#A8502E` for this reason.
- Enemy Class icons stay on screen all battle [rulings B10]. Each is the Class icon in a diamond frame with the orange hatched edge; yours sit in round frames.
- Debris fades within 1.5 s after the settle. Particle caps by quality tier (section 8).

### 4.4 Phone size

- Logical screen 960 x 540; 1 cell = 1 logical px [00 §2.1, 04-tech §10]. Auto-frame never zooms below 0.6 [00 §2.6].
- At zoom 0.6 on the @1x set a block is about 10 px and a Hob about 16 px. That is the floor we design for. At zoom 1.0 on the @2x set a block is 32 px and a Hob about 52 px.

### 4.5 Portrait: what it means for art

Both orientations ship at launch [07 §2.6, §4.10]. The rule for art is **one set of assets, two arrangements.** Nothing is painted twice.

**Battle view (stacked lenses).** In portrait the screen stacks a Top lens on the target fort, a thin Field Strip map, and a Bottom lens on your fort with the HUD under it [review 06 G1].

| View | Block on screen, phone | Block on screen, tablet | Art note |
|---|---|---|---|
| Bottom lens (your fort) | 16 pt, range 12 to 18 | 24 pt, range 18 to 24 | The closest standing view in the game. Damage states, Nook props and Hob faces all read here |
| Top lens (target fort) | 12 pt, range 10 to 18 | 20 pt, range 14 to 24 | Class hats and Loophole Flaps must read at 10 pt blocks |
| Joined lens in flight | 8 to 12 pt | 12 to 20 pt | The same floor as landscape |
| Wide look (overview) | about 4 pt | about 8 pt | Forts read as team-coloured shapes only |

- **No new sprite scale.** The largest block in portrait is 18 pt on phones and 24 pt on tablets, which matches landscape at zoom 1.25. The @1x and @2x sets and the 1.25x hero exports cover it (section 12, step 4).
- **The floor is higher than landscape.** In a lens a Hob is never under 16 pt tall while you plan. The 16 px silhouette test in 4.2 still sets the floor, for the flight view.
- **Camera framing.** A lens frames one fort, off centre: your fort sits in the left 40% of the Bottom lens with open air for the arc. So a fort must read with its far side cropped by nothing but sky. Flags and roof caps stay inside 1.5 blocks above the grid, or a lens crops them.
- **Tall views see more sky and more ground.** The joined lens is 675 pt tall on a phone and can show about 1350 cells of height, against 900 in landscape. Rules: the sky is a code gradient and runs as high as needed; no parallax layer has a hard top edge (the top 30% of each layer fades out); cloud sprites fill high sky by code; ground strata tile downward for at least 400 cells under the lowest fort.
- **Parallax layers** stay 2048 x 1080 per layer. A lens shows a 390 pt wide slice of them, so each layer needs something to look at in every 400 px of width. No layer may rely on one hero prop in the middle.
- **Seam between lenses.** The Field Strip is the seam: a paper band with ink edges, 32 pt on phones and 40 pt on tablets. When the lenses join it slides to the foot of the view.

**Field Strip marks (new, small).** All are drawn by code from live data, with three small sprites:

| Mark | Size @2x | Notes |
|---|---|---|
| Fort mark | made by code from the fort's grid, about 52 x 40 px | A solid shape in the side's colour with its flag: pennant for round, square for diamond. A dot marks a Loophole Flap |
| Mini Pin heads | 12 px | Round and diamond, tinted. Display only |
| Lens brackets | 9-slice, 8 px corners | Thin ink brackets that show what each lens frames |
| Shell dot | 10 px | White with an ink ring, like the preview dots |

**UI kit, two layouts.**

- Every panel, plate and button is 9-slice, so one kit serves both layouts. New 9-slice pieces: the two-row top strip plate, the Field Strip band, the bottom dock plate (tray plus crew row), and a bottom-sheet panel with a grab bar for cards that rise from the bottom in portrait.
- The Hob column and the crew row use the same portrait frames. Shot chips draw at 48 pt in the portrait tray and 52 pt in landscape from the same 64 px art.
- **Brickabrac Map.** The same region paintings (2400 x 1080) serve both. In portrait the strip shows at full height and pans sideways, about a third of a region per screen. Art rule: nodes, Trial towers and Grand Fort icons sit inside the middle 70% of the painting's height (rows 160 to 920), so the top bar, the region rail and the dock never cover one in either layout. Each third of a region needs its own point of interest.
- **Tinker Tree.** In landscape the bench sits at the left and the branches run right. In portrait the bench sits at the bottom and the branches rise. So the pipes are a **kit laid out by code**: straight, elbow, tee, fork valve and end cap, each of which may be turned by 90 degrees. The bench and the leaf icons are always upright. Light on pipe pieces comes from straight above so a turned piece still looks right.
- **Workshop.** The grid is 8 wide by 10 high and suits portrait: cells draw at 40 pt on a phone. The palette tiles (48 px export) and the 128 px Almanac tiles cover it.
- **Cutscene panels** stay 960 x 540. In portrait a panel shows full width (390 x 219 pt) on a paper mat, with the caption below it. Rule for new panels: the action sits inside the centre 4:3 so a tablet in portrait can crop to it and show it larger.
- **Boot card, title and key art.** The logo is one file, centred on a sky made by code. The key art `[art: 02]` gets a second crop: 1080 x 1920, both forts stacked on a steep hill with the arc between them.
- **App listing art.** Screenshots come in both shapes: 5 landscape and 5 portrait.
- **Concept sheet:** `[art: 24]` shows the phone portrait battle screen at 390 x 844 pt.

---

## 5. Characters

### 5.1 Hob proportions [art: 09]

- Drawn on a 100-unit grid, feet at 0. Height to the crown of the head: 83 units. Hats add 15 to 35 units.
- **2.2 heads tall.** Head: circle, radius 21 (42% of body height). Body: pear, 44 wide by 40 tall. Boots: two rounded blocks 14 x 11. Hands: mitten circles, radius 6.5. Arms are implied, not drawn.
- Face sits on the right half of the head (Hobs face the rival). Eyes: two tall dots with a white glint. Nose: a round button. Cheeks: blush. Mouth: one line.
- In game a Hob in a Nook is about 26 cells tall (1.6 blocks).
- Expressions per Hob: happy, grit (aim), shout (fire), ouch, bonked (x eyes), cheer. Six faces.

### 5.2 Flatteners [art: 10]

- Same 100-unit body as Hobs. What changes: pressed grey uniform with two white crease lines, cream collar, orange tie, white gloves, black flat shoes, a pancake cap 64 units wide and only 14 tall with a bubble-level badge.
- Face: straight brows, half-closed eyes, a tidy flat mouth or a straight brush moustache.
- Each unit adds one straight-edged tool and at most one topper (leaf, leaves, pencil) [04 §2.2].
- Bonked Flatteners float off on a **square** Snooze Balloon [04 §1.1].

### 5.3 Baron Levelwell [art: 11]

- 1.6x a Hob's height. Long straight grey coat with brass trim, cream sash with the level-line badge, flat-board epaulettes.
- The flattest, widest cap in Brickabrac (128 units wide). Bubble-level monocle. A ruler-straight moustache wider than his face. A carpenter's square cane. A teacup always in hand [04 §1.4].
- Rides **The Grand Roller**: one big drum roller, a boxy cab, an orange stripe, a chimney.
- Expressions: smug, cross, bested. When bested only his cap tilts; the tea never spills.

### 5.4 Animation

Paper-doll rigs in the engine, not frame-by-frame, for Hobs and Flatteners (parts: hat, head, face, body, two hands, two boots, tool, team part). Tweens per state:

| State | Length | Notes |
|---|---|---|
| Idle | 1.6 s loop | 2% squash breathe, blink every 3 to 5 s |
| Selected | 0.3 s | hop 4 units, hat bounce |
| Aim | hold | grit face, tool raised |
| Fire | 0.25 s | recoil 6 units, shout face |
| Hit | 0.3 s | squash 15%, white flash 60 ms, stars |
| Needs a rest | loop | one cog over the head turns. The same cog serves every cause of a rest [rulings B16] |
| Tumble | 0.8 s | spin, bounce, climb back. A Tumble never costs a shot [rulings B9], so the Hob is back on its feet before the next turn |
| Dropped | 0.5 s | falls one floor with its Nook, lands in a squash |
| Squashed | 0.4 s | flat as a pancake for a beat, pops back with a squeak |
| Bonk | 1.2 s | x eyes, balloon pops from the hat, float up |
| Cheer | 0.8 s | jump, hat flies 10 units |

Faces swap as small sprites. No skeletal tool (Spine) is needed at launch [04-tech §10]. Hob states to draw are five: Open, Dropped, Tumbled, Squashed, Bonked [rulings B7]. There is no seat, perk or neighbour art.

### 5.5 Couch Duel: Player 2's look [art: 25]

Couch Duel ships at launch [07 §4.9]. Player 2 is a second Hob clan, not the Flatteners. The same team cues carry the side, so the three colour sets work with no new rules.

| Part | Player 1 | Player 2 |
|---|---|---|
| Colour | Blue `#2F6FDE` | Orange `#E8730C` |
| Scarf | Solid blue | Orange with white hatch lines |
| Hat mark | none | A small diamond patch on the hat band, stitched, in team colour |
| Portrait frame, pips, Pins | Round | Diamond |
| Flag | Pennant, points left | Square, points right |
| Stomper boots | Blue | Orange with a hatched toe cap |
| Fort | Any Blueprint, faces right | Any Blueprint, mirrored to face left |
| Snooze Balloon | Round | Round. It is a Hob. The balloon's string carries a small diamond tag |
| Crest (hand-off card, banner, results) | A round badge with a pennant | A diamond badge with a square flag |

- **No new characters.** Both sides use the Hob rig, hats, tools and faces. The scarf, hat patch, boots and flags are the tinted team parts that already exist (section 12, step 3), plus one new part: the diamond hat patch.
- **Flattener art is never used for a human player.** No grey uniform, no pancake cap, no square balloon.
- **Same Hob on both sides.** Both players may pick the same Hob. The scarf, the patch and the frame shape tell the two copies apart, in greyscale too.
- **The hand-off card** is a paper panel with a 12 px edge in the next player's colour and their crest at 256 px. A blue card and an orange card differ in edge pattern (solid or hatched) and crest shape, not only in hue.
- **Help marks** are small gold plus signs on a paper tag by the name: none for None, one for Some, two for Lots. Gold, since Help is a gift, not a penalty.
- **Starter Box forts** [review 06 G2] are plain, even builds from the launch block kit. Each gets a 256 px card thumb drawn by code from its grid.
- **Table mode** turns one player's half of the screen by 180 degrees [07 §4.9]. Art must hold no baked text and no light direction that looks wrong upside down in HUD plates; the field in each half stays the right way up for its reader.

---

## 6. Castle block kit [art: 03 to 08, 13]

### 6.1 Grid and sizes

| Item | Spec |
|---|---|
| Block | 16 x 16 cells [00 §2.7]. Source art on a 100 x 100 unit board |
| Export | @1x 16 px, @2x 32 px. Plus 48 px for the Workshop palette and 128 px for the Almanac |
| Corner radius | 10% (Footing 6%) |
| Outline | Inside the tile so tiles butt cleanly; neighbours show a double line, which reads as mortar |
| Variants | 2 fresh variants per material (stone layout or plank grain), picked by a seeded hash of the cell, so walls do not tile visibly |
| Nook | 2 x 2 hollow: dark back wall `#4A3530` with plank lines, wooden floor strip, a small lamp |
| Kettle Room | 2 x 2 hollow: dark `#2E2A3A`, steel floor, the Heartkettle at 30 x 30 cells |
| Loophole | Your forts: arched window. Flattener forts: square window [04 §1.1] |
| Roof caps | Free cosmetic shapes, 1 to 3 blocks wide: dome, sag, cone, crooked chimney (yours); flat crenel, square box (theirs) |
| Flatteners' forts | Neat cream paint stripes every second row; flags with a level line on a grey field and an orange stripe |

### 6.2 Damage states

| State | HP left | What shows |
|---|---|---|
| 0 Fresh | 100 to 67% | Clean tile |
| 1 Scuffed | 66 to 34% | One crack or dent, one small hole or popped detail |
| 2 Battered | 33 to 1% | Two or three cracks, a knocked-off corner, soot, a missing part |
| Broken | 0 | Rubble sprite at the block's base for 1.5 s, then it fades. The sim has already removed the block |

Per material:

| Material | State 1 | State 2 | Broken | Special |
|---|---|---|---|---|
| Wicker | One frayed hole, strand ends poke out | Two holes, sag, soot, smoulder wisp | 3 loose strand rolls and straw | Burns: flame overlay, chars to black |
| Timber | Split along the grain, a nail pops | One plank snapped off with splinters | Plank pieces and splinters | Burns |
| Cobble | Hairline crack across two stones | One stone gone, crack web | Pile of round stones and a dust ring | Dust ring on landing; heavy thud |
| Brassbound | Dent, scratches, a missing rivet | Two dents, a buckle, bent strap | Bent plate, loose strap curl, rivets | Zap arcs jump strap to strap |
| Moonbrick `[U3]` | Glowing crack, heal sparkle and `+` | Two glowing cracks, chipped corner, veins dim | Three pale shards with fading glow | Cracks seal a little at turn start, but not on a turn it was hit [rulings B1] |
| Footing | One crack | Crack web and soot | Stub: a low dark slab that still holds the row | Never falls [00 §2.8] |

Status overlays (shared, tinted per block): Burn (3-frame flame loop, ember red) and Soaked (drip lines) at launch; Brittle (frost rim plus snow tag) in U2. Each overlay also shows its icon once [07 §6.3]. There is no Chill overlay: a Hob that needs a rest shows the cog.

**Patches.** Oil, Sticky, Ice coats and Zones are one idea now: a patch on the ground or a wall with one icon and a turn count [rulings B16]. Art: a flat decal with a dashed ink edge, a centre icon for its kind and a small numbered tag. Colour follows the patch's damage type or is neutral cream.

### 6.3 Collapse view

The sim decides what falls with its support check; the view makes it fun [rulings C1]. Stone needs side support from 1 block, so tall stone forts are top heavy and a good low hit should drop about a third of a late fort [rulings B2]. The art must make that a show, not a stiff slide:

| Beat | Time | What shows |
|---|---|---|
| Creak | 0.3 s before | Blocks about to fall shiver 1 px and shed dust; a crack line runs along the break |
| Lean | 0.15 s | The chunk tips 3 to 6 degrees toward its unsupported side |
| Staggered drop | 0.2 to 0.6 s | Rows let go one after another, top row last, each 40 ms apart |
| Land | 60 ms | Squash to 90% height, then spring back |
| Break | 0.3 s | 2 to 4 shard sprites per block on cosmetic arcs, dust puffs sized by material |

Wicker flutters, Timber splinters, Cobble thuds and skids, Brassbound clangs and bounces once. Shards are view only and never touch the sim. The week 4 prototype compares this with a cheap tumbling model; the art budget above covers either.

### 6.4 Marks that teach "aim low" and show the Loophole Flap

From the lessons of the reference games [review 06 G5, G6; 07 §3.11].

- **Lean Lines.** While a block is held: a 2 px Pennant gold outline on that block; a dashed ink outline, 55% opacity, on each block that would fall; thin gold lines from the held block up through its load, drawn as stitches; a small down chevron on each falling block and over any Hob who would Drop or Tumble; a paper count tag (`falls: 6`). No red. It is a reading aid, not a warning.
- **Shimmer.** A block that hangs by weak support gets a slow white glint, 30% opacity, that crosses it on the diagonal every 3 s. Reduce motion: a still dotted ink outline in its place. The glint is one shared sprite, tinted by nothing, so it never reads as a team colour or as the kettle teal.
- **Drop!** A hit word in the in-play number font, paper fill with an ink outline and a gold burst frame, the same build as **Bonk!**. It shows at the base of the first big fall in a battle.
- **Loophole Flap.** A small canvas flap that hangs over a Loophole once a thread shot has passed it: cream cloth with two stitched patches, a rope tie and a hem in the fort's team colour (blue, or orange with a hatch). A tiny wind-vane tag on it shows the rounds left in the Weather Front. It must read at 10 pt blocks, so its silhouette is a plain drooping rectangle with one notched corner. When the front changes it rolls up in 4 frames. The flap lifts for the shot of the Hob behind it.
- Assets: 1 glint sprite, 1 flap with a 4-frame roll, 1 chevron, 1 Drop! word per language (it is text set in the bitmap font, not baked art).

---

## 7. VFX style [art: 15]

- **Same rules as everything:** flat fills, 3 tones, ink outline on solid bits (shells, debris, flames), no outline on soft smoke and glows.
- **Impact anatomy:** frame 1 white flash on the hit target (60 ms); frames 2 to 8 an 8 to 10 point rounded starburst (gold rim, warm white core), scaled by blast band; debris chunks in the struck material; soot puffs that drift with the wind; the damage number pops [07 §6.3].
- **Blast sizes:** match the bands in `00 §9.3` (Tiny 10 cells to Huge 64). The burst radius equals the blast radius so players learn the reach.
- **Trails:** white soft streak behind fast shells; light shells leave dotted puffs; Zinger bolts leave a sky streak. The trail's thin rim shows the owner (section 3.7). Chalk arcs (Peeper, U2) are dashed white lines that stay all battle.
- **Per family, launch:** Pot bombs (round, fuse spark), bolts (arrowhead), fans (split ring at apex), bores (drill spike, dirt spray, tunnel), bouncers (squash on each hop, ring under the ball), fire pots (ember-red flames, embers, soot cloud), mortar globs (blob plus repair sparkle and `+`). **U2:** frost jars (six-arm shards, frost rim), chalk (dashed arc, Nook outline in Peeper lemon). **U3:** zap coils (zigzag arcs). Shot names follow the weapons doc [audit C50].
- **Timing:** bursts 8 frames at 30 fps (about 0.27 s); smoke 0.8 s; debris settles in under 1 s; everything idle-clean within the 3 s settle cap [00 §2.2].
- **Budgets:** Low tier 40 particles on screen, Mid 120, High 250. Debris uses pooled sprites, never physics bodies that the sim reads [04-tech §5].
- **Comfort:** Reduce flashes swaps the white frame for a 2 pt rim [07 §6.2]. No full-screen white flashes ever.

### 7.1 Sudden Squall

After the round cap, the wind grows at each Squall round start, and at each round end both sides' kettles and blocks lose HP at once; any fight ends by the end of the third Squall round [rulings B5, 00 §2.11]. It must read as weather, not as a punishment screen.

- **Sky:** the region sky gradient darkens by 20% over 1 s and a slate cloud band slides in along the top. No lightning flashes.
- **Rain and grit:** slanted streaks at the wind's angle, 30% opacity, behind the forts. More wind, flatter streaks.
- **Blocks:** on the round-end Squall hit every block on both forts shows a 1-frame grey shiver and sheds two grit specks. Damage states advance as normal.
- **HUD:** two rounds before the cap the round label widens to hold **Squall in 3**, then 2, then 1, with a storm cloud that grows a puff each round. In the storm the label turns slate and counts Squall rounds, 1 to 3 [07 §2.9, review 06 G4].
- **Colour:** slate grey `#6F7E9A` and paper white only. No team colour, no teal, no red.
- **Reduce motion:** no streaks; the sky tint and the HUD icon carry it.

### 7.2 "What broke you" replay

After a loss the game replays the shot that did the most harm in slow motion over the player's Blueprint [rulings B17, 07 §4.6]. Art: the field desaturates to 60%, the blocks that fell first get a 2 px gold outline and a small "1, 2, 3" order tag, the fatal shell's path draws as a dotted line with the Rival's diamond pin, and one line of words sits on a paper plate. No red, no shame.

---

## 8. UI style [art: 16 to 19]

- **Panels:** Paper `#FFF4DE`, 4 px ink edge, 18 px corner radius, a dashed inner stitch in Action dark at 55%, and a soft ink shadow (4 px down, 25%).
- **Buttons:** pills with a 5 px darker lip below; top 30% gets a white highlight band at 30%. Primary uses Action gold; secondary uses white; team actions (Test Yard, Your turn banner) use team blue.
- **Chips and cards:** rounded squares, white fill, 2 px ink; selected turns Action gold with a 3 px edge; unusable turns grey with a lock.
- **HUD plates:** the top strip is one paper band 36 pt tall in landscape [07 §2.3] and a two-row band 56 pt tall on phones in portrait [07 §2.6]. Every cluster sits on its own plate. Plates fade to 25% during Aim Drag [07 §2.3].
- **Portrait battle:** stacked lenses, drawn in `[art: 24]`. The Field Strip is a paper band with ink edges; the tray and the crew row share one dock plate; Fire sits bottom right in its gold pill (section 4.5).
- **Couch Duel:** setup and the hand-off card are drawn in `[art: 25]` (section 5.5).
- **Map:** one long painted strip of four regions at launch [07 §4.5]. Won ground has hills and sleepy hill faces; regions not yet won look ironed flat with roller stripes. After the Baron falls, two signposted roads lead off the strip: north to a flat, shiny peak and south to a smoking mine mouth [05 §8]. The Peaks and Mines paintings join as spurs in U2 and U3.
- **Pre-battle screen:** one sheet with the Rival, map thumb, goals, crew, Blueprint, a draft strip and Doodads [07 §4.1]. The Rival's habit sits on a cream tag with a small diamond pin, next to the portrait. In the draft the Rival's portrait glances at the shell it wants, and that chip carries a small diamond eye tag [review 06 G9]. A Hob with no shot that can reach the enemy on this map carries a **No line** mark: an arc with a bar through it on a paper disc at the portrait's corner [review 06 G10].
- **Tinker Tree:** a crooked brass pipe tree that grows out of a workbench, trunk at left, four branches to the right: Aim (leaf shaped like an arrowhead), Fort (a brick), Crew (a hat), Kit (a kettle). Nodes are brass cogs; 36 at launch, 9 per branch. Each branch has one fork, drawn as a split pipe with a two-way valve [07 §4.4, rulings B13]. In portrait the same pipe kit is laid out with the bench at the bottom and the branches rising (section 4.5).
- **Motion:** pop to 110% and settle in 120 ms on press; panels slide 200 ms with an ease-out; nothing bounces more than once.
- Sizes and states follow `07 §2.4`. The mockups draw at those sizes.

---

## 9. Typography

All fonts are free under the SIL Open Font License, from Google Fonts.

| Role | Font | Weight | Size (pt, phone) |
|---|---|---|---|
| Logo | Fredoka, hand-adjusted and outlined to paths | Bold | n/a |
| Titles | Fredoka | Bold 700 | 24 to 32 |
| Buttons, labels, card names | Fredoka | SemiBold 600 to Bold 700 | 14 to 20 |
| Body, help, captions | Nunito | SemiBold 600 | 14 to 18 (07 text steps scale this) |
| In-play numbers (angle, power, damage) | Fredoka Bold, baked to a bitmap (MSDF) font | Bold | 14 to 32 by band [07 §6.3] |
| CJK fallback (wave 2) | M PLUS Rounded 1c for titles, Noto Sans CJK for body | Bold, Regular | same |

- In-play numbers: paper fill, 2 px ink outline, tabular figures (set via the bitmap font's fixed advance).
- Never set body text in all caps. Titles may use caps for the logo ribbon only.
- Subset per language [04-tech §10]. Ship WOFF2 for web, TTF in the native builds.

---

## 10. Icon style

- 24 x 24 grid, 2 px inner padding. Export at 24, 48 and 72 px.
- Filled shapes with a 1.5 px ink outline (at 24 px). One flat colour plus white. No shading inside icons.
- Shape carries meaning; colour is a bonus. Class icons sit in a coloured disc: Lobber bomb, Zinger bolt, Scatterjack three dots, Delver drill, Boinker ball with hops, Sizzler flame, Patcher plus; Peeper eye in U2 [art: 09].
- Damage-type icons follow `07 §6.3`: eight-point burst, arrowhead, spade, flame, six-arm flake, bolt, down chevron, plus.
- Status icons at launch: flame (Burn), drop (Soaked), cog with number (needs a rest), balloon (Bonked), dizzy stars (Tumbled), patch tag with a turn count, storm cloud (Sudden Squall), flap (Loophole Flap), barred arc (No line), diamond eye (the Rival's wish). U2 adds flake with crack (Brittle).
- Shell cards have no rarity frame, no family tag and no per-Class lock [rulings B6, B16]. One small Class icon marks the Class that fires the shell best.
- Currency: Buttons are a four-hole sewing button in Action gold; Pennants are a gold swallow-tail flag on a pole.

---

## 11. Asset list

Sizes are the largest export (@2x) unless noted. Counts are **launch** targets under the phased plan [rulings A]. They are a cap: one artist and a contract animator make all of it [rulings C6]. Section 11.1 lists what each update adds.

| Group | Items | Launch count | Size @2x | Notes |
|---|---|---|---|---|
| Blocks | 5 materials (Wicker, Timber, Cobble, Brassbound, Footing) x 4 states | 20 | 32 px (+48, 128 for UI) | Footing broken = stub |
| Block variants | 2 fresh variants x 4 materials | 8 | 32 px | Seeded pick |
| Status overlays | Burn x3 frames, Soaked, scorch decal, crack decals x4, patch decal | 10 | 32 px | Tinted per block |
| Rubble and shards | 5 materials x 2 rubble variants, 3 shard sprites each | 10 + 15 | 32 x 32 | View only; fades after 1.5 s |
| Rooms and parts | Nook, Kettle Room, Cushion Loft, Loophole (2 styles), pod, pipe | 7 | 64 px | Three rooms at launch |
| Roof caps and decor | Roofs 8, flags 6, chimneys 4, decor props 20 | 38 | 32 to 96 px | Cosmetic sink [00 §5.3] |
| Stompers | Your boot, Flattener sole, 3 decor styles; 4 walk keys as parts | 5 sets | 64 px | Paper-doll legs |
| Heartkettle | 4 states (full, hurt at 50%, critical at 25%, popped), pop sequence 12 frames, halo | 17 | 64 px (128 UI) | One set for every fort |
| Hob base parts | Body, 6 coats, boots, hands, 6 skins as tints | 1 rig | 104 px tall | Shared by all Hobs |
| Hob hats and tools | 16 named Hobs in 7 Classes [03] | 16 hats, 16 tools | 64 px | Inside Class hat families |
| Hob faces | 6 expressions x 2 eye styles | 12 | 32 px | Swapped sprites |
| Flattener parts | Uniform body, caps, 14 unit tools and toppers [04 §2.2] | 1 rig + 14 | 104 px | Four wings: Neat Brigade, Chisel Corps, Drain Fleet, Level Guard |
| Lieutenants | Trimm, Scree, Drainwell, Plumb: full body + 3 expressions. Glaze and Bolt: one cameo pose each | 4 rigs, 12 faces, 2 poses | 160 px | Glaze and Bolt get full rigs in U2 and U3 |
| Baron Levelwell | Rig, 3 expressions, the Grand Roller, the Level Engine | 1 + 3 + 2 | 256 px, set pieces to 1024 | The two Stages of the Last Level |
| Grand Forts | Topiary Keep, Sanding Stair, Great Sump (the Last Level is counted above) | 3 | up to 1024 px | |
| Machines, hazards and level props | Tumblestone, Springy Hedge, Molehill, Rockfall Shelf, Updraft Vent, goats, Burp Vent, Marsh Gas, Sink Mud, Fog Bank, Hoisted Hill with chain and crane, Big Smoothie, Stamper, Bellows Tower, Cage, Bell Target, Outpost, pump, scaffold, barge, Ironing Board, Plumb Line, Tidy Balloon, Rockslide Rex, Sergeant Squeegee | about 26 | 64 to 512 px | [05 §2, §3] |
| Portraits | 16 Hobs, 14 Flattener units, 7 leaders (4 lieutenants, the Baron, 2 cameos) | 37 | 96 px (48 pt) | Named Rivals reuse their unit's portrait with one accessory and a name plate: about 23 accessories [05 §3.10] |
| Shots in flight | 7 Plain Shots, 16 Knacks, 30 Trick Shells, 8 Doodads [01] | about 61 | 24 to 48 px | Many Knacks share a body with a Plain Shot |
| Shot card art | One per shot | about 61 | 256 px | Almanac and the draft strip. No rarity frames |
| VFX | Bursts 3 sizes x 8 frames, smoke 6, sparks, debris tints, fire loop 6, splash 6, dirt spray 6, heal sparkle 4, stars, snooze balloons (round, square), Squall streaks and cloud band, collapse dust | about 60 frames | 32 to 256 px | Frost and Zap sets come with their updates |
| Terrain | 7 ground textures (Loam, Clay, Rock, Bedrock, Mud, Water, Pressed Plate) x 4 region tints, 4 grass caps | 7 + 4 caps | 256 px tiling | Tinted per region [04-tech §10] |
| Backgrounds | 4 regions x 3 parallax layers | 12 | 2048 x 1080 | Sky is a code gradient |
| Background props | about 15 per region | 60 | 64 to 512 px | |
| Brickabrac Map | 4 region paintings x 2 states (flat, lumpy), nodes, Trial towers, Grand Fort icons, 2 wing signposts | 8 + 20 | 2400 x 1080 per region, tiled 1024 | |
| Cutscene panels | About 45 still panels for Regions 1 to 4 [05 §1.5] | 45 | 960 x 540 | Flat style, reuses rigs and backgrounds |
| UI kit | 9-slice panels 5 (with the bottom sheet), buttons 6, chips 4, plates 6 (with the two-row top strip, the Field Strip band and the dock plate), tabs, sliders, toggles | about 34 | 9-slice | One kit for both layouts (section 4.5) |
| Field Strip marks | Mini Pin heads 2, lens brackets, shell dot; fort marks are made by code | 4 | 10 to 16 px | Portrait battle |
| Couch Duel | Crests 2 (round, diamond), diamond hat patch, hatched scarf and boot tints, hand-off card edge patterns 2, Help mark, 2 Players icon, Starter Box card frame | about 10 | 24 to 256 px | Section 5.5 |
| Reading marks | Glint, Loophole Flap with a 4-frame roll, fall chevron, No line mark, wish tag | 5 + 4 frames | 16 to 48 px | Section 6.4 |
| Icons | Classes 7, damage 6 (Blast, Pierce, Dig, Fire, Crush, Heal), status 10, nav 12, Tinker leaves 4, misc 50 | about 89 | 24, 48, 72 px | |
| Tinker Tree | Pipe kit (straight, elbow, tee, end cap), fork valve, cog nodes 4 states, workbench | about 12 | 64 to 512 px | 36 nodes use one cog with an icon each. Code lays the kit out sideways or upward |
| Logo and app listing | Logo, app icon (iOS 1024, Android adaptive), splash, 10 listing screenshots (5 landscape, 5 portrait), feature graphic, key art in two crops | about 17 | per listing spec | The game is free; there is no in-game store art |

**Against the last revision.** Hob hats and tools 28 to 16. Flattener units 28 to 14. Lieutenant rigs 6 to 4. Grand Fort set pieces 6 to 5 (three forts plus two Baron Stages). Portraits 63 to 37. Shots 50 (under-counted then) to about 61, all drawn. Backgrounds 18 to 12. Background props 90 to 60. Map paintings 12 to 8. Block sprites 24 to 20.

**Rough load.** Sixteen Hobs and 14 units at about two days each for hat, tool, portrait and rig checks is about 12 weeks. Four regions of terrain, backgrounds and props are about 10 weeks. Shots, cards and VFX are about 8 weeks. Bosses, machines and hazards are about 6 weeks. UI, icons, map and listing art are about 8 weeks, plus about 2 weeks for the portrait layout pieces, the Couch Duel parts and the reading marks. That is about 46 artist weeks for one artist over the launch plan, with the animator on rigs, set pieces and VFX. These are estimates for planning.

### 11.1 What each update adds

| Group | U1 Long Siege | U2 Frostwhisker Peaks | U3 Clankmouth Mines |
|---|---|---|---|
| Hobs (hat, tool, portrait) | +2 | +5, with the Peeper Class and its icon | +5 |
| Flattener units | +2 | +5 (Rink Wardens) | +5 (Pressworks) |
| Leaders | | Countess Glaze full rig, the Glidehall | Ironmaster Bolt full rig, the Stampmill |
| Blocks | | | Moonbrick: 4 states, 2 variants, rubble, heal sparkle |
| Damage type art | | Frost: shards, rim, Brittle overlay, flake icon | Zap: arcs, chain, bolt icon |
| Shots and cards | +8 shells, +2 Doodads | +10 shells, +2 Doodads | +10 shells, +2 Doodads |
| Region art | 12 Siege maps reuse launch regions | Peaks: 3 background layers, 15 props, map spur x2 states, Ice and snow textures, 4 hazards | Mines: 3 background layers, 15 props, map spur x2 states, Lava texture, 5 hazards |
| Level props | Scrap and boon icons (12) | Pedlar Fort, sled, hidden-crew `?` pips | Cart, Switch Lever, Lodestone, Hilltop zone marker |
| Tinker Tree | | +12 node icons | +12 node icons |
| Cutscene panels | | about 8 | about 8 |

---

## 12. Production pipeline

This follows `docs/research/04-tech-stack.md` §10.

1. **Draw in vector.** Inkscape (free), Affinity Designer or Figma. Save plain SVG to `assets/src/<group>/<name>.svg` on the 100-unit board for its group.
2. **SVG rules** (CI lint enforces them): `viewBox` set, no `<image>`, no external refs, no `<text>` (outline type to paths), no filters or masks except a plain `clipPath`, no blend modes, palette colours only (a lint maps every fill to a token in `assets/src/palette.json`).
3. **Separate team parts.** Scarves, ties, flags and boots export as their own white-filled sprites so the engine tints them for the three colour sets [07 §7.1].
4. **Rasterize** with resvg at fixed scales: @1x (540 px tall buffer) and @2x (1080 px tall). Hero sprites that the camera zooms into (Hobs, kettle, Baron) export at 1.25x of their nominal size to stay sharp at zoom 1.25, the recommended max camera zoom [rulings D7].
5. **Pack atlases** with a free packer (for example `free-tex-packer-core`), 2048 x 2048 pages max, 2 px padding and 1 px extrude. Groups: `ui`, `common` (blocks, Hobs, shells, VFX), and one atlas per region (terrain tints, backgrounds, props, hazards) loaded on entry.
6. **Encode** WebP where alpha holds up, PNG fallback. File names carry a content hash; the loader reads a manifest [04-tech §10].
7. **Fonts:** subset per language; bake the in-play bitmap font (MSDF) from Fredoka Bold.
8. **Animation:** paper-doll rigs defined as JSON (part list, pivots, tween keys) in `packages/content`, played with engine tweens. Sprite frames only for VFX and the kettle pop.
9. **Checks in CI:** SVG lint; atlas page budget (common under 3 pages @2x); silhouette contact sheet at 24 px for new characters; HUD renders through three colour-blind filters and greyscale [07 §7.1]; a screenshot test of each region at zoom 0.6; the same HUD checks in the Tall layout at 390 x 844 and 820 x 1180 pt.
10. **Review loop:** concept SVG, then silhouette pass, then colour pass, then in-engine at zoom 0.6 and 1.0 on a mid phone in landscape and in both lenses in portrait, then sign-off.
11. **Names first.** A trademark and store search on world, crew and shell names runs before art production starts, so no named asset is drawn twice [rulings D9].
12. **Team.** One artist plus a contract animator from the slice on [rulings C6]. Art sets the ship date, so the launch list in section 11 is a cap, not a floor. One named content owner holds the counts [rulings D10].

The concept SVGs in `docs/art/` are generated from small drawing helpers and follow these rules except one: they use live `<text>` with a font fallback list, so labels stay editable. Production art outlines all type.

---

## 13. AI-art policy

- **Decided by the owner: all shipped art is made by human artists.** Shipped means anything a player sees in the game, the app listing or marketing. The concept sheets in `docs/art/` set the direction; they are not final art.
- **Why:** clean ownership and copyright; press and platform scrutiny of generated art; our pillar is a hand-made, stitched look; and generated art drifts toward the look of the games it learned from, which breaks the "clearly original" rule in the brief.
- **Allowed:** private mood boards and reference gathering that never ship and are never traced; tools that do not make images (palette checks, colour-blind simulation, packing).
- **Not allowed:** generated images, textures or characters in the shipped game; tracing or painting over generated images; prompts that name other games or artists.
- **Records:** every shipped asset keeps its source file and the name of the person who made it in the asset manifest.

The concept SVGs in this repo were hand-built as code from simple shapes. No image generator was used.

---

## 14. Cross-doc notes and open questions

1. **Team colours.** This doc and `07 §7.1` agree: you blue `#2F6FDE`, Rival orange `#E8730C`. Primary buttons use Action gold `#FFC23D`, which is kept clear of Rival orange by hue and by its lipped pill shape.
2. **Lobber hat colour** is brick red `#D9483B`, to keep distance from Rival orange. Settled.
3. **Damage-type colours.** `07 §6.3` owns the table. Fire is ember red, Zap is violet, nothing is orange or team blue. The weapons doc's cards and trails follow it [audit C82].
4. **Kettle thresholds.** 50% and 25% in art, HUD, whistle and music [audit C84].
5. **Hat families vs named Hobs.** `03` gives each named Hob its own hat. Each must stay inside its Class hat family (section 3.4). The crew doc should check its 16 launch looks against that table.
6. **Flattener crew art** follows `04 §1.1` (Hobs in pressed uniforms). Units shown in `[art: 10]` use `04 §2.2` names.
7. **Named Rivals.** The campaign doc names 23 regular Rivals at launch; the scope review planned about 20. Rivals reuse unit portraits with one accessory each, so the cost is small. If art runs short, Rivals share accessories before any is cut.
8. **Concept sheets to redraw.** These sheets no longer match the rulings. They are direction only, so this is a tidy-up, not a blocker:

| Sheet | Fix |
|---|---|
| `[art: 12]` Heartkettle | States at 50% and 25%, not 70% and 40% |
| `[art: 15]` Shots and VFX | Weapons doc names (Clodpot, Hatpin and so on) [audit C50]; Fire in ember red |
| `[art: 19]` Tinker Tree mockup | Four branches (Aim, Fort, Crew, Kit) with the tech tree doc's node names |
| `[art: 20]` Palette and style | Fire ember red, Zap violet, Peeper lemon, Moonbrick veins violet |
| `[art: 14]` Biomes | Order: Downs, Crag, Fen, Flats, then Peaks (U2) and Mines (U3) |
| `[art: 16]` HUD mockup | Enemy Class icons shown, no hidden `?` pips at launch, 5 Hobs at most |
| `[art: 17]` Campaign map mockup | Four regions and two wing signposts |
| `[art: 09]` Hob lineup | Mark the Peeper as U2 |

**Owner decisions.** Item 1 is decided; the rest are recommendations.

1. **Human-made art: decided.** All shipped art is made by human artists, with the concepts in `docs/art/` as direction (section 13).
2. **Max camera zoom 1.25,** which sets the export scale for hero sprites [rulings D7]. Recommend yes.
3. **Launch scope.** The asset counts in section 11 follow the four-region launch [rulings D1]. If the owner keeps all six regions for launch, use the last revision's counts and expect art to take about twice as long.
4. **Trademark search** on world, crew and shell names before art production [rulings D9].

---

## Appendix A. Parked ideas

Cut by the rulings or by this revision. None of it is in a phase plan.

| Item | Why it is parked |
|---|---|
| Fire in orange (`#FF8A1F`) | Read as the Rival's colour [audit C82] |
| Kettle art states at 70% and 40% | One threshold per meaning: 50% and 25% [audit C84] |
| Five-bough Tinker Tree art (Aim, Crew, Fort, Arsenal, Steam) | The tree has four branches [rulings B13] |
| Chill overlay and snow-tag status icon | Chill merged into "needs a rest" [rulings B16] |
| Separate art for Oil, Sticky, Ice coat and each Zone kind | One patch look with an icon and a turn count [rulings B16] |
| Seat and neighbour link art, perk icons, Perched and Porch poses, Crowded marker | The seat layer is cut [rulings B7] |
| Rarity frames and family tags on shell cards | No rarity on shells; any Hob fires any shell [rulings B6, B16] |
| Grey "cannot fire" card state and the deny stamp | Same ruling |
| Hidden-crew `?` pips at launch | Enemy Class icons stay shown; hidden crew returns in U2 [rulings B10] |
| Last Bell art (swinging bell banner, tiebreak tally card) | Replaced by Sudden Squall [rulings B5] |
| Peeper hat in Pennant gold `#FFD23F` | Moved to lemon so it never matches a reward |
| Moonbrick cyan veins `#7FE0FF` | Too close to the kettle teal |
| Lieutenant rigs for Glaze and Bolt at launch | Cameo poses only until their updates |
| Turncoat Hob art per Grand Fort | Outfits only at launch [audit C32] |
