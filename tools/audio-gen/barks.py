"""Hob-speak: made-up syllables from a small formant voice. No real words, no recordings.

Each bark is a list of syllables from the 07 sound set (bo, bim, wub, nok, pip,
ha, oof, mum, tat, hoo, gla, fen) with a pitch step per syllable. The pitch
curve carries the meaning: up for cheer, down for groan (07 section 9.4).
Each Hob has its own pitch, mouth size, breath and grit, so you can tell
them apart by ear. Subtitles are plain English lines in each Hob's voice.
"""
import numpy as np
from dsp import SR, TAU, n_of, db, curve, smooth, white, filt, tv_filter, mix, ar, verb, rng

VOWELS = {   # F1, F2, F3 for a grown voice; scaled per Hob
    'a': (730, 1150, 2500), 'o': (520, 880, 2450), 'i': (300, 2200, 2950),
    'u': (330, 870, 2300), 'e': (530, 1800, 2500), 'y': (640, 1250, 2400),
}
# consonant: kind, burst band (lo, hi), F2 start for the glide into the vowel
CONS = {
    'b': ('stop', (300, 1500), 900, True), 'p': ('stop', (500, 2500), 900, False),
    't': ('stop', (2500, 6000), 1750, False), 'd': ('stop', (2000, 5000), 1750, True),
    'k': ('stop', (1300, 3200), 2200, False), 'g': ('stop', (1000, 2600), 2200, True),
    'm': ('nasal', None, 950, True), 'n': ('nasal', None, 1650, True),
    'w': ('glide', None, 700, True), 'l': ('glide', None, 1350, True),
    'h': ('breath', None, None, False), 'f': ('fric', (3500, 8000), None, False),
}

VOICES = {
    # f0 Hz, mouth scale, breath, grit, vibrato depth and rate, speed, tilt (higher = duller), top cut Hz, nasal
    'marge':   dict(f0=185, scale=1.12, breath=0.05, grit=0.00, vib=0.012, vrate=5.0, speed=1.15, tilt=1.25, cut=5500, nasal=0.1),
    'thumper': dict(f0=118, scale=1.02, breath=0.08, grit=0.45, vib=0.030, vrate=7.5, speed=1.20, tilt=1.10, cut=4200, nasal=0.2),
    'quill':   dict(f0=335, scale=1.32, breath=0.03, grit=0.00, vib=0.004, vrate=6.0, speed=0.72, tilt=0.95, cut=7000, nasal=0.0),
    'jax':     dict(f0=215, scale=1.18, breath=0.04, grit=0.10, vib=0.010, vrate=6.0, speed=0.70, tilt=0.90, cut=6500, nasal=0.1),
    'nan':     dict(f0=300, scale=1.36, breath=0.03, grit=0.15, vib=0.035, vrate=8.0, speed=0.74, tilt=0.95, cut=6500, nasal=0.5),
    'grub':    dict(f0=98,  scale=0.96, breath=0.10, grit=0.60, vib=0.006, vrate=4.0, speed=1.05, tilt=1.70, cut=1900, nasal=0.4),
    'bobbin':  dict(f0=255, scale=1.24, breath=0.04, grit=0.00, vib=0.015, vrate=5.5, speed=0.90, tilt=1.05, cut=6500, nasal=0.0),
    'hetty':   dict(f0=222, scale=1.16, breath=0.03, grit=0.00, vib=0.008, vrate=5.0, speed=1.00, tilt=1.20, cut=5200, nasal=0.6),
}


def parse(syl):
    """'gla' -> onset ['g','l'], vowel 'a', coda []. 'oo' reads as u, 'uh' as y."""
    s = syl.replace('oo', 'u').replace('uh', 'y')
    onset, coda, vowel = [], [], None
    for ch in s:
        if ch in VOWELS and vowel is None:
            vowel = ch
        elif ch in VOWELS:
            vowel = ch
        elif vowel is None:
            onset.append(ch)
        else:
            coda.append(ch)
    return onset, vowel or 'y', coda


