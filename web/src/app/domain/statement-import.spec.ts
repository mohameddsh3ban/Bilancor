import { BANK_FEES, GOODS_7, INSURANCE, OFFICE, REVENUE_19 } from '../data/categories';
import type { Account, Business, ColumnMapping, HistoryEntry, SampleStatement, StatementImport, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { isClosedDate } from './months';
import { changeCategory, markNoReceiptNeeded, setPrivate } from './payment-actions';
import { paymentStatus } from './payment-status';
import {
  canUndoImport,
  guessMapping,
  importTransactions,
  isDuplicate,
  mappingComplete,
  parseStatementAmount,
  parseStatementDate,
  previewImport,
  readRows,
  statementText,
  undoBlockedBy,
  type StatementRow,
} from './statement-import';

const SPARKASSE: Account = {
  id: 'acc-sp',
  kind: 'bank',
  name: 'Sparkasse',
  balanceCents: 0,
  lastUpdate: '2026-10-20',
  connection: { kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
  product: 'business',
  iban: 'DE23200505500847319256',
};
const OTHER_BANK: Account = { ...SPARKASSE, id: 'acc-other', name: 'Volksbank' };

/** A payment already in the app. */
const existing = (patch: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-10-01',
  counterparty: 'Stadtwerke Hamburg',
  accountId: SPARKASSE.id,
  amountCents: -28740,
  booking: null,
  confirmed: false,
  isPrivate: false,
  receipt: 'missing',
  receiptFile: null,
  counterpartyIban: '',
  reference: 'Strom Oktober',
  history: [{ date: '2026-10-01', key: 'imported', params: { account: 'Sparkasse' } }],
  beforePrivate: null,
  beforeLink: null,
  ...patch,
});

const business = (patch: Partial<Business> = {}): Business => ({
  ...structuredClone(BUSINESSES[0]),
  accounts: [SPARKASSE, OTHER_BANK],
  transactions: [],
  categoryRules: [],
  closedMonths: [],
  yearOpening: { incomeCents: 0, costsCents: 0, costsByCategory: [], untilMonth: '2026-08' },
  imports: [],
  ...patch,
});

const NOTHING_CLOSED = (_month: string): boolean => false;

const MINUS: ColumnMapping = { roles: ['date', 'who', 'purpose', 'amount'], moneyOut: 'minus' };

/** A small Sparkasse-style file: three readable rows and one with a date that does not exist. */
const statement = (patch: Partial<SampleStatement> = {}): SampleStatement => ({
  id: 'st-1',
  fileName: 'sparkasse-oktober.csv',
  format: 'bankCsv',
  bankLabel: 'Sparkasse CSV',
  header: ['Buchungstag', 'Name', 'Verwendungszweck', 'Betrag'],
  cells: [
    ['01.10.2026', 'Stadtwerke Hamburg', 'Strom Oktober', '-287,40'],
    ['05.10.2026', 'Kartenumsätze SumUp', 'Umsatz Oktober', '1.284,50'],
    ['07.10.2026', 'Kontoführung', 'Entgelt', '-12,90'],
    ['32.10.2026', 'Kaputt', 'Kein Datum', '5,00'],
  ],
  mapping: MINUS,
  meta: [
    { booking: 'utilities', confirmed: false, receipt: 'missing' },
    { booking: 'revenue19', confirmed: true, receipt: 'notNeeded' },
    { booking: 'bankFees', confirmed: true, receipt: 'notNeeded' },
    { booking: null, confirmed: false, receipt: 'missing' },
  ],
  ...patch,
});

const row = (patch: Partial<StatementRow> = {}): StatementRow => ({
  index: 0,
  date: '2026-10-01',
  amountCents: -28740,
  counterparty: 'Stadtwerke Hamburg',
  reference: 'Strom Oktober',
  ...patch,
});

describe('parseStatementDate', () => {
  it('reads 01.10.2026, 01.10.26 and 2026-10-01 the same', () => {
    expect(parseStatementDate('01.10.2026')).toBe('2026-10-01');
    expect(parseStatementDate('01.10.26')).toBe('2026-10-01');
    expect(parseStatementDate('2026-10-01')).toBe('2026-10-01');
    expect(parseStatementDate(' 1.10.2026 ')).toBe('2026-10-01');
  });

  it('cannot read a date that does not exist, or text that is no date', () => {
    expect(parseStatementDate('32.10.2026')).toBeNull();
    expect(parseStatementDate('31.02.2026')).toBeNull();
    expect(parseStatementDate('2026-13-01')).toBeNull();
    expect(parseStatementDate('Oktober')).toBeNull();
    expect(parseStatementDate('')).toBeNull();
  });

  it('knows a leap day', () => {
    expect(parseStatementDate('29.02.2028')).toBe('2028-02-29');
    expect(parseStatementDate('29.02.2026')).toBeNull();
  });
});

describe('parseStatementAmount', () => {
  it('reads German amounts as cents, with a sign, a thousands dot, a euro sign or a true minus', () => {
    expect(parseStatementAmount('-1.234,56')).toBe(-123456);
    expect(parseStatementAmount('1234,56')).toBe(123456);
    expect(parseStatementAmount('1.234,56 €')).toBe(123456);
    expect(parseStatementAmount('−12,00')).toBe(-1200); // U+2212
    expect(parseStatementAmount('+49,90')).toBe(4990);
    expect(parseStatementAmount('- 12,00')).toBe(-1200);
  });

  it('cannot read text, an empty cell or an amount of nothing', () => {
    expect(parseStatementAmount('Miete')).toBeNull();
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('0,00')).toBeNull();
  });
});

