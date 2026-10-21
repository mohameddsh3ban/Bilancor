import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatDate, formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { Term } from '../../core/i18n/term';
import { DemoStateService } from '../../state/demo-state.service';
import { RevenueTracker } from './revenue-tracker';

/** VAT return (VAT businesses) or the revenue-limit tracker (Kleinunternehmer), plus income tax to set aside. */
@Component({
  selector: 'app-tax-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmCardImports, RevenueTracker, RouterLink, Term, TranslocoPipe],
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
          <app-revenue-tracker />
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

  protected money(cents: number): string {
    return formatMoney(cents, this.language.lang());
  }

  protected date(iso: string): string {
    return formatDate(iso, this.language.lang());
  }
}
