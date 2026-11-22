// Posed Hob for game sprites. Same body as lib.mjs hob(), plus poses, faces and team parts.
// Origin = feet centre. The Hob faces right; the game flips it for the right-hand fort.
import * as L from './lib.mjs';
import { ROSTER } from './sprite-roster.mjs';
const { C, rr, circ, ell, path, line, g, star4, shade, clipped, f } = L;
const ink = C.ink;

export const HOBS = {
  marge: { i: 0, patch: [-15, -70] },
  thumper: { i: 1, patch: [-15, -69] },
  quill: { i: 2, patch: [-11, -78] },
  jax: { i: 3, patch: [-22, -73] },
  nan: { i: 4, patch: [-22, -73] },
  grub: { i: 5, patch: [-17, -62] },
  bobbin: { i: 6, patch: [-13, -71.5] },
  hetty: { i: 7, patch: [-13, -79] },
};
for (const k of Object.keys(HOBS)) Object.assign(HOBS[k], ROSTER[HOBS[k].i]);

export const TEAMS = {
  blue: { col: C.you, dark: C.youD, light: C.youL, hatch: false },
  orange: { col: C.rival, dark: C.rivalD, light: C.rivalL, hatch: true },
};

// pose table: each pose has 2 or 3 frames
export const POSES = {
  idle: [
    { face: 'happy' },
    { face: 'happy', sy: .97 },
    { face: 'blink' },
  ],
  aim: [
    { face: 'grit', toolRot: -12, hf: [23, -32], lean: -2 },
    { face: 'grit', toolRot: -18, hf: [23, -35], lean: -4, hb: [-22, -30] },
  ],
  fire: [
    { face: 'shout', toolRot: -12, hf: [27, -34], dx: -5, lean: -5, sy: .96, puff: true },
    { face: 'shout', toolRot: -18, hf: [24, -33], dx: -2, lean: -2 },
  ],
  hit: [
    { face: 'ouch', sy: .86, sx: 1.08, lean: -7, hf: [24, -40], hb: [-25, -40], toolRot: 14, stars: 0 },
    { face: 'ouch', sy: .93, sx: 1.04, lean: -4, hf: [23, -36], hb: [-24, -36], toolRot: 8, stars: 1 },
  ],
  bonked: [
    { face: 'bonk', tool: false, hf: [20, -22], hb: [-21, -22], balloon: 0, dy: -2 },
    { face: 'bonk', tool: false, hf: [21, -21], hb: [-22, -21], balloon: 1, dy: -8, lean: 3 },
  ],
  cheer: [
    { face: 'cheer', sy: .93, hf: [26, -40], hb: [-25, -42], toolRot: 4 },
    { face: 'cheer', dy: -10, hatDy: -9, hf: [30, -54], hb: [-26, -56], toolRot: 12, sy: 1.03 },
  ],
};

function faceSvg(kind, skin) {
  let b = '';
  const nose = ell(10, -58, 4.5, 3.4, shade(skin, -.12), { stroke: ink, sw: 2 });
  const blush = circ(-4, -55, 4, C.blush, { op: .55 }) + circ(19, -55, 3.5, C.blush, { op: .55 });
  const eyes = ell(2, -65, 3.2, 4.2, ink) + ell(15, -65, 3.2, 4.2, ink) + circ(3, -66.5, 1.2, '#FFF') + circ(16, -66.5, 1.2, '#FFF');
  switch (kind) {
    case 'bonk':
      return path('M1 -66 m-3 -3 l6 6 m0 -6 l-6 6', 'none', { stroke: ink, sw: 2.5 }) + path('M14 -66 m-3 -3 l6 6 m0 -6 l-6 6', 'none', { stroke: ink, sw: 2.5 }) + nose + ell(9, -50, 3.5, 3, ink);
    case 'grit':
      return eyes + nose + blush + path('M4 -50 L16 -50', 'none', { stroke: ink, sw: 2.5 }) + path('M-1 -72 L6 -70 M12 -70 L19 -72', 'none', { stroke: ink, sw: 2.5 });
    case 'shout':
      return eyes + nose + blush + ell(10, -49, 4.5, 5, ink) + path('M7.5 -47 Q10 -45 12.5 -47', 'none', { stroke: C.blush, sw: 2 });
    case 'blink':
      return path('M-1 -65 L5 -65 M12 -65 L18 -65', 'none', { stroke: ink, sw: 2.5 }) + nose + blush + path('M4 -51 Q10 -46 16 -51', 'none', { stroke: ink, sw: 2.5 });
    case 'ouch':
      return path('M-1 -68 L5 -65 L-1 -62 M19 -68 L13 -65 L19 -62', 'none', { stroke: ink, sw: 2.5 }) + nose + blush + path('M3 -50 q2.5 -3 5 0 t5 0 t5 0', 'none', { stroke: ink, sw: 2.5 });
    case 'cheer':
      return path('M-2 -64 Q2 -69 6 -64 M11 -64 Q15 -69 19 -64', 'none', { stroke: ink, sw: 2.5 }) + nose + blush + path('M3 -52 Q10 -41 17 -52 Z', ink, { stroke: ink, sw: 2 }) + path('M7 -47.5 Q10 -45 13 -47.5', 'none', { stroke: C.blush, sw: 2.2 });
    default:
      return eyes + nose + blush + path('M4 -51 Q10 -46 16 -51', 'none', { stroke: ink, sw: 2.5 });
  }
}

