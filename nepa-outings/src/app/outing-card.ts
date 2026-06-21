import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, input, signal } from '@angular/core';
import { MY_LOCATION_ID, Origin, Outing, SelectedOrigin } from './outings.models';

@Component({
  selector: 'app-outing-card',
  template: `
    <wa-card class="card">
      <div slot="header" class="card__head">
        <h3 class="card__name">{{ outing().name }}</h3>
        <wa-badge
          class="card__primary"
          appearance="filled"
          [attr.variant]="primaryTime() == null ? 'neutral' : 'brand'"
        >
          {{ format(primaryTime()) }}
        </wa-badge>
      </div>

      <ul class="times" aria-label="Drive times from each home base">
        @if (myLocationLabel(); as label) {
          <li class="times__item" [class.times__item--active]="origin() === ME">
            <span class="times__label">{{ label }}</span>
            <span class="times__val">{{ format(liveTime()) }}</span>
          </li>
        }
        @if (origin() === ME) {
          <li class="times__item times__summary">
            @for (o of origins(); track o.id) {
              <span class="times__summary-row">
                <span class="times__summary-label">{{ o.label }}</span>
                <span class="times__summary-val">{{ format(outing().times[o.id]) }}</span>
              </span>
            }
          </li>
        } @else {
          @for (o of origins(); track o.id) {
            <li class="times__item" [class.times__item--active]="o.id === origin()">
              <span class="times__label">{{ o.label }}</span>
              <span class="times__val">{{ format(outing().times[o.id]) }}</span>
            </li>
          }
        }
      </ul>

      @if (outing().address; as address) {
        <div class="address">
          <span class="address__text" [title]="address">{{ address }}</span>
          <wa-copy-button
            class="address__copy"
            [value]="address"
            copy-label="Copy address"
            success-label="Copied!"
          ></wa-copy-button>
        </div>
      }

      @if (outing().notes) {
        <p class="notes" [class.notes--clamped]="!expanded() && long()">
          {{ outing().notes }}
        </p>
        @if (long()) {
          <wa-button
            class="notes__toggle"
            appearance="plain"
            size="small"
            (click)="expanded.set(!expanded())"
          >
            {{ expanded() ? 'Show less' : 'Show more' }}
          </wa-button>
        }
      }

      <div slot="footer" class="card__actions">
        <wa-button
          variant="brand"
          size="small"
          [href]="outing().map"
          target="_blank"
          rel="noopener"
        >
          <wa-icon slot="start" name="location-dot"></wa-icon>
          Map
        </wa-button>
        @if (outing().website) {
          <wa-button
            appearance="outlined"
            size="small"
            [href]="outing().website"
            target="_blank"
            rel="noopener"
          >
            <wa-icon slot="start" name="arrow-up-right-from-square"></wa-icon>
            Website
          </wa-button>
        }
      </div>
    </wa-card>
  `,
  styleUrl: './outing-card.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class OutingCard {
  protected readonly ME = MY_LOCATION_ID;

  readonly outing = input.required<Outing>();
  readonly origin = input.required<SelectedOrigin>();
  readonly origins = input.required<Origin[]>();
  /** Drive time (minutes) from the user's active location, or null. */
  readonly liveTime = input<number | null>(null);
  /** Label for the user-location row; null hides the row. */
  readonly myLocationLabel = input<string | null>(null);

  readonly expanded = signal(false);

  readonly primaryTime = computed(() => {
    const origin = this.origin();
    return origin === MY_LOCATION_ID ? this.liveTime() : this.outing().times[origin];
  });
  readonly long = computed(() => this.outing().notes.length > 120);

  format(min: number | null): string {
    if (min == null) return '—';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
}
