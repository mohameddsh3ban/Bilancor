import type { Business } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { presetSteps } from './home-cards';
import { decisionCount } from './home-figures';
import { reviewItems } from './review-queue';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;

/** Weber Design with one of its documents or payments changed, to test the queue on its own terms. */
function weberWith(change: Partial<Business>): Business {
  return { ...business('weber-design'), ...change };
}

describe('reviewItems', () => {
  it('review items are oldest first across payments and documents', () => {
    expect(reviewItems(business('weber-design'), presetSteps('active'))).toEqual([
      { kind: 'payment', id: 'wd-t18', date: '2026-10-02', problem: 'unclear' },
      { kind: 'payment', id: 'wd-t17', date: '2026-10-08', problem: 'noReceipt' },
      { kind: 'payment', id: 'wd-t4', date: '2026-10-15', problem: 'unclear' },
      { kind: 'payment', id: 'wd-t3', date: '2026-10-17', problem: 'noReceipt' },
      // Same date as the document below: the payment comes first.
      { kind: 'payment', id: 'wd-t1', date: '2026-10-20', problem: 'confirm' },
      { kind: 'document', id: 'wd-d1', date: '2026-10-20', problem: 'checkAmount' },
    ]);
  });

  it('sara-yoga has its three payments, oldest first', () => {
    expect(reviewItems(business('sara-yoga'), presetSteps('active')).map((item) => item.id)).toEqual(['sy-t8', 'sy-t7', 'sy-t2']);
  });

  it('cafe-linde has none', () => {
    expect(reviewItems(business('cafe-linde'), presetSteps('active'))).toEqual([]);
  });

  it('new client has no payment items', () => {
    const items = reviewItems(business('weber-design'), presetSteps('new'));
    expect(items.filter((item) => item.kind === 'payment')).toEqual([]);
    // The sample documents were not added in the demo, so none of them shows yet either.
    expect(items).toEqual([]);
  });

  it('a document added in the demo shows even before a bank is connected', () => {
    const wd = business('weber-design');
    const added = wd.documents.map((d) => (d.id === 'wd-d1' ? { ...d, fromUpload: true } : d));
    expect(reviewItems(weberWith({ documents: added }), presetSteps('new'))).toEqual([
      { kind: 'document', id: 'wd-d1', date: '2026-10-20', problem: 'checkAmount' },
    ]);
  });

  it('halfway counts payments and documents, since a bank is connected', () => {
    expect(reviewItems(business('weber-design'), presetSteps('halfway'))).toHaveLength(6);
  });

  it('a document with no date is dated by the day it was added', () => {
    const wd = business('weber-design');
    const undated = wd.documents.map((d) => (d.id === 'wd-d1' ? { ...d, date: null, addedOn: '2026-10-01' } : d));
    const items = reviewItems(weberWith({ documents: undated }), presetSteps('active'));
    expect(items[0]).toEqual({ kind: 'document', id: 'wd-d1', date: '2026-10-01', problem: 'checkAmount' });
    expect(items).toHaveLength(6);
  });

  it('reports the problem of a document that needs the person, and leaves out the ones that do not', () => {
    const wd = business('weber-design');
    const docs = wd.documents.map((d) => {
      if (d.id === 'wd-d2') return { ...d, duplicateOf: 'wd-d3' };
      if (d.id === 'wd-d3') return { ...d, direction: null };
      if (d.id === 'wd-d4') return { ...d, date: null };
      return d;
    });
    const found = reviewItems(weberWith({ documents: docs }), presetSteps('active')).filter((item) => item.kind === 'document');
    expect(found.map((item) => [item.id, item.problem])).toEqual([
      ['wd-d3', 'direction'],
      ['wd-d4', 'checkDate'],
      ['wd-d2', 'duplicate'],
      ['wd-d1', 'checkAmount'],
    ]);
  });

  it('items with the same date and kind are ordered by id', () => {
    const wd = business('weber-design');
    const needsYou = wd.transactions.find((t) => t.id === 'wd-t1')!;
    const tied = [
      { ...needsYou, id: 'x-b', date: '2026-10-01' },
      { ...needsYou, id: 'x-a', date: '2026-10-01' },
    ];
    expect(reviewItems(weberWith({ transactions: tied, documents: [] }), presetSteps('active')).map((item) => item.id)).toEqual([
      'x-a',
      'x-b',
    ]);
  });

  it('does not change the business it reads', () => {
    const wd = business('weber-design');
    const order = wd.transactions.map((t) => t.id);
    reviewItems(wd, presetSteps('active'));
    expect(wd.transactions.map((t) => t.id)).toEqual(order);
  });
});

describe('the shared needs-you count', () => {
  it('decisionCount is 6 for weber-design, 3 for sara-yoga and 0 for cafe-linde', () => {
    expect(decisionCount(business('weber-design'), presetSteps('active'))).toBe(6);
    expect(decisionCount(business('sara-yoga'), presetSteps('active'))).toBe(3);
    expect(decisionCount(business('cafe-linde'), presetSteps('active'))).toBe(0);
  });

  it('is always the length of the review queue', () => {
    for (const b of BUSINESSES) {
      for (const setup of ['new', 'halfway', 'active'] as const) {
        expect(decisionCount(b, presetSteps(setup)), `${b.id} ${setup}`).toBe(reviewItems(b, presetSteps(setup)).length);
      }
    }
  });
});
