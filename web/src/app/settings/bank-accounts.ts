import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBanknote, lucidePlus } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account } from '../data/models';
import {
  bankNameOf,
  connectionStatus,
  maskIban,
  type ConnectionStatus,
} from '../domain/bank-connection';
import { DemoStateService } from '../state/demo-state.service';
import { BankApproval } from './bank-approval';
import { BankTile } from './bank-tile';

/** The colours of a status word: green, amber, red, and grey for the accounts that have no bank connection to look after. */
const TONES: Record<ConnectionStatus['kind'], string> = {
  connected: 'bg-positive/10 text-positive',
  renewSoon: 'bg-warning/10 text-warning',
  signInAgain: 'bg-negative/10 text-negative',
  statement: 'bg-muted text-muted-foreground',
  cash: 'bg-muted text-muted-foreground',
};

/** The button each status has, if any. */
const ACTIONS: Record<ConnectionStatus['kind'], AccountRow['action']> = {
  connected: null,
  renewSoon: 'renew',
  signInAgain: 'signIn',
  statement: 'import',
  cash: null,
};

/** The words for a status, as a translation key under `settings.bank.status` and its parameters. */
function statusWords(status: ConnectionStatus): { key: string; params: { days: number } | null } {
  if (status.kind !== 'renewSoon')
    return { key: `settings.bank.status.${status.kind}`, params: null };
  if (status.daysLeft === 0) return { key: 'settings.bank.status.renewToday', params: null };
  if (status.daysLeft === 1) return { key: 'settings.bank.status.renewInOne', params: null };
  return { key: 'settings.bank.status.renewIn', params: { days: status.daysLeft } };
}

/** What a row of the list shows about one account. */
interface AccountRow {
  account: Account;
  /** The bank behind the account; null for the cash box. */
  bank: string | null;
  status: ConnectionStatus;
  statusKey: string;
  statusParams: { days: number } | null;
  tone: string;
  /** The button of the row: Renew and Sign in again open the sign-in, Import statement leaves for its page; null for none. */
  action: 'renew' | 'signIn' | 'import' | null;
  /** The button's accessible name: its own words and then the account's name, so every Renew says which account. */
  actionLabelledBy: string;
  /** The masked IBAN, or null. */
  iban: string | null;
  /** When the bank was last asked for payments: the demo day or another day, and the time of day. */
  lastFetch: { today: boolean; date: string; time: string } | null;
}

/** The status that needs the bank's sign-in again: its consent ends soon, or has ended or broken. */
const needsSignIn = (status: ConnectionStatus): boolean =>
  status.kind === 'renewSoon' || status.kind === 'signInAgain';

/**
 * Settings › Bank accounts: **Connect a bank**, then one row per money account with its initials tile, bank and
 * product, masked IBAN, last fetch, a status word and the button that goes with it. Renew and Sign in again open the
 * bank's (simulated) sign-in inside the row, one at a time; approving renews the connection and puts the cursor on the
 * row's new status, cancelling closes it and puts the cursor back there. Statement import goes to its coming-soon
 * page. Before the bank step is done the page says so and offers **Connect your bank**, with only the cash box listed.
 */
