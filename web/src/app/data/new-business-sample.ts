import { OFFICE, OTHER_COSTS, PHONE, RENT, REVENUE_19, SOFTWARE, TRAVEL } from './categories';
import { monthBefore } from '../domain/dates';
import { DEMO_TODAY } from './demo-date';
import type { Account, Booking, Business, BusinessKind, HistoryEntry, PoolResult, Transaction } from './models';

// The generic sample data of a business made during the visit (by Create account or Add a business): one bank account at
// whichever bank the person picks, eight October payments and a pool of receipts, the same set for every such business.
// Everything is invented. Amounts are integer cents. This file must not import sample-data.ts or banks.ts: both import it.

/** What the person answered when the business was made. */
export interface NewBusinessInput {
  name: string;
  kind: BusinessKind;
  legalForm: 'sole' | 'gbr';
}

/** The person who owns the new business: the login behind it, and the name and email its people list shows. */
export interface NewOwner {
  personId: string;
  name: string;
  email: string;
}

/** Whether the id belongs to a business made during the visit: `new-<n>`. The sample businesses have ids of their own. */
export function isVisitBusiness(businessId: string): boolean {
  return /^new-\d+$/.test(businessId);
}

/**
 * A business as it is the moment it is made: a new client with the person as its owner, the kind of work and the legal
 * form they answered, and nothing else yet. The year opening is empty and ends in September, because the business starts in
 * October 2026; no month is closed.
 */
export function newBusiness(id: string, input: NewBusinessInput, owner: NewOwner): Business {
  return {
    id,
    name: input.name,
    inboxEmail: `${id}@inbox.example`,
    taxProfile: {
      businessKind: input.kind,
      kleinunternehmer: false,
      vatPeriod: null,
      permanentExtension: false,
      vatBasis: null,
      taxState: null,
      taxNumber: null,
      vatId: null,
      fiscalYearStart: '01-01',
    },
    accounts: [],
    transactions: [],
    documents: [],
    vatReturns: [],
    legalForm: input.legalForm,
    yearOpening: { incomeCents: 0, costsCents: 0, costsByCategory: [], untilMonth: monthBefore(DEMO_TODAY) },
    closedMonths: [],
    incomeTaxReserveCents: 0,
    invoices: [],
    invoiceProfile: {
      name: input.name,
      street: '',
      postcode: '',
      city: '',
      email: `${id}@invoices.example`,
      iban: null,
      numberPattern: 'RE-{YYYY}-{NNN}',
      paymentTermDays: 14,
      language: 'de',
    },
    notices: [],
    noticeHistory: [],
    categoryRules: [],
    history: [],
    people: [
      {
        id: `${id}-m1`,
        personId: owner.personId,
        name: owner.name,
        email: owner.email,
        role: 'owner',
        status: 'joined',
        invitedOn: null,
        expiresOn: null,
        joinedOn: DEMO_TODAY,
      },
    ],
    supportUntil: null,
    imports: [],
  };
}

/** The id of the business account the demo finds for a business made during the visit. */
export function newBusinessAccountId(businessId: string): string {
  return `${businessId}-main`;
}

/**
 * The business account the demo finds at a bank, named after the bank. It is not connected yet, so it carries a neutral
 * "statement" connection as a placeholder; the bank flow sets the real connection when it connects it.
 */
