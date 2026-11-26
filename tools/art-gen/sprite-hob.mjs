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
  neutral: { col: null, dark: null, light: null, hatch: false, neutral: true },
  // Rival Hobs (the side you fight in campaign and Skirmish): Flattener slate hat with a green level vial,
  // hatched rival orange scarf. Never the class colour hat your own crew wears.
  rival: { col: C.rival, dark: C.rivalD, light: C.rivalL, hatch: true, rival: true },
};

// Rival hat: the Hob's own hat shape, with the class colour (and its dark and light shades) swapped
// for Flattener slate. Copper pots, candles, quills and the like keep their own colours.
const RIVAL_SLATE = (L.PALETTE_V2 && L.PALETTE_V2.flattenerSlate) || '#5A6572';
const RIVAL_SLATE_D = (L.PALETTE_V2 && L.PALETTE_V2.flattenerSlateD) || '#3D4652';
const RIVAL_SLATE_L = (L.PALETTE_V2 && L.PALETTE_V2.flattenerSlateL) || '#7E8A98';
const RIVAL_BUBBLE = (L.PALETTE_V2 && L.PALETTE_V2.flattenerBubble) || '#4ADE80';
const HAT_CLASS_COL = { lobber: C.lobber, zinger: C.zinger, scatter: C.scatter, delver: C.delver, boinker: C.boinker, patcher: C.patcher, sizzler: C.sizzler, peeper: C.peeper };
function rivalRecolour(svg, cls) {
  const hc = HAT_CLASS_COL[cls];
  if (!svg || !hc) return svg || '';
  const swap = [[hc, RIVAL_SLATE], [shade(hc, -.25), RIVAL_SLATE_D], [shade(hc, .35), RIVAL_SLATE_L]];
  let out = svg;
  for (const [from, to] of swap) out = out.replace(new RegExp(from.replace('#', '#?'), 'gi'), to);
  return out;
}
// Small spirit-level vial pinned where the P2 diamond sits: the Flattener cap cue, on a Hob.
function rivalVial(px, py) {
  return g(rr(-7, -3.6, 14, 7.2, 3.6, '#F2E8D5', { stroke: ink, sw: 1.8 }) + circ(0.8, 0, 2.3, RIVAL_BUBBLE, { stroke: ink, sw: 1 }) + line(-4.2, -1.6, -4.2, 1.6, ink, 1) + line(4.2, -1.6, 4.2, 1.6, ink, 1), `translate(${px} ${py})`);
}

// Compact 16x16 (@1x, viewBox [-16, -16, 32, 32], anchor [8, 8]) team scarf & pennant badge overlays.
// Same 0.5 px/du density as Hob sprites so clients composite at scale = hob.scale with zero blur.
export const SCARF_OVERLAYS = {
  hob_scarf_blue:   { col: C.you,     light: C.youL,    hatch: false, stripe: '#FFFFFF', pin: C.br,      badge: false, band: false, purpose: 'Team scarf overlay (16x16), player 1 solid cobalt blue. Composite on neutral Hob neck' },
  hob_scarf_orange: { col: C.rival,   light: C.rivalL,  hatch: true,  stripe: '#FFFFFF', pin: '#FFFFFF', badge: true,  band: false, purpose: 'Team scarf overlay (16x16), player 2 hatched rival orange with diamond pin. Composite on neutral Hob neck' },
  hob_scarf_dusk_0: { col: '#6D4C8A', light: '#B696D4', hatch: false, stripe: '#FFF4DE', pin: C.br,      badge: false, band: false, purpose: 'Team scarf overlay (16x16), Dusk palette team 0 twilight plum. Composite on neutral Hob neck' },
  hob_scarf_dusk_1: { col: '#C25268', light: '#F09AAA', hatch: true,  stripe: '#FFF4DE', pin: C.brL,     badge: true,  band: false, purpose: 'Team scarf overlay (16x16), Dusk palette team 1 hatched rose-amber. Composite on neutral Hob neck' },
  hob_scarf_ink_0:  { col: '#2C221E', light: '#FFF4DE', hatch: false, stripe: '#FFF4DE', pin: '#FFF4DE', badge: false, band: true,  purpose: 'Team scarf overlay (16x16), high-contrast Ink palette team 0 espresso & cream band. Composite on neutral Hob neck' },
  hob_scarf_ink_1:  { col: '#2C221E', light: '#FFC23D', hatch: true,  stripe: '#FFC23D', pin: '#FFC23D', badge: true,  band: false, purpose: 'Team scarf overlay (16x16), high-contrast Ink palette team 1 espresso & hatched saffron. Composite on neutral Hob neck' },
};

