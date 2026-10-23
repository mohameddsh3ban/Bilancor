import {
  ADVERTISING,
  CONSULTING,
  GOODS_7,
  OFFICE,
  PHONE,
  RENT,
  REVENUE_19,
  REVENUE_KU,
  SUPPLIES,
  TRAVEL,
} from './categories';
import type { Booking, Doc, DocDirection, DocSource, HistoryEntry, PoolResult, Transaction } from './models';

// All documents below are invented. Amounts are integer cents, always gross and positive.
// This file must not import sample-data.ts: sample-data.ts imports it to attach the documents to the businesses.
// A sent document that is an invoice written in the app is marked as one (`invoice`, and its number) by sample-data.ts, from sample-invoices.ts.

/**
 * The document behind a payment that has a receipt attached, as it was read when the payment was imported:
 * a supplier invoice for a payment out, an invoice to a customer for a payment in. A Kleinunternehmer sends no VAT.
 */
export function linkedDocFor(tx: Transaction, kleinunternehmer: boolean): Doc {
  const direction: DocDirection = tx.amountCents < 0 ? 'received' : 'sent';
  // Reading suggests a category only when the payment has one.
  const read: HistoryEntry[] = tx.booking ? [{ date: tx.date, key: 'docRead', params: { category: tx.booking.labelKey } }] : [];
  return {
    id: `doc-${tx.id}`,
    fileName: tx.receiptFile ?? `beleg-${tx.id}.pdf`,
    source: 'file',
    addedOn: tx.date,
    fromUpload: false,
    reading: false,
    name: tx.counterparty,
    direction,
    invoiceNo: tx.reference,
    date: tx.date,
    dueDate: null,
    amountCents: Math.abs(tx.amountCents),
    vatRate: kleinunternehmer && direction === 'sent' ? 0 : (tx.booking?.vatRate ?? 0),
    duplicateOf: null,
    booking: tx.booking,
    bookingConfirmed: tx.confirmed,
    paymentId: tx.id,
    history: [
      { date: tx.date, key: 'linkedAuto', params: { name: tx.counterparty } },
      ...read,
      { date: tx.date, key: 'addedFile', params: {} },
    ],
    invoice: null,
  };
}

/** What one extra sample document needs to say; `extra()` fills in the rest. */
interface ExtraSpec {
  id: string;
  file: string;
  source: DocSource;
  name: string;
  direction: DocDirection;
  invoiceNo: string;
  date: string;
  dueDate?: string;
  cents: number | null; // null: reading could not find the amount
  booking: Booking;
  confirmed: boolean;
}

const ADDED_KEY = { photo: 'addedPhoto', file: 'addedFile', email: 'addedEmail' } as const;

/** A document that is not linked to any payment, with the history of a file that was added and then read. */
function extra(s: ExtraSpec): Doc {
  return {
    id: s.id,
    fileName: s.file,
    source: s.source,
    addedOn: s.date,
    fromUpload: false,
    reading: false,
    name: s.name,
    direction: s.direction,
    invoiceNo: s.invoiceNo,
    date: s.date,
    dueDate: s.dueDate ?? null,
    amountCents: s.cents,
    vatRate: s.booking.vatRate,
    duplicateOf: null,
    booking: s.booking,
    bookingConfirmed: s.confirmed,
    paymentId: null,
    history: [
      { date: s.date, key: 'docRead', params: { category: s.booking.labelKey } },
      { date: s.date, key: ADDED_KEY[s.source], params: {} },
    ],
    invoice: null,
  };
}