// little z shapes, drawn as paths so no font is needed
const zed = (x, y, k) => path(`M${f(x)} ${f(y)} h${f(8 * k)} l${f(-8 * k)} ${f(9 * k)} h${f(8 * k)}`, 'none', { stroke: ink, sw: 2.6 });

export function snoozeBalloon(x, y, o = {}) {
  const { tag = false, sway = 0, str = 46 } = o;
  let b = path(`M0 0 C${f(-5 + sway)} ${f(-str * .4)} ${f(5 + sway)} ${f(-str * .7)} ${f(sway)} ${f(-str)}`, 'none', { stroke: ink, sw: 2 });
  if (tag) b += g(path('M0 -6 L5 0 L0 6 L-5 0 Z', C.rival, { stroke: ink, sw: 1.8 }) + line(-2, 0, 2, 0, '#FFFFFF', 1.2), `translate(${f(sway * .4 + 1)} ${f(-str * .45)})`);
  const cy = -str - 26;
  b += path(`M${f(sway - 4)} ${f(-str)} L${f(sway + 4)} ${f(-str)} L${f(sway)} ${f(-str - 5)} Z`, '#BFA8F0', { stroke: ink, sw: 2 });
  b += ell(sway, cy, 22, 26, '#BFA8F0', { stroke: ink, sw: 3 });
  b += clipped(ell(sway, cy, 22, 26, '#000'), ell(sway + 10, cy + 8, 22, 26, ink, { op: .12 }));
  b += path(`M${f(sway - 11)} ${f(cy - 11)} Q${f(sway - 7)} ${f(cy - 19)} ${f(sway + 1)} ${f(cy - 21)}`, 'none', { stroke: '#FFFFFF', sw: 3.5, op: .75 });
  b += zed(sway + 24, cy - 22, .8) + zed(sway + 33, cy - 38, 1.1);
  return g(b, `translate(${f(x)} ${f(y)})`);
}