export function scarfOverlaySvg(name) {
  const spec = SCARF_OVERLAYS[name];
  if (!spec) throw new Error('unknown scarf overlay: ' + name);
  const edge = L.PALETTE_V2 ? L.PALETTE_V2.ink : ink;
  const sc1 = 'M-14.5 -8 Q0 -1.5 14.5 -8 L14.5 -3 Q0 3 -14.5 -3 Z';
  const sc2 = 'M-10.5 -3.5 L-13.8 11 L-6.2 9.2 L-4.2 -1.2 Z';
  let b = path(sc2, spec.col, { stroke: edge, sw: 2.2 }) + path(sc1, spec.col, { stroke: edge, sw: 2.2 });
  let inner = '';
  if (spec.hatch) {
    for (let x = -20; x < 20; x += 5.2) inner += line(x, 5, x + 7.5, -10, spec.stripe, 1.6, { op: .92 });
    for (let y = -2; y < 12; y += 4.2) inner += line(-15, y + 2.5, -3, y - 2, spec.stripe, 1.4, { op: .92 });
  } else if (spec.band) {
    inner += path('M-14 -5.5 Q0 0.8 14 -5.5', 'none', { stroke: spec.stripe, sw: 2.1, op: .95 })
      + line(-9.5, 5.5, -5.8, 4.5, spec.stripe, 1.8, { op: .95 });
  } else {
    inner += path('M-11 -6.2 Q0 -0.8 10 -5.6', 'none', { stroke: spec.light, sw: 1.8, op: .7 });
  }
  b += clipped(path(sc1, '#000') + path(sc2, '#000'), inner)
    + path(sc2, 'none', { stroke: edge, sw: 2.2 })
    + path(sc1, 'none', { stroke: edge, sw: 2.2 });
  if (spec.badge) {
    b += path('M-7.5 -5.8 L-4.2 -2.6 L-7.5 0.6 L-10.8 -2.6 Z', spec.pin, { stroke: edge, sw: 1.5 });
  } else {
    b += circ(-7.5, -2.5, 2.3, spec.pin, { stroke: edge, sw: 1.4 });
  }
  return b;
}

// Compute exact @1x px overlay compositing transforms relative to the Hob's feet anchor.
// When `hatOverlay` is true (v2 Retina @2x 2-page atlas), the Hob's neutral body is packed hatless
// and the class hat (or Rival slate hat + spirit-level vial) composites cleanly on top.
export function hobOverlayEntries(hk, teamKey, pose, frameIndex, { hatOverlay = false } = {}) {
  const def = HOBS[hk];
  const frames = POSES[pose];
  if (!def || !frames || !frames[frameIndex]) return [];
  const p = frames[frameIndex];
  const s = def.scale || 1;
  const dx = p.dx || 0, dy = p.dy || 0, sx = p.sx || 1, sy = p.sy || 1, lean = p.lean || 0;
  const rad = lean * Math.PI / 180;
  // Scarf neck center in Hob drawing units is (0, -39); Hob sprite is 0.5 px per drawing unit.
  const ly = -39 * sy * s;
  const rx = -ly * Math.sin(rad);
  const ry = ly * Math.cos(rad);
  const r2 = (n) => Math.round(n * 100) / 100;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const isOrangeStyle = teamKey === 'orange' || teamKey === 'rival';
  const scarfSprite = isOrangeStyle ? 'hob_scarf_orange' : 'hob_scarf_blue';
  const entry = {
    sprite: scarfSprite,
    dx: r2((dx + rx) * 0.5),
    dy: r2((dy + ry) * 0.5),
    rot: lean,
    scale: r3(((sx + sy) * 0.5) * s),
  };
  const out = [entry];
  if (hatOverlay && HAT_DEDUP_HOBS.includes(hk)) {
    const hatSprite = teamKey === 'rival' ? `hob_hat_${hk}_rival` : `hob_hat_${hk}`;
    out.push(hatOverlayEntry(def, p, s, hatSprite));
  }
  // Orange team: the diamond hat patch (the colour-blind cue the v0.1 sprites had baked in).
  if (teamKey === 'orange') out.push(hatPatchEntry(def, p, s));
  if (p.balloon !== null && p.balloon !== undefined) {
    const bo = typeof p.balloon === 'object' ? p.balloon : { sway: p.balloon ? 5 : -2, str: p.balloon ? 50 : 40 };
    out.push({
      sprite: isOrangeStyle ? 'fx_snooze_balloon_p2' : 'fx_snooze_balloon',
      dx: r2((-4 + dx) * 0.5),
      dy: r2((dy - 92 * s) * 0.5),
      rot: 0,
      scale: r3(bo.k ?? 1),
    });
  }
  return out;
}

