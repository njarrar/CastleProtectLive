"""Sound effects for Castle Protect v0.1. Ids follow docs/design/07 section 9.3.

Tone rules from 07 section 9.1: homemade, not heroic. Wood knocks, paper bags,
kettles, toy springs. No real blasts, no cries of hurt. Big sounds carry a
400 to 800 Hz knock so they still read on a phone speaker.
"""
import numpy as np
from dsp import (SR, TAU, n_of, tt, db, midi, note, decay, ar, fade, curve, smooth, osc, glide,
                 modal, white, filt, peak, reson, high_shelf, overlap_wrap, make_seamless_loop,
                 noise, loop_noise, sweep_noise, tv_filter, verb, mix, soft_clip, convolve)

# ---------------- building blocks ----------------


def thump(f0, f1, dur, tau, harm=(1.0,)):
    n = n_of(dur)
    return osc(glide(f0, f1, n, 0.5), harm=harm) * decay(n, tau) * ar(n, 0.002, 0.02)


def tick(r, f=2000, tau=0.006, dur=0.04, air=0.3):
    """A tiny wooden or stone tick."""
    n = n_of(dur)
    body = modal([(f, 1, tau), (f * 2.3, 0.4, tau * 0.6)], dur, r)
    return fade(body + air * noise(dur, r, f, f * 4) * decay(n, tau * 0.7), 0.0005, 0.005)


def knock(r, f=320, dur=0.15, tau=0.03, ratios=(1, 2.55, 4.6), amps=(1, 0.5, 0.25)):
    """Wood block knock."""
    parts = [(f * q, a, tau / (1 + 0.6 * i)) for i, (q, a) in enumerate(zip(ratios, amps))]
    n = n_of(dur)
    return fade(modal(parts, dur) + 0.35 * noise(dur, r, 800, 5000) * decay(n, 0.004), 0.0005, 0.01)


def puff(r, dur, lo, hi, tau, a=0.004):
    """Soft burst of filtered noise."""
    n = n_of(dur)
    return noise(dur, r, lo, hi) * decay(n, tau) * ar(n, a, 0.02)


