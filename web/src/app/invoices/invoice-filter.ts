import { DEMO_TODAY } from '../data/demo-date';
import { dueDateOf, type InvoiceRow } from '../domain/invoices';

/** The quick filters of the Invoices list, in the order of its chips. */
export type InvoiceFilter = 'all' | 'open' | 'overdue' | 'drafts' | 'paid';

export const INVOICE_FILTERS: readonly InvoiceFilter[] = [
  'all',
  'open',
  'overdue',
  'drafts',
  'paid',
];

/** The filter an address asks for (`?filter=`): one of the five names, otherwise All. */
export function filterFrom(value: string | null): InvoiceFilter {
  return INVOICE_FILTERS.find((filter) => filter === value) ?? 'all';
}

/** Whether customers still owe something on the row: it is open, overdue or part paid. */
function isOwed(row: InvoiceRow): boolean {
  return row.status === 'open' || row.status === 'overdue' || row.status === 'partlyPaid';
}

/** Whether the row is past its due date: overdue, or part paid and past it. The same rows the Owed to you card counts as overdue. */
function isLate(row: InvoiceRow, today: string): boolean {
  if (!isOwed(row)) return false;
  return row.kind === 'invoice' ? dueDateOf(row.invoice) < today : row.status === 'overdue';
}

/**
 * Whether a row of the list belongs to a filter. Open is everything still owed, overdue and part paid included, so its
 * rows are the ones the Owed to you card adds up; Overdue is the late part of it. A cancelled invoice and its
 * cancellation invoice are in All only.
 */
export function matchesFilter(row: InvoiceRow, filter: InvoiceFilter, today = DEMO_TODAY): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return isOwed(row);
    case 'overdue':
      return isLate(row, today);
    case 'drafts':
      return row.status === 'draft';
    case 'paid':
      return row.status === 'paid';
  }
}
