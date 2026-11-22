// Game sprites for Castle Protect v0.1.
// Builds every sprite as an SVG in assets/svg/ and writes assets/manifest.json.
// Run render-sprites.mjs after this to make the PNG files, the atlases and the contact sheet.
//   node tools/art-gen/gen-sprites.mjs && node tools/art-gen/render-sprites.mjs
import fs from 'fs';
import path_ from 'path';
import * as L from './lib.mjs';
import { posedHob, snoozeBalloon, HOBS, POSES, TEAMS } from './sprite-hob.mjs';
const { C, rr, circ, ell, path, line, g, star4, burst, puff, clipped, shade, f, rng, MAT } = L;
const ink = C.ink;
const ROOT = path_.resolve(path_.dirname(new URL(import.meta.url).pathname), '../..');
const ASSETS = path_.join(ROOT, 'assets');

const sprites = [];
// add(name, group, w, h, viewBox, body, purpose, opts)
// w,h = size in px at @1x. viewBox = [x, y, w, h] in drawing units.
// opts.anchor = [x, y] in @1x px (default centre). opts.atlas = false keeps it out of the atlas.
// opts.fixed = [px...] exports square files at those sizes in place of @1x and @2x.
function add(name, group, w, h, vb, body, purpose, o = {}) {
  if (sprites.find(s => s.name === name)) throw new Error('duplicate ' + name);
  sprites.push({ name, group, w, h, vb, body, purpose, anchor: o.anchor || [w / 2, h / 2], atlas: o.atlas !== false, fixed: o.fixed || null, defs: o.defs || '', tile: o.tile || null });
}
const O = (sw = 6, stroke = ink) => ({ stroke, sw });

// ================================================================ blocks
// lib block() leaves the gaps between stones and strands clear. A game tile must be solid,
// so put the mortar colour under it (not under rubble).
const UNDER = { wicker: C.wkD, timber: C.tbD, cobble: C.cbM, footing: C.ft };
const solidBlock = (m, x, y, s, st, seed = 1) => (st === 3 ? '' : rr(x + s * .02, y + s * .02, s * .96, s * .96, s * (m === 'footing' ? .05 : .09), UNDER[m])) + L.block(m, x, y, s, st, seed);
const MATS = ['wicker', 'timber', 'cobble', 'footing'];
const STATES = ['fresh', 'scuffed', 'battered', 'broken'];
const MAT_NAME = { wicker: 'Wicker', timber: 'Timber', cobble: 'Cobble', footing: 'Footing' };
for (const m of MATS) {
  STATES.forEach((st, i) => {
    add(`block_${m}_${st}`, 'blocks', 16, 16, [0, 0, 32, 32], solidBlock(m, 0, 0, 32, i),
      `${MAT_NAME[m]} block, ${st}${i === 3 ? ' (rubble shown for 1.5 s)' : ''}. One block is 16 x 16 cells`, { anchor: [0, 0] });
  });
  add(`palette_block_${m}`, 'ui', 48, 48, [-4, -4, 108, 108], solidBlock(m, 0, 0, 100, 0), `${MAT_NAME[m]} block for the Workshop palette`);
}

// ================================================================ rooms and fort parts
{
  // Nook: 2 x 2 blocks, hollow room for one Hob
  let b = rr(0, 0, 200, 200, 6, '#4A3530');
  for (let y = 44; y < 180; y += 44) b += line(0, y, 200, y, '#3A2824', 4);
  for (const [x, y] of [[60, 0], [140, 44], [40, 88], [120, 132], [170, 88]]) b += line(x, y, x, y + 44, '#3A2824', 3);
  b += rr(0, 0, 200, 26, 0, ink, { op: .22 });
  b += rr(0, 176, 200, 24, 0, '#8A5A3A') + line(0, 177, 200, 177, '#B9733A', 5) + line(66, 180, 66, 200, '#5E3A22', 3) + line(134, 180, 134, 200, '#5E3A22', 3);
  b += circ(36, 54, 34, C.gold, { op: .16 }) + circ(36, 54, 20, C.gold, { op: .2 });
  b += line(36, 0, 36, 34, ink, 4) + rr(26, 34, 20, 26, 6, C.gold, { stroke: ink, sw: 4 }) + rr(23, 30, 26, 8, 3, C.br, { stroke: ink, sw: 4 }) + circ(33, 44, 3.5, '#FFFFFF');
  b = clipped(rr(0, 0, 200, 200, 6, '#000'), b) + rr(2, 2, 196, 196, 6, 'none', { stroke: ink, sw: 5 });
  add('nook', 'fort', 32, 32, [0, 0, 200, 200], b, 'Nook backdrop, 2 x 2 blocks. Draw behind the Hob', { anchor: [0, 0] });
  // Kettle Room
  let k = rr(0, 0, 200, 200, 6, '#2E2A3A');
  for (let x = 50; x < 200; x += 50) k += line(x, 0, x, 176, '#242030', 4);
  k += rr(0, 0, 200, 26, 0, ink, { op: .25 });
  k += rr(0, 176, 200, 24, 0, C.steelD) + line(0, 177, 200, 177, C.steelL, 5);
  for (const x of [20, 70, 130, 180]) k += circ(x, 190, 4, C.steelL);
  k = clipped(rr(0, 0, 200, 200, 6, '#000'), k) + rr(2, 2, 196, 196, 6, 'none', { stroke: ink, sw: 5 });
  add('kettle_room', 'fort', 32, 32, [0, 0, 200, 200], k, 'Kettle Room backdrop, 2 x 2 blocks. Draw behind the Heartkettle', { anchor: [0, 0] });
}
{
  // Loophole: arched window drawn over a wall block. Flap: canvas cover with a team hem
  const arch = 'M30 84 L30 44 C30 16 70 16 70 44 L70 84 Z';
  let open = path(arch, '#2A1C22', { stroke: ink, sw: 7 }) + path('M38 80 L38 46 C38 32 48 26 56 26', 'none', { stroke: '#FFFFFF', sw: 4, op: .18 }) + rr(24, 82, 52, 9, 3, C.paper, { stroke: ink, sw: 5 });
  add('loophole_open', 'fort', 16, 16, [0, 0, 100, 100], open, 'Loophole, open. Overlay on a wall block', { anchor: [0, 0] });
  for (const tk of ['blue', 'orange']) {
    const t = TEAMS[tk];
    const cloth = 'M20 20 L80 20 L82 90 L34 92 L22 80 Z';
    let fl = path(arch, '#2A1C22', { stroke: ink, sw: 7 });
    fl += line(14, 16, 86, 16, ink, 9) + line(14, 16, 86, 16, '#C9A27A', 4.5);
    let inner = rr(0, 0, 100, 100, 0, '#F2E8D5') + rr(28, 34, 20, 18, 3, '#E3D3B0') + rr(54, 56, 18, 16, 3, '#FFF8E8') + path('M20 76 L84 76 L84 96 L20 96 Z', t.col);
    if (t.hatch) for (let x = 10; x < 100; x += 9) inner += line(x, 96, x + 12, 74, '#FFFFFF', 3);
    inner += path('M60 20 L84 60 L84 76 L72 76 Z', ink, { op: .1 });
    fl += clipped(path(cloth, '#000'), inner) + path(cloth, 'none', { stroke: ink, sw: 6 });
    fl += rr(28, 34, 20, 18, 3, 'none', { stroke: ink, sw: 2, op: .5, extra: ' stroke-dasharray="4 4"' }) + rr(54, 56, 18, 16, 3, 'none', { stroke: ink, sw: 2, op: .5, extra: ' stroke-dasharray="4 4"' });
    fl += circ(24, 16, 5, C.paper, { stroke: ink, sw: 3 }) + circ(76, 16, 5, C.paper, { stroke: ink, sw: 3 });
    add(`loophole_flap_${tk}`, 'fort', 16, 16, [0, 0, 100, 100], fl, `Loophole with its Flap down, ${tk} team hem${t.hatch ? ' (hatched)' : ''}`, { anchor: [0, 0] });
  }
}
{
  // fort flags: pennant for player 1, square for player 2
  const pole = line(8, 46, 8, 4, ink, 4) + circ(8, 4, 3.5, C.br, { stroke: ink, sw: 2 });
  add('flag_blue', 'fort', 16, 24, [0, 0, 32, 48], pole + path('M8 8 L30 15 L8 24 Z', C.you, { stroke: ink, sw: 2.5 }) + line(11, 12, 20, 15, '#FFFFFF', 2, { op: .5 }), 'Fort flag, player 1: pennant, solid blue', { anchor: [4, 23] });
  let sq = rr(8, 7, 21, 16, 2, C.rival, { stroke: ink, sw: 2.5 });
  let h = ''; for (let x = 4; x < 34; x += 5) h += line(x, 24, x + 9, 6, '#FFFFFF', 1.6);
  sq += clipped(rr(8, 7, 21, 16, 2, '#000'), h) + rr(8, 7, 21, 16, 2, 'none', { stroke: ink, sw: 2.5 });
  add('flag_orange', 'fort', 16, 24, [0, 0, 32, 48], pole + sq, 'Fort flag, player 2: square, hatched orange', { anchor: [4, 23] });
}

