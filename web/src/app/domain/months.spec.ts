import { TestBed } from '@angular/core/testing';
import { REVENUE_19, SOFTWARE } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Business, Doc, Transaction } from '../data/models';
import { newBusiness } from '../data/new-business-sample';
import { BUSINESSES } from '../data/sample-data';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { canCloseMonths, closeCheck, closeMonth, closeMonthsOf, isClosedDate, monthRows, yearTotals, type MonthRow } from './months';
import { changeCategory, confirmBooking, setPrivate } from './payment-actions';
import { yearSummary } from './tax-year';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const weber = business('weber-design');
const sara = business('sara-yoga');
const cafe = business('cafe-linde');

/** One payment of a business, replaced by the result of `change`. */
const withPayment = (b: Business, id: string, change: (tx: Transaction) => Transaction): Business => ({
  ...b,
  transactions: b.transactions.map((tx) => (tx.id === id ? change(tx) : tx)),
});

/** A booked payment dated `date`, a copy of a sample payment (income or costs by its amount). */
const payment = (id: string, date: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction => ({
  ...weber.transactions.find((tx) => tx.id === 'wd-t9')!,
  id,
  date,
  amountCents,
  booking: amountCents > 0 ? REVENUE_19 : SOFTWARE,
  ...patch,
});

/** The rows' months, one word each: a month row is its month, the opening row `from>until`. */
const label = (row: MonthRow): string => (row.kind === 'opening' ? `${row.from}>${row.until}` : row.from);
const states = (rows: MonthRow[]): [string, string][] => rows.map((row) => [label(row), row.state]);

describe('monthRows', () => {
  it('is the opening line, then every month after it up to the current one', () => {
    expect(states(monthRows(weber, DEMO_TODAY))).toEqual([
      ['2026-01>2026-07', 'closed'],
      ['2026-08', 'closed'],
      ['2026-09', 'closed'],
      ['2026-10', 'running'],
    ]);
    expect(states(monthRows(cafe, DEMO_TODAY))).toEqual([
      ['2026-01>2026-06', 'closed'],
      ['2026-07', 'notClosed'],
      ['2026-08', 'notClosed'],
      ['2026-09', 'notClosed'],
      ['2026-10', 'running'],
    ]);
  });

  it('October is running and September is not closed at Sara Weber Yoga', () => {
    const rows = monthRows(sara, DEMO_TODAY);
    expect(states(rows)).toEqual([
      ['2026-01>2026-07', 'closed'],
      ['2026-08', 'closed'],
      ['2026-09', 'notClosed'],
      ['2026-10', 'running'],
    ]);
    expect(rows.filter((row) => row.kind === 'month').every((row) => row.from === row.until)).toBe(true);
  });

  it("a month row's figures are the booked payments dated in it, net of VAT for a business that charges VAT", () => {
    const september = monthRows(weber, DEMO_TODAY)[2];
    // Müller 1 500,00 and Atelier Sommer 1 785,00 gross; Telekom 39,95 and the rent 357,00 gross.
    expect(september).toMatchObject({ incomeCents: 126050 + 150000, costsCents: 3357 + 30000, profitCents: 276050 - 33357 });
  });

  it("a Kleinunternehmer's month is gross", () => {
    const september = monthRows(sara, DEMO_TODAY)[2];
    expect(september).toMatchObject({ incomeCents: 96000 + 12000, costsCents: 35000 + 1590, profitCents: 108000 - 36590 });
  });

  it('the opening row is the stored opening line, and it is closed', () => {
    for (const b of BUSINESSES) {
      const [opening] = monthRows(b, DEMO_TODAY);
      expect(opening, b.id).toMatchObject({
        kind: 'opening',
        from: '2026-01',
        until: b.yearOpening.untilMonth,
        incomeCents: b.yearOpening.incomeCents,
        costsCents: b.yearOpening.costsCents,
        state: 'closed',
      });
    }
  });

  it('the opening row is closed and left out when it is empty', () => {
    const noOpening = { ...weber.yearOpening, incomeCents: 0, costsCents: 0, costsByCategory: [] };
    const early = (b: Business) => b.transactions.filter((tx) => tx.date.slice(0, 7) <= '2026-07');

    // No amounts and no payments in it: no opening row, the months start at August.
    const empty = { ...weber, yearOpening: noOpening };
    expect(early(empty)).toEqual([]);
    expect(states(monthRows(empty, DEMO_TODAY))).toEqual([
      ['2026-08', 'closed'],
      ['2026-09', 'closed'],
      ['2026-10', 'running'],
    ]);

    // A payment inside it keeps the row, with that payment in it.
    const july = payment('wd-early', '2026-07-03', 11900);
    const [opening] = monthRows({ ...empty, transactions: [...empty.transactions, july] }, DEMO_TODAY);
    expect(opening).toMatchObject({ kind: 'opening', until: '2026-07', incomeCents: 10000, state: 'closed' });

    // Amounts alone keep it too.
    expect(monthRows({ ...empty, yearOpening: { ...noOpening, incomeCents: 100 } }, DEMO_TODAY)[0].kind).toBe('opening');
  });

  it('a business made in the demo has only its running October, until a bank brings payments', () => {
    const made = newBusiness('new-1', { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' }, { personId: 'p9', name: 'Mia', email: 'mia@example.com' });
    expect(states(monthRows(made, DEMO_TODAY))).toEqual([['2026-10', 'running']]);
  });

  it('a payment dated after today is not in the figures, as in the Taxes year', () => {
    const later = { ...weber, transactions: [...weber.transactions, payment('wd-later', '2026-10-25', 119000)] };
    expect(yearTotals(monthRows(later, DEMO_TODAY))).toEqual(yearTotals(monthRows(weber, DEMO_TODAY)));
    expect(yearSummary(later).incomeCents).toBe(yearSummary(weber).incomeCents);
  });

  it('a payment that needs the person, or is private, is not in a month figure', () => {
    const october = (b: Business) => monthRows(b, DEMO_TODAY).at(-1)!;
    const unclear = withPayment(weber, 'wd-t7', (tx) => ({ ...tx, booking: null }));
    expect(october(unclear).incomeCents).toBe(october(weber).incomeCents - 250000); // 2 975,00 gross is 2 500,00 net
    const priv = withPayment(weber, 'wd-t7', (tx) => setPrivate(tx, true));
    expect(october(priv).incomeCents).toBe(october(weber).incomeCents - 250000);
  });
});

describe('the months add up to the Taxes year', () => {
  const sameAsTaxes = (b: Business) => {
    const s = yearSummary(b);
    expect(yearTotals(monthRows(b, DEMO_TODAY)), b.id).toEqual({ incomeCents: s.incomeCents, costsCents: s.costsCents, profitCents: s.profitCents });
  };

  it('month rows add up to the Taxes year, before and after a change', () => {
    for (const b of BUSINESSES) sameAsTaxes(b);

    // Confirming a payment moves income into October, in both.
    const before = yearTotals(monthRows(weber, DEMO_TODAY)).incomeCents;
    const confirmed = withPayment(weber, 'wd-t1', confirmBooking);
    sameAsTaxes(confirmed);
    expect(yearTotals(monthRows(confirmed, DEMO_TODAY)).incomeCents).toBe(before + 126050); // 1 500,00 gross is 1 260,50 net

    // Booking an unclear payment moves costs.
    const booked = withPayment(weber, 'wd-t4', (tx) => changeCategory(tx, SOFTWARE));
    sameAsTaxes(booked);
    expect(yearTotals(monthRows(booked, DEMO_TODAY)).costsCents).toBe(yearTotals(monthRows(weber, DEMO_TODAY)).costsCents + 4118); // 49,00 gross is 41,18 net

    // Marking a payment private takes it out.
    sameAsTaxes(withPayment(weber, 'wd-t2', (tx) => setPrivate(tx, true)));
    sameAsTaxes(withPayment(sara, 'sy-t3', (tx) => setPrivate(tx, true)));
  });

  it('they also agree on another day of the year', () => {
    for (const b of BUSINESSES) {
      const s = yearSummary(b, '2026-09-30');
      expect(yearTotals(monthRows(b, '2026-09-30')), b.id).toEqual({ incomeCents: s.incomeCents, costsCents: s.costsCents, profitCents: s.profitCents });
    }
  });
});

describe('yearTotals', () => {
  it('adds income and costs of the rows, and the profit is the difference', () => {
    const row = (incomeCents: number, costsCents: number): MonthRow => ({ kind: 'month', from: '2026-08', until: '2026-08', incomeCents, costsCents, profitCents: incomeCents - costsCents, state: 'closed' });
    expect(yearTotals([row(1000, 300), row(500, 900)])).toEqual({ incomeCents: 1500, costsCents: 1200, profitCents: 300 });
    expect(yearTotals([])).toEqual({ incomeCents: 0, costsCents: 0, profitCents: 0 });
  });
});

describe('isClosedDate', () => {
  it('is true inside a closed month and inside the earlier months, false in any other month', () => {
    expect(isClosedDate(weber, '2026-09-30')).toBe(true);
    expect(isClosedDate(weber, '2026-08-01')).toBe(true);
    expect(isClosedDate(weber, '2026-07-31')).toBe(true);
    expect(isClosedDate(weber, '2026-01-01')).toBe(true);
    expect(isClosedDate(weber, '2026-10-01')).toBe(false);
    expect(isClosedDate(sara, '2026-09-30')).toBe(false);
    expect(isClosedDate(sara, '2026-08-29')).toBe(true);
    expect(isClosedDate(cafe, '2026-06-30')).toBe(true);
    expect(isClosedDate(cafe, '2026-07-01')).toBe(false);
  });

  it('a date before the year is closed too', () => {
    expect(isClosedDate(cafe, '2025-12-31')).toBe(true);
  });

  it('follows a month once it is closed', () => {
    expect(isClosedDate(sara, '2026-09-10')).toBe(false);
    expect(isClosedDate(closeMonth(sara, '2026-09', 'Sara Weber', DEMO_TODAY), '2026-09-10')).toBe(true);
  });
});

describe('a payment in the earlier months', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a payment in the earlier months joins that line', () => {
    const demo = TestBed.inject(DemoStateService);
    const invoices = TestBed.inject(InvoiceService);
    const before = demo.business();
    const lineBefore = monthRows(before, DEMO_TODAY)[0];

    // Weber Design's invoice RE-2026-044 (2 380,00 gross) is paid in cash, in July.
    invoices.markPaidInCash('inv-wd-044', '2026-07-15');
    const after = demo.business();
    const payments = after.transactions.filter((tx) => !before.transactions.includes(tx));
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ date: '2026-07-15', amountCents: 238000 });

    const rows = monthRows(after, DEMO_TODAY);
    expect(rows.map(label)).toEqual(monthRows(before, DEMO_TODAY).map(label)); // no July row
    expect(rows.some((row) => row.kind === 'month' && row.from === '2026-07')).toBe(false);
    expect(rows[0]).toMatchObject({ kind: 'opening', from: '2026-01', until: '2026-07', state: 'closed' });
    expect(rows[0].incomeCents).toBe(lineBefore.incomeCents + 200000); // 2 380,00 gross is 2 000,00 net
    expect(rows[0].costsCents).toBe(lineBefore.costsCents);
    expect(isClosedDate(after, '2026-07-15')).toBe(true);
    // And the Taxes year still agrees.
    expect(yearTotals(rows).incomeCents).toBe(yearSummary(after).incomeCents);
  });
});

