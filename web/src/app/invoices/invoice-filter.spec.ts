import { BUSINESSES } from '../data/sample-data';
import type { Business, Invoice } from '../data/models';
import { ALL_DONE } from '../domain/home-cards';
import { invoiceRows, owedSummary, type InvoiceRow } from '../domain/invoices';
import { INVOICE_FILTERS, filterFrom, matchesFilter } from './invoice-filter';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const rowsOf = (id: string): InvoiceRow[] => invoiceRows(business(id), ALL_DONE);
const numbers = (rows: InvoiceRow[]): string[] =>
  rows.map((row) => (row.kind === 'invoice' ? (row.invoice.number ?? 'draft') : row.doc.invoiceNo));
const only = (id: string, filter: Parameters<typeof matchesFilter>[1]): string[] =>
  numbers(rowsOf(id).filter((row) => matchesFilter(row, filter)));

describe('invoice filters', () => {
  it('has the five filters in the order of the chips', () => {
    expect(INVOICE_FILTERS).toEqual(['all', 'open', 'overdue', 'drafts', 'paid']);
  });

  it('reads a filter from the address: the four names, and All for anything else', () => {
    expect(filterFrom('open')).toBe('open');
    expect(filterFrom('overdue')).toBe('overdue');
    expect(filterFrom('drafts')).toBe('drafts');
    expect(filterFrom('paid')).toBe('paid');
    expect(filterFrom('all')).toBe('all');
    expect(filterFrom(null)).toBe('all');
    expect(filterFrom('')).toBe('all');
    expect(filterFrom('Open')).toBe('all');
    expect(filterFrom('cancelled')).toBe('all');
  });

  it('weber: Open is what is still owed (Kern and Lange), Overdue is Lange, Drafts is the draft, Paid is the five paid ones', () => {
    expect(only('weber-design', 'all')).toHaveLength(10);
    expect(only('weber-design', 'open')).toEqual(['RE-2026-039', 'RE-2026-044']);
    expect(only('weber-design', 'overdue')).toEqual(['RE-2026-039']);
    expect(only('weber-design', 'drafts')).toEqual(['draft']);
    expect(only('weber-design', 'paid')).toEqual([
      'RE-2026-043',
      'RE-2026-041',
      'RE-2026-038',
      'RE-2026-036',
      'RE-2026-031',
    ]);
  });

  it('a cancelled invoice and its cancellation invoice are in All only', () => {
    for (const filter of ['open', 'overdue', 'drafts', 'paid'] as const) {
      expect(only('weber-design', filter), filter).not.toContain('RE-2026-040');
      expect(only('weber-design', filter), filter).not.toContain('RE-2026-042');
    }
    expect(only('weber-design', 'all')).toEqual(
      expect.arrayContaining(['RE-2026-040', 'RE-2026-042']),
    );
  });

  it('a partly paid invoice is open, and overdue once it is past its due date', () => {
    expect(only('sara-yoga', 'open')).toEqual(['RE-2026-021']);
    expect(only('sara-yoga', 'overdue')).toEqual([]);
    const sara = business('sara-yoga');
    const late: Invoice = {
      ...sara.invoices.find((i) => i.number === 'RE-2026-021')!,
      issueDate: '2026-09-01',
      paymentTermDays: 14,
    };
    const rows = invoiceRows(
      { ...sara, invoices: sara.invoices.map((i) => (i.id === late.id ? late : i)) },
      ALL_DONE,
    );
    const row = rows.find((r) => r.kind === 'invoice' && r.invoice.id === late.id)!;
    expect(row.status).toBe('partlyPaid');
    expect(matchesFilter(row, 'open')).toBe(true);
    expect(matchesFilter(row, 'overdue')).toBe(true);
    expect(matchesFilter(row, 'paid')).toBe(false);
  });

  it('a sent document from a file is open, overdue or paid by its own status', () => {
    const file = (status: 'open' | 'overdue' | 'paid'): InvoiceRow => ({
      kind: 'file',
      doc: {} as never,
      status,
    });
    expect(
      ['open', 'overdue', 'paid'].map((s) => matchesFilter(file(s as 'open'), 'open')),
    ).toEqual([true, true, false]);
    expect(
      ['open', 'overdue', 'paid'].map((s) => matchesFilter(file(s as 'open'), 'overdue')),
    ).toEqual([false, true, false]);
    expect(
      ['open', 'overdue', 'paid'].map((s) => matchesFilter(file(s as 'open'), 'paid')),
    ).toEqual([false, false, true]);
    expect(matchesFilter(file('open'), 'drafts')).toBe(false);
  });

  it('Open and Overdue count what the Owed to you card counts, for every sample business', () => {
    for (const { id } of BUSINESSES) {
      const rows = rowsOf(id);
      const summary = owedSummary(business(id), ALL_DONE);
      expect(rows.filter((row) => matchesFilter(row, 'open')).length, `${id} open`).toBe(
        summary.owedCount,
      );
      expect(rows.filter((row) => matchesFilter(row, 'overdue')).length, `${id} overdue`).toBe(
        summary.overdueCount,
      );
    }
  });
});
