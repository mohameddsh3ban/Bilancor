import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Notice } from '../data/models';

/**
 * How healthy an account's connection is: a bank connection that is fine, one whose consent ends soon (with the days
 * left), one that needs a new sign-in, or an account that has no bank connection to look after (statement or cash box).
 */
export type ConnectionStatus =
  | { kind: 'connected' }
  | { kind: 'renewSoon'; daysLeft: number }
  | { kind: 'signInAgain' }
  | { kind: 'statement' }
  | { kind: 'cash' };

/** A consent that ends within this many days (the last day included) is shown as "renew soon". */
const RENEW_WITHIN_DAYS = 14;

const MS_PER_DAY = 86_400_000;

/** The whole days from one ISO date to another; negative when `to` is earlier. Dates are read as UTC, so no clock or zone matters. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

/**
 * The status of an account's connection on `today` (an ISO date; never the real clock).
 *
 * A bank connection needs a new sign-in once its consent has ended (before today) or the bank reports it broken, and
 * shows "renew soon" from 14 days before the consent ends until the day it ends (today included). A connection
 * with no consent date has nothing that ends, so it stays connected.
 */
export function connectionStatus(account: Account, today: string = DEMO_TODAY): ConnectionStatus {
  const { connection } = account;
  if (connection.kind !== 'connected') return { kind: connection.kind };
  if (connection.broken) return { kind: 'signInAgain' };
  if (connection.consentUntil === null) return { kind: 'connected' };
  const daysLeft = daysBetween(today, connection.consentUntil);
  if (daysLeft < 0) return { kind: 'signInAgain' };
  return daysLeft <= RENEW_WITHIN_DAYS ? { kind: 'renewSoon', daysLeft } : { kind: 'connected' };
}

/**
 * The notices the connections ask for: "expires in N days" for each account that is renew-soon, and "has ended, sign in
 * again" for each one that needs a new sign-in. They are calculated, never stored, so they disappear as soon as the
 * connection is renewed. Dated `today`; whether the business has done its bank step is for `noticesForSetup` to decide.
 */
export function bankNotices(accounts: readonly Account[], today: string = DEMO_TODAY): Notice[] {
  return accounts.flatMap((account): Notice[] => {
    const status = connectionStatus(account, today);
    if (status.kind === 'renewSoon') {
      return [
        {
          id: `bank-expiry-${account.id}`,
          kind: 'bankExpiry',
          urgency: 2,
          blocking: false,
          params: { bank: account.name, days: status.daysLeft },
          date: today,
        },
      ];
    }
    if (status.kind === 'signInAgain') {
      return [
        {
          id: `bank-ended-${account.id}`,
          kind: 'bankEnded',
          urgency: 1,
          blocking: false,
          params: { bank: account.name },
          date: today,
        },
      ];
    }
    return [];
  });
}

/** An IBAN with only its first 4 and last 4 characters shown, e.g. `DE89 … 4321`. Spaces in the IBAN are ignored. */
export function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, '');
  return `${compact.slice(0, 4)} … ${compact.slice(-4)}`;
}
