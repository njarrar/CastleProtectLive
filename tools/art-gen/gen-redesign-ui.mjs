// Part 2 Storybook UI Chrome, Boss 1-10 Topiary Keep & Level 1-7 Props, Cutaway Fort Interior,
// and Painterly Soil Strata SVG generators (04_Art_Design_UX_Critique_Before_After.md Plates 1-5).
// Called by tools/art-gen/gen-sprites.mjs. Every SVG is 100% self-contained with zero external refs.
import * as L from './lib.mjs';
import { posedHob } from './sprite-hob.mjs';

const { C, PALETTE_V2: V2, rr, circ, ell, path, line, g, star4, puff, clipped, poly, f, rng, text } = L;
const ink = V2.ink; // #2C221E dark espresso outer contour
const O = (sw = 3, stroke = ink) => ({ stroke, sw });

export const REDESIGN_SPRITE_NAMES = {
  ui: [
    'ui_kettle_dial_full',
    'ui_kettle_dial_hurt',
    'ui_kettle_dial_critical',
    'ui_wind_pennant',
    'ui_cog_rest',
    'ui_fatigue_flame',
    'ui_front_loophole',
    'ui_pennant_ribbon_gold',
    'ui_pennant_ribbon_empty',
  ],
  props: [
    'prop_topiary_peacock_crest',
    'prop_sprinkler_root',
    'prop_lawn_sign',
    'prop_rescue_cage_hetty',
    'prop_big_smoothie_jr',
  ],
  fort: [
    'fort_nook_backing',
    'fort_nook_glaze',
  ],
  terrain: [
    'terrain_clay_tile',
    'terrain_rock_tile',
    'terrain_bedrock_tile',
  ],
};

// ================================================================ 1. UI Brass & Storybook Chrome
function kettleDialSvg(state) {
  // 64x64 drawing space -> 32x32 @1x px (2 du/px)
  const hp = { full: 0.86, hurt: 0.44, critical: 0.12 }[state];
  const rimCol = state === 'critical' ? V2.badBorder : V2.brass;
  const rimDark = state === 'critical' ? V2.badInk : V2.brassDark;
  const faceCol = state === 'critical' ? V2.badBg : V2.parchment;
  let b = '';
  // Top brass steam valve cap + pressure stem
  b += rr(26, 2, 12, 7, 3, V2.brassDark, O(2.5))
    + rr(23, 1, 18, 4.5, 2.2, V2.brassLight, O(2.2));
  // Subtle glow ring when critical
  if (state === 'critical') {
    b += circ(32, 35, 27.5, V2.badBorder, { op: .22 });
  }
  // Outer beveled brass bezel with 4 brass rivets
  b += circ(32, 36.5, 25, rimDark, O(3))
    + circ(32, 35, 25, rimCol, O(3))
    + path('M14 23 A22 22 0 0 1 48 21', 'none', { stroke: V2.brassLight, sw: 3, op: .85 });
  // Recessed parchment dial face
  b += circ(32, 35, 19.5, faceCol, O(2.4));
  // Pressure gauge color zones (crimson -> amber -> forest green)
  const arc = (t0, t1, col) => {
    const a0 = Math.PI * (0.82 + t0 * 1.36);
    const a1 = Math.PI * (0.82 + t1 * 1.36);
    const x0 = 32 + Math.cos(a0) * 14.5, y0 = 35 + Math.sin(a0) * 14.5;
    const x1 = 32 + Math.cos(a1) * 14.5, y1 = 35 + Math.sin(a1) * 14.5;
    return path(`M${f(x0)} ${f(y0)} A14.5 14.5 0 0 1 ${f(x1)} ${f(y1)}`, 'none', { stroke: col, sw: 4.5, cap: 'butt' });
  };
  b += arc(0, 0.28, V2.badBorder) + arc(0.28, 0.56, V2.orangeFill) + arc(0.56, 1, V2.goodInk);
  // Crisp pressure tick marks
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI * (0.82 + (i / 4) * 1.36);
    b += line(32 + Math.cos(a) * 11, 35 + Math.sin(a) * 11, 32 + Math.cos(a) * 16.5, 35 + Math.sin(a) * 16.5, ink, 1.5);
  }
  // Small copper kettle heart emblem below pivot
  b += circ(32, 46, 3.6, V2.copper, O(1.5)) + circ(31, 45, 1.1, '#FFFFFF', { op: .75 });
  // Pressure needle
  const na = Math.PI * (0.82 + hp * 1.36);
  const nx = 32 + Math.cos(na) * 13.5, ny = 35 + Math.sin(na) * 13.5;
  const tx = 32 - Math.cos(na) * 4.5, ty = 35 - Math.sin(na) * 4.5;
  b += line(tx, ty, nx, ny, state === 'critical' ? V2.badInk : ink, 3.2)
    + circ(32, 35, 4.2, V2.brassLight, O(2))
    + circ(32, 35, 1.6, ink);
  // Glass specular sweep
  b += path('M19 25 Q26 19 36 20', 'none', { stroke: '#FFFFFF', sw: 2.5, op: .65 });
  // 4 bezel rivets
  for (const [rx, ry] of [[32, 12.8], [54.2, 35], [32, 57.2], [9.8, 35]]) {
    b += circ(rx, ry, 1.6, V2.brassLight, O(1));
  }
  // State-specific weathering / alarm details
  if (state === 'hurt') {
    b += path('M22 42 L28 38 L31 43 L38 39', 'none', { stroke: ink, sw: 1.6, op: .75 });
  } else if (state === 'critical') {
    b += path('M17 30 L26 35 L22 45 M26 35 L39 42 M33 22 L28 32', 'none', { stroke: ink, sw: 1.7, op: .85 })
      + puff(50, 12, 5.5, '#FFFFFF', { stroke: ink, sw: 1.8 })
      + path('M8 14 l5 3 M6 23 l5 0', 'none', { stroke: V2.badBorder, sw: 2.2 });
  }
  return b;
}

