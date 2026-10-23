import { REVENUE_19, REVENUE_7, REVENUE_ABROAD, REVENUE_EU_RC, REVENUE_KU } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type {
  Account,
  Business,
  Doc,
  Invoice,
  InvoiceCustomer,
  InvoiceLine,
  InvoiceProfile,
  SetupSteps,
  TaxProfile,
  Transaction,
} from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  EU_COUNTRIES,
  REMINDER_GAP_DAYS,
  canSendInvoice,
  dueDateOf,
  earlierLines,
  effectiveTaxNote,
  effectiveVatRate,
  invoiceChecklist,
  invoiceDocFor,
  invoiceDocNote,
  invoiceFileFormat,
  invoiceFormat,
  invoiceMatch,
  invoiceOfPayment,
  invoiceRowOf,
  invoiceRows,
  invoiceSeller,
  invoiceStatus,
  invoiceTotals,
  leftCents,
  lineNetCents,
  nextInvoiceNumber,
  owedSummary,
  paidCents,
  receivingBank,
  reminderState,
  reminderSummary,
  revenueBookingFor,
  savedCustomers,
  sellerOf,
  taxNoteFor,
} from './invoices';

// --- fixtures: small, built here, so no sample data decides what a test means ---

const VAT: TaxProfile = {
  businessKind: 'freelance',
  kleinunternehmer: false,
  vatPeriod: 'monthly',
  permanentExtension: false,
  vatBasis: 'ist',
  taxState: 'berlin',
  taxNumber: '27/123/45678',
  vatId: null,
  fiscalYearStart: '01-01',
};
const KU: TaxProfile = { ...VAT, kleinunternehmer: true, vatPeriod: null, vatBasis: null };

const PROFILE: InvoiceProfile = {
  name: 'Weber Design',
  street: 'Lindenstr. 5',
  postcode: '10969',
  city: 'Berlin',
  email: 'weber-design@invoices.example',
  iban: 'DE08100101010482913650',
  numberPattern: 'RE-{YYYY}-{NNN}',
  paymentTermDays: 14,
  language: 'de',
};

const ALL_DONE: SetupSteps = { bank: true, tax: true, receipt: true };

const BANK: Account = {
  id: 'a-bank',
  kind: 'bank',
  name: 'Qonto',
  balanceCents: 0,
  lastUpdate: '2026-10-21',
  connection: { kind: 'connected', consentUntil: '2027-01-01', lastFetched: '2026-10-22T06:12', fetchFrom: '2026-01-01', broken: false },
  product: 'business',
  iban: 'DE08100101010482913650',
};
const CASH: Account = {
  id: 'a-cash',
  kind: 'cash',
  name: 'Cash box',
  balanceCents: 0,
  lastUpdate: '2026-10-14',
  connection: { kind: 'cash', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
  product: 'cash',
  iban: null,
};

const customer = (patch: Partial<InvoiceCustomer> = {}): InvoiceCustomer => ({
  name: 'Studio Kern',
  street: 'Kopenhagener Str. 4',
  postcode: '10437',
  city: 'Berlin',
  country: 'DE',
  email: 'buero@studio-kern.example',
  kind: 'business',
  vatId: null,
  leitwegId: null,
  ...patch,
});

const HOURS_AND_FLAT: InvoiceLine[] = [
  { description: 'Design work', quantity: 2, unit: 'hour', unitPriceCents: 8000 },
  { description: 'Logo', quantity: 1, unit: 'flat', unitPriceCents: 34000 },
];
const flat = (cents: number): InvoiceLine[] => [{ description: 'Service', quantity: 1, unit: 'flat', unitPriceCents: cents }];

/** A draft: no number, not sent, a business customer in Germany, 19 %, 14 days. */
const draft = (patch: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1',
  number: null,
  customer: customer(),
  lines: HOURS_AND_FLAT,
  vatRate: 19,
  taxNote: null,
  seller: null,
  language: 'de',
  issueDate: '2026-10-16',
  servicePeriod: { kind: 'month', month: '2026-10' },
  paymentTermDays: 14,
  sentOn: null,
  docId: null,
  paymentIds: [],
  reminders: [],
  cancelledBy: null,
  cancels: null,
  history: [],
  ...patch,
});

/** A sent invoice: number, sent on its issue date, its sent document `doc-<id>`, one flat line of the given net amount. */
const sent = (id: string, number: string, issueDate: string, netCents: number, patch: Partial<Invoice> = {}): Invoice =>
  draft({ id, number, issueDate, sentOn: issueDate, docId: `doc-${id}`, lines: flat(netCents), ...patch });

const payment = (id: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-10-20',
  counterparty: 'Studio Kern',
  accountId: BANK.id,
  amountCents,
  booking: REVENUE_19,
  confirmed: true,
  isPrivate: false,
  receipt: 'missing',
  receiptFile: null,
  counterpartyIban: 'DE68210501700012345678',
  reference: '',
  history: [],
  beforePrivate: null,
  beforeLink: null,
  ...patch,
});

const doc = (id: string, patch: Partial<Doc> = {}): Doc => ({
  id,
  fileName: `${id}.pdf`,
  source: 'file',
  addedOn: '2026-10-01',
  fromUpload: false,
  reading: false,
  name: 'Customer',
  direction: 'sent',
  invoiceNo: id,
  date: '2026-10-01',
  dueDate: null,
  amountCents: 10000,
  vatRate: 19,
  duplicateOf: null,
  booking: REVENUE_19,
  bookingConfirmed: true,
  paymentId: null,
  history: [],
  invoice: null,
  ...patch,
});

/** The sent document of an invoice written in the app. */
const invoiceDoc = (invoice: Invoice, patch: Partial<Doc> = {}): Doc =>
  doc(invoice.docId!, {
    invoiceNo: invoice.number!,
    fromUpload: true,
    invoice: { id: invoice.id, role: invoice.cancels !== null ? 'cancellation' : 'invoice', cancelled: invoice.cancelledBy !== null },
    ...patch,
  });

/** A business with only what a test gives it; whatever else a business has does not matter to the functions under test. */
const business = (patch: Partial<Business> = {}): Business => ({
  ...BUSINESSES[0],
  taxProfile: VAT,
  accounts: [BANK, CASH],
  transactions: [],
  documents: [],
  invoices: [],
  invoiceProfile: PROFILE,
  ...patch,
});

/** A business whose invoices all have their sent documents (made with `invoiceDoc`) and payments. */
const businessOf = (invoices: Invoice[], transactions: Transaction[] = [], docs: Doc[] = [], patch: Partial<Business> = {}): Business =>
  business({
    invoices,
    transactions,
    documents: [...invoices.filter((i) => i.docId !== null).map((i) => invoiceDoc(i)), ...docs],
    ...patch,
  });

// --- tax rules ---

describe('EU_COUNTRIES', () => {
  it('lists the 27 member states, Germany included, and not the UK, Switzerland or Norway', () => {
    expect(EU_COUNTRIES).toHaveLength(27);
    expect(new Set(EU_COUNTRIES).size).toBe(27);
    expect(EU_COUNTRIES).toContain('DE');
    expect(EU_COUNTRIES).toContain('FR');
    expect(EU_COUNTRIES).toContain('IE');
    for (const outside of ['GB', 'CH', 'NO', 'US']) expect(EU_COUNTRIES).not.toContain(outside);
  });
});

describe('lineNetCents', () => {
  it('is quantity times unit price, rounded to a cent, the amount invoiceTotals lists for the line', () => {
    const lines: InvoiceLine[] = [
      { description: 'A', quantity: 1.5, unit: 'hour', unitPriceCents: 3333 }, // 4999.5 -> 5000
      { description: 'B', quantity: 3, unit: 'piece', unitPriceCents: 1001 },
      { description: 'C', quantity: -2, unit: 'day', unitPriceCents: 4950 },
    ];
    expect(lines.map(lineNetCents)).toEqual([5000, 3003, -9900]);
    expect(invoiceTotals(draft({ lines }), VAT).lineNets).toEqual(lines.map(lineNetCents));
  });
});

