// Shared drawing kit for Castle Protect concept SVGs.
// Every output SVG is self-contained: no external refs, no images.

export const FONT = "Fredoka, 'Baloo 2', Nunito, 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
export const BODY = "Nunito, Fredoka, 'Trebuchet MS', sans-serif";

export const C = {
  ink: '#2B1E2E', ink2: '#4A3A4C', paper: '#FFF4DE', cream: '#FBE9C4', parch: '#F3DDB0',
  saffron: '#FFC23D', saffronD: '#D9952B', saffronL: '#FFE08A',
  you: '#2F6FDE', youD: '#1F4FA8', youL: '#9DBDF5', rival: '#E8730C', rivalD: '#B35400', rivalL: '#FFB070',
  indigo: '#8A90A2', indigoD: '#5B6172', indigoL: '#C9CDD8', fcream: '#F2E8D5', fcap: '#4A4F5E',
  steel: '#8C93A8', steelD: '#5E6478', steelL: '#C3C8D6',
  teal: '#2FB7A6', glow: '#4FE3C1', glowL: '#C8FFF0',
  danger: '#E5484D', good: '#5CC35A', gold: '#FFD23F', goldD: '#D9A514',
  sky1: '#BFE6F2', sky2: '#FFF1D0',
  // materials
  wk: '#E3B565', wkD: '#B8843A', wkL: '#F6D894', wkH: '#6B4A22',
  tb: '#B9733A', tbD: '#87491F', tbL: '#D9985A', tbH: '#4A2A16',
  cb: '#A9A39A', cbD: '#77716B', cbL: '#CFCAC0', cbM: '#8A8378', cbH: '#3B3633',
  bp: '#6B7A86', bpD: '#47525C', bpL: '#8C9BA6', br: '#E0AE3E', brD: '#A9781E', brL: '#F7D57A', bpH: '#2A3036',
  mb: '#E6E9F5', mbD: '#AEB5D6', mbL: '#FFFFFF', mbG: '#B9A8FF', mbE: '#CDD3EE', mbH: '#3A3F66',
  ft: '#5A4A42', ftD: '#3F332D', ftL: '#7A6A60', ftB: '#A3938A',
  // class colours
  lobber: '#D9483B', zinger: '#3FA9F5', scatter: '#8BCB3A', delver: '#9A6A3A',
  boinker: '#F06EAA', sizzler: '#B8325A', patcher: '#2FB7A6', peeper: '#F2E05A',
  soot: '#3A3236', blush: '#F28B82',
  fire: '#E0392B', fireM: '#F26B4E', heal: '#7DDC7A', healD: '#3E9A4A', slate: '#6F7E9A', copper: '#D9773A',
};

// Part 2 WCAG AA+ Visual Design System color tokens (04_Art_Design_UX_Critique_Before_After.md §3).
export const PALETTE_V2 = {
  // High-contrast ink & warm parchment surfaces (13.4:1 AAA)
  ink: '#2C221E',
  inkSoft: '#4D3D36',
  parchment: '#FFF4DE',
  parchmentAlt: '#FAF3E3',
  parchmentEdge: '#C9B08A',
  // Semantic status badges (AA+ verified)
  goodInk: '#1F6B29',       // 6.1:1 AA+ with #FFFFFF text
  goodFill: '#8BD888',      // paired with #2C221E ink
  orangeInk: '#A94D00',     // 5.4:1 AA on parchment (text/pills)
  orangeFill: '#E8730C',    // rival icons/fills with #2C221E border
  badInk: '#A61C24',        // 6.8:1 AA on #FDECEE
  badBg: '#FDECEE',         // tinted error card surface
  badBorder: '#C9363E',     // crisp validation card border
  // Tactile brass chrome & cutaway fort interiors
  brass: '#E0AE3E',
  brassLight: '#F7D57A',
  brassDark: '#A9781E',
  copper: '#D9773A',
  copperDark: '#9A481E',
  nookBacking: '#3B2D24',   // opaque cutaway recessed timber backing
  nookBackingD: '#2B1F19',
  nookBackingL: '#523F33',
  nookGlaze: '#FFF4DE',     // subtle 18% warm window glaze overlay
  // Faction silhouette contrast: Rigid Flatteners vs Plump Hobs
  flattenerSlate: '#5A6572',
  flattenerSlateD: '#3D4652',
  flattenerSlateL: '#7E8A98',
  flattenerBubble: '#4ADE80',
  flattenerGlove: '#FFFFFF',
  // Painterly earth cross-section strata & atmospheric haze
  soilLoam: '#9A6440',
  soilClay: '#C26D47',
  soilClayD: '#9E4F2F',
  soilClayL: '#D98962',
  soilRock: '#6B7480',
  soilRockD: '#4B535E',
  soilRockL: '#8E99A8',
  soilBedrock: '#3A3D45',
  soilBedrockD: '#282B32',
  soilBedrockL: '#505560',
  // Topiary Keep botanicals & bioluminescent sprinkler root
  hedgeDeep: '#2E6B38',
  hedgeMid: '#438F48',
  hedgeLight: '#68B85F',
  hedgeTip: '#92D478',
  bioGlow: '#4FE3C1',
  bioGlowBright: '#C8FFF0',
  hazeSky: '#BFE6F2',
};

export const SKINS = ['#F2C9A0', '#D99A6C', '#A8673F', '#7A4A2E', '#F5D7B8', '#C68457'];
export const COATS = ['#7D6B5D', '#6F7F5A', '#8A5A4A', '#5F6B7A', '#94785A', '#6A5A7A', '#7A6A4A', '#5A7468'];

let uid = 0;
export const id = (p = 'i') => `${p}${++uid}`;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => (Math.round(n * 10) / 10).toString();
export { f };

export function doc(w, h, body, { title = '', desc = '', defs = '', bg = null } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">
<title>${esc(title)}</title>
<desc>${esc(desc)}</desc>
<defs>
<filter id="sil" color-interpolation-filters="sRGB"><feFlood flood-color="${C.ink}"/><feComposite in2="SourceAlpha" operator="in"/></filter>
<filter id="silW" color-interpolation-filters="sRGB"><feFlood flood-color="#FFFFFF"/><feComposite in2="SourceAlpha" operator="in"/></filter>
<pattern id="paperDots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="${C.ink}" opacity="0.06"/><circle cx="16" cy="16" r="1" fill="${C.ink}" opacity="0.05"/></pattern>
${defs}
</defs>
${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}
${body}
</svg>
`;
}

export function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function text(x, y, s, o = {}) {
  const { size = 20, weight = 600, fill = C.ink, anchor = 'start', stroke = null, sw = 0, family = FONT, ls = 0, op = 1, rot = 0, style = '' } = o;
  const st = stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke"` : '';
  const tr = rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : '';
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="${family}"${ls ? ` letter-spacing="${ls}"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}${st}${tr}${style ? ` style="${style}"` : ''}>${esc(s)}</text>`;
}

export function rr(x, y, w, h, r, fill, o = {}) {
  const { stroke = null, sw = 3, op = 1, extra = '' } = o;
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}${extra}/>`;
}
export function circ(x, y, r, fill, o = {}) {
  const { stroke = null, sw = 3, op = 1, extra = '' } = o;
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}${extra}/>`;
}
export function ell(x, y, rx, ry, fill, o = {}) {
  const { stroke = null, sw = 3, op = 1, extra = '' } = o;
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}${extra}/>`;
}
export function path(d, fill, o = {}) {
  const { stroke = null, sw = 3, op = 1, cap = 'round', dash = null, extra = '' } = o;
  return `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="${cap}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}${extra}/>`;
}
export function line(x1, y1, x2, y2, stroke, sw = 3, o = {}) {
  const { dash = null, op = 1, cap = 'round' } = o;
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}"${dash ? ` stroke-dasharray="${dash}"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}/>`;
}
export const g = (inner, tr = '', extra = '') => `<g${tr ? ` transform="${tr}"` : ''}${extra}>${inner}</g>`;

// polygon from points
export const poly = (pts) => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join(' L') + ' Z';

// Lumpy hill silhouette across [x0,x1] with base at yb, using control heights.
export function hillPath(x0, x1, yb, tops) {
  // tops: array of [x, y] peaks; smooth with cubic curves
  let d = `M${f(x0)} ${f(yb)} L${f(x0)} ${f(tops[0][1])}`;
  for (let i = 0; i < tops.length - 1; i++) {
    const [ax, ay] = tops[i], [bx, by] = tops[i + 1];
    const mx = (ax + bx) / 2;
    d += ` C${f(mx)} ${f(ay)} ${f(mx)} ${f(by)} ${f(bx)} ${f(by)}`;
  }
  d += ` L${f(x1)} ${f(tops[tops.length - 1][1])} L${f(x1)} ${f(yb)} Z`;
  return d;
}

export function hillSurface(x0, x1, tops) {
  let d = `M${f(x0 - 20)} ${f(tops[0][1])} L${f(tops[0][0])} ${f(tops[0][1])}`;
  for (let i = 0; i < tops.length - 1; i++) {
    const [ax, ay] = tops[i], [bx, by] = tops[i + 1];
    const mx = (ax + bx) / 2;
    d += ` C${f(mx)} ${f(ay)} ${f(mx)} ${f(by)} ${f(bx)} ${f(by)}`;
  }
  return d + ` L${f(x1 + 20)} ${f(tops[tops.length - 1][1])}`;
}
export function patch(x, y, w, h, rot, fill, o = {}) {
  const { op = 1 } = o;
  return g(rr(-w / 2, -h / 2, w, h, Math.min(w, h) * .25, fill, { op }) + rr(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, Math.min(w, h) * .2, 'none', { stroke: C.ink, sw: 2, op: .22, extra: ' stroke-dasharray="6 6"' }), `translate(${f(x)} ${f(y)}) rotate(${rot})`);
}

// stitched seam (dashed line) used as the signature "patchwork" motif
export function stitch(d, color = C.ink, sw = 2, op = 0.35, dash = '6 6') {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash}" stroke-linecap="round" opacity="${op}"/>`;
}

