import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { homeCards } from '../domain/home-cards';
import { DemoStateService } from '../state/demo-state.service';
import { NoticeService } from '../state/notice.service';
import { BalancesCard } from './cards/balances-card';
import { DecisionsCard } from './cards/decisions-card';
import { KeyNumbers } from './cards/key-numbers';
import { NoticesCard } from './cards/notices-card';
import { SetupChecklist } from './cards/setup-checklist';
import { TaxCard } from './cards/tax-card';
import { TransactionsCard } from './cards/transactions-card';

/**
 * The homepage: notices, setup checklist, decisions, transactions, balances and tax, each when setup allows it.
 * From `lg` the decisions, balances and tax cards give way to the key-number tiles, and the transactions card
 * (which becomes a table) moves below them at full width.
 */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BalancesCard, DecisionsCard, KeyNumbers, NoticesCard, SetupChecklist, TaxCard, TransactionsCard],
  template: `
    <div class="flex flex-col gap-4">
      @if (notices.shown().length > 0) {
        <app-notices-card />
      }
      @if (cards().checklist) {
        <app-setup-checklist />
      }
      @if (cards().decisions || cards().balances || cards().tax) {
        <app-key-numbers />
      }
      @if (cards().decisions) {
        <app-decisions-card class="lg:hidden" />
      }
      @if (cards().transactions) {
        <app-transactions-card />
      }
      @if (cards().balances) {
        <app-balances-card class="lg:hidden" />
      }
      @if (cards().tax) {
        <app-tax-card class="lg:hidden" />
      }
    </div>
  `,
})
export class HomePage {
  protected readonly notices = inject(NoticeService);
  private readonly demo = inject(DemoStateService);

  protected readonly cards = computed(() => homeCards(this.demo.setup()));
}
