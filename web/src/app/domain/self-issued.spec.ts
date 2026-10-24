import { TRAVEL } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, Doc, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  SELF_ISSUED_NOTE_CENTS,
  bookingKeepingNoVat,
  canWriteSelfIssued,
  hasSelfIssuedReceipt,
  keepsNoVat,
  nextSelfIssuedNumber,
  purposeSuggestion,
  selfIssuedDocFor,
  selfIssuedPaymentFor,
  selfIssuedProblems,
  withoutVat,
  type SelfIssuedInput,
} from './self-issued';

const weber = (): Business => structuredClone(BUSINESSES.find((b) => b.id === 'weber-design')!);
/** The APCOA Parking payment of the sample data: money out, a category with 19 % VAT, no receipt. */
const apcoa = (patch: Partial<Transaction> = {}): Transaction => ({
  ...structuredClone(weber().transactions.find((t) => t.id === 'wd-t20')!),
  ...patch,
});

const INPUT: SelfIssuedInput = { purpose: 'Parking at the client meeting', reason: 'machine', reasonText: null, address: null };

/** The business with self-issued receipts that carry these numbers, written long ago. */
function withReceipts(...numbers: string[]): Business {
  const business = weber();
  const base = business.documents[0];
  const receipts = numbers.map((number) => ({
    ...base,
    id: `doc-${number}`,
    selfIssued: { number, reason: 'lost' as const, reasonText: null, purpose: 'Parking', address: null, confirmedBy: 'Sara Weber', issuedOn: '2026-10-01' },
  }));
  return { ...business, documents: [...receipts, ...business.documents] };
}

describe('SELF_ISSUED_NOTE_CENTS', () => {
  it('is 150 euros: above it the form asks to get a copy from the seller first', () => {
    expect(SELF_ISSUED_NOTE_CENTS).toBe(15000);
  });
});

describe('canWriteSelfIssued', () => {
  const open = () => false;

  it('is for money out with a missing receipt, in an open month', () => {
    expect(canWriteSelfIssued(apcoa(), open)).toBe(true);
  });

  it('is not for money in', () => {
    expect(canWriteSelfIssued(apcoa({ amountCents: 650 }), open)).toBe(false);
  });

  it('is not for a private payment', () => {
    expect(canWriteSelfIssued(apcoa({ isPrivate: true }), open)).toBe(false);
  });

  it('is not for a payment that has a receipt, or needs none', () => {
    expect(canWriteSelfIssued(apcoa({ receipt: 'attached', receiptFile: 'beleg.pdf' }), open)).toBe(false);
    expect(canWriteSelfIssued(apcoa({ receipt: 'notNeeded' }), open)).toBe(false);
  });

  it('is not for a payment in a closed month, and asks about the payment\'s month', () => {
    const asked: string[] = [];
    const closed = (month: string): boolean => {
      asked.push(month);
      return month === '2026-10';
    };
    expect(canWriteSelfIssued(apcoa(), closed)).toBe(false);
    expect(asked).toEqual(['2026-10']);
    expect(canWriteSelfIssued(apcoa({ date: '2026-09-30' }), closed)).toBe(true);
  });

  it('is also for a payment that has no category yet', () => {
    expect(canWriteSelfIssued(apcoa({ booking: null, confirmed: false }), open)).toBe(true);
  });
});

describe('selfIssuedProblems', () => {
  it('has none for a purpose, a reason and the tick', () => {
    expect(selfIssuedProblems(INPUT, true)).toEqual([]);
  });

  it('wants a purpose that is not blank', () => {
    expect(selfIssuedProblems({ ...INPUT, purpose: '' }, true)).toEqual(['purpose']);
    expect(selfIssuedProblems({ ...INPUT, purpose: '   ' }, true)).toEqual(['purpose']);
  });

  it('wants a text for the reason "something else", and no other reason does', () => {
    const other: SelfIssuedInput = { ...INPUT, reason: 'other', reasonText: null };
    expect(selfIssuedProblems(other, true)).toEqual(['reasonText']);
    expect(selfIssuedProblems({ ...other, reasonText: '  ' }, true)).toEqual(['reasonText']);
    expect(selfIssuedProblems({ ...other, reasonText: 'The ticket blew away' }, true)).toEqual([]);
    expect(selfIssuedProblems({ ...INPUT, reason: 'tip', reasonText: '' }, true)).toEqual([]);
  });

  it('wants the tick, and names the problems in the order of the form', () => {
    expect(selfIssuedProblems(INPUT, false)).toEqual(['confirm']);
    expect(selfIssuedProblems({ purpose: '', reason: 'other', reasonText: '', address: null }, false)).toEqual(['purpose', 'reasonText', 'confirm']);
  });
});