// soft hard-edged shade band clipped to a shape
export function clipped(shape, inner) {
  const cid = id('cp');
  return `<clipPath id="${cid}">${shape}</clipPath><g clip-path="url(#${cid})">${inner}</g>`;
}

// starburst (impact) with rounded look
export function burst(cx, cy, r1, r2, n, fill, o = {}) {
  const { stroke = C.ink, sw = 3, rot = 0 } = o;
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n + rot;
    const r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return path(poly(pts), fill, { stroke, sw });
}

export function puff(cx, cy, r, fill = '#FFFFFF', o = {}) {
  const { stroke = C.ink, sw = 2.5, op = 1 } = o;
  const d = cloudD(cx, cy, r);
  return path(d, fill, { stroke, sw, op });
}
export function cloudD(cx, cy, r) {
  // cluster of arcs forming a puff
  const w = r * 2.4, h = r * 1.2;
  const x0 = cx - w / 2, y0 = cy + h / 2;
  return `M${f(x0)} ${f(y0)} a${f(r * .5)} ${f(r * .5)} 0 0 1 ${f(r * .3)} ${f(-r * .9)} a${f(r * .6)} ${f(r * .6)} 0 0 1 ${f(r * .8)} ${f(-r * .5)} a${f(r * .7)} ${f(r * .7)} 0 0 1 ${f(r * 1.1)} ${f(r * .1)} a${f(r * .5)} ${f(r * .5)} 0 0 1 ${f(r * .2)} ${f(r * 1.3)} Z`;
}

// ---------------------------------------------------------------- blocks
const MAT = {
  wicker: { base: C.wk, d: C.wkD, l: C.wkL, h: C.wkH },
  timber: { base: C.tb, d: C.tbD, l: C.tbL, h: C.tbH },
  cobble: { base: C.cbM, d: C.cbD, l: C.cbL, h: C.cbH },
  brass: { base: C.bp, d: C.bpD, l: C.bpL, h: C.bpH },
  moon: { base: C.mb, d: C.mbD, l: C.mbL, h: C.mbH },
  footing: { base: C.ft, d: C.ftD, l: C.ftL, h: '#241C19' },
};
export { MAT };

// Draw one block at x,y size s. state: 0 fresh, 1 scuffed, 2 battered, 3 broken (rubble).
export function block(mat, x, y, s, state = 0, seed = 1) {
  const R = rng(seed * 97 + state * 13 + 7);
  const sw = Math.max(1.2, s * 0.055);
  const m = MAT[mat];
  const k = s / 100; // design unit: draw in 100-unit box
  let inner = '';
  const shape = rr(0, 0, 100, 100, 10, m.base);
  if (state === 3) return g(rubble(mat, R), `translate(${f(x)} ${f(y)}) scale(${f(k)})`);
  // interior surface
  if (mat === 'wicker') {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const alt = (r + c) % 2;
      const off = r % 2 ? -16 : 0;
      inner += rr(c * 36 + off + 2, r * 25 + 3, 34, 19, 9.5, alt ? C.wkL : C.wk, { stroke: C.wkD, sw: 2.2 });
      if (r % 2) inner += rr(3 * 36 - 16 + 2, r * 25 + 3, 34, 19, 9.5, (r + 3) % 2 ? C.wkL : C.wk, { stroke: C.wkD, sw: 2.2 });
    }
    for (let c = 0; c < 4; c++) inner += line(c * 33 + 1, 0, c * 33 + 1, 100, C.wkD, 3, { op: .5 });
  } else if (mat === 'timber') {
    for (let r = 0; r < 3; r++) {
      const y0 = r * 33.3;
      inner += rr(-2, y0 + 1.5, 104, 30.5, 4, r === 1 ? C.tb : '#B06C35', { stroke: C.tbD, sw: 2.5 });
      inner += path(`M8 ${f(y0 + 12 + R() * 6)} C30 ${f(y0 + 6)} 55 ${f(y0 + 22)} 92 ${f(y0 + 13)}`, 'none', { stroke: C.tbL, sw: 2.2, op: .8 });
      inner += path(`M20 ${f(y0 + 22)} C40 ${f(y0 + 18)} 60 ${f(y0 + 26)} 80 ${f(y0 + 21)}`, 'none', { stroke: C.tbD, sw: 1.6, op: .6 });
      inner += circ(9, y0 + 16, 3, C.tbH) + circ(91, y0 + 16, 3, C.tbH);
    }
  } else if (mat === 'cobble') {
    const stones = [[4, 4, 50, 28], [57, 4, 39, 28], [4, 35, 30, 29], [37, 35, 36, 29], [76, 35, 20, 29], [4, 67, 44, 29], [51, 67, 45, 29]];
    for (const [sx, sy, sw2, sh] of stones) {
      inner += rr(sx, sy, sw2, sh, 11, C.cb, { stroke: C.cbD, sw: 2.4 });
      inner += path(`M${sx + 6} ${sy + sh - 6} Q${sx + sw2 - 4} ${sy + sh - 2} ${sx + sw2 - 5} ${sy + 8}`, 'none', { stroke: C.cbD, sw: 3, op: .55 });
      inner += path(`M${sx + 6} ${sy + 9} Q${sx + 10} ${sy + 5} ${sx + 18} ${sy + 5}`, 'none', { stroke: C.cbL, sw: 3 });
    }
  } else if (mat === 'brass') {
    inner += rr(0, 0, 100, 100, 10, C.bp);
    inner += path('M12 88 L88 12', 'none', { stroke: C.bpD, sw: 4, op: .5 });
    inner += rr(-2, 6, 104, 14, 3, C.br, { stroke: C.brD, sw: 2.5 });
    inner += rr(-2, 80, 104, 14, 3, C.br, { stroke: C.brD, sw: 2.5 });
    inner += rr(43, -2, 14, 104, 3, C.br, { stroke: C.brD, sw: 2.5 });
    inner += line(2, 9, 98, 9, C.brL, 2.5);
    for (const [rx, ry] of [[12, 13], [88, 13], [12, 87], [88, 87], [50, 50], [50, 30], [50, 70]]) inner += circ(rx, ry, 4.2, C.brL, { stroke: C.brD, sw: 1.8 });
    inner += rr(8, 26, 30, 48, 4, C.bpL, { op: .35 });
  } else if (mat === 'moon') {
    inner += rr(0, 0, 100, 100, 10, C.mb);
    inner += rr(4, 4, 92, 92, 8, 'none', { stroke: C.mbE, sw: 3 });
    inner += path('M50 24 a26 26 0 1 0 22 40 a20 20 0 1 1 -22 -40 Z', C.mbE, { stroke: C.mbD, sw: 2 });
    inner += path('M8 70 C24 62 30 80 46 74 S70 84 92 76', 'none', { stroke: C.mbG, sw: 3, op: state === 2 ? .35 : .85 });
    inner += path('M60 10 C66 20 78 18 88 28', 'none', { stroke: C.mbG, sw: 2.5, op: state === 2 ? .3 : .7 });
    inner += star4(78, 50, 6, C.mbL);
  } else if (mat === 'footing') {
    inner += rr(0, 0, 100, 100, 6, C.ft);
    inner += path('M0 30 L25 50 L50 30 L75 50 L100 30', 'none', { stroke: C.ftL, sw: 6 });
    inner += path('M0 62 L25 82 L50 62 L75 82 L100 62', 'none', { stroke: C.ftL, sw: 6 });
    for (const [bx, by] of [[10, 10], [90, 10], [10, 90], [90, 90]]) inner += circ(bx, by, 4.5, C.ftB, { stroke: C.ftD, sw: 2 });
  }
  // shade band, highlight
  let shade = path('M100 58 L100 100 L0 100 L0 86 Q50 84 100 58 Z', C.ink, { op: .14 });
  let hi = path('M10 7 L40 7', 'none', { stroke: '#FFFFFF', sw: 4, op: .45 });
  // damage
  let dmg = '';
  if (state >= 1) dmg += damage(mat, state, R);
  const body = clipped(rr(0, 0, 100, 100, mat === 'footing' ? 6 : 10, '#000'), inner + shade + hi + dmg);
  const chip = state === 2 ? chipCorner(mat, R) : '';
  const outline = rr(0, 0, 100, 100, mat === 'footing' ? 6 : 10, 'none', { stroke: C.ink, sw: Math.max(3.2, 1.5 / k) });
  return g(body + outline + chip + (state >= 1 ? extrasOutside(mat, state, R) : ''), `translate(${f(x)} ${f(y)}) scale(${f(k)})`);
}

export function star4(cx, cy, r, fill, o = {}) {
  const { stroke = null, sw = 1.5, op = 1 } = o;
  const q = r * .28;
  return path(`M${f(cx)} ${f(cy - r)} Q${f(cx + q)} ${f(cy - q)} ${f(cx + r)} ${f(cy)} Q${f(cx + q)} ${f(cy + q)} ${f(cx)} ${f(cy + r)} Q${f(cx - q)} ${f(cy + q)} ${f(cx - r)} ${f(cy)} Q${f(cx - q)} ${f(cy - q)} ${f(cx)} ${f(cy - r)} Z`, fill, { stroke, sw, op });
}

function crack(pts, color = C.ink, sw = 3.5) {
  return path('M' + pts.map(p => p.join(' ')).join(' L'), 'none', { stroke: color, sw });
}

