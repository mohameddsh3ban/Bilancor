import { RENT } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, Transaction } from '../data/models';
import { newBusiness, newBusinessAccount, newBusinessPayments } from '../data/new-business-sample';
import { BUSINESSES } from '../data/sample-data';
import { auditFileName, exportFileName, exportPeriods, exportRows, exportSummary, type ExportPeriod } from './exports';
import { closeMonth } from './months';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const weber = business('weber-design');
const sara = business('sara-yoga');
const cafe = business('cafe-linde');

/** The period with this key, as `exportPeriods` offers it. */
const periodOf = (b: Business, kind: ExportPeriod['kind'], key: string): ExportPeriod =>
  exportPeriods(b, kind, DEMO_TODAY).find((period) => period.key === key)!;

const keys = (b: Business, kind: ExportPeriod['kind']): string[] => exportPeriods(b, kind, DEMO_TODAY).map((period) => period.key);

/** The business without the payments for which `drop` says true (and without the documents linked to them). */
const without = (b: Business, drop: (tx: Transaction) => boolean): Business => {
  const dropped = new Set(b.transactions.filter(drop).map((tx) => tx.id));
  return {
    ...b,
    transactions: b.transactions.filter((tx) => !dropped.has(tx.id)),
    documents: b.documents.filter((doc) => doc.paymentId === null || !dropped.has(doc.paymentId)),
  };
};

describe('exportPeriods', () => {
  it('month periods are the months with payments and the running one, newest first', () => {
    expect(keys(weber, 'month')).toEqual(['2026-10', '2026-09', '2026-08']); // July is inside the opening line
    expect(keys(cafe, 'month')).toEqual(['2026-10', '2026-09', '2026-08', '2026-07']);
    expect(keys(sara, 'month')).toEqual(['2026-10', '2026-09', '2026-08']);

    // A month without payments is left out, and the running month stays even when it has none.
    expect(keys(without(cafe, (tx) => tx.date.startsWith('2026-08')), 'month')).toEqual(['2026-10', '2026-09', '2026-07']);
    expect(keys(without(weber, () => true), 'month')).toEqual(['2026-10']);

    // A month with only private payments has nothing to export, so it is left out too.
    const privateAugust = without(weber, (tx) => tx.date.startsWith('2026-08') && !tx.isPrivate);
    expect(privateAugust.transactions.find((tx) => tx.date.startsWith('2026-08'))!.isPrivate).toBe(true);
    expect(keys(privateAugust, 'month')).toEqual(['2026-10', '2026-09']);
  });

  it('a month runs from its first to its last day, and the running month ends today', () => {
    expect(periodOf(weber, 'month', '2026-09')).toEqual({ kind: 'month', key: '2026-09', start: '2026-09-01', end: '2026-09-30' });
    expect(periodOf(weber, 'month', '2026-10')).toEqual({ kind: 'month', key: '2026-10', start: '2026-10-01', end: DEMO_TODAY });
  });

  it('Q3 2026 at Café Linde spans July to September', () => {
    expect(periodOf(cafe, 'quarter', '2026-Q3')).toEqual({ kind: 'quarter', key: '2026-Q3', start: '2026-07-01', end: '2026-09-30' });
    expect(periodOf(cafe, 'quarter', '2026-Q4')).toEqual({ kind: 'quarter', key: '2026-Q4', start: '2026-10-01', end: DEMO_TODAY });
  });

  it('quarters are the ones that touch those months, newest first', () => {
    expect(keys(cafe, 'quarter')).toEqual(['2026-Q4', '2026-Q3']);
    expect(keys(weber, 'quarter')).toEqual(['2026-Q4', '2026-Q3']); // Q3 holds August and September
    expect(keys(without(weber, () => true), 'quarter')).toEqual(['2026-Q4']);
  });

  it('the year is one period, from 1 January to today', () => {
    for (const b of BUSINESSES) {
      expect(exportPeriods(b, 'year', DEMO_TODAY), b.id).toEqual([{ kind: 'year', key: '2026', start: '2026-01-01', end: DEMO_TODAY }]);
    }
  });
});

