import { DEMO_TODAY } from '../data/demo-date';
import type { Business, CategoryTotal } from '../data/models';
import { paymentStatus } from './payment-status';
import { vatPartCents } from './vat-return';

/** The returns a business makes for a year; the page names each with its German term. */
export type YearReturn = 'euer' | 'einkommensteuererklaerung' | 'feststellungserklaerung' | 'umsatzsteuererklaerung';

/** The year so far as the Taxes page shows it: the stored opening line plus what the booked payments add. */
export interface YearSummary {
  openingIncomeCents: number; openingCostsCents: number; // the months before the first payment, as stored
  paymentsIncomeCents: number; paymentsCostsCents: number; // from the booked payments, since `paymentsSince`
  incomeCents: number; costsCents: number; profitCents: number; // opening + payments
  paymentsSince: string; // the date of the business's first payment this year, or 1 January when it has none
  byCategory: CategoryTotal[]; // the costs, opening merged in, largest first
  returns: YearReturn[]; // in the order the page lists them
  dueDate: string; // the 31 July after the year
}

/**
 * The year of `today` (a calendar year, up to `today`) for a business. From payments, those that are booked and not
 * private count: money in is income, money out is costs, net of VAT for a business that charges VAT and gross for a
 * Kleinunternehmer, who neither charges nor gets back VAT. The business's `yearOpening` adds the months before its
 * first payment. `today` is an ISO date, never the real clock.
 */
export function yearSummary(business: Business, today: string = DEMO_TODAY): YearSummary {
  const year = Number(today.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const chargesVat = !business.taxProfile.kleinunternehmer;
  const thisYear = business.transactions.filter((tx) => tx.date >= yearStart && tx.date <= today);

  const opening = business.yearOpening;
  const categories = new Map<string, CategoryTotal>(opening.costsByCategory.map((c) => [c.labelKey, { ...c }]));
  let paymentsIncomeCents = 0;
  let paymentsCostsCents = 0;

  for (const tx of thisYear) {
    if (tx.isPrivate || paymentStatus(tx) !== 'booked') continue;
    const cents = Math.abs(tx.amountCents) - (chargesVat ? vatPartCents(tx) : 0);
    if (tx.amountCents > 0) {
      paymentsIncomeCents += cents;
      continue;
    }
    paymentsCostsCents += cents;
    const { labelKey, skr03, nameDe } = tx.booking!; // a booked payment has its booking
    const category = categories.get(labelKey);
    if (category) category.cents += cents;
    else categories.set(labelKey, { labelKey, skr03, nameDe, cents });
  }

  const returns: YearReturn[] = ['euer', business.legalForm === 'gbr' ? 'feststellungserklaerung' : 'einkommensteuererklaerung'];
  if (chargesVat) returns.push('umsatzsteuererklaerung');

  const incomeCents = opening.incomeCents + paymentsIncomeCents;
  const costsCents = opening.costsCents + paymentsCostsCents;
  return {
    openingIncomeCents: opening.incomeCents,
    openingCostsCents: opening.costsCents,
    paymentsIncomeCents,
    paymentsCostsCents,
    incomeCents,
    costsCents,
    profitCents: incomeCents - costsCents,
    paymentsSince: thisYear.reduce((first, tx) => (tx.date < first ? tx.date : first), thisYear[0]?.date ?? yearStart),
    byCategory: [...categories.values()].sort((a, b) => b.cents - a.cents),
    returns,
    dueDate: `${year + 1}-07-31`,
  };
}