describe('nextSelfIssuedNumber', () => {
  it('numbers EB-2026-001 then 002; another year starts at 001', () => {
    expect(nextSelfIssuedNumber(weber(), '2026')).toBe('EB-2026-001');
    expect(nextSelfIssuedNumber(withReceipts('EB-2026-001'), '2026')).toBe('EB-2026-002');
    expect(nextSelfIssuedNumber(withReceipts('EB-2026-001', 'EB-2026-002'), '2026')).toBe('EB-2026-003');
    expect(nextSelfIssuedNumber(withReceipts('EB-2026-001', 'EB-2026-002'), '2027')).toBe('EB-2027-001');
  });

  it('counts each year on its own', () => {
    const business = withReceipts('EB-2025-007');
    expect(nextSelfIssuedNumber(business, '2025')).toBe('EB-2025-008');
    expect(nextSelfIssuedNumber(business, '2026')).toBe('EB-2026-001');
  });

  it('is one above the highest, so a number given back by an undo is given again and none is left out', () => {
    expect(nextSelfIssuedNumber(withReceipts('EB-2026-001', 'EB-2026-002', 'EB-2026-003'), '2026')).toBe('EB-2026-004');
    expect(nextSelfIssuedNumber(withReceipts('EB-2026-001', 'EB-2026-002'), '2026')).toBe('EB-2026-003');
  });

  it('counts only self-issued receipts: a document that happens to carry such a number is none', () => {
    const business = weber();
    const lookalike = { ...business.documents[0], id: 'doc-lookalike', invoiceNo: 'EB-2026-009', fileName: 'EB-2026-009.pdf' };
    expect(nextSelfIssuedNumber({ ...business, documents: [lookalike, ...business.documents] }, '2026')).toBe('EB-2026-001');
  });
});

