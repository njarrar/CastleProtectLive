// Posed Flattener enemy rig generator for game sprites (Part 2 upgraded silhouette & contrast).
// Matches 04_Art_Design_UX_Critique_Before_After.md §1.1 & Plate 3 ("Round vs Flat"):
// stark vertical rectilinear posture, strong 3 px dark espresso (#2C221E) outer silhouette contour,
// crisp #5A6572 slate-grey creased suit, stark #FFFFFF white gloves, flat spirit-level pancake cap
// with bright #4ADE80 green level bubble, sharp #E8730C hatched tie, one straight-edged tool,
// and a crisp square zzz snooze balloon when Bonked.
// Origin = feet centre. Faces right; the game flips it for the right-hand fort.
import * as L from './lib.mjs';
import { POSES } from './sprite-hob.mjs';
const { C, PALETTE_V2: V2, rr, circ, ell, path, line, g, star4, shade, clipped, f } = L;
const ink = V2.ink; // #2C221E dark espresso outer contour
const OUTER_SW = 3.4;
const SLATE = V2.flattenerSlate;       // #5A6572
const SLATE_D = V2.flattenerSlateD;    // #3D4652
const SLATE_L = V2.flattenerSlateL;    // #7E8A98
const BUBBLE = V2.flattenerBubble;     // #4ADE80
const GLOVE = V2.flattenerGlove;       // #FFFFFF
const TIE_COL = V2.orangeFill;         // #E8730C

export const FLATTENERS = {
  snipper: { cls: 'lobber',      name: 'Hedge Snipper',   unit: 'Neat Brigade', skin: '#EAD3C0' },
  rake:    { cls: 'scatterjack', name: 'Rake Hand',       unit: 'Neat Brigade', skin: '#E5C6AC' },
  clerk:   { cls: 'peeper',      name: 'Clipboard Clerk', unit: 'Neat Brigade', skin: '#F0D9C6' },
  sniper:  { cls: 'zinger',      name: 'Ruler Sniper',    unit: 'Level Guard',  skin: '#DFBE9F' },
  tamper:  { cls: 'delver',      name: 'Tamper',          unit: 'Level Guard',  skin: '#D6B08E' },
  pump:    { cls: 'sizzler',     name: 'Pump Hand',       unit: 'Drain Fleet',  skin: '#EACFB8' },
  filler:  { cls: 'patcher',     name: 'Filler',          unit: 'Chisel Corps', skin: '#E4C4A8' },
};

export const FLATTENER_BY_CLASS = {
  lobber: 'snipper',
  scatterjack: 'rake',
  peeper: 'clerk',
  zinger: 'sniper',
  delver: 'tamper',
  boinker: 'tamper',
  sizzler: 'pump',
  patcher: 'filler',
};

export const FLATTENER_POSES = POSES;

// Angular Z shapes drawn as sharp rectilinear paths so no font is needed
const zed = (x, y, k) => path(`M${f(x)} ${f(y)} h${f(8.5 * k)} l${f(-8.5 * k)} ${f(9 * k)} h${f(8.5 * k)}`, 'none', { stroke: ink, sw: 2.8, cap: 'square' });

