import { Injectable, signal } from '@angular/core';
import { Coordinates } from './outings.models';

/**
 * A user origin we've resolved before: its rounded grid key, a label, the raw
 * coordinates, and the per-outing drive times (minutes, keyed by outing name).
 * Because driving time between two fixed points is effectively immutable, the
 * embedded `times` double as a permanent cache — same key never refetches.
 */
export interface SavedLocation {
  readonly key: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly savedAt: number;
  readonly times: Readonly<Record<string, number | null>>;
}

const STORAGE_KEY = 'nepa-outings.locations.v1';
/** How many recent locations to keep (also the cache size). */
const MAX = 6;
/** Round to ~110m so GPS jitter maps to the same cache key. */
const PRECISION = 3;

@Injectable({ providedIn: 'root' })
export class LocationStore {
  private readonly _recent = signal<SavedLocation[]>(this.load());
  /** Most-recent-first list of resolved locations. */
  readonly recent = this._recent.asReadonly();

  /** Stable cache key for a coordinate (rounded to a coarse grid). */
  static keyFor(c: Coordinates): string {
    return `${c.lat.toFixed(PRECISION)},${c.lng.toFixed(PRECISION)}`;
  }

  /** A previously-resolved location for this coordinate, if any. */
  get(key: string): SavedLocation | undefined {
    return this._recent().find((l) => l.key === key);
  }

  /** Insert or refresh a location, moving it to the front and capping the list. */
  save(loc: SavedLocation): void {
    this.commit([loc, ...this._recent().filter((l) => l.key !== loc.key)].slice(0, MAX));
  }

  rename(key: string, label: string): void {
    this.commit(this._recent().map((l) => (l.key === key ? { ...l, label } : l)));
  }

  remove(key: string): void {
    this.commit(this._recent().filter((l) => l.key !== key));
  }

  /** Update the in-memory list and write it through to localStorage. */
  private commit(list: SavedLocation[]): void {
    this._recent.set(list);
    this.persist(list);
  }

  private load(): SavedLocation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SavedLocation[]) : [];
    } catch {
      return [];
    }
  }

  private persist(list: SavedLocation[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Private mode / quota — caching is best-effort, ignore.
    }
  }
}