// ================================================================ Heartkettle
{
  const KS = [['full', { hp: 1 }], ['hurt', { hp: .4 }], ['critical', { hp: .15 }], ['popped', { hp: 0, popped: true }]];
  const what = { full: 'clean copper, small wisp', hurt: 'one crack, thin steam', critical: 'crack web, lid rattles, steam puffs', popped: 'lid off, glow out' };
  for (const [n, o] of KS) {
    add(`kettle_${n}`, 'kettle', 48, 40, [-66, -128, 174, 145], L.kettle(0, 0, 1, { ...o, glowOn: false }),
      `Heartkettle, ${n}: ${what[n]}`, { anchor: [66 / 174 * 48, 128 / 145 * 40] });
  }
  add('kettle_halo', 'kettle', 48, 48, [-72, -72, 144, 144], circ(0, 0, 68, C.glow, { op: .2 }) + circ(0, 0, 52, C.glow, { op: .22 }) + circ(0, 0, 36, C.glow, { op: .2 }),
    'Kettle glow halo. Draw behind the kettle, centre on its belly, pulse in code');
}

// ================================================================ Stompers
for (const tk of ['blue', 'orange']) {
  [-1, 1].forEach((pose, i) => {
    let b = L.stomper(0, 0, 1, { pose, paint: TEAMS[tk].col });
    if (tk === 'orange') { const fx = pose * 16; b += path(`M${fx + 8} 60 l6 -10 M${fx + 14} 60 l5 -8 M${fx + 2} 60 l6 -12`, 'none', { stroke: '#FFFFFF', sw: 2.2 }); }
    add(`stomper_${tk}_${i}`, 'stompers', 32, 30, [-38, -12, 84, 78.75], b, `Stomper leg, ${tk} boot${tk === 'orange' ? ' with hatched toe' : ''}, walk frame ${i}. Hip pivot is the anchor`, { anchor: [38 / 84 * 32, 12 / 78.75 * 30] });
  });
}

// ================================================================ Hobs
const HOB_NAME = { marge: 'Marge Dumpling', quill: 'Quill Needlesworth', jax: 'Jax Peppercorn', grub: 'Grub Mudgett', bobbin: 'Bobbin Springheel', hetty: 'Hetty Mortarboard', thumper: 'Old Thumper Grumbleby', nan: 'Nan Clatterpot' };
for (const hk of Object.keys(HOB_NAME)) {
  for (const tk of ['blue', 'orange']) {
    for (const [pose, frames] of Object.entries(POSES)) {
      frames.forEach((p, i) => {
        const tall = pose === 'bonked';
        const vb = tall ? [-60, -224, 144, 232] : [-60, -152, 144, 160];
        add(`hob_${hk}_${tk}_${pose}_${i}`, 'hobs', 72, vb[3] / 2, vb, posedHob(hk, tk, p),
          `${HOB_NAME[hk]}, ${tk} team${tk === 'orange' ? ' (hatched scarf, diamond patch)' : ''}, ${pose} frame ${i}${tall ? ', with Snooze Balloon' : ''}. Faces right. Anchor is the feet`,
          { anchor: [30, -vb[1] / 2] });
      });
    }
  }
  // portrait: head and hat, for crew rings
  for (const tk of ['blue', 'orange']) {
    add(`portrait_${hk}_${tk}`, 'portraits', 48, 48, [-46, -122, 96, 96], clipped(circ(2, -74, 47, '#000'), circ(2, -74, 48, C.cream) + g(posedHob(hk, tk, { face: 'happy' }), 'translate(2 -70) scale(.8) translate(-2 78)')),
      `${HOB_NAME[hk]} portrait disc, ${tk} team. Sits inside a crew ring`);
  }
}

