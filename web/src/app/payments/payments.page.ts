import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideLandmark, lucideSearchX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { filter as only, map, startWith } from 'rxjs';
import {
  EMPTY_FILTER,
  PaymentFilter,
  filterPayments,
  groupByMonth,
  isFilterActive,
  monthsOf,
} from '../domain/payment-filters';
import { needsYouCount } from '../domain/payment-status';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentFilterChips, PaymentFiltersBar } from './payment-filters-bar';
import { PaymentList } from './payment-list';
import { PaymentTable } from './payment-table';

type EmptyKind = 'new' | 'allClear' | 'noMatch' | null;

/** Whether the address's `month` is a 'YYYY-MM' month. */
const isMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/**
 * Every payment of the open business, newest first, grouped by month, with search and filters. `?month=` and `?account=` start
 * the list on that month and account. A payment opens beside the list (from `lg`) or on its own (below `lg`) through the child route.
 */
@Component({
  selector: 'app-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmButton,
    NgIcon,
    PaymentFilterChips,
    PaymentFiltersBar,
    PaymentList,
    PaymentTable,
    RouterLink,
    RouterOutlet,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideLandmark, lucideSearchX })],
  template: `
    <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section
        class="min-w-0 flex-1 flex-col gap-4"
        data-testid="payments-list"
        [class]="selectedId() ? 'hidden lg:flex' : 'flex'"
      >
        <h1 class="text-2xl font-semibold">{{ 'payments.title' | transloco }}</h1>
        <app-payment-filters-bar
          [(filter)]="filter"
          [accounts]="accounts()"
          [months]="months()"
          [needsYou]="needsYou()"
          [showChips]="empty() !== 'noMatch'"
        />

        @switch (empty()) {
          @case ('new') {
            <div
              class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
              data-testid="empty-new"
            >
              <ng-icon name="lucideLandmark" size="32" class="text-primary" aria-hidden="true" />
              <h2 class="text-lg font-semibold">{{ 'payments.empty.new.title' | transloco }}</h2>
              <p class="text-muted-foreground max-w-sm">
                {{ 'payments.empty.new.body' | transloco }}
              </p>
              <a
                hlmBtn
                data-testid="empty-new-action"
                [routerLink]="['/settings/bank/connect']"
                [queryParams]="{ from: 'payments' }"
              >
                {{ 'payments.empty.new.action' | transloco }}
              </a>
            </div>
          }
          @case ('allClear') {
            <div
              class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
              data-testid="empty-all-clear"
            >
              <ng-icon
                name="lucideCircleCheck"
                size="32"
                class="text-positive"
                aria-hidden="true"
              />
              <h2 class="text-lg font-semibold">
                {{ 'payments.empty.allClear.title' | transloco }}
              </h2>
              <p class="text-muted-foreground">{{ 'payments.empty.allClear.body' | transloco }}</p>
              <button
                hlmBtn
                variant="outline"
                type="button"
                data-testid="show-all"
                (click)="showAll()"
              >
                {{ 'payments.empty.allClear.showAll' | transloco }}
              </button>
            </div>
          }
          @case ('noMatch') {
            <div
              class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
              data-testid="empty-no-match"
            >
              <ng-icon
                name="lucideSearchX"
                size="32"
                class="text-muted-foreground"
                aria-hidden="true"
              />
              <h2 class="text-lg font-semibold">{{ 'payments.empty.noMatch' | transloco }}</h2>
              <app-filter-chips [(filter)]="filter" [accounts]="accounts()" [includeQuick]="true" />
            </div>
          }
          @default {
            <app-payment-list
              [groups]="groups()"
              [selectedId]="selectedId()"
              [panelOpen]="!!selectedId()"
            />
            <app-payment-table
              [groups]="groups()"
              [accounts]="accounts()"
              [selectedId]="selectedId()"
              [panelOpen]="!!selectedId()"
            />
          }
        }
      </section>

      <div
        class="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto"
        data-testid="payments-detail"
        [class.hidden]="!selectedId()"
      >
        <router-outlet />
      </div>
    </div>
  `,
})
export class PaymentsPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /** The filters live here, not in the URL; they start over when another business opens. */
  protected readonly filter = linkedSignal<string, PaymentFilter>({
    source: () => this.demo.business().id,
    computation: () => EMPTY_FILTER,
  });

  /** The `month` in the address (`?month=2026-10`, from the Taxes page), whatever it says; null when there is none. */
  private readonly monthParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('month'))),
    { initialValue: this.route.snapshot.queryParamMap.get('month') },
  );

  /** The `account` in the address (`?account=wd-cash`, from the statement import's summary), whatever it says; null when there is none. */
  private readonly accountParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('account'))),
    { initialValue: this.route.snapshot.queryParamMap.get('account') },
  );

  /** The payment open through the child route, if any. */
  protected readonly selectedId = toSignal(
    this.router.events.pipe(
      only((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot?.paramMap.get('id') ?? null),
    ),
    { initialValue: null },
  );

  protected readonly accounts = computed(() => this.demo.business().accounts);
  private readonly payments = computed(() =>
    this.demo.bankConnected() ? this.demo.business().transactions : [],
  );
  protected readonly months = computed(() => monthsOf(this.payments()));
  protected readonly needsYou = computed(() => needsYouCount(this.payments()));
  private readonly filtered = computed(() => filterPayments(this.payments(), this.filter()));
  protected readonly groups = computed(() => groupByMonth(this.filtered()));

  /** What to show instead of the list: no bank yet, nothing left to do, or no match for the filters. */
  protected readonly empty = computed<EmptyKind>(() => {
    if (!this.demo.bankConnected()) return 'new';
    if (this.filtered().length > 0) return null;
    const f = this.filter();
    const onlyNeedsYou =
      f.quick === 'needsYou' && f.accountId === null && f.month === null && f.search.trim() === '';
    return onlyNeedsYou ? 'allClear' : isFilterActive(f) ? 'noMatch' : null;
  });

  constructor() {
    // The month and the account open the list on that month and account once, and the address is cleaned at once: the
    // filters live here, so a reload or the back button does not set them again. Something that is not a month, and an
    // account the open business does not have, is dropped.
    effect(() => {
      const month = this.monthParam();
      const account = this.accountParam();
      if (month === null && account === null) return;
      untracked(() => {
        if (month !== null && isMonth(month)) this.filter.update((f) => ({ ...f, month }));
        if (account !== null && this.accounts().some((a) => a.id === account)) {
          this.filter.update((f) => ({ ...f, accountId: account }));
        }
      });
      void this.router.navigate([], {
        queryParams: { month: null, account: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    // On a phone a payment is a page of its own: show it from its top, not from where the list or the homepage
    // was scrolled to. From `lg` it is a panel beside the list, which stays where it is (the panel is sticky).
    effect(() => {
      if (this.selectedId() && !this.isComputer()) this.document.documentElement.scrollTop = 0;
    });
  }

  /** Whether the screen is at least Tailwind's `lg` wide (one that matches the `lg:` classes in the template). */
  private isComputer(): boolean {
    return this.document.defaultView?.matchMedia?.('(min-width: 64rem)').matches ?? false;
  }

  protected showAll(): void {
    this.filter.set(EMPTY_FILTER);
  }
}
