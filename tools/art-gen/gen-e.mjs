// Sheets after the owner's decisions: 24 portrait battle HUD (stacked lenses), 25 Couch Duel setup and hand-off card.
// Layout numbers follow docs/design/07-ux-ui-audio.md sections 2.6 and 4.9. All phone content is drawn in pt (390 x 844).
import fs from 'fs';
import * as L from './lib.mjs';
import * as S from './scene.mjs';
const { C, doc, text, rr, circ, ell, path, line, g, block, hob, kettle, fort, stitch, puff, classIcon, f, button, panel, windArrow, clipped } = L;
const ART = '/home/user/CastleProtect/docs/art';
const out = (name, svg) => { fs.writeFileSync(`${ART}/${name}`, svg); console.log('wrote', name); };
const BODY = L.BODY;
const small = (x, y, t, o = {}) => text(x, y, t, { size: 15, weight: 600, fill: C.ink2, family: BODY, ...o });
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const ink = C.ink;
const PW = 390, PH = 844;

// ---------------------------------------------------------------- shared HUD parts (pt)
const cloudIcon = (x, y, r, puffs = 0, fill = C.slate) => {
  let c = path(L.cloudD(x, y, r), fill, { stroke: ink, sw: 1.4 });
  for (let k = 0; k < puffs; k++) c += circ(x + r * 1.5 + k * r * .9, y + r * .35, r * .28, fill, { stroke: ink, sw: 1 });
  return c;
};
const kettleGauge = (x, y, pct) => {
  let c = rr(x, y, 74, 26, 9, '#FFFFFF', { stroke: ink, sw: 1.8 });
  c += g(kettle(0, 0, .2, { glowOn: false, hp: pct / 100 }), `translate(${x + 15} ${y + 24})`);
  c += text(x + 30, y + 18.5, pct + '%', { size: 14, weight: 700 });
  if (pct <= 50) c += path(`M${x + 66} ${y + 4} l-4 5 l5 2 l-4 6`, 'none', { stroke: ink, sw: 1.8 });
  return c;
};
const youPip = (x, y, hp) => circ(x, y, 9, '#FFFFFF', { stroke: ink, sw: 1.8 }) + clipped(circ(x, y, 8, '#000'), rr(x - 9, y + 9 - 18 * hp, 18, 18 * hp, 0, C.you)) + circ(x, y, 9, 'none', { stroke: ink, sw: 1.8 });
const dia = (x, y, r) => `M${f(x)} ${f(y - r)} L${f(x + r)} ${f(y)} L${f(x)} ${f(y + r)} L${f(x - r)} ${f(y)} Z`;
const hatch = (x, y, r, shape) => clipped(shape, Array.from({ length: Math.ceil(r * 4 / 5) + 2 }, (_, k) => line(x - r * 2 + k * 5, y + r * 1.2, x - r * 2 + k * 5 + r, y - r * 1.2, '#FFFFFF', 1.3, { op: .75 })).join(''));
const rivalPip = (x, y, cls, r = 12.5) => {
  let c = path(dia(x, y, r), C.rival, { stroke: ink, sw: 1.6 });
  c += hatch(x, y, r, path(dia(x, y, r), '#000'));
  c += path(dia(x, y, r * .69), C[cls], { stroke: ink, sw: 1.4 }) + classIcon(cls, x, y, r * .58, { ring: false });
  return c;
};
const pinYou = (x, y, k = 1, lab = '') => g(circ(0, -13, 6, C.you, { stroke: ink, sw: 1.8 }) + path('M-3 -9 L0 0 L3 -9', C.you, { stroke: ink, sw: 1.5 }) + (lab ? text(0, -10, lab, { size: 7.5, weight: 700, anchor: 'middle', fill: '#FFFFFF' }) : ''), `translate(${f(x)} ${f(y)}) scale(${k})`);
const pinRival = (x, y, k = 1, lab = '') => g(path('M0 -20 L7 -13 L0 -6 L-7 -13 Z', C.rival, { stroke: ink, sw: 1.8 }) + line(0, -6, 0, 0, ink, 1.5) + (lab ? text(0, -10.3, lab, { size: 7.5, weight: 700, anchor: 'middle', fill: '#FFFFFF' }) : ''), `translate(${f(x)} ${f(y)}) scale(${k})`);
const tag = (x, y, t, o = {}) => rr(x, y, t.length * 5.4 + 14, 17, 8.5, C.ink2, { op: .92 }) + text(x + 7, y + 12.5, t, { size: 9.5, weight: 700, fill: '#FFFFFF' });
// round portrait (your side) and diamond portrait (Player 2)
const facePlate = (cx, cy, r, cls, i, o = {}) => {
  const { team = C.you, diamond = false, sel = false, hp = 1, rest = 0, noLine = false } = o;
  const shape = diamond ? path(dia(cx, cy, r * 1.22), '#000') : circ(cx, cy, r - 2, '#000');
  let s = diamond ? path(dia(cx, cy, r * 1.3), '#FFFFFF', { stroke: ink, sw: 2 }) : circ(cx, cy, r, '#FFFFFF', { stroke: ink, sw: 2 });
  s += clipped(shape, rr(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8, 0, '#F3E7CF') + hob(cls, cx - 1, cy + r * 1.8, r / 44, { tool: false, skin: L.SKINS[i % 6], coat: L.COATS[i % 8], team, flip: diamond }));
  if (diamond) s += path(dia(cx, cy, r * 1.3), 'none', { stroke: team, sw: 3.5 }) + path(dia(cx, cy, r * 1.3 + 2), 'none', { stroke: ink, sw: 1.2 });
  else s += hp >= 1 ? circ(cx, cy, r, 'none', { stroke: team, sw: 4 }) : path(`M${cx} ${cy - r} A${r} ${r} 0 ${hp > .5 ? 1 : 0} 1 ${f(cx + r * Math.sin(hp * 2 * Math.PI))} ${f(cy - r * Math.cos(hp * 2 * Math.PI))}`, 'none', { stroke: team, sw: 4 });
  if (sel) s += circ(cx, cy, r + 3.5, 'none', { stroke: C.gold, sw: 3 }) + path(`M${cx - 5} ${cy - r - 9} L${cx} ${cy - r - 3} L${cx + 5} ${cy - r - 9} Z`, C.gold, { stroke: ink, sw: 1.2 });
  if (rest) s += circ(cx + r * .72, cy + r * .66, 8, C.steel, { stroke: ink, sw: 1.5 }) + text(cx + r * .72, cy + r * .66 + 4, String(rest), { size: 10, weight: 700, anchor: 'middle' });
  if (noLine) s += circ(cx + r * .8, cy - r * .7, 8.5, C.paper, { stroke: ink, sw: 1.5 }) + path(`M${cx + r * .8 - 5} ${cy - r * .7 + 3} q5 -9 10 0`, 'none', { stroke: ink, sw: 1.6 }) + line(cx + r * .8 - 5, cy - r * .7 + 5, cx + r * .8 + 5, cy - r * .7 - 5, C.danger, 2);
  return s;
};
// Loophole Flap: a small canvas flap with a team hem
const flap = (x, y, w, h, team) => path(`M${x} ${y} L${x + w} ${y} L${x + w} ${y + h * .8} L${x + w * .7} ${y + h} L${x} ${y + h} Z`, C.cream, { stroke: ink, sw: 1.5 }) + rr(x, y + h - 3.5, w * .7, 3.5, 0, team) + line(x + 2, y + 3, x + w - 2, y + 3, ink, 1, { op: .35, dash: '2 2' });
const glint = (x, y, s) => path(`M${x} ${y - s} L${x + s * .28} ${y - s * .28} L${x + s} ${y} L${x + s * .28} ${y + s * .28} L${x} ${y + s} L${x - s * .28} ${y + s * .28} L${x - s} ${y} L${x - s * .28} ${y - s * .28} Z`, '#FFFFFF', { stroke: ink, sw: 1 });
const squareFlag = (x, y, bs, team) => line(x, y, x, y - bs * 1.8, ink, 3) + rr(x - bs * 1.4, y - bs * 1.8, bs * 1.4, bs * .85, 1, team, { stroke: ink, sw: 2 }) + path(dia(x - bs * .7, y - bs * 1.38, bs * .22), C.paper, { stroke: ink, sw: 1 });