/** The documents a business has besides the ones linked to its payments, by business id. */
export const EXTRA_DOCUMENTS: Record<string, Doc[]> = {
  'weber-design': [
    // A photo whose amount could not be read: the person types it in.
    extra({ id: 'wd-d1', file: 'IMG_2041.jpg', source: 'photo', name: 'Bürobedarf Schulz', direction: 'received', invoiceNo: 'K-55120', date: '2026-10-20', cents: null, booking: OFFICE, confirmed: false }),
    // Invoices to customers that nobody has paid yet; the second is overdue.
    extra({ id: 'wd-d2', file: 'RE-2026-044.pdf', source: 'file', name: 'Studio Kern', direction: 'sent', invoiceNo: 'RE-2026-044', date: '2026-10-16', dueDate: '2026-10-30', cents: 238000, booking: REVENUE_19, confirmed: true }),
    extra({ id: 'wd-d3', file: 'RE-2026-039.pdf', source: 'file', name: 'Bäckerei Lange', direction: 'sent', invoiceNo: 'RE-2026-039', date: '2026-09-16', dueDate: '2026-09-30', cents: 119000, booking: REVENUE_19, confirmed: true }),
    // The receipt for the payment wd-t17.
    extra({ id: 'wd-d4', file: 'boettcher-quittung.pdf', source: 'file', name: 'Böttcher Bürobedarf', direction: 'received', invoiceNo: 'Q-8812', date: '2026-10-08', cents: 2380, booking: OFFICE, confirmed: false }),
    // An invoice that was cancelled, and the cancellation invoice that cancels it: both stay on record, and no payment will settle either.
    extra({ id: 'wd-d5', file: 'RE-2026-040.pdf', source: 'file', name: 'Agentur Nord', direction: 'sent', invoiceNo: 'RE-2026-040', date: '2026-10-01', dueDate: '2026-10-15', cents: 59500, booking: REVENUE_19, confirmed: true }),
    extra({ id: 'wd-d6', file: 'RE-2026-042.pdf', source: 'file', name: 'Agentur Nord', direction: 'sent', invoiceNo: 'RE-2026-042', date: '2026-10-07', cents: 59500, booking: REVENUE_19, confirmed: true }),
  ],
  'sara-yoga': [
    // The invoice for the payment sy-t8.
    extra({ id: 'sy-d1', file: 'flyer-rechnung.pdf', source: 'file', name: 'Kiezdruck Druckerei', direction: 'received', invoiceNo: 'KD-3391', date: '2026-10-04', cents: 4500, booking: ADVERTISING, confirmed: false }),
    // An invoice to a customer that is paid in part (the payment sy-t15 covers half of it), so it is not linked to a payment yet.
    extra({ id: 'sy-d2', file: 'RE-2026-021.pdf', source: 'file', name: 'Physio Zentrum Mitte', direction: 'sent', invoiceNo: 'RE-2026-021', date: '2026-10-14', dueDate: '2026-11-13', cents: 60000, booking: REVENUE_KU, confirmed: true }),
  ],
  'cafe-linde': [
    // An invoice to a customer who has not paid and was reminded once: overdue since 9 October.
    extra({ id: 'cl-d1', file: 'RE-2026-053.pdf', source: 'file', name: 'Kanzlei Hoffmann', direction: 'sent', invoiceNo: 'RE-2026-053', date: '2026-09-25', dueDate: '2026-10-09', cents: 128520, booking: REVENUE_19, confirmed: true }),
  ],
};

/** What one pool entry needs to say; `result()` fills in the rest. */
type PoolSpec = Pick<PoolResult, 'name' | 'direction' | 'invoiceNo' | 'date' | 'amountCents' | 'booking'> & {
  duplicateOf?: string;
  plain?: boolean;
};

/** One reading result for a pool: no due date, VAT from the booking, not plain unless said so. */
function result(s: PoolSpec): PoolResult {
  return {
    name: s.name,
    direction: s.direction,
    invoiceNo: s.invoiceNo,
    date: s.date,
    dueDate: null,
    amountCents: s.amountCents,
    vatRate: s.booking?.vatRate ?? 0,
    duplicateOf: s.duplicateOf ?? null,
    booking: s.booking,
    plain: s.plain ?? false,
  };
}

/**
 * What a simulated upload "reads", by business id, in the order the demo hands the results out.
 * After the last entry a pool repeats its plain receipts: no duplicate, a clear direction, no sure match.
 */
export const UPLOAD_POOLS: Record<string, PoolResult[]> = {
  'weber-design': [
    // The one certain match for the payment wd-t3.
    result({ name: 'Deutsche Bahn', direction: 'received', invoiceNo: '8841', date: '2026-10-17', amountCents: 12000, booking: TRAVEL }),
    // Looks like a document that is already there.
    result({ name: 'Telekom', direction: 'received', invoiceNo: '8841 0712', date: '2026-10-19', amountCents: 3995, booking: PHONE, duplicateOf: 'doc-wd-t2' }),
    // Reading cannot tell whether it was sent or received.
    result({ name: 'Krause & Partner', direction: null, invoiceNo: '2026-117', date: '2026-10-21', amountCents: 45000, booking: CONSULTING }),
    result({ name: 'Copyshop Mitte', direction: 'received', invoiceNo: 'B-2231', date: '2026-10-21', amountCents: 1250, booking: OFFICE, plain: true }),
    result({ name: 'Parkhaus Alexa', direction: 'received', invoiceNo: 'P-90812', date: '2026-10-21', amountCents: 600, booking: TRAVEL, plain: true }),
  ],
  'sara-yoga': [
    result({ name: 'Yogashop Berlin', direction: 'received', invoiceNo: '22-9204', date: '2026-10-21', amountCents: 3290, booking: SUPPLIES, plain: true }),
    result({ name: 'Raumhaus Berlin', direction: 'received', invoiceNo: 'R-1102', date: '2026-10-21', amountCents: 35000, booking: RENT, plain: true }),
  ],
  'cafe-linde': [
    result({ name: 'Metro Großmarkt', direction: 'received', invoiceNo: '0419-90321', date: '2026-10-21', amountCents: 21480, booking: GOODS_7, plain: true }),
    result({ name: 'Bäckerei Frisch', direction: 'received', invoiceNo: 'F-7781', date: '2026-10-21', amountCents: 5630, booking: GOODS_7, plain: true }),
  ],
};