function windPennantSvg() {
  // 64x48 drawing space -> 32x24 @1x px. Points right; flip horizontally for left wind.
  let b = '';
  // Brass weathervane shaft & finial spire
  b += line(11, 44, 11, 8, ink, 6) + line(11, 43, 11, 9, V2.brass, 2.8)
    + circ(11, 6, 4.2, V2.brassLight, O(2.2))
    + rr(5, 41, 12, 4.5, 2, V2.brassDark, O(2));
  // Brass mounting rings
  b += rr(8, 12.5, 6, 3.5, 1.5, V2.brassLight, O(1.6))
    + rr(8, 28, 6, 3.5, 1.5, V2.brassLight, O(1.6));
  // Flowing swallowtail cloth pennant with warm storybook stitch
  const flagD = 'M14 12 C28 9 42 15 60 11 L50 22 L59 32 C41 34 27 29 14 31 Z';
  b += path(flagD, V2.parchment, O(3));
  b += clipped(
    path(flagD, '#000'),
    path('M12 12 H62 V19 H12 Z', C.teal, { op: .85 })
      + path('M12 26 H62 V34 H12 Z', V2.brass, { op: .55 })
      + path('M14 31 C28 29 42 33 59 31 L59 36 L14 36 Z', ink, { op: .15 }),
  );
  b += path(flagD, 'none', O(3))
    + path('M19 22 C31 20 40 24 47 22', 'none', { stroke: ink, sw: 1.6, dash: '3.5 3.5', op: .65 });
  // Small wind-speed chevrons trailing under the pennant
  b += path('M22 39 H42 M30 44 H50', 'none', { stroke: V2.inkSoft, sw: 2.2, op: .6 });
  return b;
}

function cogRestSvg() {
  // 48x48 drawing space -> 24x24 @1x px. Tactile bronze beveled rest cog replacing Unicode ⚙.
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    teeth += rr(-4.2, -21, 8.4, 9, 2.2, V2.brassDark, { stroke: ink, sw: 2.6, extra: ` transform="translate(24 24.8) rotate(${i * 45})"` });
    teeth += rr(-4.2, -21, 8.4, 9, 2.2, V2.brass, { stroke: ink, sw: 2.4, extra: ` transform="translate(24 23.6) rotate(${i * 45})"` });
  }
  let b = teeth;
  // Beveled cog wheel body
  b += circ(24, 24.8, 15.5, V2.brassDark, O(2.8))
    + circ(24, 23.6, 15.5, V2.brass, O(2.8))
    + path('M13 17 A12.5 12.5 0 0 1 33 15', 'none', { stroke: V2.brassLight, sw: 2.8, op: .85 })
    + circ(24, 23.6, 10.5, V2.parchmentAlt, O(2))
    + circ(24, 23.6, 5.5, V2.brassDark, O(2.2))
    + circ(23, 22.6, 1.8, V2.brassLight);
  // Four tiny hub rivets
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    b += circ(24 + Math.cos(a) * 12.8, 23.6 + Math.sin(a) * 12.8, 1.3, V2.brassLight, O(.8));
  }
  return b;
}

function fatigueFlameSvg() {
  // 48x48 drawing space -> 24x24 @1x px. Amber-rust fatigue warning emblem.
  let b = '';
  // Soft amber-rust backing medallion badge with brass rim
  b += circ(24, 25, 20.5, V2.orangeInk, O(2.8))
    + circ(24, 23.5, 20.5, V2.parchment, O(2.8))
    + circ(24, 23.5, 16.5, '#FCE2BE', { stroke: V2.orangeFill, sw: 1.8, dash: '3.5 2.5' });
  // Leaping layered storybook flame (amber-rust outer, vivid orange mid, golden core)
  b += path('M24 38 C13 38 11 26 17 18 C18 22 20 22 21 19 C20 12 24 8 26 5 C32 12 37 21 35 30 C34 35 30 38 24 38 Z', V2.orangeInk, O(2.6))
    + path('M24 36 C16 36 15 27 20 21 C21.5 24 23 23.5 24 20 C25 15 26 13 26.5 11 C31 16 33.5 23 32 30 C31 34 28 36 24 36 Z', V2.orangeFill)
    + path('M24 34.5 C19.5 34.5 19.5 28.5 23 24.5 C26.5 27 28.5 30 27.5 32.8 C27 34 25.8 34.5 24 34.5 Z', C.gold);
  // Rising sparks
  b += star4(14, 12, 4, C.gold, O(1.2, V2.orangeInk))
    + circ(35, 11, 2.2, V2.orangeFill, O(1.2));
  return b;
}

function frontLoopholeSvg() {
  // 64x64 drawing space -> 32x32 @1x px. Workshop "FRONT ->" crenellated loophole arch badge.
  let b = '';
  // Timber/stone crenellated battlement base
  const wallD = 'M6 56 V20 H16 V12 H28 V20 H36 V12 H48 V20 H56 V56 Z';
  b += path(wallD, C.tb, O(3))
    + clipped(path(wallD, '#000'),
      rr(6, 20, 50, 12, 0, C.tbL, { op: .35 })
        + line(6, 36, 56, 36, C.tbD, 2.2)
        + line(6, 48, 56, 48, C.tbD, 2.2)
        + rr(38, 12, 22, 46, 0, ink, { op: .16 }))
    + path(wallD, 'none', O(3));
  // Dark arched loophole opening on the left/center
  const archD = 'M15 52 V35 C15 24 33 24 33 35 V52 Z';
  b += path(archD, V2.nookBackingD, O(3))
    + path('M19 50 V36 C19 30 23 28 26 28', 'none', { stroke: '#FFFFFF', sw: 2, op: .22 })
    + rr(12, 50, 24, 5, 2, V2.parchment, O(2.2));
  // Bold golden-brass directional arrow pointing RIGHT (toward the enemy side)
  b += path('M28 36 H42 V28 L59 40 L42 52 V44 H28 Z', V2.brass, O(2.8))
    + line(32, 38.5, 44, 38.5, V2.brassLight, 2.2, { op: .85 });
  return b;
}

