import { TRAVEL } from '../data/categories';
import type { Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { docStatus } from './document-status';
import { applyReadResult, newReadingDoc } from './document-upload';
import { photoReceiptFor } from './photo-receipt';

function sample(id: string): Transaction {
  for (const business of BUSINESSES) {
    const found = business.transactions.find((t) => t.id === id);
    if (found) return structuredClone(found);
  }
  throw new Error(`no sample payment ${id}`);
}

describe('photoReceiptFor', () => {
  it('reads as a plain receipt of the payment: its counterparty, date, booking and amount', () => {
    expect(photoReceiptFor(sample('wd-t3'))).toEqual({
      name: 'Deutsche Bahn',
      direction: 'received',
      invoiceNo: '',
      date: '2026-10-17',
      dueDate: null,
      amountCents: 12000,
      vatRate: TRAVEL.vatRate,
      duplicateOf: null,
      booking: TRAVEL,
      plain: true,
    });
  });

  it('the amount is positive for money in as well as money out', () => {
    expect(photoReceiptFor({ ...sample('wd-t3'), amountCents: -12000 }).amountCents).toBe(12000);
    expect(photoReceiptFor({ ...sample('wd-t3'), amountCents: 12000 }).amountCents).toBe(12000);
  });

  it('the direction follows the money: a received receipt for money out, a sent one for money in', () => {
    expect(photoReceiptFor({ ...sample('wd-t3'), amountCents: -12000 }).direction).toBe('received');
    const incoming = photoReceiptFor(sample('wd-t1'));
    expect(incoming).toMatchObject({ direction: 'sent', name: 'Müller GmbH', amountCents: 150000 });
  });

  it('a payment without a category gives a receipt without one, and no VAT', () => {
    const result = photoReceiptFor({ ...sample('wd-t3'), booking: null });
    expect(result.booking).toBeNull();
    expect(result.vatRate).toBe(0);
  });

  it('needs nothing from the person once it is read', () => {
    const read = applyReadResult(
      newReadingDoc('up-1', 'photo.jpg', 'photo'),
      photoReceiptFor(sample('wd-t3')),
    );
    expect(docStatus(read)).toBe('waiting');
    expect(docStatus({ ...read, paymentId: 'wd-t3' })).toBe('done');
  });
});
