import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business } from '../data/models';
import { daysBetween } from '../domain/bank-connection';
import { dueDateOf, leftCents, type InvoiceRow } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';

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
