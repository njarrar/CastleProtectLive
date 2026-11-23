// The boot and crash screen, and the debug flag. Kept apart from main.ts so screens can use it.
import { resetAll } from '../save/db';
import { btn, h } from './dom';
import { t } from './text';

/** Debug handles (window.castleApp, window.__castle) exist only in dev or with ?debug in the URL. */
export const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

/** The one screen shown when the app cannot start or run. Always offers a way out. */
export function fatalScreen(title: string, detail: string, opts: { reset?: boolean; map?: () => void } = {}): void {
  const root = document.getElementById('app')!;
  document.documentElement.dataset.error = 'true';
  const card = h('main', { class: 'screen fatal', role: 'alertdialog', 'aria-labelledby': 'fatal-h' },
    h('div', { class: 'sheet' },
      h('h1', { id: 'fatal-h' }, title),
      h('p', {}, detail),
      h('div', { class: 'row-btns' },
        btn(t('errors.try_again'), () => location.reload(), 'primary big', { 'data-autofocus': true, 'data-testid': 'retry' }),
        opts.map ? btn(t('common.map'), opts.map, 'secondary') : '',
        opts.reset ? btn(t('errors.reset_save'), async () => { await resetAll(); location.reload(); }, 'secondary', { 'data-testid': 'reset-save' }) : '',
      ),
    ),
  );
  root.replaceChildren(card);
  card.querySelector<HTMLElement>('[data-autofocus]')?.focus();
}