def speak(hob, syls, steps, lens, r, shape='flat', gain=None, v=None):
    """Build one bark.

    syls: syllable strings. steps: semitones from the Hob's base pitch, one per
    syllable. lens: vowel length in seconds, one per syllable.
    shape: how pitch moves inside a syllable: flat, up, down, wobble.
    """
    v = dict(v or VOICES[hob])
    sp = v['speed']
    segs = []     # (kind, dur, f0 mult start, f0 mult end, F start, F end, voiced amp, noise amp, noise band)
    for i, syl in enumerate(syls):
        onset, vow, coda = parse(syl)
        F = np.array(VOWELS[vow], float) * v['scale']
        st = 2 ** (steps[i] / 12)
        d = lens[i] * sp
        g = gain[i] if gain else 1.0
        cur = F.copy()
        for c in onset:
            kind, band, f2, voiced = CONS[c]
            if kind == 'stop':
                segs.append(('sil', 0.028 * sp, st, st, cur, cur, 0.12 if voiced else 0.0, 0.0, None))
                segs.append(('burst', 0.014, st, st, cur, cur, 0.3 if voiced else 0.0, 0.9 * g, band))
                cur = np.array([F[0] * 0.55, f2 * v['scale'], F[2]])
                if not voiced:
                    segs.append(('asp', 0.022, st, st, cur, F, 0.0, 0.35 * g, None))
            elif kind == 'nasal':
                nf = np.array([270, f2, 2400]) * v['scale']
                segs.append(('nasal', 0.065 * sp, st * 0.97, st, nf, nf, 0.45 * g, 0.0, None))
                cur = np.array([F[0] * 0.6, f2 * v['scale'], F[2]])
            elif kind == 'glide':
                gf = np.array([330, f2, 2400]) * v['scale']
                segs.append(('vow', 0.055 * sp, st * 0.97, st, gf, gf, 0.6 * g, 0.0, None))
                cur = gf
            elif kind == 'breath':
                segs.append(('asp', 0.06 * sp, st, st, F, F, 0.0, 0.5 * g, None))
                cur = F
        if shape == 'up':
            a, b = st * 0.94, st * 1.08
        elif shape == 'down':
            a, b = st * 1.05, st * 0.86
        else:
            a, b = st, st * 0.985
        tr = min(0.045 * sp, d * 0.4)
        segs.append(('vow', tr, a, a, cur, F, 1.0 * g, 0.0, None))
        segs.append(('vow', d - tr, a, b, F, F, 1.0 * g, 0.0, None))
        for c in coda:
            kind, band, f2, voiced = CONS[c]
            if kind == 'stop':
                end = np.array([F[0] * 0.6, f2 * v['scale'], F[2]])
                segs.append(('vow', 0.03, b, b, F, end, 0.5 * g, 0.0, None))
                segs.append(('sil', 0.03 * sp, b, b, end, end, 0.0, 0.0, None))
                segs.append(('burst', 0.016, b, b, end, end, 0.0, 0.55 * g, band))
            elif kind == 'nasal':
                nf = np.array([270, f2, 2400]) * v['scale']
                segs.append(('nasal', 0.085 * sp, b, b * 0.97, nf, nf, 0.45 * g, 0.0, None))
            elif kind == 'fric':
                segs.append(('fric', 0.09 * sp, b, b, F, F, 0.0, 0.4 * g, band))
        segs.append(('sil', 0.012, b, b, F, F, 0.0, 0.0, None))

    total = sum(s[1] for s in segs)
    n = n_of(total)
    f0 = np.zeros(n)
    Ft = np.zeros((3, n))
    va = np.zeros(n)
    na = np.zeros(n)
    nb_lo = np.zeros(n)
    nb_hi = np.full(n, 20000.0)
    nasal = np.zeros(n)
    pos = 0
    for kind, d, m0, m1, Fa, Fb, a_v, a_n, band in segs:
        k = min(n - pos, n_of(d))
        if k <= 0:
            continue
        x = np.linspace(0, 1, k)
        f0[pos:pos + k] = v['f0'] * (m0 + (m1 - m0) * x)
        for j in range(3):
            Ft[j, pos:pos + k] = Fa[j] + (Fb[j] - Fa[j]) * x
        va[pos:pos + k] = a_v
        na[pos:pos + k] = a_n
        if band:
            nb_lo[pos:pos + k], nb_hi[pos:pos + k] = band
        if kind == 'nasal':
            nasal[pos:pos + k] = 1
        pos += k
    f0[pos:] = f0[pos - 1]
    f0 = smooth(f0, 28)
    va = smooth(va, 14)
    na = smooth(na, 5)
    nasal = smooth(nasal, 20)
    Ft = np.stack([smooth(c, 18) for c in Ft])

    t = np.arange(n) / SR
    wob = np.sin(TAU * v['vrate'] * t + r.uniform(0, TAU))
    drift = smooth(r.standard_normal(n), 60) * 12
    f0 = f0 * (1 + v['vib'] * wob + 0.01 * drift)
    if shape == 'wobble':
        f0 *= 1 + 0.05 * np.sin(TAU * 4.2 * t) * np.linspace(0.3, 1, n)
    ph = TAU * np.cumsum(f0) / SR

    # voiced part: harmonics shaped by the three formants
    K = int(min(v['cut'] * 1.3, 9000) / np.min(f0))
    k = np.arange(1, K + 1)[:, None]
    fk = k * f0[None, :]
    bw = np.array([90, 120, 170])[:, None, None] * v['scale']
    amp = np.zeros_like(fk)
    for j, w in enumerate((1.0, 0.7, 0.35)):
        amp += w / np.sqrt(1 + ((fk - Ft[j][None, :]) / (bw[j] / 2 * 2.2)) ** 2)
    amp += v['nasal'] * 0.5 / np.sqrt(1 + ((fk - 260 * v['scale']) / 90) ** 2)
    amp *= (1 - 0.6 * nasal[None, :] * (fk > 600))
    amp *= k ** (-v['tilt'] * 0.55) / np.sqrt(1 + (fk / v['cut']) ** 6)
    amp *= fk < SR * 0.45
    voiced = (amp * np.sin(k * ph[None, :])).sum(axis=0)
    if v['grit']:      # gravel: every other pulse is weaker, with a little shake
        sub = 0.5 + 0.5 * np.sin(ph / 2)
        voiced *= 1 - v['grit'] * (0.6 * sub + 0.4 * np.abs(smooth(r.standard_normal(n), 3)))
    voiced *= va

    # breath and consonant noise, shaped by the same mouth
    wn = white(n, r)
    hop_t = t[::256]

    def mouth(fq, tm):
        g = np.zeros((tm.shape[0], fq.shape[1]))
        for j, w in enumerate((1.0, 0.8, 0.6)):
            fc = np.interp(tm, hop_t, Ft[j][::256])
            g += w / np.sqrt(1 + ((fq - fc) / (140 * v['scale'])) ** 2)
        lo = np.interp(tm, hop_t, nb_lo[::256])
        hi = np.interp(tm, hop_t, nb_hi[::256])
        banded = (fq > lo) & (fq < hi)
        use_band = lo > 0
        return np.where(use_band, banded * 1.0, g) / np.sqrt(1 + (fq / (v['cut'] * 1.4)) ** 4)
    nz = tv_filter(wn, mouth, 512)
    out = voiced * 0.12 + nz * (na * 0.22 + va * v['breath'] * 0.5)
    out = filt(out, 90, None)
    return out * ar(n, 0.004, 0.02)


