import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { formatDate, formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { Term } from '../../core/i18n/term';
import { revenueLimitStatus } from '../../domain/revenue-limit';
import { DemoStateService } from '../../state/demo-state.service';

/** VAT return (VAT businesses) or the revenue-limit tracker (Kleinunternehmer), plus income tax to set aside. */
@Component({
  selector: 'app-tax-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, HlmProgressImports, RouterLink, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="tax-card">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle>{{ 'home.tax.title' | transloco }}</h2>
        <a
          class="text-primary text-sm font-medium underline-offset-4 hover:underline"
          data-testid="tax-open"
          [routerLink]="['/soon', 'taxes']"
        >
          {{ 'home.tax.open' | transloco }}
        </a>
      </header>
      <div hlmCardContent class="flex flex-col gap-4">
        @if (business().taxProfile.kleinunternehmer) {
          <div class="flex flex-col gap-2" data-testid="tax-tracker">
            <p class="text-sm font-medium"><app-term key="kleinunternehmer" /></p>
            <hlm-progress [value]="progress()" [attr.aria-label]="'home.tax.revenueLabel' | transloco">
              <hlm-progress-indicator [class]="limit().level === 'ok' ? '' : 'bg-warning'" />
            </hlm-progress>
            <p class="text-sm">
              <bdi dir="ltr" class="font-medium">{{ money(business().revenueThisYearCents) }}</bdi>
              {{ 'home.tax.of' | transloco }}
              <bdi dir="ltr" class="font-medium">{{ money(limit().limitCents) }}</bdi>
              {{ 'home.tax.thisYear' | transloco }}
            </p>
            <p [class]="limit().level === 'ok' ? 'text-muted-foreground text-xs' : 'text-warning text-xs font-medium'">
              {{ 'home.tax.percentUsed' | transloco: { percent: limit().percent } }}
            </p>
          </div>
        } @else if (business().vatDue; as vat) {
          <div class="flex flex-col gap-1" data-testid="tax-vat">
            <p class="text-sm font-medium"><app-term key="ustva" /></p>
            <p class="text-muted-foreground text-xs">
              {{ 'home.tax.vatDue' | transloco: { date: date(vat.dueDate) } }}
            </p>
            <p class="flex items-baseline justify-between gap-3 text-sm">
              <span>{{ 'home.tax.vatAmount' | transloco }}</span>
              <bdi dir="ltr" class="font-medium">{{ money(vat.amountCents) }}</bdi>
            </p>
          </div>
        }
        <div class="border-border flex items-baseline justify-between gap-3 border-t pt-3 text-sm">
          <span>{{ 'home.tax.incomeTax' | transloco }}</span>
          <bdi dir="ltr" class="font-medium">{{ money(business().incomeTaxReserveCents) }}</bdi>
        </div>
      </div>
    </section>
  `,
})
export class TaxCard {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly business = this.demo.business;
  protected readonly limit = computed(() => revenueLimitStatus(this.business().revenueThisYearCents));
  /** The bar only takes 0 to 100; the percentage text still shows the real figure. */
  protected readonly progress = computed(() => Math.min(100, Math.max(0, this.limit().percent)));

  protected money(cents: number): string {
    return formatMoney(cents, this.language.lang());
  }

  protected date(iso: string): string {
    return formatDate(iso, this.language.lang());
  }
}
