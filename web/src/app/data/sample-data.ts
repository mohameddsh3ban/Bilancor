import { Booking, Business, Person } from './models';

// All people, businesses and amounts below are invented. Amounts are integer cents.

const REVENUE_19: Booking = { skr03: '8400', nameDe: 'Erlöse 19 % USt', labelKey: 'revenue19' };
const REVENUE_7: Booking = { skr03: '8300', nameDe: 'Erlöse 7 % USt', labelKey: 'revenue7' };
const REVENUE_KU: Booking = {
  skr03: '8195',
  nameDe: 'Erlöse als Kleinunternehmer i.S.d. § 19 Abs. 1 UStG',
  labelKey: 'revenueKU',
};
const PHONE: Booking = { skr03: '4920', nameDe: 'Telefon', labelKey: 'phone' };
const TRAVEL: Booking = { skr03: '4670', nameDe: 'Reisekosten Unternehmer', labelKey: 'travel' };
const SOFTWARE: Booking = {
  skr03: '4806',
  nameDe: 'Wartungskosten für Hard- und Software',
  labelKey: 'software',
};
const OTHER_COSTS: Booking = {
  skr03: '4900',
  nameDe: 'Sonstige betriebliche Aufwendungen',
  labelKey: 'otherCosts',
};
const RENT: Booking = { skr03: '4210', nameDe: 'Miete (unbewegliche Wirtschaftsgüter)', labelKey: 'rent' };
const SUPPLIES: Booking = { skr03: '4980', nameDe: 'Sonstiger Betriebsbedarf', labelKey: 'supplies' };
const GOODS_7: Booking = { skr03: '3300', nameDe: 'Wareneingang 7 % Vorsteuer', labelKey: 'goods7' };
const UTILITIES: Booking = { skr03: '4240', nameDe: 'Gas, Strom, Wasser', labelKey: 'utilities' };
const SALARIES: Booking = { skr03: '4120', nameDe: 'Gehälter', labelKey: 'salaries' };

export const PERSON: Person = {
  id: 'p1',
  firstName: 'Sara',
  lastName: 'Weber',
  businessIds: ['weber-design', 'sara-yoga', 'cafe-linde'],
};

