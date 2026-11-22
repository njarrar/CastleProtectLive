// Biomes, VFX, UI mockups, palette sheet
import fs from 'fs';
import * as L from './lib.mjs';
import * as S from './scene.mjs';
const { C, doc, text, rr, circ, ell, path, line, g, block, hob, flattener, kettle, fort, stomper, stitch, star4, puff, burst, classIcon, f, button, panel, pennant, buttonCoin, windArrow } = L;
const ART = '/home/user/CastleProtect/docs/art';
const out = (name, svg) => { fs.writeFileSync(`${ART}/${name}`, svg); console.log('wrote', name); };
const BODY = L.BODY;
const small = (x, y, t, o = {}) => text(x, y, t, { size: 15, weight: 600, fill: C.ink2, family: BODY, ...o });

// ================================================================ 14 biomes
export const BIOMES = [
  { k: 0, name: 'Puddingstone Downs', tag: 'Region 1. Grass hills, hedges, streams. Wind 0 to 3', pal: ['#9ED8EC', '#7CC46A', '#FFE08A', '#D9483B', '#C9A27A'] },
  { k: 1, name: 'Crumblecrag', tag: 'Region 2. Slate cliffs, rust bands, ochre clay. Wind 0 to 5', pal: ['#D6E2EA', '#8E96A0', '#A8502E', '#D9A441', '#9DB35A'] },
  { k: 2, name: 'Soggybottom Fen', tag: 'Region 3. Marsh, ponds, mud, reeds. Wind 0 to 4', pal: ['#BFD9C8', '#5FA8A0', '#6E5A3E', '#C9A84A', '#E27FA0'] },
  { k: 5, name: 'The Flats', tag: 'Region 4. Pressed plate, hills in chains. Wind 0 to 6', pal: ['#DCD6E4', '#A8ABB2', '#F2EEE6', '#F2C200', '#7CC46A'] },
  { k: 3, name: 'Frostwhisker Peaks', tag: 'Region 5. Ice, snow, strong wind', pal: ['#8FC6EE', '#F4FAFF', '#9FD8EE', '#3F6E73', '#FFC857'], up: 'Update 2' },
  { k: 4, name: 'Clankmouth Mines', tag: 'Region 6. Caves, rails, lava seams', pal: ['#1E222B', '#4A4440', '#FFC857', '#E5402A', '#E0AE3E'], up: 'Update 3' },
];

function biome(i, W, H) {
  const R = L.rng(i * 7 + 3);
  let s = '', defs = '';
  const sk = (a, b) => { const k = S.sky(W, H, a, b); defs += k.defs; s += k.body; };
  const gr = (tops, o) => S.ground(-10, W + 10, H + 10, tops, o);
  if (i === 0) {
    sk('#9ED8EC', '#FFF1D0');
    s += puff(110, 60, 22) + puff(420, 80, 16);
    s += S.quiltHill(-10, W + 10, H, [[0, 190], [140, 150], [300, 200], [460, 140], [580, 180]], '#B7DDA8', { patches: [L.patch(150, 200, 90, 60, -6, '#C6E5B5'), L.patch(450, 190, 100, 60, 5, '#A9D69A')] });
    s += S.tree(380, 210, .8, '#6DB55E') + S.tree(410, 214, .6, '#5AA555');
    s += gr([[0, 250], [160, 230], [320, 262], [480, 235], [580, 250]], { seed: 2 });
    for (const [x, y, r] of [[110, 236, 20], [140, 244, 13], [500, 232, 16]]) s += ell(x, y, r * 1.2, r, '#C9A27A', { stroke: C.ink, sw: 2.5 }) + circ(x - r * .3, y - r * .2, 2.5, '#6A3A28') + circ(x + r * .4, y + r * .1, 2.5, '#6A3A28') + circ(x, y - r * .5, 2, '#6A3A28');
    s += S.windFlag(260, 252, .5, 2);
    for (const [x, y] of [[60, 262], [210, 250], [420, 252], [560, 254]]) s += circ(x, y, 4, '#FFE08A', { stroke: C.ink, sw: 1.2 }) + circ(x + 9, y + 3, 3.5, '#D9483B', { stroke: C.ink, sw: 1.2 });
    s += rr(330, 226, 46, 22, 11, '#5AA555', { stroke: C.ink, sw: 2.5 }) + path('M336 232 l6 0 M350 230 l6 0 M362 234 l6 0', 'none', { stroke: '#8BCB3A', sw: 2 });
  } else if (i === 1) {
    sk('#D6E2EA', '#F7F9FA');
    s += S.sunDisc(470, 70, 30, '#FFFFFF');
    s += path('M-10 320 L-10 150 L60 150 L80 120 L180 120 L190 150 L230 150 L240 320 Z', '#B9C0C8', { stroke: C.ink, sw: 3 });
    s += path('M360 320 L370 110 L460 100 L470 130 L590 130 L590 320 Z', '#B9C0C8', { stroke: C.ink, sw: 3 });
    // near cliffs with strata and an overhang
    const cl = 'M-10 330 L-10 210 L150 200 L190 214 L200 250 L160 262 L170 330 Z';
    s += L.clipped(path(cl, '#000'), rr(-10, 190, 220, 150, 0, '#8E96A0') + rr(-10, 236, 220, 16, 0, '#A8502E') + rr(-10, 276, 220, 20, 0, '#D9A441') + stitch('M-10 225 L200 225', C.ink, 2, .25)) + path(cl, 'none', { stroke: C.ink, sw: 3 });
    const cr = 'M590 330 L590 180 L420 190 L390 214 L400 330 Z';
    s += L.clipped(path(cr, '#000'), rr(380, 170, 220, 170, 0, '#8E96A0') + rr(380, 226, 220, 16, 0, '#A8502E') + rr(380, 270, 220, 22, 0, '#D9A441') + stitch('M390 206 L590 206', C.ink, 2, .25)) + path(cr, 'none', { stroke: C.ink, sw: 3 });
    s += path('M150 330 L170 296 Q290 280 400 300 L410 330 Z', '#6E757E', { stroke: C.ink, sw: 3 }) + path('M190 306 Q290 296 390 310', 'none', { stroke: '#A8502E', sw: 3, dash: '10 8' });
    s += path('M200 250 Q290 300 395 220', 'none', { stroke: '#7A4A2E', sw: 4 }) + path('M200 250 Q290 300 395 220', 'none', { stroke: '#C9A27A', sw: 2, dash: '4 8' });
    s += circ(60, 196, 12, '#9DB35A', { stroke: C.ink, sw: 2.5 }) + circ(500, 180, 10, '#9DB35A', { stroke: C.ink, sw: 2.5 }) + g(path('M-10 0 Q-8 -14 4 -12 Q12 -10 12 0 Z', '#FFFFFF', { stroke: C.ink, sw: 2 }) + line(-6, 0, -6, 6, C.ink, 2) + line(6, 0, 6, 6, C.ink, 2) + circ(12, -10, 4, '#FFFFFF', { stroke: C.ink, sw: 1.5 }), 'translate(120 192)');
  } else if (i === 2) {
    sk('#BFD9C8', '#F1F4E2');
    s += S.quiltHill(-10, W + 10, H, [[0, 170], [200, 150], [400, 180], [580, 160]], '#A9C8A0', {});
    s += ell(300, 150, 280, 16, '#FFFFFF', { op: .45 });
    s += S.tree(90, 200, .9, '#6F9A5A') + S.tree(470, 196, .8, '#6F9A5A');
    s += gr([[0, 230], [120, 240], [200, 280], [380, 285], [470, 236], [580, 228]], { seed: 4, grass: '#8FAE4A', grassD: '#6F8E3A', loam: '#6E5A3E', loamD: '#55452E' });
    s += path('M150 268 Q290 300 420 268 L430 330 L140 330 Z', '#5FA8A0', { stroke: C.ink, sw: 3 }) + path('M180 282 L230 282 M300 292 L360 292 M250 302 L280 302', 'none', { stroke: '#FFFFFF', sw: 3, op: .7 });
    s += ell(260, 284, 18, 6, '#6FBF6A', { stroke: C.ink, sw: 2 }) + circ(262, 280, 5, '#E27FA0', { stroke: C.ink, sw: 1.5 });
    for (let k = 0; k < 7; k++) { const x = 130 + k * 8 + (k > 3 ? 300 : 0); s += path(`M${x} 270 Q${x + 4} 236 ${x + 2} 222`, 'none', { stroke: '#6F8E3A', sw: 3 }) + ell(x + 2, 224, 3, 8, '#8A5A3A', { stroke: C.ink, sw: 1.5 }); }
  } else if (i === 3) {
    sk('#8FC6EE', '#EAF6FF');
    s += path('M-10 230 L90 70 L150 140 L230 40 L330 170 L410 80 L520 200 L590 120 L590 330 L-10 330 Z', '#DDEBF8', { stroke: C.ink, sw: 3 });
    s += path('M90 70 L120 110 L100 120 L80 100 Z M230 40 L265 92 L240 98 L215 70 Z M410 80 L440 116 L420 122 L398 100 Z', '#FFFFFF', { stroke: C.ink, sw: 2 });
    s += path('M230 40 L330 170 L250 170 Z', '#B9D3EC', { op: .8 });
    s += gr([[0, 250], [140, 228], [300, 254], [440, 226], [580, 244]], { seed: 6, grass: '#F4FAFF', grassD: '#CFE3F2', loam: '#6F7E9A', loamD: '#56637C', rock: '#4E5A72', pebble: '#9FD8EE' });
    s += path('M330 250 L470 236 L480 248 L340 262 Z', '#9FD8EE', { stroke: C.ink, sw: 2.5 }) + line(350, 252, 400, 247, '#FFFFFF', 2.5);
    s += S.tree(80, 240, .8, '#3F6E73', 'pine') + S.tree(110, 236, .6, '#3F6E73', 'pine') + S.tree(520, 236, .7, '#3F6E73', 'pine');
    for (let k = 0; k < 5; k++) s += path(`M${60 + k * 100} ${60 + k * 22} l70 0`, 'none', { stroke: '#FFFFFF', sw: 3, op: .8 });
    s += S.windFlag(200, 240, .55, 9);
  } else if (i === 4) {
    sk('#1E222B', '#3A3A44');
    s += path('M-10 330 L-10 0 L590 0 L590 330 L520 330 C520 150 420 90 300 90 C180 90 80 150 80 330 Z', '#4A4440', { stroke: C.ink, sw: 3 });
    for (let k = 0; k < 10; k++) s += ell(R() * W, R() * 80 + 10, 12 + R() * 14, 6 + R() * 6, '#5E5650', { op: .7 });
    s += path('M40 60 L40 220 M40 60 L200 60', 'none', { stroke: C.ink, sw: 12 }) + path('M40 60 L40 220 M40 60 L200 60', 'none', { stroke: C.br, sw: 7 }) + circ(40, 60, 10, C.brD, { stroke: C.ink, sw: 2.5 });
    s += gr([[0, 260], [200, 250], [400, 262], [580, 250]], { seed: 8, grass: '#8C7A5A', grassD: '#6E5E44', loam: '#4A4440', loamD: '#3A3532', rock: '#2A2E38', pebble: '#E0AE3E' });
    s += path('M-10 318 C80 300 160 326 260 310 S420 322 600 306 L600 340 L-10 340 Z', '#E5402A', { stroke: C.ink, sw: 2.5 }) + path('M20 318 C80 308 140 324 220 314', 'none', { stroke: '#FFC857', sw: 3 });
    s += line(90, 258, 500, 258, '#8C93A8', 4) + line(90, 266, 500, 266, '#8C93A8', 4);
    for (let k = 0; k < 14; k++) s += rr(96 + k * 29, 254, 8, 16, 2, '#7A4A2E');
    s += rr(260, 226, 60, 30, 6, '#7A6A5E', { stroke: C.ink, sw: 2.5 }) + circ(272, 258, 7, '#3A3236', { stroke: C.ink, sw: 2 }) + circ(308, 258, 7, '#3A3236', { stroke: C.ink, sw: 2 }) + ell(290, 226, 26, 8, '#E0AE3E', { stroke: C.ink, sw: 2 });
    for (const [x, y] of [[160, 120], [430, 110]]) s += circ(x, y, 30, '#FFC857', { op: .25 }) + line(x, y - 30, x, y - 14, C.ink, 2) + rr(x - 8, y - 14, 16, 22, 4, '#FFC857', { stroke: C.ink, sw: 2.5 });
  } else {
    sk('#DCD6E4', '#F7F4F0');
    s += rr(-10, 150, W + 20, 30, 0, '#CFC8C0', { stroke: C.ink, sw: 2 });
    for (let k = 0; k < 4; k++) s += line(60 + k * 150, 70, 60 + k * 150, 152, C.ink, 3) + rr(60 + k * 150, 70, 38, 24, 2, '#A8ABB2', { stroke: C.ink, sw: 2.5 }) + line(66 + k * 150, 82, 92 + k * 150, 82, C.ink, 2) + circ(79 + k * 150, 82, 2.5, C.good);
    s += line(320, 0, 320, 40, C.ink, 2) + line(380, 0, 380, 40, C.ink, 2) + path('M300 60 Q350 20 400 60 Z', '#9A6440', { stroke: C.ink, sw: 2.5 }) + path('M300 60 Q350 20 400 60', 'none', { stroke: '#7CC46A', sw: 6 }) + line(320, 40, 310, 58, C.ink, 2) + line(380, 40, 390, 58, C.ink, 2);
    // flat ground with roller stripes
    s += rr(-10, 240, W + 20, 100, 0, '#A8ABB2', { stroke: C.ink, sw: 3 });
    for (let k = 0; k < 12; k++) s += rr(-10 + k * 52, 244, 26, 96, 0, '#969AA2', { op: .55 }) + circ(10 + k * 52, 300, 2.5, '#6E727A');
    for (let k = 0; k < 20; k++) s += path(`M${k * 30} 240 l14 0 l-8 8 l-14 0 Z`, '#F2C200');
    s += rr(-10, 180, W + 20, 60, 0, '#E1DED8');
    s += line(-10, 240, W + 10, 240, C.ink, 3);
    s += g(flattener('smoothie', 0, 0, .9), 'translate(470 240)');
    // the lump that fights back
    s += path('M120 241 Q170 200 220 241 Z', '#7CC46A', { stroke: C.ink, sw: 3 }) + path('M170 214 Q166 196 174 186 M172 200 Q182 192 188 196', 'none', { stroke: '#5AA555', sw: 3 });
    s += star4(170, 182, 6, C.gold, { stroke: C.ink, sw: 1.5 });
  }
  return { s, defs };
}
{
  const PW = 580, PH = 330, W = 1880, H = 1020;
  let s = rr(0, 0, W, H, 0, C.paper) + rr(0, 0, W, H, 0, 'url(#paperDots)');
  let defs = '';
  s += text(40, 64, 'Brickabrac: four regions at launch, two wings to come', { size: 40, weight: 700 }) + small(40, 94, 'Launch: Downs, Crag, Fen, Flats. Then the Peaks (Update 2) and the Mines (Update 3). No background prop is orange, blue, teal or gold.', { size: 18 });
  BIOMES.forEach((b, i) => {
    const x = 40 + (i % 3) * (PW + 30), y = 120 + Math.floor(i / 3) * (PH + 120);
    const r = biome(b.k, PW, PH); defs += r.defs;
    s += L.clipped(rr(x, y, PW, PH, 18, '#000'), g(r.s, `translate(${x} ${y})`)) + rr(x, y, PW, PH, 18, 'none', { stroke: C.ink, sw: 3.5 });
    s += text(x, y + PH + 34, b.name, { size: 24, weight: 700 }) + small(x, y + PH + 58, b.tag);
    s += b.up ? g(rr(-64, -19, 128, 38, 19, C.ink2, { stroke: C.ink, sw: 2.5 }) + text(0, 8, b.up, { size: 21, weight: 700, anchor: 'middle', fill: C.paper }), `translate(${x + PW - 84} ${y + 34}) rotate(3)`) : g(rr(-46, -15, 92, 30, 15, C.paper, { stroke: C.ink, sw: 2.5 }) + text(0, 6.5, 'Launch', { size: 17, weight: 700, anchor: 'middle' }), `translate(${x + PW - 64} ${y + 30})`);
    s += b.up ? g(rr(-64, -19, 128, 38, 19, C.ink2, { stroke: C.ink, sw: 2.5 }) + text(0, 8, b.up, { size: 21, weight: 700, anchor: 'middle', fill: C.paper }), `translate(${x + PW - 84} ${y + 34}) rotate(3)`) : g(rr(-46, -15, 92, 30, 15, C.paper, { stroke: C.ink, sw: 2.5 }) + text(0, 6.5, 'Launch', { size: 17, weight: 700, anchor: 'middle' }), `translate(${x + PW - 64} ${y + 30})`);
    s += b.up ? g(rr(-64, -19, 128, 38, 19, C.ink2, { stroke: C.ink, sw: 2.5 }) + text(0, 8, b.up, { size: 21, weight: 700, anchor: 'middle', fill: C.paper }), `translate(${x + PW - 84} ${y + 34}) rotate(3)`) : g(rr(-46, -15, 92, 30, 15, C.paper, { stroke: C.ink, sw: 2.5 }) + text(0, 6.5, 'Launch', { size: 17, weight: 700, anchor: 'middle' }), `translate(${x + PW - 64} ${y + 30})`);
    b.pal.forEach((h, k) => s += rr(x + PW - 5 * 34 + k * 34, y + PH + 16, 28, 28, 7, h, { stroke: C.ink, sw: 2 }));
  });
  out('14-biomes.svg', doc(W, H, s, { title: 'Region biomes', desc: 'Four launch regions and two update regions, with palettes', defs }));
}

