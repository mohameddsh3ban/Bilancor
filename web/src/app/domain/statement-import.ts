import { CATEGORIES } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, ColumnMapping, ColumnRole, HistoryEntry, SampleStatement, StatementImport, Transaction } from '../data/models';
import { parseDocAmount } from './amount-input';
import { applyRuleToUnclear, counterpartyKey } from './category-rules';

// Importing a bank statement: reading a file's raw cells into payments, skipping what the app has already, and the rule
// for when an import can still be undone. The mockup reads no real file: a `SampleStatement` stands in for it, and says
// per row what the demo's automatic booking would have decided (`RowMeta`). Pure functions. Dates are ISO dates, months
// are 'YYYY-MM', and a closed month is told by the `isClosed` function the caller passes (Reports' rule, see `isClosedDate`).

// --- cells: dates and amounts as German bank files write them ---

const DAY_FIRST = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A date as a statement writes it (`dd.mm.yyyy`, `dd.mm.yy` meaning 20yy, or `yyyy-mm-dd`) as an ISO date; null for text that is no date, or a day that does not exist. */
export function parseStatementDate(text: string): string | null {
  const trimmed = text.trim();
  const dayFirst = DAY_FIRST.exec(trimmed);
  const iso = dayFirst ? null : ISO_DAY.exec(trimmed);
  const parts = dayFirst
    ? { year: dayFirst[3].length === 2 ? 2000 + Number(dayFirst[3]) : Number(dayFirst[3]), month: Number(dayFirst[2]), day: Number(dayFirst[1]) }
    : iso
      ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
      : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const real = date.getUTCFullYear() === parts.year && date.getUTCMonth() === parts.month - 1 && date.getUTCDate() === parts.day;
  return real ? date.toISOString().slice(0, 10) : null;
}

/**
 * An amount as a statement writes it as signed cents: `-1.234,56`, `1234,56`, `1.234,56 €` and `−12,00` (a true minus, U+2212)
 * all read. The number itself is read as a document amount is (`parseDocAmount`), so null for text and for an amount of nothing.
 */
export function parseStatementAmount(text: string): number | null {
  const plain = text.replace(/−/g, '-').replace(/[\s€]/g, '');
  const negative = plain.startsWith('-');
  const cents = parseDocAmount(negative ? plain.slice(1) : plain);
  return cents === null ? null : negative ? -cents : cents;
}

// --- columns: which one holds what ---

type Meaning = Exclude<ColumnRole, 'ignore'>;

/** Header words of each meaning, lowercase, best first: the first word that a free column's header contains decides. */
const HEADER_WORDS: Record<Meaning, string[]> = {
  date: ['buchungstag', 'buchungsdatum', 'datum', 'date', 'wertstellung', 'valuta'],
  amount: ['betrag', 'amount', 'haben', 'gutschrift', 'credit', 'money in'],
  amountOut: ['soll', 'belastung', 'debit', 'ausgaben', 'money out'],
  who: ['empfänger', 'empfaenger', 'auftraggeber', 'zahlungsbeteiligte', 'begünstigte', 'beguenstigte', 'partner', 'name', 'counterparty', 'payee'],
  purpose: ['verwendungszweck', 'reference', 'referenz', 'zweck', 'buchungstext', 'text', 'description', 'beschreibung', 'purpose'],
};

/** A header that stands for the account behind a name, not the name. A header with both Soll and Haben marks a debit/credit flag, not an amount. */
const isFlagOrAccount = (header: string): boolean => /iban|bic/.test(header) || (header.includes('soll') && header.includes('haben'));

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,}$/;
const AMOUNT_SHAPE = /[.,]\d{2}$/;

/** Whether a cell looks like an amount: a number that ends in two decimals, and is not a date. */
const looksLikeAmount = (cell: string): boolean => AMOUNT_SHAPE.test(cell.replace(/[\s€]/g, '')) && parseStatementDate(cell) === null && parseStatementAmount(cell) !== null;

/** Whether every cell of a column is plain text a person could read as a name or a purpose: no date, amount or IBAN, and some real words. */
const looksLikeText = (cells: string[]): boolean =>
  cells.every((cell) => !IBAN_SHAPE.test(cell) && parseStatementDate(cell) === null && !looksLikeAmount(cell)) && cells.some((cell) => /\p{L}{3}/u.test(cell));