describe('selfIssuedDocFor', () => {
  it('carries every field: received from the payee, dated as the payment, its amount, 0 % VAT, linked to nothing yet', () => {
    const doc = selfIssuedDocFor(
      weber(),
      apcoa(),
      { purpose: 'Parking at the client meeting', reason: 'other', reasonText: 'The ticket blew away', address: 'Parkstraße 1, 10115 Berlin' },
      'Sara Weber',
      DEMO_TODAY,
    );
    expect(doc).toEqual({
      id: 'doc-EB-2026-001',
      fileName: 'EB-2026-001.pdf',
      source: 'file',
      addedOn: DEMO_TODAY,
      fromUpload: true,
      reading: false,
      name: 'APCOA Parking',
      direction: 'received',
      invoiceNo: 'EB-2026-001',
      date: '2026-10-20',
      dueDate: null,
      amountCents: 650,
      vatRate: 0,
      duplicateOf: null,
      booking: { ...TRAVEL, vatRate: 0 },
      bookingConfirmed: true,
      paymentId: null,
      history: [{ date: DEMO_TODAY, key: 'selfIssued', params: { number: 'EB-2026-001' } }],
      invoice: null,
      selfIssued: {
        number: 'EB-2026-001',
        reason: 'other',
        reasonText: 'The ticket blew away',
        purpose: 'Parking at the client meeting',
        address: 'Parkstraße 1, 10115 Berlin',
        confirmedBy: 'Sara Weber',
        issuedOn: DEMO_TODAY,
      },
    });
  });

  it('takes the next number of the business, in the year of the day it is written', () => {
    expect(selfIssuedDocFor(withReceipts('EB-2026-001'), apcoa(), INPUT, 'Sara Weber', DEMO_TODAY).selfIssued?.number).toBe('EB-2026-002');
    expect(selfIssuedDocFor(withReceipts('EB-2026-001'), apcoa(), INPUT, 'Sara Weber', '2027-01-05').selfIssued?.number).toBe('EB-2027-001');
  });

  it('writes what the person typed without the spaces around it, and no reason text or address they left out', () => {
    const doc = selfIssuedDocFor(weber(), apcoa(), { purpose: '  Parking  ', reason: 'lost', reasonText: 'left over from "something else"', address: '   ' }, 'Sara Weber', DEMO_TODAY);
    expect(doc.selfIssued).toMatchObject({ purpose: 'Parking', reason: 'lost', reasonText: null, address: null });
  });

  it('keeps the payment\'s amount as a positive number, whatever its size', () => {
    expect(selfIssuedDocFor(weber(), apcoa({ amountCents: -123456 }), INPUT, 'Sara Weber', DEMO_TODAY).amountCents).toBe(123456);
  });

  it('has no booking for a payment that has no category yet, and an unconfirmed one for an unconfirmed booking', () => {
    const unsorted = selfIssuedDocFor(weber(), apcoa({ booking: null, confirmed: false }), INPUT, 'Sara Weber', DEMO_TODAY);
    expect(unsorted).toMatchObject({ booking: null, bookingConfirmed: false, vatRate: 0 });
    const unconfirmed = selfIssuedDocFor(weber(), apcoa({ confirmed: false }), INPUT, 'Sara Weber', DEMO_TODAY);
    expect(unconfirmed).toMatchObject({ booking: { ...TRAVEL, vatRate: 0 }, bookingConfirmed: false });
  });

  it('leaves the payment and the business as they were', () => {
    const business = weber();
    const tx = apcoa();
    const before = structuredClone([business, tx]);
    selfIssuedDocFor(business, tx, INPUT, 'Sara Weber', DEMO_TODAY);
    expect([business, tx]).toEqual(before);
  });
});

describe('hasSelfIssuedReceipt', () => {
  it('is true for a payment a self-issued receipt is linked to', () => {
    const business = weber();
    const doc = { ...selfIssuedDocFor(business, apcoa(), INPUT, 'Sara Weber', DEMO_TODAY), paymentId: 'wd-t20' };
    expect(hasSelfIssuedReceipt({ ...business, documents: [doc, ...business.documents] }, 'wd-t20')).toBe(true);
  });

  it('is false for another payment, for a payment with an ordinary receipt, and for a self-issued receipt that is not linked', () => {
    const business = weber();
    const doc = selfIssuedDocFor(business, apcoa(), INPUT, 'Sara Weber', DEMO_TODAY);
    expect(hasSelfIssuedReceipt({ ...business, documents: [{ ...doc, paymentId: 'wd-t20' }, ...business.documents] }, 'wd-t2')).toBe(false);
    expect(hasSelfIssuedReceipt(business, 'wd-t2')).toBe(false);
    expect(hasSelfIssuedReceipt({ ...business, documents: [doc, ...business.documents] }, 'wd-t20')).toBe(false);
  });
});

