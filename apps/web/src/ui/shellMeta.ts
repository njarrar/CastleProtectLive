// Read-only display metadata derived strictly from content/shots.json for decision-grade
// Shell Inspect Cards (Plate 5) and Draft previews. Zero gameplay rules live here.
import shotsRaw from '../../../../content/shots.json' with { type: 'json' };
import type { HobClass, ShotChip } from '../core/types';
import { sprites } from '../render/sprites';
import { CLASS_COLOR, CLASS_ICON, CLASS_INK, classBadge, h } from './dom';
import { restCogUrl, shotVectorUrl } from './svgIcons';
import { className, has, plural, t } from './text';

interface RawEffect {
  op?: string;
  dmg?: number;
  dtype?: string;
  band?: string;
  child?: string;
  count?: number;
  hp?: number;
  radius?: number;
  above_n?: number;
  low_row_pct?: number;
  mat_bonus?: Record<string, number>;
  shot?: string;
}
interface RawShot {
  id: string;
  name: string;
  kind?: string;
  weight?: string;
  match_class?: string;
  dud?: boolean;
  tags?: string[];
  card?: string;
  flight?: {
    kind?: string;
    max_cells?: number;
    max_blocks?: number;
    block_dmg?: number;
    pass_blocks?: number;
    pass_dmg?: number;
    bounces?: number;
    guide_tenths?: number;
    roll_ticks?: number;
    stops_rollers?: boolean;
  };
  triggers?: { on?: string; do?: RawEffect[] }[];
  self_effects?: RawEffect[];
}

const SHOTS = new Map<string, RawShot>((shotsRaw as RawShot[]).map((s) => [s.id, s]));

const bandLabel = (band: string): string => (has(`shell_card.bands.${band}`) ? t(`shell_card.bands.${band}`) : t('shell_card.bands.medium'));

/** The portrait shown next to "Best with a <Class>": the first Hob of that Class (sprite name). */
const CLASS_HOB: Record<string, string> = {
  lobber: 'marge', zinger: 'quill', scatterjack: 'jax', delver: 'grub', boinker: 'bobbin', patcher: 'hetty',
};


export interface ShotDisplayMeta {
  dmgNum: number;
  dmgLabel: string;
  dmgPct: number;
  dmgTone: 'blast' | 'pierce' | 'dig' | 'mend' | 'dud';
  rangeLabel: string;
  /** The sentence-case "Good at: ..." line (`shots.<id>.good_at`), or ''. */
  goodAt: string;
  line: string;
}

