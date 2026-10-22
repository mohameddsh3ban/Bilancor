import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppMonthPipe } from '../core/format/month.pipe';
import { Account, Transaction } from '../data/models';
import { setupSteps } from '../domain/home-cards';
import { EMPTY_FILTER, MonthGroup, filterPayments, groupByMonth } from '../domain/payment-filters';
import { paymentStatus } from '../domain/payment-status';
import { BookingLabel } from '../payments/booking-label';
import { PaymentStatusChip } from '../payments/payment-status-chip';
import { DemoStateService } from '../state/demo-state.service';
import { printOnceRendered } from './print-once';

/**
 * One month of the open business's payments (all of them, or those of one account) as a clean table for the
 * browser's print dialog, with the month's totals. The month and account come from the address
 * (`?month=2026-10&account=...`); the quick filter and the search of the list never apply, so a printout is
 * always the whole month. It sits outside the app shell and opens the print dialog once after it first
 * renders. A month with no payments says so and does not print.
 */
@Component({
  selector: 'app-month-print-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    AppMonthPipe,
    BookingLabel,
    MoneyPipe,
    NgIcon,
    PaymentStatusChip,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-8 print:p-0' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium print:hidden"
      data-testid="print-back"
      routerLink="/payments"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'print.back' | transloco }}
    </a>

    @if (group(); as month) {
      <article class="flex flex-col gap-4" data-testid="print-article">
        <header class="border-border flex flex-col gap-1 border-b pb-4">
          <p class="text-muted-foreground text-sm font-medium" data-testid="print-business">
            <bdi>{{ business().name }}</bdi>
          </p>
          <h1 class="text-2xl font-semibold">{{ 'payments.title' | transloco }}</h1>
          <p class="text-lg font-medium" data-testid="print-month">{{ month.month | appMonth }}</p>
          @if (account(); as shown) {
            <p class="text-muted-foreground text-sm" data-testid="print-account-filter">
              {{
                'print.account'
                  | transloco
                    : { name: shown.kind === 'cash' ? ('account.cash' | transloco) : shown.name }
              }}
            </p>
          }
        </header>

        <table class="w-full text-xs sm:text-sm" data-testid="print-table">
          <thead>
            <tr class="text-muted-foreground border-border border-b text-xs">
              <th scope="col" class="py-2 pe-2 sm:pe-3 text-start font-medium">
                {{ 'home.transactions.col.date' | transloco }}
              </th>
              <th scope="col" class="py-2 pe-2 sm:pe-3 text-start font-medium">
                {{ 'home.transactions.col.counterparty' | transloco }}
              </th>
              <th scope="col" class="py-2 pe-2 sm:pe-3 text-start font-medium max-sm:hidden">
                {{ 'home.transactions.col.account' | transloco }}
              </th>
              <th scope="col" class="py-2 pe-2 sm:pe-3 text-start font-medium max-sm:hidden">
                {{ 'home.transactions.col.booking' | transloco }}
              </th>
              <th scope="col" class="py-2 pe-2 sm:pe-3 text-start font-medium">
                {{ 'home.transactions.col.status' | transloco }}
              </th>
              <th scope="col" class="py-2 text-end font-medium">
                {{ 'home.transactions.col.amount' | transloco }}
              </th>
            </tr>
          </thead>
          <tbody>
            @for (tx of month.payments; track tx.id) {
              @let paymentAccount = accountOf(tx);
              <tr
                class="border-border border-b align-top break-inside-avoid"
                data-testid="print-row"
              >
                <td class="py-2 pe-2 sm:pe-3 whitespace-nowrap" data-testid="print-date">
                  {{ tx.date | appDate }}
                </td>
                <td class="py-2 pe-2 sm:pe-3 font-medium wrap-break-word">
                  <span dir="auto" data-testid="print-counterparty">{{ tx.counterparty }}</span>
                </td>
                <td class="py-2 pe-2 sm:pe-3 max-sm:hidden" data-testid="print-account">
                  {{
                    paymentAccount?.kind === 'cash'
                      ? ('account.cash' | transloco)
                      : paymentAccount?.name
                  }}
                </td>
                <td
                  class="py-2 pe-2 sm:pe-3 wrap-break-word max-sm:hidden"
                  data-testid="print-booking"
                >
                  @if (tx.booking; as booking) {
                    <app-booking-label [booking]="booking" />
                  } @else {
                    —
                  }
                </td>
                <td class="py-2 pe-2 sm:pe-3"><app-payment-status-chip [status]="status(tx)" /></td>
                <td class="py-2 text-end whitespace-nowrap">
                  <bdi dir="ltr" class="font-medium">
                    <span
                      data-testid="print-amount"
                      [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'"
                    >
                      {{ tx.amountCents | money: { signed: true } }}
                    </span>
                  </bdi>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <dl
          class="border-border flex flex-col gap-1 self-end border-t pt-3 text-sm break-inside-avoid"
          data-testid="print-totals"
        >
          <div class="flex justify-between gap-8">
            <dt class="text-muted-foreground">{{ 'payments.monthIn' | transloco }}</dt>
            <dd>
              <bdi dir="ltr" class="text-positive font-medium">
                <span data-testid="print-total-in">{{
                  month.inCents | money: { signed: true }
                }}</span>
              </bdi>
            </dd>
          </div>
          <div class="flex justify-between gap-8">
            <dt class="text-muted-foreground">{{ 'payments.monthOut' | transloco }}</dt>
            <dd>
              <bdi dir="ltr" class="text-negative font-medium">
                <span data-testid="print-total-out">{{
                  month.outCents | money: { signed: true }
                }}</span>
              </bdi>
            </dd>
          </div>
        </dl>
      </article>
    } @else {
      <p class="text-muted-foreground" role="status" data-testid="print-nothing">
        {{ 'print.nothing' | transloco }}
      </p>
    }
  `,
})
export class MonthPrintPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly monthParam = computed(() => this.query().get('month'));
  private readonly accountId = computed(() => this.query().get('account'));

  protected readonly business = this.demo.business;
  private readonly accounts = computed(() => this.business().accounts);

  /** The account the printout is limited to (an unknown account id has no payments, so nothing is printed). */
  protected readonly account = computed<Account | undefined>(() =>
    this.accounts().find((account) => account.id === this.accountId()),
  );

  /** The month's payments, newest first, with its totals; none without a month, payments or a connected bank. */
  protected readonly group = computed<MonthGroup | null>(() => {
    const month = this.monthParam();
    if (!month || !setupSteps(this.demo.setup()).bank) return null;
    const payments = filterPayments(this.business().transactions, {
      ...EMPTY_FILTER,
      month,
      accountId: this.accountId(),
    });
    return groupByMonth(payments)[0] ?? null;
  });

  protected readonly status = paymentStatus;

  constructor() {
    printOnceRendered(() => this.group() !== null);
  }

  protected accountOf(tx: Transaction): Account | undefined {
    return this.accounts().find((account) => account.id === tx.accountId);
  }
}
