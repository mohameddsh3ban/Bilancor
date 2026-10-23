import { DEMO_TODAY } from '../data/demo-date';
import type { Business, SentVatReturn, TaxProfile, Transaction } from '../data/models';
import { addDays, daysBetween } from './bank-connection';
import { paymentStatus } from './payment-status';

/** A due date this many days away (or fewer) is worth a reminder. */
export const DUE_SOON_DAYS = 21;

/** The day of the month on which a VAT return is due. */
const DUE_DAY = 10;

/**
 * The span a VAT return covers: a calendar month or a calendar quarter, as ISO dates with the first and last day
 * included. (Settings has its own `VatPeriod`, the answer "monthly, quarterly or yearly"; this is the span itself.)
 */
export interface TaxPeriod { start: string; end: string; kind: 'monthly' | 'quarterly' }

/** The VAT in a payment's gross amount: |gross| × rate ÷ (100 + rate), rounded to the cent. 0 with no booking or a rate of 0 (private bookings are 0 %). */
export function vatPartCents(tx: Transaction): number {
  const rate = tx.booking?.vatRate ?? 0;
  if (rate === 0) return 0;
  return Math.round((Math.abs(tx.amountCents) * rate) / (100 + rate));
}

/** An ISO date from a UTC date, which `Date.UTC` builds with the month and day overflowing into the next month or year. */
const isoOf = (year: number, monthIndex: number, day: number): string =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

/** The calendar month or quarter that holds `date` (an ISO date). */
export function periodFor(date: string, kind: TaxPeriod['kind']): TaxPeriod {
  const year = Number(date.slice(0, 4));
  const length = kind === 'quarterly' ? 3 : 1;
  const first = Math.floor((Number(date.slice(5, 7)) - 1) / length) * length; // month index, 0 is January
  // Day 0 of the month after the period is the period's last day.
  return { start: isoOf(year, first, 1), end: isoOf(year, first + length, 0), kind };
}

/** The period right after another, in the same kind. */
export function nextPeriod(p: TaxPeriod): TaxPeriod {
  return periodFor(addDays(p.end, 1), p.kind);
}

/** The period a sent return was for: a month or a quarter, as the stored return has only its first and last day. */
export function sentPeriod(sent: Pick<SentVatReturn, 'periodStart' | 'periodEnd'>): TaxPeriod {
  const sameMonth = sent.periodStart.slice(0, 7) === sent.periodEnd.slice(0, 7);
  return { start: sent.periodStart, end: sent.periodEnd, kind: sameMonth ? 'monthly' : 'quarterly' };
}

/**
 * The day a period's return is due: the 10th of the month after it ends, one month later with a permanent extension
 * (Dauerfristverlängerung). The mockup keeps the 10th even on a weekend; the real product would move it to the next working day.
 */
export function dueDateFor(p: TaxPeriod, profile: TaxProfile): string {
  const year = Number(p.end.slice(0, 4));
  const monthIndex = Number(p.end.slice(5, 7)) - 1; // the month the period ends in, 0 is January
  return isoOf(year, monthIndex + 1 + (profile.permanentExtension ? 1 : 0), DUE_DAY);
}

/** One VAT return as the Taxes page and the reminders show it: its period and date, its state, and the figures of the booked payments. */
export interface VatReturnView {
  period: TaxPeriod;
  dueDate: string;
  daysLeft: number; // days from today to the due date; below 0 when overdue
  /** In progress while the period is still running (it can't be sent yet), overdue once the due date has passed, ready in between. */
  state: 'inProgress' | 'ready' | 'overdue';
  chargedCents: number; // VAT charged (Umsatzsteuer): the VAT part of the money that came in
  paidCents: number; // VAT paid (Vorsteuer): the VAT part of the money that went out
  resultCents: number; // charged − paid: positive is to pay, negative is a refund
  salesCount: number; // money in that carries VAT
  salesNetCents: number; // the net amount of those sales
  purchasesCount: number; // money out that carries VAT
  needsYouCount: number; // payments in the period that are not booked yet, and so are left out
  amountKnown: boolean; // false when no booked payment in the period carries VAT, so the amounts are only zeros
}

