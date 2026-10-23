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
  | 'cashAdded'
  | 'invoiceCreated'
  | 'invoiceSent' // params: email (the address it went to)
  | 'invoiceReminded' // params: level ('1' or '2')
  | 'invoicePaid'
  | 'invoicePartlyPaid'
  | 'invoiceCancelled' // params: number (of the cancellation invoice)
  | 'invoiceCancellation' // params: number (of the invoice it cancels)
  | 'invoiceDuplicated' // params: number (of the invoice it was copied from)
  | 'paidInCash'
  | 'paysInvoice' // on a payment; params: number
  | 'bookedByInvoice' // on a payment that pays an invoice taxed differently from how it was booked; params: category
  // On a business; `by` is the full name of who did it, `role` a Role id (shown with its "roles.<role>" word) and `until` an ISO date
  | 'personInvited' // params: email, role, by
  | 'invitationCancelled' // params: email, by
  | 'personJoined' // params: name, role, by (the person who joined)
  | 'roleChanged' // params: name, role (the new one), by
  | 'personRemoved' // params: name, by
  | 'personLeft' // params: name, by (the person who left)
  | 'ownerChanged' // params: name (the new owner), by
  | 'supportOn' // params: until, by
  | 'supportOff'; // params: by
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
  invoice: { id: string; role: 'invoice' | 'cancellation'; cancelled: boolean } | null; // set on the sent document of an invoice written in the app; null on every other document
} // the status is calculated by docStatus(), never stored
/** A ready-made reading result for a simulated upload; `plain` marks the receipts a pool repeats. */
export type PoolResult = Pick<Doc, 'name' | 'direction' | 'invoiceNo' | 'date' | 'dueDate' | 'amountCents' | 'vatRate' | 'duplicateOf' | 'booking'> & { plain: boolean };
export type NoticeKind = 'terms' | 'bankExpiry' | 'bankEnded' | 'unreadable' | 'revenueLimit' | 'invoiceOverdue';
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
/** A VAT return that was sent to the tax office: its period, when it was sent, the VAT it held and the transfer ticket. */
export interface SentVatReturn {
  periodStart: string; periodEnd: string; sentOn: string; // ISO dates; the period's first and last day, and the day it was sent
  chargedCents: number; paidCents: number; resultCents: number; // VAT charged, VAT paid, and charged minus paid (negative: a refund)
  ticket: string; // the transfer ticket, e.g. 'ET-2026-0908-41827'
  taxOffice: string | null; // the tax office it was sent to, as the tax number gave it then (null: it gave none); the receipt shows this, whatever the number is later
}
/** What a category adds up to in a year: the category's label, SKR03 account and German name (a `Booking`'s), and the amount. */
export interface CategoryTotal { labelKey: string; skr03: string; nameDe: string; cents: number }
/** The kind of customer decides the invoice format and what the invoice needs: a business, a private person or a public office. */
export type CustomerKind = 'business' | 'private' | 'public';
export interface InvoiceCustomer {
  name: string; street: string; postcode: string; city: string;
  country: string; // ISO 3166 alpha-2, 'DE' by default
  email: string; kind: CustomerKind;
  vatId: string | null; // the customer's EU VAT ID; needed for a business in another EU country
  leitwegId: string | null; // needed for a public office (XRechnung)
}
export type InvoiceUnit = 'piece' | 'hour' | 'day' | 'flat';
/** One line of an invoice; the unit price is net for a business that charges VAT, and as charged for a Kleinunternehmer. */
export interface InvoiceLine { description: string; quantity: number; unit: InvoiceUnit; unitPriceCents: number }
/** When the work was done: on one day, or during a month ('YYYY-MM'). */
export type ServicePeriod = { kind: 'date'; date: string } | { kind: 'month'; month: string };
/** The note an invoice carries instead of VAT: § 19 UStG, reverse charge (a business in another EU country), or not taxable in Germany (a business outside the EU). */
export type TaxNote = 'kleinunternehmer' | 'reverseCharge' | 'notTaxable';
/** The seller as an invoice prints it: the business's address, email and bank account from its invoice details, and its tax number and VAT ID from its tax details. */
export interface InvoiceSeller {
  name: string; street: string; postcode: string; city: string; email: string;
  iban: string | null; taxNumber: string | null; vatId: string | null;
}
/**
 * An invoice written in the app. A draft has no number and no `sentOn`; sending gives it both and freezes `vatRate`, `taxNote` and `seller`.
 * The status is calculated by invoiceStatus(), never stored.
 */