describe('invoiceTotals', () => {
  it('2 h at 80.00 plus a flat 340.00 at 19 % is net 500.00, VAT 95.00 and gross 595.00', () => {
    expect(invoiceTotals(draft(), VAT)).toEqual({ lineNets: [16000, 34000], netCents: 50000, vatCents: 9500, grossCents: 59500 });
  });

  it('rounds each line to a cent, and the VAT of the net to a cent', () => {
    const lines: InvoiceLine[] = [
      { description: 'A', quantity: 1.5, unit: 'hour', unitPriceCents: 3333 }, // 4999.5 -> 5000
      { description: 'B', quantity: 3, unit: 'piece', unitPriceCents: 1001 }, // 3003
    ];
    const totals = invoiceTotals(draft({ lines }), VAT);
    expect(totals.lineNets).toEqual([5000, 3003]);
    expect(totals.netCents).toBe(8003);
    expect(totals.vatCents).toBe(1521); // 8003 x 19 % = 1520.57
    expect(totals.grossCents).toBe(9524);
  });

  it('uses the 7 % rate when the invoice has it', () => {
    const totals = invoiceTotals(draft({ vatRate: 7, lines: flat(10000) }), VAT);
    expect(totals).toMatchObject({ netCents: 10000, vatCents: 700, grossCents: 10700 });
  });

  it('a Kleinunternehmer charges no VAT: gross is the sum of the lines', () => {
    expect(invoiceTotals(draft({ vatRate: 19 }), KU)).toMatchObject({ netCents: 50000, vatCents: 0, grossCents: 50000 });
  });

  it('a sent invoice uses its own frozen rate, whatever the profile says now', () => {
    const frozen = sent('i', 'RE-2026-044', '2026-10-16', 10000, { vatRate: 19 });
    expect(invoiceTotals(frozen, KU)).toMatchObject({ vatCents: 1900, grossCents: 11900 });
  });

  it('a cancellation with negated lines is exactly the negative of the original, half cents included', () => {
    const original = draft({ lines: flat(1050) }); // VAT 199.5 -> 200
    const cancellation = draft({ lines: [{ description: 'Service', quantity: -1, unit: 'flat', unitPriceCents: 1050 }] });
    expect(invoiceTotals(original, VAT).vatCents).toBe(200);
    expect(invoiceTotals(cancellation, VAT)).toMatchObject({ netCents: -1050, vatCents: -200, grossCents: -1250 });
  });
});

describe('taxNoteFor, effectiveVatRate and effectiveTaxNote', () => {
  it('a Kleinunternehmer: rate 0 and the § 19 note, for any customer in Germany', () => {
    const invoice = draft({ vatRate: 19 });
    expect(taxNoteFor(customer(), KU)).toBe('kleinunternehmer');
    expect(taxNoteFor(customer({ kind: 'private' }), KU)).toBe('kleinunternehmer');
    expect(effectiveVatRate(invoice, KU)).toBe(0);
    expect(effectiveTaxNote(invoice, KU)).toBe('kleinunternehmer');
  });

  it('a business in Germany: no note, the chosen rate', () => {
    expect(taxNoteFor(customer(), VAT)).toBeNull();
    expect(effectiveVatRate(draft({ vatRate: 7 }), VAT)).toBe(7);
    expect(effectiveTaxNote(draft(), VAT)).toBeNull();
  });

  it('a private person in Germany and a public office: no note', () => {
    expect(taxNoteFor(customer({ kind: 'private' }), VAT)).toBeNull();
    expect(taxNoteFor(customer({ kind: 'public' }), VAT)).toBeNull();
  });

  it('a business in another EU country: rate 0 and reverse charge', () => {
    const abroad = customer({ country: 'FR', vatId: 'FR12345678901' });
    expect(taxNoteFor(abroad, VAT)).toBe('reverseCharge');
    expect(effectiveVatRate(draft({ customer: abroad }), VAT)).toBe(0);
    expect(effectiveTaxNote(draft({ customer: abroad }), VAT)).toBe('reverseCharge');
  });

  it('a business outside the EU: rate 0 and "not taxable"', () => {
    for (const country of ['GB', 'US', 'AE']) {
      const abroad = customer({ country });
      expect(taxNoteFor(abroad, VAT), country).toBe('notTaxable');
      expect(effectiveVatRate(draft({ customer: abroad }), VAT), country).toBe(0);
    }
  });

  it('a Kleinunternehmer abroad still carries the § 19 note only', () => {
    expect(taxNoteFor(customer({ country: 'FR' }), KU)).toBe('kleinunternehmer');
    expect(taxNoteFor(customer({ country: 'US' }), KU)).toBe('kleinunternehmer');
  });

  it('drafts follow the profile, sent invoices are frozen', () => {
    const asDraft = draft({ vatRate: 19, taxNote: null });
    expect(effectiveVatRate(asDraft, KU)).toBe(0);
    expect(effectiveTaxNote(asDraft, KU)).toBe('kleinunternehmer');
    const frozen = sent('i', 'RE-2026-044', '2026-10-16', 10000, { vatRate: 19, taxNote: null });
    expect(effectiveVatRate(frozen, KU)).toBe(19);
    expect(effectiveTaxNote(frozen, KU)).toBeNull();
    const frozenKu = sent('k', 'RE-2026-045', '2026-10-16', 10000, { vatRate: 0, taxNote: 'kleinunternehmer' });
    expect(effectiveVatRate(frozenKu, VAT)).toBe(0);
    expect(effectiveTaxNote(frozenKu, VAT)).toBe('kleinunternehmer');
  });
});

describe('invoiceFormat', () => {
  it('a business customer gets a ZUGFeRD invoice', () => {
    expect(invoiceFormat(customer(), VAT)).toBe('zugferd');
  });

  it('a private person gets a plain PDF', () => {
    expect(invoiceFormat(customer({ kind: 'private' }), VAT)).toBe('pdf');
  });

  it('a Kleinunternehmer sends a plain PDF to a business', () => {
    expect(invoiceFormat(customer(), KU)).toBe('pdf');
  });

  it('a customer abroad gets a plain PDF', () => {
    expect(invoiceFormat(customer({ country: 'FR', vatId: 'FR1' }), VAT)).toBe('pdf');
    expect(invoiceFormat(customer({ country: 'US' }), VAT)).toBe('pdf');
  });

  it('a public office gets an XRechnung, a Kleinunternehmer included', () => {
    const office = customer({ kind: 'public', leitwegId: '11001-01234-56' });
    expect(invoiceFormat(office, VAT)).toBe('xrechnung');
    expect(invoiceFormat(office, KU)).toBe('xrechnung');
  });
});

describe('invoiceFileFormat', () => {
  it('follows the tax details for a draft, as invoiceFormat does', () => {
    expect(invoiceFileFormat(draft(), VAT)).toBe('zugferd');
    expect(invoiceFileFormat(draft(), KU)).toBe('pdf');
    expect(invoiceFileFormat(draft({ customer: customer({ kind: 'public', leitwegId: '99-1' }) }), KU)).toBe('xrechnung');
  });

  it('a sent invoice keeps the format it was sent in, whatever the tax details say now', () => {
    const sentWithVat = sent('a', 'RE-2026-044', '2026-10-16', 100);
    expect(invoiceFileFormat(sentWithVat, KU)).toBe('zugferd');
    const sentAsKu = sent('b', 'RE-2026-045', '2026-10-16', 100, { vatRate: 0, taxNote: 'kleinunternehmer' });
    expect(invoiceFileFormat(sentAsKu, VAT)).toBe('pdf');
  });
});

describe('sellerOf and invoiceSeller', () => {
  const now = business({ taxProfile: { ...VAT, vatId: 'DE123456789' } });

  it('the seller is the invoice details with the tax number and VAT ID of the tax details', () => {
    expect(sellerOf(now)).toEqual({
      name: PROFILE.name,
      street: PROFILE.street,
      postcode: PROFILE.postcode,
      city: PROFILE.city,
      email: PROFILE.email,
      iban: PROFILE.iban,
      taxNumber: '27/123/45678',
      vatId: 'DE123456789',
    });
  });

  it('a draft follows the details of the business as they are now', () => {
    const changed = business({ invoiceProfile: { ...PROFILE, street: 'Neue Str. 1', iban: null }, taxProfile: { ...VAT, taxNumber: '11/222/33333' } });
    expect(invoiceSeller(draft(), now)).toEqual(sellerOf(now));
    expect(invoiceSeller(draft(), changed)).toMatchObject({ street: 'Neue Str. 1', iban: null, taxNumber: '11/222/33333' });
  });

  it('a sent invoice keeps the details it was sent with, whatever the business says now', () => {
    const wasSent = sent('a', 'RE-2026-044', '2026-10-16', 100, { seller: sellerOf(now) });
    const changed = business({ invoiceProfile: { ...PROFILE, name: 'Anderer Name', street: 'Neue Str. 1', iban: 'DE00' }, taxProfile: { ...VAT, taxNumber: null } });
    expect(invoiceSeller(wasSent, changed)).toEqual(sellerOf(now));
    expect(invoiceSeller(wasSent, changed)).not.toEqual(sellerOf(changed));
  });
});

describe('dueDateOf', () => {
  it('is the issue date plus the payment term', () => {
    expect(dueDateOf(draft({ issueDate: '2026-10-16', paymentTermDays: 14 }))).toBe('2026-10-30');
    expect(dueDateOf(draft({ issueDate: '2026-10-25', paymentTermDays: 14 }))).toBe('2026-11-08');
    expect(dueDateOf(draft({ issueDate: '2026-12-20', paymentTermDays: 30 }))).toBe('2027-01-19');
    expect(dueDateOf(draft({ issueDate: '2026-10-16', paymentTermDays: 0 }))).toBe('2026-10-16');
  });
});