/**
 * The columns as the file most likely means them. Each column is read from its header first (German or English words, see
 * `HEADER_WORDS`); a meaning no header names is then taken from the first free column whose cells look like it (dates, amounts,
 * text), who before purpose. Every meaning goes to one column only, and the rest are `ignore`. A Soll or Belastung column
 * makes money out its own column; otherwise it is shown with a minus sign. The result may not be complete (see `mappingComplete`).
 */
export function guessMapping(statement: SampleStatement): ColumnMapping {
  const width = Math.max(statement.header.length, ...statement.cells.map((cells) => cells.length));
  const roles = Array.from({ length: width }, (): ColumnRole => 'ignore');
  const headers = statement.header.map((header) => header.toLowerCase());
  const order: Meaning[] = ['date', 'amount', 'amountOut', 'who', 'purpose'];

  for (const role of order) {
    for (const word of HEADER_WORDS[role]) {
      const at = headers.findIndex((header, i) => roles[i] === 'ignore' && header.includes(word) && !isFlagOrAccount(header));
      if (at !== -1) {
        roles[at] = role;
        break;
      }
    }
  }

  const fill = (role: Meaning, fits: (cells: string[]) => boolean): void => {
    if (roles.includes(role)) return;
    const at = roles.findIndex((current, i) => {
      if (current !== 'ignore') return false;
      const cells = statement.cells.map((row) => (row[i] ?? '').trim()).filter((cell) => cell !== '');
      return cells.length > 0 && fits(cells);
    });
    if (at !== -1) roles[at] = role;
  };
  fill('date', (cells) => cells.every((cell) => parseStatementDate(cell) !== null));
  fill('amount', (cells) => cells.every(looksLikeAmount));
  fill('who', looksLikeText);
  fill('purpose', looksLikeText);

  return { roles, moneyOut: roles.includes('amountOut') ? 'column' : 'minus' };
}

/** Whether the mapping gives a statement what a payment needs: a date, a name and an amount (and the out column when money out has its own). */
export function mappingComplete(mapping: ColumnMapping): boolean {
  const has = (role: ColumnRole): boolean => mapping.roles.includes(role);
  return has('date') && has('who') && has('amount') && (mapping.moneyOut !== 'column' || has('amountOut'));
}

// --- rows: reading, previewing and importing ---

/** One readable row of a statement; `index` is its place among the file's rows, so `meta[index]` says what the demo decided for it. */
export interface StatementRow { index: number; date: string; amountCents: number; counterparty: string; reference: string }

/**
 * The rows the mapping can read, and how many it can't: a date, an amount or a name that cannot be read makes a row
 * unreadable, and it is not imported. With its own money-out column a filled out cell makes the row negative (whatever sign it
 * has); an empty one leaves the amount column as it is. If a role is given to more than one column, the first column counts.
 * A mapping that is not complete (see `mappingComplete`) reads no row, so all of them are unreadable.
 */
export function readRows(statement: SampleStatement, mapping: ColumnMapping): { rows: StatementRow[]; unreadable: number } {
  if (!mappingComplete(mapping)) return { rows: [], unreadable: statement.cells.length };
  const column = (role: ColumnRole): number => mapping.roles.indexOf(role);
  const [dateAt, amountAt, outAt, whoAt, purposeAt] = (['date', 'amount', 'amountOut', 'who', 'purpose'] as const).map(column);
  const cellAt = (cells: string[], at: number): string => (at === -1 ? '' : (cells[at] ?? '').trim());

  const rows: StatementRow[] = [];
  let unreadable = 0;
  statement.cells.forEach((cells, index) => {
    const out = mapping.moneyOut === 'column' ? parseStatementAmount(cellAt(cells, outAt)) : null;
    const date = parseStatementDate(cellAt(cells, dateAt));
    const amountCents = out !== null ? -Math.abs(out) : parseStatementAmount(cellAt(cells, amountAt));
    const counterparty = cellAt(cells, whoAt);
    if (date === null || amountCents === null || counterparty === '') {
      unreadable += 1;
      return;
    }
    rows.push({ index, date, amountCents, counterparty, reference: cellAt(cells, purposeAt) });
  });
  return { rows, unreadable };
}

/** What a row of the file turns into: a new payment, one the app has already, or one in a month that is closed (not imported). */
export type RowState = 'new' | 'duplicate' | 'closedMonth';
/** A row with its state, and the id of the payment it matches when it is a duplicate. */
export interface PreviewRow extends StatementRow { state: RowState; duplicateOf: string | null }
export interface ImportPreview {
  rows: PreviewRow[]; newCount: number; duplicateCount: number; closedCount: number;
  unreadable: number; // the rows the mapping could not read (see `readRows`)
  from: string | null; to: string | null; // the first and last date of the rows, null with no rows
}