describe('exportSummary', () => {
  it('October at Weber Design counts its bookings, receipts and the payments that need Sara', () => {
    // Eleven payments, none private. Three miss their receipt (Kern Studio, Deutsche Bahn, Schreibwaren Böttcher), Müller's is
    // not confirmed, and two Amazon orders have no category: six need her. The other eight payments have their receipt.
    expect(exportSummary(weber, periodOf(weber, 'month', '2026-10'), DEMO_TODAY)).toEqual({
      bookings: 11,
      receipts: 8,
      needsYou: 6,
      state: 'running',
      empty: false,
    });
  });

  it('September at Weber Design is closed and has nothing that needs the person', () => {
    expect(exportSummary(weber, periodOf(weber, 'month', '2026-09'), DEMO_TODAY)).toEqual({
      bookings: 4,
      receipts: 4,
      needsYou: 0,
      state: 'closed',
      empty: false,
    });
  });

  it('a receipt is what Payments shows as attached, a part payment of an invoice included', () => {
    // Sara's 300,00 € for RE-2026-021 is booked with its receipt attached on Payments, though the invoice is not a document
    // linked to the payment (it waits for the rest). Eight payments in October, and only Kiezdruck's receipt is missing.
    expect(sara.documents.some((doc) => doc.paymentId === 'sy-t15')).toBe(false);
    const october = periodOf(sara, 'month', '2026-10');
    expect(exportSummary(sara, october, DEMO_TODAY)).toEqual({ bookings: 8, receipts: 7, needsYou: 3, state: 'running', empty: false });
    expect(exportRows(sara, october).find((row) => row.date === '2026-10-21')).toMatchObject({
      counterparty: 'Physio Zentrum Mitte',
      receipt: 'attached',
      open: false,
    });
    // The same payments are in Q4 and the year.
    expect(exportSummary(sara, periodOf(sara, 'quarter', '2026-Q4'), DEMO_TODAY).receipts).toBe(7);
    expect(exportSummary(sara, periodOf(sara, 'year', '2026'), DEMO_TODAY).receipts).toBe(7 + 4 + 3); // October, September (4 payments), August (3)
  });

  it('a payment that needs no receipt has none, is not a receipt in the count, and does not need the person', () => {
    const noReceiptNeeded = {
      ...weber,
      transactions: weber.transactions.map((tx) => (tx.id === 'wd-t3' ? { ...tx, receipt: 'notNeeded' as const } : tx)),
    };
    const october = periodOf(noReceiptNeeded, 'month', '2026-10');
    expect(exportSummary(noReceiptNeeded, october, DEMO_TODAY)).toMatchObject({ bookings: 11, receipts: 8, needsYou: 5 });
    expect(exportRows(noReceiptNeeded, october).find((row) => row.counterparty === 'Deutsche Bahn')).toMatchObject({
      receipt: 'notNeeded',
      open: false,
    });
  });

  it('a row says whether its receipt is attached, missing or not needed, as the payment has it', () => {
    const october = periodOf(weber, 'month', '2026-10');
    const withReceipt = (receipt: 'attached' | 'missing' | 'notNeeded') => ({
      ...weber,
      transactions: weber.transactions.map((tx) => (tx.id === 'wd-t3' ? { ...tx, receipt } : tx)),
    });
    const bahn = (b: typeof weber) => exportRows(b, october).find((row) => row.counterparty === 'Deutsche Bahn')!;
    expect(bahn(withReceipt('attached')).receipt).toBe('attached');
    expect(bahn(withReceipt('missing'))).toMatchObject({ receipt: 'missing', open: true });
    expect(bahn(withReceipt('notNeeded'))).toMatchObject({ receipt: 'notNeeded', open: false });
    // Only an attached receipt is a receipt in the summary.
    const receipts = (b: typeof weber) => exportSummary(b, october, DEMO_TODAY).receipts;
    expect(receipts(withReceipt('attached'))).toBe(receipts(withReceipt('missing')) + 1);
    expect(receipts(withReceipt('notNeeded'))).toBe(receipts(withReceipt('missing')));
  });

  it('private payments are not bookings', () => {
    // August at Weber Design has four payments, one of them the private cash payment at Edeka.
    expect(weber.transactions.filter((tx) => tx.date.startsWith('2026-08')).length).toBe(4);
    expect(exportSummary(weber, periodOf(weber, 'month', '2026-08'), DEMO_TODAY)).toMatchObject({ bookings: 3, receipts: 3, needsYou: 0 });
  });

  it('a period adds up its months, whatever state each is in', () => {
    const q3 = exportSummary(cafe, periodOf(cafe, 'quarter', '2026-Q3'), DEMO_TODAY);
    expect(q3).toEqual({ bookings: 12, receipts: 12, needsYou: 0, state: 'notClosed', empty: false });
    const year = exportSummary(sara, periodOf(sara, 'year', '2026'), DEMO_TODAY);
    expect(year.bookings).toBe(sara.transactions.length);
    expect(year.needsYou).toBe(3); // Anna Keller (not confirmed), Decathlon (no category), Kiezdruck (no receipt)
  });

  it('a mixed quarter is partly closed; an empty period has nothing to export', () => {
    // Sara's Q3: July is in the opening line and August was closed, but September is not closed.
    expect(exportSummary(sara, periodOf(sara, 'quarter', '2026-Q3'), DEMO_TODAY).state).toBe('partly');
    // Weber's year holds the opening line and two closed months, and October is running.
    expect(exportSummary(weber, periodOf(weber, 'year', '2026'), DEMO_TODAY).state).toBe('partly');
    expect(exportSummary(cafe, periodOf(cafe, 'year', '2026'), DEMO_TODAY).state).toBe('partly');
    // A quarter whose months are all closed, or all not closed, reads as that.
    expect(exportSummary(weber, periodOf(weber, 'quarter', '2026-Q3'), DEMO_TODAY).state).toBe('closed');
    expect(exportSummary(sara, periodOf(sara, 'month', '2026-09'), DEMO_TODAY).state).toBe('notClosed');
    expect(exportSummary(cafe, periodOf(cafe, 'month', '2026-08'), DEMO_TODAY).state).toBe('notClosed');

    // Nothing to export: no payments in the period (the running month with none yet), or only private ones.
    const bare = without(weber, () => true);
    expect(exportSummary(bare, periodOf(bare, 'month', '2026-10'), DEMO_TODAY)).toEqual({
      bookings: 0,
      receipts: 0,
      needsYou: 0,
      state: 'running',
      empty: true,
    });
    const onlyPrivate = without(weber, (tx) => !(tx.date.startsWith('2026-08') && tx.isPrivate));
    expect(exportSummary(onlyPrivate, periodOf(weber, 'month', '2026-08'), DEMO_TODAY)).toMatchObject({ bookings: 0, empty: true });
  });

  it('a quarter with one month closed by hand is partly closed, with no opening row in it', () => {
    // Café Linde's opening line ends in June, so Q3 is three month rows: July and September not closed, August closed by hand.
    const closed = closeMonth(cafe, '2026-08', 'Jonas Linde', DEMO_TODAY);
    expect(closed.closedMonths.map((c) => c.month)).toEqual(['2026-08']);
    expect(exportSummary(closed, periodOf(closed, 'quarter', '2026-Q3'), DEMO_TODAY)).toMatchObject({ state: 'partly', bookings: 12 });
    expect(exportSummary(closed, periodOf(closed, 'month', '2026-08'), DEMO_TODAY).state).toBe('closed');
    expect(exportSummary(closed, periodOf(closed, 'month', '2026-09'), DEMO_TODAY).state).toBe('notClosed');
  });

  it('a business made in the demo has only October, and nothing to export until its bank brings payments', () => {
    const owner = { personId: 'p-mia', name: 'Mia Test', email: 'mia@example.com' };
    const made = newBusiness('new-1', { name: 'Mia Test Studio', kind: 'freelance', legalForm: 'sole' }, owner);
    expect(keys(made, 'month')).toEqual(['2026-10']);
    expect(keys(made, 'quarter')).toEqual(['2026-Q4']);
    expect(keys(made, 'year')).toEqual(['2026']);
    // Its year starts with an empty opening line, which Month by month has no row for, so the year is running, not partly closed.
    for (const kind of ['month', 'quarter', 'year'] as const) {
      const [period] = exportPeriods(made, kind, DEMO_TODAY);
      expect(exportSummary(made, period, DEMO_TODAY), kind).toEqual({ bookings: 0, receipts: 0, needsYou: 0, state: 'running', empty: true });
      expect(exportRows(made, period), kind).toEqual([]);
    }

    // Its bank brings eight October payments, none with a receipt yet, so every one needs the person.
    const withPayments = { ...made, transactions: newBusinessPayments(made.id, newBusinessAccount(made.id, 'Qonto'), owner.name) };
    const [year] = exportPeriods(withPayments, 'year', DEMO_TODAY);
    expect(exportSummary(withPayments, year, DEMO_TODAY)).toEqual({ bookings: 8, receipts: 0, needsYou: 8, state: 'running', empty: false });
  });

  it('a period outside the months Reports lists follows the closed months', () => {
    // Before the first payment (the opening line) a month counts as closed, though Month by month has no row for it.
    const bare = without(weber, () => true);
    const noOpening: Business = { ...bare, yearOpening: { ...bare.yearOpening, incomeCents: 0, costsCents: 0 } };
    const may: ExportPeriod = { kind: 'month', key: '2026-05', start: '2026-05-01', end: '2026-05-31' };
    expect(exportSummary(noOpening, may, DEMO_TODAY)).toMatchObject({ state: 'closed', empty: true });
  });
});

