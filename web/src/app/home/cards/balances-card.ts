import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBanknote, lucideChevronRight, lucideLandmark } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { DemoStateService } from '../../state/demo-state.service';

/** Each account with its balance (tap opens the coming soon page), and the total available. */
@Component({
  selector: 'app-balances-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, NgIcon, RouterLink, TranslocoPipe],
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
                <span class="min-w-0 flex-1 truncate">{{ account.name }}</span>
                <bdi dir="ltr" class="shrink-0 font-medium">{{ money(account.balanceCents) }}</bdi>
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
        <div class="border-border flex items-center justify-between gap-3 border-t pt-3 font-medium">
          <span>{{ 'home.balances.total' | transloco }}</span>
          <bdi dir="ltr" data-testid="balances-total">{{ money(total()) }}</bdi>
        </div>
      </div>
    </section>
  `,
})
export class BalancesCard {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly accounts = computed(() => this.demo.business().accounts);
  protected readonly total = computed(() => this.accounts().reduce((sum, a) => sum + a.balanceCents, 0));

  protected money(cents: number): string {
    return formatMoney(cents, this.language.lang());
  }
}
