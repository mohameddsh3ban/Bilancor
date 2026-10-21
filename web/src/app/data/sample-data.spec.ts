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
