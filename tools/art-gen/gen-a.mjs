// Materials, crew, Flatteners, Baron, Heartkettle
import fs from 'fs';
import * as L from './lib.mjs';
const { C, doc, text, rr, circ, ell, path, line, g, block, hob, flattener, kettle, baron, classIcon, CLASSES, CLASS_NAME, CLASS_ROLE, SKINS, COATS, stitch, star4, puff, burst, panel, f } = L;
const ART = '/home/user/CastleProtect/docs/art';
const out = (name, svg) => { fs.writeFileSync(`${ART}/${name}`, svg); console.log('wrote', name); };

function sheetBg(w, h, tint = C.paper) {
  return rr(0, 0, w, h, 0, tint) + rr(0, 0, w, h, 0, 'url(#paperDots)');
}
function header(x, y, title, sub) {
  return text(x, y, title, { size: 44, weight: 700, fill: C.ink }) + text(x, y + 32, sub, { size: 19, weight: 500, fill: C.ink2, family: L.BODY });
}

// ------------------------------------------------ material sheets
const MATS = [
  { key: 'wicker', file: '03-material-wicker.svg', name: 'Wicker', tier: 1, hp: 30, cost: 5, quirk: 'Light. Burns. No crush when it falls.', sw: [C.wk, C.wkD, C.wkL, C.wkH], fx: 'burn' },
  { key: 'timber', file: '04-material-timber.svg', name: 'Timber', tier: 2, hp: 50, cost: 15, quirk: 'Burns. Cheap and stiff: good for wings.', sw: [C.tb, C.tbD, C.tbL, C.tbH], fx: 'burn' },
  { key: 'cobble', file: '05-material-cobble.svg', name: 'Cobble', tier: 3, hp: 80, cost: 35, quirk: 'Fireproof. Heavy: crush x2 when it falls.', sw: [C.cb, C.cbD, C.cbL, C.cbM, C.cbH], fx: 'crush' },
  { key: 'brass', file: '06-material-brassbound.svg', name: 'Brassbound', tier: 4, hp: 110, cost: 70, quirk: 'Fireproof. Half from Pierce and Dig.', sw: [C.bp, C.bpD, C.bpL, C.br, C.brD, C.brL], fx: 'zap' },
  { key: 'footing', file: '08-material-footing.svg', name: 'Footing', tier: 0, hp: 400, cost: 0, quirk: 'Bottom row. Never falls. Immune to Dig. 25% from Blast.', sw: [C.ft, C.ftD, C.ftL, C.ftB], fx: 'foot' },
  { key: 'moon', file: '07-material-moonbrick.svg', name: 'Moonbrick', tier: 5, hp: 140, cost: 150, quirk: 'Heals 7 at turn start, not after a hit.', sw: [C.mb, C.mbD, C.mbE, C.mbG, C.mbH], fx: 'heal', tag: 'U3' },
];
const STATES_F = [['0  Fresh', '400 to 268 HP'], ['1  Scuffed', '267 to 134 HP'], ['2  Battered', '133 to 1 HP'], ['Stub', '0 HP: still holds, never falls']];
const STATES = [['0  Fresh', '100 to 67% HP'], ['1  Scuffed', '66 to 34% HP'], ['2  Battered', '33 to 1% HP'], ['Broken', '0 HP: rubble, then fades']];

