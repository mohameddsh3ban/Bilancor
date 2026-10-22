import type { Transaction, TxStatus } from '../data/models';

/** What a payment needs from the person, decided in this order: booking, confirmation, receipt. */
export function paymentStatus(tx: Transaction): TxStatus {
  if (!tx.booking) return 'unclear';
  if (!tx.confirmed) return 'confirm';
  if (tx.receipt === 'missing') return 'noReceipt';
  return 'booked';
}

/** How many payments are waiting for the person (everything that is not booked). */
export function needsYouCount(transactions: readonly Transaction[]): number {
  return transactions.filter((tx) => paymentStatus(tx) !== 'booked').length;
}
