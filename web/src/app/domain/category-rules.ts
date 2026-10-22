import { PRIVATE_IN, PRIVATE_OUT } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { CategoryRule, Transaction } from '../data/models';
import { paymentStatus } from './payment-status';

export type { CategoryRule } from '../data/models';

// What the review inbox learns: a category chosen for an unclear payment becomes a rule for that counterparty.
// Pure functions; the business keeps its rules (`Business.categoryRules`) and `DemoStateService` applies them.

/** Names that differ only in case, spacing or a trailing full stop or comma are the same counterparty. */
export function counterpartyKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[\p{P}\s]+$/u, '').trim();
}

/**
 * Books every payment that is still unclear and comes from the rule's counterparty, except `exceptId` (the one the
 * person just answered): it gets the rule's booking, confirmed, and one history line. Other payments stay as they are.
 */
export function applyRuleToUnclear(
  txs: readonly Transaction[],
  rule: CategoryRule,
  exceptId: string,
): { txs: Transaction[]; bookedIds: string[] } {
  const bookedIds: string[] = [];
  const next = txs.map((tx) => {
    if (tx.id === exceptId || paymentStatus(tx) !== 'unclear' || counterpartyKey(tx.counterparty) !== rule.counterpartyKey) return tx;
    bookedIds.push(tx.id);
    return {
      ...tx,
      booking: rule.booking,
      confirmed: true,
      history: [{ date: DEMO_TODAY, key: 'bookedByRule' as const, params: { category: rule.booking.labelKey } }, ...tx.history],
    };
  });
  return { txs: next, bookedIds };
}

const isPrivateBooking = (labelKey: string): boolean => labelKey === PRIVATE_OUT.labelKey || labelKey === PRIVATE_IN.labelKey;

/**
 * When a payment gets a different category, the rule for its counterparty (if there is one) takes it over, so a rule
 * never goes stale. A rule is never made here, and these changes leave the rules alone: the booking is cleared, it
 * becomes private, or the payment only moves between private and business (marking private is not a category choice).
 * Returns the same array when nothing changes.
 */
export function followCategoryChange(rules: CategoryRule[], before: Transaction, after: Transaction): CategoryRule[] {
  const booking = after.booking;
  if (!booking || isPrivateBooking(booking.labelKey) || before.isPrivate !== after.isPrivate) return rules;
  if (before.booking?.labelKey === booking.labelKey) return rules;
  const key = counterpartyKey(after.counterparty);
  const rule = rules.find((r) => r.counterpartyKey === key);
  if (!rule || rule.booking.labelKey === booking.labelKey) return rules;
  return rules.map((r) => (r === rule ? { ...r, booking } : r));
}
