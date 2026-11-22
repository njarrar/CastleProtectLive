# Castle Protect audio (v0.1)

Every sound here is made by code in `tools/audio-gen/`. Nothing is recorded, downloaded or taken from a sample pack, so the whole set is ours to ship and can be rebuilt at any time.

Do not edit these files by hand. Change the code and build again.

## What is here

| Folder | What | Count |
|---|---|---|
| `sfx/` | Sound effects, named as in `docs/design/07-ux-ui-audio.md` section 9.3 | 85 |
| `music/` | Region 1 theme in three layers, map theme, title jingle, win and lose stings | 7 |
| `barks/` | Hob-speak: 8 Hobs x 6 barks | 48 |
| `audio.json` | The manifest: one entry per sound | |
| `barks.json` | Subtitles for the barks | |

Each sound ships twice: `.ogg` (Opus) for web and Android, `.m4a` (AAC) for iOS and old Safari. A platform loads one format only.

Size: 2.6 MB of Opus plus 2.7 MB of AAC, 5.3 MB in all. The cap for v0.1 is 8 MB and the build fails if it is passed.

## audio.json

One entry per sound:

| Field | Meaning |
|---|---|
| `id` | The name the game uses |
| `kind` | `sfx`, `music`, `sting` or `bark` |
| `files` | Paths from this folder: `ogg` and `m4a` |
| `duration`, `samples`, `sample_rate` | Length. `samples` is exact. AAC decoders may add a little padding at the end; trim to `samples` before you loop |
| `loop` | `true`: loops with no seam. If `repeat_gap_s` is set, wait that long between plays instead |
| `layer` | `base`, `stir` or `peril` for the battle music, else `null` |
| `sync` | For music: group, bpm, meter, key, bars and bar length. Layers in one group are the same length to the sample |
| `bus` | Mix bus: `music`, `ui`, `launch`, `flight`, `impact`, `material`, `kettle`, `hob`, `world`, `voice` |
| `volume` | Play gain, 0 to 1, before the sliders. Files are already set to their mix level, so most are 1 |
| `pitch_var_semitones` | Shift each play at random by up to this much, so nothing repeats like a machine |
| `trigger.game` | The core event (`core/API.md`) or UI moment that plays it |
| `trigger.anim` | The event in `assets/animations.json`, as `animation:event`. The sound starts on that frame. `<id>` is a Hob id, `<side>` is `blue` or `orange`, `<mat>` is a material |
| `note` | Timing hints, where a sound has a wind-up before its hit |
| `lufs`, `peak_db`, `bytes` | Loudness and peak before encoding, and file sizes |

The manifest also holds:

- `shot_launch`: which launch sound each shot in `content/shots.json` uses.
- `material_sounds` and `blast_sounds`: lookups for block hits and blast bands.
- `mix`: bus list, slider defaults and the mixing rules from 07 section 9.5.
- `music_layers`: when each layer plays.

## Music

All of it is built on our own four-bar tune, the Lump Tune.

| Id | What | Length |
|---|---|---|
| `mus_r1_base` | Puddingstone Downs. Toy tuba, banjolele strum, concertina pad, light washboard. Stereo | 71.1 s loop |
| `mus_r1_stir` | Tin whistle and music box lead, banjolele, claps, cowbell, hand drum | same |
| `mus_r1_peril` | Double-time washboard and drum, spoons, high whistle runs, horn pulse | same |
| `mus_map` | Brickabrac Map and menus. 92 bpm, 6/8. Whistle, concertina, plucked bass, hand drum | 41.7 s loop |
| `mus_title_jingle` | Title jingle | 4.5 s |
| `sting_win`, `sting_lose` | Win fanfare and a soft deflate | about 2 s |

Region 1 is 108 bpm, 2/4, G major, 64 bars. One bar is 1.111 s.

How to play the layers:

1. Start Base, Stir and Peril on the same sample, with Stir and Peril silent.
2. Fade a layer in or out on a bar line, over one bar. Never restart a layer.
3. Stir: a Heartkettle at 50% or less, or a side with 2 Hobs or fewer, or the Squall within 3 rounds.
4. Peril: a side on its last Hob, or a Heartkettle at 25% or less, or the Sudden Squall.

With all three up the mix sits near -18 LUFS, so impacts stay on top.

## Sounds that follow animations