for (const m of MATS) {
  const W = 1400, H = 760;
  let s = sheetBg(W, H);
  s += header(60, 76, `${m.name}`, m.tier ? `Tier ${m.tier}   |   Block HP ${m.hp}   |   Cost ${m.cost} Buttons   |   ${m.quirk}` : `Fixed row   |   Block HP ${m.hp}   |   Free   |   ${m.quirk}`);
  s += rr(W - 250, 40, 190, 54, 27, C[m.key === 'footing' ? 'ftL' : m.key === 'moon' ? 'mbD' : m.key === 'brass' ? 'br' : m.key === 'cobble' ? 'cbD' : m.key === 'timber' ? 'tb' : 'wk'], { stroke: C.ink, sw: 3 });
  s += text(W - 155, 76, m.tier ? `TIER ${m.tier}` : 'FIXED', { size: 26, weight: 700, anchor: 'middle', fill: C.ink });
  s += m.tag ? rr(W - 420, 40, 150, 54, 27, C.ink2, { stroke: C.ink, sw: 3 }) + text(W - 345, 76, 'Update 3', { size: 24, weight: 700, anchor: 'middle', fill: C.paper }) : '';
  // four big states
  const bs = 210, gap = 100, x0 = 80, y0 = 175;
  for (let i = 0; i < 4; i++) {
    const bx = x0 + i * (bs + gap);
    s += ell(bx + bs / 2, y0 + bs + 10, bs * .55, 12, C.ink, { op: .12 });
    s += block(m.key, bx, y0, bs, i, 5);
    s += text(bx + bs / 2, y0 + bs + 56, (m.key === 'footing' ? STATES_F : STATES)[i][0], { size: 26, weight: 700, anchor: 'middle' });
    s += text(bx + bs / 2, y0 + bs + 84, (m.key === 'footing' ? STATES_F : STATES)[i][1], { size: 17, weight: 500, anchor: 'middle', fill: C.ink2, family: L.BODY });
  }
  // in-game scale strip: a wall at 32px (2x of 16) and 19px (zoom 0.6 at 2x)
  const sy = 520;
  s += rr(60, sy - 20, 760, 220, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5, op: .9 });
  s += text(84, sy + 14, 'In game size', { size: 22, weight: 700 });
  s += text(84, sy + 40, 'Left: 32 px per block (zoom 1.0 at @2x). Right: 19 px (zoom 0.6).', { size: 16, weight: 500, fill: C.ink2, family: L.BODY });
  const wall = [[0, 1, 0, 2], [1, 0, 2, 3], [0, 2, 1, 0]];
  for (const [k, bsz, wx] of [[0, 32, 90], [1, 19, 330]]) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += block(m.key, wx + c * bsz, sy + 64 + r * bsz, bsz, wall[r][c], r * 4 + c);
  }
  // a mixed row on sky to check contrast vs ground
  s += rr(520, sy + 56, 280, 120, 10, C.sky1);
  s += path('M520 ' + (sy + 150) + ' Q600 ' + (sy + 132) + ' 680 ' + (sy + 146) + ' T800 ' + (sy + 140) + ' L800 ' + (sy + 176) + ' L520 ' + (sy + 176) + ' Z', '#7CC46A');
  for (let c = 0; c < 4; c++) for (let r = 0; r < 2; r++) s += block(m.key, 612 + c * 24, sy + 104 + r * 24, 24, 0, c + r);
  s += text(660, sy + 80, 'on sky and grass', { size: 14, weight: 600, anchor: 'middle', fill: C.ink2, family: L.BODY });
  // palette chips
  const px = 860;
  s += text(px, sy + 14, 'Palette', { size: 22, weight: 700 });
  m.sw.forEach((hex, i) => {
    const cx = px + (i % 3) * 170, cy = sy + 40 + Math.floor(i / 3) * 80;
    s += rr(cx, cy, 54, 54, 12, hex, { stroke: C.ink, sw: 2.5 }) + text(cx + 64, cy + 34, hex, { size: 18, weight: 600, family: 'JetBrains Mono, monospace' });
  });
  // fx note
  const note = { foot: 'At 0 HP it drops to a stub that still holds the row. Free, always full width.', burn: 'Fire: lights on hit, smoulders at state 2, chars to black rubble.', crush: 'Falls in one chunk. Dust ring and a deep thud on landing.', zap: 'From U3, Zap: violet arcs jump strap to strap across touching blocks.', heal: 'Ships with Clankmouth Mines (U3). Veins are pale violet, never teal.' }[m.fx];
  s += text(px, sy + 200, note, { size: 15, weight: 600, fill: C.ink2, family: L.BODY });
  out(m.file, doc(W, H, s, { title: `${m.name} block sheet`, desc: `Damage states for ${m.name} blocks` }));
}