// ================================================================ shells
const WOOD = '#8A5A3A', CLAY = '#B5653A', CLAYD = '#8E4A26', CHINA = '#F2E8D5';
const hi = (x, y, r = 5) => circ(x, y, r, '#FFFFFF', { op: .55 });
const leaf = (x, y, rot, col = '#5AA555', k = 1) => g(path('M0 0 C-10 -12 -8 -30 0 -36 C8 -30 10 -12 0 0 Z', col, O(5)), `translate(${x} ${y}) rotate(${rot}) scale(${k})`);
const grin = (x, y, w = 14) => path(`M${x - w} ${y} Q${x} ${y + w * .9} ${x + w} ${y}`, 'none', { stroke: ink, sw: 5 });
const eyes2 = (x, y, d = 10) => ell(x - d, y, 3.5, 5, ink) + ell(x + d, y, 3.5, 5, ink);
const SHELLS = {};
SHELLS.clodpot = ['Clodpot, Lobber Plain Shot (Blast)', circ(50, 58, 30, CLAY, O()) + clipped(circ(50, 58, 30, '#000'), circ(64, 68, 30, ink, { op: .16 })) + rr(34, 20, 32, 14, 5, CLAYD, O()) + rr(41, 8, 18, 14, 4, '#C9A27A', O(5)) + path('M32 52 Q36 40 46 38', 'none', { stroke: '#E89A6A', sw: 6 }) + path('M30 66 Q50 74 70 66', 'none', { stroke: CLAYD, sw: 4 })];
SHELLS.gravel = ['Gravel Sneeze stone, Scatterjack Plain Shot (Blast). Fire three in a fan', path('M24 56 C20 36 40 22 60 28 C78 32 84 52 74 68 C62 82 30 78 24 56 Z', C.cb, O()) + path('M34 46 Q40 36 52 36', 'none', { stroke: C.cbL, sw: 6 }) + path('M44 70 Q62 72 70 58', 'none', { stroke: C.cbD, sw: 5 })];
SHELLS.nibbler = ['Nibbler, Delver Plain Shot (Dig). Toothy grub, mouth to the right', circ(24, 56, 16, '#C9A27A', O()) + circ(42, 54, 20, '#D9B88A', O()) + circ(64, 50, 25, '#C9A27A', O()) + path('M66 40 L92 44 L84 52 L92 60 L66 64 Z', '#3A2228', O(5)) + path('M70 42 l5 7 l5 -6 l5 6 M70 62 l5 -7 l5 6 l5 -6', '#FFFFFF', { stroke: ink, sw: 2.5 }) + ell(58, 36, 4, 5.5, ink) + hi(59.5, 34, 1.6) + path('M36 40 Q42 34 48 38', 'none', { stroke: '#F3DDB0', sw: 5 })];
const bean = (sq) => g(path('M22 50 C22 28 44 20 60 26 C80 32 84 56 72 70 C60 82 22 80 22 50 Z', C.boinker, O()) + clipped(path('M22 50 C22 28 44 20 60 26 C80 32 84 56 72 70 C60 82 22 80 22 50 Z', '#000'), circ(66, 66, 30, ink, { op: .14 })) + path('M32 42 Q38 32 50 30', 'none', { stroke: '#FFFFFF', sw: 6, op: .7 }) + eyes2(52, 48, 9) + grin(52, 58, 12), sq ? 'translate(50 92) scale(1.22 .68) translate(-50 -80)' : '');
SHELLS.bouncebean = ['Bouncebean, Boinker Plain Shot (Blast). Bean with a grin', bean(false)];
SHELLS.bouncebean_squash = ['Bouncebean, squashed frame for each hop', bean(true)];
SHELLS.mendglob = ['Mendglob, Patcher Plain Shot (mend). Mortar glob with a plus', path('M18 62 C12 44 28 30 42 34 C48 20 72 22 74 38 C90 40 92 62 80 72 C64 84 26 82 18 62 Z', C.cbL, O()) + path('M30 52 Q34 42 44 42', 'none', { stroke: '#FFFFFF', sw: 6 }) + path('M40 74 Q60 78 76 66', 'none', { stroke: C.cb, sw: 5 }) + rr(52, 44, 8, 26, 3, C.heal, O(3, C.healD)) + rr(43, 53, 26, 8, 3, C.heal, O(3, C.healD)) + rr(53.5, 45.5, 5, 23, 2, C.heal)];
SHELLS.pudding_bomb = ['Pudding Bomb Trick Shell (Blast, huge soft blast). Wobbly pudding with a cherry', path('M14 80 C10 64 22 60 24 46 C26 26 74 26 76 46 C78 60 90 64 86 80 Z', '#D9A441', O()) + path('M22 50 C26 26 74 26 78 50 C70 46 68 60 60 52 C54 46 48 62 42 52 C36 44 30 56 22 50 Z', '#7A4A2E', O(5)) + rr(8, 78, 84, 12, 6, CHINA, O()) + circ(50, 20, 10, C.fire, O(5)) + hi(47, 17, 2.5) + path('M50 10 Q54 2 62 4', 'none', { stroke: ink, sw: 4 }) + path('M28 62 Q30 70 36 72', 'none', { stroke: '#F3DDB0', sw: 5 })];
SHELLS.lid_lifter = ['Lid Lifter Trick Shell (Blast, goes up the column). Pot lid on a spring', path('M50 92 l-16 -6 l32 -7 l-32 -7 l32 -7 l-16 -5', 'none', { stroke: ink, sw: 11 }) + path('M50 92 l-16 -6 l32 -7 l-32 -7 l32 -7 l-16 -5', 'none', { stroke: C.steelL, sw: 5 }) + path('M12 56 C12 30 88 30 88 56 Z', C.copper, O()) + path('M24 46 Q32 36 46 34', 'none', { stroke: '#F2A469', sw: 6 }) + rr(8, 52, 84, 10, 5, C.br, O()) + circ(50, 28, 9, C.br, O(5))];
SHELLS.marble_sack = ['Marble Sack Trick Shell (Blast, splits into 8 marbles). Drawstring bag', path('M30 34 C10 50 10 88 50 90 C90 88 90 50 70 34 Z', '#B89A6A', O()) + clipped(path('M30 34 C10 50 10 88 50 90 C90 88 90 50 70 34 Z', '#000'), circ(74, 76, 34, ink, { op: .15 }) + rr(28, 58, 20, 18, 3, '#D9C08A')) + rr(28, 58, 20, 18, 3, 'none', { stroke: ink, sw: 2.5, op: .5, extra: ' stroke-dasharray="4 4"' }) + path('M28 34 C34 24 30 16 26 10 L74 10 C70 16 66 24 72 34 Z', '#C9AC78', O()) + line(26, 34, 74, 34, ink, 8) + line(26, 34, 74, 34, C.fire, 3.5) + circ(80, 40, 5, C.fire, O(3)) + circ(60, 72, 9, C.good, O(4)) + hi(57, 69, 2.5)];
SHELLS.marble = ['Marble from the Marble Sack. Rolls downhill and pops', circ(50, 50, 30, C.good, O()) + clipped(circ(50, 50, 30, '#000'), path('M24 60 C40 40 56 66 78 42', 'none', { stroke: '#FFFFFF', sw: 9, op: .8 }) + circ(64, 64, 30, ink, { op: .15 })) + circ(50, 50, 30, 'none', O()) + hi(38, 36, 6)];
SHELLS.nosy_goose = ['Nosy Goose Trick Shell (Pierce, bends toward a Hob it sees). Goose head, neck out', path('M4 72 C20 66 34 62 44 54 C40 34 56 22 70 26 C84 30 86 46 78 54 C66 66 40 84 8 88 Z', '#FFFFFF', O()) + path('M12 82 C34 78 56 66 68 56', 'none', { stroke: C.steelL, sw: 5 }) + path('M78 34 L98 40 L80 50 Z', C.gold, O(5)) + line(82, 42, 94, 41, ink, 2.5) + circ(66, 36, 4.5, ink) + hi(67.5, 34.5, 1.5) + path('M58 28 L62 22', 'none', { stroke: ink, sw: 4 })];
SHELLS.mole_mail = ['Mole Mail Trick Shell (Dig, tunnels through the hill). Mole with a letter', path('M12 64 C10 40 30 26 52 28 C72 30 90 44 92 56 C80 74 30 84 12 64 Z', '#6B4A3A', O()) + clipped(path('M12 64 C10 40 30 26 52 28 C72 30 90 44 92 56 C80 74 30 84 12 64 Z', '#000'), circ(50, 86, 36, ink, { op: .16 })) + circ(92, 55, 6, C.blush, O(4)) + circ(70, 44, 3.5, ink) + path('M30 40 Q38 32 48 32', 'none', { stroke: '#8A6A56', sw: 6 }) + g(rr(-16, -11, 32, 22, 3, CHINA, O(5)) + path('M-16 -11 L0 3 L16 -11', 'none', { stroke: ink, sw: 4 }) + circ(0, 4, 4, C.fire), 'translate(40 70) rotate(-10)') + path('M62 72 l8 10 M70 70 l9 8', 'none', { stroke: '#F5D7B8', sw: 5 })];
SHELLS.old_turnip = ['Old Turnip Trick Shell (dud). It is a turnip', leaf(46, 30, -24) + leaf(56, 30, 22) + leaf(51, 30, 0, '#7CC46A') + path('M22 50 C22 30 78 30 78 50 C78 70 60 84 50 94 C40 84 22 70 22 50 Z', '#F5EEDC', O()) + clipped(path('M22 50 C22 30 78 30 78 50 C78 70 60 84 50 94 C40 84 22 70 22 50 Z', '#000'), rr(10, 20, 80, 30, 0, '#B07AC0') + path('M10 50 q10 8 20 0 t20 0 t20 0 t20 0 v-6 h-80 Z', '#B07AC0') + circ(72, 74, 30, ink, { op: .12 })) + path('M22 50 C22 30 78 30 78 50 C78 70 60 84 50 94 C40 84 22 70 22 50 Z', 'none', O()) + path('M34 44 Q38 38 46 37', 'none', { stroke: '#FFFFFF', sw: 5, op: .6 }) + path('M40 64 l8 2 M54 72 l7 -1', 'none', { stroke: '#C9B89A', sw: 3.5 })];
SHELLS.rubber_radish = ['Rubber Radish Trick Shell (Blast, five bouncing pops). Radish with a grin', leaf(44, 28, -30, '#5AA555', .9) + leaf(58, 28, 26, '#5AA555', .9) + leaf(51, 26, -2, '#7CC46A') + path('M20 52 C20 28 80 28 80 52 C80 72 62 80 54 86 L50 97 L46 86 C38 80 20 72 20 52 Z', '#E0456A', O()) + clipped(path('M20 52 C20 28 80 28 80 52 C80 72 62 80 54 86 L50 97 L46 86 C38 80 20 72 20 52 Z', '#000'), circ(74, 74, 32, ink, { op: .14 })) + path('M30 46 Q34 38 44 36', 'none', { stroke: '#FFFFFF', sw: 6, op: .65 }) + eyes2(52, 54, 10) + grin(52, 64, 12)];
SHELLS.sod_sack = ['Sod Sack Trick Shell (builds a heap of dirt). Sack spilling soil', path('M8 92 C14 76 30 70 44 76 C52 80 58 86 60 92 Z', '#9A6440', O()) + circ(20, 82, 3, '#7A4A2E') + circ(36, 84, 3, '#7A4A2E') + g(path('M-24 -26 C-30 -8 -28 22 0 24 C28 22 30 -8 24 -26 Z', '#B89A6A', O()) + rr(-10, -6, 18, 16, 3, '#D9C08A') + rr(-10, -6, 18, 16, 3, 'none', { stroke: ink, sw: 2.5, op: .5, extra: ' stroke-dasharray="4 4"' }) + path('M-26 -26 C-18 -34 -22 -42 -26 -46 L26 -46 C22 -42 18 -34 26 -26 Z', '#9A6440', O()) + path('M-12 -46 l3 -10 l4 10 M2 -46 l4 -12 l4 12', '#7CC46A', O(3)), 'translate(58 50) rotate(-38)')];
SHELLS.mend_bucket = ['Mend Bucket Doodad (mends 3 blocks). Bucket of mortar with a trowel', path('M18 30 C18 4 82 4 82 30', 'none', { stroke: ink, sw: 9 }) + path('M18 30 C18 4 82 4 82 30', 'none', { stroke: C.steelL, sw: 4 }) + g(path('M0 0 L8 -30 L16 0 Z', C.steelL, O(4)) + rr(5, 0, 6, 12, 2, WOOD, O(3)), 'translate(52 30) rotate(24)') + path('M16 32 L84 32 L76 90 L24 90 Z', WOOD, O()) + clipped(path('M16 32 L84 32 L76 90 L24 90 Z', '#000'), rr(0, 46, 100, 8, 0, C.steelD) + rr(0, 72, 100, 8, 0, C.steelD) + path('M62 30 L90 30 L80 92 L62 92 Z', ink, { op: .15 })) + path('M16 32 L84 32 L76 90 L24 90 Z', 'none', O()) + path('M14 34 C22 22 36 30 44 24 C54 18 66 28 86 34 Z', C.cbL, O(5)) + circ(50, 62, 13, '#FFFFFF', O(4)) + rr(47, 53, 6, 18, 2, C.healD) + rr(41, 59, 18, 6, 2, C.healD)];
SHELLS.pot_lid = ['Pot Lid Doodad (a Hob holds it over a room; first shell bounces off)', path('M8 64 C8 22 92 22 92 64 Z', C.copper, O()) + clipped(path('M8 64 C8 22 92 22 92 64 Z', '#000'), path('M60 20 C96 34 96 60 90 66 L60 66 Z', ink, { op: .16 }) + path('M22 52 Q30 36 48 32', 'none', { stroke: '#F2A469', sw: 7 })) + rr(4, 60, 92, 12, 6, C.br, O()) + line(12, 64, 60, 64, C.brL, 3) + rr(42, 22, 16, 10, 3, C.brD, O(5)) + circ(50, 18, 10, C.br, O(5)) + hi(47, 15, 2.5)];
const SHELL_GROUP = { clodpot: 'plain', gravel: 'plain', nibbler: 'plain', bouncebean: 'plain', bouncebean_squash: 'plain', mendglob: 'plain', pudding_bomb: 'trick', lid_lifter: 'trick', marble_sack: 'trick', marble: 'trick', nosy_goose: 'trick', mole_mail: 'trick', old_turnip: 'trick', rubber_radish: 'trick', sod_sack: 'trick', mend_bucket: 'doodad', pot_lid: 'doodad' };
for (const [n, [purpose, body]] of Object.entries(SHELLS)) {
  const small = n === 'gravel' || n === 'marble';
  const px = small ? 10 : n === 'pot_lid' ? 32 : 20;
  add(`shell_${n}`, 'shells', px, px, [0, 0, 100, 100], body, `${purpose}. In flight`);
  if (!['bouncebean_squash', 'marble', 'gravel'].includes(n)) add(`icon_${n}`, 'icons', 48, 48, [-6, -6, 112, 112], body, `${purpose}. Tray and card icon`);
}
{
  // Hatpin: long and thin, point to the right
  const pin = line(30, 20, 150, 20, ink, 10) + line(30, 20, 146, 20, C.steelL, 4.5) + path('M144 14 L158 20 L144 26 Z', C.steelL, O(4)) + circ(20, 20, 14, '#FFFFFF', O(5)) + clipped(circ(20, 20, 14, '#000'), circ(26, 26, 14, C.mbG, { op: .35 })) + hi(15, 15, 3.5);
  add('shell_hatpin', 'shells', 40, 10, [0, 0, 160, 40], pin, 'Hatpin, Zinger Plain Shot (Pierce). Long pin with a pearl head, point to the right. In flight', { anchor: [20, 5] });
  add('icon_hatpin', 'icons', 48, 48, [-6, -6, 112, 112], g(pin, 'translate(50 50) rotate(-35) scale(.66) translate(-80 -20)'), 'Hatpin, Zinger Plain Shot (Pierce). Tray and card icon');
  const st = (x, y, k) => g(SHELLS.gravel[1], `translate(${x} ${y}) scale(${k}) translate(-50 -50)`);
  add('icon_gravel', 'icons', 48, 48, [-6, -6, 112, 112], path('M12 86 Q40 40 70 22 M12 86 Q50 60 84 52 M12 86 Q50 84 80 84', 'none', { stroke: ink, sw: 3, dash: '3 8' }) + st(72, 22, .44) + st(82, 52, .44) + st(74, 84, .44), 'Gravel Sneeze, Scatterjack Plain Shot. Three stones in a fan. Tray and card icon');
}

