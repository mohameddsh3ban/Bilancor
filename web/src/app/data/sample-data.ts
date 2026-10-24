import {
  ADVERTISING,
  CONSULTING,
  GOODS_7,
  INSURANCE,
  OFFICE,
  OTHER_COSTS,
  PHONE,
  PRIVATE_OUT,
  RENT,
  REVENUE_19,
  REVENUE_7,
  REVENUE_KU,
  SALARIES,
  SOFTWARE,
  SUPPLIES,
  TRAINING,
  TRAVEL,
  UTILITIES,
} from './categories';
import { Account, AccountConnection, Booking, Business, CategoryTotal, Doc, HistoryEntry, Invoice, Member, ReceiptState, Role, Transaction } from './models';
import { EXTRA_DOCUMENTS, linkedDocFor } from './sample-documents';
import { INVOICE_PROFILES, SAMPLE_INVOICES } from './sample-invoices';
import { PERSON } from './sample-person';

// All people, businesses, IBANs and amounts below are invented. Amounts are integer cents.

/** What one sample payment needs to say; `pay()` fills in the rest. */
interface PaySpec {
  id: string;
  date: string;
  who: string;
  acct: Account;
  cents: number;
  booking: Booking | null;
  iban: string;
  ref: string;
  confirmed?: boolean; // default true
  receipt?: ReceiptState; // default 'attached'
  file?: string; // default beleg-<id>.pdf
  priv?: boolean;
  suggestions?: string[]; // category labelKeys, for a payment without a booking
}

/** A payment as the bank import would have created it, with its history so far (newest first, like every action adds it). */
function pay(p: PaySpec): Transaction {
  const receipt = p.receipt ?? 'attached';
  const history: HistoryEntry[] = [];
  if (p.priv) history.push({ date: p.date, key: 'markedPrivate', params: {} });
  if (p.booking) history.push({ date: p.date, key: 'autoBooked', params: { category: p.booking.labelKey } });
  history.push({ date: p.date, key: 'imported', params: { account: p.acct.name } });
  return {
    id: p.id,
    date: p.date,
    counterparty: p.who,
    accountId: p.acct.id,
    amountCents: p.cents,
    booking: p.booking,
    confirmed: p.confirmed ?? true,
    isPrivate: p.priv ?? false,
    receipt,
    receiptFile: receipt === 'attached' ? (p.file ?? `beleg-${p.id}.pdf`) : null,
    counterpartyIban: p.iban,
    reference: p.ref,
    history,
    beforePrivate: null,
    beforeLink: null,
    ...(p.suggestions ? { suggestions: [...p.suggestions] } : {}),
  };
}

/** A business as written out below; `withDocuments()` adds its documents. */
type BusinessSpec = Omit<Business, 'documents'>;

/**
 * Whether the payment only pays part of an invoice written in the app, with that invoice's own sent document as its receipt
 * (a part payment): that document waits for the rest, so the payment gets no document of its own.
 */
const paysPartOfInvoice = (b: BusinessSpec, tx: Transaction): boolean =>
  b.invoices.some((invoice) => invoice.paymentIds.includes(tx.id) && invoice.docId !== `doc-${tx.id}`);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day an invoice is due: its date plus the payment term. This is `dueDateOf` (domain/invoices.ts), which this file cannot import (a cycle through the banks); sample-invoices.spec.ts checks they agree. */
const dueOn = (invoice: Invoice): string => new Date(Date.parse(invoice.issueDate) + invoice.paymentTermDays * DAY_MS).toISOString().slice(0, 10);

/**
 * The document of an invoice written in the app is marked as one, and shows the invoice: its number, its customer, the day it
 * was issued (also the day it was added) and the day it is due (a cancellation invoice has none), so Documents reads like Invoices.
 * The payment that paid it may have another name and date.
 */