function pennantRibbonSvg(gold) {
  // 56x64 drawing space -> 28x32 @1x px. Campaign map & Results ribbon pennant.
  const fill = gold ? C.gold : V2.parchment;
  const dark = gold ? V2.brassDark : V2.parchmentEdge;
  const trim = gold ? V2.brassLight : '#FFFFFF';
  let b = '';
  // Brass top crossbar with rounded finials
  b += line(6, 10, 50, 10, ink, 8) + line(6, 10, 50, 10, gold ? V2.brass : C.steel, 4)
    + circ(6, 10, 4.5, gold ? V2.brassLight : C.steelL, O(2.4))
    + circ(50, 10, 4.5, gold ? V2.brassLight : C.steelL, O(2.4));
  // Swallowtail hanging banner ribbon
  const ribD = 'M12 12 H44 V56 L28 45 L12 56 Z';
  b += path(ribD, dark, { extra: ' transform="translate(0 2.5)"' })
    + path(ribD, fill, O(3));
  b += clipped(
    path(ribD, '#000'),
    rr(12, 12, 32, 7, 0, dark, { op: .35 })
      + (gold ? path('M12 46 L44 16 L44 26 L12 56 Z', '#FFFFFF', { op: .4 }) : ''),
  );
  b += path(ribD, 'none', O(3));
  // Stitched inner border following the swallowtail
  b += path('M17 17 H39 V48 L28 40 L17 48 Z', 'none', { stroke: gold ? V2.orangeInk : V2.inkSoft, sw: 1.8, dash: '3.5 3', op: gold ? .7 : .55 });
  // Center emblem: bold gold star when earned, subtle dashed outline star when empty
  if (gold) {
    b += star4(28, 29, 9, '#FFFFFF', O(2, V2.orangeInk))
      + star4(44, 20, 5, '#FFFFFF', O(1.4));
  } else {
    b += star4(28, 29, 8, 'none', { stroke: V2.inkSoft, sw: 1.8, dash: '2.5 2.5', op: .55 })
      + line(17, 17, 39, 17, trim, 1.5, { op: .5 });
  }
  return b;
}

// ================================================================ 2. Boss 1-10 & Level 1-7 Props
function topiaryPeacockCrestSvg() {
  // 320x192 drawing space -> 160x96 @1x px. Anchor [80, 92] (bottom center on Boss 1-10 roof).
  // Sculpted clipped-hedge peacock: fanned radial hedge tail + curved neck + peacock head facing left
  // toward the player fort, crown plumes, brass eye blossoms, and manicured hedge roof plinth.
  let b = '';
  const tailCx = 188, tailCy = 152;
  // Back fanned hedge tail silhouette (7 overlapping clipped-hedge scallops)
  const fanAngles = [-142, -120, -98, -76, -54, -34, -14];
  let tailOuter = '';
  let tailDetail = '';
  for (let i = 0; i < fanAngles.length; i++) {
    const deg = fanAngles[i];
    const rad = deg * Math.PI / 180;
    const len = 104 + (i === 3 ? 14 : i === 2 || i === 4 ? 8 : 0);
    const ex = tailCx + Math.cos(rad) * len;
    const ey = tailCy + Math.sin(rad) * len;
    const mx = tailCx + Math.cos(rad) * (len * 0.62);
    const my = tailCy + Math.sin(rad) * (len * 0.62);
    const px = -Math.sin(rad) * 19, py = Math.cos(rad) * 19;
    const plumeD = `M${f(tailCx)} ${f(tailCy)} Q${f(mx + px)} ${f(my + py)} ${f(ex)} ${f(ey)} Q${f(mx - px)} ${f(my - py)} ${f(tailCx)} ${f(tailCy)} Z`;
    tailOuter += path(plumeD, i % 2 ? V2.hedgeDeep : V2.hedgeMid, O(5.5));
    // Sculpted inner foliage highlight + peacock "eye" topiary blossom
    const bx = tailCx + Math.cos(rad) * (len * 0.77);
    const by = tailCy + Math.sin(rad) * (len * 0.77);
    tailDetail += line(tailCx + Math.cos(rad) * 32, tailCy + Math.sin(rad) * 32, bx, by, V2.hedgeLight, 3.2, { op: .55 })
      + circ(bx, by, 10.5, V2.brass, O(2.8))
      + circ(bx, by, 6.2, C.teal, O(2))
      + circ(bx - 1.8, by - 1.8, 2.2, '#FFFFFF', { op: .85 });
  }
  b += tailOuter + tailDetail;

  // Inner sculpted hedge body cushion connecting tail to neck
  const bodyD = 'M82 164 C80 124 114 104 166 104 C214 104 246 124 246 164 Z';
  b += path(bodyD, V2.hedgeMid, O(6));
  b += clipped(
    path(bodyD, '#000'),
    ell(140, 120, 60, 26, V2.hedgeLight, { op: .55 })
      + ell(218, 152, 58, 34, V2.hedgeDeep, { op: .55 })
      + path('M102 146 Q132 128 164 142 Q196 128 224 146', 'none', { stroke: V2.hedgeTip, sw: 4.5, op: .55 }),
  );
  b += path(bodyD, 'none', O(6));

  // Graceful sculpted peacock neck & head facing LEFT (menacingly surveying the player's fort)
  const neckD = 'M132 146 C110 138 96 116 98 84 C98 58 84 44 64 46 C44 48 34 62 36 78 C38 92 52 98 66 96 C72 95 72 108 74 128 C76 146 82 160 98 164 L142 164 Z';
  b += path(neckD, V2.hedgeMid, O(6));
  b += clipped(
    path(neckD, '#000'),
    path('M42 54 C60 44 82 54 88 80 C76 68 58 64 44 74 Z', V2.hedgeLight, { op: .7 })
      + path('M98 84 C112 108 118 134 144 152 L144 168 L108 168 Z', V2.hedgeDeep, { op: .55 }),
  );
  b += path(neckD, 'none', O(6));

  // Clipped-leaf texture clusters on neck & crest
  for (const [lx, ly, r] of [[70, 56, 6], [84, 72, 6.5], [90, 96, 7], [116, 126, 7.5], [148, 122, 8], [186, 126, 7.5], [216, 138, 7]]) {
    b += path(`M${lx - r} ${ly} Q${lx} ${ly - r} ${lx + r} ${ly}`, 'none', { stroke: V2.hedgeTip, sw: 3, op: .65 });
  }

  // Sculpted 3-plume topiary crown above peacock head
  for (const [dx, dy, tx, ty] of [[-4, -22, 54, 14], [4, -26, 68, 10], [12, -20, 82, 18]]) {
    b += path(`M${62 + dx * .5} 46 Q${62 + dx} ${34 + dy * .3} ${tx} ${ty}`, 'none', { stroke: ink, sw: 7 })
      + path(`M${62 + dx * .5} 46 Q${62 + dx} ${34 + dy * .3} ${tx} ${ty}`, 'none', { stroke: V2.hedgeMid, sw: 3.5 })
      + circ(tx, ty, 6.5, V2.brass, O(2.8))
      + circ(tx - 1.5, ty - 1.5, 2, V2.brassLight);
  }

  // Sharp brass-gold peacock beak (pointing left) + fierce dark espresso eye
  b += path('M38 66 L10 74 L38 82 Z', V2.brass, O(4.5))
    + line(16, 74, 36, 74, V2.brassDark, 2.5)
    + path('M16 71 L34 68', 'none', { stroke: V2.brassLight, sw: 2.5, op: .8 });
  b += circ(58, 68, 7.5, V2.parchment, O(3))
    + circ(56, 68, 4, ink)
    + circ(54.5, 66.5, 1.6, '#FFFFFF')
    + path('M49 58 L67 62', 'none', { stroke: ink, sw: 3.6 });

  // Manicured roof hedge plinth & brass garden cornice clips
  b += rr(36, 158, 248, 26, 8, V2.hedgeDeep, O(5.5))
    + rr(44, 162, 232, 8, 4, V2.hedgeLight, { op: .45 })
    + rr(30, 178, 260, 10, 4, V2.brassDark, O(4))
    + line(36, 181, 284, 181, V2.brassLight, 2.5, { op: .75 });
  for (const rx of [52, 106, 160, 214, 268]) {
    b += circ(rx, 183, 3, V2.brassLight, O(1.5));
  }
  return b;
}