// ================================================================ effects
{
  const SOOT = '#5A4E52';
  const soft = (x, y, r, col, op) => circ(x, y, r, col, { op }) + circ(x - r * .7, y + r * .3, r * .7, col, { op }) + circ(x + r * .75, y + r * .25, r * .65, col, { op });
  const boom = (i, sw) => {
    if (i === 0) return circ(100, 100, 46, '#FFFFFF', { op: .9 }) + burst(100, 100, 62, 34, 8, '#FFF3C4', { stroke: C.gold, sw, rot: .2 }) + circ(100, 100, 22, '#FFFFFF');
    if (i === 1) return burst(100, 100, 96, 56, 10, C.gold, { sw, rot: .1 }) + burst(100, 100, 66, 40, 10, '#FFF3C4', { stroke: null, rot: .1 }) + circ(100, 100, 20, '#FFFFFF');
    if (i === 2) return soft(46, 66, 24, SOOT, .8) + soft(152, 60, 22, SOOT, .8) + soft(60, 150, 20, SOOT, .8) + soft(150, 146, 24, SOOT, .8) + burst(100, 100, 70, 44, 10, C.gold, { sw, rot: .35 }) + burst(100, 100, 44, 28, 10, '#FFF3C4', { stroke: null, rot: .35 });
    return soft(36, 54, 26, SOOT, .5) + soft(162, 48, 24, SOOT, .5) + soft(52, 160, 22, SOOT, .45) + soft(158, 156, 26, SOOT, .5) + soft(100, 100, 22, '#CFC8C0', .5) + star4(100, 96, 12, '#FFF3C4');
  };
  for (const [n, px, band] of [['small', 32, 'Tiny and Small blasts'], ['medium', 64, 'Medium blasts'], ['large', 128, 'Huge blasts']]) {
    for (let i = 0; i < 4; i++) add(`fx_boom_${n}_${i}`, 'effects', px, px, [0, 0, 200, 200], boom(i, { 32: 5.5, 64: 3.5, 128: 2.5 }[px]), `Explosion puff, ${n}, frame ${i} of 4. For ${band}. Scale so the burst matches the blast radius`);
  }
  for (let i = 0; i < 3; i++) {
    const k = 1 + i * .35, op = [.9, .65, .35][i];
    add(`fx_dust_${i}`, 'effects', 24, 16, [0, 0, 120, 80], soft(60, 56 - i * 8, 16 * k, '#CFC8C0', op) + soft(30 - i * 6, 62 - i * 4, 10 * k, '#CFC8C0', op) + soft(92 + i * 6, 60 - i * 5, 11 * k, '#E4DED6', op), `Dust puff, frame ${i} of 3. Landing blocks, walking forts`);
  }
  // debris chips: 3 shapes per material, plus dirt
  const chipD = ['M20 30 L70 16 L84 60 L40 84 Z', 'M14 50 L50 14 L86 44 L60 86 L24 78 Z', 'M26 24 L78 34 L70 74 L30 70 Z'];
  const chipCol = { wicker: [C.wk, C.wkL, C.wkD], timber: [C.tb, C.tbL, C.tbD], cobble: [C.cb, C.cbL, C.cbD], footing: [C.ft, C.ftL, C.ftD], dirt: ['#9A6440', '#B07A52', '#7A4A2E'] };
  for (const [m, cols] of Object.entries(chipCol)) chipD.forEach((d, i) => {
    add(`fx_chip_${m}_${i}`, 'effects', 8, 8, [0, 0, 100, 100], path(d, cols[i % 2 ? 1 : 0], O(9)) + path('M34 36 L60 30', 'none', { stroke: cols[i % 2 ? 0 : 1], sw: 8 }), `Debris chip ${i}, ${m}. View only, spin and fade in code`);
  });
  // shimmer glint: white diagonal streak for blocks on weak support
  add('fx_shimmer', 'effects', 16, 16, [0, 0, 100, 100], clipped(rr(0, 0, 100, 100, 10, '#000'), path('M-10 70 L70 -10 L96 -10 L-10 96 Z', '#FFFFFF', { op: .5 }) + path('M10 110 L110 10 L110 26 L26 110 Z', '#FFFFFF', { op: .3 })), 'Shimmer glint for a block on weak support. Slide across the block at 30% opacity', { anchor: [0, 0] });
  // Ghost dots and Pins
  add('fx_ghost_dot_p1', 'effects', 6, 6, [0, 0, 60, 60], circ(30, 30, 20, C.paper, O(9)), 'Ghost arc dot, player 1 (round). Also the aim preview dot');
  add('fx_ghost_dot_p2', 'effects', 6, 6, [0, 0, 60, 60], path('M30 6 L54 30 L30 54 L6 30 Z', C.paper, O(9)), 'Ghost arc dot, player 2 (diamond)');
  add('fx_ghost_dash_p1', 'effects', 10, 4, [0, 0, 100, 40], rr(8, 10, 84, 20, 10, C.paper, O(8)), 'Ghost arc dash, player 1 (long dash). Rotate along the arc');
  const pinPole = line(30, 96, 30, 40, ink, 9) + line(30, 94, 30, 40, C.steelL, 3.5);
  add('fx_pin_p1', 'effects', 12, 20, [0, 0, 60, 100], pinPole + circ(30, 26, 20, C.you, O(7)) + hi(24, 19, 5), 'Pin, player 1: round blue head. Marks where a shot landed. Anchor is the tip', { anchor: [6, 19.5] });
  let dh = ''; for (let x = -6; x < 60; x += 10) dh += line(x, 50, x + 22, 2, '#FFFFFF', 3.5);
  add('fx_pin_p2', 'effects', 12, 20, [0, 0, 60, 100], pinPole + path('M30 3 L53 26 L30 49 L7 26 Z', C.rival, O(7)) + clipped(path('M30 3 L53 26 L30 49 L7 26 Z', '#000'), dh) + path('M30 3 L53 26 L30 49 L7 26 Z', 'none', O(7)), 'Pin, player 2: diamond orange head, hatched. Anchor is the tip', { anchor: [6, 19.5] });
  // small bits
  add('fx_star', 'effects', 10, 10, [0, 0, 50, 50], star4(25, 25, 20, C.gold, O(4)), 'Gold star. Hit and Tumble stars, sparks');
  add('fx_heal_plus', 'effects', 12, 12, [0, 0, 60, 60], rr(23, 8, 14, 44, 5, C.heal, O(5, C.healD)) + rr(8, 23, 44, 14, 5, C.heal, O(5, C.healD)) + rr(25.5, 10.5, 9, 39, 3, C.heal) + star4(48, 12, 8, '#EFFFF0', O(2, C.healD)), 'Mend sparkle with a plus. Mendglob and Mend Bucket');
  add('fx_trail_puff', 'effects', 8, 8, [0, 0, 40, 40], circ(20, 20, 14, '#FFFFFF', { op: .85 }) + circ(20, 20, 14, 'none', { stroke: ink, sw: 2.5, op: .35 }), 'Trail puff behind a shell. Tint the rim by owner in code');
  add('fx_chevron', 'effects', 8, 8, [0, 0, 40, 40], path('M8 12 L20 26 L32 12', 'none', { stroke: ink, sw: 9 }) + path('M8 12 L20 26 L32 12', 'none', { stroke: C.paper, sw: 4.5 }), 'Down chevron for Lean Lines: this block or Hob will fall');
  const cogD = (() => { let d = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; d += rr(-5, -24, 10, 12, 2, C.br, { stroke: ink, sw: 3, extra: ` transform="rotate(${i * 45})"` }); } return d; })();
  add('fx_rest_cog', 'effects', 12, 12, [-27, -27, 54, 54], cogD + circ(0, 0, 16, C.br, O(3)) + circ(0, 0, 5.5, C.brD, O(2.5)), 'Rest cog over a Hob that needs a rest. Turn it in code');
  for (let i = 0; i < 3; i++) {
    const w = [0, 6, -5][i], h2 = [0, -6, 4][i];
    add(`fx_burn_${i}`, 'effects', 16, 16, [0, 0, 100, 100], path(`M50 96 C20 96 14 66 30 46 C34 58 40 58 42 50 C40 30 ${50 + w} ${20 + h2} ${54 + w} ${6 + h2} C70 26 88 50 82 74 C80 88 66 96 50 96 Z`, C.fire, O(6)) + path(`M50 92 C34 92 32 74 42 62 C46 70 50 66 ${52 + w * .5} ${50 + h2} C62 60 70 70 66 82 C64 88 58 92 50 92 Z`, C.fireM) + path('M50 90 C42 90 42 80 48 72 C54 78 58 82 56 86 C55 89 53 90 50 90 Z', C.gold), `Burn flame, frame ${i} of 3. Loop over a burning block or Hob`, { anchor: [8, 15] });
  }
  add('fx_snooze_balloon', 'effects', 40, 52, [-34, -98, 80, 104], snoozeBalloon(0, 0, {}), 'Snooze Balloon alone (round). Use when a Bonked Hob floats off. Anchor is the string end', { anchor: [17, 49] });
  add('fx_snooze_balloon_p2', 'effects', 40, 52, [-34, -98, 80, 104], snoozeBalloon(0, 0, { tag: true }), 'Snooze Balloon with the player 2 diamond tag on the string', { anchor: [17, 49] });
}

