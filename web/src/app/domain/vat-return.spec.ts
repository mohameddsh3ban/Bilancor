import { PRIVATE_IN, PRIVATE_OUT, REVENUE_19, REVENUE_7, RENT, SALARIES, SOFTWARE } from '../data/categories';
import type { Business, Booking, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  DUE_SOON_DAYS,
  currentVatReturn,
  daysLeftWording,
  dueDateFor,
  nextPeriod,
  periodFor,
  resultWording,
  sentPeriod,
  vatPartCents,
  vatReturnFor,
  type TaxPeriod,
  type VatReturnView,
} from './vat-return';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const weber = business('weber-design');
const cafe = business('cafe-linde');
const sara = business('sara-yoga');

/** A sample payment with its amount and booking replaced. */
const payment = (amountCents: number, booking: Booking | null, patch: Partial<Transaction> = {}): Transaction => ({
  ...weber.transactions[1],
  amountCents,
  booking,
  confirmed: true,
  receipt: 'attached',
  ...patch,
});

/** The open VAT return of a business, which must be one with dates (not yearly, not a Kleinunternehmer). */
function viewOf(b: Business, today?: string): VatReturnView {
  const current = currentVatReturn(b, today);
  if (current?.kind !== 'return') throw new Error(`${b.id} has no VAT return with a date`);
  return current.view;
}

/** A business with other tax answers. */
const withTax = (b: Business, patch: Partial<Business['taxProfile']>): Business => ({ ...b, taxProfile: { ...b.taxProfile, ...patch } });

describe('vatPartCents', () => {
  it('19 % of 119.00 is 19.00', () => {
    expect(vatPartCents(payment(11900, REVENUE_19))).toBe(1900);
  });

  it('7 % of 107.00 is 7.00', () => {
    expect(vatPartCents(payment(10700, REVENUE_7))).toBe(700);
  });

  it('is the same for money out, whose amount is negative', () => {
    expect(vatPartCents(payment(-11900, SOFTWARE))).toBe(1900);
    expect(vatPartCents(payment(-10700, { ...SOFTWARE, vatRate: 7 }))).toBe(700);
  });

  it('rounds to the cent', () => {
    expect(vatPartCents(payment(-3995, SOFTWARE))).toBe(638); // 637.86
    expect(vatPartCents(payment(-6430, RENT))).toBe(1027); // 1026.72
    expect(vatPartCents(payment(1, REVENUE_19))).toBe(0);
    expect(vatPartCents(payment(100, REVENUE_19))).toBe(16); // 15.97
  });

  it('is 0 for a booking with no VAT, a private booking, and a payment with no booking', () => {
    expect(vatPartCents(payment(-310000, SALARIES))).toBe(0);
    expect(vatPartCents(payment(-6430, PRIVATE_OUT, { isPrivate: true }))).toBe(0);
    expect(vatPartCents(payment(20000, PRIVATE_IN, { isPrivate: true }))).toBe(0);
    expect(vatPartCents(payment(-4900, null))).toBe(0);
  });
});