const LAY_YOU = ['TTTTTTTT', 'TnnTTnnT', 'TnnTTnnT', 'TTTnnTTT', 'TTTnnTTT', 'nnCkkCnn', 'nnCkkCnn', 'FFFFFFFF'];
const CREW_YOU = [{ r: 1, c: 1, cls: 'lobber' }, { r: 1, c: 5, cls: 'zinger' }, { r: 3, c: 3, cls: 'patcher' }, { r: 5, c: 0, cls: 'delver' }, { r: 5, c: 6, cls: 'boinker' }];
const LAY_FOE = ['CCCCCC', 'nnCnnC', 'nnCnnC', 'BBkkBB', 'BBkkBB', 'FFFFFF'];
const LAY_P2 = ['WWTTWW', 'nnTnnT', 'nnTnnT', 'CCkkCC', 'CCkkCC', 'FFFFFF'];
const P1 = ['lobber', 'zinger', 'patcher', 'delver', 'boinker'];
const P2 = ['lobber', 'zinger', 'boinker', 'scatter', 'patcher'];

// ---------------------------------------------------------------- the portrait battle screen
// mode: 'plan' | 'flight'. duel: Player 2 is a Hob clan in orange.
function battle(mode, o = {}) {
  const { duel = false, notes = false, pre = 'b' } = o;
  let defs = '', s = '';
  const sk = S.sky(PW, PH, '#9ED8EC', '#FFF1D0', pre + 'sky');
  defs += sk.defs;
  const TOP = [103, 315], STRIP = [315, 347], BOT = [347, 678];
  const foe = (x, gy, bs) => {
    const fy = gy - 6 * bs - bs * 1.2;
    let t = duel
      ? fort(x, fy, LAY_P2, bs, { team: C.rival, face: 'left', flag: false, legs: 3, crew: [{ r: 1, c: 0, cls: 'lobber' }, { r: 1, c: 3, cls: 'zinger' }], roofs: [{ c: 3, w: 3, h: 1.1, color: C.boinker }], dmg: { '0,0': 2, '1,2': 1 } }) + squareFlag(x + 6 * bs - bs * .5, fy - 2, bs, C.rival)
      : fort(x, fy, LAY_FOE, bs, { enemy: true, face: 'left', roofs: [{ c: 0, w: 6, type: 'flat', color: C.steel }], legs: 3, dmg: { '0,0': 2, '1,2': 1 } });
    // Loophole Flap on the upper left Nook, shimmer on a weakly held block
    t += flap(x - bs * .15, fy + bs * 1.1, bs * .7, bs * 1.3, C.rival);
    t += glint(x + bs * 5.5, fy + bs * 1.5, bs * .42);
    return t;
  };
  const mine = (x, gy, bs) => fort(x, gy - 8 * bs - bs * 1.2, LAY_YOU, bs, { crew: CREW_YOU, roofs: [{ c: 0, w: 3, h: 1.2, color: C.lobber }], legs: 3 });

  if (mode === 'plan') {
    // top lens: the target fort, block 12 pt
    let t = sk.body + puff(70, 150, 9) + puff(330, 135, 7);
    t += S.quiltHill(-10, 400, 330, [[0, 250], [110, 228], [230, 252], [330, 226], [390, 240]], '#B7DDA8');
    const gt = [[0, 292], [70, 298], [140, 284], [250, 284], [320, 296], [390, 288]];
    t += S.ground(-10, 400, 420, gt, { seed: 7 });
    t += foe(159, 284, 12);
    t += pinYou(92, 297, 1, '4') + pinYou(262, 286, 1, '5');
    if (notes) t += tag(18, 250, 'Your Pins, full size') + tag(246, 176, 'Weak block shimmers') + tag(22, 196, 'Loophole Flap');
    s += clipped(rr(0, TOP[0], PW, TOP[1] - TOP[0], 0, '#000'), t);
    // bottom lens: your fort, block 16 pt
    let b = rr(0, BOT[0], PW, 340, 0, '#CDEBF0') + rr(0, BOT[0], PW, 340, 0, `url(#${pre}sky)`, { op: .55 });
    b += puff(300, 400, 10);
    b += S.quiltHill(-10, 400, 700, [[0, 560], [120, 540], [250, 566], [390, 536]], '#B7DDA8');
    const gb = [[0, 602], [170, 602], [270, 616], [390, 648]];
    b += S.ground(-10, 400, 860, gb, { seed: 5 });
    const fx = 26, gy = 602, bs = 16, fy = gy - 8 * bs - bs * 1.2;
    b += mine(fx, gy, bs);
    b += circ(fx + 6 * bs, fy + 2 * bs, 22, 'none', { stroke: C.gold, sw: 2.5, extra: ' stroke-dasharray="5 4"' });
    const x0 = fx + 8 * bs + 4, y0 = fy + 1.6 * bs;
    const ghost = S.arcPts(x0, y0, 150, -205, 190, 6, 60, .03);
    b += path('M' + ghost.filter(p => p[0] < 400).map(p => `${f(p[0])} ${f(p[1])}`).join(' L'), 'none', { stroke: C.you, sw: 2, op: .45, dash: '9 6' });
    const pp = S.arcPts(x0, y0, 165, -225, 190, 6, 15, .045);
    pp.forEach(([x, y], i) => { if (i > 0) b += circ(x, y, 3.8 - i * .12, '#FFFFFF', { stroke: ink, sw: 1.2, op: 1 - i * .035 }); });
    b += pinRival(214, 608, 1, '5');
    if (notes) b += tag(222, 452, '30% preview') + tag(232, 580, "Rival's Pin: a diamond");
    // turn banner
    b += rr(105, 355, 180, 28, 14, C.you, { stroke: ink, sw: 2 }) + text(195, 374, duel ? "Mabel's turn" : 'Your turn', { size: 14, weight: 700, anchor: 'middle', fill: '#FFFFFF' });
    s += clipped(rr(0, BOT[0], PW, BOT[1] - BOT[0], 0, '#000'), b);
    // floats along the foot of the bottom lens: Pause, Steam, Walk pad, readout
    s += rr(8, 628, 44, 44, 12, C.paper, { op: .96, stroke: ink, sw: 2 }) + rr(22, 640, 5, 20, 2, ink) + rr(33, 640, 5, 20, 2, ink);
    s += rr(58, 606, 108, 13, 6.5, C.paper, { op: .95, stroke: ink, sw: 1.8 }) + rr(62, 609, 70, 7, 3.5, '#3A3236') + rr(62, 609, 46, 7, 3.5, C.glow) + rr(62, 609, 27, 7, 3.5, C.glowL) + text(149, 616.5, 'S 64', { size: 9.5, weight: 700, anchor: 'middle' });
    s += rr(58, 622, 108, 50, 14, C.paper, { op: .95, stroke: ink, sw: 2 });
    s += circ(85, 647, 20, '#FFFFFF', { stroke: ink, sw: 2 }) + path('M90 639 L80 647 L90 655 Z', ink);
    s += circ(139, 647, 20, '#FFFFFF', { stroke: ink, sw: 2 }) + path('M134 639 L144 647 L134 655 Z', ink);
    s += rr(262, 632, 120, 40, 12, C.paper, { op: .96, stroke: ink, sw: 2 }) + text(322, 658, '62.5° | 74', { size: 17, weight: 700, anchor: 'middle' });
  } else {
    // flight: the lenses join into one tall view; the camera rides the shell
    let t = sk.body + puff(80, 190, 12) + puff(300, 260, 10) + puff(210, 420, 8);
    t += S.quiltHill(-10, 400, 800, [[0, 600], [130, 570], [260, 610], [390, 560]], '#B7DDA8');
    const gt = [[0, 690], [110, 690], [200, 716], [300, 676], [390, 700]];
    t += S.ground(-10, 400, 900, gt, { seed: 11 });
    t += mine(8, 690, 9);
    const tr = S.arcPts(8 + 72 + 3, 690 - 72 - 11 + 14, 78, -300, 150, 5, 40, .06);
    const upto = tr.filter(p => p[1] > 180 || p[0] < 200).slice(0, 26);
    t += path('M' + upto.map(p => `${f(p[0])} ${f(p[1])}`).join(' L'), 'none', { stroke: '#FFFFFF', sw: 5, op: .75 });
    const hd = upto[upto.length - 1];
    t += S.shellPot(hd[0], hd[1], 1.25, 30);
    t += rr(318, 718, 60, 40, 14, C.saffron, { stroke: ink, sw: 2 }) + text(348, 745, '2x', { size: 18, weight: 700, anchor: 'middle' });
    t += rr(8, 716, 44, 44, 12, C.paper, { op: .96, stroke: ink, sw: 2 }) + rr(22, 728, 5, 20, 2, ink) + rr(33, 728, 5, 20, 2, ink);
    s += clipped(rr(0, 103, PW, 675, 0, '#000'), t);
  }
  // top strip: two rows, display only
  s += rr(0, 0, PW, 47, 0, '#9ED8EC', { op: 0 });
  s += rr(0, 47, PW, 56, 0, C.paper, { op: .96 }) + line(0, 103, PW, 103, ink, 2) + line(0, 47, PW, 47, ink, 1, { op: .25 });
  s += kettleGauge(8, 51, 100);
  s += rr(104, 51, 182, 26, 13, '#FFFFFF', { stroke: ink, sw: 2 }) + text(112, 69, 'Round 13/15', { size: 12.5, weight: 700 }) + cloudIcon(194, 63, 5.5, 1) + text(214, 69, 'Squall in 3', { size: 12.5, weight: 700, fill: C.slate });
  s += kettleGauge(308, 51, 46);
  [1, .7, .45, .9, 1].forEach((hp, i) => s += youPip(18 + i * 21, 90, hp));
  s += windArrow(160, 90, 4, .36) + text(180, 95, '4', { size: 14, weight: 700 });
  s += g(windArrow(0, 0, 6, .24), 'translate(211 90)', ' opacity="0.7"') + text(227, 94.5, '6', { size: 11, weight: 700, fill: C.ink2 });
  (duel ? P2 : ['lobber', 'zinger', 'scatter', 'delver', 'patcher']).forEach((cls, i) => s += rivalPip(264 + i * 26, 90, cls, 11.5));
  // Field Strip: the whole field in small
  const sy = mode === 'plan' ? STRIP[0] : 778;
  let fs_ = rr(0, sy, PW, 32, 0, C.paper, { op: .97 }) + line(0, sy, PW, sy, ink, 2) + line(0, sy + 32, PW, sy + 32, ink, 2);
  fs_ += path(`M0 ${sy + 32} L0 ${sy + 24} C40 ${sy + 22} 60 ${sy + 24} 96 ${sy + 24} C140 ${sy + 25} 150 ${sy + 29} 190 ${sy + 28} C230 ${sy + 27} 250 ${sy + 20} 290 ${sy + 21} C330 ${sy + 22} 360 ${sy + 24} 390 ${sy + 22} L390 ${sy + 32} Z`, '#C9A27A', { stroke: ink, sw: 1.2 });
  fs_ += rr(28, sy + 10, 16, 14, 2, C.you, { stroke: ink, sw: 1.4 }) + line(30, sy + 10, 30, sy + 3, ink, 1.4) + path(`M30 ${sy + 3} L38 ${sy + 5.5} L30 ${sy + 8} Z`, C.you, { stroke: ink, sw: 1 });
  fs_ += rr(338, sy + 8, 14, 13, 2, C.rival, { stroke: ink, sw: 1.4 }) + line(350, sy + 8, 350, sy + 2, ink, 1.4) + rr(343, sy + 2, 7, 5, 0, C.rival, { stroke: ink, sw: 1 }) + circ(338, sy + 12, 2, C.cream, { stroke: ink, sw: .8 });
  if (mode === 'plan') {
    [[52, 8], [62, 5.2], [72, 3.6], [82, 3], [92, 3.4]].forEach(([x, dy]) => fs_ += circ(x, sy + dy + 2, 1.7, '#FFFFFF', { stroke: ink, sw: .8 }));
    fs_ += pinYou(318, sy + 22, .52) + pinYou(366, sy + 23, .52) + pinRival(74, sy + 24, .5);
    const br = (x0, x1) => path(`M${x0 + 5} ${sy + 3} L${x0} ${sy + 3} L${x0} ${sy + 29} L${x0 + 5} ${sy + 29} M${x1 - 5} ${sy + 3} L${x1} ${sy + 3} L${x1} ${sy + 29} L${x1 - 5} ${sy + 29}`, 'none', { stroke: ink, sw: 1.6 });
    fs_ += br(8, 104) + br(286, 384);
  } else {
    [[52, 8], [64, 3.5], [78, 0], [94, -2], [112, -3]].forEach(([x, dy]) => fs_ += circ(x, sy + dy + 6, 1.4, '#FFFFFF', { stroke: ink, sw: .7, op: .8 }));
    fs_ += circ(132, sy + 4, 3.6, C.soot, { stroke: '#FFFFFF', sw: 1.2 });
    fs_ += path(`M95 ${sy + 2} L90 ${sy + 2} L90 ${sy + 30} L95 ${sy + 30} M165 ${sy + 2} L170 ${sy + 2} L170 ${sy + 30} L165 ${sy + 30}`, 'none', { stroke: ink, sw: 1.6 });
  }
  s += fs_;
  // dock: shot tray 52 pt, crew row 80 pt, safe area 34 pt
  if (mode === 'plan') {
    s += rr(0, 678, PW, 166, 0, C.paper, { op: .97 }) + line(0, 678, PW, 678, ink, 2) + line(0, 730, PW, 730, ink, 1, { op: .25 });
    const chip = (i, label, uses, c = {}) => {
      const { sel = false, spent = false, icon = '', cogs = 0, best = false } = c;
      const x = 15 + i * 52, y = 680;
      let k = rr(x, y, 48, 48, 10, sel ? C.saffron : spent ? '#E6E0E8' : '#FFFFFF', { stroke: ink, sw: sel ? 2.5 : 1.8 }) + g(icon, `translate(${x + 24} ${y + 20})`, spent ? ' opacity="0.4"' : '');
      k += text(x + 24, y + 43.5, label, { size: 7.6, weight: 700, anchor: 'middle', fill: spent ? '#9A90A4' : ink });
      if (uses !== '') k += circ(x + 42, y + 6, 7.5, spent ? '#9A90A4' : ink) + text(x + 42, y + 9.6, uses, { size: 9.5, weight: 700, anchor: 'middle', fill: C.paper });
      for (let q = 0; q < cogs; q++) k += circ(x + 7 + q * 9, y + 7, 3.3, C.steel, { stroke: ink, sw: 1 });
      if (best) k += classIcon('zinger', x + 8, y + 29, 6);
      return k;
    };
    s += chip(0, 'Hatpin', '', { sel: true, icon: line(-12, 6, 10, -5, C.steelL, 3) + line(-12, 6, 10, -5, ink, 1) + circ(12, -6, 4, '#FFF3A6', { stroke: ink, sw: 1.5 }) });
    s += chip(1, 'Knack', '2', { cogs: 1, icon: g(path('M-2 -12 L6 -12 L0 0 L8 0 L-6 16 L-2 4 L-8 4 Z', C.zinger, { stroke: ink, sw: 1.8 }), 'scale(.75)') });
    s += chip(2, 'Marble Sack', '1', { cogs: 1, icon: path('M-9 8 C-13 -4 -5 -8 0 -8 C5 -8 13 -4 9 8 Z', '#C9A27A', { stroke: ink, sw: 1.6 }) + circ(-4, -9, 3, '#9FD8EE', { stroke: ink, sw: 1 }) + circ(3, -10, 3, C.scatter, { stroke: ink, sw: 1 }) });
    s += chip(3, 'Mole Mail', '1', { cogs: 1, icon: ell(0, 2, 10, 6.5, C.delver, { stroke: ink, sw: 1.6 }) + circ(8, 0, 2, '#F28B82') + path('M-10 7 l-3 4 M-4 9 l-1 4', 'none', { stroke: ink, sw: 1.4 }) });
    s += chip(4, 'Nosy Goose', '1', { cogs: 1, best: true, icon: ell(-2, 4, 9, 6, '#FFFFFF', { stroke: ink, sw: 1.6 }) + path('M4 0 C6 -8 10 -10 12 -9', 'none', { stroke: ink, sw: 4.5 }) + path('M4 0 C6 -8 10 -10 12 -9', 'none', { stroke: '#FFFFFF', sw: 2.5 }) + path('M12 -11 l5 2 l-5 2 Z', C.saffron, { stroke: ink, sw: 1 }) });
    s += chip(5, 'Lid Lifter', '0', { spent: true, cogs: 1, icon: path('M-11 6 C-11 -4 11 -4 11 6 Z', C.soot, { stroke: ink, sw: 1.6 }) + circ(0, -5, 2.5, C.br, { stroke: ink, sw: 1 }) });
    s += chip(6, 'Doodads', '2', { icon: rr(-10, -6, 20, 17, 4, '#8FD08A', { stroke: ink, sw: 1.8 }) + path('M-6 -6 Q0 -16 6 -6', 'none', { stroke: ink, sw: 1.8 }) });
    P1.forEach((cls, i) => s += facePlate(34 + i * 52, 770, 22, cls, i, { sel: i === 1, hp: [1, .7, .45, .9, 1][i], rest: i === 2 ? 1 : 0 }));
    s += circ(340, 774, 38, C.saffronD, { stroke: ink, sw: 2.5 }) + circ(340, 770, 38, C.saffron, { stroke: ink, sw: 2.5 }) + ell(340, 752, 22, 9, '#FFFFFF', { op: .35 }) + text(340, 777, 'FIRE', { size: 20, weight: 700, anchor: 'middle' });
  } else {
    s += rr(0, 810, PW, 34, 0, C.paper, { op: .97 });
  }
  s += rr(128, 830, 134, 5, 2.5, ink, { op: .8 });
  // status bar
  s += text(30, 31, '9:41', { size: 15, weight: 700 }) + rr(326, 19, 26, 13, 4, 'none', { stroke: ink, sw: 1.5 }) + rr(328, 21, 18, 9, 2.5, ink) + rr(133, 12, 124, 30, 15, '#1E1A22');
  return { defs, body: clipped(rr(0, 0, PW, PH, 0, '#000'), rr(0, 0, PW, PH, 0, `url(#${pre}sky)`) + s) };
}