function sprinklerRootSvg() {
  // 128x160 drawing space -> 64x80 @1x px. Anchor [32, 76].
  // Glowing bioluminescent vine-wrapped Sprinkler Root for Boss 1-10.
  let b = '';
  // Bioluminescent aura halo behind the standpipe
  b += ell(64, 86, 46, 56, V2.bioGlow, { op: .16 })
    + ell(64, 86, 30, 38, V2.bioGlowBright, { op: .2 });
  // Mist spray arcs from the twin spinning brass nozzles
  b += path('M22 30 Q8 16 14 6 M106 30 Q120 16 114 6', 'none', { stroke: V2.bioGlowBright, sw: 4, dash: '5 6', op: .85 })
    + circ(10, 22, 3.8, V2.bioGlowBright, O(1.5, C.teal))
    + circ(118, 20, 3.8, V2.bioGlowBright, O(1.5, C.teal))
    + circ(24, 10, 3, '#FFFFFF', O(1.2, C.teal))
    + circ(104, 10, 3, '#FFFFFF', O(1.2, C.teal));
  // Soil mound & gnarled root base
  b += path('M14 152 C20 132 42 126 64 128 C86 126 108 132 114 152 Z', '#6B442A', O(4.5))
    + path('M38 148 C34 134 26 130 18 138 M90 148 C94 134 102 130 110 138 M56 148 C54 132 62 126 64 118', 'none', { stroke: '#4A2C1A', sw: 6 })
    + path('M38 148 C34 134 26 130 18 138 M90 148 C94 134 102 130 110 138', 'none', { stroke: '#8E5C38', sw: 2.5 });
  // Central brass sprinkler standpipe
  b += rr(56, 36, 16, 98, 4, V2.brass, O(4.5))
    + line(61, 40, 61, 130, V2.brassLight, 3, { op: .75 })
    + rr(50, 122, 28, 12, 4, V2.brassDark, O(4))
    + rr(52, 54, 24, 8, 3, V2.brassDark, O(3.5));
  // Twisting emerald vines coiled around the standpipe
  const vine1 = 'M42 136 C28 118 86 106 84 88 C82 70 36 66 44 48 C50 38 66 40 76 34';
  const vine2 = 'M88 138 C98 118 40 108 42 88 C44 68 92 64 82 46';
  b += path(vine1, 'none', { stroke: ink, sw: 11 })
    + path(vine1, 'none', { stroke: V2.hedgeMid, sw: 5.5 })
    + path(vine2, 'none', { stroke: ink, sw: 9 })
    + path(vine2, 'none', { stroke: V2.hedgeDeep, sw: 4.5 });
  // Glowing bioluminescent sap veins & luminous root bulbs
  b += path(vine1, 'none', { stroke: V2.bioGlow, sw: 2.2, dash: '6 5', op: .95 });
  for (const [bx, by, r] of [[42, 114, 8], [84, 92, 9], [44, 72, 7.5], [82, 56, 6.5], [64, 134, 7]]) {
    b += circ(bx, by, r + 4, V2.bioGlow, { op: .28 })
      + circ(bx, by, r, V2.bioGlow, O(2.8))
      + circ(bx - r * .28, by - r * .28, r * .35, '#FFFFFF', { op: .9 });
  }
  // Vine leaf sprouts
  for (const [lx, ly, rot] of [[32, 94, -35], [96, 74, 35], [34, 54, -45], [92, 112, 40]]) {
    b += g(path('M0 0 C-7 -8 -5 -18 0 -22 C5 -18 7 -8 0 0 Z', V2.hedgeLight, O(2.6)), `translate(${lx} ${ly}) rotate(${rot})`);
  }
  // Spinning twin brass sprinkler head on top
  b += rr(22, 26, 84, 9, 4, V2.brass, O(4))
    + line(26, 29, 102, 29, V2.brassLight, 2.2, { op: .8 })
    + rr(16, 22, 12, 16, 3, V2.brassDark, O(3.5))
    + rr(100, 22, 12, 16, 3, V2.brassDark, O(3.5))
    + circ(64, 30, 11, V2.brassLight, O(4))
    + circ(64, 30, 5, V2.bioGlow, O(2.2));
  return b;
}