// --- payments and status ---

describe('paidCents and leftCents', () => {
  const invoice = sent('i', 'RE-2026-044', '2026-10-16', 50000); // gross 59500

  it('nothing paid: nothing paid, everything left', () => {
    const b = businessOf([invoice]);
    expect(paidCents(invoice, b)).toBe(0);
    expect(leftCents(invoice, b)).toBe(59500);
  });

  it('sums the linked payments and ignores ids it cannot find', () => {
    const linked = { ...invoice, paymentIds: ['t1', 't2', 'gone'] };
    const b = businessOf([linked], [payment('t1', 20000), payment('t2', 10000), payment('other', 99999)]);
    expect(paidCents(linked, b)).toBe(30000);
    expect(leftCents(linked, b)).toBe(29500);
  });

  it('counts the size of a payment whichever way it is signed', () => {
    const linked = { ...invoice, paymentIds: ['t1'] };
    expect(paidCents(linked, businessOf([linked], [payment('t1', -20000)]))).toBe(20000);
  });

  it('an overpayment leaves nothing, never a negative amount', () => {
    const linked = { ...invoice, paymentIds: ['t1'] };
    const b = businessOf([linked], [payment('t1', 70000)]);
    expect(paidCents(linked, b)).toBe(70000);
    expect(leftCents(linked, b)).toBe(0);
  });

  it('works out the gross with the invoice own frozen rate', () => {
    const ku = sent('k', 'RE-2026-045', '2026-10-16', 50000, { vatRate: 0, taxNote: 'kleinunternehmer' });
    expect(leftCents(ku, business({ taxProfile: KU, invoices: [ku] }))).toBe(50000);
  });
});

describe('invoiceStatus', () => {
  const today = '2026-10-22';
  /** The invoice with one payment of the given size linked to it, and a business that has the payment. */
  const paidWith = (invoice: Invoice, cents: number): { invoice: Invoice; b: Business } => {
    const linked = { ...invoice, paymentIds: ['t1'] };
    return { invoice: linked, b: businessOf([linked], [payment('t1', cents)]) };
  };

  it('a draft is a draft, before anything else', () => {
    expect(invoiceStatus(draft(), business(), today)).toBe('draft');
    expect(invoiceStatus(draft({ cancels: 'x', cancelledBy: 'y' }), business(), today)).toBe('draft');
  });

  it('a cancellation invoice is a cancellation, even when it carries payments', () => {
    const { invoice, b } = paidWith(sent('c', 'RE-2026-042', '2026-10-07', -50000, { cancels: 'o' }), 59500);
    expect(invoiceStatus(invoice, b, today)).toBe('cancellation');
  });

  it('a cancelled invoice is cancelled, even when it was paid', () => {
    const { invoice, b } = paidWith(sent('o', 'RE-2026-040', '2026-10-01', 50000, { cancelledBy: 'c' }), 59500);
    expect(invoiceStatus(invoice, b, today)).toBe('cancelled');
  });

  it('paid when the payments reach the gross', () => {
    const { invoice, b } = paidWith(sent('i', 'RE-2026-044', '2026-10-01', 50000), 59500);
    expect(invoiceStatus(invoice, b, today)).toBe('paid');
  });

  it('paid beats overdue', () => {
    const { invoice, b } = paidWith(sent('i', 'RE-2026-044', '2026-09-01', 50000), 59500); // due 15 Sep
    expect(invoiceStatus(invoice, b, today)).toBe('paid');
  });

  it('partly paid when some money came in, even past the due date', () => {
    const old = paidWith(sent('i', 'RE-2026-044', '2026-09-01', 50000), 10000);
    expect(invoiceStatus(old.invoice, old.b, today)).toBe('partlyPaid');
    const current = paidWith(sent('j', 'RE-2026-045', '2026-10-16', 50000), 10000);
    expect(invoiceStatus(current.invoice, current.b, today)).toBe('partlyPaid');
  });

  it('overdue from the day after the due date (due 21 Oct, today 22 Oct)', () => {
    const invoice = sent('i', 'RE-2026-044', '2026-10-07', 50000);
    expect(dueDateOf(invoice)).toBe('2026-10-21');
    expect(invoiceStatus(invoice, businessOf([invoice]), today)).toBe('overdue');
  });

  it('open on the due date itself, and before it', () => {
    const dueToday = sent('i', 'RE-2026-044', '2026-10-08', 50000);
    expect(dueDateOf(dueToday)).toBe('2026-10-22');
    expect(invoiceStatus(dueToday, businessOf([dueToday]), today)).toBe('open');
    const later = sent('j', 'RE-2026-045', '2026-10-16', 50000);
    expect(invoiceStatus(later, businessOf([later]), today)).toBe('open');
  });

  it('overpayment stays paid with nothing left', () => {
    const { invoice, b } = paidWith(sent('i', 'RE-2026-044', '2026-10-01', 50000), 80000);
    expect(invoiceStatus(invoice, b, today)).toBe('paid');
    expect(leftCents(invoice, b)).toBe(0);
  });

  it('today is the demo date unless given', () => {
    const invoice = sent('i', 'RE-2026-044', '2026-10-07', 50000); // due 21 Oct
    expect(DEMO_TODAY).toBe('2026-10-22');
    expect(invoiceStatus(invoice, businessOf([invoice]))).toBe('overdue');
  });
});

// --- numbers ---

describe('nextInvoiceNumber', () => {
  it('after RE-2026-044 comes RE-2026-045', () => {
    const b = business({ invoices: [sent('a', 'RE-2026-043', '2026-10-01', 100), sent('b', 'RE-2026-044', '2026-10-16', 100), draft()] });
    expect(nextInvoiceNumber(b, '2026')).toBe('RE-2026-045');
  });

  it('another year starts at 001', () => {
    const b = business({ invoices: [sent('b', 'RE-2026-044', '2026-10-16', 100)] });
    expect(nextInvoiceNumber(b, '2027')).toBe('RE-2027-001');
  });

  it('a business with no invoice starts at 001', () => {
    expect(nextInvoiceNumber(business(), '2026')).toBe('RE-2026-001');
  });

  it('pads to three digits', () => {
    expect(nextInvoiceNumber(business({ invoices: [sent('a', 'RE-2026-009', '2026-10-01', 100)] }), '2026')).toBe('RE-2026-010');
  });

  it('counts the numbers of sent documents too, also when a reference follows the number', () => {
    const b = business({
      invoices: [sent('a', 'RE-2026-044', '2026-10-01', 100)],
      documents: [
        doc('d1', { invoiceNo: 'RE-2026-052' }),
        doc('d2', { invoiceNo: 'RE-2026-049, Sommerfest' }),
        doc('d3', { invoiceNo: 'RE-2025-099' }), // another year
        doc('d4', { invoiceNo: 'RE-2026-099', direction: 'received' }), // a supplier's number is not ours
        doc('d5', { invoiceNo: 'Rechnung 8841 0712' }),
      ],
    });
    expect(nextInvoiceNumber(b, '2026')).toBe('RE-2026-053');
  });

  it('reads every digit of the running number', () => {
    const b = business({ documents: [doc('d1', { invoiceNo: 'RE-2026-0441' })] });
    expect(nextInvoiceNumber(b, '2026')).toBe('RE-2026-442');
  });

  it('follows the pattern of the invoice profile', () => {
    const b = business({
      invoiceProfile: { ...PROFILE, numberPattern: 'R{YYYY}/{NNN}.x' },
      invoices: [sent('a', 'R2026/012.x', '2026-10-01', 100), sent('b', 'RE-2026-099', '2026-10-01', 100)],
    });
    expect(nextInvoiceNumber(b, '2026')).toBe('R2026/013.x');
  });

  it('a cancellation invoice takes a number of the same sequence', () => {
    const original = sent('a', 'RE-2026-040', '2026-10-01', 100, { cancelledBy: 'c' });
    const cancellation = sent('c', 'RE-2026-041', '2026-10-02', -100, { cancels: 'a' });
    expect(nextInvoiceNumber(business({ invoices: [original, cancellation] }), '2026')).toBe('RE-2026-042');
  });
});

// --- the checklist ---