// a phone body round a 390 x 844 pt screen, drawn at scale k with its top left screen corner at x, y
function phoneP(x, y, k, inner) {
  const w = PW * k, h = PH * k, b = 14 * k, r = 46 * k;
  let s = rr(x - b, y - b, w + 2 * b, h + 2 * b, r + b * .6, '#1E1A22', { stroke: ink, sw: 3 });
  s += rr(x + w + b - 2, y + 190 * k, 7, 90 * k, 3.5, '#3A3440');
  s += clipped(rr(x, y, w, h, r, '#000'), g(inner, `translate(${f(x)} ${f(y)}) scale(${k})`));
  s += rr(x, y, w, h, r, 'none', { stroke: '#000', sw: 2 });
  return s;
}

// ================================================================ 24 portrait battle HUD
if (want('24')) {
  const W = 1400, H = 1470, K = 1.5, X = 56, Y = 128;
  const plan = battle('plan', { notes: true, pre: 'pa' });
  const fl = battle('flight', { pre: 'pb' });
  let s = rr(0, 0, W, H, 0, '#ECE6DA') + rr(0, 0, W, H, 0, 'url(#paperDots)');
  s += text(50, 54, 'Battle HUD, phone portrait: stacked lenses', { size: 30, weight: 700 });
  s += small(50, 80, 'Tall layout per 07-ux 2.6 (390 x 844 pt). Top lens on the target fort, Field Strip in the middle, Bottom lens on your fort with the HUD under it.', { size: 16 });
  s += phoneP(X, Y, K, plan.body);
  // zone brackets and labels along the right of the phone
  const zones = [
    [0, 47, 'Safe area', '47 pt. Sky paints here.'],
    [47, 103, 'Top strip', '56 pt, two rows. Display only.', 'Round count and "Squall in 3".'],
    [103, 315, 'Top lens', '212 pt. The target fort, close.', 'Blocks draw at 12 pt.', 'Your Pins show at full size.'],
    [315, 347, 'Field Strip', '32 pt. The whole field in small:', 'both forts, the last Pins, each lens.'],
    [347, 678, 'Bottom lens', '331 pt. Your fort, close.', 'Blocks draw at 16 pt.', 'Aim Drag starts here, under the thumb.', 'Pause, Walk pad and readout float', 'along its foot.'],
    [678, 730, 'Shot tray', '52 pt. 7 chips of 48 pt.'],
    [730, 810, 'Crew row', '80 pt. 5 Hobs of 48 pt.', 'Fire is 76 pt.'],
    [810, 844, 'Safe area', '34 pt.'],
  ];
  const bx = X + PW * K + 34;
  for (const [a, b, name, ...lines] of zones) {
    const y0 = Y + a * K + 3, y1 = Y + b * K - 3, ym = (y0 + y1) / 2;
    s += path(`M${bx} ${f(y0)} L${bx + 10} ${f(y0)} L${bx + 10} ${f(y1)} L${bx} ${f(y1)}`, 'none', { stroke: ink, sw: 2.5 }) + line(bx + 10, ym, bx + 26, ym, ink, 2.5);
    const n = lines.length, ty = ym - (n * 19) / 2 + 2;
    s += text(bx + 34, ty + 4, name, { size: 19, weight: 700 });
    lines.forEach((t, i) => s += small(bx + 34, ty + 24 + i * 19, t, { size: 14.5 }));
  }
  // right column cells
  const cx = 1010, cw = 340;
  const cell = (y, h, title) => rr(cx, y, cw, h, 18, '#FFFFFF', { stroke: ink, sw: 2.5 }) + text(cx + 18, y + 32, title, { size: 20, weight: 700 });
  // flight
  s += cell(128, 560, 'In flight: the lenses join');
  s += phoneP(cx + 72, 186, .5, fl.body);
  s += small(cx + 18, 644, 'One tall view. The camera rides the shell', { size: 14 }) + small(cx + 18, 663, 'and holds on the impact. Blocks 8 to 12 pt.', { size: 14 });
  // block sizes
  s += cell(708, 250, 'Block size on screen');
  const by = 838;
  [[16, 'Bottom', 'lens'], [12, 'Top', 'lens'], [8, 'In', 'flight'], [4, 'One', 'frame']].forEach(([pt, a, b], i) => {
    const sz = pt * 3, x = cx + 24 + i * 80;
    s += block(i === 3 ? 'cobble' : 'timber', x + (48 - sz) / 2, by - sz, sz, 0, 3 + i);
    s += text(x + 24, by + 24, pt + ' pt', { size: 17, weight: 700, anchor: 'middle', fill: i === 3 ? C.danger : ink });
    s += small(x + 24, by + 43, a, { size: 13.5, anchor: 'middle' }) + small(x + 24, by + 59, b, { size: 13.5, anchor: 'middle' });
  });
  s += small(cx + 18, 920, 'Drawn at 3x. One frame of both forts is', { size: 13.5 }) + small(cx + 18, 938, 'an overview only (the Wide look).', { size: 13.5 });
  s += line(cx + 262, by - 20, cx + 310, by + 4, C.danger, 2.5, { op: 0 });
  // turning
  s += cell(978, 196, 'Turn the device any time');
  const mini = (x, y, w, h) => rr(x, y, w, h, 7, '#1E1A22', { stroke: ink, sw: 2 }) + rr(x + 3, y + 3, w - 6, h - 6, 5, '#BFE6F2');
  s += mini(cx + 30, 1030, 44, 84) + rr(cx + 33, 1068, 38, 5, 0, C.paper, { stroke: ink, sw: 1 }) + rr(cx + 33, 1096, 38, 15, 0, C.paper, { stroke: ink, sw: 1 });
  s += path(`M${cx + 92} 1072 C${cx + 112} 1052 ${cx + 132} 1052 ${cx + 150} 1068`, 'none', { stroke: ink, sw: 3 }) + path(`M${cx + 152} 1056 L${cx + 153} 1072 L${cx + 138} 1069 Z`, ink);
  s += mini(cx + 170, 1050, 84, 44) + rr(cx + 173, 1053, 78, 7, 0, C.paper, { stroke: ink, sw: 1 }) + rr(cx + 173, 1080, 78, 11, 0, C.paper, { stroke: ink, sw: 1 });
  s += small(cx + 18, 1140, 'Instant relayout. Aim, Pins, picked Hob', { size: 14 }) + small(cx + 18, 1159, 'and the shell in flight all carry over.', { size: 14 });
  // thumb zone
  s += cell(1194, 200, 'One thumb is enough');
  s += small(cx + 18, 1250, 'Every control a turn needs sits in the', { size: 14 }) + small(cx + 18, 1269, 'lowest 220 pt: tray, crew row and Fire,', { size: 14 }) + small(cx + 18, 1288, 'with Pause, Walk and the readout just', { size: 14 }) + small(cx + 18, 1307, 'above. The top strip is display only.', { size: 14 });
  s += rr(cx + 18, 1326, 150, 46, 14, C.paper, { stroke: ink, sw: 2 }) + text(cx + 93, 1355, 'Field 70% at rest', { size: 14, weight: 700, anchor: 'middle' });
  s += rr(cx + 178, 1326, 144, 46, 14, C.paper, { stroke: ink, sw: 2 }) + text(cx + 250, 1355, '85% while aiming', { size: 14, weight: 700, anchor: 'middle' });
  // thumb arc on the phone
  out('24-portrait-hud-mockup.svg', doc(W, H, s, { title: 'Battle HUD, phone portrait', desc: 'Phone portrait battle screen at 390 x 844 pt: top strip, Top lens on the target fort, Field Strip map with Pins, Bottom lens on your fort, shot tray, crew row and Fire. Side cells show the joined lens in flight, block sizes, turning the device and the thumb zone.', defs: plan.defs + fl.defs }));
}

