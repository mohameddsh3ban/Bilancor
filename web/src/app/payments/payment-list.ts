import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppMonthPipe } from '../core/format/month.pipe';
import { paymentStatus } from '../domain/payment-status';
import { MonthGroup } from '../domain/payment-filters';
import { PaymentStatusChip } from './payment-status-chip';

/**
 * Phone layout of the payments: one card per month with its in/out totals, one row per payment.
 * Hidden from `lg` (the table takes over), or from `2xl` while a payment is open beside the list.
 */
@Component({
  selector: 'app-payment-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    AppMonthPipe,
    MoneyPipe,
    NgIcon,
    PaymentStatusChip,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'flex flex-col gap-4', '[class]': 'hiddenFrom()' },
  template: `
    @for (group of groups(); track group.month) {
      <section
        class="bg-card border-border overflow-hidden rounded-xl border"
        data-testid="month-group"
      >
        <header class="bg-muted/50 flex items-baseline justify-between gap-3 px-4 py-2">
          <h2 class="font-semibold" data-testid="month-title">{{ group.month | appMonth }}</h2>
          <p class="text-muted-foreground flex shrink-0 gap-3 text-xs">
            <span data-testid="month-in">
              {{ 'payments.monthIn' | transloco }}
              <bdi dir="ltr" class="text-positive font-medium">{{
                group.inCents | money: { signed: true }
              }}</bdi>
            </span>
            <span data-testid="month-out">
              {{ 'payments.monthOut' | transloco }}
              <bdi dir="ltr" class="text-negative font-medium">{{
                group.outCents | money: { signed: true }
              }}</bdi>
            </span>
          </p>
        </header>
        <ul>
          @for (tx of group.payments; track tx.id) {
            <li class="border-border border-t first:border-t-0">
              <a
                class="hover:bg-muted flex items-center gap-3 px-4 py-2.5"
                data-testid="payment-row"
                [class.bg-muted]="tx.id === selectedId()"
                [attr.aria-current]="tx.id === selectedId() ? 'true' : null"
                [routerLink]="['/payments', tx.id]"
              >
                <span class="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    class="truncate font-medium"
                    dir="auto"
                    data-testid="payment-counterparty"
                    >{{ tx.counterparty }}</span
                  >
                  <span class="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{{ tx.date | appDate }}</span>
                    <app-payment-status-chip [status]="status(tx)" />
                  </span>
                </span>
                <bdi dir="ltr" class="shrink-0 font-medium">
                  <span
                    data-testid="payment-amount"
                    [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'"
                  >
                    {{ tx.amountCents | money: { signed: true } }}
                  </span>
                </bdi>
                <ng-icon
                  name="lucideChevronRight"
                  size="16"
                  class="text-muted-foreground shrink-0 rtl:rotate-180"
                  aria-hidden="true"
                />
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class PaymentList {
  readonly groups = input.required<readonly MonthGroup[]>();
  readonly selectedId = input<string | null>(null);
  /** A payment is open beside the list, so the table gets less room and gives way to this list for longer. */
  readonly panelOpen = input(false);

  protected readonly status = paymentStatus;
  protected readonly hiddenFrom = computed(() => (this.panelOpen() ? '2xl:hidden' : 'lg:hidden'));
}