function damage(mat, st, R) {
  const m = MAT[mat];
  let s = '';
  if (mat === 'wicker') {
    s += path('M38 30 Q50 22 62 32 Q66 46 54 52 Q40 52 36 42 Z', C.wkH, { stroke: C.ink, sw: 3 });
    s += path('M40 30 L32 20 M50 26 L52 14 M62 33 L72 26 M56 52 L62 60 M38 46 L28 50', 'none', { stroke: C.wkL, sw: 3.5 });
    if (st === 2) {
      s += path('M10 60 Q22 50 36 58 Q44 72 34 84 Q18 88 10 78 Z', C.wkH, { stroke: C.ink, sw: 3 });
      s += path('M14 62 L4 54 M30 56 L32 46 M36 76 L46 80 M22 86 L20 96', 'none', { stroke: C.wkL, sw: 3.5 });
      s += path('M60 66 L90 74 M66 80 L84 92', 'none', { stroke: C.wkH, sw: 2.5, op: .7 });
      s += ell(70, 30, 22, 12, C.soot, { op: .25 });
    }
  } else if (mat === 'timber') {
    s += crack([[6, 46], [22, 50], [34, 44], [52, 52], [66, 46]]);
    s += crack([[34, 44], [40, 36]], C.ink, 2.5);
    s += circ(91, 16, 3.5, C.tbL);
    if (st === 2) {
      s += path('M-2 68 L30 68 L38 74 L28 80 L40 86 L30 92 L36 100 L-2 100 Z', C.tbH, { stroke: C.ink, sw: 3 });
      s += crack([[40, 14], [58, 20], [70, 12], [88, 22]]);
      s += crack([[60, 52], [80, 58], [96, 52]]);
      s += ell(64, 82, 24, 10, C.soot, { op: .28 });
    }
  } else if (mat === 'cobble') {
    s += crack([[20, 8], [28, 20], [24, 30], [34, 40], [46, 46]]);
    s += crack([[28, 20], [40, 18]], C.ink, 2.5);
    if (st === 2) {
      s += rr(37, 35, 36, 29, 10, C.cbH, { stroke: C.ink, sw: 3 });
      s += path('M42 60 L50 50 L60 58 L66 52 L70 62 Z', C.cbD, { op: .8 });
      s += crack([[70, 8], [76, 22], [70, 32]]);
      s += crack([[12, 70], [22, 80], [18, 92], [28, 98]]);
      s += crack([[60, 70], [72, 84], [88, 86]]);
      s += ell(24, 54, 18, 10, C.soot, { op: .2 });
    }
  } else if (mat === 'brass') {
    s += ell(28, 50, 13, 10, C.bpD, { stroke: C.bpH, sw: 2 }) + ell(25, 47, 7, 5, C.bpL, { op: .5 });
    s += path('M64 30 L82 42 M66 36 L78 46', 'none', { stroke: C.bpL, sw: 2.5 });
    s += circ(88, 87, 4.5, C.bpH);
    if (st === 2) {
      s += ell(72, 64, 15, 12, C.bpD, { stroke: C.bpH, sw: 2 }) + ell(69, 60, 8, 6, C.bpL, { op: .5 });
      s += crack([[20, 24], [34, 34], [30, 44], [44, 56], [38, 70]], C.bpH, 3);
      s += circ(12, 13, 4.5, C.bpH) + circ(50, 70, 4.5, C.bpH);
      s += ell(50, 40, 30, 16, C.soot, { op: .25 });
    }
  } else if (mat === 'moon') {
    s += path('M30 10 L40 30 L34 44 L48 60', 'none', { stroke: C.mbG, sw: 9, op: .35 });
    s += crack([[30, 10], [40, 30], [34, 44], [48, 60]], C.mbH, 3);
    s += path('M30 10 L40 30 L34 44 L48 60', 'none', { stroke: '#FFFFFF', sw: 1.5 });
    if (st === 2) {
      s += path('M60 60 L74 72 L66 86 L80 100', 'none', { stroke: C.mbG, sw: 10, op: .35 });
      s += crack([[60, 60], [74, 72], [66, 86], [80, 100]], C.mbH, 3);
      s += crack([[48, 60], [60, 60]], C.mbH, 3);
      s += crack([[74, 72], [94, 66]], C.mbH, 2.5);
      s += ell(70, 30, 22, 12, C.mbD, { op: .3 });
    }
  } else if (mat === 'footing') {
    s += crack([[20, 20], [30, 34], [26, 46]], C.ink, 3);
    if (st === 2) s += crack([[60, 10], [70, 30], [64, 50], [80, 70]], C.ink, 3) + crack([[10, 70], [30, 80], [40, 96]], C.ink, 3) + ell(50, 50, 30, 16, C.soot, { op: .25 });
  }
  return s;
}

function chipCorner(mat, R) {
  const m = MAT[mat];
  // knocked-off top-right corner showing a jagged edge
  return path('M70 -2 L102 -2 L102 26 L92 20 L88 10 L78 12 Z', '#FFFFFF00', {}) +
    path('M72 0 L100 0 L100 24 L91 18 L87 9 L77 11 Z', m.h, { stroke: C.ink, sw: 3, op: 1 });
}

function extrasOutside(mat, st, R) {
  if (st < 1) return '';
  let s = '';
  if (mat === 'moon') {
    // self heal sparkle
    s += star4(92, -8, 8, '#EFFFF0', { stroke: C.healD, sw: 1.5 }) + star4(104, 8, 5, '#EFFFF0', { stroke: C.healD, sw: 1.2 });
    s += text(94, -18, '+', { size: 18, weight: 700, fill: C.healD });
  }
  if ((mat === 'wicker' || mat === 'timber') && st === 2) {
    // smoulder smoke wisp
    s += path('M70 -4 C62 -16 78 -22 70 -34 C64 -42 74 -48 70 -56', 'none', { stroke: C.soot, sw: 4, op: .35 });
  }
  return s;
}

function rubble(mat, R) {
  const m = MAT[mat];
  let s = ell(50, 98, 54, 7, C.ink, { op: .18 });
  if (mat === 'wicker') {
    s += g(rr(-8, -9, 34, 18, 9, C.wk, { stroke: C.ink, sw: 3 }), 'translate(22 86) rotate(-18)');
    s += g(rr(-8, -9, 34, 18, 9, C.wkL, { stroke: C.ink, sw: 3 }), 'translate(56 90) rotate(12)');
    s += g(rr(-8, -9, 30, 16, 8, C.wk, { stroke: C.ink, sw: 3 }), 'translate(40 72) rotate(-4)');
    s += path('M70 96 L92 84 M8 96 L18 80 M78 94 L96 96 M30 64 L36 56', 'none', { stroke: C.wkD, sw: 3 });
  } else if (mat === 'timber') {
    s += g(rr(-30, -8, 60, 16, 3, C.tb, { stroke: C.ink, sw: 3 }) + path('M30 -8 L38 -2 L30 2 L36 8 L30 8 Z', C.tbL, { stroke: C.ink, sw: 2 }), 'translate(36 88) rotate(-10)');
    s += g(rr(-24, -8, 48, 16, 3, '#B06C35', { stroke: C.ink, sw: 3 }), 'translate(64 76) rotate(28)');
    s += g(rr(-14, -6, 28, 12, 3, C.tbD, { stroke: C.ink, sw: 3 }), 'translate(78 92) rotate(-6)');
    s += path('M14 92 L4 80 M20 94 L22 82', 'none', { stroke: C.tbL, sw: 3 });
    s += circ(90, 82, 3, C.tbH);
  } else if (mat === 'cobble') {
    for (const [cx, cy, r] of [[24, 86, 13], [52, 88, 11], [76, 86, 12], [40, 70, 10], [64, 72, 8]]) {
      s += ell(cx, cy, r * 1.2, r, C.cb, { stroke: C.ink, sw: 3 }) + path(`M${cx - r * .7} ${cy - r * .3} Q${cx - r * .4} ${cy - r * .8} ${cx} ${cy - r * .8}`, 'none', { stroke: C.cbL, sw: 2.5 });
    }
    s += ell(50, 92, 46, 5, C.cbL, { op: .5 });
  } else if (mat === 'brass') {
    s += g(path('M-26 0 Q-6 -16 26 -6 L26 6 Q-4 -4 -26 12 Z', C.bp, { stroke: C.ink, sw: 3 }), 'translate(36 84) rotate(-6)');
    s += g(rr(-26, -6, 52, 12, 3, C.br, { stroke: C.ink, sw: 3 }), 'translate(62 90) rotate(14)');
    s += path('M70 72 C86 60 98 74 86 82', 'none', { stroke: C.br, sw: 7 }) + path('M70 72 C86 60 98 74 86 82', 'none', { stroke: C.ink, sw: 1.5, op: .5 });
    s += circ(18, 94, 4.5, C.brL, { stroke: C.brD, sw: 1.8 }) + circ(92, 96, 4.5, C.brL, { stroke: C.brD, sw: 1.8 });
  } else if (mat === 'moon') {
    s += path('M14 96 L24 70 L42 78 L40 96 Z', C.mb, { stroke: C.ink, sw: 3 });
    s += path('M46 96 L56 64 L76 74 L72 96 Z', C.mbE, { stroke: C.ink, sw: 3 });
    s += path('M78 96 L84 82 L96 90 L94 96 Z', C.mb, { stroke: C.ink, sw: 3 });
    s += ell(50, 60, 40, 22, C.mbG, { op: .18 });
    s += star4(30, 52, 6, '#F3EEFF', { stroke: C.mbG }) + star4(66, 44, 4, '#F3EEFF', { stroke: C.mbG });
  } else {
    s += rr(0, 40, 100, 60, 6, C.ftD, { stroke: C.ink, sw: 3 }) + path('M0 40 L20 30 L36 44 L56 28 L74 42 L100 32 L100 44 L0 44 Z', C.ft, { stroke: C.ink, sw: 3 }) + circ(14, 86, 4.5, C.ftB, { stroke: C.ink, sw: 2 }) + circ(86, 86, 4.5, C.ftB, { stroke: C.ink, sw: 2 });
  }
  return s;
}

// ---------------------------------------------------------------- Hobs
export const CLASSES = ['lobber', 'zinger', 'scatter', 'delver', 'boinker', 'sizzler', 'patcher', 'peeper'];
export const CLASS_NAME = { lobber: 'Lobber', zinger: 'Zinger', scatter: 'Scatterjack', delver: 'Delver', boinker: 'Boinker', sizzler: 'Sizzler', patcher: 'Patcher', peeper: 'Peeper' };
export const CLASS_ROLE = { lobber: 'Demolisher', zinger: 'Crew sniper', scatter: 'Area', delver: 'Underminer', boinker: 'Trick shots', sizzler: 'Zones', patcher: 'Support', peeper: 'Scout' };

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1).toUpperCase();
}
export { shade };

