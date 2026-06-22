import { TestBed } from '@angular/core/testing';
import { OsrmService } from './osrm.service';
import { USER_LOCATION, DESTINATIONS } from './osrm.fixtures';
import expectedData from './osrm.expected.json';

/**
 * FLAKY: this is a live integration test. It makes a real HTTP request to the
 * public OSRM demo server (router.project-osrm.org), so it can fail from
 * network issues, server downtime, or — most subtly — map data drift, where
 * the server's routing changes and distances no longer match the recorded
 * expectations.
 *
 * The expectations live in osrm.expected.json and are NOT hand-maintained. To
 * refresh them with current values from the server, run:
 *
 *   npm run osrm:expected
 *
 * This test is excluded from the default `npm test` run (see angular.json).
 * Run it on its own with:
 *
 *   npm run test:osrm
 *
 * What it actually verifies: OsrmService fetches all destinations in one
 * batched Table call and slices the matrix by index. The oracle script fetches
 * each destination separately. If the service mis-aligns its indices, the
 * batched numbers won't match the per-destination ones — that's the bug this
 * guards against.
 */

// Distances should match the freshly-recorded oracle almost exactly; the slack
// only absorbs map-data drift since the JSON was last regenerated.
const RELATIVE_TOLERANCE = 0.05;
const NETWORK_TIMEOUT_MS = 30_000;

describe('OsrmService integration (live OSRM server)', () => {
  let service: OsrmService;

  beforeEach(() => {
    service = TestBed.inject(OsrmService);
  });

  it('returns one metric per destination, in order', async () => {
    const metrics = await service.distancesFromUser(USER_LOCATION, DESTINATIONS);
    expect(metrics.length).toBe(DESTINATIONS.length);
  }, NETWORK_TIMEOUT_MS);

  it('matches the recorded per-destination distances and times', async () => {
    const metrics = await service.distancesFromUser(USER_LOCATION, DESTINATIONS);

    expectedData.expected.forEach((want, i) => {
      const got = metrics[i];

      expect(
        Math.abs(got.meters - want.meters) / want.meters,
        `distance for ${want.label}: expected ~${want.meters} m, got ${got.meters} m ` +
          `(refresh with \`npm run osrm:expected\`)`,
      ).toBeLessThanOrEqual(RELATIVE_TOLERANCE);

      expect(
        Math.abs(got.seconds - want.seconds) / want.seconds,
        `duration for ${want.label}: expected ~${want.seconds} s, got ${got.seconds} s ` +
          `(refresh with \`npm run osrm:expected\`)`,
      ).toBeLessThanOrEqual(RELATIVE_TOLERANCE);
    });
  }, NETWORK_TIMEOUT_MS);

  it('orders destinations by increasing distance (5 < 30 < 60 mi)', async () => {
    const metrics = await service.distancesFromUser(USER_LOCATION, DESTINATIONS);
    const meters = metrics.map((m) => m.meters);

    expect(meters[0]).toBeLessThan(meters[1]);
    expect(meters[1]).toBeLessThan(meters[2]);
  }, NETWORK_TIMEOUT_MS);
});
