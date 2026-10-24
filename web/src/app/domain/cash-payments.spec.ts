import { OFFICE } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Business, Doc, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { noConnection } from './bank-connection';
import {
  canPayPrivately,
  lockedToReceipt,
  newId,
  paidFromReceiptFor,
  payDayAllowed,
  paymentFor,
} from './cash-payments';

const weber = (): Business => structuredClone(BUSINESSES.find((b) => b.id === 'weber-design')!);

/** A received receipt with no payment, read completely: the Copyshop Kreuzberg receipt of 18,50 € that the sample data gives Weber. */
const copyshop = (patch: Partial<Doc> = {}): Doc => ({
  ...structuredClone(weber().documents.find((d) => d.id === 'wd-d7')!),
  ...patch,
});

const CASH: Account = {
  id: 'wd-cash',
  kind: 'cash',
  name: 'Cash box',
  balanceCents: 0,
  lastUpdate: DEMO_TODAY,
  connection: noConnection('cash'),
  product: 'cash',
  iban: null,
};
const OWN: Account = { ...CASH, id: 'wd-own', kind: 'own', name: 'Own money', connection: noConnection('own'), product: 'own' };

describe('newId', () => {
  it('is <prefix>-<n> for the smallest n above the number of ids taken that none of them uses', () => {
    expect(newId('p', [])).toBe('p-1');
    expect(newId('p', ['p-1', 'p-2'])).toBe('p-3');
    expect(newId('p', ['a', 'b'])).toBe('p-3');
    expect(newId('p', ['p-3', 'x'])).toBe('p-4');
  });
});

describe('paymentFor', () => {
  it('is an incoming payment of what is left of an invoice, booked and confirmed, with no receipt yet', () => {
    const business = weber();
    const invoice = business.invoices.find((i) => i.id === 'inv-wd-044')!;
    const history = [{ date: '2026-10-21', key: 'paidInCash' as const, params: {} }];

    const tx = paymentFor(business, invoice, 'wd-cash', '2026-10-21', '', history);

    expect(tx).toMatchObject({
      date: '2026-10-21',
      counterparty: invoice.customer.name,
      accountId: 'wd-cash',
      amountCents: 238000,
      confirmed: true,
      isPrivate: false,
      receipt: 'missing',
      receiptFile: null,
      counterpartyIban: '',
      reference: invoice.number,
      history,
      beforePrivate: null,
      beforeLink: null,
    });
    expect(tx.booking?.labelKey).toBe('revenue19');
    expect(business.transactions.some((t) => t.id === tx.id)).toBe(false);
    expect(tx.id).toMatch(/^weber-design-pay-\d+$/);
  });
});

describe('canPayPrivately', () => {
  it('is for a received receipt that is read, complete and waits for its payment', () => {
    expect(canPayPrivately(copyshop())).toBe(true);
  });

  it.each<[string, Partial<Doc>]>([
    ['one still being read', { reading: true }],
    ['a sent document', { direction: 'sent' }],
    ['one with no direction yet', { direction: null }],
    ['one that looks like a duplicate', { duplicateOf: 'doc-wd-t2' }],
    ['one whose amount could not be read', { amountCents: null }],
    ['one whose date could not be read', { date: null }],
    ['one whose name could not be read', { name: null }],
    ['one that has its payment already', { paymentId: 'wd-t2' }],
    ['an invoice written in Invoices', { invoice: { id: 'inv-wd-044', role: 'invoice', cancelled: false } }],
    [
      'a self-issued receipt',
      {
        selfIssued: { number: 'EB-2026-001', reason: 'lost', reasonText: null, purpose: 'Parking', address: null, confirmedBy: 'Sara Weber', issuedOn: DEMO_TODAY },
      },
    ],
  ])('is not for %s', (_name, patch) => {
    expect(canPayPrivately(copyshop(patch))).toBe(false);
  });
});

