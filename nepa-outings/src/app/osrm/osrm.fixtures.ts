import type { Coordinates } from '../outings.models';

/**
 * Shared fixtures for the OSRM integration test and its oracle generator
 * (`scripts/generate-osrm-expected.ts`). Both MUST use the exact same
 * coordinates, otherwise the recorded expectations describe different routes.
 */

/** Home base for the test: a point in Kingston, PA 18704. */
export const USER_LOCATION: Coordinates = { lat: 41.262, lng: -75.8974 };

export interface NamedDestination extends Coordinates {
  readonly label: string;
  /** Rough driving distance from {@link USER_LOCATION}, for readability only. */
  readonly approxMiles: number;
}

/** Three real targets at increasing distance from Kingston. */
export const DESTINATIONS: ReadonlyArray<NamedDestination> = [
  { label: 'Dallas, PA (~5 mi)', lat: 41.3409, lng: -75.9635, approxMiles: 5 },
  { label: 'Hazleton, PA (~30 mi)', lat: 40.9584, lng: -75.9746, approxMiles: 30 },
  { label: 'Stroudsburg, PA (~60 mi)', lat: 40.9868, lng: -75.1946, approxMiles: 60 },
];
