import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { DEMO_TODAY } from '../data/demo-date';
import type { ReceiptState } from '../data/models';
import {
  exportPeriods,
  exportRows,
  exportSummary,
  type ExportKind,
  type ExportPeriod,
  type ExportRow,
} from '../domain/exports';
import { vatRateShown } from '../domain/tax-rules';
import { exportPeriodName } from '../reports/export-period-name';
import { ExportSummaryLine } from '../reports/export-summary-line';
import { DemoStateService } from '../state/demo-state.service';
import { printOnceRendered } from './print-once';

const KINDS: readonly ExportKind[] = ['month', 'quarter', 'year'];

/** The word for a payment's receipt: Yes when it is attached, No when it is missing, Not needed when the payment needs none. */
const RECEIPT_WORDS: Record<ReceiptState, string> = {
  attached: 'print.export.yes',
  missing: 'print.export.no',
  notNeeded: 'print.export.notNeeded',
};

/**
 * The printable summary of an export for the tax advisor (Reports › Export for your tax advisor › Print summary): the
 * business, the period with its days, what the export holds (the same line as the card) and one row for each booking with
 * its date, counterparty, amount, SKR03 account and German name, VAT rate, the receipt (Yes when attached, No when missing, Not
 * needed when the payment needs none), and whether the booking is done or still open. The period comes from the address (`/print/export/2026-10`, `2026-Q4` or `2026`), and it
 * has to be one the card offers. It sits outside the app shell and opens the print dialog once after it first renders. A
 * period that cannot be exported says so, and so does one with no payments; neither prints.
 */
