import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBanknote, lucideChevronRight, lucideLandmark } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../../core/format/date.pipe';
import { MoneyPipe } from '../../core/format/money.pipe';
import { accountName } from '../../domain/bank-connection';
import { totalAvailableCents } from '../../domain/home-figures';
import { DemoStateService } from '../../state/demo-state.service';

/** Each account with its balance (tap opens the coming soon page), and the total available. */
@Component({
  selector: 'app-balances-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmCardImports, MoneyPipe, NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideBanknote, lucideChevronRight, lucideLandmark })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="balances-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle>{{ 'home.balances.title' | transloco }}</h2>
      </header>
      <div hlmCardContent class="flex flex-col">
        <ul class="flex flex-col">
          @for (account of accounts(); track account.id) {
            <li class="border-border border-t first:border-t-0">
              <a
                class="hover:bg-muted flex items-center gap-3 py-2.5"
                [routerLink]="['/soon', 'account']"
                [attr.data-testid]="'account-' + account.id"
              >
                <ng-icon
                  [name]="account.kind === 'cash' ? 'lucideBanknote' : 'lucideLandmark'"
                  size="18"
                  class="text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{{
                    nameOf(account, 'settings.bank.product.' + account.product | transloco)
                  }}</span>
                  <span class="text-muted-foreground text-xs" data-testid="account-updated">
                    {{
                      'home.balances.updated' | transloco: { date: (account.lastUpdate | appDate) }
                    }}
                  </span>
                </span>
                <bdi dir="ltr" class="shrink-0 font-medium">{{ account.balanceCents | money }}</bdi>
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
        <div
          class="border-border flex items-center justify-between gap-3 border-t pt-3 font-medium"
        >
          <span>{{ 'home.balances.total' | transloco }}</span>
          <bdi dir="ltr" data-testid="balances-total">{{ total() | money }}</bdi>
        </div>
      </div>
    </section>
  `,
})
export class BalancesCard {
  private readonly demo = inject(DemoStateService);

  protected readonly nameOf = accountName;
  protected readonly accounts = computed(() => this.demo.business().accounts);
  protected readonly total = computed(() => totalAvailableCents(this.accounts()));
}