describe('payDayAllowed', () => {
  it('allows the receipt date, today and every day between', () => {
    expect(payDayAllowed(copyshop(), '2026-10-19', DEMO_TODAY)).toBe(true);
    expect(payDayAllowed(copyshop(), '2026-10-20', DEMO_TODAY)).toBe(true);
    expect(payDayAllowed(copyshop(), DEMO_TODAY, DEMO_TODAY)).toBe(true);
  });

  it('refuses a day before the receipt date or after today', () => {
    expect(payDayAllowed(copyshop(), '2026-10-18', DEMO_TODAY)).toBe(false);
    expect(payDayAllowed(copyshop(), '2026-10-23', DEMO_TODAY)).toBe(false);
  });

  it('refuses what is not a day, and any day for a receipt with no date', () => {
    expect(payDayAllowed(copyshop(), '', DEMO_TODAY)).toBe(false);
    expect(payDayAllowed(copyshop(), '19.10.2026', DEMO_TODAY)).toBe(false);
    expect(payDayAllowed(copyshop({ date: null }), DEMO_TODAY, DEMO_TODAY)).toBe(false);
  });
});

describe('paidFromReceiptFor', () => {
  it('is money out of the receipt\'s amount on the day, booked and confirmed with the receipt\'s category and VAT', () => {
    const tx = paidFromReceiptFor(copyshop(), CASH, '2026-10-20');

    expect(tx).toEqual<Transaction>({
      id: 'paid-wd-d7',
      date: '2026-10-20',
      counterparty: 'Copyshop Kreuzberg',
      accountId: 'wd-cash',
      amountCents: -1850,
      booking: OFFICE,
      confirmed: true,
      isPrivate: false,
      receipt: 'attached',
      receiptFile: copyshop().fileName,
      counterpartyIban: '',
      reference: copyshop().invoiceNo,
      history: [{ date: '2026-10-20', key: 'paidInCash', params: {} }],
      beforePrivate: null,
      beforeLink: null,
    });
  });

  it('follows the VAT the receipt says, not the category\'s usual rate', () => {
    const tx = paidFromReceiptFor(copyshop({ vatRate: 7 }), CASH, '2026-10-20');
    expect(tx.booking).toEqual({ ...OFFICE, vatRate: 7 });
  });

  it('says "paid with own money" on a payment of the Own money account, the other things being the same', () => {
    const cash = paidFromReceiptFor(copyshop(), CASH, '2026-10-20');
    const own = paidFromReceiptFor(copyshop(), OWN, '2026-10-20');

    expect(own.accountId).toBe('wd-own');
    expect(own.history).toEqual([{ date: '2026-10-20', key: 'paidWithOwnMoney', params: {} }]);
    expect({ ...own, accountId: cash.accountId, history: cash.history }).toEqual(cash);
  });

  it('books no VAT for a business that charges none (Kleinunternehmer)', () => {
    const tx = paidFromReceiptFor(copyshop(), OWN, '2026-10-20', true);
    expect(tx.booking).toEqual({ ...OFFICE, vatRate: 0 });
  });

  it('is not confirmed when the receipt has no category yet, so it still asks for one', () => {
    const tx = paidFromReceiptFor(copyshop({ booking: null }), CASH, '2026-10-20');
    expect(tx.booking).toBeNull();
    expect(tx.confirmed).toBe(false);
  });

  it('refuses a receipt with no amount', () => {
    expect(() => paidFromReceiptFor(copyshop({ amountCents: null }), CASH, '2026-10-20')).toThrow();
  });
});

describe('lockedToReceipt', () => {
  it('is true for a payment made from a receipt, with the cash box or with own money, however its history grows', () => {
    const cash = paidFromReceiptFor(copyshop(), CASH, '2026-10-20');
    const own = paidFromReceiptFor(copyshop(), OWN, '2026-10-20');
    expect(lockedToReceipt(cash)).toBe(true);
    expect(lockedToReceipt(own)).toBe(true);
    const later = { ...own, history: [{ date: DEMO_TODAY, key: 'categoryChanged' as const, params: {} }, ...own.history] };
    expect(lockedToReceipt(later)).toBe(true);
  });

  it('is false for the payments of the sample data', () => {
    for (const business of BUSINESSES) {
      expect(business.transactions.filter(lockedToReceipt), business.id).toEqual([]);
    }
  });
});