// ================================================================ 25 Couch Duel: setup and hand-off card
const crest = (x, y, r, p2) => {
  let s = '';
  if (p2) { s += path(dia(x, y, r), C.rival, { stroke: ink, sw: 3 }) + hatch(x, y, r, path(dia(x, y, r), '#000')) + path(dia(x, y, r * .7), C.paper, { stroke: ink, sw: 2 }); s += line(x - r * .2, y + r * .34, x - r * .2, y - r * .36, ink, Math.max(1.6, r * .07)) + rr(x - r * .2, y - r * .36, r * .44, r * .3, 1, C.rival, { stroke: ink, sw: Math.max(1.2, r * .05) }); }
  else { s += circ(x, y, r * .86, C.you, { stroke: ink, sw: 3 }) + circ(x, y, r * .6, C.paper, { stroke: ink, sw: 2 }); s += line(x - r * .2, y + r * .34, x - r * .2, y - r * .36, ink, Math.max(1.6, r * .07)) + path(`M${x - r * .2} ${y - r * .36} L${x + r * .3} ${y - r * .2} L${x - r * .2} ${y - r * .04} Z`, C.you, { stroke: ink, sw: Math.max(1.2, r * .05) }); }
  return s;
};
const plusMarks = (x, y, n) => Array.from({ length: n }, (_, i) => rr(x + i * 13 - 1.6, y - 5, 3.2, 10, 1, C.gold, { stroke: ink, sw: 1 }) + rr(x + i * 13 - 5, y - 1.6, 10, 3.2, 1, C.gold, { stroke: ink, sw: 1 }) + rr(x + i * 13 - 1.1, y - 4.4, 2.2, 8.8, 0, C.gold)).join('');
const seg = (x, y, items, selIdx, w = 62, h = 30) => items.map((t, i) => rr(x + i * (w + 4), y, w, h, 10, i === selIdx ? C.saffron : '#FFFFFF', { stroke: ink, sw: i === selIdx ? 2.5 : 1.6 }) + text(x + i * (w + 4) + w / 2, y + h / 2 + 4.6, t, { size: 13, weight: 700, anchor: 'middle' })).join('');
const miniFort = (x, y, lay, team, flip) => {
  const bs = 6.5;
  return fort(x, y, lay, bs, { team, face: flip ? 'left' : 'right', flag: false, legs: 2 });
};
const BOX = [['TTTT', 'nnTT', 'nnkk', 'CCkk', 'FFFF'], ['.TT.', 'nnT.', 'nnTT', 'Tkk.', 'Ckk.', 'FFFF'], ['WTTTW', 'nnTnn', 'nnTnn', 'CkkCC', 'CkkCC', 'FFFFF']];

