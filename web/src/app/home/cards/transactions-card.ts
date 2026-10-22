import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../../core/format/date.pipe';
import { MoneyPipe } from '../../core/format/money.pipe';
import { LanguageService } from '../../core/i18n/language.service';
import { Account, Booking } from '../../data/models';
import { newestTransactions } from '../../domain/home-figures';
import { paymentStatus } from '../../domain/payment-status';
import { PaymentStatusChip } from '../../payments/payment-status-chip';
import { DemoStateService } from '../../state/demo-state.service';

/**
 * The five newest payments with their status. Below `lg` a list, from `lg` a table with account and booking;
 * every row opens its payment and "See all" opens the payments page.
 */
@Component({
  selector: 'app-transactions-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    HlmCardImports,
    MoneyPipe,
    NgIcon,
    PaymentStatusChip,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="transactions-card">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle>{{ 'home.transactions.title' | transloco }}</h2>
        <a
          class="text-primary text-sm font-medium underline-offset-4 hover:underline"
          data-testid="tx-see-all"
          routerLink="/payments"
        >
          {{ 'home.transactions.seeAll' | transloco }}
        </a>
      </header>
      <ul hlmCardContent class="flex flex-col lg:hidden">
        @for (tx of rows(); track tx.id) {
          <li class="border-border border-t first:border-t-0">
            <a
              class="hover:bg-muted flex items-center gap-3 py-2.5"
              data-testid="tx-row"
              [routerLink]="['/payments', tx.id]"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="truncate font-medium" dir="auto" data-testid="tx-counterparty">{{
                  tx.counterparty
                }}</span>
                <span class="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{{ tx.date | appDate }}</span>
                  <app-payment-status-chip [status]="status(tx)" />
                </span>
              </span>
              <bdi dir="ltr" class="shrink-0 font-medium">
                <span
                  data-testid="tx-amount"
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
      <div hlmCardContent class="hidden lg:block">
        <table class="w-full table-fixed text-sm" data-testid="tx-table">
          <colgroup>
            <col class="w-20" />
            <col />
            <col class="w-20" />
            <col />
            <col class="w-36" />
            <col class="w-24" />
          </colgroup>
          <thead>
            <tr class="text-muted-foreground text-xs">
              <th scope="col" class="pb-2 pe-3 text-start font-medium">
                {{ 'home.transactions.col.date' | transloco }}
              </th>
              <th scope="col" class="pb-2 pe-3 text-start font-medium">
                {{ 'home.transactions.col.counterparty' | transloco }}
              </th>
              <th scope="col" class="pb-2 pe-3 text-start font-medium">
                {{ 'home.transactions.col.account' | transloco }}
              </th>
              <th scope="col" class="pb-2 pe-3 text-start font-medium">
                {{ 'home.transactions.col.booking' | transloco }}
              </th>
              <th scope="col" class="pb-2 pe-3 text-start font-medium">
                {{ 'home.transactions.col.status' | transloco }}
              </th>
              <th scope="col" class="pb-2 text-end font-medium">
                {{ 'home.transactions.col.amount' | transloco }}
              </th>
            </tr>
          </thead>
          <tbody>
            @for (tx of rows(); track tx.id) {
              <tr class="border-border hover:bg-muted relative border-t" data-testid="tx-table-row">
                <td class="py-2.5 pe-3 whitespace-nowrap">{{ tx.date | appDate }}</td>
                @let booking = tx.booking;
                @let bookingText =
                  booking
                    ? showLabel()
                      ? ('booking.' + booking.labelKey | transloco) + ' · ' + skr03(booking)
                      : skr03(booking)
                    : '';
                <td class="py-2.5 pe-3">
                  <a
                    class="block truncate font-medium after:absolute after:inset-0 hover:underline"
                    dir="auto"
                    data-testid="tx-table-counterparty"
                    [attr.title]="
                      bookingText ? tx.counterparty + ' · ' + bookingText : tx.counterparty
                    "
                    [routerLink]="['/payments', tx.id]"
                  >
                    {{ tx.counterparty }}
                  </a>
                </td>
                @let account = accountOf(tx.accountId);
                <td class="py-2.5 pe-3">
                  {{ account?.kind === 'cash' ? ('account.cash' | transloco) : account?.name }}
                </td>
                <td class="py-2.5 pe-3">
                  <span class="block truncate" data-testid="tx-table-booking">
                    @if (booking) {
                      @if (showLabel()) {
                        {{ 'booking.' + booking.labelKey | transloco }} ·
                      }
                      <bdi dir="ltr">{{ skr03(booking) }}</bdi>
                    } @else {
                      —
                    }
                  </span>
                </td>
                <td class="py-2.5 pe-3">
                  <app-payment-status-chip [status]="status(tx)" />
                </td>
                <td class="py-2.5 text-end">
                  <bdi dir="ltr" class="font-medium">
                    <span
                      data-testid="tx-table-amount"
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
      </div>
    </section>
  `,
})
export class TransactionsCard {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly rows = computed(() => newestTransactions(this.demo.business().transactions));
  /** German keeps only the SKR03 account; English and Arabic put a short translated label in front of it. */
  protected readonly showLabel = computed(() => this.language.lang() !== 'de');

  protected accountOf(accountId: string): Account | undefined {
    return this.demo.business().accounts.find((a) => a.id === accountId);
  }

  /** The SKR03 number with its German name; the caller keeps it left-to-right. */
  protected skr03(booking: Booking): string {
    return `${booking.skr03} ${booking.nameDe}`;
  }

  protected readonly status = paymentStatus;
}
