// Animation frames and animation data for Castle Protect.
// Called by gen-sprites.mjs after the v0.1 sprites. It adds new frames (never renames an old one)
// and returns the text of assets/animations.json.
// Rule for every frame set: all frames of one animation share one size and one anchor.
import * as L from './lib.mjs';
import { posedHob, HOBS, POSES, TEAMS, V01_FRAMES, NEXT_DOOR } from './sprite-hob.mjs';
const { C, rr, circ, ell, path, line, g, star4, burst, clipped, f, MAT } = L;
const ink = C.ink;
const O = (sw = 6, stroke = ink) => ({ stroke, sw });
const DUST = '#CFC8C0', DUSTL = '#E4DED6', SOOT = '#5A4E52', DIRT = '#9A6440';
// soft blob: no outline (smoke, dust, steam)
const soft = (x, y, r, col, op) => circ(x, y, r, col, { op }) + circ(x - r * .7, y + r * .3, r * .7, col, { op }) + circ(x + r * .75, y + r * .25, r * .65, col, { op });
const rot = (inner, a, cx = 0, cy = 0) => g(inner, `rotate(${f(a)} ${f(cx)} ${f(cy)})`);
const at = (inner, x, y, extra = '') => g(inner, `translate(${f(x)} ${f(y)})${extra ? ' ' + extra : ''}`);
// scale about a point
const scl = (inner, sx, sy, cx, cy) => g(inner, `translate(${f(cx)} ${f(cy)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${f(-cx)} ${f(-cy)})`);

