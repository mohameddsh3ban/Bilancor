import type { Notice } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { noticesForSetup, splitNotices, withUnreadableCount } from './notices';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const [terms, unreadable] = weber.notices;
// The sample data no longer stores a bank notice (it is calculated from the connections), so these tests bring their own.
const bankExpiry: Notice = { id: 'wd-n2', kind: 'bankExpiry', urgency: 2, blocking: false, params: { bank: 'Qonto', days: 5 }, date: '2026-10-19' };
const three = [terms, bankExpiry, unreadable];

describe('splitNotices', () => {
  it('shows the two most urgent notices and overflows the rest', () => {
    const { shown, overflow } = splitNotices([unreadable, terms, bankExpiry], new Set());
    expect(shown.map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
    expect(overflow.map((n) => n.id)).toEqual([unreadable.id]);
  });

  it('never drops a blocking notice, even when its id is dismissed', () => {
    const { shown, overflow } = splitNotices(three, new Set([terms.id]));
    expect(shown.map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
    expect(overflow).toHaveLength(1);
  });

  it('drops dismissed non-blocking notices', () => {
    const { shown, overflow } = splitNotices(three, new Set([bankExpiry.id]));
    expect(shown.map((n) => n.id)).toEqual([terms.id, unreadable.id]);
    expect(overflow).toEqual([]);
  });

  it('respects a custom max', () => {
    const { shown, overflow } = splitNotices(three, new Set(), 1);
    expect(shown.map((n) => n.id)).toEqual([terms.id]);
    expect(overflow).toHaveLength(2);
  });
});

describe('noticesForSetup', () => {
  const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
  const done = { bank: true, tax: true, receipt: true };

  it('keeps everything once setup is complete', () => {
    expect(noticesForSetup(three, done)).toEqual(three);
  });

  it('hides bank notices until the bank step is done', () => {
    const kinds = noticesForSetup(three, { ...done, bank: false }).map((n) => n.kind);
    expect(kinds).toEqual(['unreadable']);
  });

  it('hides unreadable notices until the receipt step is done', () => {
    const kinds = noticesForSetup(three, { ...done, receipt: false }).map((n) => n.kind);
    expect(kinds).toEqual(['terms', 'bankExpiry']);
  });

  it('hides the revenue limit notice until the tax step is done', () => {
    expect(noticesForSetup(sara.notices, { ...done, tax: false })).toEqual([]);
  });
});

describe('withUnreadableCount', () => {
  it('puts the live count on the unreadable notice and leaves the others as they are', () => {
    const result = withUnreadableCount(three, 4);
    expect(result.map((n) => n.id)).toEqual(three.map((n) => n.id));
    expect(result[2].params).toEqual({ count: 4 });
    expect(result[0]).toBe(terms);
    expect(result[1]).toBe(bankExpiry);
  });

  it('leaves the unreadable notice out at 0', () => {
    expect(withUnreadableCount(three, 0).map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
  });

  it('does not change the notices it is given', () => {
    withUnreadableCount(three, 7);
    expect(three[2].params).toEqual({ count: 2 });
  });
});
