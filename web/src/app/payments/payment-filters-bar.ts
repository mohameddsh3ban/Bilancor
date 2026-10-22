import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideSearch, lucideX } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppMonthPipe } from '../core/format/month.pipe';
import { Account } from '../data/models';
import {
  EMPTY_FILTER,
  PaymentFilter,
  QuickFilter,
  isFilterActive,
} from '../domain/payment-filters';

type ChipId = 'quick' | 'account' | 'month' | 'search';

/**
 * The filters that are on, each as a chip with a remove button, plus "Clear all".
 * `includeQuick` adds the quick filter as a chip (the filter bar shows it as a pressed button instead).
 */
@Component({
  selector: 'app-filter-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppMonthPipe, NgIcon, NgTemplateOutlet, TranslocoPipe],
  viewProviders: [provideIcons({ lucideX })],
  host: { class: 'block' },
  template: `
    @if (anyActive()) {
      <ul class="flex flex-wrap items-center gap-2">
        @if (includeQuick() && filter().quick !== 'all') {
          <ng-container
            [ngTemplateOutlet]="chip"
            [ngTemplateOutletContext]="{
              id: 'quick',
              label: ('payments.quick.' + filter().quick | transloco),
            }"
          />
        }
        @if (account(); as acc) {
          <ng-container
            [ngTemplateOutlet]="chip"
            [ngTemplateOutletContext]="{
              id: 'account',
              label: acc.kind === 'cash' ? ('account.cash' | transloco) : acc.name,
            }"
          />
        }
        @if (filter().month; as month) {
          <ng-container
            [ngTemplateOutlet]="chip"
            [ngTemplateOutletContext]="{ id: 'month', label: (month | appMonth) }"
          />
        }
        @if (filter().search.trim(); as text) {
          <ng-container
            [ngTemplateOutlet]="chip"
            [ngTemplateOutletContext]="{
              id: 'search',
              label: ('payments.chip.search' | transloco: { text }),
            }"
          />
        }
        <li>
          <button
            type="button"
            class="text-primary text-sm font-medium underline-offset-4 hover:underline"
            data-testid="clear-all"
            (click)="clearAll()"
          >
            {{ 'payments.clearAll' | transloco }}
          </button>
        </li>
      </ul>
    }
    <ng-template #chip let-id="id" let-label="label">
      <li
        class="bg-muted flex max-w-full items-center gap-1 rounded-full ps-3 pe-1 text-sm"
        [attr.data-testid]="'chip-' + id"
      >
        <span class="min-w-0 truncate" dir="auto">{{ label }}</span>
        <button
          type="button"
          class="hover:bg-border flex size-6 shrink-0 items-center justify-center rounded-full"
          [attr.data-testid]="'chip-' + id + '-remove'"
          [attr.aria-label]="'payments.chip.remove' | transloco: { name: label }"
          (click)="remove(id)"
        >
          <ng-icon name="lucideX" size="14" aria-hidden="true" />
        </button>
      </li>
    </ng-template>
  `,
})
export class PaymentFilterChips {
  readonly filter = model.required<PaymentFilter>();
  readonly accounts = input.required<readonly Account[]>();
  readonly includeQuick = input(false);

  protected readonly anyActive = computed(() => isFilterActive(this.filter()));
  protected readonly account = computed(() => {
    const id = this.filter().accountId;
    return id === null ? null : (this.accounts().find((a) => a.id === id) ?? null);
  });

  protected remove(id: ChipId): void {
    this.filter.update((f) => {
      switch (id) {
        case 'quick':
          return { ...f, quick: 'all' };
        case 'account':
          return { ...f, accountId: null };
        case 'month':
          return { ...f, month: null };
        case 'search':
          return { ...f, search: '' };
      }
    });
  }

  protected clearAll(): void {
    this.filter.set(EMPTY_FILTER);
  }
}

const QUICK_FILTERS: readonly QuickFilter[] = ['all', 'needsYou', 'in', 'out'];

/**
 * Search, quick filters, account and month selects, and the chips of what is on.
 * On a computer a "Download month" link opens the print view of the filtered month (or the newest one).
 */
