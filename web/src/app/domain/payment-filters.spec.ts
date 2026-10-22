import { Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { EMPTY_FILTER, PaymentFilter, filterPayments, groupByMonth, isFilterActive, matchesSearch, monthsOf } from './payment-filters';
import { paymentStatus } from './payment-status';

function sample(id: string): Transaction {
  for (const business of BUSINESSES) {
    const found = business.transactions.find((t) => t.id === id);
    if (found) return found;
  }
  throw new Error(`no sample payment ${id}`);
}

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!.transactions;
const bahn = sample('wd-t3'); // Deutsche Bahn, -12000
const mueller = sample('wd-t1'); // Müller GmbH, +150000, RE-2026-041

function filter(patch: Partial<PaymentFilter>): PaymentFilter {
  return { ...EMPTY_FILTER, ...patch };
}

describe('payment filters', () => {
  it('search matches amounts typed with comma, dot or minus', () => {
    for (const q of ['120', '120,00', '120.00', '-120', '120,0', ' 120 € ']) {
      expect(matchesSearch(bahn, q), q).toBe(true);
    }
    for (const q of ['1.500,00', '1500', '1,500.00', '+1.500,00 €', '1 500']) {
      expect(matchesSearch(mueller, q), q).toBe(true);
    }
    expect(matchesSearch(mueller, '-1500')).toBe(false);
    expect(matchesSearch(mueller, '1.500,01')).toBe(false);
    expect(matchesSearch(bahn, '120,5')).toBe(false);
    expect(matchesSearch(sample('wd-t5'), '59,49')).toBe(true);
    expect(matchesSearch(sample('wd-t5'), '59.4')).toBe(false);
    expect(matchesSearch(sample('wd-t5'), '5949')).toBe(false);
  });

  it('search matches name and reference case-insensitively', () => {
    expect(matchesSearch(mueller, 'müller')).toBe(true);
    expect(matchesSearch(mueller, 'MÜLLER GM')).toBe(true);
    expect(matchesSearch(mueller, 'RE-2026')).toBe(true);
    expect(matchesSearch(mueller, 're-2026-041')).toBe(true);
    expect(matchesSearch(mueller, 'telekom')).toBe(false);
    expect(matchesSearch(mueller, '')).toBe(true);
    expect(matchesSearch(mueller, '   ')).toBe(true);
  });

  it('a numeric search can also match text', () => {
    expect(matchesSearch(bahn, '8841')).toBe(true); // part of the reference
  });

  it('needsYou keeps only non-booked, newest first', () => {
    const result = filterPayments(weber, filter({ quick: 'needsYou' }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => paymentStatus(t) !== 'booked')).toBe(true);
    expect(result.map((t) => t.id)).toEqual(['wd-t1', 'wd-t3', 'wd-t4', 'wd-t17', 'wd-t18']);
  });

  it('in/out split by sign', () => {
    const ins = filterPayments(weber, filter({ quick: 'in' }));
    const outs = filterPayments(weber, filter({ quick: 'out' }));
    expect(ins.every((t) => t.amountCents > 0)).toBe(true);
    expect(outs.every((t) => t.amountCents < 0)).toBe(true);
    expect(ins.length + outs.length).toBe(weber.length);
  });

  it('all returns every payment sorted by date, newest first', () => {
    const result = filterPayments(weber, EMPTY_FILTER);
    expect(result).toHaveLength(weber.length);
    const dates = result.map((t) => t.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('account and month combine', () => {
    const cash = filterPayments(weber, filter({ accountId: 'wd-cash' }));
    expect(cash.map((t) => t.id)).toEqual(['wd-t15']);
    expect(filterPayments(weber, filter({ accountId: 'wd-cash', month: '2026-10' }))).toEqual([]);
    const aug = filterPayments(weber, filter({ accountId: 'wd-cash', month: '2026-08' }));
    expect(aug.map((t) => t.id)).toEqual(['wd-t15']);
    const sept = filterPayments(weber, filter({ month: '2026-09', quick: 'in', search: 'müller' }));
    expect(sept.map((t) => t.id)).toEqual(['wd-t9']);
  });

  it('does not change the input array', () => {
    const copy = [...weber];
    filterPayments(weber, filter({ quick: 'out' }));
    expect(weber).toEqual(copy);
  });

  it('groupByMonth totals', () => {
    const groups = groupByMonth(weber);
    expect(groups.map((g) => g.month)).toEqual(['2026-10', '2026-09', '2026-08']);
    const october = groups[0];
    expect(october.payments).toHaveLength(10);
    expect(october.inCents).toBe(150000 + 297500);
    expect(october.outCents).toBe(-(3995 + 12000 + 4900 + 5949 + 5508 + 35700 + 2380 + 2390));
    expect(october.payments.map((t) => t.date)).toEqual([...october.payments.map((t) => t.date)].sort().reverse());
    const total = groups.reduce((s, g) => s + g.inCents + g.outCents, 0);
    expect(total).toBe(weber.reduce((s, t) => s + t.amountCents, 0));
  });

  it('monthsOf lists months newest first', () => {
    expect(monthsOf(weber)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(monthsOf([])).toEqual([]);
  });

  it('isFilterActive is false only when nothing is set', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, search: '   ' })).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, quick: 'in' })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, accountId: 'wd-cash' })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, month: '2026-10' })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, search: 'bahn' })).toBe(true);
  });
});