// Hobs whose hat sits purely in front of the head (no behind-body hatBack tail) so neutral bodies
// can share one hatless Retina @2x base across blue, orange, and rival teams, keeping all 729
// character frames at true @2x resolution inside two 2048x2048 atlas pages (~32 MiB VRAM).
export const HAT_DEDUP_HOBS = ['marge', 'quill', 'jax', 'nan', 'grub', 'bobbin', 'hetty'];
export const HOB_HAT_OVERLAYS = Object.fromEntries(HAT_DEDUP_HOBS.flatMap(hk => [
  [`hob_hat_${hk}`, { hob: hk, rival: false, purpose: `Class hat overlay for ${HOBS[hk].name} (48x46 @1x, pivot at (0, -78) du). Composite on hatless neutral Hob` }],
  [`hob_hat_${hk}_rival`, { hob: hk, rival: true, purpose: `Rival slate hat with green level vial overlay for ${HOBS[hk].name} (48x46 @1x, pivot at (0, -78) du). Composite on hatless neutral Hob` }],
]));
export function hobHatSvg(hk, rival = false) {
  const def = HOBS[hk];
  if (!def) throw new Error('unknown hob hat: ' + hk);
  return rival ? rivalRecolour(def.o.hatSvg, def.cls) + rivalVial(def.patch[0], def.patch[1]) : def.o.hatSvg;
}
function hatOverlayEntry(def, p, s, spriteName) {
  const hatDy = p.hatDy || 0, hatRot = p.hatRot || 0;
  const dx = p.dx || 0, dy = p.dy || 0, sx = p.sx || 1, sy = p.sy || 1, lean = p.lean || 0;
  const rad = lean * Math.PI / 180;
  // Hat pivot in Hob drawing units is (0, -78 + hatDy), transformed through body scale, lean, translate.
  const ly = (-78 + hatDy) * sy * s;
  const x2 = -ly * Math.sin(rad);
  const y2 = ly * Math.cos(rad);
  const r2 = (n) => Math.round(n * 100) / 100;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  return { sprite: spriteName, dx: r2((dx + x2) * 0.5), dy: r2((dy + y2) * 0.5), rot: lean + hatRot, scale: r3(((sx + sy) * 0.5) * s) };
}

// Hat patch overlay (P2 diamond). 8x8 @1x px, viewBox [-8, -8, 16, 16], anchor [4, 4]: same 0.5 px/du as Hobs.
export const HAT_PATCH_OVERLAYS = {
  hob_patch_orange: { purpose: 'Team hat patch overlay (8x8), player 2 diamond. Composite on the neutral Hob hat' },
};
export function hatPatchSvg() {
  return path('M0 -6.5 L6 0 L0 6.5 L-6 0 Z', C.rival, { stroke: ink, sw: 2 }) + path('M0 -3.6 L3.3 0 L0 3.6 L-3.3 0 Z', 'none', { stroke: '#FFFFFF', sw: 1.1, dash: '1.6 1.6' });
}
// Where posedHob() puts the hat patch, mapped through the hat and body transforms, in @1x px from the feet.
function hatPatchEntry(def, p, s) {
  const [px, py] = def.patch;
  const hatDy = p.hatDy || 0, hatRot = p.hatRot || 0;
  const dx = p.dx || 0, dy = p.dy || 0, sx = p.sx || 1, sy = p.sy || 1, lean = p.lean || 0;
  const rot = (x, y, deg) => { const r = deg * Math.PI / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; };
  // hat: translate(0 hatDy) rotate(hatRot 0 -78)
  let [x1, y1] = rot(px, py + 78, hatRot); y1 += -78 + hatDy;
  // body: translate(dx dy) rotate(lean) scale(sx*s sy*s)
  const [x2, y2] = rot(x1 * sx * s, y1 * sy * s, lean);
  const r2 = (n) => Math.round(n * 100) / 100;
  return { sprite: 'hob_patch_orange', dx: r2((dx + x2) * 0.5), dy: r2((dy + y2) * 0.5), rot: lean + hatRot, scale: Math.round(((sx + sy) * 0.5) * s * 1000) / 1000 };
}
// Portrait discs: the Hob is drawn with translate(2 -70) scale(.8) translate(-2 78) inside a 48 px disc whose
// anchor (its centre) is at (2, -74) du. Returns the scarf (and P2 hat patch) overlays in @1x px from that anchor.
export function portraitOverlayEntries(hk, teamKey) {
  const def = HOBS[hk];
  if (!def) return [];
  const s = def.scale || 1;
  const map = (e) => ({ ...e, dx: Math.round(((e.dx * 2 - 2) * 0.8 + 2 - 2) * 0.5 * 100) / 100, dy: Math.round(((e.dy * 2 + 78) * 0.8 - 70 + 74) * 0.5 * 100) / 100, scale: Math.round(e.scale * 0.8 * 1000) / 1000 });
  const out = [map({ sprite: teamKey === 'orange' ? 'hob_scarf_orange' : 'hob_scarf_blue', dx: 0, dy: -39 * s * 0.5, rot: 0, scale: s })];
  if (teamKey === 'orange') out.push(map(hatPatchEntry(def, {}, s)));
  return out;
}

