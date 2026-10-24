import { DEMO_TODAY } from '../data/demo-date';
import type { Booking, Business, Doc, SelfIssuedReason, Transaction } from '../data/models';
import { namesAlike } from './document-matching';

// Self-issued receipts (Eigenbeleg): what a person writes for a payment whose receipt is lost or was never given. Pure functions. A
// self-issued receipt can't claim input VAT, so the payment it is written for is booked with 0 % VAT from then on (see `withoutVat`).
// Dates are ISO dates, months are 'YYYY-MM', and a closed month is told by the `isClosed` function the caller passes (Reports' rule,
// see `isClosedDate`).

/** Above this amount (150 €) the form says to ask the seller for a copy first: tax offices question larger self-issued receipts more often. It is a note, not a block. */
export const SELF_ISSUED_NOTE_CENTS = 15000;

/** What the person fills in: what the money was for, why there is no receipt (`reasonText` is the text of `other`), and the payee's address if they know it. */
export interface SelfIssuedInput {
  purpose: string;
  reason: SelfIssuedReason;
  reasonText: string | null;
  address: string | null;
}

const filled = (text: string | null): text is string => text !== null && text.trim() !== '';

/**
 * Whether a self-issued receipt can be written for a payment: money out, with its receipt missing, not private, and (for
 * a caller that respects closed months, `isClosed` takes 'YYYY-MM') not dated in a closed month.
 */
export function canWriteSelfIssued(tx: Transaction, isClosed: (month: string) => boolean): boolean {
  return tx.amountCents < 0 && tx.receipt === 'missing' && !tx.isPrivate && !isClosed(tx.date.slice(0, 7));
}

/**
 * What still stops the receipt from being created, in the order of the form: a purpose that is not blank, a text for the reason
 * "something else", and the tick that says it is true (`confirmed`).
 */
export function selfIssuedProblems(input: SelfIssuedInput, confirmed: boolean): ('purpose' | 'reasonText' | 'confirm')[] {
  const problems: ('purpose' | 'reasonText' | 'confirm')[] = [];
  if (!filled(input.purpose)) problems.push('purpose');
  if (input.reason === 'other' && !filled(input.reasonText)) problems.push('reasonText');
  if (!confirmed) problems.push('confirm');
  return problems;
}

/**
 * The next number of the year, `EB-<year>-<NNN>` with three digits: one above the highest self-issued receipt of the business
 * that year, so every year starts at 001 and, as a receipt that is undone takes its number with it, none is ever left out.
 * Only documents that are self-issued receipts count.
 */
export function nextSelfIssuedNumber(business: Business, year: string): string {
  const prefix = `EB-${year}-`;
  const highest = business.documents.reduce((max, doc) => {
    const number = doc.selfIssued?.number ?? '';
    const tail = number.startsWith(prefix) ? number.slice(prefix.length) : '';
    return /^\d+$/.test(tail) ? Math.max(max, Number(tail)) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

/**
 * The document of a self-issued receipt for a payment, as Documents holds it: a received document from the payee, dated as the payment,
 * with the payment's amount (positive) and the payment's category at 0 % VAT, numbered for the year of `today`, and not linked yet
 * (the caller links it). `confirmedBy` is the full name of the person who confirmed it is true. What the person typed is kept without the
 * spaces around it, a reason text only for "something else", and a blank address as none.
 */
export function selfIssuedDocFor(business: Business, tx: Transaction, input: SelfIssuedInput, confirmedBy: string, today: string): Doc {
  const number = nextSelfIssuedNumber(business, today.slice(0, 4));
  return {
    id: `doc-${number}`,
    fileName: `${number}.pdf`,
    source: 'file',
    addedOn: today,
    fromUpload: true,
    reading: false,
    name: tx.counterparty,
    direction: 'received',
    invoiceNo: number,
    date: tx.date,
    dueDate: null,
    amountCents: Math.abs(tx.amountCents),
    vatRate: 0,
    duplicateOf: null,
    booking: tx.booking && { ...tx.booking, vatRate: 0 },
    bookingConfirmed: tx.booking !== null && tx.confirmed,
    paymentId: null,
    history: [{ date: today, key: 'selfIssued', params: { number } }],
    invoice: null,
    selfIssued: {
      number,
      reason: input.reason,
      reasonText: input.reason === 'other' && filled(input.reasonText) ? input.reasonText.trim() : null,
      purpose: input.purpose.trim(),
      address: filled(input.address) ? input.address.trim() : null,
      confirmedBy,
      issuedOn: today,
    },
  };
}

/** Whether a self-issued receipt is linked to the payment. */
export function hasSelfIssuedReceipt(business: Business, txId: string): boolean {
  return business.documents.some((doc) => doc.selfIssued !== null && doc.paymentId === txId);
}

/**
 * The payment that already has a self-issued receipt and that a real receipt which turned up later is probably the receipt of: the document
 * is received, waits (is read, and linked to no payment) and has the payment's amount and a name alike its payee's (see `namesAlike`).
 * Null when there is none. Such a receipt can't be linked, because the payment has a receipt already.
 */
export function selfIssuedPaymentFor(business: Business, doc: Doc): Transaction | null {
  if (doc.direction !== 'received' || doc.paymentId !== null || doc.reading || doc.selfIssued !== null) return null;
  const { amountCents, name } = doc;
  if (amountCents === null || name === null) return null;
  return (
    business.transactions.find(
      (tx) => hasSelfIssuedReceipt(business, tx.id) && Math.abs(tx.amountCents) === amountCents && namesAlike(name, tx.counterparty),
    ) ?? null
  );
}

/**
 * What the form offers for "What was it for?": the payment's reference without extra spaces, with the name of its category in front
 * when the caller gives one (`categoryLabel`: the label of `booking.<labelKey>` in the person's language, which only the screen can
 * translate). Empty when there is neither.
 */
export function purposeSuggestion(tx: Transaction, categoryLabel: string | null = null): string {
  const reference = tx.reference.replace(/\s+/g, ' ').trim();
  const label = categoryLabel?.trim() ?? '';
  return label !== '' && reference !== '' ? `${label}: ${reference}` : label || reference;
}

// --- the 0 % VAT ---

/**
 * The payment as a self-issued receipt leaves it: its category stays, at 0 % VAT, and one `vatRemovedSelfIssued` line says why. A
 * payment that has no category yet gets the line too, so the category it is given later has no VAT either (see `keepsNoVat`).
 */
export function withoutVat(tx: Transaction, today: string = DEMO_TODAY): Transaction {
  return {
    ...tx,
    booking: tx.booking && { ...tx.booking, vatRate: 0 },
    history: [{ date: today, key: 'vatRemovedSelfIssued', params: {} }, ...tx.history],
  };
}

/** Whether a self-issued receipt took the VAT off this payment: its history says so, and it stays so whatever category the payment gets. */
export function keepsNoVat(tx: Transaction): boolean {
  return tx.history.some((line) => line.key === 'vatRemovedSelfIssued');
}

/** The booking a payment gets when its category is set to `booking`: as it is, but at 0 % VAT for a payment that keeps no VAT (see `keepsNoVat`). */
export function bookingKeepingNoVat(tx: Transaction, booking: Booking): Booking {
  return keepsNoVat(tx) ? { ...booking, vatRate: 0 } : booking;
}