describe('guessMapping', () => {
  it('finds date, amount, who and purpose from German headers', () => {
    const guess = guessMapping(statement({ header: ['Buchungstag', 'Name Zahlungsbeteiligter', 'Verwendungszweck', 'Betrag'] }));
    expect(guess).toEqual({ roles: ['date', 'who', 'purpose', 'amount'], moneyOut: 'minus' });
  });

  it('finds them from English headers', () => {
    const guess = guessMapping(statement({ header: ['Date', 'Counterparty', 'Reference', 'Amount'] }));
    expect(guess).toEqual({ roles: ['date', 'who', 'purpose', 'amount'], moneyOut: 'minus' });
  });

  it('takes a Soll column as money out and switches to its own column', () => {
    const header = ['Buchungstag', 'Empfänger', 'Verwendungszweck', 'Soll', 'Haben'];
    const cells = [['01.10.2026', 'Stadtwerke', 'Strom', '287,40', '']];
    const guess = guessMapping(statement({ header, cells }));
    expect(guess).toEqual({ roles: ['date', 'who', 'purpose', 'amountOut', 'amount'], moneyOut: 'column' });
  });

  it('prefers the booking day over the value date, and leaves the other columns alone', () => {
    const header = ['Valutadatum', 'Buchungstag', 'Gegenkonto', 'Auftraggeber', 'Soll/Haben', 'Betrag'];
    const cells = [['01.10.2026', '02.10.2026', 'DE23200505500847319256', 'Kunde AG', 'H', '100,00']];
    const guess = guessMapping(statement({ header, cells }));
    expect(guess.roles).toEqual(['ignore', 'date', 'ignore', 'who', 'ignore', 'amount']);
    expect(guess.moneyOut).toBe('minus');
  });

  it('reads the columns from the shape of the cells when the headers say nothing', () => {
    const header = ['A', 'B', 'C', 'D', 'E'];
    const cells = [
      ['01.10.2026', 'DE23200505500847319256', 'Stadtwerke Hamburg', 'Strom Oktober', '-287,40'],
      ['05.10.2026', 'DE44100101010637185294', 'Kartenumsätze SumUp', 'Umsatz', '1.284,50'],
    ];
    const guess = guessMapping(statement({ header, cells }));
    expect(guess).toEqual({ roles: ['date', 'ignore', 'who', 'purpose', 'amount'], moneyOut: 'minus' });
  });

  it('leaves a role unmatched when nothing fits, so the person has to match it', () => {
    const guess = guessMapping(statement({ header: ['X', 'Y'], cells: [['hallo', 'welt']] }));
    expect(mappingComplete(guess)).toBe(false);
  });
});

