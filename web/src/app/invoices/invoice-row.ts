import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatDate, formatMoney } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business } from '../data/models';
import { daysBetween } from '../domain/bank-connection';
import { docName } from '../domain/document-status';
import {
  dueDateOf,
  invoiceTotals,
  leftCents,
  reminderState,
  type InvoiceRow,
} from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { matchesFilter } from './invoice-filter';

/** What a row of the list is called in a `@for`: an invoice by its id, a document from a file by its id. */
export const rowKey = (row: InvoiceRow): string =>
  row.kind === 'invoice' ? row.invoice.id : `file-${row.doc.id}`;

export type ChipTone = 'neutral' | 'open' | 'late' | 'part' | 'paid';

/** What a status chip says: the text under `invoices.status`, what goes into it, and its colour. */
export interface ChipView {
  key: string;
  tone: ChipTone;
  date: string | null;
  days: number;
  leftCents: number;
}

/** The day the money came in: the latest of the payments, or null when there is none the business knows. */
export function paidOn(paymentIds: readonly string[], business: Business): string | null {
  const dates = business.transactions
    .filter((tx) => paymentIds.includes(tx.id))
    .map((tx) => tx.date);
  return dates.length > 0 ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null;
}

const view = (key: string, tone: ChipTone, extra: Partial<ChipView> = {}): ChipView => ({
  key,
  tone,
  date: null,
  days: 0,
  leftCents: 0,
  ...extra,
});

/** The chip of an open row: when it is due, or "Open" when no due date is known. */
function dueChip(due: string | null, today: string): ChipView {
  if (due === null) return view('open', 'open');
  return due === today ? view('dueToday', 'open') : view('due', 'open', { date: due });
}

/** The chip of a row: where the invoice stands, in a word, with the date, days or amount that go with it. */
export function chipView(row: InvoiceRow, business: Business, today = DEMO_TODAY): ChipView {
  if (row.kind === 'file') {
    const due = row.doc.dueDate;
    if (row.status === 'overdue' && due !== null) {
      const days = daysBetween(due, today);
      return view(pluralKey('overdueDays', days), 'late', { days });
    }
    if (row.status === 'paid') {
      const date = paidOn(row.doc.paymentId === null ? [] : [row.doc.paymentId], business);
      return date === null ? view('paid', 'paid') : view('paidOn', 'paid', { date });
    }
    return dueChip(due, today);
  }
  const { invoice } = row;
  switch (row.status) {
    case 'draft':
      return view('draft', 'neutral');
    case 'overdue': {
      const days = daysBetween(dueDateOf(invoice), today);
      return view(pluralKey('overdueDays', days), 'late', { days });
    }
    case 'partlyPaid':
      return view('partlyPaid', 'part', { leftCents: leftCents(invoice, business) });
    case 'paid': {
      const date = paidOn(invoice.paymentIds, business);
      return date === null ? view('paid', 'paid') : view('paidOn', 'paid', { date });
    }
    case 'cancelled':
      return view('cancelled', 'neutral');
    case 'cancellation':
      return view('cancellation', 'neutral');
    case 'open':
      return dueChip(dueDateOf(invoice), today);
  }
}

const CHIP_CLASSES: Record<ChipTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  open: 'bg-primary/10 text-primary',
  late: 'bg-negative/10 text-negative',
  part: 'bg-warning/10 text-warning',
  paid: 'bg-positive/10 text-positive',
};

/**
 * Where an invoice stands, as a coloured word (never only a colour or an icon): Draft, Due 30 Oct, Overdue 22 days,
 * Partly paid · €300.00 left, Paid 20 Oct, Cancelled, Cancellation. The pill may wrap onto a second line rather than
 * leave the space it sits in.
 */
@Component({
  selector: 'app-invoice-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'inline-block max-w-full min-w-0' },
  template: `
    <span
      class="inline-block max-w-full rounded-full px-2 py-0.5 text-start text-xs font-medium"
      data-testid="invoice-status"
      [class]="classes()"
    >
      {{ 'invoices.status.' + chip().key | transloco: params() }}
    </span>
  `,
})
export class InvoiceStatusChip {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  readonly row = input.required<InvoiceRow>();

  protected readonly chip = computed(() => chipView(this.row(), this.demo.business()));
  protected readonly classes = computed(() => CHIP_CLASSES[this.chip().tone]);
  /** The words' blanks: the date as the person reads it, the days, and the amount left, which keeps its own left-to-right order inside an Arabic sentence. */
  protected readonly params = computed(() => {
    const { date, days, leftCents: left } = this.chip();
    const lang = this.language.lang();
    return {
      date: date === null ? '' : formatDate(date, lang),
      count: days,
      left: `⁦${formatMoney(left, lang)}⁩`,
    };
  });
}

