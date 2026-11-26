#!/usr/bin/env node
// Automated Art & Atlas Verification Gate for Castle Protect.
// Zero external npm dependencies; runs standalone in Node 20+.
//   node tools/art-gen/verify-atlas.mjs
//   node tools/art-gen/verify-atlas.mjs --manifest /tmp/art-v2/manifest.json --strict
//   node tools/art-gen/verify-atlas.mjs --simulate-v2
import fs from 'fs';
import path from 'path';
import { FLATTENERS } from './sprite-flattener.mjs';
import { SCARF_OVERLAYS, HOB_HAT_OVERLAYS, HAT_DEDUP_HOBS } from './sprite-hob.mjs';
import { REDESIGN_SPRITE_NAMES } from './gen-redesign-ui.mjs';
import { pngAlphaBbox, packShelf, packMaxRects, buildDedupTables, DEFAULT_PAGE, DEFAULT_PAD } from './atlas-pack.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);

function flagVal(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const STRICT = args.includes('--strict');
const SIMULATE_V2 = args.includes('--simulate-v2');
const REQUIRE_2X_CHARS = args.includes('--require-2x-chars');
const JSON_OUT = args.includes('--json');
const MAX_PAGES = flagVal('--max-pages') ? Number(flagVal('--max-pages')) : null;

const manifestPath = path.resolve(flagVal('--manifest', path.join(ROOT, 'assets', 'manifest.json')));
const manifestDir = path.dirname(manifestPath);
const svgDir = path.resolve(flagVal('--svg-dir', path.join(manifestDir, 'svg')));
const spritesDir = path.resolve(flagVal('--sprites-dir', path.join(manifestDir, 'sprites')));
const atlasDir = path.resolve(flagVal('--atlas-dir', path.join(manifestDir, 'atlas')));
const shotsPath = path.resolve(flagVal('--shots', path.join(ROOT, 'content', 'shots.json')));

const errors = [];
const warnings = [];

if (!fs.existsSync(manifestPath)) {
  console.error(`FAIL: manifest not found at ${manifestPath}`);
  process.exit(1);
}
if (!fs.existsSync(shotsPath)) {
  console.error(`FAIL: shots.json not found at ${shotsPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const shots = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
const spriteMap = new Map((manifest.sprites || []).map(s => [s.name, s]));
const aliasMap = manifest.dedup?.aliases || {};
const hasSprite = (name) => spriteMap.has(name) || Boolean(aliasMap[name] && spriteMap.has(aliasMap[name]));

// 1. Every shot and knack in content/shots.json has corresponding icon_* and shell_* (or prop_*)
const missingShots = [];
for (const shot of shots) {
  if (shot.kind === 'plain' || shot.kind === 'knack' || shot.kind === 'trick') {
    if (!hasSprite(`icon_${shot.id}`)) missingShots.push(`icon_${shot.id} (${shot.kind}: ${shot.name})`);
    if (!hasSprite(`shell_${shot.id}`)) missingShots.push(`shell_${shot.id} (${shot.kind}: ${shot.name})`);
  } else if (shot.kind === 'child') {
    if (shot.flight && shot.flight.kind === 'prop') {
      const propName = `prop_${shot.id.replace(/_prop$/, '')}`;
      if (!hasSprite(propName)) missingShots.push(`${propName} (child prop: ${shot.name})`);
    } else if (!hasSprite(`shell_${shot.id}`)) {
      missingShots.push(`shell_${shot.id} (child: ${shot.name})`);
    }
  }
}
for (const m of missingShots) errors.push(`Missing shot/knack sprite: ${m}`);

// 2. All 7 Flattener types + square snooze balloon
const missingFlatteners = [];
for (const fk of Object.keys(FLATTENERS)) {
  for (const req of [`flattener_${fk}_idle_0`, `flattener_${fk}_fire_0`, `flattener_${fk}_bonked_0`, `portrait_flattener_${fk}`]) {
    if (!hasSprite(req)) missingFlatteners.push(req);
  }
}
if (!hasSprite('fx_snooze_balloon_square')) missingFlatteners.push('fx_snooze_balloon_square');
for (const m of missingFlatteners) errors.push(`Missing Flattener sprite: ${m}`);

// 3. All 5 Part 2 props (+ Part 1 props), all UI brass chrome icons, cutaway fort tiles, soil strata, & scarf overlays
const REQUIRED_GROUPS = {
  'Part 1 props': ['prop_cage_bar', 'prop_roller', 'prop_shears', 'prop_turnip', 'prop_crock'],
  'Part 2 props': REDESIGN_SPRITE_NAMES.props,
  'Part 2 UI brass chrome': REDESIGN_SPRITE_NAMES.ui,
  'Part 2 cutaway fort': REDESIGN_SPRITE_NAMES.fort,
  'Part 2 soil strata': REDESIGN_SPRITE_NAMES.terrain,
  'Scarf overlays': Object.keys(SCARF_OVERLAYS),
  ...(manifest.dedup?.mode === 'neutral-hat-scarf' || REQUIRE_2X_CHARS ? { 'Hob hat overlays': Object.keys(HOB_HAT_OVERLAYS) } : {}),
};
const missingRequired = {};
for (const [label, list] of Object.entries(REQUIRED_GROUPS)) {
  const miss = list.filter(n => !hasSprite(n));
  missingRequired[label] = miss;
  for (const m of miss) errors.push(`Missing ${label} sprite: ${m}`);
}

// 4. Dedup alias & overlay referential integrity
let dedupChecked = 0;
if (manifest.dedup) {
  for (const [alias, target] of Object.entries(manifest.dedup.aliases || {})) {
    dedupChecked++;
    if (!spriteMap.has(target)) errors.push(`Broken dedup alias: ${alias} -> ${target}`);
  }
  for (const [name, list] of Object.entries(manifest.dedup.overlays || {})) {
    for (const ov of list) {
      if (!spriteMap.has(ov.sprite)) errors.push(`Broken dedup overlay sprite for ${name}: ${ov.sprite}`);
      for (const field of ['dx', 'dy', 'rot', 'scale']) {
        if (typeof ov[field] !== 'number' || !Number.isFinite(ov[field])) {
          errors.push(`Invalid dedup overlay ${field} for ${name}: ${ov[field]}`);
        }
      }
    }
  }
}

// 5. SVG well-formedness & zero NaN/undefined check
function validateSvgText(name, txt) {
  const issues = [];
  const trimmed = txt.trim();
  if (!trimmed.startsWith('<svg ') || !trimmed.endsWith('</svg>')) {
    issues.push('missing <svg>...</svg> wrapper');
  }
  const vbMatch = trimmed.match(/viewBox="([^"]+)"/);
  if (!vbMatch) {
    issues.push('missing viewBox');
  } else {
    const nums = vbMatch[1].trim().split(/\s+/).map(Number);
    if (nums.length !== 4 || nums.some(n => !Number.isFinite(n)) || nums[2] <= 0 || nums[3] <= 0) {
      issues.push(`invalid viewBox="${vbMatch[1]}"`);
    }
  }
  const wMatch = trimmed.match(/\bwidth="([^"]+)"/);
  const hMatch = trimmed.match(/\bheight="([^"]+)"/);
  if (!wMatch || !Number.isFinite(Number(wMatch[1])) || Number(wMatch[1]) <= 0) issues.push('invalid width');
  if (!hMatch || !Number.isFinite(Number(hMatch[1])) || Number(hMatch[1]) <= 0) issues.push('invalid height');
  if (/\b(NaN|undefined|Infinity)\b/.test(trimmed)) issues.push('contains NaN/undefined/Infinity');
  if (/="(?:null)"/.test(trimmed)) issues.push('contains null attribute');
  const openG = (trimmed.match(/<g(?:\s|>)/g) || []).length;
  const closeG = (trimmed.match(/<\/g>/g) || []).length;
  if (openG !== closeG) issues.push(`unbalanced <g> tags (${openG} open vs ${closeG} close)`);
  const ids = new Set([...trimmed.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const ref of trimmed.matchAll(/url\(#([^)]+)\)/g)) {
    if (!ids.has(ref[1])) issues.push(`dangling url(#${ref[1]})`);
  }
  return issues;
}

let svgChecked = 0;
let svgFailed = 0;
if (fs.existsSync(svgDir)) {
  for (const s of manifest.sprites || []) {
    const p = path.join(svgDir, `${s.name}.svg`);
    if (!fs.existsSync(p)) {
      svgFailed++;
      errors.push(`Missing SVG file: ${s.name}.svg`);
      continue;
    }
    svgChecked++;
    const issues = validateSvgText(s.name, fs.readFileSync(p, 'utf8'));
    if (issues.length) {
      svgFailed++;
      errors.push(`Invalid SVG ${s.name}.svg: ${issues.join('; ')}`);
    }
  }
} else {
  warnings.push(`svg/ directory not found at ${svgDir}; skipped SVG content validation`);
}

// 6. Atlas page count & PNG transparent-pixel waste metrics
const atlasStats = {
  atlas1xPages: null,
  atlas2xPages: null,
  atlas2xVramMiB: null,
  pngCount2x: 0,
  bboxWastePct: null,
  alphaZeroPct: null,
  simulation: null,
};

for (const [key, file] of [['atlas1xPages', 'castle@1x.json'], ['atlas2xPages', 'castle@2x.json']]) {
  const p = path.join(atlasDir, file);
  if (fs.existsSync(p)) {
    const idx = JSON.parse(fs.readFileSync(p, 'utf8'));
    atlasStats[key] = Array.isArray(idx.pages) ? idx.pages.length : null;
  }
}
if (atlasStats.atlas2xPages !== null) {
  atlasStats.atlas2xVramMiB = atlasStats.atlas2xPages * 16;
  if (MAX_PAGES !== null && atlasStats.atlas2xPages > MAX_PAGES) {
    errors.push(`@2x atlas page count ${atlasStats.atlas2xPages} exceeds --max-pages ${MAX_PAGES}`);
  }
}

if (fs.existsSync(spritesDir)) {
  let rawArea = 0, trimArea = 0, opaqueArea = 0;
  const existing2xItems = [];
  const existing1xTrimByName = new Map();
  const existing2xTrimByName = new Map();
  for (const s of (manifest.sprites || []).filter(sp => sp.atlas)) {
    const f2 = s.files?.['2x'] ? path.join(spritesDir, path.basename(s.files['2x'])) : null;
    if (f2 && fs.existsSync(f2)) {
      const { trim, sourceSize, opaquePixels } = pngAlphaBbox(fs.readFileSync(f2));
      const sw = sourceSize[0] || s.w * 2, sh = sourceSize[1] || s.h * 2;
      rawArea += sw * sh;
      trimArea += trim[2] * trim[3];
      opaqueArea += opaquePixels;
      atlasStats.pngCount2x++;
      existing2xItems.push({ sprite: s, trim, sw, sh });
      existing2xTrimByName.set(s.name, { trim, sw, sh });
    }
    const f1 = s.files?.['1x'] ? path.join(spritesDir, path.basename(s.files['1x'])) : null;
    if (f1 && fs.existsSync(f1)) {
      const { trim, sourceSize } = pngAlphaBbox(fs.readFileSync(f1));
      existing1xTrimByName.set(s.name, { trim, sw: sourceSize[0] || s.w, sh: sourceSize[1] || s.h });
    }
  }
  if (rawArea > 0) {
    atlasStats.bboxWastePct = Number(((1 - trimArea / rawArea) * 100).toFixed(1));
    atlasStats.alphaZeroPct = Number(((1 - opaqueArea / rawArea) * 100).toFixed(1));
  }

  if ((SIMULATE_V2 || existing2xItems.length > 0) && existing2xItems.length > 0) {
    const legacyPages = packShelf(existing2xItems.map(x => ({ name: x.sprite.name, w: x.sw, h: x.sh })), DEFAULT_PAGE, DEFAULT_PAD, 2);
    const trimPages = packShelf(existing2xItems.map(x => ({ name: x.sprite.name, w: x.trim[2], h: x.trim[3], trim: x.trim, sourceW: x.sw, sourceH: x.sh })), DEFAULT_PAGE, DEFAULT_PAD, 2);

    // Simulate --v2 (--trim --dedup-hobs + TRUE @2x Retina charScale=2 with hat+scarf overlay dedup)
    const dedup = buildDedupTables(existing2xItems.map(x => x.sprite));
    const v2Items = [];
    for (const s of dedup.packedSprites) {
      // When simulating against an older manifest that still baked rival Hobs, fold rival Hobs into hat overlays
      const rm = /^hob_([a-z]+)_rival_/.exec(s.name);
      if (rm && HAT_DEDUP_HOBS.includes(rm[1])) continue;
      const d2 = existing2xTrimByName.get(s.name);
      if (!d2) continue;
      v2Items.push({ name: s.name, w: d2.trim[2], h: d2.trim[3], trim: d2.trim, sourceW: d2.sw, sourceH: d2.sh, frameScale: 2 });
    }
    // Include scarf and hat overlays at @2x if not already in existing sprites
    for (const sc of Object.keys(SCARF_OVERLAYS)) {
      if (!v2Items.some(i => i.name === sc)) v2Items.push({ name: sc, w: 32, h: 32, frameScale: 2 });
    }
    for (const ht of Object.keys(HOB_HAT_OVERLAYS)) {
      if (!v2Items.some(i => i.name === ht)) v2Items.push({ name: ht, w: 72, h: 68, frameScale: 2 });
    }
    const v2Pages = packMaxRects(v2Items, DEFAULT_PAGE, DEFAULT_PAD, 2);
    const v2Area = v2Items.reduce((acc, it) => acc + it.w * it.h, 0);
    atlasStats.simulation = {
      sampledSprites: existing2xItems.length,
      legacyPages2x: legacyPages.length,
      trimOnlyPages2x: trimPages.length,
      v2Pages2x: v2Pages.length,
      v2FillPct: Number(((v2Area / (v2Pages.length * DEFAULT_PAGE * DEFAULT_PAGE)) * 100).toFixed(1)),
      v2PackedFrames: v2Items.length,
      v2Aliases: Object.keys(dedup.aliases).length,
    };
  }
}

// 7. Packed atlas pages: every packed sprite, alias target, overlay and animation frame resolves to a
// frame; frames sit inside their page and do not overlap; legacy per-team names keep their own files.
const atlasCheck = { pages: [], framesChecked: 0, animFrames: 0, legacyFiles: 0, halfResCharFrames2x: 0 };
const pngSize = (file) => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const tag of ['1x', '2x']) {
  const ip = path.join(atlasDir, `castle@${tag}.json`);
  if (!fs.existsSync(ip)) continue;
  const idx = JSON.parse(fs.readFileSync(ip, 'utf8'));
  const frames = new Map();
  for (const pj of idx.pages || []) {
    const page = JSON.parse(fs.readFileSync(path.join(atlasDir, pj), 'utf8'));
    const img = path.join(atlasDir, page.image);
    if (!fs.existsSync(img)) { errors.push(`Atlas ${pj}: image ${page.image} missing`); continue; }
    const [pw, ph] = pngSize(img);
    atlasCheck.pages.push(`${page.image} ${pw}x${ph} ${(fs.statSync(img).size / 1048576).toFixed(2)} MiB`);
    if (pw !== page.size || ph !== page.size) errors.push(`Atlas ${page.image} is ${pw}x${ph}, JSON says ${page.size}`);
    const rects = Object.entries(page.frames);
    for (const [n, f] of rects) {
      if (frames.has(n)) errors.push(`Atlas @${tag}: frame ${n} is on two pages`);
      frames.set(n, f);
      if (f.x < 0 || f.y < 0 || f.x + f.w > pw || f.y + f.h > ph || f.w <= 0 || f.h <= 0) errors.push(`Atlas ${page.image}: frame ${n} is outside the page`);
      if (tag === '2x' && /^(hob|flattener)_/.test(n) && !/^hob_(scarf|patch|hat)_/.test(n)) {
        const effScale = f.scale ?? page.scale ?? 2;
        if (effScale < 2) atlasCheck.halfResCharFrames2x++;
      }
    }
    rects.sort((a, b) => a[1].x - b[1].x);
    for (let i = 0; i < rects.length; i++) {
      const [na, a] = rects[i];
      for (let j = i + 1; j < rects.length && rects[j][1].x < a.x + a.w; j++) {
        const [nb, b] = rects[j];
        if (b.y < a.y + a.h && a.y < b.y + b.h) errors.push(`Atlas ${page.image}: ${na} overlaps ${nb}`);
      }
    }
  }
  atlasCheck.framesChecked += frames.size;
  const al = idx.aliases || {};
  const resolves = (n) => frames.has(al[n] || n);
  for (const s of (manifest.sprites || []).filter(sp => sp.atlas)) {
    if (!frames.has(s.name)) errors.push(`Atlas @${tag}: packed sprite ${s.name} has no frame`);
  }
  for (const [a, t] of Object.entries(al)) if (!frames.has(t)) errors.push(`Atlas @${tag}: alias ${a} -> ${t} has no frame`);
  for (const [n, ovs] of Object.entries(idx.overlays || {})) {
    if (!resolves(n)) errors.push(`Atlas @${tag}: overlay base ${n} does not resolve`);
    for (const ov of ovs) if (!resolves(ov.sprite)) errors.push(`Atlas @${tag}: overlay ${ov.sprite} for ${n} has no frame`);
  }
  const animPath = path.join(manifestDir, 'animations.json');
  if (fs.existsSync(animPath)) {
    const anim = JSON.parse(fs.readFileSync(animPath, 'utf8'));
    for (const [k, a] of Object.entries(anim.animations || {})) {
      for (const fr of a.frames || []) {
        atlasCheck.animFrames++;
        if (!resolves(fr)) errors.push(`Atlas @${tag}: animation ${k} frame ${fr} does not resolve`);
        if (tag === '2x' && !fs.existsSync(path.join(spritesDir, `${fr}@2x.png`))) errors.push(`Animation ${k} frame ${fr} has no sprites/${fr}@2x.png`);
      }
      if (a.next && !anim.animations[a.next]) errors.push(`Animation ${k}: next ${a.next} is missing`);
    }
  }
  if (tag === '2x') {
    if (atlasCheck.halfResCharFrames2x > 0) {
      const msg = `Atlas @2x contains ${atlasCheck.halfResCharFrames2x} half-resolution (@1x) character frames (rebuild with default --char-scale=2)`;
      if (REQUIRE_2X_CHARS) errors.push(msg);
      else warnings.push(msg);
    }
    for (const a of Object.keys(al)) {
      for (const f of [`${a}.png`, `${a}@2x.png`]) {
        if (fs.existsSync(path.join(spritesDir, f))) atlasCheck.legacyFiles++;
        else errors.push(`Legacy name ${a} has no sprites/${f}`);
      }
    }
  }
}

const summary = {
  ok: errors.length === 0,
  manifest: manifestPath,
  spriteCount: (manifest.sprites || []).length,
  dedupMode: manifest.dedup?.mode || 'legacy',
  shotsChecked: shots.length,
  svgChecked,
  svgFailed,
  dedupAliasesChecked: dedupChecked,
  atlas: atlasStats,
  atlasCheck,
  warnings,
  errors,
};

if (JSON_OUT) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Castle Protect Art & Atlas Verification Gate`);
  console.log(`  Manifest:   ${manifestPath} (${summary.spriteCount} sprites, mode=${summary.dedupMode})`);
  console.log(`  Shots:      ${shots.length} entries checked (${missingShots.length} missing)`);
  console.log(`  Flatteners: ${Object.keys(FLATTENERS).length} types + square balloon (${missingFlatteners.length} missing)`);
  for (const [label, miss] of Object.entries(missingRequired)) {
    console.log(`  ${label.padEnd(23)} ${REQUIRED_GROUPS[label].length - miss.length}/${REQUIRED_GROUPS[label].length} present`);
  }
  if (svgChecked > 0) console.log(`  SVGs:       ${svgChecked} validated, ${svgFailed} failed (zero NaN/undefined/broken tags)`);
  if (dedupChecked > 0) console.log(`  Dedup:      ${dedupChecked} aliases & overlay tables verified`);
  if (atlasStats.atlas2xPages !== null) {
    console.log(`  Atlas @2x:  ${atlasStats.atlas2xPages} page(s) (~${atlasStats.atlas2xVramMiB} MiB VRAM)` + (atlasStats.atlas1xPages !== null ? ` | @1x: ${atlasStats.atlas1xPages} page(s)` : ''));
  }
  if (atlasStats.pngCount2x > 0) {
    console.log(`  PNG @2x:    ${atlasStats.pngCount2x} sprites scanned | bbox transparent waste: ${atlasStats.bboxWastePct}% | total alpha=0 pixels: ${atlasStats.alphaZeroPct}%`);
  }
  if (atlasStats.simulation) {
    const sim = atlasStats.simulation;
    console.log(`  Sim @2x:    legacy=${sim.legacyPages2x}p -> --trim=${sim.trimOnlyPages2x}p -> --v2=${sim.v2Pages2x}p (${sim.v2PackedFrames} frames, ${sim.v2FillPct}% of 2048x2048, ${sim.v2Aliases} aliases)`);
  }
  if (atlasCheck.framesChecked) {
    console.log(`  Pages:      ${atlasCheck.pages.join(' | ')}`);
    console.log(`  Frames:     ${atlasCheck.framesChecked} frames in bounds, no overlaps; ${atlasCheck.animFrames} animation frame refs resolve; ${atlasCheck.legacyFiles} legacy alias files`);
  }
  for (const w of warnings) console.log(`  WARN: ${w}`);
  if (errors.length) {
    console.log(`  ERRORS (${errors.length}):`);
    for (const e of errors.slice(0, 30)) console.log(`    - ${e}`);
    if (errors.length > 30) console.log(`    ... and ${errors.length - 30} more`);
  } else {
    console.log(`  RESULT: PASS (0 errors)`);
  }
}

if (STRICT && errors.length > 0) {
  process.exit(1);
}