export interface Invoice {
  id: string; number: string | null; // null while a draft
  customer: InvoiceCustomer; lines: InvoiceLine[];
  vatRate: 0 | 7 | 19; taxNote: TaxNote | null; // the chosen rate for a draft; the frozen effective rate and note once sent
  language: 'de' | 'en'; issueDate: string; servicePeriod: ServicePeriod; paymentTermDays: number;
  sentOn: string | null; docId: string | null; paymentIds: string[]; // docId: the sent document on Documents
  seller: InvoiceSeller | null; // the seller as the invoice was sent with it (frozen then); null on a draft, which follows the business's details until it is sent
  reminders: { level: 1 | 2; sentOn: string }[];
  cancelledBy: string | null; cancels: string | null; // ids of the cancellation invoice, and of the invoice a cancellation invoice cancels
  history: HistoryEntry[]; // newest first
}
/** What the business prints on its invoices, and how they are numbered. */
export interface InvoiceProfile {
  name: string; street: string; postcode: string; city: string; email: string; iban: string | null;
  numberPattern: string; // e.g. 'RE-{YYYY}-{NNN}'
  paymentTermDays: number; language: 'de' | 'en';
}
/** What a person can do in one business: the owner has everything; the others are Full access, Receipts only and Tax advisor (Steuerberater:in), chosen when inviting. */
export type Role = 'owner' | 'full' | 'receipts' | 'advisor';
/** A person with access to a business, or an invitation waiting. Only the sample person has a login; the others are rows of the demo. */
export interface Member {
  id: string; personId: string | null; // the login behind the row; null for people who are only rows in the demo
  name: string | null; email: string; role: Role; status: 'joined' | 'invited'; // name: null while waiting
  invitedOn: string | null; expiresOn: string | null; joinedOn: string | null; // ISO dates; expiresOn is the last day the invitation link works
}
export interface Business {
  id: string; name: string; inboxEmail: string; taxProfile: TaxProfile; accounts: Account[]; transactions: Transaction[]; documents: Doc[];
  vatReturns: SentVatReturn[]; // the returns sent so far; the next one is calculated (see vat-return.ts), never stored
  legalForm: 'sole' | 'gbr'; // one person's business, or a partnership under civil law (Gesellschaft bürgerlichen Rechts): decides the tax return at year end
  /**
   * The months of this year before the business's first payment here (net for a business that charges VAT, gross for a
   * Kleinunternehmer), stored because no payments exist for them. The year figures (see tax-year.ts) add the payments to it.
   */
  yearOpening: { incomeCents: number; costsCents: number; costsByCategory: CategoryTotal[] };
  incomeTaxReserveCents: number;
  invoices: Invoice[]; invoiceProfile: InvoiceProfile; // the invoices written in the app (drafts included), and how they are printed and numbered
  notices: Notice[]; noticeHistory: Notice[]; categoryRules: CategoryRule[];
  history: HistoryEntry[]; // changes to the tax details, bank accounts, people and support access, newest first: stored, not shown yet
  people: Member[]; // everyone with access, and the invitations waiting; exactly one joined member is the owner
  supportUntil: string | null; // ISO date; the last day our support team can look at the books, null while it can't
}
/** A browser or phone where the person is signed in; sample rows, never read from the real browser. */
export interface Device { id: string; browser: string; system: string; place: string; lastSeen: string | null; current: boolean } // lastSeen null: now
/** A login: who signs in, in which language, from which devices, and how many backup codes are left. */
export interface Person { id: string; firstName: string; lastName: string; email: string; lang: Lang | null; devices: Device[]; backupCodesLeft: number } // lang null: not chosen yet
