import { CATEGORIES } from '../data/categories';
import type { Doc } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  docName,
  docNeedsYou,
  docStatus,
  docsNeedingYouCount,
  docsToCheckCount,
  missingField,
  visibleDocuments,
} from './document-status';
import { presetSteps } from './home-cards';

const base: Doc = {
  id: 'd',
  fileName: 'beleg.pdf',
  source: 'file',
  addedOn: '2026-10-20',
  fromUpload: false,
  reading: false,
  name: 'Test GmbH',
  direction: 'received',
  invoiceNo: 'R-1',
  date: '2026-10-20',
  dueDate: null,
  amountCents: 1000,
  vatRate: 19,
  duplicateOf: null,
  booking: CATEGORIES[0],
  bookingConfirmed: false,
  paymentId: null,
  history: [],
};
const doc = (patch: Partial<Doc>): Doc => ({ ...base, ...patch });

function documentsOf(businessId: string): Doc[] {
  return BUSINESSES.find((b) => b.id === businessId)!.documents;
}

describe('docStatus', () => {
  it('is reading while the file is being read, before anything else', () => {
    expect(docStatus(doc({ reading: true }))).toBe('reading');
    expect(docStatus(doc({ reading: true, duplicateOf: 'x', direction: null, amountCents: null }))).toBe('reading');
  });

  it('a duplicate comes before a missing direction', () => {
    expect(docStatus(doc({ duplicateOf: 'doc-wd-t2' }))).toBe('duplicate');
    expect(docStatus(doc({ duplicateOf: 'doc-wd-t2', direction: null }))).toBe('duplicate');
  });

  it('a missing direction comes before a missing field', () => {
    expect(docStatus(doc({ direction: null }))).toBe('direction');
    expect(docStatus(doc({ direction: null, amountCents: null }))).toBe('direction');
  });

  it('asks for the first missing field: amount, then date, then name', () => {
    expect(docStatus(doc({ amountCents: null }))).toBe('checkAmount');
    expect(docStatus(doc({ amountCents: null, date: null }))).toBe('checkAmount');
    expect(docStatus(doc({ date: null }))).toBe('checkDate');
    expect(docStatus(doc({ date: null, name: null }))).toBe('checkDate');
    expect(docStatus(doc({ name: null }))).toBe('checkName');
  });

  it('a missing field comes before done', () => {
    expect(docStatus(doc({ amountCents: null, paymentId: 'wd-t3' }))).toBe('checkAmount');
  });

  it('a linked document is done, even with a due date in the past', () => {
    expect(docStatus(doc({ paymentId: 'wd-t3' }))).toBe('done');
    expect(docStatus(doc({ paymentId: 'wd-t3', dueDate: '2026-09-30' }))).toBe('done');
  });

  it('an unlinked document is overdue after its due date, otherwise waiting', () => {
    expect(docStatus(doc({ dueDate: '2026-09-30' }))).toBe('overdue');
    expect(docStatus(doc({ dueDate: '2026-10-30' }))).toBe('waiting');
    expect(docStatus(doc({ dueDate: null }))).toBe('waiting');
  });

  it('a document due today is still waiting, and "today" can be passed in', () => {
    expect(docStatus(doc({ dueDate: '2026-10-22' }))).toBe('waiting');
    expect(docStatus(doc({ dueDate: '2026-10-21' }))).toBe('overdue');
    expect(docStatus(doc({ dueDate: '2026-10-30' }), '2026-11-01')).toBe('overdue');
  });
});

describe('missingField', () => {
  it('names the first of amount, date and name that is empty', () => {
    expect(missingField(doc({}))).toBeNull();
    expect(missingField(doc({ amountCents: null, date: null, name: null }))).toBe('amount');
    expect(missingField(doc({ date: null, name: null }))).toBe('date');
    expect(missingField(doc({ name: null }))).toBe('name');
  });
});

