import { t } from './ui/text';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { App, type Route } from './app';
import { CoreLoadError, loadCore } from './core';
import { battleScreen } from './battle/battle';
import { mapScreen, modesScreen, titleScreen, yardSetup } from './screens/home';
import { prebattleScreen } from './screens/prebattle';
import { resultsScreen } from './screens/results';
import { duelScreen, skirmishScreen } from './screens/setup';
import { settingsScreen } from './screens/settings';
import { workshopScreen } from './screens/workshop';
import { sprites } from './render/sprites';
import { anims } from './render/anim';
import { audioDebug, isAudioRunning, loadAudio, unlockAudio, warmOfflineCache } from './audio/sfx';
import { DEBUG, fatalScreen } from './ui/fatal';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  const app = new App(root);
  const base = import.meta.env.BASE_URL;
  const [core] = await Promise.all([loadCore(), sprites.load(base), anims.load(base)]);
  void loadAudio(base);
  // Sound starts on the first real gesture anywhere; detach listeners once the AudioContext is running (Web-L4).
  const unlockEvents = ['pointerup', 'keydown', 'touchend'] as const;
  const onFirstGesture = () => {
    unlockAudio();
    if (isAudioRunning()) for (const ev of unlockEvents) window.removeEventListener(ev, onFirstGesture, true);
  };
  for (const ev of unlockEvents) window.addEventListener(ev, onFirstGesture, { capture: true, passive: true });
  await app.init(core);
  app.register('title', (a) => titleScreen(a));
  app.register('map', mapScreen);
  app.register('modes', (a) => modesScreen(a));
  app.register('prebattle', prebattleScreen);
  app.register('battle', battleScreen);
  app.register('results', resultsScreen);
  app.register('skirmish', (a) => skirmishScreen(a));
  app.register('duel', (a) => duelScreen(a));
  app.register('workshop', (a) => workshopScreen(a));
  app.register('settings', settingsScreen);

  // Deep links for testing and sharing: #map, #duel, #skirmish, #yard, #workshop, #settings, #level=1-1
  const route = (): Route => {
    const hash = location.hash.slice(1);
    const redirectMap = (): Route => {
      if (hash && hash !== 'map') history.replaceState(history.state, '', `${location.pathname}${location.search}#map`);
      return { to: 'map', focus: app.nextLevel() };
    };
    // Couch Duel (#duel) is open from install just like the Map's 2 Players button (Web-M16).
    // Other modes open after the campaign unlocks them; tests (?debug) open them straight.
    if (!DEBUG && !app.modesOpen() && ['skirmish', 'workshop', 'modes', 'yard'].includes(hash)) return redirectMap();
    if (hash === 'map' || hash === 'duel' || hash === 'skirmish' || hash === 'workshop' || hash === 'modes') return { to: hash };
    if (hash === 'settings') return { to: 'settings', back: { to: 'map' } };
    if (hash === 'yard') return { to: 'battle', setup: yardSetup(app) };
    if (hash.startsWith('level=')) {
      const id = hash.slice(6);
      // Only a real level that is open; anything else lands on the map.
      if (app.levels().some((l) => l.id === id) && app.levelOpen(id)) return { to: 'prebattle', level: id };
      return redirectMap();
    }
    return { to: 'title' };
  };
  app.go(route());
  // A link change never drops a fight in progress.
  window.addEventListener('hashchange', () => { if (app.route.to !== 'battle') app.go(route()); });
  document.documentElement.dataset.ready = 'true';
  document.documentElement.dataset.core = core.name;
  if (DEBUG) Object.assign(window as unknown as object, { castleApp: app, castleAudio: audioDebug, castleSprites: sprites });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    // registerType 'prompt': a new version waits until the player taps Update on the title or map.
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        app.pendingUpdate = () => { void updateSW(true); };
        app.showUpdateChip();
      },
      // Look for a new version at once on load (a returning player sees "Update ready" within a
      // second or two, before tapping Play), when the app comes back to the front, and every
      // hour for an installed app left open for days.
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        let lastCheck = 0;
        const check = () => {
          if (!navigator.onLine || Date.now() - lastCheck < 10_000) return;
          lastCheck = Date.now();
          void reg.update().catch(() => undefined);
        };
        check();
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 60 * 60 * 1000);
      },
    });
    // The first visit: once the worker takes control (clientsClaim), the sounds fetched before it
    // are fetched again through it, so they are cached for an offline launch.
    navigator.serviceWorker.addEventListener('controllerchange', () => warmOfflineCache());
  }
}

// Last line of defence: an uncaught error or rejection shows the error card, not a frozen page.
let failing = false;
function onFatal(e: unknown): void {
  if (failing || document.documentElement.dataset.ready !== 'true') return;
  failing = true;
  console.error(e);
  fatalScreen(t('errors.fatal_title'), t('errors.fatal_body'), {
    map: () => { location.hash = 'map'; location.reload(); },
  });
}
window.addEventListener('error', (e) => onFatal(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => onFatal(e.reason));

boot().catch((e) => {
  console.error(e);
  if (e instanceof CoreLoadError) fatalScreen(t('errors.load_title'), t('errors.load_body'));
  else fatalScreen(t('errors.start_title'), t('errors.start_body'), { reset: true });
});
