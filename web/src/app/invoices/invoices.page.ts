import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideReceipt, lucideSearchX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { map } from 'rxjs';
import { invoiceRows } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { INVOICE_FILTERS, filterFrom, matchesFilter, type InvoiceFilter } from './invoice-filter';
import { InvoiceListRow, rowKey } from './invoice-row';
import { OwedCard } from './owed-card';

/** The chips that show how many invoices are behind them. */
const COUNTED: readonly InvoiceFilter[] = ['overdue', 'drafts'];

/**
 * Invoices (`/invoices`): what customers owe on top, quick filters (`?filter=open|overdue|drafts|paid`, All when there is
 * none), then one row for every invoice the business has written or added from a file, in the order of `invoiceRows`:
 * drafts, overdue, open, then the rest. A late invoice carries its reminder button right on the row.
 */
@Component({
  selector: 'app-invoices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, InvoiceListRow, NgIcon, OwedCard, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucidePlus, lucideReceipt, lucideSearchX })],
  host: { class: 'block' },
  template: `
    <div class="flex max-w-3xl flex-col gap-4" data-testid="invoices-page">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">{{ 'invoices.title' | transloco }}</h1>
        <a hlmBtn data-testid="new-invoice" routerLink="/invoices/new">
          <ng-icon name="lucidePlus" size="16" aria-hidden="true" />
          {{ 'invoices.new' | transloco }}
        </a>
      </div>

      <app-owed-card />

      @if (rows().length === 0) {
        <div
          class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center"
          data-testid="empty-none"
        >
          <ng-icon name="lucideReceipt" size="32" class="text-primary" aria-hidden="true" />
          <h2 class="text-lg font-semibold">{{ 'invoices.empty.none.title' | transloco }}</h2>
          <p class="text-muted-foreground max-w-sm">{{ 'invoices.empty.none.body' | transloco }}</p>
          <a hlmBtn data-testid="empty-new-invoice" routerLink="/invoices/new">
            {{ 'invoices.new' | transloco }}
          </a>
        </div>
      } @else {
        <nav
          class="flex flex-wrap gap-2"
          data-testid="invoice-filters"
          [attr.aria-label]="'invoices.filter.label' | transloco"
        >
          @for (name of filters; track name) {
            <a
              class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium"
              routerLink="/invoices"
              [replaceUrl]="true"
              [queryParams]="name === 'all' ? {} : { filter: name }"
              [class]="
                filter() === name
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted'
              "
              [attr.aria-current]="filter() === name ? 'true' : null"
              [attr.data-testid]="'filter-chip-' + name"
            >
              {{ 'invoices.filter.' + name | transloco }}
              @if (countOf(name); as count) {
                <span class="text-xs">{{ count }}</span>
              }
            </a>
          }
        </nav>

        @if (shown().length > 0) {
          <ul
            class="bg-card border-border overflow-hidden rounded-xl border"
            data-testid="invoice-list"
          >
            @for (row of shown(); track key(row)) {
              <li app-invoice-row [row]="row"></li>
            }
          </ul>
        } @else {
          <div
            class="bg-card border-border flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
            data-testid="empty-filter"
          >
            <ng-icon
              name="lucideSearchX"
              size="32"
              class="text-muted-foreground"
              aria-hidden="true"
            />
            <h2 class="text-lg font-semibold">
              {{ 'invoices.empty.filter.' + filter() | transloco }}
            </h2>
            <a
              hlmBtn
              variant="outline"
              data-testid="show-all"
              routerLink="/invoices"
              [replaceUrl]="true"
            >
              {{ 'invoices.empty.showAll' | transloco }}
            </a>
          </div>
        }
      }
    </div>
  `,
})
export class InvoicesPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);

  protected readonly filters = INVOICE_FILTERS;
  protected readonly key = rowKey;

  /** The filter the address asks for (`?filter=`); All otherwise. */
  protected readonly filter = toSignal(
    this.route.queryParamMap.pipe(map((params) => filterFrom(params.get('filter')))),
    { initialValue: filterFrom(this.route.snapshot.queryParamMap.get('filter')) },
  );

  /** Every row of the open business, in order. */
  protected readonly rows = computed(() => invoiceRows(this.demo.business(), this.demo.setup()));
  protected readonly shown = computed(() =>
    this.rows().filter((row) => matchesFilter(row, this.filter())),
  );

  private readonly counts = computed(() => {
    const rows = this.rows();
    return Object.fromEntries(
      COUNTED.map((name) => [name, rows.filter((row) => matchesFilter(row, name)).length]),
    ) as Partial<Record<InvoiceFilter, number>>;
  });

  /** The number on a chip: only Overdue and Drafts have one, and only when it is more than none. */
  protected countOf(name: InvoiceFilter): number {
    return this.counts()[name] ?? 0;
  }
}