@Component({
  selector: 'app-bank-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    BankApproval,
    BankTile,
    HlmButton,
    HlmCardImports,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideBanknote, lucidePlus })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="settings-banks">
      <header hlmCardHeader class="grid-cols-[1fr_auto] items-center">
        <h2 hlmCardTitle>{{ 'settings.bank.title' | transloco }}</h2>
        @if (bankDone()) {
          <a
            hlmBtn
            size="sm"
            data-testid="bank-connect"
            [routerLink]="connectPage"
            [queryParams]="{ from: 'settings' }"
          >
            <ng-icon name="lucidePlus" size="16" aria-hidden="true" />
            {{ 'settings.bank.connect' | transloco }}
          </a>
        }
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        @if (!bankDone()) {
          <div class="flex flex-col items-start gap-3">
            <p class="text-muted-foreground text-sm" data-testid="bank-before">
              {{ 'settings.bank.before' | transloco }}
            </p>
            <a
              hlmBtn
              data-testid="bank-connect-first"
              [routerLink]="connectPage"
              [queryParams]="{ from: 'settings' }"
            >
              {{ 'settings.bank.connectFirst' | transloco }}
            </a>
          </div>
        }
        @if (rows().length > 0) {
          <ul class="flex flex-col">
            @for (row of rows(); track row.account.id) {
              <li
                class="border-border border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
                [attr.data-testid]="'bank-row-' + row.account.id"
              >
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                  @if (row.bank; as bank) {
                    <app-bank-tile [name]="bank" />
                  } @else {
                    <span
                      class="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
                      aria-hidden="true"
                    >
                      <ng-icon name="lucideBanknote" size="20" />
                    </span>
                  }
                  <div class="min-w-0 flex-1 basis-44">
                    <p
                      class="font-medium"
                      [id]="'bank-name-' + row.account.id"
                      [attr.data-testid]="'bank-name-' + row.account.id"
                    >
                      @if (row.bank; as bank) {
                        <bdi dir="auto">{{ bank }}</bdi> ·
                      }
                      {{ 'settings.bank.product.' + row.account.product | transloco }}
                    </p>
                    <p
                      class="text-muted-foreground text-xs [overflow-wrap:anywhere]"
                      [attr.data-testid]="'bank-line-' + row.account.id"
                    >
                      @if (row.account.kind === 'cash') {
                        {{ 'settings.bank.cashLine' | transloco }}
                      } @else {
                        @if (row.iban; as iban) {
                          <bdi dir="ltr" [attr.data-testid]="'bank-iban-' + row.account.id">{{
                            iban
                          }}</bdi>
                        }
                        @if (row.lastFetch; as fetched) {
                          ·
                          <span [attr.data-testid]="'bank-fetched-' + row.account.id">
                            {{
                              (fetched.today
                                ? 'settings.bank.lastFetchedToday'
                                : 'settings.bank.lastFetched'
                              ) | transloco: { date: (fetched.date | appDate), time: fetched.time }
                            }}
                          </span>
                        } @else if (row.status.kind === 'statement') {
                          · {{ 'settings.bank.statementLine' | transloco }}
                        }
                      }
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      #status
                      tabindex="-1"
                      class="rounded-full px-2 py-0.5 text-xs font-medium outline-none"
                      [class]="row.tone"
                      [attr.data-account-id]="row.account.id"
                      [attr.data-testid]="'bank-status-' + row.account.id"
                    >
                      {{ row.statusKey | transloco: row.statusParams ?? {} }}
                    </span>
                    @if (row.action === 'import') {
                      <a
                        hlmBtn
                        variant="outline"
                        size="sm"
                        [routerLink]="['/soon', 'statementImport']"
                        [id]="'bank-action-' + row.account.id"
                        [attr.aria-labelledby]="row.actionLabelledBy"
                        [attr.data-testid]="'bank-action-' + row.account.id"
                      >
                        {{ 'settings.bank.action.import' | transloco }}
                      </a>
                    } @else if (row.action; as action) {
                      <button
                        hlmBtn
                        size="sm"
                        type="button"
                        [attr.aria-expanded]="approving() === row.account.id"
                        [id]="'bank-action-' + row.account.id"
                        [attr.aria-labelledby]="row.actionLabelledBy"
                        [attr.data-testid]="'bank-action-' + row.account.id"
                        (click)="open(row.account.id)"
                      >
                        {{ 'settings.bank.action.' + action | transloco }}
                      </button>
                    }
                  </div>
                </div>
                @if (approving() === row.account.id && row.bank; as bank) {
                  <div
                    #approval
                    role="group"
                    tabindex="-1"
                    class="mt-3 outline-none"
                    [attr.data-account-id]="row.account.id"
                    [attr.aria-label]="'bankConnect.approval.title' | transloco: { bank: bank }"
                    [attr.data-testid]="'bank-approval-' + row.account.id"
                  >
                    <app-bank-approval
                      [bankName]="bank"
                      (approved)="approve(row.account.id)"
                      (cancelled)="cancel(row.account.id)"
                    />
                  </div>
                }
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class BankAccounts {
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);
  private readonly statuses = viewChildren<ElementRef<HTMLElement>>('status');
  private readonly approvals = viewChildren<ElementRef<HTMLElement>>('approval');

  protected readonly connectPage = '/settings/bank/connect';

  protected readonly bankDone = computed(() => this.demo.setup().bank);

  /** The rows: every account once the bank step is done, only the cash box before. */
  protected readonly rows = computed<AccountRow[]>(() => {
    const bankDone = this.bankDone();
    return this.demo
      .business()
      .accounts.filter((account) => bankDone || account.kind === 'cash')
      .map((account) => {
        const status = connectionStatus(account);
        const words = statusWords(status);
        const fetched = account.connection.lastFetched;
        return {
          account,
          bank: bankNameOf(account),
          status,
          statusKey: words.key,
          statusParams: words.params,
          tone: TONES[status.kind],
          action: ACTIONS[status.kind],
          actionLabelledBy: `bank-action-${account.id} bank-name-${account.id}`,
          iban: account.iban === null ? null : maskIban(account.iban),
          lastFetch:
            account.connection.kind === 'connected' && fetched !== null
              ? {
                  today: fetched.slice(0, 10) === DEMO_TODAY,
                  date: fetched.slice(0, 10),
                  time: fetched.slice(11, 16),
                }
              : null,
        };
      });
  });

  /**
   * The account whose sign-in is open. It belongs to the business and the data it was opened for: another business, or
   * a reset, closes it.
   */
  private readonly openId = linkedSignal<string, string | null>({
    source: () => `${this.demo.business().id}|${this.demo.dataGeneration()}`,
    computation: () => null,
  });
  /** The open sign-in, as long as its account still needs one (it closes by itself once the connection is renewed). */
  protected readonly approving = computed(() => {
    const id = this.openId();
    return this.rows().some((row) => row.account.id === id && needsSignIn(row.status)) ? id : null;
  });

  /** The sign-in opens in the row, with the cursor on it. */
  protected open(accountId: string): void {
    this.openId.set(accountId);
    this.focusLater(this.approvals, accountId);
  }

  /** Approve: the connection is renewed (once, however often it is tapped) and the cursor goes to the row's status. */
  protected approve(accountId: string): void {
    this.demo.renewConnection(accountId);
    this.openId.set(null);
    this.focusLater(this.statuses, accountId);
  }

  /** Cancel: nothing changes, the sign-in closes and the cursor goes back to the row's status. */
  protected cancel(accountId: string): void {
    this.openId.set(null);
    this.focusLater(this.statuses, accountId);
  }

  /** Puts the cursor on the element of that account once the page has been drawn again. */
  private focusLater(elements: () => readonly ElementRef<HTMLElement>[], accountId: string): void {
    afterNextRender(
      () =>
        elements()
          .find((ref) => ref.nativeElement.dataset['accountId'] === accountId)
          ?.nativeElement.focus(),
      { injector: this.injector },
    );
  }
}