def scatter(r, dur, count, make, t_shape=1.0, gain_fall=0.0):
    """Many small sounds spread over dur. t_shape > 1 packs them near the start."""
    out = np.zeros(n_of(dur) + SR // 4)
    for _ in range(count):
        pos = r.uniform(0, 1) ** t_shape
        s = make(r)
        g = r.uniform(0.4, 1.0) * (1 - gain_fall * pos)
        a = int(pos * n_of(dur))
        out[a:a + len(s)] += g * s
    return out


def boing(f0, f1, dur, wob=18.0, depth=0.25, tau=0.12, harm=(1, 0.35, 0.12)):
    """Toy spring: a tone whose pitch wobbles and settles."""
    n = n_of(dur)
    t = np.arange(n) / SR
    f = glide(f0, f1, n, 0.6) * (1 + depth * np.exp(-t / (tau * 0.8)) * np.sin(TAU * wob * t))
    return osc(f, harm=harm) * decay(n, tau) * ar(n, 0.002, 0.03)


def squeak(f_pts, dur, harm=(1, 0.5, 0.2, 0.08)):
    """Rubber squeak along a pitch path [(pos, hz)]."""
    n = n_of(dur)
    f = np.exp(curve([(p, np.log(h)) for p, h in f_pts], n))
    return osc(f, harm=harm) * ar(n, 0.008, 0.03)


def plop(f0=260, f1=720, dur=0.07):
    n = n_of(dur)
    return osc(glide(f0, f1, n, 1.4)) * ar(n, 0.003, dur * 0.7)


def pop(r, f=520, dur=0.09):
    """Cork pop: a quick falling blip and a puff."""
    return mix(thump(f * 1.6, f * 0.7, dur, 0.018), (puff(r, dur, 600, 5000, 0.008), 0, 0.5))


def creak_line(r, dur, f0, f1, res=(420, 930, 1750), jit=0.25):
    """Stick-slip creak: a ragged pulse train ringing a wooden body."""
    n = n_of(dur)
    imp = np.zeros(n)
    pos = 0.0
    while pos < n - 1:
        x = pos / n
        f = f0 * (f1 / f0) ** x
        imp[int(pos)] = r.uniform(0.5, 1.0)
        pos += SR / f * (1 + jit * r.uniform(-1, 1))
    ir = modal([(res[0], 1, 0.010), (res[1], 0.8, 0.007), (res[2], 0.5, 0.004)], 0.06)
    return convolve(imp, ir)[:n] * ar(n, 0.02, 0.05)


def whoosh(r, dur, f_pts, q=1.5, shape=((0, 0), (0.35, 1), (1, 0))):
    n = n_of(dur)
    return sweep_noise(dur, r, f_pts, q) * curve(shape, n)


def metal(f, ratios, amps, taus, dur, r=None):
    return modal([(f * q, a, t) for q, a, t in zip(ratios, amps, taus)], dur, r)


def blast(r, size):
    """Paper bag, wood thump and kettle drum. size 0 (tiny) to 4 (huge)."""
    dur = (0.2, 0.35, 0.6, 0.9, 1.4)[size]
    low = (150, 130, 110, 95, 80)[size]
    n = n_of(dur)
    bag = noise(dur, r, 180, (5200, 4600, 4000, 3600, 3200)[size]) * (decay(n, dur * 0.07) + 0.4 * decay(n, dur * 0.2)) * ar(n, 0.001, 0.02)
    drum = thump(low * 2.4, low, dur, dur * 0.2, harm=(1, 0.7, 0.45, 0.25))
    kn = modal([(430 + 40 * size, 1, 0.035 + 0.02 * size), (690 + 30 * size, 0.8, 0.025 + 0.015 * size),
                (980 + 30 * size, 0.4, 0.02 + 0.01 * size)], dur)
    out = 1.0 * bag + 0.55 * drum + 0.9 * kn
    if size >= 2:   # a tail of settling bits
        tail = scatter(r, dur * 0.8, 5 + 5 * size, lambda q: tick(q, q.uniform(700, 2600), 0.006), 1.3, 0.7)
        out = mix(out, (tail, dur * 0.12, 0.12 + 0.03 * size))
        rumble = noise(dur, r, 90, 420) * curve([(0, 0), (0.08, 1), (1, 0)], n) ** 2
        out = mix(out, (rumble, 0, 0.35))
    return soft_clip(out, 1.2)


# ---------------- UI ----------------

def ui_tap(r):
    return knock(r, 880, 0.07, 0.012, (1, 2.4), (1, 0.4))


def ui_confirm(r):
    a = modal([(midi(79), 1, 0.09), (midi(79) * 4.1, 0.15, 0.02)], 0.2)
    b = modal([(midi(86), 1, 0.14), (midi(86) * 4.1, 0.15, 0.02)], 0.3)
    return mix(a, (b, 0.075))


def ui_back(r):
    return mix(knock(r, 620, 0.09, 0.015, (1, 2.4), (1, 0.3)), (knock(r, 415, 0.12, 0.02, (1, 2.4), (1, 0.3)), 0.07))


def ui_sheet_open(r):
    return whoosh(r, 0.24, [(0, 700), (1, 2800)], 1.2, ((0, 0), (0.6, 1), (1, 0))) + 0.0


def ui_toggle_on(r):
    return mix(tick(r, 1500, 0.004), (modal([(midi(84), 1, 0.05)], 0.12), 0.012, 0.8))


def ui_slider_tick(r):
    return tick(r, 2400, 0.003, 0.025, 0.2)


def ui_denied(r):
    def hit(q):
        body = knock(q, 196, 0.11, 0.022, (1, 1.5, 2.9, 4.8, 7.6), (0.85, 0.65, 0.45, 0.45, 0.3))
        snap = modal([(980, 0.7, 0.014), (1540, 0.55, 0.011), (2280, 0.35, 0.008)], 0.06, q)
        click = noise(0.035, q, 900, 2800) * decay(n_of(0.035), 0.005) * 0.45
        return mix(body, (snap, 0, 0.7), (click, 0, 1.0))
    return mix(hit(r), (hit(r), 0.1, 0.85))


def ui_card_flip(r):
    return mix(whoosh(r, 0.07, [(0, 1800), (1, 5200)], 1.0), (puff(r, 0.04, 1500, 7000, 0.005), 0.06, 0.9))


def ui_card_take(r):
    return mix(ui_card_flip(r), (modal([(midi(74), 1, 0.06), (midi(74) * 2, 0.3, 0.03)], 0.15), 0.07, 0.9))


def ui_buttons_tick(r):
    def coin(f):
        return metal(f, (1, 1.51, 2.02, 2.71), (1, 0.7, 0.5, 0.3), (0.07, 0.06, 0.04, 0.03), 0.22)
    return mix(coin(2093), (coin(2349), 0.055, 0.5), (tick(r, 2800, 0.002), 0, 0.4))


def ui_handoff_flip(r):
    up = whoosh(r, 0.2, [(0, 500), (1, 3200)], 1.1, ((0, 0), (0.75, 1), (1, 0.1)))
    snap = puff(r, 0.06, 1200, 7000, 0.008)
    thud = knock(r, 240, 0.12, 0.03, (1, 2.2), (1, 0.3))
    return mix(up, (snap, 0.19, 1.2), (thud, 0.2, 0.8))


def ui_fire_press(r):
    clunk = knock(r, 210, 0.14, 0.03, (1, 2.1, 3.9), (1, 0.6, 0.3))
    ping = boing(900, 760, 0.16, 38, 0.06, 0.05, (1, 0.3))
    return mix(clunk, (tick(r, 1800, 0.004), 0, 0.6), (ping, 0.01, 0.35))


# ---------------- aim and turn ----------------

def aim_drag_start(r):
    return creak_line(r, 0.14, 120, 260, (520, 1100, 1900)) * 0.8 + 0.5 * squeak([(0, 300), (1, 470)], 0.14, (1, 0.3))


def aim_band_stretch(r):
    """1 s loop. The game raises the pitch with power."""
    dur = 1.0
    fade_ms = 50.0
    tail = n_of(fade_ms / 1000.0)
    n = n_of(dur)
    n_ext = n + tail
    t_ext = np.arange(n_ext) / SR
    f = 196.0   # 196 whole cycles in 1 s for coherent circular loop phase
    tone_ext = osc(np.full(n_ext, f), harm=(0.6, 0.55, 0.5, 0.45, 0.5, 0.45, 0.4, 0.35, 0.28, 0.22, 0.16, 0.12), phase0=0.0)
    grain_ext = 0.72 + 0.28 * np.sin(TAU * 23 * t_ext) * np.sin(TAU * 3 * t_ext)
    # Resinous cord fibre + stick-slip upper-harmonic creaks (800 Hz - 2.8 kHz) for phone clarity
    mod_ext = 0.55 + 0.45 * np.sin(TAU * 23 * t_ext + 1.0)
    fibre_ext = filt(white(n_ext, r), 850, 2800) * mod_ext * 0.45
    creaks_ext = np.zeros(n_ext)
    for i in range(26):
        a = int((i + 0.35 + r.uniform(-0.15, 0.15)) / 24 * SR)
        s = modal([(r.uniform(900, 1450), 0.7, 0.008), (r.uniform(1650, 2550), 0.5, 0.006)], 0.035, r) * ar(n_of(0.035), 0.002, 0.008)
        if 0 <= a < n_ext:
            e = min(len(s), n_ext - a)
            creaks_ext[a:a + e] += s[:e] * r.uniform(0.35, 0.75)
    return make_seamless_loop(tone_ext * grain_ext * 0.44 + fibre_ext + creaks_ext * 0.38, SR, fade_ms=fade_ms)


def aim_ratchet_tick(r):
    """Crisp ~30 ms wooden-brass ratchet pawl click for every 5% aim pull step."""
    dur = 0.028
    n = n_of(dur)
    wood = modal([(1340, 1.0, 0.0045), (2620, 0.55, 0.0032)], dur, r)
    brass = modal([(3420, 0.48, 0.0030), (5180, 0.24, 0.0020)], dur, r)
    snap = noise(dur, r, 1600, 5600) * decay(n, 0.0018) * 0.42
    return fade(wood + brass + snap, 0.0004, 0.005)


def aim_release_twang(r):
    """Snappy ~145 ms braided-leather slingshot release snap."""
    dur = 0.145
    n = n_of(dur)
    t = np.arange(n) / SR
    # Leather pouch whip crack + elastic cord pitch recoil
    whip = sweep_noise(0.055, r, [(0, 3800), (1, 1100)], 1.6) * decay(n_of(0.055), 0.011) * ar(n_of(0.055), 0.0006, 0.008)
    f_band = curve([(0, 250), (0.14, 430), (0.55, 225), (1.0, 175)], n) * (1 + 0.055 * np.exp(-t / 0.045) * np.sin(TAU * 34 * t))
    twang = osc(f_band, harm=(1.0, 0.58, 0.32, 0.14, 0.06)) * decay(n, 0.048) * ar(n, 0.0015, 0.022)
    fork = knock(r, 470, 0.075, 0.013, (1, 2.35, 4.1), (0.9, 0.45, 0.2))
    out = mix(twang * 0.95, (whip, 0.0, 0.72), (fork, 0.004, 0.65))[:n]
    return soft_clip(fade(out, 0.0008, 0.016), 1.15)


def aim_set(r):
    return mix(knock(r, 520, 0.09, 0.014, (1, 2.6), (1, 0.4)), (boing(330, 300, 0.1, 30, 0.05, 0.03, (1, 0.3)), 0.004, 0.5))


def aim_tick(r):
    return tick(r, 1900, 0.004, 0.03, 0.15)


def aim_limit(r):
    return knock(r, 300, 0.06, 0.012, (1, 1.9), (1, 0.4))


def aim_recall(r):
    z = squeak([(0, 500), (1, 1500)], 0.09, (1, 0.25))
    return mix(z, (tick(r, 1700, 0.006), 0.085, 1.0), (modal([(midi(88), 1, 0.06)], 0.14), 0.09, 0.6))


def turn_yours(r):
    def bell(m, d):
        f = midi(m)
        return modal([(f, 1, d), (f * 2, 0.25, d * 0.5), (f * 5.4, 0.2, 0.03)], d * 4)
    return verb(mix(bell(79, 0.12), (bell(83, 0.12), 0.11), (bell(86, 0.2), 0.22)), r, 0.12)


def turn_hob_pick(r):
    return mix(puff(r, 0.05, 300, 2500, 0.01), (squeak([(0, 520), (1, 800)], 0.08, (1, 0.3)), 0.02, 0.7))


def aim_pin_drop(r):
    twang = boing(680, 640, 0.25, 45, 0.08, 0.06, (1, 0.4, 0.2))
    return mix(knock(r, 760, 0.07, 0.01, (1, 2.7), (1, 0.4)), (twang, 0.004, 0.5))


# ---------------- launch ----------------

def launch_lob(r):
    th = thump(210, 98, 0.22, 0.06, (1, 0.5, 0.2))       # lands near G2
    spoon = knock(r, 490, 0.1, 0.02)
    air = whoosh(r, 0.32, [(0, 500), (1, 2200)], 1.3, ((0, 0), (0.25, 1), (1, 0)))
    return mix(th * 0.7, (spoon, 0, 1.0), (air, 0.02, 0.7))


def launch_bolt(r):
    tw = boing(587, 392, 0.3, 55, 0.1, 0.07, (1, 0.6, 0.4, 0.25))    # D5 to G4
    zip_ = whoosh(r, 0.16, [(0, 1500), (1, 6000)], 2.0, ((0, 0), (0.3, 1), (1, 0)))
    return mix(tw, (zip_, 0.01, 0.5), (tick(r, 2200, 0.004), 0, 0.7))


def launch_fan(r):
    return mix(pop(r, 392), (pop(r, 494), 0.07), (pop(r, 587), 0.14))


def launch_dig(r):
    n = n_of(0.32)
    t = np.arange(n) / SR
    grit = noise(0.32, r, 250, 1800) * (0.55 + 0.45 * np.sign(np.sin(TAU * 45 * t))) * curve([(0, 0), (0.1, 1), (1, 0)], n)
    return mix(grit, (thump(170, 80, 0.2, 0.05, (1, 0.5)), 0, 0.9), (knock(r, 450, 0.08, 0.015), 0, 0.5))


def launch_bounce(r):
    return mix(boing(294, 392, 0.3, 14, 0.35, 0.09), (pop(r, 600, 0.05), 0, 0.5))


def launch_beam(r):
    n = n_of(0.4)
    whine = osc(glide(500, 2350, n, 1.6), harm=(1, 0.4, 0.15)) * curve([(0, 0), (0.03, 0.35), (0.9, 1), (1, 0.6)], n)
    ting = metal(2349, (1, 2.0, 3.01), (1, 0.4, 0.2), (0.18, 0.1, 0.06), 0.5)
    return mix(whine * 0.6, (ting, 0.4), (whoosh(r, 0.2, [(0, 3000), (1, 7000)], 1.0), 0.38, 0.3))


def launch_heavy(r):
    drum = modal([(98, 0.5, 0.3), (147, 0.65, 0.25), (196, 0.75, 0.2), (294, 0.6, 0.14), (392, 0.55, 0.1), (588, 0.45, 0.07)], 0.9)
    kn = mix(modal([(440, 1.0, 0.04), (700, 0.75, 0.03), (1120, 0.8, 0.024), (1760, 0.65, 0.016), (2420, 0.45, 0.011)], 0.22),
             puff(r, 0.1, 800, 2800, 0.014) * 1.1)
    snap = creak_line(r, 0.14, 180, 420, (880, 1520, 2450), jit=0.2) * 0.75
    air = whoosh(r, 0.5, [(0, 400), (1, 1900)], 1.2, ((0, 0), (0.2, 1), (1, 0)))
    return soft_clip(mix(drum, (kn, 0, 1.25), (snap, 0, 0.85), (air, 0.03, 0.65)), 1.3)


def launch_glob(r):
    return mix(thump(520, 170, 0.12, 0.035), (plop(240, 760, 0.06), 0.07, 0.8), (puff(r, 0.1, 500, 3500, 0.02), 0, 0.4))


def launch_roll(r):
    n = n_of(0.45)
    t = np.arange(n) / SR
    roll = noise(0.45, r, 120, 900) * (0.5 + 0.5 * np.abs(np.sin(TAU * (6 + 14 * t) * t))) * curve([(0, 0), (0.15, 1), (1, 0)], n)
    return mix(thump(200, 110, 0.2, 0.05, (1, 0.6, 0.3)) * 0.6, (filt(roll, 250, None), 0.03, 1.0), (knock(r, 380, 0.1, 0.02), 0, 1.0))


# ---------------- flight ----------------

def fly_whistle_loop(r):
    """1 s loop. The game bends the pitch with the shell's height."""
    n = SR
    fade_ms = 50.0
    tail = n_of(fade_ms / 1000.0)
    n_ext = n + tail
    t_ext = np.arange(n_ext) / SR
    f_ext = 1200.0 * (1 + 0.006 * np.sin(TAU * 6 * t_ext))
    tone_ext = osc(f_ext, harm=(1, 0.12, 0.04), phase0=0.0) * (0.86 + 0.14 * np.sin(TAU * 6 * t_ext))
    air_ext = reson(white(n_ext, r), 1200, 6) * 2.5 + filt(white(n_ext, r), 2500, 7000) * 0.05
    return make_seamless_loop(tone_ext * 0.6 + air_ext * 0.25, SR, fade_ms=fade_ms)


def fly_fast_zip(r):
    n = n_of(0.26)
    z = whoosh(r, 0.26, [(0, 3600), (0.5, 2000), (1, 700)], 2.5, ((0, 0), (0.45, 1), (1, 0)))
    tone = osc(glide(1900, 900, n, 1.0), harm=(1, 0.3)) * curve([(0, 0), (0.45, 1), (1, 0)], n) ** 2
    return z + 0.25 * tone


def fly_split(r):
    out = pop(r, 700, 0.07)
    for i, f in enumerate((1568, 1976, 2349)):
        out = mix(out, (modal([(f, 1, 0.03)], 0.08), 0.05 + 0.035 * i, 0.5))
    return out


def fly_bounce_hop(r):
    return mix(boing(247, 370, 0.18, 16, 0.3, 0.06), (puff(r, 0.04, 200, 1500, 0.008), 0, 0.5))


def fly_roll_loop(r):
    n = SR
    fade_ms = 50.0
    tail = n_of(fade_ms / 1000.0)
    n_ext = n + tail
    t = np.arange(n_ext) / SR
    bumps = 0.50 + 0.50 * np.abs(np.sin(TAU * 7 * t)) ** 3
    body = filt(white(n_ext, r), 110, 700) * bumps
    knocks = np.zeros(n_ext)
    for i in range(15):
        s = knock(r, r.uniform(280, 520), 0.05, 0.01)
        a = int(((i + 0.5) / 14) * n)
        if a < n_ext:
            e = min(len(s), n_ext - a)
            knocks[a:a + e] += s[:e] * r.uniform(0.3, 0.8)
    return make_seamless_loop(body + 0.35 * knocks, SR, fade_ms=fade_ms)


# ---------------- impact ----------------

def hit_blast_tiny(r): return blast(r, 0)
def hit_blast_small(r): return blast(r, 1)
def hit_blast_medium(r): return blast(r, 2)
def hit_blast_large(r): return verb(blast(r, 3), r, 0.1, 0.5, 0.14, 3500)
def hit_blast_huge(r): return verb(blast(r, 4), r, 0.16, 0.8, 0.22, 3000)


def hit_sub_thud(r):
    """Warm 60-110 Hz sub-bass weight thump (~220 ms) layered under big blasts and Kettle Pop."""
    dur = 0.22
    n = n_of(dur)
    # Warm 108 -> 62 Hz sub-bass drop paired with warm upper-bass/chest body so it translates on phones
    sub = osc(glide(108.0, 62.0, n, 0.65), harm=(1.0, 0.35, 0.22)) * decay(n, 0.068) * ar(n, 0.0025, 0.028)
    chest = osc(glide(240.0, 155.0, n, 0.55), harm=(0.7, 0.85, 0.45)) * decay(n, 0.044) * ar(n, 0.0015, 0.022)
    punch = modal([(255.0, 1.0, 0.032), (385.0, 0.85, 0.022), (560.0, 0.42, 0.014)], dur, r)
    thump_air = filt(white(n, r), 210, 680) * decay(n, 0.028) * ar(n, 0.0015, 0.02) * 0.58
    out = soft_clip(sub * 1.05 + chest * 0.85 + punch * 0.95 + thump_air, 1.35)
    return fade(out, 0.0015, 0.025)


def hit_pierce(r):
    z = whoosh(r, 0.07, [(0, 5000), (1, 1800)], 2.0, ((0, 0.3), (0.3, 1), (1, 0)))
    return mix(z, (knock(r, 660, 0.14, 0.02, (1, 2.6, 4.9), (1, 0.6, 0.3)), 0.05), (tick(r, 3000, 0.003), 0.05, 0.6))


def hit_dig_carve(r):
    n = n_of(0.42)
    grit = noise(0.42, r, 220, 2600) * curve([(0, 0), (0.06, 1), (0.5, 0.4), (1, 0)], n)
    grains = scatter(r, 0.35, 40, lambda q: tick(q, q.uniform(500, 1800), 0.004, 0.02), 1.4, 0.6)
    return mix(grit * 0.7, (grains, 0, 0.5), (thump(160, 70, 0.22, 0.06, (1, 0.5)), 0, 0.9), (modal([(430, 1, 0.03)], 0.1), 0, 0.3))


def hit_water_splash(r):
    n = n_of(0.6)
    body = noise(0.6, r, 500, 7000) * (decay(n, 0.11) + 0.25 * decay(n, 0.3)) * ar(n, 0.004, 0.05)
    bubbles = scatter(r, 0.4, 9, lambda q: plop(q.uniform(220, 420), q.uniform(600, 1100), q.uniform(0.03, 0.07)), 0.8, 0.3)
    return mix(body * 0.8, (thump(300, 120, 0.1, 0.03), 0, 0.7), (bubbles, 0.06, 0.45))


def hit_miss_thud(r):
    return mix(thump(190, 80, 0.24, 0.05, (1, 0.7, 0.4)) * 0.6, (puff(r, 0.22, 250, 1800, 0.04), 0, 0.9), (modal([(410, 1, 0.025), (640, 0.5, 0.02)], 0.08), 0, 0.7))


def hit_mend_fizz(r):
    fizz = noise(0.3, r, 3500, 9000) * curve([(0, 0), (0.1, 1), (1, 0)], n_of(0.3)) ** 2
    up = [modal([(midi(m), 1, 0.08)], 0.2) for m in (79, 83, 86)]
    return mix(plop(300, 900, 0.05), (fizz, 0.01, 0.35), (up[0], 0.03, 0.4), (up[1], 0.08, 0.4), (up[2], 0.13, 0.5))


# ---------------- materials and collapse ----------------

def mat_wicker_hit(r):
    snaps = scatter(r, 0.1, 7, lambda q: tick(q, q.uniform(1800, 4200), 0.003, 0.02, 0.6), 1.5, 0.5)
    return mix(snaps, (knock(r, 610, 0.1, 0.012, (1, 2.2), (1, 0.4)), 0, 0.6))


def mat_wicker_break(r):
    snaps = scatter(r, 0.3, 22, lambda q: tick(q, q.uniform(1500, 4500), 0.003, 0.02, 0.7), 1.8, 0.7)
    rustle = noise(0.4, r, 2000, 8000) * curve([(0, 0), (0.08, 1), (1, 0)], n_of(0.4)) ** 2
    return mix(snaps, (rustle, 0, 0.35), (knock(r, 540, 0.1, 0.014), 0, 0.8))


def mat_timber_hit(r):
    return mix(knock(r, 330, 0.18, 0.035), (thump(200, 120, 0.08, 0.02), 0, 0.5))


def mat_timber_break(r):
    crack = puff(r, 0.05, 700, 6000, 0.006)
    bits = scatter(r, 0.35, 9, lambda q: knock(q, q.uniform(380, 1100), 0.08, 0.014), 1.5, 0.6)
    cr = creak_line(r, 0.18, 90, 240)
    return mix(crack, (knock(r, 300, 0.2, 0.04), 0, 1.0), (cr, 0.01, 0.4), (bits, 0.03, 0.6))


def stone_clack(r, f=None, g=1.0):
    f = f or r.uniform(1300, 2600)
    n = n_of(0.07)
    return g * (modal([(f, 1, 0.007), (f * 1.83, 0.6, 0.005), (f * 2.9, 0.4, 0.003)], 0.07, r) + 0.5 * noise(0.07, r, 1500, 8000) * decay(n, 0.003))


def mat_cobble_hit(r):
    return mix(stone_clack(r, 1700), (thump(260, 140, 0.09, 0.02), 0, 0.7), (modal([(520, 1, 0.012)], 0.06), 0, 0.5))


def mat_cobble_break(r):
    clacks = scatter(r, 0.5, 18, stone_clack, 1.6, 0.6)
    gravel = noise(0.6, r, 600, 5000) * curve([(0, 0), (0.05, 1), (1, 0)], n_of(0.6)) ** 2.5
    return mix(clacks, (gravel, 0, 0.45), (thump(220, 90, 0.2, 0.05, (1, 0.5)), 0, 0.9), (modal([(480, 1, 0.03)], 0.1), 0, 0.5))


def mat_footing_hit(r):
    base = thump(130, 78, 0.2, 0.045, (0.85, 0.7, 0.45, 0.3))
    clink = modal([(420, 0.9, 0.016), (640, 0.6, 0.012), (960, 0.85, 0.014), (1480, 0.75, 0.010), (2180, 0.55, 0.007), (2680, 0.35, 0.005)], 0.10, r)
    grit = puff(r, 0.065, 850, 2800, 0.009)
    return mix(base, (clink, 0, 0.85), (grit, 0, 0.75))


def col_creak(r):
    return verb(creak_line(r, 0.34, 55, 150), r, 0.08, 0.2, 0.05)


def col_crack(r):
    return mix(puff(r, 0.05, 900, 7000, 0.005), (knock(r, 720, 0.1, 0.015, (1, 2.3, 4.1), (1, 0.6, 0.4)), 0.002))


def col_chunk_fall(r):
    n = n_of(0.5)
    air = whoosh(r, 0.5, [(0, 1800), (1, 450)], 1.4, ((0, 0), (0.6, 1), (1, 0.5)))
    wh = osc(glide(1500, 600, n, 1.0)) * curve([(0, 0), (0.5, 1), (1, 0.4)], n) * 0.12
    return fade(air + wh, 0.01, 0.04)


def col_chunk_land(r):
    n = n_of(1.2)
    rumble = noise(1.2, r, 70, 380) * curve([(0, 0), (0.03, 1), (0.3, 0.6), (1, 0)], n) ** 1.5
    bumps = scatter(r, 0.7, 7, lambda q: thump(q.uniform(120, 200), q.uniform(60, 90), 0.18, 0.05, (1, 0.5)), 1.4, 0.5)
    kn = scatter(r, 0.6, 10, lambda q: knock(q, q.uniform(380, 800), 0.1, 0.025), 1.5, 0.5)
    bits = scatter(r, 1.0, 26, stone_clack, 1.2, 0.8)
    out = mix(rumble * 0.9, (thump(170, 60, 0.35, 0.09, (1, 0.6, 0.3)), 0, 1.0), (bumps, 0.05, 0.7), (kn, 0.02, 0.6), (bits, 0.08, 0.22))
    return verb(soft_clip(out, 1.2), r, 0.1, 0.5, 0.15, 3000)


def col_debris_patter(r):
    def bit(q):
        return stone_clack(q) if q.uniform() < 0.5 else knock(q, q.uniform(500, 1400), 0.05, 0.008)
    return scatter(r, 0.9, 30, bit, 1.7, 0.75)


def col_dust_settle(r):
    n = n_of(0.75)
    air = noise(0.75, r, 700, 5500) * curve([(0, 0), (0.12, 1), (1, 0)], n) ** 2
    out = mix(air, (scatter(r, 0.6, 6, lambda q: tick(q, q.uniform(1200, 2600), 0.003, 0.02), 1.0, 0.5), 0.1, 0.25))
    return high_shelf(out, -6.0, 3800.0, 5500.0)


# ---------------- ground and weather ----------------

def gnd_mound_grow(r):
    n = n_of(0.4)
    dirt = noise(0.4, r, 180, 1800) * curve([(0, 0), (0.25, 1), (1, 0)], n)
    return mix(dirt, (thump(90, 150, 0.25, 0.09, (1, 0.5)), 0.02, 0.8), (scatter(r, 0.3, 10, lambda q: tick(q, q.uniform(600, 1500), 0.004, 0.02), 1.0, 0.3), 0.05, 0.3))


def _gusts(n, dur, r, k=(1, 2, 3)):
    t = np.arange(n) / SR
    g = np.zeros(n)
    for c in k:   # whole cycles per loop: no seam
        g += np.sin(TAU * c * t / dur + r.uniform(0, TAU)) / c
    return 0.5 + 0.5 * g / np.max(np.abs(g))


def wx_wind_loop(r):
    dur = 4.0
    fade_ms = 50.0
    tail = n_of(fade_ms / 1000.0)
    n_ext = n_of(dur) + tail
    g = _gusts(n_ext, dur, r)
    low = filt(white(n_ext, r), 250, 900) * (0.45 + 0.55 * g)
    wn = white(n_ext, r)
    hiss = (reson(wn, 950, 5) * (1 - g) + reson(wn, 1400, 5) * g) * (0.35 + 0.65 * g) * 2
    return make_seamless_loop(low + hiss, SR, fade_ms=fade_ms)


def wx_wind_shift(r):
    n = n_of(0.9)
    gust = whoosh(r, 0.9, [(0, 500), (0.45, 1700), (1, 700)], 1.6, ((0, 0), (0.4, 1), (1, 0)))
    vane = creak_line(r, 0.22, 140, 300, (1500, 2400, 3300)) * 0.25
    return mix(gust, (vane, 0.3))


def wx_squall_loop(r):
    dur = 4.0
    fade_ms = 50.0
    tail = n_of(fade_ms / 1000.0)
    n_ext = n_of(dur) + tail
    g = _gusts(n_ext, dur, r, (1, 3))
    rumble = filt(white(n_ext, r), 60, 300) * (0.6 + 0.4 * _gusts(n_ext, dur, r, (2, 5)))
    knockband = filt(white(n_ext, r), 380, 800) * (0.5 + 0.5 * g) * 0.5
    rain = filt(white(n_ext, r), 2500, 9000) * (0.5 + 0.5 * g) * 0.25
    drops = np.zeros(n_ext)
    for _ in range(175):
        s = tick(r, r.uniform(1800, 5000), 0.002, 0.012, 0.8) * r.uniform(0.1, 0.5)
        a = r.integers(0, n_ext - len(s))
        drops[a:a + len(s)] += s
    wind = reson(white(n_ext, r), 700, 3) * (0.3 + 0.7 * g) * 1.5
    return make_seamless_loop(rumble * 1.0 + knockband + rain + drops + wind, SR, fade_ms=fade_ms)


def wx_squall_bell(r):
    def strike():
        return metal(784, (0.5, 1, 1.19, 1.5, 2.0, 2.74, 3.76), (0.3, 1, 0.5, 0.3, 0.7, 0.3, 0.15),
                     (0.9, 0.6, 0.4, 0.35, 0.3, 0.15, 0.08), 1.3)
    return verb(mix(strike(), (strike(), 0.22, 0.8)), r, 0.15, 0.5, 0.15)


# ---------------- castle and kettle ----------------

def steam(r, dur, lo=2500, shape=((0, 0), (0.08, 1), (1, 0)), power=1.5):
    return noise(dur, r, lo, 10000) * curve(shape, n_of(dur)) ** power


def cas_step(r):
    clank = metal(520, (1, 1.47, 2.3), (1, 0.5, 0.3), (0.03, 0.025, 0.02), 0.12)
    return mix(thump(170, 80, 0.26, 0.05, (1, 0.7, 0.4)) * 0.6, (knock(r, 420, 0.1, 0.025), 0, 1.0), (clank, 0.005, 0.4),
               (steam(r, 0.16, 3000), 0.07, 0.18))


def cas_steam(r):
    out = steam(r, 0.55, 1500, ((0, 0), (0.06, 1), (0.3, 0.5), (1, 0)), 1.3)
    return high_shelf(out, -6.0, 3800.0, 5500.0)


def cas_thump(r):
    rattle = scatter(r, 0.4, 14, lambda q: knock(q, q.uniform(350, 1200), 0.06, 0.012), 1.5, 0.6)
    out = mix(thump(200, 70, 0.5, 0.1, (1, 0.7, 0.5, 0.3)) * 0.6, (modal([(450, 1, 0.05), (720, 0.7, 0.04)], 0.2), 0, 1.0),
              (puff(r, 0.3, 250, 2500, 0.05), 0, 0.8), (rattle, 0.03, 0.6))
    return soft_clip(out, 1.3)


def cas_loophole_flap(r):
    hinge = squeak([(0, 900), (1, 1400)], 0.07, (1, 0.4)) * 0.2
    slap = mix(knock(r, 430, 0.14, 0.022), (puff(r, 0.05, 500, 4000, 0.007), 0, 0.6))
    return mix(hinge, (slap, 0.07))


def _lid_rattle(r, dur, f=2900, first=0.07):
    out = np.zeros(n_of(dur) + 2400)
    pos, gap, g = 0.02, first, 1.0
    while pos < dur and gap > 0.008:
        s = metal(f * r.uniform(0.95, 1.05), (1, 1.6, 2.4), (1, 0.6, 0.3), (0.012, 0.008, 0.006), 0.04)
        a = n_of(pos)
        out[a:a + len(s)] += g * s
        pos += gap
        gap *= 0.8
        g *= 0.85
    return out


def ket_hit(r):
    gong = metal(233, (1, 1.6, 2.32, 3.83, 5.7, 9.0), (1, 0.8, 0.6, 0.5, 0.3, 0.15), (0.45, 0.4, 0.3, 0.2, 0.1, 0.05), 0.9)
    return verb(mix(gong, (knock(r, 500, 0.06, 0.01), 0, 0.5), (_lid_rattle(r, 0.5), 0.03, 0.3)), r, 0.1)


def ket_whistle_loop(r):
    """Continuous 1.34 s kettle steam-and-whistle loop with steady boundary RMS (no silence dip)."""
    dur = 1.34
    fade_ms = 50.0
    n = n_of(dur)
    tail = n_of(fade_ms / 1000.0)
    n_ext = n + tail
    t = np.arange(n_ext) / SR
    # Continuous simmering kettle steam & whistling spout bed (keeps boundary RMS steady > 0.8)
    bed_f = 1976.0 * (1 + 0.004 * np.sin(TAU * 9 * t))
    bed_tone = osc(bed_f, harm=(0.65, 0.12, 0.04), phase0=0.0) * (0.72 + 0.14 * np.sin(TAU * 3 * t / dur))
    bed_steam = reson(white(n_ext, r), 1976, 10) * 3.0 + filt(white(n_ext, r), 1500, 4200) * 0.22
    out = bed_tone * 0.48 + bed_steam * 0.28
    # Three urgent kettle-pipe swells layered over the steady steam bed
    def pulse(d, f):
        np_ = n_of(d)
        tp = np.arange(np_) / SR
        tone = osc(f * (1 + 0.004 * np.sin(TAU * 9 * tp)) * curve([(0, 0.98), (0.2, 1), (1, 1)], np_), harm=(1, 0.08))
        air = reson(white(np_, r), f, 12) * 3.5
        return (tone * 0.65 + air * 0.30) * ar(np_, 0.045, 0.075)
    for start_s, d_s, freq in ((0.06, 0.30, 1976), (0.46, 0.30, 1976), (0.86, 0.42, 2093)):
        p_sig = pulse(d_s, freq)
        a = n_of(start_s)
        e = min(len(p_sig), n_ext - a)
        out[a:a + e] += p_sig[:e] * 0.52
    return make_seamless_loop(out, SR, fade_ms=fade_ms)


def ket_crack(r):
    n = n_of(0.24)
    cr = mix(metal(900, (1, 1.7, 2.9, 4.3), (1, 0.7, 0.5, 0.3), (0.03, 0.02, 0.015, 0.01), 0.1), puff(r, 0.04, 1500, 8000, 0.004))
    rise = osc(glide(1500, 2600, n, 1.5), harm=(1, 0.1)) * curve([(0, 0), (1, 1)], n) ** 2 * 0.35
    hiss = steam(r, 0.24, 3000, ((0, 0), (1, 1)), 2) * 0.35
    return mix(cr, (rise + hiss, 0))


def ket_pop(r):
    bang = soft_clip(mix(metal(310, (1, 1.52, 2.4, 3.6, 5.1), (1, 0.8, 0.6, 0.4, 0.2), (0.25, 0.2, 0.15, 0.1, 0.06), 0.6),
                         (thump(220, 80, 0.25, 0.06, (1, 0.5)), 0, 1.0), (puff(r, 0.12, 300, 6000, 0.015), 0, 1.0),
                         (modal([(470, 1, 0.04), (760, 0.6, 0.03)], 0.15), 0, 0.7)), 1.3)
    n = n_of(1.5)
    t = np.arange(n) / SR
    f = glide(2500, 950, n, 0.8) * (1 + 0.01 * np.sin(TAU * 11 * t))
    env = curve([(0, 0), (0.04, 1), (0.5, 0.6), (1, 0)], n)
    scream = osc(f, harm=(1, 0.15)) * env * 0.3

    def band(fq, tm):
        fc = np.interp(tm, t[::480], f[::480])
        return 1 / np.sqrt(1 + (5 * (np.maximum(fq, 1) / fc - fc / np.maximum(fq, 1))) ** 2)
    air = tv_filter(white(n, r), band) * env * 1.6 + steam(r, 1.5, 3000, ((0, 0), (0.03, 1), (1, 0)), 1.6) * 0.3
    lid = _lid_rattle(r, 0.6, 2400, 0.12)
    return verb(mix(bang, (scream + air, 0.03, 0.75), (lid, 0.5, 0.35)), r, 0.12, 0.5, 0.15)


def ket_sit_down(r):
    n = n_of(0.45)
    slide = osc(glide(520, 150, n, 0.8), harm=(1, 0.3, 0.1)) * ar(n, 0.02, 0.1) * 0.5
    fold = creak_line(r, 0.4, 130, 45) * 0.5
    sit = mix(thump(150, 58, 0.35, 0.09, (1, 0.6, 0.3)), (knock(r, 400, 0.12, 0.03), 0, 0.7), (puff(r, 0.2, 200, 1800, 0.04), 0, 0.5))
    sigh = steam(r, 0.6, 1800, ((0, 0), (0.1, 1), (1, 0)), 1.6)
    return mix(slide, (fold, 0), (sit, 0.42, 1.2), (sigh, 0.5, 0.25))


def ket_patch(r):
    pat = mix(thump(300, 140, 0.1, 0.025), (puff(r, 0.08, 400, 3000, 0.012), 0, 0.7))
    notes = [modal([(midi(m), 1, 0.1), (midi(m) * 3, 0.15, 0.03)], 0.3) for m in (74, 79, 83)]
    return mix(pat, (notes[0], 0.05, 0.5), (notes[1], 0.11, 0.5), (notes[2], 0.17, 0.6))


# ---------------- Hob body sounds ----------------

def hob_hit_boing(r):
    sq = squeak([(0, 700), (0.25, 1500), (1, 950)], 0.12)
    return mix(sq * 0.6, (boing(330, 262, 0.3, 17, 0.3, 0.09), 0.01), (puff(r, 0.04, 300, 2500, 0.008), 0, 0.5))


def hob_tumble_roll(r):
    n = n_of(0.6)
    slide = osc(glide(1300, 420, n, 0.9) * (1 + 0.03 * np.sin(TAU * 13 * np.arange(n) / SR)), harm=(1, 0.2)) * ar(n, 0.02, 0.1) * 0.35
    bumps = mix(*[(mix(knock(r, 300 - 30 * i, 0.08, 0.015), (squeak([(0, 800), (1, 600)], 0.04) * 0.3, 0)), 0.08 + 0.14 * i, 1 - 0.12 * i) for i in range(4)])
    return mix(slide, (bumps, 0))


def hob_land_thud(r):
    return mix(thump(230, 120, 0.16, 0.035, (1, 0.6, 0.3)) * 0.6, (puff(r, 0.08, 300, 2200, 0.015), 0, 0.8), (modal([(430, 1, 0.02)], 0.06), 0, 0.5),
               (squeak([(0, 1100), (1, 800)], 0.06) * 0.25, 0.02))


def hob_bonk(r):
    coco = mix(knock(r, 560, 0.14, 0.02, (1, 1.48, 2.9), (1, 0.7, 0.3)), (thump(260, 180, 0.06, 0.015), 0, 0.5))
    wob = boing(196, 165, 0.5, 9, 0.4, 0.18, (1, 0.3)) * 0.6
    stars = mix(*[(modal([(midi(m), 1, 0.07), (midi(m) * 2.76, 0.2, 0.02)], 0.2), 0.16 + 0.085 * i, 0.5) for i, m in enumerate((91, 88, 93, 86, 90))])
    return mix(coco, (wob, 0.02), (stars, 0))


def hob_balloon_inflate(r):
    n = n_of(0.44)
    t = np.arange(n) / SR
    f = glide(190, 560, n, 1.3) * (1 + 0.05 * np.sin(TAU * 31 * t))
    rub = osc(f, harm=(1, 0.5, 0.3, 0.15)) * (0.6 + 0.4 * np.sin(TAU * 31 * t)) * curve([(0, 0), (0.2, 0.7), (0.9, 1), (1, 0)], n)
    blow = sweep_noise(0.44, r, [(0, 600), (1, 2600)], 1.5) * curve([(0, 0), (0.15, 1), (0.9, 0.8), (1, 0)], n)
    return mix(rub * 0.5, (blow, 0, 0.6), (plop(500, 1100, 0.04), 0.41, 0.8))


def hob_balloon_float(r):
    n = n_of(1.2)
    t = np.arange(n) / SR
    f = glide(392, 784, n, 0.8) * (1 + 0.02 * np.sin(TAU * 4.5 * t))
    tone = osc(f, harm=(1, 0.1)) * curve([(0, 0), (0.1, 1), (0.6, 0.6), (1, 0)], n) * (0.75 + 0.25 * np.sin(TAU * 4.5 * t))
    air = sweep_noise(1.2, r, [(0, 700), (1, 2000)], 2.5) * curve([(0, 0), (0.1, 1), (1, 0)], n) * 0.5
    return tone * 0.5 + air


def hob_shove_dig(r):
    scrape = sweep_noise(0.2, r, [(0, 700), (1, 2600)], 1.2) * curve([(0, 0), (0.7, 1), (1, 0)], n_of(0.2))
    toss = scatter(r, 0.22, 14, lambda q: tick(q, q.uniform(500, 1600), 0.004, 0.02, 0.6), 1.2, 0.5)
    return mix(metal(1250, (1, 2.3), (1, 0.4), (0.03, 0.015), 0.08) * 0.3, (scrape, 0, 0.9), (thump(170, 85, 0.14, 0.04), 0.02, 0.7), (toss, 0.14, 0.5))


# ---------------- Doodads ----------------

def doo_pot_lid_clang(r):
    n = n_of(0.75)
    t = np.arange(n) / SR
    cl = metal(523, (1, 2.27, 3.71, 5.52, 7.7), (1, 0.8, 0.6, 0.35, 0.2), (0.3, 0.25, 0.18, 0.1, 0.06), 0.75)
    cl *= 1 + 0.3 * np.sin(TAU * 8 * t) * np.exp(-t / 0.3)
    return verb(mix(cl, (knock(r, 600, 0.05, 0.008), 0, 0.5)), r, 0.1)


def doo_mend_bucket_slosh(r):
    n = n_of(0.6)
    t = np.arange(n) / SR

    def g(fq, tm):
        fc = 500 + 900 * np.abs(np.sin(TAU * 2.6 * tm))
        return 1 / np.sqrt(1 + (2.2 * (np.maximum(fq, 1) / fc - fc / np.maximum(fq, 1))) ** 2)
    water = tv_filter(white(n, r), g) * (0.3 + 0.7 * np.abs(np.sin(TAU * 2.6 * t + 0.4))) * curve([(0, 0), (0.1, 1), (1, 0)], n)
    drips = scatter(r, 0.45, 7, lambda q: plop(q.uniform(250, 450), q.uniform(700, 1300), q.uniform(0.03, 0.06)), 1.0, 0.3)
    pail = metal(410, (1, 2.4, 3.9), (1, 0.5, 0.3), (0.06, 0.04, 0.03), 0.2)
    return mix(water, (drips, 0.08, 0.4), (pail, 0, 0.25))


# ---------------- event cues (one sound per event, so the field reads by ear) ----------------

def doo_lid_bounce(r):
    """A shell bounces off a Pot Lid: a bright tin 'bwang' that wobbles, higher and shorter than the lid going on."""
    n = n_of(0.5)
    t = np.arange(n) / SR
    cl = metal(740, (1, 2.27, 3.71, 5.52), (1, 0.7, 0.45, 0.25), (0.2, 0.15, 0.1, 0.06), 0.5)
    cl *= 1 + 0.4 * np.sin(TAU * 14 * t) * np.exp(-t / 0.18)
    hit = mix(knock(r, 900, 0.04, 0.006), (puff(r, 0.03, 1500, 7000, 0.005), 0, 0.6))
    return verb(mix(hit, (cl, 0, 0.9)), r, 0.08, 0.3, 0.08)


def hob_buried_thlup(r):
    """A Loophole is buried (Dug in): a wet mud 'thlup', a drop then a little suck."""
    n = n_of(0.32)
    drop = thump(420, 150, 0.2, 0.05, (1, 0.6, 0.35)) * 0.8
    mud = noise(0.24, r, 250, 1400) * curve([(0, 0), (0.05, 1), (0.5, 0.4), (1, 0)], n_of(0.24))
    suck = osc(glide(380, 820, n_of(0.08), 1.6)) * ar(n_of(0.08), 0.01, 0.05) * 0.45
    clods = scatter(r, 0.14, 5, lambda q: knock(q, q.uniform(450, 800), 0.04, 0.008), 1.2, 0.5) * 0.4
    return fade(mix(drop, (mud, 0, 0.8), (suck, 0.17), (clods, 0.04)), 0.001, 0.03)[:n + SR // 10]


def cas_boss_horn(r):
    """Grand Fort phase: a homemade tin horn, two toots going up. Not a fanfare."""
    def toot(f, d, up=1.03):
        n = n_of(d)
        t = np.arange(n) / SR
        fr = glide(f * 0.94, f * up, n, 0.25) * (1 + 0.012 * np.sin(TAU * 5.5 * t))
        tone = osc(fr, harm=(1, 0.8, 0.65, 0.5, 0.35, 0.22, 0.12))
        return tone * curve([(0, 0), (0.06, 1), (0.8, 0.8), (1, 0)], n)
    buzz = noise(0.85, r, 600, 2400) * curve([(0, 0), (0.05, 0.25), (0.3, 0.1), (1, 0)], n_of(0.85))
    out = mix(toot(233, 0.26, 1.0), (toot(311, 0.55), 0.3), (buzz, 0, 0.3))
    return verb(out, r, 0.16, 0.6, 0.18, 4000)


def wx_front_chime(r):
    """A new Weather Front: a gust and a few wind chimes."""
    n = n_of(0.95)
    gust = sweep_noise(0.95, r, [(0, 500), (0.4, 1500), (1, 700)], 1.4) * curve([(0, 0), (0.12, 1), (0.5, 0.7), (1, 0)], n)
    chimes = []
    for i, m in enumerate((84, 88, 91, 86, 93)):
        bell = modal([(midi(m), 1, 0.35), (midi(m) * 2.76, 0.3, 0.12), (midi(m) * 5.4, 0.12, 0.05)], 0.7)
        chimes.append((bell, 0.02 + 0.13 * i + r.uniform(0, 0.04), 0.55 - 0.05 * i))
    return verb(mix(gust * 0.8, *chimes), r, 0.14, 0.5, 0.14)


def hit_threaded_zip(r):
    """Threaded: a shot slips through a Loophole. A thin rising zip and a pin tink."""
    n = n_of(0.16)
    zip_ = sweep_noise(0.16, r, [(0, 900), (1, 3400)], 4.0) * curve([(0, 0), (0.15, 1), (0.85, 0.8), (1, 0)], n)
    tone = osc(glide(700, 2000, n, 1.3), harm=(1, 0.2)) * curve([(0, 0), (0.2, 0.6), (1, 0)], n) * 0.5
    tink = modal([(2093, 1, 0.05), (2093 * 2.4, 0.2, 0.02)], 0.1)
    return mix(zip_, (tone, 0), (tink, 0.14, 0.5))


def doo_roller_rumble(r):
    """Big Smoothie Jr. rolls out: a heavy wooden drum rumbling over the turf, with knocks as it goes."""
    n = n_of(1.0)
    t = np.arange(n) / SR
    bed = noise(1.0, r, 180, 900) * (0.7 + 0.3 * np.sin(TAU * 7 * t)) * curve([(0, 0), (0.06, 1), (0.75, 0.8), (1, 0)], n)
    hum = osc(np.full(n, 196.0) * (1 + 0.02 * np.sin(TAU * 3 * t)), harm=(0.6, 1, 0.5, 0.3)) * curve([(0, 0), (0.1, 1), (1, 0)], n) * 0.25
    knocks = mix(*[(knock(r, 330 + 40 * (i % 3), 0.1, 0.02), 0.04 + 0.16 * i, 0.7 - 0.06 * i) for i in range(6)])
    creak = creak_line(r, 0.5, 220, 160) * 0.25
    return mix(bed, (hum, 0), (knocks, 0), (creak, 0.3))


def doo_shears_jam(r):
    """The shears jam: a snip that sticks halfway, a clunk and a rattle."""
    snip = mix(metal(2400, (1, 1.6, 2.7), (1, 0.6, 0.3), (0.02, 0.015, 0.01), 0.06), (sweep_noise(0.08, r, [(0, 3000), (1, 1800)], 3.0) * 0.6, 0))
    grind = creak_line(r, 0.16, 900, 520) * 0.5
    clunk = mix(knock(r, 380, 0.12, 0.025), (metal(620, (1, 1.47, 2.3), (1, 0.5, 0.3), (0.05, 0.04, 0.03), 0.15), 0, 0.5))
    rattle = _lid_rattle(r, 0.22, 1800, 0.05) * 0.4
    return mix(snip, (grind, 0.05), (clunk, 0.2), (rattle, 0.24))


# ---------------- meta ----------------

def meta_pennant_stamp(r):
    ding = mix(*[(modal([(midi(m), 1, 0.16), (midi(m) * 2, 0.3, 0.08), (midi(m) * 5.4, 0.2, 0.02)], 0.5), 0.045 * i, 0.8) for i, m in enumerate((79, 83, 86, 91))])
    flap = whoosh(r, 0.18, [(0, 600), (1, 2500)], 1.2) * 0.4
    return verb(mix(knock(r, 300, 0.1, 0.02), (ding, 0), (flap, 0.02)), r, 0.12)


def meta_block_place(r):
    return mix(knock(r, 410, 0.12, 0.02), (thump(180, 120, 0.07, 0.02), 0, 0.6))


# ---------------- registry ----------------
# id: (function, bus, target LUFS, loop, volume, trigger, anim event or None, caption or None)

def S(fn, bus, lufs, trig, anim=None, loop=False, vol=1.0, pitch_var=1.0, note=None, gap=None, shelf_db=None):
    return dict(fn=fn, bus=bus, lufs=lufs, loop=loop, volume=vol, trigger=trig, anim=anim, pitch_var=pitch_var, note=note, gap=gap, shelf_db=shelf_db)


HOB_ANIM = 'hob_<id>_<side>_'
SFX = {
    'ui_tap': S(ui_tap, 'ui', -22, 'Any button. Dock and tab changes: play 3 semitones up', pitch_var=0.5),
    'ui_confirm': S(ui_confirm, 'ui', -22, 'Main button on a card: Play, Fight, Retry, Start', pitch_var=0),
    'ui_back': S(ui_back, 'ui', -23, 'Back and close', pitch_var=0),
    'ui_sheet_open': S(ui_sheet_open, 'ui', -25, 'A sheet slides up. Play in reverse when it closes', pitch_var=0),
    'ui_toggle_on': S(ui_toggle_on, 'ui', -23, 'Switch on. Play 4 semitones down for off', pitch_var=0),
    'ui_slider_tick': S(ui_slider_tick, 'ui', -24, 'Each slider step', pitch_var=0.5),
    'ui_denied': S(ui_denied, 'ui', -22, 'Dim key, locked thing, Fire while dug in', pitch_var=0),
    'ui_card_flip': S(ui_card_flip, 'ui', -23, 'Shell card or draft chip turns (core event draft_start)'),
    'ui_card_take': S(ui_card_take, 'ui', -22, 'Core event draft_pick. Play 3 semitones down when the Rival picks', pitch_var=0),
    'ui_buttons_tick': S(ui_buttons_tick, 'ui', -22, 'Coin: Buttons counting up on Results, coin lands in the purse', 'ui_button_coin_spin (end of the flight)'),
    'ui_handoff_flip': S(ui_handoff_flip, 'ui', -21, 'Couch Duel hand-off card turns over', 'ui_handoff_flip:swap', pitch_var=0,
                         note='Starts 190 ms before the snap. Start it with the animation, the snap lands on swap'),
    'ui_fire_press': S(ui_fire_press, 'ui', -18, 'Fire button goes down', 'ui_fire_press:fire', pitch_var=0),

    'aim_drag_start': S(aim_drag_start, 'ui', -24, 'Aim Drag starts, band appears'),
    'aim_band_stretch': S(aim_band_stretch, 'ui', -20, 'While dragging. Pitch 0 to +12 semitones with power 0 to 100', loop=True, vol=0.6, pitch_var=0),
    'aim_ratchet_tick': S(aim_ratchet_tick, 'ui', -23, 'Aim Drag crosses each 5% power notch (pitch up +0.4 semitones per step)', pitch_var=0.3),
    'aim_release_twang': S(aim_release_twang, 'launch', -18, 'Slingshot band snaps forward on shot release; scales with pull tension', HOB_ANIM + 'fire:release', pitch_var=0.6),
    'aim_set': S(aim_set, 'ui', -23, 'Finger up, aim set. Play 5 semitones down for a cancel', pitch_var=0),
    'aim_tick': S(aim_tick, 'ui', -25, 'Fine Tune step. Angle at pitch 0, power 5 semitones down', pitch_var=0),
    'aim_limit': S(aim_limit, 'ui', -24, 'Aim or power at its limit', pitch_var=0),
    'aim_recall': S(aim_recall, 'ui', -23, 'Recall snaps to a Ghost', pitch_var=0),
    'turn_yours': S(turn_yours, 'ui', -20, 'Core event turn_start. Pitch 0 for side 0 or Player 1, 2 semitones down for the Rival or Player 2', pitch_var=0),
    'turn_hob_pick': S(turn_hob_pick, 'ui', -23, 'Command pick_hob'),
    'aim_pin_drop': S(aim_pin_drop, 'ui', -21, 'A Pin lands', 'fx_pin_p1_drop:stick, fx_pin_p2_drop:stick'),

    'launch_lob': S(launch_lob, 'launch', -17, 'Core event fire, shot group lob', HOB_ANIM + 'fire:release'),
    'launch_bolt': S(launch_bolt, 'launch', -17, 'Core event fire, shot group bolt', HOB_ANIM + 'fire:release'),
    'launch_fan': S(launch_fan, 'launch', -17, 'Core event fire, shot group fan', HOB_ANIM + 'fire:release'),
    'launch_dig': S(launch_dig, 'launch', -17, 'Core event fire, shot group dig', HOB_ANIM + 'fire:release'),
    'launch_bounce': S(launch_bounce, 'launch', -17, 'Core event fire, shot group bounce', HOB_ANIM + 'fire:release'),
    'launch_beam': S(launch_beam, 'launch', -18, 'Core event fire, shot group beam', HOB_ANIM + 'fire:release',
                     note='The whine is 0.4 s, then the bright line. Hold the beam draw until 0.4 s'),
    'launch_heavy': S(launch_heavy, 'launch', -15, 'Core event fire, shot group heavy', HOB_ANIM + 'fire:release'),
    'launch_glob': S(launch_glob, 'launch', -18, 'Core event fire, shot group glob', HOB_ANIM + 'fire:release'),
    'launch_roll': S(launch_roll, 'launch', -17, 'Core event fire, shot group roll', HOB_ANIM + 'fire:release'),

    'fly_whistle_loop': S(fly_whistle_loop, 'flight', -27, 'While an arc shell flies. Pitch -7 to +7 semitones with height', 'fx_trail_blast', loop=True, vol=0.5, pitch_var=0),
    'fly_fast_zip': S(fly_fast_zip, 'flight', -21, 'A bolt or beam passes the middle of the field', 'fx_trail_pierce'),
    'fly_split': S(fly_split, 'flight', -20, 'Core event split'),
    'fly_bounce_hop': S(fly_bounce_hop, 'flight', -19, 'Each hop of a bouncer', pitch_var=2),
    'fly_roll_loop': S(fly_roll_loop, 'flight', -24, 'While a roller is on the ground', loop=True, vol=0.7, pitch_var=0),

    'hit_blast_tiny': S(hit_blast_tiny, 'impact', -18, 'Core event explode, band tiny', pitch_var=2),
    'hit_blast_small': S(hit_blast_small, 'impact', -16, 'Core event explode, band small', pitch_var=2),
    'hit_blast_medium': S(hit_blast_medium, 'impact', -14, 'Core event explode, band medium', pitch_var=1.5),
    'hit_blast_large': S(hit_blast_large, 'impact', -13, 'Core event explode, band large'),
    'hit_blast_huge': S(hit_blast_huge, 'impact', -12, 'Core event explode, band huge'),
    'hit_sub_thud': S(hit_sub_thud, 'impact', -15, 'Warm 60-110 Hz sub-bass weight thump layered under hit_blast_large, hit_blast_huge, and ket_pop', pitch_var=0.5, shelf_db=-1.0),
    'hit_pierce': S(hit_pierce, 'impact', -16, 'Core event explode, type pierce, and event threaded'),
    'hit_dig_carve': S(hit_dig_carve, 'impact', -16, 'Core event carve', 'fx_trail_dig'),
    'hit_water_splash': S(hit_water_splash, 'impact', -17, 'A shell or block lands in water', 'fx_splash:plop'),
    'hit_miss_thud': S(hit_miss_thud, 'impact', -17, 'A shell hits plain ground, no damage', 'fx_impact_dirt:flash'),
    'hit_mend_fizz': S(hit_mend_fizz, 'impact', -20, 'A mend bubble pops on a block', 'fx_fizz_pop:pop'),

    'mat_wicker_hit': S(mat_wicker_hit, 'material', -18, 'Core event hit, target block, Wicker', 'fx_impact_wicker:flash', pitch_var=2),
    'mat_wicker_break': S(mat_wicker_break, 'material', -17, 'Core event break, Wicker', 'fx_rubble_wicker', pitch_var=2),
    'mat_timber_hit': S(mat_timber_hit, 'material', -17, 'Core event hit, target block, Timber', 'fx_impact_timber:flash', pitch_var=2),
    'mat_timber_break': S(mat_timber_break, 'material', -16, 'Core event break, Timber', 'fx_rubble_timber', pitch_var=2),
    'mat_cobble_hit': S(mat_cobble_hit, 'material', -17, 'Core event hit, target block, Cobble', 'fx_impact_cobble:flash', pitch_var=2),
    'mat_cobble_break': S(mat_cobble_break, 'material', -15, 'Core event break, Cobble', 'fx_rubble_cobble', pitch_var=2),
    'mat_footing_hit': S(mat_footing_hit, 'material', -16, 'Core event hit, target block, Footing', 'fx_impact_footing:flash', pitch_var=1),
    'col_creak': S(col_creak, 'material', -17, 'Core event collapse: play 0.3 s before the chunk falls', 'fx_crack_<mat> (start)', pitch_var=2),
    'col_crack': S(col_crack, 'material', -17, 'A block drops a damage state (fresh, scuffed, battered)', 'fx_crack_<mat> (last frame)', pitch_var=2),
    'col_chunk_fall': S(col_chunk_fall, 'material', -20, 'Core event collapse: while the chunk is in the air', 'fx_chunk_<mat>'),
    'col_chunk_land': S(col_chunk_land, 'material', -13, 'Collapse rumble: the chunk lands. Volume by block count (1 block 0.5, 6 or more 1.0)', 'data.collapse.land'),
    'col_debris_patter': S(col_debris_patter, 'material', -21, 'Debris after a break or a landing', 'fx_rubble_<mat> (after)', pitch_var=2),
    'col_dust_settle': S(col_dust_settle, 'material', -26, 'Dust cloud', 'fx_dustcloud', vol=0.8),

    'gnd_mound_grow': S(gnd_mound_grow, 'impact', -18, 'Core event mound (Sod Sack)'),
    'wx_wind_loop': S(wx_wind_loop, 'world', -28, 'Wind bed all battle. Volume = wind / 10', 'fx_wind_leaf', loop=True, vol=0.5, pitch_var=0),
    'wx_wind_shift': S(wx_wind_shift, 'world', -21, 'Core event front'),
    'wx_squall_loop': S(wx_squall_loop, 'world', -24, 'Squall wind and rain. Starts at core event squall_round, +3 dB each Squall round, ducks under impacts', 'fx_squall', loop=True, vol=0.6, pitch_var=0,
                        note='Caption [squall]'),
    'wx_squall_bell': S(wx_squall_bell, 'world', -17, 'Core event squall_warning ("Squall in 3", 2, 1)', pitch_var=0, note='Caption [storm in 3 rounds]'),

    'cas_step': S(cas_step, 'world', -18, 'Core event walk: each Stomper step', 'stomper_blue_walk:stomp, stomper_orange_walk:stomp', pitch_var=1.5),
    'cas_steam': S(cas_steam, 'world', -23, 'Steam puff: walk ends, kettle vent', 'fx_kettle_steam (each loop, 1 in 3)', pitch_var=2),
    'cas_thump': S(cas_thump, 'impact', -14, 'Core events castle_drop and thump'),
    'cas_loophole_flap': S(cas_loophole_flap, 'world', -19, 'Loophole Flap drops (core event threaded). Reverse for the lift at event front',
                           'loophole_flap_blue_close, loophole_flap_orange_close (start)',
                           note='The slap is 70 ms in. Start with the animation'),
    'ket_hit': S(ket_hit, 'kettle', -15, 'Core event hit, target kettle'),
    'ket_whistle_loop': S(ket_whistle_loop, 'kettle', -22, 'A Heartkettle at 50% or less. Pitch up to +3 semitones as HP falls', loop=True, vol=0.7, pitch_var=0, gap=4.0,
                          note='Not a tight loop: play, wait 4 s, play again. Caption [kettle whistling]'),
    'ket_crack': S(ket_crack, 'kettle', -16, 'Core event kettle_pop, first beat', 'kettle_pop:crack', pitch_var=0),
    'ket_pop': S(ket_pop, 'kettle', -12, 'Core event kettle_pop', 'kettle_pop:pop', pitch_var=0,
                 note='Lid bang at 0, then the steam scream. In slow motion drop it 3 semitones with the music'),
    'ket_sit_down': S(ket_sit_down, 'kettle', -15, 'The fort folds and sits', 'kettle_pop:sit', pitch_var=0, note='The seat thump is 0.42 s in'),
    'ket_patch': S(ket_patch, 'kettle', -19, 'Core events mend and rebuild: a repair lands', 'fx_trail_mend (end)'),

    'hob_hit_boing': S(hob_hit_boing, 'hob', -17, 'Core event hit, target hob', HOB_ANIM + 'hit:flash', pitch_var=2),
    'hob_tumble_roll': S(hob_tumble_roll, 'hob', -19, 'Core event drop, state tumbled or dropped', HOB_ANIM + 'tumble:fall'),
    'hob_land_thud': S(hob_land_thud, 'hob', -19, 'A Hob lands after a drop, or after a cheer jump', HOB_ANIM + 'land:thud, ' + HOB_ANIM + 'cheer:land', pitch_var=2),
    'hob_bonk': S(hob_bonk, 'hob', -15, 'Core event bonk', HOB_ANIM + 'bonked (frame 0)', pitch_var=0),
    'hob_balloon_inflate': S(hob_balloon_inflate, 'hob', -18, 'Snooze Balloon puffs up', HOB_ANIM + 'bonked:inflate', pitch_var=1,
                             note='0.44 s long: it ends as the lift frame shows'),
    'hob_balloon_float': S(hob_balloon_float, 'hob', -22, 'Snooze Balloon drifts off', HOB_ANIM + 'bonked:lift', pitch_var=1),
    'hob_shove_dig': S(hob_shove_dig, 'hob', -18, 'Core event shove_off and dug_out', HOB_ANIM + 'dig:clear'),

    'doo_pot_lid_clang': S(doo_pot_lid_clang, 'impact', -15, 'Core events lid (set) and lid_block (a shell bounces off)', 'pot_lid_raise:up'),
    'doo_mend_bucket_slosh': S(doo_mend_bucket_slosh, 'world', -19, 'Mend Bucket used (core event mend from the Doodad)'),

    'doo_lid_bounce': S(doo_lid_bounce, 'impact', -16, 'Core event lid_block: a shell bounces off a Pot Lid. Pot Lid going on (lid) keeps doo_pot_lid_clang', pitch_var=1.5),
    'hob_buried_thlup': S(hob_buried_thlup, 'hob', -17, 'Core event buried: a Loophole is dug in on a Hob', pitch_var=1.5),
    'cas_boss_horn': S(cas_boss_horn, 'world', -16, 'Core event boss_phase (Grand Fort, 1-10). Not for the Squall', pitch_var=0, note='Caption [horn]'),
    'wx_front_chime': S(wx_front_chime, 'world', -19, 'Core event front: a new Weather Front. wx_wind_shift can play under it', pitch_var=1, note='Caption [wind chimes]'),
    'hit_threaded_zip': S(hit_threaded_zip, 'impact', -17, 'Core event threaded (and hit with threaded set): a shot slips through a Loophole', pitch_var=1),
    'doo_roller_rumble': S(doo_roller_rumble, 'world', -17, 'Core event roller: the roller rolls out. Also roller_stop and roller_done, 3 semitones down', pitch_var=0),
    'doo_shears_jam': S(doo_shears_jam, 'world', -17, 'Core event shears_jam: the shears stick', pitch_var=1),

    'meta_pennant_stamp': S(meta_pennant_stamp, 'ui', -17, 'A Pennant is earned on Results', 'ui_pennant_earn:ding', pitch_var=0,
                            note='Play 2 semitones higher for each next Pennant'),
    'meta_block_place': S(meta_block_place, 'ui', -20, 'Workshop block placed. Reverse for erase', pitch_var=2),
}
