import { OFFICE, PHONE, TRAVEL } from '../data/categories';
import type { Business, Doc, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  changeDocCategory,
  confirmDocBooking,
  editDocument,
  keepDuplicate,
  linkDocument,
  setDirection,
  unlinkDocument,
} from './document-actions';
import { docStatus } from './document-status';
import { paymentStatus } from './payment-status';

function business(id: string): Business {
  return structuredClone(BUSINESSES.find((b) => b.id === id)!);
}

const weber = business('weber-design');
const doc = (id: string): Doc => structuredClone(weber.documents.find((d) => d.id === id)!);
const tx = (id: string): Transaction => structuredClone(weber.transactions.find((t) => t.id === id)!);

const TODAY = '2026-10-22';

describe('linkDocument', () => {
  it('links the pair and writes one history line on each side', () => {
    const d = doc('wd-d4');
    const t = tx('wd-t17');
    const linked = linkDocument(d, t, false);
    expect(linked.doc.paymentId).toBe('wd-t17');
    expect(linked.doc.history[0]).toEqual({ date: TODAY, key: 'linked', params: { name: 'SCHREIBWAREN BOETTCHER' } });
    expect(linked.doc.history).toHaveLength(d.history.length + 1);
    expect(linked.tx.receipt).toBe('attached');
    expect(linked.tx.receiptFile).toBe('boettcher-quittung.pdf');
    expect(linked.tx.history[0]).toEqual({ date: TODAY, key: 'receiptLinked', params: { name: 'Böttcher Bürobedarf' } });
    expect(linked.tx.history).toHaveLength(t.history.length + 1);
    expect(paymentStatus(linked.tx)).toBe('booked');
    expect(docStatus(linked.doc)).toBe('done');
  });

  it('writes the automatic variants of the history lines', () => {
    const linked = linkDocument(doc('wd-d4'), tx('wd-t17'), true);
    expect(linked.doc.history[0].key).toBe('linkedAuto');
    expect(linked.doc.history[0].params).toEqual({ name: 'SCHREIBWAREN BOETTCHER' });
    expect(linked.tx.history[0].key).toBe('receiptLinkedAuto');
    expect(linked.tx.history[0].params).toEqual({ name: 'Böttcher Bürobedarf' });
  });

  it('names the document by its file while its name is not known', () => {
    const unnamed: Doc = { ...doc('wd-d4'), name: null };
    const linked = linkDocument(unnamed, tx('wd-t17'), false);
    expect(linked.tx.history[0].params).toEqual({ name: 'boettcher-quittung.pdf' });
  });

  it('saves what the payment had before the link', () => {
    const t = tx('wd-t17');
    const linked = linkDocument(doc('wd-d4'), t, false);
    expect(linked.tx.beforeLink).toEqual({ booking: OFFICE, confirmed: true, receipt: 'missing' });
  });

  it('link takes the document\'s category when the payment has none', () => {
    const none: Transaction = { ...tx('wd-t17'), booking: null, confirmed: false };
    const d: Doc = { ...doc('wd-d4'), booking: TRAVEL, bookingConfirmed: true };
    const linked = linkDocument(d, none, false);
    expect(linked.tx.booking).toEqual(TRAVEL);
    expect(linked.tx.confirmed).toBe(true);
    expect(linked.tx.beforeLink).toEqual({ booking: null, confirmed: false, receipt: 'missing' });
  });

  it('link keeps the payment\'s own category', () => {
    const d: Doc = { ...doc('wd-d4'), booking: TRAVEL, bookingConfirmed: false };
    const linked = linkDocument(d, tx('wd-t17'), false);
    expect(linked.tx.booking).toEqual(OFFICE);
    expect(linked.tx.confirmed).toBe(true);
  });

  it('leaves the inputs alone', () => {
    const d = doc('wd-d4');
    const t = tx('wd-t17');
    const dCopy = structuredClone(d);
    const tCopy = structuredClone(t);
    linkDocument(d, t, false);
    expect(d).toEqual(dCopy);
    expect(t).toEqual(tCopy);
  });
});