function lawnSignSvg() {
  // 96x80 drawing space -> 48x40 @1x px. Anchor [24, 38].
  // Miniature wooden "Keep off the grass" stake sign beside Big Smoothie Jr.
  let b = '';
  // Ground shadow + clipped grass blades at base
  b += ell(48, 74, 24, 4.5, ink, { op: .22 });
  // Wooden stake planted in the turf
  b += path('M43 44 H53 L51 75 H45 Z', C.tbD, O(3.5))
    + line(46.5, 46, 46.5, 72, C.tbL, 2, { op: .6 });
  // Small tuft of manicured lawn grass around the stake base
  b += path('M34 75 L39 63 L44 74 L48 61 L52 74 L58 64 L62 75 Z', V2.hedgeLight, O(2.8));
  // Canted cream-parchment wooden signboard
  const board = rr(-38, -23, 76, 46, 5, C.tb, O(4))
    + rr(-33, -18, 66, 36, 3, V2.parchment, O(2.5))
    + rr(-29, -14, 58, 28, 2, 'none', { stroke: V2.parchmentEdge, sw: 1.5, dash: '3 2.5' })
    + circ(0, -14, 2.2, C.steelD, O(1.2))
    + circ(0, 14, 2.2, C.steelD, O(1.2))
    + text(0, -3, 'KEEP OFF', { size: 10.5, weight: 800, fill: ink, anchor: 'middle' })
    + text(0, 9.5, 'THE GRASS', { size: 9.2, weight: 800, fill: V2.goodInk, anchor: 'middle' });
  b += g(board, 'translate(48 29) rotate(-4)');
  return b;
}

function rescueCageHettySvg() {
  // 128x144 drawing space -> 64x72 @1x px. Anchor [32, 68].
  // Ornate wrought-iron hanging Rescue Cage with Hetty waving inside (upgrading 1-7's 3-stroke wireframe).
  let b = '';
  // Hanging chain ring & wrought-iron scrollwork finial at top
  b += circ(64, 10, 7.5, 'none', O(4.5, C.steelD))
    + circ(64, 10, 7.5, 'none', O(2, C.steelL))
    + path('M46 26 C46 16 56 14 64 18 C72 14 82 16 82 26', 'none', O(4, ink))
    + path('M46 26 C46 16 56 14 64 18 C72 14 82 16 82 26', 'none', O(2, V2.brass));
  // Cage domed interior shadow backdrop so Hetty pops clearly against any background
  const domeD = 'M22 52 C22 18 106 18 106 52 V128 H22 Z';
  b += path(domeD, '#241B19', { op: .38 });
  // Back vertical wrought-iron bars (drawn behind Hetty for 3D depth)
  for (const bx of [36, 54, 74, 92]) {
    b += line(bx, 32, bx, 126, '#3D4652', 3.2, { op: .75 });
  }
  // Hetty Mortarboard waving joyfully inside the cage!
  b += clipped(
    path(domeD, '#000'),
    g(posedHob('hetty', 'blue', { face: 'cheer', hf: [26, -54], hb: [-24, -48], tool: false, shadow: false }), 'translate(64 126) scale(.76)'),
  );
  // Front vertical wrought-iron bars with specular highlights
  for (const bx of [24, 42, 64, 86, 104]) {
    const topY = bx === 64 ? 22 : (bx === 42 || bx === 86) ? 26 : 44;
    b += line(bx, topY, bx, 128, ink, 7.2)
      + line(bx, topY, bx, 128, V2.flattenerSlate, 3.4)
      + line(bx - 1, topY + 4, bx - 1, 124, C.steelL, 1.3, { op: .8 });
  }
  // Ornate wrought-iron dome outer frame + riveted horizontal iron bands
  b += path(domeD, 'none', O(5.5))
    + rr(16, 48, 96, 9, 4, V2.flattenerSlateD, O(4))
    + line(20, 51, 108, 51, C.steelL, 1.8, { op: .65 })
    + rr(14, 124, 100, 13, 5, V2.flattenerSlateD, O(4.5))
    + line(20, 128, 108, 128, C.steelL, 2, { op: .65 });
  // Band rivets
  for (const rx of [24, 44, 64, 84, 104]) {
    b += circ(rx, 52.5, 2.1, V2.brassLight, O(1.1))
      + circ(rx, 130.5, 2.2, V2.brassLight, O(1.1));
  }
  // Gleaming brass rescue padlock hanging on center bar (unmistakable objective cue!)
  b += path('M58 92 V84 a6 6 0 0 1 12 0 V92', 'none', O(4.5, ink))
    + path('M58 92 V84 a6 6 0 0 1 12 0 V92', 'none', O(2.2, C.steelL))
    + rr(53, 91, 22, 18, 4, V2.brass, O(3.5))
    + line(56, 94, 72, 94, V2.brassLight, 2, { op: .8 })
    + circ(64, 98.5, 2.5, ink) + rr(62.8, 99.5, 2.4, 5, 1, ink);
  return b;
}