describe('closeCheck', () => {
  it('closeCheck counts unclear, unconfirmed and receipt-less payments and blocks', () => {
    // October at Weber Design: Amazon twice with no category, Müller GmbH to confirm, and four payments with no receipt (the APCOA parking too).
    expect(closeCheck(weber, '2026-10')).toMatchObject({ unclear: 2, confirm: 1, noReceipt: 4, blocked: true });
  });

  it('a month where every payment is booked and has its receipt does not block', () => {
    expect(closeCheck(sara, '2026-09')).toMatchObject({ unclear: 0, confirm: 0, noReceipt: 0, duplicateDocIds: [], blocked: false });
    expect(closeCheck(cafe, '2026-08')).toMatchObject({ unclear: 0, confirm: 0, noReceipt: 0, blocked: false });
  });

  it('counts only the payments dated in the month', () => {
    const september = withPayment(sara, 'sy-t10', (tx) => ({ ...tx, confirmed: false }));
    expect(closeCheck(september, '2026-09')).toMatchObject({ confirm: 1, blocked: true });
    expect(closeCheck(september, '2026-08')).toMatchObject({ confirm: 0, blocked: false });
    expect(closeCheck(september, '2026-10')).toMatchObject({ unclear: 1, noReceipt: 1, blocked: true }); // Decathlon, Kiezdruck
  });

  it('each kind alone blocks', () => {
    expect(closeCheck(withPayment(sara, 'sy-t10', (tx) => ({ ...tx, booking: null })), '2026-09')).toMatchObject({ unclear: 1, blocked: true });
    expect(closeCheck(withPayment(sara, 'sy-t10', (tx) => ({ ...tx, confirmed: false })), '2026-09')).toMatchObject({ confirm: 1, blocked: true });
    expect(closeCheck(withPayment(sara, 'sy-t10', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null })), '2026-09')).toMatchObject({ noReceipt: 1, blocked: true });
  });

  it('a possible duplicate only warns', () => {
    const doc: Doc = { ...sara.documents[0], id: 'sy-dup', duplicateOf: sara.documents[1].id, date: '2026-09-12' };
    const check = closeCheck({ ...sara, documents: [doc, ...sara.documents] }, '2026-09');
    expect(check.duplicateDocIds).toEqual(['sy-dup']);
    expect(check.blocked).toBe(false);
  });

  it('a duplicate is counted in the month of its date, or of the day it was added when it has none', () => {
    const base = sara.documents[0];
    const other: Doc = { ...base, id: 'dup-aug', duplicateOf: 'x', date: '2026-08-12' };
    const undated: Doc = { ...base, id: 'dup-undated', duplicateOf: 'x', date: null, addedOn: '2026-09-20' };
    const reading: Doc = { ...base, id: 'dup-reading', duplicateOf: 'x', date: '2026-09-02', reading: true }; // still being read: not a duplicate yet
    const notDup: Doc = { ...base, id: 'plain', duplicateOf: null, date: '2026-09-02' };
    const b = { ...sara, documents: [other, undated, reading, notDup] };
    expect(closeCheck(b, '2026-09').duplicateDocIds).toEqual(['dup-undated']);
    expect(closeCheck(b, '2026-08').duplicateDocIds).toEqual(['dup-aug']);
  });

  it('a connected account matches; a statement account says to check it', () => {
    expect(closeCheck(cafe, '2026-09').accounts).toEqual([
      { accountId: 'cl-qonto', result: 'matches' },
      { accountId: 'cl-sparkasse', result: 'statement' },
    ]); // the cash box is left out
    expect(closeCheck(weber, '2026-09').accounts).toEqual([{ accountId: 'wd-qonto', result: 'matches' }]);
  });

  /** The business with one account's connection changed, as the bank would report it. */
  const withConnection = (b: Business, accountId: string, change: Partial<Account['connection']>): Business => ({
    ...b,
    accounts: b.accounts.map((a) => (a.id === accountId ? { ...a, connection: { ...a.connection, ...change } } : a)),
  });

  it('a connected account matches when the bank delivered after the month ended, even if its consent ended since', () => {
    // Sara Weber Yoga's Qonto: the consent ended on 20 Oct, but the bank last delivered on 20 Oct, after September ended.
    const qonto = sara.accounts.find((a) => a.id === 'sy-qonto')!.connection;
    expect(qonto.consentUntil).toBe('2026-10-20');
    expect(qonto.lastFetched).toBe('2026-10-20T06:10');
    expect(closeCheck(sara, '2026-09').accounts).toEqual([{ accountId: 'sy-qonto', result: 'matches' }]);
    expect(closeCheck(sara, '2026-08').accounts).toEqual([{ accountId: 'sy-qonto', result: 'matches' }]);
  });

  it('a connected account says to check it when the bank has not delivered since the month ended', () => {
    // The last delivery was still inside September: nothing after its last day was ever fetched.
    const early = withConnection(weber, 'wd-qonto', { lastFetched: '2026-09-30T23:59' });
    expect(closeCheck(early, '2026-09').accounts).toEqual([{ accountId: 'wd-qonto', result: 'statement' }]);
    // October has not ended: the sample's last delivery is on the 22nd.
    expect(closeCheck(weber, '2026-10').accounts).toEqual([{ accountId: 'wd-qonto', result: 'statement' }]);
    // A connected account that was never fetched has delivered nothing.
    expect(closeCheck(withConnection(weber, 'wd-qonto', { lastFetched: null }), '2026-09').accounts).toEqual([
      { accountId: 'wd-qonto', result: 'statement' },
    ]);
  });

  it('a delivery on the day after the month ended is enough, at any time that day', () => {
    for (const lastFetched of ['2026-10-01T00:00', '2026-10-01T06:12', '2026-10-01']) {
      const fetched = withConnection(weber, 'wd-qonto', { lastFetched });
      expect(closeCheck(fetched, '2026-09').accounts, lastFetched).toEqual([{ accountId: 'wd-qonto', result: 'matches' }]);
    }
    // December ends on the 31st, and the day after is 1 Jan of the next year.
    const january = withConnection(weber, 'wd-qonto', { lastFetched: '2027-01-01T00:00' });
    expect(closeCheck(january, '2026-12').accounts).toEqual([{ accountId: 'wd-qonto', result: 'matches' }]);
    const newYearsEve = withConnection(weber, 'wd-qonto', { lastFetched: '2026-12-31T23:59' });
    expect(closeCheck(newYearsEve, '2026-12').accounts).toEqual([{ accountId: 'wd-qonto', result: 'statement' }]);
  });

  it('a connection that the bank reports as broken says to check it, however recent its last delivery', () => {
    expect(closeCheck(withConnection(weber, 'wd-qonto', { broken: true }), '2026-09').accounts).toEqual([
      { accountId: 'wd-qonto', result: 'statement' },
    ]);
  });

  it('what the bank delivered decides, not the day the consent ends', () => {
    const endsSoon = withConnection(weber, 'wd-qonto', { consentUntil: '2026-11-01' });
    expect(closeCheck(endsSoon, '2026-09').accounts).toEqual([{ accountId: 'wd-qonto', result: 'matches' }]);
    const ended = withConnection(weber, 'wd-qonto', { consentUntil: '2026-10-02' });
    expect(closeCheck(ended, '2026-09').accounts).toEqual([{ accountId: 'wd-qonto', result: 'matches' }]);
  });

  it('a business with no account has none to check', () => {
    expect(closeCheck({ ...weber, accounts: [] }, '2026-09').accounts).toEqual([]);
  });
});