describe('mappingComplete', () => {
  it('needs date, who and amount', () => {
    expect(mappingComplete({ roles: ['date', 'who', 'purpose', 'amount'], moneyOut: 'minus' })).toBe(true);
    expect(mappingComplete({ roles: ['date', 'who', 'ignore', 'ignore'], moneyOut: 'minus' })).toBe(false);
    expect(mappingComplete({ roles: ['date', 'ignore', 'purpose', 'amount'], moneyOut: 'minus' })).toBe(false);
    expect(mappingComplete({ roles: ['ignore', 'who', 'purpose', 'amount'], moneyOut: 'minus' })).toBe(false);
  });

  it('also needs the out column when money out has its own column', () => {
    expect(mappingComplete({ roles: ['date', 'who', 'amount'], moneyOut: 'column' })).toBe(false);
    expect(mappingComplete({ roles: ['date', 'who', 'amount', 'amountOut'], moneyOut: 'column' })).toBe(true);
  });
});

describe('readRows', () => {
  it('reads each row as an ISO date, signed cents, a name and a reference, keeping its place in the file', () => {
    const { rows, unreadable } = readRows(statement(), MINUS);
    expect(unreadable).toBe(1);
    expect(rows).toEqual([
      { index: 0, date: '2026-10-01', amountCents: -28740, counterparty: 'Stadtwerke Hamburg', reference: 'Strom Oktober' },
      { index: 1, date: '2026-10-05', amountCents: 128450, counterparty: 'Kartenumsätze SumUp', reference: 'Umsatz Oktober' },
      { index: 2, date: '2026-10-07', amountCents: -1290, counterparty: 'Kontoführung', reference: 'Entgelt' },
    ]);
  });

  it('makes the rows of a separate money-out column negative, and keeps money in as it is', () => {
    const cells = [
      ['01.10.2026', 'Stadtwerke', 'Strom', '287,40', ''],
      ['05.10.2026', 'SumUp', 'Umsatz', '', '1.284,50'],
      ['06.10.2026', 'Bank', 'Entgelt', '-12,90', ''], // a minus in the out column does not turn it positive
    ];
    const mapping: ColumnMapping = { roles: ['date', 'who', 'purpose', 'amountOut', 'amount'], moneyOut: 'column' };
    const { rows, unreadable } = readRows(statement({ cells, mapping }), mapping);
    expect(unreadable).toBe(0);
    expect(rows.map((r) => r.amountCents)).toEqual([-28740, 128450, -1290]);
  });

  it('counts unreadable rows and does not import them: a bad date, a bad amount or no name', () => {
    const cells = [
      ['01.10.2026', 'Gut', 'x', '10,00'],
      ['kein Datum', 'Schlecht', 'x', '10,00'],
      ['02.10.2026', 'Schlecht', 'x', 'viel'],
      ['03.10.2026', '  ', 'x', '10,00'],
      ['04.10.2026', 'Auch gut', '', '20,00'],
    ];
    const { rows, unreadable } = readRows(statement({ cells }), MINUS);
    expect(unreadable).toBe(3);
    expect(rows.map((r) => r.index)).toEqual([0, 4]);
    expect(rows[1].reference).toBe('');
  });

  it('reads nothing while the mapping does not name date, who and amount', () => {
    const { rows, unreadable } = readRows(statement(), { roles: ['date', 'ignore', 'ignore', 'ignore'], moneyOut: 'minus' });
    expect(rows).toEqual([]);
    expect(unreadable).toBe(4);
  });

  it('follows a changed column meaning: swapping who and purpose changes the names', () => {
    const swapped: ColumnMapping = { roles: ['date', 'purpose', 'who', 'amount'], moneyOut: 'minus' };
    expect(readRows(statement(), swapped).rows[0]).toMatchObject({ counterparty: 'Strom Oktober', reference: 'Stadtwerke Hamburg' });
  });
});