@Component({
  selector: 'app-export-summary-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    ExportSummaryLine,
    MoneyPipe,
    NgIcon,
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-8 print:p-0' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium print:hidden"
      data-testid="print-back"
      routerLink="/reports"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'print.back' | transloco }}
    </a>

    <!-- The VAT of a row: its rate, "No VAT" for a business that charges none, or a dash while the payment has no booking. -->
    <ng-template #vat let-row="row" let-rate="rate">
      @if (row.vatRate === null) {
        —
      } @else if (rate !== null) {
        <bdi dir="ltr">{{ 'payments.detail.booking.vatRate' | transloco: { rate } }}</bdi>
      } @else {
        {{ 'payments.detail.booking.noVat' | transloco }}
      }
    </ng-template>

    @if (view(); as v) {
      <article class="flex flex-col gap-4" data-testid="export-article">
        <header class="border-border flex flex-col gap-1 border-b pb-4">
          <p class="text-muted-foreground text-sm font-medium" data-testid="print-business">
            <bdi>{{ business().name }}</bdi>
          </p>
          <h1 class="text-2xl font-semibold" data-testid="export-title">
            {{ 'reports.export.title' | transloco }}
          </h1>
          <p class="text-lg font-medium" data-testid="export-period">
            <bdi>{{ periodName() }}</bdi>
          </p>
          <p class="text-muted-foreground text-sm">
            <bdi dir="ltr" data-testid="export-range"
              >{{ v.period.start | appDate: { year: true } }} –
              {{ v.period.end | appDate: { year: true } }}</bdi
            >
          </p>
        </header>

        <app-export-summary-line [period]="v.period" [summary]="v.summary" />

        @if (v.summary.empty) {
          <p class="text-muted-foreground" role="status" data-testid="export-nothing">
            {{ 'reports.export.nothing' | transloco }}
          </p>
        } @else {
          <table class="w-full text-xs sm:text-sm" data-testid="export-table">
            <caption class="sr-only">
              {{
                'print.export.caption' | transloco
              }}
            </caption>
            <thead>
              <tr class="text-muted-foreground border-border border-b text-xs">
                <th scope="col" class="py-2 pe-2 text-start font-medium sm:pe-3">
                  {{ 'home.transactions.col.date' | transloco }}
                </th>
                <th scope="col" class="py-2 pe-2 text-start font-medium sm:pe-3">
                  {{ 'home.transactions.col.counterparty' | transloco }}
                </th>
                <th scope="col" class="py-2 pe-2 text-end font-medium sm:pe-3">
                  {{ 'home.transactions.col.amount' | transloco }}
                </th>
                <th scope="col" class="py-2 pe-2 text-start font-medium max-sm:hidden sm:pe-3">
                  {{ 'print.export.col.account' | transloco }}
                </th>
                <th scope="col" class="py-2 pe-2 text-start font-medium max-sm:hidden sm:pe-3">
                  {{ 'payments.detail.booking.vat' | transloco }}
                </th>
                <th scope="col" class="py-2 pe-2 text-start font-medium max-sm:hidden sm:pe-3">
                  {{ 'print.export.col.receipt' | transloco }}
                </th>
                <th scope="col" class="py-2 text-start font-medium">
                  {{ 'home.transactions.col.status' | transloco }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track $index) {
                @let rate = rateOf(row);
                <tr
                  class="border-border border-b align-top break-inside-avoid"
                  data-testid="export-row"
                >
                  <td class="py-2 pe-2 whitespace-nowrap sm:pe-3" data-testid="row-date">
                    {{ row.date | appDate }}
                  </td>
                  <td class="py-2 pe-2 font-medium wrap-break-word sm:pe-3">
                    <span dir="auto" data-testid="row-counterparty">{{ row.counterparty }}</span>
                    <!-- A phone has no room for the next three columns: they go under the name. -->
                    <span class="text-muted-foreground block text-xs font-normal sm:hidden">
                      <bdi dir="ltr">{{ row.skr03 ? row.skr03 + ' ' + row.nameDe : '—' }}</bdi>
                      ·
                      <ng-container
                        [ngTemplateOutlet]="vat"
                        [ngTemplateOutletContext]="{ row, rate }"
                      />
                      · {{ 'print.export.col.receipt' | transloco }}:
                      {{ receiptWord[row.receipt] | transloco }}
                    </span>
                  </td>
                  <td class="py-2 pe-2 text-end whitespace-nowrap sm:pe-3">
                    <bdi dir="ltr" class="font-medium">
                      <span
                        data-testid="row-amount"
                        [class]="row.amountCents >= 0 ? 'text-positive' : 'text-negative'"
                      >
                        {{ row.amountCents | money: { signed: true } }}
                      </span>
                    </bdi>
                  </td>
                  <td class="py-2 pe-2 wrap-break-word max-sm:hidden sm:pe-3">
                    <bdi dir="ltr"
                      ><span data-testid="row-account">{{
                        row.skr03 ? row.skr03 + ' ' + row.nameDe : '—'
                      }}</span></bdi
                    >
                  </td>
                  <td class="py-2 pe-2 whitespace-nowrap max-sm:hidden sm:pe-3">
                    <span data-testid="row-vat">
                      <ng-container
                        [ngTemplateOutlet]="vat"
                        [ngTemplateOutletContext]="{ row, rate }"
                      />
                    </span>
                  </td>
                  <td class="py-2 pe-2 max-sm:hidden sm:pe-3" data-testid="row-receipt">
                    {{ receiptWord[row.receipt] | transloco }}
                  </td>
                  <td class="py-2 whitespace-nowrap">
                    <span
                      data-testid="row-status"
                      [class]="row.open ? 'text-warning font-medium' : 'text-muted-foreground'"
                    >
                      {{ (row.open ? 'print.export.open' : 'print.export.booked') | transloco }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          @if (v.summary.needsYou > 0) {
            <p
              class="text-muted-foreground text-xs break-inside-avoid"
              data-testid="export-open-note"
            >
              {{ 'print.export.openNote' | transloco }}
            </p>
          }
        }
      </article>
    } @else {
      <p class="text-muted-foreground" role="status" data-testid="export-unknown">
        {{ 'print.export.unknown' | transloco }}
      </p>
    }
  `,
})
export class ExportSummaryPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(LanguageService);

  private readonly key = toSignal(this.route.paramMap.pipe(map((params) => params.get('period'))), {
    initialValue: this.route.snapshot.paramMap.get('period'),
  });

  protected readonly business = this.demo.business;
  protected readonly receiptWord = RECEIPT_WORDS;

  /** The period of the address, when it is one the card offers for the open business. */
  private readonly period = computed<ExportPeriod | null>(() => {
    const key = this.key();
    for (const kind of KINDS) {
      const found = exportPeriods(this.business(), kind, DEMO_TODAY).find((p) => p.key === key);
      if (found) return found;
    }
    return null;
  });

  /** The period with what its export holds; none for a period that cannot be exported. */
  protected readonly view = computed(() => {
    const period = this.period();
    return period ? { period, summary: exportSummary(this.business(), period, DEMO_TODAY) } : null;
  });

  protected readonly rows = computed<ExportRow[]>(() => {
    const period = this.period();
    return period ? exportRows(this.business(), period) : [];
  });

  /** "October 2026", "Q4 2026" or "2026". */
  protected readonly periodName = computed(() => {
    const period = this.period();
    return period ? exportPeriodName(period, this.language.lang()) : '';
  });

  constructor() {
    printOnceRendered(() => {
      const view = this.view();
      return view !== null && !view.summary.empty;
    });
  }

  /** The VAT rate to show for a row, none when there is no VAT (always so for a small business) or no booking. */
  protected rateOf(row: ExportRow): number | null {
    return row.vatRate === null
      ? null
      : vatRateShown(this.business().taxProfile, { vatRate: row.vatRate });
  }
}
