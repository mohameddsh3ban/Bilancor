import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { pluralKey } from '../core/i18n/plural-key';
import { needsYouCount } from '../domain/payment-status';
import { DemoStateService } from '../state/demo-state.service';
import { AuditCard } from './audit-card';
import { MonthTable } from './month-table';

/**
 * Reports (`/reports`): the year month by month, closing a finished month, and the audit export. Until the tax details are
 * saved there are no figures to work out (whether the business charges VAT decides them), so the page only points at them,
 * as Taxes does; once they are saved but no bank is connected yet, it asks for the bank, as Payments does.
 *
 * Above the cards, one line counts the payments that still need the person: they are not in the figures or in an export
 * yet. Phone: one column, in that order; computer: the months on one side, the exports on the other.
 */
@Component({
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuditCard, HlmButton, HlmCardImports, MonthTable, RouterLink, TranslocoPipe],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <h1 class="text-2xl font-semibold">{{ 'reports.title' | transloco }}</h1>

    @if (!demo.setup().tax) {
      <section hlmCard size="sm" data-testid="reports-missing">
        <div hlmCardContent class="flex flex-col items-start gap-3">
          <p class="font-medium">{{ 'taxes.missing' | transloco }}</p>
          <a hlmBtn routerLink="/settings/tax" data-testid="reports-missing-link">
            {{ 'settings.tax.add' | transloco }}
          </a>
        </div>
      </section>
    } @else if (!demo.setup().bank) {
      <section hlmCard size="sm" data-testid="reports-connect">
        <div hlmCardContent class="flex flex-col items-start gap-3">
          <h2 class="font-medium">{{ 'reports.connect.title' | transloco }}</h2>
          <p class="text-muted-foreground text-sm">{{ 'reports.connect.body' | transloco }}</p>
          <a hlmBtn routerLink="/settings/bank/connect" data-testid="reports-connect-link">
            {{ 'reports.connect.action' | transloco }}
          </a>
        </div>
      </section>
    } @else {
      @if (needsYou() > 0) {
        <section hlmCard size="sm" data-testid="reports-needs">
          <div hlmCardContent class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-col gap-0.5">
              <p class="font-medium">
                {{ plural('reports.needs.title', needsYou()) | transloco: { count: needsYou() } }}
              </p>
              <p class="text-muted-foreground text-xs">
                {{ plural('reports.needs.note', needsYou()) | transloco }}
              </p>
            </div>
            <a
              hlmBtn
              size="sm"
              class="shrink-0"
              routerLink="/review"
              data-testid="reports-needs-start"
            >
              {{ 'reports.needs.start' | transloco }}
            </a>
          </div>
        </section>
      }

      <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div class="flex min-w-0 flex-col gap-4">
          <app-month-table />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <app-audit-card />
        </div>
      </div>
    }
  `,
})
export class ReportsPage {
  protected readonly demo = inject(DemoStateService);

  protected readonly plural = pluralKey;

  /** The payments of the business that still need the person: not booked, not confirmed, or with no receipt (the number the homepage and the review inbox show). */
  protected readonly needsYou = computed(() => needsYouCount(this.demo.business().transactions));
}
