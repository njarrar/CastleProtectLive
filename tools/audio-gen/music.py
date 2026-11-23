"""Music for Castle Protect v0.1, all synthesised. See docs/design/07 section 9.2.

- Region 1, Puddingstone Downs: 108 bpm, bouncy 2/4, G major. 64 bars = 71.1 s.
  Three stems, same length to the sample, that loop in sync: Base, Stir, Peril.
- Brickabrac Map: 92 bpm, lilting 6/8, G major. 32 bars = 41.7 s.
- Title jingle, win sting and lose sting.

All of them are built on our own four-bar tune, the Lump Tune.
Instruments are folk toys made from sine banks and noise: banjolele, tin
whistle, tuba, music box, concertina, soft horn, washboard, claps, cowbell,
hand drum. Loops wrap their own tails and their room sound, so there is no seam.
"""
import numpy as np
from dsp import (SR, TAU, n_of, db, midi, note, decay, ar, curve, osc, glide, modal, white, filt, reson,
                 noise, loop_noise, overlap_wrap, room_ir, convolve, rng, soft_clip, smooth)

R = rng('music')

# ---------------- instruments (mono, start at t = 0) ----------------
_cache = {}
_VEL_BR = (0.86, 1.0, 1.15)     # 3 discrete timbre/velocity layers: soft, neutral, accented


def cached(fn):
    def w(*a):
        key = (fn.__name__,) + a
        if key not in _cache:
            _cache[key] = fn(*a)
        return _cache[key]
    return w


@cached
def banjo(m, dur, vel=1):
    """Banjolele pluck: bright, short, a little twang."""
    f = midi(m)
    br = _VEL_BR[vel]
    r = rng(f'banjo_{m}_{dur}_{vel}')
    n = n_of(dur + 0.25)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 15):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 9000:
            break
        a = abs(np.sin(k * np.pi * 0.17)) / k ** (0.6 / br)
        out += a * np.exp(-t / (0.32 / (1 + 0.3 * k))) * np.sin(TAU * fk * t)
    out *= 1 + 0.004 * np.sin(TAU * 5 * t)
    pick = noise(0.012, r, 1500, 6000) * decay(n_of(0.012), 0.003)
    kp = min(n, len(pick))
    out[:kp] += 0.5 * br * pick[:kp]
    e = np.ones(n)
    nr = n_of(0.06)
    cut = min(n, n_of(dur) + nr)
    e[cut - nr:cut] = np.linspace(1, 0, nr)
    e[cut:] = 0
    return out * e * 0.5


@cached
def pizz(m, dur, vel=1):
    """Folk string pizzicato: warm woody pluck that cuts cleanly on phone speakers."""
    f = midi(m)
    br = _VEL_BR[vel]
    r = rng(f'pizz_{m}_{dur}_{vel}')
    n = n_of(dur + 0.18)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 11):
        fk = f * k * (1 + 0.0002 * k * k)
        if fk > 7500:
            break
        a = abs(np.sin(k * np.pi * 0.22)) / k ** (0.85 / br)
        body = 1.0 + 0.45 / np.sqrt(1 + ((fk - 720) / 380) ** 2)
        out += a * body * np.exp(-t / (0.28 / (1 + 0.28 * k))) * np.sin(TAU * fk * t)
    pluck = noise(0.009, r, 950, 4200) * decay(n_of(0.009), 0.0025)
    kp = min(n, len(pluck))
    out[:kp] += 0.38 * br * pluck[:kp]
    return out * ar(n, 0.002, min(0.055, dur * 0.4)) * 0.52


@cached
def pbass(m, dur, vel=1):
    """Plucked bass: round, with enough upper harmonics for a phone speaker."""
    f = midi(m)
    br = _VEL_BR[vel]
    n = n_of(dur + 0.1)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 10):
        a = abs(np.sin(k * np.pi * 0.25)) / k ** 0.9 + (0.25 * br if k in (2, 3, 4) else 0)
        out += a * np.exp(-t / (0.6 / (1 + 0.25 * k))) * np.sin(TAU * f * k * t)
    return out * ar(n, 0.003, 0.08) * 0.6