// origin = feet centre. Height about 100 units at scale 1 (hat included ~110 for tall hats)
export function hob(cls, x, y, s = 1, o = {}) {
  const { skin = SKINS[0], coat = COATS[0], team = C.you, flip = false, face = 'happy', bonk = false, tool = true, hatSvg = null, hatBack = '', faceAdd = '', bodyAdd = '', toolSvg = null, back = '', hands = null } = o;
  const hand = hands || skin;
  const hc = C[cls];
  const ink = C.ink;
  let b = '';
  b += ell(0, 0, 24, 5, ink, { op: .18 });
  // boots
  b += rr(-16, -11, 14, 11, 5, '#4A3328', { stroke: ink, sw: 3 }) + rr(3, -11, 15, 11, 5, '#4A3328', { stroke: ink, sw: 3 });
  // back hand
  b += back + circ(-21, -28, 6.5, hand, { stroke: ink, sw: 3 });
  // body
  const bodyD = 'M-20 -12 C-26 -26 -22 -46 0 -48 C22 -46 26 -26 20 -12 C14 -7 -14 -7 -20 -12 Z';
  b += path(bodyD, coat, { stroke: ink, sw: 3 });
  b += clipped(path(bodyD, '#000'), path('M4 -50 C28 -40 26 -16 14 -8 L40 -8 L40 -50 Z', ink, { op: .2 }) + rr(-12, -36, 11, 11, 2, shade(coat, .25), { extra: ' transform="rotate(-8 -6 -30)"' }) + rr(-12, -36, 11, 11, 2, 'none', { stroke: C.paper, sw: 1.4, extra: ' stroke-dasharray="2.5 2.5" transform="rotate(-8 -6 -30)"' }));
  if (bodyAdd) b += clipped(path(bodyD, '#000'), bodyAdd) + path(bodyD, 'none', { stroke: ink, sw: 3 });
  // belt / buttons
  b += circ(3, -30, 2, C.paper, { op: .8 }) + circ(3, -21, 2, C.paper, { op: .8 });
  // scarf (team colour)
  b += path('M-17 -47 Q0 -40 17 -47 L17 -42 Q0 -35 -17 -42 Z', team, { stroke: ink, sw: 2.5 });
  b += path('M-12 -42 L-16 -28 L-8 -30 L-6 -40 Z', team, { stroke: ink, sw: 2.5 });
  // head
  b += hatBack;
  b += circ(-19, -60, 5.5, skin, { stroke: ink, sw: 3 });
  b += circ(0, -62, 21, skin, { stroke: ink, sw: 3 });
  b += clipped(circ(0, -62, 21, '#000'), circ(9, -56, 21, ink, { op: .13 }));
  // face (facing right)
  if (bonk) {
    b += path('M1 -66 m-3 -3 l6 6 m0 -6 l-6 6', 'none', { stroke: ink, sw: 2.5 }) + path('M14 -66 m-3 -3 l6 6 m0 -6 l-6 6', 'none', { stroke: ink, sw: 2.5 });
    b += ell(9, -53, 4, 3, ink);
  } else {
    b += ell(2, -65, 3.2, 4.2, ink) + ell(15, -65, 3.2, 4.2, ink) + circ(3, -66.5, 1.2, '#FFF') + circ(16, -66.5, 1.2, '#FFF');
    b += ell(10, -58, 4.5, 3.4, shade(skin, -.12), { stroke: ink, sw: 2 });
    b += circ(-4, -55, 4, C.blush, { op: .55 }) + circ(19, -55, 3.5, C.blush, { op: .55 });
    if (face === 'happy') b += path('M4 -51 Q10 -46 16 -51', 'none', { stroke: ink, sw: 2.5 });
    else if (face === 'grit') b += path('M4 -50 L16 -50', 'none', { stroke: ink, sw: 2.5 }) + path('M-1 -72 L6 -70 M12 -70 L19 -72', 'none', { stroke: ink, sw: 2.5 });
    else if (face === 'shout') b += ell(10, -49, 4, 4.5, ink);
    else if (face === 'sleepy') b += path('M4 -51 Q10 -48 16 -51', 'none', { stroke: ink, sw: 2.5 }) + rr(-3, -70.5, 22, 5.5, 0, skin) + path('M-2 -65 L6 -65 M11 -65 L19 -65', 'none', { stroke: ink, sw: 2.2 });
  }
  b += faceAdd;
  b += hatSvg !== null ? hatSvg : hat(cls, hc, ink, team);
  // front hand + tool
  if (tool) b += toolSvg !== null ? toolSvg : classTool(cls, hc, ink, skin);
  b += circ(20, -27, 6.5, hand, { stroke: ink, sw: 3 });
  const sc = flip ? `scale(${-s} ${s})` : `scale(${s})`;
  return g(b, `translate(${f(x)} ${f(y)}) ${sc}`);
}

