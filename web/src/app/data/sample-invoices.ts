import type { CustomerKind, HistoryEntry, Invoice, InvoiceCustomer, InvoiceLine, InvoiceProfile, InvoiceUnit } from './models';

// All customers, addresses and amounts below are invented. Amounts are integer cents, net for a business that charges VAT
// and as charged for a Kleinunternehmer. The invoices are the ones behind payments and sent documents elsewhere in the
// sample data (sample-data.ts and sample-documents.ts), so their numbers and amounts match; sample-invoices.spec.ts checks it.
// This file must not import sample-data.ts: sample-data.ts imports it to attach the invoices to the businesses.

const customer = (
  name: string,
  street: string,
  postcode: string,
  city: string,
  email: string,
  kind: CustomerKind = 'business',
  leitwegId: string | null = null,
): InvoiceCustomer => ({ name, street, postcode, city, country: 'DE', email, kind, vatId: null, leitwegId });

const line = (description: string, quantity: number, unit: InvoiceUnit, unitPriceCents: number): InvoiceLine => ({
  description,
  quantity,
  unit,
  unitPriceCents,
});

/** What one sent sample invoice needs to say; `sent()` fills in the rest. */
interface SentSpec {
  id: string;
  number: string;
  customer: InvoiceCustomer;
  lines: InvoiceLine[];
  issued: string; // the invoice date, and the day it was sent
  month: string; // 'YYYY-MM': when the work was done
  docId: string; // its sent document
  termDays?: number; // default 14
  kleinunternehmer?: boolean; // no VAT and the § 19 note
  pays?: { paymentId: string; on: string; part?: boolean }; // the payment that settled it (or part of it), and the day it came in
  reminders?: Invoice['reminders'];
  cancelledBy?: { id: string; number: string; on: string };
  cancels?: { id: string; number: string };
}

/** A sent invoice, with the history it would have: created, sent by email, then what happened (newest first, like every action adds it). A cancellation invoice has only the line that it was made to cancel. */
function sent(s: SentSpec): Invoice {
  const oldestFirst: HistoryEntry[] = s.cancels
    ? [{ date: s.issued, key: 'invoiceCancellation', params: { number: s.cancels.number } }]
    : [
        { date: s.issued, key: 'invoiceCreated', params: {} },
        { date: s.issued, key: 'invoiceSent', params: { email: s.customer.email } },
      ];
  for (const reminder of s.reminders ?? []) oldestFirst.push({ date: reminder.sentOn, key: 'invoiceReminded', params: { level: String(reminder.level) } });
  if (s.pays) oldestFirst.push({ date: s.pays.on, key: s.pays.part ? 'invoicePartlyPaid' : 'invoicePaid', params: {} });
  if (s.cancelledBy) oldestFirst.push({ date: s.cancelledBy.on, key: 'invoiceCancelled', params: { number: s.cancelledBy.number } });
  const history = oldestFirst.reverse();
  return {
    id: s.id,
    number: s.number,
    customer: s.customer,
    lines: s.lines,
    vatRate: s.kleinunternehmer ? 0 : 19,
    taxNote: s.kleinunternehmer ? 'kleinunternehmer' : null,
    language: 'de',
    issueDate: s.issued,
    servicePeriod: { kind: 'month', month: s.month },
    paymentTermDays: s.termDays ?? 14,
    sentOn: s.issued,
    docId: s.docId,
    paymentIds: s.pays ? [s.pays.paymentId] : [],
    reminders: s.reminders ?? [],
    cancelledBy: s.cancelledBy?.id ?? null,
    cancels: s.cancels?.id ?? null,
    history,
  };
}

// Weber Design: VAT at 19 %. Each net amount is chosen so that the gross is exactly the payment that settled it.
const MUELLER = customer('Müller GmbH', 'Hauptstr. 18', '10827', 'Berlin', 'rechnungen@mueller-gmbh.example');
const SOMMER = customer('Atelier Sommer GmbH', 'Oranienstr. 42', '10999', 'Berlin', 'buchhaltung@atelier-sommer.example');
const KERN = customer('Studio Kern', 'Torstr. 112', '10119', 'Berlin', 'kontakt@studio-kern.example');
const LANGE = customer('Bäckerei Lange', 'Schönhauser Allee 57', '10437', 'Berlin', 'info@baeckerei-lange.example');
const NORD = customer('Agentur Nord', 'Hafenstr. 9', '24103', 'Kiel', 'buero@agentur-nord.example');
const PANKOW = customer('Bezirksamt Pankow', 'Rathausstr. 3', '13187', 'Berlin', 'rechnungseingang@bezirksamt-pankow.example', 'public', '11001-01234-56');