@cached
def tuba(m, dur, vel=1):
    """Toy tuba: soft puffed 'oom'."""
    f = midi(m)
    br = _VEL_BR[vel]
    r = rng(f'tuba_{m}_{dur}_{vel}')
    n = n_of(dur)
    t = np.arange(n) / SR
    fr = f * (1 - 0.02 * np.exp(-t / 0.03))
    ph = TAU * np.cumsum(fr) / SR
    env = ar(n, 0.035, min(0.09, dur * 0.4)) * (0.8 + 0.2 * np.exp(-t / 0.15))
    out = np.zeros(n)
    for k in range(1, 13):
        fk = f * k
        form = 1 / np.sqrt(1 + ((fk - 330) / 260) ** 2) + 0.25 * br
        out += form / k ** 0.7 * env ** (1 + 0.12 * k) * np.sin(k * ph)
    puff = noise(0.05, r, 200, 1200) * decay(n_of(0.05), 0.012)
    out[:min(n, len(puff))] += 0.25 * br * puff[:min(n, len(puff))]
    return out * 0.45


@cached
def whistle(m, dur, vel=1):
    """Tin whistle: nearly pure, breathy, with a chiff."""
    f = midi(m)
    br = _VEL_BR[vel]
    r = rng(f'whistle_{m}_{dur}_{vel}')
    n = n_of(dur)
    t = np.arange(n) / SR
    vph = r.uniform(0, TAU)
    vib = 1 + 0.006 * np.sin(TAU * 5.3 * t + vph) * np.clip((t - 0.12) / 0.15, 0, 1)
    fr = f * vib * (1 + 0.015 * np.exp(-t / 0.012))
    env = ar(n, 0.022, min(0.05, dur * 0.3))
    tone = osc(fr, harm=(1, 0.14 * br, 0.06 * br, 0.02 * br)) * env
    breath = reson(white(n, r), f, 9) * 3 * env + noise(dur, r, 3000, 9000) * env * 0.04 * br
    chiff = noise(0.03, r, 2000, 8000) * decay(n_of(0.03), 0.006)
    out = tone * 0.5 + breath * 0.07
    out[:min(n, len(chiff))] += 0.1 * br * chiff[:min(n, len(chiff))]
    return out


@cached
def mbox(m, dur, vel=1):
    """Music box tine."""
    f = midi(m)
    br = _VEL_BR[vel]
    r = rng(f'mbox_{m}_{dur}_{vel}')
    d = max(dur, 0.25) + 0.5
    x = modal([(f, 1, 0.5), (f * 2.0, 0.12 * br, 0.25), (f * 5.4, 0.3 * br, 0.05), (f * 8.9, 0.12 * br, 0.02)], d, r)
    return x * ar(len(x), 0.001, 0.1) * 0.45


@cached
def tina(m, dur, vel=1):
    """Concertina: two reeds a hair apart."""
    f = midi(m)
    br = _VEL_BR[vel]
    n = n_of(dur)
    t = np.arange(n) / SR
    env = ar(n, 0.05, min(0.1, dur * 0.4)) * (1 + 0.05 * np.sin(TAU * 5 * t))
    harm = tuple((1.0 if k % 2 else 0.55) / k ** (1.1 / br) for k in range(1, 12))
    a = osc(np.full(n, f * 1.0025), harm=harm)
    b = osc(np.full(n, f * 0.9975), harm=harm, phase0=1.0)
    return filt((a + b) * env, 150, 4500) * 0.22


@cached
def horn(m, dur, vel=1):
    """Soft toy brass: gets brighter as it gets louder."""
    f = midi(m)
    br = _VEL_BR[vel]
    n = n_of(dur)
    t = np.arange(n) / SR
    fr = f * (1 - 0.012 * np.exp(-t / 0.025)) * (1 + 0.004 * np.sin(TAU * 5 * t) * np.clip(t / 0.3, 0, 1))
    ph = TAU * np.cumsum(fr) / SR
    env = ar(n, 0.03, min(0.08, dur * 0.4)) * (0.75 + 0.25 * np.exp(-t / 0.2))
    out = np.zeros(n)
    for k in range(1, 11):
        if f * k > 6000:
            break
        out += env ** (1 + 0.35 * k / br) / k ** 0.5 * np.sin(k * ph)
    return out * 0.3