describe('isDuplicate', () => {
  it('is a payment of the same account, date and amount with the same name', () => {
    expect(isDuplicate(row(), existing(), SPARKASSE.id)).toBe(true);
  });

  it('reads the name without caring for case, spacing or umlauts', () => {
    const tx = existing({ counterparty: 'Müller  GmbH', reference: 'x' });
    expect(isDuplicate(row({ counterparty: 'MUELLER GMBH', reference: 'y' }), tx, SPARKASSE.id)).toBe(true);
    expect(isDuplicate(row({ counterparty: 'müller gmbh ', reference: 'y' }), tx, SPARKASSE.id)).toBe(true);
    expect(isDuplicate(row({ counterparty: 'Miller GmbH', reference: 'y' }), tx, SPARKASSE.id)).toBe(false);
  });

  it('is also a duplicate with another name when the reference is the same', () => {
    expect(isDuplicate(row({ counterparty: 'Stadtwerke HH' }), existing(), SPARKASSE.id)).toBe(true);
    expect(isDuplicate(row({ counterparty: 'Stadtwerke HH', reference: 'strom  oktober' }), existing(), SPARKASSE.id)).toBe(true);
  });

  it('never treats two empty references as the same reference', () => {
    expect(isDuplicate(row({ counterparty: 'Anderer', reference: '' }), existing({ reference: '' }), SPARKASSE.id)).toBe(false);
  });

  it('needs the same date and the same amount', () => {
    expect(isDuplicate(row({ date: '2026-10-02' }), existing(), SPARKASSE.id)).toBe(false);
    expect(isDuplicate(row({ amountCents: -28741 }), existing(), SPARKASSE.id)).toBe(false);
    expect(isDuplicate(row({ amountCents: 28740 }), existing(), SPARKASSE.id)).toBe(false);
  });

  it("a different account isn't a duplicate", () => {
    expect(isDuplicate(row(), existing({ accountId: OTHER_BANK.id }), SPARKASSE.id)).toBe(false);
  });

  it('with a null account matches a payment of any account', () => {
    expect(isDuplicate(row(), existing({ accountId: OTHER_BANK.id }), null)).toBe(true);
    expect(isDuplicate(row(), existing({ accountId: SPARKASSE.id }), null)).toBe(true);
    expect(isDuplicate(row({ date: '2026-10-02' }), existing(), null)).toBe(false);
  });
});

