import type { Account, Transaction } from '../data/models';
import { decisionMinutes, newestTransactions, totalAvailableCents } from './home-figures';

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
});
