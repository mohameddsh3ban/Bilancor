import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBanknote,
  lucideCheck,
  lucideChevronRight,
  lucideFileUp,
  lucideLoaderCircle,
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { BANKS, banksOf, foundAccountsOf } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import { connectionStatus, isAlreadyConnected, maskIban } from '../domain/bank-connection';
import { DemoStateService } from '../state/demo-state.service';
import { BankApproval } from './bank-approval';
import { BankTile } from './bank-tile';
import { ChoiceCard } from './form-parts';
import { BACK_URLS, openedFrom } from './opened-from';

/** How long "Fetching payments…" shows before the accounts are connected. */
export const FETCH_MS = 2000;

/** The screens of the flow, in order; the step is page state, not a route. */
type Step = 'pick' | 'see' | 'approve' | 'choose' | 'fetching';

/** The dates "Fetch payments from" offers: 1 January this year, 1 January last year, and the demo day. */
const FETCH_OPTIONS = (() => {
  const year = Number(DEMO_TODAY.slice(0, 4));
  return [
    { id: 'thisYear', date: `${year}-01-01` },
    { id: 'lastYear', date: `${year - 1}-01-01` },
    { id: 'today', date: DEMO_TODAY },
  ] as const;
})();

const ROW_CLASS =
  'border-border bg-card hover:bg-muted flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-start';

/**
 * "Connect your bank" (`/settings/bank/connect`): pick the bank, what we can see, the simulated sign-in, choose the
 * accounts; then "Fetching payments…" for `FETCH_MS`, the accounts are connected and the page goes back to where it
 * was opened from (`?from=home`, `payments` or `settings`, the default). There is no bank behind it. The flow belongs
 * to the business that was open and the data as it was when it started: when another business opens or the demo is
 * reset, it starts again at the first screen and nothing is connected. Leaving the page during the fetch connects
 * nothing either.
 */
