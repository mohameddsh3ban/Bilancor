import { REVENUE_19, REVENUE_7, REVENUE_ABROAD, REVENUE_EU_RC, REVENUE_KU } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type {
  Account,
  Booking,
  Business,
  Doc,
  DocStatus,
  Invoice,
  InvoiceCustomer,
  InvoiceLine,
  InvoiceSeller,
  SetupSteps,
  TaxNote,
  TaxProfile,
  Transaction,
} from '../data/models';
import { addDays, connectionStatus } from './bank-connection';
import { docStatus, visibleDocuments } from './document-status';

export type InvoiceStatus = 'draft' | 'open' | 'overdue' | 'partlyPaid' | 'paid' | 'cancelled' | 'cancellation';
export type InvoiceFormat = 'pdf' | 'zugferd' | 'xrechnung';

/** The 27 member states of the EU (ISO 3166 alpha-2), Germany included. */
export const EU_COUNTRIES: readonly string[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

/** How many days a first reminder must be old before a formal reminder (Mahnung) is offered. */
export const REMINDER_GAP_DAYS = 7;

/** A draft has not been sent: no number yet, and its tax follows the tax details until it is sent. */
const isDraft = (invoice: Invoice): boolean => invoice.sentOn === null;

/** Whole cents, with a half cent rounded away from zero, so a cancellation invoice is exactly the negative of its original. */
function roundCents(value: number): number {
  // The tiny add keeps a product such as 100.49999999999999 (a half cent lost to floating point) on the half cent it should be.
  return value < 0 ? -Math.round(-value + 1e-9) : Math.round(value + 1e-9);
}

/** The seller's details as they are now: the address, email and bank account of the invoice details, and the tax number and VAT ID of the tax details. A sent invoice keeps a copy of them (see `invoiceSeller`). */
export function sellerOf(business: Business): InvoiceSeller {
  const { name, street, postcode, city, email, iban } = business.invoiceProfile;
  const { taxNumber, vatId } = business.taxProfile;
  return { name, street, postcode, city, email, iban, taxNumber, vatId };
}

/** The seller's details an invoice shows: a sent invoice keeps the ones it was sent with, a draft follows the business's details as they are now. */
export function invoiceSeller(invoice: Invoice, business: Business): InvoiceSeller {
  return invoice.seller ?? sellerOf(business);
}

/** The note an invoice to this customer carries instead of VAT: a Kleinunternehmer's § 19 note; reverse charge for a business in another EU country; "not taxable" for a business outside the EU; otherwise none. */
export function taxNoteFor(customer: InvoiceCustomer, profile: TaxProfile): TaxNote | null {
  if (profile.kleinunternehmer) return 'kleinunternehmer';
  if (customer.kind !== 'business' || customer.country === 'DE') return null;
  return EU_COUNTRIES.includes(customer.country) ? 'reverseCharge' : 'notTaxable';
}

/** The VAT rate the invoice is calculated with: a sent invoice keeps the rate it was sent with; a draft has 0 % whenever a note replaces VAT. */
export function effectiveVatRate(invoice: Invoice, profile: TaxProfile): 0 | 7 | 19 {
  if (!isDraft(invoice)) return invoice.vatRate;
  return taxNoteFor(invoice.customer, profile) !== null ? 0 : invoice.vatRate;
}

/** The note the invoice carries: a sent invoice keeps its own; a draft follows the tax details and the customer. */
export function effectiveTaxNote(invoice: Invoice, profile: TaxProfile): TaxNote | null {
  return isDraft(invoice) ? taxNoteFor(invoice.customer, profile) : invoice.taxNote;
}

/** The format of the invoice file: an XRechnung for a public office (always), a plain PDF from a Kleinunternehmer, to a customer abroad or to a private person, otherwise ZUGFeRD. */
export function invoiceFormat(customer: InvoiceCustomer, profile: TaxProfile): InvoiceFormat {
  if (customer.kind === 'public') return 'xrechnung';
  if (profile.kleinunternehmer || customer.country !== 'DE') return 'pdf';
  return customer.kind === 'business' ? 'zugferd' : 'pdf';
}

/** The format an invoice goes out in: `invoiceFormat`, but a sent invoice keeps the format it was sent in (it follows the tax note the invoice carries, which is frozen when it is sent, not today's tax details). */
export function invoiceFileFormat(invoice: Invoice, profile: TaxProfile): InvoiceFormat {
  return invoiceFormat(invoice.customer, { ...profile, kleinunternehmer: effectiveTaxNote(invoice, profile) === 'kleinunternehmer' });
}

export interface InvoiceTotals { lineNets: number[]; netCents: number; vatCents: number; grossCents: number }

/** The amounts of an invoice: each line rounded to a cent, the VAT on their sum rounded to a cent. A Kleinunternehmer's lines are the gross (VAT is 0). */
export function invoiceTotals(invoice: Invoice, profile: TaxProfile): InvoiceTotals {
  const lineNets = invoice.lines.map((line) => roundCents(line.quantity * line.unitPriceCents));
  const netCents = lineNets.reduce((sum, cents) => sum + cents, 0);
  const vatCents = roundCents((netCents * effectiveVatRate(invoice, profile)) / 100);
  return { lineNets, netCents, vatCents, grossCents: netCents + vatCents };
}

/** The day the invoice is due: its date plus the payment term. */
export function dueDateOf(invoice: Invoice): string {
  return addDays(invoice.issueDate, invoice.paymentTermDays);
}

/** What the payments linked to the invoice add up to, each counted by its size. A payment id the business does not have is ignored. */
export function paidCents(invoice: Invoice, business: Business): number {
  const byId = new Map(business.transactions.map((tx) => [tx.id, tx]));
  return invoice.paymentIds.reduce((sum, id) => sum + Math.abs(byId.get(id)?.amountCents ?? 0), 0);
}

/** What is still to be paid: the gross minus the payments, never below nothing (an overpayment leaves 0). */
export function leftCents(invoice: Invoice, business: Business): number {
  return Math.max(0, invoiceTotals(invoice, business.taxProfile).grossCents - paidCents(invoice, business));
}

/**
 * Where an invoice stands, decided in this order: a draft; a cancellation invoice; an invoice that was cancelled; paid
 * (the payments reach the gross); partly paid (some money came in); overdue (past its due date); otherwise open.
 */
export function invoiceStatus(invoice: Invoice, business: Business, today = DEMO_TODAY): InvoiceStatus {
  if (isDraft(invoice)) return 'draft';
  if (invoice.cancels !== null) return 'cancellation';
  if (invoice.cancelledBy !== null) return 'cancelled';
  const paid = paidCents(invoice, business);
  if (paid >= invoiceTotals(invoice, business.taxProfile).grossCents) return 'paid';
  if (paid > 0) return 'partlyPaid';
  return dueDateOf(invoice) < today ? 'overdue' : 'open';
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The next invoice number of the year: the business's pattern with the year in it and the running number one above the
 * highest one so far, in three digits. The numbers so far are those of the business's invoices and of its sent
 * documents (an invoice sent before the app, or added from a file); a number may be followed by a reference.
 */
export function nextInvoiceNumber(business: Business, year: string): string {
  const pattern = business.invoiceProfile.numberPattern;
  const source = pattern
    .split(/(\{YYYY\}|\{NNN\})/)
    .map((part) => (part === '{YYYY}' ? escapeRegExp(year) : part === '{NNN}' ? '(\\d+)' : escapeRegExp(part)))
    .join('');
  const known = new RegExp(`^${source}(?!\\d)`);
  const numbers = [
    ...business.invoices.map((invoice) => invoice.number ?? ''),
    ...business.documents.filter((doc) => doc.direction === 'sent').map((doc) => doc.invoiceNo),
  ];
  const highest = numbers.reduce((max, number) => {
    const match = known.exec(number.trim());
    return match ? Math.max(max, Number(match[1] ?? 0)) : max;
  }, 0);
  return pattern.replaceAll('{YYYY}', year).replaceAll('{NNN}', String(highest + 1).padStart(3, '0'));
}

export type ChecklistKey =
  | 'sellerAddress' | 'taxNumber' | 'customerName' | 'customerAddress' | 'customerEmail'
  | 'customerVatId' | 'leitwegId' | 'privateAbroad' | 'lines' | 'servicePeriod';
export interface ChecklistItem {
  key: ChecklistKey;
  ok: boolean;
  fixAt: 'settingsInvoice' | 'settingsTax' | 'customer' | 'lines' | 'dates';
}

const filled = (text: string | null): boolean => text !== null && text.trim() !== '';

function lineIsComplete(line: InvoiceLine): boolean {
  return filled(line.description) && line.quantity > 0 && line.unitPriceCents > 0;
}

function servicePeriodIsComplete(period: Invoice['servicePeriod']): boolean {
  return period.kind === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(period.date) : /^\d{4}-\d{2}$/.test(period.month);
}

/**
 * What an invoice needs before it can be sent (§ 14 UStG), only the items that apply to this invoice, each with whether it
 * is there and where to fix it. The tax number is there only once the tax step is done and the tax details hold a tax
 * number or a VAT ID. A private customer abroad is never ok: invoices abroad are for businesses only for now.
 */
export function invoiceChecklist(invoice: Invoice, business: Business, steps: SetupSteps): ChecklistItem[] {
  const seller = business.invoiceProfile;
  const tax = business.taxProfile;
  const customer = invoice.customer;
  const items: ChecklistItem[] = [
    { key: 'sellerAddress', ok: [seller.name, seller.street, seller.postcode, seller.city].every(filled), fixAt: 'settingsInvoice' },
    { key: 'taxNumber', ok: steps.tax && (filled(tax.taxNumber) || filled(tax.vatId)), fixAt: 'settingsTax' },
    { key: 'customerName', ok: filled(customer.name), fixAt: 'customer' },
    { key: 'customerAddress', ok: [customer.street, customer.postcode, customer.city, customer.country].every(filled), fixAt: 'customer' },
    { key: 'customerEmail', ok: filled(customer.email), fixAt: 'customer' },
  ];
  if (taxNoteFor(customer, tax) === 'reverseCharge') items.push({ key: 'customerVatId', ok: filled(customer.vatId), fixAt: 'customer' });
  if (customer.kind === 'public') items.push({ key: 'leitwegId', ok: filled(customer.leitwegId), fixAt: 'customer' });
  if (customer.kind === 'private' && customer.country !== 'DE') items.push({ key: 'privateAbroad', ok: false, fixAt: 'customer' });
  items.push(
    { key: 'lines', ok: invoice.lines.length > 0 && invoice.lines.every(lineIsComplete), fixAt: 'lines' },
    { key: 'servicePeriod', ok: servicePeriodIsComplete(invoice.servicePeriod), fixAt: 'dates' },
  );
  return items;
}

/** Whether the draft has everything it needs and can be sent. Only a draft can be sent. */
export function canSendInvoice(invoice: Invoice, business: Business, steps: SetupSteps): boolean {
  return isDraft(invoice) && invoiceChecklist(invoice, business, steps).every((item) => item.ok);
}

export type InvoiceRow =
  | { kind: 'invoice'; invoice: Invoice; status: InvoiceStatus }
  | { kind: 'file'; doc: Doc; status: 'open' | 'overdue' | 'paid' };

/** The row status of a sent document from a file: waiting is open, overdue and done keep their names. Any other status (still being read, a duplicate, something to check) is not a settled invoice yet. */
const FILE_ROW_STATUS: Partial<Record<DocStatus, 'open' | 'overdue' | 'paid'>> = {
  waiting: 'open',
  overdue: 'overdue',
  done: 'paid',
};

const NO_DUE_DATE = '9999-12-31'; // sorts after every real date

/** The day to sort a row by: when it is due (open and overdue rows) or when it was issued (the rest). */
function rowDate(row: InvoiceRow, by: 'due' | 'issued'): string {
  if (row.kind === 'invoice') return by === 'due' ? dueDateOf(row.invoice) : row.invoice.issueDate;
  return by === 'due' ? (row.doc.dueDate ?? NO_DUE_DATE) : (row.doc.date ?? row.doc.addedOn);
}

const rowNumber = (row: InvoiceRow): string => (row.kind === 'invoice' ? (row.invoice.number ?? '') : row.doc.invoiceNo);

/** Drafts first, then overdue, then open and partly paid, then everything else. */
function rowGroup(row: InvoiceRow): number {
  if (row.status === 'draft') return 0;
  if (row.status === 'overdue') return 1;
  return row.status === 'open' || row.status === 'partlyPaid' ? 2 : 3;
}

function compareRows(a: InvoiceRow, b: InvoiceRow): number {
  const group = rowGroup(a) - rowGroup(b);
  if (group !== 0) return group;
  const byDue = rowGroup(a) === 1 || rowGroup(a) === 2; // oldest due date first; the others, newest first
  const [dateA, dateB] = byDue ? [rowDate(a, 'due'), rowDate(b, 'due')] : [rowDate(a, 'issued'), rowDate(b, 'issued')];
  if (dateA !== dateB) return byDue === dateA < dateB ? -1 : 1;
  const [numberA, numberB] = [rowNumber(a), rowNumber(b)];
  if (numberA === numberB) return 0;
  return byDue === numberA < numberB ? -1 : 1;
}

/**
 * The rows of the Invoices list, in order: drafts, overdue, open and partly paid by due date, then paid, cancelled and
 * cancellation invoices, newest first. Drafts always show. A sent invoice shows when its document is one the business shows
 * (see visibleDocuments); a sent document from a file shows as a row of its own, unless it is a cash-register closing
 * (a payment on a cash account) or is not a settled document yet.
 */
export function invoiceRows(business: Business, steps: SetupSteps, today = DEMO_TODAY): InvoiceRow[] {
  const visible = visibleDocuments(business.documents, steps);
  const visibleIds = new Set(visible.map((doc) => doc.id));
  const cashAccounts = new Set(business.accounts.filter((account) => account.kind === 'cash').map((account) => account.id));
  const onCash = new Set(business.transactions.filter((tx) => cashAccounts.has(tx.accountId)).map((tx) => tx.id));
  const rows: InvoiceRow[] = [];
  for (const invoice of business.invoices) {
    const status = invoiceStatus(invoice, business, today);
    if (status === 'draft' || (invoice.docId !== null && visibleIds.has(invoice.docId))) rows.push({ kind: 'invoice', invoice, status });
  }
  for (const doc of visible) {
    if (doc.direction !== 'sent' || doc.invoice !== null) continue;
    if (doc.paymentId !== null && onCash.has(doc.paymentId)) continue;
    const status = FILE_ROW_STATUS[docStatus(doc, today)];
    if (status) rows.push({ kind: 'file', doc, status });
  }
  return rows.sort(compareRows);
}

/** The row of the invoice written here with this id, as the list shows it. None for an unknown id, a document from a file, or an invoice the list does not show in this setup state. */
export function invoiceRowOf(
  business: Business,
  steps: SetupSteps,
  id: string,
  today = DEMO_TODAY,
): Extract<InvoiceRow, { kind: 'invoice' }> | null {
  for (const row of invoiceRows(business, steps, today)) {
    if (row.kind === 'invoice' && row.invoice.id === id) return row;
  }
  return null;
}

export interface OwedSummary { owedCents: number; owedCount: number; overdueCents: number; overdueCount: number }

/**
 * What customers still owe, over the rows the list shows: what is left of the open, overdue and partly paid invoices
 * and the amount of the waiting and overdue sent documents from files. The overdue part is what is past its due date,
 * also on a partly paid invoice.
 */
export function owedSummary(business: Business, steps: SetupSteps, today = DEMO_TODAY): OwedSummary {
  const summary: OwedSummary = { owedCents: 0, owedCount: 0, overdueCents: 0, overdueCount: 0 };
  for (const row of invoiceRows(business, steps, today)) {
    let cents: number;
    let late: boolean;
    if (row.kind === 'invoice') {
      if (row.status !== 'open' && row.status !== 'overdue' && row.status !== 'partlyPaid') continue;
      cents = leftCents(row.invoice, business);
      late = dueDateOf(row.invoice) < today;
    } else {
      if (row.status === 'paid') continue;
      cents = row.doc.amountCents ?? 0;
      late = row.status === 'overdue';
    }
    summary.owedCents += cents;
    summary.owedCount += 1;
    if (late) {
      summary.overdueCents += cents;
      summary.overdueCount += 1;
    }
  }
  return summary;
}

/** Whether an invoice is owed and past its due date: overdue, or part paid and past it. */
function isLate(invoice: Invoice, business: Business, today: string): boolean {
  const status = invoiceStatus(invoice, business, today);
  return status === 'overdue' || (status === 'partlyPaid' && dueDateOf(invoice) < today);
}

/**
 * Which reminder can be sent now, for an invoice that is past its due date (a partly paid one included): level 1 while
 * none was sent, level 2 once the first is `REMINDER_GAP_DAYS` old. Before that, `next` is null and `availableFrom` is the day
 * level 2 becomes possible. After level 2, and for an invoice that is not overdue, both are null.
 */
export function reminderState(invoice: Invoice, business: Business, today = DEMO_TODAY): { next: 1 | 2 | null; availableFrom: string | null } {
  const none = { next: null, availableFrom: null };
  if (!isLate(invoice, business, today) || invoice.reminders.some((reminder) => reminder.level === 2)) return none;
  const first = invoice.reminders.find((reminder) => reminder.level === 1);
  if (!first) return { next: 1, availableFrom: null };
  const from = addDays(first.sentOn, REMINDER_GAP_DAYS);
  return from <= today ? { next: 2, availableFrom: null } : { next: null, availableFrom: from };
}

/**
 * What a late invoice says about its reminders: `next`, the reminder that can be sent now (see `reminderState`);
 * `lastSentOn`, the day the last one went out; `availableFrom`, the day the formal one becomes possible. Null when the
 * invoice is not late, or when there is nothing to send and nothing was sent.
 */
export function reminderSummary(
  invoice: Invoice,
  business: Business,
  today = DEMO_TODAY,
): { next: 1 | 2 | null; lastSentOn: string | null; availableFrom: string | null } | null {
  if (!isLate(invoice, business, today)) return null;
  const { next, availableFrom } = reminderState(invoice, business, today);
  const lastSentOn = invoice.reminders.reduce<string | null>(
    (latest, reminder) => (latest === null || reminder.sentOn > latest ? reminder.sentOn : latest),
    null,
  );
  return next === null && lastSentOn === null ? null : { next, lastSentOn, availableFrom };
}

/** The first bank account whose connection works (connected, or its consent ends soon), where a customer's payment can arrive. A statement account, the cash box and a connection that needs a new sign-in cannot receive one. */
export function receivingBank(business: Business, today = DEMO_TODAY): Account | null {
  return (
    business.accounts.find((account) => {
      const { kind } = connectionStatus(account, today);
      return account.kind === 'bank' && (kind === 'connected' || kind === 'renewSoon');
    }) ?? null
  );
}

/** The invoices a payment could be for: sent, not cancelled, with something left to pay. */
function openInvoices(business: Business): Invoice[] {
  return business.invoices.filter((invoice) => {
    const status = invoiceStatus(invoice, business);
    return status === 'open' || status === 'overdue' || status === 'partlyPaid';
  });
}

/**
 * The invoice an incoming payment with no receipt is probably for. Certain when its reference names exactly one open
 * invoice's number, whatever the amount (a part payment). Otherwise not certain, when exactly one open invoice has this
 * amount left. Money going out, a payment that has a receipt, and anything else give null.
 */
export function invoiceMatch(business: Business, tx: Transaction): { invoice: Invoice; certain: boolean } | null {
  if (tx.amountCents <= 0 || tx.receipt !== 'missing') return null;
  const open = openInvoices(business);
  const named = open.filter((invoice) => {
    if (invoice.number === null) return false;
    return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(invoice.number)}(?!\\d)`, 'i').test(tx.reference);
  });
  if (named.length === 1) return { invoice: named[0], certain: true };
  const sameAmount = open.filter((invoice) => leftCents(invoice, business) === tx.amountCents);
  return sameAmount.length === 1 ? { invoice: sameAmount[0], certain: false } : null;
}

/** The booking a payment for this invoice gets: by the invoice's tax note, otherwise by its VAT rate. */
export function revenueBookingFor(invoice: Invoice, profile: TaxProfile): Booking {
  switch (effectiveTaxNote(invoice, profile)) {
    case 'kleinunternehmer':
      return REVENUE_KU;
    case 'reverseCharge':
      return REVENUE_EU_RC;
    case 'notTaxable':
      return REVENUE_ABROAD;
    default:
      return effectiveVatRate(invoice, profile) === 7 ? REVENUE_7 : REVENUE_19;
  }
}

/**
 * The sent document of an invoice, as it appears on Documents when the invoice is sent: a file named after the number, to the
 * customer, with the gross amount (positive, also for a cancellation invoice, which has no due date), booked and confirmed.
 */
export function invoiceDocFor(invoice: Invoice, business: Business): Doc {
  const profile = business.taxProfile;
  const sentOn = invoice.sentOn ?? invoice.issueDate;
  const number = invoice.number ?? '';
  const role = invoice.cancels !== null ? 'cancellation' : 'invoice';
  return {
    id: invoice.docId ?? `doc-${invoice.id}`,
    fileName: `${number}.pdf`,
    source: 'file',
    addedOn: sentOn,
    fromUpload: true,
    reading: false,
    name: invoice.customer.name,
    direction: 'sent',
    invoiceNo: number,
    date: sentOn,
    dueDate: role === 'cancellation' ? null : dueDateOf(invoice),
    amountCents: Math.abs(invoiceTotals(invoice, profile).grossCents),
    vatRate: effectiveVatRate(invoice, profile),
    duplicateOf: null,
    booking: revenueBookingFor(invoice, profile),
    bookingConfirmed: true,
    paymentId: null,
    history: [{ date: sentOn, key: 'invoiceSent', params: { email: invoice.customer.email } }],
    invoice: { id: invoice.id, role, cancelled: invoice.cancelledBy !== null },
  };
}

/** The business's invoices, the most recent first (by invoice date, then number). */
function newestFirst(invoices: readonly Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || (b.number ?? '').localeCompare(a.number ?? ''));
}

/** The customers the business has invoiced, once each (by name and country), the most recent invoice first, with the details of that invoice. A draft with no customer name yet is left out. */
export function savedCustomers(business: Business): InvoiceCustomer[] {
  const seen = new Set<string>();
  const customers: InvoiceCustomer[] = [];
  for (const { customer } of newestFirst(business.invoices)) {
    const key = `${customer.name.trim().toLowerCase()}|${customer.country}`;
    if (!filled(customer.name) || seen.has(key)) continue;
    seen.add(key);
    customers.push(customer);
  }
  return customers;
}

/** The lines the business has written before, once each (by description), the most recent first, with the price of that time. Cancellation invoices and lines with no description are left out. */
export function earlierLines(business: Business): InvoiceLine[] {
  const seen = new Set<string>();
  const lines: InvoiceLine[] = [];
  for (const invoice of newestFirst(business.invoices)) {
    if (invoice.cancels !== null) continue;
    for (const line of invoice.lines) {
      const key = line.description.trim().toLowerCase();
      if (key === '' || seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
  }
  return lines;
}