export function newBusinessAccount(businessId: string, bankName: string): Account {
  return {
    id: newBusinessAccountId(businessId),
    kind: 'bank',
    name: bankName,
    balanceCents: 1834566,
    lastUpdate: '2026-10-21',
    connection: { kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
    product: 'business',
    iban: 'DE89370400440532013000',
  };
}

/** What one payment needs to say; `pay()` fills in the rest. */
interface PaySpec {
  n: number;
  date: string;
  who: string;
  cents: number;
  booking: Booking | null;
  iban: string;
  ref: string;
  confirmed?: boolean; // default true
  suggestions?: string[]; // category labelKeys, for a payment without a booking
}

/** A payment as the bank import would have created it: no receipt yet, with the import and, when it is booked, the automatic booking in its history. */
function pay(businessId: string, account: Account, p: PaySpec): Transaction {
  const history: HistoryEntry[] = [];
  if (p.booking) history.push({ date: p.date, key: 'autoBooked', params: { category: p.booking.labelKey } });
  history.push({ date: p.date, key: 'imported', params: { account: account.name } });
  return {
    id: `${businessId}-t${p.n}`,
    date: p.date,
    counterparty: p.who,
    accountId: account.id,
    amountCents: p.cents,
    booking: p.booking,
    confirmed: p.confirmed ?? true,
    isPrivate: false,
    receipt: 'missing',
    receiptFile: null,
    counterpartyIban: p.iban,
    reference: p.ref,
    history,
    beforePrivate: null,
    beforeLink: null,
    ...(p.suggestions ? { suggestions: [...p.suggestions] } : {}),
  };
}

/**
 * The eight October payments a new business gets when its account is connected, newest first: two customers paying in
 * (one booking waits for a confirmation), rent, a phone bill, software and a train ticket, an Amazon order the system
 * cannot sort, and a transfer to the owner's private account. A new client has no receipts yet, so every payment waits
 * for the person.
 */
export function newBusinessPayments(businessId: string, account: Account, ownerName: string): Transaction[] {
  const specs: PaySpec[] = [
    { n: 1, date: '2026-10-20', who: 'Fischer & Co. KG', cents: 119000, booking: REVENUE_19, iban: 'DE21100100100054321876', ref: 'Rechnung 2026-001' },
    { n: 2, date: '2026-10-16', who: 'Hausverwaltung Brandt', cents: -45000, booking: RENT, iban: 'DE33100900001122334455', ref: 'Miete Büro Oktober' },
    { n: 3, date: '2026-10-14', who: 'Telekom', cents: -3995, booking: PHONE, iban: 'DE46370501980098765432', ref: 'Mobilfunk Oktober' },
    { n: 4, date: '2026-10-12', who: 'Adobe', cents: -5949, booking: SOFTWARE, iban: 'DE58200400600234567810', ref: 'Creative Cloud Oktober' },
    { n: 5, date: '2026-10-09', who: 'Deutsche Bahn', cents: -8900, booking: TRAVEL, iban: 'DE72100100100076543219', ref: 'Fahrkarte Berlin–Leipzig' },
    { n: 6, date: '2026-10-07', who: 'Lindner Studio GmbH', cents: 238000, booking: REVENUE_19, confirmed: false, iban: 'DE85120300000045678912', ref: 'Rechnung 2026-002' },
    { n: 7, date: '2026-10-05', who: 'Amazon', cents: -3490, booking: null, iban: 'DE17300209000345678901', ref: 'Bestellung 302-5521047-3318', suggestions: [OFFICE.labelKey, SOFTWARE.labelKey, OTHER_COSTS.labelKey] },
    { n: 8, date: '2026-10-02', who: ownerName, cents: -50000, booking: null, iban: 'DE90100110012233445599', ref: 'Überweisung Privatkonto' },
  ];
  return specs.map((spec) => pay(businessId, account, spec));
}

/** One reading result for the pool: from the booking's VAT rate, no due date and no duplicate. */
function result(s: Pick<PoolResult, 'name' | 'direction' | 'invoiceNo' | 'date' | 'amountCents' | 'booking' | 'plain'>): PoolResult {
  return { ...s, dueDate: null, vatRate: s.booking?.vatRate ?? 0, duplicateOf: null };
}

/**
 * What a simulated upload "reads" for a business made during the visit, in the order the demo hands the results out: a
 * receipt for the phone bill and one for the train ticket, each a sure match for its payment, one that cannot be told as
 * sent or received, then two plain receipts that repeat once the pool is used up.
 */
export const NEW_BUSINESS_POOL: PoolResult[] = [
  result({ name: 'Telekom', direction: 'received', invoiceNo: '4471 1014', date: '2026-10-14', amountCents: 3995, booking: PHONE, plain: false }),
  result({ name: 'Deutsche Bahn', direction: 'received', invoiceNo: '7183', date: '2026-10-09', amountCents: 8900, booking: TRAVEL, plain: false }),
  result({ name: 'Bürobedarf Klein', direction: null, invoiceNo: 'K-2218', date: '2026-10-21', amountCents: 2990, booking: OFFICE, plain: false }),
  result({ name: 'Copyshop Mitte', direction: 'received', invoiceNo: 'B-3108', date: '2026-10-21', amountCents: 1250, booking: OFFICE, plain: true }),
  result({ name: 'Parkhaus Zentrum', direction: 'received', invoiceNo: 'P-41207', date: '2026-10-21', amountCents: 600, booking: TRAVEL, plain: true }),
];