describe('periods and due dates', () => {
  const monthly = (start: string, end: string): TaxPeriod => ({ start, end, kind: 'monthly' });
  const quarterly = (start: string, end: string): TaxPeriod => ({ start, end, kind: 'quarterly' });

  it('periodFor cuts a calendar month or a calendar quarter around a date', () => {
    expect(periodFor('2026-10-22', 'monthly')).toEqual(monthly('2026-10-01', '2026-10-31'));
    expect(periodFor('2026-10-01', 'monthly')).toEqual(monthly('2026-10-01', '2026-10-31'));
    expect(periodFor('2026-10-31', 'monthly')).toEqual(monthly('2026-10-01', '2026-10-31'));
    expect(periodFor('2026-09-10', 'monthly')).toEqual(monthly('2026-09-01', '2026-09-30'));
    expect(periodFor('2026-02-14', 'monthly')).toEqual(monthly('2026-02-01', '2026-02-28'));
    expect(periodFor('2028-02-14', 'monthly')).toEqual(monthly('2028-02-01', '2028-02-29'));
    expect(periodFor('2026-10-22', 'quarterly')).toEqual(quarterly('2026-10-01', '2026-12-31'));
    expect(periodFor('2026-08-15', 'quarterly')).toEqual(quarterly('2026-07-01', '2026-09-30'));
    expect(periodFor('2026-03-31', 'quarterly')).toEqual(quarterly('2026-01-01', '2026-03-31'));
    expect(periodFor('2026-04-01', 'quarterly')).toEqual(quarterly('2026-04-01', '2026-06-30'));
  });

  it('nextPeriod is the period right after, in the same kind, across a year end', () => {
    expect(nextPeriod(monthly('2026-09-01', '2026-09-30'))).toEqual(monthly('2026-10-01', '2026-10-31'));
    expect(nextPeriod(monthly('2026-12-01', '2026-12-31'))).toEqual(monthly('2027-01-01', '2027-01-31'));
    expect(nextPeriod(quarterly('2026-07-01', '2026-09-30'))).toEqual(quarterly('2026-10-01', '2026-12-31'));
    expect(nextPeriod(quarterly('2026-10-01', '2026-12-31'))).toEqual(quarterly('2027-01-01', '2027-03-31'));
  });

  it('is due on the 10th of the month after the period', () => {
    const profile = weber.taxProfile;
    expect(dueDateFor(periodFor('2026-10-22', 'monthly'), profile)).toBe('2026-11-10');
    expect(dueDateFor(periodFor('2026-12-05', 'monthly'), profile)).toBe('2027-01-10');
    expect(dueDateFor(periodFor('2026-08-15', 'quarterly'), profile)).toBe('2026-10-10');
    expect(dueDateFor(periodFor('2026-11-15', 'quarterly'), profile)).toBe('2027-01-10');
  });

  it('is due one month later with a permanent extension', () => {
    const profile = { ...weber.taxProfile, permanentExtension: true };
    expect(dueDateFor(periodFor('2026-10-22', 'monthly'), profile)).toBe('2026-12-10');
    expect(dueDateFor(periodFor('2026-12-05', 'monthly'), profile)).toBe('2027-02-10');
    expect(dueDateFor(periodFor('2026-08-15', 'quarterly'), profile)).toBe('2026-11-10');
    expect(dueDateFor(periodFor('2026-11-15', 'quarterly'), profile)).toBe('2027-02-10');
  });

  it('keeps the 10th when it is a Saturday or a Sunday', () => {
    // 10 Jan 2027 is a Sunday, 10 Oct 2026 a Saturday.
    expect(dueDateFor(periodFor('2026-12-05', 'monthly'), weber.taxProfile)).toBe('2027-01-10');
    expect(dueDateFor(periodFor('2026-08-15', 'quarterly'), weber.taxProfile)).toBe('2026-10-10');
  });

  it('warns 21 days ahead', () => {
    expect(DUE_SOON_DAYS).toBe(21);
  });
});

