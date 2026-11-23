"""Small DSP kit for the Castle Protect sound builder. numpy only.

Every sound is made from maths: sines, noise from a seeded generator, and
filters done in the frequency domain. No samples are loaded from anywhere.
"""
import zlib
import numpy as np

SR = 48000
TAU = 2 * np.pi


def rng(name):
    """Seeded generator, so the same id always gives the same sound."""
    return np.random.default_rng(zlib.crc32(name.encode()))


def n_of(dur):
    return int(round(dur * SR))


def tt(dur):
    return np.arange(n_of(dur)) / SR


def db(x):
    return 10 ** (x / 20)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def note(name):
    """'F#4' -> midi number."""
    p = NOTE[name[0]]
    rest = name[1:]
    if rest[0] == '#':
        p += 1
        rest = rest[1:]
    elif rest[0] == 'b':
        p -= 1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + p


# ---------- envelopes ----------

def decay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def ar(n, a, r):
    """Linear attack, hold, cosine release."""
    e = np.ones(n)
    na = min(n, max(1, n_of(a)))
    nr = min(n, max(1, n_of(r)))
    e[:na] *= np.linspace(0, 1, na, endpoint=False)
    e[n - nr:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nr))
    return e


def fade(x, a=0.002, r=0.01):
    return x * ar(x.shape[-1], a, r)


