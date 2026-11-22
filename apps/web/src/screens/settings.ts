// S17 Settings. Every change applies at once; there is no Apply button.
import type { App, Route, Screen } from '../app';
import { DEFAULT_PROGRESS, clearBattle } from '../save/db';
import { btn, h, seg, toggle } from '../ui/dom';

export function settingsScreen(app: App, route: Route): Screen {
  const back = (route as Extract<Route, { to: 'settings' }>).back;
  const s = app.settings;
  const vol = h('input', { type: 'range', min: 0, max: 100, value: s.sound, 'aria-label': 'Sound' }) as HTMLInputElement;
  vol.addEventListener('input', () => void app.setSettings({ sound: Number(vol.value) }));
  const resetIn = h('input', { placeholder: 'Type RESET', 'aria-label': 'Type RESET to confirm' }) as HTMLInputElement;
  const row = (label: string, ctl: HTMLElement) => h('div', { class: 'field-row' }, h('span', { class: 'lab' }, label), ctl);
  const section = (title: string, ...kids: HTMLElement[]) => h('section', { class: 'sheet' }, h('h2', {}, title), ...kids);

  const el = h('main', { class: 'screen settings' },
    h('header', { class: 'topbar' }, btn('←', () => app.go(back), 'round-btn', { 'aria-label': 'Back', 'data-autofocus': true }), h('h1', {}, 'Settings')),
    h('div', { class: 'list' },
      section('Sound', row('Sound', vol), toggle('Mute all', s.mute, (v) => void app.setSettings({ mute: v }))),
      section('Assists',
        row('Difficulty', seg([['cozy', 'Cozy'], ['fair', 'Fair'], ['stubborn', 'Stubborn']], s.difficulty, (v) => void app.setSettings({ difficulty: v }), 'Difficulty')),
        toggle('Wind off', s.windOff, (v) => void app.setSettings({ windOff: v })),
      ),
      section('Controls',
        toggle('Quick Fire (lift to fire)', s.quickFire, (v) => void app.setSettings({ quickFire: v })),
        row('Drag mode', seg([['pull', 'Pull-back'], ['point', 'Point']], s.dragMode, (v) => void app.setSettings({ dragMode: v }), 'Drag mode')),
        row('Rotation', seg([['follow', 'Follow device'], ['wide', 'Stay wide'], ['tall', 'Stay tall']], s.rotation, (v) => void app.setSettings({ rotation: v }), 'Rotation')),
        toggle('Rival turns at 2x', s.rivalFast, (v) => void app.setSettings({ rivalFast: v })),
      ),
      section('Access',
        toggle('Reduce motion', s.reduceMotion, (v) => void app.setSettings({ reduceMotion: v })),
        row('Screen shake', seg([['100', '100%'], ['50', '50%'], ['0', 'Off']], String(s.reduceShake), (v) => void app.setSettings({ reduceShake: Number(v) as 100 | 50 | 0 }), 'Screen shake')),
      ),
      section('Save',
        h('p', { class: 'small' }, 'Your game saves on this device after every turn.'),
        h('div', { class: 'field-row' }, resetIn, btn('Reset progress', async () => {
          if (resetIn.value.trim().toUpperCase() !== 'RESET') { resetIn.focus(); return; }
          app.progress = structuredClone(DEFAULT_PROGRESS);
          await app.saveProgress();
          await clearBattle();
          app.go({ to: 'map' });
        }, 'secondary small')),
      ),
      section('About',
        h('p', {}, 'Free forever. No ads. Nothing to buy.'),
        h('p', { class: 'small' }, 'Privacy: Data Not Collected.'),
        h('p', { class: 'small' }, `Version 0.1. Rules core: ${app.core.name} ${app.core.version}.`),
      ),
    ),
  );
  return { el };
}
