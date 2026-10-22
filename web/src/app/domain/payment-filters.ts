import type { Transaction } from '../data/models';
import { paymentStatus } from './payment-status';

export type QuickFilter = 'all' | 'needsYou' | 'in' | 'out';

export interface PaymentFilter {
  quick: QuickFilter;
  accountId: string | null;
  month: string | null; // 'YYYY-MM'
  search: string;
}

export const EMPTY_FILTER: PaymentFilter = { quick: 'all', accountId: null, month: null, search: '' };

/** True when any filter is set (a search of only spaces counts as none). */
export function isFilterActive(f: PaymentFilter): boolean {
  return f.quick !== 'all' || f.accountId !== null || f.month !== null || f.search.trim() !== '';
}

export interface MonthGroup {
  month: string; // 'YYYY-MM'
  inCents: number; // sum of the incoming payments
  outCents: number; // sum of the outgoing payments (a negative number)
  payments: Transaction[];
}

const monthOf = (tx: Transaction): string => tx.date.slice(0, 7);

/** Newest first; the sort is stable, so same-day payments keep their order. */
function newestFirst(txs: readonly Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Reads a typed amount as cents (German `1.500,00`, English `1,500.00` or plain `1500`).
 * The last `.` or `,` followed by 1-2 digits at the very end is the decimal mark; any other `.` or `,` is a thousands separator.
 * Returns null when the query is not a number.
 */
function parseAmountQuery(query: string): { cents: number; negative: boolean } | null {
  const text = query.replace(/[\s€+]/g, '');
  const match = /^(-?)([\d.,]*\d[\d.,]*)$/.exec(text);
  if (!match) return null;
  const decimal = /[.,](\d{1,2})$/.exec(match[2]);
  const whole = (decimal ? match[2].slice(0, decimal.index) : match[2]).replace(/[.,]/g, '');
  const fraction = decimal ? decimal[1].padEnd(2, '0') : '00';
  return { cents: Number(whole || '0') * 100 + Number(fraction), negative: match[1] === '-' };
}

/** Case-insensitive text match on counterparty and reference, or an amount match when the query is a number. */
export function matchesSearch(tx: Transaction, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  if (tx.counterparty.toLowerCase().includes(query) || tx.reference.toLowerCase().includes(query)) return true;
  const amount = parseAmountQuery(query);
  if (!amount) return false;
  return Math.abs(tx.amountCents) === amount.cents && (!amount.negative || tx.amountCents < 0);
}

export function filterPayments(txs: readonly Transaction[], f: PaymentFilter): Transaction[] {
  return newestFirst(
    txs.filter(
      (tx) =>
        (f.quick === 'all' ||
          (f.quick === 'needsYou' && paymentStatus(tx) !== 'booked') ||
          (f.quick === 'in' && tx.amountCents > 0) ||
          (f.quick === 'out' && tx.amountCents < 0)) &&
        (f.accountId === null || tx.accountId === f.accountId) &&
        (f.month === null || monthOf(tx) === f.month) &&
        matchesSearch(tx, f.search),
    ),
  );
}

export function groupByMonth(txs: readonly Transaction[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const tx of newestFirst(txs)) {
    const month = monthOf(tx);
    let group = groups.at(-1);
    if (group?.month !== month) {
      group = { month, inCents: 0, outCents: 0, payments: [] };
      groups.push(group);
    }
    group.payments.push(tx);
    if (tx.amountCents > 0) group.inCents += tx.amountCents;
    else group.outCents += tx.amountCents;
  }
  return groups;
}

export function monthsOf(txs: readonly Transaction[]): string[] {
  return groupByMonth(txs).map((g) => g.month);
}
