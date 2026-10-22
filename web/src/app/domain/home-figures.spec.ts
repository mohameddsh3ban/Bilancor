import type { Account, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { decisionCount, decisionMinutes, newestTransactions, totalAvailableCents } from './home-figures';

const account = (balanceCents: number): Account => ({
  id: String(balanceCents),
  kind: 'bank',
  name: 'Bank',
  balanceCents,
  lastUpdate: '2026-10-21',
});

const tx = (id: string, date: string): Transaction => ({
  id,
  date,
  counterparty: id,
  accountId: 'a',
  amountCents: 100,
  booking: null,
  confirmed: true,
  isPrivate: false,
  receipt: 'notNeeded',
  receiptFile: null,
  counterpartyIban: 'DE02100100100123456789',
  reference: id,
  history: [],
  beforePrivate: null,
  beforeLink: null,
});

describe('home figures', () => {
  it('totals the account balances', () => {
    expect(totalAvailableCents([account(1000), account(250), account(-50)])).toBe(1200);
    expect(totalAvailableCents([])).toBe(0);
  });

  it('estimates a minute per decision, at least one', () => {
    expect(decisionMinutes(0)).toBe(1);
    expect(decisionMinutes(1)).toBe(1);
    expect(decisionMinutes(4)).toBe(4);
  });

  it('picks the newest transactions first without changing the input', () => {
    const input = [tx('a', '2026-10-01'), tx('b', '2026-10-05'), tx('c', '2026-10-03')];
    expect(newestTransactions(input, 2).map((t) => t.id)).toEqual(['b', 'c']);
    expect(input.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  describe('decisionCount', () => {
    const business = (id: string) => BUSINESSES.find((b) => b.id === id)!;

    it('adds the documents that need the person to the payments that need them', () => {
      expect(decisionCount(business('weber-design'), 'active')).toBe(5);
      expect(decisionCount(business('sara-yoga'), 'active')).toBe(3);
      expect(decisionCount(business('cafe-linde'), 'active')).toBe(0);
    });

    it('leaves out the documents that are not shown yet', () => {
      // Before a bank is connected only documents added in the demo show, and the sample ones were not added in it.
      expect(decisionCount(business('weber-design'), 'new')).toBe(4);
    });
  });
});
