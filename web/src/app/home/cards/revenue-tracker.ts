import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { MoneyPipe } from '../../core/format/money.pipe';
import { Term } from '../../core/i18n/term';
import { revenueLimitStatus } from '../../domain/revenue-limit';
import { yearSummary } from '../../domain/tax-year';
import { DemoStateService } from '../../state/demo-state.service';

/** The Kleinunternehmer revenue-limit tracker: a bar, the amounts and the percentage used. */
@Component({
  selector: 'app-revenue-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmProgressImports, MoneyPipe, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-2" data-testid="tax-tracker">
      <p class="text-sm font-medium"><app-term key="kleinunternehmer" /></p>
      <hlm-progress [value]="progress()" [attr.aria-label]="'home.tax.revenueLabel' | transloco">
        <hlm-progress-indicator [class]="indicatorClass()" />
      </hlm-progress>
      <p class="text-sm">
        <bdi dir="ltr" class="font-medium">{{ revenue() | money: { whole: true } }}</bdi>
        {{ 'home.tax.of' | transloco }}
        <bdi dir="ltr" class="font-medium">{{ limit().limitCents | money: { whole: true } }}</bdi>
        {{ 'home.tax.thisYear' | transloco }}
      </p>
      <p data-testid="tax-tracker-percent" [class]="percentClass()">
        {{ 'home.tax.percentUsed' | transloco: { percent: limit().percent } }}
      </p>
    </div>
  `,
})
export class RevenueTracker {
  private readonly demo = inject(DemoStateService);

  /** The year's income so far: the figure the Taxes page shows for the year (for a Kleinunternehmer, as paid), so the two never disagree. */
  protected readonly revenue = computed(() => yearSummary(this.demo.business()).incomeCents);
  protected readonly limit = computed(() => revenueLimitStatus(this.revenue()));
  /** The bar only takes 0 to 100; the percentage text still shows the real figure. */
  protected readonly progress = computed(() => Math.min(100, Math.max(0, this.limit().percent)));

  protected readonly indicatorClass = computed(() => {
    const level = this.limit().level;
    return level === 'ok' ? '' : level === 'overNow' ? 'bg-negative' : 'bg-warning';
  });
  protected readonly percentClass = computed(() => {
    const level = this.limit().level;
    if (level === 'ok') return 'text-muted-foreground text-xs';
    return (level === 'overNow' ? 'text-negative' : 'text-warning') + ' text-xs font-medium';
  });
}
