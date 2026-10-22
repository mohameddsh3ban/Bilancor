import { DEMO_TODAY } from '../data/demo-date';
import type { Booking, Doc, DocDirection, HistoryEntry, Transaction } from '../data/models';
import { docName } from './document-status';

// Pure actions on a document, and on a document together with its payment. Each returns new objects with one
// history entry (dated DEMO_TODAY) added at the front of whatever it changes.

function logged(history: readonly HistoryEntry[], key: HistoryEntry['key'], params: Record<string, string> = {}): HistoryEntry[] {
  return [{ date: DEMO_TODAY, key, params }, ...history];
}

/**
 * Links a document to a payment: the payment now has its receipt, and keeps its own category; only a payment without
 * a category takes the document's. What the payment had before is saved in `beforeLink` for an unlink.
 */
export function linkDocument(doc: Doc, tx: Transaction, auto: boolean): { doc: Doc; tx: Transaction } {
  const takesDocBooking = tx.booking === null;
  return {
    doc: {
      ...doc,
      paymentId: tx.id,
      history: logged(doc.history, auto ? 'linkedAuto' : 'linked', { name: tx.counterparty }),
    },
    tx: {
      ...tx,
      beforeLink: { booking: tx.booking, confirmed: tx.confirmed, receipt: tx.receipt },
      receipt: 'attached',
      receiptFile: doc.fileName,
      booking: takesDocBooking ? doc.booking : tx.booking,
      confirmed: takesDocBooking ? doc.bookingConfirmed : tx.confirmed,
      history: logged(tx.history, auto ? 'receiptLinkedAuto' : 'receiptLinked', { name: docName(doc) }),
    },
  };
}

/**
 * Takes a document off its payment. The document keeps the booking the pair has now; the payment gets back what it
 * had before the link (a payment that was linked from the start keeps its booking), with its receipt missing again.
 */
export function unlinkDocument(doc: Doc, tx: Transaction): { doc: Doc; tx: Transaction } {
  const before = tx.beforeLink ?? { booking: tx.booking, confirmed: tx.confirmed };
  return {
    doc: {
      ...doc,
      paymentId: null,
      booking: tx.booking,
      bookingConfirmed: tx.confirmed,
      history: logged(doc.history, 'unlinked', { name: tx.counterparty }),
    },
    tx: {
      ...tx,
      booking: before.booking,
      confirmed: before.confirmed,
      receipt: 'missing',
      receiptFile: null,
      beforeLink: null,
      history: logged(tx.history, 'receiptUnlinked', { name: docName(doc) }),
    },
  };
}

/** The person keeps a document although it looks like one that is already there. */
export function keepDuplicate(doc: Doc): Doc {
  return { ...doc, duplicateOf: null, history: logged(doc.history, 'keptDuplicate') };
}

/** The person says whether the document was received or sent. */
export function setDirection(doc: Doc, direction: DocDirection): Doc {
  return { ...doc, direction, history: logged(doc.history, direction === 'received' ? 'markedReceived' : 'markedSent') };
}

/** The person types in or corrects what reading found. */
export function editDocument(
  doc: Doc,
  changes: Partial<Pick<Doc, 'direction' | 'name' | 'invoiceNo' | 'date' | 'dueDate' | 'amountCents' | 'vatRate'>>,
): Doc {
  return { ...doc, ...changes, history: logged(doc.history, 'docEdited') };
}

/** The person picks the category; choosing it also confirms the booking. */
export function changeDocCategory(doc: Doc, booking: Booking): Doc {
  return {
    ...doc,
    booking,
    bookingConfirmed: true,
    history: logged(doc.history, 'categoryChanged', { category: booking.labelKey }),
  };
}

/** The person agrees with the suggested booking. */
export function confirmDocBooking(doc: Doc): Doc {
  const params: Record<string, string> = doc.booking ? { category: doc.booking.labelKey } : {};
  return { ...doc, bookingConfirmed: true, history: logged(doc.history, 'confirmed', params) };
}
