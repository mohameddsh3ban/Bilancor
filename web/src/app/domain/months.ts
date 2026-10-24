import type { Business, HistoryEntry, Transaction, TxStatus } from '../data/models';
import { docStatus } from './document-status';
import { paymentStatus } from './payment-status';
import { paymentFigure } from './tax-year';

// The year month by month, and closing a month so that its bookings can't change any more (GoBD). The figures count
// payments as Taxes › Year does (`paymentFigure`), so the months always add up to that year. Months are 'YYYY-MM', dates
// are ISO dates, and `today` is an ISO date, never the real clock. Every rule that changes a business returns the one it
// was given when it changes nothing (the state service relies on that to skip an update).

/** Where a month stands: closed, finished but not closed yet, or still running (the month of today). */
export type MonthState = 'closed' | 'notClosed' | 'running';

/**
 * One line of Month by month: a single month, or the opening line, which holds the months before the business's first
 * payment (January up to `yearOpening.untilMonth`) as one line. `from` and `until` are months; a month row has both the same.
 */
export interface MonthRow {
  kind: 'opening' | 'month';
  from: string;
  until: string;
  incomeCents: number;
  costsCents: number;
  profitCents: number;
  state: MonthState;
}

const monthOf = (date: string): string => date.slice(0, 7);

/** The month after a month. */
function nextMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
}

/** Every month from one to another, both included; none when the second is before the first. */
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = nextMonth(month)) months.push(month);
  return months;
}

type Figures = { incomeCents: number; costsCents: number };

/** What these payments add to the year, as `paymentFigure` counts each. */
function sumOf(transactions: readonly Transaction[], chargesVat: boolean): Figures {
  let incomeCents = 0;
  let costsCents = 0;
  for (const tx of transactions) {
    const figure = paymentFigure(tx, chargesVat);
    incomeCents += figure?.incomeCents ?? 0;
    costsCents += figure?.costsCents ?? 0;
  }
  return { incomeCents, costsCents };
}

/**
 * The year of `today` month by month, oldest first: the opening line (January up to `untilMonth`: the stored opening plus
 * the payments dated in those months, always closed, and left out when it has no amounts and no payments), then every
 * month after it up to the month of `today`, which is running. A payment dated after `today` is in no row.
 */
export function monthRows(business: Business, today: string): MonthRow[] {
  const year = today.slice(0, 4);
  const chargesVat = !business.taxProfile.kleinunternehmer;
  const { untilMonth, incomeCents: openingIncome, costsCents: openingCosts } = business.yearOpening;
  const thisYear = business.transactions.filter((tx) => tx.date >= `${year}-01-01` && tx.date <= today);
  const closed = new Set(business.closedMonths.map((c) => c.month));
  const thisMonth = monthOf(today);
  const rowOf = (kind: MonthRow['kind'], from: string, until: string, state: MonthState, figures: Figures): MonthRow => ({
    kind,
    from,
    until,
    state,
    ...figures,
    profitCents: figures.incomeCents - figures.costsCents,
  });

  const rows: MonthRow[] = [];
  const earlier = thisYear.filter((tx) => monthOf(tx.date) <= untilMonth);
  if (openingIncome !== 0 || openingCosts !== 0 || earlier.length > 0) {
    const added = sumOf(earlier, chargesVat);
    const figures = { incomeCents: openingIncome + added.incomeCents, costsCents: openingCosts + added.costsCents };
    rows.push(rowOf('opening', `${year}-01`, untilMonth, 'closed', figures));
  }
  for (const month of monthsBetween(nextMonth(untilMonth), thisMonth)) {
    const state: MonthState = month === thisMonth ? 'running' : closed.has(month) ? 'closed' : 'notClosed';
    const figures = sumOf(thisYear.filter((tx) => monthOf(tx.date) === month), chargesVat);
    rows.push(rowOf('month', month, month, state, figures));
  }
  return rows;
}

/** The year so far: what the rows add up to. Taxes › Year shows the same total. */
export function yearTotals(rows: readonly MonthRow[]): { incomeCents: number; costsCents: number; profitCents: number } {
  const incomeCents = rows.reduce((sum, r) => sum + r.incomeCents, 0);
  const costsCents = rows.reduce((sum, r) => sum + r.costsCents, 0);
  return { incomeCents, costsCents, profitCents: incomeCents - costsCents };
}