describe('previewImport', () => {
  it('marks a row that is already here, with the payment it matches', () => {
    const b = business({ transactions: [existing()] });
    const preview = previewImport(b, readRows(statement(), MINUS).rows, NOTHING_CLOSED);
    expect(preview.rows.map((r) => [r.index, r.state, r.duplicateOf])).toEqual([
      [0, 'duplicate', 'tx-1'],
      [1, 'new', null],
      [2, 'new', null],
    ]);
  });

  it('a payment of another account of the business makes a row a duplicate too: the account is only where the file is imported', () => {
    const b = business({ transactions: [existing({ accountId: OTHER_BANK.id })] });
    const preview = previewImport(b, readRows(statement(), MINUS).rows, NOTHING_CLOSED);
    expect(preview.rows.map((r) => [r.index, r.state, r.duplicateOf])).toEqual([
      [0, 'duplicate', 'tx-1'],
      [1, 'new', null],
      [2, 'new', null],
    ]);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.newCount).toBe(2);
  });

  it('a file whose payments all sit in another account of the business has nothing new', () => {
    const rows = readRows(statement(), MINUS).rows;
    const others = rows.map((r, i) => existing({ id: `tx-${i}`, accountId: OTHER_BANK.id, date: r.date, amountCents: r.amountCents, counterparty: r.counterparty, reference: r.reference }));
    const preview = previewImport(business({ transactions: others }), rows, NOTHING_CLOSED);
    expect(preview).toMatchObject({ newCount: 0, duplicateCount: 3 });
  });

  it('matches each payment already in the app once, so two identical payments in a file stay two', () => {
    const twice = [row({ index: 0 }), row({ index: 1 })];
    const one = previewImport(business({ transactions: [existing()] }), twice, NOTHING_CLOSED);
    expect(one.rows.map((r) => r.state)).toEqual(['duplicate', 'new']);
    const two = previewImport(business({ transactions: [existing(), existing({ id: 'tx-2' })] }), twice, NOTHING_CLOSED);
    expect(two.rows.map((r) => [r.state, r.duplicateOf])).toEqual([['duplicate', 'tx-1'], ['duplicate', 'tx-2']]);
  });

  it('closed-month rows are not imported: they sit in their own group', () => {
    const rows = [
      row({ index: 0, date: '2026-09-30', counterparty: 'Alt' }),
      row({ index: 1, date: '2026-10-01', counterparty: 'Neu' }),
    ];
    const preview = previewImport(business(), rows, (month) => month === '2026-09');
    expect(preview.rows.map((r) => r.state)).toEqual(['closedMonth', 'new']);
    expect(preview.closedCount).toBe(1);
    expect(preview.newCount).toBe(1);
  });

  it('asks the closed-month check of Reports (isClosedDate) month by month', () => {
    const closed = business({ closedMonths: [{ month: '2026-09', on: '2026-10-02', by: 'Sara Weber' }] });
    const rows = [row({ index: 0, date: '2026-09-30', counterparty: 'Alt' }), row({ index: 1, date: '2026-10-01', counterparty: 'Neu' })];
    const preview = previewImport(closed, rows, (month) => isClosedDate(closed, `${month}-01`));
    expect(preview.rows.map((r) => r.state)).toEqual(['closedMonth', 'new']);
  });

  it('a row that is already here is reported as already here, even in a closed month', () => {
    const b = business({ transactions: [existing({ date: '2026-09-30' })] });
    const preview = previewImport(b, [row({ date: '2026-09-30' })], (month) => month === '2026-09');
    expect(preview.rows[0].state).toBe('duplicate');
  });

  it('counts each group and gives the date range of the whole file', () => {
    const b = business({ transactions: [existing()] });
    const rows = [...readRows(statement(), MINUS).rows, row({ index: 9, date: '2026-09-15', counterparty: 'Alt', reference: '' })];
    const preview = previewImport(b, rows, (month) => month === '2026-09', 1);
    expect(preview).toMatchObject({ newCount: 2, duplicateCount: 1, closedCount: 1, unreadable: 1, from: '2026-09-15', to: '2026-10-07' });
    expect(preview.rows).toHaveLength(4);
  });

  it('has no date range and no rows for a file without readable rows', () => {
    expect(previewImport(business(), [], NOTHING_CLOSED)).toEqual({
      rows: [],
      newCount: 0,
      duplicateCount: 0,
      closedCount: 0,
      unreadable: 0,
      from: null,
      to: null,
    });
  });
});