describe('selfIssuedPaymentFor', () => {
  /** The business with a self-issued receipt written for APCOA Parking: the payment now has its receipt. */
  function withApcoaReceipt(): Business {
    const business = weber();
    const receipt = { ...selfIssuedDocFor(business, apcoa(), INPUT, 'Sara Weber', DEMO_TODAY), paymentId: 'wd-t20' };
    return {
      ...business,
      documents: [receipt, ...business.documents],
      transactions: business.transactions.map((tx) => (tx.id === 'wd-t20' ? { ...tx, receipt: 'attached' as const, receiptFile: receipt.fileName } : tx)),
    };
  }
  /** A real receipt that turned up later: received, waiting, not linked. */
  const real = (patch: Partial<Doc> = {}): Doc => ({
    ...weber().documents.find((d) => d.id === 'wd-d4')!,
    name: 'APCOA Parking GmbH',
    amountCents: 650,
    ...patch,
  });

  it('finds the payment that already has a self-issued receipt when the amount and the name match', () => {
    const business = withApcoaReceipt();
    expect(selfIssuedPaymentFor(business, real())?.id).toBe('wd-t20');
  });

  it('finds nothing when the amount or the name differ', () => {
    const business = withApcoaReceipt();
    expect(selfIssuedPaymentFor(business, real({ amountCents: 700 }))).toBeNull();
    expect(selfIssuedPaymentFor(business, real({ name: 'Deutsche Bahn' }))).toBeNull();
    expect(selfIssuedPaymentFor(business, real({ name: null }))).toBeNull();
    expect(selfIssuedPaymentFor(business, real({ amountCents: null }))).toBeNull();
  });

  it('finds nothing for a payment that has no self-issued receipt', () => {
    expect(selfIssuedPaymentFor(weber(), real())).toBeNull();
  });

  it('is only for a received document that waits: not a sent one, a linked one, one still read, or a self-issued receipt itself', () => {
    const business = withApcoaReceipt();
    expect(selfIssuedPaymentFor(business, real({ direction: 'sent' }))).toBeNull();
    expect(selfIssuedPaymentFor(business, real({ direction: null }))).toBeNull();
    expect(selfIssuedPaymentFor(business, real({ paymentId: 'wd-t3' }))).toBeNull();
    expect(selfIssuedPaymentFor(business, real({ reading: true }))).toBeNull();
    const own = business.documents.find((d) => d.selfIssued !== null)!;
    expect(selfIssuedPaymentFor(business, own)).toBeNull();
  });
});

describe('purposeSuggestion', () => {
  it('is the payment\'s reference, without extra spaces', () => {
    expect(purposeSuggestion(apcoa())).toBe('Parkhaus Zentrum, Automat');
    expect(purposeSuggestion(apcoa({ reference: '  Parkhaus   Zentrum,\nAutomat ' }))).toBe('Parkhaus Zentrum, Automat');
  });

  it('puts the category label in front when the caller has translated it', () => {
    expect(purposeSuggestion(apcoa(), 'Travel')).toBe('Travel: Parkhaus Zentrum, Automat');
  });

  it('is the label alone when there is no reference, and nothing when there is neither', () => {
    expect(purposeSuggestion(apcoa({ reference: ' ' }), 'Travel')).toBe('Travel');
    expect(purposeSuggestion(apcoa({ reference: '' }))).toBe('');
    expect(purposeSuggestion(apcoa({ reference: '' }), null)).toBe('');
  });
});

describe('the 0 % VAT of a self-issued receipt', () => {
  it('withoutVat books the same category at 0 % and says so in the payment\'s history', () => {
    const tx = apcoa();
    const next = withoutVat(tx);
    expect(next.booking).toEqual({ ...TRAVEL, vatRate: 0 });
    expect(next.history[0]).toEqual({ date: DEMO_TODAY, key: 'vatRemovedSelfIssued', params: {} });
    expect(next.history).toHaveLength(tx.history.length + 1);
    expect(tx.booking?.vatRate).toBe(19);
  });

  it('withoutVat marks a payment that has no category yet too, so the category it gets later has no VAT either', () => {
    const next = withoutVat(apcoa({ booking: null, confirmed: false }));
    expect(next.booking).toBeNull();
    expect(keepsNoVat(next)).toBe(true);
  });

  it('keepsNoVat is told by the line in the history, and nothing else', () => {
    expect(keepsNoVat(apcoa())).toBe(false);
    expect(keepsNoVat(withoutVat(apcoa()))).toBe(true);
  });

  it('bookingKeepingNoVat gives the booking as it is, or at 0 % for a payment that keeps no VAT', () => {
    const ordinary = bookingKeepingNoVat(apcoa(), TRAVEL);
    expect(ordinary).toBe(TRAVEL);
    expect(bookingKeepingNoVat(withoutVat(apcoa()), TRAVEL)).toEqual({ ...TRAVEL, vatRate: 0 });
  });
});
