import {
  ADVERTISING,
  GOODS_7,
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
  TRAVEL,
  UTILITIES,
} from './categories';
import { Account, Booking, Business, HistoryEntry, Person, ReceiptState, Transaction } from './models';
import { EXTRA_DOCUMENTS, linkedDocFor } from './sample-documents';

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

/** One document linked to every payment with a receipt attached, then the business's extra documents. */
function withDocuments(b: BusinessSpec): Business {
  const linked = b.transactions
    .filter((tx) => tx.receipt === 'attached')
    .map((tx) => linkedDocFor(tx, b.taxProfile.kleinunternehmer));
  return { ...b, documents: [...linked, ...(EXTRA_DOCUMENTS[b.id] ?? [])] };
}

/** What the system would offer for an Amazon order it cannot sort: office supplies, software or other costs. */
const AMAZON_SUGGESTIONS = [OFFICE.labelKey, SOFTWARE.labelKey, OTHER_COSTS.labelKey];

const WD_QONTO: Account = { id: 'wd-qonto', kind: 'bank', name: 'Qonto', balanceCents: 1248020, lastUpdate: '2026-10-21' };
const WD_CASH: Account = { id: 'wd-cash', kind: 'cash', name: 'Cash box', balanceCents: 15000, lastUpdate: '2026-10-14' };
const SY_QONTO: Account = { id: 'sy-qonto', kind: 'bank', name: 'Qonto', balanceCents: 642075, lastUpdate: '2026-10-21' };
const CL_QONTO: Account = { id: 'cl-qonto', kind: 'bank', name: 'Qonto', balanceCents: 2315040, lastUpdate: '2026-10-21' };
const CL_SPARKASSE: Account = { id: 'cl-sparkasse', kind: 'bank', name: 'Sparkasse', balanceCents: 874512, lastUpdate: '2026-10-20' };
const CL_CASH: Account = { id: 'cl-cash', kind: 'cash', name: 'Cash box', balanceCents: 41230, lastUpdate: '2026-10-21' };

export const PERSON: Person = {
  id: 'p1',
  firstName: 'Sara',
  lastName: 'Weber',
  businessIds: ['weber-design', 'sara-yoga', 'cafe-linde'],
};

const BUSINESS_SPECS: BusinessSpec[] = [
  {
    id: 'weber-design',
    name: 'Weber Design',
    inboxEmail: 'weber-design@inbox.example',
    taxProfile: { kleinunternehmer: false, vatPeriod: 'monthly' },
    accounts: [WD_QONTO, WD_CASH],
    transactions: [
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
    vatDue: { dueDate: '2026-11-10', amountCents: 184200 },
    incomeTaxReserveCents: 320000,
    revenueThisYearCents: 4860000,
    notices: [
      { id: 'wd-n1', kind: 'terms', urgency: 1, blocking: true, params: {}, date: '2026-10-20' },
      { id: 'wd-n2', kind: 'bankExpiry', urgency: 2, blocking: false, params: { bank: 'Qonto', days: 5 }, date: '2026-10-19' },
      { id: 'wd-n3', kind: 'unreadable', urgency: 3, blocking: false, params: { count: 2 }, date: '2026-10-18' },
    ],
    noticeHistory: [
      { id: 'wd-h1', kind: 'unreadable', urgency: 3, blocking: false, params: { count: 1 }, date: '2026-09-28' },
      { id: 'wd-h2', kind: 'bankExpiry', urgency: 2, blocking: false, params: { bank: 'Qonto', days: 30 }, date: '2026-09-21' },
    ],
    categoryRules: [],
  },
  {
    id: 'sara-yoga',
    name: 'Sara Weber Yoga',
    inboxEmail: 'sara-yoga@inbox.example',
    taxProfile: { kleinunternehmer: true, vatPeriod: null },
    accounts: [SY_QONTO],
    transactions: [
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
    vatDue: null,
    incomeTaxReserveCents: 210000,
    revenueThisYearCents: 2130000,
    notices: [
      { id: 'sy-n1', kind: 'revenueLimit', urgency: 2, blocking: false, params: { percent: 85, limit: 25000 }, date: '2026-10-20' },
    ],
    noticeHistory: [
      { id: 'sy-h1', kind: 'revenueLimit', urgency: 2, blocking: false, params: { percent: 80, limit: 25000 }, date: '2026-09-24' },
    ],
    categoryRules: [],
  },
  {
    id: 'cafe-linde',
    name: 'Café Linde GbR',
    inboxEmail: 'cafe-linde@inbox.example',
    taxProfile: { kleinunternehmer: false, vatPeriod: 'quarterly' },
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
    ],
    vatDue: { dueDate: '2027-01-10', amountCents: 412000 },
    incomeTaxReserveCents: 580000,
    revenueThisYearCents: 11240000,
    notices: [
      { id: 'cl-n1', kind: 'bankExpiry', urgency: 2, blocking: false, params: { bank: 'Sparkasse', days: 5 }, date: '2026-10-19' },
    ],
    noticeHistory: [
      { id: 'cl-h1', kind: 'terms', urgency: 1, blocking: false, params: {}, date: '2026-09-15' },
    ],
    categoryRules: [],
  },
];

export const BUSINESSES: Business[] = BUSINESS_SPECS.map(withDocuments);