// Square snooze balloon (Part 2: crisp rectilinear flat-pack cube vs round puffy Hob balloon)
export function squareSnoozeBalloon(x, y, o = {}) {
  const { tag = true, sway = 0, str = 46, k = 1, zz = true } = o;
  let b = path(`M0 0 L${f(sway * .4)} ${f(-str * .45)} L${f(sway)} ${f(-str)}`, 'none', { stroke: ink, sw: 2.2 });
  if (tag) {
    b += g(
      path('M0 -6.5 L5.5 0 L0 6.5 L-5.5 0 Z', TIE_COL, { stroke: ink, sw: 2 }) + line(-2.2, 0, 2.2, 0, '#FFFFFF', 1.4),
      `translate(${f(sway * .4 + 1)} ${f(-str * .45)})`,
    );
  }
  const cy = -str - 24;
  let bl = path(`M${f(sway - 4.5)} ${f(-str)} L${f(sway + 4.5)} ${f(-str)} L${f(sway)} ${f(-str - 5.5)} Z`, '#B8C2D0', { stroke: ink, sw: 2.2 });
  bl += rr(sway - 22, cy - 22, 44, 44, 2, '#C8D0DC', { stroke: ink, sw: OUTER_SW });
  bl += clipped(
    rr(sway - 22, cy - 22, 44, 44, 2, '#000'),
    rr(sway + 9, cy - 24, 17, 48, 0, SLATE_D, { op: .22 })
      + rr(sway - 24, cy + 11, 48, 13, 0, SLATE_D, { op: .18 })
      + line(sway, cy - 20, sway, cy + 20, '#FFFFFF', 1.5, { op: .55 })
      + line(sway - 20, cy, sway + 20, cy, '#FFFFFF', 1.3, { op: .4 }),
  );
  bl += rr(sway - 22, cy - 22, 44, 44, 2, 'none', { stroke: ink, sw: OUTER_SW });
  bl += path(`M${f(sway - 17)} ${f(cy - 17)} H${f(sway - 4)} M${f(sway - 17)} ${f(cy - 17)} V${f(cy - 5)}`, 'none', { stroke: '#FFFFFF', sw: 3, op: .85, cap: 'square' });
  if (zz) bl += zed(sway + 24, cy - 14, .72) + zed(sway + 29, cy - 27, .92) + zed(sway + 36, cy - 42, 1.12);
  b += k === 1 ? bl : g(bl, `translate(${f(sway)} ${f(-str)}) scale(${k}) translate(${f(-sway)} ${f(str)})`);
  return g(b, `translate(${f(x)} ${f(y)})`);
}

function flatFaceSvg(kind, skin, type) {
  const nose = ell(10, -58, 4, 3, shade(skin, -.12), { stroke: ink, sw: 2 });
  const moustache = (type === 'tamper' || type === 'snipper')
    ? rr(0, -55.5, 21, 6, 3, '#7A5A48', { stroke: ink, sw: 1.8 })
    : '';
  const flatEyes = rr(-3, -71, 10, 2.6, 1.3, ink) + rr(10, -71, 10, 2.6, 1.3, ink)
    + rr(-1, -65, 7, 2.8, 1.4, ink) + rr(12, -65, 7, 2.8, 1.4, ink);
  let fsvg = '';
  switch (kind) {
    case 'bonk':
      fsvg = path('M-1 -66 m-3 -3 l6 6 m0 -6 l-6 6 M12 -66 m-3 -3 l6 6 m0 -6 l-6 6', 'none', { stroke: ink, sw: 2.5 })
        + nose + moustache + rr(5, -50, 9, 3, 1.5, ink);
      break;
    case 'grit':
      fsvg = path('M-3 -72 L7 -69 M20 -72 L10 -69', 'none', { stroke: ink, sw: 2.6 })
        + rr(-1, -65, 7, 2.8, 1.4, ink) + rr(12, -65, 7, 2.8, 1.4, ink)
        + nose + moustache + rr(4, -49.5, 13, 2.6, 1.2, ink);
      break;
    case 'shout':
      fsvg = path('M-3 -72 L7 -70 M20 -72 L10 -70', 'none', { stroke: ink, sw: 2.4 })
        + rr(-1, -65, 7, 3, 1.4, ink) + rr(12, -65, 7, 3, 1.4, ink)
        + nose + moustache + rr(5, -51.5, 10, 6.5, 2, ink);
      break;
    case 'blink':
      fsvg = line(-2, -65, 6, -65, ink, 2.4) + line(11, -65, 19, -65, ink, 2.4)
        + nose + moustache + rr(5, -49.5, 10, 2.4, 1.2, ink);
      break;
    case 'ouch':
      fsvg = path('M-2 -68 L5 -65 L-2 -62 M19 -68 L12 -65 L19 -62', 'none', { stroke: ink, sw: 2.5 })
        + nose + moustache + path('M3 -49.5 q3 -2.5 6 0 t6 0', 'none', { stroke: ink, sw: 2.4 });
      break;
    case 'cheer':
      fsvg = rr(-3, -72, 10, 2.4, 1.2, ink) + rr(10, -72, 10, 2.4, 1.2, ink)
        + path('M-1 -64 L6 -65 M12 -65 L19 -64', 'none', { stroke: ink, sw: 2.5 })
        + nose + moustache + path('M4 -50 Q10 -46 16 -51', 'none', { stroke: ink, sw: 2.4 });
      break;
    case 'dizzy': {
      const sw = (x) => path(`M${x} -65 m0 -1.2 a1.4 1.4 0 0 1 1.4 1.4 a2.6 2.6 0 0 1 -2.6 2.6 a3.8 3.8 0 0 1 -3.8 -3.8 a5 5 0 0 1 5 -5`, 'none', { stroke: ink, sw: 1.9 });
      fsvg = sw(1.5) + sw(14.5) + nose + moustache + rr(5, -50, 9, 2.6, 1.3, ink);
      break;
    }
    case 'wide':
      fsvg = rr(-3, -70, 9, 9, 2, '#FFFFFF', { stroke: ink, sw: 2 }) + rr(10, -70, 9, 9, 2, '#FFFFFF', { stroke: ink, sw: 2 })
        + circ(2, -65.5, 1.8, ink) + circ(15, -65.5, 1.8, ink)
        + nose + moustache + rr(6, -51.5, 8, 5.5, 2, ink);
      break;
    default:
      fsvg = flatEyes + nose + moustache + (moustache ? rr(5, -48, 10, 2.4, 1.2, ink) : rr(4, -50, 12, 2.6, 1.3, ink));
      break;
  }
  if (type === 'clerk') {
    fsvg += rr(-4, -70, 11, 9, 2, '#DDF4FF', { stroke: ink, sw: 2, op: .85 })
      + rr(10, -70, 11, 9, 2, '#DDF4FF', { stroke: ink, sw: 2, op: .85 })
      + line(7, -66, 10, -66, ink, 2);
  }
  if (type === 'sniper') {
    fsvg += rr(-4, -71, 26, 10, 2, '#3A3F4E', { stroke: ink, sw: 2 })
      + rr(0, -69, 7, 6, 1, '#DDF4FF', { op: .6 })
      + rr(12, -69, 7, 6, 1, '#DDF4FF', { op: .6 });
  }
  return fsvg;
}