// ================================================================ terrain (Puddingstone Downs)
{
  const T = 64;
  // wrap: draw a piece at all 9 offsets so the tile repeats cleanly
  const wrap = (fn, xOnly = false) => { let s = ''; for (const dx of [-T, 0, T]) for (const dy of xOnly ? [0] : [-T, 0, T]) s += g(fn(), `translate(${dx} ${dy})`); return s; };
  const speck = (R, n, cols, rMin, rMax, op = 1) => { let s = ''; for (let i = 0; i < n; i++) { const x = R() * T, y = R() * T, r = rMin + R() * (rMax - rMin), c = cols[Math.floor(R() * cols.length)]; s += wrap(() => ell(x, y, r * 1.25, r, c, { op })); } return s; };
  const seam = (R, n, col, op) => { let s = ''; for (let i = 0; i < n; i++) { const x = R() * T, y = R() * T, w = 8 + R() * 10; s += wrap(() => path(`M${f(x)} ${f(y)} q${f(w / 2)} ${f(-2 - R() * 2)} ${f(w)} 0`, 'none', { stroke: col, sw: 1.4, op, dash: '2.5 2.5' })); } return s; };
  const tile = (name, body, purpose) => add(name, 'terrain', T, T, [0, 0, T, T], body, purpose, { atlas: false, anchor: [0, 0], tile: 'xy' });
  let R = rng(11);
  tile('terrain_soil', rr(0, 0, T, T, 0, '#9A6440') + speck(R, 9, ['#8A5838', '#A8724C'], 2.5, 5, .8) + speck(R, 5, ['#C9A27A'], 1.2, 2.4, .7) + seam(R, 4, ink, .2), 'Soil, the ground body under the grass. Tiles both ways');
  R = rng(23);
  tile('terrain_deep_soil', rr(0, 0, T, T, 0, '#7A4A2E') + speck(R, 9, ['#6A3E26', '#875636'], 2.5, 5.5, .85) + speck(R, 4, ['#A8805A'], 1.2, 2.2, .6) + seam(R, 4, ink, .22), 'Deep soil, the lower ground band. Tiles both ways');
  R = rng(37);
  {
    let b = rr(0, 0, T, T, 0, '#8A7A6E');
    // puddingstone: rounded pebbles set in rock
    const peb = [[10, 12, 9, 7], [34, 8, 7, 5], [54, 18, 8, 6.5], [22, 32, 8, 6], [44, 38, 10, 7], [8, 50, 7, 5.5], [30, 54, 7.5, 6], [56, 56, 7, 5]];
    for (const [x, y, rx, ry] of peb) { const c = R() < .5 ? '#C9A27A' : R() < .5 ? '#A9A39A' : '#B58E6A'; b += wrap(() => ell(x, y, rx, ry, c, { stroke: '#6A5C54', sw: 1.4 }) + path(`M${x - rx * .6} ${y - ry * .3} Q${x - rx * .3} ${y - ry * .75} ${x + rx * .1} ${y - ry * .7}`, 'none', { stroke: '#FFFFFF', sw: 1.3, op: .4 })); }
    b += speck(R, 8, ['#75665C'], .8, 1.6, .8);
    tile('terrain_stone', b, 'Stone (Rock, puddingstone). Stops digging. Tiles both ways');
  }
  R = rng(51);
  tile('terrain_loam', rr(0, 0, T, T, 0, '#B07A52') + speck(R, 12, ['#A06C46', '#BE8A62'], 2, 4.5, .85) + speck(R, 8, ['#E0BE92'], .8, 1.8, .8) + speck(R, 4, ['#7A4A2E'], 1, 2, .6) + seam(R, 3, ink, .16), 'Loam, soft ground that digs easily. Tiles both ways');
  R = rng(77);
  {
    // grass top: meadow cap over soil. Repeats sideways only
    let b = rr(0, 0, T, T, 0, '#9A6440') + speck(rng(11), 6, ['#8A5838', '#A8724C'], 2.5, 5, .8);
    b += wrap(() => path('M0 0 H64 V20 q-4 5 -8 0 t-8 0 t-8 0 t-8 0 t-8 0 t-8 0 t-8 0 t-8 0 Z', '#5AA555'), true);
    b += wrap(() => path('M0 0 H64 V15 q-4 4 -8 0 t-8 0 t-8 0 t-8 0 t-8 0 t-8 0 t-8 0 t-8 0 Z', '#7CC46A'), true);
    b += rr(0, 0, T, 3, 0, '#9BD986');
    b += `<path d="M2 7.5 H62" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round" opacity=".55"/>`;
    for (const [x, c] of [[12, '#FFE08A'], [40, '#FFFFFF'], [55, '#FFE08A']]) b += circ(x, 12, 1.6, c);
    add('terrain_grass_top', 'terrain', T, T, [0, 0, T, T], b, 'Grass cap for the top of the ground, with soil under it. Repeats sideways only', { atlas: false, anchor: [0, 0], tile: 'x' });
  }
}