function setupScreen() {
  let s = rr(0, 0, PW, PH, 0, C.parch) + rr(0, 0, PW, PH, 0, 'url(#paperDots)');
  // header
  s += rr(12, 52, 40, 40, 12, '#FFFFFF', { stroke: ink, sw: 2 }) + path('M37 62 L27 72 L37 82', 'none', { stroke: ink, sw: 3.5 });
  s += text(62, 80, 'Couch Duel', { size: 24, weight: 700 });
  s += button(266, 54, 112, 36, 'Swap sides', { fill: '#FFFFFF', dark: '#D8CDB8', size: 13.5, r: 12 });
  s += small(14, 113, '2 players, 1 device. Free forever, no ads.', { size: 12.5 });
  const card = (y, p2) => {
    const team = p2 ? C.rival : C.you, crew = p2 ? P2 : P1;
    let c = rr(10, y + 3, 370, 226, 18, ink, { op: .22 }) + rr(10, y, 370, 226, 18, team, { stroke: ink, sw: 2.5 });
    if (p2) c += clipped(rr(10, y, 370, 226, 18, '#000'), Array.from({ length: 70 }, (_, k) => line(-40 + k * 9, y + 240, 20 + k * 9, y - 10, '#FFFFFF', 2, { op: .7 })).join('')) + rr(10, y, 370, 226, 18, 'none', { stroke: ink, sw: 2.5 });
    c += rr(17, y + 7, 356, 212, 12, C.paper, { stroke: ink, sw: 1.8 });
    c += crest(42, y + 31, 19, p2) + text(66, y + 26, p2 ? 'PLAYER 2' : 'PLAYER 1', { size: 10.5, weight: 700, fill: C.ink2, ls: .6 });
    c += rr(66, y + 31, 150, 24, 8, '#FFFFFF', { stroke: ink, sw: 1.6 }) + text(74, y + 48.5, p2 ? 'Otis' : 'Mabel', { size: 15, weight: 700, fill: p2 ? C.rivalD : C.youD });
    c += rr(222, y + 31, 28, 24, 8, '#FFFFFF', { stroke: ink, sw: 1.6 }) + rr(229, y + 36, 14, 14, 3, C.cream, { stroke: ink, sw: 1.4 }) + circ(233, y + 40, 1.3, ink) + circ(239, y + 46, 1.3, ink) + circ(236, y + 43, 1.3, ink);
    c += small(264, y + 48, p2 ? 'orange, diamond' : 'blue, round', { size: 11.5 });
    // Starter Box forts
    c += text(26, y + 78, 'Fort', { size: 12.5, weight: 700 });
    const selF = p2 ? 0 : 1;
    BOX.forEach((lay, i) => {
      const x = 64 + i * 74;
      c += rr(x, y + 62, 68, 62, 10, i === selF ? C.saffronL : '#FFFFFF', { stroke: ink, sw: i === selF ? 2.5 : 1.5 });
      const w = lay[0].length * 6.5, h = lay.length * 6.5;
      c += miniFort(x + 34 - w / 2, y + 62 + 40 - h, lay, team, p2);
      c += text(x + 34, y + 119.5, 'Box ' + (i + 1), { size: 8.5, weight: 700, anchor: 'middle' });
    });
    c += rr(286, y + 62, 76, 62, 10, '#FFFFFF', { stroke: ink, sw: 1.5, extra: ' stroke-dasharray="5 4"' }) + text(324, y + 91, 'Mine', { size: 13, weight: 700, anchor: 'middle' }) + small(324, y + 107, '5 saved', { size: 10.5, anchor: 'middle' });
    // crew
    c += text(26, y + 157, 'Crew', { size: 12.5, weight: 700 });
    crew.forEach((cls, i) => c += facePlate(86 + i * 44, y + 153, p2 ? 14.5 : 18, cls, i + (p2 ? 2 : 0), { team, diamond: p2, noLine: !p2 && i === 1 }));
    c += rr(302, y + 138, 60, 30, 10, '#FFFFFF', { stroke: ink, sw: 1.6 }) + text(332, y + 157.6, 'swap', { size: 13, weight: 700, anchor: 'middle' });
    if (!p2) c += small(92, y + 181.5, 'No line', { size: 9.5, weight: 700, fill: C.danger });
    // help
    c += text(26, y + 204, 'Help', { size: 12.5, weight: 700 }) + seg(64, y + 184, ['None', 'Some', 'Lots'], p2 ? 1 : 0, 62, 28);
    if (p2) c += plusMarks(274, y + 198, 1);
    return c;
  };
  s += card(122, false) + card(356, true);
  // rules
  s += rr(10, 592, 370, 152, 18, C.paper, { stroke: ink, sw: 2.5 }) + rr(17, 599, 356, 138, 12, 'none', { stroke: C.saffronD, sw: 1.6, extra: ' stroke-dasharray="5 5" opacity="0.55"' });
  const rule = (col, row, k, v, w = 168) => { const x = 22 + col * 176, y = 604 + row * 33; return text(x + 4, y + 19, k, { size: 12, weight: 700, fill: C.ink2 }) + rr(x + w - 96, y + 2, 96, 26, 9, '#FFFFFF', { stroke: ink, sw: 1.5 }) + text(x + w - 48, y + 19.5, v, { size: 12, weight: 700, anchor: 'middle' }); };
  s += rule(0, 0, 'Map', 'Two Tumps') + rule(1, 0, 'Win by', 'Knockout');
  s += rule(0, 1, 'Rounds', '15') + rule(1, 1, 'Wind', 'Light');
  s += rule(0, 2, 'Shells', 'Draft') + rule(1, 2, 'Kind Clock', 'Off');
  s += rule(0, 3, 'Seats', 'Side by side') + small(204, 722, 'or Volley Points, Table mode', { size: 10.5 });
  // bottom bar
  s += rr(0, 752, PW, 92, 0, C.paper, { op: .97 }) + line(0, 752, PW, 752, ink, 2);
  s += button(14, 762, 150, 44, 'Quick start', { fill: '#FFFFFF', dark: '#D8CDB8', size: 15 });
  s += button(176, 760, 200, 48, 'FIGHT', { size: 21 });
  s += rr(128, 830, 134, 5, 2.5, ink, { op: .8 });
  s += text(30, 31, '9:41', { size: 15, weight: 700 }) + rr(326, 19, 26, 13, 4, 'none', { stroke: ink, sw: 1.5 }) + rr(328, 21, 18, 9, 2.5, ink) + rr(133, 12, 124, 30, 15, '#1E1A22');
  return s;
}