@Component({
  selector: 'app-payment-filters-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, PaymentFilterChips, RouterLink, TranslocoPipe, AppMonthPipe],
  viewProviders: [provideIcons({ lucideDownload, lucideSearch })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="flex items-center gap-2">
      <div class="relative min-w-0 flex-1">
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
          [value]="filter().search"
          [attr.aria-label]="'payments.search.label' | transloco"
          [placeholder]="'payments.search.placeholder' | transloco"
          (input)="setSearch($event)"
        />
      </div>
      @if (downloadLink(); as link) {
        <a
          hlmBtn
          variant="outline"
          class="hidden shrink-0 lg:inline-flex"
          data-testid="download-month"
          [routerLink]="link.path"
          [queryParams]="link.query"
        >
          <ng-icon name="lucideDownload" size="16" aria-hidden="true" />
          {{ 'payments.download' | transloco }}
        </a>
      }
    </div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div
        role="group"
        class="border-border bg-card flex max-w-full overflow-hidden rounded-md border text-sm"
        [attr.aria-label]="'payments.quick.label' | transloco"
      >
        @for (quick of quickFilters; track quick) {
          <button
            type="button"
            class="border-border flex min-w-0 items-center gap-1.5 border-s px-3 py-2 whitespace-nowrap first:border-s-0"
            [class]="
              filter().quick === quick
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted'
            "
            [attr.data-testid]="'quick-' + quick"
            [attr.aria-pressed]="filter().quick === quick"
            (click)="setQuick(quick)"
          >
            {{ 'payments.quick.' + quick | transloco }}
            @if (quick === 'needsYou') {
              <span
                class="rounded-full px-1.5 text-xs font-medium"
                data-testid="needs-you-count"
                [class]="
                  filter().quick === 'needsYou'
                    ? 'bg-primary-foreground/20'
                    : needsYou() > 0
                      ? 'bg-warning/10 text-warning'
                      : 'bg-muted'
                "
              >
                {{ needsYou() }}
              </span>
            }
          </button>
        }
      </div>
      @if (needsYou() > 0) {
        <a hlmBtn size="sm" data-testid="needs-you-start" routerLink="/review">
          {{ 'home.decisions.start' | transloco }}
        </a>
      }
    </div>

    <div class="flex flex-wrap gap-2">
      <select
        class="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
        data-testid="filter-account"
        [attr.aria-label]="'payments.account.label' | transloco"
        (change)="setAccount($event)"
      >
        <option value="" [selected]="filter().accountId === null">
          {{ 'payments.account.all' | transloco }}
        </option>
        @for (account of accounts(); track account.id) {
          <option [value]="account.id" [selected]="filter().accountId === account.id">
            {{ account.kind === 'cash' ? ('account.cash' | transloco) : account.name }}
          </option>
        }
      </select>
      <select
        class="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
        data-testid="filter-month"
        [attr.aria-label]="'payments.month.label' | transloco"
        (change)="setMonth($event)"
      >
        <option value="" [selected]="filter().month === null">
          {{ 'payments.month.all' | transloco }}
        </option>
        @for (month of months(); track month) {
          <option [value]="month" [selected]="filter().month === month">
            {{ month | appMonth }}
          </option>
        }
      </select>
    </div>

    @if (showChips()) {
      <app-filter-chips [(filter)]="filter" [accounts]="accounts()" />
    }
  `,
})
export class PaymentFiltersBar {
  readonly filter = model.required<PaymentFilter>();
  readonly accounts = input.required<readonly Account[]>();
  /** Months with payments, newest first. */
  readonly months = input.required<readonly string[]>();
  readonly needsYou = input.required<number>();
  /** Off while the empty state shows the chips itself. */
  readonly showChips = input(true);

  protected readonly quickFilters = QUICK_FILTERS;

  /** The print view of the filtered month (the newest one when no month is set); none without payments. */
  protected readonly downloadLink = computed(() => {
    const month = this.filter().month ?? this.months()[0];
    if (!month) return null;
    const accountId = this.filter().accountId;
    return {
      path: '/print/month',
      query: accountId === null ? { month } : { month, account: accountId },
    };
  });

  protected setQuick(quick: QuickFilter): void {
    this.filter.update((f) => ({ ...f, quick }));
  }

  protected setSearch(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.filter.update((f) => ({ ...f, search }));
  }

  protected setAccount(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filter.update((f) => ({ ...f, accountId: value === '' ? null : value }));
  }

  protected setMonth(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filter.update((f) => ({ ...f, month: value === '' ? null : value }));
  }
}