function hat(cls, hc, ink, team) {
  const dk = shade(hc, -.25), lt = shade(hc, .35);
  switch (cls) {
    case 'lobber':
      return path('M-23 -70 C-23 -98 23 -98 23 -70 Z', hc, { stroke: ink, sw: 3 }) +
        path('M-15 -82 C-10 -88 -2 -89 4 -89', 'none', { stroke: lt, sw: 3 }) +
        rr(-27, -73, 54, 8, 4, dk, { stroke: ink, sw: 3 }) + circ(0, -95, 4.5, dk, { stroke: ink, sw: 2.5 }) +
        circ(-12, -78, 2, ink, { op: .5 }) + circ(12, -78, 2, ink, { op: .5 });
    case 'zinger':
      return path('M-6 -86 C-12 -100 -18 -112 -30 -118 C-18 -116 -6 -106 0 -90 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) +
        path('M-20 -72 C-20 -94 20 -94 20 -72 Z', hc, { stroke: ink, sw: 3 }) +
        path('M14 -74 C26 -76 36 -74 40 -70 C30 -68 20 -68 12 -69 Z', dk, { stroke: ink, sw: 3 }) +
        rr(-16, -82, 22, 9, 4.5, C.steelL, { stroke: ink, sw: 2.5 }) + circ(-8, -77.5, 3, C.zinger) + circ(2, -77.5, 3, C.zinger) +
        path('M-12 -90 C-6 -94 4 -94 8 -91', 'none', { stroke: lt, sw: 2.5 });
    case 'scatter':
      return path('M-14 -76 C-16 -100 18 -104 16 -76 Z', hc, { stroke: ink, sw: 3 }) +
        path('M-38 -72 C-24 -82 24 -84 40 -74 C30 -66 -26 -64 -38 -72 Z', dk, { stroke: ink, sw: 3 }) +
        circ(-6, -88, 3, C.paper) + circ(1, -92, 3, C.paper) + circ(8, -88, 3, C.paper);
    case 'delver':
      return path('M-23 -70 C-23 -100 23 -100 23 -70 Z', hc, { stroke: ink, sw: 3 }) +
        path('M-2 -96 L2 -96 L3 -71 L-3 -71 Z', dk) +
        path('M-26 -72 L28 -72 L34 -66 L-26 -66 Z', dk, { stroke: ink, sw: 3 }) +
        path('M18 -82 L70 -100 L70 -62 Z', C.gold, { op: .28 }) +
        circ(16, -82, 7, C.gold, { stroke: ink, sw: 2.5 }) + circ(14, -84, 2.5, '#FFF');
    case 'boinker':
      return path('M0 -84 l-8 -4 l16 -4 l-16 -4 l16 -4 l-8 -3', 'none', { stroke: C.steelD, sw: 3 }) +
        circ(0, -108, 7.5, C.gold, { stroke: ink, sw: 2.5 }) + circ(-2, -110, 2, '#FFF') +
        path('M-21 -70 C-22 -96 22 -96 21 -70 Z', hc, { stroke: ink, sw: 3 }) +
        rr(-23, -76, 46, 9, 4.5, dk, { stroke: ink, sw: 3 }) +
        path('M-8 -86 L-8 -78 M0 -88 L0 -78 M8 -86 L8 -78', 'none', { stroke: lt, sw: 2.5 });
    case 'sizzler':
      return circ(10, -112, 6, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) + circ(18, -122, 4.5, '#E9E4EA', { stroke: ink, sw: 2, op: .9 }) +
        path('M-18 -74 C-30 -84 -26 -104 -12 -102 C-10 -114 10 -114 12 -102 C26 -104 30 -84 18 -74 Z', hc, { stroke: ink, sw: 3 }) +
        path('M-12 -96 C-8 -102 0 -104 4 -102', 'none', { stroke: lt, sw: 2.5 }) +
        path('M0 -96 C6 -90 7 -86 3 -82 C1 -86 -2 -86 -3 -82 C-7 -86 -5 -92 0 -96 Z', C.gold, { stroke: ink, sw: 1.8 }) +
        rr(-21, -77, 42, 8, 4, dk, { stroke: ink, sw: 3 });
    case 'patcher':
      return g(path('M0 0 L10 -26 L20 0 Z', C.steelL, { stroke: ink, sw: 2.5 }) + rr(7, 0, 6, 14, 2, '#8A5A3A', { stroke: ink, sw: 2 }), 'translate(-30 -76) rotate(-24)') +
        path('M-24 -72 C-26 -92 18 -98 26 -80 C28 -74 24 -70 18 -70 Z', hc, { stroke: ink, sw: 3 }) +
        path('M14 -73 C24 -76 34 -74 38 -70 L14 -68 Z', dk, { stroke: ink, sw: 3 }) +
        circ(0, -90, 3.5, dk, { stroke: ink, sw: 2 }) +
        path('M-16 -84 C-6 -90 6 -90 14 -86', 'none', { stroke: lt, sw: 2.5 });
    case 'peeper':
      return path('M-25 -46 C-30 -80 -16 -96 -2 -100 C-10 -108 -16 -112 -22 -112 C-2 -116 22 -100 26 -76 C28 -62 26 -52 24 -46 C14 -54 -14 -54 -25 -46 Z', hc, { stroke: ink, sw: 3 }) +
        path('M-14 -82 C-14 -90 -4 -94 4 -94', 'none', { stroke: shade(hc, .5), sw: 3 }) +
        circ(8, -82, 10, C.br, { stroke: ink, sw: 3 }) + circ(8, -82, 6, '#9FE3FF', { stroke: ink, sw: 2 }) + circ(6, -84, 2, '#FFF');
  }
  return '';
}

function classTool(cls, hc, ink, skin) {
  switch (cls) {
    case 'lobber': return circ(30, -32, 9, C.soot, { stroke: ink, sw: 2.5 }) + path('M34 -40 Q38 -48 44 -46', 'none', { stroke: ink, sw: 2 }) + star4(45, -47, 4, C.gold);
    case 'zinger': return path('M14 -28 L44 -40', 'none', { stroke: '#8A5A3A', sw: 5 }) + path('M44 -40 L48 -44 L50 -38 Z', C.steelL, { stroke: ink, sw: 2 });
    case 'scatter': return path('M22 -26 L42 -34 L44 -26 L42 -18 Z', C.steel, { stroke: ink, sw: 2.5 });
    case 'delver': return path('M22 -24 L40 -44', 'none', { stroke: '#8A5A3A', sw: 4.5 }) + path('M32 -50 Q44 -50 48 -38 L40 -44 Z', C.steelL, { stroke: ink, sw: 2.5 });
    case 'boinker': return circ(32, -16, 8, C.boinker, { stroke: ink, sw: 2.5 }) + path('M27 -20 Q32 -24 37 -20', 'none', { stroke: '#FFF', sw: 2 });
    case 'sizzler': return rr(22, -36, 16, 14, 5, '#5A4A42', { stroke: ink, sw: 2.5 }) + path('M30 -38 C26 -44 32 -50 30 -54 C36 -50 38 -44 34 -38 Z', C.fire, { stroke: ink, sw: 1.8 }) + circ(31.5, -41, 1.8, C.gold);
    case 'patcher': return rr(22, -30, 18, 14, 3, C.cb, { stroke: ink, sw: 2.5 }) + path('M24 -30 Q31 -36 38 -30', 'none', { stroke: C.paper, sw: 2.5 });
    case 'peeper': return path('M22 -30 L46 -36 L47 -28 L23 -24 Z', C.br, { stroke: ink, sw: 2.5 }) + circ(47, -32, 4.5, '#9FE3FF', { stroke: ink, sw: 2 });
  }
  return '';
}

export function classIcon(cls, x, y, r = 18, o = {}) {
  const { ring = true } = o;
  const hc = C[cls], ink = C.ink, k = r / 18;
  let s = ring ? circ(0, 0, 18, hc, { stroke: ink, sw: 2.5 }) : '';
  const w = '#FFFFFF';
  switch (cls) {
    case 'lobber': s += circ(-1, 2, 7.5, ink) + path('M3 -4 Q6 -10 10 -9', 'none', { stroke: ink, sw: 2 }) + star4(10, -10, 3.5, w); break;
    case 'zinger': s += path('M3 -12 L-6 2 L0 2 L-3 12 L7 -3 L1 -3 Z', w, { stroke: ink, sw: 1.8 }); break;
    case 'scatter': s += circ(-7, 4, 3.5, w, { stroke: ink, sw: 1.6 }) + circ(0, -6, 3.5, w, { stroke: ink, sw: 1.6 }) + circ(7, 4, 3.5, w, { stroke: ink, sw: 1.6 }); break;
    case 'delver': s += path('M-8 -8 L8 -8 L0 12 Z', w, { stroke: ink, sw: 1.8 }) + line(-5, -2, 5, -2, ink, 1.6) + line(-3, 4, 3, 4, ink, 1.6); break;
    case 'boinker': s += circ(0, 6, 5, w, { stroke: ink, sw: 1.8 }) + path('M-10 -2 Q-6 -12 -1 -4 M2 -4 Q7 -14 11 -4', 'none', { stroke: w, sw: 2 }); break;
    case 'sizzler': s += path('M0 -12 C8 -4 9 4 5 9 C3 4 0 4 -1 9 C-8 6 -8 -4 0 -12 Z', w, { stroke: ink, sw: 1.8 }); break;
    case 'patcher': s += rr(-3, -10, 6, 20, 2, w, { stroke: ink, sw: 1.6 }) + rr(-10, -3, 20, 6, 2, w, { stroke: ink, sw: 1.6 }); break;
    case 'peeper': s += path('M-11 0 Q0 -10 11 0 Q0 10 -11 0 Z', w, { stroke: ink, sw: 1.8 }) + circ(0, 0, 3.5, ink); break;
  }
  return g(s, `translate(${f(x)} ${f(y)}) scale(${f(k)})`);
}

// ---------------------------------------------------------------- Flatteners
// Flatteners are Hobs too (04 §1.1): same round body, but grey and cream pressed uniforms,
// white gloves, a pancake cap, an orange tie (rival team cue) and a straight-edged tool.
export const FLAT_TYPES = ['snipper', 'rake', 'clerk', 'sniper', 'tamper', 'pump', 'filler', 'smoothie'];
export function flattener(type, x, y, s = 1, o = {}) {
  const { flip = true, skin = '#EAD3C0', tool = true, bonk = false } = o;
  const ink = C.ink, G = C.indigo, GD = C.indigoD, glove = '#FFFFFF';
  let b = '';
  if (type === 'smoothie') {
    b = ell(0, 0, 56, 6, ink, { op: .18 });
    b += circ(-30, -26, 26, C.steelD, { stroke: ink, sw: 3 }) + circ(-30, -26, 15, C.steel, { stroke: ink, sw: 2.5 }) + rr(-38, -29, 16, 6, 3, C.steelL);
    b += rr(-8, -52, 62, 34, 6, G, { stroke: ink, sw: 3 });
    for (let i = 0; i < 5; i++) b += path(`M${-4 + i * 12} -24 l8 0 l-8 8 l-8 0 Z`, C.rival);
    b += rr(-8, -26, 62, 4, 0, ink, { op: .3 });
    b += circ(40, -12, 12, C.steelD, { stroke: ink, sw: 3 }) + circ(40, -12, 4, C.steel);
    b += rr(34, -80, 10, 30, 2, '#3A3236', { stroke: ink, sw: 2.5 }) + circ(52, -94, 9, '#EDEDF2', { stroke: ink, sw: 2 });
    b += rr(28, -64, 22, 14, 4, C.br, { stroke: ink, sw: 2.5 });
    b += circ(12, -64, 12, skin, { stroke: ink, sw: 2.5 }) + rr(4, -66, 6, 2, 1, ink) + rr(14, -66, 6, 2, 1, ink) + rr(-6, -79, 36, 5, 2.5, C.fcap, { stroke: ink, sw: 2 }) + rr(2, -84, 20, 6, 3, GD, { stroke: ink, sw: 2 });
    const sc = flip ? `scale(${-s} ${s})` : `scale(${s})`;
    return g(b, `translate(${f(x)} ${f(y)}) ${sc}`);
  }
  b += ell(0, 0, 24, 5, ink, { op: .18 });
  const bootC = type === 'pump' ? '#4A6A8A' : '#2E2A30';
  b += rr(-17, -9, 16, 9, 2, bootC, { stroke: ink, sw: 3 }) + rr(2, -9, 17, 9, 2, bootC, { stroke: ink, sw: 3 });
  if (type === 'pump') b += rr(-16, -18, 14, 10, 2, bootC, { stroke: ink, sw: 2.5 }) + rr(3, -18, 14, 10, 2, bootC, { stroke: ink, sw: 2.5 });
  // back tools
  if (tool && type === 'snipper') b += path('M-30 -100 L-14 -40 L-20 -38 Z', C.steelL, { stroke: ink, sw: 2.5 }) + path('M-4 -102 L-16 -40 L-10 -38 Z', C.steelL, { stroke: ink, sw: 2.5 }) + circ(-14, -44, 5, C.rival, { stroke: ink, sw: 2 });
  if (tool && type === 'pump') b += rr(-34, -56, 10, 40, 3, C.br, { stroke: ink, sw: 2.5 }) + line(-29, -56, -29, -70, ink, 3) + rr(-36, -74, 14, 5, 2, C.steelD, { stroke: ink, sw: 1.5 });
  b += circ(-21, -28, 6.5, glove, { stroke: ink, sw: 3 });
  const bodyD = 'M-20 -12 C-26 -26 -22 -46 0 -48 C22 -46 26 -26 20 -12 C14 -7 -14 -7 -20 -12 Z';
  b += path(bodyD, G, { stroke: ink, sw: 3 });
  let inner = path('M4 -50 C28 -40 26 -16 14 -8 L40 -8 L40 -50 Z', ink, { op: .18 }) + line(-9, -44, -9, -10, '#FFFFFF', 1.6, { op: .5 }) + line(9, -44, 9, -10, '#FFFFFF', 1.6, { op: .5 }) + rr(-26, -24, 52, 5, 0, GD);
  if (type === 'snipper' || type === 'filler') inner += path('M-14 -40 L14 -40 L18 -8 L-18 -8 Z', type === 'snipper' ? '#6E9A4E' : C.fcream, { stroke: ink, sw: 2 }) + (type === 'filler' ? rr(-10, -26, 20, 4, 2, '#C9F7B0', { stroke: ink, sw: 1 }) : '');
  b += clipped(path(bodyD, '#000'), inner);
  b += circ(-4, -32, 1.8, C.brL) + circ(4, -32, 1.8, C.brL);
  // cream collar + orange tie (team cue)
  b += path('M-14 -47 L0 -38 L14 -47 L10 -50 L-10 -50 Z', C.fcream, { stroke: ink, sw: 2 });
  b += path('M-3 -40 L3 -40 L5 -26 L0 -22 L-5 -26 Z', C.rival, { stroke: ink, sw: 2 });
  // head
  b += circ(-19, -60, 5.5, skin, { stroke: ink, sw: 3 });
  b += circ(0, -62, 21, skin, { stroke: ink, sw: 3 });
  b += clipped(circ(0, -62, 21, '#000'), circ(9, -56, 21, ink, { op: .13 }));
  if (bonk) b += path('M-1 -66 m-3 -3 l6 6 m0 -6 l-6 6 M12 -66 m-3 -3 l6 6 m0 -6 l-6 6', 'none', { stroke: ink, sw: 2.5 });
  else {
    b += rr(-3, -71, 10, 2.6, 1.3, ink) + rr(10, -71, 10, 2.6, 1.3, ink);
    b += rr(-1, -65, 7, 2.8, 1.4, ink) + rr(12, -65, 7, 2.8, 1.4, ink);
  }
  b += ell(10, -58, 4, 3, shade(skin, -.12), { stroke: ink, sw: 2 });
  b += (type === 'tamper' || type === 'snipper') ? rr(0, -55.5, 21, 6, 3, '#7A5A48', { stroke: ink, sw: 1.8 }) + rr(5, -48, 10, 2.4, 1.2, ink) : rr(4, -50, 12, 2.6, 1.3, ink);
  if (type === 'clerk') b += rr(-4, -70, 11, 9, 2, '#DDF4FF', { stroke: ink, sw: 2, op: .9 }) + rr(10, -70, 11, 9, 2, '#DDF4FF', { stroke: ink, sw: 2, op: .9 }) + line(7, -66, 10, -66, ink, 2);
  if (type === 'sniper') b += rr(-4, -71, 26, 10, 2, '#3A3F4E', { stroke: ink, sw: 2 }) + rr(0, -69, 7, 6, 1, '#DDF4FF', { op: .6 }) + rr(12, -69, 7, 6, 1, '#DDF4FF', { op: .6 });
  // pancake cap: wide, thin, pressed flat, bubble level badge
  b += rr(-30, -84, 64, 6, 3, C.fcap, { stroke: ink, sw: 2.5 });
  b += rr(-20, -91, 44, 8, 3, GD, { stroke: ink, sw: 2.5 });
  b += rr(-4, -89, 14, 4.5, 2.2, '#C9F7B0', { stroke: ink, sw: 1.2 }) + circ(3, -86.8, 1.4, C.good);
  if (type === 'snipper') b += path('M2 -91 C-4 -102 8 -108 12 -100 C10 -96 6 -94 2 -91 Z', '#6DB55E', { stroke: ink, sw: 2 });
  if (type === 'rake') b += ell(-10, -94, 6, 3, '#E0A030', { stroke: ink, sw: 1.5 }) + ell(14, -95, 5, 3, '#C9603A', { stroke: ink, sw: 1.5 });
  if (type === 'clerk') b += g(rr(-2, -14, 4, 22, 1, C.gold, { stroke: ink, sw: 1.5 }), 'translate(-22 -66) rotate(-30)');
  // front tools
  if (tool) {
    switch (type) {
      case 'rake': b += line(30, -98, 26, -6, '#8A5A3A', 4) + path('M18 -100 L42 -96', 'none', { stroke: C.steelD, sw: 4 }) + path('M20 -100 L20 -92 M26 -99 L26 -91 M32 -98 L32 -90 M38 -97 L38 -89', 'none', { stroke: C.steelD, sw: 2.5 }); break;
      case 'clerk': b += rr(18, -46, 22, 28, 2, '#B07A4A', { stroke: ink, sw: 2.5 }) + rr(21, -42, 16, 20, 1, '#FFFFFF', { stroke: ink, sw: 1.2 }) + line(24, -36, 34, -36, ink, 1.2) + line(24, -31, 34, -31, ink, 1.2) + line(24, -26, 30, -26, ink, 1.2) + rr(25, -49, 8, 5, 1, C.steelD); break;
      case 'sniper': b += path('M10 -30 L58 -42 L60 -36 L12 -24 Z', C.br, { stroke: ink, sw: 2.5 }) + [0, 1, 2, 3, 4, 5, 6].map(i => line(18 + i * 6, -30 - i * 1.5, 18 + i * 6, -27 - i * 1.5, ink, 1)).join(''); break;
      case 'tamper': b += line(30, -70, 30, -4, C.steelD, 4) + rr(18, -6, 24, 6, 1, C.steelD, { stroke: ink, sw: 2 }) + rr(22, -74, 16, 6, 2, '#3A3236', { stroke: ink, sw: 1.5 }); break;
      case 'filler': b += rr(22, -24, 18, 16, 3, C.steel, { stroke: ink, sw: 2.5 }) + path('M22 -24 Q31 -32 40 -24', 'none', { stroke: ink, sw: 2 }) + path('M30 -46 L48 -40 L46 -34 L28 -40 Z', C.steelL, { stroke: ink, sw: 2 }); break;
      case 'pump': b += path('M20 -30 L44 -46', 'none', { stroke: '#3A3236', sw: 4 }) + rr(40, -52, 10, 10, 2, C.br, { stroke: ink, sw: 2 }) + circ(54, -50, 3, '#9FE3FF') + circ(60, -54, 2.5, '#9FE3FF'); break;
    }
  }
  b += circ(20, -27, 6.5, glove, { stroke: ink, sw: 3 });
  const sc = flip ? `scale(${-s} ${s})` : `scale(${s})`;
  return g(b, `translate(${f(x)} ${f(y)}) ${sc}`);
}

// ---------------------------------------------------------------- Heartkettle
export function kettle(x, y, s = 1, o = {}) {
  const { hp = 1, popped = false, glowOn = true } = o;
  const ink = C.ink, cu = '#D9773A', cuD = '#A4521F', cuL = '#F2A469';
  let b = '';
  if (glowOn && !popped) b += circ(0, -44, 62, C.glow, { op: .22 }) + circ(0, -44, 46, C.glow, { op: .22 });
  b += ell(0, 0, 44, 6, ink, { op: .2 });
  // feet
  b += rr(-34, -10, 14, 10, 4, C.br, { stroke: ink, sw: 3 }) + rr(20, -10, 14, 10, 4, C.br, { stroke: ink, sw: 3 });
  // spout
  b += path('M30 -46 C48 -50 54 -64 62 -76 L70 -72 C64 -54 56 -36 32 -28 Z', cu, { stroke: ink, sw: 3 });
  // body
  const bd = 'M-40 -40 C-40 -70 -24 -82 0 -82 C24 -82 40 -70 40 -40 C40 -16 26 -8 0 -8 C-26 -8 -40 -16 -40 -40 Z';
  b += path(bd, cu, { stroke: ink, sw: 3.5 });
  b += clipped(path(bd, '#000'), path('M10 -84 C44 -70 46 -20 20 -6 L60 -6 L60 -84 Z', ink, { op: .18 }) + rr(-40, -48, 80, 9, 0, C.br) + rr(-40, -48, 80, 9, 0, 'none', { stroke: C.brD, sw: 2 }) + path('M-28 -66 C-22 -74 -12 -77 -4 -77', 'none', { stroke: cuL, sw: 5 }));
  for (let i = -3; i <= 3; i++) b += circ(i * 11, -43.5, 2, C.brL, { stroke: C.brD, sw: 1 });
  // porthole glow window
  b += circ(0, -28, 11, popped ? '#3A3236' : C.glow, { stroke: ink, sw: 3 });
  if (!popped) b += circ(-3, -31, 3.5, C.glowL);
  // gauge
  b += circ(-22, -62, 9, C.paper, { stroke: ink, sw: 2.5 });
  const ang = -150 + (1 - hp) * 120;
  const a = ang * Math.PI / 180;
  b += line(-22, -62, -22 + Math.cos(a) * 6.5, -62 + Math.sin(a) * 6.5, hp <= .25 ? C.danger : ink, 2);
  b += path('M-28 -58 A8 8 0 0 1 -16 -58', 'none', { stroke: C.danger, sw: 2.5 });
  // lid and handle. Critical (25% or less): the lid rattles
  const crit = hp <= .25 && !popped, hurt = hp <= .5 && !popped;
  if (!popped) {
    b += path('M-34 -82 C-30 -118 30 -118 34 -82', 'none', { stroke: C.brD, sw: 8 }) + path('M-34 -82 C-30 -118 30 -118 34 -82', 'none', { stroke: C.br, sw: 4 });
    const lid = path('M-18 -80 C-18 -92 18 -92 18 -80 Z', cuD, { stroke: ink, sw: 3 }) + circ(0, -92, 5, C.br, { stroke: ink, sw: 2.5 });
    b += crit ? g(lid, 'rotate(-9 -18 -80) translate(0 -3)') + path('M22 -92 l7 -5 M25 -84 l8 -1 M-26 -90 l-6 -5', 'none', { stroke: ink, sw: 2 }) : lid;
  } else {
    b += path('M-34 -82 C-36 -96 -40 -104 -46 -106', 'none', { stroke: C.br, sw: 4 });
  }
  // damage. Hurt (50% or less): one crack across the belly. The copper stays copper
  if (hurt) b += path('M-36 -34 L-24 -27 L-14 -33 L-4 -22 L8 -26 L16 -18 L28 -22 L37 -16', 'none', { stroke: ink, sw: 3 });
  if (crit) {
    b += path('M-24 -27 L-28 -16 M-4 -22 L-8 -12 M16 -18 L20 -11 M-14 -33 L-12 -40 M8 -26 L13 -36 L10 -42 M28 -22 L33 -30 M26 -60 L34 -54 L30 -46', 'none', { stroke: ink, sw: 2.5 });
    b += puff(-52, -34, 9, '#FFFFFF', { op: .95 }) + puff(50, -52, 8, '#FFFFFF', { op: .95 });
  }
  if (popped) {
    b += path('M-36 -34 L-24 -27 L-14 -33 L-4 -22 L8 -26 L16 -18 L28 -22 L37 -16 M-24 -27 L-28 -16 M-4 -22 L-8 -12 M16 -18 L20 -11 M-8 -70 L0 -60 L-4 -50', 'none', { stroke: ink, sw: 3 });
  }
  // steam from spout: slow wisp when full, thin steam when hurt, pulses when critical
  if (!popped) {
    if (crit) b += puff(72, -86, 12, '#FFFFFF', { op: .95 }) + puff(92, -108, 8, '#FFFFFF', { op: .9 });
    else if (hurt) b += puff(72, -86, 9, '#FFFFFF', { op: .95 }) + path('M78 -98 C74 -106 84 -110 80 -118', 'none', { stroke: '#FFFFFF', sw: 3 }) + path('M78 -98 C74 -106 84 -110 80 -118', 'none', { stroke: ink, sw: 1, op: .35 });
    else b += puff(72, -86, 7, '#FFFFFF', { op: .95 });
  }
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

// ---------------------------------------------------------------- Stompers
// a clockwork leg. origin = hip pivot; foot lands at y = len
export function stomper(x, y, s = 1, o = {}) {
  const { pose = 0, paint = C.you, flat = false } = o; // pose -1..1 swing
  const ink = C.ink;
  const kx = pose * 8, fx = pose * 16;
  let b = '';
  b += path(`M0 0 L${f(kx)} 26`, 'none', { stroke: ink, sw: 14 }) + path(`M0 0 L${f(kx)} 26`, 'none', { stroke: C.steelD, sw: 9 });
  b += path(`M${f(kx)} 26 L${f(fx)} 50`, 'none', { stroke: ink, sw: 14 }) + path(`M${f(kx)} 26 L${f(fx)} 50`, 'none', { stroke: C.steel, sw: 9 });
  b += path(`M${f(-8)} 6 L${f(kx - 8)} 40`, 'none', { stroke: C.br, sw: 4 }) + path(`M${f(-8)} 6 L${f(kx - 8)} 40`, 'none', { stroke: ink, sw: 1, op: .4 });
  // gear knee
  const gx = kx, gy = 26;
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    teeth += rr(gx + Math.cos(a) * 10 - 3, gy + Math.sin(a) * 10 - 3, 6, 6, 1, C.br, { stroke: ink, sw: 1.5 });
  }
  b += teeth + circ(gx, gy, 10, C.br, { stroke: ink, sw: 2.5 }) + circ(gx, gy, 3.5, C.brD);
  // boot foot
  b += flat ? rr(fx - 18, 46, 42, 16, 2, paint, { stroke: ink, sw: 3 }) + line(fx - 14, 52, fx + 20, 52, '#FFFFFF', 2, { op: .4 }) : path(`M${f(fx - 16)} 62 C${f(fx - 16)} 48 ${f(fx - 8)} 46 ${f(fx)} 46 C${f(fx + 14)} 46 ${f(fx + 24)} 52 ${f(fx + 24)} 62 Z`, paint, { stroke: ink, sw: 3 });
  b += rr(fx - 18, 59, 44, 6, 3, '#3A3236', { stroke: ink, sw: 2.5 });
  b += circ(0, 0, 7, C.steelD, { stroke: ink, sw: 2.5 });
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

// ---------------------------------------------------------------- Forts
// layout rows top->bottom; chars: W T C B M F . (empty) n (nook interior) k (kettle room) l (loophole block: outer wall with window)
const CH = { W: 'wicker', T: 'timber', C: 'cobble', B: 'brass', M: 'moon', F: 'footing' };
export function fort(x, y, layout, bs, o = {}) {
  // x,y = top-left of grid; returns svg. o.team color, o.crew [{r,c,cls,skin,coat}], o.kettle {r,c}, o.face 'right'|'left'
  const { team = C.you, crew = [], kettleAt = null, face = 'right', cutaway = false, legs = 3, dmg = {}, seed = 3, roofs = [], flag = true, enemy = false, legPose = [0, 0, 0], ghost = false } = o;
  const rows = layout.length, cols = layout[0].length;
  let s = '';
  const W = cols * bs, H = rows * bs;
  // stompers
  const legY = y + H - 4;
  const lp = [];
  for (let i = 0; i < legs; i++) lp.push(x + bs * .7 + (W - bs * 1.4) * (legs === 1 ? .5 : i / (legs - 1)));
  const lscale = bs / 34;
  // body pod under footing
  s += rr(x + bs * .2, legY - bs * .1, W - bs * .4, bs * .55, bs * .2, C.steelD, { stroke: C.ink, sw: 3 });
  for (let i = 0; i < legs; i++) s += stomper(lp[i], legY + bs * .3, lscale, { pose: legPose[i] || 0, paint: enemy ? C.steelD : team, flat: enemy });
  // pipes
  // blocks
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = layout[r][c];
    const bx = x + c * bs, by = y + r * bs;
    if (CH[ch]) s += block(CH[ch], bx, by, bs, dmg[`${r},${c}`] || 0, seed + r * 31 + c * 7);
    else if (ch === 'n' || ch === 'k') s += rr(bx, by, bs, bs, 0, ch === 'k' ? '#2E2A3A' : '#3B2C2A');
    else if (ch === 'l') {
      s += block('timber', bx, by, bs, 0, seed + r * 31 + c * 7);
      s += enemy ? rr(bx + bs * .22, by + bs * .25, bs * .56, bs * .56, 1, '#2A1E1E', { stroke: C.ink, sw: 2.5 }) : path(`M${f(bx + bs * .25)} ${f(by + bs * .85)} L${f(bx + bs * .25)} ${f(by + bs * .4)} Q${f(bx + bs * .5)} ${f(by + bs * .1)} ${f(bx + bs * .75)} ${f(by + bs * .4)} L${f(bx + bs * .75)} ${f(by + bs * .85)} Z`, '#2A1E1E', { stroke: C.ink, sw: 2.5 });
    }
  }
  if (enemy) for (let r = 1; r < rows - 1; r += 2) s += rr(x, y + r * bs - bs * .06, W, bs * .12, 0, C.fcream, { op: .7 });
  // room details: merge nooks: draw floor planks + back wall pattern
  const rooms = findRooms(layout);
  for (const rm of rooms) {
    const rx = x + rm.c * bs, ry = y + rm.r * bs, rw = rm.w * bs, rh = rm.h * bs;
    if (rm.t === 'n') {
      s += rr(rx, ry, rw, rh, 0, '#4A3530');
      for (let i = 1; i < 4; i++) s += line(rx, ry + rh * i / 4, rx + rw, ry + rh * i / 4, '#3B2A26', 2);
      s += rr(rx, ry + rh - bs * .18, rw, bs * .18, 0, '#8A5A3A', { stroke: C.ink, sw: 2 });
      s += circ(rx + rw * .2, ry + rh * .3, bs * .1, C.gold, { op: .9 }) + circ(rx + rw * .2, ry + rh * .3, bs * .22, C.gold, { op: .18 });
      s += rr(rx, ry, rw, rh, 0, 'none', { stroke: C.ink, sw: 3 });
    } else {
      s += rr(rx, ry, rw, rh, 0, '#2E2A3A');
      s += rr(rx, ry + rh - bs * .18, rw, bs * .18, 0, C.steelD, { stroke: C.ink, sw: 2 });
      s += kettle(rx + rw / 2, ry + rh - bs * .18, bs * 1.55 / 100 * 1.15, { glowOn: true });
      s += rr(rx, ry, rw, rh, 0, 'none', { stroke: C.ink, sw: 3 });
    }
  }
  for (const h of crew) {
    const hx = x + (h.c + 1) * bs, hy = y + (h.r + 2) * bs - bs * .18;
    s += hob(h.cls, hx, hy, bs * 1.55 / 100, { skin: h.skin, coat: h.coat, team, flip: face === 'left', face: h.face || 'happy', tool: h.tool !== false });
  }
  // roofs: {c, w, color}
  for (const rf of roofs) {
    const rx = x + rf.c * bs, rw = rf.w * bs, top = y - rf.h * bs;
    if (rf.type === 'flat') {
      s += rr(rx - 4, y - bs * .35, rw + 8, bs * .35, 4, rf.color, { stroke: C.ink, sw: 3 });
      for (let i = 0; i < rf.w * 2; i++) s += rr(rx + i * bs / 2 + 2, y - bs * .65, bs / 2 - 8, bs * .32, 2, rf.color, { stroke: C.ink, sw: 2.5 });
    } else {
      s += path(`M${f(rx - bs * .2)} ${f(y)} Q${f(rx + rw * .5)} ${f(top - bs * .2)} ${f(rx + rw + bs * .2)} ${f(y)} Z`, rf.color, { stroke: C.ink, sw: 3 });
      s += stitch(`M${f(rx + rw * .2)} ${f(y - 4)} Q${f(rx + rw * .5)} ${f(top + bs * .3)} ${f(rx + rw * .8)} ${f(y - 4)}`, C.ink, 2, .3, '5 5');
    }
  }
  if (flag) {
    const fxp = x + (enemy ? W - bs * .5 : bs * .5), topY = y - (roofs[0]?.h || 0) * bs - bs * 1.6;
    s += line(fxp, y - bs * .2, fxp, topY, C.ink, 4);
    if (enemy) s += rr(fxp - bs * 1.4, topY, bs * 1.4, bs * .8, 1, C.indigoL, { stroke: C.ink, sw: 3 }) + rr(fxp - bs * 1.4, topY + bs * .62, bs * 1.4, bs * .18, 0, C.rival, { stroke: C.ink, sw: 1.5 }) + line(fxp - bs * 1.2, topY + bs * .32, fxp - bs * .2, topY + bs * .32, C.ink, Math.max(1.5, bs * .07)) + circ(fxp - bs * .7, topY + bs * .32, bs * .09, C.good, { stroke: C.ink, sw: 1 });
    else s += path(`M${f(fxp)} ${f(topY)} Q${f(fxp + bs * .8)} ${f(topY - bs * .2)} ${f(fxp + bs * 1.5)} ${f(topY + bs * .35)} Q${f(fxp + bs * .8)} ${f(topY + bs * .5)} ${f(fxp)} ${f(topY + bs * .8)} Z`, team, { stroke: C.ink, sw: 3 }) + circ(fxp + bs * .5, topY + bs * .38, bs * .15, C.paper, { stroke: C.ink, sw: 2 });
  }
  return s;
}

function findRooms(layout) {
  const seen = new Set(), out = [];
  for (let r = 0; r < layout.length; r++) for (let c = 0; c < layout[0].length; c++) {
    const ch = layout[r][c];
    if ((ch === 'n' || ch === 'k') && !seen.has(r + ',' + c)) {
      let w = 1, h = 1;
      while (layout[r][c + w] === ch) w++;
      while (layout[r + h] && layout[r + h][c] === ch) h++;
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) seen.add((r + i) + ',' + (c + j));
      out.push({ r, c, w, h, t: ch });
    }
  }
  return out;
}

