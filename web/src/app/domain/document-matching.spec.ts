import type { Business, Doc, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { UPLOAD_POOLS } from '../data/sample-documents';
import { certainMatch, documentCandidates, nameTokens, paymentCandidates } from './document-matching';

function business(id: string): Business {
  return structuredClone(BUSINESSES.find((b) => b.id === id)!);
}

const weber = business('weber-design');
const sara = business('sara-yoga');
const doc = (b: Business, id: string): Doc => b.documents.find((d) => d.id === id)!;
const tx = (b: Business, id: string): Transaction => b.transactions.find((t) => t.id === id)!;
const ids = (list: readonly { id: string }[]): string[] => list.map((item) => item.id);

/** A document made from a pool entry's fields, as a simulated upload makes it. */
function docFromPool(poolIndex: number): Doc {
  const read = UPLOAD_POOLS['weber-design'][poolIndex];
  return {
    id: 'up-1',
    fileName: 'scan.pdf',
    source: 'file',
    addedOn: '2026-10-22',
    fromUpload: true,
    reading: false,
    name: read.name,
    direction: read.direction,
    invoiceNo: read.invoiceNo,
    date: read.date,
    dueDate: read.dueDate,
    amountCents: read.amountCents,
    vatRate: read.vatRate,
    duplicateOf: read.duplicateOf,
    booking: read.booking,
    bookingConfirmed: false,
    paymentId: null,
    history: [],
  };
}

/** A payment with a missing receipt; the tests change only what they care about. */
function missingPayment(over: Partial<Transaction>): Transaction {
  return { ...tx(weber, 'wd-t17'), ...over };
}

/** A received document that is not linked, not reading and not a duplicate. */
function freeDoc(over: Partial<Doc>): Doc {
  return { ...doc(weber, 'wd-d4'), ...over };
}

describe('nameTokens', () => {
  it('lower-cases, writes umlauts out and splits into words', () => {
    expect(nameTokens('Böttcher Bürobedarf')).toEqual(['boettcher', 'buerobedarf']);
    expect(nameTokens('Großmarkt Übel Äpfel')).toEqual(['grossmarkt', 'uebel', 'aepfel']);
  });

  it('splits on anything that is not a letter or digit and drops tokens shorter than 3', () => {
    expect(nameTokens('Krause & Partner')).toEqual(['krause', 'partner']);
    expect(nameTokens('K+K Markt-24, Berlin')).toEqual(['markt', 'berlin']);
    expect(nameTokens('')).toEqual([]);
  });
});

describe('paymentCandidates', () => {
  it('ranks wd-d4 (Böttcher receipt) with wd-t17 first', () => {
    expect(paymentCandidates(doc(weber, 'wd-d4'), weber.transactions)[0].id).toBe('wd-t17');
  });

  it('ranks sy-d1 (Kiezdruck flyers) with sy-t8 first', () => {
    expect(paymentCandidates(doc(sara, 'sy-d1'), sara.transactions)[0].id).toBe('sy-t8');
  });

  it('offers only payments out for a received document, and only payments in for a sent one', () => {
    const received = paymentCandidates(doc(weber, 'wd-d4'), weber.transactions);
    expect(received.length).toBeGreaterThan(0);
    expect(received.every((t) => t.amountCents < 0)).toBe(true);

    const sent = paymentCandidates(doc(weber, 'wd-d2'), weber.transactions);
    expect(sent.every((t) => t.amountCents > 0)).toBe(true);
  });

  it('never gives a sent document a money-out payment', () => {
    const outgoing = missingPayment({ id: 'out', amountCents: -238000 });
    expect(paymentCandidates(doc(weber, 'wd-d2'), [outgoing])).toEqual([]);
  });

  it('offers only payments whose receipt is missing', () => {
    const attached = missingPayment({ id: 'a', receipt: 'attached' });
    const notNeeded = missingPayment({ id: 'n', receipt: 'notNeeded' });
    const missing = missingPayment({ id: 'm' });
    expect(ids(paymentCandidates(doc(weber, 'wd-d4'), [attached, notNeeded, missing]))).toEqual(['m']);
  });

  it('leaves out private payments', () => {
    const priv = missingPayment({ id: 'p', isPrivate: true });
    expect(paymentCandidates(doc(weber, 'wd-d4'), [priv])).toEqual([]);
  });

  it('leaves out a payment of 0 euros: it has no direction', () => {
    expect(paymentCandidates(doc(weber, 'wd-d4'), [missingPayment({ amountCents: 0 })])).toEqual([]);
    expect(paymentCandidates(doc(weber, 'wd-d2'), [missingPayment({ amountCents: 0 })])).toEqual([]);
  });

  it('gives a document with no direction no payments', () => {
    const undecided = freeDoc({ direction: null });
    expect(paymentCandidates(undecided, weber.transactions)).toEqual([]);
  });

  it('ranks an equal amount first, then more shared name tokens, then the nearer date', () => {
    const d = freeDoc({ name: 'Boettcher Schreibwaren Berlin', amountCents: 2380, date: '2026-10-08' });
    const sameAmount = missingPayment({ id: 'amount', counterparty: 'Other', amountCents: -2380, date: '2026-09-01' });
    const twoTokens = missingPayment({ id: 'tokens2', counterparty: 'Schreibwaren Boettcher', amountCents: -999, date: '2026-09-01' });
    const oneToken = missingPayment({ id: 'tokens1', counterparty: 'Boettcher', amountCents: -999, date: '2026-10-08' });
    const nearer = missingPayment({ id: 'near', counterparty: 'Nobody', amountCents: -999, date: '2026-10-07' });
    const farther = missingPayment({ id: 'far', counterparty: 'Nobody', amountCents: -999, date: '2026-10-01' });
    const ranked = paymentCandidates(d, [farther, nearer, oneToken, twoTokens, sameAmount]);
    expect(ids(ranked)).toEqual(['amount', 'tokens2', 'tokens1', 'near', 'far']);
  });

  it('copes with a document whose amount and date are not read yet', () => {
    const unread = freeDoc({ amountCents: null, date: null });
    const ranked = paymentCandidates(unread, [missingPayment({})]);
    expect(ids(ranked)).toEqual(['wd-t17']);
  });
});

describe('documentCandidates', () => {
  it('offers the Böttcher receipt first for wd-t17, then the unread photo', () => {
    expect(ids(documentCandidates(tx(weber, 'wd-t17'), weber.documents))).toEqual(['wd-d4', 'wd-d1']);
  });

  it('leaves out linked, reading and duplicate documents', () => {
    const linked = freeDoc({ id: 'linked', paymentId: 'wd-t1' });
    const reading = freeDoc({ id: 'reading', reading: true });
    const duplicate = freeDoc({ id: 'dup', duplicateOf: 'doc-wd-t2' });
    const free = freeDoc({ id: 'free' });
    expect(ids(documentCandidates(tx(weber, 'wd-t17'), [linked, reading, duplicate, free]))).toEqual(['free']);
  });

  it('offers nothing for a payment of 0 euros', () => {
    expect(documentCandidates(missingPayment({ amountCents: 0 }), [freeDoc({})])).toEqual([]);
  });

  it('matches the direction to the payment: out for received, in for sent', () => {
    const received = freeDoc({ id: 'received' });
    const sent = freeDoc({ id: 'sent', direction: 'sent' });
    const none = freeDoc({ id: 'none', direction: null });
    expect(ids(documentCandidates(tx(weber, 'wd-t17'), [received, sent, none]))).toEqual(['received']);
    const incoming = missingPayment({ amountCents: 238000 });
    expect(ids(documentCandidates(incoming, [received, sent, none]))).toEqual(['sent']);
  });

  it('ranks by amount, then shared name tokens, then the nearer date', () => {
    const payment = missingPayment({ counterparty: 'Schreibwaren Boettcher', amountCents: -2380, date: '2026-10-08' });
    const sameAmount = freeDoc({ id: 'amount', name: 'Other', amountCents: 2380, date: '2026-09-01' });
    const twoTokens = freeDoc({ id: 'tokens2', name: 'Boettcher Schreibwaren', amountCents: 999, date: '2026-09-01' });
    const oneToken = freeDoc({ id: 'tokens1', name: 'Boettcher', amountCents: 999, date: '2026-10-08' });
    const nearer = freeDoc({ id: 'near', name: 'Nobody', amountCents: 999, date: '2026-10-07' });
    const farther = freeDoc({ id: 'far', name: 'Nobody', amountCents: 999, date: '2026-10-01' });
    const ranked = documentCandidates(payment, [farther, nearer, oneToken, twoTokens, sameAmount]);
    expect(ids(ranked)).toEqual(['amount', 'tokens2', 'tokens1', 'near', 'far']);
  });

  it('still offers a document whose name, amount and date are not read yet', () => {
    const unnamed = freeDoc({ id: 'unnamed', name: null, amountCents: null, date: null });
    expect(ids(documentCandidates(tx(weber, 'wd-t17'), [unnamed]))).toEqual(['unnamed']);
  });
});

describe('certainMatch', () => {
  it('finds wd-t3 for the Deutsche Bahn pool result', () => {
    expect(certainMatch(docFromPool(0), weber.transactions)?.id).toBe('wd-t3');
  });

  it('finds nothing for wd-d4: the names differ', () => {
    expect(certainMatch(doc(weber, 'wd-d4'), weber.transactions)).toBeNull();
  });

  it('finds nothing for the other pool results', () => {
    for (const index of [1, 2, 3, 4]) expect(certainMatch(docFromPool(index), weber.transactions)).toBeNull();
  });

  it('finds nothing when the date is more than 7 days away, and accepts exactly 7', () => {
    const payment = missingPayment({ counterparty: 'Deutsche Bahn', amountCents: -12000, date: '2026-10-17' });
    expect(certainMatch({ ...docFromPool(0), date: '2026-10-24' }, [payment])?.id).toBe(payment.id);
    expect(certainMatch({ ...docFromPool(0), date: '2026-10-25' }, [payment])).toBeNull();
    expect(certainMatch({ ...docFromPool(0), date: '2026-10-10' }, [payment])?.id).toBe(payment.id);
    expect(certainMatch({ ...docFromPool(0), date: '2026-10-09' }, [payment])).toBeNull();
  });

  it('accepts a name that contains the other', () => {
    const payment = missingPayment({ counterparty: 'Deutsche Bahn AG Fernverkehr', amountCents: -12000, date: '2026-10-17' });
    expect(certainMatch(docFromPool(0), [payment])?.id).toBe(payment.id);
  });

  it('finds nothing when two payments fit', () => {
    const first = missingPayment({ id: 'one', counterparty: 'Deutsche Bahn', amountCents: -12000, date: '2026-10-17' });
    const second = { ...first, id: 'two' };
    expect(certainMatch(docFromPool(0), [first, second])).toBeNull();
  });

  it('finds nothing when the amount differs or the document has no amount, date or name', () => {
    const payment = missingPayment({ counterparty: 'Deutsche Bahn', amountCents: -12001, date: '2026-10-17' });
    expect(certainMatch(docFromPool(0), [payment])).toBeNull();
    const fits = { ...payment, amountCents: -12000 };
    expect(certainMatch({ ...docFromPool(0), amountCents: null }, [fits])).toBeNull();
    expect(certainMatch({ ...docFromPool(0), date: null }, [fits])).toBeNull();
    expect(certainMatch({ ...docFromPool(0), name: null }, [fits])).toBeNull();
  });

  it('does not treat a name with no usable word as contained in every name', () => {
    const payment = missingPayment({ counterparty: 'Deutsche Bahn', amountCents: -12000, date: '2026-10-17' });
    expect(certainMatch({ ...docFromPool(0), name: 'A+B' }, [payment])).toBeNull();
  });
});