// ================================================================ parallax (Puddingstone Downs)
{
  const W = 2048;
  const wrapX = (s) => g(s, `translate(${-W} 0)`) + s + g(s, `translate(${W} 0)`);
  // hill line that repeats every W: a sum of whole waves
  const hillY = (waves) => (x) => waves.reduce((y, [n, a, p]) => y + a * Math.sin(2 * Math.PI * n * x / W + p), 0);
  const hillD = (fy, base, H) => { let d = `M0 ${H} L0 ${f(base + fy(0))}`; for (let x = 16; x <= W; x += 16) d += ` L${x} ${f(base + fy(x))}`; return d + ` L${W} ${H} Z`; };
  const surf = (fy, base, off = 0) => { let d = `M0 ${f(base + fy(0) + off)}`; for (let x = 16; x <= W; x += 16) d += ` L${x} ${f(base + fy(x) + off)}`; return d; };
  // sky
  {
    const H = 1024;
    const cloud = (x, y, k) => g(puff(0, 0, 40, '#FFFFFF', { stroke: null, op: .9 }) + path(L.cloudD(0, 0, 40), 'none', { stroke: '#FFFFFF', sw: 3 }) + path('M-40 24 H52', 'none', { stroke: '#D6EEF4', sw: 6, op: .8 }), `translate(${x} ${y}) scale(${k})`);
    let b = rr(0, 0, W, H, 0, 'url(#skyg)');
    b += circ(1560, 250, 150, '#FFF3C4', { op: .3 }) + circ(1560, 250, 96, '#FFF3C4', { op: .9 }) + circ(1560, 250, 96, 'none', { stroke: '#FFE08A', sw: 5 });
    let cl = '';
    for (const [x, y, k] of [[180, 190, 1.8], [620, 330, 1.2], [980, 150, 1.5], [1300, 420, 1], [1840, 380, 1.6], [420, 520, .9], [1620, 560, 1.1], [60, 620, .8], [1120, 640, .9]]) cl += cloud(x, y, k);
    b += wrapX(cl);
    add('bg_downs_sky', 'backgrounds', 1024, 512, [0, 0, W, H], b, 'Sky for Puddingstone Downs, far parallax layer. Repeats sideways', { atlas: false, anchor: [0, 0], tile: 'x', defs: '<linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8EC"/><stop offset="1" stop-color="#FFF1D0"/></linearGradient>' });
  }
  // far hills: pale, sleepy
  {
    const H = 512, base = 250;
    const fy = hillY([[1, 46, .4], [2, 38, 2.1], [3, 26, 4.2], [5, 12, 1.0]]);
    const d = hillD(fy, base, H);
    let inner = rr(0, 0, W, H, 0, '#B7DDA8');
    const R = rng(5);
    let pt = '';
    for (let i = 0; i < 14; i++) { const x = 60 + i * 146 + R() * 40, y = base + fy(x) + 70 + R() * 120; pt += L.patch(x, y, 90 + R() * 60, 60 + R() * 40, R() * 30 - 15, i % 2 ? '#C6E6B4' : '#A9D29A', { op: .9 }); }
    inner += wrapX(pt);
    inner += `<path d="${surf(fy, base, 16)}" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-dasharray="12 12" stroke-linecap="round" opacity=".6"/>`;
    let b = clipped(path(d, '#000'), inner) + path(surf(fy, base), 'none', { stroke: '#7FB58A', sw: 5 });
    // sleepy hill faces
    for (const x of [470, 1490]) { const y = base + fy(x) + 74; b += path(`M${x - 40} ${y} q12 10 24 0 M${x + 16} ${y} q12 10 24 0`, 'none', { stroke: '#6FA07A', sw: 5 }) + path(`M${x - 10} ${y + 30} q10 8 20 0`, 'none', { stroke: '#6FA07A', sw: 5 }) + circ(x - 52, y + 22, 12, C.blush, { op: .35 }) + circ(x + 52, y + 22, 12, C.blush, { op: .35 }); }
    add('bg_downs_hills_far', 'backgrounds', 1024, 256, [0, 0, W, H], b, 'Far hills for Puddingstone Downs, middle parallax layer. Clear above the hill line. Repeats sideways', { atlas: false, anchor: [0, 0], tile: 'x' });
  }
  // near hills: meadow green with patches, trees and a few puddingstones
  {
    const H = 512, base = 300;
    const fy = hillY([[1, 40, 2.6], [2, 44, .3], [4, 20, 1.7], [7, 8, 3.0]]);
    const d = hillD(fy, base, H);
    let inner = rr(0, 0, W, H, 0, '#8FCB7A');
    const R = rng(9);
    let pt = '';
    const cols = ['#A4D88C', '#7CC46A', '#B5DE8F', '#FFE08A'];
    for (let i = 0; i < 16; i++) { const x = 40 + i * 128 + R() * 40, y = base + fy(x) + 60 + R() * 130; pt += L.patch(x, y, 100 + R() * 70, 64 + R() * 40, R() * 36 - 18, cols[i % 4], { op: i % 4 === 3 ? .55 : .9 }); }
    inner += wrapX(pt);
    inner += `<path d="${surf(fy, base, 18)}" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-dasharray="12 12" stroke-linecap="round" opacity=".6"/>`;
    let b = '';
    const tree = (x, k, kind) => { const y = base + fy(x) + 6; let t = rr(-6, -44, 12, 46, 4, '#7A4A2E', O(4)); t += kind ? circ(0, -70, 34, '#5AA555', O(4)) + circ(-12, -82, 9, '#FFFFFF', { op: .25 }) + circ(10, -62, 4, C.lobber) + circ(-8, -58, 4, C.lobber) : path('M0 -130 L32 -36 L-32 -36 Z', '#4E9A58', O(4)) + path('M0 -104 L16 -60', 'none', { stroke: '#FFFFFF', sw: 3, op: .3 }); return g(t, `translate(${x} ${f(y)}) scale(${k})`); };
    for (const [x, k, kind] of [[210, 1, 1], [300, .7, 0], [760, .8, 1], [1180, 1.1, 0], [1260, .75, 1], [1700, .9, 1], [1930, .7, 0]]) b += tree(x, k, kind);
    b += clipped(path(d, '#000'), inner) + path(surf(fy, base), 'none', { stroke: ink, sw: 4.5, op: .7 });
    for (const [x, k] of [[560, 1], [1420, .8], [990, .6]]) { const y = base + fy(x) + 40; b += g(ell(0, 0, 34, 22, '#C9A27A', O(4)) + ell(-10, -4, 7, 5, '#A9A39A', { stroke: '#6A5C54', sw: 2 }) + ell(10, 4, 8, 5, '#E3C9A4', { stroke: '#6A5C54', sw: 2 }) + ell(8, -9, 5, 3.5, '#B58E6A', { stroke: '#6A5C54', sw: 2 }), `translate(${x} ${f(y)}) scale(${k})`); }
    add('bg_downs_hills_near', 'backgrounds', 1024, 256, [0, 0, W, H], b, 'Near hills for Puddingstone Downs, front parallax layer. Clear above the hill line. Repeats sideways', { atlas: false, anchor: [0, 0], tile: 'x' });
  }
}

