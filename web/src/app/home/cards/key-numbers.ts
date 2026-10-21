import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { formatDate, formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { Term } from '../../core/i18n/term';
import { homeCards } from '../../domain/home-cards';
import { decisionMinutes, totalAvailableCents } from '../../domain/home-figures';
import { DemoStateService } from '../../state/demo-state.service';
import { RevenueTracker } from './revenue-tracker';

/**
 * Computer homepage only: three key-number tiles in a row (decisions, total available, VAT or revenue limit).
 * Each tile shows only when its phone card would; on the phone these tiles are hidden and the cards show instead.
 */
@Component({
  selector: 'app-key-numbers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, NgIcon, RevenueTracker, RouterLink, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircleCheck })],
  host: { class: 'hidden grid-cols-3 items-start gap-4 lg:grid' },
  template: `
    @if (cards().decisions) {
      <section hlmCard size="sm" data-testid="tile-decisions">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'home.tiles.decisions' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @if (business().decisionsOpen > 0) {
            <p class="text-3xl font-semibold">{{ business().decisionsOpen }}</p>
            <p class="text-muted-foreground text-xs">
              {{
                (minutes() === 1 ? 'home.decisions.minutesOne' : 'home.decisions.minutes')
                  | transloco: { count: minutes() }
              }}
            </p>
            <a hlmBtn size="sm" class="self-start" [routerLink]="['/soon', 'decisions']">
              {{ 'home.decisions.start' | transloco }}
            </a>
          } @else {
            <div class="flex items-center gap-3">
              <ng-icon name="lucideCircleCheck" size="22" class="text-positive shrink-0" aria-hidden="true" />
              <p class="min-w-0 flex-1 font-medium">{{ 'home.decisions.allClear' | transloco }}</p>
            </div>
          }
        </div>
      </section>
    }
    @if (cards().balances) {
      <section hlmCard size="sm" data-testid="tile-balances">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'home.balances.total' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          <p class="text-3xl font-semibold">
            <bdi dir="ltr" data-testid="tile-balances-total">{{ money(total()) }}</bdi>
          </p>
          <ul class="border-border flex flex-col border-t pt-1">
            @for (account of business().accounts; track account.id) {
              <li class="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span class="min-w-0 truncate">{{ account.kind === 'cash' ? ('account.cash' | transloco) : account.name }}</span>
                <bdi dir="ltr" class="shrink-0 font-medium">{{ money(account.balanceCents) }}</bdi>
              </li>
            }
          </ul>
        </div>
      </section>
    }
    @if (cards().tax) {
      <section hlmCard size="sm" data-testid="tile-tax">
        <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
          <h2 hlmCardTitle>{{ 'home.tax.title' | transloco }}</h2>
          <a
            class="text-primary text-sm font-medium underline-offset-4 hover:underline"
            data-testid="tile-tax-open"
            [routerLink]="['/soon', 'taxes']"
          >
            {{ 'home.tax.open' | transloco }}
          </a>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @if (business().taxProfile.kleinunternehmer) {
            <app-revenue-tracker />
          } @else if (business().vatDue; as vat) {
            <div class="flex flex-col gap-1">
              <p class="text-sm font-medium"><app-term key="ustva" /></p>
              <p class="text-muted-foreground text-xs">{{ 'home.tax.vatAmount' | transloco }}</p>
              <p class="text-3xl font-semibold">
                <bdi dir="ltr">{{ money(vat.amountCents) }}</bdi>
              </p>
              <p class="text-muted-foreground text-xs">
                {{ 'home.tax.vatDue' | transloco: { date: date(vat.dueDate) } }}
              </p>
            </div>
          }
          <div class="border-border flex items-baseline justify-between gap-3 border-t pt-3 text-sm">
            <span>{{ 'home.tax.incomeTax' | transloco }}</span>
            <bdi dir="ltr" class="font-medium">{{ money(business().incomeTaxReserveCents) }}</bdi>
          </div>
        </div>
      </section>
    }
  `,
})
export class KeyNumbers {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  protected readonly business = this.demo.business;
  protected readonly cards = computed(() => homeCards(this.demo.setup()));
  protected readonly minutes = computed(() => decisionMinutes(this.business().decisionsOpen));
  protected readonly total = computed(() => totalAvailableCents(this.business().accounts));

  protected money(cents: number): string {
    return formatMoney(cents, this.language.lang());
  }

  protected date(iso: string): string {
    return formatDate(iso, this.language.lang());
  }
}
