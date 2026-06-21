import { Component, computed, input, signal } from '@angular/core';
import { Origin, OriginId, Outing } from './outings.models';

@Component({
  selector: 'app-outing-card',
  template: `
    <article class="card">
      <header class="card__head">
        <h3 class="card__name">{{ outing().name }}</h3>
        <span class="card__primary" [class.card__primary--none]="primaryTime() == null">
          {{ format(primaryTime()) }}
        </span>
      </header>

      <ul class="times" aria-label="Drive times from each home base">
        @for (o of origins(); track o.id) {
          <li class="times__item" [class.times__item--active]="o.id === origin()">
            <span class="times__label">{{ o.label }}</span>
            <span class="times__val">{{ format(outing().times[o.id]) }}</span>
          </li>
        }
      </ul>

      @if (outing().notes) {
        <p class="notes" [class.notes--clamped]="!expanded() && long()">
          {{ outing().notes }}
        </p>
        @if (long()) {
          <button type="button" class="link-btn" (click)="expanded.set(!expanded())">
            {{ expanded() ? 'Show less' : 'Show more' }}
          </button>
        }
      }

      <footer class="card__actions">
        <a class="btn btn--map" [href]="outing().map" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
            />
          </svg>
          Map
        </a>
        @if (outing().website) {
          <a class="btn btn--ghost" [href]="outing().website" target="_blank" rel="noopener">
            Website
          </a>
        }
      </footer>
    </article>
  `,
  styleUrl: './outing-card.scss',
})
export class OutingCard {
  readonly outing = input.required<Outing>();
  readonly origin = input.required<OriginId>();
  readonly origins = input.required<Origin[]>();

  readonly expanded = signal(false);

  readonly primaryTime = computed(() => this.outing().times[this.origin()]);
  readonly long = computed(() => this.outing().notes.length > 120);

  format(min: number | null): string {
    if (min == null) return '—';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
}
