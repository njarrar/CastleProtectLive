// Looks of the 8 v0.1 Hobs. Copied from the roster in gen-d.mjs (sheet 22) so that
// sprite builds do not rerun the concept sheet generators.
import * as L from './lib.mjs';
const { C, rr, circ, ell, path, line, g, star4, shade } = L;
const ink = C.ink;
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

export const ROSTER = [
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
  { cls: 'zinger', name: 'Quill Needlesworth', touch: ['Bill cap with a pincushion', 'crown and a quill plume.'], o: {
    coat: '#3F4A6A', skin: L.SKINS[2],
    hatSvg: path('M-6 -86 C-12 -100 -18 -112 -30 -118 C-18 -116 -6 -106 0 -90 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) + line(-24, -113, -6, -90, C.ink2, 1.2) + zingCap(C.zinger) +
      path('M-14 -80 L-4 -90 M-4 -76 L8 -88 M-12 -90 L0 -78 M0 -92 L12 -80', 'none', { stroke: dk(C.zinger), sw: 1.6 }) +
      [[-9, -92, -13], [-1, -94, -3], [7, -93, 10], [14, -88, 21]].map(([x, y, x2]) => line(x, y, x2, y - 15, ink, 3.2) + line(x, y, x2, y - 15, C.steelL, 1.4) + circ(x2, y - 16, 3.2, CHINA, { stroke: ink, sw: 1.6 })).join(''),
    toolSvg: line(14, -26, 54, -44, ink, 5) + line(14, -26, 54, -44, C.steelL, 2.2) + circ(15, -26, 4, CHINA, { stroke: ink, sw: 1.8 }),
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
  { cls: 'delver', name: 'Grub Mudgett', touch: ['Hard dome so big it hides his', 'eyes. A candle on top.'], o: {
    coat: '#7A5A44', skin: L.SKINS[5], bodyAdd: ell(-10, -14, 9, 5, '#4A3328', { op: .6 }) + ell(12, -26, 6, 4, '#4A3328', { op: .6 }),
    hatSvg: rr(-3.5, -116, 7, 16, 1.5, CHINA, { stroke: ink, sw: 2.2 }) + flame(0, -116, 1) + path('M-27 -63 C-29 -106 29 -106 27 -63 Z', C.delver, { stroke: ink, sw: 3 }) + path('M-2 -100 L2 -100 L3 -64 L-3 -64 Z', dk(C.delver)) + path('M-17 -84 C-12 -92 -4 -95 2 -95', 'none', { stroke: lt(C.delver), sw: 3 }) + path('M-30 -66 L30 -66 L36 -58 L-30 -58 Z', dk(C.delver), { stroke: ink, sw: 3 }),
    toolSvg: line(20, -22, 34, -46, ink, 6) + line(20, -22, 34, -46, WOOD, 3) + path('M34 -46 l8 -3 l-5 -7 l9 -2 l-5 -7 l8 -3', 'none', { stroke: ink, sw: 5.5 }) + path('M34 -46 l8 -3 l-5 -7 l9 -2 l-5 -7 l8 -3', 'none', { stroke: C.steelL, sw: 2.5 }),
  } },
  { cls: 'boinker', name: 'Bobbin Springheel', touch: ['Beanie and spring, with a boot', 'on top. Laces fly.'], o: {
    coat: '#5F9A4A', skin: L.SKINS[1], bodyAdd: apron('#C9A27A'),
    hatSvg: spring + path('M-8 -126 L-8 -102 L13 -102 C14 -109 8 -112 2 -112 L2 -126 Z', WOOD, { stroke: ink, sw: 2.5 }) + rr(-9, -103, 23, 4.5, 2, '#4A3328', { stroke: ink, sw: 1.5 }) + path('M2 -122 C10 -128 14 -122 20 -128 M2 -117 C10 -119 14 -114 22 -118', 'none', { stroke: ink, sw: 4 }) + path('M2 -122 C10 -128 14 -122 20 -128 M2 -117 C10 -119 14 -114 22 -118', 'none', { stroke: CHINA, sw: 1.8 }) + beanie(C.boinker),
  } },
  { cls: 'patcher', name: 'Hetty Mortarboard', touch: ["Flat cap under a mason's board", 'with a blob of mortar.'], o: {
    coat: '#A8483A', skin: L.SKINS[3], bodyAdd: apron('#A9A39A'),
    hatSvg: trowelBack + flatCap(C.patcher) + capBill(C.patcher) + path('M-16 -84 C-6 -90 6 -90 14 -86', 'none', { stroke: lt(C.patcher), sw: 2.5 }) +
      g(rr(-25, -4, 50, 7, 1.5, '#C9A27A', { stroke: ink, sw: 2.5 }) + path('M-10 -4 C-13 -15 0 -19 5 -13 C13 -17 17 -7 12 -4 Z', C.cbL, { stroke: ink, sw: 2.5 }), 'translate(0 -93) rotate(-5)'),
    toolSvg: line(20, -26, 34, -40, ink, 6.5) + line(20, -26, 34, -40, WOOD, 3.5) + path('M30 -44 L58 -62 L42 -32 Z', C.steelL, { stroke: ink, sw: 2.5 }),
  } },
];
