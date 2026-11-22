// Scene helpers: skies, layered hills, terrain with strata
import * as L from './lib.mjs';
const { C, rr, circ, ell, path, line, g, stitch, puff, f, hillPath, id } = L;

export function sky(w, h, top, bot, gid = id('sky')) {
  return {
    defs: `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`,
    body: rr(0, 0, w, h, 0, `url(#${gid})`),
  };
}

// a quilted hill layer: fill, darker seam stitches, patch shapes
export function quiltHill(x0, x1, yb, tops, fill, o = {}) {
  const { seam = C.ink, patches = [], op = 1, outline = true, sw = 3 } = o;
  const d = hillPath(x0, x1, yb, tops);
  let s = path(d, fill, { stroke: outline ? C.ink : null, sw, op });
  let inner = '';
  for (const p of patches) inner += p;
  if (inner) s += L.clipped(path(d, '#000'), inner);
  return s;
}

// ground cross-section: grass cap + loam + strata + pebbles
export function ground(x0, x1, yb, tops, o = {}) {
  const { grass = '#7CC46A', grassD = '#5AA555', loam = '#9A6440', loamD = '#7A4A2E', rock = '#8A7A6E', seed = 9, pebble = '#C9A27A' } = o;
  const R = L.rng(seed);
  const d = hillPath(x0, x1, yb, tops);
  let inner = rr(x0, 0, x1 - x0, yb, 0, loam);
  // strata bands following the surface
  const off = (k) => tops.map(([x, y]) => [x, y + k]);
  inner += path(hillPath(x0, x1, yb, off(70)), loamD, { op: .55 });
  inner += path(hillPath(x0, x1, yb, off(170)), rock, { op: .9 });
  inner += stitch(L.hillSurface(x0, x1, off(120)), C.ink, 2, .18, '8 8');
  for (let i = 0; i < 60; i++) {
    const px = x0 + R() * (x1 - x0), py = yb - R() * 400;
    inner += ell(px, py, 4 + R() * 7, 3 + R() * 4, pebble, { op: .55 });
  }
  inner += path(L.hillSurface(x0, x1, tops), 'none', { stroke: grass, sw: 34 });
  inner += path(L.hillSurface(x0, x1, off(14)), 'none', { stroke: grassD, sw: 6, op: .7 });
  inner += stitch(L.hillSurface(x0, x1, off(4)), '#FFFFFF', 2.5, .55, '7 7');
  return L.clipped(path(d, '#000'), inner) + path(L.hillSurface(x0, x1, tops), 'none', { stroke: C.ink, sw: 4 });
}

export function sunDisc(x, y, r, col = '#FFF3C4') {
  return circ(x, y, r * 1.5, col, { op: .35 }) + circ(x, y, r, col, { stroke: C.ink, sw: 3 }) + path(`M${x - r * .5} ${y - r * .3} Q${x - r * .3} ${y - r * .6} ${x} ${y - r * .65}`, 'none', { stroke: '#FFFFFF', sw: 4, op: .8 });
}

export function tree(x, y, s = 1, col = '#5AA555', kind = 'round') {
  let b = rr(-4, -30, 8, 30, 3, '#7A4A2E', { stroke: C.ink, sw: 2.5 });
  if (kind === 'pine') b += path('M0 -90 L22 -26 L-22 -26 Z', col, { stroke: C.ink, sw: 3 }) + path('M0 -70 L14 -40 M0 -70 L-6 -50', 'none', { stroke: '#FFFFFF', sw: 2, op: .3 });
  else b += circ(0, -46, 22, col, { stroke: C.ink, sw: 3 }) + circ(-8, -54, 6, '#FFFFFF', { op: .25 });
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

export function windFlag(x, y, s = 1, v = 4, col = C.paper) {
  // pole + streaming cloth; length grows with wind
  const len = 30 + Math.abs(v) * 8;
  let b = line(0, 0, 0, -120, C.ink, 5) + circ(0, -122, 5, C.br, { stroke: C.ink, sw: 2 });
  b += path(`M0 -116 C${len * .3} -124 ${len * .6} -106 ${len} -112 L${len - 10} -100 L${len} -88 C${len * .6} -84 ${len * .3} -100 0 -90 Z`, col, { stroke: C.ink, sw: 3 });
  b += path(`M8 -104 L${len - 16} -100`, 'none', { stroke: C.danger, sw: 4 });
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

export function leaves(x, y, n, R, col = '#8BCB3A') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const lx = x + R() * 300, ly = y + R() * 160;
    s += path(`M${lx - 40} ${ly + 4} Q${lx - 20} ${ly - 6} ${lx} ${ly}`, 'none', { stroke: '#FFFFFF', sw: 2.5, op: .6 });
    s += g(ell(0, 0, 7, 3.5, col, { stroke: C.ink, sw: 1.5 }), `translate(${f(lx + 6)} ${f(ly)}) rotate(${f(R() * 90 - 45)})`);
  }
  return s;
}

export function balloon(x, y, s = 1, col = '#BFA8F0', square = false) {
  let b = path('M0 0 C-4 -20 4 -30 0 -48', 'none', { stroke: C.ink, sw: 2 });
  b += square ? rr(-22, -96, 44, 46, 6, col, { stroke: C.ink, sw: 3 }) + line(-12, -73, 12, -73, C.ink, 2) + circ(0, -73, 3, C.good, { stroke: C.ink, sw: 1 }) : ell(0, -72, 22, 26, col, { stroke: C.ink, sw: 3 }) + path('M-4 -48 L4 -48 L0 -44 Z', col, { stroke: C.ink, sw: 2 });
  b += path('M-10 -84 Q-6 -92 2 -94', 'none', { stroke: '#FFFFFF', sw: 3.5, op: .7 });
  b += L.text(18, -98, 'z', { size: 18, weight: 700, fill: C.ink }) + L.text(30, -112, 'Z', { size: 24, weight: 700, fill: C.ink });
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

export function shellPot(x, y, s = 1, rot = 0) {
  let b = circ(0, 0, 12, C.soot, { stroke: C.ink, sw: 2.5 }) + rr(-7, -15, 14, 6, 2, C.br, { stroke: C.ink, sw: 2 }) + path('M0 -15 Q4 -24 10 -22', 'none', { stroke: C.ink, sw: 2 }) + L.star4(11, -23, 5, C.gold) + circ(-4, -4, 3, '#FFFFFF', { op: .45 });
  return g(b, `translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${f(s)})`);
}

// dotted arc from p0 with velocity, gravity, wind; returns points
export function arcPts(x0, y0, vx, vy, gy, wx, n, dt) {
  const pts = [];
  let x = x0, y = y0;
  for (let i = 0; i < n; i++) { pts.push([x, y]); x += vx * dt; y += vy * dt; vy += gy * dt; vx += wx * dt; }
  return pts;
}
