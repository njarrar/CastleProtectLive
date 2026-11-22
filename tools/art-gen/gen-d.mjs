// New sheets after the review rulings: pre-battle screen, launch Hob roster, Grand Forts
import fs from 'fs';
import * as L from './lib.mjs';
import * as S from './scene.mjs';
const { C, doc, text, rr, circ, ell, path, line, g, block, hob, flattener, kettle, baron, fort, stitch, star4, puff, burst, classIcon, f, button, panel, pennant, shade } = L;
const ART = '/home/user/CastleProtect/docs/art';
const out = (name, svg) => { fs.writeFileSync(`${ART}/${name}`, svg); console.log('wrote', name); };
const BODY = L.BODY;
const small = (x, y, t, o = {}) => text(x, y, t, { size: 15, weight: 600, fill: C.ink2, family: BODY, ...o });
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const ink = C.ink;

// ================================================================ 22 launch Hob roster (03 §3)
// Each named Hob keeps its Class hat family (06 §3.4) and adds one personal touch from 03.
const dk = (c) => shade(c, -.25), lt = (c) => shade(c, .35);
const WOOD = '#8A5A3A', CHINA = '#F2E8D5', COPPER = '#D9773A';
const flame = (x, y, k = 1) => path(`M${x} ${y} C${x - 5 * k} ${y - 5 * k} ${x - 2 * k} ${y - 11 * k} ${x} ${y - 16 * k} C${x + 2 * k} ${y - 10 * k} ${x + 6 * k} ${y - 6 * k} ${x} ${y} Z`, C.fire, { stroke: ink, sw: 1.8 }) + circ(x, y - 4 * k, 1.8 * k, C.gold);
const lobDome = (hc) => path('M-23 -70 C-23 -98 23 -98 23 -70 Z', hc, { stroke: ink, sw: 3 }) + path('M-15 -82 C-10 -88 -2 -89 4 -89', 'none', { stroke: lt(hc), sw: 3 });
const lobBand = (hc) => rr(-27, -73, 54, 8, 4, dk(hc), { stroke: ink, sw: 3 });
const zingCap = (hc) => path('M-20 -72 C-20 -94 20 -94 20 -72 Z', hc, { stroke: ink, sw: 3 }) + path('M14 -74 C26 -76 36 -74 40 -70 C30 -68 20 -68 12 -69 Z', dk(hc), { stroke: ink, sw: 3 });
const brim = (hc) => path('M-38 -72 C-24 -82 24 -84 40 -74 C30 -66 -26 -64 -38 -72 Z', dk(hc), { stroke: ink, sw: 3 });
const beanie = (hc) => path('M-21 -70 C-22 -96 22 -96 21 -70 Z', hc, { stroke: ink, sw: 3 }) + rr(-23, -76, 46, 9, 4.5, dk(hc), { stroke: ink, sw: 3 }) + path('M-8 -86 L-8 -78 M0 -88 L0 -78 M8 -86 L8 -78', 'none', { stroke: lt(hc), sw: 2.5 });
const spring = path('M0 -84 l-8 -4 l16 -4 l-16 -4 l16 -4 l-8 -3', 'none', { stroke: C.steelD, sw: 3 });
const trowelBack = g(path('M0 0 L10 -26 L20 0 Z', C.steelL, { stroke: ink, sw: 2.5 }) + rr(7, 0, 6, 14, 2, WOOD, { stroke: ink, sw: 2 }), 'translate(-30 -76) rotate(-24)');
const flatCap = (hc) => path('M-24 -72 C-26 -92 18 -98 26 -80 C28 -74 24 -70 18 -70 Z', hc, { stroke: ink, sw: 3 });
const capBill = (hc) => path('M14 -73 C24 -76 34 -74 38 -70 L14 -68 Z', dk(hc), { stroke: ink, sw: 3 });
const apron = (col) => path('M-12 -42 L12 -42 L17 -6 L-17 -6 Z', col, { stroke: ink, sw: 2 });

