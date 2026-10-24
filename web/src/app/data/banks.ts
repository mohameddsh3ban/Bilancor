import type { Account, AccountConnection } from './models';
import { isVisitBusiness, newBusinessAccount } from './new-business-sample';
import { BUSINESSES } from './sample-data';

// Everything here is made up for the demo: no real bank connection, no official tax-office list.

/** The banks the picker shows (shown as initials tiles, never logos). `id` is a lower-case slug. */
export const BANKS: { id: string; name: string }[] = [
  { id: 'sparkasse', name: 'Sparkasse' },
  { id: 'volksbank', name: 'Volksbank' },
  { id: 'ing', name: 'ING' },
  { id: 'dkb', name: 'DKB' },
  { id: 'n26', name: 'N26' },
  { id: 'qonto', name: 'Qonto' },
  { id: 'kontist', name: 'Kontist' },
  { id: 'deutsche-bank', name: 'Deutsche Bank' },
  { id: 'commerzbank', name: 'Commerzbank' },
  { id: 'postbank', name: 'Postbank' },
  { id: 'hypovereinsbank', name: 'HypoVereinsbank' },
  { id: 'revolut', name: 'Revolut' },
];

/**
 * The sixteen federal states. `taxNumberPattern` is the format of the tax number as written on letters from the tax
 * office, or null for a state the mockup does not cover (a number there cannot be checked).
 */
export const GERMAN_STATES: { id: string; name: string; taxNumberPattern: RegExp | null }[] = [
  { id: 'baden-wuerttemberg', name: 'Baden-Württemberg', taxNumberPattern: null },
  { id: 'bayern', name: 'Bayern', taxNumberPattern: /^\d{3}\/\d{3}\/\d{5}$/ },
  { id: 'berlin', name: 'Berlin', taxNumberPattern: /^\d{2}\/\d{3}\/\d{5}$/ },
  { id: 'brandenburg', name: 'Brandenburg', taxNumberPattern: null },
  { id: 'bremen', name: 'Bremen', taxNumberPattern: /^\d{2} \d{3} \d{5}$/ },
  { id: 'hamburg', name: 'Hamburg', taxNumberPattern: /^\d{2}\/\d{3}\/\d{5}$/ },
  { id: 'hessen', name: 'Hessen', taxNumberPattern: null },
  { id: 'mecklenburg-vorpommern', name: 'Mecklenburg-Vorpommern', taxNumberPattern: null },
  { id: 'niedersachsen', name: 'Niedersachsen', taxNumberPattern: null },
  {
    id: 'nordrhein-westfalen',
    name: 'Nordrhein-Westfalen',
    taxNumberPattern: /^\d{3}\/\d{4}\/\d{4}$/,
  },
  { id: 'rheinland-pfalz', name: 'Rheinland-Pfalz', taxNumberPattern: null },
  { id: 'saarland', name: 'Saarland', taxNumberPattern: null },
  { id: 'sachsen', name: 'Sachsen', taxNumberPattern: null },
  { id: 'sachsen-anhalt', name: 'Sachsen-Anhalt', taxNumberPattern: null },
  { id: 'schleswig-holstein', name: 'Schleswig-Holstein', taxNumberPattern: null },
  { id: 'thueringen', name: 'Thüringen', taxNumberPattern: null },
];

/**
 * A small sample table that stands in for the tax-office lookup: the first digits of a tax number (separators left
 * out) and the office they name. The pairs are invented, not the official list; only the states with a pattern appear.
 */
export const TAX_OFFICES: { state: string; prefix: string; name: string }[] = [
  { state: 'berlin', prefix: '21', name: 'Berlin Mitte' },
  { state: 'berlin', prefix: '27', name: 'Berlin Friedrichshain-Kreuzberg' },
  { state: 'berlin', prefix: '31', name: 'Berlin Neukölln' },
  { state: 'bayern', prefix: '143', name: 'München' },
  { state: 'bayern', prefix: '216', name: 'Nürnberg-Süd' },
  { state: 'bayern', prefix: '103', name: 'Augsburg-Stadt' },
  { state: 'hamburg', prefix: '41', name: 'Hamburg-Altona' },
  { state: 'hamburg', prefix: '45', name: 'Hamburg-Mitte' },
  { state: 'hamburg', prefix: '48', name: 'Hamburg-Nord' },
  { state: 'nordrhein-westfalen', prefix: '214', name: 'Köln-Mitte' },
  { state: 'nordrhein-westfalen', prefix: '105', name: 'Düsseldorf-Mitte' },
  { state: 'nordrhein-westfalen', prefix: '112', name: 'Essen-Süd' },
  { state: 'bremen', prefix: '60', name: 'Bremen' },
  { state: 'bremen', prefix: '75', name: 'Bremerhaven' },
];