describe('invoiceChecklist', () => {
  const keysOf = (items: { key: string }[]): string[] => items.map((i) => i.key);
  const itemOf = (items: ReturnType<typeof invoiceChecklist>, key: string) => items.find((i) => i.key === key);

  it('a complete invoice to a business in Germany: the seven items that apply, all ok, and it can be sent', () => {
    const invoice = draft();
    const b = business();
    const items = invoiceChecklist(invoice, b, ALL_DONE);
    expect(keysOf(items)).toEqual(['sellerAddress', 'taxNumber', 'customerName', 'customerAddress', 'customerEmail', 'lines', 'servicePeriod']);
    expect(items.every((i) => i.ok)).toBe(true);
    expect(canSendInvoice(invoice, b, ALL_DONE)).toBe(true);
  });

  it('says where each item is fixed', () => {
    const b = business();
    const items = invoiceChecklist(draft({ customer: customer({ country: 'FR' }) }), b, ALL_DONE);
    const where = Object.fromEntries(items.map((i) => [i.key, i.fixAt]));
    expect(where).toMatchObject({
      sellerAddress: 'settingsInvoice',
      taxNumber: 'settingsTax',
      customerName: 'customer',
      customerAddress: 'customer',
      customerEmail: 'customer',
      customerVatId: 'customer',
      lines: 'lines',
      servicePeriod: 'dates',
    });
  });

  it('names a missing seller address and tax number, and blocks sending', () => {
    const b = business({ invoiceProfile: { ...PROFILE, street: '' }, taxProfile: { ...VAT, taxNumber: null, vatId: null } });
    const items = invoiceChecklist(draft(), b, ALL_DONE);
    expect(itemOf(items, 'sellerAddress')).toMatchObject({ ok: false, fixAt: 'settingsInvoice' });
    expect(itemOf(items, 'taxNumber')).toMatchObject({ ok: false, fixAt: 'settingsTax' });
    expect(canSendInvoice(draft(), b, ALL_DONE)).toBe(false);
  });

  it('each part of the seller address is needed: name, street, postcode and town', () => {
    for (const missing of ['name', 'street', 'postcode', 'city'] as const) {
      const b = business({ invoiceProfile: { ...PROFILE, [missing]: '  ' } });
      expect(itemOf(invoiceChecklist(draft(), b, ALL_DONE), 'sellerAddress')?.ok, missing).toBe(false);
    }
  });

  it('the tax number is not ok while the tax step is not done, however complete the profile is', () => {
    const items = invoiceChecklist(draft(), business(), { ...ALL_DONE, tax: false });
    expect(itemOf(items, 'taxNumber')).toMatchObject({ ok: false, fixAt: 'settingsTax' });
  });

  it('a VAT ID is enough when there is no tax number', () => {
    const b = business({ taxProfile: { ...VAT, taxNumber: null, vatId: 'DE123456789' } });
    expect(itemOf(invoiceChecklist(draft(), b, ALL_DONE), 'taxNumber')?.ok).toBe(true);
  });

  it('names what is missing about the customer', () => {
    const empty = customer({ name: '', street: '', postcode: '', city: '', email: '' });
    const items = invoiceChecklist(draft({ customer: empty }), business(), ALL_DONE);
    expect(itemOf(items, 'customerName')?.ok).toBe(false);
    expect(itemOf(items, 'customerAddress')?.ok).toBe(false);
    expect(itemOf(items, 'customerEmail')?.ok).toBe(false);
  });

  it('the address needs street, postcode, town and country', () => {
    for (const missing of ['street', 'postcode', 'city', 'country'] as const) {
      const items = invoiceChecklist(draft({ customer: customer({ [missing]: ' ' }) }), business(), ALL_DONE);
      expect(itemOf(items, 'customerAddress')?.ok, missing).toBe(false);
    }
  });

  it('lines: at least one, each with a description, a quantity and a price', () => {
    const b = business();
    const lines = (l: InvoiceLine[]) => itemOf(invoiceChecklist(draft({ lines: l }), b, ALL_DONE), 'lines')?.ok;
    expect(lines([])).toBe(false);
    expect(lines([{ description: ' ', quantity: 1, unit: 'flat', unitPriceCents: 100 }])).toBe(false);
    expect(lines([{ description: 'x', quantity: 0, unit: 'flat', unitPriceCents: 100 }])).toBe(false);
    expect(lines([{ description: 'x', quantity: 1, unit: 'flat', unitPriceCents: 0 }])).toBe(false);
    expect(lines([...HOURS_AND_FLAT, { description: '', quantity: 1, unit: 'flat', unitPriceCents: 1 }])).toBe(false);
    expect(lines(HOURS_AND_FLAT)).toBe(true);
  });

  it('the service period needs a date or a month', () => {
    const b = business();
    const period = (p: Invoice['servicePeriod']) => itemOf(invoiceChecklist(draft({ servicePeriod: p }), b, ALL_DONE), 'servicePeriod')?.ok;
    expect(period({ kind: 'date', date: '2026-10-16' })).toBe(true);
    expect(period({ kind: 'month', month: '2026-10' })).toBe(true);
    expect(period({ kind: 'date', date: '' })).toBe(false);
    expect(period({ kind: 'month', month: '' })).toBe(false);
  });

  it('EU business abroad: rate 0, reverse charge, and the customer VAT ID is required', () => {
    const noId = draft({ customer: customer({ country: 'FR', vatId: null }) });
    const b = business({ taxProfile: { ...VAT, vatId: 'DE123456789' } });
    expect(itemOf(invoiceChecklist(noId, b, ALL_DONE), 'customerVatId')).toMatchObject({ ok: false, fixAt: 'customer' });
    expect(canSendInvoice(noId, b, ALL_DONE)).toBe(false);
    const withId = draft({ customer: customer({ country: 'FR', vatId: 'FR12345678901' }) });
    expect(itemOf(invoiceChecklist(withId, b, ALL_DONE), 'customerVatId')?.ok).toBe(true);
    expect(canSendInvoice(withId, b, ALL_DONE)).toBe(true);
  });

  it('a Kleinunternehmer abroad needs no customer VAT ID: it carries the § 19 note, not reverse charge', () => {
    const fr = draft({ customer: customer({ country: 'FR', vatId: null }) });
    expect(keysOf(invoiceChecklist(fr, business({ taxProfile: KU }), ALL_DONE))).not.toContain('customerVatId');
  });

  it('a business outside the EU needs no VAT ID', () => {
    const us = draft({ customer: customer({ country: 'US' }) });
    expect(keysOf(invoiceChecklist(us, business(), ALL_DONE))).not.toContain('customerVatId');
    expect(canSendInvoice(us, business(), ALL_DONE)).toBe(true);
  });

  it('a business in Germany is not asked for a VAT ID', () => {
    expect(keysOf(invoiceChecklist(draft(), business(), ALL_DONE))).not.toContain('customerVatId');
  });

  it('public office: the Leitweg-ID is required, also for a Kleinunternehmer', () => {
    const office = (leitwegId: string | null) => draft({ customer: customer({ kind: 'public', leitwegId }) });
    const b = business();
    expect(itemOf(invoiceChecklist(office(null), b, ALL_DONE), 'leitwegId')).toMatchObject({ ok: false, fixAt: 'customer' });
    expect(itemOf(invoiceChecklist(office(''), b, ALL_DONE), 'leitwegId')?.ok).toBe(false);
    expect(canSendInvoice(office(null), b, ALL_DONE)).toBe(false);
    expect(itemOf(invoiceChecklist(office('11001-01234-56'), b, ALL_DONE), 'leitwegId')?.ok).toBe(true);
    expect(canSendInvoice(office('11001-01234-56'), b, ALL_DONE)).toBe(true);
    const ku = business({ taxProfile: KU });
    expect(itemOf(invoiceChecklist(office(null), ku, ALL_DONE), 'leitwegId')?.ok).toBe(false);
  });

  it('other customers are not asked for a Leitweg-ID', () => {
    expect(keysOf(invoiceChecklist(draft(), business(), ALL_DONE))).not.toContain('leitwegId');
  });

  it("private abroad can't be sent", () => {
    const abroad = draft({ customer: customer({ kind: 'private', country: 'FR' }) });
    const items = invoiceChecklist(abroad, business(), ALL_DONE);
    expect(itemOf(items, 'privateAbroad')).toMatchObject({ ok: false, fixAt: 'customer' });
    expect(canSendInvoice(abroad, business(), ALL_DONE)).toBe(false);
  });

  it("a public office abroad can't be sent either: customers abroad are businesses only for now", () => {
    const abroad = draft({ customer: customer({ kind: 'public', country: 'AT', leitwegId: '99-1234-56' }) });
    const items = invoiceChecklist(abroad, business(), ALL_DONE);
    expect(itemOf(items, 'privateAbroad')).toMatchObject({ ok: false, fixAt: 'customer' });
    expect(canSendInvoice(abroad, business(), ALL_DONE)).toBe(false);
    // The same office in Germany is fine.
    const home = draft({ customer: customer({ kind: 'public', leitwegId: '99-1234-56' }) });
    expect(keysOf(invoiceChecklist(home, business(), ALL_DONE))).not.toContain('privateAbroad');
    expect(canSendInvoice(home, business(), ALL_DONE)).toBe(true);
  });

  it('a business abroad is not caught by the abroad item', () => {
    const us = draft({ customer: customer({ country: 'US' }) });
    expect(keysOf(invoiceChecklist(us, business(), ALL_DONE))).not.toContain('privateAbroad');
  });

  it('reverse charge: the seller needs a VAT ID of their own (§ 14a UStG), added in the tax settings', () => {
    const fr = draft({ customer: customer({ country: 'FR', vatId: 'FR12345678901' }) });
    const noId = business();
    expect(itemOf(invoiceChecklist(fr, noId, ALL_DONE), 'sellerVatId')).toMatchObject({ ok: false, fixAt: 'settingsTax' });
    expect(canSendInvoice(fr, noId, ALL_DONE)).toBe(false);

    const withId = business({ taxProfile: { ...VAT, vatId: 'DE123456789' } });
    expect(itemOf(invoiceChecklist(fr, withId, ALL_DONE), 'sellerVatId')).toMatchObject({ ok: true, fixAt: 'settingsTax' });
    expect(canSendInvoice(fr, withId, ALL_DONE)).toBe(true);

    // A blank ID is no ID, and the tax details only count once the tax step is done (like the tax number).
    const blank = business({ taxProfile: { ...VAT, vatId: '  ' } });
    expect(itemOf(invoiceChecklist(fr, blank, ALL_DONE), 'sellerVatId')?.ok).toBe(false);
    expect(itemOf(invoiceChecklist(fr, withId, { ...ALL_DONE, tax: false }), 'sellerVatId')?.ok).toBe(false);
  });

  it('the seller VAT ID is asked for under reverse charge only, and comes right after the tax number', () => {
    const withId = business({ taxProfile: { ...VAT, vatId: 'DE123456789' } });
    const fr = draft({ customer: customer({ country: 'FR', vatId: 'FR12345678901' }) });
    expect(keysOf(invoiceChecklist(fr, withId, ALL_DONE))).toEqual([
      'sellerAddress', 'taxNumber', 'sellerVatId', 'customerName', 'customerAddress', 'customerEmail', 'customerVatId', 'lines', 'servicePeriod',
    ]);
    const others: [string, Invoice, Business][] = [
      ['a customer in Germany', draft(), business()],
      ['a business outside the EU', draft({ customer: customer({ country: 'US' }) }), business()],
      ['a Kleinunternehmer', fr, business({ taxProfile: KU })],
      ['a private person', draft({ customer: customer({ kind: 'private' }) }), business()],
    ];
    for (const [name, invoice, b] of others) {
      expect(keysOf(invoiceChecklist(invoice, b, ALL_DONE)), name).not.toContain('sellerVatId');
    }
  });

  it('a private person in Germany is fine', () => {
    const home = draft({ customer: customer({ kind: 'private' }) });
    expect(keysOf(invoiceChecklist(home, business(), ALL_DONE))).not.toContain('privateAbroad');
    expect(canSendInvoice(home, business(), ALL_DONE)).toBe(true);
  });

  it('only a draft can be sent', () => {
    const invoice = sent('i', 'RE-2026-044', '2026-10-16', 50000);
    expect(canSendInvoice(invoice, business({ invoices: [invoice] }), ALL_DONE)).toBe(false);
  });
});

