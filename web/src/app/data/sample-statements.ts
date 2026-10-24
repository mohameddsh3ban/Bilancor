import { bankNameOf } from '../domain/bank-connection';
import { isClosedDate } from '../domain/months';
import { ownerOf } from '../domain/people';
import { FOUND_ACCOUNTS } from './banks';
import { ADVERTISING, BANK_FEES, GOODS_7, INSURANCE, RENT, REVENUE_19, REVENUE_KU, SUPPLIES, UTILITIES } from './categories';
import { DEMO_TODAY } from './demo-date';
import type { Account, Booking, Business, ColumnMapping, ReceiptState, RowMeta, SampleStatement } from './models';
import { newBusinessAccount, newBusinessPayments } from './new-business-sample';
import { BUSINESSES } from './sample-data';

// The bank files the demo imports. The mockup reads no real file: whichever file the person drops, the sample statement
// made for the chosen account stands in for it, the way a simulated upload takes the next result of its pool. Cells are the
// raw text of the file, in the German formats banks write (dates as dd.mm.yyyy or ISO, amounts with a decimal comma);
// each row also says what the demo's automatic booking would decide about it (see `RowMeta`).
// Everything is invented. A statement only has payments of October 2026: months after the business's first sample payment
// and not closed, so the year's opening line and the closed months are never touched. The one exception brings nothing new:
// a connected account with no sample of its own gets its own payments again (see `ownPaymentsStatement`).

/** One row of a sample file: its raw cells, and what the demo decides about it. */
type SampleRow = [cells: string[], meta: RowMeta];

/** What the demo decides about a row: its category (null: none, so the review inbox decides), the receipt it needs, and whether the booking is confirmed (it is, when there is a category, unless said). */
const decided = (booking: Booking | null, receipt: ReceiptState, confirmed = booking !== null): RowMeta => ({
  booking: booking?.labelKey ?? null,
  confirmed,
  receipt,
});

/** A statement from its description and its rows, so the cells and the meta always have one entry for each row. */
function statement(description: Omit<SampleStatement, 'cells' | 'meta'>, rows: SampleRow[]): SampleStatement {
  return { ...description, cells: rows.map(([cells]) => cells), meta: rows.map(([, meta]) => meta) };
}

