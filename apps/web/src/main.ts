import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { App, type Route } from './app';
import { loadCore } from './core';
import { battleScreen } from './battle/battle';
import { mapScreen, modesScreen, titleScreen, yardSetup } from './screens/home';
import { prebattleScreen } from './screens/prebattle';
import { resultsScreen } from './screens/results';
import { duelScreen, skirmishScreen } from './screens/setup';
import { settingsScreen } from './screens/settings';
import { workshopScreen } from './screens/workshop';
import { sprites } from './render/sprites';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  const app = new App(root);
  const [core] = await Promise.all([loadCore(), sprites.load(import.meta.env.BASE_URL)]);
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
  let start: Route = { to: 'title' };
  if (hash === 'map' || hash === 'duel' || hash === 'skirmish' || hash === 'workshop' || hash === 'modes') start = { to: hash };
  else if (hash === 'settings') start = { to: 'settings', back: { to: 'map' } };
  else if (hash === 'yard') start = { to: 'battle', setup: yardSetup(app) };
  else if (hash.startsWith('level=')) start = { to: 'prebattle', level: hash.slice(6) };
  return start;
  };
  app.go(route());
  window.addEventListener('hashchange', () => app.go(route()));
  document.documentElement.dataset.ready = 'true';
  document.documentElement.dataset.core = core.name;
  (window as unknown as { castleApp?: App }).castleApp = app;

  if ('serviceWorker' in navigator && import.meta.env.PROD) registerSW({ immediate: true });
}

void boot();