// --- reminders ---

describe('reminderState', () => {
  const today = '2026-10-22';
  const late = (patch: Partial<Invoice> = {}): Invoice => sent('i', 'RE-2026-039', '2026-09-16', 100000, patch); // due 30 Sep

  it('REMINDER_GAP_DAYS is 7', () => {
    expect(REMINDER_GAP_DAYS).toBe(7);
  });

  it('level 1 when overdue and none was sent', () => {
    const invoice = late();
    expect(reminderState(invoice, businessOf([invoice]), today)).toEqual({ next: 1, availableFrom: null });
  });

  it('level 2 once the first reminder is 7 days old', () => {
    const invoice = late({ reminders: [{ level: 1, sentOn: '2026-10-15' }] });
    expect(reminderState(invoice, businessOf([invoice]), today)).toEqual({ next: 2, availableFrom: null });
    const older = late({ reminders: [{ level: 1, sentOn: '2026-10-01' }] });
    expect(reminderState(older, businessOf([older]), today)).toEqual({ next: 2, availableFrom: null });
  });

  it('not yet level 2 before that: nothing to send, and the day it becomes possible', () => {
    const invoice = late({ reminders: [{ level: 1, sentOn: '2026-10-16' }] });
    expect(reminderState(invoice, businessOf([invoice]), today)).toEqual({ next: null, availableFrom: '2026-10-23' });
    const justSent = late({ reminders: [{ level: 1, sentOn: today }] });
    expect(reminderState(justSent, businessOf([justSent]), today)).toEqual({ next: null, availableFrom: '2026-10-29' });
  });

  it('nothing after level 2', () => {
    const invoice = late({ reminders: [{ level: 1, sentOn: '2026-10-01' }, { level: 2, sentOn: '2026-10-10' }] });
    expect(reminderState(invoice, businessOf([invoice]), today)).toEqual({ next: null, availableFrom: null });
  });

  it('nothing when the invoice is not overdue: open, paid, draft, cancelled', () => {
    const none = { next: null, availableFrom: null };
    const open = sent('o', 'RE-2026-044', '2026-10-16', 100000);
    expect(reminderState(open, businessOf([open]), today)).toEqual(none);
    const paid = late({ paymentIds: ['t1'] });
    expect(reminderState(paid, businessOf([paid], [payment('t1', 119000)]), today)).toEqual(none);
    expect(reminderState(draft(), business(), today)).toEqual(none);
    const cancelled = late({ cancelledBy: 'c' });
    expect(reminderState(cancelled, businessOf([cancelled]), today)).toEqual(none);
  });

  it('a partly paid invoice past its due date can be reminded', () => {
    const invoice = late({ paymentIds: ['t1'] });
    const b = businessOf([invoice], [payment('t1', 30000)]);
    expect(invoiceStatus(invoice, b, today)).toBe('partlyPaid');
    expect(reminderState(invoice, b, today)).toEqual({ next: 1, availableFrom: null });
  });

  it('a partly paid invoice before its due date cannot', () => {
    const invoice = sent('o', 'RE-2026-044', '2026-10-16', 100000, { paymentIds: ['t1'] });
    const b = businessOf([invoice], [payment('t1', 30000)]);
    expect(reminderState(invoice, b, today)).toEqual({ next: null, availableFrom: null });
  });
});

describe('reminderSummary', () => {
  const today = '2026-10-22';
  const late = (patch: Partial<Invoice> = {}): Invoice => sent('i', 'RE-2026-039', '2026-09-16', 100000, patch); // due 30 Sep

  it('says the next reminder to send on a late invoice nobody reminded', () => {
    const invoice = late();
    expect(reminderSummary(invoice, businessOf([invoice]), today)).toEqual({ next: 1, lastSentOn: null, availableFrom: null });
  });

  it('between the levels: when the first went out, and when the formal one becomes possible', () => {
    const invoice = late({ reminders: [{ level: 1, sentOn: '2026-10-18' }] });
    expect(reminderSummary(invoice, businessOf([invoice]), today)).toEqual({
      next: null,
      lastSentOn: '2026-10-18',
      availableFrom: '2026-10-25',
    });
  });

  it('level 2 on offer: the day of the first reminder is still said', () => {
    const invoice = late({ reminders: [{ level: 1, sentOn: '2026-10-12' }] });
    expect(reminderSummary(invoice, businessOf([invoice]), today)).toEqual({ next: 2, lastSentOn: '2026-10-12', availableFrom: null });
  });

  it('after the formal reminder: only the day of the last one', () => {
    const invoice = late({ reminders: [{ level: 1, sentOn: '2026-10-01' }, { level: 2, sentOn: '2026-10-10' }] });
    expect(reminderSummary(invoice, businessOf([invoice]), today)).toEqual({ next: null, lastSentOn: '2026-10-10', availableFrom: null });
  });

  it('a late invoice that is partly paid is summed up as well', () => {
    const invoice = late({ paymentIds: ['t1'], reminders: [{ level: 1, sentOn: '2026-10-12' }] });
    expect(reminderSummary(invoice, businessOf([invoice], [payment('t1', 30000)]), today)).toEqual({
      next: 2,
      lastSentOn: '2026-10-12',
      availableFrom: null,
    });
  });

  it('nothing for an invoice that is not late: open, paid, cancelled, draft', () => {
    const open = sent('o', 'RE-2026-044', '2026-10-16', 100000, { reminders: [{ level: 1, sentOn: '2026-10-01' }] });
    expect(reminderSummary(open, businessOf([open]), today)).toBeNull();
    const paid = late({ paymentIds: ['t1'], reminders: [{ level: 1, sentOn: '2026-10-01' }] });
    expect(reminderSummary(paid, businessOf([paid], [payment('t1', 119000)]), today)).toBeNull();
    const cancelled = late({ cancelledBy: 'c', reminders: [{ level: 1, sentOn: '2026-10-01' }] });
    expect(reminderSummary(cancelled, businessOf([cancelled]), today)).toBeNull();
    expect(reminderSummary(draft(), business(), today)).toBeNull();
  });
});

