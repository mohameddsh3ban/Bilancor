import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { CopyButton } from '../documents/copy-button';
import { DemoStateService } from '../state/demo-state.service';
import { BankAccounts } from './bank-accounts';
import { InvoiceDetails } from './invoice-details';
import { PeopleCard } from './people-card';
import { TaxAnswers } from './tax-answers';

/**
 * Settings (`/settings`): five cards, one under the other on a phone and on a computer: Business and tax (the saved
 * answers, with Edit), Invoice details (what the invoices print, with Edit), Bank accounts (each connection and its
 * health, with Renew), People with access (who can open the books, and our support team) and the Documents inbox
 * address.
 */
@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BankAccounts,
    CopyButton,
    HlmCardImports,
    InvoiceDetails,
    PeopleCard,
    TaxAnswers,
    TranslocoPipe,
  ],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <h1 class="text-2xl font-semibold">{{ 'settings.title' | transloco }}</h1>

    <app-tax-answers />
    <app-invoice-details />
    <app-bank-accounts />
    <app-people-card />

    <section hlmCard size="sm" data-testid="settings-inbox">
      <header hlmCardHeader>
        <h2 hlmCardTitle>{{ 'settings.inbox.title' | transloco }}</h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-2 text-sm">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p class="min-w-0">
            {{ 'settings.inbox.text' | transloco }}
            <bdi
              dir="ltr"
              class="font-medium select-all [overflow-wrap:anywhere]"
              data-testid="inbox-email"
              >{{ email() }}</bdi
            >
          </p>
          <app-copy-button [text]="email()" />
        </div>
        <p class="text-muted-foreground" data-testid="inbox-sorted">
          {{ 'settings.inbox.sorted' | transloco }}
        </p>
      </div>
    </section>
  `,
})
export class SettingsPage {
  private readonly demo = inject(DemoStateService);

  /** The address the open business forwards its receipts to. */
  protected readonly email = computed(() => this.demo.business().inboxEmail);
}
