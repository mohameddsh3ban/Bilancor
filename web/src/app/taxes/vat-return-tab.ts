import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppTaxPeriodPipe } from '../core/format/tax-period.pipe';
import { pluralKey } from '../core/i18n/plural-key';
import { Term } from '../core/i18n/term';
import { yearSummary } from '../domain/tax-year';
import {
  DUE_SOON_DAYS,
  currentVatReturn,
  daysLeftWording,
  resultWording,
  sentPeriod,
  type VatReturnView,
} from '../domain/vat-return';
import { DemoStateService } from '../state/demo-state.service';
import { SendCard } from './send-card';

/** Stands where the amount goes in a translated sentence, so the amount can sit in a left-to-right element of its own. */
const AMOUNT_MARK = '\u0001';

/**
 * The VAT return tab of the Taxes page: the deadline, what the return comes to and how it adds up, what still needs
 * the person, the way to send it, and the returns sent earlier. A business that files its VAT once a year shows that
 * instead of a return with a date. Phone: one column in that order; computer: the first three and the last three side by side.
 */
@Component({
  selector: 'app-vat-return-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    AppTaxPeriodPipe,
    HlmButton,
    HlmCardImports,
    MoneyPipe,
    RouterLink,
    SendCard,
    Term,
    TranslocoPipe,
  ],
  host: { class: 'grid gap-4 lg:grid-cols-2 lg:items-start' },
  template: `
    <div class="flex min-w-0 flex-col gap-4">
      @if (view(); as view) {
        @let result = wording();
        <p
          class="rounded-xl border px-4 py-3 text-sm font-medium"
          data-testid="vat-deadline"
          [class]="stripClass(view)"
        >
          {{ view.period | appTaxPeriod }}
          @if (view.state === 'inProgress') {
            · {{ 'taxes.deadline.inProgress' | transloco }}
          }
          @if (view.state === 'overdue') {
            · {{ 'taxes.deadline.overdue' | transloco }}
            <bdi dir="ltr">{{ view.dueDate | appDate }}</bdi>
          } @else {
            · {{ 'taxes.deadline.due' | transloco }}
            <bdi dir="ltr">{{ view.dueDate | appDate }}</bdi>
            ({{
              'taxReminder.' + daysLeftWording(view.daysLeft) | transloco: { days: view.daysLeft }
            }})
          }
        </p>

        <section hlmCard size="sm" data-testid="vat-result">
          <div hlmCardContent class="flex flex-col gap-1">
            @if (view.amountKnown) {
              @let sentence = (result.sentenceKey | transloco: { amount: mark }).split(mark);
              <p class="text-2xl font-semibold" data-testid="vat-result-line">
                {{ sentence[0] }}<bdi dir="ltr">{{ result.cents | money }}</bdi
                >{{ sentence[1] }}
              </p>
              <p class="text-muted-foreground text-sm" data-testid="vat-result-to">
                {{
                  (result.kind === 'refund' ? 'taxes.result.fromOffice' : 'taxes.result.toOffice')
                    | transloco
                }}
              </p>
            } @else {
              <p class="text-lg font-semibold">{{ 'taxes.result.unknown' | transloco }}</p>
            }
          </div>
        </section>

        <section hlmCard size="sm" data-testid="vat-how">
          <header hlmCardHeader>
            <h2 hlmCardTitle>{{ 'taxes.how.title' | transloco }}</h2>
          </header>
          <div hlmCardContent class="flex flex-col gap-3">
            @if (view.amountKnown) {
              <div class="flex items-start justify-between gap-3" data-testid="vat-charged">
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="font-medium"><app-term key="umsatzsteuer" /></span>
                  <span class="text-muted-foreground text-xs" data-testid="vat-charged-detail">
                    {{
                      plural('taxes.how.sales', view.salesCount)
                        | transloco: { count: view.salesCount }
                    }}
                    · <bdi dir="ltr">{{ view.salesNetCents | money }}</bdi>
                    {{ 'taxes.how.net' | transloco }}
                  </span>
                </div>
                <bdi dir="ltr" class="font-medium" data-testid="vat-charged-amount">{{
                  view.chargedCents | money
                }}</bdi>
              </div>
              <div class="flex items-start justify-between gap-3" data-testid="vat-paid">
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="font-medium"><app-term key="vorsteuer" /></span>
                  <span class="text-muted-foreground text-xs" data-testid="vat-paid-detail">
                    {{
                      plural('taxes.how.purchases', view.purchasesCount)
                        | transloco: { count: view.purchasesCount }
                    }}
                  </span>
                </div>
                <bdi dir="ltr" class="font-medium" data-testid="vat-paid-amount">{{
                  view.paidCents | money
                }}</bdi>
              </div>
              <div
                class="border-border flex items-baseline justify-between gap-3 border-t pt-3 font-semibold"
                data-testid="vat-total"
              >
                <span data-testid="vat-total-label">{{
                  'taxes.how.' + result.kind | transloco
                }}</span>
                <bdi dir="ltr" data-testid="vat-total-amount">{{ result.cents | money }}</bdi>
              </div>
            } @else {
              <p class="text-muted-foreground">{{ 'taxes.how.none' | transloco }}</p>
            }
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p class="text-muted-foreground text-xs">{{ 'taxes.how.basis' | transloco }}</p>
              <a
                hlmBtn
                variant="outline"
                size="sm"
                data-testid="vat-see-payments"
                [routerLink]="['/payments']"
                [queryParams]="{ month: view.period.start.slice(0, 7) }"
              >
                {{ 'taxes.how.payments' | transloco }}
              </a>
            </div>
          </div>
        </section>
      } @else if (yearly()) {
        <section hlmCard size="sm" data-testid="vat-yearly">
          <div hlmCardContent>
            <p class="font-medium">
              {{ 'home.tax.yearlyOnly' | transloco }} · {{ 'taxes.deadline.due' | transloco }}
              <bdi dir="ltr">{{ yearlyDue() | appDate: { year: true } }}</bdi>
            </p>
          </div>
        </section>
      }
    </div>

    <div class="flex min-w-0 flex-col gap-4">
      @if (view(); as view) {
        @if (view.needsYouCount > 0) {
          <section hlmCard size="sm" data-testid="vat-needs">
            <div hlmCardContent class="flex items-center justify-between gap-3">
              <p class="min-w-0 text-sm font-medium">
                {{
                  plural('taxes.needs', view.needsYouCount)
                    | transloco: { count: view.needsYouCount }
                }}
              </p>
              <a
                hlmBtn
                size="sm"
                class="shrink-0"
                routerLink="/review"
                data-testid="vat-needs-start"
              >
                {{ 'taxes.needs.start' | transloco }}
              </a>
            </div>
          </section>
        }

        <app-send-card [view]="view" />
      }

      @if (sent().length > 0) {
        <section hlmCard size="sm" data-testid="vat-sent">
          <header hlmCardHeader>
            <h2 hlmCardTitle>{{ 'taxes.sent.title' | transloco }}</h2>
          </header>
          <ul hlmCardContent class="flex flex-col">
            @for (item of sent(); track item.periodStart) {
              <li
                class="border-border flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                data-testid="vat-sent-row"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span class="font-medium" data-testid="vat-sent-period">{{
                      item.period | appTaxPeriod
                    }}</span>
                    <span class="text-muted-foreground text-xs" data-testid="vat-sent-on">
                      {{ 'taxes.sent.on' | transloco }}
                      <bdi dir="ltr">{{ item.sentOn | appDate }}</bdi>
                    </span>
                  </div>
                  <div class="shrink-0 text-end">
                    <p>
                      <bdi dir="ltr" class="font-medium" data-testid="vat-sent-amount">{{
                        item.result.cents | money
                      }}</bdi>
                    </p>
                    <p class="text-muted-foreground text-xs" data-testid="vat-sent-kind">
                      {{ 'taxes.sent.' + item.result.key | transloco }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span
                    class="bg-positive/10 text-positive rounded-full px-2 py-0.5 text-xs font-medium"
                    data-testid="vat-sent-chip"
                  >
                    {{ 'taxes.sent.chip' | transloco }}
                  </span>
                  <a
                    class="text-primary text-sm font-medium underline-offset-4 hover:underline"
                    data-testid="vat-receipt"
                    [routerLink]="['/print/vat-return', item.periodStart]"
                    [attr.aria-label]="
                      'taxes.sent.receiptFor' | transloco: { period: (item.period | appTaxPeriod) }
                    "
                  >
                    {{ 'taxes.sent.receipt' | transloco }}
                  </a>
                </div>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
})
export class VatReturnTab {
  private readonly demo = inject(DemoStateService);

  protected readonly mark = AMOUNT_MARK;
  protected readonly daysLeftWording = daysLeftWording;

  private readonly current = computed(() => currentVatReturn(this.demo.business()));
  /** The return to send, with its date and figures; null for a yearly return or when there is none. */
  protected readonly view = computed(() => {
    const current = this.current();
    return current?.kind === 'return' ? current.view : null;
  });
  protected readonly yearly = computed(() => this.current()?.kind === 'yearly');
  /** The day the yearly VAT return is due. */
  protected readonly yearlyDue = computed(() => yearSummary(this.demo.business()).dueDate);

  /** What the open return comes to: to pay or a refund, with its amount, and the translation key of the sentence that says it. */
  protected readonly wording = computed(() => {
    const view = this.view();
    const { key, cents } = resultWording(view ?? { resultCents: 0 });
    return {
      kind: key,
      cents,
      // "You pay …", "So far you pay …" while the period is still running, and the same for a refund.
      sentenceKey: `taxes.result.${key}${view?.state === 'inProgress' ? 'SoFar' : ''}`,
    };
  });

  /** The returns sent so far, newest first. */
  protected readonly sent = computed(() =>
    [...this.demo.business().vatReturns]
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((sent) => ({
        periodStart: sent.periodStart,
        period: sentPeriod(sent),
        sentOn: sent.sentOn,
        result: resultWording(sent),
      })),
  );

  /** The deadline's colour: red once late, the warning colour when it is due soon, plain otherwise. */
  protected stripClass(view: VatReturnView): string {
    if (view.state === 'overdue') return 'border-negative/30 bg-negative/10 text-negative';
    return view.daysLeft <= DUE_SOON_DAYS
      ? 'border-warning/30 bg-warning/10 text-warning'
      : 'border-border bg-card text-card-foreground';
  }

  protected readonly plural = pluralKey;
}