describe('receivingBank', () => {
  const today = '2026-10-22';
  const bank = (id: string, connection: Partial<Account['connection']>): Account => ({
    ...BANK,
    id,
    connection: { ...BANK.connection, ...connection },
  });

  it('is the first bank account whose connection works', () => {
    expect(receivingBank(business({ accounts: [BANK, CASH] }), today)).toBe(BANK);
  });

  it('a connection that ends soon still works', () => {
    const soon = bank('soon', { consentUntil: '2026-10-27' });
    expect(receivingBank(business({ accounts: [CASH, soon] }), today)).toBe(soon);
  });

  it('skips an account that needs a new sign-in, a statement account and the cash box', () => {
    const ended = bank('ended', { consentUntil: '2026-10-20' });
    const broken = bank('broken', { broken: true });
    const statement = bank('statement', { kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null });
    const works = bank('works', {});
    expect(receivingBank(business({ accounts: [CASH, ended, broken, statement, works] }), today)).toBe(works);
  });

  it('is none when no account works', () => {
    const ended = bank('ended', { consentUntil: '2026-10-20' });
    expect(receivingBank(business({ accounts: [CASH, ended] }), today)).toBeNull();
    expect(receivingBank(business({ accounts: [] }), today)).toBeNull();
  });
});

// --- matching a payment ---

describe('invoiceMatch', () => {
  const kern = sent('kern', 'RE-2026-044', '2026-10-16', 200000); // gross 238000
  const lange = sent('lange', 'RE-2026-039', '2026-09-16', 100000); // gross 119000, overdue
  const b = businessOf([kern, lange]);

  it('a reference that names the number is a certain match', () => {
    const tx = payment('t', 238000, { reference: 'Zahlung RE-2026-044, danke' });
    expect(invoiceMatch(b, tx)).toEqual({ invoice: kern, certain: true });
  });

  it('a reference naming the number matches whatever the amount (a part payment)', () => {
    const tx = payment('t', 50000, { reference: 'RE-2026-039' });
    expect(invoiceMatch(b, tx)).toEqual({ invoice: lange, certain: true });
  });

  it('only the amount: exactly one invoice has that much left, not certain', () => {
    const tx = payment('t', 238000, { reference: 'Danke für die Zusammenarbeit' });
    expect(invoiceMatch(b, tx)).toEqual({ invoice: kern, certain: false });
  });

  it('the amount is compared with what is left, not the gross', () => {
    const part = sent('part', 'RE-2026-047', '2026-10-12', 100000, { paymentIds: ['t1'] }); // gross 119000, 30000 paid
    const partly = businessOf([part], [payment('t1', 30000)]);
    expect(invoiceMatch(partly, payment('t', 89000))).toEqual({ invoice: part, certain: false });
    expect(invoiceMatch(partly, payment('t', 119000))).toBeNull();
  });

  it('two invoices with the same amount left: no match', () => {
    const twin = sent('twin', 'RE-2026-046', '2026-10-17', 200000);
    expect(invoiceMatch(businessOf([kern, twin]), payment('t', 238000))).toBeNull();
  });

  it('no invoice has that amount and no number is named: no match', () => {
    expect(invoiceMatch(b, payment('t', 12345))).toBeNull();
  });

  it('money out is never a match', () => {
    expect(invoiceMatch(b, payment('t', -238000, { reference: 'RE-2026-044' }))).toBeNull();
  });

  it('only a payment whose receipt is missing is a match', () => {
    expect(invoiceMatch(b, payment('t', 238000, { reference: 'RE-2026-044', receipt: 'attached' }))).toBeNull();
    expect(invoiceMatch(b, payment('t', 238000, { reference: 'RE-2026-044', receipt: 'notNeeded' }))).toBeNull();
  });

  it('paid, cancelled, cancellation and draft invoices are not candidates', () => {
    const paid = sent('paid', 'RE-2026-041', '2026-10-02', 126050, { paymentIds: ['t-paid'] }); // gross 150000
    const cancelled = sent('cx', 'RE-2026-040', '2026-10-01', 50000, { cancelledBy: 'cxc' });
    const cancellation = sent('cxc', 'RE-2026-042', '2026-10-07', -50000, { cancels: 'cx' });
    const everything = businessOf([paid, cancelled, cancellation, draft({ number: null })], [payment('t-paid', 150000)]);
    expect(invoiceMatch(everything, payment('t', 150000, { reference: 'RE-2026-041' }))).toBeNull();
    expect(invoiceMatch(everything, payment('t', 59500, { reference: 'RE-2026-040' }))).toBeNull();
    expect(invoiceMatch(everything, payment('t', 59500))).toBeNull();
  });

  it('a number that only starts like the one in the reference does not match', () => {
    expect(invoiceMatch(b, payment('t', 1, { reference: 'RE-2026-0441' }))).toBeNull();
  });

  it('ignores upper and lower case in the reference', () => {
    expect(invoiceMatch(b, payment('t', 1, { reference: 're-2026-044' }))).toEqual({ invoice: kern, certain: true });
  });

  it('two numbers in the reference are not a certain match; the amount can still decide', () => {
    const both = payment('t', 238000, { reference: 'RE-2026-044 und RE-2026-039' });
    expect(invoiceMatch(b, both)).toEqual({ invoice: kern, certain: false });
    expect(invoiceMatch(b, payment('t', 5, { reference: 'RE-2026-044 und RE-2026-039' }))).toBeNull();
  });
});

// --- the list ---