# ---- the bark sheet: event -> (syllables, pitch steps, vowel lengths, shape, per-syllable gain) ----
E0 = ('picked', 'fire', 'hit_lands', 'takes_hit', 'bonked', 'win')

BARKS = {
    'marge': {
        'picked':    (['bo', 'mum'], [0, 3], [0.13, 0.16], 'flat'),
        'fire':      (['hoop'], [5], [0.14], 'up'),
        'hit_lands': (['wub', 'bo'], [2, 7], [0.11, 0.22], 'up'),
        'takes_hit': (['oof'], [1], [0.2], 'down'),
        'bonked':    (['mum', 'hoo'], [0, -5], [0.2, 0.34], 'down'),
        'win':       (['bo', 'bim', 'bo'], [0, 4, 7], [0.11, 0.11, 0.28], 'up'),
    },
    'thumper': {
        'picked':    (['hem'], [0], [0.22], 'up'),
        'fire':      (['hup'], [4], [0.12], 'flat'),
        'hit_lands': (['ha', 'nok'], [3, 0], [0.12, 0.14], 'flat'),
        'takes_hit': (['oof', 'wub'], [2, -3], [0.14, 0.16], 'down'),
        'bonked':    (['hoo', 'mum'], [-2, -7], [0.26, 0.3], 'down'),
        'win':       (['ha', 'ha', 'nok'], [0, 2, 5], [0.1, 0.1, 0.2], 'flat'),
    },
    'quill': {
        'picked':    (['pip'], [0], [0.09], 'flat'),
        'fire':      (['tat'], [4], [0.07], 'flat'),
        'hit_lands': (['pip', 'pip'], [3, 7], [0.07, 0.1], 'flat'),
        'takes_hit': (['tik'], [6], [0.1], 'down'),
        'bonked':    (['pip', 'fen'], [2, -4], [0.1, 0.3], 'down'),
        'win':       (['tat', 'pip', 'bim'], [0, 4, 9], [0.07, 0.07, 0.2], 'up'),
    },
    'jax': {
        'picked':    (['ta', 'ta', 'tat'], [0, 0, 4], [0.05, 0.05, 0.12], 'flat'),
        'fire':      (['ha', 'tat'], [5, 7], [0.06, 0.09], 'flat'),
        'hit_lands': (['bo', 'bo', 'bim'], [2, 4, 9], [0.06, 0.06, 0.16], 'up'),
        'takes_hit': (['ha', 'ha', 'oof'], [7, 5, 0], [0.05, 0.05, 0.14], 'down'),
        'bonked':    (['wub', 'wub', 'hoo'], [0, -2, -7], [0.09, 0.09, 0.3], 'down'),
        'win':       (['ta', 'ta', 'gla', 'bim'], [0, 2, 5, 9], [0.05, 0.05, 0.1, 0.24], 'up'),
    },
    'nan': {
        'picked':    (['nok', 'nok'], [0, 2], [0.07, 0.1], 'flat'),
        'fire':      (['tat', 'tat'], [5, 5], [0.05, 0.07], 'flat'),
        'hit_lands': (['ha', 'nok'], [7, 2], [0.1, 0.1], 'flat'),
        'takes_hit': (['pip', 'pip', 'tat'], [8, 6, 3], [0.05, 0.05, 0.1], 'down'),
        'bonked':    (['fen', 'hoo'], [1, -5], [0.14, 0.32], 'wobble'),
        'win':       (['nok', 'nok', 'ha'], [2, 5, 9], [0.07, 0.07, 0.22], 'up'),
    },
    'grub': {
        'picked':    (['mum'], [0], [0.2], 'flat'),
        'fire':      (['wub'], [3], [0.13], 'flat'),
        'hit_lands': (['hem', 'nok'], [2, 0], [0.13, 0.13], 'flat'),
        'takes_hit': (['mumf'], [1], [0.18], 'down'),
        'bonked':    (['mum', 'mum'], [-1, -6], [0.22, 0.32], 'down'),
        'win':       (['hem', 'hem', 'mum'], [0, 2, 4], [0.11, 0.11, 0.24], 'flat'),
    },
    'bobbin': {
        'picked':    (['bo', 'ing'], [0, 7], [0.09, 0.16], 'up'),
        'fire':      (['hoop', 'la'], [4, 9], [0.08, 0.12], 'up'),
        'hit_lands': (['bim', 'bo', 'bim'], [2, 5, 9], [0.08, 0.08, 0.16], 'up'),
        'takes_hit': (['wub', 'oof'], [7, 0], [0.09, 0.15], 'down'),
        'bonked':    (['bo', 'bo', 'hoo'], [5, 0, -5], [0.12, 0.14, 0.3], 'down'),
        'win':       (['gla', 'bim', 'bo', 'bim'], [0, 4, 7, 12], [0.09, 0.09, 0.09, 0.24], 'up'),
    },
    'hetty': {
        'picked':    (['mum', 'tat'], [0, 2], [0.14, 0.09], 'flat'),
        'fire':      (['nok'], [4], [0.11], 'flat'),
        'hit_lands': (['mum', 'bim'], [0, 5], [0.12, 0.18], 'up'),
        'takes_hit': (['hem', 'tat'], [4, 0], [0.12, 0.09], 'down'),
        'bonked':    (['hoo', 'mum'], [0, -5], [0.22, 0.34], 'down'),
        'win':       (['mum', 'gla', 'fen'], [0, 4, 7], [0.13, 0.12, 0.26], 'up'),
    },
}