describe('importTransactions', () => {
  const preview = (b: Business, s: SampleStatement = statement(), isClosed = NOTHING_CLOSED) =>
    previewImport(b, readRows(s, s.mapping!).rows, isClosed);

  it('builds only the new rows, with the booking, confirmation and receipt of their meta', () => {
    const b = business({ transactions: [existing()] });
    const built = importTransactions(b, SPARKASSE.id, preview(b), statement(), 'imp-7');
    expect(built.map((t) => t.id)).toEqual(['imp-7-r1', 'imp-7-r2']);

    const [income, fees] = built;
    expect(income).toMatchObject({
      date: '2026-10-05',
      counterparty: 'Kartenumsätze SumUp',
      accountId: SPARKASSE.id,
      amountCents: 128450,
      booking: REVENUE_19,
      confirmed: true,
      isPrivate: false,
      receipt: 'notNeeded',
      receiptFile: null,
      reference: 'Umsatz Oktober',
      beforePrivate: null,
      beforeLink: null,
    });
    expect(fees).toMatchObject({ booking: BANK_FEES, confirmed: true, receipt: 'notNeeded' });
    expect(paymentStatus(income)).toBe('booked');
  });

  it('leaves a row without a booking unclear, and keeps a booking that is not confirmed as one to confirm', () => {
    const b = business();
    const [utilities] = importTransactions(b, SPARKASSE.id, preview(b), statement(), 'imp-1');
    expect(utilities).toMatchObject({ id: 'imp-1-r0', booking: { labelKey: 'utilities' }, confirmed: false, receipt: 'missing' });
    expect(paymentStatus(utilities)).toBe('confirm');

    const bare = statement({ meta: statement().meta.map((m) => ({ ...m, booking: null, confirmed: false })) });
    const unclear = importTransactions(b, SPARKASSE.id, preview(b, bare), bare, 'imp-2');
    expect(unclear).toHaveLength(3);
    expect(unclear.every((t) => t.booking === null && paymentStatus(t) === 'unclear')).toBe(true);
  });

  it('gives each payment the lines of an imported, automatically booked payment, newest first', () => {
    const b = business();
    const [utilities, income] = importTransactions(b, SPARKASSE.id, preview(b), statement(), 'imp-1');
    const lines = (t: Transaction): HistoryEntry[] => t.history;
    expect(lines(utilities)).toEqual([
      { date: '2026-10-22', key: 'autoBooked', params: { category: 'utilities' } },
      { date: '2026-10-22', key: 'imported', params: { account: 'Sparkasse', file: 'sparkasse-oktober.csv' } },
    ]);
    expect(lines(income).map((h) => h.key)).toEqual(['autoBooked', 'imported']);
  });

  it('applies the stored category rules to rows without a booking, and says so in the history', () => {
    const s = statement({
      cells: [
        ['01.10.2026', 'Metro Großmarkt', 'Einkauf', '-318,60'],
        ['02.10.2026', 'Amazon', 'Bestellung', '-34,90'],
        ['03.10.2026', 'METRO  Großmarkt.', 'Einkauf 2', '-45,00'],
      ],
      meta: [
        { booking: null, confirmed: false, receipt: 'missing' },
        { booking: null, confirmed: false, receipt: 'missing' },
        { booking: null, confirmed: false, receipt: 'missing' },
      ],
    });
    const b = business({ categoryRules: [{ counterpartyKey: 'metro großmarkt', booking: GOODS_7 }] });
    const built = importTransactions(b, SPARKASSE.id, preview(b, s), s, 'imp-3');

    const [metro, amazon, metroAgain] = built;
    expect(metro).toMatchObject({ booking: GOODS_7, confirmed: true });
    expect(metro.history.map((h) => h.key)).toEqual(['bookedByRule', 'imported']);
    expect(metro.history[0].params).toEqual({ category: 'goods7' });
    expect(metroAgain).toMatchObject({ booking: GOODS_7, confirmed: true });
    expect(amazon).toMatchObject({ booking: null, confirmed: false });
    expect(amazon.history.map((h) => h.key)).toEqual(['imported']);
    expect(paymentStatus(amazon)).toBe('unclear');
  });

  it('does not let a rule change a row that has its own booking', () => {
    const b = business({ categoryRules: [{ counterpartyKey: 'kontoführung', booking: OFFICE }] });
    const built = importTransactions(b, SPARKASSE.id, preview(b), statement(), 'imp-4');
    expect(built[2].booking).toBe(BANK_FEES);
    expect(built[2].history.map((h) => h.key)).toEqual(['autoBooked', 'imported']);
  });

  it('builds nothing for rows that are duplicates or in a closed month', () => {
    const b = business({ transactions: [existing()] });
    const built = importTransactions(b, SPARKASSE.id, preview(b, statement(), (m) => m === '2026-10'), statement(), 'imp-5');
    expect(built).toEqual([]);
  });

  it('does not touch the business', () => {
    const b = business({ transactions: [existing()], categoryRules: [{ counterpartyKey: 'x', booking: OFFICE }] });
    const before = structuredClone(b);
    importTransactions(b, SPARKASSE.id, preview(b), statement(), 'imp-6');
    expect(b).toEqual(before);
  });
});

