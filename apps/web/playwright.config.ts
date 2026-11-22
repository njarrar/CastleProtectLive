import { defineConfig, devices } from '@playwright/test';

// The tests run against the production build (vite preview), so the PWA and the copied wasm
// core are what CI ships. VITE_BASE (set in web.yml for Pages) is honoured.
//
// Projects:
//  - chromium: desktop 1280x720, every spec.
//  - iphone: iPhone 15 portrait in WebKit (touch, 3x), the phone specs.
//  - pixel-landscape: Pixel 7 landscape in Chromium (touch), the phone specs.
// The phone projects run the specs that do not need a service worker or a keyboard: the
// fixes, mobile and qa1 (QA playtest 1) specs. PW_PROJECTS narrows the run (CI runs all three).
const base = process.env.VITE_BASE ?? '/';
const port = 4173;
const phoneSpecs = /(fixes|mobile|qa1)\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // CI machines are slower and share the preview server: retry once, and run two at a time.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'iphone', testMatch: phoneSpecs, use: { ...devices['iPhone 15'] } },
    { name: 'pixel-landscape', testMatch: phoneSpecs, use: { ...devices['Pixel 7 landscape'] } },
  ],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
