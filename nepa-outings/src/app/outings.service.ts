import { Injectable, computed, signal } from '@angular/core';
import data from './outings.json';
import { Category, OriginId, OutingsData } from './outings.models';

const DATA = data as OutingsData;

@Injectable({ providedIn: 'root' })
export class OutingsService {
  readonly origins = DATA.origins;
  readonly categories = DATA.categories;

  /** Total number of outings, for display. */
  readonly totalCount = DATA.categories.reduce((n, c) => n + c.items.length, 0);

  // --- User-controlled state ---
  readonly origin = signal<OriginId>('kingston');
  readonly search = signal('');
  readonly activeCategory = signal<string | null>(null);
  /** Max one-way drive time in minutes; null = no limit. */
  readonly maxTime = signal<number | null>(null);

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

  /**
   * Categories with their items filtered by search / category / max-time and
   * sorted by distance from the selected origin (items with no time go last).
   */
  readonly filtered = computed<Category[]>(() => {
    const origin = this.origin();
    const query = this.search().trim().toLowerCase();
    const active = this.activeCategory();
    const max = this.maxTime();

    const result: Category[] = [];
    for (const category of DATA.categories) {
      if (active && category.name !== active) continue;

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
          const t = i.times[origin];
          return t != null && t <= max;
        });
      }

      if (!items.length) continue;

      const sorted = [...items].sort((a, b) => {
        const ta = a.times[origin];
        const tb = b.times[origin];
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return ta - tb;
      });

      result.push({ name: category.name, items: sorted });
    }
    return result;
  });

  /** Number of outings currently visible after filtering. */
  readonly visibleCount = computed(() =>
    this.filtered().reduce((n, c) => n + c.items.length, 0),
  );
}
