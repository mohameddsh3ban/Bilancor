import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppMonthPipe } from '../core/format/month.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Account } from '../data/models';
import { accountName } from '../domain/bank-connection';
import { isClosedDate } from '../domain/months';
import { MonthGroup } from '../domain/payment-filters';
import { paymentStatus } from '../domain/payment-status';
import { DemoStateService } from '../state/demo-state.service';
import { BookingLabel, showsBookingLabel, skr03Text } from './booking-label';
import { PaymentStatusChip } from './payment-status-chip';

/**
 * Computer layout of the payments: one table, a header row per month with its in/out totals; the header of a closed
 * month says Closed.
 * The whole row opens the payment (stretched link on the counterparty).
 * Shown from `lg`, or from `2xl` while a payment is open beside the table.
 */
@Component({
  selector: 'app-payment-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    AppMonthPipe,
    BookingLabel,
    MoneyPipe,
    PaymentStatusChip,
    RouterLink,
    TranslocoPipe,
  ],
  host: { class: 'block' },
  template: `
    <div
      class="bg-card border-border overflow-hidden rounded-xl border"
      [class]="panelOpen() ? 'hidden 2xl:block' : 'hidden lg:block'"
    >
      <table class="w-full table-fixed text-sm" data-testid="payment-table">
        <colgroup>
          <col class="w-24" />
          <col />
          <col class="w-24" />
          <col />
          <col class="w-36" />
          <col class="w-28" />
        </colgroup>
        <thead>
          <tr class="text-muted-foreground border-border border-b text-xs">
            <th scope="col" class="py-2 ps-4 pe-3 text-start font-medium">
              {{ 'home.transactions.col.date' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'home.transactions.col.counterparty' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'home.transactions.col.account' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'home.transactions.col.booking' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'home.transactions.col.status' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-4 text-end font-medium">
              {{ 'home.transactions.col.amount' | transloco }}
            </th>
          </tr>
        </thead>
        @for (group of groups(); track group.month) {
          <tbody data-testid="table-month-group">
            <tr class="bg-muted/50">
              <th scope="colgroup" colspan="6" class="px-4 py-2 text-start">
                <span class="flex items-baseline justify-between gap-3">
                  <span class="flex items-baseline gap-2">
                    <span class="font-semibold" data-testid="table-month-title">{{
                      group.month | appMonth
                    }}</span>
                    @if (closedMonths().has(group.month)) {
                      <span
                        class="bg-positive/10 text-positive rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                        data-testid="table-month-closed"
                        >{{ 'payments.closed' | transloco }}</span
                      >
                    }
                  </span>
                  <span class="text-muted-foreground flex shrink-0 gap-3 text-xs font-normal">
                    <span>
                      {{ 'payments.monthIn' | transloco }}
                      <bdi dir="ltr" class="text-positive font-medium">{{
                        group.inCents | money: { signed: true }
                      }}</bdi>
                    </span>
                    <span>
                      {{ 'payments.monthOut' | transloco }}
                      <bdi dir="ltr" class="text-negative font-medium">{{
                        group.outCents | money: { signed: true }
                      }}</bdi>
                    </span>
                  </span>
                </span>
              </th>
            </tr>
            @for (tx of group.payments; track tx.id) {
              @let booking = tx.booking;
              @let bookingText =
                booking
                  ? showLabel()
                    ? ('booking.' + booking.labelKey | transloco) + ' · ' + skr03(booking)
                    : skr03(booking)
                  : '';
              @let account = accountOf(tx.accountId);
              <tr
                class="border-border hover:bg-muted relative border-t"
                data-testid="payment-table-row"
                [class.bg-muted]="tx.id === selectedId()"
                [attr.aria-current]="tx.id === selectedId() ? 'true' : null"
              >
                <td class="py-2.5 ps-4 pe-3 whitespace-nowrap">{{ tx.date | appDate }}</td>
                <td class="py-2.5 pe-3">
                  <a
                    class="block truncate font-medium after:absolute after:inset-0 hover:underline"
                    dir="auto"
                    data-testid="payment-table-counterparty"
                    [attr.title]="
                      bookingText ? tx.counterparty + ' · ' + bookingText : tx.counterparty
                    "
                    [routerLink]="['/payments', tx.id]"
                  >
                    {{ tx.counterparty }}
                  </a>
                </td>
                <td class="py-2.5 pe-3">
                  <span class="block truncate">
                    {{ account ? nameOf(account, 'settings.bank.product.' + account.product | transloco) : '' }}
                  </span>
                </td>
                <td class="py-2.5 pe-3">
                  <span class="block truncate" data-testid="payment-table-booking">
                    @if (booking) {
                      <app-booking-label [booking]="booking" />
                    } @else {
                      —
                    }
                  </span>
                </td>
                <td class="py-2.5 pe-3">
                  <app-payment-status-chip [status]="status(tx)" />
                </td>
                <td class="py-2.5 pe-4 text-end">
                  <bdi dir="ltr" class="font-medium">
                    <span
                      data-testid="payment-table-amount"
                      [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'"
                    >
                      {{ tx.amountCents | money: { signed: true } }}
                    </span>
                  </bdi>
                </td>
              </tr>
            }
          </tbody>
        }
      </table>
    </div>
  `,
})
export class PaymentTable {
  protected readonly nameOf = accountName;

  private readonly language = inject(LanguageService);
  private readonly demo = inject(DemoStateService);

  readonly groups = input.required<readonly MonthGroup[]>();
  readonly accounts = input.required<readonly Account[]>();
  readonly selectedId = input<string | null>(null);
  /** A payment is open beside the table, so the table shows only from `2xl` where it has room. */
  readonly panelOpen = input(false);

  /** For the row's hover title; the booking cell itself is the shared `app-booking-label`. */
  protected readonly showLabel = computed(() => showsBookingLabel(this.language.lang()));
  protected readonly skr03 = skr03Text;
  protected readonly status = paymentStatus;
  /** The months of the groups that are closed (a month of the earlier months line too), as 'YYYY-MM'. */
  protected readonly closedMonths = computed(
    () =>
      new Set(
        this.groups()
          .map((group) => group.month)
          .filter((month) => isClosedDate(this.demo.business(), `${month}-01`)),
      ),
  );

  protected accountOf(accountId: string): Account | undefined {
    return this.accounts().find((a) => a.id === accountId);
  }
}