describe('canCloseMonths', () => {
  it('only the owner and someone with full access can close a month', () => {
    expect(canCloseMonths('owner')).toBe(true);
    expect(canCloseMonths('full')).toBe(true);
    expect(canCloseMonths('receipts')).toBe(false);
    expect(canCloseMonths('advisor')).toBe(false);
    expect(canCloseMonths(null)).toBe(false); // no access to the business at all
  });
});

describe('closeMonth', () => {
  it('closing a month adds it, dated today and by the person, with one history line in front', () => {
    const closed = closeMonth(sara, '2026-09', 'Sara Weber', DEMO_TODAY);
    expect(closed.closedMonths).toEqual([...sara.closedMonths, { month: '2026-09', on: DEMO_TODAY, by: 'Sara Weber' }]);
    expect(closed.history).toEqual([{ date: DEMO_TODAY, key: 'monthClosed', params: { month: '2026-09', by: 'Sara Weber' } }, ...sara.history]);
    expect(closed).toEqual({ ...sara, closedMonths: closed.closedMonths, history: closed.history });
    expect(sara.closedMonths).toHaveLength(1); // the business it was given is left as it was
  });

  it('closeMonth refuses the running, closed, blocked and opening months', () => {
    const blocked = withPayment(sara, 'sy-t10', (tx) => ({ ...tx, confirmed: false }));
    expect(closeCheck(blocked, '2026-09').blocked).toBe(true);

    const refused: [string, Business, string][] = [
      ['the running month', sara, '2026-10'],
      ['a month still to come', sara, '2026-11'],
      ['a closed month', sara, '2026-08'],
      ['a month closed by its VAT return', weber, '2026-09'],
      ['a month with a payment that needs the person', blocked, '2026-09'],
      ['the last month of the opening line', sara, '2026-07'],
      ['a month inside the opening line', cafe, '2026-03'],
    ];
    for (const [name, b, month] of refused) {
      expect(closeMonth(b, month, 'Sara Weber', DEMO_TODAY), name).toBe(b);
    }
  });

  it('keeps the closed months in order of the month, whichever is closed first', () => {
    const september = closeMonth(cafe, '2026-09', 'Jonas Linde', DEMO_TODAY);
    const both = closeMonth(september, '2026-07', 'Jonas Linde', '2026-10-23');
    expect(both.closedMonths).toEqual([
      { month: '2026-07', on: '2026-10-23', by: 'Jonas Linde' },
      { month: '2026-09', on: DEMO_TODAY, by: 'Jonas Linde' },
    ]);
    expect(both.history.map((line) => line.params['month'])).toEqual(['2026-07', '2026-09']);
  });
});