function markedAsInvoice(doc: Doc, invoices: readonly Invoice[]): Doc {
  const invoice = invoices.find((candidate) => candidate.docId === doc.id);
  if (!invoice) return doc;
  const role = invoice.cancels !== null ? 'cancellation' : 'invoice';
  return {
    ...doc,
    name: invoice.customer.name,
    invoiceNo: invoice.number ?? doc.invoiceNo,
    date: invoice.issueDate,
    addedOn: invoice.issueDate,
    dueDate: role === 'cancellation' ? null : dueOn(invoice),
    invoice: { id: invoice.id, role, cancelled: invoice.cancelledBy !== null },
  };
}

/**
 * One document linked to every payment with a receipt attached (except a part payment of an invoice), then the business's
 * extra documents. The documents of the business's invoices are marked as such.
 */
function withDocuments(b: BusinessSpec): Business {
  const linked = b.transactions
    .filter((tx) => tx.receipt === 'attached' && !paysPartOfInvoice(b, tx))
    .map((tx) => linkedDocFor(tx, b.taxProfile.kleinunternehmer));
  return { ...b, documents: [...linked, ...(EXTRA_DOCUMENTS[b.id] ?? [])].map((doc) => markedAsInvoice(doc, b.invoices)) };
}

/** What the system would offer for an Amazon order it cannot sort: office supplies, software or other costs. */
const AMAZON_SUGGESTIONS = [OFFICE.labelKey, SOFTWARE.labelKey, OTHER_COSTS.labelKey];

/** A bank connection: the account's payments come in through it until the consent ends. */
const connected = (consentUntil: string, lastFetched: string): AccountConnection => ({
  kind: 'connected',
  consentUntil,
  lastFetched,
  fetchFrom: '2026-01-01',
  broken: false,
});
/** No bank connection: the account's payments came in from imported statements. */
const statement = (): AccountConnection => ({ kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false });
/** The cash box has no bank: its payments come from receipts. */
const cashBox = (): AccountConnection => ({ kind: 'cash', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false });

/** One category's amount in a year opening line, labelled and numbered like the booking it comes from. */
const total = (b: Booking, cents: number): CategoryTotal => ({ labelKey: b.labelKey, skr03: b.skr03, nameDe: b.nameDe, cents });
/**
 * The months of the year before a business's first sample payment, up to `untilMonth` ('YYYY-MM', the month before it): its
 * income, and its costs as the sum of the categories. The income is what makes the year's income reach the round figure
 * noted at each business once the booked sample payments are added (a test in tax-year.spec.ts checks it); the costs are
 * plausible, not calculated.
 */
const opening = (untilMonth: string, incomeCents: number, costs: CategoryTotal[]): Business['yearOpening'] => ({
  untilMonth,
  incomeCents,
  costsCents: costs.reduce((sum, c) => sum + c.cents, 0),
  costsByCategory: costs,
});

// The demo date is 2026-10-22: Weber Design's Qonto consent ends in 5 days, Sara's ended 2 days ago, Café Linde's runs about 4 more months.
const WD_QONTO: Account = { id: 'wd-qonto', kind: 'bank', name: 'Qonto', balanceCents: 1248020, lastUpdate: '2026-10-21', connection: connected('2026-10-27', '2026-10-22T06:12'), product: 'business', iban: 'DE08100101010482913650' };
const WD_CASH: Account = { id: 'wd-cash', kind: 'cash', name: 'Cash box', balanceCents: 15000, lastUpdate: '2026-10-14', connection: cashBox(), product: 'cash', iban: null };
const SY_QONTO: Account = { id: 'sy-qonto', kind: 'bank', name: 'Qonto', balanceCents: 642075, lastUpdate: '2026-10-21', connection: connected('2026-10-20', '2026-10-20T06:10'), product: 'business', iban: 'DE98100101010561742087' };
const CL_QONTO: Account = { id: 'cl-qonto', kind: 'bank', name: 'Qonto', balanceCents: 2315040, lastUpdate: '2026-10-21', connection: connected('2027-02-18', '2026-10-22T06:15'), product: 'business', iban: 'DE44100101010637185294' };
const CL_SPARKASSE: Account = { id: 'cl-sparkasse', kind: 'bank', name: 'Sparkasse', balanceCents: 874512, lastUpdate: '2026-10-20', connection: statement(), product: 'business', iban: 'DE23200505500847319256' };
const CL_CASH: Account = { id: 'cl-cash', kind: 'cash', name: 'Cash box', balanceCents: 41230, lastUpdate: '2026-10-21', connection: cashBox(), product: 'cash', iban: null };

