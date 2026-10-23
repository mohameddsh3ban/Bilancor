import { BANKS } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, AccountConnection, Notice } from '../data/models';

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

/** How long a bank's consent lasts after the person signs in, as the bank asks them to renew it. */
export const CONSENT_DAYS = 180;

/** The whole days from one ISO date to another; negative when `to` is earlier. Dates are read as UTC, so no clock or zone matters. */
export function daysBetween(from: string, to: string): number {
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
          params: { bank: bankNameOf(account) ?? account.name, days: status.daysLeft },
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
          params: { bank: bankNameOf(account) ?? account.name },
          date: today,
        },
      ];
    }
    return [];
  });
}

/**
 * The bank an account is at: the name of a business account is its bank ("Qonto"), and a savings account or credit
 * card keeps it at the front of its stored English name ("Qonto Savings"). Null for the cash box, which has no bank.
 * A name that no bank of the picker starts is its own bank.
 */
export function bankNameOf(account: Account): string | null {
  if (account.kind === 'cash') return null;
  const names = BANKS.map((bank) => bank.name).filter(
    (name) => account.name === name || account.name.startsWith(`${name} `),
  );
  return names.sort((one, other) => other.length - one.length)[0] ?? account.name;
}

/**
 * What an account is called on screen, whatever the language: a business account is its stored name (the bank,
 * "Qonto"), a savings account or credit card is "bank · product" with `productLabel` (the product's name in the
 * language of the page) instead of the stored English name, and the cash box is just its `productLabel`.
 */
export function accountName(account: Account, productLabel: string): string {
  if (account.kind === 'cash') return productLabel;
  if (account.product === 'business') return account.name;
  return `${bankNameOf(account) ?? account.name} · ${productLabel}`;
}

/** An IBAN with only its first 4 and last 4 characters shown, e.g. `DE89 … 4321`. Spaces in the IBAN are ignored. */
export function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, '');
  return `${compact.slice(0, 4)} … ${compact.slice(-4)}`;
}

/** An ISO date `days` after another (before it when negative), counted in UTC so no clock or zone matters. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The connection an account gets when the person signs in at its bank on `today` (an ISO date; never the real clock):
 * a consent of `CONSENT_DAYS` days, fetched at noon that day, with payments asked for from `fetchFrom`. A new object each time.
 */
export function newConnection(fetchFrom: string, today: string = DEMO_TODAY): AccountConnection {
  return {
    kind: 'connected',
    consentUntil: addDays(today, CONSENT_DAYS),
    lastFetched: `${today}T12:00`,
    fetchFrom,
    broken: false,
  };
}

/**
 * Whether a bank connection has just been signed in: it works, and its consent already runs the full `CONSENT_DAYS`
 * days from `today` (an ISO date; never the real clock) or longer. Renewing it again would change nothing.
 */
export function isRenewed(connection: AccountConnection, today: string = DEMO_TODAY): boolean {
  return (
    connection.kind === 'connected' &&
    !connection.broken &&
    connection.consentUntil !== null &&
    connection.consentUntil >= addDays(today, CONSENT_DAYS)
  );
}

/** The connection of an account that has no bank to look after: payments from imported statements, or the cash box. */
export function noConnection(kind: 'statement' | 'cash'): AccountConnection {
  return { kind, consentUntil: null, lastFetched: null, fetchFrom: null, broken: false };
}

/**
 * Whether connecting this account again would add nothing: it is there and has a bank connection, and the bank step is
 * done. While the step is not done (the demo's New client shortcut keeps the accounts), a sample account counts as not
 * connected yet, so the person can connect or leave it. A connection that ended or broke counts as connected: Renew
 * and Sign in again look after it, not connecting a second time.
 */
export function isAlreadyConnected(account: Account | undefined, bankStepDone: boolean): boolean {
  return bankStepDone && account?.connection.kind === 'connected';
}

/**
 * Two letters for a bank's tile: the first letters of its first two words, or of the two parts of a joined name
 * (HypoVereinsbank gives HV), else its first two letters. In capitals.
 */
export function bankInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .flatMap((word) => word.split(/(?<=[a-z])(?=[A-Z])/))
    .filter((part) => part !== '');
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}