describe('closeMonthsOf', () => {
  const lines = (b: Business) => b.history.filter((line) => line.key === 'monthClosed' || line.key === 'monthClosedByReturn');

  it('closes every month of the period that is not closed, by nobody, with one line each and no check', () => {
    const unconfirmed = withPayment(cafe, 'cl-t16', (tx) => ({ ...tx, confirmed: false })); // July has a payment that needs the person
    const closed = closeMonthsOf(unconfirmed, '2026-07-01', '2026-09-30', DEMO_TODAY);
    expect(closed.closedMonths).toEqual([
      { month: '2026-07', on: DEMO_TODAY, by: null },
      { month: '2026-08', on: DEMO_TODAY, by: null },
      { month: '2026-09', on: DEMO_TODAY, by: null },
    ]);
    expect(lines(closed)).toEqual([
      { date: DEMO_TODAY, key: 'monthClosedByReturn', params: { month: '2026-09' } },
      { date: DEMO_TODAY, key: 'monthClosedByReturn', params: { month: '2026-08' } },
      { date: DEMO_TODAY, key: 'monthClosedByReturn', params: { month: '2026-07' } },
    ]);
    expect(closed.history).toHaveLength(unconfirmed.history.length + 3);
  });

  it('closes a month once: one closed by hand keeps its day and its person, with no second line, and a second call adds nothing', () => {
    const byHand = closeMonth(cafe, '2026-08', 'Sara Weber', '2026-10-01');
    const closed = closeMonthsOf(byHand, '2026-07-01', '2026-09-30', DEMO_TODAY);
    expect(closed.closedMonths).toEqual([
      { month: '2026-07', on: DEMO_TODAY, by: null },
      { month: '2026-08', on: '2026-10-01', by: 'Sara Weber' },
      { month: '2026-09', on: DEMO_TODAY, by: null },
    ]);
    expect(lines(closed).map((line) => [line.params['month'], line.params['by'] ?? 'return'])).toEqual([
      ['2026-09', 'return'],
      ['2026-07', 'return'],
      ['2026-08', 'Sara Weber'],
    ]);

    expect(closeMonthsOf(closed, '2026-07-01', '2026-09-30', DEMO_TODAY)).toBe(closed);
  });

  it('leaves out the months of the opening line and the running month', () => {
    // May and June are inside the opening line, which is closed already; only July is left.
    const closed = closeMonthsOf(cafe, '2026-05-01', '2026-07-31', DEMO_TODAY);
    expect(closed.closedMonths.map((c) => c.month)).toEqual(['2026-07']);
    expect(lines(closed)).toHaveLength(1);

    // October is still running: a return for a period that holds it closes September only.
    expect(closeMonthsOf(cafe, '2026-09-01', '2026-10-31', DEMO_TODAY).closedMonths.map((c) => c.month)).toEqual(['2026-09']);
  });

  it('a period with nothing to close is the same business', () => {
    expect(closeMonthsOf(weber, '2026-08-01', '2026-09-30', DEMO_TODAY)).toBe(weber);
    expect(closeMonthsOf(weber, '2026-01-01', '2026-07-31', DEMO_TODAY)).toBe(weber);
  });

  it('a single month works the same: a monthly return closes its month', () => {
    expect(closeMonthsOf(cafe, '2026-08-01', '2026-08-31', DEMO_TODAY).closedMonths).toEqual([{ month: '2026-08', on: DEMO_TODAY, by: null }]);
  });
});
