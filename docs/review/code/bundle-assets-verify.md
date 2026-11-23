# Bundle check: art and audio assets

What was run on the patch bundle's generators in `tools/art-gen/` and `tools/audio-gen/`, what broke, what was fixed, and what the files in `assets/` look like now. Nothing is committed.

## Result

| Gate | Result |
|---|---|
| `node tools/art-gen/gen-sprites.mjs --v2` | 886 sprites |
| `node tools/art-gen/render-sprites.mjs --v2` | 1 page at @1x, 1 page at @2x |
| `node tools/art-gen/verify-atlas.mjs --strict --max-pages 1` | PASS, 0 errors |
| `python3 tools/audio-gen/build.py` | QA 0 problems, 6.28 MB of 8 MB |

## Atlas, before and after

| | Before (HEAD) | After (`--v2`) |
|---|---|---|
| @1x pages | 1 x 2048, 2.50 MiB | 1 x 2048, 2.35 MiB |
| @2x pages | 4 x 2048, 6.55 MiB in all | 1 x 2048, 2.86 MiB |
| @2x GPU memory | about 64 MiB | about 16 MiB |
| Frames per scale | 871 | 874, plus 529 aliases |
| `assets/atlas/` | 9.3 MB | 5.8 MB |
| `assets/sprites/` | 1743 files, 12.3 MB | 2830 files, 16.8 MB (434 are new Flattener frames) |
| Contact sheets | 7.2 + 4.3 MB | 5.6 + 4.6 MB |

The bundle's claims hold: one @2x page, trimmed frames, neutral Hobs with scarf overlays, all 7 Flatteners, the 10 props, 9 UI icons, 8 Knack icons.

## Art: what broke and what was fixed

1. **`icon_gravel` was gone.** The bundle renamed it to `icon_gravel_sneeze`, but web (`battle.ts`) and Android (`Theme.kt`) still ask for `icon_gravel`. Fix: the `--v2` index now aliases `icon_gravel` to `icon_gravel_sneeze` (`LEGACY_ALIASES` in `atlas-pack.mjs`); the old non-v2 build makes the sprite again.
2. **Old per-team sprite files were deleted.** With `--v2`, `hob_<name>_<team>_*` and `portrait_<name>_<team>` had no PNG files any more. The Android test `AnimsAudioTest` needs `assets/sprites/<frame>@2x.png` for every animation frame, and iOS loads `portrait_<name>_<team>@2x.png` from `sprites/`. Fix: `render-sprites.mjs` now draws a PNG for every aliased name (1x and 2x), made from the neutral SVG plus its overlays, placed the same way the apps place them. These files are not in the atlas.
3. **Orange Hobs lost the diamond hat patch.** In v0.1 it was the P2 shape cue for colour-blind players. Fix: a new 8 x 8 overlay `hob_patch_orange`, placed through the hat and body transforms for each pose. Checked frame by frame against the old atlas: it lands where the old patch was.
4. **Portraits lost their team scarf.** The aliases pointed `portrait_*_blue/orange` at the neutral disc with no overlays. Fix: portraits now get the scarf overlay (and the P2 hat patch), mapped through the portrait transform.
5. **Dead animations.** The bundle added `hob_*_neutral_*` clips no app plays (88 of them). Removed. `animations.json` now has 282 clips: the old 212 plus 70 Flattener clips that web and iOS use.
6. **Previews and the animation sheet showed Hobs with no scarf**, because alias names fell back to the neutral file. They now use the composited files. Contact sheet title says v2.
7. **PNG size.** Chromium writes PNGs with fast compression. Added a lossless re-compress pass (`pngRecompress` in `atlas-pack.mjs`, no new dependency): sprites 20.3 to 16.1 MiB, atlas 6.0 to 5.2 MiB, sheets 12.5 to 9.8 MiB. Checked pixel exact.
8. **verify-atlas gaps.** It never read the packed pages. It now checks: every packed sprite, alias target, overlay and animation frame resolves to a frame; frames sit inside the page and do not overlap; page PNG size matches its JSON; each alias has its legacy files; each animation frame has its `@2x.png`. Tested by breaking a copy of the atlas: it fails as it should.

## Art: how it looks

