import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatDate, formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { TxStatus } from '../../data/models';
import { DemoStateService } from '../../state/demo-state.service';

const CHIP_CLASSES: Record<TxStatus, string> = {
  booked: 'bg-positive/10 text-positive',
  confirm: 'bg-warning/10 text-warning',
  unclear: 'bg-warning/10 text-warning',
  noReceipt: 'bg-negative/10 text-negative',
};

/** The five newest payments with their status; every row and "See all" open the (coming soon) payments page. */
@Component({
  selector: 'app-transactions-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, NgIcon, RouterLink, TranslocoPipe],
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
      <ul hlmCardContent class="flex flex-col">
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
                  <span
                    class="rounded-full px-2 py-0.5 font-medium whitespace-nowrap"
                    data-testid="tx-status"
                    [class]="chip(tx.status)"
                  >
                    {{ 'home.status.' + tx.status | transloco }}
                  </span>
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
    </section>
  `,
})
export class TransactionsCard {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly rows = computed(() =>
    [...this.demo.business().transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  );

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
