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
import { audioDebug, loadAudio, unlockAudio, warmOfflineCache } from './audio/sfx';
import { DEBUG, fatalScreen } from './ui/fatal';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  const app = new App(root);
  const base = import.meta.env.BASE_URL;
  const [core] = await Promise.all([loadCore(), sprites.load(base), anims.load(base)]);
  void loadAudio(base);
  // Sound starts on the first real gesture anywhere (the map and the Workshop too, not only Play).
  for (const ev of ['pointerup', 'keydown', 'touchend']) window.addEventListener(ev, () => unlockAudio(), { capture: true, passive: true });
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
    if (hash === 'map' || hash === 'duel' || hash === 'skirmish' || hash === 'workshop' || hash === 'modes') return { to: hash };
    if (hash === 'settings') return { to: 'settings', back: { to: 'map' } };
    if (hash === 'yard') return { to: 'battle', setup: yardSetup(app) };
    if (hash.startsWith('level=')) {
      const id = hash.slice(6);
      // Only a real level that is open; anything else lands on the map.
      if (app.levels().some((l) => l.id === id) && app.levelOpen(id)) return { to: 'prebattle', level: id };
      return { to: 'map', focus: app.nextLevel() };
    }
    return { to: 'title' };
  };
  app.go(route());
  // A link change never drops a fight in progress.
  window.addEventListener('hashchange', () => { if (app.route.to !== 'battle') app.go(route()); });
  document.documentElement.dataset.ready = 'true';
  document.documentElement.dataset.core = core.name;
  if (DEBUG) Object.assign(window as unknown as object, { castleApp: app, castleAudio: audioDebug });

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
  fatalScreen('Something went wrong', 'The game hit a problem it could not recover from. Your progress is saved after every turn.', {
    map: () => { location.hash = 'map'; location.reload(); },
  });
}
window.addEventListener('error', (e) => onFatal(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => onFatal(e.reason));

boot().catch((e) => {
  console.error(e);
  if (e instanceof CoreLoadError) fatalScreen('Could not load the game', 'Check the connection and try again. Once it has loaded one time it also plays offline.');
  else fatalScreen('Could not start the game', 'Your save may be damaged. Try again, or reset the save to start fresh.', { reset: true });
});
