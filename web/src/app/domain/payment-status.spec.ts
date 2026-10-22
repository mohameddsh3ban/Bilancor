import { CATEGORIES, PRIVATE_OUT } from '../data/categories';
import type { Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { needsYouCount, paymentStatus } from './payment-status';

const base: Transaction = {
  id: 'x',
  date: '2026-10-01',
  counterparty: 'Test',
  accountId: 'a',
  amountCents: -1000,
  booking: CATEGORIES[0],
  confirmed: true,
  isPrivate: false,
  receipt: 'attached',
  receiptFile: 'beleg.pdf',
  counterpartyIban: 'DE02100100100123456789',
  reference: 'Test',
  history: [],
  beforePrivate: null,
  beforeLink: null,
};
const tx = (patch: Partial<Transaction>): Transaction => ({ ...base, ...patch });

describe('paymentStatus', () => {
  it('is unclear without a booking, whatever else is set', () => {
    expect(paymentStatus(tx({ booking: null }))).toBe('unclear');
    expect(paymentStatus(tx({ booking: null, confirmed: false, receipt: 'missing' }))).toBe('unclear');
  });

  it('asks for confirmation when a booking is not confirmed, even if the receipt is missing', () => {
    expect(paymentStatus(tx({ confirmed: false }))).toBe('confirm');
    expect(paymentStatus(tx({ confirmed: false, receipt: 'missing', receiptFile: null }))).toBe('confirm');
  });

  it('reports a missing receipt only once the booking is confirmed', () => {
    expect(paymentStatus(tx({ receipt: 'missing', receiptFile: null }))).toBe('noReceipt');
  });

  it('is booked with a confirmed booking and a receipt attached or not needed', () => {
    expect(paymentStatus(tx({}))).toBe('booked');
    expect(paymentStatus(tx({ receipt: 'notNeeded', receiptFile: null }))).toBe('booked');
  });

  it('a confirmed private payment without a receipt is booked', () => {
    const priv = tx({ booking: PRIVATE_OUT, isPrivate: true, receipt: 'notNeeded', receiptFile: null });
    expect(paymentStatus(priv)).toBe('booked');
  });
});

describe('needsYouCount', () => {
  const count = (id: string) => needsYouCount(BUSINESSES.find((b) => b.id === id)!.transactions);

  it('counts every payment that is not booked', () => {
    expect(needsYouCount([])).toBe(0);
    expect(needsYouCount([tx({}), tx({ booking: null }), tx({ confirmed: false })])).toBe(2);
  });

  it('matches the sample businesses', () => {
    expect(count('weber-design')).toBe(5);
    expect(count('sara-yoga')).toBe(3);
    expect(count('cafe-linde')).toBe(0);
  });
});