describe('undoBlockedBy and canUndoImport', () => {
  const imp = (ids: string[]): StatementImport => ({
    id: 'imp-1',
    accountId: SPARKASSE.id,
    statementId: 'st-1',
    fileName: 'sparkasse-oktober.csv',
    importedOn: '2026-10-22',
    paymentIds: ids,
    skippedCount: 0,
  });

  /** A business holding the payments an import of the sample statement built, and that import's record. */
  const imported = (): { b: Business; record: StatementImport } => {
    const empty = business();
    const built = importTransactions(empty, SPARKASSE.id, previewImport(empty, readRows(statement(), MINUS).rows, NOTHING_CLOSED), statement(), 'imp-1');
    const record = imp(built.map((t) => t.id));
    return { b: business({ transactions: built, imports: [record] }), record };
  };
  const change = (b: Business, id: string, edit: (tx: Transaction) => Transaction): Business => ({
    ...b,
    transactions: b.transactions.map((t) => (t.id === id ? edit(t) : t)),
  });

  it('is null and can be undone for payments that are as the import built them', () => {
    const { b, record } = imported();
    expect(undoBlockedBy(b, record, NOTHING_CLOSED)).toBeNull();
    expect(canUndoImport(b, record, NOTHING_CLOSED)).toBe(true);
  });

  it('is worked after a payment was answered, recategorised, made private or marked as needing no receipt', () => {
    const { b, record } = imported();
    const edits: [string, (tx: Transaction) => Transaction][] = [
      ['recategorised', (tx) => changeCategory(tx, OFFICE)],
      ['made private', (tx) => setPrivate(tx, true)],
      ['no receipt needed', markNoReceiptNeeded],
      ['confirmed', (tx) => ({ ...tx, confirmed: true, history: [{ date: '2026-10-22', key: 'confirmed', params: { category: 'utilities' } }, ...tx.history] })],
      ['linked by hand', (tx) => ({ ...tx, history: [{ date: '2026-10-22', key: 'receiptLinked', params: { name: 'Beleg' } }, ...tx.history] })],
    ];
    for (const [label, edit] of edits) {
      const worked = change(b, record.paymentIds[0], edit);
      expect(undoBlockedBy(worked, record, NOTHING_CLOSED), label).toBe('worked');
      expect(canUndoImport(worked, record, NOTHING_CLOSED), label).toBe(false);
    }
  });

  it('is worked when a rule booked a payment after the import, but not for the rule line the import wrote itself', () => {
    const { b, record } = imported();
    const laterRule = change(b, record.paymentIds[0], (tx) => ({
      ...tx,
      history: [{ date: '2026-10-22', key: 'bookedByRule', params: { category: 'office' } }, ...tx.history],
    }));
    expect(undoBlockedBy(laterRule, record, NOTHING_CLOSED)).toBe('worked');

    const bare = statement({ meta: statement().meta.map((m) => ({ ...m, booking: null })) });
    const ruled = business({ categoryRules: [{ counterpartyKey: 'stadtwerke hamburg', booking: OFFICE }] });
    const built = importTransactions(ruled, SPARKASSE.id, previewImport(ruled, readRows(bare, MINUS).rows, NOTHING_CLOSED), bare, 'imp-1');
    expect(built[0].history.map((h) => h.key)).toEqual(['bookedByRule', 'imported']);
    expect(undoBlockedBy(business({ transactions: built }), imp(built.map((t) => t.id)), NOTHING_CLOSED)).toBeNull();
  });

  it('an automatic match of a receipt or an invoice is not work: undo takes those links back', () => {
    const { b, record } = imported();
    const matched = change(change(b, record.paymentIds[0], (tx) => ({
      ...tx,
      receipt: 'attached',
      history: [{ date: '2026-10-22', key: 'receiptLinkedAuto', params: { name: 'Beleg' } }, ...tx.history],
    })), record.paymentIds[1], (tx) => ({
      ...tx,
      history: [
        { date: '2026-10-22', key: 'bookedByInvoice', params: { category: 'revenue7', auto: 'true' } },
        { date: '2026-10-22', key: 'paysInvoice', params: { number: 'RE-2026-004', auto: 'true' } },
        ...tx.history,
      ],
    }));
    expect(undoBlockedBy(matched, record, NOTHING_CLOSED)).toBeNull();
  });

  it('an invoice match the person confirmed by hand is work: the same lines without auto block undo', () => {
    const { b, record } = imported();
    const handLines: [string, HistoryEntry[]][] = [
      ['paysInvoice', [{ date: '2026-10-22', key: 'paysInvoice', params: { number: 'RE-2026-004' } }]],
      [
        'bookedByInvoice and paysInvoice',
        [
          { date: '2026-10-22', key: 'bookedByInvoice', params: { category: 'revenue7' } },
          { date: '2026-10-22', key: 'paysInvoice', params: { number: 'RE-2026-004' } },
        ],
      ],
      [
        'only one of the two marked auto',
        [
          { date: '2026-10-22', key: 'bookedByInvoice', params: { category: 'revenue7', auto: 'true' } },
          { date: '2026-10-22', key: 'paysInvoice', params: { number: 'RE-2026-004' } },
        ],
      ],
    ];
    for (const [label, lines] of handLines) {
      const confirmed = change(b, record.paymentIds[1], (tx) => ({ ...tx, history: [...lines, ...tx.history] }));
      expect(undoBlockedBy(confirmed, record, NOTHING_CLOSED), label).toBe('worked');
      expect(canUndoImport(confirmed, record, NOTHING_CLOSED), label).toBe(false);
    }
  });

  it('only auto: "true" makes an invoice line automatic', () => {
    const { b, record } = imported();
    const marked = (auto: string) =>
      change(b, record.paymentIds[1], (tx) => ({
        ...tx,
        history: [{ date: '2026-10-22', key: 'paysInvoice', params: { number: 'RE-2026-004', auto } }, ...tx.history],
      }));
    expect(undoBlockedBy(marked('true'), record, NOTHING_CLOSED)).toBeNull();
    expect(undoBlockedBy(marked('false'), record, NOTHING_CLOSED)).toBe('worked');
    expect(undoBlockedBy(marked(''), record, NOTHING_CLOSED)).toBe('worked');
  });

  it('is closed when one of its payments sits in a closed month', () => {
    const { b, record } = imported();
    expect(undoBlockedBy(b, record, (month) => month === '2026-10')).toBe('closed');
    expect(undoBlockedBy(b, record, (month) => month === '2026-09')).toBeNull();
    expect(canUndoImport(b, record, (month) => month === '2026-10')).toBe(false);
  });

  it('says worked before closed when both are so', () => {
    const { b, record } = imported();
    const worked = change(b, record.paymentIds[0], (tx) => changeCategory(tx, OFFICE));
    expect(undoBlockedBy(worked, record, (month) => month === '2026-10')).toBe('worked');
  });

  it('ignores payments that are no longer in the business', () => {
    const { b, record } = imported();
    const gone = { ...b, transactions: b.transactions.slice(1) };
    expect(undoBlockedBy(gone, record, NOTHING_CLOSED)).toBeNull();
  });
});

