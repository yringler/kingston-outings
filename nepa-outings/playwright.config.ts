import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the "distances from me" feature. They run against a real
 * `ng serve` (started automatically) but mock the OSRM network call, so they are
 * deterministic and don't depend on the public demo server being up.
 *
 * Requires Node >= 24.15.0 (the Angular 22 CLI rejects older 24.x). Install the
 * browser once with `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    // Default location for tests that grant permission; individual tests can
    // override geolocation or revoke the permission.
    permissions: ['geolocation'],
    geolocation: { latitude: 41.37, longitude: -75.71 }, // near Scranton, PA
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
