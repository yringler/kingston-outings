import { Injectable } from '@angular/core';
import { Coordinates } from './outings.models';

export type GeolocationFailure =
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'denied' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'timeout' };

const ERROR_BY_CODE: Record<number, GeolocationFailure> = {
  1: { kind: 'denied' },
  2: { kind: 'unavailable' },
  3: { kind: 'timeout' },
};

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  /** Whether the API exists at all (lets the UI hide the feature up front). */
  readonly supported = 'geolocation' in navigator;

  /**
   * Resolve the user's current position as {lat, lng}, or reject with a typed
   * {@link GeolocationFailure}. Must be called from a user gesture (and over
   * HTTPS) or the browser will refuse the permission prompt.
   */
  getCurrentPosition(): Promise<Coordinates> {
    return new Promise<Coordinates>((resolve, reject) => {
      if (!this.supported) {
        reject({ kind: 'unsupported' } satisfies GeolocationFailure);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(ERROR_BY_CODE[err.code] ?? { kind: 'unavailable' }),
        // Modest maximumAge: this is triggered by an explicit "update my
        // location" gesture, so favour a reasonably fresh fix over a 5-min-old
        // one. Repeat clicks from the same spot are still cheap — the rounded
        // cache key avoids a redundant OSRM call regardless.
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }
}