describe('unlinkDocument', () => {
  it('unlink restores the payment and keeps the pair\'s booking on the document', () => {
    const linked = linkDocument(doc('wd-d4'), tx('wd-t17'), false);
    // While linked, the person re-categorises the payment.
    const changed: Transaction = { ...linked.tx, booking: TRAVEL, confirmed: true };
    const unlinked = unlinkDocument(linked.doc, changed);

    expect(unlinked.tx.booking).toEqual(OFFICE);
    expect(unlinked.tx.confirmed).toBe(true);
    expect(unlinked.tx.receipt).toBe('missing');
    expect(unlinked.tx.receiptFile).toBeNull();
    expect(unlinked.tx.beforeLink).toBeNull();
    expect(paymentStatus(unlinked.tx)).toBe('noReceipt');
    expect(unlinked.tx.history[0]).toEqual({ date: TODAY, key: 'receiptUnlinked', params: { name: 'Böttcher Bürobedarf' } });

    expect(unlinked.doc.paymentId).toBeNull();
    expect(unlinked.doc.booking).toEqual(TRAVEL);
    expect(unlinked.doc.bookingConfirmed).toBe(true);
    expect(unlinked.doc.history[0]).toEqual({ date: TODAY, key: 'unlinked', params: { name: 'SCHREIBWAREN BOETTCHER' } });
    expect(docStatus(unlinked.doc)).toBe('waiting');
  });

  it('gives the payment its booking back when the document had supplied it', () => {
    const none: Transaction = { ...tx('wd-t17'), booking: null, confirmed: false };
    const linked = linkDocument({ ...doc('wd-d4'), booking: TRAVEL, bookingConfirmed: true }, none, false);
    const unlinked = unlinkDocument(linked.doc, linked.tx);
    expect(unlinked.tx.booking).toBeNull();
    expect(unlinked.tx.confirmed).toBe(false);
    expect(paymentStatus(unlinked.tx)).toBe('unclear');
    expect(unlinked.doc.booking).toEqual(TRAVEL);
    expect(unlinked.doc.bookingConfirmed).toBe(true);
  });

  it('unlinking a sample-linked payment leaves its booking and makes its receipt missing', () => {
    const t = tx('wd-t2');
    expect(t.beforeLink).toBeNull();
    const unlinked = unlinkDocument(doc('doc-wd-t2'), t);
    expect(unlinked.tx.booking).toEqual(PHONE);
    expect(unlinked.tx.confirmed).toBe(true);
    expect(unlinked.tx.receipt).toBe('missing');
    expect(unlinked.tx.receiptFile).toBeNull();
    expect(unlinked.tx.beforeLink).toBeNull();
    expect(paymentStatus(unlinked.tx)).toBe('noReceipt');
    expect(unlinked.doc.paymentId).toBeNull();
    expect(unlinked.doc.booking).toEqual(PHONE);
  });

  it('leaves the inputs alone', () => {
    const d = doc('doc-wd-t2');
    const t = tx('wd-t2');
    const dCopy = structuredClone(d);
    const tCopy = structuredClone(t);
    unlinkDocument(d, t);
    expect(d).toEqual(dCopy);
    expect(t).toEqual(tCopy);
  });
});

