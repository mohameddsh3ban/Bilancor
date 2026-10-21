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
        <hlm-progress-indicator [class]="limit().level === 'ok' ? '' : 'bg-warning'" />
      </hlm-progress>
      <p class="text-sm">
        <bdi dir="ltr" class="font-medium">{{ money(revenue()) }}</bdi>
        {{ 'home.tax.of' | transloco }}
        <bdi dir="ltr" class="font-medium">{{ money(limit().limitCents) }}</bdi>
        {{ 'home.tax.thisYear' | transloco }}
      </p>
      <p [class]="limit().level === 'ok' ? 'text-muted-foreground text-xs' : 'text-warning text-xs font-medium'">
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

  protected money(cents: number): string {
    return formatMoney(cents, this.language.lang());
  }
}