/** The banks each sample business uses (ids from `BANKS`); the first one is where the demo also finds a savings account and a credit card. */
export const SAMPLE_BANKS: Record<string, string[]> = {
  'weber-design': ['qonto'],
  'sara-yoga': ['qonto'],
  'cafe-linde': ['qonto', 'sparkasse'],
};

/** A sample account of a business, looked up so the found accounts stay the very same data the business starts with. */
function sampleAccount(businessId: string, accountId: string): Account {
  const account = BUSINESSES.find((b) => b.id === businessId)?.accounts.find(
    (a) => a.id === accountId,
  );
  if (!account) throw new Error(`No sample account ${accountId} in ${businessId}`);
  return account;
}

/**
 * A savings account or credit card the demo finds at a bank, with no payments. It is not connected yet, so it carries
 * a neutral "statement" connection as a placeholder; the bank flow sets the real connection when it connects it.
 */
function extraAccount(
  id: string,
  product: 'savings' | 'card',
  name: string,
  balanceCents: number,
  iban: string,
): Account {
  const placeholder: AccountConnection = {
    kind: 'statement',
    consentUntil: null,
    lastFetched: null,
    fetchFrom: null,
    broken: false,
  };
  return {
    id,
    kind: 'bank',
    name,
    balanceCents,
    lastUpdate: '2026-10-21',
    connection: placeholder,
    product,
    iban,
  };
}

/**
 * The accounts the demo finds when a business signs in at a bank: business id, then bank id. Each lists the business's
 * own sample account at that bank; the business's first bank also has a savings account and a credit card.
 * IBANs are made up.
 */
export const FOUND_ACCOUNTS: Record<string, Record<string, Account[]>> = {
  'weber-design': {
    qonto: [
      sampleAccount('weber-design', 'wd-qonto'),
      extraAccount('wd-savings', 'savings', 'Qonto Savings', 850000, 'DE07100101010482913668'),
      extraAccount('wd-card', 'card', 'Qonto Credit card', -18940, 'DE82100101010482913676'),
    ],
  },
  'sara-yoga': {
    qonto: [
      sampleAccount('sara-yoga', 'sy-qonto'),
      extraAccount('sy-savings', 'savings', 'Qonto Savings', 320000, 'DE76100101010561742095'),
      extraAccount('sy-card', 'card', 'Qonto Credit card', -9560, 'DE54100101010561742103'),
    ],
  },
  'cafe-linde': {
    qonto: [
      sampleAccount('cafe-linde', 'cl-qonto'),
      extraAccount('cl-savings', 'savings', 'Qonto Savings', 1500000, 'DE22100101010637185302'),
      extraAccount('cl-card', 'card', 'Qonto Credit card', -42780, 'DE97100101010637185310'),
    ],
    sparkasse: [sampleAccount('cafe-linde', 'cl-sparkasse')],
  },
};

/**
 * The banks a business uses (ids from `BANKS`), the first one first. Null for a business made during the visit: any bank
 * is its bank. An id that is neither a sample business nor made during the visit has none.
 */
export function banksOf(businessId: string): string[] | null {
  return isVisitBusiness(businessId) ? null : (SAMPLE_BANKS[businessId] ?? []);
}

/**
 * The accounts the demo finds when a business signs in at a bank: a sample business's own accounts, or for a business
 * made during the visit its one business account, named after whichever bank of `BANKS` it is. None at any other bank.
 */
export function foundAccountsOf(businessId: string, bankId: string): Account[] {
  if (!isVisitBusiness(businessId)) return FOUND_ACCOUNTS[businessId]?.[bankId] ?? [];
  const bank = BANKS.find((candidate) => candidate.id === bankId);
  return bank ? [newBusinessAccount(businessId, bank.name)] : [];
}
