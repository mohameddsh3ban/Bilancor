import type { Account, Business, SetupState, Transaction } from '../data/models';
import { reviewItems } from './review-queue';

/** Sum of every account balance, in cents. */
export function totalAvailableCents(accounts: readonly Account[]): number {
  return accounts.reduce((sum, account) => sum + account.balanceCents, 0);
}

/** How many things wait for the person's decision: the length of the review queue, the one source of every such count. */
export function decisionCount(business: Business, setup: SetupState): number {
  return reviewItems(business, setup).length;
}

/** About one minute per decision, never less than one. */
export function decisionMinutes(count: number): number {
  return Math.max(1, count);
}

/** The newest payments first, at most `limit` of them. */
export function newestTransactions(transactions: readonly Transaction[], limit = 5): Transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
