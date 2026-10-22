import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
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
import { setupSteps } from '../domain/home-cards';
import { needsYouCount } from '../domain/payment-status';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentFilterChips, PaymentFiltersBar } from './payment-filters-bar';
import { PaymentList } from './payment-list';
import { PaymentTable } from './payment-table';

type EmptyKind = 'new' | 'allClear' | 'noMatch' | null;

/**
 * Every payment of the open business, newest first, grouped by month, with search and filters.
 * A payment opens beside the list (from `lg`) or on its own (below `lg`) through the child route.
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
              <a hlmBtn data-testid="empty-new-action" [routerLink]="['/soon', 'bank']">
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
        class="min-w-0 lg:w-[26rem] lg:shrink-0"
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

  /** The filters live here, not in the URL; they start over when another business opens. */
  protected readonly filter = linkedSignal<string, PaymentFilter>({
    source: () => this.demo.business().id,
    computation: () => EMPTY_FILTER,
  });

  /** The payment open through the child route, if any. */
  protected readonly selectedId = toSignal(
    this.router.events.pipe(
      only((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot?.paramMap.get('id') ?? null),
    ),
    { initialValue: null },
  );

  private readonly connected = computed(() => setupSteps(this.demo.setup()).bank);
  protected readonly accounts = computed(() => this.demo.business().accounts);
  private readonly payments = computed(() =>
    this.connected() ? this.demo.business().transactions : [],
  );
  protected readonly months = computed(() => monthsOf(this.payments()));
  protected readonly needsYou = computed(() => needsYouCount(this.payments()));
  private readonly filtered = computed(() => filterPayments(this.payments(), this.filter()));
  protected readonly groups = computed(() => groupByMonth(this.filtered()));

  /** What to show instead of the list: no bank yet, nothing left to do, or no match for the filters. */
  protected readonly empty = computed<EmptyKind>(() => {
    if (!this.connected()) return 'new';
    if (this.filtered().length > 0) return null;
    const f = this.filter();
    const onlyNeedsYou =
      f.quick === 'needsYou' && f.accountId === null && f.month === null && f.search.trim() === '';
    return onlyNeedsYou ? 'allClear' : isFilterActive(f) ? 'noMatch' : null;
  });

  protected showAll(): void {
    this.filter.set(EMPTY_FILTER);
  }
}
