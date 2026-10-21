import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatDate, formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { Booking, TxStatus } from '../../data/models';
import { newestTransactions } from '../../domain/home-figures';
import { DemoStateService } from '../../state/demo-state.service';

const CHIP_CLASSES: Record<TxStatus, string> = {
  booked: 'bg-positive/10 text-positive',
  confirm: 'bg-warning/10 text-warning',
  unclear: 'bg-warning/10 text-warning',
  noReceipt: 'bg-negative/10 text-negative',
};

/**
 * The five newest payments with their status. Below `lg` a list, from `lg` a table with account and booking;
 * every row and "See all" open the (coming soon) payments page.
 */
@Component({
  selector: 'app-transactions-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, NgIcon, NgTemplateOutlet, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="transactions-card">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle>{{ 'home.transactions.title' | transloco }}</h2>
        <a
          class="text-primary text-sm font-medium underline-offset-4 hover:underline"
          data-testid="tx-see-all"
          [routerLink]="['/soon', 'payments']"
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
              [routerLink]="['/soon', 'payments']"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="truncate font-medium" dir="auto" data-testid="tx-counterparty">{{ tx.counterparty }}</span>
                <span class="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{{ date(tx.date) }}</span>
                  <ng-container [ngTemplateOutlet]="statusChip" [ngTemplateOutletContext]="{ $implicit: tx }" />
                </span>
              </span>
              <bdi dir="ltr" class="shrink-0 font-medium">
                <span data-testid="tx-amount" [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'">
                  {{ money(tx.amountCents) }}
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
            <col class="w-28" />
            <col class="w-[26%]" />
            <col class="w-32" />
            <col />
            <col class="w-40" />
            <col class="w-32" />
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
              <tr class="border-border hover:bg-muted border-t" data-testid="tx-table-row">
                <td class="py-2.5 pe-3 whitespace-nowrap">{{ date(tx.date) }}</td>
                <td class="py-2.5 pe-3">
                  <a
                    class="block truncate font-medium hover:underline"
                    dir="auto"
                    data-testid="tx-table-counterparty"
                    [routerLink]="['/soon', 'payments']"
                  >
                    {{ tx.counterparty }}
                  </a>
                </td>
                <td class="py-2.5 pe-3">{{ accountName(tx.accountId) }}</td>
                <td class="py-2.5 pe-3" data-testid="tx-table-booking">
                  @if (tx.booking; as booking) {
                    @if (showLabel()) {
                      {{ 'booking.' + booking.labelKey | transloco }} ·
                    }
                    <bdi dir="ltr">{{ skr03(booking) }}</bdi>
                  } @else {
                    —
                  }
                </td>
                <td class="py-2.5 pe-3">
                  <ng-container [ngTemplateOutlet]="statusChip" [ngTemplateOutletContext]="{ $implicit: tx }" />
                </td>
                <td class="py-2.5 text-end">
                  <bdi dir="ltr" class="font-medium">
                    <span
                      data-testid="tx-table-amount"
                      [class]="tx.amountCents >= 0 ? 'text-positive' : 'text-negative'"
                    >
                      {{ money(tx.amountCents) }}
                    </span>
                  </bdi>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <ng-template #statusChip let-tx>
      <span
        class="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
        data-testid="tx-status"
        [class]="chip(tx.status)"
      >
        {{ 'home.status.' + tx.status | transloco }}
      </span>
    </ng-template>
  `,
})
export class TransactionsCard {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly rows = computed(() => newestTransactions(this.demo.business().transactions));
  /** German keeps only the SKR03 account; English and Arabic put a short translated label in front of it. */
  protected readonly showLabel = computed(() => this.language.lang() !== 'de');

  protected accountName(accountId: string): string {
    return this.demo.business().accounts.find((a) => a.id === accountId)?.name ?? '';
  }

  /** The SKR03 number with its German name; the caller keeps it left-to-right. */
  protected skr03(booking: Booking): string {
    return `${booking.skr03} ${booking.nameDe}`;
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.language.lang(), { signed: true });
  }

  protected date(iso: string): string {
    return formatDate(iso, this.language.lang());
  }

  protected chip(status: TxStatus): string {
    return CHIP_CLASSES[status];
  }
}
