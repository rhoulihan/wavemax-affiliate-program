// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for the Austin reference build.
 *
 * Runs against a self-spawned static server on port 3101 (avoids the
 * Oracle-Workshop conflict on 3000 and the dev static server on 3001).
 *
 * Tests live in tests/e2e/. Run via:
 *   npm run test:e2e
 *   npx playwright test tests/e2e/austin-reference/bridge.spec.js
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,        // single-worker — host page is shared, less flake
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3101',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 900 }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'node tests/e2e/static-server.js',
    port: 3101,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