function bigSmoothieJrSvg() {
  // 192x128 drawing space -> 96x64 @1x px. Anchor [48, 60].
  // Vintage brass-and-slate Flattener steam roller with chimney smoke puff & crimson/orange trim.
  let b = '';
  // Ground shadow
  b += ell(98, 118, 82, 8, ink, { op: .24 });
  // Billowing cartoon chimney smoke puffs trailing right
  b += puff(146, 22, 11, '#E8ECF2', { stroke: ink, sw: 2.8, op: .85 })
    + puff(168, 14, 8.5, '#F4F6FA', { stroke: ink, sw: 2.4, op: .65 })
    + puff(126, 28, 8, '#FFFFFF', { stroke: ink, sw: 2.8 });
  // Tall flared vintage iron chimney stack with brass collar
  b += rr(48, 22, 14, 42, 3, V2.flattenerSlateD, O(4))
    + path('M44 22 H66 L62 30 H48 Z', V2.flattenerSlateD, O(3.8))
    + rr(46, 36, 18, 7, 2, V2.brass, O(3))
    + line(52, 28, 52, 60, V2.flattenerSlateL, 2, { op: .6 });
  // Smoke curling from the chimney mouth
  b += puff(58, 13, 8.5, '#FFFFFF', { stroke: ink, sw: 2.8 })
    + puff(78, 10, 10, '#EDEFF4', { stroke: ink, sw: 2.6, op: .9 });
  // Brass canopy roof over driver cab (rear right)
  b += line(114, 62, 114, 34, ink, 5.5) + line(114, 62, 114, 34, V2.brass, 2.6)
    + line(154, 66, 154, 34, ink, 5.5) + line(154, 66, 154, 34, V2.brass, 2.6)
    + path('M106 36 C122 26 146 26 164 36 Z', V2.badBorder, O(4))
    + line(114, 32, 154, 32, '#FF9EA4', 2.2, { op: .7 });
  // Riveted slate boiler body + gleaming brass straps + crimson trim stripe
  b += rr(42, 56, 78, 36, 6, V2.flattenerSlate, O(4.5))
    + clipped(
      rr(42, 56, 78, 36, 6, '#000'),
      rr(42, 56, 78, 11, 0, V2.flattenerSlateL, { op: .4 })
        + rr(42, 82, 78, 12, 0, V2.flattenerSlateD, { op: .5 })
        + rr(42, 72, 78, 8, 0, V2.badBorder)
        + rr(60, 56, 8, 36, 0, V2.brass)
        + rr(94, 56, 8, 36, 0, V2.brass),
    )
    + rr(42, 56, 78, 36, 6, 'none', O(4.5));
  // Side brass steam dome & pressure dial on boiler
  b += path('M72 56 C72 42 90 42 90 56 Z', V2.brass, O(3.8))
    + circ(79, 71, 7, V2.parchment, O(2.5))
    + line(79, 71, 83, 68, V2.badBorder, 2);
  // Rear driver cab firebox & crimson-striped bumper skirt
  b += rr(112, 62, 48, 36, 5, V2.flattenerSlateD, O(4.5))
    + rr(116, 88, 52, 10, 3, V2.orangeFill, O(3.5));
  for (let i = 0; i < 4; i++) {
    b += path(`M${120 + i * 11} 88 l6 0 l-5 10 l-6 0 Z`, ink, { op: .75 });
  }
  // Brass steering flywheel beside cab
  b += circ(116, 72, 11, 'none', O(4.5, ink)) + circ(116, 72, 11, 'none', O(2.2, V2.brass))
    + line(107, 72, 125, 72, V2.brassDark, 2.2) + line(116, 63, 116, 81, V2.brassDark, 2.2)
    + circ(116, 72, 3, V2.brassLight, O(1.5));
  // Heavy slate front compaction drum (left) with yoke & steel sheen
  b += circ(44, 92, 26, V2.flattenerSlateD, O(5))
    + circ(44, 92, 18, V2.flattenerSlate, O(3.2))
    + path('M28 80 Q36 70 48 70', 'none', { stroke: C.steelL, sw: 3.5, op: .65 })
    + path('M38 64 L54 64 L50 92 L40 92 Z', V2.badBorder, O(3.5))
    + circ(44, 92, 7.5, V2.brass, O(3))
    + circ(44, 92, 2.8, V2.brassLight);
  // Large spoked rear drive wheel (right) with crimson hub
  b += circ(142, 96, 22, V2.flattenerSlateD, O(5))
    + circ(142, 96, 15, V2.badBorder, O(3))
    + circ(142, 96, 10, V2.flattenerSlateL, O(2.2));
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    b += line(142, 96, 142 + Math.cos(a) * 14, 96 + Math.sin(a) * 14, ink, 2.2);
  }
  b += circ(142, 96, 5.5, V2.brass, O(2.4))
    + circ(142, 96, 2, V2.brassLight);
  // Subtle chassis rivet highlights
  for (const rx of [64, 98]) b += circ(rx, 61, 1.8, V2.brassLight) + circ(rx, 87, 1.8, V2.brassLight);
  return b;
}

// ================================================================ 3. Cutaway Fort Interior & Soil Strata
function fortNookBackingSvg() {
  // 200x200 drawing space -> 32x32 @1x px. Anchor [0, 0].
  // Opaque (#3B2D24) warm recessed timber-and-lantern interior backing (eliminates background tree bleed-through).
  let b = rr(0, 0, 200, 200, 4, V2.nookBacking);
  // Horizontal recessed timber wall planks
  for (let y = 0; y < 176; y += 36) {
    b += rr(0, y, 200, 34, 0, y % 72 === 0 ? V2.nookBacking : V2.nookBackingL, { op: .45 })
      + line(0, y + 35, 200, y + 35, V2.nookBackingD, 3.5);
  }
  // Vertical plank joints & subtle woodgrain lines
  for (const [x, y] of [[58, 0], [142, 36], [44, 72], [126, 108], [168, 72], [84, 144]]) {
    b += line(x, y, x, y + 36, V2.nookBackingD, 3);
  }
  // Deep recessed ceiling shadow & side jamb shadows (3D cutaway depth)
  b += rr(0, 0, 200, 24, 0, ink, { op: .34 })
    + rr(0, 0, 14, 200, 0, ink, { op: .22 })
    + rr(186, 0, 14, 200, 0, ink, { op: .22 });
  // Warm floorboards along bottom edge
  b += rr(0, 174, 200, 26, 0, '#7E4F2F')
    + line(0, 176, 200, 176, '#C48349', 5)
    + line(66, 176, 66, 200, '#4E2E1A', 3.5)
    + line(134, 176, 134, 200, '#4E2E1A', 3.5);
  // Warm glowing hanging wall lantern casting rim light inside the nook
  b += circ(38, 56, 48, C.gold, { op: .12 })
    + circ(38, 56, 30, C.gold, { op: .22 })
    + circ(38, 56, 16, '#FFF3C4', { op: .28 })
    + line(38, 0, 38, 34, ink, 4.5)
    + rr(27, 34, 22, 28, 6, C.gold, O(4))
    + rr(23, 29, 30, 8, 3, V2.brass, O(4))
    + rr(25, 60, 26, 6, 2, V2.brassDark, O(3.5))
    + circ(35, 45, 4, '#FFFFFF', { op: .9 });
  // Small wooden shelf & mug silhouette on right wall for tactile Brickabrac charm
  b += rr(138, 74, 44, 7, 2, '#6A4128', O(3))
    + rr(152, 58, 16, 16, 3, V2.parchmentAlt, O(2.8));
  return clipped(rr(0, 0, 200, 200, 4, '#000'), b) + rr(2.5, 2.5, 195, 195, 4, 'none', O(5));
}

