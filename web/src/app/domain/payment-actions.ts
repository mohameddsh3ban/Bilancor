import { PRIVATE_IN, PRIVATE_OUT } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Booking, HistoryEntry, Transaction } from '../data/models';

// Pure actions on one payment. Each returns a new payment with one history entry (dated DEMO_TODAY) added at the front.

function logged(tx: Transaction, key: HistoryEntry['key'], params: Record<string, string> = {}): HistoryEntry[] {
  return [{ date: DEMO_TODAY, key, params }, ...tx.history];
}

/** The person agrees with the suggested booking. */
export function confirmBooking(tx: Transaction): Transaction {
  const params: Record<string, string> = tx.booking ? { category: tx.booking.labelKey } : {};
  return { ...tx, confirmed: true, history: logged(tx, 'confirmed', params) };
}

/** The payment needs no receipt. */
export function markNoReceiptNeeded(tx: Transaction): Transaction {
  return { ...tx, receipt: 'notNeeded', history: logged(tx, 'receiptNotNeeded') };
}

/** The person picks the category; choosing it also confirms the booking. */
export function changeCategory(tx: Transaction, booking: Booking): Transaction {
  return { ...tx, booking, confirmed: true, history: logged(tx, 'categoryChanged', { category: booking.labelKey }) };
}

/**
 * Moves a payment to private (booked to 1800 or 1890, no receipt needed) or back to the business.
 * Going back restores what was saved before; a payment that started private comes back as unclear.
 * Everything else stays as it was, including what `beforeLink` saved for an unlink.
 */
export function setPrivate(tx: Transaction, isPrivate: boolean): Transaction {
  if (tx.isPrivate === isPrivate) return tx;
  if (isPrivate) {
    return {
      ...tx,
      isPrivate: true,
      beforePrivate: { booking: tx.booking, confirmed: tx.confirmed, receipt: tx.receipt },
      booking: tx.amountCents < 0 ? PRIVATE_OUT : PRIVATE_IN,
      confirmed: true,
      receipt: 'notNeeded',
      history: logged(tx, 'markedPrivate'),
    };
  }
  const before = tx.beforePrivate ?? { booking: null, confirmed: false, receipt: 'missing' as const };
  return { ...tx, ...before, isPrivate: false, beforePrivate: null, history: logged(tx, 'markedBusiness') };
}