// pose table. Frames 0.. of the first six poses are the v0.1 frames and must keep their look.
// New frames are added at the end. The play order is in assets/animations.json, not in the frame number.
export const V01_FRAMES = { idle: 3, aim: 2, fire: 2, hit: 2, bonked: 2, cheer: 2 };
export const NEXT_DOOR = { grub: 'Broad Back', hetty: 'Ridgepole', thumper: 'Old Grudge', nan: 'Clatter Call' };
export const POSES = {
  idle: [
    { face: 'happy' },
    { face: 'happy', sy: .97 },
    { face: 'blink' },
    { face: 'happy', sy: 1.025, sx: .99, hatDy: -1 },
  ],
  aim: [
    // aim_0: braced lean, knees lightly bent, tool poised forward
    { face: 'grit', toolRot: -8, hf: [25, -31], hb: [-23, -31], dx: 1, lean: -7, sx: 1.03, sy: .96, hatRot: -3 },
    // aim_1: deep back-lean with tensed pull arm hauled back, knees coiled, front hand bracing forward
    { face: 'grit', toolRot: -12, hf: [26, -34], hb: [-28, -36], dx: 2, dy: 1.5, lean: -13, sx: 1.06, sy: .91, hatDy: 1, hatRot: -8 },
    // aim_2: full stretch: puffed cheeks, squinted brow, tilted hat, planted forward brace, face clear
    { face: 'strain', toolRot: -16, hf: [27, -37], hb: [-30, -40], dx: 4, dy: 2.5, lean: -17, sx: 1.09, sy: .87, hatDy: 2, hatRot: -14, strain: true },
  ],
  fire: [
    { face: 'shout', toolRot: -12, hf: [27, -34], dx: -5, lean: -5, sy: .96, puff: true },
    { face: 'shout', toolRot: -18, hf: [24, -33], dx: -2, lean: -2 },
    { face: 'grit', toolRot: -30, hf: [17, -37], hb: [-24, -34], dx: -1, lean: -5, sy: .92, sx: 1.05 },
    { face: 'shout', toolRot: -8, hf: [29, -34], hb: [-17, -26], dx: 3, lean: 4, sy: 1.04, sx: .98, hatDy: -5, flash: true },
  ],
  hit: [
    { face: 'ouch', sy: .86, sx: 1.08, lean: -7, hf: [24, -40], hb: [-25, -40], toolRot: 14, stars: 0 },
    { face: 'ouch', sy: .93, sx: 1.04, lean: -4, hf: [23, -36], hb: [-24, -36], toolRot: 8, stars: 1 },
    { face: 'blink', sy: 1.03, sx: .98, lean: 2, hf: [21, -30], hb: [-22, -30], toolRot: 2, hatRot: 6, stars: 2 },
  ],
  bonked: [
    { face: 'bonk', tool: false, hf: [20, -22], hb: [-21, -22], balloon: 0, dy: -2 },
    { face: 'bonk', tool: false, hf: [21, -21], hb: [-22, -21], balloon: 1, dy: -8, lean: 3 },
    { face: 'dizzy', tool: false, hf: [24, -25], hb: [-25, -23], lean: -4, sy: .97, hatRot: -7, stars: 3 },
    { face: 'bonk', tool: false, hf: [21, -19], hb: [-22, -19], lean: 4, sy: .93, sx: 1.03, hatDy: 2, balloon: { sway: 1, str: 18, k: .5, zz: false } },
  ],
  cheer: [
    { face: 'cheer', sy: .93, hf: [26, -40], hb: [-25, -42], toolRot: 4 },
    { face: 'cheer', dy: -10, hatDy: -9, hf: [30, -54], hb: [-26, -56], toolRot: 12, sy: 1.03 },
    { face: 'cheer', dy: -12, hatDy: -6, hatRot: -6, hf: [27, -59], hb: [-27, -59], toolRot: -8, sy: 1.01 },
    { face: 'cheer', sy: .9, sx: 1.06, hatDy: -1, hf: [27, -36], hb: [-26, -38], toolRot: 2 },
  ],
  // falling through a broken floor: hang, then flail. The hat stays up a beat
  tumble: [
    { face: 'wide', hf: [27, -46], hb: [-27, -46], hatDy: -5, toolRot: 16, sy: 1.04, sx: .97, dy: -4, shadow: false, boots: 'dangle' },
    { face: 'shout', lean: -12, hf: [26, -58], hb: [-26, -55], hatDy: -7, hatRot: -8, toolRot: 28, sy: 1.04, sx: .97, dy: -4, shadow: false, boots: 'dangle', lines: true },
    { face: 'shout', lean: 11, hf: [28, -55], hb: [-25, -60], hatDy: -10, hatRot: 9, toolRot: -16, sy: 1.06, sx: .96, dy: -4, shadow: false, boots: 'dangle', lines: true },
    { face: 'wide', lean: -5, hf: [24, -61], hb: [-27, -51], hatDy: -8, hatRot: -4, toolRot: 20, sy: 1.05, sx: .96, dy: -4, shadow: false, boots: 'dangle', lines: true },
  ],
  // dropped landing: splat, then pop back
  land: [
    { face: 'ouch', sy: .72, sx: 1.16, hf: [27, -24], hb: [-28, -24], hatDy: 4, toolRot: -38, dust: 1 },
    { face: 'blink', sy: 1.07, sx: .95, hf: [22, -34], hb: [-23, -34], hatDy: -6, toolRot: -4, dust: 2 },
  ],
  // Shove Off: push the dirt out of a buried Loophole
  dig: [
    { face: 'grit', lean: -5, hf: [14, -35], hb: [-24, -36], toolRot: -24, dx: -1, sy: .95, sx: 1.03 },
    { face: 'shout', lean: 7, hf: [31, -30], hb: [-14, -31], toolRot: -34, dx: 3, sy: 1.02, dirt: 0 },
    { face: 'grit', lean: 3, hf: [28, -28], hb: [-18, -28], toolRot: -22, dx: 1, dirt: 1 },
  ],
  // next door Passive is live (Broad Back, Ridgepole, Old Grudge, Clatter Call)
  nextdoor: [
    { face: 'happy', glow: 1 },
    { face: 'happy', glow: 2, sy: .975 },
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
    case 'strain': {
      // Full-pull aim strain: tightly squinted brow/eyes, puffed rosy cheeks, pursed breath-holding mouth
      const puffed = ell(-5.5, -54, 6.2, 5.2, C.blush, { op: .78 }) + ell(19.5, -54, 5.2, 4.8, C.blush, { op: .78 })
        + path('M-10.5 -53 Q-8 -49 -4 -49.5 M16 -49.5 Q20 -49 22.5 -53', 'none', { stroke: ink, sw: 1.6, op: .65 });
      const squint = path('M-2 -71 L7 -68 M20 -71 L11 -68', 'none', { stroke: ink, sw: 2.8 })
        + path('M-1 -66 L6 -64.5 L0 -62.5 M19 -66 L12 -64.5 L18 -62.5', 'none', { stroke: ink, sw: 2.4 });
      const pursed = path('M5.5 -50 Q10 -53.2 14.5 -50 M4 -51.5 Q5.5 -50 4 -48.5 M16 -51.5 Q14.5 -50 16 -48.5', 'none', { stroke: ink, sw: 2.3 });
      const sweat = path('M-12 -71 C-14 -67.5 -10 -67.5 -12 -71 Z', '#9FE3FF', { stroke: ink, sw: 1.3 });
      return puffed + squint + nose + pursed + sweat;
    }
    case 'shout':
      return eyes + nose + blush + ell(10, -49, 4.5, 5, ink) + path('M7.5 -47 Q10 -45 12.5 -47', 'none', { stroke: C.blush, sw: 2 });
    case 'blink':
      return path('M-1 -65 L5 -65 M12 -65 L18 -65', 'none', { stroke: ink, sw: 2.5 }) + nose + blush + path('M4 -51 Q10 -46 16 -51', 'none', { stroke: ink, sw: 2.5 });
    case 'ouch':
      return path('M-1 -68 L5 -65 L-1 -62 M19 -68 L13 -65 L19 -62', 'none', { stroke: ink, sw: 2.5 }) + nose + blush + path('M3 -50 q2.5 -3 5 0 t5 0 t5 0', 'none', { stroke: ink, sw: 2.5 });
    case 'cheer':
      return path('M-2 -64 Q2 -69 6 -64 M11 -64 Q15 -69 19 -64', 'none', { stroke: ink, sw: 2.5 }) + nose + blush + path('M3 -52 Q10 -41 17 -52 Z', ink, { stroke: ink, sw: 2 }) + path('M7 -47.5 Q10 -45 13 -47.5', 'none', { stroke: C.blush, sw: 2.2 });
    case 'dizzy': {
      // eyes spin: a small swirl in each eye, mouth a wobbly line
      const sw = (x) => path(`M${x} -65 m0 -1.2 a1.4 1.4 0 0 1 1.4 1.4 a2.6 2.6 0 0 1 -2.6 2.6 a3.8 3.8 0 0 1 -3.8 -3.8 a5 5 0 0 1 5 -5 a5.6 5.6 0 0 1 5.4 4`, 'none', { stroke: ink, sw: 1.9 });
      return sw(1.5) + sw(14.5) + nose + blush + path('M3 -50 q2.5 3 5 0 t5 0 t5 0', 'none', { stroke: ink, sw: 2.5 });
    }
    case 'wide':
      return ell(2, -65, 4.6, 5.6, '#FFF', { stroke: ink, sw: 2 }) + ell(15, -65, 4.6, 5.6, '#FFF', { stroke: ink, sw: 2 }) + circ(2.6, -64.5, 1.9, ink) + circ(15.6, -64.5, 1.9, ink) + nose + blush + ell(10, -49.5, 3.4, 4, ink) + path('M-2 -74 L5 -75 M12 -75 L19 -74', 'none', { stroke: ink, sw: 2.2 });
    default:
      return eyes + nose + blush + path('M4 -51 Q10 -46 16 -51', 'none', { stroke: ink, sw: 2.5 });
  }
}

