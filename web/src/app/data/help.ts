import type { TermKey } from '../core/i18n/term-keys';

// The Help answers, as data: which topic an answer belongs to, which German terms it explains and which page it talks
// about. The texts are in the translation files, under `help.answers.<id>.q` (the question) and `.a` (the answer, up to
// three paragraphs split by a blank line). Everything here is sample content for the demo.

/** The seven topics of the Help page, in the order it shows them. */
export type HelpTopic =
  'start' | 'payments' | 'receipts' | 'invoices' | 'taxes' | 'account' | 'privacy';

export const HELP_TOPICS: readonly HelpTopic[] = [
  'start',
  'payments',
  'receipts',
  'invoices',
  'taxes',
  'account',
  'privacy',
];

/** The pages of the app that Help offers its own questions for, and where a German term appears. */
export type HelpPage =
  'start' | 'payments' | 'documents' | 'invoices' | 'taxes' | 'reports' | 'settings';

export interface HelpAnswer {
  /** Lower-case and hyphenated: the address of the answer (`/help/<id>`) and the key of its texts. */
  id: string;
  topic: HelpTopic;
  /** The German terms the answer uses, shown as chips that explain on tap. */
  terms: TermKey[];
  /** The page the answer talks about, with the Help page it belongs to, or none. */
  link: { route: string; fragment?: string; page: HelpPage } | null;
}

/** The sample answers, grouped by topic in the order of `HELP_TOPICS`. */
export const HELP_ANSWERS: HelpAnswer[] = [
  // Getting started
  { id: 'setup-steps', topic: 'start', terms: [], link: { route: '/', page: 'start' } },
  { id: 'switch-business', topic: 'start', terms: [], link: { route: '/', page: 'start' } },
  {
    id: 'change-language',
    topic: 'start',
    terms: ['eigenbeleg', 'uebertragungsprotokoll', 'ustva'],
    link: { route: '/account', page: 'settings' },
  },

  // Bank and payments
  {
    id: 'connect-bank',
    topic: 'payments',
    terms: ['kontoauszug', 'camt'],
    link: { route: '/settings/bank/connect', page: 'settings' },
  },
  {
    id: 'renew-bank',
    topic: 'payments',
    terms: [],
    link: { route: '/settings', fragment: 'bank-accounts', page: 'settings' },
  },
  {
    id: 'payment-needs',
    topic: 'payments',
    terms: ['eigenbeleg', 'ustva'],
    link: { route: '/review', page: 'payments' },
  },
  {
    id: 'private-payment',
    topic: 'payments',
    terms: ['ustva', 'privateinlage'],
    link: { route: '/payments', page: 'payments' },
  },

  // Receipts and documents
  {
    id: 'add-receipt-phone',
    topic: 'receipts',
    terms: ['eingangsbeleg', 'ausgangsbeleg'],
    link: { route: '/documents', page: 'documents' },
  },
  {
    id: 'receipt-unreadable',
    topic: 'receipts',
    terms: ['eingangsbeleg'],
    link: { route: '/documents', page: 'documents' },
  },
  {
    id: 'self-issued',
    topic: 'receipts',
    terms: ['eigenbeleg'],
    link: { route: '/payments', page: 'payments' },
  },

  // Invoices
  {
    id: 'write-invoice',
    topic: 'invoices',
    terms: ['rechnung', 'stornorechnung'],
    link: { route: '/invoices/new', page: 'invoices' },
  },
  {
    id: 'e-invoice',
    topic: 'invoices',
    terms: ['eRechnung', 'zugferd', 'xrechnung', 'leitwegId', 'kleinunternehmer'],
    link: { route: '/invoices', page: 'invoices' },
  },
  {
    id: 'customer-pays',
    topic: 'invoices',
    terms: ['rechnung', 'zahlungserinnerung', 'mahnung'],
    link: { route: '/invoices', page: 'invoices' },
  },

  // Taxes and year-end
  {
    id: 'vat-due',
    topic: 'taxes',
    terms: ['ustva', 'dauerfristverlaengerung', 'kleinunternehmer'],
    link: { route: '/taxes', page: 'taxes' },
  },
  {
    id: 'send-return',
    topic: 'taxes',
    terms: ['ustva', 'elster', 'uebertragungsprotokoll'],
    link: { route: '/taxes', page: 'taxes' },
  },
  {
    id: 'payment-blocks-send',
    topic: 'taxes',
    terms: ['ustva'],
    link: { route: '/taxes', page: 'taxes' },
  },
  {
    id: 'klein-limit',
    topic: 'taxes',
    terms: ['kleinunternehmer', 'steuerberater'],
    link: { route: '/taxes', page: 'taxes' },
  },
  {
    id: 'close-month',
    topic: 'taxes',
    terms: ['festschreibung', 'bwa', 'ustva'],
    link: { route: '/reports', page: 'reports' },
  },
  {
    id: 'export-advisor',
    topic: 'taxes',
    terms: ['steuerberater', 'skr03', 'gdpdu'],
    link: { route: '/reports', page: 'reports' },
  },

  // Your account and people
  {
    id: 'invite-advisor',
    topic: 'account',
    terms: ['steuerberater'],
    link: { route: '/settings', fragment: 'people', page: 'settings' },
  },
  {
    id: 'six-digit-code',
    topic: 'account',
    terms: [],
    link: { route: '/account', page: 'settings' },
  },
  {
    id: 'roles',
    topic: 'account',
    terms: ['steuerberater'],
    link: { route: '/settings', fragment: 'people', page: 'settings' },
  },

  // Your data and privacy
  {
    id: 'who-sees-books',
    topic: 'privacy',
    terms: ['avv', 'steuerberater'],
    link: { route: '/settings', fragment: 'people', page: 'settings' },
  },
  {
    id: 'records-kept',
    topic: 'privacy',
    terms: ['eigenbeleg', 'festschreibung'],
    link: null,
  },
];