def _perc(var=0):
    r = rng(f'perc_{var}')
    det = (0.985, 1.0, 1.015)[var]
    p = {}
    n = n_of(0.07)
    t = np.arange(n) / SR
    p['wash'] = noise(0.07, r, 2500, 8000) * decay(n, 0.014) * ar(n, 0.002, 0.008) * (0.6 + 0.4 * np.sin(TAU * 95 * det * t) ** 2) * 0.5
    n = n_of(0.13)
    t = np.arange(n) / SR
    p['wash_long'] = noise(0.13, r, 2200, 8000) * (0.5 + 0.5 * np.sin(TAU * 70 * det * t) ** 2) * ar(n, 0.01, 0.06) * 0.45
    n = n_of(0.16)
    t = np.arange(n) / SR
    cl = np.zeros(n)
    for i, d in enumerate((0, 0.009, 0.019, 0.03)):
        e = np.exp(-np.clip(t - d, 0, None) / (0.008 if i < 3 else 0.035)) * (t >= d)
        cl += e
    p['clap'] = noise(0.16, r, 800, 2800) * cl * ar(n, 0.002, 0.015) * 0.35
    p['cowbell'] = filt(modal([(562 * det, 1, 0.07), (845 * det, 0.8, 0.06), (1124 * det, 0.3, 0.03), (1690 * det, 0.25, 0.03)], 0.2, r), 400, 6000) * ar(n_of(0.2), 0.002, 0.015) * 0.4
    p['drum_lo'] = (osc(glide(190 * det, 105 * det, n_of(0.22), 0.5), harm=(1, 0.4, 0.15)) * decay(n_of(0.22), 0.06)
                    + 0.3 * noise(0.22, r, 200, 1500) * decay(n_of(0.22), 0.012)) * ar(n_of(0.22), 0.0025, 0.02) * 0.6
    p['drum_hi'] = (osc(glide(360 * det, 290 * det, n_of(0.12), 0.5), harm=(1, 0.3)) * decay(n_of(0.12), 0.03)
                    + 0.4 * noise(0.12, r, 500, 3500) * decay(n_of(0.12), 0.008)) * ar(n_of(0.12), 0.002, 0.015) * 0.45
    p['spoon'] = modal([(1150 * det, 1, 0.012), (2420 * det, 0.6, 0.008), (3900 * det, 0.3, 0.005)], 0.05, r) * ar(n_of(0.05), 0.0015, 0.008) * 0.35
    p['snare_tick'] = (noise(0.08, r, 1100, 4800) * decay(n_of(0.08), 0.016)
                       + 0.45 * modal([(420 * det, 0.8, 0.012), (1680 * det, 0.6, 0.009)], 0.08, r)) * ar(n_of(0.08), 0.002, 0.01) * 0.42
    p['brush'] = noise(0.11, r, 1800, 6000) * ar(n_of(0.11), 0.03, 0.06) * 0.25
    return p


PERC_VARS = [_perc(v) for v in range(3)]
PERC = PERC_VARS[1]
INS = dict(banjo=banjo, pizz=pizz, pbass=pbass, tuba=tuba, whistle=whistle, mbox=mbox, tina=tina, horn=horn)

CHORDS = {   # root pitch class name, third and fifth as semitone steps
    'G': ('G', 4, 7), 'C': ('C', 4, 7), 'D': ('D', 4, 7), 'Em': ('E', 3, 7), 'Am': ('A', 3, 7),
    'Bm': ('B', 3, 7), 'A7': ('A', 4, 7), 'D7': ('D', 4, 7),
}


def chord_notes(name, low):
    """Chord tones at or above midi note low."""
    root, third, fifth = CHORDS[name]
    base = note(root + '1')
    while base < low:
        base += 12
    return base, base + third, base + fifth


