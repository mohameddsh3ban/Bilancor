import type { Business, ReceiptState, Transaction } from '../data/models';
import { isClosedDate, monthRows } from './months';
import { paymentStatus } from './payment-status';
import { periodFor } from './vat-return';

// What the business hands to its tax advisor: which months, quarters and years can be exported, a summary of what one export
// holds, the rows of its printable summary and the made-up file names. An export holds the period's payments that are not
// private (private payments are never bookings); a payment that still needs the person is in it too, marked open. Dates are
// ISO dates, months are 'YYYY-MM', and `today` is an ISO date, never the real clock.

/** What an export covers: one month, one quarter or the year (of today). */
export type ExportKind = 'month' | 'quarter' | 'year';

/** One period to export. `key` is '2026-10', '2026-Q4' or '2026'; `start` and `end` are ISO dates, `end` never after today. */
export interface ExportPeriod { kind: ExportKind; key: string; start: string; end: string }

/**
 * Where a period stands, as Month by month shows its months: closed, not closed, still running (it holds the month of
 * today), or partly closed (it holds closed months and others).
 */
export type ExportState = 'closed' | 'notClosed' | 'running' | 'partly';

/** What an export holds, for the summary above its downloads. */
export interface ExportSummary {
  bookings: number; // the period's payments that are not private
  receipts: number; // those payments with their receipt attached (what Payments shows), so the rows with receipt 'attached' add up to it
  needsYou: number; // those payments that need the person, by `paymentStatus`: unclear, not confirmed, or receipt missing
  state: ExportState;
  empty: boolean; // no payments to export
}

/** One line of the printable summary: a payment with its booking (none yet for an unclear one), and whether it needs the person. */
export interface ExportRow {
  date: string;
  counterparty: string;
  amountCents: number; // money in is positive, money out negative
  // the booking's SKR03 account, German name and VAT rate; null while the payment has no booking
  skr03: string | null;
  nameDe: string | null;
  vatRate: number | null;
  receipt: ReceiptState; // the payment's own receipt state, as Payments shows it: attached (a part payment of an invoice counts), missing, or not needed
  open: boolean; // the payment needs the person: the export marks it as open
}

/** A period of one month or one quarter around a month, its end capped at `today`. */
function periodAround(kind: 'month' | 'quarter', month: string, today: string): ExportPeriod {
  const { start, end } = periodFor(`${month}-01`, kind === 'month' ? 'monthly' : 'quarterly');
  const quarter = Math.ceil(Number(month.slice(5, 7)) / 3);
  return { kind, key: kind === 'month' ? month : `${month.slice(0, 4)}-Q${quarter}`, start, end: end < today ? end : today };
}

/**
 * The periods of one kind that can be exported, newest first. Months: the months Month by month lists after the opening
 * line that have payments, and the running month even with none. Quarters: those that hold one of those months. Years: the
 * year of `today`.
 */
export function exportPeriods(business: Business, kind: ExportKind, today: string): ExportPeriod[] {
  if (kind === 'year') {
    const year = today.slice(0, 4);
    const end = `${year}-12-31`;
    return [{ kind, key: year, start: `${year}-01-01`, end: end < today ? end : today }];
  }
  const withPayments = new Set(business.transactions.filter((tx) => !tx.isPrivate).map((tx) => tx.date.slice(0, 7)));
  const months = monthRows(business, today)
    .filter((row) => row.kind === 'month' && (row.state === 'running' || withPayments.has(row.from)))
    .map((row) => row.from)
    .reverse();
  const periods = months.map((month) => periodAround(kind, month, today));
  // Months of one quarter give the same period more than once; the first (newest) one stays.
  return periods.filter((period, i) => periods.findIndex((other) => other.key === period.key) === i);
}

/** The payments an export of the period holds: dated in it, and not private. */
function paymentsIn(business: Business, period: ExportPeriod): Transaction[] {
  return business.transactions.filter((tx) => !tx.isPrivate && tx.date >= period.start && tx.date <= period.end);
}

/**
 * The state of a period from the rows of Month by month that it touches (the opening line is one row, closed). It is
 * partly closed when closed rows and others mix; otherwise it is closed or not closed, or running when it holds the
 * running month. A period no row touches (before the year, or inside an empty opening line) follows `isClosedDate`.
 */
function stateOf(business: Business, period: ExportPeriod, today: string): ExportState {
  const first = period.start.slice(0, 7);
  const last = period.end.slice(0, 7);
  const touched = monthRows(business, today).filter((row) => row.from <= last && row.until >= first);
  const states = new Set(touched.map((row) => row.state));
  if (states.size === 0) return isClosedDate(business, period.end) ? 'closed' : 'notClosed';
  if (states.has('closed')) return states.size > 1 ? 'partly' : 'closed';
  return states.has('running') ? 'running' : 'notClosed';
}

/** What an export of the period holds. */
export function exportSummary(business: Business, period: ExportPeriod, today: string): ExportSummary {
  const payments = paymentsIn(business, period);
  return {
    bookings: payments.length,
    receipts: payments.filter((tx) => tx.receipt === 'attached').length,
    needsYou: payments.filter((tx) => paymentStatus(tx) !== 'booked').length,
    state: stateOf(business, period, today),
    empty: payments.length === 0,
  };
}

/** The rows of the printable summary of an export: its payments, oldest first. */
export function exportRows(business: Business, period: ExportPeriod): ExportRow[] {
  return paymentsIn(business, period)
    .map((tx): ExportRow => ({
      date: tx.date,
      counterparty: tx.counterparty,
      amountCents: tx.amountCents,
      skr03: tx.booking?.skr03 ?? null,
      nameDe: tx.booking?.nameDe ?? null,
      vatRate: tx.booking?.vatRate ?? null,
      receipt: tx.receipt,
      open: paymentStatus(tx) !== 'booked',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The made-up name of a download: `weber-design_DATEV_2026-10.zip` (DATEV) or `.csv` (a spreadsheet). */
export function exportFileName(businessId: string, period: ExportPeriod, file: 'datev' | 'csv'): string {
  return `${businessId}_DATEV_${period.key}.${file === 'datev' ? 'zip' : 'csv'}`;
}

/** The made-up name of the audit export (GDPdU) of a year: `weber-design_GDPdU_2026.zip`. */
export function auditFileName(businessId: string, year: number): string {
  return `${businessId}_GDPdU_${year}.zip`;
}
