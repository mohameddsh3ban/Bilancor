import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The price on the pages that make an account or a business: one price with everything included. The amount is a
 * placeholder ("€ — a month") until the price is decided. `perBusiness` adds that every business has its own plan, for
 * Add a business (a first account is for the one business made with it).
 */
@Component({
  selector: 'app-price-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section
      class="border-primary bg-primary/5 flex flex-col gap-0.5 rounded-lg border p-3"
      data-testid="price-box"
    >
      <p class="text-sm font-semibold" data-testid="price-title">
        {{ 'auth.signUp.price.title' | transloco }}
      </p>
      <p class="text-lg font-semibold" data-testid="price-amount">
        {{ 'auth.signUp.price.amount' | transloco }}
      </p>
      <p class="text-muted-foreground text-sm" data-testid="price-trial">
        {{ 'auth.signUp.price.trial' | transloco }}
      </p>
      @if (perBusiness()) {
        <p class="text-muted-foreground text-sm" data-testid="price-per-business">
          {{ 'auth.signUp.price.perBusiness' | transloco }}
        </p>
      }
    </section>
  `,
})
export class PriceBox {
  /** Adds that each business has its own plan. */
  readonly perBusiness = input(false);
}