function backToolSvg(type) {
  if (type === 'snipper') {
    return path('M-30 -100 L-14 -40 L-20 -38 Z', C.steelL, { stroke: ink, sw: 2.5 })
      + path('M-4 -102 L-16 -40 L-10 -38 Z', C.steelL, { stroke: ink, sw: 2.5 })
      + circ(-14, -44, 5, C.rival, { stroke: ink, sw: 2 });
  }
  if (type === 'pump') {
    return rr(-34, -56, 10, 40, 3, C.br, { stroke: ink, sw: 2.5 })
      + line(-29, -56, -29, -70, ink, 3)
      + rr(-36, -74, 14, 5, 2, C.steelD, { stroke: ink, sw: 1.5 });
  }
  return '';
}

function frontToolSvg(type) {
  switch (type) {
    case 'snipper':
      return path('M18 -27 L46 -40 L48 -35 L20 -23 Z', C.steelL, { stroke: ink, sw: 2.2 })
        + path('M18 -27 L47 -17 L45 -12 L19 -23 Z', C.steelL, { stroke: ink, sw: 2.2 })
        + circ(24, -26, 3.5, C.rival, { stroke: ink, sw: 1.8 });
    case 'rake':
      return line(30, -98, 26, -6, ink, 6.5) + line(30, -98, 26, -6, '#8A5A3A', 3.5)
        + path('M18 -100 L42 -96', 'none', { stroke: ink, sw: 5.5 })
        + path('M18 -100 L42 -96', 'none', { stroke: C.steelD, sw: 3 })
        + path('M20 -100 L20 -92 M26 -99 L26 -91 M32 -98 L32 -90 M38 -97 L38 -89', 'none', { stroke: C.steelD, sw: 2.5 });
    case 'clerk':
      return rr(18, -46, 22, 28, 2, '#B07A4A', { stroke: ink, sw: 2.5 })
        + rr(21, -42, 16, 20, 1, '#FFFFFF', { stroke: ink, sw: 1.2 })
        + line(24, -36, 34, -36, ink, 1.2) + line(24, -31, 34, -31, ink, 1.2) + line(24, -26, 30, -26, ink, 1.2)
        + rr(25, -49, 8, 5, 1, C.steelD, { stroke: ink, sw: 1.5 });
    case 'sniper':
      return path('M10 -30 L58 -42 L60 -36 L12 -24 Z', C.br, { stroke: ink, sw: 2.5 })
        + [0, 1, 2, 3, 4, 5, 6].map(i => line(18 + i * 6, -30 - i * 1.5, 18 + i * 6, -27 - i * 1.5, ink, 1.2)).join('');
    case 'tamper':
      return line(30, -70, 30, -4, ink, 6.5) + line(30, -70, 30, -4, C.steelD, 3.5)
        + rr(18, -6, 24, 6, 1, C.steelD, { stroke: ink, sw: 2 })
        + rr(22, -74, 16, 6, 2, '#3A3236', { stroke: ink, sw: 1.5 });
    case 'filler':
      return rr(22, -24, 18, 16, 3, C.steel, { stroke: ink, sw: 2.5 })
        + path('M22 -24 Q31 -32 40 -24', 'none', { stroke: ink, sw: 2 })
        + path('M30 -46 L48 -40 L46 -34 L28 -40 Z', C.steelL, { stroke: ink, sw: 2 });
    case 'pump':
      return path('M20 -30 L44 -46', 'none', { stroke: '#3A3236', sw: 4.5 })
        + rr(40, -52, 10, 10, 2, C.br, { stroke: ink, sw: 2 })
        + circ(54, -50, 3, '#9FE3FF', { stroke: ink, sw: 1.2 })
        + circ(60, -54, 2.5, '#9FE3FF', { stroke: ink, sw: 1 });
    default:
      return '';
  }
}

