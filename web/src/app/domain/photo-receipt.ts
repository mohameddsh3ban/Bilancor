import type { PoolResult, Transaction } from '../data/models';

/**
 * What reading a photo taken for a payment finds: a plain receipt that is exactly that payment (its counterparty,
 * date, booking and amount), clear and no duplicate, so it needs nothing from the person. No photo is really read.
 */
export function photoReceiptFor(tx: Transaction): PoolResult {
  return {
    name: tx.counterparty,
    direction: 'received',
    invoiceNo: '',
    date: tx.date,
    dueDate: null,
    amountCents: Math.abs(tx.amountCents),
    vatRate: tx.booking?.vatRate ?? 0,
    duplicateOf: null,
    booking: tx.booking,
    plain: true,
  };
}