/**
 * The questions Help offers for the page the person came from, as ids of `HELP_ANSWERS`. Taxes has the first three
 * questions of its topic (the VAT return ones; a Kleinunternehmer's are `KLEINUNTERNEHMER_TAXES_QUESTIONS`); Reports has
 * closing a month, the export for the tax advisor and the VAT return; every other page has the answers of its topic.
 */
export const PAGE_QUESTIONS: Record<HelpPage, string[]> = {
  start: ['setup-steps', 'switch-business', 'change-language'],
  payments: ['connect-bank', 'renew-bank', 'payment-needs', 'private-payment'],
  documents: ['add-receipt-phone', 'receipt-unreadable', 'self-issued'],
  invoices: ['write-invoice', 'e-invoice', 'customer-pays'],
  taxes: ['vat-due', 'send-return', 'payment-blocks-send'],
  reports: ['close-month', 'export-advisor', 'vat-due'],
  settings: ['invite-advisor', 'six-digit-code', 'roles'],
};

/**
 * The questions Help offers under Taxes to a Kleinunternehmer, instead of `PAGE_QUESTIONS.taxes`: the limit first, then
 * the year-end questions. A Kleinunternehmer has no VAT return, so none of the three VAT return questions of
 * `PAGE_QUESTIONS.taxes` is offered: when it is due, what happens when I send it, and why a payment stops me sending it.
 */
export const KLEINUNTERNEHMER_TAXES_QUESTIONS: string[] = [
  'klein-limit',
  'close-month',
  'export-advisor',
];

/**
 * The pages of the app where each German term shows up (in the menu's order), for the line under a term in German terms A–Z.
 * Help groups the sign-up and Add a business under `start`, and Settings and My account under `settings`.
 */
export const TERM_PAGES: Record<TermKey, HelpPage[]> = {
  ustva: ['start', 'payments', 'taxes', 'settings'],
  euer: ['taxes'],
  kleinunternehmer: ['start', 'payments', 'documents', 'invoices', 'taxes', 'settings'],
  skr03: ['payments'],
  eigenbeleg: ['payments', 'documents'],
  eingangsbeleg: ['documents'],
  ausgangsbeleg: ['documents'],
  freiberufler: ['start', 'settings'],
  gewerbe: ['start', 'settings'],
  einzelunternehmen: ['start'],
  gbr: ['start', 'taxes'],
  avv: ['start'],
  steuerberater: ['settings'],
  dauerfristverlaengerung: ['settings'],
  istVersteuerung: ['settings'],
  sollVersteuerung: ['settings'],
  steuernummer: ['settings'],
  ustIdNr: ['invoices', 'settings'],
  finanzamt: ['taxes', 'settings'],
  umsatzsteuer: ['taxes'],
  vorsteuer: ['taxes'],
  elster: ['taxes'],
  einkommensteuererklaerung: ['taxes'],
  feststellungserklaerung: ['taxes'],
  umsatzsteuererklaerung: ['taxes'],
  uebertragungsprotokoll: ['taxes'],
  rechnung: ['invoices'],
  stornorechnung: ['invoices'],
  eRechnung: ['invoices'],
  zugferd: ['invoices'],
  xrechnung: ['invoices'],
  zahlungserinnerung: ['invoices'],
  mahnung: ['invoices'],
  leitwegId: ['invoices'],
  reverseCharge: ['invoices'],
  bwa: ['reports'],
  gdpdu: ['reports'],
  festschreibung: ['reports'],
  camt: ['payments', 'settings'],
  kontoauszug: ['payments'],
  kasse: ['documents'],
  privateinlage: ['settings'],
};
