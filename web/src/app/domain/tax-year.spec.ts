import { PHONE, PRIVATE_IN, PRIVATE_OUT, RENT, REVENUE_19, REVENUE_7, REVENUE_KU, SALARIES, SOFTWARE } from '../data/categories';
import type { Booking, Business, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { paymentStatus } from './payment-status';
import { paymentFigure, yearSummary } from './tax-year';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const weber = business('weber-design');
const cafe = business('cafe-linde');
const sara = business('sara-yoga');

/** A sample payment with its amount, booking and date replaced. A booked one unless the patch says otherwise. */
const payment = (amountCents: number, booking: Booking | null, patch: Partial<Transaction> = {}): Transaction => ({
  ...weber.transactions[1],
  amountCents,
  booking,
  confirmed: true,
  receipt: 'attached',
  isPrivate: false,
  date: '2026-09-15',
  ...patch,
});

/** A business with no opening line and only the given payments, so that a figure comes from those alone. */
const only = (b: Business, ...transactions: Transaction[]): Business => ({
  ...b,
  yearOpening: { incomeCents: 0, costsCents: 0, costsByCategory: [], untilMonth: b.yearOpening.untilMonth },
  transactions,
});

describe('paymentFigure', () => {
  it('a booked sale is income and a booked cost is costs, net of VAT for a business that charges VAT', () => {
    expect(paymentFigure(payment(11900, REVENUE_19), true)).toEqual({ incomeCents: 10000, costsCents: 0 });
    expect(paymentFigure(payment(-11900, SOFTWARE), true)).toEqual({ incomeCents: 0, costsCents: 10000 });
  });

  it('a Kleinunternehmer counts the gross amount', () => {
    expect(paymentFigure(payment(11900, REVENUE_KU), false)).toEqual({ incomeCents: 11900, costsCents: 0 });
    expect(paymentFigure(payment(-11900, SOFTWARE), false)).toEqual({ incomeCents: 0, costsCents: 11900 });
  });

  it('a payment with no VAT counts in full, also for a business that charges VAT', () => {
    expect(paymentFigure(payment(-310000, SALARIES), true)).toEqual({ incomeCents: 0, costsCents: 310000 });
  });

  it('is null for a private payment and for one that is not booked yet', () => {
    expect(paymentFigure(payment(-6430, PRIVATE_OUT, { isPrivate: true, receipt: 'notNeeded', receiptFile: null }), true)).toBeNull();
    expect(paymentFigure(payment(11900, REVENUE_19, { confirmed: false }), true)).toBeNull();
    expect(paymentFigure(payment(-11900, SOFTWARE, { receipt: 'missing', receiptFile: null }), true)).toBeNull();
    expect(paymentFigure(payment(-4900, null), true)).toBeNull();
  });

  it("adds up to the year's payments for every sample business", () => {
    for (const b of BUSINESSES) {
      const figures = b.transactions.map((tx) => paymentFigure(tx, !b.taxProfile.kleinunternehmer)).filter((figure) => figure !== null);
      const s = yearSummary(b);
      expect(figures.reduce((sum, figure) => sum + figure.incomeCents, 0), b.id).toBe(s.paymentsIncomeCents);
      expect(figures.reduce((sum, figure) => sum + figure.costsCents, 0), b.id).toBe(s.paymentsCostsCents);
    }
  });
});

describe('yearSummary', () => {
  it('year income is the round figure each sample business is sized for', () => {
    expect(yearSummary(weber).incomeCents).toBe(4_860_000);
    expect(yearSummary(cafe).incomeCents).toBe(11_240_000);
    expect(yearSummary(sara).incomeCents).toBe(2_130_000);
  });

  it('adds the opening line to the payments, and the profit is income minus costs', () => {
    for (const b of BUSINESSES) {
      const s = yearSummary(b);
      expect(s.openingIncomeCents, b.id).toBe(b.yearOpening.incomeCents);
      expect(s.openingCostsCents, b.id).toBe(b.yearOpening.costsCents);
      expect(s.incomeCents, b.id).toBe(s.openingIncomeCents + s.paymentsIncomeCents);
      expect(s.costsCents, b.id).toBe(s.openingCostsCents + s.paymentsCostsCents);
      expect(s.profitCents, b.id).toBe(s.incomeCents - s.costsCents);
      expect(s.profitCents, b.id).toBeGreaterThan(0);
    }
  });

  it('VAT business amounts are net: a booked 119.00 sale at 19 % adds 100.00 income, a 119.00 cost adds 100.00 costs', () => {
    const s = yearSummary(only(weber, payment(11900, REVENUE_19), payment(-11900, SOFTWARE)));
    expect(s.paymentsIncomeCents).toBe(10000);
    expect(s.paymentsCostsCents).toBe(10000);
    expect(s.incomeCents).toBe(10000);
    expect(s.costsCents).toBe(10000);
    expect(s.profitCents).toBe(0);
  });

  it('a payment with no VAT counts in full, also for a business that charges VAT', () => {
    const s = yearSummary(only(cafe, payment(-310000, SALARIES), payment(10700, REVENUE_7)));
    expect(s.paymentsCostsCents).toBe(310000);
    expect(s.paymentsIncomeCents).toBe(10000);
  });

  it('Kleinunternehmer amounts are gross', () => {
    const s = yearSummary(only(sara, payment(11900, REVENUE_KU), payment(-11900, SOFTWARE)));
    expect(s.paymentsIncomeCents).toBe(11900);
    expect(s.paymentsCostsCents).toBe(11900);
    expect(s.byCategory).toEqual([{ labelKey: 'software', skr03: '4806', nameDe: SOFTWARE.nameDe, cents: 11900 }]);
  });

  it('private and unbooked payments are left out', () => {
    const left: Transaction[] = [
      payment(-6430, PRIVATE_OUT, { isPrivate: true, receipt: 'notNeeded', receiptFile: null }),
      payment(20000, PRIVATE_IN, { isPrivate: true, receipt: 'notNeeded', receiptFile: null }),
      payment(11900, REVENUE_19, { confirmed: false }),
      payment(-11900, SOFTWARE, { receipt: 'missing', receiptFile: null }),
      payment(-4900, null),
    ];
    expect(left.filter((tx) => paymentStatus(tx) === 'booked' && !tx.isPrivate)).toEqual([]);
    const s = yearSummary(only(weber, ...left));
    expect([s.paymentsIncomeCents, s.paymentsCostsCents, s.byCategory]).toEqual([0, 0, []]);

    const counted = yearSummary(only(weber, ...left, payment(11900, REVENUE_19)));
    expect(counted.paymentsIncomeCents).toBe(10000);
  });

  it('counts payments of this calendar year up to today only', () => {
    const dated = (date: string) => payment(11900, REVENUE_19, { date });
    const s = yearSummary(only(weber, dated('2025-12-31'), dated('2026-01-01'), dated('2026-10-22'), dated('2026-10-23'), dated('2027-01-01')));
    expect(s.paymentsIncomeCents).toBe(20000);
    // Seen on 2027-03-01, the year is 2027: the payment of 2026 is out, and so is the one dated after that day.
    expect(yearSummary(only(weber, dated('2026-10-22'), dated('2027-01-01'), dated('2027-03-02')), '2027-03-01').paymentsIncomeCents).toBe(10000);
  });

  it('paymentsSince is the date of the first payment this year, whatever its status', () => {
    expect(yearSummary(weber).paymentsSince).toBe('2026-08-05');
    expect(yearSummary(sara).paymentsSince).toBe('2026-08-04');
    expect(yearSummary(cafe).paymentsSince).toBe('2026-07-10');
    const s = yearSummary(only(weber, payment(-4900, null, { date: '2026-05-03' }), payment(11900, REVENUE_19, { date: '2025-12-30' })));
    expect(s.paymentsSince).toBe('2026-05-03');
  });

  it('without a payment this year, paymentsSince is the first day of the year and the payment figures are 0', () => {
    const s = yearSummary(only(weber));
    expect(s.paymentsSince).toBe('2026-01-01');
    expect([s.paymentsIncomeCents, s.paymentsCostsCents]).toEqual([0, 0]);
  });

  it('categories merge opening and payments, largest first', () => {
    const b: Business = {
      ...weber,
      yearOpening: {
        untilMonth: '2026-07',
        incomeCents: 0,
        costsCents: 150000,
        costsByCategory: [
          { labelKey: 'rent', skr03: '4210', nameDe: RENT.nameDe, cents: 100000 },
          { labelKey: 'software', skr03: '4806', nameDe: SOFTWARE.nameDe, cents: 50000 },
        ],
      },
      transactions: [
        payment(-47600, SOFTWARE), // net 400.00
        payment(-11900, PHONE), // net 100.00, a category the opening line lacks
        payment(-11900, RENT), // net 100.00
        payment(11900, REVENUE_19), // income, not a category
      ],
    };
    const s = yearSummary(b);
    expect(s.byCategory).toEqual([
      { labelKey: 'rent', skr03: '4210', nameDe: RENT.nameDe, cents: 110000 },
      { labelKey: 'software', skr03: '4806', nameDe: SOFTWARE.nameDe, cents: 90000 },
      { labelKey: 'phone', skr03: '4920', nameDe: PHONE.nameDe, cents: 10000 },
    ]);
    expect(s.byCategory.reduce((sum, c) => sum + c.cents, 0)).toBe(s.costsCents);
    expect(b.yearOpening.costsByCategory.map((c) => c.cents), 'the stored opening line is left as it was').toEqual([100000, 50000]);
  });

  it('the categories of every sample business add up to its costs, largest first', () => {
    for (const b of BUSINESSES) {
      const s = yearSummary(b);
      expect(s.byCategory.reduce((sum, c) => sum + c.cents, 0), b.id).toBe(s.costsCents);
      const cents = s.byCategory.map((c) => c.cents);
      expect([...cents].sort((x, y) => y - x), b.id).toEqual(cents);
      expect(new Set(s.byCategory.map((c) => c.labelKey)).size, b.id).toBe(s.byCategory.length);
    }
  });

  it("weber's rent is the opening rent plus three booked months, net", () => {
    const opening = weber.yearOpening.costsByCategory.find((c) => c.labelKey === 'rent')!.cents;
    const rent = yearSummary(weber).byCategory.find((c) => c.labelKey === 'rent')!;
    expect(rent.cents).toBe(opening + 3 * 30000); // 357.00 gross is 300.00 net, in August, September and October
    expect(rent).toMatchObject({ skr03: '4210', nameDe: RENT.nameDe });
  });

  it('returns per business', () => {
    expect(yearSummary(weber).returns).toEqual(['euer', 'einkommensteuererklaerung', 'umsatzsteuererklaerung']);
    expect(yearSummary(cafe).returns).toEqual(['euer', 'feststellungserklaerung', 'umsatzsteuererklaerung']);
    expect(yearSummary(sara).returns).toEqual(['euer', 'einkommensteuererklaerung']);
  });

  it('the legal form decides the second return, and charging VAT the last', () => {
    expect(yearSummary({ ...sara, legalForm: 'gbr' }).returns).toEqual(['euer', 'feststellungserklaerung']);
    expect(yearSummary({ ...cafe, legalForm: 'sole' }).returns).toEqual(['euer', 'einkommensteuererklaerung', 'umsatzsteuererklaerung']);
    expect(yearSummary({ ...weber, taxProfile: { ...weber.taxProfile, kleinunternehmer: true } }).returns).toEqual(['euer', 'einkommensteuererklaerung']);
  });

  it('due 2027-07-31, the 31 July after the year', () => {
    for (const b of BUSINESSES) expect(yearSummary(b).dueDate, b.id).toBe('2027-07-31');
    expect(yearSummary(weber, '2027-03-01').dueDate).toBe('2028-07-31');
  });
});
