import { paymentStatus } from '../domain/payment-status';
import { revenueLimitStatus } from '../domain/revenue-limit';
import { CATEGORIES, PRIVATE_IN, PRIVATE_OUT } from './categories';
import { BUSINESSES, PERSON } from './sample-data';

describe('sample data', () => {
  it('three businesses, all belonging to PERSON', () => {
    expect(BUSINESSES.length).toBe(3);
    for (const b of BUSINESSES) {
      expect(PERSON.businessIds).toContain(b.id);
    }
  });

  it('exactly one Kleinunternehmer, with no VAT due', () => {
    const ku = BUSINESSES.filter((b) => b.taxProfile.kleinunternehmer);
    expect(ku.length).toBe(1);
    expect(ku[0].vatDue).toBeNull();
  });

  it('every transaction points to an account of its business', () => {
    for (const b of BUSINESSES) {
      const ids = b.accounts.map((a) => a.id);
      for (const t of b.transactions) {
        expect(ids).toContain(t.accountId);
      }
    }
  });

  it('amounts are integer cents', () => {
    for (const b of BUSINESSES) {
      for (const a of b.accounts) expect(Number.isInteger(a.balanceCents)).toBe(true);
      for (const t of b.transactions) expect(Number.isInteger(t.amountCents)).toBe(true);
    }
  });
});

describe('sample payments', () => {
  const statusesOf = (id: string) => new Set(BUSINESSES.find((b) => b.id === id)!.transactions.map(paymentStatus));

  it('every business has payments in August, September and October 2026', () => {
    for (const b of BUSINESSES) {
      for (const month of ['2026-08', '2026-09', '2026-10']) {
        expect(b.transactions.some((t) => t.date.startsWith(month))).toBe(true);
      }
    }
  });

  it('weber-design and sara-yoga show all four statuses, cafe-linde only booked', () => {
    const all = ['booked', 'confirm', 'noReceipt', 'unclear'];
    expect([...statusesOf('weber-design')].sort()).toEqual([...all].sort());
    expect([...statusesOf('sara-yoga')].sort()).toEqual([...all].sort());
    expect([...statusesOf('cafe-linde')]).toEqual(['booked']);
  });

  it('weber-design keeps the statuses of its six October payments', () => {
    const wd = BUSINESSES.find((b) => b.id === 'weber-design')!;
    const status = (id: string) => paymentStatus(wd.transactions.find((t) => t.id === id)!);
    expect(['wd-t1', 'wd-t2', 'wd-t3', 'wd-t4', 'wd-t5', 'wd-t6'].map(status)).toEqual([
      'confirm',
      'booked',
      'noReceipt',
      'unclear',
      'booked',
      'booked',
    ]);
  });

  it('payments to confirm or clarify always have a receipt attached', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        if (['confirm', 'unclear'].includes(paymentStatus(t))) expect(t.receipt).toBe('attached');
      }
    }
  });

  it('a receipt file exists exactly when the receipt is attached', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) expect(t.receiptFile !== null).toBe(t.receipt === 'attached');
    }
  });

  it('every payment has an IBAN, a reference and at least one history entry', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        expect(t.counterpartyIban).toMatch(/^DE\d{20}$/);
        expect(t.reference.length).toBeGreaterThan(0);
        expect(t.history.length).toBeGreaterThan(0);
      }
    }
  });

  it('payment ids are unique across the sample data', () => {
    const ids = BUSINESSES.flatMap((b) => b.transactions.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every booking is a known category or a private booking', () => {
    const known = [...CATEGORIES, PRIVATE_OUT, PRIVATE_IN];
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        if (t.booking) expect(known).toContainEqual(t.booking);
      }
    }
  });
});

describe('sample data revenue notice', () => {
  it('shows the same whole percent as the revenue tracker', () => {
    const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
    const notice = sara.notices.find((n) => n.kind === 'revenueLimit')!;
    expect(notice.params['percent']).toBe(revenueLimitStatus(sara.revenueThisYearCents).percent);
  });
});