function handoffScreen() {
  const b = battle('plan', { duel: true, pre: 'pc' });
  let s = b.body + rr(0, 0, PW, PH, 0, ink, { op: .5 });
  const x = 22, y = 196, w = 346, h = 452;
  s += rr(x, y + 5, w, h, 24, ink, { op: .3 });
  s += rr(x, y, w, h, 24, C.rival, { stroke: ink, sw: 3 });
  s += clipped(rr(x, y, w, h, 24, '#000'), Array.from({ length: 90 }, (_, k) => line(x - 60 + k * 10, y + h + 10, x + 20 + k * 10, y - 10, '#FFFFFF', 2.4, { op: .7 })).join('')) + rr(x, y, w, h, 24, 'none', { stroke: ink, sw: 3 });
  s += rr(x + 12, y + 12, w - 24, h - 24, 15, C.paper, { stroke: ink, sw: 2 });
  // last shot line with a replay key
  s += rr(x + 26, y + 26, w - 52, 38, 12, '#FFFFFF', { stroke: ink, sw: 1.6 }) + crest(x + 46, y + 45, 12, false) + text(x + 64, y + 50, 'Mabel hit: 2 blocks, 31 damage', { size: 13.5, weight: 700 });
  s += circ(x + w - 46, y + 45, 13, C.saffron, { stroke: ink, sw: 1.8 }) + path(`M${x + w - 50} ${y + 38} L${x + w - 39} ${y + 45} L${x + w - 50} ${y + 52} Z`, ink);
  s += crest(195, y + 132, 54, true);
  s += text(195, y + 218, 'Pass the device to', { size: 17, weight: 600, anchor: 'middle', fill: C.ink2, family: BODY });
  s += text(195, y + 266, 'OTIS', { size: 46, weight: 700, anchor: 'middle', fill: C.rival, stroke: ink, sw: 5 });
  s += rr(134, y + 280, 122, 26, 13, '#FFFFFF', { stroke: ink, sw: 1.6 }) + text(152, y + 298, 'Help: Some', { size: 12.5, weight: 700 }) + plusMarks(232, y + 293, 1);
  s += kettleGauge(x + 30, y + 322, 82);
  P2.forEach((cls, i) => s += rivalPip(x + 128 + i * 27, y + 335, cls, 11.5));
  s += text(x + w - 30, y + 340, 'Round 6/15', { size: 12.5, weight: 700, anchor: 'end' });
  s += button(x + 73, y + 368, 200, 60, 'READY', { size: 26, r: 20 });
  return { defs: b.defs, body: s };
}