const ROSTER = [
  { cls: 'lobber', name: 'Marge Dumpling', touch: ["Floppy cook's dome that sags", 'over one eye. Bread peel.'], o: {
    coat: '#B83A4A', skin: L.SKINS[0], bodyAdd: apron(CHINA),
    hatSvg: path('M-25 -70 C-36 -100 -10 -114 6 -106 C28 -112 44 -90 35 -62 C31 -55 24 -60 22 -70 Z', C.lobber, { stroke: ink, sw: 3 }) + path('M-16 -90 C-10 -98 0 -101 8 -99', 'none', { stroke: lt(C.lobber), sw: 3 }) + rr(-27, -74, 50, 8, 4, dk(C.lobber), { stroke: ink, sw: 3 }) + circ(-4, -110, 5, dk(C.lobber), { stroke: ink, sw: 2.5 }),
    toolSvg: line(16, -20, 46, -50, ink, 6.5) + line(16, -20, 46, -50, WOOD, 3.5) + g(ell(0, 0, 13, 7, '#C9A27A', { stroke: ink, sw: 2.5 }), 'translate(52 -56) rotate(-40)') + circ(53, -64, 7, C.soot, { stroke: ink, sw: 2.2 }) + star4(60, -73, 3.5, C.gold),
  } },
  { cls: 'lobber', name: 'Old Thumper Grumbleby', touch: ['Striped nightcap dome with a', 'tail to the floor. Ear horn.'], o: {
    coat: '#6F7F5A', skin: L.SKINS[4],
    hatBack: path('M-16 -88 C-42 -92 -48 -60 -41 -34 C-38 -20 -43 -12 -41 -6', 'none', { stroke: ink, sw: 13 }) + path('M-16 -88 C-42 -92 -48 -60 -41 -34 C-38 -20 -43 -12 -41 -6', 'none', { stroke: C.lobber, sw: 7.5 }) + path('M-16 -88 C-42 -92 -48 -60 -41 -34 C-38 -20 -43 -12 -41 -6', 'none', { stroke: CHINA, sw: 7.5, dash: '5 9', cap: 'butt' }) + circ(-41, -3, 6, CHINA, { stroke: ink, sw: 2.5 }),
    back: path('M-24 -62 L-44 -76 L-46 -52 Z', C.br, { stroke: ink, sw: 2.5 }),
    hatSvg: lobDome(C.lobber) + L.clipped(path('M-23 -70 C-23 -98 23 -98 23 -70 Z', '#000'), rr(-12, -100, 6, 34, 0, CHINA) + rr(2, -100, 6, 34, 0, CHINA) + rr(15, -100, 6, 34, 0, CHINA)) + path('M-23 -70 C-23 -98 23 -98 23 -70 Z', 'none', { stroke: ink, sw: 3 }) + lobBand(C.lobber) + circ(0, -95, 4.5, dk(C.lobber), { stroke: ink, sw: 2.5 }),
    faceAdd: path('M-8 -50 C-12 -30 -4 -14 8 -12 C20 -14 26 -30 22 -50 C14 -44 2 -44 -8 -50 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) + ell(13, -57, 7.5, 4.5, shade(L.SKINS[4], -.15), { stroke: ink, sw: 2 }),
    toolSvg: line(22, -4, 30, -50, ink, 6) + line(22, -4, 30, -50, WOOD, 3) + ell(32, -54, 7, 4.5, C.steelL, { stroke: ink, sw: 2 }) + circ(33, -61, 6.5, C.soot, { stroke: ink, sw: 2.2 }),
  } },
  { cls: 'lobber', name: 'Pip Skyward', scale: .84, touch: ['Small dome with a kite on the', 'knob. The tail shows the wind.'], o: {
    coat: '#6FA8D6', skin: L.SKINS[1],
    hatSvg: path('M0 -108 C-14 -104 -20 -114 -32 -108 C-40 -104 -46 -112 -56 -106', 'none', { stroke: ink, sw: 5 }) + path('M0 -108 C-14 -104 -20 -114 -32 -108 C-40 -104 -46 -112 -56 -106', 'none', { stroke: C.lobber, sw: 2.5 }) + path('M-22 -116 l-5 8 l8 1 Z M-44 -113 l-5 8 l8 1 Z', CHINA, { stroke: ink, sw: 1.5 }) +
      lobDome(C.lobber) + lobBand(C.lobber) + circ(0, -95, 4.5, dk(C.lobber), { stroke: ink, sw: 2.5 }) + line(0, -99, 0, -108, ink, 2) +
      path('M0 -146 L15 -126 L0 -106 L-15 -126 Z', CHINA, { stroke: ink, sw: 2.5 }) + path('M0 -146 L0 -106 M-15 -126 L15 -126', 'none', { stroke: C.lobber, sw: 2.5 }),
    toolSvg: line(22, -6, 27, -112, ink, 6) + line(22, -6, 27, -112, WOOD, 3) + path('M27 -112 L20 -124 M27 -112 L35 -123', 'none', { stroke: ink, sw: 5 }) + path('M27 -112 L20 -124 M27 -112 L35 -123', 'none', { stroke: WOOD, sw: 2.5 }) + path('M20 -124 Q28 -116 35 -123', 'none', { stroke: ink, sw: 2 }),
  } },
  { cls: 'zinger', name: 'Quill Needlesworth', touch: ['Bill cap with a pincushion', 'crown and a quill plume.'], o: {
    coat: '#3F4A6A', skin: L.SKINS[2],
    hatSvg: path('M-6 -86 C-12 -100 -18 -112 -30 -118 C-18 -116 -6 -106 0 -90 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) + line(-24, -113, -6, -90, C.ink2, 1.2) + zingCap(C.zinger) +
      path('M-14 -80 L-4 -90 M-4 -76 L8 -88 M-12 -90 L0 -78 M0 -92 L12 -80', 'none', { stroke: dk(C.zinger), sw: 1.6 }) +
      [[-9, -92, -13], [-1, -94, -3], [7, -93, 10], [14, -88, 21]].map(([x, y, x2]) => line(x, y, x2, y - 15, ink, 3.2) + line(x, y, x2, y - 15, C.steelL, 1.4) + circ(x2, y - 16, 3.2, CHINA, { stroke: ink, sw: 1.6 })).join(''),
    toolSvg: line(14, -26, 54, -44, ink, 5) + line(14, -26, 54, -44, C.steelL, 2.2) + circ(15, -26, 4, CHINA, { stroke: ink, sw: 1.8 }),
  } },
  { cls: 'zinger', name: 'Dame Flicka Brightspur', touch: ['Bucket helm with a visor bill', 'and a plume three Hobs tall.'], o: {
    coat: '#A8483A', skin: L.SKINS[5], bodyAdd: rr(-3, -50, 6, 46, 0, C.gold) + rr(-26, -20, 52, 5, 0, C.gold),
    hatSvg: path('M-2 -98 C-10 -132 -28 -162 -52 -178 C-26 -178 -2 -150 6 -100 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) + path('M-40 -168 C-22 -152 -10 -128 -2 -102', 'none', { stroke: C.ink2, sw: 1.3, op: .6 }) +
      rr(-22, -102, 44, 34, 8, C.zinger, { stroke: ink, sw: 3 }) + rr(-18, -98, 12, 5, 2.5, lt(C.zinger)) + rr(2, -88, 18, 4.5, 2, ink) + rr(-25, -74, 50, 7, 3, C.br, { stroke: ink, sw: 2.5 }) + circ(-16, -70.5, 1.6, C.brL) + circ(-4, -70.5, 1.6, C.brL) + circ(8, -70.5, 1.6, C.brL) +
      path('M16 -76 C28 -78 38 -76 42 -72 C32 -70 22 -70 14 -71 Z', dk(C.zinger), { stroke: ink, sw: 3 }),
    toolSvg: path('M12 -22 L70 -52 L18 -34 Z', C.steelL, { stroke: ink, sw: 2.5 }) + rr(10, -34, 12, 12, 4, C.br, { stroke: ink, sw: 2.2 }),
  } },
  { cls: 'scatter', name: 'Jax Peppercorn', touch: ['Wide brim. The crown is a', 'tall pepper mill.'], o: {
    coat: '#B8472E', skin: L.SKINS[3],
    hatSvg: path('M-11 -76 L-12 -94 C-15 -102 -8 -106 -8 -110 C-13 -118 13 -118 8 -110 C8 -106 15 -102 12 -94 L11 -76 Z', C.scatter, { stroke: ink, sw: 3 }) + line(-12, -94, 12, -94, ink, 2) + line(-8, -110, 8, -110, ink, 2) + circ(0, -121, 5, dk(C.scatter), { stroke: ink, sw: 2.5 }) + path('M-6 -100 L-6 -88', 'none', { stroke: lt(C.scatter), sw: 2.5 }) + brim(C.scatter),
    toolSvg: rr(22, -40, 17, 24, 4, WOOD, { stroke: ink, sw: 2.5 }) + line(22, -30, 39, -30, ink, 1.8) + line(30, -40, 30, -48, ink, 3) + line(30, -48, 44, -48, ink, 3) + circ(45, -48, 3.5, C.steelL, { stroke: ink, sw: 1.8 }) + circ(26, -12, 1.8, ink) + circ(33, -9, 1.8, ink) + circ(38, -13, 1.8, ink),
  } },
  { cls: 'scatter', name: 'Nan Clatterpot', scale: .9, touch: ['Wide brim under a stack of', 'copper pots. Soup ladle.'], o: {
    coat: '#9A86B8', skin: L.SKINS[4],
    hatSvg: rr(-14, -92, 28, 17, 3, COPPER, { stroke: ink, sw: 2.8 }) + line(14, -86, 30, -90, ink, 5) + line(14, -86, 30, -90, COPPER, 2.2) + rr(-10, -105, 19, 13, 3, '#F2A469', { stroke: ink, sw: 2.8 }) + line(-10, -100, -24, -105, ink, 5) + line(-10, -100, -24, -105, '#F2A469', 2.2) + path('M-8 -105 C-8 -113 7 -113 7 -105 Z', COPPER, { stroke: ink, sw: 2.5 }) + circ(-0.5, -113, 3, C.br, { stroke: ink, sw: 1.8 }) + line(-9, -87, -2, -87, '#FFFFFF', 2.2, { op: .5 }) + brim(C.scatter),
    toolSvg: line(18, -22, 40, -52, ink, 5.5) + line(18, -22, 40, -52, C.steelL, 2.5) + path('M32 -56 C32 -46 50 -46 50 -56 Z', C.steelL, { stroke: ink, sw: 2.5 }),
  } },
  { cls: 'scatter', name: 'Fizz Popkin', scale: .9, touch: ['Wide brim. The crown is a party', 'cone with streamers.'], o: {
    coat: '#E58AB4', skin: L.SKINS[0], face: 'shout',
    hatSvg: path('M0 -128 C-10 -134 -14 -146 -24 -144 M0 -128 C8 -138 6 -150 16 -154 M0 -128 C12 -128 20 -136 28 -130', 'none', { stroke: ink, sw: 5 }) + path('M0 -128 C-10 -134 -14 -146 -24 -144', 'none', { stroke: C.boinker, sw: 2.5 }) + path('M0 -128 C8 -138 6 -150 16 -154', 'none', { stroke: CHINA, sw: 2.5 }) + path('M0 -128 C12 -128 20 -136 28 -130', 'none', { stroke: C.boinker, sw: 2.5 }) +
      path('M-14 -76 L0 -128 L14 -76 Z', C.scatter, { stroke: ink, sw: 3 }) + circ(-4, -88, 2.6, C.boinker) + circ(5, -96, 2.6, CHINA) + circ(0, -108, 2.2, C.boinker) + circ(6, -82, 2.2, CHINA) + circ(0, -128, 4.5, CHINA, { stroke: ink, sw: 2 }) + brim(C.scatter),
    toolSvg: path('M20 -22 L44 -40 L48 -26 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) + path('M30 -30 L34 -24 M38 -35 L42 -28', 'none', { stroke: C.boinker, sw: 2.2 }) + circ(54, -42, 2.2, C.boinker) + circ(58, -32, 2.2, C.scatter) + circ(52, -52, 2.2, CHINA, { stroke: ink, sw: 1 }),
  } },
  { cls: 'delver', name: 'Grub Mudgett', touch: ['Hard dome so big it hides his', 'eyes. A candle on top.'], o: {
    coat: '#7A5A44', skin: L.SKINS[5], bodyAdd: ell(-10, -14, 9, 5, '#4A3328', { op: .6 }) + ell(12, -26, 6, 4, '#4A3328', { op: .6 }),
    hatSvg: rr(-3.5, -116, 7, 16, 1.5, CHINA, { stroke: ink, sw: 2.2 }) + flame(0, -116, 1) + path('M-27 -63 C-29 -106 29 -106 27 -63 Z', C.delver, { stroke: ink, sw: 3 }) + path('M-2 -100 L2 -100 L3 -64 L-3 -64 Z', dk(C.delver)) + path('M-17 -84 C-12 -92 -4 -95 2 -95', 'none', { stroke: lt(C.delver), sw: 3 }) + path('M-30 -66 L30 -66 L36 -58 L-30 -58 Z', dk(C.delver), { stroke: ink, sw: 3 }),
    toolSvg: line(20, -22, 34, -46, ink, 6) + line(20, -22, 34, -46, WOOD, 3) + path('M34 -46 l8 -3 l-5 -7 l9 -2 l-5 -7 l8 -3', 'none', { stroke: ink, sw: 5.5 }) + path('M34 -46 l8 -3 l-5 -7 l9 -2 l-5 -7 l8 -3', 'none', { stroke: C.steelL, sw: 2.5 }),
  } },
  { cls: 'delver', name: 'Truffle Snoutworth', touch: ['Hard dome shaped like a spotted', 'mushroom cap. Big nose.'], o: {
    coat: '#B8946A', skin: L.SKINS[0],
    hatSvg: path('M18 -80 L64 -96 L64 -62 Z', C.gold, { op: .28 }) + path('M-31 -68 C-33 -106 33 -106 31 -68 C20 -63 -20 -63 -31 -68 Z', C.delver, { stroke: ink, sw: 3 }) + circ(-14, -84, 5, CHINA) + circ(0, -93, 4, CHINA) + circ(-22, -74, 3, CHINA) + circ(4, -78, 3, CHINA) + circ(18, -80, 7, C.gold, { stroke: ink, sw: 2.5 }) + circ(16, -82, 2.5, '#FFF'),
    faceAdd: ell(13, -56, 9.5, 7.5, shade(L.SKINS[0], -.14), { stroke: ink, sw: 2.2 }),
    toolSvg: path('M20 -30 L42 -30 L39 -12 L23 -12 Z', '#C9A27A', { stroke: ink, sw: 2.5 }) + path('M23 -24 L39 -24 M24 -18 L38 -18', 'none', { stroke: '#8A6A3A', sw: 1.6 }) + path('M20 -30 Q31 -46 42 -30', 'none', { stroke: ink, sw: 2.5 }) + path('M27 -30 C25 -38 33 -42 35 -30 Z', C.sizzler, { stroke: ink, sw: 2 }) + path('M31 -38 L29 -46 M32 -38 L36 -45', 'none', { stroke: '#5AA555', sw: 2.5 }),
  } },
  { cls: 'boinker', name: 'Bobbin Springheel', touch: ['Beanie and spring, with a boot', 'on top. Laces fly.'], o: {
    coat: '#5F9A4A', skin: L.SKINS[1], bodyAdd: apron('#C9A27A'),
    hatSvg: spring + path('M-8 -126 L-8 -102 L13 -102 C14 -109 8 -112 2 -112 L2 -126 Z', WOOD, { stroke: ink, sw: 2.5 }) + rr(-9, -103, 23, 4.5, 2, '#4A3328', { stroke: ink, sw: 1.5 }) + path('M2 -122 C10 -128 14 -122 20 -128 M2 -117 C10 -119 14 -114 22 -118', 'none', { stroke: ink, sw: 4 }) + path('M2 -122 C10 -128 14 -122 20 -128 M2 -117 C10 -119 14 -114 22 -118', 'none', { stroke: CHINA, sw: 1.8 }) + beanie(C.boinker),
  } },
  { cls: 'boinker', name: 'Skip Pebblewick', touch: ['Beanie and spring, a fishing', 'float on top, lures on the band.'], o: {
    coat: '#4F7FA8', skin: L.SKINS[2], face: 'sleepy',
    hatSvg: spring + line(0, -118, 0, -128, ink, 2.5) + L.clipped(ell(0, -110, 7, 9, '#000'), rr(-8, -120, 16, 10, 0, C.fire) + rr(-8, -110, 16, 10, 0, '#FFFFFF')) + ell(0, -110, 7, 9, 'none', { stroke: ink, sw: 2.5 }) + beanie(C.boinker) +
      path('M-17 -72 l5 -3.5 l5 3.5 l-5 3.5 Z', C.steelL, { stroke: ink, sw: 1.4 }) + path('M-2 -72 l5 -3.5 l5 3.5 l-5 3.5 Z', CHINA, { stroke: ink, sw: 1.4 }) + path('M11 -72 l5 -3.5 l5 3.5 l-5 3.5 Z', C.steelL, { stroke: ink, sw: 1.4 }),
    toolSvg: line(18, -20, 46, -92, ink, 4.5) + line(18, -20, 46, -92, WOOD, 2) + path('M46 -92 C58 -84 58 -66 56 -54', 'none', { stroke: ink, sw: 1.4 }) + ell(56, -49, 6.5, 5, C.cb, { stroke: ink, sw: 2.2 }),
  } },
  { cls: 'sizzler', name: 'Ember Toastwell', touch: ['Tall toque, straight as a', 'stovepipe. It puffs real smoke.'], o: {
    coat: '#5A4E52', skin: L.SKINS[4],
    hatSvg: circ(8, -138, 7, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) + circ(18, -150, 5, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) + circ(12, -160, 3.5, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) +
      rr(-15, -116, 30, 42, 4, C.sizzler, { stroke: ink, sw: 3 }) + path('M-20 -110 C-28 -120 -14 -132 -5 -124 C0 -134 16 -132 16 -122 C28 -122 26 -108 18 -108 Z', C.sizzler, { stroke: ink, sw: 3 }) + path('M-9 -104 L-9 -84', 'none', { stroke: lt(C.sizzler), sw: 2.5 }) + flame(1, -82, .8) + rr(-21, -77, 42, 8, 4, dk(C.sizzler), { stroke: ink, sw: 3 }),
    faceAdd: ell(-6, -50, 6, 3.5, C.soot, { op: .28 }) + ell(18, -72, 4, 2.5, C.soot, { op: .28 }),
    toolSvg: path('M21 -34 L43 -34 L39 -14 L25 -14 Z', '#3A3F4E', { stroke: ink, sw: 2.5 }) + path('M21 -34 Q32 -50 43 -34', 'none', { stroke: ink, sw: 2.5 }) + circ(27, -36, 4, C.soot, { stroke: ink, sw: 1.5 }) + circ(34, -38, 4.5, C.soot, { stroke: ink, sw: 1.5 }) + circ(40, -36, 3.5, C.soot, { stroke: ink, sw: 1.5 }),
  } },
  { cls: 'sizzler', name: 'Brine Picklewick', touch: ['Tall toque over a pickle jar.', 'One pickle floats in it.'], o: {
    coat: '#6E8A3A', skin: L.SKINS[1], hands: '#8FC7E8',
    hatSvg: circ(12, -134, 5.5, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) + circ(20, -144, 4, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) +
      rr(-15, -110, 30, 36, 6, '#D6EFDF', { stroke: ink, sw: 3 }) + rr(-13, -100, 26, 24, 3, '#A9D8B4', { op: .7 }) + g(ell(0, 0, 9, 4.2, '#5E8F3A', { stroke: ink, sw: 1.8 }) + circ(-3, -1, .9, ink) + circ(2, 1, .9, ink), 'translate(1 -90) rotate(-24)') + line(-10, -104, -10, -84, '#FFFFFF', 2.2, { op: .7 }) +
      path('M-19 -108 C-27 -116 -14 -128 -5 -121 C0 -130 15 -128 15 -119 C27 -119 25 -106 18 -106 Z', C.sizzler, { stroke: ink, sw: 3 }) + rr(-21, -77, 42, 8, 4, dk(C.sizzler), { stroke: ink, sw: 3 }),
    toolSvg: rr(22, -38, 19, 26, 6, WOOD, { stroke: ink, sw: 2.5 }) + line(22, -30, 41, -30, C.steelD, 2.5) + line(22, -20, 41, -20, C.steelD, 2.5) + line(31, -38, 31, -48, ink, 3.5) + line(31, -48, 46, -52, ink, 3.5) + circ(52, -55, 2.2, '#BFE3F2', { stroke: ink, sw: 1 }) + circ(58, -52, 1.8, '#BFE3F2', { stroke: ink, sw: 1 }),
  } },
  { cls: 'patcher', name: 'Hetty Mortarboard', touch: ["Flat cap under a mason's board", 'with a blob of mortar.'], o: {
    coat: '#A8483A', skin: L.SKINS[3], bodyAdd: apron('#A9A39A'),
    hatSvg: trowelBack + flatCap(C.patcher) + capBill(C.patcher) + path('M-16 -84 C-6 -90 6 -90 14 -86', 'none', { stroke: lt(C.patcher), sw: 2.5 }) +
      g(rr(-25, -4, 50, 7, 1.5, '#C9A27A', { stroke: ink, sw: 2.5 }) + path('M-10 -4 C-13 -15 0 -19 5 -13 C13 -17 17 -7 12 -4 Z', C.cbL, { stroke: ink, sw: 2.5 }), 'translate(0 -93) rotate(-5)'),
    toolSvg: line(20, -26, 34, -40, ink, 6.5) + line(20, -26, 34, -40, WOOD, 3.5) + path('M30 -44 L58 -62 L42 -32 Z', C.steelL, { stroke: ink, sw: 2.5 }),
  } },
  { cls: 'patcher', name: 'Poultice Plumley', touch: ['Flat cap knitted like a tea cosy.', 'Spout forward, with steam.'], o: {
    coat: '#8FA88A', skin: L.SKINS[5], bodyAdd: path('M-24 -48 L24 -48 L16 -30 L0 -36 L-16 -30 Z', CHINA, { stroke: ink, sw: 2 }),
    hatSvg: trowelBack + circ(50, -108, 5.5, '#FFFFFF', { stroke: ink, sw: 2, op: .95 }) + circ(57, -118, 4, '#FFFFFF', { stroke: ink, sw: 2, op: .95 }) +
      path('M18 -80 C30 -82 34 -92 40 -98 L46 -93 C42 -84 36 -72 20 -70 Z', CHINA, { stroke: ink, sw: 2.8 }) + flatCap(C.patcher) + L.clipped(flatCap(C.patcher), path('M-26 -78 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 M-26 -86 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5', 'none', { stroke: lt(C.patcher), sw: 2.2 })) + path('M-24 -72 C-26 -92 18 -98 26 -80 C28 -74 24 -70 18 -70 Z', 'none', { stroke: ink, sw: 3 }) + circ(-1, -96, 4.5, CHINA, { stroke: ink, sw: 2.2 }),
    toolSvg: path('M38 -32 C46 -34 48 -40 52 -44', 'none', { stroke: ink, sw: 6 }) + path('M38 -32 C46 -34 48 -40 52 -44', 'none', { stroke: CHINA, sw: 3 }) + ell(30, -28, 11, 9, CHINA, { stroke: ink, sw: 2.5 }) + path('M24 -36 C24 -41 36 -41 36 -36', C.patcher, { stroke: ink, sw: 2 }) + circ(30, -41, 2, C.br, { stroke: ink, sw: 1.2 }),
  } },
];
export { ROSTER };

if (want('22')) {
  const W = 1840, H = 1230;
  let s = rr(0, 0, W, H, 0, C.paper) + rr(0, 0, W, H, 0, 'url(#paperDots)');
  s += text(50, 70, 'The 16 launch Hobs', { size: 44, weight: 700 }) + small(50, 102, 'Seven Classes, no Peeper yet. Each Hob keeps its Class hat family and Class colour, and adds one personal touch. Names and looks follow 03-crew-units.', { size: 18 });
  const CW = 218, X0 = 48 + CW / 2, K = 1.62;
  ROSTER.forEach((h, i) => {
    const cx = X0 + (i % 8) * CW, by = 452 + Math.floor(i / 8) * 425;
    s += ell(cx, by, 62, 10, C.ink, { op: .08 });
    s += hob(h.cls, cx - 6, by, K * (h.scale || 1), h.o);
    s += text(cx, by + 40, h.name, { size: h.name.length > 19 ? 16.5 : 19, weight: 700, anchor: 'middle' });
    const cn = L.CLASS_NAME[h.cls], pw = cn.length * 8.6 + 44;
    s += rr(cx - pw / 2, by + 52, pw, 26, 13, '#FFFFFF', { stroke: C.ink, sw: 2 }) + classIcon(h.cls, cx - pw / 2 + 14, by + 65, 10) + text(cx + 10, by + 70.5, cn, { size: 15, weight: 700, anchor: 'middle' });
    s += small(cx, by + 98, h.touch[0], { size: 13, anchor: 'middle' }) + small(cx, by + 115, h.touch[1], { size: 13, anchor: 'middle' });
  });
  // class seams between groups
  const seam = (col, row) => { const x = 48 + col * CW, y = 452 + row * 425; s += stitch(`M${x} ${y - 300} L${x} ${y + 118}`, C.ink, 2.5, .3, '6 8'); };
  [[3, 0], [5, 0], [2, 1], [4, 1], [6, 1]].forEach(([c, r]) => seam(c, r));
  // silhouette check
  s += rr(48, 1010, W - 96, 190, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(72, 1046, 'Hat family check', { size: 22, weight: 700 }) + small(72, 1070, 'Solid ink. The Class must', { size: 14 }) + small(72, 1088, 'still read by the hat.', { size: 14 });
  let px = 330; let last = '';
  ROSTER.forEach((h, i) => {
    if (h.cls !== last && i) px += 34;
    if (h.cls !== last) s += classIcon(h.cls, px - 12, 1122, 13);
    last = h.cls;
    s += g(hob(h.cls, px + 30, 1160, .56 * (h.scale || 1), { ...h.o, tool: false }), '', ' filter="url(#sil)"');
    px += 76;
  });
  out('22-launch-hob-roster.svg', doc(W, H, s, { title: 'Launch Hob roster', desc: 'The 16 launch Hobs with name, Class hat family and a personal touch' }));
}

// ================================================================ shared bits for 21 and 23
function phone(inner, title, sub, defs = '') {
  const W = 1300, H = 720;
  let s = rr(0, 0, W, H, 0, '#ECE6DA');
  s += text(50, 52, title, { size: 30, weight: 700 }) + small(50, 76, sub, { size: 16 });
  s += rr(20, 100, 1260, 600, 64, '#1E1A22', { stroke: C.ink, sw: 3 });
  s += rr(26, 340, 10, 120, 5, '#3A3440');
  s += L.clipped(rr(50, 130, 1200, 540, 30, '#000'), g(inner, 'translate(50 130)'));
  s += rr(50, 130, 1200, 540, 30, 'none', { stroke: '#000', sw: 2 });
  s += rr(52, 330, 22, 140, 11, '#1E1A22');
  return doc(W, H, s, { title, desc: sub, defs });
}
// Rival Class icon: diamond frame with an orange hatched edge
const diaIcon = (x, y, cls, r = 16) => {
  const d = (q) => `M${x} ${y - q} L${x + q} ${y} L${x} ${y + q} L${x - q} ${y} Z`;
  return path(d(r), C.rival, { stroke: C.ink, sw: 2 }) + L.clipped(path(d(r), '#000'), [...Array(9)].map((_, k) => line(x - r - 6 + k * 6, y + r, x - r + 6 + k * 6, y - r, '#FFFFFF', 1.5, { op: .75 })).join('')) + path(d(r * .7), C[cls], { stroke: C.ink, sw: 1.8 }) + classIcon(cls, x, y, r * .58, { ring: false });
};
const cogDot = (x, y, r = 5) => circ(x, y, r, C.steel, { stroke: C.ink, sw: 1.4 }) + circ(x, y, r * .35, C.ink);

// ================================================================ 21 pre-battle screen (07 §4.1, rulings B15)
if (want('21')) {
  const sk = S.sky(1200, 540, '#9ED8EC', '#FFF1D0', 'pbsky');
  let s = sk.body + S.quiltHill(-10, 1210, 540, [[0, 60], [300, 20], [700, 70], [1210, 30]], '#B7DDA8') + rr(0, 0, 1200, 540, 0, C.ink, { op: .45 });
  // the sheet slides up over the lower part of the map
  s += rr(24, 26, 1152, 560, 26, C.paper, { stroke: C.ink, sw: 3 }) + rr(570, 34, 60, 6, 3, C.ink2, { op: .4 });
  // header: level name, type, rule line
  s += rr(44, 50, 58, 34, 10, C.saffron, { stroke: C.ink, sw: 2.5 }) + text(73, 75, '1-8', { size: 20, weight: 700, anchor: 'middle' }) + text(114, 77, 'Rummage Sale', { size: 26, weight: 700 });
  const chipT = (x, w, t, ic = '') => rr(x, 52, w, 30, 15, '#FFFFFF', { stroke: C.ink, sw: 2 }) + ic + text(x + (ic ? 34 : 14), 72.5, t, { size: 14.5, weight: 700 });
  s += chipT(318, 92, 'Siege', path('M332 60 l0 16 M332 60 l13 4 l-13 5', C.rival, { stroke: C.ink, sw: 2 }));
  s += chipT(422, 262, 'Round cap 15, then the Squall', path(L.cloudD(440, 68, 6), C.slate, { stroke: C.ink, sw: 1.4 }));
  s += chipT(696, 126, 'Wind 0 to 2', g(L.windArrow(0, 0, 1, .34), 'translate(713 67)'));
  s += chipT(834, 180, 'Draft: pool 4, pick 2');
  s += circ(1136, 67, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + path('M1129 60 l14 14 M1143 60 l-14 14', 'none', { stroke: C.ink, sw: 3 });
  s += stitch('M44 94 L1156 94', C.saffronD, 2, .6, '5 5');
  // map thumb with both forts
  {
    const x = 44, y = 104, w = 250, h = 160;
    let m = rr(0, 0, w, h, 0, '#BFE6F2') + path(`M0 ${h} L0 104 C40 84 70 86 100 110 C115 126 135 126 150 108 C180 82 215 78 ${w} 96 L${w} ${h} Z`, '#7CC46A', { stroke: C.ink, sw: 2.5 }) + path(`M0 ${h} L0 122 C40 104 70 106 100 128 C115 142 135 142 150 126 C180 102 215 98 ${w} 114 L${w} ${h} Z`, '#9A6440');
    m += path('M112 124 C120 134 130 134 138 122', 'none', { stroke: '#9FD8EE', sw: 5 });
    for (const [tx, ty] of [[20, 96], [70, 88], [170, 92], [226, 86]]) m += circ(tx, ty - 8, 8, '#5AA555', { stroke: C.ink, sw: 1.8 }) + line(tx, ty, tx, ty + 6, C.ink, 2);
    m += rr(34, 64, 30, 28, 3, C.tb, { stroke: C.ink, sw: 2 }) + line(38, 64, 38, 46, C.ink, 2) + path('M38 46 L52 51 L38 56 Z', C.you, { stroke: C.ink, sw: 1.3 });
    m += rr(188, 60, 34, 30, 3, C.tb, { stroke: C.ink, sw: 2 }) + line(218, 60, 218, 42, C.ink, 2) + rr(204, 42, 14, 10, 1, C.rival, { stroke: C.ink, sw: 1.3 }) + rr(160, 86, 22, 10, 3, C.cb, { stroke: C.ink, sw: 1.8 });
    m += circ(49, 78, 5, C.glow, { stroke: C.ink, sw: 1.2 }) + circ(205, 76, 5, C.glow, { stroke: C.ink, sw: 1.2 });
    s += L.clipped(rr(x, y, w, h, 14, '#000'), g(m, `translate(${x} ${y})`)) + rr(x, y, w, h, 14, 'none', { stroke: C.ink, sw: 2.5 });
    s += rr(x + 8, y + h - 30, 118, 22, 11, C.ink2, { op: .9 }) + text(x + 67, y + h - 14.5, 'Tap for a full look', { size: 11.5, weight: 700, anchor: 'middle', fill: '#FFFFFF' });
  }
  // goals
  s += text(312, 124, 'Goals', { size: 18, weight: 700 });
  [['Win', true], ['Bonk a Hob with a Trick Shell', false], ['Use both your Trick Shells', false]].forEach(([t, done], i) => {
    const y = 152 + i * 36;
    s += rr(308, y - 20, 250, 30, 10, done ? '#FFF6D8' : '#FFFFFF', { stroke: C.ink, sw: 1.8 }) + pennant(322, y + 5, .62, done) + text(344, y + 1, t, { size: 13.5, weight: 700 });
  });
  // Rival block
  s += rr(574, 104, 582, 160, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += L.clipped(rr(586, 116, 92, 92, 14, '#000'), rr(586, 116, 92, 92, 0, C.rivalL, { op: .55 }) + [...Array(12)].map((_, k) => line(570 + k * 12, 210, 600 + k * 12, 114, '#FFFFFF', 3, { op: .35 })).join('') + flattener('rake', 628, 252, 1.15, { flip: true }));
  s += rr(586, 116, 92, 92, 14, 'none', { stroke: C.rival, sw: 5 }) + rr(586, 116, 92, 92, 14, 'none', { stroke: C.ink, sw: 2 });
  s += small(632, 228, 'Neat Brigade', { size: 12.5, anchor: 'middle', weight: 700 }) + small(632, 246, 'Rake Hand', { size: 12, anchor: 'middle' });
  s += text(694, 136, 'Sergeant Posy Rakewell', { size: 21, weight: 700 }) + rr(936, 118, 44, 24, 12, C.ink2) + text(958, 135, 'AI', { size: 14, weight: 700, anchor: 'middle', fill: '#FFFFFF' });
  s += text(1012, 136, 'Aim', { size: 15, weight: 700 });
  for (let k = 0; k < 5; k++) s += path(`M${1054 + k * 20} 122 l8 8 l-8 8 l-8 -8 Z`, k < 2 ? C.rival : '#E6E0E8', { stroke: C.ink, sw: 1.8 });
  // habit tag: cream, with the diamond pin
  s += rr(694, 152, 448, 44, 12, C.cream, { stroke: C.ink, sw: 2.2 }) + g(path('M0 -22 L8 -14 L0 -6 L-8 -14 Z', C.rival, { stroke: C.ink, sw: 1.8 }) + line(0, -6, 0, 3, C.ink, 2), 'translate(716 185)');
  s += small(734, 170, 'Habit', { size: 11.5, weight: 700 }) + text(734, 188, '"Grabs the biggest shell in the Rummage."', { size: 14.5, weight: 700, family: BODY });
  s += text(694, 238, 'Their crew', { size: 15, weight: 700 });
  ['lobber', 'zinger', 'scatter', 'boinker'].forEach((c, i) => s += diaIcon(804 + i * 44, 232, c, 18));
  s += small(990, 237, 'Always shown.', { size: 12.5 });
  // your side: crew seats, Blueprint, Doodads
  s += text(44, 300, 'Crew', { size: 18, weight: 700 }) + small(44, 320, '4 seats now, 5 at most', { size: 12 });
  ['Marge Dumpling', 'Quill Needlesworth', 'Jax Peppercorn', 'Bobbin Springheel'].forEach((n, i) => {
    const h = ROSTER.find(r => r.name === n), cx = 222 + i * 56, cy = 304;
    s += circ(cx, cy, 25, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + L.clipped(circ(cx, cy, 22.5, '#000'), rr(cx - 26, cy - 26, 52, 52, 0, '#F3E7CF') + hob(h.cls, cx - 2, cy + 40, .5, { ...h.o, tool: false })) + circ(cx, cy, 25, 'none', { stroke: C.you, sw: 3.5 }) + classIcon(h.cls, cx + 20, cy + 20, 8.5);
  });
  s += circ(446, 304, 24, '#F3EDE0', { stroke: C.ink2, sw: 2.2, extra: ' stroke-dasharray="5 5"' }) + rr(439, 302, 14, 11, 2.5, C.ink2) + path('M442 302 v-4 a4 4 0 0 1 8 0 v4', 'none', { stroke: C.ink2, sw: 2.2 });
  const swap = (x) => rr(x, 287, 70, 34, 12, '#FFFFFF', { stroke: C.ink, sw: 2.2 }) + rr(x, 317, 70, 4, 2, C.ink, { op: .12 }) + text(x + 35, 309.5, 'Swap', { size: 14.5, weight: 700, anchor: 'middle' });
  s += swap(484);
  s += rr(578, 279, 58, 52, 10, '#E8F2F6', { stroke: C.ink, sw: 2.2 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s += block(r === 2 ? 'footing' : r === 1 && c === 1 ? 'cobble' : 'timber', 589 + c * 12, 288 + r * 12, 12, 0, r * 3 + c);
  s += small(646, 298, 'Blueprint', { size: 12, weight: 700 }) + text(646, 319, 'Oak Lump', { size: 17, weight: 700 }) + swap(740);
  s += text(834, 310, 'Doodads', { size: 16, weight: 700 });
  s += rr(908, 280, 142, 50, 8, '#E3F3DC', { stroke: C.ink, sw: 2.2 }) + rr(916, 290, 30, 30, 5, '#8FD08A', { stroke: C.ink, sw: 2 }) + path('M923 310 L925 299 L937 299 L939 310 Z', C.steelL, { stroke: C.ink, sw: 1.6 }) + path('M925 299 Q931 290 937 299', 'none', { stroke: C.ink, sw: 1.6 }) + text(954, 301, 'Mend', { size: 13.5, weight: 700 }) + text(954, 318, 'Bucket', { size: 13.5, weight: 700 });
  s += rr(1060, 280, 96, 50, 8, '#F3EDE0', { stroke: C.ink2, sw: 2.2, extra: ' stroke-dasharray="5 5"' }) + text(1108, 311, '+ Add', { size: 15, weight: 700, anchor: 'middle', fill: C.ink2 });
  // the draft strip
  s += rr(40, 344, 1120, 122, 16, C.cream, { stroke: C.ink, sw: 2.5 });
  s += text(58, 374, 'Draft', { size: 20, weight: 700 }) + small(58, 396, 'Your pick', { size: 13 }) + small(58, 414, '2 of 2', { size: 13, weight: 700 });
  const shellIcon = {
    'Pudding Bomb': path('M-16 8 C-16 -10 16 -10 16 8 Z', '#C9A27A', { stroke: C.ink, sw: 2.2 }) + rr(-19, 6, 38, 7, 3.5, CHINA, { stroke: C.ink, sw: 2 }) + path('M0 -6 Q4 -16 10 -14', 'none', { stroke: C.ink, sw: 2 }) + star4(11, -15, 4, C.gold),
    'Marble Sack': path('M-13 10 C-18 -6 -6 -10 0 -10 C6 -10 18 -6 13 10 Z', '#C9A27A', { stroke: C.ink, sw: 2.2 }) + circ(-6, -11, 4.5, '#9FD8EE', { stroke: C.ink, sw: 1.5 }) + circ(3, -13, 4.5, C.scatter, { stroke: C.ink, sw: 1.5 }) + circ(9, -8, 4, CHINA, { stroke: C.ink, sw: 1.5 }),
    'Mole Mail': ell(0, 2, 16, 10, C.delver, { stroke: C.ink, sw: 2.2 }) + circ(13, -1, 3, '#F28B82', { stroke: C.ink, sw: 1.2 }) + circ(6, -3, 1.6, C.ink) + path('M-10 10 l-4 5 M-2 12 l-2 5', 'none', { stroke: C.ink, sw: 2 }) + rr(-9, -7, 12, 8, 1.5, CHINA, { stroke: C.ink, sw: 1.4 }),
    'Nosy Goose': ell(-2, 5, 14, 9, '#FFFFFF', { stroke: C.ink, sw: 2.2 }) + path('M8 0 C10 -12 14 -15 18 -14', 'none', { stroke: C.ink, sw: 7 }) + path('M8 0 C10 -12 14 -15 18 -14', 'none', { stroke: '#FFFFFF', sw: 3.5 }) + path('M19 -17 l8 3 l-8 3 Z', C.saffron, { stroke: C.ink, sw: 1.4 }) + circ(17, -15, 1.2, C.ink),
  };
  const dchip = (i, name, st) => {
    const x = 150 + i * 102, y = st === 'focus' ? 350 : 356, w = 92, h = 102;
    let c = st === 'focus' ? rr(x - 4, y - 4, w + 8, h + 8, 16, C.gold, { op: .5 }) : '';
    c += rr(x, y + 4, w, h, 12, C.ink, { op: .2 }) + rr(x, y, w, h, 12, st === 'focus' ? C.saffronL : '#FFFFFF', { stroke: C.ink, sw: st === 'focus' ? 3 : 2.2 });
    c += g(shellIcon[name], `translate(${x + w / 2} ${y + 44}) scale(1.25)`) + cogDot(x + 13, y + 13) + text(x + w / 2, y + 90, name, { size: 12.5, weight: 700, anchor: 'middle' });
    if (st === 'you') c += rr(x, y, w, h, 12, C.you, { op: .16 }) + rr(x, y, w, h, 12, 'none', { stroke: C.you, sw: 4 }) + circ(x + w - 13, y + 13, 10, C.you, { stroke: C.ink, sw: 2 }) + path(`M${x + w - 18} ${y + 13} l4 4 l6 -8`, 'none', { stroke: '#FFFFFF', sw: 2.5 });
    if (st === 'rival') c += rr(x, y, w, h, 12, C.rival, { op: .2 }) + L.clipped(rr(x, y, w, h, 12, '#000'), [...Array(14)].map((_, k) => line(x - 40 + k * 14, y + h, x + k * 14, y, C.rival, 2, { op: .35 })).join('')) + rr(x, y, w, h, 12, 'none', { stroke: C.rival, sw: 4 }) + path(`M${x + w - 13} ${y + 3} l10 10 l-10 10 l-10 -10 Z`, C.rival, { stroke: C.ink, sw: 2 });
    return c;
  };
  s += dchip(0, 'Pudding Bomb', 'rival') + dchip(1, 'Marble Sack', 'you') + dchip(2, 'Mole Mail', 'focus') + dchip(3, 'Nosy Goose', 'free');
  // hint line and the Class that fires it best
  s += rr(574, 354, 574, 46, 12, '#FFFFFF', { stroke: C.ink, sw: 2 }) + text(590, 383, '"Bores through the hill, then bursts."', { size: 15, weight: 700, family: BODY }) + small(918, 383, 'Best with', { size: 13, weight: 700 }) + classIcon('delver', 998, 377, 12) + text(1016, 383, 'Delver', { size: 14.5, weight: 700 });
  s += text(576, 437, 'Yours', { size: 15, weight: 700 });
  s += rr(628, 410, 46, 46, 10, '#FFFFFF', { stroke: C.you, sw: 3.5 }) + g(shellIcon['Marble Sack'], 'translate(651 435) scale(.9)') + rr(682, 410, 46, 46, 10, '#FFFFFF', { stroke: C.you, sw: 2.5, extra: ' stroke-dasharray="5 4"' }) + text(705, 440, '2', { size: 17, weight: 700, anchor: 'middle', fill: C.you });
  s += text(752, 437, 'Theirs', { size: 15, weight: 700 });
  s += rr(808, 410, 46, 46, 10, '#FFFFFF', { stroke: C.rival, sw: 3.5 }) + g(shellIcon['Pudding Bomb'], 'translate(831 435) scale(.9)') + rr(862, 410, 46, 46, 10, '#FFFFFF', { stroke: C.rival, sw: 2.5, extra: ' stroke-dasharray="2 4"' }) + text(885, 440, '2', { size: 17, weight: 700, anchor: 'middle', fill: C.rivalD });
  s += rr(1000, 412, 148, 42, 14, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + rr(1000, 450, 148, 4, 2, C.ink, { op: .12 }) + text(1074, 439.5, 'Quick Pick', { size: 16.5, weight: 700, anchor: 'middle' });
  // one tap to fight
  s += small(44, 496, 'Last picks are kept. Nothing here needs a confirm.', { size: 13.5 }) + small(44, 516, 'Fight runs Quick Pick for any pick still open.', { size: 13.5 });
  s += rr(700, 472, 206, 54, 18, 'none', { stroke: C.you, sw: 3, extra: ' stroke-dasharray="7 5"' }) + button(706, 477, 194, 40, 'Same again', { fill: '#FFFFFF', dark: '#D8CDB8', size: 19 });
  s += button(924, 474, 228, 46, 'FIGHT', { size: 27 });
  out('21-pre-battle-screen-mockup.svg', phone(s, 'Pre-battle screen: one screen, one tap', 'Level card, Rival and habit, crew seats, Blueprint, Doodads and the draft strip on one sheet. "Same again" is the default on a replay. Fight always works.', sk.defs));
}

// ================================================================ 23 Grand Forts (04 §4)
const CHM = { W: 'wicker', T: 'timber', C: 'cobble', B: 'brass', F: 'footing' };
function rooms(layout) {
  const seen = new Set(), o = [];
  for (let r = 0; r < layout.length; r++) for (let c = 0; c < layout[0].length; c++) {
    const ch = layout[r][c];
    if ((ch === 'n' || ch === 'k') && !seen.has(r + ',' + c)) { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) seen.add((r + i) + ',' + (c + j)); o.push({ r, c, t: ch }); }
  }
  return o;
}
// A Flattener fort as a plain grid (no legs): blocks, cream stripes, Nooks, Kettle Room, crew. hedge: green skin on timber
function bossFort(x, y, layout, bs, o = {}) {
  const { crew = [], seed = 5, hedge = false, dmg = {} } = o;
  let s = '';
  const W = layout[0].length * bs;
  for (let r = 0; r < layout.length; r++) for (let c = 0; c < layout[0].length; c++) {
    const ch = layout[r][c], bx = x + c * bs, by = y + r * bs;
    if (CHM[ch]) {
      s += block(CHM[ch], bx, by, bs, dmg[`${r},${c}`] || 0, seed + r * 31 + c * 7);
      if (hedge && ch === 'T') s += rr(bx + 1, by + 1, bs - 2, bs - 2, bs * .12, '#5FAE52', { op: .86 }) + path(`M${f(bx + bs * .2)} ${f(by + bs * .35)} q${f(bs * .12)} ${f(-bs * .16)} ${f(bs * .24)} 0 M${f(bx + bs * .5)} ${f(by + bs * .7)} q${f(bs * .12)} ${f(-bs * .16)} ${f(bs * .24)} 0 M${f(bx + bs * .55)} ${f(by + bs * .3)} q${f(bs * .1)} ${f(-bs * .14)} ${f(bs * .2)} 0 M${f(bx + bs * .15)} ${f(by + bs * .75)} q${f(bs * .1)} ${f(-bs * .14)} ${f(bs * .2)} 0`, 'none', { stroke: '#3F8A3F', sw: Math.max(1.4, bs * .07) }) + rr(bx, by, bs, bs, bs * .1, 'none', { stroke: C.ink, sw: 2.2 });
    }
  }
  if (!hedge) for (let r = 1; r < layout.length - 1; r += 2) s += rr(x, y + r * bs - bs * .06, W, bs * .12, 0, C.fcream, { op: .7 });
  for (const rm of rooms(layout)) {
    const rx = x + rm.c * bs, ry = y + rm.r * bs, rw = 2 * bs, rh = 2 * bs;
    if (rm.t === 'n') {
      s += rr(rx, ry, rw, rh, 0, '#4A3530');
      for (let i = 1; i < 4; i++) s += line(rx, ry + rh * i / 4, rx + rw, ry + rh * i / 4, '#3B2A26', 2);
      s += rr(rx, ry + rh - bs * .18, rw, bs * .18, 0, WOOD, { stroke: C.ink, sw: 2 }) + circ(rx + rw * .8, ry + rh * .3, bs * .1, C.gold, { op: .9 }) + circ(rx + rw * .8, ry + rh * .3, bs * .22, C.gold, { op: .18 });
    } else {
      s += rr(rx, ry, rw, rh, 0, '#2E2A3A') + rr(rx, ry + rh - bs * .18, rw, bs * .18, 0, C.steelD, { stroke: C.ink, sw: 2 }) + kettle(rx + rw / 2, ry + rh - bs * .18, bs * 1.55 / 100 * 1.15, { glowOn: true });
    }
    s += rr(rx, ry, rw, rh, 0, 'none', { stroke: C.ink, sw: 3 });
  }
  for (const h of crew) s += flattener(h.t, x + (h.c + 1) * bs, y + (h.r + 2) * bs - bs * .18, bs * 1.5 / 100, { flip: true });
  return s;
}
// weak spot ring and callout pill
const weak = (x, y, r = 17) => circ(x, y, r, C.gold, { op: .22 }) + circ(x, y, r, 'none', { stroke: C.gold, sw: 4, extra: ' stroke-dasharray="7 5"' }) + circ(x, y, r, 'none', { stroke: C.ink, sw: 1.2, extra: ' stroke-dasharray="7 5"', op: .7 });
const call = (x, y, t, tx, ty) => {
  const w = t.length * 7.3 + 22;
  const ax = Math.max(x + 10, Math.min(x + w - 10, tx)), ay = ty > y ? y + 26 : y;
  return line(ax, ay, tx, ty, C.ink2, 2, { dash: '3 4' }) + circ(tx, ty, 3.5, C.ink2) + rr(x, y, w, 26, 13, C.ink2, { op: .94 }) + text(x + 11, y + 18, t, { size: 13.5, weight: 700, fill: '#FFFFFF' });
};
const face = (x, y, inner, name, sub) => circ(x, y, 46, C.rivalL, { stroke: C.ink, sw: 3 }) + L.clipped(circ(x, y, 43, '#000'), inner) + circ(x, y, 46, 'none', { stroke: C.rival, sw: 5 }) + circ(x, y, 48.5, 'none', { stroke: C.ink, sw: 2 }) +
  rr(x + 40, y - 24, Math.max(name.length * 9.3, sub.length * 7) + 30, 48, 12, C.paper, { stroke: C.ink, sw: 2.5 }) + text(x + 58, y - 3, name, { size: 16.5, weight: 700 }) + small(x + 58, y + 15, sub, { size: 12.5 });
const miniFort = (x, y) => fort(x, y, ['TTT', 'TnT'.replace('n', 'T'), 'FFF'], 15, { legs: 2, roofs: [{ c: 0, w: 2, h: 1, color: C.lobber }] });

function gfScene(i, W, H) {
  let s = '', defs = '';
  const sk = (a, b) => { const k = S.sky(W, H, a, b); defs += k.defs; s += k.body; };
  if (i === 0) {
    // ---- The Topiary Keep
    sk('#9ED8EC', '#FFF1D0');
    s += puff(250, 70, 18) + puff(500, 50, 13);
    s += S.quiltHill(-10, W + 10, H, [[0, 300], [200, 262], [460, 300], [700, 250], [W, 280]], '#B7DDA8', { patches: [L.patch(180, 320, 110, 60, -6, '#C6E5B5')] });
    const tops = [[0, 392], [130, 388], [260, 372], [380, 322], [500, 372], [640, 392], [W, 392]];
    s += S.ground(-10, W + 10, H + 10, tops, { seed: 3 });
    s += miniFort(46, 314);
    // Big Smoothie Jr. parked on the hill, with its sign
    s += g(flattener('smoothie', 0, 0, .78), 'translate(384 324)');
    s += line(300, 356, 300, 330, C.ink, 3) + g(rr(-34, -12, 68, 22, 3, CHINA, { stroke: C.ink, sw: 2.2 }) + text(0, 3.5, 'Keep off the grass', { size: 7.6, weight: 700, anchor: 'middle' }), 'translate(300 322) rotate(-4)');
    const bs = 27, fx = 628, fy = 392 - 8 * bs - 46;
    const lay = ['T.......', 'T.TnnTT.', 'TTTnnTTT', 'TnnTTnnT', 'TnnTTnnT', 'TkkTTTTT', 'TkkTTTTT', 'FFFFFFFF'];
    // tail fan (Rig Part) behind the keep
    for (let k = 0; k < 6; k++) { const a = -100 + k * 26; s += g(ell(0, -62, 21, 62, k % 2 ? '#6DB55E' : '#5AA555', { stroke: C.ink, sw: 3 }) + ell(0, -98, 9, 12, CHINA, { stroke: C.ink, sw: 2 }) + circ(0, -98, 4, '#3F8A3F'), `translate(${fx + 7.2 * bs} ${fy + 2.6 * bs}) rotate(${a + 60})`); }
    // stompers and pod
    s += rr(fx + 6, fy + 8 * bs - 4, 8 * bs - 12, 16, 6, C.steelD, { stroke: C.ink, sw: 3 });
    for (const lx of [fx + 24, fx + 4 * bs, fx + 8 * bs - 24]) s += L.stomper(lx, fy + 8 * bs + 4, .74, { paint: C.steelD, flat: true });
    s += bossFort(fx, fy, lay, bs, { hedge: true, dmg: { '2,6': 1 }, crew: [{ r: 1, c: 3, t: 'snipper' }, { r: 3, c: 1, t: 'rake' }, { r: 3, c: 5, t: 'snipper' }] });
    // peacock head on the neck, facing you
    s += circ(fx + bs * .5, fy - 14, 22, '#5FAE52', { stroke: C.ink, sw: 3 }) + path(`M${fx - 6} ${fy - 16} l-20 5 l19 7 Z`, C.gold, { stroke: C.ink, sw: 2.5 }) + circ(fx + 8, fy - 20, 3.6, C.ink) + circ(fx + 9, fy - 21, 1.2, '#FFF');
    for (const [dx, dy] of [[-4, -40], [10, -46], [24, -40]]) s += line(fx + bs * .5 + (dx - 10) * .4, fy - 34, fx + dx + 8, fy + dy - 4, C.ink, 2.5) + circ(fx + dx + 8, fy + dy - 6, 5, '#6DB55E', { stroke: C.ink, sw: 2 });
    // regrow sparkles on a hurt hedge block
    s += star4(fx + 6.5 * bs, fy + 2.3 * bs, 8, '#EFFFF0', { stroke: C.healD, sw: 1.5 }) + star4(fx + 6.9 * bs, fy + 2.8 * bs, 5, '#EFFFF0', { stroke: C.healD, sw: 1.2 });
    // giant shears folded on the roof
    const shx = fx + 3.4 * bs, shy = fy + bs + 2;
    s += g(path('M0 0 L70 -14 L64 -2 Z', C.steelL, { stroke: C.ink, sw: 2.5 }) + path('M0 0 L66 14 L64 2 Z', C.steelL, { stroke: C.ink, sw: 2.5 }) + circ(-16, -10, 9, 'none', { stroke: C.ink, sw: 7 }) + circ(-16, -10, 9, 'none', { stroke: C.rival, sw: 3.5 }) + circ(-16, 10, 9, 'none', { stroke: C.ink, sw: 7 }) + circ(-16, 10, 9, 'none', { stroke: C.rival, sw: 3.5 }) + circ(0, 0, 5, C.br, { stroke: C.ink, sw: 2 }), `translate(${shx} ${shy - 14}) rotate(-8) scale(1.25)`);
    // Sprinkler Root: low at the back
    const sx = fx + 8 * bs + 26, sy = 392;
    s += path(`M${fx + 8 * bs} ${fy + 6.6 * bs} L${sx} ${fy + 6.6 * bs} L${sx} ${sy - 4}`, 'none', { stroke: C.ink, sw: 11 }) + path(`M${fx + 8 * bs} ${fy + 6.6 * bs} L${sx} ${fy + 6.6 * bs} L${sx} ${sy - 4}`, 'none', { stroke: '#8A6A3A', sw: 6 }) + circ(sx, fy + 6.6 * bs, 9, C.br, { stroke: C.ink, sw: 2.5 });
    for (const [dx, dy] of [[-16, -22], [-4, -30], [12, -26], [22, -14]]) s += path(`M${sx + dx} ${fy + 6.6 * bs + dy} q2 -6 4 0 q-2 4 -4 0 Z`, '#BFE3F2', { stroke: C.ink, sw: 1.2 });
    s += weak(sx, fy + 6.6 * bs, 20) + weak(shx, shy - 14, 16);
    s += call(396, 150, 'Shears hinge: weak spot', shx - 6, shy - 18) + call(690, 424, 'Sprinkler Root: weak spot', sx, fy + 6.6 * bs + 20) + call(690, 20, 'Tail fan: Rig Part', fx + 7.6 * bs, fy - 1.2 * bs) + call(300, 232, 'Big Smoothie Jr.', 384, 262) + call(40, 250, 'You', 70, 300);
    s += face(64, 66, rr(0, 0, 200, 200, 0, C.rivalL, { op: .4 }) + flattener('snipper', 62, 126, 1.25, { flip: false }), 'Marshal Mowbray Trimm', 'The Neat Brigade');
  } else if (i === 1) {
    // ---- The Sanding Stair
    sk('#D6E2EA', '#F7F9FA');
    s += path('M-10 480 L-10 250 L80 240 L120 200 L260 200 L280 250 L340 260 L350 480 Z', '#C9CFD6', { stroke: C.ink, sw: 3, op: .9 });
    // your side: low ground with a ridge
    s += S.ground(-10, 420, H + 10, [[0, 418], [120, 414], [230, 386], [330, 424], [430, 424]], { seed: 6, grass: '#9DB35A', grassD: '#7E9244', loam: '#8E96A0', loamD: '#77808A', rock: '#6E757E', pebble: '#D9A441' });
    // the cliff with three ledges
    const cl = `M330 ${H + 10} L330 404 L352 388 L488 388 L500 304 L622 304 L634 220 L790 220 L800 60 L${W + 10} 44 L${W + 10} ${H + 10} Z`;
    s += L.clipped(path(cl, '#000'), rr(320, 0, 600, H + 10, 0, '#8E96A0') + rr(320, 250, 600, 16, 0, '#A8502E') + rr(320, 336, 600, 18, 0, '#D9A441') + rr(320, 420, 600, 16, 0, '#A8502E') + stitch('M330 284 L900 284', C.ink, 2, .25) + stitch('M330 372 L900 372', C.ink, 2, .25) + rr(800, 40, 100, 440, 0, C.ink, { op: .1 })) + path(cl, 'none', { stroke: C.ink, sw: 3.5 });
    s += miniFort(60, 340);
    // rockfall over your fort
    for (const [x, y, r] of [[80, 196, 13], [130, 236, 10], [186, 180, 8]]) s += line(x, y - r - 6, x, y - r - 30, C.ink2, 2, { dash: '3 5' }) + ell(x, y, r * 1.15, r, C.cb, { stroke: C.ink, sw: 2.5 }) + path(`M${x - r * .6} ${y - r * .3} q${r * .4} ${-r * .5} ${r * .8} ${-r * .4}`, 'none', { stroke: C.cbL, sw: 2.5 });
    for (let k = 0; k < 7; k++) s += circ(60 + k * 17, 284 + (k % 3) * 14, 2.5, '#CFC8C0');
    // the tower on the high ledge
    const bs = 16, fx = 652, fy = 220 - 10 * bs - 30;
    const lay = ['CCCCCCC', 'CnnCnnC', 'CnnCnnC', 'CCCCCCC', '.CCCCC.', '.CnnCC.', '.CnnCC.', '.CkkCC.', '.CkkCC.', 'FFFFFFF'];
    s += rr(fx + 6, fy + 10 * bs - 4, 7 * bs - 12, 12, 5, C.steelD, { stroke: C.ink, sw: 3 });
    for (const lx of [fx + 16, fx + 3.5 * bs, fx + 7 * bs - 16]) s += L.stomper(lx, fy + 10 * bs + 2, .46, { paint: C.steelD, flat: true });
    s += bossFort(fx, fy, lay, bs, { seed: 9, crew: [{ r: 1, c: 1, t: 'sniper' }, { r: 1, c: 4, t: 'tamper' }, { r: 5, c: 2, t: 'filler' }] });
    // three Prop Beams hold the heavy top
    const beam = (x1, y1, x2, y2) => line(x1, y1, x2, y2, C.ink, 9) + line(x1, y1, x2, y2, C.tb, 5) + line(x1, y1, x2, y2, C.tbL, 1.5);
    const B = [[fx + 2, fy + 4 * bs + 2, fx + bs + 2, fy + 6.2 * bs], [fx + 2, fy + 4 * bs + 2, fx + bs + 2, fy + 8.6 * bs], [fx + 7 * bs - 2, fy + 4 * bs + 2, fx + 6 * bs - 2, fy + 6.8 * bs]];
    B.forEach(b => s += beam(...b));
    s += weak(fx + 6, fy + 5 * bs, 12) + weak(fx + 9, fy + 7 * bs, 12) + weak(fx + 7 * bs - 7, fy + 5.4 * bs, 12);
    // flag
    s += line(fx + 7 * bs - 8, fy, fx + 7 * bs - 8, fy - 26, C.ink, 3) + rr(fx + 7 * bs - 30, fy - 26, 22, 13, 1, C.indigoL, { stroke: C.ink, sw: 2 }) + rr(fx + 7 * bs - 30, fy - 17, 22, 4, 0, C.rival);
    // lift rail down the ledges
    s += path('M636 226 L636 300 M502 310 L502 384', 'none', { stroke: C.ink, sw: 5 }) + path('M636 226 L636 300 M502 310 L502 384', 'none', { stroke: C.br, sw: 2, dash: '4 4' });
    s += path('M628 262 l8 10 l8 -10 M494 346 l8 10 l8 -10', 'none', { stroke: C.ink, sw: 2.5 });
    // the Sanding Wheel on the cliff face
    const wx = 548, wy = 236, wr = 54;
    s += line(wx, wy, 600, 304, C.ink, 12) + line(wx, wy, 600, 304, C.steelD, 7);
    s += circ(wx, wy, wr, '#D9C7A0', { stroke: C.ink, sw: 3.5 }) + circ(wx, wy, wr - 9, '#C9B58C', { stroke: C.ink, sw: 2 });
    { const R = L.rng(4); for (let k = 0; k < 46; k++) { const a = R() * 6.28, r = 14 + R() * 36; s += circ(wx + Math.cos(a) * r, wy + Math.sin(a) * r, 1.6, '#8A7A5A'); } }
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; s += line(wx + Math.cos(a) * 14, wy + Math.sin(a) * 14, wx + Math.cos(a) * 40, wy + Math.sin(a) * 40, C.ink, 2, { op: .35 }); }
    s += circ(wx, wy, 13, C.gold, { stroke: C.ink, sw: 3 }) + circ(wx, wy, 5, C.br, { stroke: C.ink, sw: 1.5 });
    s += path(`M${wx - wr - 6} ${wy - 22} q-12 22 0 44 M${wx - wr - 16} ${wy - 12} q-7 12 0 24`, 'none', { stroke: C.ink, sw: 2.5 });
    for (const [dx, dy] of [[-64, 44], [-52, 60], [-70, 66]]) s += star4(wx + dx, wy + dy, 5, C.gold, { stroke: C.ink, sw: 1.2 });
    s += weak(wx, wy, 21);
    // ledge tags
    const ledge = (x, y, n, t) => circ(x, y, 13, C.saffron, { stroke: C.ink, sw: 2.5 }) + text(x, y + 5.5, n, { size: 15, weight: 700, anchor: 'middle' }) + small(x + 20, y + 5, t, { size: 13, weight: 700, fill: C.ink });
    s += ledge(820, 250, '1', 'High') + ledge(662, 330, '2', 'Middle ledge') + ledge(520, 412, '3', 'Low ledge');
    s += call(360, 150, 'Wheel hub: weak spot', wx - 6, wy - 22) + call(420, 60, 'Prop Beams: three weak spots', fx - 2, fy + 4.6 * bs) + call(210, 132, 'Rockfall', 190, 168) + call(180, 330, 'You', 110, 356);
    s += face(64, 66, rr(0, 0, 200, 200, 0, C.rivalL, { op: .4 }) + flattener('filler', 62, 126, 1.25, { flip: false }), 'Dame Grindella Scree', 'The Chisel Corps');
  } else if (i === 2) {
    // ---- The Great Sump
    sk('#BFD9C8', '#F1F4E2');
    s += S.quiltHill(-10, W + 10, H, [[0, 250], [240, 222], [520, 256], [W, 232]], '#A9C8A0', {});
    s += ell(460, 232, 380, 16, '#FFFFFF', { op: .45 });
    s += S.tree(250, 300, .8, '#6F9A5A') + S.tree(860, 286, .7, '#6F9A5A');
    const WL = 356;
    // far bank and your bank
    s += S.ground(-10, 250, H + 10, [[0, 330], [110, 326], [190, 350], [250, 400]], { seed: 4, grass: '#8FAE4A', grassD: '#6F8E3A', loam: '#6E5A3E', loamD: '#55452E' });
    s += miniFort(50, 252);
    // water
    s += path(`M196 ${WL} L${W + 10} ${WL} L${W + 10} ${H + 10} L150 ${H + 10} Z`, '#5FA8A0', { stroke: C.ink, sw: 3 }) + path(`M196 ${WL + 40} L${W} ${WL + 40} L${W} ${H} L170 ${H} Z`, '#4E948C', { op: .6 });
    for (const [x, y, w] of [[260, 372, 40], [420, 384, 60], [690, 440, 50], [330, 430, 44], [800, 420, 40]]) s += line(x, y, x + w, y, '#FFFFFF', 3, { op: .7 });
    s += ell(330, 366, 16, 5, '#6FBF6A', { stroke: C.ink, sw: 2 }) + circ(332, 362, 4.5, '#E27FA0', { stroke: C.ink, sw: 1.5 });
    // Water Line pole on your bank
    s += line(214, 300, 214, 420, C.ink, 7) + line(214, 300, 214, 420, CHINA, 4) + [0, 1, 2, 3, 4].map(k => line(207, 312 + k * 22, 221, 312 + k * 22, C.ink, 2)).join('') + path(`M226 ${WL} l12 -6 l0 12 Z`, C.danger, { stroke: C.ink, sw: 1.5 });
    // Mud Raft with one Silt Lobber
    s += rr(300, WL - 10, 96, 14, 4, WOOD, { stroke: C.ink, sw: 2.5 }) + line(318, WL - 10, 318, WL + 4, C.ink, 1.5) + line(346, WL - 10, 346, WL + 4, C.ink, 1.5) + line(372, WL - 10, 372, WL + 4, C.ink, 1.5);
    s += block('timber', 304, WL - 34, 24, 0, 2) + block('timber', 304, WL - 58, 24, 1, 3) + flattener('pump', 360, WL - 10, .44, { flip: true });
    // Spray Curtain in front of the barge
    const cx = 470;
    s += path(`M${cx - 22} ${WL} C${cx - 30} 260 ${cx - 14} 170 ${cx - 20} 120 L${cx + 20} 120 C${cx + 14} 190 ${cx + 30} 270 ${cx + 22} ${WL} Z`, '#BFE3F2', { op: .7, stroke: C.ink, sw: 2, dash: '8 6' });
    for (let k = 0; k < 6; k++) s += path(`M${cx - 14 + k * 6} ${WL - 8} C${cx - 18 + k * 6} 270 ${cx - 8 + k * 6} 190 ${cx - 14 + k * 6} 134`, 'none', { stroke: '#FFFFFF', sw: 2.2, op: .8 });
    s += puff(cx - 14, 116, 11, '#FFFFFF') + puff(cx + 14, 122, 9, '#FFFFFF') + puff(cx, WL - 4, 14, '#FFFFFF');
    s += line(cx + 34, 120, cx + 34, WL, C.ink, 1.5, { dash: '2 4' }) + path(`M${cx + 28} 120 l12 0 M${cx + 28} ${WL} l12 0`, 'none', { stroke: C.ink, sw: 2 });
    // a high lob clears it
    S.arcPts(120, 250, 150, -210, 150, 0, 22, .12).forEach(([x, y], k) => { if (k > 1 && k % 2 === 0 && x < 600) s += circ(x, y, 3.2, '#FFFFFF', { stroke: C.ink, sw: 1.2 }); });
    // the barge: hull (Rig Part) and paddle wheel
    const hx = 536, hy = WL - 22;
    s += circ(844, hy + 6, 50, WOOD, { stroke: C.ink, sw: 3.5 }) + circ(844, hy + 6, 36, '#5FA8A0', { stroke: C.ink, sw: 2.5, op: .5 });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + .2; s += line(844, hy + 6, 844 + Math.cos(a) * 48, hy + 6 + Math.sin(a) * 48, C.ink, 7) + line(844, hy + 6, 844 + Math.cos(a) * 48, hy + 6 + Math.sin(a) * 48, C.tbL, 3.5); }
    s += circ(844, hy + 6, 9, C.br, { stroke: C.ink, sw: 2.5 });
    const hull = `M${hx - 26} ${hy} L${hx + 300} ${hy} L${hx + 284} ${hy + 62} L${hx + 14} ${hy + 62} Z`;
    s += L.clipped(path(hull, '#000'), rr(hx - 30, hy, 340, 70, 0, C.tb) + rr(hx - 30, hy + 22, 340, 3, 0, C.tbD) + rr(hx - 30, hy + 42, 340, 3, 0, C.tbD) + rr(hx - 30, hy, 340, 9, 0, C.fcream) + rr(hx - 30, hy + 9, 340, 6, 0, C.rival) + rr(hx - 30, hy + 22, 340, 48, 0, '#5FA8A0', { op: .35 })) + path(hull, 'none', { stroke: C.ink, sw: 3.5 });
    const bs = 25, fx = hx + 44, fy = hy - 6 * bs;
    const lay = ['TTTTTTTT', 'TnnTTnnT', 'TnnTTnnT', 'CCkkCnnC', 'CCkkCnnC', 'FFFFFFFF'];
    s += bossFort(fx, fy, lay, bs, { seed: 12, crew: [{ r: 1, c: 1, t: 'pump' }, { r: 1, c: 5, t: 'pump' }, { r: 3, c: 5, t: 'rake' }] });
    s += line(fx + 8 * bs - 10, fy, fx + 8 * bs - 10, fy - 34, C.ink, 3.5) + rr(fx + 8 * bs - 40, fy - 34, 30, 18, 1, C.indigoL, { stroke: C.ink, sw: 2.2 }) + rr(fx + 8 * bs - 40, fy - 22, 30, 6, 0, C.rival);
    // three pumps stick out of the deck
    const pump = (x, y, k = 1) => g(rr(-9, -34, 18, 34, 4, C.br, { stroke: C.ink, sw: 2.5 }) + rr(-12, -40, 24, 8, 3, C.brD, { stroke: C.ink, sw: 2.2 }) + line(0, -40, 0, -54, C.ink, 3.5) + rr(-11, -58, 22, 6, 3, C.steelD, { stroke: C.ink, sw: 2 }) + path('M-9 -22 L-22 -22 L-22 -12', 'none', { stroke: C.ink, sw: 7 }) + path('M-9 -22 L-22 -22 L-22 -12', 'none', { stroke: C.steel, sw: 3.5 }) + line(-5, -28, -5, -8, C.brL, 2.2), `translate(${x} ${y}) scale(${k})`);
    const PP = [[hx + 14, hy], [fx + 3.2 * bs, fy], [hx + 274, hy]];
    PP.forEach(([x, y]) => s += pump(x, y, .95) + weak(x, y - 26, 21));
    for (let k = 0; k < 6; k++) s += path(`M${126 + k * 9 + (k > 2 ? 690 : 0)} 330 q3 -22 1 -32`, 'none', { stroke: '#6F8E3A', sw: 3 });
    s += call(560, 26, 'Pumps: three weak spots', PP[1][0], PP[1][1] - 50) + call(250, 160, 'Spray Curtain: a shield', cx - 20, 200) + call(240, 430, 'Mud Raft with a Silt Lobber', 350, WL + 8) + call(226, 270, 'Water Line', 218, 306) + call(640, 432, 'Hull: Rig Part', hx + 150, hy + 44) + call(20, 220, 'You', 70, 244);
    s += face(64, 66, rr(0, 0, 200, 200, 0, C.rivalL, { op: .4 }) + flattener('pump', 62, 126, 1.25, { flip: false }), 'Admiral Dabney Drainwell', 'The Drain Fleet');
  } else {
    // ---- The Last Level: Stage 1, the Grand Roller
    sk('#DCD6E4', '#F7F4F0');
    const GY = 392;
    s += rr(-10, 250, W + 20, 30, 0, '#CFC8C0', { stroke: C.ink, sw: 2, op: .7 });
    for (let k = 0; k < 3; k++) s += line(396 + k * 150, 196, 396 + k * 150, 252, C.ink, 3, { op: .6 }) + rr(396 + k * 150, 196, 32, 20, 2, '#A8ABB2', { stroke: C.ink, sw: 2, op: .7 });
    s += rr(-10, 280, W + 20, GY - 280, 0, '#E1DED8');
    // pressed plate
    s += rr(-10, GY, W + 20, 110, 0, '#A8ABB2', { stroke: C.ink, sw: 3 });
    for (let k = 0; k < 18; k++) s += rr(-10 + k * 52, GY + 4, 26, 100, 0, '#969AA2', { op: .55 }) + circ(10 + k * 52, GY + 54, 2.5, '#6E727A');
    s += L.clipped(rr(-10, GY, W + 20, 9, 0, '#000'), rr(-10, GY, W + 20, 9, 0, '#F2C200') + [...Array(64)].map((_, k) => path(`M${k * 14} ${GY + 9} l7 -9 l6 0 l-7 9 Z`, C.ink, { op: .75 })).join('')) + line(-10, GY, W + 10, GY, C.ink, 3);
    // your fort and Hill Call mounds: you win by making it lumpy again
    s += miniFort(36, GY - 76);
    const mound = (x, w, h) => path(`M${x - w / 2} ${GY + 1} Q${x} ${GY - h * 2} ${x + w / 2} ${GY + 1} Z`, '#9A6440', { stroke: C.ink, sw: 3 }) + path(`M${x - w / 2 + 6} ${GY - 3} Q${x} ${GY - h * 2 + 8} ${x + w / 2 - 6} ${GY - 3}`, 'none', { stroke: '#7CC46A', sw: 8 }) + path(`M${x - 9} ${GY - h + 8} q4 3 8 0 M${x + 3} ${GY - h + 8} q4 3 8 0`, 'none', { stroke: C.ink, sw: 2, op: .6 });
    s += mound(168, 84, 34) + mound(262, 96, 44) + mound(352, 70, 26);
    s += star4(262, GY - 62, 8, '#EFFFF0', { stroke: C.healD, sw: 1.5 }) + star4(282, GY - 52, 5, '#EFFFF0', { stroke: C.healD, sw: 1.2 });
    // dotted path and the 300 mark
    s += line(372, GY - 14, 470, GY - 14, C.ink, 3, { dash: '2 9' }) + path(`M384 ${GY - 22} l-12 8 l12 8`, 'none', { stroke: C.ink, sw: 3 });
    s += line(400, GY, 400, GY - 70, C.ink, 3) + rr(400, GY - 70, 44, 22, 3, CHINA, { stroke: C.ink, sw: 2.2 }) + text(422, GY - 54, '300', { size: 13, weight: 700, anchor: 'middle' });
    // The Grand Roller: drum (Rig Part), chassis, boiler, chimney
    const dx = 548, dr = 92, dy = GY - dr;
    const px = 610, py = GY - 132;
    s += circ(842, GY - 30, 30, C.steelD, { stroke: C.ink, sw: 3.5 }) + circ(842, GY - 30, 11, C.br, { stroke: C.ink, sw: 2 });
    s += rr(px, py, 262, 96, 12, C.indigoD, { stroke: C.ink, sw: 3.5 }) + rr(px, py + 30, 262, 16, 0, C.rival, { stroke: C.ink, sw: 2 }) + text(px + 150, py + 72, 'THE GRAND ROLLER', { size: 15, weight: 700, anchor: 'middle', fill: C.fcream, ls: 1.5 });
    for (let k = 0; k < 9; k++) s += circ(px + 30 + k * 26, py + 10, 2.5, C.steelL);
    // boiler and chimney at the back
    s += rr(820, py - 62, 52, 64, 12, C.br, { stroke: C.ink, sw: 3 }) + rr(820, py - 40, 52, 6, 0, C.brD) + rr(820, py - 20, 52, 6, 0, C.brD) + circ(846, py - 50, 5, CHINA, { stroke: C.ink, sw: 1.5 });
    s += rr(836, py - 118, 18, 58, 3, '#3A3236', { stroke: C.ink, sw: 2.5 }) + puff(848, py - 132, 15, '#ECECF4') + puff(872, py - 160, 10, '#ECECF4');
    // drum
    s += circ(dx, dy, dr, C.steelD, { stroke: C.ink, sw: 4 }) + circ(dx, dy, dr - 16, C.steel, { stroke: C.ink, sw: 3 });
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; s += line(dx + Math.cos(a) * (dr - 14), dy + Math.sin(a) * (dr - 14), dx + Math.cos(a) * (dr - 2), dy + Math.sin(a) * (dr - 2), C.steelL, 5); }
    s += path(`M${dx - 52} ${dy - 34} A62 62 0 0 1 ${dx - 6} ${dy - 62}`, 'none', { stroke: C.steelL, sw: 7, op: .8 });
    // Drive Gear at the hub
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; s += rr(dx + Math.cos(a) * 30 - 6, dy + Math.sin(a) * 30 - 6, 12, 12, 2.5, C.br, { stroke: C.ink, sw: 2 }); }
    s += circ(dx, dy, 30, C.br, { stroke: C.ink, sw: 3 }) + circ(dx, dy, 12, C.rival, { stroke: C.ink, sw: 2.5 }) + rr(dx - 8, dy - 2.5, 16, 5, 2, C.paper);
    // the Baron's 7 x 6 fort rides on the chassis
    const bs = 21, fx = px + 62, fy = py - 6 * bs;
    const lay = ['BBBBBBB', 'BnnBnnB', 'BnnBnnB', 'CkkCnnC', 'CkkCnnC', 'FFFFFFF'];
    s += bossFort(fx, fy, lay, bs, { seed: 17, crew: [{ r: 1, c: 1, t: 'sniper' }, { r: 1, c: 4, t: 'clerk' }, { r: 3, c: 4, t: 'tamper' }] });
    for (let k = 0; k < 7; k++) s += rr(fx + k * bs + 3, fy - 10, bs - 6, 10, 2, C.steel, { stroke: C.ink, sw: 2 });
    s += baron(fx + 2.4 * bs, fy - 10, .4, 'smug');
    s += line(fx + 7 * bs - 10, fy - 10, fx + 7 * bs - 10, fy - 50, C.ink, 3.5) + rr(fx + 7 * bs - 44, fy - 50, 34, 20, 1, C.indigoL, { stroke: C.ink, sw: 2.2 }) + rr(fx + 7 * bs - 44, fy - 37, 34, 7, 0, C.rival) + line(fx + 7 * bs - 40, fy - 43, fx + 7 * bs - 16, fy - 43, C.ink, 1.5);
    s += weak(dx, dy, 40) + weak(846, py - 30, 26);
    // Hill Call button
    s += circ(96, 84, 36, '#5CC35A', { stroke: C.ink, sw: 3 }) + path('M74 98 Q96 54 118 98 Z', '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + path('M96 62 l0 -12 M90 56 l12 0', 'none', { stroke: C.ink, sw: 3 }) + text(96, 146, 'Hill Call', { size: 17, weight: 700, anchor: 'middle' }) + small(96, 166, 'one mound each turn', { size: 12.5, anchor: 'middle' });
    // Stage 2 inset: the Level Engine
    {
      const ix = 250, iy = 16, iw = 236, ih = 168;
      s += rr(ix, iy, iw, ih, 14, C.paper, { stroke: C.ink, sw: 3 }) + text(ix + 14, iy + 26, 'Stage 2: the Level Engine', { size: 14.5, weight: 700 });
      const ex = ix + 34, ey = iy + 78;
      s += rr(ex, ey, 168, 62, 6, C.steelD, { stroke: C.ink, sw: 2.5 }) + rr(ex, ey + 44, 168, 8, 0, C.rival) + rr(ix + 6, iy + 140, iw - 12, 22, 0, '#9FD0DE', { op: .8 }) + line(ix + 6, iy + 140, ix + iw - 6, iy + 140, C.ink, 2);
      for (let k = 0; k < 3; k++) s += rr(ex + 14 + k * 50, ey + 10, 40, 16, 8, '#C9F7B0', { stroke: C.ink, sw: 2 }) + circ(ex + 26 + k * 50 + k * 4, ey + 18, 4, C.good, { stroke: C.ink, sw: 1.2 }) + circ(ex + 34 + k * 50, ey + 18, 13, 'none', { stroke: C.gold, sw: 2.5, extra: ' stroke-dasharray="4 3"' });
      for (let c = 0; c < 5; c++) for (let r = 0; r < 2; r++) s += block(r ? 'cobble' : 'brass', ex + 49 + c * 14, ey - 28 + r * 14, 14, 0, c + r * 5);
      s += path(`M${ex + 168} ${ey + 8} l22 -26 l10 6`, 'none', { stroke: C.ink, sw: 6 }) + path(`M${ex + 168} ${ey + 8} l22 -26 l10 6`, 'none', { stroke: C.steel, sw: 3 }) + rr(ex + 190, ey - 14, 22, 9, 2, C.steelD, { stroke: C.ink, sw: 2 });
      s += small(ix + 14, iy + 46, 'Three Level Bubbles. The water rises.', { size: 11.5 });
    }
    s += call(380, 214, 'Drive Gear: weak spot', dx - 10, dy - 40) + call(744, 12, 'Boiler: weak spot', 868, py - 66) + call(520, 428, 'Drum: Rig Part. It flattens the ground', dx + 30, dy + 70) + call(150, 428, 'Mounds stop the Roller for a turn', 262, GY - 30) + call(576, 84, 'The Baron', fx + 1.5 * bs, fy - 56);
  }
  return { s, defs };
}
if (want('23')) {
  const PW = 890, PH = 470, W = 1900, H = 1330;
  let s = rr(0, 0, W, H, 0, C.paper) + rr(0, 0, W, H, 0, 'url(#paperDots)'), defs = '';
  s += text(40, 64, 'The four launch Grand Forts', { size: 42, weight: 700 }) + small(40, 96, 'One per region. Every boss kettle has 300 HP; phases, Rig Parts and weak spots do the gating. Names and rules follow 04-enemies-bosses-ai.', { size: 18 });
  const CAP = [
    ['Grand Fort 1: The Topiary Keep', 'Puddingstone Downs. An 8 x 8 Timber fort clipped like a hedge peacock.', ['1 Evergreen: hedges regrow', '2 Mowing Day: the roller rolls', '3 The Big Snip: shears cut']],
    ['Grand Fort 2: The Sanding Stair', 'Crumblecrag. A 7 x 10 Cobble tower that rides a lift down three ledges.', ['1 High Ledge: Rockfall', '2 The Wheel Turns: a shield', '3 Down to Gravel: ridge melts']],
    ['Grand Fort 3: The Great Sump', 'Soggybottom Fen. An 8 x 6 Timber and Cobble fort on a paddle-wheel barge.', ['1 Spray Curtain', '2 Drain Day: mud flats', '3 High Tide: the flood']],
    ['Grand Fort 4: The Last Level', "The Flats. The Baron's 7 x 6 fort on the Grand Roller, then the Level Engine.", ['Stage 1: the Grand Roller', 'Stage 2: the Level Engine', 'Hill Call from the first turn']],
  ];
  CAP.forEach(([t, sub, ph], i) => {
    const x = 40 + (i % 2) * (PW + 40), y = 124 + Math.floor(i / 2) * (PH + 132);
    const r = gfScene(i, PW, PH); defs += r.defs;
    s += L.clipped(rr(x, y, PW, PH, 20, '#000'), g(r.s, `translate(${x} ${y})`)) + rr(x, y, PW, PH, 20, 'none', { stroke: C.ink, sw: 3.5 });
    s += text(x + 4, y + PH + 38, t, { size: 27, weight: 700 }) + small(x + 4, y + PH + 62, sub, { size: 15.5 });
    let px = x + 4;
    ph.forEach((p, k) => { const w = p.length * 8 + 26; s += rr(px, y + PH + 76, w, 30, 15, k === 0 ? C.saffronL : '#FFFFFF', { stroke: C.ink, sw: 2.2 }) + text(px + w / 2, y + PH + 96.5, p, { size: 14.5, weight: 700, anchor: 'middle' }); px += w + 10; });
  });
  out('23-grand-forts.svg', doc(W, H, s, { title: 'Grand Forts', desc: 'The four launch Grand Forts: Topiary Keep, Sanding Stair, Great Sump, and the Last Level with the Grand Roller', defs }));
}