/** Whether a month is closed: it was closed, or it is one of the earlier months (the opening line, which counts as closed). */
function isClosedMonth(business: Business, month: string): boolean {
  return month <= business.yearOpening.untilMonth || business.closedMonths.some((c) => c.month === month);
}

/** Whether a date falls in a closed month, so a payment dated then can't be changed. */
export function isClosedDate(business: Business, date: string): boolean {
  return isClosedMonth(business, monthOf(date));
}

/** What a month has to show before it is closed: the payments that need the person (these block), and what only warns. */
export interface CloseCheck {
  unclear: number; // payments of the month with no category yet
  confirm: number; // payments of the month whose booking is not confirmed
  noReceipt: number; // payments of the month still missing their receipt
  duplicateDocIds: string[]; // documents dated in the month that look like a duplicate (a warning only)
  // every account but the cash box: it matches the bank (connected), or the person checks it against the statement
  accounts: { accountId: string; result: 'matches' | 'statement' }[];
  blocked: boolean; // a payment of the month needs the person
}

/** The check before closing a month (see `CloseCheck`). A payment needs the person by the app's one rule, `paymentStatus`. */
export function closeCheck(business: Business, month: string): CloseCheck {
  const inMonth = business.transactions.filter((tx) => monthOf(tx.date) === month);
  const count = (status: TxStatus): number => inMonth.filter((tx) => paymentStatus(tx) === status).length;
  const unclear = count('unclear');
  const confirm = count('confirm');
  const noReceipt = count('noReceipt');
  return {
    unclear,
    confirm,
    noReceipt,
    duplicateDocIds: business.documents
      .filter((doc) => docStatus(doc) === 'duplicate' && monthOf(doc.date ?? doc.addedOn) === month)
      .map((doc) => doc.id),
    accounts: business.accounts
      .filter((account) => account.kind === 'bank')
      .map((account) => ({
        accountId: account.id,
        result: account.connection.kind === 'connected' ? 'matches' : 'statement',
      })),
    blocked: unclear + confirm + noReceipt > 0,
  };
}

/**
 * The business with these months (oldest first) closed on `today` `by` a person's full name, or by no person (null) when a
 * VAT return closes them, and one `monthClosed` line each, the newest month's at the front.
 */
function withClosedMonths(business: Business, months: readonly string[], by: string | null, today: string): Business {
  if (months.length === 0) return business;
  const lines = months.map((month): HistoryEntry => ({
    date: today,
    key: 'monthClosed',
    params: by === null ? { month, byReturn: '1' } : { month, by },
  }));
  const closed = [...business.closedMonths, ...months.map((month) => ({ month, on: today, by }))];
  return {
    ...business,
    closedMonths: closed.sort((a, b) => a.month.localeCompare(b.month)),
    history: [...lines.reverse(), ...business.history],
  };
}

/**
 * Closes a finished month, by the person (their full name), and adds one history line. Refused (the business comes back
 * as it is) for the running month and any month to come, a month that is closed already, a month of the opening line, and
 * a month with a payment that needs the person (see `closeCheck`).
 */
export function closeMonth(business: Business, month: string, by: string, today: string): Business {
  if (month >= monthOf(today) || isClosedMonth(business, month) || closeCheck(business, month).blocked) {
    return business;
  }
  return withClosedMonths(business, [month], by, today);
}

/**
 * Closes every finished month of a VAT return's period (a month or a quarter, first to last day) that is not closed yet,
 * by no person and with no check: a return can only be sent when every payment in it is booked. One history line each; a
 * month closed already keeps its date and its person and adds no line.
 */
export function closeMonthsOf(business: Business, periodStart: string, periodEnd: string, today: string): Business {
  const open = monthsBetween(monthOf(periodStart), monthOf(periodEnd)).filter(
    (month) => month < monthOf(today) && !isClosedMonth(business, month),
  );
  return withClosedMonths(business, open, null, today);
}
