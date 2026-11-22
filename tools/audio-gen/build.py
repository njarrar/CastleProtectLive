#!/usr/bin/env python3
"""Build every Castle Protect v0.1 sound from code.

    python3 tools/audio-gen/build.py            # build all, write manifests, run checks
    python3 tools/audio-gen/build.py --only sfx # sfx, music or barks
    python3 tools/audio-gen/build.py --no-qa

Needs Python 3.11+, numpy and pillow (requirements.txt) and ffmpeg with libopus.
Output: assets/audio/{sfx,music,barks}/*.ogg (Opus) and *.m4a (AAC),
assets/audio/audio.json, assets/audio/barks.json, tools/audio-gen/qa/*.png.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dsp          # noqa: E402
import sfx          # noqa: E402
import barks        # noqa: E402
import music        # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'audio')
SR = dsp.SR
BUDGET_BYTES = 8 * 1024 * 1024
SAFE_PEAK = 0.94        # no decoded file may pass this (about -0.5 dBFS)

# kbps for (Opus, AAC), per kind and channel count
RATES = {('sfx', 1): (48, 64), ('bark', 1): (40, 56), ('music', 1): (40, 48), ('music', 2): (64, 72), ('sting', 2): (56, 72)}

BUSES = {
    'music':    dict(parent='master', slider='Music', default=70),
    'ui':       dict(parent='sfx', slider='Sound', default=85),
    'launch':   dict(parent='sfx', slider='Sound', default=85),
    'flight':   dict(parent='sfx', slider='Sound', default=85),
    'impact':   dict(parent='sfx', slider='Sound', default=85, ducks_music_db=-6),
    'material': dict(parent='sfx', slider='Sound', default=85),
    'kettle':   dict(parent='sfx', slider='Sound', default=85, never_stolen=True),
    'hob':      dict(parent='sfx', slider='Sound', default=85),
    'world':    dict(parent='sfx', slider='Sound', default=85, ducked_by_voice_db=-4),
    'voice':    dict(parent='master', slider='Voices', default=80, ducks_music_db=-3),
}


def write_wav(path, x):
    if x.ndim == 1:
        x = x[None, :]
    r = dsp.rng(os.path.basename(path))
    dither = (r.random(x.shape) - r.random(x.shape)) / 32768.0
    pcm = np.clip(np.round((x + dither) * 32767), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[0])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.T.tobytes())


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def encode(wav, base, kind, ch):
    ko, ka = RATES[(kind, ch)]
    exact = ['-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact']
    ffmpeg('-i', wav, '-c:a', 'libopus', '-b:a', f'{ko}k', '-vbr', 'on', '-application', 'audio', *exact, base + '.ogg')
    ffmpeg('-i', wav, '-c:a', 'aac', '-b:a', f'{ka}k', '-movflags', '+faststart', *exact, base + '.m4a')


def decode(path, ch):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                       check=True, capture_output=True)
    return np.frombuffer(p.stdout, '<f4').reshape(-1, ch).T.astype(float)


def finish(x, target, loop, ceiling=-3.0, shelf_db=-6.0):
    """Clean up one sound: remove rumble, ease the deep end, trim, set loudness, guard the peak."""
    if x.ndim == 1:
        x = x[None, :]
    x = np.stack([dsp.low_shelf(dsp.filt(c, 45, 16000, order=2, circular=loop), shelf_db, circular=loop) for c in x])
    if not loop:
        x = dsp.trim(x, -52, 0.012)
        n = x.shape[1]
        x = x * dsp.ar(n, 0.0008, min(0.02, n / SR / 4))
    return dsp.normalise(x, target, ceiling)


def build_sound(items, tmp, kind, sub, sid, x, target, loop, meta):
    x = finish(x, target, loop, shelf_db=-3.0 if kind in ('music', 'sting') else -7.0)
    wav = os.path.join(tmp, sid + '.wav')
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    base = os.path.join(OUT, sub, sid)
    for _ in range(4):      # lossy codecs can overshoot: if a decoded file comes near full scale, turn it down and encode again
        write_wav(wav, x)
        encode(wav, base, kind, x.shape[0])
        pk = max(np.max(np.abs(decode(base + ext, x.shape[0]))) for ext in ('.ogg', '.m4a'))
        if pk <= SAFE_PEAK:
            break
        x = x * (SAFE_PEAK / pk) * 0.97
    entry = dict(id=sid, kind=kind,
                 files=dict(ogg=f'{sub}/{sid}.ogg', m4a=f'{sub}/{sid}.m4a'),
                 duration=round(x.shape[1] / SR, 3), samples=int(x.shape[1]), sample_rate=SR, channels=int(x.shape[0]),
                 loop=bool(loop), layer=None, bus=None, volume=1.0)
    entry.update(meta)
    entry['lufs'] = round(dsp.lufs(x), 1)
    entry['peak_db'] = round(20 * np.log10(np.max(np.abs(x))), 1)
    entry['bytes'] = dict(ogg=os.path.getsize(base + '.ogg'), m4a=os.path.getsize(base + '.m4a'))
    items.append(entry)
    return x


def shot_launch_map():
    """Which launch sound each shot uses, from content/shots.json."""
    path = os.path.join(ROOT, 'content', 'shots.json')
    out = {}
    if not os.path.exists(path):
        return out
    for s in json.load(open(path)):
        if s.get('kind') == 'child':
            continue
        fk = s.get('flight', {}).get('kind')
        if fk == 'self':
            g = None
        elif s.get('weight') == 'H':
            g = 'launch_heavy'
        elif fk == 'split':
            g = 'launch_fan'
        elif fk in ('dig', 'bounce', 'beam'):
            g = 'launch_' + fk
        elif fk == 'roller':
            g = 'launch_roll'
        elif s.get('flight', {}).get('speed_pct', 100) >= 150:
            g = 'launch_bolt'
        elif any(d.get('op') in ('mend', 'rebuild') for t in s.get('triggers', []) for d in t.get('do', [])) or 'mend' in s['id']:
            g = 'launch_glob'
        else:
            g = 'launch_lob'
        out[s['id']] = g
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['sfx', 'music', 'barks'])
    ap.add_argument('--no-qa', action='store_true')
    a = ap.parse_args()
    if shutil.which('ffmpeg') is None:
        sys.exit('ffmpeg not found')
    items, pcm = [], {}
    tmp = tempfile.mkdtemp(prefix='cp-audio-')
    prev = {}
    man_path = os.path.join(OUT, 'audio.json')
    if a.only and os.path.exists(man_path):
        prev = {s['id']: s for s in json.load(open(man_path))['sounds']}

    def want(k):
        return a.only in (None, k)

    try:
        if want('sfx'):
            for sid, s in sfx.SFX.items():
                meta = dict(bus=s['bus'], volume=s['volume'], pitch_var_semitones=s['pitch_var'],
                            trigger=dict(game=s['trigger'], anim=s['anim']))
                if s['note']:
                    meta['note'] = s['note']
                if s['gap']:
                    meta['repeat_gap_s'] = s['gap']
                pcm[sid] = build_sound(items, tmp, 'sfx', 'sfx', sid, s['fn'](dsp.rng(sid)), s['lufs'], s['loop'], meta)
            pcm['hob_cheer'] = build_sound(items, tmp, 'sfx', 'sfx', 'hob_cheer', barks.cheer(dsp.rng('hob_cheer')), -17, False, dict(
                bus='hob', pitch_var_semitones=1.0,
                trigger=dict(game='Core event win: the winning crew. Also a Bonk on the Rival side, 1 time in 3', anim='hob_<id>_<side>_cheer:jump')))
        if want('music'):
            m = dict(bus='music', pitch_var_semitones=0)
            sync = dict(group='mus_r1', bpm=music.BPM1, meter='2/4', key='G major', bars=music.R1_BARS,
                        bar_s=round(music.BAR * music.U1, 6))
            x = music.r1_base()
            pcm['mus_r1_base'] = build_sound(items, tmp, 'music', 'music', 'mus_r1_base', x, -23, True, dict(
                m, layer='base', sync=sync, trigger=dict(game='Always in a Region 1 battle. Start all three layers at once, mute Stir and Peril', anim=None)))
            x = music.r1_stir().mean(axis=0)
            pcm['mus_r1_stir'] = build_sound(items, tmp, 'music', 'music', 'mus_r1_stir', x, -22, True, dict(
                m, layer='stir', sync=sync, trigger=dict(
                    game='Fade in on a bar line when a Heartkettle is at 50% or less, a side has 2 Hobs or fewer, or the Squall is within 3 rounds (core event squall_warning)', anim=None)))
            x = music.r1_peril().mean(axis=0)
            pcm['mus_r1_peril'] = build_sound(items, tmp, 'music', 'music', 'mus_r1_peril', x, -25, True, dict(
                m, layer='peril', sync=sync, trigger=dict(
                    game='Fade in on a bar line when a side is on its last Hob, a Heartkettle is at 25% or less, or the Squall has started (core event squall_round)', anim=None)))
            pcm['mus_map'] = build_sound(items, tmp, 'music', 'music', 'mus_map', music.map_theme(), -21, True, dict(
                m, sync=dict(group='mus_map', bpm=music.BPMM, meter='6/8', key='G major', bars=music.M_BARS, bar_s=round(music.MBAR * music.UM, 6)),
                trigger=dict(game='Map, menus, pre-battle screen. Plays quietly after a loss', anim=None)))
            pcm['mus_title_jingle'] = build_sound(items, tmp, 'sting', 'music', 'mus_title_jingle', music.title_jingle(), -17, False, dict(
                m, trigger=dict(game='Once, on the Play tap of the First Run card (no sound before that tap)', anim=None)))
            pcm['sting_win'] = build_sound(items, tmp, 'sting', 'music', 'sting_win', music.sting_win(), -16, False, dict(
                m, trigger=dict(game='Core event win, the player won. Stop the layers on the next beat, then play', anim='hob_<id>_<side>_cheer:jump')))
            pcm['sting_lose'] = build_sound(items, tmp, 'sting', 'music', 'sting_lose', music.sting_lose(), -18, False, dict(
                m, trigger=dict(game='Core event win, the player lost. Then the map theme, quietly', anim=None)))
        if want('barks'):
            for hob in barks.VOICES:
                for ev in barks.E0:
                    sid = f'bark_{hob}_{ev}'
                    info = barks.EVENT_INFO[ev]
                    pcm[sid] = build_sound(items, tmp, 'bark', 'barks', sid, barks.bark(hob, ev), -18, False, dict(
                        bus='voice', pitch_var_semitones=1.0, hob=hob, event=ev,
                        trigger=dict(game=info['trigger'], anim=info['anim'].replace('<id>', hob))))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if a.only:      # keep the other kinds from the last full build
        new = {s['id'] for s in items}
        items = [s for s in prev.values() if s['id'] not in new] + items
    order = {'music': 0, 'sting': 1, 'sfx': 2, 'bark': 3}
    items.sort(key=lambda s: (order[s['kind']], s['id']))

    total = {k: sum(s['bytes'][k] for s in items) for k in ('ogg', 'm4a')}
    manifest = dict(
        version=1,
        about='Castle Protect v0.1 audio. Made by tools/audio-gen/build.py. Do not edit by hand. See assets/audio/README.md',
        fields=dict(
            files='Paths from assets/audio. ogg is Opus (web, Android). m4a is AAC (iOS, old Safari)',
            duration='Seconds. samples and sample_rate give the exact length: loop over samples 0 to samples, and trim any padding the decoder adds',
            loop='true: loops with no seam. repeat_gap_s, if set: wait that long between plays',
            layer='Music layer: base, stir or peril. Layers with the same sync.group are the same length and must start on the same sample',
            volume='Play gain 0 to 1, before the bus sliders. The files are already set to their mix level',
            bus='Mix bus. See buses',
            pitch_var_semitones='Shift each play at random by up to this much, up or down',
            trigger='game: the core event (core/API.md) or UI moment that plays it. anim: the animation event in assets/animations.json as name:event; the sound starts on that frame',
            lufs_peak='Loudness and peak of the source before encoding'),
        mix=dict(target_lufs=-16, peak_ceiling_db=-1, buses=BUSES,
                 rules=['Music sits 8 dB under the loudest impact',
                        'An impact ducks music 6 dB (30 ms attack, 400 ms release). hit_blast_tiny does not duck',
                        'A bark ducks music 3 dB and world loops 4 dB',
                        'At most 16 voices, 3 of one sound within 50 ms',
                        'One bark per side per turn step, 1.5 s between barks',
                        'No sound before the Play tap on first launch']),
        music_layers=dict(base='Always in battle', stir='Kettle at 50% or less, or 2 Hobs or fewer on a side, or Squall within 3 rounds',
                          peril='Last Hob, or kettle at 25% or less, or Sudden Squall', fade='On bar lines, over one bar'),
        shot_launch=shot_launch_map(),
        material_sounds={m: dict(hit=f'mat_{m}_hit', brk=(f'mat_{m}_break' if m != 'footing' else None)) for m in ('wicker', 'timber', 'cobble', 'footing')},
        blast_sounds={b: f'hit_blast_{b}' for b in ('tiny', 'small', 'medium', 'large', 'huge')},
        totals=dict(sounds=len(items), ogg_bytes=total['ogg'], m4a_bytes=total['m4a'], all_bytes=total['ogg'] + total['m4a'],
                    budget_bytes=BUDGET_BYTES, seconds=round(sum(s['duration'] for s in items), 1)),
        sounds=items)
    with open(man_path, 'w') as f:
        f.write(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')

    bk = dict(version=1,
              about='Hob-speak barks and their subtitles. Made by tools/audio-gen/build.py. The sound is gibberish; the subtitle is the line. Pick a subtitle at random with no repeats',
              rules=dict(gap_s=1.5, per_side_per_turn_step=1, subtitle_show_s='1.5 + 0.06 per letter, at least 2'),
              events={ev: barks.EVENT_INFO[ev] for ev in barks.E0}, hobs={})
    for hob in barks.VOICES:
        cls, voice = barks.VOICE_NOTES[hob]
        bk['hobs'][hob] = dict(**{'class': cls}, voice=voice, barks={
            ev: dict(sound=f'bark_{hob}_{ev}', hob_speak=' '.join(barks.BARKS[hob][ev][0]), subtitles=barks.SUBS[hob][ev]) for ev in barks.E0})
    with open(os.path.join(OUT, 'barks.json'), 'w') as f:
        f.write(json.dumps(bk, indent=1, ensure_ascii=False) + '\n')

    mb = (total['ogg'] + total['m4a']) / 1048576
    print(f"{len(items)} sounds. ogg {total['ogg'] / 1048576:.2f} MB, m4a {total['m4a'] / 1048576:.2f} MB, both {mb:.2f} MB of 8 MB")
    if total['ogg'] + total['m4a'] > BUDGET_BYTES:
        sys.exit('Over the 8 MB budget')
    if not a.no_qa:
        import qa
        bad = qa.run(items, OUT, os.path.join(HERE, 'qa'), decode)
        if bad:
            sys.exit(f'{bad} check(s) failed. See tools/audio-gen/qa/report.txt')


if __name__ == '__main__':
    main()