Looked at the contact sheet, the animation sheet and side by side crops of old and new frames (drawn the way the apps draw: alias, untrim, overlays).

- Team Hobs read the same as v0.1: scarf on the neck, hatch and diamond pin for P2, hat patch for P2, Snooze Balloon in place.
- Flatteners are on-brand: slate suits, orange ties, green spirit-level caps, white gloves, square balloon. They have faces and stay closer to the house style than the faceless figures on plate 3. That is fine.
- Props and Knack icons match the plates in subject. The lawn sign has English text baked in ("KEEP OFF THE GRASS").
- Trade-off to know: to fit one page, Hob and Flattener frames sit on the @2x page at @1x size. On 3x phones they are a little soft next to blocks and UI. `--char-scale=2` packs them at full size but needs more pages.

## Audio

`build.py` first gave 160 QA problems. Two causes, both in the bundle's new gates, not in the sounds:

1. **m4a length.** The bundle cut the AAC length limit from 2200 to 32 samples and called the decode "elst aware". It was not: the ffmpeg CLI drops the encoder's start padding but keeps the tail padding (up to 1023 samples). Also the edit list was written in whole ms. Fix: encode with `-movie_timescale 48000` so the edit list is sample exact (players that honour it, such as AVFoundation, now cut the tail), and `decode()` cuts m4a to the edit list length. Checked on a test tone: length exact, offset 0.
2. **Loop seam gate.** It compared one sample jump at the wrap to the plain RMS step. On noisy loops (`fly_roll_loop`, `fly_whistle_loop`) Opus noise alone trips that. The source PCM seams were clean (0.07 and 0.42). The gate now compares the 1 ms window at the seam to the whole file, and the seam jump to the 99.9th percentile step. Tested: clean loops score 0.6 to 1.1; a bad cut or a gap scores 2 to 6.5 and fails.

After the fixes: 0 problems. `mus_r1_stir` and `mus_r1_peril` are true stereo now (L/R correlation 0.74 and 0.79). Total 6.28 MB (was 5.29 MB), under the 8 MB cap. Looked at the stir and peril sheets, the stir seam plot and the flight sheet: no clicks, gaps or clipping seen.

## Repo hygiene

- Added `tools/.gitignore` (`.venv/`, `venv/`, `__pycache__/`, `*.pyc`, `.cache/`, `node_modules/`) and `assets/.gitignore` (`.tmp-*`). QA PNGs stay out through `tools/audio-gen/.gitignore`. No venv was needed: numpy 2.5.3 and pillow 12.3.0 were already installed at the pinned versions.
- `assets/README.md` now explains the v2 atlas, aliases, overlays and the legacy files.

## For the app owners (not changed here)

- `apps/android/.../AnimsAudioTest.kt` asserts 212 animations. There are now 282 (70 Flattener clips). That count needs updating.
- Apps that loop the m4a files should still cut to `samples` from `audio.json`, in case a player ignores the edit list.

## Play and look pass

Work for `naming-decisions.md` "Play and look" (items 3, 4, 6) and `naming-and-voice-review-opus.md` section 5 (rows 4, 5, 7, 8). Only `assets/` and `tools/` changed. `assets/audio/barks.json` was not touched.

| Gate | Result |
|---|---|
| `node tools/art-gen/gen-sprites.mjs --v2` | 1150 sprites (was 886) |
| `node tools/art-gen/render-sprites.mjs --v2` | 1 page at @1x, 1 page at @2x |
| `node tools/art-gen/verify-atlas.mjs --strict --max-pages 1` | PASS, 0 errors. 1138 frames, page 88% full |
| `python3 tools/audio-gen/build.py --no-barks-json` | QA 0 problems, 147 sounds, 6.39 MB of 8 MB |

### Hob timing (row 4)

All 8 Hobs had the same ms. Now each has its own `idle`, `blink`, `fire` and `bonked` times (`TEMPO` in `tools/art-gen/sprite-anim.mjs`):