// ================================================================ 15 shots and VFX
{
  const W = 1860, H = 1130, PW = 340, PH = 400;
  let s = rr(0, 0, W, H, 0, C.paper) + rr(0, 0, W, H, 0, 'url(#paperDots)');
  s += text(40, 64, 'Shots and effects', { size: 40, weight: 700 }) + small(40, 94, 'Shot names follow 01-weapons. The fill is the damage type; a thin rim shows the owner. Fire is ember red with a gold core. Nothing is orange or team blue.', { size: 18 });
  const P = [
    ['Clodpot', 'Lobber Plain Shot. Blast', 'lobber'], ['Hatpin', 'Zinger Plain Shot. Pierce', 'zinger'], ['Gravel Sneeze', 'Scatterjack. Three stones', 'scatter'],
    ['Nibbler', 'Delver. Dig, leaves a tunnel', 'delver'], ['Bouncebean', 'Boinker. Two hops, then pop', 'boinker'], ['Emberpot', 'Sizzler. Fire, Ember patch', 'sizzler'],
    ['Snowglobe', 'Frost shell. Brittle', 'sizzler', 'U2'], ['Static Sock', 'Zap shell. Chains on brass', 'scatter', 'U3'], ['Mendglob', 'Patcher. Mends your block', 'patcher'], ['Peep Pip', 'Peeper. Reveals a Nook', 'peeper', 'U2'],
  ];
  P.forEach(([n, d, cls, up], i) => {
    const x = 40 + (i % 5) * (PW + 16), y = 120 + Math.floor(i / 5) * (PH + 30);
    let p = rr(0, 0, PW, PH, 16, '#DDF0F7') + rr(0, 300, PW, 100, 0, '#9A6440') + rr(0, 296, PW, 12, 0, '#7CC46A') + rr(0, 350, PW, 50, 0, '#7A4A2E', { op: .6 }) + stitch('M0 330 L340 330', C.ink, 2, .2, '8 8') + ell(60, 340, 8, 5, '#C9A27A', { op: .6 }) + ell(250, 372, 10, 6, '#C9A27A', { op: .6 }) + ell(160, 318, 6, 4, '#C9A27A', { op: .6 });
    const gx = 230, gy = 296;
    switch (i) {
      case 0: {
        for (let k = 0; k < 6; k++) p += circ(30 + k * 26, 230 - k * 30 + k * k * 3.5, 4, '#FFFFFF', { stroke: C.ink, sw: 1.5 });
        p += S.shellPot(110, 110, 1.3, 20);
        p += block('timber', gx - 30, gy - 60, 60, 2, 3);
        p += burst(gx, gy - 50, 70, 42, 9, C.gold, { sw: 3 }) + burst(gx, gy - 50, 44, 26, 9, '#FFF3C4', { sw: 2.5, rot: .35 });
        p += puff(gx - 60, gy - 120, 18, '#5A4E52', { op: .85 }) + puff(gx + 50, gy - 112, 14, '#5A4E52', { op: .85 });
        p += g(rr(-10, -6, 20, 12, 3, C.tb, { stroke: C.ink, sw: 2 }), `translate(${gx - 80} ${gy - 150}) rotate(30)`) + g(rr(-8, -5, 16, 10, 3, C.tbL, { stroke: C.ink, sw: 2 }), `translate(${gx + 74} ${gy - 160}) rotate(-20)`);
        p += text(gx + 10, gy - 168, '-35', { size: 34, weight: 700, fill: C.paper, stroke: C.ink, sw: 7, anchor: 'middle' });
        break;
      }
      case 1: {
        p += path('M20 180 L200 150', 'none', { stroke: '#FFFFFF', sw: 14, op: .8 }) + path('M60 174 L200 150', 'none', { stroke: '#FFF3A6', sw: 6 });
        p += path('M150 158 L232 146', 'none', { stroke: C.ink, sw: 6 }) + path('M150 158 L232 146', 'none', { stroke: C.steelL, sw: 3 }) + circ(150, 158, 6, '#FFFFFF', { stroke: C.ink, sw: 2 });
        p += block('cobble', 240, 120, 60, 1, 4);
        p += circ(270, 150, 10, C.cbH, { stroke: C.ink, sw: 2 });
        for (let k = 0; k < 6; k++) { const a = -0.9 + k * .35; p += line(310 + Math.cos(a) * 4, 150 + Math.sin(a) * 4, 310 + Math.cos(a) * 26, 150 + Math.sin(a) * 26, '#FFF3A6', 3.5); }
        p += small(20, 250, 'Flat, fast. Threads Loopholes.');
        p += small(20, 272, 'Hits the first thing in its path.');
        break;
      }
      case 2: {
        p += path('M20 240 Q80 150 140 130', 'none', { stroke: C.ink, sw: 2, dash: '2 8' });
        p += circ(140, 130, 22, 'none', { stroke: C.scatter, sw: 4 }) + star4(140, 130, 12, '#FFFFFF', { stroke: C.ink, sw: 1.5 });
        for (const [dx, dy] of [[70, 0], [80, 30], [60, 60]]) {
          p += path(`M140 130 Q${140 + dx * .6} ${130 + dy * .2 - 20} ${140 + dx * 1.4} ${130 + dy * 1.8}`, 'none', { stroke: C.scatter, sw: 3, dash: '6 6' });
          p += circ(140 + dx * 1.4, 130 + dy * 1.8, 8, C.scatter, { stroke: C.ink, sw: 2 });
        }
        p += burst(250, 290, 26, 16, 7, C.gold, { sw: 2 }) + burst(300, 280, 22, 14, 7, C.gold, { sw: 2 });
        break;
      }
      case 3: {
        p += path('M60 180 Q140 150 190 260', 'none', { stroke: C.ink, sw: 2, dash: '2 8' });
        p += path(`M190 300 L250 360 L232 372 L176 312 Z`, '#3B2A26', { stroke: C.ink, sw: 2 });
        p += g(path('M-10 -14 L10 -14 L0 18 Z', C.steelL, { stroke: C.ink, sw: 2.5 }) + line(-6, -6, 6, -6, C.ink, 1.5) + line(-4, 2, 4, 2, C.ink, 1.5) + rr(-10, -24, 20, 10, 3, C.delver, { stroke: C.ink, sw: 2 }), 'translate(244 356) rotate(-45)');
        for (let k = 0; k < 7; k++) p += circ(170 + k * 8 - 20 + (k % 2) * 6, 280 - k * 8, 5 + (k % 3), '#9A6440', { stroke: C.ink, sw: 1.5 });
        p += small(20, 240, 'Bores through ground,');
        p += small(20, 260, 'not through Footing.');
        break;
      }
      case 4: {
        p += path('M30 120 Q80 40 130 290 Q170 170 210 290 Q240 220 270 290', 'none', { stroke: C.ink, sw: 2, dash: '2 8' });
        p += ell(130, 286, 18, 10, C.boinker, { stroke: C.ink, sw: 2.5 });
        p += path('M100 292 Q130 270 160 292', 'none', { stroke: '#FFFFFF', sw: 3 });
        p += path('M180 296 Q210 276 240 296 M190 300 Q210 286 230 300', 'none', { stroke: C.ink, sw: 2, op: .6 });
        p += circ(268, 270, 14, C.boinker, { stroke: C.ink, sw: 2.5 }) + path('M260 264 Q268 258 276 264', 'none', { stroke: '#FFFFFF', sw: 2.5 });
        p += text(160, 240, 'boing', { size: 22, weight: 700, fill: C.boinker, stroke: C.ink, sw: 4, anchor: 'middle', rot: -8 });
        break;
      }
      case 5: {
        p += block('wicker', 120, 196, 50, 1, 2) + block('wicker', 170, 196, 50, 0, 3) + block('timber', 120, 246, 50, 0, 4) + block('timber', 170, 246, 50, 0, 5);
        const flame = (x, y, k) => path(`M${x} ${y} C${x - 14 * k} ${y - 14 * k} ${x - 6 * k} ${y - 30 * k} ${x} ${y - 46 * k} C${x + 4 * k} ${y - 30 * k} ${x + 18 * k} ${y - 20 * k} ${x} ${y} Z`, C.fire, { stroke: C.ink, sw: 2.5 }) + path(`M${x} ${y - 2} C${x - 9 * k} ${y - 12 * k} ${x - 3 * k} ${y - 24 * k} ${x} ${y - 34 * k} C${x + 3 * k} ${y - 22 * k} ${x + 11 * k} ${y - 15 * k} ${x} ${y - 2} Z`, C.fireM) + path(`M${x} ${y - 3} C${x - 5 * k} ${y - 9 * k} ${x - 2 * k} ${y - 15 * k} ${x} ${y - 20 * k} C${x + 2 * k} ${y - 14 * k} ${x + 6 * k} ${y - 10 * k} ${x} ${y - 3} Z`, C.gold);
        p += flame(140, 200, 1.4) + flame(175, 204, 1) + flame(200, 200, 1.2);
        for (let k = 0; k < 6; k++) p += circ(130 + k * 16, 110 + (k % 3) * 14, 3, C.fire);
        p += puff(170, 90, 20, '#5A4E52', { op: .6, stroke: null });
        p += rr(20, 200, 74, 30, 15, C.fire, { stroke: C.ink, sw: 2 }) + text(57, 221, 'Burn', { size: 16, weight: 700, anchor: 'middle', fill: '#FFFFFF' });
        p += ell(280, 300, 46, 11, C.fire, { op: .3, stroke: C.ink, sw: 2, extra: ' stroke-dasharray="6 5"' }) + path('M268 302 C262 294 268 290 270 284 C276 290 278 296 272 302 Z', C.fire, { stroke: C.ink, sw: 1.5 }) + circ(306, 286, 11, C.paper, { stroke: C.ink, sw: 2 }) + text(306, 291.5, '2', { size: 15, weight: 700, anchor: 'middle' });
        p += small(20, 258, 'Patch: icon', { size: 13 }) + small(20, 276, 'and turn count.', { size: 13 });
        break;
      }
      case 6: {
        p += block('cobble', 150, 196, 50, 0, 1) + block('cobble', 200, 196, 50, 0, 2) + block('cobble', 150, 246, 50, 0, 3);
        p += rr(150, 196, 100, 50, 8, '#BFEFFF', { op: .55 });
        for (let k = 0; k < 7; k++) { const a = -Math.PI + k * Math.PI / 6; p += path(`M${200 + Math.cos(a) * 30} ${196 + Math.sin(a) * 30} l${Math.cos(a) * 26} ${Math.sin(a) * 26}`, 'none', { stroke: '#9FD8EE', sw: 7 }) + path(`M${200 + Math.cos(a) * 30} ${196 + Math.sin(a) * 30} l${Math.cos(a) * 26} ${Math.sin(a) * 26}`, 'none', { stroke: C.ink, sw: 1.5 }); }
        p += star4(200, 140, 16, '#FFFFFF', { stroke: C.ink, sw: 2 });
        p += rr(20, 220, 86, 30, 15, '#9FD8EE', { stroke: C.ink, sw: 2 }) + text(63, 241, 'Brittle', { size: 16, weight: 700, anchor: 'middle' });
        break;
      }
      case 7: {
        for (let k = 0; k < 4; k++) p += block('brass', 40 + k * 70, 220, 70, 0, k);
        const zig = (x1, x2, y) => { let d = `M${x1} ${y}`; for (let t = 1; t <= 6; t++) d += ` L${x1 + (x2 - x1) * t / 6} ${y + (t % 2 ? -14 : 10)}`; return path(d, 'none', { stroke: '#B49CFF', sw: 8, op: .6 }) + path(d, 'none', { stroke: '#FFFFFF', sw: 3 }); };
        p += zig(75, 145, 250) + zig(145, 215, 250) + zig(215, 285, 250);
        p += burst(75, 250, 30, 16, 6, '#B49CFF', { sw: 2 });
        p += small(170, 300 - 120, 'Violet arcs. Half per hop.', { anchor: 'middle' });
        break;
      }
      case 8: {
        p += path('M30 170 Q90 90 160 190', 'none', { stroke: C.ink, sw: 2, dash: '2 8' });
        p += block('timber', 140, 196, 50, 0, 3) + block('timber', 190, 196, 50, 0, 4) + block('timber', 140, 246, 50, 0, 5) + block('timber', 190, 246, 50, 0, 6);
        p += path('M180 196 C176 180 196 172 206 182 C220 176 226 196 214 200 Z', C.cbL, { stroke: C.ink, sw: 2.5 });
        p += star4(170, 160, 10, '#EFFFF0', { stroke: C.healD }) + star4(240, 170, 8, '#EFFFF0', { stroke: C.healD }) + text(210, 150, '+40', { size: 26, weight: 700, fill: C.heal, stroke: C.ink, sw: 5, anchor: 'middle' });
        break;
      }
      case 9: {
        p += path('M20 260 Q160 20 330 230', 'none', { stroke: '#FFFFFF', sw: 6, dash: '14 10', op: .95 }) + path('M20 260 Q160 20 330 230', 'none', { stroke: C.ink, sw: 1.2, dash: '14 10', op: .4 });
        p += rr(220, 180, 90, 70, 6, '#4A3530', { stroke: C.ink, sw: 2.5 }) + rr(220, 180, 90, 70, 6, 'none', { stroke: C.peeper, sw: 4, extra: ' stroke-dasharray="8 6"' });
        p += classIcon('peeper', 265, 160, 16) + classIcon('lobber', 265, 222, 14, {});
        p += small(20, 290 - 10, 'Stays all battle.');
        break;
      }
    }
    p += rr(0, 0, PW, PH, 16, 'none', { stroke: C.ink, sw: 3 });
    s += L.clipped(rr(x, y, PW, PH, 16, '#000'), g(p, `translate(${x} ${y})`)) + rr(x, y, PW, PH, 16, 'none', { stroke: C.ink, sw: 3 });
    s += rr(x + 12, y + 12, PW - 24, 52, 12, '#FFFFFF', { op: .9, stroke: C.ink, sw: 2 }) + classIcon(cls, x + 40, y + 38, 15) + text(x + 66, y + 36, n, { size: 21, weight: 700 }) + small(x + 66, y + 56, d, { size: 14 }) + (up ? rr(x + PW - 62, y + 22, 40, 24, 12, C.ink2, { stroke: C.ink, sw: 2 }) + text(x + PW - 42, y + 39, up, { size: 14, weight: 700, anchor: 'middle', fill: C.paper }) : '');
  });
  {
    const by = 1010;
    s += rr(40, by, W - 80, 96, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + text(64, by + 40, 'Damage type', { size: 21, weight: 700 }) + text(64, by + 66, 'badges', { size: 21, weight: 700 });
    const fl = (k) => `M0 ${-11 * k} C${8 * k} ${-3 * k} ${9 * k} ${4 * k} ${5 * k} ${9 * k} C${3 * k} ${4 * k} 0 ${4 * k} ${-1 * k} ${9 * k} C${-8 * k} ${6 * k} ${-8 * k} ${-4 * k} 0 ${-11 * k} Z`;
    const B = [
      ['Blast', '#FFF3C4', burst(0, 0, 13, 8, 8, '#FFFFFF', { sw: 1.8 })],
      ['Pierce', '#FFF3A6', path('M-10 8 L0 -12 L10 8 L0 3 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8 })],
      ['Dig', '#9A6440', path('M-8 -10 L8 -10 L8 0 Q0 14 -8 0 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8 })],
      ['Fire', C.fire, path(fl(1.1), '#FFFFFF', { stroke: C.ink, sw: 1.8 }) + path(fl(.45), C.gold, { extra: ' transform="translate(0 4)"' })],
      ['Frost  U2', '#9FD8EE', [0, 60, 120].map(a => line(-11, 0, 11, 0, C.ink, 5) .replace('/>', ` transform="rotate(${a})"/>`) + line(-10, 0, 10, 0, '#FFFFFF', 2.4).replace('/>', ` transform="rotate(${a})"/>`)).join('')],
      ['Zap  U3', '#B49CFF', path('M3 -13 L-7 2 L0 2 L-3 13 L8 -3 L1 -3 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8 })],
      ['Crush, Fall', '#CFC8C0', path('M-10 -6 L0 4 L10 -6 L10 2 L0 12 L-10 2 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8 })],
      ['Heal', C.heal, rr(-3.5, -11, 7, 22, 2, '#FFFFFF', { stroke: C.ink, sw: 1.6 }) + rr(-11, -3.5, 22, 7, 2, '#FFFFFF', { stroke: C.ink, sw: 1.6 }) + rr(-2.5, -3, 5, 6, 0, '#FFFFFF')],
    ];
    B.forEach(([n, col, ic], i) => { const bx = 250 + i * 196; s += circ(bx, by + 48, 24, col, { stroke: C.ink, sw: 2.5 }) + g(ic, `translate(${bx} ${by + 48})`) + text(bx + 34, by + 55, n, { size: 18, weight: 700 }); });
  }
  out('15-shots-vfx.svg', doc(W, H, s, { title: 'Shots and VFX', desc: 'Ten shot and impact effect studies with weapons doc names, and the damage type badges' }));
}

// ================================================================ phone frame
function phone(inner, title, sub, defs = '', o = {}) {
  const W = 1300, H = o.H || 720;
  let s = rr(0, 0, W, H, 0, '#ECE6DA');
  s += text(50, 52, title, { size: 30, weight: 700 }) + small(50, 76, sub, { size: 16 });
  s += rr(20, 100, 1260, 600, 64, '#1E1A22', { stroke: C.ink, sw: 3 });
  s += rr(26, 340, 10, 120, 5, '#3A3440');
  s += L.clipped(rr(50, 130, 1200, 540, 30, '#000'), g(inner, 'translate(50 130)'));
  s += rr(50, 130, 1200, 540, 30, 'none', { stroke: '#000', sw: 2 });
  s += rr(52, 330, 22, 140, 11, '#1E1A22');
  s += o.extra || '';
  return doc(W, H, s, { title, desc: sub, defs });
}

function portrait(x, y, cls, hp, o = {}) {
  const { hidden = false, reload = false, sel = false, enemy = false, r = 18 } = o;
  let s = '';
  if (sel) s += circ(x, y, r + 6, C.gold, { stroke: C.ink, sw: 2 });
  s += circ(x, y, r, hidden ? '#D8D2DE' : '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  if (hidden) s += text(x, y + 6, '?', { size: 18, weight: 700, anchor: 'middle', fill: C.ink2 });
  else if (enemy) s += L.clipped(circ(x, y, r - 2, '#000'), flattener(cls, x, y + 26, .42, { flip: true }));
  else s += L.clipped(circ(x, y, r - 2, '#000'), hob(cls, x - 2, y + 36, .5, { tool: false }));
  if (!hidden) {
    const w = r * 2;
    s += rr(x - w / 2, y + r + 3, w, 6, 3, '#3A3236') + rr(x - w / 2, y + r + 3, w * hp, 6, 3, hp < .35 ? C.danger : C.good);
  }
  if (reload) s += circ(x + r * .7, y + r * .7, 7, C.steel, { stroke: C.ink, sw: 1.5 }) + circ(x + r * .7, y + r * .7, 2.5, C.ink);
  return s;
}

// ================================================================ 16 HUD battle (drawn in pt, 844 x 390, per 07 §2.3, §2.4, §2.9)
// HUD parts shared by the phone view and the state strip under it. All in pt.
const cloudIcon = (x, y, r, puffs = 0, fill = C.slate) => {
  let c = path(L.cloudD(x, y, r), fill, { stroke: C.ink, sw: 1.4 });
  for (let k = 0; k < puffs; k++) c += circ(x + r * 1.5 + k * r * .9, y + r * .35, r * .28, fill, { stroke: C.ink, sw: 1 });
  return c;
};
const roundLabel = (cx, n, cap, puffs = 0) => {
  const w = puffs ? 136 : 100;
  return rr(cx - w / 2, 4, w, 28, 14, '#FFFFFF', { stroke: C.ink, sw: 2 }) + text(cx - (puffs ? 20 : 0), 23, `Round ${n}/${cap}`, { size: 14, weight: 700, anchor: 'middle' }) + (puffs ? cloudIcon(cx + 36, 17, 6, puffs) : '');
};
const squallLabel = (cx, n) => rr(cx - 66, 4, 132, 28, 14, C.slate, { stroke: C.ink, sw: 2 }) + cloudIcon(cx - 48, 17, 6, 0, '#FFFFFF') + text(cx + 10, 23, `Squall ${n} of 3`, { size: 14, weight: 700, anchor: 'middle', fill: '#FFFFFF' });
const kettleGauge = (x, pct) => {
  const st = pct === 0 ? 'pop' : pct <= 25 ? 'crit' : pct <= 50 ? 'hurt' : 'full';
  let c = rr(x, 5, 74, 26, 9, '#FFFFFF', { stroke: st === 'crit' ? C.danger : C.ink, sw: st === 'crit' ? 2.5 : 1.8 });
  c += g(kettle(0, 0, .2, { glowOn: false, hp: pct / 100, popped: pct === 0 }), `translate(${x + 15} 29)`);
  c += text(x + 30, 23.5, pct === 0 ? 'Pop' : pct + '%', { size: 14, weight: 700 });
  if (st === 'hurt') c += path(`M${x + 66} 9 l-4 5 l5 2 l-4 6`, 'none', { stroke: C.ink, sw: 1.8 });
  if (st === 'crit') c += circ(x + 66, 5, 3.5, '#FFFFFF', { stroke: C.ink, sw: 1.2 }) + circ(x + 72, 0, 2.5, '#FFFFFF', { stroke: C.ink, sw: 1.2 });
  return c;
};
const youPip = (x, hp, bonk = false) => {
  let c = circ(x, 18, 9, bonk ? '#D8D2DE' : '#FFFFFF', { stroke: C.ink, sw: 1.8 });
  if (bonk) return c + ell(x, 16, 4, 5, '#BFA8F0', { stroke: C.ink, sw: 1.2 }) + line(x, 21, x, 25, C.ink, 1.2);
  return c + L.clipped(circ(x, 18, 8, '#000'), rr(x - 9, 27 - 18 * hp, 18, 18 * hp, 0, C.you)) + circ(x, 18, 9, 'none', { stroke: C.ink, sw: 1.8 });
};
// Rival pip: the Class icon in a diamond frame with an orange hatched edge. Always shown at launch.
const rivalPip = (x, cls, bonk = false) => {
  const d = (r) => `M${x} ${18 - r} L${x + r} 18 L${x} ${18 + r} L${x - r} 18 Z`;
  let c = path(d(12.5), C.rival, { stroke: C.ink, sw: 1.6 });
  c += L.clipped(path(d(12.5), '#000'), [0, 1, 2, 3, 4, 5, 6].map(k => line(x - 16 + k * 5, 32, x - 6 + k * 5, 4, '#FFFFFF', 1.3, { op: .75 })).join(''));
  c += path(d(8.6), bonk ? '#D8D2DE' : C[cls], { stroke: C.ink, sw: 1.4 });
  c += bonk ? ell(x, 16.5, 3, 4, '#BFA8F0', { stroke: C.ink, sw: 1 }) + line(x, 20.5, x, 23.5, C.ink, 1) : classIcon(cls, x, 18, 7.2, { ring: false });
  return c;
};
{
  let s = '';
  const sk = S.sky(844, 390, '#9ED8EC', '#FFF1D0', 'hudsky');
  s += sk.body;
  s += puff(640, 70, 10);
  s += S.quiltHill(-10, 854, 390, [[0, 230], [180, 200], [420, 236], [640, 190], [844, 220]], '#B7DDA8');
  const gtops = [[0, 268], [150, 256], [300, 270], [430, 318], [540, 300], [680, 248], [844, 256]];
  s += S.ground(-10, 854, 400, gtops, { seed: 5 });
  const bs = 10;
  const lay = ['TTTTTTTT', 'TnnTTnnT', 'TnnTTnnT', 'TTTnnTTT', 'TTTnnTTT', 'nnCkkCnn', 'nnCkkCnn', 'FFFFFFFF'];
  const fx = 150, fy = 256 - 8 * bs - bs * 1.2;
  s += fort(fx, fy, lay, bs, { crew: [{ r: 1, c: 1, cls: 'lobber' }, { r: 1, c: 5, cls: 'zinger' }, { r: 3, c: 3, cls: 'patcher' }, { r: 5, c: 0, cls: 'delver' }, { r: 5, c: 6, cls: 'boinker' }], roofs: [{ c: 0, w: 3, h: 1.2, color: C.lobber }], legs: 3 });
  const elay = ['CCCCCC', 'nnCnnC', 'nnCnnC', 'BBkkBB', 'BBkkBB', 'FFFFFF'];
  s += fort(690, 248 - 6 * bs - bs * 1.2, elay, bs, { enemy: true, face: 'left', roofs: [{ c: 0, w: 6, type: 'flat', color: C.steel }], legs: 3, dmg: { '0,0': 2, '1,2': 1 } });
  s += circ(fx + 6 * bs, fy + 2 * bs, 15, 'none', { stroke: C.gold, sw: 2.5, extra: ' stroke-dasharray="4 3"' });
  const gyAt = (x) => { for (let k = 0; k < gtops.length - 1; k++) { const [ax, ay] = gtops[k], [bx, by] = gtops[k + 1]; if (x >= ax && x <= bx) { const t = (x - ax) / (bx - ax); return ay + (by - ay) * t * t * (3 - 2 * t); } } return 256; };
  const x0 = fx + 8 * bs, y0 = fy + 1.5 * bs;
  const gall = S.arcPts(x0, y0, 230, -240, 220, 8, 300, .02);
  const gp = []; for (const p of gall) { gp.push(p); if (p[0] > 280 && p[1] > gyAt(p[0])) break; }
  s += path('M' + gp.map(p => `${f(p[0])} ${f(p[1])}`).join(' L'), 'none', { stroke: C.you, sw: 2, op: .45, dash: '9 6' });
  const lp = gp[gp.length - 1];
  s += g(circ(0, -13, 6, C.you, { stroke: C.ink, sw: 1.8 }) + path('M-3 -9 L0 0 L3 -9', C.you, { stroke: C.ink, sw: 1.5 }), `translate(${f(lp[0])} ${f(lp[1])})`);
  s += g(path('M0 -19 L6 -13 L0 -7 L-6 -13 Z', C.rival, { stroke: C.ink, sw: 1.8 }) + line(0, -7, 0, 0, C.ink, 1.5), `translate(262 ${f(gyAt(262))})`);
  const pp = S.arcPts(x0, y0, 260, -260, 220, 8, 13, .03);
  pp.forEach(([x, y], i) => { if (i % 2 === 0) s += circ(x, y, 3.4 - i * .1, '#FFFFFF', { stroke: C.ink, sw: 1.2, op: 1 - i * .04 }); });
  // top strip 36 pt
  s += rr(0, 0, 844, 36, 0, C.paper, { op: .94 }) + line(0, 36, 844, 36, C.ink, 2);
  s += rr(50, 5, 26, 26, 7, '#FFFFFF', { stroke: C.ink, sw: 2 }) + rr(57, 11, 4, 14, 1.5, C.ink) + rr(64, 11, 4, 14, 1.5, C.ink);
  s += kettleGauge(82, 100);
  [1, .7, .45, .9, 1].forEach((hp, i) => s += youPip(172 + i * 22, hp));
  s += roundLabel(366, 13, 15, 2);
  s += windArrow(468, 18, 4, .42) + text(490, 23, '4', { size: 15, weight: 700 });
  s += line(504, 18, 514, 18, C.ink, 1.5, { dash: '2 2' }) + g(windArrow(0, 0, 6, .28), 'translate(528 18)', ' opacity="0.7"') + text(546, 23, '6', { size: 12, weight: 700, fill: C.ink2 });
  [['snipper', 'lobber', 0], ['sniper', 'zinger', 0], ['rake', 'scatter', 0], ['tamper', 'delver', 1], ['filler', 'patcher', 0]].forEach(([, cls, bonk], i) => s += rivalPip(586 + i * 28, cls, !!bonk));
  s += kettleGauge(724, 46);
  // hob column: 5 Hobs, the crew cap (56 x 256 pt)
  s += rr(47, 42, 56, 256, 14, C.paper, { op: .9, stroke: C.ink, sw: 2 });
  [['lobber', 1, 0], ['zinger', .7, 0], ['patcher', .45, 1], ['delver', .9, 0], ['boinker', 1, 0]].forEach(([c, hp, rl], i) => {
    const cy = 70 + i * 50;
    s += circ(75, cy, 22, '#FFFFFF', { stroke: C.ink, sw: 2 });
    s += L.clipped(circ(75, cy, 19, '#000'), rr(50, cy - 25, 50, 50, 0, '#F3E7CF') + hob(c, 74, cy + 40, .5, { tool: false, skin: L.SKINS[i], coat: L.COATS[i] }));
    s += hp >= 1 ? circ(75, cy, 22, 'none', { stroke: C.you, sw: 4 }) : path(`M75 ${cy - 22} A22 22 0 ${hp > .5 ? 1 : 0} 1 ${f(75 + 22 * Math.sin(hp * 2 * Math.PI))} ${f(cy - 22 * Math.cos(hp * 2 * Math.PI))}`, 'none', { stroke: C.you, sw: 4 });
    if (i === 1) s += circ(75, cy, 25.5, 'none', { stroke: C.gold, sw: 3 }) + path(`M99 ${cy - 5} L106 ${cy} L99 ${cy + 5} Z`, C.gold, { stroke: C.ink, sw: 1.2 });
    if (rl) s += circ(91, cy + 14, 8, C.steel, { stroke: C.ink, sw: 1.5 }) + text(91, cy + 18, '1', { size: 10, weight: 700, anchor: 'middle' });
  });
  // steam gauge and walk pad
  s += rr(47, 302, 108, 13, 6.5, C.paper, { op: .95, stroke: C.ink, sw: 1.8 }) + rr(51, 305, 70, 7, 3.5, '#3A3236') + rr(51, 305, 46, 7, 3.5, C.glow) + rr(51, 305, 27, 7, 3.5, C.glowL) + text(138, 312.5, 'S 64', { size: 9.5, weight: 700, anchor: 'middle' });
  s += rr(47, 318, 108, 51, 14, C.paper, { op: .95, stroke: C.ink, sw: 2 });
  s += circ(74, 343.5, 20, '#FFFFFF', { stroke: C.ink, sw: 2 }) + path('M79 335.5 L69 343.5 L79 351.5 Z', C.ink);
  s += circ(128, 343.5, 20, '#FFFFFF', { stroke: C.ink, sw: 2 }) + path('M123 335.5 L133 343.5 L123 351.5 Z', C.ink);
  // shot tray 392 x 60: Plain, Knack, four Trick Shells, Doodads. No locked chips: any Hob fires any shell
  s += rr(163, 309, 392, 60, 14, C.paper, { op: .95, stroke: C.ink, sw: 2 });
  const chip = (i, label, uses, o = {}) => {
    const { sel = false, spent = false, icon = '', cogs = 0, best = false } = o;
    const x = 169 + i * 55, y = 313;
    let c = rr(x, y, 52, 52, 10, sel ? C.saffron : spent ? '#E6E0E8' : '#FFFFFF', { stroke: C.ink, sw: sel ? 2.5 : 1.8 }) + g(icon, '', spent ? ' opacity="0.4"' : '');
    c += text(x + 26, y + 47, label, { size: 8.5, weight: 700, anchor: 'middle', fill: spent ? '#9A90A4' : C.ink });
    if (uses !== '') c += circ(x + 46, y + 6, 8, spent ? '#9A90A4' : C.ink) + text(x + 46, y + 10, uses, { size: 10, weight: 700, anchor: 'middle', fill: C.paper });
    for (let k = 0; k < cogs; k++) c += circ(x + 7 + k * 9, y + 7, 3.5, C.steel, { stroke: C.ink, sw: 1 });
    if (best) c += classIcon('zinger', x + 8, y + 32, 6.5);
    return c;
  };
  s += chip(0, 'Hatpin', '', { sel: true, icon: g(line(-12, 6, 10, -5, C.steelL, 3) + line(-12, 6, 10, -5, C.ink, 1) + circ(12, -6, 4, '#FFF3A6', { stroke: C.ink, sw: 1.5 }), 'translate(195 334)') });
  s += chip(1, 'Knack', '2', { cogs: 1, icon: g(path('M-2 -12 L6 -12 L0 0 L8 0 L-6 16 L-2 4 L-8 4 Z', C.zinger, { stroke: C.ink, sw: 1.8 }), 'translate(250 334) scale(.8)') });
  s += chip(2, 'Marble Sack', '1', { cogs: 1, icon: path('M296 342 C292 330 300 326 305 326 C310 326 318 330 314 342 Z', '#C9A27A', { stroke: C.ink, sw: 1.6 }) + circ(301, 325, 3, '#9FD8EE', { stroke: C.ink, sw: 1 }) + circ(308, 324, 3, C.scatter, { stroke: C.ink, sw: 1 }) });
  s += chip(3, 'Mole Mail', '1', { cogs: 1, icon: ell(360, 336, 10, 6.5, C.delver, { stroke: C.ink, sw: 1.6 }) + circ(368, 334, 2, '#F28B82') + path('M350 341 l-3 4 M356 343 l-1 4', 'none', { stroke: C.ink, sw: 1.4 }) });
  s += chip(4, 'Nosy Goose', '1', { cogs: 1, best: true, icon: ell(416, 338, 9, 6, '#FFFFFF', { stroke: C.ink, sw: 1.6 }) + path('M422 334 C424 326 428 324 430 325', 'none', { stroke: C.ink, sw: 4.5 }) + path('M422 334 C424 326 428 324 430 325', 'none', { stroke: '#FFFFFF', sw: 2.5 }) + path('M430 323 l5 2 l-5 2 Z', C.saffron, { stroke: C.ink, sw: 1 }) });
  s += chip(5, 'Lid Lifter', '0', { spent: true, cogs: 1, icon: path('M459 340 C459 330 481 330 481 340 Z', C.soot, { stroke: C.ink, sw: 1.6 }) + circ(470, 329, 2.5, C.br, { stroke: C.ink, sw: 1 }) });
  s += chip(6, 'Doodads', '2', { icon: rr(515, 326, 20, 17, 4, '#8FD08A', { stroke: C.ink, sw: 1.8 }) + path('M519 326 Q525 316 531 326', 'none', { stroke: C.ink, sw: 1.8 }) });
  // readout + fire
  s += rr(563, 325, 120, 40, 12, C.paper, { op: .96, stroke: C.ink, sw: 2 }) + text(623, 351, '62.5° | 74', { size: 17, weight: 700, anchor: 'middle' });
  s += circ(757, 335, 38, C.saffronD, { stroke: C.ink, sw: 2.5 }) + circ(757, 331, 38, C.saffron, { stroke: C.ink, sw: 2.5 }) + ell(757, 313, 22, 9, '#FFFFFF', { op: .35 }) + text(757, 338, 'FIRE', { size: 20, weight: 700, anchor: 'middle' });
  // turn banner
  s += rr(292, 46, 260, 30, 15, C.you, { stroke: C.ink, sw: 2 }) + text(422, 66, 'Your turn', { size: 15, weight: 700, anchor: 'middle', fill: '#FFFFFF' });
  // annotations
  const tag = (x, y, t) => rr(x, y, t.length * 5.5 + 14, 17, 8.5, C.ink2, { op: .92 }) + text(x + 7, y + 12.5, t, { size: 9.5, weight: 700, fill: '#FFFFFF' });
  s += tag(380, 130, '30% preview');
  s += tag(330, 212, 'Ghost: your pin is round, theirs a diamond');
  s += tag(110, 46, '5 Hobs at most');
  s += tag(296, 84, 'Storm soon: the cloud grows');
  s += tag(574, 40, 'Rival Class icons stay shown');
  s += tag(330, 284, 'Best with: no rest, small bonus') + line(397, 301, 397, 337, C.ink2, 1.2, { dash: '3 3' });
  const inner = g(s, 'translate(16 0) scale(1.3846)');
  // state strip under the phone
  const K = 1.7;
  const cell = (x, w, title, body, note) => rr(x, 716, w, 150, 16, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + text(x + 18, 746, title, { size: 19, weight: 700 }) + body + small(x + 18, 852, note, { size: 13.5 });
  let ex = '';
  ex += cell(20, 540, 'Round label', g(roundLabel(50, 6, 15) + roundLabel(176, 13, 15, 2) + squallLabel(318, 2), `translate(38 762) scale(1.3)`), 'Cap 15 at launch. The cloud grows from 3 rounds out. Squall: 3 rounds at most.');
  ex += cell(575, 360, 'Kettle gauge', g(kettleGauge(0, 100) + kettleGauge(82, 50) + kettleGauge(164, 25), `translate(592 762) scale(1.36)`), 'Full, hurt at 50%, critical at 25%.');
  ex += cell(950, 330, 'Crew pips', g(youPip(12, 1) + youPip(36, .5) + youPip(60, 0, true) + rivalPip(100, 'lobber') + rivalPip(129, 'zinger') + rivalPip(158, 'delver', true), `translate(966 762) scale(1.6)`), 'You: round. Rival: Class icon, diamond.');
  out('16-hud-battle-mockup.svg', phone(rr(0, 0, 1200, 540, 0, '#9ED8EC') + inner, 'Battle HUD, phone landscape', 'Layout per 07-ux 2.3 (844 x 390 pt). Top strip 36 pt, Hob column for up to 5 Hobs, Walk pad, shot tray, readout and Fire. Round cap 15 at launch, then the Sudden Squall.', sk.defs, { H: 890, extra: ex }));
}

// ================================================================ 17 campaign map / main menu (per 07 §4.5, 05 §8)
{
  let s = '';
  const sk = S.sky(1200, 540, '#9ED8EC', '#FFF1D0', 'mapsky');
  s += sk.body;
  s += puff(200, 120, 20) + puff(520, 100, 16) + puff(960, 110, 14);
  s += S.quiltHill(-10, 1210, 540, [[0, 270], [160, 236], [340, 280], [520, 240], [700, 276], [860, 262], [1210, 270]], '#CFE3C4', { outline: false });
  const BASE = 336;
  const REG = [
    { n: 'Puddingstone Downs', x0: 0, x1: 290, done: 10, gf: 'Topiary Keep' },
    { n: 'Crumblecrag', x0: 290, x1: 560, done: 4, gf: 'Sanding Stair' },
    { n: 'Soggybottom Fen', x0: 560, x1: 830, done: -1, gf: 'Great Sump' },
    { n: 'The Flats', x0: 830, x1: 1100, done: -1, gf: 'The Last Level' },
  ];
  // 1 Downs: won, so the hills are back
  s += L.clipped(rr(0, 0, 290, 560, 0, '#000'), S.ground(-10, 310, 560, [[0, 344], [76, 296], [150, 344], [224, 292], [300, BASE]], { seed: 14 }));
  // 2 Crag: slate. The won half has risen, the rest is still ironed
  s += L.clipped(rr(290, 0, 270, 560, 0, '#000'), S.ground(270, 580, 560, [[280, BASE], [352, 282], [420, 322], [480, BASE], [580, BASE]], { seed: 21, grass: '#9DB35A', grassD: '#7E9244', loam: '#8E96A0', loamD: '#77808A', rock: '#6E757E', pebble: '#D9A441' }) + rr(480, BASE + 18, 90, 240, 0, '#FFFFFF', { op: .16 }) + [0, 1, 2, 3].map(k => rr(484 + k * 20, BASE + 18, 9, 240, 0, '#5E6670', { op: .3 })).join(''));
  // 3 Fen: not yet won, ironed flat
  s += rr(560, BASE, 270, 230, 0, '#9AA88C') + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(k => rr(564 + k * 21, BASE, 10, 230, 0, '#86957A', { op: .7 })).join('') + rr(560, BASE, 270, 12, 0, '#B9C6A6');
  // 4 Flats: pressed plate with hazard stripes
  s += rr(830, BASE, 380, 230, 0, '#A8ABB2') + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(k => rr(834 + k * 21, BASE, 10, 230, 0, '#969AA2', { op: .7 })).join('');
  s += L.clipped(rr(830, BASE, 270, 9, 0, '#000'), rr(830, BASE, 270, 9, 0, '#F2C200') + [...Array(24)].map((_, k) => path(`M${830 + k * 12} ${BASE + 9} l6 -9 l5 0 l-6 9 Z`, C.ink, { op: .75 })).join(''));
  s += line(480, BASE, 1210, BASE, C.ink, 4);
  // region seams
  for (const x of [290, 560, 830, 1100]) s += stitch(`M${x} ${BASE - 40} L${x} 470`, C.ink, 2.5, .45, '6 7');
  // props
  s += S.tree(44, 322, .62, '#6DB55E') + S.tree(186, 322, .7, '#5AA555') + S.tree(118, 334, .5, '#6DB55E');
  for (const [x, y] of [[76, 322], [224, 318], [352, 306]]) s += path(`M${x - 12} ${y} q5 4 10 0 M${x + 3} ${y} q5 4 10 0`, 'none', { stroke: C.ink, sw: 2, op: .6 });
  s += circ(400, 312, 9, '#9DB35A', { stroke: C.ink, sw: 2 });
  for (let k = 0; k < 6; k++) { const x = 592 + k * 9 + (k > 2 ? 170 : 0); s += path(`M${x} ${BASE} Q${x + 3} ${BASE - 22} ${x + 1} ${BASE - 30}`, 'none', { stroke: '#6F8E3A', sw: 2.5 }) + ell(x + 1, BASE - 30, 2.5, 6, '#8A5A3A', { stroke: C.ink, sw: 1.2 }); }
  s += g(flattener('smoothie', 0, 0, .5), `translate(680 ${BASE})`);
  // a hill in chains over the Flats
  s += line(862, BASE, 862, 262, C.ink, 3) + line(922, BASE, 922, 262, C.ink, 3) + line(856, 262, 928, 262, C.ink, 4) + line(878, 262, 878, 284, C.ink, 1.5, { dash: '3 2' }) + line(906, 262, 906, 284, C.ink, 1.5, { dash: '3 2' });
  s += path('M866 302 Q892 268 918 302 Z', '#9A6440', { stroke: C.ink, sw: 2.5 }) + path('M870 298 Q892 272 914 298', 'none', { stroke: '#7CC46A', sw: 5 });
  // the Baron's Grand Roller idles at the far edge
  s += g(circ(0, -30, 30, C.steelD, { stroke: C.ink, sw: 3 }) + circ(0, -30, 17, C.steel, { stroke: C.ink, sw: 2.5 }) + circ(0, -30, 6, C.rival, { stroke: C.ink, sw: 2 }) + rr(24, -52, 44, 36, 5, C.indigoD, { stroke: C.ink, sw: 3 }) + rr(24, -38, 44, 6, 0, C.rival, { stroke: C.ink, sw: 1.5 }) + rr(54, -74, 8, 24, 2, '#3A3236', { stroke: C.ink, sw: 2 }) + circ(56, -10, 10, C.steelD, { stroke: C.ink, sw: 2.5 }) + puff(60, -84, 8, '#ECECF4'), `translate(978 ${BASE})`);
  // roads and nodes
  const node = (x, y, st, n) => {
    let c = '';
    if (st === 'cur') c += circ(x, y, 20, C.gold, { op: .45 }) + circ(x, y, 15, C.gold, { op: .4 });
    c += circ(x, y, 9.5, st === 'lock' ? '#C9C3CF' : '#FFFFFF', { stroke: C.ink, sw: 2.2, op: st === 'lock' ? .85 : 1 });
    c += text(x, y + 4, String(n), { size: 10, weight: 700, anchor: 'middle', fill: st === 'lock' ? '#8A8090' : C.ink });
    if (st === 'done') c += line(x + 8, y - 8, x + 8, y - 24, C.ink, 2) + path(`M${x + 8} ${y - 24} L${x + 19} ${y - 20} L${x + 8} ${y - 16} Z`, n % 3 === 0 ? C.you : C.gold, { stroke: C.ink, sw: 1.3 });
    return c;
  };
  REG.forEach((r, ri) => {
    const w = r.x1 - r.x0, pts = [];
    for (let k = 0; k < 10; k++) pts.push([r.x0 + 20 + k * (w - 74) / 9, 384 + Math.sin(k * 1.9 + ri) * 12]);
    const gfx = r.x1 - 30, gfy = 384;
    s += path('M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join(' L') + ` L${gfx} ${gfy}`, 'none', { stroke: C.ink, sw: 3, dash: '2 7', op: r.done < 0 ? .45 : 1 });
    pts.forEach(([x, y], k) => s += node(x, y, r.done < 0 ? 'lock' : k < r.done ? 'done' : k === r.done ? 'cur' : 'open', k + 1));
    // Grand Fort icon: a square fort with a flat flag
    s += g(rr(-13, -22, 26, 22, 3, r.done < 0 ? '#B9B3BF' : C.cb, { stroke: C.ink, sw: 2.2 }) + rr(-13, -28, 7, 7, 1, r.done < 0 ? '#B9B3BF' : C.cb, { stroke: C.ink, sw: 2 }) + rr(-3.5, -28, 7, 7, 1, r.done < 0 ? '#B9B3BF' : C.cb, { stroke: C.ink, sw: 2 }) + rr(6, -28, 7, 7, 1, r.done < 0 ? '#B9B3BF' : C.cb, { stroke: C.ink, sw: 2 }) + rr(-4, -12, 8, 12, 2, '#2A1E1E') + (r.done === 10 ? line(0, -28, 0, -46, C.ink, 2) + path('M0 -46 L13 -41 L0 -36 Z', C.you, { stroke: C.ink, sw: 1.3 }) : line(0, -28, 0, -46, C.ink, 2) + rr(0, -46, 13, 9, 1, C.rival, { stroke: C.ink, sw: 1.3 })), `translate(${gfx} ${gfy + 12})`);
    // region plate
    const cx = (r.x0 + r.x1) / 2 + (ri === 0 ? 14 : 0), pw = 220;
    s += rr(cx - pw / 2, 416, pw, 44, 12, '#FFFFFF', { op: .95, stroke: C.ink, sw: 2 });
    s += circ(cx - pw / 2 + 20, 438, 12, r.done === 10 ? C.good : r.done >= 0 ? C.saffron : '#C9C3CF', { stroke: C.ink, sw: 2 }) + text(cx - pw / 2 + 20, 443, String(ri + 1), { size: 14, weight: 700, anchor: 'middle' });
    s += text(cx - pw / 2 + 38, 434, r.n, { size: 13.5, weight: 700 });
    s += small(cx - pw / 2 + 38, 451, r.done === 10 ? `10/10 won. ${r.gf}` : r.done >= 0 ? `${r.done}/10. ${r.gf}` : `Ironed flat. ${r.gf}`, { size: 11.5 });
  });
  // the wings that got away: two signposted roads off the strip
  s += path(`M1096 ${BASE - 4} C1112 300 1126 240 1128 198`, 'none', { stroke: C.ink, sw: 3, dash: '2 7', op: .7 });
  s += path('M1072 384 C1104 380 1136 388 1150 402', 'none', { stroke: C.ink, sw: 3, dash: '2 7', op: .7 });
  // north: a flat, shiny peak
  s += path('M1108 196 L1132 150 L1168 150 L1192 196 Z', '#DDEBF8', { stroke: C.ink, sw: 2.5 }) + path('M1126 162 L1132 150 L1168 150 L1174 162 Z', '#FFFFFF', { stroke: C.ink, sw: 2 }) + line(1136, 150, 1164, 150, '#FFFFFF', 3) + star4(1176, 142, 7, '#FFFFFF', { stroke: C.ink, sw: 1.5 });
  // south: a smoking mine mouth
  s += path('M1122 430 C1122 392 1182 392 1182 430 Z', '#4A4440', { stroke: C.ink, sw: 2.5 }) + path('M1136 430 C1136 406 1168 406 1168 430 Z', '#1E222B', { stroke: C.ink, sw: 2 }) + puff(1168, 388, 9, '#ECECF4') + puff(1184, 372, 6, '#ECECF4');
  // signpost
  s += line(1100, BASE + 2, 1100, 258, '#7A4A2E', 6) + line(1100, BASE + 2, 1100, 258, C.ink, 1.5, { op: .4 });
  const board = (y, t, up) => g(path('M-44 -11 L34 -11 L46 0 L34 11 L-44 11 Z', C.paper, { stroke: C.ink, sw: 2.2 }) + text(-6, 4.5, t, { size: 11.5, weight: 700, anchor: 'middle' }), `translate(1096 ${y}) rotate(${up ? -14 : 12})`);
  s += board(268, 'Peaks  U2', true) + board(298, 'Mines  U3', false);
  const lock = (x, y) => rr(x - 6, y - 4, 12, 10, 2.5, C.ink2, { stroke: C.ink, sw: 1.5 }) + path(`M${x - 3.5} ${y - 4} v-3 a3.5 3.5 0 0 1 7 0 v3`, 'none', { stroke: C.ink, sw: 2 });
  s += lock(1150, 180) + lock(1152, 422);
  // top bar
  s += rr(44, 10, 1112, 46, 23, C.paper, { stroke: C.ink, sw: 2.5, op: .96 });
  s += circ(78, 33, 15, '#FFFFFF', { stroke: C.ink, sw: 2 }) + circ(78, 33, 5, 'none', { stroke: C.ink, sw: 3 });
  s += text(110, 41, 'Brickabrac  14/40', { size: 20, weight: 700 });
  s += pennant(560, 44, .7) + text(580, 41, 'Pennants 38/138', { size: 17, weight: 700 });
  s += buttonCoin(880, 33, 12) + text(898, 41, 'Buttons 2,310', { size: 17, weight: 700 });
  // dock
  s += rr(44, 472, 1112, 58, 20, C.paper, { stroke: C.ink, sw: 2.5, op: .97 });
  const nav = [['Workshop', block('timber', 0, 0, 22, 0, 1)], ['Tinker Tree', circ(11, 11, 10, C.br, { stroke: C.ink, sw: 2 }) + circ(11, 11, 3.5, C.ink)], ['Crew', hob('lobber', 11, 30, .26, { tool: false })], ['Collections', rr(2, 0, 18, 22, 3, C.you, { stroke: C.ink, sw: 2 })], ['Modes', star4(11, 11, 11, C.gold, { stroke: C.ink, sw: 1.8 })]];
  nav.forEach(([n, ic], i) => {
    const x = 70 + i * 220;
    s += rr(x, 480, 196, 42, 14, '#FFFFFF', { stroke: C.ink, sw: 2 }) + g(ic, `translate(${x + 14} 490)`) + text(x + 112, 507, n, { size: 16, weight: 700, anchor: 'middle' });
    if (i === 1) s += circ(x + 186, 484, 6, C.you, { stroke: C.ink, sw: 1.5 });
  });
  // callouts
  const tag = (x, y, t) => rr(x, y, t.length * 7.1 + 22, 26, 13, C.ink2, { op: .92 }) + text(x + 11, y + 18, t, { size: 13, weight: 700, fill: '#FFFFFF' });
  s += tag(60, 226, 'Won ground pops back up into hills') + line(150, 252, 150, 286, C.ink2, 2, { dash: '3 4' });
  s += tag(574, 240, 'Not yet won: ironed flat') + line(640, 266, 640, 326, C.ink2, 2, { dash: '3 4' });
  s += tag(770, 160, 'The wings that got away: signposts only') + line(1040, 186, 1086, 250, C.ink2, 2, { dash: '3 4' });
  s += small(1160, 214, 'Update 2', { size: 12, anchor: 'middle', weight: 700 }) + small(1150, 448, 'Update 3', { size: 12, anchor: 'middle', weight: 700 });
  out('17-campaign-map-mockup.svg', phone(s, 'Brickabrac Map, whole-world view', 'One painted strip, four regions at launch: Downs, Crag, Fen, Flats. Two signposted roads lead off to the Peaks (U2) and the Mines (U3). Nothing there can be tapped yet.', sk.defs));
}

// ================================================================ 18 Workshop
{
  let s = rr(0, 0, 1200, 540, 0, '#F3E7CF') + rr(0, 0, 1200, 540, 0, 'url(#paperDots)');
  // top bar
  s += rr(44, 10, 1112, 46, 23, C.paper, { stroke: C.ink, sw: 2.5 });
  s += text(66, 42, 'Workshop', { size: 24, weight: 700 });
  for (let k = 0; k < 5; k++) s += rr(220 + k * 48, 18, 40, 30, 10, k === 1 ? C.saffron : '#FFFFFF', { stroke: C.ink, sw: 2 }) + text(240 + k * 48, 39, String(k + 1), { size: 16, weight: 700, anchor: 'middle' });
  s += small(470, 40, 'Blueprint 2: "Tall Teapot"', { size: 15 });
  s += text(780, 41, 'Blocks 50/80', { size: 17, weight: 700 }) + text(920, 41, '8 x 8', { size: 17, weight: 700 });
  s += buttonCoin(1010, 33, 12) + text(1028, 41, '1,240', { size: 18, weight: 700 });
  // left palette
  s += rr(44, 66, 150, 464, 18, C.paper, { stroke: C.ink, sw: 2.5 });
  const mats = [['wicker', 'Wicker', 5], ['timber', 'Timber', 15], ['cobble', 'Cobble', 35], ['brass', 'Brassbound', 70], ['moon', 'Moonbrick', 150]];
  mats.forEach(([m, n, c], i) => {
    const y = 76 + i * 62;
    s += rr(52, y, 134, 56, 12, i === 2 ? C.saffronL : '#FFFFFF', { stroke: C.ink, sw: i === 2 ? 3 : 2 });
    s += block(m, 60, y + 8, 40, 0, i) + text(108, y + 26, n, { size: 13, weight: 700 }) + buttonCoin(114, y + 41, 7) + text(126, y + 46, String(c), { size: 13, weight: 700 });
    if (i === 4) s += rr(52, y, 134, 56, 12, '#FFFFFF', { op: .55 }) + text(160, y + 46, '🔒', { size: 1 }) + rr(150, y + 32, 28, 20, 6, C.ink2) + text(164, y + 47, 'U3', { size: 11, weight: 700, fill: '#FFF', anchor: 'middle' });
  });
  s += rr(52, 390, 64, 56, 12, '#FFFFFF', { stroke: C.ink, sw: 2 }) + rr(62, 400, 44, 30, 4, '#4A3530', { stroke: C.ink, sw: 2 }) + text(84, 442, 'Nook', { size: 12, weight: 700, anchor: 'middle' });
  s += rr(122, 390, 64, 56, 12, '#FFFFFF', { stroke: C.ink, sw: 2 }) + g(kettle(0, 0, .26), 'translate(154 428)') + text(154, 442, 'Kettle', { size: 12, weight: 700, anchor: 'middle' });
  s += rr(52, 454, 134, 40, 12, '#FFFFFF', { stroke: C.ink, sw: 2 }) + text(119, 480, 'Eraser (refund)', { size: 12, weight: 700, anchor: 'middle' });
  // canvas grid
  const gx = 430, gy = 92, bs = 31;
  s += rr(214, 66, 690, 464, 18, '#E8F2F6', { stroke: C.ink, sw: 2.5 });
  for (let c = 0; c <= 8; c++) s += line(gx + c * bs, gy, gx + c * bs, gy + 10 * bs, '#9BB8C4', 1.5, { dash: '4 4' });
  for (let r = 0; r <= 10; r++) s += line(gx, gy + r * bs, gx + 8 * bs, gy + r * bs, '#9BB8C4', 1.5, { dash: '4 4' });
  s += rr(gx, gy, 8 * bs, 10 * bs, 0, 'none', { stroke: C.you, sw: 2, extra: ' stroke-dasharray="10 6" opacity="0.6"' });
  s += small(gx + 4, gy - 6, 'Size cap 8 x 10 (Tinker Tree)', { size: 12 });
  const lay = ['........', '........', 'TTTTTTTT', 'TnnTTnnl', 'TnnTTnnl', 'CCCkkCCC', 'CCCkkCCC', 'CnnCCnnl', 'CnnCCnnl', 'FFFFFFFF'];
  s += fort(gx, gy, lay, bs, { crew: [{ r: 3, c: 1, cls: 'lobber', tool: false }, { r: 3, c: 5, cls: 'zinger', tool: false }, { r: 7, c: 1, cls: 'patcher', tool: false }], legs: 3, flag: false });
  s += rr(gx + 5 * bs + 3, gy + 7 * bs + 3, 2 * bs - 6, 2 * bs - 6, 6, C.saffron, { op: .25, stroke: C.saffronD, sw: 2.5, extra: ' stroke-dasharray="6 4"' }) + text(gx + 6 * bs, gy + 8 * bs + 5, 'Free Nook', { size: 11, weight: 700, anchor: 'middle', fill: C.ink });
  s += rr(gx + 6 * bs, gy + 1 * bs, bs, bs, 6, C.cb, { op: .55, stroke: C.good, sw: 3 });
  { let h = ''; for (let k = -1; k < 4; k++) h += line(gx + 2 * bs + k * 9, gy + bs, gx + 2 * bs + k * 9 + bs, gy, C.danger, 2); s += L.clipped(rr(gx + 2 * bs, gy, bs, bs, 6, '#000'), h) + rr(gx + 2 * bs, gy, bs, bs, 6, 'none', { stroke: C.danger, sw: 3 }) + circ(gx + 3 * bs - 2, gy + 2, 8, '#FFFFFF', { stroke: C.danger, sw: 2 }) + path(`M${gx + 3 * bs - 6} ${gy + 4} l4 -5 l4 5`, 'none', { stroke: C.danger, sw: 2 }) + small(gx + 3 * bs + 10, gy + 20, 'no support', { size: 11, fill: C.danger }); }
  s += g(path('M0 0 L0 26 L7 20 L12 32 L17 30 L12 18 L22 18 Z', '#FFFFFF', { stroke: C.ink, sw: 2 }), `translate(${gx + 6.6 * bs} ${gy + 1.6 * bs})`);
  // bottom tools
  s += rr(230, 478, 120, 40, 20, '#FFFFFF', { stroke: C.ink, sw: 2 }) + text(290, 504, 'Undo', { size: 15, weight: 700, anchor: 'middle' });
  s += rr(360, 478, 120, 40, 20, '#FFFFFF', { stroke: C.ink, sw: 2 }) + text(420, 504, 'Mirror', { size: 15, weight: 700, anchor: 'middle' });
  s += button(720, 474, 170, 44, 'Test Yard', { fill: C.you, dark: C.youD, tc: '#FFFFFF', size: 18 });
  // right crew panel
  s += rr(916, 66, 240, 464, 18, C.paper, { stroke: C.ink, sw: 2.5 });
  s += text(934, 98, 'Crew  3 of 4 in Nooks', { size: 18, weight: 700 });
  [['lobber', 'Marge Dumpling', 'Rank 2'], ['zinger', 'Quill Needlesworth', 'Rank 1'], ['patcher', 'Hetty Mortarboard', 'Rank 3'], ['delver', 'Grub Mudgett', 'Rank 1']].forEach(([c, n, lv], i) => {
    const y = 112 + i * 78;
    s += rr(928, y, 216, 68, 14, i === 3 ? C.saffronL : '#FFFFFF', { stroke: C.ink, sw: i === 3 ? 3 : 2 });
    s += L.clipped(rr(934, y + 6, 56, 56, 10, '#000'), rr(934, y + 6, 56, 56, 0, '#F3E7CF') + hob(c, 960, y + 92, .62, { tool: false }));
    s += text(998, y + 28, n, { size: 13, weight: 700 }) + classIcon(c, 1008, y + 48, 9) + small(1022, y + 53, `${L.CLASS_NAME[c]}  ${lv}`, { size: 12 });
    s += i === 3 ? text(1136, y + 28, 'Drag', { size: 11, weight: 700, anchor: 'end', fill: C.saffronD }) : circ(1130, y + 20, 8, C.good, { stroke: C.ink, sw: 1.5 });
  });
  s += rr(928, 432, 216, 86, 14, '#EAF6E6', { stroke: C.good, sw: 2 });
  s += text(940, 456, 'Fort check', { size: 14, weight: 700 }) + small(940, 478, 'Kettle Room is closed in.', { size: 12 }) + small(940, 496, 'One Hob still needs a Nook.', { size: 12 });
  out('18-workshop-mockup.svg', phone(s, 'Workshop: castle builder', 'Drag blocks onto the grid, put Hobs in Nooks, test in the Test Yard. Bad spots glow red before you drop.'));
}

// ================================================================ 19 Tinker Tree (per 07 §4.4, 02 §1)
{
  const W = 1900, H = 1146;
  let s = rr(0, 0, W, H, 0, '#2E2433');
  for (let k = 0; k < 90; k++) s += circ((k * 137) % W, (k * 71) % H, 1.6, '#FFFFFF', { op: .12 });
  s += text(50, 62, 'Tinker Tree: four branches', { size: 40, weight: 700, fill: C.paper });
  s += small(50, 92, 'Aim, Fort, Crew, Kit. 36 nodes at launch, 9 per branch in three tiers, one fork per branch. Node names follow 02-tech-tree. The launch tree is two phone screens wide.', { size: 17, fill: '#D8CDB8' });
  // top bar
  s += rr(50, 112, 1420, 50, 25, C.paper, { stroke: C.ink, sw: 2.5 });
  s += path('M84 126 L72 137 L84 148', 'none', { stroke: C.ink, sw: 4 }) + text(104, 146, 'Tinker Tree', { size: 24, weight: 700 }) + small(260, 144, 'Place Pennants. Take them back any time for free.', { size: 15 });
  s += pennant(1196, 150, .8) + text(1222, 146, '5', { size: 24, weight: 700 }) + small(1248, 144, 'spent 18 of 23', { size: 15 });
  const pipe = (d, w = 16) => path(d, 'none', { stroke: C.ink, sw: w + 6 }) + path(d, 'none', { stroke: C.br, sw: w }) + path(d, 'none', { stroke: C.brL, sw: w * .25, op: .7 });
  // tier bands
  const COL = (k) => 372 + k * 136;
  const tiers = [['Tier 1', 'after Grand Fort 1', 0, 2, true], ['Tier 2', 'after Grand Fort 2', 3, 4, true], ['Tier 3', 'after Grand Fort 3', 5, 7, false]];
  tiers.forEach(([t, sub, a, b, open]) => {
    const x = COL(a) - 62, w = COL(b) - COL(a) + 124;
    s += rr(x, 180, w, 866, 20, '#FFFFFF', { op: open ? .05 : .02 }) + rr(x, 180, w, 866, 20, 'none', { stroke: '#FFFFFF', sw: 1.5, op: .18, extra: ' stroke-dasharray="6 8"' });
    s += text(x + 16, 208, t, { size: 18, weight: 700, fill: C.paper }) + small(x + 82, 207, sub, { size: 13.5, fill: '#D8CDB8' });
    if (!open) s += rr(x + w - 164, 190, 152, 26, 13, '#5A5060', { stroke: C.ink, sw: 1.5 }) + text(x + w - 88, 208, 'Beat the Great Sump', { size: 12.5, weight: 700, anchor: 'middle', fill: '#E6DFEA' });
  });
  // updates grow at the right-hand end
  s += rr(COL(7) + 74, 180, 62, 866, 20, 'none', { stroke: '#FFFFFF', sw: 1.5, op: .14, extra: ' stroke-dasharray="3 9"' }) + text(COL(7) + 105, 600, 'U2 and U3 nodes grow here', { size: 13.5, weight: 700, fill: '#9A90A4', anchor: 'middle', rot: 90 });
  // workbench at bottom left, crooked trunk
  s += rr(70, 1044, 14, 36, 2, C.tbD, { stroke: C.ink, sw: 2.5 }) + rr(218, 1044, 14, 36, 2, C.tbD, { stroke: C.ink, sw: 2.5 }) + rr(170, 1000, 50, 18, 4, C.steel, { stroke: C.ink, sw: 2.5 }) + g(path('M0 0 L24 -13 L29 -5 L5 8 Z', C.steelL, { stroke: C.ink, sw: 2 }), 'translate(76 1008)');
  s += pipe('M140 1026 C130 880 156 760 136 610 C122 480 148 380 134 296', 30) + rr(56, 1018, 190, 26, 5, C.tb, { stroke: C.ink, sw: 3 });
  const leaf = {
    arrow: path('M-11 0 L3 -9 L3 -4 L11 -4 L11 4 L3 4 L3 9 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8, extra: ' transform="scale(-1 1)"' }),
    brick: rr(-11, -7, 22, 14, 2.5, '#FFFFFF', { stroke: C.ink, sw: 1.8 }) + line(-11, 0, 11, 0, C.ink, 1.3) + line(0, -7, 0, 0, C.ink, 1.3) + line(-5, 0, -5, 7, C.ink, 1.3) + line(5, 0, 5, 7, C.ink, 1.3),
    hat: path('M-9 5 C-9 -10 9 -10 9 5 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8 }) + rr(-12, 3, 24, 5, 2.5, '#FFFFFF', { stroke: C.ink, sw: 1.8 }) + circ(0, -8, 2.5, '#FFFFFF', { stroke: C.ink, sw: 1.5 }),
    kettle: path('M-9 7 C-12 -6 12 -6 9 7 Z', '#FFFFFF', { stroke: C.ink, sw: 1.8 }) + path('M8 -1 L14 -6', 'none', { stroke: C.ink, sw: 2.5 }) + path('M-6 -5 C-6 -13 6 -13 6 -5', 'none', { stroke: C.ink, sw: 1.8 }),
  };
  // states: own, buy (can buy now), dear (in reach, too dear), lock (parent not owned), tier (tier not open), valve (other side of the fork)
  const BR = [
    { n: 'Aim', col: '#8FD0F2', y: 326, leaf: 'arrow', nodes: [['Trick Sight', 'own', 1], ['Long Sight', 'own', 1], ['Bracket Ring', 'own', 2], ['Eagle Sight', 'own', 3], ['Dead Eye', 'own', 3], ["Spotter's Eye", 'valve', 3], ['Ricochet', 'tier', 4], ['Called Shot', 'tier', 5], ['Gust Rider', 'tier', 6]] },
    { n: 'Fort', col: '#E0A56A', y: 526, leaf: 'brick', nodes: [['Wider Footing', 'own', 1], ['Stacker', 'own', 1], ['Braces', 'buy', 2], ['Brass Forge', 'buy', 3], ['Spring Bricks', 'lock', 3], ['Rubble Catch', 'lock', 3], ['Grand Keep', 'tier', 4], ['Counterweight', 'tier', 5], ['Pop-Up Wall', 'tier', 6]] },
    { n: 'Crew', col: '#F4A6C8', y: 726, leaf: 'hat', nodes: [['Bench Call', 'own', 1], ['Hard Hats', 'own', 1], ['Rally Horn', 'buy', 2], ['Buddy Shot', 'buy', 3], ['Brave Face', 'lock', 3], ['Many Hands', 'lock', 3], ['Pep Talk', 'tier', 4], ['Hot Streak', 'tier', 5], ['Last Stand', 'tier', 6]] },
    { n: 'Kit', col: '#F2A469', y: 926, leaf: 'kettle', nodes: [['Free Hand', 'own', 1], ['Hops and Lobs', 'own', 1], ['Bigger Boiler', 'own', 2], ['Scarecrow', 'buy', 3], ['Spare Pocket', 'buy', 3], ['Double Up', 'buy', 3], ['Stomp', 'tier', 4], ['Splash and Smoke', 'tier', 5], ['Steam Shot', 'tier', 6]] },
  ];
  let pipes = '', nodes = '';
  const cog = (nx, ny, nm, st, cost, col, sel, pos = 0) => {
    let c = '';
    const dim = st === 'lock' || st === 'tier' || st === 'valve';
    if (sel) c += circ(nx, ny, 46, C.gold, { op: .4 });
    if (st === 'buy') c += circ(nx, ny, 38, '#FFFFFF', { op: .16 });
    for (let t = 0; t < 10; t++) { const ta = t * Math.PI / 5; c += rr(nx + Math.cos(ta) * 28 - 5, ny + Math.sin(ta) * 28 - 5, 10, 10, 2.5, dim ? '#6A6070' : col, { stroke: C.ink, sw: 1.8, op: dim ? .7 : 1 }); }
    c += circ(nx, ny, 28, st === 'own' ? col : dim ? '#5A5060' : '#FFFFFF', { stroke: C.ink, sw: 3.5 });
    if (st === 'own') c += path(`M${nx - 11} ${ny} l8 8 l14 -17`, 'none', { stroke: C.ink, sw: 4.5 });
    if (st === 'lock' || st === 'tier') c += path(`M${nx - 12} ${ny - 4} a5 5 0 1 1 8 0 M${nx + 4} ${ny + 4} a5 5 0 1 0 8 0 M${nx - 4} ${ny - 1} L${nx + 4} ${ny + 1}`, 'none', { stroke: '#B0A6B8', sw: 3 });
    if (st === 'valve') c += circ(nx, ny, 9, 'none', { stroke: '#B0A6B8', sw: 3 }) + line(nx - 14, ny, nx + 14, ny, '#B0A6B8', 3) + line(nx, ny - 9, nx, ny - 15, '#B0A6B8', 3);
    if (st === 'buy' || st === 'dear') {
      c += circ(nx, ny, 11, col, { stroke: C.ink, sw: 2 });
      const can = cost <= 5;
      const tx = pos ? nx + 30 : nx + 14, ty = pos ? ny - 12 : ny - 46;
      c += rr(tx, ty, 46, 24, 12, can ? C.gold : '#8A8090', { stroke: C.ink, sw: 2 }) + g(path('M0 0 L0 -11 L9 -7.5 L0 -4', can ? C.ink : '#FFFFFF'), `translate(${tx + 9} ${ty + 18})`) + text(tx + 30, ty + 17.5, can ? String(cost) : `-${cost - 5}`, { size: 15, weight: 700, anchor: 'middle', fill: can ? C.ink : '#FFFFFF' });
    }
    c += text(nx, pos < 0 ? ny - 40 : ny + 52, nm, { size: 14.5, weight: 700, anchor: 'middle', fill: dim ? '#A79EAF' : C.paper });
    return c;
  };
  BR.forEach((b) => {
    const y0 = b.y, FK = 42;
    // branch pipe: straight run, a split through a two-way valve at the fork, and a join
    pipes += pipe(`M138 ${y0} L${COL(3) + 40} ${y0}`, 11);
    pipes += pipe(`M${COL(3) + 40} ${y0} C${COL(4) - 50} ${y0} ${COL(4) - 50} ${y0 - FK} ${COL(4)} ${y0 - FK} C${COL(4) + 50} ${y0 - FK} ${COL(4) + 50} ${y0} ${COL(5) - 44} ${y0}`, 9);
    pipes += pipe(`M${COL(3) + 40} ${y0} C${COL(4) - 50} ${y0} ${COL(4) - 50} ${y0 + FK} ${COL(4)} ${y0 + FK} C${COL(4) + 50} ${y0 + FK} ${COL(4) + 50} ${y0} ${COL(5) - 44} ${y0}`, 9);
    pipes += pipe(`M${COL(5) - 44} ${y0} L${COL(7)} ${y0}`, 11);
    // two-way valve wheel at the split, turned to the open side
    const vx = COL(3) + 56, open = b.nodes[4][1] === 'own' ? -1 : b.nodes[5][1] === 'own' ? 1 : 0;
    nodes += circ(vx, y0, 12, C.danger, { stroke: C.ink, sw: 2.5 }) + circ(vx, y0, 4, C.paper, { stroke: C.ink, sw: 1.5 }) + (open ? path(`M${vx} ${y0} l10 ${open * 12}`, 'none', { stroke: C.ink, sw: 3 }) : line(vx - 12, y0, vx + 12, y0, C.ink, 3));
    // branch tag with its own leaf shape
    nodes += rr(180, y0 - 62, 122, 36, 18, b.col, { stroke: C.ink, sw: 2.5 }) + g(leaf[b.leaf], `translate(206 ${y0 - 44}) scale(1.15)`) + text(254, y0 - 37, b.n, { size: 19, weight: 700, anchor: 'middle' });
    b.nodes.forEach(([nm, st, cost], k) => {
      const col = k < 4 ? k : k < 6 ? 4 : k - 1;
      const ny = k === 4 ? y0 - FK : k === 5 ? y0 + FK : y0;
      nodes += cog(COL(col), ny, nm, st, cost, b.col, nm === 'Brass Forge', k === 4 ? -1 : k === 5 ? 1 : 0);
    });
  });
  s += pipes + nodes;
  // one phone screen
  s += rr(40, 172, 930, 920, 26, 'none', { stroke: C.paper, sw: 2.5, op: .5, extra: ' stroke-dasharray="14 10"' }) + rr(58, 190, 250, 28, 14, C.paper, { op: .95 }) + text(183, 209, 'One phone screen. Pan for more', { size: 13.5, weight: 700, anchor: 'middle' });
  // branch rail
  ['Aim', 'Fort', 'Crew', 'Kit'].forEach((n, i) => { s += rr(330 + i * 150, 1104, 136, 30, 12, i === 1 ? C.saffronL : '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + g(leaf[BR[i].leaf], `translate(${362 + i * 150} 1119) scale(.8)`) + text(410 + i * 150, 1125, n, { size: 16, weight: 700, anchor: 'middle' }); });
  s += rr(1010, 1104, 190, 30, 12, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + text(1105, 1125, 'Untinker all', { size: 16, weight: 700, anchor: 'middle' });
  // node card
  const px = 1520;
  s += panel(px, 112, 330, 590);
  s += circ(px + 165, 196, 50, '#E0A56A', { stroke: C.ink, sw: 3.5 }) + block('brass', px + 137, 168, 56, 0, 2);
  s += text(px + 165, 286, 'Brass Forge', { size: 30, weight: 700, anchor: 'middle' });
  s += small(px + 165, 312, 'Fort branch. Tier 2. Needs Wider Footing or Stacker', { anchor: 'middle', size: 12.5 });
  s += text(px + 165, 350, 'Unlocks Brassbound blocks.', { size: 18, weight: 600, anchor: 'middle', family: BODY });
  s += rr(px + 28, 370, 274, 130, 14, '#F3E7CF', { stroke: C.ink, sw: 2 });
  for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) s += block(c === 2 ? 'brass' : 'timber', px + 52 + c * 34, 404 + r * 34, 34, 0, c + r * 3) + block('brass', px + 176 + c * 34, 404 + r * 34, 34, 0, c + r * 3 + 9);
  s += path(`M${px + 158} 438 l12 0 m-5 -5 l5 5 l-5 5`, 'none', { stroke: C.ink, sw: 2.5 }) + small(px + 103, 392, 'before', { anchor: 'middle', size: 12.5 }) + small(px + 227, 392, 'after', { anchor: 'middle', size: 12.5 });
  s += text(px + 126, 546, 'Price', { size: 18, weight: 700, anchor: 'middle' }) + pennant(px + 172, 552, .8) + text(px + 198, 548, '× 3', { size: 26, weight: 700 });
  s += button(px + 28, 572, 274, 52, 'Buy', { size: 24 });
  s += rr(px + 28, 640, 274, 40, 14, '#FFFFFF', { stroke: C.ink, sw: 2.5 }) + text(px + 165, 667, 'Try in the Test Yard', { size: 16, weight: 700, anchor: 'middle' });
  // legend
  s += panel(px, 724, 330, 398, { fill: '#3A2F40', stitchOn: false });
  s += text(px + 24, 760, 'Node states', { size: 20, weight: 700, fill: C.paper });
  const lg = [['own', 'Owned: lit, with a tick'], ['buy', 'Can buy now: gold price tag'], ['dear', 'In reach, too dear: grey tag'], ['lock', 'Locked: parent or tier first'], ['valve', 'Other side of the fork']];
  lg.forEach(([st, t], i) => { s += g(cog(0, 0, '', st, st === 'dear' ? 6 : 3, '#E0A56A', false), `translate(${px + 48} ${806 + i * 54}) scale(.5)`) + small(px + 96, 811 + i * 54, t, { size: 14.5, fill: C.paper }); });
  s += small(px + 24, 1100, 'Forecast, ghost lines and the shot log are free.', { size: 12.5, fill: '#D8CDB8' });
  out('19-tinker-tree-mockup.svg', doc(W, H, s, { title: 'Tinker Tree', desc: 'A crooked brass pipe tree grows from a workbench, trunk at left, four branches to the right: Aim, Fort, Crew, Kit. 36 nodes at launch, one fork per branch.' }));
}

// ================================================================ 20 palette and style
{
  const W = 1800, H = 1300;
  let s = rr(0, 0, W, H, 0, C.paper) + rr(0, 0, W, H, 0, 'url(#paperDots)');
  s += text(60, 76, 'Palette and style guide', { size: 44, weight: 700 }) + small(60, 108, 'Patchwork storybook: chunky rounded shapes, warm ink outlines, flat fills with one hard shade, stitched seams.', { size: 19 });
  const chips = (x, y, title, list) => {
    let t = text(x, y, title, { size: 22, weight: 700 });
    list.forEach(([n, h, tag], i) => {
      const cx = x + (i % 4) * 200, cy = y + 20 + Math.floor(i / 4) * 78;
      t += rr(cx, cy, 56, 56, 12, h, { stroke: C.ink, sw: 2.5 }) + text(cx + 66, cy + 24, n, { size: 15, weight: 700 }) + text(cx + 66, cy + 46, h, { size: 14, weight: 500, family: 'JetBrains Mono, monospace', fill: C.ink2 });
      if (tag) t += rr(cx + 30, cy - 9, 34, 19, 9.5, C.ink2, { stroke: C.ink, sw: 1.5 }) + text(cx + 47, cy + 5, tag, { size: 11.5, weight: 700, anchor: 'middle', fill: C.paper });
    });
    return t;
  };
  s += chips(60, 160, 'UI core', [['Ink', C.ink], ['Ink soft', C.ink2], ['Paper', C.paper], ['Cream', C.cream], ['Action gold', C.saffron], ['Action dark', C.saffronD], ['Pennant gold', C.gold], ['Kettle glow', C.glow]]);
  s += chips(60, 360, 'Teams and states', [['You (Hobs)', C.you], ['Rival', C.rival], ['Flattener grey', C.indigo], ['Flattener cream', C.fcream], ['Good', C.good], ['Danger', C.danger], ['Kettle copper', C.copper], ['Squall slate', C.slate]]);
  s += chips(900, 160, 'Hob Classes (hat only)', L.CLASSES.map(c => [L.CLASS_NAME[c], C[c], c === 'peeper' ? 'U2' : '']));
  s += chips(900, 360, 'Skin tones (any Class)', L.SKINS.map((h, i) => ['Skin ' + (i + 1), h]));
  s += chips(60, 560, 'Damage types: none is orange or team blue', [['Blast', '#FFF3C4'], ['Pierce', '#FFF3A6'], ['Dig', '#9A6440'], ['Fire: ember red', C.fire], ['Frost', '#9FD8EE', 'U2'], ['Zap: violet', '#B49CFF', 'U3'], ['Crush, Fall', '#CFC8C0'], ['Heal', C.heal]]);
  s += chips(900, 560, 'Materials', [['Wicker', C.wk], ['Timber', C.tb], ['Cobble', C.cb], ['Brass plate', C.bp], ['Brass band', C.br], ['Footing', C.ft], ['Moonbrick', C.mb, 'U3'], ['Moon veins', C.mbG, 'U3']]);
  // line and shade rules
  const y0 = 780;
  s += rr(60, y0, 820, 470, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(84, y0 + 40, 'Shape, line, shade', { size: 24, weight: 700 });
  s += g(hob('lobber', 0, 0, 1.6), `translate(170 ${y0 + 260})`) + g(flattener('tamper', 0, 0, 1.6), `translate(330 ${y0 + 260})`);
  s += small(110, y0 + 300, 'Hobs: circles, lumps, domes');
  s += small(290, y0 + 320, 'Flatteners: boxes, rollers');
  s += block('cobble', 470, y0 + 80, 130, 0, 3);
  s += line(600, y0 + 80, 660, y0 + 60, C.ink, 1.5) + small(664, y0 + 64, 'Outline: ink #2B1E2E', { size: 13 });
  s += line(590, y0 + 190, 660, y0 + 200, C.ink, 1.5) + small(664, y0 + 204, 'One hard shade, 14% ink', { size: 13 });
  s += line(500, y0 + 88, 660, y0 + 120, C.ink, 1.5) + small(664, y0 + 124, 'Hi tick, 45% white', { size: 13 });
  s += stitch(`M470 ${y0 + 250} L860 ${y0 + 250}`, C.ink, 2.5, .5, '6 6') + small(470, y0 + 276, 'Stitched seam: the house motif', { size: 13 });
  s += small(84, y0 + 380, 'Outline width at final size: 2 px on 32 px blocks, 3 px on Hobs at 64 px,', { size: 15 });
  s += small(84, y0 + 404, '4 px on UI panels. Never pure black. Never gradients on characters.', { size: 15 });
  s += small(84, y0 + 428, 'Light comes from the top left. Shade sits bottom right.', { size: 15 });
  // type
  s += rr(920, y0, 820, 470, 18, '#FFFFFF', { stroke: C.ink, sw: 2.5 });
  s += text(944, y0 + 40, 'Type', { size: 24, weight: 700 });
  s += text(944, y0 + 110, 'Fredoka Bold', { size: 54, weight: 700 }) + small(944, y0 + 134, 'Titles, buttons, numbers in play. OFL, Google Fonts.', { size: 15 });
  s += text(944, y0 + 200, 'Fredoka Medium 28', { size: 28, weight: 500 }) + small(944, y0 + 222, 'Labels, card names.', { size: 15 });
  s += text(944, y0 + 280, 'Nunito SemiBold for body and help text, 16 to 18 px.', { size: 20, weight: 600, family: BODY });
  s += small(944, y0 + 304, 'OFL, Google Fonts. Wide language cover; CJK fallback: Noto Sans.', { size: 15 });
  s += text(944, y0 + 380, '52.3°   Pow 74   -42', { size: 40, weight: 700, fill: C.paper, stroke: C.ink, sw: 8 });
  s += small(944, y0 + 410, 'In-play numbers: Fredoka Bold, paper fill, ink stroke.', { size: 15 });
  s += small(944, y0 + 434, 'Baked to a bitmap font for the battle HUD.', { size: 15 });
  out('20-palette-and-style.svg', doc(W, H, s, { title: 'Palette and style guide', desc: 'Colours, line rules and type. Fire is ember red, Zap violet, Peeper lemon, Moonbrick veins violet.' }));
}