/**
 * One row of the Invoices list: the customer, the number (or "Draft") and date, the amount and the status chip, as one
 * link to the invoice (an invoice added from a file opens its document on Documents). A late invoice that was written
 * here carries its next reminder under it, as a link to the invoice with the reminder open (`?remind=1`), or says when it
 * was reminded.
 */
@Component({
  selector: 'li[app-invoice-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    HlmButton,
    InvoiceStatusChip,
    MoneyPipe,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'border-border block border-t first:border-t-0', 'data-testid': 'invoice-row' },
  template: `
    <a
      class="hover:bg-muted flex items-start gap-3 px-4 py-3"
      data-testid="invoice-link"
      [routerLink]="link()"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="flex items-baseline justify-between gap-3">
          <span
            class="min-w-0 truncate font-medium"
            dir="auto"
            data-testid="invoice-name"
            [id]="nameId()"
          >
            {{ name() ?? ('invoices.row.noCustomer' | transloco) }}
          </span>
          <bdi dir="ltr" class="shrink-0 font-medium">
            <span data-testid="invoice-amount">{{ amount() | money }}</span>
          </bdi>
        </span>
        <span class="text-muted-foreground text-xs" data-testid="invoice-meta">
          @if (number(); as no) {
            <bdi dir="ltr">{{ no }}</bdi>
            ·
          }
          @if (row().status === 'draft') {
            {{ 'invoices.row.draft' | transloco }} ·
          }
          {{ date() | appDate }}
          @if (row().kind === 'file') {
            · {{ 'invoices.row.fromFile' | transloco }}
          }
        </span>
        <app-invoice-status-chip class="self-start" [row]="row()" />
      </span>
      <ng-icon
        name="lucideChevronRight"
        size="16"
        class="text-muted-foreground mt-4 shrink-0 rtl:rotate-180"
        aria-hidden="true"
      />
    </a>
    @if (reminder(); as next) {
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3">
        @if (next.sentOn) {
          <p class="text-muted-foreground min-w-0 text-xs" data-testid="invoice-reminded">
            {{
              (next.from ? 'invoices.row.remindedLater' : 'invoices.row.reminded')
                | transloco: reminderWords()
            }}
          </p>
        }
        @if (next.level) {
          <a
            hlmBtn
            variant="outline"
            class="ms-auto"
            data-testid="invoice-remind"
            [routerLink]="['/invoices', next.invoiceId]"
            [queryParams]="{ remind: 1 }"
            [attr.aria-describedby]="nameId()"
          >
            {{
              (next.level === 2 ? 'invoices.row.remindFormal' : 'invoices.row.remind') | transloco
            }}
          </a>
        }
      </div>
    }
  `,
})
export class InvoiceListRow {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  readonly row = input.required<InvoiceRow>();

  private readonly invoice = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? row.invoice : null;
  });

  /** Where the row leads: the invoice, or for one added from a file its document. */
  protected readonly link = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? ['/invoices', row.invoice.id] : ['/documents', row.doc.id];
  });
  protected readonly nameId = computed(() => `invoice-name-${rowKey(this.row())}`);

  /** The customer's name, or null for a draft that has none yet. */
  protected readonly name = computed(() => {
    const row = this.row();
    const name = row.kind === 'invoice' ? row.invoice.customer.name.trim() : docName(row.doc);
    return name === '' ? null : name;
  });
  protected readonly number = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? row.invoice.number : row.doc.invoiceNo;
  });
  protected readonly date = computed(() => {
    const row = this.row();
    return row.kind === 'invoice' ? row.invoice.issueDate : (row.doc.date ?? row.doc.addedOn);
  });
  /** The amount of the invoice (gross; negative for a cancellation invoice), whatever has been paid. */
  protected readonly amount = computed(() => {
    const row = this.row();
    return row.kind === 'invoice'
      ? invoiceTotals(row.invoice, this.demo.business().taxProfile).grossCents
      : (row.doc.amountCents ?? 0);
  });

  /**
   * What goes under a late invoice written here: the reminder that can be sent now (`level`), and when it was last
   * reminded (`sentOn`) with the day the formal one becomes possible (`from`); null when there is nothing to say.
   */
  protected readonly reminder = computed(() => {
    const row = this.row();
    const invoice = this.invoice();
    if (invoice === null) return null;
    const state = reminderState(invoice, this.demo.business());
    const last = invoice.reminders.reduce<string | null>(
      (latest, r) => (latest === null || r.sentOn > latest ? r.sentOn : latest),
      null,
    );
    const sentOn = matchesFilter(row, 'overdue') ? last : null;
    if (state.next === null && sentOn === null) return null;
    return { invoiceId: invoice.id, level: state.next, sentOn, from: state.availableFrom };
  });
  protected readonly reminderWords = computed(() => {
    const next = this.reminder();
    const lang = this.language.lang();
    return {
      date: next?.sentOn ? formatDate(next.sentOn, lang) : '',
      from: next?.from ? formatDate(next.from, lang) : '',
    };
  });
}
