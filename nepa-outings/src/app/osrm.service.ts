import { Injectable } from '@angular/core';
import { Coordinates } from './outings.models';

export interface DriveMetric {
  /** Driving distance along the fastest route, in meters. */
  readonly meters: number;
  /** Driving time along the fastest route, in seconds. */
  readonly seconds: number;
}

interface OsrmTableResponse {
  readonly code: string;
  readonly distances?: number[][]; // present only with annotations=distance
  readonly durations?: number[][]; // seconds
}

/**
 * Thin wrapper over the public OSRM demo server's Table service. One request
 * computes 1 source (the user) x N destinations, so a "recompute from me" is a
 * single HTTP call. Verified to accept the full ~180-point list in one shot,
 * so no chunking/polyline encoding is needed here.
 */
@Injectable({ providedIn: 'root' })
export class OsrmService {
  // Isolated so swapping to a self-hosted server later is a one-line change.
  private readonly base = 'https://router.project-osrm.org';

  /**
   * Driving distance + time from `user` to each destination, aligned to the
   * input order. OSRM wants `lng,lat` order in the URL — the single most common
   * bug — so the mapping lives here, once.
   */
  async distancesFromUser(
    user: Coordinates,
    destinations: ReadonlyArray<Coordinates>,
  ): Promise<ReadonlyArray<DriveMetric>> {
    if (destinations.length === 0) return [];

    const coords = [user, ...destinations].map((p) => `${p.lng},${p.lat}`).join(';');
    const url =
      `${this.base}/table/v1/driving/${coords}` +
      `?sources=0&annotations=distance,duration`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OSRM request failed with HTTP ${res.status}`);
    }
    const body = (await res.json()) as OsrmTableResponse;
    if (body.code !== 'Ok' || !body.distances || !body.durations) {
      throw new Error(`OSRM responded with code ${body.code}`);
    }

    const dist = body.distances[0];
    const dur = body.durations[0];
    // Index 0 is user->user; destination i is at index i + 1.
    return destinations.map((_, i) => ({ meters: dist[i + 1], seconds: dur[i + 1] }));
  }
}