// little z shapes, drawn as paths so no font is needed
const zed = (x, y, k) => path(`M${f(x)} ${f(y)} h${f(8 * k)} l${f(-8 * k)} ${f(9 * k)} h${f(8 * k)}`, 'none', { stroke: ink, sw: 2.6 });

export function snoozeBalloon(x, y, o = {}) {
  const { tag = false, sway = 0, str = 46, k = 1, zz = true } = o;
  let b = path(`M0 0 C${f(-5 + sway)} ${f(-str * .4)} ${f(5 + sway)} ${f(-str * .7)} ${f(sway)} ${f(-str)}`, 'none', { stroke: ink, sw: 2 });
  if (tag) b += g(path('M0 -6 L5 0 L0 6 L-5 0 Z', C.rival, { stroke: ink, sw: 1.8 }) + line(-2, 0, 2, 0, '#FFFFFF', 1.2), `translate(${f(sway * .4 + 1)} ${f(-str * .45)})`);
  const cy = -str - 26;
  let bl = path(`M${f(sway - 4)} ${f(-str)} L${f(sway + 4)} ${f(-str)} L${f(sway)} ${f(-str - 5)} Z`, '#BFA8F0', { stroke: ink, sw: 2 });
  bl += ell(sway, cy, 22, 26, '#BFA8F0', { stroke: ink, sw: 3 });
  bl += clipped(ell(sway, cy, 22, 26, '#000'), ell(sway + 10, cy + 8, 22, 26, ink, { op: .12 }));
  bl += path(`M${f(sway - 11)} ${f(cy - 11)} Q${f(sway - 7)} ${f(cy - 19)} ${f(sway + 1)} ${f(cy - 21)}`, 'none', { stroke: '#FFFFFF', sw: 3.5, op: .75 });
  if (zz) bl += zed(sway + 24, cy - 22, .8) + zed(sway + 33, cy - 38, 1.1);
  // k below 1: the balloon is still filling. It grows from the knot
  b += k === 1 ? bl : g(bl, `translate(${f(sway)} ${f(-str)}) scale(${k}) translate(${f(-sway)} ${f(str)})`);
  return g(b, `translate(${f(x)} ${f(y)})`);
}