// Flattener fort: flat-topped, stripes, on rollers instead of legs
export function flatFort(x, y, layout, bs, o = {}) {
  return fort(x, y, layout, bs, { ...o, team: C.indigo, enemy: true, face: 'left' });
}

// ---------------------------------------------------------------- UI bits
export function button(x, y, w, h, label, o = {}) {
  const { fill = C.saffron, dark = C.saffronD, size = 22, tc = C.ink, r = 14, icon = '' } = o;
  return rr(x, y + 5, w, h, r, dark, { stroke: C.ink, sw: 3 }) + rr(x, y, w, h, r, fill, { stroke: C.ink, sw: 3 }) +
    rr(x + 8, y + 5, w - 16, h * .3, h * .15, '#FFFFFF', { op: .3 }) +
    (label ? text(x + w / 2, y + h / 2 + size * .36, label, { size, weight: 700, fill: tc, anchor: 'middle' }) : '') + icon;
}
export function panel(x, y, w, h, o = {}) {
  const { fill = C.paper, r = 18, stitchOn = true } = o;
  return rr(x, y + 4, w, h, r, C.ink, { op: .25 }) + rr(x, y, w, h, r, fill, { stroke: C.ink, sw: 3 }) +
    (stitchOn ? rr(x + 7, y + 7, w - 14, h - 14, r - 6, 'none', { stroke: C.saffronD, sw: 1.8, extra: ' stroke-dasharray="5 5" opacity="0.55"' }) : '');
}
export function pennant(x, y, s = 1, filled = true) {
  return g(path('M0 0 L0 -30 L22 -22 L0 -14', filled ? C.gold : '#D8CDB8', { stroke: C.ink, sw: 2.5 }) + line(0, 2, 0, -32, C.ink, 3), `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}
export function buttonCoin(x, y, r = 12) {
  return circ(x, y, r, C.saffron, { stroke: C.ink, sw: 2.5 }) + circ(x - r * .3, y - r * .3, r * .16, C.ink) + circ(x + r * .3, y - r * .3, r * .16, C.ink) + circ(x - r * .3, y + r * .3, r * .16, C.ink) + circ(x + r * .3, y + r * .3, r * .16, C.ink);
}
export function windArrow(x, y, v, s = 1) {
  const dir = Math.sign(v) || 1;
  const len = 30 + Math.abs(v) * 5;
  const d = `M${-len / 2 * dir} -7 L${(len / 2 - 14) * dir} -7 L${(len / 2 - 14) * dir} -16 L${len / 2 * dir} 0 L${(len / 2 - 14) * dir} 16 L${(len / 2 - 14) * dir} 7 L${-len / 2 * dir} 7 Z`;
  return g(path(d, C.paper, { stroke: C.ink, sw: 3 }), `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}

// ---------------------------------------------------------------- Baron Levelwell
export function baron(x, y, s = 1, mood = 'smug') {
  const ink = C.ink, ind = '#8A90A2', indD = '#5B6172', skin = '#EAD3C0';
  let b = ell(0, 0, 50, 8, ink, { op: .18 });
  // legs/boots on roller plinth
  b += rr(-26, -26, 18, 26, 4, indD, { stroke: ink, sw: 3 }) + rr(8, -26, 18, 26, 4, indD, { stroke: ink, sw: 3 });
  b += rr(-30, -8, 26, 10, 3, '#2E2A30', { stroke: ink, sw: 3 }) + rr(4, -8, 26, 10, 3, '#2E2A30', { stroke: ink, sw: 3 });
  // coat: a tall rectangle with tails
  b += path('M-38 -130 L38 -130 L42 -40 L48 -20 L-48 -20 L-42 -40 Z', ind, { stroke: ink, sw: 3.5 });
  b += clipped(path('M-38 -130 L38 -130 L42 -40 L48 -20 L-48 -20 L-42 -40 Z', '#000'), rr(20, -140, 40, 130, 0, ink, { op: .2 }) + rr(-4, -130, 8, 110, 0, C.br) + rr(-48, -64, 96, 9, 0, '#3E4250'));
  for (let i = 0; i < 4; i++) b += circ(-10, -118 + i * 18, 3.5, C.brL, { stroke: C.brD, sw: 1.5 }) + circ(10, -118 + i * 18, 3.5, C.brL, { stroke: C.brD, sw: 1.5 });
  // sash with the flat line emblem
  b += path('M-38 -126 L38 -56 L38 -44 L-38 -114 Z', C.fcream, { stroke: ink, sw: 2.5 });
  b += circ(-6, -88, 12, C.rival, { stroke: ink, sw: 2.5 }) + rr(-14, -90, 16, 4, 2, C.paper);
  // epaulettes: flat boards
  b += rr(-56, -136, 30, 10, 2, C.br, { stroke: ink, sw: 3 }) + rr(26, -136, 30, 10, 2, C.br, { stroke: ink, sw: 3 });
  for (let i = 0; i < 4; i++) b += line(-52 + i * 7, -126, -52 + i * 7, -116, C.br, 3) + line(30 + i * 7, -126, 30 + i * 7, -116, C.br, 3);
  // arms
  b += rr(-58, -126, 18, 64, 7, ind, { stroke: ink, sw: 3 }) + rr(40, -126, 18, 54, 7, ind, { stroke: ink, sw: 3 });
  b += rr(-60, -66, 20, 16, 6, '#FFFFFF', { stroke: ink, sw: 2.5 }) + ell(-50, -68, 18, 4, '#FFFFFF', { stroke: ink, sw: 2 }) + path('M-60 -86 L-40 -86 L-43 -70 L-57 -70 Z', '#FFFFFF', { stroke: ink, sw: 2.5 }) + path('M-40 -82 C-32 -82 -32 -74 -41 -74', 'none', { stroke: ink, sw: 2 }) + rr(-58, -84, 16, 4, 2, C.rival, { op: .8 }) + path('M-52 -92 C-56 -98 -48 -100 -52 -106', 'none', { stroke: ink, sw: 1.5, op: .4 });
  // carpenter-square cane
  b += path('M60 -86 L60 0 L66 0 L66 -80 L92 -80 L92 -86 Z', C.br, { stroke: ink, sw: 3 });
  for (let i = 0; i < 8; i++) b += line(60, -76 + i * 10, 64, -76 + i * 10, ink, 1.5);
  b += rr(40, -92, 22, 18, 7, '#FFFFFF', { stroke: ink, sw: 2.5 });
  // head: wide flat-topped box
  b += rr(-30, -190, 60, 58, 10, skin, { stroke: ink, sw: 3.5 });
  b += clipped(rr(-30, -190, 60, 58, 10, '#000'), rr(14, -190, 20, 60, 0, ink, { op: .12 }));
  // face
  if (mood === 'smug') {
    b += rr(-22, -178, 16, 4, 2, ink) + rr(6, -180, 16, 4, 2, ink);
    b += rr(-18, -168, 9, 3, 1.5, ink);
    b += rr(2, -173, 22, 12, 6, '#C9F7B0', { stroke: C.br, sw: 3 }) + circ(13, -167, 3, C.good, { stroke: ink, sw: 1 }) + path('M24 -164 Q32 -146 24 -124', 'none', { stroke: C.br, sw: 1.5 });
    b += path('M-6 -138 Q0 -136 8 -140', 'none', { stroke: ink, sw: 2.5 });
  } else if (mood === 'cross') {
    b += path('M-22 -182 L-6 -176 M22 -182 L6 -176', 'none', { stroke: ink, sw: 4 });
    b += circ(-14, -168, 3, ink) + rr(2, -173, 22, 12, 6, '#C9F7B0', { stroke: C.br, sw: 3 }) + circ(19, -167, 3, C.good, { stroke: ink, sw: 1 });
    b += ell(0, -138, 8, 4, ink);
  } else {
    b += path('M-20 -168 l8 0 M6 -168 l8 0', 'none', { stroke: ink, sw: 3 });
    b += path('M-8 -136 Q0 -141 8 -136', 'none', { stroke: ink, sw: 2.5 });
    b += puff(40, -208, 10, '#FFFFFF');
  }
  // ruler-straight moustache past the face
  b += rr(-46, -153, 92, 7, 2, '#5A4A50', { stroke: ink, sw: 2.5 });
  for (let i = 0; i < 9; i++) b += line(-40 + i * 10, -152, -40 + i * 10, -148, C.paper, 1.2);
  // top hat: tall, flat, with a spirit level band
  let h = '';
  h += rr(-64, -198, 128, 9, 4.5, '#3E4250', { stroke: ink, sw: 3 });
  h += rr(-44, -208, 88, 11, 4, indD, { stroke: ink, sw: 3 });
  h += rr(-14, -206, 28, 7, 3.5, '#C9F7B0', { stroke: ink, sw: 1.5 }) + circ(mood === 'cross' ? 7 : 0, -202.5, 2.4, C.good, { stroke: ink, sw: 1 });
  h += line(-40, -205, -22, -205, '#FFFFFF', 2, { op: .3 });
  b += mood === 'beat' ? g(h, 'rotate(-12 -50 -196)') : h;
  return g(b, `translate(${f(x)} ${f(y)}) scale(${f(s)})`);
}