def curve(points, n):
    """Piecewise line through (pos 0..1, value) points, n samples."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return np.interp(np.linspace(0, 1, n), xs, ys)


def smooth(x, ms, circular=False):
    k = max(1, n_of(ms / 1000))
    if k <= 1:
        return x
    w = np.hanning(k + 2)[1:-1]
    w /= w.sum()
    mode = 'wrap' if circular else 'edge'
    return np.convolve(np.pad(x, (k // 2, k - k // 2 - 1), mode=mode), w, mode='valid')


# ---------- sources ----------

def osc(freq, n=None, harm=(1.0,), phase0=0.0):
    """Sine bank. freq is a number or a per-sample array."""
    if np.isscalar(freq):
        freq = np.full(n, float(freq))
    ph = phase0 + TAU * np.cumsum(freq) / SR
    out = np.zeros(len(freq))
    for k, a in enumerate(harm, start=1):
        if a:
            out += a * np.sin(k * ph) * (k * freq < SR * 0.45)
    return out


def glide(f0, f1, n, shape=1.0):
    """Exponential pitch glide from f0 to f1."""
    x = np.linspace(0, 1, n) ** shape
    return f0 * (f1 / f0) ** x


def modal(parts, dur, r=None):
    """Sum of ringing sines: (freq, amp, tau). Wood, stone, metal, bells."""
    n = n_of(dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, a, tau in parts:
        ph = r.uniform(0, TAU) if r is not None else 0.0
        out += a * np.exp(-t / tau) * np.sin(TAU * f * t + ph)
    return out


def white(n, r):
    return r.standard_normal(n)


# ---------- filters (frequency domain, zero phase) ----------

def _resp(f, lo, hi, order):
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    return g


def filt(x, lo=None, hi=None, order=2, circular=False):
    """Butterworth-shaped band filter. lo = high-pass corner, hi = low-pass corner."""
    n = len(x)
    m = n if circular else n + SR // 10
    X = np.fft.rfft(x, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    return np.fft.irfft(X * _resp(f, lo, hi, order), m)[:n]


def peak(x, f0, q, gain=1.0, circular=False):
    """Add a resonant bump at f0."""
    n = len(x)
    m = n if circular else n + SR // 10
    X = np.fft.rfft(x, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    g = 1 + gain * q / np.sqrt(1 + (q * (f / f0 - f0 / np.maximum(f, 1e-6))) ** 2)
    return np.fft.irfft(X * g, m)[:n]


def reson(x, f0, q, circular=False):
    """Pure band-pass resonator at f0."""
    n = len(x)
    m = n if circular else n + SR // 10
    X = np.fft.rfft(x, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    g = 1 / np.sqrt(1 + (q * (f / f0 - f0 / np.maximum(f, 1e-6))) ** 2)
    return np.fft.irfft(X * g, m)[:n]


def low_shelf(x, gain_db=-6.0, f_lo=110.0, f_hi=260.0, circular=False):
    """Turn the deep end down: gain_db under f_lo, flat over f_hi. Phone speakers
    cannot play it, and it eats headroom the knock layer needs."""
    n = len(x)
    m = n if circular else n + SR // 10
    X = np.fft.rfft(x, m)
    f = np.maximum(np.fft.rfftfreq(m, 1 / SR), 1.0)
    pos = np.clip((np.log(f) - np.log(f_lo)) / (np.log(f_hi) - np.log(f_lo)), 0, 1)
    return np.fft.irfft(X * 10 ** (gain_db * (1 - pos) / 20), m)[:n]


def high_shelf(x, gain_db=-6.0, f_lo=3800.0, f_hi=5500.0, circular=False):
    """Shelf the top end: flat under f_lo, gain_db above f_hi (damps harsh phone highs)."""
    n = len(x)
    m = n if circular else n + SR // 10
    X = np.fft.rfft(x, m)
    f = np.maximum(np.fft.rfftfreq(m, 1 / SR), 1.0)
    pos = np.clip((np.log(f) - np.log(f_lo)) / (np.log(f_hi) - np.log(f_lo)), 0, 1)
    return np.fft.irfft(X * 10 ** (gain_db * pos / 20), m)[:n]


def overlap_wrap(x, tail_samples):
    """Seamless loop wrap: crossfade extra rendered tail back over sample 0.

    Expects `x` of shape `(..., loop_len + tail_samples)` where the last
    `tail_samples` samples continue naturally past `loop_len - 1`. Uses an
    equal-power sin/cos crossfade across `[0, tail_samples)` so sample `0`
    equals sample `loop_len` (zero waveform pop and flat edge RMS).
    """
    t = int(tail_samples)
    if t <= 0:
        return x.copy()
    total = x.shape[-1]
    if total <= t:
        raise ValueError(f'overlap_wrap: signal length {total} must exceed tail_samples {t}')
    n = total - t
    span = min(t, n)
    out = x[..., :n].copy()
    u = np.arange(span, dtype=float) / span
    w_head = np.sin(0.5 * np.pi * u)
    w_tail = np.cos(0.5 * np.pi * u)
    out[..., :span] = out[..., :span] * w_head + x[..., n:n + span] * w_tail
    return out


def noise(dur, r, lo=None, hi=None, order=2):
    return filt(white(n_of(dur), r), lo, hi, order)


def loop_noise(dur, r, lo=None, hi=None, order=2):
    """Noise that loops with no seam (the filter wraps round)."""
    return filt(white(n_of(dur), r), lo, hi, order, circular=True)


def tv_filter(x, gain_fn, win=1024):
    """Filter that changes over time. gain_fn(freqs, times) -> [frames, bins]."""
    hop = win // 2
    n = len(x)
    pad = np.concatenate([np.zeros(hop), x, np.zeros(win + hop)])
    w = np.sin(np.pi * (np.arange(win) + 0.5) / win)  # sqrt-hann pair
    frames = 1 + (len(pad) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    S = np.fft.rfft(pad[idx] * w, axis=1)
    f = np.fft.rfftfreq(win, 1 / SR)
    times = (np.arange(frames) * hop) / SR
    S *= gain_fn(f[None, :], times[:, None])
    y = np.fft.irfft(S, win, axis=1) * w
    out = np.zeros(len(pad))
    np.add.at(out, idx, y)
    return out[hop:hop + n]


def sweep_noise(dur, r, f_points, q=2.0):
    """Noise through a band that slides along f_points [(pos, hz), ...]."""
    n = n_of(dur)
    xs = [p[0] * dur for p in f_points]
    ys = [np.log(p[1]) for p in f_points]

    def g(f, t):
        fc = np.exp(np.interp(t, xs, ys))
        ff = np.maximum(f, 1.0)
        return 1 / np.sqrt(1 + (q * (ff / fc - fc / ff)) ** 2)
    return tv_filter(white(n, r), g)


# ---------- space, level ----------

def room_ir(r, dur=0.5, tau=0.12, hi=5000, pre=0.008):
    """A small made-up room: decaying filtered noise."""
    n = n_of(dur)
    ir = white(n, r) * decay(n, tau)
    ir = filt(ir, 200, hi)
    ir[: n_of(pre)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    return ir


def convolve(x, ir, circular=False):
    if circular:
        n = x.shape[-1]
        return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    m = x.shape[-1] + len(ir) - 1
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)


def verb(x, r, mix=0.15, dur=0.4, tau=0.1, hi=5000):
    """Dry plus a little room. Output is longer than the input by the tail."""
    ir = room_ir(r, dur, tau, hi)
    wet = convolve(x, ir)
    out = np.zeros(len(wet))
    out[: len(x)] = x
    return out + mix * wet


def place(buf, sig, at, gain=1.0):
    """Add sig into buf at sample index at (mono into mono)."""
    at = int(at)
    if at >= buf.shape[-1] or at + len(sig) <= 0:
        return
    s0 = max(0, -at)
    e = min(len(sig), buf.shape[-1] - at)
    buf[..., at + s0: at + e] += gain * sig[s0:e]


def mix(*parts):
    """Sum signals of unlike length. Each part is sig or (sig, start_s) or (sig, start_s, gain)."""
    items = []
    for p in parts:
        if isinstance(p, tuple):
            sig, at = p[0], p[1]
            g = p[2] if len(p) > 2 else 1.0
        else:
            sig, at, g = p, 0.0, 1.0
        items.append((sig, n_of(at), g))
    n = max(a + len(s) for s, a, _ in items)
    out = np.zeros(n)
    for s, a, g in items:
        out[a:a + len(s)] += g * s
    return out


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def limiter(x, ceiling=0.9, win_ms=4.0, circular=False):
    """Look-ahead peak limiter. Keeps peaks under the ceiling with no hard clip."""
    mono = np.max(np.abs(x), axis=0) if x.ndim > 1 else np.abs(x)
    k = max(3, n_of(win_ms / 1000) | 1)
    padded = np.pad(mono, (k // 2, k // 2), mode='wrap' if circular else 'edge')
    # running max over the window
    win = np.lib.stride_tricks.sliding_window_view(padded, k)
    env = win.max(axis=1)
    g = np.minimum(1.0, ceiling / np.maximum(env, 1e-9))
    g = smooth(g, win_ms, circular=circular)
    g = np.minimum(g, ceiling / np.maximum(mono, 1e-9))
    return x * g


def trim(x, thresh_db=-60.0, tail=0.01):
    """Cut dead air off the end, keep a short fade."""
    a = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=0)
    idx = np.nonzero(a > db(thresh_db) * max(a.max(), 1e-9))[0]
    if len(idx) == 0:
        return x
    end = min(x.shape[-1], idx[-1] + n_of(tail))
    y = x[..., :end].copy()
    nr = min(end, n_of(tail))
    y[..., end - nr:] *= np.linspace(1, 0, nr)
    return y


# ---------- loudness (ITU BS.1770 style) ----------

_K1_B = (1.53512485958697, -2.69169618940638, 1.19839281085285)
_K1_A = (1.0, -1.69065929318241, 0.73248077421585)
_K2_B = (1.0, -2.0, 1.0)
_K2_A = (1.0, -1.99004745483398, 0.99007225036621)


def _biquad_resp(b, a, w):
    z = np.exp(-1j * w)
    return (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)


def k_weight(x):
    n = x.shape[-1]
    X = np.fft.rfft(x, n)
    w = TAU * np.fft.rfftfreq(n, 1 / SR) / SR
    H = _biquad_resp(_K1_B, _K1_A, w) * _biquad_resp(_K2_B, _K2_A, w)
    return np.fft.irfft(X * H, n)


def lufs(x):
    """Gated loudness. Short sounds use one block as long as the sound."""
    if x.ndim == 1:
        x = x[None, :]
    y = np.stack([k_weight(c) for c in x])
    n = y.shape[-1]
    blk = min(n, n_of(0.4))
    hop = max(1, blk // 4)
    starts = np.arange(0, max(1, n - blk + 1), hop)
    cs = np.concatenate([np.zeros((y.shape[0], 1)), np.cumsum(y ** 2, axis=1)], axis=1)
    ms = ((cs[:, starts + blk] - cs[:, starts]) / blk).sum(axis=0)
    l = -0.691 + 10 * np.log10(np.maximum(ms, 1e-12))
    keep = l > -70
    if not keep.any():
        return -70.0
    rel = -0.691 + 10 * np.log10(ms[keep].mean()) - 10
    keep2 = keep & (l > rel)
    return float(-0.691 + 10 * np.log10(ms[keep2].mean()))


def normalise(x, target_lufs, ceiling_db=-2.0, circular=False):
    """Gain to the target loudness, then hold peaks under the ceiling."""
    g = db(target_lufs - lufs(x))
    y = x * g
    pk = np.max(np.abs(y))
    c = db(ceiling_db)
    if pk > c:
        if pk > c * db(4):          # far over: turn down so the limiter only shaves 4 dB
            y *= c * db(4) / pk
        y = limiter(y, c, circular=circular)
    return y
