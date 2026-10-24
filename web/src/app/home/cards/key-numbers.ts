import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../../core/format/date.pipe';
import { MoneyPipe } from '../../core/format/money.pipe';
import { Term } from '../../core/i18n/term';
import { accountName } from '../../domain/bank-connection';
import { homeCards } from '../../domain/home-cards';
import { balanceAccounts, decisionCount, decisionMinutes, totalAvailableCents } from '../../domain/home-figures';
import { currentVatReturn, resultWording } from '../../domain/vat-return';
import { DemoStateService } from '../../state/demo-state.service';
import { RevenueTracker } from './revenue-tracker';

/**
 * Computer homepage only: three key-number tiles in a row (decisions, total available, VAT or revenue limit).
 * Each tile shows only when its phone card would; on the phone these tiles are hidden and the cards show instead.
 */
@Component({
  selector: 'app-key-numbers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    HlmButton,
    HlmCardImports,
    MoneyPipe,
    NgIcon,
    RevenueTracker,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideCircleCheck })],
  host: { class: 'hidden grid-cols-3 items-start gap-4 lg:grid' },
  template: `
    @if (cards().decisions) {
      <section hlmCard size="sm" data-testid="tile-decisions">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'home.tiles.decisions' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @if (decisions() > 0) {
            <p class="text-3xl font-semibold">{{ decisions() }}</p>
            <p class="text-muted-foreground text-xs">
              {{
                (minutes() === 1 ? 'home.decisions.minutesOne' : 'home.decisions.minutes')
                  | transloco: { count: minutes() }
              }}
            </p>
            <a hlmBtn size="sm" class="self-start" routerLink="/review">
              {{ 'home.decisions.start' | transloco }}
            </a>
          } @else {
            <div class="flex items-center gap-3">
              <ng-icon
                name="lucideCircleCheck"
                size="22"
                class="text-positive shrink-0"
                aria-hidden="true"
              />
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
            <bdi dir="ltr" data-testid="tile-balances-total">{{ total() | money }}</bdi>
          </p>
          <ul class="border-border flex flex-col border-t pt-1">
            @for (account of accounts(); track account.id) {
              <li class="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span class="min-w-0 truncate">{{
                  nameOf(account, 'settings.bank.product.' + account.product | transloco)
                }}</span>
                <bdi dir="ltr" class="shrink-0 font-medium">{{ account.balanceCents | money }}</bdi>
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
            routerLink="/taxes"
          >
            {{ 'home.tax.open' | transloco }}
          </a>
        </header>
        <div hlmCardContent class="flex flex-col gap-3">
          @if (business().taxProfile.kleinunternehmer) {
            <app-revenue-tracker />
          } @else if (vat(); as current) {
            <div class="flex flex-col gap-1">
              <p class="text-sm font-medium"><app-term key="ustva" /></p>
              @if (current.kind === 'return') {
                @let view = current.view;
                @if (view.amountKnown) {
                  @let result = wording(view);
                  <p class="text-muted-foreground text-xs">
                    {{ (result.key === 'refund' ? 'home.tax.vatRefund' : 'home.tax.vatAmount') | transloco }}
                  </p>
                  <p class="text-3xl font-semibold">
                    <bdi dir="ltr">{{ result.cents | money }}</bdi>
                  </p>
                } @else {
                  <p class="text-muted-foreground text-sm">
                    {{ 'home.tax.amountUnknown' | transloco }}
                  </p>
                }
                <p
                  class="text-xs"
                  [class]="view.state === 'overdue' ? 'text-negative font-medium' : 'text-muted-foreground'"
                  data-testid="tile-tax-due"
                >
                  {{
                    (view.state === 'overdue' ? 'home.tax.vatOverdue' : 'home.tax.vatDue')
                      | transloco: { date: (view.dueDate | appDate) }
                  }}
                </p>
              } @else {
                <p class="text-muted-foreground text-xs">
                  {{ 'home.tax.yearlyOnly' | transloco }}
                </p>
              }
            </div>
          }
          <div
            class="border-border flex items-baseline justify-between gap-3 border-t pt-3 text-sm"
          >
            <span>{{ 'home.tax.incomeTax' | transloco }}</span>
            <bdi dir="ltr" class="font-medium">{{ business().incomeTaxReserveCents | money }}</bdi>
          </div>
        </div>
      </section>
    }
  `,
})
export class KeyNumbers {
  private readonly demo = inject(DemoStateService);

  protected readonly business = this.demo.business;
  protected readonly nameOf = accountName;
  protected readonly cards = computed(() => homeCards(this.demo.setup(), this.demo.business()));
  protected readonly decisions = computed(() => decisionCount(this.business(), this.demo.setup()));
  protected readonly minutes = computed(() => decisionMinutes(this.decisions()));
  /** The accounts that hold the business's money (not Own money). */
  protected readonly accounts = computed(() => balanceAccounts(this.business().accounts));
  protected readonly total = computed(() => totalAvailableCents(this.accounts()));
  protected readonly wording = resultWording;
  /** The open business's current VAT return (the same as the phone's tax card): its date and amount, "yearly only", or null. */
  protected readonly vat = computed(() => currentVatReturn(this.business()));
}
