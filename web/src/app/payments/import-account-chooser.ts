import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucidePlus } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { bankNameOf, maskIban } from '../domain/bank-connection';
import { BankTile } from '../settings/bank-tile';
import type { From } from '../settings/opened-from';
import { DemoStateService } from '../state/demo-state.service';

const ROW_CLASS =
  'border-border bg-card hover:bg-muted flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-start';

/**
 * "Which account is it for?": the accounts that take a statement, then **A new account…**. Statement accounts come first (their
 * payments only come from statements), then the connected ones, which take older months than the bank connection fetched. The cash box
 * has no statement. A connected account only counts once the bank step is done, as in Settings; a statement account always does.
 * Each is a link into the import for that account, remembering where the person came from.
 */
@Component({
  selector: 'app-import-account-chooser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BankTile, NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronRight, lucidePlus })],
  host: { class: 'flex flex-col gap-3', 'data-testid': 'chooser' },
  template: `
    <h2 class="text-lg font-semibold" data-testid="chooser-title">
      {{ 'statementImport.chooser.title' | transloco }}
    </h2>
    <ul class="flex flex-col gap-2">
      @for (row of rows(); track row.id) {
        <li data-testid="chooser-row" [attr.data-account]="row.id">
          <a
            [class]="rowClass"
            routerLink="/payments/import"
            [queryParams]="{ account: row.id, from: from() }"
            [attr.data-testid]="'choose-' + row.id"
          >
            <app-bank-tile [name]="row.bank" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-medium">
                <bdi dir="auto">{{ row.bank }}</bdi> ·
                {{ 'settings.bank.product.' + row.product | transloco }}
              </span>
              <span class="text-muted-foreground text-xs">
                @if (row.iban; as iban) {
                  <bdi dir="ltr" data-testid="chooser-iban">{{ iban }}</bdi> ·
                }
                {{ 'statementImport.chooser.' + row.how | transloco }}
              </span>
            </span>
            <ng-icon
              name="lucideChevronRight"
              size="16"
              class="text-muted-foreground shrink-0 rtl:rotate-180"
              aria-hidden="true"
            />
          </a>
        </li>
      }
      <li>
        <a
          [class]="rowClass"
          routerLink="/payments/import"
          [queryParams]="{ new: 1, from: from() }"
          data-testid="choose-new"
        >
          <ng-icon
            name="lucidePlus"
            size="20"
            class="text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="font-medium">{{ 'statementImport.chooser.new' | transloco }}</span>
            <span class="text-muted-foreground text-xs">{{
              'statementImport.chooser.newBody' | transloco
            }}</span>
          </span>
          <ng-icon
            name="lucideChevronRight"
            size="16"
            class="text-muted-foreground shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
        </a>
      </li>
    </ul>
  `,
})
export class ImportAccountChooser {
  private readonly demo = inject(DemoStateService);

  /** The page the person came from, so the import leads back to it. */
  readonly from = input.required<From>();

  protected readonly rowClass = ROW_CLASS;

  protected readonly rows = computed(() => {
    const bankDone = this.demo.setup().bank;
    const rows = this.demo
      .business()
      .accounts.filter(
        (account) =>
          account.kind !== 'cash' && (bankDone || account.connection.kind === 'statement'),
      )
      .map((account) => ({
        id: account.id,
        bank: bankNameOf(account) ?? account.name,
        product: account.product,
        iban: account.iban === null ? null : maskIban(account.iban),
        how:
          account.connection.kind === 'statement' ? ('statement' as const) : ('connected' as const),
      }));
    return [
      ...rows.filter((row) => row.how === 'statement'),
      ...rows.filter((row) => row.how === 'connected'),
    ];
  });
}