/** A name or reference compared without case, extra spaces, a trailing full stop or the difference between ü and ue. */
function textKey(text: string): string {
  return counterpartyKey(text.toLowerCase().replace(/[äöüß]/g, (letter) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[letter] ?? letter));
}

/**
 * Whether a payment is the row's payment already: the same account (any account when `accountId` is null), the same date and
 * amount, and the same name or the same reference (never two empty ones). Names and references read alike without case, extra
 * spaces or umlauts (Müller = MUELLER).
 */
export function isDuplicate(row: StatementRow, tx: Transaction, accountId: string | null): boolean {
  if ((accountId !== null && tx.accountId !== accountId) || tx.date !== row.date || tx.amountCents !== row.amountCents) return false;
  const name = textKey(row.counterparty);
  const reference = textKey(row.reference);
  return (name !== '' && name === textKey(tx.counterparty)) || (reference !== '' && reference === textKey(tx.reference));
}

/**
 * What importing these rows into the business would do. A row the business has already, in any of its accounts (see `isDuplicate`
 * with no account: the same payment turns up in the other account of its bank, or in the main account a demo connection filled), is
 * a duplicate, in a closed month too: it is here, so that is what it says. Each payment of the business matches one row only, so
 * two equal payments in a file stay two while the app has one of them. Any other row dated in a closed month (`isClosed` takes
 * 'YYYY-MM') is not imported, and the rest are new. `unreadable` is the number `readRows` could not read, carried into the preview.
 */
export function previewImport(
  business: Business,
  rows: StatementRow[],
  isClosed: (month: string) => boolean,
  unreadable = 0,
): ImportPreview {
  const matched = new Set<string>();
  const previewRows = rows.map((row): PreviewRow => {
    const same = business.transactions.find((tx) => !matched.has(tx.id) && isDuplicate(row, tx, null));
    if (same) {
      matched.add(same.id);
      return { ...row, state: 'duplicate', duplicateOf: same.id };
    }
    return { ...row, state: isClosed(row.date.slice(0, 7)) ? 'closedMonth' : 'new', duplicateOf: null };
  });
  const count = (state: RowState): number => previewRows.filter((row) => row.state === state).length;
  const dates = rows.map((row) => row.date).sort();
  return {
    rows: previewRows,
    newCount: count('new'),
    duplicateCount: count('duplicate'),
    closedCount: count('closedMonth'),
    unreadable,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
  };
}

/**
 * The payments an import adds: one for each new row (never a duplicate or a closed month's), with the id `<importId>-r<index>`.
 * The category, confirmation and receipt come from the row's `meta`, as the demo bank connection's payments have theirs; a row with a
 * category says it was booked automatically. A row without one takes the booking of the business's stored rule for its counterparty
 * (confirmed, with a "booked by your rule" line), else it stays unclear for the review inbox. Every payment says where it was
 * imported from (the account's name and the file). The business is not changed; the caller adds the payments.
 */
export function importTransactions(
  business: Business,
  accountId: string,
  preview: ImportPreview,
  statement: SampleStatement,
  importId: string,
): Transaction[] {
  const accountName = business.accounts.find((account) => account.id === accountId)?.name ?? accountId;
  const built = preview.rows
    .filter((row) => row.state === 'new')
    .map((row): Transaction => {
      const meta = statement.meta[row.index];
      const booking = CATEGORIES.find((category) => category.labelKey === meta.booking) ?? null;
      const history: HistoryEntry[] = [{ date: DEMO_TODAY, key: 'imported', params: { account: accountName, file: statement.fileName } }];
      if (booking) history.unshift({ date: DEMO_TODAY, key: 'autoBooked', params: { category: booking.labelKey } });
      return {
        id: `${importId}-r${row.index}`,
        date: row.date,
        counterparty: row.counterparty,
        accountId,
        amountCents: row.amountCents,
        booking,
        confirmed: booking !== null && meta.confirmed,
        isPrivate: false,
        receipt: meta.receipt,
        receiptFile: null,
        counterpartyIban: '',
        reference: row.reference,
        history,
        beforePrivate: null,
        beforeLink: null,
      };
    });
  return business.categoryRules.reduce((txs, rule) => applyRuleToUnclear(txs, rule, '').txs, built);
}

// --- undo ---