// ================================================================ UI
{
  const lip = 5;
  // round pill button with a lip. face = fill, dark = lip colour
  const roundBtn = (r, face, dark, icon, pressed = false) => {
    const cy = r + 3 + (pressed ? lip - 1 : 0);
    return (pressed ? '' : circ(r + 3, r + 3 + lip, r, dark, O(3))) + circ(r + 3, cy, r, face, O(3)) +
      clipped(circ(r + 3, cy, r - 1.5, '#000'), ell(r + 3, cy - r * .62, r * .78, r * .36, '#FFFFFF', { op: .3 })) + g(icon, `translate(${r + 3} ${cy})`);
  };
  const boomIcon = burst(0, 0, 21, 12, 8, '#FFFFFF', { sw: 3, rot: Math.PI / 8 }) + circ(0, 0, 5, ink);
  add('ui_fire', 'ui', 80, 86, [0, 0, 80, 86], roundBtn(37, C.saffron, C.saffronD, boomIcon), 'Fire button, up. Gold pill, no text', { anchor: [40, 40] });
  add('ui_fire_pressed', 'ui', 80, 86, [0, 0, 80, 86], roundBtn(37, C.saffronD, C.saffronD, boomIcon, true), 'Fire button, pressed', { anchor: [40, 40] });
  add('ui_fire_off', 'ui', 80, 86, [0, 0, 80, 86], roundBtn(37, '#D8CDB8', '#A99E8C', burst(0, 0, 21, 12, 8, '#F1E9DA', { sw: 3, stroke: C.ink2, rot: Math.PI / 8 }) + circ(0, 0, 5, C.ink2)), 'Fire button, not usable (rival turn, Hob resting)', { anchor: [40, 40] });
  const arrowR = path('M-11 -5 H1 V-13 L14 0 L1 13 V5 H-11 Z', C.you, O(3));
  add('ui_walk_right', 'ui', 52, 58, [0, 0, 52, 58], roundBtn(23, '#FFFFFF', C.indigoL, arrowR), 'Walk right arrow. Costs Steam', { anchor: [26, 26] });
  add('ui_walk_left', 'ui', 52, 58, [0, 0, 52, 58], roundBtn(23, '#FFFFFF', C.indigoL, g(arrowR, 'scale(-1 1)')), 'Walk left arrow. Costs Steam', { anchor: [26, 26] });
  add('ui_pause', 'ui', 44, 50, [0, 0, 44, 50], roundBtn(19, '#FFFFFF', C.indigoL, rr(-8.5, -9, 6.5, 18, 2.5, ink) + rr(2, -9, 6.5, 18, 2.5, ink)), 'Pause button', { anchor: [22, 22] });
  // shot tray chips
  const chip = (fill, edge, sw, extra = '') => rr(3, 6, 54, 54, 12, C.ink, { op: .22 }) + rr(3, 3, 54, 54, 12, fill, { stroke: edge, sw }) + extra;
  add('ui_chip', 'ui', 60, 62, [0, 0, 60, 62], chip('#FFFFFF', ink, 2), 'Shot tray chip frame, normal. Put a 48 px shot icon on it');
  add('ui_chip_selected', 'ui', 60, 62, [0, 0, 60, 62], chip(C.saffron, ink, 3, rr(8, 8, 44, 44, 8, 'none', { stroke: '#FFFFFF', sw: 2, op: .7, extra: ' stroke-dasharray="4 4"' })), 'Shot tray chip frame, selected (gold)');
  add('ui_chip_locked', 'ui', 60, 62, [0, 0, 60, 62], chip('#D8D2C8', C.ink2, 2, path('M24 30 V25 a6 6 0 0 1 12 0 V30', 'none', { stroke: C.ink2, sw: 3.5 }) + rr(20, 29, 20, 15, 4, C.cream, { stroke: C.ink2, sw: 2.5 }) + circ(30, 36.5, 2.2, C.ink2)), 'Shot tray chip frame, not usable (grey with a lock)');
  add('ui_chip_doodad', 'ui', 60, 62, [0, 0, 60, 62], rr(3, 6, 54, 54, 4, C.ink, { op: .22 }) + rr(3, 3, 54, 54, 4, '#DFF3D6', { stroke: ink, sw: 2 }) + circ(48, 12, 7, C.good, O(2)) + path('M45 15 L51 9', 'none', { stroke: '#FFFFFF', sw: 2.5 }), 'Doodad chip frame: green, square corners, wrench dot');
  // crew portrait rings
  const hole = 'M34 13.5 a20.5 20.5 0 1 1 -.01 0 Z';
  const ringR = (sel) => (sel ? `<path fill-rule="evenodd" d="M34 2 a32 32 0 1 0 .01 0 Z ${hole}" fill="${C.gold}" stroke="${ink}" stroke-width="2.5"/>` : '') +
    `<path fill-rule="evenodd" d="M34 6.5 a27.5 27.5 0 1 0 .01 0 Z ${hole}" fill="${C.you}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
  add('ui_ring_p1', 'ui', 68, 68, [0, 0, 68, 68], ringR(false), 'Crew portrait ring, player 1: round, solid blue. Hollow middle for a 48 px portrait');
  add('ui_ring_p1_active', 'ui', 68, 68, [0, 0, 68, 68], ringR(true), 'Crew portrait ring, player 1, the Hob whose turn it is (gold edge)');
  const dia = (r) => `M34 ${34 - r} L${34 + r} 34 L34 ${34 + r} L${34 - r} 34 Z`;
  const ringD = (sel) => {
    let hatch = ''; for (let x = -30; x < 80; x += 7) hatch += line(x, 70, x + 32, -2, '#FFFFFF', 1.8);
    const d = `${dia(sel ? 29.5 : 32)} ${hole}`;
    return (sel ? `<path fill-rule="evenodd" d="${dia(33)} ${hole}" fill="${C.gold}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>` : '') +
      `<path fill-rule="evenodd" d="${d}" fill="${C.rival}"/>` + clipped(`<path clip-rule="evenodd" d="${d}"/>`, hatch) + path(dia(sel ? 29.5 : 32), 'none', O(2.5)) + circ(34, 34, 20.5, 'none', O(2.5));
  };
  add('ui_ring_p2', 'ui', 68, 68, [0, 0, 68, 68], ringD(false), 'Crew portrait ring, player 2: diamond, hatched orange. Round hole for a 48 px portrait');
  add('ui_ring_p2_active', 'ui', 68, 68, [0, 0, 68, 68], ringD(true), 'Crew portrait ring, player 2, the Hob whose turn it is (gold edge)');
  add('ui_ring_bonked', 'ui', 68, 68, [-4, -4, 68, 68], circ(30, 30, 20.5, C.ink, { op: .45 }) + g(snoozeBalloon(0, 0, { str: 14 }), 'translate(27 49) scale(.62)'), 'Overlay for a Bonked Hob portrait: dim disc and a small balloon');
  // wind, Squall
  add('ui_wind_arrow', 'ui', 48, 24, [-36, -18, 72, 36], L.windArrow(0, 0, 5, 1) + path('M-22 0 H6', 'none', { stroke: C.steelL, sw: 3, dash: '5 5' }), 'Wind arrow, points right. Flip for left wind, scale length by strength');
  add('ui_wind_leaf', 'ui', 12, 12, [0, 0, 48, 48], g(path('M0 18 C-14 6 -12 -12 0 -20 C12 -12 14 6 0 18 Z', '#8BCB3A', O(3.5)) + line(0, 14, 0, -12, ink, 2), 'translate(24 24) rotate(50)'), 'Wind leaf pip. One leaf per step of wind pull on a shell');
  {
    const cl = 'M12 40 a11 11 0 0 1 4 -21 a15 15 0 0 1 28 -3 a12 12 0 0 1 8 24 Z';
    add('ui_squall', 'ui', 32, 32, [0, 0, 64, 64], path(cl, C.slate, O(3.5)) + clipped(path(cl, '#000'), ell(40, 44, 30, 10, ink, { op: .2 }) + path('M20 24 Q26 14 36 14', 'none', { stroke: '#FFFFFF', sw: 3.5, op: .5 })) + path('M10 50 h22 M20 58 h26 M38 50 h16', 'none', { stroke: ink, sw: 6 }) + path('M10 50 h22 M20 58 h26 M38 50 h16', 'none', { stroke: C.paper, sw: 2.5 }), 'Sudden Squall icon: storm cloud with wind streaks');
  }
  // Pennants, Button coin
  const pen = (filled) => line(8, 50, 8, 5, ink, 4.5) + circ(8, 5, 3.5, C.br, O(2)) + path('M8 9 L36 9 L28 18 L36 27 L8 27 Z', filled ? C.gold : '#E6DCC8', O(3)) + (filled ? line(12, 13.5, 24, 13.5, '#FFFFFF', 2.5, { op: .6 }) : path('M12 13.5 H24', 'none', { stroke: C.ink2, sw: 1.5, op: .4, dash: '3 3' }));
  add('ui_pennant', 'ui', 20, 27, [0, 0, 40, 54], pen(true), 'Pennant, won (gold swallow-tail flag). 3 per level');
  add('ui_pennant_empty', 'ui', 20, 27, [0, 0, 40, 54], pen(false), 'Pennant, not won yet');
  add('ui_button_coin', 'ui', 24, 24, [0, 0, 48, 48], circ(24, 26, 20, C.saffronD, O(3)) + circ(24, 23, 20, C.saffron, O(3)) + circ(24, 23, 13.5, 'none', { stroke: C.saffronD, sw: 2.5 }) + [[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([x, y]) => circ(24 + x, 23 + y, 2.6, ink)).join('') + path('M10 16 Q14 8 22 6', 'none', { stroke: '#FFFFFF', sw: 3, op: .6 }), 'Button coin: four-hole sewing button, the game currency');
  // kettle gauge: dial in 4 states, plus a bar
  const dial = (st) => {
    const hp = { full: .85, hurt: .4, critical: .14, popped: 0 }[st];
    let b = circ(24, 24, 21, C.copper, O(3)) + circ(24, 24, 16, st === 'popped' ? '#CFC8C0' : C.paper, O(2.5));
    const arc = (a0, a1, col) => { const p = (a) => [24 + Math.cos(a) * 12, 24 + Math.sin(a) * 12]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return path(`M${f(x0)} ${f(y0)} A12 12 0 0 1 ${f(x1)} ${f(y1)}`, 'none', { stroke: col, sw: 4, cap: 'butt' }); };
    const A = (t) => Math.PI * (1 + t) ; // t 0..1 sweeps left to right over the top
    b += arc(A(0), A(.25), C.danger) + arc(A(.25), A(.5), C.saffron) + arc(A(.5), A(1), C.good);
    const a = A(hp);
    b += line(24, 24, 24 + Math.cos(a) * 11, 24 + Math.sin(a) * 11, st === 'critical' ? C.danger : ink, 3) + circ(24, 24, 3, ink);
    if (st === 'hurt' || st === 'critical') b += path('M12 30 l5 3 l4 -3 l5 4 l5 -2 l5 3', 'none', { stroke: ink, sw: 2 });
    if (st === 'critical') b += puff(40, 9, 6, '#FFFFFF', { sw: 2 }) + path('M4 10 l5 3 M2 20 h5', 'none', { stroke: ink, sw: 2 });
    if (st === 'popped') b += path('M17 29 l14 10 M31 29 l-14 10', 'none', { stroke: ink, sw: 3 });
    return b;
  };
  for (const st of ['full', 'hurt', 'critical', 'popped']) add(`ui_kettle_gauge_${st}`, 'ui', 48, 48, [0, 0, 48, 48], dial(st), `Kettle gauge dial, ${st}. Changes at 50% and 25% like the kettle sprite`);
  add('ui_kettle_bar_frame', 'ui', 104, 18, [0, 0, 104, 18], rr(2, 2, 100, 14, 7, '#3A3236', O(2.5)) + line(52, 3, 52, 15, C.paper, 1.5, { op: .5 }) + line(27, 3, 27, 15, C.paper, 1.5, { op: .5 }), 'Kettle HP bar frame with marks at 25% and 50%. Draw the fill on top, then crop it');
  add('ui_kettle_bar_fill', 'ui', 104, 18, [0, 0, 104, 18], rr(4, 4, 96, 10, 5, C.copper) + rr(7, 5.5, 90, 3, 1.5, '#F2A469'), 'Kettle HP bar fill (copper). Crop its width to the HP share');
  add('ui_steam_bar_fill', 'ui', 104, 18, [0, 0, 104, 18], rr(4, 4, 96, 10, 5, '#FFFFFF') + rr(7, 5.5, 90, 3, 1.5, C.steelL), 'Steam bar fill (white) for Walk. Use with the kettle bar frame');
  for (const cls of ['lobber', 'zinger', 'scatter', 'delver', 'boinker', 'patcher']) add(`ui_class_${cls}`, 'ui', 24, 24, [-20, -20, 40, 40], L.classIcon(cls, 0, 0, 18), `Class icon, ${L.CLASS_NAME[cls]}`);
  // crests for the hand-off card
  add('ui_crest_p1', 'ui', 64, 64, [0, 0, 64, 64], circ(32, 32, 28, C.you, O(3)) + circ(32, 32, 22, 'none', { stroke: '#FFFFFF', sw: 1.8, op: .7, extra: ' stroke-dasharray="4 4"' }) + line(24, 46, 24, 18, ink, 4) + path('M24 19 L46 26 L24 34 Z', C.paper, O(2.5)), 'Player 1 crest: round badge with a pennant');
  {
    let hatch = ''; for (let x = -30; x < 80; x += 8) hatch += line(x, 66, x + 32, -2, '#FFFFFF', 2, { op: .55 });
    const d = 'M32 3 L61 32 L32 61 L3 32 Z';
    add('ui_crest_p2', 'ui', 64, 64, [0, 0, 64, 64], path(d, C.rival, O(3)) + clipped(path(d, '#000'), hatch) + path(d, 'none', O(3)) + line(25, 47, 25, 19, ink, 4) + rr(25, 20, 19, 14, 2, C.paper, O(2.5)), 'Player 2 crest: diamond badge with a square flag');
  }
}

