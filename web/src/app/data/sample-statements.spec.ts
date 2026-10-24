import { noConnection } from '../domain/bank-connection';
import { certainMatch } from '../domain/document-matching';
import { isClosedDate } from '../domain/months';
import { guessMapping, mappingComplete, previewImport, readRows, statementText } from '../domain/statement-import';
import { ADVERTISING, CATEGORIES } from './categories';
import { DEMO_TODAY } from './demo-date';
import type { Account, Business, SampleStatement, Transaction } from './models';
import { newBusiness, newBusinessAccount, newBusinessPayments, type NewOwner } from './new-business-sample';
import { BUSINESSES } from './sample-data';
import { PERSON } from './sample-person';
import { findSampleStatement, sampleStatementFor } from './sample-statements';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const accountOf = (businessId: string, accountId: string): Account => business(businessId).accounts.find((a) => a.id === accountId)!;

const OWNER: NewOwner = { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email };
const VISIT = newBusiness('new-1', { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' }, OWNER);
/** What the "My bank isn't listed" flow makes: a statement account of a bank the demo has no connection for. */
const VOLKSBANK: Account = {
  id: 'wd-volksbank',
  kind: 'bank',
  name: 'Volksbank',
  balanceCents: 0,
  lastUpdate: DEMO_TODAY,
  connection: noConnection('statement'),
  product: 'business',
  iban: 'DE02120300000000202051',
};

const CAFE = business('cafe-linde');
const WEBER = business('weber-design');
const SARA = business('sara-yoga');
const cafeStatement = (): SampleStatement => sampleStatementFor(CAFE, accountOf('cafe-linde', 'cl-sparkasse'), 0);
const weberStatement = (): SampleStatement => sampleStatementFor(WEBER, VOLKSBANK, 0);
const saraStatement = (): SampleStatement => sampleStatementFor(SARA, accountOf('sara-yoga', 'sy-qonto'), 0);
const genericStatement = (): SampleStatement => sampleStatementFor(VISIT, newBusinessAccount('new-1', 'Volksbank'), 0);

const ALL: [string, Business, SampleStatement][] = [
  ['Café', CAFE, cafeStatement()],
  ['Weber', WEBER, weberStatement()],
  ['Sara', SARA, saraStatement()],
  ['generic', VISIT, genericStatement()],
];

/** What the rows of a statement read as, in file order, with the mapping the file is read with. */
const rowsOf = (statement: SampleStatement) =>
  readRows(statement, statement.mapping ?? guessMapping(statement)).rows.map((row) => [row.date, row.amountCents, row.counterparty] as const);

describe('every sample statement', () => {
  it.each(ALL)('%s: has one meta for each row and a cell for each header', (_name, _business, statement) => {
    expect(statement.meta).toHaveLength(statement.cells.length);
    for (const cells of statement.cells) expect(cells).toHaveLength(statement.header.length);
  });

  it.each(ALL)('%s: can be read in full, with no row it cannot read', (_name, _business, statement) => {
    const { rows, unreadable } = readRows(statement, statement.mapping ?? guessMapping(statement));
    expect(unreadable).toBe(0);
    expect(rows).toHaveLength(statement.cells.length);
  });

  it.each(ALL)('%s: names only categories the app has', (_name, _business, statement) => {
    for (const meta of statement.meta) {
      if (meta.booking !== null) expect(CATEGORIES.map((c) => c.labelKey)).toContain(meta.booking);
    }
  });

  it.each(ALL)('%s: has payments of October only, in an open month after the first payment, up to today', (_name, owner, statement) => {
    const first = owner.transactions.map((tx) => tx.date).sort()[0] ?? '0000-00-00';
    for (const [date] of rowsOf(statement)) {
      expect(date.startsWith('2026-10-'), date).toBe(true);
      expect(date > first, date).toBe(true);
      expect(date <= DEMO_TODAY, date).toBe(true);
      expect(isClosedDate(owner, date), date).toBe(false);
    }
  });

  it.each(ALL)('%s: writes out as a file with a line or an entry for each payment', (_name, _business, statement) => {
    const text = statementText(statement);
    const lines = statement.format === 'camt' ? text.match(/<Ntry>/g)!.length : text.trim().split('\n').length - 1;
    expect(lines).toBe(statement.cells.length);
  });

  it('has an id and a file name of its own', () => {
    const ids = ALL.map(([, , statement]) => statement.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ALL.map(([, , statement]) => statement.fileName)).size).toBe(ALL.length);
  });
});

describe("Café Linde's Sparkasse statement", () => {
  it('is a Sparkasse CSV for October with seven rows, newest first', () => {
    const statement = cafeStatement();
    expect(statement).toMatchObject({ id: 'cl-sparkasse-oktober', fileName: 'sparkasse-oktober.csv', format: 'bankCsv', bankLabel: 'Sparkasse CSV' });
    expect(rowsOf(statement)).toEqual([
      ['2026-10-21', 128450, 'Kartenumsätze SumUp'],
      ['2026-10-19', -31860, 'Metro Großmarkt'],
      ['2026-10-16', -43680, 'Bäckerei-Großhandel Krüger'],
      ['2026-10-15', -28740, 'Stadtwerke Hamburg'],
      ['2026-10-12', -8900, 'Versicherung Allianz'],
      ['2026-10-10', -185000, 'Hausverwaltung Lindenallee'],
      ['2026-10-05', -1290, 'Kontoführung'],
    ]);
  });

  it('is recognised: its own mapping is the one the headers give', () => {
    const statement = cafeStatement();
    expect(mappingComplete(statement.mapping!)).toBe(true);
    expect(guessMapping(statement)).toEqual(statement.mapping);
  });

  it('says what the demo books on its own: fees, card sales and insurance need no receipt, the two suppliers do', () => {
    const byName = new Map(cafeStatement().cells.map((cells, i) => [cells[3], cafeStatement().meta[i]]));
    expect(byName.get('Kontoführung')).toEqual({ booking: 'bankFees', confirmed: true, receipt: 'notNeeded' });
    expect(byName.get('Kartenumsätze SumUp')).toEqual({ booking: 'revenue19', confirmed: true, receipt: 'notNeeded' });
    expect(byName.get('Versicherung Allianz')).toEqual({ booking: 'insurance', confirmed: true, receipt: 'notNeeded' });
    expect(byName.get('Bäckerei-Großhandel Krüger')).toEqual({ booking: 'goods7', confirmed: true, receipt: 'missing' });
    expect(byName.get('Metro Großmarkt')).toEqual({ booking: 'goods7', confirmed: true, receipt: 'missing' });
  });
});

describe("Weber Design's Volksbank statement", () => {
  it('is a CAMT file with four October rows', () => {
    const statement = weberStatement();
    expect(statement).toMatchObject({ id: 'wd-volksbank-oktober', fileName: 'volksbank-oktober.xml', format: 'camt' });
    expect(statement.cells).toHaveLength(4);
    expect(statement.mapping).not.toBeNull();
    expect(mappingComplete(statement.mapping!)).toBe(true);
  });

  it('has the Druckerei Mayer payment of 142,80 € on 15 October, and receipt wd-d8 is its only certain match', () => {
    const rows = rowsOf(weberStatement());
    expect(rows).toContainEqual(['2026-10-15', -14280, 'Druckerei Mayer']);

    const mayer = WEBER.documents.find((d) => d.id === 'wd-d8')!;
    expect(mayer).toMatchObject({
      name: 'Druckerei Mayer',
      direction: 'received',
      date: '2026-10-14',
      amountCents: 14280,
      vatRate: 19,
      booking: ADVERTISING,
      paymentId: null,
    });
    // As the import would build it: a payment that waits for its receipt.
    const payment = (id: string, [date, amountCents, counterparty]: readonly [string, number, string]): Transaction => ({
      id,
      date,
      counterparty,
      accountId: 'wd-volksbank',
      amountCents,
      booking: null,
      confirmed: false,
      isPrivate: false,
      receipt: 'missing',
      receiptFile: null,
      counterpartyIban: '',
      reference: '',
      history: [],
      beforePrivate: null,
      beforeLink: null,
    });
    const arriving = rows.map((row, i) => payment(`vb-${i}`, row));
    const mine = certainMatch(mayer, [...WEBER.transactions, ...arriving]);
    expect(mine?.counterparty).toBe('Druckerei Mayer');
    // No other unlinked document is a certain match for one of these payments, so wd-d8 is the only receipt that is linked by its payment
    const others = WEBER.documents.filter((d) => d.id !== 'wd-d8' && d.paymentId === null);
    for (const doc of others) {
      const match = certainMatch(doc, [...WEBER.transactions, ...arriving]);
      expect(arriving.map((tx) => tx.id), doc.id).not.toContain(match?.id);
    }
  });

  it('has a payment that names an open sent invoice (RE-2026-039) in its reference', () => {
    const statement = weberStatement();
    const purposeAt = statement.mapping!.roles.indexOf('purpose');
    const named = statement.cells.filter((cells) => /RE-2026-039/.test(cells[purposeAt]));
    expect(named).toHaveLength(1);
    expect(WEBER.invoices.find((i) => i.number === 'RE-2026-039')).toMatchObject({ paymentIds: [], cancelledBy: null });
  });

  it('is the same file whichever bank the statement account is named after', () => {
    expect(sampleStatementFor(WEBER, { ...VOLKSBANK, id: 'wd-volksbank-2', name: 'Sparda-Bank' }, 0)).toBe(weberStatement());
  });
});

describe("Sara Weber Yoga's export", () => {
  it('has an unknown layout: the person matches the columns', () => {
    const statement = saraStatement();
    expect(statement).toMatchObject({ id: 'sy-qonto-oktober', fileName: 'export_2026-10.csv', format: 'unknownCsv', bankLabel: null, mapping: null });
    expect(statement.header).toEqual(['Wertstellung', 'Valuta', 'Gegenkonto', 'Name', 'Text', 'Betrag', 'Soll/Haben']);
    expect(statement.cells).toHaveLength(4);
  });

  it('is guessed completely: the dates, the name, the text and the signed amount, and the Soll/Haben column is left out', () => {
    expect(guessMapping(saraStatement())).toEqual({
      roles: ['date', 'ignore', 'ignore', 'who', 'purpose', 'amount', 'ignore'],
      moneyOut: 'minus',
    });
  });

  it('carries the sign in the amount: money out has a minus', () => {
    const statement = saraStatement();
    const amountAt = 5;
    const flagAt = 6;
    for (const cells of statement.cells) {
      expect(cells[amountAt].startsWith('-'), cells[3]).toBe(cells[flagAt] === 'S');
    }
  });
});

describe('sampleStatementFor', () => {
  it("gives an account its own statements in order, and the last again after that", () => {
    const sparkasse = accountOf('cafe-linde', 'cl-sparkasse');
    expect(sampleStatementFor(CAFE, sparkasse, 0).id).toBe('cl-sparkasse-oktober');
    expect(sampleStatementFor(CAFE, sparkasse, 1)).toBe(sampleStatementFor(CAFE, sparkasse, 0));
    expect(sampleStatementFor(CAFE, sparkasse, 7)).toBe(sampleStatementFor(CAFE, sparkasse, 0));
    expect(sampleStatementFor(SARA, accountOf('sara-yoga', 'sy-qonto'), 3).id).toBe('sy-qonto-oktober');
  });

  it("gives a statement account the business added, which is not one of its sample accounts, its new-account statement", () => {
    expect(weberStatement().id).toBe('wd-volksbank-oktober');
    expect(sampleStatementFor(WEBER, VOLKSBANK, 4)).toBe(weberStatement());
  });

  it("gives an account of a business without a new-account statement the generic one", () => {
    const added: Account = { ...VOLKSBANK, id: 'cl-volksbank' };
    expect(sampleStatementFor(CAFE, added, 0).id).toBe('generic-cafe-linde');
  });

  it('gives a statement account with no statement of its own the generic one: a found account that is not connected, a visit business account', () => {
    const found: Account = { ...VOLKSBANK, id: 'wd-savings' };
    expect(sampleStatementFor(WEBER, found, 0).id).toBe('generic-weber-design');
    expect(genericStatement().id).toBe('generic-new-1');
  });

  it('gives a connected account with no statement of its own its own payments, not the generic statement', () => {
    expect(sampleStatementFor(WEBER, accountOf('weber-design', 'wd-qonto'), 0).id).toBe('own-wd-qonto-2026-10');
    expect(sampleStatementFor(CAFE, accountOf('cafe-linde', 'cl-qonto'), 0).id).toBe('own-cl-qonto-2026-10');
  });

  it('keeps the statement of a connected account that has one of its own (Sara in the sample)', () => {
    expect(saraStatement().id).toBe('sy-qonto-oktober');
  });

  it('the generic statement is the October payments of a business made during the visit, as the demo bank would bring them', () => {
    const statement = genericStatement();
    const payments = newBusinessPayments('new-1', newBusinessAccount('new-1', 'Volksbank'), 'Sara Weber').filter((tx) => tx.date.startsWith('2026-10'));
    expect(payments).toHaveLength(8);
    expect(statement.format).toBe('camt');
    const { rows } = readRows(statement, statement.mapping!);
    expect(rows.map(({ date, amountCents, counterparty, reference }) => ({ date, amountCents, counterparty, reference }))).toEqual(
      payments.map((tx) => ({ date: tx.date, amountCents: tx.amountCents, counterparty: tx.counterparty, reference: tx.reference })),
    );
    expect(statement.meta).toEqual(
      payments.map((tx) => ({ booking: tx.booking?.labelKey ?? null, confirmed: tx.confirmed, receipt: 'missing' })),
    );
  });

  it("names the owner on the transfer to the private account", () => {
    expect(rowsOf(genericStatement()).map(([, , name]) => name)).toContain('Sara Weber');
  });
});

describe("a connected account's own payments again", () => {
  const WEBER_QONTO = accountOf('weber-design', 'wd-qonto');
  const ownStatement = (owner = WEBER, account = WEBER_QONTO): SampleStatement => sampleStatementFor(owner, account, 0);
  const paymentsOf = (owner: Business, accountId: string, month: string): Transaction[] =>
    owner.transactions.filter((tx) => tx.accountId === accountId && tx.date.startsWith(month));

  it("is the bank's CSV for the latest open month, named after the bank", () => {
    expect(ownStatement()).toMatchObject({ id: 'own-wd-qonto-2026-10', fileName: 'qonto-2026-10.csv', format: 'bankCsv', bankLabel: 'Qonto CSV' });
    expect(ownStatement(CAFE, accountOf('cafe-linde', 'cl-qonto'))).toMatchObject({ fileName: 'qonto-2026-10.csv', bankLabel: 'Qonto CSV' });
  });

  it("has one row for each payment of the account's month, newest first, and one meta for each row", () => {
    const statement = ownStatement();
    const payments = paymentsOf(WEBER, 'wd-qonto', '2026-10');
    expect(payments.length).toBeGreaterThan(3);
    expect(rowsOf(statement)).toEqual(
      [...payments].sort((a, b) => b.date.localeCompare(a.date)).map((tx) => [tx.date, tx.amountCents, tx.counterparty]),
    );
    expect(statement.meta).toHaveLength(statement.cells.length);
    for (const cells of statement.cells) expect(cells).toHaveLength(statement.header.length);
  });

  it('can be read in full, and is recognised: its own mapping is the one the headers give', () => {
    const statement = ownStatement();
    const { unreadable } = readRows(statement, statement.mapping!);
    expect(unreadable).toBe(0);
    expect(mappingComplete(statement.mapping!)).toBe(true);
    expect(guessMapping(statement)).toEqual(statement.mapping);
  });

  it("says what the app decided about each payment: its category, whether it is confirmed and its receipt", () => {
    const statement = ownStatement();
    const rows = readRows(statement, statement.mapping!).rows;
    const adobe = paymentsOf(WEBER, 'wd-qonto', '2026-10').find((tx) => tx.counterparty === 'Adobe')!;
    const at = rows.findIndex((row) => row.counterparty === 'Adobe');
    expect(statement.meta[at]).toEqual({ booking: adobe.booking!.labelKey, confirmed: adobe.confirmed, receipt: adobe.receipt });
    const unclear = rows.findIndex((row) => row.counterparty === 'Amazon');
    expect(statement.meta[unclear].booking).toBeNull();
  });

  it('writes out as a file with a line for each payment', () => {
    const statement = ownStatement();
    expect(statementText(statement).trim().split('\n')).toHaveLength(statement.cells.length + 1);
  });

  it('is all here already: no row of it is new', () => {
    for (const [owner, accountId] of [[WEBER, 'wd-qonto'], [CAFE, 'cl-qonto']] as const) {
      const statement = sampleStatementFor(owner, accountOf(owner.id, accountId), 0);
      const preview = previewImport(owner, readRows(statement, statement.mapping!).rows, () => false);
      expect(preview, owner.id).toMatchObject({ newCount: 0, duplicateCount: statement.cells.length });
    }
  });

  it('is the same file however often it is handed out', () => {
    expect(sampleStatementFor(WEBER, WEBER_QONTO, 3)).toEqual(ownStatement());
  });

  it('skips a month that is closed: the latest month that is open has its payments', () => {
    // October is closed and September is open again (the sample closes August and September).
    const septemberOpen: Business = { ...WEBER, closedMonths: [{ month: '2026-08', on: '2026-09-08', by: null }, { month: '2026-10', on: DEMO_TODAY, by: null }] };
    const statement = sampleStatementFor(septemberOpen, WEBER_QONTO, 0);
    expect(statement.id).toBe('own-wd-qonto-2026-09');
    expect(rowsOf(statement)).toHaveLength(paymentsOf(WEBER, 'wd-qonto', '2026-09').length);
    expect(rowsOf(statement).every(([date]) => date.startsWith('2026-09-'))).toBe(true);
  });

  it('is an empty file for a connected account with no payment in an open month, and still reads', () => {
    const savings: Account = { ...WEBER_QONTO, id: 'wd-savings', name: 'Qonto Savings', product: 'savings' };
    const statement = sampleStatementFor(WEBER, savings, 0);
    expect(statement).toMatchObject({ id: 'own-wd-savings-2026-10', fileName: 'qonto-2026-10.csv', cells: [], meta: [] });
    expect(readRows(statement, statement.mapping!)).toEqual({ rows: [], unreadable: 0 });
  });

  it('is not looked up by id: an import of it is never recorded, since nothing in it is new', () => {
    expect(findSampleStatement(WEBER, 'own-wd-qonto-2026-10')).toBeNull();
  });
});

describe('findSampleStatement', () => {
  it('finds the statement of an account, the new-account statement and the generic one of the business, by id', () => {
    expect(findSampleStatement(CAFE, 'cl-sparkasse-oktober')).toBe(cafeStatement());
    expect(findSampleStatement(WEBER, 'wd-volksbank-oktober')).toBe(weberStatement());
    expect(findSampleStatement(SARA, 'sy-qonto-oktober')).toBe(saraStatement());
    expect(findSampleStatement(VISIT, 'generic-new-1')).toEqual(genericStatement());
    expect(findSampleStatement(WEBER, 'generic-weber-design')?.id).toBe('generic-weber-design');
  });

  it("is null for an id nobody has, and for another business's new-account or generic statement", () => {
    expect(findSampleStatement(CAFE, 'nope')).toBeNull();
    expect(findSampleStatement(CAFE, 'wd-volksbank-oktober')).toBeNull();
    expect(findSampleStatement(VISIT, 'generic-weber-design')).toBeNull();
  });

  it('finds the statement it handed out, so the original file can be written again', () => {
    for (const [, owner, statement] of ALL) {
      expect(statementText(findSampleStatement(owner, statement.id)!), statement.id).toBe(statementText(statement));
    }
  });
});