describe('owedSummary and invoiceRows', () => {
  const today = '2026-10-22';
  const kern = sent('kern', 'RE-2026-044', '2026-10-16', 200000); // 238000, due 30 Oct: open
  const soon = sent('soon', 'RE-2026-046', '2026-10-10', 10000); // 11900, due 24 Oct: open
  const lange = sent('lange', 'RE-2026-039', '2026-09-16', 100000); // 119000, due 30 Sep: overdue
  const part = sent('part', 'RE-2026-047', '2026-10-12', 100000, { paymentIds: ['t-part'] }); // 119000, 30000 paid, due 26 Oct
  const lp = sent('lp', 'RE-2026-048', '2026-09-01', 100000, { paymentIds: ['t-lp'] }); // 119000, 19000 paid, due 15 Sep: partly paid and past due
  const paid = sent('paid', 'RE-2026-041', '2026-10-02', 126050, { paymentIds: ['t-paid'] }); // 150000
  const cancelled = sent('cx', 'RE-2026-040', '2026-10-01', 50000, { cancelledBy: 'cxc' });
  const cancellation = sent('cxc', 'RE-2026-042', '2026-10-07', -50000, { cancels: 'cx' });
  const dra =draft({ id: 'draft-1', issueDate: '2026-10-20' });
  const draOlder = draft({ id: 'draft-0', issueDate: '2026-10-05' });

  const files = [
    doc('f-wait', { dueDate: '2026-11-02', amountCents: 50000 }),
    doc('f-over', { dueDate: '2026-10-01', amountCents: 20000 }),
    doc('f-done', { paymentId: 't-done', date: '2026-10-05', amountCents: 30000 }),
    doc('f-cash', { paymentId: 't-cash', amountCents: 68450 }), // a cash-register closing
    doc('f-recv', { direction: 'received', dueDate: '2026-10-01', amountCents: 9900 }),
    doc('f-check', { amountCents: null }), // an amount nobody has read yet
    doc('f-dup', { duplicateOf: 'f-wait', dueDate: '2026-11-02' }),
  ];
  const payments = [
    payment('t-part', 30000),
    payment('t-lp', 19000),
    payment('t-paid', 150000),
    payment('t-done', 30000),
    payment('t-cash', 68450, { accountId: CASH.id }),
  ];
  const all = businessOf([dra, draOlder, kern, soon, lange, part, lp, paid, cancelled, cancellation], payments, files);

  it('rows: drafts, overdue, open and partly paid by due date, then paid, cancelled and cancellation newest first', () => {
    const ids = invoiceRows(all, ALL_DONE, today).map((r) => (r.kind === 'invoice' ? r.invoice.id : r.doc.id));
    expect(ids).toEqual([
      'draft-1', 'draft-0', // drafts, newest first
      'lange', 'f-over', // overdue, oldest due date first
      'lp', 'soon', 'part', 'kern', 'f-wait', // open and partly paid by due date: a partly paid one past its due date still comes after the overdue ones
      'cxc', 'f-done', 'paid', 'cx', // the rest, newest first
    ]);
  });

  it('every row carries its status', () => {
    const status = Object.fromEntries(
      invoiceRows(all, ALL_DONE, today).map((r) => [r.kind === 'invoice' ? r.invoice.id : r.doc.id, r.status]),
    );
    expect(status).toEqual({
      'draft-1': 'draft', 'draft-0': 'draft', lange: 'overdue', 'f-over': 'overdue', soon: 'open', part: 'partlyPaid', lp: 'partlyPaid',
      kern: 'open', 'f-wait': 'open', cxc: 'cancellation', 'f-done': 'paid', paid: 'paid', cx: 'cancelled',
    });
  });

  it('file rows are sent documents that are not invoices from here, waiting, overdue or done, and not on a cash account', () => {
    const rows = invoiceRows(all, ALL_DONE, today).filter((r) => r.kind === 'file');
    expect(rows.map((r) => (r.kind === 'file' ? r.doc.id : ''))).toEqual(['f-over', 'f-wait', 'f-done']);
  });

  it('a sent invoice is hidden when its document is not visible: before the bank is connected only what was added in the demo shows', () => {
    const shown = sent('shown', 'RE-2026-044', '2026-10-16', 100);
    const hidden = sent('hidden', 'RE-2026-045', '2026-10-16', 100);
    const b = business({ invoices: [dra, shown, hidden], documents: [invoiceDoc(shown), invoiceDoc(hidden, { fromUpload: false })] });
    const ids = (steps: SetupSteps) => invoiceRows(b, steps, today).map((r) => (r.kind === 'invoice' ? r.invoice.id : r.doc.id));
    expect(ids({ ...ALL_DONE, bank: false }).sort()).toEqual(['draft-1', 'shown']);
    expect(ids(ALL_DONE).sort()).toEqual(['draft-1', 'hidden', 'shown']);
  });

  it('drafts always show, even before the bank is connected', () => {
    const rows = invoiceRows(business({ invoices: [dra] }), { bank: false, tax: false, receipt: false }, today);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'invoice', status: 'draft' });
  });

  it('finds the row of one invoice by its id, with its status', () => {
    expect(invoiceRowOf(all, ALL_DONE, 'lange', today)).toEqual({ kind: 'invoice', invoice: lange, status: 'overdue' });
    expect(invoiceRowOf(all, ALL_DONE, 'cxc', today)).toMatchObject({ status: 'cancellation' });
    expect(invoiceRowOf(all, ALL_DONE, 'draft-1', today)).toMatchObject({ status: 'draft' });
  });

  it('finds no row for an unknown id, for the id of a file row, or for an invoice that is not shown', () => {
    expect(invoiceRowOf(all, ALL_DONE, 'nope', today)).toBeNull();
    expect(invoiceRowOf(all, ALL_DONE, 'f-wait', today)).toBeNull();
    const hidden = sent('hidden', 'RE-2026-045', '2026-10-16', 100);
    const b = business({ invoices: [hidden], documents: [invoiceDoc(hidden, { fromUpload: false })] });
    expect(invoiceRowOf(b, { ...ALL_DONE, bank: false }, 'hidden', today)).toBeNull();
    expect(invoiceRowOf(b, ALL_DONE, 'hidden', today)).toMatchObject({ status: 'open' });
  });

  it('a sent invoice without a sent document is not shown', () => {
    const orphan = sent('o', 'RE-2026-044', '2026-10-16', 100, { docId: null });
    expect(invoiceRows(business({ invoices: [orphan] }), ALL_DONE, today)).toEqual([]);
  });

  it('owed: what is left on open, overdue and partly paid invoices and on waiting and overdue files, with the overdue part', () => {
    expect(owedSummary(all, ALL_DONE, today)).toEqual({
      owedCents: 238000 + 11900 + 119000 + 89000 + 100000 + 50000 + 20000,
      owedCount: 7,
      overdueCents: 119000 + 100000 + 20000,
      overdueCount: 3,
    });
  });

  it('owed counts a partly paid invoice past its due date as overdue, with what is left', () => {
    const lateAndPart = sent('lp', 'RE-2026-050', '2026-09-01', 100000, { paymentIds: ['t1'] }); // due 15 Sep, 119000, 19000 paid
    const b = businessOf([lateAndPart], [payment('t1', 19000)]);
    expect(owedSummary(b, ALL_DONE, today)).toEqual({ owedCents: 100000, owedCount: 1, overdueCents: 100000, overdueCount: 1 });
  });

  it('owed ignores drafts, paid, cancelled and cancellation invoices', () => {
    const b = businessOf([dra, paid, cancelled, cancellation], [payment('t-paid', 150000)]);
    expect(owedSummary(b, ALL_DONE, today)).toEqual({ owedCents: 0, owedCount: 0, overdueCents: 0, overdueCount: 0 });
  });

  it('owed counts only visible rows', () => {
    const hidden = { ...business({ invoices: [kern], documents: [invoiceDoc(kern, { fromUpload: false })] }) };
    expect(owedSummary(hidden, { ...ALL_DONE, bank: false }, today).owedCount).toBe(0);
    expect(owedSummary(hidden, ALL_DONE, today).owedCount).toBe(1);
  });

  it('today is the demo date unless given', () => {
    expect(owedSummary(all, ALL_DONE).overdueCount).toBe(3);
    expect(invoiceRows(all, ALL_DONE).length).toBe(13);
  });
});

// --- documents and bookings ---

describe('revenueBookingFor', () => {
  it('a Kleinunternehmer books to the no-VAT revenue account', () => {
    expect(revenueBookingFor(draft(), KU)).toBe(REVENUE_KU);
  });

  it('reverse charge books to 8336, no VAT', () => {
    const abroad = draft({ customer: customer({ country: 'FR', vatId: 'FR1' }) });
    expect(revenueBookingFor(abroad, VAT)).toBe(REVENUE_EU_RC);
    expect(REVENUE_EU_RC).toMatchObject({ skr03: '8336', vatRate: 0, labelKey: 'revenueEuRc' });
  });

  it('a business outside the EU books to 8338, no VAT', () => {
    const abroad = draft({ customer: customer({ country: 'US' }) });
    expect(revenueBookingFor(abroad, VAT)).toBe(REVENUE_ABROAD);
    expect(REVENUE_ABROAD).toMatchObject({ skr03: '8338', vatRate: 0, labelKey: 'revenueAbroad' });
  });

  it('19 % and 7 % use the usual revenue accounts', () => {
    expect(revenueBookingFor(draft({ vatRate: 19 }), VAT)).toBe(REVENUE_19);
    expect(revenueBookingFor(draft({ vatRate: 7 }), VAT)).toBe(REVENUE_7);
  });

  it('a sent invoice keeps the booking it was sent with', () => {
    const frozen = sent('k', 'RE-2026-045', '2026-10-16', 100, { vatRate: 0, taxNote: 'kleinunternehmer' });
    expect(revenueBookingFor(frozen, VAT)).toBe(REVENUE_KU);
    const at19 = sent('i', 'RE-2026-046', '2026-10-16', 100, { vatRate: 19, taxNote: null });
    expect(revenueBookingFor(at19, KU)).toBe(REVENUE_19);
  });
});

describe('invoiceDocFor', () => {
  const invoice = sent('kern', 'RE-2026-044', '2026-10-16', 200000, { docId: null });
  const b = business({ invoices: [invoice] });

  it('is the sent document of the invoice', () => {
    expect(invoiceDocFor(invoice, b)).toMatchObject({
      fileName: 'RE-2026-044.pdf',
      source: 'file',
      direction: 'sent',
      name: 'Studio Kern',
      invoiceNo: 'RE-2026-044',
      date: '2026-10-16',
      addedOn: '2026-10-16',
      dueDate: '2026-10-30',
      amountCents: 238000,
      vatRate: 19,
      booking: REVENUE_19,
      bookingConfirmed: true,
      fromUpload: true,
      reading: false,
      duplicateOf: null,
      paymentId: null,
      invoice: { id: 'kern', role: 'invoice', cancelled: false },
    });
  });

  it('takes the id of its document when the invoice has one, otherwise one made from the invoice id', () => {
    expect(invoiceDocFor(invoice, b).id).toBe('doc-kern');
    expect(invoiceDocFor({ ...invoice, docId: 'doc-wd-d2' }, b).id).toBe('doc-wd-d2');
  });

  it('a history line says it was sent', () => {
    expect(invoiceDocFor(invoice, b).history).toEqual([{ date: '2026-10-16', key: 'invoiceSent', params: { email: 'buero@studio-kern.example' } }]);
  });

  it('a Kleinunternehmer invoice has no VAT and the no-VAT booking', () => {
    const ku = sent('k', 'RE-2026-045', '2026-10-16', 50000, { vatRate: 0, taxNote: 'kleinunternehmer', docId: null });
    expect(invoiceDocFor(ku, business({ taxProfile: KU, invoices: [ku] }))).toMatchObject({ amountCents: 50000, vatRate: 0, booking: REVENUE_KU });
  });

  it('a reverse-charge invoice has no VAT and its own booking', () => {
    const eu = sent('e', 'RE-2026-046', '2026-10-16', 50000, { vatRate: 0, taxNote: 'reverseCharge', customer: customer({ country: 'FR', vatId: 'FR1' }), docId: null });
    expect(invoiceDocFor(eu, business({ invoices: [eu] }))).toMatchObject({ amountCents: 50000, vatRate: 0, booking: REVENUE_EU_RC });
  });

  it('a cancellation invoice is a positive amount, with no due date, linked as a cancellation', () => {
    const original = sent('o', 'RE-2026-040', '2026-10-01', 50000, { cancelledBy: 'c' });
    const cancellation = sent('c', 'RE-2026-042', '2026-10-07', -50000, { cancels: 'o', docId: null });
    const d = invoiceDocFor(cancellation, business({ invoices: [original, cancellation] }));
    expect(d).toMatchObject({ amountCents: 59500, dueDate: null, invoiceNo: 'RE-2026-042', invoice: { id: 'c', role: 'cancellation', cancelled: false } });
    expect(invoiceDocFor(original, business({ invoices: [original, cancellation] })).invoice).toEqual({ id: 'o', role: 'invoice', cancelled: true });
  });
});