/**
 * Whether a line in front of the import's own lines is automatic matching, not the person's work: a receipt linked on its own
 * (`receiptLinkedAuto`), or an invoice matched on its own, which marks the payment's `paysInvoice` and `bookedByInvoice` lines with
 * the param `auto: 'true'` (see `DemoStateService.linkInvoicePayment`). The person confirming an invoice match writes the same lines
 * without it. Undoing the import takes the automatic links back.
 */
const isAutomatic = (line: HistoryEntry): boolean =>
  line.key === 'receiptLinkedAuto' || ((line.key === 'paysInvoice' || line.key === 'bookedByInvoice') && line.params['auto'] === 'true');

/**
 * Whether anything happened to an imported payment after the import built it. `importTransactions` writes `imported` as the last
 * line and, above it, `autoBooked` or `bookedByRule` for a booked payment; every action since added a line in front of those, so
 * a line in front that automatic matching does not write (see `isAutomatic`) is the person's work (answered, confirmed,
 * recategorised, made private, linked or matched to an invoice by hand, and so on).
 * One thing cannot be told apart by the lines: a rule booking an unclear payment later looks like the rule line the import wrote.
 * It does not block undo; the rule always goes with the person's own answer to another payment of that counterparty, and that
 * blocks it when it is in this import.
 */
function workedOn(tx: Transaction): boolean {
  const { history } = tx;
  const above = history.at(-2)?.key; // what sits above `imported`
  const importLines = history.at(-1)?.key !== 'imported' ? 0 : above === 'autoBooked' || above === 'bookedByRule' ? 2 : 1;
  return history.slice(0, history.length - importLines).some((line) => !isAutomatic(line));
}

/**
 * Why an import can't be undone, or null when it can. 'worked': one of its payments was changed since the import built it
 * (see `workedOn`); this is said before 'closed': one of its payments sits in a month that has been closed since (`isClosed`
 * takes 'YYYY-MM'). Payments the business no longer has are ignored.
 */
export function undoBlockedBy(
  business: Business,
  imp: StatementImport,
  isClosed: (month: string) => boolean,
): 'worked' | 'closed' | null {
  const ids = new Set(imp.paymentIds);
  const payments = business.transactions.filter((tx) => ids.has(tx.id));
  if (payments.some(workedOn)) return 'worked';
  if (payments.some((tx) => isClosed(tx.date.slice(0, 7)))) return 'closed';
  return null;
}

/** Whether an import can still be undone (see `undoBlockedBy`). */
export function canUndoImport(business: Business, imp: StatementImport, isClosed: (month: string) => boolean): boolean {
  return undoBlockedBy(business, imp, isClosed) === null;
}

// --- the original file, to download again ---

const csvField = (cell: string): string => (/[;"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);

const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char);

/** An amount without its sign as a CAMT file writes it: a decimal point, two decimals. */
const camtAmount = (cents: number): string => `${Math.trunc(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

/** A small CAMT.053 file with one entry per readable row; the other party is the creditor for money out and the debtor for money in. */
function camtText(statement: SampleStatement): string {
  const { rows } = readRows(statement, statement.mapping ?? guessMapping(statement));
  const entries = rows.flatMap((row) => {
    const party = row.amountCents < 0 ? 'Cdtr' : 'Dbtr';
    return [
      '      <Ntry>',
      `        <Amt Ccy="EUR">${camtAmount(row.amountCents)}</Amt>`,
      `        <CdtDbtInd>${row.amountCents < 0 ? 'DBIT' : 'CRDT'}</CdtDbtInd>`,
      `        <BookgDt><Dt>${row.date}</Dt></BookgDt>`,
      '        <NtryDtls><TxDtls>',
      `          <RltdPties><${party}><Nm>${escapeXml(row.counterparty)}</Nm></${party}></RltdPties>`,
      ...(row.reference === '' ? [] : [`          <RmtInf><Ustrd>${escapeXml(row.reference)}</Ustrd></RmtInf>`]),
      '        </TxDtls></NtryDtls>',
      '      </Ntry>',
    ];
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">',
    '  <BkToCstmrStmt>',
    '    <Stmt>',
    ...entries,
    '    </Stmt>',
    '  </BkToCstmrStmt>',
    '</Document>',
    '',
  ].join('\n');
}

/**
 * The text of the original file, for "Download the file": a CSV statement as its header and cells separated by semicolons (a
 * cell with a semicolon or quote is quoted), a CAMT statement as a small CAMT.053 XML made from its readable rows.
 */
export function statementText(statement: SampleStatement): string {
  if (statement.format === 'camt') return camtText(statement);
  return [statement.header, ...statement.cells].map((row) => `${row.map(csvField).join(';')}\n`).join('');
}
