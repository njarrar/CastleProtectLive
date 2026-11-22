"""Listen-check by eye. Decodes every shipped file and draws its waveform and
spectrogram, then tests for clipping, silence, DC, harsh highs and length drift.
"""
import os
import numpy as np
from PIL import Image, ImageDraw

SR = 48000


def spectrogram(x, w, h, fmax=12000, win=1024):
    """Log-magnitude picture, linear in time, mel-like in frequency. -80 dB is black."""
    n = len(x)
    hop = max(1, (n - win) // max(1, w * 2)) if n > win else 1
    hop = max(hop, 32)
    pad = np.concatenate([np.zeros(win // 2), x, np.zeros(win)])
    frames = max(1, (len(pad) - win) // hop)
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    S = np.abs(np.fft.rfft(pad[idx] * np.hanning(win), axis=1)) / (win / 4)
    f = np.fft.rfftfreq(win, 1 / SR)
    mel = lambda q: np.log1p(q / 700.0)
    edges = np.expm1(np.linspace(mel(60), mel(fmax), h + 1)) * 700
    img = np.zeros((h, frames))
    for i in range(h):
        sel = (f >= edges[i]) & (f < max(edges[i + 1], edges[i] + f[1]))
        if sel.any():
            img[h - 1 - i] = S[:, sel].max(axis=1)
    dbv = 20 * np.log10(np.maximum(img, 1e-5))
    v = np.clip((dbv + 80) / 80, 0, 1)
    cols = np.clip(np.round(np.linspace(0, frames - 1, w)).astype(int), 0, frames - 1)
    v = v[:, cols]
    rgb = np.stack([np.clip(v * 3 - 1, 0, 1), np.clip(v * 3 - 2, 0, 1) + np.clip(0.6 - np.abs(v * 3 - 1.2), 0, 0.3), np.clip(1.2 - np.abs(v * 3 - 0.9), 0, 1) * (v > 0.02)], axis=2)
    return (rgb * 255).astype(np.uint8)


def wave_img(x, w, h):
    img = np.full((h, w, 3), 18, np.uint8)
    n = len(x)
    edges = np.linspace(0, n, w + 1).astype(int)
    mid = h // 2
    for i in range(w):
        seg = x[edges[i]:max(edges[i] + 1, edges[i + 1])]
        lo, hi = seg.min(), seg.max()
        a = int(np.clip(mid - hi * mid, 0, h - 1))
        b = int(np.clip(mid - lo * mid, 0, h - 1))
        hot = max(abs(lo), abs(hi)) >= 0.985
        img[a:b + 1, i] = (255, 60, 60) if hot else (120, 220, 140)
    img[mid, :, :] = np.maximum(img[mid], 50)
    for lvl in (0.5, -0.5):
        img[int(mid - lvl * mid), ::4] = 70
    return img


def cell(x, label, w=300, hw=44, hs=96):
    c = np.full((hw + hs + 16, w + 6, 3), 0, np.uint8)
    c[14:14 + hw, 3:3 + w] = wave_img(x, w, hw)
    c[16 + hw:16 + hw + hs, 3:3 + w] = spectrogram(x, w, hs)
    im = Image.fromarray(c)
    ImageDraw.Draw(im).text((4, 1), label, fill=(240, 240, 240))
    return im


def sheet(cells, cols, path):
    cw, ch = cells[0].size
    rows = (len(cells) + cols - 1) // cols
    out = Image.new('RGB', (cw * cols, ch * rows))
    for i, c in enumerate(cells):
        out.paste(c, ((i % cols) * cw, (i // cols) * ch))
    out.save(path, optimize=True)


def checks(s, x_ogg, x_m4a):
    """Return a list of problems for one sound."""
    bad = []
    for name, x in (('ogg', x_ogg), ('m4a', x_m4a)):
        mono = x.mean(axis=0)
        pk = np.max(np.abs(x))
        if pk >= 0.98:
            bad.append(f'{name}: clips ({pk:.3f})')
        if pk < 0.03:
            bad.append(f'{name}: nearly silent ({pk:.3f})')
        if abs(mono.mean()) > 0.01:
            bad.append(f'{name}: DC offset {mono.mean():.3f}')
        drift = abs(x.shape[1] - s['samples'])
        lim = 64 if name == 'ogg' else 2200       # AAC pads to whole frames; the manifest holds the true length
        if drift > lim:
            bad.append(f'{name}: length off by {drift} samples')
        if s['loop'] and name == 'ogg' and drift != 0:
            bad.append(f'ogg loop: length off by {drift} samples')
        env = np.abs(mono)
        thr = pk * 0.02
        on = np.nonzero(env > thr)[0]
        lead = on[0] / SR if len(on) else 9
        lead_ok = 0.06 if name == 'm4a' else 0.03
        if not s['loop'] and lead > lead_ok and s['kind'] in ('sfx', 'bark'):
            bad.append(f'{name}: {lead * 1000:.0f} ms of silence at the start')
        if s['kind'] in ('sfx', 'bark') and not s['loop'] and len(on) > 1:
            gaps = np.diff(on) / SR
            if gaps.max() > 0.3:
                bad.append(f'{name}: {gaps.max():.2f} s hole in the middle')
    # harsh: too much of the energy in the ear's sore spot, 2.5 to 6 kHz, in a loud or long sound
    mono = x_ogg.mean(axis=0)
    X = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(len(mono), 1 / SR)
    tot = X.sum() + 1e-12
    sore = X[(f > 2500) & (f < 6000)].sum() / tot
    top = X[f > 9000].sum() / tot
    low = X[f < 200].sum() / tot
    s_stats = dict(sore=sore, top=top, low=low)
    if sore > 0.6 and s['duration'] > 0.25 and s['lufs'] > -21:
        bad.append(f'harsh: {sore * 100:.0f}% of energy in 2.5 to 6 kHz')
    if low > 0.6:
        bad.append(f'phone speaker: {low * 100:.0f}% of energy under 200 Hz')
    return bad, s_stats


def run(items, out_dir, qa_dir, decode):
    os.makedirs(qa_dir, exist_ok=True)
    for f in os.listdir(qa_dir):
        if f.endswith('.png') or f == 'report.txt':
            os.remove(os.path.join(qa_dir, f))
    groups, lines, nbad = {}, [], 0
    lines.append(f"{'id':26s} {'s':>6s} {'lufs':>6s} {'peak':>6s} {'ogg pk':>7s} {'m4a pk':>7s} {'<200':>5s} {'2.5-6k':>6s} {'>9k':>5s}  problems")
    for s in items:
        xo = decode(os.path.join(out_dir, s['files']['ogg']), s['channels'])
        xm = decode(os.path.join(out_dir, s['files']['m4a']), s['channels'])
        bad, st = checks(s, xo, xm)
        nbad += len(bad)
        lines.append(f"{s['id']:26s} {s['duration']:6.2f} {s['lufs']:6.1f} {s['peak_db']:6.1f} {np.abs(xo).max():7.3f} {np.abs(xm).max():7.3f} "
                     f"{st['low'] * 100:5.0f} {st['sore'] * 100:6.0f} {st['top'] * 100:5.0f}  {'; '.join(bad) if bad else 'ok'}")
        mono = xo.mean(axis=0)
        if s['kind'] in ('music', 'sting'):
            w = 1500 if s['kind'] == 'music' else 700
            c = cell(mono, f"{s['id']}  {s['duration']} s  {s['lufs']} LUFS  peak {s['peak_db']} dB", w, 70, 180)
            c.save(os.path.join(qa_dir, f"music_{s['id']}.png"), optimize=True)
            if s['loop']:     # the seam: last 1.5 s then first 1.5 s
                k = int(1.5 * SR)
                seam = np.concatenate([mono[-k:], mono[:k]])
                cell(seam, f"{s['id']} loop seam: end | start", 600, 70, 180).save(os.path.join(qa_dir, f"seam_{s['id']}.png"), optimize=True)
        else:
            key = 'barks' if s['kind'] == 'bark' else 'sfx_' + s['bus']
            if s['loop']:
                mono = np.concatenate([mono, mono])       # show the seam in the middle
            groups.setdefault(key, []).append(cell(mono, f"{s['id']} {s['duration']}s {s['lufs']}" + (' x2' if s['loop'] else '')))
    for key, cells in groups.items():
        sheet(cells, 6 if key == 'barks' else 4, os.path.join(qa_dir, f'{key}.png'))
    # the three layers summed, as the game plays them at full Peril
    st = {s['layer']: s for s in items if s.get('layer')}
    if len(st) == 3:
        xs = [decode(os.path.join(out_dir, st[k]['files']['ogg']), 2) for k in ('base', 'stir', 'peril')]
        n = min(x.shape[1] for x in xs)
        full = sum(x[:, :n] for x in xs)
        import dsp
        l, pk = dsp.lufs(full), np.abs(full).max()
        lines.append(f"\nRegion 1, all three layers summed: {l:.1f} LUFS, peak {pk:.3f}" + ('' if pk < 0.999 else '  CLIPS'))
        nbad += pk >= 0.999
        cell(full.mean(axis=0), f'Region 1 Base + Stir + Peril  {l:.1f} LUFS  peak {pk:.2f}', 1500, 70, 180).save(os.path.join(qa_dir, 'music_r1_all_layers.png'), optimize=True)
    lines.append(f'\n{nbad} problem(s)')
    with open(os.path.join(qa_dir, 'report.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'QA: {nbad} problem(s). Pictures and report in {qa_dir}')
    return nbad