export const BUSINESSES: Business[] = [
  {
    id: 'weber-design',
    name: 'Weber Design',
    taxProfile: { kleinunternehmer: false, vatPeriod: 'monthly' },
    accounts: [
      { id: 'wd-qonto', kind: 'bank', name: 'Qonto', balanceCents: 1248020, lastUpdate: '2026-10-21' },
      { id: 'wd-cash', kind: 'cash', name: 'Cash box', balanceCents: 15000, lastUpdate: '2026-10-14' },
    ],
    transactions: [
      { id: 'wd-t1', date: '2026-10-20', counterparty: 'Müller GmbH', accountId: 'wd-qonto', amountCents: 150000, status: 'confirm', booking: REVENUE_19 },
      { id: 'wd-t2', date: '2026-10-19', counterparty: 'Telekom', accountId: 'wd-qonto', amountCents: -3995, status: 'booked', booking: PHONE },
      { id: 'wd-t3', date: '2026-10-17', counterparty: 'Deutsche Bahn', accountId: 'wd-qonto', amountCents: -12000, status: 'noReceipt', booking: TRAVEL },
      { id: 'wd-t4', date: '2026-10-15', counterparty: 'Amazon', accountId: 'wd-qonto', amountCents: -4900, status: 'unclear', booking: null },
      { id: 'wd-t5', date: '2026-10-12', counterparty: 'Adobe', accountId: 'wd-qonto', amountCents: -5949, status: 'booked', booking: SOFTWARE },
      { id: 'wd-t6', date: '2026-10-13', counterparty: 'Rundfunk ARD, ZDF und Deutschlandradio Beitragsservice', accountId: 'wd-qonto', amountCents: -5508, status: 'booked', booking: OTHER_COSTS },
    ],
    decisionsOpen: 3,
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
  },
  {
    id: 'sara-yoga',
    name: 'Sara Weber Yoga',
    taxProfile: { kleinunternehmer: true, vatPeriod: null },
    accounts: [
      { id: 'sy-qonto', kind: 'bank', name: 'Qonto', balanceCents: 642075, lastUpdate: '2026-10-21' },
    ],
    transactions: [
      { id: 'sy-t1', date: '2026-10-19', counterparty: 'Studio Mitte, Kursgebühren Oktober', accountId: 'sy-qonto', amountCents: 96000, status: 'booked', booking: REVENUE_KU },
      { id: 'sy-t2', date: '2026-10-16', counterparty: 'Anna Keller, Workshop Wochenende', accountId: 'sy-qonto', amountCents: 18500, status: 'confirm', booking: REVENUE_KU },
      { id: 'sy-t3', date: '2026-10-10', counterparty: 'Raumhaus Berlin', accountId: 'sy-qonto', amountCents: -35000, status: 'booked', booking: RENT },
      { id: 'sy-t4', date: '2026-10-07', counterparty: 'Yogashop Berlin', accountId: 'sy-qonto', amountCents: -4890, status: 'booked', booking: SUPPLIES },
      { id: 'sy-t5', date: '2026-10-02', counterparty: 'Zoom Communications', accountId: 'sy-qonto', amountCents: -1590, status: 'booked', booking: SOFTWARE },
      { id: 'sy-t6', date: '2026-09-29', counterparty: 'Studio Mitte, Kursgebühren September', accountId: 'sy-qonto', amountCents: 96000, status: 'booked', booking: REVENUE_KU },
    ],
    decisionsOpen: 1,
    vatDue: null,
    incomeTaxReserveCents: 210000,
    revenueThisYearCents: 2130000,
    notices: [
      { id: 'sy-n1', kind: 'revenueLimit', urgency: 2, blocking: false, params: { percent: 85, limit: 25000 }, date: '2026-10-20' },
    ],
    noticeHistory: [
      { id: 'sy-h1', kind: 'revenueLimit', urgency: 2, blocking: false, params: { percent: 80, limit: 25000 }, date: '2026-09-24' },
    ],
  },
  {
    id: 'cafe-linde',
    name: 'Café Linde GbR',
    taxProfile: { kleinunternehmer: false, vatPeriod: 'quarterly' },
    accounts: [
      { id: 'cl-qonto', kind: 'bank', name: 'Qonto', balanceCents: 2315040, lastUpdate: '2026-10-21' },
      { id: 'cl-sparkasse', kind: 'bank', name: 'Sparkasse', balanceCents: 874512, lastUpdate: '2026-10-20' },
      { id: 'cl-cash', kind: 'cash', name: 'Cash box', balanceCents: 41230, lastUpdate: '2026-10-21' },
    ],
    transactions: [
      { id: 'cl-t1', date: '2026-10-20', counterparty: 'Tagesumsatz Kasse', accountId: 'cl-cash', amountCents: 68450, status: 'booked', booking: REVENUE_7 },
      { id: 'cl-t2', date: '2026-10-18', counterparty: 'Metro Großmarkt', accountId: 'cl-qonto', amountCents: -142380, status: 'booked', booking: GOODS_7 },
      { id: 'cl-t3', date: '2026-10-15', counterparty: 'Stadtwerke Hamburg', accountId: 'cl-sparkasse', amountCents: -28740, status: 'booked', booking: UTILITIES },
      { id: 'cl-t4', date: '2026-10-10', counterparty: 'Hausverwaltung Lindenallee', accountId: 'cl-sparkasse', amountCents: -185000, status: 'booked', booking: RENT },
      { id: 'cl-t5', date: '2026-10-07', counterparty: 'Lohnabrechnung Oktober', accountId: 'cl-qonto', amountCents: -310000, status: 'booked', booking: SALARIES },
      { id: 'cl-t6', date: '2026-10-03', counterparty: 'Catering Firma Dittmar', accountId: 'cl-qonto', amountCents: 54000, status: 'booked', booking: REVENUE_19 },
    ],
    decisionsOpen: 0,
    vatDue: { dueDate: '2027-01-10', amountCents: 412000 },
    incomeTaxReserveCents: 580000,
    revenueThisYearCents: 11240000,
    notices: [
      { id: 'cl-n1', kind: 'bankExpiry', urgency: 2, blocking: false, params: { bank: 'Sparkasse', days: 5 }, date: '2026-10-19' },
    ],
    noticeHistory: [
      { id: 'cl-h1', kind: 'terms', urgency: 1, blocking: false, params: {}, date: '2026-09-15' },
    ],
  },
];
