import { OFFICE, PRIVATE_OUT, SOFTWARE } from '../data/categories';
import type { Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { applyRuleToUnclear, counterpartyKey, followCategoryChange, type CategoryRule } from './category-rules';
import { changeCategory } from './payment-actions';
import { paymentStatus } from './payment-status';
import { withoutVat } from './self-issued';

const weberPayments = (): Transaction[] => structuredClone(BUSINESSES.find((b) => b.id === 'weber-design')!.transactions);
const payment = (txs: readonly Transaction[], id: string): Transaction => txs.find((t) => t.id === id)!;

const AMAZON_OFFICE: CategoryRule = { counterpartyKey: 'amazon', booking: OFFICE };

describe('counterpartyKey', () => {
  it('normalises case, spaces and trailing punctuation', () => {
    expect(counterpartyKey(' AMAZON  ')).toBe('amazon');
    expect(counterpartyKey('Amazon.')).toBe('amazon');
    expect(counterpartyKey('Amazon EU,  S.à r.l.')).toBe('amazon eu, s.à r.l');
    expect(counterpartyKey('Amazon ...  ')).toBe('amazon');
  });
});

describe('applyRuleToUnclear', () => {
  it("a rule books other unclear payments of the same counterparty, but not the one that was just answered", () => {
    const txs = weberPayments();
    expect(paymentStatus(payment(txs, 'wd-t4'))).toBe('unclear');
    expect(paymentStatus(payment(txs, 'wd-t18'))).toBe('unclear');

    const result = applyRuleToUnclear(txs, AMAZON_OFFICE, 'wd-t4');

    expect(result.bookedIds).toEqual(['wd-t18']);
    const booked = payment(result.txs, 'wd-t18');
    expect(booked.booking).toBe(OFFICE);
    expect(booked.confirmed).toBe(true);
    expect(paymentStatus(booked)).toBe('booked');
    expect(booked.history[0]).toEqual({ date: '2026-10-22', key: 'bookedByRule', params: { category: 'office' } });
    expect(booked.history).toHaveLength(payment(txs, 'wd-t18').history.length + 1);
    expect(payment(result.txs, 'wd-t4')).toBe(payment(txs, 'wd-t4'));
    expect(result.txs).toHaveLength(txs.length);
  });

  it('matches the counterparty by its key, whatever the case or spacing', () => {
    const txs = weberPayments().map((t) => (t.id === 'wd-t18' ? { ...t, counterparty: ' AMAZON. ' } : t));
    expect(applyRuleToUnclear(txs, AMAZON_OFFICE, 'wd-t4').bookedIds).toEqual(['wd-t18']);
  });

  it("a rule doesn't touch booked or confirm payments", () => {
    const base = payment(weberPayments(), 'wd-t18');
    const booked: Transaction = { ...base, id: 'x-booked', booking: SOFTWARE, confirmed: true };
    const toConfirm: Transaction = { ...base, id: 'x-confirm', booking: SOFTWARE, confirmed: false };
    const txs = [booked, toConfirm];

    const result = applyRuleToUnclear(txs, AMAZON_OFFICE, 'none');

    expect(result.bookedIds).toEqual([]);
    expect(result.txs[0]).toBe(booked);
    expect(result.txs[1]).toBe(toConfirm);
  });

  it("a rule doesn't touch unclear payments of other counterparties", () => {
    const other: Transaction = { ...payment(weberPayments(), 'wd-t18'), id: 'x-other', counterparty: 'Amazon Web Services' };
    const result = applyRuleToUnclear([other], AMAZON_OFFICE, 'none');
    expect(result.bookedIds).toEqual([]);
    expect(result.txs[0]).toBe(other);
  });

  it('does not change the payments it was given', () => {
    const txs = weberPayments();
    const copy = structuredClone(txs);
    applyRuleToUnclear(txs, AMAZON_OFFICE, 'wd-t4');
    expect(txs).toEqual(copy);
  });

  it('books an unclear payment a self-issued receipt took the VAT from at 0 %, not at the rule\'s VAT', () => {
    const unclear = withoutVat(payment(weberPayments(), 'wd-t18'));
    expect(paymentStatus(unclear)).toBe('unclear');

    const result = applyRuleToUnclear([unclear], AMAZON_OFFICE, 'none');

    expect(result.bookedIds).toEqual(['wd-t18']);
    expect(result.txs[0].booking).toEqual({ ...OFFICE, vatRate: 0 });
    expect(AMAZON_OFFICE.booking.vatRate).toBe(19);
  });
});

describe('followCategoryChange', () => {
  const before = payment(weberPayments(), 'wd-t4');
  const rules: CategoryRule[] = [AMAZON_OFFICE];

  it("changing a payment's category updates its counterparty's rule", () => {
    const next = followCategoryChange(rules, changeCategory(before, OFFICE), changeCategory(before, SOFTWARE));
    expect(next).toEqual([{ counterpartyKey: 'amazon', booking: SOFTWARE }]);
    expect(rules).toEqual([AMAZON_OFFICE]);
  });

  it('leaves the rules as they are when there is no rule for the counterparty, so it never makes one', () => {
    const other: Transaction = { ...before, counterparty: 'Telekom' };
    expect(followCategoryChange(rules, other, changeCategory(other, SOFTWARE))).toBe(rules);
  });

  it('leaves the rules as they are when the category stays the same', () => {
    const booked = changeCategory(before, OFFICE);
    expect(followCategoryChange(rules, booked, { ...booked, confirmed: false })).toBe(rules);
  });

  it('a payment that had no category and gets one also updates the rule', () => {
    const next = followCategoryChange([{ counterpartyKey: 'amazon', booking: SOFTWARE }], before, changeCategory(before, OFFICE));
    expect(next).toEqual([AMAZON_OFFICE]);
  });

  it('a rule keeps the category\'s usual VAT when the payment that changed it has none (a self-issued receipt took it)', () => {
    const noVat = withoutVat(changeCategory(before, SOFTWARE));
    const next = followCategoryChange([{ counterpartyKey: 'amazon', booking: SOFTWARE }], noVat, changeCategory(noVat, OFFICE));
    expect(next).toEqual([{ counterpartyKey: 'amazon', booking: OFFICE }]);
    expect(next[0].booking.vatRate).toBe(19);
  });

  it('leaves the rules as they are when the booking is cleared', () => {
    const booked = changeCategory(before, SOFTWARE);
    expect(followCategoryChange(rules, booked, { ...booked, booking: null })).toBe(rules);
  });

  it("marking private doesn't change a rule, and neither does marking it back", () => {
    const booked = changeCategory(before, OFFICE);
    const priv: Transaction = { ...booked, booking: PRIVATE_OUT, isPrivate: true };
    expect(followCategoryChange(rules, booked, priv)).toBe(rules);
    // Back to the business with the booking it had before: not a category choice.
    expect(followCategoryChange(rules, priv, { ...booked, booking: SOFTWARE, isPrivate: false })).toBe(rules);
  });
});