@Component({
  selector: 'app-connect-bank-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    BankApproval,
    BankTile,
    ChoiceCard,
    HlmButton,
    HlmCardImports,
    MoneyPipe,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideBanknote,
      lucideCheck,
      lucideChevronRight,
      lucideFileUp,
      lucideLoaderCircle,
      lucideSearch,
      lucideX,
    }),
  ],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    @if (step() !== 'fetching') {
      <a
        class="text-primary inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium"
        data-testid="back-link"
        [routerLink]="backUrl()"
      >
        <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
        {{ 'bankConnect.back.' + from() | transloco }}
      </a>
    }

    <div class="flex flex-col gap-4" data-testid="flow" [attr.data-step]="step()">
      @switch (step()) {
        @case ('pick') {
          <header class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold outline-none" tabindex="-1" data-testid="step-title">
              {{ 'bankConnect.pick.title' | transloco }}
            </h1>
            <p class="text-muted-foreground text-sm">{{ 'bankConnect.pick.intro' | transloco }}</p>
          </header>

          <div class="relative">
            <ng-icon
              name="lucideSearch"
              size="16"
              class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              autocomplete="off"
              class="border-input bg-background placeholder:text-muted-foreground h-11 w-full rounded-md border ps-9 pe-3 text-sm"
              data-testid="bank-search"
              [value]="search()"
              [attr.aria-label]="'bankConnect.pick.search' | transloco"
              [placeholder]="'bankConnect.pick.search' | transloco"
              (input)="setSearch($event)"
            />
          </div>

          @if (shownBanks().length > 0) {
            <ul
              class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
              [attr.aria-label]="'bankConnect.pick.banks' | transloco"
            >
              @for (bank of shownBanks(); track bank.id) {
                <li class="min-w-0">
                  <button
                    type="button"
                    class="border-border bg-card hover:bg-muted flex min-h-24 w-full min-w-0 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium"
                    [attr.data-testid]="'bank-' + bank.id"
                    (click)="pickBank(bank.id)"
                  >
                    <app-bank-tile [name]="bank.name" />
                    <span class="min-w-0 text-center [overflow-wrap:anywhere]">
                      <bdi dir="auto">{{ bank.name }}</bdi>
                    </span>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="text-muted-foreground text-sm" role="status" data-testid="no-banks">
              {{ 'bankConnect.pick.noMatch' | transloco: { search: search().trim() } }}
            </p>
          }

          <ul class="flex flex-col gap-2">
            <li>
              <a
                [class]="rowClass"
                data-testid="not-listed"
                routerLink="/payments/import"
                [queryParams]="{ new: 1, from: from() }"
              >
                <ng-icon name="lucideFileUp" size="20" class="text-muted-foreground shrink-0" aria-hidden="true" />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="font-medium">{{ 'bankConnect.pick.notListed.title' | transloco }}</span>
                  <span class="text-muted-foreground text-xs">{{
                    'bankConnect.pick.notListed.body' | transloco
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
            @if (!hasCashBox()) {
              <li>
                <button type="button" [class]="rowClass" data-testid="add-cash" (click)="addCash()">
                  <ng-icon name="lucideBanknote" size="20" class="text-muted-foreground shrink-0" aria-hidden="true" />
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="font-medium">{{ 'bankConnect.pick.cash.title' | transloco }}</span>
                    <span class="text-muted-foreground text-xs">{{
                      'bankConnect.pick.cash.body' | transloco
                    }}</span>
                  </span>
                  <ng-icon
                    name="lucideChevronRight"
                    size="16"
                    class="text-muted-foreground shrink-0 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </button>
              </li>
            }
          </ul>
        }

        @case ('see') {
          <header class="flex items-center gap-3">
            <app-bank-tile [name]="bankName()" />
            <h1 class="text-2xl font-semibold outline-none" tabindex="-1" data-testid="step-title">
              {{ 'bankConnect.see.title' | transloco: { bank: bankName() } }}
            </h1>
          </header>

          <section hlmCard size="sm" data-testid="can-list">
            <header hlmCardHeader>
              <h2 hlmCardTitle>{{ 'bankConnect.see.can' | transloco }}</h2>
            </header>
            <ul hlmCardContent class="flex flex-col gap-2 text-sm">
              @for (key of canKeys; track key) {
                <li class="flex items-start gap-2">
                  <ng-icon name="lucideCheck" size="18" class="text-positive mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{{ 'bankConnect.see.' + key | transloco }}</span>
                </li>
              }
            </ul>
          </section>

          <section hlmCard size="sm" data-testid="cannot-list">
            <header hlmCardHeader>
              <h2 hlmCardTitle>{{ 'bankConnect.see.cannot' | transloco }}</h2>
            </header>
            <ul hlmCardContent class="flex flex-col gap-2 text-sm">
              @for (key of cannotKeys; track key) {
                <li class="flex items-start gap-2">
                  <ng-icon name="lucideX" size="18" class="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{{ 'bankConnect.see.' + key | transloco }}</span>
                </li>
              }
            </ul>
          </section>

          <p class="text-muted-foreground text-sm" data-testid="sign-in-note">
            {{ 'bankConnect.see.signIn' | transloco: { bank: bankName() } }}
          </p>

          <div class="flex flex-col gap-2 sm:flex-row">
            <button hlmBtn size="lg" type="button" data-testid="continue" (click)="go('approve')">
              {{ 'bankConnect.see.continue' | transloco: { bank: bankName() } }}
            </button>
            <button hlmBtn variant="ghost" size="lg" type="button" data-testid="other-bank" (click)="go('pick')">
              {{ 'bankConnect.see.other' | transloco }}
            </button>
          </div>
        }

        @case ('approve') {
          <h1 class="text-2xl font-semibold outline-none" tabindex="-1" data-testid="step-title">
            {{ 'bankConnect.approval.title' | transloco: { bank: bankName() } }}
          </h1>
          <app-bank-approval
            [bankName]="bankName()"
            [note]="isOtherBank() ? ('bankConnect.approval.note' | transloco: { sample: accountsBankName() }) : null"
            (approved)="go('choose')"
            (cancelled)="go('pick')"
          />
        }

        @case ('choose') {
          <header class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold outline-none" tabindex="-1" data-testid="step-title">
              {{ 'bankConnect.choose.title' | transloco }}
            </h1>
            <p class="text-muted-foreground text-sm" data-testid="private-hint">
              {{ 'bankConnect.choose.hint' | transloco }}
            </p>
          </header>

          <fieldset class="flex min-w-0 flex-col gap-2">
            <legend class="sr-only">{{ 'bankConnect.choose.accounts' | transloco: { bank: accountsBankName() } }}</legend>
            <ul class="flex flex-col gap-2">
              @for (row of rows(); track row.account.id) {
                <li [attr.data-testid]="'account-' + row.account.id">
                  <label [class]="rowClass + (row.already ? ' opacity-70' : ' cursor-pointer')">
                    <input
                      type="checkbox"
                      class="accent-primary size-5 shrink-0"
                      [checked]="row.ticked"
                      [disabled]="row.already"
                      (change)="toggle(row.account.id)"
                    />
                    <app-bank-tile [name]="accountsBankName()" />
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="font-medium">{{ 'settings.bank.product.' + row.account.product | transloco }}</span>
                      <span class="text-muted-foreground text-xs">
                        <bdi dir="auto">{{ accountsBankName() }}</bdi>
                        @if (row.account.iban; as iban) {
                          · <bdi dir="ltr">{{ mask(iban) }}</bdi>
                        }
                      </span>
                      @if (row.ended) {
                        <a
                          class="text-primary text-xs font-medium underline underline-offset-4"
                          data-testid="ended-link"
                          routerLink="/settings"
                          fragment="bank-accounts"
                          >{{ 'bankConnect.choose.ended' | transloco }}</a
                        >
                      } @else if (row.already) {
                        <span class="text-muted-foreground text-xs font-medium">{{
                          'bankConnect.choose.already' | transloco
                        }}</span>
                      }
                    </span>
                    <bdi dir="ltr" class="shrink-0 font-medium">{{ row.account.balanceCents | money }}</bdi>
                  </label>
                </li>
              }
            </ul>
          </fieldset>

          @if (needsFetchFrom()) {
            <fieldset class="flex flex-col gap-2" data-testid="fetch-from">
              <legend class="mb-1 text-sm font-medium">{{ 'bankConnect.choose.fetchFrom' | transloco }}</legend>
              @for (option of fetchOptions; track option.id) {
                <app-choice-card
                  name="fetch-from"
                  [attr.data-testid]="'fetch-' + option.id"
                  [checked]="fetchFrom() === option.date"
                  [hint]="option.date | appDate: { year: true }"
                  (changed)="fetchFrom.set(option.date)"
                >
                  {{ 'bankConnect.choose.' + option.id | transloco }}
                </app-choice-card>
              }
            </fieldset>
          }

          <div class="flex flex-col gap-2">
            <button
              hlmBtn
              size="lg"
              type="button"
              data-testid="connect"
              [disabled]="count() === 0"
              (click)="connect()"
            >
              {{ connectLabel() | transloco: { count: count() } }}
            </button>
            @switch (noneReason()) {
              @case ('tickOne') {
                <p class="text-muted-foreground text-sm" data-testid="tick-one">
                  {{ 'bankConnect.choose.tickOne' | transloco }}
                </p>
              }
              @case ('allConnected') {
                <p class="text-muted-foreground text-sm" data-testid="all-connected">
                  {{ 'bankConnect.choose.allConnected' | transloco }}
                </p>
              }
            }
            <button hlmBtn variant="ghost" size="lg" type="button" data-testid="other-bank" (click)="go('pick')">
              {{ 'bankConnect.choose.other' | transloco }}
            </button>
          </div>
        }

        @case ('fetching') {
          <div
            class="flex flex-col items-center gap-3 py-16 text-center"
            role="status"
            data-testid="fetching"
          >
            <ng-icon
              name="lucideLoaderCircle"
              size="36"
              class="text-primary motion-safe:animate-spin"
              aria-hidden="true"
            />
            <h1 class="text-xl font-semibold outline-none" tabindex="-1" data-testid="step-title">
              {{ 'bankConnect.fetching.title' | transloco }}
            </h1>
            <p class="text-muted-foreground">{{ 'bankConnect.fetching.body' | transloco }}</p>
          </div>
        }
      }
    </div>
  `,
})
export class ConnectBankPage {
  private readonly demo = inject(DemoStateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rowClass = ROW_CLASS;
  protected readonly fetchOptions = FETCH_OPTIONS;
  protected readonly canKeys = ['canPayments', 'canFetch'] as const;
  protected readonly cannotKeys = ['cannotMove', 'cannotPassword'] as const;
  protected readonly mask = maskIban;

  /** Where the page was opened from: the homepage's setup step, Payments, or Settings (also when nothing is said). */
  protected readonly from = openedFrom(['home', 'payments', 'settings']);
  protected readonly backUrl = computed(() => BACK_URLS[this.from()]);

  /** What the flow was started for. Everything below belongs to it and starts over when it changes. */
  private readonly flowKey = computed(() => `${this.demo.business().id}|${this.demo.dataGeneration()}`);
  protected readonly step = linkedSignal<string, Step>({ source: this.flowKey, computation: () => 'pick' });
  private readonly bankId = linkedSignal<string, string | null>({ source: this.flowKey, computation: () => null });
  protected readonly search = linkedSignal<string, string>({ source: this.flowKey, computation: () => '' });
  /** The ids of the accounts that are ticked. */
  protected readonly chosen = linkedSignal<string, ReadonlySet<string>>({
    source: this.flowKey,
    computation: () => new Set<string>(),
  });
  protected readonly fetchFrom = linkedSignal<string, string>({
    source: this.flowKey,
    computation: () => FETCH_OPTIONS[0].date,
  });
  /** Set from Connect until the accounts are connected: the one connection that is under way. A restart drops it. */
  private readonly connecting = linkedSignal<string, object | null>({ source: this.flowKey, computation: () => null });
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly shownBanks = computed(() => {
    const wanted = this.search().trim().toLowerCase();
    return BANKS.filter((bank) => bank.name.toLowerCase().includes(wanted));
  });
  protected readonly hasCashBox = computed(() => this.demo.business().accounts.some((a) => a.kind === 'cash'));

  protected readonly bankName = computed(() => BANKS.find((bank) => bank.id === this.bankId())?.name ?? '');
  /**
   * The bank whose accounts the demo finds: the one picked when the business banks there, else its first bank. A business
   * made during the visit banks anywhere, so it is always the one picked.
   */
  private readonly accountsBank = computed(() => {
    const own = banksOf(this.demo.business().id);
    const picked = this.bankId();
    const id = own === null || (picked !== null && own.includes(picked)) ? picked : own[0];
    return BANKS.find((bank) => bank.id === id);
  });
  protected readonly accountsBankName = computed(() => this.accountsBank()?.name ?? '');
  protected readonly isOtherBank = computed(() => this.accountsBank()?.id !== this.bankId());

  /**
   * The accounts the demo finds, as the business has them now, with whether each is connected already (then it cannot
   * be ticked or unticked: a working connection shows ticked, one that has ended or broken shows unticked and says so,
   * as Settings looks after it) and whether it is ticked.
   */
  protected readonly rows = computed(() => {
    const bank = this.accountsBank();
    const found = bank ? foundAccountsOf(this.demo.business().id, bank.id) : [];
    const have = this.demo.business().accounts;
    const bankDone = this.demo.setup().bank;
    const chosen = this.chosen();
    return found.map((account) => {
      const current = have.find((a) => a.id === account.id);
      const already = isAlreadyConnected(current, bankDone);
      const ended = already && current !== undefined && connectionStatus(current).kind === 'signInAgain';
      return {
        account: current ?? account,
        already,
        ended,
        ticked: already ? !ended : chosen.has(account.id),
      };
    });
  });
  /** The accounts this tap would connect: the ticked ones that are not connected already. */
  protected readonly count = computed(() => this.rows().filter((row) => row.ticked && !row.already).length);
  /** The date is for accounts that are being connected now, not for ones that are connected already. */
  protected readonly needsFetchFrom = computed(() => this.count() > 0);
  /**
   * Why Connect cannot be tapped: an account is left to tick, or every account is connected already. Nothing is said
   * when the only accounts left have ended, as their rows say what to do.
   */
  protected readonly noneReason = computed<'tickOne' | 'allConnected' | null>(() => {
    if (this.count() > 0) return null;
    const rows = this.rows();
    if (rows.some((row) => !row.already)) return 'tickOne';
    return rows.some((row) => row.ended) ? null : 'allConnected';
  });
  protected readonly connectLabel = computed(() => {
    const count = this.count();
    return count === 0 ? 'bankConnect.choose.connectNone' : `bankConnect.choose.connect${count === 1 ? 'One' : 'Many'}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected pickBank(id: string): void {
    this.bankId.set(id);
    this.go('see');
  }

  /** Shows another screen with the cursor on its heading. The accounts screen starts with the business account ticked. */
  protected go(step: Step): void {
    if (step === 'pick') {
      this.bankId.set(null);
      this.search.set('');
    }
    if (step === 'choose') {
      this.chosen.set(
        new Set(this.rows().filter((row) => row.account.product === 'business').map((row) => row.account.id)),
      );
    }
    this.step.set(step);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[data-testid="step-title"]')?.focus(), {
      injector: this.injector,
    });
  }

  protected toggle(accountId: string): void {
    if (this.rows().some((row) => row.account.id === accountId && row.already)) return;
    this.chosen.update((chosen) => {
      const next = new Set(chosen);
      if (!next.delete(accountId)) next.add(accountId);
      return next;
    });
  }

  /** I also take cash: a cash box, no bank flow, then Settings, where the new box shows, whatever page this one was opened from. */
  protected addCash(): void {
    this.demo.addCashBox();
    void this.router.navigateByUrl(BACK_URLS.settings, { replaceUrl: true });
  }

  /**
   * Connect N accounts: "Fetching payments…" for `FETCH_MS`, then the accounts are connected and the page goes back.
   * A second tap while it is under way does nothing. The result is dropped when the business or the data it was started
   * for is gone by then (see the class comment).
   */
  protected connect(): void {
    const accounts = this.rows()
      .filter((row) => row.ticked && !row.already)
      .map((row) => row.account);
    const bank = this.accountsBank();
    if (accounts.length === 0 || bank === undefined || this.connecting() !== null) return;

    const attempt = {};
    const businessId = this.demo.business().id;
    const generation = this.demo.dataGeneration();
    const fetchFrom = this.fetchFrom();
    const back = this.backUrl();
    this.connecting.set(attempt);
    this.go('fetching');
    this.timer = setTimeout(() => {
      const sameFlow =
        this.connecting() === attempt &&
        this.demo.business().id === businessId &&
        this.demo.dataGeneration() === generation;
      if (!sameFlow) return;
      this.demo.connectAccounts(bank.id, accounts, fetchFrom);
      void this.router.navigateByUrl(back, { replaceUrl: true });
    }, FETCH_MS);
  }
}
