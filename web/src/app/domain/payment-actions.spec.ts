import { PRIVATE_IN, PRIVATE_OUT, TRAVEL } from '../data/categories';
import { Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { changeCategory, confirmBooking, markNoReceiptNeeded, setPrivate } from './payment-actions';
import { paymentStatus } from './payment-status';

function sample(id: string): Transaction {
  for (const business of BUSINESSES) {
    const found = business.transactions.find((t) => t.id === id);
    if (found) return structuredClone(found);
  }
  throw new Error(`no sample payment ${id}`);
}

describe('payment actions', () => {
  it('confirm on a payment with a missing receipt turns it into noReceipt', () => {
    const tx: Transaction = { ...sample('wd-t3'), confirmed: false };
    expect(paymentStatus(tx)).toBe('confirm');
    const next = confirmBooking(tx);
    expect(next.confirmed).toBe(true);
    expect(paymentStatus(next)).toBe('noReceipt');
    expect(next.history[0]).toEqual({ date: '2026-10-22', key: 'confirmed', params: { category: 'travel' } });
    expect(next.history).toHaveLength(tx.history.length + 1);
  });

  it('markNoReceiptNeeded books a payment that only lacked a receipt', () => {
    const tx = sample('wd-t3');
    const next = markNoReceiptNeeded(tx);
    expect(next.receipt).toBe('notNeeded');
    expect(paymentStatus(next)).toBe('booked');
    expect(next.history[0]).toEqual({ date: '2026-10-22', key: 'receiptNotNeeded', params: {} });
  });

  it('changeCategory makes an unclear payment booked and logs it', () => {
    const tx = sample('wd-t4');
    expect(paymentStatus(tx)).toBe('unclear');
    const next = changeCategory(tx, TRAVEL);
    expect(next.booking).toBe(TRAVEL);
    expect(next.confirmed).toBe(true);
    expect(paymentStatus(next)).toBe('booked');
    expect(next.history[0]).toEqual({ date: '2026-10-22', key: 'categoryChanged', params: { category: 'travel' } });
  });

  it('actions return a new payment and leave the old one alone', () => {
    const tx = sample('wd-t3');
    const copy = structuredClone(tx);
    const next = markNoReceiptNeeded(tx);
    expect(next).not.toBe(tx);
    expect(tx).toEqual(copy);
  });

  it('private round trip restores booking, confirmation and receipt', () => {
    const tx = sample('wd-t3');
    const priv = setPrivate(tx, true);
    expect(priv.isPrivate).toBe(true);
    expect(priv.booking).toBe(PRIVATE_OUT);
    expect(priv.booking?.skr03).toBe('1800');
    expect(priv.confirmed).toBe(true);
    expect(priv.receipt).toBe('notNeeded');
    expect(paymentStatus(priv)).toBe('booked');
    expect(priv.history[0]).toEqual({ date: '2026-10-22', key: 'markedPrivate', params: {} });

    const back = setPrivate(priv, false);
    expect(back.isPrivate).toBe(false);
    expect(back.booking).toEqual(TRAVEL);
    expect(back.confirmed).toBe(true);
    expect(back.receipt).toBe('missing');
    expect(back.beforePrivate).toBeNull();
    expect(paymentStatus(back)).toBe('noReceipt');
    expect(back.history[0]).toEqual({ date: '2026-10-22', key: 'markedBusiness', params: {} });
    expect(back.history).toHaveLength(tx.history.length + 2);
  });

  it('money in goes to 1890', () => {
    const tx = sample('wd-t7');
    expect(tx.amountCents).toBeGreaterThan(0);
    expect(setPrivate(tx, true).booking).toBe(PRIVATE_IN);
    expect(setPrivate(tx, true).booking?.skr03).toBe('1890');
  });

  it('moving to private and back keeps what was saved before a link', () => {
    const beforeLink = { booking: TRAVEL, confirmed: false, receipt: 'missing' as const };
    const tx: Transaction = { ...sample('wd-t3'), beforeLink };
    const priv = setPrivate(tx, true);
    expect(priv.beforeLink).toEqual(beforeLink);
    expect(setPrivate(priv, false).beforeLink).toEqual(beforeLink);
  });

  it('does nothing when the payment is already in that state', () => {
    const business = sample('wd-t3');
    expect(setPrivate(business, false)).toBe(business);
    const priv = setPrivate(business, true);
    expect(setPrivate(priv, true)).toBe(priv);
  });

  it('a private payment without a saved state becomes unclear when set back to business', () => {
    const tx = sample('wd-t15');
    expect(tx.isPrivate).toBe(true);
    expect(tx.beforePrivate).toBeNull();
    const back = setPrivate(tx, false);
    expect(back.isPrivate).toBe(false);
    expect(back.booking).toBeNull();
    expect(back.confirmed).toBe(false);
    expect(back.receipt).toBe('missing');
    expect(paymentStatus(back)).toBe('unclear');
    expect(back.history[0].key).toBe('markedBusiness');
  });
});