// ------------------------------------------------ crew lineup
{
  const W = 1800, H = 1024;
  let s = sheetBg(W, H);
  s += header(60, 76, 'Hob crew: seven Classes at launch', 'The hat family is the Class. The blue scarf is the team. The Peeper joins in Update 2. Named Hobs (sheet 22) vary inside their hat family.');
  const sp = 210, x0 = 150;
  CLASSES.forEach((cls, i) => {
    const cx = x0 + i * sp;
    s += ell(cx, 470, 80, 14, C.ink, { op: .08 });
    s += hob(cls, cx - 6, 470, 2.4, { skin: SKINS[i % 6], coat: COATS[i], face: i % 3 === 1 ? 'grit' : 'happy' });
    s += classIcon(cls, cx, 528, 22);
    s += text(cx, 588, CLASS_NAME[cls], { size: 28, weight: 700, anchor: 'middle' });
    s += text(cx, 614, CLASS_ROLE[cls], { size: 17, weight: 600, anchor: 'middle', fill: C.ink2, family: L.BODY }) + text(cx, 660, ['Marge Dumpling', 'Quill Needlesworth', 'Jax Peppercorn', 'Grub Mudgett', 'Bobbin Springheel', 'Ember Toastwell', 'Hetty Mortarboard', 'Winkle Spyglass'][i], { size: 13, weight: 600, anchor: 'middle', fill: C.ink2, family: L.BODY, op: .8 });
    s += rr(cx - 34, 626, 68, 12, 6, C[cls], { stroke: C.ink, sw: 2 });
    if (cls === 'peeper') s += line(cx - 104, 150, cx - 104, 668, C.ink2, 2.5, { dash: '3 9' }) + g(rr(-58, -18, 116, 36, 18, C.ink2, { stroke: C.ink, sw: 2.5 }) + text(0, 8, 'Update 2', { size: 21, weight: 700, anchor: 'middle', fill: C.paper }), `translate(${cx + 6} 168) rotate(4)`);
  });
  // silhouette test row
  s += rr(60, 688, W - 120, 300, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(90, 726, 'Silhouette test', { size: 26, weight: 700 });
  s += text(90, 752, 'Solid fill at 96 px, then true phone size: 24 px and 16 px tall. Each Class must read by hat alone.', { size: 17, weight: 500, fill: C.ink2, family: L.BODY });
  CLASSES.forEach((cls, i) => {
    const cx = 160 + i * 120;
    s += g(hob(cls, cx, 914, .9, { tool: false }), '', ' filter="url(#sil)"');
  });
  // 24px and 16px rows
  s += text(1150, 794, '24 px', { size: 18, weight: 700, fill: C.ink2 });
  s += text(1150, 894, '16 px', { size: 18, weight: 700, fill: C.ink2 });
  CLASSES.forEach((cls, i) => {
    const cx = 1230 + i * 62;
    s += hob(cls, cx, 824, 0.24, { skin: SKINS[i % 6], coat: COATS[i] });
    s += hob(cls, cx, 916, 0.16, { skin: SKINS[i % 6], coat: COATS[i] });
  });
  s += text(160 + 7 * 120, 950, 'U2', { size: 15, weight: 700, anchor: 'middle', fill: C.ink2 }) + text(1230 + 7 * 62, 850, 'U2', { size: 12, weight: 700, anchor: 'middle', fill: C.ink2 });
  s += text(1150, 954, 'Rule: no two Classes share a hat outline.', { size: 15, weight: 600, fill: C.ink2, family: L.BODY }) + text(1150, 976, 'Class colour backs up the shape, never replaces it.', { size: 15, weight: 600, fill: C.ink2, family: L.BODY });
  out('09-hob-crew-lineup.svg', doc(W, H, s, { title: 'Hob crew lineup', desc: 'Seven launch Hob Classes and the U2 Peeper, with silhouette tests' }));
}

// ------------------------------------------------ Flattener lineup
{
  const W = 1800, H = 920;
  let s = sheetBg(W, H, '#EEEFF3');
  s += header(60, 76, 'The Flatteners', 'Hobs too, but pressed: grey and cream uniforms with creases, white gloves, pancake caps, an orange tie, one straight-edged tool. Names from 04-enemies.');
  const types = [
    ['snipper', 'Hedge Snipper', 'Lobber. Neat Brigade'],
    ['rake', 'Rake Hand', 'Scatterjack. Neat Brigade'],
    ['clerk', 'Clipboard Clerk', 'Peeper. Neat Brigade'],
    ['sniper', 'Ruler Sniper', 'Zinger. Level Guard'],
    ['tamper', 'Tamper', 'Delver. Level Guard'],
    ['pump', 'Pump Hand', 'Sizzler. Drain Fleet'],
    ['filler', 'Filler', 'Patcher. Chisel Corps'],
    ['smoothie', 'Big Smoothie', 'Mini-boss machine'],
  ];
  types.forEach(([t, n, d], i) => {
    const cx = 140 + i * 216;
    s += ell(cx, 480, 84, 14, C.ink, { op: .08 });
    s += flattener(t, cx + (t === 'smoothie' ? 10 : 0), 480, t === 'smoothie' ? 1.7 : 2.4, { flip: false });
    s += text(cx, 560, n, { size: 26, weight: 700, anchor: 'middle' });
    s += text(cx, 588, d, { size: 16, weight: 600, anchor: 'middle', fill: C.ink2, family: L.BODY });
  });
  s += rr(60, 630, W - 120, 250, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(90, 670, 'Versus test: Hob next to Flattener, solid fill, then 24 px', { size: 24, weight: 700 });
  const pairs = [['lobber', 'snipper'], ['zinger', 'sniper'], ['peeper', 'clerk']];
  pairs.forEach(([h, fl], i) => {
    s += g(hob(h, 140 + i * 210, 840, .9, { tool: false }), '', ' filter="url(#sil)"');
    s += g(flattener(fl, 230 + i * 210, 840, .9), '', ' filter="url(#sil)"');
  });
  pairs.forEach(([h, fl], i) => { s += hob(h, 760 + i * 70, 840, .24) + flattener(fl, 790 + i * 70, 840, .24); });
  const notes = ['Hobs: domes, cones, floppy brims, puffs. Round tops.', 'Flatteners: one flat line on top, one straight tool.', 'Team cue: blue scarf (you) vs orange tie (rival),', 'backed by side of screen, flag shape and pips.', 'Bonked Flatteners float off on a square balloon.'];
  notes.forEach((t, i) => s += text(1020, 712 + i * 30, t, { size: 18, weight: 600, fill: C.ink2, family: L.BODY }));
  out('10-flattener-lineup.svg', doc(W, H, s, { title: 'Flattener lineup', desc: 'Flattener enemy crew and the Big Smoothie' }));
}

// ------------------------------------------------ Baron Levelwell
{
  const W = 1600, H = 1000;
  let s = sheetBg(W, H, '#EEF0F8');
  s += header(60, 76, 'Baron Levelwell', 'Leader of the Flatteners. Long grey coat, the flattest cap in Brickabrac, a bubble-level monocle, tea always in hand.');
  // throne roller
  const tx = 470, ty = 860;
  s += ell(tx, ty + 8, 300, 22, C.ink, { op: .15 });
  s += rr(tx - 170, ty - 232, 170, 22, 6, C.br, { stroke: C.ink, sw: 3 }) + line(tx - 150, ty - 212, tx - 150, ty - 120, C.br, 10) + circ(tx - 150, ty - 120, 120, C.steelD, { stroke: C.ink, sw: 4 });
  s += circ(tx - 150, ty - 120, 70, C.steel, { stroke: C.ink, sw: 4 }) + circ(tx - 150, ty - 120, 28, C.rival, { stroke: C.ink, sw: 3 }) + rr(tx - 168, ty - 125, 36, 10, 3, C.steelL);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s += line(tx - 150 + Math.cos(a) * 78, ty - 120 + Math.sin(a) * 78, tx - 150 + Math.cos(a) * 112, ty - 120 + Math.sin(a) * 112, C.steel, 6); }
  s += rr(tx - 20, ty - 200, 260, 170, 14, C.indigoD, { stroke: C.ink, sw: 4 });
  s += rr(tx - 20, ty - 140, 260, 18, 0, C.rival, { stroke: C.ink, sw: 2 }) + text(tx + 110, ty - 96, 'THE GRAND ROLLER', { size: 22, weight: 700, anchor: 'middle', fill: C.fcream, ls: 2 });
  s += circ(tx + 190, ty - 30, 34, C.steelD, { stroke: C.ink, sw: 4 }) + circ(tx + 190, ty - 30, 12, C.br, { stroke: C.ink, sw: 2 });
  s += rr(tx + 205, ty - 300, 22, 100, 4, '#3A3236', { stroke: C.ink, sw: 3 }) + puff(tx + 216, ty - 322, 22, '#ECECF4') + puff(tx + 250, ty - 362, 16, '#ECECF4');
    s += baron(tx + 80, ty - 196, 1.55, 'smug');
  // big portrait panel
  s += panel(980, 140, 560, 400, { fill: '#FFFFFF' });
  s += L.clipped(rr(990, 150, 540, 380, 14, '#000'), rr(990, 150, 540, 380, 0, C.rivalL, { op: .35 }) + baron(1260, 760, 2.2, 'smug'));
  s += rr(1004, 162, 250, 34, 10, C.paper, { stroke: C.ink, sw: 2 }) + text(1016, 186, 'Portrait card for taunts', { size: 19, weight: 700, fill: C.ink });
  // expressions
  const moods = [['smug', 'Smug'], ['cross', 'Cross'], ['beat', 'Bested']];
  moods.forEach(([m, n], i) => {
    const ex = 1060 + i * 170;
    s += rr(ex - 72, 570, 144, 250, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
    s += L.clipped(rr(ex - 72, 570, 144, 250, 16, '#000'), baron(ex, 960, 1.55, m));
    s += text(ex, 850, n, { size: 22, weight: 700, anchor: 'middle' });
  });
  s += text(980, 900, 'Palette: coat grey #8A90A2, deep #5B6172, cap #3E4250, brass #E0AE3E,', { size: 16, weight: 600, fill: C.ink2, family: L.BODY });
  s += text(980, 926, 'rival orange #E8730C, cream #F2E8D5, skin #EAD3C0.', { size: 16, weight: 600, fill: C.ink2, family: L.BODY }) + text(980, 956, 'He never bends. When beaten, only his cap tilts. The tea never spills.', { size: 16, weight: 600, fill: C.ink2, family: L.BODY });
  out('11-baron-levelwell.svg', doc(W, H, s, { title: 'Baron Levelwell', desc: 'Villain leader concept' }));
}

// ------------------------------------------------ Heartkettle
{
  const W = 1600, H = 900;
  let s = sheetBg(W, H);
  s += header(60, 76, 'The Heartkettle', 'Every fort runs on one, with 300 HP, bosses too. Copper body, brass bands, a teal glow you can always see through walls.');
  const st = [[1, 'Full', '100 to 51%', 'Clean copper, steady glow, slow wisp.'], [.5, 'Hurt', '50 to 26%', 'One crack across the belly. Thin steam.'], [.25, 'Critical', '25 to 1%', 'Crack web. Lid rattles. Steam in pulses.'], [0, 'Popped', '0', 'Lid off. The fort sits down.']];
  st.forEach(([hp, n, pc, d], i) => {
    const cx = 200 + i * 340, cy = 470;
    if (hp === 0) {
      s += puff(cx, cy - 190, 50, '#FFFFFF') + puff(cx - 70, cy - 150, 34, '#FFFFFF') + puff(cx + 80, cy - 150, 36, '#FFFFFF');
      s += g(path('M-18 -80 C-18 -92 18 -92 18 -80 Z', '#A4521F', { stroke: C.ink, sw: 3 }) + circ(0, -92, 5, C.br, { stroke: C.ink, sw: 2.5 }), `translate(${cx + 70} ${cy - 160}) scale(2.2) rotate(30)`);
      s += star4(cx - 110, cy - 240, 16, C.gold, { stroke: C.ink, sw: 2 }) + star4(cx + 120, cy - 250, 12, C.gold, { stroke: C.ink, sw: 2 });
    }
    s += kettle(cx, cy, 2.4, { hp, popped: hp === 0 });
    s += text(cx, cy + 50, n, { size: 30, weight: 700, anchor: 'middle' });
    s += rr(cx - 62, cy + 62, 124, 28, 14, hp === 1 ? C.good : hp === .5 ? C.saffron : hp === .25 ? C.danger : C.ink2, { stroke: C.ink, sw: 2.5 }) + text(cx, cy + 82, pc, { size: 17, weight: 700, anchor: 'middle', fill: hp <= .25 ? '#FFFFFF' : C.ink });
    s += text(cx, cy + 114, d, { size: 16, weight: 600, anchor: 'middle', fill: C.ink2, family: L.BODY });
  });
  // glow through walls panel
  s += rr(60, 600, 900, 260, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(90, 640, 'Glow through walls (both forts, all the time)', { size: 22, weight: 700 });
  const bx = 96, by = 670, bsz = 40;
  const lay = ['CCCC', 'CkkC', 'CkkC', 'FFFF'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s += block(lay[r][c] === 'F' ? 'footing' : 'cobble', bx + c * bsz, by + r * bsz, bsz, 0, r * 4 + c);
  s += circ(bx + bsz * 2, by + bsz * 2, 66, C.glow, { op: .22 }) + circ(bx + bsz * 2, by + bsz * 2, 50, C.glow, { op: .3 }) + circ(bx + bsz * 2, by + bsz * 2, 26, C.glowL, { op: .45 });
    s += text(bx + 178, by + 30, 'Closed: a teal halo', { size: 16, weight: 600, fill: C.ink2, family: L.BODY });
  s += text(bx + 178, by + 56, 'shows through the blocks', { size: 16, weight: 600, fill: C.ink2, family: L.BODY });
  s += text(bx + 178, by + 82, 'and pulses every 1.6 s.', { size: 16, weight: 600, fill: C.ink2, family: L.BODY });
  const bx2 = 540;
  const lay2 = ['C.CC', 'CkkC', 'CkkC', 'FFFF'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (lay2[r][c] !== 'k' && lay2[r][c] !== '.') s += block(lay2[r][c] === 'F' ? 'footing' : 'cobble', bx2 + c * bsz, by + r * bsz, bsz, r === 0 && c === 2 ? 2 : 0, r * 4 + c);
  s += rr(bx2 + bsz, by + bsz, bsz * 2, bsz * 2, 0, '#2E2A3A');
  s += kettle(bx2 + bsz * 2, by + bsz * 3 - 4, .7, { hp: .45 });
  s += text(bx2 + 178, by + 56, 'kettle and all.', { size: 16, weight: 600, fill: C.ink2, family: L.BODY }) + text(bx2 + 178, by + 30, 'Opened: the room shows,', { size: 16, weight: 600, fill: C.ink2, family: L.BODY });
  // kettle room spec
  s += rr(1000, 600, 540, 260, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(1030, 640, 'Spec', { size: 22, weight: 700 });
  const lines = ['Sits in a 2 x 2 Kettle Room, one block in from every face.', 'Sprite: 30 x 30 cells, drawn at 64 and 128 px.', 'States swap at 50% and 25%, the same marks as the HUD gauge,', 'the whistle and the music. The copper never turns red or orange.', 'Glow colour #4FE3C1 is reserved: only the kettle', 'and Steam use it. No shell may glow teal.'];
  lines.forEach((t, i) => s += text(1030, 676 + i * 28, t, { size: 16, weight: 600, fill: C.ink2, family: L.BODY }));
  out('12-heartkettle.svg', doc(W, H, s, { title: 'Heartkettle', desc: 'Castle core concept and states' }));
}