class Stem:
    """One stereo layer on a unit grid (16ths or 8ths)."""

    def __init__(self, units, unit_s, loop=True, tail=1.5, seed='stem'):
        self.unit = unit_s * SR
        self.n = int(round(units * self.unit))
        self.loop = loop
        self.tail = n_of(tail)
        self.dry = np.zeros((2, self.n + self.tail + SR))
        self.send = np.zeros((2, self.n + self.tail + SR))
        self.hr = rng(seed)

    def at(self, u):
        return int(round(u * self.unit))

    def put(self, sig, u, gain=1.0, pan=0.0, wet=0.2, late=0.0):
        a = self.at(u) + n_of(late)
        if a < 0:
            sig = sig[-a:]
            a = 0
        if a >= self.dry.shape[1] or len(sig) == 0:
            return
        e = min(len(sig), self.dry.shape[1] - a)
        l = gain * np.sqrt(0.5 * (1 - pan))
        r = gain * np.sqrt(0.5 * (1 + pan))
        self.dry[0, a:a + e] += l * sig[:e]
        self.dry[1, a:a + e] += r * sig[:e]
        self.send[0, a:a + e] += wet * l * sig[:e]
        self.send[1, a:a + e] += wet * r * sig[:e]

    def _humanize(self, u, gain, late, jitter):
        vm = float(self.hr.uniform(0.90, 1.10))
        vel = 0 if vm < 0.96 else (2 if vm > 1.04 else 1)
        if jitter > 0:
            dt = float(self.hr.uniform(0.0, jitter) if (self.loop and u <= 0) else self.hr.uniform(-jitter, jitter))
        else:
            dt = 0.0
        return gain * vm, late + dt, vel

    def hit(self, name, u, gain=1.0, pan=0.0, wet=0.2, late=0.0, jitter=0.008):
        """Place a humanized percussion hit with deterministic velocity, micro-timing and variant."""
        g, lt, vel = self._humanize(u, gain, late, jitter)
        self.put(PERC_VARS[vel][name], u, g, pan, wet, lt)

    def play(self, ins, m, u, units, gain=1.0, pan=0.0, wet=0.2, late=0.0, hold=0.92, jitter=0.008):
        dur = round(units * hold * self.unit / SR, 4)
        g, lt, vel = self._humanize(u, gain, late, jitter)
        self.put(INS[ins](int(m), dur, vel), u, g, pan, wet, lt)

    def line(self, ins, text, u0, gain=1.0, pan=0.0, wet=0.2, shift=0, hold=0.92, accent=None, jitter=0.008):
        """Play 'G4:2 B4:2 r:4' from unit u0. Returns the unit after the line."""
        u = u0
        for tok in text.split():
            name, d = tok.split(':')
            d = float(d)
            if name != 'r':
                g = gain * (accent(u - u0) if accent else 1.0)
                self.play(ins, note(name) + shift, u, d, g, pan, wet, hold=hold, jitter=jitter)
            u += d
        return u

    def render(self, seed='room', xfade_s=0.08):
        r = rng(seed)
        irs = [room_ir(r, 0.9, 0.2, 4500, 0.012), room_ir(r, 0.9, 0.2, 4500, 0.017)]
        if self.loop:   # weld tails onto sample 0 via equal-power overlap_wrap + circular room
            xfade = min(n_of(xfade_s), self.n // 4, self.dry.shape[1] - self.n)
            dry = overlap_wrap(self.dry[:, :self.n + xfade], xfade)
            send = overlap_wrap(self.send[:, :self.n + xfade], xfade)
            wet = np.stack([convolve(send[i], irs[i], circular=True) for i in range(2)])
            return dry + wet
        total = self.n + self.tail
        wet = np.stack([convolve(self.send[i, :total], irs[i])[:total] for i in range(2)])
        out = self.dry[:, :total] + wet
        nr = n_of(0.3)
        out[:, -nr:] *= np.linspace(1, 0, nr)
        return out


# ---------------- Region 1: Puddingstone Downs ----------------
BPM1 = 108
U1 = 60 / BPM1 / 4          # one 16th
BAR = 8                     # 16ths in a bar of 2/4

LUMP = ["G4:2 B4:2 D5:2 B4:2", "E5:2 D5:1 C5:1 B4:2 G4:2", "A4:2 C5:2 B4:2 A4:1 G4:1", "F#4:2 A4:2 G4:4"]
SEC_A = LUMP + ["G4:2 B4:2 D5:2 G5:2", "F#5:2 E5:1 D5:1 E5:2 B4:2", "C5:2 E5:2 D5:2 C5:1 B4:1", "A4:2 F#4:2 D5:4"] \
    + LUMP + ["E5:2 C5:2 E5:2 G5:2", "D5:2 B4:2 D5:2 G5:2", "F#5:1 E5:1 D5:2 C5:2 A4:2", "G4:2 B4:1 D5:1 G5:4"]
CH_A = ['G', 'C', 'D', 'D/G', 'G', 'Em', 'Am', 'D', 'G', 'C', 'D', 'D/G', 'C', 'G', 'D7', 'G']
SEC_B = ["E5:3 F#5:1 G5:2 E5:2", "B4:4 r:2 B4:1 D5:1", "E5:2 G5:2 E5:2 C5:2", "D5:6 r:2",
         "E5:3 F#5:1 G5:2 B5:2", "A5:2 G5:2 E5:4", "C#5:2 E5:2 A5:2 G5:2", "F#5:4 D5:2 r:2",
         "E5:2 C5:2 G4:2 C5:2", "E5:2 G5:2 E5:4", "D5:2 B4:2 G4:2 B4:2", "D5:2 G5:2 D5:4",
         "C5:2 E5:2 A4:2 C5:2", "B4:2 A4:2 F#4:2 A4:2", "G4:2 B4:2 D5:2 B4:2", "A4:2 D5:2 F#5:2 A5:2"]
CH_B = ['Em', 'Em', 'C', 'G', 'Em', 'Em', 'A7', 'D', 'C', 'C', 'G', 'G', 'Am', 'D', 'G', 'D']
SEC_C = ["E5:2 G5:2 C6:2 G5:2", "D5:2 G5:2 B5:2 G5:2", "E5:2 G5:2 C6:1 B5:1 A5:2", "G5:4 D5:2 B4:2",
         "C5:2 E5:2 A5:2 E5:2", "F#5:2 A5:2 D6:2 A5:2", "B5:2 G5:2 D5:2 G5:2", "G5:4 r:4"] \
    + LUMP + ["E5:2 C5:2 E5:2 G5:2", "D5:2 B4:2 D5:2 G5:2", "F#5:1 E5:1 D5:2 C5:2 A4:2", "G4:2 B4:1 D5:1 G5:4"]
CH_C = ['C', 'G', 'C', 'G', 'Am', 'D', 'G', 'G', 'G', 'C', 'D', 'D/G', 'C', 'G', 'D7', 'G']
R1_TUNE = SEC_A + SEC_B + SEC_A + SEC_C          # 64 bars
R1_CH = CH_A + CH_B + CH_A + CH_C
R1_BARS = 64

# Base stem lead motif: playful pizzicato / whistle statements with 4-bar rests so it breathes
BASE_LEAD_A = [
    "B4:2 D5:2 G5:2 D5:2", "E5:3 D5:1 C5:2 G4:2", "A4:2 D5:2 F#5:2 D5:2", "A4:2 F#4:2 G4:4",
    None, None, None, None,
    "D5:2 B4:2 G4:2 B4:2", "C5:2 E5:2 G5:2 E5:2", "F#5:2 D5:2 A4:2 C5:2", "B4:2 A4:2 G4:4",
    None, None, None, None,
]
BASE_LEAD_B = [
    "E5:2 G5:2 B5:2 G5:2", "F#5:2 E5:2 B4:4", "C5:2 E5:2 G5:2 E5:2", "D5:2 B4:2 G4:4",
    None, None, None, None,
    "G4:2 C5:2 E5:2 C5:2", "G5:3 E5:1 C5:4", "B4:2 D5:2 G5:2 D5:2", "B4:4 G4:4",
    None, None, None, None,
]
BASE_LEAD_C = [
    "E5:2 C5:2 G5:2 E5:2", "D5:2 B4:2 G5:2 D5:2", "E5:2 G5:2 E5:2 C5:2", "D5:4 B4:4",
    None, None, None, None,
    "D5:2 B4:2 G4:2 B4:2", "C5:2 E5:2 G5:2 E5:2", "F#5:2 D5:2 A4:2 C5:2", "B4:2 A4:2 G4:4",
    None, None, None, None,
]
R1_BASE_LEAD = BASE_LEAD_A + BASE_LEAD_B + BASE_LEAD_A + BASE_LEAD_C

# Shift Peril layer toward E minor / E Dorian tension while staying consonant over Base + Stir
PERIL_CH = {'G': 'Em', 'C': 'Am', 'D': 'Bm', 'D7': 'Bm', 'Em': 'Em', 'Am': 'Am', 'A7': 'A7'}


def _halves(ch):
    return ch.split('/') if '/' in ch else [ch, ch]


def r1_base():
    s = Stem(R1_BARS * BAR, U1, seed='r1_base')
    acc = lambda u: 1.0 if u % 4 == 0 else 0.86
    for b in range(R1_BARS):
        u = b * BAR
        sec = b // 16
        h = _halves(R1_CH[b])
        for i, c in enumerate(h):          # two beats in a bar
            root, third, fifth = chord_notes(c, 43)          # G2 and up: a toy tuba, and phones can play it
            low = root if (i == 0 or h[0] != h[1]) else (fifth - 12 if fifth - 12 >= 40 else fifth)
            s.play('tuba', low, u + 4 * i, 2.6, 0.85, 0.0, 0.08)
            cr, ct, cf = chord_notes(c, 55)                  # G3 and up
            strum = [cr, ct, cf, cr + 12]
            for j, m in enumerate(strum):                    # off-beat strum, strings a few ms apart
                s.play('banjo', m, u + 4 * i + 2, 1.6, 0.33, 0.35, 0.15, late=0.007 * j, jitter=0.004)
            if sec in (1, 3) and i == 1:                     # B and C parts: a small pick-up strum
                for j, m in enumerate(strum[:3]):
                    s.play('banjo', m, u + 7, 0.8, 0.2, 0.35, 0.15, late=0.006 * j, jitter=0.004)
        # pad: soft concertina third and fifth
        cr, ct, cf = chord_notes(h[0], 55)
        if h[0] == h[1]:
            s.play('tina', ct, u, 8, 0.30, -0.3, 0.3)
            s.play('tina', cf, u, 8, 0.26, -0.3, 0.3)
        else:
            for i, c in enumerate(h):
                cr, ct, cf = chord_notes(c, 55)
                s.play('tina', ct, u + 4 * i, 4, 0.30, -0.3, 0.3)
        # playable pizzicato / whistle lead motif (4 bars on, 4 bars rest so it breathes)
        lead = R1_BASE_LEAD[b]
        if lead is not None:
            if (b % 16) < 4:
                s.line('pizz', lead, u, 0.56, -0.18, 0.22, 0, hold=0.88, accent=acc)
            else:
                s.line('whistle', lead, u, 0.36, 0.18, 0.3, 0, hold=0.9, accent=acc)
                s.line('pizz', lead, u, 0.24, -0.18, 0.18, 0, hold=0.85, accent=acc)
        # light washboard on the 8ths, a touch more on the off-beats
        for k in range(4):
            s.hit('wash', u + 2 * k, 0.22 if k % 2 else 0.12, -0.2, 0.1)
        if b % 16 == 15:                                     # walk back to the top
            for k, m in enumerate((50, 52, 54)):
                s.play('tuba', m, u + 5 + k, 1.0, 0.7, 0.0, 0.08)
    return s.render('r1')


def r1_stir():
    s = Stem(R1_BARS * BAR, U1, seed='r1_stir')
    acc = lambda u: 1.0 if u % 4 == 0 else 0.85
    for b in range(R1_BARS):
        u = b * BAR
        sec = b // 16
        tune = R1_TUNE[b]
        if sec == 1:      # B: music box calls, whistle answers every other pair of bars
            s.line('mbox', tune, u, 0.8, 0.25, 0.3, 12)
            if (b // 2) % 2 == 1:
                s.line('whistle', tune, u, 0.5, -0.15, 0.3, 12, accent=acc)
        else:
            high = 0 if (sec == 3 and b % 16 < 8) else 12      # keep the whistle under C7
            s.line('whistle', tune, u, 0.75, -0.15, 0.3, high, accent=acc)
            if sec >= 2:                                     # banjolele doubles the tune the second time
                s.line('banjo', tune, u, 0.55, 0.3, 0.2, 0, accent=acc)
        # fuller hand percussion
        s.hit('clap', u + 4, 0.6, 0.15, 0.2)
        if sec != 1:
            s.hit('clap', u + 6, 0.35, 0.15, 0.2)
        if b % 2 == 0:
            s.hit('cowbell', u, 0.45, -0.3, 0.15)
        s.hit('cowbell', u + 6, 0.3, -0.3, 0.15)
        for k in (0, 3, 4, 6, 7):
            s.hit('wash', u + k, 0.3 if k in (0, 4) else 0.2, 0.3, 0.1)
        s.hit('drum_lo', u, 0.5, 0.0, 0.1)
        s.hit('drum_hi', u + 4, 0.35, 0.0, 0.1)
    return s.render('r1')


def r1_peril():
    s = Stem(R1_BARS * BAR, U1, seed='r1_peril')
    for b in range(R1_BARS):
        u = b * BAR
        ph = [PERIL_CH[c] for c in _halves(R1_CH[b])]
        # double-time washboard, clipped snare ticks and drums (true stereo spread)
        for k in range(8):
            s.hit('wash', u + k, (0.40 if k % 4 == 0 else 0.28 if k % 2 == 0 else 0.18), 0.28, 0.1)
        for k, g in ((0, 0.58), (3, 0.35), (4, 0.50), (6, 0.40), (7, 0.30)):
            s.hit('drum_lo' if k in (0, 4) else 'drum_hi', u + k, g, -0.18, 0.1)
        for k in (2, 6):
            s.hit('snare_tick', u + k, 0.48, -0.25, 0.15)
            s.hit('spoon', u + k, 0.42, 0.35, 0.15)
        s.hit('spoon', u + 7, 0.28, 0.35, 0.15)
        if b % 2 == 1:
            s.hit('snare_tick', u + 7, 0.32, -0.25, 0.15)
        # insistent E-minor / E-Dorian pizzicato tension pulse
        for i, c in enumerate(ph):
            pr, pt, pf = chord_notes(c, 52)                  # E3 and up
            s.play('pizz', pr, u + 4 * i, 1.8, 0.36, 0.26, 0.18, hold=0.8)
            s.play('pizz', pf, u + 4 * i + 2, 1.5, 0.28, 0.26, 0.18, hold=0.8)
        # high E-minor / E-Dorian whistle runs: two bars on, two bars off
        if (b // 2) % 2 == 0:
            for i, c in enumerate(ph):
                r_, t_, f_ = chord_notes(c, 76)             # E5 and up
                # Add E-Dorian raised 6th (C#6) or minor 7th/9th color on turnarounds
                color = r_ + 9 if (c == 'Em' and (b % 4 == 1) and i == 1) else (r_ + 10 if c in ('Em', 'Bm') else t_)
                arp = [r_, t_, f_, color] if (b + i) % 2 == 0 else [f_, t_, r_, color]
                for k, m in enumerate(arp):
                    while m > 95:                            # keep under C7
                        m -= 12
                    s.play('whistle', m, u + 4 * i + k, 1, 0.34 if k == 0 else 0.26, -0.32, 0.3, hold=0.8)
        else:   # urgent E-minor / Bm / A7 brass horn stabs in stereo
            r0, t0, f0 = chord_notes(ph[0], 52)
            s.play('horn', r0, u + 2, 1.5, 0.38, -0.22, 0.25)
            s.play('horn', t0, u + 2, 1.5, 0.28, 0.22, 0.25)
            r1, t1, f1 = chord_notes(ph[1], 52)
            s.play('horn', f1, u + 6, 1.5, 0.38, 0.22, 0.25)
            s.play('horn', r1 + 12, u + 6, 1.2, 0.22, -0.22, 0.25)
    return s.render('r1')


# ---------------- Brickabrac Map ----------------
BPMM = 92
UM = 60 / BPMM / 3          # one 8th in 6/8
MBAR = 6
M_L = ["G4:2 B4:1 D5:2 B4:1", "E5:2 D5:1 C5:3", "A4:2 C5:1 B4:2 A4:1", "F#4:1 A4:1 F#4:1 G4:3"]
M_TUNE = M_L + ["G4:2 B4:1 D5:2 G5:1", "F#5:2 E5:1 E5:2 B4:1", "C5:2 E5:1 D5:2 C5:1", "A4:3 D5:3"] \
    + M_L + ["E5:2 C5:1 E5:2 G5:1", "D5:2 B4:1 D5:2 G5:1", "F#5:1 E5:1 D5:1 C5:2 A4:1", "G4:3 G5:3"] \
    + ["B4:3 E5:3", "G5:2 F#5:1 E5:3", "C5:3 E5:3", "D5:2 E5:1 D5:3",
       "B4:3 E5:3", "G5:2 A5:1 B5:3", "A5:2 G5:1 E5:2 C#5:1", "D5:3 F#5:2 A5:1",
       "E5:2 C5:1 E5:2 G5:1", "D5:2 B4:1 D5:2 G5:1", "C5:2 E5:1 A4:2 C5:1", "B4:2 A4:1 F#4:3"] + M_L
M_CH = ['G', 'C', 'D', 'D/G', 'G', 'Em', 'Am', 'D', 'G', 'C', 'D', 'D/G', 'C', 'G', 'D7', 'G',
        'Em', 'Em', 'C', 'G', 'Em', 'Em', 'A7', 'D', 'C', 'G', 'Am', 'D', 'G', 'C', 'D', 'D/G']
M_BARS = 32


def map_theme():
    s = Stem(M_BARS * MBAR, UM, seed='map_theme')
    lilt = lambda u: 1.0 if u % 3 == 0 else 0.8
    for b in range(M_BARS):
        u = b * MBAR
        sec = b // 8
        h = _halves(M_CH[b])
        for i, c in enumerate(h):
            root, third, fifth = chord_notes(c, 36)
            s.play('pbass', root if i == 0 or h[0] != h[1] else fifth, u + 3 * i, 2.2, 0.8, 0.0, 0.1)
            if i == 1:
                s.play('pbass', root + 12, u + 5, 0.9, 0.45, 0.0, 0.1)
            cr, ct, cf = chord_notes(c, 55)
            for m in (cr, ct, cf):
                s.play('tina', m, u + 3 * i, 3, 0.36, 0.3, 0.3)
        tune = M_TUNE[b]
        if sec == 2:                                 # concertina takes the tune, whistle rests
            s.line('tina', tune, u, 1.1, 0.25, 0.3, 12, accent=lilt)
        elif sec == 0:
            s.line('whistle', tune, u, 0.7, -0.2, 0.35, 12, accent=lilt)
        else:
            s.line('whistle', tune, u, 0.7, -0.2, 0.35, 12, accent=lilt)
            s.line('mbox', tune, u, 0.35, 0.3, 0.3, 12)
        s.hit('drum_lo', u, 0.4, -0.1, 0.15)
        s.hit('drum_hi', u + 2, 0.2, -0.1, 0.15)
        s.hit('drum_hi', u + 3, 0.3, -0.1, 0.15)
        s.hit('drum_hi', u + 5, 0.22, -0.1, 0.15)
        if sec >= 1:
            s.hit('brush', u + 1, 0.3, 0.3, 0.1)
            s.hit('brush', u + 4, 0.3, 0.3, 0.1)
    out = s.render('map')
    # a far-off kettle hiss that breathes four times a loop (seam-welded via overlap_wrap)
    n = out.shape[1]
    tail_h = n_of(0.5)
    t = np.arange(n + tail_h) / n
    hiss_ext = filt(white(n + tail_h, rng('map_hiss')), 3500, 8000) * (0.5 + 0.5 * np.sin(TAU * 4 * t)) * 0.012
    hiss = overlap_wrap(hiss_ext, tail_h)
    return out + hiss[None, :]


# ---------------- short pieces ----------------

def title_jingle():
    s = Stem(40, U1, loop=False, tail=2.2)
    s.line('mbox', "D5:1 E5:1 F#5:1", -3 + 3, 0.6, 0.2, 0.35, 12)      # three pick-up notes
    u = 3
    s.line('whistle', "G4:2 B4:2 D5:2 B4:2 E5:2 D5:1 C5:1 B4:2 A4:2 G5:8", u, 0.75, -0.15, 0.35, 12)
    s.line('horn', "G4:2 B4:2 D5:2 B4:2 E5:2 D5:1 C5:1 B4:2 A4:2 G4:8", u, 0.7, 0.15, 0.3)
    s.line('mbox', "r:16 B5:1 D6:1 G6:1 B6:1 D7:4", u, 0.5, 0.3, 0.4)
    for i, (m, uu) in enumerate(((43, 0), (50, 4), (48, 8), (50, 12), (43, 16))):
        s.play('tuba', m, u + uu, 3.0 if uu < 16 else 7, 0.9, 0, 0.1)
    for uu, c in ((2, 'G'), (6, 'G'), (10, 'C'), (14, 'D'), (16, 'G')):
        for j, m in enumerate(chord_notes(c, 55) + (chord_notes(c, 55)[0] + 12,)):
            s.play('banjo', m, u + uu, 1.6 if uu < 16 else 6, 0.4, 0.35, 0.2, late=0.008 * j)
    for uu in (4, 12):
        s.put(PERC['clap'], u + uu, 0.6, 0.1, 0.2)
    s.put(PERC['cowbell'], u + 16, 0.6, -0.3, 0.2)
    s.put(PERC['clap'], u + 16, 0.7, 0.1, 0.2)
    s.put(PERC['drum_lo'], u + 16, 0.8, 0, 0.2)
    return s.render('jingle')


def sting_win():
    s = Stem(20, U1, loop=False, tail=1.6)
    s.line('horn', "D5:1 G5:1 B5:1 D6:5", 0, 0.8, 0.15, 0.3)
    s.line('whistle', "D5:1 G5:1 B5:1 D6:1 G6:4", 0, 0.6, -0.2, 0.35, 12)
    s.line('mbox', "r:3 G6:1 B6:1 D7:1 G7:2", 0, 0.45, 0.3, 0.4)
    s.play('tuba', 50, 0, 2.5, 0.8)
    s.play('tuba', 43, 3, 5, 1.0)
    for j, m in enumerate((55, 59, 62, 67)):
        s.play('banjo', m, 3, 5, 0.45, 0.35, 0.2, late=0.012 * j)
    s.put(PERC['clap'], 3, 0.7, 0.1, 0.2)
    s.put(PERC['cowbell'], 3, 0.6, -0.3, 0.2)
    s.put(PERC['clap'], 5, 0.5, 0.1, 0.2)
    s.put(PERC['clap'], 6, 0.6, 0.1, 0.2)
    return s.render('win')


def sting_lose():
    """A soft deflate: the tune sags, then one small parp. No shame."""
    s = Stem(16, U1, loop=False, tail=1.2)
    s.line('tina', "D5:2 B4:2 G4:2 E4:4", 0, 1.0, 0.1, 0.3)
    s.line('tuba', "G3:2 F#3:2 E3:2 D3:4", 0, 0.9, 0, 0.1)
    out = s.render('lose')
    n = n_of(0.9)
    t = np.arange(n) / SR
    sag = osc(glide(700, 260, n, 0.7) * (1 + 0.02 * np.sin(TAU * 9 * t)), harm=(1, 0.2)) * ar(n, 0.03, 0.3) * 0.12
    hiss = noise(0.9, rng('lose'), 1500, 6000) * curve([(0, 0), (0.1, 1), (1, 0)], n) ** 2 * 0.06
    a = s.at(6)
    out[:, a:a + n] += (sag + hiss)[None, :]
    return out
