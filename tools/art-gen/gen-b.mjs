// Logo, key art, walking fort cutaway
import fs from 'fs';
import * as L from './lib.mjs';
import * as S from './scene.mjs';
const { C, doc, text, rr, circ, ell, path, line, g, block, hob, flattener, kettle, fort, stomper, stitch, star4, puff, burst, f } = L;
const ART = '/home/user/CastleProtect/docs/art';
const out = (name, svg) => { fs.writeFileSync(`${ART}/${name}`, svg); console.log('wrote', name); };

const PLAYER_FORT = [
  'WTTTTTTW',
  'TnnTTnnl',
  'TnnTTnnl',
  'CCCkkCCC',
  'CCCkkCCC',
  'CnnCCnnl',
  'CnnCCnnl',
  'FFFFFFFF',
];
const PLAYER_CREW = [
  { r: 1, c: 1, cls: 'lobber', skin: L.SKINS[0], coat: L.COATS[0] },
  { r: 1, c: 5, cls: 'zinger', skin: L.SKINS[2], coat: L.COATS[1], face: 'grit' },
  { r: 5, c: 1, cls: 'patcher', skin: L.SKINS[3], coat: L.COATS[3] },
  { r: 5, c: 5, cls: 'delver', skin: L.SKINS[1], coat: L.COATS[2] },
];

