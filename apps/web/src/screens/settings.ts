// S17 Settings. Every change applies at once; there is no Apply button.
import type { App, Route, Screen } from '../app';
import { play } from '../audio/sfx';
import { DEFAULT_PROGRESS, clearBattle, type ColourSet } from '../save/db';
import { btn, h, seg, toggle } from '../ui/dom';
import { t } from '../ui/text';

/** The app's version for About (package.json). */
const APP_VERSION = '0.2';

export function settingsScreen(app: App, route: Route): Screen {
  const back = (route as Extract<Route, { to: 'settings' }>).back;
  const s = app.settings;
  let lastTick = 0;
  const tickSound = () => { const now = performance.now(); if (now - lastTick > 110) { lastTick = now; play('slider_tick'); } };
  const vol = h('input', { type: 'range', min: 0, max: 100, value: s.sound, 'aria-label': t('a11y.volume', { label: t('settings.sound.sound') }) }) as HTMLInputElement;
  vol.addEventListener('input', () => { void app.setSettings({ sound: Number(vol.value) }); tickSound(); });
  const mus = h('input', { type: 'range', min: 0, max: 100, value: s.music, 'aria-label': t('a11y.volume', { label: t('settings.sound.music') }) }) as HTMLInputElement;
  mus.addEventListener('input', () => { void app.setSettings({ music: Number(mus.value) }); tickSound(); });
  const vox = h('input', { type: 'range', min: 0, max: 100, value: s.voices, 'aria-label': t('a11y.volume', { label: t('settings.sound.voices') }) }) as HTMLInputElement;
  vox.addEventListener('input', () => { void app.setSettings({ voices: Number(vox.value) }); tickSound(); });
  const resetIn = h('input', { placeholder: t('settings.save.reset_field'), 'aria-label': t('settings.save.reset_confirm') }) as HTMLInputElement;
  const row = (label: string, ctl: HTMLElement) => h('div', { class: 'field-row' }, h('span', { class: 'lab' }, label), ctl);
  const section = (title: string, ...kids: HTMLElement[]) => h('section', { class: 'sheet' }, h('h2', {}, title), ...kids);
  const S = (k: string) => t(`settings.${k}`);

  const el = h('main', { class: 'screen settings' },
    h('header', { class: 'topbar' }, btn('←', () => { play('back'); app.go(back); }, 'round-btn silent', { 'aria-label': t('common.back'), 'data-autofocus': true }), h('h1', {}, S('title'))),
    h('div', { class: 'list' },
      section(S('sound.title'),
        row(S('sound.sound'), vol),
        row(S('sound.music'), mus),
        row(S('sound.voices'), vox),
        toggle(S('sound.mono'), s.mono, (v) => void app.setSettings({ mono: v })),
        toggle(S('sound.mute'), s.mute, (v) => void app.setSettings({ mute: v })),
        toggle(S('sound.subtitles'), s.subtitles, (v) => void app.setSettings({ subtitles: v })),
        toggle(S('sound.captions'), s.captions, (v) => void app.setSettings({ captions: v })),
      ),
      section(S('help.title'),
        row(S('help.difficulty'), seg([['cozy', t('setup.difficulty.cozy')], ['fair', t('setup.difficulty.fair')], ['stubborn', t('setup.difficulty.stubborn')]], s.difficulty, (v) => void app.setSettings({ difficulty: v }), S('help.difficulty'))),
        toggle(S('help.more_steam'), s.moreSteam, (v) => void app.setSettings({ moreSteam: v })),
        toggle(S('help.wind_off'), s.windOff, (v) => void app.setSettings({ windOff: v })),
      ),
      section(S('controls.title'),
        toggle(S('controls.quick_fire'), s.quickFire, (v) => void app.setSettings({ quickFire: v })),
        row(S('controls.drag_mode'), seg([['pull', S('controls.pull_back')], ['point', S('controls.point')]], s.dragMode, (v) => void app.setSettings({ dragMode: v }), S('controls.drag_mode'))),
        row(S('controls.rotation'), seg([['follow', S('controls.follow')], ['wide', S('controls.wide')], ['tall', S('controls.tall')]], s.rotation, (v) => void app.setSettings({ rotation: v }), S('controls.rotation'))),
        toggle(S('controls.rival_fast'), s.rivalFast, (v) => void app.setSettings({ rivalFast: v })),
        toggle(S('controls.left_hand'), s.leftHand, (v) => void app.setSettings({ leftHand: v })),
        toggle(S('controls.taps_only'), s.tapsOnly, (v) => void app.setSettings({ tapsOnly: v })),
      ),
      section(S('comfort.title'),
        toggle(S('comfort.large_text'), s.largeText, (v) => void app.setSettings({ largeText: v })),
        row(S('comfort.colour_set'), seg<ColourSet>([
          ['blue_orange', `${S('comfort.colours.blue')} / ${S('comfort.colours.orange')}`],
          ['navy_gold', `${S('comfort.colours.navy')} / ${S('comfort.colours.gold')}`],
          ['white_black', `${S('comfort.colours.white')} / ${S('comfort.colours.black')}`],
        ], s.colourSet, (v) => void app.setSettings({ colourSet: v }), S('comfort.colour_set'))),
        toggle(S('comfort.reduce_motion'), s.reduceMotion, (v) => void app.setSettings({ reduceMotion: v })),
        toggle(S('comfort.reduce_flashes'), s.reduceFlashes, (v) => void app.setSettings({ reduceFlashes: v })),
        row(S('comfort.screen_shake'), seg([['100', S('comfort.full')], ['50', '50%'], ['0', t('common.off')]], String(s.reduceShake), (v) => void app.setSettings({ reduceShake: Number(v) as 100 | 50 | 0 }), S('comfort.screen_shake'))),
      ),
      section(S('save.title'),
        h('p', { class: 'small' }, S('save.note')),
        h('p', { class: 'small' }, S('save.reset_confirm')),
        h('div', { class: 'field-row' }, resetIn, btn(S('save.reset'), async () => {
          if (resetIn.value.trim().toUpperCase() !== 'RESET') { resetIn.focus(); return; }
          app.progress = structuredClone(DEFAULT_PROGRESS);
          await app.saveProgress();
          await clearBattle();
          app.go({ to: 'map' });
        }, 'secondary small')),
      ),
      section(S('about.title'),
        h('p', {}, S('about.promise')),
        h('p', { class: 'small' }, S('about.privacy')),
        h('p', { class: 'small' }, t('settings.about.version', { version: APP_VERSION, rules: app.core.rules })),
      ),
    ),
  );
  return { el };
}