describe('the current return', () => {
  it('weber current return is October 2026, in progress, due 2026-11-10, 19 days left, with a result above 0', () => {
    const view = viewOf(weber);
    expect(view).toMatchObject({
      period: { start: '2026-10-01', end: '2026-10-31', kind: 'monthly' },
      dueDate: '2026-11-10',
      daysLeft: 19,
      state: 'inProgress',
      amountKnown: true,
    });
    expect(view.resultCents).toBeGreaterThan(0);
    expect(view.resultCents).toBe(view.chargedCents - view.paidCents);
  });

  it('adds up the booked payments of the period: VAT charged on money in, VAT paid on money out', () => {
    // Booked in October: wd-t7 +2,975.00 (19 %), and wd-t2, wd-t5, wd-t6, wd-t8 out (19 %).
    expect(viewOf(weber)).toMatchObject({
      chargedCents: 47500,
      paidCents: 8167, // 638 + 950 + 879 + 5,700
      resultCents: 39333,
      salesCount: 1,
      salesNetCents: 250000,
      purchasesCount: 4,
    });
  });

  it('cafe current return is Q3, overdue, due 2026-10-10, with a result above 0 and nothing waiting for the person', () => {
    const view = viewOf(cafe);
    expect(view).toMatchObject({
      period: { start: '2026-07-01', end: '2026-09-30', kind: 'quarterly' },
      dueDate: '2026-10-10',
      daysLeft: -12,
      state: 'overdue',
      needsYouCount: 0,
      amountKnown: true,
    });
    expect(view.resultCents).toBeGreaterThan(0);
    expect(view.resultCents).toBe(view.chargedCents - view.paidCents);
  });

  it('counts the sales and purchases that carry VAT, and leaves out wages and private payments', () => {
    expect(viewOf(cafe)).toMatchObject({
      chargedCents: 168916,
      paidCents: 90352,
      resultCents: 78564,
      salesCount: 4,
      salesNetCents: 972514,
      purchasesCount: 6,
    });
    // Weber's August has a private payment (wd-t15): booked, but no VAT.
    const august = vatReturnFor(weber, periodFor('2026-08-01', 'monthly'));
    expect(august.purchasesCount).toBe(2);
  });

  it('a period that has only purchases gives a refund: a result below 0', () => {
    const purchasesOnly = { ...weber, transactions: weber.transactions.filter((tx) => tx.amountCents < 0) };
    const view = viewOf(purchasesOnly);
    expect(view.chargedCents).toBe(0);
    expect(view.salesCount).toBe(0);
    expect(view.paidCents).toBeGreaterThan(0);
    expect(view.resultCents).toBe(-view.paidCents);
    expect(view.resultCents).toBeLessThan(0);
  });

  it('needsYou counts the payments of the period that are not booked', () => {
    // wd-t1 (confirm), wd-t3 and wd-t17 (no receipt), wd-t4 and wd-t18 (unclear).
    expect(viewOf(weber).needsYouCount).toBe(5);
    expect(vatReturnFor(weber, periodFor('2026-09-01', 'monthly')).needsYouCount).toBe(0);
  });

  it('leaves payments that are not booked out of the amounts', () => {
    // wd-t1 (+1,500.00, 19 %) waits for a confirmation, so its VAT is not in October's charged VAT.
    const wdT1 = weber.transactions.find((tx) => tx.id === 'wd-t1')!;
    expect(vatPartCents(wdT1)).toBe(23950);
    expect(viewOf(weber).chargedCents).toBe(47500);
  });

  it('counts the payments dated in the period, first and last day included, and no others', () => {
    const period = periodFor('2026-10-01', 'monthly');
    const transactions = [
      payment(11900, REVENUE_19, { id: 'before', date: '2026-09-30' }),
      payment(11900, REVENUE_19, { id: 'first', date: '2026-10-01' }),
      payment(11900, REVENUE_19, { id: 'last', date: '2026-10-31' }),
      payment(11900, REVENUE_19, { id: 'after', date: '2026-11-01' }),
    ];
    const view = vatReturnFor({ ...weber, transactions }, period);
    expect(view.chargedCents).toBe(3800);
    expect(view.salesCount).toBe(2);
  });

  it('knows the amount only when a booked payment of the period has a VAT rate above 0', () => {
    expect(viewOf({ ...weber, transactions: [] }).amountKnown).toBe(false);
    expect(viewOf({ ...weber, transactions: [payment(-310000, SALARIES, { date: '2026-10-07' })] }).amountKnown).toBe(false);
    // The VAT rate is there, but the payment is not booked yet.
    expect(viewOf({ ...weber, transactions: [payment(11900, REVENUE_19, { date: '2026-10-07', confirmed: false })] }).amountKnown).toBe(false);
    expect(viewOf({ ...weber, transactions: [payment(11900, REVENUE_19, { date: '2026-10-07' })] }).amountKnown).toBe(true);
  });

  it('sara is null: a Kleinunternehmer files no VAT return', () => {
    expect(currentVatReturn(sara)).toBeNull();
  });

  it('a business whose return period is not answered yet has no return either', () => {
    expect(currentVatReturn(withTax(weber, { vatPeriod: null }))).toBeNull();
  });

  it('a yearly profile gives { kind: yearly }', () => {
    expect(currentVatReturn(withTax(weber, { vatPeriod: 'yearly' }))).toEqual({ kind: 'yearly' });
    expect(currentVatReturn(withTax(weber, { vatPeriod: 'yearly', permanentExtension: true }))).toEqual({ kind: 'yearly' });
  });

  it('is the period right after the latest sent return', () => {
    expect(viewOf(weber).period).toEqual({ start: '2026-10-01', end: '2026-10-31', kind: 'monthly' });
    expect(viewOf(cafe).period.start).toBe('2026-07-01'); // after Q2
  });

  it('takes the latest sent return by its period, whatever the order of the list', () => {
    const reversed = { ...weber, vatReturns: [...weber.vatReturns].reverse() };
    expect(viewOf(reversed).period).toEqual(viewOf(weber).period);
  });

  it('is the period that holds today when no return was sent yet', () => {
    expect(viewOf({ ...weber, vatReturns: [] }).period).toEqual({ start: '2026-10-01', end: '2026-10-31', kind: 'monthly' });
    expect(viewOf({ ...cafe, vatReturns: [] }).period).toEqual({ start: '2026-10-01', end: '2026-12-31', kind: 'quarterly' });
    expect(viewOf({ ...weber, vatReturns: [] }, '2026-12-31').period.start).toBe('2026-12-01');
  });

  it('current return follows profile changes', () => {
    const quarterly = viewOf(withTax(weber, { vatPeriod: 'quarterly' }));
    expect(quarterly.period).toEqual({ start: '2026-10-01', end: '2026-12-31', kind: 'quarterly' });
    expect(quarterly.dueDate).toBe('2027-01-10');

    const extended = viewOf(withTax(weber, { permanentExtension: true }));
    expect(extended.period.end).toBe('2026-10-31');
    expect(extended.dueDate).toBe('2026-12-10');

    // Café goes monthly: the month after its sent Q2 is July, long past its date.
    const monthly = viewOf(withTax(cafe, { vatPeriod: 'monthly' }));
    expect(monthly.period).toEqual({ start: '2026-07-01', end: '2026-07-31', kind: 'monthly' });
    expect(monthly.state).toBe('overdue');

    // With the extension Café's Q3 is not late yet: it was due 10 Nov.
    const cafeExtended = viewOf(withTax(cafe, { permanentExtension: true }));
    expect(cafeExtended.dueDate).toBe('2026-11-10');
    expect(cafeExtended.state).toBe('ready');
    expect(cafeExtended.daysLeft).toBe(19);
  });

  it('follows the booked payments: a payment booked later changes the amount', () => {
    const wdT1 = weber.transactions.find((tx) => tx.id === 'wd-t1')!;
    const confirmed = { ...weber, transactions: weber.transactions.map((tx) => (tx === wdT1 ? { ...tx, confirmed: true } : tx)) };
    expect(viewOf(confirmed).chargedCents).toBe(47500 + 23950);
    expect(viewOf(confirmed).needsYouCount).toBe(4);
  });

  describe('the state', () => {
    const october = periodFor('2026-10-01', 'monthly'); // due 2026-11-10

    it('is in progress until the period has ended, its last day included', () => {
      expect(vatReturnFor(weber, october, '2026-10-22').state).toBe('inProgress');
      expect(vatReturnFor(weber, october, '2026-10-31').state).toBe('inProgress');
    });

    it('is ready from the day after the period, up to and including the due date', () => {
      expect(vatReturnFor(weber, october, '2026-11-01')).toMatchObject({ state: 'ready', daysLeft: 9 });
      expect(vatReturnFor(weber, october, '2026-11-10')).toMatchObject({ state: 'ready', daysLeft: 0 });
    });

    it('is overdue from the day after the due date, with the days left below 0', () => {
      expect(vatReturnFor(weber, october, '2026-11-11')).toMatchObject({ state: 'overdue', daysLeft: -1 });
    });
  });
});