/**
 * The VAT return of `business` for `period`, from its payments dated in the period (payment dates, as for Ist-Versteuerung)
 * that are booked: money in adds VAT charged and a sale, money out adds VAT paid and a purchase. A payment that carries
 * no VAT (wages, private money) adds nothing. `today` is an ISO date, never the real clock.
 */
export function vatReturnFor(business: Business, period: TaxPeriod, today: string = DEMO_TODAY): VatReturnView {
  const dueDate = dueDateFor(period, business.taxProfile);
  let chargedCents = 0;
  let paidCents = 0;
  let salesCount = 0;
  let salesNetCents = 0;
  let purchasesCount = 0;
  let needsYouCount = 0;
  let amountKnown = false;

  for (const tx of business.transactions) {
    if (tx.date < period.start || tx.date > period.end) continue;
    if (paymentStatus(tx) !== 'booked') {
      needsYouCount++;
      continue;
    }
    if ((tx.booking?.vatRate ?? 0) > 0) amountKnown = true;
    const vat = vatPartCents(tx);
    if (vat === 0) continue;
    if (tx.amountCents > 0) {
      chargedCents += vat;
      salesCount++;
      salesNetCents += tx.amountCents - vat;
    } else {
      paidCents += vat;
      purchasesCount++;
    }
  }

  return {
    period,
    dueDate,
    daysLeft: daysBetween(today, dueDate),
    state: period.end >= today ? 'inProgress' : dueDate < today ? 'overdue' : 'ready',
    chargedCents,
    paidCents,
    resultCents: chargedCents - paidCents,
    salesCount,
    salesNetCents,
    purchasesCount,
    needsYouCount,
    amountKnown,
  };
}

/**
 * What a return comes to, as the screens word it: to pay, or a refund, with the amount as a positive number (a
 * negative VAT result is money back). A result of nothing is nothing to pay. The Taxes page and the homepage's tax
 * card and tile all word the result through this, so they never disagree.
 */
export function resultWording(view: Pick<VatReturnView, 'resultCents'>): { key: 'pay' | 'refund'; cents: number } {
  return { key: view.resultCents < 0 ? 'refund' : 'pay', cents: Math.abs(view.resultCents) };
}

/** How the days left to a due date are said, as the end of a `taxReminder` translation key: "today", "in 1 day" or "in {n} days". */
export function daysLeftWording(daysLeft: number): 'today' | 'inOneDay' | 'inDays' {
  if (daysLeft === 0) return 'today';
  return daysLeft === 1 ? 'inOneDay' : 'inDays';
}

/** The VAT return a business is working on: one with a date, a yearly return that has no monthly or quarterly date, or none. */
export type CurrentVat = { kind: 'return'; view: VatReturnView } | { kind: 'yearly' } | null;

/**
 * The return still to send, from the tax answers and the returns sent so far. It is the period right after the latest
 * sent one, cut again in the kind the answers give now (a business that switched from monthly to quarterly continues
 * in quarters), and the period that holds `today` when nothing was sent yet. Null for a Kleinunternehmer, who files no
 * VAT return, and while the period is not answered; a yearly return has no such period.
 */
export function currentVatReturn(business: Business, today: string = DEMO_TODAY): CurrentVat {
  const { kleinunternehmer, vatPeriod } = business.taxProfile;
  if (kleinunternehmer || vatPeriod === null) return null;
  if (vatPeriod === 'yearly') return { kind: 'yearly' };

  const latest = business.vatReturns.reduce<string | null>((end, sent) => (end === null || sent.periodEnd > end ? sent.periodEnd : end), null);
  const period = periodFor(latest === null ? today : addDays(latest, 1), vatPeriod);
  return { kind: 'return', view: vatReturnFor(business, period, today) };
}
