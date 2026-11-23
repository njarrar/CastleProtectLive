// Crisp offline storybook SVG icon & UI chrome kit (Part 2 Art Direction, Plates 1-5).
// Every data URL is generated once and cached (zero per-frame allocations).
// Used seamlessly as dedicated illustrations when a sprite is not packed in the loaded atlas,
// and as brass storybook chrome replacing raw Unicode glyphs (♨, ⚑, ⚙, ▬●).
import { sprites } from '../render/sprites';

const INK = '#2C221E';
const PAPER = '#FFF4DE';
const PARCH = '#FAF3E3';
const BRASS_HI = '#FFE08A';
const BRASS_MID = '#FFC23D';
const BRASS_LO = '#C88A2E';
const BRASS_DEEP = '#8C5A14';
const COPPER = '#D9773A';
const COPPER_D = '#9E4B1E';
const ORANGE = '#E8730C';
const ORANGE_INK = '#A94D00';
const GOOD = '#1F6B29';
const GOOD_SOFT = '#5CC35A';
const BAD_BG = '#FDECEE';
const BAD_BORDER = '#C9363E';
const BAD_INK = '#A61C24';
const SLATE = '#5A6572';
const SLATE_L = '#96A3B0';
const SLATE_D = '#3D4652';
const GLOW = '#4FE3C1';
const BLUE = '#2F6FDE';
const TIMBER = '#B9733A';
const TIMBER_D = '#87491F';

const cache = new Map<string, string>();

function toDataUrl(key: string, makeSvg: () => string): string {
  let u = cache.get(key);
  if (!u) {
    u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makeSvg())}`;
    cache.set(key, u);
  }
  return u;
}

function wrap(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

// ================================================================ 1. UI Brass & Storybook Chrome

export function kettleDialUrl(state: 'full' | 'hurt' | 'critical'): string {
  const atlas = sprites.url(`ui_kettle_dial_${state}`);
  if (atlas) return atlas;
  return toDataUrl(`kettle_${state}`, () => {
    const hp = state === 'full' ? 0.86 : state === 'hurt' ? 0.44 : 0.12;
    const rim = state === 'critical' ? BAD_BORDER : BRASS_MID;
    const rimD = state === 'critical' ? BAD_INK : BRASS_DEEP;
    const face = state === 'critical' ? BAD_BG : PARCH;
    const na = Math.PI * (0.82 + hp * 1.36);
    const nx = (32 + Math.cos(na) * 13.5).toFixed(1);
    const ny = (35 + Math.sin(na) * 13.5).toFixed(1);
    const tx = (32 - Math.cos(na) * 4.5).toFixed(1);
    const ty = (35 - Math.sin(na) * 4.5).toFixed(1);
    const arc = (t0: number, t1: number, col: string) => {
      const a0 = Math.PI * (0.82 + t0 * 1.36);
      const a1 = Math.PI * (0.82 + t1 * 1.36);
      const x0 = (32 + Math.cos(a0) * 14.5).toFixed(1);
      const y0 = (35 + Math.sin(a0) * 14.5).toFixed(1);
      const x1 = (32 + Math.cos(a1) * 14.5).toFixed(1);
      const y1 = (35 + Math.sin(a1) * 14.5).toFixed(1);
      return `<path d="M${x0} ${y0} A14.5 14.5 0 0 1 ${x1} ${y1}" fill="none" stroke="${col}" stroke-width="4.4" stroke-linecap="butt"/>`;
    };
    const cracks = state === 'hurt'
      ? `<path d="M22 42 L28 38 L31 43 L38 39" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.75"/>`
      : state === 'critical'
        ? `<path d="M17 30 L26 35 L22 45 M26 35 L39 42 M33 22 L28 32" fill="none" stroke="${INK}" stroke-width="1.7" opacity="0.85"/><circle cx="51" cy="12" r="5" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="56" cy="9" r="3" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`
        : '';
    return wrap(64, 64,
      `<rect x="26" y="3" width="12" height="7" rx="3" fill="${BRASS_DEEP}" stroke="${INK}" stroke-width="2.5"/>`
      + `<rect x="23" y="1.5" width="18" height="4.5" rx="2.2" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2.2"/>`
      + (state === 'critical' ? `<circle cx="32" cy="35" r="27.5" fill="${BAD_BORDER}" opacity="0.22"/>` : '')
      + `<circle cx="32" cy="36.5" r="24.5" fill="${rimD}" stroke="${INK}" stroke-width="3"/>`
      + `<circle cx="32" cy="35" r="24.5" fill="${rim}" stroke="${INK}" stroke-width="3"/>`
      + `<path d="M14 23 A22 22 0 0 1 48 21" fill="none" stroke="${BRASS_HI}" stroke-width="3" opacity="0.85"/>`
      + `<circle cx="32" cy="35" r="19" fill="${face}" stroke="${INK}" stroke-width="2.4"/>`
      + arc(0, 0.28, BAD_BORDER) + arc(0.28, 0.56, ORANGE) + arc(0.56, 1, GOOD)
      + `<circle cx="32" cy="46" r="3.4" fill="${COPPER}" stroke="${INK}" stroke-width="1.5"/>`
      + `<line x1="${tx}" y1="${ty}" x2="${nx}" y2="${ny}" stroke="${state === 'critical' ? BAD_INK : INK}" stroke-width="3.2"/>`
      + `<circle cx="32" cy="35" r="4" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2"/>`
      + `<circle cx="32" cy="35" r="1.5" fill="${INK}"/>`
      + `<path d="M19 25 Q26 19 36 20" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.65"/>`
      + cracks,
    );
  });
}