/** A signed amount as a German bank file writes it: `-1.234,56`. */
function germanAmount(cents: number): string {
  const absolute = Math.abs(cents);
  const euros = String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}${euros},${String(absolute % 100).padStart(2, '0')}`;
}

/** A CAMT file read into one row for each entry: its booking date, signed amount, other party and purpose. Its columns are known, so it is never matched by hand. */
const CAMT_HEADER = ['Buchungsdatum', 'Betrag', 'Name', 'Verwendungszweck'];
const CAMT_MAPPING: ColumnMapping = { roles: ['date', 'amount', 'who', 'purpose'], moneyOut: 'minus' };

// --- Café Linde GbR: the Sparkasse statement account ---

/** A Sparkasse CSV: the columns the bank writes, of which the booking date, name, purpose and amount are read. */
const SPARKASSE_HEADER = ['Buchungstag', 'Valuta', 'Buchungstext', 'Beguenstigter/Zahlungspflichtiger', 'Verwendungszweck', 'Betrag', 'Waehrung'];
const SPARKASSE_MAPPING: ColumnMapping = { roles: ['date', 'ignore', 'ignore', 'who', 'purpose', 'amount', 'ignore'], moneyOut: 'minus' };

/** A row of the Sparkasse CSV, whose booking date is also its value date. */
const sparkasse = (date: string, text: string, who: string, purpose: string, amount: string, meta: RowMeta): SampleRow => [
  [date, date, text, who, purpose, amount, 'EUR'],
  meta,
];

/**
 * Seven rows, newest first. Two are already in the app, on the same Sparkasse account (the electricity and water payment
 * and the rent, see sample-data.ts) and are skipped; of the five new ones, fees, card sales and insurance need no receipt
 * and book themselves, and the two suppliers wait for their receipts.
 */
const CAFE_SPARKASSE = statement(
  { id: 'cl-sparkasse-oktober', fileName: 'sparkasse-oktober.csv', format: 'bankCsv', bankLabel: 'Sparkasse CSV', header: SPARKASSE_HEADER, mapping: SPARKASSE_MAPPING },
  [
    sparkasse('21.10.2026', 'GUTSCHRIFT', 'Kartenumsätze SumUp', 'SumUp Auszahlung 14.10. bis 20.10.', '1.284,50', decided(REVENUE_19, 'notNeeded')),
    sparkasse('19.10.2026', 'LASTSCHRIFT', 'Metro Großmarkt', 'Rechnung 0418-90117', '-318,60', decided(GOODS_7, 'missing')),
    sparkasse('16.10.2026', 'UEBERWEISUNG', 'Bäckerei-Großhandel Krüger', 'Rechnung 26-10-4471', '-436,80', decided(GOODS_7, 'missing')),
    sparkasse('15.10.2026', 'LASTSCHRIFT', 'Stadtwerke Hamburg', 'Abschlag Strom und Wasser Oktober', '-287,40', decided(UTILITIES, 'attached')),
    sparkasse('12.10.2026', 'LASTSCHRIFT', 'Versicherung Allianz', 'Betriebshaftpflicht Oktober', '-89,00', decided(INSURANCE, 'notNeeded')),
    sparkasse('10.10.2026', 'DAUERAUFTRAG', 'Hausverwaltung Lindenallee', 'Miete Oktober, Lindenallee 4', '-1.850,00', decided(RENT, 'attached')),
    sparkasse('05.10.2026', 'ENTGELTABSCHLUSS', 'Kontoführung', 'Entgelt Kontoführung Oktober', '-12,90', decided(BANK_FEES, 'notNeeded')),
  ],
);

// --- Weber Design: the Volksbank account the person adds with "My bank isn't listed" ---

/**
 * A CAMT file with four rows, newest first. A customer pays an overdue invoice and names its number in the reference (RE-2026-039,
 * Bäckerei Lange), so it is paid on its own; Druckerei Mayer's payment is the sure match of the receipt wd-d8 (see
 * sample-documents.ts); one payment has no category yet; and the bank's fee needs no receipt.
 */
const WEBER_VOLKSBANK = statement(
  { id: 'wd-volksbank-oktober', fileName: 'volksbank-oktober.xml', format: 'camt', bankLabel: 'CAMT', header: CAMT_HEADER, mapping: CAMT_MAPPING },
  [
    [['2026-10-20', '1.190,00', 'Bäckerei Lange', 'RE-2026-039 Speisekarte'], decided(REVENUE_19, 'missing')],
    [['2026-10-15', '-142,80', 'Druckerei Mayer', 'Rechnung DM-26-0418, Flyer Herbstaktion'], decided(ADVERTISING, 'missing')],
    [['2026-10-12', '-29,99', 'PayPal (Europe)', 'PAYPAL *FONTSHOP 35314369001'], decided(null, 'missing')],
    [['2026-10-06', '-8,50', 'Volksbank Berlin', 'Kontoführung Oktober'], decided(BANK_FEES, 'notNeeded')],
  ],
);

// --- Sara Weber Yoga: an export in a layout nobody knows ---

/** An export with columns of its own, so the person tells which one holds what. The amount carries its sign; Soll/Haben is an extra flag the person leaves out. */
const SARA_HEADER = ['Wertstellung', 'Valuta', 'Gegenkonto', 'Name', 'Text', 'Betrag', 'Soll/Haben'];

/** A row of Sara's export, whose value date is also its booking date; `flag` is S (Soll, money out) or H (Haben, money in). */
const saraRow = (date: string, account: string, who: string, text: string, amount: string, meta: RowMeta): SampleRow => [
  [date, date, account, who, text, amount, amount.startsWith('-') ? 'S' : 'H'],
  meta,
];

/** Four rows, newest first, none of them in the app yet: a customer, insurance, a shop (its receipt is missing) and the bank's fee. */
const SARA_QONTO = statement(
  { id: 'sy-qonto-oktober', fileName: 'export_2026-10.csv', format: 'unknownCsv', bankLabel: null, header: SARA_HEADER, mapping: null },
  [
    saraRow('20.10.2026', 'DE40100100101234500678', 'Bettina Schulz', 'Privatstunde 18.10.', '60,00', decided(REVENUE_KU, 'missing')),
    saraRow('17.10.2026', 'DE09120300001001234567', 'Hiscox Versicherung', 'Berufshaftpflicht Oktober', '-32,00', decided(INSURANCE, 'notNeeded')),
    saraRow('14.10.2026', 'DE31100100100076543210', 'Papeterie Wolf', 'Kartenzahlung 14.10. Papeterie Wolf Berlin', '-24,90', decided(SUPPLIES, 'missing')),
    saraRow('06.10.2026', 'DE12100100100123456789', 'Qonto', 'Kontoführung Oktober', '-9,00', decided(BANK_FEES, 'notNeeded')),
  ],
);

// --- which statement an account gets ---

/** The statements of the accounts the sample businesses have, by account id, in the order the demo hands them out. */
const ACCOUNT_STATEMENTS: Record<string, SampleStatement[]> = {
  'cl-sparkasse': [CAFE_SPARKASSE],
  'sy-qonto': [SARA_QONTO],
};

/** The statements of an account the business adds itself (a statement account of a bank the demo does not list), by business id. */
const NEW_ACCOUNT_STATEMENTS: Record<string, SampleStatement[]> = {
  'weber-design': [WEBER_VOLKSBANK],
};

/** The id of a business's generic statement. */
const genericId = (business: Business): string => `generic-${business.id}`;

/**
 * The generic statement of a business: the October payments the demo bank connection would bring a business made during the
 * visit (see `newBusinessPayments`), in a CAMT file, so connecting that bank afterwards finds them already here. Every payment waits for its receipt,
 * as a new client has none yet.
 */
function genericStatement(business: Business): SampleStatement {
  const owner = ownerOf(business).name ?? business.name;
  const payments = newBusinessPayments(business.id, newBusinessAccount(business.id, ''), owner).filter((tx) => tx.date.startsWith('2026-10'));
  return statement(
    { id: genericId(business), fileName: 'kontoauszug-oktober.xml', format: 'camt', bankLabel: 'CAMT', header: CAMT_HEADER, mapping: CAMT_MAPPING },
    payments.map((tx): SampleRow => [
      [tx.date, germanAmount(tx.amountCents), tx.counterparty, tx.reference],
      decided(tx.booking, tx.receipt, tx.confirmed),
    ]),
  );
}

// --- a connected account: its own payments again ---

/** A bank CSV with the columns most banks write: booking date, name, purpose, amount and currency, of which the first four are read. */
const OWN_HEADER = ['Buchungsdatum', 'Name', 'Verwendungszweck', 'Betrag', 'Waehrung'];
const OWN_MAPPING: ColumnMapping = { roles: ['date', 'who', 'purpose', 'amount', 'ignore'], moneyOut: 'minus' };

/** An ISO date as a German bank file writes it: `dd.mm.yyyy`. */
const germanDate = (date: string): string => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/**
 * What a statement of a connected account holds: the payments the bank connection brought, so the statement says nothing new. An
 * "Add older months" file of an account whose own sample the demo has none of is made from its own payments of the latest month that
 * is not closed (newest first; none for an account with no payment in an open month), as the bank's CSV, so every row shows as already
 * here and nothing is invented. Each row says what the app decided about the payment, as the generic statement's rows do. It is built from the
 * business as it is, so it has no id `findSampleStatement` knows: it never has a new row, so no import of it is ever recorded.
 */
function ownPaymentsStatement(business: Business, account: Account): SampleStatement {
  const open = business.transactions.filter((tx) => tx.accountId === account.id && !isClosedDate(business, tx.date));
  const month = open.map((tx) => tx.date.slice(0, 7)).sort().at(-1) ?? DEMO_TODAY.slice(0, 7);
  const payments = open.filter((tx) => tx.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const bank = bankNameOf(account) ?? account.name;
  const slug = bank.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'konto';
  return statement(
    { id: `own-${account.id}-${month}`, fileName: `${slug}-${month}.csv`, format: 'bankCsv', bankLabel: `${bank} CSV`, header: OWN_HEADER, mapping: OWN_MAPPING },
    payments.map((tx): SampleRow => [
      [germanDate(tx.date), tx.counterparty, tx.reference, germanAmount(tx.amountCents), 'EUR'],
      decided(tx.booking, tx.receipt, tx.confirmed),
    ]),
  );
}

/** The accounts a business has in the sample data and the ones the demo finds at its banks: every other account of the business was added by the person. */
function sampleAccountIds(businessId: string): Set<string> {
  const own = BUSINESSES.find((business) => business.id === businessId)?.accounts ?? [];
  const found = Object.values(FOUND_ACCOUNTS[businessId] ?? {}).flat();
  return new Set([...own, ...found].map((account) => account.id));
}

/**
 * The statement the demo hands out for an account when `used` statements were handed out for it already. An account of the sample
 * businesses with statements of its own gets them in order; any other connected account gets its own payments again, all of them
 * already here (see `ownPaymentsStatement`); a statement account the business added itself (not one of its sample accounts) gets the
 * business's new-account statement (Weber Design: the Volksbank CAMT); every other account gets the business's generic statement.
 * After the last statement the last is handed out again, and everything in it then shows as already here.
 */
export function sampleStatementFor(business: Business, account: Account, used: number): SampleStatement {
  const own = ACCOUNT_STATEMENTS[account.id];
  if (!own && account.connection.kind === 'connected') return ownPaymentsStatement(business, account);
  const statements =
    own ?? (sampleAccountIds(business.id).has(account.id) ? undefined : NEW_ACCOUNT_STATEMENTS[business.id]) ?? [genericStatement(business)];
  return statements[Math.min(used, statements.length - 1)];
}

/**
 * Any sample statement of a business by its id (an account's, its new-account one, or its generic one), or null for an id none of
 * them has. The import remembers the id of the statement it read, so the original file can be written again.
 */
export function findSampleStatement(business: Business, statementId: string): SampleStatement | null {
  const known = [...Object.values(ACCOUNT_STATEMENTS).flat(), ...(NEW_ACCOUNT_STATEMENTS[business.id] ?? [])];
  return known.find((candidate) => candidate.id === statementId) ?? (statementId === genericId(business) ? genericStatement(business) : null);
}
