import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { OutingsService } from './outings.service';
import { OutingCard } from './outing-card';
import { OriginId } from './outings.models';

@Component({
  selector: 'app-root',
  imports: [OutingCard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App {
  protected readonly svc = inject(OutingsService);

  /** Whether the filters drawer is open. */
  protected readonly filtersOpen = signal(false);

  /** Category names with counts, for the filter chips. */
  protected readonly chips = computed(() =>
    this.svc.categories.map((c) => ({ name: c.name, count: c.items.length })),
  );

  /** Number of refinements active inside the drawer (category + drive time). */
  protected readonly activeFilterCount = computed(
    () => (this.svc.activeCategory() ? 1 : 0) + (this.svc.maxTime() != null ? 1 : 0),
  );

  protected setOrigin(id: OriginId): void {
    this.svc.origin.set(id);
  }

  protected toggleCategory(name: string): void {
    this.svc.activeCategory.update((cur) => (cur === name ? null : name));
  }

  protected onSearch(value: string): void {
    this.svc.search.set(value);
  }

  protected onMaxTime(value: string): void {
    const n = Number(value);
    this.svc.maxTime.set(n >= this.svc.maxAvailableTime ? null : n);
  }

  protected clearFilters(): void {
    this.svc.search.set('');
    this.svc.activeCategory.set(null);
    this.svc.maxTime.set(null);
  }

  protected formatTime(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h} hr`;
  }
}
