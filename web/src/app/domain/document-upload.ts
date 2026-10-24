import { DEMO_TODAY } from '../data/demo-date';
import type { Doc, DocSource, HistoryEntry, PoolResult } from '../data/models';

// Pure parts of the simulated upload: which files are accepted, which ready-made reading result a file gets,
// and how a document looks while it is read and after. No file is stored and nothing is really read.

/** The biggest file a person can add. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** How long a document shows Reading… before its result appears. */
export const READING_MS = 2000;

const ACCEPTED_NAME = /\.(pdf|jpe?g|png|xml)$/i;
/** The same extensions as the file picker's `accept` list, so it offers what `checkFile` takes. */
export const ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.xml';

export type RefuseReason = 'type' | 'size';

/** Why a file is not accepted: its type comes first, then its size; null when it is fine. */
export function checkFile(file: { name: string; size: number }): RefuseReason | null {
  if (!ACCEPTED_NAME.test(file.name)) return 'type';
  return file.size > MAX_FILE_BYTES ? 'size' : null;
}

/** The reading result for the file at `index` of a pool; past the end the plain receipts repeat, so nothing new needs the person. */
export function nextPoolResult(pool: readonly PoolResult[], index: number): PoolResult {
  if (index < pool.length) return pool[index];
  const plain = pool.filter((result) => result.plain);
  return plain[(index - pool.length) % plain.length];
}

const ADDED_KEY = { photo: 'addedPhoto', file: 'addedFile', email: 'addedEmail' } as const;

/** A document that was just added: still being read, so nothing about it is known yet. */
export function newReadingDoc(id: string, fileName: string, source: DocSource): Doc {
  return {
    id,
    fileName,
    source,
    addedOn: DEMO_TODAY,
    fromUpload: true,
    reading: true,
    name: null,
    direction: null,
    invoiceNo: '',
    date: null,
    dueDate: null,
    amountCents: null,
    vatRate: 0,
    duplicateOf: null,
    booking: null,
    bookingConfirmed: false,
    paymentId: null,
    history: [{ date: DEMO_TODAY, key: ADDED_KEY[source], params: {} }],
    invoice: null,
    selfIssued: null,
  };
}

/** The document once reading is done: what the result found, a suggested booking that is not confirmed yet, and a docRead line. */
export function applyReadResult(doc: Doc, result: PoolResult): Doc {
  // Reading suggests a category only when it found a booking.
  const read: HistoryEntry[] = result.booking
    ? [{ date: DEMO_TODAY, key: 'docRead', params: { category: result.booking.labelKey } }]
    : [];
  return {
    ...doc,
    reading: false,
    name: result.name,
    direction: result.direction,
    invoiceNo: result.invoiceNo,
    date: result.date,
    dueDate: result.dueDate,
    amountCents: result.amountCents,
    vatRate: result.vatRate,
    duplicateOf: result.duplicateOf,
    booking: result.booking,
    bookingConfirmed: false,
    history: [...read, ...doc.history],
  };
}
