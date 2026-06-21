import { expect, Page, test } from '@playwright/test';

const STORAGE_KEY = 'nepa-outings.locations.v1';

/**
 * Intercept the OSRM Table call and return synthetic-but-varied drive times, so
 * the suite is hermetic and the sort order is observable. Returns a getter for
 * how many times OSRM was hit (to prove the cache avoids refetching).
 */
async function mockOsrm(page: Page): Promise<() => number> {
  let calls = 0;
  await page.route('**/router.project-osrm.org/table/**', async (route) => {
    calls++;
    const url = new URL(route.request().url());
    const coordList = url.pathname.split('/driving/')[1] ?? '';
    const n = coordList.split(';').length; // sources + destinations
    // Index 0 is user->user (0); destinations get varied, deterministic values.
    const durations = Array.from({ length: n }, (_, i) =>
      i === 0 ? 0 : (((i * 37) % 90) + 5) * 60,
    );
    const distances = durations.map((s) => s * 12); // ~rough meters
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ code: 'Ok', durations: [durations], distances: [distances] }),
    });
  });
  return () => calls;
}

/** Parse a "12 min" / "1 hr 13 min" / "2 hr" badge into total minutes ("—" -> 0). */
function parseMinutes(text: string): number {
  const hr = text.match(/(\d+)\s*hr/);
  const min = text.match(/(\d+)\s*min/);
  return (hr ? Number(hr[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
}

/** Minutes shown in the visible primary badges, top to bottom of the first category. */
async function firstCategoryTimes(page: Page): Promise<number[]> {
  const texts = await page.locator('.category').first().locator('.card__primary').allTextContents();
  return texts.map(parseMinutes).filter((n) => n > 0);
}

test('geolocating sorts outings by live drive time and shows a My-location row', async ({ page }) => {
  await mockOsrm(page);
  await page.goto('/');

  await page.getByRole('button', { name: /use my location/i }).click();
  await expect(page.locator('.mylocation__saved')).toHaveCount(1);

  // The active card row reflects the user's location, not a fixed base.
  await expect(page.locator('.times__item--active').first()).toContainText(/my location/i);

  // Sorted ascending within a category.
  const times = await firstCategoryTimes(page);
  expect(times.length).toBeGreaterThan(1);
  const sorted = [...times].sort((a, b) => a - b);
  expect(times).toEqual(sorted);

  // Persisted to localStorage under a rounded key with per-outing times.
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), STORAGE_KEY);
  expect(saved).toHaveLength(1);
  expect(saved[0].key).toBe('41.370,-75.710');
  expect(Object.keys(saved[0].times).length).toBeGreaterThan(100);
});

test('persists location and auto-selects it on reload without refetching', async ({ page }) => {
  const calls = await mockOsrm(page);
  await page.goto('/');
  await page.getByRole('button', { name: /use my location/i }).click();
  await expect(page.locator('.mylocation__saved')).toHaveCount(1);
  expect(calls()).toBe(1);

  await page.reload();

  // Returning visitor: the saved location is auto-selected (no network call).
  await expect(page.getByRole('button', { name: /update my location/i })).toBeVisible();
  await expect(page.locator('.times__item--active').first()).toContainText(/my location/i);
  expect(calls()).toBe(1);
});

test('re-triggering from the same spot uses the cache (no refetch)', async ({ page }) => {
  const calls = await mockOsrm(page);
  await page.goto('/');
  await page.getByRole('button', { name: /use my location/i }).click();
  await expect(page.locator('.mylocation__saved')).toHaveCount(1);
  expect(calls()).toBe(1);

  await page.getByRole('button', { name: /update my location/i }).click();
  await expect(page.locator('.mylocation__saved')).toHaveCount(1);
  expect(calls()).toBe(1); // rounded key already cached
});

test('shows an error when location permission is denied', async ({ browser }) => {
  // Fresh context with geolocation permission withheld.
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await mockOsrm(page);
  await page.goto('/');

  await page.getByRole('button', { name: /use my location/i }).click();
  await expect(page.locator('.location-error')).toBeVisible();
  await expect(page.locator('.mylocation__saved')).toHaveCount(0);
  await context.close();
});

test('removing a saved location clears it and reverts the origin', async ({ page }) => {
  await mockOsrm(page);
  await page.goto('/');
  await page.getByRole('button', { name: /use my location/i }).click();
  await expect(page.locator('.mylocation__saved')).toHaveCount(1);

  await page.locator('.mylocation__remove').first().click();
  await expect(page.locator('.mylocation__saved')).toHaveCount(0);

  const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  expect(saved).toBe('[]');
  // Origin falls back to a fixed base.
  await expect(page.locator('.times__item--active').first()).toContainText(/kingston/i);
});
