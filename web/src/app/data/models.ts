export type Lang = 'en' | 'de' | 'ar';
/** The demo toolbar's three shortcuts for how far a business is set up. */
export type SetupState = 'new' | 'halfway' | 'active';
/** The three setup steps of a business, each done or not. */
export interface SetupSteps { bank: boolean; tax: boolean; receipt: boolean }
export type TxStatus = 'booked' | 'confirm' | 'noReceipt' | 'unclear';
/** How an account gets its payments: a bank connection (with a consent that ends), imported statements, or the cash box. */
export interface AccountConnection {
  kind: 'connected' | 'statement' | 'cash';
  consentUntil: string | null; // ISO date; the day the bank consent ends (connected only)
  lastFetched: string | null; // ISO date-time, local demo time, e.g. '2026-10-22T06:12' (connected only)
  fetchFrom: string | null; // ISO date; the first day payments were asked for. Stored, filters nothing in the mockup
  broken: boolean; // the bank says the connection no longer works
}
export interface Account {
  id: string; kind: 'bank' | 'cash'; name: string; balanceCents: number; lastUpdate: string; // ISO date
  connection: AccountConnection; product: 'business' | 'savings' | 'card' | 'cash';
  iban: string | null; // null for the cash box
}
export type ReceiptState = 'attached' | 'missing' | 'notNeeded';
export interface Booking { skr03: string; nameDe: string; labelKey: string; vatRate: 0 | 7 | 19 } // labelKey -> i18n "booking.<labelKey>"
export type HistoryKey =
  | 'imported'
  | 'autoBooked'
  | 'confirmed'
  | 'receiptNotNeeded'
  | 'categoryChanged'
  | 'markedPrivate'
  | 'markedBusiness'
  | 'addedPhoto'
  | 'addedFile'
  | 'addedEmail'
  | 'docRead'
  | 'docEdited'
  | 'markedReceived'
  | 'markedSent'
  | 'keptDuplicate'
  | 'linked'
  | 'linkedAuto'
  | 'unlinked'
  | 'receiptLinked'
  | 'receiptLinkedAuto'
  | 'receiptUnlinked'
  | 'bookedByRule'
  | 'taxChanged'
  | 'bankConnected' // params: bank, account
  | 'bankRenewed' // params: bank
  | 'cashAdded';
/** What the review inbox learned: payments from this counterparty (its `counterpartyKey`) get this booking. */
export interface CategoryRule { counterpartyKey: string; booking: Booking }
export interface HistoryEntry { date: string; key: HistoryKey; params: Record<string, string> } // text: i18n "history.<key>"; params.category holds a labelKey
export interface Transaction {
  id: string; date: string; counterparty: string; accountId: string; amountCents: number;
  booking: Booking | null; confirmed: boolean; isPrivate: boolean;
  receipt: ReceiptState; receiptFile: string | null;
  counterpartyIban: string; reference: string;
  history: HistoryEntry[]; // newest first: every action adds its line at the front
  beforePrivate: { booking: Booking | null; confirmed: boolean; receipt: ReceiptState } | null;
  beforeLink: { booking: Booking | null; confirmed: boolean; receipt: ReceiptState } | null; // what the payment had before a document was linked to it
  suggestions?: string[]; // up to three category labelKeys the system would offer for an unclear payment
} // the status is calculated by paymentStatus(), never stored
export type DocDirection = 'received' | 'sent';
export type DocSource = 'photo' | 'file' | 'email';
export type DocField = 'amount' | 'date' | 'name';
export type DocStatus = 'reading' | 'duplicate' | 'direction' | 'checkAmount' | 'checkDate' | 'checkName' | 'waiting' | 'overdue' | 'done';
export interface Doc {
  id: string; fileName: string; source: DocSource; addedOn: string; fromUpload: boolean; reading: boolean;
  name: string | null; direction: DocDirection | null; invoiceNo: string;
  date: string | null; dueDate: string | null; amountCents: number | null; vatRate: 0 | 7 | 19; // amount: gross, positive
  duplicateOf: string | null; // id of the document this looks like
  booking: Booking | null; bookingConfirmed: boolean; // the prepared booking while not linked
  paymentId: string | null;
  history: HistoryEntry[]; // newest first
} // the status is calculated by docStatus(), never stored
/** A ready-made reading result for a simulated upload; `plain` marks the receipts a pool repeats. */
export type PoolResult = Pick<Doc, 'name' | 'direction' | 'invoiceNo' | 'date' | 'dueDate' | 'amountCents' | 'vatRate' | 'duplicateOf' | 'booking'> & { plain: boolean };
export type NoticeKind = 'terms' | 'bankExpiry' | 'bankEnded' | 'unreadable' | 'revenueLimit';
export interface Notice { id: string; kind: NoticeKind; urgency: number; blocking: boolean; params: Record<string, string | number>; date: string } // lower urgency = more urgent; text from i18n "notice.<kind>.text" / ".action"
export type BusinessKind = 'freelance' | 'trade';
export type VatPeriod = 'monthly' | 'quarterly' | 'yearly';
/** The answers of "Your tax details". The VAT answers are null / false for a Kleinunternehmer. */
export interface TaxProfile {
  businessKind: BusinessKind; kleinunternehmer: boolean;
  vatPeriod: VatPeriod | null; permanentExtension: boolean; vatBasis: 'ist' | 'soll' | null; // null / false when kleinunternehmer
  taxState: string | null; taxNumber: string | null; vatId: string | null; // taxState: a GERMAN_STATES id
  fiscalYearStart: string; // 'MM-DD', '01-01' for the calendar year
}
export interface Business {
  id: string; name: string; inboxEmail: string; taxProfile: TaxProfile; accounts: Account[]; transactions: Transaction[]; documents: Doc[];
  vatDue: { dueDate: string; amountCents: number } | null; incomeTaxReserveCents: number; revenueThisYearCents: number;
  notices: Notice[]; noticeHistory: Notice[]; categoryRules: CategoryRule[];
  history: HistoryEntry[]; // changes to the tax details and bank accounts, newest first: stored, not shown yet
}
export interface Person { id: string; firstName: string; lastName: string; businessIds: string[] }
