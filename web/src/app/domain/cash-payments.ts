import type { Account, Business, Doc, HistoryEntry, Invoice, Transaction } from '../data/models';
import { docName, docStatus } from './document-status';
import { leftCents, revenueBookingFor } from './invoices';

// Payments the app makes up itself because the money never went through a bank account of the business: a customer paying an invoice
// in cash (or a simulated payment), and the person saying a received receipt was paid in cash or with their own money. Pure functions.
// Dates are ISO dates.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `<prefix>-<n>` for the smallest n above the number of ids taken that none of them uses. */
export function newId(prefix: string, taken: readonly string[]): string {
  const used = new Set(taken);
  let n = taken.length + 1;
  while (used.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

/** An incoming payment of what is left of an invoice, booked and confirmed, with no receipt yet (linking it to the invoice gives it one). */
export function paymentFor(
  business: Business,
  invoice: Invoice,
  accountId: string,
  date: string,
  counterpartyIban: string,
  history: HistoryEntry[],
): Transaction {
  return {
    id: newId(`${business.id}-pay`, business.transactions.map((t) => t.id)),
    date,
    counterparty: invoice.customer.name,
    accountId,
    amountCents: leftCents(invoice, business),
    booking: revenueBookingFor(invoice, business.taxProfile),
    confirmed: true,
    isPrivate: false,
    receipt: 'missing',
    receiptFile: null,
    counterpartyIban,
    reference: invoice.number ?? '',
    history,
    beforePrivate: null,
    beforeLink: null,
  };
}

/**
 * Whether the person can say a document was paid in cash or with their own money: a received receipt that is read, has its direction,
 * amount, date and name, does not look like a duplicate, and waits for its payment. Not an invoice written in Invoices (it is paid there)
 * and not a self-issued receipt (it has its payment).
 */
export function canPayPrivately(doc: Doc): boolean {
  const status = docStatus(doc);
  return doc.direction === 'received' && doc.invoice === null && doc.selfIssued === null && (status === 'waiting' || status === 'overdue');
}

/** Whether `day` is a day the receipt can have been paid on: from the receipt's date up to `today`. A receipt with no date allows none. */
export function payDayAllowed(doc: Doc, day: string, today: string): boolean {
  return doc.date !== null && ISO_DAY.test(day) && doc.date <= day && day <= today;
}

/**
 * The payment of a received receipt that was paid in cash (an account of kind `cash`, the cash box) or with the person's own money (kind
 * `own`) on `day`: money out of the receipt's amount, booked and confirmed with the receipt's category and the VAT it says (none for a
 * business that charges none, `kleinunternehmer`), with the receipt attached and a `paidInCash` or `paidWithOwnMoney` line. A receipt with
 * no category yet gives a payment with none, not confirmed, so it still asks for one. The id comes from the receipt, so it is the same
 * wherever it is made and no payment is made twice for one receipt. The caller adds the payment and links the receipt to it.
 */
export function paidFromReceiptFor(doc: Doc, account: Account, day: string, kleinunternehmer = false): Transaction {
  if (doc.amountCents === null) throw new Error(`The receipt ${doc.id} has no amount, so no payment can be made from it`);
  const vatRate = kleinunternehmer ? 0 : doc.vatRate;
  return {
    id: `paid-${doc.id}`,
    date: day,
    counterparty: docName(doc),
    accountId: account.id,
    amountCents: -doc.amountCents,
    booking: doc.booking && { ...doc.booking, vatRate },
    confirmed: doc.booking !== null,
    isPrivate: false,
    receipt: 'attached',
    receiptFile: doc.fileName,
    counterpartyIban: '',
    reference: doc.invoiceNo,
    history: [{ date: day, key: account.kind === 'own' ? 'paidWithOwnMoney' : 'paidInCash', params: {} }],
    beforePrivate: null,
    beforeLink: null,
  };
}

/**
 * Whether a payment is locked to its receipt: it was made from the receipt (see `paidFromReceiptFor`), so the receipt can't be taken off it.
 * Its history says so for as long as the payment lives. A payment that pays an invoice has its `paidInCash` line too, but its document is
 * the invoice's, which is locked for that reason.
 */
export function lockedToReceipt(tx: Transaction): boolean {
  return tx.history.some((line) => line.key === 'paidInCash' || line.key === 'paidWithOwnMoney');
}