if (want('25')) {
  const W = 1400, H = 1330, K = 1.2;
  const hs = handoffScreen();
  let s = rr(0, 0, W, H, 0, '#ECE6DA') + rr(0, 0, W, H, 0, 'url(#paperDots)');
  s += text(50, 54, 'Couch Duel: setup and the hand-off card', { size: 30, weight: 700 });
  s += small(50, 80, 'Two players, one device, per 07-ux 4.9. Player 1 is blue and round. Player 2 is orange and diamond, a Hob clan of their own.', { size: 16 });
  const X1 = 50, X2 = 562, Y = 150;
  s += phoneP(X1, Y, K, setupScreen());
  s += phoneP(X2, Y, K, hs.body);
  s += text(X1 + PW * K / 2, Y + PH * K + 44, 'Setup: one screen, Fight in the thumb zone', { size: 18, weight: 700, anchor: 'middle' });
  s += text(X2 + PW * K / 2, Y + PH * K + 44, 'Hand-off card: last shot, name, Ready', { size: 18, weight: 700, anchor: 'middle' });
  // right column: identity cells
  const cx = 1078, cw = 300;
  const cell = (y, h, title) => rr(cx, y, cw, h, 18, '#FFFFFF', { stroke: ink, sw: 2.5 }) + text(cx + 18, y + 32, title, { size: 20, weight: 700 });
  s += cell(150, 350, 'Two Hob clans');
  s += rr(cx + 16, 196, 128, 190, 12, '#EAF1FD', { stroke: ink, sw: 1.5 }) + rr(cx + 156, 196, 128, 190, 12, '#FFF0E0', { stroke: ink, sw: 1.5 });
  s += hob('lobber', cx + 80, 356, 1.25, { team: C.you, skin: L.SKINS[0], coat: L.COATS[0] });
  const patch = path(dia(-2, -78, 7), C.rival, { stroke: ink, sw: 2 });
  s += g(hob('lobber', 0, 0, 1.25, { team: C.rival, skin: L.SKINS[2], coat: L.COATS[3], flip: true }), `translate(${cx + 220} 356)`);
  s += path(dia(cx + 222, 356 - 101, 8), C.rival, { stroke: ink, sw: 2 }) + path(dia(cx + 222, 356 - 101, 3.2), C.paper);
  s += crest(cx + 38, 218, 15, false) + crest(cx + 262, 218, 15, true);
  s += small(cx + 80, 378, 'Player 1', { size: 13.5, anchor: 'middle', weight: 700 }) + small(cx + 220, 378, 'Player 2', { size: 13.5, anchor: 'middle', weight: 700 });
  s += small(cx + 18, 412, 'Same Hobs, same hats. Player 2 wears an', { size: 13 }) + small(cx + 18, 430, 'orange scarf and a diamond hat patch.', { size: 13 }) + small(cx + 18, 448, 'No Flattener art for a human player.', { size: 13 });
  s += small(cx + 18, 476, 'Colour is never the only cue.', { size: 13, weight: 700 });
  s += cell(520, 232, 'Frames, Pins and flags');
  s += facePlate(cx + 52, 598, 24, 'zinger', 1, { team: C.you }) + facePlate(cx + 122, 598, 20, 'zinger', 3, { team: C.rival, diamond: true });
  s += pinYou(cx + 166, 620, 1.6) + pinRival(cx + 196, 620, 1.6);
  s += g(line(0, 0, 0, -44, ink, 3) + path('M0 -44 L26 -36 L0 -28 Z', C.you, { stroke: ink, sw: 2 }), `translate(${cx + 232} 622)`);
  s += squareFlag(cx + 284, 622, 14, C.rival);
  s += small(cx + 18, 660, 'Round, long dash, pennant: Player 1.', { size: 13 }) + small(cx + 18, 678, 'Diamond, hatched, square flag: Player 2.', { size: 13 });
  s += small(cx + 18, 706, 'The same four cues as the campaign,', { size: 13 }) + small(cx + 18, 724, 'so the three colour sets still work.', { size: 13 });
  s += cell(772, 250, 'Help is open');
  ['None', 'Some', 'Lots'].forEach((t, i) => {
    const yy = 822 + i * 44;
    s += rr(cx + 18, yy, 264, 36, 12, C.paper, { stroke: ink, sw: 1.6 }) + text(cx + 30, yy + 23.5, t, { size: 14, weight: 700 }) + plusMarks(cx + 82, yy + 18, i);
    s += small(cx + 128, yy + 23, ['30% arc, even kettle', '60% arc, kettle +25%', 'Full arc, kettle +50%'][i], { size: 12.5 });
  });
  s += small(cx + 18, 976, 'Marks sit by the name on the banner,', { size: 13 }) + small(cx + 18, 994, 'the hand-off card and the results.', { size: 13 });
  s += cell(1042, 256, 'House rules');
  ['Everything is open to both players.', 'Starter Box: even loaner forts,', 'ready from the first launch.', 'Kind Clock: off by default. It nudges;', 'it never fires and never skips.', 'Win by Knockout or Volley Points.', 'Table mode: each half faces its player.', 'Free forever. No ads.'].forEach((t, i) => s += small(cx + 18, 1098 + i * 23, t, { size: 13.5, weight: i === 7 ? 700 : 600 }));
  out('25-couch-duel-mockup.svg', doc(W, H, s, { title: 'Couch Duel mockup', desc: 'Two phones in portrait. Left: Couch Duel setup with two player cards (names, Starter Box forts, crew, Help), a rules panel and Fight. Right: the hand-off card over the dimmed battle, with the last shot, the next player name, their crest and a Ready button. Side cells show Player 2 identity, shape cues, Help marks and house rules.', defs: hs.defs }));
}