function fortNookGlazeSvg() {
  // 200x200 drawing space -> 32x32 @1x px. Anchor [0, 0].
  // Subtle 18% warm parchment window glaze overlay with diagonal glass sheen & corner frame bevel.
  let b = rr(0, 0, 200, 200, 4, V2.nookGlaze, { op: .18 });
  b += clipped(
    rr(0, 0, 200, 200, 4, '#000'),
    path('M-10 120 L120 -10 L152 -10 L-10 152 Z', '#FFFFFF', { op: .18 })
      + path('M40 210 L210 40 L226 40 L56 210 Z', '#FFE08A', { op: .14 })
      + rr(0, 0, 200, 14, 0, ink, { op: .14 })
      + rr(0, 186, 200, 14, 0, ink, { op: .12 }),
  );
  b += rr(3, 3, 194, 194, 4, 'none', { stroke: V2.parchment, sw: 3, op: .28 });
  return b;
}

function soilStrataTiles(add) {
  const T = 64;
  const wrap = (fn) => {
    let s = '';
    for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) s += g(fn(), `translate(${dx} ${dy})`);
    return s;
  };
  const tile = (name, body, purpose) => add(name, 'terrain', T, T, [0, 0, T, T], body, purpose, { atlas: false, anchor: [0, 0], tile: 'xy' });

  // 1. terrain_clay_tile: stratified warm terracotta Clay cross-section tile
  {
    const R = rng(109);
    let b = rr(0, 0, T, T, 0, V2.soilClay);
    // Horizontal wavy terracotta strata ribbons (periodic in x across [0, T])
    const bands = [
      [6, 12, V2.soilClayL, .65, 2.2],
      [20, 10, V2.soilClayD, .55, -2.0],
      [34, 14, '#D68259', .5, 2.4],
      [50, 12, V2.soilClayD, .6, -1.8],
    ];
    for (const [y0, h, col, op, amp] of bands) {
      const d = `M0 ${y0} Q16 ${f(y0 + amp)} 32 ${y0} T64 ${y0} V${y0 + h} Q48 ${f(y0 + h - amp)} 32 ${y0 + h} T0 ${y0 + h} Z`;
      b += wrap(() => path(d, col, { op }));
    }
    // Warm ochre clay nodules & stitched sedimentary cracks
    for (let i = 0; i < 10; i++) {
      const x = R() * T, y = R() * T, rx = 2.2 + R() * 3.5, ry = 1.2 + R() * 1.8;
      const col = i % 3 === 0 ? '#E6A77A' : V2.soilClayD;
      b += wrap(() => ell(x, y, rx, ry, col, { op: .65 }));
    }
    for (let i = 0; i < 5; i++) {
      const x = R() * T, y = R() * T, w = 8 + R() * 10;
      b += wrap(() => path(`M${f(x)} ${f(y)} q${f(w / 2)} -1.8 ${f(w)} 0`, 'none', { stroke: ink, sw: 1.2, op: .22, dash: '3 2.5' }));
    }
    tile('terrain_clay_tile', b, 'Stratified warm terracotta Clay cross-section tile (Part 2 soil strata). Tiles both ways');
  }

  // 2. terrain_rock_tile: faceted cool slate Rock cross-section tile
  {
    let b = rr(0, 0, T, T, 0, V2.soilRock);
    const facets = [
      { pts: [[2, 4], [24, 2], [30, 18], [16, 26], [0, 18]], col: V2.soilRockL, hi: [[4, 6], [22, 4]] },
      { pts: [[26, 2], [52, 0], [60, 14], [46, 24], [30, 18]], col: V2.soilRockD, hi: [[28, 5], [48, 3]] },
      { pts: [[48, 22], [66, 16], [66, 38], [52, 42], [42, 32]], col: '#788392', hi: [[50, 24], [62, 20]] },
      { pts: [[16, 26], [32, 20], [44, 32], [34, 46], [14, 42]], col: V2.soilRock, hi: [[18, 27], [31, 22]] },
      { pts: [[0, 20], [16, 26], [14, 44], [0, 46]], col: V2.soilRockD, hi: [[2, 23], [13, 27]] },
      { pts: [[34, 46], [52, 42], [62, 54], [48, 64], [30, 62]], col: V2.soilRockL, hi: [[36, 47], [50, 44]] },
      { pts: [[4, 46], [28, 44], [32, 62], [10, 64], [0, 56]], col: '#5C6572', hi: [[6, 48], [26, 46]] },
    ];
    for (const fc of facets) {
      b += wrap(() => path(poly(fc.pts), fc.col, { stroke: '#343A44', sw: 1.5 })
        + line(fc.hi[0][0], fc.hi[0][1], fc.hi[1][0], fc.hi[1][1], '#B0BAC7', 1.4, { op: .55 }));
    }
    tile('terrain_rock_tile', b, 'Faceted cool slate Rock cross-section tile (Part 2 soil strata). Tiles both ways');
  }

  // 3. terrain_bedrock_tile: deep basalt Bedrock tile
  {
    const R = rng(193);
    let b = rr(0, 0, T, T, 0, V2.soilBedrock);
    const slabs = [
      [[0, 0], [22, 4], [26, 24], [8, 30], [0, 20]],
      [[22, 4], [46, 0], [54, 18], [40, 28], [26, 24]],
      [[46, 0], [64, 0], [64, 24], [54, 18]],
      [[8, 30], [28, 24], [40, 32], [32, 52], [12, 48]],
      [[40, 28], [60, 22], [64, 46], [46, 54], [32, 52]],
      [[0, 28], [10, 30], [12, 52], [0, 56]],
      [[12, 48], [34, 52], [46, 64], [14, 64]],
      [[34, 52], [58, 50], [64, 64], [46, 64]],
    ];
    slabs.forEach((pts, i) => {
      const col = i % 3 === 0 ? V2.soilBedrockD : i % 3 === 1 ? V2.soilBedrockL : V2.soilBedrock;
      b += wrap(() => path(poly(pts), col, { stroke: '#1E2026', sw: 1.8 }));
    });
    // Subtle deep mineral quartz glints & basalt micro-fissures
    for (let i = 0; i < 8; i++) {
      const x = R() * T, y = R() * T;
      b += wrap(() => path(`M${f(x)} ${f(y)} l3 -1.5 l-1.5 3 Z`, '#7E8694', { op: .5 }));
    }
    tile('terrain_bedrock_tile', b, 'Deep basalt Bedrock indestructible floor tile (Part 2 soil strata). Tiles both ways');
  }
}