/** The two lines of the invoice to Agentur Nord: 2 h at 80,00 € and a flat 340,00 € (net 500,00 €); the cancellation invoice has them negated. */
const NORD_LINES = [line('Design-Beratung', 2, 'hour', 8000), line('Logo-Überarbeitung', 1, 'flat', 34000)];
const negated = (lines: InvoiceLine[]): InvoiceLine[] => lines.map((l) => ({ ...l, quantity: -l.quantity }));

const WEBER_INVOICES: Invoice[] = [
  sent({
    id: 'inv-wd-031', number: 'RE-2026-031', customer: MUELLER, issued: '2026-08-14', month: '2026-08', docId: 'doc-wd-t13',
    lines: [line('Webdesign, Stunden', 11, 'hour', 8500), line('Hosting und Wartung, Quartal', 1, 'flat', 32550)], // net 1.260,50 €, gross 1.500,00 €
    pays: { paymentId: 'wd-t13', on: '2026-08-28' },
  }),
  sent({
    id: 'inv-wd-036', number: 'RE-2026-036', customer: SOMMER, issued: '2026-09-01', month: '2026-08', docId: 'doc-wd-t11',
    lines: [line('Logo-Entwurf, Phase 2', 1, 'flat', 99000), line('Abstimmungstermine', 6, 'hour', 8500)], // net 1.500,00 €, gross 1.785,00 €
    pays: { paymentId: 'wd-t11', on: '2026-09-15' },
  }),
  sent({
    id: 'inv-wd-038', number: 'RE-2026-038', customer: MUELLER, issued: '2026-09-12', month: '2026-09', docId: 'doc-wd-t9',
    lines: [line('Webdesign, Stunden', 13, 'hour', 8500), line('Bildbearbeitung', 1, 'flat', 15550)], // net 1.260,50 €, gross 1.500,00 €
    pays: { paymentId: 'wd-t9', on: '2026-09-26' },
  }),
  // Bäckerei Lange has not paid and was not reminded yet: overdue since 30 September.
  sent({
    id: 'inv-wd-039', number: 'RE-2026-039', customer: LANGE, issued: '2026-09-16', month: '2026-09', docId: 'wd-d3',
    lines: [line('Gestaltung Speisekarte', 1, 'flat', 66000), line('Abstimmung und Korrekturen', 4, 'hour', 8500)], // net 1.000,00 €, gross 1.190,00 €
  }),
  // Written to Agentur Nord by mistake: cancelled on 7 October with RE-2026-042.
  sent({
    id: 'inv-wd-040', number: 'RE-2026-040', customer: NORD, issued: '2026-10-01', month: '2026-09', docId: 'wd-d5',
    lines: NORD_LINES, // net 500,00 €, gross 595,00 €
    cancelledBy: { id: 'inv-wd-042', number: 'RE-2026-042', on: '2026-10-07' },
  }),
  sent({
    id: 'inv-wd-041', number: 'RE-2026-041', customer: MUELLER, issued: '2026-10-05', month: '2026-09', docId: 'doc-wd-t1',
    lines: [line('Webdesign, Stunden', 14, 'hour', 8500), line('Stockfotos und Lizenzen', 1, 'piece', 7050)], // net 1.260,50 €, gross 1.500,00 €
    pays: { paymentId: 'wd-t1', on: '2026-10-20' },
  }),
  sent({
    id: 'inv-wd-042', number: 'RE-2026-042', customer: NORD, issued: '2026-10-07', month: '2026-09', docId: 'wd-d6',
    lines: negated(NORD_LINES), // net -500,00 €, gross -595,00 €
    cancels: { id: 'inv-wd-040', number: 'RE-2026-040' },
  }),
  sent({
    id: 'inv-wd-043', number: 'RE-2026-043', customer: SOMMER, issued: '2026-10-08', month: '2026-10', docId: 'doc-wd-t7',
    lines: [line('Markenentwicklung, Konzept und Entwürfe', 1, 'flat', 165000), line('Abstimmung und Korrekturen', 10, 'hour', 8500)], // net 2.500,00 €, gross 2.975,00 €
    pays: { paymentId: 'wd-t7', on: '2026-10-09' },
  }),
  // Studio Kern's payment (wd-t19) is in the bank, but nothing says it is for this invoice: the review inbox asks.
  sent({
    id: 'inv-wd-044', number: 'RE-2026-044', customer: KERN, issued: '2026-10-16', month: '2026-10', docId: 'wd-d2',
    lines: [line('Corporate Design, Konzept', 1, 'flat', 115000), line('Umsetzung Website', 10, 'hour', 8500)], // net 2.000,00 €, gross 2.380,00 €
  }),
  // The draft to a public office: an XRechnung with a Leitweg-ID, one flat line.
  {
    id: 'inv-wd-draft',
    number: null,
    customer: PANKOW,
    lines: [line('Gestaltung und Satz Jahresbericht 2026', 1, 'flat', 350000)], // net 3.500,00 €, gross 4.165,00 €
    vatRate: 19,
    taxNote: null,
    language: 'de',
    issueDate: '2026-10-22',
    servicePeriod: { kind: 'month', month: '2026-10' },
    paymentTermDays: 14,
    sentOn: null,
    docId: null,
    paymentIds: [],
    reminders: [],
    cancelledBy: null,
    cancels: null,
    history: [{ date: '2026-10-22', key: 'invoiceCreated', params: {} }],
  },
];