// ================================================================ app icon
{
  const S = 1024;
  let b = rr(0, 0, S, S, 0, 'url(#icg)');
  b += circ(800, 200, 190, '#FFF3C4', { op: .35 }) + circ(800, 200, 120, '#FFF3C4');
  b += path('M0 600 C200 500 380 560 520 600 C700 650 860 560 1024 580 V1024 H0 Z', '#B7DDA8');
  b += path('M0 730 C220 660 420 710 600 740 C780 770 900 710 1024 720 V1024 H0 Z', '#7CC46A');
  b += path('M0 730 C220 660 420 710 600 740 C780 770 900 710 1024 720', 'none', O(10));
  b += `<path d="M0 764 C220 694 420 744 600 774 C780 804 900 744 1024 754" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="22 22" stroke-linecap="round" opacity=".6"/>`;
  // a small wall with the kettle on top and Marge beside it
  const bs = 250, x0 = 512 - bs * 1.5, y0 = 1024 - bs - 36;
  b += solidBlock('cobble', x0, y0, bs, 0) + solidBlock('timber', x0 + bs, y0, bs, 0) + solidBlock('cobble', x0 + bs * 2, y0, bs, 0);
  b += solidBlock('wicker', x0, y0 - bs, bs, 0);
  b += g(posedHob('marge', 'blue', { face: 'cheer', hf: [24, -40], toolRot: -10 }), `translate(${x0 + bs * .5} ${y0 - bs + 8}) scale(3.1)`);
  b += L.kettle(x0 + bs * 2 - 30, y0 + 4, 4.1, { hp: 1 });
  add('app_icon', 'app', 1024, 1024, [0, 0, S, S], b, 'App icon: the Heartkettle on a fort wall with Marge. Full square, no clear pixels', { atlas: false, fixed: [1024, 512, 192], anchor: [0, 0], defs: '<linearGradient id="icg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6FC3E6"/><stop offset="1" stop-color="#FFF1D0"/></linearGradient>' });
}

// ================================================================ write
fs.rmSync(path_.join(ASSETS, 'svg'), { recursive: true, force: true });
fs.mkdirSync(path_.join(ASSETS, 'svg'), { recursive: true });
const manifest = { name: 'Castle Protect v0.1 sprites', generator: 'tools/art-gen/gen-sprites.mjs + render-sprites.mjs', scales: ['1x', '2x'], note: 'w and h are px at @1x. anchor is px at @1x from the top left. Hobs face right; flip them for the right-hand fort.', sprites: [] };
for (const s of sprites) {
  const [vx, vy, vw, vh] = s.vb;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${s.w}" height="${s.h}">${s.defs ? `<defs>${s.defs}</defs>` : ''}${s.body}</svg>\n`;
  fs.writeFileSync(path_.join(ASSETS, 'svg', s.name + '.svg'), svg);
  const e = { name: s.name, group: s.group, purpose: s.purpose, w: s.w, h: s.h, anchor: s.anchor.map(n => Math.round(n * 100) / 100), svg: `svg/${s.name}.svg` };
  if (s.fixed) e.files = Object.fromEntries(s.fixed.map(px => [String(px), `sprites/${s.name}-${px}.png`]));
  else e.files = { '1x': `sprites/${s.name}.png`, '2x': `sprites/${s.name}@2x.png` };
  e.atlas = s.atlas;
  if (s.tile) e.tile = s.tile;
  manifest.sprites.push(e);
}
const groups = {};
for (const s of sprites) groups[s.group] = (groups[s.group] || 0) + 1;
manifest.groups = groups;
manifest.count = sprites.length;
fs.writeFileSync(path_.join(ASSETS, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log('sprites', sprites.length, groups);