export function addRedesignAssets(add) {
  // UI Brass & Storybook Chrome (group: 'ui')
  add('ui_kettle_dial_full', 'ui', 32, 32, [0, 0, 64, 64], kettleDialSvg('full'),
    'Part 2 brass pressure gauge Heartkettle dial, full HP (replaces Unicode kettle glyph)');
  add('ui_kettle_dial_hurt', 'ui', 32, 32, [0, 0, 64, 64], kettleDialSvg('hurt'),
    'Part 2 brass pressure gauge Heartkettle dial, hurt HP (amber zone, hairline crack)');
  add('ui_kettle_dial_critical', 'ui', 32, 32, [0, 0, 64, 64], kettleDialSvg('critical'),
    'Part 2 brass pressure gauge Heartkettle dial, critical HP (crimson zone, cracked glass, steam puff)');
  add('ui_wind_pennant', 'ui', 32, 24, [0, 0, 64, 48], windPennantSvg(),
    'Part 2 brass weathervane pennant (replaces raw wind arrow). Points right; flip for left wind');
  add('ui_cog_rest', 'ui', 24, 24, [0, 0, 48, 48], cogRestSvg(),
    'Part 2 tactile bronze rest cog (replaces Unicode gear glyph)');
  add('ui_fatigue_flame', 'ui', 24, 24, [0, 0, 48, 48], fatigueFlameSvg(),
    'Part 2 amber-rust Fatigue warning emblem for Round 10+ header pill');
  add('ui_front_loophole', 'ui', 32, 32, [0, 0, 64, 64], frontLoopholeSvg(),
    'Part 2 Workshop FRONT -> crenellated loophole arch badge showing enemy-facing wall');
  add('ui_pennant_ribbon_gold', 'ui', 28, 32, [0, 0, 56, 64], pennantRibbonSvg(true),
    'Part 2 earned golden cloth pennant ribbon for Campaign Map & Results');
  add('ui_pennant_ribbon_empty', 'ui', 28, 32, [0, 0, 56, 64], pennantRibbonSvg(false),
    'Part 2 unearned parchment dashed pennant ribbon for Campaign Map & Results');

  // Enhanced Boss 1-10 Topiary Keep & Level 1-7 Props (group: 'props')
  add('prop_topiary_peacock_crest', 'props', 160, 96, [0, 0, 320, 192], topiaryPeacockCrestSvg(),
    'Boss 1-10 Topiary Keep sculpted clipped-hedge peacock head, crown plumes, and fanned hedge tail. Anchor is roof plinth center',
    { anchor: [80, 92] });
  add('prop_sprinkler_root', 'props', 64, 80, [0, 0, 128, 160], sprinklerRootSvg(),
    'Boss 1-10 glowing bioluminescent vine-wrapped Sprinkler Root prop. Anchor is base center',
    { anchor: [32, 76] });
  add('prop_lawn_sign', 'props', 48, 40, [0, 0, 96, 80], lawnSignSvg(),
    'Miniature wooden "Keep off the grass" stake sign beside Big Smoothie Jr. Anchor is stake base',
    { anchor: [24, 38] });
  add('prop_rescue_cage_hetty', 'props', 64, 72, [0, 0, 128, 144], rescueCageHettySvg(),
    'Level 1-7 ornate wrought-iron hanging Rescue Cage with Hetty Mortarboard waving inside. Anchor is floor center',
    { anchor: [32, 68] });
  add('prop_big_smoothie_jr', 'props', 96, 64, [0, 0, 192, 128], bigSmoothieJrSvg(),
    'Vintage brass-and-slate Big Smoothie Jr. Flattener steam roller with chimney smoke & crimson trim. Anchor is wheel base center',
    { anchor: [48, 60] });

  // Cutaway Fort Interior (group: 'fort')
  add('fort_nook_backing', 'fort', 32, 32, [0, 0, 200, 200], fortNookBackingSvg(),
    'Opaque #3B2D24 recessed timber-and-lantern interior nook backing for cutaway player forts (alpha 1.0)',
    { anchor: [0, 0] });
  add('fort_nook_glaze', 'fort', 32, 32, [0, 0, 200, 200], fortNookGlazeSvg(),
    'Subtle 18% warm parchment window glaze overlay for cutaway fort occupied Nooks',
    { anchor: [0, 0] });

  // Painterly Soil Strata Tiles (group: 'terrain', atlas: false, tile: 'xy')
  soilStrataTiles(add);
}