/** Build structured visual stats for any shot from content/shots.json + optional live ShotChip fields. */
export function describeShot(id: string, chip?: Partial<ShotChip>): ShotDisplayMeta {
  const def = SHOTS.get(id) ?? (chip?.icon ? SHOTS.get(chip.icon) : undefined);
  let dmgNum = chip?.dmg ?? 0;
  let dmgKind: ShotDisplayMeta['dmgTone'] = 'blast';
  let dmgLabel = '';
  let band = chip?.band;
  let splitCount = 0;
  let childDmg = 0;
  let hasColumn = false;
  let columnAbove = 0;
  let hasMound = false;
  let moundRadius = 0;
  let hasRebuild = false;
  let hasLowRow = false;
  let wickerBonus = false;
  let delayedProp: RawShot | undefined;

  if (def) {
    for (const tr of def.triggers ?? []) {
      for (const eff of tr.do ?? []) {
        if (typeof eff.dmg === 'number' && eff.dmg > dmgNum) dmgNum = eff.dmg;
        if (eff.dtype === 'pierce') dmgKind = 'pierce';
        if (eff.band && !band) band = eff.band;
        if (eff.low_row_pct && eff.low_row_pct > 100) hasLowRow = true;
        if (eff.mat_bonus && eff.mat_bonus.wicker) wickerBonus = true;
        if (eff.op === 'column') { hasColumn = true; columnAbove = eff.above_n ?? 2; }
        if (eff.op === 'mound') { hasMound = true; moundRadius = eff.radius ?? 36; }
        if (eff.op === 'rebuild') hasRebuild = true;
        if (eff.op === 'split' && eff.child) {
          splitCount = eff.count ?? 0;
          const ch = SHOTS.get(eff.child);
          const cd = ch?.triggers?.[0]?.do?.[0]?.dmg ?? 0;
          if (cd > 0) childDmg = cd;
          if (!band && ch?.triggers?.[0]?.do?.[0]?.band) band = ch.triggers[0].do[0].band;
        }
        if (eff.op === 'become_prop' && eff.shot) {
          delayedProp = SHOTS.get(eff.shot);
          const pd = delayedProp?.triggers?.[0]?.do?.[0];
          if (pd?.dmg && pd.dmg > dmgNum) dmgNum = pd.dmg;
          if (pd?.band && !band) band = pd.band;
        }
      }
    }
    if (def.flight?.kind === 'dig') {
      dmgKind = 'dig';
      if (!dmgNum && def.flight.block_dmg) dmgNum = def.flight.block_dmg;
    }
    if (def.flight?.kind === 'beam') dmgKind = 'pierce';
    if (def.self_effects?.length) {
      const mendHp = def.self_effects[0]?.hp ?? 0;
      if (mendHp > 0) { dmgNum = mendHp; dmgKind = 'mend'; }
    }
    if (def.dud) dmgKind = 'dud';
  }

  // The main stat, in the table's words.
  const dtypeWord = (k: string) => t(`shell_card.damage_types.${k}`);
  if (def?.dud) {
    dmgLabel = t('shell_card.stats.dud');
  } else if (hasRebuild) {
    dmgNum = 75;
    dmgKind = 'mend';
    dmgLabel = t('shell_card.stats.rebuild_or_puff', { n: 4 });
  } else if (dmgKind === 'mend') {
    dmgLabel = t('shell_card.stats.mend_value', { n: dmgNum });
  } else if (splitCount > 0 && childDmg > 0) {
    dmgNum = Math.min(85, splitCount * childDmg);
    dmgLabel = t('shell_card.stats.split_damage', { n: splitCount, dmg: childDmg });
  } else if (delayedProp && dmgNum > 0) {
    dmgLabel = `${dmgNum} ${dtypeWord('blast')}. ${t('shell_card.stats.later')}`;
  } else if (hasMound && dmgNum === 0) {
    dmgNum = 30;
    dmgKind = 'dig';
    dmgLabel = t('shell_card.stats.mound');
  } else if (dmgNum > 0) {
    dmgLabel = `${dmgNum} ${dtypeWord(dmgKind === 'pierce' ? 'pierce' : dmgKind === 'dig' ? 'dig' : 'blast')}`;
  } else {
    dmgLabel = '';
  }

  // The second stat: how it travels or how wide it hits.
  let rangeLabel = '';
  if (def?.flight?.kind === 'dig' && def.flight.max_cells) {
    rangeLabel = t('shell_card.stats.tunnel', { n: def.flight.max_cells });
  } else if (def?.flight?.kind === 'beam' && def.flight.pass_blocks) {
    rangeLabel = plural('shell_card.stats.through', def.flight.pass_blocks);
  } else if (def?.flight?.kind === 'bounce' && def.flight.bounces) {
    rangeLabel = plural('shell_card.stats.bounces', def.flight.bounces);
  } else if (def?.flight?.kind === 'roller') {
    rangeLabel = t('shell_card.stats.rolls');
  } else if (hasColumn) {
    rangeLabel = t('shell_card.stats.column', { n: columnAbove });
  } else if (hasMound) {
    rangeLabel = t('shell_card.stats.mound');
  } else if (hasRebuild) {
    rangeLabel = t('shell_card.own_fort');
  } else if (def?.tags?.includes('threads')) {
    rangeLabel = t('shell_card.stats.threads');
  } else if (band) {
    rangeLabel = t('shell_card.stats.blast', { band: bandLabel(band) });
  }
  void wickerBonus; void hasLowRow; void moundRadius;

  // "Good at": one sentence-case line per shot from the table (no more "Best vs" tables).
  const sid = def?.id ?? id;
  const goodAt = has(`shots.${sid}.good_at`) ? t('shell_card.good_at', { what: t(`shots.${sid}.good_at`) }) : '';

  const dmgPct = def?.dud ? 8 : Math.max(12, Math.min(100, Math.round((dmgNum / 85) * 100)));
  return {
    dmgNum,
    dmgLabel,
    dmgPct,
    dmgTone: dmgKind,
    rangeLabel,
    goodAt,
    line: chip?.line ?? def?.card ?? '',
  };
}

/** Resolve the best icon URL for a shot/knack/doodad (atlas sprite -> dedicated SVG vector). */
export function resolveShotIconUrl(iconId?: string, fallbackAtlas?: Record<string, string>): string | undefined {
  if (!iconId) return undefined;
  const direct = sprites.url(`icon_${iconId}`);
  if (direct) return direct;
  const vec = shotVectorUrl(iconId);
  if (vec) return vec;
  const fb = fallbackAtlas?.[iconId];
  return fb ? sprites.url(fb) : undefined;
}

/** Crisp bronze rest cog icon strip (1 or 2 cogs). */
export function restCogImgs(weight: number): HTMLElement[] {
  const u = restCogUrl();
  return Array.from({ length: weight }, () => h('img', { src: u, alt: '', class: 'cog-ico', 'aria-hidden': 'true' }));
}

/** "Best with a <Class>" strip with that Class's Hob portrait (Plate 5). */
export function bestClassStrip(best: HobClass | string | undefined, isTrickShell: boolean): HTMLElement | string {
  if (!best || best === 'all') return '';
  const hob = CLASS_HOB[best];
  const portrait = hob ? sprites.url(`portrait_${hob}_blue`) : undefined;
  const avatar = portrait
    ? h('span', { class: 'best-avatar', style: `--c:${CLASS_COLOR[best] ?? '#888'}` }, h('img', { src: portrait, alt: '' }))
    : h('span', { class: 'best-avatar', style: `--c:${CLASS_COLOR[best] ?? '#888'};--fg:${CLASS_INK[best] ?? '#fff'}` }, CLASS_ICON[best] ?? '★');
  const label = isTrickShell
    ? t('shell_card.best_with', { class: className(best), pct: 10 })
    : t('shell_card.best_with_short', { class: className(best) });
  return h('div', { class: 'shell-best-strip' },
    avatar,
    classBadge(best, 0),
    h('span', { class: 'best-txt' }, label),
  );
}
