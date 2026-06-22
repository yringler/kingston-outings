import { Injectable, computed, inject, signal } from '@angular/core';
import data from './outings.json';
import {
  Category,
  Coordinates,
  MY_LOCATION_ID,
  Outing,
  OutingsData,
  SelectedOrigin,
} from './outings.models';
import { GeolocationFailure, GeolocationService } from './geolocation.service';
import { OsrmService } from './osrm/osrm.service';
import { LocationStore, SavedLocation } from './location-store';

const DATA = data as OutingsData;

@Injectable({ providedIn: 'root' })
export class OutingsService {
  private readonly geo = inject(GeolocationService);
  private readonly osrm = inject(OsrmService);
  private readonly store = inject(LocationStore);

  readonly origins = DATA.origins;
  readonly categories = DATA.categories;
  /** Whether to offer the "my location" feature at all. */
  readonly geoSupported = this.geo.supported;

  /** Flattened outings that carry coordinates (the only ones OSRM can place). */
  private readonly geocoded = DATA.categories
    .flatMap((c) => c.items)
    .filter((i): i is Outing & { coordinates: Coordinates } => i.coordinates != null);

  /** Total number of outings, for display. */
  readonly totalCount = DATA.categories.reduce((n, c) => n + c.items.length, 0);

  // --- User-controlled state ---
  readonly origin = signal<SelectedOrigin>('kingston');
  readonly search = signal('');
  readonly activeCategory = signal<string | null>(null);
  /** Max one-way drive time in minutes; null = no limit. */
  readonly maxTime = signal<number | null>(null);

  // --- Live "my location" state ---
  /** True while geolocating / fetching driving distances. */
  readonly locating = signal(false);
  /** Human-readable error from the last location attempt, if any. */
  readonly locationError = signal<string | null>(null);
  /** Cache key of the currently-selected user location, if any. */
  private readonly activeLocationKey = signal<string | null>(null);

  /** Saved/recent user locations, most recent first. */
  readonly recentLocations = this.store.recent;

  /** The currently-selected user location object, if one is active. */
  readonly activeLocation = computed<SavedLocation | null>(() => {
    const key = this.activeLocationKey();
    return key ? (this.store.get(key) ?? null) : null;
  });

  /** Drive times (minutes, by outing name) for the active user location. */
  readonly liveTimes = computed<Readonly<Record<string, number | null>>>(
    () => this.activeLocation()?.times ?? {},
  );

  constructor() {
    // Returning visitor: surface their most recent location immediately
    // (cached, no refetch). They can switch to a fixed base at any time.
    const recent = this.store.recent();
    if (recent.length) {
      this.activeLocationKey.set(recent[0].key);
      this.origin.set(MY_LOCATION_ID);
    }
  }

  /** Drive time (minutes) for an outing from the given origin, static or live. */
  private timeFor(
    item: Outing,
    origin: SelectedOrigin,
    live: Readonly<Record<string, number | null>>,
  ): number | null {
    return origin === MY_LOCATION_ID ? (live[item.name] ?? null) : item.times[origin];
  }

  /** Geolocate the user, compute distances, and sort by them. User-gesture only. */
  async useMyLocation(): Promise<void> {
    if (this.locating()) return;
    this.locating.set(true);
    this.locationError.set(null);
    try {
      const coords = await this.geo.getCurrentPosition();
      await this.applyLocation(coords);
    } catch (err) {
      this.locationError.set(describeError(err));
    } finally {
      this.locating.set(false);
    }
  }

  /** Re-sort by an already-resolved location (cached — never refetches). */
  selectSavedLocation(loc: SavedLocation): void {
    this.locationError.set(null);
    this.activeLocationKey.set(loc.key);
    this.origin.set(MY_LOCATION_ID);
  }

  renameLocation(key: string, label: string): void {
    const trimmed = label.trim();
    if (trimmed) this.store.rename(key, trimmed);
  }

  removeLocation(key: string): void {
    this.store.remove(key);
    if (this.activeLocationKey() === key) {
      this.activeLocationKey.set(null);
      this.origin.set('kingston');
    }
  }

