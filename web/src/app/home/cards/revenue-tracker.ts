import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { Term } from '../../core/i18n/term';
import { revenueLimitStatus } from '../../domain/revenue-limit';
import { DemoStateService } from '../../state/demo-state.service';

/** The Kleinunternehmer revenue-limit tracker: a bar, the amounts and the percentage used. */
@Component({
  selector: 'app-revenue-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmProgressImports, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-2" data-testid="tax-tracker">
      <p class="text-sm font-medium"><app-term key="kleinunternehmer" /></p>
      <hlm-progress [value]="progress()" [attr.aria-label]="'home.tax.revenueLabel' | transloco">
        <hlm-progress-indicator [class]="indicatorClass()" />
      </hlm-progress>
      <p class="text-sm">
        <bdi dir="ltr" class="font-medium">{{ money(revenue(), true) }}</bdi>
        {{ 'home.tax.of' | transloco }}
        <bdi dir="ltr" class="font-medium">{{ money(limit().limitCents, true) }}</bdi>
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
  private readonly language = inject(LanguageService);

  protected readonly revenue = computed(() => this.demo.business().revenueThisYearCents);
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

  protected money(cents: number, whole = false): string {
    return formatMoney(cents, this.language.lang(), { whole });
  }
}