describe('statementText', () => {
  it('writes a CSV file with the header and the cells, separated by semicolons', () => {
    expect(statementText(statement())).toBe(
      [
        'Buchungstag;Name;Verwendungszweck;Betrag',
        '01.10.2026;Stadtwerke Hamburg;Strom Oktober;-287,40',
        '05.10.2026;Kartenumsätze SumUp;Umsatz Oktober;1.284,50',
        '07.10.2026;Kontoführung;Entgelt;-12,90',
        '32.10.2026;Kaputt;Kein Datum;5,00',
        '',
      ].join('\n'),
    );
  });

  it('quotes a cell that holds a semicolon or a quote', () => {
    const text = statementText(statement({ header: ['A', 'B'], cells: [['a;b', 'say "hi"']] }));
    expect(text).toBe('A;B\n"a;b";"say ""hi"""\n');
  });

  it('writes a CAMT file as a small XML with one entry per readable row', () => {
    const camt = statement({
      fileName: 'volksbank-oktober.xml',
      format: 'camt',
      bankLabel: null,
      cells: [
        ['15.10.2026', 'Druckerei Mayer & Söhne', 'Rechnung <4711>', '-142,80'],
        ['16.10.2026', 'Kunde AG', 'Rechnung RE-2026-004', '1.190,00'],
        ['99.10.2026', 'Kaputt', 'x', '1,00'],
      ],
    });
    const xml = statementText(camt);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('camt.053');
    expect(xml.match(/<Ntry>/g)).toHaveLength(2);
    expect(xml).toContain('<Amt Ccy="EUR">142.80</Amt>');
    expect(xml).toContain('<CdtDbtInd>DBIT</CdtDbtInd>');
    expect(xml).toContain('<CdtDbtInd>CRDT</CdtDbtInd>');
    expect(xml).toContain('<Dt>2026-10-15</Dt>');
    expect(xml).toContain('Druckerei Mayer &amp; Söhne');
    expect(xml).toContain('Rechnung &lt;4711&gt;');
    expect(xml).not.toContain('Kaputt');
  });
});