// Café Linde: VAT at 19 % on catering (the cash-register closings are not invoices).
const DITTMAR = customer('Catering Firma Dittmar', 'Speicherstr. 14', '20457', 'Hamburg', 'einkauf@dittmar-catering.example');
const HOFFMANN = customer('Kanzlei Hoffmann', 'Neuer Wall 50', '20354', 'Hamburg', 'sekretariat@kanzlei-hoffmann.example');

const CAFE_INVOICES: Invoice[] = [
  sent({
    id: 'inv-cl-044', number: 'RE-2026-044', customer: DITTMAR, issued: '2026-07-03', month: '2026-07', docId: 'doc-cl-t17',
    lines: [line('Sommerfest, Buffet pro Person', 200, 'piece', 2900), line('Getränke und Service', 1, 'flat', 220000)], // net 8.000,00 €, gross 9.520,00 €
    pays: { paymentId: 'cl-t17', on: '2026-07-17' },
  }),
  sent({
    id: 'inv-cl-049', number: 'RE-2026-049', customer: DITTMAR, issued: '2026-09-05', month: '2026-09', docId: 'doc-cl-t9',
    lines: [line('Buffet Firmenfeier, pro Person', 32, 'piece', 1050), line('Getränkepauschale', 1, 'flat', 6736)], // net 403,36 €, gross 480,00 €
    pays: { paymentId: 'cl-t9', on: '2026-09-19' },
  }),
  sent({
    id: 'inv-cl-052', number: 'RE-2026-052', customer: DITTMAR, issued: '2026-09-19', month: '2026-09', docId: 'doc-cl-t6',
    lines: [line('Buffet Firmenfeier, pro Person', 36, 'piece', 1050), line('Getränkepauschale', 1, 'flat', 7578)], // net 453,78 €, gross 540,00 €
    pays: { paymentId: 'cl-t6', on: '2026-10-03' },
  }),
  // Due on 9 October, the friendly reminder went out on 12 October: since 19 October the formal reminder (Mahnung) is possible.
  sent({
    id: 'inv-cl-053', number: 'RE-2026-053', customer: HOFFMANN, issued: '2026-09-25', month: '2026-09', docId: 'cl-d1',
    lines: [line('Catering Kanzleijubiläum, pro Person', 60, 'piece', 1500), line('Service und Geschirr', 1, 'flat', 18000)], // net 1.080,00 €, gross 1.285,20 €
    reminders: [{ level: 1, sentOn: '2026-10-12' }],
  }),
];

// Sara Weber Yoga: a Kleinunternehmer, so no VAT, the § 19 note, and the amounts are the gross.
const STUDIO_MITTE = customer('Studio Mitte', 'Brunnenstr. 88', '10119', 'Berlin', 'kurse@studio-mitte.example');
const KELLER = customer('Anna Keller', 'Gneisenaustr. 21', '10961', 'Berlin', 'anna.keller@mail.example', 'private');
const PETERS = customer('Jonas Peters', 'Boxhagener Str. 30', '10245', 'Berlin', 'jonas.peters@mail.example', 'private');
const PHYSIO = customer('Physio Zentrum Mitte', 'Invalidenstr. 60', '10557', 'Berlin', 'praxis@physio-zentrum-mitte.example');