export function posedHob(key, teamKey, p = {}) {
  const def = HOBS[key], o = def.o, team = TEAMS[teamKey];
  const { face = 'happy', toolRot = 0, hf = [20, -27], hb = [-21, -28], dx = 0, dy = 0, sx = 1, sy = 1, lean = 0, hatDy = 0, tool = true, stars = null, balloon = null, puff = false,
    shadow = true, hatRot = 0, boots = '', flash = false, lines = false, dust = 0, dirt = null, glow = 0, omitHat = false, strain = false } = p;
  const skin = o.skin, coat = o.coat, hand = o.hands || skin;
  const s = def.scale || 1;
  let b = '';
  // boots
  if (boots === 'dangle') b += g(rr(-16, -11, 14, 11, 5, '#4A3328', { stroke: ink, sw: 3 }), 'translate(-2 1) rotate(12 -9 -11)') + g(rr(3, -11, 15, 11, 5, '#4A3328', { stroke: ink, sw: 3 }), 'translate(2 2) rotate(-10 10 -11)');
  else b += rr(-16, -11, 14, 11, 5, '#4A3328', { stroke: ink, sw: 3 }) + rr(3, -11, 15, 11, 5, '#4A3328', { stroke: ink, sw: 3 });
  // back parts and back hand
  b += (o.back || '') + circ(hb[0], hb[1], 6.5, hand, { stroke: ink, sw: 3 });
  // body
  const bodyD = 'M-20 -12 C-26 -26 -22 -46 0 -48 C22 -46 26 -26 20 -12 C14 -7 -14 -7 -20 -12 Z';
  b += path(bodyD, coat, { stroke: ink, sw: 3 });
  b += clipped(path(bodyD, '#000'), path('M4 -50 C28 -40 26 -16 14 -8 L40 -8 L40 -50 Z', ink, { op: .2 }) + rr(-12, -36, 11, 11, 2, shade(coat, .25), { extra: ' transform="rotate(-8 -6 -30)"' }) + rr(-12, -36, 11, 11, 2, 'none', { stroke: C.paper, sw: 1.4, extra: ' stroke-dasharray="2.5 2.5" transform="rotate(-8 -6 -30)"' }));
  if (o.bodyAdd) b += clipped(path(bodyD, '#000'), o.bodyAdd) + path(bodyD, 'none', { stroke: ink, sw: 3 });
  b += circ(3, -30, 2, C.paper, { op: .8 }) + circ(3, -21, 2, C.paper, { op: .8 });
  // scarf: the team part. Orange gets white hatch lines so it reads without colour.
  // In neutral (--dedup-hobs) mode, omit the scarf so clients composite a 16x16 hob_scarf_* overlay.
  if (team.neutral) {
    b += path('M-15 -46 Q0 -40 15 -46', 'none', { stroke: ink, sw: 2, op: .35 });
  } else {
    const sc1 = 'M-17 -47 Q0 -40 17 -47 L17 -42 Q0 -35 -17 -42 Z', sc2 = 'M-12 -42 L-16 -28 L-8 -30 L-6 -40 Z';
    b += path(sc1, team.col, { stroke: ink, sw: 2.5 }) + path(sc2, team.col, { stroke: ink, sw: 2.5 });
    if (team.hatch) {
      let h = '';
      for (let x = -24; x < 24; x += 5.5) h += line(x, -34, x + 8, -50, '#FFFFFF', 1.7, { op: .9 });
      for (let y = -40; y < -24; y += 4.5) h += line(-18, y + 3, -4, y - 2, '#FFFFFF', 1.5, { op: .9 });
      b += clipped(path(sc1, '#000') + path(sc2, '#000'), h) + path(sc1, 'none', { stroke: ink, sw: 2.5 }) + path(sc2, 'none', { stroke: ink, sw: 2.5 });
    }
  }
  // head
  const hatBack = (!omitHat && o.hatBack) ? (team.rival ? rivalRecolour(o.hatBack, def.cls) : o.hatBack) : '';
  let head = hatBack ? g(hatBack, `translate(0 ${f(hatDy * .4)})`) : '';
  head += circ(-19, -60, 5.5, skin, { stroke: ink, sw: 3 });
  head += circ(0, -62, 21, skin, { stroke: ink, sw: 3 });
  head += clipped(circ(0, -62, 21, '#000'), circ(9, -56, 21, ink, { op: .13 }));
  head += faceSvg(face, skin);
  head += o.faceAdd || '';
  if (!omitHat) {
    let hat = team.rival ? rivalRecolour(o.hatSvg, def.cls) + rivalVial(def.patch[0], def.patch[1]) : o.hatSvg;
    if (teamKey === 'orange') {
      const [px, py] = def.patch;
      hat += g(path('M0 -6.5 L6 0 L0 6.5 L-6 0 Z', team.col, { stroke: ink, sw: 2 }) + path('M0 -3.6 L3.3 0 L0 3.6 L-3.3 0 Z', 'none', { stroke: '#FFFFFF', sw: 1.1, dash: '1.6 1.6' }), `translate(${px} ${py})`);
    }
    head += g(hat, hatRot ? `translate(0 ${f(hatDy)}) rotate(${hatRot} 0 -78)` : hatDy ? `translate(0 ${f(hatDy)})` : '');
  }
  b += head;
  // tool and front hand: the tool turns about the hand
  if (tool) {
    const t = o.toolSvg || (circ(32, -16, 8, C.boinker, { stroke: ink, sw: 2.5 }) + path('M27 -20 Q32 -24 37 -20', 'none', { stroke: '#FFF', sw: 2 }));
    b += g(t, `translate(${f(hf[0] - 20)} ${f(hf[1] + 27)}) rotate(${toolRot} 20 -27)`);
  }
  b += circ(hf[0], hf[1], 6.5, hand, { stroke: ink, sw: 3 });
  // extras that ride with the body
  let fx = '';
  if (strain) fx += path('M-28 -78 l-6 -4 M-30 -68 l-7 0 M-27 -58 l-6 4', 'none', { stroke: ink, sw: 2.1, op: .65 });
  if (puff) fx += path('M50 -62 l9 -6 M54 -50 l11 -1 M50 -38 l9 5', 'none', { stroke: ink, sw: 2.5 }) + star4(46, -50, 5, C.gold, { stroke: ink, sw: 1.5 });
  if (flash) fx += star4(52, -44, 11, '#FFF3C4', { stroke: C.gold, sw: 2 }) + star4(52, -44, 4.5, '#FFFFFF');
  if (lines) fx += path('M-34 -96 v-20 M-29 -72 v-14 M40 -98 v-20 M35 -74 v-14', 'none', { stroke: ink, sw: 2.5, op: .55 });
  if (stars !== null) {
    // 0 and 1: hit stars. 2: stars drift off. 3: stars ring the head (eyes spin)
    const pts = stars === 3 ? [[-26, -98, 6.5], [0, -110, 5], [27, -100, 7], [36, -80, 4.5]] : stars === 2 ? [[-38, -100, 4.5], [42, -92, 5.5], [12, -116, 4]] : stars ? [[-30, -92, 6], [34, -86, 7.5], [8, -104, 5]] : [[-24, -84, 7.5], [30, -92, 6], [2, -98, 5]];
    for (const [x, y, r] of pts) fx += star4(x, y, r, C.gold, { stroke: ink, sw: 1.8 });
  }
  // exact scale (f() rounds to one decimal, too coarse for a 3% breathe)
  const body = `<g transform="translate(${f(dx)} ${f(dy)}) rotate(${lean}) scale(${(sx * s).toFixed(3)} ${(sy * s).toFixed(3)})">${b}${fx}</g>`;
  let out = '';
  // next door glow: a gold ring at the feet. Gold, never teal or a team colour
  if (glow) out += ell(0, -1, 28 + glow * 5, 4 + glow, C.gold, { op: .4 + glow * .15 }) + ell(0, -1, 36 + glow * 6, 5 + glow * .8, 'none', { stroke: C.gold, sw: 2.5, op: .5 + glow * .2, extra: ' stroke-dasharray="5 5"' });
  if (shadow) out += ell(0, 0, 24 * s, 5, ink, { op: dy < -4 ? .12 : .18 });
  out += body;
  // landing dust: soft, no outline, drawn at the floor
  if (dust) { const k = dust === 1 ? 1 : 1.5, op = dust === 1 ? .9 : .5; for (const sg of [-1, 1]) out += circ(sg * (26 + k * 8), -5 * k, 6 * k, '#CFC8C0', { op }) + circ(sg * (34 + k * 12), -3 - k, 4 * k, '#E4DED6', { op }) + circ(sg * (20 + k * 6), -3, 4.5 * k, '#E4DED6', { op }); }
  // Shove Off dirt: clods fly out to the front. 0 = the heap breaks, 1 = clods in the air
  if (dirt !== null) {
    const cl = (x, y, r, col = '#9A6440') => path(`M${f(x - r)} ${f(y)} C${f(x - r)} ${f(y - r * 1.1)} ${f(x + r * .9)} ${f(y - r * 1.2)} ${f(x + r)} ${f(y - r * .1)} C${f(x + r * .9)} ${f(y + r * .9)} ${f(x - r * .8)} ${f(y + r)} ${f(x - r)} ${f(y)} Z`, col, { stroke: ink, sw: 2.2 });
    out += dirt === 0 ? cl(50, -22, 10) + cl(62, -34, 6.5, '#B07A52') + cl(64, -12, 7) + cl(74, -24, 4.5, '#7A4A2E') + path('M44 -42 l5 -8 M56 -46 l2 -8', 'none', { stroke: ink, sw: 2.2 })
      : cl(58, -40, 6.5) + cl(72, -54, 5, '#B07A52') + cl(74, -26, 5.5) + cl(64, -12, 4, '#7A4A2E') + cl(78, -42, 3.2, '#7A4A2E') + circ(50, -6, 6, '#CFC8C0', { op: .7 }) + circ(60, -4, 4, '#E4DED6', { op: .7 });
  }
  if (balloon !== null && !team.neutral) {
    const bo = typeof balloon === 'object' ? balloon : { sway: balloon ? 5 : -2, str: balloon ? 50 : 40 };
    out += snoozeBalloon(-4 + dx, dy - 92 * s, { tag: teamKey === 'orange' || !!team.rival, ...bo });
  }
  return out;
}
