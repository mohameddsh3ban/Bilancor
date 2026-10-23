import { CATEGORIES } from '../data/categories';
import type { Doc } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { filterDocuments, groupDocsByMonth } from './document-search';

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
  invoice: null,
};
const doc = (patch: Partial<Doc>): Doc => ({ ...base, ...patch });

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!.documents;
const ids = (docs: readonly Doc[]) => docs.map((d) => d.id);

describe('filterDocuments', () => {
  it('finds by name, invoice number and amount typed as 23,80', () => {
    expect(ids(filterDocuments(weber, 'böttcher'))).toEqual(['wd-d4']);
    expect(ids(filterDocuments(weber, 'Q-8812'))).toEqual(['wd-d4']);
    expect(ids(filterDocuments(weber, '23,80'))).toContain('wd-d4');
    expect(ids(filterDocuments(weber, '23.80'))).toContain('wd-d4');
    expect(ids(filterDocuments(weber, '23,8'))).toContain('wd-d4');
    expect(ids(filterDocuments(weber, '23'))).not.toContain('wd-d4');
  });

  it('matches in any case and ignores spaces around the text', () => {
    const docs = [doc({ id: 'a', name: 'Müller GmbH' })];
    expect(ids(filterDocuments(docs, 'MÜLLER gm'))).toEqual(['a']);
    expect(ids(filterDocuments(docs, '  müller  '))).toEqual(['a']);
    expect(ids(filterDocuments(docs, 'telekom'))).toEqual([]);
  });

  it('matches the file name, which is how a document is called until it is read', () => {
    const docs = [doc({ id: 'a', name: null, fileName: 'IMG_2041.jpg' })];
    expect(ids(filterDocuments(docs, 'img_20'))).toEqual(['a']);
  });

  it('ignores the sign of a typed amount', () => {
    const docs = [doc({ id: 'a', amountCents: 12000 })];
    expect(ids(filterDocuments(docs, '-120'))).toEqual(['a']);
    expect(ids(filterDocuments(docs, '120,00'))).toEqual(['a']);
    expect(ids(filterDocuments(docs, '120,01'))).toEqual([]);
  });

  it('a document without an amount only matches text', () => {
    const docs = [doc({ id: 'a', amountCents: null, name: 'Schulz' })];
    expect(ids(filterDocuments(docs, '0'))).toEqual([]);
    expect(ids(filterDocuments(docs, 'schulz'))).toEqual(['a']);
  });

  it('an empty search keeps every document, newest first by date or, without one, the day it was added', () => {
    const docs = [
      doc({ id: 'old', date: '2026-08-01' }),
      doc({ id: 'unread', date: null, addedOn: '2026-10-21' }),
      doc({ id: 'new', date: '2026-10-05', addedOn: '2026-10-05' }),
    ];
    expect(ids(filterDocuments(docs, ''))).toEqual(['unread', 'new', 'old']);
    expect(ids(filterDocuments(docs, '   '))).toEqual(['unread', 'new', 'old']);
  });

  it('keeps the order of documents of the same day', () => {
    const docs = [doc({ id: 'a' }), doc({ id: 'b' }), doc({ id: 'c' })];
    expect(ids(filterDocuments(docs, ''))).toEqual(['a', 'b', 'c']);
  });

  it('does not change the list it is given', () => {
    const docs = [doc({ id: 'old', date: '2026-08-01' }), doc({ id: 'new' })];
    filterDocuments(docs, '');
    expect(ids(docs)).toEqual(['old', 'new']);
  });
});

describe('groupDocsByMonth', () => {
  it('groups by the month of the document date, newest month first', () => {
    const docs = [
      doc({ id: 'sep', date: '2026-09-16' }),
      doc({ id: 'oct1', date: '2026-10-01' }),
      doc({ id: 'aug', date: '2026-08-31' }),
      doc({ id: 'oct2', date: '2026-10-20' }),
    ];
    const groups = groupDocsByMonth(docs);
    expect(groups.map((g) => g.month)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(groups.map((g) => ids(g.docs))).toEqual([['oct2', 'oct1'], ['sep'], ['aug']]);
  });

  it('a document with no date groups by the day it was added', () => {
    const groups = groupDocsByMonth([
      doc({ id: 'unread', date: null, addedOn: '2026-10-21' }),
      doc({ id: 'sep', date: '2026-09-16', addedOn: '2026-10-21' }),
    ]);
    expect(groups.map((g) => g.month)).toEqual(['2026-10', '2026-09']);
    expect(ids(groups[0].docs)).toEqual(['unread']);
  });

  it('is empty for no documents', () => {
    expect(groupDocsByMonth([])).toEqual([]);
  });
});
