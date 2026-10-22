import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Account, Transaction } from '../data/models';
import { parseAmountQuery } from '../domain/payment-filters';
import { DemoStateService } from '../state/demo-state.service';

/**
 * The payments whose counterparty contains the typed text (any case, outer spaces ignored), or whose amount is the
 * typed one (`120`, `120,00` and `120.00` all find 120 euros; the sign does not matter). Nothing typed keeps them all.
 */
export function matchPayments(payments: readonly Transaction[], query: string): Transaction[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return [...payments];
  const amount = parseAmountQuery(needle);
  return payments.filter(
    (tx) =>
      tx.counterparty.toLocaleLowerCase().includes(needle) ||
      (amount !== null && Math.abs(tx.amountCents) === amount.cents),
  );
}

/**
 * A "Search all payments" button that opens a searchable list of the payments a document could be linked to (given
 * in the order to show them). Choosing one emits it and closes the list. The list is a popover that is nearly as
 * wide as the screen on a phone.
 */
@Component({
  selector: 'app-payment-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, HlmPopoverImports, MoneyPipe, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideSearch })],
  host: { class: 'inline-block' },
  template: `
    <hlm-popover align="start" (stateChanged)="onState($event)">
      <button hlmPopoverTrigger hlmBtn variant="outline" size="lg" data-testid="search-payments">
        {{ 'documents.detail.payment.searchAll' | transloco }}
      </button>
      <ng-template hlmPopoverPortal let-popover>
        <!-- On a phone the list starts where the button does (inside the page and card padding), so it is 4.5rem narrower than the screen. -->
        <hlm-popover-content class="w-[min(24rem,calc(100vw-4.5rem))] gap-2 p-2">
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              size="16"
              class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              class="border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-md border ps-9 pe-3 text-sm"
              data-testid="payment-search"
              [value]="query()"
              [attr.aria-label]="'documents.detail.picker.search' | transloco"
              [placeholder]="'documents.detail.picker.placeholder' | transloco"
              (input)="setQuery($event)"
            />
          </div>
          <ul class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            @for (payment of matches(); track payment.id) {
              <li>
                <button
                  type="button"
                  class="hover:bg-muted focus-visible:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-start text-sm outline-none"
                  data-testid="payment-picker-option"
                  (click)="choose(payment, popover)"
                >
                  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="block font-medium" data-testid="picker-name"
                      ><span class="inline-block max-w-full truncate align-bottom" dir="auto">{{
                        payment.counterparty
                      }}</span></span
                    >
                    <span class="text-muted-foreground text-xs" data-testid="picker-meta">
                      @let account = accountOf(payment);
                      {{ payment.date | appDate }} ·
                      {{ account?.kind === 'cash' ? ('account.cash' | transloco) : account?.name }}
                    </span>
                  </span>
                  <bdi dir="ltr" class="shrink-0 font-medium">
                    <span data-testid="picker-amount">{{
                      payment.amountCents | money: { signed: true }
                    }}</span>
                  </bdi>
                </button>
              </li>
            } @empty {
              <li
                class="text-muted-foreground px-2 py-3 text-sm"
                data-testid="payment-picker-empty"
              >
                {{ 'documents.detail.picker.empty' | transloco }}
              </li>
            }
          </ul>
        </hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class PaymentPicker {
  private readonly demo = inject(DemoStateService);

  /** The payments to choose from, best first. */
  readonly payments = input.required<readonly Transaction[]>();
  readonly picked = output<Transaction>();

  protected readonly query = signal('');
  protected readonly matches = computed(() => matchPayments(this.payments(), this.query()));

  protected accountOf(payment: Transaction): Account | undefined {
    return this.demo.business().accounts.find((a) => a.id === payment.accountId);
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onState(state: 'open' | 'closed'): void {
    if (state === 'closed') this.query.set('');
  }

  protected choose(payment: Transaction, popover: { close: () => void }): void {
    popover.close();
    this.picked.emit(payment);
  }
}