const SARA_INVOICES: Invoice[] = [
  sent({
    id: 'inv-sy-013', number: 'RE-2026-013', customer: STUDIO_MITTE, issued: '2026-08-15', month: '2026-08', docId: 'doc-sy-t12', kleinunternehmer: true,
    lines: [line('Yogakurse August, 8 Einheiten', 8, 'piece', 12000)], // 960,00 €
    pays: { paymentId: 'sy-t12', on: '2026-08-29' },
  }),
  sent({
    id: 'inv-sy-016', number: 'RE-2026-016', customer: STUDIO_MITTE, issued: '2026-09-15', month: '2026-09', docId: 'doc-sy-t6', kleinunternehmer: true,
    lines: [line('Yogakurse September, 8 Einheiten', 8, 'piece', 12000)], // 960,00 €
    pays: { paymentId: 'sy-t6', on: '2026-09-29' },
  }),
  sent({
    id: 'inv-sy-017', number: 'RE-2026-017', customer: PETERS, issued: '2026-09-16', month: '2026-09', docId: 'doc-sy-t9', kleinunternehmer: true,
    lines: [line('Privatstunde', 2, 'hour', 6000)], // 120,00 €
    pays: { paymentId: 'sy-t9', on: '2026-09-17' },
  }),
  sent({
    id: 'inv-sy-019', number: 'RE-2026-019', customer: STUDIO_MITTE, issued: '2026-10-05', month: '2026-10', docId: 'doc-sy-t1', kleinunternehmer: true,
    lines: [line('Yogakurse Oktober, 8 Einheiten', 8, 'piece', 12000)], // 960,00 €
    pays: { paymentId: 'sy-t1', on: '2026-10-19' },
  }),
  sent({
    id: 'inv-sy-020', number: 'RE-2026-020', customer: KELLER, issued: '2026-10-08', month: '2026-10', docId: 'doc-sy-t2', kleinunternehmer: true,
    lines: [line('Workshop Wochenende', 1, 'flat', 18500)], // 185,00 €
    pays: { paymentId: 'sy-t2', on: '2026-10-16' },
  }),
  // A part payment of 300,00 € came in on 21 October: 300,00 € are left, due on 13 November.
  sent({
    id: 'inv-sy-021', number: 'RE-2026-021', customer: PHYSIO, issued: '2026-10-14', month: '2026-10', docId: 'sy-d2', kleinunternehmer: true, termDays: 30,
    lines: [line('Yogakurs für Mitarbeitende, 5 Termine', 5, 'piece', 12000)], // 600,00 €
    pays: { paymentId: 'sy-t15', on: '2026-10-21', part: true },
  }),
];

/** The invoices each business has written in the app, by business id; the sent ones are those behind its sample payments and sent documents. */
export const SAMPLE_INVOICES: Record<string, Invoice[]> = {
  'weber-design': WEBER_INVOICES,
  'sara-yoga': SARA_INVOICES,
  'cafe-linde': CAFE_INVOICES,
};

/** What each business prints on its invoices: its address, its first bank account (as in sample-data.ts), the usual numbering, 14 days, German. */
export const INVOICE_PROFILES: Record<string, InvoiceProfile> = {
  'weber-design': {
    name: 'Weber Design',
    street: 'Lindenstr. 5',
    postcode: '10969',
    city: 'Berlin',
    email: 'weber-design@invoices.example',
    iban: 'DE08100101010482913650',
    numberPattern: 'RE-{YYYY}-{NNN}',
    paymentTermDays: 14,
    language: 'de',
  },
  'sara-yoga': {
    name: 'Sara Weber Yoga',
    street: 'Kastanienallee 12',
    postcode: '10435',
    city: 'Berlin',
    email: 'sara-yoga@invoices.example',
    iban: 'DE98100101010561742087',
    numberPattern: 'RE-{YYYY}-{NNN}',
    paymentTermDays: 14,
    language: 'de',
  },
  'cafe-linde': {
    name: 'Café Linde GbR',
    street: 'Lindenallee 4',
    postcode: '20259',
    city: 'Hamburg',
    email: 'cafe-linde@invoices.example',
    iban: 'DE44100101010637185294',
    numberPattern: 'RE-{YYYY}-{NNN}',
    paymentTermDays: 14,
    language: 'de',
  },
};
