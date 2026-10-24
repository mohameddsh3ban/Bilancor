import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatMonthRange } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import { Term } from '../core/i18n/term';
import { DEMO_TODAY } from '../data/demo-date';
import type { Lang } from '../data/models';
import { addDays } from '../domain/dates';
import {
  canCloseMonths,
  monthRows,
  yearTotals,
  type MonthRow,
  type MonthState,
} from '../domain/months';
import { periodFor } from '../domain/vat-return';
import { DemoStateService } from '../state/demo-state.service';
import { CloseMonthDialog, type CloseResult } from './close-month-dialog';

/** The locales a list of months is written in. */
const LIST_LOCALES: Record<Lang, string> = { en: 'en-IE', de: 'de-DE', ar: 'ar-u-nu-latn' };

/** The colours of the word that says where a month stands. */
const STATE_CLASSES: Record<MonthState, string> = {
  closed: 'bg-positive/10 text-positive',
  notClosed: 'bg-warning/10 text-warning',
  running: 'bg-muted text-muted-foreground',
};

/** One line of the table: a month row of the rules, how it reads, and the days around its month. */
interface Item {
  row: MonthRow;
  /** `earlier` for the opening line, else the month ('2026-09'); the test ids and the cursor go by it. */
  key: string;
  /** "September", or "Jan–Jul" for the opening line. */
  label: string;
  /** The last day of the month, and the day after it. */
  endDate: string;
  readyDate: string;
}

/**
 * Month by month: the year so far, one line for the months before the first payment, then one for every month up to the
 * running one, with income, costs and profit and a word for where it stands (Closed, Not closed, Running), and the year's
 * total. A finished month that is not closed has **Close**, which asks first (the pop-up); the running month says when it
 * can be closed. A month opens Payments on that month. The figures are the booked payments, without VAT for a business that
 * charges it, so the total is the year of Taxes.
 *
 * Each month is a small block, not a row of table columns: the page is two columns from `lg`, and a phone is narrower
 * still, so three amounts and a word have to fit in a card of about 300 px.
 */
