export type Lang = 'en' | 'de' | 'ar';
export type SetupState = 'new' | 'halfway' | 'active';
export type TxStatus = 'booked' | 'confirm' | 'noReceipt' | 'unclear';
export interface Account { id: string; kind: 'bank' | 'cash'; name: string; balanceCents: number; lastUpdate: string } // ISO date
export type ReceiptState = 'attached' | 'missing' | 'notNeeded';
export interface Booking { skr03: string; nameDe: string; labelKey: string; vatRate: 0 | 7 | 19 } // labelKey -> i18n "booking.<labelKey>"
export type HistoryKey = 'imported' | 'autoBooked' | 'confirmed' | 'receiptNotNeeded' | 'categoryChanged' | 'markedPrivate' | 'markedBusiness';
export interface HistoryEntry { date: string; key: HistoryKey; params: Record<string, string> } // text: i18n "history.<key>"; params.category holds a labelKey
export interface Transaction {
  id: string; date: string; counterparty: string; accountId: string; amountCents: number;
  booking: Booking | null; confirmed: boolean; isPrivate: boolean;
  receipt: ReceiptState; receiptFile: string | null;
  counterpartyIban: string; reference: string;
  history: HistoryEntry[];
  beforePrivate: { booking: Booking | null; confirmed: boolean; receipt: ReceiptState } | null;
} // the status is calculated by paymentStatus(), never stored
export type NoticeKind = 'terms' | 'bankExpiry' | 'unreadable' | 'revenueLimit';
export interface Notice { id: string; kind: NoticeKind; urgency: number; blocking: boolean; params: Record<string, string | number>; date: string } // lower urgency = more urgent; text from i18n "notice.<kind>.text" / ".action"
export interface TaxProfile { kleinunternehmer: boolean; vatPeriod: 'monthly' | 'quarterly' | null }
export interface Business { id: string; name: string; taxProfile: TaxProfile; accounts: Account[]; transactions: Transaction[]; vatDue: { dueDate: string; amountCents: number } | null; incomeTaxReserveCents: number; revenueThisYearCents: number; notices: Notice[]; noticeHistory: Notice[] }
export interface Person { id: string; firstName: string; lastName: string; businessIds: string[] }