export function windPennantUrl(): string {
  const atlas = sprites.url('ui_wind_pennant');
  if (atlas) return atlas;
  return toDataUrl('wind_pennant', () => wrap(64, 48,
    `<line x1="11" y1="43" x2="11" y2="8" stroke="${INK}" stroke-width="6"/>`
    + `<line x1="11" y1="42" x2="11" y2="9" stroke="${BRASS_MID}" stroke-width="2.8"/>`
    + `<circle cx="11" cy="6" r="4.2" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2.2"/>`
    + `<rect x="5" y="40.5" width="12" height="4.5" rx="2" fill="${BRASS_DEEP}" stroke="${INK}" stroke-width="2"/>`
    + `<path d="M14 12 C28 9 42 15 60 11 L50 22 L59 32 C41 34 27 29 14 31 Z" fill="${PARCH}" stroke="${INK}" stroke-width="3"/>`
    + `<path d="M15 13 C28 11 41 15 56 12.5 L53 18.5 C40 20 27 17 15 18.5 Z" fill="#2FB7A6" opacity="0.88"/>`
    + `<path d="M15 25.5 C28 24 41 27.5 55 26.5 L57 30.5 C41 32.5 27 28.5 15 30 Z" fill="${BRASS_MID}" opacity="0.72"/>`
    + `<path d="M14 12 C28 9 42 15 60 11 L50 22 L59 32 C41 34 27 29 14 31 Z" fill="none" stroke="${INK}" stroke-width="3"/>`
    + `<path d="M20 22 C31 20 40 23.5 47 22" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3.5 3.5" opacity="0.65"/>`,
  ));
}

