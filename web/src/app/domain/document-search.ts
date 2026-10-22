import type { Doc } from '../data/models';
import { parseAmountQuery } from './payment-filters';

/** The day a document belongs to: its own date, or the day it was added while the date is not known. */
export const docDay = (doc: Doc): string => doc.date ?? doc.addedOn;

/** Newest first; the sort is stable, so documents of the same day keep their order. */
export function newestFirst(docs: readonly Doc[]): Doc[] {
  return [...docs].sort((a, b) => (docDay(a) < docDay(b) ? 1 : docDay(a) > docDay(b) ? -1 : 0));
}

/** Case-insensitive text match on name, file name and invoice number, or an amount match when the search is a number. */
function matches(doc: Doc, query: string, amount: ReturnType<typeof parseAmountQuery>): boolean {
  if (
    (doc.name ?? '').toLowerCase().includes(query) ||
    doc.fileName.toLowerCase().includes(query) ||
    doc.invoiceNo.toLowerCase().includes(query)
  ) {
    return true;
  }
  return amount !== null && doc.amountCents === amount.cents;
}

/** The documents that match the search, newest first. The sign of a typed amount does not matter: documents are never negative. */
export function filterDocuments(docs: readonly Doc[], search: string): Doc[] {
  const query = search.trim().toLowerCase();
  if (!query) return newestFirst(docs);
  const amount = parseAmountQuery(query);
  return newestFirst(docs.filter((doc) => matches(doc, query, amount)));
}

export interface DocMonthGroup {
  month: string; // 'YYYY-MM'
  docs: Doc[];
}

/** The documents grouped by the month of their date (or of the day they were added), newest month first, newest document first in each. */
export function groupDocsByMonth(docs: readonly Doc[]): DocMonthGroup[] {
  const groups: DocMonthGroup[] = [];
  for (const doc of newestFirst(docs)) {
    const month = docDay(doc).slice(0, 7);
    let group = groups.at(-1);
    if (group?.month !== month) {
      group = { month, docs: [] };
      groups.push(group);
    }
    group.docs.push(doc);
  }
  return groups;
}