  /** Resolve times for a coordinate (cache hit or one OSRM call) and select it. */
  private async applyLocation(coords: Coordinates): Promise<void> {
    const key = LocationStore.keyFor(coords);
    const cached = this.store.get(key);
    if (cached) {
      this.store.save({ ...cached, savedAt: Date.now() }); // bump recency
    } else {
      const metrics = await this.osrm.distancesFromUser(
        coords,
        this.geocoded.map((i) => i.coordinates),
      );
      const times: Record<string, number | null> = {};
      this.geocoded.forEach((item, i) => {
        times[item.name] = Math.round(metrics[i].seconds / 60);
      });
      this.store.save({
        key,
        label: defaultLabel(this.store.recent().length),
        lat: coords.lat,
        lng: coords.lng,
        savedAt: Date.now(),
        times,
      });
    }
    this.activeLocationKey.set(key);
    this.origin.set(MY_LOCATION_ID);
  }

  /** The longest drive time across all outings, used to bound the slider. */
  readonly maxAvailableTime = (() => {
    let max = 0;
    for (const c of DATA.categories) {
      for (const item of c.items) {
        for (const t of Object.values(item.times)) {
          if (t && t > max) max = t;
        }
      }
    }
    return Math.ceil(max / 15) * 15;
  })();

  /** Items of a category that match the current search + max-time filters. */
  private filterItems(
    category: Category,
    query: string,
    max: number | null,
    origin: SelectedOrigin,
    live: Readonly<Record<string, number | null>>,
  ): Outing[] {
    let items = category.items;

    if (query) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          i.notes.toLowerCase().includes(query) ||
          category.name.toLowerCase().includes(query),
      );
    }

    if (max != null) {
      items = items.filter((i) => {
        const t = this.timeFor(i, origin, live);
        return t != null && t <= max;
      });
    }

    return items;
  }

  /**
   * Categories with their items filtered by search / category / max-time and
   * sorted by distance from the selected origin (items with no time go last).
   */
  readonly filtered = computed<Category[]>(() => {
    const origin = this.origin();
    const query = this.search().trim().toLowerCase();
    const active = this.activeCategory();
    const max = this.maxTime();
    const live = this.liveTimes();

    const result: Category[] = [];
    for (const category of DATA.categories) {
      if (active && category.name !== active) continue;

      const items = this.filterItems(category, query, max, origin, live);
      if (!items.length) continue;

      const sorted = [...items].sort((a, b) => {
        const ta = this.timeFor(a, origin, live);
        const tb = this.timeFor(b, origin, live);
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return ta - tb;
      });

      result.push({ name: category.name, items: sorted });
    }
    return result;
  });

  /**
   * Per-category counts honoring search + max-time, but ignoring the active
   * category selection so the chips always show how many places each category
   * has under the current drive-time limit.
   */
  readonly categoryCounts = computed(() => {
    const origin = this.origin();
    const query = this.search().trim().toLowerCase();
    const max = this.maxTime();
    const live = this.liveTimes();
    return DATA.categories.map((category) => ({
      name: category.name,
      count: this.filterItems(category, query, max, origin, live).length,
    }));
  });

  /** Number of outings currently visible after filtering. */
  readonly visibleCount = computed(() => this.filtered().reduce((n, c) => n + c.items.length, 0));
}

/** A friendly default name for a freshly-pinned location. */
function defaultLabel(existingCount: number): string {
  return existingCount === 0 ? 'My location' : `My location ${existingCount + 1}`;
}

function isGeolocationFailure(err: unknown): err is GeolocationFailure {
  return typeof err === 'object' && err != null && 'kind' in err;
}

/** Turn a geolocation or network failure into a message for the UI. */
function describeError(err: unknown): string {
  if (isGeolocationFailure(err)) {
    switch (err.kind) {
      case 'denied':
        return 'Location access was blocked. Enable it in your browser settings, then try again.';
      case 'timeout':
        return 'Finding your location took too long. Please try again.';
      case 'unsupported':
        return 'This browser does not support location.';
      case 'unavailable':
        return 'Your location is unavailable right now.';
    }
  }
  return 'Could not load driving distances. Check your connection and try again.';
}