export function posedFlattener(type, p = {}) {
  const def = FLATTENERS[type];
  if (!def) throw new Error('unknown flattener type: ' + type);
  const {
    face = 'happy', toolRot = 0, hf = [20, -27], hb = [-21, -28], dx = 0, dy = 0, sx = 1, sy = 1,
    lean = 0, hatDy = 0, tool = true, stars = null, balloon = null, puff = false, shadow = true,
    hatRot = 0, boots = '', flash = false, lines = false, dust = 0, dirt = null,
  } = p;
  const skin = def.skin;
  let b = '';
  // Square-toed pressed rigid boots (rectilinear silhouette, strong espresso contour)
  const bootC = type === 'pump' ? '#3B5674' : '#2E3138';
  if (boots === 'dangle') {
    b += g(rr(-16, -10, 15, 10, 1.5, bootC, { stroke: ink, sw: OUTER_SW }), 'translate(-2 1) rotate(12 -9 -10)')
      + g(rr(2, -10, 16, 10, 1.5, bootC, { stroke: ink, sw: OUTER_SW }), 'translate(2 2) rotate(-10 10 -10)');
  } else {
    b += rr(-16, -10, 15, 10, 1.5, bootC, { stroke: ink, sw: OUTER_SW }) + rr(2, -10, 16, 10, 1.5, bootC, { stroke: ink, sw: OUTER_SW });
    if (type === 'pump') b += rr(-15, -19, 13, 10, 1.5, bootC, { stroke: ink, sw: 2.8 }) + rr(3, -19, 13, 10, 1.5, bootC, { stroke: ink, sw: 2.8 });
  }
  // Back tool + stark white square-cuffed back glove
  if (tool) b += backToolSvg(type);
  b += rr(hb[0] - 6.5, hb[1] - 6.5, 13, 13, 3, GLOVE, { stroke: ink, sw: 3.2 });
  // Stark vertical rectilinear slate suit (#5A6572) — sharply distinct from plump curved Hob bean body
  const bodyD = 'M-18 -51 L18 -51 L19 -48 L17 -10 L-17 -10 L-19 -48 Z';
  b += path(bodyD, SLATE, { stroke: ink, sw: OUTER_SW });
  let inner = rr(6, -52, 16, 44, 0, SLATE_D, { op: .38 })
    + rr(-19, -52, 6, 44, 0, SLATE_L, { op: .32 })
    + line(-9, -48, -9, -11, '#FFFFFF', 1.6, { op: .6 })
    + line(9, -48, 9, -11, '#FFFFFF', 1.6, { op: .6 })
    + rr(-22, -23, 44, 5.5, 0, SLATE_D)
    + rr(-3.5, -23.5, 7, 6.5, 1, C.br, { stroke: ink, sw: 1.5 });
  if (type === 'snipper' || type === 'filler') {
    inner += rr(-12, -40, 24, 30, 1, type === 'snipper' ? '#548244' : C.fcream, { stroke: ink, sw: 1.8 })
      + (type === 'filler' ? rr(-9, -27, 18, 4, 1.5, BUBBLE, { stroke: ink, sw: 1 }) : '');
  }
  b += clipped(path(bodyD, '#000'), inner) + path(bodyD, 'none', { stroke: ink, sw: OUTER_SW });
  // Crisp lapel lines + brass tunic buttons
  b += path('M-13 -50 L-5 -36 M13 -50 L5 -36', 'none', { stroke: SLATE_D, sw: 2 })
    + circ(-4.5, -31, 1.8, C.brL, { stroke: ink, sw: .9 }) + circ(4.5, -31, 1.8, C.brL, { stroke: ink, sw: .9 });
  // Pressed crisp white collar + sharp hatched #E8730C rival tie
  b += path('M-14 -50 L0 -40 L14 -50 L10 -53 L-10 -53 Z', '#FFFFFF', { stroke: ink, sw: 2.2 });
  const tieD = 'M-4.2 -44 L4.2 -44 L6 -23 L0 -16 L-6 -23 Z';
  let tieHatch = '';
  for (let y = -44; y < -15; y += 5.2) tieHatch += line(-8, y + 4, 8, y - 3, '#FFFFFF', 1.5, { op: .88 });
  b += path(tieD, TIE_COL) + clipped(path(tieD, '#000'), tieHatch) + path(tieD, 'none', { stroke: ink, sw: 2.2 });
  // Squared rectilinear head (strong visual contrast vs circular Hob heads at 12-18 px mobile scale)
  b += rr(-22, -68, 6, 11, 2, skin, { stroke: ink, sw: 3 });
  const headRect = rr(-18, -82, 37, 32, 6.5, skin, { stroke: ink, sw: OUTER_SW });
  b += headRect;
  b += clipped(rr(-18, -82, 37, 32, 6.5, '#000'), rr(10, -83, 12, 35, 0, ink, { op: .14 }));
  b += rr(-18, -82, 37, 32, 6.5, 'none', { stroke: ink, sw: OUTER_SW });
  b += flatFaceSvg(face, skin, type);
  // Razor-flat wide spirit-level pancake cap with bright #4ADE80 green level bubble
  const offCenter = (face === 'ouch' || face === 'bonk' || face === 'dizzy' || face === 'wide') ? 4.8 : Math.max(-4, Math.min(4, lean * .4));
  let cap = rr(-33, -86, 68, 6.5, 2, SLATE_D, { stroke: ink, sw: 3.2 })
    + rr(-21, -94, 44, 9, 2, SLATE, { stroke: ink, sw: 3.2 })
    + line(-18, -92, 18, -92, SLATE_L, 1.5, { op: .65 })
    + rr(-9, -92.5, 22, 6, 3, '#E8FFE8', { stroke: ink, sw: 1.7 })
    + line(-2, -92.5, -2, -86.5, ink, 1.1, { op: .55 }) + line(6, -92.5, 6, -86.5, ink, 1.1, { op: .55 })
    + ell(2 + offCenter, -89.5, 4.4, 2.2, BUBBLE, { stroke: '#1F6B29', sw: .8 })
    + circ(0.8 + offCenter, -90.2, .9, '#FFFFFF', { op: .9 });
  if (type === 'snipper') cap += path('M2 -94 C-4 -105 8 -111 12 -103 C10 -99 6 -97 2 -94 Z', '#58A855', { stroke: ink, sw: 2.2 });
  if (type === 'rake') cap += ell(-10, -97, 6, 3, '#E0A030', { stroke: ink, sw: 1.6 }) + ell(14, -98, 5, 3, '#C9603A', { stroke: ink, sw: 1.6 });
  if (type === 'clerk') cap += g(rr(-2, -14, 4, 22, 1, C.gold, { stroke: ink, sw: 1.6 }), 'translate(-22 -66) rotate(-30)');
  b += g(cap, hatRot ? `translate(0 ${f(hatDy)}) rotate(${hatRot} 0 -86)` : hatDy ? `translate(0 ${f(hatDy)})` : '');
  // Front straight-edged tool and stark #FFFFFF white square-cuffed front glove
  if (tool) {
    const ft = frontToolSvg(type);
    if (ft) b += g(ft, `translate(${f(hf[0] - 20)} ${f(hf[1] + 27)}) rotate(${toolRot} 20 -27)`);
  }
  b += rr(hf[0] - 7, hf[1] - 6.5, 13.5, 13, 3, GLOVE, { stroke: ink, sw: 3.2 })
    + line(hf[0] - 5, hf[1] + 2, hf[0] + 4, hf[1] + 2, SLATE_L, 1.2, { op: .5 });
  // pose FX
  let fx = '';
  if (puff) fx += path('M50 -62 l9 -6 M54 -50 l11 -1 M50 -38 l9 5', 'none', { stroke: ink, sw: 2.5 }) + star4(46, -50, 5, C.gold, { stroke: ink, sw: 1.5 });
  if (flash) fx += star4(52, -44, 11, '#FFF3C4', { stroke: C.gold, sw: 2 }) + star4(52, -44, 4.5, '#FFFFFF');
  if (lines) fx += path('M-34 -96 v-20 M-29 -72 v-14 M40 -98 v-20 M35 -74 v-14', 'none', { stroke: ink, sw: 2.5, op: .55 });
  if (stars !== null) {
    const pts = stars === 3 ? [[-26, -98, 6.5], [0, -110, 5], [27, -100, 7], [36, -80, 4.5]]
      : stars === 2 ? [[-38, -100, 4.5], [42, -92, 5.5], [12, -116, 4]]
        : stars ? [[-30, -92, 6], [34, -86, 7.5], [8, -104, 5]]
          : [[-24, -84, 7.5], [30, -92, 6], [2, -98, 5]];
    for (const [x, y, r] of pts) fx += star4(x, y, r, C.gold, { stroke: ink, sw: 1.8 });
  }
  const body = `<g transform="translate(${f(dx)} ${f(dy)}) rotate(${lean}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})">${b}${fx}</g>`;
  let out = '';
  if (shadow) out += ell(0, 0, 24, 5, ink, { op: dy < -4 ? .12 : .18 });
  out += body;
  if (dust) {
    const k = dust === 1 ? 1 : 1.5, op = dust === 1 ? .9 : .5;
    for (const sg of [-1, 1]) out += circ(sg * (26 + k * 8), -5 * k, 6 * k, '#CFC8C0', { op }) + circ(sg * (34 + k * 12), -3 - k, 4 * k, '#E4DED6', { op }) + circ(sg * (20 + k * 6), -3, 4.5 * k, '#E4DED6', { op });
  }
  if (dirt !== null) {
    const cl = (x, y, r, col = '#9A6440') => path(`M${f(x - r)} ${f(y)} C${f(x - r)} ${f(y - r * 1.1)} ${f(x + r * .9)} ${f(y - r * 1.2)} ${f(x + r)} ${f(y - r * .1)} C${f(x + r * .9)} ${f(y + r * .9)} ${f(x - r * .8)} ${f(y + r)} ${f(x - r)} ${f(y)} Z`, col, { stroke: ink, sw: 2.2 });
    out += dirt === 0
      ? cl(50, -22, 10) + cl(62, -34, 6.5, '#B07A52') + cl(64, -12, 7) + cl(74, -24, 4.5, '#7A4A2E') + path('M44 -42 l5 -8 M56 -46 l2 -8', 'none', { stroke: ink, sw: 2.2 })
      : cl(58, -40, 6.5) + cl(72, -54, 5, '#B07A52') + cl(74, -26, 5.5) + cl(64, -12, 4, '#7A4A2E') + cl(78, -42, 3.2, '#7A4A2E') + circ(50, -6, 6, '#CFC8C0', { op: .7 }) + circ(60, -4, 4, '#E4DED6', { op: .7 });
  }
  if (balloon !== null) {
    const bo = typeof balloon === 'object' ? balloon : { sway: balloon ? 5 : -2, str: balloon ? 50 : 40 };
    out += squareSnoozeBalloon(-4 + dx, dy - 92, { tag: true, ...bo });
  }
  return out;
}