| Animation event | Sound |
|---|---|
| `hob_*_fire:release` | `launch_*` for the shot (see `shot_launch`), and the `fire` bark |
| `hob_*_hit:flash` | `hob_hit_boing`, and the `takes_hit` bark |
| `hob_*_tumble:fall` | `hob_tumble_roll` |
| `hob_*_land:thud`, `hob_*_cheer:land` | `hob_land_thud` |
| `hob_*_bonked` frame 0, `:inflate`, `:lift` | `hob_bonk`, `hob_balloon_inflate`, `hob_balloon_float` |
| `hob_*_cheer:jump` | `hob_cheer` or the `win` bark |
| `hob_*_dig:clear` | `hob_shove_dig` (Shove Off) |
| `stomper_*_walk:stomp` | `cas_step` |
| `kettle_pop:crack`, `:pop`, `:sit` | `ket_crack`, `ket_pop`, `ket_sit_down` |
| `fx_impact_<mat>:flash` | `mat_<mat>_hit`. Dirt: `hit_miss_thud` |
| `fx_crack_<mat>` | `col_creak` at the start (0.3 s before the fall), `col_crack` on a damage step |
| `fx_chunk_<mat>`, landing, `fx_rubble_<mat>`, `fx_dustcloud` | `col_chunk_fall`, `col_chunk_land`, `col_debris_patter`, `col_dust_settle` |
| `fx_splash:plop` | `hit_water_splash` |
| `fx_fizz_pop:pop` | `hit_mend_fizz` |
| `fx_pin_p*_drop:stick` | `aim_pin_drop` |
| `pot_lid_raise:up` | `doo_pot_lid_clang` |
| `loophole_flap_*_close` | `cas_loophole_flap` |
| `ui_fire_press:fire` | `ui_fire_press` |
| `ui_pennant_earn:ding` | `meta_pennant_stamp` |
| `ui_handoff_flip:swap` | `ui_handoff_flip` |
| `fx_squall`, `fx_wind_leaf` | `wx_squall_loop`, `wx_wind_loop` |

"Squall in 3" plays `wx_squall_bell` on the core event `squall_warning`.

## Hob-speak

Barks are gibberish from a small voice model in code: soft syllables such as bo, bim, wub, nok, pip, mum and hoo. There are no real words. The pitch curve carries the mood: up for cheer, down for a groan.

Each Hob has its own pitch and voice, so you can tell them by ear:

| Hob | Voice |
|---|---|
| Marge | Low, round, slow |
| Old Thumper | Lowest Lobber, creaky and shaky |
| Quill | High, clipped, quick |
| Jax | Fast, bright, stutters |
| Nan | High, thin, quavery |
| Grub | Very low, muffled mumble |
| Bobbin | Sing-song, always rising |
| Hetty | Warm hum, steady |

Six events each: `picked`, `fire`, `hit_lands`, `takes_hit`, `bonked`, `win`. Ids read `bark_<hob>_<event>`.

`barks.json` gives three subtitle lines per bark, in plain English, in that Hob's voice. Pick one at random with no repeats. Subtitles show even when the Voices slider is at 0. Rules: one bark per side per turn step, 1.5 s between barks; most events bark 40% of the time; Bonks and wins always bark.

## Mixing

- Files are set to a loudness for their bus, so they sit right at volume 1: impacts loudest (-13 to -18 LUFS), barks -18, UI -22 to -25, loops -24 to -28, music layers -22 to -25.
- No decoded file peaks over -0.5 dBFS. The build checks this after encoding and turns a file down if a codec overshoots.
- Bass under about 150 Hz is turned down, and big sounds carry a 400 to 800 Hz knock, so they read on a phone speaker.
- Duck music 6 dB under an impact (not `hit_blast_tiny`) and 3 dB under a bark.
- No sound before the Play tap on first launch.

## Build again

```
pip install -r tools/audio-gen/requirements.txt
python3 tools/audio-gen/build.py
```

Needs Python 3.11 or newer and ffmpeg with libopus. It takes about two minutes. `--only sfx`, `--only music` or `--only barks` builds one part. Sounds are seeded by id, so the same code gives the same sound.

| File | Job |
|---|---|
| `build.py` | Runs it all: makes, trims, sets loudness, encodes, writes both manifests |
| `dsp.py` | Sines, noise, filters, room, limiter, loudness meter |
| `sfx.py` | The sound effects and where each one plays |
| `music.py` | Instruments and the tunes |
| `barks.py` | The Hob voice, the bark sheet and the subtitles |
| `qa.py` | The checks below |

## Checks

The build decodes every shipped file and tests it: no clipping, not silent, no DC offset, no dead air at the start, no hole in the middle, right length (loops exact), not too much energy in the harsh 2.5 to 6 kHz band, not too much under 200 Hz. It also sums the three music layers and checks the peak. Results go to `tools/audio-gen/qa/report.txt`.

It also draws a waveform and a spectrogram for every sound to `tools/audio-gen/qa/*.png`, with a picture of each loop seam. Look at these after any change. They are not kept in git.

## Not in v0.1

The Rival tag stem, the Tidy March, Workshop theme, Regions 2 to 6, Flattener and Baron voices, second takes of each sound and per-shot launch layers. The ids here leave room for them.
