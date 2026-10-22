import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideSearch } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { LanguageService } from '../core/i18n/language.service';
import { Booking } from '../data/models';
import { categoriesFor } from '../domain/tax-rules';
import { DemoStateService } from '../state/demo-state.service';
import { BookingLabel } from './booking-label';

/** The categories whose label, SKR03 number or German name contains the typed text (any case, outer spaces ignored). */
export function matchCategories(
  categories: readonly Booking[],
  query: string,
  labelOf: (booking: Booking) => string,
): Booking[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return [...categories];
  return categories.filter((category) =>
    [labelOf(category), category.skr03, category.nameDe].some((text) =>
      text.toLocaleLowerCase().includes(needle),
    ),
  );
}

/**
 * A "Change" button that opens a searchable list of the categories a person can book a payment to (the open
 * business's own: its tax status decides which revenue account it is offered).
 * Choosing one emits it and closes the list, the current category too, so the page decides what that means.
 * The list is a popover that is nearly as wide as the screen on a phone.
 */
@Component({
  selector: 'app-category-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookingLabel, HlmButton, HlmPopoverImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck, lucideSearch })],
  host: { class: 'inline-block' },
  template: `
    <hlm-popover align="start" (stateChanged)="onState($event)">
      <button hlmPopoverTrigger hlmBtn variant="outline" size="lg" data-testid="change-category">
        {{
          labelKey() ??
            (current() ? 'payments.detail.booking.change' : 'payments.detail.booking.choose')
            | transloco
        }}
      </button>
      <ng-template hlmPopoverPortal let-popover>
        <!-- On a phone the list starts where the button does (inside the page and card padding), so it is 4.5rem narrower than the screen. -->
        <hlm-popover-content class="w-[min(24rem,calc(100vw-4.5rem))] gap-2 p-2">
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              size="16"
              class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              class="border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-md border ps-9 pe-3 text-sm"
              data-testid="category-search"
              [value]="query()"
              [attr.aria-label]="'payments.detail.picker.search' | transloco"
              [placeholder]="'payments.detail.picker.placeholder' | transloco"
              (input)="setQuery($event)"
            />
          </div>
          <ul class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            @for (category of matches(); track category.skr03) {
              <li>
                <button
                  type="button"
                  class="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm outline-none"
                  data-testid="category-option"
                  [class.bg-muted]="isCurrent(category)"
                  [attr.aria-current]="isCurrent(category) ? 'true' : null"
                  (click)="choose(category, popover)"
                >
                  <span class="min-w-0 flex-1">
                    <app-booking-label [booking]="category" />
                  </span>
                  @if (isCurrent(category)) {
                    <ng-icon
                      name="lucideCheck"
                      size="16"
                      class="text-primary shrink-0"
                      aria-hidden="true"
                    />
                  }
                </button>
              </li>
            } @empty {
              <li class="text-muted-foreground px-2 py-3 text-sm" data-testid="category-empty">
                {{ 'payments.detail.picker.empty' | transloco }}
              </li>
            }
          </ul>
        </hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class CategoryPicker {
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly demo = inject(DemoStateService);

  /** The category the payment is booked to now, if any. */
  readonly current = input<Booking | null>(null);
  /** The translation key of the button's text, when it should not say Change (or Choose while there is no category). */
  readonly labelKey = input<string | null>(null);
  readonly picked = output<Booking>();

  protected readonly query = signal('');
  protected readonly matches = computed(() => {
    this.language.lang(); // the labels change with the language
    return matchCategories(
      categoriesFor(this.demo.business().taxProfile),
      this.query(),
      (category) => this.transloco.translate(`booking.${category.labelKey}`),
    );
  });

  protected isCurrent(category: Booking): boolean {
    return category.skr03 === this.current()?.skr03;
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onState(state: 'open' | 'closed'): void {
    if (state === 'closed') this.query.set('');
  }

  protected choose(category: Booking, popover: { close: () => void }): void {
    popover.close();
    this.picked.emit(category);
  }
}