@Component({
  selector: 'app-month-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    CloseMonthDialog,
    HlmButton,
    HlmCardImports,
    MoneyPipe,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="month-table">
      <header hlmCardHeader>
        <h2 hlmCardTitle id="months-title" data-testid="months-title">
          {{ 'reports.months.title' | transloco }} <bdi dir="ltr">{{ year }}</bdi>
          <span class="text-muted-foreground block text-xs font-normal"
            ><app-term key="bwa"
          /></span>
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        <p class="text-muted-foreground text-xs" data-testid="months-basis">
          {{ (chargesVat() ? 'reports.months.net' : 'reports.months.gross') | transloco }}
        </p>

        <ul class="flex flex-col" aria-labelledby="months-title">
          @for (item of items(); track item.key) {
            <li
              class="border-border flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0"
              [attr.data-testid]="'month-' + item.key"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 flex-col">
                  @if (item.row.kind === 'month') {
                    <a
                      class="text-primary w-fit font-medium underline-offset-4 hover:underline"
                      routerLink="/payments"
                      [queryParams]="{ month: item.row.from }"
                      [attr.data-testid]="'month-link-' + item.key"
                    >
                      {{ item.label }}
                    </a>
                  } @else {
                    <span class="font-medium" [attr.data-testid]="'month-label-' + item.key">
                      {{ item.label }}
                    </span>
                  }
                  @if (item.row.kind === 'opening') {
                    <span class="text-muted-foreground text-xs">
                      {{ 'reports.months.earlier' | transloco }}
                    </span>
                  } @else if (item.row.state === 'running') {
                    <span class="text-muted-foreground text-xs">
                      {{ 'reports.months.until' | transloco: { date: (item.endDate | appDate) } }}
                    </span>
                  }
                </div>

                <div class="flex shrink-0 flex-col items-end gap-1">
                  <div class="flex items-center gap-2">
                    <span
                      class="focus-visible:ring-ring/50 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap focus-visible:ring-[3px] focus-visible:outline-none"
                      tabindex="-1"
                      [class]="stateClass(item.row.state)"
                      [attr.data-testid]="'status-' + item.key"
                    >
                      {{ 'reports.months.state.' + item.row.state | transloco }}
                    </span>
                    @if (item.row.state === 'notClosed' && canClose()) {
                      <button
                        hlmBtn
                        size="sm"
                        variant="outline"
                        type="button"
                        [attr.aria-label]="
                          'reports.months.closeMonth' | transloco: { month: item.label }
                        "
                        [attr.data-testid]="'close-' + item.key"
                        (click)="ask(item.row.from)"
                      >
                        {{ 'reports.months.close' | transloco }}
                      </button>
                    }
                  </div>
                  @if (item.row.state === 'running') {
                    <span class="text-muted-foreground text-end text-xs">
                      {{
                        'reports.months.readyFrom' | transloco: { date: (item.readyDate | appDate) }
                      }}
                    </span>
                  }
                </div>
              </div>

              <dl class="grid grid-cols-3 gap-2">
                <div class="min-w-0">
                  <dt class="text-muted-foreground text-xs">
                    {{ 'reports.months.income' | transloco }}
                  </dt>
                  <dd [attr.data-testid]="'income-' + item.key">
                    <bdi dir="ltr">{{ item.row.incomeCents | money }}</bdi>
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-muted-foreground text-xs">
                    {{ 'reports.months.costs' | transloco }}
                  </dt>
                  <dd [attr.data-testid]="'costs-' + item.key">
                    <bdi dir="ltr">{{ item.row.costsCents | money }}</bdi>
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-muted-foreground text-xs">
                    {{ 'reports.months.profit' | transloco }}
                  </dt>
                  <dd class="font-medium" [attr.data-testid]="'profit-' + item.key">
                    <bdi dir="ltr">{{ item.row.profitCents | money }}</bdi>
                  </dd>
                </div>
              </dl>
            </li>
          }

          <li
            class="border-border flex flex-col gap-2 border-t pt-3 font-semibold"
            data-testid="month-total"
          >
            <span>{{ 'reports.months.total' | transloco }}</span>
            <dl class="grid grid-cols-3 gap-2">
              <div class="min-w-0">
                <dt class="text-muted-foreground text-xs font-normal">
                  {{ 'reports.months.income' | transloco }}
                </dt>
                <dd data-testid="month-total-income">
                  <bdi dir="ltr">{{ totals().incomeCents | money }}</bdi>
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground text-xs font-normal">
                  {{ 'reports.months.costs' | transloco }}
                </dt>
                <dd data-testid="month-total-costs">
                  <bdi dir="ltr">{{ totals().costsCents | money }}</bdi>
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground text-xs font-normal">
                  {{ 'reports.months.profit' | transloco }}
                </dt>
                <dd data-testid="month-total-profit">
                  <bdi dir="ltr">{{ totals().profitCents | money }}</bdi>
                </dd>
              </div>
            </dl>
          </li>
        </ul>

        @if (byReturn(); as listed) {
          <p class="text-muted-foreground text-xs" data-testid="months-by-return">
            {{
              plural('reports.months.byReturn', listed.count) | transloco: { months: listed.names }
            }}
          </p>
        }
        @if (!canClose() && hasMonthToClose()) {
          <p class="text-muted-foreground text-xs" data-testid="months-only-full">
            {{ 'reports.months.onlyFull' | transloco }}
          </p>
        }
      </div>
    </section>

    <app-close-month-dialog
      [month]="closing()"
      [(open)]="dialogOpen"
      (finished)="onFinished($event)"
    />
  `,
})
export class MonthTable {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly plural = pluralKey;
  /** The year of the demo's today, which is the year the table shows. */
  protected readonly year = DEMO_TODAY.slice(0, 4);

  protected readonly business = this.demo.business;
  /** A business that charges VAT shows amounts without it; a Kleinunternehmer shows what was paid. */
  protected readonly chargesVat = computed(() => !this.business().taxProfile.kleinunternehmer);
  /** Only the owner and people with full access close a month. */
  protected readonly canClose = computed(() => canCloseMonths(this.demo.myRole()));

  private readonly rows = computed(() => monthRows(this.business(), DEMO_TODAY));
  protected readonly totals = computed(() => yearTotals(this.rows()));
  protected readonly items = computed<Item[]>(() => {
    const lang = this.language.lang();
    return this.rows().map((row) => {
      const endDate = periodFor(`${row.until}-01`, 'monthly').end;
      return {
        row,
        key: row.kind === 'opening' ? 'earlier' : row.from,
        label:
          row.kind === 'opening'
            ? formatMonthRange(row.from, row.until, lang, { short: true })
            : formatMonthRange(row.from, row.from, lang),
        endDate,
        readyDate: addDays(endDate, 1),
      };
    });
  });
  /** Whether a finished month is waiting to be closed, for the sentence that says who can. */
  protected readonly hasMonthToClose = computed(() =>
    this.rows().some((row) => row.state === 'notClosed'),
  );

  /** The months of this year that closed by themselves when their VAT returns were sent, named as a list; null when none did. */
  protected readonly byReturn = computed(() => {
    const lang = this.language.lang();
    const months = this.business().closedMonths.filter(
      (c) => c.by === null && c.month.startsWith(this.year),
    );
    if (months.length === 0) return null;
    const names = months.map((c) => formatMonthRange(c.month, c.month, lang));
    return {
      count: months.length,
      names: new Intl.ListFormat(LIST_LOCALES[lang], { style: 'long', type: 'conjunction' }).format(
        names,
      ),
    };
  });

  /** The month the pop-up is about; it is only looked at while the pop-up is open. */
  protected readonly closing = signal(DEMO_TODAY.slice(0, 7));
  private readonly businessId = computed(() => this.business().id);
  /** Whether the pop-up is open; it closes by itself when another business is opened. */
  protected readonly dialogOpen = linkedSignal<string, boolean>({
    source: this.businessId,
    computation: () => false,
  });

  protected stateClass(state: MonthState): string {
    return STATE_CLASSES[state];
  }

  protected ask(month: string): void {
    this.closing.set(month);
    this.dialogOpen.set(true);
  }

  /**
   * The pop-up went. After Not yet the cursor goes back to Close; after closing, Close is gone, and it goes to the word
   * that replaced it ("Closed"), which a screen reader then reads out.
   */
  protected onFinished(result: CloseResult): void {
    const month = this.closing();
    const close = `[data-testid="close-${month}"]`;
    const status = `[data-testid="status-${month}"]`;
    afterNextRender(
      () => {
        const first = result === 'closed' ? status : close;
        (
          this.host.querySelector<HTMLElement>(first) ??
          this.host.querySelector<HTMLElement>(status)
        )?.focus();
      },
      { injector: this.injector },
    );
  }
}