# Subtitles: at least 3 lines per event, picked without repeats (07 section 9.4).
# First lines come from the crew doc (03 section 3) where it gives one.
SUBS = {
    'marge': {
        'picked':    ["Kettle's on.", "Ready, love.", "Apron on."],
        'fire':      ["In the oven it goes.", "Mind the crust!", "Hot pot coming."],
        'hit_lands': ["That rose nicely.", "Done to a turn.", "Golden brown."],
        'takes_hit': ["Oof. My good apron.", "Oh, my hat!", "Who slammed the door?"],
        'bonked':    ["Save me a slice...", "Just a little nap...", "Night night..."],
        'win':       ["Pudding for all!", "Lumpy forever!", "Seconds, anyone?"],
    },
    'thumper': {
        'picked':    ["Eh? Speak up!", "Me? Fine.", "Hmph. Go on, then."],
        'fire':      ["Back in my day we threw harder.", "Hup!", "Mind out."],
        'hit_lands': ["Hmph. Not bad.", "Still got it.", "Hear that? I did."],
        'takes_hit': ["I felt that in my knees.", "My whiskers!", "Right. Now I'm cross."],
        'bonked':    ["Wake me for tea...", "Forty winks...", "Bah. Night..."],
        'win':       ["Told you. The old way.", "Hmph. Good.", "Lumpy forever. Eh?"],
    },
    'quill': {
        'picked':    ["Measure twice.", "Ready. Exactly.", "Pins in."],
        'fire':      ["Hold still, please.", "One stitch.", "Straight line."],
        'hit_lands': ["Neat.", "Threaded.", "On the mark."],
        'takes_hit': ["Tsk. A tear.", "My pins!", "Crooked!"],
        'bonked':    ["Oh. A loose thread...", "Hem me in...", "Unpicked..."],
        'win':       ["Neat and tidy. Our tidy.", "Not a stitch out.", "Lumpy, but exact."],
    },
    'jax': {
        'picked':    ["Step right up!", "Roll up, roll up!", "Show time!"],
        'fire':      ["A little spice!", "Fresh ground!", "One for the crowd!"],
        'hit_lands': ["Sold!", "And the crowd goes wild!", "Who wants more?"],
        'takes_hit': ["Achoo! Who threw that?", "No refunds!", "Mind the stall!"],
        'bonked':    ["Stall's shut...", "Back after lunch...", "Sold... out..."],
        'win':       ["Sold! Sold! Sold!", "Best show in Brickabrac!", "Encore!"],
    },
    'nan': {
        'picked':    ["Eat up, dear.", "Coming, dear.", "Ladle's ready."],
        'fire':      ["Wash these after!", "Catch, dear.", "Mind the pans."],
        'hit_lands': ["Told you so.", "Dinner bell! Get them, dears!", "That'll teach them."],
        'takes_hit': ["Mind my pots!", "Rude, dear.", "My best pan!"],
        'bonked':    ["Wake me for supper...", "Nan needs a sit...", "Lids on, dears..."],
        'win':       ["Told you so, dears.", "Now wash up!", "Supper's on me."],
    },
    'grub': {
        'picked':    ["Mm.", "Mm. Digging.", "Heh."],
        'fire':      ["Down we go.", "Mm. Dig.", "Hole."],
        'hit_lands': ["Heh. Hole.", "Mm. Good.", "Got one."],
        'takes_hit': ["Mmf.", "Mm. Ow.", "My hat."],
        'bonked':    ["Mm. Nap.", "Dark. Nice...", "Mmm..."],
        'win':       ["Mm. Behind me.", "Heh. Heh.", "Good hole."],
    },
    'bobbin': {
        'picked':    ["Best foot forward!", "Laces tied!", "Hop to it!"],
        'fire':      ["Boing!", "Off the toe!", "Up and over!"],
        'hit_lands': ["Right in the laces.", "Heel and toe!", "Bounced it!"],
        'takes_hit': ["Mind the boots!", "Whoops-a-daisy!", "My laces!"],
        'bonked':    ["Feet up...", "Just resting my soles...", "Boing... zzz..."],
        'win':       ["Sole survivor!", "Three cheers and a hop!", "Lumpy forever!"],
    },
    'hetty': {
        'picked':    ["Sit up straight.", "Ready. Pay attention.", "Trowel out."],
        'fire':      ["Do it again, properly.", "Watch and learn.", "Eyes front."],
        'hit_lands': ["Full marks.", "Gold star.", "That is how it is done."],
        'takes_hit': ["Who did that?", "See me after.", "Mind the mortar!"],
        'bonked':    ["Class dismissed...", "Mark my place...", "Nobody moves..."],
        'win':       ["Full marks, everyone.", "Top of the class!", "The roof stays."],
    },
}