| Hob | Feel | idle ms | fire ms | bonked ms |
|---|---|---|---|---|
| Marge | warm, easy | 440 400 440 360 | 35 90 115 130 | 380 170 280 260 |
| Quill | precise, even | 340 380 340 380 | 30 75 100 145 | 340 170 240 240 |
| Jax | quick | 280 260 280 300 | 30 70 95 125 | 320 160 200 200 |
| Grub | slow, heavy | 640 600 560 600 | 40 95 115 140 | 380 200 340 340 |
| Bobbin | fidgety | 220 300 180 340 | 30 70 120 120 | 300 200 200 280 |
| Hetty | brisk | 380 340 400 320 | 35 80 105 130 | 350 190 250 270 |
| Old Thumper | a hitch mid breath | 520 130 440 520 | 35 120 70 145 | 360 200 380 160 |
| Nan | steady | 420 420 420 420 | 35 85 110 130 | 360 180 260 260 |

- Fire still releases on frame 0. Fire totals stay 320 to 390 ms (was 360). The build fails if one drifts out.
- Bonked `lift` (frame 2) lands 480 to 580 ms in (was 540).
- New fields on every idle clip: `random_start: true` and `start_offset_ms`. Apps should start the idle at a random time in the loop. If they do not, start at `start_offset_ms`; it is different per Hob and per team. Flattener idles get the fields too but keep one even beat on purpose.

### Rival look (row 5)

The only team parts were the blue and orange scarves, the P2 hat diamond and the Dusk and Ink scarves. No overlay could take away a Hob's class colour hat, so the Rival had your hats. Now there is a baked Rival look: the Hob's own hat shape in Flattener slate with a green level vial, plus the hatched orange scarf.

- Frames `hob_<name>_rival_<pose>_<i>` (264), clips `hob_<name>_rival_<action>` (84), portraits `portrait_<name>_rival`.
- Real atlas frames, not aliases: scarf and Snooze Balloon are baked in.
- Flatteners (`flattener_<key>_*`) stay the look for Neat Brigade units.
- Cost: @1x page 2.35 to 3.40 MiB, @2x page 2.86 to 3.75 MiB, `assets/sprites/` 16.8 to 20.8 MB. Still one page each.

### Sound cues (row 7)

New cues in `tools/audio-gen/sfx.py`, listed in `assets/audio/audio.json`:

| Cue | Event |
|---|---|
| `doo_lid_bounce` | `lid_block`, a shell bounces off a Pot Lid |
| `hob_buried_thlup` | `buried`, a Loophole is dug in |
| `cas_boss_horn` | `boss_phase` |
| `wx_front_chime` | `front`, a new Weather Front |
| `hit_threaded_zip` | `threaded` |
| `doo_roller_rumble` | `roller` (`roller_stop`, `roller_done` 3 semitones down) |
| `doo_shears_jam` | `shears_jam` |

`castle_drop` and `thump` already have `cas_thump`; `drop` has `hob_tumble_roll`. `assets/audio/README.md` has the full event table. Looked at the world sheet: no clicks or gaps.

### Bark gibberish (row 8)

The syllables live in `tools/audio-gen/barks.py`, not in `barks.json` text. Each Hob now owns three syllables nobody else says (`OWN`, checked on import): Marge dum lub mop, Thumper grum gob humf, Quill pin tet tik, Jax trat rrap pep, Nan klat nen dit, Grub mmm hmm mub, Bobbin ing dib lop, Hetty wel tut dem. The voice model got a rolled `r` (three quick taps) for Jax.

### barks.json

`build.py` used to rewrite `barks.json` from `barks.py`, which would wipe the writer's edits. Now it keeps the file as it is (keys such as `old_thumper`, subtitles, voice, extra fields) and only refreshes `hob_speak`, matched by `sound`. `--no-barks-json` leaves the file alone and prints the `hob_speak` lines that differ. This pass ran with `--no-barks-json`, so 40 `hob_speak` lines in `barks.json` are now stale. A plain `build.py` run after the writer is done fixes them.

### For the app owners (not changed here)

- Play `hob_<name>_rival_*` for Rival-side Hobs; read `random_start` and `start_offset_ms` on idle clips.
- Map events to the new cue ids above in `apps/web/src/core/real.ts` and `sfx.ts` and the iOS and Android tables.
- `AnimsAudioTest.kt` asserts 212 animations. There are now 366.
