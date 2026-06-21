import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { OutingsService } from './outings.service';
import { OutingCard } from './outing-card';
import { MY_LOCATION_ID, OriginId } from './outings.models';
import { SavedLocation } from './location-store';

@Component({
  selector: 'app-root',
  imports: [OutingCard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App {
  protected readonly svc = inject(OutingsService);
  protected readonly ME = MY_LOCATION_ID;

  /** Whether the filters drawer is open. */
  protected readonly filtersOpen = signal(false);

  /** The drive-time slider, so we can format its tooltip/screen-reader value. */
  private readonly timeSlider =
    viewChild<ElementRef<HTMLElement & { valueFormatter?: (value: number) => string }>>(
      'timeSlider',
    );

  constructor() {
    effect(() => {
      const el = this.timeSlider()?.nativeElement;
      if (!el) return;
      void customElements.whenDefined('wa-slider').then(() => {
        el.valueFormatter = (value) =>
          value >= this.svc.maxAvailableTime ? 'Any' : this.formatTime(value);
      });
    });
  }

  /**
   * True while the user is dragging the drive-time slider. On touch devices the
   * drag can end with a synthesized tap on the drawer overlay, which would
   * otherwise light-dismiss the drawer; we use this to block that close.
   */
  private sliderDragging = false;

  /** Category names with live counts (react to the current filters). */
  protected readonly chips = computed(() => this.svc.categoryCounts());

  /** Number of refinements active inside the drawer (category + drive time). */
  protected readonly activeFilterCount = computed(
    () => (this.svc.activeCategory() ? 1 : 0) + (this.svc.maxTime() != null ? 1 : 0),
  );

  protected setOrigin(id: OriginId): void {
    this.svc.origin.set(id);
  }

  protected useMyLocation(): void {
    void this.svc.useMyLocation();
  }

  protected selectLocation(loc: SavedLocation): void {
    this.svc.selectSavedLocation(loc);
  }

  protected removeLocation(event: Event, key: string): void {
    event.stopPropagation();
    this.svc.removeLocation(key);
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

  protected onSliderPointerDown(): void {
    this.sliderDragging = true;
  }

  protected onSliderPointerUp(): void {
    // Defer clearing so a tap synthesized at the end of the drag (which can
    // land on the overlay) is still treated as part of the drag.
    setTimeout(() => (this.sliderDragging = false));
  }

  /** Keep the drawer open if a slider drag tries to dismiss it. */
  protected onDrawerHide(event: Event): void {
    if (this.sliderDragging) event.preventDefault();
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