describe('resultWording', () => {
  it('a positive result is to pay, as its own amount', () => {
    expect(resultWording({ resultCents: 39333 })).toEqual({ key: 'pay', cents: 39333 });
  });

  it('a negative result is a refund, as a positive amount', () => {
    expect(resultWording({ resultCents: -6623 })).toEqual({ key: 'refund', cents: 6623 });
  });

  it('a result of nothing is nothing to pay', () => {
    expect(resultWording({ resultCents: 0 })).toEqual({ key: 'pay', cents: 0 });
  });

  it('takes a return view as it is', () => {
    expect(resultWording(viewOf(weber))).toEqual({ key: 'pay', cents: 39333 });
  });
});

describe('daysLeftWording', () => {
  it('says today, in 1 day or in some days', () => {
    expect(daysLeftWording(0)).toBe('today');
    expect(daysLeftWording(1)).toBe('inOneDay');
    expect(daysLeftWording(19)).toBe('inDays');
  });
});

describe('sentPeriod', () => {
  const sent = (periodStart: string, periodEnd: string) => ({
    periodStart,
    periodEnd,
    sentOn: '2026-10-22',
    chargedCents: 0,
    paidCents: 0,
    resultCents: 0,
    ticket: 'ET-2026-1022-00000',
  });

  it('a return for one month is a monthly period', () => {
    expect(sentPeriod(sent('2026-08-01', '2026-08-31'))).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
      kind: 'monthly',
    });
  });

  it('a return for three months is a quarter', () => {
    expect(sentPeriod(sent('2026-04-01', '2026-06-30'))).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
      kind: 'quarterly',
    });
  });

  it('turns the returns the sample businesses sent into the periods they were', () => {
    expect(weber.vatReturns.map((r) => sentPeriod(r).kind)).toEqual(['monthly', 'monthly']);
    expect(cafe.vatReturns.map((r) => sentPeriod(r).kind)).toEqual(['quarterly']);
  });
});