export function posedHob(key, teamKey, p = {}) {
  const def = HOBS[key], o = def.o, team = TEAMS[teamKey];
  const { face = 'happy', toolRot = 0, hf = [20, -27], hb = [-21, -28], dx = 0, dy = 0, sx = 1, sy = 1, lean = 0, hatDy = 0, tool = true, stars = null, balloon = null, puff = false } = p;
  const skin = o.skin, coat = o.coat, hand = o.hands || skin;
  const s = def.scale || 1;
  let b = '';
  // boots
  b += rr(-16, -11, 14, 11, 5, '#4A3328', { stroke: ink, sw: 3 }) + rr(3, -11, 15, 11, 5, '#4A3328', { stroke: ink, sw: 3 });
  // back parts and back hand
  b += (o.back || '') + circ(hb[0], hb[1], 6.5, hand, { stroke: ink, sw: 3 });
  // body
  const bodyD = 'M-20 -12 C-26 -26 -22 -46 0 -48 C22 -46 26 -26 20 -12 C14 -7 -14 -7 -20 -12 Z';
  b += path(bodyD, coat, { stroke: ink, sw: 3 });
  b += clipped(path(bodyD, '#000'), path('M4 -50 C28 -40 26 -16 14 -8 L40 -8 L40 -50 Z', ink, { op: .2 }) + rr(-12, -36, 11, 11, 2, shade(coat, .25), { extra: ' transform="rotate(-8 -6 -30)"' }) + rr(-12, -36, 11, 11, 2, 'none', { stroke: C.paper, sw: 1.4, extra: ' stroke-dasharray="2.5 2.5" transform="rotate(-8 -6 -30)"' }));
  if (o.bodyAdd) b += clipped(path(bodyD, '#000'), o.bodyAdd) + path(bodyD, 'none', { stroke: ink, sw: 3 });
  b += circ(3, -30, 2, C.paper, { op: .8 }) + circ(3, -21, 2, C.paper, { op: .8 });
  // scarf: the team part. Orange gets white hatch lines so it reads without colour
  const sc1 = 'M-17 -47 Q0 -40 17 -47 L17 -42 Q0 -35 -17 -42 Z', sc2 = 'M-12 -42 L-16 -28 L-8 -30 L-6 -40 Z';
  b += path(sc1, team.col, { stroke: ink, sw: 2.5 }) + path(sc2, team.col, { stroke: ink, sw: 2.5 });
  if (team.hatch) {
    let h = '';
    for (let x = -24; x < 24; x += 5.5) h += line(x, -34, x + 8, -50, '#FFFFFF', 1.7, { op: .9 });
    for (let y = -40; y < -24; y += 4.5) h += line(-18, y + 3, -4, y - 2, '#FFFFFF', 1.5, { op: .9 });
    b += clipped(path(sc1, '#000') + path(sc2, '#000'), h) + path(sc1, 'none', { stroke: ink, sw: 2.5 }) + path(sc2, 'none', { stroke: ink, sw: 2.5 });
  }
  // head
  let head = o.hatBack ? g(o.hatBack, `translate(0 ${f(hatDy * .4)})`) : '';
  head += circ(-19, -60, 5.5, skin, { stroke: ink, sw: 3 });
  head += circ(0, -62, 21, skin, { stroke: ink, sw: 3 });
  head += clipped(circ(0, -62, 21, '#000'), circ(9, -56, 21, ink, { op: .13 }));
  head += faceSvg(face, skin);
  head += o.faceAdd || '';
  let hat = o.hatSvg;
  if (teamKey === 'orange') {
    const [px, py] = def.patch;
    hat += g(path('M0 -6.5 L6 0 L0 6.5 L-6 0 Z', team.col, { stroke: ink, sw: 2 }) + path('M0 -3.6 L3.3 0 L0 3.6 L-3.3 0 Z', 'none', { stroke: '#FFFFFF', sw: 1.1, dash: '1.6 1.6' }), `translate(${px} ${py})`);
  }
  head += g(hat, hatDy ? `translate(0 ${f(hatDy)})` : '');
  b += head;
  // tool and front hand: the tool turns about the hand
  if (tool) {
    const t = o.toolSvg || (circ(32, -16, 8, C.boinker, { stroke: ink, sw: 2.5 }) + path('M27 -20 Q32 -24 37 -20', 'none', { stroke: '#FFF', sw: 2 }));
    b += g(t, `translate(${f(hf[0] - 20)} ${f(hf[1] + 27)}) rotate(${toolRot} 20 -27)`);
  }
  b += circ(hf[0], hf[1], 6.5, hand, { stroke: ink, sw: 3 });
  // extras that ride with the body
  let fx = '';
  if (puff) fx += path('M50 -62 l9 -6 M54 -50 l11 -1 M50 -38 l9 5', 'none', { stroke: ink, sw: 2.5 }) + star4(46, -50, 5, C.gold, { stroke: ink, sw: 1.5 });
  if (stars !== null) {
    const pts = stars ? [[-30, -92, 6], [34, -86, 7.5], [8, -104, 5]] : [[-24, -84, 7.5], [30, -92, 6], [2, -98, 5]];
    for (const [x, y, r] of pts) fx += star4(x, y, r, C.gold, { stroke: ink, sw: 1.8 });
  }
  // exact scale (f() rounds to one decimal, too coarse for a 3% breathe)
  const body = `<g transform="translate(${f(dx)} ${f(dy)}) rotate(${lean}) scale(${(sx * s).toFixed(3)} ${(sy * s).toFixed(3)})">${b}${fx}</g>`;
  let out = ell(0, 0, 24 * s, 5, ink, { op: dy < -4 ? .12 : .18 }) + body;
  if (balloon !== null) out += snoozeBalloon(-4 + dx, dy - 92 * s, { tag: teamKey === 'orange', sway: balloon ? 5 : -2, str: balloon ? 50 : 40 });
  return out;
}