export function buildAnim({ add: addSprite, find, solidBlock, SHELLS, shared, HOB_NAME }) {
  const A = {};      // animations
  const add = (name, group, w, h, vb, body, purpose, o = {}) => addSprite(name, group, w, h, vb, body, purpose, o);
  // anim(key, frames, ms, opts). ms = one number for all frames, or one per frame.
  // opts: loop, loop_from, events { name: frame index }, next (animation), hold (sprite), pick, note
  function anim(key, frames, ms, o = {}) {
    if (A[key]) throw new Error('duplicate animation ' + key);
    const sp = frames.map(n => { const s = find(n); if (!s) throw new Error(`${key}: no sprite ${n}`); return s; });
    for (const s of sp) if (s.w !== sp[0].w || s.h !== sp[0].h || s.anchor[0] !== sp[0].anchor[0] || s.anchor[1] !== sp[0].anchor[1]) throw new Error(`${key}: ${s.name} has a different size or anchor`);
    const e = { frames, ms: Array.isArray(ms) ? ms : frames.map(() => ms), loop: !!o.loop };
    if (e.ms.length !== frames.length) throw new Error(key + ': ms count');
    if (o.loop_from) e.loop_from = o.loop_from;
    e.w = sp[0].w; e.h = sp[0].h;
    e.anchor = sp[0].anchor.map(n => Math.round(n * 100) / 100);
    e.events = o.events || {};
    for (const k of ['next', 'hold', 'pick', 'note']) if (o[k]) e[k] = o[k];
    A[key] = e;
  }
  const seq = (base, n, from = 0) => Array.from({ length: n }, (_, i) => `${base}_${i + from}`);

  // ================================================================ 1. Hobs
  for (const hk of Object.keys(HOB_NAME)) {
    for (const tk of ['blue', 'orange']) {
      const P = `hob_${hk}_${tk}_`;
      const who = `${HOB_NAME[hk]}, ${tk} team`;
      const what = {
        idle: ['breathe in'], aim: ['full power'], fire: ['wind-up', 'release (the shell leaves here)'], hit: ['shake it off, stars drift'],
        bonked: ['eyes spin', 'Snooze Balloon inflates from the hat'], cheer: ['top of the jump, hat thrown', 'landing, hat caught'],
        tumble: ['hangs in the air', 'falls, flail 1', 'falls, flail 2', 'falls, flail 3'], land: ['splat', 'pops back'],
        dig: ['pulls back', 'shoves the dirt out', 'clods fly'], nextdoor: ['glow low', 'glow high'],
      };
      for (const [pose, frames] of Object.entries(POSES)) {
        if (pose === 'nextdoor' && !NEXT_DOOR[hk]) continue;
        const from = V01_FRAMES[pose] || 0;
        frames.slice(from).forEach((p, j) => {
          const i = from + j, tall = pose === 'bonked';
          const vb = tall ? [-60, -224, 144, 232] : [-60, -152, 144, 160];
          const extra = pose === 'nextdoor' ? ` Shows that ${NEXT_DOOR[hk]} is live` : '';
          add(`${P}${pose}_${i}`, 'hobs', 72, vb[3] / 2, vb, posedHob(hk, tk, p), `${who}, ${pose} frame ${i}: ${what[pose][j]}.${extra} Faces right. Anchor is the feet`, { anchor: [30, -vb[1] / 2] });
        });
      }
      const K = `hob_${hk}_${tk}_`;
      anim(K + 'idle', [P + 'idle_0', P + 'idle_1', P + 'idle_0', P + 'idle_3'], 400, { loop: true, note: 'Breathe. Play blink on top every 3 to 5 s' });
      anim(K + 'blink', [P + 'idle_2'], [120], { next: K + 'idle' });
      anim(K + 'aim', seq(P + 'aim', 3), 100, { pick: 'power', note: 'Not timed. Show frame 0, 1 or 2 for low, mid or full power' });
      anim(K + 'fire', [P + 'fire_2', P + 'fire_3', P + 'fire_0', P + 'fire_1'], [120, 60, 100, 140], { events: { release: 1 }, next: K + 'idle', note: 'Wind-up, release, recoil, settle' });
      anim(K + 'hit', seq(P + 'hit', 3), [80, 100, 120], { events: { flash: 0 }, next: K + 'idle' });
      anim(K + 'tumble', seq(P + 'tumble', 4), [150, 90, 90, 90], { loop: true, loop_from: 1, events: { fall: 1 }, note: 'Frame 0 is the hang. Move the Hob down in code from the fall event. Play land when it stops' });
      anim(K + 'land', seq(P + 'land', 2), [90, 110], { events: { thud: 0 }, next: K + 'idle' });
      anim(K + 'bonked', [P + 'bonked_2', P + 'bonked_3', P + 'bonked_0', P + 'bonked_1'], [360, 180, 260, 260], { loop: true, loop_from: 2, events: { inflate: 1, lift: 2 }, note: 'Eyes spin, balloon inflates, lift off, float. Move the Hob up in code from the lift event' });
      anim(K + 'cheer', seq(P + 'cheer', 4), [140, 180, 260, 200], { events: { jump: 1, land: 3 }, next: K + 'idle' });
      anim(K + 'dig', seq(P + 'dig', 3), [140, 100, 180], { events: { clear: 1 }, next: K + 'idle', note: 'Shove Off' });
      if (NEXT_DOOR[hk]) anim(K + 'nextdoor', seq(P + 'nextdoor', 2), 450, { loop: true, note: `${NEXT_DOOR[hk]} is live. Use in place of idle` });
    }
  }

  // ================================================================ 2. Fort
  // Stomper walk: 6 frames. Two-link leg, knee to the front. [foot x, foot lift, boot pitch]
  const WALK = [[16, 0, 0], [5, 0, 0], [-6, 0, 0], [-14, 7, 15], [-5, 14, 10], [11, 7, -10]];
  const WALK_WHAT = ['foot lands in front', 'weight on the foot', 'foot behind', 'push off, heel up', 'foot lifts and swings', 'foot reaches forward'];
  function stomperLeg(fx, lift, pitch, tk) {
    const ax = fx, ay = 50 - lift, L1 = 27, L2 = 26.5;
    const d = Math.min(Math.hypot(ax, ay), L1 + L2 - .05), a0 = Math.atan2(ay, ax);
    const aK = a0 - Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const kx = Math.cos(aK) * L1, ky = Math.sin(aK) * L1;
    let b = '';
    b += path(`M0 0 L${f(kx)} ${f(ky)}`, 'none', { stroke: ink, sw: 14 }) + path(`M0 0 L${f(kx)} ${f(ky)}`, 'none', { stroke: C.steelD, sw: 9 });
    b += path(`M${f(kx)} ${f(ky)} L${f(ax)} ${f(ay)}`, 'none', { stroke: ink, sw: 14 }) + path(`M${f(kx)} ${f(ky)} L${f(ax)} ${f(ay)}`, 'none', { stroke: C.steel, sw: 9 });
    b += path(`M-8 6 L${f(kx - 8)} ${f(ky + 14)}`, 'none', { stroke: C.br, sw: 4 }) + path(`M-8 6 L${f(kx - 8)} ${f(ky + 14)}`, 'none', { stroke: ink, sw: 1, op: .4 });
    let teeth = '';
    // the knee gear turns with the step
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + aK * 2; teeth += g(rr(-3, -3, 6, 6, 1, C.br, { stroke: ink, sw: 1.5 }), `translate(${f(kx + Math.cos(a) * 10)} ${f(ky + Math.sin(a) * 10)}) rotate(${f(a * 180 / Math.PI)})`); }
    b += teeth + circ(kx, ky, 10, C.br, { stroke: ink, sw: 2.5 }) + circ(kx, ky, 3.5, C.brD);
    let boot = path('M-16 62 C-16 48 -8 46 0 46 C14 46 24 52 24 62 Z', TEAMS[tk].col, { stroke: ink, sw: 3 });
    if (tk === 'orange') boot += path('M8 60 l6 -10 M14 60 l5 -8 M2 60 l6 -12', 'none', { stroke: '#FFFFFF', sw: 2.2 });
    boot += rr(-18, 59, 44, 6, 3, '#3A3236', { stroke: ink, sw: 2.5 });
    b += g(boot, `translate(${f(ax)} ${f(ay - 50)}) rotate(${pitch} 0 50)`);
    b += circ(0, 0, 7, C.steelD, { stroke: ink, sw: 2.5 });
    return b;
  }
  for (const tk of ['blue', 'orange']) {
    WALK.forEach(([fx, lift, pitch], i) => add(`stomper_${tk}_walk_${i}`, 'stompers', 32, 30, [-38, -12, 84, 78.75], stomperLeg(fx, lift, pitch, tk),
      `Stomper leg, ${tk} boot, walk frame ${i} of 6: ${WALK_WHAT[i]}. Hip pivot is the anchor`, { anchor: [38 / 84 * 32, 12 / 78.75 * 30] }));
    anim(`stomper_${tk}_walk`, seq(`stomper_${tk}_walk`, 6), 110, { loop: true, events: { stomp: 0 }, note: 'Start every second leg 3 frames later. Move the fort body with data.fort_bob' });
  }

  // Kettle Room steam puffs: one puff rises and thins
  {
    const st = [[32, 80, 9, .95], [30, 62, 13, .9], [35, 42, 16, .65], [31, 22, 17, .35]];
    st.forEach(([x, y, r, op], i) => {
      let b = soft(x, y, r, '#FFFFFF', op) + (i < 2 ? circ(x, y, r, 'none', { stroke: ink, sw: 2, op: .3 }) : '');
      if (i === 3) b = circ(x - 10, y + 4, r * .55, '#FFFFFF', { op }) + circ(x + 9, y - 4, r * .45, '#FFFFFF', { op }) + circ(x + 2, y + 14, r * .3, '#FFFFFF', { op });
      add(`fx_kettle_steam_${i}`, 'kettle', 16, 24, [0, 0, 64, 96], b, `Kettle Room steam puff, frame ${i} of 4. Soft white, rises and thins. Anchor is the bottom centre`, { anchor: [8, 24] });
    });
    anim('fx_kettle_steam', seq('fx_kettle_steam', 4), 180, { loop: true, note: 'Place at the kettle spout or a Kettle Room vent' });
  }

  // Heartkettle pop: wobble, wobble, crack, steam burst, fizzle, sit down
  {
    const vb = [-90, -180, 232, 203], an = [90 / 3.625, 180 / 3.625];
    const K = (o, tr) => g(L.kettle(0, 0, 1, { glowOn: false, ...o }), tr);
    const lid = path('M-18 0 C-18 -12 18 -12 18 0 Z', '#A4521F', { stroke: ink, sw: 3 }) + circ(0, -12, 5, C.br, { stroke: ink, sw: 2.5 });
    const steam = (x, y, r, op = .95) => soft(x, y, r, '#FFFFFF', op);
    const fr = [
      K({ hp: .15 }, 'rotate(-6)') + path('M-58 -70 l-9 -5 M-60 -52 l-10 0 M58 -100 l8 -6', 'none', { stroke: ink, sw: 2.5 }),
      K({ hp: .15 }, 'rotate(7) scale(1.04 1.02)') + steam(-64, -60, 10) + steam(84, -40, 9) + path('M66 -30 l10 3 M-70 -84 l-8 -6', 'none', { stroke: ink, sw: 2.5 }),
      burst(0, -62, 70, 46, 10, '#FFF3C4', { stroke: C.gold, sw: 3, rot: .2 }) + K({ hp: .1 }, 'scale(1.1 1.05)') +
        path('M-8 -86 L2 -70 L-6 -56 L6 -40 L-2 -26 M2 -70 L18 -62 M6 -40 L-12 -34 M-30 -60 L-18 -50', 'none', { stroke: ink, sw: 3.5 }) +
        path('M-8 -86 L2 -70 L-6 -56 L6 -40 L-2 -26', 'none', { stroke: C.glowL, sw: 1.4 }),
      // steam burst: lid flies, big steam, the teal glow leaves the kettle
      steam(0, -118, 34) + steam(-52, -92, 22) + steam(56, -96, 24) + steam(-20, -150, 20, .85) + steam(34, -146, 18, .85) +
        K({ popped: true }, 'scale(1.03 .97)') + at(rot(lid, -28), 34, -158) +
        circ(-30, -128, 5, C.glow, { op: .9 }) + circ(22, -120, 4, C.glow, { op: .9 }) + circ(-6, -150, 3.5, C.glowL) + circ(60, -128, 3, C.glow, { op: .8 }) +
        path('M-74 -40 l-12 4 M76 -44 l12 2 M-62 -112 l-9 -8 M72 -118 l8 -8', 'none', { stroke: ink, sw: 2.5 }),
      // fizzle: steam thins and climbs, the lid drops
      steam(-8, -136, 20, .6) + steam(40, -150, 15, .5) + steam(-44, -122, 13, .5) + steam(8, -102, 12, .65) +
        K({ popped: true }, 'scale(1.05 .93)') + at(rot(lid, 62), 104, -74) + circ(-18, -112, 3, C.glow, { op: .5 }) + circ(26, -126, 2.5, C.glow, { op: .4 }) +
        path('M-10 -88 q-5 -8 0 -16 q5 -8 0 -16', 'none', { stroke: '#FFFFFF', sw: 3, op: .8 }),
      // sit down: the fort has no steam. Squash and floor dust
      K({ popped: true }, 'scale(1.09 .86)') + soft(-64, -8, 11, DUST, .8) + soft(68, -8, 12, DUST, .8) + circ(-84, -14, 5, DUSTL, { op: .7 }) + circ(92, -16, 5, DUSTL, { op: .7 }) +
        steam(-6, -112, 9, .35) + path('M-56 -30 l-10 -6 M58 -30 l10 -6', 'none', { stroke: ink, sw: 2.5, op: .6 }),
    ];
    const what = ['wobble left, lid rattles', 'wobble right, swells', 'crack and flash', 'steam burst, the lid flies, the glow goes out', 'fizzle', 'sits down'];
    fr.forEach((b, i) => add(`kettle_pop_${i}`, 'kettle', 64, 56, vb, b, `Heartkettle pop, frame ${i} of 6: ${what[i]}. Same scale as kettle_full. Anchor is the base centre`, { anchor: an }));
    anim('kettle_pop', seq('kettle_pop', 6), [90, 90, 80, 160, 200, 220], { events: { crack: 2, pop: 3, sit: 5 }, hold: 'kettle_popped', note: 'Hit stop 80 ms at pop, then slow motion (07 section 6). The fort sits down at sit' });
  }

  // Loophole Flap closing: the cloth unrolls from the rod. Play backwards to roll it up
  {
    const arch = 'M30 84 L30 44 C30 16 70 16 70 44 L70 84 Z';
    for (const tk of ['blue', 'orange']) {
      const t = TEAMS[tk];
      [.14, .45, .8].forEach((k, i) => {
        const yb = 20 + 70 * k;
        const cloth = `M20 20 L80 20 L${f(80 + 2 * k)} ${f(yb)} L${f(21 + k)} ${f(yb)} Z`;
        let fl = path(arch, '#2A1C22', { stroke: ink, sw: 7 }) + path('M38 80 L38 46 C38 32 48 26 56 26', 'none', { stroke: '#FFFFFF', sw: 4, op: .18 });
        fl += line(14, 16, 86, 16, ink, 9) + line(14, 16, 86, 16, '#C9A27A', 4.5);
        let inner = rr(0, 0, 100, 100, 0, '#F2E8D5') + rr(28, 34, 20, 18, 3, '#E3D3B0') + rr(54, 56, 18, 16, 3, '#FFF8E8') + path('M60 20 L84 60 L84 76 L72 76 Z', ink, { op: .1 });
        fl += clipped(path(cloth, '#000'), inner) + path(cloth, 'none', { stroke: ink, sw: 6 });
        // the roll at the cloth's lower edge, with the team hem wound on it
        let roll = rr(15, yb - 6, 72, 13, 6.5, t.col, { stroke: ink, sw: 5 });
        let hh = ''; if (t.hatch) for (let x = 10; x < 96; x += 9) hh += line(x, yb + 9, x + 8, yb - 8, '#FFFFFF', 3);
        roll += clipped(rr(15, yb - 6, 72, 13, 6.5, '#000'), hh + rr(15, yb - 6, 72, 4.5, 0, '#FFFFFF', { op: .25 })) + rr(15, yb - 6, 72, 13, 6.5, 'none', { stroke: ink, sw: 5 });
        fl += roll + circ(24, 16, 5, C.paper, { stroke: ink, sw: 3 }) + circ(76, 16, 5, C.paper, { stroke: ink, sw: 3 });
        add(`loophole_flap_${tk}_close_${i}`, 'fort', 16, 16, [0, 0, 100, 100], fl, `Loophole Flap closing, ${tk} hem, frame ${i} of 3: ${['rolled up', 'half down', 'nearly down'][i]}. Overlay on a wall block`, { anchor: [0, 0] });
      });
      anim(`loophole_flap_${tk}_close`, seq(`loophole_flap_${tk}_close`, 3), 70, { hold: `loophole_flap_${tk}`, note: 'Play backwards to roll the Flap up, then show loophole_open' });
    }
  }

  // Pot Lid raise: a Hob lifts the lid over a room
  {
    const lid = SHELLS.pot_lid[1];
    const fr = [
      at(rot(lid, -10, 50, 64), 0, 38) + path('M24 116 l-5 5 M78 114 l6 5', 'none', { stroke: ink, sw: 4, op: .5 }),
      at(rot(lid, 6, 50, 64), 0, 20) + path('M22 104 v12 M50 108 v10 M78 104 v12', 'none', { stroke: ink, sw: 4, op: .5 }),
      at(lid, 0, 4) + star4(84, 22, 11, '#FFFFFF', O(3)) + path('M6 44 l-5 -6 M94 46 l5 -6', 'none', { stroke: ink, sw: 4 }),
    ];
    fr.forEach((b, i) => add(`pot_lid_raise_${i}`, 'fort', 32, 40, [0, 0, 100, 125], b, `Pot Lid raise, frame ${i} of 3: ${['low and tilted', 'half way up', 'held high, with a glint'][i]}. Anchor is the bottom centre, on the room's roof`, { anchor: [16, 40] }));
    anim('pot_lid_raise', seq('pot_lid_raise', 3), [80, 80, 160], { events: { up: 2 }, hold: 'pot_lid_raise_2', note: 'Play backwards when the lid comes down' });
  }

  // ================================================================ 3. Collapse pieces
  const MATS = ['wicker', 'timber', 'cobble', 'footing'];
  {
    // crack line that runs along the break. Three stages: starts, crosses, opens
    const CR = {
      wicker: { main: [[10, 8], [24, 22], [20, 34], [36, 44], [48, 58], [44, 70], [60, 80], [74, 94]], br: [[[36, 44], [52, 38], [62, 26]], [[44, 70], [28, 76], [20, 90]]] },
      timber: { main: [[0, 48], [14, 53], [26, 46], [40, 54], [54, 47], [68, 55], [82, 49], [100, 53]], br: [[[26, 46], [32, 34], [46, 30]], [[68, 55], [74, 68], [90, 72]]] },
      cobble: { main: [[8, 12], [22, 24], [18, 38], [34, 46], [46, 44], [56, 60], [70, 64], [78, 80], [92, 88]], br: [[[34, 46], [30, 62], [40, 76]], [[56, 60], [68, 48], [84, 44]], [[22, 24], [38, 16]]] },
      footing: { main: [[2, 30], [20, 37], [32, 30], [48, 41], [62, 36], [80, 47], [98, 42]], br: [[[32, 30], [37, 48], [30, 62]], [[62, 36], [70, 22]]] },
    };
    const d = (pts) => 'M' + pts.map(p => p.join(' ')).join(' L');
    for (const m of MATS) {
      const c = CR[m], col = MAT[m];
      for (let i = 0; i < 3; i++) {
        const main = i === 0 ? c.main.slice(0, 4) : c.main, sw = [6, 7, 9][i];
        let b = path(d(main), 'none', { stroke: col.l, sw: sw * .7, op: .7, extra: ' transform="translate(3 3)"' }) + path(d(main), 'none', { stroke: ink, sw });
        if (i === 2) {
          for (const br of c.br) b += path(d(br), 'none', { stroke: ink, sw: 5.5 });
          b += path(d(main.slice(2, 6)), 'none', { stroke: col.h, sw: 3 });
          b += circ(main[3][0] + 8, main[3][1] + 16, 4, DUSTL, { op: .9 }) + circ(main[5][0] - 4, main[5][1] + 18, 3, DUSTL, { op: .8 });
        }
        if (m === 'wicker' && i > 0) b += path('M24 22 l-9 4 M36 44 l-10 6 M48 58 l10 -4 M60 80 l8 -8', 'none', { stroke: col.l, sw: 4 });
        if (m === 'timber' && i > 0) b += path('M40 54 l6 -9 M54 47 l-4 10 M82 49 l5 -8', 'none', { stroke: col.l, sw: 3.5 });
        b = clipped(rr(0, 0, 100, 100, 8, '#000'), b);
        add(`fx_crack_${m}_${i}`, 'effects', 16, 16, [0, 0, 100, 100], b, `Crack overlay for a ${m} block about to fall, stage ${i} of 3: ${['starts', 'crosses the block', 'opens, sheds dust'][i]}. Draw over the block`, { anchor: [0, 0] });
      }
      anim(`fx_crack_${m}`, seq(`fx_crack_${m}`, 3), 100, { hold: `fx_crack_${m}_2`, note: 'Creak beat: 0.3 s before the fall' });
    }
    // falling chunk debris: a broken piece of the block, four quarter turns
    const chunk = L.poly([[-36, -30], [8, -42], [40, -18], [30, 24], [4, 40], [-38, 26]]);
    for (const m of MATS) {
      for (let i = 0; i < 4; i++) {
        const b = rot(clipped(path(chunk, '#000'), solidBlock(m, -50, -50, 100, 1)) + path(chunk, 'none', { stroke: ink, sw: 8 }) + path('M-28 -24 L4 -34', 'none', { stroke: MAT[m].l, sw: 5, op: .8 }), i * 90 + [0, 12, -8, 10][i]);
        add(`fx_chunk_${m}_${i}`, 'effects', 12, 12, [-60, -60, 120, 120], b, `Falling chunk of ${m}, turn ${i} of 4. View only. Move it on an arc in code`);
      }
      anim(`fx_chunk_${m}`, seq(`fx_chunk_${m}`, 4), 70, { loop: true });
    }
    // dust cloud: bursts low and wide, rises, thins
    const DC = [
      [[120, 136, 22, DUST, .95], [84, 142, 14, DUSTL, .95], [158, 142, 14, DUSTL, .95]],
      [[120, 124, 32, DUST, .9], [66, 134, 22, DUSTL, .9], [176, 134, 22, DUSTL, .9], [120, 96, 16, DUSTL, .9]],
      [[120, 108, 38, DUST, .75], [52, 122, 26, DUSTL, .75], [190, 120, 26, DUSTL, .75], [96, 70, 20, DUSTL, .75], [150, 74, 18, DUST, .75]],
      [[118, 92, 36, DUST, .5], [44, 108, 24, DUSTL, .5], [198, 104, 24, DUSTL, .5], [88, 50, 20, DUSTL, .5], [158, 54, 18, DUST, .5]],
      [[112, 74, 26, DUST, .26], [40, 94, 16, DUSTL, .26], [204, 88, 16, DUSTL, .26], [82, 34, 14, DUSTL, .26], [164, 38, 13, DUST, .26]],
    ];
    DC.forEach((bl, i) => add(`fx_dustcloud_${i}`, 'effects', 48, 32, [0, 0, 240, 160], bl.map(([x, y, r, c, op]) => soft(x, y, r, c, op)).join(''), `Dust cloud, frame ${i} of 5. Soft, no outline. For a landed chunk or a fort that sits down. Anchor is the bottom centre`, { anchor: [24, 30] }));
    anim('fx_dustcloud', seq('fx_dustcloud', 5), 90, { note: 'Scale by material with data.collapse.dust_scale' });
    // rubble settle: the pile lands, squashes, springs, rests
    const chipD = ['M20 30 L70 16 L84 60 L40 84 Z', 'M26 24 L78 34 L70 74 L30 70 Z'];
    for (const m of MATS) {
      const rub = L.block(m, 0, 0, 32, 3), col = MAT[m];
      const chip = (x, y, k, a, j) => g(path(chipD[j], j ? col.l : col.base, O(10)), `translate(${x} ${y}) rotate(${a}) scale(${k}) translate(-50 -50)`);
      const fr = [
        scl(rub, .9, 1.14, 16, 32) + chip(4, 0, .05, 20, 0) + chip(27, -3, .045, -30, 1),
        scl(rub, 1.14, .76, 16, 32) + chip(-1, 12, .04, 60, 1) + chip(33, 10, .04, -10, 0),
        scl(rub, .97, 1.06, 16, 32),
      ];
      fr.forEach((b, i) => add(`fx_rubble_${m}_${i}`, 'effects', 20, 20, [-4, -6, 40, 40], b, `Rubble settle, ${m}, frame ${i} of 3: ${['lands tall', 'squashes wide', 'springs back'][i]}. Anchor is the block's top left`, { anchor: [2, 3] }));
      anim(`fx_rubble_${m}`, seq(`fx_rubble_${m}`, 3), [70, 80, 90], { hold: `block_${m}_broken`, note: 'Then show the broken block for 1.5 s and fade' });
    }
  }

  // ================================================================ 4. Shots and effects
  {
    // trails: one puff's life in 6 frames. Emit one every few cells behind the shell
    const TR = {
      blast: (i) => { const r = 9 + i * 2.2, op = [.95, .9, .8, .62, .42, .22][i]; return i < 3 ? circ(30, 30, r, '#FFFFFF', { op }) + circ(30, 30, r, 'none', { stroke: ink, sw: 2.5, op: .35 * op }) : circ(24, 32, r * .62, '#FFFFFF', { op }) + circ(38, 27, r * .5, '#FFFFFF', { op }) + circ(31, 40, r * .36, '#FFFFFF', { op }); },
      pierce: (i) => { const op = [1, .95, .8, .62, .42, .22][i]; return ell(30, 30, 27 - i * 1.5, 8.5 - i * 1.3, '#FFF3A6', { op }) + ell(34 - i, 30, 16 - i * 2, 4 - i * .6, '#FFFFFF', { op }); },
      dig: (i) => { const k = 1 - i * .13, op = i < 4 ? 1 : [.7, .4][i - 4]; const cl = (x, y, r, c) => g(path(`M${-r} 0 C${-r} ${-r * 1.1} ${r * .9} ${-r * 1.2} ${r} 0 C${r * .9} ${r * .9} ${-r * .8} ${r} ${-r} 0 Z`, c, { stroke: ink, sw: 3 }), `translate(${f(x)} ${f(y)})`); return g(cl(30 - i * 2.5, 24 + i * 3.2, 9 * k, DIRT) + cl(40 + i * 1.6, 30 + i * 4, 6 * k, '#B07A52') + cl(22 - i * .5, 36 + i * 2.4, 5 * k, '#7A4A2E'), '', op < 1 ? ` opacity="${op}"` : ''); },
      fire: (i) => { const k = 1 - i * .15; const fl = path('M30 46 C16 46 14 30 22 22 C24 28 27 28 28 24 C27 14 32 10 34 4 C42 14 48 26 46 36 C45 42 38 46 30 46 Z', C.fire, O(3)) + path('M30 43 C23 43 22 35 27 30 C29 34 31 33 31 30 C36 34 38 38 36 41 C35 43 33 43 30 43 Z', C.gold); return (i > 1 ? soft(30, 30 - i * 1.6, 4 + i * 2.2, SOOT, [0, 0, .5, .45, .35, .22][i]) : '') + (i < 5 ? scl(fl, k, k, 30, 40) : circ(30, 40, 3, C.gold, { op: .7 })); },
      mend: (i) => { const k = 1 - i * .14, op = [1, 1, .9, .75, .55, .3][i]; return g(scl(rr(26, 16, 8, 28, 3, C.heal, O(3, C.healD)) + rr(16, 26, 28, 8, 3, C.heal, O(3, C.healD)) + rr(27.5, 17.5, 5, 25, 2, C.heal), k, k, 30, 30) + rot(star4(46 - i, 14 + i, 7 - i * .6, '#EFFFF0', O(1.6, C.healD)), i * 20, 46 - i, 14 + i) + star4(12 + i, 46 - i * 1.5, 4, '#EFFFF0', O(1.4, C.healD)), '', op < 1 ? ` opacity="${op}"` : ''); },
    };
    const TW = { blast: 'Blast shots: soft white puff', pierce: 'Pierce shots: pale yellow streak. Turn it along the flight path', dig: 'Dig shots: dirt clods that drop away', fire: 'Fire shots: ember that burns down to soot', mend: 'Mend shots: green plus and sparkles' };
    for (const [n, fn] of Object.entries(TR)) {
      for (let i = 0; i < 6; i++) add(`fx_trail_${n}_${i}`, 'effects', 12, 12, [0, 0, 60, 60], fn(i), `Trail, ${TW[n]}. Frame ${i} of 6. The owner rim is drawn in code`);
      anim(`fx_trail_${n}`, seq(`fx_trail_${n}`, 6), 50, { note: 'One per puff. Emit a new one as the shell flies' });
    }
    // impact puffs per material (and dirt for the ground)
    const IC = { wicker: [C.wk, C.wkL], timber: [C.tb, C.tbL], cobble: [C.cb, C.cbL], footing: [C.ft, C.ftL], dirt: [DIRT, '#B07A52'] };
    const shard = ['M-9 -4 L6 -8 L10 5 L-4 9 Z', 'M-8 2 L0 -9 L9 0 L3 9 Z', 'M-7 -7 L8 -4 L6 7 L-8 5 Z'];
    for (const [m, cols] of Object.entries(IC)) {
      for (let i = 0; i < 4; i++) {
        let b = '';
        if (i === 0) b += circ(60, 60, 20, '#FFFFFF', { op: .9 }) + star4(60, 60, 30, '#FFF3C4', O(3, C.gold)) + circ(60, 60, 30, 'none', { stroke: DUSTL, sw: 5, op: .8 });
        else {
          const R = [0, 26, 41, 50][i], k = [0, 1, .8, .55][i], op = [0, .85, .55, .28][i];
          b += soft(60, 62, [0, 20, 27, 30][i], DUST, op);
          for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + .4 + (j % 2) * .25, rr2 = R * (j % 2 ? .82 : 1); b += g(path(shard[j % 3], cols[j % 2], O(3.5)), `translate(${f(60 + Math.cos(a) * rr2)} ${f(60 + Math.sin(a) * rr2 * .9 + i * i * 1.2)}) rotate(${j * 50 + i * 40}) scale(${k})`); }
        }
        add(`fx_impact_${m}_${i}`, 'effects', 24, 24, [0, 0, 120, 120], b, `Impact puff on ${m}, frame ${i} of 4: ${['flash', 'chips burst', 'chips spread, dust', 'fades'][i]}`);
      }
      anim(`fx_impact_${m}`, seq(`fx_impact_${m}`, 4), 60, { events: { flash: 0 } });
    }
    // water splash
    {
      const W = '#8FD0EA', WL = '#D6F1FA';
      const crown = (d) => path(d, W, O(4)) + clipped(path(d, '#000'), ell(64, 108, 30, 14, WL, { op: .8 }));
      const drop = (x, y, r) => circ(x, y, r, W, O(3)) + circ(x - r * .3, y - r * .3, r * .3, '#FFFFFF');
      const rip = (rx, op) => ell(64, 104, rx, 5, 'none', { stroke: '#FFFFFF', sw: 3.5, op }) + ell(64, 104, rx, 5, 'none', { stroke: ink, sw: 1.2, op: op * .4 });
      const fr = [
        crown('M44 104 C46 86 56 84 58 96 C60 78 68 78 70 96 C72 84 82 86 84 104 Z') + rip(26, .8),
        crown('M36 104 C38 70 50 60 54 84 C56 48 72 48 74 84 C78 60 90 70 92 104 Z') + drop(30, 62, 5) + drop(98, 58, 5) + drop(64, 34, 5.5) + rip(36, .8),
        crown('M28 104 C32 84 46 80 50 94 C56 74 72 74 78 94 C82 80 96 84 100 104 Z') + drop(22, 42, 4.5) + drop(106, 38, 4.5) + drop(64, 14, 4.5) + drop(44, 26, 3.5) + drop(86, 24, 3.5) + rip(46, .7),
        crown('M26 104 C42 93 86 93 102 104 Z') + drop(16, 64, 3.5) + drop(112, 62, 3.5) + drop(64, 40, 3.5) + rip(54, .6),
        rip(60, .45) + rip(34, .35) + drop(10, 90, 2.5) + drop(118, 88, 2.5),
      ];
      fr.forEach((b, i) => add(`fx_splash_${i}`, 'effects', 32, 28, [0, 0, 128, 112], b, `Water splash, frame ${i} of 5. Pale water blue, not a team blue. Anchor is on the water line`, { anchor: [16, 26] }));
      anim('fx_splash', seq('fx_splash', 5), 70, { events: { plop: 0 } });
    }
    // Rising Fizz bubble: wobbles, small bubbles fall behind so it reads as rising
    {
      const FZ = '#F4FFE0', FR = '#B5E36A';
      const bub = (rx, ry, i) => ell(30, 24, rx, ry, FZ, { stroke: ink, sw: 3, op: .92 }) + ell(30, 24, rx - 3.5, ry - 3.5, 'none', { stroke: FR, sw: 2.2 }) + path(`M${f(30 - rx * .55)} ${f(24 - ry * .1)} Q${f(30 - rx * .5)} ${f(24 - ry * .6)} ${f(30 - rx * .05)} ${f(24 - ry * .62)}`, 'none', { stroke: '#FFFFFF', sw: 3 }) +
        [0, 1, 2].map(j => { const t = ((i + j * 1.35) % 4) / 4; return circ(30 + [-8, 7, -1][j] + Math.sin(t * 6.3 + j) * 2, 44 + t * 30, 4.2 * (1 - t * .6), FZ, { stroke: ink, sw: 2, op: 1 - t * .7 }); }).join('');
      [[16, 14], [14.5, 15.5], [16, 14.5], [15, 15.5]].forEach(([rx, ry], i) => add(`fx_fizz_bubble_${i}`, 'effects', 12, 16, [0, 0, 60, 80], bub(rx, ry, i), `Rising Fizz bubble, frame ${i} of 4. It wobbles and sheds small bubbles below. Anchor is the bubble centre`, { anchor: [6, 4.8] }));
      anim('fx_fizz_bubble', seq('fx_fizz_bubble', 4), 90, { loop: true, note: 'The sim moves it up' });
      const pop = [
        ell(30, 24, 19, 18, 'none', { stroke: ink, sw: 3 }) + ell(30, 24, 19, 18, 'none', { stroke: FR, sw: 1.4 }) + star4(30, 24, 9, '#FFFFFF', O(1.5)),
        [0, 1, 2, 3, 4, 5].map(j => { const a = j * Math.PI / 3 + .3; return line(30 + Math.cos(a) * 12, 24 + Math.sin(a) * 12, 30 + Math.cos(a) * 19, 24 + Math.sin(a) * 19, ink, 3.5) + line(30 + Math.cos(a) * 12, 24 + Math.sin(a) * 12, 30 + Math.cos(a) * 19, 24 + Math.sin(a) * 19, FR, 1.4); }).join(''),
        [0, 1, 2, 3, 4, 5].map(j => { const a = j * Math.PI / 3 + .3; return circ(30 + Math.cos(a) * 23, 24 + Math.sin(a) * 19, 2.2, FZ, { stroke: ink, sw: 1.5, op: .7 }); }).join(''),
      ];
      pop.forEach((b, i) => add(`fx_fizz_pop_${i}`, 'effects', 12, 16, [0, 0, 60, 80], b, `Rising Fizz bubble pop, frame ${i} of 3`, { anchor: [6, 4.8] }));
      anim('fx_fizz_pop', seq('fx_fizz_pop', 3), 60, { events: { pop: 0 } });
    }
    // shimmer: the glint crosses the block on the diagonal
    [-64, -22, 22, 64].forEach((o, i) => add(`fx_shimmer_${i}`, 'effects', 16, 16, [0, 0, 100, 100],
      clipped(rr(0, 0, 100, 100, 10, '#000'), g(path('M-10 70 L70 -10 L96 -10 L-10 96 Z', '#FFFFFF', { op: .5 }) + path('M10 110 L110 10 L110 26 L26 110 Z', '#FFFFFF', { op: .3 }), `translate(${o} ${o})`)),
      `Shimmer glint for a block on weak support, frame ${i} of 4. Draw over the block at 30% opacity`, { anchor: [0, 0] }));
    anim('fx_shimmer', seq('fx_shimmer', 4), 80, { note: 'Play once every 3 s. Reduce motion: a still dotted outline in its place' });
    // Ghost dot pulse
    for (const [pn, shape] of [['p1', (r) => circ(40, 40, r, C.paper, O(9))], ['p2', (r) => path(`M40 ${40 - r * 1.2} L${40 + r * 1.2} 40 L40 ${40 + r * 1.2} L${40 - r * 1.2} 40 Z`, C.paper, O(9))]]) {
      const ring = (r, op) => pn === 'p1' ? circ(40, 40, r, 'none', { stroke: C.paper, sw: 4, op }) : path(`M40 ${40 - r * 1.2} L${40 + r * 1.2} 40 L40 ${40 + r * 1.2} L${40 - r * 1.2} 40 Z`, 'none', { stroke: C.paper, sw: 4, op });
      [[20, 0, 0], [22.5, 26, .7], [20, 30, .35]].forEach(([r, rr2, op], i) => add(`fx_ghost_dot_${pn}_pulse_${i}`, 'effects', 8, 8, [0, 0, 80, 80], (rr2 ? ring(rr2, op) : '') + shape(r),
        `Ghost dot pulse, ${pn === 'p1' ? 'player 1 (round)' : 'player 2 (diamond)'}, frame ${i} of 3. A ring grows from the dot`));
      anim(`fx_ghost_dot_${pn}_pulse`, seq(`fx_ghost_dot_${pn}_pulse`, 3), [140, 120, 160], { loop: true, note: 'Offset each dot along the arc by 60 ms so the pulse runs down the path' });
    }
    // Pin drop
    {
      const hi = (x, y, r) => circ(x, y, r, '#FFFFFF', { op: .55 });
      const pole = line(30, 96, 30, 40, ink, 9) + line(30, 94, 30, 40, C.steelL, 3.5);
      let dh = ''; for (let x = -6; x < 60; x += 10) dh += line(x, 50, x + 22, 2, '#FFFFFF', 3.5);
      const dia = 'M30 3 L53 26 L30 49 L7 26 Z';
      const PIN = { p1: () => pole + circ(30, 26, 20, C.you, O(7)) + hi(24, 19, 5), p2: () => pole + path(dia, C.rival, O(7)) + clipped(path(dia, '#000'), dh) + path(dia, 'none', O(7)) };
      for (const pn of ['p1', 'p2']) {
        const fr = [
          at(scl(PIN[pn](), .92, 1.1, 30, 96), 0, -34) + path('M12 -30 v-14 M48 -28 v-14 M30 -36 v-10', 'none', { stroke: ink, sw: 4, op: .5 }),
          scl(PIN[pn](), 1.1, .8, 30, 96) + path('M14 96 l-10 -5 M46 96 l10 -5', 'none', { stroke: ink, sw: 4 }),
          rot(scl(PIN[pn](), .94, 1.06, 30, 96), 4, 30, 96),
        ];
        fr.forEach((b, i) => add(`fx_pin_${pn}_drop_${i}`, 'effects', 12, 30, [0, -50, 60, 150], b, `Pin drop, ${pn === 'p1' ? 'player 1' : 'player 2'}, frame ${i} of 3: ${['falls', 'lands and squashes', 'springs and tips'][i]}. Anchor is the tip`, { anchor: [6, 29.5] }));
        anim(`fx_pin_${pn}_drop`, seq(`fx_pin_${pn}_drop`, 3), [70, 70, 90], { events: { stick: 1 }, hold: `fx_pin_${pn}` });
      }
    }
    // wind leaves: one leaf tumbles
    [[50, 1], [140, .5], [230, 1], [320, .5]].forEach(([a, k], i) => add(`fx_wind_leaf_${i}`, 'effects', 12, 12, [0, 0, 48, 48],
      g(path('M0 18 C-14 6 -12 -12 0 -20 C12 -12 14 6 0 18 Z', i % 2 ? '#7CC46A' : '#8BCB3A', O(3.5)) + line(0, 14, 0, -12, ink, 2), `translate(24 24) rotate(${a}) scale(${k} 1)`),
      `Wind leaf, tumble frame ${i} of 4. Blow it across the field with the wind`));
    anim('fx_wind_leaf', seq('fx_wind_leaf', 4), 110, { loop: true });
    // Sudden Squall: cloud and slanted rain
    for (let i = 0; i < 6; i++) {
      const bob = Math.sin(i / 6 * Math.PI * 2) * 2, cd = L.cloudD(48, 32, 24);
      let rain = '';
      for (let j = 0; j < 8; j++) {
        const t = ((i / 6) + j * .37) % 1, x = 21 + j * 9 + (j % 2) * 3 - t * 14, y = 44 + t * 40;
        if (y > 86) continue;
        rain += line(x, y, x - 4, y + 10, ink, 4.5) + line(x, y, x - 4, y + 10, '#DCE6F2', 2);
      }
      const cloud = path(cd, C.slate, O(3.5)) + clipped(path(cd, '#000'), ell(54, 46, 34, 10, ink, { op: .2 }) + path('M30 26 Q36 14 48 13', 'none', { stroke: '#FFFFFF', sw: 3.5, op: .5 }));
      add(`fx_squall_${i}`, 'effects', 48, 48, [0, 0, 96, 96], rain + at(scl(cloud, 1 + (i % 2) * .03, 1 - (i % 2) * .03, 48, 32), 0, bob), `Sudden Squall cloud and rain, frame ${i} of 6. The rain leans with the wind. Flip it when the wind blows the other way`);
    }
    anim('fx_squall', seq('fx_squall', 6), 90, { loop: true });
  }

  // ================================================================ 5. UI motion
  {
    // Fire button press
    const btn = (off, face, k, glint = false) => {
      const r = 37, lip = 5, cy = r + 3 + off;
      return circ(r + 3, r + 3 + lip, r, C.saffronD, O(3)) + circ(r + 3, cy, r, face, O(3)) +
        clipped(circ(r + 3, cy, r - 1.5, '#000'), ell(r + 3, cy - r * .62, r * .78, r * .36, '#FFFFFF', { op: glint ? .5 : .3 })) + g(shared.boomIcon, `translate(${r + 3} ${cy}) scale(${k})`);
    };
    const fr = [btn(2.5, C.saffron, .97), btn(4.5, C.saffronD, .9), btn(-1, C.saffronL, 1.12, true)];
    fr.forEach((b, i) => add(`ui_fire_press_${i}`, 'ui', 80, 86, [0, 0, 80, 86], b, `Fire button press, frame ${i} of 3: ${['going down', 'fully down', 'springs back up, bright'][i]}`, { anchor: [40, 40] }));
    anim('ui_fire_press', seq('ui_fire_press', 3), [40, 70, 90], { events: { fire: 1 }, hold: 'ui_fire' });
    // Pennant earned: the flag flips from empty to gold and shines
    const pole = line(8, 50, 8, 5, ink, 4.5) + circ(8, 5, 3.5, C.br, O(2));
    const flag = (k, fill) => g(path('M0 9 L28 9 L20 18 L28 27 L0 27 Z', fill, O(3)), `translate(8 0) scale(${k} 1)`);
    const pf = [
      flag(.55, '#E6DCC8'),
      rr(6.5, 8, 4, 20, 2, C.goldD, O(2.5)),
      flag(.6, C.gold),
      flag(1.06, C.gold) + clipped(g(path('M0 9 L28 9 L20 18 L28 27 L0 27 Z', '#000'), 'translate(8 0) scale(1.06 1)'), path('M14 30 L26 6 L33 6 L21 30 Z', '#FFFFFF', { op: .75 })),
      flag(1, C.gold) + line(12, 13.5, 24, 13.5, '#FFFFFF', 2.5, { op: .6 }) + star4(31, 9, 6.5, '#FFFFFF', O(1.6)) + star4(21, 31, 3.5, '#FFFFFF', O(1.2)),
    ];
    pf.forEach((b, i) => add(`ui_pennant_earn_${i}`, 'ui', 20, 27, [0, 0, 40, 54], (i === 1 ? b + pole : pole + b), `Pennant earned, frame ${i} of 5: ${['empty flag turns', 'edge on', 'gold side turns in', 'gold, wide, shine crosses', 'gold with a sparkle'][i]}`));
    anim('ui_pennant_earn', seq('ui_pennant_earn', 5), [60, 50, 60, 90, 160], { events: { ding: 2 }, hold: 'ui_pennant' });
    // Button coin spin
    [1, .72, .32, .08, .32, .72].forEach((k, i) => {
      const sgn = i < 3 ? 1 : -1, off = (1 - k) * 3.5 * sgn;
      let b;
      if (i === 3) b = rr(21.5, 3, 5, 43, 2.5, C.saffronD, O(3)) + line(24, 8, 24, 41, C.saffron, 1.2);
      else {
        const holes = [[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([x, y]) => ell(24 - off + x * k, 23 + y, 2.6 * Math.max(k, .45), 2.6, ink)).join('');
        b = ell(24, 26, 20 * k, 20, C.saffronD, O(3)) + (k < 1 ? ell(24 + off, 23, 20 * k, 20, C.saffronD, O(3)) : '') + ell(24 - off, 23, 20 * k, 20, C.saffron, O(3)) + ell(24 - off, 23, 13.5 * k, 13.5, 'none', { stroke: C.saffronD, sw: 2.5 }) + holes +
          (i === 0 ? path('M10 16 Q14 8 22 6', 'none', { stroke: '#FFFFFF', sw: 3, op: .6 }) : line(24 - off - 12 * k * sgn, 10, 24 - off - 14 * k * sgn, 20, '#FFFFFF', 2.5, { op: .6 }));
      }
      add(`ui_button_coin_spin_${i}`, 'ui', 24, 24, [0, 0, 48, 48], b, `Button coin spin, frame ${i} of 6${i === 3 ? ': edge on' : ''}`);
    });
    anim('ui_button_coin_spin', seq('ui_button_coin_spin', 6), 70, { loop: true, note: 'For coins that fly to the purse and for the reward card' });
    // hand-off card flip: player 1 face turns to player 2 face
    const face = (p) => {
      let b = rr(8, 10, 48, 68, 8, ink, { op: .2 }) + rr(8, 7, 48, 68, 8, C.paper, O(3)) + rr(12.5, 11.5, 39, 59, 5, 'none', { stroke: C.saffronD, sw: 1.6, op: .6, extra: ' stroke-dasharray="4 4"' });
      if (p === 1) b += circ(32, 33, 13, C.you, O(3)) + circ(32, 33, 7.5, 'none', { stroke: '#FFFFFF', sw: 2.2, op: .8 });
      else { const d = 'M32 18 L47 33 L32 48 L17 33 Z'; let h = ''; for (let x = 10; x < 56; x += 6) h += line(x, 50, x + 12, 16, '#FFFFFF', 2); b += path(d, C.rival, O(3)) + clipped(path(d, '#000'), h) + path(d, 'none', O(3)); }
      // pass arrow: no words
      b += path('M20 60 H38 V55 L46 62 L38 69 V64 H20 Z', C.saffron, O(2.5));
      return b;
    };
    const hf = [[1, 1, 1], [1, .42, 1.04], [2, .42, 1.04], [2, 1, 1]];
    hf.forEach(([p, k, ky], i) => add(`ui_handoff_flip_${i}`, 'ui', 64, 84, [0, 0, 64, 84], scl(face(p), k, ky, 32, 42) + (k < 1 ? scl(rr(8, 7, 48, 68, 8, ink, { op: .14 }), k, ky, 32, 42) : ''),
      `Hand-off card flip, frame ${i} of 4: ${['player 1 face', 'player 1 face turns away', 'player 2 face turns in', 'player 2 face'][i]}. No text baked in`));
    anim('ui_handoff_flip', seq('ui_handoff_flip', 4), [120, 70, 70, 140], { events: { swap: 2 }, note: 'Player 1 to player 2. Play backwards for player 2 to player 1' });
  }

  // ================================================================ data: motion with no frames
  // tracks: property -> [[time ms, value], ...]. Go in a straight line from key to key.
  const data = {
    fort_bob: {
      about: 'Fort body offset for each Stomper walk frame. dy is px at @1x (down is plus), tilt is degrees about the fort base centre. Add it to the fort body and all on it, not to the legs',
      frame_ms: 110, dy: [1, -1, 0, 1, -1, 0], tilt: [.5, .2, -.3, -.5, -.2, .3],
      stomp_frames: [0, 3], note: 'Legs come in two sets, 3 frames apart, so a boot lands on frames 0 and 3. Play a dust puff and the step sound there. Reduce motion: dy and tilt are 0',
    },
    collapse: {
      about: 'Collapse beats from 06 section 6.3. View only. The sim has already dropped the blocks',
      creak: { ms: 300, shiver_x: [[0, 0], [50, 1], [100, -1], [150, 1], [200, -1], [250, 1], [300, 0]], crack: 'fx_crack_{material}', note: 'px at @1x. Play the crack overlay over each block that will fall' },
      wobble_deg: { about: 'Creak wobble before the lean, by material. Turn about the block base centre', wicker: [[0, 0], [60, 1.5], [120, -1.5], [180, 1], [240, -1], [300, 0]], timber: [[0, 0], [60, 1], [120, -1], [180, .6], [240, -.6], [300, 0]], cobble: [[0, 0], [60, .5], [120, -.5], [180, .3], [240, -.3], [300, 0]], footing: [[0, 0], [300, 0]] },
      lean: { ms: 150, deg: { wicker: 6, timber: 5, cobble: 3, footing: 0 }, track: [[0, 0], [100, .8], [150, 1]], note: 'Tip the chunk toward the side with no support. Turn about the lower corner on the held side. Value = deg x track' },
      drop: { row_gap_ms: 40, order: 'bottom row first, top row last', sway_deg: { wicker: 4, timber: 1.5, cobble: 0, footing: 0 }, note: 'Wicker flutters as it falls: swing by sway_deg, 200 ms each way' },
      land: { squash_y: [[0, 1], [60, .9], [140, 1.03], [200, 1]], skid_px: { wicker: 0, timber: 0, cobble: 2, footing: 0 }, dust: 'fx_dustcloud', note: 'Squash about the base. Hit stop 50 ms if 3 or more blocks break' },
      break: { ms: 300, chunks_per_block: { wicker: 3, timber: 3, cobble: 4, footing: 2 }, chunk: 'fx_chunk_{material}', rubble: 'fx_rubble_{material}', rubble_hold_ms: 1500, dust_scale: { wicker: .6, timber: .8, cobble: 1.2, footing: 1 } },
    },
    turn_banner: {
      about: 'Turn banner slide. y is pt from its rest place (up is minus). The banner never blocks taps',
      in: { y: [[0, -64], [160, 5], [220, -2], [280, 0]], opacity: [[0, 0], [120, 1]] },
      hold_ms: 1200,
      out: { y: [[0, 0], [60, 4], [220, -64]], opacity: [[0, 1], [140, 1], [220, 0]] },
      reduce_motion: { in: { opacity: [[0, 0], [150, 1]] }, out: { opacity: [[0, 1], [150, 0]] } },
    },
    hand_off_card: { about: 'Scale for the card as it shows, on top of ui_handoff_flip', in: { scale: [[0, .8], [120, 1.06], [200, 1]], opacity: [[0, 0], [100, 1]] } },
  };

  // ================================================================ write animations.json text
  const head = {
    version: 1,
    about: 'Castle Protect animation list. Made by tools/art-gen/gen-sprites.mjs. Do not edit by hand. See assets/README.md',
    fields: {
      frames: 'Sprite names from manifest.json, in play order. The order here is the truth, not the number in the name',
      ms: 'Time for each frame in ms. Same count as frames',
      loop: 'true: go round again at the end. false: play once',
      loop_from: 'Only with loop. Frames before this index play once, then the loop runs from this index',
      w_h_anchor: 'Size and anchor of every frame, px at @1x from the top left. All frames of one animation share them',
      events: 'Name -> frame index. The event fires when that frame first shows',
      next: 'Animation to start when a play-once animation ends',
      hold: 'Sprite to show when a play-once animation ends',
      pick: 'This is a set of poses, not a timed clip. Choose the frame by the named value',
    },
  };
  const keys = Object.keys(A);
  let json = '{\n';
  for (const [k, v] of Object.entries(head)) json += ` ${JSON.stringify(k)}: ${JSON.stringify(v, null, 1).replace(/\n/g, '\n ')},\n`;
  json += ` "count": ${keys.length},\n "animations": {\n`;
  json += keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(A[k])}`).join(',\n');
  json += '\n },\n "data": {\n';
  json += Object.entries(data).map(([k, v]) => `  ${JSON.stringify(k)}: {\n` + Object.entries(v).map(([k2, v2]) => `   ${JSON.stringify(k2)}: ${JSON.stringify(v2)}`).join(',\n') + '\n  }').join(',\n');
  json += '\n }\n}\n';
  JSON.parse(json);
  return { animations: A, data, json };
}
