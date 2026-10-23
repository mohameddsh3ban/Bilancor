import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatMonthRange } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Term } from '../core/i18n/term';
import { BookingLabel } from '../payments/booking-label';
import { yearSummary } from '../domain/tax-year';
import { DemoStateService } from '../state/demo-state.service';

/**
 * The year tab of the Taxes page: income, costs and profit so far this year (the stored months before the first payment,
 * then the payments, which link to Payments), the costs by category, the income tax to set aside, and the returns that
 * are prepared at the end of the year. It is an overview only. Phone: one column; computer: two.
 */
@Component({
  selector: 'app-year-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, BookingLabel, HlmCardImports, MoneyPipe, RouterLink, Term, TranslocoPipe],
  host: { class: 'grid gap-4 lg:grid-cols-2 lg:items-start' },
  template: `
    <div class="flex min-w-0 flex-col gap-4">
      <section hlmCard size="sm" data-testid="year-so-far">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'taxes.year.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <p class="text-muted-foreground text-xs" data-testid="year-basis">
            {{ (chargesVat() ? 'taxes.year.net' : 'taxes.year.gross') | transloco }}
          </p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-muted-foreground text-xs">
                <th scope="col" class="pb-2 text-start font-normal">
                  <span class="sr-only">{{ 'taxes.year.title' | transloco }}</span>
                </th>
                <th scope="col" class="pb-2 ps-3 text-end font-normal">
                  {{ 'taxes.year.income' | transloco }}
                </th>
                <th scope="col" class="pb-2 ps-3 text-end font-normal">
                  {{ 'taxes.year.costs' | transloco }}
                </th>
              </tr>
            </thead>
            <tbody>
              @if (earlierMonths(); as months) {
                <tr class="border-border border-t" data-testid="year-earlier">
                  <th
                    scope="row"
                    class="py-2 text-start font-normal"
                    data-testid="year-earlier-label"
                  >
                    {{ months }}
                    <span class="text-muted-foreground"
                      >({{ 'taxes.year.earlier' | transloco }})</span
                    >
                  </th>
                  <td class="py-2 ps-3 text-end" data-testid="year-earlier-income">
                    <bdi dir="ltr">{{ summary().openingIncomeCents | money }}</bdi>
                  </td>
                  <td class="py-2 ps-3 text-end" data-testid="year-earlier-costs">
                    <bdi dir="ltr">{{ summary().openingCostsCents | money }}</bdi>
                  </td>
                </tr>
              }
              <tr class="border-border border-t" data-testid="year-since">
                <th scope="row" class="py-2 text-start font-normal" data-testid="year-since-label">
                  {{ 'taxes.year.since' | transloco }}
                  <bdi dir="ltr">{{ summary().paymentsSince | appDate }}</bdi>
                </th>
                <td class="py-2 ps-3 text-end">
                  <a
                    class="text-primary underline-offset-4 hover:underline"
                    routerLink="/payments"
                    data-testid="year-income-link"
                  >
                    <bdi dir="ltr">{{ summary().paymentsIncomeCents | money }}</bdi>
                  </a>
                </td>
                <td class="py-2 ps-3 text-end">
                  <a
                    class="text-primary underline-offset-4 hover:underline"
                    routerLink="/payments"
                    data-testid="year-costs-link"
                  >
                    <bdi dir="ltr">{{ summary().paymentsCostsCents | money }}</bdi>
                  </a>
                </td>
              </tr>
              <tr class="border-border border-t font-semibold" data-testid="year-total">
                <th scope="row" class="py-2 text-start font-semibold">
                  {{ 'taxes.year.total' | transloco }}
                </th>
                <td class="py-2 ps-3 text-end" data-testid="year-total-income">
                  <bdi dir="ltr">{{ summary().incomeCents | money }}</bdi>
                </td>
                <td class="py-2 ps-3 text-end" data-testid="year-total-costs">
                  <bdi dir="ltr">{{ summary().costsCents | money }}</bdi>
                </td>
              </tr>
              <tr class="border-border border-t font-semibold">
                <th scope="row" class="py-2 text-start font-semibold">
                  {{ 'taxes.year.profit' | transloco }}
                </th>
                <td colspan="2" class="py-2 ps-3 text-end" data-testid="year-profit">
                  <bdi dir="ltr">{{ summary().profitCents | money }}</bdi>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section hlmCard size="sm" data-testid="year-categories">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'taxes.year.categories' | transloco }}</h2>
        </header>
        <ul hlmCardContent class="flex flex-col">
          @for (category of summary().byCategory; track category.labelKey) {
            <li
              class="border-border flex items-baseline justify-between gap-3 border-t py-2 text-sm first:border-t-0 first:pt-0 last:pb-0"
              data-testid="year-category"
            >
              <span class="min-w-0" data-testid="year-category-name">
                <app-booking-label [booking]="category" />
              </span>
              <bdi dir="ltr" class="shrink-0 font-medium" data-testid="year-category-amount">{{
                category.cents | money
              }}</bdi>
            </li>
          }
        </ul>
      </section>
    </div>

    <div class="flex min-w-0 flex-col gap-4">
      <section hlmCard size="sm" data-testid="year-income-tax">
        <div hlmCardContent class="flex items-baseline justify-between gap-3 text-sm">
          <span>{{ 'taxes.year.incomeTax' | transloco }}</span>
          <bdi dir="ltr" class="font-medium" data-testid="year-income-tax-amount">{{
            business().incomeTaxReserveCents | money
          }}</bdi>
        </div>
      </section>

      <section hlmCard size="sm" data-testid="year-returns">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'taxes.year.returns' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <ul class="flex flex-col">
            @for (name of summary().returns; track name) {
              <li
                class="border-border flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t py-2 text-sm first:border-t-0 first:pt-0 last:pb-0"
                data-testid="year-return"
                [attr.data-return]="name"
              >
                <span class="font-medium"><app-term [key]="name" /></span>
                <span class="text-muted-foreground text-xs" data-testid="year-return-due">
                  {{ 'taxes.year.due' | transloco }}
                  <bdi dir="ltr">{{ summary().dueDate | appDate: { year: true } }}</bdi>
                </span>
              </li>
            }
          </ul>
          <p class="text-muted-foreground text-xs" data-testid="year-prepared">
            {{ 'taxes.year.prepared' | transloco }}
          </p>
        </div>
      </section>
    </div>
  `,
})
export class YearTab {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly business = this.demo.business;
  protected readonly summary = computed(() => yearSummary(this.business()));
  /** A business that charges VAT shows net amounts; a Kleinunternehmer shows what was paid. */
  protected readonly chargesVat = computed(() => !this.business().taxProfile.kleinunternehmer);

  /**
   * The months before the business's first payment of the year, named ("January–July"): the stored opening line covers
   * them. Null when the first payment is in January, as there are no earlier months then.
   */
  protected readonly earlierMonths = computed(() => {
    const since = this.summary().paymentsSince;
    const month = Number(since.slice(5, 7));
    if (month <= 1) return null;
    const year = since.slice(0, 4);
    const last = `${year}-${String(month - 1).padStart(2, '0')}`;
    return formatMonthRange(`${year}-01`, last, this.language.lang());
  });
}