export function restCogUrl(): string {
  const atlas = sprites.url('ui_cog_rest');
  if (atlas) return atlas;
  return toDataUrl('cog_rest', () => {
    let teeth = '';
    for (let i = 0; i < 8; i++) {
      teeth += `<rect x="-4" y="-20.5" width="8" height="8.5" rx="2" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.4" transform="translate(24 24) rotate(${i * 45})"/>`;
    }
    return wrap(48, 48,
      teeth
      + `<circle cx="24" cy="24.8" r="15" fill="${BRASS_DEEP}" stroke="${INK}" stroke-width="2.8"/>`
      + `<circle cx="24" cy="23.6" r="15" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
      + `<path d="M13 17 A12.5 12.5 0 0 1 33 15" fill="none" stroke="${BRASS_HI}" stroke-width="2.8" opacity="0.85"/>`
      + `<circle cx="24" cy="23.6" r="10" fill="${PARCH}" stroke="${INK}" stroke-width="2"/>`
      + `<circle cx="24" cy="23.6" r="5" fill="${BRASS_DEEP}" stroke="${INK}" stroke-width="2.2"/>`
      + `<circle cx="23" cy="22.6" r="1.6" fill="${BRASS_HI}"/>`,
    );
  });
}

export function fatigueFlameUrl(): string {
  const atlas = sprites.url('ui_fatigue_flame');
  if (atlas) return atlas;
  return toDataUrl('fatigue_flame', () => wrap(48, 48,
    `<circle cx="24" cy="25" r="20" fill="${ORANGE_INK}" stroke="${INK}" stroke-width="2.8"/>`
    + `<circle cx="24" cy="23.5" r="20" fill="${PARCH}" stroke="${INK}" stroke-width="2.8"/>`
    + `<circle cx="24" cy="23.5" r="16" fill="#FCE2BE" stroke="${ORANGE}" stroke-width="1.8" stroke-dasharray="3.5 2.5"/>`
    + `<path d="M24 37.5 C13.5 37.5 11.5 26 17.5 18.5 C18.5 22 20.5 22 21.5 19 C20.5 12.5 24 8.5 26 5.5 C32 12 36.5 21 34.5 30 C33.5 34.5 30 37.5 24 37.5 Z" fill="${ORANGE_INK}" stroke="${INK}" stroke-width="2.5"/>`
    + `<path d="M24 35.5 C16.5 35.5 15.5 27 20 21 C21.5 24 23 23.5 24 20 C25 15 26 13 26.5 11 C31 16 33 23 31.5 30 C30.5 33.5 28 35.5 24 35.5 Z" fill="${ORANGE}"/>`
    + `<path d="M24 34 C19.5 34 19.5 28.5 23 24.5 C26.5 27 28 30 27 32.5 C26.5 33.5 25.5 34 24 34 Z" fill="${BRASS_MID}"/>`,
  ));
}

export function frontLoopholeUrl(): string {
  const atlas = sprites.url('ui_front_loophole');
  if (atlas) return atlas;
  return toDataUrl('front_loophole', () => wrap(48, 48,
    `<path d="M6 42 V16 H14 V10 H22 V16 H26 V10 H34 V16 H42 V42 Z" fill="${TIMBER}" stroke="${INK}" stroke-width="2.8"/>`
    + `<path d="M16 42 V27 A8 8 0 0 1 32 27 V42 Z" fill="#241B17" stroke="${INK}" stroke-width="2.4"/>`
    + `<path d="M21 29 L38 29 M32 23 L39 29 L32 35" fill="none" stroke="${BRASS_HI}" stroke-width="3.2"/>`,
  ));
}

export function heartkettleRoomUrl(): string {
  return toDataUrl('workshop_kettle_room', () => wrap(96, 96,
    // Recessed boiler room wall & hearth glow
    `<rect x="2" y="2" width="92" height="92" rx="6" fill="#3B2D24" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="48" cy="54" r="34" fill="${GLOW}" opacity="0.22"/>`
    + `<circle cx="48" cy="56" r="24" fill="${BRASS_MID}" opacity="0.18"/>`
    // Brass steam pipes feeding downwards to the Stompers
    + `<path d="M24 68 V92 M48 76 V92 M72 68 V92" stroke="${INK}" stroke-width="8"/>`
    + `<path d="M24 68 V92 M48 76 V92 M72 68 V92" stroke="${BRASS_LO}" stroke-width="4.5"/>`
    + `<path d="M24 68 H72" stroke="${INK}" stroke-width="7"/><path d="M24 68 H72" stroke="${BRASS_MID}" stroke-width="3.6"/>`
    // Top copper chimney / valve spout
    + `<rect x="41" y="10" width="14" height="14" rx="3" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
    + `<rect x="36" y="7" width="24" height="6" rx="3" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2.5"/>`
    // Side spout & handle
    + `<path d="M68 38 C82 36 86 24 80 18" fill="none" stroke="${INK}" stroke-width="8"/><path d="M68 38 C82 36 86 24 80 18" fill="none" stroke="${COPPER}" stroke-width="4.2"/>`
    + `<path d="M26 36 C12 36 12 56 26 56" fill="none" stroke="${INK}" stroke-width="6"/><path d="M26 36 C12 36 12 56 26 56" fill="none" stroke="${BRASS_LO}" stroke-width="2.8"/>`
    // Main hammered copper Heartkettle body
    + `<ellipse cx="48" cy="50" rx="26" ry="24" fill="${COPPER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M24 52 C32 68 64 68 72 52 C68 66 58 73 48 73 C38 73 28 66 24 52 Z" fill="${COPPER_D}" opacity="0.7"/>`
    + `<path d="M30 36 A20 18 0 0 1 58 31" fill="none" stroke="#F8B484" stroke-width="3.2" opacity="0.8"/>`
    // Brass belly band with rivets
    + `<path d="M22.5 49 Q48 55 73.5 49" fill="none" stroke="${INK}" stroke-width="7"/><path d="M22.5 49 Q48 55 73.5 49" fill="none" stroke="${BRASS_MID}" stroke-width="3.6"/>`
    // Glowing emerald hearth window
    + `<circle cx="48" cy="52" r="10.5" fill="${INK}" stroke="${BRASS_HI}" stroke-width="2.5"/>`
    + `<circle cx="48" cy="52" r="8" fill="${GLOW}"/>`
    + `<circle cx="45.5" cy="49.5" r="2.8" fill="#E8FFF9" opacity="0.9"/>`,
  ));
}

export function topiaryPeacockIconUrl(): string {
  const atlas = sprites.url('prop_topiary_peacock_crest');
  if (atlas) return atlas;
  return toDataUrl('topiary_peacock_icon', () => wrap(64, 56,
    // Sculpted fanned clipped-hedge peacock tail
    `<path d="M32 48 L8 22 C16 10 26 8 32 14 C38 8 48 10 56 22 Z" fill="#2F7A46" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="18" cy="22" r="4" fill="${BRASS_MID}" stroke="${INK}" stroke-width="1.8"/><circle cx="18" cy="22" r="1.6" fill="#2FB7A6"/>`
    + `<circle cx="32" cy="17" r="4.5" fill="${BRASS_MID}" stroke="${INK}" stroke-width="1.8"/><circle cx="32" cy="17" r="1.8" fill="#2FB7A6"/>`
    + `<circle cx="46" cy="22" r="4" fill="${BRASS_MID}" stroke="${INK}" stroke-width="1.8"/><circle cx="46" cy="22" r="1.6" fill="#2FB7A6"/>`
    // Clipped-hedge peacock head & curved neck
    + `<path d="M26 50 C25 38 22 30 27 25 C31 21 38 23 39 29 C40 35 37 42 38 50 Z" fill="#46A35C" stroke="${INK}" stroke-width="3"/>`
    // Crown plumes
    + `<path d="M32 23 L29 12 M34 23 L35 11 M36 24 L41 13" stroke="${INK}" stroke-width="2"/>`
    + `<circle cx="29" cy="11" r="2.2" fill="${BRASS_HI}" stroke="${INK}" stroke-width="1.4"/>`
    + `<circle cx="35" cy="10" r="2.2" fill="${BRASS_HI}" stroke="${INK}" stroke-width="1.4"/>`
    + `<circle cx="41" cy="12" r="2.2" fill="${BRASS_HI}" stroke="${INK}" stroke-width="1.4"/>`
    // Beak & fierce eye
    + `<path d="M24 28 L16 31 L24 33 Z" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2"/>`
    + `<circle cx="29" cy="28" r="2.2" fill="${INK}"/><circle cx="28.3" cy="27.3" r="0.8" fill="#fff"/>`,
  ));
}

export function bigSmoothieIconUrl(): string {
  const atlas = sprites.url('prop_big_smoothie_jr');
  if (atlas) return atlas;
  return toDataUrl('big_smoothie_icon', () => wrap(72, 48,
    // Smokestack + puff
    `<circle cx="24" cy="8" r="4" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="31" cy="6" r="3" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`
    + `<rect x="19" y="12" width="8" height="14" rx="2" fill="${SLATE_D}" stroke="${INK}" stroke-width="2.2"/>`
    + `<rect x="17" y="11" width="12" height="3.5" rx="1.5" fill="${BRASS_MID}" stroke="${INK}" stroke-width="1.8"/>`
    // Slate & crimson chassis + brass boiler
    + `<rect x="18" y="21" width="38" height="13" rx="3" fill="${SLATE}" stroke="${INK}" stroke-width="2.6"/>`
    + `<rect x="20" y="29" width="34" height="4.5" fill="${BAD_BORDER}"/>`
    + `<rect x="44" y="13" width="12" height="14" rx="2" fill="${BRASS_LO}" stroke="${INK}" stroke-width="2.4"/>`
    + `<rect x="42" y="11" width="16" height="3.5" rx="1.5" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2"/>`
    // Front steel flattening drum
    + `<circle cx="17" cy="35" r="11" fill="${SLATE_L}" stroke="${INK}" stroke-width="2.8"/>`
    + `<circle cx="17" cy="35" r="5" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2"/>`
    // Rear spoked wheel
    + `<circle cx="53" cy="35" r="10" fill="${SLATE_D}" stroke="${INK}" stroke-width="2.8"/>`
    + `<circle cx="53" cy="35" r="5" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2"/>`,
  ));
}

// ================================================================ 2. All 8 Knack + Shot Vector Icons

const SHOT_SVGS: Record<string, () => string> = {
  // --- All 8 Signature Knacks (Plate 3) ---
  grand_dumpling: () => wrap(64, 64,
    // Steam wisps
    `<path d="M22 14 Q20 8 25 5 M32 12 Q30 6 35 3 M42 14 Q40 8 45 5" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/>`
    + `<path d="M22 14 Q20 8 25 5 M32 12 Q30 6 35 3 M42 14 Q40 8 45 5" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.55"/>`
    // Giant golden steamed pleated dumpling
    + `<path d="M10 42 C10 24 22 17 32 17 C42 17 54 24 54 42 C54 53 45 56 32 56 C19 56 10 53 10 42 Z" fill="#FBE6B4" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M12 43 C18 52 46 52 52 43 C52 52 44 55 32 55 C20 55 12 52 12 43 Z" fill="#E3B565"/>`
    // Pleats radiating from top knot
    + `<path d="M32 19 C24 23 18 31 16 40 M32 19 C28 25 26 32 25 40 M32 19 C36 25 38 32 39 40 M32 19 C40 23 46 31 48 40" fill="none" stroke="${BRASS_DEEP}" stroke-width="2.2" opacity="0.7"/>`
    // Top dumpling pinch & brass belly band
    + `<ellipse cx="32" cy="18" rx="7" ry="4" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2.4"/>`
    + `<path d="M11 40 Q32 46 53 40" fill="none" stroke="${ORANGE}" stroke-width="4.5"/><path d="M11 40 Q32 46 53 40" fill="none" stroke="${INK}" stroke-width="1.8"/>`,
  ),

  sunspear: () => wrap(64, 64,
    // Golden solar aura
    `<circle cx="44" cy="20" r="15" fill="${BRASS_HI}" opacity="0.55"/>`
    // Sunburst rays
    + `<path d="M44 4 V11 M59 20 H52 M55 9 L50 14 M55 31 L50 26 M33 9 L38 14" stroke="${ORANGE}" stroke-width="3.2"/>`
    // Blazing diagonal beam spear
    + `<path d="M9 55 L42 22" stroke="${INK}" stroke-width="9"/>`
    + `<path d="M9 55 L42 22" stroke="${BRASS_MID}" stroke-width="4.6"/>`
    + `<path d="M12 52 L40 24" stroke="#fff" stroke-width="2" opacity="0.85"/>`
    // Sun-crested spearhead
    + `<path d="M33 17 L56 8 L47 31 L42 22 Z" fill="${BRASS_HI}" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="44" cy="20" r="5" fill="${ORANGE}" stroke="${INK}" stroke-width="2.2"/>`
    // Tail fletching
    + `<path d="M7 57 L16 48 M6 48 L15 48 L15 57" fill="none" stroke="${BLUE}" stroke-width="3"/>`,
  ),

  pepper_rain: () => wrap(64, 64,
    // Puffy dark storm cloud
    `<path d="M15 30 C9 30 8 21 14 19 C15 11 25 8 32 13 C37 7 49 10 50 18 C56 19 56 30 49 30 Z" fill="${SLATE}" stroke="${INK}" stroke-width="3"/>`
    + `<path d="M17 20 C20 14 27 13 31 16" fill="none" stroke="${SLATE_L}" stroke-width="2.6" opacity="0.7"/>`
    // Seven fiery peppercorn drops raining down
    + [[14, 41, BAD_BORDER], [23, 49, ORANGE], [31, 40, BRASS_MID], [39, 51, BAD_BORDER], [48, 41, ORANGE], [18, 56, BRASS_MID], [45, 56, BAD_BORDER]]
      .map(([cx, cy, col]) => `<path d="M${cx} ${Number(cy) - 6} C${Number(cx) + 4.5} ${cy} ${Number(cx) + 4.5} ${Number(cy) + 5} ${cx} ${Number(cy) + 5} C${Number(cx) - 4.5} ${Number(cy) + 5} ${Number(cx) - 4.5} ${cy} ${cx} ${Number(cy) - 6} Z" fill="${col}" stroke="${INK}" stroke-width="2.1"/>`).join(''),
  ),

  burrowbomb: () => wrap(64, 64,
    // Sparking fuse at tail
    `<path d="M12 18 Q18 10 24 17" fill="none" stroke="${INK}" stroke-width="3.2"/>`
    + `<circle cx="11" cy="18" r="5" fill="${BRASS_HI}" stroke="${ORANGE}" stroke-width="2"/>`
    + `<circle cx="11" cy="18" r="2" fill="#fff"/>`
    // Round iron bomb casing
    + `<circle cx="27" cy="29" r="14" fill="${SLATE_D}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M19 23 A10 10 0 0 1 30 18" fill="none" stroke="${SLATE_L}" stroke-width="2.8" opacity="0.8"/>`
    // Brass drill collar & spiral copper nose cone pointing down-right
    + `<path d="M35 20 L44 29 L29 44 L20 35 Z" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.6"/>`
    + `<path d="M41 26 L56 56 L26 41 Z" fill="${COPPER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M34 33 L48 39 M38 40 L51 46 M43 47 L53 51" stroke="${BRASS_HI}" stroke-width="2.4"/>`,
  ),

  rolypoly: () => wrap(64, 64,
    // Speed dust lines
    `<path d="M6 26 H16 M4 35 H13 M8 44 H17" stroke="${INK}" stroke-width="2.6" opacity="0.55"/>`
    // Armored coiled pillbug roller shell
    + `<circle cx="36" cy="34" r="21" fill="${SLATE}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M20 22 A19 19 0 0 1 51 22" fill="none" stroke="${SLATE_L}" stroke-width="4" opacity="0.7"/>`
    // Segmented brass-riveted armor plates
    + `<path d="M36 13 C46 19 46 49 36 55 M24 17 C33 24 33 44 24 51 M47 18 C52 25 52 43 47 50" fill="none" stroke="${INK}" stroke-width="2.6"/>`
    + `<circle cx="36" cy="34" r="7.5" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.6"/>`
    + `<circle cx="36" cy="34" r="3" fill="${BRASS_HI}"/>`
    // Cheeky peeking visor stripe
    + `<rect x="46" y="30" width="9" height="7" rx="3" fill="${ORANGE}" stroke="${INK}" stroke-width="2"/>`,
  ),

  barn_raising: () => wrap(64, 64,
    // Green restoration aura
    `<circle cx="32" cy="35" r="24" fill="${GOOD_SOFT}" opacity="0.28"/>`
    // Miniature timber barn silhouette
    + `<path d="M12 52 V30 L32 13 L52 30 V52 Z" fill="${TIMBER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M8 31 L32 11 L56 31" fill="none" stroke="${BAD_BORDER}" stroke-width="5.5"/>`
    + `<path d="M8 31 L32 11 L56 31" fill="none" stroke="${INK}" stroke-width="2.2"/>`
    // Cross-braced barn door
    + `<rect x="23" y="33" width="18" height="19" rx="2" fill="${PARCH}" stroke="${INK}" stroke-width="2.6"/>`
    + `<path d="M24 34 L40 51 M40 34 L24 51" stroke="${TIMBER_D}" stroke-width="2.2"/>`
    // Golden carpenter sparkle / plus crest
    + `<path d="M47 11 V21 M42 16 H52" stroke="${GOOD}" stroke-width="4.5"/>`
    + `<path d="M47 11 V21 M42 16 H52" stroke="${BRASS_HI}" stroke-width="2.2"/>`,
  ),

  tick_tock_crock: () => wrap(64, 64,
    // Twin brass alarm bells on top
    `<circle cx="19" cy="16" r="7" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
    + `<circle cx="45" cy="16" r="7" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
    + `<path d="M27 11 L32 7 L37 11" fill="none" stroke="${INK}" stroke-width="3"/>`
    // Stoneware crock pot body
    + `<path d="M14 26 H50 L47 54 C46 57 18 57 17 54 Z" fill="${COPPER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<rect x="12" y="21" width="40" height="7" rx="3" fill="${BRASS_LO}" stroke="${INK}" stroke-width="2.8"/>`
    // Clock dial face right on the crock belly
    + `<circle cx="32" cy="41" r="11.5" fill="${PAPER}" stroke="${INK}" stroke-width="2.6"/>`
    + `<path d="M32 41 V33 M32 41 L38 44" stroke="${BAD_INK}" stroke-width="2.8"/>`
    + `<circle cx="32" cy="41" r="2.2" fill="${INK}"/>`,
  ),

  pan_parade: () => wrap(64, 64,
    // Three marching copper skillets in staggered parade formation
    `<g transform="translate(-8,6)">`
    + `<line x1="12" y1="36" x2="24" y2="36" stroke="${INK}" stroke-width="4.5"/>`
    + `<ellipse cx="32" cy="36" rx="12" ry="8" fill="${COPPER_D}" stroke="${INK}" stroke-width="2.8"/>`
    + `<path d="M27 44 L25 50 M36 44 L39 50" stroke="${INK}" stroke-width="2.8"/>`
    + `</g>`
    + `<g transform="translate(8,-6)">`
    + `<line x1="12" y1="36" x2="24" y2="36" stroke="${INK}" stroke-width="4.5"/>`
    + `<ellipse cx="32" cy="36" rx="12" ry="8" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
    + `<path d="M27 44 L25 50 M36 44 L39 50" stroke="${INK}" stroke-width="2.8"/>`
    + `</g>`
    // Lead polished copper skillet
    + `<line x1="12" y1="39" x2="24" y2="39" stroke="${INK}" stroke-width="5.5"/>`
    + `<line x1="13" y1="39" x2="23" y2="39" stroke="${BRASS_HI}" stroke-width="2"/>`
    + `<ellipse cx="36" cy="39" rx="14" ry="9.5" fill="${COPPER}" stroke="${INK}" stroke-width="3"/>`
    + `<ellipse cx="36" cy="38" rx="9" ry="5" fill="${BRASS_HI}" opacity="0.45"/>`
    + `<path d="M30 48 L27 56 M41 48 L45 55" stroke="${INK}" stroke-width="3.2"/>`
    + `<circle cx="27" cy="56" r="2.2" fill="${BRASS_MID}" stroke="${INK}" stroke-width="1.5"/>`
    + `<circle cx="45" cy="55" r="2.2" fill="${BRASS_MID}" stroke="${INK}" stroke-width="1.5"/>`,
  ),

  // --- Plain Shots & Extra Shake (zero blank tiles!) ---
  gravel_sneeze: () => wrap(64, 64,
    `<path d="M10 34 Q22 24 34 22 M10 34 Q24 34 38 35 M10 34 Q22 44 35 48" fill="none" stroke="${BRASS_LO}" stroke-width="2.6" stroke-dasharray="3 3"/>`
    + `<polygon points="44,14 54,19 51,29 40,26" fill="${SLATE_L}" stroke="${INK}" stroke-width="2.8"/>`
    + `<polygon points="48,30 58,36 53,45 43,41" fill="${SLATE}" stroke="${INK}" stroke-width="2.8"/>`
    + `<polygon points="36,44 46,48 42,57 32,53" fill="#B89E7A" stroke="${INK}" stroke-width="2.8"/>`
    + `<circle cx="15" cy="34" r="6" fill="${PAPER}" stroke="${INK}" stroke-width="2.6"/>`,
  ),

  extra_shake: () => wrap(64, 64,
    `<path d="M8 34 Q20 20 34 16 M8 34 Q22 29 36 28 M8 34 Q22 40 36 41 M8 34 Q20 49 34 52" fill="none" stroke="${ORANGE}" stroke-width="2.5" stroke-dasharray="3 3"/>`
    + `<polygon points="41,10 51,14 48,23 38,20" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.6"/>`
    + `<polygon points="46,24 56,28 53,36 43,33" fill="${SLATE_L}" stroke="${INK}" stroke-width="2.6"/>`
    + `<polygon points="45,38 55,43 51,51 41,47" fill="${SLATE}" stroke="${INK}" stroke-width="2.6"/>`
    + `<polygon points="34,48 44,52 40,60 30,56" fill="#C88A2E" stroke="${INK}" stroke-width="2.6"/>`
    + `<circle cx="14" cy="34" r="6" fill="${BRASS_HI}" stroke="${INK}" stroke-width="2.6"/>`,
  ),

  clodpot: () => wrap(64, 64,
    `<path d="M35 16 Q42 8 49 14" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="14" r="4.5" fill="${BRASS_HI}" stroke="${ORANGE}" stroke-width="2"/>`
    + `<circle cx="30" cy="38" r="19" fill="${TIMBER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<rect x="21" y="16" width="18" height="7" rx="3" fill="${TIMBER_D}" stroke="${INK}" stroke-width="2.6"/>`
    + `<path d="M18 33 A14 14 0 0 1 32 23" fill="none" stroke="#E8B88A" stroke-width="3" opacity="0.7"/>`,
  ),

  hatpin: () => wrap(64, 64,
    `<line x1="12" y1="52" x2="54" y2="10" stroke="${INK}" stroke-width="6.5"/>`
    + `<line x1="13" y1="51" x2="53" y2="11" stroke="${SLATE_L}" stroke-width="3"/>`
    + `<circle cx="16" cy="48" r="9" fill="${BLUE}" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="13.5" cy="45.5" r="2.8" fill="#B6D4FF"/>`,
  ),

  nibbler: () => wrap(64, 64,
    `<path d="M12 32 C12 20 26 16 40 24 L54 32 L40 40 C26 48 12 44 12 32 Z" fill="${TIMBER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M36 22 L54 32 L36 42 Z" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.6"/>`
    + `<path d="M40 25 V39 M46 28 V36" stroke="${INK}" stroke-width="2"/>`,
  ),

  bouncebean: () => wrap(64, 64,
    `<path d="M8 52 Q20 26 32 48 Q44 20 56 32" fill="none" stroke="${INK}" stroke-width="2.4" stroke-dasharray="3 3" opacity="0.6"/>`
    + `<ellipse cx="36" cy="30" rx="16" ry="13" transform="rotate(-20 36 30)" fill="#F06EAA" stroke="${INK}" stroke-width="3.2"/>`
    + `<ellipse cx="31" cy="25" rx="5" ry="2.8" transform="rotate(-20 31 25)" fill="#FFD0E6"/>`,
  ),

  mendglob: () => wrap(64, 64,
    `<path d="M32 10 C45 14 54 26 52 40 C50 51 41 56 32 56 C23 56 14 51 12 40 C10 26 19 14 32 10 Z" fill="#2FB7A6" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M32 24 V44 M22 34 H42" stroke="${PAPER}" stroke-width="6.5"/>`
    + `<path d="M32 24 V44 M22 34 H42" stroke="${GOOD}" stroke-width="2.5"/>`,
  ),

  // --- Trick Shells & Doodads ---
  mole_mail: () => wrap(64, 64,
    // Snug courier mole bursting out of an envelope with copper nose drill
    `<rect x="10" y="24" width="38" height="28" rx="4" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>`
    + `<path d="M11 26 L29 39 L47 26" fill="none" stroke="${BRASS_LO}" stroke-width="2.6"/>`
    + `<circle cx="38" cy="26" r="12" fill="#7D5A44" stroke="${INK}" stroke-width="3"/>`
    + `<path d="M46 20 L58 26 L46 32 Z" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.4"/>`
    + `<circle cx="40" cy="24" r="2.2" fill="${INK}"/>`
    + `<circle cx="20" cy="43" r="4.5" fill="${BAD_BORDER}" stroke="${INK}" stroke-width="1.8"/>`,
  ),

  pudding_bomb: () => wrap(64, 64,
    `<path d="M12 42 C12 24 22 18 32 18 C42 18 52 24 52 42 C52 51 44 55 32 55 C20 55 12 51 12 42 Z" fill="#7A4928" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M16 30 C20 20 44 20 48 30 C44 35 39 30 35 34 C30 37 25 30 20 34 Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.4"/>`
    + `<circle cx="32" cy="17" r="5" fill="${BAD_BORDER}" stroke="${INK}" stroke-width="2.2"/>`,
  ),

  lid_lifter: () => wrap(64, 64,
    `<path d="M32 8 L44 22 H37 V34 H27 V22 H20 Z" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
    + `<path d="M10 48 C14 34 50 34 54 48 Z" fill="${SLATE_L}" stroke="${INK}" stroke-width="3.2"/>`
    + `<circle cx="32" cy="36" r="4" fill="${COPPER}" stroke="${INK}" stroke-width="2.2"/>`,
  ),

  marble_sack: () => wrap(64, 64,
    `<path d="M18 22 H46 L52 49 C52 55 12 55 12 49 Z" fill="#D8B37C" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M22 14 L32 21 L42 14" fill="none" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="25" cy="40" r="6" fill="${BLUE}" stroke="${INK}" stroke-width="2"/>`
    + `<circle cx="38" cy="42" r="6" fill="${GOOD_SOFT}" stroke="${INK}" stroke-width="2"/>`
    + `<circle cx="33" cy="32" r="5.5" fill="${ORANGE}" stroke="${INK}" stroke-width="2"/>`,
  ),

  nosy_goose: () => wrap(64, 64,
    `<ellipse cx="28" cy="38" rx="16" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M38 34 C44 24 46 16 52 16" fill="none" stroke="${INK}" stroke-width="9"/>`
    + `<path d="M38 34 C44 24 46 16 52 16" fill="none" stroke="${PAPER}" stroke-width="4.5"/>`
    + `<path d="M51 14 L60 18 L51 21 Z" fill="${ORANGE}" stroke="${INK}" stroke-width="2.2"/>`
    + `<circle cx="49" cy="15.5" r="2" fill="${INK}"/>`,
  ),

  old_turnip: () => wrap(64, 64,
    `<path d="M32 22 C26 10 18 11 19 18 M32 22 C32 8 38 8 38 17 M32 22 C40 12 48 14 44 20" fill="none" stroke="${GOOD}" stroke-width="3.5"/>`
    + `<path d="M16 34 C16 22 48 22 48 34 C48 48 36 53 32 58 C28 53 16 48 16 34 Z" fill="${PAPER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M17 34 C17 22 47 22 47 34 C40 37 24 37 17 34 Z" fill="#B565B8"/>`,
  ),

  rubber_radish: () => wrap(64, 64,
    `<path d="M32 20 L25 9 M32 20 L32 8 M32 20 L39 9" stroke="${GOOD_SOFT}" stroke-width="3.5"/>`
    + `<circle cx="32" cy="37" r="16" fill="#E84C7A" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M23 30 A10 10 0 0 1 34 25" fill="none" stroke="#FFB8CE" stroke-width="3"/>`,
  ),

  sod_sack: () => wrap(64, 64,
    `<path d="M10 50 C14 30 50 30 54 50 Z" fill="${TIMBER}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M14 42 C22 31 42 31 50 42" fill="none" stroke="${GOOD_SOFT}" stroke-width="6"/>`
    + `<path d="M14 42 C22 31 42 31 50 42" fill="none" stroke="${INK}" stroke-width="2"/>`,
  ),

  mend_bucket: () => wrap(64, 64,
    `<path d="M18 22 C18 9 46 9 46 22" fill="none" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M16 22 H48 L44 54 H20 Z" fill="${SLATE_L}" stroke="${INK}" stroke-width="3.2"/>`
    + `<path d="M32 30 V46 M24 38 H40" stroke="${GOOD}" stroke-width="5"/>`,
  ),

  pot_lid: () => wrap(64, 64,
    `<path d="M8 46 C12 24 52 24 56 46 Z" fill="${SLATE_L}" stroke="${INK}" stroke-width="3.2"/>`
    + `<circle cx="32" cy="24" r="6" fill="${BRASS_MID}" stroke="${INK}" stroke-width="2.8"/>`
    + `<path d="M16 40 C22 32 34 30 42 32" fill="none" stroke="#fff" stroke-width="2.8" opacity="0.7"/>`,
  ),
};

/** Returns a dedicated storybook vector data URL for any Knack, shot, or Doodad icon id. */
export function shotVectorUrl(iconId?: string): string | undefined {
  if (!iconId) return undefined;
  const key = iconId.replace(/^icon_/, '');
  const fn = SHOT_SVGS[key];
  return fn ? toDataUrl(`shot_${key}`, fn) : undefined;
}
