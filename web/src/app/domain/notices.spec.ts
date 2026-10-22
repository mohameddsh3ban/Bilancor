import { BUSINESSES } from '../data/sample-data';
import { noticesForSetup, splitNotices, withUnreadableCount } from './notices';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const [terms, bankExpiry, unreadable] = weber.notices;

describe('splitNotices', () => {
  it('shows the two most urgent notices and overflows the rest', () => {
    const { shown, overflow } = splitNotices([unreadable, terms, bankExpiry], new Set());
    expect(shown.map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
    expect(overflow.map((n) => n.id)).toEqual([unreadable.id]);
  });

  it('never drops a blocking notice, even when its id is dismissed', () => {
    const { shown, overflow } = splitNotices(weber.notices, new Set([terms.id]));
    expect(shown.map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
    expect(overflow).toHaveLength(1);
  });

  it('drops dismissed non-blocking notices', () => {
    const { shown, overflow } = splitNotices(weber.notices, new Set([bankExpiry.id]));
    expect(shown.map((n) => n.id)).toEqual([terms.id, unreadable.id]);
    expect(overflow).toEqual([]);
  });

  it('respects a custom max', () => {
    const { shown, overflow } = splitNotices(weber.notices, new Set(), 1);
    expect(shown.map((n) => n.id)).toEqual([terms.id]);
    expect(overflow).toHaveLength(2);
  });
});

describe('noticesForSetup', () => {
  const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
  const done = { bank: true, tax: true, receipt: true };

  it('keeps everything once setup is complete', () => {
    expect(noticesForSetup(weber.notices, done)).toEqual(weber.notices);
  });

  it('hides bank notices until the bank step is done', () => {
    const kinds = noticesForSetup(weber.notices, { ...done, bank: false }).map((n) => n.kind);
    expect(kinds).toEqual(['unreadable']);
  });

  it('hides unreadable notices until the receipt step is done', () => {
    const kinds = noticesForSetup(weber.notices, { ...done, receipt: false }).map((n) => n.kind);
    expect(kinds).toEqual(['terms', 'bankExpiry']);
  });

  it('hides the revenue limit notice until the tax step is done', () => {
    expect(noticesForSetup(sara.notices, { ...done, tax: false })).toEqual([]);
  });
});

describe('withUnreadableCount', () => {
  it('puts the live count on the unreadable notice and leaves the others as they are', () => {
    const result = withUnreadableCount(weber.notices, 4);
    expect(result.map((n) => n.id)).toEqual(weber.notices.map((n) => n.id));
    expect(result[2].params).toEqual({ count: 4 });
    expect(result[0]).toBe(terms);
    expect(result[1]).toBe(bankExpiry);
  });

  it('leaves the unreadable notice out at 0', () => {
    expect(withUnreadableCount(weber.notices, 0).map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
  });

  it('does not change the notices it is given', () => {
    withUnreadableCount(weber.notices, 7);
    expect(weber.notices[2].params).toEqual({ count: 2 });
  });
});