describe('exportRows', () => {
  it('export rows mark the open payments and leave private ones out', () => {
    const august = exportRows(weber, periodOf(weber, 'month', '2026-08'));
    // Oldest first; Edeka (private, cash) is not there.
    expect(august.map((row) => [row.date, row.counterparty])).toEqual([
      ['2026-08-05', 'Coworking Mitte'],
      ['2026-08-21', 'Telekom'],
      ['2026-08-28', 'Müller GmbH'],
    ]);
    expect(august[0]).toEqual({
      date: '2026-08-05',
      counterparty: 'Coworking Mitte',
      amountCents: -35700,
      skr03: RENT.skr03,
      nameDe: RENT.nameDe,
      vatRate: 19,
      receipt: 'attached',
      open: false,
    });
    expect(august[2].amountCents).toBe(150000); // money in is positive

    const october = exportRows(weber, periodOf(weber, 'month', '2026-10'));
    expect(october.map((row) => row.date)).toEqual([...october.map((row) => row.date)].sort());
    const open = october.filter((row) => row.open).map((row) => row.counterparty);
    expect(open.sort()).toEqual(['Amazon', 'Amazon', 'Deutsche Bahn', 'Kern Studio Berlin', 'Müller GmbH', 'SCHREIBWAREN BOETTCHER']);
    expect(october.filter((row) => !row.open && row.receipt === 'missing')).toEqual([]);
  });

  it('an open row keeps what the payment has: a suggested booking, or none at all', () => {
    const october = exportRows(weber, periodOf(weber, 'month', '2026-10'));
    // Kern Studio: booked and confirmed, but the receipt is missing.
    expect(october.find((row) => row.counterparty === 'Kern Studio Berlin')).toMatchObject({ skr03: '8400', vatRate: 19, receipt: 'missing', open: true });
    // An Amazon order with no category yet: no account and no rate, though its receipt is there.
    const unclear = october.find((row) => row.date === '2026-10-02')!;
    expect(unclear).toMatchObject({ counterparty: 'Amazon', skr03: null, nameDe: null, vatRate: null, receipt: 'attached', open: true });
  });

  it('the rows agree with the summary: a row per booking, the open ones, and the receipts', () => {
    for (const b of BUSINESSES) {
      for (const kind of ['month', 'quarter', 'year'] as const) {
        for (const period of exportPeriods(b, kind, DEMO_TODAY)) {
          const rows = exportRows(b, period);
          const summary = exportSummary(b, period, DEMO_TODAY);
          const label = `${b.id} ${period.key}`;
          expect(rows.length, label).toBe(summary.bookings);
          expect(rows.filter((row) => row.open).length, label).toBe(summary.needsYou);
          expect(rows.filter((row) => row.receipt === 'attached').length, label).toBe(summary.receipts);
          expect(summary.empty, label).toBe(rows.length === 0);
        }
      }
    }
  });
});

describe('file names', () => {
  it('file names follow <id>_DATEV_<key>.zip / .csv and <id>_GDPdU_<year>.zip', () => {
    const october = periodOf(weber, 'month', '2026-10');
    expect(exportFileName('weber-design', october, 'datev')).toBe('weber-design_DATEV_2026-10.zip');
    expect(exportFileName('weber-design', october, 'csv')).toBe('weber-design_DATEV_2026-10.csv');
    expect(exportFileName('cafe-linde', periodOf(cafe, 'quarter', '2026-Q3'), 'datev')).toBe('cafe-linde_DATEV_2026-Q3.zip');
    expect(exportFileName('sara-yoga', periodOf(sara, 'year', '2026'), 'csv')).toBe('sara-yoga_DATEV_2026.csv');
    expect(auditFileName('weber-design', 2026)).toBe('weber-design_GDPdU_2026.zip');
  });
});
