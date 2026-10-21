export type Lang = 'en' | 'de' | 'ar';
export type SetupState = 'new' | 'halfway' | 'active';
export type TxStatus = 'booked' | 'confirm' | 'noReceipt' | 'unclear';
export interface Account { id: string; kind: 'bank' | 'cash'; name: string; balanceCents: number; lastUpdate: string } // ISO date
export interface Booking { skr03: string; nameDe: string; labelKey: string } // labelKey -> i18n "booking.<labelKey>"
export interface Transaction { id: string; date: string; counterparty: string; accountId: string; amountCents: number; status: TxStatus; booking: Booking | null }
export type NoticeKind = 'terms' | 'bankExpiry' | 'unreadable' | 'revenueLimit';
export interface Notice { id: string; kind: NoticeKind; urgency: number; blocking: boolean; params: Record<string, string | number>; date: string } // lower urgency = more urgent; text from i18n "notice.<kind>.text" / ".action"
export interface TaxProfile { kleinunternehmer: boolean; vatPeriod: 'monthly' | 'quarterly' | null }
export interface Business { id: string; name: string; taxProfile: TaxProfile; accounts: Account[]; transactions: Transaction[]; decisionsOpen: number; vatDue: { dueDate: string; amountCents: number } | null; incomeTaxReserveCents: number; revenueThisYearCents: number; notices: Notice[]; noticeHistory: Notice[] }
export interface Person { id: string; firstName: string; lastName: string; businessIds: string[] }
