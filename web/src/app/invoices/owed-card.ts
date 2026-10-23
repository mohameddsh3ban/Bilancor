import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { MoneyPipe } from '../core/format/money.pipe';
import { pluralKey } from '../core/i18n/plural-key';
import { owedSummary } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';

/**
 * What customers still owe the open business: the total and how many invoices, then in red the overdue part. Each part
 * is a link to Invoices with the matching filter (Open, Overdue). Nothing owed, nothing shown. It takes no input, so a
 * page can place it as it is (Invoices, the homepage).
 */
@Component({
  selector: 'app-owed-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, MoneyPipe, RouterLink, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (owed(); as summary) {
      <section hlmCard size="sm" data-testid="owed-card">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'invoices.owed.title' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-1">
          <a
            class="hover:bg-muted -mx-2 block rounded-md px-2 py-1"
            data-testid="owed-total"
            routerLink="/invoices"
            [queryParams]="{ filter: 'open' }"
          >
            <bdi dir="ltr" class="text-2xl font-semibold">{{ summary.owedCents | money }}</bdi>
            <span class="text-muted-foreground text-sm">
              ·
              {{
                plural('invoices.count', summary.owedCount)
                  | transloco: { count: summary.owedCount }
              }}
            </span>
          </a>
          @if (summary.overdueCount > 0) {
            <a
              class="text-negative hover:bg-muted -mx-2 block rounded-md px-2 py-1.5 text-sm"
              data-testid="owed-overdue"
              routerLink="/invoices"
              [queryParams]="{ filter: 'overdue' }"
            >
              <bdi dir="ltr" class="font-semibold">{{ summary.overdueCents | money }}</bdi>
              <span>
                {{ 'invoices.owed.overdue' | transloco }} ·
                {{
                  plural('invoices.count', summary.overdueCount)
                    | transloco: { count: summary.overdueCount }
                }}
              </span>
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class OwedCard {
  private readonly demo = inject(DemoStateService);

  protected readonly plural = pluralKey;

  /** What is owed, or null when nothing is: the card is hidden then. */
  protected readonly owed = computed(() => {
    const summary = owedSummary(this.demo.business(), this.demo.setup());
    return summary.owedCount > 0 ? summary : null;
  });
}