describe('invoiceDocNote', () => {
  // 500,00 net, 595,00 gross.
  const kern = (patch: Partial<Invoice> = {}) => sent('kern', 'RE-2026-044', '2026-10-16', 50000, patch);
  const noteOf = (b: Business, id: string) => invoiceDocNote(b.documents.find((d) => d.id === id)!, b);

  it('is nothing for a document that is not an invoice written here', () => {
    const b = business({ documents: [doc('file-doc')] });
    expect(invoiceDocNote(b.documents[0], b)).toBeNull();
  });

  it('is nothing for an invoice that is open, overdue or paid', () => {
    const open = kern();
    const overdue = sent('late', 'RE-2026-039', '2026-09-01', 50000);
    const paid = sent('paid', 'RE-2026-031', '2026-08-01', 50000, { paymentIds: ['p'] });
    const b = businessOf([open, overdue, paid], [payment('p', 59500)]);
    expect([noteOf(b, 'doc-kern'), noteOf(b, 'doc-late'), noteOf(b, 'doc-paid')]).toEqual([null, null, null]);
  });

  it('says what is left on a partly paid invoice, also past its due date', () => {
    const part = kern({ paymentIds: ['p'] });
    const late = sent('late', 'RE-2026-039', '2026-09-01', 50000, { paymentIds: ['q'] });
    const b = businessOf([part, late], [payment('p', 30000), payment('q', 10000)]);
    expect(noteOf(b, 'doc-kern')).toEqual({ kind: 'left', leftCents: 29500 });
    expect(noteOf(b, 'doc-late')).toEqual({ kind: 'left', leftCents: 49500 });
  });

  it('says a cancelled invoice is cancelled', () => {
    const original = kern({ cancelledBy: 'storno' });
    const cancellation = sent('storno', 'RE-2026-045', '2026-10-17', -50000, { cancels: 'kern' });
    const b = businessOf([original, cancellation]);
    expect(noteOf(b, 'doc-kern')).toEqual({ kind: 'cancelled' });
  });

  it('names the invoice a cancellation invoice cancels', () => {
    const original = kern({ cancelledBy: 'storno' });
    const cancellation = sent('storno', 'RE-2026-045', '2026-10-17', -50000, { cancels: 'kern' });
    const b = businessOf([original, cancellation]);
    expect(noteOf(b, 'doc-storno')).toEqual({ kind: 'cancellation', number: 'RE-2026-044' });
  });

  it('is nothing when the invoice of the document is not there', () => {
    const b = business({ documents: [invoiceDoc(kern())] });
    expect(invoiceDocNote(b.documents[0], b)).toBeNull();
  });
});

describe('invoiceOfPayment', () => {
  it('is the invoice whose payments include the payment, a part payment as well', () => {
    const part = sent('part', 'RE-2026-021', '2026-10-14', 50000, { paymentIds: ['p1'] });
    const paid = sent('paid', 'RE-2026-022', '2026-10-15', 50000, { paymentIds: ['p2', 'p3'] });
    const b = businessOf([part, paid], [payment('p1', 30000), payment('p2', 20000), payment('p3', 39500)]);
    expect(invoiceOfPayment(b, 'p1')?.id).toBe('part');
    expect(invoiceOfPayment(b, 'p2')?.id).toBe('paid');
    expect(invoiceOfPayment(b, 'p3')?.id).toBe('paid');
  });

  it('is null for a payment that pays no invoice, and for an id the business does not have', () => {
    const open = sent('open', 'RE-2026-023', '2026-10-16', 50000);
    const b = businessOf([open], [payment('p1', 59500)]);
    expect(invoiceOfPayment(b, 'p1')).toBeNull();
    expect(invoiceOfPayment(b, 'nope')).toBeNull();
  });
});

describe('savedCustomers', () => {
  it('lists each customer once, the most recent invoice first, with the details of that invoice', () => {
    const older = sent('a', 'RE-2026-030', '2026-08-01', 100, { customer: customer({ name: 'Studio Kern', street: 'Alte Str. 1' }) });
    const middle = sent('b', 'RE-2026-035', '2026-09-01', 100, { customer: customer({ name: 'Bäckerei Lange', street: 'Hauptstr. 2' }) });
    const newest = sent('c', 'RE-2026-044', '2026-10-16', 100, { customer: customer({ name: 'Studio Kern', street: 'Neue Str. 4' }) });
    const result = savedCustomers(business({ invoices: [older, middle, newest] }));
    expect(result.map((c) => [c.name, c.street])).toEqual([
      ['Studio Kern', 'Neue Str. 4'],
      ['Bäckerei Lange', 'Hauptstr. 2'],
    ]);
  });

  it('the same name in another country is another customer', () => {
    const de = sent('a', 'RE-2026-030', '2026-08-01', 100, { customer: customer({ name: 'Nova', country: 'DE' }) });
    const fr = sent('b', 'RE-2026-031', '2026-08-02', 100, { customer: customer({ name: 'Nova', country: 'FR', vatId: 'FR1' }) });
    expect(savedCustomers(business({ invoices: [de, fr] })).map((c) => c.country)).toEqual(['FR', 'DE']);
  });

  it("a half-typed draft's customer isn't offered: a customer is saved with the first invoice that is sent to them", () => {
    const sentOne = sent('a', 'RE-2026-030', '2026-08-01', 100, { customer: customer({ name: 'Studio Kern' }) });
    const named = draft({ id: 'd1', issueDate: '2026-10-20', customer: customer({ name: 'Bezirksamt Pankow', kind: 'public' }) });
    const typing = draft({ id: 'd2', issueDate: '2026-10-21', customer: customer({ name: 'Agentur S', street: '' }) });
    const blank = draft({ id: 'd3', issueDate: '2026-10-22', customer: customer({ name: '  ' }) });
    expect(savedCustomers(business({ invoices: [sentOne, named, typing, blank] })).map((c) => c.name)).toEqual(['Studio Kern']);
    expect(savedCustomers(business({ invoices: [named, typing, blank] }))).toEqual([]);
  });

  it('an invoice and the cancellation invoice that repeats it name the customer once', () => {
    const original = sent('a', 'RE-2026-040', '2026-10-01', 500, { customer: customer({ name: 'Agentur Nord' }), cancelledBy: 'b' });
    const cancellation = sent('b', 'RE-2026-042', '2026-10-07', -500, { customer: customer({ name: 'Agentur Nord' }), cancels: 'a' });
    expect(savedCustomers(business({ invoices: [original, cancellation] })).map((c) => c.name)).toEqual(['Agentur Nord']);
  });

  it('no invoices, no customers', () => {
    expect(savedCustomers(business())).toEqual([]);
  });
});

describe('earlierLines', () => {
  const line = (description: string, unitPriceCents: number): InvoiceLine => ({ description, quantity: 1, unit: 'flat', unitPriceCents });

  it('lists each description once, the most recent first, with the price of that time', () => {
    const older = sent('a', 'RE-2026-030', '2026-08-01', 100, { lines: [line('Logo design', 30000), line('Flyer', 5000)] });
    const newer = sent('b', 'RE-2026-044', '2026-10-16', 100, { lines: [line('Logo design', 34000), line('Website', 90000)] });
    const result = earlierLines(business({ invoices: [older, newer] }));
    expect(result.map((l) => [l.description, l.unitPriceCents])).toEqual([
      ['Logo design', 34000],
      ['Website', 90000],
      ['Flyer', 5000],
    ]);
  });

  it('leaves out lines with no description and the negative lines of a cancellation invoice', () => {
    const base = sent('a', 'RE-2026-030', '2026-08-01', 100, { lines: [line('Logo design', 30000), line(' ', 100)] });
    const cancellation = sent('c', 'RE-2026-031', '2026-08-02', 100, { cancels: 'a', lines: [{ ...line('Logo design', 30000), quantity: -1 }, { ...line('Storno only', 1), quantity: -1 }] });
    expect(earlierLines(business({ invoices: [base, cancellation] })).map((l) => l.description)).toEqual(['Logo design']);
  });

  it('no invoices, no lines', () => {
    expect(earlierLines(business())).toEqual([]);
  });
});
