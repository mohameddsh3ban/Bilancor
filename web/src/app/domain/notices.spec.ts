import { Notice } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { bankNotices } from './bank-connection';
import { invoiceNotices, noticeTextKey, noticesForSetup, splitNotices, withUnreadableCount } from './notices';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
const terms = weber.notices.find((n) => n.kind === 'terms')!;
const unreadable = weber.notices.find((n) => n.kind === 'unreadable')!;
// The sample data stores no bank notice: it is calculated from the connections.
const [bankExpiry] = bankNotices(weber.accounts);
const [bankEnded] = bankNotices(sara.accounts);
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
  const done = { bank: true, tax: true, receipt: true };
  const vatBusiness = weber.taxProfile;
  const kleinunternehmer = sara.taxProfile;

  it('keeps everything once setup is complete', () => {
    expect(noticesForSetup(three, done, vatBusiness)).toEqual(three);
  });

  it('hides bank notices until the bank step is done', () => {
    const kinds = noticesForSetup(three, { ...done, bank: false }, vatBusiness).map((n) => n.kind);
    expect(kinds).toEqual(['unreadable']);
  });

  it('hides the bank-ended notice until the bank step is done, like the bank-expiry one', () => {
    const both = [bankEnded, bankExpiry];
    expect(noticesForSetup(both, { ...done, bank: false }, vatBusiness)).toEqual([]);
    expect(noticesForSetup(both, { ...done, tax: false, receipt: false }, vatBusiness)).toEqual(both);
  });

  it('hides unreadable notices until the receipt step is done', () => {
    const kinds = noticesForSetup(three, { ...done, receipt: false }, vatBusiness).map((n) => n.kind);
    expect(kinds).toEqual(['terms', 'bankExpiry']);
  });

  it('hides the revenue limit notice until the tax step is done', () => {
    expect(noticesForSetup(sara.notices, { ...done, tax: false }, kleinunternehmer)).toEqual([]);
  });

  it('the revenue-limit notice shows only for a Kleinunternehmer', () => {
    expect(sara.notices.map((n) => n.kind)).toEqual(['revenueLimit']);
    expect(noticesForSetup(sara.notices, done, kleinunternehmer)).toEqual(sara.notices);
    expect(noticesForSetup(sara.notices, done, { ...kleinunternehmer, kleinunternehmer: false })).toEqual([]);
    expect(noticesForSetup(sara.notices, done, vatBusiness)).toEqual([]);
  });

  it('leaves the other notices alone when the business charges VAT', () => {
    const withLimit = [...three, bankEnded, ...sara.notices];
    const kinds = noticesForSetup(withLimit, done, vatBusiness).map((n) => n.kind);
    expect(kinds).toEqual(['terms', 'bankExpiry', 'unreadable', 'bankEnded']);
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

describe('noticeTextKey', () => {
  const expiry = (days: number): Notice => ({ ...bankExpiry, params: { bank: 'Qonto', days } });

  it('says today for a connection that ends today, a day for one that ends tomorrow, days for the rest', () => {
    expect(noticeTextKey(expiry(0))).toBe('notice.bankExpiry.textToday');
    expect(noticeTextKey(expiry(1))).toBe('notice.bankExpiry.textOne');
    expect(noticeTextKey(expiry(2))).toBe('notice.bankExpiry.text');
    expect(noticeTextKey(expiry(14))).toBe('notice.bankExpiry.text');
  });

  it('is the plain text key for every other notice', () => {
    expect(noticeTextKey(terms)).toBe('notice.terms.text');
    expect(noticeTextKey(unreadable)).toBe('notice.unreadable.text');
    expect(noticeTextKey(bankEnded)).toBe('notice.bankEnded.text');
  });
});

describe('invoiceNotices', () => {
  const cafe = BUSINESSES.find((b) => b.id === 'cafe-linde')!;
  const lange = weber.invoices.find((i) => i.id === 'inv-wd-039')!;
  /** Weber Design with RE-2026-039 changed. */
  const withLange = (change: Partial<typeof lange>) => ({
    ...weber,
    invoices: weber.invoices.map((i) => (i.id === lange.id ? { ...i, ...change } : i)),
  });

  it('asks for a reminder for the invoice that is overdue and not reminded yet', () => {
    expect(invoiceNotices(weber)).toEqual([
      {
        id: 'invoice-overdue-inv-wd-039',
        kind: 'invoiceOverdue',
        urgency: 2,
        blocking: false,
        params: { name: 'Bäckerei Lange', number: 'RE-2026-039', days: 22, id: 'inv-wd-039' },
        date: '2026-10-22',
      },
    ]);
  });

  it('has none for an invoice that is not due yet, and counts the days from the day after the due date', () => {
    expect(invoiceNotices(weber, '2026-09-30')).toEqual([]); // due on the 30th: not late yet
    expect(invoiceNotices(weber, '2026-10-01')[0].params['days']).toBe(1);
    expect(invoiceNotices(sara)).toEqual([]); // RE-2026-021 is open, not overdue
  });

  it('has none once the invoice is reminded: the café one was, ten days ago', () => {
    expect(cafe.invoices.some((i) => i.number === 'RE-2026-053' && i.reminders.length === 1)).toBe(true);
    expect(invoiceNotices(cafe)).toEqual([]);
    expect(invoiceNotices(withLange({ reminders: [{ level: 1, sentOn: '2026-10-22' }] }))).toEqual([]);
  });

  it('has none once the invoice is paid, cancelled, or is a draft', () => {
    expect(invoiceNotices(withLange({ paymentIds: ['wd-t7'] }))).toEqual([]); // 2,975.00 euros: more than its 1,190.00
    expect(invoiceNotices(withLange({ cancelledBy: 'inv-wd-099' }))).toEqual([]);
    expect(invoiceNotices(withLange({ sentOn: null, number: null }))).toEqual([]);
  });

  it('asks for one on a partly paid invoice that is past its due date', () => {
    const part = { ...weber.transactions[0], id: 'wd-part', amountCents: 50000 };
    const business = { ...withLange({ paymentIds: ['wd-part'] }), transactions: [part, ...weber.transactions] };
    expect(invoiceNotices(business).map((n) => n.id)).toEqual(['invoice-overdue-inv-wd-039']);
  });

  it('is one notice per late invoice, the one that has been late longest first', () => {
    const other = { ...lange, id: 'inv-x', number: 'RE-2026-099', issueDate: '2026-08-01' };
    expect(invoiceNotices({ ...weber, invoices: [...weber.invoices, other] }).map((n) => n.id)).toEqual([
      'invoice-overdue-inv-x',
      'invoice-overdue-inv-wd-039',
    ]);
  });

  it('waits for the bank step, like every notice that talks about payments', () => {
    const done = { bank: true, tax: true, receipt: true };
    const notices = invoiceNotices(weber);
    expect(noticesForSetup(notices, done, weber.taxProfile)).toEqual(notices);
    expect(noticesForSetup(notices, { ...done, bank: false }, weber.taxProfile)).toEqual([]);
  });

  it('has its own text for one day late', () => {
    expect(noticeTextKey(invoiceNotices(weber, '2026-10-01')[0])).toBe('notice.invoiceOverdue.textOne');
    expect(noticeTextKey(invoiceNotices(weber)[0])).toBe('notice.invoiceOverdue.text');
  });
});