export function logoMark(x, y, s = 1) {
  // chunky two-line logotype with ink outline, saffron fill, cream bevel
  const t = (str, yy, size) =>
    text(0, yy + 10, str, { size, weight: 700, anchor: 'middle', fill: C.ink, stroke: C.ink, sw: 26, ls: 2 }) +
    text(0, yy, str, { size, weight: 700, anchor: 'middle', fill: C.ink, stroke: C.ink, sw: 26, ls: 2 }) +
    text(0, yy, str, { size, weight: 700, anchor: 'middle', fill: C.saffron, stroke: C.saffronD, sw: 6, ls: 2 }) +
    text(0, yy - 5, str, { size, weight: 700, anchor: 'middle', fill: C.saffronL, ls: 2, op: .55 });
  let b = '';
  b += t('CASTLE', -10, 150);
  b += t('PROTECT', 130, 150);
  // ribbon
  b += path('M-330 170 L330 170 L310 200 L330 230 L-330 230 L-310 200 Z', C.you, { stroke: C.ink, sw: 5 });
  b += text(0, 214, 'THE UNFLATTENING', { size: 34, weight: 700, anchor: 'middle', fill: C.paper, ls: 6 });
  b += stitch('M-300 180 L300 180 M-300 220 L300 220', C.paper, 2, .6, '7 6');
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

// ---------------------------------------------------------- 01 logo / title card
{
  const W = 1600, H = 900;
  const sk = S.sky(W, H, '#8FD3EA', '#FFE9BE');
  let s = sk.body;
  s += S.sunDisc(1320, 170, 70);
  s += puff(260, 160, 40) + puff(1120, 110, 30) + puff(560, 90, 26);
  s += S.quiltHill(0, W, H, [[0, 600], [300, 520], [620, 600], [980, 500], [1300, 580], [1600, 520]], '#A8D98F', { patches: [L.patch(330, 600, 180, 110, -5, '#B9E3A0'), L.patch(1010, 580, 220, 120, 4, '#98CF84')] });
  s += S.ground(0, W, H, [[0, 760], [250, 700], [500, 770], [800, 760], [1100, 740], [1350, 690], [1600, 740]], { seed: 3 });
  // little fort walking at left, flatteners roller at right
  const mini = ['TTTT', 'TnnT', 'TnnT', 'FFFF'];
  s += fort(150, 520, mini, 34, { crew: [{ r: 1, c: 1, cls: 'lobber' }], roofs: [{ c: 0, w: 4, h: 1.3, color: C.lobber }], legs: 2, legPose: [-.6, .6] });
  s += puff(110, 640, 14, '#FFFFFF');
  s += flattener('smoothie', 1370, 742, 1.6);
  s += S.windFlag(1040, 742, 1.2, 5);
  s += logoMark(800, 330, 1);
  s += rr(650, 585, 300, 64, 32, C.paper, { stroke: C.ink, sw: 4 }) + text(800, 628, 'Tap to play', { size: 32, weight: 700, anchor: 'middle' });
  out('01-logo-title.svg', doc(W, H, s, { title: 'Castle Protect title card', desc: 'Logo and title screen concept', defs: sk.defs }));
}

// ---------------------------------------------------------- 02 key art
{
  const W = 1920, H = 1080;
  const sk = S.sky(W, H, '#7FC6E6', '#FFE2B0');
  let s = sk.body;
  s += S.sunDisc(1720, 130, 60);
  s += puff(560, 100, 34) + puff(1080, 330, 30) + puff(1840, 300, 26);
  // far hills
  s += S.quiltHill(0, W, H, [[0, 560], [260, 470], [560, 540], [900, 440], [1250, 520], [1600, 450], [1920, 520]], '#B7DDA8', { sw: 3, patches: [L.patch(300, 560, 180, 110, -6, '#C6E5B5'), L.patch(930, 520, 150, 120, 5, '#A9D69A'), L.patch(1640, 540, 190, 110, -4, '#C6E5B5'), L.patch(1250, 600, 120, 90, 8, '#A9D69A')] });
  s += S.quiltHill(0, W, H, [[0, 660], [380, 590], [760, 690], [1150, 620], [1500, 680], [1920, 610]], '#93CB7E', { sw: 3 });
  s += S.tree(560, 690, 1.1, '#6DB55E') + S.tree(600, 700, .8, '#5AA555') + S.tree(1340, 660, 1, '#6DB55E');
  // main terrain: left hill, valley with stream, right hill
  const tops = [[0, 760], [180, 720], [430, 730], [640, 800], [820, 880], [960, 900], [1100, 860], [1280, 770], [1520, 700], [1720, 690], [1920, 720]];
  s += S.ground(0, W, H, tops, { seed: 11 });
  // stream in valley
  s += path('M880 896 Q960 916 1040 892 L1030 904 Q960 926 890 906 Z', '#5FB8D8', { stroke: C.ink, sw: 3 });
  // player fort on left hill
  const bs = 34;
  const px = 150, py = 718 - 8 * bs - bs * 1.2;
  s += fort(px, py, PLAYER_FORT, bs, { crew: PLAYER_CREW, roofs: [{ c: 0, w: 3, h: 1.4, color: C.lobber }, { c: 5, w: 3, h: 1.1, color: C.tb }], legs: 3, legPose: [-.3, .4, -.2], dmg: { '0,7': 1, '3,7': 1 } });
  // enemy fort on right hill (flat top, indigo)
  const EF = [
    'CCCCCCC',
    'lnnCnnC',
    'lnnCnnC',
    'BBkkBBB',
    'BBkkBBB',
    'lnnBnnC',
    'lnnBnnC',
    'FFFFFFF',
  ];
  const ex = 1490, ey = 692 - 8 * bs - bs * 1.2;
  const efort = fort(ex, ey, EF, bs, { team: C.indigo, enemy: true, face: 'left', roofs: [{ c: 0, w: 7, type: 'flat', color: C.steel }], legs: 3, legPose: [.2, -.3, .3], dmg: { '1,0': 2, '2,0': 1, '0,0': 2, '0,1': 1, '5,0': 1 } });
  s += efort;
  // flatteners in nooks (simple, facing left)
  s += flattener('tamper', ex + 2 * bs, ey + 3 * bs - 6, bs * 1.55 / 100 * .95);
  s += flattener('sniper', ex + 5 * bs, ey + 3 * bs - 6, bs * 1.55 / 100 * .9);
  s += flattener('snipper', ex + 2 * bs, ey + 7 * bs - 6, bs * 1.55 / 100 * .8);
  s += flattener('filler', ex + 5 * bs, ey + 7 * bs - 6, bs * 1.55 / 100 * .9);
  // shot arc from zinger loophole area to enemy wall
  const ix = ex + 10, iy = ey + bs * .8;
  const x0 = px + 8 * bs - 6, y0 = py + 2 * bs - 10, T = 2.4, gy = 400, wx = 40;
  const vx = (ix - x0 - .5 * wx * T * T) / T, vy = (iy - y0 - .5 * gy * T * T) / T;
  const pts = S.arcPts(x0, y0, vx, vy, gy, wx, 49, T / 48);
  let arc = '';
  pts.forEach(([x, y], i) => { if (i % 2 === 0 && i <= 36) arc += circ(x, y, 5.5 - i * .06, '#FFFFFF', { stroke: C.ink, sw: 2, op: .95 }); });
  s += arc;
  const sp = pts[40];
  s += path(`M${f(pts[35][0])} ${f(pts[35][1])} Q${f(pts[38][0])} ${f(pts[38][1] - 4)} ${f(sp[0])} ${f(sp[1])}`, 'none', { stroke: '#FFFFFF', sw: 10, op: .75 });
  s += S.shellPot(sp[0], sp[1], 1.6, 30);
  // impact on enemy wall (top-left corner)
  s += burst(ix, iy, 92, 56, 9, C.gold, { sw: 4 }) + burst(ix, iy, 60, 36, 9, '#FFF3C4', { sw: 3, rot: .3 });
  s += puff(ix - 40, iy - 60, 26, '#E9E4EA') + puff(ix + 50, iy - 70, 20, '#E9E4EA');
  // flying debris
  s += block('cobble', ix - 110, iy - 120, 30, 0, 4).replace('<g ', `<g opacity="1" `) ;
  s += g(block('cobble', 0, 0, 26, 1, 8), `translate(${f(ix - 60)} ${f(iy - 150)}) rotate(28)`);
  s += g(block('cobble', 0, 0, 20, 0, 9), `translate(${f(ix + 70)} ${f(iy - 130)}) rotate(-20)`);
  s += star4(ix - 140, iy - 40, 10, C.gold, { stroke: C.ink, sw: 2 }) + star4(ix + 110, iy - 20, 8, C.gold, { stroke: C.ink, sw: 2 });
  // damage number
  s += text(ix - 30, iy - 112, '-42', { size: 56, weight: 700, fill: C.paper, stroke: C.ink, sw: 9, anchor: 'middle' });
  // bonked flattener floating off
  s += S.balloon(1200, 470, 1.3, C.fcream, true) + g(flattener('tamper', 0, 0, .5, { flip: true }), 'translate(1200 545) rotate(-10)');
  // buried odds and ends
  s += g(L.stomper(0, 0, .5, { pose: .8, paint: '#9A8A7A' }), 'translate(520 960) rotate(70)');
  s += g(circ(0, 0, 16, '#9A8A7A', { stroke: C.ink, sw: 2.5, op: .9 }) + circ(0, 0, 6, '#7A6A5E'), 'translate(1180 1000)');
  s += path('M300 840 C320 880 290 900 310 940 M310 880 C330 890 340 900 336 916', 'none', { stroke: '#6A4028', sw: 5, op: .7 });
  // wind flag on middle ridge + leaves
  s += S.windFlag(700, 806, 1.3, 6);
  s += S.leaves(820, 520, 6, L.rng(5));
  // steam puffs from stompers
  // small logotype
  s += logoMark(330, 120, .42);
  out('02-key-art-battle.svg', doc(W, H, s, { title: 'Key art: battle', desc: 'Two walking forts duel across a valley', defs: sk.defs }));
}

// ---------------------------------------------------------- 13 walking fort cutaway
{
  const W = 1600, H = 1080;
  let s = rr(0, 0, W, H, 0, C.paper) + rr(0, 0, W, H, 0, 'url(#paperDots)');
  s += text(60, 76, 'Walking fort: cutaway', { size: 44, weight: 700 });
  s += text(60, 108, 'Your fort as you see it on your turn: walls go see-through so crew, Nooks, Loopholes and the Heartkettle show.', { size: 19, weight: 500, fill: C.ink2, family: L.BODY });
  const bs = 58, fx = 440, fy = 320;
  s += ell(fx + 4 * bs, fy + 8 * bs + 150, 300, 20, C.ink, { op: .12 });
  s += fort(fx, fy, PLAYER_FORT, bs, { crew: PLAYER_CREW, roofs: [{ c: 0, w: 3, h: 1.2, color: C.lobber }, { c: 5, w: 3, h: 1, color: C.tb }], legs: 3, legPose: [-.3, .3, -.1] });
  const kx = fx + 4 * bs, ky = fy + 5 * bs;
  const pipe = `M${kx} ${ky} L${kx} ${fy + 8 * bs + 10}`;
  s += path(pipe, 'none', { stroke: C.ink, sw: 12 }) + path(pipe, 'none', { stroke: C.br, sw: 7 }) + path(pipe, 'none', { stroke: C.glow, sw: 3, dash: '6 10' });
  const call = (x1, y1, x2, y2, label, anchor = 'start') => {
    const w = label.length * 11.5 + 34;
    const bx = anchor === 'start' ? x2 : x2 - w;
    return line(x1, y1, x2, y2, C.ink, 2.5) + circ(x1, y1, 6, C.saffron, { stroke: C.ink, sw: 2.5 }) +
      rr(bx, y2 - 20, w, 40, 20, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + text(bx + w / 2, y2 + 7, label, { size: 20, weight: 700, anchor: 'middle' });
  };
  const RX = 1010;
  s += call(fx + 7.5 * bs, fy + 1.45 * bs, RX, 300, 'Loophole: fires toward the rival');
  s += call(fx + 5.2 * bs, fy + 1.2 * bs, RX, 390, 'Nook: 2 x 2 hollow, one Hob');
  s += call(fx + 4.7 * bs, fy + 3.3 * bs, RX, 500, 'Kettle Room: holds the Heartkettle');
  s += call(fx + 7.5 * bs, fy + 7.5 * bs, RX, 735, 'Footing: never falls, immune to Dig');
  s += call(kx + 4, fy + 7.75 * bs, RX, 645, 'Steam pipe: kettle to legs');
  s += call(fx + 7.3 * bs, fy + 8 * bs + 70, RX, 830, 'Stompers: clockwork steam legs');
  s += call(fx + .5 * bs + 40, fy - 2.6 * bs + 14, fx - 40, 190, 'Team flag', 'end');
  s += call(fx + 1.2 * bs, fy - .6 * bs, fx - 40, 280, 'Roof caps: free, cosmetic', 'end');
  s += call(fx + .5 * bs, fy + 3.5 * bs, fx - 40, 520, 'Body: any material', 'end');
  s += rr(60, 950, 760, 110, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(84, 986, 'Grid: 8 x 8 blocks here (cap 8 wide by 10 tall, 80 blocks).', { size: 18, weight: 600, fill: C.ink2, family: L.BODY });
  s += text(84, 1014, 'One block = 16 x 16 cells. A Hob in a Nook stands about 26 cells tall.', { size: 18, weight: 600, fill: C.ink2, family: L.BODY });
  s += text(84, 1042, 'The fort never tilts. It rests on its Stompers on the highest ground.', { size: 18, weight: 600, fill: C.ink2, family: L.BODY });
  s += rr(1010, 950, 530, 110, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(1034, 984, 'Stomper walk cycle', { size: 18, weight: 700 });
  [-1, -.3, 1, .3].forEach((p, i) => { s += stomper(1300 + i * 60, 970, .6, { pose: p }); });
  s += text(1034, 1012, '4 keys, 0.5 s', { size: 15, weight: 600, fill: C.ink2, family: L.BODY }) + text(1034, 1036, 'puff on each step', { size: 15, weight: 600, fill: C.ink2, family: L.BODY });
  out('13-walking-fort-cutaway.svg', doc(W, H, s, { title: 'Walking fort cutaway', desc: 'Fort anatomy with Stompers, Nooks, Loopholes, Heartkettle' }));
}