/** A joined member of a business: Sara (the sample person, with her login) or someone who is only a row of the demo. */
const joined = (id: string, personId: string | null, name: string, email: string, role: Role, joinedOn: string): Member => ({
  id, personId, name, email, role, status: 'joined', invitedOn: null, expiresOn: null, joinedOn,
});
/** Sara as a member of a business. */
const sara = (id: string, role: Role, joinedOn: string): Member =>
  joined(id, PERSON.id, `${PERSON.firstName} ${PERSON.lastName}`, PERSON.email, role, joinedOn);

const BUSINESS_SPECS: BusinessSpec[] = [
  {
    id: 'weber-design',
    name: 'Weber Design',
    inboxEmail: 'weber-design@inbox.example',
    taxProfile: {
      businessKind: 'freelance',
      kleinunternehmer: false,
      vatPeriod: 'monthly',
      permanentExtension: false,
      vatBasis: 'ist',
      taxState: 'berlin',
      taxNumber: '27/123/45678',
      vatId: null,
      fiscalYearStart: '01-01',
    },
    accounts: [WD_QONTO, WD_CASH],
    transactions: [
      // Studio Kern's payment for RE-2026-044, with no invoice number in it and no receipt: the review inbox asks whether it pays that invoice.
      pay({ id: 'wd-t19', date: '2026-10-21', who: 'Kern Studio Berlin', acct: WD_QONTO, cents: 238000, booking: REVENUE_19, receipt: 'missing', iban: 'DE16120300000987654321', ref: 'Danke für die Zusammenarbeit' }),
      pay({ id: 'wd-t1', date: '2026-10-20', who: 'Müller GmbH', acct: WD_QONTO, cents: 150000, booking: REVENUE_19, confirmed: false, iban: 'DE68210501700012345678', ref: 'RE-2026-041' }),
      pay({ id: 'wd-t2', date: '2026-10-19', who: 'Telekom', acct: WD_QONTO, cents: -3995, booking: PHONE, iban: 'DE12370501980012345601', ref: 'Rechnung 8841 0712, Mobilfunk Oktober', file: 'telekom-rechnung-oktober.pdf' }),
      pay({ id: 'wd-t3', date: '2026-10-17', who: 'Deutsche Bahn', acct: WD_QONTO, cents: -12000, booking: TRAVEL, receipt: 'missing', iban: 'DE35100100100098765432', ref: 'Fahrkarte Berlin-Hamburg, Buchung 8841' }),
      pay({ id: 'wd-t4', date: '2026-10-15', who: 'Amazon', acct: WD_QONTO, cents: -4900, booking: null, iban: 'DE91300209000123400567', ref: 'Bestellung 302-1182733-5561', file: 'amazon-bestellung-5561.pdf', suggestions: AMAZON_SUGGESTIONS }),
      pay({ id: 'wd-t5', date: '2026-10-12', who: 'Adobe', acct: WD_QONTO, cents: -5949, booking: SOFTWARE, iban: 'DE47200400600150222900', ref: 'Creative Cloud, Rechnung IEE2026-77410' }),
      pay({ id: 'wd-t6', date: '2026-10-13', who: 'Rundfunk ARD, ZDF und Deutschlandradio Beitragsservice', acct: WD_QONTO, cents: -5508, booking: OTHER_COSTS, iban: 'DE44370501980000020101', ref: 'Beitragsnummer 123 456 789, Quartal 4' }),
      pay({ id: 'wd-t7', date: '2026-10-09', who: 'Atelier Sommer GmbH', acct: WD_QONTO, cents: 297500, booking: REVENUE_19, iban: 'DE72120300000011223344', ref: 'RE-2026-043' }),
      pay({ id: 'wd-t8', date: '2026-10-05', who: 'Coworking Mitte', acct: WD_QONTO, cents: -35700, booking: RENT, iban: 'DE29100500000190876543', ref: 'Miete Arbeitsplatz Oktober' }),
      pay({ id: 'wd-t9', date: '2026-09-26', who: 'Müller GmbH', acct: WD_QONTO, cents: 150000, booking: REVENUE_19, iban: 'DE68210501700012345678', ref: 'RE-2026-038' }),
      pay({ id: 'wd-t10', date: '2026-09-22', who: 'Telekom', acct: WD_QONTO, cents: -3995, booking: PHONE, iban: 'DE12370501980012345601', ref: 'Rechnung 8841 0689, Mobilfunk September' }),
      pay({ id: 'wd-t11', date: '2026-09-15', who: 'Atelier Sommer GmbH', acct: WD_QONTO, cents: 178500, booking: REVENUE_19, iban: 'DE72120300000011223344', ref: 'RE-2026-036' }),
      pay({ id: 'wd-t12', date: '2026-09-05', who: 'Coworking Mitte', acct: WD_QONTO, cents: -35700, booking: RENT, iban: 'DE29100500000190876543', ref: 'Miete Arbeitsplatz September' }),
      pay({ id: 'wd-t13', date: '2026-08-28', who: 'Müller GmbH', acct: WD_QONTO, cents: 150000, booking: REVENUE_19, iban: 'DE68210501700012345678', ref: 'RE-2026-031' }),
      pay({ id: 'wd-t14', date: '2026-08-21', who: 'Telekom', acct: WD_QONTO, cents: -3995, booking: PHONE, iban: 'DE12370501980012345601', ref: 'Rechnung 8841 0655, Mobilfunk August' }),
      pay({ id: 'wd-t15', date: '2026-08-14', who: 'Edeka Markt Prenzlauer Berg', acct: WD_CASH, cents: -6430, booking: PRIVATE_OUT, receipt: 'notNeeded', priv: true, iban: 'DE63100900001234567890', ref: 'Einkauf bar' }),
      pay({ id: 'wd-t16', date: '2026-08-05', who: 'Coworking Mitte', acct: WD_QONTO, cents: -35700, booking: RENT, iban: 'DE29100500000190876543', ref: 'Miete Arbeitsplatz August' }),
      pay({ id: 'wd-t17', date: '2026-10-08', who: 'SCHREIBWAREN BOETTCHER', acct: WD_QONTO, cents: -2380, booking: OFFICE, receipt: 'missing', iban: 'DE45100100100076543210', ref: 'Kartenzahlung 08.10.' }),
      pay({ id: 'wd-t18', date: '2026-10-02', who: 'Amazon', acct: WD_QONTO, cents: -2390, booking: null, iban: 'DE91300209000123400567', ref: 'Bestellung 302-4471920-8830', file: 'amazon-bestellung-8830.pdf', suggestions: AMAZON_SUGGESTIONS }),
    ],
    // Sent returns are stored as the figures the person saw and the tax office they went to; a sample-data test checks them against the booked payments.
    vatReturns: [
      { periodStart: '2026-08-01', periodEnd: '2026-08-31', sentOn: '2026-09-08', chargedCents: 23950, paidCents: 6338, resultCents: 17612, ticket: 'ET-2026-0908-41827', taxOffice: 'Berlin Friedrichshain-Kreuzberg' },
      { periodStart: '2026-09-01', periodEnd: '2026-09-30', sentOn: '2026-10-08', chargedCents: 52450, paidCents: 6338, resultCents: 46112, ticket: 'ET-2026-1008-52390', taxOffice: 'Berlin Friedrichshain-Kreuzberg' },
    ],
    legalForm: 'sole',
    // January to July, net: 42 079,00 € of income, so the year (with the booked payments since August) reaches 48 600,00 €.
    yearOpening: opening('2026-07', 4207900, [
      total(RENT, 210000),
      total(TRAVEL, 118000),
      total(SOFTWARE, 96000),
      total(CONSULTING, 72000),
      total(ADVERTISING, 62000),
      total(TRAINING, 49000),
      total(OTHER_COSTS, 39500),
      total(OFFICE, 30000),
      total(PHONE, 23500),
    ]),
    // August and September were closed by their VAT returns, on the days those were sent.
    closedMonths: [
      { month: '2026-08', on: '2026-09-08', by: null },
      { month: '2026-09', on: '2026-10-08', by: null },
    ],
    incomeTaxReserveCents: 320000,
    notices: [
      { id: 'wd-n1', kind: 'terms', urgency: 1, blocking: true, params: {}, date: '2026-10-20' },
      { id: 'wd-n3', kind: 'unreadable', urgency: 3, blocking: false, params: { count: 2 }, date: '2026-10-18' },
    ],
    noticeHistory: [
      { id: 'wd-h1', kind: 'unreadable', urgency: 3, blocking: false, params: { count: 1 }, date: '2026-09-28' },
      { id: 'wd-h2', kind: 'bankExpiry', urgency: 2, blocking: false, params: { bank: 'Qonto', days: 30 }, date: '2026-09-21' },
    ],
    categoryRules: [],
    invoices: SAMPLE_INVOICES['weber-design'],
    invoiceProfile: INVOICE_PROFILES['weber-design'],
    history: [],
    people: [
      sara('wd-m1', 'owner', '2026-01-02'),
      joined('wd-m2', null, 'Jana Hoffmann', 'jana@kanzlei-hoffmann.example', 'advisor', '2026-09-02'),
      // Invited on 20 October, and her link works until 27 October.
      { id: 'wd-m3', personId: null, name: null, email: 'mia@example.com', role: 'receipts', status: 'invited', invitedOn: '2026-10-20', expiresOn: '2026-10-27', joinedOn: null },
    ],
    supportUntil: null,
  },
  {
    id: 'sara-yoga',
    name: 'Sara Weber Yoga',
    inboxEmail: 'sara-yoga@inbox.example',
    taxProfile: {
      businessKind: 'freelance',
      kleinunternehmer: true,
      vatPeriod: null,
      permanentExtension: false,
      vatBasis: null,
      taxState: 'berlin',
      taxNumber: '21/456/78901',
      vatId: null,
      fiscalYearStart: '01-01',
    },
    accounts: [SY_QONTO],
    transactions: [
      // A part payment of RE-2026-021 (600,00 €): the invoice is its receipt, and 300,00 € are left.
      pay({ id: 'sy-t15', date: '2026-10-21', who: 'Physio Zentrum Mitte', acct: SY_QONTO, cents: 30000, booking: REVENUE_KU, file: 'RE-2026-021.pdf', iban: 'DE41100500001230987654', ref: 'RE-2026-021 Anzahlung' }),
      pay({ id: 'sy-t1', date: '2026-10-19', who: 'Studio Mitte, Kursgebühren Oktober', acct: SY_QONTO, cents: 96000, booking: REVENUE_KU, iban: 'DE55100700240123456780', ref: 'RE-2026-019' }),
      pay({ id: 'sy-t2', date: '2026-10-16', who: 'Anna Keller, Workshop Wochenende', acct: SY_QONTO, cents: 18500, booking: REVENUE_KU, confirmed: false, iban: 'DE18500105175407324931', ref: 'RE-2026-020' }),
      pay({ id: 'sy-t3', date: '2026-10-10', who: 'Raumhaus Berlin', acct: SY_QONTO, cents: -35000, booking: RENT, iban: 'DE86100900009876543210', ref: 'Raummiete Oktober' }),
      pay({ id: 'sy-t4', date: '2026-10-07', who: 'Yogashop Berlin', acct: SY_QONTO, cents: -4890, booking: SUPPLIES, iban: 'DE31100100106655443322', ref: 'Rechnung 22-9071, Yogamatten' }),
      pay({ id: 'sy-t5', date: '2026-10-02', who: 'Zoom Communications', acct: SY_QONTO, cents: -1590, booking: SOFTWARE, iban: 'DE77500700100112233445', ref: 'Zoom Pro, Rechnung INV-4471182' }),
      pay({ id: 'sy-t6', date: '2026-09-29', who: 'Studio Mitte, Kursgebühren September', acct: SY_QONTO, cents: 96000, booking: REVENUE_KU, iban: 'DE55100700240123456780', ref: 'RE-2026-016' }),
      pay({ id: 'sy-t7', date: '2026-10-13', who: 'Decathlon Berlin', acct: SY_QONTO, cents: -7490, booking: null, iban: 'DE24100100100445566778', ref: 'Kartenzahlung 13.10., Filiale Berlin', suggestions: [SUPPLIES.labelKey, OTHER_COSTS.labelKey] }),
      pay({ id: 'sy-t8', date: '2026-10-05', who: 'Druckerei Kiezdruck', acct: SY_QONTO, cents: -4500, booking: ADVERTISING, receipt: 'missing', iban: 'DE62100500000098765401', ref: 'Flyer Herbstkurse' }),
      pay({ id: 'sy-t9', date: '2026-09-17', who: 'Jonas Peters, Privatstunden', acct: SY_QONTO, cents: 12000, booking: REVENUE_KU, iban: 'DE09100100100887766554', ref: 'RE-2026-017' }),
      pay({ id: 'sy-t10', date: '2026-09-10', who: 'Raumhaus Berlin', acct: SY_QONTO, cents: -35000, booking: RENT, iban: 'DE86100900009876543210', ref: 'Raummiete September' }),
      pay({ id: 'sy-t11', date: '2026-09-02', who: 'Zoom Communications', acct: SY_QONTO, cents: -1590, booking: SOFTWARE, iban: 'DE77500700100112233445', ref: 'Zoom Pro, Rechnung INV-4398821' }),
      pay({ id: 'sy-t12', date: '2026-08-29', who: 'Studio Mitte, Kursgebühren August', acct: SY_QONTO, cents: 96000, booking: REVENUE_KU, iban: 'DE55100700240123456780', ref: 'RE-2026-013' }),
      pay({ id: 'sy-t13', date: '2026-08-11', who: 'Raumhaus Berlin', acct: SY_QONTO, cents: -35000, booking: RENT, iban: 'DE86100900009876543210', ref: 'Raummiete August' }),
      pay({ id: 'sy-t14', date: '2026-08-04', who: 'Yogashop Berlin', acct: SY_QONTO, cents: -4120, booking: SUPPLIES, iban: 'DE31100100106655443322', ref: 'Rechnung 22-8814, Gurte und Blöcke' }),
    ],
    vatReturns: [],
    legalForm: 'sole',
    // January to July, gross (a Kleinunternehmer has no VAT to take out): 18 000,00 € of income, so the year reaches 21 300,00 €.
    yearOpening: opening('2026-07', 1800000, [
      total(RENT, 245000),
      total(INSURANCE, 42000),
      total(SUPPLIES, 38000),
      total(TRAINING, 28000),
      total(ADVERTISING, 15000),
      total(SOFTWARE, 12000),
    ]),
    // August was closed by hand; September is left open, and every check would pass if she closed it.
    closedMonths: [{ month: '2026-08', on: '2026-09-05', by: 'Sara Weber' }],
    incomeTaxReserveCents: 210000,
    notices: [
      { id: 'sy-n1', kind: 'revenueLimit', urgency: 2, blocking: false, params: { percent: 85, limit: 25000 }, date: '2026-10-20' },
    ],
    noticeHistory: [
      { id: 'sy-h1', kind: 'revenueLimit', urgency: 2, blocking: false, params: { percent: 80, limit: 25000 }, date: '2026-09-24' },
    ],
    categoryRules: [],
    invoices: SAMPLE_INVOICES['sara-yoga'],
    invoiceProfile: INVOICE_PROFILES['sara-yoga'],
    history: [],
    people: [sara('sy-m1', 'owner', '2026-01-02')],
    supportUntil: null,
  },
  {
    id: 'cafe-linde',
    name: 'Café Linde GbR',
    inboxEmail: 'cafe-linde@inbox.example',
    taxProfile: {
      businessKind: 'trade',
      kleinunternehmer: false,
      vatPeriod: 'quarterly',
      permanentExtension: false,
      vatBasis: 'soll',
      taxState: 'hamburg',
      taxNumber: '41/234/56789',
      vatId: null,
      fiscalYearStart: '01-01',
    },
    accounts: [CL_QONTO, CL_SPARKASSE, CL_CASH],
    transactions: [
      pay({ id: 'cl-t1', date: '2026-10-20', who: 'Tagesumsatz Kasse', acct: CL_CASH, cents: 68450, booking: REVENUE_7, iban: 'DE41200300001000200030', ref: 'Kassenabschluss 20.10.' }),
      pay({ id: 'cl-t2', date: '2026-10-18', who: 'Metro Großmarkt', acct: CL_QONTO, cents: -142380, booking: GOODS_7, iban: 'DE57300700100123987654', ref: 'Rechnung 0412-88213' }),
      pay({ id: 'cl-t3', date: '2026-10-15', who: 'Stadtwerke Hamburg', acct: CL_SPARKASSE, cents: -28740, booking: UTILITIES, iban: 'DE83200505501234567801', ref: 'Abschlag Strom und Wasser Oktober' }),
      pay({ id: 'cl-t4', date: '2026-10-10', who: 'Hausverwaltung Lindenallee', acct: CL_SPARKASSE, cents: -185000, booking: RENT, iban: 'DE19200800000556677889', ref: 'Miete Oktober, Lindenallee 4' }),
      pay({ id: 'cl-t5', date: '2026-10-07', who: 'Lohnabrechnung Oktober', acct: CL_QONTO, cents: -310000, booking: SALARIES, iban: 'DE70100110012233445566', ref: 'Löhne und Gehälter Oktober' }),
      pay({ id: 'cl-t6', date: '2026-10-03', who: 'Catering Firma Dittmar', acct: CL_QONTO, cents: 54000, booking: REVENUE_19, iban: 'DE38210800500012349876', ref: 'RE-2026-052' }),
      pay({ id: 'cl-t7', date: '2026-09-30', who: 'Tagesumsatz Kasse', acct: CL_CASH, cents: 71200, booking: REVENUE_7, iban: 'DE41200300001000200030', ref: 'Kassenabschluss 30.09.' }),
      pay({ id: 'cl-t8', date: '2026-09-25', who: 'Metro Großmarkt', acct: CL_QONTO, cents: -138900, booking: GOODS_7, iban: 'DE57300700100123987654', ref: 'Rechnung 0409-77102' }),
      pay({ id: 'cl-t9', date: '2026-09-19', who: 'Catering Firma Dittmar', acct: CL_QONTO, cents: 48000, booking: REVENUE_19, iban: 'DE38210800500012349876', ref: 'RE-2026-049' }),
      pay({ id: 'cl-t10', date: '2026-09-10', who: 'Hausverwaltung Lindenallee', acct: CL_SPARKASSE, cents: -185000, booking: RENT, iban: 'DE19200800000556677889', ref: 'Miete September, Lindenallee 4' }),
      pay({ id: 'cl-t11', date: '2026-09-07', who: 'Lohnabrechnung September', acct: CL_QONTO, cents: -310000, booking: SALARIES, iban: 'DE70100110012233445566', ref: 'Löhne und Gehälter September' }),
      pay({ id: 'cl-t12', date: '2026-08-31', who: 'Lohnabrechnung August', acct: CL_QONTO, cents: -305000, booking: SALARIES, iban: 'DE70100110012233445566', ref: 'Löhne und Gehälter August' }),
      pay({ id: 'cl-t13', date: '2026-08-27', who: 'Metro Großmarkt', acct: CL_QONTO, cents: -131450, booking: GOODS_7, iban: 'DE57300700100123987654', ref: 'Rechnung 0405-66390' }),
      pay({ id: 'cl-t14', date: '2026-08-15', who: 'Stadtwerke Hamburg', acct: CL_SPARKASSE, cents: -26980, booking: UTILITIES, iban: 'DE83200505501234567801', ref: 'Abschlag Strom und Wasser August' }),
      pay({ id: 'cl-t15', date: '2026-08-10', who: 'Hausverwaltung Lindenallee', acct: CL_SPARKASSE, cents: -185000, booking: RENT, iban: 'DE19200800000556677889', ref: 'Miete August, Lindenallee 4' }),
      // July: a few booked payments, so that the third quarter has something to pay.
      pay({ id: 'cl-t16', date: '2026-07-29', who: 'Tagesumsatz Kasse', acct: CL_CASH, cents: 70230, booking: REVENUE_7, iban: 'DE41200300001000200030', ref: 'Kassenabschluss 29.07.' }),
      pay({ id: 'cl-t17', date: '2026-07-17', who: 'Catering Firma Dittmar', acct: CL_QONTO, cents: 952000, booking: REVENUE_19, iban: 'DE38210800500012349876', ref: 'RE-2026-044, Sommerfest' }),
      pay({ id: 'cl-t18', date: '2026-07-10', who: 'Metro Großmarkt', acct: CL_QONTO, cents: -141860, booking: GOODS_7, iban: 'DE57300700100123987654', ref: 'Rechnung 0401-55871' }),
    ],
    // Q2 was sent; Q3 (July to September) is the current return and is not sent yet, so it shows as overdue.
    vatReturns: [
      { periodStart: '2026-04-01', periodEnd: '2026-06-30', sentOn: '2026-07-09', chargedCents: 214860, paidCents: 126430, resultCents: 88430, ticket: 'ET-2026-0709-30764', taxOffice: 'Hamburg-Altona' },
    ],
    legalForm: 'gbr',
    // January to June, net (the payments here start in July): 101 581,36 € of income, so the year reaches 112 400,00 €.
    yearOpening: opening('2026-06', 10158136, [
      total(GOODS_7, 3100000),
      total(SALARIES, 1830000),
      total(RENT, 930000),
      total(SUPPLIES, 150000),
      total(UTILITIES, 145000),
      total(OTHER_COSTS, 95000),
      total(INSURANCE, 95000),
      total(ADVERTISING, 85000),
      total(CONSULTING, 70000),
    ]),
    // Q2's return was sent, so its months are in the opening line; July to September wait for the Q3 return.
    closedMonths: [],
    incomeTaxReserveCents: 580000,
    notices: [],
    noticeHistory: [
      { id: 'cl-h1', kind: 'terms', urgency: 1, blocking: false, params: {}, date: '2026-09-15' },
    ],
    categoryRules: [],
    invoices: SAMPLE_INVOICES['cafe-linde'],
    invoiceProfile: INVOICE_PROFILES['cafe-linde'],
    history: [],
    // The other partner owns the business and Sara has full access, so both roles show in the demo.
    people: [
      joined('cl-m1', null, 'Jonas Linde', 'jonas@cafe-linde.example', 'owner', '2026-01-02'),
      sara('cl-m2', 'full', '2026-03-16'),
    ],
    supportUntil: null,
  },
];

export const BUSINESSES: Business[] = BUSINESS_SPECS.map(withDocuments);