describe('docNeedsYou', () => {
  it('is true for a duplicate, a missing direction and a field to check', () => {
    expect(docNeedsYou(doc({ duplicateOf: 'x' }))).toBe(true);
    expect(docNeedsYou(doc({ direction: null }))).toBe(true);
    expect(docNeedsYou(doc({ amountCents: null }))).toBe(true);
    expect(docNeedsYou(doc({ date: null }))).toBe(true);
    expect(docNeedsYou(doc({ name: null }))).toBe(true);
  });

  it('is false while reading, waiting, overdue or done', () => {
    expect(docNeedsYou(doc({ reading: true }))).toBe(false);
    expect(docNeedsYou(doc({}))).toBe(false);
    expect(docNeedsYou(doc({ dueDate: '2026-09-30' }))).toBe(false);
    expect(docNeedsYou(doc({ paymentId: 'wd-t3' }))).toBe(false);
  });
});

describe('docsNeedingYouCount', () => {
  it('counts the documents that need a decision', () => {
    expect(docsNeedingYouCount([])).toBe(0);
    expect(docsNeedingYouCount([doc({}), doc({ direction: null }), doc({ amountCents: null }), doc({ reading: true })])).toBe(2);
  });

  it('matches the sample businesses', () => {
    expect(docsNeedingYouCount(documentsOf('weber-design'))).toBe(1);
    expect(docsNeedingYouCount(documentsOf('sara-yoga'))).toBe(0);
    expect(docsNeedingYouCount(documentsOf('cafe-linde'))).toBe(0);
  });
});

describe('docsToCheckCount', () => {
  it('counts the documents with an amount, a date or a name to check, and nothing else', () => {
    expect(docsToCheckCount([])).toBe(0);
    const docs = [
      doc({ amountCents: null }),
      doc({ date: null }),
      doc({ name: null }),
      doc({}),
      doc({ direction: null }),
      doc({ duplicateOf: 'x' }),
      doc({ reading: true, amountCents: null }),
    ];
    expect(docsToCheckCount(docs)).toBe(3);
  });

  it('matches the sample businesses', () => {
    expect(docsToCheckCount(documentsOf('weber-design'))).toBe(1);
    expect(docsToCheckCount(documentsOf('sara-yoga'))).toBe(0);
    expect(docsToCheckCount(documentsOf('cafe-linde'))).toBe(0);
  });
});

describe('visibleDocuments', () => {
  const docs = [doc({ id: 'a', fromUpload: false }), doc({ id: 'b', fromUpload: true })];

  it('shows only the documents added in the demo until a bank is connected', () => {
    expect(visibleDocuments(docs, presetSteps('new')).map((d) => d.id)).toEqual(['b']);
  });

  it('shows every document once a bank is connected', () => {
    expect(visibleDocuments(docs, presetSteps('halfway')).map((d) => d.id)).toEqual(['a', 'b']);
    expect(visibleDocuments(docs, presetSteps('active')).map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('does not change the input array', () => {
    const copy = [...docs];
    visibleDocuments(docs, presetSteps('new'));
    visibleDocuments(docs, presetSteps('halfway'));
    expect(docs).toEqual(copy);
  });
});

describe('docName', () => {
  it('is the name, or the file name while the name is unknown', () => {
    expect(docName(doc({}))).toBe('Test GmbH');
    expect(docName(doc({ name: null }))).toBe('beleg.pdf');
  });
});

describe('sample documents start in the status the demo needs', () => {
  const statusOf = (businessId: string, id: string) => docStatus(documentsOf(businessId).find((d) => d.id === id)!);

  it('weber-design: one to check, two sent invoices (one overdue) and one receipt waiting for its payment', () => {
    expect(['wd-d1', 'wd-d2', 'wd-d3', 'wd-d4'].map((id) => statusOf('weber-design', id))).toEqual([
      'checkAmount',
      'waiting',
      'overdue',
      'waiting',
    ]);
  });

  it('sara-yoga: the flyer invoice waits for its payment', () => {
    expect(statusOf('sara-yoga', 'sy-d1')).toBe('waiting');
  });

  it('a document linked to a payment is done', () => {
    for (const b of BUSINESSES) {
      for (const d of b.documents.filter((x) => x.paymentId !== null)) expect(docStatus(d), d.id).toBe('done');
    }
  });
});