EVENT_INFO = {
    'picked':    dict(trigger='Command pick_hob, your Hob', anim='hob_<id>_<side>_aim (start)', chance=0.4),
    'fire':      dict(trigger='Core event fire, the shooter', anim='hob_<id>_<side>_fire:release', chance=0.4),
    'hit_lands': dict(trigger='Core event hit, target hob: the shooter barks', anim='hob_<id>_<side>_cheer:jump', chance=0.4),
    'takes_hit': dict(trigger='Core event hit, target hob: the target barks. Also drop (Tumbled)', anim='hob_<id>_<side>_hit:flash', chance=0.4),
    'bonked':    dict(trigger='Core event bonk, the target', anim='hob_<id>_<side>_bonked (frame 0)', chance=1.0),
    'win':       dict(trigger='Core event win, the winning crew', anim='hob_<id>_<side>_cheer:jump', chance=1.0),
}

VOICE_NOTES = {
    'marge': ('lobber', 'Low, round, slow. Warm cook.'),
    'thumper': ('lobber', 'Lowest of the Lobbers, creaky and shaky. Grumpy grandad.'),
    'quill': ('zinger', 'High, clipped, quick. Fussy and exact.'),
    'jax': ('scatterjack', 'Fast, bright, stutters. Market showman.'),
    'nan': ('scatterjack', 'High, thin, quavery, a bit nasal. Sharp granny.'),
    'grub': ('delver', 'Very low, muffled, gravelly mumble.'),
    'bobbin': ('boinker', 'Sing-song, always rising. Bouncy cobbler.'),
    'hetty': ('patcher', 'Warm hum in the nose, steady. Bossy teacher.'),
}


def bark(hob, event):
    syls, steps, lens, shape = BARKS[hob][event]
    r = rng(f'bark_{hob}_{event}')
    x = speak(hob, syls, steps, lens, r, shape)
    if len(x) > 0.74 * SR:      # 07 asks for 0.3 to 0.9 s: squeeze the vowels of long barks
        k = (0.74 * SR / len(x)) ** 1.3
        x = speak(hob, syls, steps, [d * k for d in lens], rng(f'bark_{hob}_{event}'), shape)
    return verb(x, r, 0.06, 0.12, 0.035, 4000)


def cheer(r):
    """Crowd cheer: all eight Hobs call out a rising 'hoo ha' a little out of step."""
    parts = []
    for i, hob in enumerate(VOICES):
        v = dict(VOICES[hob])
        v['speed'] = 1.0
        x = speak(hob, ['hoo', 'ha'], [2, 7 + (i % 3)], [0.16, 0.38], rng('cheer' + hob), 'up', v=v)
        parts.append((x, 0.02 + 0.035 * ((i * 3) % 8), 1.0))
    return verb(mix(*parts), r, 0.2, 0.5, 0.15, 4500)