describe('document actions', () => {
  it('keepDuplicate clears the duplicate mark and logs it', () => {
    const duplicate: Doc = { ...doc('wd-d4'), duplicateOf: 'doc-wd-t2' };
    expect(docStatus(duplicate)).toBe('duplicate');
    const next = keepDuplicate(duplicate);
    expect(next.duplicateOf).toBeNull();
    expect(docStatus(next)).toBe('waiting');
    expect(next.history[0]).toEqual({ date: TODAY, key: 'keptDuplicate', params: {} });
    expect(next.history).toHaveLength(duplicate.history.length + 1);
  });

  it('setDirection sets the direction and logs received or sent', () => {
    const undecided: Doc = { ...doc('wd-d4'), direction: null };
    expect(docStatus(undecided)).toBe('direction');
    const received = setDirection(undecided, 'received');
    expect(received.direction).toBe('received');
    expect(received.history[0]).toEqual({ date: TODAY, key: 'markedReceived', params: {} });
    const sent = setDirection(undecided, 'sent');
    expect(sent.direction).toBe('sent');
    expect(sent.history[0]).toEqual({ date: TODAY, key: 'markedSent', params: {} });
  });

  it('editDocument changes only the given fields and logs one line', () => {
    const photo = doc('wd-d1');
    expect(photo.amountCents).toBeNull();
    const next = editDocument(photo, { amountCents: 1890, vatRate: 7 });
    expect(next.amountCents).toBe(1890);
    expect(next.vatRate).toBe(7);
    expect(next.name).toBe(photo.name);
    expect(next.invoiceNo).toBe(photo.invoiceNo);
    expect(next.history[0]).toEqual({ date: TODAY, key: 'docEdited', params: {} });
    expect(next.history).toHaveLength(photo.history.length + 1);
    expect(docStatus(next)).toBe('waiting');
  });

  it('editDocument can change direction, name, invoice number and dates', () => {
    const next = editDocument(doc('wd-d4'), {
      direction: 'sent',
      name: 'Neuer Name',
      invoiceNo: 'X-1',
      date: '2026-10-01',
      dueDate: '2026-10-31',
    });
    expect(next).toMatchObject({ direction: 'sent', name: 'Neuer Name', invoiceNo: 'X-1', date: '2026-10-01', dueDate: '2026-10-31' });
  });

  it('editDocument that changes the direction also logs that the person chose it', () => {
    const received = doc('wd-d4');
    const toSent = editDocument(received, { direction: 'sent', name: 'Neuer Name' });
    expect(toSent.history[0]).toEqual({ date: TODAY, key: 'docEdited', params: {} });
    expect(toSent.history[1]).toEqual({ date: TODAY, key: 'markedSent', params: {} });
    expect(toSent.history).toHaveLength(received.history.length + 2);

    const sent = doc('wd-d2');
    const toReceived = editDocument(sent, { direction: 'received' });
    expect(toReceived.history.slice(0, 2).map((h) => h.key)).toEqual(['docEdited', 'markedReceived']);
  });

  it('editDocument that keeps the direction, or does not touch it, logs only the edit', () => {
    const received = doc('wd-d4');
    for (const changes of [{ direction: 'received' as const }, { name: 'Neuer Name' }]) {
      const next = editDocument(received, changes);
      expect(next.history.map((h) => h.key)).toEqual(['docEdited', ...received.history.map((h) => h.key)]);
    }
  });

  it('changeDocCategory sets and confirms the booking', () => {
    const d = doc('wd-d4');
    expect(d.bookingConfirmed).toBe(false);
    const next = changeDocCategory(d, TRAVEL);
    expect(next.booking).toBe(TRAVEL);
    expect(next.bookingConfirmed).toBe(true);
    expect(next.history[0]).toEqual({ date: TODAY, key: 'categoryChanged', params: { category: 'travel' } });
  });

  it('confirmDocBooking confirms the suggested booking', () => {
    const d = doc('wd-d4');
    const next = confirmDocBooking(d);
    expect(next.bookingConfirmed).toBe(true);
    expect(next.booking).toBe(d.booking);
    expect(next.history[0]).toEqual({ date: TODAY, key: 'confirmed', params: { category: 'office' } });
  });

  it('actions return a new document and leave the old one alone', () => {
    const d = doc('wd-d4');
    const copy = structuredClone(d);
    const next = setDirection(d, 'sent');
    expect(next).not.toBe(d);
    expect(d).toEqual(copy);
  });
});
